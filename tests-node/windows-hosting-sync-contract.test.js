#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const COMMON_SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'Windows.Hosting.Common.ps1'
);
const CADDYFILE_PATH = resolve(REPO_ROOT, 'ops', 'caddy', 'Caddyfile');
const HOSTING_RUNTIME_PHP_PATH = resolve(REPO_ROOT, 'hosting-runtime.php');
const HOSTING_RUNTIME_HELPER_PATH = resolve(
    REPO_ROOT,
    'lib',
    'hosting_runtime_fingerprint.php'
);
const SYNC_SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'SINCRONIZAR-HOSTING-WINDOWS.ps1'
);
const CONFIG_SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'CONFIGURAR-HOSTING-WINDOWS.ps1'
);
const SUPERVISOR_SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'SUPERVISAR-HOSTING-WINDOWS.ps1'
);
const REPAIR_SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'REPARAR-HOSTING-WINDOWS.ps1'
);
const START_SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'ARRANCAR-HOSTING-WINDOWS.ps1'
);
const SMOKE_SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'SMOKE-HOSTING-WINDOWS.ps1'
);
const WINDOWS_HOSTING_SSH_COMMON_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'windows-hosting-ssh-common.sh'
);

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('Windows V7 define modulo comun de compatibilidad, runtime Caddy y wrapper con timeout', () => {
    const raw = load(COMMON_SCRIPT_PATH);
    const requiredSnippets = [
        'function ConvertFrom-JsonCompat',
        'function Read-HostingJsonFileSafe',
        'function Write-HostingJsonFile',
        'function Set-HostingJsonFields',
        'function Get-HostingFileSha256',
        'function Invoke-HostingHttpRequest',
        'function Invoke-HostingJsonRequest',
        'function Stop-HostingProcessTree',
        'function Write-HostingCommandHeartbeat',
        'function Get-HostingProcessSnapshots',
        'Get-CimInstance Win32_Process',
        'Get-WmiObject Win32_Process',
        'tasklist.exe',
        'function Get-HostingListeningTcpEntries',
        'Get-NetTCPConnection -State Listen',
        "Invoke-HostingCommandWithOutput -FilePath $netstatCommand.Source -Arguments @('-ano', '-p', 'tcp')",
        'function Get-HostingScheduledTaskSafe',
        'function Stop-HostingScheduledTaskIfPresent',
        'function Remove-HostingScheduledTaskIfPresent',
        'schtasks.exe',
        'function Get-HostingLockInfoPath',
        'function Get-HostingDirectoryLockSnapshot',
        'function Remove-HostingDirectoryLock',
        'function Repair-HostingLegacyLocks',
        'function Acquire-HostingDirectoryLock',
        'function Get-HostingRuntimePaths',
        "CaddyRuntimeConfigPath = Join-Path $runtimeRoot 'Caddyfile.runtime'",
        'function Convert-HostingPathToCaddyLiteral',
        'function Convert-HostingPathToGitLiteral',
        'function Get-HostingGitSafeArguments',
        'function Normalize-HostingGitCommit',
        'function New-HostingRuntimeCaddyConfig',
        'function Invoke-HostingRuntimeFingerprint',
        "-Url ($trimmedBaseUrl + '/__hosting/runtime')",
        'function Test-HostingRuntimeFingerprintMatch',
        "$error = 'site_root_mismatch'",
        '[int]$TimeoutSeconds = 0',
        "[string]$HeartbeatPath = ''",
        "[string]$Label = ''",
        '[string[]]$StatusFilesToWatch = @()',
        '[bool]$KillTreeOnTimeout = $true',
        'taskkill.exe',
        'TimedOut = ($timedOut -eq $true)',
        'ProcessId = $processId',
        'DurationSeconds = [int][Math]::Ceiling($stopwatch.Elapsed.TotalSeconds)',
        "lock_state = 'missing'",
        "lock_reason = ''",
        "legacy_file_lock",
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wrapper de compatibilidad Windows: ${snippet}`
        );
    }
});

test('sync V7 usa runtime Caddy fijo, valida fingerprint local y corta restart colgado', () => {
    const raw = load(SYNC_SCRIPT_PATH);
    const requiredSnippets = [
        "[switch]$PreflightOnly",
        "$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'",
        'Get-HostingRuntimePaths -RepoRoot $mirrorRepoPathResolved',
        'Get-HostingGitSafeArguments -RepoPath $mirrorRepoPathResolved',
        'New-HostingRuntimeCaddyConfig',
        'Invoke-HostingRuntimeFingerprint',
        'Test-HostingRuntimeFingerprintMatch',
        'Acquire-SyncLock',
        'Get-HostingLockInfoPath -LockDirectoryPath $lockPath',
        'Acquire-HostingDirectoryLock',
        'Remove-HostingDirectoryLock',
        'phase_started_at = [DateTimeOffset]::Now.ToString(\'o\')',
        'phase_heartbeat_at = [DateTimeOffset]::Now.ToString(\'o\')',
        'phase_timeout_seconds = 0',
        'timed_out = $false',
        'Set-SyncPhase',
        "Set-SyncPhase -CurrentStatus $status -State 'discovering' -DeployState 'discover'",
        "Set-SyncPhase -CurrentStatus $status -State 'preflight' -DeployState 'preflight'",
        'Get-GitRevisionOrThrow',
        'Invoke-ValidateMirror `',
        'Wait-ForMirrorValidation',
        "Set-SyncPhase -CurrentStatus $status -State 'preflight_ready' -DeployState 'preflight_ready'",
        "Set-SyncPhase -CurrentStatus $status -State 'applying' -DeployState 'apply'",
        "Set-SyncPhase -CurrentStatus $status -State 'restarting' -DeployState 'restart'",
        "Set-SyncPhase -CurrentStatus $status -State 'validating' -DeployState 'validate'",
        "Set-SyncPhase -CurrentStatus $status -State 'rollback' -DeployState 'rollback'",
        'TimeoutSeconds $arrancarTimeoutSeconds',
        'HeartbeatPath $statusPathResolved',
        "throw 'sync_restart_timeout'",
        "deploy_state = 'restart_timeout'",
        'sync_post_restart_contract_invalid',
        'site_root_mismatch',
        'desired_commit =',
        'current_commit =',
        'previous_commit =',
        'site_root_ok = $false',
        "served_site_root = ''",
        "served_commit = ''",
        'caddy_runtime_config_path = $expectedCaddyRuntimeConfigPath',
        'service_state =',
        'lock_state =',
        'lock_reason =',
        'lock_owner_pid =',
        'lock_started_at =',
        'lock_age_seconds =',
        'lock_repaired = $false',
        'lock_repair_reason =',
        'Normalize-HostingGitCommit -Value ([string]$existingStatus.current_commit)',
        'Normalize-HostingGitCommit -Value ([string]$existingReleaseTarget.target_commit)',
        "status_source = 'sync_runtime'",
        'ExpectedSiteRoot $mirrorRepoPathResolved',
        'ExpectedRuntimeConfigPath $runtimeConfig.Path',
        'rollback_performed = $false',
        'rollback_reason =',
        'last_successful_deploy_at =',
        'last_failure_reason =',
        'Release target bootstrapeado',
        'Desired commit {0} fallo validacion; se ejecuta rollback automatico',
        'Preflight OK: desired={0} current={1} service_state={2}',
        'Repair-HostingLegacyLocks -LockPaths @($lockPath)',
        "sync_lock_unrecoverable",
        "throw 'sync_lock_unrecoverable'",
        "Lock invalido detectado; state={0} reason={1}",
        "lock_state = 'unlocked'",
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet V2 en sync: ${snippet}`
        );
    }
});

test('config V3 desacopla bootstrap del mirror y arranque del supervisor', () => {
    const raw = load(CONFIG_SCRIPT_PATH);
    const requiredSnippets = [
        "$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'",
        '[switch]$BootstrapMirrorNow',
        '[switch]$StartSupervisorNow',
        '[switch]$SkipBootstrapSync',
        "$mirrorSupervisorScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\\ops\\setup\\SUPERVISAR-HOSTING-WINDOWS.ps1'",
        "$mirrorRepairScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\\ops\\setup\\REPARAR-HOSTING-WINDOWS.ps1'",
        "$supervisorTaskName = 'Pielarmonia Hosting Supervisor'",
        "$mainSyncTaskName = 'Pielarmonia Hosting Main Sync'",
        "$legacyBootTaskName = 'Pielarmonia Hosting Stack'",
        'Write-LauncherScript -Path $supervisorLauncherPath -Command $supervisorCommand',
        'Write-LauncherScript -Path $mainSyncLauncherPath -Command $mainSyncCommand',
        'Write-LauncherScript -Path $repairLauncherPath -Command $repairCommand',
        'Tarea legacy eliminada',
        'Tarea programada de supervisor instalada',
        'Tarea programada de sync instalada',
        'No existe el mirror limpio en $mirrorRepoPathResolved y se solicito -SkipBootstrapSync.',
        '$BootstrapMirrorNow = $true',
        '$StartSupervisorNow = $true',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet V2 en configurador: ${snippet}`
        );
    }
});

test('repair, supervisor, start y smoke usan contrato V7 fail-safe, observable y con site_root', () => {
    const required = [
        {
            filePath: REPAIR_SCRIPT_PATH,
            snippets: [
                "[switch]$PreflightOnly",
                "$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'",
                'Get-HostingGitSafeArguments -RepoPath $mirrorRepoPathResolved',
                "status_source = 'repair_runtime'",
                "phase = 'discover'",
                "Set-RepairPhase -CurrentStatus $status -Phase 'sanitize_legacy_state'",
                "Set-RepairPhase",
                "Set-RepairPhase -CurrentStatus $status -Phase 'preflight_ready'",
                "Set-RepairPhase -CurrentStatus $status -Phase 'quiesce'",
                "Set-RepairPhase -CurrentStatus $status -Phase 'completed'",
                'phase_started_at = [DateTimeOffset]::Now.ToString(\'o\')',
                'phase_heartbeat_at = [DateTimeOffset]::Now.ToString(\'o\')',
                'phase_timeout_seconds = 0',
                "child_script = ''",
                'child_pid = 0',
                "child_exit_code = ''",
                'timed_out = $false',
                'Set-RepairPhase',
                'Update-RepairChildResult',
                'Invoke-SyncScript -CurrentPreflightOnly',
                'sync_timeout',
                'config_timeout',
                'smoke_timeout',
                'Preflight de reparacion OK; no se tocaron procesos activos.',
                'Disable-ControlPlane -CurrentTaskNames $taskNames -HostingDir $hostingDir',
                'Stop-ControlPlaneOwnerByLock',
                "Join-Path $HostingDir 'hosting-supervisor-status.json.lock'",
                "Join-Path $HostingDir 'main-sync-status.json.lock'",
                'Sanitize-LegacyHostingState -HostingDir $hostingDir',
                'Update-StatusFromSyncPayload -CurrentStatus $status -SyncStatus $syncStatus',
                'Assert-SyncStatusHealthy -SyncStatus $syncStatus',
                'sync_status_invalid:',
                'release_target_invalid_commit',
                'Normalize-HostingGitCommit -Value ([string]$releaseTargetPayload.target_commit)',
                'site_root_mismatch',
                'site_root_ok = $false',
                "served_site_root = ''",
                "served_commit = ''",
                "caddy_runtime_config_path = ''",
                'Invoke-LocalRuntimeFingerprintStatus',
                'sync_lock_unrecoverable',
                'Invoke-ConfigScript -SkipBootstrapSync -StartSupervisorNow',
                '-SupervisorStatusPath $supervisorStatusPath',
                'supervisor_boot_failed',
                'supervisor_auth_contract_failed',
                'supervisor_service_stopped',
                'Reparacion completada con health/auth/smoke locales en verde.',
            ],
        },
        {
            filePath: SUPERVISOR_SCRIPT_PATH,
            snippets: [
                "$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'",
                'Get-HostingRuntimePaths -RepoRoot $mirrorRepoPathResolved',
                'Invoke-LocalRuntimeFingerprintStatus',
                "[int]$LockTtlSeconds = 600",
                '[int]$RepairCooldownSeconds = 300',
                '$repairTimeoutSeconds = 300',
                'Acquire-SupervisorLock',
                'Get-LockSnapshot',
                'Acquire-HostingDirectoryLock',
                'Remove-HostingDirectoryLock',
                'Repair-HostingLegacyLocks -LockPaths @($lockPath)',
                'Invoke-HostingSmoke',
                'Invoke-Repair',
                'supervisor_lock_unrecoverable',
                'repair_timeout',
                'repair_child_pid',
                "status_source = 'supervisor_runtime'",
                'phase_heartbeat_at = [DateTimeOffset]::Now.ToString(\'o\')',
                "supervisor_state = 'failed'",
                '$supervisorState = \'recovering\'',
                'desired_commit = Get-DesiredCommit',
                'sync_state =',
                'sync_deploy_state =',
                'lock_repaired =',
                'lock_repair_reason =',
                'current_commit =',
                'previous_commit =',
                'lock_state =',
                'lock_reason =',
                'lock_owner_pid =',
                'lock_started_at =',
                'lock_age_seconds =',
                'site_root_ok = ($runtime.Ok -eq $true)',
                'served_site_root = [string]$runtime.SiteRoot',
                'served_commit = if (-not [string]::IsNullOrWhiteSpace([string]$runtime.CurrentCommit))',
                'caddy_runtime_config_path = [string]$runtime.CaddyRuntimeConfigPath',
                'rollback_performed = $false',
                'rollback_reason =',
                'last_successful_deploy_at =',
                'last_failure_reason =',
                'Supervisor detecto degradacion persistente',
            ],
        },
        {
            filePath: START_SCRIPT_PATH,
            snippets: [
                "$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'",
                "[string]$ExternalEnvPath = 'C:\\ProgramData\\Pielarmonia\\hosting\\env.php'",
                'Get-HostingRuntimePaths -RepoRoot $repoRoot',
                'New-HostingRuntimeCaddyConfig',
                'Get-LocalRuntimeFingerprintStatus',
                'function Ensure-CaddyEdge',
                'function Ensure-CloudflaredTunnel',
                'function Ensure-LocalHelper',
                'function Ensure-OperatorTransportReady',
                'function Read-PhpEnvFileValues',
                'function Get-EffectiveOperatorAuthBootstrapConfig',
                'function Sync-ExternalEnvFile',
                'function Apply-MirrorEnvRuntimeOverlay',
                "data\\runtime\\hosting\\env.runtime-overrides.inc.php",
                'Aplicado overlay runtime env:',
                'Apply-MirrorEnvRuntimeOverlay -DestinationPath $mirrorEnvPath -OverridePath $mirrorEnvOverridePath',
                'function Refresh-OperatorAuthRuntime',
                "phase=sync_env",
                "phase=render_caddy",
                "phase=refresh_php",
                "phase=refresh_caddy",
                "phase=validate_site_root",
                "phase=resolve_transport",
                "phase=start_tunnel",
                'bootstrap_contract_deferred',
                'Operator auth transport detectado',
                'Se asume web_broker desde env.php efectivo durante bootstrap.',
                'site_root_mismatch expected_root=',
                'OpenClaw auth helper omitido; transport activo:',
            ],
        },
        {
            filePath: SMOKE_SCRIPT_PATH,
            snippets: [
                "$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'",
                "$ExpectedTransport = 'web_broker'",
                '127\\.0\\.0\\.1:4173',
                '$adminJs = Invoke-TextFetch -Url "$base/admin.js"',
                '$operatorJs = Invoke-TextFetch -Url "$base/js/queue-operator.js"',
                '$checkItems = @()',
                'Write-HostingJsonFile -Path $ReportPath -Payload $report',
                'Smoke local OK: transport={0}',
                '$healthDetail = $healthResponse.Error',
                '$authDetail = $statusResponse.Error',
                '$localhostDetail = \'Sin referencias activas al helper local.\'',
            ],
        },
    ];

    for (const entry of required) {
        const raw = load(entry.filePath);
        for (const snippet of entry.snippets) {
            assert.equal(
                raw.includes(snippet),
                true,
                `falta snippet V2 en ${entry.filePath}: ${snippet}`
            );
        }
    }
});

test('repair V6 sanea estado legacy antes del preflight y valida main-sync-status antes del primer smoke', () => {
    const raw = load(REPAIR_SCRIPT_PATH);
    const orderedSnippets = [
        "Set-RepairPhase -CurrentStatus $status -Phase 'sanitize_legacy_state'",
        'Sanitize-LegacyHostingState -HostingDir $hostingDir',
        '$preflightResult = Invoke-SyncScript -CurrentPreflightOnly',
        "Set-RepairPhase -CurrentStatus $status -Phase 'quiesce'",
        'Disable-ControlPlane -CurrentTaskNames $taskNames -HostingDir $hostingDir',
        "Set-RepairPhase",
        '$syncResult = Invoke-SyncScript',
        '$syncStatus = Read-HostingJsonFileSafe -Path $syncStatusPath',
        'Assert-SyncStatusHealthy -SyncStatus $syncStatus',
        "Phase 'validate_stack'",
        'Invoke-LocalSmoke -ScriptPath $smokeScriptPath',
        "Phase 'configure_runtime'",
        'Invoke-ConfigScript -SkipBootstrapSync -StartSupervisorNow',
        "Phase 'validate_supervisor'",
        '-SupervisorStatusPath $supervisorStatusPath',
        "Phase 'final_smoke'",
        'Invoke-LocalSmoke -ScriptPath $smokeScriptPath',
    ];

    let previousIndex = -1;
    for (const snippet of orderedSnippets) {
        const nextIndex = raw.indexOf(snippet, previousIndex + 1);
        assert.notEqual(nextIndex, -1, `falta snippet de orden en repair V3: ${snippet}`);
        assert.ok(nextIndex > previousIndex, `orden incorrecto en repair V3 alrededor de: ${snippet}`);
        previousIndex = nextIndex;
    }
});

test('smoke V4 evita el patron de reporte fragil para Windows PowerShell 5.1', () => {
    const raw = load(SMOKE_SCRIPT_PATH);
    assert.equal(raw.includes('$report = [ordered]@{'), false);
    assert.equal(raw.includes('checks = @($checks)'), false);
    assert.equal(raw.includes('$checkItems = @()'), true);
});

test('runtime Caddy y fingerprint local de hosting quedan expuestos en el repo', () => {
    const caddyRaw = load(CADDYFILE_PATH);
    const runtimeRaw = load(HOSTING_RUNTIME_PHP_PATH);
    const helperRaw = load(HOSTING_RUNTIME_HELPER_PATH);

    for (const snippet of [
        '@hostingRuntimeLocal',
        '@hostingRuntimeBlocked',
        'path /__hosting/runtime /hosting-runtime.php',
        'remote_ip 127.0.0.1/32 ::1/128',
        'respond @hostingRuntimeBlocked 403',
        'rewrite @hostingRuntimeLocal /hosting-runtime.php',
        '/hosting-runtime.php',
    ]) {
        assert.equal(caddyRaw.includes(snippet), true, `falta routing local de runtime: ${snippet}`);
    }

    for (const snippet of [
        "header('Content-Type: application/json; charset=utf-8');",
        "require_once __DIR__ . '/lib/hosting_runtime_fingerprint.php';",
        "return in_array($remote, ['127.0.0.1', '::1', '::ffff:127.0.0.1'], true);",
        'hosting_runtime_build_fingerprint(__DIR__)',
        "'hosting_runtime_fingerprint'",
        "'site_root'",
        "'current_commit'",
        "'desired_commit'",
        "'caddy_runtime_config_path'",
    ]) {
        assert.equal(runtimeRaw.includes(snippet), true, `falta fingerprint PHP: ${snippet}`);
    }

    for (const snippet of [
        'function hosting_runtime_build_fingerprint',
        'function hosting_runtime_current_commit',
        'function hosting_runtime_resolve_release_target',
        "'C:\\\\ProgramData\\\\Pielarmonia\\\\hosting\\\\release-target.runtime.json'",
        "'C:\\\\ProgramData\\\\Pielarmonia\\\\hosting\\\\release-target.json'",
    ]) {
        assert.equal(helperRaw.includes(snippet), true, `falta helper PHP de fingerprint: ${snippet}`);
    }
});

test('helper SSH de Windows usa release target runtime y contrato externo de auth', () => {
    const raw = load(WINDOWS_HOSTING_SSH_COMMON_PATH);

    for (const snippet of [
        "WINDOWS_RELEASE_TARGET_PATH_DEFAULT='C:\\ProgramData\\Pielarmonia\\hosting\\release-target.runtime.json'",
        'export SSH_PORT="${SSH_PORT:-22}"',
        'export SSH_PASSWORD="${SSH_PASSWORD:-}"',
        'if [[ -n "${SSH_IDENTITY_FILE:-}" ]]; then',
        'WINDOWS_SSH_TARGET="${SSH_USERNAME}@${SSH_HOST}"',
    ]) {
        assert.equal(raw.includes(snippet), true, `falta contrato SSH Windows: ${snippet}`);
    }
});

test('hosting Windows alinea auth web broker y runtime release target canonico', () => {
    const syncRaw = load(SYNC_SCRIPT_PATH);
    const smokeRaw = load(SMOKE_SCRIPT_PATH);
    const repairRaw = load(REPAIR_SCRIPT_PATH);
    const supervisorRaw = load(SUPERVISOR_SCRIPT_PATH);
    const configRaw = load(CONFIG_SCRIPT_PATH);

    for (const raw of [syncRaw, repairRaw, supervisorRaw]) {
        assert.equal(
            raw.includes('openclaw_chatgpt'),
            true,
            'los scripts de hosting deben aceptar openclaw_chatgpt'
        );
        assert.equal(
            raw.includes('release-target.runtime.json'),
            true,
            'los scripts de hosting deben usar el release target runtime'
        );
    }

    assert.equal(
        configRaw.includes('release-target.runtime.json'),
        true,
        'el configurador debe apuntar al release target runtime'
    );
    assert.equal(
        smokeRaw.includes('openclaw_chatgpt,google_oauth'),
        true,
        'el smoke debe aceptar el modo web broker canonico y el legado durante la transicion'
    );
    assert.equal(
        smokeRaw.includes('function Test-ExpectedAuthMode'),
        true,
        'el smoke debe soportar multiples modos esperados'
    );
});

test('sync V7 no deja state=locked con owner_pid invalido y expone timeout, heartbeat y site_root', () => {
    const raw = load(SYNC_SCRIPT_PATH);
    assert.equal(raw.includes("if ($status.lock_owner_pid -gt 0) {\n            $status.state = 'locked'"), true);
    assert.equal(raw.includes("throw 'sync_lock_unrecoverable'"), true);
    assert.equal(raw.includes("throw 'sync_restart_timeout'"), true);
    assert.equal(raw.includes('phase_heartbeat_at = [DateTimeOffset]::Now.ToString(\'o\')'), true);
    assert.equal(raw.includes('lock_repaired = $false'), true);
    assert.equal(raw.includes("if (-not (Test-Path -LiteralPath $lockPath)) {\n            $status.lock_state = 'unlocked'"), true);
    assert.equal(raw.includes('site_root_ok = $false'), true);
    assert.equal(raw.includes('site_root_mismatch'), true);
});

test('entrypoints criticos de Windows no dejan if parentetizado en posiciones fragiles', () => {
    const criticalPaths = [
        COMMON_SCRIPT_PATH,
        CADDYFILE_PATH,
        SYNC_SCRIPT_PATH,
        CONFIG_SCRIPT_PATH,
        SUPERVISOR_SCRIPT_PATH,
        REPAIR_SCRIPT_PATH,
        START_SCRIPT_PATH,
        SMOKE_SCRIPT_PATH,
    ];
    const riskyPattern = /\(\s*if\s*\(/;
    const detailPattern = /-Detail\s+\(\s*if\s*\(/;

    for (const filePath of criticalPaths) {
        const raw = load(filePath);
        assert.equal(detailPattern.test(raw), false, `patron -Detail (if prohibido en ${filePath}`);
        assert.equal(riskyPattern.test(raw), false, `if parentetizado prohibido en ${filePath}`);
    }
});
