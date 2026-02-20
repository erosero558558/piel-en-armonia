# Disaster Recovery Plan - Piel en Armonía

Este documento describe los procedimientos de recuperación ante desastres (DR) para Piel en Armonía, específicamente para la restauración de datos críticos (`store.json`).

## Estrategia de Backup

El sistema implementa una estrategia de backup híbrida:
1.  **Backups Locales (Rotativos):** Se generan automáticamente en `data/backups/` cada vez que se modifican los datos. Se retienen las últimas 30 versiones.
2.  **Backups Offsite (Snapshot):** Se generan diariamente mediante `cron.php?action=backup-offsite` y se envían a un servidor remoto o se replican en `data/offsite-local/` si no hay remoto configurado.
3.  **Verificación de Salud:** `cron.php?action=backup-health` verifica periódicamente la integridad y frescura de los backups.

## Identificación de Desastre

Un desastre se declara cuando:
-   Los datos en `store.json` están corruptos (no se pueden leer o descifrar).
-   Los datos han sido eliminados accidentalmente.
-   El servidor ha sufrido una falla catastrófica y se ha reinstalado, requiriendo restauración de datos.

## Procedimiento de Restauración (Automático)

Utilice el script `bin/restore-backup.php` para restaurar un backup de manera segura.

### Requisitos
-   Acceso SSH al servidor.
-   PHP CLI instalado.
-   Un archivo de backup válido (JSON).

### Pasos
1.  **Localizar el backup:**
    -   Backups recientes: `ls -lt data/backups/`
    -   Snapshots offsite: `ls -lt data/offsite-local/` o descargar desde el almacenamiento remoto.

2.  **Ejecutar el script de restauración:**
    ```bash
    sudo -u www-data php bin/restore-backup.php <ruta_al_archivo_backup>
    ```
    Ejemplo:
    ```bash
    sudo -u www-data php bin/restore-backup.php data/backups/store-20231027-100000-a1b2c3.json
    ```
    *Nota: Ejecutar como `www-data` asegura que los permisos del archivo restaurado sean correctos para el servidor web.*

3.  **Confirmar la operación:**
    El script validará el archivo, mostrará un resumen de los datos (citas, disponibilidad, etc.) y pedirá confirmación. Escriba `yes` para proceder.
    Nota: El script creará automáticamente una copia de seguridad del estado actual en `data/store.json.pre-restore-YYYYMMDD-HHMMSS.bak` antes de sobrescribir.

4.  **Verificar la restauración:**
    El script verificará que los datos se hayan escrito correctamente. Si ve "Restore completed successfully", el proceso ha terminado.

## Procedimiento de Restauración (Manual)

Si el script no está disponible, puede restaurar manualmente:

1.  **Detener el servidor web** (opcional pero recomendado para evitar escrituras concurrentes).
2.  **Respaldar el archivo actual:**
    ```bash
    cp data/store.json data/store.json.bak
    ```
3.  **Copiar el backup:**
    ```bash
    cp <ruta_al_backup> data/store.json
    ```
    Nota: Si el backup está en formato raw (copia directa), esto funcionará. Si es un snapshot offsite, asegúrese de que sea compatible (el sistema maneja automáticamente el cifrado al leer, siempre que la clave de cifrado sea la misma).
4.  **Verificar permisos:**
    ```bash
    chmod 664 data/store.json
    chown www-data:www-data data/store.json
    ```
5.  **Reiniciar el servidor web** si fue detenido.

## Pruebas de Recuperación

Se recomienda realizar simulacros de recuperación periódicamente utilizando el entorno de pruebas o local.
Puede ejecutar el test de integración para verificar el funcionamiento del script de restauración:
```bash
vendor/bin/phpunit tests/Integration/DisasterRecoveryTest.php
```
