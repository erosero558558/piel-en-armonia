#!/bin/bash
# ops/restore.sh
# Restaura un backup encriptado con GPG en el directorio data/
# Uso: ./ops/restore.sh data/backups/store-YYYY-MM-DD-HH.tar.gz.gpg
# Ejecutar desde la raíz del repositorio.

set -e

if [ $# -eq 0 ]; then
    echo "Uso: $0 <archivo_backup.tar.gz.gpg o .tar.gz>"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: el archivo $BACKUP_FILE no existe."
    exit 1
fi

if [ ! -d "data" ]; then
    echo "Error: el directorio 'data/' no existe. Ejecute este script desde la raiz del repositorio."
    exit 1
fi

WORK_DIR=$(mktemp -d)
TAR_FILE="$WORK_DIR/backup.tar.gz"

echo "1. Analizando el archivo $BACKUP_FILE..."

if [[ "$BACKUP_FILE" == *.gpg ]]; then
    # Evaluar si se puede descifrar asimétricamente, si falla intentamos con la clave por defecto
    echo "2. Descifrando GPG..."
    if ! gpg --quiet --batch --yes --decrypt --output "$TAR_FILE" "$BACKUP_FILE" 2>/dev/null; then
        echo "⚠️ Fallo el descifrado asimétrico. Intentando con passphrase por defecto 'aurora'..."
        gpg --quiet --batch --yes --passphrase "aurora" --decrypt --output "$TAR_FILE" "$BACKUP_FILE" || {
            echo "❌ Error crítico: no se pudo descifrar el archivo."
            exit 1
        }
    fi
else
    echo "⚠️ Archivo sin extensión .gpg detectado. Usando archivo directamente..."
    cp "$BACKUP_FILE" "$TAR_FILE"
fi

echo "3. Respaldando estado actual en caso de error..."
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
TEMP_BACKUP="data/backups/pre-restore-$TIMESTAMP.tar.gz"
tar -czf "$TEMP_BACKUP" --exclude="data/backups" data/*.json data/*.jsonl 2>/dev/null || true

echo "4. Extrayendo los datos en data/..."
tar -xzvf "$TAR_FILE" -C .

echo "5. Restaurando permisos..."
chmod 664 data/*.json data/*.jsonl 2>/dev/null || true

# Cleanup
rm -rf "$WORK_DIR"

echo "✅ Proceso completado exitosamente."
echo "Si algo fallo, el estado anterior está en: $TEMP_BACKUP"
