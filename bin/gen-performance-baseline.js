#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
    console.log('[perf:baseline] Starting local server...');
    const serverProcess = spawn(
        'php',
        ['-S', '127.0.0.1:8011', '-t', '.', 'bin/local-stage-router.php'],
        {
            cwd: process.cwd(),
            stdio: 'ignore',
            shell: false,
        }
    );

    await sleep(2000); // Wait for server to be ready

    const targetUrl = 'http://127.0.0.1:8011/es/';
    console.log(`[perf:baseline] Running Lighthouse on ${targetUrl}...`);

    const result = spawnSync(
        'npx',
        [
            '--yes',
            'lighthouse',
            targetUrl,
            '--output=json',
            '--quiet',
            '--form-factor=mobile',
            '--throttling-method=simulate',
            '--only-categories=performance',
            '--chrome-flags="--headless --no-sandbox --disable-gpu --disable-dev-shm-usage"'
        ],
        {
            encoding: 'utf8',
            shell: process.platform === 'win32'
        }
    );

    // Make sure we kill the server
    serverProcess.kill('SIGTERM');

    if (result.status !== 0) {
        console.error('[perf:baseline] Lighthouse failed.');
        if (result.stdout) console.error(result.stdout);
        if (result.stderr) console.error(result.stderr);
        process.exit(1);
    }

    let report;
    try {
        report = JSON.parse(result.stdout);
    } catch (e) {
        console.error('[perf:baseline] Could not parse Lighthouse JSON output.');
        process.exit(1);
    }

    const categories = report.categories || {};
    const audits = report.audits || {};

    const score = Number(categories.performance?.score || 0) * 100;
    const lcp = audits['largest-contentful-paint']?.displayValue || 'N/A';
    const cls = audits['cumulative-layout-shift']?.displayValue || 'N/A';
    const tbt = audits['total-blocking-time']?.displayValue || 'N/A';
    const fcp = audits['first-contentful-paint']?.displayValue || 'N/A';

    console.log(`[perf:baseline] Score: ${score}`);
    console.log(`[perf:baseline] LCP: ${lcp}`);
    console.log(`[perf:baseline] CLS: ${cls}`);
    console.log(`[perf:baseline] TBT: ${tbt}`);
    console.log(`[perf:baseline] FCP: ${fcp}`);

    const dateStr = new Date().toISOString();
    const mdContent = `# Performance Baseline

_Generated automatically via \`npm run perf:baseline\` on ${dateStr}_

## Environment
- **Target**: \`/es/\` (Local Server)
- **Form Factor**: Mobile (Simulated Throttling)

## Core Web Vitals & Metrics
- **Performance Score**: ${score} / 100
- **Largest Contentful Paint (LCP)**: ${lcp}
- **Cumulative Layout Shift (CLS)**: ${cls}
- **Total Blocking Time (TBT)**: ${tbt}
- **First Contentful Paint (FCP)**: ${fcp}
`;

    const docPath = 'docs/PERFORMANCE_BASELINE.md';
    fs.writeFileSync(docPath, mdContent, 'utf8');
    console.log(`[perf:baseline] Saved to ${docPath}`);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
