$implementationPath = Join-Path $PSScriptRoot 'scripts/ops/prod/BENCH-API-PRODUCCION.ps1'
Push-Location $PSScriptRoot
try {
    & $implementationPath @args
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
