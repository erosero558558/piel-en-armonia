# Despliegue en pielarmonia.com

## Deploy automatico sin subir manual

Si desde tu PC no puedes subir por FTP/SFTP, usa el workflow:
- `.github/workflows/deploy-hosting.yml`
- `GITHUB-ACTIONS-DEPLOY.md` (paso a paso)

Si tu hosting ya tiene sincronizacion por Git (pull automatico), ese metodo es el recomendado y mas seguro.
En ese caso ejecuta el gate automatico con:
- `.github/workflows/post-deploy-gate.yml` (se dispara en push a `main` y valida produccion en modo estricto).
Para monitoreo continuo, habilita:
- `.github/workflows/prod-monitor.yml` (salud + latencia cada 30 minutos).

Configura en GitHub (repo -> Settings -> Secrets and variables -> Actions):
- Secrets: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`
- Variables opcionales: `FTP_PROTOCOL`, `FTP_SERVER_PORT`, `FTP_SECURITY`, `FTP_SERVER_DIR` (`/public_html/`), `PROD_URL`

Uso:
- Push a `main`: deploy automatico.
- Manual: Actions -> `Deploy Hosting (FTP/FTPS)` -> `Run workflow`.
- Prueba sin cambios: `dry_run = true`.
- Si falla `Timeout (control socket)`: prueba `protocol=ftp`, `server_port=21`.

## Archivos a subir

Sube estos archivos a la raiz del hosting (`public_html` o equivalente):

- `index.html`
- `index.php`
- `styles.css`
- `styles-deferred.css`
- `script.js`
- `chat-engine.js`
- `booking-engine.js`
- `translations-en.js`
- `terminos.html`
- `privacidad.html`
- `cookies.html`
- `aviso-medico.html`
- `legal.css`
- `hero-woman.jpg`
- `admin.html`
- `admin.css`
- `admin.js`
- `api.php`
- `api-lib.php`
- `admin-auth.php`
- `figo-chat.php`
- `figo-backend.php`
- `.htaccess`
- carpeta `vendor/` (dependencias instaladas)
- carpeta `data/` (con permisos de escritura)
- `SMOKE-PRODUCCION.ps1`
- `VERIFICAR-DESPLIEGUE.ps1`
- `BENCH-API-PRODUCCION.ps1`
- `GATE-POSTDEPLOY.ps1`
- `CONFIGURAR-TELEGRAM-WEBHOOK.ps1`

Atajo recomendado para preparar un paquete listo para subir:
- `npm run bundle:deploy`
- Esto genera un `.zip` en `_deploy_bundle/` con `manifest-sha256.txt`.

Notas:
- El frontend ahora consume `figo-chat.php` para el chatbot IA.
- El motor pesado del chat se carga en diferido desde `chat-engine.js`.
- El flujo de reserva/pago se carga en diferido desde `booking-engine.js`.
- El CSS se divide en `styles.css` (critico) y `styles-deferred.css` (diferido).
- Las traducciones EN se cargan bajo demanda desde `translations-en.js`.
- `.htaccess` ahora aplica Brotli/gzip y politicas de cache: estaticos con `max-age`, API critica con `no-store`.
- `index.php` ahora entrega la home con cabeceras de seguridad (incluye CSP) cuando el servidor enruta `/` a PHP.
- Si ya existe `figo-chat.php` en tu servidor, mantenlo publicado.
- `proxy.php` queda deshabilitado por seguridad (retorna 410).

## Requisitos de servidor

- PHP 7.4 o superior
- Sesiones PHP habilitadas (para `admin-auth.php`)
- Permisos de escritura para la carpeta `data/`
- Dependencias de PHP instaladas (subir carpeta `vendor/` o ejecutar `composer install`)

## Variables de entorno (produccion)

Configura estas variables en tu hosting:

- `PIELARMONIA_ADMIN_PASSWORD` (obligatoria para login admin)
- `PIELARMONIA_ADMIN_PASSWORD_HASH` (opcional, tiene prioridad)
- `PIELARMONIA_ADMIN_EMAIL` (recomendada para recibir aviso de nuevas citas)
- `PIELARMONIA_EMAIL_FROM` (opcional, para correos de confirmaciÃ³n)
- `PIELARMONIA_DATA_DIR` (opcional, para forzar ruta de datos si `public_html/data` no tiene permisos)
- `PIELARMONIA_DATA_ENCRYPTION_KEY` (opcional, recomendado para cifrado en reposo de `store.json`)
- `FIGO_CHAT_ENDPOINT` (obligatoria para conectar el chatbot real)
- `FIGO_CHAT_TOKEN` (opcional, token Bearer para backend Figo)
- `FIGO_CHAT_APIKEY_HEADER` y `FIGO_CHAT_APIKEY` (opcionales, si tu backend usa API key custom)
- `FIGO_CHAT_TIMEOUT_SECONDS` (opcional, default 20)
- `FIGO_CHAT_DEGRADED_MODE` (opcional: `true` para forzar fallback; por defecto es auto y prioriza `live` cuando upstream esta sano)
- `FIGO_TELEGRAM_BOT_TOKEN` (opcional, para puente/notificaciÃ³n Telegram en `figo-backend.php`)
- `FIGO_TELEGRAM_CHAT_ID` (opcional, chat destino para notificaciones Telegram)
- `FIGO_TELEGRAM_WEBHOOK_SECRET` (recomendado, valida peticiones webhook de Telegram)
- `PIELARMONIA_CRON_SECRET` (obligatoria para `cron.php`)
- `PIELARMONIA_BACKUP_MAX_AGE_HOURS` (opcional, default 24)
- `PIELARMONIA_BACKUP_OFFSITE_URL` (opcional, endpoint externo para snapshots)
- `PIELARMONIA_BACKUP_OFFSITE_TOKEN` (opcional)
- `PIELARMONIA_BACKUP_OFFSITE_TOKEN_HEADER` (opcional, default `Authorization`)
- `PIELARMONIA_BACKUP_OFFSITE_TIMEOUT_SECONDS` (opcional, default 20)
- `PIELARMONIA_BACKUP_LOCAL_REPLICA` (opcional, default `true`, replica local en `data/backups/offsite-local/`)
- `PIELARMONIA_BACKUP_RECEIVER_TOKEN` (solo cuando este servidor actua como destino de `backup-receiver.php`)
- `PIELARMONIA_BACKUP_RECEIVER_MAX_MB` (opcional, limite de subida en MB del receiver)

Importante:
- Ya no existe fallback `admin123`, incluso en local.
- Debes configurar `PIELARMONIA_ADMIN_PASSWORD` o `PIELARMONIA_ADMIN_PASSWORD_HASH`.
- Para notificaciones por email al administrador, configura `PIELARMONIA_ADMIN_EMAIL`.
- Para cifrado de datos en reposo, configura `PIELARMONIA_DATA_ENCRYPTION_KEY` (32 bytes o texto que se deriva a SHA-256).
- Si no puedes usar variables de entorno, tambien puedes crear `data/figo-config.json`.
- `FIGO_CHAT_ENDPOINT` NO debe ser `https://pielarmonia.com/figo-chat.php` ni ninguna URL que apunte al mismo proxy.
  Debe apuntar al backend real de Clawbot/Figo (upstream).

Ejemplo recomendado de `data/figo-config.json`:
```json
{
  "endpoint": "https://TU_DOMINIO/figo-backend.php",
  "token": "TOKEN_OPCIONAL",
  "apiKeyHeader": "X-API-Key",
  "apiKey": "APIKEY_OPCIONAL",
  "timeout": 20,
  "ai": {
    "endpoint": "https://openrouter.ai/api/v1/chat/completions",
    "apiKey": "sk-or-v1-REEMPLAZAR",
    "model": "arcee-ai/trinity-large-preview:free"
  },
  "allowLocalFallback": true
}
```

## Verificaciones rapidas

1. Salud API:
- `https://pielarmonia.com/api.php?resource=health`
- Validar campos nuevos: `timingMs`, `version`, `dataDirWritable`, `storeEncrypted`, `figoConfigured`, `figoRecursiveConfig`.
- Revisar `checks.backup`: `enabled`, `ok`, `latestAgeHours`, `offsiteConfigured`.

2. Admin auth status:
- `https://pielarmonia.com/admin-auth.php?action=status`

3. Bot Figo:
- `https://pielarmonia.com/figo-chat.php`
- Validar diagnostico: `mode`, `recursiveConfigDetected`, `upstreamReachable`.

3.1 Backend Figo local (opcional):
- `https://pielarmonia.com/figo-backend.php`
- Debe responder JSON con `ok: true` en GET.

3.2 Configurar webhook Telegram (si quieres que @figo64_bot responda con el mismo motor):
- `.\CONFIGURAR-TELEGRAM-WEBHOOK.ps1 -BotToken "TOKEN_ROTADO" -WebhookUrl "https://pielarmonia.com/figo-backend.php"`
- Guarda el secret mostrado por el script en `FIGO_TELEGRAM_WEBHOOK_SECRET`.

4. Sitio:
- `https://pielarmonia.com/`
- `https://pielarmonia.com/index.html`
- Validar en `/` header `Content-Security-Policy` presente.

5. Panel:
- `https://pielarmonia.com/admin.html`

6. Verificacion de paridad de despliegue:
- `.\VERIFICAR-DESPLIEGUE.ps1 -Domain "https://pielarmonia.com" -RunSmoke`
- Si estas en ventana de mantenimiento y aceptas modo degradado temporal:
  - `.\VERIFICAR-DESPLIEGUE.ps1 -Domain "https://pielarmonia.com" -RunSmoke -AllowDegradedFigo -AllowRecursiveFigo`

7. Bench de latencia (p95):
- `.\BENCH-API-PRODUCCION.ps1 -Domain "https://pielarmonia.com" -Runs 25 -IncludeFigoPost`

8. Gate completo post-deploy (recomendado):
- `.\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com" -RequireWebhookSecret`
- (Temporal, solo mientras corriges headers en edge/servidor) `.\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com" -AllowMetaCspFallback`
- Para exigir backups sanos en el gate: `.\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com" -RequireBackupHealthy`
- Para exigir almacenamiento persistente (no /tmp): `.\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com" -RequireStableDataDir`

9. Verificacion de cron de backup:
- `https://pielarmonia.com/cron.php?action=backup-health&token=YOUR_CRON_SECRET`
- `https://pielarmonia.com/cron.php?action=backup-offsite&dryRun=1&token=YOUR_CRON_SECRET`
- (Recomendado) `curl -s "https://pielarmonia.com/cron.php?action=backup-health" -H "Authorization: Bearer YOUR_CRON_SECRET"`
- (Recomendado) `curl -s "https://pielarmonia.com/cron.php?action=backup-offsite&dryRun=1" -H "X-Cron-Token: YOUR_CRON_SECRET"`

10. Replica remota real (opcional):
- Publica `backup-receiver.php` en servidor destino.
- Configura token en destino (`PIELARMONIA_BACKUP_RECEIVER_TOKEN`).
- En origen configura:
  `PIELARMONIA_BACKUP_OFFSITE_URL=https://DESTINO/backup-receiver.php`
  `PIELARMONIA_BACKUP_OFFSITE_TOKEN=<TOKEN>`
- Script de ayuda: `.\CONFIGURAR-BACKUP-OFFSITE.ps1`

## Notas importantes

- El chatbot del sitio usa `figo-chat.php`.
- Los datos de citas, callbacks, reseÃ±as y disponibilidad se guardan en backend (`data/store.json`).
- El backend registra auditoria de accesos/eventos en `data/audit.log`.
- Si `figo-chat.php` falla, el chatbot mantiene fallback local para no romper UX.
- Para entorno local, revisa `SERVIDOR-LOCAL.md`.
