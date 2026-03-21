import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';

const STORAGE_KEY = 'turneroSurfaceGoLiveLedgerV1';
const STORE_SCHEMA = 'turnero-surface-go-live-ledger/v1';
const MEMORY_FALLBACK_STORES = new Map();

function toText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function normalizeStatus(value) {
    const normalized = toText(value, 'ready').toLowerCase();
    if (['ready', 'pass', 'ok', 'success', 'done'].includes(normalized)) {
        return 'ready';
    }
    if (['watch', 'warning', 'review'].includes(normalized)) {
        return 'watch';
    }
    if (['degraded', 'hold'].includes(normalized)) {
        return 'degraded';
    }
    if (['blocked', 'alert', 'error', 'critical'].includes(normalized)) {
        return 'blocked';
    }
    return 'ready';
}

function normalizeEnvelope(rawEnvelope) {
    if (Array.isArray(rawEnvelope)) {
        return {
            schema: STORE_SCHEMA,
            scopes: {
                global: rawEnvelope,
            },
        };
    }

    const source = asObject(rawEnvelope);
    return {
        schema: toText(source.schema, STORE_SCHEMA),
        scopes:
            source.scopes && typeof source.scopes === 'object'
                ? source.scopes
                : {},
    };
}

function normalizeEntry(entry = {}, fallbackScope = 'global') {
    const source = asObject(entry);
    const createdAt =
        toText(source.createdAt || source.updatedAt) ||
        new Date().toISOString();
    const scope = toText(source.scope, fallbackScope || 'global');
    const surfaceKey = toText(source.surfaceKey, 'surface');

    return {
        id:
            toText(source.id) ||
            `go-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        scope,
        surfaceKey,
        kind: toText(source.kind, 'go-live-evidence'),
        status: normalizeStatus(source.status),
        owner: toText(source.owner, 'ops'),
        note: toText(source.note || source.detail),
        createdAt,
        updatedAt: toText(source.updatedAt, createdAt),
        meta:
            source.meta && typeof source.meta === 'object'
                ? { ...source.meta }
                : {},
    };
}

function getFallbackStoreKey(clinicProfile) {
    return toText(
        clinicProfile?.clinic_id || clinicProfile?.clinicId,
        'default-clinic'
    );
}

function readEnvelope(clinicProfile) {
    const normalized = readClinicScopedStorageValue(
        STORAGE_KEY,
        clinicProfile,
        {
            fallbackValue: null,
            normalizeValue: normalizeEnvelope,
        }
    );

    if (normalized && typeof normalized === 'object') {
        return normalizeEnvelope(normalized);
    }

    const memoryKey = getFallbackStoreKey(clinicProfile);
    const memoryEnvelope = MEMORY_FALLBACK_STORES.get(memoryKey);
    if (memoryEnvelope) {
        return normalizeEnvelope(memoryEnvelope);
    }

    return {
        schema: STORE_SCHEMA,
        scopes: {},
    };
}

function persistEnvelope(clinicProfile, envelope) {
    const normalized = normalizeEnvelope(envelope);
    const persisted = persistClinicScopedStorageValue(
        STORAGE_KEY,
        clinicProfile,
        normalized
    );
    const memoryKey = getFallbackStoreKey(clinicProfile);

    if (!persisted) {
        MEMORY_FALLBACK_STORES.set(memoryKey, normalized);
    } else {
        MEMORY_FALLBACK_STORES.delete(memoryKey);
    }

    return persisted;
}

function readEntries(scope, clinicProfile) {
    const normalizedScope = toText(scope, 'global');
    const envelope = readEnvelope(clinicProfile);
    const rawEntries = Array.isArray(envelope?.scopes?.[normalizedScope])
        ? envelope.scopes[normalizedScope]
        : [];

    return rawEntries
        .map((entry) => normalizeEntry(entry, normalizedScope))
        .sort((left, right) =>
            String(right.updatedAt || right.createdAt || '').localeCompare(
                String(left.updatedAt || left.createdAt || '')
            )
        );
}

function writeEntries(scope, clinicProfile, entries) {
    const normalizedScope = toText(scope, 'global');
    const envelope = readEnvelope(clinicProfile);
    const scopes =
        envelope.scopes && typeof envelope.scopes === 'object'
            ? envelope.scopes
            : {};

    if (!Array.isArray(entries) || entries.length === 0) {
        if (Object.prototype.hasOwnProperty.call(scopes, normalizedScope)) {
            delete scopes[normalizedScope];
            if (Object.keys(scopes).length === 0) {
                return removeClinicScopedStorageValue(
                    STORAGE_KEY,
                    clinicProfile
                );
            }
            return persistClinicScopedStorageValue(STORAGE_KEY, clinicProfile, {
                schema: envelope.schema || STORE_SCHEMA,
                scopes,
            });
        }
        return true;
    }

    return persistEnvelope(clinicProfile, {
        schema: envelope.schema || STORE_SCHEMA,
        scopes: {
            ...scopes,
            [normalizedScope]: entries
                .map((entry) => normalizeEntry(entry, normalizedScope))
                .slice(0, 300),
        },
    });
}

export function createTurneroSurfaceGoLiveLedger(
    scope = 'global',
    clinicProfile = null
) {
    const normalizedScope = toText(scope, 'global');

    return {
        list({ surfaceKey = '', status = '' } = {}) {
            const normalizedSurfaceKey = toText(surfaceKey);
            const normalizedStatus = toText(status);

            return readEntries(normalizedScope, clinicProfile).filter(
                (entry) =>
                    (!normalizedSurfaceKey ||
                        entry.surfaceKey === normalizedSurfaceKey) &&
                    (!normalizedStatus || entry.status === normalizedStatus)
            );
        },
        add(entry = {}) {
            const nextEntry = normalizeEntry(
                {
                    ...entry,
                    scope: normalizedScope,
                    status: entry.status || 'ready',
                    owner: entry.owner || 'ops',
                },
                normalizedScope
            );
            const entries = readEntries(normalizedScope, clinicProfile);
            writeEntries(normalizedScope, clinicProfile, [
                nextEntry,
                ...entries,
            ]);
            return nextEntry;
        },
        clear({ surfaceKey = '' } = {}) {
            const normalizedSurfaceKey = toText(surfaceKey);
            if (!normalizedSurfaceKey) {
                return writeEntries(normalizedScope, clinicProfile, []);
            }

            const remaining = readEntries(
                normalizedScope,
                clinicProfile
            ).filter((entry) => entry.surfaceKey !== normalizedSurfaceKey);
            return writeEntries(normalizedScope, clinicProfile, remaining);
        },
        snapshot() {
            return readEnvelope(clinicProfile);
        },
    };
}
