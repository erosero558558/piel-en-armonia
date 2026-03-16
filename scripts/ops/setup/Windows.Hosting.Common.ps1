function Ensure-HostingParentDirectory {
    param([string]$Path)

    $parent = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
}

function ConvertFrom-JsonCompat {
    param(
        [string]$Text,
        [int]$Depth = 20
    )

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $null
    }

    $convertCommand = Get-Command ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($null -eq $convertCommand) {
        return $null
    }

    try {
        if ($convertCommand.Parameters.ContainsKey('Depth')) {
            return ($Text | ConvertFrom-Json -Depth $Depth)
        }
        return ($Text | ConvertFrom-Json)
    } catch {
        return $null
    }
}

function Read-HostingJsonFileSafe {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    try {
        $raw = Get-Content -LiteralPath $Path -Raw
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return $null
        }
        return (ConvertFrom-JsonCompat -Text ($raw -replace "^\uFEFF", '') -Depth 20)
    } catch {
        return $null
    }
}

function Write-HostingJsonFile {
    param(
        [string]$Path,
        [hashtable]$Payload
    )

    Ensure-HostingParentDirectory -Path $Path
    $json = $Payload | ConvertTo-Json -Depth 20
    Set-Content -Path $Path -Value $json -Encoding UTF8
}

function Set-HostingJsonFields {
    param(
        [string]$Path,
        [hashtable]$Fields
    )

    $payload = [ordered]@{}
    $existing = Read-HostingJsonFileSafe -Path $Path
    if ($existing -is [System.Collections.IDictionary]) {
        foreach ($key in $existing.Keys) {
            $payload[[string]$key] = $existing[$key]
        }
    } elseif ($null -ne $existing) {
        foreach ($property in $existing.PSObject.Properties) {
            $payload[[string]$property.Name] = $property.Value
        }
    }

    foreach ($key in $Fields.Keys) {
        $payload[[string]$key] = $Fields[$key]
    }

    Write-HostingJsonFile -Path $Path -Payload $payload
}

function Get-HostingRuntimePaths {
    param([string]$RepoRoot)

    $resolvedRepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
    $runtimeRoot = Join-Path $resolvedRepoRoot 'data\runtime\hosting'
    $logsRoot = Join-Path $runtimeRoot 'logs'
    $pidRoot = Join-Path $runtimeRoot 'pids'

    return [PSCustomObject]@{
        RepoRoot = $resolvedRepoRoot
        RuntimeRoot = $runtimeRoot
        LogsRoot = $logsRoot
        PidRoot = $pidRoot
        CaddyTemplatePath = Join-Path $resolvedRepoRoot 'ops\caddy\Caddyfile'
        CaddyRuntimeConfigPath = Join-Path $runtimeRoot 'Caddyfile.runtime'
        CaddyAccessLogPath = Join-Path $runtimeRoot 'caddy-access.log'
    }
}

function Convert-HostingPathToCaddyLiteral {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ''
    }

    return ([System.IO.Path]::GetFullPath($Path)).Replace('\', '/')
}

function Normalize-HostingPath {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ''
    }

    try {
        $resolved = [System.IO.Path]::GetFullPath($Path)
    } catch {
        $resolved = $Path
    }

    return ($resolved.TrimEnd('\', '/')).Replace('/', '\').ToLowerInvariant()
}

function Test-HostingPathEquivalent {
    param(
        [string]$LeftPath,
        [string]$RightPath
    )

    $leftNormalized = Normalize-HostingPath -Path $LeftPath
    $rightNormalized = Normalize-HostingPath -Path $RightPath
    if ([string]::IsNullOrWhiteSpace($leftNormalized) -or [string]::IsNullOrWhiteSpace($rightNormalized)) {
        return $false
    }

    return $leftNormalized -eq $rightNormalized
}

function New-HostingRuntimeCaddyConfig {
    param(
        [string]$TemplatePath,
        [string]$RuntimeConfigPath,
        [string]$SiteRootPath,
        [string]$AccessLogPath
    )

    if (-not (Test-Path -LiteralPath $TemplatePath)) {
        throw "No existe el template canonico de Caddy: $TemplatePath"
    }

    $template = Get-Content -LiteralPath $TemplatePath -Raw
    $siteRootLiteral = Convert-HostingPathToCaddyLiteral -Path $SiteRootPath
    $accessLogLiteral = Convert-HostingPathToCaddyLiteral -Path $AccessLogPath

    $runtimeConfig = $template.Replace(
        '{$PIELARMONIA_WORKSPACE_ROOT:C:/dev/pielarmonia-workspace}',
        $siteRootLiteral
    ).Replace(
        '{$PIELARMONIA_CADDY_ACCESS_LOG:C:/dev/pielarmonia-workspace/data/runtime/hosting/caddy-access.log}',
        $accessLogLiteral
    )

    Ensure-HostingParentDirectory -Path $RuntimeConfigPath
    $existing = ''
    if (Test-Path -LiteralPath $RuntimeConfigPath) {
        $existing = Get-Content -LiteralPath $RuntimeConfigPath -Raw
    }
    if ($existing -ne $runtimeConfig) {
        Set-Content -LiteralPath $RuntimeConfigPath -Value $runtimeConfig -Encoding ASCII
    }

    return [PSCustomObject]@{
        Path = $RuntimeConfigPath
        SiteRoot = $siteRootLiteral
        AccessLogPath = $accessLogLiteral
    }
}

function Add-HostingOptionalNamedArgument {
    param(
        [System.Collections.Generic.List[string]]$Arguments,
        [string]$Name,
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return
    }

    $Arguments.Add($Name) | Out-Null
    $Arguments.Add($Value) | Out-Null
}

function Get-HostingFileSha256 {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return ''
    }

    $getFileHashCommand = Get-Command Get-FileHash -ErrorAction SilentlyContinue
    if ($null -ne $getFileHashCommand) {
        try {
            return [string]((Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash).ToLowerInvariant()
        } catch {
        }
    }

    $stream = $null
    $sha256 = $null
    try {
        $stream = [System.IO.File]::OpenRead($Path)
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        $hashBytes = $sha256.ComputeHash($stream)
        $builder = New-Object System.Text.StringBuilder
        foreach ($byte in $hashBytes) {
            [void]$builder.AppendFormat('{0:x2}', $byte)
        }
        return [string]$builder.ToString()
    } finally {
        if ($null -ne $sha256) {
            $sha256.Dispose()
        }
        if ($null -ne $stream) {
            $stream.Dispose()
        }
    }
}

function Stop-HostingProcessTree {
    param(
        [int]$ProcessId,
        [switch]$KillTree
    )

    if ($ProcessId -le 0) {
        return
    }

    if ($KillTree) {
        $taskkillCommand = Get-Command taskkill.exe -ErrorAction SilentlyContinue
        if ($null -ne $taskkillCommand) {
            try {
                & $taskkillCommand.Source /T /F /PID $ProcessId *> $null
            } catch {
            }
        }
    }

    if (Test-HostingProcessExists -ProcessId $ProcessId) {
        try {
            Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
        } catch {
        }
    }
}

function Write-HostingCommandHeartbeat {
    param(
        [string]$Path,
        [string]$Label,
        [int]$ProcessId,
        [int]$TimeoutSeconds = 0,
        [switch]$TimedOut,
        [int]$ExitCode = [int]::MinValue,
        [string[]]$StatusFilesToWatch = @()
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return
    }

    $fields = [ordered]@{
        phase_heartbeat_at = [DateTimeOffset]::Now.ToString('o')
        timed_out = ($TimedOut -eq $true)
    }
    if (-not [string]::IsNullOrWhiteSpace($Label)) {
        $fields.child_script = $Label
    }
    if ($ProcessId -gt 0) {
        $fields.child_pid = $ProcessId
    }
    if ($TimeoutSeconds -gt 0) {
        $fields.phase_timeout_seconds = $TimeoutSeconds
    }
    if ($ExitCode -ne [int]::MinValue) {
        $fields.child_exit_code = $ExitCode
    }
    if (($StatusFilesToWatch | Measure-Object).Count -gt 0) {
        $fields.child_watch_files = @($StatusFilesToWatch | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    }

    Set-HostingJsonFields -Path $Path -Fields $fields
}

function Invoke-HostingCommandWithOutput {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [int]$TimeoutSeconds = 0,
        [string]$HeartbeatPath = '',
        [string]$Label = '',
        [string[]]$StatusFilesToWatch = @(),
        [bool]$KillTreeOnTimeout = $true
    )

    $stdoutPath = [System.IO.Path]::GetTempFileName()
    $stderrPath = [System.IO.Path]::GetTempFileName()
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $timedOut = $false
    $process = $null
    $lastHeartbeatAt = [DateTimeOffset]::MinValue
    try {
        $process = Start-Process `
            -FilePath $FilePath `
            -ArgumentList $Arguments `
            -NoNewWindow `
            -PassThru `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath

        Write-HostingCommandHeartbeat `
            -Path $HeartbeatPath `
            -Label $Label `
            -ProcessId $process.Id `
            -TimeoutSeconds $TimeoutSeconds `
            -TimedOut:$false `
            -StatusFilesToWatch $StatusFilesToWatch

        while ($true) {
            $process.Refresh()
            if ($process.HasExited) {
                break
            }

            $now = [DateTimeOffset]::Now
            if (($lastHeartbeatAt -eq [DateTimeOffset]::MinValue) -or (($now - $lastHeartbeatAt).TotalSeconds -ge 5)) {
                Write-HostingCommandHeartbeat `
                    -Path $HeartbeatPath `
                    -Label $Label `
                    -ProcessId $process.Id `
                    -TimeoutSeconds $TimeoutSeconds `
                    -TimedOut:$false `
                    -StatusFilesToWatch $StatusFilesToWatch
                $lastHeartbeatAt = $now
            }

            if (($TimeoutSeconds -gt 0) -and ($stopwatch.Elapsed.TotalSeconds -ge $TimeoutSeconds)) {
                $timedOut = $true
                Stop-HostingProcessTree -ProcessId $process.Id -KillTree:$KillTreeOnTimeout
                Start-Sleep -Milliseconds 500
                break
            }

            Start-Sleep -Milliseconds 500
        }

        if ($null -ne $process) {
            try {
                if (-not $process.HasExited) {
                    [void]$process.WaitForExit(5000)
                    $process.Refresh()
                }
            } catch {
            }
        }

        $chunks = @()
        foreach ($path in @($stdoutPath, $stderrPath)) {
            if (Test-Path -LiteralPath $path) {
                $content = Get-Content -LiteralPath $path -Raw
                if (-not [string]::IsNullOrWhiteSpace($content)) {
                    $chunks += $content.Trim()
                }
            }
        }

        $exitCode = -1
        if ($null -ne $process) {
            try {
                if ($process.HasExited) {
                    $exitCode = [int]$process.ExitCode
                }
            } catch {
            }
        }

        $processId = 0
        if ($null -ne $process) {
            $processId = [int]$process.Id
        }

        Write-HostingCommandHeartbeat `
            -Path $HeartbeatPath `
            -Label $Label `
            -ProcessId $processId `
            -TimeoutSeconds $TimeoutSeconds `
            -TimedOut:$timedOut `
            -ExitCode $exitCode `
            -StatusFilesToWatch $StatusFilesToWatch

        return [PSCustomObject]@{
            ExitCode = $exitCode
            Output = $chunks -join [Environment]::NewLine
            TimedOut = ($timedOut -eq $true)
            ProcessId = $processId
            DurationSeconds = [int][Math]::Ceiling($stopwatch.Elapsed.TotalSeconds)
        }
    } finally {
        $stopwatch.Stop()
        foreach ($path in @($stdoutPath, $stderrPath)) {
            if (Test-Path -LiteralPath $path) {
                Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

function Get-HostingResponseBody {
    param([object]$Response)

    if ($null -eq $Response) {
        return ''
    }

    try {
        $content = $Response.Content
        if ($content -is [string]) {
            return $content
        }
    } catch {
    }

    try {
        $stream = $Response.GetResponseStream()
        if ($null -ne $stream) {
            $reader = New-Object System.IO.StreamReader($stream)
            try {
                return $reader.ReadToEnd()
            } finally {
                $reader.Close()
            }
        }
    } catch {
    }

    return ''
}

function Invoke-HostingHttpRequest {
    param(
        [string]$Url,
        [hashtable]$Headers = @{},
        [int]$TimeoutSec = 20
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Headers $Headers -UseBasicParsing -TimeoutSec $TimeoutSec
        return [PSCustomObject]@{
            Ok = $true
            StatusCode = [int]$response.StatusCode
            Body = [string](Get-HostingResponseBody -Response $response)
            Error = ''
        }
    } catch {
        $statusCode = 0
        $body = ''
        if ($_.Exception.Response) {
            try { $statusCode = [int]$_.Exception.Response.StatusCode.value__ } catch {}
            $body = Get-HostingResponseBody -Response $_.Exception.Response
        }
        return [PSCustomObject]@{
            Ok = $false
            StatusCode = $statusCode
            Body = $body
            Error = $_.Exception.Message
        }
    }
}

function Invoke-HostingJsonRequest {
    param(
        [string]$Url,
        [hashtable]$Headers = @{},
        [int]$TimeoutSec = 20,
        [int]$Depth = 20
    )

    $response = Invoke-HostingHttpRequest -Url $Url -Headers $Headers -TimeoutSec $TimeoutSec
    $payload = $null
    if (-not [string]::IsNullOrWhiteSpace($response.Body)) {
        $payload = ConvertFrom-JsonCompat -Text $response.Body -Depth $Depth
    }

    $errorText = ''
    if ($response.Ok) {
        if ($null -eq $payload) {
            $errorText = 'JSON invalido'
        }
    } else {
        $errorText = $response.Error
    }

    return [PSCustomObject]@{
        Ok = $response.Ok -and ($null -ne $payload)
        StatusCode = $response.StatusCode
        Body = $response.Body
        Payload = $payload
        Error = $errorText
    }
}

function Invoke-HostingRuntimeFingerprint {
    param(
        [string]$BaseUrl = 'http://127.0.0.1',
        [int]$TimeoutSec = 10
    )

    $trimmedBaseUrl = [string]$BaseUrl
    if ([string]::IsNullOrWhiteSpace($trimmedBaseUrl)) {
        $trimmedBaseUrl = 'http://127.0.0.1'
    }
    $trimmedBaseUrl = $trimmedBaseUrl.TrimEnd('/')

    $response = Invoke-HostingJsonRequest `
        -Url ($trimmedBaseUrl + '/__hosting/runtime') `
        -Headers @{ Accept = 'application/json' } `
        -TimeoutSec $TimeoutSec

    $payload = $response.Payload
    $siteRoot = ''
    $currentCommit = ''
    $desiredCommit = ''
    $statusSource = ''
    $runtimeConfigPath = ''
    if ($null -ne $payload) {
        try { $siteRoot = [string]$payload.site_root } catch {}
        try { $currentCommit = [string]$payload.current_commit } catch {}
        try { $desiredCommit = [string]$payload.desired_commit } catch {}
        try { $statusSource = [string]$payload.status_source } catch {}
        try { $runtimeConfigPath = [string]$payload.caddy_runtime_config_path } catch {}
    }

    $ok =
        $response.Ok -and
        ($null -ne $payload) -and
        ($payload.ok -eq $true) -and
        (-not [string]::IsNullOrWhiteSpace($siteRoot))

    return [PSCustomObject]@{
        Ok = $ok
        Payload = $payload
        Error = if ($response.Ok) { '' } else { [string]$response.Error }
        SiteRoot = $siteRoot
        CurrentCommit = $currentCommit
        DesiredCommit = $desiredCommit
        StatusSource = $statusSource
        CaddyRuntimeConfigPath = $runtimeConfigPath
    }
}

function Test-HostingRuntimeFingerprintMatch {
    param(
        [object]$Fingerprint,
        [string]$ExpectedSiteRoot,
        [string]$ExpectedCurrentCommit = '',
        [string]$ExpectedDesiredCommit = '',
        [string]$ExpectedRuntimeConfigPath = ''
    )

    $siteRoot = ''
    $currentCommit = ''
    $desiredCommit = ''
    $runtimeConfigPath = ''
    $statusSource = ''
    $fingerprintError = ''
    $fingerprintOk = $false
    if ($null -ne $Fingerprint) {
        try { $siteRoot = [string]$Fingerprint.SiteRoot } catch {}
        try { $currentCommit = [string]$Fingerprint.CurrentCommit } catch {}
        try { $desiredCommit = [string]$Fingerprint.DesiredCommit } catch {}
        try { $runtimeConfigPath = [string]$Fingerprint.CaddyRuntimeConfigPath } catch {}
        try { $statusSource = [string]$Fingerprint.StatusSource } catch {}
        try { $fingerprintError = [string]$Fingerprint.Error } catch {}
        try { $fingerprintOk = ($Fingerprint.Ok -eq $true) } catch {}
    }

    $siteRootOk = $fingerprintOk -and (Test-HostingPathEquivalent -LeftPath $siteRoot -RightPath $ExpectedSiteRoot)
    $runtimeConfigOk = $true
    if (-not [string]::IsNullOrWhiteSpace($ExpectedRuntimeConfigPath)) {
        $runtimeConfigOk =
            $fingerprintOk -and
            (Test-HostingPathEquivalent -LeftPath $runtimeConfigPath -RightPath $ExpectedRuntimeConfigPath)
    }

    $expectedCommits = @()
    foreach ($candidateCommit in @($ExpectedCurrentCommit, $ExpectedDesiredCommit)) {
        if (-not [string]::IsNullOrWhiteSpace([string]$candidateCommit)) {
            $expectedCommits += [string]$candidateCommit
        }
    }
    $commitOk = $true
    if ($expectedCommits.Count -gt 0) {
        $commitOk = $false
        foreach ($candidateCommit in ($expectedCommits | Sort-Object -Unique)) {
            if (
                [string]::Equals($currentCommit, $candidateCommit, [System.StringComparison]::OrdinalIgnoreCase) -or
                [string]::Equals($desiredCommit, $candidateCommit, [System.StringComparison]::OrdinalIgnoreCase)
            ) {
                $commitOk = $true
                break
            }
        }
    }

    $error = ''
    if (-not $fingerprintOk) {
        if (-not [string]::IsNullOrWhiteSpace($fingerprintError)) {
            $error = [string]$fingerprintError
        } else {
            $error = 'runtime_fingerprint_unavailable'
        }
    } elseif (-not $siteRootOk) {
        $error = 'site_root_mismatch'
    } elseif (-not $runtimeConfigOk) {
        $error = 'caddy_runtime_config_mismatch'
    } elseif (-not $commitOk) {
        $error = 'served_commit_mismatch'
    }

    return [PSCustomObject]@{
        Ok = $fingerprintOk -and $siteRootOk -and $runtimeConfigOk -and $commitOk
        Error = $error
        SiteRootOk = $siteRootOk
        CommitOk = $commitOk
        RuntimeConfigOk = $runtimeConfigOk
        SiteRoot = $siteRoot
        CurrentCommit = $currentCommit
        DesiredCommit = $desiredCommit
        StatusSource = $statusSource
        CaddyRuntimeConfigPath = $runtimeConfigPath
    }
}

function Test-HostingProcessExists {
    param([int]$ProcessId)

    if ($ProcessId -le 0) {
        return $false
    }

    try {
        return $null -ne (Get-Process -Id $ProcessId -ErrorAction Stop)
    } catch {
        return $false
    }
}

function Get-HostingProcessSnapshots {
    $result = @()

    $cimCommand = Get-Command Get-CimInstance -ErrorAction SilentlyContinue
    if ($null -ne $cimCommand) {
        try {
            return @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object {
                [PSCustomObject]@{
                    ProcessId = [int]$_.ProcessId
                    Name = [string]$_.Name
                    CommandLine = [string]$_.CommandLine
                }
            })
        } catch {
        }
    }

    $wmiCommand = Get-Command Get-WmiObject -ErrorAction SilentlyContinue
    if ($null -ne $wmiCommand) {
        try {
            return @(Get-WmiObject Win32_Process -ErrorAction SilentlyContinue | ForEach-Object {
                [PSCustomObject]@{
                    ProcessId = [int]$_.ProcessId
                    Name = [string]$_.Name
                    CommandLine = [string]$_.CommandLine
                }
            })
        } catch {
        }
    }

    $taskListCommand = Get-Command tasklist.exe -ErrorAction SilentlyContinue
    if ($null -ne $taskListCommand) {
        $taskList = Invoke-HostingCommandWithOutput -FilePath $taskListCommand.Source -Arguments @('/FO', 'CSV', '/NH')
        if ($taskList.ExitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($taskList.Output)) {
            foreach ($line in ($taskList.Output -split "`r?`n")) {
                if ([string]::IsNullOrWhiteSpace($line)) {
                    continue
                }
                try {
                    $fields = ConvertFrom-Csv -InputObject $line -Header 'ImageName', 'PID', 'SessionName', 'SessionNum', 'MemUsage'
                    $result += [PSCustomObject]@{
                        ProcessId = [int]$fields.PID
                        Name = [string]$fields.ImageName
                        CommandLine = ''
                    }
                } catch {
                }
            }
        }
    }

    return @($result)
}

function Test-HostingCommandLineMatch {
    param(
        [string]$CommandLine,
        [string[]]$Needles
    )

    if ([string]::IsNullOrWhiteSpace($CommandLine)) {
        return $false
    }

    foreach ($needle in $Needles) {
        if ([string]::IsNullOrWhiteSpace($needle)) {
            continue
        }
        if ($CommandLine.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
            return $false
        }
    }

    return $true
}

function Get-HostingProcessesByNeedle {
    param([string[]]$Needles)

    return @(Get-HostingProcessSnapshots | Where-Object {
        $commandLine = [string]$_.CommandLine
        if (-not [string]::IsNullOrWhiteSpace($commandLine)) {
            return (Test-HostingCommandLineMatch -CommandLine $commandLine -Needles $Needles)
        }

        foreach ($needle in $Needles) {
            if ([string]::IsNullOrWhiteSpace($needle)) {
                continue
            }
            if ([string]$_.Name -like "*$needle*") {
                return $true
            }
        }

        return $false
    })
}

function Stop-HostingProcessesByNeedle {
    param(
        [string[]]$Needles,
        [string]$Label = 'process'
    )

    foreach ($match in (Get-HostingProcessesByNeedle -Needles $Needles)) {
        try {
            Stop-Process -Id ([int]$match.ProcessId) -Force -ErrorAction SilentlyContinue
        } catch {
        }
    }
}

function Parse-HostingTcpEndpoint {
    param([string]$Endpoint)

    if ([string]::IsNullOrWhiteSpace($Endpoint)) {
        return $null
    }

    $trimmed = $Endpoint.Trim()
    $lastColon = $trimmed.LastIndexOf(':')
    if ($lastColon -lt 0 -or $lastColon -ge ($trimmed.Length - 1)) {
        return $null
    }

    $address = $trimmed.Substring(0, $lastColon).Trim('[', ']')
    $portText = $trimmed.Substring($lastColon + 1)
    $port = 0
    if (-not [int]::TryParse($portText, [ref]$port)) {
        return $null
    }

    return [PSCustomObject]@{
        Address = $address
        Port = $port
    }
}

function Get-HostingListeningTcpEntries {
    $netTcpCommand = Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue
    if ($null -ne $netTcpCommand) {
        try {
            return @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
                [PSCustomObject]@{
                    LocalAddress = [string]$_.LocalAddress
                    LocalPort = [int]$_.LocalPort
                    OwningProcess = [int]$_.OwningProcess
                }
            })
        } catch {
        }
    }

    $netstatCommand = Get-Command netstat.exe -ErrorAction SilentlyContinue
    if ($null -eq $netstatCommand) {
        return @()
    }

    $result = Invoke-HostingCommandWithOutput -FilePath $netstatCommand.Source -Arguments @('-ano', '-p', 'tcp')
    if ($result.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($result.Output)) {
        return @()
    }

    $entries = @()
    foreach ($line in ($result.Output -split "`r?`n")) {
        if ($line -notmatch '^\s*TCP\s+(\S+)\s+(\S+)\s+(LISTENING|ESCUCHANDO)\s+(\d+)\s*$') {
            continue
        }

        $local = Parse-HostingTcpEndpoint -Endpoint $matches[1]
        if ($null -eq $local) {
            continue
        }

        $processId = 0
        [void][int]::TryParse($matches[4], [ref]$processId)
        $entries += [PSCustomObject]@{
            LocalAddress = [string]$local.Address
            LocalPort = [int]$local.Port
            OwningProcess = [int]$processId
        }
    }

    return @($entries)
}

function Get-HostingListeningTcpEntry {
    param(
        [int]$Port,
        [string[]]$Addresses = @('127.0.0.1', '::1', '0.0.0.0', '::')
    )

    return Get-HostingListeningTcpEntries |
        Where-Object {
            ($_.LocalPort -eq $Port) -and ($Addresses -contains [string]$_.LocalAddress)
        } |
        Select-Object -First 1
}

function Get-HostingProcessByIdSafe {
    param([int]$ProcessId)

    if ($ProcessId -le 0) {
        return $null
    }

    return Get-HostingProcessSnapshots |
        Where-Object { [int]$_.ProcessId -eq $ProcessId } |
        Select-Object -First 1
}

function Get-HostingScheduledTaskSafe {
    param([string]$TaskName)

    $scheduledTaskCommand = Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue
    if ($null -ne $scheduledTaskCommand) {
        try {
            return Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
        } catch {
        }
    }

    $schtasksCommand = Get-Command schtasks.exe -ErrorAction SilentlyContinue
    if ($null -eq $schtasksCommand) {
        return $null
    }

    $query = Invoke-HostingCommandWithOutput -FilePath $schtasksCommand.Source -Arguments @('/Query', '/TN', $TaskName, '/FO', 'LIST')
    if ($query.ExitCode -ne 0) {
        return $null
    }

    $state = ''
    foreach ($line in ($query.Output -split "`r?`n")) {
        if ($line -match '^\s*Status:\s*(.+?)\s*$') {
            $state = $matches[1].Trim()
            break
        }
    }

    return [PSCustomObject]@{
        TaskName = $TaskName
        State = $state
    }
}

function Stop-HostingScheduledTaskIfPresent {
    param([string]$TaskName)

    $task = Get-HostingScheduledTaskSafe -TaskName $TaskName
    if ($null -eq $task) {
        return $false
    }

    $stopCommand = Get-Command Stop-ScheduledTask -ErrorAction SilentlyContinue
    if ($null -ne $stopCommand -and $task.PSObject.TypeNames -contains 'Microsoft.Management.Infrastructure.CimInstance#Root/Microsoft/Windows/TaskScheduler/MSFT_ScheduledTask') {
        try {
            Stop-ScheduledTask -InputObject $task -ErrorAction SilentlyContinue
            return $true
        } catch {
        }
    }

    $schtasksCommand = Get-Command schtasks.exe -ErrorAction SilentlyContinue
    if ($null -ne $schtasksCommand) {
        $stop = Invoke-HostingCommandWithOutput -FilePath $schtasksCommand.Source -Arguments @('/End', '/TN', $TaskName)
        return ($stop.ExitCode -eq 0)
    }

    return $false
}

function Remove-HostingScheduledTaskIfPresent {
    param([string]$TaskName)

    $task = Get-HostingScheduledTaskSafe -TaskName $TaskName
    if ($null -eq $task) {
        return $false
    }

    $unregisterCommand = Get-Command Unregister-ScheduledTask -ErrorAction SilentlyContinue
    if ($null -ne $unregisterCommand -and $task.PSObject.TypeNames -contains 'Microsoft.Management.Infrastructure.CimInstance#Root/Microsoft/Windows/TaskScheduler/MSFT_ScheduledTask') {
        try {
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
            return $true
        } catch {
        }
    }

    $schtasksCommand = Get-Command schtasks.exe -ErrorAction SilentlyContinue
    if ($null -ne $schtasksCommand) {
        $delete = Invoke-HostingCommandWithOutput -FilePath $schtasksCommand.Source -Arguments @('/Delete', '/F', '/TN', $TaskName)
        return ($delete.ExitCode -eq 0)
    }

    return $false
}

function Get-HostingPathAgeSeconds {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return 0
    }

    try {
        $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
        return [int][Math]::Max(0, ([DateTimeOffset]::Now - [DateTimeOffset]$item.LastWriteTimeUtc).TotalSeconds)
    } catch {
        return 0
    }
}

function Get-HostingLockInfoPath {
    param([string]$LockDirectoryPath)

    return Join-Path $LockDirectoryPath 'owner.json'
}

function Get-HostingDirectoryLockSnapshot {
    param(
        [string]$LockDirectoryPath,
        [int]$TtlSeconds = 600,
        [int]$GraceSeconds = 5
    )

    $lockExists = Test-Path -LiteralPath $LockDirectoryPath
    $infoPath = Get-HostingLockInfoPath -LockDirectoryPath $LockDirectoryPath
    $snapshot = [ordered]@{
        exists = $lockExists
        path_kind = 'missing'
        owner_pid = 0
        started_at = ''
        age_seconds = 0
        owner_active = $false
        stale = $false
        lock_state = 'missing'
        lock_reason = ''
        info_path = $infoPath
    }

    if (-not $lockExists) {
        return [PSCustomObject]$snapshot
    }

    $lockItem = $null
    try {
        $lockItem = Get-Item -LiteralPath $LockDirectoryPath -Force -ErrorAction Stop
    } catch {
        $snapshot.exists = $false
        return [PSCustomObject]$snapshot
    }

    $snapshot.lock_state = 'present'
    $snapshot.lock_reason = 'metadata_missing'
    $snapshot.age_seconds = Get-HostingPathAgeSeconds -Path $LockDirectoryPath
    if ($lockItem.PSIsContainer) {
        $snapshot.path_kind = 'directory'
    } else {
        $snapshot.path_kind = 'file'
        $snapshot.lock_state = 'stale_legacy_file'
        $snapshot.lock_reason = 'legacy_file_lock'
        $snapshot.stale = $true
        return [PSCustomObject]$snapshot
    }

    $payload = Read-HostingJsonFileSafe -Path $infoPath
    if ($null -ne $payload) {
        try { $snapshot.owner_pid = [int]$payload.owner_pid } catch {}
        try { $snapshot.started_at = [string]$payload.started_at } catch {}
        try {
            if (-not [string]::IsNullOrWhiteSpace([string]$payload.lock_reason)) {
                $snapshot.lock_reason = [string]$payload.lock_reason
            } elseif (-not [string]::IsNullOrWhiteSpace([string]$payload.reason)) {
                $snapshot.lock_reason = [string]$payload.reason
            }
        } catch {}
        try {
            if (-not [string]::IsNullOrWhiteSpace([string]$payload.lock_state)) {
                $snapshot.lock_state = [string]$payload.lock_state
            }
        } catch {}
    }

    if (-not [string]::IsNullOrWhiteSpace($snapshot.started_at)) {
        try {
            $startedAt = [DateTimeOffset]::Parse($snapshot.started_at)
            $snapshot.age_seconds = [int][Math]::Max(0, ([DateTimeOffset]::Now - $startedAt).TotalSeconds)
        } catch {
            $snapshot.started_at = ''
        }
    }

    if ($snapshot.owner_pid -gt 0) {
        $snapshot.owner_active = Test-HostingProcessExists -ProcessId $snapshot.owner_pid
        if ($snapshot.owner_active) {
            $snapshot.lock_state = 'owned'
            if ([string]::IsNullOrWhiteSpace($snapshot.lock_reason)) {
                $snapshot.lock_reason = 'owned_by_process'
            }
        } else {
            $snapshot.lock_state = 'stale_owner_missing'
            if ([string]::IsNullOrWhiteSpace($snapshot.lock_reason)) {
                $snapshot.lock_reason = 'owner_missing'
            }
            $snapshot.stale = $true
        }
    } else {
        if ($snapshot.age_seconds -ge $GraceSeconds) {
            $snapshot.lock_state = 'stale_metadata_missing'
            if ([string]::IsNullOrWhiteSpace($snapshot.lock_reason)) {
                $snapshot.lock_reason = 'metadata_missing'
            }
            $snapshot.stale = $true
        } else {
            $snapshot.lock_state = 'transient'
            if ([string]::IsNullOrWhiteSpace($snapshot.lock_reason)) {
                $snapshot.lock_reason = 'metadata_missing'
            }
        }
    }

    if (($snapshot.owner_pid -gt 0) -and ($snapshot.age_seconds -ge $TtlSeconds)) {
        $snapshot.lock_state = 'stale_ttl'
        $snapshot.lock_reason = 'ttl_expired'
        $snapshot.stale = $true
    }

    return [PSCustomObject]$snapshot
}

function Remove-HostingDirectoryLock {
    param(
        [string]$LockDirectoryPath,
        [int]$OwnerPid = 0,
        [switch]$Force
    )

    if (-not (Test-Path -LiteralPath $LockDirectoryPath)) {
        return $false
    }

    $snapshot = Get-HostingDirectoryLockSnapshot -LockDirectoryPath $LockDirectoryPath
    $canRemove = $Force.IsPresent
    if (-not $canRemove) {
        if ($snapshot.owner_pid -le 0) {
            $canRemove = $true
        } elseif ($OwnerPid -gt 0 -and $snapshot.owner_pid -eq $OwnerPid) {
            $canRemove = $true
        } elseif (-not (Test-HostingProcessExists -ProcessId $snapshot.owner_pid)) {
            $canRemove = $true
        }
    }

    if (-not $canRemove) {
        return $false
    }

    try {
        Remove-Item -LiteralPath $LockDirectoryPath -Recurse -Force -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Repair-HostingLegacyLocks {
    param(
        [string[]]$LockPaths,
        [int]$TtlSeconds = 600,
        [int]$GraceSeconds = 5
    )

    $removedPaths = New-Object System.Collections.ArrayList
    $remainingPaths = New-Object System.Collections.ArrayList
    $repairReasons = New-Object System.Collections.ArrayList
    $repaired = $false
    $remainingInvalidLock = $false
    $errorText = ''

    foreach ($lockPath in ($LockPaths | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)) {
        $snapshot = Get-HostingDirectoryLockSnapshot `
            -LockDirectoryPath $lockPath `
            -TtlSeconds $TtlSeconds `
            -GraceSeconds $GraceSeconds

        $legacyPaths = @(
            $lockPath,
            (Get-HostingLockInfoPath -LockDirectoryPath $lockPath),
            ($lockPath + '.json')
        ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique

        $shouldRepair = $false
        if ($snapshot.exists) {
            if ($snapshot.stale -or ($snapshot.owner_pid -le 0) -or ($snapshot.path_kind -ne 'directory')) {
                $shouldRepair = $true
            }
        } else {
            foreach ($legacyPath in $legacyPaths) {
                if (Test-Path -LiteralPath $legacyPath) {
                    $shouldRepair = $true
                    break
                }
            }
        }

        if ($shouldRepair) {
            foreach ($legacyPath in $legacyPaths) {
                if (-not (Test-Path -LiteralPath $legacyPath)) {
                    continue
                }

                try {
                    Remove-Item -LiteralPath $legacyPath -Recurse -Force -ErrorAction Stop
                    $removedPaths.Add([string]$legacyPath) | Out-Null
                    $repaired = $true
                } catch {
                    if ([string]::IsNullOrWhiteSpace($errorText)) {
                        $errorText = $_.Exception.Message
                    }
                }
            }

            $reason = [string]$snapshot.lock_reason
            if ([string]::IsNullOrWhiteSpace($reason)) {
                $reason = [string]$snapshot.lock_state
            }
            if ([string]::IsNullOrWhiteSpace($reason)) {
                $reason = 'legacy_lock_artifact'
            }
            $repairReasons.Add($reason) | Out-Null
        }

        $postSnapshot = Get-HostingDirectoryLockSnapshot `
            -LockDirectoryPath $lockPath `
            -TtlSeconds $TtlSeconds `
            -GraceSeconds $GraceSeconds
        if ($postSnapshot.exists -and ($postSnapshot.owner_pid -le 0) -and ($postSnapshot.path_kind -ne 'directory' -or $postSnapshot.stale -or ($postSnapshot.lock_state -ne 'owned'))) {
            $remainingInvalidLock = $true
            $remainingPaths.Add([string]$lockPath) | Out-Null
        }
    }

    return [PSCustomObject]@{
        repaired = $repaired
        removed_paths = @($removedPaths)
        remaining_invalid_lock = $remainingInvalidLock
        remaining_paths = @($remainingPaths)
        repair_reason = (@($repairReasons) | Sort-Object -Unique) -join ','
        error = $errorText
    }
}

function Acquire-HostingDirectoryLock {
    param(
        [string]$LockDirectoryPath,
        [int]$TtlSeconds = 600,
        [int]$GraceSeconds = 5,
        [string]$Reason = ''
    )

    Ensure-HostingParentDirectory -Path $LockDirectoryPath

    $maxAttempts = [int][Math]::Max(3, ([Math]::Ceiling([double]$GraceSeconds * 4.0) + 1))
    foreach ($attempt in 1..$maxAttempts) {
        try {
            New-Item -ItemType Directory -Path $LockDirectoryPath -ErrorAction Stop | Out-Null
            $startedAt = [DateTimeOffset]::Now.ToString('o')
            $lockReason = $Reason
            if ([string]::IsNullOrWhiteSpace($lockReason)) {
                $lockReason = 'lock_acquired'
            }
            Write-HostingJsonFile -Path (Get-HostingLockInfoPath -LockDirectoryPath $LockDirectoryPath) -Payload ([ordered]@{
                owner_pid = $PID
                started_at = $startedAt
                lock_state = 'owned'
                lock_reason = $lockReason
            })
            return [PSCustomObject]@{
                Acquired = $true
                Snapshot = [PSCustomObject]@{
                    exists = $true
                    owner_pid = $PID
                    started_at = $startedAt
                    age_seconds = 0
                    owner_active = $true
                    stale = $false
                    lock_state = 'owned'
                    lock_reason = $lockReason
                    info_path = (Get-HostingLockInfoPath -LockDirectoryPath $LockDirectoryPath)
                }
            }
        } catch {
            $snapshot = Get-HostingDirectoryLockSnapshot `
                -LockDirectoryPath $LockDirectoryPath `
                -TtlSeconds $TtlSeconds `
                -GraceSeconds $GraceSeconds

            if ($snapshot.stale -and $attempt -lt $maxAttempts) {
                Remove-HostingDirectoryLock -LockDirectoryPath $LockDirectoryPath -Force | Out-Null
                Start-Sleep -Milliseconds 250
                continue
            }

            if (($snapshot.owner_pid -le 0) -and ($snapshot.lock_state -eq 'transient') -and $attempt -lt $maxAttempts) {
                Start-Sleep -Milliseconds 250
                continue
            }

            return [PSCustomObject]@{
                Acquired = $false
                Snapshot = $snapshot
            }
        }
    }

    return [PSCustomObject]@{
        Acquired = $false
        Snapshot = (Get-HostingDirectoryLockSnapshot `
            -LockDirectoryPath $LockDirectoryPath `
            -TtlSeconds $TtlSeconds `
            -GraceSeconds $GraceSeconds)
    }
}
