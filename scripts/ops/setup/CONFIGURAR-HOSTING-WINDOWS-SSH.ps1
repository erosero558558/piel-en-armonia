param(
    [string]$TargetUsername = 'ernes',
    [string]$AuthorizedPublicKey = '',
    [string]$AuthorizedPublicKeyPath = '',
    [string]$TunnelId = 'a2067e67-a462-41de-9d43-97cd7df4bda0',
    [string]$PrivateHostname = 'figo-ssh.pielarmonia.internal',
    [string]$ListenAddress = '127.0.0.1',
    [int]$Port = 22,
    [switch]$PromoteUserToAdministrators,
    [switch]$UseCurrentUserPublicKey,
    [switch]$SkipCloudflareChecks,
    [switch]$ValidateOnly,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

$cloudflaredCredentialPath = Join-Path $env:USERPROFILE ".cloudflared\$TunnelId.json"
$currentUserPublicKeyPath = Join-Path $env:USERPROFILE '.ssh\id_ed25519.pub'
$programDataSshRoot = Join-Path $env:ProgramData 'ssh'
$authorizedKeysPath = Join-Path $programDataSshRoot 'administrators_authorized_keys'
$sshdConfigPath = Join-Path $programDataSshRoot 'sshd_config'
$managedBlockStart = '# BEGIN PIELARMONIA MANAGED SSH'
$managedBlockEnd = '# END PIELARMONIA MANAGED SSH'
$machineQualifiedTargetUser = '{0}\{1}' -f $env:COMPUTERNAME, $TargetUsername
$administratorsSid = 'S-1-5-32-544'

$summary = [ordered]@{
    ok = $false
    validate_only = [bool]$ValidateOnly
    current_user = [string](whoami)
    target_username = $TargetUsername
    target_user_qualified = $machineQualifiedTargetUser
    is_admin_session = $false
    promote_user_requested = [bool]$PromoteUserToAdministrators
    private_hostname = $PrivateHostname
    tunnel_id = $TunnelId
    listen_address = $ListenAddress
    port = $Port
    client_command = ('ssh {0}@{1}' -f $TargetUsername, $PrivateHostname)
    cloudflared = [ordered]@{
        installed = $false
        version = ''
        upgrade_attempted = $false
        upgrade_succeeded = $false
        credential_path = $cloudflaredCredentialPath
        credential_present = $false
        tunnel_exists = $false
        route_ip_count = 0
        private_hostname_cli_supported = $false
        private_hostname_pending_manual = $true
    }
    openssh = [ordered]@{
        capability_name = ''
        installed = $false
        service_status = ''
        startup_type = ''
        listener_endpoints = @()
        config_path = $sshdConfigPath
        authorized_keys_path = $authorizedKeysPath
        authorized_key_loaded = $false
    }
    actions = New-Object 'System.Collections.Generic.List[string]'
    warnings = New-Object 'System.Collections.Generic.List[string]'
    problems = New-Object 'System.Collections.Generic.List[string]'
}

function Add-Action {
    param([string]$Message)

    $summary.actions.Add($Message) | Out-Null
    if (-not $Quiet) {
        Write-Host "[windows-hosting-ssh] $Message"
    }
}

function Add-WarningSummary {
    param([string]$Message)

    $summary.warnings.Add($Message) | Out-Null
    if (-not $Quiet) {
        Write-Warning $Message
    }
}

function Add-ProblemSummary {
    param([string]$Message)

    $summary.problems.Add($Message) | Out-Null
    if (-not $Quiet) {
        Write-Error $Message
    }
}

function Test-CurrentSessionAdmin {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-AdministratorsGroupName {
    try {
        $group = Get-LocalGroup -SID $administratorsSid -ErrorAction Stop
        if ($null -ne $group -and -not [string]::IsNullOrWhiteSpace([string]$group.Name)) {
            return [string]$group.Name
        }
    } catch {
    }

    $sid = New-Object Security.Principal.SecurityIdentifier($administratorsSid)
    $account = $sid.Translate([Security.Principal.NTAccount])
    $translated = [string]$account.Value
    if ($translated.Contains('\')) {
        return ($translated.Split('\')[-1])
    }

    return $translated
}

function Get-CommandPathMaybe {
    param([string]$CommandName)

    $command = Get-Command $CommandName -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $command) {
        return ''
    }

    return [string]$command.Source
}

function Test-LocalAdministratorsMembership {
    param([string]$Username)

    $administratorsGroupName = Get-AdministratorsGroupName
    try {
        $members = Get-LocalGroupMember -Group $administratorsGroupName -ErrorAction Stop
        foreach ($member in $members) {
            $name = [string]$member.Name
            if ([string]::Equals($name, $Username, [System.StringComparison]::OrdinalIgnoreCase)) {
                return $true
            }
            if ([string]::Equals($name, $machineQualifiedTargetUser, [System.StringComparison]::OrdinalIgnoreCase)) {
                return $true
            }
        }
    } catch {
        if ($ValidateOnly) {
            Add-WarningSummary ("No se pudo consultar la membresia de {0}: {1}" -f $administratorsGroupName, $_.Exception.Message)
            return $false
        }
        throw
    }

    return $false
}

function Resolve-AuthorizedPublicKey {
    if (-not [string]::IsNullOrWhiteSpace($AuthorizedPublicKey)) {
        return [string]$AuthorizedPublicKey.Trim()
    }

    if (-not [string]::IsNullOrWhiteSpace($AuthorizedPublicKeyPath)) {
        if (-not (Test-Path -LiteralPath $AuthorizedPublicKeyPath -PathType Leaf)) {
            throw "No existe AuthorizedPublicKeyPath=$AuthorizedPublicKeyPath"
        }
        return [string]((Get-Content -LiteralPath $AuthorizedPublicKeyPath -Raw -ErrorAction Stop).Trim())
    }

    if ($UseCurrentUserPublicKey) {
        if (-not (Test-Path -LiteralPath $currentUserPublicKeyPath -PathType Leaf)) {
            throw "No existe la clave publica del usuario actual: $currentUserPublicKeyPath"
        }
        return [string]((Get-Content -LiteralPath $currentUserPublicKeyPath -Raw -ErrorAction Stop).Trim())
    }

    return ''
}

function Ensure-CloudflaredVersionBestEffort {
    $summary.cloudflared.upgrade_attempted = $true
    $wingetPath = Get-CommandPathMaybe -CommandName 'winget'
    if ([string]::IsNullOrWhiteSpace($wingetPath)) {
        Add-WarningSummary 'winget no esta disponible; se omite el upgrade de cloudflared.'
        return
    }

    try {
        & $wingetPath upgrade --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements --silent | Out-Null
        $summary.cloudflared.upgrade_succeeded = $true
        Add-Action 'cloudflared actualizado con winget.'
    } catch {
        Add-WarningSummary ("No se pudo actualizar cloudflared automaticamente: {0}" -f $_.Exception.Message)
    }
}

function Get-CloudflaredFacts {
    if ($SkipCloudflareChecks) {
        Add-WarningSummary 'Se omitieron los checks de Cloudflare por flag.'
        return
    }

    $cloudflaredPath = Get-CommandPathMaybe -CommandName 'cloudflared'
    if ([string]::IsNullOrWhiteSpace($cloudflaredPath)) {
        Add-WarningSummary 'cloudflared no esta instalado en este host.'
        return
    }

    $summary.cloudflared.installed = $true
    $summary.cloudflared.credential_present = (Test-Path -LiteralPath $cloudflaredCredentialPath -PathType Leaf)

    try {
        $versionLine = [string]((& $cloudflaredPath --version | Select-Object -First 1) | Out-String).Trim()
        $summary.cloudflared.version = $versionLine
    } catch {
        Add-WarningSummary ("No se pudo leer la version de cloudflared: {0}" -f $_.Exception.Message)
    }

    try {
        $infoRaw = (& $cloudflaredPath tunnel info $TunnelId | Out-String)
        if ($infoRaw -match '(?im)^NAME:\s+') {
            $summary.cloudflared.tunnel_exists = $true
        }
    } catch {
        Add-WarningSummary ("No se pudo consultar el tunnel ${TunnelId}: {0}" -f $_.Exception.Message)
    }

    $routeOutput = ''
    $routeExitCode = 0
    $cloudflaredCommandForCmd = ('"{0}" tunnel route ip show 2>&1' -f $cloudflaredPath)
    $routeOutput = [string]((& cmd.exe /d /c $cloudflaredCommandForCmd | Out-String).Trim())
    $routeExitCode = [int]$LASTEXITCODE

    if ($routeOutput -match '(?im)^\s*\d+\.\d+\.\d+\.\d+/\d+') {
        $summary.cloudflared.route_ip_count = (@($routeOutput -split "`r?`n" | Where-Object { $_ -match '^\s*\d+\.\d+\.\d+\.\d+/\d+' })).Count
    } elseif (($routeExitCode -ne 0) -and ($routeOutput -notmatch 'No routes were found')) {
        Add-WarningSummary ("No se pudo consultar el routing privado de Cloudflare: {0}" -f $routeOutput)
    }

    Add-WarningSummary 'El hostname privado y la policy exacta de Zero Trust no se pueden provisionar desde este script con la CLI local actual; requieren dashboard o API token.'
}

function Get-OpenSshServerCapability {
    try {
        $capability = Get-WindowsCapability -Online -Name 'OpenSSH.Server*' -ErrorAction Stop | Select-Object -First 1
    } catch {
        if ($ValidateOnly) {
            Add-WarningSummary ("No se pudo consultar OpenSSH.Server sin elevacion: {0}" -f $_.Exception.Message)
            return $null
        }
        throw
    }

    if ($null -eq $capability) {
        return $null
    }

    $summary.openssh.capability_name = [string]$capability.Name
    $summary.openssh.installed = [string]::Equals([string]$capability.State, 'Installed', [System.StringComparison]::OrdinalIgnoreCase)
    return $capability
}

function Ensure-OpenSshServerInstalled {
    $capability = Get-OpenSshServerCapability
    if ($null -eq $capability) {
        throw 'No se encontro la capability OpenSSH.Server en este Windows.'
    }

    if ($summary.openssh.installed) {
        Add-Action 'OpenSSH Server ya estaba instalado.'
        return
    }

    Add-Action 'Instalando OpenSSH Server...'
    Add-WindowsCapability -Online -Name $capability.Name | Out-Null
    $capability = Get-OpenSshServerCapability
    if (-not $summary.openssh.installed) {
        throw 'OpenSSH Server no quedo instalado despues de Add-WindowsCapability.'
    }
}

function Ensure-TargetUserInAdministrators {
    $administratorsGroupName = Get-AdministratorsGroupName

    if (Test-LocalAdministratorsMembership -Username $TargetUsername) {
        Add-Action ("{0} ya pertenece a {1}." -f $machineQualifiedTargetUser, $administratorsGroupName)
        return
    }

    if (-not $PromoteUserToAdministrators) {
        throw ("{0} no pertenece a {1} y no se pidio -PromoteUserToAdministrators." -f $machineQualifiedTargetUser, $administratorsGroupName)
    }

    Add-Action ("Agregando {0} a {1}..." -f $machineQualifiedTargetUser, $administratorsGroupName)
    try {
        Add-LocalGroupMember -Group $administratorsGroupName -Member $machineQualifiedTargetUser -ErrorAction Stop
    } catch {
        & net localgroup $administratorsGroupName $machineQualifiedTargetUser /add | Out-Null
    }

    if (-not (Test-LocalAdministratorsMembership -Username $TargetUsername)) {
        throw ("No se pudo agregar {0} a {1}." -f $machineQualifiedTargetUser, $administratorsGroupName)
    }
}

function Remove-ManagedBlock {
    param([string]$Content)

    if ([string]::IsNullOrWhiteSpace($Content)) {
        return ''
    }

    $pattern = '(?ms)^\# BEGIN PIELARMONIA MANAGED SSH\r?\n.*?^\# END PIELARMONIA MANAGED SSH\r?\n?'
    return [regex]::Replace($Content, $pattern, '')
}

function Get-ManagedSshConfigBlock {
    return @"
$managedBlockStart
Port $Port
ListenAddress $ListenAddress
PasswordAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
PermitEmptyPasswords no
AllowUsers $TargetUsername
AuthorizedKeysFile __PROGRAMDATA__/ssh/administrators_authorized_keys
$managedBlockEnd
"@
}

function Merge-SshdConfigContent {
    param([string]$ExistingContent)

    $sanitized = Remove-ManagedBlock -Content $ExistingContent
    $lines = @()
    if (-not [string]::IsNullOrWhiteSpace($sanitized)) {
        $lines = @($sanitized -split "`r?`n")
    }

    $firstMatchIndex = -1
    for ($i = 0; $i -lt $lines.Count; $i += 1) {
        if ([string]$lines[$i] -match '^\s*Match\s+') {
            $firstMatchIndex = $i
            break
        }
    }

    $beforeMatch = @()
    $afterMatch = @()
    if ($firstMatchIndex -ge 0) {
        if ($firstMatchIndex -gt 0) {
            $beforeMatch = @($lines[0..($firstMatchIndex - 1)])
        }
        $afterMatch = @($lines[$firstMatchIndex..($lines.Count - 1)])
    } else {
        $beforeMatch = @($lines)
    }

    while (($beforeMatch.Count -gt 0) -and [string]::IsNullOrWhiteSpace([string]$beforeMatch[$beforeMatch.Count - 1])) {
        $beforeMatch = @($beforeMatch[0..($beforeMatch.Count - 2)])
    }
    while (($afterMatch.Count -gt 0) -and [string]::IsNullOrWhiteSpace([string]$afterMatch[0])) {
        if ($afterMatch.Count -eq 1) {
            $afterMatch = @()
        } else {
            $afterMatch = @($afterMatch[1..($afterMatch.Count - 1)])
        }
    }

    $parts = New-Object 'System.Collections.Generic.List[string]'
    if ($beforeMatch.Count -gt 0) {
        $parts.Add(($beforeMatch -join [Environment]::NewLine).TrimEnd()) | Out-Null
    }
    $parts.Add((Get-ManagedSshConfigBlock).TrimEnd()) | Out-Null
    if ($afterMatch.Count -gt 0) {
        $parts.Add(($afterMatch -join [Environment]::NewLine).Trim()) | Out-Null
    }

    return (($parts | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join ([Environment]::NewLine + [Environment]::NewLine)) + [Environment]::NewLine
}

function Ensure-SshdConfigFile {
    if (-not (Test-Path -LiteralPath $programDataSshRoot)) {
        New-Item -ItemType Directory -Path $programDataSshRoot -Force | Out-Null
    }

    if (-not (Test-Path -LiteralPath $sshdConfigPath -PathType Leaf)) {
        Set-Content -LiteralPath $sshdConfigPath -Value '' -Encoding ASCII
    }

    $existingContent = [string](Get-Content -LiteralPath $sshdConfigPath -Raw -ErrorAction Stop)
    $mergedContent = Merge-SshdConfigContent -ExistingContent $existingContent
    if (-not [string]::Equals($existingContent, $mergedContent, [System.StringComparison]::Ordinal)) {
        Set-Content -LiteralPath $sshdConfigPath -Value $mergedContent -Encoding ASCII
        Add-Action ("sshd_config actualizado en {0}." -f $sshdConfigPath)
    } else {
        Add-Action 'sshd_config ya estaba alineado.'
    }
}

function Ensure-AdministratorsAuthorizedKeys {
    param([string]$PublicKeyText)

    if (-not (Test-Path -LiteralPath $programDataSshRoot)) {
        New-Item -ItemType Directory -Path $programDataSshRoot -Force | Out-Null
    }

    if ([string]::IsNullOrWhiteSpace($PublicKeyText)) {
        throw 'No se recibio ninguna clave publica autorizada.'
    }
    if ($PublicKeyText -notmatch '^ssh-(ed25519|rsa|ecdsa) ') {
        throw 'La clave publica no parece un payload OpenSSH valido.'
    }

    $desiredContent = $PublicKeyText.Trim() + [Environment]::NewLine
    $currentContent = ''
    if (Test-Path -LiteralPath $authorizedKeysPath -PathType Leaf) {
        $currentContent = [string](Get-Content -LiteralPath $authorizedKeysPath -Raw -ErrorAction Stop)
    }

    if (-not [string]::Equals($currentContent, $desiredContent, [System.StringComparison]::Ordinal)) {
        Set-Content -LiteralPath $authorizedKeysPath -Value $desiredContent -Encoding ASCII
        Add-Action ("administrators_authorized_keys actualizado en {0}." -f $authorizedKeysPath)
    } else {
        Add-Action 'administrators_authorized_keys ya estaba alineado.'
    }

    & icacls.exe $authorizedKeysPath /inheritance:r /grant 'Administrators:F' /grant 'SYSTEM:F' | Out-Null
    $summary.openssh.authorized_key_loaded = $true
}

function Ensure-SshdServiceRunning {
    $service = Get-Service sshd -ErrorAction SilentlyContinue
    if ($null -eq $service) {
        throw 'El servicio sshd no existe aun; la instalacion de OpenSSH Server no termino correctamente.'
    }

    Set-Service -Name sshd -StartupType Automatic
    if ($service.Status -ne 'Running') {
        Start-Service sshd
    } else {
        Restart-Service sshd -Force
    }

    $service = Get-Service sshd -ErrorAction Stop
    $summary.openssh.service_status = [string]$service.Status
    $summary.openssh.startup_type = [string]((Get-CimInstance Win32_Service -Filter "Name='sshd'" -ErrorAction Stop).StartMode)
}

function Test-SshdConfigSyntax {
    $sshdExePath = 'C:\Windows\System32\OpenSSH\sshd.exe'
    if (-not (Test-Path -LiteralPath $sshdExePath -PathType Leaf)) {
        throw "No existe sshd.exe en $sshdExePath"
    }

    & $sshdExePath -t -f $sshdConfigPath
}

function Get-SshListenerEndpoints {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, OwningProcess)
    $summary.openssh.listener_endpoints = @($listeners | ForEach-Object {
        [ordered]@{
            local_address = [string]$_.LocalAddress
            local_port = [int]$_.LocalPort
            owning_process = [int]$_.OwningProcess
        }
    })
    return $listeners
}

function Validate-SshListenerIsolation {
    $listeners = @(Get-SshListenerEndpoints)
    if ($listeners.Count -eq 0) {
        throw ('sshd no esta escuchando en el puerto {0}.' -f $Port)
    }

    $invalidListeners = @($listeners | Where-Object {
        $localAddress = [string]$_.LocalAddress
        (-not [string]::Equals($localAddress, $ListenAddress, [System.StringComparison]::OrdinalIgnoreCase))
    })

    if ($invalidListeners.Count -gt 0) {
        throw ('sshd esta escuchando fuera de {0}: {1}' -f $ListenAddress, (($invalidListeners | ForEach-Object { [string]$_.LocalAddress }) -join ', '))
    }
}

$summary.is_admin_session = Test-CurrentSessionAdmin
Get-CloudflaredFacts

try {
    if ($summary.cloudflared.installed -and -not $ValidateOnly) {
        Ensure-CloudflaredVersionBestEffort
        Get-CloudflaredFacts
    }

    $capability = Get-OpenSshServerCapability
    if ($null -eq $capability) {
        Add-WarningSummary 'OpenSSH.Server capability no aparece en este Windows.'
    }

    if (-not (Test-LocalAdministratorsMembership -Username $TargetUsername)) {
        if ($ValidateOnly) {
            Add-WarningSummary ("{0} todavia no pertenece a Administrators." -f $machineQualifiedTargetUser)
        }
    }

    if ($ValidateOnly) {
        $summary.ok = ($summary.problems.Count -eq 0)
        $summary | ConvertTo-Json -Depth 8
        exit 0
    }

    if (-not $summary.is_admin_session) {
        throw 'Este script debe ejecutarse en una sesion elevada de PowerShell para aplicar cambios.'
    }

    $publicKeyText = Resolve-AuthorizedPublicKey
    if ([string]::IsNullOrWhiteSpace($publicKeyText)) {
        throw 'Debes pasar -AuthorizedPublicKey, -AuthorizedPublicKeyPath o -UseCurrentUserPublicKey.'
    }

    Ensure-TargetUserInAdministrators
    Ensure-OpenSshServerInstalled
    Ensure-SshdConfigFile
    Ensure-AdministratorsAuthorizedKeys -PublicKeyText $publicKeyText
    Test-SshdConfigSyntax
    Ensure-SshdServiceRunning
    Validate-SshListenerIsolation

    $summary.openssh.installed = $true
    $summary.ok = $true
} catch {
    $summary.ok = $false
    $summary.problems.Add([string]$_.Exception.Message) | Out-Null
} finally {
    if (-not [string]::IsNullOrWhiteSpace([string]$summary.openssh.service_status)) {
        $summary.openssh.service_status = [string]$summary.openssh.service_status
    } else {
        $service = Get-Service sshd -ErrorAction SilentlyContinue
        if ($null -ne $service) {
            $summary.openssh.service_status = [string]$service.Status
            $summary.openssh.startup_type = [string]((Get-CimInstance Win32_Service -Filter "Name='sshd'" -ErrorAction SilentlyContinue).StartMode)
        }
    }
    Get-SshListenerEndpoints | Out-Null
}

$summary | ConvertTo-Json -Depth 8

if (-not $summary.ok) {
    exit 1
}
