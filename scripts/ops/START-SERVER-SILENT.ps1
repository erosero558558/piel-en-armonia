<#
.SYNOPSIS
    Inicia el servidor local de Aurora Derm sin ventanas negras de terminal.
    Compatible con Windows PowerShell 5.x y PowerShell 7+

.DESCRIPTION
    Levanta en background (WindowStyle Hidden):
    1. Servidor PHP en puerto 8000 (api.php)
    2. Helper de autenticacion OpenClaw en puerto 4173

.EXAMPLE
    npm run server:start
    npm run server:start -- -SkipHelper
    npm run server:start -- -PhpPort 8080
#>

param(
    [int]$PhpPort = 8000,
    [string]$PhpHost = '0.0.0.0',
    [int]$HelperPort = 4173,
    [switch]$SkipHelper,
    [switch]$SkipPhp
)

$ErrorActionPreference = 'Stop'

$scriptDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot     = (Resolve-Path (Join-Path $scriptDir '..\\..')).Path
$logsDir      = Join-Path $repoRoot 'logs'
$pidsFile     = Join-Path $logsDir '.server-pids.json'
$phpLogOut    = Join-Path $logsDir 'server.out.log'
$phpLogErr    = Join-Path $logsDir 'server.err.log'
$helperLogOut = Join-Path $logsDir 'openclaw-helper.out.log'
$helperLogErr = Join-Path $logsDir 'openclaw-helper.err.log'

if (-not (Test-Path -LiteralPath $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

function Write-Status([string]$Label, [string]$Message, [string]$Color = 'Cyan') {
    Write-Host ("  [{0}] {1}" -f $Label, $Message) -ForegroundColor $Color
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

# Detener servidores anteriores si existen
if (Test-Path -LiteralPath $pidsFile) {
    try {
        $old       = Get-Content -LiteralPath $pidsFile -Raw | ConvertFrom-Json
        $oldPhpId  = Get-SafeInt $old.phpPid    0
        $oldHelpId = Get-SafeInt $old.helperPid 0
        if ($oldPhpId -gt 0 -and (Is-Running $oldPhpId)) {
            Write-Status 'STOP' "Deteniendo PHP anterior (PID $oldPhpId)" 'Yellow'
            Stop-Process -Id $oldPhpId -Force -ErrorAction SilentlyContinue
        }
        if ($oldHelpId -gt 0 -and (Is-Running $oldHelpId)) {
            Write-Status 'STOP' "Deteniendo helper anterior (PID $oldHelpId)" 'Yellow'
            Stop-Process -Id $oldHelpId -Force -ErrorAction SilentlyContinue
        }
    } catch {
        # Ignorar si el archivo tiene formato invalido
    }
}

# Banner
Write-Host ''
Write-Host '  ============================================' -ForegroundColor DarkCyan
Write-Host '    Aurora Derm -- Servidor Local            ' -ForegroundColor Cyan
Write-Host '  ============================================' -ForegroundColor DarkCyan
Write-Host ''

$results = @{
    phpPid       = 0
    phpPort      = $PhpPort
    helperPid    = 0
    helperPort   = $HelperPort
}

# ─── 1. Servidor PHP ──────────────────────────────────────────────────────────
if (-not $SkipPhp) {
    $phpCmd = Get-Command php -ErrorAction SilentlyContinue
    if ($null -eq $phpCmd) {
        Write-Status 'AVISO' 'php no encontrado en PATH. Omitiendo servidor PHP.' 'Yellow'
    } else {
        $phpProc = Start-Process `
            -FilePath         $phpCmd.Source `
            -ArgumentList     @('-S', "${PhpHost}:${PhpPort}", 'api.php') `
            -WorkingDirectory $repoRoot `
            -WindowStyle      Hidden `
            -RedirectStandardOutput $phpLogOut `
            -RedirectStandardError  $phpLogErr `
            -PassThru

        $results.phpPid       = $phpProc.Id
        $results.phpStartedAt = (Get-Date -Format 'o')
        Write-Status 'PHP' "http://127.0.0.1:${PhpPort}  (PID $($phpProc.Id))" 'Green'
        Write-Status 'LOG' $phpLogOut 'DarkGray'
    }
}

# ─── 2. Helper OpenClaw ───────────────────────────────────────────────────────
if (-not $SkipHelper) {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($null -eq $nodeCmd) {
        Write-Status 'AVISO' 'node no encontrado en PATH. Omitiendo helper OpenClaw.' 'Yellow'
    } else {
        $helperScript = Join-Path $repoRoot 'bin\openclaw-auth-helper.js'
        if (-not (Test-Path -LiteralPath $helperScript)) {
            Write-Status 'AVISO' "Helper no encontrado: $helperScript" 'Yellow'
        } else {
            # Inyectar variables de env.php en el entorno del proceso hijo
            $envPhpPath = Join-Path $repoRoot 'env.php'
            if (Test-Path -LiteralPath $envPhpPath) {
                $rawEnv = Get-Content -LiteralPath $envPhpPath -Raw
                $envMatches = [regex]::Matches($rawEnv, "putenv\(\s*['""]([A-Z0-9_]+)=(.*?)['""]\s*\)\s*;")
                foreach ($em in $envMatches) {
                    $eName = $em.Groups[1].Value.Trim()
                    $eVal  = $em.Groups[2].Value.Trim()
                    if ($eName) {
                        [Environment]::SetEnvironmentVariable($eName, $eVal, 'Process')
                    }
                }
            }

            $helperProc = Start-Process `
                -FilePath         $nodeCmd.Source `
                -ArgumentList     @($helperScript) `
                -WorkingDirectory $repoRoot `
                -WindowStyle      Hidden `
                -RedirectStandardOutput $helperLogOut `
                -RedirectStandardError  $helperLogErr `
                -PassThru

            $results.helperPid       = $helperProc.Id
            $results.helperStartedAt = (Get-Date -Format 'o')
            Write-Status 'OCL' "http://127.0.0.1:${HelperPort}  (PID $($helperProc.Id))" 'Green'
            Write-Status 'LOG' $helperLogOut 'DarkGray'
        }
    }
}

# Persistir PIDs
$results | ConvertTo-Json | Set-Content -LiteralPath $pidsFile -Encoding UTF8

Write-Host ''
Write-Status 'OK' 'Stack local iniciado en background -- sin ventanas molestas.' 'Green'
Write-Host ''
Write-Host '  Comandos utiles:' -ForegroundColor DarkGray
Write-Host '    npm run server:status        -- ver si esta corriendo' -ForegroundColor DarkGray
Write-Host '    npm run server:stop          -- detener todo' -ForegroundColor DarkGray
Write-Host '    npm run server:logs          -- ver logs PHP' -ForegroundColor DarkGray
Write-Host '    npm run server:logs:helper   -- ver logs helper' -ForegroundColor DarkGray
Write-Host ''
