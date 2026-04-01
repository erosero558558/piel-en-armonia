<?php

declare(strict_types=1);

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

class AdminDataController
{
    private static function index(array $context): void
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
        $calendarReachable = self::resolveCalendarReachable(
            $calendarActive,
            $calendarRequired,
            $calendarConfigured,
            $calendarLastSuccessAt,
            $calendarLastErrorAt
        );
        $calendarMode = self::resolveCalendarMode(
            $calendarActive,
            $calendarRequired,
            $availabilityService->getBlockOnFailure(),
            $calendarReachable
        );
        $calendarAuth = $calendarActive ? $calendarClient->getAuthMode() : 'none';
        $calendarTokenSnapshot = GoogleTokenProvider::readStatusSnapshot();
        $calendarTokenHealthy = self::resolveCalendarTokenHealthy(
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

    private static function redactClinicalReadModelsIfBlocked(array $store): array
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

    private static function import(array $context): void
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

    private static function resolveCalendarReachable(
        bool $calendarActive,
        bool $calendarRequired,
        bool $calendarConfigured,
        string $lastSuccessAt,
        string $lastErrorAt
    ): bool {
        if (!$calendarActive) {
            return !$calendarRequired;
        }
        if (!$calendarConfigured) {
            return false;
        }
        if ($lastSuccessAt === '' && $lastErrorAt === '') {
            return true;
        }
        if ($lastSuccessAt === '') {
            return false;
        }
        if ($lastErrorAt === '') {
            return true;
        }
        return !self::timestampGreater($lastErrorAt, $lastSuccessAt);
    }

    private static function resolveCalendarMode(
        bool $calendarActive,
        bool $calendarRequired,
        bool $blockOnFailure,
        bool $calendarReachable
    ): string {
        if (!$calendarActive) {
            return $calendarRequired ? 'blocked' : 'live';
        }
        if ($blockOnFailure && !$calendarReachable) {
            return 'blocked';
        }
        return 'live';
    }

    private static function resolveCalendarTokenHealthy(
        bool $calendarActive,
        bool $calendarRequired,
        bool $calendarConfigured,
        string $calendarAuth,
        array $tokenSnapshot
    ): bool {
        if (!$calendarActive) {
            return !$calendarRequired;
        }
        if (!$calendarConfigured) {
            return false;
        }
        if (!in_array($calendarAuth, ['oauth_refresh', 'service_account'], true)) {
            return false;
        }

        $expiresAt = (int) ($tokenSnapshot['expiresAt'] ?? 0);
        if ($expiresAt > (time() + 30)) {
            return true;
        }

        $lastSuccessAt = (string) ($tokenSnapshot['lastSuccessAt'] ?? '');
        $lastErrorAt = (string) ($tokenSnapshot['lastErrorAt'] ?? '');
        if ($lastSuccessAt === '' && $lastErrorAt === '') {
            return false;
        }
        if ($lastSuccessAt === '') {
            return false;
        }
        if ($lastErrorAt === '') {
            return true;
        }
        return !self::timestampGreater($lastErrorAt, $lastSuccessAt);
    }

    private static function timestampGreater(string $leftIso, string $rightIso): bool
    {
        $left = strtotime($leftIso);
        $right = strtotime($rightIso);
        if ($left === false || $right === false) {
            return false;
        }
        return $left > $right;
    }

    private static function buildAppDownloads(): array
    {
        return build_app_downloads_runtime_payload();
    }

    private static function buildQueueOperatorStore(array $store, array $context): array
    {
        $queueOperatorSession = isset($context['queueOperatorSession']) && is_array($context['queueOperatorSession'])
            ? $context['queueOperatorSession']
            : null;

        return [
            'appointments' => [],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [],
            'availabilityMeta' => [],
            'queue_tickets' => isset($store['queue_tickets']) && is_array($store['queue_tickets'])
                ? $store['queue_tickets']
                : [],
            'doctorProfile' => read_doctor_profile(),
            'clinicProfile' => read_clinic_profile(),
            'queueMeta' => isset($store['queueMeta']) && is_array($store['queueMeta'])
                ? $store['queueMeta']
                : null,
            'queueSurfaceStatus' => isset($store['queueSurfaceStatus']) && is_array($store['queueSurfaceStatus'])
                ? $store['queueSurfaceStatus']
                : null,
            'appDownloads' => isset($store['appDownloads']) && is_array($store['appDownloads'])
                ? $store['appDownloads']
                : null,
            'turneroClinicProfile' => isset($store['turneroClinicProfile']) && is_array($store['turneroClinicProfile'])
                ? $store['turneroClinicProfile']
                : null,
            'turneroClinicProfileMeta' => isset($store['turneroClinicProfileMeta']) && is_array($store['turneroClinicProfileMeta'])
                ? $store['turneroClinicProfileMeta']
                : null,
            'turneroClinicProfileCatalogStatus' => isset($store['turneroClinicProfileCatalogStatus']) && is_array($store['turneroClinicProfileCatalogStatus'])
                ? $store['turneroClinicProfileCatalogStatus']
                : null,
            'turneroClinicProfiles' => isset($store['turneroClinicProfiles']) && is_array($store['turneroClinicProfiles'])
                ? $store['turneroClinicProfiles']
                : [],
            'turneroRegionalClinics' => isset($store['turneroRegionalClinics']) && is_array($store['turneroRegionalClinics'])
                ? $store['turneroRegionalClinics']
                : [],
            'turneroOperatorAccessMeta' => isset($store['turneroOperatorAccessMeta']) && is_array($store['turneroOperatorAccessMeta'])
                ? $store['turneroOperatorAccessMeta']
                : null,
            'turneroV2Readiness' => isset($store['turneroV2Readiness']) && is_array($store['turneroV2Readiness'])
                ? $store['turneroV2Readiness']
                : null,
            'queueOperatorSession' => $queueOperatorSession,
            'funnelMetrics' => [],
        ];
    }

    private static function buildTurneroV2Readiness(array $store): array
    {
        $profile = isset($store['turneroClinicProfile']) && is_array($store['turneroClinicProfile'])
            ? $store['turneroClinicProfile']
            : read_turnero_clinic_profile();
        $release = isset($profile['release']) && is_array($profile['release'])
            ? $profile['release']
            : [];
        $releaseMode = trim((string) ($release['mode'] ?? ''));
        $localWebPilot = $releaseMode === 'web_pilot';
        $nativeAppsBlocking = (bool) ($release['native_apps_blocking'] ?? false);
        $operatorAccessMeta = isset($store['turneroOperatorAccessMeta']) && is_array($store['turneroOperatorAccessMeta'])
            ? $store['turneroOperatorAccessMeta']
            : turnero_operator_access_meta();
        $surfaceStatus = isset($store['queueSurfaceStatus']) && is_array($store['queueSurfaceStatus'])
            ? $store['queueSurfaceStatus']
            : QueueSurfaceStatusStore::readSummary();

        $operatorSurface = self::buildTurneroSurfaceReadiness(
            'operator',
            $localWebPilot ? 'browser' : 'desktop',
            $surfaceStatus['operator'] ?? null,
            $nativeAppsBlocking
        );
        $kioskSurface = self::buildTurneroSurfaceReadiness(
            'kiosk',
            $localWebPilot ? 'browser' : 'desktop',
            $surfaceStatus['kiosk'] ?? null,
            $nativeAppsBlocking
        );
        $displaySurface = self::buildTurneroSurfaceReadiness(
            'display',
            $localWebPilot ? 'browser' : 'android_tv',
            $surfaceStatus['display'] ?? null,
            $nativeAppsBlocking
        );

        $adminReady = (string) ($release['admin_mode_default'] ?? '') === 'basic'
            && !empty($profile['surfaces']['admin']['enabled'])
            && trim((string) ($profile['surfaces']['admin']['route'] ?? '')) !== '';
        $adminSurface = [
            'surface' => 'admin',
            'label' => 'Admin',
            'expectedAppMode' => 'web',
            'appMode' => 'web',
            'ready' => $adminReady,
            'blocking' => false,
            'state' => $adminReady ? 'ready' : 'warning',
            'summary' => $adminReady
                ? ($localWebPilot
                    ? 'Admin listo como consola web local y centro de supervisión.'
                    : 'Admin listo como consola de supervisión y fallback.')
                : ($localWebPilot
                    ? 'Admin debe quedar habilitado en basic como consola local del piloto.'
                    : 'Admin debe quedar habilitado en basic como consola de recuperación.'),
            'stale' => false,
            'updatedAt' => '',
        ];

        $operatorDetails = self::surfaceLatestDetails($surfaceStatus['operator'] ?? null);
        $kioskDetails = self::surfaceLatestDetails($surfaceStatus['kiosk'] ?? null);
        $displayDetails = self::surfaceLatestDetails($surfaceStatus['display'] ?? null);

        $hardware = [
            'assistant' => self::buildTurneroHardwareReadiness(
                $localWebPilot || trim((string) ($kioskDetails['assistantSessionId'] ?? '')) !== '',
                'Asistente de kiosco',
                $localWebPilot
                    ? 'El asistente de kiosco queda diferido para la ola nativa y no bloquea el piloto web local.'
                    : (trim((string) ($kioskDetails['assistantSessionId'] ?? '')) !== ''
                        ? 'Asistente activo y midiendo sesiones.'
                        : 'Falta confirmar el asistente del kiosco con una sesión activa.')
            ),
            'printer' => self::buildTurneroHardwareReadiness(
                $localWebPilot || (bool) ($kioskDetails['printerPrinted'] ?? false),
                'Impresora térmica',
                $localWebPilot
                    ? 'La impresión térmica queda como validación posterior y no bloquea este corte local.'
                    : ((bool) ($kioskDetails['printerPrinted'] ?? false)
                        ? 'Impresora térmica validada con ticket reciente.'
                        : 'Falta una impresión térmica satisfactoria para salida.')
            ),
            'numpad' => self::buildTurneroHardwareReadiness(
                $localWebPilot || (bool) ($operatorDetails['numpadReady'] ?? false),
                'Numpad operador',
                $localWebPilot
                    ? 'El numpad del operador queda diferido para la superficie nativa y no bloquea el piloto web.'
                    : ((bool) ($operatorDetails['numpadReady'] ?? false)
                        ? 'Numpad operativo confirmado.'
                        : 'Falta validar el numpad antes del primer llamado.')
            ),
            'desktopShell' => self::buildTurneroHardwareReadiness(
                $localWebPilot || (($operatorSurface['ready'] ?? false) === true && ($kioskSurface['ready'] ?? false) === true),
                'Shell desktop',
                $localWebPilot
                    ? 'Las shells desktop quedan como etapa posterior; el piloto actual valida solo las superficies web locales.'
                    : ((($operatorSurface['ready'] ?? false) === true && ($kioskSurface['ready'] ?? false) === true)
                        ? 'Operator y kiosk reportan shell nativa lista.'
                        : 'Falta confirmar operator y kiosk como apps nativas listas.')
            ),
            'tvAudio' => self::buildTurneroHardwareReadiness(
                $localWebPilot || ((bool) ($displayDetails['bellPrimed'] ?? false) && !($displayDetails['bellMuted'] ?? false)),
                'Audio sala TV',
                $localWebPilot
                    ? 'El audio de sala TV queda diferido hasta la ola nativa y no bloquea el piloto web local.'
                    : (((bool) ($displayDetails['bellPrimed'] ?? false) && !($displayDetails['bellMuted'] ?? false))
                        ? 'Audio y campanilla de sala TV listos.'
                        : 'Falta destrabar audio o reactivar campanilla en sala TV.')
            ),
            'syncMode' => self::buildTurneroHardwareReadiness(
                (string) ($operatorDetails['queueSyncMode'] ?? '') === 'live'
                    && (string) ($kioskDetails['connection'] ?? '') === 'live'
                    && (string) ($displayDetails['connection'] ?? '') === 'live',
                'Sync clínico',
                (
                    (string) ($operatorDetails['queueSyncMode'] ?? '') === 'live'
                    && (string) ($kioskDetails['connection'] ?? '') === 'live'
                    && (string) ($displayDetails['connection'] ?? '') === 'live'
                )
                    ? 'Operator, kiosk y display reportan sync vivo.'
                    : 'Alguna superficie sigue en fallback, paused u offline.'
            ),
        ];

        $surfaceBlockingCount = count(array_filter([
            !$operatorSurface['ready'],
            !$kioskSurface['ready'],
            !$displaySurface['ready'],
            !((bool) ($operatorAccessMeta['configured'] ?? false)),
        ]));
        $hardwareBlockingCount = count(array_filter([
            !((bool) ($hardware['assistant']['ready'] ?? false)),
            !((bool) ($hardware['printer']['ready'] ?? false)),
            !((bool) ($hardware['numpad']['ready'] ?? false)),
            !((bool) ($hardware['desktopShell']['ready'] ?? false)),
            !((bool) ($hardware['tvAudio']['ready'] ?? false)),
            !((bool) ($hardware['syncMode']['ready'] ?? false)),
        ]));
        $releaseEnabled = in_array($releaseMode, ['web_pilot', 'suite_v2'], true)
            && (string) ($release['admin_mode_default'] ?? '') === 'basic'
            && ($release['separate_deploy'] ?? null) === true
            && (($localWebPilot && $nativeAppsBlocking === false) || (!$localWebPilot && $releaseMode === 'suite_v2' && $nativeAppsBlocking === true));
        $blockingCount = $surfaceBlockingCount + $hardwareBlockingCount;

        return [
            'enabled' => $releaseEnabled,
            'releaseMode' => $releaseMode,
            'nativeAppsBlocking' => $nativeAppsBlocking,
            'ready' => $releaseEnabled && $blockingCount === 0,
            'blockingCount' => $releaseEnabled ? $blockingCount : 0,
            'surfaceBlockingCount' => $releaseEnabled ? $surfaceBlockingCount : 0,
            'hardwareBlockingCount' => $releaseEnabled ? $hardwareBlockingCount : 0,
            'operatorAccess' => [
                'configured' => (bool) ($operatorAccessMeta['configured'] ?? false),
                'detail' => (bool) ($operatorAccessMeta['configured'] ?? false)
                    ? 'PIN operativo configurado.'
                    : 'Falta configurar el PIN operativo de la clínica.',
            ],
            'surfaces' => [
                'admin' => $adminSurface,
                'operator' => $operatorSurface,
                'kiosk' => $kioskSurface,
                'display' => $displaySurface,
            ],
            'hardware' => $hardware,
            'generatedAt' => local_date('c'),
        ];
    }

    private static function buildTurneroSurfaceReadiness(
        string $surfaceKey,
        string $expectedAppMode,
        $surfaceGroup,
        bool $nativeAppsBlocking
    ): array {
        $group = is_array($surfaceGroup) ? $surfaceGroup : [];
        $latest = isset($group['latest']) && is_array($group['latest']) ? $group['latest'] : [];
        $appMode = trim((string) ($latest['appMode'] ?? ''));
        $effectiveStatus = trim((string) ($latest['effectiveStatus'] ?? $latest['status'] ?? 'unknown'));
        $statusReady = $effectiveStatus === 'ready' && (($latest['stale'] ?? true) !== true);
        $nativeModeReady = !$nativeAppsBlocking || $appMode === $expectedAppMode;
        $ready = $statusReady && $nativeModeReady;

        return [
            'surface' => $surfaceKey,
            'label' => (string) ($group['label'] ?? ucfirst($surfaceKey)),
            'expectedAppMode' => $expectedAppMode,
            'appMode' => $appMode,
            'ready' => $ready,
            'blocking' => true,
            'state' => $ready ? 'ready' : ($statusReady ? 'warning' : 'alert'),
            'summary' => $ready
                ? (string) ($group['summary'] ?? 'Superficie lista.')
                : (!$statusReady
                    ? (string) ($group['summary'] ?? 'Sin heartbeat listo.')
                    : sprintf(
                        'La superficie reporta %s, pero este release exige %s.',
                        $appMode !== '' ? $appMode : 'modo desconocido',
                        $expectedAppMode
                    )),
            'stale' => (bool) ($latest['stale'] ?? true),
            'updatedAt' => (string) ($latest['updatedAt'] ?? ''),
        ];
    }

    /**
     * @param mixed $surfaceGroup
     * @return array<string,mixed>
     */
    private static function surfaceLatestDetails($surfaceGroup): array
    {
        $group = is_array($surfaceGroup) ? $surfaceGroup : [];
        $latest = isset($group['latest']) && is_array($group['latest']) ? $group['latest'] : [];
        return isset($latest['details']) && is_array($latest['details']) ? $latest['details'] : [];
    }

    /**
     * @return array<string,mixed>
     */
    private static function buildTurneroHardwareReadiness(bool $ready, string $label, string $detail): array
    {
        return [
            'label' => $label,
            'ready' => $ready,
            'state' => $ready ? 'ready' : 'warning',
            'detail' => $detail,
        ];
    }

    private static function buildReviewsMeta(array $store): array
    {
        $surveys = is_array($store['nps_surveys'] ?? null) ? $store['nps_surveys'] : [];
        if (count($surveys) === 0) {
            return [
                'totalReviews' => 0,
                'averageRating' => 0.0,
                'last5Reviews' => [],
            ];
        }

        $totalRating = 0;
        $count = 0;
        $last5 = [];
        
        // Assume surveys are chronologically appended to store
        $reversed = array_reverse($surveys);

        foreach ($reversed as $index => $survey) {
            $rating = (int) ($survey['rating'] ?? 0);
            if ($rating >= 1 && $rating <= 5) {
                $totalRating += $rating;
                $count++;
                if ($index < 5) {
                    $last5[] = [
                        'name' => trim((string) ($survey['name'] ?? 'Anónimo')),
                        'rating' => $rating,
                        'text' => trim((string) ($survey['text'] ?? '')),
                        'date' => format_date_label(trim((string) ($survey['date'] ?? '')))
                    ];
                }
            }
        }

        return [
            'totalReviews' => $count,
            'averageRating' => $count > 0 ? (float) ($totalRating / $count) : 0.0,
            'last5Reviews' => $last5,
        ];
    }

    private static function businessMetrics(array $context): void
    {
        $store = $context['store'];
        if (!($context['isAdmin'] ?? false)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $periodString = trim((string)($_GET['period'] ?? '30d'));
        $periodDays = (int) preg_replace('/[^0-9]/', '', $periodString);
        if ($periodDays <= 0) $periodDays = 30;

        $cutoff = time() - ($periodDays * 86400);

        $appointments = $store['appointments'] ?? [];
        $total = 0;
        $noShows = 0;
        $completed = 0;
        $revenue = 0.0;
        $servicesCount = [];
        $patientPhones = [];

        foreach ($appointments as $appt) {
            $dateStr = trim((string)($appt['date'] ?? ''));
            $timeStr = trim((string)($appt['time'] ?? '00:00'));
            if ($dateStr === '') continue;
            
            $apptTime = strtotime($dateStr . ' ' . $timeStr);
            if ($apptTime < $cutoff || $apptTime > time()) {
                continue;
            }

            $status = strtolower(trim((string)($appt['status'] ?? '')));
            if ($status === 'cancelled') continue;

            $total++;
            $phone = trim((string)($appt['phone'] ?? ''));
            if ($phone !== '') {
                $patientPhones[$phone] = true;
            }

            if ($status === 'no_show') {
                $noShows++;
            } elseif (in_array($status, ['checked_in', 'completed'], true)) {
                $completed++;
                
                $service = strtolower(trim((string)($appt['service'] ?? '')));
                if ($service !== '') {
                    $servicesCount[$service] = ($servicesCount[$service] ?? 0) + 1;
                    $revenue += self::estimateServiceRevenue($service);
                }
            }
        }

        arsort($servicesCount);
        $topServices = array_slice(array_keys($servicesCount), 0, 3);
        
        $noShowRate = $total > 0 ? round(($noShows / $total) * 100, 1) : 0;
        $newPatientsEstimate = count($patientPhones);

        json_response([
            'ok' => true,
            'data' => [
                'period_days' => $periodDays,
                'appointments_total' => $total,
                'patients_seen' => $completed,
                'no_show_rate' => $noShowRate,
                'new_patients' => $newPatientsEstimate,
                'revenue_estimate' => $revenue,
                'top_services' => $topServices
            ]
        ]);
    }

    private static function estimateServiceRevenue(string $service): float
    {
        $prices = [
            'consulta' => 35.0,
            'laser' => 80.0,
            'acne' => 45.0,
            'rejuvenecimiento' => 120.0,
            'cancer' => 50.0,
            'video' => 30.0,
            'telefono' => 20.0
        ];
        return $prices[$service] ?? 35.0;
    }

    private static function chronicPanel(array $context): void
    {
        self::requireAuth($context);
        $store = $context['store'];
        
        $patients = $store['patients'] ?? [];
        $nowTs = time();
        $chronicList = [];

        foreach ($patients as $caseId => $patient) {
            $conditions = $patient['chronicConditions'] ?? [];
            if (!is_array($conditions)) continue;

            $activeConditions = [];
            $maxOverdue = 0;
            $status = 'controlled';
            $lastControl = '';

            foreach ($conditions as $c) {
                $cStatus = $c['status'] ?? 'controlled';
                $condCode = $c['cie10Code'] ?? '';
                if ($condCode !== '') {
                    $activeConditions[] = $condCode;
                }

                $cDueStr = $c['nextControlDue'] ?? '';
                $cDueTs = strtotime($cDueStr);
                $cLast = $c['lastControlDate'] ?? '';

                if ($cLast !== '' && ($lastControl === '' || strtotime($cLast) > strtotime($lastControl))) {
                    $lastControl = $cLast;
                }

                if ($cDueTs && $cDueTs < $nowTs) {
                    $overdue = (int) ceil(($nowTs - $cDueTs) / 86400);
                    if ($overdue > $maxOverdue) {
                        $maxOverdue = $overdue;
                        $status = 'overdue';
                    }
                }
                if ($cStatus === 'uncontrolled' || $cStatus === 'lost_to_followup') {
                    $status = $cStatus;
                }
            }

            if (!empty($activeConditions)) {
                $chronicList[] = [
                    'case_id' => $caseId,
                    'name' => trim(($patient['firstName'] ?? '') . ' ' . ($patient['lastName'] ?? '')),
                    'conditions' => $activeConditions,
                    'last_control' => $lastControl,
                    'days_overdue' => $maxOverdue,
                    'status' => $status
                ];
            }
        }

        usort($chronicList, function($a, $b) {
            return $b['days_overdue'] <=> $a['days_overdue'];
        });

        json_response([
            'ok' => true,
            'patients' => $chronicList
        ]);
    }

    private static function patientLtv(array $context): void
    {
        self::requireAuth($context);
        $store = $context['store'];

        $caseId = trim((string)($_GET['case_id'] ?? ''));
        // If no caseId, standard S26-05 logic for all patients (lifetime value list)
        if ($caseId === '') {
            $patients = $store['patients'] ?? [];
            $list = [];
            foreach ($patients as $cId => $p) {
                // Mock values for S26-05 pending
                $list[] = [
                    'case_id' => $cId,
                    'name' => trim(($p['firstName'] ?? '') . ' ' . ($p['lastName'] ?? '')),
                    'ltv' => rand(50, 500),
                    'last_visit' => local_date('Y-m-d'),
                    'days_absent' => rand(5, 120)
                ];
            }
            json_response(['ok' => true, 'patients' => $list]);
        }

        $drafts = $store['clinical_history_drafts'] ?? [];
        $sessions = [];
        foreach ($drafts as $d) {
            if (($d['caseId'] ?? '') === $caseId) {
                $sessions[] = $d;
            }
        }
        
        usort($sessions, function($a, $b) {
            return strtotime($a['createdAt'] ?? '') <=> strtotime($b['createdAt'] ?? '');
        });

        $adherenceLog = [];
        $lastExpectedEnd = 0;

        foreach ($sessions as $i => $s) {
            $visitDate = strtotime($s['createdAt'] ?? '');
            if (!$visitDate) continue;

            if ($lastExpectedEnd > 0) {
                $diffDays = (int) round(($visitDate - $lastExpectedEnd) / 86400);
                $score = 'on_time';
                if ($diffDays < -10) $score = 'early';
                elseif ($diffDays > 10) $score = 'late';
                
                $adherenceLog[] = [
                    'session_id' => $s['id'] ?? '',
                    'date' => gmdate('Y-m-d', $visitDate),
                    'expected_end' => gmdate('Y-m-d', $lastExpectedEnd),
                    'days_diff' => $diffDays,
                    'score' => $score
                ];
            }

            foreach (($s['prescriptions'] ?? []) as $presc) {
                $dur = (int) ($presc['durationDays'] ?? 0);
                if ($dur > 0) {
                    $newExpectedEnd = $visitDate + ($dur * 86400);
                    if ($newExpectedEnd > $lastExpectedEnd) {
                        $lastExpectedEnd = $newExpectedEnd;
                    }
                }
            }
        }

        json_response([
            'ok' => true,
            'case_id' => $caseId,
            'medication_adherence' => [
                'log' => $adherenceLog,
                'overall_score' => !empty($adherenceLog) ? end($adherenceLog)['score'] : 'unknown'
            ]
        ]);
    }

    public static function __adverseReactionReport(array $context): void
    {
        self::requireAuth($context);
        
        $payload = require_json_body();
        $caseId = trim((string)($payload['case_id'] ?? ''));
        $drugName = trim((string)($payload['drug_name'] ?? ''));
        $reactionDesc = trim((string)($payload['reaction_description'] ?? ''));
        $severity = trim((string)($payload['severity'] ?? ''));
        $actionTaken = trim((string)($payload['action_taken'] ?? ''));
        $onsetDate = trim((string)($payload['onset_date'] ?? ''));
        
        if ($caseId === '' || $drugName === '' || $reactionDesc === '' || $severity === '' || $actionTaken === '') {
            json_response(['ok' => false, 'error' => 'case_id, drug_name, reaction_description, severity, action_taken son obligatorios'], 400);
        }

        $record = [
            'caseId' => $caseId,
            'drugName' => $drugName,
            'reactionDescription' => $reactionDesc,
            'severity' => $severity,
            'onsetDate' => $onsetDate ?: local_date('Y-m-d'),
            'actionTaken' => $actionTaken,
            'reportedAt' => gmdate('c'),
            'reportedBy' => $_SESSION['admin_email'] ?? 'sys'
        ];

        $reactionsFile = __DIR__ . '/../data/adverse-reactions.jsonl';
        file_put_contents($reactionsFile, json_encode($record, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);

        $alertSent = false;
        if ($severity === 'severe' || $severity === 'life_threatening') {
            require_once __DIR__ . '/../lib/whatsapp_openclaw/bootstrap.php';
            $clinicProfile = read_clinic_profile();
            $adminPhone = $clinicProfile['phones'][0] ?? '+593982453672';
            $adminPhone = preg_replace('/\D+/', '', $adminPhone);

            if ($adminPhone !== '') {
                $msg = "⚠️ ALERTA RAM: Reacción {$severity} a {$drugName} en paciente {$caseId}. Acción: {$actionTaken}. Desc: {$reactionDesc}";
                whatsapp_openclaw_repository()->enqueueOutbox([
                    'to' => '+' . $adminPhone,
                    'text' => $msg,
                    'context' => 'adverse_reaction_alert'
                ]);
                $alertSent = true;
            }
        }

        json_response([
            'ok' => true,
            'alert_sent' => $alertSent
        ]);
    }

    private static function requireAuth(array $context): void
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
