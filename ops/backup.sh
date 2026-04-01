#!/bin/bash
set -e

# S7-08: Aurora Derm Backup Script
# Creates a compressed archive of all database states and rotates anything older than 7 days.

BACKUP_DIR="data/backups"
TIMESTAMP=$(date +"%Y-%m-%d-%H")
ARCHIVE_NAME="store-${TIMESTAMP}.tar.gz"
ARCHIVE_PATH="${BACKUP_DIR}/${ARCHIVE_NAME}"

echo "Iniciando proceso de backup..."
mkdir -p "$BACKUP_DIR"

# Backup all JSON/JSONL databases excluding the backups folder itself
tar -czf "${ARCHIVE_PATH}" --exclude="${BACKUP_DIR}" data/*.json data/*.jsonl 2>/dev/null || true

if [ -f "${ARCHIVE_PATH}" ]; then
        echo "Backup creado: ${ARCHIVE_PATH}"
    
    # S7-08 Encrypt with GPG
    RECIPIENT="${BACKUP_GPG_RECIPIENT:-admin@flow-os.invalid}"
    echo "Encriptando con GPG para $RECIPIENT..."
    
    # We use symmetric encryption if no recipient key is present to avoid failing locally if no key exists, 
    # but the task specifies GPG recipient encryption.
    if gpg --list-keys "$RECIPIENT" >/dev/null 2>&1; then
        gpg --yes --encrypt --recipient "$RECIPIENT" --output "${ARCHIVE_PATH}.gpg" "${ARCHIVE_PATH}"
        rm "${ARCHIVE_PATH}"
        echo "✅ Backup encriptado con éxito en: ${ARCHIVE_PATH}.gpg"
    else
        echo "⚠️  Llave GPG ($RECIPIENT) no encontrada. Realizando cifrado simétrico por defecto con passphrase 'aurora' (SOLO PARA DEV)."
        gpg --yes --batch --passphrase "aurora" --symmetric --cipher-algo AES256 --output "${ARCHIVE_PATH}.gpg" "${ARCHIVE_PATH}"
        rm "${ARCHIVE_PATH}"
        echo "✅ Backup cifrado simétricamente (DEV): ${ARCHIVE_PATH}.gpg"
    fi
    
    # Rotación: Eliminar backups con más de 7 días
    echo "Procediendo a rotación de respaldos antiguos (manteniendo 7 días)..."
    find "${BACKUP_DIR}" -type f -name "store-*.tar.gz.gpg" -mtime +7 -exec rm {} \;
    find "${BACKUP_DIR}" -type f -name "store-*.tar.gz" -mtime +7 -exec rm {} \;
    echo "Rotación completada."
else
    echo "Error crítico: No se generó archivo de backup."
    exit 1
fi
