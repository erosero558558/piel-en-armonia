#!/usr/bin/env node
'use strict';

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const { resolve, join, relative } = require('path');
const coreParsers = require('../tools/agent-orchestrator/core/parsers');
const coreSerializers = require('../tools/agent-orchestrator/core/serializers');
const coreIo = require('../tools/agent-orchestrator/core/io');
const coreQueues = require('../tools/agent-orchestrator/core/queues');
const { currentDate } = require('../tools/agent-orchestrator/core/time');

const ROOT_DIR = resolve(__dirname, '..');
const DEFAULT_BOARD_PATH = resolve(ROOT_DIR, 'AGENT_BOARD.yaml');
const DEFAULT_ARCHIVE_DIR = resolve(ROOT_DIR, 'verification/board-snapshots');
const DEFAULT_JULES_PATH = resolve(ROOT_DIR, 'JULES_TASKS.md');
const DEFAULT_KIMI_PATH = resolve(ROOT_DIR, 'KIMI_TASKS.md');
const DEFAULT_KEEP_DONE = 60;
const DEFAULT_OLDER_THAN_DAYS = 7;
const ALLOWED_STATUSES = new Set([
    'backlog',
    'ready',
    'in_progress',
    'review',
    'done',
    'blocked',
    'failed',
]);

function parseNumberFlag(rawValue, fallback, flagName) {
    const parsed = Number.parseInt(String(rawValue || ''), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`${flagName} requiere numero entero >= 0`);
    }
    return parsed;
}

function parseArgs(argv = [], cwd = process.cwd()) {
    const options = {
        boardPath: DEFAULT_BOARD_PATH,
        archiveDir: DEFAULT_ARCHIVE_DIR,
        julesPath: DEFAULT_JULES_PATH,
        kimiPath: DEFAULT_KIMI_PATH,
        keepDone: DEFAULT_KEEP_DONE,
        olderThanDays: DEFAULT_OLDER_THAN_DAYS,
        apply: false,
        json: false,
        syncQueues: true,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = String(argv[i] || '').trim();
        if (!arg) continue;
        if (arg === '--apply') {
            options.apply = true;
            continue;
        }
        if (arg === '--json') {
            options.json = true;
            continue;
        }
        if (arg === '--no-sync-queues') {
            options.syncQueues = false;
            continue;
        }
        if (arg === '--board') {
            const value = String(argv[i + 1] || '').trim();
            if (!value) throw new Error('--board requiere ruta');
            options.boardPath = resolve(cwd, value);
            i += 1;
            continue;
        }
        if (arg === '--archive-dir') {
            const value = String(argv[i + 1] || '').trim();
            if (!value) throw new Error('--archive-dir requiere ruta');
            options.archiveDir = resolve(cwd, value);
            i += 1;
            continue;
        }
        if (arg === '--jules') {
            const value = String(argv[i + 1] || '').trim();
            if (!value) throw new Error('--jules requiere ruta');
            options.julesPath = resolve(cwd, value);
            i += 1;
            continue;
        }
        if (arg === '--kimi') {
            const value = String(argv[i + 1] || '').trim();
            if (!value) throw new Error('--kimi requiere ruta');
            options.kimiPath = resolve(cwd, value);
            i += 1;
            continue;
        }
        if (arg === '--keep-done') {
            options.keepDone = parseNumberFlag(
                argv[i + 1],
                DEFAULT_KEEP_DONE,
                '--keep-done'
            );
            i += 1;
            continue;
        }
        if (arg === '--older-than-days') {
            options.olderThanDays = parseNumberFlag(
                argv[i + 1],
                DEFAULT_OLDER_THAN_DAYS,
                '--older-than-days'
            );
            i += 1;
            continue;
        }
        throw new Error(
            `Flag no soportado: ${arg}. Usa --apply --json --board --archive-dir --keep-done --older-than-days --no-sync-queues`
        );
    }

    return options;
}

function parseTaskTimestamp(task) {
    const candidates = [
        task?.updated_at,
        task?.status_since_at,
        task?.created_at,
    ];
    for (const value of candidates) {
        const raw = String(value || '').trim();
        if (!raw) continue;
        const date = new Date(raw);
        if (Number.isFinite(date.getTime())) {
            return { iso: date.toISOString(), ms: date.getTime() };
        }
        const ymd = new Date(`${raw}T00:00:00.000Z`);
        if (Number.isFinite(ymd.getTime())) {
            return { iso: ymd.toISOString(), ms: ymd.getTime() };
        }
    }
    return { iso: '', ms: 0 };
}

function selectArchiveCandidates(tasks, options = {}) {
    const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
    const keepDone = Number.isFinite(options.keepDone)
        ? options.keepDone
        : DEFAULT_KEEP_DONE;
    const olderThanDays = Number.isFinite(options.olderThanDays)
        ? options.olderThanDays
        : DEFAULT_OLDER_THAN_DAYS;
    const cutoffMs = nowMs - olderThanDays * 24 * 60 * 60 * 1000;

    const doneTasks = (Array.isArray(tasks) ? tasks : [])
        .filter((task) => String(task?.status || '') === 'done')
        .map((task) => {
            const stamp = parseTaskTimestamp(task);
            return {
                task,
                taskId: String(task?.id || ''),
                stampIso: stamp.iso,
                stampMs: stamp.ms,
            };
        })
        .sort((a, b) => b.stampMs - a.stampMs);

    const kept = [];
    const archived = [];
    doneTasks.forEach((entry, index) => {
        const insideKeepWindow = index < keepDone;
        const oldEnough =
            olderThanDays === 0 ? true : entry.stampMs <= cutoffMs;
        if (!insideKeepWindow && oldEnough) {
            archived.push(entry);
            return;
        }
        kept.push(entry);
    });

    return {
        doneTotal: doneTasks.length,
        keepTotal: kept.length,
        archiveTotal: archived.length,
        kept,
        archived,
        cutoffMs,
    };
}

function formatStamp(date = new Date()) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    return `${y}${m}${d}-${hh}${mm}${ss}`;
}

function createArchivePayload(board, selection, options = {}, nowIso = '') {
    return {
        version: 1,
        source: 'agent-board-archive',
        generatedAt: nowIso || new Date().toISOString(),
        boardPath: relative(ROOT_DIR, options.boardPath || DEFAULT_BOARD_PATH),
        keepDone: options.keepDone,
        olderThanDays: options.olderThanDays,
        policy: {
            revision: Number.parseInt(
                String(board?.policy?.revision || '0'),
                10
            ),
            updated_at: String(board?.policy?.updated_at || ''),
        },
        summary: {
            doneTotal: selection.doneTotal,
            keptTotal: selection.keepTotal,
            archivedTotal: selection.archiveTotal,
        },
        archivedTasks: selection.archived.map((entry) => ({
            ...entry.task,
            _archived_stamp: entry.stampIso,
        })),
    };
}

function runArchive(options, deps = {}) {
    const readFile = deps.readFile || readFileSync;
    const writeFile = deps.writeFile || writeFileSync;
    const exists = deps.exists || existsSync;
    const mkdir = deps.mkdir || mkdirSync;
    const now = deps.now || (() => new Date());

    if (!exists(options.boardPath)) {
        throw new Error(`No existe board: ${options.boardPath}`);
    }

    const rawBoard = readFile(options.boardPath, 'utf8');
    const board = coreParsers.parseBoardContent(rawBoard, {
        allowedStatuses: ALLOWED_STATUSES,
    });
    const nowDate = now();
    const nowIso = nowDate.toISOString();
    const nowMs = nowDate.getTime();
    const selection = selectArchiveCandidates(board.tasks || [], {
        nowMs,
        keepDone: options.keepDone,
        olderThanDays: options.olderThanDays,
    });

    const report = {
        version: 1,
        ok: true,
        command: 'archive-agent-board',
        apply: Boolean(options.apply),
        boardPath: relative(ROOT_DIR, options.boardPath),
        archiveDir: relative(ROOT_DIR, options.archiveDir),
        keepDone: options.keepDone,
        olderThanDays: options.olderThanDays,
        doneTotal: selection.doneTotal,
        archivedTotal: selection.archiveTotal,
        archivedTaskIds: selection.archived.map((entry) => entry.taskId),
        keptTaskIds: selection.kept.map((entry) => entry.taskId),
        applied: false,
        archiveFile: '',
        archiveFilePath: '',
        boardRevisionBefore: Number.parseInt(
            String(board?.policy?.revision || '0'),
            10
        ),
        boardRevisionAfter: Number.parseInt(
            String(board?.policy?.revision || '0'),
            10
        ),
        queuesSynced: false,
    };

    if (!options.apply || selection.archiveTotal === 0) {
        return report;
    }

    mkdir(options.archiveDir, { recursive: true });
    const stamp = formatStamp(nowDate);
    const archiveFile = join(
        options.archiveDir,
        `AGENT_BOARD-done-archive-${stamp}.json`
    );
    const payload = createArchivePayload(board, selection, options, nowIso);
    writeFile(archiveFile, `${JSON.stringify(payload, null, 4)}\n`, 'utf8');

    const archivedIds = new Set(
        selection.archived.map((entry) => entry.taskId)
    );
    board.tasks = (board.tasks || []).filter(
        (task) => !archivedIds.has(String(task?.id || ''))
    );
    board.policy = board.policy || {};
    const revisionBefore = Number.parseInt(
        String(board.policy.revision || '0'),
        10
    );
    board.policy.revision = Number.isFinite(revisionBefore)
        ? revisionBefore + 1
        : 1;
    board.policy.updated_at = currentDate();

    const serializedBoard = coreSerializers.serializeBoard(board, {
        currentDate,
    });
    writeFile(options.boardPath, serializedBoard, 'utf8');

    if (options.syncQueues) {
        coreIo.syncDerivedQueuesFiles(
            { silent: true },
            {
                parseBoard: () =>
                    coreParsers.parseBoardContent(
                        readFile(options.boardPath, 'utf8'),
                        { allowedStatuses: ALLOWED_STATUSES }
                    ),
                parseTaskMetaMap: (path) =>
                    coreQueues.parseTaskMetaMap(path, {
                        exists,
                        readFile,
                        normalize: coreParsers.normalizeEol,
                    }),
                renderQueueFile: coreQueues.renderQueueFile,
                julesPath: options.julesPath,
                kimiPath: options.kimiPath,
                writeFile,
                log: () => {},
            }
        );
        report.queuesSynced = true;
    }

    report.applied = true;
    report.archiveFile = relative(ROOT_DIR, archiveFile);
    report.archiveFilePath = archiveFile;
    report.boardRevisionAfter = Number.parseInt(
        String(board.policy.revision || '0'),
        10
    );
    return report;
}

function main(argv = process.argv.slice(2)) {
    const options = parseArgs(argv);
    const report = runArchive(options);
    if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }
    console.log('== Archive Agent Board ==');
    console.log(`Board: ${report.boardPath}`);
    console.log(`Done total: ${report.doneTotal}`);
    console.log(`Archived total: ${report.archivedTotal}`);
    console.log(`Applied: ${report.applied ? 'yes' : 'no'}`);
    if (report.archiveFile) {
        console.log(`Archive file: ${report.archiveFile}`);
    }
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        const message = error && error.message ? error.message : String(error);
        console.error(message);
        process.exitCode = 1;
    }
}

module.exports = {
    parseArgs,
    parseTaskTimestamp,
    selectArchiveCandidates,
    createArchivePayload,
    runArchive,
    formatStamp,
};
