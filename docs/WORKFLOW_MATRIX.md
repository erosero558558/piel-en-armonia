# Workflow Portfolio Ownership Matrix

| Workflow File | Owner Lane | Severity | Runbook Ref | Required Secrets | Status |
|--------------|------------|-----------|-------------|------------------|--------|
| `agent-board-weekly-snapshot.yml` | `lane-3-generative-ai` | **medium** | N/A | `None` | `active` |
| `agent-daily-pulse.yml` | `lane-3-generative-ai` | **medium** | N/A | `None` | `active` |
| `agent-governance.yml` | `lane-3-generative-ai` | **medium** | N/A | `GITHUB_TOKEN` | `active` |
| `agent-intake.yml` | `lane-3-generative-ai` | **medium** | N/A | `GITHUB_TOKEN` | `active` |
| `calendar-write-smoke.yml` | `lane-1-core-platform` | **high** | N/A | `None` | `active` |
| `ci.yml` | `lane-1-core-platform` | **high** | N/A | `None` | `active` |
| `close-resolved-issues.yml` | `lane-1-core-platform` | **medium** | N/A | `None` | `active` |
| `deploy-frontend-selfhosted.yml` | `lane-2-clinical-ux` | **critical** | [RUNBOOK-deploy-frontend-selfhosted](/docs/runbooks/deploy-frontend-selfhosted.md) | `FTP_SERVER, FTP_USERNAME, FTP_PASSWORD, SSH_HOST, SSH_USERNAME, SSH_PASSWORD` | `active` |
| `deploy-hosting.yml` | `lane-1-core-platform` | **critical** | [RUNBOOK-deploy-hosting](/docs/runbooks/deploy-hosting.md) | `STAGING_FTP_SERVER, STAGING_FTP_USERNAME, STAGING_FTP_PASSWORD, FTP_SERVER, FTP_USERNAME, FTP_PASSWORD` | `active` |
| `deploy-staging.yml` | `lane-1-core-platform` | **critical** | [RUNBOOK-deploy-staging](/docs/runbooks/deploy-staging.md) | `STAGING_FTP_SERVER, STAGING_FTP_USERNAME, STAGING_FTP_PASSWORD` | `active` |
| `diagnose-host-connectivity.yml` | `lane-1-core-platform` | **medium** | N/A | `SSH_HOST, FTP_SERVER` | `active` |
| `frontend-premium-qa.yml` | `lane-2-clinical-ux` | **high** | N/A | `None` | `active` |
| `nightly-stability.yml` | `lane-1-core-platform` | **high** | N/A | `None` | `active` |
| `patient-flow-os-backup-drill.yml` | `lane-1-core-platform` | **critical** | [RUNBOOK-patient-flow-os-backup-drill](/docs/runbooks/patient-flow-os-backup-drill.md) | `PATIENT_FLOW_OS_DATABASE_URL, PATIENT_FLOW_OS_DRILL_DATABASE_URL, PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE, PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_ACCESS_KEY_ID, PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_SECRET_ACCESS_KEY, PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_REGION, PATIENT_FLOW_OS_BACKUP_ESCROW_BUCKET, PATIENT_FLOW_OS_BACKUP_ESCROW_REPLICA_BUCKET` | `active` |
| `patient-flow-os-cutover.yml` | `lane-1-core-platform` | **critical** | [RUNBOOK-patient-flow-os-cutover](/docs/runbooks/patient-flow-os-cutover.md) | `PATIENT_FLOW_OS_DATABASE_URL` | `active` |
| `patient-flow-os-dr-rehearsal-history.yml` | `lane-1-core-platform` | **critical** | [RUNBOOK-patient-flow-os-dr-rehearsal-history](/docs/runbooks/patient-flow-os-dr-rehearsal-history.md) | `None` | `active` |
| `patient-flow-os-escrow-replica-restore.yml` | `lane-1-core-platform` | **critical** | [RUNBOOK-patient-flow-os-escrow-replica-restore](/docs/runbooks/patient-flow-os-escrow-replica-restore.md) | `PATIENT_FLOW_OS_DRILL_DATABASE_URL, PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE, PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_ACCESS_KEY_ID, PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_SECRET_ACCESS_KEY, PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_REGION` | `active` |
| `patient-flow-os-escrow-restore.yml` | `lane-1-core-platform` | **critical** | [RUNBOOK-patient-flow-os-escrow-restore](/docs/runbooks/patient-flow-os-escrow-restore.md) | `PATIENT_FLOW_OS_DRILL_DATABASE_URL, PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE, PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_ACCESS_KEY_ID, PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_SECRET_ACCESS_KEY, PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_REGION` | `active` |
| `patient-flow-os-promote.yml` | `lane-1-core-platform` | **critical** | [RUNBOOK-patient-flow-os-promote](/docs/runbooks/patient-flow-os-promote.md) | `PATIENT_FLOW_OS_DATABASE_URL` | `active` |
| `patient-flow-os-rollback.yml` | `lane-1-core-platform` | **medium** | N/A | `PATIENT_FLOW_OS_DATABASE_URL` | `active` |
| `phase2-concurrency-readonly.yml` | `lane-1-core-platform` | **medium** | N/A | `None` | `stale` |
| `phase2-concurrency-write.yml` | `lane-1-core-platform` | **medium** | N/A | `None` | `stale` |
| `phase2-flakiness-probe.yml` | `lane-1-core-platform` | **medium** | N/A | `None` | `stale` |
| `post-deploy-fast.yml` | `lane-1-core-platform` | **critical** | [RUNBOOK-post-deploy-fast](/docs/runbooks/post-deploy-fast.md) | `None` | `stale` |
| `post-deploy-gate.yml` | `lane-1-core-platform` | **critical** | [RUNBOOK-post-deploy-gate](/docs/runbooks/post-deploy-gate.md) | `None` | `active` |
| `prod-monitor.yml` | `lane-1-core-platform` | **critical** | [RUNBOOK-prod-monitor](/docs/runbooks/prod-monitor.md) | `None` | `active` |
| `promote-windows-hosting-target.yml` | `lane-1-core-platform` | **critical** | [RUNBOOK-promote-windows-hosting-target](/docs/runbooks/promote-windows-hosting-target.md) | `None` | `active` |
| `release-turnero-apps.yml` | `lane-1-core-platform` | **medium** | N/A | `FTP_SERVER, FTP_USERNAME, FTP_PASSWORD` | `active` |
| `repair-git-sync.yml` | `lane-1-core-platform` | **medium** | N/A | `None` | `active` |
| `repair-windows-hosting-over-ssh.yml` | `lane-1-core-platform` | **medium** | N/A | `None` | `stale` |
| `repair-windows-hosting-via-gh-windows.yml` | `lane-1-core-platform` | **medium** | N/A | `None` | `active` |
| `sentry-events-verify.yml` | `lane-1-core-platform` | **medium** | N/A | `SENTRY_AUTH_TOKEN` | `active` |
| `weekly-kpi-report.yml` | `lane-1-core-platform` | **medium** | N/A | `None` | `active` |
