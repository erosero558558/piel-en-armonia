# CSS Audit

Fecha de auditoria: `2026-03-30`

Superficie auditada:

- archivos `*.css` en la raiz del repo
- referencias exactas desde HTML/PHP/Astro/JS vivos en [templates](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/templates), [src](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/src), [js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/js), [admin.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/admin.html), [operador-turnos.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/operador-turnos.html), [kiosco-turnos.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/kiosco-turnos.html), [sala-turnos.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/sala-turnos.html), [index.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/index.html) y [legacy.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/legacy.php)

Metodologia:

- inventario con `find . -maxdepth 1 -type f -name '*.css'`
- busqueda de cada nombre exacto de archivo en superficies runtime `.html`, `.php`, `.astro`, `.js`, `.ts` y `.tsx`
- exclusion deliberada de `.generated/`, `.codex-worktrees/`, `tests*`, `verification/`, `vendor/`, `dist/` y `build/`
- un CSS se marco como huerfano solo si su nombre exacto no aparece en ninguna superficie web viva

## Resumen

- La raiz hoy contiene `11` archivos CSS, no `8+`.
- `7` siguen vivos por referencias exactas desde HTML/PHP/Astro/JS.
- `4` quedaron huerfanos en runtime web actual:
  `legal.css`, `ops-design-system.css`, `styles-critical.css` y `styles-telemedicina.css`.
- El bloque huerfano suma `53135` bytes, aproximadamente `52 KB`.

## CSS vivos

- [admin-v3.css](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/admin-v3.css)
  Referencias: [admin.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/admin.html), [operador-turnos.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/operador-turnos.html)
- [queue-display.css](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/queue-display.css)
  Referencia: [sala-turnos.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/sala-turnos.html)
- [queue-kiosk.css](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/queue-kiosk.css)
  Referencia: [kiosco-turnos.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/kiosco-turnos.html)
- [queue-ops.css](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/queue-ops.css)
  Referencias: [admin.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/admin.html), [operador-turnos.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/operador-turnos.html)
- [styles-astro.css](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/styles-astro.css)
  Referencia: [BaseLayout.astro](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/src/apps/astro/src/layouts/BaseLayout.astro)
- [styles-deferred.css](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/styles-deferred.css)
  Referencias: [head-links.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/templates/partials/head-links.html), [tele-head-links.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/templates/partials/tele-head-links.html), [bootstrap-inline-engine.js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/js/bootstrap-inline-engine.js), [main.js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/js/main.js)
- [styles.css](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/styles.css)
  Referencias: [head-links.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/templates/partials/head-links.html), [tele-head-links.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/templates/partials/tele-head-links.html), [BaseLayout.astro](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/src/apps/astro/src/layouts/BaseLayout.astro), [legacy.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/legacy.php)

## CSS huerfanos confirmados

- [legal.css](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/legal.css) - `3254 B`
  No tiene import exacto desde superficies vivas. La pagina legal V6 usa [src/apps/astro/src/styles/public-v6/legal.css](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/src/apps/astro/src/styles/public-v6/legal.css), no este archivo de raiz.
- [ops-design-system.css](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/ops-design-system.css) - `20487 B`
  No tiene referencias exactas desde HTML/PHP/Astro/JS vivos.
- [styles-critical.css](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/styles-critical.css) - `22197 B`
  No aparece importado por ninguna superficie viva. Su comentario interno habla de un split con `styles-deferred.css`, pero ese split ya no se usa de forma explicita.
- [styles-telemedicina.css](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/styles-telemedicina.css) - `7197 B`
  No tiene referencias exactas en la shell de telemedicina actual; la tele surface carga [styles.css](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/styles.css) y [styles-deferred.css](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/styles-deferred.css).

## Recomendacion

- Estos cuatro archivos son buenos candidatos para limpieza o archivado en una tarea posterior.
- No conviene borrarlos automaticamente en esta auditoria; primero hay que confirmar que no dependan de enlaces externos fuera del repo.
