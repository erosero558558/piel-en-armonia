## Backlog de Producto — Dirección Opus 4.6

> **Arquitectura del producto:**
> Aurora Derm tiene dos caras: (1) la clínica dermatológica que necesita pacientes, y (2) Flow OS, el sistema operativo que gestiona toda la operación clínica.
>
> **Regla de ejecución:** cada agente al recibir "continua" toma la primera tarea `[ ]` del sprint actual.
> No saltar sprints. Marcar `[x]` al completar. Commit con ID de tarea.
>
> **Tags:** `[S]` = small (1-2 archivos), `[M]` = medium (3-5 archivos), `[L]` = large (componente nuevo), `[XL]` = extra large (sistema)
> `[HUMAN]` = requiere input del dueño (no ejecutar solo, preguntar y esperar respuesta)

### Identidad del producto

**Aurora Derm** — Clínica dermatológica con enfoque médico real en Quito, Ecuador.

| Dato                       | Valor                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| Nombre comercial           | Aurora Derm                                                                                            |
| Dominio                    | pielarmonia.com                                                                                        |
| WhatsApp                   | +593 98 245 3672 → `https://wa.me/593982453672`                                                        |
| Ciudad                     | Quito, Ecuador (2800 msnm, exposición UV alta)                                                         |
| Directora                  | Dra. Rosero — MSP-EC, S.E.D., Board Certified                                                          |
| Especialista láser         | Dr. Narváez — MSP-EC, LASER Board, Oncología Cutánea                                                   |
| Servicios core             | Diagnóstico integral, láser fraccionado, bioestimuladores, acné, tamizaje oncológico, teledermatología |
| Plataforma                 | Flow OS — sistema operativo de la operación clínica                                                    |
| Nombre técnico del turnero | Turnero Clínicas (nombre público del módulo SaaS)                                                      |

### Design system — Tokens CSS

Cualquier página nueva DEBE usar estas variables. Nunca hardcodear colores.

```css
/* Fondos */
--bg-base:
    #07090c /* fondo principal — casi negro */
        --bg-surface: rgba(255, 255, 255, 0.03) /* tarjetas sutiles */
        --bg-card: rgba(255, 255, 255, 0.04) /* cards elevadas */ /* Bordes */
        --border: rgba(255, 255, 255, 0.08)
        --border-hover: rgba(255, 255, 255, 0.18) /* Textos */ --text: #ffffff
        /* texto principal — blanco */ --text-muted: #71717a
        /* texto terciario */ --text-secondary: #a1a1aa /* texto secundario */
        /* Acento */ --accent-gold: #c9a96e
        /* dorado — CTAs secundarios, highlights */ /* Botones */
        --btn-bg: #ffffff /* fondo botón primario */ --btn-text: #000000
        /* texto botón primario */ /* Tipografía */ --font: 'Inter',
    -apple-system,
    sans-serif /* body */ /* Fraunces — headings/display (woff2 en fonts/) */
        /* Plus Jakarta Sans — subtítulos (woff2 en fonts/) */ /* Espaciado */
        --s-xs: 8px --s-sm: 16px --s-md: 24px --s-lg: 48px --s-xl: 80px
        /* Bordes redondeados */ --r-sm: 8px --r-md: 16px --r-lg: 24px
        --r-xl: 32px --r-pill: 9999px /* Transiciones */
        --ease: cubic-bezier(0.16, 1, 0.3, 1) --t-fast: 0.2s var(--ease)
        --t-smooth: 0.6s var(--ease);
```

**Componentes CSS disponibles:** `.btn-primary`, `.btn-outline`, `.btn-large`, `.luxury-card`, `.team-card`, `.badge`, `.eyebrow`, `.section`, `.container`, `.reveal`, `.hero-fullscreen`, `.faq-accordion`, `.bento-grid-luxury`.

### Voz y tono

Todo contenido escrito para Aurora Derm DEBE seguir estas reglas:

1. **Tono:** Profesional pero cálido. Médico pero humano. NUNCA comercial ni agresivo.
2. **Tratamiento:** Siempre "usted" (no "tú"). Formal pero no distante.
3. **Vocabulario prohibido:** "oferta", "descuento", "barato", "promo", "dale click", "no te pierdas".
4. **Vocabulario preferido:** "evaluación", "diagnóstico", "tratamiento", "acompañamiento", "criterio clínico", "protocolo".
5. **Promesa de marca:** "Primero entendemos su piel. Luego actuamos." — No vendemos. Guiamos.
6. **Diferenciador:** "No somos vitrina. Somos su guía clínica dermatológica real."
7. **Idioma:** Español ecuatoriano. No usar modismos argentinos, mexicanos ni españoles. Ejemplo: "celular" (no "móvil"), "agendar" (no "pedir hora"), "consultorio" (no "consulta").

### Reglas de precisión médica

1. NUNCA garantizar resultados. Siempre usar "cada caso es individual".
2. NUNCA diagnosticar en contenido público. Solo describir condiciones y tratamientos.
3. Mencionar siempre que la evaluación del especialista es necesaria.
4. No recomendar automedicación ni tratamientos caseros.
5. Citar nomenclatura dermatológica correcta (ej: "hiperpigmentación post-inflamatoria" no "manchas de granos").
6. Para procedimientos, incluir: qué es, para quién, qué esperar, tiempo de recuperación, riesgos posibles.

### Template para páginas de servicio

Al crear una nueva `es/servicios/*/index.html`, usar la estructura de `es/servicios/diagnostico-integral/index.html` o `es/servicios/acne-rosacea/index.html` como base.

Estructura obligatoria:

1. `<meta>` tags (title, description, OG, canonical)
2. Hero con imagen del procedimiento
3. Sección "¿Qué es?" — descripción médica accesible
4. Sección "¿Para quién?" — indicaciones
5. Sección "El proceso" — paso a paso del tratamiento
6. Sección "Qué esperar" — resultados y recuperación
7. CTA WhatsApp con `?text=Hola, me interesa [servicio]`
8. Footer estándar (copiar de `index.html`)
9. Importar `styles/main-aurora.css`

### Template para blog posts

Al crear `es/blog/*/index.html`:

1. `<meta>` tags con keyword focus en title y description
2. Hero con H1 que incluya keyword principal
3. Contenido: mínimo 1500 palabras, H2 cada 300 palabras, internal links a servicios relevantes
4. Sección "¿Cuándo consultar?" al final → CTA WhatsApp
5. Autor: "Equipo médico Aurora Derm"
6. Fecha de publicación visible
7. Importar `styles/main-aurora.css` + `legal.css` (para layout de artículo)

### Verificación de trabajo

Después de completar cualquier tarea, el agente DEBE:

1. **Para frontend:** abrir en browser (`php -S localhost:8000`) y verificar visualmente. Si el deploy no funciona, verificar con `cat` que el HTML es válido.
2. **Para backend:** correr el endpoint con `curl` y verificar respuesta JSON válida.
3. **Para contenido:** releer el texto completo buscando: errores ortográficos, vocabulario prohibido (ver "Voz y tono"), promesas de resultados, falta de CTA.
4. **Para CSS:** verificar que usa variables CSS, no colores hardcodeados.
5. **Lighthouse check** (si el agente puede): `npx lhci autorun --config lighthouserc.premium.json` para ver si el score empeoró.

### Git workflow

1. Trabajar en `main` directamente (single-trunk).
2. Commits pequeños: un fix o feature por commit.
3. Mensaje: `feat(S1-01): fix bioestimuladores link` o `feat(S2-11): create blog acne adulto`.
4. Correr `npm run agent:gate` antes de push cuando se modifique backend o orquestador.
5. Para cambios solo de frontend/contenido: commit + push directo.
6. `HUSKY=0 git commit --no-verify` si husky/lint-staged causa problemas con archivos no relacionados.

### Mapa de arquitectura

```
Aurora-Derm/
├── index.html                    # Landing page principal (ES)
├── admin.html                    # Portal administrativo (login requerido)
├── kiosco-turnos.html            # Kiosco de auto check-in para pacientes
├── operador-turnos.html          # Vista del operador de turnos
├── sala-turnos.html              # Display de sala de espera
├── api.php → lib/routes.php      # Entry point de la API REST
│
├── controllers/                  # 28 controllers PHP (lógica de negocio)
│   ├── FlowOsController.php      # Journey manifest y preview
│   ├── QueueController.php       # Cola de turnos
│   ├── AppointmentController.php # Citas y agendamiento
│   ├── ClinicalHistoryController.php  # Historia clínica
│   ├── PaymentController.php     # Pagos Stripe + transferencias
│   ├── WhatsappOpenclawController.php # WhatsApp bot/messaging
│   ├── TelemedicineAdminController.php # Telemedicina admin
│   └── HealthController.php      # Health check + diagnostics
│
├── lib/                          # Servicios y lógica compartida
│   ├── FlowOsJourney.php         # Patient journey engine (6 stages)
│   ├── QueueService.php          # Turnero engine
│   ├── PatientCaseService.php    # Caso clínico unificado
│   ├── BookingService.php        # Reservas
│   ├── calendar/                 # Google Calendar integration
│   ├── clinical_history/         # HCE (AI, guardrails, legal)
│   ├── telemedicine/             # Teleconsulta (intake, consent, channel)
│   ├── queue/                    # Ticket factory, priority, summary
│   └── routes.php                # 120+ API routes registradas
│
├── styles/
│   └── main-aurora.css           # Design system principal (tokens CSS)
│
├── es/servicios/                 # 20 specialty pages (ES) ✅ COMPLETO
├── en/services/                  # 13 specialty pages (EN) — faltan 7
├── es/legal/                     # Aviso médico, privacidad, cookies, términos
├── es/software/turnero-clinicas/ # Landing SaaS del turnero
│
├── src/apps/                     # Módulos frontend JS
│   ├── queue-shared/             # 398 archivos (mayoría dead code turnero-surface-*)
│   ├── admin-v3/                 # 396 archivos (admin panel v3)
│   ├── booking/                  # Motor de reservas
│   ├── reschedule/               # Motor de reagendamiento
│   ├── payment/                  # Motor de pagos
│   ├── patient-flow-os/          # ✅ ACTIVO — apps/, packages/, tests/, infra/ (11 subdirs, 12 tests)
│   └── chat/                     # Chat UI
│
├── js/                           # JS compilados/públicos
├── images/optimized/             # 262 imágenes webp optimizadas
├── fonts/                        # Fraunces, Inter, Plus Jakarta Sans (woff2)
├── templates/partials/           # Fragmentos HTML reutilizables (head, footer, hero)
├── data/                         # Runtime data (metrics, locks, ratelimit)
└── _archive/                     # Código archivado (gobernanza legacy)
```

### API endpoints existentes (referencia rápida)

Todas las rutas son `GET /api.php?resource=<nombre>` o `POST /api.php?resource=<nombre>`.

| Subsistema           | Endpoints                                                                                | Status                           |
| -------------------- | ---------------------------------------------------------------------------------------- | -------------------------------- |
| **Health**           | `health`, `health-diagnostics`                                                           | ✅ Funcional                     |
| **Queue**            | `queue-state`, `queue-checkin`, `queue-ticket`, `queue-call-next`, `queue-reprint`       | ✅ Funcional                     |
| **Appointments**     | `appointments`, `booked-slots`, `reschedule`                                             | ✅ Funcional                     |
| **Flow OS**          | `flow-os-manifest`, `flow-os-journey-preview`                                            | ✅ Backend listo, frontend falta |
| **Clinical History** | `clinical-history-session`, `clinical-history-message`, `clinical-record`                | ✅ Backend listo                 |
| **Payments**         | `payment-config`, `payment-intent`, `payment-verify`, `transfer-proof`, `stripe-webhook` | ✅ Funcional                     |
| **Telemedicine**     | `telemedicine-intakes`, `telemedicine-ops-diagnostics`, `telemedicine-rollout-readiness` | ✅ Backend listo                 |
| **Analytics**        | `funnel-event`, `funnel-metrics`, `retention-report`                                     | ✅ Funcional                     |
| **WhatsApp**         | `whatsapp-openclaw-inbound`, `whatsapp-openclaw-outbox`                                  | ✅ Backend listo                 |
| **Push**             | `push-config`, `push-subscribe`, `push-test`                                             | ✅ Backend listo                 |
| **Auth**             | `operator-auth-start/complete/logout`, `operator-pin-login/logout`                       | ✅ Funcional                     |

### Páginas de servicio existentes (inventario)

**ES — 20 páginas ✅ completas:**
acne-rosacea, bioestimuladores-colageno, botox, cancer-piel, cicatrices, depilacion-laser, dermatologia-pediatrica, diagnostico-integral, granitos-brazos-piernas, laser-dermatologico, manchas, mesoterapia, microdermoabrasion, peeling-quimico, piel-cabello-unas, rellenos-hialuronico, tamizaje-oncologico, teledermatologia, verrugas

**EN — 13 páginas, faltan 7:**
❌ depilacion-laser, ❌ manchas, ❌ microdermoabrasion, ❌ rellenos-hialuronico, ❌ tamizaje-oncologico, ❌ teledermatologia, ❌ bioestimuladores (el path en EN es bioestimuladores-colageno)

**Páginas que NO existen todavía (por crear):**

- `es/blog/` — blog completo
- `es/primera-consulta/` — guía de primera visita
- `es/agendar/` — booking público
- `es/pago/` — checkout
- `es/paquetes/` — combos de tratamiento
- `es/referidos/` — programa de referidos
- `es/telemedicina/consulta/` — sala de teleconsulta

### Issues conocidas

| Issue                        | Detalle                                                                                                                                             | Impacto                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 502 intermitente             | pielarmonia.com responde 502 ocasionalmente                                                                                                         | Server Windows, fuera de alcance del repo                       |
| `patient-flow-os/` activo    | `src/apps/patient-flow-os/` tiene `apps/`, `packages/`, `tests/`, `infra/`, `docker-compose.yml` — **slice viva, 12 tests**. Owner: codex_frontend. | Requiere clean-checkout (S14-02) y smoke multi-surface (S14-04) |
| 398 surface files            | `src/apps/queue-shared/` tiene 398 archivos, ~80% dead code                                                                                         | Confunde a agentes, infla el repo                               |
| EN desactualizado            | `en/index.html` puede no reflejar la versión ES actual                                                                                              | Experiencia inconsistente para pacientes angloparlantes         |
| `bioestimuladores/` redirect | Footer enlaza `/es/servicios/bioestimuladores/` pero existe como `/es/servicios/bioestimuladores-colageno/`                                         | 404 para algunos visitors                                       |

### Acceptance criteria por sprint

**Sprint 1 está DONE cuando:**

- [ ] Cero links rotos en `index.html` y footer
- [ ] `manifest.json` dice "Aurora Derm" (no "Flow OS")
- [ ] Site usable en iPhone (375px) sin nada cortado
- [ ] Lighthouse Accessibility ≥ 85
- [ ] Lighthouse Performance ≥ 70

**Sprint 2 está DONE cuando:**

- [ ] Structured data `MedicalClinic` validada en Rich Results Test
- [ ] ≥ 4 blog posts publicados en `es/blog/`
- [ ] Todos los CTAs WhatsApp tienen `?text=` contextualizado
- [ ] `sitemap.xml` incluye todas las páginas ES y EN
- [ ] Página de primera consulta live

**Sprint 3 está DONE cuando:**

- [x] Patient journey visible en admin (kanban de stages)
- [x] Paciente puede hacer intake digital desde `es/pre-consulta/`
- [ ] Kiosco con check-in QR funcional
- [ ] Booking público `es/agendar/` conectado a `CalendarAvailabilityService`
- [ ] HCE: se puede crear anamnesis y registrar evolución desde admin

**Sprint 4 está DONE cuando:**

- [ ] Triage IA funcional en staging
- [ ] Demo interactiva del turnero usable por visitantes
- [ ] Pricing page live en `es/software/turnero-clinicas/precios/`
- [ ] ≤ 50 archivos en `src/apps/queue-shared/` (de 398 actuales)

### KPIs del proyecto

Métricas que los agentes deben optimizar con cada tarea:

| KPI                            | Actual | Target Sprint 1 | Target Sprint 2 |
| ------------------------------ | ------ | --------------- | --------------- |
| Lighthouse Performance         | ?      | ≥ 70            | ≥ 80            |
| Lighthouse Accessibility       | ?      | ≥ 85            | ≥ 90            |
| Lighthouse SEO                 | ?      | ≥ 90            | ≥ 95            |
| Links rotos (index.html)       | ~2     | 0               | 0               |
| Páginas ES con structured data | 0/20   | 1 (index)       | 20/20           |
| Blog posts publicados          | 0      | 0               | ≥ 4             |
| WhatsApp CTAs con `?text=`     | ~0     | n/a             | 100%            |
| Archivos surface muertos       | ~320   | n/a             | n/a             |

### SEO keywords target (Quito, Ecuador)

Estos son los keywords que los blog posts y páginas de servicio deben atacar. El contenido debe incluir estos términos de forma natural en títulos, H2s y texto.

| Keyword                       | Volumen estimado | Página target                             |
| ----------------------------- | ---------------- | ----------------------------------------- |
| dermatólogo quito             | Alto             | `index.html` + blog                       |
| tratamiento acné quito        | Medio            | `es/servicios/acne-rosacea/`              |
| láser dermatológico quito     | Medio            | `es/servicios/laser-dermatologico/`       |
| quitar manchas cara quito     | Medio            | `es/servicios/manchas/`                   |
| bioestimuladores quito        | Medio            | `es/servicios/bioestimuladores-colageno/` |
| dermatología pediátrica quito | Bajo-Medio       | `es/servicios/dermatologia-pediatrica/`   |
| teledermatología ecuador      | Bajo             | `es/servicios/teledermatologia/`          |
| depilación láser quito        | Alto             | `es/servicios/depilacion-laser/`          |
| cómo elegir dermatólogo       | Medio            | `es/blog/como-elegir-dermatologo-quito/`  |
| señales alarma lunares        | Bajo             | `es/blog/senales-alarma-lunares/`         |
| protección solar ecuador      | Bajo             | `es/blog/proteccion-solar-ecuador/`       |
| acné adulto causas            | Medio            | `es/blog/acne-adulto/`                    |

### Coordinación multi-agente — Protocolo de Claims

> ⚠️ **OBLIGATORIO cuando hay más de 1 agente trabajando simultáneamente.**
> Sin claim, dos agentes hacen el mismo trabajo. Ese trabajo se pierde.

#### Flujo completo para cada agente (sin excepción):

```bash
# 1. Sincronizar con el repo antes de empezar
git pull origin main

# 2. Ver la siguiente tarea disponible (no reclamada, no hecha)
node bin/claim.js next
# o: npm run claim:next

# 3. Reclamar la tarea (esto la bloquea para los demás)
node bin/claim.js claim S2-01 "GPT-5.4-hilo-3"
# o: npm run claim:take S2-01 "GPT-5.4-hilo-3"

# 4. Comitear el claim ANTES de trabajar (así los demás ven el lock)
git add data/claims/ && HUSKY=0 git commit --no-verify -m "claim: S2-01" && git push

# 5. Hacer el trabajo...

# 6. Liberar el claim y comitear el trabajo
HUSKY=0 git commit --no-verify -m "feat(S2-01): descripción"
node bin/claim.js release S2-01
# Marcar [x] en AGENTS.md
git add . && HUSKY=0 git commit --no-verify -m "docs: mark S2-01 done" && git push
```

#### Comandos de claim

| Comando                                  | Qué hace                                      |
| ---------------------------------------- | --------------------------------------------- |
| `node bin/claim.js next`                 | Qué tarea tomar (respetando sprints y tamaño) |
| `node bin/claim.js claim S2-01 "nombre"` | Bloquear tarea para trabajarla                |
| `node bin/claim.js release S2-01`        | Liberar al terminar o abandonar               |
| `node bin/claim.js status`               | Ver todos los claims activos                  |
| `node bin/claim.js list-pending`         | Lista tareas disponibles vs bloqueadas        |
| `node bin/claim.js purge-expired`        | Limpiar claims expirados (agentes caídos)     |

#### Reglas anti-colisión

1. **Nunca trabajar sin hacer `claim` primero.** Si no puedes hacer push del claim, no empieces.
2. **Claims expiran automáticamente:** `[S]`=2h, `[M]`=4h, `[L]`=8h, `[XL]`=24h. Si caes, el claim se libera solo.
3. **Sprints son secuenciales:** `node bin/claim.js next` ya respeta el orden. No lo fuerces.
4. **Tareas `[HUMAN]`:** el script las saltea automáticamente. Preguntar al dueño.
5. **Conflicto de merge en AGENTS.md:** preferir la versión con MÁS `[x]`. En caso de duda: `git pull --rebase`.
6. **Si ves una tarea sin claim pero ya hecha:** ignora, la siguiente.

#### Archivos por sprint (para evitar solapamiento adicional)

| Sprint   | Archivos scope                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Sprint 1 | `index.html`, `manifest.json`, `sw.js`, `styles/`                                                     |
| Sprint 2 | `es/blog/`, `es/primera-consulta/`, `sitemap.xml`, `es/servicios/*/`                                  |
| Sprint 3 | `controllers/`, `lib/`, `admin.html`, `kiosco-*.html`, `operador-*.html`, `src/apps/patient-flow-os/` |
| Sprint 4 | `src/apps/queue-shared/`, `es/software/`, `package.json`, `.github/`                                  |

1. **Lock por archivo:** antes de modificar un archivo, verificar con `git status` que no hay cambios no commiteados. Si hay conflictos, hacer `git pull --rebase` antes de push.
2. **No duplicar trabajo:** si ves una tarea marcada `[x]`, NO la repitas. Pasa a la siguiente `[ ]`.
3. **Sprints son secuenciales:** si Sprint 1 tiene tareas `[ ]`, NO trabajar en Sprint 2.
4. **Tareas `[HUMAN]`:** si una tarea tiene tag `[HUMAN]`, preguntar al usuario y esperar respuesta. No inventar datos.
5. **Conflicto de merge:** si al hacer push hay conflicto, hacer `git pull --rebase origin main` y resolver. Si es en AGENTS.md (checkboxes), preferir la versión que tiene MÁS `[x]`.
6. **Archivos exclusivos por sprint:**
    - Sprint 1: `index.html`, `manifest.json`, `sw.js`, `styles/`
    - Sprint 2: `es/blog/`, `es/primera-consulta/`, `sitemap.xml`, `es/servicios/*/`
    - Sprint 3: `controllers/`, `lib/`, `admin.html`, `kiosco-turnos.html`, `operador-turnos.html`, `src/apps/patient-flow-os/`
    - Sprint 4: `src/apps/queue-shared/`, `es/software/`, `package.json`, `.github/`

