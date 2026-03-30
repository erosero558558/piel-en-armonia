<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
final class HealthVisibilityTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SERVER = [
            'REMOTE_ADDR' => '198.51.100.24',
            'REQUEST_METHOD' => 'GET',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'health-visibility-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../lib/ApiConfig.php';
        require_once __DIR__ . '/../../controllers/HealthController.php';
        require_once __DIR__ . '/../../controllers/SystemController.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_AVAILABILITY_SOURCE',
            'PIELARMONIA_AGENT_JOBS_FILE',
            'PIELARMONIA_PUBLIC_SYNC_STATUS_PATH',
            'PIELARMONIA_HOSTING_RUNTIME_REPO_ROOT',
            'PIELARMONIA_HOSTING_RELEASE_TARGET_PATH',
            'PIELARMONIA_HOSTING_RELEASE_TARGET_PATHS_JSON',
            'PIELARMONIA_OPERATOR_AUTH_MODE',
            'PIELARMONIA_OPERATOR_AUTH_TRANSPORT',
            'PIELARMONIA_ADMIN_EMAIL',
            'PIELARMONIA_OPERATOR_AUTH_ALLOWLIST',
            'PIELARMONIA_OPERATOR_AUTH_ALLOW_ANY_AUTHENTICATED_EMAIL',
            'OPENCLAW_AUTH_BROKER_AUTHORIZE_URL',
            'OPENCLAW_AUTH_BROKER_TOKEN_URL',
            'OPENCLAW_AUTH_BROKER_USERINFO_URL',
            'OPENCLAW_AUTH_BROKER_CLIENT_ID',
            'OPENCLAW_AUTH_BROKER_JWKS_URL',
            'OPENCLAW_AUTH_BROKER_EXPECTED_ISSUER',
            'OPENCLAW_AUTH_BROKER_EXPECTED_AUDIENCE',
            'OPENCLAW_AUTH_BROKER_REQUIRE_EMAIL_VERIFIED',
            'PIELARMONIA_WHATSAPP_OPENCLAW_ENABLED',
            'PIELARMONIA_WHATSAPP_OPENCLAW_MODE',
            'PIELARMONIA_WHATSAPP_BRIDGE_TOKEN',
            'PIELARMONIA_WHATSAPP_BRIDGE_TOKEN_HEADER',
            'PIELARMONIA_WHATSAPP_BRIDGE_TOKEN_PREFIX',
            'PIELARMONIA_WHATSAPP_BRIDGE_STALE_AFTER_SECONDS',
        ] as $key) {
            putenv($key);
        }

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SERVER = [];
    }

    public function testPublicHealthRedactsDetailedDiagnosticsWithoutAuthorization(): void
    {
        $response = $this->captureJsonResponse(static function (): void {
            \HealthController::check([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health',
                'diagnosticsAuthorized' => false,
            ]);
        });

        $this->assertSame(200, $response['status']);
        $this->assertTrue((bool) ($response['payload']['ok'] ?? false));
        $this->assertSame('ok', (string) ($response['payload']['status'] ?? ''));
        $this->assertArrayHasKey('version', $response['payload']);
        $this->assertArrayNotHasKey('storageBackend', $response['payload']);
        $this->assertArrayNotHasKey('dataDirSource', $response['payload']);
        $this->assertArrayHasKey('calendarConfigured', $response['payload']);
        $this->assertArrayHasKey('calendarReachable', $response['payload']);
        $this->assertArrayHasKey('calendarMode', $response['payload']);
        $this->assertArrayHasKey('calendarSource', $response['payload']);
        $this->assertArrayHasKey('checks', $response['payload']);
        $this->assertArrayHasKey('publicSync', $response['payload']['checks']);
        $this->assertArrayNotHasKey('storage', $response['payload']['checks']);
        $this->assertArrayNotHasKey('auth', $response['payload']['checks']);
        $this->assertArrayNotHasKey('internalConsole', $response['payload']['checks']);
        $this->assertArrayNotHasKey('statusPathConfigured', $response['payload']['checks']['publicSync'] ?? []);
        $this->assertArrayNotHasKey('statusPathResolved', $response['payload']['checks']['publicSync'] ?? []);
        $this->assertArrayNotHasKey('runtimeCurrentCommit', $response['payload']['checks']['publicSync'] ?? []);
        $this->assertArrayNotHasKey('runtimeDesiredCommit', $response['payload']['checks']['publicSync'] ?? []);
    }

    public function testAuthorizedHealthStillExposesDetailedDiagnostics(): void
    {
        $response = $this->captureJsonResponse(static function (): void {
            \HealthController::check([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health',
                'diagnosticsAuthorized' => true,
            ]);
        });

        $this->assertSame(200, $response['status']);
        $this->assertTrue((bool) ($response['payload']['ok'] ?? false));
        $this->assertArrayHasKey('storageBackend', $response['payload']);
        $this->assertArrayHasKey('storeEncryptionStatus', $response['payload']);
        $this->assertArrayHasKey('authMode', $response['payload']);
        $this->assertArrayHasKey('authStatus', $response['payload']);
        $this->assertArrayHasKey('checks', $response['payload']);
        $this->assertArrayHasKey('encryptionStatus', $response['payload']['checks']['storage'] ?? []);
        $this->assertArrayHasKey('auth', $response['payload']['checks']);
        $this->assertArrayHasKey('internalConsole', $response['payload']['checks']);
        $this->assertArrayHasKey('mode', $response['payload']['checks']['auth'] ?? []);
        $this->assertArrayHasKey('configured', $response['payload']['checks']['auth'] ?? []);
        $this->assertArrayHasKey('twoFactorEnabled', $response['payload']['checks']['auth'] ?? []);
        $this->assertArrayHasKey('overall', $response['payload']['checks']['internalConsole'] ?? []);
        $this->assertArrayHasKey('publicSync', $response['payload']['checks']);
    }

    public function testAuthorizedHealthDiagnosticsPrefersCanonicalWindowsMainSyncStatusWhenLegacyFileIsStale(): void
    {
        $jobsFile = $this->tempDir . DIRECTORY_SEPARATOR . 'AGENT_JOBS.publicsync.yaml';
        $legacyStatusPath = $this->tempDir . DIRECTORY_SEPARATOR . 'public-sync-status.json';
        $mainStatusPath = $this->tempDir . DIRECTORY_SEPARATOR . 'main-sync-status.json';
        $releaseTargetPath = $this->tempDir . DIRECTORY_SEPARATOR . 'release-target.runtime.json';
        $repoRoot = $this->tempDir . DIRECTORY_SEPARATOR . 'mirror';
        $targetCommit = '481d9597231ec25ac67504f5bbd077fedb5f2ebf';
        $legacyCommit = 'a35ee6833c18b657b1b4d5bdaf9d21e3b3c00325';
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));

        mkdir($repoRoot . DIRECTORY_SEPARATOR . '.git' . DIRECTORY_SEPARATOR . 'refs' . DIRECTORY_SEPARATOR . 'heads', 0777, true);
        file_put_contents($repoRoot . DIRECTORY_SEPARATOR . '.git' . DIRECTORY_SEPARATOR . 'HEAD', "ref: refs/heads/main\n");
        file_put_contents(
            $repoRoot . DIRECTORY_SEPARATOR . '.git' . DIRECTORY_SEPARATOR . 'refs' . DIRECTORY_SEPARATOR . 'heads' . DIRECTORY_SEPARATOR . 'main',
            $targetCommit . "\n"
        );
        file_put_contents($releaseTargetPath, json_encode(['target_commit' => $targetCommit], JSON_PRETTY_PRINT));
        file_put_contents(
            $jobsFile,
            <<<YAML
version: 1
updated_at: "2026-03-26T00:00:00Z"
jobs:
  - key: public_main_sync
    job_id: "8d31e299-7e57-4959-80b5-aaa2d73e9674"
    enabled: true
    type: external_cron
    owner: codex_backend_ops
    environment: production
    repo_path: {$repoRoot}
    branch: main
    schedule: "* * * * *"
    command: powershell -NoProfile -ExecutionPolicy Bypass -File C:\ProgramData\Pielarmonia\hosting\runtime-main-sync.ps1
    wrapper_fallback: C:\ProgramData\Pielarmonia\hosting\runtime-main-sync.ps1
    lock_file: C:\tmp\sync-pielarmonia.lock
    log_path: C:\ProgramData\Pielarmonia\hosting\main-sync.runtime.log
    status_path: {$legacyStatusPath}
    health_url: https://pielarmonia.com/api.php?resource=health
    expected_max_lag_seconds: 120
    source_of_truth: host_cron
    publish_strategy: main_auto_guarded
YAML
        );
        file_put_contents(
            $legacyStatusPath,
            json_encode([
                'state' => 'failed',
                'checked_at' => $now->modify('-15 minutes')->format('c'),
                'last_success_at' => $now->modify('-15 minutes')->format('c'),
                'last_error_at' => $now->modify('-15 minutes')->format('c'),
                'last_error_message' => 'stale',
                'deployed_commit' => $legacyCommit,
                'repo_path' => '/var/www/figo',
                'branch' => 'main',
                'current_head' => $legacyCommit,
                'remote_head' => $legacyCommit,
            ], JSON_PRETTY_PRINT)
        );
        file_put_contents(
            $mainStatusPath,
            json_encode([
                'ok' => true,
                'state' => 'ok',
                'timestamp' => $now->format('c'),
                'last_successful_deploy_at' => $now->format('c'),
                'mirror_repo_path' => $repoRoot,
                'branch' => 'main',
                'desired_commit' => $targetCommit,
                'current_commit' => $targetCommit,
                'served_commit' => $targetCommit,
                'auth_contract_ok' => true,
                'site_root_ok' => true,
            ], JSON_PRETTY_PRINT)
        );

        putenv('PIELARMONIA_AGENT_JOBS_FILE=' . $jobsFile);
        putenv('PIELARMONIA_HOSTING_RUNTIME_REPO_ROOT=' . $repoRoot);
        putenv('PIELARMONIA_HOSTING_RELEASE_TARGET_PATH=' . $releaseTargetPath);

        $response = $this->captureJsonResponse(static function (): void {
            \HealthController::check([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health',
                'diagnosticsAuthorized' => true,
            ]);
        });

        $snapshot = $response['payload']['checks']['publicSync'] ?? [];
        $this->assertSame(200, $response['status']);
        $this->assertTrue((bool) ($snapshot['healthy'] ?? false));
        $this->assertSame($legacyStatusPath, (string) ($snapshot['statusPathConfigured'] ?? ''));
        $this->assertSame($mainStatusPath, (string) ($snapshot['statusPathResolved'] ?? ''));
        $this->assertSame('windows_main_sync', (string) ($snapshot['statusSourceKind'] ?? ''));
        $this->assertSame($targetCommit, (string) ($snapshot['deployedCommit'] ?? ''));
        $this->assertSame($targetCommit, (string) ($snapshot['currentHead'] ?? ''));
        $this->assertSame($targetCommit, (string) ($snapshot['remoteHead'] ?? ''));
        $this->assertSame($targetCommit, (string) ($snapshot['runtimeCurrentCommit'] ?? ''));
        $this->assertSame($targetCommit, (string) ($snapshot['runtimeDesiredCommit'] ?? ''));
        $this->assertSame($targetCommit, (string) ($snapshot['statusReportedCommit'] ?? ''));
        $this->assertFalse((bool) ($snapshot['statusCommitMismatch'] ?? true));
    }

    public function testAuthorizedHealthDiagnosticsReconcilesRuntimeFingerprintAgainstStaleStatusCommitIdentity(): void
    {
        $jobsFile = $this->tempDir . DIRECTORY_SEPARATOR . 'AGENT_JOBS.publicsync.yaml';
        $statusPath = $this->tempDir . DIRECTORY_SEPARATOR . 'main-sync-status.json';
        $releaseTargetPath = $this->tempDir . DIRECTORY_SEPARATOR . 'release-target.runtime.json';
        $repoRoot = $this->tempDir . DIRECTORY_SEPARATOR . 'mirror-runtime';
        $targetCommit = '481d9597231ec25ac67504f5bbd077fedb5f2ebf';
        $staleCommit = 'a35ee6833c18b657b1b4d5bdaf9d21e3b3c00325';
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));

        mkdir($repoRoot . DIRECTORY_SEPARATOR . '.git' . DIRECTORY_SEPARATOR . 'refs' . DIRECTORY_SEPARATOR . 'heads', 0777, true);
        file_put_contents($repoRoot . DIRECTORY_SEPARATOR . '.git' . DIRECTORY_SEPARATOR . 'HEAD', "ref: refs/heads/main\n");
        file_put_contents(
            $repoRoot . DIRECTORY_SEPARATOR . '.git' . DIRECTORY_SEPARATOR . 'refs' . DIRECTORY_SEPARATOR . 'heads' . DIRECTORY_SEPARATOR . 'main',
            $targetCommit . "\n"
        );
        file_put_contents($releaseTargetPath, json_encode(['target_commit' => $targetCommit], JSON_PRETTY_PRINT));
        file_put_contents(
            $jobsFile,
            <<<YAML
version: 1
updated_at: "2026-03-26T00:00:00Z"
jobs:
  - key: public_main_sync
    job_id: "8d31e299-7e57-4959-80b5-aaa2d73e9674"
    enabled: true
    type: external_cron
    owner: codex_backend_ops
    environment: production
    repo_path: {$repoRoot}
    branch: main
    schedule: "* * * * *"
    command: powershell -NoProfile -ExecutionPolicy Bypass -File C:\ProgramData\Pielarmonia\hosting\runtime-main-sync.ps1
    wrapper_fallback: C:\ProgramData\Pielarmonia\hosting\runtime-main-sync.ps1
    lock_file: C:\tmp\sync-pielarmonia.lock
    log_path: C:\ProgramData\Pielarmonia\hosting\main-sync.runtime.log
    status_path: {$statusPath}
    health_url: https://pielarmonia.com/api.php?resource=health
    expected_max_lag_seconds: 120
    source_of_truth: host_cron
    publish_strategy: main_auto_guarded
YAML
        );
        file_put_contents(
            $statusPath,
            json_encode([
                'ok' => true,
                'state' => 'ok',
                'timestamp' => $now->modify('-20 minutes')->format('c'),
                'last_successful_deploy_at' => $now->modify('-20 minutes')->format('c'),
                'mirror_repo_path' => $repoRoot,
                'branch' => 'main',
                'desired_commit' => $staleCommit,
                'current_commit' => $staleCommit,
                'served_commit' => $staleCommit,
                'auth_contract_ok' => true,
                'site_root_ok' => true,
            ], JSON_PRETTY_PRINT)
        );

        putenv('PIELARMONIA_AGENT_JOBS_FILE=' . $jobsFile);
        putenv('PIELARMONIA_HOSTING_RUNTIME_REPO_ROOT=' . $repoRoot);
        putenv('PIELARMONIA_HOSTING_RELEASE_TARGET_PATH=' . $releaseTargetPath);

        $response = $this->captureJsonResponse(static function (): void {
            \HealthController::check([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health',
                'diagnosticsAuthorized' => true,
            ]);
        });

        $snapshot = $response['payload']['checks']['publicSync'] ?? [];
        $this->assertSame(200, $response['status']);
        $this->assertFalse((bool) ($snapshot['healthy'] ?? true));
        $this->assertSame('stale', (string) ($snapshot['failureReason'] ?? ''));
        $this->assertSame($staleCommit, (string) ($snapshot['statusReportedCommit'] ?? ''));
        $this->assertSame($targetCommit, (string) ($snapshot['deployedCommit'] ?? ''));
        $this->assertSame($targetCommit, (string) ($snapshot['currentHead'] ?? ''));
        $this->assertSame($targetCommit, (string) ($snapshot['remoteHead'] ?? ''));
        $this->assertSame($targetCommit, (string) ($snapshot['runtimeCurrentCommit'] ?? ''));
        $this->assertSame($targetCommit, (string) ($snapshot['runtimeDesiredCommit'] ?? ''));
        $this->assertTrue((bool) ($snapshot['statusCommitMismatch'] ?? false));
    }

    public function testAuthorizedHealthDiagnosticsPrefersFresherWindowsSyncSiblingWhenConfiguredMainStatusIsStale(): void
    {
        $jobsFile = $this->tempDir . DIRECTORY_SEPARATOR . 'AGENT_JOBS.publicsync.yaml';
        $statusPath = $this->tempDir . DIRECTORY_SEPARATOR . 'main-sync-status.json';
        $syncStatusPath = $this->tempDir . DIRECTORY_SEPARATOR . 'main-sync-status.sync.json';
        $releaseTargetPath = $this->tempDir . DIRECTORY_SEPARATOR . 'release-target.runtime.json';
        $repoRoot = $this->tempDir . DIRECTORY_SEPARATOR . 'mirror-sync';
        $targetCommit = '481d9597231ec25ac67504f5bbd077fedb5f2ebf';
        $staleCommit = 'a35ee6833c18b657b1b4d5bdaf9d21e3b3c00325';
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));

        mkdir($repoRoot . DIRECTORY_SEPARATOR . '.git' . DIRECTORY_SEPARATOR . 'refs' . DIRECTORY_SEPARATOR . 'heads', 0777, true);
        file_put_contents($repoRoot . DIRECTORY_SEPARATOR . '.git' . DIRECTORY_SEPARATOR . 'HEAD', "ref: refs/heads/main\n");
        file_put_contents(
            $repoRoot . DIRECTORY_SEPARATOR . '.git' . DIRECTORY_SEPARATOR . 'refs' . DIRECTORY_SEPARATOR . 'heads' . DIRECTORY_SEPARATOR . 'main',
            $targetCommit . "\n"
        );
        file_put_contents($releaseTargetPath, json_encode(['target_commit' => $targetCommit], JSON_PRETTY_PRINT));
        file_put_contents(
            $jobsFile,
            <<<YAML
version: 1
updated_at: "2026-03-26T00:00:00Z"
jobs:
  - key: public_main_sync
    job_id: "8d31e299-7e57-4959-80b5-aaa2d73e9674"
    enabled: true
    type: external_cron
    owner: codex_backend_ops
    environment: production
    repo_path: {$repoRoot}
    branch: main
    schedule: "* * * * *"
    command: powershell -NoProfile -ExecutionPolicy Bypass -File C:\ProgramData\Pielarmonia\hosting\runtime-main-sync.ps1
    wrapper_fallback: C:\ProgramData\Pielarmonia\hosting\runtime-main-sync.ps1
    lock_file: C:\tmp\sync-pielarmonia.lock
    log_path: C:\ProgramData\Pielarmonia\hosting\main-sync.runtime.log
    status_path: {$statusPath}
    health_url: https://pielarmonia.com/api.php?resource=health
    expected_max_lag_seconds: 120
    source_of_truth: host_cron
    publish_strategy: main_auto_guarded
YAML
        );
        file_put_contents(
            $statusPath,
            json_encode([
                'ok' => true,
                'state' => 'starting',
                'timestamp' => $now->modify('-20 minutes')->format('c'),
                'last_successful_deploy_at' => $now->modify('-20 minutes')->format('c'),
                'mirror_repo_path' => $repoRoot,
                'branch' => 'main',
                'desired_commit' => $staleCommit,
                'current_commit' => $staleCommit,
                'served_commit' => $staleCommit,
                'auth_contract_ok' => false,
                'site_root_ok' => false,
            ], JSON_PRETTY_PRINT)
        );
        file_put_contents(
            $syncStatusPath,
            "\xEF\xBB\xBF" . json_encode([
                'ok' => true,
                'state' => 'updated',
                'timestamp' => $now->format('c'),
                'last_successful_deploy_at' => $now->format('c'),
                'mirror_repo_path' => $repoRoot,
                'branch' => 'main',
                'desired_commit' => $targetCommit,
                'current_commit' => $targetCommit,
                'served_commit' => $targetCommit,
                'auth_contract_ok' => true,
                'site_root_ok' => true,
            ], JSON_PRETTY_PRINT)
        );

        putenv('PIELARMONIA_AGENT_JOBS_FILE=' . $jobsFile);
        putenv('PIELARMONIA_HOSTING_RUNTIME_REPO_ROOT=' . $repoRoot);
        putenv('PIELARMONIA_HOSTING_RELEASE_TARGET_PATH=' . $releaseTargetPath);

        $response = $this->captureJsonResponse(static function (): void {
            \HealthController::check([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health',
                'diagnosticsAuthorized' => true,
            ]);
        });

        $snapshot = $response['payload']['checks']['publicSync'] ?? [];
        $this->assertSame(200, $response['status']);
        $this->assertTrue((bool) ($snapshot['healthy'] ?? false));
        $this->assertSame($statusPath, (string) ($snapshot['statusPathConfigured'] ?? ''));
        $this->assertSame($syncStatusPath, (string) ($snapshot['statusPathResolved'] ?? ''));
        $this->assertSame('windows_main_sync', (string) ($snapshot['statusSourceKind'] ?? ''));
        $this->assertSame($targetCommit, (string) ($snapshot['deployedCommit'] ?? ''));
        $this->assertSame($targetCommit, (string) ($snapshot['currentHead'] ?? ''));
        $this->assertSame($targetCommit, (string) ($snapshot['remoteHead'] ?? ''));
    }

    public function testAuthorizedHealthIncludesWhatsappOpenclawSnapshot(): void
    {
        putenv('PIELARMONIA_WHATSAPP_OPENCLAW_ENABLED=true');
        putenv('PIELARMONIA_WHATSAPP_OPENCLAW_MODE=live');
        putenv('PIELARMONIA_WHATSAPP_BRIDGE_TOKEN=test-wa-health-token');
        putenv('PIELARMONIA_WHATSAPP_BRIDGE_TOKEN_HEADER=Authorization');
        putenv('PIELARMONIA_WHATSAPP_BRIDGE_TOKEN_PREFIX=Bearer');
        putenv('PIELARMONIA_WHATSAPP_BRIDGE_STALE_AFTER_SECONDS=900');

        $repository = \whatsapp_openclaw_repository();
        $repository->touchBridgeStatus('inbound');
        $conversation = $repository->saveConversation([
            'id' => 'wa:593981110444',
            'phone' => '593981110444',
            'status' => 'booked',
        ]);
        $repository->saveBookingDraft([
            'conversationId' => (string) ($conversation['id'] ?? 'wa:593981110444'),
            'phone' => '593981110444',
            'service' => 'consulta',
            'date' => date('Y-m-d', strtotime('+2 days')),
            'time' => '10:00',
            'status' => 'booked',
            'appointmentId' => 991,
            'paymentMethod' => 'card',
            'paymentStatus' => 'paid',
            'paymentSessionId' => 'cs_health_whatsapp_001',
        ]);

        $response = $this->captureJsonResponse(static function (): void {
            \HealthController::check([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health',
                'diagnosticsAuthorized' => true,
            ]);
        });

        $this->assertSame(200, $response['status']);
        $this->assertTrue((bool) ($response['payload']['ok'] ?? false));
        $this->assertArrayHasKey('whatsappOpenclaw', $response['payload']['checks']);
        $this->assertTrue((bool) ($response['payload']['checks']['whatsappOpenclaw']['configured'] ?? false));
        $this->assertSame('live', (string) ($response['payload']['checks']['whatsappOpenclaw']['configuredMode'] ?? ''));
        $this->assertSame('online', (string) ($response['payload']['checks']['whatsappOpenclaw']['bridgeMode'] ?? ''));
        $this->assertSame(1, (int) ($response['payload']['checks']['whatsappOpenclaw']['bookingsClosed'] ?? 0));
        $this->assertSame(1, (int) ($response['payload']['checks']['whatsappOpenclaw']['paymentsStarted'] ?? 0));
        $this->assertSame(1, (int) ($response['payload']['checks']['whatsappOpenclaw']['paymentsCompleted'] ?? 0));
    }

    public function testAuthorizedHealthRedactsAllowedEmailsButKeepsRestrictedAllowlistCount(): void
    {
        putenv('PIELARMONIA_OPERATOR_AUTH_MODE=openclaw_chatgpt');
        putenv('PIELARMONIA_OPERATOR_AUTH_TRANSPORT=web_broker');
        putenv('PIELARMONIA_ADMIN_EMAIL=restricted.operator@example.com');
        putenv('PIELARMONIA_OPERATOR_AUTH_ALLOWLIST=restricted.operator@example.com');
        putenv('PIELARMONIA_OPERATOR_AUTH_ALLOW_ANY_AUTHENTICATED_EMAIL=false');
        putenv('OPENCLAW_AUTH_BROKER_AUTHORIZE_URL=https://broker.example.test/authorize');
        putenv('OPENCLAW_AUTH_BROKER_TOKEN_URL=https://broker.example.test/token');
        putenv('OPENCLAW_AUTH_BROKER_USERINFO_URL=https://broker.example.test/userinfo');
        putenv('OPENCLAW_AUTH_BROKER_CLIENT_ID=broker-client-id');
        putenv('OPENCLAW_AUTH_BROKER_JWKS_URL=https://broker.example.test/jwks');
        putenv('OPENCLAW_AUTH_BROKER_EXPECTED_ISSUER=https://broker.example.test');
        putenv('OPENCLAW_AUTH_BROKER_EXPECTED_AUDIENCE=broker-audience');
        putenv('OPENCLAW_AUTH_BROKER_REQUIRE_EMAIL_VERIFIED=true');

        $response = $this->captureJsonResponse(static function (): void {
            \HealthController::check([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health',
                'diagnosticsAuthorized' => true,
            ]);
        });

        $this->assertSame(200, $response['status']);
        $this->assertTrue((bool) ($response['payload']['ok'] ?? false));
        $this->assertSame('google_oauth', (string) ($response['payload']['authMode'] ?? ''));
        $this->assertTrue((bool) ($response['payload']['authConfigured'] ?? false));
        $this->assertSame(1, (int) ($response['payload']['checks']['auth']['operatorAuthAllowedEmailCount'] ?? 0));
        $this->assertTrue((bool) ($response['payload']['checks']['auth']['brokerTrustConfigured'] ?? false));
        $this->assertSame(1, (int) ($response['payload']['checks']['internalConsole']['auth']['allowedEmailCount'] ?? 0));
        $this->assertArrayNotHasKey('allowedEmails', $response['payload']['checks']['auth'] ?? []);
        $this->assertArrayNotHasKey('allowedEmails', $response['payload']['checks']['internalConsole']['auth'] ?? []);
    }

    public function testHealthDiagnosticsRejectsUnauthorizedRequest(): void
    {
        $response = $this->captureJsonResponse(static function (): void {
            \HealthController::diagnostics([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health-diagnostics',
                'diagnosticsAuthorized' => false,
            ]);
        });

        $this->assertSame(403, $response['status']);
        $this->assertFalse((bool) ($response['payload']['ok'] ?? true));
        $this->assertSame('No autorizado', (string) ($response['payload']['error'] ?? ''));
    }

    public function testMetricsRejectsUnauthorizedPublicRequest(): void
    {
        $response = $this->captureJsonResponse(static function (): void {
            \SystemController::metrics([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'metrics',
                'diagnosticsAuthorized' => false,
            ]);
        });

        $this->assertSame(403, $response['status']);
        $this->assertFalse((bool) ($response['payload']['ok'] ?? true));
        $this->assertSame('No autorizado', (string) ($response['payload']['error'] ?? ''));
    }

    public function testSensitiveDiagnosticsEndpointsAreNotInPublicApiAllowlist(): void
    {
        $publicEndpoints = \ApiConfig::getPublicEndpoints();
        $diagnosticsEndpoints = \ApiConfig::getDiagnosticsEndpoints();

        $this->assertFalse($this->containsEndpoint($publicEndpoints, 'GET', 'metrics'));
        $this->assertFalse($this->containsEndpoint($publicEndpoints, 'GET', 'health-diagnostics'));
        $this->assertTrue($this->containsEndpoint($diagnosticsEndpoints, 'GET', 'metrics'));
        $this->assertTrue($this->containsEndpoint($diagnosticsEndpoints, 'GET', 'health-diagnostics'));
    }

    /**
     * @param callable():void $callable
     * @return array{payload:array<string,mixed>,status:int}
     */
    private function captureJsonResponse(callable $callable): array
    {
        try {
            $callable();
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            return [
                'payload' => $exception->payload,
                'status' => $exception->status,
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

    /**
     * @param array<int,array<string,string>> $endpoints
     */
    private function containsEndpoint(array $endpoints, string $method, string $resource): bool
    {
        foreach ($endpoints as $endpoint) {
            if (
                (string) ($endpoint['method'] ?? '') === $method &&
                (string) ($endpoint['resource'] ?? '') === $resource
            ) {
                return true;
            }
        }

        return false;
    }
}
