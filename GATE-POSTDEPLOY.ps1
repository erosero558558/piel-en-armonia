param(
    [string]$Domain = 'https://pielarmonia.com',
    [int]$BenchRuns = 25,
    [switch]$AllowDegradedFigo,
    [switch]$AllowRecursiveFigo,
    [switch]$RequireWebhookSecret
)

$ErrorActionPreference = 'Stop'

Write-Host "== Gate Post-Deploy ==" -ForegroundColor Cyan
Write-Host "Dominio: $Domain"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$failures = 0

Write-Host ""
Write-Host "[1/3] Verificacion de despliegue..." -ForegroundColor Yellow
& .\VERIFICAR-DESPLIEGUE.ps1 `
    -Domain $Domain `
    -AllowDegradedFigo:$AllowDegradedFigo `
    -AllowRecursiveFigo:$AllowRecursiveFigo `
    -RequireWebhookSecret:$RequireWebhookSecret
if ($LASTEXITCODE -ne 0) {
    $failures += 1
}

Write-Host ""
Write-Host "[2/3] Smoke de produccion..." -ForegroundColor Yellow
& .\SMOKE-PRODUCCION.ps1 `
    -Domain $Domain `
    -TestFigoPost `
    -AllowDegradedFigo:$AllowDegradedFigo `
    -AllowRecursiveFigo:$AllowRecursiveFigo `
    -RequireWebhookSecret:$RequireWebhookSecret
if ($LASTEXITCODE -ne 0) {
    $failures += 1
}

Write-Host ""
Write-Host "[3/3] Benchmark API..." -ForegroundColor Yellow
& .\BENCH-API-PRODUCCION.ps1 `
    -Domain $Domain `
    -Runs $BenchRuns `
    -IncludeFigoPost
if ($LASTEXITCODE -ne 0) {
    $failures += 1
}

Write-Host ""
if ($failures -gt 0) {
    Write-Host "Gate FALLIDO: $failures bloque(s) con errores." -ForegroundColor Red
    exit 1
}

Write-Host "Gate OK: despliegue validado." -ForegroundColor Green
exit 0
