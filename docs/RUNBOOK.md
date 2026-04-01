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
2. **Navegar a Backup**: `cd data/backups/` e identifique la copia buena más reciente.
3. **Limpiar Causa Raíz**: Borre el `store.json` corrupto (si existe) y/o muévalo a un `store.corrupt.json` por propósitos forenses.
4. **Extraer**: `tar -xzvf store-YYYY-MM-DD-HH.tar.gz -C ../` (o manualmente sobrescribiendo los archivos en `data/`).
5. **Validar Permisos**: Ejecute `chmod 664 data/*.json`.
6. **Arrancar sistema**: Levante la aplicación (`kubectl scale deployment auroraderm --replicas=2` o reinicie pm2/docker).
7. **Verificar Hard Health**: Visite internamente `/api.php?resource=health` asegurando que `store: ok`.

---
*Flow OS Platform – Documentación sujeta a auditoría de Ingeniería.*
