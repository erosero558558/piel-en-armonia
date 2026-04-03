<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/admin/TurneroAdminService.php';
require_once __DIR__ . '/../lib/admin/BusinessMetricsService.php';
require_once __DIR__ . '/../lib/health/CalendarHealthService.php';


require_once __DIR__ . '/../lib/QueueService.php';
require_once __DIR__ . '/../lib/QueueSurfaceStatusStore.php';
require_once __DIR__ . '/../lib/AppDownloadsCatalog.php';
require_once __DIR__ . '/../lib/PatientCaseService.php';
require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';
require_once __DIR__ . '/../lib/TurneroClinicProfile.php';
require_once __DIR__ . '/../lib/TurneroOperatorAccess.php';
require_once __DIR__ . '/../lib/clinical_history/bootstrap.php';
require_once __DIR__ . '/../lib/CaseMediaFlowService.php';
require_once __DIR__ . '/../lib/telemedicine/TelemedicineOpsSnapshot.php';
require_once __DIR__ . '/../lib/FlowOsJourney.php';
require_once __DIR__ . '/../lib/DoctorProfileStore.php';
require_once __DIR__ . '/../lib/ClinicProfileStore.php';
require_once __DIR__ . '/../lib/CheckoutOrderService.php';
require_once __DIR__ . '/../lib/MultiClinicDashboardService.php';

final class AdminDataController
{
    public static function index(array $context): void
    {
        // GET /data (Admin)
        $patientCaseService = new PatientCaseService();
        $store = $patientCaseService->hydrateStore($context['store']);
        $availabilityService = CalendarAvailabilityService::fromEnv();
        $calendarClient = $availabilityService->getClient();
        $calendarActive = $availabilityService->isGoogleActive();
        $calendarRequired = $availabilityService->isGoogleRequired();
        $calendarRequirementMet = $availabilityService->isGoogleRequirementMet();
        $calendarConfigured = $calendarActive ? $calendarClient->isConfigured() : true;
        $maskedCalendars = $availabilityService->getDoctorCalendarMapMasked();
        $rawCalendars = $calendarClient->getDoctorCalendarMap();
        $calendarStatus = GoogleCalendarClient::readStatusSnapshot();
        $calendarLastSuccessAt = (string) ($calendarStatus['lastSuccessAt'] ?? '');
        $calendarLastErrorAt = (string) ($calendarStatus['lastErrorAt'] ?? '');
        $calendarLastErrorReason = (string) ($calendarStatus['lastErrorReason'] ?? '');
        $calendarReachable = CalendarHealthService::resolveCalendarReachable(
            $calendarActive,
            $calendarRequired,
            $calendarConfigured,
            $calendarLastSuccessAt,
            $calendarLastErrorAt
        );
        $calendarMode = CalendarHealthService::resolveCalendarMode(
            $calendarActive,
            $calendarRequired,
            $availabilityService->getBlockOnFailure(),
            $calendarReachable
        );
        $calendarAuth = $calendarActive ? $calendarClient->getAuthMode() : 'none';
        $calendarTokenSnapshot = GoogleTokenProvider::readStatusSnapshot();
        $calendarTokenHealthy = CalendarHealthService::resolveCalendarTokenHealthy(
            $calendarActive,
            $calendarRequired,
            $calendarConfigured,
            $calendarAuth,
            $calendarTokenSnapshot
        );
        $doctorCalendars = [];
        foreach (['rosero', 'narvaez'] as $doctor) {
            $calendarId = trim((string) ($rawCalendars[$doctor] ?? ''));
            $doctorCalendars[$doctor] = [
                'idMasked' => (string) ($maskedCalendars[$doctor] ?? ''),
                'openUrl' => $calendarId !== ''
                    ? 'https://calendar.google.com/calendar/u/0/r?cid=' . rawurlencode($calendarId)
                    : '',
            ];
        }

        $store['availabilityMeta'] = [
            'source' => $calendarActive ? 'google' : 'store',
            'mode' => $calendarMode,
            'timezone' => $calendarClient->getTimezone(),
            'calendarAuth' => $calendarAuth,
            'calendarRequired' => $calendarRequired,
            'calendarRequirementMet' => $calendarRequirementMet,
            'calendarTokenHealthy' => $calendarTokenHealthy,
            'calendarConfigured' => $calendarConfigured,
            'calendarReachable' => $calendarReachable,
            'calendarLastSuccessAt' => $calendarLastSuccessAt,
            'calendarLastErrorAt' => $calendarLastErrorAt,
            'calendarLastErrorReason' => $calendarLastErrorReason,
            'doctorCalendars' => $doctorCalendars,
            'generatedAt' => local_date('c'),
        ];

        if (class_exists('AnalyticsController') && method_exists('AnalyticsController', '__buildFunnelMetricsData')) {
            try {
                $store['funnelMetrics'] = AnalyticsController::__buildFunnelMetricsData($context);
            } catch (\Throwable $th) {
                // Keep /data resilient if metrics export is temporarily unavailable.
                $store['funnelMetrics'] = null;
            }
        }

        $store['callbacks'] = LeadOpsService::enrichCallbacks(
            isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [],
            $store,
            isset($store['funnelMetrics']) && is_array($store['funnelMetrics']) ? $store['funnelMetrics'] : null
        );
        $store['leadOpsMeta'] = LeadOpsService::buildMeta(
            $store['callbacks'],
            $store,
            isset($store['funnelMetrics']) && is_array($store['funnelMetrics']) ? $store['funnelMetrics'] : null
        );

        try {
            $queueService = new QueueService();
            $store['queueMeta'] = $queueService->buildAdminSummary($store);
        } catch (\Throwable $th) {
            $store['queueMeta'] = null;
        }

        $store['patientFlowMeta'] = $patientCaseService->buildSummary($store);
        $store['patientFlowMeta']['journeyPreview'] = flow_os_build_store_journey_preview($store);
        $store['patientFlowMeta']['journeyHistory'] = flow_os_build_store_journey_history($store);
        $store['doctorProfile'] = read_doctor_profile();
        $store['clinicProfile'] = read_clinic_profile();
        $store['clinicalHistoryMeta'] = ClinicalHistoryOpsSnapshot::forAdmin(
            ClinicalHistoryOpsSnapshot::build($store)
        );
        $store['mediaFlowMeta'] = CaseMediaFlowService::buildAdminMeta($store);
        $store['telemedicineMeta'] = TelemedicineOpsSnapshot::forAdmin(
            TelemedicineOpsSnapshot::build($store)
        );
        $store['checkoutReviewMeta'] = CheckoutOrderService::buildAdminReviewMeta($store);
        $store['paymentAccountMeta'] = CheckoutOrderService::buildAdminAccountMeta($store);
        $store['multiClinicOverview'] = MultiClinicDashboardService::buildAdminOverview($store);
        $store['internalConsoleMeta'] = function_exists('internal_console_readiness_snapshot')
            ? internal_console_readiness_snapshot()
            : null;
        $store['turneroClinicProfile'] = read_turnero_clinic_profile();
        $store['turneroClinicProfileMeta'] = read_turnero_clinic_profile_runtime_meta();
        $store['turneroClinicProfileCatalogStatus'] = read_turnero_clinic_profile_catalog_status();
        $store['turneroClinicProfiles'] = read_turnero_clinic_profiles_catalog_payload();
        $store['turneroRegionalClinics'] = read_turnero_regional_clinics_payload();
        $store['turneroOperatorAccessMeta'] = turnero_operator_access_meta();
        $store = self::redactClinicalReadModelsIfBlocked($store);

        $store['appDownloads'] = self::buildAppDownloads();
        $store['queueSurfaceStatus'] = QueueSurfaceStatusStore::readSummary();
        $store['turneroV2Readiness'] = self::buildTurneroV2Readiness($store);
        $store['reviewsMeta'] = self::buildReviewsMeta($store);

        if (($context['isQueueOperator'] ?? false) === true && ($context['isAdmin'] ?? false) !== true) {
            $store = self::buildQueueOperatorStore($store, $context);
        }

        json_response([
            'ok' => true,
            'data' => $store
        ]);
    }

    public static function redactClinicalReadModelsIfBlocked(array $store): array
    {
        $internalConsoleMeta = isset($store['internalConsoleMeta']) && is_array($store['internalConsoleMeta'])
            ? $store['internalConsoleMeta']
            : [];
        $clinicalReady = (bool) ($internalConsoleMeta['clinicalData']['ready'] ?? true);
        if ($clinicalReady) {
            return $store;
        }

        foreach ([
            'patient_cases',
            'patient_case_links',
            'patient_case_timeline_events',
            'patient_case_approvals',
            'clinical_uploads',
            'telemedicine_intakes',
        ] as $key) {
            $store[$key] = [];
        }

        if (isset($store['clinicalHistoryMeta']) && is_array($store['clinicalHistoryMeta'])) {
            $store['clinicalHistoryMeta'] = array_merge($store['clinicalHistoryMeta'], [
                'reviewQueue' => [],
                'events' => [],
            ]);
        }

        if (isset($store['mediaFlowMeta']) && is_array($store['mediaFlowMeta'])) {
            $store['mediaFlowMeta'] = array_merge($store['mediaFlowMeta'], [
                'queue' => [],
                'recentEvents' => [],
            ]);
        }

        if (isset($store['telemedicineMeta']) && is_array($store['telemedicineMeta'])) {
            $store['telemedicineMeta'] = array_merge($store['telemedicineMeta'], [
                'reviewQueue' => [],
                'briefingQueue' => [],
            ]);
        }

        if (
            isset($store['patientFlowMeta']['journeyPreview']) &&
            is_array($store['patientFlowMeta']['journeyPreview'])
        ) {
            $store['patientFlowMeta']['journeyPreview'] = array_merge(
                $store['patientFlowMeta']['journeyPreview'],
                [
                    'activityFeed' => [],
                    'cases' => [],
                    'redacted' => true,
                    'redactionReason' => 'clinical_storage_not_ready',
                ]
            );
        }

        return $store;
    }

    public static function import(array $context): void
    {
        // POST /import (Admin)
        $store = $context['store'];
        if (!$context['isAdmin']) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }
        require_csrf();

        $payload = require_json_body();
        $clinicalFields = array_values(array_intersect(
            ['patient_case_approvals', 'telemedicine_intakes', 'clinical_uploads'],
            array_keys(is_array($payload) ? $payload : [])
        ));
        if ($clinicalFields !== [] && function_exists('internal_console_clinical_data_ready') && !internal_console_clinical_data_ready()) {
            $response = function_exists('internal_console_clinical_guard_payload')
                ? internal_console_clinical_guard_payload([
                    'clinicalFields' => $clinicalFields,
                ])
                : [
                    'ok' => false,
                    'code' => 'clinical_storage_not_ready',
                    'error' => 'Historias clinicas bloqueadas hasta habilitar almacenamiento cifrado.',
                    'clinicalFields' => $clinicalFields,
                ];
            json_response($response, 409);
        }

        mutate_store(static function(array $store) use ($payload) {
            $store['appointments'] = isset($payload['appointments']) && is_array($payload['appointments']) ? $payload['appointments'] : [];
            $store['callbacks'] = isset($payload['callbacks']) && is_array($payload['callbacks']) ? $payload['callbacks'] : [];
            $store['reviews'] = isset($payload['reviews']) && is_array($payload['reviews']) ? $payload['reviews'] : [];
            $store['queue_tickets'] = isset($payload['queue_tickets']) && is_array($payload['queue_tickets']) ? $payload['queue_tickets'] : [];
            $store['queue_help_requests'] = isset($payload['queue_help_requests']) && is_array($payload['queue_help_requests'])
                ? $payload['queue_help_requests']
                : [];
            if (isset($payload['patient_case_approvals']) && is_array($payload['patient_case_approvals'])) {
                $store['patient_case_approvals'] = $payload['patient_case_approvals'];
            }
            if (isset($payload['telemedicine_intakes']) && is_array($payload['telemedicine_intakes'])) {
                $store['telemedicine_intakes'] = $payload['telemedicine_intakes'];
            }
            if (isset($payload['clinical_uploads']) && is_array($payload['clinical_uploads'])) {
                $store['clinical_uploads'] = $payload['clinical_uploads'];
            }
            $store['availability'] = isset($payload['availability']) && is_array($payload['availability']) ? $payload['availability'] : [];
            return ['store' => $store, 'storeDirty' => true];
        });
        json_response([
            'ok' => true
        ]);
    }

    public static function buildAppDownloads()
    {
        return TurneroAdminService::buildAppDownloads();
    }

    public static function buildQueueOperatorStore(...$args)
    {
        return TurneroAdminService::buildQueueOperatorStore(...$args);
    }

    public static function buildTurneroV2Readiness(...$args)
    {
        return TurneroAdminService::buildTurneroV2Readiness(...$args);
    }

    public static function buildTurneroSurfaceReadiness(...$args)
    {
        return TurneroAdminService::buildTurneroSurfaceReadiness(...$args);
    }

    public static function surfaceLatestDetails(...$args)
    {
        return TurneroAdminService::surfaceLatestDetails(...$args);
    }

    public static function buildTurneroHardwareReadiness(...$args)
    {
        return TurneroAdminService::buildTurneroHardwareReadiness(...$args);
    }

    public static function buildReviewsMeta(...$args)
    {
        return BusinessMetricsService::buildReviewsMeta(...$args);
    }

    public static function businessMetrics(...$args)
    {
        return BusinessMetricsService::businessMetrics(...$args);
    }

    public static function estimateServiceRevenue(...$args)
    {
        return BusinessMetricsService::estimateServiceRevenue(...$args);
    }

    public static function chronicPanel(...$args)
    {
        return BusinessMetricsService::chronicPanel(...$args);
    }

    public static function patientLtv(...$args)
    {
        return BusinessMetricsService::patientLtv(...$args);
    }

    public static function __adverseReactionReport(...$args)
    {
        return BusinessMetricsService::__adverseReactionReport(...$args);
    }

    public static function requireAuth(array $context): void
    {
        if (!($context['isDoctor'] ?? false) && !($context['isAdmin'] ?? false)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:data':
                self::index($context);
                return;
            case 'POST:import':
                self::import($context);
                return;
            case 'GET:business-metrics':
                self::businessMetrics($context);
                return;
            case 'GET:chronic-panel':
                self::chronicPanel($context);
                return;
            case 'GET:patient-ltv':
                self::patientLtv($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'index':
                            self::index($context);
                            return;
                        case 'import':
                            self::import($context);
                            return;
                        case 'businessMetrics':
                            self::businessMetrics($context);
                            return;
                        case 'chronicPanel':
                            self::chronicPanel($context);
                            return;
                        case 'patientLtv':
                            self::patientLtv($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
