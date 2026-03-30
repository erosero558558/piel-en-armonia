# Patient Flow OS Workflow Contracts

Este documento oficializa los contratos de ejecución (prerequisitos, dependencias, secretos y artefactos) para los pipelines críticos de `patient-flow-os`. Todos pertenecen a `lane-1-core-platform`. Su objetivo es impedir una falla silenciosa en ambientes de producción o durante simulacros de recuperación de desastres (DR).

Cada workflow listado tiene incorporado un step llamado `pre-check` que verifica explícitamente la presencia de estos contratos.

| Workflow | Prerequisitos (Trigger Info) | Artifacts / Files Necesarios | Secrets Obligatorios | Dueño / Lane |
|----------|------------------------------|-------------------------------|----------------------|--------------|
| `patient-flow-os-promote` | Source run ID válido, post-cutover packet. | `patient-flow-os-cutover-artifacts`, `patient-flow-os-post-cutover-artifacts` | `PATIENT_FLOW_OS_DATABASE_URL` (en env target) | `lane-1-core-platform` |
| `patient-flow-os-rollback` | Source run ID con rollback packet preparado. | `patient-flow-os-production-promotion-artifacts`, `before-state.json` | `PATIENT_FLOW_OS_DATABASE_URL` (en env target) | `lane-1-core-platform` |
| `patient-flow-os-cutover` | Branch principal verde y Smoke gate aprobado. | Ninguno (lo construye dinámicamente) | `PATIENT_FLOW_OS_DATABASE_URL` | `lane-1-core-platform` |
| `patient-flow-os-backup-drill` | Confirmación explícita (boolean). | Ninguno | `URL`s de db y escrow de AWS (bucket, key, secret) | `lane-1-core-platform` |
| `patient-flow-os-escrow-restore` | Nombre del snapshot y AWS access keys. | Archivos de S3 Escrow Backup | `PATIENT_FLOW_OS_DRILL_DATABASE_URL`, AWS keys, Encryption passphrase | `lane-1-core-platform` |
| `patient-flow-os-dr-rehearsal-history` | Rehearsal Report File Path. | Artifacts genéricos de rehearsals pasados | `None` explícito (utiliza reportes JSON) | `lane-1-core-platform` |

## Comportamiento del `pre-check` Gate

*   **Identidad:** Se ubica como el primer bloque `run` o `step` antes de descargar artefactos masivos o levantar entornos de Node.
*   **Aserción Dura:** Usa `if [ -z "$SECRET_VAR" ]` o bloquea explícitamente la continuación evaluando la presencia de las entradas (`inputs.*`) y secretos (`secrets.*` inyectados en entorno).
*   **Fail-fast:** Usa código de salida 1 (`exit 1`) con mensajes legibles (`echo "::error::Falta..."`).
