param(
    [Parameter(Mandatory = $true)]
    [string]$BotToken,
    [string]$WebhookUrl = 'https://pielarmonia.com/figo-backend.php',
    [string]$SecretToken = ''
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($SecretToken)) {
    $SecretToken = ([Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')).Substring(0, 48)
}

$base = "https://api.telegram.org/bot$BotToken"

Write-Host "== Configuracion Webhook Telegram =="
Write-Host "Webhook URL: $WebhookUrl"
Write-Host "Secret token (guardar en FIGO_TELEGRAM_WEBHOOK_SECRET): $SecretToken"

$setResp = Invoke-RestMethod -Uri "$base/setWebhook" -Method Post -Body @{
    url = $WebhookUrl
    secret_token = $SecretToken
    allowed_updates = '["message"]'
}

if (-not $setResp.ok) {
    throw "No se pudo configurar webhook: $($setResp | ConvertTo-Json -Depth 10)"
}

$info = Invoke-RestMethod -Uri "$base/getWebhookInfo" -Method Get

Write-Host ""
Write-Host "Webhook configurado."
Write-Host ($info | ConvertTo-Json -Depth 10)
