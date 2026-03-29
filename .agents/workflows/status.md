---
description: Check the current status of the Aurora Derm backlog and report progress
---

# /status — Ver estado del backlog

## Steps

// turbo
1. Count completed and pending tasks: `grep -c '\[x\]' AGENTS.md && grep -c '\[ \]' AGENTS.md`
// turbo
2. Show current sprint progress: `grep -A 100 'Sprint 1' AGENTS.md | grep -E '^\- \[' | head -15`
// turbo
3. Show acceptance criteria status: `grep -A 20 'Sprint 1 está DONE' AGENTS.md`
// turbo
4. Check git status and last commits: `git log --oneline -10`
// turbo
5. Check if the production site is up: `curl -sS -o /dev/null -w "%{http_code}" https://pielarmonia.com/`

Report a summary of: tasks done vs pending, current sprint, site status, last 5 commits.
