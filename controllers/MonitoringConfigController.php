<?php

declare(strict_types=1);

class MonitoringConfigController
{
    /** @var list<string> */
    private const PUBLIC_MONITORING_KEYS = [
        'sentry_dsn_frontend',
        'ga_measurement_id',
        'clarity_id',
    ];

    public static function monitoringConfig(array $context): void
    {
        json_response(self::publicMonitoringConfig());
    }

    /** @return array{clarity_id:string,ga_measurement_id:string,sentry_dsn_frontend:string} */
    public static function publicMonitoringConfig(): array
    {
        $values = [
            'sentry_dsn_frontend' => self::readEnv([
                'PIELARMONIA_SENTRY_DSN_PUBLIC',
                'AURORADERM_SENTRY_DSN_PUBLIC',
                'AURORADERM_SENTRY_DSN_FRONTEND',
            ]),
            'ga_measurement_id' => self::readEnv([
                'PIELARMONIA_GA_MEASUREMENT_ID',
                'AURORADERM_GA_MEASUREMENT_ID',
            ], 'G-2DWZ5PJ4MC'),
            'clarity_id' => self::readEnv([
                'PIELARMONIA_CLARITY_PROJECT_ID',
                'MICROSOFT_CLARITY_PROJECT_ID',
            ]),
        ];

        $public = [];
        foreach (self::PUBLIC_MONITORING_KEYS as $key) {
            $public[$key] = (string) ($values[$key] ?? '');
        }

        /** @var array{clarity_id:string,ga_measurement_id:string,sentry_dsn_frontend:string} $public */
        return $public;
    }

    private static function readEnv(array $keys, string $default = ''): string
    {
        foreach ($keys as $key) {
            $value = getenv($key);
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return $default;
    }
}
