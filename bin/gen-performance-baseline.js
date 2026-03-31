#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function run() {
    console.log('[perf:baseline] Orchestrating Lighthouse via performance-gate...');

    const runDir = path.resolve('verification', 'baseline-run');
    if (fs.existsSync(runDir)) {
        fs.rmSync(runDir, { recursive: true, force: true });
    }

    // Run the gate specifically for /es/ to get metrics
    const result = spawnSync(
        'node',
        [
            'bin/run-public-performance-gate.js',
            '--routes',
            '/es/',
            '--out-dir',
            runDir,
            '--label',
            'baseline'
        ],
        { stdio: 'inherit', encoding: 'utf8', env: { ...process.env, npm_config_strict_ssl: 'false' } }
    );

    // Parse the output directory payload
    const outputDirs = fs.existsSync(runDir) ? fs.readdirSync(runDir) : [];
    const baselineDir = outputDirs.find(d => d.includes('baseline'));

    if (!baselineDir) {
        console.error('[perf:baseline] Could not find baseline output from performance-gate.');
        process.exit(1);
    }

    const payloadPath = path.join(runDir, baselineDir, 'performance-gate.json');
    if (!fs.existsSync(payloadPath)) {
        console.error(`[perf:baseline] Missing json payload at: ${payloadPath}`);
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
    const routeData = data.routes.find(r => r.route === '/es/');

    if (!routeData) {
        console.error('[perf:baseline] No route data for /es/ inside the JSON payload.');
        process.exit(1);
    }

    // Lighthouse JSON report is actually saved nearby as lighthouse-home.report.json
    const rawReportPath = path.join(runDir, baselineDir, 'lighthouse-home.report.json');
    let fcp = 'N/A';
    let tbt = 'N/A';

    if (fs.existsSync(rawReportPath)) {
        try {
            const rawReport = JSON.parse(fs.readFileSync(rawReportPath, 'utf8'));
            fcp = rawReport.audits['first-contentful-paint']?.displayValue || 'N/A';
            tbt = rawReport.audits['total-blocking-time']?.displayValue || 'N/A';
        } catch (e) {
            console.log('[perf:baseline] Warning: Could not read raw report for FCP/TBT');
        }
    }

    const score = (routeData.scores?.performance || 0) * 100;
    const lcp = routeData.metrics?.lcpMs ? `${Math.round(routeData.metrics.lcpMs)} ms` : 'N/A';
    const cls = routeData.metrics?.cls !== null && routeData.metrics?.cls !== undefined 
        ? routeData.metrics.cls.toFixed(3) 
        : 'N/A';

    console.log(`\n\n[perf:baseline] Metrics Extracted:`);
    console.log(`- Score: ${score}`);
    console.log(`- LCP: ${lcp}`);
    console.log(`- CLS: ${cls}`);
    console.log(`- TBT: ${tbt}`);
    console.log(`- FCP: ${fcp}`);

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

try {
    run();
} catch (e) {
    console.error(e);
    process.exit(1);
}
