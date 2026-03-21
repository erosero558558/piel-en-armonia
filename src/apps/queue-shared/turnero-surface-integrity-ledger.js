import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';

const TURNERO_SURFACE_INTEGRITY_LEDGER_STORAGE_KEY =
    'turneroSurfaceIntegrityLedgerV1';
const STORE_SCHEMA = 'turnero-surface-integrity-ledger/v1';

const memoryFallbackStores = new Map();

function normalizeText(value) {
    return String(value ?? '').trim();
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function normalizeEntryStatus(value) {
    const normalized = normalizeText(value).toLowerCase();
    switch (normalized) {
        case 'review':
        case 'watch':
        case 'blocked':
        case 'pass':
            return normalized;
        default:
            return 'pass';
    }
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
        schema: normalizeText(source.schema) || STORE_SCHEMA,
        scopes:
            source.scopes && typeof source.scopes === 'object'
                ? source.scopes
                : {},
    };
}

function normalizeEntry(entry = {}, fallbackScope = 'global') {
    const source = asObject(entry);
    const surfaceKey = normalizeText(source.surfaceKey) || 'surface';
    const createdAt =
        normalizeText(source.createdAt || source.updatedAt) ||
        new Date().toISOString();

    return {
        id:
            normalizeText(source.id) ||
            `integrity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        scope: normalizeText(source.scope) || fallbackScope || 'global',
        surfaceKey,
        kind: normalizeText(source.kind) || 'queue-integrity',
        status: normalizeEntryStatus(source.status),
        owner: normalizeText(source.owner) || 'ops',
        note: normalizeText(source.note || source.detail),
        createdAt,
        updatedAt: normalizeText(source.updatedAt) || createdAt,
        meta:
            source.meta && typeof source.meta === 'object'
                ? { ...source.meta }
                : {},
    };
}

function getFallbackStoreKey(scope, clinicProfile) {
    return `${normalizeText(scope) || 'global'}:${
        normalizeText(clinicProfile?.clinic_id) || 'default-clinic'
    }`;
}

function readEnvelope(scope, clinicProfile) {
    const normalizedScope = normalizeText(scope) || 'global';
    const fallbackValue = normalizeEnvelope();
    const normalized = readClinicScopedStorageValue(
        TURNERO_SURFACE_INTEGRITY_LEDGER_STORAGE_KEY,
        clinicProfile,
        {
            fallbackValue: null,
            normalizeValue: normalizeEnvelope,
        }
    );

    if (normalized && typeof normalized === 'object') {
        return normalizeEnvelope(normalized);
    }

    const memoryKey = getFallbackStoreKey(normalizedScope, clinicProfile);
    const memoryEnvelope = memoryFallbackStores.get(memoryKey);
    if (memoryEnvelope) {
        return normalizeEnvelope(memoryEnvelope);
    }

    return fallbackValue;
}

function persistEnvelope(scope, clinicProfile, envelope) {
    const normalizedScope = normalizeText(scope) || 'global';
    const normalized = normalizeEnvelope(envelope);
    const persisted = persistClinicScopedStorageValue(
        TURNERO_SURFACE_INTEGRITY_LEDGER_STORAGE_KEY,
        clinicProfile,
        normalized
    );
    const memoryKey = getFallbackStoreKey(normalizedScope, clinicProfile);

    if (!persisted) {
        memoryFallbackStores.set(memoryKey, normalized);
    } else {
        memoryFallbackStores.delete(memoryKey);
    }

    return persisted;
}

function readEntries(scope, clinicProfile) {
    const normalizedScope = normalizeText(scope) || 'global';
    const envelope = readEnvelope(normalizedScope, clinicProfile);
    const rawEntries = Array.isArray(envelope?.scopes?.[normalizedScope])
        ? envelope.scopes[normalizedScope]
        : [];

    return rawEntries
        .map((entry) => normalizeEntry({ ...entry, scope: normalizedScope }))
        .sort((left, right) =>
            String(right.updatedAt || right.createdAt || '').localeCompare(
                String(left.updatedAt || left.createdAt || '')
            )
        );
}

function writeEntries(scope, clinicProfile, entries) {
    const normalizedScope = normalizeText(scope) || 'global';
    if (!Array.isArray(entries) || entries.length === 0) {
        const envelope = readEnvelope(normalizedScope, clinicProfile);
        if (
            envelope?.scopes &&
            Object.prototype.hasOwnProperty.call(
                envelope.scopes,
                normalizedScope
            )
        ) {
            delete envelope.scopes[normalizedScope];
            if (Object.keys(envelope.scopes).length === 0) {
                return removeClinicScopedStorageValue(
                    TURNERO_SURFACE_INTEGRITY_LEDGER_STORAGE_KEY,
                    clinicProfile
                );
            }
            return persistClinicScopedStorageValue(
                TURNERO_SURFACE_INTEGRITY_LEDGER_STORAGE_KEY,
                clinicProfile,
                envelope
            );
        }
        return true;
    }

    const envelope = readEnvelope(normalizedScope, clinicProfile);
    const nextEnvelope = {
        schema: envelope.schema || STORE_SCHEMA,
        scopes: {
            ...(envelope.scopes && typeof envelope.scopes === 'object'
                ? envelope.scopes
                : {}),
            [normalizedScope]: entries
                .map((entry) =>
                    normalizeEntry({ ...entry, scope: normalizedScope })
                )
                .slice(0, 300),
        },
    };
    return persistEnvelope(normalizedScope, clinicProfile, nextEnvelope);
}

export function createTurneroSurfaceIntegrityLedger(
    scope = 'global',
    clinicProfile = null
) {
    const normalizedScope = normalizeText(scope) || 'global';

    return {
        list({ surfaceKey = '' } = {}) {
            const normalizedSurfaceKey = normalizeText(surfaceKey);
            return readEntries(normalizedScope, clinicProfile).filter(
                (entry) =>
                    !normalizedSurfaceKey ||
                    entry.surfaceKey === normalizedSurfaceKey
            );
        },
        add(entry = {}) {
            const nextEntry = normalizeEntry({
                ...entry,
                scope: normalizedScope,
                status: entry.status || 'pass',
                owner: entry.owner || 'ops',
            });
            const entries = readEntries(normalizedScope, clinicProfile);
            writeEntries(normalizedScope, clinicProfile, [
                nextEntry,
                ...entries,
            ]);
            return nextEntry;
        },
        remove(entryId) {
            const targetId = normalizeText(entryId);
            if (!targetId) {
                return false;
            }
            const remaining = readEntries(
                normalizedScope,
                clinicProfile
            ).filter((entry) => entry.id !== targetId);
            return writeEntries(normalizedScope, clinicProfile, remaining);
        },
        clear({ surfaceKey = '' } = {}) {
            const normalizedSurfaceKey = normalizeText(surfaceKey);
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
            return readEnvelope(normalizedScope, clinicProfile);
        },
    };
}
