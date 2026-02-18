# Servidor Local

Para probar la web con backend (API + admin) no uses `file://`.

## Requisitos

- PHP 7.4 o superior
- endpoint local de chatbot en `figo-chat.php` (si quieres IA real en local)

## Iniciar en local

Desde la carpeta del proyecto:

```powershell
php -S localhost:8000
```

Luego abre:

- Sitio: `http://localhost:8000/index.html`
- Admin: `http://localhost:8000/admin.html`
- API health: `http://localhost:8000/api.php?resource=health`
- Bot endpoint: `http://localhost:8000/figo-chat.php`

## Variables de entorno requeridas para login admin

- `PIELARMONIA_ADMIN_PASSWORD`: contraseña del panel admin.
- `PIELARMONIA_ADMIN_PASSWORD_HASH`: hash de contraseña (opcional, prioridad sobre la contraseña en texto).
- `PIELARMONIA_EMAIL_FROM`: remitente para correos de confirmacion.
- `FIGO_CHAT_ENDPOINT`: URL del backend real de Figo (si quieres IA real).
- `FIGO_CHAT_TOKEN`: token Bearer opcional para autenticar contra Figo.

Alternativa sin variables de entorno:
- Crea `data/figo-config.json` con `endpoint` y credenciales opcionales.

Nota:
- Ya no existe fallback `admin123`. Debes definir una de las dos variables de contraseña.

## Ejemplo en PowerShell (sesión actual)

```powershell
$env:PIELARMONIA_ADMIN_PASSWORD = "tu-clave-segura"
php -S localhost:8000
```
