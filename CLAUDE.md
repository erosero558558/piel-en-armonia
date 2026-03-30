# CLAUDE.md — Onboarding para cualquier agente IA

> **Este archivo es tu punto de entrada.** 3 minutos de lectura = trabajo bien dirigido.
> Lee **PRODUCT.md** primero si es tu primera vez — es el mapa mental del producto.

---

## ¿Qué estamos construyendo?

**Aurora Derm** es una clínica dermatológica en Quito, Ecuador.
**Flow OS** es el sistema operativo del paciente — lo mueve de "desconocido" a "atendido".
**OpenClaw** es el copiloto clínico con IA — el único diferenciador real del producto.

**La premisa:** el médico ya usa ChatGPT. El problema: ChatGPT no sabe quién es el paciente.
**La solución:** OpenClaw carga el historial del paciente automáticamente antes de que el médico hable.

**Métrica de éxito de CUALQUIER tarea:** ¿le ahorra tiempo al médico? Si no, no importa.

---

## Paso 1: Identifica tu rol

| Rol | Qué haces |
|---|---|
| `backend` | PHP, APIs, controladores, servicios |
| `frontend` | HTML, CSS, UI, formularios, admin |
| `content` | Blog, SEO, textos, disclaimers |
| `devops` | CI, auditorías, limpieza, performance |
| `fullstack` | Cualquier cosa disponible |

```bash
npm run dispatch:<tu-rol>    # qué tarea tomar hoy
```

Si no sabes cuál eres → usa `fullstack`.

---

## Paso 2: Lee el estado antes de tocar nada

```bash
git pull origin main         # siempre primero
cat BACKLOG.md               # ~100 líneas, tareas disponibles ahora
```

`BACKLOG.md` = qué está disponible, qué está bloqueado.
`AGENTS.md` = contexto completo de cada tarea (léelo para ejecutar).
`PRODUCT.md` = el por qué del producto (léelo una vez).
`LAUNCH.md` = qué es crítico para junio 2026.

---

## Paso 3: Protocolo de trabajo (sin excepción)

```bash
# 1. Pull
git pull origin main

# 2. Ver tu tarea
node bin/dispatch.js --role <tu-rol>

# 3. Reclamar ANTES de trabajar
node bin/claim.js claim <TASK-ID> "<tu-nombre>"
git add data/claims/ && HUSKY=0 git commit --no-verify -m "claim: <TASK-ID>" && git push

# 4. Leer el contexto de la tarea en AGENTS.md

# 5. Ejecutar

# 6. Validar (obligatorio)
node bin/gate.js <TASK-ID>

# 7. Liberar + commitear
node bin/claim.js release <TASK-ID>
git add . && HUSKY=0 git commit --no-verify -m "feat(<TASK-ID>): descripción" && git push
```

**Si te bloqueas:** no dejes el claim colgando.
```bash
node bin/stuck.js <TASK-ID> "razón exacta del bloqueo"
# Esto libera el claim y lo registra para que el dueño lo resuelva.
```

---

## Arquitectura OpenClaw que DEBES conocer

### IA — no llames a OpenAI directamente

```php
// ✅ CORRECTO — usa el router multi-proveedor
require_once __DIR__ . '/../lib/openclaw/AIRouter.php';
$router = new OpenclawAIRouter();
$result = $router->route(['messages' => [...], 'temperature' => 0.3]);

// ❌ INCORRECTO — vendor lock-in, costo directo
curl("https://api.openai.com/v1/chat/completions", ...)
```

### CIE-10 — búsqueda local, sin API externa

```
data/cie10.json              ← 119 códigos (dermatología + medicina general)
GET /api.php?resource=openclaw-cie10-suggest&q=dermatitis
```

### Protocolos clínicos — JSON por código

```
data/protocols/L20.0.json    ← dermatitis atópica
data/protocols/L70.0.json    ← acné vulgar
data/protocols/L40.0.json    ← psoriasis
data/protocols/L50.0.json    ← urticaria
data/protocols/B35.4.json    ← tiña de los pies
data/protocols/L82.json      ← queratosis seborreica
data/protocols/D22.9.json    ← nevo melanocítico
GET /api.php?resource=openclaw-protocol&code=L20.0
```

### Interacciones medicamentosas

```
data/drug-interactions.json  ← 12 interacciones críticas
POST /api.php?resource=openclaw-interactions
```

### Endpoints OpenClaw registrados

```
openclaw-patient             → contexto completo del paciente
openclaw-cie10-suggest       → búsqueda CIE-10 (<50ms)
openclaw-protocol            → protocolo de tratamiento
openclaw-chat                → chat con IA (multi-provider)
openclaw-save-diagnosis      → aplica diagnóstico al caso
openclaw-save-evolution      → guarda nota de evolución
openclaw-prescription        → genera receta digital
openclaw-certificate         → genera certificado con folio
openclaw-interactions        → verifica interacciones
openclaw-summarize           → resumen de cierre de consulta
openclaw-router-status       → qué tier de IA está activo
```

### Flow OS — stages del paciente

```
lead_captured → intake_completed → scheduled → arrived →
in_consultation → documented → completed → follow_up
```

---

## Reglas absolutas

- ❌ **NO** trabajar sin `claim` previo y push
- ❌ **NO** saltar sprints (dispatch respeta dependencias)
- ❌ **NO** llamar a OpenAI API directamente — usar `OpenclawAIRouter`
- ❌ **NO** usar "tú" en contenido público. Siempre "usted"
- ❌ **NO** hardcodear colores — usar variables CSS de `styles/main-aurora.css`
- ❌ **NO** garantizar resultados médicos en contenido público
- ❌ **NO** tocar tareas `[HUMAN]` — registrar en BLOCKERS.md
- ✅ Si una acción del médico toma más de 2 clics → simplificar
- ✅ Gate antes de liberar
- ✅ Commits pequeños y descriptivos

---

## Comandos de referencia

```bash
npm run dispatch:<rol>           # qué tarea tomar
node bin/claim.js claim <id> <who>   # bloquear tarea
node bin/claim.js release <id>       # liberar al terminar
node bin/claim.js status             # claims activos
node bin/gate.js <id>                # validar antes de marcar done
node bin/stuck.js <id> "razón"       # reportar bloqueo
node bin/report.js                   # estado del sistema (para el dueño)
node bin/sync-backlog.js             # regenerar BACKLOG.md
```

## Mapa del repo

```
PRODUCT.md              ← qué es el producto (leer primero)
LAUNCH.md               ← qué es crítico para junio 2026
BACKLOG.md              ← tareas disponibles ahora
AGENTS.md               ← contexto completo por tarea
api.php                 ← bootstrap de la API (all controllers)
controllers/            ← 29 controladores PHP
  OpenclawController.php  ← copiloto clínico (12 endpoints)
lib/openclaw/           ← cerebro del copiloto
  AIRouter.php            ← router multi-proveedor (Tier 1→2→3)
lib/whatsapp_openclaw/  ← integración WhatsApp
lib/clinical_history/   ← historia clínica electrónica
lib/figo_queue/         ← cola asyncr de trabajos IA
data/cie10.json         ← catálogo CIE-10 (119 códigos)
data/protocols/         ← protocolos clínicos por CIE-10
data/drug-interactions.json ← interacciones medicamentosas
js/openclaw-chat.js     ← UI del chat clínico (embebido en admin)
openapi-openclaw.yaml   ← spec para Custom GPT de ChatGPT
```
