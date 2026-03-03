<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';
require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/telemedicine/LegacyTelemedicineBridge.php';

$tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-telemed-script-' . uniqid('', true);
@mkdir($tempDir, 0777, true);
putenv('PIELARMONIA_DATA_DIR=' . $tempDir);

run_test('Telemedicine draft bridge persists intake for video service', function () {
    $store = read_store();
    $bridge = new LegacyTelemedicineBridge();
    $result = $bridge->createPaymentIntentDraft($store, [
        'service' => 'video',
        'doctor' => 'rosero',
        'date' => date('Y-m-d', strtotime('+7 days')),
        'time' => '10:00',
        'name' => 'Paciente Telemed',
        'email' => 'telemed@example.com',
        'phone' => '0999999999',
        'reason' => 'Consulta por acne persistente con lesiones nuevas.',
        'affectedArea' => 'rostro',
        'evolutionTime' => '2 semanas',
        'privacyConsent' => true,
    ], ['id' => 'pi_mock_telemed', 'status' => 'requires_confirmation']);

    assert_true(is_array($result['intake']));
    assert_equals('secure_video', $result['intake']['channel']);
    assert_equals('awaiting_payment', $result['intake']['status']);
    assert_equals(1, count($result['store']['telemedicine_intakes']));
});

run_test('Telemedicine suitability flags incomplete video case for review', function () {
    $result = TelemedicineSuitabilityEvaluator::evaluate([
        'reason' => 'Acne',
        'affectedArea' => '',
        'evolutionTime' => '',
        'privacyConsent' => true,
        'casePhotoCount' => 0,
    ], 'secure_video');

    assert_equals('review_required', $result['suitability']);
    assert_true($result['requiresHumanReview']);
});

print_test_summary();

putenv('PIELARMONIA_DATA_DIR');
