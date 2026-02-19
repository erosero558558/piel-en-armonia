#!/bin/bash
set -u

echo "Running PHP tests..."
FAILED=0
PASSED=0

# Find all php files in tests/ that start with 'test' or 'verify'
# Sort them to have deterministic order
TEST_FILES=$(find tests -name 'test*.php' -o -name 'verify*.php' | sort)

for f in $TEST_FILES; do
    echo "Testing $f..."
    # Run the test and capture output. If it fails, print output.
    # Actually, let's just run it directly so we see output immediately.
    if php "$f"; then
        PASSED=$((PASSED+1))
    else
        echo "FAILED: $f"
        FAILED=$((FAILED+1))
    fi
done

echo ""
echo "Tests passed: $PASSED"
echo "Tests failed: $FAILED"

if [ $FAILED -ne 0 ]; then
    exit 1
fi
exit 0
