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

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('Windows V5 define modulo comun de compatibilidad y saneamiento de locks legacy', () => {
    const raw = load(COMMON_SCRIPT_PATH);
    const requiredSnippets = [
        'function ConvertFrom-JsonCompat',
        'function Read-HostingJsonFileSafe',
        'function Write-HostingJsonFile',
        'function Get-HostingFileSha256',
        'function Invoke-HostingHttpRequest',
        'function Invoke-HostingJsonRequest',
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

test('sync V5 usa release pin, sanea locks legacy y falla duro solo si quedan irrecuperables', () => {
    const raw = load(SYNC_SCRIPT_PATH);
    const requiredSnippets = [
        "[switch]$PreflightOnly",
        "$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'",
        'Acquire-SyncLock',
        'Get-HostingLockInfoPath -LockDirectoryPath $lockPath',
        'Acquire-HostingDirectoryLock',
        'Remove-HostingDirectoryLock',
        "state = 'discovering'",
        "deploy_state = 'discover'",
        "state = 'preflight'",
        "deploy_state = 'preflight'",
        'Get-GitRevisionOrThrow',
        'Invoke-ValidateMirror -CurrentTunnelId $TunnelId',
        "state = 'preflight_ready'",
        "deploy_state = 'preflight_ready'",
        "state = 'applying'",
        "deploy_state = 'apply'",
        "state = 'restarting'",
        "deploy_state = 'restart'",
        "state = 'validating'",
        "deploy_state = 'validate'",
        "state = 'rollback'",
        "deploy_state = 'rollback'",
        'desired_commit =',
        'current_commit =',
        'previous_commit =',
        'service_state =',
        'lock_state =',
        'lock_reason =',
        'lock_owner_pid =',
        'lock_started_at =',
        'lock_age_seconds =',
        'lock_repaired = $false',
        'lock_repair_reason =',
        "status_source = 'sync_runtime'",
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

test('repair, supervisor, start y smoke usan contrato V5 fail-safe', () => {
    const required = [
        {
            filePath: REPAIR_SCRIPT_PATH,
            snippets: [
                "[switch]$PreflightOnly",
                "$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'",
                "phase = 'discover'",
                "phase = 'sanitize_legacy_state'",
                "phase = 'preflight'",
                "phase = 'quiesce'",
                "phase = 'apply'",
                "phase = 'validate_stack'",
                "phase = 'configure_runtime'",
                "phase = 'validate_supervisor'",
                "phase = 'final_smoke'",
                "phase = 'completed'",
                'Invoke-SyncScript -CurrentPreflightOnly',
                'Preflight de reparacion OK; no se tocaron procesos activos.',
                'Disable-ControlPlane -CurrentTaskNames $taskNames -HostingDir $hostingDir',
                'Sanitize-LegacyHostingState -HostingDir $hostingDir',
                'Update-StatusFromSyncPayload -CurrentStatus $status -SyncStatus $syncStatus',
                'Assert-SyncStatusHealthy -SyncStatus $syncStatus',
                'sync_status_invalid:',
                'sync_lock_unrecoverable',
                'Invoke-ConfigScript -SkipBootstrapSync -StartSupervisorNow',
                'Wait-ForSupervisorReady -SupervisorStatusPath $supervisorStatusPath',
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
                "[int]$LockTtlSeconds = 600",
                'Acquire-SupervisorLock',
                'Get-LockSnapshot',
                'Acquire-HostingDirectoryLock',
                'Remove-HostingDirectoryLock',
                'Repair-HostingLegacyLocks -LockPaths @($lockPath)',
                'Invoke-HostingSmoke',
                'Invoke-Repair',
                'supervisor_lock_unrecoverable',
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
                'function Ensure-CaddyEdge',
                'function Ensure-CloudflaredTunnel',
                'function Ensure-LocalHelper',
                'function Ensure-OperatorTransportReady',
                'function Read-PhpEnvFileValues',
                'function Get-EffectiveOperatorAuthBootstrapConfig',
                'function Sync-ExternalEnvFile',
                'function Refresh-OperatorAuthRuntime',
                'Operator auth transport detectado',
                'Se asume web_broker desde env.php efectivo durante bootstrap.',
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

test('repair V5 sanea estado legacy antes del preflight y valida main-sync-status antes del primer smoke', () => {
    const raw = load(REPAIR_SCRIPT_PATH);
    const orderedSnippets = [
        "phase = 'sanitize_legacy_state'",
        'Sanitize-LegacyHostingState -HostingDir $hostingDir',
        '$preflightResult = Invoke-SyncScript -CurrentPreflightOnly',
        "phase = 'quiesce'",
        'Disable-ControlPlane -CurrentTaskNames $taskNames -HostingDir $hostingDir',
        "phase = 'apply'",
        '$syncResult = Invoke-SyncScript',
        '$syncStatus = Read-HostingJsonFileSafe -Path $syncStatusPath',
        'Assert-SyncStatusHealthy -SyncStatus $syncStatus',
        "phase = 'validate_stack'",
        'Invoke-LocalSmoke -ScriptPath $smokeScriptPath',
        "phase = 'configure_runtime'",
        'Invoke-ConfigScript -SkipBootstrapSync -StartSupervisorNow',
        "phase = 'validate_supervisor'",
        'Wait-ForSupervisorReady -SupervisorStatusPath $supervisorStatusPath',
        "phase = 'final_smoke'",
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

test('sync V5 no deja state=locked con owner_pid invalido y expone lock_repaired', () => {
    const raw = load(SYNC_SCRIPT_PATH);
    assert.equal(raw.includes("if ($status.lock_owner_pid -gt 0) {\n            $status.state = 'locked'"), true);
    assert.equal(raw.includes("throw 'sync_lock_unrecoverable'"), true);
    assert.equal(raw.includes('lock_repaired = $false'), true);
    assert.equal(raw.includes("if (-not (Test-Path -LiteralPath $lockPath)) {\n            $status.lock_state = 'unlocked'"), true);
});

test('entrypoints criticos de Windows no dejan if parentetizado en posiciones fragiles', () => {
    const criticalPaths = [
        COMMON_SCRIPT_PATH,
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
