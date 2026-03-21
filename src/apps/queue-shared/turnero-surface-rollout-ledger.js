import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
} from './clinic-storage.js';
import { asObject, toArray, toString } from './turnero-surface-helpers.js';

export const TURNERO_SURFACE_ROLLOUT_LEDGER_KEY =
    'turneroSurfaceRolloutLedgerV1';

const STORE_SCHEMA = 'turnero-surface-rollout-ledger/v1';
const memoryFallbackStores = new Map();

function normalizeSurfaceToken(value) {
    const token = toString(value).toLowerCase();
    if (
        token === 'operator' ||
        token === 'operator-turnos' ||
        token === 'operador-turnos'
    ) {
        return 'operator-turnos';
    }
    if (
        token === 'kiosk' ||
        token === 'kiosco-turnos' ||
        token === 'kiosk-turnos' ||
        token === 'kiosko-turnos'
    ) {
        return 'kiosco-turnos';
    }
    if (
        token === 'display' ||
        token === 'sala-turnos' ||
        token === 'sala_tv' ||
        token === 'sala-tv'
    ) {
        return 'sala-turnos';
    }
    return token || 'operator-turnos';
}

function normalizeSurfaceId(surfaceToken) {
    switch (normalizeSurfaceToken(surfaceToken)) {
        case 'kiosco-turnos':
            return 'kiosk';
        case 'sala-turnos':
            return 'display';
        default:
            return 'operator';
    }
}

function normalizeLedgerState(value) {
    const normalized = toString(value).toLowerCase();
    switch (normalized) {
        case 'closed':
        case 'resolved':
        case 'done':
        case 'installed':
        case 'complete':
        case 'completed':
            return 'closed';
        case 'blocked':
        case 'hold':
        case 'failed':
        case 'failure':
            return 'blocked';
        case 'planned':
        case 'scheduled':
        case 'pending':
            return 'planned';
        default:
            return 'open';
    }
}

function normalizeEntry(entry, fallbackSurfaceKey, clinicProfile) {
    const source = asObject(entry);
    const surfaceKey = normalizeSurfaceToken(
        source.surfaceKey || source.surface || fallbackSurfaceKey
    );
    const surfaceId = normalizeSurfaceId(surfaceKey);
    const createdAt = toString(
        source.createdAt || source.created_at || source.updatedAt
    );
    const updatedAt = toString(
        source.updatedAt || source.updated_at || createdAt
    );
    const state = normalizeLedgerState(source.state || source.status || 'open');

    return {
        id: toString(source.id || `${surfaceKey}-${createdAt || Date.now()}`),
        surfaceKey,
        surfaceId,
        clinicId: toString(
            source.clinicId || clinicProfile?.clinic_id || 'default-clinic'
        ),
        clinicName: toString(
            source.clinicName ||
                clinicProfile?.branding?.name ||
                clinicProfile?.branding?.short_name ||
                ''
        ),
        visitDate: toString(source.visitDate || source.visit_at || ''),
        owner: toString(source.owner || source.responsible || source.assignee),
        assetTag: toString(source.assetTag || source.asset || ''),
        stationLabel: toString(source.stationLabel || source.station || ''),
        installMode: toString(source.installMode || source.mode || ''),
        title: toString(source.title || source.label || 'Rollout entry'),
        detail: toString(source.detail || source.note || ''),
        state,
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

function createEmptyStore(clinicProfile) {
    return {
        schema: STORE_SCHEMA,
        clinicId: toString(clinicProfile?.clinic_id || 'default-clinic'),
        updatedAt: '',
        entries: [],
    };
}

function normalizeEnvelope(rawEnvelope, clinicProfile, storageKey) {
    const source = asObject(rawEnvelope);
    const entries = toArray(source.entries)
        .map((entry) => normalizeEntry(entry, source.surfaceKey, clinicProfile))
        .filter((entry) => Boolean(entry.id));

    return {
        schema: toString(source.schema, STORE_SCHEMA),
        clinicId: toString(
            source.clinicId || clinicProfile?.clinic_id || 'default-clinic'
        ),
        updatedAt: toString(source.updatedAt || ''),
        entries: sortEntries(entries),
        storageKey: toString(storageKey, TURNERO_SURFACE_ROLLOUT_LEDGER_KEY),
    };
}

function readEnvelope(storageKey, clinicProfile) {
    const fallbackValue = createEmptyStore(clinicProfile);
    const normalized = readClinicScopedStorageValue(storageKey, clinicProfile, {
        fallbackValue: null,
        normalizeValue: (value) =>
            normalizeEnvelope(value, clinicProfile, storageKey),
    });

    if (normalized && typeof normalized === 'object') {
        return normalizeEnvelope(normalized, clinicProfile, storageKey);
    }

    const memoryKey = `${storageKey}:${toString(
        clinicProfile?.clinic_id || 'default-clinic'
    )}`;
    const fallbackEnvelope = memoryFallbackStores.get(memoryKey);
    if (fallbackEnvelope) {
        return normalizeEnvelope(fallbackEnvelope, clinicProfile, storageKey);
    }

    return fallbackValue;
}

function persistEnvelope(storageKey, clinicProfile, envelope) {
    const normalized = normalizeEnvelope(envelope, clinicProfile, storageKey);
    const persisted = persistClinicScopedStorageValue(
        storageKey,
        clinicProfile,
        normalized
    );
    const memoryKey = `${storageKey}:${toString(
        clinicProfile?.clinic_id || 'default-clinic'
    )}`;

    if (!persisted) {
        memoryFallbackStores.set(memoryKey, normalized);
    } else {
        memoryFallbackStores.delete(memoryKey);
    }

    return persisted;
}

function getEntryStateCounts(entries) {
    return entries.reduce(
        (accumulator, entry) => {
            accumulator.total += 1;
            accumulator[entry.state] =
                Number(accumulator[entry.state] || 0) + 1;
            if (entry.state !== 'closed') {
                accumulator.open += 1;
            }
            return accumulator;
        },
        {
            total: 0,
            open: 0,
            closed: 0,
            planned: 0,
            blocked: 0,
        }
    );
}

export function createTurneroSurfaceRolloutLedger(clinicProfile, options = {}) {
    const storageKey = toString(
        options.storageKey,
        TURNERO_SURFACE_ROLLOUT_LEDGER_KEY
    );
    let envelope = readEnvelope(storageKey, clinicProfile);

    if (Array.isArray(options.seed) && options.seed.length > 0) {
        const seedEntries = options.seed
            .map((entry) =>
                normalizeEntry(entry, options.surfaceKey, clinicProfile)
            )
            .filter((entry) => Boolean(entry.id));
        if (seedEntries.length > 0 && envelope.entries.length === 0) {
            envelope = {
                ...envelope,
                entries: sortEntries(seedEntries),
                updatedAt: new Date().toISOString(),
            };
            persistEnvelope(storageKey, clinicProfile, envelope);
        }
    }

    function write(nextEnvelope) {
        envelope = normalizeEnvelope(nextEnvelope, clinicProfile, storageKey);
        persistEnvelope(storageKey, clinicProfile, envelope);
        return envelope;
    }

    function list({ surfaceKey, includeClosed = false } = {}) {
        const normalizedSurfaceKey = surfaceKey
            ? normalizeSurfaceToken(surfaceKey)
            : '';
        return sortEntries(envelope.entries).filter((entry) => {
            if (!includeClosed && entry.state === 'closed') {
                return false;
            }
            return (
                !normalizedSurfaceKey ||
                entry.surfaceKey === normalizedSurfaceKey
            );
        });
    }

    function add(entry = {}) {
        const normalized = normalizeEntry(
            {
                ...entry,
                state: entry.state || 'open',
            },
            options.surfaceKey,
            clinicProfile
        );
        envelope = {
            ...envelope,
            entries: sortEntries([normalized, ...envelope.entries]),
            updatedAt: new Date().toISOString(),
        };
        persistEnvelope(storageKey, clinicProfile, envelope);
        return normalized;
    }

    function update(entryId, patch = {}) {
        const normalizedId = toString(entryId);
        if (!normalizedId) {
            return null;
        }

        let updatedEntry = null;
        const entries = envelope.entries.map((entry) => {
            if (entry.id !== normalizedId) {
                return entry;
            }

            updatedEntry = normalizeEntry(
                {
                    ...entry,
                    ...asObject(patch),
                    id: entry.id,
                    surfaceKey: entry.surfaceKey,
                    surface: entry.surfaceKey,
                    updatedAt:
                        patch.updatedAt ||
                        patch.updated_at ||
                        new Date().toISOString(),
                },
                entry.surfaceKey,
                clinicProfile
            );
            return updatedEntry;
        });

        if (!updatedEntry) {
            return null;
        }

        write({
            ...envelope,
            entries: sortEntries(entries),
            updatedAt: new Date().toISOString(),
        });
        return updatedEntry;
    }

    function close(entryId, patch = {}) {
        const closedAt = toString(patch.closedAt || new Date().toISOString());
        const updated = update(entryId, {
            ...patch,
            state: 'closed',
            closedAt,
            resolvedAt: patch.resolvedAt || closedAt,
        });
        return updated;
    }

    function remove(entryId) {
        const normalizedId = toString(entryId);
        if (!normalizedId) {
            return false;
        }

        const nextEntries = envelope.entries.filter(
            (entry) => entry.id !== normalizedId
        );
        if (nextEntries.length === envelope.entries.length) {
            return false;
        }

        write({
            ...envelope,
            entries: nextEntries,
            updatedAt: new Date().toISOString(),
        });
        return true;
    }

    function replace(entries = []) {
        const nextEntries = toArray(entries)
            .map((entry) =>
                normalizeEntry(entry, options.surfaceKey, clinicProfile)
            )
            .filter((entry) => Boolean(entry.id));

        write({
            ...envelope,
            entries: sortEntries(nextEntries),
            updatedAt: new Date().toISOString(),
        });

        return envelope.entries;
    }

    function snapshot({ surfaceKey, includeClosed = true } = {}) {
        const entries = list({ surfaceKey, includeClosed });
        const counts = getEntryStateCounts(entries);
        const latestAt = entries[0]?.updatedAt || entries[0]?.createdAt || '';

        return {
            schema: STORE_SCHEMA,
            storageKey,
            clinicId: envelope.clinicId,
            surfaceKey: surfaceKey ? normalizeSurfaceToken(surfaceKey) : '',
            state:
                counts.blocked > 0
                    ? 'blocked'
                    : counts.open > 0 || counts.planned > 0
                      ? 'watch'
                      : 'ready',
            totalCount: counts.total,
            openCount: counts.open,
            closedCount: counts.closed,
            plannedCount: counts.planned,
            blockedCount: counts.blocked,
            latestAt,
            updatedAt:
                envelope.updatedAt || latestAt || new Date().toISOString(),
            entries,
            summary: {
                total: counts.total,
                open: counts.open,
                closed: counts.closed,
                planned: counts.planned,
                blocked: counts.blocked,
            },
            generatedAt: new Date().toISOString(),
        };
    }

    return {
        schema: STORE_SCHEMA,
        storageKey,
        clinicId: envelope.clinicId,
        list,
        add,
        update,
        close,
        remove,
        replace,
        snapshot,
        clear() {
            envelope = createEmptyStore(clinicProfile);
            persistEnvelope(storageKey, clinicProfile, envelope);
            return envelope;
        },
        get state() {
            return snapshot({ includeClosed: true });
        },
    };
}
