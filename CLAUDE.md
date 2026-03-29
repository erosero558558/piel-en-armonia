# CLAUDE.md — Onboarding para cualquier agente IA

> **Este archivo es tu punto de entrada.** 2 minutos de lectura = trabajo bien dirigido.

## Paso 1: Identifica tu rol

Antes de tocar nada, define qué tipo de agente eres:

| Rol | Qué haces | Comando |
|---|---|---|
| `content` | Blog posts, SEO, textos, disclaimers | `npm run dispatch:content` |
| `frontend` | Páginas HTML, CSS, UI, formularios | `npm run dispatch:frontend` |
| `backend` | PHP, APIs, controladores, servicios | `npm run dispatch:backend` |
| `devops` | Limpieza, CI, auditorías, performance | `npm run dispatch:devops` |
| `fullstack` | Cualquier cosa disponible | `npm run dispatch:fullstack` |

Si no sabes cuál eres → usa `fullstack`.

## Paso 2: Protocolo de trabajo (sin excepción)

```bash
# 1. Siempre empezar con pull
git pull origin main

# 2. Ver qué tarea te corresponde por rol
node bin/dispatch.js --role <tu-rol>
# o: npm run dispatch:<tu-rol>

# 3. Reclamar ANTES de trabajar
node bin/claim.js claim <TASK-ID> "<tu-nombre>"
git add data/claims/ && HUSKY=0 git commit --no-verify -m "claim: <TASK-ID>" && git push

# 4. Leer el contexto de la tarea en AGENTS.md
# (identidad, design system, voz, arquitectura — todo está ahí)

# 5. Ejecutar la tarea

# 6. Liberar + commitear
node bin/claim.js release <TASK-ID>
git add . && HUSKY=0 git commit --no-verify -m "feat(<TASK-ID>): descripción" && git push

# 7. Opcional pero valorado: verificar board
npm run verify:fix
git add AGENTS.md && HUSKY=0 git commit --no-verify -m "docs: sync board" && git push
```

## Fuente de verdad: AGENTS.md

Todo el contexto está ahí:
- **Identidad** → WhatsApp, doctores, dominio, ciudad
- **Design system** → tokens CSS, componentes disponibles
- **Voz y tono** → siempre "usted", prohibido "oferta/descuento", español ecuatoriano
- **Reglas médicas** → nunca garantizar resultados, nunca diagnosticar
- **Templates** → cómo crear página de servicio o blog post
- **Arquitectura** → mapa de archivos, API endpoints, inventario de páginas
- **Acceptance criteria** → cuándo un sprint está done

## Reglas absolutas

- ❌ NO trabajar sin hacer `claim` y push primero
- ❌ NO saltar sprints (dispatch respeta el orden)
- ❌ NO usar "tú" en contenido. Siempre "usted"
- ❌ NO hardcodear colores. Usar variables CSS de `styles/main-aurora.css`
- ❌ NO garantizar resultados médicos en contenido público
- ❌ NO tocar tareas con tag `[HUMAN]` — preguntar al dueño
- ✅ Commits pequeños: un fix o feature por commit
- ✅ Verificar tu trabajo antes del commit final

## Comandos de referencia

```bash
node bin/dispatch.js --role <rol>   # qué tarea tomar
node bin/claim.js claim <id> <who>  # bloquear tarea
node bin/claim.js release <id>      # liberar al terminar
node bin/claim.js status            # ver claims activos
node bin/verify.js                  # verificar qué está realmente done
node bin/verify.js --fix            # auto-marcar [x] en AGENTS.md
node agent-orchestrator.js status   # estado del board (JSON)
curl http://localhost:8000/api.php?resource=health  # health check API
```

## Mapa rápido del repo

```
index.html              ← landing principal
admin.html              ← panel administrativo
styles/main-aurora.css  ← design system (tokens CSS)
controllers/            ← 28 controllers PHP
lib/                    ← servicios (FlowOsJourney, QueueService, etc.)
es/servicios/           ← 20 specialty pages
es/blog/                ← blog (4 posts, index, RSS)
data/claims/tasks.json  ← locks de tareas activos
bin/                    ← herramientas de agentes
```

**Lee AGENTS.md para el mapa completo.**
