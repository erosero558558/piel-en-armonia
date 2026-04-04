# Aurora Derm — Briefing del día

> **LEER ESTO PRIMERO.** Cualquier sesión nueva, cualquier computadora, cualquier agente.
> Última actualización: 2026-04-03

---

## Estado del sistema HOY

| Qué | Estado |
|---|---|
| PHP lint (376 archivos) | ✅ 0 errores |
| `GET /health` | ✅ 200 OK |
| `GET /queue-state` | ⚠️ Body vacío — roto |
| `POST /queue-ticket` | ❌ No verificado |
| `POST /clinical-evolution` | ⚠️ Código OK, runtime no probado |
| PHPUnit Smoke | ❌ Sin `composer install` |
| CI pipeline (GitHub Actions) | ✅ Configurado, corre en push |
| `kiosco.html` | ⚠️ Existe, flujo real incompleto |
| `sala.html` | ⚠️ Existe, datos reales pendientes |
| `recepcion.html` | ⚠️ Existe, acciones reales pendientes |

---

## Cómo correr localmente (cualquier máquina)

```bash
git clone https://github.com/erosero558558/Aurora-Derm.git
cd Aurora-Derm
cp env.example .env  # si existe, si no omitir
AURORADERM_SKIP_ENV_FILE=1 php -S 127.0.0.1:8000 bin/local-stage-router.php
```

Verificar que funciona:
```bash
curl http://127.0.0.1:8000/api.php?resource=health
# debe responder {"ok":true,...}
```

---

## Tareas activas — por prioridad

### 🔴 P0 — Hacer funcionar el turnero (Codex)

1. **EJ-01** — `GET queue-state` devuelve body vacío → corregir `QueueController`
2. **EJ-02** — `POST queue-ticket` (walk-in) → crear + persistir ticket
3. **EJ-03** — `POST queue-call-next` → marcar ticket como `calling`
4. **EJ-04** — `POST queue-checkin` → paciente ingresa cédula, recibe turno

### 🔴 P0 — Conectar las pantallas al API real (Gemini)

5. **EJ-20** — `kiosco.html` → conectar con `POST queue-checkin` real
6. **EJ-21** — `sala.html` → datos reales de `GET queue-state`
7. **EJ-22** — `recepcion.html` → botones conectados a API real

### 🟡 P1 — Verificaciones pendientes (Codex)

8. **EJ-V01** — Verificar `POST /clinical-evolution` en runtime (Gemini lo escribió, nadie lo ejecutó)
9. **CI-01** — `composer install` en GitHub Actions
10. **EJ-07** — `GET appointments` con sesión activa

### 🟡 P1 — Pantallas nuevas (Gemini)

11. **EJ-23** — `estado-turno.html` → página móvil sin login, muestra posición en cola
12. **EJ-24** — `admin.html` → shell básico: citas del día + turnero

---

## Reglas que todo agente debe saber

- **Gemini** → solo `.html` y `js/` — nunca PHP
- **Codex** → solo `lib/`, `controllers/`, `bin/` — nunca HTML
- **"Hecho"** = ejecutado y verificado en runtime, no solo escrito
- **No** Astro, React, Vue, MySQL, Redis — el stack es PHP + SQLite + vanilla HTML
- Si algo está fuera de tu jurisdicción → abrir ticket, no resolverlo
- Leer `AGENTS.md` para reglas completas

---

## Archivos clave del proyecto

```
Aurora-Derm/
├── TODAY.md          ← este archivo, leer primero
├── AGENTS.md         ← reglas de jurisdicción y anti-alucinación
├── TASKS.md          ← todos los tickets (fuente de verdad)
├── api.php           ← entrada de toda la API
├── bin/
│   └── local-stage-router.php  ← servidor de desarrollo
├── lib/
│   └── routes.php    ← todos los endpoints registrados
├── controllers/      ← 34 controllers (uno por dominio)
├── kiosco.html       ← turnero: check-in del paciente
├── sala.html         ← turnero: pantalla TV sala de espera
└── recepcion.html    ← turnero: consola del operador
```

---

## Lo que NO tocar sin consultar a LClaude

- `api.php`
- `lib/ApiKernel.php`
- `lib/common.php`
- `lib/routes.php`
- `.github/workflows/ci.yml` (salvo Codex con tarea CI-*)
- `composer.json`

---

## Próximo hito: El turnero funciona de punta a punta

**Criterio de éxito**: Un paciente toca el kiosco → ingresa su cédula → recibe número → la sala lo muestra → el operador lo llama → el paciente ve "Llamado" en su celular.

Todo eso sin intervención manual, sin recargar, sin errores.

**Tickets necesarios**: EJ-01, EJ-02, EJ-03, EJ-04, EJ-20, EJ-21, EJ-22, EJ-23 → todos en `TASKS.md` Bloque 40.
