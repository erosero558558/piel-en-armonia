# BLOCKERS.md — Preguntas que requieren respuesta del dueño del negocio

> Los agentes NO pueden avanzar en estas tareas sin tu respuesta.
> **Instrucciones:** responde debajo de cada pregunta → commit → push.
> Los agentes leen este archivo automáticamente en cada sesión.

---

## S2-20 — Google Reviews embed

**Tarea:** Agregar widget de reseñas de Google en `index.html`.

**Pregunta:**
¿Tiene Aurora Derm ficha verificada en Google Maps?
Si sí: ¿cuál es el **Place ID** de la clínica? (formato: `ChIJ...`)

Puedes encontrarlo en: https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder

**Respuesta del dueño:**
```
[PENDIENTE — escribe aquí tu respuesta]
```

---

## S3-23 — Compliance MSP Ecuador (formulario 0457)

**Tarea:** Verificar campos obligatorios del formulario 0457 del Ministerio de Salud Pública de Ecuador para la Historia Clínica Electrónica (HCE).

**Pregunta:**
Del formulario oficial MSP-0457, ¿cuáles son los campos que ya llevas en consulta?
Los campos estándar son: identificación, anamnesis, examen físico, diagnóstico CIE-10, prescripción, evolución. ¿Algún campo adicional que el MSP les exige específicamente a Uds.?

¿Están ya habilitados en el SIS (Sistema de Información en Salud) o en un sistema propio?

**Respuesta del dueño:**
```
[PENDIENTE — escribe aquí tu respuesta]
```

---

## S3-35 — Facturación electrónica SRI Ecuador

**Tarea:** Integrar facturación electrónica con el Servicio de Rentas Internas de Ecuador.

**Preguntas:**
1. ¿Tienen certificado de firma electrónica (token USB / archivo .p12) vigente?
2. ¿Están en ambiente de pruebas del SRI o en producción?
3. ¿Cuál es el RUC de la clínica para emisión de comprobantes?
4. ¿Qué tipos de comprobante necesitan? (factura, nota de venta, liquidación de compra)

**Respuesta del dueño:**
```
[PENDIENTE — escribe aquí tu respuesta]
```

---

## Instrucciones para los agentes

Si eres un agente IA y llegas a una tarea `[HUMAN]`:
1. Lee este archivo
2. Si la respuesta está en "Respuesta del dueño" y **no dice** `[PENDIENTE]`, procede con esa información
3. Si dice `[PENDIENTE]`, **no inventes datos** — salta a la siguiente tarea disponible con `node bin/dispatch.js --role <tu-rol>`

---

_Actualizado automáticamente por `bin/report.js`_
