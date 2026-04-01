<?php

declare(strict_types=1);

class MonitoringConfigController
{
    public static function monitoringConfig(array $context): void
    {
        json_response(get_monitoring_config());
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
