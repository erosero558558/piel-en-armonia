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
- [ ] Paciente puede hacer intake digital desde `es/pre-consulta/`
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
- [ ] **S3-05** `[L]` Intake digital público — crear `es/pre-consulta/index.html` con formulario: nombre, WhatsApp, tipo de piel, condición, fotos. Al enviar: crea caso en Flow OS stage `lead_captured`, notifica al frontdesk. **Esta es la puerta de entrada del patient journey.**
- [ ] **S3-06** `[M]` Historial de journey — log de transiciones con timestamps para cada paciente. Vista timeline en admin. Feed de actividad: "Juan → scheduled (hace 2h por operador María)".

#### 3.2 Turnero avanzado

- [ ] **S3-07** `[L]` Check-in QR — paciente llega al kiosco, escanea QR de su cita (generado al agendar), kiosco lo reconoce, status → `arrived`, asocia al caso. Sin cita → flujo walk-in normal.
- [ ] **S3-08** `[M]` Selección de motivo en kiosco — en `kiosco-turnos.html`, antes de generar turno: "Consulta general", "Control", "Procedimiento", "Urgencia". Alimenta `TicketPriorityPolicy`.
- [ ] **S3-09** `[M]` Vista expandida del operador — en `operador-turnos.html`, al llamar turno mostrar: nombre, motivo, visitas previas, stage del journey, alertas. Datos de `PatientCaseService::hydrateStore`.
- [ ] **S3-10** `[M]` Acciones post-consulta — botones en operador: "Agendar siguiente", "Enviar guía", "Generar receta", "Derivar a procedimiento". Cada uno dispara el action correspondiente.
- [ ] **S3-11** `[M]` Ticket con QR — `TicketPrinter` genera ticket con QR que lleva a `es/software/turnero-clinicas/estado-turno/?ticket=XXX`. Paciente ve su posición desde el teléfono.
- [ ] **S3-12** `[L]` Estimación de espera — calcular tiempo estimado basado en: posición en cola, duración promedio por tipo, consultorios activos. Mostrar en kiosco y sala. Actualizar en tiempo real.
- [ ] **S3-13** `[M]` Sala inteligente — en `sala-turnos.html`, entre llamadas mostrar: tips de cuidado de piel, info del próximo tratamiento (si el turno es de tipo conocido), video educativo rotativo.
- [ ] **S3-14** `[S]` Métricas de espera — registrar tiempo real de espera por turno. Registrar throughput/hora. Alimentar `QueueAssistantMetricsStore`. Vista de gráficos en admin.

#### 3.3 Historia Clínica Electrónica

- [ ] **S3-15** `[L]` Formulario de anamnesis — vista en admin: motivo, antecedentes personales/familiares, alergias, medicación, fototipo Fitzpatrick, hábitos (sol, tabaco). `ClinicalHistoryService`.
- [ ] **S3-16** `[L]` Fotografía clínica — captura desde cámara, upload a `CaseMediaFlowService`. Metadata: fecha, zona corporal. Almacenar organizado por paciente/fecha.
- [ ] **S3-17** `[L]` Comparación before/after — en admin: dos fotos side-by-side de misma zona en diferentes fechas. Slider de comparación. Seleccionar fotos del historial del paciente.
- [ ] **S3-18** `[M]` Plan de tratamiento — template: diagnóstico, tratamientos (con sesiones y costos estimados), frecuencia de seguimiento, metas. Exportar PDF para el paciente.
- [ ] **S3-19** `[M]` Receta digital — datos doctor (MSP), datos paciente, medicamentos (nombre, dosis, frecuencia, duración), indicaciones. PDF con membrete clínico.
- [ ] **S3-20** `[M]` Evolución clínica — nota por visita: hallazgos, procedimientos, evolución, plan. Append-only. Integrada al timeline del journey.
- [x] **S3-21** `[S]` Red flags — `ClinicalHistoryGuardrails`: alertar en admin si lesión >6mm, cambio de color en lunares, crecimiento rápido. Badge visual rojo en el caso.
- [x] **S3-22** `[M]` Exportar HCE completa — botón en admin: genera PDF con todo el historial del paciente. Legal compliance via `ClinicalHistoryLegalReadiness`.
- [ ] **S3-23** `[M]` `[HUMAN]` Compliance MSP Ecuador — verificar campos obligatorios del formulario 0457: identificación, anamnesis, examen físico, diagnóstico CIE-10, prescripción, evolución. **PREGUNTAR:** ¿cuáles son los campos exactos del formulario 0457 que el MSP exige?

#### 3.4 Agendamiento

- [ ] **S3-24** `[XL]` Booking público — crear `es/agendar/index.html`: selección de servicio → doctor → fecha → hora → datos del paciente → confirmar. Consultar `CalendarAvailabilityService`. Crear appointment en backend.
- [ ] **S3-25** `[M]` Confirmación doble — al agendar: enviar WhatsApp + email con fecha, hora, doctor, dirección, instrucciones de preparación según el tipo de cita.
- [ ] **S3-26** `[M]` Reagendamiento self-service — vista pública donde paciente puede mover su cita. Máx 2 cambios, mínimo 24h antes. `src/apps/reschedule/engine.js`.
- [ ] **S3-27** `[M]` Lista de espera — si no hay slots, ofrecer "unirse a lista de espera". Notificar por WhatsApp cuando se libere un espacio.
- [ ] **S3-28** `[M]` Vista de agenda diaria — en admin: agenda del día con pacientes confirmados, hora, tipo, status. Alertas de overbooking. Botón "marcar llegó" → avanza el journey.

#### 3.5 Telemedicina

- [ ] **S3-29** `[XL]` Flujo completo de teleconsulta — paciente solicita → `TelemedicineIntakeService` evalúa → `TelemedicineSuitabilityEvaluator` decide si es viable → consent digital → cita virtual → seguimiento.
- [ ] **S3-30** `[L]` Vista de teleconsulta — `es/telemedicina/consulta/index.html`: sala de espera virtual, video embed (Jitsi/Daily.co), chat, compartir fotos. Diseño premium.
- [ ] **S3-31** `[M]` Triaje por fotos — paciente sube 3 fotos (zona, primer plano, contexto). `TelemedicineIntakeService` las pre-clasifica y adjunta al caso.

#### 3.6 Pagos

- [ ] **S3-32** `[L]` Checkout integrado — `es/pago/index.html`: monto, concepto, métodos (Stripe, transferencia, efectivo). Generar recibo digital.
- [ ] **S3-33** `[M]` Verificación de transferencia — paciente sube foto del comprobante. Admin verifica y aprueba. Status: pendiente → verificado → aplicado.
- [ ] **S3-34** `[M]` Estado de cuenta — vista en admin: historial de pagos por paciente, saldos pendientes, próximos vencimientos.
- [ ] **S3-35** `[L]` `[HUMAN]` Factura SRI — integrar con facturación electrónica del SRI Ecuador. **PREGUNTAR:** ¿tienen certificado de firma electrónica y ambiente de producción del SRI?

---

### 🔵 Sprint 4 — Escalar el negocio

> **Meta:** Aurora Derm como plataforma SaaS, inteligencia artificial, crecimiento comercial.

#### 4.1 Inteligencia Artificial

- [ ] **S4-01** `[L]` Triage IA — `ClinicalHistoryAIService`: analizar fotos + descripción del paciente → sugerir urgencia (1-5), diagnóstico diferencial probable, derivación automática a tipo de consulta.
- [ ] **S4-02** `[L]` Chatbot WhatsApp — `WhatsappOpenclawController`: responder preguntas frecuentes por WhatsApp con IA: horarios, precios, preparación, dirección. Escalar a humano si la pregunta es clínica.
- [ ] **S4-03** `[M]` Predicción de no-show — modelo basado en: historial de asistencia, hora, día, tiempo desde booking. Dashboard en admin con probabilidad de no-show por cita.
- [ ] **S4-04** `[M]` Resúmenes automáticos — `LeadOpsService`: generar resumen post-consulta para el paciente: "Hoy diagnosticamos X, recetamos Y, próxima cita en Z semanas." Enviar por WhatsApp.
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
- [ ] **S4-23** `[M]` Package.json audit — de 171 scripts, identificar los que apuntan a archivos archivados o inexistentes. Listar para limpieza.
- [ ] **S4-24** `[M]` CSS dead code — 8+ archivos CSS en raíz. Verificar cuáles se importan desde HTML. Listar huérfanos.
- [ ] **S4-25** `[M]` Images audit — 262 webp en `images/optimized/`. Verificar cuáles se referencian desde HTML/CSS. Listar huérfanas (no eliminar, solo listar).
- [ ] **S4-26** `[L]` CI pipeline audit — `.github/workflows/*.yml` — verificar que todos los jobs referencian archivos que existen. Eliminar jobs que apuntan a archivos archivados.
