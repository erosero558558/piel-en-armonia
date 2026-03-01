#!/usr/bin/env bash
set -Eeuo pipefail

REPO="${REPO:-/var/www/figo}"
TARGET_COMMIT="${TARGET_COMMIT:-$(git -C "$REPO" rev-parse --short origin/main 2>/dev/null || echo main)}"
SITE_PATH="${SITE_PATH:-/etc/nginx/sites-enabled/pielarmonia}"
NGINX_BIN="${NGINX_BIN:-/usr/sbin/nginx}"
INSTALL_DEPS="${INSTALL_DEPS:-true}"

require_cmd() {
    local command_name="$1"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Missing required command: $command_name" >&2
        exit 1
    fi
}

require_cmd git
require_cmd npm
require_cmd curl
require_cmd perl
require_cmd systemctl
test -x "$NGINX_BIN"
test -d "$REPO"

cd "$REPO"

echo "== Repo =="
git fetch origin --prune
git checkout -f main
git reset --hard "$TARGET_COMMIT"
git rev-parse --short HEAD

if [ "$INSTALL_DEPS" = "true" ]; then
    echo "== Dependencies =="
    if command -v composer >/dev/null 2>&1; then
        composer install --no-dev --optimize-autoloader --prefer-dist --no-progress
    else
        echo "Composer not found; skipping composer install."
    fi
    npm ci
fi

echo "== Astro build =="
npm run astro:build
npm run astro:sync

echo "== Verify static output =="
test -f "$REPO/es/index.html"
test -f "$REPO/en/index.html"
test -d "$REPO/_astro"
ls -ld "$REPO/es" "$REPO/en" "$REPO/_astro"

if [ -f "$SITE_PATH" ]; then
    echo "== Patch live Nginx redirect safety =="
    if ! grep -q "absolute_redirect off;" "$SITE_PATH"; then
        perl -0pi -e 's/index index\.php index\.html;/index index.php index.html;\n    absolute_redirect off;\n    port_in_redirect off;/' "$SITE_PATH"
    fi
    perl -0pi -e 's#location = / \{\s*return 301 .*?;\s*\}#location = / {\n        return 301 https://\$host/es/\$is_args\$args;\n    }#s;' "$SITE_PATH"
    perl -0pi -e 's#location = /index\.html \{\s*return 301 .*?;\s*\}#location = /index.html {\n        return 301 https://\$host/es/\$is_args\$args;\n    }#s;' "$SITE_PATH"
    perl -0pi -e 's{return 301 /es/}{return 301 https://\$host/es/}g; s{return 301 /en/}{return 301 https://\$host/en/}g;' "$SITE_PATH"
fi

echo "== Nginx test =="
"$NGINX_BIN" -t

echo "== Reload Nginx =="
systemctl reload nginx

echo "== Local verify =="
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/es/
curl -I http://127.0.0.1:8080/en/
curl -I http://127.0.0.1:8080/telemedicina.html

echo "== Public verify =="
curl -I https://pielarmonia.com/
curl -I https://pielarmonia.com/es/
curl -I https://pielarmonia.com/en/
curl -I https://pielarmonia.com/telemedicina.html

echo "== Done =="
echo "Commit actual: $(git rev-parse --short HEAD)"
