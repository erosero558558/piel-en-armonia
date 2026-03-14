# Runbook de Release de Apps Turnero

## Objetivo

Publicar `Turnero Operador`, `Turnero Kiosco` y `Turnero Sala TV` sin degradar el flujo clínico del operador en Windows.

Prioridad operativa actual:

1. `Turnero Operador` para Windows en canal `pilot`
2. `Turnero Kiosco` en canal `stable`
3. `Turnero Sala TV` en Android TV

El piloto de `Operador` está pensado para 1-2 equipos Windows de recepción o consultorio. La meta no es solo entregar un instalador: el equipo debe quedar listo para operar con perfil clínico, Genius Numpad 1000 validado y recuperación segura ante caída de red.

Mientras el `clinic-profile` activo siga en `release.mode=web_pilot`, el gate canónico del frente es `npm run gate:turnero:web-pilot`. `npm run gate:turnero` queda para el release ampliado que tambien incluye el carril nativo.

## Rutas objetivo

Piloto Windows de Operador:

- `/app-downloads/pilot/operator/win/TurneroOperadorSetup.exe`
- `/desktop-updates/pilot/operator/win/latest.yml`

Release estable vigente:

- `/app-downloads/stable/operator/mac/TurneroOperador.dmg`
- `/app-downloads/stable/kiosk/win/TurneroKioscoSetup.exe`
- `/app-downloads/stable/kiosk/mac/TurneroKiosco.dmg`
- `/app-downloads/stable/sala-tv/android/TurneroSalaTV.apk`
- `/desktop-updates/stable/operator/mac/latest-mac.yml`
- `/desktop-updates/stable/kiosk/win/latest.yml`
- `/desktop-updates/stable/kiosk/mac/latest-mac.yml`

## Activos canonicos relacionados

- `.github/workflows/release-turnero-apps.yml`
- `data/turnero-surfaces.json`
- `docs/TURNERO_NATIVE_SURFACES.md`

## Preparacion previa

Antes de publicar cualquier build:

- Confirmar `base_url` pública de `operador-turnos.html`, `kiosco-turnos.html` y `sala-turnos.html`.
- Confirmar `update_base_url` pública de `desktop-updates/`.
- Para `Operador`, validar que `updateChannel` sea `pilot` en el build del piloto Windows.
- Confirmar que `app-downloads/` muestre `Operador Windows` como ruta recomendada para el piloto.
- Tener claro el consultorio del equipo piloto: `C1`, `C2` o `modo libre`.

## Workflow canonico

Trigger:

- `workflow_dispatch`

Inputs clave:

- `release_version`: versión semver común para desktop y Android TV
- `base_url`: URL pública de las superficies web
- `update_base_url`: base pública de `desktop-updates/`
- `publish_to_hosting`: publica el bundle al hosting usando `FTP_*`
- `publish_github_release`: adjunta el bundle a un GitHub Release
- `dry_run`: valida bundle y upload sin publicar

Flujo:

0. `resolve-release-plan`
    - deriva matrices desktop/android desde `data/turnero-surfaces.json`
1. `build-desktop`
    - compila `Operador` y `Kiosco` en Windows y macOS
    - genera instaladores y metadatos de auto-update
2. `build-android`
    - compila la APK release de Android TV
3. `package-release`
    - arma bundle publicable con `app-downloads/` y `desktop-updates/`
    - genera `release-manifest.json` y `SHA256SUMS.txt`
4. `publish-to-hosting` opcional
    - sube el bundle a `server_dir`
5. `publish-github-release` opcional
    - adjunta el bundle al release/tag seleccionado

Nota operativa:

- El workflow ahora empaqueta un bundle mixto por superficie: `operator -> pilot`, `kiosk -> stable`, `sala_tv -> stable`.
- Si alguna vez se necesita forzar una release íntegra en `stable`, el staging local soporta `--channel stable`.

## Validacion local antes del workflow

Mínimo recomendado:

- `npm run gate:turnero:web-pilot`
- `npm run gate:turnero`
- `npm run turnero:release:plan`
- `npm run test:turnero:php-contract`
- `node --test tests-node/turnero-surface-registry.test.js tests-node/resolve-turnero-release-plan.test.js tests-node/stage-turnero-app-release-script.test.js tests-node/release-turnero-apps-workflow-contract.test.js`
- `node --test tests-node/app-downloads-catalog-registry-contract.test.js tests-node/admin-data-app-downloads-contract.test.js tests-node/public-v6-software-native-apps-contract.test.js`
- `npx playwright test tests/queue-display.spec.js tests/admin-queue.spec.js tests/queue-kiosk.spec.js tests/queue-integrated-flow.spec.js --workers=1`

Notas:

- `npm run gate:turnero:web-pilot` valida el piloto web por clínica sin reabrir como blocker el bundle/operator pilot nativo.
- `npm run gate:turnero` es el gate rápido canónico del frente; si falla, no avanzar al workflow.
- Para la ola actual del piloto web, leer `npm run gate:turnero` como gate ampliado del release nativo, no como sustituto del carril web-pilot.
- La ruta PHP oficial del contrato `/data` + `appDownloads` es `npm run test:turnero:php-contract`.
- La corrida integrada de las cuatro superficies del turnero debe ejecutarse en `--workers=1` para evitar flake por estado compartido del servidor local y del store de pruebas.

## Checklist minimo antes de publicar

- `release_version` usa `major.minor.patch`
- el registry canónico está actualizado antes de correr release
- el instalador Windows de `Operador` abre el boot clínico y no una ventana genérica
- el shell de `Operador` muestra `updateChannel=pilot` en el piloto
- `turnero-desktop.json` y `turnero-shell-state.json` se crean correctamente en `userData`
- `Operador` muestra barra persistente con `live/offline/safe`, último sync, outbox y conciliación
- offline solo permite `llamar`, `re-llamar`, `completar` y `no-show`
- login offline sigue bloqueado
- si existe reconciliación pendiente, la app vuelve a `safe` y no habilita nuevo offline operativo
- el workflow genera `turnero-apps-release-bundle`
- `release-manifest.json` contiene `operator`, `kiosk` y `sala_tv`
- `publish_to_hosting=true` solo después de revisar el bundle o correr `dry_run`

## Checklist de primer arranque en Windows

Validar en el equipo piloto:

1. La app abre en fullscreen o modo operativo esperado.
2. El onboarding pide:
    - servidor
    - perfil de consultorio (`C1`, `C2` o libre)
    - validación de Genius Numpad 1000
3. La pantalla de boot deja visible:
    - modo `live`, `offline` o `safe`
    - edad del último sync sano
    - tamaño del outbox
    - conflictos de conciliación
    - canal de update
4. `F10` o `Ctrl/Cmd + ,` abre reconfiguración sin romper la operación.

## Dry run local del bundle

Cuando ya existan artefactos reales locales o descargados desde GitHub Actions:

```bash
node bin/stage-turnero-app-release.js \
  --version 0.1.0 \
  --desktopRoot artifacts/desktop \
  --androidRoot artifacts/android \
  --outputRoot release/turnero-apps
```

Para pilotar solo `Operador Windows` desde una máquina Windows con el build local ya generado:

```bash
npm run turnero:stage:pilot:local
```

Verificacion canonica del bundle antes de publicar:

```bash
npm run turnero:verify:pilot:local
```

Checklist operativo del piloto Windows:

```bash
npm run checklist:turnero:operator:pilot
```

Publicacion local del bundle `pilot` del operador:

```bash
npm run publish:turnero:operator:pilot -- -DryRun
```

Equivale a:

```bash
node bin/stage-turnero-app-release.js \
  --version 0.1.0 \
  --surface operator \
  --target win \
  --desktopRoot src/apps/turnero-desktop/dist \
  --outputRoot release/turnero-apps-pilot-local
```

Validar siempre:

- `release/turnero-apps/app-downloads/pilot/release-manifest.json`
- `release/turnero-apps/app-downloads/stable/release-manifest.json`
- `release/turnero-apps/app-downloads/stable/SHA256SUMS.txt`
- `release/turnero-apps/app-downloads/pilot/SHA256SUMS.txt`
- `release/turnero-apps/desktop-updates/pilot/**`
- `release/turnero-apps/desktop-updates/stable/**`
- que `admin.html#queue` y `/app-downloads/` muestren versión y URLs reales a partir del manifest, no solo defaults del registry
- `npm run turnero:verify:bundle -- --outputRoot release/turnero-apps`
- `npm run checklist:turnero:operator:pilot -- -ServerBaseUrl https://pielarmonia.com` cuando el piloto ya este publicado

Publicacion real con credenciales del hosting ya cargadas en el entorno local:

```bash
npm run publish:turnero:operator:pilot -- -ServerBaseUrl https://pielarmonia.com
```

Gate del hosting despues de publicar:

```bash
npm run verify:prod:turnero:web-pilot
npm run smoke:prod:turnero:web-pilot
npm run gate:prod:turnero:web-pilot
npm run verify:prod:turnero:operator:pilot
npm run smoke:prod:turnero:operator:pilot
```

Notas:

- El carril `web-pilot` valida solo `clinic-profile`, `verify-remote`, `publicSync` y las superficies web (`admin/operator/kiosk/display`).
- El carril `operator:pilot` agrega `app-downloads`, `desktop-updates` e instalador Windows; usarlo solo cuando el release ampliado tambien incluya el carril nativo.

Variables esperadas:

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- opcionales: `FTP_PROTOCOL`, `FTP_SERVER_PORT`, `FTP_SECURITY`, `FTP_SERVER_DIR`

## Smoke recomendado del piloto clinico

- instalar `Turnero Operador` en Windows y completar onboarding
- validar Genius Numpad 1000 con la primera tecla operativa
- correr flujo real `llamar / re-llamar / completar / no-show`
- probar `C1 fijo`, `C2 fijo` y `modo libre`
- probar `one-tap` encendido y apagado
- simular caída de red con sesión ya iniciada
- confirmar transición `online -> offline -> replay -> online`
- confirmar que un cold start offline sin sesión previa entra en `safe`
- forzar conflicto de replay y confirmar que el item queda en conciliación
- confirmar auto-update desde canal `pilot`

## Smoke recomendado post-release estable

- `Operador` instala y abre `operador-turnos.html`
- `Kiosco` instala y abre `kiosco-turnos.html`
- `Sala TV` instala la APK y abre `sala-turnos.html`
- `admin.html#queue` muestra la versión de release correcta
- `app-downloads/` entrega el instalador correcto por plataforma
- `app-downloads/` marca `Listo para instalación` solo si la descarga y la ruta preparada responden
- `desktop-updates/` responde `latest.yml` y `latest-mac.yml`
- el shell desktop muestra `Equipo listo` al pasar el checklist de arranque

## Soporte y diagnostico

Archivos locales relevantes en `userData`:

- `turnero-desktop.json`
- `turnero-shell-state.json`

Qué revisar en soporte:

- `lastSuccessfulSyncAt`
- `snapshotAgeSec`
- `outboxSize`
- `reconciliation`
- `updateChannel`

Guardrail de privacidad:

- no guardar PII nueva en outbox o conciliación
- usar solo ticket, consultorio, timestamps y tipo de acción

## Cierre operativo

No marcar el frente como cerrado hasta completar todo esto:

- bundle local o de workflow validado con manifest y checksums
- smoke real en `Operador` Windows del piloto y, cuando aplique, `Kiosco` Win/mac y `Sala TV` Android TV
- verificación visual en `admin.html#queue` y `/app-downloads/`
- evidencia escrita en `verification/agent-runs/`
