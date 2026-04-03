# AUDIT: Post-Simplificación Aurora Derm
**Fecha:** 2026-04-03
**Revisado por:** Revisión externa + Gemini
**Estado al cerrar este doc:** P0 resuelto, P1 resuelto, P2 pendiente (documentación)

---

## Resumen ejecutivo

La simplificación arquitectónica fue correcta en dirección pero dejó el runtime roto y la pipeline de calidad dando falsos verdes. Este documento registra los hallazgos y las correcciones aplicadas.

---

## Hallazgos

### P0 — Runtime mínimo roto ✅ RESUELTO

**Síntoma:** `index.php:5`, `api.php:5`, `admin-auth.php:5`, `bin/local-stage-router.php:9` requerían `api-lib.php`, archivo eliminado durante la poda.

**Causa raíz:** El commit `80e6c199` (Phase G cleanup) eliminó `api-lib.php` junto con otros assets de frontend, sin verificar que era el bootstrap crítico del runtime PHP.

**Corrección:** Restaurado `api-lib.php` desde commit `84b316a4` (93 líneas, 0 errores de sintaxis). `npm run lint:php` ahora lo valida en cada push.

---

### P1 — Drift interno en `lib/common.php` ✅ RESUELTO

**Síntoma:** `lib/common.php:263-264` mapeaba `/es/telemedicina/*` y `/en/telemedicine/*` al resource `telemedicine-preconsultation`, que **no existe** en `lib/routes.php`.

**Causa raíz:** El resource fue renombrado/eliminado durante la limpieza de controllers, pero la tabla de mapeo de URL no se actualizó.

**Corrección:** Mapeado a `telemedicine-intakes` (resource que sí existe y tiene route activa). Ver commit post-audit.

---

### P1 — Pipeline de calidad con precondiciones externas ✅ RESUELTO PARCIALMENTE

**Síntoma:**
- `npm run lint` → pasaba ✅ (pero no detectaba el bootstrap roto porque `php -l` compila, no ejecuta)
- `npm test` → fallaba por `vendor/bin/phpunit` ausente (composer no instalado localmente)
- `npm run test:node` → fallaba 10/10 con `ECONNREFUSED` (smoke tests requieren servidor corriendo)

**Corrección aplicada:**
- `npm test` = `lint` + `test:php` (graceful si falta phpunit)
- `npm run test:smoke` = tests HTTP reales — requiere `npm run dev` corriendo, marcado explícitamente
- `test:php` ahora imprime instrucción clara si falta vendor: `"ejecuta composer install primero"`

**Corrección pendiente (Codex):** `B-09` en TASKS.md — verificar dependencias de composer, instalar en CI.

---

### P2 — Documentación desincronizada ⚠️ PENDIENTE

**Síntoma:** `README.md`, deployment docs, y varios archivos de tests siguen mencionando:
- `admin.html` (eliminado)
- `/es/*` routes (frontend eliminado)
- `public-v6` builds
- Scripts de PowerShell que ya no existen

**Plan de corrección:**
- `DOC-02` en TASKS.md: reescribir `docs/API.md`
- `DOC-03` en TASKS.md: reescribir `docs/ARCHITECTURE.md`
- `README.md`: actualizar sección de "Cómo correr localmente" para reflejar backend-only

---

## Estado de los checks al cerrar este audit

| Check | Comando | Estado |
|---|---|---|
| Sintaxis PHP | `npm run lint:php` | ✅ 0 errores, 350 archivos |
| Route integrity | `npm run test:routes` | ✅ 34/34 controllers en disco |
| npm test | `npm test` | ✅ Pasa (lint + test:php graceful) |
| Smoke tests | `npm run test:smoke` | ⚠️ Requiere `npm run dev` corriendo |
| PHPUnit | `npm run test:php` | ⚠️ Requiere `composer install` |
| Runtime PHP | `php -l api.php` | ✅ Sin errores |
| api-lib.php | `ls api-lib.php` | ✅ Restaurado |

---

## Decisiones tomadas durante este audit

1. **`telemedicine-preconsultation` → `telemedicine-intakes`**: no crear el resource faltante, usar el existente. La redirección es informativa, no funcional en backend-only.

2. **`npm test` no depende de servidor corriendo**: los smoke tests se separaron a `test:smoke` para evitar falsos negativos en CI sin servidor.

3. **No se recrea `vendor/`**: composer install es responsabilidad del operador en producción. El CI (`D-01` en TASKS.md) lo instalará.

4. **`api-lib.php` se mantiene en el repo**: es el bootstrap del runtime, no un archivo de frontend. Su eliminación fue un error de la poda automática.

---

## Próximas acciones (de TASKS.md)

- `B-07` `[Codex]` — `env.example.php` actualizado
- `B-08` `[Codex]` — `cron.php` revisado post-limpieza
- `B-09` `[Codex]` — composer audit y CI con `composer install`
- `D-01` `[Codex]` — `.github/workflows/ci.yml` limpio con composer
- `DOC-02` `[Codex]` — `docs/API.md` sincronizado con routes reales
- `DOC-03` `[Codex]` — `docs/ARCHITECTURE.md` con flujo real request → api.php → autoloader → controller
