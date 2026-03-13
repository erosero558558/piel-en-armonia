# Production Ops Scripts

Implementaciones canonicas de los scripts operativos de produccion.

Entrypoints estables:

- `BENCH-API-PRODUCCION.ps1`
- `CHECKLIST-HOST-PUBLIC-SYNC.ps1`
- `GATE-POSTDEPLOY.ps1`
- `MONITOR-PRODUCCION.ps1`
- `REPORTE-SEMANAL-PRODUCCION.ps1`
- `SMOKE-PRODUCCION.ps1`
- `VERIFICAR-DESPLIEGUE.ps1`

Los archivos de raiz se mantienen como wrappers compatibles para no romper
`package.json`, workflows ni uso manual existente.

Los checks canonicos de runtime publico resuelven engines solo desde
`js/engines/**`. Los residuos JS legacy de raiz (`booking-engine.js`,
`utils.js`, `*-engine.js`) deben quedar archivados fuera del carril activo.

Adopcion operativa de `public_main_sync`:

- `MONITOR-PRODUCCION.ps1` hace triage rapido de `checks.publicSync`: trata `healthy=false`, `headDrift` y `telemetryGap` como fallo operativo, pero deja `repoHygieneIssue=true` como warning visible cuando el unico problema es `working_tree_dirty` con telemetria suficiente.
- `SMOKE-PRODUCCION.ps1 -RequireCronReady` valida `checks.publicSync` con `jobId`, `healthy`, `ageSeconds` y telemetria runtime (`state`, `lastErrorMessage`, `currentHead`, `remoteHead`, `dirtyPathsCount`, `dirtyPathsSample`); tambien resuelve `github.deployAlerts` y falla si quedan incidentes GitHub abiertos de transporte/conectividad, salvo `-AllowOpenGitHubDeployAlerts`.
- `VERIFICAR-DESPLIEGUE.ps1 -RequireCronReady` propaga fallas como assets `health-public-sync-*`, incluyendo `working-tree-dirty`, `head-drift` y `telemetry-gap`; ademas agrega assets `github-deploy-*` para incidentes abiertos de deploy y forwardea `-AllowOpenGitHubDeployAlerts` al smoke integrado.
- `REPORTE-SEMANAL-PRODUCCION.ps1` publica los bloques `Auth Posture`, `Operator Auth Rollout`, `Storage Posture` y `Public Sync Ops` en markdown/JSON; ademas clasifica warnings `auth_*`, `storage_*`, `public_sync_*` y `github_deploy_*` con `runbookRef`, `remediation` y `suggestedCommand`.
- `MONITOR-PRODUCCION.ps1` y `REPORTE-SEMANAL-PRODUCCION.ps1` ahora tambien consultan los incidentes GitHub `production-alert` para `deploy-hosting`, `diagnose-host-connectivity`, `repair-git-sync` y `self-hosted-runner`, exponiendo `github.deployAlerts`, `github_deploy_*`, conteos por categoria e issue numbers activos.
- `MONITOR-PRODUCCION.ps1` y `REPORTE-SEMANAL-PRODUCCION.ps1` consumen `health-diagnostics` para triage operativo detallado; `health` queda como surface publica para smoke, headers y checks anonimos.
- `SMOKE-PRODUCCION.ps1` y `VERIFICAR-DESPLIEGUE.ps1` separan `health` (headers/contrato publico) de `health-diagnostics` (backup/publicSync/telemedicina), para no depender de que el endpoint publico siga exponiendo telemetria interna.
- `SMOKE-PRODUCCION.ps1`, `VERIFICAR-DESPLIEGUE.ps1` y `GATE-POSTDEPLOY.ps1` aceptan `-RequireTurneroWebSurfaces` para bloquear si faltan `/operador-turnos.html`, `/kiosco-turnos.html` o `/sala-turnos.html`.
- Los mismos entrypoints aceptan `-RequireTurneroOperatorPilot` para bloquear si el piloto Windows del operador no publica `app-downloads`, `latest.yml` e instalador en `pilot`.
- `check-public-routing-smoke.js` ahora trata `/operador-turnos.html`, `/kiosco-turnos.html` y `/sala-turnos.html` como rutas publicas obligatorias; si una cae en redirect o 404, staging/prod no deben pasar.
- `MONITOR-PRODUCCION.ps1`, `VERIFICAR-DESPLIEGUE.ps1` y `REPORTE-SEMANAL-PRODUCCION.ps1` consumen `checks.auth` para exponer `mode`, `status`, `configured`, `hardeningCompliant`, `recommendedMode`, `twoFactorEnabled`, `operatorAuthEnabled` y `legacyPasswordConfigured`.
- `MONITOR-PRODUCCION.ps1` deja la postura de auth visible por default y permite endurecer con `-RequireAuthConfigured`, `-RequireOperatorAuth` y `-RequireAdminTwoFactor`.
- `VERIFICAR-DESPLIEGUE.ps1` traduce esos guardrails en assets `health-auth-*` cuando el deploy no cumple la postura requerida.
- Cuando se activa `-RequireOperatorAuth`, ambos entrypoints corren tambien `scripts/ops/admin/DIAGNOSTICAR-OPENCLAW-AUTH-ROLLOUT.ps1` para publicar `operator auth rollout diagnosis=... nextAction=...` y distinguir `openclaw_mode_disabled`, `admin_auth_legacy_facade`, `facade_only_rollout` o `openclaw_not_configured`.
- `MONITOR-PRODUCCION.ps1` y `VERIFICAR-DESPLIEGUE.ps1` ahora tambien consumen `checks.storage` para exponer `backend`, `source`, `encrypted`, `encryptionConfigured`, `encryptionRequired`, `encryptionStatus` y `encryptionCompliant`.
- `MONITOR-PRODUCCION.ps1` deja el cifrado en reposo visible por default y permite endurecer con `-RequireStoreEncryption`; aun sin ese flag, si el runtime ya marca `encryptionRequired=true`, el monitor falla cuando `encryptionCompliant=false`.
- `VERIFICAR-DESPLIEGUE.ps1` traduce ese guardrail a `health-store-encryption-*` cuando el deploy publica `encryptionCompliant=false`.
- `CHECKLIST-HOST-PUBLIC-SYNC.ps1` imprime un checklist host-side reutilizable para comparar `/root/sync-pielarmonia.sh` contra el wrapper canonico, capturar `public-sync-status.json`, revisar `health-diagnostics` y validar `storeEncryptionCompliant`.

Los entrypoints de triage `MONITOR-PRODUCCION.ps1`, `REPORTE-SEMANAL-PRODUCCION.ps1`,
`SMOKE-PRODUCCION.ps1` y `VERIFICAR-DESPLIEGUE.ps1` consumen
`checks.publicSync` para diagnosticar degradaciones del cron
`public_main_sync` con `state`, `failureReason`, `lastErrorMessage`,
`currentHead`, `remoteHead`, `dirtyPathsCount`, `dirtyPathsSample`,
`headDrift`, `telemetryGap`, `operationallyHealthy`, `repoHygieneIssue`
y la salida permisiva `AllowDegradedPublicSync`.

Para auth, `MONITOR-PRODUCCION.ps1` y `VERIFICAR-DESPLIEGUE.ps1` leen
`checks.auth`; por defecto muestran warnings si el runtime sigue en
`legacy_password` o sin 2FA, y solo escalan a fallo si se activa
`RequireOperatorAuth`, `RequireAdminTwoFactor` o `RequireAuthConfigured`.

Para storage, ambos entrypoints leen `checks.storage`; por defecto muestran
warnings si `storeEncryptionStatus` sigue en `plaintext`, y escalan a fallo con
`RequireStoreEncryption` o cuando el runtime ya declara
`storeEncryptionRequired=true` y `storeEncryptionCompliant=false`.

Cuando necesites intervenir el VPS sin improvisar comandos, usa:

- `npm run checklist:prod:public-sync:host`
- `npm run verify:prod:turnero:operator:pilot`
- `npm run smoke:prod:turnero:operator:pilot`
- `npm run gate:prod:turnero:operator:pilot`
- `node bin/check-public-routing-smoke.js --base-url https://pielarmonia.com --label production`
- `pwsh -File scripts/ops/prod/CHECKLIST-HOST-PUBLIC-SYNC.ps1`

El script no toca el host: solo imprime el bloque canonico de comandos y
criterios de cierre para `public_main_sync`, auth y cifrado en reposo.

El reporte semanal reutiliza ese mismo comando (`npm run checklist:prod:public-sync:host`)
como `suggestedCommand` cuando un warning afecta `public_sync`, `github_deploy`,
`auth` o `storage`, para que la remediacion no dependa de memoria operativa.

Cuando el bloqueo real vive en la ruta GitHub runner -> VPS y no solo dentro del
host, el mismo triage operativo agrega `github.deployAlerts` para mostrar si ya
estan abiertos `Deploy Hosting transporte bloqueado desde GitHub Runner`,
`Diagnose host connectivity sin ruta de deploy` o
`Repair git sync self-hosted fallback sin runner`.
`MONITOR-PRODUCCION.ps1` deja ese diagnostico en modo fail-fast. `SMOKE-PRODUCCION.ps1`
y `VERIFICAR-DESPLIEGUE.ps1` ahora lo tratan tambien como gate operativo, con
la misma excepcion explicita `-AllowOpenGitHubDeployAlerts` cuando solo se
necesita una corrida de observacion manual.
