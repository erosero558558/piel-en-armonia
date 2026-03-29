<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class ClinicalHistoryAdminReadModelTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE']);

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'clinical-history-admin-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/AdminDataController.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_AVAILABILITY_SOURCE',
        ] as $key) {
            putenv($key);
        }

        if (function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_RESPONSE']);
    }

    public function testAdminDataIncludesClinicalHistorySummaryQueueAndEvents(): void
    {
        $store = \read_store();
        $store['appointments'] = [];
        $store['clinical_history_sessions'] = [[
            'id' => 901,
            'sessionId' => 'chs-admin-001',
            'caseId' => 'case-admin-001',
            'appointmentId' => 451,
            'surface' => 'waiting_room',
            'status' => 'review_required',
            'patient' => [
                'name' => 'Paciente Clinico',
                'email' => 'clinico@example.com',
                'phone' => '0990001111',
            ],
            'transcript' => [],
            'questionHistory' => [],
            'surfaces' => ['waiting_room'],
            'lastTurn' => [],
            'pendingAi' => [],
            'metadata' => [],
            'version' => 3,
            'createdAt' => '2026-03-11T10:00:00-05:00',
            'updatedAt' => '2026-03-11T10:15:00-05:00',
            'lastMessageAt' => '2026-03-11T10:12:00-05:00',
        ]];
        $store['clinical_history_drafts'] = [[
            'id' => 902,
            'draftId' => 'chd-admin-001',
            'sessionId' => 'chs-admin-001',
            'caseId' => 'case-admin-001',
            'appointmentId' => 451,
            'status' => 'review_required',
            'reviewStatus' => 'review_required',
            'requiresHumanReview' => true,
            'confidence' => 0.61,
            'reviewReasons' => ['dose_ambiguous', 'low_confidence'],
            'intake' => [
                'motivoConsulta' => 'Brotes faciales',
                'enfermedadActual' => 'Rosacea de varios meses',
                'antecedentes' => '',
                'alergias' => '',
                'medicacionActual' => '',
                'rosRedFlags' => [],
                'adjuntos' => [],
                'resumenClinico' => 'Cuadro cutaneo cronico.',
                'cie10Sugeridos' => [],
                'tratamientoBorrador' => '',
                'posologiaBorrador' => [
                    'texto' => '',
                    'baseCalculo' => '',
                    'pesoKg' => null,
                    'edadAnios' => null,
                    'units' => '',
                    'ambiguous' => true,
                ],
                'preguntasFaltantes' => ['alergias', 'antecedentes'],
                'datosPaciente' => [
                    'edadAnios' => 34,
                    'pesoKg' => 63,
                    'sexoBiologico' => 'femenino',
                    'embarazo' => false,
                ],
            ],
            'clinicianDraft' => [
                'resumen' => 'Rosacea facial en revision.',
                'preguntasFaltantes' => ['Alergias'],
                'cie10Sugeridos' => ['L71.9'],
                'tratamientoBorrador' => 'Considerar metronidazol topico',
                'posologiaBorrador' => [
                    'texto' => 'Aplicacion topica diaria',
                    'baseCalculo' => 'standard',
                    'pesoKg' => 63,
                    'edadAnios' => 34,
                    'units' => '',
                    'ambiguous' => true,
                ],
                'hcu005' => [
                    'evolutionNote' => 'Rosacea facial en revision.',
                    'diagnosticImpression' => 'Rosacea en control parcial.',
                    'therapeuticPlan' => '',
                    'careIndications' => '',
                    'prescriptionItems' => [[
                        'medication' => 'Metronidazol topico',
                        'presentation' => '',
                        'dose' => 'Aplicacion fina',
                        'route' => 'Topica',
                        'frequency' => '',
                        'duration' => '',
                        'quantity' => '',
                        'instructions' => '',
                    ]],
                ],
            ],
            'admission001' => [
                'identity' => [
                    'documentType' => 'cedula',
                    'documentNumber' => '0912345678',
                    'apellidoPaterno' => 'Clinico',
                    'apellidoMaterno' => '',
                    'primerNombre' => 'Paciente',
                    'segundoNombre' => '',
                ],
                'demographics' => [
                    'birthDate' => '1991-05-11',
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
                    'addressLine' => 'Av. Central 123',
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
                    'admissionDate' => '2026-03-11T09:45:00-05:00',
                    'admissionKind' => 'first',
                    'admittedBy' => 'Recepcion FlowOS',
                    'transitionMode' => 'new_required',
                ],
            ],
            'consentPackets' => [[
                'packetId' => 'consent-admin-001',
                'templateKey' => 'laser-dermatologico',
                'procedureKey' => 'laser-dermatologico',
                'procedureLabel' => 'Laser dermatologico',
                'title' => 'Consentimiento informado HCU-form.024/2008',
                'status' => 'draft',
                'writtenRequired' => true,
                'careMode' => 'ambulatorio',
                'serviceLabel' => 'Dermatologia ambulatoria',
                'establishmentLabel' => 'Piel Armonia',
                'patientName' => 'Paciente Clinico',
                'patientDocumentNumber' => '0912345678',
                'patientRecordId' => 'hcu-chs-admin-001',
                'encounterDateTime' => '2026-03-11T10:14:00-05:00',
                'diagnosisLabel' => 'Rosacea en control parcial.',
                'diagnosisCie10' => 'L71.9',
                'procedureName' => 'Aplicacion de laser dermatologico',
                'procedureWhatIsIt' => 'Aplicacion de energia luminica controlada.',
                'procedureHowItIsDone' => 'Aplicacion ambulatoria por protocolo.',
                'durationEstimate' => '20 minutos',
                'graphicRef' => '',
                'benefits' => 'Mejoria del cuadro cutaneo.',
                'frequentRisks' => 'Eritema y sensibilidad local.',
                'rareSeriousRisks' => 'Discromia persistente.',
                'patientSpecificRisks' => '',
                'alternatives' => 'Observacion y topicos.',
                'postProcedureCare' => 'Fotoproteccion y control posterior.',
                'noProcedureConsequences' => 'Persistencia del cuadro clinico.',
                'privateCommunicationConfirmed' => true,
                'companionShareAuthorized' => false,
                'declaration' => [
                    'declaredAt' => '2026-03-11T10:14:00-05:00',
                    'patientCanConsent' => true,
                    'capacityAssessment' => 'Paciente capaz de decidir',
                    'notes' => '',
                ],
                'denial' => [
                    'declinedAt' => '',
                    'reason' => '',
                    'patientRefusedSignature' => false,
                    'notes' => '',
                ],
                'revocation' => [
                    'revokedAt' => '',
                    'receivedBy' => '',
                    'reason' => '',
                    'notes' => '',
                ],
                'patientAttestation' => [
                    'name' => 'Paciente Clinico',
                    'documentNumber' => '0912345678',
                    'signedAt' => '',
                    'refusedSignature' => false,
                ],
                'representativeAttestation' => [
                    'name' => '',
                    'kinship' => '',
                    'documentNumber' => '',
                    'phone' => '',
                    'signedAt' => '',
                ],
                'professionalAttestation' => [
                    'name' => 'Dra. Laura Mena',
                    'role' => 'medico_tratante',
                    'documentNumber' => 'MED-024',
                    'signedAt' => '',
                ],
                'anesthesiologistAttestation' => [
                    'applicable' => false,
                    'name' => '',
                    'documentNumber' => '',
                    'signedAt' => '',
                ],
                'witnessAttestation' => [
                    'name' => '',
                    'documentNumber' => '',
                    'phone' => '',
                    'signedAt' => '',
                ],
                'history' => [],
                'createdAt' => '2026-03-11T10:12:00-05:00',
                'updatedAt' => '2026-03-11T10:16:00-05:00',
            ]],
            'activeConsentPacketId' => 'consent-admin-001',
            'interconsultations' => [[
                'interconsultId' => 'inter-admin-001',
                'status' => 'draft',
                'requiredForCurrentPlan' => true,
                'priority' => 'routine',
                'requestedAt' => '2026-03-11T10:13:00-05:00',
                'requestingEstablishment' => 'Piel Armonia',
                'requestingService' => 'Dermatologia ambulatoria',
                'destinationEstablishment' => 'Hospital dermatologico aliado',
                'destinationService' => 'Dermatologia clinica',
                'consultedProfessionalName' => 'Dr. Rafael Suarez',
                'clinicalPicture' => 'Rosacea facial de varios meses con respuesta parcial.',
                'requestReason' => 'Solicito valoracion complementaria del plan ambulatorio.',
                'diagnoses' => [[
                    'type' => 'pre',
                    'label' => 'Rosacea en control parcial.',
                    'cie10' => 'L71.9',
                ]],
                'performedDiagnosticsSummary' => 'Evaluacion clinica y fotografia de control.',
                'therapeuticMeasuresDone' => 'Metronidazol topico y medidas de cuidado cutaneo.',
                'questionForConsultant' => 'Confirmar conducta y prioridad del seguimiento.',
                'issuedBy' => 'Dra. Laura Mena',
                'issuedAt' => '',
                'cancelledAt' => '',
                'cancelReason' => '',
                'history' => [],
                'createdAt' => '2026-03-11T10:13:00-05:00',
                'updatedAt' => '2026-03-11T10:16:00-05:00',
            ]],
            'activeInterconsultationId' => 'inter-admin-001',
            'labOrders' => [[
                'labOrderId' => 'lab-admin-001',
                'status' => 'ready_to_issue',
                'requiredForCurrentPlan' => true,
                'priority' => 'routine',
                'requestedAt' => '2026-03-11T10:15:00-05:00',
                'sampleDate' => '2026-03-11',
                'requestingEstablishment' => 'Piel Armonia',
                'requestingService' => 'Dermatologia ambulatoria',
                'careSite' => 'Consulta externa',
                'bedLabel' => '',
                'requestedBy' => 'Dra. Laura Mena',
                'patientName' => 'Paciente Clinico',
                'patientDocumentNumber' => '0912345678',
                'patientRecordId' => 'hcu-chs-admin-001',
                'patientAgeYears' => 34,
                'patientSexAtBirth' => 'femenino',
                'diagnoses' => [[
                    'type' => 'pre',
                    'label' => 'Rosacea en control parcial.',
                    'cie10' => 'L71.9',
                ]],
                'studySelections' => [
                    'hematology' => ['Biometria hematica'],
                    'urinalysis' => [],
                    'coprological' => [],
                    'bloodChemistry' => [],
                    'serology' => [],
                    'bacteriology' => [],
                    'others' => '',
                ],
                'bacteriologySampleSource' => '',
                'physicianPresentAtExam' => false,
                'notes' => 'Solicitar biometria hematica de control.',
                'issuedAt' => '',
                'cancelledAt' => '',
                'cancelReason' => '',
                'history' => [],
                'createdAt' => '2026-03-11T10:15:00-05:00',
                'updatedAt' => '2026-03-11T10:16:00-05:00',
            ]],
            'activeLabOrderId' => 'lab-admin-001',
            'imagingOrders' => [[
                'imagingOrderId' => 'img-admin-001',
                'status' => 'ready_to_issue',
                'requiredForCurrentPlan' => true,
                'priority' => 'routine',
                'requestedAt' => '2026-03-11T10:16:00-05:00',
                'studyDate' => '2026-03-11',
                'requestingEstablishment' => 'Piel Armonia',
                'requestingService' => 'Dermatologia ambulatoria',
                'careSite' => 'Consulta externa',
                'bedLabel' => '',
                'requestedBy' => 'Dra. Laura Mena',
                'patientName' => 'Paciente Clinico',
                'patientDocumentNumber' => '0912345678',
                'patientRecordId' => 'hcu-chs-admin-001',
                'patientAgeYears' => 34,
                'patientSexAtBirth' => 'femenino',
                'diagnoses' => [[
                    'type' => 'pre',
                    'label' => 'Rosacea en control parcial.',
                    'cie10' => 'L71.9',
                ]],
                'studySelections' => [
                    'conventionalRadiography' => ['Rx de senos paranasales'],
                    'tomography' => [],
                    'magneticResonance' => [],
                    'ultrasound' => [],
                    'procedures' => [],
                    'others' => [],
                ],
                'requestReason' => 'Solicitar estudio de apoyo imagenologico.',
                'clinicalSummary' => 'Rosacea facial de control parcial con sintomas persistentes.',
                'canMobilize' => true,
                'canRemoveDressingsOrCasts' => true,
                'physicianPresentAtExam' => false,
                'bedsideRadiography' => false,
                'notes' => 'Coordinar radiografia convencional ambulatoria.',
                'issuedAt' => '',
                'cancelledAt' => '',
                'cancelReason' => '',
                'history' => [],
                'createdAt' => '2026-03-11T10:16:00-05:00',
                'updatedAt' => '2026-03-11T10:16:00-05:00',
            ]],
            'activeImagingOrderId' => 'img-admin-001',
            'recordMeta' => [
                'archiveState' => 'active',
                'lastAttentionAt' => '2020-03-10T10:00:00-05:00',
                'passiveAfterYears' => 5,
                'confidentialityLabel' => 'CONFIDENCIAL',
                'identityProtectionMode' => 'standard',
                'copyDeliverySlaHours' => 48,
                'formsCatalogStatus' => 'official_partial_traceability',
            ],
            'copyRequests' => [[
                'requestId' => 'copy-admin-001',
                'requestedByType' => 'patient',
                'requestedByName' => 'Paciente Clinico',
                'requestedAt' => '2026-03-11T08:00:00-05:00',
                'dueAt' => '2026-03-11T20:00:00-05:00',
                'status' => 'requested',
                'legalBasis' => '',
                'notes' => 'Solicita copia certificada.',
                'deliveredAt' => '',
                'deliveryChannel' => '',
                'deliveredTo' => '',
            ]],
            'disclosureLog' => [[
                'disclosureId' => 'disclosure-admin-001',
                'targetType' => 'patient',
                'targetName' => 'Paciente Clinico',
                'purpose' => 'Entrega de indicaciones',
                'legalBasis' => '',
                'authorizedByConsent' => false,
                'performedBy' => 'Dra. Laura Mena',
                'performedAt' => '2026-03-11T10:17:00-05:00',
                'channel' => 'entrega_privada',
                'notes' => '',
            ]],
            'lastAiEnvelope' => [
                'redFlags' => ['rosacea_flare'],
            ],
            'pendingAi' => [],
            'version' => 2,
            'createdAt' => '2026-03-11T10:00:00-05:00',
            'updatedAt' => '2026-03-11T10:16:00-05:00',
        ]];
        $store['clinical_history_events'] = [[
            'id' => 903,
            'eventId' => 'che-admin-001',
            'sessionId' => 'chs-admin-001',
            'caseId' => 'case-admin-001',
            'appointmentId' => 451,
            'type' => 'draft_reconciled',
            'severity' => 'warning',
            'status' => 'open',
            'title' => 'Historia clinica reconciliada y lista para revision',
            'message' => 'El borrador clinico se completo y requiere validacion del medico.',
            'requiresAction' => true,
            'jobId' => 'job-admin-001',
            'dedupeKey' => 'clinical_history|draft_reconciled|chs-admin-001|job-admin-001',
            'patient' => [
                'name' => 'Paciente Clinico',
                'email' => 'clinico@example.com',
                'phone' => '0990001111',
            ],
            'metadata' => [
                'reason' => 'queued_completion_reconciled',
            ],
            'createdAt' => '2026-03-11T10:16:00-05:00',
            'updatedAt' => '2026-03-11T10:16:00-05:00',
            'occurredAt' => '2026-03-11T10:16:00-05:00',
            'acknowledgedAt' => '',
            'resolvedAt' => '',
        ], [
            'id' => 904,
            'eventId' => 'che-admin-002',
            'sessionId' => 'chs-admin-001',
            'caseId' => 'case-admin-001',
            'appointmentId' => 451,
            'type' => 'clinical_alert',
            'severity' => 'critical',
            'status' => 'open',
            'title' => 'Alerta clinica abierta',
            'message' => 'Persisten hallazgos que requieren triage prioritario.',
            'requiresAction' => true,
            'jobId' => 'job-admin-002',
            'dedupeKey' => 'clinical_history|clinical_alert|chs-admin-001|job-admin-002',
            'patient' => [
                'name' => 'Paciente Clinico',
                'email' => 'clinico@example.com',
                'phone' => '0990001111',
            ],
            'metadata' => [
                'reason' => 'critical_follow_up_required',
            ],
            'createdAt' => '2026-03-11T10:18:00-05:00',
            'updatedAt' => '2026-03-11T10:18:00-05:00',
            'occurredAt' => '2026-03-11T10:18:00-05:00',
            'acknowledgedAt' => '',
            'resolvedAt' => '',
        ]];
        \write_store($store, false);

        try {
            \AdminDataController::index([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
            self::fail('Se esperaba TestingExitException');
        } catch (\TestingExitException $e) {
            $payload = $e->payload;
        }

        self::assertTrue((bool) ($payload['ok'] ?? false));
        self::assertArrayHasKey('clinicalHistoryMeta', $payload['data']);

        $meta = $payload['data']['clinicalHistoryMeta'];
        self::assertSame(1, (int) ($meta['summary']['drafts']['reviewQueueCount'] ?? -1));
        self::assertSame(2, (int) ($meta['summary']['events']['openCount'] ?? -1));
        self::assertSame(2, (int) ($meta['summary']['events']['unreadCount'] ?? -1));
        self::assertSame(1, (int) ($meta['summary']['recordsGovernance']['pendingCopyRequests'] ?? -1));
        self::assertSame(1, (int) ($meta['summary']['recordsGovernance']['overdueCopyRequests'] ?? -1));
        self::assertSame(1, (int) ($meta['summary']['recordsGovernance']['disclosures'] ?? -1));
        self::assertSame(1, (int) ($meta['summary']['recordsGovernance']['archiveEligible'] ?? -1));
        self::assertSame(1, (int) ($meta['summary']['drafts']['hcu001']['complete'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu001']['partial'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu001']['legacy_partial'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu001']['missing'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu005']['complete'] ?? -1));
        self::assertSame(1, (int) ($meta['summary']['drafts']['hcu005']['partial'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu005']['missing'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu007']['issued'] ?? -1));
        self::assertSame(1, (int) ($meta['summary']['drafts']['hcu007']['ready_to_issue'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu007']['cancelled'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu007']['incomplete'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu007']['draft'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu010A']['issued'] ?? -1));
        self::assertSame(1, (int) ($meta['summary']['drafts']['hcu010A']['ready_to_issue'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu010A']['cancelled'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu010A']['incomplete'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu010A']['draft'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu012A']['issued'] ?? -1));
        self::assertSame(1, (int) ($meta['summary']['drafts']['hcu012A']['ready_to_issue'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu012A']['cancelled'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu012A']['incomplete'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu012A']['draft'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu024']['accepted'] ?? -1));
        self::assertSame(1, (int) ($meta['summary']['drafts']['hcu024']['draft'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu024']['declined'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu024']['revoked'] ?? -1));
        self::assertSame('critical', (string) ($meta['summary']['diagnostics']['status'] ?? ''));
        self::assertCount(1, $meta['reviewQueue'] ?? []);
        self::assertSame('Paciente Clinico', (string) ($meta['reviewQueue'][0]['patientName'] ?? ''));
        self::assertSame(['dose_ambiguous', 'low_confidence'], $meta['reviewQueue'][0]['reviewReasons'] ?? []);
        self::assertSame(2, (int) ($meta['reviewQueue'][0]['openEventCount'] ?? -1));
        self::assertSame('critical', (string) ($meta['reviewQueue'][0]['highestOpenSeverity'] ?? ''));
        self::assertSame('Alerta clinica abierta', (string) ($meta['reviewQueue'][0]['latestOpenEventTitle'] ?? ''));
        self::assertSame('blocked', (string) ($meta['reviewQueue'][0]['legalReadinessStatus'] ?? ''));
        self::assertSame('Bloqueada', (string) ($meta['reviewQueue'][0]['legalReadinessLabel'] ?? ''));
        self::assertSame('complete', (string) ($meta['reviewQueue'][0]['hcu001Status'] ?? ''));
        self::assertSame('HCU-001 completa', (string) ($meta['reviewQueue'][0]['hcu001Label'] ?? ''));
        self::assertSame('partial', (string) ($meta['reviewQueue'][0]['hcu005Status'] ?? ''));
        self::assertSame('HCU-005 parcial', (string) ($meta['reviewQueue'][0]['hcu005Label'] ?? ''));
        self::assertSame('ready_to_issue', (string) ($meta['reviewQueue'][0]['hcu007Status'] ?? ''));
        self::assertSame('HCU-007 lista para emitir', (string) ($meta['reviewQueue'][0]['hcu007Label'] ?? ''));
        self::assertSame('ready_to_issue', (string) ($meta['reviewQueue'][0]['hcu010AStatus'] ?? ''));
        self::assertSame('HCU-010A lista para emitir', (string) ($meta['reviewQueue'][0]['hcu010ALabel'] ?? ''));
        self::assertSame('ready_to_issue', (string) ($meta['reviewQueue'][0]['hcu012AStatus'] ?? ''));
        self::assertSame('HCU-012A lista para emitir', (string) ($meta['reviewQueue'][0]['hcu012ALabel'] ?? ''));
        self::assertSame('draft', (string) ($meta['reviewQueue'][0]['hcu024Status'] ?? ''));
        self::assertSame('HCU-024 borrador', (string) ($meta['reviewQueue'][0]['hcu024Label'] ?? ''));
        self::assertSame(1, (int) ($meta['reviewQueue'][0]['pendingCopyRequests'] ?? -1));
        self::assertSame(1, (int) ($meta['reviewQueue'][0]['overdueCopyRequests'] ?? -1));
        self::assertSame(1, (int) ($meta['reviewQueue'][0]['disclosureCount'] ?? -1));
        self::assertTrue((bool) ($meta['reviewQueue'][0]['archiveEligibleForPassive'] ?? false));
        self::assertNotEmpty($meta['reviewQueue'][0]['approvalBlockedReasons'] ?? []);
        self::assertCount(2, $meta['events'] ?? []);
        self::assertSame(
            ['clinical_alert', 'draft_reconciled'],
            array_values(array_map(
                static fn (array $event): string => (string) ($event['type'] ?? ''),
                $meta['events'] ?? []
            ))
        );
        self::assertSame(
            ['critical', 'warning'],
            array_values(array_map(
                static fn (array $event): string => (string) ($event['severity'] ?? ''),
                $meta['events'] ?? []
            ))
        );
        self::assertSame(
            ['open', 'open'],
            array_values(array_map(
                static fn (array $event): string => (string) ($event['status'] ?? ''),
                $meta['events'] ?? []
            ))
        );
    }

    public function testAdminDataSummarizesReceivedInterconsultReport(): void
    {
        $store = \read_store();
        $store['appointments'] = [];
        $store['clinical_history_sessions'] = [[
            'id' => 911,
            'sessionId' => 'chs-admin-007-report',
            'caseId' => 'case-admin-007-report',
            'appointmentId' => 452,
            'surface' => 'waiting_room',
            'status' => 'review_required',
            'patient' => [
                'name' => 'Paciente Reporte',
                'email' => 'reporte@example.com',
                'phone' => '0990002222',
            ],
            'transcript' => [],
            'questionHistory' => [],
            'surfaces' => ['waiting_room'],
            'lastTurn' => [],
            'pendingAi' => [],
            'metadata' => [],
            'version' => 2,
            'createdAt' => '2026-03-16T09:00:00-05:00',
            'updatedAt' => '2026-03-16T10:10:00-05:00',
            'lastMessageAt' => '2026-03-16T10:05:00-05:00',
        ]];
        $store['clinical_history_drafts'] = [[
            'id' => 912,
            'draftId' => 'chd-admin-007-report',
            'sessionId' => 'chs-admin-007-report',
            'caseId' => 'case-admin-007-report',
            'appointmentId' => 452,
            'status' => 'review_required',
            'reviewStatus' => 'review_required',
            'requiresHumanReview' => true,
            'confidence' => 0.83,
            'reviewReasons' => [],
            'intake' => [
                'motivoConsulta' => 'Rosacea facial',
                'enfermedadActual' => 'Seguimiento ambulatorio con criterio externo.',
                'antecedentes' => 'Sin antecedentes relevantes',
                'alergias' => 'Niega alergias',
                'medicacionActual' => '',
                'rosRedFlags' => [],
                'adjuntos' => [],
                'resumenClinico' => 'Caso en seguimiento.',
                'cie10Sugeridos' => ['L71.9'],
                'tratamientoBorrador' => '',
                'posologiaBorrador' => [
                    'texto' => 'Aplicacion nocturna',
                    'baseCalculo' => 'standard',
                    'pesoKg' => 58,
                    'edadAnios' => 34,
                    'units' => '',
                    'ambiguous' => false,
                ],
                'preguntasFaltantes' => [],
                'datosPaciente' => [
                    'edadAnios' => 34,
                    'pesoKg' => 58,
                    'sexoBiologico' => 'femenino',
                    'embarazo' => false,
                ],
            ],
            'clinicianDraft' => [
                'resumen' => 'Interconsulta emitida con informe recibido.',
                'preguntasFaltantes' => [],
                'cie10Sugeridos' => ['L71.9'],
                'tratamientoBorrador' => 'Metronidazol topico',
                'posologiaBorrador' => [
                    'texto' => 'Aplicacion nocturna',
                    'baseCalculo' => 'standard',
                    'pesoKg' => 58,
                    'edadAnios' => 34,
                    'units' => '',
                    'ambiguous' => false,
                ],
                'hcu005' => [
                    'evolutionNote' => 'Seguimiento ambulatorio con criterio externo recibido.',
                    'diagnosticImpression' => 'Rosacea inflamatoria en control parcial.',
                    'therapeuticPlan' => 'Mantener manejo topico y seguimiento.',
                    'careIndications' => 'Fotoproteccion y vigilancia de desencadenantes.',
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
            'admission001' => [
                'identity' => [
                    'documentType' => 'cedula',
                    'documentNumber' => '0912345678',
                    'apellidoPaterno' => 'Reporte',
                    'apellidoMaterno' => '',
                    'primerNombre' => 'Paciente',
                    'segundoNombre' => '',
                ],
                'demographics' => [
                    'birthDate' => '1991-05-11',
                    'ageYears' => 34,
                    'sexAtBirth' => 'femenino',
                ],
                'residence' => [
                    'phone' => '0990002222',
                ],
                'coverage' => [
                    'healthInsuranceType' => 'private',
                ],
                'emergencyContact' => [
                    'name' => 'Contacto principal',
                    'kinship' => 'Hermana',
                    'phone' => '0981112233',
                ],
                'admissionMeta' => [
                    'admissionDate' => '2026-03-16T09:00:00-05:00',
                    'admissionKind' => 'first',
                    'admittedBy' => 'Recepcion FlowOS',
                    'transitionMode' => 'new_required',
                ],
            ],
            'consentPackets' => [],
            'activeConsentPacketId' => '',
            'interconsultations' => [[
                'interconsultId' => 'inter-admin-007-report',
                'status' => 'issued',
                'reportStatus' => 'received',
                'requiredForCurrentPlan' => true,
                'priority' => 'routine',
                'requestedAt' => '2026-03-16T09:20:00-05:00',
                'requestingEstablishment' => 'Piel Armonia',
                'requestingService' => 'Dermatologia ambulatoria',
                'destinationEstablishment' => 'Hospital dermatologico aliado',
                'destinationService' => 'Dermatologia clinica',
                'consultedProfessionalName' => 'Dr. Rafael Suarez',
                'clinicalPicture' => 'Rosacea facial de varios meses con respuesta parcial.',
                'requestReason' => 'Solicito valoracion complementaria del plan ambulatorio.',
                'diagnoses' => [[
                    'type' => 'pre',
                    'label' => 'Rosacea en control parcial.',
                    'cie10' => 'L71.9',
                ]],
                'performedDiagnosticsSummary' => 'Evaluacion clinica y fotografia de control.',
                'therapeuticMeasuresDone' => 'Metronidazol topico y medidas de cuidado cutaneo.',
                'questionForConsultant' => 'Confirmar conducta y prioridad del seguimiento.',
                'issuedBy' => 'Dra. Laura Mena',
                'issuedAt' => '2026-03-16T09:30:00-05:00',
                'cancelledAt' => '',
                'cancelReason' => '',
                'report' => [
                    'status' => 'received',
                    'reportedAt' => '2026-03-16T10:00:00-05:00',
                    'reportedBy' => 'Lic. Andrea Paredes',
                    'receivedBy' => 'Dra. Laura Mena',
                    'respondingEstablishment' => 'Hospital dermatologico aliado',
                    'respondingService' => 'Dermatologia clinica',
                    'consultantProfessionalName' => 'Dr. Rafael Suarez',
                    'consultantProfessionalRole' => 'Dermatologo',
                    'reportSummary' => 'Criterio complementario recibido.',
                    'clinicalFindings' => 'Rosacea inflamatoria en control parcial, sin signos de alarma.',
                    'diagnosticOpinion' => 'Mantener manejo ambulatorio.',
                    'recommendations' => 'Continuar manejo topico y reevaluar en 4 semanas.',
                    'followUpIndications' => 'Control si hay recrudecimiento.',
                    'sourceDocumentType' => 'nota_especialista',
                    'sourceReference' => 'INT-007-2026',
                    'attachments' => [],
                    'history' => [],
                ],
                'history' => [],
                'createdAt' => '2026-03-16T09:20:00-05:00',
                'updatedAt' => '2026-03-16T10:00:00-05:00',
            ]],
            'activeInterconsultationId' => 'inter-admin-007-report',
            'recordMeta' => [
                'archiveState' => 'active',
                'lastAttentionAt' => '2026-03-16T10:00:00-05:00',
                'passiveAfterYears' => 5,
                'confidentialityLabel' => 'CONFIDENCIAL',
                'identityProtectionMode' => 'standard',
                'copyDeliverySlaHours' => 48,
                'formsCatalogStatus' => 'official_partial_traceability',
            ],
            'copyRequests' => [],
            'disclosureLog' => [],
            'lastAiEnvelope' => [],
            'pendingAi' => [],
            'version' => 2,
            'createdAt' => '2026-03-16T09:00:00-05:00',
            'updatedAt' => '2026-03-16T10:00:00-05:00',
        ]];
        $store['clinical_history_events'] = [];
        \write_store($store, false);

        try {
            \AdminDataController::index([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
            self::fail('Se esperaba TestingExitException');
        } catch (\TestingExitException $e) {
            $payload = $e->payload;
        }

        self::assertTrue((bool) ($payload['ok'] ?? false));
        $meta = $payload['data']['clinicalHistoryMeta'] ?? [];
        self::assertSame(1, (int) ($meta['summary']['drafts']['hcu007']['received'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu007']['issued'] ?? -1));
        self::assertSame('received', (string) ($meta['reviewQueue'][0]['hcu007Status'] ?? ''));
        self::assertSame('HCU-007 informe recibido', (string) ($meta['reviewQueue'][0]['hcu007Label'] ?? ''));
    }

    public function testAdminDataSummarizesReceivedImagingReport(): void
    {
        $store = \read_store();
        $store['appointments'] = [];
        $store['clinical_history_sessions'] = [[
            'id' => 912,
            'sessionId' => 'chs-admin-012a-report',
            'caseId' => 'case-admin-012a-report',
            'appointmentId' => 453,
            'surface' => 'waiting_room',
            'status' => 'review_required',
            'patient' => [
                'name' => 'Paciente Imagen',
                'email' => 'imagen@example.com',
                'phone' => '0990003333',
            ],
            'transcript' => [],
            'questionHistory' => [],
            'surfaces' => ['waiting_room'],
            'lastTurn' => [],
            'pendingAi' => [],
            'metadata' => [],
            'version' => 2,
            'createdAt' => '2026-03-16T11:00:00-05:00',
            'updatedAt' => '2026-03-16T12:15:00-05:00',
            'lastMessageAt' => '2026-03-16T12:10:00-05:00',
        ]];
        $store['clinical_history_drafts'] = [[
            'id' => 913,
            'draftId' => 'chd-admin-012a-report',
            'sessionId' => 'chs-admin-012a-report',
            'caseId' => 'case-admin-012a-report',
            'appointmentId' => 453,
            'status' => 'review_required',
            'reviewStatus' => 'review_required',
            'requiresHumanReview' => true,
            'confidence' => 0.84,
            'reviewReasons' => [],
            'intake' => [
                'motivoConsulta' => 'Dolor facial persistente',
                'enfermedadActual' => 'Dolor facial en estudio con apoyo de imagenologia.',
                'antecedentes' => 'Niega antecedentes relevantes.',
                'alergias' => 'Niega alergias medicamentosas.',
                'preguntasFaltantes' => [],
                'datosPaciente' => [
                    'edadAnios' => 39,
                    'pesoKg' => 64,
                    'sexoBiologico' => 'femenino',
                    'embarazo' => false,
                ],
            ],
            'clinicianDraft' => [
                'summary' => 'Se solicita imagenologia y ya se recibio el resultado radiologico.',
                'followUpQuestion' => '',
                'missingDataRequest' => '',
                'hcu005' => [
                    'evolutionNote' => 'Persisten sintomas faciales sin datos de alarma clinica.',
                    'diagnosticImpression' => 'Rosacea en seguimiento con dolor facial asociado.',
                    'therapeuticPlan' => 'Continuar seguimiento dermatologico y correlacionar con imagen.',
                    'careIndications' => 'Mantener medidas de cuidado facial y controles ambulatorios.',
                    'prescriptionItems' => [],
                ],
            ],
            'documents' => [
                'finalNote' => [
                    'summary' => 'Control dermatologico con imagenologia recibida.',
                    'content' => "Evolucion clinica: Persisten sintomas faciales sin datos de alarma clinica.\n\nImpresion diagnostica: Rosacea en seguimiento con dolor facial asociado.\n\nPlan terapeutico: Continuar seguimiento dermatologico y correlacionar con imagen.\n\nIndicaciones / cuidados: Mantener medidas de cuidado facial y controles ambulatorios.",
                    'sections' => [
                        'hcu005' => [
                            'evolutionNote' => 'Persisten sintomas faciales sin datos de alarma clinica.',
                            'diagnosticImpression' => 'Rosacea en seguimiento con dolor facial asociado.',
                            'therapeuticPlan' => 'Continuar seguimiento dermatologico y correlacionar con imagen.',
                            'careIndications' => 'Mantener medidas de cuidado facial y controles ambulatorios.',
                        ],
                    ],
                ],
            ],
            'admission001' => [
                'identity' => [
                    'documentType' => 'cedula',
                    'documentNumber' => '0912345680',
                    'apellidoPaterno' => 'Imagen',
                    'apellidoMaterno' => '',
                    'primerNombre' => 'Paciente',
                    'segundoNombre' => '',
                ],
                'demographics' => [
                    'birthDate' => '1986-08-14',
                    'ageYears' => 39,
                    'sexAtBirth' => 'femenino',
                ],
                'residence' => [
                    'phone' => '0990003333',
                ],
                'coverage' => [
                    'healthInsuranceType' => 'private',
                ],
                'emergencyContact' => [
                    'name' => 'Contacto Imagen',
                    'kinship' => 'Hermano',
                    'phone' => '0981112244',
                ],
                'admissionMeta' => [
                    'admissionDate' => '2026-03-16T11:00:00-05:00',
                    'admissionKind' => 'first',
                    'admittedBy' => 'Recepcion FlowOS',
                    'transitionMode' => 'new_required',
                ],
            ],
            'interconsultations' => [],
            'activeInterconsultationId' => '',
            'labOrders' => [],
            'activeLabOrderId' => '',
            'imagingOrders' => [[
                'imagingOrderId' => 'img-admin-012a-report',
                'status' => 'issued',
                'resultStatus' => 'received',
                'requiredForCurrentPlan' => true,
                'priority' => 'routine',
                'requestedAt' => '2026-03-16T11:20:00-05:00',
                'studyDate' => '2026-03-16',
                'requestingEstablishment' => 'Piel Armonia',
                'requestingService' => 'Dermatologia ambulatoria',
                'careSite' => 'consulta_externa',
                'bedLabel' => '',
                'requestedBy' => 'Dra. Laura Mena',
                'patientName' => 'Paciente Imagen',
                'patientDocumentNumber' => '0912345680',
                'patientRecordId' => 'hcu-admin-012a-report',
                'patientAgeYears' => 39,
                'patientSexAtBirth' => 'femenino',
                'diagnoses' => [[
                    'type' => 'pre',
                    'label' => 'Rosacea con dolor facial en estudio.',
                    'cie10' => 'L71.9',
                ]],
                'studySelections' => [
                    'conventionalRadiography' => ['Rx de senos paranasales'],
                    'tomography' => [],
                    'magneticResonance' => [],
                    'ultrasound' => [],
                    'procedures' => [],
                    'others' => [],
                ],
                'requestReason' => 'Apoyo diagnostico por imagen.',
                'clinicalSummary' => 'Dolor facial persistente en seguimiento ambulatorio.',
                'canMobilize' => true,
                'canRemoveDressingsOrCasts' => true,
                'physicianPresentAtExam' => false,
                'bedsideRadiography' => false,
                'notes' => '',
                'cancelledAt' => '',
                'cancelReason' => '',
                'result' => [
                    'status' => 'received',
                    'reportedAt' => '2026-03-16T12:00:00-05:00',
                    'reportedBy' => 'Lic. Andrea Paredes',
                    'receivedBy' => 'Dra. Laura Mena',
                    'reportingEstablishment' => 'Centro de imagen aliado',
                    'reportingService' => 'Radiologia',
                    'radiologistProfessionalName' => 'Dr. Rafael Suarez',
                    'radiologistProfessionalRole' => 'Radiologo',
                    'studyPerformedSummary' => 'Radiografia de senos paranasales AP y lateral.',
                    'findings' => 'Sin opacidades agudas. Engrosamiento mucoso leve en seno maxilar derecho.',
                    'diagnosticImpression' => 'Cambios inflamatorios leves sin hallazgos de alarma.',
                    'recommendations' => 'Correlacion clinica y seguimiento ambulatorio.',
                    'followUpIndications' => 'Repetir estudio si persiste dolor o aparecen signos de alarma.',
                    'sourceDocumentType' => 'informe_radiologico',
                    'sourceReference' => 'IMG-012A-2026',
                    'attachments' => [],
                    'history' => [],
                ],
                'history' => [],
                'createdAt' => '2026-03-16T11:20:00-05:00',
                'updatedAt' => '2026-03-16T12:00:00-05:00',
            ]],
            'activeImagingOrderId' => 'img-admin-012a-report',
            'consentPackets' => [],
            'activeConsentPacketId' => '',
            'recordMeta' => [
                'archiveState' => 'active',
                'lastAttentionAt' => '2026-03-16T12:00:00-05:00',
                'passiveAfterYears' => 5,
                'confidentialityLabel' => 'CONFIDENCIAL',
                'identityProtectionMode' => 'standard',
                'copyDeliverySlaHours' => 48,
                'formsCatalogStatus' => 'official_partial_traceability',
            ],
            'copyRequests' => [],
            'disclosureLog' => [],
            'lastAiEnvelope' => [],
            'pendingAi' => [],
            'version' => 2,
            'createdAt' => '2026-03-16T11:00:00-05:00',
            'updatedAt' => '2026-03-16T12:00:00-05:00',
        ]];
        $store['clinical_history_events'] = [];
        \write_store($store, false);

        try {
            \AdminDataController::index([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
            self::fail('Se esperaba TestingExitException');
        } catch (\TestingExitException $e) {
            $payload = $e->payload;
        }

        self::assertTrue((bool) ($payload['ok'] ?? false));
        $meta = $payload['data']['clinicalHistoryMeta'] ?? [];
        self::assertSame(1, (int) ($meta['summary']['drafts']['hcu012A']['received'] ?? -1));
        self::assertSame(0, (int) ($meta['summary']['drafts']['hcu012A']['issued'] ?? -1));
        self::assertSame('received', (string) ($meta['reviewQueue'][0]['hcu012AStatus'] ?? ''));
        self::assertSame('HCU-012A resultado recibido', (string) ($meta['reviewQueue'][0]['hcu012ALabel'] ?? ''));
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
