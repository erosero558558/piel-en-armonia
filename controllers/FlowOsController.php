<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/flow/FlowOsMetricsService.php';


require_once __DIR__ . '/../lib/FlowOsJourney.php';
require_once __DIR__ . '/../lib/PatientCaseService.php';

final class FlowOsController
{
    public static function manifest(...$args)
    {
        return FlowOsMetricsService::manifest(...$args);
    }

    public static function journeyPreview(...$args)
    {
        return FlowOsMetricsService::journeyPreview(...$args);
    }

    public static function toBool(...$args)
    {
        return FlowOsMetricsService::toBool(...$args);
    }

    public static function revenueDashboard(...$args)
    {
        return FlowOsMetricsService::revenueDashboard(...$args);
    }

    public static function b2bReferralProgram(...$args)
    {
        return FlowOsMetricsService::b2bReferralProgram(...$args);
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:flow-os-manifest':
                self::manifest($context);
                return;
            case 'GET:flow-os-journey-preview':
                self::journeyPreview($context);
                return;
            case 'GET:flow-os-revenue':
                self::revenueDashboard($context);
                return;
            case 'GET:flow-os-b2b-referral':
                self::b2bReferralProgram($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'manifest':
                            self::manifest($context);
                            return;
                        case 'journeyPreview':
                            self::journeyPreview($context);
                            return;
                        case 'revenueDashboard':
                            self::revenueDashboard($context);
                            return;
                        case 'b2bReferralProgram':
                            self::b2bReferralProgram($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
