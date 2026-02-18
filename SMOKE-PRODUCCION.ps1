param(
    [string]$Domain = 'https://pielarmonia.com',
    [switch]$TestFigoPost,
    [switch]$AllowDegradedFigo,
    [switch]$AllowRecursiveFigo,
    [switch]$RequireWebhookSecret,
    [int]$MaxHealthTimingMs = 2000
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')
$tmpFile = Join-Path $env:TEMP 'pielarmonia-smoke-body.tmp'

function Get-RefFromIndex {
    param(
        [string]$IndexHtml,
        [string]$Pattern
    )

    $match = [regex]::Match($IndexHtml, $Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if (-not $match.Success) {
        return ''
    }
    return $match.Groups[1].Value
}

function Get-Url {
    param(
        [string]$Base,
        [string]$Ref
    )

    if ([string]::IsNullOrWhiteSpace($Ref)) {
        return ''
    }
    if ($Ref.StartsWith('http://') -or $Ref.StartsWith('https://')) {
        return $Ref
    }
    if ($Ref.StartsWith('/')) {
        return "$Base$Ref"
    }
    return "$Base/$Ref"
}

$indexLocalRaw = if (Test-Path 'index.html') { Get-Content -Path 'index.html' -Raw } else { '' }
$localScriptRef = Get-RefFromIndex -IndexHtml $indexLocalRaw -Pattern '<script\s+src="([^"]*script\.js[^"]*)"'
$localStyleRef = Get-RefFromIndex -IndexHtml $indexLocalRaw -Pattern '<link\s+rel="stylesheet"\s+href="([^"]*styles\.css[^"]*)"'
$appScriptAssetUrl = if ($localScriptRef -ne '') { Get-Url -Base $base -Ref $localScriptRef } else { "$base/script.js" }
$criticalCssAssetUrl = if ($localStyleRef -ne '') { Get-Url -Base $base -Ref $localStyleRef } else { "$base/styles.css" }

$chatEngineVersion = ''
if (Test-Path 'script.js') {
    $scriptLocalRaw = Get-Content -Path 'script.js' -Raw
    $chatEngineMatch = [regex]::Match($scriptLocalRaw, "chat-engine\.js\?v=([a-zA-Z0-9._-]+)")
    if ($chatEngineMatch.Success) {
        $chatEngineVersion = $chatEngineMatch.Groups[1].Value
    }
}
$chatEngineAssetUrl = if ($chatEngineVersion -ne '') {
    "$base/chat-engine.js?v=$chatEngineVersion"
} else {
    "$base/chat-engine.js"
}

$deferredStylesVersion = ''
if (Test-Path 'script.js') {
    $deferredStylesMatch = [regex]::Match($scriptLocalRaw, "styles-deferred\.css\?v=([a-zA-Z0-9._-]+)")
    if ($deferredStylesMatch.Success) {
        $deferredStylesVersion = $deferredStylesMatch.Groups[1].Value
    }
}
$deferredStylesAssetUrl = if ($deferredStylesVersion -ne '') {
    "$base/styles-deferred.css?v=$deferredStylesVersion"
} else {
    "$base/styles-deferred.css"
}

$translationsEnVersion = ''
if (Test-Path 'script.js') {
    $translationsEnMatch = [regex]::Match($scriptLocalRaw, "translations-en\.js\?v=([a-zA-Z0-9._-]+)")
    if ($translationsEnMatch.Success) {
        $translationsEnVersion = $translationsEnMatch.Groups[1].Value
    }
}
$translationsEnAssetUrl = if ($translationsEnVersion -ne '') {
    "$base/translations-en.js?v=$translationsEnVersion"
} else {
    "$base/translations-en.js"
}

$bookingEngineVersion = ''
if (Test-Path 'script.js') {
    $bookingEngineMatch = [regex]::Match($scriptLocalRaw, "booking-engine\.js\?v=([a-zA-Z0-9._-]+)")
    if ($bookingEngineMatch.Success) {
        $bookingEngineVersion = $bookingEngineMatch.Groups[1].Value
    }
}
$bookingEngineAssetUrl = if ($bookingEngineVersion -ne '') {
    "$base/booking-engine.js?v=$bookingEngineVersion"
} else {
    "$base/booking-engine.js"
}

function Invoke-Check {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = 'GET',
        [object]$Body = $null
    )

    if (Test-Path $tmpFile) {
        Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
    }

    $args = @(
        '-sS',
        '--max-time', '20',
        '--connect-timeout', '8',
        '-o', $tmpFile,
        '-w', '%{http_code}',
        '-A', 'PielArmoniaSmoke/1.0',
        '-L'
    )

    if ($Method -eq 'POST') {
        $jsonBody = if ($null -eq $Body) { '{}' } else { $Body | ConvertTo-Json -Depth 8 -Compress }
        $args += @('-X', 'POST', '-H', 'Content-Type: application/json', '--data', $jsonBody)
    }

    $args += $Url

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $rawStatus = ''
    $curlError = ''
    try {
        $rawStatus = (& curl.exe @args 2>&1 | Out-String).Trim()
    } catch {
        $curlError = $_.Exception.Message
    }
    $sw.Stop()

    $status = 0
    if ($rawStatus -match '^\d{3}$') {
        $status = [int]$rawStatus
    }

    $bodyText = ''
    if (Test-Path $tmpFile) {
        $bodyText = Get-Content $tmpFile -Raw
        Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
    }

    if ($LASTEXITCODE -eq 0 -and $status -ge 200 -and $status -lt 500) {
        Write-Host "[OK]  $Name -> HTTP $status ($([int]$sw.ElapsedMilliseconds) ms)"
        return [PSCustomObject]@{
            Name = $Name
            Ok = $true
            Status = $status
            Body = $bodyText
        }
    }

    Write-Host "[FAIL] $Name -> HTTP $status ($([int]$sw.ElapsedMilliseconds) ms)"
    if ($curlError) {
        Write-Host "       $curlError"
    } elseif ($rawStatus -and $rawStatus -notmatch '^\d{3}$') {
        Write-Host "       $rawStatus"
    } elseif ($bodyText) {
        Write-Host "       $bodyText"
    } else {
        Write-Host "       Sin respuesta"
    }

    return [PSCustomObject]@{
        Name = $Name
        Ok = $false
        Status = $status
        Body = $bodyText
    }
}

function Invoke-JsonPostCheck {
    param(
        [string]$Name,
        [string]$Url,
        [object]$Body
    )

    $jsonBody = if ($null -eq $Body) { '{}' } else { $Body | ConvertTo-Json -Depth 8 -Compress }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $status = 0
    $bodyText = ''
    $ok = $false

    try {
        $resp = Invoke-WebRequest -Uri $Url -Method POST -ContentType 'application/json' -Body $jsonBody -TimeoutSec 20 -UseBasicParsing -Headers @{
            'Accept' = 'application/json'
            'User-Agent' = 'PielArmoniaSmoke/1.0'
        }
        $status = [int]$resp.StatusCode
        $bodyText = [string]$resp.Content
        $ok = $true
    } catch {
        $response = $_.Exception.Response
        if ($null -ne $response) {
            try { $status = [int]$response.StatusCode } catch { $status = 0 }
            try {
                $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
                $bodyText = $reader.ReadToEnd()
                $reader.Close()
            } catch {}
        }
        $ok = $false
    }
    $sw.Stop()

    if ($status -ge 200 -and $status -lt 500) {
        Write-Host "[OK]  $Name -> HTTP $status ($([int]$sw.ElapsedMilliseconds) ms)"
        return [PSCustomObject]@{
            Name = $Name
            Ok = $true
            Status = $status
            Body = $bodyText
        }
    }

    Write-Host "[FAIL] $Name -> HTTP $status ($([int]$sw.ElapsedMilliseconds) ms)"
    if ($bodyText) {
        Write-Host "       $bodyText"
    } else {
        Write-Host "       Sin respuesta"
    }

    return [PSCustomObject]@{
        Name = $Name
        Ok = $ok
        Status = $status
        Body = $bodyText
    }
}

Write-Host "== Smoke Produccion =="
Write-Host "Dominio: $base"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$results = @()
$results += Invoke-Check -Name 'Home' -Url "$base/"
$results += Invoke-Check -Name 'Health API' -Url "$base/api.php?resource=health"
$results += Invoke-Check -Name 'Reviews API' -Url "$base/api.php?resource=reviews"
$results += Invoke-Check -Name 'Availability API' -Url "$base/api.php?resource=availability"
$results += Invoke-Check -Name 'Admin auth status' -Url "$base/admin-auth.php?action=status"
$results += Invoke-Check -Name 'Figo chat GET' -Url "$base/figo-chat.php"
$results += Invoke-Check -Name 'Figo backend GET' -Url "$base/figo-backend.php"
$results += Invoke-Check -Name 'Chat engine asset' -Url $chatEngineAssetUrl
$results += Invoke-Check -Name 'Deferred styles asset' -Url $deferredStylesAssetUrl
$results += Invoke-Check -Name 'EN translations asset' -Url $translationsEnAssetUrl
$results += Invoke-Check -Name 'Booking engine asset' -Url $bookingEngineAssetUrl
$results += Invoke-Check -Name 'App script asset' -Url $appScriptAssetUrl
$results += Invoke-Check -Name 'Critical CSS asset' -Url $criticalCssAssetUrl

if ($TestFigoPost) {
    $figoPayload = @{
        model = 'figo-assistant'
        messages = @(
            @{
                role = 'user'
                content = 'hola'
            }
        )
        max_tokens = 120
        temperature = 0.4
    }
    $results += Invoke-JsonPostCheck -Name 'Figo chat POST' -Url "$base/figo-chat.php" -Body $figoPayload
}

$contractFailures = 0

$expectedStatusByName = @{
    'Home' = 200
    'Health API' = 200
    'Reviews API' = 200
    'Availability API' = 200
    'Admin auth status' = 200
    'Figo chat GET' = 200
    'Figo backend GET' = 200
    'Chat engine asset' = 200
    'Deferred styles asset' = 200
    'EN translations asset' = 200
    'Booking engine asset' = 200
    'App script asset' = 200
    'Critical CSS asset' = 200
}
if ($TestFigoPost) {
    $expectedStatusByName['Figo chat POST'] = 200
}

foreach ($result in $results) {
    $expected = $expectedStatusByName[$result.Name]
    if ($null -ne $expected -and [int]$result.Status -ne [int]$expected) {
        Write-Host "[FAIL] $($result.Name) devolvio HTTP $($result.Status), esperado HTTP $expected"
        $contractFailures += 1
    }
}

try {
    $homeHeaderResp = Invoke-WebRequest -Uri "$base/" -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
        'Accept' = 'text/html'
        'User-Agent' = 'PielArmoniaSmoke/1.0'
    }
    foreach ($headerName in @('Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy')) {
        if ($null -eq $homeHeaderResp.Headers[$headerName]) {
            Write-Host "[FAIL] Home sin header de seguridad: $headerName"
            $contractFailures += 1
        }
    }
} catch {
    Write-Host "[FAIL] No se pudieron validar headers de seguridad en Home"
    $contractFailures += 1
}

try {
    $assetHeaderChecks = @(
        @{ Name = 'App script asset'; Url = $appScriptAssetUrl },
        @{ Name = 'Critical CSS asset'; Url = $criticalCssAssetUrl }
    )
    foreach ($assetCheck in $assetHeaderChecks) {
        $assetResp = Invoke-WebRequest -Uri $assetCheck.Url -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
            'Cache-Control' = 'no-cache'
            'User-Agent' = 'PielArmoniaSmoke/1.0'
        }
        $cacheHeader = [string]$assetResp.Headers['Cache-Control']
        if ([string]::IsNullOrWhiteSpace($cacheHeader) -or $cacheHeader -notmatch 'max-age') {
            Write-Host "[FAIL] $($assetCheck.Name) sin Cache-Control con max-age"
            $contractFailures += 1
        }
    }
} catch {
    Write-Host "[FAIL] No se pudieron validar headers de cache para assets estaticos"
    $contractFailures += 1
}

try {
    $apiHeaderResp = Invoke-WebRequest -Uri "$base/api.php?resource=health" -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
        'Cache-Control' = 'no-cache'
        'User-Agent' = 'PielArmoniaSmoke/1.0'
    }
    $apiCacheHeader = [string]$apiHeaderResp.Headers['Cache-Control']
    if ([string]::IsNullOrWhiteSpace($apiCacheHeader) -or $apiCacheHeader -notmatch 'no-store|no-cache') {
        Write-Host "[FAIL] Health API sin politica no-store/no-cache"
        $contractFailures += 1
    }
} catch {
    Write-Host "[FAIL] No se pudo validar Cache-Control de Health API"
    $contractFailures += 1
}

$healthResult = $results | Where-Object { $_.Name -eq 'Health API' } | Select-Object -First 1
if ($null -ne $healthResult -and $healthResult.Ok) {
    try {
        $healthJson = $healthResult.Body | ConvertFrom-Json
        foreach ($field in @('timingMs', 'version', 'dataDirWritable', 'storeEncrypted', 'figoConfigured', 'figoRecursiveConfig')) {
            if ($null -eq $healthJson.PSObject.Properties[$field]) {
                Write-Host "[FAIL] Health API sin campo requerido: $field"
                $contractFailures += 1
            }
        }

        $healthTimingMs = 0
        try { $healthTimingMs = [int]$healthJson.timingMs } catch { $healthTimingMs = 0 }
        if ($healthTimingMs -gt $MaxHealthTimingMs) {
            Write-Host "[FAIL] Health API timingMs alto: $healthTimingMs ms (max $MaxHealthTimingMs ms)"
            $contractFailures += 1
        }

        $healthRecursive = $false
        try { $healthRecursive = [bool]$healthJson.figoRecursiveConfig } catch { $healthRecursive = $false }
        if ($healthRecursive -and -not $AllowRecursiveFigo) {
            Write-Host "[FAIL] Health API reporta figoRecursiveConfig=true"
            $contractFailures += 1
        }
    } catch {
        Write-Host "[FAIL] Health API no devolvio JSON valido"
        $contractFailures += 1
    }
}

$figoGetResult = $results | Where-Object { $_.Name -eq 'Figo chat GET' } | Select-Object -First 1
if ($null -ne $figoGetResult -and $figoGetResult.Ok) {
    try {
        $figoJson = $figoGetResult.Body | ConvertFrom-Json
        foreach ($field in @('mode', 'recursiveConfigDetected', 'upstreamReachable')) {
            if ($null -eq $figoJson.PSObject.Properties[$field]) {
                Write-Host "[FAIL] Figo chat GET sin campo requerido: $field"
                $contractFailures += 1
            }
        }

        $mode = ''
        try { $mode = [string]$figoJson.mode } catch { $mode = '' }
        if (-not $AllowDegradedFigo -and $mode -ne 'live') {
            Write-Host "[FAIL] Figo chat GET mode=$mode (se esperaba live)"
            $contractFailures += 1
        }

        $recursive = $false
        try { $recursive = [bool]$figoJson.recursiveConfigDetected } catch { $recursive = $false }
        if ($recursive -and -not $AllowRecursiveFigo) {
            Write-Host "[FAIL] Figo chat GET recursiveConfigDetected=true"
            $contractFailures += 1
        }

        $upstreamReachable = $true
        try { $upstreamReachable = [bool]$figoJson.upstreamReachable } catch { $upstreamReachable = $false }
        if (-not $AllowDegradedFigo -and -not $upstreamReachable) {
            Write-Host "[FAIL] Figo chat GET upstreamReachable=false"
            $contractFailures += 1
        }
    } catch {
        Write-Host "[FAIL] Figo chat GET no devolvio JSON valido"
        $contractFailures += 1
    }
}

$figoPostResult = $results | Where-Object { $_.Name -eq 'Figo chat POST' } | Select-Object -First 1
if ($null -ne $figoPostResult -and $figoPostResult.Ok) {
    try {
        $figoPostJson = $figoPostResult.Body | ConvertFrom-Json
        $assistantText = ''
        try {
            if ($figoPostJson.choices -and $figoPostJson.choices.Count -gt 0) {
                $assistantText = [string]$figoPostJson.choices[0].message.content
            }
        } catch {
            $assistantText = ''
        }

        $normalizedText = ($assistantText.ToLowerInvariant())
        if ($normalizedText -like '*problemas t*cnicos*' -or
            $normalizedText -like '*contact*nos directamente por whatsapp*' -or
            $normalizedText -like '*te atenderemos personalmente*') {
            Write-Host "[FAIL] Figo chat POST devolvio fallback tecnico en lugar de respuesta inteligente"
            $contractFailures += 1
        }
    } catch {
        Write-Host "[FAIL] Figo chat POST no devolvio JSON valido"
        $contractFailures += 1
    }
}

$figoBackendGetResult = $results | Where-Object { $_.Name -eq 'Figo backend GET' } | Select-Object -First 1
if ($null -ne $figoBackendGetResult -and $figoBackendGetResult.Ok) {
    try {
        $figoBackendJson = $figoBackendGetResult.Body | ConvertFrom-Json
        foreach ($field in @('service', 'mode', 'provider', 'telegramConfigured', 'webhookSecretConfigured')) {
            if ($null -eq $figoBackendJson.PSObject.Properties[$field]) {
                Write-Host "[FAIL] Figo backend GET sin campo requerido: $field"
                $contractFailures += 1
            }
        }

        if ([string]$figoBackendJson.service -ne 'figo-backend') {
            Write-Host "[FAIL] Figo backend GET service invalido: $($figoBackendJson.service)"
            $contractFailures += 1
        }

        if ($RequireWebhookSecret -and -not [bool]$figoBackendJson.webhookSecretConfigured) {
            Write-Host "[FAIL] Figo backend GET webhookSecretConfigured=false"
            $contractFailures += 1
        }
    } catch {
        Write-Host "[FAIL] Figo backend GET no devolvio JSON valido"
        $contractFailures += 1
    }
}

$okCount = [int](($results | Where-Object { $_.Ok } | Measure-Object).Count)
$total = $results.Count
Write-Host ""
Write-Host "Resultado HTTP base: $okCount/$total checks OK"
Write-Host "Fallas de contrato/reglas: $contractFailures"

if ($okCount -ne $total -or $contractFailures -gt 0) {
    exit 1
}

exit 0
