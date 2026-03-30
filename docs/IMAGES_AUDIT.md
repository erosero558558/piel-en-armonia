# Images Audit

Fecha de auditoria: `2026-03-30`

Superficie auditada:

- [images/optimized](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/images/optimized)
- runtime web source-of-truth en [templates](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/templates), [src](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/src), [js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/js), [styles](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/styles), [content](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/content), [servicios](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/servicios), [index.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/index.html), [legacy.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/legacy.php) y [sw.js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/sw.js)

Metodologia:

- inventario completo de archivos bajo `images/optimized/`
- busqueda de referencias exactas a `images/optimized/...` y `/images/optimized/...`
- inclusion solo de superficies web activas en `.html`, `.php`, `.css`, `.js`, `.astro`, `.ts` y `.tsx`
- exclusion deliberada de `.generated/`, `.codex-worktrees/`, `tests*`, `verification/`, `vendor/`, `node_modules/` y outputs de build para no contar mirrors generados como si fueran HTML/CSS vivos
- un asset se marco como huerfano solo si su path exacto no aparece en ninguna superficie runtime viva

## Resumen

- El enunciado historico habla de `262` `.webp`; ese dato sigue siendo correcto para WebP, pero el directorio completo hoy contiene `587` assets:
  `262` `.webp`, `312` `.jpg`, `12` `.avif` y `1` `.png`.
- De los `262` `.webp`, solo `63` siguen referenciados por runtime web vivo.
- Quedan `199` `.webp` huerfanos en la superficie web actual.
- Si se cuentan todos los formatos, solo `86/587` assets siguen vivos y `501/587` quedan sin referencia exacta en runtime.

## Donde siguen vivos

Las referencias vivas se concentran sobre todo en:

- [src/apps/astro/src/pages/es/blog/index.astro](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/src/apps/astro/src/pages/es/blog/index.astro) con `39` assets
- [templates/partials/tele-body-main.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/templates/partials/tele-body-main.html) con `30` assets
- [index.html](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/index.html) con `8` assets
- [src/apps/astro/src/lib/public-v2.js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/src/apps/astro/src/lib/public-v2.js) con `8` assets
- [src/apps/astro/src/components/HeroMediaRail.astro](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/src/apps/astro/src/components/HeroMediaRail.astro) con `6` assets

Observacion:

- un `rg` global del repo devuelve muchas referencias extra en mirrors generados como `.generated/site-root/**`, `en/**`, `es/**` y worktrees bajo `.codex-worktrees/**`
- esos archivos no se usaron para decidir si una imagen sigue viva, porque inflan artificialmente el conteo de HTML/CSS activo

## Familias WebP huerfanas mas grandes

Cada una de estas familias conserva muchas variantes responsive pero ya no tiene referencia exacta en runtime web vivo:

- `hero-woman` (`7` `.webp`)
- `v6-clinic-botox` (`7` `.webp`)
- `v6-clinic-cicatrices` (`7` `.webp`)
- `v6-clinic-dermatologia-pediatrica` (`7` `.webp`)
- `v6-clinic-granitos-brazos-piernas` (`7` `.webp`)
- `v6-clinic-home-followup` (`7` `.webp`)
- `v6-clinic-home-remote-handoff` (`7` `.webp`)
- `v6-clinic-hub-care-handoff` (`7` `.webp`)
- `v6-clinic-hub-clinical-ladder` (`7` `.webp`)
- `v6-clinic-hub-remote-entry` (`7` `.webp`)
- `v6-clinic-legal-governance` (`7` `.webp`)
- `v6-clinic-mesoterapia` (`7` `.webp`)

## Lista exacta de WebP huerfanas

El inventario exacto de las `199` `.webp` huerfanas quedo en:

- [docs/IMAGES_AUDIT_ORPHANED_WEBP.txt](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/docs/IMAGES_AUDIT_ORPHANED_WEBP.txt)

Notas:

- el listado no implica borrado automatico; solo deja evidencia para una limpieza posterior
- `verification_failed.webp` tambien aparece como huerfana en runtime actual
