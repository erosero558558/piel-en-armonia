# Ideas Podadas (Sprints 45-49)

## Sprint 45 — Portal Instalado, Derechos del Paciente y Verificacion Veraz

**Owner:** `codex_frontend` + `codex_backend` + `codex_transversal` | **Prioridad:** ALTA.

> **Diagnostico (2026-04-02 / Auditoria portal):** el portal ya tiene base PWA, consentimiento y endpoints de derechos, pero aun no cierra el ciclo real de instalacion, actualizacion, offline honesto, self-service juridico y verificacion veraz. Ademas, `verify` todavia tiene falsos positivos y runners ambiguos.

### 45.1 Portal PWA y experiencia instalada real

- [-] **S45-01** `[L]` `[codex_frontend]` PWA del portal con scope propio — separar la app instalada del portal del worker compartido operacional. El portal debe tener worker/manifest propios bajo `/es/portal/`, sin arrastrar assets de `admin`, `operador`, `kiosco` o `sala`. Verificable: la instalacion del portal abre y permanece dentro del scope `/es/portal/`.

- [-] **S45-02** `[M]` `[codex_frontend]` Lifecycle real de instalacion y actualizacion — implementar `beforeinstallprompt`, `appinstalled`, deteccion de version nueva y CTA de recarga. La experiencia instalada del portal debe tener contrato visible de install/update. Verificable: el portal muestra prompt solo cuando aplica y avisa cuando hay una version nueva lista para activarse.

- [-] **S45-03** `[M]` `[codex_frontend]` Offline honesto del portal — dashboard, historial, plan y consentimiento deben degradar a modo `solo lectura` con `last_synced_at` o empty state explicito. Nada de exito falso ni pantallas en blanco. Verificable: sin red, el portal muestra estado offline claro y nunca simula que guardo cambios.

- [-] **S45-04** `[M]` `[codex_frontend]` Recuperacion de suscripcion push — soportar drift de permisos y `pushsubscriptionchange`. Una suscripcion invalida no puede dejar el card de push en verde. Verificable: una suscripcion invalida se repara o muestra accion correctiva clara.

- [-] **S45-05** `[S]` `[codex_frontend]` Truth pass de background sync — eliminar `sync-appointments` si no existe cola real, o reemplazarlo por un flujo implementado de verdad. No dejar placeholders que aparenten resiliencia. Verificable: no queda no-op silencioso en el worker del portal.

### 45.2 Derechos del paciente y autogestion real

- [-] **S45-06** `[L]` `[codex_backend]` Solicitud self-service de exportacion de datos — crear `POST /api.php?resource=patient-data-export-request` y `GET /api.php?resource=patient-data-export-request-status`. El paciente autenticado pide su export sin enviar `patient_id` manual. Verificable: un paciente autenticado solo puede pedir su propio export.

- [-] **S45-07** `[L]` `[codex_backend]` Solicitud self-service de eliminacion de datos — crear `POST /api.php?resource=patient-data-erasure-request` y `GET /api.php?resource=patient-data-erasure-request-status`. El portal muestra preview de campos retenidos por obligacion legal antes de confirmar la solicitud. Verificable: desde portal se solicita la eliminacion, pero no se ejecuta borrado irreversible sin control.

- [-] **S45-08** `[M]` `[codex_backend]` Resumen canonico de derechos del paciente — crear `GET /api.php?resource=patient-portal-rights` para devolver consentimiento vigente, ultima version firmada, requests de export/erasure, PDFs disponibles y mensajes legales. Verificable: el portal deja de componer estos estados con llamadas sueltas o supuestos.

- [-] **S45-09** `[M]` `[codex_backend]` Archivo de consentimientos del portal — extender el contrato del portal para listar consentimientos firmados anteriores, con `version`, `signed_at`, `status`, `pdfAvailable`, `downloadUrl`. Verificable: el paciente puede revisar y descargar consentimientos anteriores desde una fuente canonica.

- [-] **S45-10** `[M]` `[codex_frontend]` Centro "Mis datos" en portal — crear `/es/portal/mis-datos/` como surface canonica para exportacion, eliminacion, consentimientos y estado de solicitudes. Verificable: el paciente encuentra todo lo juridico-operativo en una sola surface.

### 45.3 Verificacion veraz y deuda de calidad

- [-] **S45-11** `[M]` `[codex_transversal]` Corregir falsos positivos de `bin/verify.js` — arreglar reglas como `S25-07` para que verifiquen la senal correcta y no solo presencia superficial de archivo/string. Verificable: `S25-07` deja de marcarse done sin `beforeinstallprompt` real.

- [-] **S45-12** `[L]` `[codex_transversal]` Cobertura real de reglas para S42/Q43/S44 — conectar verificacion real a las tareas nuevas ya marcadas `done` que hoy aparecen como `done-without-rule`. Meta: bajar `done-without-rule` de `37` a `<10`. Verificable: `npm run verify --silent` reduce materialmente esa categoria.

- [-] **S45-13** `[M]` `[codex_transversal]` Normalizar runners de tests del portal — definir runners canonicos para scripts propios (`php tests/...`) vs PHPUnit, y reflejar eso en `AGENTS`/evidencia para que no haya tareas "hechas" con comando incorrecto. Verificable: las tareas del portal apuntan al runner correcto y no inducen a usar PHPUnit cuando no aplica.

- [-] **S45-14** `[M]` `[codex_transversal]` Harness canonico para `portal-patient-e2e` — crear comando que levante o reutilice el server local antes de `tests-node/portal-patient-e2e.test.js`, y falle con mensaje accionable si no hay runtime disponible. Verificable: el test tiene runner reproducible y deja de depender de `127.0.0.1:8000` manual.

- [-] **S45-15** `[M]` `[codex_transversal]` Higiene del repo principal y split por lane — sacar al workspace principal del estado `mixed_lane` y dejarlo publicable/sincronizable. El doctor de higiene no debe quedar `blocked`. Verificable: `npm run workspace:hygiene:doctor` deja de marcar el repo principal como bloqueado por mezcla de lanes.

- [-] **S45-16** `[S]` `[codex_transversal]` Gate de whitespace y authored drift basico — anadir chequeo explicito para trailing whitespace y authored drift simple, porque hoy `git diff --check` ya esta rojo en archivos clinicos y de rutas. Verificable: `git diff --check` queda limpio o el gate falla con mensaje accionable.

---

## Sprint 46 — Frentes Desatendidos: Flow OS, EN, Pediatría y Customer Success

**Owner:** `codex_backend_ops` + `codex_frontend` + `codex_transversal` | **Prioridad:** ALTA.

> **Diagnostico (2026-04-01 / Auditoria de frentes desatendidos):** el board esta muy cargado en `portal/admin/hardening`, pero el repo ya contiene otros frentes reales que casi no estan convertidos en backlog. Los mas desatendidos hoy son `src/apps/patient-flow-os`, `en/`, `ninos/`, las surfaces de `queue-shared` para onboarding/adoption/support/renewal y el sistema editorial del contenido publico.

### 46.1 Flow OS / patient-flow-os

- [-] **S46-01** `[L]` `[codex_backend_ops]` Reality sync de Flow OS en el board — declarar explicitamente que `patient-flow-os` ya es una slice viva con runtime, docs e infra; dejar ownership, estado y contratos reales en el backlog para que no siga tratada como experimento lateral. Verificable: `AGENTS.md` y `BACKLOG.md` nombran `patient-flow-os` como slice activa y no como placeholder.

- [-] **S46-02** `[L]` `[codex_backend_ops]` Readiness de Postgres cutover para Flow OS — convertir la documentacion de cutover en checklist ejecutable: prerequisitos, seed minimo, rollback, verificacion post-cutover y smoke de integridad. Verificable: existe checklist reproducible y un smoke canónico del cutover.

- [-] **S46-03** `[M]` `[codex_backend_ops]` API domains contract para Flow OS — formalizar que dominios/endpoints son canonicos, cuales siguen legacy y como se versionan. La meta es evitar drift entre docs, runtime y surfaces. Verificable: `docs/API_DOMAINS.md` y runtime no se contradicen en dominios activos.

- [-] **S46-04** `[M]` `[codex_frontend]` Paridad de surfaces Flow OS — asegurar que `Ops Console`, `Patient Flow Link`, `Wait Room Display` y `Clinic Dashboard` consumen el mismo caso/tenant de demo y no muestran estados divergentes. Verificable: smoke multi-surface con el mismo tenant/case de referencia.

- [-] **S46-05** `[M]` `[codex_transversal]` Workflow contracts ejecutables de Flow OS — aterrizar los contracts ya documentados a checks reales: promote, rollback, backup-drill, escrow-restore y DR history con prechecks y evidencia. Verificable: cada workflow critico tiene precheck y evidencia utilizable.

- [-] **S46-06** `[M]` `[codex_backend_ops]` Tenant demo canonico de Flow OS — crear un tenant/case de referencia unico para smoke, screenshots, QA y demos comerciales; nada de demos dispersas por surface. Verificable: existe un tenant demo canónico reutilizado por las surfaces principales.

- [-] **S46-07** `[M]` `[codex_transversal]` Release truth de Flow OS — definir que surfaces estan `pilot`, `internal`, `published` o `staged` y reflejarlo en docs/comercial/readiness para no vender mas de lo que existe. Verificable: la narrativa comercial y la readiness operativa no se contradicen.

### 46.2 English / internacionalizacion / legal parity

- [-] **S46-08** `[M]` `[codex_frontend]` Paridad funcional EN vs ES en paginas clave — auditar `home`, `booking`, `telemedicine`, `portal login`, `legal` y `software` en ingles para detectar paginas que solo traducen copy pero no conectan con flujos reales. Verificable: las paginas EN clave tienen CTA funcionales y surface viva.

- [-] **S46-09** `[M]` `[codex_transversal]` Legal parity bilingue — asegurar que `privacy`, `terms`, `cookies` y `medical disclaimer` en `en/` no queden desalineados respecto a `es/` en consentimiento, analytics, IA clinica, telemedicina y documentos. Verificable: no hay divergencias materiales entre las paginas legales EN y ES.

- [-] **S46-10** `[S]` `[codex_frontend]` Canonical/hreflang internacional real — corregir canonical/hreflang para que ES y EN no compitan mal ni apunten a paginas incompletas. Verificable: `curl`/`grep` sobre metas canónicas devuelve pares EN/ES coherentes.

- [-] **S46-11** `[M]` `[codex_frontend]` CTA parity EN — eliminar CTAs en ingles que apunten a rutas rotas, flujos solo en español o surfaces internas; toda pagina EN debe tener next step funcional. Verificable: `rg "/es/|admin.html|portal/agendar" en/` no deja CTAs publicas rotas en ingles.

- [-] **S46-12** `[M]` `[codex_transversal]` English B2B truth pass — `en/software/clinic-flow-suite/` debe contar la misma historia comercial verdadera que la surface ES, sin pricing, readiness o claims distintos. Verificable: la oferta B2B EN y ES coincide en modo comercial y readiness.

### 46.3 Pediatria / verticales clinicas

- [-] **S46-13** `[M]` `[codex_frontend]` Consolidacion del vertical pediatrico — hoy `ninos/dermatologia-pediatrica.*` parece duplicado/parcial. Debe quedar una sola surface canonica, con copy, CTA y SEO coherentes. Verificable: existe una ruta canonica y la duplicada redirige o queda archivada.

- [-] **S46-14** `[M]` `[codex_transversal]` Journey pediatrico real — definir si el vertical pediatrico deriva a booking general, pre-consulta especifica o contacto asistido, y alinear todos los CTAs a ese camino. Verificable: todos los CTAs del vertical llevan al mismo journey definido.

- [-] **S46-15** `[S]` `[codex_frontend]` Trust pack pediatrico — reforzar senales de confianza para menores: acompanamiento familiar, preparacion, consentimiento de representante y limites de teleconsulta cuando aplique. Verificable: la surface pediatrica muestra trust signals y disclaimers especificos.

- [-] **S46-16** `[S]` `[codex_transversal]` SEO/metadata pediatrica — titulos, schema, OG y canonical correctos; evitar que la vertical quede como pagina huerfana o duplicada. Verificable: las metas pediatricas son coherentes y no compiten entre si.

### 46.4 Customer success / adoption / support / renewal

- [-] **S46-17** `[L]` `[codex_transversal]` Onboarding console operable — convertir las surfaces de onboarding de `queue-shared` en flujo persistente por clinica: progreso, bloqueos, responsables y fecha estimada de go-live. Verificable: una clinica puede verse con onboarding persistente y estado accionable.

- [-] **S46-18** `[M]` `[codex_transversal]` Adoption score real por clinica — formalizar score con uso de surfaces, tickets emitidos, sesiones activas, training y primeros hitos, para que adopcion no sea solo una UI bonita. Verificable: existe score reproducible por clinica con insumos reales.

- [-] **S46-19** `[M]` `[codex_backend_ops]` Support console con contexto clinico-operativo — aterrizar soporte con prioridad, owner, aging, estado y contexto de clinica/surface sin obligar a leer logs manualmente. Verificable: una incidencia muestra contexto minimo util desde la consola.

- [-] **S46-20** `[M]` `[codex_transversal]` Training readiness registry real — hacer operativo el registro de entrenamiento por rol, con completion state y bloqueo de readiness si falta capacitacion minima. Verificable: una clinica no queda `ready` si faltan entrenamientos obligatorios.

- [-] **S46-21** `[M]` `[codex_transversal]` Executive review accionable — la surface de executive review debe devolver decision clara: `not ready`, `pilot ready`, `renewal risk`, `expansion ready`. Verificable: executive review produce un estado y siguiente accion claros.

- [-] **S46-22** `[M]` `[codex_transversal]` Renewal cockpit con churn signals — convertir renewal surfaces en una vista comercial real con plan, fecha, uso, tickets, training incompleto y riesgo de churn. Verificable: renewal cockpit muestra riesgo y siguiente accion comercial.

- [-] **S46-23** `[M]` `[codex_transversal]` Field feedback exchange -> backlog — enlazar feedback de clinicas a clasificacion real: bug, solicitud, bloqueo, confusion, deuda comercial; cada categoria debe poder aterrizar en tarea. Verificable: feedback clasificado puede trazarse a backlog o decision operativa.

- [-] **S46-24** `[S]` `[codex_frontend]` Success surfaces premium y coherentes — revisar UX/copy de success, support, onboarding y renewal para que se sientan parte del mismo producto y no consolas separadas. Verificable: las surfaces comparten tono, navegacion y estado visual coherente.

### 46.5 Contenido / blog / operacion editorial

- [-] **S46-25** `[M]` `[codex_transversal]` Operating system del blog — definir estado por articulo: `draft`, `review`, `medically reviewed`, `published`, `stale`. Hoy hay contenido publicado pero sin contrato de frescura. Verificable: existe estado editorial visible por articulo o fuente canonica equivalente.

- [-] **S46-26** `[M]` `[codex_transversal]` Freshness audit de contenido — detectar posts y paginas de servicio que ya no reflejan producto actual, pricing, telemedicina, documentos o flujos vigentes. Verificable: existe lista priorizada de contenido stale y criterio de frescura.

- [-] **S46-27** `[S]` `[codex_frontend]` Interlinking real blog -> servicio -> booking — evitar contenido aislado; cada articulo debe tener CTA y enlaces utiles hacia servicio, booking o consulta. Verificable: las paginas del blog auditadas exponen links de salida funcionales.

- [-] **S46-28** `[S]` `[codex_transversal]` Medical review ledger de contenido publico — registrar que paginas/posts tuvieron revision medica, cuando y por quien, para no mezclar contenido serio con piezas huerfanas. Verificable: existe ledger o metadata verificable de revision medica.

---

## Sprint 47 — Pricing, Checkout, Packages y Revenue Ops

**Owner:** `codex_backend_ops` + `codex_frontend` + `codex_transversal` | **Prioridad:** ALTA.

> **Diagnostico (2026-04-01 / Auditoria comercial-operativa):** el repo ya tiene `payment-lib.php`, `PackageService`, `LeadScoringService`, `js/revenue-funnel.js`, checkout publico, tests de pricing y varias surfaces `package/success/support/renewal` en `queue-shared`, pero el board casi no lo trata como sistema de monetizacion real. Falta convertir esas piezas en contratos comerciales, operativos y verificables.

### 47.1 Pricing y checkout truth

- [-] **S47-01** `[L]` `[codex_transversal]` Fuente canonica de pricing y tax — unificar la verdad entre `lib/business.php`, `payment-lib.php`, pricing publico, booking y checkout para que IVA, moneda, fallback y precios visibles salgan de una sola fuente. Verificable: pricing publico, booking y checkout no divergen en `base_amount`, `tax_rate` ni `total_amount`.

- [-] **S47-02** `[M]` `[codex_frontend]` Pricing public parity audit — cerrar diferencias entre pricing v4/v5/v6, pages de servicios y `/es/software/turnero-clinicas/precios/`. La UI publica no debe mezclar planes, monedas o claims incompatibles. Verificable: las pruebas de pricing/localization y software suite no muestran drift visible entre surfaces.

- [-] **S47-03** `[M]` `[codex_backend_ops]` Checkout contract portal/publico — formalizar el flujo entre `es/pago/checkout-portal.js`, `payment-lib.php` y los endpoints de pago para que `checkout`, `booking payment flow` y `patient portal billing` usen el mismo contrato de request/response. Verificable: los tests de checkout/pagos pasan sin rutas o campos especiales por surface.

- [-] **S47-04** `[M]` `[codex_backend_ops]` IVA y currency guardrails — endurecer el contrato de moneda, redondeo e IVA para evitar totals inconsistentes entre resumen, cobro y recibo. Verificable: `tests/test_payment_currency.php` y `tests/test_business_iva.php` pasan y ningun flujo devuelve montos con drift.

- [-] **S47-05** `[S]` `[codex_transversal]` Critical payments gate visible — convertir `tests-node/critical-payments-gate-contract.test.js` en señal diaria/gate utilizable, no solo test aislado. Verificable: `gov:audit` o gate equivalente expone el estado de pagos criticos.

- [-] **S47-06** `[M]` `[codex_frontend]` Empty/error states premium en checkout — cuando falle pricing, tax lookup o payment bootstrap, la surface publica debe mostrar estados honestos y accionables; no quedar a medias ni con fallback silencioso. Verificable: fallo intencional de dependencia deja UI legible y sin totales engañosos.

### 47.2 Packages como producto operable

- [-] **S47-07** `[L]` `[codex_backend_ops]` Lifecycle completo de paquetes — llevar `PackageService` a contrato de producto completo: activacion, consumo, agotado, vencido, cancelado, historial y visibilidad en portal/admin sin huecos. Verificable: un paquete puede seguirse end-to-end desde activacion hasta agotamiento.

- [-] **S47-08** `[M]` `[codex_frontend]` Package console operable — aterrizar `turnero-admin-queue-surface-package-console.js` y family (`banner`, `snapshot`, `ledger`, `gate`, `owner-store`) en una consola accionable con estado, owner y siguiente paso claro. Verificable: package console muestra estado real por clinica y no solo componentes aislados.

- [-] **S47-09** `[M]` `[codex_backend_ops]` Package balance parity portal/admin — asegurar que el saldo/consumo mostrado al paciente y al operador sale del mismo payload canonico y no diverge entre surfaces. Verificable: mismo paciente/paquete devuelve mismas sesiones usadas/restantes en portal y admin.

- [-] **S47-10** `[M]` `[codex_transversal]` Package integrity score usable — convertir `turnero-release-terminal-package-integrity-score.js` y `turnero-release-final-diagnostic-package-score.js` en una señal interpretable para go-live, soporte y renovacion. Verificable: existe score con thresholds y explicacion de fallos.

- [-] **S47-11** `[S]` `[codex_frontend]` Package messaging comercial honesta — las pages publicas de paquetes y las surfaces operativas deben hablar del mismo producto: sesiones, vigencia, consumo, restricciones y CTA. Verificable: no hay claims publicos que el runtime de paquetes no soporte.

### 47.3 Lead scoring y revenue funnel

- [-] **S47-12** `[M]` `[codex_backend_ops]` Lead scoring operativo — sacar `LeadScoringService` de helper silencioso y exponer score, banda, factores y reasons en una surface operativa util para callbacks/frontdesk. Verificable: un lead/callback muestra score y explicacion trazable.

- [-] **S47-13** `[M]` `[codex_backend_ops]` Lead AI worker health y handoff — formalizar `lead-ai-worker` con health, retry y salida operativa hacia cola humana cuando no pueda resolver o falte contexto. Verificable: existe diagnostico de worker y handoff visible.

- [-] **S47-14** `[M]` `[codex_transversal]` Revenue funnel canonico — convertir `js/revenue-funnel.js` y `tests/revenue-funnel.spec.js` en artifact/summary real para ver paso a paso: visita -> intento -> booking -> pago -> activacion. Verificable: existe un funnel utilizable con stages y fuente conocida.

- [-] **S47-15** `[M]` `[codex_transversal]` Attribution real de source/surface/service — asegurar que `source`, `surface`, `service_intent` y pago/booking quedan unidos para medir CAC y conversion por servicio. Verificable: un lead convertido conserva source/surface/service hasta el cobro o activacion.

- [-] **S47-16** `[S]` `[codex_frontend]` Success modal y revenue UX coherence — alinear `js/success-modal.js` y las superficies de pago/cierre para que el usuario vea siguiente paso claro: recibo, portal, paquete activado o seguimiento. Verificable: tras pago/activacion, la UI no deja al usuario en callejon sin salida.

## Nota operativa

> **No solapar con Sprint 46:** `S46-*` cubre onboarding/adoption/support/renewal como customer success. `S47-*` cubre monetizacion, pricing, checkout, packages, lead scoring y medicion comercial.

---

## Sprint 48 — Superficies Fisicas, Runtime de Campo y Fleet Ops

**Owner:** `codex_backend_ops` + `codex_frontend` + `codex_transversal` | **Prioridad:** ALTA.

> **Diagnostico (2026-04-01 / Auditoria de runtime fisico):** kiosco, display, desktop y Android TV ya existen como producto real, con runtime contracts, heartbeat, README, scripts de release y tests, pero todavia no estan tratados como fleet operable. La deuda no es hacer mas UI; es cerrar instalacion, configuracion, health, release truth, offline y soporte remoto.

### 48.1 Runtime truth y device fleet

- [-] **S48-01** `[L]` `[codex_transversal]` Registro canonico de superficies fisicas — crear una fuente unica para `operator`, `kiosk`, `display/sala_tv`, `desktop shell` y `android tv` con `surface_key`, `runtime_mode`, `published_channel`, `expected_route`, `heartbeat_capable`, `offline_mode`, `owner_lane`. Verificable: docs, readiness y release no se contradicen sobre que superficies existen y en que estado estan.

- [-] **S48-02** `[M]` `[codex_backend_ops]` Fleet registry desde heartbeat real — elevar `queue-surface-heartbeat` de ping suelto a inventario de dispositivos: `device_id`, `surface`, `clinic_id`, `route`, `app_mode`, `last_seen_at`, `status`, `version`, `release_mode`, `profile_fingerprint`. Verificable: un dispositivo real queda visible como entidad operable, no solo como ultimo POST.

- [-] **S48-03** `[M]` `[codex_backend_ops]` TTL y estado operativo del heartbeat — formalizar reglas `online`, `stale`, `offline`, `misconfigured`, `route_mismatch`, `profile_mismatch` sobre `tv_heartbeats` y demas surfaces. Verificable: un heartbeat viejo o incoherente cambia de estado automaticamente y deja explicacion.

- [-] **S48-04** `[M]` `[codex_frontend]` Fleet dashboard de surfaces fisicas — vista unica para ver operador, kiosco, sala TV y shells desktop con `last_seen`, `status`, `route`, `clinic`, `version`, `channel`, `outbox/retry state` si aplica. Verificable: soporte puede detectar en una sola pantalla que equipo esta caido o desalineado.

### 48.2 Desktop operator/kiosk

- [-] **S48-05** `[L]` `[codex_backend_ops]` Contrato de configuracion del shell desktop — formalizar `turnero-desktop.json` y `turnero-shell-state.json` como contrato soportado: schema, defaults, campos editables, campos inmutables por build y validacion de migraciones. Verificable: configuracion invalida no rompe el shell; se corrige o degrada con mensaje claro.

- [-] **S48-06** `[M]` `[codex_frontend]` Doctor de configuracion desktop — anadir una surface o pack de soporte que exponga `baseUrl`, `surface`, `stationMode`, `consultorio`, `launchMode`, `updateChannel`, `snapshot age`, `outbox`, `reconciliation state`. Verificable: soporte remoto puede pedir un screenshot y diagnosticar sin tocar archivos manualmente.

- [-] **S48-07** `[M]` `[codex_backend_ops]` Update truth de desktop channels — asegurar que `pilot/stable`, `latest.yml`, `latest-mac.yml`, artefactos y canal persistido en config cuentan la misma historia. Verificable: el shell no dice `stable` si el feed real viene de `pilot`, y viceversa.

- [-] **S48-08** `[M]` `[codex_backend_ops]` Offline reconciliation operable en desktop — convertir outbox/reconciliation de operador en flujo visible y accionable: items pendientes, conflictos, retry, bloqueo de offline operativo y recuperacion. Verificable: si hay conflicto, el shell lo explica y no vuelve a modo operativo a ciegas.

- [-] **S48-09** `[S]` `[codex_frontend]` Navigation guard y fallback de boot del shell — aterrizar los contratos de boot/navigation tests en UX real: countdown, retry visible, safe mode entendible y acceso a reconfiguracion. Verificable: el shell nunca queda congelado en boot sin salida.

### 48.3 Android TV / Sala TV

- [-] **S48-10** `[L]` `[codex_backend_ops]` Contrato de release de Android TV con procedencia — extender `bin/release-android-tv.sh` para producir metadata canonica: `versionName`, `versionCode`, `baseUrl`, `surfacePath`, `checksum`, `signed=true|false`, `published_at`. Verificable: cada APK publicada tiene metadata verificable, no solo un archivo y un sha suelto.

- [-] **S48-11** `[M]` `[codex_frontend]` Remote config real para Android TV — dejar de depender solo de `TurneroConfig.kt` compilado; permitir que `BASE_URL`, `SURFACE_PATH`, `RECONNECT_DELAY_MS` y flags minimas se resuelvan desde config remota/versionada. Verificable: staging/prod o cambio de host no exige recompilar APK.

- [-] **S48-12** `[M]` `[codex_frontend]` Offline diagnostics premium en TV — fortalecer la pantalla offline para mostrar `host`, `ultimo intento`, `proximo reintento`, `ultima version conocida`, `estado de red` y accion de soporte. Verificable: una TV sin red no queda en blank WebView ni en spinner eterno.

- [-] **S48-13** `[M]` `[codex_backend_ops]` Heartbeat real de Android TV — hacer que la APK reporte `device_id`, `version`, `build`, `base_url`, `surface_path`, `last_loaded_url`, `network_state` y `last_render_state`. Verificable: una TCL/Google TV aparece en fleet dashboard con identidad y salud reales.

- [-] **S48-14** `[S]` `[codex_frontend]` Guard de navegacion de WebView — endurecer la restriccion de navegacion fuera de `sala-turnos.html` con fallback claro cuando el host intente sacar a la app de su scope. Verificable: links inesperados no sacan la TV del flujo de sala.

### 48.4 Kiosk/display web parity

- [-] **S48-15** `[M]` `[codex_frontend]` Paridad web vs shell para kiosk/display — asegurar que `queue-kiosk.html`, `queue-display.html`, `js/queue-kiosk.js` y `js/queue-display.js` mantienen el mismo contrato operativo que los shells nativos. Verificable: web y shell muestran mismos estados criticos: ready/offline/retry/safe.

- [-] **S48-16** `[M]` `[codex_transversal]` Route contract de superficies fisicas — formalizar que `operator`, `kiosk`, `display` y aliases como `sala_tv` usan rutas esperadas unicas y medibles. Verificable: un route mismatch se detecta automaticamente en runtime y en fleet dashboard.

- [-] **S48-17** `[S]` `[codex_frontend]` Audio/chime readiness de sala — hacer explicito el estado del audio/campanilla en sala TV/display para que soporte sepa si la pantalla "ve la cola" pero no esta avisando. Verificable: existe senal visible de audio listo/bloqueado/no soportado.

- [-] **S48-18** `[M]` `[codex_transversal]` Runtime vs source diff utilizable — convertir `turnero-release-runtime-vs-source-diff.js` en una verificacion operativa que compare lo publicado, lo esperado y lo que la surface esta cargando de verdad. Verificable: si una surface corre contra host/ruta/canal equivocados, el check lo muestra.

### 48.5 Soporte de campo y QA

- [-] **S48-19** `[M]` `[codex_transversal]` Support pack de superficies fisicas — crear paquete unico para soporte con screenshot checklist, fingerprint de perfil, route actual, version, channel, heartbeat, snapshot age y estado de outbox/retry. Verificable: desde un equipo se puede exportar o copiar un bundle de soporte coherente.

- [-] **S48-20** `[M]` `[codex_transversal]` Checklist de instalacion en campo — aterrizar runbook de instalacion para operador desktop, kiosco web, sala TV web y Android TV: prerequisitos, red, autostart, pantalla activa, audio, update channel, smoke post-instalacion. Verificable: cada modalidad tiene checklist reproducible y no depende de memoria tribal.

- [-] **S48-21** `[M]` `[codex_transversal]` QA pack de fleet ops — agregar pruebas especificas para: heartbeat payload, TTL state machine, desktop boot lifecycle, navigation guard, Android TV release metadata y route contract de kiosk/display. Verificable: existe pack canonico que falla si se rompe soporte de campo.

- [-] **S48-22** `[S]` `[codex_transversal]` Semaforo de readiness por dispositivo — cada equipo fisico debe poder quedar en `ready`, `warning`, `blocked`, `stale` con causa concreta. Verificable: no quedan superficies fisicas visibles solo como `up/down` sin explicacion operativa.

## Nota operativa

> **No solapar con Sprint 45/46/47:** `S45-*` cubre portal/PWA/derechos del paciente, `S46-*` customer success/contenido y `S47-*` monetizacion/revenue. `S48-*` cubre exclusivamente runtime fisico, fleet ops y soporte de campo.

---

## Sprint 49 — Funcionalidad de Lanzamiento, Truth de Release y Gates Reales

**Owner:** `codex_transversal` + `codex_backend_ops` | **Prioridad:** CRITICA — launch veraz.

> **Diagnostico (2026-04-01 / Auditoria de lanzamiento):** hay producto usable, pero el sistema todavia no puede afirmar con honestidad que esta listo para lanzamiento. `verify` sigue rojo, `PRODUCT_OPERATIONAL_STATUS` sigue en `RED`, `LAUNCH_CHECKLIST` declara `10/10 listo`, el readiness summary sigue bloqueado por monitor/hosting/post-deploy/public sync/calendar/turneroPilot, faltan artefactos prometidos y varios gates/smokes no reflejan evidencia funcional real.

### 49.1 Truth de lanzamiento y fuentes canonicas

- [-] **S49-01** `[L]` `[codex_transversal]` Sincronizacion del semaforo de lanzamiento — alinear `PRODUCT_OPERATIONAL_STATUS`, `LAUNCH_CHECKLIST` y `prod-readiness-summary` para que no puedan contar historias contradictorias. Verificable: si readiness esta `RED`, ningun documento certificado queda en "listo para produccion" sin nota de bloqueo explicita.

- [-] **S49-02** `[M]` `[codex_transversal]` Contrato del artefacto `last-deploy-verify` — restaurar `verification/last-deploy-verify.json` o migrar todos los consumidores a una fuente nueva canonica. Verificable: no quedan docs, runbooks ni scripts apuntando a un artefacto inexistente.

- [-] **S49-03** `[M]` `[codex_transversal]` Freshness SLA de evidencias de release — cada artefacto de readiness debe exponer `generatedAt`, `source`, `stale=true|false` y umbral de frescura. Verificable: launch docs y gates no consumen evidencia vieja sin marcarla como stale.

- [-] **S49-04** `[S]` `[codex_transversal]` Gate anti-contradiccion de launch — si `PRODUCT_OPERATIONAL_STATUS` esta `RED` o la evidencia esta stale, el checklist de lanzamiento no puede mostrarse como `10/10 listo`. Verificable: un check automatico falla cuando aparece esa contradiccion.

### 49.2 Gates reales de release, no fachada

- [-] **S49-05** `[L]` `[codex_transversal]` Release subchecks con JSON util — `focus check`, `jobs verify public_main_sync` y `runtime verify pilot_runtime` deben devolver payloads especificos de release, no el mismo resumen de backlog. Verificable: cada comando devuelve `signal`, `reason`, `blocking_checks`, `source` y evidencia propia.

- [-] **S49-06** `[M]` `[codex_transversal]` `agent:gate:release` con bloqueos funcionales reales — endurecer el gate para que falle por bloqueos de release verdaderos y no pase por contratos huecos. Verificable: el gate distingue claramente `repo green / runtime red / external blocker`.

- [-] **S49-07** `[M]` `[codex_transversal]` Clasificacion formal de bloqueos externos — Sentry secrets, host sync remoto o workflow caido deben quedar como `external_blocker`, no como deuda local ambigua. Verificable: el summary de release separa "arreglar en repo" de "bloqueo externo".

- [-] **S49-08** `[M]` `[codex_transversal]` Alert registry -> launch blockers — traducir las `[ALERTA PROD]` abiertas en un resumen canonico de bloqueo para launch con owner, workflow afectado y criterio de salida. Verificable: ya no hay que leer issues una por una para saber por que launch sigue en rojo.

### 49.3 Smokes funcionales reproducibles

- [-] **S49-09** `[M]` `[codex_transversal]` Harness canonico para `sprint36-smoke` — `tests-node/sprint36-smoke.test.js` debe levantar o reutilizar servidor local automaticamente y fallar con mensaje accionable si no hay runtime. Verificable: deja de fallar por `ECONNREFUSED 127.0.0.1:8000`.

- [-] **S49-10** `[M]` `[codex_transversal]` Revalidacion honesta de `S36-11` — la tarea marcada `[x]` debe tener evidencia reproducible con el harness nuevo o reabrirse. Verificable: `node --test tests-node/sprint36-smoke.test.js` pasa de forma canonica o la tarea vuelve a `[ ]/[~]`.

- [-] **S49-11** `[M]` `[codex_transversal]` Restaurar el gate publico V4 — crear o repuntar el runner esperado por `tests-node/public-v4-rollout-gate.test.js`. Verificable: existe `bin/run-public-v4-rollout-gate.js` o el test apunta al script canonico real, y la suite vuelve a pasar.

- [-] **S49-12** `[S]` `[codex_transversal]` Pack de smokes minimos de lanzamiento — comando unico para `home`, `portal`, `telemedicina`, `health`, `monitoring-config`, pricing/checkout critico y rollout gate publico. Verificable: existe un smoke de launch reproducible y corto.

### 49.4 Bloqueos funcionales especificos de runtime

- [-] **S49-13** `[M]` `[codex_backend_ops]` Operator auth diagnostic canonico — restaurar o reemplazar `bin/admin-openclaw-rollout-diagnostic.js`, que hoy el readiness summary declara como faltante. Verificable: el resumen deja de reportar "No existe ... diagnostic.js".

- [-] **S49-14** `[M]` `[codex_backend_ops]` Calendar reachability launch contract — alinear `health`, `calendar-write-smoke`, `prod-monitor` y readiness summary para que `calendarReachable` tenga una sola verdad. Verificable: si calendar falla, todos los reportes coinciden en la causa; si pasa, todos la reflejan en verde.

- [-] **S49-15** `[M]` `[codex_backend_ops]` Public sync truth contract — `jobs verify public_main_sync`, `health` y `prod-monitor` deben compartir el mismo modelo de estados (`healthy`, `stale`, `health_http_502`, `telemetry_gap`, `registry_only`). Verificable: el mismo incidente no aparece con razones distintas segun el comando.

- [-] **S49-16** `[M]` `[codex_backend_ops]` Turnero pilot remote mismatch evidence — formalizar el payload de `turneroPilot` para launch: `clinicId`, `profileFingerprint`, `catalogReady`, `remoteVerified`, `deployedCommit`, `recoveryTargets`. Verificable: cuando haya mismatch, el reporte explica exactamente que difiere.

- [-] **S49-17** `[S]` `[codex_transversal]` Weekly KPI source truth para readiness — evitar que `prod-readiness-summary` use artefactos temporales o de pruebas (`.tmp_bom_test`) como evidencia operativa. Verificable: el reporte declara fuente remota/canonica o fallback explicito, nunca un temp de test sin etiquetarlo.

### 49.5 Verificacion launch-critical

- [-] **S49-18** `[L]` `[codex_transversal]` Reglas de verify para tareas criticas de lanzamiento — cubrir al menos las tareas hoy marcadas done sin evidencia en el frente launch: `S36-00`, `S36-02`, `S36-06`, `S36-10`, `S36-11`, `S37-07`, `S37-10`, `S38-09`, `DEBT-04`, `OPS-02`, `S35-04`, `S35-08`, `S35-09`. Verificable: esos IDs salen de `done-without-evidence`.

- [-] **S49-19** `[M]` `[codex_transversal]` Reglas de verify para done recientes que ya afectan launch — anadir reglas a `Q43-*`, `S42-*`, `S44-*` y `UX-*` que hoy estan en `done-without-rule` pero tocan portal, docs, payments o release. Verificable: la categoria `done-without-rule` baja de forma material en superficies launch-critical.

- [-] **S49-20** `[S]` `[codex_transversal]` Badge de `launch evidence complete` — agregar una senal simple para saber si una tarea launch-critical tiene `rule + evidence + runner canonico`, no solo `[x]`. Verificable: el board distingue trabajo escrito de trabajo realmente verificable.

## Nota operativa

> **No solapar con Sprint 45/46/47/48:** `S49-*` se concentra en funcionalidad de lanzamiento y verdad del release. No reabre hygiene local, revenue ni fleet ops salvo donde afecten directamente el launch.
