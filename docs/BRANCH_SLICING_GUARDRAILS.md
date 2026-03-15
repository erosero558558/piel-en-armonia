# Branch Slicing Guardrails

This guide defines the canonical review cut for the shared-focus model.

The hierarchy is:

- `AGENTS.md` decides file ownership and lane constraints.
- `AGENT_BOARD.yaml.strategy.active` decides the active strategy and subfront.
- `focus_*` fields decide the current shared proof cut.
- This document decides how a branch or PR must be sliced for review and rollback.

## Rule

- One branch should answer one primary review question.
- One branch or PR must map to exactly one `integration_slice`.
- One branch or PR must map to exactly one `focus_step`.
- If a change needs more than one `integration_slice`, split it unless the coupling is explicit and unavoidable.
- If a branch cannot answer a single review question, it is too wide.

`AGENTS.md` decides who owns the files.
`TRI_LANE_RUNTIME_RUNBOOK.md` decides which Codex lane executes.

## Preferred Review Labels

Use these human-readable labels in PRs, branch naming and review chat even when
the board stores a more specific `integration_slice` token:

- `ops/deploy`
- `queue runtime`
- `desktop shells`
- `tests`
- `governance evidence`

If the branch crosses `ops/deploy`, `queue runtime`, `desktop shells`,
`tests` or `governance evidence`, split it unless the coupling is explicit and
the rollback path stays the same.

Suggested shorthand branch families:

- `feature/queue-runtime-*`
- `ops/*`
- `docs/*` or `chore/*` for governance evidence

## Canonical Integration Slices

### 1. `frontend_runtime`

Use this slice when the main change lives in:

- `src/apps/**`
- `templates/**`
- `content/**`
- `js/**`
- `*.html`
- public or admin browser runtime glue

Suggested branch names:

- `focus/frontend-runtime-admin-queue-cut`
- `focus/frontend-runtime-feedback-trim`

Repo-specific paths that usually stay in this cut:

- `src/apps/admin-v3/**/queue/**`
- `src/apps/queue-operator/**`

### 2. `backend_readiness`

Use this slice when the main change lives in:

- `controllers/**`
- `lib/**`
- `api.php`
- `figo-*.php`
- auth/readiness/backend support for the active proof

Suggested branch names:

- `focus/backend-readiness-admin-auth`
- `focus/backend-readiness-queue-support`

### 3. `runtime_support`

Use this slice when the main change lives in:

- `figo-ai-bridge.php`
- `lib/figo_queue.php`
- `lib/auth.php`
- `controllers/OperatorAuthController.php`
- `controllers/LeadAiController.php`
- `bin/lead-ai-worker.js`
- runtime OpenClaw support needed to unblock the active proof

Suggested branch names:

- `focus/runtime-support-openclaw-auth`
- `focus/runtime-support-queue-bridge`

### 4. `ops_deploy`

Use this slice when the main change lives in:

- `.github/workflows/**`
- deploy/ops scripts
- monitoring or rollout hooks
- production readiness checks tied directly to the active proof

Suggested branch names:

- `focus/ops-deploy-public-main-sync`
- `focus/ops-deploy-admin-rollout-gate`

### 5. `desktop_shells`

Use this slice when the main change lives in:

- `src/apps/turnero-desktop/**`
- desktop shell packaging or release files
- download catalogs that only exist to ship desktop shells

Suggested branch names:

- `focus/desktop-shells-turnero-pilot`
- `focus/desktop-shells-kiosk-cut`

### 6. `tests_quality`

Use this slice when the main change is primarily validation, harnesses, fixtures, or reliability work:

- `tests/**`
- `tests-node/**`
- shared fixtures/builders/helpers
- smoke coverage needed to prove the current `focus_step`

Suggested branch names:

- `focus/tests-quality-admin-pilot-cut`
- `focus/tests-quality-runtime-readiness`

### 7. `governance_evidence`

Use this slice when the main change is coordination, policy, or proof capture:

- `agent-orchestrator.js`
- `tools/agent-orchestrator/**`
- `AGENTS.md`
- `AGENT_BOARD.yaml`
- `AGENT_DECISIONS.yaml`
- `AGENT_HANDOFFS.yaml`
- `verification/**`
- governance/audit/runbook docs

Short label mapping for review:

- `ops/deploy` -> `ops_deploy`
- `queue runtime` -> `frontend_runtime`, `backend_readiness` or `runtime_support`, depending on where the queue cut actually lives
- `desktop shells` -> `desktop_shells`
- `tests` -> `tests_quality`
- `governance evidence` -> `governance_evidence`

Suggested branch names:

- `focus/governance-evidence-shared-focus-v2`
- `focus/governance-evidence-audit-closeout`

## What Can Travel Together

- Source files and their direct generated outputs can travel together inside the same `integration_slice`.
- A small local test change can travel with the runtime slice it validates.
- A small doc change can travel with the slice it documents.
- Minimal board/evidence updates can travel with a runtime slice only when they are required to unblock that exact `focus_step`.

## What Should Stay Separate

- `frontend_runtime` from `backend_readiness` unless one review question truly spans both.
- `runtime_support` from `ops_deploy` unless the runtime change cannot be validated without the deploy change in the same cut.
- `desktop_shells` from browser runtime work.
- broad `tests_quality` cleanup from feature delivery.
- `governance_evidence` from unrelated runtime work.

## Slicing Checklist

Before opening or growing a branch:

1. Name the `focus_step` this branch supports.
2. Name the single `integration_slice` this branch belongs to.
3. List touched paths and confirm they stay inside that slice.
4. If the branch crosses into a second slice, split it unless the coupling is explicit.
5. If the branch crosses lanes, open the required handoff from `AGENTS.md`.
6. If rollback, validation, or ownership differs across touched paths, it should probably be more than one branch.

## Example

Bad mixed branch:

- admin UI runtime edits in `src/apps/**`
- auth/readiness PHP changes in `controllers/**`
- deploy workflow edits in `.github/workflows/**`
- governance updates in `AGENT_BOARD.yaml`
- broad Playwright cleanup in `tests/**`

Better split:

1. `focus/frontend-runtime-*`
2. `focus/backend-readiness-*`
3. `focus/ops-deploy-*`
4. `focus/tests-quality-*`
5. `focus/governance-evidence-*`

## Practical Default

If you are unsure, keep the smallest branch that can pass its own validation and can be described as:

`one focus_step + one integration_slice + one review question`
