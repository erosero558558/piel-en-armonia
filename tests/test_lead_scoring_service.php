<?php

declare(strict_types=1);

require_once __DIR__ . '/../api-lib.php';

function lead_score_assert($condition, string $message): void
{
    if ($condition) {
        echo "PASS: {$message}\n";
        return;
    }

    echo "FAIL: {$message}\n";
    exit(1);
}

function lead_score_assert_same($expected, $actual, string $message): void
{
    if ($expected === $actual) {
        echo "PASS: {$message}\n";
        return;
    }

    echo "FAIL: {$message}\n";
    echo 'Expected: ' . json_encode($expected, JSON_UNESCAPED_UNICODE) . "\n";
    echo 'Actual:   ' . json_encode($actual, JSON_UNESCAPED_UNICODE) . "\n";
    exit(1);
}

echo "Running LeadScoringService tests...\n";

$store = [
    'appointments' => [
        [
            'id' => 501,
            'phone' => '+593991110001',
            'patientId' => 'pt-high',
            'patientCaseId' => 'pc-high',
            'status' => 'no_show',
            'dateBooked' => gmdate('c', time() - (30 * 24 * 60 * 60)),
        ],
        [
            'id' => 502,
            'phone' => '+593991110001',
            'patientId' => 'pt-high',
            'patientCaseId' => 'pc-high',
            'status' => 'completed',
            'dateBooked' => gmdate('c', time() - (20 * 24 * 60 * 60)),
        ],
    ],
];

$premiumLead = LeadScoringService::scoreCallback([
    'telefono' => '+593991110001',
    'preferencia' => 'Necesito laser urgente hoy por WhatsApp',
    'fecha' => gmdate('c', time() - (4 * 60 * 60)),
    'status' => 'pending',
    'patientId' => 'pt-high',
    'patientCaseId' => 'pc-high',
    'source' => 'whatsapp_openclaw',
    'surface' => 'whatsapp_openclaw',
    'service_intent' => 'laser',
], $store, [
    'ageMinutes' => 240,
    'serviceHints' => ['Láser Dermatológico'],
]);

lead_score_assert($premiumLead['score'] >= 60, 'Premium urgent WhatsApp lead should score high even with no-show penalty');
lead_score_assert_same('hot', $premiumLead['priorityBand'], 'Premium urgent WhatsApp lead should be hot');
lead_score_assert_same(true, (bool) ($premiumLead['premiumService'] ?? false), 'Laser should be treated as premium');
lead_score_assert_same(1, (int) ($premiumLead['noShowCount'] ?? 0), 'Service should detect prior no-show history');
lead_score_assert(in_array('risk_no_show_history', $premiumLead['reasonCodes'] ?? [], true), 'No-show history should affect reason codes');
lead_score_assert(in_array('Servicio premium', $premiumLead['factorLabels'] ?? [], true), 'Factor labels should include premium service');

$standardLead = LeadScoringService::scoreCallback([
    'telefono' => '+593991110009',
    'preferencia' => 'Quiero informacion para consulta',
    'fecha' => gmdate('c', time() - (15 * 60)),
    'status' => 'pending',
    'source' => 'booking',
    'surface' => 'booking_form',
    'service_intent' => 'consulta',
], ['appointments' => []], [
    'ageMinutes' => 15,
    'serviceHints' => ['Consulta Dermatológica'],
]);

lead_score_assert($standardLead['score'] < $premiumLead['score'], 'Standard lead should score below premium urgent lead');
lead_score_assert_same('cold', $standardLead['priorityBand'], 'Standard booking lead should remain cold without urgency or premium signals');
lead_score_assert_same(false, (bool) ($standardLead['premiumService'] ?? true), 'Consulta should not be premium');

echo "All LeadScoringService tests passed!\n";
