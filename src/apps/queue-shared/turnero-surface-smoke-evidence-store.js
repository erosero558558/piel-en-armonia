import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';
import { asObject, toArray, toString } from './turnero-surface-helpers.js';
import { normalizeTurneroSurfaceKey } from './turnero-surface-release-truth.js';

const STORAGE_KEY = 'turneroSurfaceSmokeEvidenceV1';
const MEMORY_EVIDENCE_STORE = new Map();

function resolveClinicId(clinicProfile) {
    return toString(
        clinicProfile?.clinic_id || clinicProfile?.clinicId,
        'default-clinic'
    );
}

function normalizeEvidenceEnvelope(rawValue) {
    if (Array.isArray(rawValue)) {
        return { scopes: { global: rawValue } };
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

function normalizeEvidenceStatus(value) {
    const token = toString(value, 'captured').toLowerCase();
    if (
        ['captured', 'review', 'resolved', 'missing', 'stale', 'open'].includes(
            token
        )
    ) {
        return token === 'open' ? 'review' : token;
    }

    return 'captured';
}

function normalizeEvidenceItem(entry = {}, scope = 'global') {
    const surfaceKey = normalizeTurneroSurfaceKey(
        entry.surfaceKey ||
            entry.surfaceId ||
            entry.surfaceRoute ||
            entry.surface
    );
    const fallbackId = `${surfaceKey || 'smoke'}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;
    const capturedAt = toString(
        entry.capturedAt || entry.createdAt || entry.updatedAt,
        new Date().toISOString()
    );

    return {
        ...asObject(entry),
        id: toString(entry.id, fallbackId),
        scope: toString(entry.scope, scope || 'global'),
        surfaceKey: surfaceKey || 'surface',
        title: toString(entry.title, 'Manual smoke evidence'),
        note: toString(entry.note, ''),
        status: normalizeEvidenceStatus(entry.status),
        author: toString(entry.author || entry.owner, 'admin'),
        source: toString(entry.source, 'manual') || 'manual',
        capturedAt,
        updatedAt: toString(entry.updatedAt, capturedAt),
        tags: toArray(entry.tags),
        details: asObject(entry.details),
    };
}

function readClinicEnvelope(clinicProfile) {
    const clinicId = resolveClinicId(clinicProfile);
    const persisted = readClinicScopedStorageValue(STORAGE_KEY, clinicProfile, {
        fallbackValue: null,
        normalizeValue: normalizeEvidenceEnvelope,
    });

    if (persisted) {
        return persisted;
    }

    return MEMORY_EVIDENCE_STORE.get(clinicId) || { scopes: {} };
}

function writeClinicEnvelope(clinicProfile, envelope) {
    const clinicId = resolveClinicId(clinicProfile);
    const safeEnvelope = normalizeEvidenceEnvelope(envelope);
    const persisted = persistClinicScopedStorageValue(
        STORAGE_KEY,
        clinicProfile,
        safeEnvelope
    );

    if (!persisted) {
        MEMORY_EVIDENCE_STORE.set(clinicId, safeEnvelope);
        return false;
    }

    MEMORY_EVIDENCE_STORE.delete(clinicId);
    return true;
}

function removeClinicEnvelope(clinicProfile) {
    const clinicId = resolveClinicId(clinicProfile);
    const removed = removeClinicScopedStorageValue(STORAGE_KEY, clinicProfile);
    MEMORY_EVIDENCE_STORE.delete(clinicId);
    return removed;
}

function countEvidenceItems(items = []) {
    const summary = {
        all: items.length,
        captured: 0,
        review: 0,
        resolved: 0,
        missing: 0,
        stale: 0,
        open: 0,
    };

    for (const item of items) {
        const status = normalizeEvidenceStatus(item.status);
        summary[status] += 1;
        if (status !== 'resolved') {
            summary.open += 1;
        }
    }

    return summary;
}

export function createTurneroSurfaceSmokeEvidenceStore(
    scope = 'global',
    clinicProfile = null
) {
    const normalizedScope = toString(scope, 'global') || 'global';

    function readEntries() {
        const envelope = readClinicEnvelope(clinicProfile);
        const rawEntries = Array.isArray(envelope?.scopes?.[normalizedScope])
            ? envelope.scopes[normalizedScope]
            : [];
        return rawEntries
            .map((entry) => normalizeEvidenceItem(entry, normalizedScope))
            .sort((left, right) =>
                String(right.updatedAt || '').localeCompare(
                    String(left.updatedAt || '')
                )
            );
    }

    function writeEntries(entries = []) {
        const envelope = readClinicEnvelope(clinicProfile);
        const nextEnvelope = {
            scopes: {
                ...(envelope?.scopes && typeof envelope.scopes === 'object'
                    ? envelope.scopes
                    : {}),
            },
        };

        if (!Array.isArray(entries) || entries.length === 0) {
            if (
                nextEnvelope.scopes &&
                Object.prototype.hasOwnProperty.call(
                    nextEnvelope.scopes,
                    normalizedScope
                )
            ) {
                delete nextEnvelope.scopes[normalizedScope];
                if (Object.keys(nextEnvelope.scopes).length === 0) {
                    return removeClinicEnvelope(clinicProfile);
                }
                return writeClinicEnvelope(clinicProfile, nextEnvelope);
            }

            return true;
        }

        nextEnvelope.scopes[normalizedScope] = entries.map((entry) =>
            normalizeEvidenceItem(entry, normalizedScope)
        );
        return writeClinicEnvelope(clinicProfile, nextEnvelope);
    }

    function getScopeItems(surfaceKey = '', includeResolved = true) {
        const normalizedSurfaceKey = normalizeTurneroSurfaceKey(surfaceKey);
        return readEntries().filter((entry) => {
            if (!includeResolved && entry.status === 'resolved') {
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
    }

    return {
        scope: normalizedScope,
        list({ includeResolved = true, surfaceKey = '' } = {}) {
            return getScopeItems(surfaceKey, includeResolved);
        },
        add(entry = {}) {
            const nextEntry = normalizeEvidenceItem(
                {
                    ...entry,
                    scope: normalizedScope,
                    status: entry.status || 'captured',
                    source: entry.source || 'manual',
                },
                normalizedScope
            );
            const entries = readEntries();
            writeEntries([nextEntry, ...entries].slice(0, 100));
            return nextEntry;
        },
        update(entryId, patch = {}) {
            const targetId = toString(entryId, '');
            if (!targetId) {
                return null;
            }

            let updatedEntry = null;
            const entries = readEntries().map((entry) => {
                if (entry.id !== targetId) {
                    return entry;
                }
                updatedEntry = normalizeEvidenceItem(
                    {
                        ...entry,
                        ...patch,
                        id: entry.id,
                        scope: normalizedScope,
                        updatedAt: new Date().toISOString(),
                    },
                    normalizedScope
                );
                return updatedEntry;
            });

            if (!updatedEntry) {
                return null;
            }

            writeEntries(entries);
            return updatedEntry;
        },
        remove(entryId) {
            const targetId = toString(entryId, '');
            if (!targetId) {
                return false;
            }

            const remaining = readEntries().filter(
                (entry) => entry.id !== targetId
            );
            return writeEntries(remaining);
        },
        clear({ surfaceKey = '' } = {}) {
            const normalizedSurfaceKey = normalizeTurneroSurfaceKey(surfaceKey);
            if (!normalizedSurfaceKey) {
                return writeEntries([]);
            }

            const remaining = readEntries().filter(
                (entry) => entry.surfaceKey !== normalizedSurfaceKey
            );
            return writeEntries(remaining);
        },
        snapshot() {
            const items = readEntries();
            return {
                scope: normalizedScope,
                clinicId: resolveClinicId(clinicProfile),
                items,
                summary: countEvidenceItems(items),
                generatedAt: new Date().toISOString(),
            };
        },
        summary() {
            return countEvidenceItems(readEntries());
        },
    };
}

export function buildTurneroSurfaceSmokeEvidenceStore(
    scope = 'global',
    clinicProfile = null
) {
    return createTurneroSurfaceSmokeEvidenceStore(scope, clinicProfile);
}

export function normalizeTurneroSurfaceSmokeEvidenceStoreItems(items = []) {
    return toArray(items).map((item) => normalizeEvidenceItem(item));
}
