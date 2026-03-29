# AGENTS.md — Politica Canonica de Orquestacion de Agentes

AGENT_POLICY_VERSION: 2026-orchestration-v1
CANONICAL_AGENT_POLICY: AGENTS.md
AUTONOMY_MODEL: semi_autonomous_guardrails
PRIMARY_KPI: reduce_rework

Este documento es la fuente de verdad operativa del modo `codex-only` del
repositorio: `codex_backend_ops`, `codex_frontend`, `codex_transversal` y
`CI` (GitHub Actions).
`Claude`, `Kimi` y `Jules` quedan solo como referencias historicas de tareas
terminales ya cerradas.

## Reglas de precedencia

1. Si hay conflicto entre documentos, prevalece `AGENTS.md`.
2. `CLAUDE.md` es guia de rol para Claude; no puede contradecir este archivo.
3. `JULES_TASKS.md` y `KIMI_TASKS.md` quedan preservados solo como tombstones historicos.
4. El backlog canonico es `AGENT_BOARD.yaml`.
5. En caso de duda operativa, se aplica la opcion mas conservadora.

## Objetivo operativo

Reducir retrabajo, conflictos y bucles de implementacion entre agentes,
manteniendo trazabilidad de tareas y gates de calidad en verde.

Metas de operacion:

- Retrabajo semanal: -40% en 4 semanas.
- Conflictos por solape de archivos: < 5% de tareas.
- Lead time en tareas no criticas: < 1 dia.
- Gate rojo por coordinacion: < 10% semanal.

## Codex Model Routing Policy

Fase 1 obligatoria desde `2026-03-17`: `codex-only`.
No cambia el runtime de IA del producto; cambia como operamos Codex.

Regla canonica:

- Orden obligatorio: `tools/local -> GPT-5.4 mini en hilo principal -> GPT-5.4 solo en subagentes premium`.
- `GPT-5.4 mini` es el modelo raiz obligatorio para tareas `CDX-*`.
- `GPT-5.4` se trata como recurso premium y escaso; solo se usa si el gate lo permite, dentro de `subagent`, y queda trazado.

Presupuesto premium por tarea `CDX-*` activa:

- `premium_budget=0` por defecto.
- `premium_budget=1` si `cross_domain=true` o `risk=high`.
- `premium_budget=2` si `critical_zone=true`.
- Unidad de gasto: `1 sesion premium = 1 subagente GPT-5.4 = 1 fila premium en ledger`.

El gate premium solo puede abrirse en estos casos:

- `critical_zone=true`.
- Decision de arquitectura cross-lane o de alto riesgo.
- Desbloqueo despues de un intento completo fallido con mini/local.
- Revision final previa a merge de un cambio critico.

Usos premium prohibidos:

- Exploracion de repo o resumen de contexto.
- Boilerplate o refactors mecanicos.
- Status updates.
- Primera pasada de tests.
- Primer borrador de docs.
- Fixes simples de un solo lane.

Trazabilidad obligatoria:

- Cada escalamiento premium requiere `Decision Packet` en `verification/codex-decisions/<task_id>-<n>.md`.
- Campos obligatorios del packet: `task_id`, `execution_mode`, `premium_reason`, `problem`, `why_mini_or_local_failed`, `exact_decision_requested`, `acceptable_output`, `risk_if_wrong`, `action_taken`.
- Cada uso premium se registra append-only en `verification/codex-model-usage.jsonl`.
- Cada entrada premium del ledger debe incluir `execution_mode`, `budget_unit=premium_session`, `premium_session_id` y `root_thread_model_tier`.
- `codex-check` y `agent:gate` deben fallar si una tarea `CDX-*` activa tiene drift entre board, ledger y decision packets.

Regla de hilo:

- `codex start` para tareas `CDX-*` asume y conserva `gpt-5.4-mini` como hilo principal.
- El hilo principal premium queda prohibido como flujo normal.
- La unica excepcion permitida es `main_thread_exception` para un hilo premium ya abierto externamente; no se abre desde `codex start` y debe registrarse igual en el ledger.

## Estrategia madre

Cuando `AGENT_BOARD.yaml.strategy.active.status=active`, esa estrategia pasa a
ser el marco obligatorio de direccion para toda ejecucion nueva del board,
no solo de la linea Codex.

Reglas:

- Solo se permite una `strategy.active` a la vez.
- `AGENT_BOARD.yaml` es la unica fuente operativa de verdad para estrategia,
  foco, estados, capacidad y bloqueo del frente vivo.
- `PLAN_MAESTRO_CODEX_2026.md` queda como narrativa derivada para humanos; su
  drift documental no debe bloquear `status`, `codex-check`, `start`, `close`
  ni `sync`.
- `strategy.next` es opcional y solo funciona como draft/preparacion; no
  gobierna tareas hasta promocion con `strategy activate-next`.
- La estrategia activa define `1..n` subfrentes por
  `codex_instance` (`codex_backend_ops`, `codex_frontend`,
  `codex_transversal`); `subfront_id` sigue siendo el identificador canonico.
- Toda tarea activa del board (`ready`, `in_progress`, `review`, `blocked`)
  debe alinearse a `strategy.active`, aun si no es `CDX-*`.
- Toda tarea activa de Codex debe vivir en `CDX-*`; una `AG-*` con
  `executor=codex` solo se tolera como excepcion auditada
  `validated_release_promotion`.
- `ready` se trata como cola alineada: no consume slot de ejecucion ni exige
  bloque `CODEX_ACTIVE`; los slots del lane se consumen solo en
  `in_progress`, `review` y `blocked`.
- La superficie canonica para abrir trabajo nuevo alineado es
  `node agent-orchestrator.js strategy intake ...`; `task create` queda como
  compatibilidad y debe pasar la misma validacion o entrar como exception.
- Todo hilo nuevo de Codex debe leer `strategy.active`, tomar un
  `subfront_id` valido para su lane y rechazar trabajo fuera de ese frente.
- Si un `scope` admite mas de un subfrente candidato dentro del mismo lane,
  `strategy intake` exige `--subfront-id` explicito.
- Las tareas activas deben declarar `strategy_id`, `subfront_id`,
  `strategy_role` y, si aplica, `strategy_reason`.
- `strategy_role=exception` requiere siempre `strategy_reason`,
  `exception_opened_at`, `exception_expires_at` y `exception_state`.
- Las `exception` son auditables: expiran por TTL del subfrente, cuentan como
  deuda operativa y bloquean `strategy activate-next` y `strategy close` si
  quedan vencidas.
- Excepcion formal permitida para publicar un release ya validado:
  `strategy_reason=validated_release_promotion`, activada con
  `task start <AG|CDX> --release-publish`, que fija `status=review`,
  `work_type=evidence` e `integration_slice=governance_evidence`.
- `wip_limit` por subfrente mide solo tareas que ocupan slot
  (`in_progress|review|blocked`); `ready` no cuenta contra el WIP efectivo.
- Las transiciones `set-active`, `set-next`, `activate-next` y `close` deben
  dejar snapshot append-only en `verification/agent-strategy-events.jsonl`.
- Las tareas historicas terminales (`done`, `failed`) no requieren backfill
  obligatorio de estrategia.

## Arbol de decision oficial (v2)

```text
La tarea toca zona critica? (pagos/auth/calendar prod/deploy/env/seguridad)
  Si -> codex_backend_ops lidera con plan + checklist + tests + gate backend.
  No -> continuar.

La tarea toca orquestador, gobernanza o runtime OpenClaw transversal?
  Si -> codex_transversal lidera con verificacion de surface + tests + gate runtime.
  No -> continuar.

La tarea es puramente frontend/publica?
  Si -> codex_frontend.
  No -> codex_backend_ops.

Hay solape de archivos con tarea activa?
  Si -> bloquear dispatch y replanificar.
  No -> ejecutar.

La tarea cambia comportamiento runtime?
  Si -> tests + smoke + gate.
  No -> lint/tests minimos por tipo de cambio.
```

## Politica de velocidad operativa (Directo vs Orquestador)

Objetivo: evitar sobrecosto de coordinacion en tareas pequenas y urgentes.

Usar ejecucion directa (sin ciclo completo de orquestacion) cuando:

- Hay incidente de produccion activo (`[ALERTA PROD]`) y el fix es acotado (1-3 archivos).
- Existe causa raiz clara en logs y un solo executor puede cerrar end-to-end.
- El tiempo estimado de fix+validacion es menor que correr `intake+score+dispatch+reconcile`.

Usar orquestacion completa cuando:

- Hay trabajo paralelo multiagente o backlog con dependencias.
- Hay probabilidad de solape de archivos entre tareas activas.
- Se requiere coordinacion explicita entre `codex_backend_ops` y `codex_frontend`.

Regla de SLA:

- Incidente urgente: priorizar camino directo para reducir MTTR.
- Tareas no urgentes: priorizar orquestacion para reducir retrabajo.

## Zonas criticas con guardrails

Las siguientes zonas no se ejecutan en modo ciego:

- Flujo de pagos Stripe.
- Autenticacion y sesion admin.
- Booking/reprogramacion contra Google Calendar en produccion.
- Cron/backup/restore.
- Workflows de deploy, gate y monitoreo.
- Configuracion sensible (`env.php`, secrets, tokens).

Para zona critica es obligatorio:

1. Plan aprobado en markdown.
2. Checklist de pruebas.
3. Evidencia de gate/smoke.
4. Handoff estructurado.

## Modelo de asignacion por agente

- `codex_backend_ops`: backend, cron, deploy, workflows, seguridad, runtime critico.
- `codex_frontend`: `src/apps/**`, `templates/**`, `content/**`, `*.html`, `js/**`, `styles*.css`.
- `codex_transversal`: orquestador, board/policy, CI de gobernanza y superficies OpenClaw/ChatGPT transversales.
- `ci`: arbitro de consistencia, conflictos y calidad minima.
- `claude`, `kimi`, `jules`: retirados para trabajo activo; solo tolerados en tareas terminales historicas.

## Tri-Lane Codex Matrix (Runtime Transversal)

Particion operativa obligatoria entre tres instancias de Codex:

- `codex_backend_ops`: `controllers/**`, `lib/**`, `api.php`, `figo-*.php`,
  `.github/workflows/**`, `cron.php`, `env*.php`, `bin/**`.
- `codex_frontend`: `src/apps/**`, `js/**`, `styles*.css`, `templates/**`,
  `content/**`, `*.html`.
- `codex_transversal`: `agent-orchestrator.js`, `AGENTS.md`,
  `AGENT_BOARD.yaml`, `AGENT_HANDOFFS.yaml`, `AGENT_JOBS.yaml`,
  `AGENT_SIGNALS.yaml`, `governance-policy.json`,
  `docs/AGENT_ORCHESTRATION_RUNBOOK.md`,
  `docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md`,
  `docs/GITHUB_ACTIONS_DEPLOY.md`,
  `TRI_LANE_RUNTIME_RUNBOOK.md`, `PLAN_MAESTRO_CODEX_2026.md`,
  `tests-node/agent-orchestrator-cli.test.js`,
  `tests-node/orchestrator/**`,
  `tests-node/publish-checkpoint-command.test.js`,
  `tools/agent-orchestrator/**`, `bin/validate-agent-governance.php`,
  `figo-ai-bridge.php`, `lib/figo_queue.php`, `lib/auth.php`,
  `controllers/OperatorAuthController.php`, `controllers/LeadAiController.php`,
  `bin/lead-ai-worker.js`, `bin/lib/lead-ai-worker.js`.

Reglas:

- Si hay duda de ownership de archivo, gana criterio conservador:
  `codex_backend_ops`.
- `critical_zone=true` solo puede ejecutarse en `codex_backend_ops`, salvo
  tareas runtime OpenClaw con `provider_mode=openclaw_chatgpt`, que viven en
  `codex_transversal`.
- Cruces de dominio solo con handoff activo (`AGENT_HANDOFFS.yaml`) y
  expiracion definida.
- No se permite solape cross-lane sin handoff activo.

## Contrato canonico de tareas

El tablero unico vive en `AGENT_BOARD.yaml`.

Campos canonicos por tarea:

- `id`, `title`, `owner`, `executor`, `status`, `risk`, `scope`, `files`,
  `codex_instance`, `domain_lane`, `lane_lock`, `cross_domain`,
  `strategy_id`, `subfront_id`, `strategy_role`, `strategy_reason`,
  `exception_opened_at`, `exception_expires_at`, `exception_state`,
  `provider_mode`, `runtime_surface`, `runtime_transport`,
  `runtime_last_transport`, `model_tier_default`, `premium_budget`,
  `premium_calls_used`, `premium_gate_state`, `decision_packet_ref`,
  `model_policy_version`,
  `source_signal`, `source_ref`, `priority_score`, `sla_due_at`,
  `last_attempt_at`, `attempts`, `blocked_reason`, `runtime_impact`,
  `critical_zone`, `acceptance`, `acceptance_ref`, `evidence_ref`,
  `depends_on`, `created_at`, `updated_at`.

Regla de obligatoriedad:

- `strategy_id`, `subfront_id` y `strategy_role` son obligatorios para tareas activas cuando existe `strategy.active`.
- `strategy_reason` y `exception_*` solo son obligatorios cuando `strategy_role=exception`.
- `model_tier_default`, `premium_budget`, `premium_calls_used`,
  `premium_gate_state`, `decision_packet_ref` y `model_policy_version`
  son obligatorios para tareas `CDX-*` activas (`ready|in_progress|review|blocked`).

Valores validos para coordinacion tri-lane:

- `codex_instance`: `codex_backend_ops | codex_frontend | codex_transversal`
- `domain_lane`: `backend_ops | frontend_content | transversal_runtime`
- `lane_lock`: `strict | handoff_allowed`
- `cross_domain`: `true | false`
- `provider_mode`: `openclaw_chatgpt | ""`
- `runtime_surface`: `figo_queue | leadops_worker | operator_auth | ""`
- `runtime_transport`: `hybrid_http_cli | http_bridge | cli_helper | ""`

Regla adicional:

- Si una tarea depende del runtime OpenClaw, debe usar
  `domain_lane=transversal_runtime`,
  `codex_instance=codex_transversal`,
  `provider_mode=openclaw_chatgpt` y surface/transport validos.
- Si existe `strategy.active` y la tarea esta en estado activo
  (`ready|in_progress|review|blocked`), debe alinearse con la estrategia
  activa y con el `subfront_id` correspondiente a su `codex_instance`.

Estados permitidos:

- `backlog`, `ready`, `in_progress`, `review`, `done`, `blocked`, `failed`.

Los cierres requieren evidencia:

- `verification/agent-runs/<task_id>.md`
- `acceptance_ref` en el task board.

## Operacion diaria

Comandos canonicos:

```bash
node agent-orchestrator.js work doctor
node agent-orchestrator.js work doctor --json
node agent-orchestrator.js work begin CDX-001 --block C1 --expect-rev 12
node agent-orchestrator.js work begin AG-003 --status in_progress --expect-rev 12 --json
node agent-orchestrator.js work close AG-003 --evidence verification/agent-runs/AG-003.md --expect-rev 12 --json
node agent-orchestrator.js work publish CDX-001 --summary "..." --expect-rev 12 --json
node agent-orchestrator.js status
node agent-orchestrator.js status --explain-red
node agent-orchestrator.js status --json --explain-red
node agent-orchestrator.js strategy status
node agent-orchestrator.js strategy status --json
node agent-orchestrator.js strategy preview --seed admin-operativo --json
node agent-orchestrator.js strategy set-next --seed admin-operativo --expect-rev 12 --json
node agent-orchestrator.js strategy activate-next --reason kickoff_admin --expect-rev 12 --json
node agent-orchestrator.js strategy set-active --seed admin-operativo --expect-rev 12 --json
node agent-orchestrator.js strategy close --reason review_complete --expect-rev 12 --json
node agent-orchestrator.js strategy intake --title "..." --scope frontend-admin --files src/apps/admin-v3/app.js --expect-rev 12 --json
node agent-orchestrator.js intake --strict
node agent-orchestrator.js score
node agent-orchestrator.js stale --strict
node agent-orchestrator.js budget --json
node agent-orchestrator.js conflicts
node agent-orchestrator.js conflicts --json
node agent-orchestrator.js handoffs status
node agent-orchestrator.js handoffs lint
node agent-orchestrator.js handoffs status --json
node agent-orchestrator.js handoffs lint --json
node agent-orchestrator.js policy lint
node agent-orchestrator.js policy lint --json
node agent-orchestrator.js handoffs create --from AG-001 --to CDX-001 --files path/a,path/b --reason soporte --approved-by ernesto
node agent-orchestrator.js handoffs close HO-001 --reason handoff_done
node agent-orchestrator.js handoffs close HO-001 --reason handoff_done --expect-rev 12 --json
node agent-orchestrator.js leases status
node agent-orchestrator.js leases status --json
node agent-orchestrator.js leases heartbeat AG-003 --ttl-hours 4 --json
node agent-orchestrator.js leases heartbeat AG-003 --ttl-hours 4 --expect-rev 12 --json
node agent-orchestrator.js leases clear AG-003 --reason manual_release --json
node agent-orchestrator.js codex-check
node agent-orchestrator.js codex-check --json
node agent-orchestrator.js jobs status --json
node agent-orchestrator.js jobs verify public_main_sync --json
node agent-orchestrator.js runtime verify openclaw_chatgpt --json
node agent-orchestrator.js runtime invoke AG-900 --expect-rev 12 --json
node agent-orchestrator.js codex start CDX-001 --block C1
node agent-orchestrator.js codex start CDX-001 --block C1 --expect-rev 12
node agent-orchestrator.js codex premium record CDX-001 --decision-packet-ref verification/codex-decisions/CDX-001-1.md --reason critical_review --execution-mode subagent --premium-session-id sess-001 --expect-rev 12 --json
node agent-orchestrator.js codex stop CDX-001 --to review
node agent-orchestrator.js codex stop CDX-001 --to blocked --blocked-reason remote_verify_smoke_gate_pending --expect-rev 12
node agent-orchestrator.js board doctor
node agent-orchestrator.js board doctor --json --profile ci
node agent-orchestrator.js board events tail --json
node agent-orchestrator.js board events stats --days 7 --json
node agent-orchestrator.js task claim AG-003 --owner ernesto
node agent-orchestrator.js task claim AG-003 --owner ernesto --expect-rev 12 --json
node agent-orchestrator.js task ls --active --json
node agent-orchestrator.js task ls --mine --active --json
node agent-orchestrator.js task ls --executor codex --status in_progress --json
node agent-orchestrator.js task create --title "..." --executor codex --files path/a,path/b --status ready --risk low --scope docs --json
node agent-orchestrator.js task create --title "..." --template docs --files docs/a.md --json
node agent-orchestrator.js task create --title "..." --template bugfix --from-files --files lib/calendar/CalendarBookingService.php --executor codex --json
node agent-orchestrator.js task create --interactive --json
node agent-orchestrator.js task create --title "..." --template docs --from-files --explain --preview --files lib/calendar/CalendarAvailabilityService.php
node agent-orchestrator.js task create --title "..." --template bugfix --from-files --validate-only --files controllers/FooController.php --json
node agent-orchestrator.js task create --apply verification/task-create-preview.json --json
node agent-orchestrator.js task create --apply - --json < verification/task-create-preview.json
node agent-orchestrator.js task create preview-file lint verification/task-create-preview.json --json
node agent-orchestrator.js task create preview-file diff verification/task-create-preview.json --json
node agent-orchestrator.js task create --apply verification/task-create-preview.json --force-id-remap --json
node agent-orchestrator.js task create preview-file diff verification/task-create-preview.json --format full
node agent-orchestrator.js task create --apply verification/task-create-preview.json --force-id-remap --to backlog --json
node agent-orchestrator.js task create preview-file diff verification/task-create-preview.json --json --format compact
node agent-orchestrator.js task create --apply verification/task-create-preview.json --force-id-remap --to backlog --claim-owner ernesto --json
node agent-orchestrator.js task start AG-003 --status in_progress
node agent-orchestrator.js task start AG-003 --release-publish --expect-rev 12 --json
node agent-orchestrator.js task start AG-003 --status in_progress --expect-rev 12 --json
node agent-orchestrator.js task finish AG-003 --evidence verification/agent-runs/AG-003.md
node agent-orchestrator.js task start AG-003 --json
node agent-orchestrator.js sync
node agent-orchestrator.js close AG-003 --evidence verification/agent-runs/AG-003.md --expect-rev 12 --json
node agent-orchestrator.js close CDX-001 --evidence verification/agent-runs/CDX-001.md --expect-rev 12 --json
node agent-orchestrator.js publish checkpoint AG-003 --summary "release-publish AG-003 ..." --expect-rev 12 --json
node agent-orchestrator.js publish checkpoint CDX-001 --summary "..." --expect-rev 12 --json
node agent-orchestrator.js close <task_id>
node agent-orchestrator.js close AG-003 --json
node agent-orchestrator.js close AG-003 --evidence verification/agent-runs/AG-003.md --expect-rev 12 --json
node agent-orchestrator.js metrics
node agent-orchestrator.js metrics --json
node agent-orchestrator.js metrics baseline show
node agent-orchestrator.js metrics baseline show --json
node agent-orchestrator.js metrics baseline set --from current --json
node agent-orchestrator.js metrics baseline reset --json
php bin/validate-agent-governance.php
npm run agent:test
npm run agent:summary
npm run agent:policy:lint
npm run agent:work:doctor
npm run agent:work:begin -- CDX-001 --expect-rev 12
npm run agent:work:close -- AG-003 --evidence verification/agent-runs/AG-003.md --expect-rev 12
npm run agent:work:publish -- CDX-001 --summary "..." --expect-rev 12
npm run agent:metrics:baseline -- show --json
npm run agent:leases
npm run agent:board:doctor
npm run agent:board:legacy:check
npm run agent:board:legacy:normalize
npm run agent:board:resolve-revision
npm run agent:gate
```

Flujo recomendado:

1. Para flujo diario humano, preferir `work doctor -> work begin <task_id> -> work doctor -> work close|work publish`.
2. Preparar estrategia con `strategy preview -> strategy set-next -> strategy activate-next` cuando el frente cambie.
3. Abrir trabajo nuevo con `strategy intake` siempre que exista `strategy.active`; usar `task create` solo si necesitas compatibilidad o un caso `exception`.
4. Reservar trabajo en board (`AGENT_BOARD.yaml`) o usar `codex start` / `handoffs create`.
   Para tareas no-Codex, preferir `task claim/start/finish` en lugar de editar `status/owner` a mano.
   Para inspeccionar backlog/activos sin abrir YAML, usar `task ls` con filtros (`--active`, `--mine`, `--status`, `--executor`, `--scope`).
   Para crear tareas AG nuevas sin editar YAML, usar `task create` (auto-asigna `AG-###` siguiente salvo `--id`).
5. Ejecutar `npm run agent:test` si cambiaste el orquestador/validadores.
6. Ejecutar `npm run agent:gate` (o al menos `conflicts`, `handoffs lint`, `codex-check`).
   Para diagnostico semantico del board (leases, stale, WIP, evidencia), ejecutar `node agent-orchestrator.js board doctor --json` (warn-first, no bloqueante por defecto).
7. Ejecutar validaciones del cambio (`npm run lint`, tests aplicables).
8. Confirmar evidencia y cerrar con `node agent-orchestrator.js close <AG-ID|CDX-ID> --evidence verification/agent-runs/<task_id>.md --expect-rev <rev> --json` cuando la tarea tenga `executor=codex`; ese closeout debe publicar a `origin/main`, refrescar `origin/main` local y dejar la rama actual `0 ahead / 0 behind`.
9. Usar `node agent-orchestrator.js publish checkpoint <AG-ID|CDX-ID> --summary "..." --expect-rev <rev> --json` solo como ruta manual/de excepción. Para promocion formal de release sobre una tarea existente, usar antes `node agent-orchestrator.js task start <AG-ID|CDX-ID> --release-publish --expect-rev <rev> --json`.
10. `task finish` queda solo para tareas no-Codex o cierres internos no publicables; no es una ruta valida para cerrar trabajo activo `CDX-*`.
11. Ejecutar `node agent-orchestrator.js sync` cuando haga falta refrescar tombstones/estado derivado.

Candado de concurrencia:

- Toda mutacion de board/handoffs por CLI requiere `--expect-rev <n>` (claim/start/create/apply/finish/close/codex start-stop/leases/handoffs create-close/strategy set-active/set-next/activate-next/close/intake).
- Si no se envia `--expect-rev`, el comando debe fallar con `error_code=expect_rev_required`.
- Obtener revision actual desde `AGENT_BOARD.yaml.policy.revision` o `node agent-orchestrator.js status --json`.
- Si un `rebase` deja conflicto textual **solo** en `policy.revision`, resolver rapido con `npm run agent:board:resolve-revision` y continuar (`git add AGENT_BOARD.yaml && git rebase --continue`).

Runbook operativo tri-lane runtime:

- `TRI_LANE_RUNTIME_RUNBOOK.md` define flujo diario, ownership por lane,
  surfaces OpenClaw y comandos de handoff/runtime.
- `DUAL_CODEX_RUNBOOK.md` queda como nota de migracion/redirect.

Nota:

- Preferir `--json` para dashboards, comentarios automáticos en PR y tooling externo; usar salida texto para operación manual.
- `npm run agent:summary` genera resumen consolidado (Markdown/JSON) para CI/PR usando los comandos `--json`.
- `agent-governance-summary --explain-red` agrega una seccion de explicacion del estado rojo (conflicts/handoffs/codex/regresiones) en Markdown y JSON.
- Scripts utiles: `npm run agent:summary:local` (read-only) y `npm run agent:summary:ci` (persiste snapshots runtime).
- El summary soporta `--profile local|ci` (default `local`); en `local` usa metrics read-only para no ensuciar el arbol local.
- El summary soporta `--strict` (falla por blockers) y `--fail-on-red` (falla si el semaforo global queda en `RED`).
- El JSON/Markdown del summary incluye evaluacion de politicas (`strict`, `fail_on_red`) para dashboards/PR review.
- Para CI/automatizacion, preferir `agent-governance-summary --from-json <artifact> --policy-check <strict|fail_on_red>` en lugar de parseo inline.
- `metrics` acepta `--profile local|ci` (por defecto escribe; `local` implica read-only salvo `--write`).
- `metrics --dry-run` muestra preview de archivos runtime que escribiria y no persiste cambios.
- `metrics baseline <show|set|reset>` permite gestionar baseline explicito en `verification/agent-metrics.json` (recomendado usar `set --from current` tras cambios estructurales del board/politica).
- `task create`, `task claim` (si cambia `status` a activo) y `task start` aplican guardrails locales de gobernanza: validan `depends_on` (IDs existentes, sin duplicados) y bloquean scopes criticos asignados a ejecutores no permitidos (`codex`).
- `strategy preview` valida seeds curados, scope ownership, impacto sobre
  tareas activas y mirror esperado del plan antes de permitir promocion.
- `strategy set-active` queda solo para bootstrap o entornos sin
  `strategy.active`; el flujo normal es `set-next -> activate-next`.
- `strategy status`, `status --json` y `board doctor --json` deben exponer
  `strategy.next`, cobertura por subfrente, `lane_rows`, `slot_tasks`,
  `lane_capacity`, `available_slots`, `subfront_count`, WIP vs `wip_limit`,
  exceptions abiertas/expiradas, aged tasks y `dispersion_score`.
- `task create`, `task claim` (si activa trabajo), `task start` y `codex start`
  bloquean tareas fuera de `strategy.active`, subfrentes ajenos a su lane y
  excepciones sin `strategy_reason`.
- `task create --template <docs|bugfix|critical>` aplica defaults de `executor/status/risk/scope`; los flags explicitos sobreescriben la plantilla. `critical` exige `--scope` con keyword critica (`payments|auth|calendar|deploy|env|security`).
- `task create --template <docs|bugfix|critical|runtime>` aplica defaults de `executor/status/risk/scope`; la plantilla `runtime` fija `scope=openclaw_runtime`, `domain_lane=transversal_runtime`, `codex_instance=codex_transversal`, `provider_mode=openclaw_chatgpt` y `runtime_transport=hybrid_http_cli`. Los flags explicitos sobreescriben la plantilla. `critical` exige `--scope` con keyword critica (`payments|auth|calendar|deploy|env|security`).
- `task create --from-files` infiere `scope` y `risk` desde rutas de `files` (precedencia: flags explicitos > inferencia por files > template > defaults). Si detecta scope critico y no se paso `--executor`, puede autoajustar `executor` a `codex` para evitar fallo por guardrail.
- `task create --interactive` solicita por prompt los campos minimos (incluye opcion de activar `--from-files`); con `--json` los prompts salen por `stderr` para no romper el payload.
- `task create --preview` / `--dry-run` valida y calcula la tarea (incluyendo conflictos/inferencia) pero no escribe `AGENT_BOARD.yaml` ni colas derivadas.
- `task create --explain` imprime (o adjunta en JSON) una explicacion corta de como se resolvieron `scope/risk/executor` al usar plantilla/inferencia por files.
- `task create --validate-only` ejecuta validaciones/gates locales y devuelve diagnostico (sin escribir board ni construir preview completo).
- `task create --apply <preview.json>` persiste un payload previo de `task create --preview --json` (reutiliza `task_full` validado y vuelve a verificar conflictos/guardrails contra el board actual).
- `task create --apply -` permite aplicar preview JSON desde `stdin` (util para pipes y automatizacion).
- `task create preview-file lint <preview.json|->` valida un preview guardado contra el board actual (schema + normalizacion + guardrails + conflicto activo) sin persistir cambios.
- `task create preview-file diff <preview.json|->` compara el preview con el board actual (colision de ID, diff de campos del mismo ID y proyeccion de conflictos si se aplicara).
- `task create --apply --force-id-remap` permite aplicar un preview aunque el `AG-###` ya exista; remapea al siguiente `AG-###` disponible y lo reporta en JSON (`original_task_id`, `id_remapped`).
- `task create preview-file diff --format compact|full` controla el detalle de la salida texto (`compact` por defecto; `full` imprime `before -> after` por campo).
- `task create preview-file diff --json --format compact` reduce el payload JSON (omite detalles pesados y deja resumen por campo); `full` conserva detalle completo.
- `task create --apply --to <status>` permite override del `status` del preview al aplicar (util con `--force-id-remap` para bajar a `backlog` y evitar conflicto por tarea activa duplicada).
- `task create --apply --claim-owner <user>` permite asignar `owner` al aplicar (tambien soporta `--claim-owner` sin valor si existe `AGENT_OWNER/USERNAME/USER`).
- El summary/PR comment incluye delta corto de conflictos (`blocking`/`handoff`) vs baseline usando `metrics --json`.
- El summary/PR comment incluye semaforo (`GREEN/YELLOW/RED`) y razones de estado para lectura rapida.
- La politica de pesos/umbrales de gobernanza vive en `governance-policy.json` (p. ej. pesos por dominio y threshold de score para `YELLOW` en summary).
- Validar cambios de politica con `node agent-orchestrator.js policy lint` (incluido en `npm run agent:gate` y CI de gobernanza).
- `status --json` y `metrics --json` incluyen `contribution` por ejecutor (porcentaje de tareas `done` y porcentaje ponderado por riesgo) para identificar quien aporta mas.
- `metrics --json` persiste historico diario de aporte en `verification/agent-contribution-history.json` y el summary muestra tabla de tendencia (ventana 7d).
- `status --json` y el summary exponen `domain_health` con semaforo por dominio (incluye `calendar`, `chat`, `payments`).
- `metrics --json` persiste historico de salud por dominio en `verification/agent-domain-health-history.json` y el summary muestra tendencia (ventana 7d).
- El summary/PR comment muestra score de salud por dominio ponderado (`calendar > chat > payments`) y alerta regresiones `GREEN->RED`.
- `status/conflicts/handoffs lint/policy lint/codex-check` en `--json` incluyen `diagnostics` + `warnings_count/errors_count` (warn-first, aditivo, sin cambiar hard blockers actuales).
- `leases status --json` y `board doctor --json` incluyen `diagnostics` + `warnings_count/errors_count`; `board doctor` agrega `checks` y `leases` para diagnostico semantico del board (warn-first).
- `task claim/start --json` y `dispatch --json` pueden incluir warnings WIP (`warn.board.wip_limit_*`) en `diagnostics` sin cambiar exit code.
- Operaciones mutantes del board generan trazabilidad append-only en `verification/agent-board-events.jsonl` (consultable con `board events tail/stats`).
- Operaciones mutantes del board aceptan `--expect-rev <n>` (optimistic concurrency) en `task`, `codex`, `handoffs`, `leases` y `close`; si el board cambio desde la lectura, el comando falla con `error_code=board_revision_mismatch` en `--json`.
- `AGENT_BOARD.yaml` mantiene `policy.revision` como contador aditivo de escrituras del board (incrementa en cada write mutante exitoso).
- `task create --json` incluye `diagnostics` + `warnings_count/errors_count` (p. ej. `warn.task.from_files_fallback_default_scope` cuando `--from-files` cae en `scope=general`).
- El summary/PR comment agrega seccion `Warn-first Diagnostics` consolidando warnings de gobernanza (globs amplios activos, handoffs por expirar, baseline faltante, keys desconocidas de policy).
- La seccion `enforcement` en `governance-policy.json` gobierna severidad/enable de warnings y perfiles de rama (`fail_on_red`), con validacion en Node y contrato PHP.
- Precedencia H6: checks algorítmicos detallados (solapes/handoffs/Codex mirror file-level) son canónicos en Node; `php bin/validate-agent-governance.php` queda como contrato estructural/complementario.

## Reglas de edicion

1. No editar scripts generados directamente salvo tarea explicita de build.
2. No hacer cambios destructivos de git.
3. No commitear secretos.
4. No cerrar tareas sin evidencia.

## Convivencia de lineas (Orquestador + Codex)

- `AGENT_BOARD.yaml` sigue siendo el tablero canonico de locks/ejecucion para todos los agentes, incluida la linea Codex.
- `PLAN_MAESTRO_CODEX_2026.md` pasa a ser un espejo humano/derivado de la linea Codex; no gobierna la ejecucion.
- El bloque `CODEX_STRATEGY_ACTIVE` del plan debe intentar espejar la
  `strategy.active` vigente del board, pero su drift se trata como deuda documental y no como bloqueo del frente vivo.
- El bloque `CODEX_STRATEGY_NEXT` del plan debe intentar espejar
  `strategy.next` cuando exista draft, bajo la misma regla documental.
- Toda ejecucion activa de Codex debe tener tarea espejo `CDX-*` en `AGENT_BOARD.yaml` con `executor: codex`.
- Toda estrategia nueva o nueva ola debe arrancar activando primero sus tareas
  espejo `CDX-*` por lane; las `AG-*` de apoyo no abren trabajo antes de que
  exista al menos una `CDX-*` activa alineada al frente.
- Una `AG-*` con `executor=codex` no puede ocupar flujo activo normal; solo se
  permite como excepcion `validated_release_promotion`.
- Maximo dos tareas `CDX-*` consumiendo slot por `codex_instance`
  (`in_progress`, `review`, `blocked`).
- Maximo seis tareas `CDX-*` consumiendo slot en total, dos por lane.
- `ready` puede coexistir como cola alineada sin consumir slot ni requerir
  bloque `CODEX_ACTIVE`.
- El bloqueo por solape se decide por `files` en tareas activas del board (`ready`, `in_progress`, `review`, `blocked`).
- Excepcion permitida: handoff temporal y explicito en `AGENT_HANDOFFS.yaml` (TTL + archivos acotados).
- `CODEX_ACTIVE` se espeja por `task_id`, puede incluir `subfront_id` y puede
  coexistir varias veces para el mismo `codex_instance` hasta el cap del lane.
- Si hay drift entre los bloques `CODEX_ACTIVE` del plan Codex y los task
  `CDX-*` espejo, CI debe reportarlo como drift documental; la verdad operativa sigue siendo el board.
- Si hay drift entre `CODEX_STRATEGY_ACTIVE` y `AGENT_BOARD.yaml.strategy.active`,
  CI debe reportarlo como drift documental; la verdad operativa sigue siendo el board.
- Si hay drift entre `CODEX_STRATEGY_NEXT` y `AGENT_BOARD.yaml.strategy.next`,
  CI debe reportarlo como drift documental; la verdad operativa sigue siendo el board.
- `codex-check` debe bloquear si una tarea activa en `codex_transversal`
  depende de una `runtime_surface` no saludable.

## CI y gobernanza

CI valida automaticamente:

- Consistencia `AGENTS.md` vs `CLAUDE.md`.
- Integridad de `AGENT_BOARD.yaml`.
- Integridad de `AGENT_HANDOFFS.yaml`.
- Duplicados entre colas derivadas.
- Asignacion de tareas criticas a ejecutor permitido.
- Solape de archivos entre tareas activas.
- Integridad del espejo Codex (`PLAN_MAESTRO_CODEX_2026.md` <-> `AGENT_BOARD.yaml`).
- Integridad del espejo de estrategia madre (`CODEX_STRATEGY_ACTIVE` <->
  `AGENT_BOARD.yaml.strategy.active`).
- Integridad del draft de estrategia (`CODEX_STRATEGY_NEXT` <->
  `AGENT_BOARD.yaml.strategy.next`).
- Push directo a `main/staging` con cambio en `AGENT_BOARD.yaml` sin PR asociado (bloqueante).
- Drift legacy de dual-lane/tri-lane en `AGENT_BOARD.yaml` (detector/normalizador en gobernanza).

Si falla la gobernanza, el pipeline debe bloquear merge.

---

## Backlog de Producto — Dirección Opus 4.6

> Cada agente al recibir "continua" debe tomar la **primera tarea no completada** de su zona.
> P0 se hace ANTES que P1. P1 antes que P2. Marcar `[x]` al completar.

### P0 — Bloqueantes

- [x] **P0-01** Reemplazar imagen de Plataforma Láser — `images/optimized/service-laser.webp` muestra un CEREBRO. La imagen correcta (procedimiento láser) ya fue generada. Convertir a webp y reemplazar. Verificar en browser.
- [x] **P0-02** Reparar slider Before/After — sección "Transformación Documentada" en `index.html` muestra cajas grises. Diagnosticar rutas de imágenes del slider y arreglar.
- [x] **P0-03** Smoke test producción — `curl -sS -o /dev/null -w "%{http_code}" https://pielarmonia.com/` y `/api.php?resource=queue-state` y `/admin.html`. Si 200→GREEN. Si 502→reportar.

### P1 — Frontend / Sitio Público

- [x] **FE-01** Crear `es/servicios/teledermatologia/index.html` — **el footer ya la enlaza y da 404**. Copiar estructura de `es/servicios/diagnostico-integral/index.html`. Contenido: consulta remota, proceso paso a paso, integración WhatsApp.
- [ ] **FE-02** Crear `es/servicios/tamizaje-oncologico/index.html` — dermatoscopia digital, mapeo de lunares, seguimiento periódico.
- [ ] **FE-03** Crear `es/servicios/manchas/index.html` — melasma, manchas solares, peelings, láser, fototipos Fitzpatrick.
- [ ] **FE-04** Crear `es/servicios/depilacion-laser/index.html` — tecnología Alexandrita/diodo, tipos de piel, sesiones, cuidados post.
- [ ] **FE-05** Crear `es/servicios/rellenos-hialuronico/index.html` — ácido hialurónico, zonas, diferencias con botox, resultados naturales.
- [ ] **FE-06** Crear `es/servicios/microdermoabrasion/index.html` — rejuvenecimiento no invasivo, textura, poros.
- [ ] **FE-07** Auditoría `en/index.html` — verificar que refleje la versión ES actual. Si desactualizado, sincronizar hero/servicios/equipo/CTA.
- [ ] **FE-08** Mobile responsiveness — viewport 375px y 768px. Hero, cards, slider, footer. Arreglar breakpoints rotos.
- [ ] **FE-09** Accessibility audit — Lighthouse accesibility. Alt text, contraste WCAG AA, ARIA labels, focus states.
- [ ] **FE-10** Dark mode consistency — verificar NO hay fondos blancos accidentales, textos invisibles, bordes rotos.

### P1 — SEO y Conversión

- [ ] **SEO-01** Corregir `manifest.json` — dice "Flow OS" en name/short_name/description. **Debe ser "Aurora Derm — Clínica Dermatológica Quito"**.
- [ ] **SEO-02** Google Analytics GA4 — insertar `gtag.js` en `index.html` y todas las páginas `es/servicios/`. Consultar ID al usuario.
- [ ] **SEO-03** Structured data JSON-LD en `index.html` — tipo `MedicalClinic`: name, address Quito, teléfono, horarios, geo.
- [ ] **SEO-04** Structured data por servicio — tipo `MedicalProcedure` en cada `es/servicios/*/index.html`.
- [ ] **SEO-05** Actualizar `sitemap.xml` — verificar incluye TODAS las páginas `es/` y `en/`. Agregar nuevas al crearlas.
- [ ] **SEO-06** Open Graph completar — og:title, og:description, og:image (hero derm, no Flow OS), og:url, og:type, og:locale.
- [ ] **SEO-07** WhatsApp links con `?text=` — cada botón de servicio debe llevar texto pre-llenado. Ej: `?text=Hola, me interesa acné`.

### P1 — Backend / API

- [ ] **BE-01** Health endpoint — verificar `api.php?resource=health` responde 200 `{status:"ok"}`. Si no existe, crear en `controllers/`.
- [ ] **BE-02** Error handling audit — controllers con try/catch, respuestas JSON consistentes, nunca HTML de error PHP en producción.
- [ ] **BE-03** Rate limiting básico — 60 req/min por IP en endpoints públicos si no existe.
- [ ] **BE-04** CORS headers audit — verificar que `api.php` tiene headers CORS correctos para el frontend.

### P1 — Turnero

- [ ] **TU-01** Kiosco UX — flujo end-to-end de tomar turno con backend local. Reportar bugs.
- [ ] **TU-02** Operador UX — llamar siguiente, historial, transiciones. Reportar bugs.
- [ ] **TU-03** Sala display — turnos en tiempo real, auto-refresh, tipografía legible a 3 metros.

### P1 — Contenido y Conversión

- [ ] **CON-01** Galería de resultados reales — crear sección en `index.html` con antes/después de tratamientos reales (acné, láser, bioestimuladores). Mínimo 6 pares.
- [ ] **CON-02** Testimonios con nombre — reemplazar testimonios genéricos por 5 con nombre, tratamiento específico, y resultado.
- [ ] **CON-03** Página de preguntas frecuentes — crear `es/faq/index.html` con 15+ preguntas organizadas por categoría (primera consulta, costos, tratamientos, seguimiento).
- [ ] **CON-04** Blog/educación — crear estructura `es/blog/index.html` + 3 artículos iniciales: "Cómo elegir dermatólogo en Quito", "5 señales de alarma en lunares", "Guía de protección solar Ecuador".
- [ ] **CON-05** Página "Sobre nosotros" — crear `es/nosotros/index.html` con historia de la clínica, filosofía, instalaciones, certificaciones.
- [ ] **CON-06** Mapa e indicaciones — agregar Google Maps embed en footer o sección de contacto con ubicación exacta de la clínica en Quito.

### P2 — Infraestructura y DevOps

- [ ] **OPS-01** CI pipeline audit — `.github/workflows/ci.yml` jobs referencian archivos existentes, no archivados.
- [ ] **OPS-02** Deploy workflow — verificar que `deploy-hosting` está funcional. Documentar proceso.
- [ ] **OPS-03** Lighthouse CI — `npx lhci autorun --config lighthouserc.premium.json`. Target: Perf 80+, A11y 90+, SEO 90+.
- [ ] **OPS-04** SSL/HTTPS audit — verificar que pielarmonia.com tiene certificado válido, no mixed content, HSTS activo.

### P2 — Limpieza técnica

- [ ] **CLEAN-01** Package.json audit — de 171 scripts, listar los que referencian archivos inexistentes.
- [ ] **CLEAN-02** CSS dead code — 8+ archivos CSS en raíz. Verificar cuáles se usan.
- [ ] **CLEAN-03** Images audit — 262 webp en `images/optimized/`. Listar huérfanas (no referenciadas desde HTML/CSS).
- [ ] **CLEAN-04** Fix bioestimuladores link — footer enlaza a `/es/servicios/bioestimuladores/` pero la página real es `/es/servicios/bioestimuladores-colageno/`. Arreglar href o crear redirect.
- [ ] **CLEAN-05** Eliminar markdown muerto de raíz — `CALENDAR-CUTOVER.md`, `CHECKLIST-PRUEBAS-PRODUCCION.md`, `DESPLIEGUE-PIELARMONIA.md`, `GITHUB-ACTIONS-DEPLOY.md`, `SECURITY_AUDIT.md`, `SERVIDOR-LOCAL.md` — mover a `docs/` si útil o a `_archive/` si obsoleto.
- [ ] **CLEAN-06** Service worker audit — `sw.js` puede estar cacheando assets viejos. Verificar que la lista de cache refleja los archivos actuales.

### P1 — Adquisición de Pacientes

- [ ] **ACQ-01** Google My Business — crear/optimizar ficha: nombre "Aurora Derm — Clínica Dermatológica", categoría "Dermatólogo", fotos del consultorio, horarios reales, teléfono, enlace WhatsApp, enlace al sitio. Pedir reseñas a pacientes actuales.
- [ ] **ACQ-02** Landing page para Google Ads — crear `es/landing/consulta-dermatologica/index.html` optimizada para conversión: sin navegación, solo headline + beneficios + CTA WhatsApp + formulario. Tracking de conversión incluido.
- [ ] **ACQ-03** Landing page acné — crear `es/landing/tratamiento-acne-quito/index.html` enfocada en keyword "tratamiento acné Quito". Hero con antes/después, 3 beneficios, precio desde, CTA WhatsApp.
- [ ] **ACQ-04** Landing page láser — crear `es/landing/laser-dermatologico-quito/index.html` enfocada en "láser dermatológico Quito". Mismo formato.
- [ ] **ACQ-05** Landing page manchas — crear `es/landing/eliminar-manchas-quito/index.html` enfocada en "quitar manchas cara Quito". Mismo formato.
- [ ] **ACQ-06** Página de primera consulta — crear `es/primera-consulta/index.html`: qué esperar, qué traer, duración, costo, preparación. Reduce la ansiedad del paciente nuevo.
- [ ] **ACQ-07** Programa de referidos — crear `es/referidos/index.html`: explicar beneficio por cada paciente referido (descuento en siguiente procedimiento). CTA: "Comparte tu link de referido".
- [ ] **ACQ-08** Schema LocalBusiness + Review — agregar structured data `LocalBusiness` con aggregateRating en `index.html`. Las estrellas aparecen en Google Search.

### P1 — Confianza y Credenciales

- [ ] **TRUST-01** Página de certificaciones — crear `es/certificaciones/index.html` con logos y links verificables: MSP Ecuador, S.E.D., Board Internacional, certificaciones láser.
- [ ] **TRUST-02** Badges visuales en hero — agregar badges "MSP Certificado", "10+ años experiencia", "2000+ pacientes" en la sección hero de `index.html` con micro-animación.
- [ ] **TRUST-03** Página de instalaciones — crear `es/instalaciones/index.html` con galería fotográfica del consultorio: recepción, salas de procedimiento, equipos, sala de espera. Transmite profesionalismo.
- [ ] **TRUST-04** Video tour embed — grabar o generar video de 60s del consultorio. Embed en `es/instalaciones/` y en `index.html` sección "Conozca nuestra clínica".
- [ ] **TRUST-05** Publicaciones científicas — crear `es/publicaciones/index.html` listando papers, conferencias, apariciones en medios de los doctores.
- [ ] **TRUST-06** Convenios de seguros — crear `es/seguros/index.html` listando aseguradoras aceptadas, proceso de reembolso, documentación necesaria.

### P1 — Experiencia del Paciente Digital

- [ ] **PAT-01** Formulario de pre-consulta — crear `es/pre-consulta/index.html` con formulario: nombre, email, teléfono, tipo de piel, condición principal, fotos (upload). Envío a WhatsApp del coordinador.
- [ ] **PAT-02** Guías post-tratamiento — crear `es/guias/` con páginas por procedimiento: `post-laser.html`, `post-peeling.html`, `post-bioestimuladores.html`, `post-botox.html`. Cuidados paso a paso, qué esperar, cuándo llamar.
- [ ] **PAT-03** Calculadora de tratamiento — componente interactivo en JS: el paciente selecciona condición → zona → severidad → ve estimado de sesiones y rango de precio. Embed en páginas de servicio.
- [ ] **PAT-04** Sistema de citas online — crear `es/agendar/index.html` con calendario visual de disponibilidad. Integración con Google Calendar API del backend.
- [ ] **PAT-05** Recordatorio de cita por WhatsApp — backend endpoint que envía mensaje 24h antes de la cita. Template: "Hola [nombre], le recordamos su cita mañana a las [hora] en Aurora Derm."
- [ ] **PAT-06** Encuesta de satisfacción —crear `es/encuesta/index.html` post-consulta: 5 preguntas (1-5 estrellas), campo de comentario, opción de publicar como testimonial.
- [ ] **PAT-07** Portal de resultados del paciente — extender `admin.html` con vista paciente: historial de tratamientos, fotos de progreso, próximas citas, guías asignadas.

### P2 — PWA y Performance

- [ ] **PWA-01** Manifest fix — actualizar `manifest.json`: name="Aurora Derm", icons correctos, theme_color acorde al dark mode (#0a0a0f), screenshots del sitio.
- [ ] **PWA-02** Offline fallback — actualizar `sw.js` para cachear: index.html, CSS principal, fonts, hero image. Mostrar página offline branded si no hay red.
- [ ] **PWA-03** Push notifications — implementar subscripción a notificaciones push. Casos: recordatorio de cita, promociones, contenido educativo.
- [ ] **PWA-04** App install prompt — agregar banner "Instalar Aurora Derm" en mobile cuando el usuario ha visitado 2+ veces. Custom prompt, no el default del browser.
- [ ] **PWA-05** Image lazy loading — agregar `loading="lazy"` a todas las `<img>` debajo del fold en `index.html` y páginas de servicio. Medir impacto en LCP.
- [ ] **PWA-06** CSS critical path — extraer CSS above-the-fold e inlinear en `<head>`. Cargar `styles-deferred.css` con `media="print" onload="this.media='all'"`.
- [ ] **PWA-07** Font optimization — verificar que `fraunces.woff2` y `plus-jakarta-sans.woff2` usan `font-display: swap` y preload en `<head>`.

### P2 — Analytics e Inteligencia

- [ ] **ANA-01** Conversion funnel — definir y trackear embudo: visita → scroll servicios → click WhatsApp → mensaje enviado. Eventos GA4 en cada paso.
- [ ] **ANA-02** Heatmap integration — agregar Microsoft Clarity (gratis) o Hotjar: `<script>` tag en `index.html`. Analizar dónde hacen click, hasta dónde scrollean, dónde abandonan.
- [ ] **ANA-03** UTM builder — crear `es/utm/index.html` interna (no public) para generar links con UTM parameters para campañas de Instagram, Google, referidos.
- [ ] **ANA-04** WhatsApp click tracking — cada `href="https://wa.me/..."` debe disparar `gtag('event', 'whatsapp_click', {service: 'acne'})`. Agregar `onclick` handler a todos los CTAs.
- [ ] **ANA-05** Dashboard de conversiones — crear vista en `admin.html` que muestre: visitas/día, clicks WhatsApp/día, fuente de tráfico, top servicios visitados. Datos desde GA4 API o server-side logs.

### P2 — Contenido Educativo y SEO Long-tail

- [ ] **EDU-01** Blog: "Cómo elegir dermatólogo en Quito" — `es/blog/como-elegir-dermatologo-quito/index.html`. SEO keyword focus. 1500+ palabras, H2s con keywords, internal links a servicios.
- [ ] **EDU-02** Blog: "5 señales de alarma en lunares" — `es/blog/senales-alarma-lunares/index.html`. Link a tamizaje oncológico.
- [ ] **EDU-03** Blog: "Guía de protección solar en Ecuador" — `es/blog/proteccion-solar-ecuador/index.html`. Fototipos, SPF, altitud de Quito, recomendaciones.
- [ ] **EDU-04** Blog: "Acné adulto: causas y tratamiento" — `es/blog/acne-adulto-causas-tratamiento/index.html`. Link a página de acné.
- [ ] **EDU-05** Blog: "Melasma y embarazo: qué hacer" — `es/blog/melasma-embarazo/index.html`. Link a página de manchas.
- [ ] **EDU-06** Blog: "Bioestimuladores vs rellenos: diferencias" — `es/blog/bioestimuladores-vs-rellenos/index.html`. Link a ambos servicios.
- [ ] **EDU-07** Blog index page — crear `es/blog/index.html` con grid de artículos, categorías, buscador. Estilo consistente con el sitio principal.
- [ ] **EDU-08** Blog RSS feed — crear `es/blog/feed.xml` para que Google News y lectores RSS indexen el contenido.

### P2 — Revenue y Paquetes

- [ ] **REV-01** Página de paquetes — crear `es/paquetes/index.html`: combos de tratamiento con descuento. Ej: "Plan Piel Perfecta" (3 sesiones laser + peeling + consulta follow-up). Precio visible.
- [ ] **REV-02** Página de financiamiento — crear `es/financiamiento/index.html`: opciones de pago en cuotas, tarjetas aceptadas, alianzas con bancos ecuatorianos.
- [ ] **REV-03** Gift cards — crear `es/gift-cards/index.html`: tarjetas de regalo para tratamientos. Montos predefinidos ($50, $100, $200) o personalizado. Generación de código + PDF descargable.
- [ ] **REV-04** Promociones estacionales — crear `es/promociones/index.html`: template para ofertas rotativas. Mes de la piel, Día de la Madre, Black Friday médico, etc.
- [ ] **REV-05** Programa de membresía — crear `es/membresia/index.html`: plan mensual con beneficios (consultas priority, descuentos en procedimientos, acceso a contenido exclusivo).

### P3 — Internacionalización y Multi-plataforma

- [ ] **i18n-01** Sincronizar `en/index.html` con versión ES actual — hero, servicios, equipo, CTA, footer. Traducción profesional, no literal.
- [ ] **i18n-02** Crear páginas de servicio EN — replicar las 13 specialty pages en `en/services/`.
- [ ] **i18n-03** Hreflang tags — agregar `<link rel="alternate" hreflang="es"...>` y `<link rel="alternate" hreflang="en"...>` en todas las páginas con equivalente.
- [ ] **i18n-04** Sitemap multilingual — actualizar `sitemap.xml` con `xhtml:link` alternates para ES/EN.

### P3 — Integración con Redes Sociales

- [ ] **SOC-01** Instagram feed embed — agregar sección en `index.html` con últimas 6 publicaciones de Instagram. Usar API oficial o widget embed.
- [ ] **SOC-02** WhatsApp Business widget — reemplazar el botón flotante actual por el widget oficial de WhatsApp Business con mensaje pre-llenado y horario de atención.
- [ ] **SOC-03** Open Graph images por servicio — crear imagen OG (1200x630) para cada página de servicio. Cuando alguien comparte el link, se ve la imagen con título y logo.
- [ ] **SOC-04** Facebook Pixel — agregar pixel de Facebook/Meta en `index.html` para retargeting de ads. Events: PageView, Lead (click WhatsApp), ViewContent (página servicio).

### P3 — Compliance y Legal

- [ ] **LEG-01** Cookies banner — implementar banner de consentimiento de cookies GDPR-like (buenas prácticas aunque Ecuador no lo exige aún). Controlar carga de GA4 y pixels hasta aceptación.
- [ ] **LEG-02** Política de datos personales — actualizar `es/legal/privacidad/index.html` con: qué datos se recolectan (formularios, analytics), cómo se usan, cómo solicitar eliminación.
- [ ] **LEG-03** Consentimiento informado digital — crear template de consentimiento para procedimientos (`es/consentimiento/`) que el paciente pueda revisar antes de la cita.
- [ ] **LEG-04** Disclaimer médico visible — agregar disclaimer claro en cada página de servicio: "Los resultados varían según cada paciente. Consulte con nuestro especialista."
