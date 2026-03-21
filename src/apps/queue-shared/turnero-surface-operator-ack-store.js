import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';
import { normalizeTurneroSurfaceRecoveryKey } from './turnero-surface-contract-snapshot.js';

const STORAGE_KEY = 'turneroSurfaceOperatorAckStoreV1';
const STORAGE_SCHEMA = 'turnero-surface-operator-ack-store/v1';
const memoryFallbackStores = new Map();

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function getClinicKey(clinicProfile) {
    return (
        toString(clinicProfile?.clinic_id || clinicProfile?.clinicId) ||
        'default-clinic'
    );
}

function getFallbackStoreKey(storageKey, clinicProfile) {
    return `${toString(storageKey, STORAGE_KEY)}:${getClinicKey(clinicProfile)}`;
}

function normalizeEnvelope(rawValue) {
    if (Array.isArray(rawValue)) {
        return {
            schema: STORAGE_SCHEMA,
            scopes: {
                regional: rawValue,
            },
        };
    }

    const source = asObject(rawValue);
    const scopes =
        source.scopes && typeof source.scopes === 'object' ? source.scopes : {};

    return {
        schema: toString(source.schema, STORAGE_SCHEMA),
        scopes,
    };
}

function normalizeEntry(entry = {}, fallbackSurfaceKey = 'operator') {
    const source = asObject(entry);
    const surfaceKey = normalizeTurneroSurfaceRecoveryKey(
        source.surfaceKey || source.surface || fallbackSurfaceKey
    );
    const createdAt = toString(
        source.createdAt || source.created_at || source.updatedAt || source.at,
        new Date().toISOString()
    );
    const updatedAt = toString(
        source.updatedAt || source.updated_at,
        createdAt
    );

    return {
        id:
            toString(source.id) ||
            `${surfaceKey}-ack-${createdAt}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
        scope: toString(source.scope, 'regional'),
        surfaceKey,
        kind: 'ack',
        title: toString(
            source.title || source.label,
            'Operator acknowledgement'
        ),
        note: toString(source.note || source.detail || ''),
        owner: toString(source.owner || source.actor || 'ops'),
        state: toString(source.state, 'recorded') || 'recorded',
        source: toString(source.source || 'manual'),
        createdAt,
        updatedAt,
        at: toString(source.at, createdAt),
        meta:
            source.meta && typeof source.meta === 'object'
                ? { ...source.meta }
                : {},
    };
}

function sortEntries(entries) {
    return [...entries].sort((left, right) => {
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

function readEnvelope(storageKey, clinicProfile) {
    const fallbackValue = {
        schema: STORAGE_SCHEMA,
        scopes: {},
    };

    const normalized = readClinicScopedStorageValue(storageKey, clinicProfile, {
        fallbackValue: null,
        normalizeValue: (value) => normalizeEnvelope(value),
    });

    if (normalized && typeof normalized === 'object') {
        return normalizeEnvelope(normalized);
    }

    const fallbackKey = getFallbackStoreKey(storageKey, clinicProfile);
    const fallbackEnvelope = memoryFallbackStores.get(fallbackKey);
    if (fallbackEnvelope) {
        return normalizeEnvelope(fallbackEnvelope);
    }

    return fallbackValue;
}

function persistEnvelope(storageKey, clinicProfile, envelope) {
    const normalized = normalizeEnvelope(envelope);
    const persisted = persistClinicScopedStorageValue(
        storageKey,
        clinicProfile,
        normalized
    );

    const fallbackKey = getFallbackStoreKey(storageKey, clinicProfile);
    if (persisted) {
        memoryFallbackStores.delete(fallbackKey);
        return true;
    }

    memoryFallbackStores.set(fallbackKey, normalized);
    return false;
}

function readScopeEntries(storageKey, clinicProfile, scope) {
    const envelope = readEnvelope(storageKey, clinicProfile);
    const rawEntries = asArray(envelope.scopes?.[scope]);
    return sortEntries(rawEntries.map((entry) => normalizeEntry(entry)));
}

function writeScopeEntries(storageKey, clinicProfile, scope, entries) {
    const normalizedEntries = sortEntries(
        asArray(entries)
            .map((entry) => normalizeEntry(entry))
            .filter((entry) => Boolean(entry.id))
    );

    const envelope = readEnvelope(storageKey, clinicProfile);
    const nextEnvelope = {
        schema: STORAGE_SCHEMA,
        scopes: {
            ...(envelope.scopes && typeof envelope.scopes === 'object'
                ? envelope.scopes
                : {}),
        },
    };

    if (!normalizedEntries.length) {
        delete nextEnvelope.scopes[scope];
        if (Object.keys(nextEnvelope.scopes).length === 0) {
            const cleared = removeClinicScopedStorageValue(
                storageKey,
                clinicProfile
            );
            if (cleared) {
                memoryFallbackStores.delete(
                    getFallbackStoreKey(storageKey, clinicProfile)
                );
            }
            return cleared;
        }

        return persistEnvelope(storageKey, clinicProfile, nextEnvelope);
    }

    nextEnvelope.scopes[scope] = normalizedEntries;
    return persistEnvelope(storageKey, clinicProfile, nextEnvelope);
}

export function createTurneroSurfaceOperatorAckStore(
    scope = 'regional',
    clinicProfile = null
) {
    const normalizedScope = toString(scope, 'regional') || 'regional';

    return {
        list({ surfaceKey = '' } = {}) {
            const normalizedSurfaceKey = toString(surfaceKey);
            return readScopeEntries(STORAGE_KEY, clinicProfile, normalizedScope)
                .filter((entry) => {
                    if (
                        normalizedSurfaceKey &&
                        entry.surfaceKey !==
                            normalizeTurneroSurfaceRecoveryKey(
                                normalizedSurfaceKey
                            )
                    ) {
                        return false;
                    }
                    return true;
                })
                .map((entry) => ({ ...entry }));
        },
        add(entry = {}) {
            const nextEntry = normalizeEntry({
                ...entry,
                scope: normalizedScope,
                kind: 'ack',
                title: entry.title || 'Operator acknowledgement',
                state: entry.state || 'recorded',
            });
            const current = readScopeEntries(
                STORAGE_KEY,
                clinicProfile,
                normalizedScope
            );
            writeScopeEntries(
                STORAGE_KEY,
                clinicProfile,
                normalizedScope,
                [nextEntry, ...current].slice(0, 200)
            );
            return nextEntry;
        },
        addAck(entry = {}) {
            return this.add(entry);
        },
        clear({ surfaceKey = '' } = {}) {
            const normalizedSurfaceKey = toString(surfaceKey);
            if (!normalizedSurfaceKey) {
                return writeScopeEntries(
                    STORAGE_KEY,
                    clinicProfile,
                    normalizedScope,
                    []
                );
            }

            const remaining = readScopeEntries(
                STORAGE_KEY,
                clinicProfile,
                normalizedScope
            ).filter(
                (entry) =>
                    entry.surfaceKey !==
                    normalizeTurneroSurfaceRecoveryKey(normalizedSurfaceKey)
            );
            return writeScopeEntries(
                STORAGE_KEY,
                clinicProfile,
                normalizedScope,
                remaining
            );
        },
        summary({ surfaceKey = '' } = {}) {
            const list = this.list({ surfaceKey });
            return {
                total: list.length,
                acknowledgements: list.length,
            };
        },
        snapshot() {
            return readEnvelope(STORAGE_KEY, clinicProfile);
        },
    };
}

export { STORAGE_KEY as TURNERO_SURFACE_OPERATOR_ACK_STORE_STORAGE_KEY };
