# Aurora Derm — Tareas activas

> Filosofía: cada ticket es una cosa. Una pantalla, un endpoint, un comportamiento.
> Sin subtareas de coordinación. Sin docs de handoff. Sin claims.
> Se hace, se commitea, se cierra.

---

## Bloque 0 — Infraestructura backend (prereqs)

- [ ] **B-01** `index.php` responde el contrato JSON del README (`ok`, `service`, `mode`, `health`, `api`)
- [ ] **B-02** `npm run test:routes` pasa sin errores — todos los endpoints de `routes.php` resuelven su controller
- [ ] **B-03** `tests-node/backend-only-smoke.test.js` existe y prueba: `health`, `queue-state`, `figo-config`, `operator-auth-status`
- [ ] **B-04** `.htaccess` — rutas UI heredadas (`/es/*`, `/admin.html`, `sw.js`, `manifest.json`) responden `410 Gone`
- [ ] **B-05** `lib/ratelimit.php` integrado en `api.php` — máx 120 req/min por IP en endpoints públicos
- [ ] **B-06** Headers de seguridad en todas las respuestas: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
- [ ] **B-07** `env.example.php` actualizado — lista todas las variables requeridas con descripción de cada una
- [ ] **B-08** `cron.php` revisado — verificar que todos los jobs siguen siendo válidos post-limpieza
- [ ] **B-09** `composer.json` — auditar dependencias, eliminar las que ya no se usan (`composer why <pkg>`)

---

## Bloque 1 — Sistema de turnos (UI nueva)

El backend está completo. Tres pantallas, una por archivo.

- [ ] **T-01** `kiosco.html` — Kiosco de llegada del paciente
      _API_: `POST queue-checkin` → `POST queue-ticket`
      _UX_: toca pantalla → ingresa documento → recibe número de turno + tiempo estimado
      _Regla_: 1 HTML, 1 JS (`js/kiosco.js`), funciona en tablet táctil

- [ ] **T-02** `sala.html` — Pantalla de sala de espera (TV horizontal)
      _API_: `GET queue-state` polling cada 5s
      _UX_: muestra turnos llamados + en espera, el número en pantalla grande
      _Regla_: funciona sin interacción, se recupera sola si el servidor cae

- [ ] **T-03** `operador.html` — Consola de recepción
      _API_: `POST queue-call-next`, `PATCH queue-ticket`, `POST queue-reprint`, `POST queue-help-request`
      _Auth_: PIN de operador via `admin-auth.php`
      _UX_: botón grande "Llamar siguiente", lista de espera, manejo de urgencias

- [ ] **T-04** Notificación WhatsApp al paciente cuando es llamado a consulta
      _API_: `lib/WhatsAppService.php` ya existe — integrar con `queue-call-next`
      _Mensaje_: "Tu turno #X ha sido llamado. Dirígete al consultorio."

- [ ] **T-05** Impresión del ticket en el kiosco
      _Lib_: `lib/TicketPrinter.php` ya existe
      _Integrar_: al crear ticket en T-01, disparar impresión automática

- [ ] **T-06** `GET queue-public-ticket` — QR en el ticket con link al estado del turno
      _UX_: el paciente escanea el QR y ve su turno en tiempo real en su celular (sin login)

- [ ] **T-07** Estadísticas del día en consola del operador
      _API_: `GET queue-state` — mostrar: atendidos, en espera, tiempo promedio
      _Depende de_: T-03

---

## Bloque 2 — Dashboard médico (UI nueva)

- [ ] **A-01** `admin.html` — Shell del dashboard: navegación lateral, área de contenido principal
      _Regla_: HTML + CSS + JS vanilla, sin build step, sin frameworks

- [ ] **A-02** Panel de citas del día en admin
      _API_: `GET appointments` (filtrado por fecha=hoy + status=scheduled)
      _UX_: lista de pacientes del día, click → abre historia clínica

- [ ] **A-03** Buscador de pacientes en admin
      _API_: `GET patient-search?q=`
      _UX_: campo de búsqueda con debounce 300ms, resultados en dropdown

- [ ] **A-04** Historia clínica (HCE) en admin
      _API_: `GET clinical-history-session`, `GET clinical-record`, `GET clinical-evolution`
      _UX_: timeline de consultas del paciente, acordeón por episodio

- [ ] **A-05** OpenClaw copiloto en admin
      _API_: `POST openclaw-chat`, `GET openclaw-patient`, `GET openclaw-cie10-suggest`
      _UX_: panel lateral con chat, muestra sugerencias de CIE-10 mientras escribe el diagnóstico

- [ ] **A-06** Crear / editar receta médica en admin
      _API_: `POST openclaw-prescription`, `GET openclaw-interactions`
      _UX_: formulario de medicamentos con check automático de interacciones

- [ ] **A-07** Generar certificado médico en admin
      _API_: `POST openclaw-certificate`, `GET openclaw-certificate` (PDF)
      _UX_: formulario + preview del PDF inline

- [ ] **A-08** Evolución clínica — registrar nota SOAP en admin
      _API_: `POST clinical-evolution`, `POST openclaw-save-evolution`
      _UX_: 4 campos (S, O, A, P), guardado automático cada 30s

- [ ] **A-09** Gestión de disponibilidad en admin
      _API_: `GET availability`, `POST availability`
      _UX_: grilla semanal, click para bloquear/liberar horarios

- [ ] **A-10** Panel de callbacks y leads en admin
      _API_: `GET callbacks`, `GET lead-ai-queue`
      _UX_: lista de pacientes que pidieron que los llamen, marcar como contactado

- [ ] **A-11** Gestión de telemedicina en admin
      _API_: `GET telemedicine-intakes`, `PATCH telemedicine-intakes`
      _UX_: lista de intakes pendientes, aprobar/rechazar

- [ ] **A-12** Upload de fotos clínicas en HCE
      _API_: `POST clinical-media-upload`, `GET media-flow-queue`
      _UX_: drag & drop, preview antes de subir, tag del área anatómica

---

## Bloque 3 — Portal del paciente (UI nueva)

- [ ] **P-01** `portal/login.html` — Login por código enviado al email
      _API_: `POST patient-portal-auth-start` → `POST patient-portal-auth-complete`
      _UX_: ingresa email → recibe código 6 dígitos → ingresa código → entra

- [ ] **P-02** `portal/inicio.html` — Dashboard del paciente
      _API_: `GET patient-portal-dashboard`
      _Muestra_: próxima cita, último diagnóstico, documentos pendientes, saldo

- [ ] **P-03** `portal/historia.html` — Historia clínica del paciente
      _API_: `GET patient-portal-history`, `GET patient-portal-history-pdf`
      _UX_: timeline de consultas, botón descargar PDF

- [ ] **P-04** `portal/pagos.html` — Historial y estado de pagos
      _API_: `GET patient-portal-payments`
      _UX_: lista de facturas, badge de estado (pagado / pendiente), descargar comprobante

- [ ] **P-05** `portal/receta.html` — Ver y descargar receta
      _API_: `GET patient-portal-prescription`
      _UX_: receta en pantalla, botón descargar PDF, QR de verificación

- [ ] **P-06** `portal/plan.html` — Plan de tratamiento activo
      _API_: `GET patient-portal-plan`
      _UX_: progreso del plan, próximas sesiones, indicaciones

- [ ] **P-07** `portal/consentimiento.html` — Leer y firmar consentimiento
      _API_: `GET patient-portal-consent`, `POST patient-portal-consent`
      _UX_: documento legible, firma con checkbox + nombre, genera PDF

- [ ] **P-08** `portal/fotos.html` — Fotos del tratamiento (antes/después)
      _API_: `GET patient-portal-photos`, `POST patient-portal-photo-upload`
      _UX_: galería por episodio, subir foto desde celular

- [ ] **P-09** Agendar / reagendar cita desde el portal
      _API_: `GET availability`, `POST appointments`, `GET reschedule`, `PATCH reschedule`
      _UX_: calendario de disponibilidad, selecciona hora, confirma

- [ ] **P-10** Configuración de push notifications en el portal
      _API_: `GET push-preferences`, `POST push-preferences`
      _UX_: toggles: recordatorio de cita, turno llamado, receta lista

- [ ] **P-11** Ver resumen del paciente (hoja de perfil)
      _API_: `GET patient-summary`
      _UX_: datos personales, alergias, condiciones crónicas, medicación actual

---

## Bloque 4 — Sitio público

- [ ] **W-01** Decidir stack del sitio público — HTML puro o Astro
      _Criterio_: si el sitio cambia contenido frecuentemente → Astro; si es estático → HTML puro

- [ ] **W-02** `index.html` (o Astro) — Landing principal
      _Contenido_: servicios, quiénes somos, booking CTA, contacto WhatsApp

- [ ] **W-03** Página de servicios — una por especialidad (acné, cancer de piel, laser, etc.)
      _SEO_: cada servicio tiene su URL y título único

- [ ] **W-04** Formulario de booking público
      _API_: `GET services-catalog`, `GET availability`, `POST appointments`
      _UX_: selecciona servicio → fecha → hora → confirma con email

- [ ] **W-05** Página de precios y membresías
      _Contenido_: tabla de servicios con precios, planes, CTA booking

- [ ] **W-06** Blog / artículos de salud dermatológica
      _Fuente_: `GET content` (ya existe en el API)
      _SEO_: cada artículo tiene su URL, meta description, structured data

- [ ] **W-07** Telemedicina — landing pública
      _Contenido_: cómo funciona, requerimientos técnicos, CTA agendar teleconsulta

- [ ] **W-08** Página legal — términos y política de privacidad
      _Requerimiento_: enlace en footer, actualizable sin deploy

---

## Bloque 5 — Notificaciones y comunicaciones

- [ ] **N-01** Email de confirmación al agendar cita
      _Lib_: `lib/email.php` ya existe
      _Trigger_: `POST appointments` exitoso → enviar email al paciente

- [ ] **N-02** Recordatorio de cita 24h antes por email
      _Trigger_: `cron.php` — buscar citas de mañana y enviar email

- [ ] **N-03** WhatsApp de confirmación al agendar
      _Lib_: `lib/WhatsAppService.php` ya existe
      _Mensaje_: "Tu cita para [servicio] está confirmada para [fecha] a las [hora]."

- [ ] **N-04** WhatsApp de recordatorio 2h antes de la cita
      _Trigger_: `cron.php` + WhatsApp

- [ ] **N-05** Push notification cuando la receta está lista
      _Lib_: `lib/PushService.php` ya existe
      _Trigger_: `POST openclaw-prescription` exitoso → push al paciente

- [ ] **N-06** Push notification cuando el consentimiento está pendiente de firma
      _Trigger_: doctor solicita consentimiento → push al paciente

---

## Bloque 6 — Pagos y checkout

- [ ] **C-01** Checkout con Stripe desde el booking público
      _API_: `POST payment-intent`, `POST checkout-confirm`
      _UX_: formulario Card Element de Stripe, sin redirecciones

- [ ] **C-02** Pago con transferencia bancaria
      _API_: `POST transfer-proof` (upload de comprobante)
      _UX_: sube foto del comprobante → queda en revisión

- [ ] **C-03** Webhook de Stripe en producción
      _API_: `POST stripe-webhook` — verificar firma, actualizar estado del pago en DB

- [ ] **C-04** Comprobante de pago descargable (PDF)
      _API_: desde `patient-portal-payments` → generar PDF del pago
      _Depende de_: P-04

---

## Bloque 7 — Testing y calidad

- [ ] **Q-01** `tests/Unit/RoutesIntegrityTest.php` — verifica que todos los controllers de `routes.php` existen en disco
- [ ] **Q-02** `tests/Unit/ApiContractTest.php` — verifica que `GET /` retorna el contrato JSON correcto
- [ ] **Q-03** `tests/Integration/QueueFlowTest.php` — flujo completo: checkin → ticket → call-next → close
- [ ] **Q-04** `tests/Integration/PatientPortalAuthTest.php` — flujo: auth-start → auth-complete → protected endpoint
- [ ] **Q-05** `tests/Integration/OpenclawChatTest.php` — `POST openclaw-chat` con mock de figo engine
- [ ] **Q-06** `tests/Integration/PaymentWebhookTest.php` — simula webhook de Stripe, verifica actualización de estado
- [ ] **Q-07** `npm run prune` en CI — el workflow de GitHub Actions falla si prune detecta archivos muertos
- [ ] **Q-08** `npm run test:routes` en CI — el workflow falla si un controller referenciado no existe en disco

---

## Bloque 8 — DevOps y deploy

- [ ] **D-01** `.github/workflows/ci.yml` limpio — solo: lint-php + test:routes + test:php
- [ ] **D-02** `.github/workflows/deploy.yml` — deploy a producción (cPanel/rsync) solo desde `main`
- [ ] **D-03** `ops/backup.sh` — verificar que el backup diario funciona post-limpieza
- [ ] **D-04** `Dockerfile` revisado — imagen PHP 8.x mínima, sin assets de frontend
- [ ] **D-05** `ops/nginx.conf` — configurar para servir `kiosco.html`, `sala.html`, `operador.html` correctamente

---

## Reglas

1. **Un commit por ticket** — `feat(T-01): kiosco checkin UI`
2. **`npm run prune` antes de pushear** — si detecta algo, bórralo primero
3. **`npm run test:routes` después de tocar `routes.php`**
4. **Sin TODOs en el código** — si algo no está listo no entra
5. **Sin crear archivos nuevos de documentación** — todo va aquí o en el README

---

## Cómo marcar una tarea

Cambia `[ ]` por `[x]` y pushea.
