<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/FlowOsJourney.php';

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
        $queryStage = trim((string) ($_GET['stage'] ?? ''));
        $preview = flow_os_build_store_journey_preview(
            is_array($context['store'] ?? null) ? $context['store'] : [],
            [
                'stage' => $queryStage,
                'redFlagDetected' => self::toBool($_GET['redFlagDetected'] ?? null),
                'missingIdentity' => self::toBool($_GET['missingIdentity'] ?? null),
                'missedFollowup' => self::toBool($_GET['missedFollowup'] ?? null),
            ]
        );

        json_response([
            'ok' => true,
            'data' => [
                'episodeId' => trim((string) ($_GET['episodeId'] ?? 'demo-001')),
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
