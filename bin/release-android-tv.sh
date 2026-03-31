#!/usr/bin/env bash

set -euo pipefail

# Constantes del entorno del proyecto Android
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_PROJECT_DIR="$ROOT_DIR/src/apps/turnero-sala-tv-android"
PUBLIC_DIR="$ROOT_DIR/public/downloads"

echo "=== Iniciando compilacion de TurneroSalaTV ==="
cd "$ANDROID_PROJECT_DIR"

# 1. Ejecucion de Gradle build (Release)
echo "=> Ejecutando gradle assembleRelease"
if ! gradle assembleRelease; then
    echo "ERROR: Falló la compilación de gradle assembleRelease."
    exit 1
fi

# 2. Localizacion del APK generado
# asumiendo estructura basica de outputs/apk/release/
APK_PATH="$ANDROID_PROJECT_DIR/app/build/outputs/apk/release/app-release.apk"
APK_UNSIGNED_PATH="$ANDROID_PROJECT_DIR/app/build/outputs/apk/release/app-release-unsigned.apk"

# Gradle a veces nombra unsigned dependiendo del keystore.
if [ -f "$APK_PATH" ]; then
    TARGET_APK="$APK_PATH"
elif [ -f "$APK_UNSIGNED_PATH" ]; then
    TARGET_APK="$APK_UNSIGNED_PATH"
else
    echo "ERROR: No se encontro el archivo APK resultante en app/build/outputs/apk/release/"
    exit 1
fi

echo "=> APK exitosamente localizado: $TARGET_APK"

# 3. Directorio destino
mkdir -p "$PUBLIC_DIR"

# 4. Computed SHA-256
if command -v shasum >/dev/null 2>&1; then
    CHECKSUM=$(shasum -a 256 "$TARGET_APK" | awk '{print $1}')
else
    CHECKSUM=$(sha256sum "$TARGET_APK" | awk '{print $1}')
fi
SHORT_CHECKSUM="${CHECKSUM:0:8}"
echo "=> APK Checksum (SHA-256): $CHECKSUM"

# 5. Copy a distribucion de descargas con Version y Base
FINAL_VERSIONED_APK="TurneroSalaTV-$SHORT_CHECKSUM.apk"

cp "$TARGET_APK" "$PUBLIC_DIR/$FINAL_VERSIONED_APK"
cp "$TARGET_APK" "$PUBLIC_DIR/TurneroSalaTV.apk"

# Tambien generar el token metadata text
echo "$CHECKSUM  $FINAL_VERSIONED_APK" > "$PUBLIC_DIR/TurneroSalaTV.sha256"

echo "=== Release completada con exito ==="
echo "Descargas:"
echo " - $PUBLIC_DIR/$FINAL_VERSIONED_APK"
echo " - $PUBLIC_DIR/TurneroSalaTV.apk"
echo "Checksum guardado en:"
echo " - $PUBLIC_DIR/TurneroSalaTV.sha256"
