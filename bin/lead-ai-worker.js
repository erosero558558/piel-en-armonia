#!/usr/bin/env node
'use strict';

const {
    buildLeadOpsGatewayBody,
    buildLeadOpsResult,
} = require('./lib/lead-ai-worker');

function env(name, fallback = '') {
    const normalized = String(name || '').trim();
    if (!normalized) {
        return fallback;
    }

    const candidates = normalized.startsWith('AURORADERM_')
        ? [normalized, `PIELARMONIA_${normalized.slice('AURORADERM_'.length)}`]
        : normalized.startsWith('PIELARMONIA_')
          ? [`AURORADERM_${normalized.slice('PIELARMONIA_'.length)}`, normalized]
          : [normalized];

    for (const candidate of candidates) {
        const value = process.env[candidate];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    return fallback;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
    const args = new Set(argv);
    return {
        watch: args.has('--watch'),
        maxJobs: Number(env('OPENCLAW_WORKER_MAX_JOBS', '10')) || 10,
        intervalMs:
            Number(env('AURORADERM_LEADOPS_WORKER_INTERVAL_MS', '5000')) ||
            5000,
    };
}

function machineHeaders() {
    const token = env('AURORADERM_LEADOPS_MACHINE_TOKEN');
    if (!token) {
        throw new Error(
            'Falta AURORADERM_LEADOPS_MACHINE_TOKEN. El alias PIELARMONIA_* sigue disponible temporalmente.'
        );
    }

    const header = env(
        'AURORADERM_LEADOPS_MACHINE_TOKEN_HEADER',
        'Authorization'
    );
    const prefix = env('AURORADERM_LEADOPS_MACHINE_TOKEN_PREFIX', 'Bearer');
    return {
        [header]: `${prefix} ${token}`,
        Accept: 'application/json',
    };
}

async function apiJson(resource, options = {}) {
    const baseUrl = env(
        'AURORADERM_LEADOPS_SERVER_BASE_URL',
        'http://127.0.0.1'
    );
    const url = `${baseUrl.replace(/\/$/, '')}/api.php?resource=${encodeURIComponent(resource)}`;
    const method = String(options.method || 'GET').toUpperCase();
    const headers = {
        ...machineHeaders(),
        ...(options.headers || {}),
    };

    const init = {
        method,
        headers,
    };

    if (options.body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, init);
    const payload = await response.json();
    if (!response.ok || payload?.ok === false) {
        throw new Error(
            payload?.error || `HTTP ${response.status} en ${resource}`
        );
    }
    return payload;
}

async function callGateway(job) {
    const endpoint = env('OPENCLAW_GATEWAY_ENDPOINT');
    if (!endpoint) {
        throw new Error('Falta OPENCLAW_GATEWAY_ENDPOINT');
    }

    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    };
    const apiKey = env('OPENCLAW_GATEWAY_API_KEY');
    if (apiKey) {
        const headerName = env('OPENCLAW_GATEWAY_KEY_HEADER', 'Authorization');
        const prefix = env('OPENCLAW_GATEWAY_KEY_PREFIX', 'Bearer');
        headers[headerName] = `${prefix} ${apiKey}`;
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(
            buildLeadOpsGatewayBody(job, {
                model: env('OPENCLAW_GATEWAY_MODEL', 'openclaw:main'),
            })
        ),
    });

    const payload = await response.json();
    if (!response.ok) {
        throw new Error(
            payload?.error?.message || `Gateway HTTP ${response.status}`
        );
    }

    return buildLeadOpsResult(
        job,
        payload,
        `openclaw:${env('OPENCLAW_GATEWAY_MODEL', 'openclaw:main')}`
    );
}

async function processJob(job) {
    try {
        const result = await callGateway(job);
        await apiJson('lead-ai-result', {
            method: 'POST',
            body: result,
        });
        console.log(`[lead-ai-worker] callback ${job.callbackId}: completed`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await apiJson('lead-ai-result', {
            method: 'POST',
            body: {
                callbackId: Number(job?.callbackId || 0),
                objective: String(job?.objective || 'whatsapp_draft'),
                status: 'failed',
                summary: '',
                draft: '',
                provider: 'openclaw',
                error: message,
            },
        }).catch(() => {});
        console.error(
            `[lead-ai-worker] callback ${job.callbackId}: ${message}`
        );
    }
}

async function runCycle(maxJobs) {
    const queuePayload = await apiJson('lead-ai-queue');
    const jobs = Array.isArray(queuePayload?.data?.items)
        ? queuePayload.data.items.slice(0, maxJobs)
        : [];

    for (const job of jobs) {
        await processJob(job);
    }

    if (jobs.length === 0) {
        console.log('[lead-ai-worker] queue empty');
    }

    return jobs.length;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    let keepRunning = true;
    while (keepRunning) {
        try {
            await runCycle(args.maxJobs);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            console.error(`[lead-ai-worker] ${message}`);
        }

        if (!args.watch) {
            keepRunning = false;
            continue;
        }

        await sleep(args.intervalMs);
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
});
