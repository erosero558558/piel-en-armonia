#!/usr/bin/env bash
set -Eeuo pipefail

REPO="${REPO:-/var/www/figo}"
TARGET_COMMIT="${TARGET_COMMIT:-$(git -C "$REPO" rev-parse --short origin/main 2>/dev/null || echo main)}"
SITE_PATH="${SITE_PATH:-/etc/nginx/sites-enabled/pielarmonia}"
NGINX_BIN="${NGINX_BIN:-/usr/sbin/nginx}"
INSTALL_DEPS="${INSTALL_DEPS:-true}"
DISABLE_DESTRUCTIVE_SYNC_CRON="${DISABLE_DESTRUCTIVE_SYNC_CRON:-true}"
LOCAL_VERIFY_BASE_URL="${LOCAL_VERIFY_BASE_URL:-http://127.0.0.1:8080}"
GENERATED_SITE_ROOT="${GENERATED_SITE_ROOT:-$REPO/.generated/site-root}"
LOCAL_VERIFY_BASE_URL="${LOCAL_VERIFY_BASE_URL%/}"

require_cmd() {
    local command_name="$1"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Missing required command: $command_name" >&2
        exit 1
    fi
}

require_cmd git
require_cmd curl
require_cmd perl
require_cmd systemctl
test -x "$NGINX_BIN"
test -d "$REPO"

resolve_generated_checkout_path() {
    local relative_path="$1"

    if [ -e "$GENERATED_SITE_ROOT/$relative_path" ]; then
        printf '%s\n' "$GENERATED_SITE_ROOT/$relative_path"
        return 0
    fi

    if [ -e "$REPO/$relative_path" ]; then
        printf '%s\n' "$REPO/$relative_path"
        return 0
    fi

    return 1
}

collect_generated_vendor_metadata_files() {
    local generated_files=(
        "vendor/autoload.php"
        "vendor/composer/autoload_classmap.php"
        "vendor/composer/autoload_files.php"
        "vendor/composer/autoload_namespaces.php"
        "vendor/composer/autoload_psr4.php"
        "vendor/composer/autoload_real.php"
        "vendor/composer/autoload_static.php"
        "vendor/composer/installed.php"
        "vendor/composer/installed.json"
        "vendor/composer/InstalledVersions.php"
        "vendor/composer/platform_check.php"
    )
    local file
    for file in "${generated_files[@]}"; do
        if git ls-files --error-unmatch "$file" >/dev/null 2>&1; then
            printf '%s\n' "$file"
        fi
    done

    git ls-files -- 'vendor/bin/*'
}

reset_generated_vendor_metadata() {
    local tracked_files=()
    local file

    while IFS= read -r file; do
        if [ -n "$file" ]; then
            tracked_files+=("$file")
        fi
    done < <(collect_generated_vendor_metadata_files)

    if [ "${#tracked_files[@]}" -gt 0 ]; then
        git checkout -- "${tracked_files[@]}"
        echo "Reset tracked Composer-generated metadata."
    fi
}

verify_canonical_public_artifacts() {
    local required_generated_paths=(
        "es/index.html"
        "en/index.html"
        "_astro"
        "script.js"
        "admin.js"
        "js/chunks"
        "js/engines"
        "js/admin-chunks"
        "js/booking-calendar.js"
        "js/queue-kiosk.js"
        "js/queue-display.js"
    )
    local required_repo_paths=(
        "styles.css"
        "styles-deferred.css"
        "sw.js"
        "js/public-v6-shell.js"
        "js/admin-preboot-shortcuts.js"
        "js/admin-runtime.js"
        "js/monitoring-loader.js"
        "js/queue-operator.js"
        "admin.html"
        "admin-v3.css"
        "operador-turnos.html"
        "kiosco-turnos.html"
        "sala-turnos.html"
        "queue-ops.css"
        "queue-kiosk.css"
        "queue-display.css"
        "app-downloads/index.php"
        "app-downloads/app-downloads.css"
        "app-downloads/app-downloads.js"
        "app-downloads/pilot/release-manifest.json"
        "app-downloads/pilot/SHA256SUMS.txt"
        "app-downloads/pilot/operator/win/TurneroOperadorSetup.exe"
        "app-downloads/pilot/operator/win/TurneroOperadorSetup.exe.blockmap"
        "desktop-updates/pilot/operator/win/latest.yml"
        "desktop-updates/pilot/operator/win/TurneroOperadorSetup.exe"
        "desktop-updates/pilot/operator/win/TurneroOperadorSetup.exe.blockmap"
    )
    local required_path
    local resolved_generated_path=""
    for required_path in "${required_generated_paths[@]}"; do
        if ! resolved_generated_path="$(resolve_generated_checkout_path "$required_path")"; then
            echo "Missing canonical generated public artifact: $required_path (expected in $GENERATED_SITE_ROOT or $REPO)" >&2
            exit 1
        fi
    done

    for required_path in "${required_repo_paths[@]}"; do
        if [ ! -e "$REPO/$required_path" ]; then
            echo "Missing canonical public artifact: $REPO/$required_path" >&2
            exit 1
        fi
    done

    echo "Canonical public artifacts present in repo checkout or $GENERATED_SITE_ROOT."
}

normalize_public_web_tree_permissions() {
    local public_dirs=(
        "$GENERATED_SITE_ROOT/es"
        "$GENERATED_SITE_ROOT/en"
        "$GENERATED_SITE_ROOT/_astro"
        "$GENERATED_SITE_ROOT/js/chunks"
        "$GENERATED_SITE_ROOT/js/engines"
        "$GENERATED_SITE_ROOT/js/admin-chunks"
        "$REPO/es"
        "$REPO/en"
        "$REPO/_astro"
        "$REPO/js"
        "$REPO/app-downloads"
        "$REPO/desktop-updates"
    )
    local public_files=(
        "$GENERATED_SITE_ROOT/script.js"
        "$GENERATED_SITE_ROOT/admin.js"
        "$GENERATED_SITE_ROOT/js/booking-calendar.js"
        "$GENERATED_SITE_ROOT/js/queue-kiosk.js"
        "$GENERATED_SITE_ROOT/js/queue-display.js"
        "$REPO/index.php"
        "$REPO/script.js"
        "$REPO/styles.css"
        "$REPO/styles-deferred.css"
        "$REPO/sw.js"
        "$REPO/js/public-v6-shell.js"
        "$REPO/admin.html"
        "$REPO/admin-v3.css"
        "$REPO/js/admin-preboot-shortcuts.js"
        "$REPO/js/admin-runtime.js"
        "$REPO/js/monitoring-loader.js"
        "$REPO/js/queue-operator.js"
        "$REPO/operador-turnos.html"
        "$REPO/kiosco-turnos.html"
        "$REPO/sala-turnos.html"
        "$REPO/queue-ops.css"
        "$REPO/queue-kiosk.css"
        "$REPO/queue-display.css"
    )
    local public_dir
    local public_file

    for public_dir in "${public_dirs[@]}"; do
        if [ -d "$public_dir" ]; then
            find "$public_dir" -type d -exec chmod 0755 {} +
            find "$public_dir" -type f -exec chmod 0644 {} +
        fi
    done

    for public_file in "${public_files[@]}"; do
        if [ -f "$public_file" ]; then
            chmod 0644 "$public_file"
        fi
    done

    echo "Normalized public web tree permissions."
}

describe_public_web_tree() {
    local describe_paths=(
        "$GENERATED_SITE_ROOT/es"
        "$GENERATED_SITE_ROOT/en"
        "$GENERATED_SITE_ROOT/_astro"
        "$GENERATED_SITE_ROOT/js/chunks"
        "$GENERATED_SITE_ROOT/js/engines"
        "$GENERATED_SITE_ROOT/js/admin-chunks"
        "$GENERATED_SITE_ROOT/script.js"
        "$GENERATED_SITE_ROOT/admin.js"
        "$REPO/es"
        "$REPO/en"
        "$REPO/_astro"
        "$REPO/js/chunks"
        "$REPO/js/engines"
        "$REPO/app-downloads"
        "$REPO/desktop-updates"
        "$REPO/admin.html"
        "$REPO/operador-turnos.html"
        "$REPO/kiosco-turnos.html"
        "$REPO/sala-turnos.html"
    )
    local existing_paths=()
    local describe_path=""

    for describe_path in "${describe_paths[@]}"; do
        if [ -e "$describe_path" ]; then
            existing_paths+=("$describe_path")
        fi
    done

    if [ "${#existing_paths[@]}" -gt 0 ]; then
        ls -ld "${existing_paths[@]}"
    fi
}

cd "$REPO"

if [ "$DISABLE_DESTRUCTIVE_SYNC_CRON" = "true" ] && command -v crontab >/dev/null 2>&1; then
    echo "== Cron guard =="
    current_crontab="$(mktemp)"
    filtered_crontab="$(mktemp)"

    if crontab -l >"$current_crontab" 2>/dev/null; then
        awk -v repo="$REPO" '
            index($0, repo) && index($0, "git clean -fd") { next }
            { print }
        ' "$current_crontab" >"$filtered_crontab"

        if ! cmp -s "$current_crontab" "$filtered_crontab"; then
            crontab "$filtered_crontab"
            echo "Removed destructive cron entries targeting $REPO with git clean -fd."
        else
            echo "No destructive git clean cron entries found for $REPO."
        fi
    else
        echo "No user crontab present."
    fi

    rm -f "$current_crontab" "$filtered_crontab"
fi

echo "== Repo =="
git fetch origin --prune
git checkout -f main
git reset --hard "$TARGET_COMMIT"
git rev-parse --short HEAD

if [ "$INSTALL_DEPS" = "true" ]; then
    echo "== Dependencies =="
    if command -v composer >/dev/null 2>&1; then
        composer install --no-dev --optimize-autoloader --prefer-dist --no-progress
        reset_generated_vendor_metadata
    else
        echo "Composer not found; skipping composer install."
    fi
fi

echo "== Verify canonical public artifacts =="
verify_canonical_public_artifacts
normalize_public_web_tree_permissions
describe_public_web_tree

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
echo "Local verify target: $LOCAL_VERIFY_BASE_URL"
curl -I "$LOCAL_VERIFY_BASE_URL/"
curl -I "$LOCAL_VERIFY_BASE_URL/admin.html"
curl -I "$LOCAL_VERIFY_BASE_URL/es/"
curl -I "$LOCAL_VERIFY_BASE_URL/en/"
curl -I "$LOCAL_VERIFY_BASE_URL/telemedicina.html"
curl -I "$LOCAL_VERIFY_BASE_URL/operador-turnos.html"
curl -I "$LOCAL_VERIFY_BASE_URL/kiosco-turnos.html"
curl -I "$LOCAL_VERIFY_BASE_URL/sala-turnos.html"
curl -I "$LOCAL_VERIFY_BASE_URL/app-downloads/"
curl -I "$LOCAL_VERIFY_BASE_URL/app-downloads/?surface=operator&platform=win"
curl -I "$LOCAL_VERIFY_BASE_URL/desktop-updates/pilot/operator/win/latest.yml"
curl -I "$LOCAL_VERIFY_BASE_URL/app-downloads/pilot/operator/win/TurneroOperadorSetup.exe"

echo "== Public verify =="
curl -I https://pielarmonia.com/
curl -I https://pielarmonia.com/admin.html
curl -I https://pielarmonia.com/es/
curl -I https://pielarmonia.com/en/
curl -I https://pielarmonia.com/telemedicina.html
curl -I https://pielarmonia.com/operador-turnos.html
curl -I https://pielarmonia.com/kiosco-turnos.html
curl -I https://pielarmonia.com/sala-turnos.html
curl -I https://pielarmonia.com/app-downloads/
curl -I "https://pielarmonia.com/app-downloads/?surface=operator&platform=win"
curl -I https://pielarmonia.com/desktop-updates/pilot/operator/win/latest.yml
curl -I https://pielarmonia.com/app-downloads/pilot/operator/win/TurneroOperadorSetup.exe

echo "== Done =="
echo "Commit actual: $(git rev-parse --short HEAD)"
