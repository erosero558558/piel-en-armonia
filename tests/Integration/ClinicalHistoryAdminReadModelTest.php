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
