---
description: Execute the next available unclaimed task from the Aurora Derm backlog
---

# /continua — Ejecutar siguiente tarea (con claim anti-colisión)

## Steps

// turbo
1. Pull latest: `git pull origin main`

// turbo
2. Find the next available unclaimed task: `node bin/claim.js next`

3. Read the task details carefully from AGENTS.md. If tagged `[HUMAN]`, ask the owner before proceeding and STOP.

4. Claim the task before starting work:
   ```
   node bin/claim.js claim <TASK-ID> "<your-agent-description>"
   ```
   Example: `node bin/claim.js claim S2-01 "Gemini-Antigravity"`

// turbo
5. Commit the claim immediately so other agents see it:
   `git add data/claims/ && HUSKY=0 git commit --no-verify -m "claim: <TASK-ID>" && git push origin main`

6. Read the relevant context from AGENTS.md (Identity, Design system, Voice, Architecture map). Then execute the task.

7. Verify the work:
   - HTML: check for broken links, CSS variables used (not hardcoded colors), `usted` not `tú`
   - Backend: `curl http://localhost:8000/api.php?resource=<endpoint>`
   - Content: no prohibited words (oferta/descuento/promo), medical disclaimer present, no guaranteed results

// turbo
8. Release the claim and commit the work:
   ```
   node bin/claim.js release <TASK-ID>
   ```

// turbo
9. Mark the task `[x]` in AGENTS.md and commit everything:
   `git add . && HUSKY=0 git commit --no-verify -m "feat(<TASK-ID>): <short description>" && git push origin main`
