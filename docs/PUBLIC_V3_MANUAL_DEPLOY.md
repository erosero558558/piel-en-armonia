# Public Deploy Wrapper (Legacy Name)

This runbook keeps its historical filename because the VPS wrapper is still named `deploy-public-v3-live.sh`.

Current reality:

- the current public source is V6
- the deploy script publishes V6 artifacts from `main`
- generated public artifacts can live in `.generated/site-root/`, with repo-root copies kept only as compatibility fallback on hosts not migrated yet

## Target host

- repo: `/var/www/figo`
- docroot: `/var/www/figo`
- nginx site: `/etc/nginx/sites-enabled/pielarmonia`

## When to use it

Use this only if:

- `origin/main` already contains the target commit
- the server cron git-sync did not materialize the new commit
- you need an emergency publish path on the VPS

## Publish

Run as `root` on the VPS or through OpenClaw:

```bash
cd /var/www/figo
bash ./bin/deploy-public-v3-live.sh
```

To publish a specific commit:

```bash
cd /var/www/figo
TARGET_COMMIT=<commit-sha> bash ./bin/deploy-public-v3-live.sh
```

If the Nginx-served local verify host is not the default:

```bash
cd /var/www/figo
LOCAL_VERIFY_BASE_URL=http://127.0.0.1:8081 bash ./bin/deploy-public-v3-live.sh
```

## Verify artifacts

```bash
cd /var/www/figo
test -f .generated/site-root/es/index.html || test -f es/index.html && echo ES_OK
test -f .generated/site-root/en/index.html || test -f en/index.html && echo EN_OK
test -d .generated/site-root/_astro || test -d _astro && echo ASTRO_OK
test -f .generated/site-root/script.js || test -f script.js && echo SCRIPT_OK
ls -ld .generated/site-root/es .generated/site-root/en .generated/site-root/_astro 2>/dev/null || true
ls -ld es en _astro 2>/dev/null || true
```

## Verify live routing

```bash
curl -I https://pielarmonia.com/
curl -I https://pielarmonia.com/index.html
curl -I https://pielarmonia.com/es/
curl -I https://pielarmonia.com/en/
curl -I https://pielarmonia.com/es/telemedicina/
curl -I https://pielarmonia.com/telemedicina.html
```

Expected:

- `/` returns `301` to `/es/`
- `/index.html` returns `301` to `/es/`
- `/telemedicina.html` returns `301` to `/es/telemedicina/`
- `/es/` returns `200`
- `/en/` returns `200`

## Notes

- The wrapper name is legacy.
- The public artifact set is V6.
- `deploy-public-v3-live.sh` prefers `.generated/site-root/` for generated assets and falls back to repo-root copies only for compatibility.
- `LOCAL_VERIFY_BASE_URL` only controls the local Nginx-served host checked on the VPS.
- `TEST_BASE_URL` stays reserved for local test/audit suites outside this deploy wrapper.
- Legacy public HTML files such as root `index.html`, `telemedicina.html`, `servicios/**/*.html` and `ninos/**/*.html` are redirect-only and should not exist as authoring source anymore.
