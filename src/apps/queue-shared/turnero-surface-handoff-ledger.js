import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';

const TURNERO_SURFACE_HANDOFF_LEDGER_STORAGE_KEY =
    'turneroSurfaceSyncHandoffLedgerV1';

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeLedgerEnvelope(rawValue) {
    if (Array.isArray(rawValue)) {
        return {
            scopes: {
                global: rawValue,
            },
        };
    }

    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
        return { scopes: {} };
    }

    const scopes =
        rawValue.scopes && typeof rawValue.scopes === 'object'
            ? rawValue.scopes
            : {};
    return {
        scopes,
    };
}

function normalizeEntry(entry = {}) {
    const surfaceKey = normalizeText(entry.surfaceKey) || 'surface';
    const status =
        normalizeText(entry.status).toLowerCase() === 'closed'
            ? 'closed'
            : 'open';
    return {
        id:
            normalizeText(entry.id) ||
            `${surfaceKey}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        scope: normalizeText(entry.scope) || 'global',
        surfaceKey,
        title: normalizeText(entry.title) || 'Handoff note',
        note: normalizeText(entry.note),
        owner: normalizeText(entry.owner) || 'ops',
        source:
            normalizeText(entry.source).toLowerCase() === 'remote_surface'
                ? 'remote_surface'
                : 'local',
        status,
        createdAt: normalizeText(entry.createdAt) || new Date().toISOString(),
        updatedAt:
            normalizeText(entry.updatedAt || entry.createdAt) ||
            new Date().toISOString(),
    };
}

export function resolveTurneroSurfaceHandoffState(handoffs = []) {
    return Array.isArray(handoffs) &&
        handoffs.some(
            (handoff) =>
                handoff &&
                typeof handoff === 'object' &&
                String(handoff.status || '').toLowerCase() !== 'closed'
        )
        ? 'open'
        : 'clear';
}

export function createTurneroSurfaceHandoffLedger(
    scope = 'global',
    clinicProfile = null
) {
    const normalizedScope = normalizeText(scope) || 'global';

    function readEnvelope() {
        return readClinicScopedStorageValue(
            TURNERO_SURFACE_HANDOFF_LEDGER_STORAGE_KEY,
            clinicProfile,
            {
                fallbackValue: { scopes: {} },
                normalizeValue: normalizeLedgerEnvelope,
            }
        );
    }

    function readEntries() {
        const envelope = readEnvelope();
        const rawEntries = Array.isArray(envelope?.scopes?.[normalizedScope])
            ? envelope.scopes[normalizedScope]
            : [];
        return rawEntries
            .map((entry) =>
                normalizeEntry({ ...entry, scope: normalizedScope })
            )
            .sort((left, right) =>
                String(right.updatedAt || '').localeCompare(
                    String(left.updatedAt || '')
                )
            );
    }

    function writeEntries(entries) {
        if (!Array.isArray(entries) || entries.length === 0) {
            const envelope = readEnvelope();
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
                        TURNERO_SURFACE_HANDOFF_LEDGER_STORAGE_KEY,
                        clinicProfile
                    );
                }
                return persistClinicScopedStorageValue(
                    TURNERO_SURFACE_HANDOFF_LEDGER_STORAGE_KEY,
                    clinicProfile,
                    envelope
                );
            }
            return true;
        }

        const envelope = readEnvelope();
        const nextEnvelope = {
            scopes: {
                ...(envelope?.scopes && typeof envelope.scopes === 'object'
                    ? envelope.scopes
                    : {}),
                [normalizedScope]: entries.map((entry) =>
                    normalizeEntry({ ...entry, scope: normalizedScope })
                ),
            },
        };
        return persistClinicScopedStorageValue(
            TURNERO_SURFACE_HANDOFF_LEDGER_STORAGE_KEY,
            clinicProfile,
            nextEnvelope
        );
    }

    return {
        list({ includeClosed = true, surfaceKey = '' } = {}) {
            const normalizedSurfaceKey = normalizeText(surfaceKey);
            return readEntries().filter((entry) => {
                if (!includeClosed && entry.status === 'closed') {
                    return false;
                }
                if (
                    normalizedSurfaceKey &&
                    entry.surfaceKey !== normalizedSurfaceKey
                ) {
                    return false;
                }
                return true;
            });
        },
        add(entry = {}) {
            const nextEntry = normalizeEntry({
                ...entry,
                scope: normalizedScope,
                status: entry.status || 'open',
                source: entry.source || 'local',
            });
            const entries = readEntries();
            writeEntries([nextEntry, ...entries].slice(0, 100));
            return nextEntry;
        },
        update(entryId, patch = {}) {
            const targetId = normalizeText(entryId);
            if (!targetId) {
                return null;
            }
            let updatedEntry = null;
            const entries = readEntries().map((entry) => {
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
            });
            if (!updatedEntry) {
                return null;
            }
            writeEntries(entries);
            return updatedEntry;
        },
        close(entryId) {
            return this.update(entryId, { status: 'closed' });
        },
        clear({ surfaceKey = '' } = {}) {
            const normalizedSurfaceKey = normalizeText(surfaceKey);
            if (!normalizedSurfaceKey) {
                return writeEntries([]);
            }
            const remaining = readEntries().filter(
                (entry) => entry.surfaceKey !== normalizedSurfaceKey
            );
            return writeEntries(remaining);
        },
    };
}
