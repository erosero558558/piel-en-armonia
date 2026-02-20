# Security Audit Report
Date: Fri Feb 20 14:05:49 UTC 2026

## Hardcoded Secrets Scan
Scanning for API_KEY, SECRET, PASSWORD, TOKEN...

./admin-auth.php:    $totpSecret = getenv('PIELARMONIA_ADMIN_2FA_SECRET');
./LISTA_PENDIENTES_ULTRADETALLADA.md:          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
./LISTA_PENDIENTES_ULTRADETALLADA.md:          MYSQL_ROOT_PASSWORD: root
./figo-chat.php:    getenv('FIGO_CHAT_TOKEN'),
./figo-chat.php:    getenv('FIGO_CHAT_BEARER_TOKEN'),
./figo-chat.php:    getenv('FIGO_TOKEN'),
./figo-chat.php:    getenv('FIGO_BEARER_TOKEN'),
./figo-chat.php:    getenv('CLAWBOT_TOKEN'),
./figo-chat.php:    getenv('CHATBOT_TOKEN'),
./figo-chat.php:    getenv('FIGO_CHAT_API_KEY'),
./figo-chat.php:    getenv('FIGO_API_KEY'),
./figo-chat.php:    getenv('CLAWBOT_API_KEY'),
./figo-chat.php:    getenv('CHATBOT_API_KEY'),
./figo-chat.php:    getenv('FIGO_CHAT_API_KEY_HEADER'),
./figo-chat.php:    getenv('FIGO_API_KEY_HEADER'),
./figo-chat.php:    getenv('CLAWBOT_API_KEY_HEADER'),
./figo-chat.php:    getenv('CHATBOT_API_KEY_HEADER'),
./ROADMAP_PRIORIDADES.md:### 1.3 PASSWORD HASHING (P0) - 1 día
./ROADMAP_PRIORIDADES.md:    private const ALGO = PASSWORD_ARGON2ID;
./docs/DISASTER_RECOVERY.md:* `PIELARMONIA_BACKUP_OFFSITE_TOKEN`
./docs/DISASTER_RECOVERY.md:4.  **Rotar Secretos:** Cambiar `PIELARMONIA_ADMIN_PASSWORD`, claves de Stripe, SMTP, etc.
./docs/RUNBOOKS.md:10 3 * * * curl -s "https://pielarmonia.com/cron.php?action=backup-health&token=YOUR_CRON_SECRET"
./docs/RUNBOOKS.md:20 3 * * * curl -s "https://pielarmonia.com/cron.php?action=backup-offsite&token=YOUR_CRON_SECRET"
./docs/RUNBOOKS.md:curl -s "https://pielarmonia.com/cron.php?action=backup-offsite&dryRun=1&token=YOUR_CRON_SECRET"
./docs/RUNBOOKS.md:* `PIELARMONIA_BACKUP_OFFSITE_TOKEN` (opcional)
./docs/RUNBOOKS.md:* `PIELARMONIA_BACKUP_OFFSITE_TOKEN_HEADER` (opcional)
./docs/RUNBOOKS.md:* Configura `PIELARMONIA_BACKUP_RECEIVER_TOKEN` en destino.
./docs/RUNBOOKS.md:  `PIELARMONIA_BACKUP_OFFSITE_TOKEN=<mismo_token>`
./README.md:   $env:PIELARMONIA_ADMIN_PASSWORD = "tu-clave-segura"
./README.md:- `PIELARMONIA_ADMIN_PASSWORD`: Contraseña para el acceso administrativo.
./README.md:- `PIELARMONIA_CRON_SECRET`: Token para ejecutar `cron.php` de forma segura.
./README.md:- Secrets: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`
./.github/workflows/deploy-hosting.yml:          if [ -z "${{ secrets.FTP_PASSWORD }}" ]; then
./.github/workflows/deploy-hosting.yml:            echo "::error::Falta el secret FTP_PASSWORD"
./.github/workflows/deploy-hosting.yml:          password: ${{ secrets.FTP_PASSWORD }}
./.github/workflows/ci.yml:          PIELARMONIA_ADMIN_PASSWORD: admin123
./playwright.config.js:        PIELARMONIA_ADMIN_PASSWORD: process.env.PIELARMONIA_ADMIN_PASSWORD || 'admin123',
./figo-backend.php:        getenv('FIGO_AI_API_KEY'),
./figo-backend.php:        getenv('FIGO_AI_API_KEY_HEADER'),
./figo-backend.php:        getenv('FIGO_AI_API_KEY_PREFIX'),
./figo-backend.php:        getenv('FIGO_TELEGRAM_BOT_TOKEN'),
./figo-backend.php:        getenv('TELEGRAM_BOT_TOKEN'),
./figo-backend.php:        getenv('FIGO_CHAT_TOKEN')
./figo-backend.php:    $secret = getenv('FIGO_TELEGRAM_WEBHOOK_SECRET');
./figo-backend.php:    $received = isset($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'])
./figo-backend.php:        ? trim((string) $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'])
./FINAL_ANALYSIS_REPORT.md:   $hash = password_hash($password, PASSWORD_ARGON2ID);
./DESPLIEGUE-PIELARMONIA.md:- Secrets: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`
./DESPLIEGUE-PIELARMONIA.md:- `PIELARMONIA_ADMIN_PASSWORD` (obligatoria para login admin)
./DESPLIEGUE-PIELARMONIA.md:- `PIELARMONIA_ADMIN_PASSWORD_HASH` (opcional, tiene prioridad)
./DESPLIEGUE-PIELARMONIA.md:- `FIGO_CHAT_TOKEN` (opcional, token Bearer para backend Figo)
./DESPLIEGUE-PIELARMONIA.md:- `FIGO_TELEGRAM_BOT_TOKEN` (opcional, para puente/notificación Telegram en `figo-backend.php`)
./DESPLIEGUE-PIELARMONIA.md:- `FIGO_TELEGRAM_WEBHOOK_SECRET` (recomendado, valida peticiones webhook de Telegram)
./DESPLIEGUE-PIELARMONIA.md:- `PIELARMONIA_CRON_SECRET` (obligatoria para `cron.php`)
./DESPLIEGUE-PIELARMONIA.md:- `PIELARMONIA_BACKUP_OFFSITE_TOKEN` (opcional)
./DESPLIEGUE-PIELARMONIA.md:- `PIELARMONIA_BACKUP_OFFSITE_TOKEN_HEADER` (opcional, default `Authorization`)
./DESPLIEGUE-PIELARMONIA.md:- `PIELARMONIA_BACKUP_RECEIVER_TOKEN` (solo cuando este servidor actua como destino de `backup-receiver.php`)
./DESPLIEGUE-PIELARMONIA.md:- Debes configurar `PIELARMONIA_ADMIN_PASSWORD` o `PIELARMONIA_ADMIN_PASSWORD_HASH`.
./DESPLIEGUE-PIELARMONIA.md:  "token": "TOKEN_OPCIONAL",
./DESPLIEGUE-PIELARMONIA.md:- `.\CONFIGURAR-TELEGRAM-WEBHOOK.ps1 -BotToken "TOKEN_ROTADO" -WebhookUrl "https://pielarmonia.com/figo-backend.php"`
./DESPLIEGUE-PIELARMONIA.md:- Guarda el secret mostrado por el script en `FIGO_TELEGRAM_WEBHOOK_SECRET`.
./DESPLIEGUE-PIELARMONIA.md:- `https://pielarmonia.com/cron.php?action=backup-health&token=YOUR_CRON_SECRET`
./DESPLIEGUE-PIELARMONIA.md:- `https://pielarmonia.com/cron.php?action=backup-offsite&dryRun=1&token=YOUR_CRON_SECRET`
./DESPLIEGUE-PIELARMONIA.md:- Configura token en destino (`PIELARMONIA_BACKUP_RECEIVER_TOKEN`).
./DESPLIEGUE-PIELARMONIA.md:  `PIELARMONIA_BACKUP_OFFSITE_TOKEN=<TOKEN>`
./tests/checklist-production.spec.js:const ADMIN_PASSWORD = process.env.PIELARMONIA_ADMIN_PASSWORD || 'admin123';
./tests/checklist-production.spec.js:        fs.writeFileSync(envPath, `<?php putenv('PIELARMONIA_ADMIN_PASSWORD=${ADMIN_PASSWORD}'); ?>`);
./tests/checklist-production.spec.js:    await page.fill('input[type="password"]', ADMIN_PASSWORD);
./tests/router.php:putenv('PIELARMONIA_ADMIN_PASSWORD=secret');
./tests/StripeServiceTest.php:        putenv('PIELARMONIA_STRIPE_SECRET_KEY=sk_test_123');
./tests/StripeServiceTest.php:        putenv('PIELARMONIA_STRIPE_SECRET_KEY');
./tests/StripeServiceTest.php:        putenv('PIELARMONIA_STRIPE_SECRET_KEY');
./payment-lib.php:    $raw = getenv('PIELARMONIA_STRIPE_SECRET_KEY');
./payment-lib.php:    $raw = getenv('PIELARMONIA_STRIPE_WEBHOOK_SECRET');
./CHECKLIST-PRUEBAS-PRODUCCION.md:- `PIELARMONIA_ADMIN_PASSWORD`
./CHECKLIST-PRUEBAS-PRODUCCION.md:- opcional: `PIELARMONIA_ADMIN_PASSWORD_HASH`
./CHECKLIST-PRUEBAS-PRODUCCION.md:- `PIELARMONIA_STRIPE_SECRET_KEY`
./CHECKLIST-PRUEBAS-PRODUCCION.md:- opcional: `FIGO_CHAT_TOKEN`
./CHECKLIST-PRUEBAS-PRODUCCION.md:- opcional: `FIGO_TELEGRAM_BOT_TOKEN`
./CHECKLIST-PRUEBAS-PRODUCCION.md:- recomendado: `FIGO_TELEGRAM_WEBHOOK_SECRET`
./CHECKLIST-PRUEBAS-PRODUCCION.md:3. Login con contraseña correcta (`PIELARMONIA_ADMIN_PASSWORD`):
./SERVIDOR-LOCAL.md:- `PIELARMONIA_ADMIN_PASSWORD`: contraseña del panel admin.
./SERVIDOR-LOCAL.md:- `PIELARMONIA_ADMIN_PASSWORD_HASH`: hash de contraseña (opcional, prioridad sobre la contraseña en texto).
./SERVIDOR-LOCAL.md:- `FIGO_CHAT_TOKEN`: token Bearer opcional para autenticar contra Figo.
./SERVIDOR-LOCAL.md:$env:PIELARMONIA_ADMIN_PASSWORD = "tu-clave-segura"
./bin/generate_hash.php:$hash = password_hash($password, PASSWORD_BCRYPT);
./bin/generate_hash.php:echo "putenv('PIELARMONIA_ADMIN_PASSWORD_HASH=" . $hash . "');\n";
./backup-receiver.php:    $backupHeader = isset($_SERVER['HTTP_X_BACKUP_TOKEN']) ? trim((string) $_SERVER['HTTP_X_BACKUP_TOKEN']) : '';
./backup-receiver.php:    getenv('PIELARMONIA_BACKUP_RECEIVER_TOKEN')
./GITHUB-ACTIONS-DEPLOY.md:- `FTP_PASSWORD`
./CONFIGURAR-BACKUP-OFFSITE.ps1:Write-Host "   putenv('PIELARMONIA_BACKUP_RECEIVER_TOKEN=$Token');"
./CONFIGURAR-BACKUP-OFFSITE.ps1:Write-Host "   putenv('PIELARMONIA_BACKUP_OFFSITE_TOKEN=$Token');"
./CONFIGURAR-BACKUP-OFFSITE.ps1:Write-Host "   https://$($source.Replace('https://','').Replace('http://',''))/cron.php?action=backup-health&token=YOUR_CRON_SECRET"
./CONFIGURAR-BACKUP-OFFSITE.ps1:Write-Host "   https://$($source.Replace('https://','').Replace('http://',''))/cron.php?action=backup-offsite&token=YOUR_CRON_SECRET"
./env.example.php:// putenv('PIELARMONIA_ADMIN_PASSWORD=tu_clave_admin');
./env.example.php:// putenv('PIELARMONIA_STRIPE_SECRET_KEY=sk_live_...');
./env.example.php:// putenv('PIELARMONIA_STRIPE_WEBHOOK_SECRET=whsec_...');
./env.example.php:// putenv('PIELARMONIA_TURNSTILE_SECRET_KEY=0x4AAAAAAABcDeFgHiJkLmNoPqRsTuVwXyZ');
./env.example.php:// putenv('FIGO_CHAT_TOKEN=TOKEN_ROTADO_DESDE_BOTFATHER');
./env.example.php:// putenv('FIGO_TELEGRAM_BOT_TOKEN=TOKEN_BOTFATHER_ROTADO');
./env.example.php:// putenv('FIGO_TELEGRAM_WEBHOOK_SECRET=TOKEN_SECRETO_WEBHOOK');
./env.example.php:// putenv('FIGO_AI_API_KEY=sk-or-v1-REEMPLAZAR');
./env.example.php:// putenv('PIELARMONIA_CRON_SECRET=un_token_secreto_largo');
./env.example.php:// putenv('PIELARMONIA_BACKUP_OFFSITE_TOKEN=token_largo_rotado');
./env.example.php:// putenv('PIELARMONIA_BACKUP_OFFSITE_TOKEN_HEADER=Authorization');
./env.example.php:// putenv('PIELARMONIA_BACKUP_RECEIVER_TOKEN=token_largo_rotado');
./lib/captcha.php:    $secret = getenv('PIELARMONIA_RECAPTCHA_SECRET');
./lib/auth.php:    $hash = getenv('PIELARMONIA_ADMIN_PASSWORD_HASH');
./lib/auth.php:    $plain = getenv('PIELARMONIA_ADMIN_PASSWORD');
./lib/auth.php:    $secret = getenv('PIELARMONIA_ADMIN_2FA_SECRET');
./lib/http.php:    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
./lib/backup.php:        getenv('PIELARMONIA_BACKUP_OFFSITE_TOKEN'),
./lib/backup.php:        getenv('PIELARMONIA_BACKUP_WEBHOOK_TOKEN')
./lib/backup.php:        getenv('PIELARMONIA_BACKUP_OFFSITE_TOKEN_HEADER'),
./lib/backup.php:        getenv('PIELARMONIA_BACKUP_WEBHOOK_TOKEN_HEADER')
./cron.php: *   GET /cron.php?action=reminders&token=YOUR_CRON_SECRET
./cron.php: *   GET /cron.php?action=backup-health&token=YOUR_CRON_SECRET
./cron.php: *   GET /cron.php?action=backup-offsite&token=YOUR_CRON_SECRET
./cron.php: *   0 18 * * * curl -s "https://pielarmonia.com/cron.php?action=reminders&token=YOUR_CRON_SECRET"
./cron.php: *   10 3 * * * curl -s "https://pielarmonia.com/cron.php?action=backup-health&token=YOUR_CRON_SECRET"
./cron.php: *   20 3 * * * curl -s "https://pielarmonia.com/cron.php?action=backup-offsite&token=YOUR_CRON_SECRET"
./cron.php:$secret = getenv('PIELARMONIA_CRON_SECRET');
./cron.php:    cron_json(['ok' => false, 'error' => 'CRON_SECRET no configurado'], 500);
./admin.html:            <p class="login-hint">Configura la clave en <code>PIELARMONIA_ADMIN_PASSWORD</code> en producción.</p>
./CONFIGURAR-TELEGRAM-WEBHOOK.ps1:Write-Host "Secret token (guardar en FIGO_TELEGRAM_WEBHOOK_SECRET): $SecretToken"

## Scan Complete
