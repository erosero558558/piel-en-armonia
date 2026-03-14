<?php

declare(strict_types=1);

$tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'leadops-service-' . bin2hex(random_bytes(6));
$catalogPath = $tempDir . DIRECTORY_SEPARATOR . 'services.json';
mkdir($tempDir, 0777, true);

file_put_contents($catalogPath, json_encode([
    'version' => '2026.3',
    'timezone' => 'America/Guayaquil',
    'services' => [
        [
            'slug' => 'botox',
            'category' => 'aesthetic',
            'hero' => 'Botox medico',
            'summary' => 'Tratamiento de expresion',
            'indications' => ['arrugas', 'botox'],
            'cta' => [
                'service_hint' => 'rejuvenecimiento',
            ],
        ],
        [
            'slug' => 'acne-rosacea',
            'category' => 'clinical',
            'hero' => 'Acne y rosacea',
            'summary' => 'Control de brotes',
            'indications' => ['acne', 'rosacea'],
        ],
    ],
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

putenv('PIELARMONIA_DATA_DIR=' . $tempDir);
putenv('PIELARMONIA_SERVICES_CATALOG_FILE=' . $catalogPath);
putenv('PIELARMONIA_LEADOPS_MACHINE_TOKEN=test-machine-token');

if (!defined('TESTING_ENV')) {
    define('TESTING_ENV', true);
}

require_once __DIR__ . '/../api-lib.php';

function leadops_assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        echo "FAIL: {$message}\n";
        exit(1);
    }

    echo "PASS: {$message}\n";
}

function leadops_assert_equals($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        echo "FAIL: {$message}\n";
        echo 'Expected: ' . json_encode($expected, JSON_UNESCAPED_UNICODE) . "\n";
        echo 'Actual:   ' . json_encode($actual, JSON_UNESCAPED_UNICODE) . "\n";
        exit(1);
    }

    echo "PASS: {$message}\n";
}

function leadops_remove_directory(string $dir): void
{
    if (!is_dir($dir)) {
        return;
    }

    $entries = array_diff(scandir($dir) ?: [], ['.', '..']);
    foreach ($entries as $entry) {
        $path = $dir . DIRECTORY_SEPARATOR . $entry;
        if (is_dir($path)) {
            leadops_remove_directory($path);
        } else {
            @unlink($path);
        }
    }

    @rmdir($dir);
}

echo "Running lead ops service tests...\n";

try {
    $createdAt = time() - (4 * 60 * 60);
    $funnelMetrics = [
        'summary' => [
            'checkoutAbandon' => 2,
        ],
        'serviceFunnel' => [
            [
                'serviceSlug' => 'botox',
                'detailViews' => 24,
                'bookingIntent' => 8,
                'checkoutStarts' => 5,
                'bookingConfirmed' => 3,
                'detailToConfirmedPct' => 18.0,
            ],
        ],
    ];

    $callback = normalize_callback([
        'id' => 101,
        'telefono' => '+593 98 111 2222',
        'preferencia' => 'Quiero botox hoy, urgente y con precio',
        'fecha' => gmdate('c', $createdAt),
        'status' => 'pending',
    ]);

    $enriched = LeadOpsService::enrichCallback($callback, ['callbacks' => []], $funnelMetrics);
    leadops_assert_equals('hot', $enriched['leadOps']['priorityBand'], 'Urgent callback should be hot');
    leadops_assert_true(
        (int) ($enriched['leadOps']['heuristicScore'] ?? 0) >= 70,
        'Urgent callback should receive a strong heuristic score'
    );
    leadops_assert_equals(
        'Rejuvenecimiento',
        $enriched['leadOps']['serviceHints'][0] ?? '',
        'Service hint should reuse service priority signal'
    );
    leadops_assert_equals(
        'Responder precio y cerrar cita en el mismo contacto',
        $enriched['leadOps']['nextAction'],
        'Price intent should force closing next action'
    );

    $normalized = LeadOpsService::normalizeLeadOps([
        'aiStatus' => 'weird_status',
        'aiObjective' => 'bad objective',
        'outcome' => 'invalid-outcome',
        'reasonCodes' => ['ok', '', 'ok', '<b>x</b>'],
    ]);
    leadops_assert_equals('idle', $normalized['aiStatus'], 'Invalid aiStatus should fallback to idle');
    leadops_assert_equals('', $normalized['aiObjective'], 'Invalid aiObjective should be dropped');
    leadops_assert_equals('', $normalized['outcome'], 'Invalid outcome should be dropped');
    leadops_assert_equals(
        ['ok', '&lt;b&gt;x&lt;/b&gt;'],
        $normalized['reasonCodes'],
        'Reason codes should be sanitized and deduped'
    );

    $requestedLeadOps = LeadOpsService::requestLeadAi($enriched, 'whatsapp_draft', ['callbacks' => []], $funnelMetrics);
    $queuePayload = LeadOpsService::buildQueuePayload([
        array_merge($enriched, ['leadOps' => $requestedLeadOps]),
    ], ['callbacks' => []], $funnelMetrics);

    leadops_assert_equals(1, count($queuePayload['items'] ?? []), 'Requested callback should appear in queue');
    $queuedItem = $queuePayload['items'][0];
    leadops_assert_true(
        !str_contains((string) ($queuedItem['telefonoMasked'] ?? ''), '981112222'),
        'Queue payload should never expose the raw phone'
    );
    leadops_assert_true(
        str_ends_with((string) ($queuedItem['telefonoMasked'] ?? ''), '22'),
        'Masked phone should keep only the final digits'
    );

    $contactedLeadOps = LeadOpsService::mergeLeadOps(
        array_merge($enriched, ['status' => 'contacted']),
        [
            'aiStatus' => 'accepted',
            'aiObjective' => 'whatsapp_draft',
            'contactedAt' => gmdate('c', $createdAt + 3600),
            'outcome' => 'cita_cerrada',
        ],
        ['callbacks' => []],
        $funnelMetrics
    );
    $commercialStore = [
        'callbacks' => [
            array_merge($enriched, [
                'status' => 'contacted',
                'leadOps' => $contactedLeadOps,
            ]),
        ],
    ];
    $meta = LeadOpsService::buildMeta($commercialStore['callbacks'], $commercialStore, $funnelMetrics);
    $health = LeadOpsService::buildHealthSnapshot($commercialStore);
    $metricsText = LeadOpsService::renderPrometheusMetrics($commercialStore);

    leadops_assert_equals(1, (int) ($meta['aiAcceptedCount'] ?? 0), 'Meta should track accepted IA suggestions');
    leadops_assert_equals(1, (int) ($meta['closedWonCount'] ?? 0), 'Meta should track closed-won callbacks');
    leadops_assert_equals(1, (int) ($meta['firstContact']['samples'] ?? 0), 'Meta should track first-contact samples');
    leadops_assert_equals(60.0, (float) ($meta['firstContact']['avgMinutes'] ?? 0.0), 'Meta should expose average first-contact minutes');
    leadops_assert_equals(60.0, (float) ($meta['firstContact']['p95Minutes'] ?? 0.0), 'Meta should expose p95 first-contact minutes');
    leadops_assert_equals(100.0, (float) ($meta['rates']['aiAcceptancePct'] ?? 0.0), 'Meta should expose IA acceptance rate');
    leadops_assert_equals(100.0, (float) ($meta['rates']['closedFromContactedPct'] ?? 0.0), 'Meta should expose close rate from contacted leads');

    leadops_assert_equals(1, (int) ($health['contactedCount'] ?? 0), 'Health snapshot should expose contacted count');
    leadops_assert_equals(1, (int) ($health['aiAccepted'] ?? 0), 'Health snapshot should expose accepted IA count');
    leadops_assert_equals(1, (int) ($health['outcomeClosedWon'] ?? 0), 'Health snapshot should expose closed-won count');
    leadops_assert_equals(60.0, (float) ($health['firstContactAvgMinutes'] ?? 0.0), 'Health snapshot should expose first-contact average');

    leadops_assert_true(
        str_contains($metricsText, 'pielarmonia_leadops_first_contact_avg_minutes 60'),
        'Prometheus export should expose first-contact average gauge'
    );
    leadops_assert_true(
        str_contains($metricsText, 'pielarmonia_leadops_close_from_contacted_rate_pct 100'),
        'Prometheus export should expose close rate from contacted leads gauge'
    );
} finally {
    putenv('PIELARMONIA_DATA_DIR');
    putenv('PIELARMONIA_SERVICES_CATALOG_FILE');
    putenv('PIELARMONIA_LEADOPS_MACHINE_TOKEN');
    if (function_exists('get_db_connection')) {
        get_db_connection(null, true);
    }
    leadops_remove_directory($tempDir);
}

echo "All lead ops service tests passed!\n";
