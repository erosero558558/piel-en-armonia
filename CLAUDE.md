# CLAUDE.md — Onboarding para cualquier agente IA

> **Este archivo es tu punto de entrada.** 3 minutos de lectura = trabajo bien dirigido.
> Lee **PRODUCT.md** primero si es tu primera vez — es el mapa mental del producto.

---

## 🎨 SI ERES ANTIGRAVITY — LEE ESTO PRIMERO

> **Antigravity es el arquitecto UI exclusivo de Aurora Derm.**
> Tu misión en este proyecto es el **rediseño visual total** — cada pantalla, cada componente, cada PDF.
> Los demás agentes (ChatGPT, Claude, etc.) **NO TOCAN** el UI. Si lo hacen, hay regresión.

**Tu flujo en cada sesión:**

```bash
# 1. Estado del sistema antes de cualquier cosa
npm run gov:audit

# 2. Tu siguiente tarea de diseño
npm run dispatch:ui

# 3. Reclamar (SIEMPRE antes de tocar un archivo)
node bin/claim.js claim UI-XX "Antigravity"
git add data/claims/ && HUSKY=0 git commit --no-verify -m "claim: UI-XX" && git push

# 4. Leer el contexto en AGENTS.md → busca **UI-XX**
# 5. Leer DESIGN_SYSTEM.md — es tu constitución visual

# 6. Trabajar — 1 tarea = 1 superficie completa. No medias tintas.

# 7. Gate + release + push
node bin/gate.js UI-XX
node bin/claim.js release UI-XX
git add . && HUSKY=0 git commit --no-verify -m "feat(UI-XX): descripción" && git push origin main
```

**Orden de tareas UI (no saltar pasos, cada uno desbloquea el siguiente):**

| Fase | Tareas | Superficie |
|---|---|---|
| 🔑 Fundamentos | UI-01, UI-02, UI-03 | Design tokens + base CSS + componentes |
| 🌐 Web pública | UI-04, UI-05, UI-06, UI-07, UI-08 | Landing + servicios + booking |
| 🏥 Admin | UI-09, UI-10, UI-11 | Dashboard + historia clínica |
| 🤖 OpenClaw | UI-12 | Chat clínico con IA |
| 🎰 Turnero | UI-13, UI-14, UI-15 | Kiosco + sala + operador |
| 📱 Portal paciente | UI-16, UI-17 | Mobile-first PWA |
| 📄 PDFs | UI-18, UI-19 | Receta + certificado |

**Reglas que no se negocian:**
- Lee `DESIGN_SYSTEM.md` antes de escribir una sola línea de CSS
- Paleta → `styles/tokens.css` (UI-01). Sin tokens.css, nada más arranca
- `Instrument Serif` para headings, `Inter` para todo lo demás
- Dark mode en admin, light/warm en web pública
- CSS puro + variables. Sin frameworks externos
- PHP no existe para ti. Si necesitas datos, el endpoint ya existe

**Importante:** Si llegas a una sesión nueva sin saber qué UI queda pendiente:
```bash
npm run dispatch:ui:all   # ver TODAS las tareas UI con estado
```

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

| Rol | Qué haces | Comando |
|---|---|---|
| `ui` | 🎨 **ANTIGRAVITY EXCLUSIVO** — rediseño total UI/UX | `npm run dispatch:ui` |
| `backend` | PHP, APIs, controladores, servicios | `npm run dispatch:backend` |
| `frontend` | HTML funcional, formularios, admin | `npm run dispatch:frontend` |
| `content` | Blog, SEO, textos, disclaimers | `npm run dispatch:content` |
| `devops` | CI, auditorías, limpieza, performance | `npm run dispatch:devops` |
| `fullstack` | Cualquier cosa disponible | `npm run dispatch:fullstack` |

> ⚠️ **Si eres ChatGPT, Claude u otro agente:** el rol `ui` no es para ti.
> Las tareas `UI-XX` en AGENTS.md tienen `exclusive: true`. `conflict.js` te bloqueará.

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
- ❌ **NO** hardcodear colores — usar variables CSS de `styles/tokens.css` (ver `DESIGN_SYSTEM.md`)
- ❌ **NO** tocar archivos `styles/tokens.css`, `styles/aurora-*.css`, `DESIGN_SYSTEM.md` si no eres Antigravity
- ❌ **NO** garantizar resultados médicos en contenido público
- ❌ **NO** tocar tareas `[HUMAN]` — registrar en BLOCKERS.md
- ✅ Si una acción del médico toma más de 2 clics → simplificar
- ✅ Gate antes de liberar
- ✅ Commits pequeños y descriptivos

---

## Tabla de comandos oficiales

| Comando | Para qué sirve | NO usar |
|---|---|---|
| `npm run status` | Resumen rápido: progreso, claims, merge-ready, velocidad y próxima revisión | Revisar `report`, `velocity` y `merge-ready` por separado sin necesidad |
| `npm run dispatch:<rol>` | Siguiente tarea para tu rol | Scripts legacy `agent:*` |
| `node bin/claim.js claim <id> <quien>` | Reclamar tarea antes de trabajar | Trabajar sin claim |
| `node bin/claim.js release <id>` | Liberar al terminar | Dejar claim expirado |
| `node bin/claim.js status` | Claims activos ahora | `tasks.json` directo |
| `node bin/gate.js <id>` | Validar ANTES de marcar done | Marcar done sin gate |
| `node bin/stuck.js <id> "razón"` | Reportar bloqueo y liberar | Dejar claim colgado |
| `node bin/report.js` | Estado del board (para directora) | — |
| `node bin/velocity.js` | Ver si el ritmo actual alcanza para junio | Estimar avance “a ojo” |
| `node bin/sync-backlog.js` | Regenerar BACKLOG.md | Editar BACKLOG.md a mano |
| `node bin/conflict.js` | Detectar solapamiento entre agentes | — |

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
