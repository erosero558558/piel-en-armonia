$implementationPath = Join-Path $PSScriptRoot 'scripts/ops/admin/ADMIN-UI-CONTINGENCIA.ps1'
Push-Location $PSScriptRoot
try {
    & $implementationPath @args
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
