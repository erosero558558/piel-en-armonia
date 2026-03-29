---
description: Check the current status of the Aurora Derm backlog, claims, and site health
---

# /status — Estado completo del sistema

## Steps

// turbo
1. Pull latest state: `git pull origin main`

// turbo
2. Auto-verify board and auto-fix: `node bin/verify.js --fix && git add AGENTS.md && HUSKY=0 git commit --no-verify -m "docs: auto-sync board via verify" && git push origin main 2>/dev/null || true`

// turbo
3. Regenerate lean task index: `node bin/sync-backlog.js && git add BACKLOG.md && HUSKY=0 git commit --no-verify -m "docs: sync BACKLOG.md" && git push origin main 2>/dev/null || true`

// turbo
4. Full board stats and blockers: `node bin/report.js`

// turbo
5. Next task by role — show all 4 roles: `node bin/dispatch.js --role content && node bin/dispatch.js --role frontend && node bin/dispatch.js --role backend && node bin/dispatch.js --role devops`

// turbo
6. Active claims: `node bin/claim.js status`

// turbo
7. Last 5 commits: `git log --oneline -5`

// turbo
8. Production smoke: `curl -sS -o /dev/null -w "pielarmonia.com: %{http_code}\n" https://pielarmonia.com/ 2>/dev/null || echo "pielarmonia.com: unreachable (possible hosting gap)"`

Report back: overall % done, active sprint name, available tasks count, active claims, any blockers the owner needs to answer.
