# BACKLOG.md — Tareas Pendientes Aurora Derm
_Generado: 29/3/2026, 9:01:28 a. m. | Fuente: AGENTS.md_
_Para contexto completo de cada tarea → lee **AGENTS.md**_

> **Para agentes:** usa `npm run dispatch:<rol>` para obtener tu tarea.
> Luego `node bin/claim.js claim <ID> "<nombre>"` antes de empezar.

## Estado General

`██████░░░░░░░░░░░░░░` **31%** completado (30/97)

| Sprint | Hecho | Pendiente | % |
|--------|-------|-----------|---|
| 🎯 Sprint 0 | 30 | 67 | 31% |

## 🎯 Sprint 0 — Completado

### 🟢 Disponibles (54)

| ID | Tamaño | Tarea |
|----|--------|-------|
| **S2-22** | `[S]` | Mapa Google Maps — agregar embed de Google Maps en el footer de  o en ... |
| **S3-14** | `[S]` | Métricas de espera — registrar tiempo real de espera por turno. Regist... |
| **S3-21** | `[S]` | Red flags — : alertar en admin si lesión >6mm, cambio de color en luna... |
| **S4-19** | `[S]` | Microsoft Clarity — agregar script gratis de heatmaps. Analizar scroll... |
| **S2-19** | `[M]` | Badges en hero — agregar badges visuales en la sección hero de : "MSP ... |
| **S3-03** | `[M]` | Transiciones automáticas — en , cuando un turno cambia a , avanzar el ... |
| **S3-04** | `[M]` | Actions por stage — implementar las  del manifest: al entrar a , ofrec... |
| **S3-06** | `[M]` | Historial de journey — log de transiciones con timestamps para cada pa... |
| **S3-08** | `[M]` | Selección de motivo en kiosco — en , antes de generar turno: "Consulta... |
| **S3-10** | `[M]` | Acciones post-consulta — botones en operador: "Agendar siguiente", "En... |
| **S3-11** | `[M]` | Ticket con QR —  genera ticket con QR que lleva a . Paciente ve su pos... |
| **S3-13** | `[M]` | Sala inteligente — en , entre llamadas mostrar: tips de cuidado de pie... |
| **S3-18** | `[M]` | Plan de tratamiento — template: diagnóstico, tratamientos (con sesione... |
| **S3-19** | `[M]` | Receta digital — datos doctor (MSP), datos paciente, medicamentos (nom... |
| **S3-20** | `[M]` | Evolución clínica — nota por visita: hallazgos, procedimientos, evoluc... |
| **S3-22** | `[M]` | Exportar HCE completa — botón en admin: genera PDF con todo el histori... |
| **S3-28** | `[M]` | Vista de agenda diaria — en admin: agenda del día con pacientes confir... |
| **S3-33** | `[M]` | Verificación de transferencia — paciente sube foto del comprobante. Ad... |
| **S3-34** | `[M]` | Estado de cuenta — vista en admin: historial de pagos por paciente, sa... |
| **S4-03** | `[M]` | Predicción de no-show — modelo basado en: historial de asistencia, hor... |
| **S4-04** | `[M]` | Resúmenes automáticos — : generar resumen post-consulta para el pacien... |
| **S4-05** | `[M]` | Scoring de leads — clasificar leads por probabilidad de conversión bas... |
| **S4-14** | `[M]` | Programa de referidos — : beneficio por paciente referido. CTA: "Compa... |
| **S4-15** | `[M]` | Promociones — : template para ofertas rotativas. Mes de la piel, Día d... |
| **S4-17** | `[M]` | Gift cards — : montos predefinidos, generación de código, PDF descarga... |
| **S4-18** | `[M]` | Conversion funnel — trackear embudo: visita → scroll → click WhatsApp ... |
| **S4-20** | `[M]` | Dashboard de conversión en admin — vista: visitas/día, clicks WhatsApp... |
| **S4-24** | `[M]` | CSS dead code — 8+ archivos CSS en raíz. Verificar cuáles se importan ... |
| **S4-25** | `[M]` | Images audit — 262 webp en . Verificar cuáles se referencian desde HTM... |
| **S2-21** | `[L]` | Página primera consulta — crear : qué esperar, qué traer, duración (~4... |
| **S2-23** | `[L]` | Sincronizar  — verificar que refleja la versión ES actual. Hero, servi... |
| **S3-01** | `[L]` | Vista journey en admin — crear componente en  que muestre el timeline ... |
| **S3-02** | `[L]` | Dashboard de stages — panel kanban en : cuántos pacientes hay en cada ... |
| **S3-05** | `[L]` | Intake digital público — crear  con formulario: nombre, WhatsApp, tipo... |
| **S3-07** | `[L]` | Check-in QR — paciente llega al kiosco, escanea QR de su cita (generad... |
| **S3-12** | `[L]` | Estimación de espera — calcular tiempo estimado basado en: posición en... |
| **S3-15** | `[L]` | Formulario de anamnesis — vista en admin: motivo, antecedentes persona... |
| **S3-16** | `[L]` | Fotografía clínica — captura desde cámara, upload a . Metadata: fecha,... |
| **S3-17** | `[L]` | Comparación before/after — en admin: dos fotos side-by-side de misma z... |
| **S3-30** | `[L]` | Vista de teleconsulta — : sala de espera virtual, video embed (Jitsi/D... |
| **S3-32** | `[L]` | Checkout integrado — : monto, concepto, métodos (Stripe, transferencia... |
| **S4-01** | `[L]` | Triage IA — : analizar fotos + descripción del paciente → sugerir urge... |
| **S4-02** | `[L]` | Chatbot WhatsApp — : responder preguntas frecuentes por WhatsApp con I... |
| **S4-06** | `[L]` | Tenant isolation audit — verificar que  aísla datos entre clínicas: pa... |
| **S4-08** | `[L]` | Pricing page — : Free (1 doctor), Pro ($49/mes, 5 doctores), Enterpris... |
| **S4-09** | `[L]` | Demo interactiva mejorada — : demo funcional del turnero con datos de ... |
| **S4-12** | `[L]` | API docs — : documentación OpenAPI de la API para integraciones extern... |
| **S4-13** | `[L]` | Página de paquetes — : combos de tratamiento. "Plan Piel Perfecta" (3 ... |
| **S4-16** | `[L]` | Membresía — : plan mensual con beneficios (consultas priority, descuen... |
| **S4-21** | `[L]` | Surface audit —  tiene 398 archivos JS. La mayoría son turnero-surface... |
| **S4-26** | `[L]` | CI pipeline audit —  — verificar que todos los jobs referencian archiv... |
| **S3-24** | `[XL]` | Booking público — crear : selección de servicio → doctor → fecha → hor... |
| **S3-29** | `[XL]` | Flujo completo de teleconsulta — paciente solicita →  evalúa →  decide... |
| **S4-07** | `[XL]` | Onboarding de clínica — flujo: registrar clínica →  → cargar staff → a... |

### 🔗 Bloqueadas (necesitan prerequisito)

- **S2-24** `[XL]` — necesita: S2-23 primero
- **S3-09** `[M]` — necesita: S3-08 primero
- **S3-25** `[M]` — necesita: S3-24 primero
- **S3-26** `[M]` — necesita: S3-24 primero
- **S3-27** `[M]` — necesita: S3-24 primero
- **S3-31** `[M]` — necesita: S3-29, S3-30 primero
- **S4-10** `[L]` — necesita: S4-06 primero
- **S4-11** `[L]` — necesita: S4-06 primero
- **S4-22** `[XL]` — necesita: S4-21 primero
- **S4-23** `[M]` — necesita: S4-21 primero

### 🙋 Requieren respuesta del dueño → ver BLOCKERS.md

- **S2-20** `[S]` Google reviews embed — agregar widget de reseñas de Google e...
- **S3-23** `[M]` Compliance MSP Ecuador — verificar campos obligatorios del f...
- **S3-35** `[L]` Factura SRI — integrar con facturación electrónica del SRI E...

---
_Este archivo es generado automáticamente. No editarlo a mano._
_Para actualizar: `node bin/sync-backlog.js`_
