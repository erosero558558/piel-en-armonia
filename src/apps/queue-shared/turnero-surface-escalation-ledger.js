import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';
import { normalizeTurneroSurfaceRecoveryKey } from './turnero-surface-contract-snapshot.js';
import { asObject, toArray, toString } from './turnero-surface-helpers.js';

const TURNERO_SURFACE_ESCALATION_LEDGER_KEY =
    'turneroSurfaceEscalationLedgerV1';
const STORE_SCHEMA = 'turnero-surface-escalations/v1';

const memoryFallbackStores = new Map();

function getClinicId(clinicProfile) {
    return toString(
        clinicProfile?.clinic_id || clinicProfile?.clinicId,
        'default-clinic'
    );
}

function getFallbackStoreKey(storageKey, clinicProfile) {
    return `${toString(storageKey, TURNERO_SURFACE_ESCALATION_LEDGER_KEY)}:${getClinicId(
        clinicProfile
    )}`;
}

function clearFallbackStore(storageKey, clinicProfile) {
    return memoryFallbackStores.delete(
        getFallbackStoreKey(storageKey, clinicProfile)
    );
}

function normalizeEnvelope(rawValue, clinicProfile) {
    if (Array.isArray(rawValue)) {
        return {
            schema: STORE_SCHEMA,
            clinicId: getClinicId(clinicProfile),
            updatedAt: '',
            scopes: {
                global: rawValue,
            },
        };
    }

    const source = asObject(rawValue);
    const scopes =
        source.scopes && typeof source.scopes === 'object' ? source.scopes : {};

    return {
        schema: toString(source.schema, STORE_SCHEMA),
        clinicId: toString(source.clinicId, getClinicId(clinicProfile)),
        updatedAt: toString(source.updatedAt, ''),
        scopes,
    };
}

function normalizeEscalationState(value) {
    const normalized = toString(value, 'open').toLowerCase();
    if (['closed', 'resolved', 'dismissed'].includes(normalized)) {
        return 'closed';
    }
    if (['tracking', 'acknowledged', 'observing'].includes(normalized)) {
        return 'tracking';
    }
    return 'open';
}

function normalizeEscalationSeverity(value) {
    const normalized = toString(value, 'medium').toLowerCase();
    if (['critical', 'urgent', 'severe'].includes(normalized)) {
        return 'critical';
    }
    if (['high', 'major'].includes(normalized)) {
        return 'high';
    }
    if (['low', 'minor'].includes(normalized)) {
        return 'low';
    }
    return 'medium';
}

function normalizeEscalation(entry = {}, fallbackSurfaceKey = 'admin') {
    const source = asObject(entry);
    const surfaceKey = normalizeTurneroSurfaceRecoveryKey(
        source.surfaceKey || source.surface || fallbackSurfaceKey
    );
    const createdAt = toString(
        source.createdAt || source.created_at || source.updatedAt
    );
    const updatedAt = toString(
        source.updatedAt || source.updated_at || createdAt
    );

    return {
        id: toString(source.id || `${surfaceKey}-${createdAt || Date.now()}`),
        scope: toString(source.scope, 'queue-support'),
        surfaceKey,
        title: toString(source.title || source.label || 'Support escalation'),
        detail: toString(source.detail || source.note || ''),
        severity: normalizeEscalationSeverity(source.severity || source.tone),
        state: normalizeEscalationState(source.state || source.status),
        owner: toString(source.owner || source.assignee || 'ops'),
        contactId: toString(source.contactId || source.contact_id || ''),
        source: toString(source.source || 'manual'),
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

function isOpenEscalation(escalation) {
    return normalizeEscalationState(escalation?.state) !== 'closed';
}

function severityRank(severity) {
    switch (normalizeEscalationSeverity(severity)) {
        case 'critical':
            return 0;
        case 'high':
            return 1;
        case 'medium':
            return 2;
        default:
            return 3;
    }
}

function sortEscalations(escalations) {
    return [...escalations].sort((left, right) => {
        const stateDelta =
            isOpenEscalation(left) === isOpenEscalation(right)
                ? 0
                : isOpenEscalation(left)
                  ? -1
                  : 1;
        if (stateDelta !== 0) {
            return stateDelta;
        }

        const severityDelta =
            severityRank(left.severity) - severityRank(right.severity);
        if (severityDelta !== 0) {
            return severityDelta;
        }

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
            String(left.id).localeCompare(String(right.id))
        );
    });
}

function readEnvelope(storageKey, clinicProfile) {
    const persisted = readClinicScopedStorageValue(storageKey, clinicProfile, {
        fallbackValue: null,
        normalizeValue: (value) => normalizeEnvelope(value, clinicProfile),
    });

    if (persisted && typeof persisted === 'object') {
        return normalizeEnvelope(persisted, clinicProfile);
    }

    const fallbackKey = getFallbackStoreKey(storageKey, clinicProfile);
    const fallbackEnvelope = memoryFallbackStores.get(fallbackKey);
    if (fallbackEnvelope) {
        return normalizeEnvelope(fallbackEnvelope, clinicProfile);
    }

    return normalizeEnvelope(null, clinicProfile);
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
    } else {
        memoryFallbackStores.set(fallbackKey, normalized);
    }

    return persisted;
}

function readScopeEscalations(storageKey, clinicProfile, scope) {
    const envelope = readEnvelope(storageKey, clinicProfile);
    const rawEscalations = toArray(envelope.scopes?.[scope]);
    return sortEscalations(
        rawEscalations.map((escalation) => normalizeEscalation(escalation))
    );
}

function writeScopeEscalations(storageKey, clinicProfile, scope, escalations) {
    const normalizedEscalations = sortEscalations(
        toArray(escalations)
            .map((escalation) => normalizeEscalation(escalation))
            .filter((escalation) => Boolean(escalation.id))
    );
    const envelope = readEnvelope(storageKey, clinicProfile);
    const nextEnvelope = {
        schema: STORE_SCHEMA,
        clinicId: getClinicId(clinicProfile),
        updatedAt: new Date().toISOString(),
        scopes: {
            ...(envelope.scopes && typeof envelope.scopes === 'object'
                ? envelope.scopes
                : {}),
        },
    };

    if (!normalizedEscalations.length) {
        delete nextEnvelope.scopes[scope];
        if (Object.keys(nextEnvelope.scopes).length === 0) {
            const cleared = removeClinicScopedStorageValue(
                storageKey,
                clinicProfile
            );
            const fallbackCleared = clearFallbackStore(
                storageKey,
                clinicProfile
            );
            return cleared || fallbackCleared;
        }

        return persistEnvelope(storageKey, clinicProfile, nextEnvelope);
    }

    nextEnvelope.scopes[scope] = normalizedEscalations;
    return persistEnvelope(storageKey, clinicProfile, nextEnvelope);
}

function summarizeEscalations(escalations = []) {
    const summary = {
        all: escalations.length,
        open: 0,
        closed: 0,
        tracking: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
    };

    for (const escalation of escalations) {
        const state = normalizeEscalationState(escalation.state);
        const severity = normalizeEscalationSeverity(escalation.severity);
        summary[state] += 1;
        summary[severity] += 1;
    }

    return summary;
}

function isClosedEscalation(escalation) {
    return !isOpenEscalation(escalation);
}

export function createTurneroSurfaceEscalationLedger(
    scope = 'queue-support',
    clinicProfile = null
) {
    const normalizedScope = toString(scope, 'queue-support') || 'queue-support';
    const normalizedClinicProfile =
        clinicProfile && typeof clinicProfile === 'object' ? clinicProfile : {};

    return {
        scope: normalizedScope,
        clinicId: getClinicId(normalizedClinicProfile),
        list({ includeClosed = false, surfaceKey = '' } = {}) {
            const normalizedSurfaceKey = surfaceKey
                ? normalizeTurneroSurfaceRecoveryKey(surfaceKey)
                : '';
            return readScopeEscalations(
                TURNERO_SURFACE_ESCALATION_LEDGER_KEY,
                normalizedClinicProfile,
                normalizedScope
            )
                .filter((escalation) => {
                    if (!includeClosed && isClosedEscalation(escalation)) {
                        return false;
                    }
                    if (
                        normalizedSurfaceKey &&
                        escalation.surfaceKey !== normalizedSurfaceKey
                    ) {
                        return false;
                    }
                    return true;
                })
                .map((escalation) => ({ ...escalation }));
        },
        add(entry = {}) {
            const nextEntry = normalizeEscalation(
                {
                    ...entry,
                    scope: normalizedScope,
                    state: entry.state || 'open',
                    severity: entry.severity || 'medium',
                },
                entry.surfaceKey || 'admin'
            );
            const current = readScopeEscalations(
                TURNERO_SURFACE_ESCALATION_LEDGER_KEY,
                normalizedClinicProfile,
                normalizedScope
            );
            writeScopeEscalations(
                TURNERO_SURFACE_ESCALATION_LEDGER_KEY,
                normalizedClinicProfile,
                normalizedScope,
                [nextEntry, ...current].slice(0, 200)
            );
            return nextEntry;
        },
        update(escalationId, patch = {}) {
            const targetId = toString(escalationId, '');
            if (!targetId) {
                return null;
            }

            let updatedEscalation = null;
            const escalations = readScopeEscalations(
                TURNERO_SURFACE_ESCALATION_LEDGER_KEY,
                normalizedClinicProfile,
                normalizedScope
            ).map((escalation) => {
                if (escalation.id !== targetId) {
                    return escalation;
                }

                updatedEscalation = normalizeEscalation(
                    {
                        ...escalation,
                        ...asObject(patch),
                        id: escalation.id,
                        scope: normalizedScope,
                        updatedAt: new Date().toISOString(),
                    },
                    escalation.surfaceKey
                );
                return updatedEscalation;
            });

            if (!updatedEscalation) {
                return null;
            }

            writeScopeEscalations(
                TURNERO_SURFACE_ESCALATION_LEDGER_KEY,
                normalizedClinicProfile,
                normalizedScope,
                escalations
            );
            return updatedEscalation;
        },
        close(escalationId, patch = {}) {
            return this.update(escalationId, {
                ...patch,
                state: 'closed',
                closedAt:
                    patch.closedAt ||
                    patch.closed_at ||
                    new Date().toISOString(),
                resolvedAt:
                    patch.resolvedAt ||
                    patch.resolved_at ||
                    new Date().toISOString(),
            });
        },
        remove(escalationId) {
            const targetId = toString(escalationId, '');
            if (!targetId) {
                return false;
            }

            const remaining = readScopeEscalations(
                TURNERO_SURFACE_ESCALATION_LEDGER_KEY,
                normalizedClinicProfile,
                normalizedScope
            ).filter((escalation) => escalation.id !== targetId);
            return writeScopeEscalations(
                TURNERO_SURFACE_ESCALATION_LEDGER_KEY,
                normalizedClinicProfile,
                normalizedScope,
                remaining
            );
        },
        clear({ surfaceKey = '' } = {}) {
            const normalizedSurfaceKey = surfaceKey
                ? normalizeTurneroSurfaceRecoveryKey(surfaceKey)
                : '';
            if (!normalizedSurfaceKey) {
                return writeScopeEscalations(
                    TURNERO_SURFACE_ESCALATION_LEDGER_KEY,
                    normalizedClinicProfile,
                    normalizedScope,
                    []
                );
            }

            const remaining = readScopeEscalations(
                TURNERO_SURFACE_ESCALATION_LEDGER_KEY,
                normalizedClinicProfile,
                normalizedScope
            ).filter(
                (escalation) => escalation.surfaceKey !== normalizedSurfaceKey
            );
            return writeScopeEscalations(
                TURNERO_SURFACE_ESCALATION_LEDGER_KEY,
                normalizedClinicProfile,
                normalizedScope,
                remaining
            );
        },
        snapshot() {
            const escalations = readScopeEscalations(
                TURNERO_SURFACE_ESCALATION_LEDGER_KEY,
                normalizedClinicProfile,
                normalizedScope
            );
            const openEscalations = escalations.filter(isOpenEscalation);
            return {
                scope: normalizedScope,
                clinicId: getClinicId(normalizedClinicProfile),
                escalations,
                openEscalations,
                summary: summarizeEscalations(escalations),
                generatedAt: new Date().toISOString(),
            };
        },
        summary() {
            return summarizeEscalations(
                readScopeEscalations(
                    TURNERO_SURFACE_ESCALATION_LEDGER_KEY,
                    normalizedClinicProfile,
                    normalizedScope
                )
            );
        },
        refresh() {
            return readEnvelope(
                TURNERO_SURFACE_ESCALATION_LEDGER_KEY,
                normalizedClinicProfile
            );
        },
    };
}

export {
    normalizeEscalation as normalizeTurneroSurfaceEscalation,
    normalizeEnvelope as normalizeTurneroSurfaceEscalationEnvelope,
    TURNERO_SURFACE_ESCALATION_LEDGER_KEY,
};
