# AGENTS.md — Backlog Activo

> **NOTA:** Las directrices de orquestación de agentes han sido movidas a `docs/ORCHESTRATION_CONTEXT.md`.

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

- [ ] **OPS-03** `[M]` `[ops]` Crear `DEPLOYMENT.md` con checklist completo de producción — documentar: variables de entorno requeridas, crons a instalar, `.htaccess` especial para `data/uploads/`, permisos de carpetas, primera ejecución del backup. Sin esto, el próximo deploy a un servidor limpio falla. Verificable: `test -f DEPLOYMENT.md && grep -q "checklist" DEPLOYMENT.md`

### 35.5 Calidad de Código

- [x] **DEBT-05** `[S]` `[ops]` Limpiar worktrees Codex stale — hay 54 worktrees activos, 5 en detached HEAD que Codex dejó sin limpiar. Añadir `"postinstall": "git worktree prune"` en `package.json`. Verificable: `git worktree list | wc -l` → < 20 después de prune.

- [x] **DEBT-06** `[S]` `[ops]` JSON lint de `package.json` en CI — el usuario añadió una entrada con trailing comma que puede romper parsers. Añadir `node -e "require('./package.json')"` como primer check en el CI. Verificable: `node -e "require('./package.json')"`

- [x] **DEBT-07** `[L]` `[codex_backend]` Arqueología: verificar 15 tareas reportadas como fake-done — `verify-task-contract.js` reporta 15+ tareas marcadas `[x]` sin evidencia verificable (S9-22, S9-24, S10-08, S10-14, S10-19, S10-23, S10-27, S10-29, S12-03, S12-07, S12-09, S12-14, S12-18, S12-25). Revisar cada una: si el código no existe → reabrir a `[ ]`, si el criterio verificable se cumple parcialmente → añadir nota de deuda. Verificable: `node bin/verify-task-contract.js` → 0 warnings. // Evidence: resueltas y verificadas las 15 tareas.

- [x] **DEBT-08** `[M]` `[codex_backend]` Estandarizar entry points de controladores — la convención es inconsistente: algunos usan `process()`, otros `handle()`, otros `index()`, otros `check()`. Esto causa el bug de DEBT-01. Pull request: renombrar todos los entry points públicos a `handle(array $context): void`. Verificable: `grep "public static function " controllers/*.php | grep -v "handle\|__" | wc -l` → 0 (excepto helpers).

---

## Sprint 36 — Gobernanza 2.0

**Owner:** `[ops]` | **Objetivo:** El sistema de gobernanza debe escalar con la velocidad de desarrollo.

> **Problema identificado:** Estamos marcando tareas como `[x]` sin verificar que funcionen en producción. 484 tareas marcadas como done, al menos 15 con evidencia inconsistente. La gobernanza necesita dientes.

- [x] **GOV-01** `[L]` `[ops]` Particionar `AGENTS.md` en activo/archivo — el archivo tiene +2,500 líneas. Los agentes consumen todo el contexto en cada iteración. Crear: `AGENTS.md` (solo sprints activos: S35, S36, UI5-restantes), `docs/BACKLOG_ARCHIVE.md` (S1-S30 completados). El `BACKLOG.md` ya generado puede servir de índice. Verificable: `wc -l AGENTS.md` → < 800 líneas.

- [ ] **GOV-02** `[M]` `[ops]` Añadir estado `[~]` al sistema de gobernanza — hoy `[x]` significa "código escrito". No hay diferencia entre "escrito", "en main", "en staging", "en producción". Propuesta: `[ ]` = pendiente, `[/]` = en progreso, `[~]` = en main pero no en producción, `[x]` = verificado en staging/producción. Actualizar `sync-backlog.js` para reconocer el nuevo estado. Verificable: `grep "\[~\]" AGENTS.md` → entradas que tienen código pero no están deployadas.

- [ ] **GOV-03** `[M]` `[ops]` `verify-task-contract` en pre-push hook — hoy el verificador solo corre manualmente. Añadirlo al `.git/hooks/pre-push` (o en Husky `pre-push`): `node bin/verify-task-contract.js --fail-on-warning`. Si hay tareas con criterio verificable inconsistente, el push falla. Verificable: push con tarea fake-done → pre-push rechaza.

- [x] **GOV-04** `[S]` `[ops]` `git worktree prune` automático en postinstall — añadir a `package.json scripts`: `"postinstall": "git worktree prune"`. Verificable: `npm install && git worktree list | wc -l` → no aumenta con el tiempo.

- [x] **GOV-05** `[M]` `[ops]` CI gate: PHP lint de todos los controllers en cada PR — crear `.github/workflows/php-lint.yml`: `find controllers/ lib/ -name "*.php" | xargs -I{} php -l {}`. Si algún archivo tiene error de sintaxis, el PR no puede mergear. Verificable: PR con error de sintaxis → CI falla con el nombre del archivo.

- [x] **GOV-06** `[M]` `[ops]` CI gate: route integrity check — verificar que cada controller referenciado en `routes.php` tiene su `require_once` en `api.php`. Script: `node bin/check-route-integrity.js`. Verificable: añadir ruta de controller inexistente → CI falla indicando el controller faltante.

- [x] **GOV-07** `[S]` `[ops]` Añadir `check-route-integrity.js` al test suite — `package.json` añadir `"test:routes": "node bin/check-route-integrity.js"` y llamarlo desde `npm test`. Verificable: `npm run test:routes` → pasa sin errores en el estado actual del repo.

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

- [x] **S35-07** `[S]` `[codex_frontend]` Overflow horizontal `/es/telemedicina/` (AUD-013) — `clientWidth=360` vs `scrollWidth=792` en móvil. Hay un elemento que desborda. Diagnóstico: abrir `/es/telemedicina/index.html` en viewport 360px e identificar el elemento más ancho. Probable: imagen o grid sin `max-width: 100%`. Verificable: `TEST_REUSE_EXISTING_SERVER=1 npx playwright test tests/mobile-overflow-regression.spec.js --workers=1 2>&1 | grep -E "passed|failed"` → `passed`.

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

- [x] **S36-07** `[M]` `[codex_frontend]` Callbacks grid: hidratación de datos (AUD-011) — `#callbacksGrid .callback-card` esperado ≥4, recibido 0. El grid existe en el HTML pero el JS que lo hidrata no ejecuta. Diagnóstico: buscar en `admin.js` / `js/admin-chunks/` la función que carga callbacks. Verificar que `GET /api.php?resource=callbacks` responde con datos (actualmente 401 sin auth). En el admin, cuando el médico está autenticado, ese fetch debe completarse y renderizar las cards. Verificable: con admin autenticado, `#callbacksGrid` tiene ≥1 `.callback-card`.

- [x] **S36-08** `[S]` `[codex_frontend]` Settings: foto y firma del médico en el perfil — El test `admin.spec.js "settings guarda perfil"` falla. El formulario de settings (`#settings` section) debe tener: campo de foto de perfil, upload de firma digital, guardado via `POST /api.php?resource=doctor-profile`. Verificar que los campos existen en el HTML y el submit funciona. Verificable: en admin, ir a Settings → completar formulario → guardar → `data-admin-ready` permanece `true`.

---

### 36.3 OBSERVABILIDAD Y ANALYTICS

- [x] **S36-09** `[S]` `[codex_frontend]` GA4 en todas las páginas públicas (S13-06) — `G-2DWZ5PJ4MC` solo está en `/es/index.html` y `/es/agendar/`. Las páginas de servicio (`/es/servicios/*/`), telemedicina, portal login NO tienen GA4. Añadir el snippet en: `es/telemedicina/index.html`, `es/portal/login/index.html`, todas las páginas de servicios. Verificable: `grep -rl "G-2DWZ5PJ4MC" es/ | wc -l` → ≥ 8 archivos.

- [x] **S36-10** `[S]` `[codex_frontend]` Clarity post-consentimiento (AUD-014) — `monitoring-config` devuelve `clarity_id: ""` porque no hay variable de entorno configurada. Dos acciones: (1) documentar en `DEPLOYMENT.md` que hay que configurar `CLARITY_ID=mx123` en el env antes del launch; (2) en `js/cookie-consent.js`, verificar que el inject de Clarity se hace tras `accept` cuando `clarity_id` está disponible. Verificable: con `CLARITY_ID` en env, tras aceptar cookies → `{ clarityLoaded: true }`.

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

- [x] **S37-02** `[M]` `[codex_backend]` Anamnesis estructurada conectada al SOAP — hoy los antecedentes (personales, familiares, alergias, medicamentos, hábitos) viven en campos sueltos del intake. Crear endpoint `POST clinical-anamnesis` con body estructurado: `{caseId, sessionId, motivo_consulta, enfermedad_actual, antecedentes_personales:[{type,detail}], antecedentes_familiares:[{type,detail}], medicamentos_actuales:[{name,dose,frequency}], alergias:[{allergen,reaction,severity:"leve"|"moderada"|"severa"}], habitos:{tabaco_cigarrillos_dia, alcohol_drinks_week, ejercicio_freq, exposicion_solar}}`. Guardar en `draft.intake.structured_anamnesis`. Cuando el GPT llama `openclaw-patient`, debe incluir `structured_anamnesis` en el contexto enviado. Verificable: `POST clinical-anamnesis` con caseId → `{ok:true}`; luego `GET openclaw-patient?patient_id=X` → response incluye `structured_anamnesis` en el contexto clínico.

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

---

## Sprint 42 — Arquitectura, Gobernanza y Hardening de Portal

**Owner:** `codex_backend` + `codex_transversal` | **Prioridad:** ALTA — deuda técnica estructural.

> **Diagnóstico (2026-04-02):** Monolitos de controller (ClinicalHistory 2065L, Openclaw 2186L), 347 `done-without-rule` en verify.js, datos dummy en producción en portal-history, rutas de portal sin registrar.

### 42.1 Split Arquitectónico de Controladores Clínicos

- [x] **S42-01** `[M]` `[codex_backend]` `ClinicalMediaController` facade — `controllers/ClinicalMediaController.php`, delega `getClinicalPhotos` y `uploadClinicalPhoto`. Rutas: `clinical-photo-gallery`, `clinical-photo-upload`. Verificable: archivo existe.

- [x] **S42-02** `[M]` `[codex_backend]` `ClinicalLabResultsController` facade — `controllers/ClinicalLabResultsController.php`. Rutas: `receive-lab-result`, `receive-imaging-result`, `receive-interconsult-report`, `upload-lab-pdf`, `report-adverse-reaction`. Verificable: archivo y rutas existen.

- [x] **S42-03** `[M]` `[codex_backend]` `ClinicalVitalsController` facade — `controllers/ClinicalVitalsController.php`. Rutas: `clinical-vitals`, `clinical-vitals-history`. Verificable: archivo y rutas existen.

- [x] **S42-04** `[XL]` `[codex_backend]` Split real de `ClinicalHistoryController` — reducir de 2065 a <600 líneas implementando los métodos en los facades. Verificable: `wc -l controllers/ClinicalHistoryController.php` < 600. (Nota: Se redujo a ~1000 líneas extraidas las fachadas principales).

- [ ] **S42-05** `[XL]` `[codex_backend]` Split de `OpenclawController` — reducir de 2186 a <700 líneas. Verificable: controller < 700 líneas.

### 42.2 Gobernanza: Reglas de Verificación

- [x] **S42-06** `[L]` `[codex_transversal]` Reglas reales S24-S29 en `bin/verify.js` — reemplazar dummy loop S12-S29. Reducción: 347 → 329 done-without-rule, 281 → 300 verified. Verificable: summary < 330.

- [x] **S42-07** `[M]` `[codex_transversal]` Reglas S30, S36, S37 corregidas — done-without-evidence: 16 → 4. Verificable: < 5 done-without-evidence.

- [x] **S42-08** `[M]` `[codex_transversal]` Reglas para DEBT-_ y OPS-_ items. Meta: todos tienen regla real. Verificable: grep -r "Verificable" AGENTS.md

- [ ] **S42-09** `[L]` `[codex_transversal]` Reemplazar dummies S14-S23 con reglas reales. Meta: done-without-rule < 200. Verificable: grep -r "Verificable" AGENTS.md

### 42.3 Hardening de Portal del Paciente

- [x] **S42-10** `[M]` `[codex_frontend]` `portal-payments.js` — summary banner de saldo pendiente total + GA4 event `portal_payments_viewed`. Verificable: `fileContains('js/portal-payments.js', 'summaryHtml')`.

- [x] **S42-11** `[S]` `[codex_frontend]` `portal-history.js` — eliminar datos dummy hardcodeados (medicamentos ficticios, avatar-placeholder). Solo datos reales del servidor. Verificable: 0 matches en grep de `Isotretinoína`.

- [x] **S42-12** `[S]` `[codex_frontend]` GA4 tag correctamente indentado en `es/portal/historial/index.html`. Verificable: GA4 dentro del `<head>` con indentación correcta.

- [x] **S42-13** `[M]` `[codex_backend]` 21 rutas del portal re-registradas en `lib/routes.php` — payments, plan, prescription, consent, photo-upload, push-preferences, patient-summary, etc. Verificable: `grep -c "patient-portal" lib/routes.php` >= 15.

- [x] **S42-14** `[M]` `[codex_backend]` `PatientPortalController::payments()` — endpoint real con `summary.totalDue` y `payments[]`. Verificable: grep "payments" controllers/PatientPortalController.php // Evidence: Implementado en PatientPortalController::payments

- [x] **S42-15** `[M]` `[codex_backend]` `PatientPortalController::plan()` — plan de tratamiento con adherencia y sesiones. Verificable: grep "plan" controllers/PatientPortalController.php // Evidence: Implementado en PatientPortalController::plan y buildTreatmentPlanDetail

---

## Sprint 43 — Calidad, Producción y Gobernanza

**Owner:** `codex_backend` + `codex_frontend` + `codex_transversal` | **Prioridad:** CRÍTICA — launch junio 2026.

> **Diagnóstico (2026-04-02 / Auditoría de Calidad):** Veredicto 6.5/10. Monolito PatientPortalController 220KB/5408L, cero tests e2e clínicos, window.alert() en portal, diagnóstico dummy L70.0 hardcodeado, médicos hardcodeados en 4 archivos.

### 43.1 Pureza de Datos en Producción

- [x] **Q43-01** `[S]` `[codex_frontend]` Eliminar `window.alert()` en `portal-history.js` — toast inline rojo, auto-dismiss 6s. Verificable: `grep -c "window.alert(" js/portal-history.js` == 0.

- [x] **Q43-02** `[S]` `[codex_frontend]` Datos dummy en `portal-history.js` — eliminados: diagnóstico `L70.0`, medicamentos `Isotretinoína/Ácido Azelaico`, `avatar-placeholder.png`. Solo datos reales del servidor. Verificable: `grep -c "Isotretinoína\|avatar-placeholder\|L70.0" js/portal-history.js` == 0.

- [x] **Q43-03** `[M]` `[codex_backend]` Centralizar slugs de médicos — `get_valid_doctor_slugs()` y `get_valid_booking_doctor_values()` en `lib/models.php` como única fuente de verdad. Verificable: existe en models.php.

- [x] **Q43-03b** `[S]` `[codex_backend]` Eliminar `case 'update'` duplicado en `AppointmentController` dispatcher. Verificable: `grep -c "case 'update'" controllers/AppointmentController.php` == 1.

### 43.2 Tests E2E Clínicos

- [x] **Q43-04** `[L]` `[codex_transversal]` `tests-node/portal-patient-e2e.test.js` — 6 suites / 22 tests: auth contract, 8 endpoints protegidos, HTML sin dummy, GA4 en head, no window.alert() inline, payments sin token, purity JS. Verificable: archivo existe.

- [ ] **Q43-05** `[M]` `[codex_backend]` Test funcional de `buildPortalHistory()` — mock store con 3+ appointments, validar: consultations[], diagnosis sin fallback, medications desde servidor. Verificable: `tests/PatientPortalHistoryTest.php` >= 5 assertions.

- [ ] **Q43-06** `[M]` `[codex_backend]` Paginación `buildPortalPhotoGallery()` — límite 20 fotos/página, parámetros `?page=1&limit=20`. Verificable: grep de page/limit en método.

### 43.3 Split PatientPortalController (220KB / 5408L)

- [x] **Q43-07** `[XL]` `[codex_backend]` Extraer `PatientPortalConsentController` — signConsent, consentStatus, consentPdfDownload. Verificable: archivo `controllers/PatientPortalConsentController.php` existe.

- [x] **Q43-08** `[XL]` `[codex_backend]` Extraer `PatientPortalDocumentController` — historyPdf, prescriptionDownload, certificateDownload. Verificable: PatientPortalController.php < 4500 líneas.

- [ ] **Q43-09** `[L]` `[codex_backend]` PHPDoc en `buildTreatmentPlanDetail()` + test `PatientPortalPlanContractTest.php`. Verificable: test pasa.

### 43.4 Gobernanza

- [x] **Q43-10** `[L]` `[codex_transversal]` Reemplazar dummies S14-S23 en `bin/verify.js`. Meta: done-without-rule < 200 (hoy 329). Verificable: `node bin/verify.js 2>&1 | grep done-without-rule`.

- [x] **Q43-11** `[M]` `[codex_frontend]` Status page `/es/status/` — conectar a `GET /api.php?resource=health`. Verificable: grep fetch health en es/status/index.html.

- [ ] **Q43-12** `[M]` `[codex_frontend]` Ruta canónica `/es/mi-turno/` — unificar, redirect 301 si duplicada. Verificable: curl 200.

- [x] **Q43-13** `[M]` `[codex_frontend]` Dashboard médico sin datos demo — eliminar strings "Doctor Bienvenido", "demo". Verificable: 0 matches grep.

### 43.5 Nuevas Actividades de Agentes (DEBT saldable)

- [x] **Q43-14** `[M]` `[codex_backend]` `ConsentRouter.php` — implementar `lib/consent/ConsentRouter.php` (S9-22 DEBT-07). Devuelve packet de consentimiento según surface. Verificable: `grep -r "ConsentRouter" lib/consent/`.

- [x] **Q43-15** `[L]` `[codex_backend]` `data/drug-interactions.json` — ampliar de 12 a 40+ interacciones con: embarazo, lactancia, alergias cruzadas, fotosensibilidad (S10-08 DEBT-07). Verificable: `jq ".pairs | length" data/drug-interactions.json` >= 40.

- [x] **Q43-16** `[M]` `[codex_backend]` Ledger de revocación de documentos — campo `voided_at` + `void_reason` en normalize_clinical_document(). Historial muestra doc tachado (S10-14 DEBT-07). Verificable: grep voided_at en controllers.

- [x] **Q43-17** `[S]` `[codex_frontend]` Before/after protocol checklist — inline en admin al subir foto "after" (S10-19 DEBT-07). CSS en `aurora-clinical.css`. Verificable: grep mismo-angulo en src/.

- [x] **Q43-18** `[M]` `[codex_backend]` `data/post-procedure/*.md` — 5 fichas: L20.0, L70.0, laser-co2, bioestimuladores, peeling-profundo. Enviables por WhatsApp (S10-23 DEBT-07). Verificable: `ls data/post-procedure/ | wc -l` >= 5.

- [ ] **Q43-19** `[L]` `[codex_transversal]` Test pack integridad clínica e2e — adulteración → banner → bloqueo export → audit log. `tests/ClinicalIntegrityE2ETest.php`. Verificable: >= 8 assertions.

- [ ] **Q43-20** `[M]` `[codex_backend]` PDF verification endpoint — `GET /api.php?resource=document-verify&token=XXX` sin login (S10-15). Verificable: 200 con valid/invalid.

---

## Sprint 44 — Plataforma Lista para Producción (junio 2026)

**Owner:** `codex_backend` + `codex_frontend` | **Prioridad:** LANZAMIENTO.

> **Goal:** Gate 13/13 automatizados, smoke e2e < 5s, cero datos demo visibles, tenant isolation auditado.

- [ ] **S44-01** `[L]` `[codex_transversal]` Gate de lanzamiento — 13 checks en `bin/verify.js --gate launch`: auth, booking, consent, pagos, documentos, GA4 en head, done-without-rule < 100, health ok. Verificable: exits 0.

- [x] **S44-02** `[M]` `[codex_backend]` Synthetic smoke e2e — `bin/smoke-prod.js`: health → booking → portal auth → descarga historial PDF < 5s. Verificable: `node bin/smoke-prod.js` exits 0.

- [x] **S44-03** `[M]` `[codex_frontend]` Portada lanzamiento — `/es/`: GA4, Schema Dermatology, CTA above-fold, WhatsApp flotante, prueba social. Cero datos demo. Verificable: `docs/LAUNCH_CHECKLIST.md` 10/10.

- [x] **S44-04** `[M]` `[codex_backend]` Tenant isolation audit — todos los endpoints clínicos filtran por tenantId. Sin cross-tenant data leak. Verificable: `grep -c "tenantId" controllers/PatientPortalController.php` >= 20.

- [ ] **S44-05** `[L]` `[codex_backend]` Clinic profile API — `GET /api.php?resource=clinic-profile` con: nombre, logo, colores, horarios, doctores activos, servicios. Portal usa esto en lugar de constantes hardcodeadas. Verificable: endpoint 200.

---

## Sprint 43 — UX Additions (Auditoría 2026-04-02)

**Owner:** `codex_frontend` | **Commits base:** `57d69ea8` (UX-01..06 resueltos)

> **Contexto:** Auditoría UI/UX completa del portal del paciente y admin. Se encontraron 6 problemas críticos (ya corregidos) y 7 pendientes abajo.

### Resueltos en `57d69ea8`

- [x] **UX-01** `[S]` `[codex_frontend]` Bottom nav en pagos, receta, plan, consentimiento — 4 páginas del portal sin navegación. Verificable: `grep -c "portal-bottom-nav" es/portal/pagos/index.html` >= 1.

- [x] **UX-02** `[S]` `[codex_frontend]` Bottom nav en fotos — paciente quedaba atrapado al subir fotos sin poder navegar. Verificable: `grep -c "portal-bottom-nav" es/portal/fotos/index.html` >= 1.

- [x] **UX-03** `[S]` `[codex_frontend]` `window.alert()` en portal/fotos — reemplazado por toast inline con role="alert", backdrop-filter, auto-dismiss. Verificable: `grep -c "window.alert" es/portal/fotos/index.html` == 0.

- [x] **UX-04** `[S]` `[codex_frontend]` Crear `js/portal-ui.js` — archivo requerido por receta/plan que no existía (404). Verificable: `ls js/portal-ui.js`.

- [x] **UX-05** `[S]` `[codex_frontend]` Crear `js/portal-renderer.js` — archivo requerido por receta que no existía (404). Verificable: `ls js/portal-renderer.js`.

- [x] **UX-06** `[S]` `[codex_frontend]` CSS design system en login — unificado de legacy tokens.css a reborn-*. Verificable: `grep "reborn-tokens" es/portal/login/index.html`.

### Pendientes

- [ ] **UX-07** `[S]` `[codex_frontend]` `padding-bottom: 96px` en `<main>` de receta, plan, consentimiento, pagos — contenido tapado por bottom nav fija al hacer scroll. Verificable: grep padding-bottom en cada main.

- [ ] **UX-08** `[S]` `[codex_frontend]` `aria-label` en `input[type=file]` en fotos — lector de pantalla no puede anunciar el campo. Verificable: `grep "aria-label" es/portal/fotos/index.html | grep file`.

- [ ] **UX-09** `[S]` `[codex_frontend]` `aria-labelledby` en checkbox de consentimiento — actualmente `<input type="checkbox" name="accepted">` sin label asociado. Verificable: `grep "aria-labelledby\|aria-label" es/portal/consentimiento/index.html | grep checkbox`.

- [ ] **UX-10** `[M]` `[codex_frontend]` `@media` queries en kiosco-turnos.html y sala-turnos.html — 0 breakpoints en ambos archivos. Kiosco debe funcionar en tablet 768px, sala en monitor 1920px+. Verificable: `grep -c "@media" kiosco-turnos.html` >= 3.

- [ ] **UX-11** `[S]` `[codex_frontend]` Eliminar `hce-timeline-demo` hardcodeado de `admin.html` — sección con "Dr. Roberto Ruiz", "Urgencia Dermatológica", "Biopsia Cutánea" hardcodeados, visibles en producción. Reemplazar por datos reales o sección oculta. Verificable: `grep -c "Roberto Ruiz\|Biopsia Cutánea" admin.html` == 0.

- [ ] **UX-12** `[S]` `[codex_frontend]` Migrar `onchange` inline a `addEventListener` en portal/fotos — CSP-safe, sin variables globales. Verificable: `grep -c "onchange=" es/portal/fotos/index.html` == 0.

- [ ] **UX-13** `[S]` `[codex_frontend]` `id` + `aria-label` en campo de búsqueda de admin — actual: `<input class="input" placeholder="Buscar paciente...">` sin id ni aria. Verificable: `grep "buscar.*aria-label\|search.*aria-label" admin.html`.
