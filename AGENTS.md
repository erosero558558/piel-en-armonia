# Instrucciones para Agentes de IA y Desarrolladores

Este documento proporciona información esencial para trabajar en el proyecto Piel Armonía - el sitio web y sistema de gestión de la clínica dermatológica.

---

## Resumen del Proyecto

Piel Armonía es una aplicación web completa para una clínica dermatológica que incluye:

- **Sitio web público**: Página principal con información de servicios, galería, y sistema de reservas.
- **Panel administrativo**: Interfaz para gestionar citas, configuraciones y métricas (`admin.html`, `admin.js`).
- **Sistema de reservas**: Motor de reservas con integración a Google Calendar (`booking-engine.js`).
- **Chatbot IA**: Asistente virtual integrado con Figo/Clawbot (`figo-chat.php`, `chat-engine.js`).
- **Procesamiento de pagos**: Integración con Stripe para pagos en línea.
- **API RESTful**: Backend en PHP para manejar la lógica de negocio (`api.php`).

---

## Stack Tecnológico

### Frontend
- **JavaScript ES2020+**: Código modular con imports/exports.
- **CSS**: Estilos divididos en críticos (`styles-critical.css`) y diferidos (`styles-deferred.css`).
- **HTML**: Páginas estáticas con carga dinámica de contenido.
- **PWA**: Service Worker para funcionalidad offline (`sw.js`).

### Backend
- **PHP 7.4+**: Con tipado estricto (`declare(strict_types=1)`).
- **Almacenamiento**: JSON files en `data/` con fallback a SQLite opcional.
- **Caché**: Redis para rate limiting y caché de disponibilidad.
- **Email**: PHPMailer para notificaciones.
- **Monitoreo**: Sentry para errores, Prometheus/Grafana para métricas.

### Integraciones
- **Google Calendar**: Para sincronización de disponibilidad real.
- **Stripe**: Procesamiento de pagos.
- **Turnstile**: Protección CAPTCHA.
- **Telegram**: Puente para el chatbot.
- **OpenAI/OpenRouter**: Respuestas naturales del chatbot.

---

## Estructura de Directorios

```
├── js/                     # Módulos JavaScript fuente (NO editar scripts generados)
│   ├── main.js            # Punto de entrada principal
│   ├── *.js               # Módulos compartidos (loader, state, utils, etc.)
│   └── engines/           # Scripts generados por el build
├── src/                   # Código fuente de aplicaciones
│   ├── apps/              # Aplicaciones específicas
│   │   ├── admin/         # Panel administrativo
│   │   ├── booking/       # Sistema de reservas
│   │   ├── chat/          # Chatbot (UI, widget, motor, booking)
│   │   ├── analytics/     # Motor de analíticas
│   │   └── ...
│   └── bundles/           # Bundles específicos
├── lib/                   # Librerías PHP (autoloaded)
│   ├── ApiKernel.php      # Núcleo de la API
│   ├── Router.php         # Enrutador
│   ├── BookingService.php # Lógica de reservas
│   └── *.php              # Utilidades y helpers
├── controllers/           # Controladores de API
│   ├── AppointmentController.php
│   ├── AvailabilityController.php
│   ├── PaymentController.php
│   └── ...
├── data/                  # Almacenamiento JSON (no versionado)
├── tests/                 # Pruebas E2E (Playwright) y PHP (PHPUnit)
├── uploads/               # Archivos subidos por usuarios
└── .github/workflows/     # CI/CD con GitHub Actions
```

---

## Proceso de Build

### Comandos principales

```bash
# Instalar dependencias
npm install
composer install

# Compilar el proyecto (genera scripts.js, admin.js, etc.)
npm run build

# Formatear código
npm run format

# Linting
npm run lint          # JavaScript y PHP
npm run lint:js       # Solo JavaScript
npm run lint:php      # Solo PHP
```

### Configuración de Build

El build utiliza **Rollup** (configurado en `rollup.config.mjs`):

- **Entrada**: Archivos en `js/main.js`, `src/apps/*/index.js`
- **Salida**: Scripts generados en raíz y `js/engines/`
- **Formatos**: ES modules (para apps modernas) e IIFE (para compatibilidad)

### Archivos Generados (NO editar directamente)

Estos archivos se regeneran con `npm run build`:

- `script.js` ← `js/main.js`
- `admin.js` ← `src/apps/admin/index.js`
- `js/engines/booking-engine.js` ← `src/apps/booking/engine.js`
- `js/engines/booking-ui.js` ← `src/apps/booking/ui-entry.js`
- `js/booking-calendar.js` ← `src/apps/booking/components/calendar.js`
- `js/engines/chat-*.js` ← `src/apps/chat/*.js`
- `js/engines/*-bundle.js` ← `src/bundles/*.js`

---

## Configuración del Entorno

Copiar `env.example.php` a `env.php` y configurar:

### Variables críticas

```php
// Administrador
putenv('PIELARMONIA_ADMIN_PASSWORD=tu_clave_segura');
putenv('PIELARMONIA_ADMIN_EMAIL=admin@ejemplo.com');

// Google Calendar (Service Account)
putenv('PIELARMONIA_GOOGLE_SA_CLIENT_EMAIL=...');
putenv('PIELARMONIA_GOOGLE_SA_PRIVATE_KEY_B64=...');
putenv('PIELARMONIA_AVAILABILITY_SOURCE=google');

// Stripe
putenv('PIELARMONIA_STRIPE_SECRET_KEY=sk_live_...');
putenv('PIELARMONIA_STRIPE_PUBLISHABLE_KEY=pk_live_...');

// Chatbot Figo
putenv('FIGO_CHAT_ENDPOINT=https://backend-figo.example/chat');
putenv('FIGO_CHAT_TOKEN=...');

// IA para respuestas naturales
putenv('FIGO_AI_ENDPOINT=https://openrouter.ai/api/v1/chat/completions');
putenv('FIGO_AI_API_KEY=sk-or-v1-...');

// SMTP (Gmail)
putenv('PIELARMONIA_SMTP_HOST=smtp.gmail.com');
putenv('PIELARMONIA_SMTP_USER=...');
putenv('PIELARMONIA_SMTP_PASS=...');
```

Ver `env.example.php` para la lista completa.

---

## Guía de Desarrollo

### Convenciones de Código

#### JavaScript
- **Estilo**: ES2020+, módulos ES6 (`import`/`export`).
- **Linting**: ESLint con configuración en `eslint.config.js`.
- **Formato**: Prettier con 4 espacios, punto y coma, comillas simples.
- **Patrón**: Módulos con inicialización diferida usando `loader.js`.

#### PHP
- **Estilo**: PSR-12 (configurado en `.php-cs-fixer.dist.php`).
- **Tipado**: Estricto obligatorio en todos los archivos.
- **Autoloading**: PSR-4 desde `lib/`.
- **Controladores**: Clases con métodos estáticos o instancia según el caso.

### Estructura de una petición API

```
GET/POST api.php?resource={nombre}&v=1
```

- **Routing**: `ApiKernel` → `Router` → `Controller`
- **Autenticación**: Sesión PHP para endpoints admin, CORS para públicos.
- **Rate Limiting**: Configurado en `ApiConfig.php`.
- **CSRF**: Validación obligatoria en mutaciones autenticadas.

### Agregar un nuevo endpoint API

1. Crear método en el controlador correspondiente (o nuevo archivo en `controllers/`).
2. Registrar la ruta en `lib/routes.php`:

```php
$router->add('GET', 'mi-recurso', [MiController::class, 'miMetodo']);
```

3. Si es público, agregar a `ApiConfig::getPublicEndpoints()`.

---

## Testing

### Playwright (E2E)

```bash
# Ejecutar todas las pruebas
npm test

# Con interfaz gráfica
npm run test:ui

# Solo pruebas de Google Calendar (lectura)
npm run test:calendar-contract

# Pruebas de escritura en Google Calendar
TEST_ENABLE_CALENDAR_WRITE=true TEST_ADMIN_PASSWORD="..." npm run test:calendar-write

# Contra producción
TEST_BASE_URL=https://pielarmonia.com npm test
```

### PHP (PHPUnit)

```bash
# Ejecutar pruebas PHP
npm run test:php

# O directamente
php vendor/bin/phpunit
```

Suites disponibles: Unit, Booking, Payment, Security, Integration.

### Validación post-despliegue

```bash
# Windows PowerShell
npm run verify:prod    # Verificación básica
npm run smoke:prod     # Smoke tests
npm run gate:prod      # Validación completa
npm run monitor:prod   # Monitoreo continuo
```

---

## Despliegue

### GitHub Actions

- **CI**: Ejecuta linting y pruebas en cada push.
- **Deploy Hosting**: Pipeline canario (staging → producción) vía FTP/FTPS.
- **Secrets requeridos**: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`.

### Despliegue Manual (PowerShell)

```powershell
# Preparar paquete
npm run bundle:deploy

# Verificar producción
powershell -File .\VERIFICAR-DESPLIEGUE.ps1 -Domain "https://pielarmonia.com"

# Validación completa post-deploy
powershell -File .\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com"
```

### Docker (Desarrollo)

```bash
docker-compose up -d
# Accesible en http://localhost:8080
# Grafana en http://localhost:3000
# Prometheus en http://localhost:9090
```

---

## Consideraciones de Seguridad

### Headers de seguridad

Todos los endpoints aplican headers vía `apply_security_headers()`:
- CSP (Content Security Policy) estricto.
- HSTS, X-Frame-Options, X-Content-Type-Options.
- Referrer-Policy.

### Autenticación

- **Admin**: Sesiones PHP con CSRF tokens.
- **API Pública**: Rate limiting por IP.
- **Webhooks**: Validación de firma (Stripe).

### Datos sensibles

- `env.php` está en `.gitignore` y NUNCA se sube al repositorio.
- Claves de API en variables de entorno.
- Backup de datos en `data/` - proteger en producción.

---

## Flujo de Trabajo Típico

1. **Crear rama**: `git checkout -b feature/nueva-funcionalidad`
2. **Editar fuentes**:
   - JS: Modificar en `js/` o `src/`, NO en scripts generados.
   - PHP: Modificar en `lib/` o `controllers/`.
3. **Build**: `npm run build`
4. **Probar**: `npm test` y `npm run test:php`
5. **Commit**: Husky ejecuta linting automáticamente.
6. **Push**: CI ejecuta pruebas y linting.
7. **Deploy**: Merge a `main` desencadena deploy automático (si está configurado).

---

## Notas Importantes

- **NO editar** `script.js`, `admin.js`, `booking-engine.js`, etc. directamente. Siempre modificar el código fuente y ejecutar `npm run build`.
- La naturaleza "monolítica" de los scripts generados es una optimización intencional de build.
- El sistema de reservas requiere configuración de Google Calendar para funcionar en producción.
- El chatbot puede operar en modo degradado si el backend Figo no está disponible.
- Los assets usan versionado por query string (`?v=figo-20260221...`) para invalidación de caché.
