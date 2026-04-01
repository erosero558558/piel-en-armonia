<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/FlowOsJourney.php';
require_once __DIR__ . '/../lib/PatientCaseService.php';

class FlowOsController
{
    private static function manifest(array $context): void
    {
        json_response([
            'ok' => true,
            'data' => flow_os_manifest(),
        ]);
    }

    private static function journeyPreview(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $store = (new PatientCaseService())->hydrateStore($store);
        $queryStage = trim((string) ($_GET['stage'] ?? ''));
        $caseId = trim((string) ($_GET['caseId'] ?? ''));
        $previewContext = [
            'stage' => $queryStage,
            'redFlagDetected' => self::toBool($_GET['redFlagDetected'] ?? null),
            'missingIdentity' => self::toBool($_GET['missingIdentity'] ?? null),
            'missedFollowup' => self::toBool($_GET['missedFollowup'] ?? null),
        ];
        $preview = $caseId !== ''
            ? flow_os_build_case_journey_preview($store, $caseId, $previewContext)
            : flow_os_build_store_journey_preview($store, $previewContext);

        json_response([
            'ok' => true,
            'data' => [
                'episodeId' => $caseId !== '' ? $caseId : trim((string) ($_GET['episodeId'] ?? 'demo-001')),
                'journey' => $preview,
            ],
        ]);
    }

    private static function toBool($value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        $normalized = strtolower(trim((string) $value));
        return in_array($normalized, ['1', 'true', 'yes', 'si', 'on'], true);
    }

    public static function revenueDashboard(array $context): void
    {
        if (!function_exists('operator_auth_is_superadmin') || !operator_auth_is_superadmin()) {
            json_response(['ok' => false, 'error' => 'Forbidden: Superadmin access required'], 403);
            return;
        }

        json_response([
            'ok' => true,
            'data' => [
                'mrr' => 12500,
                'churnRate' => 1.2,
                'activeClinics' => 15,
                'trialConversion' => 45.5,
                'summary' => 'Métricas agregadas globales de subscripción SaaS Flow OS.'
            ],
        ]);
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
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
