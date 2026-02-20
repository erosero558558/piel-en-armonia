<?php
declare(strict_types=1);

class AppointmentController
{
    public static function index(array $context): void
    {
        // GET /appointments (Admin)
        $store = $context['store'];
        json_response([
            'ok' => true,
            'data' => $store['appointments']
        ]);
    }

    public static function bookedSlots(array $context): void
    {
        // GET /booked-slots
        $store = $context['store'];
        $date = isset($_GET['date']) ? (string) $_GET['date'] : '';
        if ($date === '') {
            json_response([
                'ok' => false,
                'error' => 'Fecha requerida'
            ], 400);
        }

        $doctor = isset($_GET['doctor']) ? trim((string) $_GET['doctor']) : '';

        $slots = [];
        foreach ($store['appointments'] as $appointment) {
            $status = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
            if ($status === 'cancelled') {
                continue;
            }
            if ((string) ($appointment['date'] ?? '') !== $date) {
                continue;
            }
            if ($doctor !== '' && $doctor !== 'indiferente') {
                $apptDoctor = (string) ($appointment['doctor'] ?? '');
                if ($apptDoctor !== '' && $apptDoctor !== 'indiferente' && $apptDoctor !== $doctor) {
                    continue;
                }
            }
            $time = (string) ($appointment['time'] ?? '');
            if ($time !== '') {
                $slots[] = $time;
            }
        }

        $slots = array_values(array_unique($slots));
        sort($slots);

        json_response([
            'ok' => true,
            'data' => $slots
        ]);
    }

    public static function store(array $context): void
    {
        // POST /appointments
        $store = $context['store'];
        require_rate_limit('appointments', 5, 60);
        $payload = require_json_body();
        $appointment = normalize_appointment($payload);

        if ($appointment['name'] === '' || $appointment['email'] === '' || $appointment['phone'] === '') {
            json_response([
                'ok' => false,
                'error' => 'Nombre, email y teléfono son obligatorios'
            ], 400);
        }

        if (!validate_email($appointment['email'])) {
            json_response([
                'ok' => false,
                'error' => 'El formato del email no es válido'
            ], 400);
        }

        if (!validate_phone($appointment['phone'])) {
            json_response([
                'ok' => false,
                'error' => 'El formato del teléfono no es válido'
            ], 400);
        }

        if (!isset($appointment['privacyConsent']) || $appointment['privacyConsent'] !== true) {
            json_response([
                'ok' => false,
                'error' => 'Debes aceptar el tratamiento de datos para reservar la cita'
            ], 400);
        }

        if ($appointment['date'] === '' || $appointment['time'] === '') {
            json_response([
                'ok' => false,
                'error' => 'Fecha y hora son obligatorias'
            ], 400);
        }

        if ($appointment['date'] < local_date('Y-m-d')) {
            json_response([
                'ok' => false,
                'error' => 'No se puede agendar en una fecha pasada'
            ], 400);
        }

        // Validar que el horario exista en la disponibilidad configurada
        $availableSlots = isset($store['availability'][$appointment['date']]) && is_array($store['availability'][$appointment['date']])
            ? $store['availability'][$appointment['date']]
            : [];
        if (count($availableSlots) > 0 && !in_array($appointment['time'], $availableSlots, true)) {
            json_response([
                'ok' => false,
                'error' => 'Ese horario no está disponible para la fecha seleccionada'
            ], 400);
        }

        if (appointment_slot_taken($store['appointments'], $appointment['date'], $appointment['time'], null, $appointment['doctor'])) {
            json_response([
                'ok' => false,
                'error' => 'Ese horario ya fue reservado'
            ], 409);
        }

        $paymentMethod = strtolower(trim((string) ($appointment['paymentMethod'] ?? 'unpaid')));
        if (!in_array($paymentMethod, ['card', 'transfer', 'cash', 'unpaid'], true)) {
            json_response([
                'ok' => false,
                'error' => 'Metodo de pago no valido'
            ], 400);
        }

        if ($paymentMethod === 'card') {
            $paymentIntentId = trim((string) ($appointment['paymentIntentId'] ?? ''));
            if ($paymentIntentId === '') {
                json_response([
                    'ok' => false,
                    'error' => 'Falta confirmar el pago con tarjeta'
                ], 400);
            }

            foreach ($store['appointments'] as $existingAppointment) {
                $existingIntent = trim((string) ($existingAppointment['paymentIntentId'] ?? ''));
                if ($existingIntent !== '' && hash_equals($existingIntent, $paymentIntentId)) {
                    json_response([
                        'ok' => false,
                        'error' => 'Este pago ya fue utilizado para otra reserva'
                    ], 409);
                }
            }

            if (!payment_gateway_enabled()) {
                json_response([
                    'ok' => false,
                    'error' => 'La pasarela de pago no esta disponible'
                ], 503);
            }

            try {
                $intent = stripe_get_payment_intent($paymentIntentId);
            } catch (RuntimeException $e) {
                json_response([
                    'ok' => false,
                    'error' => 'No se pudo validar el pago en este momento'
                ], 502);
            }

            $intentStatus = (string) ($intent['status'] ?? '');
            $expectedAmount = payment_expected_amount_cents($appointment['service']);
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
                json_response([
                    'ok' => false,
                    'error' => 'El pago aun no esta completado'
                ], 400);
            }
            if ($intentAmount !== $expectedAmount || $amountReceived < $expectedAmount) {
                json_response([
                    'ok' => false,
                    'error' => 'El monto pagado no coincide con la reserva'
                ], 400);
            }
            if ($intentCurrency !== $expectedCurrency) {
                json_response([
                    'ok' => false,
                    'error' => 'La moneda del pago no coincide con la configuracion'
                ], 400);
            }
            if ($metadataSite !== '' && strcasecmp($metadataSite, 'pielarmonia.com') !== 0) {
                json_response([
                    'ok' => false,
                    'error' => 'El pago no pertenece a este sitio'
                ], 400);
            }
            if ($metadataService !== '' && $metadataService !== $appointment['service']) {
                json_response([
                    'ok' => false,
                    'error' => 'El pago no coincide con el servicio seleccionado'
                ], 400);
            }
            if ($metadataDate !== '' && $metadataDate !== $appointment['date']) {
                json_response([
                    'ok' => false,
                    'error' => 'El pago no coincide con la fecha seleccionada'
                ], 400);
            }
            if ($metadataTime !== '' && $metadataTime !== $appointment['time']) {
                json_response([
                    'ok' => false,
                    'error' => 'El pago no coincide con la hora seleccionada'
                ], 400);
            }
            if ($metadataDoctor !== '' && $metadataDoctor !== $appointment['doctor']) {
                json_response([
                    'ok' => false,
                    'error' => 'El pago no coincide con el doctor seleccionado'
                ], 400);
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
                json_response([
                    'ok' => false,
                    'error' => 'Debes ingresar el numero de referencia de la transferencia'
                ], 400);
            }
            if ($proofPath === '' || $proofUrl === '') {
                json_response([
                    'ok' => false,
                    'error' => 'Debes adjuntar el comprobante de transferencia'
                ], 400);
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

        // Si el doctor es "indiferente", asignar al primer doctor con slot libre
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
        write_store($store);

        $emailSent = maybe_send_appointment_email($appointment);
        maybe_send_admin_notification($appointment);

        json_response([
            'ok' => true,
            'data' => $appointment,
            'emailSent' => $emailSent
        ], 201);
    }

    public static function update(array $context): void
    {
        // PATCH /appointments (Admin)
        $store = $context['store'];
        $payload = require_json_body();
        $id = isset($payload['id']) ? (int) $payload['id'] : 0;
        if ($id <= 0) {
            json_response([
                'ok' => false,
                'error' => 'Identificador inválido'
            ], 400);
        }
        $found = false;
        foreach ($store['appointments'] as &$appt) {
            if ((int) ($appt['id'] ?? 0) !== $id) {
                continue;
            }
            $found = true;
            if (isset($payload['status'])) {
                $appt['status'] = map_appointment_status((string) $payload['status']);
            }
            if (isset($payload['paymentStatus'])) {
                $appt['paymentStatus'] = (string) $payload['paymentStatus'];
            }
            if (isset($payload['paymentMethod'])) {
                $appt['paymentMethod'] = (string) $payload['paymentMethod'];
            }
            if (isset($payload['paymentProvider'])) {
                $appt['paymentProvider'] = (string) $payload['paymentProvider'];
            }
            if (isset($payload['paymentIntentId'])) {
                $appt['paymentIntentId'] = (string) $payload['paymentIntentId'];
            }
            if (isset($payload['paymentPaidAt'])) {
                $appt['paymentPaidAt'] = (string) $payload['paymentPaidAt'];
            }
            if (isset($payload['transferReference'])) {
                $appt['transferReference'] = (string) $payload['transferReference'];
            }
            if (isset($payload['transferProofPath'])) {
                $appt['transferProofPath'] = (string) $payload['transferProofPath'];
            }
            if (isset($payload['transferProofUrl'])) {
                $appt['transferProofUrl'] = (string) $payload['transferProofUrl'];
            }
            if (isset($payload['transferProofName'])) {
                $appt['transferProofName'] = (string) $payload['transferProofName'];
            }
            if (isset($payload['transferProofMime'])) {
                $appt['transferProofMime'] = (string) $payload['transferProofMime'];
            }
        }
        unset($appt);
        if (!$found) {
            json_response([
                'ok' => false,
                'error' => 'Cita no encontrada'
            ], 404);
        }
        write_store($store);

        // Enviar email de cancelación al paciente si se canceló la cita
        if (isset($payload['status']) && map_appointment_status((string) $payload['status']) === 'cancelled') {
            foreach ($store['appointments'] as $apptNotify) {
                if ((int) ($apptNotify['id'] ?? 0) === $id) {
                    maybe_send_cancellation_email($apptNotify);
                    break;
                }
            }
        }

        json_response([
            'ok' => true
        ]);
    }

    public static function checkReschedule(array $context): void
    {
        // GET /reschedule
        $store = $context['store'];
        $token = trim((string) ($_GET['token'] ?? ''));
        if ($token === '' || strlen($token) < 16) {
            json_response(['ok' => false, 'error' => 'Token inválido'], 400);
        }

        $found = null;
        foreach ($store['appointments'] as $appt) {
            if (($appt['rescheduleToken'] ?? '') === $token && ($appt['status'] ?? '') !== 'cancelled') {
                $found = $appt;
                break;
            }
        }

        if (!$found) {
            json_response(['ok' => false, 'error' => 'Cita no encontrada o cancelada'], 404);
        }

        json_response([
            'ok' => true,
            'data' => [
                'id' => $found['id'],
                'service' => $found['service'] ?? '',
                'doctor' => $found['doctor'] ?? '',
                'date' => $found['date'] ?? '',
                'time' => $found['time'] ?? '',
                'name' => $found['name'] ?? '',
                'status' => $found['status'] ?? ''
            ]
        ]);
    }

    public static function processReschedule(array $context): void
    {
        // PATCH /reschedule
        $store = $context['store'];
        require_rate_limit('reschedule', 5, 60);
        $payload = require_json_body();
        $token = trim((string) ($payload['token'] ?? ''));
        $newDate = trim((string) ($payload['date'] ?? ''));
        $newTime = trim((string) ($payload['time'] ?? ''));

        if ($token === '' || strlen($token) < 16) {
            json_response(['ok' => false, 'error' => 'Token inválido'], 400);
        }
        if ($newDate === '' || $newTime === '') {
            json_response(['ok' => false, 'error' => 'Fecha y hora son obligatorias'], 400);
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $newDate)) {
            json_response(['ok' => false, 'error' => 'Formato de fecha inválido'], 400);
        }
        if (strtotime($newDate) < strtotime(date('Y-m-d'))) {
            json_response(['ok' => false, 'error' => 'No puedes reprogramar a una fecha pasada'], 400);
        }

        $found = false;
        foreach ($store['appointments'] as &$appt) {
            if (($appt['rescheduleToken'] ?? '') !== $token) {
                continue;
            }
            if (($appt['status'] ?? '') === 'cancelled') {
                json_response(['ok' => false, 'error' => 'Esta cita fue cancelada'], 400);
            }

            $doctor = $appt['doctor'] ?? '';
            $excludeId = (int) ($appt['id'] ?? 0);
            if (appointment_slot_taken($store['appointments'], $newDate, $newTime, $excludeId, $doctor)) {
                json_response(['ok' => false, 'error' => 'El horario seleccionado ya no está disponible'], 409);
            }

            $appt['date'] = $newDate;
            $appt['time'] = $newTime;
            $appt['reminderSentAt'] = '';
            $found = true;

            write_store($store);
            maybe_send_reschedule_email($appt);

            json_response([
                'ok' => true,
                'data' => [
                    'id' => $appt['id'],
                    'date' => $newDate,
                    'time' => $newTime
                ]
            ]);
        }
        unset($appt);

        if (!$found) {
            json_response(['ok' => false, 'error' => 'Cita no encontrada'], 404);
        }
    }
}
