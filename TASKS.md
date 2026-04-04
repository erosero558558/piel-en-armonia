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

## Bloque 9 — Portal: servicios PHP internos

> El `PatientPortalController.php` ya existe. Estos tickets crean los servicios que necesita.

- [ ] **S-01** `[Codex]` `lib/portal/PortalBillingService.php` — lista de pagos del paciente con estado (pagado/pendiente)
      _Persistencia_: lee de la tabla de pagos/órdenes. Retorna array normalizado por fecha DESC
- [ ] **S-02** `[Codex]` `lib/portal/PortalHistoryService.php` — historial clínico del paciente para el portal
      _Retorna_: episodios con documentos adjuntos, fotos, diagnósticos — ordenado por fecha DESC
- [ ] **S-03** `[Codex]` `lib/portal/PortalTreatmentPlanService.php` — plan de tratamiento activo del paciente
      _Retorna_: plan vigente, sesiones completadas, próximas sesiones, indicaciones
- [ ] **S-04** `[Codex]` `lib/DocumentVerificationService.php` restaurado — verificar documentos por token QR
      _Endpoint_: `GET document-verify?token=` — retorna `{ ok, document, issuedAt, patient }`
- [ ] **S-05** `[Codex]` `lib/portal/PortalConsentService.php` — obtener y registrar firma de consentimiento
      _Flujo_: `GET patient-portal-consent` devuelve PDF+estado; `POST` guarda firma + timestamp + IP
- [ ] **S-06** `[Codex]` `lib/portal/PortalPhotoService.php` — fotos clínicas visibles al paciente
      _Lógica_: filtra por `isPortalVisiblePhoto()`, agrupa por `bodyZone`, retorna URLs firmadas
- [ ] **S-07** `[Codex]` `lib/portal/PortalSummaryService.php` — perfil del paciente: alergias, condiciones crónicas, medicación
      _Endpoint_: `GET patient-summary` — fuente: `ClinicalHistoryService` + datos personales

---

## Bloque 10 — Historia clínica: flujo completo

- [ ] **HC-01** `[Codex]` Endpoint `GET clinical-anamnesis?patientId=` — retorna anamnesis estructurada del paciente
- [ ] **HC-02** `[Codex]` `POST clinical-anamnesis` — guardar/actualizar anamnesis (alergias, antecedentes, medicamentos)
- [ ] **HC-03** `[Codex]` `GET clinical-evolution?caseId=` — lista de notas SOAP del caso, ordenadas por fecha
- [ ] **HC-04** `[Codex]` Lógica de versioning en evoluciones — cada PATCH guarda versión anterior, nunca overwrite
- [ ] **HC-05** `[Codex]` `GET care-plan-pdf?caseId=` — genera PDF del plan de tratamiento del episodio
- [ ] **HC-06** `[Gemini]` UI de anamnesis en admin — formulario de alergias, antecedentes, medicamentos
      _API_: `GET clinical-anamnesis`, `POST clinical-anamnesis`
      _UX_: campos agrupados: medicamentos / alergias / antecedentes familiares / condiciones crónicas
- [ ] **HC-07** `[Gemini]` Timeline de evoluciones en HCE — vista cronológica de notas SOAP
      _API_: `GET clinical-evolution`
      _UX_: cada nota muestra S/O/A/P colapsables, fecha, médico firmante
- [ ] **HC-08** `[Gemini]` Panel de diagnóstico en HCE — CIE-10 principal + secundarios del episodio
      _API_: `GET clinical-history-review`, `GET openclaw-cie10-suggest`
      _UX_: input con autocomplete de CIE-10, chips para diagnósticos seleccionados

---

## Bloque 11 — OpenClaw: flujo clínico completo

- [ ] **OC-01** `[Codex]` `POST openclaw-save-chronic` — guardar condición crónica detectada en sesión
      _Integración_: `OpenclawMedicalRecordsController::saveChronicCondition()` ya existe en routes
- [ ] **OC-02** `[Codex]` `POST openclaw-fast-close` — cerrar sesión rápida sin resumen completo
      _Caso de uso_: consulta express, solo diagnóstico + recetar sin evolución detallada
- [ ] **OC-03** `[Codex]` `POST openclaw-close-telemedicine` — cerrar sesión telemedicina + generar PDF de resumen
- [ ] **OC-04** `[Codex]` `GET openclaw-next-patient` — retorna el próximo paciente en la cola del médico hoy
      _Lógica_: primer turno con estado `waiting` + cita programada para hoy
- [ ] **OC-05** `[Gemini]` UI "Próximo paciente" en admin — card con nombre, servicio, tiempo de espera
      _API_: `GET openclaw-next-patient`
      _UX_: botón "Llamar" que dispara `POST queue-call-next` directamente
- [ ] **OC-06** `[Gemini]` UI de verificación de interacciones en receta
      _API_: `POST openclaw-interactions`
      _UX_: lista de medicamentos con badge de alerta si hay interacción moderada/severa
- [ ] **OC-07** `[Gemini]` Historial de recetas del paciente en admin HCE
      _API_: `GET openclaw-prescription?patientId=`
      _UX_: lista de recetas por fecha, botón ver PDF + botón clonar receta

---

## Bloque 12 — Fotos clínicas: flujo completo

- [ ] **F-01** `[Codex]` `POST clinical-media-upload` — validar mime (jpg/png/heic/webp), max 10MB, guardar en `data/clinical-media/`
- [ ] **F-02** `[Codex]` `GET media-flow-queue` — retorna uploads pendientes de revisión por el médico
- [ ] **F-03** `[Codex]` `POST media-flow-proposal-generate` — generar propuesta de publicación (seleccionar fotos para before/after)
- [ ] **F-04** `[Codex]` `POST media-flow-publication-state` — aprobar/rechazar publicación pública de foto de caso
- [ ] **F-05** `[Codex]` `GET media-flow-private-asset?id=` — servir archivo binario de foto clínica con auth
- [ ] **F-06** `[Gemini]` UI de galería médica en HCE — fotos clínicas por episodio, agrupadas por zona corporal
      _API_: `GET clinical-history-gallery`
      _UX_: grid de thumbnails, click → lightbox, etiqueta de zona y fecha
- [ ] **F-07** `[Gemini]` UI de bandeja de revisión de fotos en admin
      _API_: `GET media-flow-queue`, `POST media-flow-proposal-review`
      _UX_: lista de uploads pendientes, aprobar/rechazar visibilidad al paciente

---

## Bloque 13 — Telemedicina

- [ ] **TM-01** `[Codex]` `GET telemedicine-intakes` — lista de intakes pendientes de aprobación
- [ ] **TM-02** `[Codex]` `PATCH telemedicine-intakes` — aprobar/rechazar intake, generar link de sala
- [ ] **TM-03** `[Codex]` `GET telemedicine-ops-diagnostics` — estado operativo del servicio de telemedicina
- [ ] **TM-04** `[Codex]` `GET telemedicine-rollout-readiness` — verifica que el clínico tiene cámara/mic configurados
- [ ] **TM-05** `[Gemini]` UI de sala de espera virtual para el paciente
      _API_: `GET queue-public-ticket?id=` (modo telemedicina)
      _UX_: contador de espera, botón "Unirse a la consulta" cuando es el turno
- [ ] **TM-06** `[Gemini]` UI de sala de teleconsulta para el médico en admin
      _API_: `PATCH telemedicine-intakes` + video embed
      _UX_: video del paciente + panel lateral con HCE + OpenClaw
- [ ] **TM-07** `[Gemini]` Formulario de pre-consulta para el paciente (antes de la teleconsulta)
      _API_: `POST flow-os-intake`
      _UX_: motivo de consulta, foto de la lesión, lista de medicamentos actuales

---

## Bloque 14 — Citas: flujo completo

- [ ] **AP-01** `[Codex]` `GET appointments?fecha=&status=` — filtrado por fecha y estado (scheduled/completed/cancelled)
- [ ] **AP-02** `[Codex]` `PATCH appointments` — actualizar estado de cita (confirmar, completar, cancelar, no-show)
- [ ] **AP-03** `[Codex]` `GET booked-slots?service=&fecha=` — slots ocupados para un servicio ese día
- [ ] **AP-04** `[Codex]` `GET reschedule?token=` — validar token de reagendamiento + retornar slot actual y disponibles
- [ ] **AP-05** `[Codex]` `PATCH reschedule` — confirmar nuevo slot, invalidar token anterior
- [ ] **AP-06** `[Gemini]` UI de calendario de citas del día en admin
      _API_: `GET appointments?fecha=hoy`
      _UX_: vista de timeline por hora (8am-7pm), cada cita es un bloque color-coded por servicio
- [ ] **AP-07** `[Gemini]` UI de modal de detalle de cita en admin
      _UX_: nombre paciente, servicio, hora, botones: Ver HCE / Llamar / Marcar completado / Cancelar
- [ ] **AP-08** `[Gemini]` Vista de semana en el calendario del admin
      _API_: `GET appointments` con rango de fechas
      _UX_: 7 columnas, drag-to-reschedule (MVP: click para mover)
- [ ] **AP-09** `[Gemini]` Página de reagendamiento para el paciente (link del email)
      _API_: `GET reschedule?token=`, `GET availability`, `PATCH reschedule`
      _UX_: muestra la cita actual, calendario de slots disponibles, confirma con un click

---

## Bloque 15 — UX y diseño del sistema

- [ ] **UX-01** `[Gemini]` Sistema de diseño base — `css/tokens.css` con colores, tipografía, espaciado Aurora Derm
      _Valores_: paleta clínica (blanco, verde salud, gris cálido), fuente Inter
- [ ] **UX-02** `[Gemini]` Componentes base — `css/components.css`: botón, input, card, badge, modal, toast
      _Regla_: sin clases utilitarias, solo semántica: `.btn-primary`, `.card`, `.badge-success`
- [ ] **UX-03** `[Gemini]` Sistema de iconos — SVG inline en `js/icons.js`, referencia por nombre
      _Set inicial_: calendar, user, pill, stethoscope, camera, file-pdf, check, alert, phone, queue
- [ ] **UX-04** `[Gemini]` Loading states — skeletons en todas las pantallas que hacen fetch
      _Patrón_: `<div class="skeleton">` mientras carga, reemplazar con datos
- [ ] **UX-05** `[Gemini]` Toast de notificaciones — `js/toast.js` — `showToast(msg, type)` global
      _Tipos_: `success`, `error`, `warning`, `info` — auto-dismiss 4s
- [ ] **UX-06** `[Gemini]` Modal reutilizable — `js/modal.js` — `openModal(html)` / `closeModal()`
- [ ] **UX-07** `[Gemini]` Estado vacío (empty states) en todas las listas
      _UX_: cuando no hay citas / turnos / historial → ícono + mensaje + CTA relevante
- [ ] **UX-08** `[Gemini]` Responsive: todas las pantallas de admin funcionan en tablet (768px)
      _Reglas_: nav lateral colapsa a hamburger, tablas → cards en móvil
- [ ] **UX-09** `[Gemini]` Modo oscuro en admin — toggle en la nav, preferencia guardada en `localStorage`
- [ ] **UX-10** `[Gemini]` Print CSS para recetas y certificados — `@media print` limpio, sin nav/header

---

## Bloque 16 — API y documentación

- [ ] **DOC-01** `[Codex]` `docs/openapi.yaml` actualizado — solo los endpoints que existen en `routes.php` post-limpieza
- [ ] **DOC-02** `[Codex]` `docs/API.md` reescrito — tabla de endpoints con método, ruta, auth requerida, respuesta ejemplo
- [ ] **DOC-03** `[Codex]` `docs/ARCHITECTURE.md` reescrito — diagrama del flujo real: request → api.php → autoloader → controller → service
- [ ] **DOC-04** `[Codex]` Colección de Postman/Bruno exportada en `docs/aurora-derm.json`
      _Cubre_: auth flows, queue, appointments, openclaw, portal
- [ ] **DOC-05** `[Gemini]` `docs/SCREENS.md` — capturas o wireframes de cada pantalla con su endpoint correspondiente
      _Objetivo_: que cualquier desarrollador entienda qué hace cada pantalla en 30 segundos

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

---

## Bloque 17 — Sistema de diseño ✅ completado

- [x] **UX-01** `[Gemini]` `css/tokens.css` — colores clínicos, Inter, espaciado 4px, sombras, dark mode, reset
- [x] **UX-02** `[Gemini]` `css/components.css` — btn, input, card, badge, table, avatar, modal, toast, skeleton, empty-state, responsive, print
- [x] **UX-03** `[Gemini]` `js/icons.js` — 40+ SVGs inline sin deps externas
- [x] **UX-05** `[Gemini]` `js/toast.js` — `showToast(msg, type, duration)` — auto-dismiss, pause on hover
- [x] **UX-06** `[Gemini]` `js/modal.js` — `openModal / closeModal / confirmModal → Promise<bool>`, focus trap

---

## Bloque 18 — JS utilities [Gemini]

- [ ] **JS-01** `[Gemini]` `js/api.js` — cliente HTTP: `apiGet(resource)`, `apiPost(resource, body)` → `{ ok, data, error }`
- [ ] **JS-02** `[Gemini]` `js/auth.js` — sesión admin: `getSession()`, `logout()`, `requireAuth()` → redirige a login
- [ ] **JS-03** `[Gemini]` `js/router.js` — SPA hash router: `router.on('#/citas', fn)`, `router.navigate('#/turnero')`
- [ ] **JS-04** `[Gemini]` `js/skeleton.js` — `Skeleton.show(el)` / `Skeleton.hide(el)` para cualquier contenedor
- [ ] **JS-05** `[Gemini]` `js/storage.js` — localStorage con TTL: `Storage.set(k, v, ms)` / `Storage.get(k)`
- [ ] **JS-06** `[Gemini]` `js/debounce.js` — `debounce(fn, ms)` global para inputs de búsqueda
- [ ] **JS-07** `[Gemini]` `js/format.js` — `formatDate`, `formatTime`, `formatCurrency`, `formatPhone`, `initials`
- [ ] **JS-08** `[Gemini]` `js/poll.js` — polling reactivo con backoff: `createPoller(fn, ms) → { start, stop, refresh }`

---

## Bloque 19 — Portal del paciente: JS client [Gemini]

- [ ] **JP-01** `[Gemini]` `js/portal-api.js` — cliente HTTP del portal con header `X-Portal-Token`
- [ ] **JP-02** `[Gemini]` `js/portal-auth.js` — login por código: `startAuth(email)` → `completeAuth(email, code)` → token
- [ ] **JP-03** `[Gemini]` `js/portal-nav.js` — navegación del portal: barra inferior mobile + sidebar desktop

---

## Bloque 20 — Pantallas de turnero [Gemini]

- [ ] **TK-01** `[Gemini]` `kiosco.html` + `js/kiosco.js` — pantalla táctil: ingresa documento → número de turno + tiempo
- [ ] **TK-02** `[Gemini]` `sala.html` + `js/sala.js` — TV horizontal: turno llamado grande, polling 5s, failsafe offline
- [ ] **TK-03** `[Gemini]` `operador.html` + `js/operador.js` — consola: botón llamar siguiente, lista de espera, urgencias
- [ ] **TK-04** `[Gemini]` `turno-publico.html` — QR del ticket: estado en tiempo real sin login

---

## Bloque 21 — Pantallas de admin [Gemini]

- [ ] **AD-01** `[Gemini]` `admin.html` — shell del dashboard: nav lateral + router + topbar con perfil y dark mode toggle
- [ ] **AD-02** `[Gemini]` Vista de citas del día en admin — timeline por hora 8am-7pm, click → modal detalle
- [ ] **AD-03** `[Gemini]` Buscador de pacientes — input con debounce 300ms, dropdown de resultados
- [ ] **AD-04** `[Gemini]` Historia clínica (HCE) en admin — timeline de episodios, acordeón SOAP, fotos
- [ ] **AD-05** `[Gemini]` Chat OpenClaw en admin — panel lateral, streaming de respuesta, sugerencias CIE-10
- [ ] **AD-06** `[Gemini]` Formulario de receta en admin — medicamentos con check de interacciones badge
- [ ] **AD-07** `[Gemini]` Certificado médico en admin — formulario + preview PDF inline
- [ ] **AD-08** `[Gemini]` Nota SOAP en admin — 4 campos con autosave 30s y contador de caracteres
- [ ] **AD-09** `[Gemini]` Galería de fotos clínicas en admin — grid por zona corporal, lightbox, upload drag&drop
- [ ] **AD-10** `[Gemini]` Panel de estado del sistema en admin — `GET health`, DB, cron, disk, latencia
- [ ] **AD-11** `[Gemini]` Disponibilidad médica en admin — grilla semanal, click para bloquear/liberar horarios
- [ ] **AD-12** `[Gemini]` Panel de telemedicina en admin — intakes pendientes, aprobar/rechazar, link de sala

---

## Bloque 22 — Pantallas del portal del paciente [Gemini]

- [ ] **PP-01** `[Gemini]` `portal/login.html` — email → código 6 dígitos → entra
- [ ] **PP-02** `[Gemini]` `portal/inicio.html` — próxima cita, último diagnóstico, documentos pendientes, saldo
- [ ] **PP-03** `[Gemini]` `portal/historia.html` — timeline de consultas, descarga PDF
- [ ] **PP-04** `[Gemini]` `portal/receta.html` — receta renderizada, descarga PDF, QR de verificación
- [ ] **PP-05** `[Gemini]` `portal/pagos.html` — historial de pagos, badges de estado, comprobante
- [ ] **PP-06** `[Gemini]` `portal/plan.html` — plan de tratamiento, sesiones completadas, próximas
- [ ] **PP-07** `[Gemini]` `portal/consentimiento.html` — documento + firma checkbox + nombre
- [ ] **PP-08** `[Gemini]` `portal/fotos.html` — galería antes/después por episodio, upload desde celular
- [ ] **PP-09** `[Gemini]` `portal/reagendar.html` — vista cita actual + calendario disponibilidad + confirmar

---

## Bloque 23 — Sitio público [Gemini]

- [ ] **WB-01** `[Gemini]` `index.html` — landing principal: hero, servicios, CTA booking, WhatsApp flotante
- [ ] **WB-02** `[Gemini]` `servicios/index.html` — grid de servicios con cards, link a cada especialidad
- [ ] **WB-03** `[Gemini]` `servicios/acne.html` — página de servicio individual con SEO, descripción, CTA
- [ ] **WB-04** `[Gemini]` `agendar/index.html` — booking público: servicio → fecha → hora → confirmar con email
- [ ] **WB-05** `[Gemini]` `precios/index.html` — tabla de precios con comparativo de planes
- [ ] **WB-06** `[Gemini]` `telemedicina/index.html` — landing teleconsulta: cómo funciona, requisitos, CTA
- [ ] **WB-07** `[Gemini]` `legal/index.html` — términos y política de privacidad

---

## Bloque 24 — UX pulido y accesibilidad [Gemini]

- [ ] **A11Y-01** `[Gemini]` Todos los formularios con `aria-label`, `aria-required`, `aria-describedby` para errores
- [ ] **A11Y-02** `[Gemini]` Focus visible en todos los elementos interactivos (outline accesible, no `outline:none`)
- [ ] **A11Y-03** `[Gemini]` Contraste mínimo WCAG AA en todos los textos sobre fondo de color
- [ ] **A11Y-04** `[Gemini]` Navegación por teclado completa en el admin (Tab, Escape, Enter para modales)
- [ ] **PERF-01** `[Gemini]` Lazy loading de secciones del admin que no son visibles al inicio
- [ ] **PERF-02** `[Gemini]` Service Worker en el kiosco y sala — funciona offline si el servidor se cae
- [ ] **PERF-03** `[Gemini]` Preload de la fuente Inter en todas las pantallas del admin y portal
- [ ] **ANIM-01** `[Gemini]` Transición page-swap en el router del admin (fade 150ms entre secciones)
- [ ] **ANIM-02** `[Gemini]` Animación de entrada para cards y listas (stagger 50ms por item)
- [ ] **ANIM-03** `[Gemini]` Micro-animación en el turno llamado de la sala — número aparece con slide-up


---

## Bloque 25 — Branding e identidad visual [Gemini]

- [ ] **BR-01** `[Gemini]` `js/aurora-branding.js` revisado — logo SVG inline, paleta, variables de marca accesibles desde JS
      _UX_: `AuroraBrand.logo()`, `AuroraBrand.color('primary')`, `AuroraBrand.applyTheme(el)`
- [ ] **BR-02** `[Gemini]` Favicon SVG + PNG generados desde el logo — `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`
- [ ] **BR-03** `[Gemini]` `css/print.css` — hoja de estilos de impresión para recetas y certificados con membrete Aurora Derm
      _Incluye_: logo, datos de contacto, pie de página legal, QR de verificación
- [ ] **BR-04** `[Gemini]` `css/kiosco.css` — estilos específicos del kiosco táctil: botones grandes (min 48px), tipografía 20px+
- [ ] **BR-05** `[Gemini]` `css/sala.css` — estilos de la pantalla TV: número de turno en 180px, alto contraste, sin cursor

---

## Bloque 26 — UI de pagos completa [Gemini]

- [ ] **PG-01** `[Gemini]` `js/portal-payments.js` refactorizado — usa `api.js` + `fmt.js`, elimina fetch manual
      _Pantalla_: lista de transacciones con badge de estado, total, botón descargar PDF
- [ ] **PG-02** `[Gemini]` Modal de detalle de pago — breakdown de items, fecha, método, referencia
- [ ] **PG-03** `[Gemini]` UI de pago con tarjeta (Stripe Element) en el portal
      _API_: `POST payment-intent` → Stripe CardElement → `POST checkout-confirm`
      _UX_: formulario sin redirección, loading state, manejo de error de tarjeta rechazada
- [ ] **PG-04** `[Gemini]` UI de pago por transferencia — sube foto del comprobante, muestra cuenta destino
      _API_: `POST transfer-proof`
      _UX_: instrucciones paso a paso + drag&drop del comprobante
- [ ] **PG-05** `[Gemini]` Comprobante de pago PDF inline — iframe embebido con el PDF generado por el API
- [ ] **PG-06** `[Codex]` `PaymentController` — generar PDF de comprobante con datos del paciente y servicio
- [ ] **PG-07** `[Gemini]` Badge de saldo pendiente en el portal inicio — alerta si hay facturas vencidas

---

## Bloque 27 — Onboarding del médico [Gemini + Codex]

- [ ] **ON-01** `[Gemini]` `onboarding/paso1.html` — datos de la clínica: nombre, logo, dirección, teléfono, WhatsApp
- [ ] **ON-02** `[Gemini]` `onboarding/paso2.html` — configurar horarios de atención y duración por servicio
- [ ] **ON-03** `[Gemini]` `onboarding/paso3.html` — servicios disponibles: catálogo editable, precios
- [ ] **ON-04** `[Gemini]` `onboarding/paso4.html` — integrar WhatsApp Business y correo de notificaciones
- [ ] **ON-05** `[Gemini]` `onboarding/paso5.html` — resumen y primer paciente de prueba
- [ ] **ON-06** `[Codex]` `GET clinic-profile` — retorna config completa de la clínica
- [ ] **ON-07** `[Codex]` `POST clinic-profile` — guarda config inicial (nombre, logo, contacto, timezone)
- [ ] **ON-08** `[Codex]` `POST clinic-hours` — guarda horarios de atención por día de la semana y por servicio

---

## Bloque 28 — Comunicaciones y plantillas [Gemini + Codex]

- [ ] **CM-01** `[Gemini]` Vista previa de email de confirmación de cita en admin — renderiza el template real
- [ ] **CM-02** `[Gemini]` Vista previa del WhatsApp de recordatorio en admin — simula el mensaje
- [ ] **CM-03** `[Gemini]` Editor de plantillas de notificación en admin — variables `{{patient_name}}`, `{{date}}`
      _API_: `GET notification-templates`, `POST notification-templates`
- [ ] **CM-04** `[Codex]` `lib/EmailTemplateRenderer.php` — renderiza templates HTML con variables interpoladas
- [ ] **CM-05** `[Codex]` `GET notification-templates` — obtiene plantillas activas (email + WhatsApp)
- [ ] **CM-06** `[Codex]` `POST notification-templates` — guarda plantilla personalizada con validación de variables
- [ ] **CM-07** `[Gemini]` Bandeja de mensajes recibidos (respuestas de WhatsApp) en admin
      _API_: `GET whatsapp-inbox`
      _UX_: lista cronológica, botón responder abre chat externo

---

## Bloque 29 — Reportes y exportación [Gemini + Codex]

- [ ] **RP-01** `[Gemini]` Panel de reportes en admin — `#/reportes`
      _Widgets_: citas del mes, ingresos, pacientes nuevos, servicios más solicitados
- [ ] **RP-02** `[Gemini]` Gráfica de citas por semana — barras simples con Canvas API, sin librerías externas
- [ ] **RP-03** `[Gemini]` Gráfica de ingresos por mes — línea de tendencia con Canvas API
- [ ] **RP-04** `[Gemini]` Tabla de top servicios — ranking con porcentaje del total
- [ ] **RP-05** `[Gemini]` Exportar reporte en CSV — botón que descarga datos del dashboard en `.csv`
- [ ] **RP-06** `[Codex]` `GET reports-summary?from=&to=` — citas, ingresos, pacientes nuevos en rango de fechas
- [ ] **RP-07** `[Codex]` `GET reports-services?from=&to=` — top servicios por volumen e ingreso
- [ ] **RP-08** `[Codex]` `GET reports-export.csv?from=&to=` — exporta datos completos en CSV

---

## Bloque 30 — Gestión de pacientes [Gemini + Codex]

- [ ] **PT-01** `[Gemini]` `admin#/pacientes` — lista paginada de pacientes con buscador
      _API_: `GET patient-search?q=` + `GET patients?page=`
      _UX_: tabla con nombre, celular, última visita, próxima cita, botón ver HCE
- [ ] **PT-02** `[Gemini]` Ficha del paciente en admin — datos personales + métricas clínicas
      _UX_: edad, alergias, condiciones crónicas, número de visitas, balance
- [ ] **PT-03** `[Gemini]` Crear paciente nuevo en admin — formulario con validación inline
      _API_: `POST patient-create`
      _UX_: nombre, celular, email, fecha de nacimiento, género, alergias
- [ ] **PT-04** `[Gemini]` Editar datos del paciente — mismo formulario en modo edición
      _API_: `PATCH patient-update`
- [ ] **PT-05** `[Codex]` `GET patients?page=&limit=` — lista paginada con cursor
- [ ] **PT-06** `[Codex]` `POST patient-create` — crea paciente con deduplicación por celular/email
- [ ] **PT-07** `[Codex]` `PATCH patient-update` — actualiza datos del paciente, versiona los cambios

---

## Bloque 31 — Inventario y catálogo [Gemini + Codex]

- [ ] **IN-01** `[Gemini]` `admin#/catalogo` — lista de servicios con precio, duración, estado activo/inactivo
      _API_: `GET services-catalog`
      _UX_: tabla editable inline, reorder por drag
- [ ] **IN-02** `[Gemini]` Formulario de nuevo servicio — nombre, precio, duración, categoría, descripción
      _API_: `POST services-catalog`
- [ ] **IN-03** `[Codex]` `GET services-catalog` — lista completa del catálogo con precios y disponibilidad
- [ ] **IN-04** `[Codex]` `POST services-catalog` — crea nuevo servicio con validación de unicidad
- [ ] **IN-05** `[Codex]` `PATCH services-catalog` — actualiza precio/duración/estado sin afectar citas futuras

---

## Bloque 32 — Consentimientos y legal [Gemini + Codex]

- [ ] **LG-01** `[Gemini]` `admin#/consentimientos` — lista de plantillas de consentimiento activas
      _UX_: tabla con nombre, versión, fecha, número de firmas, descargar PDF muestra
- [ ] **LG-02** `[Gemini]` Editor de consentimiento en admin — textarea enriquecido con variables del paciente
      _API_: `GET consent-template`, `POST consent-template`
- [ ] **LG-03** `[Gemini]` UI de solicitar firma al paciente desde la HCE
      _Flujo_: seleccionar template → enviar link por WhatsApp/email con un click
      _API_: `POST send-consent-request`
- [ ] **LG-04** `[Gemini]` Historial de consentimientos firmados — lista con fecha, IP, versión del documento
- [ ] **LG-05** `[Codex]` `GET consent-template?service=` — template del consentimiento para un servicio
- [ ] **LG-06** `[Codex]` `POST send-consent-request` — genera token único + envía link por WhatsApp al paciente
- [ ] **LG-07** `[Codex]` Webhook de firma en `patient-portal-consent` — registra fecha, IP, user-agent, hash del doc

---

## Bloque 33 — Errores y estados de sistema [Gemini]

- [ ] **ER-01** `[Gemini]` `404.html` — página no encontrada, con botón volver al inicio
- [ ] **ER-02** `[Gemini]` `500.html` — error del servidor, con mensaje de reintento y contacto de soporte
- [ ] **ER-03** `[Gemini]` Pantalla de mantenimiento `maintenance.html` — modo offline del sistema de turnos
- [ ] **ER-04** `[Gemini]` Banner de desconexión en la sala y el kiosco — aparece si el polling falla 3 veces seguidas
- [ ] **ER-05** `[Gemini]` Pantalla de sesión expirada en el portal — link para re-autenticarse

---

## Bloque 34 — Mobile y PWA [Gemini + Codex]

- [ ] **MB-01** `[Gemini]` `manifest.json` del portal — `display: standalone`, iconos, splash screen, theme color
- [ ] **MB-02** `[Gemini]` Service Worker del portal — cachea rutas estáticas del portal, funciona offline básico
- [ ] **MB-03** `[Gemini]` Instalar en pantalla de inicio — banner nativo en Chrome/Safari cuando el portal se abre 3 veces
- [ ] **MB-04** `[Gemini]` Gestos de deslizamiento en el portal mobile — swipe left/right entre secciones
- [ ] **MB-05** `[Codex]` Push Notification server: `POST push-subscribe` guarda el endpoint del dispositivo
- [ ] **MB-06** `[Codex]` `lib/PushService.php` — envía push al dispositivo cuando hay cita próxima o turno llamado

---

## Bloque 35 — Integración OpenAI / OpenClaw avanzada [Gemini + Codex]

- [ ] **AI-01** `[Gemini]` Autocomplete de diagnóstico en la nota SOAP — dropdown cuando el médico escribe en campo A
      _API_: `GET openclaw-cie10-suggest?q=` con debounce 400ms
- [ ] **AI-02** `[Gemini]` Resumen automático de la consulta — botón en la HCE que llama al API y muestra en modal
      _API_: `POST openclaw-chat` con contexto de la consulta actual
- [ ] **AI-03** `[Gemini]` Sugerencias de seguimiento — panel en HCE que muestra: "Próximo control en X semanas", "Pedir laboratorios"
      _API_: `GET openclaw-patient?patientId=`
- [ ] **AI-04** `[Codex]` `GET openclaw-cie10-suggest?q=` — búsqueda eficiente en el catálogo CIE-10 por texto
      _Target_: < 50ms de respuesta, caché de 1 hora
- [ ] **AI-05** `[Codex]` Rate limit específico para `openclaw-chat`: máx 20 req/min por usuario admin
- [ ] **AI-06** `[Gemini]` Historial de preguntas al copiloto por sesión — scroll up muestra preguntas anteriores de la misma consulta

      _API_: `GET appointments?fecha=hoy`
      _UX_: vista de timeline por hora (8am-7pm), cada cita es un bloque color-coded por servicio
- [ ] **AP-07** `[Gemini]` UI de modal de detalle de cita en admin
      _UX_: nombre paciente, servicio, hora, botones: Ver HCE / Llamar / Marcar completado / Cancelar
- [ ] **AP-08** `[Gemini]` Vista de semana en el calendario del admin
      _API_: `GET appointments` con rango de fechas
      _UX_: 7 columnas, drag-to-reschedule (MVP: click para mover)
- [ ] **AP-09** `[Gemini]` Página de reagendamiento para el paciente (link del email)
      _API_: `GET reschedule?token=`, `GET availability`, `PATCH reschedule`
      _UX_: muestra la cita actual, calendario de slots disponibles, confirma con un click

---

## Bloque 15 — UX y diseño del sistema

- [ ] **UX-01** `[Gemini]` Sistema de diseño base — `css/tokens.css` con colores, tipografía, espaciado Aurora Derm
      _Valores_: paleta clínica (blanco, verde salud, gris cálido), fuente Inter
- [ ] **UX-02** `[Gemini]` Componentes base — `css/components.css`: botón, input, card, badge, modal, toast
      _Regla_: sin clases utilitarias, solo semántica: `.btn-primary`, `.card`, `.badge-success`
- [ ] **UX-03** `[Gemini]` Sistema de iconos — SVG inline en `js/icons.js`, referencia por nombre
      _Set inicial_: calendar, user, pill, stethoscope, camera, file-pdf, check, alert, phone, queue
- [ ] **UX-04** `[Gemini]` Loading states — skeletons en todas las pantallas que hacen fetch
      _Patrón_: `<div class="skeleton">` mientras carga, reemplazar con datos
- [ ] **UX-05** `[Gemini]` Toast de notificaciones — `js/toast.js` — `showToast(msg, type)` global
      _Tipos_: `success`, `error`, `warning`, `info` — auto-dismiss 4s
- [ ] **UX-06** `[Gemini]` Modal reutilizable — `js/modal.js` — `openModal(html)` / `closeModal()`
- [ ] **UX-07** `[Gemini]` Estado vacío (empty states) en todas las listas
      _UX_: cuando no hay citas / turnos / historial → ícono + mensaje + CTA relevante
- [ ] **UX-08** `[Gemini]` Responsive: todas las pantallas de admin funcionan en tablet (768px)
      _Reglas_: nav lateral colapsa a hamburger, tablas → cards en móvil
- [ ] **UX-09** `[Gemini]` Modo oscuro en admin — toggle en la nav, preferencia guardada en `localStorage`
- [ ] **UX-10** `[Gemini]` Print CSS para recetas y certificados — `@media print` limpio, sin nav/header

---

## Bloque 16 — API y documentación

- [ ] **DOC-01** `[Codex]` `docs/openapi.yaml` actualizado — solo los endpoints que existen en `routes.php` post-limpieza
- [ ] **DOC-02** `[Codex]` `docs/API.md` reescrito — tabla de endpoints con método, ruta, auth requerida, respuesta ejemplo
- [ ] **DOC-03** `[Codex]` `docs/ARCHITECTURE.md` reescrito — diagrama del flujo real: request → api.php → autoloader → controller → service
- [ ] **DOC-04** `[Codex]` Colección de Postman/Bruno exportada en `docs/aurora-derm.json`
      _Cubre_: auth flows, queue, appointments, openclaw, portal
- [ ] **DOC-05** `[Gemini]` `docs/SCREENS.md` — capturas o wireframes de cada pantalla con su endpoint correspondiente
      _Objetivo_: que cualquier desarrollador entienda qué hace cada pantalla en 30 segundos

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

---

## Bloque 17 — Sistema de diseño ✅ completado

- [x] **UX-01** `[Gemini]` `css/tokens.css` — colores clínicos, Inter, espaciado 4px, sombras, dark mode, reset
- [x] **UX-02** `[Gemini]` `css/components.css` — btn, input, card, badge, table, avatar, modal, toast, skeleton, empty-state, responsive, print
- [x] **UX-03** `[Gemini]` `js/icons.js` — 40+ SVGs inline sin deps externas
- [x] **UX-05** `[Gemini]` `js/toast.js` — `showToast(msg, type, duration)` — auto-dismiss, pause on hover
- [x] **UX-06** `[Gemini]` `js/modal.js` — `openModal / closeModal / confirmModal → Promise<bool>`, focus trap

---

## Bloque 18 — JS utilities [Gemini]

- [ ] **JS-01** `[Gemini]` `js/api.js` — cliente HTTP: `apiGet(resource)`, `apiPost(resource, body)` → `{ ok, data, error }`
- [ ] **JS-02** `[Gemini]` `js/auth.js` — sesión admin: `getSession()`, `logout()`, `requireAuth()` → redirige a login
- [ ] **JS-03** `[Gemini]` `js/router.js` — SPA hash router: `router.on('#/citas', fn)`, `router.navigate('#/turnero')`
- [ ] **JS-04** `[Gemini]` `js/skeleton.js` — `Skeleton.show(el)` / `Skeleton.hide(el)` para cualquier contenedor
- [ ] **JS-05** `[Gemini]` `js/storage.js` — localStorage con TTL: `Storage.set(k, v, ms)` / `Storage.get(k)`
- [ ] **JS-06** `[Gemini]` `js/debounce.js` — `debounce(fn, ms)` global para inputs de búsqueda
- [ ] **JS-07** `[Gemini]` `js/format.js` — `formatDate`, `formatTime`, `formatCurrency`, `formatPhone`, `initials`
- [ ] **JS-08** `[Gemini]` `js/poll.js` — polling reactivo con backoff: `createPoller(fn, ms) → { start, stop, refresh }`

---

## Bloque 19 — Portal del paciente: JS client [Gemini]

- [ ] **JP-01** `[Gemini]` `js/portal-api.js` — cliente HTTP del portal con header `X-Portal-Token`
- [ ] **JP-02** `[Gemini]` `js/portal-auth.js` — login por código: `startAuth(email)` → `completeAuth(email, code)` → token
- [ ] **JP-03** `[Gemini]` `js/portal-nav.js` — navegación del portal: barra inferior mobile + sidebar desktop

---

## Bloque 20 — Pantallas de turnero [Gemini]

- [ ] **TK-01** `[Gemini]` `kiosco.html` + `js/kiosco.js` — pantalla táctil: ingresa documento → número de turno + tiempo
- [ ] **TK-02** `[Gemini]` `sala.html` + `js/sala.js` — TV horizontal: turno llamado grande, polling 5s, failsafe offline
- [ ] **TK-03** `[Gemini]` `operador.html` + `js/operador.js` — consola: botón llamar siguiente, lista de espera, urgencias
- [ ] **TK-04** `[Gemini]` `turno-publico.html` — QR del ticket: estado en tiempo real sin login

---

## Bloque 21 — Pantallas de admin [Gemini]

- [ ] **AD-01** `[Gemini]` `admin.html` — shell del dashboard: nav lateral + router + topbar con perfil y dark mode toggle
- [ ] **AD-02** `[Gemini]` Vista de citas del día en admin — timeline por hora 8am-7pm, click → modal detalle
- [ ] **AD-03** `[Gemini]` Buscador de pacientes — input con debounce 300ms, dropdown de resultados
- [ ] **AD-04** `[Gemini]` Historia clínica (HCE) en admin — timeline de episodios, acordeón SOAP, fotos
- [ ] **AD-05** `[Gemini]` Chat OpenClaw en admin — panel lateral, streaming de respuesta, sugerencias CIE-10
- [ ] **AD-06** `[Gemini]` Formulario de receta en admin — medicamentos con check de interacciones badge
- [ ] **AD-07** `[Gemini]` Certificado médico en admin — formulario + preview PDF inline
- [ ] **AD-08** `[Gemini]` Nota SOAP en admin — 4 campos con autosave 30s y contador de caracteres
- [ ] **AD-09** `[Gemini]` Galería de fotos clínicas en admin — grid por zona corporal, lightbox, upload drag&drop
- [ ] **AD-10** `[Gemini]` Panel de estado del sistema en admin — `GET health`, DB, cron, disk, latencia
- [ ] **AD-11** `[Gemini]` Disponibilidad médica en admin — grilla semanal, click para bloquear/liberar horarios
- [ ] **AD-12** `[Gemini]` Panel de telemedicina en admin — intakes pendientes, aprobar/rechazar, link de sala

---

## Bloque 22 — Pantallas del portal del paciente [Gemini]

- [ ] **PP-01** `[Gemini]` `portal/login.html` — email → código 6 dígitos → entra
- [ ] **PP-02** `[Gemini]` `portal/inicio.html` — próxima cita, último diagnóstico, documentos pendientes, saldo
- [ ] **PP-03** `[Gemini]` `portal/historia.html` — timeline de consultas, descarga PDF
- [ ] **PP-04** `[Gemini]` `portal/receta.html` — receta renderizada, descarga PDF, QR de verificación
- [ ] **PP-05** `[Gemini]` `portal/pagos.html` — historial de pagos, badges de estado, comprobante
- [ ] **PP-06** `[Gemini]` `portal/plan.html` — plan de tratamiento, sesiones completadas, próximas
- [ ] **PP-07** `[Gemini]` `portal/consentimiento.html` — documento + firma checkbox + nombre
- [ ] **PP-08** `[Gemini]` `portal/fotos.html` — galería antes/después por episodio, upload desde celular
- [ ] **PP-09** `[Gemini]` `portal/reagendar.html` — vista cita actual + calendario disponibilidad + confirmar

---

## Bloque 23 — Sitio público [Gemini]

- [ ] **WB-01** `[Gemini]` `index.html` — landing principal: hero, servicios, CTA booking, WhatsApp flotante
- [ ] **WB-02** `[Gemini]` `servicios/index.html` — grid de servicios con cards, link a cada especialidad
- [ ] **WB-03** `[Gemini]` `servicios/acne.html` — página de servicio individual con SEO, descripción, CTA
- [ ] **WB-04** `[Gemini]` `agendar/index.html` — booking público: servicio → fecha → hora → confirmar con email
- [ ] **WB-05** `[Gemini]` `precios/index.html` — tabla de precios con comparativo de planes
- [ ] **WB-06** `[Gemini]` `telemedicina/index.html` — landing teleconsulta: cómo funciona, requisitos, CTA
- [ ] **WB-07** `[Gemini]` `legal/index.html` — términos y política de privacidad

---

## Bloque 24 — UX pulido y accesibilidad [Gemini]

- [ ] **A11Y-01** `[Gemini]` Todos los formularios con `aria-label`, `aria-required`, `aria-describedby` para errores
- [ ] **A11Y-02** `[Gemini]` Focus visible en todos los elementos interactivos (outline accesible, no `outline:none`)
- [ ] **A11Y-03** `[Gemini]` Contraste mínimo WCAG AA en todos los textos sobre fondo de color
- [ ] **A11Y-04** `[Gemini]` Navegación por teclado completa en el admin (Tab, Escape, Enter para modales)
- [ ] **PERF-01** `[Gemini]` Lazy loading de secciones del admin que no son visibles al inicio
- [ ] **PERF-02** `[Gemini]` Service Worker en el kiosco y sala — funciona offline si el servidor se cae
- [ ] **PERF-03** `[Gemini]` Preload de la fuente Inter en todas las pantallas del admin y portal
- [ ] **ANIM-01** `[Gemini]` Transición page-swap en el router del admin (fade 150ms entre secciones)
- [ ] **ANIM-02** `[Gemini]` Animación de entrada para cards y listas (stagger 50ms por item)
- [ ] **ANIM-03** `[Gemini]` Micro-animación en el turno llamado de la sala — número aparece con slide-up


---

## Bloque 36 — Auditoría refactor crítico [Codex]

- [ ] **RF-01** `[Codex]` Auditar `lib/PatientCaseService.php` — verificar que el facade delega correctamente a Sync/Queue/Identity services
- [ ] **RF-02** `[Codex]` Auditar `lib/case/PatientCaseSyncService.php` — verificar métodos de instancia vs estáticos
- [ ] **RF-03** `[Codex]` Auditar `lib/email/EmailSenderService.php` y `EmailTemplateService.php` — self:: en nombres de método corregido
- [ ] **RF-04** `[Codex]` Verificar que `lib/lead/LeadScoringService.php` restaurado carga correctamente en bootstrap

---

## Bloque 37 — Auditoría runtime y compatibilidad crítica [Codex]

- [ ] **RT-01** `[Codex]` Correr `GET /api.php?resource=data` con sesión activa y reportar payload
- [ ] **RT-02** `[Codex]` Correr `GET /api.php?resource=appointments` con sesión activa y reportar payload
- [ ] **RT-03** `[Codex]` Correr `GET /api.php?resource=queue-state` y corregir body vacío (ticket EJ-01)
- [ ] **RT-04** `[Codex]` Correr `POST /api.php?resource=queue-ticket` walk-in y verificar persistencia

---

## Bloque 38 — Auditoría contratos y visibilidad crítica [Codex]

- [ ] **CT-01** `[Codex]` Documentar payload exacto de `GET health` — todos los campos y tipos
- [ ] **CT-02** `[Codex]` Documentar payload exacto de `GET queue-state` — contrato esperado
- [ ] **CT-03** `[Codex]` Verificar que `GET clinical-evolution` devuelve estructura consistente

---

## Bloque 39 — Auditoría consistencia pagos y suscripciones [Codex]

- [ ] **PS-01** `[Codex]` Auditar locking e idempotencia en checkout y webhooks Stripe
- [ ] **PS-02** `[Codex]` Auditar compatibilidad de `SoftwareSubscriptionService` con `clinic_profile`
- [ ] **PS-03** `[Codex]` Auditar estados divergentes entre appointments, store de pagos y perfil de clínica
- [ ] **PS-04** `[Codex]` Registrar pasada limpia de auditoría en docs/

---

## Bloque 40 — Hacer funcionar lo que ya existe [Alta prioridad]

> Auditoría 2026-04-03. Runtime OK. Lint: 0 fallos. Health: 200.
> Sin features nuevos. Que funcione de punta a punta.

- [ ] **EJ-01** `[Codex]` P0 — `GET queue-state` devuelve body vacío. Corregir QueueController → `{"ok":true,"data":{"currentTicket":null,"queue":[],"stats":{}}}`
- [ ] **EJ-02** `[Codex]` P0 — `POST queue-ticket` walk-in crea ticket, lo persiste, lo devuelve
- [ ] **EJ-03** `[Codex]` P0 — `POST queue-call-next` marca primer ticket como `calling`
- [ ] **EJ-04** `[Codex]` P0 — `POST queue-checkin` paciente ingresa cédula, recibe número
- [ ] **EJ-05** `[Codex]` P1 — `GET queue-public-ticket?id=UUID` sin auth, devuelve posición y estado
- [ ] **EJ-06** `[Codex]` P1 — `POST queue-no-show` y `POST queue-cancel` — cerrar turno activo
- [ ] **EJ-07** `[Codex]` P1 — `GET appointments` con sesión activa responde 200 con citas del día
- [ ] **EJ-08** `[Codex]` P1 — `GET data` con sesión activa entrega payload del dashboard
- [ ] **EJ-09** `[Codex]` P2 — `composer install` sin errores. PHPUnit Smoke pasa.
- [ ] **EJ-10** `[Codex]` P2 — Smoke suite: Certificate, Queue, ClinicalHistory con 0 errores fatales
- [ ] **EJ-V01** `[Codex]` P1 — Verificar `POST /clinical-evolution` en runtime. Criterio: HTTP 200 + fila en SQLite
- [x] **EJ-20** `[Gemini]` P0 — `kiosco.html` flujo real: cédula → `POST queue-checkin` → número → reset 30s
- [ ] **EJ-21** `[Gemini]` P0 — `sala.html` datos reales de `GET queue-state` (depende EJ-01)
- [ ] **EJ-22** `[Gemini]` P0 — `recepcion.html` acciones reales (depende EJ-03)
- [ ] **EJ-23** `[Gemini]` P1 — `estado-turno.html` móvil sin login, auto-refresh 15s
- [ ] **EJ-24** `[Gemini]` P1 — `admin.html` shell básico: citas del día + turnero

---

## Bloque 41 — CI real [Codex]

- [ ] **CI-01** `[Codex]` P0 — `composer install` funciona en GitHub Actions
- [ ] **CI-02** `[Codex]` P0 — PHPUnit Smoke suite exit 0
- [ ] **CI-03** `[Codex]` P1 — `npm run test:smoke` arranca servidor, espera, corre tests
- [ ] **CI-04** `[Codex]` P2 — `php bin/runtime-smoke.php` carga 4 controllers sin errores fatales

---

## Bloque 42 — Documentación mínima operativa [Codex]

- [ ] **DOC-01** `[Codex]` P0 — Reescribir `README.md` — máx 150 líneas, estado actual real
- [ ] **DOC-02** `[Codex]` P1 — `docs/ARCHITECTURE.md` — flujo de una request completo
- [ ] **DOC-03** `[Codex]` P1 — `env.example` — todas las variables de entorno requeridas
