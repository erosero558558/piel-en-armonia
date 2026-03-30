<#
.SYNOPSIS
    Registra todas las tareas programadas de Aurora Derm en Windows Task Scheduler.
    Crons del servidor (reminders, backup, ai-queue, clinical-history)
    + Git AutoSync para sincronizacion automatica con GitHub.

.DESCRIPTION
    Crea/actualiza las siguientes tareas en la carpeta AuroraDerm del Scheduler:

    CRONS SERVIDOR (http://127.0.0.1):
      AuroraDerm-Cron-Reminders          — Cada dia a las 18:00 (recordatorios citas)
      AuroraDerm-Cron-BackupHealth       — Cada dia a las 03:10 (health del backup)
      AuroraDerm-Cron-BackupOffsite      — Cada dia a las 03:20 (backup offsite)
      AuroraDerm-Cron-AiQueueWorker      — Cada 1 minuto (worker de IA / OpenClaw)
      AuroraDerm-Cron-ClinicalHistory    — Cada 1 minuto (reconciliar historias clinicas)
      AuroraDerm-Cron-ProcessRetries     — Cada 5 minutos (reintentos de cron fallidos)

    GIT SYNC:
      AuroraDerm-GitAutoSync-OnLogon     — Al iniciar sesion (pull + push)
      AuroraDerm-GitAutoSync-Hourly      — Cada hora (pull + push)

.PARAMETER CronSecret
    El token secreto para los endpoints de cron.
    Default: lee de env.php en el repo.

.PARAMETER RepoRoot
    Ruta al repositorio. Default: auto-detecta desde la ubicacion del script.

.PARAMETER ServerBase
    URL base del servidor PHP local.
    Default: http://127.0.0.1

.PARAMETER Uninstall
    Elimina todas las tareas programadas de AuroraDerm.

.EXAMPLE
    .\REGISTRAR-TAREAS-PROGRAMADAS.ps1
    .\REGISTRAR-TAREAS-PROGRAMADAS.ps1 -CronSecret "mi_secreto"
    .\REGISTRAR-TAREAS-PROGRAMADAS.ps1 -Uninstall
#>
param(
    [string]$CronSecret = '',
    [string]$RepoRoot   = '',
    [string]$ServerBase = 'http://127.0.0.1',
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

# ── Resolver RepoRoot ─────────────────────────────────────────────────────────
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
}

$taskFolder = 'AuroraDerm'

# ── Uninstall (eliminar todas las tareas) ─────────────────────────────────────
if ($Uninstall) {
    Write-Host "[tareas] Eliminando todas las tareas de $taskFolder..." -ForegroundColor Yellow
    try {
        $svc = New-Object -ComObject Schedule.Service
        $svc.Connect()
        $root = $svc.GetFolder('\')
        try {
            $folder = $root.GetFolder($taskFolder)
            foreach ($task in $folder.GetTasks(0)) {
                $folder.DeleteTask($task.Name, 0)
                Write-Host "  Eliminada: $($task.Name)" -ForegroundColor Red
            }
            $root.DeleteFolder($taskFolder, 0)
            Write-Host "[tareas] Carpeta $taskFolder eliminada." -ForegroundColor Green
        } catch {
            Write-Host "[tareas] No existe la carpeta $taskFolder o ya esta vacia." -ForegroundColor Gray
        }
    } catch {
        Write-Host "[tareas] Error eliminando tareas: $_" -ForegroundColor Red
    }
    exit 0
}

# ── Detectar CronSecret desde env.php si no se paso ──────────────────────────
if ([string]::IsNullOrWhiteSpace($CronSecret)) {
    $envFile = Join-Path $RepoRoot 'env.php'
    if (Test-Path $envFile) {
        $envContent = Get-Content $envFile -Raw
        if ($envContent -match "PIELARMONIA_CRON_SECRET=([^']+)'") {
            $CronSecret = $Matches[1]
        } elseif ($envContent -match 'PIELARMONIA_CRON_SECRET=([^"]+)"') {
            $CronSecret = $Matches[1]
        } elseif ($envContent -match "AURORADERM_CRON_SECRET=([^']+)'") {
            $CronSecret = $Matches[1]
        }
    }
}

if ([string]::IsNullOrWhiteSpace($CronSecret)) {
    Write-Host "[tareas] ERROR: No se encontro CronSecret. Pasa -CronSecret 'tu_secreto'" -ForegroundColor Red
    exit 1
}

Write-Host "[tareas] CronSecret detectado: $($CronSecret.Substring(0, [Math]::Min(6, $CronSecret.Length)))..." -ForegroundColor Green
Write-Host "[tareas] RepoRoot: $RepoRoot" -ForegroundColor Green
Write-Host "[tareas] ServerBase: $ServerBase" -ForegroundColor Green

$psExe   = 'powershell.exe'
$autoSync = Join-Path $RepoRoot 'scripts\ops\setup\GIT-AUTOSYNC.ps1'

# ── Funcion para registrar tareas ──────────────────────────────────────────────
function Register-AuroraDermTask {
    param(
        [string]$Name,
        [string]$Description,
        [string]$Execute,
        [string]$Arguments,
        [object[]]$Triggers,
        [string]$WorkingDir = $RepoRoot,
        [bool]$RunAsSystem = $false
    )

    $taskPath = "\$taskFolder\$Name"

    $action = New-ScheduledTaskAction `
        -Execute $Execute `
        -Argument $Arguments `
        -WorkingDirectory $WorkingDir

    $settings = New-ScheduledTaskSettingsSet `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
        -StartWhenAvailable `
        -DontStopOnIdleEnd `
        -Hidden:$false

    if ($RunAsSystem) {
        Register-ScheduledTask `
            -TaskName $taskPath `
            -Action $action `
            -Trigger $Triggers `
            -Settings $settings `
            -User 'SYSTEM' `
            -RunLevel Highest `
            -Description $Description `
            -Force | Out-Null
    } else {
        Register-ScheduledTask `
            -TaskName $taskPath `
            -Action $action `
            -Trigger $Triggers `
            -Settings $settings `
            -RunLevel Highest `
            -Description $Description `
            -Force | Out-Null
    }

    Write-Host "  Registrada: $Name" -ForegroundColor Green
}

function New-CronTriggerMinutely {
    param([int]$IntervalMinutes = 1)
    $t = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -Once -At (Get-Date '00:00')
    $t.Repetition.Duration = 'P9999D'
    return $t
}

function New-CronTriggerDaily {
    param([string]$At = '03:00')
    return New-ScheduledTaskTrigger -Daily -At $At
}

# Crear carpeta AuroraDerm si no existe
try {
    $svc = New-Object -ComObject Schedule.Service
    $svc.Connect()
    $root = $svc.GetFolder('\')
    try { $root.GetFolder($taskFolder) | Out-Null }
    catch { $root.CreateFolder($taskFolder) | Out-Null }
} catch {}

Write-Host "`n[tareas] Registrando crons del servidor..." -ForegroundColor Cyan

# ── CRON: Recordatorios de citas (18:00 diario) ───────────────────────────────
Register-AuroraDermTask `
    -Name 'Cron-Reminders' `
    -Description 'Aurora Derm — Recordatorios de citas y post-consulta (18:00)' `
    -Execute 'curl.exe' `
    -Arguments "-s -o NUL `"$ServerBase/cron.php?action=reminders&token=$CronSecret`"" `
    -Triggers @(New-CronTriggerDaily -At '18:00')

# ── CRON: Backup health (03:10 diario) ───────────────────────────────────────
Register-AuroraDermTask `
    -Name 'Cron-BackupHealth' `
    -Description 'Aurora Derm — Verificacion de salud del backup' `
    -Execute 'curl.exe' `
    -Arguments "-s -o NUL `"$ServerBase/cron.php?action=backup-health&token=$CronSecret`"" `
    -Triggers @(New-CronTriggerDaily -At '03:10')

# ── CRON: Backup offsite (03:20 diario) ──────────────────────────────────────
Register-AuroraDermTask `
    -Name 'Cron-BackupOffsite' `
    -Description 'Aurora Derm — Backup offsite diario' `
    -Execute 'curl.exe' `
    -Arguments "-s -o NUL `"$ServerBase/cron.php?action=backup-offsite&token=$CronSecret`"" `
    -Triggers @(New-CronTriggerDaily -At '03:20')

# ── CRON: AI Queue Worker (cada 1 minuto) ─────────────────────────────────────
Register-AuroraDermTask `
    -Name 'Cron-AiQueueWorker' `
    -Description 'Aurora Derm — Procesador de cola IA / OpenClaw (cada minuto)' `
    -Execute 'curl.exe' `
    -Arguments "-s -o NUL --max-time 55 `"$ServerBase/cron.php?action=ai-queue-worker&token=$CronSecret`"" `
    -Triggers @(New-CronTriggerMinutely -IntervalMinutes 1)

# ── CRON: Clinical History Reconcile (cada 1 minuto) ─────────────────────────
Register-AuroraDermTask `
    -Name 'Cron-ClinicalHistory' `
    -Description 'Aurora Derm — Reconciliacion de historias clinicas pendientes (cada minuto)' `
    -Execute 'curl.exe' `
    -Arguments "-s -o NUL --max-time 55 `"$ServerBase/cron.php?action=clinical-history-reconcile&token=$CronSecret`"" `
    -Triggers @(New-CronTriggerMinutely -IntervalMinutes 1)

# ── CRON: Process Retries (cada 5 minutos) ───────────────────────────────────
Register-AuroraDermTask `
    -Name 'Cron-ProcessRetries' `
    -Description 'Aurora Derm — Reintento de crons fallidos (cada 5 minutos)' `
    -Execute 'curl.exe' `
    -Arguments "-s -o NUL `"$ServerBase/cron.php?action=process-retries&token=$CronSecret`"" `
    -Triggers @(New-CronTriggerMinutely -IntervalMinutes 5)

Write-Host "`n[tareas] Registrando Git AutoSync..." -ForegroundColor Cyan

# ── GIT AUTOSYNC: Al iniciar sesion ───────────────────────────────────────────
Register-AuroraDermTask `
    -Name 'GitAutoSync-OnLogon' `
    -Description 'Aurora Derm — Git pull+push al iniciar sesion (sincroniza con GitHub)' `
    -Execute $psExe `
    -Arguments "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$autoSync`"" `
    -Triggers @(New-ScheduledTaskTrigger -AtLogOn)

# ── GIT AUTOSYNC: Cada hora ────────────────────────────────────────────────────
Register-AuroraDermTask `
    -Name 'GitAutoSync-Hourly' `
    -Description 'Aurora Derm — Git pull+push cada hora (sincroniza con GitHub)' `
    -Execute $psExe `
    -Arguments "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$autoSync`"" `
    -Triggers @(New-CronTriggerMinutely -IntervalMinutes 60)

Write-Host "`n[tareas] Todas las tareas registradas exitosamente." -ForegroundColor Green
Write-Host ""
Write-Host "Tareas activas en AuroraDerm:" -ForegroundColor White
Get-ScheduledTask -TaskPath "\$taskFolder\" -ErrorAction SilentlyContinue | 
    Select-Object TaskName, State | Format-Table -AutoSize
