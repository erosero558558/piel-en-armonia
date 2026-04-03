# Aurora Derm

Plataforma clínica para dermatología. Una clínica, un producto.

---

## Qué es esto

Aurora Derm es el software interno y la presencia digital de una clínica dermatológica. Incluye:

- **Sitio web público** — landing, servicios, blog, booking online
- **Portal del paciente** — historial clínico, recetas, plan de tratamiento, consentimientos, pagos
- **Dashboard médico** (`admin.html`) — HCE, OpenClaw IA, gestión de citas y pacientes
- **Sistema de turnos** — kiosco físico, sala de espera, consola del operador
- **API PHP** — único backend (`api.php`) con 188 rutas

## Stack

| Capa | Tecnología |
|---|---|
| Backend | PHP 8.x, `api.php` entry point |
| Base de datos | MySQL |
| Frontend | HTML + CSS + JS vanilla |
| Sitio público | Astro (build estático en `src/apps/astro/`) |
| Chat / IA | OpenClaw + Figo engine (`figo-*.php`) |
| Pagos | Stripe (`payment-lib.php`) |
| Deploy | Shared hosting (cPanel) |

## Estructura del repositorio

```
aurora-derm/
├── api.php                   # Entry point único de la API
├── cron.php                  # Jobs programados
├── admin.html                # Dashboard médico
├── kiosco-turnos.html        # Pantalla del kiosco
├── operador-turnos.html      # Consola del operador
├── sala-turnos.html          # Pantalla de sala de espera
│
├── controllers/              # Controladores PHP (25 archivos)
├── lib/                      # Servicios y librerías PHP
│   ├── routes.php            # Tabla de rutas (fuente de verdad)
│   ├── auth.php              # Autenticación
│   └── ...
│
├── es/                       # Sitio web en español
│   ├── portal/               # Portal del paciente (PWA)
│   └── ...
├── js/                       # JavaScript del frontend
├── styles/                   # CSS del sistema de diseño
│
├── data/                     # Runtime data y protocolos clínicos
├── content/                  # Contenido del blog
├── images/ + fonts/          # Assets
│
├── tests/                    # PHPUnit + Playwright
├── tests-node/               # Tests Node.js
├── bin/                      # Scripts de desarrollo (15 scripts)
├── ops/                      # Infraestructura y deploy
├── k8s/                      # Kubernetes manifests
├── .github/                  # CI/CD workflows
│
└── docs/
    ├── API.md                # Referencia de la API
    ├── ARCHITECTURE.md       # Decisiones de arquitectura
    ├── DEPLOYMENT.md         # Cómo hacer deploy
    └── openapi.yaml          # Spec OpenAPI
```

## Desarrollo local

```bash
# Servidor PHP
npm run dev
# → http://localhost:8000

# Tests
npm run test          # PHPUnit smoke + rutas
npm run test:node     # Tests Node.js
npm run test:e2e      # Playwright end-to-end

# Calidad
npm run lint          # PHP syntax + ESLint
npm run gate          # Gate de calidad antes de mergear
npm run verify        # Smoke de integridad del repositorio
npm run smoke         # Smoke de producción
```

## Deploy

Ver [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Arquitectura

Ver [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## API

Ver [`docs/API.md`](docs/API.md) o [`docs/openapi.yaml`](docs/openapi.yaml).

---

## Convenciones de código

- **PHP**: PSR-12, tipado estricto (`declare(strict_types=1)`)
- **JS**: ES2022+, sin frameworks en el portal del paciente
- **Commits**: `type(scope): descripción` — ej: `fix(portal): corregir nav bar`
- **Branches**: `feature/descripción`, `fix/descripción`
- **No** hay agentes autónomos, no hay orquestadores, no hay claims. Un desarrollador, un commit a la vez.

## Contacto y acceso

Ver `env.example.php` para variables de entorno requeridas.
