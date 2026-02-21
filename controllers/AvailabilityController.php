<?php

declare(strict_types=1);

class AvailabilityController
{
    public static function index(array $context): void
    {
        // GET /availability
        $store = $context['store'];
        $availability = isset($store['availability']) && is_array($store['availability']) ? $store['availability'] : [];
        if (
            count($availability) === 0 &&
            function_exists('default_availability_enabled') &&
            default_availability_enabled()
        ) {
            $availability = get_default_availability();
        }

        json_response([
            'ok' => true,
            'data' => $availability
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
