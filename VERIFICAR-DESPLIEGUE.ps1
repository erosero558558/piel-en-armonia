param(
    [string]$Domain = 'https://pielarmonia.com',
    [switch]$RunSmoke,
    [switch]$AllowDegradedFigo,
    [switch]$AllowRecursiveFigo,
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

$remoteScriptRef = Get-RefFromIndex -IndexHtml $remoteIndexRaw -Pattern '<script\s+src="([^"]*script\.js[^"]*)"'
$remoteStyleRef = Get-RefFromIndex -IndexHtml $remoteIndexRaw -Pattern '<link\s+rel="stylesheet"\s+href="([^"]*styles\.css[^"]*)"'

$results = @()
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

$scriptRemoteTmp = New-TemporaryFile
try {
    curl.exe -sS -L --max-time 30 --connect-timeout 8 -o $scriptRemoteTmp (Get-Url -Base $base -Ref $localScriptRef) | Out-Null
    $remoteScriptText = Get-Content -Path $scriptRemoteTmp -Raw
} finally {
    Remove-Item -Force -ErrorAction SilentlyContinue $scriptRemoteTmp
}

$ga4Checks = @(
    'function initGA4',
    "initGA4();",
    "trackEvent('start_checkout'"
)

foreach ($token in $ga4Checks) {
    if ($remoteScriptText -like "*$token*") {
        Write-Host "[OK]  script remoto contiene: $token"
    } else {
        Write-Host "[FAIL] script remoto NO contiene: $token"
        $results += [PSCustomObject]@{
            Asset = "script-token:$token"
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

if ($RunSmoke) {
    Write-Host ""
    Write-Host "Ejecutando smoke..."
    & .\SMOKE-PRODUCCION.ps1 -Domain $base -TestFigoPost -AllowDegradedFigo:$AllowDegradedFigo -AllowRecursiveFigo:$AllowRecursiveFigo
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
