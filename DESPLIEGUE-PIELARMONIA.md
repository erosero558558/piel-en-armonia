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
- `api.php`
- `api-lib.php`
- `admin-auth.php`
- carpeta `data/` (con permisos de escritura)

Notas:
- El frontend ahora consume `figo-chat.php` para el chatbot IA.
- Si ya existe `figo-chat.php` en tu servidor, mantenlo publicado.

## Requisitos de servidor

- PHP 7.4 o superior
- Sesiones PHP habilitadas (para `admin-auth.php`)
- Permisos de escritura para la carpeta `data/`

## Variables de entorno (produccion)

Configura estas variables en tu hosting:

- `PIELARMONIA_ADMIN_PASSWORD` (obligatoria para login admin)
- `PIELARMONIA_ADMIN_PASSWORD_HASH` (opcional, tiene prioridad)
- `PIELARMONIA_EMAIL_FROM` (opcional, para correos de confirmacion)

## Verificaciones rapidas

1. Salud API:
- `https://pielarmonia.com/api.php?resource=health`

2. Admin auth status:
- `https://pielarmonia.com/admin-auth.php?action=status`

3. Bot Figo:
- `https://pielarmonia.com/figo-chat.php`

4. Sitio:
- `https://pielarmonia.com/index.html`

5. Panel:
- `https://pielarmonia.com/admin.html`

## Notas importantes

- El chatbot del sitio usa `figo-chat.php`.
- Los datos de citas, callbacks, reseñas y disponibilidad se guardan en backend (`data/store.json`).
- Si `figo-chat.php` falla, el chatbot mantiene fallback local para no romper UX.
- Para entorno local, revisa `SERVIDOR-LOCAL.md`.

