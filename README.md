# Piel Armonía - Clínica Dermatológica y Estética

Bienvenido al repositorio de Piel Armonía, el sitio web y sistema de gestión para la clínica dermatológica. Este proyecto incluye un sistema de reservas, un panel administrativo, integración con chatbot IA y más.

## 📋 Características

- **Sitio Web Moderno**: Diseño responsive con carga diferida de recursos (CSS/JS) para optimizar el rendimiento.
- **Sistema de Reservas**: Motor de reservas (`booking-engine.js`) integrado.
- **Panel Administrativo**: Interfaz para gestionar citas, configuraciones y ver métricas (`admin.html`, `admin.js`).
- **Chatbot IA**: Integración con Figo/Clawbot para asistencia automatizada (`chat-engine.js`, `figo-chat.php`).
- **API Backend**: Endpoints RESTful en PHP para manejar la lógica de negocio (`api.php`).
- **Autenticación**: Sistema de login seguro para administradores (`admin-auth.php`).
- **Test E2E**: Pruebas automatizadas con Playwright.

## 🚀 Requisitos

- **PHP 7.4** o superior.
- **Node.js** (para ejecutar las pruebas con Playwright).
- **Composer** (para dependencias de PHP, si aplica).

## 🛠️ Instalación y Desarrollo Local

Para ejecutar el proyecto en tu entorno local:

1. **Clonar el repositorio**:
   ```bash
   git clone <url-del-repositorio>
   cd pielarmonia
   ```

2. **Configurar Variables de Entorno**:
   Para el funcionamiento del panel administrativo y otras características, necesitas configurar algunas variables de entorno. Puedes ver los detalles en [SERVIDOR-LOCAL.md](SERVIDOR-LOCAL.md).

   Ejemplo básico en PowerShell:
   ```powershell
   $env:PIELARMONIA_ADMIN_PASSWORD = "tu-clave-segura"
   ```

3. **Iniciar el Servidor PHP**:
   Utiliza el servidor integrado de PHP:
   ```bash
   php -S localhost:8000
   ```

4. **Acceder a la Aplicación**:
   - Sitio Web: [http://localhost:8000](http://localhost:8000)
   - Panel Admin: [http://localhost:8000/admin.html](http://localhost:8000/admin.html)
   - Health Check: [http://localhost:8000/api.php?resource=health](http://localhost:8000/api.php?resource=health)

## ⚙️ Configuración

Las variables de entorno principales son:

- `PIELARMONIA_ADMIN_PASSWORD`: Contraseña para el acceso administrativo.
- `PIELARMONIA_ADMIN_EMAIL`: Email para notificaciones administrativas.
- `FIGO_CHAT_ENDPOINT`: URL del backend del chatbot (si se usa).
- `PIELARMONIA_CRON_SECRET`: Token para ejecutar `cron.php` de forma segura.
- `PIELARMONIA_BACKUP_OFFSITE_URL`: Endpoint opcional para replicar backups offsite.

Para una lista completa y detalles sobre la configuración, consulta [SERVIDOR-LOCAL.md](SERVIDOR-LOCAL.md) y [DESPLIEGUE-PIELARMONIA.md](DESPLIEGUE-PIELARMONIA.md).

## 🧪 Pruebas

El proyecto utiliza Playwright para pruebas de extremo a extremo (E2E).

1. **Instalar dependencias**:
   ```bash
   npm install
   npx playwright install
   ```

2. **Ejecutar pruebas**:
   ```bash
   npm test
   ```

   Pruebas PHP (unitarias/integracion ligera):
   ```bash
   npm run test:php
   ```

   Para ver la interfaz gráfica de las pruebas:
   ```bash
   npm run test:ui
   ```

## 📦 Despliegue

Para instrucciones detalladas sobre cómo desplegar en producción, por favor revisa el archivo [DESPLIEGUE-PIELARMONIA.md](DESPLIEGUE-PIELARMONIA.md).

Comandos rapidos post-deploy (PowerShell, dominio por defecto https://pielarmonia.com):
- npm run verify:prod
- npm run smoke:prod
- npm run gate:prod
- npm run gate:prod:strict
- npm run monitor:prod
- powershell -NoProfile -ExecutionPolicy Bypass -File .\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com" -RequireBackupHealthy

Para probar otro dominio:
- powershell -NoProfile -ExecutionPolicy Bypass -File .\GATE-POSTDEPLOY.ps1 -Domain "https://tu-dominio.com"

Modo transicion (solo temporal): si el servidor aun no envia header CSP pero tu HTML incluye meta-CSP:
- powershell -NoProfile -ExecutionPolicy Bypass -File .\GATE-POSTDEPLOY.ps1 -Domain "https://tu-dominio.com" -AllowMetaCspFallback
## 📂 Estructura del Proyecto

- `api.php`: Punto de entrada principal para la API.
- `admin.html` / `admin.js`: Frontend del panel administrativo.
- `index.html`: Página principal.
- `booking-engine.js`: Lógica del sistema de reservas.
- `chat-engine.js`: Lógica del cliente del chatbot.
- `data/`: Directorio para almacenamiento de datos (JSON, logs).
- `tests/`: Scripts de prueba adicionales.

## 📄 Licencia

Este proyecto es privado y propiedad de Piel Armonía.

## Deploy automatico por GitHub Actions

Si no puedes subir archivos manualmente, deploy con:
- `.github/workflows/deploy-hosting.yml`
- `.github/workflows/post-deploy-gate.yml` (valida prod despues del sync git)
- `.github/workflows/prod-monitor.yml` (monitorea salud/latencia cada 30 min)
- `GITHUB-ACTIONS-DEPLOY.md` (paso a paso)

Nota: si tu servidor ya hace `git pull`/sync automatico cada 5 minutos, usa ese flujo como principal y deja este workflow solo como respaldo manual.

Configura en GitHub (repo -> Settings -> Secrets and variables -> Actions):
- Secrets: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`
- Variables opcionales: `FTP_PROTOCOL`, `FTP_SERVER_PORT`, `FTP_SECURITY`, `FTP_SERVER_DIR`, `PROD_URL`

Ejecucion:
- `git push` a `main` para deploy automatico.
- O `Actions -> Deploy Hosting (FTP/FTPS) -> Run workflow`.
- Usa `dry_run = true` para validar sin subir.
- Si falla `Timeout (control socket)`, prueba `protocol=ftp`, `server_port=21`.

