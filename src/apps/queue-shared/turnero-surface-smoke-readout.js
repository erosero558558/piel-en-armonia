import {
    asObject,
    escapeHtml,
    toArray,
    toString,
} from './turnero-surface-helpers.js';
import { buildTurneroSurfaceManifestReconciler } from './turnero-surface-manifest-reconciler.js';
import { buildTurneroSurfaceRuntimeSnapshot } from './turnero-surface-runtime-snapshot.js';
import { buildTurneroSurfaceSmokeGate } from './turnero-surface-smoke-gate.js';
import { buildTurneroSurfaceSyncReadout } from './turnero-surface-sync-readout.js';

function buildSurfaceReadouts(surfacePacks = []) {
    return toArray(surfacePacks).map((item) => {
        const readout = buildTurneroSurfaceSyncReadout(item?.pack || {});
        return {
            label: toString(item?.label || readout.surfaceKey, 'surface'),
            surfaceKey: toString(readout.surfaceKey, 'surface'),
            gateBand: toString(readout.gateBand, 'degraded'),
            gateScore: Number(readout.gateScore || 0) || 0,
            visibleTurn: toString(readout.visibleTurn, ''),
            queueVersion: toString(readout.queueVersion, ''),
            openHandoffs: Number(readout.openHandoffs || 0) || 0,
            summary: toString(readout.summary, ''),
            driftState: toString(readout.driftState, 'unknown'),
        };
    });
}

function buildSummaryLine(gate, manifestPack, evidenceSummary) {
    const manifestMode = toString(manifestPack.summary?.mode, 'unknown');
    return [
        `${toString(gate.band, 'unknown')} · ${Number(gate.score || 0)}/100`,
        `manifest ${manifestMode}`,
        `evidence ${Number(evidenceSummary.captured || 0)}/${Number(
            evidenceSummary.all || 0
        )}`,
        `handoffs ${Number(gate.openHandoffs || 0)}`,
    ].join(' · ');
}

export function buildTurneroSurfaceSmokeReadout(input = {}) {
    const reconciler =
        input.reconciler && typeof input.reconciler === 'object'
            ? input.reconciler
            : buildTurneroSurfaceManifestReconciler({
                  registry: input.registry,
                  truthPack: input.truthPack,
                  loadedAt: input.loadedAt,
              });
    const runtimeSnapshot =
        input.runtimeSnapshot && typeof input.runtimeSnapshot === 'object'
            ? input.runtimeSnapshot
            : buildTurneroSurfaceRuntimeSnapshot({
                  ...input,
                  registry: reconciler.registry,
                  truthPack: reconciler.truthPack,
                  reconciler,
              });
    const evidenceSummary = asObject(input.evidenceSummary);
    const surfacePacks = toArray(input.surfacePacks);
    const gate =
        input.smokeGate && typeof input.smokeGate === 'object'
            ? input.smokeGate
            : buildTurneroSurfaceSmokeGate({
                  surfacePacks,
                  manifestSource: runtimeSnapshot.manifestSource,
                  runtimeSnapshot,
                  evidenceSummary,
                  openHandoffs: input.openHandoffs,
              });
    const surfaceReadouts = buildSurfaceReadouts(surfacePacks);
    const summary = {
        state: gate.band,
        label:
            gate.band === 'ready'
                ? 'Listo'
                : gate.band === 'watch'
                  ? 'En vigilancia'
                  : gate.band === 'degraded'
                    ? 'Degradado'
                    : 'Bloqueado',
        score: gate.score,
        manifestMode: toString(reconciler.summary?.mode, 'unknown'),
        manifestSource: toString(reconciler.summary?.manifestSource, 'missing'),
        runtimeState: toString(runtimeSnapshot.runtimeState, 'unknown'),
        evidenceCaptured: Number(evidenceSummary.captured || 0) || 0,
        evidenceOpen: Number(evidenceSummary.open || 0) || 0,
        surfaceReadyCount: Number(gate.surfaceSummary?.ready || 0) || 0,
        surfaceWatchCount: Number(gate.surfaceSummary?.watch || 0) || 0,
        surfaceDegradedCount: Number(gate.surfaceSummary?.degraded || 0) || 0,
        surfaceBlockedCount: Number(gate.surfaceSummary?.blocked || 0) || 0,
        openHandoffs: Number(gate.openHandoffs || 0) || 0,
        brief: buildSummaryLine(gate, reconciler, evidenceSummary),
    };

    return {
        reconciler,
        runtimeSnapshot,
        smokeGate: gate,
        evidenceSummary: {
            ...evidenceSummary,
            all: Number(evidenceSummary.all || 0) || 0,
            captured: Number(evidenceSummary.captured || 0) || 0,
            review: Number(evidenceSummary.review || 0) || 0,
            resolved: Number(evidenceSummary.resolved || 0) || 0,
            missing: Number(evidenceSummary.missing || 0) || 0,
            stale: Number(evidenceSummary.stale || 0) || 0,
            open: Number(evidenceSummary.open || 0) || 0,
        },
        surfaceReadouts,
        summary,
        generatedAt: new Date().toISOString(),
    };
}

export function formatTurneroSurfaceSmokeReadoutBrief(readout = {}) {
    const summary = asObject(readout.summary);
    const surfaceReadouts = toArray(readout.surfaceReadouts);
    const lines = [
        '# Turnero Surface Smoke Readout',
        '',
        `State: ${toString(summary.state, 'unknown')}`,
        `Score: ${Number(summary.score || 0)}/100`,
        `Manifest mode: ${toString(summary.manifestMode, 'unknown')}`,
        `Manifest source: ${toString(summary.manifestSource, 'missing')}`,
        `Runtime: ${toString(summary.runtimeState, 'unknown')}`,
        `Evidence: ${Number(summary.evidenceCaptured || 0)}/${Number(
            readout.evidenceSummary?.all || 0
        )}`,
        `Open handoffs: ${Number(summary.openHandoffs || 0)}`,
        '',
    ];

    surfaceReadouts.forEach((item) => {
        lines.push(
            `- ${item.label} (${item.surfaceKey}) · ${item.gateBand} · ${item.driftState} · ${item.visibleTurn || '--'}`
        );
    });

    return lines.join('\n').trim();
}

export function renderTurneroSurfaceSmokeReadoutSummary(readout = {}) {
    const summary = asObject(readout.summary);
    return `
        <article class="turnero-surface-smoke-readout" data-state="${escapeHtml(
            toString(summary.state, 'unknown')
        )}">
            <strong>${escapeHtml(
                `${toString(summary.label, 'Bloqueado')} · ${Number(
                    summary.score || 0
                )}/100`
            )}</strong>
            <span>${escapeHtml(summary.brief || '')}</span>
        </article>
    `.trim();
}
