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
    leadops_assert_true(
        trim((string) ($enriched['leadOps']['scoreSummary'] ?? '')) !== '',
        'Scored callback should expose a short score summary'
    );
    leadops_assert_true(
        is_array($enriched['leadOps']['scoreFactors'] ?? null) && count($enriched['leadOps']['scoreFactors']) >= 1,
        'Scored callback should expose visible score factors'
    );

    $normalized = LeadOpsService::normalizeLeadOps([
        'aiStatus' => 'weird_status',
        'aiObjective' => 'bad objective',
        'outcome' => 'invalid-outcome',
        'reasonCodes' => ['ok', '', 'ok', '<b>x</b>'],
        'scoreSummary' => '<b>Urgente</b>',
        'scoreFactors' => ['Urgencia clinica', '', 'Urgencia clinica'],
    ]);
    leadops_assert_equals('idle', $normalized['aiStatus'], 'Invalid aiStatus should fallback to idle');
    leadops_assert_equals('', $normalized['aiObjective'], 'Invalid aiObjective should be dropped');
    leadops_assert_equals('', $normalized['outcome'], 'Invalid outcome should be dropped');
    leadops_assert_equals(
        ['ok', '&lt;b&gt;x&lt;/b&gt;'],
        $normalized['reasonCodes'],
        'Reason codes should be sanitized and deduped'
    );
    leadops_assert_equals(
        '&lt;b&gt;Urgente&lt;/b&gt;',
        $normalized['scoreSummary'],
        'Score summary should be sanitized'
    );
    leadops_assert_equals(
        ['Urgencia clinica'],
        $normalized['scoreFactors'],
        'Score factors should be sanitized and deduped'
    );
    leadops_assert_equals('unknown', $normalized['source'], 'Missing source should normalize to unknown');
    leadops_assert_equals('unknown', $normalized['campaign'], 'Missing campaign should normalize to unknown');
    leadops_assert_equals('unknown', $normalized['surface'], 'Missing surface should normalize to unknown');
    leadops_assert_equals('unknown', $normalized['service_intent'], 'Missing service intent should normalize to unknown');

    $normalizedWhatsapp = LeadOpsService::normalizeLeadOps([
        'whatsappTemplateKey' => 'rebooking_slot',
        'whatsappMessageDraft' => '<b>Hola</b> se abrio un cupo',
        'whatsappLastPreparedAt' => '2026-03-31T15:45:00-05:00',
        'whatsappLastOpenedAt' => 'bad timestamp',
    ]);
    leadops_assert_equals(
        'rebooking_slot',
        $normalizedWhatsapp['whatsappTemplateKey'],
        'WhatsApp template key should be preserved when valid'
    );
    leadops_assert_equals(
        '&lt;b&gt;Hola&lt;/b&gt; se abrio un cupo',
        $normalizedWhatsapp['whatsappMessageDraft'],
        'WhatsApp message draft should be sanitized'
    );
    leadops_assert_equals(
        '2026-03-31T15:45:00-05:00',
        $normalizedWhatsapp['whatsappLastPreparedAt'],
        'WhatsApp prepared timestamp should normalize valid ISO strings'
    );
    leadops_assert_equals(
        '',
        $normalizedWhatsapp['whatsappLastOpenedAt'],
        'Invalid WhatsApp opened timestamp should be dropped'
    );

    $callbackWithContext = normalize_callback([
        'id' => 202,
        'telefono' => '+593 98 111 2222',
        'preferencia' => 'Seguimiento de preconsulta',
        'fecha' => gmdate('c', $createdAt + 120),
        'status' => 'pending',
        'patientCaseId' => 'pc_pre_1',
        'patientId' => 'pt_pre_1',
        'leadOps' => [],
    ]);
    $contextStore = [
        'callbacks' => [],
        'patient_cases' => [
            [
                'id' => 'pc_pre_1',
                'patientId' => 'pt_pre_1',
                'latestActivityAt' => gmdate('c', $createdAt + 240),
                'summary' => [
                    'contactPhone' => '+593981112222',
                    'source' => 'public_preconsultation',
                    'campaign' => 'campana_acne_marzo',
                    'surface' => 'preconsulta_publica',
                    'service_intent' => 'preconsulta_digital',
                    'entrySurface' => 'preconsulta_publica',
                    'serviceLine' => 'preconsulta_digital',
                ],
            ],
        ],
        'appointments' => [
            [
                'id' => 303,
                'patientCaseId' => 'pc_pre_1',
                'patientId' => 'pt_pre_1',
                'phone' => '+593981112222',
                'service' => 'consulta',
                'source' => 'booking',
                'campaign' => 'remarketing_q2',
                'surface' => 'booking_form',
                'service_intent' => 'consulta',
                'dateBooked' => gmdate('c', $createdAt + 360),
            ],
        ],
    ];
    $contextEnriched = LeadOpsService::enrichCallback($callbackWithContext, $contextStore, $funnelMetrics);
    leadops_assert_equals('public_preconsultation', $contextEnriched['source'], 'Callback should inherit source from linked patient case');
    leadops_assert_equals('campana_acne_marzo', $contextEnriched['campaign'], 'Callback should inherit campaign from linked patient case');
    leadops_assert_equals('preconsulta_publica', $contextEnriched['surface'], 'Callback should inherit surface from linked patient case');
    leadops_assert_equals('preconsulta_digital', $contextEnriched['service_intent'], 'Callback should inherit service intent from linked patient case');
    leadops_assert_equals('public_preconsultation', $contextEnriched['leadOps']['source'], 'Lead ops should persist inherited source');
    leadops_assert_equals('campana_acne_marzo', $contextEnriched['leadOps']['campaign'], 'Lead ops should persist inherited campaign');
    leadops_assert_equals('preconsulta_publica', $contextEnriched['leadOps']['surface'], 'Lead ops should persist inherited surface');
    leadops_assert_equals('preconsulta_digital', $contextEnriched['leadOps']['service_intent'], 'Lead ops should persist inherited service intent');

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
            'whatsappTemplateKey' => 'rebooking_slot',
            'whatsappMessageDraft' => 'Hola, te compartimos el slot disponible.',
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
    leadops_assert_equals(
        'rebooking_slot',
        $contactedLeadOps['whatsappTemplateKey'],
        'Lead ops merge should keep the selected WhatsApp template'
    );
    leadops_assert_equals(
        'Hola, te compartimos el slot disponible.',
        $contactedLeadOps['whatsappMessageDraft'],
        'Lead ops merge should keep the WhatsApp draft'
    );

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
