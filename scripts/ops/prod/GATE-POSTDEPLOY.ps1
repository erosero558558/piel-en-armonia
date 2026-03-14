param(
    [string]$Domain = 'https://pielarmonia.com',
    [int]$BenchRuns = 25,
    [int]$CoreP95MaxMs = 800,
    [int]$FigoPostP95MaxMs = 2500,
    [switch]$AllowDegradedFigo,
    [switch]$AllowRecursiveFigo,
    [switch]$AllowMetaCspFallback,
    [switch]$RequireWebhookSecret,
    [switch]$RequireBackupHealthy,
    [switch]$RequireBackupReceiverReady,
    [switch]$RequireCronReady,
    [switch]$RequireTelemedicineReady,
    [switch]$RequireTurneroWebSurfaces,
    [switch]$RequireTurneroOperatorPilot,
    [switch]$RequireStableDataDir,
    [switch]$SkipAssetHashChecks,
    [string]$AssetHashWarningUntil = '2026-03-08T23:59:59-05:00',
    [switch]$ForceAssetHashChecks,
    [switch]$SkipFigoPostBench,
    [switch]$SkipBenchmark,
    [int]$AssetHashRetryCount = 2,
    [int]$AssetHashRetryDelaySec = 4,
    [int]$VerifyRetryAttempts = 1,
    [int]$VerifyRetryDelaySec = 75
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$verifyScriptPath = Join-Path $PSScriptRoot 'VERIFICAR-DESPLIEGUE.ps1'
$smokeScriptPath = Join-Path $PSScriptRoot 'SMOKE-PRODUCCION.ps1'
$benchScriptPath = Join-Path $PSScriptRoot 'BENCH-API-PRODUCCION.ps1'
$turneroClinicProfileScriptPath = Join-Path $repoRoot 'bin/turnero-clinic-profile.js'

Write-Host "== Gate Post-Deploy ==" -ForegroundColor Cyan
Write-Host "Dominio: $Domain"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$effectiveSkipAssetHashChecks = [bool]$SkipAssetHashChecks
if (-not $ForceAssetHashChecks -and -not $effectiveSkipAssetHashChecks -and -not [string]::IsNullOrWhiteSpace($AssetHashWarningUntil)) {
    try {
        $deadline = [DateTimeOffset]::Parse($AssetHashWarningUntil)
        if ([DateTimeOffset]::UtcNow -le $deadline.ToUniversalTime()) {
            $effectiveSkipAssetHashChecks = $true
            Write-Host "[WARN] Hash checks en modo warning temporal hasta $($deadline.ToString('yyyy-MM-dd HH:mm:ss zzz'))."
        }
    } catch {
        Write-Host "[WARN] No se pudo interpretar AssetHashWarningUntil='$AssetHashWarningUntil'. Se usa comportamiento por defecto."
    }
}
if ($ForceAssetHashChecks) {
    $effectiveSkipAssetHashChecks = $false
}
if ($effectiveSkipAssetHashChecks) {
    Write-Host "[INFO] Validacion de hash de assets: modo no bloqueante."
}

$failures = 0
$turneroPilotReleaseGateRequired = $false
$turneroPilotClinicId = ''
$turneroPilotCatalogMatch = $false
$turneroPilotProfileStatusResolved = $false
$turneroPilotRecoveryTargets = @()
$turneroPilotRecoveryTargetsLabel = 'none'

if (Test-Path $turneroClinicProfileScriptPath) {
    $turneroPilotStatusRaw = ''
    $turneroPilotStatusExit = 0
    $turneroPilotStatus = $null

    try {
        $turneroPilotStatusRaw = ((& node $turneroClinicProfileScriptPath status --json 2>&1) | Out-String).Trim()
        $turneroPilotStatusExit = $LASTEXITCODE
        if (-not [string]::IsNullOrWhiteSpace($turneroPilotStatusRaw)) {
            $turneroPilotStatus = $turneroPilotStatusRaw | ConvertFrom-Json
        }
    } catch {
        $turneroPilotStatus = $null
    }

    if ($null -eq $turneroPilotStatus -or $turneroPilotStatusExit -ne 0) {
        Write-Host '[FAIL] turneroPilot clinic-profile status unresolved antes del gate.' -ForegroundColor Red
        $failures += 1
    } else {
        $turneroPilotProfileStatusResolved = [bool]$turneroPilotStatus.ok
        try { $turneroPilotClinicId = [string]$turneroPilotStatus.profile.clinic_id } catch { $turneroPilotClinicId = '' }
        try { $turneroPilotCatalogMatch = [bool]$turneroPilotStatus.matchesCatalog } catch { $turneroPilotCatalogMatch = $false }
        try { $turneroPilotReleaseGateRequired = ([bool]$turneroPilotStatus.ok) -and ([string]$turneroPilotStatus.profile.release.mode -eq 'web_pilot') } catch { $turneroPilotReleaseGateRequired = $false }
        if ($turneroPilotReleaseGateRequired) {
            $turneroPilotRecoveryTargets = @(
                '[ALERTA PROD] Deploy Hosting turneroPilot bloqueado',
                '[ALERTA PROD] Deploy Frontend Self-Hosted turneroPilot bloqueado'
            )
            $turneroPilotRecoveryTargetsLabel = ($turneroPilotRecoveryTargets -join '|')
        }

        Write-Host "[INFO] turneroPilot gate clinicId=$turneroPilotClinicId statusResolved=$turneroPilotProfileStatusResolved catalogMatch=$turneroPilotCatalogMatch verifyRemoteEnforced=$turneroPilotReleaseGateRequired recoveryTargets=$turneroPilotRecoveryTargetsLabel"

        if (-not $turneroPilotProfileStatusResolved) {
            Write-Host '[FAIL] turneroPilot clinic-profile inválido antes del gate.' -ForegroundColor Red
            $failures += 1
        }
        if ($turneroPilotProfileStatusResolved -and -not $turneroPilotCatalogMatch) {
            Write-Host "[FAIL] turneroPilot catalog drift antes del gate (clinicId=$turneroPilotClinicId)." -ForegroundColor Red
            $failures += 1
        }
    }
} else {
    Write-Host '[WARN] bin/turnero-clinic-profile.js no existe; se omite preflight turneroPilot del gate.'
}

Write-Host ""
Write-Host "[1/3] Verificacion de despliegue..." -ForegroundColor Yellow
$verifyAttempts = 0
$verifyMaxAttempts = [Math]::Max(1, $VerifyRetryAttempts + 1)
$verifyPassed = $false

while ($verifyAttempts -lt $verifyMaxAttempts) {
    & $verifyScriptPath `
        -Domain $Domain `
        -AllowDegradedFigo:$AllowDegradedFigo `
        -AllowRecursiveFigo:$AllowRecursiveFigo `
        -AllowMetaCspFallback:$AllowMetaCspFallback `
        -RequireWebhookSecret:$RequireWebhookSecret `
        -RequireBackupHealthy:$RequireBackupHealthy `
        -RequireCronReady:$RequireCronReady `
        -RequireTelemedicineReady:$RequireTelemedicineReady `
        -RequireTurneroWebSurfaces:$RequireTurneroWebSurfaces `
        -RequireTurneroOperatorPilot:$RequireTurneroOperatorPilot `
        -RequireStableDataDir:$RequireStableDataDir `
        -SkipAssetHashChecks:$effectiveSkipAssetHashChecks `
        -ForceAssetHashChecks:$ForceAssetHashChecks `
        -AssetHashRetryCount $AssetHashRetryCount `
        -AssetHashRetryDelaySec $AssetHashRetryDelaySec

    if ($LASTEXITCODE -eq 0) {
        $verifyPassed = $true
        break
    }

    $verifyAttempts += 1
    if ($verifyAttempts -lt $verifyMaxAttempts) {
        Write-Host "[WARN] Verificacion fallida. Reintento $verifyAttempts/$($verifyMaxAttempts - 1) en $VerifyRetryDelaySec s..." -ForegroundColor Yellow
        Start-Sleep -Seconds ([Math]::Max(1, $VerifyRetryDelaySec))
    }
}

if (-not $verifyPassed) {
    $failures += 1
}

Write-Host ""
Write-Host "[2/3] Smoke de produccion..." -ForegroundColor Yellow
& $smokeScriptPath `
    -Domain $Domain `
    -TestFigoPost `
    -AllowFigoRateLimit `
    -AllowDegradedFigo:$AllowDegradedFigo `
    -AllowRecursiveFigo:$AllowRecursiveFigo `
    -AllowMetaCspFallback:$AllowMetaCspFallback `
    -RequireWebhookSecret:$RequireWebhookSecret `
    -RequireBackupReceiverReady:$RequireBackupReceiverReady `
    -RequireCronReady:$RequireCronReady `
    -RequireTelemedicineReady:$RequireTelemedicineReady `
    -RequireTurneroWebSurfaces:$RequireTurneroWebSurfaces `
    -RequireTurneroOperatorPilot:$RequireTurneroOperatorPilot
if ($LASTEXITCODE -ne 0) {
    $failures += 1
}

Write-Host ""
if ($SkipBenchmark) {
    Write-Host "[3/3] Benchmark API..." -ForegroundColor Yellow
    Write-Host "[WARN] Benchmark completo omitido (modo fast lane)."
} else {
    Write-Host "[3/3] Benchmark API..." -ForegroundColor Yellow
    if ($SkipFigoPostBench) {
        Write-Host "[WARN] Benchmark figo-post omitido para este gate."
        & $benchScriptPath `
            -Domain $Domain `
            -Runs $BenchRuns `
            -CoreP95MaxMs $CoreP95MaxMs `
            -FigoPostP95MaxMs $FigoPostP95MaxMs
    } else {
        & $benchScriptPath `
            -Domain $Domain `
            -Runs $BenchRuns `
            -CoreP95MaxMs $CoreP95MaxMs `
            -FigoPostP95MaxMs $FigoPostP95MaxMs `
            -IncludeFigoPost
    }
    if ($LASTEXITCODE -ne 0) {
        $failures += 1
    }
}

Write-Host ""
if ($failures -gt 0) {
    Write-Host "Gate FALLIDO: $failures bloque(s) con errores." -ForegroundColor Red
    exit 1
}

if ($turneroPilotReleaseGateRequired) {
    Write-Host "Turnero pilot gate OK: clinicId=$turneroPilotClinicId, catalogMatch=$turneroPilotCatalogMatch, verifyRemoteEnforced=true, recoveryTargets=$turneroPilotRecoveryTargetsLabel." -ForegroundColor Green
}

Write-Host "Gate OK: despliegue validado." -ForegroundColor Green
exit 0
