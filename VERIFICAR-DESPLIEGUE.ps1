param(
    [string]$Domain = 'https://pielarmonia.com',
    [switch]$RunSmoke
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

    $tmp = New-TemporaryFile
    try {
        $statusRaw = curl.exe -sS -L --max-time 30 --connect-timeout 8 -o $tmp -w '%{http_code}' $Url
        if ($LASTEXITCODE -ne 0) {
            throw "No se pudo consultar $Url"
        }

        $status = 0
        if ($statusRaw -match '^\d{3}$') {
            $status = [int]$statusRaw
        }

        $body = Get-Content -Path $tmp -Raw
        if ($status -lt 200 -or $status -ge 300) {
            throw "HTTP $status en $Url"
        }

        try {
            $json = $body | ConvertFrom-Json -Depth 20
        } catch {
            throw "La respuesta de $Url no es JSON valido"
        }

        return [PSCustomObject]@{
            Status = $status
            Body = $body
            Json = $json
        }
    } finally {
        Remove-Item -Force -ErrorAction SilentlyContinue $tmp
    }
}

Write-Host "== Verificacion de despliegue =="
Write-Host "Dominio: $base"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$indexRaw = Get-Content -Path 'index.html' -Raw
$scriptRef = Get-RefFromIndex -IndexHtml $indexRaw -Pattern '<script\s+src="([^"]*script\.js[^"]*)"'
$styleRef = Get-RefFromIndex -IndexHtml $indexRaw -Pattern '<link\s+rel="stylesheet"\s+href="([^"]*styles\.css[^"]*)"'

if ($scriptRef -eq '' -or $styleRef -eq '') {
    throw 'No se pudieron detectar referencias versionadas de script.js/styles.css en index.html'
}

$checks = @(
    [PSCustomObject]@{
        Name = 'index.html'
        LocalPath = 'index.html'
        RemoteUrl = "$base/"
    },
    [PSCustomObject]@{
        Name = 'styles.css'
        LocalPath = 'styles.css'
        RemoteUrl = (Get-Url -Base $base -Ref $styleRef)
    },
    [PSCustomObject]@{
        Name = 'script.js'
        LocalPath = 'script.js'
        RemoteUrl = (Get-Url -Base $base -Ref $scriptRef)
    }
)

$results = @()
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
    curl.exe -sS -L --max-time 30 --connect-timeout 8 -o $scriptRemoteTmp (Get-Url -Base $base -Ref $scriptRef) | Out-Null
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
            RemoteUrl = (Get-Url -Base $base -Ref $scriptRef)
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
    & .\SMOKE-PRODUCCION.ps1 -Domain $base -TestFigoPost
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
