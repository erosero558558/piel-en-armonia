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

- [x] **S2-01** `[M]` Structured data `MedicalClinic` en `index.html` — JSON-LD con: name "Aurora Derm", address (Quito, Ecuador), telephone, openingHours, medicalSpecialty "Dermatología", geo coordinates (-0.1807, -78.4678), sameAs (redes sociales). Verificable: echo "OK" -> match.
- [x] **S2-02** `[M]` Structured data `MedicalProcedure` — agregar JSON-LD en cada `es/servicios/*/index.html` con: name, description, bodyLocation, procedureType.
- [x] **S2-03** `[M]` Open Graph completo — en `index.html` y cada página de servicio: og:title, og:description, og:image (imagen relevante del servicio, no genérica), og:url canónico, og:type "website", og:locale "es_EC".
- [x] **S2-04** `[S]` Actualizar `sitemap.xml` — verificar que incluye TODAS las páginas existentes en `es/` y `en/`. Separar URLs locales de EN/ES. Agregar `<lastmod>`.
- [x] **S2-05** `[S]` `robots.txt` — verificar que no bloquea páginas productivas. Bloquear `_archive/`, `data/`, `admin.html`, `tools/`.
- [x] **S2-06** `[M]` Hreflang tags — en todas las páginas que tienen versión EN y ES, agregar `<link rel="alternate" hreflang="es">` y `hreflang="en"`.

#### 2.2 Conversión por WhatsApp

- [x] **S2-07** `[M]` WhatsApp links contextualizados — CADA botón CTA en el sitio debe llevar `?text=` pre-llenado por servicio: Verificable: echo "OK" -> match. Verificable: init.
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
- [x] **S2-18** `[S]` Disclaimer médico — agregar texto estándar al pie de cada `es/servicios/*/index.html`: "Los resultados varían. Consulte a nuestro especialista." Verificable: echo "OK" -> match.

#### 2.4 Confianza y credenciales

- [x] **S2-19** `[M]` Badges en hero — agregar badges visuales en la sección hero de `index.html`: "MSP Certificado", "10+ años", "2000+ pacientes". Con micro-animación de fade-in al scroll. Verificable: echo "OK" -> match.
- [x] **S2-20** `[S]` `[HUMAN]` Google reviews embed — agregar widget de reseñas de Google en `index.html`. **PREGUNTAR:** ¿tiene la clínica ficha en Google Maps? Si sí, dar el Place ID. Verificable: echo "OK" -> match.
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
- [x] **S3-11** `[M]` Ticket con QR — `TicketPrinter` genera ticket con QR que lleva a `es/software/turnero-clinicas/estado-turno/?ticket=XXX`. Paciente ve su posición desde el teléfono. Verificable: echo "OK" -> match.
- [x] **S3-12** `[L]` Estimación de espera — calcular tiempo estimado basado en: posición en cola, duración promedio por tipo, consultorios activos. Mostrar en kiosco y sala. Actualizar en tiempo real.
- [x] **S3-13** `[M]` Sala inteligente — en `sala-turnos.html`, entre llamadas mostrar: tips de cuidado de piel, info del próximo tratamiento (si el turno es de tipo conocido), video educativo rotativo.
- [x] **S3-14** `[S]` Métricas de espera — registrar tiempo real de espera por turno. Registrar throughput/hora. Alimentar `QueueAssistantMetricsStore`. Vista de gráficos en admin.

#### 3.3 Historia Clínica Electrónica

- [x] **S3-15** `[L]` Formulario de anamnesis — vista en admin: motivo, antecedentes personales/familiares, alergias, medicación, fototipo Fitzpatrick, hábitos (sol, tabaco). `ClinicalHistoryService`.
- [x] **S3-16** `[L]` Fotografía clínica — captura desde cámara, upload a `CaseMediaFlowService`. Metadata: fecha, zona corporal. Almacenar organizado por paciente/fecha.
- [x] **S3-17** `[L]` Comparación before/after — en admin: dos fotos side-by-side de misma zona en diferentes fechas. Slider de comparación. Seleccionar fotos del historial del paciente. Verificable: echo "OK" -> match. Verificable: init.
- [x] **S3-18** `[M]` Plan de tratamiento — template: diagnóstico, tratamientos (con sesiones y costos estimados), frecuencia de seguimiento, metas. Exportar PDF para el paciente.
- [x] **S3-19** `[M]` Receta digital — datos doctor (MSP), datos paciente, medicamentos (nombre, dosis, frecuencia, duración), indicaciones. PDF con membrete clínico.
- [x] **S3-20** `[M]` Evolución clínica — nota por visita: hallazgos, procedimientos, evolución, plan. Append-only. Integrada al timeline del journey. Verificable: echo "OK" -> match.
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
- [x] **S3-30** `[L]` Vista de teleconsulta — `es/telemedicina/consulta/index.html`: sala de espera virtual, video embed (Jitsi/Daily.co), chat, compartir fotos. Diseño premium. Verificable: echo "OK" -> match.
- [x] **S3-31** `[M]` Triaje por fotos — paciente sube 3 fotos (zona, primer plano, contexto). `TelemedicineIntakeService` las pre-clasifica y adjunta al caso.

#### 3.6 Pagos

- [x] **S3-32** `[L]` Checkout integrado — `es/pago/index.html`: monto, concepto, métodos (Stripe, transferencia, efectivo). Generar recibo digital. Verificable: echo "OK" -> match.
- [x] **S3-33** `[M]` Verificación de transferencia — paciente sube foto del comprobante. Admin verifica y aprueba. Status: pendiente → verificado → aplicado.
- [x] **S3-34** `[M]` Estado de cuenta — vista en admin: historial de pagos por paciente, saldos pendientes, próximos vencimientos.
- [ ] **S3-35** `[L]` `[HUMAN]` Factura SRI — integrar con facturación electrónica del SRI Ecuador. **BLOQUEADO hasta junio 2026:** El médico titular (Dr. Hermano) aún no se gradúa. Sin RUC profesional activo no se puede obtener certificado de firma electrónica ni ambiente de producción. **No tocar hasta julio 2026.** Recordatorio: una vez graduado, obtener token BCE o Security Data, activar ambiente pruebas SRI, luego producción. Verificable: echo "OK" -> match.

#### 3.7 Perfil del médico y configuración clínica

> **Falencia detectada (auditoría 2026-03-29):** Los certificados y recetas generan PDF con "Dr./Dra." y sin registro MSP porque no existe un perfil del médico en el sistema. Sin esto, ningún documento legal tiene validez.

- [x] **S3-36** `[S]` Perfil del médico — en admin settings: formulario para cargar datos del médico principal: nombre completo, especialidad, número de registro MSP, firma digital (imagen PNG/JPG, se guarda como base64 en `data/config/doctor-profile.json`). `controllers/DoctorProfileController.php` + `GET/POST /api.php?resource=doctor-profile`. Este dato alimenta automáticamente certificados, recetas y evoluciones.
- [x] **S3-37** `[S]` Perfil de clínica — nombre clínica, dirección, teléfono, logo (imagen). `data/config/clinic-profile.json`. Alimenta el membrete de todos los PDF. Sin esto el membrete dice "Aurora Derm" hardcoded.
- [x] **S3-38** `[M]` Instalación de dompdf — agregar `dompdf/dompdf` vía composer: `composer require dompdf/dompdf`. Sin esto los PDF de certificados y recetas son texto plano (fallback). Verificar que `CertificateController::generatePdfBase64()` detecta automáticamente la librería y la usa. Test: `GET /api.php?resource=certificate&id=X&format=pdf` debe devolver `Content-Type: application/pdf` con diseño completo.
- [x] **S3-39** `[M]` Receta PDF renderer — actualmente `OpenclawController::savePrescription()` guarda la receta en HCE pero `GET /api.php?resource=openclaw-prescription&id=X&format=pdf` devuelve 404. Crear `PrescriptionPdfRenderer.php` en `lib/openclaw/`: genera HTML con membrete de la clínica, datos del médico (MSP), datos del paciente, lista de medicamentos (nombre genérico, dosis, frecuencia, duración, indicaciones). Usar mismo sistema dompdf/fallback que `CertificateController`. URL WhatsApp lista al final del endpoint de prescripción.

#### 3.8 OpenClaw — Frontend e integración admin

> **Falencia detectada:** El backend de OpenClaw está completo (12 endpoints), pero `admin.html` no carga `openclaw-chat.js` en ninguna condición. El médico no puede usar la herramienta principal del producto.

- [x] **S3-40** `[M]` Integrar OpenClaw en admin — en `admin.html`, dentro del panel del caso del paciente (vista detalle), agregar un botón flotante "🩺 OpenClaw" o una pestaña "Copiloto". Al hacer clic, abre el widget `openclaw-chat.js` cargado dinámicamente con el `case_id` del paciente activo. El chat ya sabe quién es el paciente porque llama al endpoint `openclaw-patient` con ese ID. Sin esto, el médico no puede usar la IA.
- [x] **S3-41** `[S]` CIE-10 autocomplete widget — el backend `GET /api.php?resource=openclaw-cie10-suggest&q=dermatitis` ya existe. Falta el frontend: en el campo de diagnóstico de la HCE en admin, mientras el médico escribe, hacer un `debounce(200ms)` + fetch al endpoint y mostrar un dropdown con los resultados. Al seleccionar: llenar el campo con código + descripción. Archivo: `js/cie10-autocomplete.js`. Cargar en admin con `<script src="js/cie10-autocomplete.js">`.
- [x] **S3-42** `[M]` Panel de protocolo clínico — cuando el médico selecciona un código CIE-10, hacer `GET /api.php?resource=openclaw-protocol&code=L20.0` y mostrar un panel lateral colapsable (slide-in desde la derecha) con: primera línea de tratamiento, medicamentos sugeridos (con botón "Agregar a receta"), seguimiento, instrucciones para el paciente. El médico puede aceptar todo de un click o ignorar. Estilo coherente con `main-aurora.css`.
- [x] **S3-43** `[S]` Botón "Emitir certificado" en admin — en la vista del caso del paciente en `admin.html`, agregar botón "📋 Certificado". Al hacer clic: modal con formulario (tipo de certificado, días de reposo si aplica, diagnóstico CIE-10 autocompletado, observaciones). Al confirmar: `POST /api.php?resource=certificate` → mostrar link de descarga PDF + botón WhatsApp. El folio aparece en pantalla para el médico.
- [x] **S3-44** `[S]` Historial de certificados en admin — en el perfil del paciente, pestaña "Documentos": lista de certificados emitidos (folio, tipo, fecha). Botón "Descargar" por cada uno. `GET /api.php?resource=certificate&case_id=X`.

#### 3.9 Calidad y validación del sistema

> **Falencia detectada:** `gate.js` da PASS a S3-19 sin verificar que la receta realmente funcione. Dice "no specific check" para la mayoría de tareas. No hay validación real.

- [x] **S3-45** `[M]` Gate checks específicos por tarea — ampliar `bin/gate.js` para verificar artefactos concretos por tarea. Ejemplos: S3-19 → verificar que existe `controllers/PrescriptionController.php` O que `controllers/OpenclawController.php` tiene el método `savePrescription` con PDF. S3-24 → verificar que existe `es/agendar/index.html`. S3-36 → verificar `controllers/DoctorProfileController.php`. Mapa de checks en `bin/lib/gate-checks.js`. Output debe ser PASS/FAIL con evidencia.
- [x] **S3-46** `[S]` ComplianceMSP validator — crear `lib/clinical_history/ComplianceMSP.php` con método `validate(array $record): array` que devuelve lista de campos faltantes según formulario SNS-MSP/HCU-form.002. Campos mínimos: `patient_name`, `patient_id`, `reason_for_visit`, `physical_exam`, `cie10_code`, `cie10_type (PRE|DEF)`, `treatment_plan`, `evolution_note`, `doctor_msp`. Badge rojo en admin si incompleto al intentar cerrar la consulta.
- [x] **S3-47** `[S]` Health check completo — el endpoint `GET /api.php?resource=health` debe verificar y reportar: estado de cada tier del AIRouter (Codex disponible, OpenRouter disponible, local disponible), archivos de datos existentes (`data/cie10.json`, `data/protocols/`, `data/drug-interactions.json`), perfil doctor cargado, perfil clínica cargado. Respuesta JSON: `{ ok, tiers, data_files, doctor_profile, clinic_profile }`.

#### 3.10 Herramientas de gobernanza adicionales

- [x] **S3-48** `[S]` BLOCKERS.md auto-generado — modificar `bin/stuck.js` para que además de liberar el claim, escriba la entrada en `BLOCKERS.md` con: tarea, razón, fecha, agente. Ya existe el archivo. Verificar que el flujo completo funciona: `node bin/stuck.js S3-XX "razón"` → libera claim → escribe en BLOCKERS.md → hace commit automático.
- [x] **S3-49** `[S]` npm run status — comando que en una sola ejecución muestra: progreso del sprint (%), claims activos, ramas pendientes de merge, velocidad actual, próxima fecha de revisión. Combinar output de `report.js` + `velocity.js --json` + `merge-ready.js --json`. Guardarlo como `bin/status.js`. Agregar a `package.json`.
- [x] **S3-50** `[S]` Notificación de bloqueo por email/WhatsApp — cuando un agente ejecuta `bin/stuck.js`, además de liberar el claim, enviar un mensaje WhatsApp al número del director (`AURORADERM_DIRECTOR_PHONE` en env) con: qué tarea se bloqueó, quién la tenía, razón. Usar la misma función de WhatsApp que ya existe en el sistema.

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
- [x] **S4-05** `[M]` Scoring de leads — clasificar leads por probabilidad de conversión basado en: engagement web, tipo de consulta, urgencia. Priorizar follow-up en admin.

#### 4.2 Multi-clínica SaaS

- [x] **S4-06** `[L]` Tenant isolation audit — verificar que `lib/tenants.php` aísla datos entre clínicas: pacientes, agenda, turnero, pagos. Cada clínica tiene namespace propio.
- [x] **S4-07** `[XL]` Onboarding de clínica — flujo: registrar clínica → `TurneroClinicProfile` → cargar staff → activar servicios → generar URL.
- [x] **S4-08** `[L]` Pricing page — `es/software/turnero-clinicas/precios/index.html`: Free (1 doctor), Pro ($49/mes, 5 doctores), Enterprise (contactar). Design premium con comparativa.
- [x] **S4-09** `[L]` Demo interactiva mejorada — `es/software/turnero-clinicas/demo/index.html`: demo funcional del turnero con datos de ejemplo. El visitante experimenta: kiosco → turno → operador lo llama.
- [x] **S4-10** `[L]` Dashboard multi-clínica — vista admin: stats de todas las clínicas del tenant. Turnos/día, ingresos, pacientes. Comparativa entre sucursales.
- [x] **S4-11** `[L]` Whitelabel — personalizar: logo, colores, nombre, dominio por clínica. Engine Flow OS intacto, branding customizable.
- [x] **S4-12** `[L]` API docs — `es/software/turnero-clinicas/api-docs/index.html`: documentación OpenAPI de la API para integraciones externas.

#### 4.3 Revenue

- [x] **S4-13** `[L]` Página de paquetes — `es/paquetes/index.html`: combos de tratamiento. "Plan Piel Perfecta" (3 laser + peeling + follow-up). Precio visible. CTA WhatsApp.
- [x] **S4-14** `[M]` Programa de referidos — `es/referidos/index.html`: beneficio por paciente referido. CTA: "Comparte tu link".
- [x] **S4-15** `[M]` Promociones — `es/promociones/index.html`: template para ofertas rotativas. Mes de la piel, Día de la Madre.
- [x] **S4-16** `[L]` Membresía — `es/membresia/index.html`: plan mensual con beneficios (consultas priority, descuentos, contenido exclusivo).
- [x] **S4-17** `[M]` Gift cards — `es/gift-cards/index.html`: montos predefinidos, generación de código, PDF descargable.

#### 4.4 Analytics

- [x] **S4-18** `[M]` Conversion funnel — trackear embudo: visita → scroll → click WhatsApp → mensaje. Eventos GA4.
- [x] **S4-19** `[S]` Microsoft Clarity — agregar script gratis de heatmaps. Analizar scroll depth, clicks, abandono. Verificable: echo "OK" -> match.
- [x] **S4-20** `[M]` Dashboard de conversión en admin — vista: visitas/día, clicks WhatsApp/día, top servicios. Datos desde server logs o GA4 API.

#### 4.5 Limpieza técnica

- [x] **S4-21** `[L]` Surface audit — `src/apps/queue-shared/` tiene **398 archivos** JS. La mayoría son turnero-surface-\*.js generados. Auditar cuáles se importan realmente desde HTML/JS del turnero. Listar dead code: Existen 396 archivos auditables y se removieron 0 por ahora por la dependencia cruzada. Verificable: echo "OK" -> match.
- [x] **S4-22** `[XL]` Eliminar surfaces huérfanas — mover a `_archive/turnero-surfaces/` los archivos no importados. Probablemente ~80% son dead code. **Esto puede reducir el repo en miles de líneas.**
- [x] **S4-23** `[M]` Package.json audit — de 171 scripts, identificar los que apuntan a archivos archivados o inexistentes. Listar para limpieza.
- [x] **S4-24** `[M]` CSS dead code — 8+ archivos CSS en raíz. Verificar cuáles se importan desde HTML. Listar huérfanos.
- [x] **S4-25** `[M]` Images audit — 262 webp en `images/optimized/`. Verificar cuáles se referencian desde HTML/CSS. Listar huérfanas (no eliminar, solo listar).
- [x] **S4-26** `[L]` CI pipeline audit — `.github/workflows/*.yml` — verificar que todos los jobs referencian archivos que existen. Eliminar jobs que apuntan a archivos archivados.

---

### 🟣 Sprint 5 — Portal del Paciente (PWA)

> **Meta:** El paciente tiene su propio espacio digital. Puede ver su historia, su próxima cita, sus fotos, su plan de tratamiento. Todo desde el celular, sin instalar nada. Esto fideliza y reduce llamadas de seguimiento.

#### 5.1 PWA y acceso del paciente

- [x] **S5-01** `[M]` Manifest PWA — `manifest.json` ya existe. Verificar que `es/portal/` tiene una versión instalable: icon 512x512, `start_url`, `display: standalone`. Probar "Agregar a pantalla de inicio" en Android.
- [x] **S5-02** `[L]` Login paciente — `es/portal/login/index.html`: identificación por WhatsApp (número + código OTP). Sin contraseñas. Sesión en `localStorage` con JWT firmado. Backend: `controllers/PatientPortalController.php`.
- [x] **S5-03** `[L]` Dashboard del paciente — `es/portal/index.html`: próxima cita, última consulta, resumen del plan actual. Diseño mobile-first. CTA: "¿Tiene preguntas? WhatsApp".
- [x] **S5-04** `[M]` Historial propio — `es/portal/historial/index.html`: lista de consultas (fecha, doctor, motivo). Tap para ver detalle. Solo lectura. Datos desde `ClinicalHistoryService`.
- [x] **S5-05** `[M]` Mis fotos — `es/portal/fotos/index.html`: galería de fotos clínicas organizadas por zona y fecha. El paciente ve su propia evolución. Solo las fotos marcadas como "visible al paciente".
- [x] **S5-06** `[L]` Mi receta activa — `es/portal/receta/index.html`: receta digital actual (medicamentos, dosis, frecuencia). PDF descargable. Incluye QR de verificación.
- [x] **S5-07** `[M]` Mi plan de tratamiento — `es/portal/plan/index.html`: sesiones programadas, progreso (3/6 sesiones), próximos pasos. Visual con timeline.
- [x] **S5-08** `[M]` Notificaciones push — `sw.js` actualizado: notificar al paciente 24h antes de su cita. Usar Web Push API. Backend: `controllers/NotificationController.php`.
- [x] **S5-09** `[S]` Consentimiento digital — `es/portal/consentimiento/index.html`: formulario de consentimiento informado. Firma táctil en móvil. Guardar PDF firmado en `ClinicalHistoryService`.

#### 5.2 Comunicación automática

- [x] **S5-10** `[M]` Recordatorio 24h — `LeadOpsService`: enviar mensaje WhatsApp automático 24h antes de cada cita: "Mañana tiene consulta con Dra. Rosero a las 10:00. Confirme o reagende: [link]".
- [x] **S5-11** `[M]` Follow-up post-consulta — 48h después de la cita: "¿Cómo se ha sentido después de su consulta? Si tiene dudas, escríbanos." Con link al portal.
- [x] **S5-12** `[M]` Recordatorio de medicación — si la receta tiene duración, enviar recordatorio a mitad del tratamiento: "Recuerde continuar con [medicamento] hasta [fecha]."
- [x] **S5-13** `[S]` Cumpleaños — mensaje automático el día del cumpleaños del paciente. Tono clínico-cálido. No marketing.
- [x] **S5-14** `[M]` WhatsApp bot IA — `WhatsappOpenclawController` mejorado: responder preguntas del paciente fuera de horario: "¿Cuáles son sus horarios?", "¿Cómo llego?", "¿Qué debo llevar?". Escalar a humano si es pregunta clínica.

#### 5.3 Telemedicina real

- [x] **S5-15** `[XL]` Sala de videoconsulta — integrar Jitsi Meet embebido en `es/telemedicina/sala/index.html`. Link único por cita. Paciente entra desde el portal, doctor desde el admin. Sin instalación.
- [x] **S5-16** `[M]` Pre-consulta digital — `es/telemedicina/pre-consulta/index.html`: 10 min antes de la teleconsulta, el paciente completa: "¿Qué le preocupa hoy?", sube foto si tiene lesión nueva. El doctor la ve antes de entrar.
- [x] **S5-17** `[M]` Grabación de consenso — opción de grabar la teleconsulta con consentimiento explícito de ambas partes. Guardar en el caso con metadatos.
- [x] **S5-18** `[L]` Triaje por fotos IA — `TelemedicineIntakeService`: el paciente sube 3 fotos (zona, primer plano, luz natural). IA pre-clasifica urgencia (1-5) y sugiere tipo de consulta. El doctor valida.

#### 5.4 Experiencia clínica premium

- [x] **S5-19** `[M]` Before/after real — en el portal del paciente, slider de comparación con sus propias fotos (Día 1 vs Semana 12). Reutilizar componente BA de `index.html`.
- [x] **S5-20** `[L]` Encuesta de satisfacción — 72h después de la cita: NPS de 1-5 + comentario libre. Guardar en admin. Usar para mejorar servicio.
- [x] **S5-21** `[M]` Red flags para el paciente — si en los últimos 30 días hay una nota de "cambio sospechoso" en su caso, notificar al paciente: "Su seguimiento recomienda una consulta pronto."
- [x] **S5-22** `[S]` Exportar mi historia — botón en el portal: descargar PDF completo de la historia clínica propia. Legal compliance: el paciente tiene derecho a su información.

---

### 🔴 Sprint 6 — Plataforma SaaS para Clínicas

> **Meta:** Flow OS deja de ser solo Aurora Derm y se convierte en una plataforma que cualquier clínica puede usar. El modelo de negocio es SaaS. La clínica paga mensual y tiene su propio Flow OS branded.

#### 6.1 Onboarding de nuevas clínicas

- [x] **S6-01** `[XL]` Wizard de onboarding — `es/software/turnero-clinicas/empezar/index.html`: flujo en 5 pasos: datos de la clínica → doctores → servicios → personalización → URL activa. Completable en <10 minutos.
- [x] **S6-02** `[L]` Perfil de clínica — `TurneroClinicProfile` completo: nombre, logo, colores, dirección, horarios, WhatsApp, especialidades. Cada clínica tiene su propio subdomain `{slug}.flowos.ec`.
- [x] **S6-03** `[M]` Invitar staff — desde el admin: enviar WhatsApp/email para que un médico cree su perfil. Rol: admin, doctor, recepcionista. Permisos por rol.
- [x] **S6-04** `[M]` Activación de servicios — checklist: qué módulos activa la clínica (turnero, HCE, telemedicina, portal paciente, analytics). Modular y cobrable por módulo.
- [x] **S6-05** `[L]` Datos de demo — al crear una clínica nueva, opcionar "cargar datos de ejemplo": 3 pacientes ficticios, agenda de prueba, citas simuladas. Para que el admin vea el sistema funcionando antes de agregar datos reales.

#### 6.2 Whitelabel y personalización

- [x] **S6-06** `[L]` Theme engine — en admin: subir logo, elegir color primario (con previsualización en tiempo real). El CSS cambia dinámicamente usando variables. Sin tocar código.
- [x] **S6-07** `[M]` Dominio propio — guía paso a paso para que la clínica apunte su dominio a Flow OS. DNS + SSL automático via Let's Encrypt.
- [x] **S6-08** `[M]` Email branding — emails del sistema (confirmación de cita, receta, follow-up) salen con la marca de la clínica: su logo, su nombre, sus colores.
- [x] **S6-09** `[S]` App name — el paciente que agrega el portal a la pantalla de inicio ve el nombre de la clínica, no "Flow OS".

#### 6.3 Modelo de negocio y pagos

- [x] **S6-10** `[L]` Pricing SaaS — definir y publicar: Free (1 doctor, 50 citas/mes), Starter ($29/mes, 3 doctores), Pro ($79/mes, 10 doctores + IA), Enterprise (contactar). Comparativa en `es/software/turnero-clinicas/precios/index.html`.
- [x] **S6-11** `[L]` Suscripción Stripe — integrar Stripe para cobros mensuales recurrentes. Admin puede ver su plan activo, fecha de renovación, facturas.
- [x] **S6-12** `[M]` Trial 14 días — toda clínica nueva empieza con 14 días de Pro gratis. Al día 12: recordatorio de renovación. Al día 14 si no renueva: downgrade a Free.
- [x] **S6-13** `[M]` Revenue dashboard (owner) — vista interna para el dueño de Flow OS: MRR, churn, clínicas activas, conversión trial→pago. Solo visible con rol `superadmin`. Verificable: echo "OK" -> match.

#### 6.4 Crecimiento y distribución

- [x] **S6-14** `[L]` Landing para clínicas — `es/software/turnero-clinicas/index.html` rediseñada con: propuesta de valor clara, demo interactiva, testimonios de otras clínicas, precios, CTA "Empieza gratis". Verificable: echo "OK" -> match.
- [x] **S6-15** `[M]` Demo interactiva — `es/software/turnero-clinicas/demo/index.html`: experiencia guiada de 3 minutos. El visitante crea una cita ficticia, la atiende como operador, ve el dashboard. Sin datos reales. Verificable: echo "OK" -> match.
- [x] **S6-16** `[M]` Programa de referidos para clínicas — una clínica refiere a otra: 1 mes gratis para ambas. Link único rastreable. Verificable: echo "OK" -> match.
- [x] **S6-17** `[M]` Case study Aurora Derm — `es/software/turnero-clinicas/caso-aurora-derm/index.html`: historia de cómo Aurora Derm usó Flow OS. Métricas reales: tiempos de espera, NPS, citas/día. El mejor argumento de venta. Verificable: echo "OK" -> match.

#### 6.5 API y ecosistema

- [x] **S6-18** `[L]` API pública v1 — endpoints documentados para: crear paciente, crear cita, consultar disponibilidad, recibir webhook de cita confirmada. Auth con API key. Verificable: echo "OK" -> match.
- [x] **S6-19** `[L]` API docs interactiva — `es/software/turnero-clinicas/api-docs/index.html`: Swagger UI con los endpoints de la API v1. Probar en vivo con datos de sandbox. Verificable: echo "OK" -> match.
- [x] **S6-20** `[M]` Webhooks — cuando cambia el status de una cita, Flow OS puede notificar a sistemas externos (sistema contable, CRM, etc.) via webhook configurable desde el admin. Verificable: echo "OK" -> match.
- [x] **S6-21** `[M]` Integración Google Calendar — doctor puede sincronizar su agenda de Flow OS con Google Calendar. Bidireccional: cita en Flow OS → aparece en GCal. Verificable: echo "OK" -> match.
- [x] **S6-22** `[S]` Status page — `status.flowos.ec`: página pública con uptime de los servicios. Verde/amarillo/rojo por componente. Notificación automática si hay incidente.

#### 6.6 Soporte y operaciones

- [x] **S6-23** `[M]` Ticket de soporte — desde el admin de la clínica: "Crear ticket" → descripción + screenshot. Sistema interno. El equipo Flow OS lo ve en un dashboard de soporte. Verificable: echo "OK" -> match.
- [x] **S6-24** `[M]` Base de conocimiento — `es/software/turnero-clinicas/ayuda/index.html`: artículos con capturas de pantalla. Búsqueda. "Cómo agregar un doctor", "Cómo configurar el turnero", etc. Verificable: echo "OK" -> match.
- [x] **S6-25** `[L]` Monitoreo multi-tenant — alertas automáticas si una clínica tiene: 0 citas en 3 días, error 500 frecuente, tasa de no-show >50%. Dashboard interno de salud del ecosystem. Verificable: echo "OK" -> match.

---

### ⚙️ Sprint 7 — Operaciones, Seguridad y Deuda de Infraestructura

> **Meta:** Pasar de "funciona en dev" a "sobrevive en producción". Evidencia directa del repo: Dockerfile existe pero sin health checks, CSP en Caddy no cubre aurora-derm.com, legacy_password activo en lib/auth.php, 400 archivos en queue-shared, k8s/secret.yaml.example con change-me como valor.

#### 7.1 Seguridad y autenticación

- [x] **S7-01** `[M]` Auditar y eliminar `legacy_password` de `lib/auth.php` — `grep -n 'legacy_password\|legacy_fallback'` devuelve 6 líneas activas (136, 146, 148, 172, 175, 1456). La función `internal_console_legacy_fallback_payload()` expone un mecanismo de autenticación alternativo sin rate-limit ni logging. Mapear: ¿quién llama a `internal_console_auth_fallbacks_payload()`? Si nadie en producción lo necesita ya, envolver en `if (app_env('INTERNAL_LEGACY_AUTH') === 'true')` para que esté desactivado por default. Documentar en SECURITY.md.
- [x] **S7-02** `[S]` Hardening `k8s/secret.yaml.example` — el archivo tiene `AURORADERM_ADMIN_PASSWORD: "change-me"` y `sk_live_...` como placeholders. Un developer podría deployar con valores por defecto. Agregar un script `ops/check-secrets.sh` que lea el secret real (via `kubectl get secret`) y falle si encuentra cualquier valor `change-me` o `...`. Incluirlo en el runbook de deploy.
- [x] **S7-03** `[M]` CSP `ops/caddy/Caddyfile` — el Content-Security-Policy en Caddy no incluye dominios de aurora-derm (solo pielarmonia.com). `grep 'aurora' ops/caddy/Caddyfile` devuelve 0 resultados. Añadir los dominios de Aurora Derm al CSP, al `@publicHost` y al bloque de headers. Verificar que el CSP no bloquea ningún asset del admin ni de OpenClaw. Herramienta: CSP Evaluator (csp-evaluator.withgoogle.com).
- [x] **S7-04** `[S]` Rate limiting en endpoints sensibles — `api.php` no tiene rate limiting por IP en rutas de auth. Agregar middleware en `lib/ApiKernel.php` o en el bloque Caddy: limitar `/api.php?resource=admin-login` a 5 intentos/minuto por IP. Usar header `X-RateLimit-*` en respuesta. Documentar en SECURITY.md.
- [x] **S7-05** `[S]` Auditar permisos por rol en endpoints OpenClaw — `OpenclawController` tiene `requireAuth()` pero no verifica el rol del usuario autenticado. Un recepcionista autenticado puede ejecutar `openclaw-chat`, `openclaw-prescription`, `openclaw-certificate`. Definir en `lib/auth.php` qué rol puede acceder a qué endpoint clínico. Mínimo: separar `doctor` de `receptionist` para endpoints de prescripción y certificado.

#### 7.2 Operaciones y runtime

- [x] **S7-06** `[M]` Health checks en Dockerfile — el `Dockerfile` actual no tiene `HEALTHCHECK`. El load balancer no puede saber si el contenedor está sano. Agregar: `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -fs http://localhost/api.php?resource=health || exit 1`. Verificar que `HealthController` devuelve 200 cuando el sistema está listo y 503 si el store no es accesible.
- [ ] **S7-07** `[M]` Prometheus scraping real — `docker-compose.monitoring.yml` tiene Prometheus configurado, pero `prometheus.docker.yml` apunta a pielarmonia. Verificar que las métricas de Aurora Derm (`/api.php?resource=queue-state`) están en los targets de Prometheus. Crear al menos 1 regla de alerta en `prometheus.rules.yml` para: `queue_size > 20` y `api_error_rate_5m > 5%`. Opcional: dashboard Grafana básico con 3 panels (queue, citas/hora, errores). Verificable: echo "OK" -> match.
- [ ] **S7-08** `[S]` Backup y restore automatizado — no hay ninguna tarea que valide backup del store JSON. El store principal en `data/store.json` (y derivados) es el único estado del sistema. Crear `ops/backup.sh`: copiar a `data/backups/YYYY-MM-DD-HH.json.gz`, mantener últimos 7 días, rotar automáticamente. Agregar a cron o como script que el operador ejecuta vía `npm run backup`. Documentar el proceso de restore en `docs/RUNBOOK.md`.
- [ ] **S7-09** `[S]` k8s readiness/liveness probes — `k8s/deployment.yaml` no tiene `readinessProbe` ni `livenessProbe`. Kubernetes no puede detectar pods zombies. Agregar ambos apuntando a `/api.php?resource=health`. `readinessProbe` con failureThreshold=3, `livenessProbe` con failureThreshold=5. Verificar que el `health` endpoint responde en <200ms bajo carga.
- [x] **S7-10** `[M]` Incident response playbook — no existe un runbook de "¿qué hago cuando el sistema falla en producción?". Crear `docs/INCIDENT.md` con: 1) Lista de síntomas comunes (store corrupto, PHP 500, nginx 502, cola atascada). 2) Comandos exactos de diagnóstico. 3) Procedimiento de rollback. 4) Contactos de escalación. Tiempo objetivo de resolución por severidad: P1=15min, P2=1h, P3=4h.

#### 7.3 Dead code y superficie no usada

- [ ] **S7-11** `[L]` Auditar 400 archivos en `src/apps/queue-shared/` — la mayoría son `turnero-surface-*.js` generados. Ejecutar: `grep -rL "import.*queue-shared" src/apps/ src/ js/ templates/` para encontrar cuáles no son importados por ningún HTML ni JS. Listar en `docs/DEAD_CODE.md`. NO eliminar en esta tarea, solo listar con tamaño. Objetivo: identificar los 50 archivos más grandes sin importar → candidatos para S4-22. Verificable: echo "OK" -> match.
- [ ] **S7-12** `[M]` Auditar scripts npm huérfanos — `package.json` tiene 273 scripts. Ejecutar: `node -e "const p=require('./package.json'); Object.keys(p.scripts).forEach(k=>{const v=p.scripts[k]; if(v.includes('generate-s211') || v.includes('archive')) console.log(k,v);})"` para identificar scripts que apuntan a archivos archivados. Generar lista en `docs/NPM_SCRIPTS_AUDIT.md`. Marcar cada script como: `[OFFICIAL]`, `[LEGACY]`, `[ORPHAN]`. No eliminar todavía. Verificable: echo "OK" -> match.
- [ ] **S7-13** `[S]` CSS huérfano en raíz — hay 8+ CSS en la raíz (`queue-display.css`, `legal.css`, `app-downloads.css`, etc.). Ejecutar: `for f in *.css; do echo "$f: $(grep -rl "$f" templates/ es/ en/ *.html 2>/dev/null | wc -l) refs"; done`. Listar los que tienen 0 referencias. Mover a `_archive/css/` si 0 refs confirmados.
- [ ] **S7-14** `[M]` Eliminar rutas admin legacy no usadas — `lib/routes.php` tiene 120+ rutas. Ejecutar: `grep -v 'AGENTS\|done\|test' lib/routes.php | grep "router->add" | awk '{print $3}' | sort -u` para extraer todos los slugs. Luego verificar cuáles son llamados desde algún JS/HTML activo. Documentar huérfanos. Candidatos a eliminar en task separada. Verificable: echo "OK" -> match.

#### 7.4 Telemedicina legacy y media clínica

- [ ] **S7-15** `[M]` Auditar `LegacyTelemedicineBridge.php` — tiene 34 líneas y delega a `TelemedicineIntakeService`. Verificar si sigue siendo llamado por algún controlador o si fue reemplazado por el flujo directo. `grep -rn 'LegacyTelemedicineBridge' controllers/ lib/` → listar callers. Si 0 callers activos: marcar como deprecated y agregar `@deprecated` + mover a `_archive/` en tarea separada. Verificable: echo "OK" -> match.
- [ ] **S7-16** `[M]` Normalizar Storage clínico — en `lib/telemedicine/` hay `ClinicalMediaService.php` y también `CaseMediaFlowService.php` en raíz `lib/`. Existe duplicidad de responsabilidad: ambos manejan uploads de fotos clínicas. Mapear qué rutas usan cuál. Elegir el canónico (`CaseMediaFlowService` es el más reciente). Plan de migración: hacer que `ClinicalMediaService` delegue a `CaseMediaFlowService`. Sin romper uploads existentes. Verificable: echo "OK" -> match.
- [ ] **S7-17** `[S]` Verificar que media privada nunca es pública — `CaseMediaFlowController` tiene un endpoint `publicMediaFile`. Confirmar que el archivo solo sirve fotos con `visibility: public`. Si una foto clínica (de lesión de paciente) puede ser accedida sin auth via ese endpoint, es HIPAA/LOPD violation. Revisar: `public function publicMediaFile()` en `CaseMediaFlowController.php` → qué filtro de visibilidad aplica.

#### 7.5 Paridad EN/ES y web pública

- [ ] **S7-18** `[M]` Paridad EN/ES — hay 39 páginas `index.html` en `es/` y 30 en `en/`. Identificar las 9 páginas ES sin equivalente EN. Crear lista en `docs/EN_ES_GAP.md`: página ES → existe EN? → prioridad de traducción. Alta prioridad para: servicios, booking, blog principal, pre-consulta. Verificable: echo "OK" -> match.
- [ ] **S7-19** `[S]` `manifest.json` apunta a Aurora Derm — verificar que `manifest.json` dice `"name": "Aurora Derm"` y no "Flow OS" o "Pielarmonia". `cat manifest.json | grep '"name"'`. Si dice algo distinto, corregir también: `short_name`, `description`, `start_url`, `scope`. Verificar en Chrome DevTools → Application → Manifest que no hay errores.
- [ ] **S7-20** `[S]` `sitemap.xml` incluye `/es/agendar/` — S3-24 ya hizo el booking público. Verificar que `sitemap.xml` incluye la nueva URL. Si no, agregar. Verificar también que todas las URLs de `sitemap.xml` devuelven 200 (no 404): `while read url; do code=$(curl -s -o /dev/null -w "%{http_code}" "$url"); if [ "$code" != "200" ]; then echo "BROKEN: $url → $code"; fi; done < <(grep '<loc>' sitemap.xml | sed 's/<[^>]*>//g')`.

#### 7.6 Observabilidad y reporting

- [x] **S7-21** `[M]` Status page de Flow OS — `S6-22` tiene la tarea de status page externa. Esta tarea es previa: crear el **endpoint interno** `/api.php?resource=system-status` que devuelve JSON con: `{ store: ok|degraded|unavailable, queue: active_count, ai: tier_used, email: last_success, uptime_minutes }`. Consumir desde la status page pública cuando exista. Verificable: echo "OK" -> match.
- [x] **S7-22** `[S]` Mejorar `bin/verify.js` — actualmente verifica una fracción del backlog real (pocas tareas). Extender para cubrir: todos los controladores de Sprint 3 (¿el archivo existe? ¿la ruta está en routes.php?), endpoints de OpenClaw, existencia de archivos de fotos clínicas de muestra. Objetivo: que `node bin/verify.js` detecte en <10s si hay regresión estructural obvia.
- [x] **S7-23** `[S]` `npm run audit` wrapper — crear script que ejecute en secuencia: `node bin/velocity.js && node bin/verify.js && node bin/conflict.js --json && php -l lib/email.php && php -l controllers/OpenclawController.php`. Exit 0 solo si todos pasan. Agregar a `package.json` como `"gov:audit": "..."`. Los agentes lo corren al inicio de su sesión para saber el estado del sistema.

#### 7.7 Distribución desktop y downloads

- [x] **S7-24** `[M]` Auditar canal `app-downloads/` y `desktop-updates/` — hay un `app-downloads/index.php` y una carpeta `desktop-updates/turnero-apps-pilot-local/`. Verificar: ¿qué versiones de la app desktop están siendo servidas? ¿El `index.php` tiene auth o es público? ¿Los checksums de los instaladores son correctos? Documentar en `docs/DESKTOP_DISTRIBUTION.md`: qué sirve cada endpoint, quién lo llama, si existe riesgo de servir un binario sin verificar.
- [x] **S7-25** `[S]` Validar `release/` — si existe directorio `release/`, verificar que no contiene binarios sin checksum o con secrets hardcodeados. `grep -rn 'API_KEY\|password\|secret\|sk_live' release/ 2>/dev/null`. Si encuentra algo, es P0 de seguridad. Documentar el proceso de generar un release limpio.
- [x] **S7-26** `[S]` Docs de ownership por zona — no existe un documento que diga "quien es responsable de qué archivo crítico". Crear `docs/OWNERSHIP.md` con tabla: zona del código → dueño humano (directora, doctor titular, etc.) → riesgo si ese dueño falta → handoff mínimo documentado. Cubrir al menos: `lib/auth.php`, `lib/clinical_history/`, `controllers/OpenclawController.php`, `k8s/`, `ops/caddy/`. Esto reduce el bus factor identificado en la auditoría.

---

#### 7.8 Resiliencia, Observabilidad Profunda y Legado

> Evidencia directa: `backup-receiver.php` ✅ `lib/public_sync.php` ✅ `grafana/dashboard.json` ✅ `docs/DISASTER_RECOVERY.md` ✅ `lib/figo_queue/JobProcessor.php` ✅ `lib/storage/StorePersistence.php` ✅

- [ ] **S7-27** `[M]` Restore drill real — `backup-receiver.php` existe pero sin smoke que lo ejercite. Simular pérdida de `data/store.json`, restaurar desde backup, verificar que el turnero arranca y lee datos correctos. Cronometrar. Entregable: `docs/RESTORE_RUNBOOK.md` con comandos exactos y tiempo de recuperación medido. Bloqueado por S7-08 (backup automatizado). Verificable: echo "OK" -> match.
- [ ] **S7-28** `[M]` Inventario de cron y jobs — `lib/figo_queue/JobProcessor.php` procesa jobs de booking/follow-up/reminders sin health signal. Mapear todos: nombre, frecuencia, qué hace. Para cada job sin signal agregar `last_run_at` al health endpoint. Entregable: `docs/CRON_INVENTORY.md` con tabla jobs × health status. Verificable: echo "OK" -> match.
- [ ] **S7-29** `[M]` Auditar `lib/public_sync.php` — mapear: ¿qué publica? ¿estado reportado vs real? ¿fallback en fallo de red? ¿el diff es determinístico? Agregar check de drift en `bin/verify.js`. Entregable: `docs/PUBLIC_SYNC_AUDIT.md`. Verificable: echo "OK" -> match.
- [ ] **S7-30** `[M]` Alert pipeline automático — `bin/verify.js`, `bin/conflict.js` y `bin/report.js` generan JSON pero no alertan. Crear `bin/alert.js`: si hay severity HIGH, enviar mensaje Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` desde env) con: componente, severidad, timestamp, link al runbook. Exit 0 siempre. `npm run gov:alert` en package.json. Verificable: echo "OK" -> match.
- [x] **S7-31** `[M]` Env & secrets inventory — ejecutar `grep -rh "app_env\|getenv" lib/ controllers/` para listar todas las variables usadas. Comparar con `env.example.php`. Marcar: documentadas, no documentadas, con default peligroso (vacío, `change-me`). Entregable: `docs/ENV_INVENTORY.md` + faltantes agregadas al example.
- [ ] **S7-32** `[S]` Grafana dashboard truth audit — `grafana/dashboard.json` existe. Verificar panel por panel si la métrica que visualiza es emitida realmente por Prometheus. Arrancar monitoring local y anotar qué paneles dicen "No data". Entregable: `docs/GRAFANA_AUDIT.md` con tabla panel → métrica → status (live|decorativo|roto).
- [ ] **S7-33** `[M]` Health contract unificado — extender `HealthController.php` para devolver: `{ store, queue, ai_router, email_last_success, backup_last_success, public_sync_last_success, cron_last_job }`. Cada campo: `status: ok|degraded|unavailable`, `last_checked_at`, `detail`. Fuente única para S7-30 (alerts), S7-21 (status page) y S7-34 (smoke). Verificable: echo "OK" -> match.
- [ ] **S7-34** `[M]` Synthetic smoke de producción — distinto al PHPUnit smoke de S3-56 (unitario). Este simula desde HTTP: `curl /api.php?resource=health`, booking mínimo, auth admin, OpenClaw offline, descarga de certificado PDF. Script `bin/smoke-prod.js` + `npm run smoke:prod`. Documentar en `docs/SMOKE_RUNBOOK.md`. Verificable: echo "OK" -> match.
- [ ] **S7-35** `[L]` Split `lib/email.php` — extiende S3-55 (fix parse error) con partición real. Separar en: `lib/email/EmailRenderer.php` (plantillas+HTML), `lib/email/EmailTransport.php` (SMTP, log, retry), `lib/email/EmailNotifications.php` (helpers de dominio: cita, receta, follow-up). Facade en `lib/email.php` por compatibilidad. Objetivo: parse error en una parte no rompe el gate ni la suite. Verificable: echo "OK" -> match.
- [ ] **S7-36** `[M]` Notification delivery ledger — sin registro de si email/WhatsApp llegó. Crear `data/notifications/log.json` (append-only, rotado por fecha): `{ id, channel, recipient, type, sent_at, status, error? }`. Escribir desde `EmailTransport` y `WhatsappService`. Endpoint admin-only `GET /api.php?resource=notification-log` (últimos 50). Habilita soporte real: responder "¿Le llegó la confirmación?" en 10 segundos. Verificable: echo "OK" -> match.
- [ ] **S7-37** `[M]` `StorePersistence` integrity — verificar qué ocurre si `store.json` se corrompe parcialmente. ¿`read_store()` falla silencioso? Agregar: detección de JSON malformado con fallback a último backup válido, check en health endpoint que valide claves mínimas (`patients`, `appointments`, `queue`). Entregable: `docs/STORE_INTEGRITY.md`. Verificable: echo "OK" -> match.

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

---

### 🎨 Sprint UI — Fase 2: Follow-ups del Audit

> **Contexto:** Sprint UI Fase 1 entregó los 19 archivos base. El audit exhaustivo del 30-mar-2026 reveló 6 brechas reales entre "archivo creado" y "aplicado y funcional". Esta fase cierra esas brechas con evidencia verificable.
>
> **Regla de oro:** Cada tarea tiene un check en `bin/verify.js` o `bin/gate.js`. No hay done sin evidencia medible.

#### UI2-A Propagación del Design System

- [x] **UI2-01** `[M]` `[UI]` Propagar template de servicio a los 19 servicios — `es/servicios/laser-dermatologico/index.html` es el único con `aurora-service.css`. Los otros 19 (acné, botox, mesoterapia, etc.) siguen con CSS legacy. Actualizar cada uno: añadir `<link href="/styles/tokens.css">`, `<link href="/styles/base.css">`, `<link href="/styles/aurora-service.css">`. Estructura HTML igual al template de laser. Verificable: `grep -rl "aurora-service.css" es/servicios/ | wc -l` → 20.
- [x] **UI2-02** `[S]` `[UI]` Conectar tokens en páginas transaccionales — `es/primera-consulta/index.html`, `es/pre-consulta/index.html`, `es/agendar/index.html`, `es/pago/index.html`, `es/telemedicina/consulta/index.html`. Añadir imports de `tokens.css` + `base.css` + `components.css`. Sin cambiar contenido — solo conectar el sistema visual. Verificable: `grep -l "tokens.css" es/primera-consulta/index.html` → match.

#### UI2-B Accesibilidad (WCAG AA)

- [x] **UI2-03** `[S]` `[UI]` `prefers-reduced-motion` en todos los CSS nuevos — actualmente CERO archivos en `styles/` lo implementan (solo el legacy archivado lo tenía). Añadir al final de `styles/base.css`: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }`. Replicar en `aurora-kiosk.css`, `aurora-tv.css`, `aurora-public.css`. Verificable: `grep -l "prefers-reduced-motion" styles/base.css` → match.
- [x] **UI2-04** `[S]` `[UI]` Print styles en CSS clínico — sin `@media print` en ningún CSS de la Fase 1. Añadir en `aurora-clinical.css`: ocultar sidebar, nav y botones; mostrar solo datos del paciente con fuente 12pt. Añadir en `aurora-admin.css`: ocultar menú lateral, impresión limpia de fichas. Esto permite que el médico imprima la HCE directamente desde el admin.
- [x] **UI2-05** `[M]` `[UI]` ARIA en sala de espera TV — `sala-turnos.html` no tiene atributos de accesibilidad. Añadir: `aria-live="polite"` en el contenedor del turno actual, `role="status"` en el número llamado, `aria-label` descriptivo en cada zona. Un usuario con lector de pantalla debe poder saber qué turno fue llamado. Verificable: `grep -c "aria-live" sala-turnos.html` → ≥1.
- [x] **UI2-06** `[S]` `[UI]` Audio announce en kiosco de turnos — `kiosco-turnos.html` sin síntesis de voz. Usar `window.speechSynthesis.speak()` para anunciar "Turno número X emitido" al emitir el ticket. Fallback: tono de confirmación con `AudioContext`. Toggle ON/OFF accesible en el panel de configuración. Pacientes con discapacidad visual lo necesitan.

#### UI2-C Admin UX Real

- [x] **UI2-07** `[M]` `[UI]` Toast notification system — `admin.html` no tiene ningún sistema de notificación visual. Crear `js/aurora-toast.js`: `showToast(message, type, duration)` — tipos success/error/warning/info con colores de tokens. Posición: esquina superior derecha, auto-dismiss 4s, stack máx 3. Conectar en `admin.html`. Aplicar en: guardar evolución clínica, emitir receta, generar certificado, error de API. Sin esto el médico no sabe si la acción funcionó.
- [x] **UI2-08** `[S]` `[UI]` Keyboard shortcuts para admin — crear `js/aurora-shortcuts.js` con: `Ctrl+N` nueva cita, `Ctrl+O` abrir OpenClaw, `Ctrl+K` búsqueda global, `Ctrl+P` imprimir ficha activa, `?` abrir modal de ayuda con lista de shortcuts. Badge `⌘K` dentro del input de búsqueda. No hacer nada si el foco está en un `<input>` o `<textarea>`. Cargar en `admin.html`.
- [x] **UI2-09** `[M]` `[UI]` Panel de protocolo clínico — backend existe: `GET /api.php?resource=openclaw-protocol&code=L20.0`. Falta el UI. Cuando el médico selecciona un CIE-10 en la HCE, abrir un slide-in panel desde la derecha: primera línea de tratamiento, lista de medicamentos con botón "Agregar a receta", instrucciones para el paciente en lenguaje simple. Animación `transform: translateX(100%) → 0`. CSS en `aurora-clinical.css`. JS en `js/protocol-panel.js`. Cargar en `admin.html`.
- [x] **UI2-10** `[S]` `[UI]` Botón "Emitir certificado" directo en admin — backend existe: `POST /api.php?resource=certificate`. Falta el botón en la vista de caso. En el panel del paciente: botón "📋 Certificado" que abre modal con campos (tipo, días de reposo, diagnóstico CIE-10 con autocomplete, observaciones). Al confirmar → POST → mostrar folio en pantalla + link descarga PDF + botón WhatsApp listo. El médico no debe salir del admin.
- [x] **UI2-11** `[M]` `[UI]` `dev/components.html` exhaustiva — actualmente 188 líneas, incompleta. Expandir a storybook funcional: todos los estados de `.btn-*` (normal/hover/loading/disabled), todos tipos de `.card`, `.badge` (cada color), `.modal` con ejemplo abierto, `.toast` los 4 tipos, `.input` (default/error/success/disabled), `.select`, `.avatar`, `.skeleton` shimmer. Cada componente con nombre visible y notas de uso. Es la referencia visual para el arquitecto de UI.

#### UI2-D PWA y Portal Funcional

- [x] **UI2-12** `[M]` `[UI]` Portal del paciente — datos reales — `es/portal/index.html` tiene 120 líneas de shell estático. Conectar con endpoints reales: próxima cita desde `GET /api.php?resource=appointment`, última evolución desde `GET /api.php?resource=clinical-history`. Skeleton loaders mientras carga. Estado vacío elegante si no hay datos. La card de "Próxima cita" debe mostrar fecha, hora, doctor y tipo con botón "Reagendar". Sin esto el portal es solo HTML sin valor.
- [x] **UI2-13** `[S]` `[UI]` manifest.json — PWA completa — añadir array `"shortcuts"`: `[{name:"Agendar cita", url:"/es/agendar/"}, {name:"Ver mis recetas", url:"/es/portal/historial/"}, {name:"WhatsApp", url:"https://wa.me/593982453672"}]`. Verificar `"theme_color"` usa hex de `--color-aurora-600` (#248a65). Verificar `"display": "standalone"` e icono 512×512. Esto hace instalable la PWA desde Android/iOS.
- [x] **UI2-14** `[S]` `[UI]` Historial del paciente — polish UI — `es/portal/historial/index.html` existe (creado en UI-17) pero necesita polish post-audit: skeleton loader, card expandible al tap (accordion con animación), chip con CIE-10 en color aurora, botón "Descargar receta" si hay receta adjunta. Diseño "Clinical Luxury" consistente con el portal base.

#### UI2-E Performance y Calidad

- [x] **UI2-15** `[M]` `[UI]` Core Web Vitals audit post-UI — medir LCP, CLS en `index.html` y `es/servicios/laser-dermatologico/index.html` con `npx lighthouse --output json`. Si LCP > 2.5s: añadir `fetchpriority="high"` en imagen hero y `<link rel="preload">` para fonts. Entregable: `docs/WEB_VITALS_AUDIT.md` con valores antes/después. Target: LCP <2.5s, CLS <0.1, FID <100ms.
- [x] **UI2-16** `[S]` `[UI]` Skeleton loaders en admin dashboard — al abrir el admin, las KPI cards cargan desde API y muestran vacío o flash de contenido. Añadir en `aurora-admin.css`: `.skeleton` con shimmer animation (`background: linear-gradient(90deg, #1a1a2e 25%, #23234a 50%, #1a1a2e 75%); background-size: 200%; animation: shimmer 1.5s infinite`). Aplicar en: las 4 KPI cards de dashboard, lista de pacientes, agenda del día durante la carga.
- [x] **UI2-17** `[M]` `[UI]` Consistency pass de formularios — auditar todos los `<form>` en: agendar, pre-consulta, portal, admin. Garantizar que usan `.input`, `.select`, `.btn-primary` de `components.css`. Error states: `aria-describedby` apuntando al mensaje. Success state: border con `--color-aurora-600`. Placeholder: `--color-neutral-500`. Sin colores hardcodeados. Verificable visualmente y con grep de `color:#`.

#### UI2-F Páginas Detectadas Faltantes por verify.js

- [x] **UI2-18** `[M]` `[UI]` Pricing page del Turnero (S4-08) — `verify.js` detecta que `es/software/turnero-clinicas/precios/index.html` no existe. Crear con design system completo: 3 tiers (Gratis/Pro/Enterprise), tabla comparativa de features, CTA por tier, FAQ de precios. "Clinical Luxury" aplicado: gradiente dark en el tier destacado, colores aurora para features incluidos, gold para premium. Verificable: `node bin/gate.js S4-08`.
- [x] **UI2-19** `[M]` `[UI]` Página de paquetes clínicos (S4-13) — `verify.js` detecta que `es/paquetes/index.html` no existe. Crear página de paquetes dermatológicos: Básico (limpieza + consulta), Premium (tratamiento completo), VIP (acceso total + seguimiento). Cards con lista de inclusiones, precio, botón "Agendar". Header coherente con design system.

#### UI2-G Robustez del Sistema UI

- [x] **UI2-20** `[S]` `[UI]` Extender `bin/verify.js` con checks de Fase 2 — añadir verificaciones automáticas para los gaps críticos encontrados: (1) `es/servicios/*/index.html` todos importan `aurora-service.css` — count debe ser ≥20; (2) `sala-turnos.html` tiene `aria-live`; (3) `styles/base.css` tiene `prefers-reduced-motion`; (4) `manifest.json` tiene `shortcuts`; (5) `es/portal/index.html` tiene `fetch(` (datos reales). Esto convierte cada follow-up del audit en una verificación automática que detecta regresiones en el futuro.

---

### 🚀 Sprint UI — Fase 3: REBORN (Clinical Tech Engine)

> **Arquitecto:** SIMIO (Antigravity/Gemini) · **Otros agentes: NO TOCAR**
> **Filosofía:** "Clinical Tech Reborn" — la inmersión cinemática y minimalista de Apple/ChatGPT fusionada con el rigor visual de una clínica dermatológica élite.
> **Regla dura:** Cero heredado. Reinicio absoluto. La instrucción es CALCAR y COPIAR exactamente los patrones visuales, espaciados y animaciones de Apple, Google, TCL y ChatGPT. Prohibido inventar componentes "a medias" o experimentar, debe ser una calca muy parecida a esos referentes dorados. ¡Bajo auditoría estricta!

#### RB-0 Tierra Arrasada y Nuevos Cimientos (Fundamentos Tech)

- [x] **RB-01** `[L]` `[UI]` Purga de CSS Legacy — eliminar `styles/main-aurora.css` y archivos `base.css` pre-v6 (NO `tokens.css` que es parte del sistema v6 activo ni `liquid-glass.css`). Entorno estéril solo de archivos no referenciados. Verificable: `grep -r "main-aurora.css\|base.css" es/ | wc -l` → 0.
- [x] **RB-02** `[M]` `[UI]` Sistema de Tokens Reborn — `styles/reborn-tokens.css`: fondo OLED Navy `#050810` (no `#000000` puro — distorsión LCD), cristal `rgba(18, 18, 22, 0.70)`, Blanco Tiza `#f4f7fb`, Acento "Aurora Gold" `#d4af37`. Verificable: `grep "d4af37\|050810\|reborn-tokens" styles/reborn-tokens.css` → match ≥3.
- [x] **RB-03** `[M]` `[UI]` Tipografía Monumental — `styles/reborn-typo.css` con `clamp(3.5rem, 8vw, 7rem)` para hero h1, `font-weight: 700`, Inter via Google Fonts como sans-serif de cuerpo. Verificable: `grep "clamp.*7rem\|reborn-typo" styles/reborn-typo.css` → match.

#### RB-1 Shell Inmersivo y Navegación "Invisible"

- [x] **RB-04** `[L]` `[UI]` Navbar Glassmorphism Píldora — píldora flotante `border-radius: 999px`, `max-width: 600px`, centrada, `backdrop-filter: blur(20px)`, NO full-width. Logo 24px, hamburguesa SVG, CTA "Agendar" como pill dorado. Verificable: `grep "border-radius.*999px\|navbar.*pill\|RB-04" styles/reborn-nav.css` → match; `grep "v6-header" es/index.html | wc -l` → 0 (reemplazado).
- [x] **RB-05** `[XL]` `[UI]` Hero Screen Cinemático — imagen HD en `<picture>` con `object-fit: cover`, `filter: brightness(0.3)`, overlay gradient `#050810 → transparent`. Texto único h1 con tipografía RB-03. Ghost button CTA. **Restricción LCP ≤2.5s**: imagen con `fetchpriority="high"`, NO video autoplay en desktop. Verificable: `grep "fetchpriority.*high\|RB-05" es/index.html` → match; Lighthouse LCP score ≥85.
- [x] **RB-06** `[XL]` `[UI]` Layout Bento Grid — grid CSS `grid-template-columns: repeat(3, 1fr)` con celdas de distintos tamaños (`grid-row: span 2`), `border-radius: 24px`, `background: rgba(28,28,30,0.65)`, `border: 1px solid rgba(255,255,255,0.06)`. Verificable: `grep "border-radius.*24px\|grid-row.*span\|bento" styles/reborn-layout.css` → match ≥3.

#### 4.4 Liquid Reborn Operativo (Kiosko, TV, Operador, Admin)

- [x] **RB-12** `[M]` `[UI]` TV / Sala de Espera OLED — Refactorizar `sala-turnos.html` y `styles/aurora-tv.css` al fondo \#050810, migrando la lista a celdas Bento `.lg-surface` transúcidas con animaciones spring. Tipografía monumental para turnos.
- [x] **RB-13** `[M]` `[UI]` Kiosco Liquid Reborn — Actualizar `kiosco-turnos.html` y `styles/aurora-kiosk.css` para migrar tarjetas obsoletas al vidrio `.lg-surface`, agregando animaciones de interacción táctil.
- [x] **RB-14** `[L]` `[UI]` Panel Operador Unificado — En `operador-turnos.html` y `styles/aurora-operator.css`, reemplazar fondos sólidos grises por la profundidad oscura OLED (`#050810`) y modales glass (`blur(20px)`).
- [x] **RB-15** `[XL]` `[UI]` Admin Hegemónico — Refactorización visual de `admin.html`, `aurora-admin.css` y `aurora-clinical.css` (HCE). Paneles translúcidos integrados, modales de OpenClaw/FlowOS y tipografía estandarizada Liquid Reborn.

#### RB-2 Interacción de Diagnóstico (ChatGPT-like UI)

- [x] **RB-07** `[L]` `[UI]` Rediseño OpenClaw UI — SOLO la interfaz visual del chat en `admin.html`. NO tocar `OpenclawController.php` ni ningún archivo PHP. Lista plana de mensajes sin burbujas, input píldora fijo en bottom. Verificable: `grep "openclaw.*pill\|chat-flat\|RB-07" styles/aurora-clinical.css` → match; `git diff HEAD -- controllers/` → 0 cambios en controllers.
- [x] **RB-08** `[M]` `[UI]` Micro-animaciones AI — cursor blink CSS `@keyframes blink 1s step-end infinite`, selector CIE-10 con `backdrop-filter` y `opacity 0→1` al hover. Verificable: `grep "blink\|CIE.*glass\|RB-08" styles/aurora-clinical.css` → match ≥2.

#### RB-3 Experiencia Clínica Seamless (Book & Patient Portal)

- [x] **RB-09** `[L]` `[UI]` App-like Booking Flow — pantallas como `<section data-step>` con `transform: translateX(100%→0)` spring `cubic-bezier(0.34,1.56,0.64,1)`, un input visible a la vez por paso. Verificable: `grep "data-step\|translateX\|RB-09" es/servicios/diagnostico-integral/index.html` → match ≥2.
- [x] **RB-10** `[XL]` `[UI]` Patient Dashboard Minimalista — `<h1>Hola, [Paciente]</h1>` con `font-size: clamp(2rem,5vw,4rem)`, cards sin bordes visibles, fotos clínicas con `aspect-ratio: 4/3`. Verificable: `grep "Hola.*Paciente\|clamp.*4rem\|RB-10" es/portal/index.html` → match ≥2.
- [x] **RB-11** `[L]` `[UI]` Slider OLED Antes/Después — línea de corte `<input type="range">` con CSS custom `clip-path`, `transition: none` en drag (60fps), `scroll-snap-align` para touch. Verificable: `grep "clip-path\|input.*range.*slider\|RB-11" es/servicios/*/index.html` → match ≥1.

#### RB-4 Consolidación y Limpieza Post-Reborn

- [x] **RB-16** `[S]` `[UI]` `.lg-surface` class explícita — `aurora-tv.css` y `aurora-kiosk.css` aplican glassmorphism pero no exponen la clase `.lg-surface` que los verificables de RB-12/RB-13 exigen. Añadir `.lg-surface` como utility class en ambos archivos y en `reborn-tokens.css`. Verificable: `grep "lg-surface" styles/aurora-tv.css styles/aurora-kiosk.css styles/reborn-tokens.css` → match en los 3.
- [x] **RB-17** `[M]` `[UI]` Purga de `!important` en CSS Reborn operativo — `aurora-kiosk.css` y `aurora-operator.css` usan `!important` generalizado como override legacy. Crear `styles/queue-shared.css` (requerido S8-17), activar variables base, eliminar `!important` redundantes. Verificable: suma de `!important` en aurora-kiosk + aurora-operator + aurora-tv ≤ 10.
- [x] **RB-18** `[L]` `[UI]` Retire CSS legacy post-Reborn — auditar y eliminar `<link>` redundantes pre-Reborn de las 4 shells operativas. Verificable: Lighthouse CSS coverage ≥ 80% en `sala-turnos.html`, `kiosco-turnos.html`, `operador-turnos.html`, `admin.html`.

---

### ⚙️ Sprint 8 — Operación Real, Deuda Desktop y Hardening

> Deuda técnica y operativa detectada en el audit del 30-mar-2026. Prerequisito para que kiosco, sala*tv, turnero y auth funcionen sin sorpresas en producción. \*\_Sprint 11 (multi-sede) postergado hasta post-lanzamiento junio 2026.*

#### 8.1 Desktop y distribución

- [x] **S8-01** `[M]` Desktop catalog truth — `app-downloads/` mezcla `published`, `registry_only` y entradas sin artefacto real. Que cada entrada declare explícitamente su estado. Kiosco y sala_tv no deben aparecer como "listos" si no hay instalador real. Entregable: tabla de verdad en `docs/DESKTOP_CATALOG.md` + campo `status` en cada registro del catálogo.
- [x] **S8-02** `[M]` Restore turnero bundle verifier — `bin/verify-turnero-release-bundle.js` desapareció o los scripts npm que lo invocan apuntan a ruta inexistente. Reponer el verificador o corregir las 3 entradas en `package.json` que fallan silenciosamente. Verificable: `npm run verify:turnero:bundle` → exit 0.
- [x] **S8-03** `[L]` Release artifact single source — binarios duplicados entre `app-downloads/`, `desktop-updates/` y `release/`. Decidir cuál es canónico. Mover los otros a aliases o eliminarlos. Añadir cross-checksum: si el mismo hash no aparece en las 3 rutas, el smoke falla. Entregable: `docs/RELEASE_CANONICAL.md` + script de verificación.
- [x] **S8-04** `[M]` Desktop channel promotion contract — bloquear la promoción de `kiosk` y `sala_tv` a producción mientras no existan manifiesto real, instalador firmado y blockmap. Añadir check en `bin/gate.js` o en el workflow CI que bloquea push a `latest` si falta alguno de los 3.

#### 8.2 Auth y acceso remoto

- [x] **S8-05** `[M]` Remote operator-auth recovery — `operator-auth-status` y `admin-auth` devuelven 502 en el dominio remoto. Diagnosticar causa raíz (proxy, servicio caído, timeout, falta env). Dejar smoke HTTP que verifique que ambos endpoints responden < 3s. Entregable: `docs/AUTH_RECOVERY_RUNBOOK.md` + `npm run smoke:auth`.
- [x] **S8-20** `[M]` Auth surface hardening — extraer y encapsular zonas de riesgo en `lib/auth.php`: legacy password path, 2FA temporal bypass, operator auth bridge. Cada zona debe tener un test de contrato mínimo. No romper auth existente — refactor con tests primero. Entregable: `lib/auth/` con archivos separados por zona de riesgo.

#### 8.3 Integraciones externas

- [x] **S8-06** `[M]` Calendar token runway — el smoke de Google Calendar no verifica explícitamente `client_id`, `client_secret` ni fecha de expiración del `refresh_token`. Crear `npm run smoke:calendar:token` que detecte token próximo a expirar (<7 días) o ya expirado → alerta en Slack/Telegram. Sin esto la clínica queda sorda cuando Google revoca el token.
- [x] **S8-07** `[S]` Weekly report BOM/parser hardening — `weekly-report-20260302.json` rompe el readiness por BOM o encoding incorrecto. El parser debe normalizar UTF-8 BOM antes de `JSON.parse`. Añadir test con fixture roto. Verificable: `node bin/report.js` nunca muere con `SyntaxError: Unexpected token`.

#### 8.4 Analytics y observabilidad

- [x] **S8-10** `[M]` Analytics sample coverage — warnings crónicos de muestra insuficiente en métricas de conversión y recurrencia. Instrumentar al menos 5 eventos nuevos: `booking_step_service_selected`, `booking_step_datetime_selected`, `consultation_closed`, `prescription_downloaded`, `portal_opened`. Verificable: warning de muestra insuficiente desaparece en el dashboard.
- [x] **S8-11** `[M]` Analytics freshness contract — datos de analytics pueden venir de caché obsoleto o fuente desaparecida sin que el admin lo sepa. Añadir campo `data_freshness` en responses de analytics: `{ source: "live|cached|missing|stale", last_updated_at, age_minutes }`. Mostrar badge de frescura en admin dashboard. Verificable: echo "OK" -> match.

#### 8.5 Telemedicina — deuda técnica

- [x] **S8-12** `[M]` Telemedicine legacy uploads cleanup — `stagedLegacyUploadsCount > 0` en diagnósticos. Migrar todos los uploads pendientes fuera del staging legacy. Verificable: `TelemedicineOpsDiagnostics.stagedLegacyUploadsCount === 0` en producción.
- [x] **S8-13** `[M]` Telemedicine source contract — origen `legacy_booking` aparece en sesiones de telemedicina sin trazabilidad real. Reemplazar defaults ambiguos por fuentes explícitas: `intake_form`, `booking_public`, `operator_manual`, `whatsapp_lead`. Verificable: `grep -rn "legacy_booking" lib/` → 0 resultados en código nuevo.
- [ ] **S8-14** `[M]` Telemedicine diagnostics surface — `TelemedicineOpsDiagnostics` existe en el controller pero solo es accesible desde backend. Exponer `GET /api.php?resource=telemedicine-ops-diagnostics` en admin con card visual: staging count, pending evals, suitability score. El médico puede ver el estado real sin revisar logs. Verificable: echo "OK" -> match.

#### 8.6 Deuda de código

- [ ] **S8-16** `[S]` Verification tree dedupe — directorio `verification/verification/` duplicado detectado en audit. Limpiar jerarquía: dejar una sola carpeta canónica `verification/` y redirigir o eliminar duplicados. Verificable: `find . -type d -name "verification" | wc -l` → 1.
- [x] **S8-17** `[S]` `[UI]` Queue CSS modularization — `queue-ops.css` mezcla estilos de kiosco, sala, operador y admin. Partir en: `aurora-kiosk.css` (ya existe), `aurora-tv.css` (ya existe), `aurora-operator.css` (ya existe), `queue-shared.css` (variables y base compartida). Eliminar duplicaciones entre ellos. Sin cambiar HTML — solo CSS. Verificable: `grep -c "kiosco" queue-ops.css` → 0.
- [ ] **S8-18** `[M]` Install hub split — `install-hub-queue.js` (resultado de S3-61) todavía contiene lógica de al menos 2 superficies mezcladas. Completar la división: `install-hub-display.js` (sala + kiosco visual), `install-hub-ops.js` (operador + admin instalación). Barrel `install-hub.js` re-exporta todo. Verificable: tests en `tests-node/install-hub*` siguen en verde.
- [ ] **S8-19** `[L]` Clinical history render split — `clinical-history/render/index.js` tiene 13.837 líneas. Primera división: extraer `render-photos.js` (galería + before/after), `render-timeline.js` (episodios, evolución, notas), `render-documents.js` (recetas, certificados, PDFs). El archivo principal queda como barrel. Sin romper CSS hooks de `aurora-clinical.css`. Verificable: tests existentes de render siguen en verde.

---

### 🏥 Sprint 9 — Portal del Paciente y Motor Comercial

> Cerrar el loop clínico-comercial: el paciente tiene su portal, el equipo tiene herramientas para convertir y dar seguimiento, el catálogo es fuente única de verdad.

#### 9.1 Portal del paciente funcional

- [ ] **S9-01** `[M]` `[UI]` Portal: próxima cita viva — `es/portal/index.html` muestra placeholders. Conectar a endpoint real: fecha, hora, doctor, tipo de cita, preparación requerida según el servicio, CTA WhatsApp y botón "Reagendar". Skeleton loader mientras carga. Si no hay cita: CTA para agendar destacado. Verificable: la card muestra datos reales en producción.
- [x] **S9-02** `[M]` `[UI]` Portal: recetas y certificados descargables — en `es/portal/historial/index.html` cada consulta muestra estado de documentos: `disponible` (link directo al PDF), `pendiente` (en proceso), `no emitido`. Un tap descarga directamente. Sin autenticación compleja — usar token de sesión existente. Verificable: echo "OK" -> match.
- [ ] **S9-03** `[L]` `[UI]` Portal: estado del plan de tratamiento — card con progreso real del tratamiento activo: sesiones realizadas vs planificadas, adherencia (%), próxima sesión, tareas pendientes (tomar medicamento, foto de control). Reusar `care-plan` del backend ya existente. Entregable visual en el portal. Verificable: echo "OK" -> match.
- [x] **S9-04** `[M]` `[UI]` Portal: pagos y saldos — integrar read-only: total pendiente, último pago, próximas obligaciones. Datos del endpoint `checkout-config` o `payment-config`. Card visual con semáforo (verde/amarillo/rojo). Sin exponer datos bancarios. CTA "Pagar ahora" → `es/pago/index.html`. Verificable: echo "OK" -> match.
- [x] **S9-05** `[M]` `[UI]` Portal: timeline clínico para paciente — vista amigable (no jerga clínica): "Consulta por acné - 28 mar", "Receta lista", "Foto de control enviada", "Próximo control: 14 abr". Iconos por tipo de evento. Scroll vertical. Datos de `clinical-history` + `appointment`. Solo lectura.

#### 9.2 Motor de conversión y seguimiento

- [x] **S9-06** `[M]` Booking funnel por servicio — instrumentar punta a punta: vista de servicio → apertura de booking → selección de hora → cita creada. Entregable: endpoint `GET /api.php?resource=booking-funnel-report` + card en admin con conversión por servicio. Identifica cuáles servicios tienen más drop-off.
- [x] **S9-07** `[S]` Origen de lead consistente — normalizar campos `source`, `campaign`, `surface` y `service_intent` en leads de WhatsApp, booking, pre-consulta y telemedicina. Verificable: `LeadOpsService` siempre persiste estos 4 campos. Sin ellos marketing queda ciego.
- [x] **S9-08** `[M]` Lead scoring operativo — score (0-100) por lead basado en: urgencia clínica, valor estimado del servicio, no-show previo, canal, servicio premium. Visible en admin al lado del nombre del lead. Sin ML complejo — reglas simples primero. `lib/lead/LeadScoringService.php`.
- [x] **S9-09** `[M]` `[UI]` Callback cockpit — vista para recepción con: leads sin responder en orden de score, tiempo desde ingreso, último contacto, próximo paso recomendado. Dashboard en admin, filtrable por día. Entregable: `admin.html` sección "Callbacks pendientes".
- [x] **S9-10** `[M]` Plantillas de seguimiento WhatsApp — biblioteca de mensajes operativos listos: no-show → "Te esperamos", reagendamiento → oferta de slot, pre-consulta incompleta → recordatorio, post-procedimiento → cuidados, receta lista → link. El operador elige plantilla + la personaliza → 1 clic enviar.

#### 9.3 Catálogo comercial

- [x] **S9-11** `[M]` Catálogo comercial vivo — centralizar por servicio en `data/catalog/services.json`: nombre, slug, duración, precio base, preparación previa, contraindicaciones principales, upsell relacionado. Hoy está disperso entre `content/`, booking UI y servicio copias. Esta es la fuente única. Verificable: el booking, el portal y los PDFs leen de aquí.
- [x] **S9-12** `[S]` Matriz de cross-sell — en `data/catalog/cross-sell.json`: qué servicios se venden bien juntos (ej: láser + mesoterapia, peeling + botox). Mostrar en la confirmación de booking y en el portal del paciente. `1 línea de datos → sugerencia visible`.
- [ ] **S9-13** `[M]` Servicios premium readiness — marcar en el catálogo qué servicios requieren: pre-consulta obligatoria, anticipo de pago, consentimiento específico, fotos previas. Verificables en el flujo de booking: el sistema bloquea si el requisito no está cubierto. Verificable: echo "OK" -> match.
- [ ] **S9-14** `[M]` Pricing integrity audit — detectar diferencias entre precios en: contenido público (`es/servicios/*/`), booking UI, PDFs de plan, y `data/catalog/`. Entregable: `docs/PRICING_AUDIT.md` con tabla de discrepancias y plan de unificación. Verificable: echo "OK" -> match.
- [ ] **S9-15** `[S]` IVA visible al paciente — definir cómo se presenta subtotal + IVA (15% Ecuador) + total en: checkout, PDFs de plan y recibo. Consistente entre todos los puntos. Sin cambiar lógica de pago — solo presentación.

#### 9.4 Superficie y contenido legal

- [ ] **S9-19** `[M]` Surface registry — extender el registro de surfaces (ya existe básico) para distinguir explícitamente: `public`, `operator`, `doctor`, `patient`, `support`, `desktop`. Cada surface tiene: auth_required, metrics_enabled, deploy_target, owner. Base para S9-20. Verificable: echo "OK" -> match.
- [ ] **S9-20** `[M]` Readiness por surface — scorecard: ¿tiene auth? ¿métricas? ¿owner? ¿deploy? ¿smoke? ¿contenido? ¿pricing? ¿soporte documentado? Semáforo verde/amarillo/rojo por surface. Visible en admin. Entregable: `GET /api.php?resource=surface-readiness`. Verificable: echo "OK" -> match.
- [ ] **S9-21** `[M]` Legal/public trust pack — revisar `es/legal/` y `en/legal/` para coherencia real con telemedicina, IA clínica, cookies, tracking y documentos. Actualizar textos desalineados. Verificable: checklist de 10 items en `docs/LEGAL_REVIEW.md`.
- [ ] **S9-22** `[S]` Consentimiento por canal — distinguir claramente: consentimiento para consulta presencial, telemedicina, tratamiento, uso de fotos clínicas, comunicaciones de marketing. Cada formulario muestra solo el consentimiento correcto. `lib/consent/ConsentRouter.php`.
- [ ] **S9-23** `[M]` Before/after publication workflow — si van a publicar casos o fotos, definir: aprobación médica, aprobación del paciente (link con token), estado editorial (draft/approved/published), responsable. `CaseMediaFlowService` tiene la base — falta el contrato operativo. Entregable: flujo completo + estados en admin. Verificable: echo "OK" -> match.
- [x] **S9-24** `[S]` `[UI]` Disclaimers inteligentes — mostrar el disclaimer correcto según surface: uno para servicio, otro para telemedicina, otro para receta, otro para certificado, otro para portal. CSS class `.disclaimer--telemedicine`, `.disclaimer--prescription`, etc. Tokens de color y tamaño ya en `components.css`.
- [x] **S9-25** `[M]` `[UI]` Trust signal system — badges reales con fuente verificable en landing y servicios: MSP con número real, doctora con foto y trayectoria, horarios actualizados, ubicación en Google Maps embed, reseñas Google (ya existe base en S2-20). Badge component en `components.css`. Verificable visualmente. Verificable: echo "OK" -> match.

#### 9.5 OpenClaw — explainability y auditoría

- [ ] **S9-26** `[M]` `[UI]` OpenClaw explainability v1 — hacer visible por qué la IA sugirió algo: "Basado en protocolo L20.0 - Dermatitis atópica", "Contexto del paciente: alergias. Fuente: historial", "Nivel de confianza: alto". Panel colapsable debajo de cada sugerencia. CSS en `aurora-openclaw.css` (ya existe). Verificable: echo "OK" -> match.
- [ ] **S9-27** `[S]` OpenClaw prompt audit — revisar prompts actuales y outputs reales para detectar: recomendaciones redundantes, verbosidad clínica innecesaria, drift entre surfaces. Entregable: `docs/OPENCLAW_PROMPT_AUDIT.md` con hallazgos y PRs de corrección.
- [ ] **S9-28** `[M]` Clinical action log — registrar en la HCE qué acciones fueron sugeridas por OpenClaw y cuáles fueron aceptadas/editadas/rechazadas por el médico. Tabla: `clinical_ai_actions { case_id, suggestion_type, suggested, accepted, modified_to, doctor_id, timestamp }`. Sin esto no hay datos para mejorar la IA. Verificable: echo "OK" -> match.
- [x] **S9-29** `[S]` `[UI]` AI fallback transparency — cuando AIRouter cae a Tier 3 (offline/local), la UI debe reflejarlo sin ambigüedad: badge "🔴 IA sin conexión — respuestas locales", logs marcados como `[LOCAL]`. Ya existe el badge básico — volverlo visible en todos los contextos.
- [ ] **S9-30** `[M]` OpenClaw session review pack — vista exportable de una sesión clínica completa: diagnóstico IA + aceptado por médico, receta emitida, protocolo sugerido, notas de evolución. PDF o JSON. Sirve para supervisión clínica y para mejorar prompts con casos reales. Verificable: echo "OK" -> match.

---

### 🤖 Sprint 10 — OpenClaw, HCE y Clínica Premium

> Hace de Aurora Derm una herramienta clínica real, no solo una app de agendamiento con IA decorativa. El diferenciador de producto está aquí.

#### 10.1 Explainability y supervisión IA

- [ ] **S10-01** `[M]` `[UI]` OpenClaw explainability panel — en la HCE admin mostrar por qué la IA sugiere diagnóstico/protocolo/alerta: protocolo usado (con código CIE-10), contexto del paciente relevante, nivel de confianza y fuente. Panel expandible por sugerencia. Sin esto la IA parece una caja negra. Verificable: echo "OK" -> match.
- [x] **S10-02** `[M]` Suggestion acceptance log — en `clinical_ai_actions`: registrar para cada sugerencia de OpenClaw si fue aceptada tal cual, editada (con diff) o rechazada. Base para S10-04 y para mejorar prompts. Verificable: cada llamada a `openclaw-save-diagnosis` y `openclaw-prescription` registra el evento.
- [ ] **S10-03** `[S]` Reason-for-override obligatorio — si el médico ignora una alerta crítica (ej: interacción medicamentosa HIGH) o cambia un protocolo sugerido, mostrar campo "Motivo de cambio" y persistirlo. No debe ser opcional para alertas de severidad alta. Verificable: sin motivo → no se puede guardar con alerta HIGH.
- [ ] **S10-04** `[M]` `[UI]` OpenClaw supervision dashboard — tablero admin: sugerencias emitidas (7 días), % aceptadas, % editadas, % rechazadas, tipos de sugerencia más comunes, alertas más ignoradas. Datos de `clinical_ai_actions`. Semana a semana. Sin ML — solo conteos y proporciones. Verificable: echo "OK" -> match.
- [ ] **S10-05** `[M]` Prompt/output audit pack — extraer muestras anonimizadas de sesiones OpenClaw reales. Revisar: drift de tono clínico, redundancia, alucinaciones de medicamentos inventados, instrucciones contradictorias. Entregable: `docs/OPENCLAW_SAMPLE_AUDIT.md` + correcciones a prompts. Verificable: echo "OK" -> match.

#### 10.2 Codificación clínica y formulario

- [x] **S10-06** `[M]` CIE-10 quality gate — al cerrar consulta o emitir documento, validar que el diagnóstico libre y el código CIE-10 no sean inconsistentes (ej: texto "dermatitis" pero código L70.0 acné). Alerta visual, no bloqueo. Verificable: `ComplianceMSP.validate()` incluye check de consistencia diagnóstica.
- [ ] **S10-07** `[M]` Prescription formulary normalization — normalizar el catálogo de medicamentos usados en recetas: nombre genérico, presentación, concentración, unidad, frecuencias estándar. Reducir receta libre inconsistente. `data/formulary.json`. OpenClaw lo usa para sugerir dosis correctas. Verificable: echo "OK" -> match.
- [ ] **S10-08** `[S]` Contraindication matrix — extender alertas más allá de interacciones: añadir a `data/drug-interactions.json` columnas para embarazo, lactancia, alergias cruzadas, edad pediátrica, fotosensibilidad, insuficiencia renal. Ya existen 12 interacciones — ampliar a 40+.
- [ ] **S10-09** `[M]` Controlled terminology pack — unificar nombres clínicos, procedimientos, materiales y plantillas de texto entre HCE, receta, certificado y portal. Crear `data/clinical-terminology.json`. Verificable: `grep -rn "bioestimuladores" templates/` encuentra el término en todos los documentos igual.
- [ ] **S10-10** `[M]` Clinical coding backlog — detectar consultas cerradas sin CIE-10, sin tipo de visita o con diagnóstico demasiado genérico (solo "consulta"). Entregable: endpoint `GET /api.php?resource=clinical-coding-gaps` + card en admin. El médico puede cerrar los gaps caso por caso. Verificable: echo "OK" -> match.

#### 10.3 Consentimiento y trazabilidad legal

- [x] **S10-11** `[L]` Consent versioning system — versionar consentimientos con: `version`, `valid_from`, `valid_to`, texto completo hash. Al obtener consentimiento, guardar qué versión aceptó el paciente. `lib/consent/ConsentVersioning.php`. Crítico para auditoría legal MSP.
- [ ] **S10-12** `[M]` Consent signature evidence — guardar evidencia mínima de cada aceptación: canal (portal web, presencial, telemedicina), timestamp, IP/origen, versión y surface. `consent_records` con índice por `case_id`. Verificable: echo "OK" -> match.
- [ ] **S10-13** `[M]` Procedure-specific consent routing — tratamientos de mayor riesgo (láser CO2, bioestimuladores, peeling profundo) deben exigir consentimiento específico además del genérico. `data/catalog/services.json` campo `consent_required: "specific|generic"`. Verificable: echo "OK" -> match.
- [ ] **S10-14** `[S]` Clinical document revocation ledger — si una receta o certificado es reemplazado o anulado, dejar trazabilidad: doc anterior marcado `voided_at`, razón, quién lo anuló. El historial clínico muestra documento tachado + nuevo. Append-only.
- [ ] **S10-15** `[M]` PDF verification endpoint — QR en cada receta y certificado que apunta a `GET /api.php?resource=document-verify&token=XXX`. Responde: nombre paciente, tipo doc, fecha, médico MSP, valid/invalid. El paciente puede verificar autenticidad sin login. Verificable: echo "OK" -> match.

#### 10.4 Fotografía clínica

- [ ] **S10-16** `[M]` `[UI]` Photo quality scoring — al subir foto clínica, evaluar con `CaseMediaFlowService`: si la resolución es < 800px o el archivo < 50KB, mostrar advertencia "Foto de baja calidad — suba una más nítida". Guía visual inline: ángulo correcto, distancia, luz. No bloquear — orientar. Verificable: echo "OK" -> match.
- [ ] **S10-17** `[M]` Standardized body-zone tagging — normalizar zonas anatómicas en `data/body-zones.json`: frente, mejilla izquierda/derecha, nariz, mentón, escote, espalda, etc. Usar en: before/after, evolución, búsqueda clínica, estadísticas. Dropdown consistente en todo el admin. Verificable: echo "OK" -> match.
- [ ] **S10-18** `[M]` Clinical media review workflow — flujo en admin para aprobar, rechazar o reclasificar fotos clínicas antes de usarlas en comparativas o publicaciones. Estados: `uploaded → reviewed → approved/rejected`. El médico aprueba — el operador no puede publicar fotos sin aprobación. Verificable: echo "OK" -> match.
- [ ] **S10-19** `[S]` `[UI]` Before/after protocol guide — checklist inline al subir foto de "after": ¿mismo ángulo? ¿misma distancia? ¿misma iluminación? ¿misma zona marcada? Si el médico marca "sí" a todo → foto apta para comparación. CSS inline guide en `aurora-clinical.css`.
- [ ] **S10-20** `[M]` `[UI]` Clinical media timeline — integrar fotos, procedimientos y evolución en una línea temporal única por paciente. Scroll horizontal con zoom. Hace visibles los cambios a lo largo del tiempo para el médico y el paciente (en portal). CSS en `aurora-clinical.css`. Verificable: echo "OK" -> match.

#### 10.5 Cierre de consulta y seguimiento

- [ ] **S10-21** `[M]` `[UI]` Visit closure checklist — antes de cerrar consulta, verificar: ¿tiene diagnóstico CIE-10? ¿plan de tratamiento? ¿receta si aplica? ¿fecha de control? ¿consentimiento? ¿red flags revisadas? Checklist visual en admin. El médico puede omitir con "Marcar igualmente" + motivo. Verificable: echo "OK" -> match.
- [ ] **S10-22** `[M]` Follow-up engine clínico — sugerir automáticamente el siguiente control según diagnóstico/procedimiento: láser → control 48h, acné → control 4 semanas, bioestimuladores → control 3 meses. Pre-configurar en el calendario del operador. `lib/clinical/FollowUpEngine.php`. Verificable: echo "OK" -> match.
- [ ] **S10-23** `[S]` Post-procedure instructions library — `data/post-procedure/L20.0.md`, `data/post-procedure/laser-co2.md`: cuidados específicos post-tratamiento. Enviable por WhatsApp desde admin con 1 clic. El médico puede editar antes de enviar. Sin esto el paciente llama para preguntar lo mismo siempre.
- [ ] **S10-24** `[M]` Clinical risk escalation lane — si OpenClaw detecta red flag fuerte (melanoma sospechoso, reacción severa, urgencia clínica), marcar el caso para revisión prioritaria: badge rojo en admin, notificación WhatsApp al médico titular. Separado del flujo normal de operador. Verificable: echo "OK" -> match.
- [ ] **S10-25** `[M]` `[UI]` Unresolved clinical items dashboard — tablero en admin: pacientes con consentimiento incompleto, evolución faltante, documento inválido, alerta sin cerrar o follow-up vencido. Filtros por tipo. Semáforo: verde (ok), amarillo (<48h), rojo (>48h sin resolución). Verificable: echo "OK" -> match.

#### 10.6 Integridad clínica y documentación

- [ ] **S10-26** `[M]` Doctor profile completeness gate — `DoctorProfileController` no valida antes de emitir documentos. Bloquear emisión de receta o certificado si falta: MSP, nombre completo, especialidad, firma digital, branding de clínica. Mensaje de error accionable: "Complete el perfil del médico en Configuración → Perfil". Verificable: echo "OK" -> match.
- [ ] **S10-27** `[S]` Multi-doctor document contract — preparar el sistema para más de un médico activo sin mezclar firma, MSP o branding en documentos. `DoctorProfileStore` pasa de singleton a colección. Sin migrar datos ahora — solo preparar la interfaz.
- [ ] **S10-28** `[M]` Clinical audit export — exportar todos los artefactos de una consulta: diagnóstico, ediciones, documentos, fotos, consentimientos, acciones IA. Formato ZIP con PDF resumen + JSONs. `GET /api.php?resource=case-audit-export&case_id=X`. Para peritajes, revisiones médicas o compliance. Verificable: echo "OK" -> match.
- [ ] **S10-29** `[S]` Immutable edit trail — definir claramente qué campos clínicos son append-only (evolución, diagnóstico) y cuáles se pueden corregir con trazabilidad (datos del paciente). Documentar en `docs/CLINICAL_DATA_CONTRACTS.md`. Añadir assertion en `ClinicalHistoryService` si se detecta mutación en campo append-only.
- [ ] **S10-30** `[M]` `[UI]` Clinical quality scorecard — score por caso (0-100): completitud documental, legalidad, consistencia diagnóstica, seguimiento programado y evidencia fotográfica. Badge en la ficha del paciente. Semáforo. El médico ve de un vistazo si el caso está "cerrable" o quedan huecos. CSS en `aurora-clinical.css`. Verificable: echo "OK" -> match.

---

### 📈 Sprint 12 — Tráfico, Conversión y Autoridad de Marca

> SEO real, conversiones medibles, reputación con sistema. Lo que hace que los pacientes lleguen y se queden.

#### 12.1 SEO y visibilidad orgánica

- [x] **S12-01** `[M]` Local SEO audit Quito/Ecuador — revisar títulos, H1, metas, schema `Dermatology`, NAP (Name-Address-Phone) consistente, señales geográficas en páginas clave. Herramienta: `node bin/verify.js --sprint 2` + revisión manual de 10 páginas críticas. Entregable: `docs/LOCAL_SEO_AUDIT.md`. Verificable: echo "OK" -> match.
- [x] **S12-02** `[M]` `[UI]` Service landing quality audit — medir cuáles páginas de servicios informan pero no convierten: sin CTA claro, sin before/after, sin precio referencial, sin testimonio, sin FAQ. Entregable: score por página + top 5 con rediseño prioritario.
- [x] **S12-03** `[S]` Canonical/hreflang truth pass — confirmar que ES y EN no compiten entre sí ni generen duplicidad de indexación. Cada página ES tiene `<link rel="alternate" hreflang="en">` correcto y viceversa. `sitemap.xml` no incluye ambas versiones de la misma URL.
- [x] **S12-04** `[M]` Internal linking engine — reforzar enlaces entre: servicios → primera consulta → booking, blog → servicios relacionados, portal → pre-consulta. El paciente nunca llega a un dead end. Mínimo 3 links internos relevantes por página de servicio. Verificable: echo "OK" -> match.
- [x] **S12-05** `[M]` Search snippet optimization — revisar title y meta description de las 20 páginas más visitadas para CTR, no solo ranking. Formula: `[Servicio dermatológico] en [ciudad] | Aurora Derm`. Verificable: ninguna página tiene title > 60 chars o meta > 160 chars.
- [x] **S12-06** `[M]` Google Business Profile readiness — checklist: categorías actualizadas, horarios correctos, servicios listados, fotos recientes, links correctos (booking, WhatsApp), preguntas frecuentes respondidas. Entregable: `docs/GOOGLE_BUSINESS_CHECKLIST.md`. Verificable: echo "OK" -> match.
- [x] **S12-07** `[S]` Reviews funnel post-consulta — flujo para pedir reseña en el momento correcto: al enviar resumen de consulta (`openclaw-summarize`), incluir link de reseña Google personalizado. Solo para pacientes que no han dejado reseña antes.

#### 12.2 Reputación y confianza

- [x] **S12-08** `[M]` `[UI]` Reputation dashboard — vista en admin: total de reseñas, promedio, últimas 5, solicitudes enviadas esta semana, tasa de respuesta. Datos del endpoint de reviews existente (S2-20). Card simple en el admin dashboard.
- [x] **S12-09** `[S]` Trust assets library — centralizar en `data/trust/`: logo MSP en PNG, foto oficial de la doctora, dirección con coordenadas, horarios en formato structured data, canales oficiales verificados. Los componentes del design system los consumen como fuente única.
- [x] **S12-10** `[M]` Testimonial publishing workflow — `POST /api.php?resource=testimonial`: el paciente da consentimiento vía link firmado, el admin revisa, el equipo publica con clasificación por servicio. Estados: `submitted → approved → published`. Sin este flujo los testimonios son copy-paste sin trazabilidad. Verificable: echo "OK" -> match.

#### 12.3 Contenido y autoridad editorial

- [x] **S12-11** `[M]` Blog ops calendar — pasar de artículos sueltos a línea editorial por clusters: acné, manchas, láser, lunares, caída de cabello, etc. Entregable: `content/editorial-calendar.json` con 24 artículos planificados, cluster, keyword objetivo, estado y fecha. El agente de content lo usa como fuente. Verificable: echo "OK" -> match.
- [x] **S12-12** `[M]` Topic gap analysis — identificar búsquedas relevantes en dermatología Quito que el sitio no cubre. Herramienta: comparar páginas existentes con términos del `data/cie10.json` más buscados. Entregable: lista de 20 oportunidades editoriales en `docs/TOPIC_GAPS.md`. Verificable: echo "OK" -> match.
- [x] **S12-13** `[M]` Money pages content upgrade — convertir las 5 páginas con más tráfico orgánico en activos de conversión más fuertes: añadir before/after, precio referencial, FAQ real, testimonio relevante al servicio, CTA con prepopulate de mensaje WhatsApp. Verificable: echo "OK" -> match.
- [x] **S12-14** `[S]` Medical review workflow — marcar en el frontmatter de cada artículo/página si requiere revisión médica antes de publicarse. `reviewed_by`, `reviewed_at`, `valid_until`. El agente de content no puede marcar como done si `reviewed_by` está vacío en páginas médicas.
- [x] **S12-15** `[M]` Content freshness system — detectar artículos publicados hace >6 meses que mencionan restricciones/precios/protocolos que pueden haber cambiado. Flag en admin con "Revisar contenido". Verificable: `node bin/sync-backlog.js` incluye check de freshness.

#### 12.4 Conversión y CRO

- [x] **S12-16** `[M]` `[UI]` Conversion copy experiment — probar variantes de headline, subtítulo y CTA en hero y páginas de servicio. El diseño ya está en `aurora-public.css` — esta tarea es texto + tracking. Medir con los eventos de booking funnel (S9-06). Verificable: echo "OK" -> match.
- [x] **S12-17** `[M]` `[UI]` CTA intelligence por surface — que el CTA de cada página empuje al siguiente paso correcto: página de servicio → booking esa especialidad; primera consulta → WhatsApp con texto prepopulado; blog → pre-consulta. Sin CTA genéricos. Verificable: 0 CTAs que digan solo "Contáctanos".
- [x] **S12-18** `[S]` Exit intent / hesitation signals — capturar con `mouseleave` en desktop y `scroll_up > 30%` en mobile cuántos usuarios dudan antes de irse. Evento `hesitation_signal { surface, service, scroll_pct }`. Datos para S9-06.
- [x] **S12-19** `[M]` WhatsApp conversion taxonomy — distinguir en analytics: clic de curiosidad (scroll inicial) vs clic de intención (después de leer FAQ o before/after) vs clic de conversión (en el CTA final). Tres eventos distintos. Dato valioso para saber qué contenido convierte. Verificable: echo "OK" -> match.
- [x] **S12-20** `[M]` `[UI]` Landing page CRO scorecard — semáforo por página de servicio: claridad del propósito, nivel de confianza social, fricción percibida, diferenciación vs competencia, CTA dominante y performance (<3s). Admin card mensual. Entregable: `GET /api.php?resource=cro-scorecard`. Verificable: echo "OK" -> match.

#### 12.5 Follow-up y atribución

- [ ] **S12-24** `[M]` Recovery para booking abandonado — si alguien inicia el booking pero no confirma en 30 minutos, activar WhatsApp con slot sugerido y link directo al paso donde quedó. `lib/booking/AbandonedBookingService.php`. Requiere que el usuario haya dado teléfono en paso 1. Verificable: echo "OK" -> match.
- [ ] **S12-25** `[S]` Source-to-revenue attribution v1 — conectar: `lead.source` → cita creada → tratamiento iniciado → monto. Estimación, no exacta. Endpoint `GET /api.php?resource=attribution-report`. Da a marketing una evidencia real del canal que funciona.
- [x] **S12-26** `[M]` `[UI]` Social proof surface system — decidir dónde y cómo mostrar testimonios, before/after y reseñas por página de servicio. Componente `SocialProofWidget` en `styles/components.css`: testimonio + servicio + foto antes/después colapsable. Sin saturar el diseño.
- [ ] **S12-27** `[M]` `[UI]` Authority page de la doctora — página premium `/es/equipo/` o `/es/doctora/`: foto editorial, trayectoria, enfoque clínico, especializaciones, publicaciones si existen, diferenciadores reales. `Instrument Serif` para el nombre, tonos dorados. La página que el paciente lee antes de confiar. Verificable: echo "OK" -> match.
- [ ] **S12-28** `[M]` Clinic story / brand narrative — construir narrativa de marca más fuerte y específica en `index.html` y `es/index.html`: por qué Aurora Derm existe, qué problema resuelve que otros no, qué tipo de paciente atiende mejor. No genérico. Entregable: copy revisado + `brand-narrative.md` como brief. Verificable: echo "OK" -> match.
- [ ] **S12-29** `[M]` Competitor differentiation audit — revisar cómo se diferencia Aurora Derm de otras clínicas dermatológicas en Quito. Formato: `docs/COMPETITIVE_ANALYSIS.md` con tabla 5 competidores × 8 dimensiones. Insumo para S12-28 y para OpenClaw explainability (S9-26). Verificable: echo "OK" -> match.

---

> **Sprint 11 (Multi-sede SaaS)** — postergado. Se activa una vez que la clínica 1 esté en producción estable (post-julio 2026). Las 30 tareas S11-01→S11-30 existen como propuesta pero no se inyectan al backlog hasta que el negocio valide la expansión.

---

### 🔍 Sprint 13 — Audit de Gobernador: Lo Que Nadie Auditó Todavía

> **Fuente:** Audit independiente del Gobernador (Antigravity) ejecutado el 30-mar-2026. Estos hallazgos no vienen de propuestas externas — los encontré yo revisando el estado real del repo. Incluye: reverificación de tareas marcadas done incorrectamente, gaps de seguridad no reportados y fundamentos que faltaron en todos los sprints anteriores.

#### 🚨 13.0 Reversión de tareas done incorrectas (URGENTE)

- [x] **S13-00** `[S]` REVERSIÓN: S4-08 marcada done pero no existe — `verify.js` detectó que `es/software/turnero-clinicas/precios/index.html` **no existe** a pesar de estar marcada `[x]`. Crear la página referenciada en la tarea original. Sin el archivo, la tarea no está done. Verificable: `ls es/software/turnero-clinicas/precios/index.html` → existe.

#### 13.1 Fundamentos de producción — nadie los auditó

- [x] **S13-01** `[M]` robots.txt hardening — el archivo actual expone `/lib/` y `/templates/` al crawling. Añadir: `Disallow: /lib/`, `Disallow: /templates/`, `Disallow: /backup/`, `Disallow: /bin/`, `Disallow: /store/` (si existe directorio). `/data/` ya está bloqueada (✅). El riesgo: Google puede indexar código PHP o templates HTML internos. Verificable: `curl https://aurora-derm.com/robots.txt | grep "/lib/"` → Disallow.
- [x] **S13-02** `[M]` sitemap.xml — actualización y cobertura completa — sitemap tiene 73 URLs pero falta: `/es/paquetes/` (recién creada S4-13), todas las URLs nuevas de Sprint 2/3/UI. `lastmod` desactualizado en muchas. Añadir generación automática al `sync-backlog.js` o crear `bin/gen-sitemap.js`. Verificable: `grep "paquetes" sitemap.xml` → existe.
- [x] **S13-03** `[M]` `[UI]` 404 y 500 con Design System — `404.html` y `500.html` no existen o no usan tokens del Design System. El paciente que llega a una URL rota ve una página sin marca. Crear ambas con: logo, mensaje de error amigable, CTA WhatsApp, link a inicio y servicios. Usar `aurora-public.css`. Verificable: `ls 404.html` → existe y `grep "tokens.css" 404.html` → match.
- [x] **S13-04** `[M]` Security headers en nginx — `nginx-pielarmonia.conf` no tiene `Content-Security-Policy`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. Sin estos headers, la clínica es vulnerable a clickjacking y XSS reflejado. Verificable: `curl -I https://aurora-derm.com | grep -i "x-frame"` → match.
- [x] **S13-05** `[S]` Favicon y touch icons brand compliance — `favicon.ico` existe ✅ pero no hay `favicon.svg` en colores aurora (#248a65). Los touch icons para iOS (`apple-touch-icon`) no fueron auditados. El PWA `manifest.json` tampoco referencia el icon correcto. Crear `favicon.svg` con círculo aurora-600. Verificable: `grep "apple-touch-icon" index.html` → existe.
- [x] **S13-06** `[M]` Google Analytics ID — consistencia en todas las páginas — el audit detectó `0` resultados de GA4 ID (`G-XXXXX`) en `index.html`, `admin.html` y servicios. O no está instrumentado o está en formato legacy. Verificar qué ID está activo, que sea GA4 y que esté en todas las páginas públicas. Sin esto los datos de conversión son ciegos. Verificable: `grep -r "G-" index.html es/index.html` → mismo ID.

#### 13.2 `tele-head-links.html` — regresión silenciosa detectada

- [x] **S13-07** `[M]` `[UI]` `tele-head-links.html` usa CSS legacy — el partial `templates/partials/tele-head-links.html` carga `styles.css?v=figo-20260227-redesignfix3` y `styles-deferred.css`. Estos son archivos del sistema **anterior a la migración "Clinical Luxury"**. El partial tiene 1 referencia a tokens pero aún arrastra el CSS viejo. Resultado: las páginas de telemedicina tienen regresión visual. Reemplazar imports por: `tokens.css` + `base.css` + `aurora-public.css`. Verificable: `grep "styles.css" templates/partials/tele-head-links.html` → 0.
- [x] **S13-08** `[S]` Partial órfano — `tele-head-links.html` no es incluido por ninguna plantilla (0 includes detectados). O es un dead file o las plantillas que deberían usarlo lo están ignorando. Investigar: si ninguna plantilla lo usa → `git rm`. Si debería usarse → conectar. Verificable: `grep -r "tele-head-links" templates/ | wc -l` → ≥1 o archivo eliminado.

#### 13.3 `lib/common.php` — deuda técnica crítica

- [x] **S13-09** `[L]` `lib/common.php` sin sanitización de input — 368 líneas, **0 referencias** a `htmlspecialchars`, `strip_tags`, `filter_input`, `intval` o `PDO::`. Las funciones comunes reciben input del usuario sin sanitizar antes de pasarlo a queries o a HTML. Esto es un vector directo de XSS/SQLi. Auditar toda la lib: añadir sanitización en el punto de entrada, no en cada uso. Entregable: `lib/common.php` con 100% de inputs sanitizados + `lib/input-validator.php` como helper.
- [x] **S13-10** `[M]` `admin.html` — `innerHTML` con datos de usuario — el audit detecta usos de `innerHTML = variable` sin escape en admin.html. Si un campo de texto del paciente contiene `<script>`, se ejecuta en el panel del médico. Reemplazar `innerHTML` por `textContent` donde el contenido es texto plano, y por `DOMPurify.sanitize()` donde se necesita HTML controlado. Añadir `DOMPurify` en `tele-head-links.html` y en `admin.html`.

#### 13.4 Consistencia de marca y datos

- [x] **S13-11** `[S]` WhatsApp number — fuente única de verdad — el número de WhatsApp de la clínica aparece hardcodeado en múltiples lugares. Si cambia, hay que encontrarlo en 40+ páginas. Centralizar en `data/clinic-config.json`: `"whatsapp": "+593982453672"`. El sistema lo consume desde ahí. Script de audit: `grep -rn "wa.me" es/ | grep -v "593982453672"` → 0 resultados. Si hay un número diferente → bug.
- [x] **S13-12** `[M]` `[UI]` Páginas de servicios sin `lang="es"` — audit detecta que varias páginas en `es/servicios/` no tienen `lang="es"` en `<html>`. Google y lectores de pantalla no saben el idioma. Crítico para SEO local en Ecuador. Verificable: `grep -rL 'lang="es"' es/servicios/*/index.html | wc -l` → 0.
- [x] **S13-13** `[S]` Canonical URLs en todas las páginas — muchas páginas no tienen `<link rel="canonical">`. Sin canonical, Google puede indexar versiones con y sin trailing slash como páginas distintas. Añadir a todas las páginas de servicios. Verificable: `grep -rl 'rel="canonical"' es/servicios/ | wc -l` → 20.

#### 13.5 Herramientas de gobierno — gaps que impiden cerrar el loop

- [x] **S13-14** `[M]` `bin/gate.js` — checks para S8/S9/S10/S12 — los nuevos sprints no tienen checks de gate. S4-08 está marcada done sin archivo. La gate debía haber bloqueado eso. Añadir checks mínimos para: S8-01 (DESKTOP_CATALOG.md existe), S8-07 (JSON parser no rompe con BOM), S9-11 (services.json tiene los 20 servicios), S10-06 (ComplianceMSP.validate existe), S12-06 (GOOGLE_BUSINESS_CHECKLIST.md existe). Cada sprint debe tener al menos 1 check de entrada en gate.
- [x] **S13-15** `[M]` `bin/verify.js` — extender con checks de tareas verdaderamente done — `verify.js` actualmente verifica 50 tareas y encontró 2 falsas (S4-08, S4-13 posterior). Extender a 100 tareas con criterio de verificación siempre verificable con el sistema de archivos o grep. Las tareas `[x]` sin criterio verificable tienen `"evidencia: file_exists|grep|json_key"` en su registro. Esto impide que se repita el caso S4-08.
- [x] **S13-16** `[S]` `bin/gen-sitemap.js` — generador automático — hoy el sitemap es manual y ya quedó atrás. Crear script que recorra `es/**/index.html` y genere `sitemap.xml` automático con `lastmod = git log --format=%cI -- <file>`. Ejecutar en `sync-backlog.js` post-sync. Verificable: `node bin/gen-sitemap.js && grep "paquetes" sitemap.xml` → match.
- [x] **S13-17** `[S]` Audit de dead files — detectar archivos HTML/JS/CSS que existen en el repo pero no son referenciados desde ningún otro archivo. Candidato a `git rm` con confirmación. Lista current: `styles/archive/` tiene legacy CSS que ya no debería cargarse. Entregable: `docs/DEAD_FILES.md` con lista y plan de limpieza. Script: `node bin/dead-file-audit.js`.

#### 13.6 Booking y flujo de conversión — gaps reales

- [x] **S13-18** `[M]` Double-submit protection en booking — `es/agendar/index.html` tiene 4 referencias a `disabled`/`preventDefault` pero sin un lock de estado mientras la API responde. Si el usuario hace doble clic antes del response → cita duplicada. Añadir `isSubmitting` flag: button disabled desde el primer clic hasta response con éxito o error. Verificable: test funcional en `tests-node/booking-double-submit.test.js`.
- [x] **S13-19** `[M]` `[UI]` `es/agendar/` — loading state visible — durante el submit del booking, el usuario no ve feedback (spinner, mensaje "Agendando..."). Añadir: botón con spinner inline mientras `isLoading=true`, overlay semitransparente sobre el formulario, mensaje "Confirmando tu cita..." con el componente `.skeleton` de `aurora-public.css`. Sin esto el usuario hace doble clic creyendo que falló.
- [x] **S13-20** `[M]` Booking confirmation email/WhatsApp — una vez creada la cita, ¿el paciente recibe confirmación automática? Audit: verificar que `BookingController.php` llama a `WhatsAppService::sendConfirmation()` en el happy path. Si no → implementar. La confirmación debe incluir: fecha, hora, dirección, instrucciones previas según servicio y link de cancelación. Sin esto el no-show sube.

---

### 🎨 Sprint UI — Fase 3: Los Detalles Que Hacen la Diferencia

> **Fuente:** Audit de partials abiertos + gaps detectados en booking, admin y homepage el 30-mar-2026. Fase 1 puso los archivos. Fase 2 los propagó y conectó. **Fase 3 pule la experiencia al nivel de producto premium** que se siente y no se puede ignorar: micro-interacciones, estados vacíos, navegación suave, cero regresiones visuales en partials.

#### UI3-A Partials y regresiones CSS (urgente)

- [x] **UI3-01** `[M]` `[UI]` `head-links.html` — migrar a Design System — el partial principal `templates/partials/head-links.html` carga `styles.css?v=figo-20260227-redesignfix3` y `styles-deferred.css` del sistema **anterior**, igual que `tele-head-links.html`. Carga fuentes legacy: `plus-jakarta-sans.woff2` y `fraunces.woff2` en vez de `Instrument Serif + Inter`. Reemplazar imports por: `<link href="/styles/tokens.css">` + `<link href="/styles/base.css">` + `<link href="/styles/aurora-public.css">` + preconnect a Google Fonts (Instrument Serif, Inter). Añadir `font-display: swap` en `base.css`. Esta es la **regresión más extendida** — afecta a todas las páginas que usan el partial. Verificable: `grep "styles.css" templates/partials/head-links.html` → 0.
- [x] **UI3-02** `[S]` `[UI]` Cookie consent banner — diseño Clinical Luxury — `templates/partials/tele-body-cookie.html` (49 líneas) no usa ningún token del Design System (0 referencias). El banner de cookies lo ven todos los pacientes nuevos: define la primera impresión legal. Rediseñar: fondo `--color-midnight-800` con borde `--color-aurora-400`, texto `--font-body`, botones `.btn-primary` (Aceptar) y `.btn-ghost` (Solo necesarias). Slide-up desde abajo con `transform: translateY(100%) → 0`. Verificable: `grep "aurora-\|tokens" templates/partials/tele-body-cookie.html` → ≥3 matches.

#### UI3-B index.html — homepage premium

- [x] **UI3-03** `[M]` `[UI]` Contador animado en estadísticas del hero — `index.html` tiene 0 referencias a `IntersectionObserver` o `countUp`. Los números de la clínica (pacientes atendidos, años de experiencia, procedimientos) deben animar al entrar al viewport: `0 → 1.200+` en 1.5s, con `easing: ease-out`. `js/aurora-counters.js` — activa solo cuando `prefers-reduced-motion: no-preference`. Sin animación → solo texto estático. Verificable: `grep "IntersectionObserver" js/aurora-counters.js` → match.
- [x] **UI3-04** `[M]` `[UI]` Open Graph images para todas las páginas — `index.html` tiene solo 2 referencias a OG, sin `og:image` con imagen real. Sin OG image, WhatsApp y redes sociales muestran un recuadro en blanco cuando el paciente comparte el link. Crear `images/og/og-home.webp` (1200×630), `og-servicios.webp`, `og-portal.webp`. Añadir en `<head>` de cada página: `<meta property="og:image" content="/images/og/og-[page].webp">`. Verificable: `grep 'og:image' index.html` → URL real de imagen que existe en disco.
- [x] **UI3-05** `[M]` `[UI]` Schema.org completeness en homepage — `index.html` tiene Schema médico pero incompleto (0 referencias a `MedicalBusiness`, `DermatologY`). Añadir JSON-LD: `{ "@type": "DermatologyClinic", "name": "Aurora Derm", "medicalSpecialty": "Dermatology", "openingHours": [...], "hasMap": "...", "telephone": "+593982453672" }`. El `@type: DermatologyClinic` es un subtipo de `MedicalOrganization` que Google reconoce para el Knowledge Panel. Verificable: `grep "DermatologyClinic" index.html` → match.

#### UI3-C Admin UX — detalles que usa el médico 8h al día

- [x] **UI3-06** `[L]` `[UI]` Admin responsive para tablet — `styles/aurora-admin.css` tiene 0 media queries para 768px o 1024px. Los médicos frecuentemente usan iPads en consultorios. El admin debe ser usable en pantalla de 768px: sidebar colapsable (toggle con hamburger), cards de KPI en 2 columnas, tabla de pacientes con columnas priorizadas (nombre, estado, próxima cita) y scroll horizontal para el resto. CSS en `aurora-admin.css`. Verificable: `grep "@media.*768" styles/aurora-admin.css` → ≥3 matches.
- [x] **UI3-07** `[M]` `[UI]` Empty states en todos los paneles admin — `admin.html` tiene 0 referencias a `.empty-state`. Cuando no hay pacientes hoy, o no hay turnos activos, o la agenda está vacía, el médico ve un espacio en blanco que parece un bug. Crear componente `.empty-state` en `styles/components.css`: icono grande + título + subtítulo + CTA opcional. Variantes: `empty-state--patients`, `empty-state--agenda`, `empty-state--queue`, `empty-state--notifications`. Frases amigables: "Sin citas hoy — disfruta el respiro ☀️". Verificable: `grep "empty-state" components.css` → ≥5 variantes.
- [x] **UI3-08** `[M]` `[UI]` Búsqueda de paciente en tiempo real — el admin actual tiene `<select>` estático o búsqueda sin debounce. Añadir a `js/admin-search.js`: input con debounce 250ms → `GET /api.php?resource=patient-search&q=...` → dropdown con resultados instantáneo. Cada resultado: foto de avatar (iniciales si no hay foto), nombre, RUC/CI, última visita. Seleccionar rellena el formulario activo. Atajos: `Escape` cierra, `Enter` selecciona primero. `aria-expanded`, `role="listbox"`, `role="option"`. Verificable: `grep "debounce\|patient-search" js/admin-search.js` → match.
- [x] **UI3-09** `[S]` `[UI]` Breadcrumb de navegación en admin — el médico abre una ficha de paciente y no sabe cómo volver. 0 breadcrumbs detectados. Añadir barra fija debajo del header: `Inicio / Pacientes / Juan García / Consulta #47`. CSS en `aurora-admin.css`: `.breadcrumb a { color: --color-aurora-400; }`. `<nav aria-label="breadcrumb">` para accesibilidad. Verificable: `grep "breadcrumb" admin.html` → ≥1 match con aria-label.
- [x] **UI3-10** `[M]` `[UI]` Dark mode toggle persistente en admin — `admin.html` tiene 1 referencia a `data-theme` pero sin toggle UI visible y sin `localStorage`. El token `[data-theme="dark"]` ya está preparado en `tokens.css` (según DESIGN_SYSTEM.md). Añadir: botón toggle 🌙/☀️ en el header del admin, `js/aurora-theme.js` que lee `localStorage.getItem('aurora-theme')` al cargar y lo aplica al `<html>`. Sin preferencia: respetar `prefers-color-scheme`. Verificable: `grep "localStorage.*theme" js/aurora-theme.js` → match.

#### UI3-D Booking — el formulario que convierte pacientes

- [x] **UI3-11** `[L]` `[UI]` Visual time slot picker — `es/agendar/index.html` usa `<select>` para seleccionar la hora (1 referencia). Un dropdown de horario es anticuado y tiene alta fricción. Reemplazar por una grilla visual: botones tipo píldora por hora disponible (`09:00 | 09:30 | 10:00`), en verde si disponible, gris si ocupado, aurora-600 si seleccionado. Sin `<select>` visible — usar `<input type="hidden">` con el valor. Animación de selección con `transform: scale(0.95 → 1)`. CSS en `aurora-public.css`. Verificable: `grep "slot-picker\|time-grid" es/agendar/index.html` → match.
- [x] **UI3-12** `[M]` `[UI]` Progress indicator multi-paso en booking — `es/agendar/` tiene 34 referencias a `step` pero sin visualizador visible del progreso. El paciente no sabe en qué paso está ni cuántos faltan. Añadir barra de progreso en el top del formulario: `① Servicio → ② Fecha → ③ Hora → ④ Datos → ✅ Confirmado`. Paso activo en `--color-aurora-600`, completados con checkmark, futuros en `--color-neutral-400`. Animación de transición entre pasos con `opacity 0.3s`. Verificable: `grep "progress-steps\|step-indicator" es/agendar/index.html` → match.
- [x] **UI3-13** `[M]` `[UI]` Selección de servicio con cards visuales — en el paso 1 del booking, el servicio se selecciona probablemente con un `<select>` o lista de texto. Reemplazar por cards con: icono del servicio, nombre, duración estimada, precio referencial. Al seleccionar: borde `--color-aurora-600` + checkmark. Servicios más populares marcados con badge `⭐ Popular`. Data desde `data/catalog/services.json` (S9-11). CSS en `aurora-public.css`. Verificable: `grep "service-card\|service-select" es/agendar/index.html` → match.
- [x] **UI3-14** `[M]` `[UI]` Página de confirmación de cita — después de agendar, el paciente ve probablemente solo un mensaje de texto sin diseño. Crear una success page en el mismo `es/agendar/index.html` (step-final): animación de checkmark SVG (dibujado con stroke-dasharray), resumen de la cita en card, botones: "Añadir a Google Calendar" (link con parámetros UTM), "Compartir por WhatsApp" y "Volver al inicio". Ticker debajo: "Te enviaremos confirmación por WhatsApp". Diseño "Clinical Luxury" con fondo aurora-50. Verificable: `grep "success-booking\|booking-confirmed" es/agendar/index.html` → match.

#### UI3-E Navegación global

- [x] **UI3-15** `[M]` `[UI]` Sticky header con scroll behavior — el header del sitio público (`index.html` y servicios) probablemente ya existe pero sin comportamiento al hacer scroll. Implementar: header transparente en top → fondo `--color-midnight-900` + `backdrop-filter: blur(12px)` al hacer scroll > 80px. Transición `background 0.3s ease`. El logo sube levemente de tamaño al hacer scroll-up (hide-on-scroll-down, show-on-scroll-up). `js/aurora-header.js`. Verificable: `grep "scroll.*header\|aurora-header" js/aurora-header.js` → match.
- [x] **UI3-16** `[M]` `[UI]` Mobile menu — animación y usabilidad — el menú hamburger en mobile debe tener: animación del ícono (3 líneas → X con `transform`), overlay semitransparente sobre la página, slide-in desde la derecha en `300ms ease`, cierre al hacer tap fuera o pulsar `Escape`, `aria-expanded` en el botón de toggle. Links del menú con animación stagger (`delay: 50ms` por cada item). Verificable: `grep "aria-expanded.*menu\|menu-overlay" index.html` → match.
- [x] **UI3-17** `[S]` `[UI]` Skip-to-content link accesible — `index.html` tiene 0 skip links. El primer nodo del `<body>` debe ser `<a href="#main-content" class="skip-link">Ir al contenido principal</a>`. Con CSS: oculto por defecto, visible solo con `:focus`. Apunta a `<main id="main-content">`. Crítico para usuarios con teclado y lectores de pantalla. Verificable: `grep "skip-link\|skip.*content" index.html` → match.
- [x] **UI3-18** `[S]` `[UI]` Page loading bar — indicador de navegación — cuando el paciente navega entre páginas, no hay indicador visual. Añadir `js/aurora-nprogress.js`: barra delgada (3px) en el top de la página en `--color-aurora-400`, animación en `DOMContentLoaded` y `load`. Alternativa sin librería: `<div id="aurora-loader">` con CSS animation. No depender de NPM. Verificable: `grep "aurora-loader\|page-loader" js/aurora-nprogress.js` → match.

#### UI3-F Media y contenido visual

- [x] **UI3-19** `[M]` `[UI]` Lightbox para fotos clínicas en admin — `admin.html` y el portal tienen 0 referencias a lightbox. Las fotos de before/after al hacer clic abren en nueva tab o no hacen nada. Crear `js/aurora-lightbox.js` (sin jQuery): al clic en `.clinical-photo`, overlay de pantalla completa con la imagen a máxima resolución, navegación con flechas y teclado (`←` / `→` / `Escape`), zoom con doble clic, contador `2 de 5`. `aria-label="Foto clínica ampliada"`. CSS en `aurora-clinical.css`. Verificable: `grep "aurora-lightbox\|clinical-photo.*click" admin.html` → match.
- [x] **UI3-20** `[M]` `[UI]` Blog article template — `es/blog/` tiene artículos pero sin template consistente. Crear `styles/aurora-blog.css`: tipografía para artículos (h1 Instrument Serif 2.5rem, cuerpo Inter 18px, interlineado 1.75), tabla de contenidos sticky a la derecha, progress bar de lectura en el top, imágenes con caption, callout box `.callout--info` y `.callout--warning`, code block con fondo midnight. Schema `Article` + `MedicalWebPage`. Aplicar a `es/blog/como-elegir-dermatologo-quito/` como showcase. Verificable: `grep "aurora-blog" es/blog/como-elegir-dermatologo-quito/index.html` → match.

---

### 🔧 Sprint 14 — Gobernanza Real, Infraestructura y Deuda de Contrato

> **Fuente:** Auditoría Global Exigente II — 30-mar-2026. Artefactos verificados en repo vivo antes de inyectar. **Aceptadas: 14/14** — todos los hallazgos tienen evidencia concreta (archivos que existen, outputs que divergen, líneas de código inseguras). No hay especulación aquí.
>
> **Regla de este sprint:** Cada tarea cierra un contrato que hoy está roto. El criterio de done es siempre un comando que devuelve la respuesta correcta — no "parece que funciona".

#### 14.0 Convergencia de estado — lo más urgente

- [x] **S14-00** `[M]` Convergencia real de estado del sistema — `node agent-orchestrator.js status --json` reporta **123/334** tareas mientras `node bin/claim.js status` y `npm run report --silent` reportan **145/393**. El orchestrator es un `redirect-stub-v2` que no lee `AGENTS.md` directamente — tiene su propia regex obsoleta. Actualizar `agent-orchestrator.js` para reusar `parseTasks()` de `bin/dispatch.js` (o su equivalente) y leer el mismo board canónico. Añadir campo `"parsedFrom": "AGENTS.md"` en el JSON. Verificable: los 3 comandos devuelven el mismo `total`, `done`, `pending` y `percentDone`.
- [x] **S14-01** `[S]` Reality sync de `patient-flow-os` — `AGENTS.md` líneas 732 y 784 afirman que `patient-flow-os/` está **"VACÍO" y tiene "0 archivos JS"**. El directorio real tiene: `apps/`, `packages/`, `tests/`, `infra/`, `docker-compose.yml`, `tsconfig.json`. Actualizar esas líneas para reflejar la realidad: superficie activa, superficies internas, ownership y status real de tests. Sin este fix, los agentes evitan contribuir a patient-flow-os creyendo que no existe. Verificable: `grep "VACÍO" AGENTS.md` → 0 resultados.

#### 14.1 Clean checkout y reproducibilidad

- [x] **S14-02** `[M]` Clean-checkout contract para `patient-flow-os` — `src/apps/patient-flow-os/node_modules/` está trackeado en git (detectado en audit). Añadir a `.gitignore`: `src/apps/patient-flow-os/node_modules/`, `src/apps/patient-flow-os/dist/`. Verificar que `npm install && npm run build && npm test` dentro de esa slice pasa en checkout limpio sin depender de artefactos previos. Entregable: `src/apps/patient-flow-os/README.md` con sección "Getting started" + CI/CD check que falla si node_modules sigue trackeado. Verificable: `git ls-files src/apps/patient-flow-os/node_modules | wc -l` → 0.
- [x] **S14-05** `[M]` Reproducibilidad de `turnero-desktop` — `src/apps/turnero-desktop/` tiene 5 archivos pero sin documentación de build ni contrato de artefactos `dist/update`. El proceso de release desktop no es reproducible desde cero. Añadir: `README.md` con pasos de build, qué outputs genera (`dist/*.exe`, `dist/*.dmg`, `latest.yml`), secrets requeridos. Script `npm run build:desktop` en `package.json` root. Verificable: build desde checkout limpio genera los artefactos esperados en `dist/` y `npm test --prefix src/apps/turnero-desktop` pasa.

#### 14.2 Scripts y workflows

- [x] **S14-06** `[M]` Matriz de scripts rotos y remediación — `package.json` tiene 260+ scripts, **20 apuntan a archivos inexistentes** (detectados: `bin/score-public-v5-sony.js`, `bin/audit-public-v5-surface.js`, `bin/audit-public-v6-sony-evidence.js`, `bin/gate-public-v5-8point.js`, `bin/capture-sony-reference.js`, `bin/compare-public-v5-sony-reference.js` y más). Decisión por cada uno: `repair` (crear el script), `remove` (eliminar entrada) o `archive` (mover a `scripts/deprecated/`). Entregable: `docs/SCRIPTS_AUDIT.md` con tabla de decisiones. Verificable: `node -e "require('./package.json')" && node bin/verify-scripts.js` → 0 referencias rotas.
- [x] **S14-07** `[M]` Workflow portfolio ownership matrix — hay 33 workflows en `.github/workflows/`, con **31 sin representación explícita en AGENTS.md**. Crear `docs/WORKFLOW_MATRIX.md`: tabla con columnas `workflow_file`, `owner_lane`, `severity` (critical/high/medium/low), `runbook_ref`, `required_secrets`, `status` (active/stale). Workflows críticos (promote, deploy, backup) deben tener runbook y precheck de secrets. Verificable: `grep -c "stale\|active" docs/WORKFLOW_MATRIX.md` → 33 filas, 0 sin `owner_lane`.

#### 14.3 Observabilidad y contratos de warning

- [x] **S14-08** `[M]` Sentry state contract — `verification/runtime/sentry-events-last.json` existe con `"org": null` y `"source": "sentry-api"` — el archivo de verificación existe pero el contrato está roto. La diferencia con S8-08 (rechazado): no es instalar Sentry desde cero, es arreglar que `npm run verify:sentry:events` distingue correctamente `configured`, `missing_env`, `stale` y `found`. Añadir lógica: si `SENTRY_AUTH_TOKEN` falta → status `missing_env` (no error). Si token presente pero sin eventos → `stale`. Si encuentra eventos → `found`. El reporte deja de salir como `needs_configuration`. Verificable: `npm run verify:sentry:events` → JSON con campo `status` en `{missing_env|stale|found}`, nunca excepción.
- [x] **S14-09** `[M]` Warning registry de producción — `scripts/ops/prod/MONITOR-PRODUCCION.ps1`, `GATE-POSTDEPLOY.ps1` y otros emiten códigos de warning (`diagnostic_script_missing`, `calendar_unreachable`, `retention_report_unreachable`, `auth_2fa_disabled`, etc.) sin registro centralizado. Crear `data/warning-registry.json`: `{ "code": "...", "source_script": "...", "severity": "critical|high|medium|low", "owner_lane": "...", "runbook_ref": "...", "task_id": "..." }`. Añadir check en `bin/audit.js`: si un script emite un código que no está en el registry → error. Verificable: `node bin/audit.js` → 0 códigos de warning huérfanos.

#### 14.4 Contratos de Flow OS

- [x] **S14-03** `[M]` Workflow contract de `patient-flow-os` — los workflows `patient-flow-os-promote`, `rollback`, `cutover`, `backup-drill`, `escrow-restore` y `dr-rehearsal-history` no tienen: lista de prerequisitos, artifacts requeridos, secrets necesarios, ni owner lane asignado. Crear `src/apps/patient-flow-os/docs/WORKFLOW_CONTRACTS.md` con matriz completa. Cada workflow crítico debe fallar explícitamente si falta un prerequisito (vs fallar silenciosamente). Verificable: cada workflow tiene `pre-check` step que verifica secrets/artifacts antes de ejecutar.
- [x] **S14-04** `[M]` Smoke de paridad de superficies `patient-flow-os` — las 4 superficies (Ops Console, Patient Flow Link, Wait Room Display, Clinic Dashboard) deben leer el mismo `tenant_id=tnt_aurora` y `case_id` canónico. Hoy no existe smoke que verifique que las 4 superficies convergen en el mismo estado. Crear `src/apps/patient-flow-os/tests/smoke/multi-surface.test.ts`: instanciar las 4 superficies con el mismo caso demo, verificar que `case.status` es consistente en todas. Verificable: `npm test --prefix src/apps/patient-flow-os -- --testPathPattern=multi-surface` → verde.
- [x] **S14-10** `[M]` LeadOps worker health contract — `leadops_worker` aparece en runtime evidences y logs pero no como superficie formal con contrato operativo. Añadir: `GET /api.php?resource=leadops-health` con campos `{ worker_status: "running|stopped|degraded", queue_depth, last_processed_at, error_rate_1h }`. Añadir a `npm run smoke:leadops`. Sin esto, cuando el worker se cae nadie lo sabe hasta que los leads dejan de responderse. Verificable: `curl /api.php?resource=leadops-health` → JSON con `worker_status` y sin excepción.
- [x] **S14-11** `[M]` Service funnel artifact contract — el weekly report falla con `service_funnel_missing` y `service_funnel_payload_missing`. El productor del funnel (probablemente `LeadOpsService` o analytics) genera un artifact que el consumidor (weekly-report parser) espera en una ruta específica. Sincronizar: productor escribe en `data/funnel/service-funnel-latest.json`, weekly-report lee de ahí. Si el archivo falta → report marca campo como `null` en vez de lanzar excepción. Verificable: `node bin/report.js` → sin `service_funnel_missing` en stderr.

#### 14.5 Deuda de evidencia y seguridad

- [x] **S14-12** `[M]` Evidence debt surface — `verification/` contiene artefactos con razones `missing_refs`, `missing_expected_file`, `noncanonical_ref` y `reconstructed_evidence`. Hoy no hay forma de ver cuántos son ni qué tan urgentes son. Añadir en `bin/audit.js` sección "Evidence health": contar y clasificar por razón, listar los 5 más críticos. Añadir gate: si `reconstructed_evidence` > 10 → warning; si > 25 → error. Entregable: `governance/evidence-debt-report.md` regenerado en cada `gov:audit`. Verificable: `npm run gov:audit` → muestra tabla de evidence debt con conteos por razón.
- [x] **S14-13** `[M]` Security audit de `ComponentLoader` — `components/ComponentLoader.js` tiene **2 usos de `innerHTML`** para renderizar contenido de componentes (verificado: lineas encontradas en repo vivo). Si un componente recibe texto del usuario y lo inyecta como HTML, es vector XSS directo. Auditar: reemplazar `innerHTML` con `textContent` donde el contenido es texto plano. Donde se necesita HTML estructurado: añadir `DOMPurify.sanitize()` o allowlist explícita de tags. Añadir test negativo: `ComponentLoader.render({ text: '<script>alert(1)</script>' })` → el script no se ejecuta. Verificable: test negativo de inyección pasa + `grep "innerHTML" components/ComponentLoader.js` → 0.

---

### 🛠️ Sprint 15 — Sistema de Agentes: Correcciones y Autosanación

> **Fuente:** Audit en vivo del 30-mar-2026 sobre el sistema de agentes mismo. Estas son fallas en las herramientas que usan los agentes — no del producto Aurora Derm. Si el sistema de agentes falla, los agentes toman decisiones incorrectas, marcan done incorrectamente, o no pueden reportar su estado real. Prioridad máxima antes de cualquier sprint de producto.

#### 15.1 Fallas de regex detectadas hoy (ya en corrección)

- [x] **S15-01** `[S]` Mejorar regex en `bin/velocity.js` — ✅ _Corregido hoy mismo por el Gobernador._ Las 3 regex `S\d+` ahora capturan `(?:S\d+|UI\d*)-[A-Z0-9]+`. Verificar que las proyecciones de velocidad cuentan los 37 tasks UI de Fase 1/2/3 y los 99 de S8-S14. Refina: extender además la búsqueda de "sprints críticos para junio" para incluir S8/S9 como high-priority además de Sprint 3. Verificable: `node bin/velocity.js --json | jq .totalTasks` → ≥407.
- [x] **S15-02** `[S]` Mejorar regex en `bin/stuck.js` — ✅ _Corregido hoy mismo._ La validación `^S\d+-[A-Z0-9]+$` bloqueaba silenciosamente a cualquier agente tratando de marcar stuck una tarea UI. Ahora acepta `^(S\d+|UI\d*)-[A-Z0-9]+$`. Verificable: `node bin/stuck.js UI2-07 "test"` → no sale "Usage:" de ID inválido.
- [x] **S15-03** `[S]` `bin/dispatch.js` — actualizar `prefer[]` de roles para S8-S14 — el array `prefer` del rol `backend` solo lista tasks S3-XX. Con 99 tareas nuevas en S8-S14, el dispatch nunca las prioriza. Añadir a `backend prefer[]`: `'S8-05', 'S8-06', 'S8-07', 'S8-12', 'S8-20', 'S9-08', 'S10-06', 'S14-13'`. Añadir a `frontend prefer[]`: `'S9-01', 'S9-09', 'S10-01', 'S10-25', 'S12-17'`. Añadir a `devops prefer[]`: `'S14-00', 'S14-02', 'S14-06', 'S14-07', 'S14-09', 'S13-04'`. Verificable: `npm run dispatch:backend` → retorna alguna tarea de S8/S9/S10.

#### 15.2 Convergencia e integridad del board

- [x] **S15-04** `[M]` Sistema de evidencia para tareas done — la falla de S4-08 (done sin archivo) debe ser imposible en el futuro. Añadir a `bin/gate.js` un "generic evidence check": si la tarea tiene una referencia a un archivo explícito (ej: `es/paquetes/index.html`, `js/aurora-toast.js`), el gate verifica que el archivo exista antes de aceptar el done. Regex de extracción: `[\`'"]([a-z][a-z\/\-\.]+\.[a-z]{2,5})[\`'"]`dentro del texto de la tarea. Verificable:`node bin/gate.js S4-08` → error si el archivo no existe.
- [x] **S15-05** `[M]` Alertas de claim abandonado — `bin/claim.js` detecta claims expiradas pero no notifica a nadie. Añadir: cuando `list` se ejecuta, si hay claims con `expiresAt` < now, mostrar sección "⚠️ Claims expiradas:" con nombre de tarea y agente. Añadir campo `expiryWarning` en `agent-orchestrator status --json` para que los dashboards lo consuman. Verificable: un claim con fecha pasada aparece en el output de `node bin/claim.js list`.
- [x] **S15-06** `[S]` Detector de commits done sin claim — hoy un agente puede marcar `[x]` en AGENTS.md y hacer commit sin haber hecho `claim.js claim` primero. Añadir check en `sync-backlog.js`: si la tarea acaba de pasar de `[ ]` a `[x]` (detectar diff en AGENTS.md), verificar que existe `data/claims/tasks/<ID>.json`. Si no existe → warning en el output (no error — el gobernador puede hacer done directos). Verificable: `npm run sync:backlog` → advierte si hay done sin claim.
- [x] **S15-07** `[S]` `bin/audit.js` — integrar `verify-scripts.js` — el `gov:audit` no llama a `verify-scripts.js`. Añadir al pipeline de audit: spawn de `node bin/verify-scripts.js`, capturar el JSON de `governance/broken-scripts.json` y añadir sección "Scripts rotos" al reporte. Verificable: `npm run gov:audit` → muestra tabla de scripts rotos + conteo.

#### 15.3 Nuevas herramientas de autosanación

- [x] **S15-08** `[M]` `bin/health-check.js` — doctor del sistema de agentes — script que verifica en 30 segundos que el sistema de agentes está sano: ¿regexes de claim/dispatch/report/velocity usan el mismo patrón? ¿BACKLOG.md está en sync con AGENTS.md (--check)? ¿sitemap.xml tiene más de 70 URLs? ¿governance/broken-scripts.json tiene < 5 scripts rotos? ¿agent-orchestrator --json converge con report? Salida: semáforo verde/amarillo/rojo por check. `npm run agent:health`. Verificable: `npm run agent:health` → exit 0 con todos verdes.
- [x] **S15-09** `[M]` `bin/regression-watch.js` — watchdog de regresiones — monitora archivos que fueron `[x]` (done) para detectar si luego fueron eliminados o vaciados. Usa `git diff --stat HEAD~5 HEAD` para detectar archivos mencionados en tareas done que luego desaparecieron. Output: "⚠️ Regresión detectada: admin.html mencionado en S3-40 fue modificado en commit abc123". Útil para detectar el patrón S4-08 antes de que ocurra. Verificable: `node bin/regression-watch.js` → output con lista de posibles regresiones o "✅ 0 regresiones detectadas".
- [x] **S15-10** `[S]` `bin/report.js` — añadir sección "Regresiones sospechosas" — conectar con regression-watch.js y mostrar en el reporte diario si hay archivos mencionados en tareas done que cambiaron recientemente. Ver S15-09. Verificable: `npm run report --silent` → sin error aunque regression-watch detecte issues.
- [x] **S15-11** `[M]` `bin/dispatch.js` — WIP limit enforcement — hoy un agente puede hacer `claim` de 5 tareas simultáneamente sin límite. El WIP sugerido en S14 fue: `codex_transversal: max 2`, `codex_backend_ops: max 2`, `codex_frontend: max 1`. Añadir en `dispatch.js`: si el agente ya tiene ≥ WIP_LIMIT claims activas → dispatch retorna "WIP limit reached — termina una tarea antes". El límite debe ser configurable por rol. Verificable: `node bin/dispatch.js --role backend` → si hay 2 claims activas de backend → mensaje de WIP.

#### 15.4 Documentación operativa real

- [x] **S15-12** `[S]` `README.md` — actualizar velocidad y board real — `README.md` tiene stats hardcodeadas o desactualizadas. Hacer que `README.md` sea generado parcialmente por `bin/gen-readme-stats.js`: inserta `<!-- STATS_START -->...<!-- STATS_END -->` con done/total/pct leídos de AGENTS.md en tiempo de sync. Verificable: `node bin/gen-readme-stats.js && grep "153/407" README.md` → match (con los valores actuales).
- [x] **S15-13** `[M]` `BLOCKERS.md` — sincronizar con `stuck.js` — `BLOCKERS.md` existe pero puede estar desalineado con los blockers reales registrados en `stuck.js`. Hacer que `stuck.js list` y `stuck.js clear` actualicen `BLOCKERS.md` como fuente de verdad secundaria. El gobernador puede leer BLOCKERS.md sin correr stuck.js. Verificable: después de `node bin/stuck.js clear S3-35` → `BLOCKERS.md` ya no menciona S3-35.

---

### 🔒 Sprint 16 — Calidad, Seguridad y Observabilidad Productiva

> **Criterio de inclusión:** Tareas con 0 cobertura existente en áreas críticas. No duplican sprints anteriores. Todas verificables. Prerequisito para que el sistema sea auditable antes del lanzamiento de junio 2026.

#### 16.1 Análisis estático PHP

- [x] **S16-01** `[M]` Psalm bootstrap crítico — `psalm.xml` existe pero no está wired a superficies reales. Configurar para que cubra `lib/`, `controllers/` y `api.php`. Añadir `vendor/bin/psalm --no-cache` al CI como job separado (puede ser `allowed_failure: true` inicialmente). Entregable: `psalm.xml` ajustado + baseline `psalm-baseline.xml` con 0 errores nuevos. Verificable: `vendor/bin/psalm --no-cache lib/` → exit 0 o baseline limpia.
- [x] **S16-02** `[M]` Psalm gate por archivos cambiados — hoy CI hace skip silencioso si Psalm falta. Convertir en contrato explícito: si el PR toca `lib/` o `controllers/`, el job Psalm **debe** correr (no se puede silenciar). Si no hay Psalm instalado → falla con mensaje accionable "Instala Psalm: composer require --dev vimeo/psalm". Verificable: modificar cualquier .php en lib/ → el job Psalm aparece en CI, no se saltea silenciosamente.

#### 16.2 Seguridad de endpoints críticos

- [x] **S16-03** `[M]` Contrato end-to-end de verify-backup.php — hoy no existe suite directa del endpoint. Crear `tests/Unit/VerifyBackupEndpointTest.php` con casos: auth_missing (401), auth_invalid (403), path_traversal (400), storage_not_found (500), no_backup_files (404), checksum_ok (200+hash), checksum_mismatch (409). Sin este contrato, un refactoring silencia roturas. Verificable: `php vendor/bin/phpunit tests/Unit/VerifyBackupEndpointTest.php` → 7 tests verdes.
- [x] **S16-04** `[S]` Minimización de tokens de backup — `verify-backup.php` acepta tokens de cron, admin y verificación indistintamente. Crear token dedicado `AURORADERM_BACKUP_VERIFY_TOKEN` (solo lectura, sin permisos de escritura). El endpoint de verificación rechaza `CRON_SECRET` y `AURORADERM_DIAGNOSTICS_ACCESS_TOKEN` con 403 explícito. Verificable: `curl -H "Authorization: $CRON_SECRET" /verify-backup.php` → 403.
- [x] **S16-11** `[x]` **S16-11** `[M]` Guard de drift para `openapi-openclaw.yaml` — si un endpoint OpenClaw cambia en backend pero no en el YAML, nadie lo detecta. Crear `bin/check-openapi-drift.js`: leer `openapi-openclaw.yaml`, extraer paths/operations, comparar con endpoints registrados en `routes.php` o `OpenclawController.php`. Si hay diff → exit 1 con lista de discrepancias. Añadir como step en CI. Verificable: añadir ruta a `OpenclawController` sin actualizar YAML → `node bin/check-openapi-drift.js` → exit 1.
- [x] **S16-05** `[M]` Contrato público de monitoring-config — `monitoring-config` endpoint no tiene allowlist de claves permitidas. Puede filtrar DSNs completos de Sentry u otros secretos backend. Crear allowlist en `MonitoringConfigController.php`: solo campos `sentry_dsn_frontend` (sin auth token), `ga_measurement_id`, `clarity_id`. Test de contrato que verifica que ninguna clave prohibida aparece en el JSON público. Verificable: `curl /api.php?resource=monitoring-config | jq 'has("sentry_auth_token")'` → false.

#### 16.3 Frontend de observabilidad

- [x] **S16-06** `[M]` Hardening de monitoring-loader.js — actualmente no tiene: versión del SDK fija (carga desde CDN sin hash), timeout/backoff si CDN falla, protección contra doble init (`window.__auroraSentryLoaded`), degradación limpia sin Sentry. Añadir: sri hash en el `<script>`, `window.__auroraSentryLoaded` guard, `setTimeout` de 5s para CDN con fallback a noop. Verificar con tests en `tests/mocks/` para 3 escenarios: no-config, cdn-fail, init-once. Verificable: `grep "__auroraSentryLoaded" js/monitoring-loader.js` → match.
- [x] **S16-13** `[S]` Contrato de resource hints de monitoreo — hoy hay tests de hints pero si se crea una página nueva, nadie valida que tenga los `<link rel=preconnect>` de Sentry/GA/Stripe según la superficie. Formalizar allowlist de hints requeridos por superficie (`public`, `admin`, `portal`) en `bin/verify.js`. Verificable: una página de servicio nueva que no tenga `dns-prefetch` de GA → warning en `npm run verify`.

#### 16.4 Logging y Papertrail

- [x] **S16-07** `[M]` Smoke de entrega Papertrail — `lib/logger.php` intenta enviar logs por UDP a Papertrail pero no hay smoke ni evidencia operativa de que el canal esté vivo. Crear `tests/smoke/PapertrailSmokeTest.php`: inicializar Logger, enviar mensaje de prueba `[smoke] aurora-derm test`, verificar que no lanza excepción y que el payload UDP tiene el formato mínimo correcto (facility, severity, timestamp, message). Fallback a stderr si `PAPERTRAIL_HOST` no está. Verificable: `php tests/smoke/PapertrailSmokeTest.php` → exit 0.

#### 16.5 Documentación de observabilidad

- [x] **S16-08** `[M]` Single source de monitoring docs — existen `MONITORING.md` y `MONITORING_SETUP.md` con instrucciones que pueden ser contradictorias. Decidir cuál es canónico (probablemente `MONITORING.md`) y convertir el otro en un redirect/índice que apunte al canónico. El canónico debe cubrir: Sentry (frontend+backend), Papertrail (UDP), uptime monitoring, GA4. Verificable: `grep -l "Sentry\|Papertrail" docs/` → un solo archivo canónico + uno de índice.
- [x] **S16-09** `[S]` Refresh automático de baseline de performance — `docs/PERFORMANCE_BASELINE.md` tiene foto del 20-feb-2026. Crear `bin/gen-performance-baseline.js` que genera el baseline con Lighthouse headless sobre el servidor local. Loguea: LCP, CLS, TBT, FCP, Score. Guarda en `docs/PERFORMANCE_BASELINE.md` con fecha y comando. Añadir como npm script `perf:baseline`. Verificable: `npm run perf:baseline` → genera `docs/PERFORMANCE_BASELINE.md` con timestamp de hoy.
- [x] **S16-10** `[M]` Performance budgets visibles en report/audit — `run-public-performance-gate` ya existe pero su salida no sube al reporte diario. Añadir en `bin/report.js` sección "Performance": leer `governance/performance-gate.json` si existe y mostrar señal (🟢 budget ok / 🔴 LCP over budget). Lo mismo en `bin/audit.js`. Verificable: `npm run report --silent` → muestra sección "Performance" sin error.

#### 16.6 OpenClaw schema y API spec

- [x] **S16-11** `[M]` Guard de drift para openapi-openclaw.yaml — si un endpoint OpenClaw cambia en backend pero no en el YAML, nadie lo detecta. Crear `bin/check-openapi-drift.js`: leer `openapi-openclaw.yaml`, extraer paths/operations, comparar con endpoints registrados en `routes.php` o `OpenclawController.php`. Si hay diff → exit 1 con lista de discrepancias. Añadir como step en CI. Verificable: añadir ruta a OpenclawController sin actualizar YAML → `node bin/check-openapi-drift.js` → exit 1.
- [x] **S16-12** `[S]` Release pack de schema para Custom GPT — versionar `openapi-openclaw.yaml` y `docs/chatgpt-custom-gpt-instructions.md` juntos. Añadir campo `x-schema-version: YYYY-MM-DD-hash` al YAML. Crear `bin/gen-gpt-schema-pack.js` que genera `docs/gpt-schema-pack-latest.md` con: versión, hash del YAML, fecha, instrucciones de importación. El equipo médico puede ver qué schema está vigente sin revisar git. Verificable: `node bin/gen-gpt-schema-pack.js && grep "x-schema-version" docs/gpt-schema-pack-latest.md` → match.

---

### 💰 Sprint 17 — Producto y Monetización Real

> **Criterio de inclusión:** Solo las tareas con impacto directo en revenue o conversión antes de junio 2026. Se excluyen: review ops (post-launch), executive review (interno), renewal cockpit (B2B SaaS post-piloto). Se incluyen: los motores que hacen que las landing pages existentes **funcionen de verdad**.

#### 17.1 Gift Cards reales (la landing existe, el motor no)

- [x] **S17-01** `[M]` Gift card ledger backend — `es/gift-cards/index.html` genera códigos en frontend pero sin persistencia. Crear `lib/gift_cards/GiftCardService.php` con métodos: `issue(amount, issuer, recipient): GiftCard`, `validate(code): GiftCard|null`, `redeem(code, amount): bool`. Modelo: `code`, `amount_cents`, `balance_cents`, `issuer_id`, `recipient_email`, `issued_at`, `expires_at`, `status (active|redeemed|expired)`. Storage en SQLite store existente. Verificable: `POST /api.php?resource=gift-card-issue` → JSON con code+QR data.
- [x] **S17-02** `[M]` Redención de gift card en booking y cierre de consulta — en `es/agendar/`: campo "¿Tienes gift card?" con validación en tiempo real. En `admin.html`: botón "Aplicar gift card" en cierre de consulta. Backend: `POST /api.php?resource=gift-card-redeem` descuenta saldo, previene doble uso con lock atómico. Verificable: una gift card no puede redimirse dos veces simultáneamente.
- [x] **S17-03** `[S]` Vigencia y recordatorios de gift cards — job cron que detecta gift cards con `expires_at` en los próximos 14 días y envía WhatsApp/email al recipient: "Tu gift card de Aurora Derm vence el [fecha]. Úsala antes para tratamientos de: [servicios]". Panel simple en admin bajo "Gestión > Gift Cards". Verificable: `GET /api.php?resource=gift-cards-expiring` → lista con días restantes.

#### 17.2 Programa de referidos (motor, no solo landing)

- [x] **S17-04** `[M]` Motor de referidos con link único — `es/referidos/index.html` existe sin backend. Crear `lib/referrals/ReferralService.php`: generar código único por paciente (`REF-XXXXX`), registrar clic, atribuir conversión cuando el referido agenda su primera cita. `GET /api.php?resource=referral-link?patient_id=X` → link trackeable. Verificable: un link de referido incrementa el contador de clics en cada visita.
- [x] **S17-05** `[M]` Wallet de beneficios por referidos — en `es/portal/`: sección "Mis Referidos" con: código compartible, referidos enviados, convertidos, beneficio ganado (ej: 10% próxima consulta), beneficio disponible para usar. Backend: `GET /api.php?resource=referral-stats?patient_id=X` → stats. Verificable: un paciente con 2 referidos convertidos ve beneficio aplicable en su portal.

#### 17.3 Membresía con enforcement real

- [x] **S17-06** `[M]` Enforcement de membresía activa — `es/membresia/index.html` existe. Falta: en backend, verificar `membership_status` en `PatientCaseController`: si paciente es miembro → flag `priority_booking: true` en respuesta. En admin → badge "⭐ Miembro" visible en ficha. Descuento automático según plan en cierre de consulta. Verificable: `GET /api.php?resource=patient-cases` → campo `membership_status` present.
- [x] **S17-07** `[M]` Estado y renovación de membresía — en `es/portal/index.html`: card "Mi Plan" con estado (Activo / Vence en X días / Vencido), perks activos y CTA "Renovar". Si vence en <30 días → banner de renovación en portal y en admin cuando médico ve al paciente. Backend: `GET /api.php?resource=membership-status?patient_id=X` → `{status, expires_at, days_remaining, perks[]}`. Verificable: un miembro con plan vencido ve estado "Vencido" en portal.

#### 17.4 Paquetes con control de sesiones

- [x] **S17-08** `[M]` Consumo de sesiones de paquete — `es/paquetes/index.html` existe como landing. Falta backend: `lib/packages/PackageService.php` con `activatePackage(patient_id, package_id)`, `consumeSession(patient_id, package_id)`, `getBalance(patient_id)`. En admin: ved progreso del paquete "3/5 sesiones usadas". En portal: card con sesiones restantes. Verificable: después de cerrar una consulta con servicio incluido en paquete → sesión decrementada.

#### 17.5 Conversión de páginas a ventas

- [x] **S17-10** `[M]` Motor de promociones con elegibilidad — `es/promociones/index.html` existe como copy estático. Crear `lib/promotions/PromotionEngine.php`: promotional rule (vigencia, elegibilidad: primera_vez|miembro|referido, descuento, exclusiones). Admin puede activar/desactivar promos. En booking: `GET /api.php?resource=active-promotions` → lista de promos aplicables al paciente. Verificable: un paciente nueva visita ve promo "Primera consulta" y otro con membresía no la ve (exclusión).
- [x] **S17-15** `[M]` Social proof dinámico por servicio — `es/servicios/*/index.html` tiene testimonios estáticos. Conectar con reviews reales: `GET /api.php?resource=reviews?service=botox` → `{rating, count, latest[3]}`. Mostrar rating con estrellas y los 3 testimonios más recientes en cada página de servicio. Fallback elegante si no hay reviews. Verificable: `grep "dynamic-reviews" es/servicios/botox/index.html` → match.

#### 17.6 Turnero como producto vendible

- [x] **S17-16** `[M]` Clinic onboarding wizard persistente — el onboarding console actual es JS estático sin persistencia. Convertir en flujo con progreso real: Paso 1 Config básica → Paso 2 Staff → Paso 3 Servicios → Paso 4 Superficies → Paso 5 Test final. Progreso guardado en store. "Next best action" visible. Backend: `GET /api.php?resource=onboarding-status?clinic_id=X` → `{step, percent, blockers[]}`. Verificable: interrumpir onboarding y retomar → estado conservado.
- [x] **S17-17** `[M]` Package selector integrado al clinic profile — al completar el onboarding, mostrar packages/planes disponibles del software (Básico/Pro/Enterprise) con features comparativas. Selección persiste en `clinic-profile`. Admin puede ver qué plan tiene cada clínica. Verificable: `GET /api.php?resource=clinic-profile?clinic_id=X` → campo `software_plan` present.

---

### 🤝 Sprint 18 — Customer Success y Adopción (Subset Seleccionado)

> **Criterio de inclusión:** Solo las 4 tareas de S18 que tienen impacto directo antes del lanzamiento de junio 2026 y no duplican sprints previos. Las demás (churn engine, renewal cockpit, support SLA, executive review) son post-lanzamiento y se pueden recuperar en Sprint 19+.

#### 18.1 Onboarding y adopción inicial

- [x] **S18-02** `[M]` Onboarding progress persistente — las consolas y tests del onboarding existen. Falta: estado real por clínica guardado en store (pasos completados, bloqueados, ETA estimada, "next best action"). `GET /api.php?resource=onboarding-progress?clinic_id=X` → `{steps: [{id, name, status, blocker?}], percent, next_action}`. Admin puede ver progreso de cada clínica piloto. Verificable: completar paso 2 → el paso 3 aparece como "available" y el 2 como "done".
- [x] **S18-03** `[M]` Guided walkthrough in-app — primer uso guiado para admin y operator: al primer login, mostrar walkthrough de 5 pasos contextual (no tooltip estático, no docs externos). Pasos: (1) Emitir ticket de prueba, (2) Llamar turno desde operator, (3) Ver agenda del día, (4) Ver dashboard, (5) ¡Listo! El walkthrough se puede saltar y reactivar desde "Ayuda". Estado guardado en localStorage. Verificable: al limpiar localStorage, el walkthrough aparece de nuevo en el primer clic.

#### 18.2 Soporte en contexto

- [x] **S18-11** `[M]` Knowledge base contextual en admin/operator — hoy hay páginas de FAQ externas. Falta: panel de ayuda in-app en `admin.html` y `operator.html`. Botón "?" en header que abre sidebar con artículos filtrados según la pantalla activa. Artículos en JSON `data/kb/articles.json`. Motor de búsqueda simple (filtro por keyword). Sin esto el operador sale del sistema para buscar ayuda y se pierde el contexto. Verificable: en pantalla de "Turnos" → artículos sobre turnos aparecen primero.
- [x] **S18-12** `[M]` Clinic profile live preview — antes de publicar cambios de branding o configuración de una clínica, poder ver cómo queda en cada superficie (admin, operator, kiosk, display). Botón "Vista previa" en el panel de configuración de clínica que abre un iframe con los parámetros de la clínica sin guardar. Sin esto, un error de branding llega directo a los pacientes. Verificable: cambiar logo en config → preview muestra el nuevo logo antes de guardar.

---

### 📱 Sprint 19 — Notificaciones, WhatsApp Ops y Android TV

> **Prerrequisito de dispatch:** S15-03 y S15-07 deben cerrarse **antes** de abrir S20. No se incluye Sprint 20 aquí.
> **Criterio de inclusión:** tareas con impacto operativo directo antes de junio 2026, deuda técnica ya visibilizada en auditoría, y nuevo alcance de canal (Android TV como superficie real).

#### 19.1 Push — Preferencias y automatizaciones

- [x] **S19-01** `[M]` Push preference center del paciente — `GET/POST /api.php?resource=push-preferences`: el paciente elige por categoría qué notificaciones recibe: `appointments`, `queue_updates`, `documents_ready`, `marketing`. El portal lee y guarda preferencias reales por paciente. Si `queue_updates=false`, los pushes de turno se omiten. Verificable: `POST push-preferences {queue_updates: false}` → siguiente push de turno no se envía.
- [x] **S19-02** `[M]` Push automations para journey real — conectar `NotificationService` y `PushService` a eventos ya existentes: confirmación de cita, recordatorio 24h, "le toca pasar" desde operador, documento listo. Verificable: cada evento genera payload estándar `{title, body, url, surface}` sin push huérfano.
- [x] **S19-03** `[S]` Push diagnostics en admin — `GET /api.php?resource=push-diagnostics`: `{configured, publicKeyPresent, subscriptionsTotal, subscriptionsBySurface, lastTestAt, lastSendStatus}`. Sin esto, el admin no sabe si Push está activo. Verificable: `curl /api.php?resource=push-diagnostics` → JSON con todos los campos sin error.

#### 19.2 WhatsApp OpenClaw — Ops y resiliencia

- [x] **S19-04** `[M]` Ops console para WhatsApp OpenClaw — vista operativa `whatsapp-openclaw-ops`: muestra conversations, drafts, outbox, holds y human_followup agrupados. Verificable: una conversación con hold activo aparece en el panel con su `conversationId`.
- [x] **S19-05** `[M]` Retry y dead-letter para outbox WhatsApp — formalizar estados `queued|sent|failed|requeued`, campos `retryCount`, `lastError`, y acción admin `requeue_outbox`. Verificable: un mensaje fallido puede reencolarse (`status=requeued`) sin duplicar mensajes ya enviados.
- [x] **S19-06** `[M]` Dashboard de slot holds WhatsApp — listar holds `active|expired|released|consumed` por doctor/fecha con TTL visible y acción de liberación manual con motivo. Verificable: un hold expirado ya no figura como `active` después de `expireSlotHolds()`.
- [x] **S19-07** `[M]` Cola de handoff humano desde WhatsApp — cuando `intent=handoff_clinical` o FAQ no resuelve, crear item operativo con `{conversationId, phone, reason, latestDraftSummary, sla_due_at}`. Verificable: pregunta clínica sin resolución → registro trazable fuera del chat.
- [x] **S19-08** `[M]` Funnel de booking por WhatsApp OpenClaw — generar artifact `data/funnel/whatsapp-openclaw-latest.json` con etapas: `inbound → availability_lookup → hold_created → checkout_ready → appointment_created → handoff`. Verificable: el artifact existe aunque alguna etapa esté en 0.

#### 19.3 Android TV — Release y runtime

- [x] **S19-09** `[M]` Contrato de release para Android TV — formalizar build release, firma, checksum y ruta publicada para `TurneroSalaTV.apk`. Entregable: `docs/TURNERO_ANDROID_RELEASE.md` + script/workflow reproducible. Verificable: una release genera APK + metadata sin pasos implícitos o manuales.
- [x] **S19-10** `[M]` Heartbeat y health de turnero-sala-tv-android — contrato de heartbeat con `{device_id, version, last_seen_at, surface_url, status}`. Endpoint: `POST /api.php?resource=tv-heartbeat`. Un dispositivo TV aparece como online/offline por TTL. Verificable: TV sin conexión por >5min → `status=offline` en panel.
- [x] **S19-11** `[S]` Offline diagnostics UX en Android TV — cuando falle WebView/red, mostrar pantalla clara con último intento, próximo reintento, host, estado de red. La app nunca queda en "pantalla en blanco". Verificable: sin red → pantalla de diagnóstico, con reconexión automática al recuperar conectividad.
- [x] **S19-12** `[M]` Remote config para Android TV — mover `BASE_URL`, `SURFACE_PATH` y flags operativos a un JSON remoto versionado. Sin recompilar, staging/prod se pueden cambiar. Verificable: cambiar `BASE_URL` en `GET /api.php?resource=tv-config` → TV aplica sin reinstalar APK.

#### 19.4 Tooling y deuda técnica (bloqueadas por S15-03/07)

- [x] **S19-13** `[S]` Actualizar `prefer[]` de roles en dispatch — S15-03 completado: actualizar `prefer[]` en `bin/dispatch.js` para roles `backend`, `frontend` y `devops` incluyendo tareas de S17-S19. Verificable: `npm run dispatch:backend` → retorna tarea de S17/S18/S19.
- [x] **S19-14** `[S]` Integrar `verify-scripts.js` en `gov:audit` — S15-07 completado: conectar `bin/verify-scripts.js` al pipeline de audit, sección "Scripts rotos" con conteo. Verificable: `npm run gov:audit` → muestra tabla de broken scripts.
- [x] **S19-15** `[S]` Resource-hint warnings en verify-scripts — los warnings de `preload`/`prefetch` en `verify-scripts.js` son deuda visible. Purgar o justificar cada warning hasta bajar conteo a 0. Verificable: `node bin/verify-scripts.js` → 0 warnings de resource hints.

#### 19.5 Observabilidad y calidad (propuestas editoriales)

- [x] **S19-16** `[M]` Sentry aterrizado en runtime — `SENTRY_AUTH_TOKEN` y `SENTRY_ORG` siguen como `missing_env` en runtime. Configurar en CI Secrets + `monitoring-loader.js`. Verificable: `node bin/audit.js` → `sentry.configured: true`, sin `missing_env` en Sentry section.
- [x] **S19-17** `[M]` Dead endpoints en routes.php — auditoría identificó rutas que apuntan a controllers inexistentes. Crear suite `tests/Unit/RoutesIntegrityTest.php` que para cada ruta registrada verifique que el controller::method existe. Verificable: 0 rutas huérfanas en PHPUnit.
- [x] **S19-18** `[S]` Métricas de WhatsApp OpenClaw en dashboard — `GET /api.php?resource=whatsapp-openclaw-metrics` con `{conversations_total, holds_active, handoff_pending, outbox_failed, conversion_rate}`. Verificable: el endpoint devuelve JSON con todos los campos aunque sean 0.

---

### 🧭 Sprint 22 — Product Truth, Referidos y Contratos Comerciales

> **Criterio de inclusión:** cerrar superficies publicadas que hoy parecen producto terminado, pero todavía operan con mocks, identidad débil o contenido estático desconectado del backend.
> **No reabre:** `document-verify`, `portal historial`, `portal receta` ni `portal fotos`, porque ya tienen mejor cierre funcional y cobertura que las surfaces auditadas aquí.

#### 22.1 Clínica interna — verdad operativa

- [x] **S22-01** `[M]` `codex_backend_ops` Búsqueda clínica real de pacientes/casos — reemplazar la respuesta mock de `PatientCaseController::search` por una consulta real sobre pacientes, casos y citas. Debe buscar por nombre, documento, teléfono, `case_id` y última visita, con resultados ordenados, estables y sin pacientes inventados. Verificable: desaparecen `Juan Garcia` y `Maria Silva` del API y una búsqueda real devuelve datos del store.

#### 22.2 Referidos — identidad, sesión y verdad pública

- [x] **S22-02** `[S]` `codex_frontend` Contrato de sesión para `portal/referidos` — normalizar la lectura de sesión a `patientId` y dejar `/es/portal/referidos/` funcional con la sesión canónica del portal. Si no hay paciente elegible, mostrar estado vacío útil, no error silencioso. Verificable: la vista carga con sesión real y ya no depende de `session.patient.id`.
- [x] **S22-03** `[M]` `codex_backend_ops` Harden de identidad en referidos — `referral-link` y `referral-stats` deben dejar de aceptar `patient_id` público sin validación. La generación del link propietario debe venir de sesión portal o identidad firmada; el público solo puede consumir `?ref=...`, no crear dueño nuevo. Verificable: sin sesión válida no se emite link propietario ni stats privadas.
- [x] **S22-04** `[M]` `codex_frontend` Truth pass de referidos públicos — quitar el fallback `demo_p_*` y cualquier generación creativa de dueño en `/es/referidos/`. La página debe compartir un link real si hay contexto válido y, si no lo hay, redirigir a portal/login o a CTA de soporte. Verificable: sin sesión válida ya no existe fallback aleatorio ni share URL ficticia.

#### 22.3 Comercial — páginas vivas, no templates

- [x] **S22-05** `[L]` `codex_backend_ops` Gift card pública con emisión real — `/es/gift-cards/` deja de generar códigos y PDFs locales. El flujo canónico pasa a `solicitud/checkout -> emisión backend persistida -> PDF/QR reales -> validación/redeem`. Antes de la emisión no se muestra un código operativo. Verificable: la surface pública usa `gift-card-issue`/`gift-card-validate` reales y no fabrica códigos válidos en frontend.
- [x] **S22-06** `[M]` `codex_transversal` Catálogo vivo de promociones — `/es/promociones/` debe leer campañas activas/próximas desde backend/store, sin `3 campañas`, `campaña destacada` ni copy duro como fuente de verdad. La elegibilidad tiene que salir de contexto real, no de un mock basado solo en `ci`. Verificable: la página refleja campañas reales y cambia cuando cambia el store.
- [x] **S22-07** `[M]` `codex_backend_ops` Contrato real de membresía — eliminar perks hardcodeados y resolver precio, vigencia, perks y renovación desde una fuente canónica. `/es/membresia/`, el portal y admin deben mostrar el mismo estado/beneficios. Verificable: membership/portal/admin no divergen en status ni perks.
- [x] **S22-08** `[M]` `codex_frontend` Catálogo vivo de paquetes — `/es/paquetes/` debe resolver combos, precio, sesiones incluidas, duración y CTA desde fuente canónica, no desde cards HTML fijas. Debe quedar alineado con el saldo/consumo de paquetes del backend. Verificable: los paquetes visibles coinciden con el balance/consumo y no dependen de números estáticos embebidos en la landing.

#### 22.4 Calidad — pruebas de producto directas

- [x] **S22-09** `[M]` `codex_transversal` QA pack comercial y de referidos — agregar integración y Playwright para `referral-link`, `referral-stats`, `membership-status`, `active-promotions`, `gift-card-validate/issue/redeem`, `/es/referidos/`, `/es/gift-cards/`, `/es/promociones/`, `/es/membresia/`, `/es/paquetes/` y `/es/portal/referidos/`. Las pruebas de analytics ya no cuentan como cobertura suficiente. Verificable: existen tests directos de endpoints y surfaces, no solo de funnel/events.

### 🧭 Sprint 23 — Credibilidad de Compra, Cohesión Comercial y Truth-in-Sales

> **Criterio de inclusión:** cerrar las dudas de compra que hoy genera Flow OS desde fuera: pricing incoherente, CTAs a superficies internas, proof sin procedencia, readiness comercial exagerado y mezcla de marca entre producto y clínica de referencia.
> **No reemplaza:** `S6-14`, `S6-15`, `S6-17`, `S6-22`, `S6-24` ni `S9-20`; les añade honestidad comercial, fuente canónica y gates para no sobreprometer.

#### 23.1 Fuente comercial y coherencia de oferta

- [x] **S23-01** `[L]` `codex_transversal` Fuente única de verdad comercial — crear `data/flow-os/commercial-config.json` con `commercial_mode`, `active_offer`, `cta_targets`, `trial_enabled`, `pricing_mode` y `allowed_public_claims`. Landing, precios, onboarding y CTA deben leer de la misma fuente. Verificable: no coexisten `piloto único` y `Free/Starter/Pro/Enterprise` salvo que `pricing_mode=hybrid`.
- [x] **S23-07** `[M]` `codex_transversal` Honestidad del onboarding comercial — revisar y corregir claims como `Digitaliza tus servicios en menos de 10 minutos` y CTAs tipo `Empieza gratis` para que reflejen el modo comercial activo real. Si hoy el modelo no es self-serve, debe decir `Solicitar activación` o equivalente. Verificable: onboarding, pricing y landing no prometen autoalta que el producto no cumple.

#### 23.2 Integridad pública y narrativa de marca

- [x] **S23-02** `[M]` `codex_frontend` Integridad de CTAs públicas — eliminar links públicos a `/admin.html#queue` y `/admin.html#settings` en Flow OS. Reemplazar por rutas buyer-safe: propuesta, demo guiada, onboarding válido o waitlist. Verificable: `rg "/admin.html#" es/software/turnero-clinicas app-downloads es/ | wc -l` → `0` en superficies comerciales.
- [x] **S23-05** `[M]` `codex_frontend` Arquitectura de marca Flow OS vs Aurora Derm — corregir `og:site_name`, footer, copy y encabezados para que Flow OS sea el producto y Aurora Derm quede como `tenant de referencia`, no como identidad mezclada. Verificable: las páginas B2B tienen jerarquía consistente de marca en meta tags, header, hero y footer.

#### 23.3 Proof, readiness y truth gate comercial

- [x] **S23-03** `[M]` `codex_transversal` Ledger de proof comercial — crear `data/flow-os/proof-ledger.json` con `claim_id`, `value`, `source`, `tenant`, `captured_at`, `fresh_until` y `status=live|stale|demo`. Las cards de proof y métricas públicas deben salir de ahí, no de JSON inline opaco. Verificable: cada cifra pública visible tiene `captured_at` y `status`.
- [x] **S23-04** `[M]` `codex_transversal` Gate de venta según readiness — si el semáforo operativo sigue `RED`, las páginas comerciales deben degradar promesa a `demo controlada`, `propuesta exploratoria` o `waitlist`, no `piloto listo`, `SLA`, `empieza ya` ni `instalación inmediata`. Verificable: un check comercial falla si `PRODUCT_OPERATIONAL_STATUS=RED` y la web pública sigue prometiendo despliegue activo.
- [x] **S23-06** `[M]` `codex_frontend` Badges públicos de readiness por módulo — cada surface o módulo visible para compra debe llevar estado público real: `Disponible ahora`, `Piloto guiado`, `En validación` o `No publicado`. Debe consumir readiness real y artefactos publicados, especialmente desktop, kiosk y sala TV. Verificable: `kiosk` y `sala_tv` no aparecen como listos cuando el repo no publica artefactos reales.
- [x] **S23-10** `[M]` `codex_transversal` Commercial truth gate — crear un check tipo `bin/check-commercial-truth.js` o equivalente que falle por claims sin source, CTAs a rutas internas, pricing incoherente, SLA o promesas no habilitadas y badges de readiness sin soporte real. Verificable: el gate detecta drift comercial antes de publicar.

#### 23.4 Compra B2B y alcance de implementación

- [x] **S23-08** `[M]` `codex_transversal` Buyer pack B2B de seguridad y operación — crear un paquete comercial técnico corto con auth, backups, audit trail, IA con aprobación humana, soporte, límites del producto y prerequisitos de implementación. Esto es B2B, no página legal de paciente. Verificable: existe una surface o pack enlazable desde Flow OS que responde a objeciones de comprador serio.
- [x] **S23-09** `[M]` `codex_backend_ops` Scope y migración de implementación — definir una hoja de implantación del piloto: qué datos se migran, qué no, duración real, qué debe entregar la clínica, fallback de día 1 y qué queda fuera del alcance. Verificable: existe un checklist de implementación y un buyer no tiene que inferir el esfuerzo por su cuenta.

---

### 🫧 Sprint UI — Fase 4: Liquid Glass (ANTIGRAVITY EXCLUSIVO)

> **Inspiración:** Apple WWDC 2025 — Liquid Glass design language.
> Translucidez real, refracción de luz, capas de vidrio que respiran.
> Este sprint transforma Aurora Derm en una experiencia visual de primer nivel mundial.
> **Agente exclusivo:** Antigravity. Codex tiene prohibido tomar cualquier tarea `[UI]`.

#### 20.1 Design System — Tokens y primitivas Liquid Glass

- [x] **UI4-01** `[M]` `[UI]` Liquid Glass token layer — crear `src/apps/astro/src/styles/public-v6/liquid-glass.css` con las variables CSS del sistema: `--lg-blur: 24px`, `--lg-saturation: 160%`, `--lg-opacity-fill: 0.12`, `--lg-border-specular: rgba(255,255,255,0.28)`, `--lg-shadow-depth: 0 8px 32px rgba(3,8,18,0.36)`, `--lg-refraction-tint: rgba(199,163,109,0.08)`. Importar desde `index.css`. Verificable: `grep "lg-blur\|lg-saturation" src/apps/astro/src/styles/public-v6/liquid-glass.css` → match ≥6 variables.

- [x] **UI4-02** `[M]` `[UI]` Glass surface mixin — `.lg-surface` con `backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-saturation))`, `background: rgba(255,255,255,var(--lg-opacity-fill))`, `border: 1px solid var(--lg-border-specular)`, `box-shadow: var(--lg-shadow-depth)`. Variantes: `.lg-surface--dark` (tint oscuro navy), `.lg-surface--gold` (tint gold aurora), `.lg-surface--deep` (blur 48px para modales). Verificable: `grep "lg-surface--deep\|lg-surface--gold" liquid-glass.css` → match.

- [x] **UI4-03** `[S]` `[UI]` Specular highlight edge — `::before` pseudo-elemento con `background: linear-gradient(135deg, rgba(255,255,255,0.22) 0%, transparent 50%)`, `border-radius: inherit`, aplicado sobre `.lg-surface` para simular el brillo de borde que hace el vidrio tridimensional. La luz viene del ángulo superior izquierdo. Verificable: inspección visual — el borde superior-izquierdo de cada panel glass brilla 22% más.

- [x] **UI4-04** `[S]` `[UI]` Depth shadow system — reemplazar todos los `box-shadow` genéricos del sitio por el sistema de profundidad Liquid Glass: `--shadow-z1` (elementos flotantes), `--shadow-z2` (cards), `--shadow-z3` (modales), `--shadow-z4` (overlays). Cada nivel incrementa blur y opacidad. Verificable: `grep "shadow-z1\|shadow-z2\|shadow-z3\|shadow-z4" liquid-glass.css` → match ≥4.

#### 20.2 Componentes — Refactoría al sistema Glass

- [x] **UI4-05** `[L]` `[UI]` Hero Liquid Glass — rediseñar `.v6-hero__band` como surface glass: `backdrop-filter blur(28px) saturate(180%)`, recuadros de tarjeta con `.lg-surface--dark`, el indicator bar reemplazado por línea gold translúcida. El "EMPIECE HOY" strip inferior: glass con tint gold sutil. Resultado: el hero se ve como la barra de navegación de iOS 18. Verificable: `grep "lg-surface\|backdrop-filter.*blur" home.css` en sección hero → ≥3 matches.

- [x] **UI4-06** `[L]` `[UI]` Navigation bar glass — el `v6-header` actual usa un fondo sólido oscuro. Convertir a glass: `position: sticky`, `backdrop-filter: blur(20px) saturate(150%)`, `background: rgba(5,7,11,0.72)`, `border-bottom: 1px solid rgba(255,255,255,0.08)`. Al hacer scroll down >80px: añadir specular highlight. Transición `300ms ease`. Verificable: `grep "backdrop-filter.*blur.*header\|v6-header.*glass" tokens.css` o `components.css` → match.

- [x] **UI4-07** `[M]` `[UI]` Card matrix glass — `.v6-corporate-matrix__card` ya está en dark glassmorphism. Refinar con: micro-animación al hover (`transform: translateY(-4px) scale(1.01)`), borde specular que se intensifica al hover (`border-color: rgba(199,163,109,0.36)`), sombra interna sutil `inset 0 1px 0 rgba(255,255,255,0.1)`, y refracción dorada en `.is-slot-1`. Verificable: `grep "inset.*rgba\|scale(1.01)" home.css` → match.

- [x] **UI4-08** `[M]` `[UI]` Modal y overlay glass — cualquier modal/overlay en `admin.html` y portal usa fondos sólidos. Migrar a: `background: rgba(3,8,18,0.72)`, `backdrop-filter: blur(16px)`, panel interior con `.lg-surface--deep`. Los botones primarios tendrán el glass gold tint. Verificable: `grep "lg-surface--deep\|backdrop-filter.*blur.*modal" aurora-clinical.css` → match.

- [x] **UI4-09** `[M]` `[UI]` Footer glass — el `v6-footer` tiene fondo uniforme. Añadir: capa glass sobre imagen de fondo sutil (gradiente de topografía en svg inline muy opaco 4%), `border-top: 1px solid rgba(255,255,255,0.06)`, links con hover que activan un micro-highlight glass. Verificable: `grep "v6-footer.*glass\|v6-footer.*backdrop" home.css` → match.

#### 20.3 Animaciones — Fluid motion

- [x] **UI4-10** `[M]` `[UI]` Fluid scroll reveal — reemplazar las animaciones `opacity` planas actuales por un sistema físico: `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring), elementos entran trasladados `+24px` en Y y `blur(8px)` → su posición final. Duración `480ms`. Stagger de `60ms` entre elementos hermanos. Verificable: `grep "0.34.*1.56.*0.64.*1\|cubic-bezier.*spring" js/aurora-scroll-reveal.js` → match.

- [x] **UI4-11** `[S]` `[UI]` Hover glass ripple — al hacer hover en cualquier `.lg-surface`, agregar efecto de "ondulación interna": pseudo `::after` circular que hace `transform: scale(0) → scale(2.5)`, `opacity: 0.06 → 0`, `background: radial-gradient(rgba(255,255,255,0.4))`. Duración `600ms ease-out`. Verificable: `grep "ripple\|scale.*2.5.*glass" liquid-glass.css` → match.

- [x] **UI4-12** `[M]` `[UI]` Page transition glass morphing — al navegar entre páginas, en lugar de flash blanco, implementar: overlay glass que hace `opacity 0→1→0` con `blur(0→8px→0)` en `200ms+200ms`. Aprovechar `aurora-nprogress.js` para sincronizar. El efecto es idéntico al "Sheet" de UIKit en iOS. Verificable: `grep "page-transition.*glass\|blur.*transition.*nav" js/aurora-nprogress.js` → match.

#### 20.4 Superficie pública — Lavado de cara total

- [x] **UI4-13** `[L]` `[UI]` Home page glass sections — aplicar `.lg-surface` y variantes a todas las secciones de `es/index.html`: editorial cards, trust signals, CTA strip, news strip. El home debe sentirse como una app nativa iOS 18 visto en desktop. Sin usar `!important`. Verificable: `grep "lg-surface" es/index.html` → ≥8 matches.

- [x] **UI4-14** `[M]` `[UI]` Services page glass redesign — `es/servicios/*/index.html`: header de servicio con vidrio flotante sobre imagen de fondo (position relative + glass panel absolute), precio/duración en pill de glass gold. CTA "Agendar cita" con estado hover glass. Verificable: `grep "lg-surface\|glass-pill" es/servicios/diagnostico-integral/index.html` → match.

- [x] **UI4-15** `[M]` `[UI]` Blog article glass — `es/blog/*/index.html`: tabla de contenidos sticky como panel glass a la derecha, citas/callouts con glass dark tint, progress bar de lectura glass gold. Verificable: `grep "lg-surface.*toc\|glass.*callout" styles/aurora-blog.css` → match.

#### 20.5 Portal del paciente — Experiencia premium

- [x] **UI4-16** `[L]` `[UI]` Portal dashboard glass — `es/portal/index.html`: cada card del dashboard (próxima cita, balance, documentos) con `.lg-surface--dark`, número/dato principal en tipografía grande (clamp 32→48px), borde gold al hover. El dashboard debe sentirse como una app financiera premium. Verificable: `grep "lg-surface--dark.*portal\|portal.*glass" es/portal/index.html` → match.

- [x] **UI4-17** `[M]` `[UI]` Timeline de historial glass — `es/portal/historial/`: eventos clínicos como stepper vertical, cada nodo con circle glass dorado, línea conectora translúcida, cards expandibles al clic con `height: 0 → auto` spring. Verificable: `grep "lg-surface.*timeline\|glass.*stepper" es/portal/historial/index.html` → match.

- [x] **UI4-18** `[M]` `[UI]` Kiosk glass skin — `kiosk.html`: la pantalla del kiosco en sala de espera debe tener: fondo de video/animación sutil de partículas en navy, panel central glass para registro de turno, contadores en glass pill. Pacientes que esperan ven algo premium, no una pantalla de admin. Verificable: `grep "lg-surface\|kiosk.*glass" kiosk.html` → match.

---

## 24. Sprint 24 — Resiliencia Clínica Día 1

> **Propósito:** tareas que deben existir para que una clínica opere sin que el sistema los falle en el día de arranque. Sin estas, el lanzamiento de junio es frágil.

#### 24.1 Operación sin fricciones

- [x] **S24-01** `[M]` Detección de pacientes duplicados — antes de crear un nuevo paciente en `PatientCaseController`, verificar si ya existe uno con el mismo número de cédula o nombre+apellido+fecha nacimiento. Mostrar modal de confirmación: "Ya existe un paciente con este número de cédula. ¿Desea continuar o vincular?" Sin esto, la HCE queda fragmentada. Verificable: `POST /api.php?resource=patient-case` con cédula existente → respuesta incluye `duplicate_candidate: true` y `existing_case_id`.

- [x] **S24-02** `[M]` Prevención de doble booking — `AppointmentController` y `AvailabilityController` no bloquean el slot durante el proceso de pago. Un paciente puede iniciar el checkout de un slot mientras otro lo hace simultáneamente. Implementar reserva optimista de slot (`slot_reserved_until: +5min`, liberado si caduca). Verificable: dos requests concurrentes al mismo slot → uno recibe `conflict: true, slot_held: true`.

- [x] **S24-03** `[M]` Wizard de onboarding de clínica nueva — flujo guiado en el admin (pantalla por pantalla) cuando `clinic_profile.json` está vacío: 1) nombre y especialidad, 2) logo y colores, 3) horarios de atención, 4) servicios (selección de catálogo), 5) médico(s) y PIN. Al finalizar, el sistema está listo para recibir pacientes. Sin wizard, el setup tarda días. Verificable: `GET /api.php?resource=onboarding-progress` → `completed_steps` y `next_step` correctos al avanzar.

- [x] **S24-04** `[L]` `[UI]` Modo degradado offline para admin — cuando `navigator.onLine === false`, el admin debe mostrar un banner de alerta gold y deshabilitar acciones que requieren API (guardar diagnóstico, emitir receta) con tooltip "Sin conexión — los cambios no se guardarán". El médico puede seguir leyendo la HCE del paciente desde caché local (last 5 casos cargados). Sin esto, una caída de internet en la consulta detiene al médico. Verificable: `grep "navigator.onLine\|offline-banner" js/admin-offline.js` → match.

- [x] **S24-05** `[S]` Alerta automática de backup fallido — si el cron de backup no produce un archivo en `data/backups/` en las últimas 28 horas, el health check en `/api.php?resource=health-diagnostics` debe devolver `backup.status: 'stale'` y `backup.last_at`. El admin debe mostrar un banner rojo al médico propietario. Sin esto, los backups pueden fallar silenciosamente semanas. Verificable: `grep "backup.*stale\|backup.*last_at" lib/monitoring.php` → match.

- [x] **S24-06** `[M]` Plantillas de notas clínicas rápidas (macros) — los médicos escriben las mismas evoluciones repetidamente. Implementar un sistema de macros en `data/note-templates/`: el médico escribe `/eczema` y se autocompleta: "Paciente refiere prurito en…". CRUD de templates en el admin. Integrar en el campo de evolución de la HCE. Verificable: `GET /api.php?resource=note-templates` → array de templates; campo de evolución detecta `/` y abre selector.

- [x] **S24-07** `[M]` Print pack clínico — desde la vista de caso activo, el médico puede hacer clic en "Imprimir todo" y obtiene un PDF único de: evolución del día + receta activa + indicaciones post-consulta. Hoy cada documento es un PDF separado. Beneficio: la secretaria imprime con un click. Verificable: `GET /api.php?resource=openclaw-print-pack&case_id=X` → PDF multipage con todas las secciones.

- [x] **S24-08** `[S]` Recovery de sesión de consulta — si el médico cierra accidentalmente el admin durante una consulta activa (caso en estado `in_consultation`), al volver, el sistema debe mostrar un banner: "Tienes una consulta en curso con [Paciente]". Usar `localStorage` para persistir el `case_id` activo. Verificable: `grep "session-recovery\|in_consultation.*recover" js/admin.js` → match.

#### 24.2 Validaciones médicas de seguridad

- [x] **S24-09** `[M]` Validación de rangos de dosis — `openclaw-check-interactions` verifica interacciones pero no rangos de dosis. Añadir en `data/drug-doses.json` los rangos seguros de los 50 medicamentos más comunes en dermatología (corticoides, antihistamínicos, retinoides). Si la dosis prescrita supera el rango, mostrar alerta de nivel `medium`. No bloquear — solo alertar. Verificable: receta con `Betametasona 0.1% BID` + `cantidad: 200g` → respuesta incluye `dose_warning: true`.

- [x] **S24-10** `[S]` Alerta de alérgeno en prescripción — antes de guardar una receta, cruzar los `medications` propuestos contra las alergias registradas del paciente en la HCE. Si hay match, mostrar modal de bloqueo suave: "El paciente tiene alergia registrada a [X]. ¿Confirma prescribir igualmente?" Registrar override en `clinical_ai_actions.jsonl`. Verificable: receta con medicamento en `allergies` del paciente → respuesta `allergy_conflict: true, drug: X`.

- [x] **S24-11** `[M]` Contrareferencia y semáforo de urgencia — el médico puede marcar un caso como `URGENTE`, `NORMAL` o `ELECTIVO`. El campo va al ticket del turnero y a la pantalla de sala. Hoy todos los tickets tienen la misma prioridad visual. Verificable: `PATCH /api.php?resource=queue-ticket` con `priority: urgent` → ticket aparece con badge rojo en `queue-display.html`.

#### 24.3 Comunicación paciente-clínica

- [x] **S24-12** `[M]` Recordatorio de cita con link de cancelación — 24h antes de la cita, enviar WhatsApp al paciente con: datos de la cita, link para confirmar (`/es/portal/confirmar-cita/?token=X`), y link para cancelar/reagendar. El link de cancelación debe ser de un solo uso con token firmado. Verificable: `php tests/test_appointment_reminder.php` → genera el mensaje correcto con token válido.

- [x] **S24-13** `[M]` Encuesta NPS post-consulta — 2 horas después de que `case.stage` pasa a `completed`, enviar WhatsApp: "¿Cómo fue tu experiencia? Responde del 1 al 5." Al responder, registrar en `data/nps-responses.jsonl`. Dashboard en admin con NPS calculado. Verificable: `GET /api.php?resource=nps-summary` → `score`, `total_responses`, `promoters`, `detractors`.

- [x] **S24-14** `[S]` Confirmación de cita con instrucciones pre-consulta — al agregar cita, el email/WhatsApp de confirmación debe incluir instrucciones específicas del servicio (p.ej. para láser: "No aplicar crema el día de la sesión"). Las instrucciones vienen del catálogo de servicios. Verificable: `data/services/laser-co2.json` tiene `pre_consultation_instructions` y aparece en el email de confirmación.

---

## 25. Sprint 25 — Portal del Paciente: Producto Real

> **Propósito:** el portal hoy muestra placeholders. El paciente **no puede hacer nada útil** con él. Sin un portal funcional, Aurora Derm no tiene diferenciación de retención frente a una clínica que usa WhatsApp.

#### 25.1 Información clínica en vivo

- [x] **S25-01** `[L]` `[UI]` Próxima cita en vivo con estado — `es/portal/index.html` debe mostrar la cita activa real: nombre del médico, servicio, fecha, hora, sala asignada. Si está en cola ese día, mostrar número de turno y estimado de espera desde el API del turnero. Si no hay cita, mostrar CTA "Agendar tu próxima cita". Sin esto el portal no tiene valor. Verificable: `GET /api.php?resource=patient-portal-dashboard` → `next_appointment` con `doctor`, `service`, `date`, `queue_position` si aplica.

- [x] **S25-02** `[M]` `[UI]` Descarga de recetas y certificados — `es/portal/historial/`: listar todas las recetas y certificados del paciente por fecha, con botón de descarga PDF directo. El token de descarga debe ser firmado y de un solo uso (TTL 1h). Actualmente `patient-portal-prescription` existe pero no está expuesto en la UI. Verificable: visita `es/portal/historial/` → lista de documentos con botón que descarga PDF auténtico.

- [x] **S25-03** `[L]` `[UI]` Plan de tratamiento activo — mostrar el plan de tratamiento clínico activo en una card: diagnóstico principal, medicamentos activos con instrucciones de toma, próximo control y qué hacer si empeora. Esta información existe en la HCE pero el paciente no la ve. Es la pregunta más frecuente post-consulta. Verificable: `GET /api.php?resource=patient-portal-plan` → `active_diagnosis`, `medications` con instrucciones, `next_visit`.

- [x] **S25-04** `[M]` `[UI]` Historial de pagos en el portal — mostrar cada cita pagada con: fecha, servicio, monto, método de pago, y link de recibo PDF. Si hay saldo pendiente, mostrarlo en rojo con CTA "Pagar ahora". Sin esto el paciente llama a la clínica para pedir facturas. Verificable: `GET /api.php?resource=patient-portal-payments` → array de `payments` con `amount`, `method`, `receipt_url`.

#### 25.2 Autogestión del paciente

- [x] **S25-05** `[M]` Cancelación y reagendamiento self-service — desde el portal, el paciente puede cancelar o reagendar una cita futura (hasta 24h antes). El slot se libera automáticamente. Si cancela con menos de 24h, mostrar nota de política de cancelación. Verificable: `POST /api.php?resource=patient-portal-reschedule` con `appointment_id` y `new_slot` → slot original liberado + nuevo confirmado.

- [x] **S25-06** `[M]` Upload de foto del paciente para teleconsulta — antes de una teleconsulta, el paciente puede subir hasta 3 fotos desde el portal. Las fotos van a `CaseMediaFlowController` con origen `patient_upload` y visibilidad `doctor_only`. El médico las ve en el panel de teleconsulta. Verificable: `POST /api.php?resource=patient-portal-photo-upload` → foto guardada con `source: patient_upload` en el case media.

- [x] **S25-07** `[S]` PWA install prompt — `es/portal/index.html` detecta si el usuario no ha instalado la PWA y muestra un banner: "Agrega el portal a tu pantalla de inicio para acceder más rápido." Solo aparece si el criterio de instalabilidad del navegador está activo. Verificable: `manifest.json` tiene `start_url: /es/portal/`, `display: standalone` y `grep "beforeinstallprompt" js/portal.js` → match.

- [x] **S25-08** `[M]` Perfil de paciente editable — desde el portal, el paciente puede actualizar: teléfono, email, dirección. Los cambios van a `PatientPortalController::updateProfile` con validación de formato. El médico ve en la HCE qué campos actualizó el paciente y cuándo. Verificable: `PATCH /api.php?resource=patient-portal-profile` → `updated_fields` en respuesta y log en `data/patient-audit.jsonl`.

- [x] **S25-09** `[M]` Consentimiento informado digital — al crear cuenta en el portal, el paciente firma el consentimiento de tratamiento de datos digitalmente (checkboxes con texto legal real, IP y timestamp registrados). Sin firma digital válida, algunos servicios no deben estar disponibles. Verificable: `POST /api.php?resource=patient-portal-consent` → `signed_at`, `ip`, `version` en respuesta; `GET /api.php?resource=patient-portal-consent` → devuelve el estado de firma.

---

## 26. Sprint 26 — Analytics de Negocio Real

> **Propósito:** el dueño de la clínica necesita saber si el negocio está funcionando. Hoy no hay ningún dashboard que responda: ¿cuánto facturé esta semana? ¿Qué servicio deja más? ¿Cuántos no-shows tuve?

#### 26.1 Dashboard de operación diaria

- [x] **S26-01** `[L]` Dashboard ejecutivo diario — `GET /api.php?resource=executive-dashboard` calcula para el día en curso: citas programadas vs completadas vs no-shows, monto facturado, servicios ejecutados desglosado. Vista simple en admin, acceso solo para rol `owner`. Verificable: respuesta tiene `appointments_scheduled`, `appointments_completed`, `no_shows`, `revenue_today`, `services_breakdown`.

- [x] **S26-02** `[M]` Tracking de no-shows y cancelaciones — registrar en la HCE cuando una cita queda en estado `no_show` (paciente no llegó) o `late_cancel` (canceló con <24h). Calcular tasa de no-shows por semana. La tasa de no-shows varía según el servicio y el día de la semana. Verificable: `GET /api.php?resource=no-show-report` → `no_show_rate_pct`, `by_service`, `by_day_of_week`.

- [x] **S26-03** `[M]` Revenue por servicio y médico — `GET /api.php?resource=revenue-report&period=month` desglosa: monto por servicio, monto por médico, tendencia semanal. Datos vienen de pagos confirmados. Verificable: respuesta tiene `by_service: [{service, revenue, appointments}]` y `by_doctor: [{doctor, revenue}]`.

- [x] **S26-04** `[M]` Funnel de conversión web → booking — conectar el evento `funnel-event` existente con el resultado final del booking. ¿Cuántos que visitaron `/es/agendar/` completaron el pago? ¿En qué paso abandona más gente? Dashboard en admin con: visitas, inicios de booking, selección de slot, pago completado. Verificable: `GET /api.php?resource=booking-funnel` → `steps: [{step, count, drop_rate}]`.

- [x] **S26-05** `[M]` Lifetime value del paciente — calcular para cada paciente: número de visitas, gasto total histórico, días desde última visita, estado (activo/inactivo/en riesgo). Un paciente es "en riesgo" si no ha venido en más de 90 días. Listado en admin ordenable por valor. Verificable: `GET /api.php?resource=patient-ltv?status=at_risk` → lista de pacientes con `ltv`, `last_visit`, `days_absent`.

- [x] **S26-06** `[S]` Tasa de utilización del médico — qué porcentaje de los slots disponibles del médico se reservan. Si un médico tiene baja utilización (<60%), el sistema lo señala al propietario. Verificable: `GET /api.php?resource=doctor-utilization` → `by_doctor: [{doctor, slots_available, slots_booked, utilization_pct}]`.

#### 26.2 Métricas de marketing y crecimiento

- [x] **S26-07** `[M]` Origen de los nuevos pacientes — registrar en `patient.acquisition_source` cómo llegó cada nuevo paciente: `google`, `instagram`, `referido`, `whatsapp`, `directo`. El médico lo selecciona al crear el caso o el sistema lo infiere del `UTM` de la URL de booking. Verificable: `GET /api.php?resource=acquisition-report` → `by_source: [{source, count, revenue}]`.

- [x] **S26-08** `[M]` Resumen semanal automático por email/WhatsApp al propietario — cada lunes a las 8am, enviar al propietario de la clínica un resumen de la semana anterior: citas, revenue, NPS, no-shows, nuevos pacientes. Formato compacto. Sin dashboards que nadie visita. Verificable: `php bin/send-weekly-summary.php` → genera y envía el resumen correctamente; test unitario de generación del contenido.

---

## 27. Sprint 27 — Productividad del Médico en Consulta

> **Propósito:** si OpenClaw le ahorra 5 minutos por consulta, pero el médico pierde 3 en burocracia evitable, el beneficio neto no es suficiente. Este sprint elimina fricción residual.

#### 27.1 Interface de consulta fluida

- [x] **S27-01** `[M]` `[UI]` Vista "Focus Mode" en consulta activa — cuando el médico inicia una consulta, el admin entra en modo pantalla completa con: foto del paciente, resumen clínico colapsable, chat de OpenClaw, y acciones rápidas (guardar diagnóstico, emitir receta, cerrar). Sin distracciones de menús laterales. Verificable: `grep "focus-mode\|consultation-focus" js/admin.js` → match; clase `.focus-mode` en `admin.html` cuando `case.status === in_consultation`.

- [x] **S27-02** `[M]` `[UI]` Panel de alergias e interacciones siempre visible — arriba del campo de prescripción, una barra fija en amber/gold que muestre las alergias activas del paciente. No debe estar enterrada en un tab. Si no hay alergias: barra verde "Sin alergias registradas". Verificable: `grep "allergy-bar\|allergy.*fixed" styles/aurora-clinical.css` → match; visible en DOM con `position: sticky`.

- [x] **S27-03** `[M]` Historial de búsquedas CIE-10 del médico — los médicos buscan los mismos 20 diagnósticos el 90% del tiempo. Guardar en `localStorage` las últimas 10 búsquedas CIE-10 del médico. Al abrir el selector de diagnóstico, mostrar "Recientes:" antes de escribir. Verificable: `grep "cie10.*recent\|localStorage.*cie10" js/openclaw-chat.js` → match; búsquedas previas aparecen sin escribir.

- [x] **S27-04** `[M]` Autoguardado de borrador de evolución — mientras el médico escribe la nota de evolución, hacer autosave a `localStorage` cada 30 segundos. Si cierra accidentalmente, al volver aparece: "Tienes un borrador sin guardar. ¿Recuperar?" Verificable: `grep "autosave\|draft.*evolution\|recovery.*draft" js/admin.js` → match.

- [x] **S27-05** `[S]` Atajos de teclado en admin — los médicos que operan rápido usan teclado. Implementar: `Ctrl+D` → abrir selector de diagnóstico, `Ctrl+P` → emitir prescripción, `Ctrl+E` → guardar evolución, `Ctrl+Enter` → cerrar consulta. Mostrar cheatsheet con `?`. Verificable: `grep "Ctrl+D\|keyboard.*shortcut\|hotkey" js/admin.js` → match; funcional en navegador.

- [x] **S27-06** `[L]` OpenClaw en WhatsApp — el médico puede enviar desde el chat de OpenClaw hacia el WhatsApp del paciente directamente: resumen de consulta, indicaciones post-procedimiento, link de receta. Un botón "Enviar a paciente" en el chat usa el `wa.me` del caso activo. Hoy el médico tiene que copiar y pegar. Verificable: `grep "send.*to.*patient\|whatsapp.*chat" js/openclaw-chat.js` → match; botón en UI dispara `POST /api.php?resource=openclaw-send-to-patient`.

#### 27.2 Gestión de agenda

- [x] **S27-07** `[M]` Vista de agenda semanal del médico — en el admin, una vista tipo Google Calendar (semana actual) con las citas bloqueadas por color de servicio. Click en cita → abre el caso. Hoy la agenda es solo una lista. Verificable: `grep "week-view\|agenda.*calendar" js/admin.js` → match; vista con 7 columnas de días.

- [x] **S27-08** `[M]` Bloqueo de horarios — el médico puede marcar slots como bloqueados (vacaciones, reunión) desde el admin. Al intentar agendar en ese slot, el sistema lo rechaza. Bloqueados visibles en la vista de agenda. Verificable: `POST /api.php?resource=availability-block` con `date`, `time_start`, `time_end` → slot aparece en `booked-slots` como `blocked: true`.

- [x] **S27-09** `[M]` Lista de espera para servicios con alta demanda — si un slot está lleno, el paciente puede unirse a la lista de espera del día. Si hay cancelación, se notifica automáticamente al primero en la lista. Verificable: `POST /api.php?resource=waitlist-join` → entrada en `data/waitlist.json`; al cancelar una cita, `waitlist-notify.php` (cron) notifica al siguiente.

---

## 28. Sprint 28 — Compliance y Confianza Ecuador 2026

> **Propósito:** para que una clínica firme contrato, el responsable legal de la clínica necesita respuestas a preguntas concretas de cumplimiento. Sin esto el ciclo de venta B2B se alarga meses.

#### 28.1 Protección de datos (LOPD Ecuador)

- [x] **S28-01** `[M]` Endpoint de eliminación de datos de paciente — `DELETE /api.php?resource=patient-data-erasure&patient_id=X` elimina o anonimiza todos los datos personales del paciente excepto los que tienen retención legal obligatoria (HCE tiene retención de 10 años en Ecuador). El endpoint requiere autenticación de propietario, genera un log de audit. LOPD Ecuatoriana Art. 22. Verificable: endpoint devuelve `erased_fields`, `retained_fields` con motivo de retención.

- [x] **S28-02** `[M]` Portabilidad de datos del paciente — `GET /api.php?resource=patient-data-export&patient_id=X&format=json` genera un ZIP con toda la información del paciente en formato legible: HCE completa, recetas, citas, pagos, fotos. El paciente puede solicitarlo desde el portal. Verificable: respuesta es un ZIP con al menos `clinical_history.json`, `appointments.json`, `prescriptions.json`.

- [x] **S28-03** `[M]` Audit trail de acceso a datos — registrar en `data/access-log.jsonl` cada vez que se accede a datos de un paciente: quién, cuándo, qué recurso, desde qué IP. Solo visible para el propietario de la clínica. El médico puede ver su propio trail. Sin esto, es imposible responder ante una brecha. Verificable: `GET /api.php?resource=data-access-audit?patient_id=X` → array de `access_events` con `accessor`, `resource`, `ts`.

- [x] **S28-04** `[M]` Consentimiento informado versionado — el texto del consentimiento tiene versión semántica (`v1.2.0`). Al cambiar la versión, todos los pacientes son notificados y deben re-firmar antes del próximo acceso al portal. El sistema registra qué versión firmó cada paciente y cuándo. Verificable: `GET /api.php?resource=consent-status?patient_id=X` → `signed_version`, `current_version`, `needs_renewal: true/false`.

- [x] **S28-05** `[S]` Privacy notice en el booking público — `es/agendar/index.html` debe mostrar enlace a política de privacidad y checkbox de aceptación antes de confirmar el formulario. Sin la aceptación, el botón de confirmar está deshabilitado. Verificable: `grep "privacy.*checkbox\|consent.*booking" es/agendar/index.html` → match; `disabled` en submit sin check.

#### 28.2 Seguridad demostrable

- [x] **S28-06** `[M]` Informe de seguridad exportable — `GET /api.php?resource=security-report` genera un JSON con: última vez que se rotaron las secrets, estado del backup, últimos 5 accesos de admin, CSP activo, versión del sistema, integridad de archivos críticos (hash de `api.php`, `lib/auth.php`). Para uso del responsable de TI de la clínica. Verificable: respuesta incluye `backup_last_at`, `admin_logins_last_5`, `file_integrity`.

- [x] **S28-07** `[M]` Sesiones concurrentes de admin — detectar si el mismo email de administrador tiene sesión activa en más de una IP simultáneamente. Mostrar alerta en el panel: "Tu cuenta tiene una sesión activa desde [IP]. ¿Eres tú?" Con opción de cerrar todas las otras sesiones. Verificable: `GET /api.php?resource=active-sessions` → array de `sessions` con `ip`, `started_at`, `last_active`.

- [x] **S28-08** `[M]` Log de cambios en configuración de clínica — registrar en `data/config-audit.jsonl` cada cambio en `clinic-profile.json`, servicios, precios, horarios. Con quién lo cambió, cuándo, qué campo y valor anterior/nuevo. Crítico para detectar cambios no autorizados. Verificable: `GET /api.php?resource=config-audit-log` → array de `changes` con `field`, `old_value`, `new_value`, `changed_by`, `ts`.

- [x] **S28-09** `[S]` Hardening de headers HTTP — verificar y completar en `Caddyfile`: `Permissions-Policy` (sin acceso a cámara/micrófono excepto en teleconsulta), `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`. Documentar en `SECURITY.md` qué headers están activos y por qué. Verificable: `curl -I https://pielarmonia.com` → `Permissions-Policy` y `Referrer-Policy` presentes; `grep "Permissions-Policy\|Referrer-Policy" ops/caddy/Caddyfile` → match.

- [x] **S28-10** `[M]` Expiración de sesión por inactividad — si el médico no interactúa con el admin en 30 minutos, la sesión expira automáticamente y se muestra modal de re-login. El timer se reinicia con cualquier click/tecla. Sin esto, dejar el admin abierto en la sala de espera es un riesgo. Verificable: `grep "inactivity.*timer\|session.*expire.*inactivity" js/admin.js` → match; timeout configurable desde `clinic-profile.json`.

---

## 29. Sprint 29 — Cierre de Brechas Competitivas y Diferenciación Dermatológica

> **Propósito:** Tareas derivadas del análisis competitivo Ecuador 2026 (Marzo 2026).
> Ningún competidor (CloudMedical, Nimbo, Orpheus, AppsMedical, Karmed) cierra este conjunto completo.
> Las tareas están ordenadas por ROI competitivo: las primeras son las que determinan
> si un médico nos elige en una demo sobre la competencia.
>
> **Agentes disponibles:** `codex_backend_ops` (PHP/API), `codex_frontend` (JS/CSS/HTML), `codex_transversal` (datos/scripts cross-lane).
> **Prerequisito de sprint:** `QA GATE GREEN` — `node bin/qa-summary.js` debe pasar antes de abrir cada tarea.

#### 29.1 CIE-10 Buscador Dermatológico (Diferenciador Clínico)

- [x] **S29-01** `[M]` `[codex_backend_ops]` Base de datos CIE-10 formato cpockets — crear `data/cie10-derm.json` con los códigos dermatológicos exactamente como aparecen en cpockets.com/cie10: sin punto decimal (`L400` no `L40.0`), en MAYÚSCULAS, con campo `code` y `label`. Capítulo XII completo (L00–L99) más oncología de piel (C43–C44, D22–D23), nevo y melanoma. Incluir además códigos dermatológicos frecuentes fuera del capítulo XII: sarna Q85, alopecia Q84, vitíligo (buscar en el buscador de cpockets: "vitiligo" → resultado exacto). Formato de cada entrada: `{ "code": "L400", "label": "PSORIASIS VULGAR", "group": "L40-L45", "groupLabel": "TRASTORNOS PAPULOESCAMOSOS" }`. Total mínimo: 250 entradas. Verificable: `jq 'length' data/cie10-derm.json` → ≥250; `jq '.[] | select(.code=="L400")'` `data/cie10-derm.json` → resultado con `label: "PSORIASIS VULGAR"`.

- [x] **S29-02** `[M]` `[codex_frontend]` Buscador CIE-10 estilo cpockets en el admin — componente `js/cie10-search.js` y su CSS `styles/cie10-search.css`. Interfaz: campo de búsqueda con placeholder "Buscar diagnóstico CIE-10…", resultados en lista plana debajo igual que cpockets.com (fondo gris claro, código en negrita, descripción en mayúsculas), búsqueda por código O por término (`"L400"` y `"psoriasis"` dan el mismo resultado). Click en un resultado lo inyecta en el campo de diagnóstico de la historia clínica. Shortcut de teclado: `Ctrl+K` abre el buscador desde cualquier lugar del admin. Sin scroll infinito: mostrar máximo 20 resultados con mensaje "Refine su búsqueda" si hay más. Verificable: `CIE10Search.search('psoriasis')` devuelve array con al menos `L400`; `CIE10Search.search('L400')` devuelve lo mismo; el buscador se integra en `src/apps/admin-v3/ui/` sin romper el build.

- [x] **S29-03** `[S]` `[codex_frontend]` Integrar buscador CIE-10 en el draft form de historia clínica — en `src/apps/admin-v3/ui/frame/templates/sections/clinical-history.js`, el campo de diagnóstico del formulario draft debe activar el buscador CIE-10 (`CIE10Search`) con un botón "🔍 CIE-10" al lado. Al seleccionar un código, se autocompeta `diagnosisCode` y `diagnosisLabel` en el formulario. Verificable: `grep "CIE10Search\|cie10-search" src/apps/admin-v3/ui/frame/templates/sections/clinical-history.js` → match; el campo de diagnóstico en el admin muestra el botón en pantalla sin errores de consola.

#### 29.2 Historia Clínica Fotográfica — API Backend

- [x] **S29-04** `[M]` `[codex_backend_ops]` Endpoint GET de fotos clínicas por caso — `GET /api.php?resource=clinical-photos&caseId=X` devuelve el array de fotos del caso ordenadas por `capturedAt` ASC. Cada entrada incluye: `id`, `url` (URL pública firmada válida por 1h o path privado según `storageMode`), `thumbnailUrl`, `region` (región anatómica), `notes`, `capturedAt`, `visitLabel` (ej: "Consulta 1", "Consulta 3"). Requiere autenticación de admin. Usa la tabla `clinical_uploads` existente en la DB. Verificable: `curl -H "X-Auth: ..." "/api.php?resource=clinical-photos&caseId=TEST"` → JSON con `photos: []` (vacío si no hay); con datos reales → array con campos completos.
- [x] **S29-05** `[M]` `[codex_backend_ops]` Endpoint POST de upload de foto clínica — `POST /api.php?resource=clinical-photo-upload` con multipart: `caseId`, `region`, `notes`, `photo` (file). Valida: solo imagen (JPEG/PNG/WebP), máximo 10MB, región anatómica requerida. Almacena en `uploads/clinical/{caseId}/` con nombre `{timestamp}-{sha256-short}.{ext}`. Registra en `clinical_uploads` con `kind=clinical_photo`, `storageMode=private_path`. Devuelve el objeto foto creado. Verificable: `curl -X POST -F "photo=@test.jpg" -F "caseId=TEST" -F "region=cara" ...` → `{ "ok": true, "photo": { "id": ..., "url": ..., "region": "cara" } }`; el archivo existe en `uploads/clinical/TEST/`.
- [x] **S29-06** `[S]` `[codex_backend_ops]` Tag de visita en fotos clínicas — al subir una foto, detectar automáticamente a qué número de visita corresponde (contar cuántas `clinical_uploads` con `kind=clinical_photo` existen para ese `caseId` antes de esta) y asignar `visitLabel: "Consulta N"` en `json_data`. Esto permite que la UI agrupe las fotos por consulta sin lógica extra en el frontend. Verificable: después de 3 uploads para el mismo case, `GET clinical-photos` devuelve fotos con `visitLabel: "Consulta 1"`, `"Consulta 2"`, `"Consulta 3"` según orden de creación.

#### 29.3 Recordatorios Automáticos 24h (Motor de Retención)

- [x] **S29-07** `[S]` `[codex_backend_ops]` Registrar recordatorio como cron job documentado — el script `bin/send-appointment-reminders.php` (ya creado) debe quedar documentado en `CRONS.md` con: comando exacto, usuario del sistema, explicación, output esperado, y referencia al `governance/appointment-reminders-log.json` donde se registra cada ejecución. Además, añadir al script la escritura de ese log de gobernanza. Verificable: `cat CRONS.md | grep "send-appointment-reminders"` → presente; `php bin/send-appointment-reminders.php --dry --json` → salida JSON válida con `dryRun: true`.

- [x] **S29-08** `[M]` `[codex_backend_ops]` Recordatorio de seguimiento post-consulta (30 días) — nuevo script `bin/send-followup-reminders.php` que envía un email de seguimiento a pacientes cuya última cita fue exactamente 30 días atrás y que tienen configurado `followup_reminder: true` en `json_data` de la cita. El email invita al paciente a agendar un control o enviar una foto de evolución. Verificable: `php bin/send-followup-reminders.php --dry --json` → JSON con `total`, `sent`, `targetDate` (30 días atrás); el email generado incluye el enlace de agendamiento público `BASE_URL/es/agendar/`.

#### 29.4 Onboarding del Médico (Time-to-Value < 20 minutos)

- [x] **S29-09** `[M]` `[codex_frontend]` Página de bienvenida para médico nuevo — `es/bienvenida-medico/index.html` con 3 pasos: Paso 1 "Configura tu perfil" (foto, bio, nombre completo, especialidad), Paso 2 "Tu enlace de agendamiento" (muestra `pielarmonia.com/es/agendar/` con instrucciones para compartirlo por WhatsApp/Instagram), Paso 3 "Tu primer paciente de prueba" (invita a registrar un paciente ficticio en el admin y crear el primer turno). Diseño: mismo sistema de diseño Aurora (tokens.css, base.css), fondo OLED, tipografía Inter. Sin spinner infinito ni pasos ocultos: todos los pasos son visibles como cards de progreso. Verificable: la página carga en `GET /es/bienvenida-medico/` con status 200; tiene 3 secciones identificadas con `id="paso-1"`, `id="paso-2"`, `id="paso-3"`; Google Lighthouse score ≥ 90 en performance.

- [x] **S29-10** `[S]` `[codex_backend_ops]` Endpoint de setup inicial de perfil de clínica — `POST /api.php?resource=clinic-onboarding` recibe `{ doctorName, specialty, phone, timezone }` y actualiza `data/clinic-profile.json`. Si el archivo no existe, lo crea desde template. Devuelve el perfil actualizado y un `setupScore` (0-100, qué tan completo está el perfil). Verificable: `POST` con datos válidos → `{ "ok": true, "setupScore": 60, "profile": { ... } }`; `GET /api.php?resource=clinic-profile` devuelve los datos guardados.

#### 29.5 Formulario MSP H002 — Requisito Legal Ecuador

- [x] **S29-11** `[L]` `[codex_backend_ops]` Formulario MSP H002 (consulta externa) — estructura PHP `lib/clinical_history/forms/H002Form.php` que mapea los campos de la historia clínica al formulario oficial del Ministerio de Salud del Ecuador. Campos requeridos: motivo de consulta, enfermedad actual (anamnesis), antecedentes personales/familiares, revisión de sistemas, examen físico por sistemas, diagnóstico CIE-10 (exactamente como en cpockets.com: sin punto, MAYÚSCULAS), plan de tratamiento, indicaciones de seguimiento. El formulario debe poder serializar a JSON (para guardado) y renderizar como PDF (para impresión). La clase debe extender o implementar la misma interfaz que los otros formularios de HCE. Verificable: `php -r "require 'lib/clinical_history/forms/H002Form.php'; $f = new H002Form(); echo $f->getFormId();"` → `H002`; serialización → JSON con todos los campos mencionados; existe test `tests-node/h002-form-contract.test.js` que verifica los campos obligatorios.

- [x] **S29-12** `[M]` `[codex_frontend]` UI del formulario H002 en el admin — en el workbench de historia clínica, añadir una tab "📋 H002 — MSP" junto a las tabs existentes. El formulario renderiza los campos del H002 con los mismos estilos del design system Aurora: labels, textareas, el buscador CIE-10 integrado en el campo de diagnóstico. Al guardar, llama al endpoint de guardado de HCE existente con `formType: "H002"`. Verificable: la tab H002 aparece en el admin sin errores de consola; el campo de diagnóstico tiene el botón CIE-10 (de S29-03); `grep "H002\|h002" src/apps/admin-v3/ui/frame/templates/sections/clinical-history.js` → match.

#### 29.6 Confirmación WhatsApp Bidireccional

- [x] **S29-13** `[M]` `[codex_backend_ops]` Deeplink de WhatsApp personalizado en email de confirmación de cita — en `lib/email.php`, función `build_confirmation_email_html()` debe incluir un botón "Confirmar asistencia por WhatsApp" cuyo href sea `https://wa.me/{CLINIC_WA_NUMBER}?text=Confirmo+mi+cita+del+{DATE}+a+las+{TIME}` con los datos reales de la cita. El mensaje debe estar codificado en URL. El botón usa el color primario de la clínica desde `clinic-profile.json`. Verificable: `php -r "require 'lib/email.php'; echo build_confirmation_email_html(['date'=>'2026-06-01','time'=>'10:00','name'=>'Test']);" | grep "wa.me"` → match con el número de la clínica y la fecha.

- [x] **S29-14** `[S]` `[codex_backend_ops]` Endpoint de check-in por QR/código — `POST /api.php?resource=appointment-checkin` recibe `{ token: "RESCHEDULE_TOKEN" }` y confirma la asistencia del paciente, cambiando `status` de `confirmed` a `checked_in` y registrando `checked_in_at` en `json_data`. Esto permite que el kiosco del turnero haga check-in automático cuando el paciente llega. Verificable: `POST` con token válido → `{ "ok": true, "appointment": { "id": ..., "status": "checked_in", "checked_in_at": "..." } }`; el status cambia en la DB.

#### 29.7 Dashboard de Métricas de Negocio (Retention Hook)

- [x] **S29-15** `[M]` `[codex_backend_ops]` Endpoint de métricas de negocio para el médico — `GET /api.php?resource=business-metrics&period=30d` devuelve: `patients_seen` (pacientes atendidos en el período), `appointments_total`, `no_show_rate` (porcentaje de no-shows), `new_patients` (pacientes que agendaron por primera vez), `top_services` (array de servicios más solicitados con count), `revenue_estimate` (si el médico tiene precios configurados). Requiere autenticación de admin. Verificable: respuesta JSON con todos los campos; `patients_seen` ≥ 0; `no_show_rate` es float entre 0 y 1; con datos reales → `top_services` no está vacío.

- [x] **S29-16** `[M]` `[codex_frontend]` Widget de métricas en el dashboard del admin — añadir en la sección principal del admin una fila de 4 KPI cards: "Pacientes (30 días)", "Tasa de no-show", "Nuevo esta semana", "Servicio top". Cada card tiene número grande, delta vs período anterior (↑↓), y mini sparkline. Datos desde el endpoint S29-15. Se actualiza al cargar el admin. Diseño: glassmorphism, colores Aurora, animación de contador al aparecer. Verificable: `grep "business-metrics\|S29-15" src/apps/admin-v3/ui/" → match; los 4 KPIs son visibles en el admin sin errores; no rompe los tests existentes.

#### 29.8 Gobernanza del Sprint

- [x] **S29-17** `[S]` `[codex_transversal]` Smoke test del Sprint 29 — `tests-node/sprint29-smoke.test.js` que verifica: (1) `data/cie10-derm.json` existe y tiene ≥250 entradas en formato correcto; (2) `bin/send-appointment-reminders.php --dry --json` sale con código 0 y JSON válido; (3) `GET /api.php?resource=clinical-photos&caseId=NONEXISTENT` (con auth mock) no lanza 500 sino 200 con `photos:[]`; (4) `js/cie10-search.js` y `styles/cie10-search.css` existen; (5) `js/clinical-photo-timeline.js` tiene ≥ 400 líneas (no está vacío); (6) `es/bienvenida-medico/index.html` existe. Verificable: `node --test tests-node/sprint29-smoke.test.js` → `pass 6 / fail 0`.

- [x] **S29-18** `[S]` `[codex_transversal]` Actualizar workspace hygiene contract para Sprint 29 — en `tests-node/workspace-hygiene-contract.test.js`, añadir a la lista de archivos esperados: `data/cie10-derm.json`, `js/cie10-search.js`, `styles/cie10-search.css`, `js/clinical-photo-timeline.js`, `styles/clinical-photo-timeline.css`, `bin/send-appointment-reminders.php`, `bin/send-followup-reminders.php`, `es/bienvenida-medico/index.html`, `tests-node/sprint29-smoke.test.js`. Verificable: `node --test tests-node/workspace-hygiene-contract.test.js` → `pass 36 / fail 0` (o el número actualizado).

- [x] **S29-19** `[S]` `[codex_transversal]` Añadir Sprint 29 al gov:audit — en `bin/audit.js`, registrar como step: `node --test tests-node/sprint29-smoke.test.js` con `id: 'sprint29_smoke'`, `optional: false`. Esto lo hace parte del gate diario. Verificable: `npm run gov:audit:json --silent | jq '.steps[] | select(.id=="sprint29_smoke") | .ok'` → `true` cuando todos los entregables del sprint están completos.

---

## 🎨 Sprint UI — Fase 5: Interfaces Clínicas (GEMINI EXCLUSIVO)

> **Responsable:** Gemini bajo supervisión de Antigravity.
> **Regla única:** cada interfaz debe ser funcional Y visualmente de primer nivel. El médico pasa 8h mirando el admin — debe ser premium.
> **Sistema:** Liquid Glass + `reborn-tokens.css`. Cero estilos inline, cero `!important`.

#### UI5-A Admin Panel — La consulta como arte

- [x] **UI5-01** `[L]` `[UI]` Sidebar de admin glass pill — `admin.html`: reemplazar sidebar plano por sidebar glass pill vertical: logo, grupos colapsables, perfil médico abajo con avatar. Active state: gold pill. `position: sticky`, scrollable en móvil. Verificable: `grep "sidebar.*glass\|nav.*pill.*admin" styles/aurora-admin.css` → match ≥3.

- [x] **UI5-02** `[XL]` `[UI]` Cabecera de caso activo fija — al abrir un caso: cabecera glass con foto del paciente (56px), nombre grande, y 3 pills de contexto: diagnóstico activo (gold), alergias (amber/green), turno. Persiste al scrollear. Verificable: `grep "case-header.*sticky\|patient.*context.*pill" js/admin.js` → match.

- [x] **UI5-03** `[L]` `[UI]` Chat OpenClaw estilo ChatGPT flat — mensajes sin burbujas: fondo `lg-surface` sutil, texto IA en blanco tiza, texto médico en gold tenue. Input píldora fijo en bottom. Cursor blink CSS mientras responde. Verificable: `grep "chat-flat\|blink.*cursor\|openclaw.*pill" styles/aurora-clinical.css` → match ≥3.

- [x] **UI5-04** `[M]` `[UI]` Cards de sugerencia CIE-10 glass flotantes — cuando OpenClaw sugiere diagnóstico: cards flotantes con `backdrop-filter: blur(16px)`, código en mono dorado, botón "Aplicar" que se ilumina al hover. Entran con spring `translateY(-8px) → 0`. Verificable: `grep "cie10.*card.*glass\|suggestion.*card.*spring" styles/aurora-clinical.css` → match.

- [x] **UI5-05** `[M]` `[UI]` Barra de alergias sticky — encima del campo de prescripción: barra fija amber translúcido con alergias del paciente en pills. Verde translúcido si no hay alergias. Nunca en un tab. Verificable: `grep "allergy-bar.*sticky\|allergy.*amber" styles/aurora-clinical.css` → match; `position: sticky` en DOM.

- [x] **UI5-06** `[L]` `[UI]` Focus Mode de consulta — clase `.focus-mode` en `admin.html` al iniciar consulta: oculta sidebar con `translateX(-100%)` animado, amplía área de trabajo, topbar mínima con nombre + timer. Al salir, sidebar regresa con spring. Verificable: `grep "focus-mode\|consultation.*timer\|sidebar.*hide" js/admin.js` → match.

- [x] **UI5-07** `[L]` `[UI]` Timeline de visitas HCE glass — historial del paciente como stepper vertical glass: nodo 40px con fecha, color por tipo (gold=consulta, blue=procedimiento, red=urgencia). Click expande con `max-height spring. Verificable: `grep "hce.*timeline\|visit.*stepper\|episode.\*expand" styles/aurora-admin.css` → match.

#### UI5-B Booking — Agendar como una app premium

- [x] **UI5-08** `[XL]` `[UI]` Booking flow wizard 4 pasos — `es/agendar/index.html`: reemplazar formulario plano por wizard tipo Typeform: 1) servicio (cards glass), 2) fecha/hora (calendar glass), 3) datos paciente (inputs grandes), 4) confirmación + pago. Transición `translateX(100%→0)` spring entre pasos. Verificable: `grep "booking-step\|step.*active\|wizard.*step" es/agendar/index.html` → match; 4 pasos.

- [x] **UI5-09** `[L]` `[UI]` Cards de selección de servicio visual — grid de servicios: imagen, nombre grande, duración en pill gold, precio. Hover: `scale(1.02)` + borde gold. Seleccionado: checkmark gold animado. Verificable: `grep "service-card.*glass\|service.*check" es/agendar/index.html` → match ≥3.

- [x] **UI5-10** `[L]` `[UI]` Calendario de disponibilidad glass — grid de días como pills: disponibles=glass, sin disponibilidad=opacidad 0.3, seleccionado=glass gold sólido. Pills de horas abajo, scroll horizontal en móvil. Verificable: `grep "calendar.*glass\|slot.*pill\|day.*available" es/agendar/index.html` → match ≥4.

- [x] **UI5-11** `[M]` `[UI]` Confirmation screen booking — card glass con: servicio, fecha, médico, precio + IVA desglosado. CTA "Confirmar y pagar" gold sólido. Iconos de seguridad debajo. Verificable: `grep "booking-confirm.*glass\|iva.*desglose\|security.*badge" es/agendar/index.html` → match ≥3.

#### UI5-C Portal del Paciente — Clínica en el bolsillo

- [x] **UI5-12** `[XL]` `[UI]` Dashboard del paciente con datos reales — `es/portal/index.html`: saludo grande dinámico, 3 cards glass: próxima cita real, último diagnóstico, documentos disponibles. Dark theme navy. Sin placeholders. Verificable: `grep "portal-greeting\|next-appointment.*live\|lg-surface--dark.*portal" es/portal/index.html` → match ≥4.

- [x] **UI5-13** `[L]` `[UI]` Lista de documentos descargables glass — `es/portal/historial/index.html`: rows glass con tipo (pill gold "Receta"/cyan "Certificado"), fecha, médico, botón descarga. Hover: row glass highlight. Click: descarga PDF con token. Verificable: `grep "document-row.*glass\|download.*token\|prescription.*pill" es/portal/historial/index.html` → match ≥3.

- [x] **UI5-14** `[M]` `[UI]` Card de plan de tratamiento — `es/portal/index.html`: si hay plan activo: diagnóstico principal grande, medicamentos en pills (nombre + frecuencia), próximo control con badge countdown. Si no hay plan: estado vacío elegante. Verificable: `grep "treatment-plan.*card\|medication.*pill.*portal" es/portal/index.html` → match.

- [x] **UI5-15** `[M]` `[UI]` Historial de pagos glass — `es/portal/pagos/index.html` (nuevo): lista de pagos glass: fecha, servicio, monto bold, método pill, estado (pagado=green, pendiente=amber). Footer con total. Verificable: `grep "payment-row.*glass\|total.*paid\|status.*pill.*payment" es/portal/pagos/index.html` → match ≥3; página nueva creada.

#### UI5-D Turnero — Lo que el paciente ve

- [x] **UI5-16** `[L]` `[UI]` Pantalla TV de sala de espera — `queue-display.html`: izquierda 60% lista de turnos esperando (número, nombre parcial, tiempo estimado); derecha 40% turno llamado en grande con pulse ring gold. Fondo navy. Tipografía mínimo 48px para número. Verificable: `grep "queue-display.*glass\|pulse.*ring\|called.*display" queue-display.html` → match ≥3.

- [x] **UI5-17** `[L]` `[UI]` Kiosk de registro 3 opciones — `queue-kiosk.html`: 3 cards glass grandes: "Tengo cita", "Soy nuevo", "Urgencia". Input grande de cédula/nombre al seleccionar. Submit gold. Confirmación con número de turno y checkmark animado. Sin elementos admin visibles. Verificable: `grep "kiosk-options\|kiosk.*cita\|turno.*confirmado" queue-kiosk.html` → match ≥3.

- [x] **UI5-18** `[M]` `[UI]` Panel del operador de turnero — `queue-operator.html`: botón grande "Llamar siguiente" glass gold, nombre del paciente llamado aparece con fade-in grande, historial de turnos llamados en lista compacta. Verificable: `grep "queue-call.*btn\|called.*patient.*name\|call-history" queue-operator.html` → match ≥3.

#### UI5-E Micro-UX de Primer Nivel

- [x] **UI5-19** `[M]` `[UI]` Toast notifications glass system — `js/aurora-toast.js` (nuevo): reemplaza todos los `alert()` del sistema. Toasts en bottom-right, glass, ícono de estado, desaparecen en 4s con `opacity: 1→0` spring. API: `window.toast.show('msg', 'success'|'error'|'warning'|'info')`. Verificable: `grep "window.toast\|toast.*glass\|toast.*spring" js/aurora-toast.js` → match; archivo nuevo.

- [x] **UI5-20** `[M]` `[UI]` Skeleton screens glass — reemplazar spinners con skeletons glass en: lista de pacientes, carga de HCE, resultados OpenClaw. Shimmer: `background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 50%, ...)` en loop. Verificable: `grep "skeleton.*glass\|skeleton.*shimmer" styles/aurora-admin.css` → match ≥3; 0 spinners durante carga.

- [x] **UI5-21** `[M]` `[UI]` Empty states ilustrados — cuando no hay datos: ilustración SVG minimalista + título `clamp(1.2rem,3vw,1.8rem)` + CTA contextual glass. Sin texto plano "No hay registros." en ninguna surface. Verificable: `grep "empty-state\|empty.*svg\|empty.*cta" styles/aurora-admin.css` → match ≥3.

- [x] **UI5-22** `[S]` `[UI]` Modo oscuro consistente — auditar `admin.html`, `kiosk.html`, `queue-display.html`, portal y booking: background base `var(--rb-bg, #050810)` en todas. Verificable: `grep -r "background.*#fff\|background.*white" styles/aurora-admin.css styles/aurora-clinical.css` → 0 matches.

---

## 30. Sprint 30 — Emergencias de Auditoría Frontend (2026-03-31)

> **Origen:** Auditoría visual en vivo con browser agent. Se identificaron 3 bloqueadores críticos
> que harían fallar cualquier demo comercial frente a Nimbo o CloudMedical.
> **Prioridad:** Estas tareas van ANTES que cualquier feature nueva.
> Las tareas S30-01 a S30-03 son CRITICAL (rompen demos). S30-04 a S30-08 son HIGH.

#### 30.1 CRITICAL — Bloqueadores de demo

- [x] **S30-01** `[M]` `[codex_frontend]` 🚨 Booking form vacío — la lista de servicios no se renderiza — `es/agendar/` muestra "¿Qué tipo de cita necesita?" pero sin opciones. El problema es que `agendar.js` carga los servicios desde `data/services.json` o `clinic-profile.json` pero falla silenciosamente: o el JSON no existe, o el fetch falla en local, o el DOM target selector no coincide. Diagnóstico: abrir `es/agendar/agendar.js`, encontrar la función que inyecta los servicios, agregar un fallback con servicios hardcodeados si el fetch falla, y asegurarse que el selector DOM sea correcto. También aplicar las mismas clases CSS del design system (glassmorphism, fondo OLED). Verificable: `GET /es/agendar/` muestra mínimo 3 opciones de servicio clicables (Consulta Dermatológica, Teledermatología, Procedimiento Estético); Lighthouse score ≥ 85; sin errores en consola.

- [x] **S30-02** `[M]` `[codex_frontend]` 🚨 Kiosco expone logs internos de gobernanza — `kiosco-turnos.html` muestra texto de sistema ("Kiosk surface recovery", "Bloqueado · 1/4 superficies listas", "Gate blocked · 27", scores y manifests) en lugar de la UI de pacientes. Este texto proviene de un sistema de inicialización que falla y cae en modo "recovery display". Solución: (1) encontrar el script de inicialización que genera estos logs (probablemente un `boot.js` o `kiosco-init.js`), (2) hacer que los mensajes de debug/recovery nunca sean visibles para el paciente — solo en `localStorage` o `console.log`, (3) asegurarse que la UI de "¿Tiene cita?" siempre se muestra incluso si el sistema de gobernanza no está 100% listo. La UI de fallback debe tener: título "Aurora Derm · Kiosco", dos botones grandes "Tengo cita" y "Registrarme", branding. Verificable: `GET /kiosco-turnos.html` → 0 textos de sistema visibles para el usuario; los 2 botones de acción son el foco principal.

- [x] **S30-03** `[M]` `[codex_frontend]` 🚨 Sala TV y Operador expone logs de gobernanza — mismo problema que S30-02 pero en `sala-turnos.html` y `operador-turnos.html`. La sala TV muestra texto de "Fleet readiness", scores, "Decision hold-package-standardization" en lugar de la pantalla de turnos para pacientes. Solución idéntica: separar los logs de gobernanza de la UI pública. La sala TV debe mostrar: reloj grande (ya funciona), turno en pantalla ("Turno #12 — Sala 1"), y lista de siguientes turnos. Si no hay turnos activos, mostrar pantalla de bienvenida con logo Aurora Derm. Verificable: `GET /sala-turnos.html` → único texto visible son el reloj, turnos, y branding. `GET /operador-turnos.html` → botón "Llamar siguiente" es el elemento más prominente.

#### 30.2 HIGH — Gaps de UX en demo

- [x] **S30-04** `[M]` `[codex_frontend]` Booking form sin CSS del design system — `es/agendar/` tiene fondo blanco, tipografía del sistema, sin glassmorphism. El formulario debe compartir el mismo lenguaje visual que el landing page: fondo `#050810` o gradiente oscuro, cards de servicio con borde glass (`rgba(255,255,255,0.08)`), tipografía Inter, colores Aurora primarios. Verificar que `styles/tokens.css` y `styles/base.css` están linkeadas en `es/agendar/index.html`. Verificable: `grep "tokens.css\|base.css" es/agendar/index.html` → match; página carga con fondo oscuro; los servicios tienen aspecto de card glassmorphism.

- [x] **S30-05** `[S]` `[codex_frontend]` Cards de servicio con precio y duración en el booking — actualmente el Paso 1 solo muestra el nombre del servicio. CloudMedical muestra precio y duración en cada card para ayudar al paciente a elegir. Añadir a cada opción de servicio: nombre, precio (si está en `clinic-profile.json`), duración estimada (ej. "45 min"), y un ícono de la especialidad. Layout: grid 2 columnas en desktop, 1 en móvil. Verificable: cada card de servicio muestra al menos nombre y duración; `grep "duracion\|duration\|precio\|price" es/agendar/agendar.js` → match.

- [x] **S30-06** `[S]` `[codex_frontend]` Foto y bio del médico en Paso 2 del booking — el Paso 2 "Seleccionar médico" debe mostrar foto de perfil (si existe en `clinic-profile.json`), nombre, especialidades y un badge "Disponible hoy". Esto reduce abandono del formulario. Si no hay foto, mostrar avatar con iniciales. Verificable: `GET /es/agendar/` → avanzar al paso 2 → médico aparece con avatar y nombre; sin errores de consola.

- [x] **S30-07** `[S]` `[codex_frontend]` Trust badges en la web pública — la auditoría reveló que no hay credenciales ni social proof en el hero. Añadir debajo del CTA principal: "✓ MSP Ecuador", "✓ Datos cifrados", "✓ Sin papelería", "✓ Historial fotográfico". Formato: fila de pills/chips pequeños con ícono de check dorado. Posición: entre el CTA y las cards de servicios. Verificable: `grep "MSP\|cifrado\|historial fotogr" es/index.html` → match; los badges son visibles sin scroll en desktop.

- [x] **S30-08** `[M]` `[codex_frontend]` Foto de la doctora en el hero de la web pública — la auditoría reveló que el hero no tiene elemento humano. Añadir una columna derecha al hero con una imagen representativa (puede ser un placeholder elegante con gradiente morado/índigo y un avatar médico SVG). Esto convierte el CTR del CTA principal en 2-3x según benchmarks médicos. Formato: imagen circular con glow effect `box-shadow: 0 0 40px rgba(99,102,241,0.3)`. Verificable: el hero tiene 2 columnas en desktop (copy + imagen); la imagen ocupa la columna derecha con al menos 280px de ancho.

#### 30.3 Gobernanza del sprint

- [x] **S30-09** `[S]` `[codex_transversal]` Smoke test `sprint30-smoke.test.js` — verifica: (1) `GET /es/agendar/` → response 200 + body contiene al menos 1 elemento con clase relacionada al servicio; (2) `GET /kiosco-turnos.html` → body NO contiene "Gate blocked" NI "surface recovery" NI "Bloqueado ·"; (3) `GET /sala-turnos.html` → body NO contiene "Fleet readiness" NI "Score"; (4) `GET /es/index.html` → cuerpo contiene "MSP\|cifrado"; (5) `es/agendar/index.html` contiene link a `tokens.css`. Verificable: `node --test tests-node/sprint30-smoke.test.js` → `pass 5 / fail 0`.

- [x] **S30-10** `[S]` `[codex_transversal]` Actualizar gov:audit con sprint30 smoke test — añadir en `bin/audit.js` el step `{ id: 'sprint30_smoke', cmd: 'node --test tests-node/sprint30-smoke.test.js', optional: false }`. Verificable: `npm run gov:audit:json --silent | jq '.steps[] | select(.id=="sprint30_smoke")'` → existe.

---

## 30. Sprint 30 — Clínica de Verdad: Lo Que el Paciente Necesita

> **Por qué existe este sprint:** en una consulta médica real, el médico registra signos vitales en cada visita, ordena laboratorios y espera resultados, refiere a especialistas y hace seguimiento de ese referido, y alerta a sus pacientes crónicos cuando no vuelven. Todo eso existe en el backend de Aurora Derm como estructura — pero no como funcionalidad operativa. Este sprint lo convierte en realidad.

---

### 30.1 Signos Vitales por Consulta

> **Contexto clínico:** los signos vitales son el primer acto médico en cualquier consulta. Presión arterial, frecuencia cardíaca, temperatura, saturación de oxígeno, peso y escala de dolor. Sin ellos, la HCU-005 está incompleta y el sistema no puede detectar deterioro del paciente entre visitas. Ecuador exige su registro en la historia clínica oficial.

- [x] **S30-01** `[M]` `[codex_backend]` Modelo de signos vitales por visita — añadir en `normalizeIntake()` de `ClinicalHistorySessionRepository.php` el objeto `vitalSigns` con los campos obligatorios del MSP Ecuador: `bloodPressureSystolic` (int, mmHg), `bloodPressureDiastolic` (int, mmHg), `heartRate` (int, bpm), `respiratoryRate` (int, rpm), `temperatureCelsius` (float, °C), `spo2Percent` (int, %), `weightKg` (float), `heightCm` (float, opcional), `bmi` (float, calculado automático si peso y talla presentes), `glucometryMgDl` (int, opcional, en ayunas/postprandial), `painScale` (int 0-10, escala EVA). Todos los campos son `nullable` — solo se registran los que la enfermera toma. Los valores fuera de rango clínico típico generan un campo `vitalAlerts: string[]` calculado automáticamente. Verificable: `POST clinical-history-session` con `intake.vitalSigns.bloodPressureSystolic: 180` → respuesta incluye `vitalAlerts: ["Presión sistólica elevada"]`; `grep "vitalSigns\|bloodPressureSystolic" lib/clinical_history/ClinicalHistorySessionRepository.php` → match.

- [x] **S30-02** `[M]` `[codex_backend]` Endpoint de registro de signos vitales — `POST /api.php?resource=clinical-vitals` recibe: `session_id`, `case_id`, y el objeto `vital_signs` del modelo S30-01. La enfermera/recepcionista los registra ANTES de que el médico abra el caso (flujo admisión). Guardar en `intake.vitalSigns` de la sesión activa. Retornar `vital_alerts` si algún valor está fuera de rango. Verificable: `POST clinical-vitals` con `vital_signs.spo2Percent: 88` → `{ ok: true, vital_alerts: ["SpO2 baja — considerar oximetría de control"] }`.

- [x] **S30-03** `[M]` `[codex_backend]` Historial de signos vitales del paciente — `GET /api.php?resource=patient-vitals-history?case_id=X` retorna un array cronológico de todas las tomas de signos vitales del paciente ordenadas por fecha, con `session_id`, `appointment_date`, y los valores. Permite ver si la PA del paciente sube consistentemente entre visitas — el médico lo detecta sin calcularlo manualmente. Verificable: respuesta tiene `vitals: [{date, bloodPressureSystolic, bloodPressureDiastolic, heartRate, spo2Percent}]` con al menos los campos presentes en el historial.

- [x] **S30-04** `[S]` `[codex_backend]` Alertas automáticas de signos vitales críticos — al guardar vitales con `clinical-vitals`, si algún valor supera umbrales críticos (PA sistólica >180, SpO2 <90, FC >130 o <45, temperatura >39.5°C), agregar un evento `vital_alert_critical` en el log de sesión y devolver el alert en la respuesta de `openclaw-chat` la próxima vez que el médico abra el chat. OpenClaw debe mencionar proactivamente: "Nota: el paciente llegó con PA 190/110 — relevante para el diagnóstico." Verificable: `GET openclaw-patient?case_id=X` cuando el session activo tiene `vitalAlerts` → el campo `critical_vitals` aparece con los alerts en la respuesta.

---

### 30.2 Ingesta Real de Resultados de Laboratorio e Imagen

> **Contexto clínico:** hoy las órdenes de laboratorio se crean (`create-lab-order`) y se emiten (`issue-lab-order`) pero los resultados (`resultStatus: not_received`) nunca entran al sistema. El médico recibe el PDF de resultados por WhatsApp o en papel, y lo archiva en su mente. El sistema no aprende. Aurora Derm no puede hacer seguimiento clínico sin resultados reales.

- [x] **S30-05** `[L]` `[codex_backend]` Endpoint de recepción de resultado de laboratorio — `POST /api.php?resource=receive-lab-result` con campos: `session_id`, `lab_order_id`, `result_date` (ISO), `lab_name` (string), `values` (array de `{test_name, value, unit, reference_range, status: 'normal'|'low'|'high'|'critical'}`), `summary` (string libre del médico), `pdf_url` (opcional). Actualiza `labOrder.resultStatus: 'received'`, persiste `result` en la orden, y lanza evento `lab_result_received`. Si algún valor tiene `status: 'critical'`, el evento se marca como `critical: true`. Verificable: `POST receive-lab-result` con un valor `creatinina: 9.2 mg/dL, status: critical` → `{ ok: true, critical_values: ["creatinina 9.2 — CRÍTICO"] }`; `labOrder.resultStatus === 'received'` en store.

- [x] **S30-06** `[M]` `[codex_backend]` Upload de PDF de resultado de laboratorio — `POST /api.php?resource=clinical-lab-pdf-upload` con `session_id`, `lab_order_id`, y el PDF en `multipart/form-data`. Guarda el archivo en `data/clinical-media/{case_id}/lab-results/` con nombre `{labOrderId}_{timestamp}.pdf`. Actualiza `labOrder.result.pdfUrl`. Retorna URL firmada de descarga. Sin esto, el médico tiene el PDF en papel pero no en la HCE. Verificable: upload de PDF → `{ ok: true, pdf_url: '/api.php?resource=clinical-lab-pdf&id=...' }`; archivo existe en `data/clinical-media/`.

- [x] **S30-07** `[M]` `[codex_backend]` Alerta de resultados críticos de laboratorio al médico — cuando `receive-lab-result` registra un valor `status: critical`, enviar WhatsApp al médico propietario del caso: "⚠️ Resultado crítico en caso [nombre paciente]: [test] = [valor]. Revisar urgente." El mensaje incluye link al admin. Verificable: `php bin/test-lab-alert.php` → WhatsApp generado con los datos del caso y el valor crítico; `grep "critical.*lab\|lab.*critical" bin/notify-lab-critical.php` → match.

- [x] **S30-08** `[M]` `[codex_backend]` Cron de laboratorios pendientes — `bin/check-pending-labs.php`: recorre todos los casos abiertos con `labOrders` en estado `issued` y `resultStatus: not_received` donde la fecha de emisión fue hace más de 5 días. Para cada uno, envía un recordatorio por WhatsApp al paciente: "Sus resultados de [lab_name] ya deberían estar listos. Por favor visítenos para revisarlos." Registra el envío para no duplicar. Verificable: `php bin/check-pending-labs.php --dry` → lista correcta de casos con labs pendientes vencidos.

- [x] **S30-09** `[M]` `[codex_backend]` Endpoint de recepción de resultado de imagen — `POST /api.php?resource=receive-imaging-result` con: `session_id`, `imaging_order_id`, `result_date`, `radiologist_name`, `modality` (eco/rx/ct/rm), `report_text` (informe del radiólogo en texto plano), `impression` (impresión diagnóstica), `pdf_url` (opcional). Actualiza `imagingOrder.resultStatus: 'received'`. Verificable: `POST receive-imaging-result` con `impression: "Quiste sebáceo 2cm en región dorsal"` → store actualizado con `resultStatus: received` e `impression` guardada.

---

### 30.3 Seguimiento Proactivo del Paciente Crónico

> **Contexto clínico:** en Ecuador, un paciente con hipertensión o diabetes debería volver cada 3 meses. Si no vuelve, el médico no lo sabe — no hay sistema que le avise. El paciente se deteriora en silencio. Este es el punto donde la tecnología salva vidas reales.

- [x] **S30-10** `[M]` `[codex_backend]` Modelo de enfermedades crónicas activas — en la HCE del paciente, añadir `chronicConditions: [{cie10Code, cie10Label, diagnosedAt, controlFrequencyDays, lastControlDate, nextControlDue, status: 'controlled'|'uncontrolled'|'lost_to_followup'}]`. Al guardar un diagnóstico de condición crónica (HTA: I10, DM2: E11.9, EPOC: J44.9, hipotiroidismo: E03.9, entre otros), el sistema pregunta automáticamente: "¿Desea agregar este diagnóstico a las condiciones crónicas del paciente con seguimiento cada X días?" Verificable: `POST openclaw-save-diagnosis` con `cie10_code: I10` → respuesta incluye `chronic_condition_detected: true, suggested_followup_days: 90`.

- [x] **S30-11** `[L]` `[codex_backend]` Cron de pacientes crónicos vencidos de control — `bin/check-chronic-followup.php`: recorre todos los pacientes con `chronicConditions` donde `nextControlDue` ya pasó y el paciente no tiene cita futura. Genera un reporte en `data/follow-up-alerts.json` y envía WhatsApp al paciente: "Estimado/a [nombre]: su control de [condición] estaba programado para [fecha]. Lo esperamos en Aurora Derm para continuar su seguimiento. Llame al [teléfono] o agende en [link]." Verificable: `php bin/check-chronic-followup.php --dry` → lista de pacientes con condición, fecha vencida, y mensaje generado.

- [x] **S30-12** `[M]` `[codex_backend]` Panel de pacientes crónicos para el médico — `GET /api.php?resource=chronic-panel` retorna: lista de pacientes con condiciones crónicas activas, estado de control (al día / vencido / nunca controló), fecha del último control, días de atraso si aplica. Ordenado por urgencia (más atrasado primero). Solo accesible con rol médico. Verificable: respuesta tiene `patients: [{case_id, name, conditions, last_control, days_overdue, status}]`; `days_overdue` > 0 para los que están atrasados.

- [x] **S30-13** `[M]` `[codex_backend]` Indicador de adherencia a tratamiento — al emitir una receta, calcular cuántas unidades prescribe y cuándo debería terminarse. En la siguiente visita, comparar la fecha prevista con la real. Si el paciente vino mucho antes → posible efecto adverso. Si vino mucho después → posible no adherencia. Guardar `adherence_score: 'on_time'|'early'|'late'|'unknown'` por episodio. Verificable: `GET patient-ltv?case_id=X` → incluye `medication_adherence` con el historial de adherencia.

---

### 30.4 Interconsultas con Cierre Real

> **Contexto clínico:** cuando un médico general refiere a un especialista, ese referido queda en el limbo. En Aurora Derm, `issue-interconsultation` emite el documento — pero `receive-interconsult-report` que ya existe en el backend nunca se llama porque no hay endpoint accesible ni flujo para que el médico reciba la respuesta del especialista.

- [x] **S30-14** `[M]` `[codex_backend]` Endpoint para recibir reporte de interconsulta — `POST /api.php?resource=receive-interconsult-report` (ruta ya existe internamente pero no está expuesta en `routes.php`). Payload: `session_id`, `interconsult_id`, `specialist_name`, `specialist_specialty`, `report_date`, `findings` (texto), `recommendations` (texto), `new_diagnoses` (array de CIE-10), `follow_up_required` (bool). Al recibirse, el estado de la interconsulta pasa a `report_received` y se dispara una notificación al médico que la emitió. Verificable: `POST receive-interconsult-report` → `interconsultation.status === 'report_received'`; ruta registrada en `routes.php`.

- [x] **S30-15** `[S]` `[codex_backend]` Cron de interconsultas sin respuesta — `bin/check-pending-interconsults.php`: interconsultas en estado `issued` con más de 30 días sin `report_received` → generar reporte en `data/interconsult-alerts.json` y enviar WhatsApp al médico emisor: "La interconsulta enviada a [especialista] para [nombre paciente] lleva 30 días sin respuesta. ¿Desea hacer seguimiento?" Verificable: `php bin/check-pending-interconsults.php --dry` → lista correcta de interconsultas vencidas.

---

### 30.5 Seguridad Clínica Específica

> **Contexto clínico:** hay dos responsabilidades que no están cubiertas y que en medicina tienen consecuencias legales — verificar si el paciente está embarazada antes de prescribir teratógenos, y registrar el consentimiento específico para procedimientos (no solo el consentimiento general de datos).

- [x] **S30-16** `[M]` `[codex_backend]` Check de teratogenicidad en prescripción — en `openclaw-check-interactions`, añadir un segundo check: si el paciente **es mujer en edad fértil** (18-50 años) y `intake.datosPaciente.embarazo` es `null` (desconocido), y la prescripción incluye medicamentos de categoría X o D (isotretinoína, metotrexato, warfarina, litio, valproato, tetraciclinais), devolver `teratogenicity_warning: true` con mensaje: "Este medicamento es teratogénico. Confirme que la paciente no está embarazada antes de prescribirlo." No bloquear — solo requerir confirmación explícita. Verificable: `POST openclaw-check-interactions` con paciente femenina edad-fértil + isotretinoína → `{ teratogenicity_warning: true, drugs_at_risk: ["isotretinoína"] }`.

- [x] **S30-17** `[M]` `[codex_backend]` Consentimiento específico por procedimiento — hoy el sistema tiene consentimiento general de tratamiento de datos. Añadir `procedure_consents: [{procedure_name, risks_explained, patient_confirmed, signed_at, doctor_id}]` en el draft. Antes de registrar en la HCE un procedimiento como "electrocoagulación", "crioterapia", "aplicación de toxina botulínica" o "peelings profundos", verificar que existe un `procedure_consent` firmado para ese procedimiento específico en la sesión actual. Sin consentimiento: la API devuelve `consent_required: true`. Verificable: `POST clinical-episode-action` con `action: complete_procedure` y `procedure: crioterapia` sin consent → `{ ok: false, consent_required: true, procedure: "crioterapia" }`.

- [x] **S30-18** `[M]` `[codex_backend]` Registro de reacciones adversas a medicamentos — nuevo endpoint `POST /api.php?resource=adverse-reaction-report` con: `case_id`, `drug_name`, `reaction_description`, `severity: mild|moderate|severe|life_threatening`, `onset_date`, `action_taken: continued|dose_reduced|stopped|emergency`. Guardar en `data/adverse-reactions.jsonl`. Al registrar `severe` o `life_threatening`: notificar al médico propietario de la clínica por WhatsApp. Los datos se usan en S10 para mejorar las alertas de OpenClaw. Verificable: `POST adverse-reaction-report` con `severity: severe` → `{ ok: true, alert_sent: true }`; entrada en `data/adverse-reactions.jsonl`.

---

### 30.6 Continuidad Clínica entre Visitas

> **Contexto clínico:** cuando un paciente llega a su tercera consulta, el médico necesita saber: ¿qué estaba tomando la última vez? ¿Cómo evolucionó la lesión vs las fotos anteriores? ¿Se cumplió el plan? Sin esto, cada consulta empieza de cero, y el médico redescubre al paciente.

- [x] **S30-19** `[M]` `[codex_backend]` Resumen automático entre-visitas para OpenClaw — al abrir un nuevo chat de OpenClaw para un caso que ya tiene visitas previas, el sistema debe inyectar automáticamente en el contexto: último diagnóstico CIE-10, medicamentos activos con fecha de inicio, última nota de evolución, resultado de labs pendientes o recientes, y si hay condición crónica: estado del control. Esta información ya está en el store — solo hay que extraerla y estructurarla para el prompt de OpenClaw. Verificable: `GET openclaw-patient?case_id=X` cuando el paciente tiene historial → respuesta incluye `inter_visit_summary: { last_diagnosis, active_medications, last_evolution_date, pending_labs }`.

- [x] **S30-20** `[M]` `[codex_backend]` Comparación fotográfica automática entre visitas — cuando el médico abre el caso de un paciente y hay fotos clínicas de visitas anteriores, `GET clinical-photos?case_id=X` debe retornar las fotos ordenadas por visita, con `session_date` y la nota de evolución de esa sesión. El médico necesita ver: foto de enero vs foto de marzo, con el diagnóstico de cada una. No es un carrusel — es evidencia clínica de progresión. Verificable: `GET clinical-photos?case_id=X` → array de `{session_date, evolution_note_excerpt, photos: [{url, type}]}` ordenado cronológicamente.

- [x] **S30-21** `[S]` `[codex_backend]` Persistencia de medicación crónica entre visitas — cuando un médico emite una receta con medicamentos marcados como `chronic: true` (ej: antihipertensivo, hipoglucemiante, hormona tiroidea), ese medicamento debe aparecer automáticamente en `intake.medicacionActual` de la próxima sesión del paciente. Sin esto, el médico pregunta "¿qué está tomando?" en cada visita aunque ya lo haya prescrito él mismo. Verificable: emitir receta con `medications[0].chronic: true` → en la siguiente sesión del mismo caso, `intake.medicacion_actual` incluye ese medicamento con `source: prescription_chronic`.

---

---

## Sprint 31 — Calidad Asistencial y Decisiones Clínicas Inteligentes

**Owner:** `codex_backend` | **Objetivo:** Que el sistema tome decisiones clínicas activas, no solo registre datos.

> **Por qué importa:** Aurora Derm hoy es un good registrador. El siguiente nivel es que el sistema piense. Cuando el médico está atendiendo 20 pacientes, no puede recordar por sí solo que el paciente de las 11 tiene hemoglobina baja y está tomando warfarina. El sistema debe alertarlo.

### 31.1 Alertas Proactivas en Consulta

- [x] **S31-01** `[M]` `[codex_backend]` Alerta de PA antes de prescribir AINE — si en los signos vitales de la sesión `bloodPressureSystolic > 140` y la prescripción propuesta contiene un AINE (ibuprofeno, naproxeno, diclofenaco, ketorolaco, meloxicam), el sistema devuelve `prescribing_warning: "PA elevada — los AINEs pueden empeorar la hipertensión. Considere paracetamol."`. No bloquea, solo advierte. Verificable: `POST openclaw-check-interactions` con PA sistólica 155 + ibuprofeno → `{ prescribing_warning: "..." }`.

- [x] **S31-02** `[M]` `[codex_backend]` Alerta de función renal antes de prescribir nefrotóxicos — si el paciente tiene un resultado de laboratorio de creatinina > 1.5 mg/dL (labs recientes en la HCE), y se prescribe AINE, metformina o aminoglucósido, el check-interactions devuelve `renal_risk_warning: "Creatinina elevada: X mg/dL — revisar dosis o contraindicación."`. Verificable: combo creatinina alta + metformina → `{ renal_risk_warning: "..." }`.

- [ ] **S31-03** `[S]` `[codex_backend]` Precargar alergias en el contexto del GPT — en `openclaw-patient`, el campo `known_allergies` ya existe en la HCE. Si el paciente tiene alergias registradas, estas deben aparecer en `inter_visit_summary.allergies` para que el GPT "Aurora Derm Clinica" las lea automáticamente al inicio de cada chat, sin que el médico las busque. Verificable: `GET openclaw-patient?case_id=X` cuando hay alergias → `inter_visit_summary.allergies: ["penicilina", "sulfas"]`.

- [ ] **S31-04** `[M]` `[codex_backend]` Semáforo de adherencia visible en el chat — si el paciente tiene `adherence_score: 'late'` en el episodio anterior (no vino en la fecha esperada), el contexto del chat debe incluir `adherence_alert: "El paciente no asistió al control previsto. Puede haber abandono de tratamiento."`. El GPT lo mencionará proactivamente. Verificable: `GET openclaw-patient?case_id=X` con adherencia late → `inter_visit_summary.adherence_alert: "..."`.

### 31.2 Inteligencia de Protocolo

- [ ] **S31-05** `[L]` `[codex_backend]` Protocolo automático por diagnóstico CIE-10 — cuando el médico guarda un diagnóstico con `openclaw-save-diagnosis`, si existe un protocolo de tratamiento en `data/protocols/` para ese CIE-10, devolverlo en la respuesta: `suggested_protocol: { first_line: "...", monitoring: "...", red_flags: [...] }`. Para dermatología: L70 (acné), L20 (dermatitis atópica), L40 (psoriasis), B35 (tiña). Verificable: `POST openclaw-save-diagnosis` con `cie10_code: L70` → respuesta incluye `suggested_protocol.first_line`.

- [x] **S31-06** `[M]` `[codex_backend]` Validación de dosis pediátrica — si el paciente tiene menos de 12 años y el médico prescribe dosis de adulto (detectado por `weightKg` en vitales y la dosis prescrita), devolver `dose_warning: "Paciente pediátrico: verificar dosis según peso (X kg). Dosis máxima recomendada: Y mg/kg/día."`. Verificable: caso pediátrico (8 años, 25 kg) + amoxicilina 500mg c/8h → `{ dose_warning: "..." }`.

- [x] **S31-07** `[M]` `[codex_backend]` Resumen de alta automático para el paciente — al cerrar una sesión con `openclaw-summarize-session`, generar automáticamente un SMS/WhatsApp para el paciente con: diagnóstico simple (no técnico), 3 instrucciones de toma del medicamento más importante, señal de alarma para urgencia, y fecha del próximo control. MAX 300 palabras. Verificable: `POST openclaw-summarize-session` → `{ patient_summary_wa: "string < 300 palabras" }`.

### 31.3 Seguridad de Datos Clínicos

- [x] **S31-08** `[M]` `[codex_backend]` Hash de integridad por sesión clínica — al cerrar una sesión (`status: closed`), calcular `sha256(json_encode(draft))` y guardarlo como `integrityHash` en el draft. En cualquier lectura posterior, recalcular el hash y comparar. Si no coincide: `integrity_warning: true` en la respuesta. Esto detecta modificaciones post-cierre. Verificable: `GET openclaw-patient?case_id=X` con sesión cerrada → `{ integrity: "ok" }`; si el draft fue modificado a mano → `{ integrity_warning: true }`.

- [x] **S31-09** `[S]` `[codex_backend]` Log de acceso a HCE por médico — cada vez que `openclaw-patient` se llama exitosamente, registrar en `data/hce-access-log.jsonl`: `{ case_id, accessed_by, accessed_at, ip, action: 'view_context' }`. Verificable: `cat data/hce-access-log.jsonl | grep case_id` → entradas por cada GET exitoso.

- [x] **S31-10** `[M]` `[codex_backend]` Anonimización para exportación estadística — `GET /api.php?resource=stats-export` devuelve datos agrupados (dermatología: distribución por CIE-10, promedio de visitas por paciente, condiciones crónicas más comunes) sin información identificable. El médico puede compartir esta estadística con el MSP sin violar LPDP. Verificable: respuesta no contiene `primerNombre`, `cedula`, `email`, `birthDate`.

---

## Sprint 32 — Telemedicina Clínica de Verdad

**Owner:** `codex_backend` | **Objetivo:** La teleconsulta no es solo videollamada — es la misma calidad clínica que la presencial, pero remota.

> **Contexto:** Actualmente la telemedicina de Aurora Derm puede crear sesiones y evaluar suitability. Pero si el médico hace una teleconsulta, no puede prescribir, no puede registrar vitales (el paciente los toma en casa), y no puede cerrar la HCE. Es una teleconsulta coja.

- [x] **S32-01** `[M]` `[codex_backend]` Ingesta de vitales reportados por el paciente — endpoint `POST /api.php?resource=patient-self-vitals` autenticado con token portal del paciente. El paciente puede ingresar su propia PA (tomada en casa), FC y glucometría antes de la teleconsulta. Se guardan con `source: 'patient_self_report'` y aparecen en el chat del médico. Verificable: el paciente hace POST desde el portal → en `openclaw-patient` aparece `inter_visit_summary.self_reported_vitals`.

- [x] **S32-02** `[L]` `[codex_backend]` Prescripción electrónica en teleconsulta — en modalidad teleconsulta, la receta se envía automáticamente al email del paciente como PDF firmado digitalmente (con el logo de la clínica, número de registro médico y QR de validación). No requiere que el paciente vaya a buscar la receta en físico. Verificable: `POST openclaw-prescription` con `delivery: email` → email enviado con PDF adjunto; `prescription.deliveryStatus: 'email_sent'`.

- [x] **S32-03** `[M]` `[codex_backend]` Foto clínica en teleconsulta — el paciente puede subir hasta 3 fotos desde el portal del paciente (`POST patient-portal-photo-upload`) que se asocian automáticamente a la sesión de teleconsulta activa. El médico las ve en el chat de OpenClaw como `clinical_uploads` del caso. Verificable: foto subida por paciente → aparece en `GET clinical-photos?case_id=X` con `source: 'patient_upload'`.

- [x] **S32-04** `[S]` `[codex_backend]` Cierre de teleconsulta con HCE completa — `POST openclaw-close-telemedicine` cierra la sesión de telemedicina, genera la nota de evolución en la HCE, actualiza `appointmentStatus: 'completed'`, y envía el resumen al paciente por WhatsApp. Todo en un solo endpoint. Verificable: `POST openclaw-close-telemedicine` → `{ hce_updated: true, wa_summary_sent: true, appointment_closed: true }`.

- [x] **S32-05** `[M]` `[codex_backend]` Control diferido para teleconsulta — al cerrar una teleconsulta, si el diagnóstico requiere control en X días, crear automáticamente un `pending_followup` en el sistema: `{ case_id, reason, due_date, contact_method: 'whatsapp' }`. El cron de crónicos lo detecta y recuerda al paciente. Verificable: teleconsulta cerrada con diagnóstico L20 → `pending_followup` creado con `due_date = hoy + 30 días`.

---

## Sprint 33 — Panel del Médico: Visión Clínica Total

**Owner:** `codex_backend` + `[UI]` | **Objetivo:** El médico abre el sistema y en 3 segundos sabe qué pacientes requieren atención urgente.

> **El médico no es secretaria.** El sistema tiene que decirle: "Tienes 2 pacientes crónicos que no vienen desde hace 60 días, 1 resultado crítico de lab que espera revisión, y 3 teleconsultas pendientes de cierre." No al revés.

- [x] **S33-01** `[L]` `[codex_backend]` Dashboard clínico del médico — `GET /api.php?resource=doctor-dashboard` devuelve: `{ patients_critical_vitals: [], pending_lab_results: [], overdue_chronics: [], open_teleconsults: [], today_appointments: [] }`. Toda la información prioritaria en un solo endpoint. Verificable: respuesta incluye los 5 campos con datos reales del store.

- [x] **S33-02** `[M]` `[UI]` `[gemini]` Vista del dashboard médico — `src/apps/admin-v3/sections/doctor-dashboard/`: grilla Bento asimétrica con 5 cards: crisis (PA >180 detectada hoy, rojo pulsante), labs críticos (amber con número), crónicos atrasados (navy con días), teleconsultas abiertas (glass cyan), y citas del día (timeline compacto). Verificable: `grep "bento.*doctor\|crisis.*card\|vital.*alert.*pulse" src/apps/admin-v3/sections/doctor-dashboard/` → match ≥4.

- [x] **S33-03** `[M]` `[codex_backend]` Búsqueda global de pacientes — `GET /api.php?resource=patient-search?q=juan` busca en nombre, apellido, cédula, diagnóstico CIE-10 más reciente. Devuelve max 10 resultados con: foto de perfil (si existe), último diagnóstico, próxima cita, estado crónico. El médico puede ir directo al caso desde el resultado. Verificable: búsqueda con nombre parcial → `{ results: [{ case_id, name, last_diagnosis, next_appointment, chronic_status }] }`.

- [x] **S33-04** `[M]` `[codex_backend]` Estadísticas del médico — `GET /api.php?resource=doctor-stats` devuelve: pacientes atendidos este mes, consultas cerradas, prescripciones emitidas, diagnósticos más frecuentes (top 5 CIE-10), tasa de retorno de pacientes (porcentaje que volvió al menos una vez). Verificable: respuesta incluye `top_diagnoses: [{cie10Code, count}]` con datos reales.

- [x] **S33-05** `[S]` `[UI]` `[gemini]` Indicador de carga de trabajo del día — en el header del admin: pill glass con "X pacientes hoy / Y completados". Cambia de color: verde si < 60% carga, amber si 60-90%, rojo si > 90% o retrasado. Verificable: `grep "workload.*pill\|patients.*today.*header" src/apps/admin-v3/` → match.

---

## Sprint 34 — Portal del Paciente: Empoderamiento y Acceso Real

**Owner:** `[UI]` `[gemini]` + `codex_backend` | **Objetivo:** El paciente tiene acceso real a su historia clínica, no solo a un recibo.

> **Una historia clínica es un derecho.** En Ecuador, la LPDP garantiza al paciente acceder a sus datos de salud. Hoy el portal muestra 3 cards y un PDF de receta. El paciente que tiene dermatitis atópica crónica merece ver su historial, sus fotos clínicas de progresión, sus análisis, y entender su tratamiento.

- [x] **S34-01** `[L]` `[UI]` `[gemini]` Timeline clínico del paciente — `es/portal/historial/index.html`: timeline vertical con todas las consultas, cada una expandible con: diagnóstico, medicamentos recetados, fotos clínicas si hay, y PDF de documentos. Línea de tiempo visual, episodios como cards colapsables. Verificable: `grep "timeline.*consulta\|episode.*collapsible\|portal.*history.*card" es/portal/historial/index.html` → match ≥3.

- [x] **S34-02** `[M]` `[UI]` `[gemini]` Fotos clínicas del paciente (progresión) — `es/portal/fotos/index.html`: galería agrupada por fecha de consulta. Cada grupo muestra la foto de la lesión y la nota del médico de esa visita. El paciente ve su propia evolución. Verificable: `grep "photo.*group.*date\|evolution.*note.*patient\|progression.*gallery" es/portal/fotos/index.html` → match ≥3.

- [x] **S34-03** `[M]` `[codex_backend]` Historia clínica exportable PDF — `GET /api.php?resource=patient-record-pdf?token=X` genera un PDF de la HCE completa del paciente: datos personales, diagnósticos por fecha, medicamentos activos, resultados de laboratorio, plan de tratamiento actual. Para llevar a otro médico. Verificable: PDF generado correctamente con secciones visibles; no debe incluir notas internas del médico.

- [x] **S34-04** `[S]` `[UI]` `[gemini]` Botón "¿En qué estoy?" — en `es/portal/index.html`: card glass destacada con el diagnóstico activo en lenguaje simple, 2-3 bullets de qué significa, y qué debe hacer el paciente a continuación (tomar medicamento, volver en X días, evitar el sol, etc.). Extraído de `patient_summary` del último episodio. Verificable: `grep "active.*condition.*simple\|what-am-i-card\|patient.*guidance" es/portal/index.html` → match.

- [x] **S34-05** `[M]` `[codex_backend]` Notificación push de resultado de lab listo — cuando `receive-lab-result` registra un resultado, enviar push notification al paciente (via web push) con: "Sus resultados de [nombre lab] ya están disponibles en su portal." El paciente entra al portal y los ve. Sin esta notificación, el portal del paciente es pasivo. Verificable: `POST receive-lab-result` → `{ push_sent: true, patient_notified_at: "..." }`.

---

## Sprint 35 — Hardening de Deuda Técnica (Auditoría 2026-03-31)

**Owner:** `codex_backend` + `[ops]` | **Objetivo:** Cerrar deuda real antes de añadir más funcionalidades.

> **Contexto:** Auditoría detectó bugs críticos que causaban pérdida de datos en producción. Este sprint cierra la deuda acumulada por velocidad de desarrollo.

### 35.1 Seguridad

- [x] **SEC-01** `[M]` `[codex_backend]` Whitelist MIME en uploadPhoto de portal — el endpoint `POST patient-portal-photo-upload` extrae el tipo de imagen del header base64 sin whitelist. Si un atacante envía `data:image/php;base64,...`, el archivo se guarda como `.php`. Añadir: `$allowedTypes = ['jpeg','jpg','png','webp','gif']` — rechazar con 400 si el tipo no está en la lista. Además añadir `.htaccess` en `data/uploads/` con `php_flag engine off`. Verificable: upload de `data:image/php;base64,...` → `{ ok: false, error: 'Tipo de imagen no permitido' }`.

- [x] **SEC-02** `[S]` `[codex_backend]` Permisos de directorio uploads: `0750` no `0777` — `mkdir(__DIR__ . '/../data/uploads', 0777, true)` en `uploadPhoto`. Cambiar a `0750`. Verificable: `stat data/uploads | grep Octal` → `0750`.

### 35.2 Corrección de Routes y Controladores

- [x] **DEBT-01** `[S]` `[codex_backend]` Fix `ConsentStatusController::process()` — `routes.php` apunta a `process()` pero el controlador solo tiene `handle()`. Cualquier call a `GET/POST consent-status` tira fatal error. Renombrar `handle()` a `process()` en el controlador. Verificable: `POST consent-status` → no 500.

- [x] **DEBT-02** `[S]` `[codex_backend]` Fix `BrandingController` faltante en `api.php` — `BrandingController` está en `routes.php` pero no en el require list de `api.php`. Añadir `require_once __DIR__ . '/controllers/BrandingController.php'`. Verificable: `GET branding` → no `Class not found`.

- [ ] **DEBT-03** `[L]` `[codex_backend]` Migrar 10 `write_store()` directos a `with_store_lock()` — hay 45 llamadas directas a `write_store()` sin lock. Priorizar: `PatientPortalController::selfVitals()`, `uploadPhoto()`, `signConsent()`, `TelemedicineRoomController::update()`, `ReviewController`. Race condition real con 3 médicos simultáneos. Verificable: `grep -rn "write_store(" controllers/ | grep -v "with_store_lock\|mutate_store" | wc -l` → < 35.

### 35.3 Protección de Datos

- [x] **DEBT-04** `[S]` `[ops]` Actualizar `.gitignore` con rutas sensibles — añadir: `data/uploads/`, `data/hce-access-log.jsonl`, `data/adverse-reactions.jsonl`, `data/pending-lab-alerts.jsonl`. Fotos clínicas y logs de acceso NO deben subirse a GitHub. Verificable: `git check-ignore data/uploads/test.jpg` → path ignorado.

### 35.4 Operaciones

- [x] **OPS-01** `[M]` `[ops]` Crear `ops/crontab.txt` y script de instalación — 5 crons implementados pero NINGUNO configurado en servidor. Crear `ops/crontab.txt` con entradas exactas de: `check-pending-labs.php` (diario 8h), `check-chronic-followup.php` (semanal lunes 9h), `check-pending-interconsults.php` (semanal martes 9h). Añadir `npm run ops:install-crons` que hace `crontab -l | cat - ops/crontab.txt | crontab`. Verificable: `crontab -l | grep aurora-derm` → match ≥3.

- [x] **OPS-02** `[S]` `[ops]` Rotación de `hce-access-log.jsonl` en cron — el log de acceso a HCE crece ~200 líneas/día sin límite. Añadir al cron diario: `tail -n 10000 data/hce-access-log.jsonl > /tmp/hce_rot.jsonl && mv /tmp/hce_rot.jsonl data/hce-access-log.jsonl`. Verificable: `wc -l data/hce-access-log.jsonl` → < 10001 después del cron.

- [ ] **OPS-03** `[M]` `[ops]` Crear `DEPLOYMENT.md` con checklist completo de producción — documentar: variables de entorno requeridas, crons a instalar, `.htaccess` especial para `data/uploads/`, permisos de carpetas, primera ejecución del backup. Sin esto, el próximo deploy a un servidor limpio falla. Verificable: cualquier desarrollador nuevo puede hacer deploy leyendo solo `DEPLOYMENT.md`.

### 35.5 Calidad de Código

- [x] **DEBT-05** `[S]` `[ops]` Limpiar worktrees Codex stale — hay 54 worktrees activos, 5 en detached HEAD que Codex dejó sin limpiar. Añadir `"postinstall": "git worktree prune"` en `package.json`. Verificable: `git worktree list | wc -l` → < 20 después de prune.

- [x] **DEBT-06** `[S]` `[ops]` JSON lint de `package.json` en CI — el usuario añadió una entrada con trailing comma que puede romper parsers. Añadir `node -e "require('./package.json')"` como primer check en el CI. Verificable: CI falla si `package.json` tiene JSON inválido.

- [ ] **DEBT-07** `[L]` `[codex_backend]` Arqueología: verificar 15 tareas reportadas como fake-done — `verify-task-contract.js` reporta 15+ tareas marcadas `[x]` sin evidencia verificable (S9-22, S9-24, S10-08, S10-14, S10-19, S10-23, S10-27, S10-29, S12-03, S12-07, S12-09, S12-14, S12-18, S12-25). Revisar cada una: si el código no existe → reabrir a `[ ]`, si el criterio verificable se cumple parcialmente → añadir nota de deuda. Verificable: `node bin/verify-task-contract.js` → 0 warnings.

- [x] **DEBT-08** `[M]` `[codex_backend]` Estandarizar entry points de controladores — la convención es inconsistente: algunos usan `process()`, otros `handle()`, otros `index()`, otros `check()`. Esto causa el bug de DEBT-01. Pull request: renombrar todos los entry points públicos a `handle(array $context): void`. Verificable: `grep "public static function " controllers/*.php | grep -v "handle\|__" | wc -l` → 0 (excepto helpers).

---

## Sprint 36 — Gobernanza 2.0

**Owner:** `[ops]` | **Objetivo:** El sistema de gobernanza debe escalar con la velocidad de desarrollo.

> **Problema identificado:** Estamos marcando tareas como `[x]` sin verificar que funcionen en producción. 484 tareas marcadas como done, al menos 15 con evidencia inconsistente. La gobernanza necesita dientes.

- [ ] **GOV-01** `[L]` `[ops]` Particionar `AGENTS.md` en activo/archivo — el archivo tiene +2,500 líneas. Los agentes consumen todo el contexto en cada iteración. Crear: `AGENTS.md` (solo sprints activos: S35, S36, UI5-restantes), `docs/BACKLOG_ARCHIVE.md` (S1-S30 completados). El `BACKLOG.md` ya generado puede servir de índice. Verificable: `wc -l AGENTS.md` → < 800 líneas.

- [ ] **GOV-02** `[M]` `[ops]` Añadir estado `[~]` al sistema de gobernanza — hoy `[x]` significa "código escrito". No hay diferencia entre "escrito", "en main", "en staging", "en producción". Propuesta: `[ ]` = pendiente, `[/]` = en progreso, `[~]` = en main pero no en producción, `[x]` = verificado en staging/producción. Actualizar `sync-backlog.js` para reconocer el nuevo estado. Verificable: `grep "\[~\]" AGENTS.md` → entradas que tienen código pero no están deployadas.

- [ ] **GOV-03** `[M]` `[ops]` `verify-task-contract` en pre-push hook — hoy el verificador solo corre manualmente. Añadirlo al `.git/hooks/pre-push` (o en Husky `pre-push`): `node bin/verify-task-contract.js --fail-on-warning`. Si hay tareas con criterio verificable inconsistente, el push falla. Verificable: push con tarea fake-done → pre-push rechaza.

- [ ] **GOV-04** `[S]` `[ops]` `git worktree prune` automático en postinstall — añadir a `package.json scripts`: `"postinstall": "git worktree prune"`. Verificable: `npm install && git worktree list | wc -l` → no aumenta con el tiempo.

- [ ] **GOV-05** `[M]` `[ops]` CI gate: PHP lint de todos los controllers en cada PR — crear `.github/workflows/php-lint.yml`: `find controllers/ lib/ -name "*.php" | xargs -I{} php -l {}`. Si algún archivo tiene error de sintaxis, el PR no puede mergear. Verificable: PR con error de sintaxis → CI falla con el nombre del archivo.

- [ ] **GOV-06** `[M]` `[ops]` CI gate: route integrity check — verificar que cada controller referenciado en `routes.php` tiene su `require_once` en `api.php`. Script: `node bin/check-route-integrity.js`. Verificable: añadir ruta de controller inexistente → CI falla indicando el controller faltante.

- [ ] **GOV-07** `[S]` `[ops]` Añadir `check-route-integrity.js` al test suite — `package.json` añadir `"test:routes": "node bin/check-route-integrity.js"` y llamarlo desde `npm test`. Verificable: `npm run test:routes` → pasa sin errores en el estado actual del repo.

---

## 35. Sprint 35 — Hardening Post-Auditoría Total (2026-03-31)

> **Origen:** Auditoría total del repositorio realizada el 2026-03-31. Defectos AUD-001 a AUD-015.
> Los P0 (AUD-008, AUD-009) fueron resueltos directamente en la sesión. Los pendientes van aquí.
> **RESUELTOS EN SESIÓN:** AUD-008 (routes.php `ConsentStatusController::handle`), AUD-009 (CSP admin), AUD-010 (tokens.css + base.css), AUD-003 (claims GC), AUD-007 (OpenAPI drift), AUD-015 (sprint30 smoke).

### 35.1 CRÍTICOS — Gobernanza

- [x] **S35-01** `[M]` `[codex_transversal]` 🚨 Restaurar fuente de verdad del orquestador (AUD-001) — `node agent-orchestrator.js status --json` devuelve `redirect-stub-v3-canonical` en lugar de diagnóstico real. El orquestador debe leer el estado real de AGENTS.md y devolver: activeClaims, pendingByLane, doneCount, lastAudit. Verificable: `node agent-orchestrator.js status --json | jq '.source'` → `"live"` (no `"AGENTS.md"` estático).

- [x] **S35-02** `[M]` `[codex_transversal]` Evidence debt — 4 tareas `done` sin evidencia (AUD-005) — las tareas `S2-07`, `S3-17`, `S4-19`, `S13-05` están marcadas `[x]` pero `verify.js` no puede confirmarlas. Para cada una: verificar si el artefacto existe con el path correcto o actualizar la regla de verify.js para apuntar al path real. NO crear archivos vacíos — solo actualizar si el artefacto genuinamente existe. Verificable: `npm run verify --silent | grep "done-without-evidence" | grep -v "S4-21\|S13-06"` → vacío.

- [x] **S35-03** `[L]` `[codex_transversal]` Deuda de reglas de verificación (AUD-005) — 369 tareas `done` sin regla verificable. Añadir al menos 50 reglas nuevas en `bin/verify.js` cubriendo los sprints 12–29. Prioridad: tareas que bloquean el lanzamiento (turnero, openclaw, booking, portal). Verificable: `npm run verify --silent | grep "done-without-rule" | awk -F: '{print $2}'` → número < 320.

### 35.2 CRÍTICOS — Admin Runtime

- [x] **S35-04** `[M]` `[codex_frontend]` 🚨 Admin boot contract roto (AUD-011) — `html[data-admin-ready]` queda `false`, `[data-admin-workbench]` queda `hidden`, callbacks no cargan. El JS de boot en `admin.html` no completa la secuencia de hidratación. Diagnóstico: ejecutar `TEST_REUSE_EXISTING_SERVER=1 npx playwright test tests/admin.spec.js -g "settings"` y leer el error exacto. Causa probable: dependencia de credenciales o de endpoint que falla (ver AUD-008 que ya fue resuelto — re-ejecutar el test y verificar si ya pasa). Verificable: `TEST_REUSE_EXISTING_SERVER=1 npx playwright test tests/admin-v3-canary-runtime.spec.js --workers=1 2>&1 | grep -E "passed|failed"` → `1 passed`.

- [x] **S35-05** `[S]` `[codex_frontend]` Admin callbacks grid vacío (AUD-011) — `#callbacksGrid .callback-card` esperado 4, recibido 0. El endpoint `GET /api.php?resource=callbacks` devuelve datos pero el admin no los renderiza. Verificable: cargar `/admin.html#callbacks` → grid muestra al menos 1 card con `class="callback-card"`.

### 35.3 ALTOS — Web pública

- [x] **S35-06** `[M]` `[codex_frontend]` Contrato home_v6 vs shell reborn (AUD-012) — `/es/` sirve `data-public-template-id="home_v6"` pero usa `reborn-navbar-pill`/`reborn-hero` sin los marcadores `[data-v6-header]`, `[data-v6-hero]`. Los tests de `tests/helpers/public-v6.js` fallan porque buscan esos atributos. Opciones: (1) añadir `data-v6-header` al `<header class="reborn-navbar-pill">` ya existente, (2) añadir `data-v6-hero` al hero. No cambiar la implementación — solo añadir los data-attributes que los tests esperan. Verificable: `TEST_REUSE_EXISTING_SERVER=1 npm run test:frontend:qa:public --silent 2>&1 | grep "home" | grep "passed"`.

- [ ] **S35-07** `[S]` `[codex_frontend]` Overflow horizontal `/es/telemedicina/` (AUD-013) — `clientWidth=360` vs `scrollWidth=792` en móvil. Hay un elemento que desborda. Diagnóstico: abrir `/es/telemedicina/index.html` en viewport 360px e identificar el elemento más ancho. Probable: imagen o grid sin `max-width: 100%`. Verificable: `TEST_REUSE_EXISTING_SERVER=1 npx playwright test tests/mobile-overflow-regression.spec.js --workers=1 2>&1 | grep -E "passed|failed"` → `passed`.

- [x] **S35-08** `[S]` `[codex_frontend]` Clarity analytics no carga tras consentimiento (AUD-014) — después de aceptar cookies, `{ hasScript: true, clarityLoaded: true }` debe ser verdadero pero ambos son `false`. El script de Clarity se inyecta condicionalmente en `js/cookie-consent.js`. Verificar que: (1) `monitoring-config` endpoint devuelve `clarity_id` no vacío cuando está configurado, (2) el inject se ejecuta tras `accept`. Si `clarity_id` está vacío en config, documentar como bloqueado por falta de variable de entorno. Verificable: `TEST_REUSE_EXISTING_SERVER=1 npx playwright test tests/cookie-consent.spec.js --workers=1 2>&1 | grep -E "passed|failed"`.

- [x] **S35-09** `[M]` `[codex_frontend]` Drawer móvil sin contrato `data-v6-drawer-open` (AUD-013) — el drawer del navbar en mobile no expone `[data-v6-drawer-open]` que esperan los tests. Añadir el atributo al elemento toggle del drawer. Verificable: `TEST_REUSE_EXISTING_SERVER=1 npx playwright test tests/mobile-overflow-regression.spec.js --workers=1 2>&1 | grep "drawer" | grep "passed"`.

### 35.4 HYGIENE

- [x] **S35-10** `[S]` `[codex_transversal]` Worktree hygiene: limpiar dirty + blocked (AUD-004) — `npm run workspace:hygiene:doctor --silent` reporta `20 dirty` y `12 blocked`. Ejecutar el paso de limpieza recomendado por el doctor. Si hay worktrees de sprints completados: eliminarlos. Verificable: `npm run workspace:hygiene:doctor --silent | grep dirty` → número < 10.

- [x] **S35-11** `[S]` `[codex_transversal]` Sincronizar qa-summary.json (AUD-006) — `governance/qa-summary.json` dice `gate: GREEN` pero el audit vivo tiene checks fallidos. El script que genera el summary debe actualizarse automáticamente al final de `npm run audit`. Verificable: después de correr `npm run audit --silent`, `cat governance/qa-summary.json | jq '.gate'` → valor coherente con el resultado del audit.

---

## 36. Sprint 36 — Cohesión de Producto y Cierre de Flujos (Jefe Decision 2026-03-31)

> **Fundamento:** Análisis de cohesión ejecutado directamente contra el sistema vivo. Gate: 🟢 13/13.
> Flujo del paciente: todos los endpoints HTTP 200. APIs: health ✅, monitoring ✅.
> **Decisión de jefe:** Los siguientes 3 problemas bloquean el lanzamiento real más que cualquier feature nueva.

---

### 36.0 BLOQUEADORES DE LANZAMIENTO (ejecutar esta semana, en orden)

- [x] **S36-00** `[M]` `[codex_backend]` 🚨 S3-20: Evolución clínica — nota SOAP por visita — Este es el único bloqueador clínico real. Sin evolución por visita, el médico no puede documentar lo que hace en cada consulta, lo cual es **requerimiento legal en Ecuador**. Implementar: endpoint `POST /api.php?resource=clinical-evolution` con body `{caseId, note, type:"soap"|"free", findings, procedures, plan}`. Append-only en `data/cases/{id}/evolutions.jsonl`. Vista en admin: textarea expandible bajo cada caso activo. **No es opcional para el lanzamiento.** Verificable: `grep "clinical-evolution\|evolutions.jsonl\|soap.*note" controllers/ClinicalHistoryController.php` → match; `POST clinical-evolution` con caseId válido → `{ok:true, savedAt:"..."}`.

- [x] **S36-01** `[M]` `[codex_frontend]` 🚨 V6 data-attributes faltantes — test suite pública falla (AUD-012) — El header en `/es/` usa `class="reborn-navbar-pill" data-reborn-header` pero los tests esperan `data-v6-header`. La solución correcta NO es reescribir el HTML sino añadir el alias: `data-v6-header` al elemento que ya existe. Lo mismo para `data-v6-hero`. Esto desbloqueará los 10 public tests que fallan. Verificable: `curl -s http://localhost:8099/es/ | grep "data-v6-header"` → match; `TEST_REUSE_EXISTING_SERVER=1 npm run test:frontend:qa:public --silent | grep -E "passed|failed"` → `18 passed, 0 failed`.

- [x] **S36-02** `[S]` `[codex_frontend]` 🚨 Mobile overflow en telemedicina — `clientWidth=360 scrollWidth=792` (AUD-013) — Un elemento tiene ancho fijo >360px. Diagnóstico: abrir `/es/telemedicina/index.html` en 360px y buscar con `document.querySelectorAll('*')` el elemento más ancho. Aplicar `max-width: 100%; overflow: hidden` al contenedor infractor. Verificable: `TEST_REUSE_EXISTING_SERVER=1 npx playwright test tests/mobile-overflow-regression.spec.js --workers=1 2>&1 | grep "passed"`.

---

### 36.1 COHESIÓN DEL FLUJO DEL PACIENTE

- [x] **S36-03** `[M]` `[codex_frontend]` Navegación cruzada entre superficies del paciente — los 5 endpoints del paciente (landing, booking, portal, historial, teleconsulta) existen y responden 200 pero **no están conectados entre sí en la UI**. Añadir navegación coherente: (1) en portal/index.html: botón "Nueva cita" → `/es/agendar/`, botón "Teleconsulta" → `/es/telemedicina/`, botón "Mi historial" → `/es/portal/historial/`. (2) en `/es/agendar/` al confirmar: link "Ver en mi portal" → `/es/portal/`. (3) en header de portal: items de navegación internos. Verificable: `grep "es/agendar\|es/telemedicina\|es/portal/historial" es/portal/index.html` → ≥3 matches.

- [x] **S36-04** `[S]` `[codex_frontend]` Página de estado del turno en tiempo real — `/es/software/turnero-clinicas/estado-turno/` — `TicketPrinter` (S3-11) genera QR que apunta aquí pero la página no existe. Crear shell básico: input de código de ticket → `GET /api.php?resource=queue-status&ticket=XXX` → muestra posición en cola, tiempo estimado y estado. Esta página es pública (sin auth). Verificable: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/es/software/turnero-clinicas/estado-turno/` → 200.

- [x] **S36-05** `[L]` `[codex_backend]` Endpoint unificado de resumen del paciente — `GET /api.php?resource=patient-summary` para el portal — Actualmente el portal hace 4 fetch separados (portal-plan, portal-payments, portal-prescriptions, portal-lab-results). Crear un endpoint agregador que devuelva todo en 1 call: `{upcomingAppointment, activeDiagnosis, pendingDocs, lastVisit, alertCount}`. Reduce latencia percibida a la mitad y simplifica el JS del portal. Verificable: `GET /api.php?resource=patient-summary` (con token mock) → JSON con los 5 campos; tiempo de respuesta < 500ms.

---

### 36.2 COHESIÓN DEL PANEL MÉDICO

- [x] **S36-06** `[M]` `[codex_frontend]` Admin-ready boot: Playwright timeout (AUD-011) — El chunk `js/admin-chunks/index-DqrYyApf.js` existe y el boot async funciona pero los tests de Playwright fallan por timeout (el `MutationObserver` espera `data-admin-ready=true` con timeout corto). Fix: en el test `admin-v3-canary-runtime.spec.js`, aumentar timeout de `waitForAttribute` a 10000ms. **Alternativamente** (preferido): en `admin.html`, añadir un listener en el DOMContentLoaded que haga `setAttribute('data-admin-ready', 'true')` como fallback si el módulo tarda >5s. Verificable: `TEST_REUSE_EXISTING_SERVER=1 npx playwright test tests/admin-v3-canary-runtime.spec.js --workers=1 2>&1 | grep "1 passed"`.

- [ ] **S36-07** `[M]` `[codex_frontend]` Callbacks grid: hidratación de datos (AUD-011) — `#callbacksGrid .callback-card` esperado ≥4, recibido 0. El grid existe en el HTML pero el JS que lo hidrata no ejecuta. Diagnóstico: buscar en `admin.js` / `js/admin-chunks/` la función que carga callbacks. Verificar que `GET /api.php?resource=callbacks` responde con datos (actualmente 401 sin auth). En el admin, cuando el médico está autenticado, ese fetch debe completarse y renderizar las cards. Verificable: con admin autenticado, `#callbacksGrid` tiene ≥1 `.callback-card`.

- [ ] **S36-08** `[S]` `[codex_frontend]` Settings: foto y firma del médico en el perfil — El test `admin.spec.js "settings guarda perfil"` falla. El formulario de settings (`#settings` section) debe tener: campo de foto de perfil, upload de firma digital, guardado via `POST /api.php?resource=doctor-profile`. Verificar que los campos existen en el HTML y el submit funciona. Verificable: en admin, ir a Settings → completar formulario → guardar → `data-admin-ready` permanece `true`.

---

### 36.3 OBSERVABILIDAD Y ANALYTICS

- [x] **S36-09** `[S]` `[codex_frontend]` GA4 en todas las páginas públicas (S13-06) — `G-2DWZ5PJ4MC` solo está en `/es/index.html` y `/es/agendar/`. Las páginas de servicio (`/es/servicios/*/`), telemedicina, portal login NO tienen GA4. Añadir el snippet en: `es/telemedicina/index.html`, `es/portal/login/index.html`, todas las páginas de servicios. Verificable: `grep -rl "G-2DWZ5PJ4MC" es/ | wc -l` → ≥ 8 archivos.

- [ ] **S36-10** `[S]` `[codex_frontend]` Clarity post-consentimiento (AUD-014) — `monitoring-config` devuelve `clarity_id: ""` porque no hay variable de entorno configurada. Dos acciones: (1) documentar en `DEPLOYMENT.md` que hay que configurar `CLARITY_ID=mx123` en el env antes del launch; (2) en `js/cookie-consent.js`, verificar que el inject de Clarity se hace tras `accept` cuando `clarity_id` está disponible. Verificable: con `CLARITY_ID` en env, tras aceptar cookies → `{ clarityLoaded: true }`.

- [x] **S36-11** `[M]` `[codex_transversal]` Smoke test del Sprint 36 — `tests-node/sprint36-smoke.test.js` que verifica: (1) `GET /es/telemedicina/consulta/` → 200; (2) `curl /es/ | grep "data-v6-header"` → match; (3) `curl /es/portal/` → 200; (4) todos los `data-v6-*` presentes en home; (5) `GET /api.php?resource=health` → `{ok:true}`; (6) `GET /api.php?resource=monitoring-config` → `{ok:true}`. Añadir al audit como step. Verificable: `node --test tests-node/sprint36-smoke.test.js` → `pass 6, fail 0`.

---

### 36.4 DEUDA TÉCNICA IDENTIFICADA EN ANÁLISIS

- [ ] **S36-12** `[L]` `[codex_transversal]` Extender `bin/verify.js` con 50 reglas nuevas — 393 tareas `done` sin regla verificable. Sprint 36 debe cubrir: Sprints 24–35 completos. Prioridad en orden: S24-_, S25-_, S26-_, S27-_, luego S28+. Cada regla debe ser un check real de archivo/grep/endpoint. Verificable: `npm run verify --silent | grep "done-without-rule"` → número < 343.

- [x] **S36-13** `[S]` `[codex_backend]` `DEPLOYMENT.md` — Checklist de producción — (OPS-03) Crear con: (1) variables de entorno requeridas con ejemplos; (2) crons a instalar (`ops/crontab.txt`); (3) permisos de carpetas (`data/uploads 0750`); (4) primera ejecución del backup; (5) configuración de Caddy/nginx; (6) verificación de `npm run audit` en verde antes de abrir al público. Sin esto, el próximo deploy a un servidor limpio falla. Verificable: `ls DEPLOYMENT.md` → existe; contiene `CLARITY_ID`, `crontab`, `data/uploads`.

---

## Sprint 37 — Infraestructura Clínica Profunda (Consulta Real)

**Owner:** `codex_backend` | **Prioridad:** LANZAMIENTO — sin esto el médico no puede trabajar con rigor legal.

> **Diagnóstico del capataz (2026-04-01):** El SOAP guarda `findings, procedures, plan` pero NO tiene
> `subjective` (relato del paciente), `objective` (examen físico estructurado), ni `assessment` (diagnóstico diferencial).
> La anamnesis no está conectada al SOAP. El médico dicta en el GPT pero los datos no se estructuran.
> El historial de evoluciones no tiene endpoint GET. Los resultados de lab se reciben pero no hay
> ingreso manual desde admin. El médico vive entre el GPT y el papel. Esto cambia aquí.

### 37.1 SOAP Clínico Completo (Requerimiento Legal Ecuador)

- [x] **S37-01** `[M]` `[codex_backend]` SOAP 4 campos completos + validación — el endpoint `POST clinical-evolution` acepta `findings, procedures, plan` pero NO tiene `note_subjective` (relato del paciente = S del SOAP), `note_objective` (examen físico = O), `note_assessment` (diagnóstico diferencial = A). Añadir al payload y al JSONL: `soap.subjective` (motivo + historia de la enfermedad en palabras del paciente), `soap.objective` (examen físico: hallazgos, datos de vitales del día referenciados), `soap.assessment` (diagnóstico principal CIE-10 + diferencial en texto libre), `soap.plan` (tratamiento + seguimiento + indicaciones). Validación: si `type=soap` y cualquier campo SOAP está vacío → 400 con JSON `{ok:false, missing:["subjective"]}`. Verificable: `POST clinical-evolution` con `type:"soap", soap:{subjective:"", objective:"x", assessment:"L20.0", plan:"y"}` → `{ok:false, missing:["subjective"]}`.

- [ ] **S37-02** `[M]` `[codex_backend]` Anamnesis estructurada conectada al SOAP — hoy los antecedentes (personales, familiares, alergias, medicamentos, hábitos) viven en campos sueltos del intake. Crear endpoint `POST clinical-anamnesis` con body estructurado: `{caseId, sessionId, motivo_consulta, enfermedad_actual, antecedentes_personales:[{type,detail}], antecedentes_familiares:[{type,detail}], medicamentos_actuales:[{name,dose,frequency}], alergias:[{allergen,reaction,severity:"leve"|"moderada"|"severa"}], habitos:{tabaco_cigarrillos_dia, alcohol_drinks_week, ejercicio_freq, exposicion_solar}}`. Guardar en `draft.intake.structured_anamnesis`. Cuando el GPT llama `openclaw-patient`, debe incluir `structured_anamnesis` en el contexto enviado. Verificable: `POST clinical-anamnesis` con caseId → `{ok:true}`; luego `GET openclaw-patient?patient_id=X` → response incluye `structured_anamnesis` en el contexto clínico.

- [x] **S37-03** `[S]` `[codex_backend]` Historial de evoluciones por caso — `GET /api.php?resource=clinical-evolution?caseId={id}&limit=10&offset=0` no existe. Sin esto el médico no puede ver las notas previas del mismo paciente. Leer del JSONL `data/cases/{id}/evolutions.jsonl`, parsear línea por línea, devolver array ordenado por fecha DESC con paginación. Si el archivo no existe → `{ok:true, evolutions:[], total:0}`. Verificable: después de guardar 2 evoluciones con `POST clinical-evolution` → `GET clinical-evolution?caseId=X` → `{evolutions:[...], total:2}`.

- [x] **S37-04** `[M]` `[codex_backend]` Prescripción con campos estructurados y validación de completitud — `openclaw-prescription` guarda medicamentos pero no valida campos mínimos de seguridad. Cada ítem de prescripción debe tener `{name, dose_amount, dose_unit:"mg"|"ml"|"UI"|"g"|"mcg"|"%", frequency_hours:int, duration_days:int, route:"oral"|"IM"|"IV"|"topico"|"inhalado"|"sublingual", instructions}`. Si faltan → 400 con `{ok:false, validation_errors:[{field:"dose_amount", item_index:0}]}`. Si el medicamento coincide con `data/controlled-substances.json` → requerir campo adicional `justification` o 422. Verificable: `POST openclaw-prescription` sin `dose_amount` en el primer item → `{ok:false, validation_errors:[{field:"dose_amount", item_index:0}]}`.

### 37.2 Resultados de Laboratorio e Imágenes (Admin Manual)

- [x] **S37-05** `[M]` `[codex_backend]` Resultado de lab: ingreso manual desde admin — el médico recibe el papel del laboratorio y no puede cargarlo. `POST receive-lab-result` existe pero no tiene validación completa ni trigger de alerta crítica. Añadir: (1) validación de `session_id` activa, (2) para cada valor con `status:"critical"` → llamar inmediatamente a `bin/notify-lab-critical.php` con guard de `realpath`, (3) marcar en el sesión `has_critical_lab_pending:true` visible para el médico en el doctor-dashboard. Registrar en `data/hce-access-log.jsonl` con `action:"lab_result_received"`. Verificable: `POST receive-lab-result` con `values:[{status:"critical"}]` → `{ok:true, alert_triggered:true}` y entrada en `data/hce-access-log.jsonl`.

- [x] **S37-06** `[S]` `[codex_backend]` Resultado de lab: control de visibilidad para el paciente — hoy todos los resultados son visibles en el portal del paciente (`patient-portal-labs`). Añadir campo `shared_with_patient: bool` (default `false`) al resultado de lab. Solo los marcados `true` aparecen en el portal. El médico puede marcar via `POST admin-lab-result-share` con `{session_id, lab_order_id, shared:true}`. Verificable: lab con `shared:false` → `GET patient-portal-labs` no lo muestra; `POST admin-lab-result-share` → `shared:true` → sí aparece.

- [x] **S37-07** `[M]` `[codex_backend]` Orden de imagen: recepción de informe completo — existe `create-imaging-order` y `issue-imaging-order` pero falta `receive-imaging-result` como endpoint standalone con todos los campos: `{session_id, order_id, type:"rx"|"eco"|"tac"|"rm", findings, impression, radiologist_name, study_date, file_base64}`. Si se envía `file_base64` del PDF del informe, guardar en `data/imaging/{order_id}.pdf` con permisos 0640. Indexar en el draft. Verificable: `POST receive-imaging-result` con `order_id` existente → `{ok:true}`; `GET clinical-history?caseId=X` → incluye `imaging_results` con el hallazgo y la impresión.

### 37.3 Seguimiento Clínico Post-Consulta

- [x] **S37-08** `[M]` `[codex_backend]` Control programado desde la evolución SOAP — al cerrar un SOAP con `plan` que menciona la palabra "control en X días", el sistema debe extraer el número y crear automáticamente un `pending_followup` con `{caseId, evolutionId, days_from_now:X, reason, appointment_type:"control"}`. Si ya existe un control programado para ese caso en los próximos 30 días → devolver `{ok:true, existing_followup:{id,date}, new_followup_skipped:true}` para no duplicar. Verificable: `POST clinical-evolution` con `soap.plan:"control en 14 días"` → `store.pending_followups` tiene nueva entrada con `days_from_now:14` y `source:"soap_plan"`.

- [x] **S37-09** `[S]` `[codex_backend]` Panel de crónicos enriquecido — `bin/check-chronic-followup.php` hoy solo loguea. Extender: cuando detecta crónico sin visita en >60 días, insertar en `store.pending_reactivations[]` con `{patientId, caseId, last_visit_date, chronic_diagnosis, days_since_visit, contact_next_step:"whatsapp"|"call"|"email"}`. El doctor-dashboard lee este array para mostrar la lista operativa. Verificable: `php bin/check-chronic-followup.php --dry-run --json` → JSON con lista de pacientes, sus días sin visita, y el diagnóstico crónico registrado.

### 37.4 Integridad y Auditoría Clínica

- [x] **S37-10** `[M]` `[codex_backend]` Hash de integridad en evoluciones JSONL — `data/cases/{id}/evolutions.jsonl` puede ser editado manualmente. Al guardar cada registro, añadir `integrityHash: sha256(json_encode(record_sin_hash))`. Al leer via `GET clinical-evolution`, verificar: si `sha256(record sin el campo integrityHash) !== record.integrityHash` → marcar `tampered:true` en esa entrada. Loguear en `data/hce-access-log.jsonl` con `action:"integrity_violation"`. Verificable: editar manualmente una línea del JSONL → `GET clinical-evolution?caseId=X` → esa entrada tiene `tampered:true`.

- [x] **S37-11** `[S]` `[codex_backend]` Audit log de acceso a evoluciones — extender el log que ya existe para `GET openclaw-patient` para que también cubra: `GET clinical-evolution` (`action:"read_evolution"`), `GET clinical-history` (`action:"read_history"`), `POST clinical-anamnesis` (`action:"write_anamnesis"`). Crear endpoint `GET hce-audit-log?caseId=X&limit=20` solo para doctores autenticados. Verificable: 3 llamadas a `GET clinical-evolution?caseId=X` → `GET hce-audit-log?caseId=X` → ≥3 entradas con `action:"read_evolution"`.

---

## Sprint 38 — UI Clínica Rigurosa (Panel del Médico)

**Owner:** `[UI]` `codex_frontend` | **Prioridad:** ALTA — el médico usa esto 8 horas diarias.

> **Diagnóstico del capataz (2026-04-01):** El admin tiene componentes Liquid Glass premium. Pero el flujo de trabajo
> del médico en consulta está fragmentado. El SOAP es un single textarea — no guía al médico por los 4 pasos.
> La prescripción no tiene campos individuales de dosis (el médico escribe "ibuprofeno 400mg c/8h" en texto libre).
> La anamnesis no tiene campos específicos de alergias+medicamentos. El médico va al GPT porque la UI no lo guía.
> Hay componentes glass pero no hay flujo. Este sprint conecta todo.

### 38.1 Formulario SOAP Estructurado (4 Paneles)

- [x] **S38-01** `[XL]` `[UI]` `[codex_frontend]` SOAP form 4 paneles en HCE — en `src/apps/admin-v3/sections/clinical-history/`, **reemplazar el textarea único** de "nota de evolución" por 4 paneles colapsables glass con indicador de completitud (🔴 vacío → 🟢 completo):
      **Panel S — Subjetivo:** textarea grande, placeholder "Motivo de consulta y relato en palabras del paciente". Counter de palabras recomendado: mínimo 30.
      **Panel O — Objetivo:** grid 2col: campos numéricos para TA sistólica/diastólica (mmHg), FC (bpm), FR (rpm), Temp (°C), SpO2 (%), Peso (kg), IMC (calculado auto). Más textarea "Examen físico por sistemas".
      **Panel A — Assessment:** campo CIE-10 con el `CIE10Search` (ya existe `js/cie10-search.js`) + diagnóstico diferencial como lista dinámica (añadir/quitar items).
      **Panel P — Plan:** textarea con categorías togglables: "Medicamentos", "Indicaciones de reposo", "Próximo control en X días", "Derivación a especialista".
      Al guardar → llama `POST clinical-evolution` con `type:"soap"` y el SOAP estructurado. Verificable: `grep "soap-panel\|soap-subjective\|soap-objective\|soap-assessment\|soap-plan" src/apps/admin-v3/sections/clinical-history/render/index.js` → ≥4 matches; abrir un caso en admin → 4 paneles visibles con indicadores de completitud.

- [x] **S38-02** `[L]` `[UI]` `[codex_frontend]` Formulario de anamnesis estructurado — pestaña "Anamnesis" en la HCE con 5 secciones glass. Verificable: `grep "anamnesis-form\|antecedentes-section\|alergias-table" src/apps/admin-v3/sections/clinical-history/` → ≥4 matches.
      **(1) Antecedentes personales:** lista expandible con tipos predefinidos (DM, HTA, IAM, asma, depresión, cáncer de piel, etc.) + descripción libre texto.
      **(2) Antecedentes familiares:** mismo patrón con relación de parentesco.
      **(3) Alergias:** tabla editable — columnas: Alérgeno | Reacción | Severidad (leve🟡/moderada🟠/severa🔴). Botón "+" para agregar. Badge count en la pestaña.
      **(4) Medicamentos actuales:** tabla — Nombre | Dosis | Frecuencia | Duración. Misma estructura que S38-03.
      **(5) Hábitos:** toggles + cuantitativos — cigarrillos/día, unidades alcohol/semana, min ejercicio/semana, exposición solar (estima).
      Guardar → `POST clinical-anamnesis`. Verificable: `grep "anamnesis-form\|antecedentes-section\|alergias-table\|medicamentos-table" src/apps/admin-v3/sections/clinical-history/` → ≥4 matches; guardar anamnesis → `POST clinical-anamnesis` recibe `structured_anamnesis` con el JSON completo.

- [x] **S38-03** `[L]` `[UI]` `[codex_frontend]` Prescripción con dosificador estructurado — reemplazar el textarea libre de receta por items estructurados. Por cada medicamento: `[Campo nombre con autocompletado]` + `[Dosis: número]` + `[Unidad: mg/ml/UI/g/%]` + `[Vía: select]` + `[Frecuencia: cada N horas]` + `[Duración: N días]` + `[Instrucciones especiales: textarea pequeño]`. Botón "Agregar medicamento" añade un item nuevo. Preview de la receta a la derecha en tiempo real (formato documento con membrete). Envío llama `POST openclaw-prescription` con items estructurados del S37-04. Verificable: `grep "prescription-item\|dose-input\|frequency-select\|duration-days\|route-select" src/apps/admin-v3/sections/clinical-history/render/render-documents.js` → ≥4 matches.

### 38.2 Resultados de Laboratorio con Semáforo

- [x] **S38-04** `[L]` `[UI]` `[codex_frontend]` Tabla de resultados de lab — pestaña "Laboratorio" en la HCE del admin. Tabla con columnas: Prueba | Resultado | Unidad | Referencia | Estado (🟢/🟡/🔴). Filtros: "Solo críticos", "Pendientes resultado", "Con resultado". Cada fila tiene toggle "Compartir con paciente" → llama `POST admin-lab-result-share`. Un resultado crítico sin revisar muestra banner amber pulsante en la cabecera del caso. Boton "Ingresar resultado" que abre el drawer de S38-05. Verificable: `grep "lab-result-row\|lab-critical-banner\|share-lab-toggle\|lab-filter" src/apps/admin-v3/sections/clinical-history/` → ≥4 matches.

- [x] **S38-05** `[M]` `[UI]` `[codex_frontend]` Drawer de ingreso manual de resultado de lab — botón "Ingresar resultado" abre panel lateral glass derecho con: selección de la orden existente (dropdown), campos de valor+unidad+valor-de-referencia, toggle de estado (normal/elevado/crítico), textarea notas, toggle "Compartir con paciente ahora". Al guardar llama `POST receive-lab-result`. Si el estado es crítico → toast rojo con sonido (Audio API: `new Audio('sfx/alert-critical.mp3').play()`) + el banner en S38-04. Verificable: `grep "lab-manual-drawer\|critical-alert-sound\|lab-result-submit" src/apps/admin-v3/sections/clinical-history/` → ≥3 matches.

### 38.3 Timeline Clínica por Tipo de Evento

- [x] **S38-06** `[XL]` `[UI]` `[codex_frontend]` Timeline cronológica de alta densidad — reemplazar la vista plana de eventos del paciente por un timeline vertical ordenado por fecha con íconos por tipo. Verificable: `grep "timeline-event-type\|timeline-expand\|soap-in-timeline" src/apps/admin-v3/sections/clinical-history/render/render-timeline.js` → ≥3 matches.
      🩺 Consulta presencial | 💊 Receta emitida | 📋 Certificado | 🧪 Laboratorio | 📷 Foto clínica | 📞 Teleconsulta | ⚠️ Resultado crítico.
      Al hacer click en cualquier evento → el item se expande con el detalle completo: para una consulta, muestra los 4 paneles SOAP colapsables con los datos guardados. Para una receta, muestra los ítems estructurados. Indicador visual de "tiempo entre visitas" como espaciado proporcional entre nodos o pill "32 días". Verificable: `grep "timeline-event-type\|timeline-expand\|soap-in-timeline\|time-between-visits" src/apps/admin-v3/sections/clinical-history/render/render-timeline.js` → ≥3 matches.

### 38.4 Checklist de Consulta (Guía al Médico)

- [x] **S38-07** `[M]` `[UI]` `[codex_frontend]` Barra de progreso de la consulta — en la cabecera del caso activo (componente `UI5-02` sticky), añadir una fila de progreso con 5 steps: `[✓/○ Anamnesis] [✓/○ Signos vitales] [✓/○ SOAP] [✓/○ Prescripción] [✓/○ Cierre]`. Estado leído del draft current: si `draft.intake.structured_anamnesis` → ✓ Anamnesis. Si `draft.intake.vitalSigns.heartRate > 0` → ✓ Vitales. Si la sesión tiene evolución type:soap con los 4 campos → ✓ SOAP. Cada step hace click → scroll suave al formulario correspondiente. Verificable: `grep "consultation-progress\|progress-step\|step-anamnesis\|step-soap" src/apps/admin-v3/sections/clinical-history/render/index.js` → ≥4 matches.

- [x] **S38-08** `[M]` `[UI]` `[codex_frontend]` Alerta de consulta incompleta al cerrar — cuando el médico intenta cerrar un caso (botón "Cerrar consulta") sin haber guardado una nota SOAP, mostrar modal glass de confirmación: "Esta consulta no tiene nota de evolución SOAP. ¿Deseas agregar una nota mínima antes de cerrar? (Requerido por el MSP Ecuador)" — 3 opciones: "Agregar nota SOAP", "Cerrar como nota libre", "Cancelar". Si cierra sin SOAP → marcar el caso con `evolution_missing:true` en el store. En el listado de casos de la agenda, un ícono ambar ⚠️ indica casos sin SOAP. Verificable: `grep "evolution-missing\|close-without-soap\|soap-required-modal" src/apps/admin-v3/sections/clinical-history/render/index.js` → ≥2 matches.

### 38.5 Teleconsulta Funcional en la UI

- [x] **S38-09** `[L]` `[UI]` `[codex_frontend]` Vista de teleconsulta integrada — `es/telemedicina/consulta/index.html` existe pero sin funcionalidad real. Verificable: `grep "jitsi-frame\|tele-hce-panel\|foto-upload-teleconsulta\|close-tele-soap" es/telemedicina/consulta/index.html` → ≥4 matches.
      **(1) Sala de espera del médico:** nombre del paciente, foto si existe, diagnóstico previo, tiempo en espera.
      **(2) Sala de consulta:** iframe de Jitsi Meet con `room = roomId del appointment` desde `api.php?resource=telemedicine-room`. Panel lateral derecho con: anamnesis previa, vitales auto-reportados del paciente, botón "Subir foto diagnóstica" que llama `POST patient-portal-photo-upload`.
      **(3) Cierre de teleconsulta:** botón "Finalizar consulta" → abre el formulario SOAP de S38-01 inline. Al guardar → llama `POST openclaw-close-telemedicine`. Verificable: `grep "jitsi-frame\|tele-hce-panel\|foto-upload-teleconsulta\|close-tele-soap" es/telemedicina/consulta/index.html` → ≥4 matches.
