import {
    asObject,
    escapeHtml,
    toArray,
    toString,
} from './turnero-surface-helpers.js';
import { buildTurneroSurfaceManifestReconciler } from './turnero-surface-manifest-reconciler.js';
import { buildTurneroSurfaceRuntimeSnapshot } from './turnero-surface-runtime-snapshot.js';
import { buildTurneroSurfaceSmokeGate } from './turnero-surface-smoke-gate.js';
import {
    buildTurneroSurfaceSmokeReadout,
    formatTurneroSurfaceSmokeReadoutBrief,
} from './turnero-surface-smoke-readout.js';
import { buildTurneroSurfaceSyncPack } from './turnero-surface-sync-pack.js';

export function buildTurneroSurfaceReleaseSyncPack(input = {}) {
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
    const handoffs = toArray(input.handoffs);
    const smokeGate =
        input.smokeGate && typeof input.smokeGate === 'object'
            ? input.smokeGate
            : buildTurneroSurfaceSmokeGate({
                  surfacePacks,
                  runtimeSnapshot,
                  manifestSource: runtimeSnapshot.manifestSource,
                  evidenceSummary,
                  openHandoffs: handoffs.filter(
                      (handoff) =>
                          String(handoff?.status || '').toLowerCase() !==
                          'closed'
                  ).length,
              });
    const smokeReadout =
        input.smokeReadout && typeof input.smokeReadout === 'object'
            ? input.smokeReadout
            : buildTurneroSurfaceSmokeReadout({
                  reconciler,
                  runtimeSnapshot,
                  smokeGate,
                  evidenceSummary,
                  surfacePacks,
                  openHandoffs: smokeGate.openHandoffs,
              });
    const syncPack =
        input.syncPack && typeof input.syncPack === 'object'
            ? input.syncPack
            : input.surfaceKey
              ? buildTurneroSurfaceSyncPack({
                    surfaceKey: input.surfaceKey,
                    queueVersion:
                        input.queueVersion ||
                        runtimeSnapshot.queueVersion ||
                        '',
                    visibleTurn:
                        input.visibleTurn || runtimeSnapshot.visibleTurn,
                    announcedTurn:
                        input.announcedTurn || runtimeSnapshot.announcedTurn,
                    handoffState:
                        input.handoffState || runtimeSnapshot.handoffState,
                    heartbeat: input.heartbeat || {
                        state:
                            input.heartbeatState ||
                            runtimeSnapshot.heartbeatState,
                        channel:
                            input.heartbeatChannel ||
                            runtimeSnapshot.heartbeatChannel,
                    },
                    updatedAt: input.updatedAt || runtimeSnapshot.generatedAt,
                    counts: input.counts || null,
                    waitingCount: Number(input.waitingCount || 0) || 0,
                    calledCount: Number(input.calledCount || 0) || 0,
                    callingNow: toArray(input.callingNow),
                    nextTickets: toArray(input.nextTickets),
                    expectedVisibleTurn: input.expectedVisibleTurn || '',
                    expectedQueueVersion: input.expectedQueueVersion || '',
                    handoffs,
                })
              : null;

    return {
        reconciler,
        runtimeSnapshot,
        smokeGate,
        smokeReadout,
        syncPack,
        surfacePacks,
        evidenceSummary: smokeReadout.evidenceSummary,
        handoffs,
        summary: {
            state: smokeReadout.summary.state,
            label: smokeReadout.summary.label,
            score: smokeReadout.summary.score,
            manifestMode: smokeReadout.summary.manifestMode,
            manifestSource: smokeReadout.summary.manifestSource,
            runtimeState: smokeReadout.summary.runtimeState,
            evidenceCaptured: smokeReadout.summary.evidenceCaptured,
            evidenceOpen: smokeReadout.summary.evidenceOpen,
            openHandoffs: smokeReadout.summary.openHandoffs,
        },
        generatedAt: new Date().toISOString(),
    };
}

export function formatTurneroSurfaceReleaseSyncPackBrief(pack = {}) {
    const summary = asObject(pack.summary);
    return [
        '# Turnero Surface Release Sync',
        '',
        `State: ${toString(summary.state, 'unknown')}`,
        `Score: ${Number(summary.score || 0)}/100`,
        `Manifest mode: ${toString(summary.manifestMode, 'unknown')}`,
        `Manifest source: ${toString(summary.manifestSource, 'missing')}`,
        `Runtime: ${toString(summary.runtimeState, 'unknown')}`,
        `Evidence: ${Number(summary.evidenceCaptured || 0)}/${Number(
            pack.evidenceSummary?.all || 0
        )}`,
        `Open handoffs: ${Number(summary.openHandoffs || 0)}`,
    ]
        .filter(Boolean)
        .join('\n');
}

export function renderTurneroSurfaceReleaseSyncPackSummary(pack = {}) {
    const summary = asObject(pack.summary);
    return `
        <article class="turnero-surface-release-sync-pack" data-state="${escapeHtml(
            toString(summary.state, 'unknown')
        )}">
            <strong>${escapeHtml(
                `${toString(summary.label, 'Bloqueado')} · ${Number(
                    summary.score || 0
                )}/100`
            )}</strong>
            <span>${escapeHtml(summary.manifestMode || '')}</span>
        </article>
    `.trim();
}

export { formatTurneroSurfaceSmokeReadoutBrief };
