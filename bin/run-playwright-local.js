#!/usr/bin/env node
'use strict';

const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const {
    startLocalPublicServer,
    stopLocalPublicServer,
} = require('./lib/public-v6-local-server.js');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_HOST = process.env.TEST_LOCAL_SERVER_HOST || '127.0.0.1';
const DEFAULT_PORT = 8011;
const DEFAULT_PORT_SCAN_WINDOW = 12;
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_PHP_SERVER_WORKERS = '4';
const DEFAULT_SERVER_ENGINE = 'php';

function parsePortEnv(value, fallback = DEFAULT_PORT) {
    const parsed = Number.parseInt(String(value || '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535
        ? parsed
        : fallback;
}

function parseIntegerEnv(value, fallback) {
    const parsed = Number.parseInt(String(value || '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isFlag(token, expected) {
    return String(token || '').trim() === expected;
}

function parseArgs(argv, env = process.env) {
    const explicitPortRaw = String(env.TEST_LOCAL_SERVER_PORT || '').trim();
    const parsed = {
        host:
            String(env.TEST_LOCAL_SERVER_HOST || DEFAULT_HOST).trim() ||
            DEFAULT_HOST,
        serverEngine:
            String(env.TEST_LOCAL_SERVER_ENGINE || DEFAULT_SERVER_ENGINE)
                .trim()
                .toLowerCase() || DEFAULT_SERVER_ENGINE,
        runtimeRoot: String(env.TEST_RUNTIME_ROOT || '').trim(),
        port: parsePortEnv(explicitPortRaw, DEFAULT_PORT),
        portSource: explicitPortRaw ? 'env' : 'default',
        portWindow: parseIntegerEnv(
            env.TEST_LOCAL_SERVER_PORT_WINDOW,
            DEFAULT_PORT_SCAN_WINDOW
        ),
        timeoutMs: parseIntegerEnv(
            env.TEST_LOCAL_SERVER_TIMEOUT_MS,
            DEFAULT_TIMEOUT_MS
        ),
        baseUrl: String(env.TEST_BASE_URL || '').trim(),
        playwrightArgs: [],
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = String(argv[index] || '').trim();
        if (!token) {
            continue;
        }
        if (isFlag(token, '--')) {
            parsed.playwrightArgs.push(...argv.slice(index + 1));
            break;
        }
        if (isFlag(token, '--host')) {
            parsed.host = String(argv[index + 1] || '').trim() || parsed.host;
            index += 1;
            continue;
        }
        if (isFlag(token, '--server-engine')) {
            parsed.serverEngine =
                String(argv[index + 1] || '')
                    .trim()
                    .toLowerCase() || parsed.serverEngine;
            index += 1;
            continue;
        }
        if (isFlag(token, '--runtime-root')) {
            parsed.runtimeRoot =
                String(argv[index + 1] || '').trim() || parsed.runtimeRoot;
            index += 1;
            continue;
        }
        if (isFlag(token, '--port')) {
            const rawPort = String(argv[index + 1] || '').trim();
            if (!rawPort || rawPort.toLowerCase() === 'auto') {
                parsed.port = DEFAULT_PORT;
                parsed.portSource = 'default';
            } else {
                parsed.port = parsePortEnv(rawPort, DEFAULT_PORT);
                parsed.portSource = 'cli';
            }
            index += 1;
            continue;
        }
        if (isFlag(token, '--port-window')) {
            parsed.portWindow = parseIntegerEnv(
                argv[index + 1],
                parsed.portWindow
            );
            index += 1;
            continue;
        }
        if (isFlag(token, '--timeout-ms')) {
            parsed.timeoutMs = parseIntegerEnv(
                argv[index + 1],
                parsed.timeoutMs
            );
            index += 1;
            continue;
        }
        if (isFlag(token, '--base-url')) {
            parsed.baseUrl =
                String(argv[index + 1] || '').trim() || parsed.baseUrl;
            index += 1;
            continue;
        }
        parsed.playwrightArgs.push(token);
    }

    return parsed;
}

function buildPlaywrightCommandArgs(playwrightArgs) {
    const filteredArgs = Array.isArray(playwrightArgs)
        ? playwrightArgs.filter((entry) => String(entry || '').trim() !== '')
        : [];
    return ['playwright', 'test', ...filteredArgs];
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

async function resolveLocalServerPort(options, probePort = canListenOnPort) {
    if (options.baseUrl) {
        return 0;
    }

    const portWindow = Math.max(1, Number(options.portWindow || 1));
    const basePort = parsePortEnv(options.port, DEFAULT_PORT);

    if (options.portSource === 'cli') {
        return basePort;
    }

    for (let offset = 0; offset < portWindow; offset += 1) {
        const candidatePort = basePort + offset;
        // Scan for a free port so each run owns its server instead of fighting Playwright webServer leftovers.
        // Environment-provided ports remain the preferred starting point, but we will move if they are busy.
        if (await probePort(options.host, candidatePort)) {
            return candidatePort;
        }
    }

    return basePort;
}

function requestOnce(urlString) {
    return new Promise((resolve) => {
        const url = new URL(urlString);
        const request = http.request(
            {
                protocol: url.protocol,
                hostname: url.hostname,
                port: url.port,
                path: `${url.pathname}${url.search}`,
                method: 'GET',
                timeout: 1500,
            },
            (response) => {
                response.resume();
                resolve(
                    response.statusCode >= 200 && response.statusCode < 500
                );
            }
        );
        request.once('timeout', () => {
            request.destroy();
            resolve(false);
        });
        request.once('error', () => resolve(false));
        request.end();
    });
}

async function waitForHttpReady(urlString, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const ok = await requestOnce(urlString);
        if (ok) {
            return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
}

function startLocalPhpServer(host, port) {
    return spawn(
        'php',
        ['-S', `${host}:${port}`, '-t', '.', 'bin/local-stage-router.php'],
        {
            cwd: ROOT,
            env: {
                ...process.env,
                PHP_CLI_SERVER_WORKERS:
                    String(process.env.PHP_CLI_SERVER_WORKERS || '').trim() ||
                    DEFAULT_PHP_SERVER_WORKERS,
            },
            // The PHP dev server is verbose under Playwright. If stdout/stderr stay piped
            // without active consumers, the buffers can fill and stall the local gate.
            stdio: ['ignore', 'ignore', 'ignore'],
            shell: false,
        }
    );
}

async function startLocalNodeServer(host, port, runtimeRoot = '') {
    const serverHandle = await startLocalPublicServer(ROOT, {
        host,
        port,
        runtimeRoot,
    });
    return {
        kind: 'node',
        ...serverHandle,
    };
}

function hostCommandAvailable() {
    const probe = spawnSync('flatpak-spawn', ['--host', 'true'], {
        stdio: 'ignore',
        shell: false,
    });
    return !probe.error && probe.status === 0;
}

function runShellCommand(command, { preferHost = false } = {}) {
    if (preferHost && hostCommandAvailable()) {
        return spawnSync('flatpak-spawn', ['--host', 'sh', '-lc', command], {
            encoding: 'utf8',
            shell: false,
        });
    }
    return spawnSync('sh', ['-lc', command], {
        encoding: 'utf8',
        shell: false,
    });
}

function extractListeningPids(raw) {
    return Array.from(
        new Set(
            String(raw || '')
                .match(/pid=\d+/g)
                ?.map((entry) => Number.parseInt(entry.replace('pid=', ''), 10))
                .filter((value) => Number.isInteger(value) && value > 0) || []
        )
    );
}

function killListeningPort(port, { preferHost = false } = {}) {
    const inspect = runShellCommand(`ss -ltnp "( sport = :${port} )" || true`, {
        preferHost,
    });
    const pids = extractListeningPids(
        `${inspect.stdout || ''}\n${inspect.stderr || ''}`
    );
    if (!pids.length) {
        return false;
    }

    const killCommand =
        process.platform === 'win32'
            ? pids
                  .map((pid) => `taskkill /PID ${pid} /T /F > /dev/null 2>&1`)
                  .join(' && ')
            : `kill ${pids.join(' ')} >/dev/null 2>&1 || true; sleep 1; kill -9 ${pids.join(' ')} >/dev/null 2>&1 || true`;
    runShellCommand(killCommand, { preferHost });
    return true;
}

function killProcess(proc) {
    if (!proc || !proc.pid) {
        return;
    }
    if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {
            stdio: 'ignore',
            shell: true,
        });
        return;
    }
    proc.kill('SIGTERM');
}

function runPlaywrightCommand(playwrightArgs, env) {
    return new Promise((resolve) => {
        const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        const child = spawn(
            command,
            buildPlaywrightCommandArgs(playwrightArgs),
            {
                cwd: ROOT,
                env,
                stdio: 'inherit',
                shell: false,
            }
        );
        child.once('exit', (code, signal) => {
            if (typeof code === 'number') {
                resolve(code);
                return;
            }
            resolve(signal ? 1 : 0);
        });
        child.once('error', () => resolve(1));
    });
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.playwrightArgs.length === 0) {
        process.stderr.write(
            '[run-playwright-local] Debes pasar al menos un archivo o flag de Playwright.\n'
        );
        process.exitCode = 1;
        return;
    }

    let serverProcess = null;
    let startedLocalServer = false;
    let resolvedLocalPort = 0;
    const cleanup = () => {
        if (!serverProcess) {
            if (
                startedLocalServer &&
                resolvedLocalPort > 0 &&
                options.portSource !== 'cli'
            ) {
                killListeningPort(resolvedLocalPort, { preferHost: false });
                killListeningPort(resolvedLocalPort, { preferHost: true });
            }
            return;
        }
        if (serverProcess.kind === 'node') {
            stopLocalPublicServer(serverProcess.server).catch(() => {});
        } else {
            killProcess(serverProcess);
        }
        if (
            startedLocalServer &&
            resolvedLocalPort > 0 &&
            options.portSource !== 'cli'
        ) {
            killListeningPort(resolvedLocalPort, { preferHost: false });
            killListeningPort(resolvedLocalPort, { preferHost: true });
        }
        serverProcess = null;
    };

    const forwardSignal = (signal) => {
        cleanup();
        process.exit(signal === 'SIGINT' ? 130 : 143);
    };

    process.once('SIGINT', () => forwardSignal('SIGINT'));
    process.once('SIGTERM', () => forwardSignal('SIGTERM'));

    try {
        const childEnv = {
            ...process.env,
            TEST_LOCAL_SERVER: 'php',
            TEST_REUSE_EXISTING_SERVER: '1',
        };

        if (options.baseUrl) {
            childEnv.TEST_BASE_URL = options.baseUrl;
        } else {
            resolvedLocalPort = await resolveLocalServerPort(options);
            const baseUrl = `http://${options.host}:${resolvedLocalPort}`;
            childEnv.TEST_LOCAL_SERVER_PORT = String(resolvedLocalPort);
            process.stdout.write(
                `[run-playwright-local] local server ${baseUrl}\n`
            );

            if (options.serverEngine === 'node') {
                serverProcess = await startLocalNodeServer(
                    options.host,
                    resolvedLocalPort,
                    options.runtimeRoot
                );
            } else {
                serverProcess = startLocalPhpServer(
                    options.host,
                    resolvedLocalPort
                );
            }
            startedLocalServer = true;
            const ready = await waitForHttpReady(
                `${baseUrl}/`,
                options.timeoutMs
            );
            if (!ready) {
                throw new Error(
                    `El servidor local no quedo listo en ${baseUrl}`
                );
            }
        }

        const exitCode = await runPlaywrightCommand(
            options.playwrightArgs,
            childEnv
        );
        cleanup();
        process.exitCode = exitCode;
    } catch (error) {
        cleanup();
        process.stderr.write(
            `[run-playwright-local] ${
                error instanceof Error ? error.message : String(error)
            }\n`
        );
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    DEFAULT_HOST,
    DEFAULT_PORT,
    DEFAULT_PORT_SCAN_WINDOW,
    DEFAULT_TIMEOUT_MS,
    DEFAULT_PHP_SERVER_WORKERS,
    DEFAULT_SERVER_ENGINE,
    buildPlaywrightCommandArgs,
    canListenOnPort,
    extractListeningPids,
    parseArgs,
    parsePortEnv,
    resolveLocalServerPort,
};
