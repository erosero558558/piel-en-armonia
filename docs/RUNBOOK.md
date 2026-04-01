# Aurora Derm Runbook

Este documento concentra los procesos críticos para mantener la integridad operativa del sistema antes y después de su despliegue en producción.

## 1. Backups Automáticos
El script `ops/backup.sh` centraliza el estado total del consultorio empaquetando todos los archivos JSON situados en el directorio `/data`.
*   **Comando:** `npm run backup`
*   **Resultados:** Se generan de forma transaccional snapshots comprimidos `store-YYYY-MM-DD-HH.tar.gz` en `data/backups/`.
*   **Retención:** El cron que lanza el backup elimina automáticamente copias más antiguas a 7 días.

## 2. Proceso de Restauración (`Restore Drill`)
Ante corrupción del archivo principal `store.json` o borrado accidental, seguir estos pasos precisos de resiliencia:

1. **Colocar sistema en mantenimiento**: Si posee ingress o proxy, desvíe el tráfico apuntando a su landing page de `maintenance.html` o baje los pods vía `kubectl scale deployment auroraderm --replicas=0`.
2. **Listar Backups**: En el directorio del repositorio, ejecute `ls -l data/backups/` e identifique el archivo `.tar.gz.gpg` más reciente.
3. **Restaurar**: Ejecute el script automatizado `./ops/restore.sh data/backups/store-YYYY-MM-DD-HH.tar.gz.gpg`.
4. **Validar Archivos**: Confirme que los archivos se extrajeron correctamente y no hubo errores de cifrado GPG.
5. **Arrancar sistema**: Levante la aplicación (`kubectl scale deployment auroraderm --replicas=2` o reinicie pm2/docker).
6. **Verificar Hard Health**: Visite internamente `/api.php?resource=health` asegurando que `store: ok`.

## 8. Backup Automatizado
Se configuró rotación y respaldo encriptado.
- **Crear un backup manual**: Ejecute `./ops/backup.sh`. Generará un `.gpg` en la bóveda cifrada a la llave del administrador principal.
- **Rotación**: Retención configurada en 7 días mediante cron.

---
*Flow OS Platform – Documentación sujeta a auditoría de Ingeniería.*
