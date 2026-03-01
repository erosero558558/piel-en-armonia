#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

async function sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                server.close(() =>
                    reject(new Error('Could not resolve free port'))
                );
                return;
            }
            server.close(() => resolve(address.port));
        });
    });
}

async function waitForHttpReady(url, timeoutMs = 12000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                redirect: 'manual',
                signal: AbortSignal.timeout(1500),
            });
            if (response.status >= 200 && response.status < 500) {
                return true;
            }
        } catch (_error) {
            // retry
        }
        await sleep(200);
    }
    return false;
}

function stopProcess(proc) {
    if (!proc || !proc.pid) return;
    if (process.platform === 'win32') {
        spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {
            stdio: 'ignore',
            shell: true,
        });
        return;
    }
    proc.kill('SIGTERM');
}

async function startPhpServer(envOverrides = {}) {
    const port = await getFreePort();
    const env = { ...process.env, ...envOverrides };
    const proc = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', '.'], {
        cwd: REPO_ROOT,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
    });

    const baseUrl = `http://127.0.0.1:${port}`;
    const ready = await waitForHttpReady(`${baseUrl}/legacy.php`);
    if (!ready) {
        stopProcess(proc);
        throw new Error('Local PHP server did not become ready');
    }

    return { proc, baseUrl };
}

async function request(baseUrl, route, headers = {}) {
    return fetch(`${baseUrl}${route}`, {
        method: 'GET',
        redirect: 'manual',
        headers,
        signal: AbortSignal.timeout(5000),
    });
}

async function withServer(envOverrides, run) {
    const { proc, baseUrl } = await startPhpServer(envOverrides);
    try {
        await run(baseUrl);
    } finally {
        stopProcess(proc);
    }
}

test('root gateway routes to /es/ by default with non-English Accept-Language', async () => {
    await withServer(
        {
            PIELARMONIA_PUBLIC_V4_ENABLED: 'true',
            PIELARMONIA_PUBLIC_V4_RATIO: '1',
            PIELARMONIA_PUBLIC_V4_KILL_SWITCH: 'false',
            PIELARMONIA_PUBLIC_V4_FORCE_LOCALE: '',
        },
        async (baseUrl) => {
            const response = await request(baseUrl, '/', {
                'accept-language': 'es-EC,es;q=0.9',
            });
            assert.equal(response.status, 302);
            assert.equal(response.headers.get('location'), '/es/');
        }
    );
});

test('root gateway routes to /en/ when Accept-Language starts with en', async () => {
    await withServer(
        {
            PIELARMONIA_PUBLIC_V4_ENABLED: 'true',
            PIELARMONIA_PUBLIC_V4_RATIO: '1',
            PIELARMONIA_PUBLIC_V4_KILL_SWITCH: 'false',
            PIELARMONIA_PUBLIC_V4_FORCE_LOCALE: '',
        },
        async (baseUrl) => {
            const response = await request(baseUrl, '/', {
                'accept-language': 'en-US,en;q=0.9',
            });
            assert.equal(response.status, 302);
            assert.equal(response.headers.get('location'), '/en/');
        }
    );
});

test('root gateway force-locale takes precedence over Accept-Language', async () => {
    await withServer(
        {
            PIELARMONIA_PUBLIC_V4_ENABLED: 'true',
            PIELARMONIA_PUBLIC_V4_RATIO: '1',
            PIELARMONIA_PUBLIC_V4_KILL_SWITCH: 'false',
            PIELARMONIA_PUBLIC_V4_FORCE_LOCALE: 'en',
        },
        async (baseUrl) => {
            const response = await request(baseUrl, '/', {
                'accept-language': 'es-EC,es;q=0.9',
            });
            assert.equal(response.status, 302);
            assert.equal(response.headers.get('location'), '/en/');
        }
    );
});

test('root gateway sends traffic to legacy when ratio is 0', async () => {
    await withServer(
        {
            PIELARMONIA_PUBLIC_V4_ENABLED: 'true',
            PIELARMONIA_PUBLIC_V4_RATIO: '0',
            PIELARMONIA_PUBLIC_V4_KILL_SWITCH: 'false',
            PIELARMONIA_PUBLIC_V4_FORCE_LOCALE: '',
        },
        async (baseUrl) => {
            const response = await request(baseUrl, '/');
            assert.equal(response.status, 302);
            assert.equal(response.headers.get('location'), '/legacy.php');
        }
    );
});

test('root gateway kill-switch sends traffic to legacy immediately', async () => {
    await withServer(
        {
            PIELARMONIA_PUBLIC_V4_ENABLED: 'true',
            PIELARMONIA_PUBLIC_V4_RATIO: '1',
            PIELARMONIA_PUBLIC_V4_KILL_SWITCH: 'true',
            PIELARMONIA_PUBLIC_V4_FORCE_LOCALE: '',
        },
        async (baseUrl) => {
            const response = await request(baseUrl, '/');
            assert.equal(response.status, 302);
            assert.equal(response.headers.get('location'), '/legacy.php');
        }
    );
});

test('root gateway publishes rollout headers for v4 decision path', async () => {
    await withServer(
        {
            PIELARMONIA_PUBLIC_V4_ENABLED: 'true',
            PIELARMONIA_PUBLIC_V4_RATIO: '1',
            PIELARMONIA_PUBLIC_V4_KILL_SWITCH: 'false',
            PIELARMONIA_PUBLIC_V4_FORCE_LOCALE: '',
        },
        async (baseUrl) => {
            const response = await request(baseUrl, '/', {
                'accept-language': 'es-EC,es;q=0.9',
            });
            assert.equal(response.status, 302);
            assert.equal(response.headers.get('location'), '/es/');
            assert.equal(response.headers.get('x-public-surface'), 'v4');
            assert.equal(response.headers.get('x-public-v4-enabled'), 'true');
            assert.equal(response.headers.get('x-public-v4-ratio'), '1.0000');
            assert.equal(
                response.headers.get('x-public-v4-kill-switch'),
                'false'
            );
        }
    );
});

test('root gateway honors surface=v4 override even when rollout ratio is 0', async () => {
    await withServer(
        {
            PIELARMONIA_PUBLIC_V4_ENABLED: 'true',
            PIELARMONIA_PUBLIC_V4_RATIO: '0',
            PIELARMONIA_PUBLIC_V4_KILL_SWITCH: 'false',
            PIELARMONIA_PUBLIC_V4_FORCE_LOCALE: '',
        },
        async (baseUrl) => {
            const response = await request(baseUrl, '/?surface=v4');
            assert.equal(response.status, 302);
            assert.equal(response.headers.get('location'), '/es/');
            assert.equal(response.headers.get('x-public-surface'), 'v4');
            const setCookie = response.headers.get('set-cookie') || '';
            assert.match(setCookie, /pa_public_surface=v4/i);
        }
    );
});

test('root gateway supports surface=auto by clearing stale cookie and re-evaluating rollout', async () => {
    await withServer(
        {
            PIELARMONIA_PUBLIC_V4_ENABLED: 'true',
            PIELARMONIA_PUBLIC_V4_RATIO: '1',
            PIELARMONIA_PUBLIC_V4_KILL_SWITCH: 'false',
            PIELARMONIA_PUBLIC_V4_FORCE_LOCALE: '',
        },
        async (baseUrl) => {
            const response = await request(baseUrl, '/?surface=auto', {
                cookie: 'pa_public_surface=legacy',
            });
            assert.equal(response.status, 302);
            assert.equal(response.headers.get('location'), '/es/');
            assert.equal(response.headers.get('x-public-surface'), 'v4');
            const setCookie = response.headers.get('set-cookie') || '';
            assert.match(setCookie, /pa_public_surface=v4/i);
        }
    );
});

test('root gateway falls back to catalog defaults when env vars are empty', async () => {
    await withServer(
        {
            PIELARMONIA_PUBLIC_V4_ENABLED: '',
            PIELARMONIA_PUBLIC_V4_RATIO: '',
            PIELARMONIA_PUBLIC_V4_KILL_SWITCH: '',
            PIELARMONIA_PUBLIC_V4_FORCE_LOCALE: '',
        },
        async (baseUrl) => {
            const response = await request(baseUrl, '/', {
                'accept-language': 'es-EC,es;q=0.9',
            });
            assert.equal(response.status, 302);
            assert.equal(response.headers.get('location'), '/es/');
            assert.equal(response.headers.get('x-public-surface'), 'v4');
            assert.equal(response.headers.get('x-public-v4-ratio'), '1.0000');
        }
    );
});

test('root gateway honors legacy override query and persists surface cookie', async () => {
    await withServer(
        {
            PIELARMONIA_PUBLIC_V4_ENABLED: 'true',
            PIELARMONIA_PUBLIC_V4_RATIO: '1',
            PIELARMONIA_PUBLIC_V4_KILL_SWITCH: 'false',
            PIELARMONIA_PUBLIC_V4_FORCE_LOCALE: '',
        },
        async (baseUrl) => {
            const response = await request(baseUrl, '/?legacy=1');
            assert.equal(response.status, 302);
            assert.equal(response.headers.get('location'), '/legacy.php');
            const setCookie = response.headers.get('set-cookie') || '';
            assert.match(setCookie, /pa_public_surface=legacy/i);
        }
    );
});
