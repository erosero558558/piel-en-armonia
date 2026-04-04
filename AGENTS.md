# Aurora Derm — Reglas de Agentes

> Este archivo es la ley. Todo agente que trabaje en este repo debe leerlo antes de tocar cualquier archivo.
> El coordinador (LClaude) tiene autoridad final. Si hay duda, consultar a LClaude.

---

## Arquitectura del sistema (leer antes de cualquier cosa)

- **Backend**: PHP 8.x puro. API headless. Sin templates, sin HTML generado en PHP.
- **Frontend**: HTML + CSS + JS vanilla. Sin Astro. Sin React. Sin build step.
- **Base de datos**: SQLite (archivo `data/store.sqlite`). PDO mediante `get_db_connection()`.
- **NO hay MySQL** en producción. Los schemas en `database.sql` son referencia, no se usan directamente.
- **Entrada al sistema**: `api.php` → `ApiKernel` → `Router` → Controller → JSON
- **Pantallas existentes**: `kiosco.html`, `sala.html`, `recepcion.html` (vanilla HTML)

---

## División de jurisdicciones — ESTRICTA

### [Gemini] — Solo UI

**Puede tocar:**
- `*.html` en la raíz del proyecto
- `js/*.js` (lógica de cliente, fetch al API)
- `css/*.css` o `<style>` dentro de HTML

**No puede tocar:**
- Ningún archivo `.php`
- `lib/`, `controllers/`, `bin/` (salvo leer para entender contratos)
- `TASKS.md` — no puede marcar `[x]` por cuenta propia
- `composer.json`, `phpunit.xml`, `ci.yml`

### [Codex] — Solo Backend

**Puede tocar:**
- `lib/`, `controllers/`, `bin/`
- `phpunit.xml`, `composer.json`, `.github/workflows/ci.yml`
- Archivos de schema SQL (solo lectura, para entender estructura)

**No puede tocar:**
- `*.html` ni `js/*.js` de UI
- Marcar tickets de UI como `[x]` sin verificación

---

## Reglas anti-alucinación

### Regla 1 — "Hecho" significa verificado, no escrito

Un ticket se marca `[x]` solo cuando:
1. El código existe en disco (no en memoria)
2. El endpoint responde el contrato esperado (HTTP + payload)
3. El test pasa o se documenta por qué no hay test

**Ejemplo incorrecto**: "Reconstruí ClinicalEvolutionService ✅ Bloque 2 completado"
**Ejemplo correcto**: "ClinicalEvolutionService.php existe, sintaxis OK, ruta registrada. Falta: verificar POST en runtime con datos reales → ticket EJ-V01 abierto"

### Regla 2 — No declarar prioridades ni alcances no asignados

Ningún agente decide qué es urgente. LClaude asigna prioridades en `TASKS.md`.
Si un agente encuentra algo roto que no estaba en su ticket, abre un ticket nuevo y reporta. No lo resuelve solo.

### Regla 3 — No cambiar de tecnología

- No proponer Astro, Next.js, React, Vue ni ningún framework JS
- No proponer MySQL, PostgreSQL ni Redis — el sistema usa SQLite
- No agregar dependencias de `composer.json` sin aprobación de LClaude
- No cambiar la estructura de `api.php` ni `ApiKernel.php`

### Regla 4 — No hacer trabajo del otro agente

- Gemini no escribe PHP
- Codex no escribe HTML ni JS de frontend
- Si hay un bug que cruza la frontera, se abre un ticket y se asigna al correcto

### Regla 5 — El contexto siempre está en el repo

Antes de hacer cualquier cosa, leer:
1. `TODAY.md` — estado actual y tareas activas (leer primero)
2. `AGENTS.md` (este archivo) — las reglas
3. `TASKS.md` — tickets detallados
4. Los archivos relevantes del área a modificar

No asumir que el sistema funciona de una forma sin verificar el código.

### Regla 6 — PROHIBIDO: renombrar, reestructurar o reinventar el sistema de tareas

El sistema de nomenclatura de tickets es **exclusivamente de LClaude**. Ningún agente puede:
- Cambiar el prefijo de un ticket (`T-01` → `EVO-01` está **prohibido**)
- Inventar una nueva taxonomía de bloques
- Reorganizar secciones de `TASKS.md`
- Introducir metáforas temáticas (biomimética, anatomía, etc.) como estructura de trabajo

**Prefijos válidos y su significado:**

| Prefijo | Dominio |
|---|---|
| `B-` | Backend / infraestructura general |
| `T-` | Turnero (sistema de colas) |
| `A-` | Admin / dashboard médico |
| `P-` | Portal del paciente |
| `EJ-` | Ejecución inmediata — hacer funcionar lo que existe |
| `CI-` | CI/CD y testing |
| `DOC-` | Documentación |
| `RF-` | Refactoring / deuda técnica |
| `PS-` | Pagos y suscripciones |

Los bloques con prefijo `EVO-` fueron creados sin autorización y están **congelados**.
No usarlos como referencia activa. Las tareas activas están en Bloques 40-42 (prefijos EJ-, CI-, DOC-).

---

## Qué hacer cuando algo está ambiguo

1. Leer el código existente en el área relevante
2. Si sigue ambiguo, parar y reportar a LClaude con:
   - Archivo en cuestión
   - Línea específica
   - Pregunta concreta
3. No inventar una solución y asumir que es correcta

---

## Estado del sistema (actualizado 2026-04-03)

| Componente | Estado |
|---|---|
| PHP lint (376 archivos) | ✅ 0 errores |
| `GET /health` | ✅ 200 OK |
| `GET /queue-state` | ⚠️ 200 pero body vacío — ticket EJ-01 |
| `POST /queue-ticket` | ❌ sin verificar — ticket EJ-02 |
| `POST /clinical-evolution` | ⚠️ código existe, runtime no verificado — ticket EJ-V01 |
| PHPUnit Smoke suite | ❌ sin composer install — ticket CI-01 |
| `kiosco.html` flujo real | ❌ incompleto — ticket EJ-20 |
| `sala.html` datos reales | ❌ depende de EJ-01 |
| `recepcion.html` acciones reales | ❌ depende de EJ-03 |
