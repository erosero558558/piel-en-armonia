# Despliegue en pielarmonia.com

## Archivos a subir

Sube estos archivos a la raiz del hosting (`public_html` o equivalente):

- `index.html`
- `styles.css`
- `script.js`
- `hero-woman.jpg`
- `admin.html`
- `admin.css`
- `admin.js`
- `proxy.php`
- `api.php`
- `admin-auth.php`
- `api-lib.php`
- carpeta `data/` (con permisos de escritura)

## Requisitos de servidor

- PHP 7.4 o superior
- `curl` habilitado (para `proxy.php`)
- Sesiones PHP habilitadas (para `admin-auth.php`)
- Permisos de escritura para la carpeta `data/`

## Variables de entorno (produccion)

Configura estas variables en tu hosting:

- `KIMI_API_KEY` (obligatoria para IA real en el chatbot)
- `PIELARMONIA_ADMIN_PASSWORD` (obligatoria para login admin)
- `PIELARMONIA_ADMIN_PASSWORD_HASH` (opcional, tiene prioridad)
- `PIELARMONIA_EMAIL_FROM` (opcional, para correos de confirmacion)

## Verificaciones rapidas

1. Salud API:
- `https://pielarmonia.com/api.php?resource=health`

2. Proxy:
- `https://pielarmonia.com/proxy.php`

3. Admin auth status:
- `https://pielarmonia.com/admin-auth.php?action=status`

4. Sitio:
- `https://pielarmonia.com/index.html`

5. Panel:
- `https://pielarmonia.com/admin.html`

## Notas importantes

- El chatbot ahora usa `proxy.php` (ya no `figo-chat.php`).
- Los datos de citas, callbacks, reseñas y disponibilidad se guardan en backend (`data/store.json`).
- Si no configuras `KIMI_API_KEY`, el chatbot sigue funcionando con respuestas offline.
- Para entorno local, revisa `SERVIDOR-LOCAL.md`.

