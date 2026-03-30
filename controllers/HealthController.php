<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/TurneroClinicProfile.php';
require_once __DIR__ . '/../lib/TurneroOperatorAccess.php';
require_once __DIR__ . '/../lib/telemedicine/TelemedicineOpsSnapshot.php';
require_once __DIR__ . '/../lib/PatientCaseService.php';
require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';
require_once __DIR__ . '/../lib/openclaw/AIRouter.php';
require_once __DIR__ . '/../lib/DoctorProfileStore.php';
require_once __DIR__ . '/../lib/ClinicProfileStore.php';
require_once __DIR__ . '/../lib/whatsapp_openclaw/bootstrap.php';

class HealthController
{
    public static function check(array $context): void
    {
        $requestStartedAt = $context['requestStartedAt'] ?? microtime(true);
        $method = $context['method'] ?? 'GET';
        $resource = $context['resource'] ?? 'health';

        $storageReady = ensure_data_file();
        $dataWritable = data_dir_writable();
        $storeEncrypted = store_file_is_encrypted();
        $storeEncryptionConfigured = function_exists('storage_encryption_configured')
            ? storage_encryption_configured()
            : false;
        $storeEncryptionRequired = function_exists('storage_encryption_required')
            ? storage_encryption_required()
            : false;
        $storeEncryptionStatus = function_exists('storage_encryption_status')
            ? storage_encryption_status()
            : ($storeEncrypted ? 'encrypted' : 'plaintext');
        $storeEncryptionCompliant = function_exists('storage_encryption_compliant')
            ? storage_encryption_compliant()
            : (!$storeEncryptionRequired || $storeEncrypted);
        $dataDirSource = function_exists('data_dir_source') ? data_dir_source() : 'unknown';
        $storageBackend = function_exists('storage_backend_mode') ? storage_backend_mode() : 'unknown';
        $sqliteDriverAvailable = function_exists('storage_sqlite_available') ? storage_sqlite_available() : false;
        $jsonFallbackEnabled = function_exists('storage_json_fallback_enabled')
            ? storage_json_fallback_enabled()
            : false;
        $figoEndpoint = self::resolve_figo_endpoint();
        $figoConfigured = $figoEndpoint !== '';
        $figoRecursive = self::is_figo_recursive_config($figoEndpoint);
        $calendarService = CalendarAvailabilityService::fromEnv();
        $calendarActive = $calendarService->isGoogleActive();
        $calendarRequired = $calendarService->isGoogleRequired();
        $calendarRequirementMet = $calendarService->isGoogleRequirementMet();
        $calendarClientConfigured = $calendarActive
            ? $calendarService->getClient()->isConfigured()
            : true;
        $calendarStatusSnapshot = GoogleCalendarClient::readStatusSnapshot();
        $calendarLastSuccessAt = (string) ($calendarStatusSnapshot['lastSuccessAt'] ?? '');
        $calendarLastErrorAt = (string) ($calendarStatusSnapshot['lastErrorAt'] ?? '');
        $calendarLastErrorReason = (string) ($calendarStatusSnapshot['lastErrorReason'] ?? '');
        $calendarReachable = self::resolveCalendarReachable(
            $calendarActive,
            $calendarRequired,
            $calendarClientConfigured,
            $calendarLastSuccessAt,
            $calendarLastErrorAt
        );
        $calendarMode = self::resolveCalendarMode(
            $calendarActive,
            $calendarRequired,
            $calendarService->getBlockOnFailure(),
            $calendarReachable
        );
        $calendarSource = $calendarActive ? 'google' : 'store';
        $calendarAuth = $calendarActive ? $calendarService->getClient()->getAuthMode() : 'none';
        $calendarTokenSnapshot = GoogleTokenProvider::readStatusSnapshot();
        $calendarTokenHealthy = self::resolveCalendarTokenHealthy(
            $calendarActive,
            $calendarRequired,
            $calendarClientConfigured,
            $calendarAuth,
            $calendarTokenSnapshot
        );
        $servicesCatalog = self::collectServiceCatalogSnapshot();
        $sentryBackendConfigured = trim((string) app_env('AURORADERM_SENTRY_DSN', '')) !== '';
        $sentryFrontendConfigured = trim((string) app_env('AURORADERM_SENTRY_DSN_PUBLIC', '')) !== '';
        $redisStatus = app_env('AURORADERM_REDIS_HOST') ? 'configured' : 'disabled';
        $idempotencySnapshot = self::collectIdempotencySnapshot();
        $store = isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store();
        $patientCaseService = new PatientCaseService();
        $store = $patientCaseService->hydrateStore($store);
        $patientFlowSnapshot = $patientCaseService->buildSummary($store);
        $authSnapshot = self::collectAuthSnapshot();
        $internalConsoleSnapshot = function_exists('internal_console_readiness_snapshot')
            ? internal_console_readiness_snapshot()
            : [];
        $telemedicineSnapshot = class_exists('TelemedicineOpsSnapshot')
            ? TelemedicineOpsSnapshot::build($store)
            : ['configured' => false];
        $turneroPilotSnapshot = read_turnero_clinic_profile_health_snapshot();
        $whatsappOpenclawSnapshot = function_exists('whatsapp_openclaw_health_snapshot')
            ? whatsapp_openclaw_health_snapshot($store)
            : ['configured' => false];
        $leadOpsSnapshot = LeadOpsService::buildHealthSnapshot($store);
        $aiRouterSnapshot = self::collectAiRouterSnapshot();
        $dataFilesSnapshot = self::collectDataFilesSnapshot();
        $doctorProfileSnapshot = self::collectDoctorProfileSnapshot();
        $clinicProfileSnapshot = self::collectClinicProfileSnapshot();
        $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
        $confirmedAppointments = 0;
        foreach ($appointments as $appointment) {
            $status = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
            if ($status !== 'cancelled') {
                $confirmedAppointments++;
            }
        }
        $storeCounts = [
            'appointments' => count($appointments),
            'appointmentsActive' => $confirmedAppointments,
            'callbacks' => isset($store['callbacks']) && is_array($store['callbacks']) ? count($store['callbacks']) : 0,
            'reviews' => isset($store['reviews']) && is_array($store['reviews']) ? count($store['reviews']) : 0,
            'availabilityDays' => isset($store['availability']) && is_array($store['availability']) ? count($store['availability']) : 0,
            'patientCases' => isset($store['patient_cases']) && is_array($store['patient_cases']) ? count($store['patient_cases']) : 0,
        ];

        $backupCheck = [
            'enabled' => false
        ];
        if (function_exists('backup_latest_status')) {
            if (function_exists('backup_latest_status_fast')) {
                $backupStatus = backup_latest_status_fast();
            } else {
                $backupStatus = backup_latest_status();
            }
            $backupCheck = [
                'enabled' => true,
                'ok' => (bool) ($backupStatus['ok'] ?? false),
                'reason' => (string) ($backupStatus['reason'] ?? ''),
                'count' => (int) ($backupStatus['count'] ?? 0),
                'maxAgeHours' => (int) ($backupStatus['maxAgeHours'] ?? 24),
                'latestAgeHours' => $backupStatus['latestAgeHours'] ?? null,
                'latestValid' => (bool) ($backupStatus['latestValid'] ?? false),
                'latestFresh' => (bool) ($backupStatus['latestFresh'] ?? false),
                'autoRefresh' => isset($backupStatus['autoRefresh']) && is_array($backupStatus['autoRefresh'])
                    ? $backupStatus['autoRefresh']
                    : null,
                'offsiteConfigured' => function_exists('backup_offsite_configured') ? backup_offsite_configured() : false,
                'replicaMode' => function_exists('backup_replica_mode') ? backup_replica_mode() : 'none'
            ];
        }
        $publicSyncCheck = function_exists('public_sync_health_snapshot')
            ? public_sync_health_snapshot()
            : [
                'configured' => false,
                'jobId' => '',
                'jobKey' => 'public_main_sync',
                'mode' => 'external_cron',
                'schedule' => '',
                'statusPath' => '',
                'logPath' => '',
                'lockFile' => '',
                'state' => 'unknown',
                'healthy' => false,
                'operationallyHealthy' => false,
                'repoHygieneIssue' => false,
                'ageSeconds' => null,
                'expectedMaxLagSeconds' => 120,
                'lastCheckedAt' => '',
                'lastSuccessAt' => '',
                'lastErrorAt' => '',
                'lastErrorMessage' => '',
                'failureReason' => '',
                'deployedCommit' => '',
            ];

        $timingMs = (int) round((microtime(true) - $requestStartedAt) * 1000);

        audit_log_event('api.health', [
            'method' => $method,
            'resource' => $resource,
            'diagnosticsVisible' => diagnostics_request_authorized($context),
            'storageReady' => $storageReady,
            'timingMs' => $timingMs,
            'version' => app_runtime_version(),
            'dataDirSource' => $dataDirSource,
            'storageBackend' => $storageBackend,
            'sqliteDriverAvailable' => $sqliteDriverAvailable,
            'jsonFallbackEnabled' => $jsonFallbackEnabled,
            'storeEncryptionConfigured' => $storeEncryptionConfigured,
            'storeEncryptionRequired' => $storeEncryptionRequired,
            'storeEncryptionStatus' => $storeEncryptionStatus,
            'storeEncryptionCompliant' => $storeEncryptionCompliant,
            'authMode' => (string) ($authSnapshot['mode'] ?? 'unknown'),
            'authStatus' => (string) ($authSnapshot['status'] ?? 'unknown'),
            'authConfigured' => (bool) ($authSnapshot['configured'] ?? false),
            'authHardeningCompliant' => (bool) ($authSnapshot['hardeningCompliant'] ?? false),
            'authTwoFactorEnabled' => (bool) ($authSnapshot['twoFactorEnabled'] ?? false),
            'internalConsoleReady' => (bool) (($internalConsoleSnapshot['overall']['ready'] ?? false)),
            'internalConsoleStatus' => (string) (($internalConsoleSnapshot['overall']['status'] ?? 'unknown')),
            'figoConfigured' => $figoConfigured,
            'figoRecursiveConfig' => $figoRecursive,
            'calendarConfigured' => $calendarClientConfigured,
            'calendarReachable' => $calendarReachable,
            'calendarMode' => $calendarMode,
            'calendarSource' => $calendarSource,
            'calendarRequired' => $calendarRequired,
            'calendarRequirementMet' => $calendarRequirementMet,
            'calendarLastSuccessAt' => $calendarLastSuccessAt,
            'calendarLastErrorAt' => $calendarLastErrorAt,
            'calendarLastErrorReason' => $calendarLastErrorReason,
            'calendarTokenHealthy' => $calendarTokenHealthy,
            'sentryBackendConfigured' => $sentryBackendConfigured,
            'sentryFrontendConfigured' => $sentryFrontendConfigured,
            'servicesCatalogSource' => (string) ($servicesCatalog['source'] ?? 'unknown'),
            'servicesCatalogVersion' => (string) ($servicesCatalog['version'] ?? 'unknown'),
            'servicesCatalogCount' => (int) ($servicesCatalog['servicesCount'] ?? 0),
            'servicesCatalogConfigured' => (bool) ($servicesCatalog['configured'] ?? false),
            'idempotencyRequestsWithKey' => (int) ($idempotencySnapshot['requestsWithKey'] ?? 0),
            'idempotencyConflictRatePct' => (float) ($idempotencySnapshot['conflictRatePct'] ?? 0.0),
            'telemedicineReviewQueueCount' => (int) ($telemedicineSnapshot['reviewQueue']['count'] ?? 0),
            'telemedicineUnlinkedIntakesCount' => (int) ($telemedicineSnapshot['integrity']['unlinkedIntakesCount'] ?? 0),
            'telemedicineStagedLegacyUploadsCount' => (int) ($telemedicineSnapshot['integrity']['stagedLegacyUploadsCount'] ?? 0),
            'whatsappConfigured' => (bool) ($whatsappOpenclawSnapshot['configured'] ?? false),
            'whatsappConfiguredMode' => (string) ($whatsappOpenclawSnapshot['configuredMode'] ?? ''),
            'whatsappBridgeMode' => (string) ($whatsappOpenclawSnapshot['bridgeMode'] ?? ''),
            'whatsappBookingsClosed' => (int) ($whatsappOpenclawSnapshot['bookingsClosed'] ?? 0),
            'whatsappPaymentsStarted' => (int) ($whatsappOpenclawSnapshot['paymentsStarted'] ?? 0),
            'whatsappPaymentsCompleted' => (int) ($whatsappOpenclawSnapshot['paymentsCompleted'] ?? 0),
            'leadOpsMode' => (string) ($leadOpsSnapshot['mode'] ?? 'disabled'),
            'leadOpsPendingCallbacks' => (int) ($leadOpsSnapshot['pendingCallbacks'] ?? 0),
            'leadOpsWorkerDegraded' => (bool) ($leadOpsSnapshot['degraded'] ?? true),
            'aiRouterMode' => (string) ($aiRouterSnapshot['router_mode'] ?? 'unknown'),
            'aiRouterActiveProvider' => (string) ($aiRouterSnapshot['active_provider'] ?? 'local_heuristic'),
            'aiRouterDegraded' => (bool) ($aiRouterSnapshot['degraded'] ?? false),
            'doctorProfileLoaded' => (bool) ($doctorProfileSnapshot['loaded'] ?? false),
            'clinicProfileLoaded' => (bool) ($clinicProfileSnapshot['loaded'] ?? false),
            'healthDataFilesOk' => (bool) ($dataFilesSnapshot['ok'] ?? false),
            'publicSyncConfigured' => (bool) ($publicSyncCheck['configured'] ?? false),
            'publicSyncHealthy' => (bool) ($publicSyncCheck['healthy'] ?? false),
            'publicSyncRepoHygieneIssue' => (bool) ($publicSyncCheck['repoHygieneIssue'] ?? false),
            'publicSyncState' => (string) ($publicSyncCheck['state'] ?? 'unknown'),
            'publicSyncAgeSeconds' => $publicSyncCheck['ageSeconds'] ?? null,
            'turneroPilotClinicId' => (string) ($turneroPilotSnapshot['clinicId'] ?? ''),
            'turneroPilotReady' => (bool) ($turneroPilotSnapshot['ready'] ?? false),
            'turneroPilotCatalogReady' => (bool) ($turneroPilotSnapshot['catalogReady'] ?? false),
        ]);
        $detailedPayload = [
            'ok' => true,
            'status' => 'ok',
            'storageReady' => $storageReady,
            'timingMs' => $timingMs,
            'version' => app_runtime_version(),
            'dataDirWritable' => $dataWritable,
            'dataDirSource' => $dataDirSource,
            'storageBackend' => $storageBackend,
            'sqliteDriverAvailable' => $sqliteDriverAvailable,
            'jsonFallbackEnabled' => $jsonFallbackEnabled,
            'storeEncrypted' => $storeEncrypted,
            'storeEncryptionConfigured' => $storeEncryptionConfigured,
            'storeEncryptionRequired' => $storeEncryptionRequired,
            'storeEncryptionStatus' => $storeEncryptionStatus,
            'storeEncryptionCompliant' => $storeEncryptionCompliant,
            'authMode' => (string) ($authSnapshot['mode'] ?? 'unknown'),
            'authStatus' => (string) ($authSnapshot['status'] ?? 'unknown'),
            'authConfigured' => (bool) ($authSnapshot['configured'] ?? false),
            'authHardeningCompliant' => (bool) ($authSnapshot['hardeningCompliant'] ?? false),
            'internalConsoleMode' => (string) (($internalConsoleSnapshot['mode'] ?? 'consultorio_core')),
            'internalConsoleReady' => (bool) (($internalConsoleSnapshot['overall']['ready'] ?? false)),
            'internalConsoleStatus' => (string) (($internalConsoleSnapshot['overall']['status'] ?? 'unknown')),
            'figoConfigured' => $figoConfigured,
            'figoRecursiveConfig' => $figoRecursive,
            'calendarConfigured' => $calendarClientConfigured,
            'calendarReachable' => $calendarReachable,
            'calendarMode' => $calendarMode,
            'calendarSource' => $calendarSource,
            'calendarAuth' => $calendarAuth,
            'calendarRequired' => $calendarRequired,
            'calendarRequirementMet' => $calendarRequirementMet,
            'calendarTokenHealthy' => $calendarTokenHealthy,
            'calendarLastSuccessAt' => $calendarLastSuccessAt,
            'calendarLastErrorAt' => $calendarLastErrorAt,
            'calendarLastErrorReason' => $calendarLastErrorReason,
            'sentryBackendConfigured' => $sentryBackendConfigured,
            'sentryFrontendConfigured' => $sentryFrontendConfigured,
            'servicesCatalogSource' => (string) ($servicesCatalog['source'] ?? 'unknown'),
            'servicesCatalogVersion' => (string) ($servicesCatalog['version'] ?? 'unknown'),
            'servicesCatalogCount' => (int) ($servicesCatalog['servicesCount'] ?? 0),
            'servicesCatalogConfigured' => (bool) ($servicesCatalog['configured'] ?? false),
            'tiers' => self::publicAiRouterSummary($aiRouterSnapshot),
            'data_files' => self::publicDataFilesSummary($dataFilesSnapshot),
            'doctor_profile' => self::publicProfileSummary($doctorProfileSnapshot),
            'clinic_profile' => self::publicProfileSummary($clinicProfileSnapshot),
            'idempotency' => $idempotencySnapshot,
            'checks' => [
                'storage' => [
                    'ready' => $storageReady,
                    'writable' => $dataWritable,
                    'encrypted' => $storeEncrypted,
                    'encryptionConfigured' => $storeEncryptionConfigured,
                    'encryptionRequired' => $storeEncryptionRequired,
                    'encryptionStatus' => $storeEncryptionStatus,
                    'encryptionCompliant' => $storeEncryptionCompliant,
                    'source' => $dataDirSource,
                    'backend' => $storageBackend,
                    'sqliteDriverAvailable' => $sqliteDriverAvailable,
                    'jsonFallbackEnabled' => $jsonFallbackEnabled
                ],
                'auth' => $authSnapshot,
                'internalConsole' => $internalConsoleSnapshot,
                'redis' => $redisStatus,
                'php_version' => PHP_VERSION,
                'calendar' => [
                    'calendarConfigured' => $calendarClientConfigured,
                    'calendarReachable' => $calendarReachable,
                    'calendarMode' => $calendarMode,
                    'calendarSource' => $calendarSource,
                    'calendarAuth' => $calendarAuth,
                    'calendarRequired' => $calendarRequired,
                    'calendarRequirementMet' => $calendarRequirementMet,
                    'calendarTokenHealthy' => $calendarTokenHealthy,
                    'calendarLastSuccessAt' => $calendarLastSuccessAt,
                    'calendarLastErrorAt' => $calendarLastErrorAt,
                    'calendarLastErrorReason' => $calendarLastErrorReason,
                ],
                'observability' => [
                    'sentryBackendConfigured' => $sentryBackendConfigured,
                    'sentryFrontendConfigured' => $sentryFrontendConfigured,
                ],
                'servicesCatalog' => [
                    'source' => (string) ($servicesCatalog['source'] ?? 'unknown'),
                    'version' => (string) ($servicesCatalog['version'] ?? 'unknown'),
                    'timezone' => (string) ($servicesCatalog['timezone'] ?? 'America/Guayaquil'),
                    'servicesCount' => (int) ($servicesCatalog['servicesCount'] ?? 0),
                    'configured' => (bool) ($servicesCatalog['configured'] ?? false),
                ],
                'idempotency' => $idempotencySnapshot,
                'telemedicine' => class_exists('TelemedicineOpsSnapshot')
                    ? TelemedicineOpsSnapshot::forHealth($telemedicineSnapshot)
                    : ['configured' => false],
                'turneroPilot' => $turneroPilotSnapshot,
                'whatsappOpenclaw' => $whatsappOpenclawSnapshot,
                'leadOps' => $leadOpsSnapshot,
                'aiRouter' => $aiRouterSnapshot,
                'dataFiles' => $dataFilesSnapshot,
                'doctorProfile' => $doctorProfileSnapshot,
                'clinicProfile' => $clinicProfileSnapshot,
                'backup' => $backupCheck,
                'publicSync' => $publicSyncCheck,
                'patientFlow' => $patientFlowSnapshot,
                'storeCounts' => $storeCounts
            ],
            'timestamp' => local_date('c')
        ];

        if (diagnostics_request_authorized($context)) {
            json_response($detailedPayload);
        }

        json_response(self::publicPayload($detailedPayload));
    }

    public static function diagnostics(array $context): void
    {
        if (!diagnostics_request_authorized($context)) {
            audit_log_event('api.health_diagnostics_blocked', [
                'method' => (string) ($context['method'] ?? 'GET'),
                'resource' => (string) ($context['resource'] ?? 'health-diagnostics'),
            ]);
            json_response([
                'ok' => false,
                'error' => 'No autorizado',
            ], 403);
        }

        $context['diagnosticsAuthorized'] = true;
        self::check($context);
    }

    /**
     * @return array{source:string,version:string,timezone:string,servicesCount:int,configured:bool}
     */
    private static function collectServiceCatalogSnapshot(): array
    {
        $catalogPath = self::resolveServiceCatalogPath();
        if ($catalogPath === '' || !is_file($catalogPath)) {
            return [
                'source' => 'missing',
                'version' => 'missing',
                'timezone' => 'America/Guayaquil',
                'servicesCount' => 0,
                'configured' => false,
            ];
        }

        $raw = @file_get_contents($catalogPath);
        if (!is_string($raw) || trim($raw) === '') {
            return [
                'source' => 'invalid',
                'version' => 'invalid',
                'timezone' => 'America/Guayaquil',
                'servicesCount' => 0,
                'configured' => false,
            ];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [
                'source' => 'invalid',
                'version' => 'invalid',
                'timezone' => 'America/Guayaquil',
                'servicesCount' => 0,
                'configured' => false,
            ];
        }

        $services = $decoded['services'] ?? [];
        if (!is_array($services)) {
            $services = [];
        }

        $version = (string) ($decoded['version'] ?? 'unknown');
        if (trim($version) === '') {
            $version = 'unknown';
        }
        $timezone = (string) ($decoded['timezone'] ?? 'America/Guayaquil');
        if (trim($timezone) === '') {
            $timezone = 'America/Guayaquil';
        }

        return [
            'source' => 'file',
            'version' => $version,
            'timezone' => $timezone,
            'servicesCount' => count($services),
            'configured' => true,
        ];
    }

    private static function resolveServiceCatalogPath(): string
    {
        $override = app_env('AURORADERM_SERVICES_CATALOG_FILE');
        if (is_string($override) && trim($override) !== '') {
            return trim($override);
        }
        return __DIR__ . '/../content/services.json';
    }

    /**
     * @return array{
     *   mode:string,
     *   status:string,
     *   configured:bool,
     *   hardeningCompliant:bool,
     *   recommendedMode:string,
     *   recommendedModeActive:bool,
     *   legacyPasswordConfigured:bool,
     *   twoFactorEnabled:bool,
     *   operatorAuthEnabled:bool,
     *   operatorAuthConfigured:bool,
     *   brokerTrustConfigured:bool,
     *   brokerIssuerPinned:bool,
     *   brokerAudiencePinned:bool,
     *   brokerJwksConfigured:bool,
     *   brokerEmailVerifiedRequired:bool
     * }
     */
    private static function collectAuthSnapshot(): array
    {
        $recommendedMode = function_exists('operator_auth_recommended_mode')
            ? (string) operator_auth_recommended_mode()
            : (defined('OPERATOR_AUTH_SOURCE') ? (string) OPERATOR_AUTH_SOURCE : 'google_oauth');
        $operatorAuthConfig = function_exists('operator_auth_configuration_snapshot')
            ? operator_auth_configuration_snapshot()
            : [];
        $operatorAuthEnabled = array_key_exists('enabled', $operatorAuthConfig)
            ? (bool) $operatorAuthConfig['enabled']
            : (function_exists('operator_auth_is_enabled') ? operator_auth_is_enabled() : false);
        $operatorAuthConfigured = array_key_exists('configured', $operatorAuthConfig)
            ? (bool) $operatorAuthConfig['configured']
            : (function_exists('operator_auth_is_configured') ? operator_auth_is_configured() : false);
        $legacyPasswordConfigured = function_exists('admin_password_is_configured') ? admin_password_is_configured() : false;
        $twoFactorEnabled = trim((string) app_env('AURORADERM_ADMIN_2FA_SECRET', '')) !== '';
        $mode = $operatorAuthEnabled && array_key_exists('mode', $operatorAuthConfig)
            ? (string) $operatorAuthConfig['mode']
            : ($operatorAuthEnabled && function_exists('operator_auth_mode')
                ? (string) operator_auth_mode()
                : 'legacy_password');
        if (trim($mode) === '') {
            $mode = 'legacy_password';
        }

        $configured = $operatorAuthEnabled ? $operatorAuthConfigured : $legacyPasswordConfigured;
        $status = $configured
            ? 'configured'
            : ($operatorAuthEnabled ? 'operator_auth_not_configured' : 'legacy_auth_not_configured');
        $brokerTrustConfigured = (bool) ($operatorAuthConfig['brokerTrustConfigured'] ?? false);
        $brokerIssuerPinned = (bool) ($operatorAuthConfig['brokerIssuerPinned'] ?? false);
        $brokerAudiencePinned = (bool) ($operatorAuthConfig['brokerAudiencePinned'] ?? false);
        $brokerJwksConfigured = (bool) ($operatorAuthConfig['brokerJwksConfigured'] ?? false);
        $brokerEmailVerifiedRequired = (bool) ($operatorAuthConfig['brokerEmailVerifiedRequired'] ?? true);
        $hardeningCompliant = $configured && (
            ($operatorAuthEnabled
                && $mode === $recommendedMode
                && $brokerTrustConfigured
                && $brokerIssuerPinned
                && $brokerAudiencePinned
                && $brokerJwksConfigured
                && $brokerEmailVerifiedRequired)
            || (!$operatorAuthEnabled && $mode === 'legacy_password' && $twoFactorEnabled)
        );
        $operatorPinMeta = turnero_operator_access_meta();

        return [
            'mode' => $mode,
            'status' => $status,
            'configured' => $configured,
            'hardeningCompliant' => $hardeningCompliant,
            'recommendedMode' => $recommendedMode,
            'recommendedModeActive' => $mode === $recommendedMode,
            'legacyPasswordConfigured' => $legacyPasswordConfigured,
            'twoFactorEnabled' => $twoFactorEnabled,
            'operatorAuthEnabled' => $operatorAuthEnabled,
            'operatorAuthConfigured' => $operatorAuthConfigured,
            'brokerTrustConfigured' => $brokerTrustConfigured,
            'brokerIssuerPinned' => $brokerIssuerPinned,
            'brokerAudiencePinned' => $brokerAudiencePinned,
            'brokerJwksConfigured' => $brokerJwksConfigured,
            'brokerEmailVerifiedRequired' => $brokerEmailVerifiedRequired,
            'operatorPinMode' => TURNERO_OPERATOR_MODE,
            'operatorPinConfigured' => (bool) ($operatorPinMeta['configured'] ?? false),
            'operatorPinSessionTtlHours' => (int) ($operatorPinMeta['sessionTtlHours'] ?? TURNERO_OPERATOR_DEFAULT_SESSION_TTL_HOURS),
            'operatorAuthMissing' => is_array($operatorAuthConfig['missing'] ?? null)
                ? array_values($operatorAuthConfig['missing'])
                : [],
            'operatorAuthAllowedEmailCount' => (int) ($operatorAuthConfig['allowedEmailCount'] ?? 0),
        ];
    }

    /**
     * @param array<string,mixed> $detailedPayload
     * @return array<string,mixed>
     */
    private static function publicPayload(array $detailedPayload): array
    {
        $payload = [
            'ok' => (bool) ($detailedPayload['ok'] ?? false),
            'status' => (string) ($detailedPayload['status'] ?? 'unknown'),
            'storageReady' => (bool) ($detailedPayload['storageReady'] ?? false),
            'dataDirWritable' => (bool) ($detailedPayload['dataDirWritable'] ?? false),
            'timingMs' => (int) ($detailedPayload['timingMs'] ?? 0),
            'version' => (string) ($detailedPayload['version'] ?? app_runtime_version()),
            'timestamp' => (string) ($detailedPayload['timestamp'] ?? local_date('c')),
        ];
        foreach (['tiers', 'data_files', 'doctor_profile', 'clinic_profile'] as $field) {
            if (array_key_exists($field, $detailedPayload)) {
                $payload[$field] = $detailedPayload[$field];
            }
        }
        foreach (self::publicCalendarSummaryFields($detailedPayload) as $key => $value) {
            $payload[$key] = $value;
        }

        $publicSync = self::publicSyncSummaryPayload(
            $detailedPayload['checks']['publicSync'] ?? null
        );
        if ($publicSync !== null) {
            $payload['checks'] = [
                'publicSync' => $publicSync,
            ];
        }

        return $payload;
    }

    private static function publicCalendarSummaryFields(array $detailedPayload): array
    {
        $fields = [
            'calendarConfigured',
            'calendarReachable',
            'calendarMode',
            'calendarSource',
            'calendarAuth',
            'calendarTokenHealthy',
            'calendarLastSuccessAt',
            'calendarLastErrorAt',
            'calendarLastErrorReason',
        ];
        $payload = [];
        foreach ($fields as $field) {
            if (array_key_exists($field, $detailedPayload)) {
                $payload[$field] = $detailedPayload[$field];
            }
        }

        return $payload;
    }

    private static function publicSyncSummaryPayload($raw): ?array
    {
        if (!is_array($raw)) {
            return null;
        }

        return [
            'configured' => (bool) ($raw['configured'] ?? false),
            'jobId' => (string) ($raw['jobId'] ?? ''),
            'healthy' => (bool) ($raw['healthy'] ?? false),
            'operationallyHealthy' => (bool) ($raw['operationallyHealthy'] ?? false),
            'repoHygieneIssue' => (bool) ($raw['repoHygieneIssue'] ?? false),
            'state' => (string) ($raw['state'] ?? 'unknown'),
            'ageSeconds' => array_key_exists('ageSeconds', $raw)
                ? $raw['ageSeconds']
                : null,
            'expectedMaxLagSeconds' => (int) ($raw['expectedMaxLagSeconds'] ?? 120),
            'lastCheckedAt' => (string) ($raw['lastCheckedAt'] ?? ''),
            'lastSuccessAt' => (string) ($raw['lastSuccessAt'] ?? ''),
            'lastErrorAt' => (string) ($raw['lastErrorAt'] ?? ''),
            'lastErrorMessage' => (string) ($raw['lastErrorMessage'] ?? ''),
            'failureReason' => (string) ($raw['failureReason'] ?? ''),
            'deployedCommit' => (string) ($raw['deployedCommit'] ?? ''),
            'currentHead' => (string) ($raw['currentHead'] ?? ''),
            'remoteHead' => (string) ($raw['remoteHead'] ?? ''),
            'headDrift' => (bool) ($raw['headDrift'] ?? false),
            'telemetryGap' => (bool) ($raw['telemetryGap'] ?? false),
            'dirtyPathsCount' => (int) ($raw['dirtyPathsCount'] ?? 0),
            'dirtyPathsSample' => is_array($raw['dirtyPathsSample'] ?? null)
                ? array_values($raw['dirtyPathsSample'])
                : [],
        ];
    }

    private static function collectAiRouterSnapshot(): array
    {
        $status = [
            'router_mode' => 'unknown',
            'active_provider' => 'local_heuristic',
            'active_tier' => 'tier_3',
            'degraded' => false,
            'providers' => [],
            'last_updated' => gmdate('c'),
        ];

        if (class_exists('OpenclawAIRouter')) {
            $routerStatus = (new OpenclawAIRouter())->getStatus();
            if (is_array($routerStatus)) {
                $status = array_merge($status, $routerStatus);
            }
        }

        $providers = is_array($status['providers'] ?? null) ? array_values($status['providers']) : [];
        $codexProvider = self::findAiProviderSnapshot($providers, static fn(array $provider): bool => (string) ($provider['provider'] ?? '') === 'codex_oauth');
        $openRouterProviders = array_values(array_filter(
            $providers,
            static fn(array $provider): bool => str_starts_with((string) ($provider['provider'] ?? ''), 'openrouter:')
        ));
        $localProvider = self::findAiProviderSnapshot($providers, static fn(array $provider): bool => (string) ($provider['provider'] ?? '') === 'local_heuristic');

        return [
            'ok' => true,
            'router_mode' => (string) ($status['router_mode'] ?? 'unknown'),
            'active_provider' => (string) ($status['active_provider'] ?? 'local_heuristic'),
            'active_tier' => (string) ($status['active_tier'] ?? 'tier_3'),
            'degraded' => (bool) ($status['degraded'] ?? false),
            'last_updated' => (string) ($status['last_updated'] ?? gmdate('c')),
            'tiers' => [
                'codex' => [
                    'available' => self::isAiCodexConfigured(),
                    'active' => (bool) ($codexProvider['active'] ?? false),
                    'cooldown_remaining_seconds' => (int) ($codexProvider['cooldown_remaining_seconds'] ?? 0),
                ],
                'openrouter' => [
                    'available' => self::isAiOpenRouterConfigured(),
                    'active' => self::anyAiProviderActive($openRouterProviders),
                    'providers_configured' => count($openRouterProviders),
                    'cooldown_remaining_seconds' => self::maxAiProviderCooldown($openRouterProviders),
                ],
                'local' => [
                    'available' => true,
                    'active' => (bool) ($localProvider['active'] ?? false),
                    'cooldown_remaining_seconds' => (int) ($localProvider['cooldown_remaining_seconds'] ?? 0),
                ],
            ],
            'providers' => $providers,
        ];
    }

    private static function publicAiRouterSummary(array $snapshot): array
    {
        return [
            'ok' => (bool) ($snapshot['ok'] ?? false),
            'router_mode' => (string) ($snapshot['router_mode'] ?? 'unknown'),
            'active_provider' => (string) ($snapshot['active_provider'] ?? 'local_heuristic'),
            'active_tier' => (string) ($snapshot['active_tier'] ?? 'tier_3'),
            'degraded' => (bool) ($snapshot['degraded'] ?? false),
            'codex' => self::publicAiTierSummary($snapshot['tiers']['codex'] ?? null),
            'openrouter' => self::publicAiTierSummary($snapshot['tiers']['openrouter'] ?? null),
            'local' => self::publicAiTierSummary($snapshot['tiers']['local'] ?? null),
        ];
    }

    private static function publicAiTierSummary($raw): array
    {
        if (!is_array($raw)) {
            return [
                'available' => false,
                'active' => false,
            ];
        }

        $payload = [
            'available' => (bool) ($raw['available'] ?? false),
            'active' => (bool) ($raw['active'] ?? false),
        ];

        if (array_key_exists('providers_configured', $raw)) {
            $payload['providers_configured'] = (int) ($raw['providers_configured'] ?? 0);
        }

        return $payload;
    }

    private static function collectDataFilesSnapshot(): array
    {
        $cie10Path = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'cie10.json';
        $protocolsPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'protocols';
        $drugInteractionsPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'drug-interactions.json';

        $cie10 = [
            'exists' => is_file($cie10Path),
            'readable' => is_readable($cie10Path),
            'path' => $cie10Path,
        ];
        $protocolEntries = self::countDirectoryEntries($protocolsPath);
        $protocols = [
            'exists' => is_dir($protocolsPath),
            'readable' => is_readable($protocolsPath),
            'entries' => $protocolEntries,
            'path' => $protocolsPath,
        ];
        $drugInteractions = [
            'exists' => is_file($drugInteractionsPath),
            'readable' => is_readable($drugInteractionsPath),
            'path' => $drugInteractionsPath,
        ];

        return [
            'ok' => $cie10['exists'] && $protocols['exists'] && $drugInteractions['exists'],
            'cie10' => $cie10,
            'protocols' => $protocols,
            'drug_interactions' => $drugInteractions,
        ];
    }

    private static function publicDataFilesSummary(array $snapshot): array
    {
        return [
            'ok' => (bool) ($snapshot['ok'] ?? false),
            'cie10' => self::publicFileCheckSummary($snapshot['cie10'] ?? null),
            'protocols' => self::publicFileCheckSummary($snapshot['protocols'] ?? null),
            'drug_interactions' => self::publicFileCheckSummary($snapshot['drug_interactions'] ?? null),
        ];
    }

    private static function publicFileCheckSummary($raw): array
    {
        if (!is_array($raw)) {
            return [
                'exists' => false,
            ];
        }

        $payload = [
            'exists' => (bool) ($raw['exists'] ?? false),
            'readable' => (bool) ($raw['readable'] ?? false),
        ];

        if (array_key_exists('entries', $raw)) {
            $payload['entries'] = (int) ($raw['entries'] ?? 0);
        }

        return $payload;
    }

    private static function collectDoctorProfileSnapshot(): array
    {
        $path = doctor_profile_config_path();
        $profile = read_doctor_profile();

        return [
            'ok' => self::isValidJsonConfigFile($path),
            'loaded' => self::isValidJsonConfigFile($path),
            'path' => $path,
            'file_exists' => is_file($path),
            'name_present' => trim((string) ($profile['fullName'] ?? '')) !== '',
            'specialty_present' => trim((string) ($profile['specialty'] ?? '')) !== '',
            'msp_present' => trim((string) ($profile['mspNumber'] ?? '')) !== '',
            'signature_present' => trim((string) ($profile['signatureImage'] ?? '')) !== '',
            'updated_at' => trim((string) ($profile['updatedAt'] ?? '')),
        ];
    }

    private static function collectClinicProfileSnapshot(): array
    {
        $path = clinic_profile_config_path();
        $profile = read_clinic_profile();

        return [
            'ok' => self::isValidJsonConfigFile($path),
            'loaded' => self::isValidJsonConfigFile($path),
            'path' => $path,
            'file_exists' => is_file($path),
            'name_present' => trim((string) ($profile['clinicName'] ?? '')) !== '',
            'address_present' => trim((string) ($profile['address'] ?? '')) !== '',
            'phone_present' => trim((string) ($profile['phone'] ?? '')) !== '',
            'logo_present' => trim((string) ($profile['logoImage'] ?? '')) !== '',
        ];
    }

    private static function publicProfileSummary(array $snapshot): array
    {
        $payload = [
            'ok' => (bool) ($snapshot['ok'] ?? false),
            'loaded' => (bool) ($snapshot['loaded'] ?? false),
        ];

        foreach ([
            'name_present',
            'specialty_present',
            'msp_present',
            'signature_present',
            'address_present',
            'phone_present',
            'logo_present',
        ] as $field) {
            if (array_key_exists($field, $snapshot)) {
                $payload[$field] = (bool) ($snapshot[$field] ?? false);
            }
        }

        return $payload;
    }

    private static function findAiProviderSnapshot(array $providers, callable $matcher): array
    {
        foreach ($providers as $provider) {
            if (is_array($provider) && $matcher($provider)) {
                return $provider;
            }
        }

        return [];
    }

    private static function anyAiProviderActive(array $providers): bool
    {
        foreach ($providers as $provider) {
            if ((bool) ($provider['active'] ?? false)) {
                return true;
            }
        }

        return false;
    }

    private static function maxAiProviderCooldown(array $providers): int
    {
        $max = 0;
        foreach ($providers as $provider) {
            $max = max($max, (int) ($provider['cooldown_remaining_seconds'] ?? 0));
        }

        return $max;
    }

    private static function isAiCodexConfigured(): bool
    {
        return api_figo_env_gateway_endpoint() !== '' || trim((string) (getenv('OPENCLAW_CODEX_ENDPOINT') ?: '')) !== '';
    }

    private static function isAiOpenRouterConfigured(): bool
    {
        return api_first_non_empty([
            getenv('OPENCLAW_OPENROUTER_KEY'),
            getenv('OPENROUTER_API_KEY'),
        ]) !== '';
    }

    private static function countDirectoryEntries(string $path): int
    {
        if (!is_dir($path)) {
            return 0;
        }

        $entries = @scandir($path);
        if (!is_array($entries)) {
            return 0;
        }

        $count = 0;
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $count++;
        }

        return $count;
    }

    private static function isValidJsonConfigFile(string $path): bool
    {
        if (!is_file($path) || !is_readable($path)) {
            return false;
        }

        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return false;
        }

        return is_array(json_decode($raw, true));
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

    private static function resolve_figo_endpoint(): string
    {
        $envCandidates = [
            getenv('FIGO_CHAT_ENDPOINT'),
            getenv('FIGO_CHAT_URL'),
            getenv('FIGO_CHAT_API_URL'),
            getenv('FIGO_ENDPOINT'),
            getenv('FIGO_URL'),
            getenv('CLAWBOT_ENDPOINT'),
            getenv('CLAWBOT_URL'),
            getenv('CHATBOT_ENDPOINT'),
            getenv('CHATBOT_URL'),
            getenv('BOT_ENDPOINT'),
            app_env('AURORADERM_FIGO_ENDPOINT')
        ];

        foreach ($envCandidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        $configCandidates = [];
        $customPath = getenv('FIGO_CHAT_CONFIG_PATH');
        if (is_string($customPath) && trim($customPath) !== '') {
            $configCandidates[] = trim($customPath);
        }

        $configCandidates[] = data_dir_path() . DIRECTORY_SEPARATOR . 'figo-config.json';
        $configCandidates[] = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'figo-config.json';
        $configCandidates[] = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'figo-config.json';

        foreach ($configCandidates as $path) {
            if (!is_string($path) || $path === '' || !is_file($path)) {
                continue;
            }
            $raw = @file_get_contents($path);
            if (!is_string($raw) || trim($raw) === '') {
                continue;
            }
            $decoded = json_decode($raw, true);
            if (!is_array($decoded)) {
                continue;
            }
            $fileCandidates = [
                $decoded['endpoint'] ?? null,
                $decoded['apiUrl'] ?? null,
                $decoded['url'] ?? null
            ];
            foreach ($fileCandidates as $candidate) {
                if (is_string($candidate) && trim($candidate) !== '') {
                    return trim($candidate);
                }
            }
        }

        return '';
    }

    /**
     * Collect idempotency event counters from Metrics export.
     *
     * @return array<string,int|float|bool>
     */
    private static function collectIdempotencySnapshot(): array
    {
        $default = [
            'available' => false,
            'requestsWithKey' => 0,
            'new' => 0,
            'replay' => 0,
            'conflict' => 0,
            'unknown' => 0,
            'conflictRatePct' => 0.0,
            'replayRatePct' => 0.0,
        ];

        if (!class_exists('Metrics')) {
            return $default;
        }

        $raw = Metrics::export();
        if (!is_string($raw) || trim($raw) === '') {
            return $default;
        }

        $counts = [
            'new' => 0,
            'replay' => 0,
            'conflict' => 0,
            'unknown' => 0,
        ];

        $pattern = '/^booking_idempotency_events_total(?:\{([^}]*)\})?\s+([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)$/';
        $lines = preg_split('/\R/', $raw) ?: [];
        foreach ($lines as $line) {
            $line = trim((string) $line);
            if ($line === '' || $line[0] === '#') {
                continue;
            }
            if (preg_match($pattern, $line, $match) !== 1) {
                continue;
            }

            $labelsRaw = isset($match[1]) ? (string) $match[1] : '';
            $valueRaw = isset($match[2]) ? (string) $match[2] : '0';
            $value = is_numeric($valueRaw) ? (int) round((float) $valueRaw) : 0;
            if ($value <= 0) {
                continue;
            }

            $outcome = 'unknown';
            if ($labelsRaw !== '' && preg_match('/outcome="([^"]+)"/', $labelsRaw, $labelMatch) === 1) {
                $candidate = strtolower(trim((string) ($labelMatch[1] ?? '')));
                if ($candidate !== '') {
                    $outcome = $candidate;
                }
            }
            if (!isset($counts[$outcome])) {
                $outcome = 'unknown';
            }
            $counts[$outcome] += $value;
        }

        $requestsWithKey = $counts['new'] + $counts['replay'] + $counts['conflict'] + $counts['unknown'];
        $conflictRatePct = $requestsWithKey > 0 ? round(($counts['conflict'] / $requestsWithKey) * 100, 2) : 0.0;
        $replayRatePct = $requestsWithKey > 0 ? round(($counts['replay'] / $requestsWithKey) * 100, 2) : 0.0;

        return [
            'available' => true,
            'requestsWithKey' => $requestsWithKey,
            'new' => $counts['new'],
            'replay' => $counts['replay'],
            'conflict' => $counts['conflict'],
            'unknown' => $counts['unknown'],
            'conflictRatePct' => $conflictRatePct,
            'replayRatePct' => $replayRatePct,
        ];
    }

    private static function is_figo_recursive_config(string $endpoint): bool
    {
        $endpoint = trim($endpoint);
        if ($endpoint === '') {
            return false;
        }

        $parts = @parse_url($endpoint);
        if (!is_array($parts)) {
            return false;
        }

        $endpointHost = strtolower((string) ($parts['host'] ?? ''));
        $endpointPath = strtolower((string) ($parts['path'] ?? ''));
        $currentHost = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));

        $requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '/api.php');
        $requestPath = strtolower((string) parse_url($requestUri, PHP_URL_PATH));
        if ($requestPath === '') {
            $requestPath = '/api.php';
        }

        if ($endpointHost === '' || $currentHost === '') {
            return false;
        }

        $normalizedEndpointHost = preg_replace('/^www\./', '', $endpointHost);
        $normalizedCurrentHost = preg_replace('/^www\./', '', $currentHost);

        if ($normalizedEndpointHost !== $normalizedCurrentHost) {
            return false;
        }

        if ($endpointPath === '') {
            return false;
        }

        if ($endpointPath === $requestPath) {
            return true;
        }

        return $endpointPath === '/figo-chat.php';
    }
}
