# Documentación Handoff de Piel Armonía

Este documento sirve como guía completa para desarrolladores que toman el control del proyecto Piel Armonía. Consolida información técnica, arquitectónica y operativa dispersa en otros documentos.

---

## 1. Visión General del Proyecto

**Piel Armonía** es una plataforma integral para una clínica dermatológica que incluye:
- **Sitio Web Público:** Single Page Application (SPA) ligera construida con Vanilla JS y Web Components.
- **Sistema de Reservas:** Motor de agendamiento (`booking-engine.js`) integrado con Google Calendar.
- **Panel Administrativo:** Interfaz separada (`admin.html`) para gestión de citas, métricas y configuración.
- **Chatbot IA:** Asistente virtual (`figo-chat.php`) potenciado por modelos LLM para atención al cliente 24/7.
- **Backend:** PHP 7.4+ con SQLite para almacenamiento local y JSON como respaldo.

---

## 2. Arquitectura del Sistema

El proyecto sigue una arquitectura modular "Micro-frontend" donde las funcionalidades clave (reservas, chat, admin) se cargan bajo demanda.

### 2.1 Frontend

- **Fuente (`src/`) vs. Artefactos (`js/`):**
  - Todo el desarrollo de lógica de negocio ocurre en `src/apps/` y `src/bundles/`.
  - **EXCEPCIÓN:** `js/main.js` es el punto de entrada principal y se considera código fuente.
  - El código se compila usando **Rollup** hacia `js/engines/` y `script.js`.
  - **NUNCA** edites archivos en `js/engines/` o `script.js` directamente; tus cambios serán sobrescritos.

- **Patrón de Lazy Loading:**
  - El sitio carga solo lo esencial (`script.js`, `styles.css`).
  - Módulos pesados (Booking, Chat, Admin modules) se cargan dinámicamente cuando el usuario interactúa o hace scroll.

### 2.2 Backend

- **PHP Puro:** No se utiliza un framework monolítico (Laravel/Symfony). Se usa una estructura personalizada ligera.
- **Base de Datos:**
  - Principal: `data/database.sqlite`.
  - Respaldo: Archivos JSON en `data/` (`store.json`, `reviews.json`).
- **API:**
  - `api.php`: Enrutador principal RESTful.
  - `lib/`: Clases de soporte (`db.php`, `auth.php`, `booking.php`).

---

## 3. Entorno de Desarrollo

### Requisitos Previos
- **PHP 7.4+**
- **Node.js 18+**
- **Composer**

### Instalación

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/erosero558558/piel-en-armonia.git
    cd piel-en-armonia
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install       # Herramientas de build y tests E2E
    composer install  # Dependencias de PHP (PHPMailer, etc.)
    ```

3.  **Configuración Local:**
    Copia `env.example.php` a `env.php` (si existe) o configura las variables de entorno en tu terminal.

    *Ejemplo PowerShell:*
    ```powershell
    $env:PIELARMONIA_ADMIN_PASSWORD = "admin123_TEST"
    php -S localhost:8000
    ```

4.  **Ejecutar Servidor:**
    Accede a `http://localhost:8000`.

---

## 4. Proceso de Build

El proyecto utiliza **Rollup** para empaquetar los módulos JS.

- **Build de Producción:**
    ```bash
    npm run build
    ```
    *Ejecuta esto después de cualquier cambio en `src/` o `js/main.js`.*

- **Desarrollo (Watch Mode):**
    ```bash
    npx rollup -c -w
    ```

---

## 5. Testing y Calidad

### 5.1 Tests E2E (Playwright)
Pruebas de extremo a extremo que simulan usuarios reales.

- **Ejecutar todos:**
    ```bash
    npm test
    ```
- **Requisito Crítico:** Debes tener definida `PIELARMONIA_ADMIN_PASSWORD` para que los tests de login funcionen.
- **Tests de Calendario:**
    ```bash
    npm run test:calendar-contract  # Solo lectura
    npm run test:calendar-write     # Escritura (requiere credenciales reales)
    ```

### 5.2 Tests Backend (PHP)
Pruebas unitarias e integración para la lógica de negocio.

- **Ejecutar:**
    ```bash
    npm run test:php
    ```
    *Nota: La cobertura actual es baja. Consultar `HANDOFF_JULES.md` para prioridades de testing.*

---

## 6. Despliegue

El despliegue se gestiona mediante scripts de PowerShell y GitHub Actions.

- **Scripts Clave (`root`):**
    - `GATE-POSTDEPLOY.ps1`: Verifica la salud del despliegue en producción.
    - `VERIFICAR-DESPLIEGUE.ps1`: Suite de comprobaciones (humo, assets, API).
    - `PREPARAR-PAQUETE-DESPLIEGUE.ps1`: Genera un `.zip` listo para FTP.

- **GitHub Actions:**
    - `.github/workflows/deploy-hosting.yml`: Despliegue automático via FTP.
    - `.github/workflows/post-deploy-gate.yml`: Validación post-deployment.

---

## 7. Variables de Entorno (Referencia Rápida)

Las más importantes para desarrollo y producción:

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `PIELARMONIA_ADMIN_PASSWORD` | Contraseña para el panel admin. | **SÍ** |
| `PIELARMONIA_CRON_SECRET` | Token para proteger `cron.php`. | **SÍ** |
| `FIGO_CHAT_ENDPOINT` | URL del backend del chatbot IA. | **SÍ** (Prod) |
| `PIELARMONIA_ADMIN_EMAIL` | Email para recibir notificaciones. | Opcional |
| `PIELARMONIA_DATA_ENCRYPTION_KEY` | Clave para cifrar datos en reposo. | Rec. (Prod) |

*Ver `SERVIDOR-LOCAL.md` y `DESPLIEGUE-PIELARMONIA.md` para la lista completa.*

---

## 8. Solución de Problemas (Troubleshooting)

- **Mis cambios en JS no se ven:**
    - ¿Ejecutaste `npm run build`?
    - ¿El navegador tiene caché fuerte? Prueba Incógnito o Hard Refresh.

- **Error 500 en Admin:**
    - Verifica permisos de escritura en la carpeta `data/`.
    - Verifica que `PIELARMONIA_ADMIN_PASSWORD` esté configurada.

- **Tests de Playwright fallan por Timeout:**
    - La carga diferida (`lazy loading`) puede ser lenta en CI. Aumenta los timeouts en `playwright.config.js` si es necesario.
    - Asegúrate de que los tests hacen "scroll" hasta el elemento para disparar la carga.

- **Assets (imágenes) rotos en subdirectorios:**
    - El loader de contenido (`content-loader.js`) maneja rutas relativas. Asegúrate de que las rutas en `content/index.json` sean correctas relativas a la raíz.

---

## 9. Contacto y Referencias

- **Repositorio:** https://github.com/erosero558558/piel-en-armonia.git
- **Documentación Adicional:**
    - `HANDOFF_JULES.md`: Tareas pendientes de QA.
    - `SERVIDOR-LOCAL.md`: Configuración detallada del entorno.
    - `DESPLIEGUE-PIELARMONIA.md`: Guía profunda de despliegue.
