import fs from 'node:fs';
import path from 'node:path';

export const OFFLINE_SNAPSHOT_MAX_AGE_MS = 5 * 60 * 1000;

const DEFAULT_STATE = Object.freeze({
    connectivity: 'online',
    hasAuthenticatedSession: false,
    lastAuthenticatedAt: '',
    lastSuccessfulSyncAt: '',
    snapshot: null,
    outbox: [],
    reconciliation: [],
});

const ALLOWED_QUEUE_ACTIONS = new Set([
    'call_next',
    'recall',
    'complete',
    'no_show',
]);

function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_error) {
        return null;
    }
}

function persistJson(filePath, payload) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function toIsoDate(value, fallback = '') {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) {
        return fallback;
    }
    return date.toISOString();
}

function normalizeConnectivity(value) {
    return String(value || '')
        .trim()
        .toLowerCase() === 'offline'
        ? 'offline'
        : 'online';
}

function normalizeStation(value) {
    return String(value || '')
        .trim()
        .toLowerCase() === 'c2'
        ? 'c2'
        : 'c1';
}

function sanitizeTicket(raw, fallbackIndex = 0) {
    const index = Number(fallbackIndex || 0);
    const ticketId =
        Number(raw?.id || raw?.ticket_id || index + 1) || index + 1;
    return {
        id: ticketId,
        ticketCode: String(
            raw?.ticketCode || raw?.ticket_code || `A-${ticketId}`
        ),
        queueType: String(raw?.queueType || raw?.queue_type || 'walk_in'),
        patientInitials: String(
            raw?.patientInitials || raw?.patient_initials || '--'
        ),
        priorityClass: String(
            raw?.priorityClass || raw?.priority_class || 'walk_in'
        ),
        status: String(raw?.status || 'waiting'),
        assignedConsultorio:
            Number(
                raw?.assignedConsultorio || raw?.assigned_consultorio || 0
            ) === 2
                ? 2
                : Number(
                        raw?.assignedConsultorio ||
                            raw?.assigned_consultorio ||
                            0
                    ) === 1
                  ? 1
                  : null,
        createdAt: toIsoDate(raw?.createdAt || raw?.created_at, ''),
        calledAt: toIsoDate(raw?.calledAt || raw?.called_at, ''),
        completedAt: toIsoDate(raw?.completedAt || raw?.completed_at, ''),
        needsAssistance: Boolean(raw?.needsAssistance ?? raw?.needs_assistance),
        assistanceRequestStatus: String(
            raw?.assistanceRequestStatus || raw?.assistance_request_status || ''
        ),
        activeHelpRequestId:
            Number(
                raw?.activeHelpRequestId ?? raw?.active_help_request_id ?? 0
            ) || null,
        specialPriority: Boolean(raw?.specialPriority ?? raw?.special_priority),
        lateArrival: Boolean(raw?.lateArrival ?? raw?.late_arrival),
        reprintRequestedAt: toIsoDate(
            raw?.reprintRequestedAt || raw?.reprint_requested_at,
            ''
        ),
        estimatedWaitMin: Math.max(
            0,
            Number(raw?.estimatedWaitMin ?? raw?.estimated_wait_min ?? 0) || 0
        ),
    };
}

function sanitizeQueueMeta(raw) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    try {
        return JSON.parse(JSON.stringify(raw));
    } catch (_error) {
        return null;
    }
}

function sanitizeSnapshot(payload) {
    const source =
        payload?.snapshot && typeof payload.snapshot === 'object'
            ? payload.snapshot
            : payload;
    if (!source || typeof source !== 'object') {
        return null;
    }

    const queueTickets = Array.isArray(source.queueTickets)
        ? source.queueTickets.map((ticket, index) =>
              sanitizeTicket(ticket, index)
          )
        : [];
    const queueMeta = sanitizeQueueMeta(source.queueMeta);

    if (!queueTickets.length && !queueMeta) {
        return null;
    }

    return {
        queueTickets,
        queueMeta,
        savedAt: toIsoDate(source.savedAt, new Date().toISOString()),
        station: normalizeStation(source.station || source.stationKey || 'c1'),
    };
}

function sanitizeQueueAction(raw, fallbackIndex = 0) {
    const type = String(raw?.type || '')
        .trim()
        .toLowerCase();
    if (!ALLOWED_QUEUE_ACTIONS.has(type)) {
        return null;
    }

    const ticketId = Number(raw?.ticketId || raw?.ticket_id || 0);
    if (ticketId <= 0) {
        return null;
    }

    const createdAt = toIsoDate(raw?.createdAt, new Date().toISOString());
    const baseKey = `${type}:${ticketId}:${createdAt}:${fallbackIndex}`;

    return {
        idempotencyKey: String(raw?.idempotencyKey || baseKey),
        type,
        ticketId,
        station: normalizeStation(raw?.station || raw?.stationKey || 'c1'),
        createdAt,
    };
}

function sanitizeReconciliationItem(raw, fallbackIndex = 0) {
    const action = sanitizeQueueAction(raw, fallbackIndex);
    if (!action) {
        return null;
    }

    return {
        ...action,
        reason: String(raw?.reason || raw?.message || 'Conflicto remoto'),
        failedAt: toIsoDate(raw?.failedAt, new Date().toISOString()),
    };
}

function sanitizeState(rawState) {
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    return {
        connectivity: normalizeConnectivity(source.connectivity),
        hasAuthenticatedSession: Boolean(source.hasAuthenticatedSession),
        lastAuthenticatedAt: toIsoDate(source.lastAuthenticatedAt, ''),
        lastSuccessfulSyncAt: toIsoDate(source.lastSuccessfulSyncAt, ''),
        snapshot: sanitizeSnapshot(source.snapshot),
        outbox: (Array.isArray(source.outbox) ? source.outbox : [])
            .map((item, index) => sanitizeQueueAction(item, index))
            .filter(Boolean),
        reconciliation: (Array.isArray(source.reconciliation)
            ? source.reconciliation
            : []
        )
            .map((item, index) => sanitizeReconciliationItem(item, index))
            .filter(Boolean),
    };
}

function getSnapshotAgeMs(snapshot) {
    if (!snapshot?.savedAt) {
        return Number.POSITIVE_INFINITY;
    }
    const savedAt = new Date(snapshot.savedAt).getTime();
    if (!Number.isFinite(savedAt)) {
        return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, Date.now() - savedAt);
}

export function deriveShellStatus(state, runtimeConfig = {}) {
    const snapshotAgeMs = getSnapshotAgeMs(state.snapshot);
    const snapshotAgeSec = Number.isFinite(snapshotAgeMs)
        ? Math.floor(snapshotAgeMs / 1000)
        : null;
    const snapshotFresh = snapshotAgeMs <= OFFLINE_SNAPSHOT_MAX_AGE_MS;
    const reconciliationSize = Array.isArray(state.reconciliation)
        ? state.reconciliation.length
        : 0;
    const outboxSize = Array.isArray(state.outbox) ? state.outbox.length : 0;
    const offlineEnabled =
        Boolean(state.hasAuthenticatedSession) &&
        Boolean(state.snapshot) &&
        snapshotFresh &&
        reconciliationSize === 0;
    const connectivity = normalizeConnectivity(state.connectivity);

    let mode = 'live';
    let reason = 'connected';

    if (connectivity === 'offline') {
        if (!state.hasAuthenticatedSession) {
            mode = 'safe';
            reason = 'no_authenticated_session';
        } else if (!state.snapshot) {
            mode = 'safe';
            reason = 'missing_snapshot';
        } else if (!snapshotFresh) {
            mode = 'safe';
            reason = 'snapshot_expired';
        } else if (reconciliationSize > 0) {
            mode = 'safe';
            reason = 'reconciliation_pending';
        } else {
            mode = 'offline';
            reason = 'offline_ready';
        }
    } else if (reconciliationSize > 0) {
        reason = 'reconciliation_pending';
    }

    return {
        connectivity,
        mode,
        offlineEnabled,
        snapshotAgeSec,
        outboxSize,
        reconciliationSize,
        lastSuccessfulSyncAt: state.lastSuccessfulSyncAt || '',
        updateChannel:
            String(runtimeConfig?.updateChannel || '')
                .trim()
                .toLowerCase() === 'pilot'
                ? 'pilot'
                : 'stable',
        reason,
    };
}

export function createShellStateStore(filePath, getRuntimeConfig = () => ({})) {
    let state = sanitizeState(readJson(filePath) || DEFAULT_STATE);
    const listeners = new Set();

    function emit() {
        const snapshot = {
            status: deriveShellStatus(state, getRuntimeConfig()),
            snapshot: state.snapshot,
            outbox: state.outbox,
            reconciliation: state.reconciliation,
            hasAuthenticatedSession: state.hasAuthenticatedSession,
            lastAuthenticatedAt: state.lastAuthenticatedAt,
        };
        listeners.forEach((listener) => {
            try {
                listener(snapshot);
            } catch (_error) {
                // no-op
            }
        });
    }

    function commit(producer) {
        const nextState =
            typeof producer === 'function'
                ? producer(state)
                : producer && typeof producer === 'object'
                  ? producer
                  : state;
        state = sanitizeState(nextState);
        persistJson(filePath, state);
        emit();
        return state;
    }

    commit(state);

    return {
        getState() {
            return sanitizeState(state);
        },
        getStatus() {
            return deriveShellStatus(state, getRuntimeConfig());
        },
        getOfflineSnapshot() {
            return {
                snapshot: state.snapshot,
                outbox: state.outbox,
                reconciliation: state.reconciliation,
                hasAuthenticatedSession: state.hasAuthenticatedSession,
                lastAuthenticatedAt: state.lastAuthenticatedAt,
            };
        },
        subscribe(listener) {
            if (typeof listener !== 'function') {
                return () => {};
            }
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        reportShellState(payload = {}) {
            return commit((current) => ({
                ...current,
                connectivity: normalizeConnectivity(
                    payload.connectivity || current.connectivity
                ),
                hasAuthenticatedSession:
                    typeof payload.authenticated === 'boolean'
                        ? payload.authenticated
                        : current.hasAuthenticatedSession,
                lastAuthenticatedAt:
                    payload.authenticated === true
                        ? toIsoDate(payload.at, new Date().toISOString())
                        : payload.authenticated === false
                          ? ''
                          : current.lastAuthenticatedAt,
                lastSuccessfulSyncAt: payload.lastSuccessfulSyncAt
                    ? toIsoDate(
                          payload.lastSuccessfulSyncAt,
                          current.lastSuccessfulSyncAt
                      )
                    : current.lastSuccessfulSyncAt,
            }));
        },
        markSessionAuthenticated(payload = {}) {
            return commit((current) => ({
                ...current,
                hasAuthenticatedSession: payload.authenticated !== false,
                lastAuthenticatedAt:
                    payload.authenticated === false
                        ? ''
                        : toIsoDate(payload.at, new Date().toISOString()),
            }));
        },
        saveOfflineSnapshot(payload = {}) {
            const snapshot = sanitizeSnapshot(payload);
            if (!snapshot) {
                return this.getOfflineSnapshot();
            }
            return commit((current) => ({
                ...current,
                snapshot,
                lastSuccessfulSyncAt:
                    payload.healthy === false
                        ? current.lastSuccessfulSyncAt
                        : snapshot.savedAt,
            }));
        },
        enqueueQueueAction(payload = {}) {
            const action = sanitizeQueueAction(payload, state.outbox.length);
            if (!action) {
                throw new Error('Acción offline fuera de scope');
            }

            const status = deriveShellStatus(state, getRuntimeConfig());
            if (!status.offlineEnabled) {
                throw new Error('Offline no disponible para este equipo');
            }

            return commit((current) => ({
                ...current,
                outbox: [...current.outbox, action],
            }));
        },
        flushQueueOutbox(payload = {}) {
            const processed = new Set(
                (Array.isArray(payload.processedIds)
                    ? payload.processedIds
                    : []
                ).map((item) => String(item || ''))
            );
            const conflicts = (
                Array.isArray(payload.conflicts) ? payload.conflicts : []
            )
                .map((item, index) => sanitizeReconciliationItem(item, index))
                .filter(Boolean);
            const conflictKeys = new Set(
                conflicts.map((item) => String(item.idempotencyKey || ''))
            );

            return commit((current) => ({
                ...current,
                connectivity: normalizeConnectivity(
                    payload.connectivity || current.connectivity
                ),
                lastSuccessfulSyncAt: payload.lastSuccessfulSyncAt
                    ? toIsoDate(
                          payload.lastSuccessfulSyncAt,
                          current.lastSuccessfulSyncAt
                      )
                    : current.lastSuccessfulSyncAt,
                outbox: current.outbox.filter((item) => {
                    const key = String(item.idempotencyKey || '');
                    return !processed.has(key) && !conflictKeys.has(key);
                }),
                reconciliation: [...current.reconciliation, ...conflicts],
            }));
        },
    };
}
