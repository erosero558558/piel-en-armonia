# Release Artifact Single Source

Este documento establece la política "Single Source of Truth" (SSOT) para todo artefacto binario generado, con el fin de optimizar el peso del repositorio, reducir la duplicación de red, y prever inconsistencias de despliegue.

## Entendiendo la Distribución

Actualmente existen dos principales rutas web servidas para distribuir el turnero:
1. `app-downloads/`: Los instaladores canónicos expuestos públicamente (`.exe`, `.dmg`, `.apk`) que sirven tanto como caída base para la navegación humana cómo para distribución IT explícita.
2. `desktop-updates/`: La vía técnica destinada íntegramente a servir parches a través del componente auto-updater de Electron (`latest.yml`, payloads parciales/completos, `.blockmap`).

## Política de Alias (Symlink)

Ya que usualmente el mismo macro-instalador (ej. `TurneroOperadorSetup.exe`) servido en `app-downloads/` opera idénticamente como el payload del proceso de auto-actualización consumible desde `desktop-updates/`, **se prohíbe la duplicación física de bytes** entre estas dos rutas de disco.

*   El binario de instalación residirá **siempre** y **exclusivamente** dentro de la carpeta `app-downloads/`.
*   Cualquier invocación bajo `desktop-updates/` a un payload que exceda 1 MB debe estar materialmente resuelta mediante un **symlink relativo** atado a Git. (ej. `TurneroOperadorSetup.exe -> ../../../../app-downloads/pilot/operator/win/TurneroOperadorSetup.exe`). 
*   Esta política también cubre los sub-artefactos gruesos como los archivos `.blockmap`.

## Scripts de Integridad (Cross-Checksum)

Para prevenir regresiones silentes:
1.  **`bin/assert-release-single-source.js`**: Revisa imperativamente que los directorios espejo como `desktop-updates` usen una referencia simbólica que cuadre exactamente con el _digest_ SHA-256 de `app-downloads/`. En caso de encontrar duplicación costosa o una discrepancia criptográfica entre canales del mismo release, el workflow de CI fallará (exit 1).
2.  **Transacciones Temporales**: Carpetas efímeras locales con resultados "raw" del pipeline como `release/` deben limpiarse del entorno o ser ignoradas en PRs para evitar un commit accidental de clones pesados.
