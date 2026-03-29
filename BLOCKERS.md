# BLOCKERS.md — Preguntas que requieren respuesta del dueño del negocio

> Los agentes NO pueden avanzar en estas tareas sin tu respuesta.
> **Instrucciones:** responde debajo de cada pregunta → commit → push.

---

## ✅ S2-20 — Google Reviews embed — RESPONDIDO

**Respuesta del dueño:**
```
Aún no tiene ficha verificada en Google Maps. Saltar esta tarea por ahora.
Implementar cuando la clínica esté operativa y tenga reseñas reales.
```
→ **Agentes:** omitir S2-20 hasta nuevo aviso.

---

## ✅ S3-23 — Compliance MSP Ecuador — APLAZADO

**Respuesta del dueño:**
```
El proyecto está en fase de idea/MVP. Aún no tiene registro MSP formal.
Construir el formulario con los campos estándar de anamnesis clínica:
motivo, antecedentes, medicamentos, alergias, examen físico, diagnóstico, plan.
El compliance formal con MSP-0457 se hará cuando la clínica esté operativa.
```
→ **Agentes:** implementar S3-23 con campos clínicos estándar, sin esperar validación MSP.

---

## ✅ S3-35 — Factura SRI — APLAZADO (MVP)

**Respuesta del dueño:**
```
El proyecto aún no tiene RUC ni certificado SRI. Es una idea en desarrollo.
Para el MVP: generar comprobantes de pago internos (PDF con logo, datos del
paciente, monto, concepto, número de recibo). Sin integración SRI por ahora.
La integración SRI formal es Sprint futuro cuando el negocio esté constituido.
```
→ **Agentes:** S3-35 convertido a "recibo digital PDF" sin integración SRI.
  Implementar usando `lib/pdf.php` o equivalente. Archivo: `es/recibo/index.html`.

---

## Sin blockers activos

No hay preguntas pendientes. Todos los blockers tienen respuesta.
Los agentes pueden tomar cualquier tarea disponible en `BACKLOG.md`.

---

_Actualizado por el dueño del producto: 2026-03-29_
