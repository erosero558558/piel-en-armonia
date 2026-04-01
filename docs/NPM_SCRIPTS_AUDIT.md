# Auditoría de Scripts de NPM (package.json)

Clasificación inicial de los scripts NPM de cara a limpieza de CI/CD.

**Resumen:** 230 Oficiales, 45 Legacy, 0 Huérfanos


| Script | Categoría | Comando | Notas |
|---|---|---|---|
| `dev` | **[OFFICIAL]** | `php -S 0.0.0.0:8000 api.php` |  |
| `server:start` | **[OFFICIAL]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `server:stop` | **[OFFICIAL]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `server:status` | **[OFFICIAL]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `server:logs` | **[OFFICIAL]** | `powershell -NoProfile -Command "Get-Content logs/s...` |  |
| `server:logs:helper` | **[OFFICIAL]** | `powershell -NoProfile -Command "Get-Content logs/o...` |  |
| `test` | **[OFFICIAL]** | `php vendor/bin/phpunit --testsuite Smoke && node b...` |  |
| `gov:status` | **[OFFICIAL]** | `node bin/claim.js status && node bin/report.js` |  |
| `gov:dispatch` | **[OFFICIAL]** | `node bin/dispatch.js --role fullstack` |  |
| `gov:gate` | **[OFFICIAL]** | `node bin/gate.js` |  |
| `perf:baseline` | **[OFFICIAL]** | `node bin/gen-performance-baseline.js` |  |
| `gov:conflict` | **[OFFICIAL]** | `node bin/conflict.js` |  |
| `build` | **[OFFICIAL]** | `node bin/sync-backlog.js && node bin/lint-php-synt...` |  |
| `audit` | **[OFFICIAL]** | `node bin/audit.js` |  |
| `legacy:test` | **[LEGACY]** | `npx playwright test` |  |
| `test:calendar-contract` | **[OFFICIAL]** | `npx playwright test tests/calendar-google-contract...` |  |
| `test:calendar-write` | **[OFFICIAL]** | `npx playwright test tests/calendar-google-write.sp...` |  |
| `test:calendar-write:api` | **[OFFICIAL]** | `node bin/calendar-write-smoke-api.js` |  |
| `test:admin:runtime-smoke` | **[OFFICIAL]** | `npx playwright test tests/admin-ui-runtime-smoke.s...` |  |
| `test:admin:auth` | **[OFFICIAL]** | `node --test tests-node/openclaw-auth-helper.test.j...` |  |
| `test:admin:openclaw-auth` | **[OFFICIAL]** | `npm run test:admin:auth` |  |
| `test:flow-os` | **[OFFICIAL]** | `node --test tests-node/flow-os-domain.test.js` |  |
| `flow-os:summary` | **[OFFICIAL]** | `node bin/flow-os-summary.js` |  |
| `flow-os:recovery:daily` | **[LEGACY]** | `node bin/flow-os-recovery-daily.js --domain https:...` |  |
| `test:admin:queue` | **[OFFICIAL]** | `npm run build:turnero:runtime && npm run check:tur...` |  |
| `test:phase2` | **[OFFICIAL]** | `npx playwright test tests/phase2-calendar-consiste...` |  |
| `test:phase2:probe` | **[OFFICIAL]** | `node bin/run-phase2-flakiness.js --runs=3 --max-fa...` |  |
| `test:critical:agenda` | **[OFFICIAL]** | `npx playwright test tests/calendar-google-contract...` |  |
| `test:critical:funnel` | **[OFFICIAL]** | `npx playwright test tests/funnel-event-api.spec.js...` |  |
| `test:critical:payments` | **[OFFICIAL]** | `php tests/StripeServiceIntegrationTest.php && php ...` |  |
| `test:figo-contract` | **[OFFICIAL]** | `npx playwright test tests/figo-chat-contract.spec....` |  |
| `test:chat-booking-calendar-errors` | **[OFFICIAL]** | `npx playwright test tests/chat-booking-calendar-er...` |  |
| `test:admin-availability-readonly` | **[OFFICIAL]** | `npx playwright test tests/admin-availability-reado...` |  |
| `test:frontend:qa:services` | **[OFFICIAL]** | `npx playwright test tests/service-pages-qa.spec.js...` |  |
| `test:frontend:qa:premium` | **[OFFICIAL]** | `npm run test:frontend:qa:services && npx playwrigh...` |  |
| `test:frontend:qa:v4` | **[LEGACY]** | `npx playwright test tests/public-v4-pricing-locali...` |  |
| `test:public:v4:rollout:gate:contract` | **[LEGACY]** | `node --test tests-node/public-v4-rollout-gate.test...` |  |
| `test:analytics:rollout:contract` | **[OFFICIAL]** | `node --test tests-node/analytics-rollout-contract....` |  |
| `test:frontend:lighthouse:premium` | **[OFFICIAL]** | `node bin/run-lighthouse-premium.js` |  |
| `check:local:artifacts` | **[OFFICIAL]** | `node bin/clean-local-artifacts.js --dry-run` |  |
| `clean:local:artifacts` | **[OFFICIAL]** | `node bin/clean-local-artifacts.js` |  |
| `workspace:hygiene:doctor` | **[OFFICIAL]** | `node bin/workspace-hygiene.js doctor --all-worktre...` |  |
| `workspace:hygiene:status` | **[OFFICIAL]** | `node bin/workspace-hygiene.js status --all-worktre...` |  |
| `workspace:hygiene:fix` | **[OFFICIAL]** | `node bin/workspace-hygiene.js fix` |  |
| `legacy:generated-root:status` | **[LEGACY]** | `node bin/legacy-generated-root-cleanup.js status` |  |
| `legacy:generated-root:check` | **[LEGACY]** | `node bin/legacy-generated-root-cleanup.js check` |  |
| `legacy:generated-root:apply` | **[LEGACY]** | `node bin/legacy-generated-root-cleanup.js apply` |  |
| `benchmark:local` | **[OFFICIAL]** | `bash ./bin/run-benchmark-local.sh` |  |
| `test:frontend:performance:gate` | **[OFFICIAL]** | `node bin/run-public-performance-gate.js` |  |
| `audit:public:v6:visual-contract` | **[OFFICIAL]** | `node bin/audit-public-v6-visual-contract.js --min-...` |  |
| `audit:public:v6:zero-reuse` | **[OFFICIAL]** | `node bin/assert-public-v6-zero-reuse.js` |  |
| `audit:public:v6:copy` | **[OFFICIAL]** | `node bin/audit-public-v6-copy.js --strict` |  |
| `test:public:v5:gateway` | **[LEGACY]** | `node --test tests-node/public-v5-gateway-flags.tes...` |  |
| `test:public:v5:copy:contract` | **[LEGACY]** | `node --test tests-node/public-v5-copy-contract.tes...` |  |
| `test:public:v6:copy:contract` | **[OFFICIAL]** | `node --test tests-node/public-v6-copy-contract.tes...` |  |
| `test:public:v6:helper:contract` | **[OFFICIAL]** | `node --test tests-node/public-v6-test-helper-contr...` |  |
| `test:public:v6:image-decisioning:contract` | **[OFFICIAL]** | `node --test tests-node/public-v6-image-decisioning...` |  |
| `test:public:v6:build:contract` | **[OFFICIAL]** | `node --test tests-node/public-v6-build-contract.te...` |  |
| `test:frontend:qa:v5` | **[LEGACY]** | `npx playwright test tests/public-v5-pricing-locali...` |  |
| `test:frontend:qa:v6` | **[OFFICIAL]** | `npx playwright test tests/public-v6-header-mega.sp...` |  |
| `gate:public:v5:acceptance` | **[LEGACY]** | `npm run content:public-v5:validate && npm run audi...` |  |
| `baseline:public:screenshots` | **[OFFICIAL]** | `node bin/capture-public-baseline.js` |  |
| `baseline:public:compare` | **[OFFICIAL]** | `node bin/compare-public-baseline.js` |  |
| `gate:public:v5:sony:strict` | **[LEGACY]** | `npm run baseline:sony:reference && npm run baselin...` |  |
| `gate:public:v6:from-scratch` | **[OFFICIAL]** | `npm run content:public-v6:validate && npm run buil...` |  |
| `gate:public:v6:sony-evidence` | **[OFFICIAL]** | `npm run gate:public:v6:from-scratch && npm run aud...` |  |
| `gate:public:v6:canonical-publish` | **[OFFICIAL]** | `npm run content:public-v6:validate && npm run chec...` |  |
| `gate:public:v6:quality150` | **[OFFICIAL]** | `node bin/gate-public-v6-quality150.js` |  |
| `gate:staging:acceptance` | **[OFFICIAL]** | `node bin/run-staging-acceptance-gate.js` |  |
| `test:frontend:qa:public` | **[OFFICIAL]** | `npx playwright test tests/homepage.spec.js tests/t...` |  |
| `test:admin:contracts` | **[OFFICIAL]** | `node --test tests-node/admin-keyboard-shortcuts.te...` |  |
| `test:frontend:qa:admin` | **[OFFICIAL]** | `npm run test:admin:contracts && npx playwright tes...` |  |
| `test:frontend:qa:block` | **[OFFICIAL]** | `npm run test:frontend:qa:public && npm run test:fr...` |  |
| `test:frontend:qa:closeout` | **[OFFICIAL]** | `npm run test:frontend:qa:block && npx playwright t...` |  |
| `test:headed` | **[OFFICIAL]** | `npx playwright test --headed` |  |
| `test:ui` | **[OFFICIAL]** | `npx playwright test --ui` |  |
| `test:php` | **[OFFICIAL]** | `php tests/run-php-tests.php` |  |
| `lint` | **[OFFICIAL]** | `npm run lint:js && npm run lint:php` |  |
| `lint:js` | **[OFFICIAL]** | `eslint .` |  |
| `lint:php` | **[OFFICIAL]** | `node bin/lint-php-syntax.js` |  |
| `legacy:build` | **[LEGACY]** | `npm run content:public-v4:validate && npm run cont...` |  |
| `chunks:public:check` | **[OFFICIAL]** | `node bin/clean-public-chunks.js --dry-run --strict` |  |
| `chunks:public:prune` | **[OFFICIAL]** | `node bin/clean-public-chunks.js` |  |
| `check:public:runtime:artifacts` | **[OFFICIAL]** | `node bin/check-public-runtime-artifacts.js` |  |
| `check:runtime:compat:versions` | **[OFFICIAL]** | `node bin/sync-frontend-asset-versions.js --check` |  |
| `sync:runtime:compat:versions` | **[OFFICIAL]** | `node bin/sync-frontend-asset-versions.js` |  |
| `check:runtime:artifacts` | **[OFFICIAL]** | `npm run check:public:runtime:artifacts && npm run ...` |  |
| `chunks:admin:check` | **[OFFICIAL]** | `node bin/clean-admin-chunks.js --dry-run --strict` |  |
| `chunks:admin:prune` | **[OFFICIAL]** | `node bin/clean-admin-chunks.js` |  |
| `astro:dev` | **[OFFICIAL]** | `cd src/apps/astro && astro dev` |  |
| `astro:build` | **[OFFICIAL]** | `cd src/apps/astro && astro build` |  |
| `stage:site-root` | **[OFFICIAL]** | `node src/apps/astro/scripts/sync-dist.mjs` |  |
| `astro:sync` | **[OFFICIAL]** | `node src/apps/astro/scripts/sync-dist.mjs` |  |
| `brand-surface:sync` | **[OFFICIAL]** | `node src/apps/astro/scripts/sync-brand-surface-pac...` |  |
| `build:public:v6` | **[OFFICIAL]** | `node bin/build-public-v6.js` |  |
| `check:public:v6:artifacts` | **[OFFICIAL]** | `node bin/check-public-v6-artifacts.js` |  |
| `check:public:v6:readiness` | **[OFFICIAL]** | `node bin/check-commercial-readiness.js` |  |
| `check:public:v6:truth` | **[OFFICIAL]** | `node bin/check-commercial-truth.js` |  |
| `check:deploy:artifacts` | **[OFFICIAL]** | `npm run check:public:v6:artifacts && npm run check...` |  |
| `assets:versions:sync` | **[OFFICIAL]** | `npm run sync:runtime:compat:versions` |  |
| `assets:versions:check` | **[OFFICIAL]** | `npm run check:runtime:compat:versions` |  |
| `bundle:deploy` | **[OFFICIAL]** | `node bin/prepare-deploy-bundle.js --include-toolin...` |  |
| `verify:prod` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `verify:prod:fast` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `verify:prod:turnero:web-pilot` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `verify:prod:turnero:operator:pilot` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `smoke:prod` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `smoke:prod:turnero:web-pilot` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `smoke:prod:turnero:operator:pilot` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `smoke:calendar:token` | **[OFFICIAL]** | `node bin/smoke-calendar-token.js` |  |
| `smoke:public:routing` | **[OFFICIAL]** | `node bin/check-public-routing-smoke.js` |  |
| `smoke:public:conversion` | **[OFFICIAL]** | `node bin/check-public-conversion-smoke.js` |  |
| `smoke:auth` | **[OFFICIAL]** | `node bin/smoke-auth.js` |  |
| `gate:prod` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `gate:prod:turnero:web-pilot` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `gate:prod:turnero:operator:pilot` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `gate:prod:fast` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `gate:prod:backend` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `gate:prod:hash-strict` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `gate:prod:strict` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `nightly:stability` | **[OFFICIAL]** | `npm run gate:prod && npm run test:critical:agenda ...` |  |
| `monitor:prod` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `checklist:prod:public-sync:host` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `checklist:admin:auth:local` | **[OFFICIAL]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `checklist:admin:openclaw-auth:local` | **[OFFICIAL]** | `npm run checklist:admin:auth:local` |  |
| `diagnose:admin:auth:rollout` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `diagnose:admin:auth:rollout:node` | **[LEGACY]** | `node bin/admin-openclaw-rollout-diagnostic.js --do...` |  |
| `diagnose:admin:openclaw-auth:rollout` | **[OFFICIAL]** | `npm run diagnose:admin:auth:rollout` |  |
| `diagnose:admin:openclaw-auth:rollout:node` | **[OFFICIAL]** | `npm run diagnose:admin:auth:rollout:node` |  |
| `smoke:admin:auth:live:node` | **[LEGACY]** | `node bin/operator-auth-live-smoke.js --transport w...` |  |
| `smoke:admin:openclaw-auth:live:node` | **[OFFICIAL]** | `npm run smoke:admin:auth:live:node` |  |
| `checklist:turnero:operator:pilot` | **[OFFICIAL]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `publish:turnero:operator:pilot` | **[OFFICIAL]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `smoke:admin:auth:local` | **[OFFICIAL]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `smoke:admin:openclaw-auth:local` | **[OFFICIAL]** | `npm run smoke:admin:auth:local` |  |
| `report:weekly:prod` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `test:prod:ops:contracts` | **[OFFICIAL]** | `node --test tests-node/weekly-report-script-contra...` |  |
| `leadops:worker` | **[OFFICIAL]** | `node bin/lead-ai-worker.js --watch` |  |
| `auth:operator:bridge` | **[OFFICIAL]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `openclaw:auth-helper` | **[OFFICIAL]** | `node bin/openclaw-auth-helper.js` |  |
| `openclaw:auth-preflight` | **[OFFICIAL]** | `node bin/openclaw-auth-preflight.js` |  |
| `openclaw:auth:start` | **[OFFICIAL]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `turnero:release:plan` | **[OFFICIAL]** | `node bin/resolve-turnero-release-plan.js` |  |
| `build:turnero:runtime` | **[OFFICIAL]** | `npx rollup -c rollup.config.mjs && npm run chunks:...` |  |
| `check:turnero:runtime` | **[OFFICIAL]** | `node bin/check-turnero-runtime-artifacts.js` |  |
| `turnero:clinic-profile` | **[OFFICIAL]** | `node bin/turnero-clinic-profile.js` |  |
| `turnero:stage:pilot:local` | **[OFFICIAL]** | `node bin/stage-turnero-app-release.js --version 0....` |  |
| `turnero:clinic-profile:verify-remote` | **[OFFICIAL]** | `node bin/turnero-clinic-profile.js verify-remote` |  |
| `verify:turnero:bundle` | **[OFFICIAL]** | `node bin/verify-turnero-release-bundle.js --output...` |  |
| `turnero:verify:bundle` | **[OFFICIAL]** | `npm run verify:turnero:bundle` |  |
| `turnero:verify:pilot:local` | **[OFFICIAL]** | `npm run verify:turnero:bundle -- --outputRoot rele...` |  |
| `assert:release:single-source` | **[OFFICIAL]** | `node bin/assert-release-single-source.js` |  |
| `turnero:surface:scaffold` | **[OFFICIAL]** | `node bin/scaffold-turnero-surface.js` |  |
| `test:turnero:web-pilot:contracts` | **[OFFICIAL]** | `node --test tests-node/admin-data-turnero-clinic-p...` |  |
| `test:turnero:web-pilot:php-contract` | **[OFFICIAL]** | `php tests/test_figo_queue_core.php && php tests/te...` |  |
| `test:turnero:presentation-cut` | **[OFFICIAL]** | `npm run build:public:v6 && node bin/run-playwright...` |  |
| `test:turnero:sony-premium` | **[OFFICIAL]** | `node bin/run-playwright-local.js tests/turnero-son...` |  |
| `test:turnero:web-pilot:ui` | **[OFFICIAL]** | `npm run build:turnero:runtime && npm run check:tur...` |  |
| `gate:turnero:presentation:local` | **[OFFICIAL]** | `node bin/gate-turnero-presentation-local.js` |  |
| `gate:turnero:web-pilot` | **[OFFICIAL]** | `npm run test:turnero:web-pilot:contracts && npm ru...` |  |
| `test:turnero:contracts` | **[OFFICIAL]** | `npm run assert:release:single-source && node --tes...` |  |
| `test:turnero:php-contract` | **[OFFICIAL]** | `npm run test:turnero:web-pilot:php-contract && php...` |  |
| `test:turnero:ui` | **[OFFICIAL]** | `npm run build:turnero:runtime && npm run check:tur...` |  |
| `test:turnero:v2:contracts` | **[OFFICIAL]** | `npm run test:turnero:contracts` |  |
| `test:turnero:v2:php-contract` | **[OFFICIAL]** | `npm run test:turnero:php-contract` |  |
| `test:turnero:v2:ui` | **[OFFICIAL]** | `npm run test:turnero:ui` |  |
| `gate:turnero:v2` | **[OFFICIAL]** | `npm run test:turnero:v2:contracts && npm run test:...` |  |
| `verify:prod:turnero:v2` | **[OFFICIAL]** | `npm run verify:prod:turnero:operator:pilot` |  |
| `smoke:prod:turnero:v2` | **[OFFICIAL]** | `npm run smoke:prod:turnero:operator:pilot` |  |
| `gate:prod:turnero:v2` | **[OFFICIAL]** | `npm run gate:prod:turnero:operator:pilot` |  |
| `gate:turnero` | **[OFFICIAL]** | `npm run gate:turnero:v2` |  |
| `gate:focus:admin-operativo` | **[OFFICIAL]** | `npm run test:admin:auth && npm run test:admin:queu...` |  |
| `admin:ui:contingency` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `gate:admin:rollout` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `gate:admin:rollout:node` | **[LEGACY]** | `node bin/admin-rollout-gate.js --domain https://pi...` |  |
| `gate:admin:rollout:internal` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `gate:admin:rollout:canary` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `gate:admin:rollout:auth` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `gate:admin:rollout:auth:node` | **[LEGACY]** | `node bin/admin-rollout-gate.js --domain https://pi...` |  |
| `gate:admin:rollout:openclaw` | **[OFFICIAL]** | `npm run gate:admin:rollout:auth` |  |
| `gate:admin:rollout:openclaw:node` | **[OFFICIAL]** | `npm run gate:admin:rollout:auth:node` |  |
| `gate:admin:rollout:general` | **[OFFICIAL]** | `npm run gate:admin:rollout` |  |
| `gate:admin:rollout:rollback` | **[LEGACY]** | `powershell -NoProfile -ExecutionPolicy Bypass -Fil...` |  |
| `git:sync:main:safe` | **[OFFICIAL]** | `node bin/sync-main-safe.js --remote origin --branc...` |  |
| `verify:sentry:events` | **[OFFICIAL]** | `node bin/verify-sentry-events.js` |  |
| `prod:readiness:summary` | **[OFFICIAL]** | `node bin/prod-readiness-summary.js` |  |
| `format` | **[OFFICIAL]** | `prettier --write .` |  |
| `agent:sync` | **[OFFICIAL]** | `node agent-orchestrator.js sync` |  |
| `agent:status` | **[OFFICIAL]** | `node agent-orchestrator.js status` |  |
| `agent:intake` | **[OFFICIAL]** | `node agent-orchestrator.js intake --strict` |  |
| `agent:score` | **[OFFICIAL]** | `node agent-orchestrator.js score` |  |
| `agent:stale` | **[OFFICIAL]** | `node agent-orchestrator.js stale --strict` |  |
| `agent:reconcile` | **[OFFICIAL]** | `node agent-orchestrator.js reconcile --strict` |  |
| `agent:budget` | **[OFFICIAL]** | `node agent-orchestrator.js budget --json` |  |
| `agent:conflicts` | **[OFFICIAL]** | `node agent-orchestrator.js conflicts --strict` |  |
| `agent:handoffs` | **[OFFICIAL]** | `node agent-orchestrator.js handoffs` |  |
| `agent:handoffs:lint` | **[OFFICIAL]** | `node agent-orchestrator.js handoffs lint` |  |
| `agent:policy:lint` | **[OFFICIAL]** | `node agent-orchestrator.js policy lint` |  |
| `agent:codex` | **[OFFICIAL]** | `node agent-orchestrator.js codex` |  |
| `agent:codex-check` | **[OFFICIAL]** | `node agent-orchestrator.js codex-check` |  |
| `agent:focus` | **[OFFICIAL]** | `node agent-orchestrator.js focus` |  |
| `agent:decision` | **[OFFICIAL]** | `node agent-orchestrator.js decision` |  |
| `agent:leases` | **[OFFICIAL]** | `node agent-orchestrator.js leases status --json` |  |
| `agent:board:sync:check` | **[OFFICIAL]** | `node agent-orchestrator.js board sync check --json` |  |
| `agent:board:sync:apply` | **[OFFICIAL]** | `node agent-orchestrator.js board sync apply --json` |  |
| `agent:board:doctor` | **[OFFICIAL]** | `node agent-orchestrator.js board doctor --json` |  |
| `claim:next` | **[OFFICIAL]** | `node bin/claim.js next` |  |
| `claim:status` | **[OFFICIAL]** | `node bin/claim.js status` |  |
| `claim:list` | **[OFFICIAL]** | `node bin/claim.js list-pending` |  |
| `claim:take` | **[OFFICIAL]** | `node bin/claim.js claim` |  |
| `claim:done` | **[OFFICIAL]** | `node bin/claim.js release` |  |
| `claim:purge` | **[OFFICIAL]** | `node bin/claim.js purge-expired` |  |
| `verify` | **[OFFICIAL]** | `node bin/verify.js` |  |
| `verify:fix` | **[OFFICIAL]** | `node bin/verify.js --fix` |  |
| `dispatch` | **[OFFICIAL]** | `node bin/dispatch.js --role` |  |
| `dispatch:content` | **[OFFICIAL]** | `node bin/dispatch.js --role content` |  |
| `dispatch:frontend` | **[OFFICIAL]** | `node bin/dispatch.js --role frontend` |  |
| `dispatch:backend` | **[OFFICIAL]** | `node bin/dispatch.js --role backend` |  |
| `dispatch:devops` | **[OFFICIAL]** | `node bin/dispatch.js --role devops` |  |
| `dispatch:fullstack` | **[OFFICIAL]** | `node bin/dispatch.js --role fullstack` |  |
| `report` | **[OFFICIAL]** | `node bin/report.js` |  |
| `report:md` | **[OFFICIAL]** | `node bin/report.js --write` |  |
| `status` | **[OFFICIAL]** | `node bin/status.js` |  |
| `gate` | **[OFFICIAL]** | `node bin/gate.js` |  |
| `backlog` | **[OFFICIAL]** | `node bin/sync-backlog.js` |  |
| `backlog:check` | **[OFFICIAL]** | `node bin/sync-backlog.js --check` |  |
| `agent:board:resolve-revision` | **[OFFICIAL]** | `node bin/resolve-board-revision-conflict.js --file...` |  |
| `agent:board:archive:preview` | **[LEGACY]** | `node bin/archive-agent-board.js --json` |  |
| `agent:board:archive:apply` | **[LEGACY]** | `node bin/archive-agent-board.js --apply --json` |  |
| `agent:task` | **[OFFICIAL]** | `node agent-orchestrator.js task` |  |
| `agent:daily` | **[OFFICIAL]** | `node bin/agent-daily-pulse.js` |  |
| `agent:daily:apply` | **[OFFICIAL]** | `node bin/agent-daily-pulse.js --apply` |  |
| `agent:daily:ci` | **[OFFICIAL]** | `node bin/agent-daily-pulse.js --profile ci --apply` |  |
| `agent:test` | **[LEGACY]** | `npm run chunks:admin:check && node --test tests-no...` |  |
| `agent:summary` | **[OFFICIAL]** | `node bin/agent-governance-summary.js` |  |
| `agent:summary:local` | **[OFFICIAL]** | `node bin/agent-governance-summary.js --profile loc...` |  |
| `agent:summary:ci` | **[OFFICIAL]** | `node bin/agent-governance-summary.js --profile ci` |  |
| `agent:metrics` | **[OFFICIAL]** | `node agent-orchestrator.js metrics` |  |
| `agent:metrics:baseline` | **[OFFICIAL]** | `node agent-orchestrator.js metrics baseline` |  |
| `agent:validate` | **[OFFICIAL]** | `php bin/validate-agent-governance.php` |  |
| `agent:gate` | **[OFFICIAL]** | `node agent-orchestrator.js board doctor --strict -...` |  |
| `agent:gate:release` | **[OFFICIAL]** | `npm run agent:gate && node agent-orchestrator.js f...` |  |
| `mark-done` | **[OFFICIAL]** | `node bin/mark-done.js` |  |
| `gov:check` | **[OFFICIAL]** | `node bin/verify.js && node bin/claim-gc.js --json` |  |
| `gov:done-audit` | **[OFFICIAL]** | `node -e "const fs=require('fs');const f='governanc...` |  |
| `prepare` | **[OFFICIAL]** | `husky` |  |
| `content:public-v6:validate` | **[OFFICIAL]** | `node bin/validate-public-v6-content.js` |  |
| `agent:jobs:status` | **[OFFICIAL]** | `node agent-orchestrator.js jobs status --json` |  |
| `agent:jobs:verify` | **[OFFICIAL]** | `node agent-orchestrator.js jobs verify public_main...` |  |
| `agent:publish:checkpoint` | **[OFFICIAL]** | `node agent-orchestrator.js publish checkpoint` |  |
| `velocity` | **[OFFICIAL]** | `node bin/velocity.js` |  |
| `merge-ready` | **[OFFICIAL]** | `node bin/merge-ready.js` |  |
| `merge-ready:auto` | **[OFFICIAL]** | `node bin/merge-ready.js --merge` |  |
| `report:full` | **[OFFICIAL]** | `node bin/report.js && node bin/velocity.js` |  |
| `conflict` | **[OFFICIAL]** | `node bin/conflict.js` |  |
| `conflict:task` | **[OFFICIAL]** | `node bin/conflict.js --task` |  |
| `gov:audit` | **[OFFICIAL]** | `node bin/audit.js` |  |
| `gov:audit:json` | **[OFFICIAL]** | `node bin/audit.js --json` |  |
| `gov:audit:fix` | **[OFFICIAL]** | `node bin/audit.js --fix` |  |
| `dispatch:ui` | **[OFFICIAL]** | `node bin/dispatch.js --role ui` |  |
| `dispatch:ui:all` | **[OFFICIAL]** | `node bin/dispatch.js --role ui --all` |  |
| `verify:scripts` | **[OFFICIAL]** | `node bin/verify-scripts.js` |  |
| `gen:sitemap` | **[OFFICIAL]** | `node bin/gen-sitemap.js` |  |
| `inject:css` | **[OFFICIAL]** | `node bin/inject-css.js` |  |
| `inject:css:dry` | **[OFFICIAL]** | `node bin/inject-css.js --dry-run` |  |
| `qa:summary` | **[OFFICIAL]** | `node bin/qa-summary.js` |  |
| `qa:summary:json` | **[OFFICIAL]** | `node bin/qa-summary.js --json` |  |
| `qa:summary:prod` | **[LEGACY]** | `node bin/qa-summary.js --domain https://pielarmoni...` |  |
| `gov:claim:gc` | **[OFFICIAL]** | `node bin/claim-gc.js` |  |
| `gov:claim:gc:purge` | **[OFFICIAL]** | `node bin/claim-gc.js --purge` |  |
| `gov:worktree:prune` | **[OFFICIAL]** | `git worktree prune && git worktree list` |  |
| `gov:contract:check` | **[OFFICIAL]** | `node bin/verify-task-contract.js` |  |
| `gov:contract:sprint` | **[OFFICIAL]** | `node bin/verify-task-contract.js --sprint` |  |
| `dispatch:ui:gemini` | **[OFFICIAL]** | `node bin/dispatch.js --role ui` |  |
| `backup` | **[OFFICIAL]** | `bash ops/backup.sh` |  |