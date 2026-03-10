# Runbook de Release de Apps Turnero

## Objetivo

Publicar `Turnero Operador`, `Turnero Kiosco` y `Turnero Sala TV` con un solo workflow, dejando listas estas rutas en produccion:

- `/app-downloads/stable/operator/win/TurneroOperadorSetup.exe`
- `/app-downloads/stable/operator/mac/TurneroOperador.dmg`
- `/app-downloads/stable/kiosk/win/TurneroKioscoSetup.exe`
- `/app-downloads/stable/kiosk/mac/TurneroKiosco.dmg`
- `/app-downloads/stable/sala-tv/android/TurneroSalaTV.apk`
- `/desktop-updates/stable/operator/win/latest.yml`
- `/desktop-updates/stable/operator/mac/latest-mac.yml`
- `/desktop-updates/stable/kiosk/win/latest.yml`
- `/desktop-updates/stable/kiosk/mac/latest-mac.yml`

## Workflow canonico

Archivo:

- `.github/workflows/release-turnero-apps.yml`

Trigger:

- `workflow_dispatch`

Inputs clave:

- `release_version`: version semver comun para desktop y Android TV
- `base_url`: URL publica de `operador-turnos.html`, `kiosco-turnos.html` y `sala-turnos.html`
- `update_base_url`: base publica de `desktop-updates/`
- `publish_to_hosting`: publica el bundle final al hosting usando `FTP_*`
- `publish_github_release`: adjunta el bundle a un GitHub Release
- `dry_run`: valida el bundle y el upload sin subir archivos reales al hosting

## Flujo

1. `build-desktop`
   - compila `Operador` y `Kiosco` en Windows y macOS
   - genera instaladores y metadatos de auto-update
2. `build-sala-tv`
   - compila la APK release de Android TV
3. `package-release`
   - arma un bundle publicable con `app-downloads/` y `desktop-updates/`
   - genera `app-downloads/stable/release-manifest.json`
   - genera `app-downloads/stable/SHA256SUMS.txt`
4. `publish-to-hosting` opcional
   - sube el bundle a `server_dir`
5. `publish-github-release` opcional
   - adjunta el bundle al release/tag seleccionado

## Manifest y catalogo

El bundle incluye:

- `app-downloads/stable/release-manifest.json`

`lib/AppDownloadsCatalog.php` intenta leer ese archivo en tiempo de ejecucion.
Si existe en el servidor, el admin y el centro de instalacion muestran version y URLs reales sin editar `content/app-downloads/catalog.php`.

## Secrets requeridos para hosting

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`

Variables operativas opcionales via input manual:

- `protocol`: `ftps | ftp | sftp`
- `server_port`
- `security`
- `server_dir`

## Checklist minimo

- `release_version` usa `major.minor.patch`
- el workflow genera `turnero-apps-release-bundle`
- `release-manifest.json` contiene `operator`, `kiosk` y `sala_tv`
- `publish_to_hosting=true` solo despues de revisar el bundle o correr `dry_run`
- si se publica a hosting, verificar descargas desde `admin.html#queue`
- si se publica desktop, verificar auto-update contra `desktop-updates/stable/...`

## Smoke recomendado post-release

- `Operador` instala y abre `operador-turnos.html`
- `Kiosco` instala y abre `kiosco-turnos.html`
- `Sala TV` instala la APK y abre `sala-turnos.html`
- `admin.html#queue` muestra la version de release correcta
- `app-downloads/` entrega el instalador correcto por plataforma
- `app-downloads/` marca `Listo para instalación` solo si la descarga y la ruta preparada responden
- `desktop-updates/` responde `latest.yml` y `latest-mac.yml`
- el shell desktop muestra `Equipo listo` al pasar el checklist de arranque
