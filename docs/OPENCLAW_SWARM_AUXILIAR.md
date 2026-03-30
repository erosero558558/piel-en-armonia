# OpenClaw Swarm Auxiliar

`Codex` sigue siendo el integrador principal del repo en `C:\dev\pielarmonia-workspace`.
`OpenClaw` queda como swarm auxiliar `free-first` para analisis paralelo, triage,
review y patches aislados.

## Layout

- Repo principal: `C:\dev\pielarmonia-workspace`
- Root externo del swarm: `C:\dev\pielarmonia-swarm`
- Workspaces persistentes: `C:\dev\pielarmonia-swarm\agents\<agent-id>`
- Worktrees patch: `C:\dev\pielarmonia-swarm\<taskid>-<lane>`
- Workspace reservado de OpenClaw: `C:\Users\ernes\.openclaw\workspace`

## Agentes persistentes

- `swarm-scout` -> `openrouter/stepfun/step-3.5-flash:free`
- `swarm-triage` -> `openrouter/qwen/qwen3-coder:free`
- `swarm-review` -> `openrouter/minimax/minimax-m2.5:free`

## Reglas v1

- No usar `C:\Users\ernes\.openclaw\workspace` para coding del producto.
- No enlazar bindings a canales en esta fase.
- Los agentes persistentes son read-only sobre el repo principal.
- La edicion de codigo se hace solo con `patch-<taskid>-<lane>` y worktree dedicado.
- Todo agente auxiliar debe responder con contrato JSON:
  `summary`, `findings`, `next_command`, `changed_files`.

## Comandos

```powershell
npm run openclaw:swarm:setup
npm run openclaw:swarm:status
npm run openclaw:swarm:invoke -- --agent swarm-scout --task "Resume los blockers actuales"
npm run openclaw:swarm:patch -- CDX-901 transversal-runtime --task "Revisa y corrige el contrato roto"
npm run openclaw:swarm:pilot
```

## Setup e idempotencia

`setup` crea el layout externo, escribe `swarm-layout.json` y registra
los agentes persistentes si no existen.

Si un agente ya existe con otro `workspace` o `model`, el script reporta
`drift_detected` y no pisa configuracion existente.

## Piloto inicial

- `swarm-triage`: `public_main_sync` con `head_drift`
- `swarm-scout`: forks de `AGENT_BOARD.yaml` y `mixed_lane`
- `swarm-review`: consolidacion para el integrador
- Si `swarm-triage` o `swarm-review` devuelven payload invalido por
  rate-limit o policy externa, `pilot` reintenta ese turno con
  `swarm-scout` antes de marcar fallo final.

Los reportes del piloto se guardan fuera del repo en
`C:\dev\pielarmonia-swarm\reports\pilot-latest.json`.
