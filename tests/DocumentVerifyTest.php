<?php
declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';
define('TESTING_ENV', true);

require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../lib/DocumentVerificationService.php';
require_once __DIR__ . '/../controllers/PatientPortalController.php';
require_once __DIR__ . '/../controllers/PatientPortalDocumentController.php';

run_test('Document Verify Public Endpoint', function () {
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $token = DocumentVerificationService::tokenForDocument('prescription', 'rx1');
    $_GET['token'] = $token;

    $store = [
        'prescriptions' => [
            'rx1' => [
                'id' => 'rx1',
                'caseId' => 'case1',
                'issuedAt' => '2026-03-01T10:00:00Z',
                'status' => 'available',
                'items' => [['medication' => 'Test Med']]
            ]
        ],
        'patient_cases' => [
            'case1' => [
                'id' => 'case1',
                'patientId' => 'pat1',
            ]
        ],
        'patients' => [
            'pat1' => ['id' => 'pat1', 'name' => 'El Paciente']
        ]
    ];

    $context = ['store' => $store];
    
    try {
        PatientPortalDocumentController::documentVerify($context);
        assert_true(false, 'Should have thrown TestingExitException');
    } catch (TestingExitException $e) {
        $payload = $e->payload;
        assert_true($payload['ok'] ?? false, 'Should be OK');
        assert_true($payload['data']['valid'] ?? false, 'Should be valid');
        assert_equals('rx1', $payload['data']['document']['documentId'] ?? '');
    }
});

print_test_summary();
