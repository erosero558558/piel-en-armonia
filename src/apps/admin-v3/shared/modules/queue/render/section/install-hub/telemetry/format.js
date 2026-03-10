export function formatHeartbeatAge(ageSec) {
    const safeAge = Number(ageSec);
    if (!Number.isFinite(safeAge) || safeAge < 0) return 'sin señal';
    if (safeAge < 60) return `${safeAge}s`;
    const minutes = Math.floor(safeAge / 60);
    const seconds = safeAge % 60;
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remMinutes = minutes % 60;
        return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
    }
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export function formatIntervalAge(intervalMs) {
    const safeInterval = Number(intervalMs);
    if (!Number.isFinite(safeInterval) || safeInterval <= 0) return 'cada --';
    const seconds = Math.max(1, Math.round(safeInterval / 1000));
    if (seconds < 60) return `cada ${seconds}s`;
    return `cada ${Math.round(seconds / 60)}m`;
}
