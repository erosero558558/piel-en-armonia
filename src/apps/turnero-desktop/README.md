# Turnero Desktop

Shells de escritorio para separar el uso operativo del turnero sin duplicar el backend PHP actual.

## Superficies

- `Turnero Operador` carga `https://pielarmonia.com/operador-turnos.html`
- `Turnero Kiosco` carga `https://pielarmonia.com/kiosco-turnos.html`

Ambas aplicaciones se conectan al mismo backend central por `api.php`.

## Requisitos

- Node.js 20+
- npm 10+

## Instalacion local

```bash
cd src/apps/turnero-desktop
npm install
```

## Desarrollo

```bash
npm run dev:operator
npm run dev:kiosk
```

Overrides utiles:

```bash
TURNERO_BASE_URL=http://localhost:8000 npm run dev:operator
TURNERO_LAUNCH_MODE=windowed npm run dev:kiosk
```

Las variables `TURNERO_*` tienen prioridad sobre `package.json`, para poder probar `operator` y `kiosk` desde la misma base sin duplicar proyecto.

## Builds

```bash
npm run build:operator:win
npm run build:operator:mac
npm run build:kiosk:win
npm run build:kiosk:mac
```

Artefactos esperados:

- `dist/operator/win/TurneroOperadorSetup.exe`
- `dist/operator/mac/TurneroOperador.dmg`
- `dist/kiosk/win/TurneroKioscoSetup.exe`
- `dist/kiosk/mac/TurneroKiosco.dmg`

## Configuracion local

En el primer arranque la app escribe `turnero-desktop.json` en `userData`.

Campos soportados:

```json
{
  "surface": "operator",
  "baseUrl": "https://pielarmonia.com",
  "launchMode": "fullscreen",
  "autoStart": true,
  "updateChannel": "stable",
  "updateBaseUrl": "https://pielarmonia.com/desktop-updates/"
}
```

`surface` viene fijado por el build. Si el archivo se edita manualmente, la app conserva el `surface` empaquetado.

En builds empaquetados se desactivan DevTools para endurecer el shell operativo.

## Auto-update

La app consulta updates en:

```text
<updateBaseUrl>/<updateChannel>/<surface>/<platform>/
```

Estructura esperada:

```text
desktop-updates/
  stable/
    operator/
      win/
      mac/
    kiosk/
      win/
      mac/
```

## QA manual minima

- Operador abre la URL correcta y deja visible el flujo del numpad.
- Kiosco abre la URL correcta y queda en fullscreen.
- Navegacion externa bloqueada.
- Reconexion tras caida de red.
- Numpad Genius 1000 llama/repite/completa sin interferir con `Enter` del teclado principal.
- Impresion termica en kiosco.
