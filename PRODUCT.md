# Aurora Derm — El Producto

> **Versión para el equipo. Escrita para que cualquier médico o técnico entienda en 5 minutos qué estamos construyendo y por qué.**

---

## El problema que resuelve

Un médico en Ecuador tiene 7 minutos por paciente. En ese tiempo tiene que:

- Escuchar al paciente
- Examinar
- Diagnosticar
- Documentar en historia clínica
- Prescribir
- Emitir certificado si lo necesita
- Explicar el plan al paciente

La realidad: la documentación le roba 3 de esos 7 minutos. No porque sea difícil — sino porque los sistemas son lentos, rígidos, o directamente inexistentes (papel).

**Los médicos que resolvieron esto con ChatGPT lo usan en el auto, entre consultas, en el teléfono. Funciona. Es rápido. Es preciso. El problema: ChatGPT no sabe quién es el paciente.**

---

## La solución: OpenClaw

OpenClaw es el único sistema donde la IA ya sabe quién es el paciente antes de que el médico abra la boca.

El flujo de una consulta con OpenClaw:

```
1. Médico abre el caso del paciente (2 seg)
   → OpenClaw ya cargó: edad, sexo, diagnósticos previos,
     medicamentos activos, alergias, resumen última visita

2. Médico sube foto de la lesión o describe en chat (10 seg)
   → "lesión eritematosa 2x2cm espalda, 3 semanas evolución"

3. OpenClaw responde (3 seg):
   → "CIE-10 L82 — Queratosis seborreica. Diferencial: D22.9 (nevo).
      Protocolo: electrocoagulación o crioterapia. ¿Aplico diagnóstico?"

4. Médico: "sí, y genera receta con crioterapia + emoliente" (5 seg)
   → HCE actualizada, receta PDF lista, link WhatsApp listo

5. Médico: "certificado de control" (5 seg)
   → PDF con membrete, folio AD-2026-XXXXXX, listo para imprimir

Total consulta + documentación: 5 minutos en lugar de 10.
```

---

## Por qué no es otro EMR

| Los otros EMRs | Aurora Derm + OpenClaw |
|---|---|
| Formularios que el médico llena | Chat donde el médico habla |
| La IA es un campo de autocompletado | La IA es el co-piloto de la consulta |
| El médico explica el caso desde cero | El sistema ya sabe quién es el paciente |
| Certificados en 5 clics | Certificado: "genera certificado de reposo 2 días" → PDF |
| Cuesta $50-200/mes en API de IA | El médico usa su ChatGPT Plus que ya tiene ($20/mes) |
| Vendor lock-in: si sube el precio, estás atado | 3 proveedores en cascada automática |

---

## Cómo funciona por dentro

### El stack de IA (por qué no quebramos si ChatGPT sube el precio)

```
Consulta del médico
        ↓
  OpenClaw AI Router
        ↓
  ┌─────────────────────────────────────────┐
  │ Tier 1: Codex/ChatGPT OAuth             │ ← el médico usa su cuenta
  │         $0 costo para la clínica        │   se recarga cada 5h
  │         Si se agota → automático ↓      │
  ├─────────────────────────────────────────┤
  │ Tier 2: OpenRouter free models          │ ← DeepSeek V3 (gratis)
  │         DeepSeek · Qwen · Llama · Mistral   Qwen 235B (gratis)
  │         ~$0-5/mes para 40 pac/día       │   Llama 70B (gratis)
  │         Si falla → automático ↓         │
  ├─────────────────────────────────────────┤
  │ Tier 3: Heurística local                │ ← siempre disponible
  │         $0 · respuestas predefinidas    │   médico ve aviso claro
  │         El médico nunca queda sin IA    │
  └─────────────────────────────────────────┘
```

Si ChatGPT duplica el precio mañana: el médico pasa de Tier 1 a Tier 2 sin notarlo.

### El patient journey (cómo el paciente pasa de desconocido a atendido)

```
SITIO WEB        → Lead capturado (S3-05 ✅)
   ↓
PRE-CONSULTA     → Formulario digital (foto, síntoma, tipo de piel)
   ↓
LEAD_CAPTURED    → Caso creado en Flow OS
   ↓
AGENDADO         → Cita en calendario Google (S3-24)
   ↓
ARRIVED          → Check-in QR en kiosco (S3-07 ✅)
   ↓
IN_CONSULTATION  → Médico abre OpenClaw, IA ya tiene el caso
   ↓
DOCUMENTED       → HCE llenada, receta lista, certificado si aplica
   ↓
COMPLETED        → WhatsApp con resumen al paciente
   ↓
FOLLOW_UP        → Recordatorio automático de próxima cita
```

Esto es **Flow OS**: el motor que mueve al paciente de un estado al siguiente, sin que el médico tenga que pensar en ello.

---

## Los 3 números que importan para junio

| Métrica | Hoy (sin sistema) | Objetivo junio |
|---|---|---|
| Tiempo de documentación por consulta | 3-4 min | <90 seg |
| Pacientes/día posibles | 40 | 52-55 |
| Tiempo para emitir certificado | 5-8 min | <60 seg |

Si logramos estos 3 números en la consulta de tu hermano en junio, el producto se vende solo.

---

## Lo que existe hoy (marzo 2026)

### ✅ Completado y en producción
- Sitio web Aurora Derm (SEO, booking, servicios)
- Flow OS: turnero digital con kiosco QR
- WhatsApp OpenClaw: responde a pacientes automáticamente
- Historia clínica digital (sesión, evolución, episodios)
- Auth OAuth para médicos (no usuario/contraseña, sino identidad verificada)
- Multi-provider AI Router (Tier 1→2→3 automático)
- OpenClaw chat UI (interfaz de consulta embebida en admin)
- 12 endpoints del copiloto clínico registrados
- CIE-10: 119 códigos (foco dermatología + medicina general Ecuador)
- Intake digital público (formulario de pre-consulta)
- Journey timeline en admin
- Sala de teleconsulta

### 🔄 En construcción activa (Sprint 3)
- Generador PDF de certificados médicos
- Receta digital con QR
- Protocolo de tratamiento por diagnóstico CIE-10
- Agendamiento Google Calendar
- Check-in QR en kiosco
- Portal del paciente (ver sus citas y documentos)

### 📋 Planificado (Sprint 4-6, post-junio)
- Multi-clínica SaaS
- Facturación electrónica
- App móvil del paciente
- Analytics de clínica

---

## El modelo de negocio

**Fase 1 — Junio 2026: Aurora Derm**
- Tu hermano usa el sistema. Lo ajustas con feedback real.
- Métrica de éxito: usa OpenClaw en cada consulta.

**Fase 2 — Agosto 2026: Primera venta**
- 3-5 clínicas pagan $49-79/mes.
- Sin ventas formales. Solo mostrar los 3 números de arriba a un médico amigo.

**Fase 3 — 2027: SaaS Ecuador/Colombia**
- 100 clínicas × $49/mes = $4,900/mes
- Cada clínica trae el sistema con su propia cuenta de ChatGPT
- El costo marginal de IA para la plataforma: ~$0

**Por qué el modelo escala:**
- El médico paga la IA (ChatGPT Plus = $20/mes)
- La clínica paga el OS (Aurora Derm/Flow OS = $49-79/mes)
- El desarrollador (tú) no paga nada de IA

---

## Los riesgos reales y cómo los mitigamos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| ChatGPT duplica el precio | Media | AI Router Tier 2 automático (gratuito) |
| OpenAI limita el OAuth/Codex | Baja-Media | OpenRouter como fallback permanente |
| El médico no lo adopta | Media | Tu hermano es el usuario beta — feedback diario |
| Se construye demasiado antes de validar | Alta → **controlada** | Congelamos Sprint 4-6 hasta junio |
| Competencia copia la idea | Baja en Ecuador | El moat es la HCE + el patient journey, no solo el chat |

---

## El principio de diseño que no se negocia

> **Si una acción tarda más de 2 minutos sin entrenamiento, está mal diseñada.**

Eso aplica a: certificado, receta, diagnóstico CIE-10, registro de evolución, y cualquier cosa que un médico haga más de 10 veces al día.

---

## Para los agentes que trabajan en este sistema

Si eres un agente de código y estás leyendo esto:

1. **Lee `LAUNCH.md`** — qué es crítico para junio y qué no.
2. **Tu usuario final tiene 7 minutos por paciente.** Si tu feature necesita más de 2 clics para completarse, hazlo más simple.
3. **OpenClaw ya tiene el AI Router.** No hagas llamadas directas a OpenAI API. Usa `OpenclawAIRouter::route()`.
4. **El CIE-10 está en `data/cie10.json`.** No hagas llamadas externas para obtener códigos.
5. **Los protocolos van en `data/protocols/{CIE10_CODE}.json`.** Puedes crear archivos nuevos.
6. **Si te bloqueas:** `node bin/stuck.js TASK-ID "razón"` — libera el claim para que otro lo tome.
7. **Si terminas:** `node bin/gate.js TASK-ID` — valida antes de marcar como hecho.

---

_Última actualización: 2026-03-29 — Actualizar cada sprint_
