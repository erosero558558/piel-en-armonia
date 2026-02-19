param(
    [string]$Domain = 'https://pielarmonia.com',
    [switch]$RunSmoke,
    [switch]$AllowDegradedFigo,
    [switch]$AllowRecursiveFigo,
    [switch]$AllowMetaCspFallback,
    [switch]$RequireWebhookSecret,
    [int]$MaxHealthTimingMs = 2000
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')

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

function Get-RemoteSha256 {
    param([string]$Url)

    $tmp = New-TemporaryFile
    try {
        curl.exe -sS -L --max-time 30 --connect-timeout 8 -o $tmp $Url | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "No se pudo descargar $Url"
        }
        return (Get-FileHash -Algorithm SHA256 -Path $tmp).Hash.ToLowerInvariant()
    } finally {
        Remove-Item -Force -ErrorAction SilentlyContinue $tmp
    }
}

function Get-LocalSha256 {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        return ''
    }
    return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
}

function Get-RemoteText {
    param([string]$Url)

    $tmp = New-TemporaryFile
    try {
        curl.exe -sS -L --max-time 30 --connect-timeout 8 -o $tmp $Url | Out-Null
        if ($LASTEXITCODE -ne 0) {
            return ''
        }
        return [string](Get-Content -Path $tmp -Raw)
    } catch {
        return ''
    } finally {
        Remove-Item -Force -ErrorAction SilentlyContinue $tmp
    }
}

function Invoke-JsonGet {
    param([string]$Url)

    try {
        $resp = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 30 -UseBasicParsing -Headers @{
            'Cache-Control' = 'no-cache'
            'User-Agent' = 'PielArmoniaDeployCheck/1.0'
        }

        $status = [int]$resp.StatusCode
        $body = [string]$resp.Content
        if ($status -lt 200 -or $status -ge 300) {
            throw "HTTP $status en $Url"
        }

        try {
            $json = $body | ConvertFrom-Json
        } catch {
            throw "La respuesta de $Url no es JSON valido"
        }

        return [PSCustomObject]@{
            Status = $status
            Body = $body
            Json = $json
        }
    } catch {
        throw
    }
}

Write-Host "== Verificacion de despliegue =="
Write-Host "Dominio: $base"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$indexRaw = Get-Content -Path 'index.html' -Raw
$localScriptRef = Get-RefFromIndex -IndexHtml $indexRaw -Pattern '<script\s+src="([^"]*script\.js[^"]*)"'
$localStyleRef = Get-RefFromIndex -IndexHtml $indexRaw -Pattern '<link\s+rel="stylesheet"\s+href="([^"]*styles\.css[^"]*)"'

if ($localScriptRef -eq '' -or $localStyleRef -eq '') {
    throw 'No se pudieron detectar referencias versionadas de script.js/styles.css en index.html'
}

$remoteIndexTmp = New-TemporaryFile
try {
    curl.exe -sS -L --max-time 30 --connect-timeout 8 -o $remoteIndexTmp "$base/" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo descargar $base/"
    }
    $remoteIndexRaw = Get-Content -Path $remoteIndexTmp -Raw
} finally {
    Remove-Item -Force -ErrorAction SilentlyContinue $remoteIndexTmp
}

$results = @()

try {
    $homeResp = Invoke-WebRequest -Uri "$base/" -Method GET -TimeoutSec 30 -UseBasicParsing -Headers @{
        'Cache-Control' = 'no-cache'
        'User-Agent' = 'PielArmoniaDeployCheck/1.0'
    }
    $requiredSecurityHeaders = @(
        'Content-Security-Policy',
        'X-Content-Type-Options',
        'Referrer-Policy'
    )
    $homeHtml = ''
    try { $homeHtml = [string]$homeResp.Content } catch { $homeHtml = '' }
    foreach ($headerName in $requiredSecurityHeaders) {
        if ($null -ne $homeResp.Headers[$headerName]) {
            Write-Host "[OK]  header presente: $headerName"
        } else {
            if ($headerName -eq 'Content-Security-Policy' -and $AllowMetaCspFallback -and [regex]::IsMatch($homeHtml, '<meta[^>]+http-equiv\s*=\s*["'']Content-Security-Policy["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
                Write-Host "[WARN] header ausente: $headerName (fallback temporal por meta-CSP)"
                continue
            }
            Write-Host "[FAIL] header ausente: $headerName"
            $results += [PSCustomObject]@{
                Asset = "header:$headerName"
                Match = $false
                LocalHash = 'required'
                RemoteHash = 'missing'
                RemoteUrl = "$base/"
            }
        }
    }
} catch {
    Write-Host "[FAIL] No se pudieron validar headers de seguridad: $($_.Exception.Message)"
    $results += [PSCustomObject]@{
        Asset = 'headers:security'
        Match = $false
        LocalHash = ''
        RemoteHash = ''
        RemoteUrl = "$base/"
    }
}

$remoteScriptRef = Get-RefFromIndex -IndexHtml $remoteIndexRaw -Pattern '<script\s+src="([^"]*script\.js[^"]*)"'
$remoteStyleRef = Get-RefFromIndex -IndexHtml $remoteIndexRaw -Pattern '<link\s+rel="stylesheet"\s+href="([^"]*styles\.css[^"]*)"'
$appScriptRemoteUrl = Get-Url -Base $base -Ref $localScriptRef
$criticalCssRemoteUrl = Get-Url -Base $base -Ref $localStyleRef

try {
    $assetHeaderChecks = @(
        @{ Name = 'app-script'; Url = $appScriptRemoteUrl },
        @{ Name = 'critical-css'; Url = $criticalCssRemoteUrl }
    )
    foreach ($assetCheck in $assetHeaderChecks) {
        if ([string]::IsNullOrWhiteSpace($assetCheck.Url)) {
            continue
        }
        $assetResp = Invoke-WebRequest -Uri $assetCheck.Url -Method GET -TimeoutSec 30 -UseBasicParsing -Headers @{
            'Cache-Control' = 'no-cache'
            'User-Agent' = 'PielArmoniaDeployCheck/1.0'
        }
        $cacheHeader = [string]$assetResp.Headers['Cache-Control']
        if ([string]::IsNullOrWhiteSpace($cacheHeader) -or $cacheHeader -notmatch 'max-age') {
            Write-Host "[FAIL] asset sin Cache-Control con max-age: $($assetCheck.Name)"
            $results += [PSCustomObject]@{
                Asset = "cache-header:$($assetCheck.Name)"
                Match = $false
                LocalHash = 'max-age'
                RemoteHash = if ($cacheHeader) { $cacheHeader } else { 'missing' }
                RemoteUrl = $assetCheck.Url
            }
        } else {
            Write-Host "[OK]  cache header correcto en: $($assetCheck.Name)"
        }
    }
} catch {
    Write-Host "[FAIL] No se pudieron validar headers de cache de assets"
    $results += [PSCustomObject]@{
        Asset = 'cache-header:assets'
        Match = $false
        LocalHash = 'max-age'
        RemoteHash = ''
        RemoteUrl = "$base/"
    }
}

try {
    $healthHeaderResp = Invoke-WebRequest -Uri "$base/api.php?resource=health" -Method GET -TimeoutSec 30 -UseBasicParsing -Headers @{
        'Cache-Control' = 'no-cache'
        'User-Agent' = 'PielArmoniaDeployCheck/1.0'
    }
    $healthCacheHeader = [string]$healthHeaderResp.Headers['Cache-Control']
    if ([string]::IsNullOrWhiteSpace($healthCacheHeader) -or $healthCacheHeader -notmatch 'no-store|no-cache') {
        Write-Host "[FAIL] Health API sin no-store/no-cache"
        $results += [PSCustomObject]@{
            Asset = 'cache-header:health-api'
            Match = $false
            LocalHash = 'no-store'
            RemoteHash = if ($healthCacheHeader) { $healthCacheHeader } else { 'missing' }
            RemoteUrl = "$base/api.php?resource=health"
        }
    } else {
        Write-Host "[OK]  cache header no-store/no-cache en Health API"
    }
} catch {
    Write-Host "[FAIL] No se pudo validar Cache-Control de Health API"
    $results += [PSCustomObject]@{
        Asset = 'cache-header:health-api'
        Match = $false
        LocalHash = 'no-store'
        RemoteHash = ''
        RemoteUrl = "$base/api.php?resource=health"
    }
}

$localScriptTextForRefs = Get-Content -Path 'script.js' -Raw
$chatEngineVersion = ''
$chatEngineMatch = [regex]::Match($localScriptTextForRefs, "chat-engine\.js\?v=([a-zA-Z0-9._-]+)")
if ($chatEngineMatch.Success) {
    $chatEngineVersion = $chatEngineMatch.Groups[1].Value
}
$chatEngineRemoteUrl = if ($chatEngineVersion -ne '') {
    "$base/chat-engine.js?v=$chatEngineVersion"
} else {
    "$base/chat-engine.js"
}

$deferredStylesVersion = ''
$deferredStylesMatch = [regex]::Match($localScriptTextForRefs, "styles-deferred\.css\?v=([a-zA-Z0-9._-]+)")
if ($deferredStylesMatch.Success) {
    $deferredStylesVersion = $deferredStylesMatch.Groups[1].Value
}
$deferredStylesRemoteUrl = if ($deferredStylesVersion -ne '') {
    "$base/styles-deferred.css?v=$deferredStylesVersion"
} else {
    "$base/styles-deferred.css"
}

$translationsEnVersion = ''
$translationsEnMatch = [regex]::Match($localScriptTextForRefs, "translations-en\.js\?v=([a-zA-Z0-9._-]+)")
if ($translationsEnMatch.Success) {
    $translationsEnVersion = $translationsEnMatch.Groups[1].Value
}
$translationsEnRemoteUrl = if ($translationsEnVersion -ne '') {
    "$base/translations-en.js?v=$translationsEnVersion"
} else {
    "$base/translations-en.js"
}

$bookingEngineVersion = ''
$bookingEngineMatch = [regex]::Match($localScriptTextForRefs, "booking-engine\.js\?v=([a-zA-Z0-9._-]+)")
if ($bookingEngineMatch.Success) {
    $bookingEngineVersion = $bookingEngineMatch.Groups[1].Value
}
$bookingEngineRemoteUrl = if ($bookingEngineVersion -ne '') {
    "$base/booking-engine.js?v=$bookingEngineVersion"
} else {
    "$base/booking-engine.js"
}

$analyticsEngineVersion = ''
$analyticsEngineMatch = [regex]::Match($localScriptTextForRefs, "analytics-engine\.js\?v=([a-zA-Z0-9._-]+)")
if ($analyticsEngineMatch.Success) {
    $analyticsEngineVersion = $analyticsEngineMatch.Groups[1].Value
}
$analyticsEngineRemoteUrl = if ($analyticsEngineVersion -ne '') {
    "$base/analytics-engine.js?v=$analyticsEngineVersion"
} else {
    "$base/analytics-engine.js"
}

$uiEffectsVersion = ''
$uiEffectsMatch = [regex]::Match($localScriptTextForRefs, "ui-effects\.js\?v=([a-zA-Z0-9._-]+)")
if ($uiEffectsMatch.Success) {
    $uiEffectsVersion = $uiEffectsMatch.Groups[1].Value
}
$uiEffectsRemoteUrl = if ($uiEffectsVersion -ne '') {
    "$base/ui-effects.js?v=$uiEffectsVersion"
} else {
    "$base/ui-effects.js"
}

$galleryInteractionsVersion = ''
$galleryInteractionsMatch = [regex]::Match($localScriptTextForRefs, "gallery-interactions\.js\?v=([a-zA-Z0-9._-]+)")
if ($galleryInteractionsMatch.Success) {
    $galleryInteractionsVersion = $galleryInteractionsMatch.Groups[1].Value
}
$galleryInteractionsRemoteUrl = if ($galleryInteractionsVersion -ne '') {
    "$base/gallery-interactions.js?v=$galleryInteractionsVersion"
} else {
    "$base/gallery-interactions.js"
}

$rescheduleEngineVersion = ''
$rescheduleEngineMatch = [regex]::Match($localScriptTextForRefs, "reschedule-engine\.js\?v=([a-zA-Z0-9._-]+)")
if ($rescheduleEngineMatch.Success) {
    $rescheduleEngineVersion = $rescheduleEngineMatch.Groups[1].Value
}
$rescheduleEngineRemoteUrl = if ($rescheduleEngineVersion -ne '') {
    "$base/reschedule-engine.js?v=$rescheduleEngineVersion"
} else {
    "$base/reschedule-engine.js"
}

$bookingUiVersion = ''
$bookingUiMatch = [regex]::Match($localScriptTextForRefs, "booking-ui\.js\?v=([a-zA-Z0-9._-]+)")
if ($bookingUiMatch.Success) {
    $bookingUiVersion = $bookingUiMatch.Groups[1].Value
}
$bookingUiRemoteUrl = if ($bookingUiVersion -ne '') {
    "$base/booking-ui.js?v=$bookingUiVersion"
} else {
    "$base/booking-ui.js"
}

$chatBookingEngineVersion = ''
$chatBookingEngineMatch = [regex]::Match($localScriptTextForRefs, "chat-booking-engine\.js\?v=([a-zA-Z0-9._-]+)")
if ($chatBookingEngineMatch.Success) {
    $chatBookingEngineVersion = $chatBookingEngineMatch.Groups[1].Value
}
$chatBookingEngineRemoteUrl = if ($chatBookingEngineVersion -ne '') {
    "$base/chat-booking-engine.js?v=$chatBookingEngineVersion"
} else {
    "$base/chat-booking-engine.js"
}

$successModalEngineVersion = ''
$successModalEngineMatch = [regex]::Match($localScriptTextForRefs, "success-modal-engine\.js\?v=([a-zA-Z0-9._-]+)")
if ($successModalEngineMatch.Success) {
    $successModalEngineVersion = $successModalEngineMatch.Groups[1].Value
}
$successModalEngineRemoteUrl = if ($successModalEngineVersion -ne '') {
    "$base/success-modal-engine.js?v=$successModalEngineVersion"
} else {
    "$base/success-modal-engine.js"
}

$engagementFormsEngineVersion = ''
$engagementFormsEngineMatch = [regex]::Match($localScriptTextForRefs, "engagement-forms-engine\.js\?v=([a-zA-Z0-9._-]+)")
if ($engagementFormsEngineMatch.Success) {
    $engagementFormsEngineVersion = $engagementFormsEngineMatch.Groups[1].Value
}
$engagementFormsEngineRemoteUrl = if ($engagementFormsEngineVersion -ne '') {
    "$base/engagement-forms-engine.js?v=$engagementFormsEngineVersion"
} else {
    "$base/engagement-forms-engine.js"
}

$modalUxEngineVersion = ''
$modalUxEngineMatch = [regex]::Match($localScriptTextForRefs, "modal-ux-engine\.js\?v=([a-zA-Z0-9._-]+)")
if ($modalUxEngineMatch.Success) {
    $modalUxEngineVersion = $modalUxEngineMatch.Groups[1].Value
}
$modalUxEngineRemoteUrl = if ($modalUxEngineVersion -ne '') {
    "$base/modal-ux-engine.js?v=$modalUxEngineVersion"
} else {
    "$base/modal-ux-engine.js"
}

try {
    $assetHeaderChecks = @(
        @{ Name = 'chat-engine'; Url = $chatEngineRemoteUrl },
        @{ Name = 'styles-deferred'; Url = $deferredStylesRemoteUrl },
        @{ Name = 'translations-en'; Url = $translationsEnRemoteUrl },
        @{ Name = 'booking-engine'; Url = $bookingEngineRemoteUrl },
        @{ Name = 'booking-ui'; Url = $bookingUiRemoteUrl },
        @{ Name = 'chat-booking-engine'; Url = $chatBookingEngineRemoteUrl },
        @{ Name = 'success-modal-engine'; Url = $successModalEngineRemoteUrl },
        @{ Name = 'engagement-forms-engine'; Url = $engagementFormsEngineRemoteUrl },
        @{ Name = 'modal-ux-engine'; Url = $modalUxEngineRemoteUrl },
        @{ Name = 'reschedule-engine'; Url = $rescheduleEngineRemoteUrl },
        @{ Name = 'ui-effects'; Url = $uiEffectsRemoteUrl },
        @{ Name = 'gallery-interactions'; Url = $galleryInteractionsRemoteUrl }
    )
    foreach ($assetCheck in $assetHeaderChecks) {
        if ([string]::IsNullOrWhiteSpace($assetCheck.Url)) {
            continue
        }
        $assetResp = Invoke-WebRequest -Uri $assetCheck.Url -Method GET -TimeoutSec 30 -UseBasicParsing -Headers @{
            'Cache-Control' = 'no-cache'
            'User-Agent' = 'PielArmoniaDeployCheck/1.0'
        }
        $cacheHeader = [string]$assetResp.Headers['Cache-Control']
        if ([string]::IsNullOrWhiteSpace($cacheHeader) -or $cacheHeader -notmatch 'max-age') {
            Write-Host "[FAIL] asset sin Cache-Control con max-age: $($assetCheck.Name)"
            $results += [PSCustomObject]@{
                Asset = "cache-header:$($assetCheck.Name)"
                Match = $false
                LocalHash = 'max-age'
                RemoteHash = if ($cacheHeader) { $cacheHeader } else { 'missing' }
                RemoteUrl = $assetCheck.Url
            }
        } else {
            Write-Host "[OK]  cache header correcto en: $($assetCheck.Name)"
        }
    }
} catch {
    Write-Host "[FAIL] No se pudieron validar headers de cache de assets secundarios"
    $results += [PSCustomObject]@{
        Asset = 'cache-header:assets-secondary'
        Match = $false
        LocalHash = 'max-age'
        RemoteHash = ''
        RemoteUrl = "$base/"
    }
}

if ([regex]::IsMatch($remoteIndexRaw, '\son[a-z]+\s*=', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
    Write-Host "[FAIL] index remoto contiene event handlers inline (on*)"
    $results += [PSCustomObject]@{
        Asset = 'index-inline-handlers'
        Match = $false
        LocalHash = 'none'
        RemoteHash = 'found'
        RemoteUrl = "$base/"
    }
} else {
    Write-Host "[OK]  index remoto sin handlers inline (on*)"
}

if ($remoteScriptRef -eq '' -or $remoteStyleRef -eq '') {
    Write-Host "[FAIL] No se pudieron detectar referencias de assets en index remoto"
    $results += [PSCustomObject]@{
        Asset = 'index-asset-refs'
        Match = $false
        LocalHash = ''
        RemoteHash = ''
        RemoteUrl = "$base/"
    }
} else {
    if ($remoteScriptRef -eq $localScriptRef) {
        Write-Host "[OK]  index remoto usa misma referencia de script.js"
    } else {
        Write-Host "[FAIL] index remoto script.js diferente"
        Write-Host "       Local : $localScriptRef"
        Write-Host "       Remote: $remoteScriptRef"
        $results += [PSCustomObject]@{
            Asset = 'index-ref:script.js'
            Match = $false
            LocalHash = $localScriptRef
            RemoteHash = $remoteScriptRef
            RemoteUrl = "$base/"
        }
    }

    if ($remoteStyleRef -eq $localStyleRef) {
        Write-Host "[OK]  index remoto usa misma referencia de styles.css"
    } else {
        Write-Host "[FAIL] index remoto styles.css diferente"
        Write-Host "       Local : $localStyleRef"
        Write-Host "       Remote: $remoteStyleRef"
        $results += [PSCustomObject]@{
            Asset = 'index-ref:styles.css'
            Match = $false
            LocalHash = $localStyleRef
            RemoteHash = $remoteStyleRef
            RemoteUrl = "$base/"
        }
    }
}

$checks = @(
    [PSCustomObject]@{
        Name = 'styles.css'
        LocalPath = 'styles.css'
        RemoteUrl = (Get-Url -Base $base -Ref $localStyleRef)
    },
    [PSCustomObject]@{
        Name = 'script.js'
        LocalPath = 'script.js'
        RemoteUrl = (Get-Url -Base $base -Ref $localScriptRef)
    },
    [PSCustomObject]@{
        Name = 'chat-engine.js'
        LocalPath = 'chat-engine.js'
        RemoteUrl = $chatEngineRemoteUrl
    },
    [PSCustomObject]@{
        Name = 'styles-deferred.css'
        LocalPath = 'styles-deferred.css'
        RemoteUrl = $deferredStylesRemoteUrl
    },
    [PSCustomObject]@{
        Name = 'translations-en.js'
        LocalPath = 'translations-en.js'
        RemoteUrl = $translationsEnRemoteUrl
    },
    [PSCustomObject]@{
        Name = 'booking-engine.js'
        LocalPath = 'booking-engine.js'
        RemoteUrl = $bookingEngineRemoteUrl
    },
    [PSCustomObject]@{
        Name = 'ui-effects.js'
        LocalPath = 'ui-effects.js'
        RemoteUrl = $uiEffectsRemoteUrl
    },
    [PSCustomObject]@{
        Name = 'gallery-interactions.js'
        LocalPath = 'gallery-interactions.js'
        RemoteUrl = $galleryInteractionsRemoteUrl
    },
    [PSCustomObject]@{
        Name = 'reschedule-engine.js'
        LocalPath = 'reschedule-engine.js'
        RemoteUrl = $rescheduleEngineRemoteUrl
    },
    [PSCustomObject]@{
        Name = 'booking-ui.js'
        LocalPath = 'booking-ui.js'
        RemoteUrl = $bookingUiRemoteUrl
    },
    [PSCustomObject]@{
        Name = 'chat-booking-engine.js'
        LocalPath = 'chat-booking-engine.js'
        RemoteUrl = $chatBookingEngineRemoteUrl
    },
    [PSCustomObject]@{
        Name = 'success-modal-engine.js'
        LocalPath = 'success-modal-engine.js'
        RemoteUrl = $successModalEngineRemoteUrl
    },
    [PSCustomObject]@{
        Name = 'engagement-forms-engine.js'
        LocalPath = 'engagement-forms-engine.js'
        RemoteUrl = $engagementFormsEngineRemoteUrl
    },
    [PSCustomObject]@{
        Name = 'modal-ux-engine.js'
        LocalPath = 'modal-ux-engine.js'
        RemoteUrl = $modalUxEngineRemoteUrl
    }
)
foreach ($item in $checks) {
    $localHash = Get-LocalSha256 -Path $item.LocalPath
    $remoteHash = Get-RemoteSha256 -Url $item.RemoteUrl
    $match = ($localHash -ne '' -and $localHash -eq $remoteHash)
    $results += [PSCustomObject]@{
        Asset = $item.Name
        Match = $match
        LocalHash = $localHash
        RemoteHash = $remoteHash
        RemoteUrl = $item.RemoteUrl
    }
}

$results | ForEach-Object {
    if ($_.Match) {
        Write-Host "[OK]  $($_.Asset) hashes coinciden"
    } else {
        Write-Host "[FAIL] $($_.Asset) hash no coincide"
        Write-Host "       Local : $($_.LocalHash)"
        Write-Host "       Remote: $($_.RemoteHash)"
        Write-Host "       URL   : $($_.RemoteUrl)"
    }
}

$remoteScriptText = Get-RemoteText -Url (Get-Url -Base $base -Ref $localScriptRef)
$remoteBookingEngineText = Get-RemoteText -Url $bookingEngineRemoteUrl
$remoteAnalyticsEngineText = Get-RemoteText -Url $analyticsEngineRemoteUrl

$analyticsChecks = @(
    @{
        Name = 'function initGA4'
        Pattern = 'function\s+initGA4'
        Sources = @('script')
    },
    @{
        Name = 'initGA4()'
        Pattern = 'initGA4\(\)'
        Sources = @('script')
    },
    @{
        Name = 'trackEvent(start_checkout)'
        Pattern = "trackEvent\(\s*['""]start_checkout['""]"
        Sources = @('script', 'booking', 'analytics')
    }
)

foreach ($check in $analyticsChecks) {
    $matched = $false
    if ($check.Sources -contains 'script' -and -not $matched -and [regex]::IsMatch($remoteScriptText, $check.Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $matched = $true
    }
    if ($check.Sources -contains 'booking' -and -not $matched -and [regex]::IsMatch($remoteBookingEngineText, $check.Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $matched = $true
    }
    if ($check.Sources -contains 'analytics' -and -not $matched -and [regex]::IsMatch($remoteAnalyticsEngineText, $check.Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $matched = $true
    }

    if ($matched) {
        Write-Host "[OK]  script remoto contiene: $($check.Name)"
    } else {
        Write-Host "[FAIL] script remoto NO contiene: $($check.Name)"
        $results += [PSCustomObject]@{
            Asset = "script-token:$($check.Name)"
            Match = $false
            LocalHash = ''
            RemoteHash = ''
            RemoteUrl = (Get-Url -Base $base -Ref $localScriptRef)
        }
    }
}

$healthUrl = "$base/api.php?resource=health"
try {
    $healthResp = Invoke-JsonGet -Url $healthUrl
    $healthRequired = @('timingMs', 'version', 'dataDirWritable', 'storeEncrypted', 'figoConfigured', 'figoRecursiveConfig')
    foreach ($field in $healthRequired) {
        if ($null -ne $healthResp.Json.PSObject.Properties[$field]) {
            Write-Host "[OK]  health incluye: $field"
        } else {
            Write-Host "[FAIL] health NO incluye: $field"
            $results += [PSCustomObject]@{
                Asset = "health-field:$field"
                Match = $false
                LocalHash = ''
                RemoteHash = ''
                RemoteUrl = $healthUrl
            }
        }
    }

    $healthTimingMs = 0
    try {
        $healthTimingMs = [int]($healthResp.Json.timingMs)
    } catch {
        $healthTimingMs = 0
    }
    if ($healthTimingMs -gt $MaxHealthTimingMs) {
        Write-Host "[FAIL] health timingMs alto: $healthTimingMs ms (max $MaxHealthTimingMs ms)"
        $results += [PSCustomObject]@{
            Asset = 'health-timingMs'
            Match = $false
            LocalHash = "$MaxHealthTimingMs"
            RemoteHash = "$healthTimingMs"
            RemoteUrl = $healthUrl
        }
    } else {
        Write-Host "[OK]  health timingMs dentro de umbral ($healthTimingMs ms)"
    }

    $healthRecursive = $false
    try {
        $healthRecursive = [bool]($healthResp.Json.figoRecursiveConfig)
    } catch {
        $healthRecursive = $false
    }
    if ($healthRecursive -and -not $AllowRecursiveFigo) {
        Write-Host "[FAIL] health reporta figoRecursiveConfig=true"
        $results += [PSCustomObject]@{
            Asset = 'health-figoRecursiveConfig'
            Match = $false
            LocalHash = 'false'
            RemoteHash = 'true'
            RemoteUrl = $healthUrl
        }
    }
} catch {
    Write-Host "[FAIL] No se pudo validar health: $($_.Exception.Message)"
    $results += [PSCustomObject]@{
        Asset = "health-endpoint"
        Match = $false
        LocalHash = ''
        RemoteHash = ''
        RemoteUrl = $healthUrl
    }
}

$figoUrl = "$base/figo-chat.php"
try {
    $figoResp = Invoke-JsonGet -Url $figoUrl
    $figoRequired = @('mode', 'recursiveConfigDetected', 'upstreamReachable')
    foreach ($field in $figoRequired) {
        if ($null -ne $figoResp.Json.PSObject.Properties[$field]) {
            Write-Host "[OK]  figo-status incluye: $field"
        } else {
            Write-Host "[FAIL] figo-status NO incluye: $field"
            $results += [PSCustomObject]@{
                Asset = "figo-field:$field"
                Match = $false
                LocalHash = ''
                RemoteHash = ''
                RemoteUrl = $figoUrl
            }
        }
    }

    $figoMode = ''
    try {
        $figoMode = [string]($figoResp.Json.mode)
    } catch {
        $figoMode = ''
    }
    if (-not $AllowDegradedFigo -and $figoMode -ne 'live') {
        Write-Host "[FAIL] figo-status mode=$figoMode (se esperaba live)"
        $results += [PSCustomObject]@{
            Asset = 'figo-mode'
            Match = $false
            LocalHash = 'live'
            RemoteHash = $figoMode
            RemoteUrl = $figoUrl
        }
    } else {
        Write-Host "[OK]  figo-status mode=$figoMode"
    }

    $figoRecursive = $false
    try {
        $figoRecursive = [bool]($figoResp.Json.recursiveConfigDetected)
    } catch {
        $figoRecursive = $false
    }
    if ($figoRecursive -and -not $AllowRecursiveFigo) {
        Write-Host "[FAIL] figo-status recursiveConfigDetected=true"
        $results += [PSCustomObject]@{
            Asset = 'figo-recursive'
            Match = $false
            LocalHash = 'false'
            RemoteHash = 'true'
            RemoteUrl = $figoUrl
        }
    }

    $upstreamReachable = $true
    try {
        $upstreamReachable = [bool]($figoResp.Json.upstreamReachable)
    } catch {
        $upstreamReachable = $false
    }
    if (-not $AllowDegradedFigo -and -not $upstreamReachable) {
        Write-Host "[FAIL] figo-status upstreamReachable=false"
        $results += [PSCustomObject]@{
            Asset = 'figo-upstreamReachable'
            Match = $false
            LocalHash = 'true'
            RemoteHash = 'false'
            RemoteUrl = $figoUrl
        }
    }
} catch {
    Write-Host "[FAIL] No se pudo validar figo-chat.php GET: $($_.Exception.Message)"
    $results += [PSCustomObject]@{
        Asset = "figo-endpoint"
        Match = $false
        LocalHash = ''
        RemoteHash = ''
        RemoteUrl = $figoUrl
    }
}

$figoBackendUrl = "$base/figo-backend.php"
try {
    $figoBackendResp = Invoke-JsonGet -Url $figoBackendUrl
    $figoBackendRequired = @('service', 'mode', 'provider', 'telegramConfigured', 'webhookSecretConfigured')
    foreach ($field in $figoBackendRequired) {
        if ($null -ne $figoBackendResp.Json.PSObject.Properties[$field]) {
            Write-Host "[OK]  figo-backend incluye: $field"
        } else {
            Write-Host "[FAIL] figo-backend NO incluye: $field"
            $results += [PSCustomObject]@{
                Asset = "figo-backend-field:$field"
                Match = $false
                LocalHash = ''
                RemoteHash = ''
                RemoteUrl = $figoBackendUrl
            }
        }
    }

    $serviceName = [string]$figoBackendResp.Json.service
    if ($serviceName -ne 'figo-backend') {
        Write-Host "[FAIL] figo-backend service invalido: $serviceName"
        $results += [PSCustomObject]@{
            Asset = 'figo-backend-service'
            Match = $false
            LocalHash = 'figo-backend'
            RemoteHash = $serviceName
            RemoteUrl = $figoBackendUrl
        }
    }

    $webhookSecretConfigured = $false
    try {
        $webhookSecretConfigured = [bool]($figoBackendResp.Json.webhookSecretConfigured)
    } catch {
        $webhookSecretConfigured = $false
    }
    if ($RequireWebhookSecret -and -not $webhookSecretConfigured) {
        Write-Host "[FAIL] figo-backend webhookSecretConfigured=false"
        $results += [PSCustomObject]@{
            Asset = 'figo-backend-webhookSecretConfigured'
            Match = $false
            LocalHash = 'true'
            RemoteHash = 'false'
            RemoteUrl = $figoBackendUrl
        }
    }
} catch {
    Write-Host "[FAIL] No se pudo validar figo-backend.php GET: $($_.Exception.Message)"
    $results += [PSCustomObject]@{
        Asset = "figo-backend-endpoint"
        Match = $false
        LocalHash = ''
        RemoteHash = ''
        RemoteUrl = $figoBackendUrl
    }
}

if ($RunSmoke) {
    Write-Host ""
    Write-Host "Ejecutando smoke..."
    & .\SMOKE-PRODUCCION.ps1 -Domain $base -TestFigoPost -AllowDegradedFigo:$AllowDegradedFigo -AllowRecursiveFigo:$AllowRecursiveFigo -AllowMetaCspFallback:$AllowMetaCspFallback -RequireWebhookSecret:$RequireWebhookSecret
}

$failed = ($results | Where-Object { -not $_.Match }).Count
if ($failed -gt 0) {
    Write-Host ""
    Write-Host "Resultado: $failed falla(s) detectadas."
    exit 1
}

Write-Host ""
Write-Host "Resultado: verificacion de despliegue OK."
exit 0
