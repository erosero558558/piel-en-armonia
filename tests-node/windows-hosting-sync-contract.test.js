#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
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

test('sync script usa mirror limpio pinneado, lock autorecuperable y rollback', () => {
    const raw = load(SYNC_SCRIPT_PATH);
    const requiredSnippets = [
        "[string]$MirrorRepoPath = 'C:\\dev\\pielarmonia-clean-main'",
        "[string]$ExternalEnvPath = 'C:\\ProgramData\\Pielarmonia\\hosting\\env.php'",
        "[string]$StatusPath = 'C:\\ProgramData\\Pielarmonia\\hosting\\main-sync-status.json'",
        "[string]$LogPath = 'C:\\ProgramData\\Pielarmonia\\hosting\\main-sync.log'",
        "[string]$ReleaseTargetPath = 'C:\\ProgramData\\Pielarmonia\\hosting\\release-target.json'",
        '[int]$LockTtlSeconds = 600',
        '[switch]$BootstrapReleaseTargetIfMissing',
        "$mirrorEnvPath = Join-Path $mirrorRepoPathResolved 'env.php'",
        "$mirrorStartScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\\ops\\setup\\ARRANCAR-HOSTING-WINDOWS.ps1'",
        "$lockPath = $statusPathResolved + '.lock'",
        "$lockInfoPath = $lockPath + '.json'",
        'function Acquire-SyncLock',
        'Stale lock detectado; se libera lock',
        'function Resolve-DesiredCommit',
        'Release target bootstrapeado',
        'desired_commit =',
        'previous_commit =',
        'current_commit =',
        'deploy_state =',
        'lock_owner_pid =',
        'lock_age_seconds =',
        'rollback_performed = $false',
        'rollback_reason =',
        'last_successful_deploy_at =',
        'last_failure_reason =',
        "Invoke-Git -Arguments @('clone', '--branch', $Branch, '--single-branch', $RepoUrl, $mirrorRepoPathResolved)",
        "Invoke-Git -Arguments @('-C', $mirrorRepoPathResolved, 'fetch', '--prune', 'origin')",
        "Invoke-Git -Arguments @('-C', $mirrorRepoPathResolved, 'checkout', '--force', $Branch)",
        "Invoke-Git -Arguments @('-C', $mirrorRepoPathResolved, 'reset', '--hard', $status.desired_commit)",
        'Copy-Item -LiteralPath $externalEnvPathResolved -Destination $mirrorEnvPath -Force',
        "'http://127.0.0.1/api.php?resource=health-diagnostics'",
        "'http://127.0.0.1/admin-auth.php?action=status'",
        '$CurrentStatus.auth_contract_ok = $Validation.Auth.Ok -eq $true',
        '$CurrentStatus.service_state = [string]$Validation.Service.State',
        'Desired commit {0} fallo validacion; se ejecuta rollback automatico',
        '-SourceRunId \'auto_rollback\'',
        '$status.state = \'rolled_back\'',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet del sync seguro de Windows: ${snippet}`
        );
    }
});

test('config script registra supervisor, sync por minuto y launchers de recovery', () => {
    const raw = load(CONFIG_SCRIPT_PATH);
    const requiredSnippets = [
        "[string]$MirrorRepoPath = 'C:\\dev\\pielarmonia-clean-main'",
        "[string]$ExternalEnvPath = 'C:\\ProgramData\\Pielarmonia\\hosting\\env.php'",
        "[string]$ReleaseTargetPath = 'C:\\ProgramData\\Pielarmonia\\hosting\\release-target.json'",
        "$bootstrapSyncScriptPath = Join-Path $repoRoot 'scripts\\ops\\setup\\SINCRONIZAR-HOSTING-WINDOWS.ps1'",
        "$mirrorSupervisorScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\\ops\\setup\\SUPERVISAR-HOSTING-WINDOWS.ps1'",
        "$mirrorRepairScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\\ops\\setup\\REPARAR-HOSTING-WINDOWS.ps1'",
        "$supervisorLauncherPath = Join-Path $runtimeRoot 'supervisor.cmd'",
        "$mainSyncLauncherPath = Join-Path $runtimeRoot 'main-sync.cmd'",
        "$repairLauncherPath = Join-Path $runtimeRoot 'repair-hosting.cmd'",
        "$supervisorTaskName = 'Pielarmonia Hosting Supervisor'",
        "$mainSyncTaskName = 'Pielarmonia Hosting Main Sync'",
        "$legacyBootTaskName = 'Pielarmonia Hosting Stack'",
        '-BootstrapReleaseTargetIfMissing',
        'Write-LauncherScript -Path $supervisorLauncherPath -Command $supervisorCommand',
        'Write-LauncherScript -Path $mainSyncLauncherPath -Command $mainSyncCommand',
        'Write-LauncherScript -Path $repairLauncherPath -Command $repairCommand',
        'Write-LauncherScript -Path $loginLauncherPath -Command ("call " + $supervisorLauncherCommand)',
        'Write-LauncherScript -Path $bootLauncherPath -Command ("call " + $supervisorLauncherCommand)',
        'Tarea legacy eliminada',
        'Tarea programada de supervisor instalada',
        'Tarea programada de sync instalada',
        'Supervisor lanzado en la sesion actual.',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet del configurador de Windows: ${snippet}`
        );
    }
});

test('repair, supervisor y smoke exponen entrypoints canonicos del hosting Windows', () => {
    const required = [
        {
            filePath: REPAIR_SCRIPT_PATH,
            snippets: [
                "$syncScriptPath = Join-Path $repoRoot 'scripts\\ops\\setup\\SINCRONIZAR-HOSTING-WINDOWS.ps1'",
                "$configScriptPath = Join-Path $repoRoot 'scripts\\ops\\setup\\CONFIGURAR-HOSTING-WINDOWS.ps1'",
                "$smokeScriptPath = Join-Path $repoRoot 'scripts\\ops\\setup\\SMOKE-HOSTING-WINDOWS.ps1'",
                "$taskNames = @(",
                "'Pielarmonia Hosting Supervisor'",
                "'Pielarmonia Hosting Main Sync'",
                'Clear-HostingLocks',
                'Stop-ProcessesByNeedle -Needles @(\'php-cgi.exe\', \'-b 127.0.0.1:9000\')',
                'Resolve-RemoteHead',
                '-BootstrapReleaseTargetIfMissing',
                'Reparacion completada con health/auth/smoke locales en verde.',
            ],
        },
        {
            filePath: SUPERVISOR_SCRIPT_PATH,
            snippets: [
                "[string]$StatusPath = 'C:\\ProgramData\\Pielarmonia\\hosting\\hosting-supervisor-status.json'",
                "[string]$LogPath = 'C:\\ProgramData\\Pielarmonia\\hosting\\hosting-supervisor.log'",
                "$repairScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\\ops\\setup\\REPARAR-HOSTING-WINDOWS.ps1'",
                "$smokeScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\\ops\\setup\\SMOKE-HOSTING-WINDOWS.ps1'",
                'function Acquire-SupervisorLock',
                'function Invoke-HostingSmoke',
                'function Invoke-Repair',
                '$degraded = ($service.State -ne \'running\') -or (-not $health.Ok) -or (-not $auth.Ok) -or (-not $smoke.Ok)',
                'Supervisor detecto degradacion persistente',
            ],
        },
        {
            filePath: SMOKE_SCRIPT_PATH,
            snippets: [
                "[string]$BaseUrl = 'http://127.0.0.1'",
                "127\\.0\\.0\\.1:4173",
                '$ExpectedTransport = \'web_broker\'',
                '$adminJs = Invoke-TextFetch -Url "$base/admin.js"',
                '$operatorJs = Invoke-TextFetch -Url "$base/js/queue-operator.js"',
                'Smoke local OK: transport={0}',
            ],
        },
    ];

    for (const entry of required) {
        const raw = load(entry.filePath);
        for (const snippet of entry.snippets) {
            assert.equal(
                raw.includes(snippet),
                true,
                `falta snippet contractual en ${entry.filePath}: ${snippet}`
            );
        }
    }
});
