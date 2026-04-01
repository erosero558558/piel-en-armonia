# Auditoría Total del Repositorio Aurora-Derm

Fecha local auditada: `2026-03-31` (`America/Guayaquil`)  
Repo: `/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm`  
Modo: `current-workspace audit`  
Alcance: gobernanza, claims/conflicts, gates, contratos backend/OpenAPI, admin runtime, público V6, cobertura de pruebas y observabilidad

## Resumen ejecutivo

Veredicto general: el estado actual del proyecto no está listo para usarse
como base confiable de release ni como fuente única de verdad operativa.

El problema no es uno solo. Hoy hay cinco frentes rotos a la vez:

1. La capa de gobernanza ya no está diagnosticando el board real:
   `status`, `board doctor` y `codex-check` devuelven `redirect-stub-v3-canonical`.
2. La coordinación activa está degradada:
   hay claims expirados/huérfanos y solapes reales en `api.php`, `config`,
   `lib` y `public_pages`.
3. Los gates canónicos están en rojo:
   `npm run audit --silent` falla `5/12` y `npm run verify --silent` deja deuda
   masiva de evidencia/reglas.
4. El admin web tiene una regresión sistémica:
   CSP incompatible con los recursos que carga, assets faltantes, contratos de
   boot que no se cumplen y fallos en shortcuts, settings, login legacy,
   dashboard y callbacks.
5. La home pública V6 ya no coincide con el contrato que protegen sus tests:
   `/es/` sirve un shell `reborn` sin los marcadores `data-v6-*` esperados por
   helpers, taxonomía y runtime smoke.

Conclusión operativa: antes de añadir más features conviene estabilizar
gobernanza/claims, restaurar observabilidad mínima y decidir el contrato
canónico de admin y home pública. En el estado actual, arreglar fallos aislados
sin esa limpieza va a producir más retrabajo.

## Snapshot reproducible

### Estado local del workspace

- `git status --short --branch`:
  - rama actual: `main`
  - worktree raíz sucio con cambios mezclados en `backend_ops`,
    `transversal_runtime` y `frontend_content`
- Nota:
  - esta auditoría usa el estado actual del workspace, incluyendo drift local;
    no asume árbol limpio.

### Conteos estructurales

- `package.json` expone `275` scripts.
- `tests/` + `tests-node/` contienen `568` archivos de prueba.
  - `255` en `tests-node/`
  - `313` en el resto de suites

### Gates y comandos canónicos

- `npm run audit --silent`
  - `7/12` checks pasan
  - `5/12` fallan:
    - `OpenAPI Drift`
    - `Verify`
    - `Conflict`
    - `Sprint 30 Smoke Test`
    - `Claim GC`
- `npm run verify --silent`
  - `89/101` tareas `done` verificadas
  - `5` `done-without-evidence`
  - `358` `done-without-rule`
  - `7` `pending` sin evidencia
- `npm run workspace:hygiene:doctor --silent`
  - `54` worktrees
  - `20` dirty
  - `12` blocked
  - `8` attention
  - `34` clean
  - `issues=legacy_generated_root=11, authored=114`
- `node bin/conflict.js --json`
  - `4` conflictos activos
  - `7` warnings `local_vs_claim`
  - `activeClaims=10`
- `node bin/claim-gc.js --json`
  - `3` claims expirados
  - `3` claims huérfanos
  - `7` claims activos
  - `total=13`
- `node bin/check-openapi-drift.js`
  - endpoints vivos no documentados:
    - `saveChronicCondition`
    - `closeTelemedicine`
    - `fastClose`

### Suites de frontend auditadas

- `TEST_REUSE_EXISTING_SERVER=1 npm run test:frontend:qa:public --silent`
  - `18 passed`
  - `10 failed`
- `TEST_REUSE_EXISTING_SERVER=1 npx playwright test tests/admin-v3-canary-runtime.spec.js -g "arranca por defecto con shell queue-first y assets v3 unicos" --workers=1`
  - falla: `[data-admin-workbench]` existe pero queda `hidden`
- `TEST_REUSE_EXISTING_SERVER=1 npx playwright test tests/admin-callbacks-triage.spec.js -g "atajos globales aplican filtros y slash enfoca busqueda" --workers=1`
  - falla: `#callbacksGrid .callback-card` esperado `4`, recibido `0`
- `TEST_REUSE_EXISTING_SERVER=1 npx playwright test tests/admin.spec.js -g "settings guarda el perfil del medico principal y sube la firma digital" --workers=1`
  - falla: `html[data-admin-ready]` esperado `true`, recibido `false`
- `node --test tests-node/sprint30-smoke.test.js`
  - falla `S30-01/S30-04/S30-05`
  - `/es/agendar/` ya no cumple el contrato de modo oscuro esperado por el smoke

## Matriz de fuentes de verdad

### Confiables hoy

- `npm run audit --silent`
- `npm run verify --silent`
- `npm run workspace:hygiene:doctor --silent`
- `node bin/conflict.js --json`
- `node bin/claim-gc.js --json`
- `node bin/check-openapi-drift.js`
- Playwright focal con `TEST_REUSE_EXISTING_SERVER=1`
- `curl` directo al servidor local

### No confiables hoy

- `node agent-orchestrator.js status --json`
- `node agent-orchestrator.js board doctor --json --profile ci`
- `node agent-orchestrator.js codex-check --json`

Motivo:

- Los tres devuelven el mismo payload:
  - `source: AGENTS.md`
  - `orchestrator: redirect-stub-v3-canonical`
  - backlog estático
  - instrucciones genéricas de dispatch
- En este estado no sirven para diagnosticar salud real del board ni del
  runtime de gobernanza.

### Engañosas o stale

- [governance/qa-summary.json](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/governance/qa-summary.json)
  - reporta `gate: GREEN`
  - pero el gate vivo `npm run audit --silent` falla `5/12`
  - por tanto el resumen persistido no representa el estado actual del repo

## Ledger único de defectos

| ID | Severidad | Lane owner | Área | Hallazgo |
|---|---|---|---|---|
| `AUD-001` | `P1` | `codex_transversal` | gobernanza | Los comandos del orquestador devuelven `redirect-stub-v3-canonical` en vez de diagnóstico real. |
| `AUD-002` | `P1` | `codex_transversal` | coordinación | Hay solapes activos en `public_pages`, `config`, `lib` y archivo frágil `api.php`. |
| `AUD-003` | `P2` | `codex_transversal` | claims | Existen claims expirados y huérfanos que ya contaminan la coordinación viva. |
| `AUD-004` | `P1` | `codex_transversal` | hygiene | `54` worktrees con `20 dirty` y `12 blocked`; el root está `blocked` y `mixed_lane`. |
| `AUD-005` | `P1` | `codex_transversal` | evidence/gates | `verify` mantiene deuda alta: `5 done-without-evidence`, `358 done-without-rule`, `7 pending without evidence`. |
| `AUD-006` | `P2` | `codex_transversal` | observabilidad de gates | `governance/qa-summary.json` queda verde aunque el audit vivo está rojo. |
| `AUD-007` | `P1` | `codex_backend_ops` | contratos API | Hay drift entre [lib/routes.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/lib/routes.php) y [openapi-openclaw.yaml](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/openapi-openclaw.yaml). |
| `AUD-008` | `P0` | `codex_backend_ops` | observabilidad runtime | `health-diagnostics` y `monitoring-config` devuelven `HTTP 500` en el estado actual. |
| `AUD-009` | `P0` | `codex_frontend` + `codex_backend_ops` | admin runtime | [admin.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/admin.html) combina CSP `self-only` con recursos externos e inline scripting/inline styles bloqueados por esa CSP. |
| `AUD-010` | `P1` | `codex_frontend` | assets/paths | `styles/tokens.css`, `styles/base.css` y `/release-manifest.json` faltan en root, pero siguen referenciados por admin y otras superficies. |
| `AUD-011` | `P1` | `codex_frontend` | admin contracts | El admin no cumple contratos de boot/hidratación: `data-admin-ready=false`, workbench oculto, callbacks vacíos. |
| `AUD-012` | `P1` | `codex_frontend` | home pública | `/es/` sirve `home_v6` con shell `reborn`, pero sin marcadores `data-v6-*` que exigen tests/helpers/runtime smoke. |
| `AUD-013` | `P1` | `codex_frontend` | responsive/public | Hay overflow horizontal en `/es/telemedicina/` y el drawer móvil no cumple el contrato protegido por tests. |
| `AUD-014` | `P2` | `codex_frontend` | consentimiento/analytics | Clarity no se carga después de aceptar cookies en la suite pública actual. |
| `AUD-015` | `P2` | `codex_frontend` | booking | `/es/agendar/` rompió el contrato de modo oscuro esperado por `tests-node/sprint30-smoke.test.js`. |

### Detalle por defecto

#### `AUD-001` — Gobernanza stub

- Evidencia:
  - `node agent-orchestrator.js status --json`
  - `node agent-orchestrator.js board doctor --json --profile ci`
  - `node agent-orchestrator.js codex-check --json`
- Señal:
  - los tres devuelven el mismo payload estático `redirect-stub-v3-canonical`
- Riesgo:
  - el repo pierde fuente operativa de verdad para board, semáforo y runtime

#### `AUD-002` — Conflictos activos de coordinación

- Evidencia:
  - `node bin/conflict.js --json`
- Conflictos confirmados:
  - zona `public_pages`: `S27-02`, `S29-08`, `S29-11`, `S29-12`
  - zona `config`: `S29-04`, `S29-05`, `S29-15`
  - zona `lib`: `S29-11`, `S29-13`
  - archivo frágil `api.php`: `S29-04`, `S29-05`, `S29-15`
- Riesgo:
  - alta probabilidad de retrabajo/merge conflict en rutas críticas

#### `AUD-003` — Claims expirados y huérfanos

- Evidencia:
  - `node bin/claim-gc.js --json`
- Expirados:
  - `S29-07`
  - `S29-10`
  - `S29-14`
- Huérfanos:
  - `S29-01`
  - `S29-04`
  - `S29-05`

#### `AUD-004` — Hygiene degradada

- Evidencia:
  - `npm run workspace:hygiene:doctor --silent`
- Hallazgos:
  - worktree raíz `blocked`, `dirty=12`, `mixed_lane`
  - múltiples worktrees legacy en `blocked` con `unknown_scope`
- Riesgo:
  - el auditor ya no puede distinguir con fiabilidad qué drift es histórico y
    qué drift sigue vivo

#### `AUD-005` — Deuda de evidencia y reglas

- Evidencia:
  - `npm run verify --silent`
- `done-without-evidence`:
  - `S2-07`, `S3-17`, `S3-30`, `S4-19`, `S13-05`
- `pending without evidence`:
  - `S2-01`, `S2-18`, `S2-19`, `S2-20`, `S3-20`, `S4-21`, `S13-06`
- Hallazgo estructural:
  - `358` tareas `done` carecen de regla de verificación

#### `AUD-006` — Gate summary persistido y engañoso

- Evidencia:
  - [governance/qa-summary.json](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/governance/qa-summary.json)
  - `npm run audit --silent`
- Contradicción:
  - el summary persistido dice `GREEN`
  - el audit vivo está `RED` con `5` checks fallidos

#### `AUD-007` — OpenAPI drift

- Evidencia:
  - `node bin/check-openapi-drift.js`
  - [lib/routes.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/lib/routes.php):167
  - [lib/routes.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/lib/routes.php):176
  - [lib/routes.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/lib/routes.php):177
- Endpoints vivos no documentados:
  - `openclaw-save-chronic -> saveChronicCondition`
  - `openclaw-close-telemedicine -> closeTelemedicine`
  - `openclaw-fast-close -> fastClose`

#### `AUD-008` — Endpoints de observabilidad en 500

- Evidencia:
  - `curl -i -s 'http://127.0.0.1:8011/api.php?resource=health-diagnostics'`
  - `curl -i -s 'http://127.0.0.1:8011/api.php?resource=monitoring-config'`
- Resultado:
  - ambos responden `HTTP/1.1 500 Internal Server Error`
  - body: `{"ok":false,"error":"Error interno del servidor"}`
- Impacto:
  - rompe introspección y diagnóstico del estado local

#### `AUD-009` — CSP incompatible con el admin real

- Evidencia:
  - [admin.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/admin.html):15
  - [admin.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/admin.html):42
  - [admin.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/admin.html):82
  - [admin.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/admin.html):84
  - Playwright browser log directo sobre `/admin.html`
- Señales confirmadas en consola:
  - `chart.js` bloqueado por CSP
  - Google Fonts bloqueado por CSP
  - múltiples `Executing inline script violates ...`
  - múltiples `Applying inline style violates ...`
  - `pageerror: Cannot read properties of null (...)`
- Observación:
  - el HTML intenta cargar recursos que su propia política no permite

#### `AUD-010` — Assets y rutas raíz faltantes

- Evidencia:
  - [admin.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/admin.html):85
  - [admin.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/admin.html):88
  - `ls styles/tokens.css styles/base.css release-manifest.json`
  - `find . -path '*/styles/tokens.css' -o -path '*/styles/base.css'`
  - `find . -path '*/release-manifest.json'`
- Estado real:
  - `styles/tokens.css` no existe en root
  - `styles/base.css` no existe en root
  - `release-manifest.json` no existe en root
  - esos archivos sí existen dentro de `.codex-worktrees/*` o bajo
    `app-downloads/pilot/release-manifest.json`
- Impacto:
  - admin y superficies legacy siguen apuntando a paths que ya no existen

#### `AUD-011` — Contratos admin rotos

- Evidencia focal:
  - `admin-v3-canary-runtime.spec.js`
  - `admin-callbacks-triage.spec.js`
  - `admin.spec`
- Fallos reproducidos:
  - `[data-admin-workbench]` está presente pero `hidden`
  - `#callbacksGrid .callback-card` esperado `4`, recibido `0`
  - `html[data-admin-ready]` esperado `true`, recibido `false`
- Lectura:
  - la hidratación admin no está produciendo el estado listo esperado por la
    suite

#### `AUD-012` — Drift entre home pública y contrato V6

- Evidencia:
  - `TEST_REUSE_EXISTING_SERVER=1 npm run test:frontend:qa:public --silent`
  - `curl -s http://127.0.0.1:8011/es/`
  - [tests/helpers/public-v6.js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/tests/helpers/public-v6.js)
  - [src/apps/astro/src/components/public-v6/PublicHeaderV6.astro](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/src/apps/astro/src/components/public-v6/PublicHeaderV6.astro)
- Contradicción confirmada:
  - `/es/` declara `data-public-template-id="home_v6"`
  - pero el HTML servido usa `reborn-navbar-pill` / `reborn-hero`
  - no expone `[data-v6-header]`, `[data-v6-hero]` ni el contrato de drawer
    esperado por helpers y tests
- Resultado:
  - fallan home, deferred hydration y taxonomía

#### `AUD-013` — Responsive/public roto

- Evidencia:
  - `tests/mobile-overflow-regression.spec.js`
- Fallos:
  - overflow horizontal en `/es/telemedicina/`
    - `clientWidth=360`
    - `scrollWidth=792`
  - drawer móvil no expone `[data-v6-drawer-open]`

#### `AUD-014` — Clarity no carga tras consentimiento

- Evidencia:
  - `tests/cookie-consent.spec.js:246`
- Estado observado:
  - después de aceptar cookies, la prueba espera
    `{ hasScript: true, clarityLoaded: true }`
  - recibe
    `{ hasScript: false, clarityLoaded: false }`

#### `AUD-015` — Regression de booking en Sprint 30 smoke

- Evidencia:
  - `node --test tests-node/sprint30-smoke.test.js`
- Falla:
  - `/es/agendar/` ya no cumple `data-theme-mode="dark"`
  - el HTML actual expone `data-theme-mode="system"` y `theme-color="#ffffff"`
- Impacto:
  - el smoke todavía protege un contrato que el booking actual ya no satisface

## Matriz de pruebas rotas

| Familia | Comando | Estado | Fallos representativos | Causa raíz más probable |
|---|---|---|---|---|
| `audit` | `npm run audit --silent` | `RED` | OpenAPI Drift, Verify, Conflict, Sprint 30 Smoke Test, Claim GC | deuda estructural viva, no ruido aislado |
| `verify` | `npm run verify --silent` | `RED` | evidencia faltante y reglas faltantes | deuda de gobernanza y cierre |
| `admin/runtime` | `...admin-v3-canary-runtime...` | `RED` | workbench oculto | hidración/admin shell inconsistente |
| `admin/callbacks` | `...admin-callbacks-triage...` | `RED` | `callbacksGrid` vacío | datos o render callbacks no hidratan |
| `admin/settings` | `...admin.spec...` | `RED` | `data-admin-ready=false` | boot admin incompleto |
| `admin/full-suite` | `npm run test:frontend:qa:admin --silent` | `RED` | shortcuts, canary, settings, login legacy, dashboard | regresión sistémica, no test aislado |
| `public/home` | `npm run test:frontend:qa:public --silent` | `RED` | home shell, hero, Google reviews, runtime markers | contrato `home_v6` desalineado con implementación `reborn` |
| `public/mobile` | `npm run test:frontend:qa:public --silent` | `RED` | overflow en `/es/telemedicina/`, drawer móvil | responsive contract roto |
| `public/cookies` | `npm run test:frontend:qa:public --silent` | `RED` | Clarity no carga tras consentimiento | runtime config/loader de analytics incompleto |
| `contracts/openapi` | `node bin/check-openapi-drift.js` | `RED` | 3 endpoints vivos sin YAML | spec desactualizada |
| `smoke/booking` | `node --test tests-node/sprint30-smoke.test.js` | `RED` | `/es/agendar/` ya no está en dark mode | drift entre smoke legacy y booking real |

## Primeras 10 correcciones

1. Restaurar una fuente de verdad operativa real para gobernanza:
   `status`, `board doctor` y `codex-check` no pueden seguir respondiendo solo
   con stub.
2. Limpiar claims expirados/huérfanos y cerrar el solape de `api.php`,
   `config`, `lib` y `public_pages`.
3. Congelar el root dirty actual y separar los cambios mezclados del worktree
   raíz antes de intentar merges o nuevos fixes amplios.
4. Reparar `health-diagnostics` y `monitoring-config` para volver a tener
   introspección del runtime.
5. Alinear [admin.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/admin.html) con su CSP:
   o self-hosted total, o CSP compatible; no ambos a medias.
6. Restaurar `styles/tokens.css`, `styles/base.css` y resolver la estrategia
   canónica de `release-manifest.json` en root vs `app-downloads/pilot/`.
7. Arreglar primero el boot admin:
   `data-admin-ready`, workbench visible y carga de callbacks.
8. Decidir un solo contrato para `/es/`:
   volver a exponer `data-v6-*` o reescribir helpers/tests/runtime al shell
   `reborn`, pero no dejar ambos modelos en conflicto.
9. Corregir overflow móvil y drawer de home/telemedicina.
10. Cerrar el drift OpenAPI y bajar la deuda de `verify`:
    primero `done-without-evidence`, luego `pending without evidence`, luego
    las `done-without-rule`.

## Notas de interpretación

- Varias corridas de Playwright requieren `TEST_REUSE_EXISTING_SERVER=1` porque
  el puerto `8011` ya queda ocupado por el servidor local. Eso es esperable con
  la config actual, pero también significa que la ergonomía de reruns locales
  es frágil.
- Parte del daño actual puede estar amplificado por cambios locales sin commit
  en el root. Aun así, la auditoría es válida porque el pedido fue sobre el
  estado actual del proyecto, no sobre un checkout hipotético limpio.
- Los artefactos generados por los propios comandos de auditoría, como
  [governance/broken-scripts.json](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/governance/broken-scripts.json),
  pueden refrescarse durante la inspección. No deben confundirse con fixes.
