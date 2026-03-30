<?php

declare(strict_types=1);

require_once __DIR__ . '/models.php';
require_once __DIR__ . '/validation.php';

final class BookingWaitlistService
{
    private const VALID_DOCTORS = ['rosero', 'narvaez'];

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public function create(array $store, array $payload): array
    {
        $entry = normalize_booking_waitlist_entry($payload);
        $validation = validate_booking_waitlist_payload($entry, [
            'validServices' => array_keys(get_services_config()),
            'validDoctors' => self::VALID_DOCTORS,
        ]);

        if (($validation['ok'] ?? false) !== true) {
            return [
                'ok' => false,
                'error' => (string) ($validation['error'] ?? 'No se pudo registrar la lista de espera'),
                'code' => 400,
            ];
        }

        $entries = isset($store['booking_waitlist']) && is_array($store['booking_waitlist'])
            ? array_values($store['booking_waitlist'])
            : [];

        foreach ($entries as $existing) {
            if (!is_array($existing)) {
                continue;
            }

            if ((string) ($existing['tenantId'] ?? '') !== (string) ($entry['tenantId'] ?? '')) {
                continue;
            }

            if (map_waitlist_status((string) ($existing['status'] ?? 'pending')) === 'cancelled') {
                continue;
            }

            if (
                $this->normalizePhoneForMatch((string) ($existing['phone'] ?? '')) === $this->normalizePhoneForMatch((string) ($entry['phone'] ?? '')) &&
                strtolower(trim((string) ($existing['service'] ?? ''))) === strtolower(trim((string) ($entry['service'] ?? ''))) &&
                strtolower(trim((string) ($existing['doctor'] ?? ''))) === strtolower(trim((string) ($entry['doctor'] ?? ''))) &&
                trim((string) ($existing['date'] ?? '')) === trim((string) ($entry['date'] ?? ''))
            ) {
                return [
                    'ok' => true,
                    'store' => $store,
                    'data' => normalize_booking_waitlist_entry($existing),
                    'created' => false,
                    'code' => 200,
                ];
            }
        }

        $entry['createdAt'] = local_date('c');
        $entry['updatedAt'] = $entry['createdAt'];
        $entries[] = $entry;
        $store['booking_waitlist'] = $entries;

        return [
            'ok' => true,
            'store' => $store,
            'data' => $entry,
            'created' => true,
            'code' => 201,
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $slot
     * @return array<string,mixed>
     */
    public function notifyFreedSlot(array $store, array $slot): array
    {
        $slotDate = trim((string) ($slot['date'] ?? ''));
        $slotTime = trim((string) ($slot['time'] ?? ''));
        $slotDoctor = strtolower(trim((string) ($slot['doctor'] ?? '')));
        $slotService = strtolower(trim((string) ($slot['service'] ?? '')));

        if ($slotDate === '' || $slotTime === '' || $slotDoctor === '' || $slotService === '') {
            return ['ok' => true, 'store' => $store, 'notified' => false, 'data' => []];
        }

        $entries = isset($store['booking_waitlist']) && is_array($store['booking_waitlist'])
            ? array_values($store['booking_waitlist'])
            : [];
        if ($entries === []) {
            return ['ok' => true, 'store' => $store, 'notified' => false, 'data' => []];
        }

        $candidateIndex = null;
        $candidate = null;
        foreach ($entries as $index => $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $status = map_waitlist_status((string) ($entry['status'] ?? 'pending'));
            if ($status !== 'pending') {
                continue;
            }

            if (trim((string) ($entry['date'] ?? '')) !== $slotDate) {
                continue;
            }

            if (strtolower(trim((string) ($entry['service'] ?? ''))) !== $slotService) {
                continue;
            }

            $entryDoctor = strtolower(trim((string) ($entry['doctor'] ?? 'indiferente')));
            if ($entryDoctor !== 'indiferente' && $entryDoctor !== $slotDoctor) {
                continue;
            }

            if ($candidate === null) {
                $candidate = $entry;
                $candidateIndex = $index;
                continue;
            }

            $currentCreatedAt = strtotime((string) ($candidate['createdAt'] ?? '')) ?: PHP_INT_MAX;
            $entryCreatedAt = strtotime((string) ($entry['createdAt'] ?? '')) ?: PHP_INT_MAX;
            if ($entryCreatedAt < $currentCreatedAt) {
                $candidate = $entry;
                $candidateIndex = $index;
            }
        }

        if ($candidate === null || $candidateIndex === null) {
            return ['ok' => true, 'store' => $store, 'notified' => false, 'data' => []];
        }

        if (!$this->enqueueWhatsappNotification($candidate, [
            'date' => $slotDate,
            'time' => $slotTime,
            'doctor' => $slotDoctor,
            'service' => $slotService,
        ])) {
            return ['ok' => true, 'store' => $store, 'notified' => false, 'data' => []];
        }

        $candidate['status'] = 'notified';
        $candidate['updatedAt'] = local_date('c');
        $candidate['notifiedAt'] = $candidate['updatedAt'];
        $candidate['notificationChannel'] = 'whatsapp';
        $candidate['offeredSlot'] = [
            'date' => $slotDate,
            'time' => $slotTime,
            'doctor' => $slotDoctor,
            'service' => $slotService,
        ];
        $entries[$candidateIndex] = $candidate;
        $store['booking_waitlist'] = $entries;

        return [
            'ok' => true,
            'store' => $store,
            'notified' => true,
            'data' => $candidate,
        ];
    }

    /**
     * @param array<string,mixed> $entry
     * @param array<string,string> $slot
     */
    private function enqueueWhatsappNotification(array $entry, array $slot): bool
    {
        $bootstrapPath = __DIR__ . '/whatsapp_openclaw/bootstrap.php';
        if (!function_exists('whatsapp_openclaw_repository') && is_file($bootstrapPath)) {
            require_once $bootstrapPath;
        }

        if (!function_exists('whatsapp_openclaw_repository')) {
            return false;
        }

        $phone = trim((string) ($entry['phone'] ?? ''));
        if ($phone === '') {
            return false;
        }

        $name = trim((string) ($entry['name'] ?? 'Paciente'));
        $serviceLabel = get_service_label((string) ($slot['service'] ?? 'consulta'));
        $doctorLabel = get_doctor_label((string) ($slot['doctor'] ?? 'indiferente'));
        $dateLabel = format_date_label((string) ($slot['date'] ?? ''));
        $timeLabel = trim((string) ($slot['time'] ?? ''));

        $text = "Hola {$name},\n";
        $text .= "Se liberó un espacio en la agenda para {$serviceLabel}.\n\n";
        $text .= "🗓 Fecha: {$dateLabel}\n";
        $text .= "⏰ Hora: {$timeLabel}\n";
        $text .= "👩‍⚕️ Doctor: {$doctorLabel}\n\n";
        $text .= "Si te interesa este cupo, respóndenos por WhatsApp lo antes posible para ayudarte a confirmarlo.";

        try {
            whatsapp_openclaw_repository()->enqueueOutbox([
                'phone' => $phone,
                'status' => 'pending',
                'type' => 'text',
                'payload' => [
                    'text' => $text,
                ],
                'meta' => [
                    'source' => 'booking_waitlist',
                    'waitlistId' => (int) ($entry['id'] ?? 0),
                    'slot' => $slot,
                ],
            ]);
            return true;
        } catch (\Throwable $error) {
            error_log('Aurora Derm: waitlist WhatsApp enqueue failed - ' . $error->getMessage());
            return false;
        }
    }

    private function normalizePhoneForMatch(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone);
        if (!is_string($digits)) {
            return '';
        }

        return ltrim($digits, '0');
    }
}
