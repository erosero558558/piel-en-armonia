# Turnero native surfaces - DoD closure 2026-03-21

Fecha: 2026-03-21
Owner: Ernesto
Executor: codex

## Objetivo

Cerrar la evidencia documental de las superficies nativas del Turnero sin tocar runtime ni board. La fuente canonica de aceptacion queda en `docs/TURNERO_NATIVE_SURFACES.md` y el flujo operativo en `docs/RUNBOOK_TURNERO_APPS_RELEASE.md`.

## Canonical docs actualizados

- `docs/TURNERO_NATIVE_SURFACES.md` ya deja la DoD canonica de superficie nativa.
- `docs/RUNBOOK_TURNERO_APPS_RELEASE.md` ahora referencia esa DoD y se limita al flujo operativo.

## Build real

El build real del operador Windows ya estaba presente en el workspace bajo:

- `src/apps/turnero-desktop/dist/operator/win/TurneroOperadorSetup.exe`
- `src/apps/turnero-desktop/dist/operator/win/latest.yml`
- `src/apps/turnero-desktop/dist/operator/win/stable.yml`
- `src/apps/turnero-desktop/dist/operator/win/TurneroOperadorSetup.exe.blockmap`

Ese conjunto fue el input local del staging del bundle nativo.

## Dry run con `stage-turnero-app-release.js`

Comando ejecutado:

```powershell
node bin/stage-turnero-app-release.js --version 0.1.0 --surface operator --target win --desktopRoot src/apps/turnero-desktop/dist --outputRoot C:\Users\Ernesto\AppData\Local\Temp\turnero-native-dod-20260321035312\bundle --releasedAt 2026-03-21T00:00:00Z
```

Resultado resumido:

- version: `0.1.0`
- channel: `pilot`
- surfaces: `operator`
- targets: `win`
- manifest: `C:\Users\Ernesto\AppData\Local\Temp\turnero-native-dod-20260321035312\bundle\app-downloads\pilot\release-manifest.json`
- fileCount: `7`

## `release-manifest.json`

El manifest del dry run resolvio rutas reales para el operador:

- `baseUrl`: `https://pielarmonia.com`
- `guideUrl`: `/app-downloads/?surface=operator`
- `targets.win.url`: `/app-downloads/pilot/operator/win/TurneroOperadorSetup.exe`
- `updates.win.feedUrl`: `/desktop-updates/pilot/operator/win/latest.yml`
- `updates.win.payloadUrl`: `/desktop-updates/pilot/operator/win/TurneroOperadorSetup.exe`

Tambien quedaron incluidos los archivos auxiliares:

- `/app-downloads/pilot/operator/win/TurneroOperadorSetup.exe.blockmap`
- `/desktop-updates/pilot/operator/win/TurneroOperadorSetup.exe.blockmap`

## `admin.html#queue` y `/app-downloads/`

La evidencia de piloto ya publicada sigue mostrando las rutas canonicas del clinic-profile:

- `verification/deploy-23099012555/turnero-pilot-status.json`
- `verification/deploy-23099012555/turnero-pilot-remote.json`

Esos artefactos confirman:

- `admin.html#queue` como ruta publica del admin
- `operador-turnos.html`, `kiosco-turnos.html` y `sala-turnos.html` como superficies web activas
- `release.mode=web_pilot`

La checklist local del bundle valido lo siguiente:

- `operador-turnos.html` publico: `200`
- feed pilot publicado: `200`
- instalador pilot publicado: `200`
- centro de descargas `operador/win`: `502`

## Smoke manual en hardware objetivo

No se registro smoke manual fisico en hardware objetivo desde este workspace.

Eso deja el criterio de hardware como pendiente real, no como supuesto. La DoD canonica ya lo exige y esta nota no lo maquilla.

## Runbook usado

- `docs/RUNBOOK_TURNERO_APPS_RELEASE.md`

## Validacion ejecutada

- `node --test tests-node/stage-turnero-app-release-script.test.js tests-node/app-downloads-catalog-registry-contract.test.js tests-node/admin-data-app-downloads-contract.test.js tests-node/public-v6-software-native-apps-contract.test.js`
- `node bin/verify-turnero-release-bundle.js --outputRoot C:\Users\Ernesto\AppData\Local\Temp\turnero-native-dod-20260321035312\bundle --channel pilot --surface operator --target win --version 0.1.0`
- `powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/ops/turnero/CHECKLIST-OPERADOR-WINDOWS-PILOTO.ps1 -BundleRoot C:\Users\Ernesto\AppData\Local\Temp\turnero-native-dod-20260321035312\bundle -ServerBaseUrl https://pielarmonia.com -Format markdown -OutputPath C:\Users\Ernesto\AppData\Local\Temp\turnero-native-dod-20260321035312\checklist.md`

Resultado:

- los 4 contratos Node relevantes pasaron
- el verificador del bundle reporto `OK`
- la checklist dejo el bundle local en verde y solo fallo el centro de descargas `operador/win` con `502`

## Veredicto

La documentacion de la DoD nativa quedo cerrada y trazable. El bundle local es valido, las rutas reales quedaron resueltas en el manifest y la evidencia publica sigue apuntando al clinic-profile correcto. El unico cierre que sigue abierto es el smoke manual fisico en hardware objetivo.
