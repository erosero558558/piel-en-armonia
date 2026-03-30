<#
.SYNOPSIS
    Git AutoSync — mantiene esta PC siempre sincronizada con origin/main.
    Ejecutar al iniciar sesion o como tarea programada.

.DESCRIPTION
    1. Corrige git user config si tiene placeholders.
    2. Actualiza el remote URL al nombre actual del repo (Aurora-Derm).
    3. Stashea cambios sin commitear.
    4. Hace git pull --rebase origin main.
    5. Re-aplica el stash.
    6. Si hay cambios locales sin commitear, los commitea automaticamente.
    7. Hace push a origin/main.
    8. Reporta resultado.

.PARAMETER AutoCommit
    Si hay cambios sin commitear, los commitea automaticamente con timestamp.
    Default: $true

.PARAMETER DryRun
    Solo muestra que haria, sin ejecutar mutaciones.

.EXAMPLE
    .\GIT-AUTOSYNC.ps1
    .\GIT-AUTOSYNC.ps1 -DryRun
    .\GIT-AUTOSYNC.ps1 -AutoCommit:$false
#>
param(
    [bool]$AutoCommit = $true,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
Set-Location $repoRoot

$GIT_USER_NAME  = 'erosero558558'
$GIT_USER_EMAIL = 'erosero558@icloud.com'
$REMOTE_URL     = 'https://github.com/erosero558558/Aurora-Derm.git'
$BRANCH         = 'main'

function Write-Step { param([string]$msg) Write-Host "`n[autosync] $msg" -ForegroundColor Cyan }
function Write-OK   { param([string]$msg) Write-Host "[autosync] OK: $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "[autosync] WARN: $msg" -ForegroundColor Yellow }
function Write-Fail { param([string]$msg) Write-Host "[autosync] ERROR: $msg" -ForegroundColor Red }

Write-Step "Iniciando Git AutoSync en: $repoRoot"
if ($DryRun) { Write-Warn "MODO DRY-RUN — no se ejecutaran cambios reales" }

# ── 1. Verificar que estamos en un repo git ─────────────────────────────────
try {
    $branch = (git rev-parse --abbrev-ref HEAD 2>&1).Trim()
    if ($LASTEXITCODE -ne 0) { throw "No es un repositorio git" }
} catch {
    Write-Fail "No se puede acceder al repo git: $_"
    exit 1
}
Write-OK "Rama actual: $branch"

# ── 2. Corregir git user config local si tiene placeholders ─────────────────
Write-Step "Verificando identidad git..."
$currentName  = (git config user.name 2>&1).Trim()
$currentEmail = (git config user.email 2>&1).Trim()

$needsFixName  = ($currentName  -eq '' -or $currentName  -eq 'Tu Nombre'  -or $currentName  -like '*example*')
$needsFixEmail = ($currentEmail -eq '' -or $currentEmail -eq 'tu-email@ejemplo.com' -or $currentEmail -like '*example*')

if ($needsFixName -or $needsFixEmail) {
    Write-Warn "Config incorrecta: name='$currentName' email='$currentEmail' — corrigiendo..."
    if (-not $DryRun) {
        git config user.name  $GIT_USER_NAME
        git config user.email $GIT_USER_EMAIL
    }
    Write-OK "Identidad corregida: $GIT_USER_NAME <$GIT_USER_EMAIL>"
} else {
    Write-OK "Identidad OK: $currentName <$currentEmail>"
}

# ── 3. Corregir remote URL si es el nombre viejo ─────────────────────────────
Write-Step "Verificando remote URL..."
$currentRemote = (git remote get-url origin 2>&1).Trim()
if ($currentRemote -ne $REMOTE_URL) {
    Write-Warn "Remote incorrecto: $currentRemote — actualizando a $REMOTE_URL"
    if (-not $DryRun) {
        git remote set-url origin $REMOTE_URL
    }
    Write-OK "Remote URL actualizado"
} else {
    Write-OK "Remote URL OK: $currentRemote"
}

# ── 4. Fetch para saber si hay divergencia ───────────────────────────────────
Write-Step "Fetching origin..."
if (-not $DryRun) {
    git fetch origin $BRANCH --quiet 2>&1 | Out-Null
}

$localHead  = (git rev-parse HEAD 2>&1).Trim()
$remoteHead = (git rev-parse "origin/$BRANCH" 2>&1).Trim()

$behind = [int](git rev-list --count "HEAD..origin/$BRANCH" 2>&1).Trim()
$ahead  = [int](git rev-list --count "origin/$BRANCH..HEAD" 2>&1).Trim()

Write-OK "Local: $($localHead.Substring(0,8)) | Remote: $($remoteHead.Substring(0,8)) | Atras: $behind | Adelante: $ahead"

# ── 5. Stashear cambios locales sin commitear ────────────────────────────────
$dirty = (git status --porcelain 2>&1).Trim()
$stashLabel = "autosync-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

if ($dirty) {
    Write-Step "Guardando cambios locales en stash: $stashLabel"
    if (-not $DryRun) {
        git stash push -u -m $stashLabel 2>&1 | Out-Null
    }
    Write-OK "Stash creado: $stashLabel"
} else {
    Write-OK "Working tree limpio — no se necesita stash"
}

# ── 6. Pull --rebase si estamos atras ────────────────────────────────────────
if ($behind -gt 0) {
    Write-Step "Trayendo $behind commit(s) de origin/$BRANCH con rebase..."
    if (-not $DryRun) {
        $env:GIT_EDITOR = 'true'
        git pull --rebase origin $BRANCH 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Error en rebase. Abortando rebase y restaurando stash..."
            git rebase --abort 2>&1 | Out-Null
            if ($dirty) { git stash pop 2>&1 | Out-Null }
            exit 1
        }
    }
    Write-OK "Rebase completado"
} else {
    Write-OK "Ya estamos al dia con origin/$BRANCH"
}

# ── 7. Re-aplicar stash ───────────────────────────────────────────────────────
if ($dirty) {
    Write-Step "Restaurando stash: $stashLabel..."
    if (-not $DryRun) {
        $stashResult = git stash pop 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "Conflicto al restaurar stash. Resolucion manual requerida."
            Write-Warn $stashResult
            exit 1
        }
    }
    Write-OK "Stash restaurado"
}

# ── 8. Auto-commit si hay cambios sin commitear ───────────────────────────────
$dirtyAfterPull = (git status --porcelain 2>&1).Trim()
if ($dirtyAfterPull -and $AutoCommit) {
    $hostname = $env:COMPUTERNAME
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
    $commitMsg = "chore: autosync from $hostname at $timestamp"
    Write-Step "Commiteando cambios locales: $commitMsg"
    if (-not $DryRun) {
        git add .
        $env:HUSKY = '0'
        git commit --no-verify -m $commitMsg 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "No habia nada nuevo para commitear"
        } else {
            Write-OK "Commit creado"
        }
    }
} elseif ($dirtyAfterPull -and -not $AutoCommit) {
    Write-Warn "Hay cambios sin commitear pero AutoCommit=false. Haz commit manualmente."
}

# ── 9. Push si estamos adelante ───────────────────────────────────────────────
$aheadFinal = [int](git rev-list --count "origin/$BRANCH..HEAD" 2>&1).Trim()
if ($aheadFinal -gt 0) {
    Write-Step "Pusheando $aheadFinal commit(s) a origin/$BRANCH..."
    if (-not $DryRun) {
        git push origin $BRANCH 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Error en push. Verifica credenciales o conflictos remotos."
            exit 1
        }
    }
    Write-OK "Push exitoso"
} else {
    Write-OK "Nada nuevo que pushear"
}

# ── 10. Estado final ──────────────────────────────────────────────────────────
Write-Step "Estado final:"
$finalHead = (git rev-parse --short HEAD 2>&1).Trim()
Write-Host ""
Write-Host "  Rama    : $BRANCH" -ForegroundColor White
Write-Host "  Commit  : $finalHead" -ForegroundColor White
Write-Host "  Remote  : $REMOTE_URL" -ForegroundColor White
Write-Host "  Sync    : OK" -ForegroundColor Green
Write-Host ""
