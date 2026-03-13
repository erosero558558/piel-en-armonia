# Turnero Ops Scripts

Implementaciones canonicas para release smoke y checklist operativo de las apps
nativas del turnero.

Entrypoints:

- `CHECKLIST-OPERADOR-WINDOWS-PILOTO.ps1`
- `PUBLICAR-OPERADOR-WINDOWS-PILOTO.ps1`

Superficies npm:

- `npm run checklist:turnero:operator:pilot`
- `npm run publish:turnero:operator:pilot`
- `npm run turnero:stage:pilot:local`
- `npm run turnero:verify:pilot:local`

`checklist:turnero:operator:pilot` valida el bundle local del piloto Windows
del operador, puede comprobar las rutas publicadas con `-ServerBaseUrl` y deja
el smoke manual listo para recepcion o consultorio.

`publish:turnero:operator:pilot` publica solo los archivos canonicos del piloto
Windows (`app-downloads/pilot` y `desktop-updates/pilot` del operador) usando
`FTP_SERVER`, `FTP_USERNAME` y `FTP_PASSWORD`. Soporta `-DryRun` y valida el
bundle antes de subirlo.
