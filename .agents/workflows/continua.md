---
description: Execute the next pending task from the Aurora Derm backlog
---

# /continua — Ejecutar siguiente tarea pendiente

## Steps

1. Read `AGENTS.md` to understand the product context and current sprint
// turbo
2. Search AGENTS.md for the first unchecked task `- [ ]` in the current sprint (Sprint 1 first, then Sprint 2, etc.)
// turbo
3. Read the relevant source files identified in the task description
4. Execute the task (create/modify files as specified)
5. Verify the work:
   - For HTML pages: validate the HTML is well-formed and uses the correct CSS variables from `styles/main-aurora.css`
   - For backend: test with `curl http://localhost:8000/api.php?resource=<endpoint>`
   - For content: check for prohibited vocabulary ("oferta", "descuento", "tú") and ensure medical disclaimers are present
// turbo
6. Commit with task ID: `HUSKY=0 git commit --no-verify -m "feat(S1-XX): description"`
// turbo
7. Mark the task as `[x]` in AGENTS.md
// turbo
8. Commit the AGENTS.md update: `HUSKY=0 git commit --no-verify -m "docs: mark S1-XX as done"`
// turbo
9. Push to main: `git push origin main`
