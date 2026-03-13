param(
    [string]$BundleRoot = 'release/turnero-apps-pilot-local',
    [string]$ServerBaseUrl = '',
    [ValidateSet('text', 'markdown')]
    [string]$Format = 'text',
    [string]$OutputPath = '',
    [switch]$RequireHosting
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDir '..\..\..'))

. (Join-Path $repoRoot 'bin/powershell/Common.Http.ps1')

$generatedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$bundleRootPath = if ([System.IO.Path]::IsPathRooted($BundleRoot)) {
    [System.IO.Path]::GetFullPath($BundleRoot)
} else {
    [System.IO.Path]::GetFullPath((Join-Path $repoRoot $BundleRoot))
}

$manifestPath = Join-Path $bundleRootPath 'app-downloads\pilot\release-manifest.json'
$shaPath = Join-Path $bundleRootPath 'app-downloads\pilot\SHA256SUMS.txt'
$installerRelativePath = 'app-downloads/pilot/operator/win/TurneroOperadorSetup.exe'
$feedRelativePath = 'desktop-updates/pilot/operator/win/latest.yml'
$installerPath = Join-Path $bundleRootPath 'app-downloads\pilot\operator\win\TurneroOperadorSetup.exe'
$feedPath = Join-Path $bundleRootPath 'desktop-updates\pilot\operator\win\latest.yml'

$lines = New-Object System.Collections.Generic.List[string]
$failures = New-Object System.Collections.Generic.List[string]
$localChecks = New-Object System.Collections.Generic.List[object]
$remoteChecks = New-Object System.Collections.Generic.List[object]

function Add-ChecklistLine {
    param([string]$Line = '')

    $script:lines.Add($Line) | Out-Null
}

function Add-ChecklistSection {
    param([string]$Title)

    if ($script:Format -eq 'markdown') {
        Add-ChecklistLine "## $Title"
    } else {
        Add-ChecklistLine "== $Title =="
    }
    Add-ChecklistLine
}

function Add-ChecklistBullet {
    param([string]$Text)

    Add-ChecklistLine "- $Text"
}

function Add-ChecklistCommandBlock {
    param([string[]]$Commands)

    if ($script:Format -eq 'markdown') {
        Add-ChecklistLine '```powershell'
        foreach ($command in $Commands) {
            Add-ChecklistLine $command
        }
        Add-ChecklistLine '```'
    } else {
        foreach ($command in $Commands) {
            Add-ChecklistLine "  $command"
        }
    }
    Add-ChecklistLine
}

function Add-CheckResult {
    param(
        [object]$Collection,
        [string]$Name,
        [bool]$Ok,
        [string]$Detail
    )

    $Collection.Add(
        [pscustomobject]@{
            Name = $Name
            Ok = $Ok
            Detail = $Detail
        }
    ) | Out-Null

    if (-not $Ok) {
        $script:failures.Add("${Name}: $Detail") | Out-Null
    }
}

function Add-CheckBullets {
    param([object]$Checks)

    foreach ($check in $Checks) {
        $prefix = if ($check.Ok) { 'OK' } else { 'FAIL' }
        Add-ChecklistBullet "$prefix - $($check.Name): $($check.Detail)"
    }
    Add-ChecklistLine
}

function Read-JsonFileSafe {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    try {
        $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
        return Parse-JsonBody -Body $raw
    } catch {
        return $null
    }
}

function Unquote-Text {
    param([string]$Value)

    return ([string]$Value).Trim().Trim("'").Trim('"')
}

function Get-YamlScalar {
    param(
        [string]$Content,
        [string]$Key
    )

    if ([string]::IsNullOrWhiteSpace($Content) -or [string]::IsNullOrWhiteSpace($Key)) {
        return ''
    }

    $pattern = "(?m)^\s*$([regex]::Escape($Key)):\s*(.+?)\s*$"
    $match = [regex]::Match($Content, $pattern)
    if (-not $match.Success) {
        return ''
    }

    return Unquote-Text -Value $match.Groups[1].Value
}

function Invoke-HeadCheck {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSec = 20,
        [string]$UserAgent = 'PielArmoniaTurneroOps/1.0'
    )

    try {
        $resp = Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec $TimeoutSec -UseBasicParsing -Headers (Get-DiagnosticsAuthHeaders -UserAgent $UserAgent)
        $status = [int]$resp.StatusCode
        return [pscustomobject]@{
            Name = $Name
            Ok = ($status -ge 200 -and $status -lt 300)
            StatusCode = $status
            Error = if ($status -ge 200 -and $status -lt 300) { '' } else { "HTTP $status" }
        }
    } catch {
        $statusCode = 0
        if ($_.Exception.Response) {
            try { $statusCode = [int]$_.Exception.Response.StatusCode.value__ } catch {}
        }
        return [pscustomobject]@{
            Name = $Name
            Ok = $false
            StatusCode = $statusCode
            Error = $_.Exception.Message
        }
    }
}

if ($Format -eq 'markdown') {
    Add-ChecklistLine '# Checklist - Turnero Operador Windows Pilot'
    Add-ChecklistLine
} else {
    Add-ChecklistLine 'CHECKLIST - TURNERO OPERADOR WINDOWS PILOT'
    Add-ChecklistLine
}

Add-ChecklistBullet "generatedAt: $generatedAt"
Add-ChecklistBullet "bundleRoot: $bundleRootPath"
if (-not [string]::IsNullOrWhiteSpace($ServerBaseUrl)) {
    Add-ChecklistBullet "serverBaseUrl: $($ServerBaseUrl.TrimEnd('/'))"
}
Add-ChecklistLine

$manifest = Read-JsonFileSafe -Path $manifestPath
Add-CheckResult $localChecks 'Bundle root' (Test-Path -LiteralPath $bundleRootPath) $bundleRootPath
Add-CheckResult $localChecks 'Manifest pilot' ($null -ne $manifest) $manifestPath
Add-CheckResult $localChecks 'SHA256SUMS pilot' (Test-Path -LiteralPath $shaPath) $shaPath
Add-CheckResult $localChecks 'Installer Windows' (Test-Path -LiteralPath $installerPath) $installerPath
Add-CheckResult $localChecks 'Feed latest.yml' (Test-Path -LiteralPath $feedPath) $feedPath

$manifestVersion = ''
if ($null -ne $manifest) {
    $manifestVersion = [string]$manifest.version
    $operatorApp = $manifest.apps.operator
    $operatorTarget = $operatorApp.targets.win
    $operatorFeed = $operatorApp.updates.win

    Add-CheckResult $localChecks 'Canal pilot en manifest' ([string]$manifest.channel -eq 'pilot') "channel=$([string]$manifest.channel)"
    Add-CheckResult $localChecks 'Operator Windows en manifest' ($null -ne $operatorTarget) 'apps.operator.targets.win'
    Add-CheckResult $localChecks 'Feed Windows en manifest' ($null -ne $operatorFeed) 'apps.operator.updates.win'

    if ($null -ne $operatorTarget) {
        Add-CheckResult $localChecks 'URL instalador canonica' ([string]$operatorTarget.url -eq "/$installerRelativePath") ([string]$operatorTarget.url)
    }
    if ($null -ne $operatorFeed) {
        Add-CheckResult $localChecks 'URL feed canonica' ([string]$operatorFeed.feedUrl -eq "/$feedRelativePath") ([string]$operatorFeed.feedUrl)
    }
}

if (Test-Path -LiteralPath $feedPath) {
    $feedRaw = Get-Content -LiteralPath $feedPath -Raw
    $feedVersion = Get-YamlScalar -Content $feedRaw -Key 'version'
    $feedPayload = Get-YamlScalar -Content $feedRaw -Key 'path'
    Add-CheckResult $localChecks 'Feed expone version' (-not [string]::IsNullOrWhiteSpace($feedVersion)) "version=$feedVersion"
    Add-CheckResult $localChecks 'Feed apunta al instalador' ($feedPayload -eq 'TurneroOperadorSetup.exe') "path=$feedPayload"
    if (-not [string]::IsNullOrWhiteSpace($manifestVersion)) {
        Add-CheckResult $localChecks 'Feed version coincide con manifest' ($feedVersion -eq $manifestVersion) "feed=$feedVersion manifest=$manifestVersion"
    }
}

if (Test-Path -LiteralPath $shaPath) {
    $shaRaw = Get-Content -LiteralPath $shaPath -Raw
    Add-CheckResult $localChecks 'SHA256SUMS referencia instalador' ($shaRaw.Contains($installerRelativePath)) $installerRelativePath
    Add-CheckResult $localChecks 'SHA256SUMS referencia feed' ($shaRaw.Contains($feedRelativePath)) $feedRelativePath
}

$shouldRunRemote = $RequireHosting.IsPresent -or -not [string]::IsNullOrWhiteSpace($ServerBaseUrl)
$base = ([string]$ServerBaseUrl).TrimEnd('/')
if ($shouldRunRemote) {
    if ([string]::IsNullOrWhiteSpace($base)) {
        $script:failures.Add('ServerBaseUrl: Debes pasar -ServerBaseUrl cuando usas -RequireHosting') | Out-Null
    } else {
        $publicOperator = Invoke-TextGet -Name 'operator-surface' -Url "$base/operador-turnos.html"
        Add-CheckResult $remoteChecks 'operador-turnos.html publico' $publicOperator.Ok "status=$($publicOperator.StatusCode)"

        $publicCenter = Invoke-TextGet -Name 'app-downloads-center' -Url "$base/app-downloads/?surface=operator&platform=win"
        $centerMatches = $publicCenter.Ok -and $publicCenter.Body.Contains('TurneroOperadorSetup.exe')
        Add-CheckResult $remoteChecks 'Centro de descargas operador/win' $centerMatches "status=$($publicCenter.StatusCode)"

        $publicFeed = Invoke-TextGet -Name 'operator-feed' -Url "$base/$feedRelativePath"
        $feedMatches = $publicFeed.Ok -and (
            [string]::IsNullOrWhiteSpace($manifestVersion) -or
            $publicFeed.Body.Contains("version: $manifestVersion")
        )
        Add-CheckResult $remoteChecks 'Feed pilot publicado' $feedMatches "status=$($publicFeed.StatusCode)"

        $publicInstaller = Invoke-HeadCheck -Name 'operator-installer' -Url "$base/$installerRelativePath"
        Add-CheckResult $remoteChecks 'Instalador pilot publicado' $publicInstaller.Ok "status=$($publicInstaller.StatusCode)"
    }
}

Add-ChecklistSection 'Estado bundle local'
Add-CheckBullets -Checks $localChecks

Add-ChecklistSection 'Estado hosting'
if ($remoteChecks.Count -gt 0) {
    Add-CheckBullets -Checks $remoteChecks
} else {
    Add-ChecklistBullet 'Omitido. Usa -ServerBaseUrl https://pielarmonia.com para validar rutas publicadas.'
    Add-ChecklistLine
}

Add-ChecklistSection 'Comandos utiles'
Add-ChecklistCommandBlock -Commands @(
    'npm run turnero:stage:pilot:local',
    'npm run turnero:verify:pilot:local',
    'npm run checklist:turnero:operator:pilot',
    'npm run checklist:turnero:operator:pilot -- -ServerBaseUrl https://pielarmonia.com'
)

Add-ChecklistSection 'Smoke manual del piloto clinico'
Add-ChecklistBullet 'Instala TurneroOperadorSetup.exe en la PC del piloto y deja una sola ventana operativa.'
Add-ChecklistBullet 'Completa onboarding sin ambiguedad: servidor, perfil C1 fijo o C2 fijo o libre, y prueba del Genius Numpad 1000.'
Add-ChecklistBullet 'Confirma que F10 y Ctrl/Cmd + , reabren configuracion sin cortar la operacion.'
Add-ChecklistBullet 'Valida las cuatro teclas del numpad en contexto real: llamar, +, ., -.'
Add-ChecklistBullet 'Corre el flujo clinico completo: llamar / re-llamar / completar / no-show.'
Add-ChecklistBullet 'Prueba one-tap encendido y apagado antes de dejar el equipo a recepcion o consultorio.'
Add-ChecklistBullet 'Confirma la barra persistente con live, offline y safe, ultimo sync, outbox, conciliacion y canal pilot.'
Add-ChecklistBullet 'Simula caida de red con sesion previa: debe pasar a offline operativo solo para llamar, re-llamar, completar y no-show.'
Add-ChecklistBullet 'Simula cold start sin sesion y sin red: debe quedar en safe y no permitir acciones mutantes.'
Add-ChecklistBullet 'Si aparece reconciliacion pendiente, el equipo no debe volver a offline operativo hasta sanear el outbox.'
Add-ChecklistLine

Add-ChecklistSection 'Criterio de cierre'
Add-ChecklistBullet 'Bundle local y, si aplica, hosting publico responden sin errores.'
Add-ChecklistBullet 'Onboarding completo y perfil del consultorio persistido.'
Add-ChecklistBullet 'Genius Numpad 1000 validado por el operador real.'
Add-ChecklistBullet 'Recepcion y consultorio entienden el estado del equipo sin ayuda tecnica.'
Add-ChecklistBullet 'La app queda lista para operar sin PII nueva en logs locales.'
Add-ChecklistLine

$output = $lines -join [Environment]::NewLine

if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
    $outputDir = Split-Path -Parent $OutputPath
    if (-not [string]::IsNullOrWhiteSpace($outputDir) -and -not (Test-Path -LiteralPath $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    }
    Set-Content -Path $OutputPath -Value $output -Encoding UTF8
    Write-Host "Checklist escrito en: $OutputPath"
}

Write-Output $output

if ($failures.Count -gt 0) {
    Write-Error ("Checklist incompleto:`n- " + ($failures -join "`n- "))
}
