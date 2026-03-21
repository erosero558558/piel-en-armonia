function normalizeText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeSeverity(value) {
    const normalized = normalizeText(value, 'info').toLowerCase();
    if (
        ['alert', 'danger', 'critical', 'blocked', 'error'].includes(normalized)
    ) {
        return 'alert';
    }
    if (['warning', 'watch', 'review'].includes(normalized)) {
        return 'warning';
    }
    if (['ready', 'ok', 'success'].includes(normalized)) {
        return 'ready';
    }
    return 'info';
}

function resolveLatestTimestamp(entry = {}) {
    const timestamp = Date.parse(
        normalizeText(entry.createdAt || entry.updatedAt || entry.at)
    );
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function pickLatestEntry(entries) {
    const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
    return (
        list.sort(
            (left, right) =>
                resolveLatestTimestamp(right) - resolveLatestTimestamp(left)
        )[0] || null
    );
}

export function buildTurneroSurfaceOpsReadinessPack({
    surface,
    watch,
    drills,
    logbook,
    now = Date.now(),
} = {}) {
    const runtimeWatch =
        watch && typeof watch === 'object'
            ? watch
            : { surface, state: 'unknown' };
    const drillEntries = Array.isArray(drills) ? drills.filter(Boolean) : [];
    const logbookEntries = Array.isArray(logbook)
        ? logbook.filter(Boolean)
        : [];
    const nowMs = Number(now) || Date.now();
    const latestDrill = pickLatestEntry(drillEntries);
    const latestLog = pickLatestEntry(logbookEntries);
    const penalties = [];
    let score = runtimeWatch.state === 'unknown' ? 52 : 100;

    if (runtimeWatch.state === 'fallback') {
        penalties.push({
            key: 'fallback',
            points: 38,
            detail: 'La superficie ya entró en fallback o reporta bloqueo.',
        });
        score -= 38;
    } else if (runtimeWatch.state === 'watch') {
        penalties.push({
            key: 'watch',
            points: 16,
            detail: 'La superficie sigue operativa, pero con avisos.',
        });
        score -= 16;
    }

    if (runtimeWatch.stale) {
        penalties.push({
            key: 'heartbeat_stale',
            points: 20,
            detail: 'El heartbeat quedó fuera del umbral esperado.',
        });
        score -= 20;
    }
    if (runtimeWatch.safeMode) {
        penalties.push({
            key: 'safe_mode',
            points: 14,
            detail: 'La superficie quedó en modo seguro.',
        });
        score -= 14;
    }
    if (runtimeWatch.routeMatch === false) {
        penalties.push({
            key: 'route_mismatch',
            points: 16,
            detail: 'La ruta activa no coincide con el canon.',
        });
        score -= 16;
    }
    if (runtimeWatch.clinicMatch === false) {
        penalties.push({
            key: 'clinic_mismatch',
            points: 12,
            detail: 'El clinicId reportado no coincide con el perfil activo.',
        });
        score -= 12;
    }
    if (runtimeWatch.profileMatch === false) {
        penalties.push({
            key: 'fingerprint_mismatch',
            points: 12,
            detail: 'La firma del perfil no coincide con el heartbeat.',
        });
        score -= 12;
    }

    if (!latestDrill) {
        penalties.push({
            key: 'drill_missing',
            points: 6,
            detail: 'No hay drills registrados para esta clínica/superficie.',
        });
        score -= 6;
    } else {
        const drillAgeDays = Math.max(
            0,
            Math.round((nowMs - resolveLatestTimestamp(latestDrill)) / 86400000)
        );
        if (drillAgeDays > 30) {
            penalties.push({
                key: 'drill_old',
                points: 4,
                detail: 'El último drill quedó fuera de la ventana reciente.',
            });
            score -= 4;
        }
    }

    if (latestLog) {
        const logSeverity = normalizeSeverity(
            latestLog.severity || latestLog.state
        );
        if (logSeverity === 'alert') {
            penalties.push({
                key: 'log_alert',
                points: 10,
                detail: 'La última bitácora dejó una observación crítica.',
            });
            score -= 10;
        } else if (logSeverity === 'warning') {
            penalties.push({
                key: 'log_warning',
                points: 5,
                detail: 'La bitácora reciente dejó avisos pendientes.',
            });
            score -= 5;
        }
    }

    score = clamp(Math.round(score), 0, 100);
    const band = score >= 85 ? 'ready' : score >= 60 ? 'watch' : 'fallback';
    const decision =
        band === 'ready' ? 'ready' : band === 'watch' ? 'review' : 'hold';

    return {
        surface: normalizeText(surface, runtimeWatch.surface || 'operator'),
        score,
        band,
        decision,
        latestDrill,
        latestLog,
        penalties,
        generatedAt: new Date(nowMs).toISOString(),
    };
}
