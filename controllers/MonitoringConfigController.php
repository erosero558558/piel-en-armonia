<?php

declare(strict_types=1);

class MonitoringConfigController
{
    public static function monitoringConfig(array $context): void
    {
        // Safe explicit allowlist of values public to the frontend
        $dsn = getenv('PIELARMONIA_SENTRY_DSN_PUBLIC');
        if (!is_string($dsn) || trim($dsn) === '') {
            $dsn = getenv('AURORADERM_SENTRY_DSN_FRONTEND');
        }

        $ga = getenv('PIELARMONIA_GA_MEASUREMENT_ID') ?: getenv('AURORADERM_GA_MEASUREMENT_ID');
        if (!$ga) {
            $ga = 'G-2DWZ5PJ4MC'; // Referencia base
        }

        $clarity = getenv('PIELARMONIA_CLARITY_PROJECT_ID') ?: getenv('MICROSOFT_CLARITY_PROJECT_ID');
        if (!$clarity) {
            $clarity = '';
        }

        // Return only the exact whitelisted keys
        json_response([
            'sentry_dsn_frontend' => is_string($dsn) ? trim($dsn) : '',
            'ga_measurement_id' => is_string($ga) ? trim($ga) : '',
            'clarity_id' => is_string($clarity) ? trim($clarity) : '',
        ]);
    }
}
