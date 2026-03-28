#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'verification', 'turnero-presentation-local');
const OUTPUT_JSON = path.join(OUT_DIR, 'gate-report.json');
const OUTPUT_MD = path.join(OUT_DIR, 'gate-report.md');
const DEFAULT_LOCAL_SERVER_HOST =
    process.env.TEST_LOCAL_SERVER_HOST || '127.0.0.1';
const DEFAULT_LOCAL_SERVER_PORT = 8011;
const LOCAL_PORT_SCAN_WINDOW = 12;

const COMMANDS = [
    'npm run build',
    'npm run test:frontend:qa:v6',
    'npm run audit:public:v6:visual-contract',
    'npm run audit:public:v6:sony-evidence',
    'npm run test:turnero:presentation-cut',
    'npm run test:turnero:sony-premium',
    'npm run test:turnero:web-pilot:ui',
];

function tailLines(text, maxLines = 20) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter(Boolean)
        .slice(-maxLines)
        .join('\n');
}

function parsePortEnv(value, fallback = DEFAULT_LOCAL_SERVER_PORT) {
    const parsed = Number.parseInt(String(value || '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535
        ? parsed
        : fallback;
}

function canListenOnPort(host, port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        let settled = false;

        const finish = (result) => {
            if (settled) {
                return;
            }
            settled = true;
            resolve(result);
        };

        server.unref();
        server.once('error', () => finish(false));
        server.listen({ host, port, exclusive: true }, () => {
            server.close(() => finish(true));
        });
    });
}

async function resolveLocalServerPort() {
    const explicitPortRaw = String(
        process.env.TEST_LOCAL_SERVER_PORT || ''
    ).trim();
    if (process.env.TEST_BASE_URL) {
        return parsePortEnv(explicitPortRaw, DEFAULT_LOCAL_SERVER_PORT);
    }
    if (explicitPortRaw) {
        return parsePortEnv(explicitPortRaw, DEFAULT_LOCAL_SERVER_PORT);
    }

    for (let offset = 0; offset < LOCAL_PORT_SCAN_WINDOW; offset += 1) {
        const candidatePort = DEFAULT_LOCAL_SERVER_PORT + offset;
        // Pick a free port so the gate can coexist with other local worktrees.
        if (await canListenOnPort(DEFAULT_LOCAL_SERVER_HOST, candidatePort)) {
            return candidatePort;
        }
    }

    return DEFAULT_LOCAL_SERVER_PORT;
}

function writeStream(target, chunk) {
    if (!target || typeof target.write !== 'function') {
        return;
    }
    target.write(chunk);
}

function writeLine(io, line) {
    writeStream(io && io.stdout, `${line}\n`);
}

function runCommand(command, env, io = process) {
    return new Promise((resolve) => {
        const startedAt = new Date();
        let stdout = '';
        let stderr = '';
        let childError = null;
        let settled = false;
        const finish = (exitCode) => {
            if (settled) {
                return;
            }
            settled = true;
            const endedAt = new Date();
            resolve({
                command,
                startedAt: startedAt.toISOString(),
                endedAt: endedAt.toISOString(),
                durationMs: endedAt.getTime() - startedAt.getTime(),
                exitCode,
                success: exitCode === 0,
                stdoutTail: tailLines(stdout),
                stderrTail: tailLines(stderr),
                error: childError
                    ? String(childError.message || childError)
                    : '',
            });
        };

        const child = spawn(command, {
            cwd: ROOT,
            shell: true,
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        if (child.stdout) {
            child.stdout.on('data', (chunk) => {
                const text = chunk.toString();
                stdout += text;
                writeStream(io.stdout, text);
            });
        }

        if (child.stderr) {
            child.stderr.on('data', (chunk) => {
                const text = chunk.toString();
                stderr += text;
                writeStream(io.stderr, text);
            });
        }

        child.once('error', (error) => {
            childError = error;
            finish(1);
        });
        child.once('close', (code, signal) => {
            if (typeof code === 'number') {
                finish(code);
                return;
            }
            finish(signal ? 1 : 0);
        });
    });
}

async function runGateCommands(
    commands,
    env,
    io = process,
    runCommandFn = runCommand
) {
    const results = [];
    let canContinue = true;

    for (const command of commands) {
        if (!canContinue) {
            results.push({
                command,
                startedAt: '',
                endedAt: '',
                durationMs: 0,
                exitCode: -1,
                success: false,
                skipped: true,
                stdoutTail: '',
                stderrTail: '',
                error: '',
            });
            continue;
        }

        writeLine(io, `[turnero-presentation-local] Running ${command}`);
        const result = await runCommandFn(command, env, io);
        results.push({ ...result, skipped: false });
        writeLine(
            io,
            `[turnero-presentation-local] ${result.success ? 'PASS' : 'FAIL'} ${command} (${result.durationMs}ms)`
        );
        if (!result.success) {
            canContinue = false;
        }
    }

    return results;
}

function buildMarkdown(report) {
    const lines = [
        '# Turnero Presentation Local Gate',
        '',
        `- Generated At: ${report.generatedAt}`,
        `- Status: ${report.ok ? 'PASS' : 'FAIL'}`,
        `- TEST_LOCAL_SERVER_PORT: ${report.testLocalServerPort}`,
        '',
        '| Command | Status | Exit |',
        '| --- | --- | --- |',
        ...report.commands.map((entry) => {
            const status = entry.success ? 'PASS' : 'FAIL';
            return `| \`${entry.command}\` | ${status} | ${entry.exitCode} |`;
        }),
        '',
    ];

    if (report.failures.length) {
        lines.push('## Failures');
        lines.push('');
        report.failures.forEach((failure) => lines.push(`- ${failure}`));
        lines.push('');
    }

    return `${lines.join('\n')}\n`;
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const resolvedLocalServerPort = await resolveLocalServerPort();
    const gateEnv = {
        ...process.env,
        TEST_LOCAL_SERVER_PORT: String(resolvedLocalServerPort),
        TEST_REUSE_EXISTING_SERVER:
            process.env.TEST_REUSE_EXISTING_SERVER || '0',
    };
    const results = await runGateCommands(COMMANDS, gateEnv, process);

    const failures = results
        .filter((entry) => !entry.success && !entry.skipped)
        .map((entry) => `Command failed: ${entry.command}`);

    const report = {
        generatedAt: new Date().toISOString(),
        ok: failures.length === 0,
        testLocalServerPort: gateEnv.TEST_LOCAL_SERVER_PORT,
        commands: results,
        failures,
    };

    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2));
    fs.writeFileSync(OUTPUT_MD, buildMarkdown(report), 'utf8');

    if (!report.ok) {
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main().catch((error) => {
        process.stderr.write(
            `[turnero-presentation-local] ${error.message || error}\n`
        );
        process.exitCode = 1;
    });
}

module.exports = {
    COMMANDS,
    OUTPUT_JSON,
    OUTPUT_MD,
    buildMarkdown,
    runCommand,
    runGateCommands,
};
