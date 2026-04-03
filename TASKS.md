# Aurora Derm — Tareas activas

> Filosofía: cada ticket es una cosa. Una pantalla, un endpoint, un comportamiento.
> Se hace, se commitea, se cierra.

## División de trabajo

| Agente | Responsabilidad |
|---|---|
| **[Gemini]** | UI — HTML, CSS, JS vanilla. Pantallas, interacciones, diseño |
| **[Codex]** | Backend — PHP, controladores, servicios, tests, rutas, base de datos |

---

## Bloque 0 — Infraestructura backend

- [ ] **B-01** `[Codex]` `index.php` responde el contrato JSON: `ok`, `service`, `mode`, `health`, `api`
- [ ] **B-02** `[Codex]` `npm run test:routes` pasa en CI sin errores
- [ ] **B-03** `[Codex]` `tests-node/backend-only-smoke.test.js` verifica: health, queue-state, figo-config, auth-status
- [ ] **B-04** `[Codex]` `.htaccess` — rutas UI heredadas (`/es/*`, `/admin.html`, `sw.js`) responden `410 Gone`
- [ ] **B-05** `[Codex]` `lib/ratelimit.php` activo en `api.php` — máx 120 req/min por IP en endpoints públicos
- [ ] **B-06** `[Codex]` Headers de seguridad en todas las respuestas: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`
- [ ] **B-07** `[Codex]` `env.example.php` — lista todas las variables requeridas con descripción
- [ ] **B-08** `[Codex]` `cron.php` revisado — verificar que todos los jobs son válidos post-limpieza
- [ ] **B-09** `[Codex]` `composer.json` — auditar dependencias, eliminar las que ya no se usan

---

## Bloque 1 — Sistema de turnos

- [ ] **T-01** `[Gemini]` `kiosco.html` + `js/kiosco.js` — Pantalla de llegada del paciente
      _API_: `POST queue-checkin` → `POST queue-ticket`
      _UX_: toca pantalla → ingresa documento → ve número + tiempo estimado

- [ ] **T-02** `[Gemini]` `sala.html` + `js/sala.js` — Pantalla de sala de espera (TV)
      _API_: `GET queue-state` polling 5s
      _UX_: número llamado en grande, lista de espera, se recupera sola si el server cae

- [ ] **T-03** `[Gemini]` `operador.html` + `js/operador.js` — Consola de recepción
      _API_: `POST queue-call-next`, `PATCH queue-ticket`, `POST queue-reprint`
      _Auth_: PIN via `admin-auth.php`
      _UX_: botón grande "Llamar siguiente", lista de espera, urgencias

- [ ] **T-04** `[Codex]` WhatsApp al paciente cuando es llamado a consulta
      _Lib_: `lib/WhatsAppService.php` — integrar en `QueueController::callNext()`
      _Mensaje_: "Tu turno #X ha sido llamado. Dirígete al consultorio."

- [ ] **T-05** `[Codex]` Impresión automática del ticket al hacer checkin
      _Lib_: `lib/TicketPrinter.php` — disparar en `QueueController::ticket()`

- [ ] **T-06** `[Gemini]` QR en el ticket — página pública que muestra estado del turno en celular
      _API_: `GET queue-public-ticket?id=`
      _UX_: página sin login, muestra "Tu turno: #X — Estado: En espera"

- [ ] **T-07** `[Gemini]` Estadísticas del día visibles en la consola del operador
      _API_: `GET queue-state` — atendidos, en espera, tiempo promedio
      _Depende de_: T-03

---

## Bloque 2 — Dashboard médico

- [ ] **A-01** `[Gemini]` `admin.html` — Shell del dashboard médico
      _Estructura_: nav lateral + área principal + barra de estado
      _Regla_: HTML + CSS + JS vanilla, sin build step

- [ ] **A-02** `[Gemini]` Panel de citas del día
      _API_: `GET appointments?fecha=hoy&status=scheduled`
      _UX_: lista de pacientes, click → abre HCE
      _Depende de_: A-01

- [ ] **A-03** `[Gemini]` Buscador de pacientes
      _API_: `GET patient-search?q=`
      _UX_: debounce 300ms, dropdown de resultados
      _Depende de_: A-01

- [ ] **A-04** `[Gemini]` Vista de historia clínica (HCE)
      _API_: `GET clinical-history-session`, `GET clinical-record`, `GET clinical-evolution`
      _UX_: timeline por episodio, acordeón
      _Depende de_: A-01

- [ ] **A-05** `[Gemini]` OpenClaw copiloto clínico
      _API_: `POST openclaw-chat`, `GET openclaw-patient`, `GET openclaw-cie10-suggest`
      _UX_: panel lateral con chat, sugerencias CIE-10 mientras escribe
      _Depende de_: A-01

- [ ] **A-06** `[Gemini]` Crear / editar receta en admin
      _API_: `POST openclaw-prescription`, `GET openclaw-interactions`
      _UX_: formulario + check automático de interacciones
      _Depende de_: A-01

- [ ] **A-07** `[Gemini]` Generar certificado médico
      _API_: `POST openclaw-certificate`, `GET openclaw-certificate`
      _UX_: formulario + preview del PDF inline
      _Depende de_: A-01

- [ ] **A-08** `[Gemini]` Nota SOAP — evolución clínica
      _API_: `POST clinical-evolution`, `POST openclaw-save-evolution`
      _UX_: 4 campos (S, O, A, P), guardado automático cada 30s
      _Depende de_: A-04

- [ ] **A-09** `[Gemini]` Gestión de disponibilidad
      _API_: `GET availability`, `POST availability`
      _UX_: grilla semanal, click para bloquear/liberar

- [ ] **A-10** `[Gemini]` Panel de callbacks y leads
      _API_: `GET callbacks`, `GET lead-ai-queue`
      _UX_: lista, marcar como contactado

- [ ] **A-11** `[Gemini]` Panel de telemedicina
      _API_: `GET telemedicine-intakes`, `PATCH telemedicine-intakes`
      _UX_: lista de intakes, aprobar/rechazar

- [ ] **A-12** `[Gemini]` Upload de fotos clínicas en HCE
      _API_: `POST clinical-media-upload`
      _UX_: drag & drop, preview, tag de área anatómica
      _Depende de_: A-04

---

## Bloque 3 — Portal del paciente

- [ ] **P-01** `[Gemini]` `portal/login.html` — Login por código de email
      _API_: `POST patient-portal-auth-start` → `POST patient-portal-auth-complete`

- [ ] **P-02** `[Gemini]` `portal/inicio.html` — Dashboard del paciente
      _API_: `GET patient-portal-dashboard`
      _Muestra_: próxima cita, último diagnóstico, documentos pendientes

- [ ] **P-03** `[Gemini]` `portal/historia.html` — Historia clínica
      _API_: `GET patient-portal-history`, `GET patient-portal-history-pdf`

- [ ] **P-04** `[Gemini]` `portal/pagos.html` — Historial de pagos
      _API_: `GET patient-portal-payments`

- [ ] **P-05** `[Gemini]` `portal/receta.html` — Ver y descargar receta
      _API_: `GET patient-portal-prescription`

- [ ] **P-06** `[Gemini]` `portal/plan.html` — Plan de tratamiento
      _API_: `GET patient-portal-plan`

- [ ] **P-07** `[Gemini]` `portal/consentimiento.html` — Leer y firmar consentimiento
      _API_: `GET patient-portal-consent`, `POST patient-portal-consent`

- [ ] **P-08** `[Gemini]` `portal/fotos.html` — Galería de fotos antes/después
      _API_: `GET patient-portal-photos`, `POST patient-portal-photo-upload`

- [ ] **P-09** `[Gemini]` Agendar / reagendar desde el portal
      _API_: `GET availability`, `POST appointments`, `PATCH reschedule`

- [ ] **P-10** `[Gemini]` Config de notificaciones push
      _API_: `GET push-preferences`, `POST push-preferences`

- [ ] **P-11** `[Gemini]` Resumen del perfil del paciente
      _API_: `GET patient-summary`

---

## Bloque 4 — Sitio público

> Stack decidido: **HTML/JS vanilla** — sin Astro, sin build step.

- [ ] **W-01** `[Gemini]` `index.html` — Landing principal
      _Contenido_: servicios, quiénes somos, booking CTA, WhatsApp

- [ ] **W-02** `[Gemini]` Páginas de servicios (una por especialidad)
      _SEO_: URL y título único por servicio

- [ ] **W-03** `[Gemini]` Formulario de booking público
      _API_: `GET services-catalog`, `GET availability`, `POST appointments`

- [ ] **W-04** `[Gemini]` Página de precios
      _Contenido_: tabla de servicios con precios, CTA booking

- [ ] **W-05** `[Gemini]` Blog — lista y artículo individual
      _API_: `GET content`

- [ ] **W-06** `[Gemini]` Landing de telemedicina
      _Contenido_: cómo funciona, requisitos, CTA agendar teleconsulta

- [ ] **W-07** `[Gemini]` Página legal — términos y política de privacidad

---

## Bloque 5 — Notificaciones

- [ ] **N-01** `[Codex]` Email de confirmación al agendar cita
      _Trigger_: `POST appointments` exitoso → `lib/email.php`

- [ ] **N-02** `[Codex]` Recordatorio por email 24h antes
      _Trigger_: `cron.php` — citas del día siguiente

- [ ] **N-03** `[Codex]` WhatsApp de confirmación de cita
      _Trigger_: `POST appointments` exitoso → `lib/WhatsAppService.php`

- [ ] **N-04** `[Codex]` WhatsApp de recordatorio 2h antes
      _Trigger_: `cron.php` + WhatsApp

- [ ] **N-05** `[Codex]` Push cuando la receta está lista
      _Trigger_: `POST openclaw-prescription` → `lib/PushService.php`

- [ ] **N-06** `[Codex]` Push cuando hay consentimiento pendiente de firma
      _Trigger_: doctor solicita consentimiento → push al paciente

---

## Bloque 6 — Pagos y checkout

- [ ] **C-01** `[Gemini]` UI de checkout con Stripe
      _API_: `POST payment-intent`, `POST checkout-confirm`
      _UX_: formulario Card Element, sin redirecciones

- [ ] **C-02** `[Gemini]` UI de pago por transferencia
      _API_: `POST transfer-proof`
      _UX_: sube foto del comprobante

- [ ] **C-03** `[Codex]` Webhook de Stripe en producción
      _API_: `POST stripe-webhook` — verificar firma, actualizar estado en DB

- [ ] **C-04** `[Gemini]` Comprobante de pago descargable (PDF inline)
      _API_: desde `patient-portal-payments`

---

## Bloque 7 — Testing

- [ ] **Q-01** `[Codex]` `tests/Unit/RoutesIntegrityTest.php` — todos los controllers de `routes.php` existen en disco
- [ ] **Q-02** `[Codex]` `tests/Unit/ApiContractTest.php` — `GET /` retorna el contrato JSON
- [ ] **Q-03** `[Codex]` `tests/Integration/QueueFlowTest.php` — checkin → ticket → call-next → close
- [ ] **Q-04** `[Codex]` `tests/Integration/PatientPortalAuthTest.php` — auth-start → auth-complete → endpoint protegido
- [ ] **Q-05** `[Codex]` `tests/Integration/OpenclawChatTest.php` — POST openclaw-chat con mock figo
- [ ] **Q-06** `[Codex]` `tests/Integration/PaymentWebhookTest.php` — simula webhook Stripe
- [ ] **Q-07** `[Codex]` CI: `npm run prune` falla el build si detecta archivos muertos
- [ ] **Q-08** `[Codex]` CI: `npm run test:routes` falla si un controller referenciado no existe

---

## Bloque 8 — DevOps

- [ ] **D-01** `[Codex]` `.github/workflows/ci.yml` limpio — lint-php + test:routes + test:php
- [ ] **D-02** `[Codex]` `.github/workflows/deploy.yml` — deploy a producción solo desde `main`
- [ ] **D-03** `[Codex]` `ops/backup.sh` — verificar que funciona post-limpieza
- [ ] **D-04** `[Codex]` `Dockerfile` — imagen PHP 8.x mínima, sin assets de frontend
- [ ] **D-05** `[Codex]` `ops/nginx.conf` — servir `kiosco.html`, `sala.html`, `operador.html`

---

## Reglas

1. **Un commit por ticket** — `feat(T-01): kiosco checkin UI`
2. **`[Gemini]` toma la UI** — HTML, CSS, JS de cada pantalla
3. **`[Codex]` toma el backend** — PHP, controllers, services, tests, CI
4. **`npm run prune` antes de pushear** — si detecta algo, bórralo primero
5. **`npm run test:routes` después de tocar `routes.php`**
6. **Sin TODO en el código** — si no está listo, no entra

---

## Cómo marcar una tarea

Cambia `[ ]` por `[x]` y pushea.
