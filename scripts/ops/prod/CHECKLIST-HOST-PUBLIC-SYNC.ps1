param(
    [ValidateSet('windows_selfhosted', 'linux_legacy')]
    [string]$HostProfile = 'windows_selfhosted',
    [string]$Domain = 'https://pielarmonia.com',
    [string]$RepoPath = '/var/www/figo',
    [string]$GeneratedSiteRoot = '/var/www/figo/.generated/site-root',
    [string]$DeployBundlePath = '/var/www/figo/_deploy_bundle',
    [string]$WrapperPath = '/root/sync-pielarmonia.sh',
    [string]$CanonicalWrapperPath = '/var/www/figo/bin/deploy-public-v3-cron-sync.sh',
    [string]$StatusPath = '/var/lib/pielarmonia/public-sync-status.json',
    [string]$ReleaseTargetPath = '',
    [string]$RuntimeUrl = '',
    [string]$MainSyncTaskName = '',
    [string]$LogPath = '/var/log/sync-pielarmonia.log',
    [string]$LockPath = '/tmp/sync-pielarmonia.lock',
    [string]$DiagnosticsUrl = 'http://127.0.0.1/api.php?resource=health-diagnostics',
    [ValidateSet('text', 'markdown')]
    [string]$Format = 'text',
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')
$generatedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$lines = New-Object System.Collections.Generic.List[string]
$legacyDefaults = @{
    RepoPath = '/var/www/figo'
    GeneratedSiteRoot = '/var/www/figo/.generated/site-root'
    DeployBundlePath = '/var/www/figo/_deploy_bundle'
    WrapperPath = '/root/sync-pielarmonia.sh'
    CanonicalWrapperPath = '/var/www/figo/bin/deploy-public-v3-cron-sync.sh'
    StatusPath = '/var/lib/pielarmonia/public-sync-status.json'
    ReleaseTargetPath = ''
    RuntimeUrl = ''
    MainSyncTaskName = ''
    LogPath = '/var/log/sync-pielarmonia.log'
    LockPath = '/tmp/sync-pielarmonia.lock'
    DiagnosticsUrl = 'http://127.0.0.1/api.php?resource=health-diagnostics'
}
$hostProfiles = @{
    windows_selfhosted = @{
        RepoPath = 'C:\dev\pielarmonia-clean-main'
        GeneratedSiteRoot = 'C:\dev\pielarmonia-clean-main\.generated\site-root'
        DeployBundlePath = 'C:\dev\pielarmonia-clean-main\_deploy_bundle'
        WrapperPath = 'C:\dev\pielarmonia-clean-main\bin\deploy-public-v3-cron-sync.sh'
        CanonicalWrapperPath = 'C:\dev\pielarmonia-clean-main\bin\deploy-public-v3-cron-sync.sh'
        StatusPath = 'C:\ProgramData\Pielarmonia\hosting\main-sync-status.json'
        ReleaseTargetPath = 'C:\ProgramData\Pielarmonia\hosting\release-target.runtime.json'
        RuntimeUrl = 'http://127.0.0.1/__hosting/runtime'
        MainSyncTaskName = 'Pielarmonia Hosting Main Sync'
        LogPath = 'C:\ProgramData\Pielarmonia\hosting\main-sync.runtime.log'
        LockPath = 'C:\tmp\sync-pielarmonia.lock'
        DiagnosticsUrl = 'https://pielarmonia.com/api.php?resource=health-diagnostics'
    }
    linux_legacy = $legacyDefaults
}

function Add-ChecklistLine {
    param([string]$Line = '')

    $script:lines.Add($Line) | Out-Null
}

function Add-ChecklistSection {
    param([string]$Title)

    if ($script:Format -eq 'markdown') {
        Add-ChecklistLine "## $Title"
    } else {
        Add-ChecklistLine "== $Title =="
    }
    Add-ChecklistLine
}

function Add-ChecklistBullet {
    param([string]$Text)

    Add-ChecklistLine "- $Text"
}

function Add-ChecklistCommandBlock {
    param([string[]]$Commands)

    if ($script:Format -eq 'markdown') {
        Add-ChecklistLine '```bash'
        foreach ($command in $Commands) {
            Add-ChecklistLine $command
        }
        Add-ChecklistLine '```'
    } else {
        foreach ($command in $Commands) {
            Add-ChecklistLine "  $command"
        }
    }
    Add-ChecklistLine
}

function Resolve-ProfileValue {
    param(
        [string]$CurrentValue,
        [string]$LegacyValue,
        [string]$ProfileValue
    )

    if ([string]::IsNullOrWhiteSpace($CurrentValue) -or $CurrentValue -eq $LegacyValue) {
        return $ProfileValue
    }

    return $CurrentValue
}

$selectedProfile = $hostProfiles[$HostProfile]
$RepoPath = Resolve-ProfileValue $RepoPath $legacyDefaults.RepoPath $selectedProfile.RepoPath
$GeneratedSiteRoot = Resolve-ProfileValue $GeneratedSiteRoot $legacyDefaults.GeneratedSiteRoot $selectedProfile.GeneratedSiteRoot
$DeployBundlePath = Resolve-ProfileValue $DeployBundlePath $legacyDefaults.DeployBundlePath $selectedProfile.DeployBundlePath
$WrapperPath = Resolve-ProfileValue $WrapperPath $legacyDefaults.WrapperPath $selectedProfile.WrapperPath
$CanonicalWrapperPath = Resolve-ProfileValue $CanonicalWrapperPath $legacyDefaults.CanonicalWrapperPath $selectedProfile.CanonicalWrapperPath
$StatusPath = Resolve-ProfileValue $StatusPath $legacyDefaults.StatusPath $selectedProfile.StatusPath
$ReleaseTargetPath = Resolve-ProfileValue $ReleaseTargetPath $legacyDefaults.ReleaseTargetPath $selectedProfile.ReleaseTargetPath
$RuntimeUrl = Resolve-ProfileValue $RuntimeUrl $legacyDefaults.RuntimeUrl $selectedProfile.RuntimeUrl
$MainSyncTaskName = Resolve-ProfileValue $MainSyncTaskName $legacyDefaults.MainSyncTaskName $selectedProfile.MainSyncTaskName
$LogPath = Resolve-ProfileValue $LogPath $legacyDefaults.LogPath $selectedProfile.LogPath
$LockPath = Resolve-ProfileValue $LockPath $legacyDefaults.LockPath $selectedProfile.LockPath
$DiagnosticsUrl = Resolve-ProfileValue $DiagnosticsUrl $legacyDefaults.DiagnosticsUrl $selectedProfile.DiagnosticsUrl

if ($HostProfile -eq 'windows_selfhosted') {
    $snapshotHostCommands = @(
        "((Invoke-WebRequest -UseBasicParsing -Uri '$RuntimeUrl').Content | ConvertFrom-Json) | ConvertTo-Json -Depth 4",
        "Get-Content -LiteralPath '$ReleaseTargetPath'",
        "Get-Content -LiteralPath '$StatusPath'",
        "Get-Content -LiteralPath '$LogPath' -Tail 50",
        "Get-ScheduledTask -TaskName '$MainSyncTaskName' | Format-List TaskName,State,LastRunTime,LastTaskResult,NextRunTime",
        "Get-Item -LiteralPath '$StatusPath' | Format-List FullName,Length,LastWriteTime",
        "Get-Item -LiteralPath '$LockPath' -ErrorAction SilentlyContinue | Format-List FullName,Length,LastWriteTime",
        "Get-ChildItem -LiteralPath '$GeneratedSiteRoot' -ErrorAction SilentlyContinue | Select-Object -First 20 FullName",
        "Get-ChildItem -LiteralPath '$DeployBundlePath' -ErrorAction SilentlyContinue | Select-Object -First 20 FullName"
    )
    $snapshotRepoCommands = @(
        "Set-Location '$RepoPath'",
        'git status --short',
        'git rev-parse HEAD',
        'git rev-parse origin/main',
        'git diff --name-only',
        'git ls-files -m',
        "Get-ChildItem -LiteralPath '$GeneratedSiteRoot' -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 20 FullName",
        "Get-ChildItem -LiteralPath '$DeployBundlePath' -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 20 FullName"
    )
    $diagnosticsCommands = @(
        "node agent-orchestrator.js jobs verify public_main_sync --json",
        "((Invoke-WebRequest -UseBasicParsing -Uri '$DiagnosticsUrl').Content | ConvertFrom-Json).checks.publicSync | Select-Object configured,jobId,state,healthy,operationallyHealthy,repoHygieneIssue,ageSeconds,expectedMaxLagSeconds,lastCheckedAt,lastSuccessAt,lastErrorAt,failureReason,lastErrorMessage,currentHead,remoteHead,dirtyPathsCount,dirtyPathsSample | ConvertTo-Json -Depth 4",
        "((Invoke-WebRequest -UseBasicParsing -Uri '$DiagnosticsUrl').Content | ConvertFrom-Json).checks.storage | Select-Object backend,source,encrypted,encryptionConfigured,encryptionRequired,encryptionStatus,encryptionCompliant | ConvertTo-Json -Depth 4",
        "((Invoke-WebRequest -UseBasicParsing -Uri '$DiagnosticsUrl').Content | ConvertFrom-Json).checks.auth | Select-Object mode,status,configured,hardeningCompliant,recommendedMode,recommendedModeActive,twoFactorEnabled,operatorAuthEnabled,operatorAuthConfigured,legacyPasswordConfigured | ConvertTo-Json -Depth 4"
    )
    $healthCommands = @(
        "(Invoke-WebRequest -UseBasicParsing -Uri '$base/api.php?resource=health').Content",
        "(((Invoke-WebRequest -UseBasicParsing -Uri '$base/api.php?resource=health').Content | ConvertFrom-Json).checks.publicSync | Select-Object configured,jobId,state,healthy,operationallyHealthy,failureReason,lastErrorMessage) | ConvertTo-Json -Depth 4"
    )
    $wrapperCommands = @(
        "Write-Host 'windows_selfhosted: descubre primero el scheduler o servicio real desde jobs verify y la configuracion del runner antes de forzar una corrida.'",
        "node agent-orchestrator.js jobs verify public_main_sync --json",
        "pwsh -File .\scripts\ops\setup\SINCRONIZAR-HOSTING-WINDOWS.ps1 -StatusPath '$StatusPath' -ReleaseTargetPath '$ReleaseTargetPath'",
        "((Invoke-WebRequest -UseBasicParsing -Uri '$RuntimeUrl').Content | ConvertFrom-Json) | ConvertTo-Json -Depth 4",
        "Get-Content -LiteralPath '$StatusPath'",
        "Get-Content -LiteralPath '$LogPath' -Tail 50",
        "Get-Item -LiteralPath '$LockPath' -ErrorAction SilentlyContinue | Format-List FullName,Length,LastWriteTime"
    )
} else {
    $snapshotHostCommands = @(
        "sha256sum $WrapperPath $CanonicalWrapperPath",
        "cmp -s $WrapperPath $CanonicalWrapperPath && echo wrapper_match || echo wrapper_diff",
        "stat $WrapperPath $CanonicalWrapperPath",
        "ls -ld $GeneratedSiteRoot $DeployBundlePath 2>/dev/null || true",
        "cat $StatusPath",
        "tail -n 50 $LogPath"
    )
    $snapshotRepoCommands = @(
        "cd $RepoPath",
        'git status --short',
        'git rev-parse HEAD',
        'git rev-parse origin/main',
        'git diff --name-only',
        'git ls-files -m',
        "find $GeneratedSiteRoot -maxdepth 2 -type f | head -n 20",
        "find $DeployBundlePath -maxdepth 2 -type f | head -n 20"
    )
    $diagnosticsCommands = @(
        "curl -s $DiagnosticsUrl",
        "curl -s $DiagnosticsUrl | jq '.checks.publicSync | {configured, jobId, state, healthy, operationallyHealthy, repoHygieneIssue, ageSeconds, expectedMaxLagSeconds, lastCheckedAt, lastSuccessAt, lastErrorAt, failureReason, lastErrorMessage, currentHead, remoteHead, dirtyPathsCount, dirtyPathsSample}'",
        "curl -s $DiagnosticsUrl | jq '.checks.storage | {backend, source, encrypted, encryptionConfigured, encryptionRequired, encryptionStatus, encryptionCompliant}'",
        "curl -s $DiagnosticsUrl | jq '.checks.auth | {mode, status, configured, hardeningCompliant, recommendedMode, recommendedModeActive, twoFactorEnabled, operatorAuthEnabled, operatorAuthConfigured, legacyPasswordConfigured}'"
    )
    $healthCommands = @(
        "curl -s $base/api.php?resource=health",
        "curl -s $base/api.php?resource=health | jq '.checks.publicSync | {configured, jobId, state, healthy, operationallyHealthy, failureReason, lastErrorMessage}'"
    )
    $wrapperCommands = @(
        "install -m 0755 $CanonicalWrapperPath $WrapperPath",
        "/usr/bin/flock -n $LockPath $WrapperPath",
        "ls -ld $GeneratedSiteRoot $DeployBundlePath 2>/dev/null || true",
        "cat $StatusPath",
        "tail -n 50 $LogPath",
        "curl -s $DiagnosticsUrl | jq '.checks.publicSync | {state, healthy, operationallyHealthy, failureReason, currentHead, remoteHead, dirtyPathsCount}'"
    )
}

if ($Format -eq 'markdown') {
    Add-ChecklistLine '# Host Checklist - Public Sync'
    Add-ChecklistLine
} else {
    Add-ChecklistLine 'HOST CHECKLIST - PUBLIC SYNC'
    Add-ChecklistLine
}

Add-ChecklistBullet "generatedAt: $generatedAt"
Add-ChecklistBullet "domain: $base"
Add-ChecklistBullet "hostProfile: $HostProfile"
Add-ChecklistBullet "repoPath: $RepoPath"
Add-ChecklistBullet "generatedSiteRoot: $GeneratedSiteRoot"
Add-ChecklistBullet "deployBundlePath: $DeployBundlePath"
Add-ChecklistBullet "wrapperPath: $WrapperPath"
Add-ChecklistBullet "canonicalWrapperPath: $CanonicalWrapperPath"
Add-ChecklistBullet "statusPath: $StatusPath"
Add-ChecklistBullet "releaseTargetPath: $ReleaseTargetPath"
Add-ChecklistBullet "runtimeUrl: $RuntimeUrl"
Add-ChecklistBullet "mainSyncTaskName: $MainSyncTaskName"
Add-ChecklistBullet "logPath: $LogPath"
Add-ChecklistBullet "diagnosticsUrl: $DiagnosticsUrl"
Add-ChecklistLine

Add-ChecklistSection 'Discovery first'
Add-ChecklistBullet 'No asumas Linux por defecto. Usa jobs verify para descubrir si el target real es windows_selfhosted o linux_legacy.'
Add-ChecklistCommandBlock @(
    'node agent-orchestrator.js jobs verify public_main_sync --json'
)

Add-ChecklistSection 'Snapshot del host'
if ($HostProfile -eq 'windows_selfhosted') {
    Add-ChecklistBullet 'Para windows_selfhosted, inspecciona en este orden `__hosting/runtime`, `release-target.runtime.json`, `main-sync-status.json`, `main-sync.runtime.log` y la tarea programada `Pielarmonia Hosting Main Sync`.'
} else {
    Add-ChecklistBullet 'Confirma si el wrapper live coincide con el wrapper canonico del repo antes de interpretar telemetryGap o working_tree_dirty.'
}
Add-ChecklistCommandBlock $snapshotHostCommands

Add-ChecklistSection 'Snapshot del repo live'
Add-ChecklistBullet 'Verifica drift tracked, HEAD local del VPS, referencia remota de main y si el stage/bundle canonico quedaron presentes o como ruido efimero.'
Add-ChecklistCommandBlock $snapshotRepoCommands

Add-ChecklistSection 'Diagnostics runtime'
Add-ChecklistBullet 'Usa localhost o bearer de diagnostics; no dependas del health publico para el triage detallado.'
Add-ChecklistCommandBlock $diagnosticsCommands

Add-ChecklistSection 'Health publico'
Add-ChecklistBullet 'Confirma si el health publico ya expone checks.publicSync; si falta, el host sigue sirviendo un HealthController stale y jobs verify fallara con health_missing_public_sync o, si no logra leer el endpoint, quedara en registry_only/unverified aunque el cron exista.'
Add-ChecklistCommandBlock $healthCommands

Add-ChecklistSection 'Wrapper canonico y corrida forzada'
if ($HostProfile -eq 'windows_selfhosted') {
    Add-ChecklistBullet 'En windows_selfhosted, si el status sigue stale la corrida manual canonica es `SINCRONIZAR-HOSTING-WINDOWS.ps1`; no arranques por la receta Linux legacy.'
} else {
    Add-ChecklistBullet 'Si el wrapper no coincide o telemetryGap sigue true sin heads/dirty paths, reinstala el wrapper canonico antes de volver a diagnosticar.'
}
Add-ChecklistCommandBlock $wrapperCommands

Add-ChecklistSection 'Variables criticas del host'
Add-ChecklistBullet 'Valida presencia, no valores secretos. El objetivo es detectar misconfiguracion real del host.'
Add-ChecklistCommandBlock @(
    'php -r ''foreach (["PIELARMONIA_DATA_ENCRYPTION_KEY","PIELARMONIA_REQUIRE_DATA_ENCRYPTION","AURORADERM_DATA_ENCRYPTION_KEY","AURORADERM_REQUIRE_DATA_ENCRYPTION","AURORADERM_OPERATOR_AUTH_MODE","AURORADERM_ADMIN_2FA_SECRET"] as $k) { $v = getenv($k); echo $k, "=", (($v === false || $v === "") ? "missing" : "set"), PHP_EOL; }''',
    "curl -s $DiagnosticsUrl | jq '{publicSync: .checks.publicSync, storage: .checks.storage, auth: .checks.auth}'"
)

Add-ChecklistSection 'Interpretacion rapida'
Add-ChecklistBullet 'wrapper_diff + telemetryGap=true: el host probablemente sigue ejecutando un wrapper stale o un entrypoint legacy.'
Add-ChecklistBullet 'jobs verify con rutas `C:\dev\pielarmonia-clean-main` / `C:\ProgramData\Pielarmonia\hosting\...`: el target primario actual es windows_selfhosted; no arranques por la receta Linux legacy.'
Add-ChecklistBullet 'si `__hosting/runtime` ya sirve `current_commit=desired_commit` pero `health` sigue viejo, el host probablemente sigue leyendo `public-sync-status.json` o un status stale en vez de `main-sync-status.json`.'
Add-ChecklistBullet 'health publico sin checks.publicSync o sin jobId: desplegar controllers/HealthController.php actualizado antes de tratar el caso como drift del repo o cron roto.'
Add-ChecklistBullet 'failureReason=working_tree_dirty + dirtyPathsCount>0 + telemetryGap=false: el cron tiene suficiente telemetria; limpia drift tracked en el VPS antes de culpar al workflow.'
Add-ChecklistBullet 'si dirtyPathsSample solo muestra `.generated/site-root/**` o `_deploy_bundle/**` despues de una corrida forzada, el wrapper del host probablemente sigue desalineado con la politica canonica de higiene.'
Add-ChecklistBullet 'currentHead != remoteHead: hay head drift real; no es solo working tree dirty.'
Add-ChecklistBullet 'encryptionStatus=plaintext o encryptionCompliant=false: falta configurar o aplicar PIELARMONIA_DATA_ENCRYPTION_KEY / PIELARMONIA_REQUIRE_DATA_ENCRYPTION en el host (AURORADERM_* sigue disponible como alias).'
Add-ChecklistBullet 'mode=legacy_password + twoFactorEnabled=false: auth sigue por debajo del baseline recomendado aunque el runtime este operativo.'
Add-ChecklistLine

Add-ChecklistSection 'Criterio de cierre'
Add-ChecklistBullet 'checks.publicSync.healthy=true'
Add-ChecklistBullet 'health publico expone checks.publicSync.jobId=8d31e299-7e57-4959-80b5-aaa2d73e9674'
Add-ChecklistBullet 'checks.publicSync.telemetryGap=false'
Add-ChecklistBullet 'checks.publicSync.currentHead y checks.publicSync.remoteHead presentes y alineados'
Add-ChecklistBullet 'checks.publicSync.dirtyPathsCount=0'
Add-ChecklistBullet 'checks.storage.encryptionCompliant=true'
Add-ChecklistBullet 'checks.storage.encryptionStatus != plaintext'
Add-ChecklistBullet 'checks.auth.configured=true'
Add-ChecklistLine

$output = $lines -join [Environment]::NewLine

if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
    $outputDir = Split-Path -Parent $OutputPath
    if (-not [string]::IsNullOrWhiteSpace($outputDir) -and -not (Test-Path -LiteralPath $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    }
    Set-Content -Path $OutputPath -Value $output -Encoding UTF8
    Write-Host "Checklist escrito en: $OutputPath"
}

Write-Output $output
