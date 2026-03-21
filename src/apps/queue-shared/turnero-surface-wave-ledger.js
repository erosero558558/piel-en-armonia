import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';

const STORAGE_KEY = 'turneroSurfaceWaveLedgerV1';
const STORE_SCHEMA = 'turnero-surface-wave-ledger/v1';
const MEMORY_FALLBACK_STORES = new Map();
const MAX_HISTORY = 300;

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function normalizeScope(scope, clinicProfile) {
    return toString(scope || clinicProfile?.region || 'regional', 'regional');
}

function normalizeSurfaceKey(value) {
    const normalized = toString(value, '').toLowerCase();
    const aliases = {
        admin: 'admin',
        queue: 'admin',
        'queue-admin': 'admin',
        'admin-queue': 'admin',
        operator: 'operator',
        operador: 'operator',
        'operator-turnos': 'operator',
        'operador-turnos': 'operator',
        kiosk: 'kiosk',
        kiosko: 'kiosk',
        kiosco: 'kiosk',
        'kiosk-turnos': 'kiosk',
        'kiosko-turnos': 'kiosk',
        'kiosco-turnos': 'kiosk',
        display: 'display',
        sala: 'display',
        'sala-turnos': 'display',
        sala_tv: 'display',
        'sala-tv': 'display',
    };

    return aliases[normalized] || normalized || 'surface';
}

function normalizeStatus(value) {
    const normalized = toString(value, 'planned').toLowerCase();
    if (
        ['ready', 'planned', 'scheduled', 'done', 'active'].includes(normalized)
    ) {
        return normalized === 'active' ? 'ready' : normalized;
    }
    if (['paused', 'hold', 'blocked', 'stalled'].includes(normalized)) {
        return 'paused';
    }
    if (['closed', 'complete', 'completed', 'released'].includes(normalized)) {
        return 'done';
    }
    return 'planned';
}

function getClinicFallbackKey(clinicProfile) {
    return toString(
        clinicProfile?.clinic_id ||
            clinicProfile?.clinicId ||
            clinicProfile?.id,
        'default-clinic'
    );
}

function normalizeEnvelope(rawEnvelope, fallbackScope = 'regional') {
    if (Array.isArray(rawEnvelope)) {
        return {
            schema: STORE_SCHEMA,
            scopes: {
                [normalizeScope(fallbackScope)]: rawEnvelope,
            },
        };
    }

    const source = asObject(rawEnvelope);
    return {
        schema: toString(source.schema, STORE_SCHEMA),
        scopes:
            source.scopes && typeof source.scopes === 'object'
                ? source.scopes
                : {},
    };
}

function normalizeEntry(entry = {}, fallbackScope = 'regional') {
    const source = asObject(entry);
    const scope = normalizeScope(source.scope || fallbackScope, {});
    const createdAt =
        toString(source.createdAt || source.updatedAt) ||
        new Date().toISOString();
    const waveLabel = toString(
        source.waveLabel || source.title || source.label,
        ''
    );
    const title = toString(
        source.title || source.waveLabel || source.label,
        'Wave item'
    );
    const owner = toString(source.owner || source.actor || 'ops', 'ops');

    return {
        id:
            toString(source.id) ||
            `wave-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        scope,
        region: scope,
        surfaceKey: normalizeSurfaceKey(source.surfaceKey || source.surface),
        title,
        waveLabel: waveLabel || title,
        owner,
        status: normalizeStatus(source.status),
        note: toString(source.note || source.detail),
        batch: toString(source.batch || source.rolloutBatch || 'unassigned'),
        documentationState: toString(
            source.documentationState || source.documentation_state || 'draft',
            'draft'
        ),
        createdAt,
        updatedAt: toString(source.updatedAt, createdAt),
        meta:
            source.meta && typeof source.meta === 'object'
                ? { ...source.meta }
                : {},
    };
}

function readEnvelope(scope, clinicProfile) {
    const normalizedScope = normalizeScope(scope, clinicProfile);
    const normalized = readClinicScopedStorageValue(
        STORAGE_KEY,
        clinicProfile,
        {
            fallbackValue: null,
            normalizeValue: (value) =>
                normalizeEnvelope(value, normalizedScope),
        }
    );

    if (normalized && typeof normalized === 'object') {
        return normalizeEnvelope(normalized, normalizedScope);
    }

    const memoryKey = `${getClinicFallbackKey(clinicProfile)}:${normalizedScope}`;
    const memoryEnvelope = MEMORY_FALLBACK_STORES.get(memoryKey);
    if (memoryEnvelope) {
        return normalizeEnvelope(memoryEnvelope, normalizedScope);
    }

    return {
        schema: STORE_SCHEMA,
        scopes: {},
    };
}

function persistEnvelope(scope, clinicProfile, envelope) {
    const normalizedScope = normalizeScope(scope, clinicProfile);
    const normalized = normalizeEnvelope(envelope, normalizedScope);
    const persisted = persistClinicScopedStorageValue(
        STORAGE_KEY,
        clinicProfile,
        normalized
    );
    const memoryKey = `${getClinicFallbackKey(clinicProfile)}:${normalizedScope}`;

    if (!persisted) {
        MEMORY_FALLBACK_STORES.set(memoryKey, normalized);
    } else {
        MEMORY_FALLBACK_STORES.delete(memoryKey);
    }

    return persisted;
}

function readEntries(scope, clinicProfile) {
    const normalizedScope = normalizeScope(scope, clinicProfile);
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
    const normalizedScope = normalizeScope(scope, clinicProfile);
    const envelope = readEnvelope(normalizedScope, clinicProfile);
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

    return persistEnvelope(normalizedScope, clinicProfile, {
        schema: envelope.schema || STORE_SCHEMA,
        scopes: {
            ...scopes,
            [normalizedScope]: entries
                .map((entry) => normalizeEntry(entry, normalizedScope))
                .slice(0, MAX_HISTORY),
        },
    });
}

export function createTurneroSurfaceWaveLedger(
    scope = 'regional',
    clinicProfile = null
) {
    const normalizedScope = normalizeScope(scope, clinicProfile);

    return {
        list({ surfaceKey = '', status = '' } = {}) {
            const normalizedSurfaceKey = toString(surfaceKey);
            const normalizedStatus = toString(status);

            return readEntries(normalizedScope, clinicProfile).filter(
                (entry) =>
                    (!normalizedSurfaceKey ||
                        entry.surfaceKey ===
                            normalizeSurfaceKey(normalizedSurfaceKey)) &&
                    (!normalizedStatus ||
                        entry.status === normalizeStatus(normalizedStatus))
            );
        },
        add(entry = {}) {
            const nextEntry = normalizeEntry(
                {
                    ...entry,
                    scope: normalizedScope,
                    region: normalizedScope,
                    status: entry.status || 'planned',
                    owner: entry.owner || entry.actor || 'ops',
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
            const normalizedSurfaceKey = toString(surfaceKey);
            if (!normalizedSurfaceKey) {
                return writeEntries(normalizedScope, clinicProfile, []);
            }

            const remaining = readEntries(
                normalizedScope,
                clinicProfile
            ).filter(
                (entry) =>
                    entry.surfaceKey !==
                    normalizeSurfaceKey(normalizedSurfaceKey)
            );
            return writeEntries(normalizedScope, clinicProfile, remaining);
        },
        snapshot() {
            return readEnvelope(normalizedScope, clinicProfile);
        },
    };
}
