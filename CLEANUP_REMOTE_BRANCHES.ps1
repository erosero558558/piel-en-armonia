# Script para limpiar ramas remotas mergeadas a main
# Ejecutar: ./CLEANUP_REMOTE_BRANCHES.ps1

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "LIMPIEZA DE RAMAS REMOTAS MERGEADAS A MAIN" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Obtener ramas remotas mergeadas (excluyendo main y HEAD)
$branches = git branch -r --merged origin/main | ForEach-Object { 
    $_.Trim() -replace "origin/", "" 
} | Where-Object { 
    $_ -ne "main" -and $_ -ne "HEAD -> main" -and $_ -ne "" 
}

$count = ($branches | Measure-Object).Count

if ($count -eq 0) {
    Write-Host "No hay ramas para eliminar." -ForegroundColor Green
    exit 0
}

Write-Host "Ramas a eliminar: $count" -ForegroundColor Yellow
Write-Host ""

# Confirmación
$confirmation = Read-Host "¿Eliminar $count ramas remotas? (escribe 'SI' para confirmar)"
if ($confirmation -ne 'SI') {
    Write-Host "Operación cancelada." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Eliminando ramas..." -ForegroundColor Yellow

$deleted = 0
$failed = 0

foreach ($branch in $branches) {
    Write-Host "  Eliminando: $branch" -NoNewline
    try {
        git push origin --delete $branch 2>$null
        Write-Host " ✓" -ForegroundColor Green
        $deleted++
    } catch {
        Write-Host " ✗ (protegida o ya eliminada)" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "RESUMEN:" -ForegroundColor Cyan
Write-Host "  Eliminadas: $deleted" -ForegroundColor Green
Write-Host "  Fallidas:   $failed" -ForegroundColor Red
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Actualizar y mostrar conteo final
git fetch --prune
$remaining = (git branch -r | Measure-Object).Count
Write-Host "Ramas remotas restantes: $remaining" -ForegroundColor Cyan
