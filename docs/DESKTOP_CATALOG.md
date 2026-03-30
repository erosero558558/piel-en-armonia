# Desktop Catalog Truth

Este documento define la política oficial del catálogo de descargas de aplicaciones de escritorio (`app-downloads`) y aplicaciones de Android (APK) interactivas para Aurora Derm.

## Estados del Catálogo (`status`)

Para eliminar entradas "fantasmas" y falsos positivos al intentar descargar instaladores que aún no existen, cada registro en el archivo principal `data/turnero-surfaces.json` (procesado luego por `lib/TurneroSurfaceRegistry.php`) debe definir explícitamente su viabilidad de descarga bajo la propiedad `status`:

- **`published`**: Existe un artefacto nativo plenamente compilado (ej. `.exe`, `.dmg`, `.apk`) listo para descargarse en la ruta respectiva de `app-downloads/` o `desktop-updates/`.
- **`registry_only`**: El módulo existe computacionalmente (tiene telemetría, web fallback, IDs de superficie), pero carece momentáneamente de instalador compilado propio. Se muestra en la UI etiquetado como "En Desarrollo", bloqueando descargas.
- **`missing`**: Estado de fallback dinámico cuando el registro sufre una alteración manual o se procesa mal la lectura; el sistema asume preventivamente `registry_only`.

## Tabla de Verdad — Superficies Activas (Q2 2026)

| Superficie | Identificador | Familia | Estado (`status`) | Fallback Web | Artefacto Pipeline |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Turnero Operador** | `operator` | `desktop` | `published` | `/operador-turnos.html` | `TurneroOperadorSetup.exe` |
| **Turnero Kiosco** | `kiosk` | `desktop` | `registry_only` | `/kiosco-turnos.html`| `TurneroKioscoSetup.exe` |
| **Sala TV** | `sala_tv` | `android` | `registry_only` | `/sala-turnos.html`  | `TurneroSalaTV.apk` |

## Consideración Operativa

Cuando una superficie como `kiosk` reciba su instalador oficial en el canal correspondiente:
1. Posicione el ejecutable compilado adecuadamente.
2. Modifique el manifiesto estático en `data/turnero-surfaces.json` cambiando la llave a `"status": "published"`.
3. La página de soporte reflejará en vivo interactividad plena de descarga.
