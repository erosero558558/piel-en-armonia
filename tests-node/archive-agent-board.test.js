'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

const coreParsers = require('../tools/agent-orchestrator/core/parsers');
const archiveBoard = require('../bin/archive-agent-board');

const ALLOWED_STATUSES = new Set([
    'backlog',
    'ready',
    'in_progress',
    'review',
    'done',
    'blocked',
    'failed',
]);

function writeText(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

test('archive-agent-board parseArgs aplica defaults', () => {
    const options = archiveBoard.parseArgs([], process.cwd());
    assert.equal(options.apply, false);
    assert.equal(options.json, false);
    assert.equal(options.keepDone, 60);
    assert.equal(options.olderThanDays, 7);
    assert.equal(options.syncQueues, true);
});

test('archive-agent-board parseArgs reconoce flags principales', () => {
    const cwd = process.cwd();
    const options = archiveBoard.parseArgs(
        [
            '--apply',
            '--json',
            '--keep-done',
            '25',
            '--older-than-days',
            '14',
            '--archive-dir',
            'verification/custom',
            '--board',
            'tmp/AGENT_BOARD.yaml',
            '--jules',
            'tmp/JULES_TASKS.md',
            '--kimi',
            'tmp/KIMI_TASKS.md',
            '--no-sync-queues',
        ],
        cwd
    );
    assert.equal(options.apply, true);
    assert.equal(options.json, true);
    assert.equal(options.keepDone, 25);
    assert.equal(options.olderThanDays, 14);
    assert.equal(options.syncQueues, false);
    assert.equal(options.archiveDir, path.resolve(cwd, 'verification/custom'));
    assert.equal(options.boardPath, path.resolve(cwd, 'tmp/AGENT_BOARD.yaml'));
});

test('archive-agent-board selectArchiveCandidates respeta keep + antiguedad', () => {
    const tasks = [
        { id: 'AG-001', status: 'done', updated_at: '2026-02-25' },
        { id: 'AG-002', status: 'done', updated_at: '2026-02-10' },
        { id: 'AG-003', status: 'done', updated_at: '2026-02-01' },
        { id: 'AG-004', status: 'in_progress', updated_at: '2026-02-24' },
    ];
    const selection = archiveBoard.selectArchiveCandidates(tasks, {
        nowMs: new Date('2026-02-26T00:00:00.000Z').getTime(),
        keepDone: 1,
        olderThanDays: 7,
    });
    assert.equal(selection.doneTotal, 3);
    assert.equal(selection.keepTotal, 1);
    assert.equal(selection.archiveTotal, 2);
    assert.deepEqual(
        selection.archived.map((entry) => entry.taskId),
        ['AG-002', 'AG-003']
    );
});

test('archive-agent-board runArchive aplica poda y sincroniza colas', () => {
    const tmpRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'archive-agent-board-')
    );
    const boardPath = path.join(tmpRoot, 'AGENT_BOARD.yaml');
    const julesPath = path.join(tmpRoot, 'JULES_TASKS.md');
    const kimiPath = path.join(tmpRoot, 'KIMI_TASKS.md');
    const archiveDir = path.join(tmpRoot, 'verification/board-snapshots');

    writeText(
        boardPath,
        `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  codex_partition_model: dual_fixed_domains
  codex_backend_instance: codex_backend_ops
  codex_frontend_instance: codex_frontend
  revision: 10
  updated_at: 2026-02-26

tasks:
  - id: AG-010
    title: "Recent done"
    owner: ernes
    executor: codex
    status: done
    updated_at: 2026-02-25
  - id: AG-011
    title: "Old done"
    owner: ernes
    executor: codex
    status: done
    updated_at: 2026-02-01
  - id: AG-012
    title: "Still active"
    owner: ernes
    executor: codex
    status: in_progress
    updated_at: 2026-02-26
`
    );
    writeText(julesPath, '# JULES_TASKS.md\n');
    writeText(kimiPath, '# KIMI_TASKS.md\n');

    const report = archiveBoard.runArchive(
        {
            boardPath,
            archiveDir,
            julesPath,
            kimiPath,
            keepDone: 1,
            olderThanDays: 7,
            apply: true,
            json: false,
            syncQueues: true,
        },
        {
            now: () => new Date('2026-02-26T12:00:00.000Z'),
        }
    );

    assert.equal(report.applied, true);
    assert.equal(report.archivedTotal, 1);
    assert.equal(report.queuesSynced, true);
    assert.equal(report.boardRevisionBefore, 10);
    assert.equal(report.boardRevisionAfter, 11);
    assert.ok(
        report.archiveFile.endsWith('.json'),
        'archive file should be generated'
    );

    const boardAfter = coreParsers.parseBoardContent(
        fs.readFileSync(boardPath, 'utf8'),
        { allowedStatuses: ALLOWED_STATUSES }
    );
    assert.equal(boardAfter.policy.revision, '11');
    assert.deepEqual(
        boardAfter.tasks.map((task) => task.id),
        ['AG-010', 'AG-012']
    );

    const archivePath = report.archiveFilePath;
    assert.ok(fs.existsSync(archivePath), 'archive payload must exist');
});
