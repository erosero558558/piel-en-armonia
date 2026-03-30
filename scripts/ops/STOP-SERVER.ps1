<#
.SYNOPSIS
    Detiene el servidor PHP y el helper OpenClaw iniciados por START-SERVER-SILENT.ps1.
    Compatible con Windows PowerShell 5.x y PowerShell 7+

.EXAMPLE
    npm run server:stop
#>

param()

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = (Resolve-Path (Join-Path $scriptDir '..\\..')).Path
$pidsFile  = Join-Path $repoRoot 'logs\.server-pids.json'

Write-Host ''
Write-Host '  Aurora Derm -- Deteniendo servidores...' -ForegroundColor DarkCyan
Write-Host ''

function Write-Status([string]$Label, [string]$Message, [string]$Color = 'Cyan') {
    Write-Host ("  [{0}] {1}" -f $Label, $Message) -ForegroundColor $Color
}

function Get-SafeInt($Value, [int]$Default) {
    if ($null -eq $Value -or "$Value" -eq '') { return $Default }
    try { return [int]$Value } catch { return $Default }
}

function Stop-ByProcessId([int]$ProcessId, [string]$Name) {
    if ($ProcessId -le 0) { return }
    try {
        $p = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if ($null -ne $p) {
            Stop-Process -Id $ProcessId -Force
            Write-Status 'STOP' "$Name detenido (PID $ProcessId)" 'Yellow'
        } else {
            Write-Status 'INFO' "$Name ya no estaba corriendo (PID $ProcessId)" 'DarkGray'
        }
    } catch {
        Write-Status 'WARN' "No se pudo detener ${Name}: $_" 'Red'
    }
}

if (-not (Test-Path -LiteralPath $pidsFile)) {
    Write-Status 'INFO' 'Sin archivo de PIDs — probablemente ya estan detenidos.' 'DarkGray'
} else {
    $rawJson = Get-Content -LiteralPath $pidsFile -Raw -ErrorAction SilentlyContinue
    if ($rawJson) {
        $savedPids = $rawJson | ConvertFrom-Json
        Stop-ByProcessId -ProcessId (Get-SafeInt $savedPids.phpPid    0) -Name 'Servidor PHP'
        Stop-ByProcessId -ProcessId (Get-SafeInt $savedPids.helperPid 0) -Name 'Helper OpenClaw'
    }
    Remove-Item -LiteralPath $pidsFile -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Status 'OK' 'Hecho.' 'Green'
Write-Host ''
