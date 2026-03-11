# Public V6 Canonical Source

This document freezes the public web contract for the V6 cutover.

## Canonical authoring source

Only these paths define the public website:

- `src/apps/astro/src/pages/es/**`
- `src/apps/astro/src/pages/en/**`
- `src/apps/astro/src/components/public-v6/**`
- `src/apps/astro/src/layouts/PublicShellV6.astro`
- `src/apps/astro/src/lib/public-v6.js`
- `src/apps/astro/src/styles/public-v6/**`
- `content/public-v6/**`
- `js/public-v6-shell.js`
- `images/optimized/**`

## Generated deploy artifacts

These paths stay versioned because production publishes from git-sync, but they are output only and must not be edited by hand:

- `es/**`
- `en/**`
- `_astro/**`

Generation flow:

1. `npm run build:public:v6`
2. `npm run check:public:v6:artifacts`
3. Commit artifacts to `main`

`build:public:v6` is the canonical runner. It executes, in order:

1. `content:public-v6:validate`
2. `astro:build`
3. `astro:sync`
4. `check:public:v6:artifacts --skip-build`

It also writes:

- `verification/public-v6-canonical/build-report.json`

## Versioned public gateway runtime

These paths also stay versioned because the root public gateway publishes from git-sync, but they are generated runtime artifacts and must not be edited by hand:

- `styles.css`
- `styles-deferred.css`
- `script.js`
- `js/chunks/**`
- `js/engines/**`

The gateway no longer accepts root legacy runtime files such as
`booking-engine.js` or `utils.js`. Historical residues live only in
`js/archive/root-legacy/**`.

Canonical runtime flow:

1. `npm run build`
2. `npm run check:public:runtime:artifacts`
3. Commit artifacts to `main`

`check:public:runtime:artifacts` is the canonical verifier. It enforces:

- `styles.css` and `styles-deferred.css` are present for the root gateway support layer
- exactly one active `shell-*.js` chunk reachable from `script.js`
- no stale chunks left in `js/chunks/**`
- any engine file referenced from `script.js` exists in `js/engines/**`
- no merge markers in active runtime assets

It writes:

- `verification/public-v6-canonical/runtime-artifacts-report.json`

## Redirect-only legacy routes

These legacy entrypoints remain public, but only as redirects:

- `/`
- `/index.html`
- `/telemedicina.html`
- `/servicios/*.html`
- `/ninos/*.html`
- `/terminos.html`
- `/privacidad.html`
- `/cookies.html`
- `/aviso-medico.html`

The redirect contract lives in:

- `.htaccess`
- `nginx-pielarmonia.conf`
- `bin/check-public-routing-smoke.js`

## Canonical publish path

The official publish path is:

1. Edit V6 source files.
2. Generate V6 artifacts.
3. push to main
4. cron git-sync updates `/var/www/figo`

GitHub Actions validate and provide transport fallback, but they do not replace `main` as the source of truth.

## Green checks for public web

A public V6 release is green only if these pass:

- `npm run build:public:v6`
- `npm run check:public:v6:artifacts`
- `npm run check:public:runtime:artifacts`
- `npm run test:frontend:qa:v6`
- `npm run audit:public:v6:copy`
- `npm run audit:public:v6:visual-contract`
- `npm run audit:public:v6:sony-parity`
- `npm run smoke:public:routing`
- `npm run smoke:public:conversion`
- `node bin/assert-public-v6-single-source.js`

For local audits and evidence:

- `audit-public-v6-visual-contract.js` accepts `--base-url` and otherwise starts the canonical local helper automatically.
- `audit-public-v6-sony-evidence.js` propagates the same runtime base URL to the visual contract and records it in the output artifacts.
- `capture-public-baseline.js` accepts `--base-url` and otherwise starts the same canonical local helper automatically.

## Explicit non-source files

These are no longer public authoring inputs:

- `bin/build-html.js`
- `servicios/build-service-pages.js`
- `templates/index.template.html`
- `templates/telemedicina.template.html`
- `index.html`
- `telemedicina.html`
- `servicios/**`
- `ninos/**`
- `src/apps/astro/scripts/serve-public-v3.mjs`
- `script.js`
- `js/chunks/**`
- `js/engines/**`
- `styles.css`
- `styles-deferred.css`
- `booking-engine.js`
- `utils.js`
- root `*-engine.js` snapshots outside `js/engines/**`
