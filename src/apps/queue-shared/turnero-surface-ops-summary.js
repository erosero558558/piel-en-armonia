function normalizeText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function normalizeSurface(surface) {
    const normalized = normalizeText(surface, 'operator').toLowerCase();
    return normalized === 'sala_tv' ? 'display' : normalized;
}

function formatAgeLabel(ageSeconds) {
    const age = Number(ageSeconds);
    if (!Number.isFinite(age) || age < 0) {
        return 'sin envio';
    }
    if (age < 60) {
        return `${Math.round(age)}s`;
    }
    if (age < 3600) {
        return `${Math.floor(age / 60)}m`;
    }
    return `${Math.floor(age / 3600)}h`;
}

function formatTimestamp(value) {
    const timestamp = Date.parse(normalizeText(value));
    if (!Number.isFinite(timestamp)) {
        return '';
    }

    try {
        return new Date(timestamp).toLocaleString('es-EC', {
            dateStyle: 'short',
            timeStyle: 'short',
        });
    } catch (_error) {
        return new Date(timestamp).toISOString();
    }
}

function resolveOpsChip(runtimeWatch = {}, readiness = {}) {
    if (
        runtimeWatch.state === 'fallback' ||
        normalizeText(readiness.band) === 'fallback' ||
        normalizeText(readiness.decision) === 'hold'
    ) {
        return {
            value: 'Fallback',
            state: 'alert',
        };
    }

    if (
        runtimeWatch.state === 'watch' ||
        normalizeText(readiness.band) === 'watch' ||
        normalizeText(readiness.decision) === 'review'
    ) {
        return {
            value: 'Watch',
            state: 'warning',
        };
    }

    if (runtimeWatch.state === 'healthy') {
        return {
            value: 'Lista',
            state: 'ready',
        };
    }

    return {
        value: 'Sin senal',
        state: 'info',
    };
}

function resolveHeartbeatChip(runtimeWatch = {}) {
    const ageLabel = formatAgeLabel(runtimeWatch.ageSeconds);
    if (runtimeWatch.stale) {
        return {
            value: `Stale ${ageLabel}`,
            state: 'alert',
        };
    }
    if (runtimeWatch.heartbeatState === 'watch') {
        return {
            value: `Watch ${ageLabel}`,
            state: 'warning',
        };
    }
    if (runtimeWatch.heartbeatState === 'healthy') {
        return {
            value: `OK ${ageLabel}`,
            state: 'ready',
        };
    }
    return {
        value: ageLabel,
        state: 'info',
    };
}

function resolveContractChip(runtimeWatch = {}) {
    if (runtimeWatch.routeMatch === false) {
        return {
            value: 'Ruta fuera de canon',
            state: 'alert',
        };
    }
    if (
        runtimeWatch.clinicMatch === false ||
        runtimeWatch.profileMatch === false
    ) {
        return {
            value: 'Identidad no coincide',
            state: 'alert',
        };
    }
    if (runtimeWatch.contractState === 'alert') {
        return {
            value: 'Canon bloqueado',
            state: 'alert',
        };
    }
    if (runtimeWatch.contractState === 'warning') {
        return {
            value: 'Canon con avisos',
            state: 'warning',
        };
    }
    return {
        value: 'Canon OK',
        state: 'ready',
    };
}

function resolveScoreChip(readiness = {}) {
    const score = Math.max(0, Math.min(100, Number(readiness.score || 0)));
    const band = normalizeText(readiness.band, 'watch').toLowerCase();
    return {
        value: `${score}/100`,
        state:
            band === 'ready'
                ? 'ready'
                : band === 'fallback'
                  ? 'alert'
                  : 'warning',
    };
}

function resolveDecisionLabel(readiness = {}) {
    const decision = normalizeText(readiness.decision, 'review').toLowerCase();
    if (decision === 'ready') {
        return 'Lista';
    }
    if (decision === 'hold') {
        return 'Hold';
    }
    return 'Review';
}

function resolveSummaryText(runtimeWatch = {}, readiness = {}) {
    if (runtimeWatch.state === 'unknown') {
        return normalizeText(
            runtimeWatch.emptySummary,
            'La superficie todavia no reporta heartbeat.'
        );
    }
    if (runtimeWatch.routeMatch === false) {
        return `Ruta reportada ${normalizeText(
            runtimeWatch.currentRoute,
            'sin ruta'
        )}; canon ${normalizeText(runtimeWatch.expectedRoute, 'sin canon')}.`;
    }
    if (runtimeWatch.clinicMatch === false) {
        return `clinicId reportado ${normalizeText(
            runtimeWatch.reportedClinicId,
            'sin clinicId'
        )}; esperado ${normalizeText(runtimeWatch.expectedClinicId, 'sin canon')}.`;
    }
    if (runtimeWatch.profileMatch === false) {
        return `La firma del heartbeat no coincide con el perfil activo.`;
    }
    if (runtimeWatch.safeMode) {
        return normalizeText(
            runtimeWatch.safeModeDetail,
            'La superficie entro en modo seguro.'
        );
    }
    if (runtimeWatch.stale) {
        return `Heartbeat sin renovar ${formatAgeLabel(runtimeWatch.ageSeconds)}.`;
    }
    if (normalizeText(runtimeWatch.summary)) {
        return runtimeWatch.summary;
    }
    if (normalizeText(readiness.band) === 'ready') {
        return 'Superficie estable y lista para operar.';
    }
    if (normalizeText(readiness.band) === 'fallback') {
        return 'La superficie necesita revision antes de seguir operando.';
    }
    return 'La superficie sigue operativa, pero mantiene avisos pendientes.';
}

function resolveDetailText(runtimeWatch = {}, readiness = {}) {
    const notes = [];
    if (Array.isArray(runtimeWatch.issues) && runtimeWatch.issues.length > 0) {
        notes.push(runtimeWatch.issues.join(', '));
    }
    if (Array.isArray(readiness.penalties) && readiness.penalties.length > 0) {
        notes.push(readiness.penalties[0].detail);
    }
    return notes.join(' · ');
}

function resolveEntryLabel(entry, fallback) {
    if (!entry || typeof entry !== 'object') {
        return '';
    }
    const title = normalizeText(entry.title, fallback);
    const detail = normalizeText(entry.detail);
    const timestamp = formatTimestamp(
        entry.createdAt || entry.updatedAt || entry.at
    );
    return [title, detail && detail !== title ? detail : '', timestamp]
        .filter(Boolean)
        .join(' · ');
}

export function buildTurneroSurfaceOpsSummary({
    surface,
    watch,
    readiness,
    drills,
    logbook,
} = {}) {
    const runtimeWatch =
        watch && typeof watch === 'object'
            ? watch
            : { surface, state: 'unknown' };
    const opsReadiness =
        readiness && typeof readiness === 'object'
            ? readiness
            : {
                  score: 0,
                  band: 'watch',
                  decision: 'review',
              };
    const surfaceKey = normalizeSurface(surface || runtimeWatch.surface);
    const latestDrill =
        opsReadiness.latestDrill ||
        (Array.isArray(drills) ? drills.filter(Boolean)[0] : null) ||
        null;
    const latestLog =
        opsReadiness.latestLog ||
        (Array.isArray(logbook) ? logbook.filter(Boolean)[0] : null) ||
        null;
    const opsChip = resolveOpsChip(runtimeWatch, opsReadiness);
    const heartbeatChip = resolveHeartbeatChip(runtimeWatch);
    const contractChip = resolveContractChip(runtimeWatch);
    const scoreChip = resolveScoreChip(opsReadiness);

    return {
        surface: surfaceKey,
        label: normalizeText(runtimeWatch.label, surfaceKey),
        state: normalizeText(runtimeWatch.state, 'unknown'),
        summaryText: resolveSummaryText(runtimeWatch, opsReadiness),
        detailText: resolveDetailText(runtimeWatch, opsReadiness),
        opsChipValue: opsChip.value,
        opsChipState: opsChip.state,
        heartbeatChipValue: heartbeatChip.value,
        heartbeatChipState: heartbeatChip.state,
        contractLabel: contractChip.value,
        contractState: contractChip.state,
        scoreLabel: scoreChip.value,
        scoreState: scoreChip.state,
        decisionLabel: resolveDecisionLabel(opsReadiness),
        decisionState:
            normalizeText(opsReadiness.decision) === 'ready'
                ? 'ready'
                : normalizeText(opsReadiness.decision) === 'hold'
                  ? 'alert'
                  : 'warning',
        latestDrillLabel: resolveEntryLabel(latestDrill, 'Sin drill reciente'),
        latestDrill,
        latestLogLabel: resolveEntryLabel(latestLog, 'Sin bitacora reciente'),
        latestLog,
        heartbeatAgeLabel: formatAgeLabel(runtimeWatch.ageSeconds),
        empty: runtimeWatch.state === 'unknown',
    };
}
