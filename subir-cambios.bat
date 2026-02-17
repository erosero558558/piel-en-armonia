@echo off
chcp 65001 >nul
title Subir cambios a GitHub - Piel en Armonía

echo.
echo 🚀 Subiendo cambios a GitHub...
echo ================================================
echo.

REM Verificar que estamos en el directorio correcto
if not exist .git (
    echo ❌ Error: No estás en un repositorio Git
    echo    Asegúrate de ejecutar este script desde la carpeta del proyecto
    pause
    exit /b 1
)

echo 📊 Verificando cambios...
git status --short

REM Verificar si hay cambios
for /f "tokens=*" %%a in ('git status --porcelain') do set HAY_CAMBIOS=%%a

if "%HAY_CAMBIOS%"=="" (
    echo.
    echo ✅ No hay cambios pendientes. Todo está actualizado.
    echo.
    pause
    exit /b 0
)

echo.
echo 📦 Agregando archivos...
git add .
if %errorlevel% neq 0 (
    echo ❌ Error al agregar archivos
    pause
    exit /b 1
)
echo    ✅ Archivos agregados

echo.
echo 💾 Creando commit...
git commit -m "update"
if %errorlevel% neq 0 (
    echo ❌ Error al crear commit
    pause
    exit /b 1
)
echo    ✅ Commit creado

echo.
echo ☁️  Subiendo a GitHub...
git push origin main
if %errorlevel% neq 0 (
    echo ❌ Error al subir a GitHub
    echo    ¿Tienes conexión a internet?
    pause
    exit /b 1
)
echo    ✅ Cambios subidos

echo.
echo ================================================
echo ✅ ¡LISTO! Cambios subidos exitosamente
echo    https://github.com/erosero558558/piel-en-arononia
echo.
pause
