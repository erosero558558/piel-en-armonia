# Guía para Agentes IA (Workflows y CLI)

> **Nota para ingenieros humanos:** Este documento detalla los comandos automatizados generados para ser interpretados y consumidos por LLMs (como Codex, Claude, ChatGPT) y pipelines automatizadas. Si eres un contribuidor humano, dirígete a `ONBOARDING.md` o `CONTRIBUTING.md`.

## Operativa Base
Todo el trabajo que realizan los IA agents debe estar listado obligatoriamente en `AGENTS.md`. 
No existen "lanes", sub-tableros u otros boards; el backlog maestro es `AGENTS.md`.

## Inicio en 3 pasos

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

## Referencias Clave

*   **Backlog completo (contexto):** `AGENTS.md`
*   **Tareas pendientes (lean):** `BACKLOG.md` ← Los agentes que busquen contexto ultrareducido empizan aquí.
*   **Preguntas bloqueadas:** `BLOCKERS.md`
*   **Reporte de progreso:** `npm run report`

## Herramientas de Dirección (CLI para Agentes)

| Comando | Función |
|---|---|
| `npm run report` | Digest rápido: muestra porcentajes de completitud y sprint actual. |
| `npm run dispatch:<rol>` | Extrae la *próxima* tarea que requiere atención para una capacidad dada. |
| `npm run claim:next` | Siguiente tarea genérica disponible (cualquier scope). |
| `npm run claim:status` | Visualizar qué tareas han sido bloqueadas activamente por claims. |
| `npm run gate <id>` | Ejecución del script `bin/gate.js` pre-checking antes del pull request. |
| `npm run verify` | Escaneo del filesystem contra `AGENTS.md` para garantizar el despliegue a producción. |
| `npm run verify:fix` | Mutación activa del Markdown para checkear reglas verificables que ya existen en runtime. |

## Workspace Hygiene (Contrato V5)

El doctor de higiene unifica todos los checks de workspace. Su output esperado como JSON es consumido por los agentes orquestadores:

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

**Flags principales para bots:**
- `--include-entries`: Modo expandido con detalle.
- `--task-id <id>`: Filtración granular.
- `--scope-pattern <pat>`: Patrón regex pre-análisis.

*Estado 'attention' deshabilita un commit si el LLM no resuelve dependencias cruzadas.* Muta `overall_state` usando `npm run legacy:generated-root:apply`.
