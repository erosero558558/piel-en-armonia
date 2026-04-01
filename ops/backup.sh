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
    echo "Backup creado con éxito en: ${ARCHIVE_PATH}"
    
    # Rotación: Eliminar backups con más de 7 días
    echo "Procediendo a rotación de respaldos antiguos (manteniendo 7 días)..."
    find "${BACKUP_DIR}" -type f -name "store-*.tar.gz" -mtime +7 -exec rm {} \;
    echo "Rotación completada."
else
    echo "Error crítico: No se generó archivo de backup."
    exit 1
fi
