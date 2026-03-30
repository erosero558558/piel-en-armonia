# Ownership por zona critica

Este documento fija quien debe responder primero cuando una zona critica del
repo cambia, se rompe o queda sin mantenimiento claro.

Objetivo:

- bajar el bus factor en superficies sensibles;
- evitar que cambios tecnicos se aprueben sin dueno humano claro;
- dejar un handoff minimo para continuidad operativa.

Reglas:

- El owner humano manda sobre el lane tecnico cuando hay conflicto de criterio
  en produccion.
- Si el owner humano no esta disponible, se congela el cambio en esa zona hasta
  reunir el handoff minimo de la fila correspondiente.
- Si una tarea toca varias zonas, la aprobacion final la coordina la
  `Directora operativa` y no se publica con ownership ambiguo.

## Tabla de ownership

| Zona del codigo | Dueno humano primario | Riesgo si ese dueno falta | Handoff minimo documentado |
|---|---|---|---|
| `lib/auth.php` | Directora operativa + responsable tecnico de seguridad | Accesos admin mal delegados, bypass de contingencia, bloqueo de login o ampliacion accidental de permisos | Variables activas de auth, modo actual (`google_oauth` o contingencia), ultimo smoke valido, rollback y referencia a `docs/SECURITY.md`, `docs/ADMIN-UI-ROLLOUT.md` y `docs/LEADOPS_OPENCLAW.md` |
| `lib/clinical_history/` | Doctor titular + directora operativa | Regresion clinica, perdida de trazabilidad MSP/HCE, PDFs o notas con datos incompletos | Formularios/reglas obligatorias, ultimo flujo clinico validado, casos de prueba criticos, ruta de rollback y referencia a `docs/FLOW_OS_HCE_ECUADOR_FOUNDATION.md`, `docs/FLOW_OS_HCE_COMPLIANCE_MATRIX.md` y `docs/FLOW_OS_HCE_ECUADOR_TRACEABILITY_MATRIX.md` |
| `controllers/OpenclawController.php` | Doctor titular + operador clinico responsable del laptop OpenClaw | Prescripciones/certificados incorrectos, IA sin contexto del paciente, exposure de acciones clinicas a roles no autorizados | Endpoint afectado, tier/runtime esperado, secreto o bridge involucrado, smoke clinico minimo y referencia a `docs/LEADOPS_OPENCLAW.md`, `docs/API.md` y `docs/SECURITY.md` |
| `k8s/` | Responsable de infraestructura / DevOps | Caida total del servicio, drift entre manifests y host real, secretos o ingress mal expuestos | Namespace, manifests cambiados, variables/secretos impactados, plan de rollback y referencia a `docs/DEPLOYMENT.md`, `docs/DEPLOY_HOSTING_PLAYBOOK.md` y `docs/MONITORING_SETUP.md` |
| `ops/caddy/` | Responsable de infraestructura / DevOps | Routing roto, TLS/CSP incorrectos, loops de redirect o exposicion publica indebida | Hostnames afectados, puertos/rutas cambiadas, ultima config sana, comando de reload y referencia a `docs/DEPLOYMENT.md`, `docs/SECURITY.md` y `docs/WINDOWS_HOSTING_REMOTE_SSH.md` |
| `.github/workflows/deploy-hosting.yml` y lane de publish | Directora operativa + responsable de release | Deploy parcial a produccion, publish sin verify-remote o gates inconsistentes | Workflow tocado, branch/commit objetivo, gate esperado, evidencia de post-deploy y referencia a `docs/GITHUB_ACTIONS_DEPLOY.md`, `docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md` y `docs/DEPLOY_HOSTING_PLAYBOOK.md` |
| `backup-receiver.php`, `verify-backup.php`, `docs/DISASTER_RECOVERY.md` | Directora operativa + responsable de continuidad operacional | Backups inutiles o restore no probado cuando haya incidente real | Ubicacion de backup valida, ultimo restore conocido, RTO objetivo y referencia a `docs/DISASTER_RECOVERY.md` y `docs/RUNBOOKS.md` |
| `app-downloads/` y `desktop-updates/` | Directora operativa + responsable de distribucion desktop | Se publica un instalador equivocado, sin checksum o accesible sin control | Version servida, checksum, canal afectado, publico esperado y referencia a `docs/RUNBOOK_TURNERO_APPS_RELEASE.md` y `docs/TURNERO_NATIVE_SURFACES.md` |

## Handoff minimo por incidente

Antes de entregar cualquiera de estas zonas a otra persona, dejar por escrito:

1. Que archivo o carpeta exacta se toco.
2. Cual es el ultimo estado sano conocido.
3. Que variables, secretos o servicios externos intervienen.
4. Que smoke corto confirma que sigue operativo.
5. Como volver al estado anterior sin improvisar.

## Escalamiento recomendado

1. Si la zona toca datos clinicos o decisiones medicas, escala primero al
   `Doctor titular`.
2. Si toca auth, deploy, hosting, Caddy, secretos o manifests, escala primero a
   `Directora operativa` y `Responsable de infraestructura / DevOps`.
3. Si no existe owner asignado en una superficie nueva, la tarea no deberia
   cerrarse sin agregarla a esta tabla.
