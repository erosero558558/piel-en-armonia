<?php
declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';
require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../controllers/PatientPortalController.php';
require_once __DIR__ . '/../controllers/PatientPortalDocumentController.php';

run_test('Patient Portal History Contract', function () {
    $now = local_date('c');
    $store = [
        'appointments' => [
            [
                'id' => 101,
                'patientCaseId' => 'case1',
                'patientEmail' => 'pat@example.com',
                'phone' => '+593991234567',
                'status' => 'handled',
                'date' => '2026-03-01',
                'time' => '10:00',
            ],
            [
                'id' => 102,
                'patientCaseId' => 'case2',
                'patientEmail' => 'pat@example.com',
                'phone' => '+593991234567',
                'status' => 'handled',
                'date' => '2026-03-02',
                'time' => '11:00',
            ],
            [
                'id' => 103,
                'patientCaseId' => 'case3',
                'patientEmail' => 'pat@example.com',
                'phone' => '+593991234567',
                'status' => 'handled',
                'date' => '2026-03-03',
                'time' => '12:00',
            ]
        ],
        'clinical_history_drafts' => [],
        'prescriptions' => [
            [
                'id' => 'rx1',
                'caseId' => 'case1',
                'status' => 'available',
                'issuedAt' => '2026-03-01T10:30:00Z',
                'items' => [
                    ['medication' => 'Retinol 0.05%']
                ]
            ],
            [
                'id' => 'rx2',
                'caseId' => 'case2',
                'status' => 'available',
                'issuedAt' => '2026-03-02T11:30:00Z'
            ],
            [
                'id' => 'rx3',
                'caseId' => 'case3',
                'status' => 'available',
                'issuedAt' => '2026-03-03T12:30:00Z'
            ]
        ],
        'patient_cases' => [
            ['id' => 'case1', 'summary' => ['serviceName' => 'Clinical Diagnosis for Case 1']],
            ['id' => 'case2', 'summary' => ['serviceName' => 'Clinical Diagnosis for Case 2']],
            ['id' => 'case3', 'summary' => ['serviceName' => 'Clinical Diagnosis for Case 3']],
        ]
    ];
    $snapshot = [
        'patientCaseId' => 'case1',
        'email' => 'pat@example.com',
        'phone' => '+593991234567',
        'patient_cases' => [
            'case1' => ['id' => 'case1'],
            'case2' => ['id' => 'case2'],
            'case3' => ['id' => 'case3'],
        ]
    ];
    $patient = ['id' => 'pat1', 'name' => 'John Doe'];
    
    $consultations = PatientPortalController::buildPortalHistory($store, $snapshot, $patient);
    
    // Validate returned history output
    assert_true(is_array($consultations), 'Must return array of consultations');
    
    // There are 3 appointments, so there should be 3 consultations
    assert_equals(3, count($consultations), 'Must return 3 consultations');
    
    // Verify first one (newest timestamp / case3)
    // sort order should be descending by timestamp (we should verify the order but here just verifying content)
    $hasCase1 = false;
    foreach ($consultations as $consultation) {
        if ($consultation['caseId'] === 'case1') {
            $hasCase1 = true;
            // Verify diagnosis/serviceName sin fallback
            assert_equals('Clinical Diagnosis for Case 1', $consultation['serviceName']);
            
            // Verify prescription from server was mapped
            $prescription = $consultation['documents']['prescription'] ?? [];
            assert_true(!empty($prescription['documentId']));
            assert_equals('rx1', $prescription['documentId']);
        }
    }
    
    assert_true($hasCase1, 'Case1 consultation must exist');
});

print_test_summary();
