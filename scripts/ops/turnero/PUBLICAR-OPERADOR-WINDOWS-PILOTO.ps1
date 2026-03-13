param(
    [string]$BundleRoot = 'release/turnero-apps-pilot-local',
    [string]$ServerBaseUrl = 'https://pielarmonia.com',
    [ValidateSet('ftp', 'ftps', 'sftp')]
    [string]$Protocol = '',
    [string]$Server = '',
    [string]$ServerPort = '',
    [ValidateSet('strict', 'loose')]
    [string]$Security = '',
    [string]$ServerDir = '',
    [string]$Username = '',
    [string]$Password = '',
    [switch]$DryRun,
    [switch]$SkipLocalVerify,
    [switch]$SkipPostCheck
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDir '..\..\..'))

$resolvedProtocol = if (-not [string]::IsNullOrWhiteSpace($Protocol)) {
    $Protocol
} elseif (-not [string]::IsNullOrWhiteSpace([string]$env:FTP_PROTOCOL)) {
    [string]$env:FTP_PROTOCOL
} else {
    'ftps'
}
$resolvedSecurity = if (-not [string]::IsNullOrWhiteSpace($Security)) {
    $Security
} elseif (-not [string]::IsNullOrWhiteSpace([string]$env:FTP_SECURITY)) {
    [string]$env:FTP_SECURITY
} else {
    'strict'
}
$resolvedServer = if (-not [string]::IsNullOrWhiteSpace($Server)) {
    $Server
} else {
    [string]$env:FTP_SERVER
}
$resolvedPort = if (-not [string]::IsNullOrWhiteSpace($ServerPort)) {
    $ServerPort
} elseif (-not [string]::IsNullOrWhiteSpace([string]$env:FTP_SERVER_PORT)) {
    [string]$env:FTP_SERVER_PORT
} elseif ($resolvedProtocol -eq 'sftp') {
    '22'
} else {
    '21'
}
$resolvedServerDir = if (-not [string]::IsNullOrWhiteSpace($ServerDir)) {
    $ServerDir
} elseif (-not [string]::IsNullOrWhiteSpace([string]$env:FTP_SERVER_DIR)) {
    [string]$env:FTP_SERVER_DIR
} else {
    '/public_html/'
}
$resolvedUsername = if (-not [string]::IsNullOrWhiteSpace($Username)) {
    $Username
} else {
    [string]$env:FTP_USERNAME
}
$resolvedPassword = if (-not [string]::IsNullOrWhiteSpace($Password)) {
    $Password
} else {
    [string]$env:FTP_PASSWORD
}

$bundleRootPath = if ([System.IO.Path]::IsPathRooted($BundleRoot)) {
    [System.IO.Path]::GetFullPath($BundleRoot)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $repoRoot $BundleRoot))
}
$manifestPath = Join-Path $bundleRootPath 'app-downloads\pilot\release-manifest.json'
$verifyScriptPath = Join-Path $repoRoot 'bin\verify-turnero-release-bundle.js'
$checklistScriptPath = Join-Path $repoRoot 'scripts\ops\turnero\CHECKLIST-OPERADOR-WINDOWS-PILOTO.ps1'

function Resolve-TrimmedRemotePath {
    param([string]$Value)

    $normalized = ([string]$Value).Trim()
    if ([string]::IsNullOrWhiteSpace($normalized)) {
        return ''
    }

    $normalized = $normalized.Replace('\', '/')
    $normalized = $normalized.Trim('/')
    return $normalized
}

function Combine-RemotePath {
    param(
        [string]$BaseDir,
        [string]$RelativePath
    )

    $basePart = Resolve-TrimmedRemotePath -Value $BaseDir
    $relativePart = Resolve-TrimmedRemotePath -Value $RelativePath

    if ([string]::IsNullOrWhiteSpace($basePart)) {
        return "/$relativePart"
    }
    if ([string]::IsNullOrWhiteSpace($relativePart)) {
        return "/$basePart"
    }
    return "/$basePart/$relativePart"
}

function Ensure-Condition {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Read-JsonFile {
    param([string]$Path)

    Ensure-Condition (Test-Path -LiteralPath $Path) "No existe el archivo JSON requerido: $Path"
    $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
    $convertCommand = Get-Command ConvertFrom-Json -ErrorAction Stop
    if ($convertCommand.Parameters.ContainsKey('Depth')) {
        $json = $raw | ConvertFrom-Json -Depth 16
    } else {
        $json = $raw | ConvertFrom-Json
    }
    Ensure-Condition ($null -ne $json) "No se pudo parsear JSON: $Path"
    return $json
}

function Get-PilotBundleFiles {
    param([object]$Manifest)

    $manifestFiles = @(
        'app-downloads/pilot/release-manifest.json'
        'app-downloads/pilot/SHA256SUMS.txt'
    )

    $operatorFiles = @($Manifest.apps.operator.files) |
        Where-Object { $null -ne $_ } |
        ForEach-Object { ([string]$_.path).TrimStart('/') } |
        Where-Object {
            $_.StartsWith('app-downloads/pilot/operator/win/') -or
            $_.StartsWith('desktop-updates/pilot/operator/win/')
        }

    return @(
        $manifestFiles + $operatorFiles |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            Select-Object -Unique
    )
}

function New-FtpRequest {
    param(
        [string]$Uri,
        [string]$Method
    )

    $request = [System.Net.FtpWebRequest]::Create($Uri)
    $request = [System.Net.FtpWebRequest]$request
    $request.Method = $Method
    $request.Credentials = New-Object System.Net.NetworkCredential($resolvedUsername, $resolvedPassword)
    $request.UseBinary = $true
    $request.UsePassive = $true
    $request.KeepAlive = $false
    $request.ReadWriteTimeout = 180000
    $request.Timeout = 180000
    $request.EnableSsl = ($resolvedProtocol -eq 'ftps')
    return $request
}

function Set-LooseTlsIfNeeded {
    if ($resolvedProtocol -eq 'ftps' -and $resolvedSecurity -eq 'loose') {
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
    }
}

function Ensure-RemoteDirectory {
    param([string]$RemoteDirectory)

    $trimmed = Resolve-TrimmedRemotePath -Value $RemoteDirectory
    if ([string]::IsNullOrWhiteSpace($trimmed)) {
        return
    }

    $segments = $trimmed.Split('/') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    $current = ''
    foreach ($segment in $segments) {
        if ([string]::IsNullOrWhiteSpace($current)) {
            $current = $segment
        } else {
            $current = "$current/$segment"
        }

        $uri = "ftp://$resolvedServer`:$resolvedPort/$current"
        try {
            $request = New-FtpRequest -Uri $uri -Method ([System.Net.WebRequestMethods+Ftp]::MakeDirectory)
            $response = [System.Net.FtpWebResponse]$request.GetResponse()
            $response.Close()
        } catch [System.Net.WebException] {
            $response = $_.Exception.Response
            if ($null -eq $response) {
                throw
            }
            $ftpResponse = [System.Net.FtpWebResponse]$response
            $status = [int]$ftpResponse.StatusCode
            $ftpResponse.Close()
            if (
                $status -ne [int][System.Net.FtpStatusCode]::ActionNotTakenFileUnavailable -and
                $status -ne [int][System.Net.FtpStatusCode]::ActionNotTakenFilenameNotAllowed
            ) {
                throw
            }
        }
    }
}

function Upload-RemoteFile {
    param(
        [string]$LocalPath,
        [string]$RemotePath
    )

    $remoteUri = "ftp://$resolvedServer`:$resolvedPort$RemotePath"
    $remoteDirectory = Split-Path -Path $RemotePath.Replace('/', '\') -Parent
    $remoteDirectory = $remoteDirectory.Replace('\', '/')

    Ensure-RemoteDirectory -RemoteDirectory $remoteDirectory

    $request = New-FtpRequest -Uri $remoteUri -Method ([System.Net.WebRequestMethods+Ftp]::UploadFile)
    $content = [System.IO.File]::ReadAllBytes($LocalPath)
    $request.ContentLength = $content.Length

    $stream = $request.GetRequestStream()
    try {
        $stream.Write($content, 0, $content.Length)
    } finally {
        $stream.Close()
    }

    $response = [System.Net.FtpWebResponse]$request.GetResponse()
    try {
        Write-Host ("[turnero-publish] Uploaded {0} -> {1} ({2})" -f $LocalPath, $RemotePath, $response.StatusDescription.Trim())
    } finally {
        $response.Close()
    }
}

Ensure-Condition ($resolvedProtocol -in @('ftp', 'ftps', 'sftp')) "Protocol invalido: $resolvedProtocol"
if ($resolvedProtocol -eq 'sftp') {
    throw 'La publicacion local del piloto soporta ftp/ftps. Para sftp, usa el workflow release-turnero-apps.yml.'
}

Ensure-Condition (Test-Path -LiteralPath $bundleRootPath) "No existe BundleRoot: $bundleRootPath"
Ensure-Condition (Test-Path -LiteralPath $manifestPath) "No existe release-manifest.json del piloto: $manifestPath"

if (-not $SkipLocalVerify.IsPresent) {
    & node $verifyScriptPath --outputRoot $bundleRootPath --channel pilot --surface operator --target win
    if ($LASTEXITCODE -ne 0) {
        throw 'La verificacion local del bundle piloto fallo. No se publicara nada.'
    }
}

$manifest = Read-JsonFile -Path $manifestPath
Ensure-Condition ([string]$manifest.channel -eq 'pilot') "El manifest debe ser pilot y llego $([string]$manifest.channel)"
Ensure-Condition ($null -ne $manifest.apps.operator) 'El manifest pilot no incluye apps.operator'

$relativeFiles = Get-PilotBundleFiles -Manifest $manifest
Ensure-Condition ($relativeFiles.Count -gt 0) 'No se derivaron archivos para publicar desde el manifest pilot.'

$publishPlan = foreach ($relativePath in $relativeFiles) {
    $localPath = Join-Path $bundleRootPath ($relativePath.Replace('/', '\'))
    Ensure-Condition (Test-Path -LiteralPath $localPath) "Falta archivo local para publicar: $localPath"
    [pscustomobject]@{
        RelativePath = $relativePath
        LocalPath = $localPath
        RemotePath = Combine-RemotePath -BaseDir $resolvedServerDir -RelativePath $relativePath
    }
}

Write-Host '[turnero-publish] Bundle piloto Windows de operador listo para publicar.'
Write-Host ("[turnero-publish] Protocol={0} Server={1} Port={2} ServerDir={3}" -f $resolvedProtocol, ($(if ($resolvedServer) { $resolvedServer } else { '<unset>' })), $resolvedPort, $resolvedServerDir)

foreach ($entry in $publishPlan) {
    Write-Host ("[turnero-publish] Plan {0} -> {1}" -f $entry.RelativePath, $entry.RemotePath)
}

if ($DryRun.IsPresent) {
    Write-Host '[turnero-publish] DRY RUN. No se subieron archivos.'
    exit 0
}

Ensure-Condition (-not [string]::IsNullOrWhiteSpace($resolvedServer)) 'Falta FTP_SERVER o -Server para publicar.'
Ensure-Condition (-not [string]::IsNullOrWhiteSpace($resolvedUsername)) 'Falta FTP_USERNAME o -Username para publicar.'
Ensure-Condition (-not [string]::IsNullOrWhiteSpace($resolvedPassword)) 'Falta FTP_PASSWORD o -Password para publicar.'

Set-LooseTlsIfNeeded

foreach ($entry in $publishPlan) {
    Upload-RemoteFile -LocalPath $entry.LocalPath -RemotePath $entry.RemotePath
}

Write-Host '[turnero-publish] Publicacion completada.'

if (-not $SkipPostCheck.IsPresent) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $checklistScriptPath -BundleRoot $bundleRootPath -ServerBaseUrl $ServerBaseUrl
    if ($LASTEXITCODE -ne 0) {
        throw 'La publicacion termino, pero el checklist post-publicacion reporto fallos.'
    }
}
