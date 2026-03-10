# GitHub Push Workflow

Daily workflow for uploading project updates to GitHub without deploying to production.

## Recommended flow

1. Create a dedicated branch from the latest `origin/main`:

```bash
bash ./bin/git-branch-publish.sh start feature/mi-cambio
```

2. Make the changes and commit them on that branch.

3. Publish the branch to GitHub:

```bash
bash ./bin/git-branch-publish.sh publish
```

## What `publish` validates

- remote `origin` exists
- `git status` is clean before pushing
- the current branch is not `main`
- there are committed changes ahead of `origin/main`
- if the diff touches governance/orchestration files, it runs:
  - `npm run agent:conflicts`
  - `npm run agent:handoffs:lint`
  - `npm run agent:codex-check`
- after pushing, it fetches the remote branch and prints the diff against `origin/main`

## Important notes

- This workflow does not deploy.
- Direct `push` to `main` stays reserved for explicit live publication.
- If governance/orchestration files changed, `node` and `npm` must be available locally or the pre-push validation will stop the publish.
- Intentional live publication to `main` is documented separately in `docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md`.
