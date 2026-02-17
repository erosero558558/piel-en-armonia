#!/usr/bin/env pwsh
# Script para subir cambios automáticamente a GitHub
# Uso: .\subir-cambios.ps1 "mensaje del commit"

param(
    [Parameter(Mandatory=$false)]
    [string]$Mensaje = "update"
)

# Colores para mejor visualización
$Verde = "`e[32m"
$Amarillo = "`e[33m"
$Azul = "`e[34m"
$Rojo = "`e[31m"
$Reset = "`e[0m"

Write-Host ""
Write-Host "🚀 Subiendo cambios a GitHub..." -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que estamos en el directorio correcto
if (-not (Test-Path .git)) {
    Write-Host "❌ Error: No estás en un repositorio Git" -ForegroundColor Red
    Write-Host "   Asegúrate de ejecutar este script desde la carpeta del proyecto"
    exit 1
}

# Mostrar estado actual
Write-Host "📊 Estado actual:" -ForegroundColor Yellow
git status --short
Write-Host ""

# Verificar si hay cambios
$hayCambios = git status --porcelain
if (-not $hayCambios) {
    Write-Host "✅ No hay cambios pendientes. Todo está actualizado." -ForegroundColor Green
    exit 0
}

# Agregar todos los cambios
Write-Host "📦 Agregando archivos..." -ForegroundColor Blue
git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al agregar archivos" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Archivos agregados" -ForegroundColor Green
Write-Host ""

# Hacer commit
Write-Host "💾 Creando commit: '$Mensaje'..." -ForegroundColor Blue
git commit -m "$Mensaje"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al crear commit" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Commit creado" -ForegroundColor Green
Write-Host ""

# Subir a GitHub
Write-Host "☁️  Subiendo a GitHub..." -ForegroundColor Blue
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al subir a GitHub" -ForegroundColor Red
    Write-Host "   ¿Tienes conexión a internet?" -ForegroundColor Yellow
    exit 1
}
Write-Host "   ✅ Cambios subidos exitosamente" -ForegroundColor Green
Write-Host ""

# Mostrar resumen
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✅ ¡LISTO! Cambios subidos a:" -ForegroundColor Green
Write-Host "   https://github.com/erosero558558/piel-en-armonia" -ForegroundColor Cyan
Write-Host ""
Write-Host "📌 Commit: $Mensaje" -ForegroundColor Gray
Write-Host ""
