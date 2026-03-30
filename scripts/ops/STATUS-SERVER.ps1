<#
.SYNOPSIS
    Muestra el estado de los servidores locales de Aurora Derm.
    Compatible con Windows PowerShell 5.x y PowerShell 7+

.EXAMPLE
    npm run server:status
#>

param()

$ErrorActionPreference = 'SilentlyContinue'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = (Resolve-Path (Join-Path $scriptDir '..\\..')).Path
$pidsFile  = Join-Path $repoRoot 'logs\.server-pids.json'

Write-Host ''
Write-Host '  ============================================' -ForegroundColor DarkCyan
Write-Host '    Aurora Derm -- Estado del Stack Local     ' -ForegroundColor Cyan
Write-Host '  ============================================' -ForegroundColor DarkCyan
Write-Host ''

function Write-Row([string]$Label, [string]$Value, [string]$Color = 'White') {
    Write-Host ("  {0,-28}" -f $Label) -NoNewline -ForegroundColor DarkGray
    Write-Host $Value -ForegroundColor $Color
}

function Get-SafeInt($Value, [int]$Default) {
    if ($null -eq $Value -or "$Value" -eq '') { return $Default }
    try { return [int]$Value } catch { return $Default }
}

function Is-Running([int]$ProcessId) {
    if ($ProcessId -le 0) { return $false }
    $p = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    return ($null -ne $p)
}

function Test-Http([string]$Url) {
    try {
        $r = Invoke-WebRequest -Uri $Url -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        return ($r.StatusCode -lt 500)
    } catch {
        return $false
    }
}

if (-not (Test-Path -LiteralPath $pidsFile)) {
    Write-Row 'Estado' '[No iniciado] Sin archivo de PIDs' 'Yellow'
    Write-Host ''
    Write-Host '  Ejecuta: npm run server:start' -ForegroundColor DarkGray
    Write-Host ''
    exit 0
}

$rawJson = Get-Content -LiteralPath $pidsFile -Raw -ErrorAction SilentlyContinue
if (-not $rawJson) {
    Write-Row 'Estado' '[ERROR] No se pudo leer el archivo de PIDs' 'Red'
    Write-Host ''
    exit 1
}
$pids = $rawJson | ConvertFrom-Json

# --- PHP Server ---
$phpPid  = Get-SafeInt $pids.phpPid  0
$phpPort = Get-SafeInt $pids.phpPort 8000
$phpAlive = Is-Running $phpPid
$phpHttp  = $false
if ($phpAlive) { $phpHttp = Test-Http "http://127.0.0.1:${phpPort}/api.php?resource=health" }

Write-Host '  -- Servidor PHP -----------------------------------' -ForegroundColor DarkGray
if ($phpAlive) { Write-Row 'Proceso' '[CORRIENDO]' 'Green' } else { Write-Row 'Proceso' '[DETENIDO]' 'Red' }
if ($phpPid -gt 0) { Write-Row 'PID' "$phpPid" } else { Write-Row 'PID' 'N/A' 'DarkGray' }
Write-Row 'URL' "http://127.0.0.1:${phpPort}"
if ($phpHttp) { Write-Row 'HTTP' '[OK] Respondiendo' 'Green' } else { Write-Row 'HTTP' '[NO] Sin respuesta aun' 'Yellow' }
$phpStart = "$($pids.phpStartedAt)"
if ($phpStart) { Write-Row 'Iniciado' $phpStart 'DarkGray' }

Write-Host ''

# --- OpenClaw Helper ---
$helperPid  = Get-SafeInt $pids.helperPid  0
$helperPort = Get-SafeInt $pids.helperPort 4173
$helperAlive = Is-Running $helperPid
$helperHttp  = $false
if ($helperAlive) { $helperHttp = Test-Http "http://127.0.0.1:${helperPort}/health" }

Write-Host '  -- Helper OpenClaw --------------------------------' -ForegroundColor DarkGray
if ($helperAlive) { Write-Row 'Proceso' '[CORRIENDO]' 'Green' } else { Write-Row 'Proceso' '[DETENIDO]' 'Red' }
if ($helperPid -gt 0) { Write-Row 'PID' "$helperPid" } else { Write-Row 'PID' 'N/A' 'DarkGray' }
Write-Row 'URL' "http://127.0.0.1:${helperPort}"
if ($helperHttp) { Write-Row 'HTTP' '[OK] Respondiendo' 'Green' } else { Write-Row 'HTTP' '[NO] Sin respuesta aun' 'Yellow' }
$helperStart = "$($pids.helperStartedAt)"
if ($helperStart) { Write-Row 'Iniciado' $helperStart 'DarkGray' }

Write-Host ''

if ($phpAlive -and $helperAlive) {
    Write-Host '  [OK] Stack completo operativo.' -ForegroundColor Green
} else {
    Write-Host '  [AVISO] Algunos servicios no estan en linea. Ejecuta: npm run server:start' -ForegroundColor Yellow
}
Write-Host ''
