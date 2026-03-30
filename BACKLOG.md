# BACKLOG.md — Tareas Pendientes Aurora Derm
_Generado: 30/3/2026, 12:09:34 a. m. | Fuente: AGENTS.md_
_Para contexto completo de cada tarea → lee **AGENTS.md**_

> **Para agentes:** usa `npm run dispatch:<rol>` para obtener tu tarea.
> Luego `node bin/claim.js claim <ID> "<nombre>"` antes de empezar.

## Estado General

`████████░░░░░░░░░░░░` **38%** completado (82/213)

| Sprint | Hecho | Pendiente | % |
|--------|-------|-----------|---|
| ⏸ Sprint 0 | 0 | 0 | 0% |
| ✅ Sprint 1 | 12 | 0 | 100% |
| ✅ Sprint 2 | 24 | 0 | 100% |
| 🎯 Sprint 3 | 43 | 24 | 64% |
| ⏸ Sprint 4 | 1 | 25 | 4% |
| ⏸ Sprint 5 | 0 | 22 | 0% |
| ⏸ Sprint 6 | 1 | 24 | 4% |
| ⏸ Sprint 7 | 1 | 36 | 3% |
| ⏸ Sprint UI | 0 | 0 | 0% |

## ✅ Sprint 0 — Completado
_Sprint completado. 0/0 tareas._

## ✅ Sprint 1 — Arreglar lo roto antes de vender
_Sprint completado. 12/12 tareas._

## ✅ Sprint 2 — Convertir visitantes en pacientes
_Sprint completado. 24/24 tareas._

## 🎯 Sprint 3 — Construir Flow OS como plataforma

### 🟢 Disponibles (22)

| ID | Tamaño | Tarea |
|----|--------|-------|
| **S3-41** | `[S]` | CIE-10 autocomplete widget — el backend  ya existe. Falta el frontend:... |
| **S3-43** | `[S]` | Botón "Emitir certificado" en admin — en la vista del caso del pacient... |
| **S3-44** | `[S]` | Historial de certificados en admin — en el perfil del paciente, pestañ... |
| **S3-46** | `[S]` | ComplianceMSP validator — crear  con método  que devuelve lista de cam... |
| **S3-47** | `[S]` | Health check completo — el endpoint  debe verificar y reportar: estado... |
| **S3-50** | `[S]` | Notificación de bloqueo por email/WhatsApp — cuando un agente ejecuta ... |
| **S3-33** | `[M]` | Verificación de transferencia — paciente sube foto del comprobante. Ad... |
| **S3-34** | `[M]` | Estado de cuenta — vista en admin: historial de pagos por paciente, sa... |
| **S3-38** | `[M]` | Instalación de dompdf — agregar  vía composer: . Sin esto los PDF de c... |
| **S3-39** | `[M]` | Receta PDF renderer — actualmente  guarda la receta en HCE pero  devue... |
| **S3-40** | `[M]` | Integrar OpenClaw en admin — en , dentro del panel del caso del pacien... |
| **S3-42** | `[M]` | Panel de protocolo clínico — cuando el médico selecciona un código CIE... |
| **S3-51** | `[M]` | openapi-openclaw.yaml completar — el archivo existe (466 líneas) pero ... |
| **S3-52** | `[M]` | Custom GPT instructions — crear  con las instrucciones exactas para co... |
| **S3-58** | `[M]` | conflict.js — precisión quirúrgica — cambiar de heurística solo textua... |
| **S3-62** | `[M]` | Consolidar npm scripts —  tiene 273 scripts: demasiada superficie cogn... |
| **S3-30** | `[L]` | Vista de teleconsulta — : sala de espera virtual, video embed (Jitsi/D... |
| **S3-32** | `[L]` | Checkout integrado — : monto, concepto, métodos (Stripe, transferencia... |
| **S3-54** | `[L]` | Resumen de consulta para paciente — al cerrar la consulta (), generar ... |
| **S3-59** | `[L]` | Split  (4.766 líneas) — archivo monolítico con 3 responsabilidades mez... |
| **S3-60** | `[L]` | Split  (4.198 líneas) — separar en repositorios por agregado:  (sesion... |
| **S3-61** | `[L]` | Split  (24.990 líneas) — módulo de admin más grande del repo. Separar ... |

### 🔗 Bloqueadas (necesitan prerequisito)

- **S3-31** `[M]` — necesita: S3-29, S3-30 primero

### 🙋 Requieren respuesta del dueño → ver BLOCKERS.md

- **S3-35** `[L]` Factura SRI — integrar con facturación electrónica del SRI E...

## ⏸ Sprint 4 — Escalar el negocio
_Esperando que Sprint anterior esté completo. 25 tareas pendientes._

### 🟢 Disponibles (21)

| ID | Tamaño | Tarea |
|----|--------|-------|
| **S4-03** | `[M]` | Predicción de no-show — modelo basado en: historial de asistencia, hor... |
| **S4-04** | `[M]` | Resúmenes automáticos — : generar resumen post-consulta para el pacien... |
| **S4-05** | `[M]` | Scoring de leads — clasificar leads por probabilidad de conversión bas... |
| **S4-14** | `[M]` | Programa de referidos — : beneficio por paciente referido. CTA: "Compa... |
| **S4-15** | `[M]` | Promociones — : template para ofertas rotativas. Mes de la piel, Día d... |
| ... | | _+16 más_ |

### 🔗 Bloqueadas (necesitan prerequisito)

- **S4-10** `[L]` — necesita: S4-06 primero
- **S4-11** `[L]` — necesita: S4-06 primero
- **S4-22** `[XL]` — necesita: S4-21 primero
- **S4-23** `[M]` — necesita: S4-21 primero

## ⏸ Sprint 5 — Portal del Paciente (PWA)
_Esperando que Sprint anterior esté completo. 22 tareas pendientes._

### 🟢 Disponibles (13)

| ID | Tamaño | Tarea |
|----|--------|-------|
| **S5-09** | `[S]` | Consentimiento digital — : formulario de consentimiento informado. Fir... |
| **S5-13** | `[S]` | Cumpleaños — mensaje automático el día del cumpleaños del paciente. To... |
| **S5-22** | `[S]` | Exportar mi historia — botón en el portal: descargar PDF completo de l... |
| **S5-01** | `[M]` | Manifest PWA —  ya existe. Verificar que  tiene una versión instalable... |
| **S5-10** | `[M]` | Recordatorio 24h — : enviar mensaje WhatsApp automático 24h antes de c... |
| ... | | _+8 más_ |

### 🔗 Bloqueadas (necesitan prerequisito)

- **S5-03** `[L]` — necesita: S5-02 primero
- **S5-04** `[M]` — necesita: S5-02 primero
- **S5-05** `[M]` — necesita: S5-02 primero
- **S5-06** `[L]` — necesita: S5-02 primero
- **S5-07** `[M]` — necesita: S5-02 primero
- **S5-08** `[M]` — necesita: S5-01 primero
- **S5-15** `[XL]` — necesita: S5-16 primero
- **S5-19** `[M]` — necesita: S5-05 primero
- **S5-21** `[M]` — necesita: S5-04 primero

## ⏸ Sprint 6 — Plataforma SaaS para Clínicas
_Esperando que Sprint anterior esté completo. 24 tareas pendientes._

### 🟢 Disponibles (9)

| ID | Tamaño | Tarea |
|----|--------|-------|
| **S6-22** | `[S]` | Status page — : página pública con uptime de los servicios. Verde/amar... |
| **S6-21** | `[M]` | Integración Google Calendar — doctor puede sincronizar su agenda de Fl... |
| **S6-23** | `[M]` | Ticket de soporte — desde el admin de la clínica: "Crear ticket" → des... |
| **S6-02** | `[L]` | Perfil de clínica —  completo: nombre, logo, colores, dirección, horar... |
| **S6-10** | `[L]` | Pricing SaaS — definir y publicar: Free (1 doctor, 50 citas/mes), Star... |
| ... | | _+4 más_ |

### 🔗 Bloqueadas (necesitan prerequisito)

- **S6-03** `[M]` — necesita: S6-02 primero
- **S6-04** `[M]` — necesita: S6-02 primero
- **S6-05** `[L]` — necesita: S6-01 primero
- **S6-06** `[L]` — necesita: S6-02 primero
- **S6-07** `[M]` — necesita: S6-02 primero
- **S6-08** `[M]` — necesita: S6-06 primero
- **S6-11** `[L]` — necesita: S6-10 primero
- **S6-12** `[M]` — necesita: S6-11 primero
- **S6-13** `[M]` — necesita: S6-11 primero
- **S6-15** `[M]` — necesita: S6-14 primero
- **S6-16** `[M]` — necesita: S6-14 primero
- **S6-17** `[M]` — necesita: S6-14 primero
- **S6-19** `[L]` — necesita: S6-18 primero
- **S6-20** `[M]` — necesita: S6-18 primero
- **S6-24** `[M]` — necesita: S6-23 primero

## ⏸ Sprint 7 — Operaciones, Seguridad y Deuda de Infraestructura
_Esperando que Sprint anterior esté completo. 36 tareas pendientes._

### 🟢 Disponibles (36)

| ID | Tamaño | Tarea |
|----|--------|-------|
| **S7-02** | `[S]` | Hardening  — el archivo tiene  y  como placeholders. Un developer podr... |
| **S7-04** | `[S]` | Rate limiting en endpoints sensibles —  no tiene rate limiting por IP ... |
| **S7-05** | `[S]` | Auditar permisos por rol en endpoints OpenClaw —  tiene  pero no verif... |
| **S7-08** | `[S]` | Backup y restore automatizado — no hay ninguna tarea que valide backup... |
| **S7-09** | `[S]` | k8s readiness/liveness probes —  no tiene  ni . Kubernetes no puede de... |
| ... | | _+31 más_ |

## ✅ Sprint UI — Rediseño Total (ANTIGRAVITY EXCLUSIVO)
_Sprint completado. 0/0 tareas._

---
_Este archivo es generado automáticamente. No editarlo a mano._
_Para actualizar: `node bin/sync-backlog.js`_
