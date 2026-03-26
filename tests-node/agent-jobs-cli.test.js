#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
    copyFileSync,
    cpSync,
    rmSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = resolve(__dirname, '..');
const ORCHESTRATOR_SOURCE = join(REPO_ROOT, 'agent-orchestrator.js');
const ORCHESTRATOR_TOOLS_DIR = join(REPO_ROOT, 'tools', 'agent-orchestrator');
const GOVERNANCE_POLICY_SOURCE = join(REPO_ROOT, 'governance-policy.json');
const WORKSPACE_HYGIENE_SOURCE = join(
    REPO_ROOT,
    'bin',
    'lib',
    'workspace-hygiene.js'
);
const GENERATED_SITE_ROOT_SOURCE = join(
    REPO_ROOT,
    'bin',
    'lib',
    'generated-site-root.js'
);
const CLEAN_LOCAL_ARTIFACTS_SOURCE = join(
    REPO_ROOT,
    'bin',
    'clean-local-artifacts.js'
);

function createFixtureDir() {
    const dir = mkdtempSync(join(tmpdir(), 'agent-jobs-cli-test-'));
    copyFileSync(ORCHESTRATOR_SOURCE, join(dir, 'agent-orchestrator.js'));
    cpSync(ORCHESTRATOR_TOOLS_DIR, join(dir, 'tools', 'agent-orchestrator'), {
        recursive: true,
    });
    copyFileSync(GOVERNANCE_POLICY_SOURCE, join(dir, 'governance-policy.json'));
    mkdirSync(join(dir, 'bin', 'lib'), { recursive: true });
    copyFileSync(
        WORKSPACE_HYGIENE_SOURCE,
        join(dir, 'bin', 'lib', 'workspace-hygiene.js')
    );
    copyFileSync(
        GENERATED_SITE_ROOT_SOURCE,
        join(dir, 'bin', 'lib', 'generated-site-root.js')
    );
    copyFileSync(
        CLEAN_LOCAL_ARTIFACTS_SOURCE,
        join(dir, 'bin', 'clean-local-artifacts.js')
    );
    return dir;
}

function cleanupFixtureDir(dir) {
    rmSync(dir, { recursive: true, force: true });
}

function writeFixtureFiles(dir) {
    const statusDir = join(dir, 'runtime');
    mkdirSync(statusDir, { recursive: true });
    const statusPath = join(statusDir, 'public-sync-status.json');
    const nowIso = new Date().toISOString();

    writeFileSync(
        statusPath,
        `${JSON.stringify(
            {
                version: 1,
                job_id: '8d31e299-7e57-4959-80b5-aaa2d73e9674',
                job_key: 'public_main_sync',
                state: 'ok',
                checked_at: nowIso,
                last_success_at: nowIso,
                deployed_commit: 'abc1234',
                repo_path: '/var/www/figo',
                branch: 'main',
                current_head: 'abc1234',
                remote_head: 'abc1234',
                dirty_paths_count: 2,
                dirty_paths_sample: ['vendor/autoload.php', '_astro/app.js'],
                dirty_paths: ['vendor/autoload.php', '_astro/app.js'],
                duration_ms: 912,
                lock_file: '/tmp/sync-pielarmonia.lock',
                log_path: '/var/log/sync-pielarmonia.log',
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    writeFileSync(
        join(dir, 'AGENT_BOARD.yaml'),
        `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: 2026-03-03
tasks: []
`,
        'utf8'
    );
    writeFileSync(
        join(dir, 'AGENT_HANDOFFS.yaml'),
        'version: 1\nhandoffs: []\n',
        'utf8'
    );
    writeFileSync(
        join(dir, 'PLAN_MAESTRO_CODEX_2026.md'),
        '# Fixture\n',
        'utf8'
    );
    writeFileSync(
        join(dir, 'AGENT_JOBS.yaml'),
        `version: 1
updated_at: "2026-03-03T00:00:00Z"
jobs:
  - key: public_main_sync
    job_id: "8d31e299-7e57-4959-80b5-aaa2d73e9674"
    enabled: true
    type: external_cron
    owner: codex_backend_ops
    environment: production
    repo_path: /var/www/figo
    branch: main
    schedule: "* * * * *"
    command: /root/sync-pielarmonia.sh
    wrapper_fallback: /var/www/figo/bin/deploy-public-v3-cron-sync.sh
    lock_file: /tmp/sync-pielarmonia.lock
    log_path: /var/log/sync-pielarmonia.log
    status_path: "${statusPath.replace(/\\/g, '/')}"
    health_url: https://pielarmonia.com/api.php?resource=health
    expected_max_lag_seconds: 120
    source_of_truth: host_cron
    publish_strategy: main_auto_guarded
`,
        'utf8'
    );
}

function runCli(dir, args, expectedStatus = 0) {
    const result = spawnSync(
        process.execPath,
        [join(dir, 'agent-orchestrator.js'), ...args],
        {
            cwd: dir,
            encoding: 'utf8',
        }
    );

    if (result.error) {
        throw result.error;
    }

    assert.equal(
        result.status,
        expectedStatus,
        `Unexpected exit for ${args.join(' ')}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );
    return JSON.parse(String(result.stdout || ''));
}

test('jobs status/verify CLI expone snapshot estable para public_main_sync', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFiles(dir);

    const status = runCli(dir, ['jobs', 'status', '--json']);
    assert.equal(status.ok, true);
    assert.equal(status.command, 'jobs status');
    assert.equal(Array.isArray(status.jobs), true);
    assert.equal(status.jobs.length, 1);
    assert.equal(status.jobs[0].key, 'public_main_sync');
    assert.equal(status.jobs[0].verification_source, 'local_status_file');
    assert.equal(status.jobs[0].healthy, true);
    assert.equal(status.jobs[0].current_head, 'abc1234');
    assert.equal(status.jobs[0].remote_head, 'abc1234');
    assert.equal(status.jobs[0].dirty_paths_count, 2);
    assert.equal(status.jobs[0].head_drift, false);
    assert.equal(status.jobs[0].telemetry_gap, false);
    assert.equal(status.jobs[0].repo_hygiene_issue, false);
    assert.equal(status.jobs[0].operationally_healthy, true);
    assert.equal(status.jobs[0].failure_reason, '');
    assert.deepEqual(status.jobs[0].dirty_paths_sample, [
        'vendor/autoload.php',
        '_astro/app.js',
    ]);
    assert.equal(status.jobs[0].duration_ms, 912);

    const verify = runCli(dir, [
        'jobs',
        'verify',
        'public_main_sync',
        '--json',
    ]);
    assert.equal(verify.ok, true);
    assert.equal(verify.command, 'jobs verify');
    assert.equal(verify.job.job_id, '8d31e299-7e57-4959-80b5-aaa2d73e9674');
    assert.equal(verify.job.healthy, true);
    assert.equal(typeof verify.job.age_seconds, 'number');
    assert.equal(verify.job.repo_path, '/var/www/figo');
    assert.equal(verify.job.branch, 'main');
    assert.equal(verify.job.current_head, 'abc1234');
    assert.equal(verify.job.remote_head, 'abc1234');
    assert.equal(verify.job.dirty_paths_count, 2);
    assert.equal(verify.job.head_drift, false);
    assert.equal(verify.job.telemetry_gap, false);
    assert.equal(verify.job.repo_hygiene_issue, false);
    assert.equal(verify.job.operationally_healthy, true);
    assert.equal(verify.job.failure_reason, '');
    assert.deepEqual(verify.job.dirty_paths, [
        'vendor/autoload.php',
        '_astro/app.js',
    ]);
});

test('jobs verify mantiene ok=true cuando public_main_sync solo tiene repo hygiene issue', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFiles(dir);

    const statusPath = join(dir, 'runtime', 'public-sync-status.json');
    const nowIso = new Date().toISOString();
    writeFileSync(
        statusPath,
        `${JSON.stringify(
            {
                version: 1,
                job_id: '8d31e299-7e57-4959-80b5-aaa2d73e9674',
                job_key: 'public_main_sync',
                state: 'failed',
                checked_at: nowIso,
                last_success_at: nowIso,
                last_error_at: nowIso,
                last_error_message: 'working_tree_dirty',
                deployed_commit: 'abc1234',
                repo_path: '/var/www/figo',
                branch: 'main',
                current_head: 'abc1234',
                remote_head: 'abc1234',
                dirty_paths_count: 2,
                dirty_paths_sample: ['vendor/autoload.php', '_astro/app.js'],
                dirty_paths: ['vendor/autoload.php', '_astro/app.js'],
                duration_ms: 912,
                lock_file: '/tmp/sync-pielarmonia.lock',
                log_path: '/var/log/sync-pielarmonia.log',
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    const status = runCli(dir, ['jobs', 'status', '--json']);
    assert.equal(status.jobs[0].healthy, true);
    assert.equal(status.jobs[0].repo_hygiene_issue, true);
    assert.equal(status.jobs[0].failure_reason, 'working_tree_dirty');

    const verify = runCli(dir, [
        'jobs',
        'verify',
        'public_main_sync',
        '--json',
    ]);
    assert.equal(verify.ok, true);
    assert.equal(verify.job.healthy, true);
    assert.equal(verify.job.repo_hygiene_issue, true);
    assert.equal(verify.job.failure_reason, 'working_tree_dirty');
});

test('jobs status/verify CLI normaliza main-sync-status canonico de Windows', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFiles(dir);

    const statusPath = join(dir, 'runtime', 'main-sync-status.json');
    const checkedAt = new Date().toISOString();

    writeFileSync(
        join(dir, 'AGENT_JOBS.yaml'),
        `version: 1
updated_at: "2026-03-26T00:00:00Z"
jobs:
  - key: public_main_sync
    job_id: "8d31e299-7e57-4959-80b5-aaa2d73e9674"
    enabled: true
    type: external_cron
    owner: codex_backend_ops
    environment: production
    repo_path: C:\\dev\\pielarmonia-clean-main
    branch: main
    schedule: "* * * * *"
    command: powershell -NoProfile -ExecutionPolicy Bypass -File C:\\ProgramData\\Pielarmonia\\hosting\\runtime-main-sync.ps1
    wrapper_fallback: C:\\ProgramData\\Pielarmonia\\hosting\\runtime-main-sync.ps1
    lock_file: C:\\tmp\\sync-pielarmonia.lock
    log_path: C:\\ProgramData\\Pielarmonia\\hosting\\main-sync.runtime.log
    status_path: "${statusPath.replace(/\\/g, '/')}"
    health_url: https://pielarmonia.com/api.php?resource=health
    expected_max_lag_seconds: 120
    source_of_truth: host_cron
    publish_strategy: main_auto_guarded
`,
        'utf8'
    );
    writeFileSync(
        statusPath,
        `${JSON.stringify(
            {
                ok: true,
                state: 'ok',
                timestamp: checkedAt,
                last_successful_deploy_at: checkedAt,
                mirror_repo_path: 'C:\\dev\\pielarmonia-clean-main',
                branch: 'main',
                desired_commit: 'def5678',
                current_commit: 'def5678',
                served_commit: 'def5678',
                auth_contract_ok: true,
                site_root_ok: true,
                log_path: 'C:\\ProgramData\\Pielarmonia\\hosting\\main-sync.runtime.log',
                lock_file: 'C:\\tmp\\sync-pielarmonia.lock',
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    const status = runCli(dir, ['jobs', 'status', '--json']);
    assert.equal(status.ok, true);
    assert.equal(status.jobs[0].verification_source, 'local_status_file');
    assert.equal(status.jobs[0].healthy, true);
    assert.equal(status.jobs[0].status_path, statusPath.replace(/\\/g, '/'));
    assert.equal(status.jobs[0].current_head, 'def5678');
    assert.equal(status.jobs[0].remote_head, 'def5678');
    assert.equal(status.jobs[0].repo_path, 'C:\\dev\\pielarmonia-clean-main');

    const verify = runCli(dir, [
        'jobs',
        'verify',
        'public_main_sync',
        '--json',
    ]);
    assert.equal(verify.ok, true);
    assert.equal(verify.job.healthy, true);
    assert.equal(verify.job.current_head, 'def5678');
    assert.equal(verify.job.remote_head, 'def5678');
    assert.equal(verify.job.deployed_commit, 'def5678');
    assert.equal(
        verify.job.log_path,
        'C:\\ProgramData\\Pielarmonia\\hosting\\main-sync.runtime.log'
    );
    assert.equal(verify.job.lock_file, 'C:\\tmp\\sync-pielarmonia.lock');
});

test('jobs verify usa health_url publico cuando expone checks.publicSync', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    const healthUrl = `data:application/json,${encodeURIComponent(
        JSON.stringify({
            ok: true,
            status: 'ok',
            storageReady: true,
            dataDirWritable: true,
            timingMs: 14,
            version: '20260314072914',
            timestamp: new Date().toISOString(),
            checks: {
                publicSync: {
                    configured: true,
                    jobId: '8d31e299-7e57-4959-80b5-aaa2d73e9674',
                    healthy: true,
                    operationallyHealthy: true,
                    repoHygieneIssue: false,
                    state: 'ok',
                    ageSeconds: 41,
                    expectedMaxLagSeconds: 120,
                    lastCheckedAt: '2026-03-14T10:59:00Z',
                    lastSuccessAt: '2026-03-14T10:59:00Z',
                    lastErrorAt: '',
                    lastErrorMessage: '',
                    failureReason: '',
                    deployedCommit: 'abc1234',
                    currentHead: 'abc1234',
                    remoteHead: 'abc1234',
                    headDrift: false,
                    telemetryGap: false,
                    dirtyPathsCount: 0,
                    dirtyPathsSample: [],
                },
            },
        })
    )}`;

    writeFixtureFiles(dir);
    writeFileSync(
        join(dir, 'AGENT_JOBS.yaml'),
        `version: 1
updated_at: "2026-03-03T00:00:00Z"
jobs:
  - key: public_main_sync
    job_id: "8d31e299-7e57-4959-80b5-aaa2d73e9674"
    enabled: true
    type: external_cron
    owner: codex_backend_ops
    environment: production
    repo_path: /var/www/figo
    branch: main
    schedule: "* * * * *"
    command: /root/sync-pielarmonia.sh
    wrapper_fallback: /var/www/figo/bin/deploy-public-v3-cron-sync.sh
    lock_file: /tmp/sync-pielarmonia.lock
    log_path: /var/log/sync-pielarmonia.log
    status_path: "${join(dir, 'runtime', 'missing-public-sync-status.json').replace(/\\/g, '/')}"
    health_url: ${healthUrl}
    expected_max_lag_seconds: 120
    source_of_truth: host_cron
    publish_strategy: main_auto_guarded
`,
        'utf8'
    );

    const verify = runCli(dir, [
        'jobs',
        'verify',
        'public_main_sync',
        '--json',
    ]);
    assert.equal(verify.ok, true);
    assert.equal(verify.job.verification_source, 'health_url');
    assert.equal(verify.job.verified, true);
    assert.equal(verify.job.healthy, true);
    assert.equal(verify.job.age_seconds, 41);
    assert.equal(verify.job.deployed_commit, 'abc1234');
    assert.equal(verify.job.current_head, 'abc1234');
    assert.equal(verify.job.remote_head, 'abc1234');
    assert.equal(verify.job.failure_reason, '');
    assert.equal(verify.job.repo_hygiene_issue, false);
    assert.equal(verify.job.telemetry_gap, false);
    assert.equal(
        verify.job.status_path.endsWith('missing-public-sync-status.json'),
        true
    );
});

test('jobs verify distingue health publico stale cuando falta checks.publicSync', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    const healthUrl = `data:application/json,${encodeURIComponent(
        JSON.stringify({
            ok: true,
            status: 'ok',
            storageReady: true,
            dataDirWritable: true,
            timingMs: 14,
            version: '20260314072914',
            timestamp: '2026-03-14T11:10:00Z',
        })
    )}`;

    writeFixtureFiles(dir);
    writeFileSync(
        join(dir, 'AGENT_JOBS.yaml'),
        `version: 1
updated_at: "2026-03-03T00:00:00Z"
jobs:
  - key: public_main_sync
    job_id: "8d31e299-7e57-4959-80b5-aaa2d73e9674"
    enabled: true
    type: external_cron
    owner: codex_backend_ops
    environment: production
    repo_path: /var/www/figo
    branch: main
    schedule: "* * * * *"
    command: /root/sync-pielarmonia.sh
    wrapper_fallback: /var/www/figo/bin/deploy-public-v3-cron-sync.sh
    lock_file: /tmp/sync-pielarmonia.lock
    log_path: /var/log/sync-pielarmonia.log
    status_path: "${join(dir, 'runtime', 'missing-public-sync-status.json').replace(/\\/g, '/')}"
    health_url: ${healthUrl}
    expected_max_lag_seconds: 120
    source_of_truth: host_cron
    publish_strategy: main_auto_guarded
`,
        'utf8'
    );

    const verify = runCli(
        dir,
        ['jobs', 'verify', 'public_main_sync', '--json'],
        1
    );
    assert.equal(verify.ok, false);
    assert.equal(verify.job.verification_source, 'health_url');
    assert.equal(verify.job.failure_reason, 'health_missing_public_sync');
    assert.equal(verify.job.last_error_message, 'health_missing_public_sync');
    assert.equal(verify.job.state, 'stale');
    assert.equal(verify.job.verified, false);
    assert.equal(verify.job.healthy, false);
});
