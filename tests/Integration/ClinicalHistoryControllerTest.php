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

        self::assertSame('blocked', (string) ($review['payload']['data']['legalReadiness']['status'] ?? ''));
        self::assertSame(
            'missing_minimum_clinical_data',
            (string) ($review['payload']['data']['approvalBlockedReasons'][0]['code'] ?? '')
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
                    ],
                ],
                'documents' => [
                    'prescription' => [
                        'medication' => 'Prednisona',
                        'directions' => '20 mg cada 12 horas por 5 dias',
                    ],
                ],
                'requiresHumanReview' => false,
            ]
        );

        self::assertSame(200, $recordPatch['status']);
        self::assertSame('ready', (string) ($recordPatch['payload']['data']['legalReadiness']['status'] ?? ''));

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
                    ],
                ],
                'documents' => [
                    'prescription' => [
                        'medication' => 'Metronidazol topico',
                        'directions' => 'Aplicacion nocturna por 8 semanas',
                    ],
                ],
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
            'consent_incomplete',
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
                    ],
                ],
                'documents' => [
                    'prescription' => [
                        'medication' => 'Emoliente',
                        'directions' => 'Aplicacion local dos veces al dia',
                    ],
                ],
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
        self::assertSame('edit_record', (string) ($recordPatch['payload']['data']['accessAudit'][0]['action'] ?? ''));

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
                    ],
                ],
                'documents' => [
                    'prescription' => [
                        'medication' => 'Retinoide topico',
                        'directions' => 'Aplicacion nocturna por 8 semanas',
                    ],
                ],
                'requiresHumanReview' => false,
            ]
        );

        self::assertSame(200, $recordPatch['status']);
        self::assertSame('ready', (string) ($recordPatch['payload']['data']['legalReadiness']['status'] ?? ''));

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
