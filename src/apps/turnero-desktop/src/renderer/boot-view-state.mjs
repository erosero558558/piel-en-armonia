import { getRetrySnapshot } from '../runtime/retry-state.mjs';

export function formatBootCountdownLabel(ms) {
    const safeMs = Math.max(0, Number(ms || 0));
    const totalSeconds = Math.max(1, Math.ceil(safeMs / 1000));
    if (totalSeconds < 60) {
        return `${totalSeconds}s`;
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export function getBootRetryView(snapshot, now = Date.now()) {
    const retry = getRetrySnapshot(snapshot?.retry, now);
    if (!retry.active) {
        return null;
    }

    const reason = String(retry.reason || snapshot?.message || '').trim();
    const attempt = Math.max(1, Number(retry.attempt || 0));
    return {
        attempt,
        summary:
            retry.remainingMs > 0
                ? `Reintento #${attempt} en ~${formatBootCountdownLabel(
                      retry.remainingMs
                  )}`
                : `Reintento #${attempt} pendiente`,
        hint: reason
            ? `${reason}. Usa Reintentar para adelantar la carga o F10 para quedarte en configuración.`
            : 'El shell volverá a intentar la carga automáticamente. Usa Reintentar para adelantarla o F10 para quedarte en configuración.',
    };
}

export function getBootPreflightView(report) {
    if (!report || typeof report !== 'object') {
        return {
            summaryState: 'warning',
            summaryText:
                'Ejecuta la comprobación para validar servidor, superficie y perfil del equipo.',
            checks: [],
        };
    }

    const checks = Array.isArray(report.checks) ? report.checks : [];
    return {
        summaryState: String(report.state || 'warning'),
        summaryText: `${report.title || 'Equipo en revisión'}: ${
            report.summary || ''
        }`,
        checks: checks.map((check) => ({
            id: String(check?.id || ''),
            label: String(check?.label || check?.id || 'Check'),
            state: String(check?.state || 'warning'),
            detail: String(check?.detail || ''),
        })),
    };
}

export function getBootPendingPreflightView() {
    return {
        summaryState: 'warning',
        summaryText: 'Comprobando servidor, superficie y salud del equipo...',
        checks: [],
    };
}
