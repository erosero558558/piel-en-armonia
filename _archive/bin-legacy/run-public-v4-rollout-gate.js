#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
    const args = {
        baseUrl: process.env.PUBLIC_BASE_URL || 'https://pielarmonia.com',
        metricsFile: '',
        out: path.join('verification', 'public-v4-rollout-gate', 'report.json'),
        label: 'public-v4-rollout',
        surfaceTest: 'v4',
        surfaceControl: 'legacy',
        minViewBooking: 20,
        minStartCheckout: 10,
        maxConfirmedDropPp: 8,
        minConfirmedRatePct: 20,
        allowMissingControl: false,
        timeoutMs: 10000,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = String(argv[index] || '').trim();
        const next = String(argv[index + 1] || '').trim();
        if (token === '--base-url' && next) {
            args.baseUrl = next;
            index += 1;
            continue;
        }
        if (token === '--metrics-file' && next) {
            args.metricsFile = next;
            index += 1;
            continue;
        }
        if (token === '--out' && next) {
            args.out = next;
            index += 1;
            continue;
        }
        if (token === '--label' && next) {
            args.label = next;
            index += 1;
            continue;
        }
        if (token === '--surface-test' && next) {
            args.surfaceTest = next;
            index += 1;
            continue;
        }
        if (token === '--surface-control' && next) {
            args.surfaceControl = next;
            index += 1;
            continue;
        }
        if (token === '--min-view-booking' && next) {
            const parsed = Number(next);
            if (Number.isFinite(parsed) && parsed >= 0) {
                args.minViewBooking = parsed;
            }
            index += 1;
            continue;
        }
        if (token === '--min-start-checkout' && next) {
            const parsed = Number(next);
            if (Number.isFinite(parsed) && parsed >= 0) {
                args.minStartCheckout = parsed;
            }
            index += 1;
            continue;
        }
        if (token === '--max-confirmed-drop-pp' && next) {
            const parsed = Number(next);
            if (Number.isFinite(parsed) && parsed >= 0) {
                args.maxConfirmedDropPp = parsed;
            }
            index += 1;
            continue;
        }
        if (token === '--min-confirmed-rate-pct' && next) {
            const parsed = Number(next);
            if (Number.isFinite(parsed) && parsed >= 0) {
                args.minConfirmedRatePct = parsed;
            }
            index += 1;
            continue;
        }
        if (token === '--timeout-ms' && next) {
            const parsed = Number(next);
            if (Number.isFinite(parsed) && parsed >= 1000) {
                args.timeoutMs = parsed;
            }
            index += 1;
            continue;
        }
        if (token === '--allow-missing-control') {
            args.allowMissingControl = true;
        }
    }

    return args;
}

function normalizeLabel(value, fallback = '') {
    if (value === null || value === undefined) {
        return fallback;
    }
    const normalized = String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64);
    return normalized || fallback;
}

function parsePrometheusLabels(rawLabels) {
    const labels = {};
    const payload = String(rawLabels || '').trim();
    if (!payload) return labels;
    const pattern = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g;
    let match = pattern.exec(payload);
    while (match) {
        const key = String(match[1] || '').trim();
        const raw = String(match[2] || '');
        const decoded = raw
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
        if (key) {
            labels[key] = decoded;
        }
        match = pattern.exec(payload);
    }
    return labels;
}

function parsePrometheusCounterSeries(metricsText, metricName) {
    const rows = [];
    const escaped = metricName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
        `^${escaped}(?:\\{([^}]*)\\})?\\s+([+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)?)$`
    );
    const lines = String(metricsText || '').split(/\r?\n/);
    for (const rawLine of lines) {
        const line = String(rawLine || '').trim();
        if (!line || line.startsWith('#')) continue;
        const match = line.match(pattern);
        if (!match) continue;
        const labels = parsePrometheusLabels(match[1] || '');
        const value = Number(match[2]);
        if (!Number.isFinite(value) || value <= 0) continue;
        rows.push({
            labels,
            value,
        });
    }
    return rows;
}

function toPercent(numerator, denominator) {
    if (!Number.isFinite(denominator) || denominator <= 0) {
        return 0;
    }
    return Math.round((Number(numerator || 0) / denominator) * 1000) / 10;
}

function summarizeSurfaceStats(totals) {
    const viewBooking = Number(totals.view_booking || 0);
    const startCheckout = Number(totals.start_checkout || 0);
    const bookingConfirmed = Number(totals.booking_confirmed || 0);
    return {
        viewBooking,
        startCheckout,
        bookingConfirmed,
        startRatePct: toPercent(startCheckout, viewBooking),
        confirmedRatePct: toPercent(bookingConfirmed, startCheckout),
    };
}

function aggregateSurfaceStats(series) {
    const surfaces = {};
    for (const row of series) {
        const labels = row && row.labels ? row.labels : {};
        const event = normalizeLabel(labels.event, '');
        if (
            event !== 'view_booking' &&
            event !== 'start_checkout' &&
            event !== 'booking_confirmed'
        ) {
            continue;
        }
        const surface = normalizeLabel(labels.public_surface, '');
        if (!surface) continue;
        if (!surfaces[surface]) {
            surfaces[surface] = {
                view_booking: 0,
                start_checkout: 0,
                booking_confirmed: 0,
            };
        }
        surfaces[surface][event] += Number(row.value || 0);
    }

    const summary = {};
    for (const [surface, totals] of Object.entries(surfaces)) {
        summary[surface] = summarizeSurfaceStats(totals);
    }
    return summary;
}

function evaluateGate(surfaces, options) {
    const failures = [];
    const warnings = [];
    const testKey = normalizeLabel(options.surfaceTest, 'v4');
    const controlKey = normalizeLabel(options.surfaceControl, 'legacy');
    const testStats = surfaces[testKey] || null;
    const controlStats = surfaces[controlKey] || null;

    if (!testStats) {
        failures.push(`No hay muestras para surface test=${testKey}`);
    } else {
        if (testStats.viewBooking < options.minViewBooking) {
            failures.push(
                `Muestra insuficiente en ${testKey}: view_booking=${testStats.viewBooking} (< ${options.minViewBooking})`
            );
        }
        if (testStats.startCheckout < options.minStartCheckout) {
            failures.push(
                `Muestra insuficiente en ${testKey}: start_checkout=${testStats.startCheckout} (< ${options.minStartCheckout})`
            );
        }
        if (testStats.confirmedRatePct < options.minConfirmedRatePct) {
            failures.push(
                `Conversion baja en ${testKey}: confirmedRate=${testStats.confirmedRatePct}% (< ${options.minConfirmedRatePct}%)`
            );
        }
    }

    let confirmedDropPp = null;
    if (!controlStats) {
        if (!options.allowMissingControl) {
            failures.push(`No hay muestras para surface control=${controlKey}`);
        } else {
            warnings.push(
                `Control ${controlKey} ausente; se omite comparacion de drop`
            );
        }
    } else if (controlStats.startCheckout < options.minStartCheckout) {
        if (!options.allowMissingControl) {
            failures.push(
                `Control ${controlKey} sin muestra minima: start_checkout=${controlStats.startCheckout} (< ${options.minStartCheckout})`
            );
        } else {
            warnings.push(
                `Control ${controlKey} con muestra baja; se omite comparacion de drop`
            );
        }
    } else if (testStats) {
        confirmedDropPp =
            Math.round(
                (controlStats.confirmedRatePct - testStats.confirmedRatePct) *
                    10
            ) / 10;
        if (confirmedDropPp > options.maxConfirmedDropPp) {
            failures.push(
                `Drop de conversion superior al umbral: ${confirmedDropPp}pp (> ${options.maxConfirmedDropPp}pp)`
            );
        }
    }

    return {
        passed: failures.length === 0,
        failures,
        warnings,
        testSurface: testKey,
        controlSurface: controlKey,
        confirmedDropPp,
    };
}

async function fetchMetricsText(baseUrl, timeoutMs) {
    const trimmed = String(baseUrl || '').trim();
    if (!trimmed) {
        throw new Error('base-url vacio');
    }
    let target;
    try {
        target = new URL('/api.php?resource=metrics', trimmed);
    } catch (_error) {
        throw new Error(`base-url invalido: ${trimmed}`);
    }
    const response = await fetch(target.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
            Accept: 'text/plain,application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`metrics endpoint respondio ${response.status}`);
    }
    return response.text();
}

function toMarkdown(report) {
    const lines = [
        '# Public V4 Rollout Gate',
        '',
        `- label: \`${report.label}\``,
        `- generatedAt: \`${report.generatedAt}\``,
        `- source: \`${report.source}\``,
        `- baseUrl: \`${report.baseUrl || 'n/a'}\``,
        `- passed: \`${report.passed ? 'yes' : 'no'}\``,
        `- testSurface: \`${report.evaluation.testSurface}\``,
        `- controlSurface: \`${report.evaluation.controlSurface}\``,
        `- confirmedDropPp: \`${report.evaluation.confirmedDropPp ?? 'n/a'}\``,
        '',
        '## Surface stats',
        '',
    ];

    const surfaceEntries = Object.entries(report.surfaces || {});
    if (surfaceEntries.length === 0) {
        lines.push('- sin datos');
    } else {
        for (const [surface, stats] of surfaceEntries) {
            lines.push(
                `- ${surface}: view=${stats.viewBooking}, start=${stats.startCheckout}, confirmed=${stats.bookingConfirmed}, startRate=${stats.startRatePct}%, confirmedRate=${stats.confirmedRatePct}%`
            );
        }
    }

    if ((report.warnings || []).length > 0) {
        lines.push('');
        lines.push('## Warnings');
        lines.push('');
        for (const warning of report.warnings) {
            lines.push(`- ${warning}`);
        }
    }

    if ((report.failures || []).length > 0) {
        lines.push('');
        lines.push('## Failures');
        lines.push('');
        for (const failure of report.failures) {
            lines.push(`- ${failure}`);
        }
    }

    return `${lines.join('\n')}\n`;
}

async function run() {
    const args = parseArgs(process.argv.slice(2));
    const outputPath = path.resolve(args.out);
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    let metricsText = '';
    let source = 'http';
    if (args.metricsFile) {
        const metricsPath = path.resolve(args.metricsFile);
        if (!fs.existsSync(metricsPath)) {
            throw new Error(`metrics-file no existe: ${metricsPath}`);
        }
        metricsText = fs.readFileSync(metricsPath, 'utf8');
        source = 'metrics-file';
    } else {
        metricsText = await fetchMetricsText(args.baseUrl, args.timeoutMs);
    }

    const series = parsePrometheusCounterSeries(
        metricsText,
        'conversion_funnel_events_total'
    );
    const surfaces = aggregateSurfaceStats(series);
    const evaluation = evaluateGate(surfaces, args);
    const report = {
        label: args.label,
        generatedAt: new Date().toISOString(),
        source,
        baseUrl: args.baseUrl,
        parameters: {
            surfaceTest: normalizeLabel(args.surfaceTest, 'v4'),
            surfaceControl: normalizeLabel(args.surfaceControl, 'legacy'),
            minViewBooking: args.minViewBooking,
            minStartCheckout: args.minStartCheckout,
            maxConfirmedDropPp: args.maxConfirmedDropPp,
            minConfirmedRatePct: args.minConfirmedRatePct,
            allowMissingControl: args.allowMissingControl,
        },
        surfaces,
        evaluation,
        warnings: evaluation.warnings,
        failures: evaluation.failures,
        passed: evaluation.passed,
    };

    fs.writeFileSync(
        outputPath,
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8'
    );
    const markdownPath = outputPath.replace(/\.json$/i, '.md');
    fs.writeFileSync(markdownPath, toMarkdown(report), 'utf8');

    console.log(`[public-v4-rollout-gate] report: ${outputPath}`);
    console.log(`[public-v4-rollout-gate] summary: ${markdownPath}`);
    if (!report.passed) {
        console.error('[public-v4-rollout-gate] FAILED');
        for (const failure of report.failures) {
            console.error(`- ${failure}`);
        }
        process.exitCode = 1;
        return;
    }
    console.log('[public-v4-rollout-gate] PASSED');
}

run().catch((error) => {
    console.error('[public-v4-rollout-gate] ERROR:', error.message);
    process.exitCode = 1;
});
