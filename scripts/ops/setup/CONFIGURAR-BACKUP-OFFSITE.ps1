param(
    [string]$SourceDomain = 'https://pielarmonia.com',
    [string]$ReceiverDomain = 'https://backup.pielarmonia.com',
    [string]$Token = ''
)

$ErrorActionPreference = 'Stop'

function New-RandomToken {
    $bytes = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', 'A').Replace('/', 'B')
}

if ([string]::IsNullOrWhiteSpace($Token)) {
    $Token = New-RandomToken
}

$source = $SourceDomain.TrimEnd('/')
$receiver = $ReceiverDomain.TrimEnd('/')
$receiverUrl = "$receiver/backup-receiver.php"

Write-Host "=== Configuracion Offsite Backup ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1) En servidor DESTINO (receiver):" -ForegroundColor Yellow
Write-Host "   putenv('PIELARMONIA_BACKUP_RECEIVER_TOKEN=$Token');"
Write-Host "   (opcional) putenv('PIELARMONIA_BACKUP_RECEIVER_MAX_MB=50');"
Write-Host ""
Write-Host "2) En servidor ORIGEN (produccion):" -ForegroundColor Yellow
Write-Host "   putenv('PIELARMONIA_BACKUP_OFFSITE_URL=$receiverUrl');"
Write-Host "   putenv('PIELARMONIA_BACKUP_OFFSITE_TOKEN=$Token');"
Write-Host "   putenv('PIELARMONIA_BACKUP_LOCAL_REPLICA=true');"
Write-Host ""
Write-Host "3) Cron recomendado en ORIGEN:" -ForegroundColor Yellow
Write-Host "   https://$($source.Replace('https://','').Replace('http://',''))/cron.php?action=backup-health&token=YOUR_CRON_SECRET"
Write-Host "   https://$($source.Replace('https://','').Replace('http://',''))/cron.php?action=backup-offsite&token=YOUR_CRON_SECRET"
Write-Host ""
Write-Host "4) Test manual del receiver:" -ForegroundColor Yellow
Write-Host "   curl -i -X POST `"$receiverUrl`" -H `"Authorization: Bearer $Token`" -F `"backup=@data/backups/store-XXXX.json`""
Write-Host ""
Write-Host "Token generado:" -ForegroundColor Green
Write-Host $Token
