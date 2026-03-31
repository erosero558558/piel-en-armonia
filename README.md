# Aurora Derm — Flow OS

> **Para agentes IA:** Lee `CLAUDE.md` primero (2 minutos). Luego `AGENTS.md`.
> No hay `task.md`, no hay `PLAN_MAESTRO`, no hay lanes. Todo está en `AGENTS.md`.

## ¿Qué es esto?

**Aurora Derm** es una clínica dermatológica en Quito, Ecuador.
**Flow OS** es el sistema operativo de pacientes que corre debajo.

El repo incluye:
- Sitio web público (`index.html`, `es/servicios/`, `es/blog/`)
- Panel administrativo clínico (`admin.html`)
- Turnero digital (kiosco, operador, sala de espera)
- API REST completa (`api.php`, `controllers/`, `lib/`)
- Sistema de teledermatología y journey del paciente

---

## Para agentes IA — Inicio en 3 pasos

```bash
# 1. Identifica tu rol y obtén tu tarea
npm run dispatch:content    # si escribes blog/SEO/textos
npm run dispatch:frontend   # si haces HTML/CSS/páginas
npm run dispatch:backend    # si trabajas PHP/API/servicios
npm run dispatch:devops     # si auditas/limpias/CI
npm run dispatch:fullstack  # si haces cualquier cosa

# 2. Reclama la tarea antes de trabajar
node bin/claim.js claim <TASK-ID> "<tu-nombre>"
git add data/claims/ && HUSKY=0 git commit --no-verify -m "claim: <TASK-ID>" && git push

# 3. Al terminar — gate de calidad
node bin/gate.js <TASK-ID>   # debe PASS antes de marcar done
```

**Backlog completo (contexto):** `AGENTS.md`
**Tareas pendientes (lean):** `BACKLOG.md` ← agentes empiezan aqui
**Preguntas bloqueadas:** `BLOCKERS.md`  
**Reporte de progreso:** `npm run report`

---

## Estado actual del proyecto

Ver `npm run report` para el estado en tiempo real.

Ver `AGENTS.md` sección "Acceptance Criteria" para saber cuándo cada sprint está done.

---

## Herramientas de dirección

| Comando | Función |
|---|---|
| `npm run report` | Digest diario: progreso, blockers, velocity |
| `npm run dispatch:<rol>` | Obtener siguiente tarea para tu tipo |
| `npm run claim:next` | Siguiente tarea disponible (cualquier rol) |
| `npm run claim:status` | Ver tareas activas reclamadas |
| `npm run gate <id>` | Validar calidad antes de marcar done |
| `npm run verify` | Detectar tareas done no marcadas |
| `npm run verify:fix` | Auto-marcar tareas done en AGENTS.md |

---

## Arquitectura rápida

```
index.html              ← Landing principal (ES)
admin.html              ← Panel clínico interno
styles/main-aurora.css  ← Design system (usar estos tokens)
controllers/            ← 28 controllers PHP
lib/                    ← Servicios core (FlowOsJourney, etc.)
es/servicios/           ← 20 specialty pages
es/blog/                ← Blog médico (4 posts + index + RSS)
es/primera-consulta/    ← Página de primera visita
src/apps/patient-flow-os/ ← App del journey del paciente
src/apps/astro/         ← Frontend moderno (Astro V6)
api.php + lib/routes.php← API REST (120+ endpoints)
bin/                    ← Herramientas de agentes
data/claims/            ← Locks de tareas (no editar a mano)
```

---

## Documentación canónica

| Documento | Propósito |
|-----------|-----------|
| [AGENTS.md](AGENTS.md) | Backlog y roles de agentes |
| [docs/OPERATIONS_INDEX.md](docs/OPERATIONS_INDEX.md) | Índice de comandos operativos (web, admin, prod, gobernanza) |
| [docs/LEADOPS_OPENCLAW.md](docs/LEADOPS_OPENCLAW.md) | Entorno del worker LeadOps y copiloto OpenClaw |
| [docs/LOCAL_SERVER.md](docs/LOCAL_SERVER.md) | Servidor local canónico y setup de desarrollo |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Guía de despliegue principal |
| [docs/DEPLOY_HOSTING_PLAYBOOK.md](docs/DEPLOY_HOSTING_PLAYBOOK.md) | Playbook de hosting paso a paso |
| [docs/GITHUB_ACTIONS_DEPLOY.md](docs/GITHUB_ACTIONS_DEPLOY.md) | Pipeline de CI/CD via GitHub Actions |
| [docs/PRODUCTION_TEST_CHECKLIST.md](docs/PRODUCTION_TEST_CHECKLIST.md) | Checklist de verificación en producción |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Guía de contribución y setup |
| [docs/ADMIN-UI-ROLLOUT.md](docs/ADMIN-UI-ROLLOUT.md) | Rollout del panel clínico |
| [docs/public-v6-canonical-source.md](docs/public-v6-canonical-source.md) | Fuente canónica del frontend público V6 |
| [docs/CALENDAR_CUTOVER.md](docs/CALENDAR_CUTOVER.md) | Corte de calendario y sincronización |
| [docs/STABILITY_14_DAYS_PLAN.md](docs/STABILITY_14_DAYS_PLAN.md) | Plan de estabilidad 14 días |
| [docs/ROOT_SURFACES.md](docs/ROOT_SURFACES.md) | Frontera canónica de la raíz del repo |
| [docs/INCIDENT.md](docs/INCIDENT.md) | Playbook de respuesta a incidentes (P1-P4) |

Planes de gobernanza y runbooks históricos → `_archive/legacy-plans/`

---

## Desarrollo local

### Servidor canónico

```bash
# Arrancar el servidor local (host canónico)
php -S 127.0.0.1:8011 -t . bin/local-stage-router.php
```

URLs de acceso local:
- Admin: `http://127.0.0.1:8011/admin.html`
- Público ES: `http://127.0.0.1:8011/es/`
- Público EN: `http://127.0.0.1:8011/en/`

Variables de entorno clave:

| Variable | Función |
|----------|---------|
| `TEST_LOCAL_SERVER_PORT` | Puerto del servidor local (default: 8011) |
| `TEST_BASE_URL` | URL base para tests e2e |

### Performance

```bash
npm run benchmark:local            # Benchmark local reutilizable
npm run qa:summary                 # Semáforo unificado de QA (🟢 GREEN / 🔴 RED)
npm run workspace:hygiene:doctor   # Doctor de higiene del workspace
npm run check:local:artifacts      # Dry-run de limpieza de artefactos efímeros
npm run clean:local:artifacts      # Limpieza de artefactos locales efímeros
```

---

## Frontera de la raíz del repo

Documentada en [docs/ROOT_SURFACES.md](docs/ROOT_SURFACES.md). Cubre:

- **Markdowns canónicos** (`AGENTS.md`, `README.md`, etc.)
- **Shells HTML activos** (`admin.html`, `index.html`, turnero)
- **Archivos de control** (`.json`, `.yaml`, `.txt`)
- **dotfiles** (`.gitignore`, `.editorconfig`, `.prettierrc`, etc.) y **singletones especiales** (`Dockerfile`, `rollup.config.mjs`, etc.)
- **directorios permitidos en raiz** (`bin/`, `controllers/`, `docs/`, `js/`, etc.)
- Archivos archivados: `images/archive/root-legacy/**`, `styles/archive/public-legacy/**`

---

## workspace:hygiene:doctor — Contrato V5

El doctor de higiene unifica todos los checks de workspace. Output JSON:

```json
{
  "overall_state": "ok | fixable | attention | error",
  "issues": [],
  "remediation_plan": [],
  "scope_context": {},
  "strategy_context": {},
  "lane_context": {},
  "scope_counts": { "in_scope": 0, "out_of_scope": 0, "unknown_scope": 0, "mixed_lane": 0, "blocked_scope": 0, "outside_strategy": 0 },
  "candidate_tasks": [],
  "split_plan": []
}
```

Campos del schema: `overall_state`, `issues[]`, `remediation_plan[]`, `scope_context`, `strategy_context`, `lane_context`, `scope_counts`, `candidate_tasks[]`, `split_plan[]`.

Flags principales:

| Flag | Descripción |
|------|-------------|
| `--include-entries` | Modo expandido con detalle de entradas |
| `--task-id <id>` | Filtrar por tarea específica |
| `--scope-pattern <pat>` | Filtrar por patrón de scope |
| `--show-candidates` | Mostrar tareas candidatas |

Estado `attention` indica worktrees o artefactos que requieren revisión manual.
Si `overall_state` es `fixable`, ejecutar el `next_command` indicado (ej: `git worktree prune`).

El check `legacy_generated_root_deindexed` falla si hay archivos del root generado sin deindexar.
Limpiar con `npm run legacy:generated-root:apply`.

---

## Artefactos locales efímeros

Los siguientes archivos son outputs locales que **no deben permanecer versionados**. Limpiar con:

```bash
npm run check:local:artifacts    # dry-run
npm run clean:local:artifacts    # limpieza real
```

Lista de artefactos gestionados:

| Artefacto | Descripción |
|-----------|-------------|
| `playwright-report/` | Reportes de Playwright |
| `test-results/` | Resultados de tests e2e |
| `php_server.log` | Log del servidor PHP local |
| `.php-cs-fixer.cache` | Cache de PHP CS Fixer |
| `.phpunit.cache/` | Cache de PHPUnit |
| `coverage.xml` | Reporte de cobertura |
| `.tmp-calendar-write-report.json` | Reporte temporal de calendario |
| `.codex-public-paths.txt` | Paths generados por Codex |
| `build_analysis.txt` | Análisis de bundle |
| `conflict_branches.txt` | Ramas con conflicto |
| `stats.html` | Stats de Rollup |
| `styles.min.css` | CSS minificado legacy |
| `styles.optimized.css` | CSS optimizado legacy |
| `styles-critical.min.css` | CSS crítico minificado legacy |
| `styles-deferred.min.css` | CSS diferido minificado legacy |


