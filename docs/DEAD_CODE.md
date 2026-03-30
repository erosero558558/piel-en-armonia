# Dead Code Audit

Fecha de auditoría: `2026-03-30`

Superficie auditada:

- [src/apps/queue-shared](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/src/apps/queue-shared)

Metodología:

- se tomaron como roots las referencias reales desde HTML/JS del turnero:
  `operador-turnos.html`, `kiosco-turnos.html`, `sala-turnos.html`, `admin.html`
  y los entrypoints vivos bajo `src/apps/queue-operator/`, `src/apps/queue-kiosk/`,
  `src/apps/queue-display/`, `src/apps/turnero-desktop/` y
  `src/apps/admin-v3/shared/modules/queue/render/section/install-hub*`
- se resolvió el grafo estático de imports/re-exports dentro de `src/apps/queue-shared`
- un archivo se marcó como huérfano solo si no era alcanzable desde ningún root real

## Resumen

- `src/apps/queue-shared` contiene `400` archivos.
- `140` archivos están referenciados directamente desde roots reales.
- El grafo completo deja `394` archivos alcanzables.
- Solo `6` archivos quedan realmente huérfanos.

Conclusión importante:

- La hipótesis histórica de que “la mayoría son `turnero-surface-*` generados y probablemente dead code” ya no se sostiene en el repo actual.
- La mayor parte de `queue-shared` sí está viva por imports del operador, kiosco, display, desktop y el install hub del admin.
- `S4-22` no debería intentar archivar “~80%” de la carpeta; hoy el recorte seguro es mucho más pequeño.

## Huérfanos confirmados

Estos seis wrappers quedaron archivados en `S4-22` bajo `_archive/turnero-surfaces/`.

- `src/apps/queue-shared/turnero-release-blast-radius.js` → [_archive/turnero-surfaces/turnero-release-blast-radius.js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/_archive/turnero-surfaces/turnero-release-blast-radius.js)
  Tamaño: `245 B`
- `src/apps/queue-shared/turnero-release-dependency-gates.js` → [_archive/turnero-surfaces/turnero-release-dependency-gates.js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/_archive/turnero-surfaces/turnero-release-dependency-gates.js)
  Tamaño: `257 B`
- `src/apps/queue-shared/turnero-release-freeze-window-registry.js` → [_archive/turnero-surfaces/turnero-release-freeze-window-registry.js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/_archive/turnero-surfaces/turnero-release-freeze-window-registry.js)
  Tamaño: `531 B`
- `src/apps/queue-shared/turnero-release-maintenance-window.js` → [_archive/turnero-surfaces/turnero-release-maintenance-window.js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/_archive/turnero-surfaces/turnero-release-maintenance-window.js)
  Tamaño: `263 B`
- `src/apps/queue-shared/turnero-release-rollback-rehearsal.js` → [_archive/turnero-surfaces/turnero-release-rollback-rehearsal.js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/_archive/turnero-surfaces/turnero-release-rollback-rehearsal.js)
  Tamaño: `263 B`
- `src/apps/queue-shared/turnero-release-wave-planner.js` → [_archive/turnero-surfaces/turnero-release-wave-planner.js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/_archive/turnero-surfaces/turnero-release-wave-planner.js)
  Tamaño: `245 B`

## Patrón observado

- Los seis huérfanos son wrappers muy pequeños.
- Todos reexportan funciones desde [turnero-release-progressive-delivery.js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/src/apps/queue-shared/turnero-release-progressive-delivery.js).
- `rg` sobre sus nombres en `src`, `js`, `templates`, `*.html`, `rollup.config.mjs` y `package.json` no devolvió referencias.

## Recomendación para S4-22

- Mover solo estos seis archivos a `_archive/turnero-surfaces/` o eliminarlos si se confirma que eran aliases transitorios.
- No aplicar una poda masiva sobre `queue-shared` sin rehacer el grafo, porque hoy `394/400` módulos siguen vivos.
