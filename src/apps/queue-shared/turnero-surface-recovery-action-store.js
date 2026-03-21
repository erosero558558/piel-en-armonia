import { normalizeTurneroSurfaceRecoveryKey } from './turnero-surface-contract-snapshot.js';
import { asObject, toArray, toString } from './turnero-surface-helpers.js';
import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';

export const TURNERO_SURFACE_RECOVERY_ACTION_STORE_KEY =
    'turneroSurfaceRecoveryActionsV1';

const STORE_SCHEMA = 'turnero-surface-recovery-actions/v1';

const memoryFallbackStores = new Map();

function createEmptyEnvelope(clinicProfile) {
    return {
        schema: STORE_SCHEMA,
        clinicId: toString(clinicProfile?.clinic_id || 'default-clinic'),
        updatedAt: '',
        surfaces: {},
    };
}

function normalizeEnvelope(rawEnvelope, clinicProfile) {
    const source = asObject(rawEnvelope);
    const envelope = createEmptyEnvelope(clinicProfile);
    const surfaces =
        source.surfaces && typeof source.surfaces === 'object'
            ? source.surfaces
            : {};

    Object.entries(surfaces).forEach(([surfaceKey, record]) => {
        const normalizedSurfaceKey =
            normalizeTurneroSurfaceRecoveryKey(surfaceKey);
        const surfaceRecord = asObject(record);
        const actions = toArray(surfaceRecord.actions)
            .map((action) => normalizeAction(action, normalizedSurfaceKey))
            .filter(Boolean);
        if (!actions.length) {
            return;
        }
        envelope.surfaces[normalizedSurfaceKey] = {
            actions,
            updatedAt: toString(surfaceRecord.updatedAt, ''),
        };
    });

    envelope.schema = toString(source.schema, STORE_SCHEMA);
    envelope.updatedAt = toString(source.updatedAt, '');
    envelope.clinicId = toString(
        source.clinicId || clinicProfile?.clinic_id || envelope.clinicId
    );

    return envelope;
}

function normalizeAction(action, fallbackSurfaceKey) {
    const source = asObject(action);
    const surfaceKey = normalizeTurneroSurfaceRecoveryKey(
        source.surfaceKey || source.surface || fallbackSurfaceKey
    );
    const createdAt = toString(
        source.createdAt || source.created_at || source.updatedAt
    );
    const updatedAt = toString(
        source.updatedAt || source.updated_at || createdAt
    );
    const state = normalizeActionState(source.state || source.status || 'open');
    const severity = normalizeActionSeverity(
        source.severity || source.tone || 'low'
    );

    return {
        id: toString(source.id || `${surfaceKey}-${createdAt || Date.now()}`),
        surfaceKey,
        title: toString(source.title || source.label || 'Recovery action'),
        detail: toString(source.detail || source.note || ''),
        state,
        severity,
        source: toString(source.source || 'manual'),
        owner: toString(source.owner || source.assignee || ''),
        reason: toString(source.reason || ''),
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: updatedAt || createdAt || new Date().toISOString(),
        closedAt: toString(source.closedAt || source.closed_at || ''),
        resolvedAt: toString(source.resolvedAt || source.resolved_at || ''),
        meta:
            source.meta && typeof source.meta === 'object'
                ? { ...source.meta }
                : {},
    };
}

function normalizeActionState(value) {
    const normalized = toString(value).toLowerCase();
    switch (normalized) {
        case 'tracking':
        case 'watch':
        case 'resolved':
        case 'closed':
        case 'dismissed':
            return normalized;
        default:
            return 'open';
    }
}

function normalizeActionSeverity(value) {
    const normalized = toString(value).toLowerCase();
    switch (normalized) {
        case 'medium':
        case 'high':
            return normalized;
        default:
            return 'low';
    }
}

function isClosedAction(action) {
    const state = toString(action?.state).toLowerCase();
    return ['closed', 'resolved', 'dismissed'].includes(state);
}

function sortActions(actions) {
    return [...actions].sort((left, right) => {
        const leftTime = Date.parse(
            String(left.updatedAt || left.createdAt || '')
        );
        const rightTime = Date.parse(
            String(right.updatedAt || right.createdAt || '')
        );

        const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
        const safeRight = Number.isFinite(rightTime) ? rightTime : 0;

        return (
            safeRight - safeLeft ||
            String(right.id).localeCompare(String(left.id))
        );
    });
}

function getFallbackStoreKey(storageKey, clinicProfile) {
    return `${toString(storageKey, TURNERO_SURFACE_RECOVERY_ACTION_STORE_KEY)}:${toString(
        clinicProfile?.clinic_id || 'default-clinic'
    )}`;
}

function readEnvelope(storageKey, clinicProfile) {
    const fallbackValue = createEmptyEnvelope(clinicProfile);
    const normalized = readClinicScopedStorageValue(storageKey, clinicProfile, {
        fallbackValue: null,
        normalizeValue: (value) => normalizeEnvelope(value, clinicProfile),
    });

    if (normalized && typeof normalized === 'object') {
        return normalizeEnvelope(normalized, clinicProfile);
    }

    const memoryKey = getFallbackStoreKey(storageKey, clinicProfile);
    const fallbackEnvelope = memoryFallbackStores.get(memoryKey);
    if (fallbackEnvelope) {
        return normalizeEnvelope(fallbackEnvelope, clinicProfile);
    }

    return fallbackValue;
}

function persistEnvelope(storageKey, clinicProfile, envelope) {
    const normalized = normalizeEnvelope(envelope, clinicProfile);
    const persisted = persistClinicScopedStorageValue(
        storageKey,
        clinicProfile,
        normalized
    );

    if (!persisted) {
        const memoryKey = getFallbackStoreKey(storageKey, clinicProfile);
        memoryFallbackStores.set(memoryKey, normalized);
    } else {
        const memoryKey = getFallbackStoreKey(storageKey, clinicProfile);
        memoryFallbackStores.delete(memoryKey);
    }

    return persisted;
}

function getSurfaceRecord(envelope, surfaceKey) {
    const key = normalizeTurneroSurfaceRecoveryKey(surfaceKey);
    const record = envelope.surfaces[key];
    if (!record || typeof record !== 'object') {
        return {
            actions: [],
            updatedAt: '',
        };
    }

    return {
        actions: sortActions(
            toArray(record.actions)
                .map((action) => normalizeAction(action, key))
                .filter(Boolean)
        ),
        updatedAt: toString(record.updatedAt, ''),
    };
}

function setSurfaceRecord(envelope, surfaceKey, record) {
    const key = normalizeTurneroSurfaceRecoveryKey(surfaceKey);
    const actions = sortActions(
        toArray(record.actions)
            .map((action) => normalizeAction(action, key))
            .filter(Boolean)
    );

    if (!actions.length) {
        delete envelope.surfaces[key];
        return envelope;
    }

    envelope.surfaces[key] = {
        actions,
        updatedAt: toString(record.updatedAt || new Date().toISOString()),
    };
    return envelope;
}

function findActionEnvelopeEntry(envelope, actionId) {
    const normalizedId = toString(actionId);
    if (!normalizedId) {
        return null;
    }

    for (const [surfaceKey, record] of Object.entries(envelope.surfaces)) {
        const actions = toArray(record.actions);
        const index = actions.findIndex((action) => action.id === normalizedId);
        if (index >= 0) {
            return {
                surfaceKey,
                index,
                action: actions[index],
            };
        }
    }

    return null;
}

function resolveOpenActionCount(actions) {
    return actions.filter((action) => !isClosedAction(action)).length;
}

export function createTurneroSurfaceRecoveryActionStore(
    clinicProfile,
    options = {}
) {
    const storageKey = toString(
        options.storageKey,
        TURNERO_SURFACE_RECOVERY_ACTION_STORE_KEY
    );
    const normalizedClinicProfile =
        clinicProfile && typeof clinicProfile === 'object' ? clinicProfile : {};
    let envelope = readEnvelope(storageKey, normalizedClinicProfile);

    function refresh() {
        envelope = readEnvelope(storageKey, normalizedClinicProfile);
        return envelope;
    }

    function persist() {
        envelope.updatedAt = new Date().toISOString();
        persistEnvelope(storageKey, normalizedClinicProfile, envelope);
        return envelope;
    }

    function list({ surfaceKey, includeClosed = false } = {}) {
        const currentEnvelope = refresh();
        const keys = surfaceKey
            ? [normalizeTurneroSurfaceRecoveryKey(surfaceKey)]
            : Object.keys(currentEnvelope.surfaces);

        const actions = keys.flatMap((key) => {
            const record = getSurfaceRecord(currentEnvelope, key);
            return includeClosed
                ? record.actions
                : record.actions.filter((action) => !isClosedAction(action));
        });

        return sortActions(actions);
    }

    function getSurfaceActions(surfaceKey, options = {}) {
        return list({
            surfaceKey,
            includeClosed: Boolean(options.includeClosed),
        });
    }

    function add(action) {
        const normalized = normalizeAction(
            action,
            options.surfaceKey || 'operator'
        );
        const key = normalizeTurneroSurfaceRecoveryKey(normalized.surfaceKey);
        const record = getSurfaceRecord(envelope, key);
        record.actions = [normalized, ...record.actions];
        record.updatedAt = normalized.updatedAt || new Date().toISOString();
        setSurfaceRecord(envelope, key, record);
        persist();
        return normalized;
    }

    function update(actionId, patch = {}) {
        const entry = findActionEnvelopeEntry(envelope, actionId);
        if (!entry) {
            return null;
        }

        const nextAction = normalizeAction(
            {
                ...entry.action,
                ...asObject(patch),
                id: entry.action.id,
                surfaceKey: entry.surfaceKey,
                updatedAt:
                    patch.updatedAt ||
                    patch.updated_at ||
                    new Date().toISOString(),
            },
            entry.surfaceKey
        );

        const record = getSurfaceRecord(envelope, entry.surfaceKey);
        record.actions = record.actions.map((action) =>
            action.id === entry.action.id ? nextAction : action
        );
        record.updatedAt = nextAction.updatedAt;
        setSurfaceRecord(envelope, entry.surfaceKey, record);
        persist();
        return nextAction;
    }

    function close(actionId, patch = {}) {
        return update(actionId, {
            ...patch,
            state: 'closed',
            closedAt:
                patch.closedAt || patch.closed_at || new Date().toISOString(),
            resolvedAt:
                patch.resolvedAt ||
                patch.resolved_at ||
                new Date().toISOString(),
        });
    }

    function remove(actionId) {
        const entry = findActionEnvelopeEntry(envelope, actionId);
        if (!entry) {
            return false;
        }

        const record = getSurfaceRecord(envelope, entry.surfaceKey);
        record.actions = record.actions.filter(
            (action) => action.id !== entry.action.id
        );
        record.updatedAt = new Date().toISOString();
        setSurfaceRecord(envelope, entry.surfaceKey, record);
        persist();
        return true;
    }

    function clear(options = {}) {
        const surfaceKey = options.surfaceKey
            ? normalizeTurneroSurfaceRecoveryKey(options.surfaceKey)
            : '';

        if (surfaceKey) {
            delete envelope.surfaces[surfaceKey];
            persist();
            return true;
        }

        envelope = createEmptyEnvelope(normalizedClinicProfile);
        removeClinicScopedStorageValue(storageKey, normalizedClinicProfile);
        const memoryKey = getFallbackStoreKey(
            storageKey,
            normalizedClinicProfile
        );
        memoryFallbackStores.delete(memoryKey);
        return true;
    }

    function snapshot(options = {}) {
        const currentEnvelope = refresh();
        const surfaceKey = options.surfaceKey
            ? normalizeTurneroSurfaceRecoveryKey(options.surfaceKey)
            : '';
        const actions = surfaceKey
            ? getSurfaceActions(surfaceKey, {
                  includeClosed: Boolean(options.includeClosed),
              })
            : list({
                  includeClosed: Boolean(options.includeClosed),
              });
        const openActionCount = resolveOpenActionCount(actions);
        const closedActionCount = Math.max(actions.length - openActionCount, 0);
        const surfaceCount = surfaceKey
            ? currentEnvelope.surfaces[surfaceKey]
                ? 1
                : 0
            : Object.keys(currentEnvelope.surfaces).length;
        const available =
            typeof localStorage !== 'undefined' &&
            localStorage &&
            typeof localStorage.getItem === 'function';

        return {
            schema: currentEnvelope.schema,
            key: storageKey,
            clinicId: currentEnvelope.clinicId,
            surfaceKey: surfaceKey || 'all',
            available,
            state: available ? 'ready' : 'degraded',
            actionCount: actions.length,
            openActionCount,
            closedActionCount,
            surfaceCount,
            surfacesTracked: Object.keys(currentEnvelope.surfaces).length,
            updatedAt: currentEnvelope.updatedAt || new Date().toISOString(),
            persistedAt: currentEnvelope.updatedAt || '',
            summary:
                openActionCount > 0
                    ? `${openActionCount} accion(es) abiertas en ${surfaceKey || 'todas'}`
                    : surfaceCount > 0
                      ? `${actions.length} accion(es) registradas`
                      : 'Sin acciones recuperables',
            actions,
            values: currentEnvelope,
        };
    }

    function getEnvelope() {
        return refresh();
    }

    return {
        storageKey,
        clinicId: toString(
            normalizedClinicProfile?.clinic_id || 'default-clinic'
        ),
        list,
        getSurfaceActions,
        add,
        update,
        close,
        remove,
        clear,
        snapshot,
        getEnvelope,
        refresh,
    };
}

export {
    normalizeAction as normalizeTurneroSurfaceRecoveryAction,
    normalizeEnvelope as normalizeTurneroSurfaceRecoveryEnvelope,
};
