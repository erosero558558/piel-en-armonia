#!/usr/bin/env bash
set -euo pipefail

usage() {
    cat <<'EOF'
Usage: bash ops/backup.sh [--help]

Creates a gzip-compressed encrypted JSON snapshot at:
  data/backups/YYYY-MM-DD-HH.json.gz

Environment:
  BACKUP_TIMESTAMP=YYYY-MM-DD-HH   Override snapshot name (useful for tests)
  BACKUP_RETENTION_DAYS=7          How many days of hourly snapshots to keep
  BACKUP_TZ=America/Guayaquil      Timezone used when BACKUP_TIMESTAMP is omitted
  PHP_BIN=php                      PHP binary to use
EOF
}

if [[ "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHP_BIN="${PHP_BIN:-php}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_TZ="${BACKUP_TZ:-America/Guayaquil}"

if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || [[ "$RETENTION_DAYS" -lt 1 ]]; then
    echo "BACKUP_RETENTION_DAYS must be a positive integer." >&2
    exit 1
fi

if ! command -v "$PHP_BIN" >/dev/null 2>&1; then
    echo "PHP binary not found: $PHP_BIN" >&2
    exit 1
fi

if ! command -v gzip >/dev/null 2>&1; then
    echo "gzip is required to build compressed backups." >&2
    exit 1
fi

TIMESTAMP="${BACKUP_TIMESTAMP:-$(TZ="$BACKUP_TZ" date '+%F-%H')}"

BACKUP_DIR="$(
    ROOT_DIR="$ROOT_DIR" "$PHP_BIN" -r '
        require getenv("ROOT_DIR") . "/lib/storage.php";
        if (!ensure_backup_dir()) {
            fwrite(STDERR, "backup_dir_not_ready\n");
            exit(1);
        }
        echo backup_dir_path();
    '
)"

OUTPUT_FILE="${BACKUP_DIR}/${TIMESTAMP}.json.gz"
TMP_FILE="${OUTPUT_FILE}.tmp"

ROOT_DIR="$ROOT_DIR" "$PHP_BIN" -r '
    require getenv("ROOT_DIR") . "/lib/storage.php";
    $store = read_store();
    $raw = json_encode($store, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if (!is_string($raw) || trim($raw) === "") {
        fwrite(STDERR, "store_encode_failed\n");
        exit(1);
    }

    $encoded = data_encrypt_payload($raw);
    if (!is_string($encoded) || trim($encoded) === "") {
        fwrite(STDERR, "store_encrypt_failed\n");
        exit(1);
    }

    echo $encoded;
' | gzip -c > "$TMP_FILE"

mv "$TMP_FILE" "$OUTPUT_FILE"

PRUNED_COUNT="$(
    BACKUP_DIR="$BACKUP_DIR" RETENTION_DAYS="$RETENTION_DAYS" "$PHP_BIN" -r '
        $dir = getenv("BACKUP_DIR");
        $retentionDays = max(1, (int) getenv("RETENTION_DAYS"));
        $threshold = time() - ($retentionDays * 86400);
        $removed = 0;

        foreach (glob($dir . DIRECTORY_SEPARATOR . "????-??-??-??.json.gz") ?: [] as $path) {
            if (!is_file($path)) {
                continue;
            }

            $mtime = @filemtime($path);
            if (is_int($mtime) && $mtime < $threshold && @unlink($path)) {
                $removed++;
            }
        }

        echo $removed;
    '
)"

BYTES="$(wc -c < "$OUTPUT_FILE" | tr -d ' ')"
echo "Backup created: $OUTPUT_FILE"
echo "Size bytes: ${BYTES}"
echo "Retention days: ${RETENTION_DAYS}"
echo "Pruned snapshots: ${PRUNED_COUNT}"
