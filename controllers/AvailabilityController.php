<?php

declare(strict_types=1);

class AvailabilityController
{
    private const ALLOWED_DOCTORS = ['rosero', 'narvaez', 'indiferente'];
    private const ALLOWED_SERVICES = ['consulta', 'telefono', 'video', 'acne', 'cancer', 'laser', 'rejuvenecimiento'];

    public static function index(array $context): void
    {
        // GET /availability
        $store = $context['store'];
        $doctorResult = self::parseDoctorQuery($_GET['doctor'] ?? null);
        if (($doctorResult['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($doctorResult['error'] ?? 'Doctor invalido'),
                'code' => 'calendar_bad_request',
            ], 400);
        }

        $serviceResult = self::parseServiceQuery($_GET['service'] ?? null);
        if (($serviceResult['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($serviceResult['error'] ?? 'Servicio invalido'),
                'code' => 'calendar_bad_request',
            ], 400);
        }

        $dateResult = self::parseDateFromQuery($_GET['dateFrom'] ?? null);
        if (($dateResult['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($dateResult['error'] ?? 'Fecha invalida'),
                'code' => 'calendar_bad_request',
            ], 400);
        }

        $daysResult = self::parseDaysQuery($_GET['days'] ?? null);
        if (($daysResult['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($daysResult['error'] ?? 'Parametro days invalido'),
                'code' => 'calendar_bad_request',
            ], 400);
        }

        $service = (string) ($serviceResult['value'] ?? 'consulta');
        $doctor = (string) ($doctorResult['value'] ?? 'indiferente');
        $dateFrom = (string) ($dateResult['value'] ?? local_date('Y-m-d'));
        $days = (int) ($daysResult['value'] ?? 21);

        $availabilityService = CalendarAvailabilityService::fromEnv();
        $result = $availabilityService->getAvailability($store, [
            'service' => $service,
            'doctor' => $doctor,
            'dateFrom' => $dateFrom,
            'days' => $days,
        ]);

        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo consultar disponibilidad'),
                'code' => (string) ($result['code'] ?? 'availability_error'),
                'meta' => isset($result['meta']) && is_array($result['meta']) ? $result['meta'] : [],
            ], (int) ($result['status'] ?? 503));
        }

        $availability = self::sanitizeAvailability(
            isset($result['data']) && is_array($result['data']) ? $result['data'] : []
        );

        json_response([
            'ok' => true,
            'data' => $availability,
            'meta' => isset($result['meta']) && is_array($result['meta'])
                ? $result['meta']
                : [
                    'source' => count($availability) > 0 ? 'configured' : 'empty',
                    'generatedAt' => local_date('c'),
                ],
        ]);
    }

    public static function update(array $context): void
    {
        // POST /availability
        $availabilityService = CalendarAvailabilityService::fromEnv();
        if ($availabilityService->isGoogleActive()) {
            json_response([
                'ok' => false,
                'error' => 'La disponibilidad es de solo lectura porque usa Google Calendar',
                'code' => 'availability_read_only',
            ], 403);
        }

        $store = $context['store'];
        $payload = require_json_body();
        $availability = self::sanitizeAvailability(
            isset($payload['availability']) && is_array($payload['availability'])
                ? $payload['availability']
                : []
        );
        $store['availability'] = $availability;
        write_store($store);
        json_response([
            'ok' => true,
            'data' => $store['availability']
        ]);
    }

    private static function sanitizeAvailability(array $raw): array
    {
        $today = local_date('Y-m-d');
        $normalized = [];

        foreach ($raw as $date => $slots) {
            $dateKey = trim((string) $date);
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateKey)) {
                continue;
            }
            if ($dateKey < $today) {
                continue;
            }
            if (!is_array($slots) || count($slots) === 0) {
                continue;
            }

            $cleanSlots = [];
            foreach ($slots as $slot) {
                $time = trim((string) $slot);
                if (!preg_match('/^\d{2}:\d{2}$/', $time)) {
                    continue;
                }
                $cleanSlots[$time] = true;
            }

            if (count($cleanSlots) === 0) {
                continue;
            }

            $times = array_keys($cleanSlots);
            sort($times, SORT_STRING);
            $normalized[$dateKey] = $times;
        }

        ksort($normalized, SORT_STRING);
        return $normalized;
    }

    private static function parseDoctorQuery($raw): array
    {
        if ($raw === null || trim((string) $raw) === '') {
            return ['ok' => true, 'value' => 'indiferente'];
        }
        $doctor = strtolower(trim((string) $raw));
        if (!in_array($doctor, self::ALLOWED_DOCTORS, true)) {
            return ['ok' => false, 'error' => 'Doctor invalido. Usa rosero, narvaez o indiferente.'];
        }
        return ['ok' => true, 'value' => $doctor];
    }

    private static function parseServiceQuery($raw): array
    {
        if ($raw === null || trim((string) $raw) === '') {
            return ['ok' => true, 'value' => 'consulta'];
        }
        $service = strtolower(trim((string) $raw));
        if (!in_array($service, self::ALLOWED_SERVICES, true)) {
            return ['ok' => false, 'error' => 'Servicio invalido para disponibilidad'];
        }
        return ['ok' => true, 'value' => $service];
    }

    private static function parseDateFromQuery($raw): array
    {
        if ($raw === null || trim((string) $raw) === '') {
            return ['ok' => true, 'value' => local_date('Y-m-d')];
        }
        $dateFrom = trim((string) $raw);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
            return ['ok' => false, 'error' => 'dateFrom debe tener formato YYYY-MM-DD'];
        }
        return ['ok' => true, 'value' => $dateFrom];
    }

    private static function parseDaysQuery($raw): array
    {
        if ($raw === null || trim((string) $raw) === '') {
            return ['ok' => true, 'value' => 21];
        }
        if (!is_scalar($raw) || !preg_match('/^\d+$/', trim((string) $raw))) {
            return ['ok' => false, 'error' => 'days debe ser un entero entre 1 y 45'];
        }
        $days = (int) trim((string) $raw);
        if ($days < 1 || $days > 45) {
            return ['ok' => false, 'error' => 'days debe estar entre 1 y 45'];
        }
        return ['ok' => true, 'value' => $days];
    }
}
