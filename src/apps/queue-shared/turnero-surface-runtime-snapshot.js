import { asObject, escapeHtml, toString } from './turnero-surface-helpers.js';
import { buildTurneroSurfaceManifestReconciler } from './turnero-surface-manifest-reconciler.js';
import { buildTurneroSurfaceReleaseReadinessPack } from './turnero-surface-release-readiness-pack.js';
import {
    buildTurneroSurfaceSyncSnapshot,
    resolveTurneroSurfaceSyncQueueVersion,
} from './turnero-surface-sync-snapshot.js';
import {
    normalizeTurneroSurfaceId,
    normalizeTurneroSurfaceKey,
    normalizeTurneroSurfacePath,
} from './turnero-surface-release-truth.js';

function resolveCurrentRoute(input = {}) {
    const explicitRoute = toString(input.currentRoute, '');
    if (explicitRoute) {
        return explicitRoute;
    }

    if (typeof window !== 'undefined' && window.location) {
        return `${window.location.pathname || ''}${window.location.search || ''}${
            window.location.hash || ''
        }`;
    }

    return '';
}

function resolveVisibilityState(input = {}) {
    const explicitState = toString(input.visibilityState, '');
    if (explicitState) {
        return explicitState;
    }

    if (typeof document !== 'undefined') {
        return toString(document.visibilityState, 'visible');
    }

    return 'visible';
}

function resolveOnlineState(input = {}) {
    if (typeof input.online === 'boolean') {
        return input.online;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return false;
    }

    return true;
}

function resolveRuntimeState(input = {}) {
    const explicitState = toString(input.runtimeState, '');
    if (explicitState) {
        return explicitState;
    }

    const online = resolveOnlineState(input);
    const visibilityState = resolveVisibilityState(input);
    const readinessBand = toString(input.readinessBand, '');
    const manifestSource = toString(input.manifestSource, '');

    if (!online) {
        return 'degraded';
    }

    if (visibilityState === 'hidden') {
        return 'watch';
    }

    if (readinessBand === 'degraded') {
        return 'degraded';
    }

    if (readinessBand === 'watch' || manifestSource === 'fallback') {
        return 'watch';
    }

    if (readinessBand === 'ready') {
        return 'ready';
    }

    return 'unknown';
}

export function buildTurneroSurfaceRuntimeSnapshot(input = {}) {
    const reconciler =
        input.reconciler && typeof input.reconciler === 'object'
            ? input.reconciler
            : buildTurneroSurfaceManifestReconciler({
                  registry: input.registry,
                  truthPack: input.truthPack,
                  loadedAt: input.loadedAt,
              });
    const readinessPack =
        input.readinessPack && typeof input.readinessPack === 'object'
            ? input.readinessPack
            : buildTurneroSurfaceReleaseReadinessPack({
                  registry: reconciler.registry,
                  truthPack: reconciler.truthPack,
                  surfaceKey: input.surfaceKey,
                  surfaceId: input.surfaceId,
                  surfaceRoute: input.surfaceRoute,
                  runtimeState: input.runtimeState,
                  clinicProfile: input.clinicProfile,
              });
    const syncSnapshot = buildTurneroSurfaceSyncSnapshot({
        ...input,
        queueVersion:
            input.queueVersion ||
            resolveTurneroSurfaceSyncQueueVersion({
                ...input,
                updatedAt: input.updatedAt || readinessPack.generatedAt,
            }),
        updatedAt: input.updatedAt || readinessPack.generatedAt,
        visibleTurn: input.visibleTurn || '',
        announcedTurn: input.announcedTurn || '',
        handoffState: input.handoffState || 'unknown',
        heartbeat: input.heartbeat || {
            state: input.heartbeatState || 'unknown',
            channel: input.heartbeatChannel || 'unknown',
        },
    });
    const surfaceKey = normalizeTurneroSurfaceKey(
        input.surfaceKey ||
            input.surfaceId ||
            input.surfaceRoute ||
            syncSnapshot.surfaceKey
    );
    const surfaceId = normalizeTurneroSurfaceId(
        input.surfaceId || surfaceKey || input.surfaceRoute
    );
    const currentRoute = resolveCurrentRoute(input);
    const runtimeState = resolveRuntimeState({
        ...input,
        manifestSource:
            input.manifestSource || reconciler.summary?.manifestSource || '',
        readinessBand: input.readinessBand || readinessPack.band || '',
    });
    const visibilityState = resolveVisibilityState(input);
    const online = resolveOnlineState(input);
    const manifestSource = toString(
        input.manifestSource || reconciler.summary?.manifestSource,
        'missing'
    );

    return {
        ...syncSnapshot,
        snapshot: syncSnapshot,
        reconciler,
        readinessPack,
        surfaceKey: surfaceKey || syncSnapshot.surfaceKey,
        surfaceId: surfaceId || '',
        currentRoute: currentRoute || normalizeTurneroSurfacePath(surfaceId),
        online,
        visibilityState,
        runtimeState,
        manifestSource,
        truthMode: toString(
            readinessPack.truthPack?.summary?.mode || input.truthMode,
            'unknown'
        ),
        readinessBand: toString(
            readinessPack.band || input.readinessBand,
            'unknown'
        ),
        readinessScore:
            Number(readinessPack.score || input.readinessScore || 0) || 0,
        ready:
            runtimeState === 'ready' && online && visibilityState !== 'hidden',
        summary: {
            state: runtimeState,
            label: runtimeState === 'ready' ? 'Operativo' : 'Revisión',
            runtimeState,
            visibilityState,
            online,
            manifestSource,
            readinessBand: toString(
                readinessPack.band || input.readinessBand,
                'unknown'
            ),
            score:
                Number(readinessPack.score || input.readinessScore || 0) || 0,
            truthMode: toString(
                readinessPack.truthPack?.summary?.mode || input.truthMode,
                'unknown'
            ),
        },
        generatedAt: new Date().toISOString(),
    };
}

export function formatTurneroSurfaceRuntimeSnapshotBrief(snapshot = {}) {
    return [
        '# Turnero Surface Runtime Snapshot',
        '',
        `Surface: ${toString(snapshot.surfaceKey, 'surface')}`,
        `Route: ${toString(snapshot.currentRoute, '')}`,
        `Online: ${snapshot.online === false ? 'false' : 'true'}`,
        `Visibility: ${toString(snapshot.visibilityState, 'visible')}`,
        `Runtime: ${toString(snapshot.runtimeState, 'unknown')}`,
        `Manifest source: ${toString(snapshot.manifestSource, 'missing')}`,
        `Truth: ${toString(snapshot.truthMode, 'unknown')}`,
        `Readiness: ${toString(snapshot.readinessBand, 'unknown')}`,
        `Queue version: ${toString(snapshot.queueVersion, '')}`,
    ]
        .filter(Boolean)
        .join('\n');
}

export function renderTurneroSurfaceRuntimeSnapshotSummary(snapshot = {}) {
    return `
        <article class="turnero-surface-runtime-snapshot" data-state="${escapeHtml(
            toString(snapshot.runtimeState, 'unknown')
        )}">
            <strong>${escapeHtml(
                `${toString(snapshot.runtimeState, 'unknown')} · ${toString(
                    snapshot.visibilityState,
                    'visible'
                )}`
            )}</strong>
            <span>${escapeHtml(
                `manifest ${toString(snapshot.manifestSource, 'missing')} · readiness ${toString(
                    snapshot.readinessBand,
                    'unknown'
                )}`
            )}</span>
        </article>
    `.trim();
}
