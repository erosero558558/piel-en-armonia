---
description: Execute the next available unclaimed task from the Aurora Derm backlog
---

# /continua — Ejecutar siguiente tarea (protocolo completo)

## Steps

// turbo
1. Pull latest and check board: `git pull origin main && node bin/report.js`

// turbo
2. Check BLOCKERS.md for any [HUMAN] task that now has an answer: `cat BLOCKERS.md | grep -A3 "Respuesta del dueño"`

// turbo
3. Find next task for your role: `node bin/dispatch.js --role <tu-rol>`
   - If you don't know your role, use `fullstack`
   - Available roles: content, frontend, backend, devops, fullstack

4. Read the task details in AGENTS.md fully before starting. If tagged `[HUMAN]` and BLOCKERS.md says `[PENDIENTE]`, skip it — go back to step 3 for next task.

// turbo
5. Claim the task BEFORE starting (other agents skip claimed tasks):
   `node bin/claim.js claim <TASK-ID> "<your-agent-description>"`

// turbo
6. Push the claim immediately so all agents see it:
   `git add data/claims/ && HUSKY=0 git commit --no-verify -m "claim: <TASK-ID>" && git push origin main`

7. Read the relevant context from AGENTS.md:
   - Identity section (WhatsApp, doctors, domain)
   - Design system (CSS tokens — never hardcode colors)
   - Voice guide (always "usted", never "oferta/descuento/promo")
   - Architecture map (file locations)
   Then execute the task.

8. Run the quality gate before marking done:
   `node bin/gate.js <TASK-ID>`
   If it FAILS: fix the issues, then run gate again. Do NOT skip the gate.

// turbo
9. Release claim and commit work:
   `node bin/claim.js release <TASK-ID>`
   `git add . && HUSKY=0 git commit --no-verify -m "feat(<TASK-ID>): <short description>" && git push origin main`

// turbo
10. Auto-sync the board:
    `node bin/verify.js --fix && git add AGENTS.md && HUSKY=0 git commit --no-verify -m "docs: sync board via verify" && git push origin main`
