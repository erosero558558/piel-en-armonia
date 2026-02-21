<?php

declare(strict_types=1);

class AvailabilityController
{
    public static function index(array $context): void
    {
        // GET /availability
        $store = $context['store'];
        $availability = self::sanitizeAvailability(
            isset($store['availability']) && is_array($store['availability']) ? $store['availability'] : []
        );

        $fallbackEnabled = function_exists('default_availability_enabled') && default_availability_enabled();
        if (
            count($availability) === 0 &&
            $fallbackEnabled &&
            function_exists('get_default_availability')
        ) {
            $availability = self::sanitizeAvailability(get_default_availability());
            if (count($availability) > 0) {
                $store['availability'] = $availability;
                write_store($store, false);
            }
        }

        json_response([
            'ok' => true,
            'data' => $availability,
            'meta' => [
                'source' => count($availability) > 0 ? 'configured' : 'empty',
                'fallbackEnabled' => $fallbackEnabled
            ]
        ]);
    }

    public static function update(array $context): void
    {
        // POST /availability
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
}
