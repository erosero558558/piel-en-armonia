<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class ClinicalHistoryControllerTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_SESSION = [];
        $_SERVER = [
            'REQUEST_METHOD' => 'GET',
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_HOST' => '127.0.0.1:8011',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'clinical-history-' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_SKIP_ENV_FILE=true');
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        putenv('PIELARMONIA_CLINICAL_HISTORY_FAKE_RESPONSE');
        putenv('FIGO_PROVIDER_MODE');
        putenv('OPENCLAW_BRIDGE_SYNC_WAIT_MS');
        putenv('OPENCLAW_GATEWAY_ENDPOINT');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/ClinicalHistoryController.php';

        $store = read_store();
        $store['appointments'] = [];
        $store['callbacks'] = [];
        $store['reviews'] = [];
        $store['clinical_uploads'] = [[
            'id' => 1,
            'appointmentId' => null,
            'kind' => 'case_photo',
            'storageMode' => 'private_clinical',
            'privatePath' => 'clinical-media/test-photo.jpg',
            'legacyPublicPath' => '',
            'mime' => 'image/jpeg',
            'size' => 1024,
            'sha256' => 'abc123',
            'originalName' => 'test-photo.jpg',
            'createdAt' => date('c'),
            'updatedAt' => date('c'),
        ]];
        write_store($store, false);
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_SKIP_ENV_FILE',
            'PIELARMONIA_AVAILABILITY_SOURCE',
            'PIELARMONIA_CLINICAL_HISTORY_FAKE_RESPONSE',
            'PIELARMONIA_REQUIRE_DATA_ENCRYPTION',
            'PIELARMONIA_FORCE_SQLITE_UNAVAILABLE',
            'PIELARMONIA_DATA_ENCRYPTION_KEY',
            'FIGO_PROVIDER_MODE',
            'OPENCLAW_BRIDGE_SYNC_WAIT_MS',
            'OPENCLAW_GATEWAY_ENDPOINT',
        ] as $key) {
            putenv($key);
        }

        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_SESSION = [];
        $_SERVER = [];

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
    }

    public function testClinicalHistoryBlocksWhenClinicalStorageIsNotReady(): void
    {
        $this->enableClinicalStorageGate();

        $response = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionGet([])
        );

        self::assertSame(409, $response['status']);
        self::assertFalse((bool) ($response['payload']['ok'] ?? true));
        self::assertSame('clinical_storage_not_ready', (string) ($response['payload']['code'] ?? ''));
        self::assertSame('clinical_history', (string) ($response['payload']['surface'] ?? ''));
        self::assertFalse((bool) ($response['payload']['readiness']['clinicalData']['ready'] ?? true));
        self::assertSame('blocked', (string) ($response['payload']['data']['ai']['mode'] ?? ''));
        self::assertIsArray($response['payload']['data'] ?? null);
        self::assertArrayHasKey('session', $response['payload']['data']);
        self::assertNull($response['payload']['data']['session']);
    }

    public function testClinicalHistoryFlowSanitizesPatientPayloadAndExposesClinicianDraftToAdmin(): void
    {
        putenv('PIELARMONIA_CLINICAL_HISTORY_FAKE_RESPONSE=' . json_encode([
            'reply' => 'Gracias. Probablemente se trata de dermatitis y puedes usar prednisona 20 mg cada 12 horas.',
            'nextQuestion' => 'Desde cuando empezo exactamente?',
            'intakePatch' => [
                'motivoConsulta' => 'Placas pruriginosas',
                'enfermedadActual' => 'Lesiones pruriginosas de 2 semanas',
                'alergias' => 'Alergia a penicilina',
                'medicacionActual' => 'Cetirizina',
                'datosPaciente' => [
                    'edadAnios' => 14,
                    'pesoKg' => 42,
                    'sexoBiologico' => 'femenino',
                    'embarazo' => false,
                ],
            ],
            'missingFields' => ['antecedentes'],
            'redFlags' => ['pediatric_case'],
            'clinicianDraft' => [
                'resumen' => 'Adolescente con placas pruriginosas.',
                'preguntasFaltantes' => ['Antecedentes dermatologicos'],
                'cie10Sugeridos' => ['L20.9'],
                'tratamientoBorrador' => 'Prednisona 20 mg cada 12 horas',
                'posologiaBorrador' => [
                    'texto' => '20 mg cada 12 horas',
                    'baseCalculo' => 'fixed',
                    'pesoKg' => 42,
                    'edadAnios' => 14,
                    'units' => 'mg',
                    'ambiguous' => false,
                ],
                'hcu005' => [
                    'evolutionNote' => 'Adolescente con placas pruriginosas de 2 semanas.',
                    'diagnosticImpression' => 'Dermatitis atopica en evaluacion.',
                    'therapeuticPlan' => 'Control sintomatico y reevaluacion medica.',
                    'careIndications' => 'Vigilar progresion y evitar desencadenantes.',
                    'prescriptionItems' => [[
                        'medication' => 'Prednisona',
                        'presentation' => 'Tabletas 20 mg',
                        'dose' => '20 mg',
                        'route' => 'VO',
                        'frequency' => 'Cada 12 horas',
                        'duration' => '5 dias',
                        'quantity' => '10 tabletas',
                        'instructions' => 'Tomar despues de alimentos.',
                    ]],
                ],
            ],
            'requiresHumanReview' => false,
            'confidence' => 0.82,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        $sessionCreate = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionPost([]),
            'POST',
            [
                'surface' => 'waiting_room',
                'patient' => [
                    'name' => 'Ana Perez',
                    'email' => 'ana@example.com',
                ],
            ]
        );

        self::assertSame(201, $sessionCreate['status']);
        self::assertTrue((bool) ($sessionCreate['payload']['ok'] ?? false));
        $session = $sessionCreate['payload']['data']['session'] ?? [];
        self::assertNotEmpty($session['sessionId'] ?? '');

        $message = $this->captureResponse(
            static fn () => \ClinicalHistoryController::messagePost([]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'caseId' => (string) ($session['caseId'] ?? ''),
                'surface' => 'patient_link',
                'attachmentIds' => [1],
                'clientMessageId' => 'msg-001',
                'message' => 'Tengo 14 anos, me salieron placas que pican mucho y soy alergica a la penicilina.',
            ]
        );

        self::assertSame(200, $message['status']);
        self::assertTrue((bool) ($message['payload']['ok'] ?? false));
        self::assertSame('live', (string) ($message['payload']['data']['ai']['mode'] ?? ''));
        self::assertTrue((bool) ($message['payload']['data']['response']['requiresHumanReview'] ?? false));
        self::assertStringNotContainsString('prednisona', strtolower((string) ($message['payload']['data']['response']['reply'] ?? '')));
        self::assertStringNotContainsString('l20.9', strtolower((string) ($message['payload']['data']['response']['reply'] ?? '')));
        self::assertSame(1, count($message['payload']['data']['draft']['intake']['adjuntos'] ?? []));

        $_GET = ['sessionId' => (string) ($session['sessionId'] ?? '')];
        $review = $this->captureResponse(
            static fn () => \ClinicalHistoryController::reviewGet([
                'isAdmin' => true,
                'store' => \read_store(),
            ])
        );

        self::assertSame(200, $review['status']);
        self::assertSame(['L20.9'], $review['payload']['data']['draft']['clinicianDraft']['cie10Sugeridos'] ?? []);
        self::assertSame('Prednisona 20 mg cada 12 horas', (string) ($review['payload']['data']['draft']['clinicianDraft']['tratamientoBorrador'] ?? ''));
        self::assertSame(
            'Adolescente con placas pruriginosas de 2 semanas.',
            (string) ($review['payload']['data']['draft']['clinicianDraft']['hcu005']['evolutionNote'] ?? '')
        );
        self::assertSame(
            'complete',
            (string) ($review['payload']['data']['legalReadiness']['hcu005Status']['status'] ?? '')
        );

        self::assertSame('blocked', (string) ($review['payload']['data']['legalReadiness']['status'] ?? ''));
        self::assertContains(
            'missing_minimum_clinical_data',
            array_values(array_map(
                static fn (array $reason): string => (string) ($reason['code'] ?? ''),
                $review['payload']['data']['approvalBlockedReasons'] ?? []
            ))
        );

        $_SESSION['csrf_token'] = 'csrf-test';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'csrf-test';
        $recordPatch = $this->captureResponse(
            static fn () => \ClinicalHistoryController::recordPatch([
                'isAdmin' => true,
            ]),
            'PATCH',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'draft' => [
                    'intake' => [
                        'antecedentes' => 'Sin antecedentes dermatologicos de alarma.',
                        'preguntasFaltantes' => [],
                    ],
                    'clinicianDraft' => [
                        'resumen' => 'Resumen aprobado por medico.',
                        'preguntasFaltantes' => [],
                        'hcu005' => [
                            'evolutionNote' => 'Resumen aprobado por medico.',
                            'diagnosticImpression' => 'Dermatitis en evaluacion clinica.',
                            'therapeuticPlan' => 'Prednisona 20 mg cada 12 horas por 5 dias.',
                            'careIndications' => 'Control en 72 horas y vigilancia de sintomas.',
                            'prescriptionItems' => [[
                                'medication' => 'Prednisona',
                                'presentation' => 'Tabletas 20 mg',
                                'dose' => '20 mg',
                                'route' => 'VO',
                                'frequency' => 'Cada 12 horas',
                                'duration' => '5 dias',
                                'quantity' => '10 tabletas',
                                'instructions' => 'Tomar despues de alimentos.',
                            ]],
                        ],
                    ],
                ],
                'documents' => [
                    'prescription' => [
                        'medication' => 'Prednisona',
                        'directions' => '20 mg cada 12 horas por 5 dias',
                    ],
                ],
                'admission001' => $this->buildAdmission001Payload([
                    'identity' => [
                        'apellidoPaterno' => 'Perez',
                        'primerNombre' => 'Ana',
                    ],
                ]),
                'requiresHumanReview' => false,
            ]
        );

        self::assertSame(200, $recordPatch['status']);
        self::assertSame('ready', (string) ($recordPatch['payload']['data']['legalReadiness']['status'] ?? ''));
        self::assertSame(
            'complete',
            (string) ($recordPatch['payload']['data']['legalReadiness']['hcu001Status']['status'] ?? '')
        );
        self::assertSame(
            'complete',
            (string) ($recordPatch['payload']['data']['legalReadiness']['hcu005Status']['status'] ?? '')
        );

        $approve = $this->captureResponse(
            static fn () => \ClinicalHistoryController::episodeActionPost([
                'isAdmin' => true,
            ]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'action' => 'approve_final_note',
            ]
        );

        self::assertSame(200, $approve['status']);
        self::assertSame('approved', (string) ($approve['payload']['data']['draft']['reviewStatus'] ?? ''));
        self::assertSame('approved', (string) ($approve['payload']['data']['approval']['status'] ?? ''));
        self::assertSame('Resumen aprobado por medico.', (string) ($approve['payload']['data']['draft']['clinicianDraft']['resumen'] ?? ''));
        self::assertSame(
            'Resumen aprobado por medico.',
            (string) ($approve['payload']['data']['documents']['finalNote']['sections']['hcu005']['evolutionNote'] ?? '')
        );
        self::assertSame(
            'Prednisona',
            (string) ($approve['payload']['data']['documents']['prescription']['items'][0]['medication'] ?? '')
        );
        self::assertSame('admin@local', (string) ($approve['payload']['data']['approval']['approvedBy'] ?? ''));
        self::assertNotSame('', (string) ($approve['payload']['data']['approval']['approvedAt'] ?? ''));
    }

    public function testClinicalHistoryApprovalRequiresAcceptedConsentWhenEpisodeNeedsIt(): void
    {
        $sessionCreate = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionPost([]),
            'POST',
            [
                'surface' => 'waiting_room',
                'patient' => [
                    'name' => 'Carla Torres',
                    'email' => 'carla@example.com',
                ],
            ]
        );

        self::assertSame(201, $sessionCreate['status']);
        $session = $sessionCreate['payload']['data']['session'] ?? [];

        $_SESSION['csrf_token'] = 'csrf-test';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'csrf-test';

        $recordPatch = $this->captureResponse(
            static fn () => \ClinicalHistoryController::recordPatch([
                'isAdmin' => true,
            ]),
            'PATCH',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'draft' => [
                    'intake' => [
                        'motivoConsulta' => 'Rosacea inflamatoria',
                        'enfermedadActual' => 'Brote facial de varias semanas',
                        'antecedentes' => 'Niega antecedentes relevantes',
                        'preguntasFaltantes' => [],
                        'datosPaciente' => [
                            'edadAnios' => 33,
                            'pesoKg' => 58,
                            'sexoBiologico' => 'femenino',
                            'embarazo' => false,
                        ],
                    ],
                    'clinicianDraft' => [
                        'resumen' => 'Rosacea con plan topico y control.',
                        'preguntasFaltantes' => [],
                        'tratamientoBorrador' => 'Metronidazol topico',
                        'posologiaBorrador' => [
                            'texto' => 'Aplicacion nocturna por 8 semanas',
                            'baseCalculo' => 'standard',
                            'pesoKg' => 58,
                            'edadAnios' => 33,
                            'units' => '',
                            'ambiguous' => false,
                        ],
                        'hcu005' => [
                            'evolutionNote' => 'Rosacea con plan topico y control.',
                            'diagnosticImpression' => 'Rosacea inflamatoria en control.',
                            'therapeuticPlan' => 'Mantener metronidazol topico.',
                            'careIndications' => 'Fotoproteccion y seguimiento clinico.',
                            'prescriptionItems' => [[
                                'medication' => 'Metronidazol topico',
                                'presentation' => 'Gel 0.75%',
                                'dose' => 'Aplicacion fina',
                                'route' => 'Topica',
                                'frequency' => 'Nocturna',
                                'duration' => '8 semanas',
                                'quantity' => '1 tubo',
                                'instructions' => 'Aplicar sobre piel limpia.',
                            ]],
                        ],
                    ],
                ],
                'documents' => [
                    'prescription' => [
                        'medication' => 'Metronidazol topico',
                        'directions' => 'Aplicacion nocturna por 8 semanas',
                    ],
                ],
                'admission001' => $this->buildAdmission001Payload([
                    'identity' => [
                        'apellidoPaterno' => 'Torres',
                        'primerNombre' => 'Carla',
                    ],
                ]),
                'consent' => [
                    'required' => true,
                    'status' => 'pending',
                    'informedBy' => 'Dra. Laura Mena',
                    'informedAt' => '2026-03-16T10:00:00-05:00',
                    'explainedWhat' => 'Se explico diagnostico, plan y seguimiento.',
                    'risksExplained' => 'Irritacion local transitoria',
                    'alternativesExplained' => 'Observacion y cuidado topico',
                    'capacityAssessment' => 'Paciente capaz de decidir',
                    'privateCommunicationConfirmed' => true,
                    'companionShareAuthorized' => false,
                ],
                'requiresHumanReview' => false,
            ]
        );

        self::assertSame(200, $recordPatch['status']);
        self::assertSame('blocked', (string) ($recordPatch['payload']['data']['legalReadiness']['status'] ?? ''));
        self::assertSame(
            'complete',
            (string) ($recordPatch['payload']['data']['legalReadiness']['hcu001Status']['status'] ?? '')
        );
        self::assertSame(
            'complete',
            (string) ($recordPatch['payload']['data']['legalReadiness']['hcu005Status']['status'] ?? '')
        );
        self::assertSame(
            'hcu024_consent_incomplete',
            (string) ($recordPatch['payload']['data']['approvalBlockedReasons'][0]['code'] ?? '')
        );

        $blockedApprove = $this->captureResponse(
            static fn () => \ClinicalHistoryController::episodeActionPost([
                'isAdmin' => true,
            ]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'action' => 'approve_final_note',
            ]
        );

        self::assertSame(409, $blockedApprove['status']);
        self::assertSame(
            'clinical_history_approval_blocked',
            (string) ($blockedApprove['payload']['code'] ?? '')
        );

        $consentAccepted = $this->captureResponse(
            static fn () => \ClinicalHistoryController::recordPatch([
                'isAdmin' => true,
            ]),
            'PATCH',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'consent' => [
                    'required' => true,
                    'status' => 'accepted',
                    'informedBy' => 'Dra. Laura Mena',
                    'informedAt' => '2026-03-16T10:00:00-05:00',
                    'explainedWhat' => 'Se explico diagnostico, plan y seguimiento.',
                    'risksExplained' => 'Irritacion local transitoria',
                    'alternativesExplained' => 'Observacion y cuidado topico',
                    'capacityAssessment' => 'Paciente capaz de decidir',
                    'privateCommunicationConfirmed' => true,
                    'companionShareAuthorized' => false,
                    'acceptedAt' => '2026-03-16T10:05:00-05:00',
                ],
            ]
        );

        self::assertSame(200, $consentAccepted['status']);
        self::assertSame('ready', (string) ($consentAccepted['payload']['data']['legalReadiness']['status'] ?? ''));
        self::assertSame(
            'complete',
            (string) ($consentAccepted['payload']['data']['legalReadiness']['hcu001Status']['status'] ?? '')
        );
        self::assertSame(
            'complete',
            (string) ($consentAccepted['payload']['data']['legalReadiness']['hcu005Status']['status'] ?? '')
        );

        $approved = $this->captureResponse(
            static fn () => \ClinicalHistoryController::episodeActionPost([
                'isAdmin' => true,
            ]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'action' => 'approve_final_note',
            ]
        );

        self::assertSame(200, $approved['status']);
        self::assertSame('approved', (string) ($approved['payload']['data']['approval']['status'] ?? ''));
        self::assertSame('issued', (string) ($approved['payload']['data']['documents']['prescription']['status'] ?? ''));
        self::assertContains(
            'MSP-HCU-FORM-024',
            $approved['payload']['data']['approval']['normativeSources'] ?? []
        );
    }

    public function testClinicalRecordGovernanceAuditsAccessAndEnforcesDisclosureAndArchiveRules(): void
    {
        $sessionCreate = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionPost([]),
            'POST',
            [
                'surface' => 'waiting_room',
                'patient' => [
                    'name' => 'Marta Leon',
                    'email' => 'marta@example.com',
                ],
            ]
        );

        self::assertSame(201, $sessionCreate['status']);
        $session = $sessionCreate['payload']['data']['session'] ?? [];

        $_SESSION['csrf_token'] = 'csrf-test';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'csrf-test';

        $recordPatch = $this->captureResponse(
            static fn () => \ClinicalHistoryController::recordPatch([
                'isAdmin' => true,
            ]),
            'PATCH',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'draft' => [
                    'intake' => [
                        'motivoConsulta' => 'Dermatitis',
                        'enfermedadActual' => 'Brote leve en antebrazos',
                        'antecedentes' => 'Niega antecedentes relevantes',
                        'alergias' => 'Niega alergias',
                        'preguntasFaltantes' => [],
                        'datosPaciente' => [
                            'edadAnios' => 37,
                            'pesoKg' => 61,
                            'sexoBiologico' => 'femenino',
                            'embarazo' => false,
                        ],
                    ],
                    'clinicianDraft' => [
                        'resumen' => 'Dermatitis leve en control.',
                        'preguntasFaltantes' => [],
                        'tratamientoBorrador' => 'Emoliente y observacion',
                        'posologiaBorrador' => [
                            'texto' => 'Aplicacion local dos veces al dia',
                            'baseCalculo' => 'standard',
                            'pesoKg' => 61,
                            'edadAnios' => 37,
                            'units' => '',
                            'ambiguous' => false,
                        ],
                        'hcu005' => [
                            'evolutionNote' => 'Dermatitis leve en control.',
                            'diagnosticImpression' => 'Dermatitis en control.',
                            'therapeuticPlan' => 'Emoliente y observacion.',
                            'careIndications' => 'Aplicacion local dos veces al dia.',
                            'prescriptionItems' => [[
                                'medication' => 'Emoliente',
                                'presentation' => 'Crema',
                                'dose' => 'Aplicacion local',
                                'route' => 'Topica',
                                'frequency' => 'Dos veces al dia',
                                'duration' => '14 dias',
                                'quantity' => '1 tubo',
                                'instructions' => 'Aplicar en antebrazos.',
                            ]],
                        ],
                    ],
                ],
                'documents' => [
                    'prescription' => [
                        'medication' => 'Emoliente',
                        'directions' => 'Aplicacion local dos veces al dia',
                    ],
                ],
                'admission001' => $this->buildAdmission001Payload([
                    'identity' => [
                        'apellidoPaterno' => 'Leon',
                        'primerNombre' => 'Marta',
                    ],
                ]),
                'consent' => [
                    'required' => true,
                    'status' => 'accepted',
                    'informedBy' => 'Dra. Laura Mena',
                    'informedAt' => '2026-03-16T10:00:00-05:00',
                    'explainedWhat' => 'Se explico el plan terapeutico.',
                    'risksExplained' => 'Irritacion leve',
                    'alternativesExplained' => 'Observacion',
                    'capacityAssessment' => 'Paciente capaz de decidir',
                    'privateCommunicationConfirmed' => true,
                    'companionShareAuthorized' => false,
                    'acceptedAt' => '2026-03-16T10:05:00-05:00',
                ],
                'requiresHumanReview' => false,
            ]
        );

        self::assertSame(200, $recordPatch['status']);
        self::assertSame('ready', (string) ($recordPatch['payload']['data']['legalReadiness']['status'] ?? ''));
        self::assertSame(
            'complete',
            (string) ($recordPatch['payload']['data']['legalReadiness']['hcu001Status']['status'] ?? '')
        );
        self::assertSame(
            'complete',
            (string) ($recordPatch['payload']['data']['legalReadiness']['hcu005Status']['status'] ?? '')
        );
        self::assertSame('edit_admission_record', (string) ($recordPatch['payload']['data']['accessAudit'][0]['action'] ?? ''));

        $_GET = ['sessionId' => (string) ($session['sessionId'] ?? '')];
        $recordView = $this->captureResponse(
            static fn () => \ClinicalHistoryController::recordGet([
                'isAdmin' => true,
            ])
        );

        self::assertSame(200, $recordView['status']);
        self::assertSame('view_record', (string) ($recordView['payload']['data']['accessAudit'][0]['action'] ?? ''));

        $copyRequest = $this->captureResponse(
            static fn () => \ClinicalHistoryController::episodeActionPost([
                'isAdmin' => true,
            ]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'action' => 'request_certified_copy',
                'requestedByType' => 'patient',
                'requestedByName' => 'Marta Leon',
                'notes' => 'Solicita copia certificada para archivo personal.',
            ]
        );

        self::assertSame(200, $copyRequest['status']);
        self::assertSame(1, (int) ($copyRequest['payload']['data']['auditSummary']['copyRequestsCount'] ?? -1));
        self::assertSame('request_certified_copy', (string) ($copyRequest['payload']['data']['accessAudit'][0]['action'] ?? ''));
        $request = $copyRequest['payload']['data']['copyRequests'][0] ?? [];
        self::assertNotSame('', (string) ($request['requestId'] ?? ''));
        self::assertSame('requested', (string) ($request['status'] ?? ''));
        self::assertSame('requested', (string) ($request['effectiveStatus'] ?? ''));
        self::assertNotSame('', (string) ($request['dueAt'] ?? ''));

        $dueAt = new \DateTimeImmutable((string) ($request['dueAt'] ?? ''));
        $requestedAt = new \DateTimeImmutable((string) ($request['requestedAt'] ?? ''));
        self::assertLessThanOrEqual(48 * 3600, abs($dueAt->getTimestamp() - $requestedAt->getTimestamp()));

        $blockedCompanionDisclosure = $this->captureResponse(
            static fn () => \ClinicalHistoryController::episodeActionPost([
                'isAdmin' => true,
            ]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'action' => 'log_disclosure',
                'targetType' => 'companion',
                'targetName' => 'Hermana de Marta',
                'purpose' => 'Compartir indicaciones',
            ]
        );

        self::assertSame(409, $blockedCompanionDisclosure['status']);
        self::assertSame(
            'clinical_companion_disclosure_requires_consent',
            (string) ($blockedCompanionDisclosure['payload']['code'] ?? '')
        );

        $blockedThirdPartyDisclosure = $this->captureResponse(
            static fn () => \ClinicalHistoryController::episodeActionPost([
                'isAdmin' => true,
            ]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'action' => 'log_disclosure',
                'targetType' => 'external_third_party',
                'targetName' => 'Aseguradora externa',
                'purpose' => 'Soporte documental',
            ]
        );

        self::assertSame(409, $blockedThirdPartyDisclosure['status']);
        self::assertSame(
            'clinical_external_disclosure_requires_legal_basis',
            (string) ($blockedThirdPartyDisclosure['payload']['code'] ?? '')
        );

        $copyDelivered = $this->captureResponse(
            static fn () => \ClinicalHistoryController::episodeActionPost([
                'isAdmin' => true,
            ]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'action' => 'deliver_certified_copy',
                'requestId' => (string) ($request['requestId'] ?? ''),
                'deliveredTo' => 'Marta Leon',
                'deliveryChannel' => 'retiro_fisico',
                'notes' => 'Entrega firmada en consultorio.',
            ]
        );

        self::assertSame(200, $copyDelivered['status']);
        self::assertSame('deliver_certified_copy', (string) ($copyDelivered['payload']['data']['accessAudit'][0]['action'] ?? ''));
        self::assertSame('delivered', (string) ($copyDelivered['payload']['data']['copyRequests'][0]['status'] ?? ''));
        self::assertSame('delivered', (string) ($copyDelivered['payload']['data']['copyRequests'][0]['effectiveStatus'] ?? ''));
        self::assertSame(
            'Entrega de copia certificada',
            (string) ($copyDelivered['payload']['data']['disclosureLog'][0]['purpose'] ?? '')
        );

        $archiveBlocked = $this->captureResponse(
            static fn () => \ClinicalHistoryController::episodeActionPost([
                'isAdmin' => true,
            ]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'action' => 'set_archive_state',
                'archiveState' => 'passive',
            ]
        );

        self::assertSame(409, $archiveBlocked['status']);
        self::assertSame(
            'clinical_archive_override_required',
            (string) ($archiveBlocked['payload']['code'] ?? '')
        );

        $archivePassive = $this->captureResponse(
            static fn () => \ClinicalHistoryController::episodeActionPost([
                'isAdmin' => true,
            ]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'action' => 'set_archive_state',
                'archiveState' => 'passive',
                'overrideReason' => 'Custodia anticipada por reorganizacion documental supervisada.',
            ]
        );

        self::assertSame(200, $archivePassive['status']);
        self::assertSame('set_archive_state', (string) ($archivePassive['payload']['data']['accessAudit'][0]['action'] ?? ''));
        self::assertSame('passive', (string) ($archivePassive['payload']['data']['archiveReadiness']['archiveState'] ?? ''));
        self::assertSame('Pasiva', (string) ($archivePassive['payload']['data']['recordsGovernance']['archiveReadiness']['label'] ?? ''));
    }

    public function testClinicalHistoryApprovalBlocksWhenHcu005EvolutionIsMissing(): void
    {
        $sessionCreate = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionPost([]),
            'POST',
            [
                'surface' => 'waiting_room',
                'patient' => [
                    'name' => 'Eva Mora',
                    'email' => 'eva@example.com',
                ],
            ]
        );

        self::assertSame(201, $sessionCreate['status']);
        $session = $sessionCreate['payload']['data']['session'] ?? [];

        $_SESSION['csrf_token'] = 'csrf-test';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'csrf-test';

        $recordPatch = $this->captureResponse(
            static fn () => \ClinicalHistoryController::recordPatch([
                'isAdmin' => true,
            ]),
            'PATCH',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'draft' => [
                    'intake' => [
                        'motivoConsulta' => 'Control dermatologico',
                        'enfermedadActual' => 'Seguimiento de lesiones',
                        'antecedentes' => 'Sin antecedentes relevantes',
                        'alergias' => 'Niega alergias',
                        'preguntasFaltantes' => [],
                        'datosPaciente' => [
                            'edadAnios' => 29,
                            'pesoKg' => 55,
                            'sexoBiologico' => 'femenino',
                            'embarazo' => false,
                        ],
                    ],
                    'clinicianDraft' => [
                        'resumen' => '',
                        'preguntasFaltantes' => [],
                        'hcu005' => [
                            'evolutionNote' => '',
                            'diagnosticImpression' => 'Dermatitis leve en observacion.',
                            'therapeuticPlan' => 'Continuar hidratacion cutanea.',
                            'careIndications' => '',
                            'prescriptionItems' => [],
                        ],
                    ],
                ],
                'consent' => [
                    'required' => false,
                    'status' => 'not_required',
                ],
                'admission001' => $this->buildAdmission001Payload([
                    'identity' => [
                        'apellidoPaterno' => 'Mora',
                        'primerNombre' => 'Eva',
                    ],
                ]),
                'requiresHumanReview' => false,
            ]
        );

        self::assertSame(200, $recordPatch['status']);
        self::assertSame('blocked', (string) ($recordPatch['payload']['data']['legalReadiness']['status'] ?? ''));
        self::assertSame('partial', (string) ($recordPatch['payload']['data']['legalReadiness']['hcu005Status']['status'] ?? ''));
        self::assertContains(
            'hcu005_evolution_missing',
            array_values(array_map(
                static fn (array $reason): string => (string) ($reason['code'] ?? ''),
                $recordPatch['payload']['data']['approvalBlockedReasons'] ?? []
            ))
        );
    }

    public function testClinicalHistoryLegacyAdmissionRegularizationDoesNotBlockApproval(): void
    {
        $sessionCreate = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionPost([]),
            'POST',
            [
                'surface' => 'waiting_room',
                'patient' => [
                    'name' => 'Rosa Vega',
                    'email' => 'rosa@example.com',
                ],
            ]
        );

        self::assertSame(201, $sessionCreate['status']);
        $session = $sessionCreate['payload']['data']['session'] ?? [];

        $_SESSION['csrf_token'] = 'csrf-legacy';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'csrf-legacy';

        $recordPatch = $this->captureResponse(
            static fn () => \ClinicalHistoryController::recordPatch([
                'isAdmin' => true,
            ]),
            'PATCH',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'draft' => [
                    'intake' => [
                        'motivoConsulta' => 'Control dermatologico',
                        'enfermedadActual' => 'Seguimiento de rosacea facial',
                        'antecedentes' => 'Niega antecedentes de alarma',
                        'alergias' => 'Niega alergias',
                        'preguntasFaltantes' => [],
                        'datosPaciente' => [
                            'edadAnios' => 42,
                            'pesoKg' => 60,
                            'sexoBiologico' => 'femenino',
                            'embarazo' => false,
                        ],
                    ],
                    'clinicianDraft' => [
                        'resumen' => 'Rosacea facial estable en seguimiento.',
                        'preguntasFaltantes' => [],
                        'tratamientoBorrador' => 'Continuar metronidazol topico.',
                        'posologiaBorrador' => [
                            'texto' => 'Aplicacion nocturna por 6 semanas.',
                            'baseCalculo' => 'standard',
                            'pesoKg' => 60,
                            'edadAnios' => 42,
                            'units' => '',
                            'ambiguous' => false,
                        ],
                        'hcu005' => [
                            'evolutionNote' => 'Rosacea facial estable en seguimiento.',
                            'diagnosticImpression' => 'Rosacea en control.',
                            'therapeuticPlan' => 'Continuar manejo topico.',
                            'careIndications' => 'Fotoproteccion y reevaluacion en 6 semanas.',
                            'prescriptionItems' => [[
                                'medication' => 'Metronidazol topico',
                                'presentation' => 'Gel 0.75%',
                                'dose' => 'Aplicacion fina',
                                'route' => 'Topica',
                                'frequency' => 'Nocturna',
                                'duration' => '6 semanas',
                                'quantity' => '1 tubo',
                                'instructions' => 'Aplicar en piel limpia.',
                            ]],
                        ],
                    ],
                ],
                'consent' => [
                    'required' => false,
                    'status' => 'not_required',
                ],
                'admission001' => $this->buildAdmission001Payload([
                    'identity' => [
                        'apellidoPaterno' => 'Vega',
                        'primerNombre' => 'Rosa',
                    ],
                    'emergencyContact' => [
                        'name' => '',
                        'kinship' => '',
                        'phone' => '',
                    ],
                    'admissionMeta' => [
                        'transitionMode' => 'legacy_inferred',
                    ],
                ]),
                'requiresHumanReview' => false,
            ]
        );

        self::assertSame(200, $recordPatch['status']);
        self::assertSame('ready', (string) ($recordPatch['payload']['data']['legalReadiness']['status'] ?? ''));
        self::assertSame(
            'legacy_partial',
            (string) ($recordPatch['payload']['data']['legalReadiness']['hcu001Status']['status'] ?? '')
        );
        self::assertSame(
            'complete',
            (string) ($recordPatch['payload']['data']['legalReadiness']['hcu005Status']['status'] ?? '')
        );
        self::assertNotContains(
            'hcu001_admission_incomplete',
            array_values(array_map(
                static fn (array $reason): string => (string) ($reason['code'] ?? ''),
                $recordPatch['payload']['data']['approvalBlockedReasons'] ?? []
            ))
        );

        $approve = $this->captureResponse(
            static fn () => \ClinicalHistoryController::episodeActionPost([
                'isAdmin' => true,
            ]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'action' => 'approve_final_note',
            ]
        );

        self::assertSame(200, $approve['status']);
        self::assertSame('approved', (string) ($approve['payload']['data']['approval']['status'] ?? ''));
        self::assertSame(
            'legacy_inferred',
            (string) ($approve['payload']['data']['documents']['finalNote']['sections']['hcu001']['admissionMeta']['transitionMode'] ?? '')
        );
    }

    public function testClinicalHistoryApprovalBlocksWhenHcu005PrescriptionIsIncomplete(): void
    {
        $sessionCreate = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionPost([]),
            'POST',
            [
                'surface' => 'waiting_room',
                'patient' => [
                    'name' => 'Luis Naranjo',
                    'email' => 'luis@example.com',
                ],
            ]
        );

        self::assertSame(201, $sessionCreate['status']);
        $session = $sessionCreate['payload']['data']['session'] ?? [];

        $_SESSION['csrf_token'] = 'csrf-test';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'csrf-test';

        $recordPatch = $this->captureResponse(
            static fn () => \ClinicalHistoryController::recordPatch([
                'isAdmin' => true,
            ]),
            'PATCH',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'draft' => [
                    'intake' => [
                        'motivoConsulta' => 'Acne inflamatorio',
                        'enfermedadActual' => 'Brote reciente en rostro',
                        'antecedentes' => 'Sin antecedentes relevantes',
                        'alergias' => 'Niega alergias',
                        'preguntasFaltantes' => [],
                        'datosPaciente' => [
                            'edadAnios' => 24,
                            'pesoKg' => 68,
                            'sexoBiologico' => 'masculino',
                            'embarazo' => false,
                        ],
                    ],
                    'clinicianDraft' => [
                        'resumen' => 'Acne inflamatorio en manejo inicial.',
                        'preguntasFaltantes' => [],
                        'hcu005' => [
                            'evolutionNote' => 'Acne inflamatorio en manejo inicial.',
                            'diagnosticImpression' => 'Acne inflamatorio moderado.',
                            'therapeuticPlan' => 'Iniciar tratamiento topico.',
                            'careIndications' => 'Control dermatologico en 4 semanas.',
                            'prescriptionItems' => [[
                                'medication' => 'Adapaleno',
                                'presentation' => '',
                                'dose' => 'Aplicacion fina',
                                'route' => 'Topica',
                                'frequency' => 'Nocturna',
                                'duration' => '8 semanas',
                                'quantity' => '',
                                'instructions' => 'Aplicar en rostro limpio.',
                            ]],
                        ],
                    ],
                ],
                'consent' => [
                    'required' => false,
                    'status' => 'not_required',
                ],
                'admission001' => $this->buildAdmission001Payload([
                    'identity' => [
                        'apellidoPaterno' => 'Naranjo',
                        'primerNombre' => 'Luis',
                        'documentType' => 'passport',
                        'documentNumber' => 'EC-998877',
                    ],
                    'demographics' => [
                        'sexAtBirth' => 'masculino',
                        'ageYears' => 24,
                        'birthDate' => '2002-06-14',
                    ],
                ]),
                'requiresHumanReview' => false,
            ]
        );

        self::assertSame(200, $recordPatch['status']);
        self::assertSame('blocked', (string) ($recordPatch['payload']['data']['legalReadiness']['status'] ?? ''));
        self::assertSame('partial', (string) ($recordPatch['payload']['data']['legalReadiness']['hcu005Status']['status'] ?? ''));
        self::assertContains(
            'hcu005_prescription_incomplete',
            array_values(array_map(
                static fn (array $reason): string => (string) ($reason['code'] ?? ''),
                $recordPatch['payload']['data']['approvalBlockedReasons'] ?? []
            ))
        );
    }

    public function testClinicalHistoryFallbackKeepsTranscriptAndMarksReviewRequired(): void
    {
        putenv('FIGO_PROVIDER_MODE=openclaw_queue');
        putenv('OPENCLAW_BRIDGE_SYNC_WAIT_MS=0');
        putenv('OPENCLAW_GATEWAY_ENDPOINT=');

        $sessionCreate = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionPost([]),
            'POST',
            [
                'surface' => 'waiting_room',
            ]
        );

        $session = $sessionCreate['payload']['data']['session'] ?? [];
        $message = $this->captureResponse(
            static fn () => \ClinicalHistoryController::messagePost([]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'caseId' => (string) ($session['caseId'] ?? ''),
                'message' => 'Mi hija tiene 12 anos, pesa 42 kg y es alergica a la penicilina.',
                'clientMessageId' => 'msg-fallback-001',
            ]
        );

        self::assertSame(200, $message['status']);
        self::assertNotSame('live', (string) ($message['payload']['data']['ai']['mode'] ?? ''));
        self::assertTrue((bool) ($message['payload']['data']['response']['requiresHumanReview'] ?? false));

        $_GET = ['sessionId' => (string) ($session['sessionId'] ?? '')];
        $sessionView = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionGet([
                'store' => \read_store(),
            ])
        );

        self::assertSame(200, $sessionView['status']);
        self::assertGreaterThanOrEqual(2, count($sessionView['payload']['data']['session']['transcript'] ?? []));
        self::assertSame('review_required', (string) ($sessionView['payload']['data']['draft']['reviewStatus'] ?? ''));
    }

    public function testClinicalHistoryQueuedJobReconcilesIntoSameSessionWithoutDuplicatingTranscript(): void
    {
        putenv('FIGO_PROVIDER_MODE=openclaw_queue');
        putenv('OPENCLAW_BRIDGE_SYNC_WAIT_MS=0');
        putenv('OPENCLAW_GATEWAY_ENDPOINT=http://127.0.0.1:9/openclaw');

        $sessionCreate = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionPost([]),
            'POST',
            [
                'surface' => 'waiting_room',
                'patient' => [
                    'name' => 'Luis Andrade',
                ],
            ]
        );

        $session = $sessionCreate['payload']['data']['session'] ?? [];
        $message = $this->captureResponse(
            static fn () => \ClinicalHistoryController::messagePost([]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'caseId' => (string) ($session['caseId'] ?? ''),
                'surface' => 'patient_link',
                'message' => 'Tengo acne inflamatorio desde hace 3 meses y peso 70 kg.',
                'clientMessageId' => 'msg-queued-001',
            ]
        );

        self::assertSame(200, $message['status']);
        self::assertSame('queued', (string) ($message['payload']['data']['ai']['mode'] ?? ''));
        $jobId = (string) ($message['payload']['data']['ai']['jobId'] ?? '');
        self::assertNotSame('', $jobId);
        self::assertGreaterThanOrEqual(2, count($message['payload']['data']['session']['transcript'] ?? []));

        $this->completeQueuedClinicalJob($jobId, [
            'reply' => 'Gracias, ya registre tu motivo de consulta.',
            'nextQuestion' => 'Desde cuando notas los brotes y si han empeorado recientemente?',
            'intakePatch' => [
                'motivoConsulta' => 'Acne inflamatorio',
                'enfermedadActual' => 'Brotes inflamatorios faciales de 3 meses',
                'medicacionActual' => 'Sin tratamiento actual',
                'datosPaciente' => [
                    'pesoKg' => 70,
                ],
            ],
            'missingFields' => ['alergias', 'antecedentes'],
            'redFlags' => [],
            'clinicianDraft' => [
                'resumen' => 'Acne inflamatorio facial de 3 meses.',
                'preguntasFaltantes' => ['Alergias', 'Antecedentes dermatologicos'],
                'cie10Sugeridos' => ['L70.0'],
                'tratamientoBorrador' => 'Considerar retinoide topico nocturno',
                'posologiaBorrador' => [
                    'texto' => 'Aplicacion nocturna',
                    'baseCalculo' => 'standard',
                    'pesoKg' => 70,
                    'edadAnios' => null,
                    'units' => '',
                    'ambiguous' => true,
                ],
            ],
            'requiresHumanReview' => false,
            'confidence' => 0.78,
        ]);

        $_GET = ['sessionId' => (string) ($session['sessionId'] ?? '')];
        $sessionView = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionGet([])
        );

        self::assertSame(200, $sessionView['status']);
        self::assertSame('live', (string) ($sessionView['payload']['data']['ai']['mode'] ?? ''));
        self::assertSame($jobId, (string) ($sessionView['payload']['data']['ai']['jobId'] ?? ''));
        self::assertSame(2, count($sessionView['payload']['data']['session']['transcript'] ?? []));
        self::assertSame(
            'Gracias, ya registre tu motivo de consulta.',
            (string) ($sessionView['payload']['data']['response']['reply'] ?? '')
        );
        self::assertNotSame('', (string) ($sessionView['payload']['data']['response']['nextQuestion'] ?? ''));
        self::assertStringContainsString(
            'Gracias, ya registre tu motivo de consulta.',
            (string) ($sessionView['payload']['data']['session']['transcript'][1]['content'] ?? '')
        );
        self::assertStringContainsString(
            'Acne inflamatorio',
            (string) ($sessionView['payload']['data']['draft']['intake']['motivoConsulta'] ?? '')
        );

        $_GET = ['sessionId' => (string) ($session['sessionId'] ?? '')];
        $review = $this->captureResponse(
            static fn () => \ClinicalHistoryController::reviewGet([
                'isAdmin' => true,
            ])
        );

        self::assertSame(200, $review['status']);
        self::assertSame(['L70.0'], $review['payload']['data']['draft']['clinicianDraft']['cie10Sugeridos'] ?? []);
        self::assertSame('', (string) ($review['payload']['data']['draft']['pendingAi']['jobId'] ?? ''));
        self::assertSame($jobId, (string) ($review['payload']['data']['session']['metadata']['lastPendingAi']['jobId'] ?? ''));
        self::assertSame('completed', (string) ($review['payload']['data']['session']['metadata']['lastPendingAi']['status'] ?? ''));
        self::assertCount(1, $review['payload']['data']['events'] ?? []);
        self::assertSame('draft_reconciled', (string) ($review['payload']['data']['events'][0]['type'] ?? ''));
        self::assertSame('open', (string) ($review['payload']['data']['events'][0]['status'] ?? ''));

        self::assertSame('blocked', (string) ($review['payload']['data']['legalReadiness']['status'] ?? ''));

        $_SESSION['csrf_token'] = 'csrf-queued';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'csrf-queued';
        $recordPatch = $this->captureResponse(
            static fn () => \ClinicalHistoryController::recordPatch([
                'isAdmin' => true,
            ]),
            'PATCH',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'draft' => [
                    'intake' => [
                        'antecedentes' => 'Sin antecedentes dermatologicos relevantes.',
                        'alergias' => 'Niega alergias medicamentosas.',
                        'datosPaciente' => [
                            'edadAnios' => 29,
                        ],
                        'preguntasFaltantes' => [],
                    ],
                    'clinicianDraft' => [
                        'preguntasFaltantes' => [],
                        'posologiaBorrador' => [
                            'texto' => 'Aplicacion nocturna',
                            'baseCalculo' => 'standard',
                            'pesoKg' => 70,
                            'edadAnios' => 29,
                            'units' => '',
                            'ambiguous' => false,
                        ],
                        'hcu005' => [
                            'evolutionNote' => 'Acne inflamatorio facial de 3 meses.',
                            'diagnosticImpression' => 'Acne inflamatorio facial en control.',
                            'therapeuticPlan' => 'Retinoide topico nocturno.',
                            'careIndications' => 'Aplicacion nocturna por 8 semanas.',
                            'prescriptionItems' => [[
                                'medication' => 'Retinoide topico',
                                'presentation' => 'Gel',
                                'dose' => 'Aplicacion fina',
                                'route' => 'Topica',
                                'frequency' => 'Nocturna',
                                'duration' => '8 semanas',
                                'quantity' => '1 tubo',
                                'instructions' => 'Aplicar sobre rostro limpio.',
                            ]],
                        ],
                    ],
                ],
                'documents' => [
                    'prescription' => [
                        'medication' => 'Retinoide topico',
                        'directions' => 'Aplicacion nocturna por 8 semanas',
                    ],
                ],
                'admission001' => $this->buildAdmission001Payload([
                    'identity' => [
                        'apellidoPaterno' => 'Andrade',
                        'primerNombre' => 'Luis',
                    ],
                    'demographics' => [
                        'sexAtBirth' => 'masculino',
                        'ageYears' => 29,
                        'birthDate' => '1996-05-18',
                    ],
                ]),
                'requiresHumanReview' => false,
            ]
        );

        self::assertSame(200, $recordPatch['status']);
        self::assertSame('ready', (string) ($recordPatch['payload']['data']['legalReadiness']['status'] ?? ''));
        self::assertSame('complete', (string) ($recordPatch['payload']['data']['legalReadiness']['hcu001Status']['status'] ?? ''));

        $approve = $this->captureResponse(
            static fn () => \ClinicalHistoryController::episodeActionPost([
                'isAdmin' => true,
            ]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'action' => 'approve_final_note',
            ]
        );

        self::assertSame(200, $approve['status']);
        self::assertCount(1, $approve['payload']['data']['events'] ?? []);
        self::assertSame('resolved', (string) ($approve['payload']['data']['events'][0]['status'] ?? ''));
        self::assertNotSame('', (string) ($approve['payload']['data']['events'][0]['acknowledgedAt'] ?? ''));
        self::assertNotSame('', (string) ($approve['payload']['data']['events'][0]['resolvedAt'] ?? ''));
        self::assertSame('approved', (string) ($approve['payload']['data']['approval']['status'] ?? ''));
    }

    public function testClinicalHistoryBackgroundReconcilerProcessesPendingSessionsWithoutReopeningSession(): void
    {
        putenv('FIGO_PROVIDER_MODE=openclaw_queue');
        putenv('OPENCLAW_BRIDGE_SYNC_WAIT_MS=0');
        putenv('OPENCLAW_GATEWAY_ENDPOINT=http://127.0.0.1:9/openclaw');

        $sessionCreate = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionPost([]),
            'POST',
            [
                'surface' => 'waiting_room',
            ]
        );

        $session = $sessionCreate['payload']['data']['session'] ?? [];
        $message = $this->captureResponse(
            static fn () => \ClinicalHistoryController::messagePost([]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'caseId' => (string) ($session['caseId'] ?? ''),
                'message' => 'Tengo rosacea facial desde hace 6 meses y peso 63 kg.',
                'clientMessageId' => 'msg-background-001',
            ]
        );

        self::assertSame('queued', (string) ($message['payload']['data']['ai']['mode'] ?? ''));
        $jobId = (string) ($message['payload']['data']['ai']['jobId'] ?? '');
        self::assertNotSame('', $jobId);

        $this->completeQueuedClinicalJob($jobId, [
            'reply' => 'Gracias, ya registre esta evolucion en tu historia clinica.',
            'nextQuestion' => 'Has notado ardor, desencadenantes o empeoramiento con calor o sol?',
            'intakePatch' => [
                'motivoConsulta' => 'Rosacea facial',
                'enfermedadActual' => 'Eritema y brotes faciales de 6 meses',
                'datosPaciente' => [
                    'pesoKg' => 63,
                ],
            ],
            'missingFields' => ['alergias', 'antecedentes', 'medicacionActual'],
            'redFlags' => [],
            'clinicianDraft' => [
                'resumen' => 'Rosacea facial de 6 meses de evolucion.',
                'preguntasFaltantes' => ['Desencadenantes', 'Alergias'],
                'cie10Sugeridos' => ['L71.9'],
                'tratamientoBorrador' => 'Considerar tratamiento topico antiinflamatorio',
                'posologiaBorrador' => [
                    'texto' => 'Aplicacion topica diaria',
                    'baseCalculo' => 'standard',
                    'pesoKg' => 63,
                    'edadAnios' => null,
                    'units' => '',
                    'ambiguous' => true,
                ],
            ],
            'requiresHumanReview' => false,
            'confidence' => 0.8,
        ]);

        $service = new \ClinicalHistoryService();
        $result = $service->reconcilePendingSessions(\read_store(), [
            'maxSessions' => 10,
        ]);

        self::assertTrue((bool) ($result['ok'] ?? false));
        self::assertSame(1, (int) ($result['scanned'] ?? 0));
        self::assertSame(1, (int) ($result['mutated'] ?? 0));
        self::assertSame(1, (int) ($result['completed'] ?? 0));
        self::assertSame(0, (int) ($result['remaining'] ?? 0));

        $reconciledStore = is_array($result['store'] ?? null) ? $result['store'] : [];
        $sessionRecord = \ClinicalHistoryRepository::findSessionBySessionId(
            $reconciledStore,
            (string) ($session['sessionId'] ?? '')
        );
        $draftRecord = \ClinicalHistoryRepository::findDraftBySessionId(
            $reconciledStore,
            (string) ($session['sessionId'] ?? '')
        );

        self::assertIsArray($sessionRecord);
        self::assertIsArray($draftRecord);
        self::assertSame([], $sessionRecord['pendingAi'] ?? null);
        self::assertSame('live', (string) ($sessionRecord['lastTurn']['ai']['mode'] ?? ''));
        self::assertSame('completed', (string) ($sessionRecord['metadata']['lastPendingAi']['status'] ?? ''));
        self::assertSame(2, count($sessionRecord['transcript'] ?? []));
        self::assertSame(['L71.9'], $draftRecord['clinicianDraft']['cie10Sugeridos'] ?? []);
        self::assertSame('Rosacea facial', (string) ($draftRecord['intake']['motivoConsulta'] ?? ''));
    }

    public function testClinicalHistoryConsentPacketsCanBeDeclaredAndSnapshotted(): void
    {
        $sessionCreate = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionPost([]),
            'POST',
            [
                'surface' => 'waiting_room',
                'patient' => [
                    'name' => 'Lucia Vega',
                    'email' => 'lucia@example.com',
                ],
            ]
        );

        self::assertSame(201, $sessionCreate['status']);
        $session = $sessionCreate['payload']['data']['session'] ?? [];

        $_SESSION['csrf_token'] = 'csrf-consent-packets';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'csrf-consent-packets';

        $recordPatch = $this->captureResponse(
            static fn () => \ClinicalHistoryController::recordPatch([
                'isAdmin' => true,
            ]),
            'PATCH',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'draft' => [
                    'intake' => [
                        'motivoConsulta' => 'Procedimiento dermatologico ambulatorio',
                        'enfermedadActual' => 'Lesion facial con indicacion de botox terapeutico',
                        'antecedentes' => 'Sin antecedentes de alarma',
                        'alergias' => 'Niega alergias medicamentosas',
                        'preguntasFaltantes' => [],
                        'datosPaciente' => [
                            'edadAnios' => 34,
                            'pesoKg' => 58,
                            'sexoBiologico' => 'femenino',
                            'embarazo' => false,
                        ],
                    ],
                    'clinicianDraft' => [
                        'resumen' => 'Caso listo para consentimiento escrito por procedimiento.',
                        'preguntasFaltantes' => [],
                        'cie10Sugeridos' => ['L71.9'],
                        'tratamientoBorrador' => 'Aplicacion de toxina botulinica',
                        'posologiaBorrador' => [
                            'texto' => 'Aplicacion en puntos definidos',
                            'baseCalculo' => 'standard',
                            'pesoKg' => 58,
                            'edadAnios' => 34,
                            'units' => '',
                            'ambiguous' => false,
                        ],
                        'hcu005' => [
                            'evolutionNote' => 'Caso listo para consentimiento escrito por procedimiento.',
                            'diagnosticImpression' => 'Rosacea inflamatoria con indicacion de botox.',
                            'therapeuticPlan' => 'Procedimiento ambulatorio con seguimiento.',
                            'careIndications' => 'Control posterior y vigilancia de signos de alarma.',
                            'prescriptionItems' => [[
                                'medication' => 'Botox',
                                'presentation' => 'Vial',
                                'dose' => 'Segun plan clinico',
                                'route' => 'Intradermica',
                                'frequency' => 'Procedimiento unico',
                                'duration' => 'Sesion ambulatoria',
                                'quantity' => '1 vial',
                                'instructions' => 'Aplicar en puntos definidos.',
                            ]],
                        ],
                    ],
                ],
                'documents' => [
                    'prescription' => [
                        'medication' => 'Botox',
                        'directions' => 'Aplicar en puntos definidos',
                    ],
                ],
                'admission001' => $this->buildAdmission001Payload([
                    'identity' => [
                        'apellidoPaterno' => 'Vega',
                        'primerNombre' => 'Lucia',
                    ],
                    'demographics' => [
                        'ageYears' => 34,
                        'sexAtBirth' => 'femenino',
                        'birthDate' => '1991-04-18',
                    ],
                ]),
                'requiresHumanReview' => false,
            ]
        );

        self::assertSame(200, $recordPatch['status']);
        self::assertSame('ready', (string) ($recordPatch['payload']['data']['legalReadiness']['status'] ?? ''));

        $packetCreated = $this->captureResponse(
            static fn () => \ClinicalHistoryController::episodeActionPost([
                'isAdmin' => true,
            ]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'action' => 'create_consent_packet',
                'templateKey' => 'botox',
            ]
        );

        self::assertSame(200, $packetCreated['status']);
        self::assertCount(1, $packetCreated['payload']['data']['consentPackets'] ?? []);
        $packet = $packetCreated['payload']['data']['consentPackets'][0] ?? [];
        $packetId = (string) ($packet['packetId'] ?? '');
        self::assertNotSame('', $packetId);
        self::assertSame('botox', (string) ($packet['templateKey'] ?? ''));

        $packet['title'] = 'Consentimiento informado HCU-form.024/2008';
        $packet['serviceLabel'] = 'Dermatologia ambulatoria';
        $packet['establishmentLabel'] = 'Piel Armonia';
        $packet['patientName'] = 'Lucia Vega';
        $packet['patientDocumentNumber'] = '0912345678';
        $packet['patientRecordId'] = 'hcu-' . (string) ($session['sessionId'] ?? '');
        $packet['encounterDateTime'] = '2026-03-16T10:20:00-05:00';
        $packet['diagnosisLabel'] = 'Rosacea inflamatoria con indicacion de botox.';
        $packet['diagnosisCie10'] = 'L71.9';
        $packet['procedureName'] = 'Aplicacion de toxina botulinica';
        $packet['procedureWhatIsIt'] = 'Aplicacion intramuscular o intradermica de toxina botulinica.';
        $packet['procedureHowItIsDone'] = 'Se realiza marcacion anatomica y aplicacion en puntos definidos.';
        $packet['durationEstimate'] = '20 minutos';
        $packet['benefits'] = 'Mejoria funcional y estetica segun indicacion clinica.';
        $packet['frequentRisks'] = 'Dolor leve, hematoma y edema.';
        $packet['rareSeriousRisks'] = 'Ptosis o reaccion alergica.';
        $packet['patientSpecificRisks'] = 'Equimosis facil y edema transitorio.';
        $packet['alternatives'] = 'Observacion clinica o manejo alternativo no infiltrativo.';
        $packet['postProcedureCare'] = 'Control posterior y evitar masaje local.';
        $packet['noProcedureConsequences'] = 'Persistencia del motivo de consulta.';
        $packet['professionalAttestation']['name'] = 'Dra. Laura Mena';
        $packet['professionalAttestation']['documentNumber'] = 'MED-024';
        $packet['declaration']['capacityAssessment'] = 'Paciente capaz de decidir';
        $packet['privateCommunicationConfirmed'] = true;

        $packetPatch = $this->captureResponse(
            static fn () => \ClinicalHistoryController::recordPatch([
                'isAdmin' => true,
            ]),
            'PATCH',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'consentPackets' => [$packet],
                'activeConsentPacketId' => $packetId,
            ]
        );

        self::assertSame(200, $packetPatch['status']);
        self::assertSame(
            $packetId,
            (string) ($packetPatch['payload']['data']['activeConsentPacketId'] ?? '')
        );

        $declared = $this->captureResponse(
            static fn () => \ClinicalHistoryController::episodeActionPost([
                'isAdmin' => true,
            ]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'action' => 'declare_consent',
                'packetId' => $packetId,
            ]
        );

        self::assertSame(200, $declared['status']);
        self::assertSame(
            'accepted',
            (string) ($declared['payload']['data']['consentPackets'][0]['status'] ?? '')
        );
        self::assertSame(
            'accepted',
            (string) ($declared['payload']['data']['consent']['status'] ?? '')
        );
        self::assertSame(
            'accepted',
            (string) ($declared['payload']['data']['legalReadiness']['hcu024Status']['status'] ?? '')
        );
        self::assertCount(1, $declared['payload']['data']['documents']['consentForms'] ?? []);
        self::assertSame(
            $packetId,
            (string) ($declared['payload']['data']['activeConsentPacketId'] ?? '')
        );
    }

    public function testClinicalHistoryConsentPacketsEnforceWitnessAndRevocationReceiverRules(): void
    {
        $sessionCreate = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionPost([]),
            'POST',
            [
                'surface' => 'waiting_room',
                'patient' => [
                    'name' => 'Marta Leon',
                    'email' => 'marta@example.com',
                ],
            ]
        );

        self::assertSame(201, $sessionCreate['status']);
        $session = $sessionCreate['payload']['data']['session'] ?? [];

        $_SESSION['csrf_token'] = 'csrf-consent-rules';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'csrf-consent-rules';

        $recordPatch = $this->captureResponse(
            static fn () => \ClinicalHistoryController::recordPatch([
                'isAdmin' => true,
            ]),
            'PATCH',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'draft' => [
                    'intake' => [
                        'motivoConsulta' => 'Peeling quimico ambulatorio',
                        'enfermedadActual' => 'Paciente candidata a procedimiento estetico',
                        'antecedentes' => 'Sin antecedentes de alarma',
                        'alergias' => 'Niega alergias',
                        'preguntasFaltantes' => [],
                        'datosPaciente' => [
                            'edadAnios' => 36,
                            'pesoKg' => 60,
                            'sexoBiologico' => 'femenino',
                            'embarazo' => false,
                        ],
                    ],
                    'clinicianDraft' => [
                        'resumen' => 'Peeling quimico programado con consentimiento escrito.',
                        'preguntasFaltantes' => [],
                        'cie10Sugeridos' => ['L70.0'],
                        'tratamientoBorrador' => 'Peeling quimico controlado',
                        'posologiaBorrador' => [
                            'texto' => 'Procedimiento unico con control posterior',
                            'baseCalculo' => 'standard',
                            'pesoKg' => 60,
                            'edadAnios' => 36,
                            'units' => '',
                            'ambiguous' => false,
                        ],
                        'hcu005' => [
                            'evolutionNote' => 'Peeling quimico programado con consentimiento escrito.',
                            'diagnosticImpression' => 'Paciente apta para procedimiento estetico controlado.',
                            'therapeuticPlan' => 'Peeling quimico ambulatorio.',
                            'careIndications' => 'Fotoproteccion y control posterior.',
                            'prescriptionItems' => [[
                                'medication' => 'Peeling quimico',
                                'presentation' => 'Sesion',
                                'dose' => 'Aplicacion unica',
                                'route' => 'Topica',
                                'frequency' => 'Sesion unica',
                                'duration' => '30 minutos',
                                'quantity' => '1',
                                'instructions' => 'Seguir protocolo de procedimiento.',
                            ]],
                        ],
                    ],
                ],
                'admission001' => $this->buildAdmission001Payload([
                    'identity' => [
                        'apellidoPaterno' => 'Leon',
                        'primerNombre' => 'Marta',
                    ],
                ]),
                'requiresHumanReview' => false,
            ]
        );

        self::assertSame(200, $recordPatch['status']);

        $packetCreated = $this->captureResponse(
            static fn () => \ClinicalHistoryController::episodeActionPost([
                'isAdmin' => true,
            ]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'action' => 'create_consent_packet',
                'templateKey' => 'peeling-quimico',
            ]
        );

        self::assertSame(200, $packetCreated['status']);
        $packet = $packetCreated['payload']['data']['consentPackets'][0] ?? [];
        $packetId = (string) ($packet['packetId'] ?? '');
        $packet['diagnosisLabel'] = 'Paciente apta para peeling quimico controlado.';
        $packet['diagnosisCie10'] = 'L70.0';
        $packet['patientSpecificRisks'] = 'Discromia transitoria postprocedimiento.';
        $packet['professionalAttestation']['name'] = 'Dra. Laura Mena';
        $packet['professionalAttestation']['documentNumber'] = 'MED-024';
        $packet['privateCommunicationConfirmed'] = true;
        $packet['denial']['patientRefusedSignature'] = true;

        $packetPatch = $this->captureResponse(
            static fn () => \ClinicalHistoryController::recordPatch([
                'isAdmin' => true,
            ]),
            'PATCH',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'consentPackets' => [$packet],
                'activeConsentPacketId' => $packetId,
            ]
        );

        self::assertSame(200, $packetPatch['status']);

        $blockedDenial = $this->captureResponse(
            static fn () => \ClinicalHistoryController::episodeActionPost([
                'isAdmin' => true,
            ]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'action' => 'deny_consent',
                'packetId' => $packetId,
            ]
        );

        self::assertSame(409, $blockedDenial['status']);
        self::assertSame(
            'clinical_consent_witness_required',
            (string) ($blockedDenial['payload']['code'] ?? '')
        );

        $packet['witnessAttestation']['name'] = 'Testigo Clinico';
        $packet['witnessAttestation']['documentNumber'] = '0911002200';

        $packetPatchedWithWitness = $this->captureResponse(
            static fn () => \ClinicalHistoryController::recordPatch([
                'isAdmin' => true,
            ]),
            'PATCH',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'consentPackets' => [$packet],
                'activeConsentPacketId' => $packetId,
            ]
        );

        self::assertSame(200, $packetPatchedWithWitness['status']);

        $denied = $this->captureResponse(
            static fn () => \ClinicalHistoryController::episodeActionPost([
                'isAdmin' => true,
            ]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'action' => 'deny_consent',
                'packetId' => $packetId,
            ]
        );

        self::assertSame(200, $denied['status']);
        self::assertSame(
            'declined',
            (string) ($denied['payload']['data']['consentPackets'][0]['status'] ?? '')
        );
        self::assertCount(1, $denied['payload']['data']['documents']['consentForms'] ?? []);

        $acceptedPacket = $denied['payload']['data']['consentPackets'][0] ?? [];
        $acceptedPacket['status'] = 'accepted';
        $acceptedPacket['denial']['declinedAt'] = '';
        $acceptedPacket['patientAttestation']['signedAt'] = '2026-03-16T10:35:00-05:00';
        $acceptedPacket['revocation']['receivedBy'] = '';

        $acceptedPatch = $this->captureResponse(
            static fn () => \ClinicalHistoryController::recordPatch([
                'isAdmin' => true,
            ]),
            'PATCH',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'consentPackets' => [$acceptedPacket],
                'activeConsentPacketId' => $packetId,
            ]
        );

        self::assertSame(200, $acceptedPatch['status']);

        $blockedRevocation = $this->captureResponse(
            static fn () => \ClinicalHistoryController::episodeActionPost([
                'isAdmin' => true,
            ]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'action' => 'revoke_consent',
                'packetId' => $packetId,
            ]
        );

        self::assertSame(409, $blockedRevocation['status']);
        self::assertSame(
            'clinical_consent_revocation_receiver_required',
            (string) ($blockedRevocation['payload']['code'] ?? '')
        );
    }

    private function buildAdmission001Payload(array $overrides = []): array
    {
        return array_replace_recursive([
            'identity' => [
                'documentType' => 'cedula',
                'documentNumber' => '0912345678',
                'apellidoPaterno' => 'Perez',
                'apellidoMaterno' => 'Lopez',
                'primerNombre' => 'Ana',
                'segundoNombre' => '',
            ],
            'demographics' => [
                'birthDate' => '1992-04-10',
                'ageYears' => 34,
                'sexAtBirth' => 'femenino',
                'maritalStatus' => 'soltera',
                'educationLevel' => 'superior',
                'occupation' => 'Paciente ambulatoria',
                'employer' => '',
                'nationalityCountry' => 'Ecuador',
                'culturalGroup' => '',
                'birthPlace' => 'Quito',
            ],
            'residence' => [
                'addressLine' => 'Av. Siempre Viva 123',
                'neighborhood' => 'Centro norte',
                'zoneType' => 'urban',
                'parish' => 'Inaquito',
                'canton' => 'Quito',
                'province' => 'Pichincha',
                'phone' => '0990001111',
            ],
            'coverage' => [
                'healthInsuranceType' => 'private',
            ],
            'referral' => [
                'referredBy' => 'Consulta espontanea',
            ],
            'emergencyContact' => [
                'name' => 'Contacto principal',
                'kinship' => 'Hermana',
                'phone' => '0981112233',
            ],
            'admissionMeta' => [
                'admissionDate' => '2026-03-15T08:45:00-05:00',
                'admissionKind' => 'first',
                'admittedBy' => 'Recepcion FlowOS',
                'transitionMode' => 'new_required',
            ],
        ], $overrides);
    }

    private function completeQueuedClinicalJob(string $jobId, array $envelope): void
    {
        $job = \figo_queue_read_job($jobId);
        self::assertIsArray($job);

        $job['status'] = 'completed';
        $job['updatedAt'] = date('c');
        $job['completedAt'] = date('c');
        $job['response'] = \figo_queue_build_completion(
            'clinical-intake',
            json_encode($envelope, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );
        unset($job['errorCode'], $job['errorMessage'], $job['failedAt'], $job['expiredAt']);

        self::assertTrue(\figo_queue_write_job($job));
    }

    private function enableClinicalStorageGate(): void
    {
        putenv('PIELARMONIA_REQUIRE_DATA_ENCRYPTION=1');
        putenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE=1');
        putenv('PIELARMONIA_DATA_ENCRYPTION_KEY');

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }
    }

    private function captureResponse(callable $callable, string $method = 'GET', ?array $body = null): array
    {
        $_SERVER['REQUEST_METHOD'] = strtoupper($method);

        if ($body !== null) {
            $GLOBALS['__TEST_JSON_BODY'] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            unset($GLOBALS['__TEST_JSON_BODY']);
        }

        try {
            $callable();
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            return [
                'payload' => is_array($exception->payload) ? $exception->payload : [],
                'status' => (int) $exception->status,
            ];
        }
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $entries = array_diff(scandir($dir) ?: [], ['.', '..']);
        foreach ($entries as $entry) {
            $path = $dir . DIRECTORY_SEPARATOR . $entry;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                @unlink($path);
            }
        }

        @rmdir($dir);
    }
}
