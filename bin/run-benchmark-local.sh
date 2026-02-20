#!/bin/bash
set -euo pipefail

HOST="127.0.0.1"
PORT="8080"
BASE_URL="http://${HOST}:${PORT}"
OUTPUT_FILE="docs/PERFORMANCE_BASELINE.md"
PID_FILE=".php_server_pid"

# Cleanup function
cleanup() {
    if [ -f "$PID_FILE" ]; then
        kill $(cat "$PID_FILE") 2>/dev/null || true
        rm "$PID_FILE"
    fi
}
trap cleanup EXIT

echo "Starting PHP server..."
php -S "${HOST}:${PORT}" > /dev/null 2>&1 &
echo $! > "$PID_FILE"

# Wait for server
for i in {1..10}; do
    if curl -s "${BASE_URL}/" > /dev/null; then
        echo "Server is up."
        break
    fi
    sleep 1
done

echo "Running benchmark..."
echo "# Performance Baseline" > "$OUTPUT_FILE"
echo "Date: $(date)" >> "$OUTPUT_FILE"
echo "Environment: Local (php -S)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| Endpoint | Avg (s) | P95 (s) | Status |" >> "$OUTPUT_FILE"
echo "|---|---|---|---|" >> "$OUTPUT_FILE"

measure_endpoint() {
    local NAME=$1
    local URL=$2
    local SAMPLES=20
    local TIMES_FILE=$(mktemp)

    for i in $(seq 1 $SAMPLES); do
        curl -w "%{time_total}\n" -o /dev/null -s "$URL" >> "$TIMES_FILE"
    done

    # Calculate Avg and P95 using awk
    local AVG=$(awk '{ sum += $1 } END { if (NR > 0) print sum / NR }' "$TIMES_FILE")
    local SORTED_FILE=$(mktemp)
    sort -n "$TIMES_FILE" > "$SORTED_FILE"
    # P95 index
    local LINES=$(wc -l < "$SORTED_FILE")
    local P95_IDX=$(awk -v lines="$LINES" 'BEGIN { idx=int(lines * 0.95); if(idx==0) idx=1; print idx }')
    local P95=$(sed -n "${P95_IDX}p" "$SORTED_FILE")

    echo "| $NAME | $AVG | $P95 | OK |" >> "$OUTPUT_FILE"
    echo "  Measured $NAME: Avg=${AVG}s, P95=${P95}s"
    rm "$TIMES_FILE" "$SORTED_FILE"
}

measure_endpoint "Home /" "${BASE_URL}/"
measure_endpoint "Health Check" "${BASE_URL}/api.php?resource=health"
measure_endpoint "Availability" "${BASE_URL}/api.php?resource=availability"
measure_endpoint "Service Reviews" "${BASE_URL}/api.php?resource=reviews"
measure_endpoint "Figo Chat (GET)" "${BASE_URL}/figo-chat.php"

echo "Benchmark complete. Results saved to $OUTPUT_FILE"
cat "$OUTPUT_FILE"
