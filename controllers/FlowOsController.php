<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/FlowOsJourney.php';
require_once __DIR__ . '/../lib/PatientCaseService.php';

class FlowOsController
{
    public static function manifest(array $context): void
    {
        json_response([
            'ok' => true,
            'data' => flow_os_manifest(),
        ]);
    }

    public static function journeyPreview(array $context): void
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
}
