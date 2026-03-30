# Ownership by Critical Zone

Este documento reduce el bus factor de las zonas mas sensibles del repo.
Complementa el ownership tecnico por lane descrito en `AGENTS.md`: aqui importa
quien debe aprobar, recibir handoff o decidir rollback cuando el cambio toca
auth, historia clinica, IA clinica o infraestructura.

## Reglas rapidas

- "Owner humano" no es lo mismo que lane Codex. El lane decide quien implementa;
  este documento decide quien responde por el cambio en operacion.
- Si el owner primario no esta disponible, no se publica sin dejar el handoff
  minimo de su zona y un backup explicitado en PR o evidencia.
- Cuando el repo solo habla de "contacto tecnico designado" y no publica un
  nombre, esa figura queda como owner humano vigente hasta documentar el nombre
  operativo.

## Mapa de ownership

| Zona | Que controla | Dueno humano primario | Riesgo si ese owner falta | Handoff minimo |
| --- | --- | --- | --- | --- |
| `lib/auth.php` | Sesiones admin/operator, cookies seguras, 2FA, fallback legacy y modos Google/OpenClaw | Contacto tecnico designado; cambios de politica de acceso se validan con la Directora | Bloqueo de staff, acceso indebido a PII, fallback inseguro o lockout en contingencia | `AUTH-1` |
| `lib/clinical_history/` | HCE, intake clinico, guardrails, legal readiness MSP y adjuntos clinicos | Dra. Rosero (Directora clinica) | Historia clinica invalida, perdida de continuidad clinica, incumplimiento MSP o PDFs sin sustento | `HCE-1` |
| `controllers/OpenclawController.php` | Endpoints del copiloto clinico, contexto de paciente hacia IA, CIE-10, protocolos y recetas | Dra. Rosero; si cambia criterio clinico, sumar al medico titular del flujo OpenClaw | Sugerencias clinicas inseguras, contexto incompleto del paciente o regresiones en receta/certificado/copiloto | `OPENCLAW-1` |
| `k8s/` | Manifests de deploy, ingress, PVC, namespace y secrets de ejemplo | Contacto tecnico designado / owner de infraestructura | Downtime, secretos mal rotados, perdida de datos o despliegue imposible de recuperar | `K8S-1` |
| `ops/caddy/` | Routing edge, CSP, headers, cache, bloqueos de archivos y redirecciones publicas | Contacto tecnico designado / owner de hosting; cambios de canon publico se informan a la Directora | Sitio caido, admin expuesto, CSP rompiendo runtime o SEO/canon rotos | `CADDY-1` |

## Handoff minimo por zona

### `AUTH-1`

1. Variables o secrets tocados: `AURORADERM_ADMIN_*`,
   `AURORADERM_OPERATOR_AUTH_*` y helpers relacionados.
2. Modo anterior vs modo nuevo y rollback exacto.
3. Smoke ejecutado y resultado (`npm run smoke:admin:auth:local` o
   `npm run gate:admin:rollout:auth`).
4. Host o base URL donde se valido login.
5. Quien confirma acceso real del staff despues del cambio.

### `HCE-1`

1. Campos o estructuras clinicas afectadas (`episodes`, `drafts`,
   `documents`, media, compliance).
2. Impacto normativo u operativo sobre formularios MSP o legal readiness.
3. Evidencia de al menos un caso de prueba o harness con datos
   reales/sinteticos.
4. Riesgo de migracion o retrocompatibilidad sobre historial ya guardado.
5. Plan de rollback o contencion si un registro queda inconsistente.

### `OPENCLAW-1`

1. Endpoints o prompts/guardrails tocados y por que.
2. Que contexto de paciente entra o sale de la IA despues del cambio.
3. Fallback esperado si OpenClaw, OAuth o el provider IA no responden.
4. Validacion ejecutada sobre endpoints, harness o admin.
5. Confirmacion de la Directora si el cambio altera criterio clinico, receta,
   certificado o conducta sugerida.

### `K8S-1`

1. Manifests modificados y cluster o namespace objetivo.
2. Secrets o configmaps tocados, o lo que debe rotarse fuera del repo.
3. Procedimiento exacto de rollout.
4. Procedimiento exacto de rollback.
5. Gate postdeploy o smoke usado para confirmar salud.

### `CADDY-1`

1. Hosts, headers, CSP o redirects tocados.
2. Rutas publicas o admin afectadas.
3. Smoke minimo: `/healthz`, `/es/`, `/en/`, `admin.html` y la ruta critica
   tocada.
4. Copia o diff del bloque previo para rollback rapido.
5. Confirmacion de cache o SEO si cambia el canon de URLs publicas.

## Gap abierto

El repo ya nombra a la Directora y al especialista laser, pero no publica un
nombre unico para el contacto tecnico designado de hosting/infra. Hasta cerrar
ese dato en un runbook operativo, `lib/auth.php` (parte tecnica), `k8s/` y
`ops/caddy/` siguen dependiendo de esa figura generica.

## Fuentes relacionadas

- `AGENTS.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`
- `docs/OPERATIONS_INDEX.md`
- `docs/LEADOPS_OPENCLAW.md`
- `docs/FLOW_OS_HCE_COMPLIANCE_MATRIX.md`
