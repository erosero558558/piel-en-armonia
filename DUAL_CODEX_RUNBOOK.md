# Runbook Dual Codex (Dominios Fijos)

Este runbook define el flujo operativo diario para ejecutar dos instancias Codex sin solapes.

## Matriz fija

- `codex_backend_ops`:
    - `controllers/**`, `lib/**`, `api.php`, `figo-*.php`, `.github/workflows/**`, `cron.php`, `env*.php`, `bin/**`
- `codex_frontend`:
    - `src/apps/**`, `js/**`, `styles*.css`, `templates/**`, `content/**`, `*.html`

Regla: zonas criticas (`payments/auth/calendar/deploy/env/security`) solo `codex_backend_ops`.

## Flujo diario

1. Revisar locks y conflictos:
    - `node agent-orchestrator.js task ls --active --json`
    - `node agent-orchestrator.js conflicts --json`
2. Tomar tarea con lane fija:
    - backend: `codex_instance=codex_backend_ops`, `domain_lane=backend_ops`
    - frontend: `codex_instance=codex_frontend`, `domain_lane=frontend_content`
3. Trabajar y validar.
4. Si hay cruce de dominio:
    - crear handoff `active` con archivos acotados y `expires_at`
    - cerrar handoff al terminar.
5. Antes de merge:
    - `node agent-orchestrator.js codex-check --json`
    - `node agent-orchestrator.js handoffs lint --json`
    - `npm run agent:gate`

## Ejemplos

### Crear tarea backend

```bash
node agent-orchestrator.js task create \
  --title "Fix calendar slot lock" \
  --executor codex \
  --status ready \
  --risk high \
  --scope calendar \
  --files controllers/AppointmentController.php,lib/calendar/CalendarBookingService.php \
  --codex-instance codex_backend_ops \
  --domain-lane backend_ops \
  --lane-lock strict \
  --cross-domain false \
  --json
```

### Crear tarea frontend

```bash
node agent-orchestrator.js task create \
  --title "Refactor booking CTA copy" \
  --executor codex \
  --status ready \
  --risk low \
  --scope ui \
  --files src/apps/booking/engine.js,styles-deferred.css \
  --codex-instance codex_frontend \
  --domain-lane frontend_content \
  --lane-lock strict \
  --cross-domain false \
  --json
```

### Handoff cross-domain

```bash
node agent-orchestrator.js handoffs create \
  --from AG-101 \
  --to AG-102 \
  --files src/apps/chat/engine.js,figo-chat.php \
  --reason "ajuste contrato request/response" \
  --approved-by ernesto
```

### Cierre de tarea

```bash
node agent-orchestrator.js close AG-102 \
  --evidence verification/agent-runs/AG-102.md \
  --json
```
