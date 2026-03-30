<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/BookingWaitlistService.php';

final class BookingWaitlistController
{
    public static function store(array $context): void
    {
        require_rate_limit('booking_waitlist', 5, 60);

        $payload = require_json_body();
        $service = new BookingWaitlistService();

        $lockResult = with_store_lock(static function () use ($service, $payload): array {
            $store = read_store();
            $result = $service->create($store, is_array($payload) ? $payload : []);

            if (($result['ok'] ?? false) !== true) {
                return $result;
            }

            if (($result['created'] ?? false) === true) {
                if (!write_store($result['store'], false)) {
                    return [
                        'ok' => false,
                        'error' => 'No se pudo guardar la lista de espera',
                        'code' => 503,
                    ];
                }
            }

            return $result;
        });

        if (($lockResult['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($lockResult['error'] ?? 'Store lock failed'),
            ], (int) ($lockResult['code'] ?? 503));
        }

        $result = is_array($lockResult['result'] ?? null)
            ? $lockResult['result']
            : ['ok' => false, 'error' => 'Respuesta inválida', 'code' => 500];

        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo registrar la lista de espera'),
            ], (int) ($result['code'] ?? 400));
        }

        json_response([
            'ok' => true,
            'data' => $result['data'] ?? [],
            'created' => ($result['created'] ?? false) === true,
        ], (int) ($result['code'] ?? 201));
    }
}
