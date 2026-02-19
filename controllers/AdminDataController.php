<?php
declare(strict_types=1);

class AdminDataController
{
    public static function index(array $context): void
    {
        // GET /data (Admin)
        $store = $context['store'];
        json_response([
            'ok' => true,
            'data' => $store
        ]);
    }

    public static function import(array $context): void
    {
        // POST /import (Admin)
        $store = $context['store'];
        if (!$context['isAdmin']) {
             json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }
        require_csrf();

        $payload = require_json_body();
        $store['appointments'] = isset($payload['appointments']) && is_array($payload['appointments']) ? $payload['appointments'] : [];
        $store['callbacks'] = isset($payload['callbacks']) && is_array($payload['callbacks']) ? $payload['callbacks'] : [];
        $store['reviews'] = isset($payload['reviews']) && is_array($payload['reviews']) ? $payload['reviews'] : [];
        $store['availability'] = isset($payload['availability']) && is_array($payload['availability']) ? $payload['availability'] : [];
        write_store($store);
        json_response([
            'ok' => true
        ]);
    }
}
