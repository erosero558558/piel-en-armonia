import {
    asObject,
    escapeHtml,
    toArray,
    toString,
} from './turnero-surface-helpers.js';
import { buildTurneroSurfaceReleaseTruthPack } from './turnero-surface-release-truth.js';

function normalizeRows(rows = []) {
    return toArray(rows).map((row, index) => {
        const source = asObject(row);
        return {
            ...source,
            index,
            surfaceId: toString(source.surfaceId, source.id || ''),
            surfaceKey: toString(source.surfaceKey, source.key || ''),
            surfacePath: toString(source.surfacePath, source.path || ''),
            truth: toString(source.truth, 'unknown'),
            runtimeState: toString(source.runtimeState, 'unknown'),
            releaseState: toString(source.releaseState, 'unknown'),
            manifestVersion: toString(source.manifestVersion, 'n/a'),
        };
    });
}

function summarizeRows(rows = []) {
    const summary = {
        totalCount: rows.length,
        aligned: 0,
        watch: 0,
        degraded: 0,
        unknown: 0,
        mode: 'unknown',
    };

    for (const row of rows) {
        const truth = toString(row.truth, 'unknown');
        if (truth === 'aligned') {
            summary.aligned += 1;
        } else if (truth === 'watch') {
            summary.watch += 1;
        } else if (truth === 'degraded') {
            summary.degraded += 1;
        } else {
            summary.unknown += 1;
        }
    }

    if (summary.totalCount === 0) {
        summary.mode = 'unknown';
    } else if (summary.degraded > 0) {
        summary.mode = 'degraded';
    } else if (summary.watch > 0) {
        summary.mode = 'watch';
    } else {
        summary.mode = 'ready';
    }

    return summary;
}

export function buildTurneroSurfaceManifestReconciler(input = {}) {
    const registry = asObject(input.registry);
    const truthPack =
        input.truthPack && typeof input.truthPack === 'object'
            ? input.truthPack
            : buildTurneroSurfaceReleaseTruthPack({
                  registry,
                  loadedAt: input.loadedAt,
              });
    const rows = normalizeRows(truthPack.rows);
    const summary = summarizeRows(rows);

    return {
        registry,
        truthPack,
        rows,
        summary: {
            ...summary,
            manifestSource: toString(
                truthPack.summary?.manifestSource || registry.manifestSource,
                'missing'
            ),
            requestedManifestUrl: toString(
                truthPack.summary?.requestedManifestUrl ||
                    registry.requestedManifestUrl,
                ''
            ),
            resolvedManifestUrl: toString(
                truthPack.summary?.resolvedManifestUrl ||
                    registry.resolvedManifestUrl,
                ''
            ),
            surfacesUrl: toString(
                truthPack.summary?.surfacesUrl || registry.surfacesUrl,
                ''
            ),
        },
        manifest: asObject(registry.manifest),
        manifestApps: asObject(registry.manifest?.apps),
        generatedAt: new Date().toISOString(),
    };
}

export function buildTurneroSurfaceManifestReconciliationPack(input = {}) {
    return buildTurneroSurfaceManifestReconciler(input);
}

export function formatTurneroSurfaceManifestReconcilerBrief(pack = {}) {
    const summary = asObject(pack.summary);
    const rows = normalizeRows(pack.rows);
    const lines = [
        '# Turnero Surface Manifest Reconciler',
        '',
        `Mode: ${toString(summary.mode, 'unknown')}`,
        `Aligned: ${Number(summary.aligned || 0)}/${Number(
            summary.totalCount || rows.length || 0
        )}`,
        `Watch: ${Number(summary.watch || 0)}`,
        `Degraded: ${Number(summary.degraded || 0)}`,
        `Unknown: ${Number(summary.unknown || 0)}`,
        `Manifest source: ${toString(summary.manifestSource, 'missing')}`,
        `Requested manifest: ${toString(summary.requestedManifestUrl, '')}`,
        `Resolved manifest: ${toString(summary.resolvedManifestUrl, '')}`,
        '',
    ];

    rows.forEach((row) => {
        lines.push(
            `- ${row.label || row.surfaceKey || 'surface'} (${row.surfaceKey || row.surfaceId || 'surface'}) · ${row.truth} · ${row.runtimeState}/${row.releaseState} · ${row.surfacePath || row.path || ''} · v${row.manifestVersion || 'n/a'}`
        );
    });

    return lines.join('\n').trim();
}

export function renderTurneroSurfaceManifestReconcilerSummary(pack = {}) {
    const summary = asObject(pack.summary);
    return `
        <article class="turnero-surface-manifest-reconciler" data-state="${escapeHtml(
            toString(summary.mode, 'unknown')
        )}">
            <strong>${escapeHtml(
                `${toString(summary.mode, 'unknown')} · ${Number(
                    summary.aligned || 0
                )}/${Number(summary.totalCount || 0)} aligned`
            )}</strong>
            <span>${escapeHtml(
                `watch ${Number(summary.watch || 0)} · degraded ${Number(
                    summary.degraded || 0
                )} · unknown ${Number(summary.unknown || 0)}`
            )}</span>
        </article>
    `.trim();
}
