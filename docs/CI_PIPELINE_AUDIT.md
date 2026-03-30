# CI Pipeline Audit

Fecha de auditoria: `2026-03-30`

Superficie auditada:

- [.github/workflows](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows)

Metodologia:

- inventario de `33` workflows bajo `.github/workflows/*.yml`
- busqueda de referencias locales a scripts, tests y entrypoints de repo usados desde `run:` o `paths:`
- verificacion de existencia real en el checkout actual
- exclusion de artifacts generados (`verification/`, `.public-*`, `.selfhosted-*`, `test-results/`, `/tmp/`) para no confundir salidas runtime con input de repo
- chequeo adicional de `_archive/` para detectar referencias a rutas archivadas

## Resumen

- No se encontraron workflows que apunten directamente a `_archive/`.
- Si hay `6` workflows con referencias duras a `9` scripts locales inexistentes; esos jobs fallarian como estan escritos.
- Ademas hay `2` workflows con drift suave: referencias stale en `paths:` o scans tolerantes que no necesariamente rompen la ejecucion.
- `ci.yml` tambien menciona `vendor/bin/psalm`, pero el propio workflow salta ese paso de forma explicita cuando el binario no existe; se clasifica como dependencia opcional, no como blocker.

## Blockers duros

- [agent-governance.yml#L74](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/agent-governance.yml#L74)
  `node bin/board-legacy-drift-guard.js --check --json`
  El archivo [bin/board-legacy-drift-guard.js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/bin/board-legacy-drift-guard.js) no existe.

- [deploy-hosting.yml#L678](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/deploy-hosting.yml#L678), [deploy-hosting.yml#L1519](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/deploy-hosting.yml#L1519), [deploy-hosting.yml#L1570](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/deploy-hosting.yml#L1570), [deploy-hosting.yml#L1630](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/deploy-hosting.yml#L1630), [deploy-hosting.yml#L1737](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/deploy-hosting.yml#L1737), [deploy-hosting.yml#L1978](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/deploy-hosting.yml#L1978)
  Faltan estos helper scripts:
  `bin/write-transport-preflight.js`
  `bin/write-turnero-pilot-remote-status.js`
  `bin/resolve-admin-rollout-policy.js`
  `bin/resolve-public-v4-rollout-policy.js`
  `bin/write-admin-rollout-placeholder-report.js`
  `bin/write-public-cutover-manifest.js`

- [post-deploy-fast.yml#L293](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/post-deploy-fast.yml#L293) y [post-deploy-fast.yml#L332](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/post-deploy-fast.yml#L332)
  Reutilizan entrypoints ausentes:
  `bin/resolve-admin-rollout-policy.js`
  `bin/resolve-public-v4-rollout-policy.js`

- [post-deploy-gate.yml#L446](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/post-deploy-gate.yml#L446) y [post-deploy-gate.yml#L485](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/post-deploy-gate.yml#L485)
  Reutilizan entrypoints ausentes:
  `bin/resolve-admin-rollout-policy.js`
  `bin/resolve-public-v4-rollout-policy.js`

- [prod-monitor.yml#L700](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/prod-monitor.yml#L700) y [prod-monitor.yml#L795](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/prod-monitor.yml#L795)
  Faltan:
  `bin/resolve-public-v4-rollout-policy.js`
  `bin/run-public-v4-rollout-gate.js`

- [release-turnero-apps.yml#L108](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/release-turnero-apps.yml#L108)
  `node bin/resolve-turnero-release-plan.js`
  El archivo [bin/resolve-turnero-release-plan.js](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/bin/resolve-turnero-release-plan.js) no existe.

## Drift suave

- [frontend-premium-qa.yml#L41](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/frontend-premium-qa.yml#L41), [frontend-premium-qa.yml#L43](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/frontend-premium-qa.yml#L43), [frontend-premium-qa.yml#L85](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/frontend-premium-qa.yml#L85), [frontend-premium-qa.yml#L87](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/frontend-premium-qa.yml#L87)
  El workflow no invoca esos archivos directamente, pero sus filtros `paths:` siguen apuntando a:
  `bin/run-public-v4-rollout-gate.js`
  `bin/validate-public-v4-catalog.js`
  Ambos faltan, asi que el trigger conserva referencias stale.

- [ci.yml#L601](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/ci.yml#L601)
  El scan de bundles sigue intentando revisar `script.js`, pero la funcion `scan_path` devuelve `0` si el archivo no existe. Es drift, no bloqueo.

- [ci.yml#L125](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/.github/workflows/ci.yml#L125)
  `vendor/bin/psalm` no existe hoy, pero el workflow ya lo trata como ausencia tolerada y hace `exit 0`.

## Relacion con S4-23

- Este audit confirma drift que ya asomaba en [docs/NPM_SCRIPTS_AUDIT.md](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/docs/NPM_SCRIPTS_AUDIT.md): `bin/resolve-turnero-release-plan.js` y `bin/validate-public-v4-catalog.js`.
- Ademas descubre una familia nueva de helpers ausentes de rollout/cutover que no estaba explicitada en `package.json`:
  `resolve-admin-rollout-policy`
  `resolve-public-v4-rollout-policy`
  `write-admin-rollout-placeholder-report`
  `write-public-cutover-manifest`
  `write-transport-preflight`
  `write-turnero-pilot-remote-status`
  `run-public-v4-rollout-gate`
  `board-legacy-drift-guard`

## Recomendacion

- No borrar workflows todavia.
- Primero hay que decidir, por cada helper faltante, si se restaura el script o si se simplifica el workflow para dejar de depender de ese entrypoint.
- El frente con mayor riesgo operativo hoy es deploy/post-deploy/prod-monitor, porque concentra la mayoria de los missing helpers.
