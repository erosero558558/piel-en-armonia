<?php

declare(strict_types=1);

require_once __DIR__ . '/business.php';
require_once __DIR__ . '/models.php';
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/common.php';

class BookingService
{
    /**
     * Creates a new appointment.
     *
     * @param array $store The current data store.
     * @param array $payload The raw appointment data.
     * @return array Result ['ok' => bool, 'store' => array, 'data' => array, 'error' => string, 'code' => int]
     */
    public function create(array $store, array $payload): array
    {
        $appointment = normalize_appointment($payload);

        if ($appointment['name'] === '' || $appointment['email'] === '' || $appointment['phone'] === '') {
            return ['ok' => false, 'error' => 'Nombre, email y teléfono son obligatorios', 'code' => 400];
        }

        if (!validate_email($appointment['email'])) {
            return ['ok' => false, 'error' => 'El formato del email no es válido', 'code' => 400];
        }

        if (!validate_phone($appointment['phone'])) {
            return ['ok' => false, 'error' => 'El formato del teléfono no es válido', 'code' => 400];
        }

        if (!isset($appointment['privacyConsent']) || $appointment['privacyConsent'] !== true) {
            return ['ok' => false, 'error' => 'Debes aceptar el tratamiento de datos para reservar la cita', 'code' => 400];
        }

        if ($appointment['date'] === '' || $appointment['time'] === '') {
            return ['ok' => false, 'error' => 'Fecha y hora son obligatorias', 'code' => 400];
        }

        // Use a mockable date function if needed, but for now rely on local_date/date
        if ($appointment['date'] < local_date('Y-m-d')) {
            return ['ok' => false, 'error' => 'No se puede agendar en una fecha pasada', 'code' => 400];
        }

        // Validate availability (strict real agenda)
        $availableSlots = $this->getConfiguredSlotsForDate($store, $appointment['date']);
        if (count($availableSlots) === 0) {
            return ['ok' => false, 'error' => 'No hay agenda disponible para la fecha seleccionada', 'code' => 400];
        }
        if (!in_array($appointment['time'], $availableSlots, true)) {
            return ['ok' => false, 'error' => 'Ese horario no está disponible para la fecha seleccionada', 'code' => 400];
        }

        if (appointment_slot_taken($store['appointments'], $appointment['date'], $appointment['time'], null, $appointment['doctor'])) {
            return ['ok' => false, 'error' => 'Ese horario ya fue reservado', 'code' => 409];
        }

        $paymentMethod = $appointment['paymentMethod'];

        // Handle payment checks (Card logic is complex and relies on Stripe, skipping deep integration here, assuming validated by controller or separate service if possible, but for now copying logic)
        // Actually, payment intent validation does external calls. Ideally this should be injected.
        // For this refactor, I will assume the controller handles the Stripe verification BEFORE calling this service, OR I pass the intent data.
        // But the original code does it inside `store`.
        // To keep it testable, I might separate payment validation.
        // However, to keep it simple and consistent with the request, I will include the logic but allow passing an optional payment verification result or dependency.

        // Let's assume the controller does the Stripe verification if needed and passes the verified payment details?
        // No, `AppointmentController` does `stripe_get_payment_intent`.

        // I will keep the logic here but wrap the stripe call.
        if ($paymentMethod === 'card') {
            $paymentIntentId = trim((string) ($appointment['paymentIntentId'] ?? ''));
            if ($paymentIntentId === '') {
                return ['ok' => false, 'error' => 'Falta confirmar el pago con tarjeta', 'code' => 400];
            }

            foreach ($store['appointments'] as $existingAppointment) {
                $existingIntent = trim((string) ($existingAppointment['paymentIntentId'] ?? ''));
                if ($existingIntent !== '' && hash_equals($existingIntent, $paymentIntentId)) {
                    return ['ok' => false, 'error' => 'Este pago ya fue utilizado para otra reserva', 'code' => 409];
                }
            }

            // We can't easily move the Stripe API call here without dependency injection.
            // For now, I'll rely on global `stripe_get_payment_intent` availability or a callback.
            // But better: I'll assume the validation happens here.

            if (!function_exists('payment_gateway_enabled') || !payment_gateway_enabled()) {
                return ['ok' => false, 'error' => 'La pasarela de pago no esta disponible', 'code' => 503];
            }

            try {
                // Dependency: stripe_get_payment_intent
                $intent = stripe_get_payment_intent($paymentIntentId);
            } catch (RuntimeException $e) {
                return ['ok' => false, 'error' => 'No se pudo validar el pago en este momento', 'code' => 502];
            }

            // Verify intent
            $validation = $this->validatePaymentIntent($intent, $appointment);
            if (!$validation['ok']) {
                return $validation;
            }

            $appointment['paymentMethod'] = 'card';
            $appointment['paymentStatus'] = 'paid';
            $appointment['paymentProvider'] = 'stripe';
            $appointment['paymentPaidAt'] = local_date('c');
            $appointment['paymentIntentId'] = $paymentIntentId;

        } elseif ($paymentMethod === 'transfer') {
            $reference = trim((string) ($appointment['transferReference'] ?? ''));
            $proofPath = trim((string) ($appointment['transferProofPath'] ?? ''));
            $proofUrl = trim((string) ($appointment['transferProofUrl'] ?? ''));

            if ($reference === '') {
                return ['ok' => false, 'error' => 'Debes ingresar el numero de referencia de la transferencia', 'code' => 400];
            }
            if ($proofPath === '' || $proofUrl === '') {
                return ['ok' => false, 'error' => 'Debes adjuntar el comprobante de transferencia', 'code' => 400];
            }

            $appointment['paymentMethod'] = 'transfer';
            $appointment['paymentStatus'] = 'pending_transfer_review';
        } elseif ($paymentMethod === 'cash') {
            $appointment['paymentMethod'] = 'cash';
            $appointment['paymentStatus'] = 'pending_cash';
        } else {
            $appointment['paymentMethod'] = 'unpaid';
            $appointment['paymentStatus'] = 'pending';
        }

        // Doctor assignment
        if ($appointment['doctor'] === 'indiferente' || $appointment['doctor'] === '') {
            $doctors = ['rosero', 'narvaez'];
            $assigned = '';
            foreach ($doctors as $candidate) {
                if (!appointment_slot_taken($store['appointments'], $appointment['date'], $appointment['time'], null, $candidate)) {
                    $assigned = $candidate;
                    break;
                }
            }
            if ($assigned !== '') {
                $appointment['doctorAssigned'] = $assigned;
            }
        }

        $store['appointments'][] = $appointment;

        return [
            'ok' => true,
            'store' => $store,
            'data' => $appointment,
            'code' => 201
        ];
    }

    /**
     * Cancels an appointment.
     */
    public function cancel(array $store, int $id): array
    {
        if ($id <= 0) {
            return ['ok' => false, 'error' => 'Identificador inválido', 'code' => 400];
        }

        $found = false;
        $cancelledAppointment = null;

        foreach ($store['appointments'] as &$appt) {
            if ((int) ($appt['id'] ?? 0) !== $id) {
                continue;
            }
            $found = true;
            $appt['status'] = 'cancelled';
            $cancelledAppointment = $appt;
            break;
        }
        unset($appt);

        if (!$found) {
            return ['ok' => false, 'error' => 'Cita no encontrada', 'code' => 404];
        }

        return [
            'ok' => true,
            'store' => $store,
            'data' => $cancelledAppointment,
            'code' => 200
        ];
    }

    /**
     * Reschedules an appointment.
     */
    public function reschedule(array $store, string $token, string $newDate, string $newTime): array
    {
        if ($token === '' || strlen($token) < 16) {
            return ['ok' => false, 'error' => 'Token inválido', 'code' => 400];
        }
        if ($newDate === '' || $newTime === '') {
            return ['ok' => false, 'error' => 'Fecha y hora son obligatorias', 'code' => 400];
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $newDate)) {
            return ['ok' => false, 'error' => 'Formato de fecha inválido', 'code' => 400];
        }
        if (strtotime($newDate) < strtotime(date('Y-m-d'))) {
            return ['ok' => false, 'error' => 'No puedes reprogramar a una fecha pasada', 'code' => 400];
        }

        $found = false;
        $updatedAppointment = null;

        foreach ($store['appointments'] as &$appt) {
            if (($appt['rescheduleToken'] ?? '') !== $token) {
                continue;
            }
            if (($appt['status'] ?? '') === 'cancelled') {
                return ['ok' => false, 'error' => 'Esta cita fue cancelada', 'code' => 400];
            }

            $doctor = $appt['doctor'] ?? '';
            $excludeId = (int) ($appt['id'] ?? 0);

            // Availability check (strict real agenda)
            $availableSlots = $this->getConfiguredSlotsForDate($store, $newDate);
            if (count($availableSlots) === 0) {
                return ['ok' => false, 'error' => 'No hay agenda disponible para la fecha seleccionada', 'code' => 400];
            }
            if (!in_array($newTime, $availableSlots, true)) {
                return ['ok' => false, 'error' => 'Ese horario no está disponible para la fecha seleccionada', 'code' => 400];
            }

            if (appointment_slot_taken($store['appointments'], $newDate, $newTime, $excludeId, $doctor)) {
                return ['ok' => false, 'error' => 'El horario seleccionado ya no está disponible', 'code' => 409];
            }

            $appt['date'] = $newDate;
            $appt['time'] = $newTime;
            $appt['reminderSentAt'] = '';

            $found = true;
            $updatedAppointment = $appt;
            break;
        }
        unset($appt);

        if (!$found) {
            return ['ok' => false, 'error' => 'Cita no encontrada', 'code' => 404];
        }

        return [
            'ok' => true,
            'store' => $store,
            'data' => $updatedAppointment,
            'code' => 200
        ];
    }

    private function validatePaymentIntent(array $intent, array $appointment): array
    {
        $intentStatus = (string) ($intent['status'] ?? '');
        $tenantId = (string) ($appointment['tenantId'] ?? get_current_tenant_id());
        $expectedAmount = payment_expected_amount_cents($appointment['service'], null, null, $tenantId);
        $intentAmount = isset($intent['amount']) ? (int) $intent['amount'] : 0;
        $amountReceived = isset($intent['amount_received']) ? (int) $intent['amount_received'] : 0;
        $intentCurrency = strtoupper((string) ($intent['currency'] ?? payment_currency()));
        $expectedCurrency = strtoupper(payment_currency());
        $intentMetadata = isset($intent['metadata']) && is_array($intent['metadata']) ? $intent['metadata'] : [];
        $metadataSite = trim((string) ($intentMetadata['site'] ?? ''));
        $metadataService = trim((string) ($intentMetadata['service'] ?? ''));
        $metadataDate = trim((string) ($intentMetadata['date'] ?? ''));
        $metadataTime = trim((string) ($intentMetadata['time'] ?? ''));
        $metadataDoctor = trim((string) ($intentMetadata['doctor'] ?? ''));

        if ($intentStatus !== 'succeeded') {
            return ['ok' => false, 'error' => 'El pago aun no esta completado', 'code' => 400];
        }
        if ($intentAmount !== $expectedAmount || $amountReceived < $expectedAmount) {
            return ['ok' => false, 'error' => 'El monto pagado no coincide con la reserva', 'code' => 400];
        }
        if ($intentCurrency !== $expectedCurrency) {
            return ['ok' => false, 'error' => 'La moneda del pago no coincide con la configuracion', 'code' => 400];
        }
        if ($metadataSite !== '' && strcasecmp($metadataSite, 'pielarmonia.com') !== 0) {
            return ['ok' => false, 'error' => 'El pago no pertenece a este sitio', 'code' => 400];
        }
        if ($metadataService !== '' && $metadataService !== $appointment['service']) {
            return ['ok' => false, 'error' => 'El pago no coincide con el servicio seleccionado', 'code' => 400];
        }
        if ($metadataDate !== '' && $metadataDate !== $appointment['date']) {
            return ['ok' => false, 'error' => 'El pago no coincide con la fecha seleccionada', 'code' => 400];
        }
        if ($metadataTime !== '' && $metadataTime !== $appointment['time']) {
            return ['ok' => false, 'error' => 'El pago no coincide con la hora seleccionada', 'code' => 400];
        }
        if ($metadataDoctor !== '' && $metadataDoctor !== $appointment['doctor']) {
            return ['ok' => false, 'error' => 'El pago no coincide con el doctor seleccionado', 'code' => 400];
        }

        return ['ok' => true];
    }

    private function getConfiguredSlotsForDate(array $store, string $date): array
    {
        $slots = [];

        if (isset($store['availability'][$date]) && is_array($store['availability'][$date])) {
            $slots = $store['availability'][$date];
        }

        if (
            count($slots) === 0 &&
            function_exists('default_availability_enabled') &&
            default_availability_enabled() &&
            function_exists('get_default_availability')
        ) {
            $fallback = get_default_availability();
            if (isset($fallback[$date]) && is_array($fallback[$date])) {
                $slots = $fallback[$date];
            }
        }

        $normalized = [];
        foreach ($slots as $slot) {
            $time = trim((string) $slot);
            if (!preg_match('/^\d{2}:\d{2}$/', $time)) {
                continue;
            }
            $normalized[$time] = true;
        }

        $result = array_keys($normalized);
        sort($result, SORT_STRING);
        return $result;
    }
}
