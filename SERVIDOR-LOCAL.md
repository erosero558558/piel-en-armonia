# Servidor Local

Para probar la web con backend (API + admin + proxy) no uses `file://`.

## Requisitos

- PHP 7.4 o superior
- Extensión `curl` habilitada

## Iniciar en local

Desde la carpeta del proyecto:

```powershell
php -S localhost:8000
```

Luego abre:

- Sitio: `http://localhost:8000/index.html`
- Admin: `http://localhost:8000/admin.html`
- API health: `http://localhost:8000/api.php?resource=health`
- Proxy test: `http://localhost:8000/proxy.php`

## Variables de entorno recomendadas

- `KIMI_API_KEY`: API key de Moonshot/Kimi para chatbot IA.
- `PIELARMONIA_ADMIN_PASSWORD`: contraseña del panel admin.
- `PIELARMONIA_ADMIN_PASSWORD_HASH`: hash de contraseña (opcional, tiene prioridad sobre la contraseña en texto).
- `PIELARMONIA_EMAIL_FROM`: remitente para correos de confirmación.

## Ejemplo en PowerShell (sesión actual)

```powershell
$env:KIMI_API_KEY = "sk-..."
$env:PIELARMONIA_ADMIN_PASSWORD = "tu-clave-segura"
php -S localhost:8000
```

