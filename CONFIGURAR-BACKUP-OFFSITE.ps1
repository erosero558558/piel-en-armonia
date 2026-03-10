$implementationPath = Join-Path $PSScriptRoot 'scripts/ops/setup/CONFIGURAR-BACKUP-OFFSITE.ps1'
Push-Location $PSScriptRoot
try {
    & $implementationPath @args
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
