# BACKLOG.md — Tareas Pendientes Aurora Derm
_Generado: 29/3/2026, 5:54:38 p. m. | Fuente: AGENTS.md_
_Para contexto completo de cada tarea → lee **AGENTS.md**_

> **Para agentes:** usa `npm run dispatch:<rol>` para obtener tu tarea.
> Luego `node bin/claim.js claim <ID> "<nombre>"` antes de empezar.

## Estado General

`██████░░░░░░░░░░░░░░` **31%** completado (44/144)

| Sprint | Hecho | Pendiente | % |
|--------|-------|-----------|---|
| ⏸ Sprint 0 | 0 | 0 | 0% |
| ✅ Sprint 1 | 12 | 0 | 100% |
| ✅ Sprint 2 | 24 | 0 | 100% |
| 🎯 Sprint 3 | 7 | 28 | 20% |
| ⏸ Sprint 4 | 1 | 25 | 4% |
| ⏸ Sprint 5 | 0 | 22 | 0% |
| ⏸ Sprint 6 | 0 | 25 | 0% |

## ✅ Sprint 0 — Completado
_Sprint completado. 0/0 tareas._

## ✅ Sprint 1 — Arreglar lo roto antes de vender
_Sprint completado. 12/12 tareas._

## ✅ Sprint 2 — Convertir visitantes en pacientes
_Sprint completado. 24/24 tareas._

## 🎯 Sprint 3 — Construir Flow OS como plataforma

### 🟢 Disponibles (20)

| ID | Tamaño | Tarea |
|----|--------|-------|
| **S3-14** | `[S]` | Métricas de espera — registrar tiempo real de espera por turno. Regist... |
| **S3-08** | `[M]` | Selección de motivo en kiosco — en , antes de generar turno: "Consulta... |
| **S3-10** | `[M]` | Acciones post-consulta — botones en operador: "Agendar siguiente", "En... |
| **S3-11** | `[M]` | Ticket con QR —  genera ticket con QR que lleva a . Paciente ve su pos... |
| **S3-13** | `[M]` | Sala inteligente — en , entre llamadas mostrar: tips de cuidado de pie... |
| **S3-18** | `[M]` | Plan de tratamiento — template: diagnóstico, tratamientos (con sesione... |
| **S3-19** | `[M]` | Receta digital — datos doctor (MSP), datos paciente, medicamentos (nom... |
| **S3-20** | `[M]` | Evolución clínica — nota por visita: hallazgos, procedimientos, evoluc... |
| **S3-28** | `[M]` | Vista de agenda diaria — en admin: agenda del día con pacientes confir... |
| **S3-33** | `[M]` | Verificación de transferencia — paciente sube foto del comprobante. Ad... |
| **S3-34** | `[M]` | Estado de cuenta — vista en admin: historial de pagos por paciente, sa... |
| **S3-07** | `[L]` | Check-in QR — paciente llega al kiosco, escanea QR de su cita (generad... |
| **S3-12** | `[L]` | Estimación de espera — calcular tiempo estimado basado en: posición en... |
| **S3-15** | `[L]` | Formulario de anamnesis — vista en admin: motivo, antecedentes persona... |
| **S3-16** | `[L]` | Fotografía clínica — captura desde cámara, upload a . Metadata: fecha,... |
| **S3-17** | `[L]` | Comparación before/after — en admin: dos fotos side-by-side de misma z... |
| **S3-30** | `[L]` | Vista de teleconsulta — : sala de espera virtual, video embed (Jitsi/D... |
| **S3-32** | `[L]` | Checkout integrado — : monto, concepto, métodos (Stripe, transferencia... |
| **S3-24** | `[XL]` | Booking público — crear : selección de servicio → doctor → fecha → hor... |
| **S3-29** | `[XL]` | Flujo completo de teleconsulta — paciente solicita →  evalúa →  decide... |

### 🔒 En progreso — NO tomar

- **S3-06** `[M]` → _Codex-erosero558558_ (expira en 223min)

### 🔗 Bloqueadas (necesitan prerequisito)

- **S3-09** `[M]` — necesita: S3-08 primero
- **S3-25** `[M]` — necesita: S3-24 primero
- **S3-26** `[M]` — necesita: S3-24 primero
- **S3-27** `[M]` — necesita: S3-24 primero
- **S3-31** `[M]` — necesita: S3-29, S3-30 primero

### 🙋 Requieren respuesta del dueño → ver BLOCKERS.md

- **S3-23** `[M]` Compliance MSP Ecuador — verificar campos obligatorios del f...
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
_Esperando que Sprint anterior esté completo. 25 tareas pendientes._

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
- **S6-09** `[S]` — necesita: S6-01 primero
- **S6-11** `[L]` — necesita: S6-10 primero
- **S6-12** `[M]` — necesita: S6-11 primero
- **S6-13** `[M]` — necesita: S6-11 primero
- **S6-15** `[M]` — necesita: S6-14 primero
- **S6-16** `[M]` — necesita: S6-14 primero
- **S6-17** `[M]` — necesita: S6-14 primero
- **S6-19** `[L]` — necesita: S6-18 primero
- **S6-20** `[M]` — necesita: S6-18 primero
- **S6-24** `[M]` — necesita: S6-23 primero

---
_Este archivo es generado automáticamente. No editarlo a mano._
_Para actualizar: `node bin/sync-backlog.js`_
