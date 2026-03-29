# CLAUDE.md — Onboarding para cualquier agente IA
SOURCE_OF_TRUTH: AGENTS.md

> **Este archivo es tu punto de entrada.** Léelo primero, luego ve a `AGENTS.md`.

## Quick Start (30 segundos)

1. Lee `AGENTS.md` sección "Backlog de Producto" → busca el primer `[ ]` sin completar.
2. Antes de trabajar, lee las secciones de contexto: "Identidad", "Design system", "Voz y tono".
3. Ejecuta la tarea. Verifica tu trabajo (ver "Verificación").
4. Commit: `feat(S1-XX): descripción corta` → push a `main`.
5. Marca `[x]` en AGENTS.md. Commit eso también.

## Fuente de verdad

| Documento | Propósito |
|---|---|
| `AGENTS.md` | **TODO está aquí.** Backlog, arquitectura, design system, reglas, acceptance criteria. |
| `CLAUDE.md` | Solo este quick-start de onboarding. |

## Qué NO hacer

- ❌ NO crear archivos de gobernanza (YAML boards, PLAN_MAESTRO, verification/).
- ❌ NO inventar scripts de orquestación ni comandos nuevos.
- ❌ NO saltar sprints (Sprint 1 antes que Sprint 2).
- ❌ NO usar vocabulario informal: "tú", "oferta", "descuento", "promo".
- ❌ NO hardcodear colores. Usar variables CSS de `styles/main-aurora.css`.
- ❌ NO garantizar resultados médicos en contenido público.
- ❌ NO modificar `AGENTS.md` excepto para marcar `[x]` tareas completadas.

## Qué SÍ hacer

- ✅ Leer la identidad del producto en AGENTS.md (WhatsApp: `wa.me/593982453672`).
- ✅ Usar los tokens CSS documentados en AGENTS.md.
- ✅ Seguir los templates de servicio/blog documentados en AGENTS.md.
- ✅ Verificar tu trabajo antes de commit (browser, curl, Lighthouse).
- ✅ Commits pequeños: un fix o feature por commit.
- ✅ Tratar al paciente de "usted". Tono médico, cálido, ecuatoriano.

## Comandos útiles

```bash
# Server local
php -S localhost:8000

# Health check
curl -s "http://localhost:8000/api.php?resource=health" | jq .

# Test suite
npm run agent:test

# Gate de calidad
npm run agent:gate

# Commit sin husky
HUSKY=0 git commit --no-verify -m "feat(S1-XX): descripción"
```

## Estructura del repo

Ver "Mapa de arquitectura" en `AGENTS.md` para el árbol completo.

Archivos clave:
- `index.html` — landing page principal
- `styles/main-aurora.css` — design system (tokens CSS)
- `api.php` + `lib/routes.php` — API REST (120+ endpoints)
- `controllers/` — lógica de negocio (28 controllers PHP)
- `lib/FlowOsJourney.php` — engine del patient journey
- `es/servicios/*/index.html` — 20 specialty pages
- `admin.html` — portal administrativo
- `kiosco-turnos.html` / `operador-turnos.html` / `sala-turnos.html` — turnero

## Ahora ve a AGENTS.md y ejecuta la primera tarea pendiente.
