# Turnero Sala TV Android

App nativa para Android TV pensada para la `TCL C655` con Google TV. La app abre `sala-turnos.html` en un `WebView` controlado, mantiene la pantalla activa y reintenta conexión de forma automática.

## Objetivo

- Evitar depender del navegador general de la TV.
- Mantener un tile visible en el home de Google TV.
- Simplificar reinstalación y relanzamiento desde una sola APK.

## Requisitos

- Android Studio o Gradle con Android SDK
- JDK 17
- TV Android / Google TV con instalación por `adb` o APK local

## Build

```bash
cd src/apps/turnero-sala-tv-android
./gradlew assembleDebug
```

APK esperada:

- `app/build/outputs/apk/debug/app-debug.apk`

Para release real:

1. Configura firma de Android.
2. Genera `assembleRelease`.
3. Publica la APK final como `TurneroSalaTV.apk` bajo `/app-downloads/stable/sala-tv/android/`.

## Instalación en TCL C655

1. Conecta la TV preferiblemente por `Ethernet`.
2. Habilita modo desarrollador si vas a usar `adb`.
3. Instala la APK:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

4. Abre `Turnero Sala TV` desde el home de Google TV.
5. Verifica:
   - conexión al panel de sala
   - campanilla/audio
   - recuperación tras corte de red

## Configuración

La URL base vive en [TurneroConfig.kt](/home/deck/Documents/GitHub/piel-en-armonia/src/apps/turnero-sala-tv-android/app/src/main/java/com/pielarmonia/turnerosalatv/TurneroConfig.kt).

- `BASE_URL`
- `SURFACE_PATH`
- `RECONNECT_DELAY_MS`

## Notas operativas

- La app restringe navegación fuera de `sala-turnos.html`.
- Mantiene la pantalla activa.
- Si la red cae, deja visible un estado offline y reintenta sola.
- En esta primera versión no usa `device owner` ni lock-task enterprise.
