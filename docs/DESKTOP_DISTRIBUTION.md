# Desktop Distribution Audit

Fecha de auditoría: 2026-03-30

## Resumen ejecutivo

- `app-downloads/index.php` es público.
- Hoy el canal publicado real contiene solo el piloto Windows de `operator`.
- `kiosk` y `sala_tv` aparecen en el catálogo por defaults del registry, pero no
  tienen manifiestos ni artefactos publicados en este repo.
- Los checksums del bundle `pilot/operator/win` son consistentes entre
  `release-manifest.json`, `SHA256SUMS.txt`, `app-downloads/` y
  `desktop-updates/`.
- Riesgo operativo actual: el comando local
  `npm run turnero:verify:pilot:local` apunta a
  `bin/verify-turnero-release-bundle.js`, archivo que hoy no existe.

## Superficies y endpoints

### `app-downloads/`

Entrypoint:

- `/app-downloads`
- `/app-downloads/`
- reescrito por Caddy a `/app-downloads/index.php`

Implementación:

- [app-downloads/index.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/app-downloads/index.php)
- [ops/caddy/Caddyfile](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/ops/caddy/Caddyfile)

Estado:

- Público. No hay guard de auth en PHP.
- `Caddyfile` lo trata como `publicPhp` y aplica rewrite directo.

Qué sirve:

- Centro de instalación para `operator`, `kiosk` y `sala_tv`.
- URLs preparadas por superficie.
- Enlaces de descarga manual (`app-downloads/...`).
- Feed o payload de auto-update (`desktop-updates/...`) cuando aplique.

Quién lo llama:

- Soporte u operación manual desde navegador.
- El shell desktop como `guideUrl` de soporte:
  [src/apps/turnero-desktop/src/config/contracts.mjs](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/src/apps/turnero-desktop/src/config/contracts.mjs)
- La capa pública V6 usa esos `guideUrl`:
  [src/apps/astro/src/lib/public-v6.js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/src/apps/astro/src/lib/public-v6.js)
- Scripts/checklists operativos del piloto Windows:
  [scripts/ops/turnero/README.md](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/scripts/ops/turnero/README.md)

### `desktop-updates/`

Entrypoints publicados hoy:

- `/desktop-updates/pilot/operator/win/latest.yml`
- `/desktop-updates/pilot/operator/win/TurneroOperadorSetup.exe`
- `/desktop-updates/pilot/operator/win/TurneroOperadorSetup.exe.blockmap`

Qué sirve:

- Feed y payload de auto-update para Electron desktop.

Quién lo llama:

- La app `Turnero Operador` vía `updateBaseUrl`:
  [src/apps/turnero-desktop/README.md](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/src/apps/turnero-desktop/README.md)
- Config runtime del shell:
  [src/apps/turnero-desktop/src/config/contracts.mjs](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/src/apps/turnero-desktop/src/config/contracts.mjs)

## Inventario publicado hoy

Archivos presentes en el repo:

- `app-downloads/app-downloads.css`
- `app-downloads/app-downloads.js`
- `app-downloads/index.php`
- `app-downloads/pilot/release-manifest.json`
- `app-downloads/pilot/SHA256SUMS.txt`
- `app-downloads/pilot/operator/win/TurneroOperadorSetup.exe`
- `app-downloads/pilot/operator/win/TurneroOperadorSetup.exe.blockmap`
- `desktop-updates/pilot/operator/win/latest.yml`
- `desktop-updates/pilot/operator/win/TurneroOperadorSetup.exe`
- `desktop-updates/pilot/operator/win/TurneroOperadorSetup.exe.blockmap`

No hay artefactos publicados en este repo para:

- `app-downloads/stable/kiosk/*`
- `app-downloads/stable/sala-tv/*`
- `desktop-updates/stable/kiosk/*`
- `desktop-updates/stable/operator/*`

## Versiones servidas

Catálogo resuelto hoy por PHP:

- `operator`
    - `version=0.1.0`
    - `updatedAt=2026-03-13T06:23:55.502Z`
    - `win` resuelto desde manifest real `pilot`
    - `mac` queda solo como URL default `pilot`, sin artefacto publicado
- `kiosk`
    - `version=0.1.0`
    - `updatedAt=""`
    - targets `stable` construidos desde registry, sin manifest real presente
- `sala_tv`
    - `version=0.1.0`
    - `updatedAt=""`
    - target `stable` construido desde registry, sin APK publicada en este repo

Fuente:

- [lib/AppDownloadsCatalog.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/lib/AppDownloadsCatalog.php)
- [data/turnero-surfaces.json](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/data/turnero-surfaces.json)

## Checksums

Archivos de integridad disponibles hoy:

- [app-downloads/pilot/SHA256SUMS.txt](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/app-downloads/pilot/SHA256SUMS.txt)
- [app-downloads/pilot/release-manifest.json](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/app-downloads/pilot/release-manifest.json)

Validación local observada:

- `TurneroOperadorSetup.exe` en `app-downloads/` y `desktop-updates/` comparte
  el mismo SHA-256:
  `42be7ebb5bf5442d5df8f51c4dbbd4ffac6ee584a45c36038115bf5ed95ed5cf`
- `SHA256SUMS.txt` también cubre:
    - `TurneroOperadorSetup.exe.blockmap`
    - `desktop-updates/pilot/operator/win/latest.yml`
    - copia del instalador y blockmap en `desktop-updates/`

Conclusión:

- El bundle actual de `operator/win` sí tiene checksum verificable.
- `kiosk` y `sala_tv` no pueden considerarse publicados/verificados desde este
  repo porque no hay artefactos reales presentes.

## Cómo decide qué mostrar `app-downloads/index.php`

Orden de resolución:

1. Defaults desde el registry:
   [data/turnero-surfaces.json](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/data/turnero-surfaces.json)
2. Overrides opcionales:
   [content/app-downloads/catalog.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/content/app-downloads/catalog.php)
3. Manifiestos publicados por canal detectados en `app-downloads/*/release-manifest.json`

Impacto práctico:

- `operator` sí queda respaldado por manifest real `pilot`.
- `kiosk` y `sala_tv` quedan visibles por defaults aunque no exista publicación
  real en filesystem.
- La UI cliente sí hace probes HTTP de descarga, ruta preparada y feed, por lo
  que debería marcar esos casos como pendientes, no como listos:
  [app-downloads/app-downloads.js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/app-downloads/app-downloads.js)

## Riesgos

### Riesgo 1: centro público sin auth

Estado:

- Intencionalmente público.

Riesgo:

- Cualquier usuario puede descubrir nombres de artefactos y feeds publicados.

Mitigación actual:

- El canal contiene instaladores, no credenciales.
- Los checks de readiness del front evitan presentar silencio total frente a
  rutas caídas.

### Riesgo 2: catálogo mezcla defaults con publicación real

Estado:

- `read_app_downloads_catalog()` mezcla registry y manifest.

Riesgo:

- `kiosk` y `sala_tv` pueden aparecer con URLs plausibles aunque no exista el
  archivo real detrás.

Mitigación actual:

- `app-downloads.js` hace probes y degrada el estado si la descarga o el feed
  no responden.

Mejora recomendada:

- Diferenciar explícitamente `registry-only` vs `published` en el payload.

### Riesgo 3: verify local roto

Estado:

- `npm run turnero:verify:pilot:local` falla con `MODULE_NOT_FOUND` porque falta
  `bin/verify-turnero-release-bundle.js`.

Riesgo:

- Existe staging con checksum, pero falta el verificador canónico local para
  ese bundle.

Mejora recomendada:

- Reponer `bin/verify-turnero-release-bundle.js` o cambiar el script npm a la
  ruta correcta si el archivo fue movido.

## Veredicto

- `app-downloads/index.php` es público y sirve hoy como centro real de soporte
  para distribución desktop.
- El único release realmente publicado/verificable dentro del repo es
  `pilot/operator/win`.
- Los checksums del bundle actual están bien.
- El mayor gap no es de seguridad inmediata sino de consistencia operativa:
  catálogo con defaults sin artefacto real para otras superficies y verificador
  local faltante para el bundle stageado.
