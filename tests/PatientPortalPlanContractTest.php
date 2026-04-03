<?php
declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';
require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../controllers/PatientPortalController.php';

run_test('Treatment Plan Detail Contract', function () {
    $store = [
        'appointments' => [
            [
                'id' => 101,
                'patientCaseId' => 'case1',
                'patientId' => 'pat1',
                'phone' => '0991234567',
                'service' => 'control',
                'serviceName' => 'Control dermatológico',
                'doctorAssigned' => 'Dra Ana Rosero',
                'status' => 'completed',
                'date' => '2026-03-03',
                'time' => '09:00',
            ],
            [
                'id' => 102,
                'patientCaseId' => 'case1',
                'patientId' => 'pat1',
                'phone' => '0991234567',
                'service' => 'control',
                'serviceName' => 'Control dermatológico',
                'doctorAssigned' => 'Dra Ana Rosero',
                'status' => 'confirmed',
                'date' => '2099-03-20',
                'time' => '10:30',
            ],
        ],
        'clinical_history_drafts' => [
            [
                'sessionId' => 'session1',
                'caseId' => 'case1',
                'updatedAt' => '2026-03-01T10:00:00Z',
                'documents' => [
                    'carePlan' => [
                        'status' => 'active',
                        'diagnosis' => 'Test Diagnosis',
                        'followUpFrequency' => '1 mes',
                        'generatedAt' => '2026-03-01T10:05:00Z',
                        'treatments' => "Completar 4 sesiones\nAplicar tratamiento tópico nocturno",
                        'goals' => "Usar protector solar diario\nEnviar foto antes del próximo control",
                        'worseningInstructions' => 'Escribir al equipo clínico si empeora la lesión.',
                    ]
                ]
            ],
        ],
        'prescriptions' => [
            'rx1' => [
                'id' => 'rx1',
                'caseId' => 'case1',
                'issued_at' => '2026-03-02T08:00:00Z',
                'medications' => [[
                    'medication' => 'Doxiciclina 100 mg',
                    'dose' => '1 cápsula',
                    'frequency' => 'cada 12 horas',
                    'duration' => '14 días',
                    'instructions' => 'Tomar después del desayuno y la cena.',
                ]],
            ],
        ],
    ];
    $snapshot = [
        'patientId' => 'pat1',
        'patientCaseId' => 'case1',
        'phone' => '0991234567',
    ];
    $patient = [
        'id' => 'pat1',
        'name' => 'Lucia Portal',
        'phone' => '0991234567',
    ];
    $nextAppointment = $store['appointments'][1];

    $result = PatientPortalController::buildTreatmentPlanDetail($store, $snapshot, $patient, $nextAppointment);

    assert_true($result !== null, 'Plan must not be null');
    assert_array_has_key('status', $result);
    assert_array_has_key('diagnosis', $result);
    assert_array_has_key('plannedSessions', $result);
    assert_array_has_key('timeline', $result);
    assert_array_has_key('tasks', $result);
    assert_array_has_key('medications', $result);
    assert_array_has_key('futureSessions', $result);
    assert_array_has_key('unscheduledSessions', $result);
    assert_array_has_key('nextSession', $result);
    assert_array_has_key('treatmentsText', $result);
    assert_array_has_key('goalsText', $result);
    assert_array_has_key('worseningInstructions', $result);
    assert_equals('active', $result['status']);
    assert_equals('Test Diagnosis', $result['diagnosis']);
    assert_equals('1 mes', $result['followUpFrequency']);
    assert_equals(4, $result['plannedSessions']);
    assert_equals(1, $result['completedSessions']);
    assert_equals(2, $result['scheduledSessions']);
    assert_equals(1, $result['futureSessions']);
    assert_equals(2, $result['unscheduledSessions']);
    assert_equals('1 de 4 sesiones', $result['progressLabel']);
    assert_equals(4, $result['timelineCount']);
    assert_equals('4 hitos del plan', $result['timelineLabel']);
    assert_equals('2 sesiones ya definidas', $result['scheduledSessionsLabel']);
    assert_equals('2 sesiones pendientes por agendar', $result['unscheduledSessionsLabel']);
    assert_equals('Completar 4 sesiones' . "\n" . 'Aplicar tratamiento tópico nocturno', $result['treatmentsText']);
    assert_equals('Usar protector solar diario' . "\n" . 'Enviar foto antes del próximo control', $result['goalsText']);
    assert_true(trim((string) $result['worseningInstructions']) !== '', 'worseningInstructions no debe salir vacío');
    assert_equals('Doxiciclina 100 mg', $result['medications'][0]['medication']);
    assert_true(is_array($result['nextSession']), 'nextSession debe venir resumida como array');
    assert_equals('Control dermatológico', $result['nextSession']['serviceName']);
    assert_equals('confirmed', $result['nextSession']['status']);
    $taskLabels = array_map(
        static fn(array $task): string => trim((string) ($task['label'] ?? '')),
        $result['tasks']
    );
    assert_contains('Aplicar tratamiento tópico nocturno', implode(' | ', $taskLabels));
    assert_contains('Enviar foto antes del próximo control.', implode(' | ', $taskLabels));
    assert_equals('completed', $result['timeline'][0]['status']);
    assert_equals('scheduled', $result['timeline'][1]['status']);
    assert_equals('pending', $result['timeline'][2]['status']);
});

print_test_summary();
