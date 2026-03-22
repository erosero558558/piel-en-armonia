param(
    [string]$PublicDomain = 'pielarmonia.com',
    [string]$WwwDomain = 'www.pielarmonia.com',
    [string]$TunnelId = 'a2067e67-a462-41de-9d43-97cd7df4bda0',
    [string]$OperatorUserProfile = '',
    [string]$MirrorRepoPath = 'C:\dev\pielarmonia-clean-main',
    [string]$ExternalEnvPath = 'C:\ProgramData\Pielarmonia\hosting\env.php',
    [string]$ReleaseTargetPath = 'C:\ProgramData\Pielarmonia\hosting\release-target.runtime.json',
    [switch]$RouteDns,
    [switch]$OverwriteDns,
    [switch]$BootstrapMirrorNow,
    [switch]$StartSupervisorNow,
    [switch]$SkipBootstrapSync,
    [switch]$StartNow
)

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'
if (-not (Test-Path -LiteralPath $commonScriptPath)) {
    throw "No existe el modulo comun de hosting Windows: $commonScriptPath"
}
. $commonScriptPath
$bootstrapSyncScriptPath = Join-Path $repoRoot 'scripts\ops\setup\SINCRONIZAR-HOSTING-WINDOWS.ps1'
$mirrorRepoPathResolved = [System.IO.Path]::GetFullPath($MirrorRepoPath)
$mirrorStartScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\ops\setup\ARRANCAR-HOSTING-WINDOWS.ps1'
$mirrorSyncScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\ops\setup\SINCRONIZAR-HOSTING-WINDOWS.ps1'
$mirrorSupervisorScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\ops\setup\SUPERVISAR-HOSTING-WINDOWS.ps1'
$mirrorRepairScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\ops\setup\REPARAR-HOSTING-WINDOWS.ps1'
$runtimeRoot = Join-Path $repoRoot 'data\runtime\hosting'
$startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$startupCmdPath = Join-Path $startupDir 'Pielarmonia Hosting Supervisor.cmd'
$loginLauncherPath = Join-Path $runtimeRoot 'login-stack.cmd'
$bootLauncherPath = Join-Path $runtimeRoot 'boot-stack.cmd'
$supervisorLauncherPath = Join-Path $runtimeRoot 'supervisor.cmd'
$mainSyncLauncherPath = Join-Path $runtimeRoot 'main-sync.cmd'
$repairLauncherPath = Join-Path $runtimeRoot 'repair-hosting.cmd'
$supervisorTaskName = 'Pielarmonia Hosting Supervisor'
$mainSyncTaskName = 'Pielarmonia Hosting Main Sync'
$legacyBootTaskName = 'Pielarmonia Hosting Stack'
$runKeyPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runKeyName = 'PielarmoniaHostingSupervisor'
$resolvedOperatorUserProfile = if ([string]::IsNullOrWhiteSpace($OperatorUserProfile)) {
    $env:USERPROFILE
} else {
    [System.IO.Path]::GetFullPath($OperatorUserProfile)
}

function Write-Info {
    param([string]$Message)

    Write-Host "[hosting-config] $Message"
}

function Test-IsElevated {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function ConvertTo-CommandToken {
    param([string]$Value)

    if ($null -eq $Value) {
        return '""'
    }

    if ($Value -match '[\s"]') {
        return '"' + $Value.Replace('"', '\"') + '"'
    }

    return $Value
}

function New-StartCommand {
    param([string[]]$StartArguments)

    $escaped = foreach ($argument in $StartArguments) {
        ConvertTo-CommandToken -Value ([string]$argument)
    }

    return 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ' + ($escaped -join ' ')
}

function Write-LauncherScript {
    param(
        [string]$Path,
        [string]$Command
    )

    $parentDir = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }

    Set-Content -Path $Path -Value "@echo off`r`n$Command`r`n" -Encoding ASCII
}

function Invoke-Schtasks {
    param([string[]]$Arguments)

    $escapedArguments = foreach ($argument in $Arguments) {
        if ($null -eq $argument) {
            continue
        }

        $value = [string]$argument
        if ($value -match '[\s"]') {
            '"' + $value.Replace('"', '\"') + '"'
        } else {
            $value
        }
    }

    $commandLine = 'schtasks.exe ' + ($escapedArguments -join ' ')
    $output = & cmd.exe /d /c $commandLine 2>&1
    $exitCode = $LASTEXITCODE
    return [PSCustomObject]@{
        ExitCode = $exitCode
        Output = @($output) -join [Environment]::NewLine
    }
}

function Invoke-BootstrapSync {
    param(
        [string]$ScriptPath,
        [string]$MirrorPath,
        [string]$EnvPath,
        [string]$CurrentReleaseTargetPath,
        [string]$Domain,
        [string]$CurrentTunnelId,
        [string]$CurrentOperatorUserProfile,
        [string]$CurrentCaddyExePath,
        [string]$CurrentCloudflaredExePath,
        [string]$CurrentPhpCgiExePath
    )

    $arguments = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $ScriptPath,
        '-MirrorRepoPath', $MirrorPath,
        '-ExternalEnvPath', $EnvPath,
        '-ReleaseTargetPath', $CurrentReleaseTargetPath,
        '-PublicDomain', $Domain,
        '-TunnelId', $CurrentTunnelId,
        '-OperatorUserProfile', $CurrentOperatorUserProfile,
        '-CaddyExePath', $CurrentCaddyExePath,
        '-CloudflaredExePath', $CurrentCloudflaredExePath,
        '-PhpCgiExePath', $CurrentPhpCgiExePath,
        '-BootstrapReleaseTargetIfMissing'
    )

    Write-Info "Bootstrapping mirror limpio: $MirrorPath"
    & powershell.exe @arguments
    if ($LASTEXITCODE -ne 0) {
        throw 'No se pudo bootstrapear el mirror limpio de hosting.'
    }
}

if ($StartNow) {
    $BootstrapMirrorNow = $true
    $StartSupervisorNow = $true
}

if (-not (Test-Path -LiteralPath $bootstrapSyncScriptPath)) {
    throw "No existe el script de sync canonico: $bootstrapSyncScriptPath"
}

if (-not (Test-Path -LiteralPath $ExternalEnvPath)) {
    throw "No existe el env externo canonico: $ExternalEnvPath"
}

$caddyExePath = (Get-Command caddy -ErrorAction Stop).Source
$cloudflaredExePath = (Get-Command cloudflared -ErrorAction Stop).Source
$phpCgiExePath = (Get-Command 'php-cgi' -ErrorAction Stop).Source

$mirrorRepoReady = Test-Path -LiteralPath (Join-Path $mirrorRepoPathResolved '.git')
if ((-not $mirrorRepoReady) -and $SkipBootstrapSync) {
    throw "No existe el mirror limpio en $mirrorRepoPathResolved y se solicito -SkipBootstrapSync."
}

$shouldBootstrapMirror = $BootstrapMirrorNow -or ((-not $mirrorRepoReady) -and (-not $SkipBootstrapSync))
if ($shouldBootstrapMirror) {
    Invoke-BootstrapSync `
        -ScriptPath $bootstrapSyncScriptPath `
        -MirrorPath $mirrorRepoPathResolved `
        -EnvPath $ExternalEnvPath `
        -CurrentReleaseTargetPath $ReleaseTargetPath `
        -Domain $PublicDomain `
        -CurrentTunnelId $TunnelId `
        -CurrentOperatorUserProfile $resolvedOperatorUserProfile `
        -CurrentCaddyExePath $caddyExePath `
        -CurrentCloudflaredExePath $cloudflaredExePath `
        -CurrentPhpCgiExePath $phpCgiExePath
}

foreach ($requiredPath in @($mirrorStartScriptPath, $mirrorSyncScriptPath, $mirrorSupervisorScriptPath, $mirrorRepairScriptPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "El mirror limpio no expone el script requerido: $requiredPath"
    }
}

$commonSupervisorArguments = @(
    $mirrorSupervisorScriptPath,
    '-MirrorRepoPath', $mirrorRepoPathResolved,
    '-ExternalEnvPath', $ExternalEnvPath,
    '-ReleaseTargetPath', $ReleaseTargetPath,
    '-PublicDomain', $PublicDomain,
    '-TunnelId', $TunnelId,
    '-OperatorUserProfile', $resolvedOperatorUserProfile,
    '-CaddyExePath', $caddyExePath,
    '-CloudflaredExePath', $cloudflaredExePath,
    '-PhpCgiExePath', $phpCgiExePath,
    '-Quiet'
)
$commonSyncArguments = @(
    $mirrorSyncScriptPath,
    '-MirrorRepoPath', $mirrorRepoPathResolved,
    '-ExternalEnvPath', $ExternalEnvPath,
    '-ReleaseTargetPath', $ReleaseTargetPath,
    '-PublicDomain', $PublicDomain,
    '-TunnelId', $TunnelId,
    '-OperatorUserProfile', $resolvedOperatorUserProfile,
    '-CaddyExePath', $caddyExePath,
    '-CloudflaredExePath', $cloudflaredExePath,
    '-PhpCgiExePath', $phpCgiExePath,
    '-Quiet'
)
$commonRepairArguments = @(
    $mirrorRepairScriptPath,
    '-MirrorRepoPath', $mirrorRepoPathResolved,
    '-ExternalEnvPath', $ExternalEnvPath,
    '-ReleaseTargetPath', $ReleaseTargetPath,
    '-PublicDomain', $PublicDomain,
    '-TunnelId', $TunnelId,
    '-OperatorUserProfile', $resolvedOperatorUserProfile,
    '-CaddyExePath', $caddyExePath,
    '-CloudflaredExePath', $cloudflaredExePath,
    '-PhpCgiExePath', $phpCgiExePath
)

$supervisorCommand = New-StartCommand -StartArguments $commonSupervisorArguments
$mainSyncCommand = New-StartCommand -StartArguments $commonSyncArguments
$repairCommand = New-StartCommand -StartArguments $commonRepairArguments
$supervisorLauncherCommand = ConvertTo-CommandToken -Value ([System.IO.Path]::GetFullPath($supervisorLauncherPath))
$mainSyncLauncherCommand = ConvertTo-CommandToken -Value ([System.IO.Path]::GetFullPath($mainSyncLauncherPath))

Write-LauncherScript -Path $supervisorLauncherPath -Command $supervisorCommand
Write-LauncherScript -Path $mainSyncLauncherPath -Command $mainSyncCommand
Write-LauncherScript -Path $repairLauncherPath -Command $repairCommand
Write-LauncherScript -Path $loginLauncherPath -Command ("call " + $supervisorLauncherCommand)
Write-LauncherScript -Path $bootLauncherPath -Command ("call " + $supervisorLauncherCommand)
Write-Info "Launcher supervisor actualizado: $supervisorLauncherPath"
Write-Info "Launcher sync actualizado: $mainSyncLauncherPath"
Write-Info "Launcher repair actualizado: $repairLauncherPath"
Write-Info "Launcher login actualizado: $loginLauncherPath"
Write-Info "Launcher boot actualizado: $bootLauncherPath"

if (-not (Test-Path -LiteralPath $startupDir)) {
    New-Item -ItemType Directory -Path $startupDir -Force | Out-Null
}

$startupCommand = 'call ' + $supervisorLauncherCommand
Set-Content -Path $startupCmdPath -Value "@echo off`r`n$startupCommand`r`n" -Encoding ASCII
Write-Info "Startup shim actualizado: $startupCmdPath"

if (-not (Test-Path -LiteralPath $runKeyPath)) {
    New-Item -Path $runKeyPath -Force | Out-Null
}

if ($null -ne (Get-ItemProperty -Path $runKeyPath -Name $runKeyName -ErrorAction SilentlyContinue)) {
    Set-ItemProperty -Path $runKeyPath -Name $runKeyName -Value $supervisorLauncherCommand
} else {
    New-ItemProperty -Path $runKeyPath -Name $runKeyName -Value $supervisorLauncherCommand -PropertyType String | Out-Null
}
Write-Info "Registro HKCU\\Run actualizado: $runKeyName"

if (Test-IsElevated) {
    $supervisorTaskArgs = @(
        '/Create',
        '/F',
        '/SC', 'ONSTART',
        '/RL', 'HIGHEST',
        '/RU', 'SYSTEM',
        '/TN', $supervisorTaskName,
        '/TR', $supervisorLauncherCommand
    )
    $mainSyncTaskArgs = @(
        '/Create',
        '/F',
        '/SC', 'MINUTE',
        '/MO', '1',
        '/RL', 'HIGHEST',
        '/RU', 'SYSTEM',
        '/TN', $mainSyncTaskName,
        '/TR', $mainSyncLauncherCommand
    )

    try {
        $legacyDelete = Invoke-Schtasks -Arguments @('/Delete', '/F', '/TN', $legacyBootTaskName)
        if ($legacyDelete.ExitCode -eq 0) {
            Write-Info "Tarea legacy eliminada: $legacyBootTaskName"
        }
    } catch {
    }

    try {
        $supervisorTaskResult = Invoke-Schtasks -Arguments $supervisorTaskArgs
        if ($supervisorTaskResult.ExitCode -eq 0) {
            Write-Info "Tarea programada de supervisor instalada: $supervisorTaskName"
        } else {
            Write-Warning ("No se pudo registrar la tarea de supervisor. {0}" -f $supervisorTaskResult.Output.Trim())
        }
    } catch {
        Write-Warning ("No se pudo registrar la tarea de supervisor. {0}" -f $_.Exception.Message.Trim())
    }

    try {
        $mainSyncTaskResult = Invoke-Schtasks -Arguments $mainSyncTaskArgs
        if ($mainSyncTaskResult.ExitCode -eq 0) {
            Write-Info "Tarea programada de sync instalada: $mainSyncTaskName"
        } else {
            Write-Warning ("No se pudo registrar la tarea de sync por minuto. {0}" -f $mainSyncTaskResult.Output.Trim())
        }
    } catch {
        Write-Warning ("No se pudo registrar la tarea de sync por minuto. {0}" -f $_.Exception.Message.Trim())
    }
} else {
    Write-Warning 'La sesion actual no esta elevada. Startup + HKCU\\Run lanzaran el supervisor al iniciar sesion, pero las tareas de supervisor/sync requieren reejecutar este script como Administrador.'
}

if ($StartSupervisorNow) {
    Start-Process -FilePath $supervisorLauncherPath -WindowStyle Hidden | Out-Null
    Write-Info 'Supervisor lanzado en la sesion actual.'
}

if ($RouteDns) {
    $dnsArgs = @()
    if ($OverwriteDns) {
        $dnsArgs += '--overwrite-dns'
    }

    & cloudflared tunnel route dns @dnsArgs $TunnelId $PublicDomain
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo enrutar DNS para $PublicDomain"
    }
    Write-Info "DNS del dominio principal apuntado al tunnel: $PublicDomain"

    & cloudflared tunnel route dns @dnsArgs $TunnelId $WwwDomain
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo enrutar DNS para $WwwDomain"
    }
    Write-Info "DNS del dominio www apuntado al tunnel: $WwwDomain"
}
