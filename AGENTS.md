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
│   ├── patient-flow-os/          # ⚠️ VACÍO — Flow OS patient app NO EXISTE AÚN
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

| Issue                        | Detalle                                                                                                     | Impacto                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 502 intermitente             | pielarmonia.com responde 502 ocasionalmente                                                                 | Server Windows, fuera de alcance del repo               |
| `patient-flow-os/` vacío     | `src/apps/patient-flow-os/` tiene 0 archivos JS                                                             | El frontend del journey del paciente no existe          |
| 398 surface files            | `src/apps/queue-shared/` tiene 398 archivos, ~80% dead code                                                 | Confunde a agentes, infla el repo                       |
| EN desactualizado            | `en/index.html` puede no reflejar la versión ES actual                                                      | Experiencia inconsistente para pacientes angloparlantes |
| `bioestimuladores/` redirect | Footer enlaza `/es/servicios/bioestimuladores/` pero existe como `/es/servicios/bioestimuladores-colageno/` | 404 para algunos visitors                               |

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

### ✅ Sprint 0 — Completado

- [x] P0-01 Reemplazar imagen láser
- [x] P0-02 Reparar slider Before/After
- [x] P0-03 Smoke test producción
- [x] FE-01 Teledermatología page
- [x] FE-02 Tamizaje oncológico page
- [x] FE-03 Manchas page
- [x] FE-04 Depilación láser page
- [x] FE-05 Rellenos hialurónico page
- [x] FE-06 Microdermoabrasión page

---

### 🔴 Sprint 1 — Arreglar lo roto antes de vender

> **Meta:** que un paciente real pueda entrar a pielarmonia.com y tener una experiencia impecable sin nada roto.

#### 1.1 Links y navegación rotas

- [x] **S1-01** `[S]` Fix bioestimuladores link — footer enlaza `/es/servicios/bioestimuladores/` pero la página es `/es/servicios/bioestimuladores-colageno/`. Arreglar el `href` en `index.html`.
- [x] **S1-02** `[S]` Verificar TODOS los links del footer y nav en `index.html` — que cada href lleve a una página que existe. Reportar cualquier 404.
- [x] **S1-03** `[S]` Verificar links en cada `es/servicios/*/index.html` — CTAs, nav, breadcrumbs, que nada apunte a páginas inexistentes.

#### 1.2 Identidad del producto

- [x] **S1-04** `[S]` Corregir `manifest.json` — dice "Flow OS" en name, short_name, description. Debe decir:
    - `name`: "Aurora Derm — Dermatología Clínica Quito"
    - `short_name`: "Aurora Derm"
    - `description`: "Clínica dermatológica con enfoque médico real. Quito, Ecuador."
    - `label` en shortcuts: quitar "Flow OS", poner "Aurora Derm".
- [x] **S1-05** `[S]` Service worker cache — verificar que `sw.js` cachea los archivos correctos (no assets viejos que ya no existen). Actualizar la lista de cache.

#### 1.3 Mobile y accessibility

- [x] **S1-06** `[M]` Mobile responsiveness — abrir `index.html` en 375px (iPhone) y 768px (iPad). Verificar: hero legible, cards no cortadas, slider funcional, footer navegable, FAQ abre/cierra. Arreglar breakpoints rotos en `styles-deferred.css`.
- [x] **S1-07** `[M]` Accessibility mínima — recorrer `index.html`: alt text en TODAS las imágenes, contraste WCAG AA en textos sobre fondos oscuros, focus states visibles en botones y links, ARIA labels en nav. Correr Lighthouse accessibility, target 85+.
- [x] **S1-08** `[S]` Dark mode consistency — recorrer cada sección de `index.html` buscando: fondos blancos accidentales, textos invisibles sobre fondo oscuro, bordes que rompen la estética.

#### 1.4 Performance baseline

- [x] **S1-09** `[M]` Image lazy loading — agregar `loading="lazy"` a todas las `<img>` debajo del fold en `index.html` y en cada `es/servicios/*/index.html`.
- [x] **S1-10** `[M]` Font optimization — verificar que fuentes usan `font-display: swap` y tienen preconnects/preload.
- [x] **S1-11** `[M]` CSS critical path — extraer CSS above-the-fold (hero + nav) e inlinear en `<head>` de `index.html`. Deferred CSS con `media="print" onload`.
- [x] **S1-12** `[S]` Lighthouse CI baseline — correr `npx lhci autorun --config lighthouserc.premium.json`. Documentar scores iniciales: Performance, Accessibility, SEO, Best Practices. Guardar en `docs/lighthouse-baseline.md`.

---

### 🟡 Sprint 2 — Convertir visitantes en pacientes

> **Meta:** que cada persona que llegue al sitio tenga razones claras para contactar por WhatsApp. SEO para atraer tráfico orgánico.

#### 2.1 SEO fundacional

- [x] **S2-01** `[M]` Structured data `MedicalClinic` en `index.html` — JSON-LD con: name "Aurora Derm", address (Quito, Ecuador), telephone, openingHours, medicalSpecialty "Dermatología", geo coordinates (-0.1807, -78.4678), sameAs (redes sociales).
- [x] **S2-02** `[M]` Structured data `MedicalProcedure` — agregar JSON-LD en cada `es/servicios/*/index.html` con: name, description, bodyLocation, procedureType.
- [x] **S2-03** `[M]` Open Graph completo — en `index.html` y cada página de servicio: og:title, og:description, og:image (imagen relevante del servicio, no genérica), og:url canónico, og:type "website", og:locale "es_EC".
- [x] **S2-04** `[S]` Actualizar `sitemap.xml` — verificar que incluye TODAS las páginas existentes en `es/` y `en/`. Separar URLs locales de EN/ES. Agregar `<lastmod>`.
- [x] **S2-05** `[S]` `robots.txt` — verificar que no bloquea páginas productivas. Bloquear `_archive/`, `data/`, `admin.html`, `tools/`.
- [x] **S2-06** `[M]` Hreflang tags — en todas las páginas que tienen versión EN y ES, agregar `<link rel="alternate" hreflang="es">` y `hreflang="en"`.

#### 2.2 Conversión por WhatsApp

- [x] **S2-07** `[M]` WhatsApp links contextualizados — CADA botón CTA en el sitio debe llevar `?text=` pre-llenado por servicio:
    - Hero: `?text=Hola, me gustaría agendar una evaluación dermatológica`
    - Acné page: `?text=Hola, me interesa una consulta sobre acné`
    - Láser page: `?text=Hola, quiero información sobre tratamiento láser`
    - (repetir para cada servicio)
- [x] **S2-08** `[M]` WhatsApp click tracking — agregar `onclick` handler a TODOS los botones WhatsApp que dispare `gtag('event', 'whatsapp_click', {service: 'nombre-servicio', page: location.pathname})`. Requiere S2-09 primero.
- [x] **S2-09** `[S]` `[HUMAN]` Google Analytics GA4 — insertar tag `gtag.js` en `index.html` y todas las páginas. **PREGUNTAR AL USUARIO:** ¿tiene ya una propiedad GA4? Si sí, dar el ID. Si no, indicar que debe crear una en analytics.google.com.

#### 2.3 Contenido que convierte

- [x] **S2-10** `[L]` Blog index — crear `es/blog/index.html` con: grid de artículos, categorías, diseño consistente con el sitio. No requiere artículos todavía, solo la estructura.
- [x] **S2-11** `[M]` Blog: "Cómo elegir dermatólogo en Quito" — `es/blog/como-elegir-dermatologo-quito/index.html`. 1500+ palabras. H2 con keywords, internal links a servicios, CTA WhatsApp al final.
- [x] **S2-12** `[M]` Blog: "5 señales de alarma en lunares" — `es/blog/senales-alarma-lunares/index.html`. Link a tamizaje oncológico + CTA.
- [x] **S2-13** `[M]` Blog: "Protección solar en Ecuador: guía por altitud" — `es/blog/proteccion-solar-ecuador/index.html`. Específico para Quito (2800 msnm), fototipos, SPF.
- [x] **S2-14** `[M]` Blog: "Acné adulto: causas y tratamiento" — `es/blog/acne-adulto/index.html`. Link a acné-rosácea + CTA.
- [x] **S2-15** `[M]` Blog: "Melasma y embarazo" — `es/blog/melasma-embarazo/index.html`. Link a manchas + CTA.
- [x] **S2-16** `[M]` Blog: "Bioestimuladores vs rellenos: diferencias" — `es/blog/bioestimuladores-vs-rellenos/index.html`. Comparativa educativa.
- [x] **S2-17** `[S]` Blog RSS feed — crear `es/blog/feed.xml` con las entradas del blog para indexación.
- [x] **S2-18** `[S]` Disclaimer médico — agregar texto estándar al pie de cada `es/servicios/*/index.html`: "Los resultados varían. Consulte a nuestro especialista."

#### 2.4 Confianza y credenciales

- [x] **S2-19** `[M]` Badges en hero — agregar badges visuales en la sección hero de `index.html`: "MSP Certificado", "10+ años", "2000+ pacientes". Con micro-animación de fade-in al scroll.
- [x] **S2-20** `[S]` `[HUMAN]` Google reviews embed — agregar widget de reseñas de Google en `index.html`. **PREGUNTAR:** ¿tiene la clínica ficha en Google Maps? Si sí, dar el Place ID.
- [x] **S2-21** `[L]` Página primera consulta — crear `es/primera-consulta/index.html`: qué esperar, qué traer, duración (~45 min), cómo llegar, estacionamiento. Reduce ansiedad del paciente nuevo.
- [x] **S2-22** `[S]` Mapa Google Maps — agregar embed de Google Maps en el footer de `index.html` o en sección de contacto con ubicación exacta de la clínica.

#### 2.5 Inglés

- [x] **S2-23** `[L]` Sincronizar `en/index.html` — verificar que refleja la versión ES actual. Hero, servicios, equipo, CTA, footer. Traducción profesional, culturalmente adaptada (no literal).
- [x] **S2-24** `[XL]` Crear specialty pages EN — replicar las 18 páginas de `es/servicios/` en `en/services/`. Traducción adaptada.

---

### 🟢 Sprint 3 — Construir Flow OS como plataforma

> **Meta:** que Flow OS sea un producto utilizable end-to-end, no solo un backend con APIs sueltas.

#### 3.1 Patient Journey (el core de Flow OS)

- [x] **S3-01** `[L]` Vista journey en admin — crear componente en `admin.html` que muestre el timeline visual de cada paciente: stage actual del journey (`lead_captured → intake → scheduled → care_plan → follow_up → resolved`), cuánto lleva en cada stage, quién es el owner. Datos de `FlowOsController::journeyPreview`.
- [x] **S3-02** `[L]` Dashboard de stages — panel kanban en `admin.html`: cuántos pacientes hay en cada stage del journey. Click en un stage muestra la lista de pacientes. Alertas de SLA (lead captado hace > 2h sin respuesta, follow-up vencido).
- [x] **S3-03** `[M]` Transiciones automáticas — en `FlowOsJourney.php`, cuando un turno cambia a `completed`, avanzar el case al siguiente stage. Cuando un appointment se crea, mover de `intake_completed` a `scheduled`.
- [x] **S3-04** `[M]` Actions por stage — implementar las `defaultActions` del manifest: al entrar a `lead_captured`, ofrecer formulario de preconsulta y solicitar datos de identidad. Al entrar a `care_plan_ready`, mostrar botón "Enviar plan al paciente".
- [x] **S3-05** `[L]` Intake digital público — crear `es/pre-consulta/index.html` con formulario: nombre, WhatsApp, tipo de piel, condición, fotos. Al enviar: crea caso en Flow OS stage `lead_captured`, notifica al frontdesk. **Esta es la puerta de entrada del patient journey.**
- [x] **S3-06** `[M]` Historial de journey — log de transiciones con timestamps para cada paciente. Vista timeline en admin. Feed de actividad: "Juan → scheduled (hace 2h por operador María)".

#### 3.1b OpenClaw — Copiloto de Inteligencia Clínica

> **Este es el diferenciador central del producto.** OpenClaw acompaña al médico en tiempo real durante la consulta. No reemplaza el criterio clínico — lo apoya. Objetivo: que el médico pueda ver a 8 pacientes/día en lugar de 5, con mejor documentación.

- [x] **S3-OC1** `[M]` Sugerencia de CIE-10 — mientras el doctor escribe el diagnóstico en el campo de texto, mostrar autocompletado con códigos CIE-10 coincidentes en tiempo real. Al seleccionar, guardar el código en el caso. El campo debe tener latencia <200ms. `lib/openclaw/DiagnosisCopilot.php` + endpoint `POST /api/openclaw/cie10-suggest`. Leer el catálogo desde `data/cie10.json`.
- [x] **S3-OC2** `[M]` Protocolo de tratamiento — cuando el médico confirma un diagnóstico CIE-10, mostrar un panel lateral colapsable con: protocolo estándar de tratamiento, medicamentos de primera línea, duración sugerida, seguimiento recomendado. El médico puede aceptar todo, aceptar partes, o ignorar. `lib/openclaw/TreatmentProtocol.php`. Protocolos en `data/protocols/`.
- [x] **S3-OC3** `[L]` Generador de certificado médico — botón "Emitir certificado" en la vista del caso. Tipos: reposo laboral, aptitud médica, constancia de tratamiento, control de salud. Campos: paciente, diagnóstico (CIE-10 autocompletado), días, restricciones, observaciones. Genera PDF con: membrete oficial, datos del médico (registro MSP, nombre, especialidad), folio secuencial por clínica, firma digital (imagen cargada una vez en el perfil del médico). `controllers/CertificateController.php`. **Es el documento más pedido en consulta diaria.**
- [x] **S3-OC4** `[S]` Alerta de interacciones — al agregar un medicamento a la receta, verificar contra los medicamentos activos del paciente (última receta). Si hay interacción conocida: banner amarillo de advertencia (no bloquea). Lista de interacciones críticas en `data/drug-interactions.json`. Actualizable sin deploy.

#### 3.2 Turnero avanzado

- [x] **S3-07** `[L]` Check-in QR — paciente llega al kiosco, escanea QR de su cita (generado al agendar), kiosco lo reconoce, status → `arrived`, asocia al caso. Sin cita → flujo walk-in normal.
- [x] **S3-08** `[M]` Selección de motivo en kiosco — en `kiosco-turnos.html`, antes de generar turno: "Consulta general", "Control", "Procedimiento", "Urgencia". Alimenta `TicketPriorityPolicy`.
- [x] **S3-09** `[M]` Vista expandida del operador — en `operador-turnos.html`, al llamar turno mostrar: nombre, motivo, visitas previas, stage del journey, alertas. Datos de `PatientCaseService::hydrateStore`.
- [x] **S3-10** `[M]` Acciones post-consulta — botones en operador: "Agendar siguiente", "Enviar guía", "Generar receta", "Derivar a procedimiento". Cada uno dispara el action correspondiente.
- [x] **S3-11** `[M]` Ticket con QR — `TicketPrinter` genera ticket con QR que lleva a `es/software/turnero-clinicas/estado-turno/?ticket=XXX`. Paciente ve su posición desde el teléfono.
- [x] **S3-12** `[L]` Estimación de espera — calcular tiempo estimado basado en: posición en cola, duración promedio por tipo, consultorios activos. Mostrar en kiosco y sala. Actualizar en tiempo real.
- [x] **S3-13** `[M]` Sala inteligente — en `sala-turnos.html`, entre llamadas mostrar: tips de cuidado de piel, info del próximo tratamiento (si el turno es de tipo conocido), video educativo rotativo.
- [x] **S3-14** `[S]` Métricas de espera — registrar tiempo real de espera por turno. Registrar throughput/hora. Alimentar `QueueAssistantMetricsStore`. Vista de gráficos en admin.

#### 3.3 Historia Clínica Electrónica

- [x] **S3-15** `[L]` Formulario de anamnesis — vista en admin: motivo, antecedentes personales/familiares, alergias, medicación, fototipo Fitzpatrick, hábitos (sol, tabaco). `ClinicalHistoryService`.
- [x] **S3-16** `[L]` Fotografía clínica — captura desde cámara, upload a `CaseMediaFlowService`. Metadata: fecha, zona corporal. Almacenar organizado por paciente/fecha.
- [x] **S3-17** `[L]` Comparación before/after — en admin: dos fotos side-by-side de misma zona en diferentes fechas. Slider de comparación. Seleccionar fotos del historial del paciente.
- [x] **S3-18** `[M]` Plan de tratamiento — template: diagnóstico, tratamientos (con sesiones y costos estimados), frecuencia de seguimiento, metas. Exportar PDF para el paciente.
- [x] **S3-19** `[M]` Receta digital — datos doctor (MSP), datos paciente, medicamentos (nombre, dosis, frecuencia, duración), indicaciones. PDF con membrete clínico.
- [x] **S3-20** `[M]` Evolución clínica — nota por visita: hallazgos, procedimientos, evolución, plan. Append-only. Integrada al timeline del journey.
- [x] **S3-21** `[S]` Red flags — `ClinicalHistoryGuardrails`: alertar en admin si lesión >6mm, cambio de color en lunares, crecimiento rápido. Badge visual rojo en el caso.
- [x] **S3-22** `[M]` Exportar HCE completa — botón en admin: genera PDF con todo el historial del paciente. Legal compliance via `ClinicalHistoryLegalReadiness`.
- [x] **S3-23** `[M]` Compliance MSP Ecuador — el formulario oficial es **SNS-MSP/HCU-form.002/2021** (Consulta Externa), obligatorio en toda la RPIS y la Red Privada Complementaria. Verificar que la HCE capture todos los bloques requeridos: **1) Identificación del establecimiento y del paciente** (nombres, apellidos, cédula/pasaporte, edad, sexo, número de HCE); **2) Anamnesis** (motivo de consulta, enfermedad actual, antecedentes personales y familiares); **3) Examen físico** (revisión por órganos/sistemas, signos vitales, antropometría, examen regional); **4) Diagnóstico** (código CIE-10 obligatorio, distinguir PRE=presuntivo o DEF=definitivo); **5) Planes** (diagnóstico, terapéutico, educacional); **6) Evolución y Prescripción** (nota de evolución, fármacos con dosis/frecuencia/duración, firma y sello del profesional). Implementar en `lib/clinical_history/ComplianceMSP.php`: función `validate(array $record): array` que devuelve lista de campos faltantes. Mostrar badge rojo en admin si hay campos obligatorios vacíos antes de cerrar la consulta.

#### 3.4 Agendamiento

- [x] **S3-24** `[XL]` Booking público — crear `es/agendar/index.html`: selección de servicio → doctor → fecha → hora → datos del paciente → confirmar. Consultar `CalendarAvailabilityService`. Crear appointment en backend.
- [x] **S3-25** `[M]` Confirmación doble — al agendar: enviar WhatsApp + email con fecha, hora, doctor, dirección, instrucciones de preparación según el tipo de cita.
- [x] **S3-26** `[M]` Reagendamiento self-service — vista pública donde paciente puede mover su cita. Máx 2 cambios, mínimo 24h antes. `src/apps/reschedule/engine.js`.
- [x] **S3-27** `[M]` Lista de espera — si no hay slots, ofrecer "unirse a lista de espera". Notificar por WhatsApp cuando se libere un espacio.
- [x] **S3-28** `[M]` Vista de agenda diaria — en admin: agenda del día con pacientes confirmados, hora, tipo, status. Alertas de overbooking. Botón "marcar llegó" → avanza el journey.

#### 3.5 Telemedicina

- [x] **S3-29** `[XL]` Flujo completo de teleconsulta — paciente solicita → `TelemedicineIntakeService` evalúa → `TelemedicineSuitabilityEvaluator` decide si es viable → consent digital → cita virtual → seguimiento.
- [x] **S3-30** `[L]` Vista de teleconsulta — `es/telemedicina/consulta/index.html`: sala de espera virtual, video embed (Jitsi/Daily.co), chat, compartir fotos. Diseño premium.
- [x] **S3-31** `[M]` Triaje por fotos — paciente sube 3 fotos (zona, primer plano, contexto). `TelemedicineIntakeService` las pre-clasifica y adjunta al caso.

#### 3.6 Pagos

- [ ] **S3-32** `[L]` Checkout integrado — `es/pago/index.html`: monto, concepto, métodos (Stripe, transferencia, efectivo). Generar recibo digital.
- [ ] **S3-33** `[M]` Verificación de transferencia — paciente sube foto del comprobante. Admin verifica y aprueba. Status: pendiente → verificado → aplicado.
- [ ] **S3-34** `[M]` Estado de cuenta — vista en admin: historial de pagos por paciente, saldos pendientes, próximos vencimientos.
- [ ] **S3-35** `[L]` `[HUMAN]` Factura SRI — integrar con facturación electrónica del SRI Ecuador. **BLOQUEADO hasta junio 2026:** El médico titular (Dr. Hermano) aún no se gradúa. Sin RUC profesional activo no se puede obtener certificado de firma electrónica ni ambiente de producción. **No tocar hasta julio 2026.** Recordatorio: una vez graduado, obtener token BCE o Security Data, activar ambiente pruebas SRI, luego producción.

#### 3.7 Perfil del médico y configuración clínica

> **Falencia detectada (auditoría 2026-03-29):** Los certificados y recetas generan PDF con "Dr./Dra." y sin registro MSP porque no existe un perfil del médico en el sistema. Sin esto, ningún documento legal tiene validez.

- [x] **S3-36** `[S]` Perfil del médico — en admin settings: formulario para cargar datos del médico principal: nombre completo, especialidad, número de registro MSP, firma digital (imagen PNG/JPG, se guarda como base64 en `data/config/doctor-profile.json`). `controllers/DoctorProfileController.php` + `GET/POST /api.php?resource=doctor-profile`. Este dato alimenta automáticamente certificados, recetas y evoluciones.
- [x] **S3-37** `[S]` Perfil de clínica — nombre clínica, dirección, teléfono, logo (imagen). `data/config/clinic-profile.json`. Alimenta el membrete de todos los PDF. Sin esto el membrete dice "Aurora Derm" hardcoded.
- [ ] **S3-38** `[M]` Instalación de dompdf — agregar `dompdf/dompdf` vía composer: `composer require dompdf/dompdf`. Sin esto los PDF de certificados y recetas son texto plano (fallback). Verificar que `CertificateController::generatePdfBase64()` detecta automáticamente la librería y la usa. Test: `GET /api.php?resource=certificate&id=X&format=pdf` debe devolver `Content-Type: application/pdf` con diseño completo.
- [x] **S3-39** `[M]` Receta PDF renderer — actualmente `OpenclawController::savePrescription()` guarda la receta en HCE pero `GET /api.php?resource=openclaw-prescription&id=X&format=pdf` devuelve 404. Crear `PrescriptionPdfRenderer.php` en `lib/openclaw/`: genera HTML con membrete de la clínica, datos del médico (MSP), datos del paciente, lista de medicamentos (nombre genérico, dosis, frecuencia, duración, indicaciones). Usar mismo sistema dompdf/fallback que `CertificateController`. URL WhatsApp lista al final del endpoint de prescripción.

#### 3.8 OpenClaw — Frontend e integración admin

> **Falencia detectada:** El backend de OpenClaw está completo (12 endpoints), pero `admin.html` no carga `openclaw-chat.js` en ninguna condición. El médico no puede usar la herramienta principal del producto.

- [x] **S3-40** `[M]` Integrar OpenClaw en admin — en `admin.html`, dentro del panel del caso del paciente (vista detalle), agregar un botón flotante "🩺 OpenClaw" o una pestaña "Copiloto". Al hacer clic, abre el widget `openclaw-chat.js` cargado dinámicamente con el `case_id` del paciente activo. El chat ya sabe quién es el paciente porque llama al endpoint `openclaw-patient` con ese ID. Sin esto, el médico no puede usar la IA.
- [ ] **S3-41** `[S]` CIE-10 autocomplete widget — el backend `GET /api.php?resource=openclaw-cie10-suggest&q=dermatitis` ya existe. Falta el frontend: en el campo de diagnóstico de la HCE en admin, mientras el médico escribe, hacer un `debounce(200ms)` + fetch al endpoint y mostrar un dropdown con los resultados. Al seleccionar: llenar el campo con código + descripción. Archivo: `js/cie10-autocomplete.js`. Cargar en admin con `<script src="js/cie10-autocomplete.js">`.
- [ ] **S3-42** `[M]` Panel de protocolo clínico — cuando el médico selecciona un código CIE-10, hacer `GET /api.php?resource=openclaw-protocol&code=L20.0` y mostrar un panel lateral colapsable (slide-in desde la derecha) con: primera línea de tratamiento, medicamentos sugeridos (con botón "Agregar a receta"), seguimiento, instrucciones para el paciente. El médico puede aceptar todo de un click o ignorar. Estilo coherente con `main-aurora.css`.
- [ ] **S3-43** `[S]` Botón "Emitir certificado" en admin — en la vista del caso del paciente en `admin.html`, agregar botón "📋 Certificado". Al hacer clic: modal con formulario (tipo de certificado, días de reposo si aplica, diagnóstico CIE-10 autocompletado, observaciones). Al confirmar: `POST /api.php?resource=certificate` → mostrar link de descarga PDF + botón WhatsApp. El folio aparece en pantalla para el médico.
- [ ] **S3-44** `[S]` Historial de certificados en admin — en el perfil del paciente, pestaña "Documentos": lista de certificados emitidos (folio, tipo, fecha). Botón "Descargar" por cada uno. `GET /api.php?resource=certificate&case_id=X`.

#### 3.9 Calidad y validación del sistema

> **Falencia detectada:** `gate.js` da PASS a S3-19 sin verificar que la receta realmente funcione. Dice "no specific check" para la mayoría de tareas. No hay validación real.

- [x] **S3-45** `[M]` Gate checks específicos por tarea — ampliar `bin/gate.js` para verificar artefactos concretos por tarea. Ejemplos: S3-19 → verificar que existe `controllers/PrescriptionController.php` O que `controllers/OpenclawController.php` tiene el método `savePrescription` con PDF. S3-24 → verificar que existe `es/agendar/index.html`. S3-36 → verificar `controllers/DoctorProfileController.php`. Mapa de checks en `bin/lib/gate-checks.js`. Output debe ser PASS/FAIL con evidencia.
- [ ] **S3-46** `[S]` ComplianceMSP validator — crear `lib/clinical_history/ComplianceMSP.php` con método `validate(array $record): array` que devuelve lista de campos faltantes según formulario SNS-MSP/HCU-form.002. Campos mínimos: `patient_name`, `patient_id`, `reason_for_visit`, `physical_exam`, `cie10_code`, `cie10_type (PRE|DEF)`, `treatment_plan`, `evolution_note`, `doctor_msp`. Badge rojo en admin si incompleto al intentar cerrar la consulta.
- [ ] **S3-47** `[S]` Health check completo — el endpoint `GET /api.php?resource=health` debe verificar y reportar: estado de cada tier del AIRouter (Codex disponible, OpenRouter disponible, local disponible), archivos de datos existentes (`data/cie10.json`, `data/protocols/`, `data/drug-interactions.json`), perfil doctor cargado, perfil clínica cargado. Respuesta JSON: `{ ok, tiers, data_files, doctor_profile, clinic_profile }`.

#### 3.10 Herramientas de gobernanza adicionales

- [x] **S3-48** `[S]` BLOCKERS.md auto-generado — modificar `bin/stuck.js` para que además de liberar el claim, escriba la entrada en `BLOCKERS.md` con: tarea, razón, fecha, agente. Ya existe el archivo. Verificar que el flujo completo funciona: `node bin/stuck.js S3-XX "razón"` → libera claim → escribe en BLOCKERS.md → hace commit automático.
- [x] **S3-49** `[S]` npm run status — comando que en una sola ejecución muestra: progreso del sprint (%), claims activos, ramas pendientes de merge, velocidad actual, próxima fecha de revisión. Combinar output de `report.js` + `velocity.js --json` + `merge-ready.js --json`. Guardarlo como `bin/status.js`. Agregar a `package.json`.
- [ ] **S3-50** `[S]` Notificación de bloqueo por email/WhatsApp — cuando un agente ejecuta `bin/stuck.js`, además de liberar el claim, enviar un mensaje WhatsApp al número del director (`AURORADERM_DIRECTOR_PHONE` en env) con: qué tarea se bloqueó, quién la tenía, razón. Usar la misma función de WhatsApp que ya existe en el sistema.

#### 3.11 OpenClaw — Integraciones externas

- [x] **S3-51** `[M]` openapi-openclaw.yaml completar — el archivo existe (466 líneas) pero hay 12 endpoints en el backend. Verificar que el YAML tiene todos: `openclaw-patient`, `openclaw-cie10-suggest`, `openclaw-protocol`, `openclaw-chat`, `openclaw-save-diagnosis`, `openclaw-save-evolution`, `openclaw-prescription`, `openclaw-certificate`, `openclaw-interactions`, `openclaw-summarize`, `openclaw-router-status`. Agregar los que falten con schema correcto. Este YAML es el que se carga en el Custom GPT de ChatGPT para que el médico use desde ChatGPT directamente.
- [x] **S3-52** `[M]` Custom GPT instructions — crear `docs/chatgpt-custom-gpt-instructions.md` con las instrucciones exactas para configurar el Custom GPT de ChatGPT: nombre ("Aurora Derm OpenClaw"), descripción, instrucciones del sistema (rol del GPT, cómo usar los actions, lenguaje español), URL del servidor, autenticación OAuth. El médico copia esto al crear su GPT en platform.openai.com. Sin esto no puede usar la integración ChatGPT↔Aurora Derm.
- [x] **S3-53** `[S]` Modo offline del AIRouter — cuando todos los tiers fallan, el Tier 3 (heurística local) debe devolver respuestas útiles pre-construidas para los casos más comunes en dermatología: "¿qué es esto en la piel?" → template de diagnóstico diferencial, "genera receta" → template de receta en blanco, "genera certificado" → redirigir a botón de certificado. El médico debe saber que está en modo offline: badge visible "🔴 IA sin conexión — modo local".
- [x] **S3-54** `[L]` Resumen de consulta para paciente — al cerrar la consulta (`openclaw-summarize`), generar automáticamente un mensaje WhatsApp para el paciente con: diagnóstico en lenguaje no técnico, medicamentos con instrucciones de toma, fecha del próximo control, 3 señales de alarma cuando debe consultar urgente. El médico puede editar el mensaje antes de enviarlo. Un click: enviado.

#### 3.9 Calidad, Gobernanza y Deuda Técnica

> Tareas derivadas de la auditoría del 29-mar-2026. Scorecard actual: Ejecución ✅ Consistencia ✅ Tests 🔴 Mantenibilidad 🔴 Bus-factor 🔴

- [x] **S3-55** `[S]` 🔴 CRÍTICO Fix parse error `lib/email.php` — `php -l lib/email.php` falla con "Unclosed '{' on line 755 … on line 983". PHPUnit no arranca en toda la suite mientras este error exista. **Bloqueador de testing.** Localizar el cierre de bloque faltante, corregir sin cambiar lógica. Verificar: `php -l lib/email.php` → "No syntax errors". Luego confirmar que `php vendor/bin/phpunit --stop-on-failure --no-coverage` arranca sin fatal.
- [x] **S3-56** `[M]` PHPUnit smoke baseline — después de S3-55, definir y dejar en verde un subset pequeño y rápido: mínimo 1 test por cada controlador crítico (OpenclawController, ClinicalHistoryController, CertificateController, QueueController). Crear `phpunit.xml` con testsuite `Smoke` que solo incluya esos. Debe correr en <30 segundos. Agregar a gate.js como check obligatorio antes de PASS si los archivos tocados son PHP.
- [x] **S3-57** `[S]` gate.js — check `php -l` automático — antes de mostrar GATE PASSED, ejecutar `php -l` sobre todos los archivos `.php` incluidos en `git diff --name-only HEAD` del commit activo. Si alguno tiene parse error → GATE FAILED con ruta y línea. Esto cierra el loop: un agente no puede pasar la gate con código PHP roto.
- [x] **S3-58** `[M]` conflict.js — precisión quirúrgica — cambiar de heurística solo textual a bloqueo real para archivos frágiles: si hay claim activo en zona que toca `lib/routes.php`, `api.php`, `AGENTS.md`, o controladores OpenClaw/ClinicalHistory, hacer `exit(1)` con mensaje explícito. Para zonas `data/` y `bin/config` solo advertir (exit 0). Reducir false positives: los warnings de "zona data solapada" eran ruido sistemático que los agentes ya normalizaban.
- [x] **S3-59** `[L]` Split `ClinicalHistoryService.php` (4.766 líneas) — archivo monolítico con 3 responsabilidades mezcladas. Separar en: `ClinicalHistorySessionService.php` (gestión de sesiones/episodios), `ClinicalHistoryDocumentService.php` (generación de PDFs, exports), `ClinicalHistoryValidationService.php` (MSP compliance, guardrails). Mantener `ClinicalHistoryService.php` como facade que delega a los 3. Sin romper la interface pública que usan los controladores.
- [x] **S3-60** `[L]` Split `ClinicalHistoryRepository.php` (4.198 líneas) — separar en repositorios por agregado: `SessionRepository` (sesiones, episodios), `EvolutionRepository` (notas de evolución), `PrescriptionRepository` (recetas), `DiagnosisRepository` (diagnósticos + CIE-10). Mantener `ClinicalHistoryRepository` como facade. Los métodos estáticos actuales pueden migrar gradualmente sin big bang.
- [x] **S3-61** `[L]` Split `install-hub.js` (24.990 líneas) — módulo de admin más grande del repo. Separar por dominio sin romper imports: `install-hub-queue.js` (lógica de turnero), `install-hub-display.js` (render de sala/kiosco), `install-hub-install.js` (flujo de instalación y config). Usar imports/exports ES modules. El archivo principal queda como barrel re-exportando. Verificar que los tests en `tests-node/` siguen pasando.
- [x] **S3-62** `[M]` Consolidar npm scripts — `package.json` tiene 273 scripts: demasiada superficie cognitiva. Crear 8 scripts wrapper de alto nivel que reemplacen los más usados: `dev` (servidor local), `test` (PHPUnit smoke + conflict check), `gov:status` (claim status + report), `gov:dispatch` (dispatch:fullstack), `gov:gate` (gate), `gov:conflict` (conflict scan), `build` (sync backlog + lint PHP), `audit` (velocity + verify). Listar los scripts legacy marcándolos `// legacy` en un comentario. No eliminar nada todavía — solo hacer que el agente sepa cuáles usar.
- [x] **S3-63** `[S]` Tabla de comandos oficiales — en `CLAUDE.md` (o `README.md` sección Desarrollo), agregar tabla markdown de 2 columnas: **Comando oficial** | **Para qué sirve**. Máximo 12 filas. Incluir solo los comandos que un agente nuevo debería conocer en day 1: dispatch, claim, gate, release, report, conflict, stuck, velocity, sync-backlog. Agregar columna **NO usar** con los equivalentes legacy. Esto reduce el error de usar herramientas desactualizadas.

---

### 🔵 Sprint 4 — Escalar el negocio

> **Meta:** Aurora Derm como plataforma SaaS, inteligencia artificial, crecimiento comercial.

#### 4.1 Inteligencia Artificial

- [x] **S4-01** `[L]` Triage IA — `ClinicalHistoryAIService`: analizar fotos + descripción del paciente → sugerir urgencia (1-5), diagnóstico diferencial probable, derivación automática a tipo de consulta.
- [x] **S4-02** `[L]` Chatbot WhatsApp — `WhatsappOpenclawController`: responder preguntas frecuentes por WhatsApp con IA: horarios, precios, preparación, dirección. Escalar a humano si la pregunta es clínica.
- [x] **S4-03** `[M]` Predicción de no-show — modelo basado en: historial de asistencia, hora, día, tiempo desde booking. Dashboard en admin con probabilidad de no-show por cita.
- [x] **S4-04** `[M]` Resúmenes automáticos — `LeadOpsService`: generar resumen post-consulta para el paciente: "Hoy diagnosticamos X, recetamos Y, próxima cita en Z semanas." Enviar por WhatsApp.
- [ ] **S4-05** `[M]` Scoring de leads — clasificar leads por probabilidad de conversión basado en: engagement web, tipo de consulta, urgencia. Priorizar follow-up en admin.

#### 4.2 Multi-clínica SaaS

- [ ] **S4-06** `[L]` Tenant isolation audit — verificar que `lib/tenants.php` aísla datos entre clínicas: pacientes, agenda, turnero, pagos. Cada clínica tiene namespace propio.
- [ ] **S4-07** `[XL]` Onboarding de clínica — flujo: registrar clínica → `TurneroClinicProfile` → cargar staff → activar servicios → generar URL.
- [ ] **S4-08** `[L]` Pricing page — `es/software/turnero-clinicas/precios/index.html`: Free (1 doctor), Pro ($49/mes, 5 doctores), Enterprise (contactar). Design premium con comparativa.
- [ ] **S4-09** `[L]` Demo interactiva mejorada — `es/software/turnero-clinicas/demo/index.html`: demo funcional del turnero con datos de ejemplo. El visitante experimenta: kiosco → turno → operador lo llama.
- [ ] **S4-10** `[L]` Dashboard multi-clínica — vista admin: stats de todas las clínicas del tenant. Turnos/día, ingresos, pacientes. Comparativa entre sucursales.
- [ ] **S4-11** `[L]` Whitelabel — personalizar: logo, colores, nombre, dominio por clínica. Engine Flow OS intacto, branding customizable.
- [ ] **S4-12** `[L]` API docs — `es/software/turnero-clinicas/api-docs/index.html`: documentación OpenAPI de la API para integraciones externas.

#### 4.3 Revenue

- [ ] **S4-13** `[L]` Página de paquetes — `es/paquetes/index.html`: combos de tratamiento. "Plan Piel Perfecta" (3 laser + peeling + follow-up). Precio visible. CTA WhatsApp.
- [ ] **S4-14** `[M]` Programa de referidos — `es/referidos/index.html`: beneficio por paciente referido. CTA: "Comparte tu link".
- [ ] **S4-15** `[M]` Promociones — `es/promociones/index.html`: template para ofertas rotativas. Mes de la piel, Día de la Madre.
- [ ] **S4-16** `[L]` Membresía — `es/membresia/index.html`: plan mensual con beneficios (consultas priority, descuentos, contenido exclusivo).
- [ ] **S4-17** `[M]` Gift cards — `es/gift-cards/index.html`: montos predefinidos, generación de código, PDF descargable.

#### 4.4 Analytics

- [ ] **S4-18** `[M]` Conversion funnel — trackear embudo: visita → scroll → click WhatsApp → mensaje. Eventos GA4.
- [x] **S4-19** `[S]` Microsoft Clarity — agregar script gratis de heatmaps. Analizar scroll depth, clicks, abandono.
- [ ] **S4-20** `[M]` Dashboard de conversión en admin — vista: visitas/día, clicks WhatsApp/día, top servicios. Datos desde server logs o GA4 API.

#### 4.5 Limpieza técnica

- [ ] **S4-21** `[L]` Surface audit — `src/apps/queue-shared/` tiene **398 archivos** JS. La mayoría son turnero-surface-\*.js generados. Auditar cuáles se importan realmente desde HTML/JS del turnero. Listar dead code.
- [ ] **S4-22** `[XL]` Eliminar surfaces huérfanas — mover a `_archive/turnero-surfaces/` los archivos no importados. Probablemente ~80% son dead code. **Esto puede reducir el repo en miles de líneas.**
- [x] **S4-23** `[M]` Package.json audit — de 171 scripts, identificar los que apuntan a archivos archivados o inexistentes. Listar para limpieza.
- [ ] **S4-24** `[M]` CSS dead code — 8+ archivos CSS en raíz. Verificar cuáles se importan desde HTML. Listar huérfanos.
- [ ] **S4-25** `[M]` Images audit — 262 webp en `images/optimized/`. Verificar cuáles se referencian desde HTML/CSS. Listar huérfanas (no eliminar, solo listar).
- [ ] **S4-26** `[L]` CI pipeline audit — `.github/workflows/*.yml` — verificar que todos los jobs referencian archivos que existen. Eliminar jobs que apuntan a archivos archivados.

---

### 🟣 Sprint 5 — Portal del Paciente (PWA)

> **Meta:** El paciente tiene su propio espacio digital. Puede ver su historia, su próxima cita, sus fotos, su plan de tratamiento. Todo desde el celular, sin instalar nada. Esto fideliza y reduce llamadas de seguimiento.

#### 5.1 PWA y acceso del paciente

- [ ] **S5-01** `[M]` Manifest PWA — `manifest.json` ya existe. Verificar que `es/portal/` tiene una versión instalable: icon 512x512, `start_url`, `display: standalone`. Probar "Agregar a pantalla de inicio" en Android.
- [ ] **S5-02** `[L]` Login paciente — `es/portal/login/index.html`: identificación por WhatsApp (número + código OTP). Sin contraseñas. Sesión en `localStorage` con JWT firmado. Backend: `controllers/PatientPortalController.php`.
- [ ] **S5-03** `[L]` Dashboard del paciente — `es/portal/index.html`: próxima cita, última consulta, resumen del plan actual. Diseño mobile-first. CTA: "¿Tiene preguntas? WhatsApp".
- [ ] **S5-04** `[M]` Historial propio — `es/portal/historial/index.html`: lista de consultas (fecha, doctor, motivo). Tap para ver detalle. Solo lectura. Datos desde `ClinicalHistoryService`.
- [ ] **S5-05** `[M]` Mis fotos — `es/portal/fotos/index.html`: galería de fotos clínicas organizadas por zona y fecha. El paciente ve su propia evolución. Solo las fotos marcadas como "visible al paciente".
- [ ] **S5-06** `[L]` Mi receta activa — `es/portal/receta/index.html`: receta digital actual (medicamentos, dosis, frecuencia). PDF descargable. Incluye QR de verificación.
- [ ] **S5-07** `[M]` Mi plan de tratamiento — `es/portal/plan/index.html`: sesiones programadas, progreso (3/6 sesiones), próximos pasos. Visual con timeline.
- [ ] **S5-08** `[M]` Notificaciones push — `sw.js` actualizado: notificar al paciente 24h antes de su cita. Usar Web Push API. Backend: `controllers/NotificationController.php`.
- [ ] **S5-09** `[S]` Consentimiento digital — `es/portal/consentimiento/index.html`: formulario de consentimiento informado. Firma táctil en móvil. Guardar PDF firmado en `ClinicalHistoryService`.

#### 5.2 Comunicación automática

- [ ] **S5-10** `[M]` Recordatorio 24h — `LeadOpsService`: enviar mensaje WhatsApp automático 24h antes de cada cita: "Mañana tiene consulta con Dra. Rosero a las 10:00. Confirme o reagende: [link]".
- [ ] **S5-11** `[M]` Follow-up post-consulta — 48h después de la cita: "¿Cómo se ha sentido después de su consulta? Si tiene dudas, escríbanos." Con link al portal.
- [ ] **S5-12** `[M]` Recordatorio de medicación — si la receta tiene duración, enviar recordatorio a mitad del tratamiento: "Recuerde continuar con [medicamento] hasta [fecha]."
- [ ] **S5-13** `[S]` Cumpleaños — mensaje automático el día del cumpleaños del paciente. Tono clínico-cálido. No marketing.
- [ ] **S5-14** `[M]` WhatsApp bot IA — `WhatsappOpenclawController` mejorado: responder preguntas del paciente fuera de horario: "¿Cuáles son sus horarios?", "¿Cómo llego?", "¿Qué debo llevar?". Escalar a humano si es pregunta clínica.

#### 5.3 Telemedicina real

- [ ] **S5-15** `[XL]` Sala de videoconsulta — integrar Jitsi Meet embebido en `es/telemedicina/sala/index.html`. Link único por cita. Paciente entra desde el portal, doctor desde el admin. Sin instalación.
- [ ] **S5-16** `[M]` Pre-consulta digital — `es/telemedicina/pre-consulta/index.html`: 10 min antes de la teleconsulta, el paciente completa: "¿Qué le preocupa hoy?", sube foto si tiene lesión nueva. El doctor la ve antes de entrar.
- [ ] **S5-17** `[M]` Grabación de consenso — opción de grabar la teleconsulta con consentimiento explícito de ambas partes. Guardar en el caso con metadatos.
- [ ] **S5-18** `[L]` Triaje por fotos IA — `TelemedicineIntakeService`: el paciente sube 3 fotos (zona, primer plano, luz natural). IA pre-clasifica urgencia (1-5) y sugiere tipo de consulta. El doctor valida.

#### 5.4 Experiencia clínica premium

- [ ] **S5-19** `[M]` Before/after real — en el portal del paciente, slider de comparación con sus propias fotos (Día 1 vs Semana 12). Reutilizar componente BA de `index.html`.
- [ ] **S5-20** `[L]` Encuesta de satisfacción — 72h después de la cita: NPS de 1-5 + comentario libre. Guardar en admin. Usar para mejorar servicio.
- [ ] **S5-21** `[M]` Red flags para el paciente — si en los últimos 30 días hay una nota de "cambio sospechoso" en su caso, notificar al paciente: "Su seguimiento recomienda una consulta pronto."
- [ ] **S5-22** `[S]` Exportar mi historia — botón en el portal: descargar PDF completo de la historia clínica propia. Legal compliance: el paciente tiene derecho a su información.

---

### 🔴 Sprint 6 — Plataforma SaaS para Clínicas

> **Meta:** Flow OS deja de ser solo Aurora Derm y se convierte en una plataforma que cualquier clínica puede usar. El modelo de negocio es SaaS. La clínica paga mensual y tiene su propio Flow OS branded.

#### 6.1 Onboarding de nuevas clínicas

- [ ] **S6-01** `[XL]` Wizard de onboarding — `es/software/turnero-clinicas/empezar/index.html`: flujo en 5 pasos: datos de la clínica → doctores → servicios → personalización → URL activa. Completable en <10 minutos.
- [ ] **S6-02** `[L]` Perfil de clínica — `TurneroClinicProfile` completo: nombre, logo, colores, dirección, horarios, WhatsApp, especialidades. Cada clínica tiene su propio subdomain `{slug}.flowos.ec`.
- [ ] **S6-03** `[M]` Invitar staff — desde el admin: enviar WhatsApp/email para que un médico cree su perfil. Rol: admin, doctor, recepcionista. Permisos por rol.
- [ ] **S6-04** `[M]` Activación de servicios — checklist: qué módulos activa la clínica (turnero, HCE, telemedicina, portal paciente, analytics). Modular y cobrable por módulo.
- [ ] **S6-05** `[L]` Datos de demo — al crear una clínica nueva, opcionar "cargar datos de ejemplo": 3 pacientes ficticios, agenda de prueba, citas simuladas. Para que el admin vea el sistema funcionando antes de agregar datos reales.

#### 6.2 Whitelabel y personalización

- [ ] **S6-06** `[L]` Theme engine — en admin: subir logo, elegir color primario (con previsualización en tiempo real). El CSS cambia dinámicamente usando variables. Sin tocar código.
- [ ] **S6-07** `[M]` Dominio propio — guía paso a paso para que la clínica apunte su dominio a Flow OS. DNS + SSL automático via Let's Encrypt.
- [ ] **S6-08** `[M]` Email branding — emails del sistema (confirmación de cita, receta, follow-up) salen con la marca de la clínica: su logo, su nombre, sus colores.
- [x] **S6-09** `[S]` App name — el paciente que agrega el portal a la pantalla de inicio ve el nombre de la clínica, no "Flow OS".

#### 6.3 Modelo de negocio y pagos

- [ ] **S6-10** `[L]` Pricing SaaS — definir y publicar: Free (1 doctor, 50 citas/mes), Starter ($29/mes, 3 doctores), Pro ($79/mes, 10 doctores + IA), Enterprise (contactar). Comparativa en `es/software/turnero-clinicas/precios/index.html`.
- [ ] **S6-11** `[L]` Suscripción Stripe — integrar Stripe para cobros mensuales recurrentes. Admin puede ver su plan activo, fecha de renovación, facturas.
- [ ] **S6-12** `[M]` Trial 14 días — toda clínica nueva empieza con 14 días de Pro gratis. Al día 12: recordatorio de renovación. Al día 14 si no renueva: downgrade a Free.
- [ ] **S6-13** `[M]` Revenue dashboard (owner) — vista interna para el dueño de Flow OS: MRR, churn, clínicas activas, conversión trial→pago. Solo visible con rol `superadmin`.

#### 6.4 Crecimiento y distribución

- [ ] **S6-14** `[L]` Landing para clínicas — `es/software/turnero-clinicas/index.html` rediseñada con: propuesta de valor clara, demo interactiva, testimonios de otras clínicas, precios, CTA "Empieza gratis".
- [ ] **S6-15** `[M]` Demo interactiva — `es/software/turnero-clinicas/demo/index.html`: experiencia guiada de 3 minutos. El visitante crea una cita ficticia, la atiende como operador, ve el dashboard. Sin datos reales.
- [ ] **S6-16** `[M]` Programa de referidos para clínicas — una clínica refiere a otra: 1 mes gratis para ambas. Link único rastreable.
- [ ] **S6-17** `[M]` Case study Aurora Derm — `es/software/turnero-clinicas/caso-aurora-derm/index.html`: historia de cómo Aurora Derm usó Flow OS. Métricas reales: tiempos de espera, NPS, citas/día. El mejor argumento de venta.

#### 6.5 API y ecosistema

- [ ] **S6-18** `[L]` API pública v1 — endpoints documentados para: crear paciente, crear cita, consultar disponibilidad, recibir webhook de cita confirmada. Auth con API key.
- [ ] **S6-19** `[L]` API docs interactiva — `es/software/turnero-clinicas/api-docs/index.html`: Swagger UI con los endpoints de la API v1. Probar en vivo con datos de sandbox.
- [ ] **S6-20** `[M]` Webhooks — cuando cambia el status de una cita, Flow OS puede notificar a sistemas externos (sistema contable, CRM, etc.) via webhook configurable desde el admin.
- [ ] **S6-21** `[M]` Integración Google Calendar — doctor puede sincronizar su agenda de Flow OS con Google Calendar. Bidireccional: cita en Flow OS → aparece en GCal.
- [ ] **S6-22** `[S]` Status page — `status.flowos.ec`: página pública con uptime de los servicios. Verde/amarillo/rojo por componente. Notificación automática si hay incidente.

#### 6.6 Soporte y operaciones

- [ ] **S6-23** `[M]` Ticket de soporte — desde el admin de la clínica: "Crear ticket" → descripción + screenshot. Sistema interno. El equipo Flow OS lo ve en un dashboard de soporte.
- [ ] **S6-24** `[M]` Base de conocimiento — `es/software/turnero-clinicas/ayuda/index.html`: artículos con capturas de pantalla. Búsqueda. "Cómo agregar un doctor", "Cómo configurar el turnero", etc.
- [ ] **S6-25** `[L]` Monitoreo multi-tenant — alertas automáticas si una clínica tiene: 0 citas en 3 días, error 500 frecuente, tasa de no-show >50%. Dashboard interno de salud del ecosystem.

---

### ⚙️ Sprint 7 — Operaciones, Seguridad y Deuda de Infraestructura

> **Meta:** Pasar de "funciona en dev" a "sobrevive en producción". Evidencia directa del repo: Dockerfile existe pero sin health checks, CSP en Caddy no cubre aurora-derm.com, legacy_password activo en lib/auth.php, 400 archivos en queue-shared, k8s/secret.yaml.example con change-me como valor.

#### 7.1 Seguridad y autenticación

- [ ] **S7-01** `[M]` Auditar y eliminar `legacy_password` de `lib/auth.php` — `grep -n 'legacy_password\|legacy_fallback'` devuelve 6 líneas activas (136, 146, 148, 172, 175, 1456). La función `internal_console_legacy_fallback_payload()` expone un mecanismo de autenticación alternativo sin rate-limit ni logging. Mapear: ¿quién llama a `internal_console_auth_fallbacks_payload()`? Si nadie en producción lo necesita ya, envolver en `if (app_env('INTERNAL_LEGACY_AUTH') === 'true')` para que esté desactivado por default. Documentar en SECURITY.md.
- [ ] **S7-02** `[S]` Hardening `k8s/secret.yaml.example` — el archivo tiene `AURORADERM_ADMIN_PASSWORD: "change-me"` y `sk_live_...` como placeholders. Un developer podría deployar con valores por defecto. Agregar un script `ops/check-secrets.sh` que lea el secret real (via `kubectl get secret`) y falle si encuentra cualquier valor `change-me` o `...`. Incluirlo en el runbook de deploy.
- [ ] **S7-03** `[M]` CSP `ops/caddy/Caddyfile` — el Content-Security-Policy en Caddy no incluye dominios de aurora-derm (solo pielarmonia.com). `grep 'aurora' ops/caddy/Caddyfile` devuelve 0 resultados. Añadir los dominios de Aurora Derm al CSP, al `@publicHost` y al bloque de headers. Verificar que el CSP no bloquea ningún asset del admin ni de OpenClaw. Herramienta: CSP Evaluator (csp-evaluator.withgoogle.com).
- [ ] **S7-04** `[S]` Rate limiting en endpoints sensibles — `api.php` no tiene rate limiting por IP en rutas de auth. Agregar middleware en `lib/ApiKernel.php` o en el bloque Caddy: limitar `/api.php?resource=admin-login` a 5 intentos/minuto por IP. Usar header `X-RateLimit-*` en respuesta. Documentar en SECURITY.md.
- [ ] **S7-05** `[S]` Auditar permisos por rol en endpoints OpenClaw — `OpenclawController` tiene `requireAuth()` pero no verifica el rol del usuario autenticado. Un recepcionista autenticado puede ejecutar `openclaw-chat`, `openclaw-prescription`, `openclaw-certificate`. Definir en `lib/auth.php` qué rol puede acceder a qué endpoint clínico. Mínimo: separar `doctor` de `receptionist` para endpoints de prescripción y certificado.

#### 7.2 Operaciones y runtime

- [ ] **S7-06** `[M]` Health checks en Dockerfile — el `Dockerfile` actual no tiene `HEALTHCHECK`. El load balancer no puede saber si el contenedor está sano. Agregar: `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -fs http://localhost/api.php?resource=health || exit 1`. Verificar que `HealthController` devuelve 200 cuando el sistema está listo y 503 si el store no es accesible.
- [ ] **S7-07** `[M]` Prometheus scraping real — `docker-compose.monitoring.yml` tiene Prometheus configurado, pero `prometheus.docker.yml` apunta a pielarmonia. Verificar que las métricas de Aurora Derm (`/api.php?resource=queue-state`) están en los targets de Prometheus. Crear al menos 1 regla de alerta en `prometheus.rules.yml` para: `queue_size > 20` y `api_error_rate_5m > 5%`. Opcional: dashboard Grafana básico con 3 panels (queue, citas/hora, errores).
- [ ] **S7-08** `[S]` Backup y restore automatizado — no hay ninguna tarea que valide backup del store JSON. El store principal en `data/store.json` (y derivados) es el único estado del sistema. Crear `ops/backup.sh`: copiar a `data/backups/YYYY-MM-DD-HH.json.gz`, mantener últimos 7 días, rotar automáticamente. Agregar a cron o como script que el operador ejecuta vía `npm run backup`. Documentar el proceso de restore en `docs/RUNBOOK.md`.
- [ ] **S7-09** `[S]` k8s readiness/liveness probes — `k8s/deployment.yaml` no tiene `readinessProbe` ni `livenessProbe`. Kubernetes no puede detectar pods zombies. Agregar ambos apuntando a `/api.php?resource=health`. `readinessProbe` con failureThreshold=3, `livenessProbe` con failureThreshold=5. Verificar que el `health` endpoint responde en <200ms bajo carga.
- [ ] **S7-10** `[M]` Incident response playbook — no existe un runbook de "¿qué hago cuando el sistema falla en producción?". Crear `docs/INCIDENT.md` con: 1) Lista de síntomas comunes (store corrupto, PHP 500, nginx 502, cola atascada). 2) Comandos exactos de diagnóstico. 3) Procedimiento de rollback. 4) Contactos de escalación. Tiempo objetivo de resolución por severidad: P1=15min, P2=1h, P3=4h.

#### 7.3 Dead code y superficie no usada

- [ ] **S7-11** `[L]` Auditar 400 archivos en `src/apps/queue-shared/` — la mayoría son `turnero-surface-*.js` generados. Ejecutar: `grep -rL "import.*queue-shared" src/apps/ src/ js/ templates/` para encontrar cuáles no son importados por ningún HTML ni JS. Listar en `docs/DEAD_CODE.md`. NO eliminar en esta tarea, solo listar con tamaño. Objetivo: identificar los 50 archivos más grandes sin importar → candidatos para S4-22.
- [ ] **S7-12** `[M]` Auditar scripts npm huérfanos — `package.json` tiene 273 scripts. Ejecutar: `node -e "const p=require('./package.json'); Object.keys(p.scripts).forEach(k=>{const v=p.scripts[k]; if(v.includes('generate-s211') || v.includes('archive')) console.log(k,v);})"` para identificar scripts que apuntan a archivos archivados. Generar lista en `docs/NPM_SCRIPTS_AUDIT.md`. Marcar cada script como: `[OFFICIAL]`, `[LEGACY]`, `[ORPHAN]`. No eliminar todavía.
- [ ] **S7-13** `[S]` CSS huérfano en raíz — hay 8+ CSS en la raíz (`queue-display.css`, `legal.css`, `app-downloads.css`, etc.). Ejecutar: `for f in *.css; do echo "$f: $(grep -rl "$f" templates/ es/ en/ *.html 2>/dev/null | wc -l) refs"; done`. Listar los que tienen 0 referencias. Mover a `_archive/css/` si 0 refs confirmados.
- [ ] **S7-14** `[M]` Eliminar rutas admin legacy no usadas — `lib/routes.php` tiene 120+ rutas. Ejecutar: `grep -v 'AGENTS\|done\|test' lib/routes.php | grep "router->add" | awk '{print $3}' | sort -u` para extraer todos los slugs. Luego verificar cuáles son llamados desde algún JS/HTML activo. Documentar huérfanos. Candidatos a eliminar en task separada.

#### 7.4 Telemedicina legacy y media clínica

- [ ] **S7-15** `[M]` Auditar `LegacyTelemedicineBridge.php` — tiene 34 líneas y delega a `TelemedicineIntakeService`. Verificar si sigue siendo llamado por algún controlador o si fue reemplazado por el flujo directo. `grep -rn 'LegacyTelemedicineBridge' controllers/ lib/` → listar callers. Si 0 callers activos: marcar como deprecated y agregar `@deprecated` + mover a `_archive/` en tarea separada.
- [ ] **S7-16** `[M]` Normalizar Storage clínico — en `lib/telemedicine/` hay `ClinicalMediaService.php` y también `CaseMediaFlowService.php` en raíz `lib/`. Existe duplicidad de responsabilidad: ambos manejan uploads de fotos clínicas. Mapear qué rutas usan cuál. Elegir el canónico (`CaseMediaFlowService` es el más reciente). Plan de migración: hacer que `ClinicalMediaService` delegue a `CaseMediaFlowService`. Sin romper uploads existentes.
- [ ] **S7-17** `[S]` Verificar que media privada nunca es pública — `CaseMediaFlowController` tiene un endpoint `publicMediaFile`. Confirmar que el archivo solo sirve fotos con `visibility: public`. Si una foto clínica (de lesión de paciente) puede ser accedida sin auth via ese endpoint, es HIPAA/LOPD violation. Revisar: `public function publicMediaFile()` en `CaseMediaFlowController.php` → qué filtro de visibilidad aplica.

#### 7.5 Paridad EN/ES y web pública

- [ ] **S7-18** `[M]` Paridad EN/ES — hay 39 páginas `index.html` en `es/` y 30 en `en/`. Identificar las 9 páginas ES sin equivalente EN. Crear lista en `docs/EN_ES_GAP.md`: página ES → existe EN? → prioridad de traducción. Alta prioridad para: servicios, booking, blog principal, pre-consulta.
- [ ] **S7-19** `[S]` `manifest.json` apunta a Aurora Derm — verificar que `manifest.json` dice `"name": "Aurora Derm"` y no "Flow OS" o "Pielarmonia". `cat manifest.json | grep '"name"'`. Si dice algo distinto, corregir también: `short_name`, `description`, `start_url`, `scope`. Verificar en Chrome DevTools → Application → Manifest que no hay errores.
- [ ] **S7-20** `[S]` `sitemap.xml` incluye `/es/agendar/` — S3-24 ya hizo el booking público. Verificar que `sitemap.xml` incluye la nueva URL. Si no, agregar. Verificar también que todas las URLs de `sitemap.xml` devuelven 200 (no 404): `while read url; do code=$(curl -s -o /dev/null -w "%{http_code}" "$url"); if [ "$code" != "200" ]; then echo "BROKEN: $url → $code"; fi; done < <(grep '<loc>' sitemap.xml | sed 's/<[^>]*>//g')`.

#### 7.6 Observabilidad y reporting

- [ ] **S7-21** `[M]` Status page de Flow OS — `S6-22` tiene la tarea de status page externa. Esta tarea es previa: crear el **endpoint interno** `/api.php?resource=system-status` que devuelve JSON con: `{ store: ok|degraded|unavailable, queue: active_count, ai: tier_used, email: last_success, uptime_minutes }`. Consumir desde la status page pública cuando exista.
- [x] **S7-22** `[S]` Mejorar `bin/verify.js` — actualmente verifica una fracción del backlog real (pocas tareas). Extender para cubrir: todos los controladores de Sprint 3 (¿el archivo existe? ¿la ruta está en routes.php?), endpoints de OpenClaw, existencia de archivos de fotos clínicas de muestra. Objetivo: que `node bin/verify.js` detecte en <10s si hay regresión estructural obvia.
- [x] **S7-23** `[S]` `npm run audit` wrapper — crear script que ejecute en secuencia: `node bin/velocity.js && node bin/verify.js && node bin/conflict.js --json && php -l lib/email.php && php -l controllers/OpenclawController.php`. Exit 0 solo si todos pasan. Agregar a `package.json` como `"gov:audit": "..."`. Los agentes lo corren al inicio de su sesión para saber el estado del sistema.

#### 7.7 Distribución desktop y downloads

- [x] **S7-24** `[M]` Auditar canal `app-downloads/` y `desktop-updates/` — hay un `app-downloads/index.php` y una carpeta `desktop-updates/turnero-apps-pilot-local/`. Verificar: ¿qué versiones de la app desktop están siendo servidas? ¿El `index.php` tiene auth o es público? ¿Los checksums de los instaladores son correctos? Documentar en `docs/DESKTOP_DISTRIBUTION.md`: qué sirve cada endpoint, quién lo llama, si existe riesgo de servir un binario sin verificar.
- [x] **S7-25** `[S]` Validar `release/` — si existe directorio `release/`, verificar que no contiene binarios sin checksum o con secrets hardcodeados. `grep -rn 'API_KEY\|password\|secret\|sk_live' release/ 2>/dev/null`. Si encuentra algo, es P0 de seguridad. Documentar el proceso de generar un release limpio.
- [x] **S7-26** `[S]` Docs de ownership por zona — no existe un documento que diga "quien es responsable de qué archivo crítico". Crear `docs/OWNERSHIP.md` con tabla: zona del código → dueño humano (directora, doctor titular, etc.) → riesgo si ese dueño falta → handoff mínimo documentado. Cubrir al menos: `lib/auth.php`, `lib/clinical_history/`, `controllers/OpenclawController.php`, `k8s/`, `ops/caddy/`. Esto reduce el bus factor identificado en la auditoría.

---

#### 7.8 Resiliencia, Observabilidad Profunda y Legado

> Evidencia directa: `backup-receiver.php` ✅ `lib/public_sync.php` ✅ `grafana/dashboard.json` ✅ `docs/DISASTER_RECOVERY.md` ✅ `lib/figo_queue/JobProcessor.php` ✅ `lib/storage/StorePersistence.php` ✅

- [ ] **S7-27** `[M]` Restore drill real — `backup-receiver.php` existe pero sin smoke que lo ejercite. Simular pérdida de `data/store.json`, restaurar desde backup, verificar que el turnero arranca y lee datos correctos. Cronometrar. Entregable: `docs/RESTORE_RUNBOOK.md` con comandos exactos y tiempo de recuperación medido. Bloqueado por S7-08 (backup automatizado).
- [ ] **S7-28** `[M]` Inventario de cron y jobs — `lib/figo_queue/JobProcessor.php` procesa jobs de booking/follow-up/reminders sin health signal. Mapear todos: nombre, frecuencia, qué hace. Para cada job sin signal agregar `last_run_at` al health endpoint. Entregable: `docs/CRON_INVENTORY.md` con tabla jobs × health status.
- [ ] **S7-29** `[M]` Auditar `lib/public_sync.php` — mapear: ¿qué publica? ¿estado reportado vs real? ¿fallback en fallo de red? ¿el diff es determinístico? Agregar check de drift en `bin/verify.js`. Entregable: `docs/PUBLIC_SYNC_AUDIT.md`.
- [ ] **S7-30** `[M]` Alert pipeline automático — `bin/verify.js`, `bin/conflict.js` y `bin/report.js` generan JSON pero no alertan. Crear `bin/alert.js`: si hay severity HIGH, enviar mensaje Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` desde env) con: componente, severidad, timestamp, link al runbook. Exit 0 siempre. `npm run gov:alert` en package.json.
- [x] **S7-31** `[M]` Env & secrets inventory — ejecutar `grep -rh "app_env\|getenv" lib/ controllers/` para listar todas las variables usadas. Comparar con `env.example.php`. Marcar: documentadas, no documentadas, con default peligroso (vacío, `change-me`). Entregable: `docs/ENV_INVENTORY.md` + faltantes agregadas al example.
- [ ] **S7-32** `[S]` Grafana dashboard truth audit — `grafana/dashboard.json` existe. Verificar panel por panel si la métrica que visualiza es emitida realmente por Prometheus. Arrancar monitoring local y anotar qué paneles dicen "No data". Entregable: `docs/GRAFANA_AUDIT.md` con tabla panel → métrica → status (live|decorativo|roto).
- [ ] **S7-33** `[M]` Health contract unificado — extender `HealthController.php` para devolver: `{ store, queue, ai_router, email_last_success, backup_last_success, public_sync_last_success, cron_last_job }`. Cada campo: `status: ok|degraded|unavailable`, `last_checked_at`, `detail`. Fuente única para S7-30 (alerts), S7-21 (status page) y S7-34 (smoke).
- [ ] **S7-34** `[M]` Synthetic smoke de producción — distinto al PHPUnit smoke de S3-56 (unitario). Este simula desde HTTP: `curl /api.php?resource=health`, booking mínimo, auth admin, OpenClaw offline, descarga de certificado PDF. Script `bin/smoke-prod.js` + `npm run smoke:prod`. Documentar en `docs/SMOKE_RUNBOOK.md`.
- [ ] **S7-35** `[L]` Split `lib/email.php` — extiende S3-55 (fix parse error) con partición real. Separar en: `lib/email/EmailRenderer.php` (plantillas+HTML), `lib/email/EmailTransport.php` (SMTP, log, retry), `lib/email/EmailNotifications.php` (helpers de dominio: cita, receta, follow-up). Facade en `lib/email.php` por compatibilidad. Objetivo: parse error en una parte no rompe el gate ni la suite.
- [ ] **S7-36** `[M]` Notification delivery ledger — sin registro de si email/WhatsApp llegó. Crear `data/notifications/log.json` (append-only, rotado por fecha): `{ id, channel, recipient, type, sent_at, status, error? }`. Escribir desde `EmailTransport` y `WhatsappService`. Endpoint admin-only `GET /api.php?resource=notification-log` (últimos 50). Habilita soporte real: responder "¿Le llegó la confirmación?" en 10 segundos.
- [ ] **S7-37** `[M]` `StorePersistence` integrity — verificar qué ocurre si `store.json` se corrompe parcialmente. ¿`read_store()` falla silencioso? Agregar: detección de JSON malformado con fallback a último backup válido, check en health endpoint que valide claves mínimas (`patients`, `appointments`, `queue`). Entregable: `docs/STORE_INTEGRITY.md`.

---

---

### 🎨 Sprint UI — Rediseño Total (ANTIGRAVITY EXCLUSIVO)

> **Arquitecto:** Antigravity (Gemini) · **Otros agentes: NO TOCAR**
> **Filosofía:** "Clinical Luxury" — elegancia médica, no genericidad.
> **Guía de diseño:** `DESIGN_SYSTEM.md` — leer antes de escribir una sola línea de CSS.
> **Comando:** `npm run dispatch:ui` → `node bin/claim.js claim UI-XX "Antigravity"`.
> **Regla dura:** Cada tarea es una superficie completa. No se entregan medias tintas.

#### UI-0 Fundamentos del sistema

- [x] **UI-01** `[S]` `[UI]` Design tokens globales — crear `styles/tokens.css` con todos los tokens del `DESIGN_SYSTEM.md`: colores HSL aurora, gold, neutros cálidos, tipografía (Instrument Serif + Inter), espaciado 8px, radios, sombras cálidas, glow effects, transiciones. Este archivo se importa primero en toda página. Sin este archivo, nada más del Sprint UI arranca.
- [x] **UI-02** `[S]` `[UI]` Reset + base CSS — crear `styles/base.css`: reset moderno (box-sizing border-box, margin 0, font-size rem, smooth scroll), variables de tema público (`data-theme="public"`) y admin (`data-theme="admin"`), classes de utilidad mínimas (`.sr-only`, `.container`, `.section`). No usar frameworks externos — CSS puro con variables del sistema.
- [x] **UI-03** `[M]` `[UI]` Sistema de componentes base — crear `styles/components.css`: `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.card`, `.badge`, `.input`, `.select`, `.modal`, `.toast`, `.avatar`, `.divider`. Cada componente usa exclusivamente tokens de `tokens.css`. Con animaciones hover y focus accesibles. Entregable: Storybook-like demo en `dev/components.html`.

#### UI-1 Web pública — "La clínica que quieres visitar"

- [x] **UI-04** `[L]` `[UI]` Landing page hero + navegación — rediseño total de `index.html` sección hero: headline con `Instrument Serif`, subheadline sobre la doctora, imagen clínica premium, 2 CTAs (agendar + WhatsApp), barra de trust badges (MSP, SRI, Excelencia). Navbar fija con blur glassmorphism. Nada del diseño anterior sobrevive. Mobile-first obligatorio.
- [x] **UI-05** `[M]` `[UI]` Landing sections interiores — Las secciones de `index.html` debajo del hero: servicios (grid de cards con hover premium), resultados before/after (slider táctil), testimoni 3-column (fotos reales o svg), especialidades con icons médicos, y CTA final con gradiente aurora. Coherente con UI-04.
- [x] **UI-06** `[M]` `[UI]` Template de páginas de servicio — crear `styles/aurora-service.css` + actualizar la estructura HTML base de `es/servicios/laser-co2/index.html` como referencia. Header de servicio con imagen hero + badge de resultado esperado, secciones: qué es, para quién, proceso paso a paso, antes/después, preguntas frecuentes (accordion), CTA flotante en mobile. El mismo template aplica a todos los servicios.
- [x] **UI-07** `[M]` `[UI]` Página de booking público — rediseño total de `es/agendar/index.html`: stepper visual de 3 pasos (servicio → fecha/hora → confirmación), calendar de disponibilidad con slots visuales, formulario mínimo (nombre, teléfono, motivo), confirmación en pantalla + WhatsApp. Premium pero sin fricción. Los datos ya vienen del backend existente — solo el UI cambia.
- [x] **UI-08** `[S]` `[UI]` Página de pre-consulta — rediseño de `es/pre-consulta/index.html`: formulario vertical con progreso visual, upload de fotos con preview, instrucciones claras. Diseño calmante (colores suaves, tipografía generosa). Entregable: el paciente siente que está en buenas manos desde el formulario.

#### UI-2 Admin — "La herramienta que el médico ama"

- [x] **UI-09** `[L]` `[UI]` Admin shell y navegación — rediseño de `admin.html`: sidebar colapsable con dark theme (`data-theme="admin"`), navegación por íconos + labels, sección activa con acento aurora, header con estado del sistema (claims activos, alertas), búsqueda global. Glassmorphism en sidebar. Sin cambiar ningún endpoint PHP — solo el shell HTML/CSS/JS de navegación.
- [x] **UI-10** `[L]` `[UI]` Dashboard principal admin — la vista que ve el médico al abrir el admin: 4 KPI cards (citas hoy, pacientes activos, turnos en espera, alertas clínicas), agenda del día (timeline visual), accesos rápidos (nueva cita, OpenClaw, HCE último paciente). Dark theme, micro-animaciones, datos en tiempo real via endpoints existentes.
- [x] **UI-11** `[M]` `[UI]` Historia clínica — render premium — el render de `clinical-history/render/index.js` (13.837 líneas de JS) genera UI actualmente. Crear un CSS dedicado `styles/aurora-clinical.css` que reemplace el estilo inline/legacy: timeline de episodios, cards de evolución, sección de fotos clínicas con lightbox, recetas en acordeón, diagnósticos CIE-10 con chips visuales. El JS no cambia — solo CSS class hooks.

#### UI-3 OpenClaw — "El copiloto clínico"

- [x] **UI-12** `[M]` `[UI]` OpenClaw chat interface — rediseño total del chat en `js/openclaw-chat.js`: burbujas de mensaje con distinción visual IA/médico, código de diagnóstico CIE-10 como chip clickeable, receta generada con preview de tarjeta, estado de IA (tier activo, modo offline badge), input médico con autocompletado de medicamentos. Dark clinical theme. Typing indicator animado. El JS backend no cambia.

#### UI-4 Turnero — "La sala de espera del siglo XXI"

- [x] **UI-13** `[L]` `[UI]` Kiosco de turnos — rediseño de `kiosco-turnos.html`: pantalla táctil 1080×1920 (o 16:9), grande y legible desde 1 metro, touch targets mínimo 120px, selección de servicio con iconos grandes, confirmación con QR animado. Dark theme clínico. Sin scroll — todo en una pantalla.
- [x] **UI-14** `[M]` `[UI]` Sala de espera TV — rediseño de `sala-turnos.html`: display en pantalla TV 16:9, turnos llamados con animación de entrada, número actual GRANDE, próximos 3 turnos en gris, hora en esquina, branding discreta de Aurora Derm. Transiciones suaves. Nunca debe haber un estado "en blanco".
- [x] **UI-15** `[M]` `[UI]` Operador de turnos — rediseño de `operador-turnos.html`: interfaz compacta para escritorio, lista de turnos en espera con drag-to-call, botón LLAMAR prominente, historial de turnos del día, alertas de espera larga. Dark theme denso pero legible.

#### UI-5 Portal del paciente — "Mi salud en mi celular"

- [x] **UI-16** `[L]` `[UI]` Portal base mobile-first — crear `es/portal/index.html` + `styles/aurora-portal.css`: bottom navigation (5 iconos: inicio, citas, historial, recetas, perfil), header con foto/nombre del paciente, card de próxima cita, estado de plan activo, CTA WhatsApp siempre visible. PWA-ready. iOS y Android se ven nativos.
- [x] **UI-17** `[M]` `[UI]` Vista de historial del paciente — `es/portal/historial/index.html`: lista de consultas con fechas, doctor y motivo. Tap para expandir detalle con diagnóstico, receta, y plan. Timeline vertical. Solo lectura. Datos del endpoint existente `clinical-history`.

#### UI-6 PDF y documentos — "Los documentos que la doctora firma con orgullo"

- [x] **UI-18** `[M]` `[UI]` Template HTML de receta — crear `templates/pdf/prescription.html`: membrete con logo de clínica (de `ClinicProfileStore`), nombre y MSP del médico (de `DoctorProfileStore`), tabla de medicamentos con tipografía clara y legible, instrucciones en lenguaje simple, QR de verificación en esquina. Diseño que el paciente puede imprimir o guardar sin vergüenza.
- [x] **UI-19** `[M]` `[UI]` Template HTML de certificado médico — crear `templates/pdf/certificate.html`: membrete oficial, firma digital del médico como imagen, datos del paciente, diagnóstico en bloque visual, firmas y sellos. Estilo documento legal pero legible. El médico puede firmarlo digitalmente sin imprimir.
