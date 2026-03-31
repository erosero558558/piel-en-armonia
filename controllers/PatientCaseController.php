<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/PatientCaseService.php';
require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';
require_once __DIR__ . '/../lib/LeadOpsService.php';
require_once __DIR__ . '/../lib/email.php';
require_once __DIR__ . '/../lib/models.php';
require_once __DIR__ . '/../lib/validation.php';
require_once __DIR__ . '/../lib/telemedicine/ClinicalMediaService.php';

class PatientCaseController
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

    private static function resolveTenantId(array $store): string
    {
        foreach (['patient_cases', 'callbacks', 'appointments'] as $key) {
            $records = isset($store[$key]) && is_array($store[$key]) ? $store[$key] : [];
            foreach ($records as $record) {
                if (!is_array($record)) {
                    continue;
                }
                $tenantId = trim((string) ($record['tenantId'] ?? ''));
                if ($tenantId !== '') {
                    return $tenantId;
                }
            }
        }

        return get_current_tenant_id();
    }

    private static function findReusableOpenCaseIndex(array $store, string $tenantId, string $patientId): ?int
    {
        $cases = isset($store['patient_cases']) && is_array($store['patient_cases']) ? array_values($store['patient_cases']) : [];
        foreach ($cases as $index => $case) {
            if (!is_array($case)) {
                continue;
            }
            if ((string) ($case['tenantId'] ?? '') !== $tenantId) {
                continue;
            }
            if ((string) ($case['patientId'] ?? '') !== $patientId) {
                continue;
            }

            $status = strtolower(trim((string) ($case['status'] ?? 'lead_captured')));
            if (in_array($status, ['resolved', 'closed', 'completed', 'archived', 'cancelled', 'no_show'], true)) {
                continue;
            }

            return $index;
        }

        return null;
    }

    private static function findCaseIndexById(array $store, string $caseId): ?int
    {
        $cases = isset($store['patient_cases']) && is_array($store['patient_cases']) ? array_values($store['patient_cases']) : [];
        foreach ($cases as $index => $case) {
            if (is_array($case) && (string) ($case['id'] ?? '') === $caseId) {
                return $index;
            }
        }

        return null;
    }

    private static function buildPatientId(string $tenantId, string $whatsapp): string
    {
        $digits = preg_replace('/\D+/', '', $whatsapp);
        $identity = is_string($digits) && $digits !== ''
            ? 'phone:' . $digits
            : 'phone:' . strtolower(trim($whatsapp));

        return self::buildEntityId('pt', [$tenantId, 'callback-patient', $identity]);
    }

    private static function buildEntityId(string $prefix, array $parts): string
    {
        return strtolower($prefix) . '-' . substr(hash('sha256', implode('|', array_map(static function ($value): string {
            return trim((string) $value);
        }, $parts))), 0, 16);
    }

    private static function normalizeSkinType(string $value): string
    {
        $normalized = strtolower(trim($value));
        $allowed = [
            'seca',
            'mixta',
            'grasa',
            'sensible',
            'acneica',
            'atopica',
            'normal',
        ];

        if (in_array($normalized, $allowed, true)) {
            return $normalized;
        }

        return truncate_field(sanitize_xss($normalized), 40);
    }

    private static function buildCallbackPreference(string $name, string $skinType, string $condition, int $photoCount): string
    {
        $photoLabel = $photoCount > 0
            ? sprintf('%d foto%s adjunta%s', $photoCount, $photoCount === 1 ? '' : 's', $photoCount === 1 ? '' : 's')
            : 'sin fotos adjuntas';

        return truncate_field(
            sprintf(
                'Preconsulta digital de %s. Tipo de piel: %s. Motivo: %s. %s.',
                $name,
                $skinType,
                $condition,
                $photoLabel
            ),
            200
        );
    }

    private static function requireClinicalStorageReady(array $data): void
    {
        $readiness = function_exists('internal_console_readiness_snapshot')
            ? internal_console_readiness_snapshot()
            : null;
        $clinicalReady = function_exists('internal_console_clinical_data_ready')
            ? internal_console_clinical_data_ready($readiness)
            : (bool) ($readiness['clinicalData']['ready'] ?? true);

        if ($clinicalReady) {
            return;
        }

        $payload = function_exists('internal_console_clinical_guard_payload')
            ? internal_console_clinical_guard_payload([
                'surface' => (string) ($data['surface'] ?? 'patient_case_intake'),
                'error' => 'La preconsulta con fotos necesita almacenamiento clínico cifrado habilitado.',
                'data' => $data,
            ])
            : [
                'ok' => false,
                'code' => 'clinical_storage_not_ready',
                'error' => 'La preconsulta con fotos necesita almacenamiento clínico cifrado habilitado.',
                'surface' => (string) ($data['surface'] ?? 'patient_case_intake'),
                'readiness' => $readiness,
                'data' => $data,
            ];

        json_response($payload, 409);
    }
}
