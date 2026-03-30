# NPM Scripts Audit

Fecha de auditoría: `2026-03-30`

Superficie auditada:

- [package.json](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/package.json)

Metodología:

- inventario de `package.json.scripts`
- resolución de entrypoints locales (`node`, `php`, `bash`, `powershell -File`)
- verificación de existencia de tests referenciados por `node --test` y `playwright test`
- búsqueda explícita de referencias a `_archive` o rutas archivadas

## Resumen

- `package.json` hoy tiene `260` scripts. El enunciado histórico de la tarea menciona `171`; el catálogo creció y ya no coincide con ese conteo.
- No se encontraron scripts que apunten directamente a `_archive/` ni a rutas archivadas. Las únicas ocurrencias con la palabra `archive` en el archivo son [agent:board:archive:preview](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/package.json) y [agent:board:archive:apply](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/package.json), y ambas siguen apuntando a [bin/archive-agent-board.js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/bin/archive-agent-board.js), que existe.
- Sí hay `21` scripts que hoy quedan rotos por `19` referencias locales inexistentes.
- Además hay `1` script con prerequisito generado ausente: `turnero:stage:pilot:local` espera `src/apps/turnero-desktop/dist`, que no existe en un checkout limpio.

## Scripts rotos por referencias inexistentes

### Public V5/V6 Sony

- `score:public:v5:sony` y `score:public:v5:sony:strict` apuntan a `bin/score-public-v5-sony.js`
- `audit:public:v5:surface` apunta a `bin/audit-public-v5-surface.js`
- `audit:public:v5:copy` apunta a `bin/audit-public-v5-copy.js`
- `audit:public:v6:sony-evidence` apunta a `bin/audit-public-v6-sony-evidence.js`
- `audit:public:v6:sony-parity` apunta a `bin/audit-public-v6-sony-parity.js`
- `baseline:sony:reference` apunta a `bin/capture-sony-reference.js`
- `compare:public:v5:sony:reference` apunta a `bin/compare-public-v5-sony-reference.js`
- `gate:public:v5:8point` apunta a `bin/gate-public-v5-8point.js`

Impacto:

- Se rompen gates y scorecards de calidad del frente `public-v5/public-v6`.

### Admin rollout

- `diagnose:admin:auth:rollout:node` apunta a `bin/admin-openclaw-rollout-diagnostic.js`
- `gate:admin:rollout:node` y `gate:admin:rollout:auth:node` apuntan a `bin/admin-rollout-gate.js`

Impacto:

- El camino Node del rollout admin quedó huérfano; solo sobreviven los wrappers PowerShell.

### Gobernanza legacy

- `agent:board:legacy:check` y `agent:board:legacy:normalize` apuntan a `bin/board-legacy-drift-guard.js`

Impacto:

- Los wrappers legacy del board ya no tienen entrypoint real aunque el resto del bundle de gobernanza sí exista.

### Validadores de catálogos públicos

- `content:public-v4:validate` apunta a `bin/validate-public-v4-catalog.js`
- `content:public-v5:validate` apunta a `bin/validate-public-v5-catalog.js`

Impacto:

- Los gates `public-v5` siguen llamando validadores que ya no están presentes.

### Turnero release y contratos

- `turnero:release:plan` apunta a `bin/resolve-turnero-release-plan.js`
- `turnero:verify:bundle` y `turnero:verify:pilot:local` apuntan a `bin/verify-turnero-release-bundle.js`
- `test:turnero:web-pilot:contracts` referencia:
  `tests-node/turnero-surface-roadmap-contract.test.js`,
  `tests-node/turnero-admin-queue-surface-roadmap-console.test.js`,
  `tests-node/turnero-surface-roadmap-wiring.test.js`
- `test:turnero:contracts` referencia esos tres tests y además `tests-node/turnero-runtime-artifacts-contract.test.js`

Impacto:

- La parte de roadmap/release de Turnero quedó con contratos rotos y sin verificador de bundle.

## Prerequisito generado ausente

- `turnero:stage:pilot:local` no apunta a un archivo huérfano, pero sí depende de `src/apps/turnero-desktop/dist`, que hoy no existe en un checkout limpio.
- Esto parece un prerequisito de build y no un script muerto; conviene documentarlo aparte en lugar de borrarlo por limpieza automática.

## Reproducciones mínimas

- `npm run turnero:verify:pilot:local`
  Resultado: `MODULE_NOT_FOUND` para `bin/verify-turnero-release-bundle.js`
- `npm run content:public-v4:validate`
  Resultado: `MODULE_NOT_FOUND` para `bin/validate-public-v4-catalog.js`

## Recomendación de limpieza

- Eliminar o rewirear primero el bloque `Public V5/V6 Sony`, porque hoy rompe gates visibles del frente público.
- Resolver después `Admin rollout` y `Governanza legacy`, ya que son wrappers operativos que aparentan existir pero no tienen implementación.
- En `Turnero`, separar explícitamente scripts muertos de scripts que solo requieren artefactos generados.
- No tocar aún `turnero:stage:pilot:local` como si fuera huérfano; su problema es falta de `dist`, no drift de nombre.
