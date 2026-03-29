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

## Documentación archivada

Planes de gobernanza y runbooks históricos → `_archive/legacy-plans/`  
Las únicas fuentes de verdad activas son: `AGENTS.md`, `CLAUDE.md`, `BLOCKERS.md`
