import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';
import {
    normalizeTurneroSurfaceAcceptanceKey,
    normalizeTurneroSurfaceAcceptanceSignoffEntries,
    normalizeTurneroSurfaceAcceptanceSignoffEntry,
} from './turnero-surface-acceptance-snapshot.js';
import { asObject, toArray, toString } from './turnero-surface-helpers.js';

export const TURNERO_SURFACE_STAKEHOLDER_SIGNOFF_STORE_KEY =
    'turneroSurfaceStakeholderSignoffsV1';

const STORAGE_SCHEMA = 'turnero-surface-stakeholder-signoffs/v1';
const memoryFallbackStores = new Map();

function getClinicKey(clinicProfile) {
    return (
        toString(clinicProfile?.clinic_id || clinicProfile?.clinicId) ||
        'default-clinic'
    );
}

function getFallbackStoreKey(storageKey, clinicProfile) {
    return `${toString(
        storageKey,
        TURNERO_SURFACE_STAKEHOLDER_SIGNOFF_STORE_KEY
    )}:${getClinicKey(clinicProfile)}`;
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

function createEmptyEnvelope(clinicProfile) {
    return {
        schema: STORAGE_SCHEMA,
        clinicId: getClinicKey(clinicProfile),
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
            normalizeTurneroSurfaceAcceptanceKey(surfaceKey);
        const surfaceRecord = asObject(record);
        const entries = normalizeTurneroSurfaceAcceptanceSignoffEntries(
            surfaceRecord.entries ||
                surfaceRecord.signoffs ||
                surfaceRecord.items,
            normalizedSurfaceKey
        );
        if (!entries.length) {
            return;
        }

        envelope.surfaces[normalizedSurfaceKey] = {
            entries,
            updatedAt: toString(surfaceRecord.updatedAt, ''),
        };
    });

    envelope.schema = toString(source.schema, STORAGE_SCHEMA);
    envelope.updatedAt = toString(source.updatedAt, '');
    envelope.clinicId = toString(
        source.clinicId || clinicProfile?.clinic_id || envelope.clinicId
    );

    return envelope;
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

    const fallbackKey = getFallbackStoreKey(storageKey, clinicProfile);
    const fallbackEnvelope = memoryFallbackStores.get(fallbackKey);
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

    const fallbackKey = getFallbackStoreKey(storageKey, clinicProfile);
    if (persisted) {
        memoryFallbackStores.delete(fallbackKey);
        return true;
    }

    memoryFallbackStores.set(fallbackKey, normalized);
    return false;
}

function getSurfaceRecord(envelope, surfaceKey) {
    const key = normalizeTurneroSurfaceAcceptanceKey(surfaceKey);
    const record = envelope.surfaces[key];
    if (!record || typeof record !== 'object') {
        return {
            entries: [],
            updatedAt: '',
        };
    }

    return {
        entries: sortEntries(
            toArray(record.entries)
                .map((entry) =>
                    normalizeTurneroSurfaceAcceptanceSignoffEntry(entry, key)
                )
                .filter((entry) => Boolean(entry.id))
        ),
        updatedAt: toString(record.updatedAt, ''),
    };
}

function setSurfaceRecord(envelope, surfaceKey, record) {
    const key = normalizeTurneroSurfaceAcceptanceKey(surfaceKey);
    const entries = sortEntries(
        toArray(record.entries)
            .map((entry) =>
                normalizeTurneroSurfaceAcceptanceSignoffEntry(entry, key)
            )
            .filter((entry) => Boolean(entry.id))
    );

    if (!entries.length) {
        delete envelope.surfaces[key];
        return envelope;
    }

    envelope.surfaces[key] = {
        entries,
        updatedAt: toString(record.updatedAt || new Date().toISOString()),
    };
    return envelope;
}

function findEntry(envelope, signoffId) {
    const normalizedId = toString(signoffId);
    if (!normalizedId) {
        return null;
    }

    for (const [surfaceKey, record] of Object.entries(envelope.surfaces)) {
        const entries = sortEntries(
            toArray(record.entries).filter((entry) => Boolean(entry.id))
        );
        const index = entries.findIndex((entry) => entry.id === normalizedId);
        if (index >= 0) {
            return {
                surfaceKey,
                index,
                entry: entries[index],
            };
        }
    }

    return null;
}

function summarize(entries = []) {
    const list = toArray(entries);
    const total = list.length;
    const approve = list.filter((entry) => entry.verdict === 'approve').length;
    const review = list.filter((entry) => entry.verdict === 'review').length;
    const reject = list.filter((entry) => entry.verdict === 'reject').length;
    const state = reject > 0 ? 'blocked' : approve > 0 ? 'ready' : 'watch';

    return {
        total,
        approve,
        review,
        reject,
        state,
    };
}

function cloneRows(rows) {
    return rows.map((row) => ({
        ...row,
        meta: row.meta && typeof row.meta === 'object' ? { ...row.meta } : {},
    }));
}

export function createTurneroSurfaceStakeholderSignoffStore(
    clinicProfile,
    options = {}
) {
    const storageKey = toString(
        options.storageKey,
        TURNERO_SURFACE_STAKEHOLDER_SIGNOFF_STORE_KEY
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

    function list({ surfaceKey, verdict } = {}) {
        const currentEnvelope = refresh();
        const rows = surfaceKey
            ? cloneRows(getSurfaceRecord(currentEnvelope, surfaceKey).entries)
            : sortEntries(
                  Object.values(currentEnvelope.surfaces).flatMap((record) =>
                      toArray(record.entries)
                  )
              ).map((entry) => ({
                  ...entry,
                  meta:
                      entry.meta && typeof entry.meta === 'object'
                          ? { ...entry.meta }
                          : {},
              }));

        if (verdict) {
            const normalizedVerdict = toString(verdict).toLowerCase();
            return rows.filter((entry) => entry.verdict === normalizedVerdict);
        }

        return rows;
    }

    function snapshot({ surfaceKey } = {}) {
        const entries = list({ surfaceKey });
        const summary = summarize(entries);
        return {
            schema: STORAGE_SCHEMA,
            clinicId: getClinicKey(normalizedClinicProfile),
            surfaceKey: surfaceKey
                ? normalizeTurneroSurfaceAcceptanceKey(surfaceKey)
                : '',
            entries: cloneRows(entries),
            summary,
            updatedAt: envelope.updatedAt || new Date().toISOString(),
            generatedAt: new Date().toISOString(),
        };
    }

    function add(entry = {}) {
        const normalized = normalizeTurneroSurfaceAcceptanceSignoffEntry(
            {
                ...entry,
                source: entry.source || 'manual',
            },
            entry.surfaceKey || options.surfaceKey || 'operator'
        );
        const key = normalizeTurneroSurfaceAcceptanceKey(normalized.surfaceKey);
        const record = getSurfaceRecord(envelope, key);
        record.entries = [normalized, ...record.entries];
        record.updatedAt = normalized.updatedAt || new Date().toISOString();
        setSurfaceRecord(envelope, key, record);
        persist();
        return normalized;
    }

    function remove(signoffId) {
        const entry = findEntry(envelope, signoffId);
        if (!entry) {
            return false;
        }

        const record = getSurfaceRecord(envelope, entry.surfaceKey);
        record.entries = record.entries.filter(
            (_candidate, index) => index !== entry.index
        );
        record.updatedAt = new Date().toISOString();
        setSurfaceRecord(envelope, entry.surfaceKey, record);
        persist();
        return true;
    }

    function clear({ surfaceKey } = {}) {
        if (!surfaceKey) {
            envelope = createEmptyEnvelope(normalizedClinicProfile);
            const cleared = removeClinicScopedStorageValue(
                storageKey,
                normalizedClinicProfile
            );
            if (cleared) {
                memoryFallbackStores.delete(
                    getFallbackStoreKey(storageKey, normalizedClinicProfile)
                );
            }
            return cleared;
        }

        const key = normalizeTurneroSurfaceAcceptanceKey(surfaceKey);
        delete envelope.surfaces[key];
        if (Object.keys(envelope.surfaces).length === 0) {
            const cleared = removeClinicScopedStorageValue(
                storageKey,
                normalizedClinicProfile
            );
            if (cleared) {
                memoryFallbackStores.delete(
                    getFallbackStoreKey(storageKey, normalizedClinicProfile)
                );
            }
            return cleared;
        }

        persist();
        return true;
    }

    return {
        list,
        snapshot,
        add,
        remove,
        clear,
        summary({ surfaceKey } = {}) {
            return summarize(list({ surfaceKey }));
        },
        refresh,
    };
}

export default createTurneroSurfaceStakeholderSignoffStore;
