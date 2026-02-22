<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/features.php';
require_once __DIR__ . '/../lib/http.php';
require_once __DIR__ . '/../lib/audit.php';

class FeaturesController
{
    public static function index(array $context): void
    {
        json_response([
            'ok' => true,
            'data' => FeatureFlags::getRawConfig()
        ]);
    }

    public static function update(array $context): void
    {
        $payload = require_json_body();

        if (!isset($payload['flag']) || !is_string($payload['flag'])) {
            json_response(['ok' => false, 'error' => 'Flag name is required'], 400);
        }

        $flag = $payload['flag'];
        $config = [];

        if (isset($payload['enabled'])) {
            $config['enabled'] = (bool)$payload['enabled'];
        }

        if (isset($payload['percentage'])) {
            $percentage = (int)$payload['percentage'];
            if ($percentage < 0 || $percentage > 100) {
                 json_response(['ok' => false, 'error' => 'Percentage must be between 0 and 100'], 400);
            }
            $config['percentage'] = $percentage;
        }

        FeatureFlags::updateFlag($flag, $config);

        audit_log_event('feature_flag_updated', [
            'flag' => $flag,
            'config' => $config
        ]);

        json_response([
            'ok' => true,
            'data' => FeatureFlags::getRawConfig()
        ]);
    }
}
