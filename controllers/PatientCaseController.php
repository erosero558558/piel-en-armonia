<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/case/PatientCaseQueryService.php';


require_once __DIR__ . '/../lib/PatientCaseService.php';
require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';
require_once __DIR__ . '/../lib/LeadOpsService.php';
require_once __DIR__ . '/../lib/email.php';
require_once __DIR__ . '/../lib/models.php';
require_once __DIR__ . '/../lib/validation.php';
require_once __DIR__ . '/../lib/telemedicine/ClinicalMediaService.php';

final class PatientCaseController
{
    public static function index(array $context): void
    {
        $service = new PatientCaseService();
        $caseId = trim((string) ($_GET['caseId'] ?? ($_GET['case_id'] ?? '')));
        $readiness = function_exists('internal_console_readiness_snapshot')
            ? internal_console_readiness_snapshot()
            : null;
        $clinicalReady = function_exists('internal_console_clinical_data_ready')
            ? internal_console_clinical_data_ready($readiness)
            : (bool) ($readiness['clinicalData']['ready'] ?? true);

        if (!$clinicalReady) {
            $payload = function_exists('internal_console_clinical_guard_payload')
                ? internal_console_clinical_guard_payload([
                    'data' => [
                        'cases' => [],
                        'timeline' => [],
                        'selectedCaseId' => $caseId !== '' ? $caseId : null,
                    ],
                ])
                : [
                    'ok' => false,
                    'code' => 'clinical_storage_not_ready',
                    'error' => 'Historias clinicas bloqueadas hasta habilitar almacenamiento cifrado.',
                    'readiness' => $readiness,
                    'data' => [
                        'cases' => [],
                        'timeline' => [],
                        'selectedCaseId' => $caseId !== '' ? $caseId : null,
                    ],
                ];

            json_response($payload, 409);
        }

        if ($caseId !== '') {
            require_once __DIR__ . '/../lib/DataAccessAudit.php';
            DataAccessAudit::logAccess('patient_case', $caseId);
        }

        json_response([
            'ok' => true,
            'data' => $service->buildReadModel(
                is_array($context['store'] ?? null) ? $context['store'] : [],
                $caseId !== '' ? $caseId : null
            ),
        ]);
    }

    public static function search(array $context): void
    {
        $q = trim((string) ($_GET['q'] ?? ''));
        if ($q === '') {
            json_response(['ok' => true, 'data' => []]);
        }
        
        // UI3-08 Mock data for frontend UI testing
        $mockResults = [
            [
                'id' => 'pt-001',
                'name' => 'Juan Garcia',
                'document' => '1712345678',
                'lastVisit' => '2026-03-25',
                'avatarUrl' => null
            ],
            [
                'id' => 'pt-002',
                'name' => 'Maria Silva',
                'document' => '0923456781',
                'lastVisit' => '2025-11-10',
                'avatarUrl' => null
            ]
        ];
        
        $filtered = array_values(array_filter($mockResults, function($pt) use ($q) {
            return stripos($pt['name'], $q) !== false || stripos($pt['document'], $q) !== false;
        }));
        
        json_response(['ok' => true, 'data' => $filtered]);
    }

    public static function store(array $context): void
    {
        require_rate_limit('public-preconsultation', 4, 60);

        $payload = require_json_body();
        $name = truncate_field(sanitize_xss(trim((string) ($payload['name'] ?? ''))), 150);
        $whatsapp = truncate_field(sanitize_phone((string) ($payload['whatsapp'] ?? ($payload['phone'] ?? ''))), 20);
        $skinType = self::normalizeSkinType((string) ($payload['skinType'] ?? ''));
        $condition = truncate_field(sanitize_xss(trim((string) ($payload['condition'] ?? ($payload['concern'] ?? '')))), 1000);
        $privacyConsent = isset($payload['privacyConsent']) ? parse_bool($payload['privacyConsent']) : false;
        $photoPaths = normalize_string_list($payload['casePhotoPaths'] ?? [], 3, 500);
        $photoNames = normalize_string_list($payload['casePhotoNames'] ?? [], 3, 200);

        if ($name === '') {
            json_response(['ok' => false, 'error' => 'Nombre obligatorio'], 400);
        }

        if ($whatsapp === '') {
            json_response(['ok' => false, 'error' => 'WhatsApp obligatorio'], 400);
        }

        if (!validate_phone($whatsapp)) {
            json_response(['ok' => false, 'error' => 'El formato de WhatsApp no es válido'], 400);
        }

        if ($skinType === '') {
            json_response(['ok' => false, 'error' => 'Tipo de piel obligatorio'], 400);
        }

        if ($condition === '') {
            json_response(['ok' => false, 'error' => 'Condición o motivo obligatorio'], 400);
        }

        if (!$privacyConsent) {
            json_response(['ok' => false, 'error' => 'Debe aceptar el tratamiento de datos clínicos'], 400);
        }

        if ($photoPaths !== []) {
            self::requireClinicalStorageReady([
                'surface' => 'patient_case_intake',
                'casePhotoCount' => count($photoPaths),
            ]);
        }

        $result = with_store_lock(static function () use ($name, $whatsapp, $skinType, $condition, $privacyConsent, $photoPaths, $photoNames): array {
            $patientCaseService = new PatientCaseService();
            $store = $patientCaseService->hydrateStore(read_store());
            $tenantId = self::resolveTenantId($store);
            $patientId = self::buildPatientId($tenantId, $whatsapp);
            $now = local_date('c');

            $caseIndex = self::findReusableOpenCaseIndex($store, $tenantId, $patientId);
            $isNewCase = $caseIndex === null;
            $caseId = $isNewCase
                ? self::buildEntityId('pc', [$tenantId, $patientId, $now, bin2hex(random_bytes(4))])
                : (string) ($store['patient_cases'][$caseIndex]['id'] ?? '');

            if ($caseId === '') {
                return [
                    'ok' => false,
                    'error' => 'No se pudo preparar el caso clínico',
                    'code' => 500,
                ];
            }

            $summary = [
                'primaryAppointmentId' => null,
                'latestAppointmentId' => null,
                'latestCallbackId' => null,
                'serviceLine' => 'preconsulta_digital',
                'service_intent' => 'preconsulta_digital',
                'providerName' => null,
                'scheduledStart' => null,
                'scheduledEnd' => null,
                'queueStatus' => null,
                'lastChannel' => 'web_preconsulta',
                'source' => 'public_preconsultation',
                'campaign' => 'unknown',
                'surface' => 'preconsulta_publica',
                'openActionCount' => 1,
                'pendingApprovalCount' => 0,
                'latestTicketId' => null,
                'latestTicketCode' => null,
                'assignedConsultorio' => null,
                'activeHelpRequestId' => null,
                'patientLabel' => $name,
                'milestones' => [
                    'leadCapturedAt' => $now,
                ],
                'skinType' => $skinType,
                'leadConcern' => $condition,
                'privacyConsent' => $privacyConsent,
                'privacyConsentAt' => $now,
                'entrySurface' => 'preconsulta_publica',
            ];

            $existingCase = !$isNewCase && isset($store['patient_cases'][$caseIndex]) && is_array($store['patient_cases'][$caseIndex])
                ? $store['patient_cases'][$caseIndex]
                : [];
            if ($existingCase !== []) {
                $existingSummary = isset($existingCase['summary']) && is_array($existingCase['summary'])
                    ? $existingCase['summary']
                    : [];
                $summary = array_merge($existingSummary, $summary);
                $summary['patientLabel'] = $name;
                $summary['lastChannel'] = 'web_preconsulta';
                $summary['skinType'] = $skinType;
                $summary['leadConcern'] = $condition;
                $summary['privacyConsent'] = $privacyConsent;
                $summary['privacyConsentAt'] = $now;
                $summary['entrySurface'] = 'preconsulta_publica';
                $summary['source'] = 'public_preconsultation';
                $summary['campaign'] = 'unknown';
                $summary['surface'] = 'preconsulta_publica';
                $summary['service_intent'] = 'preconsulta_digital';
                $summary['openActionCount'] = max(1, (int) ($summary['openActionCount'] ?? 0));
            }

            $caseRecord = [
                'id' => $caseId,
                'tenantId' => $tenantId,
                'patientId' => $patientId,
                'status' => $isNewCase ? 'lead_captured' : (string) ($existingCase['status'] ?? 'lead_captured'),
                'statusSource' => 'manual',
                'openedAt' => $isNewCase
                    ? $now
                    : (string) ($existingCase['openedAt'] ?? $now),
                'latestActivityAt' => $now,
                'closedAt' => null,
                'lastInboundAt' => $now,
                'lastOutboundAt' => isset($existingCase['lastOutboundAt']) ? (string) $existingCase['lastOutboundAt'] : null,
                'summary' => $summary,
            ];

            if ($isNewCase) {
                $store['patient_cases'][] = $caseRecord;
            } else {
                $store['patient_cases'][$caseIndex] = $caseRecord;
            }

            $callbackId = (int) round(microtime(true) * 1000);
            $callback = normalize_callback([
                'id' => $callbackId,
                'tenantId' => $tenantId,
                'telefono' => $whatsapp,
                'preferencia' => self::buildCallbackPreference($name, $skinType, $condition, count($photoPaths)),
                'fecha' => $now,
                'status' => 'pendiente',
                'patientCaseId' => $caseId,
                'patientId' => $patientId,
                'source' => 'public_preconsultation',
                'campaign' => 'unknown',
                'surface' => 'preconsulta_publica',
                'service_intent' => 'preconsulta_digital',
                'leadOps' => [
                    'source' => 'public_preconsultation',
                    'campaign' => 'unknown',
                    'surface' => 'preconsulta_publica',
                    'service_intent' => 'preconsulta_digital',
                    'priorityBand' => count($photoPaths) > 0 ? 'hot' : 'warm',
                    'reasonCodes' => ['preconsultation_form'],
                    'serviceHints' => ['Preconsulta digital'],
                    'nextAction' => 'Revisar preconsulta, validar fotos y responder por WhatsApp.',
                ],
            ]);
            $callback = LeadOpsService::enrichCallback($callback, $store);
            $store['callbacks'][] = $callback;

            if ($photoPaths !== []) {
                $claim = ClinicalMediaService::claimPatientCaseUploads($store, $caseId, $photoPaths, $photoNames);
                $store = $claim['store'];
                $photoUploadIds = is_array($claim['uploadIds'] ?? null) ? $claim['uploadIds'] : [];
                $privatePaths = is_array($claim['privatePaths'] ?? null) ? $claim['privatePaths'] : [];

                $targetIndex = self::findCaseIndexById($store, $caseId);
                if ($targetIndex !== null && isset($store['patient_cases'][$targetIndex]) && is_array($store['patient_cases'][$targetIndex])) {
                    $store['patient_cases'][$targetIndex]['summary'] = array_merge(
                        isset($store['patient_cases'][$targetIndex]['summary']) && is_array($store['patient_cases'][$targetIndex]['summary'])
                            ? $store['patient_cases'][$targetIndex]['summary']
                            : [],
                        [
                            'clinicalMediaIds' => $photoUploadIds,
                            'casePhotoCount' => count($photoUploadIds),
                            'casePhotoPaths' => $privatePaths,
                        ]
                    );
                }
            }

            $timeline = isset($store['patient_case_timeline_events']) && is_array($store['patient_case_timeline_events'])
                ? $store['patient_case_timeline_events']
                : [];
            if ($isNewCase) {
                $timeline[] = [
                    'id' => self::buildEntityId('pct', [$tenantId, $caseId, 'lead_opened', $now]),
                    'tenantId' => $tenantId,
                    'patientCaseId' => $caseId,
                    'type' => 'case_opened',
                    'title' => 'Lead captado desde preconsulta pública',
                    'payload' => [
                        'entrySurface' => 'preconsulta_publica',
                        'skinType' => $skinType,
                    ],
                    'createdAt' => $now,
                ];
            }
            $timeline[] = [
                'id' => self::buildEntityId('pct', [$tenantId, $caseId, 'preconsultation_submitted', $now]),
                'tenantId' => $tenantId,
                'patientCaseId' => $caseId,
                'type' => 'status_changed',
                'title' => 'Preconsulta digital recibida',
                'payload' => [
                    'skinType' => $skinType,
                    'photoCount' => count($photoPaths),
                    'source' => 'public_preconsultation',
                ],
                'createdAt' => $now,
            ];
            $store['patient_case_timeline_events'] = $timeline;

            $store = $patientCaseService->hydrateStore($store);
            if (!write_store($store, false)) {
                return [
                    'ok' => false,
                    'error' => 'No se pudo registrar la preconsulta',
                    'code' => 503,
                ];
            }

            $savedCaseIndex = self::findCaseIndexById($store, $caseId);
            $savedCase = $savedCaseIndex !== null && isset($store['patient_cases'][$savedCaseIndex]) && is_array($store['patient_cases'][$savedCaseIndex])
                ? $store['patient_cases'][$savedCaseIndex]
                : $caseRecord;

            return [
                'ok' => true,
                'case' => $savedCase,
                'callback' => $callback,
                'created' => $isNewCase,
            ];
        });

        if (($result['ok'] ?? false) !== true || !is_array($result['result'] ?? null) || (($result['result']['ok'] ?? false) !== true)) {
            $code = (int) ($result['result']['code'] ?? 503);
            $error = (string) ($result['result']['error'] ?? 'No se pudo registrar la preconsulta');
            json_response(['ok' => false, 'error' => $error], $code > 0 ? $code : 503);
        }

        $stored = $result['result'];
        $callback = is_array($stored['callback'] ?? null) ? $stored['callback'] : [];
        maybe_send_callback_admin_notification($callback);

        json_response([
            'ok' => true,
            'data' => [
                'caseId' => (string) (($stored['case']['id'] ?? '')),
                'stage' => 'lead_captured',
                'owner' => 'frontdesk',
                'callbackId' => (int) (($callback['id'] ?? 0)),
                'created' => (bool) ($stored['created'] ?? false),
                'whatsapp' => $whatsapp,
            ],
        ], 201);
    }

    public static function resolveTenantId(...$args)
    {
        return PatientCaseQueryService::resolveTenantId(...$args);
    }

    public static function findReusableOpenCaseIndex(...$args)
    {
        return PatientCaseQueryService::findReusableOpenCaseIndex(...$args);
    }

    public static function findCaseIndexById(...$args)
    {
        return PatientCaseQueryService::findCaseIndexById(...$args);
    }

    public static function buildPatientId(...$args)
    {
        return PatientCaseQueryService::buildPatientId(...$args);
    }

    public static function buildEntityId(...$args)
    {
        return PatientCaseQueryService::buildEntityId(...$args);
    }

    public static function normalizeSkinType(...$args)
    {
        return PatientCaseQueryService::normalizeSkinType(...$args);
    }

    public static function buildCallbackPreference(...$args)
    {
        return PatientCaseQueryService::buildCallbackPreference(...$args);
    }

    public static function requireClinicalStorageReady(...$args)
    {
        return PatientCaseQueryService::requireClinicalStorageReady(...$args);
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:patient-cases':
                self::index($context);
                return;
            case 'POST:patient-cases':
                self::store($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'index':
                            self::index($context);
                            return;
                        case 'store':
                            self::store($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
