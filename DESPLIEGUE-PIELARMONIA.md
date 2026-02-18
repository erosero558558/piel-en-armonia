# Despliegue en pielarmonia.com

## Archivos a subir

Sube estos archivos a la raiz del hosting (`public_html` o equivalente):

- `index.html`
- `styles.css`
- `script.js`
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
- carpeta `data/` (con permisos de escritura)
- `SMOKE-PRODUCCION.ps1`
- `VERIFICAR-DESPLIEGUE.ps1`
- `BENCH-API-PRODUCCION.ps1`

Notas:
- El frontend ahora consume `figo-chat.php` para el chatbot IA.
- Si ya existe `figo-chat.php` en tu servidor, mantenlo publicado.
- `proxy.php` queda deshabilitado por seguridad (retorna 410).

## Requisitos de servidor

- PHP 7.4 o superior
- Sesiones PHP habilitadas (para `admin-auth.php`)
- Permisos de escritura para la carpeta `data/`

## Variables de entorno (produccion)

Configura estas variables en tu hosting:

- `PIELARMONIA_ADMIN_PASSWORD` (obligatoria para login admin)
- `PIELARMONIA_ADMIN_PASSWORD_HASH` (opcional, tiene prioridad)
- `PIELARMONIA_ADMIN_EMAIL` (recomendada para recibir aviso de nuevas citas)
- `PIELARMONIA_EMAIL_FROM` (opcional, para correos de confirmación)
- `PIELARMONIA_DATA_DIR` (opcional, para forzar ruta de datos si `public_html/data` no tiene permisos)
- `PIELARMONIA_DATA_ENCRYPTION_KEY` (opcional, recomendado para cifrado en reposo de `store.json`)
- `FIGO_CHAT_ENDPOINT` (obligatoria para conectar el chatbot real)
- `FIGO_CHAT_TOKEN` (opcional, token Bearer para backend Figo)
- `FIGO_CHAT_APIKEY_HEADER` y `FIGO_CHAT_APIKEY` (opcionales, si tu backend usa API key custom)
- `FIGO_CHAT_TIMEOUT_SECONDS` (opcional, default 20)
- `FIGO_CHAT_DEGRADED_MODE` (opcional: `true` para devolver respuesta de emergencia desde backend)

Importante:
- Ya no existe fallback `admin123`, incluso en local.
- Debes configurar `PIELARMONIA_ADMIN_PASSWORD` o `PIELARMONIA_ADMIN_PASSWORD_HASH`.
- Para notificaciones por email al administrador, configura `PIELARMONIA_ADMIN_EMAIL`.
- Para cifrado de datos en reposo, configura `PIELARMONIA_DATA_ENCRYPTION_KEY` (32 bytes o texto que se deriva a SHA-256).
- Si no puedes usar variables de entorno, tambien puedes crear `data/figo-config.json`.

Ejemplo de `data/figo-config.json`:
```json
{
  "endpoint": "https://TU_BACKEND_FIGO/chat",
  "token": "TOKEN_OPCIONAL",
  "apiKeyHeader": "X-API-Key",
  "apiKey": "APIKEY_OPCIONAL",
  "timeout": 20
}
```

## Verificaciones rapidas

1. Salud API:
- `https://pielarmonia.com/api.php?resource=health`
- Validar campos nuevos: `timingMs`, `version`, `dataDirWritable`, `storeEncrypted`, `figoConfigured`, `figoRecursiveConfig`.

2. Admin auth status:
- `https://pielarmonia.com/admin-auth.php?action=status`

3. Bot Figo:
- `https://pielarmonia.com/figo-chat.php`
- Validar diagnostico: `mode`, `recursiveConfigDetected`, `upstreamReachable`.

4. Sitio:
- `https://pielarmonia.com/index.html`

5. Panel:
- `https://pielarmonia.com/admin.html`

6. Verificacion de paridad de despliegue:
- `.\VERIFICAR-DESPLIEGUE.ps1 -Domain "https://pielarmonia.com" -RunSmoke`

7. Bench de latencia (p95):
- `.\BENCH-API-PRODUCCION.ps1 -Domain "https://pielarmonia.com" -Runs 25 -IncludeFigoPost`

## Notas importantes

- El chatbot del sitio usa `figo-chat.php`.
- Los datos de citas, callbacks, reseñas y disponibilidad se guardan en backend (`data/store.json`).
- El backend registra auditoria de accesos/eventos en `data/audit.log`.
- Si `figo-chat.php` falla, el chatbot mantiene fallback local para no romper UX.
- Para entorno local, revisa `SERVIDOR-LOCAL.md`.
