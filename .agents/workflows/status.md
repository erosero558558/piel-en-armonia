---
description: Check the current status of the Aurora Derm backlog, claims, and site health
---

# /status — Estado completo del sistema

## Steps

// turbo
1. Pull latest state: `git pull origin main`

// turbo
2. Board stats: `node bin/claim.js status`

// turbo
3. Auto-verify what's actually done vs what the board says: `node bin/verify.js`

// turbo
4. If verify finds tasks done but not marked, auto-fix: `node bin/verify.js --fix && git add AGENTS.md && HUSKY=0 git commit --no-verify -m "docs: auto-sync board via verify" && git push origin main`

// turbo
5. Next available task recommendation: `node bin/claim.js next`

// turbo
6. Last 5 commits: `git log --oneline -5`

// turbo
7. Production health check: `curl -sS -o /dev/null -w "pielarmonia.com: %{http_code}" https://pielarmonia.com/ && echo ""`

Report: claims status, verify discrepancies (if any), next task to take, last commits.
