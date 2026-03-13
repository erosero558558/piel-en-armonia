param(
    [string]$Domain = 'https://pielarmonia.com',
    [ValidateSet('internal', 'canary', 'general', 'rollback')]
    [string]$Stage = 'general',
    [switch]$SkipRuntimeSmoke,
    [switch]$AllowFeatureApiFailure,
    [switch]$AllowMissingAdminFlag,
    [string]$ReportPath = 'verification/last-admin-ui-rollout-gate.json'
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')
$failures = 0
$timestampUtc = (Get-Date).ToUniversalTime().ToString('o')
$allowFeatureApiFailureEffective = [bool]$AllowFeatureApiFailure -or $Stage -eq 'internal'
$allowMissingAdminFlagEffective = [bool]$AllowMissingAdminFlag -or $Stage -eq 'internal'

$report = [ordered]@{
    ok = $false
    timestamp_utc = $timestampUtc
    domain = $base
    stage = $Stage
    options = [ordered]@{
        skip_runtime_smoke = [bool]$SkipRuntimeSmoke
        allow_feature_api_failure = [bool]$AllowFeatureApiFailure
        allow_missing_admin_flag = [bool]$AllowMissingAdminFlag
        allow_feature_api_failure_effective = [bool]$allowFeatureApiFailureEffective
        allow_missing_admin_flag_effective = [bool]$allowMissingAdminFlagEffective
    }
    features = [ordered]@{
        url = "$base/api.php?resource=features"
        request_ok = $false
        http_status = 0
        response_ok = $false
        has_admin_sony_ui = $false
        admin_sony_ui = $null
        has_admin_sony_ui_v3 = $false
        admin_sony_ui_v3 = $null
        expected_admin_sony_ui = $null
        expected_admin_sony_ui_v3 = $null
        stage_expectation_match_admin_sony_ui = $null
        stage_expectation_match_admin_sony_ui_v3 = $null
        warning = $null
        error = $null
    }
    page = [ordered]@{
        url = "$base/admin.html"
        ok = $false
        http_status = 0
    }
    url_checks = @()
    assets = [ordered]@{
        has_admin_v3_css = $false
        uses_canonical_runtime = $false
        references_runtime_bridge = $false
        references_legacy_styles = $false
    }
    csp = [ordered]@{
        checked = $false
        meta_present = $false
        self_only_script = $false
        self_only_style = $false
        self_only_font = $false
    }
    runtime_smoke = [ordered]@{
        executed = $false
        ok = $null
        base_url = ''
        suites = @()
    }
    failures = 0
}

function Invoke-JsonGet {
    param(
        [string]$Url
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
            'Accept' = 'application/json'
            'User-Agent' = 'AdminUiRolloutGate/2.0'
        }

        $payload = $null
        try {
            $payload = $response.Content | ConvertFrom-Json -Depth 20
        } catch {
            $payload = $null
        }

        return [PSCustomObject]@{
            Ok = $true
            Status = [int]$response.StatusCode
            Json = $payload
            Raw = [string]$response.Content
            Error = ''
        }
    } catch {
        $status = 0
        $raw = ''
        $response = $_.Exception.Response
        if ($null -ne $response) {
            try { $status = [int]$response.StatusCode } catch { $status = 0 }
            try {
                $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
                $raw = $reader.ReadToEnd()
                $reader.Close()
            } catch {}
        }

        return [PSCustomObject]@{
            Ok = $false
            Status = $status
            Json = $null
            Raw = $raw
            Error = $_.Exception.Message
        }
    }
}

function Invoke-HttpCheck {
    param(
        [string]$Name,
        [string]$Url
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
            'Accept' = 'text/html,application/json;q=0.9,*/*;q=0.8'
            'User-Agent' = 'AdminUiRolloutGate/2.0'
        }

        return [PSCustomObject]@{
            Name = $Name
            Ok = $true
            Status = [int]$response.StatusCode
            Headers = $response.Headers
            Body = [string]$response.Content
            Error = ''
        }
    } catch {
        $status = 0
        $raw = ''
        $response = $_.Exception.Response
        if ($null -ne $response) {
            try { $status = [int]$response.StatusCode } catch { $status = 0 }
            try {
                $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
                $raw = $reader.ReadToEnd()
                $reader.Close()
            } catch {}
        }

        return [PSCustomObject]@{
            Name = $Name
            Ok = $false
            Status = $status
            Headers = @{}
            Body = $raw
            Error = $_.Exception.Message
        }
    }
}

function Get-ExpectedFeatureFlagsByStage {
    param(
        [string]$CurrentStage
    )

    switch ($CurrentStage) {
        'canary' {
            return [PSCustomObject]@{
                admin_sony_ui = $true
                admin_sony_ui_v3 = $true
            }
        }
        'general' {
            return [PSCustomObject]@{
                admin_sony_ui = $true
                admin_sony_ui_v3 = $true
            }
        }
        'rollback' {
            return [PSCustomObject]@{
                admin_sony_ui = $false
                admin_sony_ui_v3 = $false
            }
        }
        default {
            return [PSCustomObject]@{
                admin_sony_ui = $null
                admin_sony_ui_v3 = $null
            }
        }
    }
}

function Invoke-PlaywrightSmokeSuite {
    param(
        [string]$Name,
        [string[]]$Specs,
        [string]$BaseUrl
    )

    $specList = @($Specs | Where-Object {
        -not [string]::IsNullOrWhiteSpace([string]$_)
    })

    if ($specList.Count -eq 0) {
        return [PSCustomObject]@{
            name = $Name
            ok = $true
            exit_code = 0
            specs = @()
        }
    }

    Write-Host "[SMOKE] $Name -> $($specList -join ', ') @ $BaseUrl"

    $args = @('playwright', 'test') + $specList + @('--workers=1')
    $hadBaseUrl = Test-Path Env:TEST_BASE_URL
    $previousBaseUrl = $env:TEST_BASE_URL
    $hadReuseExistingServer = Test-Path Env:TEST_REUSE_EXISTING_SERVER
    $previousReuseExistingServer = $env:TEST_REUSE_EXISTING_SERVER

    try {
        $env:TEST_BASE_URL = $BaseUrl
        $env:TEST_REUSE_EXISTING_SERVER = '0'
        & npx @args
        $exitCode = $LASTEXITCODE
    } finally {
        if ($hadBaseUrl) {
            $env:TEST_BASE_URL = $previousBaseUrl
        } else {
            Remove-Item Env:TEST_BASE_URL -ErrorAction SilentlyContinue
        }

        if ($hadReuseExistingServer) {
            $env:TEST_REUSE_EXISTING_SERVER = $previousReuseExistingServer
        } else {
            Remove-Item Env:TEST_REUSE_EXISTING_SERVER -ErrorAction SilentlyContinue
        }
    }
    $ok = ($exitCode -eq 0)

    if ($ok) {
        Write-Host "[OK]  $Name en verde."
    } else {
        Write-Host "[FAIL] $Name fallo."
    }

    return [PSCustomObject]@{
        name = $Name
        ok = $ok
        exit_code = $exitCode
        specs = $specList
    }
}

Write-Host "== Gate Admin UI Rollout =="
Write-Host "Dominio: $base"
Write-Host "Stage: $Stage"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$featuresUrl = "$base/api.php?resource=features"
$featuresResult = Invoke-JsonGet -Url $featuresUrl
$featureValueV2 = $null
$featureValueV3 = $null

if ($featuresResult.Ok -and $null -ne $featuresResult.Json -and $featuresResult.Json.ok -eq $true) {
    $report.features.request_ok = $true
    $report.features.http_status = [int]$featuresResult.Status
    $report.features.response_ok = $true
    Write-Host "[OK]  Features API -> HTTP $($featuresResult.Status)"

    if ($null -eq $featuresResult.Json.data) {
        if ($allowMissingAdminFlagEffective) {
            Write-Host "[WARN] Features API no contiene bloque data de flags admin (permitido por politica efectiva de stage/flag)."
            $report.features.warning = 'missing_admin_flag_block_allowed'
        } else {
            Write-Host "[FAIL] Features API no contiene bloque data de flags admin"
            $failures += 1
            $report.features.error = 'missing_admin_flag_block'
        }
    } else {
        if ($null -eq $featuresResult.Json.data.admin_sony_ui) {
            if ($allowMissingAdminFlagEffective) {
                Write-Host "[WARN] Features API no contiene data.admin_sony_ui (permitido por politica efectiva de stage/flag)."
                $report.features.warning = 'missing_admin_sony_ui_allowed'
            } else {
                Write-Host "[FAIL] Features API no contiene data.admin_sony_ui"
                $failures += 1
                $report.features.error = 'missing_admin_sony_ui'
            }
        } else {
            $featureValueV2 = [bool]$featuresResult.Json.data.admin_sony_ui
            $report.features.has_admin_sony_ui = $true
            $report.features.admin_sony_ui = [bool]$featureValueV2
            $featureTextV2 = if ($featureValueV2) { 'true' } else { 'false' }
            Write-Host "[INFO] admin_sony_ui actual: $featureTextV2"
        }

        if ($null -eq $featuresResult.Json.data.admin_sony_ui_v3) {
            if ($allowMissingAdminFlagEffective) {
                Write-Host "[WARN] Features API no contiene data.admin_sony_ui_v3 (permitido por politica efectiva de stage/flag)."
                if ($null -eq $report.features.warning) {
                    $report.features.warning = 'missing_admin_sony_ui_v3_allowed'
                }
            } else {
                Write-Host "[FAIL] Features API no contiene data.admin_sony_ui_v3"
                $failures += 1
                if ($null -eq $report.features.error) {
                    $report.features.error = 'missing_admin_sony_ui_v3'
                }
            }
        } else {
            $featureValueV3 = [bool]$featuresResult.Json.data.admin_sony_ui_v3
            $report.features.has_admin_sony_ui_v3 = $true
            $report.features.admin_sony_ui_v3 = [bool]$featureValueV3
            $featureTextV3 = if ($featureValueV3) { 'true' } else { 'false' }
            Write-Host "[INFO] admin_sony_ui_v3 actual: $featureTextV3"
        }
    }
} else {
    $report.features.request_ok = [bool]$featuresResult.Ok
    $report.features.http_status = [int]$featuresResult.Status
    if ($allowFeatureApiFailureEffective) {
        Write-Host "[WARN] Features API no disponible (HTTP $($featuresResult.Status)); se continua por politica efectiva de stage/flag."
        $report.features.warning = 'features_api_failure_allowed'
    } else {
        Write-Host "[FAIL] Features API no disponible (HTTP $($featuresResult.Status))"
        if ($featuresResult.Error) {
            Write-Host "       $($featuresResult.Error)"
        }
        $failures += 1
        $report.features.error = 'features_api_failure'
    }
}

$expectedFeatures = Get-ExpectedFeatureFlagsByStage -CurrentStage $Stage
$report.features.expected_admin_sony_ui = $expectedFeatures.admin_sony_ui
$report.features.expected_admin_sony_ui_v3 = $expectedFeatures.admin_sony_ui_v3

if ($null -ne $expectedFeatures.admin_sony_ui -and $null -ne $featureValueV2) {
    if ([bool]$featureValueV2 -ne [bool]$expectedFeatures.admin_sony_ui) {
        $expectedText = if ($expectedFeatures.admin_sony_ui) { 'true' } else { 'false' }
        $actualText = if ($featureValueV2) { 'true' } else { 'false' }
        Write-Host "[FAIL] Stage '$Stage' requiere admin_sony_ui=$expectedText, actual=$actualText"
        $failures += 1
        $report.features.stage_expectation_match_admin_sony_ui = $false
    } else {
        Write-Host "[OK]  Stage '$Stage' coincide con admin_sony_ui esperado"
        $report.features.stage_expectation_match_admin_sony_ui = $true
    }
} elseif ($Stage -eq 'internal') {
    Write-Host "[INFO] Stage internal: no se fuerza valor de admin_sony_ui"
    $report.features.stage_expectation_match_admin_sony_ui = $null
}

if ($null -ne $expectedFeatures.admin_sony_ui_v3 -and $null -ne $featureValueV3) {
    if ([bool]$featureValueV3 -ne [bool]$expectedFeatures.admin_sony_ui_v3) {
        $expectedText = if ($expectedFeatures.admin_sony_ui_v3) { 'true' } else { 'false' }
        $actualText = if ($featureValueV3) { 'true' } else { 'false' }
        Write-Host "[FAIL] Stage '$Stage' requiere admin_sony_ui_v3=$expectedText, actual=$actualText"
        $failures += 1
        $report.features.stage_expectation_match_admin_sony_ui_v3 = $false
    } else {
        Write-Host "[OK]  Stage '$Stage' coincide con admin_sony_ui_v3 esperado"
        $report.features.stage_expectation_match_admin_sony_ui_v3 = $true
    }
} elseif ($Stage -eq 'internal') {
    Write-Host "[INFO] Stage internal: no se fuerza valor de admin_sony_ui_v3"
    $report.features.stage_expectation_match_admin_sony_ui_v3 = $null
}

$pageResult = Invoke-HttpCheck -Name 'Admin base' -Url $report.page.url
$report.page.ok = [bool]$pageResult.Ok
$report.page.http_status = [int]$pageResult.Status
$report.url_checks += [ordered]@{
    name = 'Admin base'
    url = $report.page.url
    ok = [bool]$pageResult.Ok
    http_status = [int]$pageResult.Status
}

if (-not $pageResult.Ok) {
    Write-Host "[FAIL] admin.html -> HTTP $($pageResult.Status)"
    $failures += 1
} else {
    Write-Host "[OK]  admin.html -> HTTP $($pageResult.Status)"
}

$rawHtml = [string]$pageResult.Body
$report.assets.has_admin_v3_css = $rawHtml.Contains('admin-v3.css')
$report.assets.uses_canonical_runtime = $rawHtml.Contains('src="admin.js')
$report.assets.references_runtime_bridge = $rawHtml.Contains('js/admin-runtime.js')
$report.assets.references_legacy_styles = (
    $rawHtml.Contains('styles.min.css') -or
    $rawHtml.Contains('admin.min.css') -or
    $rawHtml.Contains('admin.css') -or
    $rawHtml.Contains('admin-v2.css')
)

if ($report.assets.has_admin_v3_css) {
    Write-Host "[OK]  shell referencia admin-v3.css"
} else {
    Write-Host "[FAIL] shell no referencia admin-v3.css"
    $failures += 1
}

if ($report.assets.uses_canonical_runtime) {
    Write-Host "[OK]  shell referencia admin.js canonico"
} else {
    Write-Host "[FAIL] shell no referencia admin.js canonico"
    $failures += 1
}

if (-not $report.assets.references_runtime_bridge) {
    Write-Host "[OK]  shell no referencia runtime bridge heredado"
} else {
    Write-Host "[FAIL] shell mantiene referencia a js/admin-runtime.js"
    $failures += 1
}

if (-not $report.assets.references_legacy_styles) {
    Write-Host "[OK]  shell sin referencias CSS legacy"
} else {
    Write-Host "[FAIL] shell mantiene referencias CSS legacy"
    $failures += 1
}

$report.csp.checked = $true
$report.csp.meta_present = $rawHtml.Contains('Content-Security-Policy')
$report.csp.self_only_script = $rawHtml.Contains("script-src 'self'")
$report.csp.self_only_style = $rawHtml.Contains("style-src 'self'")
$report.csp.self_only_font = $rawHtml.Contains("font-src 'self'")

if ($report.csp.meta_present -and $report.csp.self_only_script -and $report.csp.self_only_style -and $report.csp.self_only_font) {
    Write-Host "[OK]  CSP admin endurecida"
} else {
    Write-Host "[FAIL] CSP admin incompleta"
    $failures += 1
}

$extraUrlChecks = @(
    @{ Name = 'Admin query legacy'; Url = "$base/admin.html?admin_ui=legacy" },
    @{ Name = 'Admin query sony_v2'; Url = "$base/admin.html?admin_ui=sony_v2" },
    @{ Name = 'Admin query sony_v3'; Url = "$base/admin.html?admin_ui=sony_v3" },
    @{ Name = 'Admin contingency reset'; Url = "$base/admin.html?admin_ui_reset=1" }
)

foreach ($check in $extraUrlChecks) {
    $result = Invoke-HttpCheck -Name $check.Name -Url $check.Url
    $report.url_checks += [ordered]@{
        name = [string]$check.Name
        url = [string]$check.Url
        ok = [bool]$result.Ok
        http_status = [int]$result.Status
    }

    if (-not $result.Ok) {
        $failures += 1
    }
}

if (-not $SkipRuntimeSmoke) {
    $report.runtime_smoke.executed = $true
    $report.runtime_smoke.base_url = $base

    $runtimeSuites = @(
        @{
            Name = 'admin-ui-runtime'
            Specs = @('tests/admin-ui-runtime-smoke.spec.js')
        }
    )

    if (
        $Stage -eq 'canary' -or
        $Stage -eq 'general' -or
        ($Stage -eq 'internal' -and $featureValueV3 -eq $true)
    ) {
        $runtimeSuites += @{
            Name = 'admin-v3-runtime'
            Specs = @('tests/admin-v3-canary-runtime.spec.js')
        }
    }

    $runtimeOk = $true
    foreach ($suite in $runtimeSuites) {
        $suiteResult = Invoke-PlaywrightSmokeSuite -Name $suite.Name -Specs $suite.Specs -BaseUrl $base
        $report.runtime_smoke.suites += [ordered]@{
            name = $suiteResult.name
            ok = [bool]$suiteResult.ok
            exit_code = [int]$suiteResult.exit_code
            specs = @($suiteResult.specs)
        }

        if (-not $suiteResult.ok) {
            $runtimeOk = $false
            $failures += 1
        }
    }

    $report.runtime_smoke.ok = [bool]$runtimeOk
} else {
    Write-Host "[INFO] Runtime smoke omitido por flag."
}

$report.failures = [int]$failures
$report.ok = ($failures -eq 0)

try {
    $directory = Split-Path -Parent $ReportPath
    if ($directory) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
    $report | ConvertTo-Json -Depth 12 | Set-Content -Path $ReportPath -Encoding UTF8
    Write-Host "[INFO] Reporte escrito en $ReportPath"
} catch {
    Write-Host "[WARN] No se pudo escribir reporte: $($_.Exception.Message)"
}

if ($report.ok) {
    Write-Host "[OK]  Gate admin rollout en verde."
    exit 0
}

Write-Host "[FAIL] Gate admin rollout fallo con $failures incidencia(s)."
exit 1
