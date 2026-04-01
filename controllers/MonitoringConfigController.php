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
            'ok' => true,
            'sentry_dsn_frontend' => is_string($dsn) ? trim($dsn) : '',
            'ga_measurement_id' => is_string($ga) ? trim($ga) : '',
            'clarity_id' => is_string($clarity) ? trim($clarity) : '',
        ]);
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:monitoring-config':
                self::monitoringConfig($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'monitoringConfig':
                            self::monitoringConfig($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
