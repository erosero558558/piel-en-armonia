$implementationPath = Join-Path $PSScriptRoot 'scripts/ops/deploy/PREPARAR-PAQUETE-DESPLIEGUE.ps1'
Push-Location $PSScriptRoot
try {
    & $implementationPath @args
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
