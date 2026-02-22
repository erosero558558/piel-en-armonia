param(
    [string]$Domain = 'https://pielarmonia.com',
    [int]$Runs = 25,
    [switch]$IncludeFigoPost,
    [int]$CoreP95MaxMs = 800,
    [int]$FigoPostP95MaxMs = 8000
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')

function Get-PercentileValue {
    param(
        [double[]]$Values,
        [double]$Percentile
    )

    if (-not $Values -or $Values.Count -eq 0) {
        return 0
    }

    $sorted = $Values | Sort-Object
    $index = [Math]::Ceiling(($Percentile / 100) * $sorted.Count) - 1
    if ($index -lt 0) {
        $index = 0
    }
    if ($index -ge $sorted.Count) {
        $index = $sorted.Count - 1
    }
    return [double]$sorted[$index]
}

function Measure-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = 'GET',
        [string]$JsonBody = ''
    )

    $times = New-Object System.Collections.Generic.List[double]
    $statusFailures = 0
    $networkFailures = 0

    for ($i = 1; $i -le $Runs; $i++) {
        $args = @(
            '-sS',
            '-o', 'NUL',
            '-w', '%{http_code} %{time_total}',
            '--max-time', '20',
            '--connect-timeout', '8',
            '-L',
            '-A', 'PielArmoniaBench/1.0'
        )

        if ($Method -eq 'POST') {
            $args += @(
                '-X', 'POST',
                '-H', 'Content-Type: application/json',
                '--data', $JsonBody
            )
        }

        $args += $Url
        $out = ''
        try {
            $out = (& curl.exe @args 2>$null | Out-String).Trim()
        } catch {
            $networkFailures += 1
            continue
        }

        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($out)) {
            $networkFailures += 1
            continue
        }

        $parts = $out -split '\s+'
        if ($parts.Count -lt 2) {
            $networkFailures += 1
            continue
        }

        $status = 0
        $timeSeconds = 0.0
        [void][int]::TryParse($parts[0], [ref]$status)
        [void][double]::TryParse($parts[1], [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$timeSeconds)

        if ($status -lt 200 -or $status -ge 500) {
            $statusFailures += 1
        }

        $times.Add([Math]::Round($timeSeconds * 1000, 2))
    }

    $sampleCount = $times.Count
    if ($sampleCount -eq 0) {
        return [PSCustomObject]@{
            Name = $Name
            Samples = 0
            AvgMs = 0
            P50Ms = 0
            P95Ms = 0
            MaxMs = 0
            StatusFailures = $statusFailures
            NetworkFailures = $networkFailures
        }
    }

    $avg = ($times | Measure-Object -Average).Average
    $p50 = Get-PercentileValue -Values $times.ToArray() -Percentile 50
    $p95 = Get-PercentileValue -Values $times.ToArray() -Percentile 95
    $max = ($times | Measure-Object -Maximum).Maximum

    return [PSCustomObject]@{
        Name = $Name
        Samples = $sampleCount
        AvgMs = [Math]::Round([double]$avg, 2)
        P50Ms = [Math]::Round([double]$p50, 2)
        P95Ms = [Math]::Round([double]$p95, 2)
        MaxMs = [Math]::Round([double]$max, 2)
        StatusFailures = $statusFailures
        NetworkFailures = $networkFailures
    }
}

function Get-BenchFailureReasons {
    param(
        [pscustomobject]$Result
    )

    $reasons = @()
    if ($Result.StatusFailures -gt 0 -or $Result.NetworkFailures -gt 0) {
        $reasons += 'status_or_network'
    }

    if ($Result.Name -in @('health', 'reviews', 'availability') -and $Result.P95Ms -gt $CoreP95MaxMs) {
        $reasons += 'p95_core_over_800'
    }

    if ($Result.Name -eq 'figo-post' -and $Result.P95Ms -gt $FigoPostP95MaxMs) {
        $reasons += 'p95_figo_post_over_2500'
    }

    return $reasons
}

Write-Host "== Bench Produccion API =="
Write-Host "Dominio: $base"
Write-Host "Runs por endpoint: $Runs"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$checks = @(
    @{ Name = 'health'; Url = "$base/api.php?resource=health"; Method = 'GET'; Body = '' },
    @{ Name = 'reviews'; Url = "$base/api.php?resource=reviews"; Method = 'GET'; Body = '' },
    @{ Name = 'availability'; Url = "$base/api.php?resource=availability"; Method = 'GET'; Body = '' },
    @{ Name = 'figo-get'; Url = "$base/figo-chat.php"; Method = 'GET'; Body = '' }
)

if ($IncludeFigoPost) {
    $figoBody = '{"model":"figo-assistant","messages":[{"role":"user","content":"hola"}],"max_tokens":120,"temperature":0.4}'
    $checks += @{ Name = 'figo-post'; Url = "$base/figo-chat.php"; Method = 'POST'; Body = $figoBody }
}

$results = @()
foreach ($check in $checks) {
    $results += Measure-Endpoint -Name $check.Name -Url $check.Url -Method $check.Method -JsonBody $check.Body
}

$failuresByName = @{}
foreach ($result in $results) {
    $reasons = Get-BenchFailureReasons -Result $result
    if ($reasons.Count -gt 0) {
        $failuresByName[$result.Name] = $reasons
    }
}

if ($failuresByName.Count -gt 0) {
    Write-Host ""
    Write-Host "[WARN] Se detectaron fallos iniciales de benchmark. Ejecutando corrida de confirmacion..." -ForegroundColor Yellow
    foreach ($check in $checks) {
        if (-not $failuresByName.ContainsKey($check.Name)) {
            continue
        }

        $rerun = Measure-Endpoint -Name $check.Name -Url $check.Url -Method $check.Method -JsonBody $check.Body
        $rerunReasons = Get-BenchFailureReasons -Result $rerun

        if ($rerunReasons.Count -eq 0) {
            Write-Host "[INFO] $($check.Name) recuperado en corrida de confirmacion." -ForegroundColor Green
            for ($idx = 0; $idx -lt $results.Count; $idx++) {
                if ($results[$idx].Name -eq $check.Name) {
                    $results[$idx] = $rerun
                    break
                }
            }
        } else {
            Write-Host "[WARN] $($check.Name) sigue fallando en confirmacion." -ForegroundColor Yellow
            for ($idx = 0; $idx -lt $results.Count; $idx++) {
                if ($results[$idx].Name -eq $check.Name) {
                    $results[$idx] = $rerun
                    break
                }
            }
        }
    }
}

$results | Format-Table -AutoSize

$failed = $false
foreach ($result in $results) {
    $reasons = Get-BenchFailureReasons -Result $result

    if ($reasons -contains 'status_or_network') {
        $failed = $true
        Write-Host "[FAIL] $($result.Name) tiene errores de status/red." -ForegroundColor Red
    }

    if ($reasons -contains 'p95_core_over_800') {
        $failed = $true
        Write-Host "[FAIL] $($result.Name) supera p95 de ${CoreP95MaxMs}ms (actual: $($result.P95Ms)ms)." -ForegroundColor Red
    }

    if ($reasons -contains 'p95_figo_post_over_2500') {
        $failed = $true
        Write-Host "[FAIL] figo-post supera p95 de ${FigoPostP95MaxMs}ms (actual: $($result.P95Ms)ms)." -ForegroundColor Red
    }
}

if ($failed) {
    exit 1
}

Write-Host "Bench OK: latencias dentro de umbrales."
exit 0
