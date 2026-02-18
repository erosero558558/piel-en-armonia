param(
    [string]$Domain = 'https://pielarmonia.com',
    [switch]$TestFigoPost
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')
$tmpFile = Join-Path $env:TEMP 'pielarmonia-smoke-body.tmp'

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
    $results += Invoke-Check -Name 'Figo chat POST' -Url "$base/figo-chat.php" -Method 'POST' -Body $figoPayload
}

$okCount = [int](($results | Where-Object { $_.Ok } | Measure-Object).Count)
$total = $results.Count
Write-Host ""
Write-Host "Resultado: $okCount/$total checks OK"

if ($okCount -ne $total) {
    exit 1
}

exit 0
