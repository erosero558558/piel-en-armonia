<?php

declare(strict_types=1);

class AvailabilityController
{
    public static function index(array $context): void
    {
        // GET /availability
        $store = $context['store'];
        json_response([
            'ok' => true,
            'data' => $store['availability']
        ]);
    }

    public static function update(array $context): void
    {
        // POST /availability
        $store = $context['store'];
        $payload = require_json_body();
        $availability = isset($payload['availability']) && is_array($payload['availability'])
            ? $payload['availability']
            : [];
        $store['availability'] = $availability;
        write_store($store);
        json_response([
            'ok' => true,
            'data' => $store['availability']
        ]);
    }
}
