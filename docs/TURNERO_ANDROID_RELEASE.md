# Turnero Android TV Release Workflow

Este documento describe el proceso determinista y automatizado para generar y publicar la release oficial (`APK`) de la aplicación de Android TV de Aurora Derm ("TurneroSalaTV").

## Requisitos Previos (Prerequisites)
1. Entorno de desarrollo con **Java JDK 17** instalado y configurado bajo `$JAVA_HOME`.
2. **Android SDK** instalado (idealmente a través de Android Studio o `sdkmanager` CLI).
3. Permisos de escritura en el directorio `./public/downloads/` del proyecto, ya que allí se alojarán de forma pública los binarios persistidos.

## Creación Automática de la Release
El script automatizado `bin/release-android-tv.sh` abstrae todo el proceso de compilación nativa en un archivo listo para descargar:
1. Navega hacia el contexto en `/src/apps/turnero-sala-tv-android`.
2. Ejecuta el daemon de gradle para el task de release (`./gradlew assembleRelease`).
3. Valida la salida limpia de Gradle.
4. Genera el **SHA-256 checksum** para validación rigurosa de integridad.
5. Emite de forma sincronizada los ficheros:
   - `public/downloads/TurneroSalaTV-<VERSION>-<CHECKSUM>.apk`
   - Un alias canónico siempre actualizado hacia `public/downloads/TurneroSalaTV.apk` capaz de ser expuesto a los TVs sin modificar las URLs de auto-deploy.
   
## Firma del APK (Signing Strategy)
Actualmente, debido a la infraestructura compartida, el proyecto inyectará las llaves de Android estándar o un Dummy debug keystore automatizado mediante variables de entorno si se configuran a nivel runner, sino Android `assembleRelease` intentará utilizar la convención local.

## Verificación de Status
Tras la descarga local en tu monitor Android / TV Box, se debe verificar que al consultar la URL `POST /api.php?resource=tv-heartbeat` nuestro dispositivo reciba y configure exitosamente el override remoto en caché, lo cual denota una app operativa.
