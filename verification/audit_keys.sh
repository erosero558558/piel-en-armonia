#!/bin/bash

echo "# Security Audit Report" > verification/audit_results.md
echo "Date: $(date)" >> verification/audit_results.md
echo "" >> verification/audit_results.md

echo "## Hardcoded Secrets Scan" >> verification/audit_results.md
echo "Scanning for API_KEY, SECRET, PASSWORD, TOKEN..." >> verification/audit_results.md
echo "" >> verification/audit_results.md

grep -rE "(API_KEY|SECRET|PASSWORD|TOKEN)" . \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    --exclude-dir=vendor \
    --exclude="audit_results.md" \
    --exclude="audit_keys.sh" \
    --exclude="package-lock.json" \
    --exclude="composer.lock" \
    >> verification/audit_results.md

echo "" >> verification/audit_results.md
echo "## Scan Complete" >> verification/audit_results.md

echo "Audit completed. Check verification/audit_results.md"
