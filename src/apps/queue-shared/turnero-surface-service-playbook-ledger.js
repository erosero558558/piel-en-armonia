import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';

const STORAGE_KEY = 'turneroSurfaceServicePlaybookLedgerV1';
const STORE_SCHEMA = 'turnero-surface-service-playbook-ledger/v1';
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
    if (
        ['ready', 'done', 'published', 'watch', 'blocked', 'draft'].includes(
            normalized
        )
    ) {
        return normalized;
    }
    return 'ready';
}

function normalizeEnvelope(rawValue) {
    if (Array.isArray(rawValue)) {
        return {
            schema: STORE_SCHEMA,
            scopes: {
                global: rawValue,
            },
        };
    }

    const source = asObject(rawValue);
    return {
        schema: toText(source.schema, STORE_SCHEMA),
        scopes:
            source.scopes && typeof source.scopes === 'object'
                ? source.scopes
                : {},
    };
}

function getClinicKey(clinicProfile) {
    return toText(
        clinicProfile?.clinic_id ||
            clinicProfile?.clinicId ||
            clinicProfile?.id,
        'default-clinic'
    );
}

function getFallbackStoreKey(scope, clinicProfile) {
    return `${toText(scope, 'global')}:${getClinicKey(clinicProfile)}`;
}

function normalizeEntry(entry = {}, fallbackScope = 'global') {
    const source = asObject(entry);
    const createdAt =
        toText(source.createdAt || source.updatedAt) ||
        new Date().toISOString();
    const scope = toText(source.scope, fallbackScope || 'global');

    return {
        id:
            toText(source.id) ||
            `playbook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        scope,
        surfaceKey: toText(source.surfaceKey, 'surface'),
        title: toText(source.title || source.label, 'Service playbook item'),
        owner: toText(source.owner, 'ops'),
        status: normalizeStatus(source.status),
        note: toText(source.note || source.detail),
        createdAt,
        updatedAt: toText(source.updatedAt, createdAt),
        meta:
            source.meta && typeof source.meta === 'object'
                ? { ...source.meta }
                : {},
    };
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

    const memoryKey = getFallbackStoreKey('global', clinicProfile);
    const fallbackEnvelope = MEMORY_FALLBACK_STORES.get(memoryKey);
    if (fallbackEnvelope) {
        return normalizeEnvelope(fallbackEnvelope);
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
    const memoryKey = getFallbackStoreKey('global', clinicProfile);

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

export function createTurneroSurfaceServicePlaybookLedger(
    scope = 'global',
    clinicProfile = null
) {
    const normalizedScope = toText(scope, 'global');

    return {
        list({ surfaceKey = '', status = '', owner = '' } = {}) {
            const normalizedSurfaceKey = toText(surfaceKey);
            const normalizedStatus = toText(status).toLowerCase();
            const normalizedOwner = toText(owner).toLowerCase();

            return readEntries(normalizedScope, clinicProfile).filter(
                (entry) =>
                    (!normalizedSurfaceKey ||
                        entry.surfaceKey === normalizedSurfaceKey) &&
                    (!normalizedStatus || entry.status === normalizedStatus) &&
                    (!normalizedOwner ||
                        entry.owner.toLowerCase() === normalizedOwner)
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
        update(entryId, patch = {}) {
            const targetId = toText(entryId);
            if (!targetId) {
                return null;
            }

            let updatedEntry = null;
            const entries = readEntries(normalizedScope, clinicProfile).map(
                (entry) => {
                    if (entry.id !== targetId) {
                        return entry;
                    }

                    updatedEntry = normalizeEntry({
                        ...entry,
                        ...patch,
                        id: entry.id,
                        scope: normalizedScope,
                        updatedAt: new Date().toISOString(),
                    });
                    return updatedEntry;
                }
            );

            if (!updatedEntry) {
                return null;
            }

            writeEntries(normalizedScope, clinicProfile, entries);
            return updatedEntry;
        },
        remove(entryId) {
            const targetId = toText(entryId);
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
