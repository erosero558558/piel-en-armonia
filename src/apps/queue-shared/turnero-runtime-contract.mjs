const DEFAULT_LAUNCH_MODE = 'fullscreen';
const DEFAULT_STATION_MODE = 'free';
const DEFAULT_STATION_CONSULTORIO = 1;
const DEFAULT_UPDATE_CHANNEL = 'stable';

export function normalizeLaunchMode(value) {
    return String(value || '')
        .trim()
        .toLowerCase() === 'windowed'
        ? 'windowed'
        : DEFAULT_LAUNCH_MODE;
}

export function normalizeStationMode(value, fallback = DEFAULT_STATION_MODE) {
    return String(value || fallback)
        .trim()
        .toLowerCase() === 'locked'
        ? 'locked'
        : 'free';
}

export function normalizeStationConsultorio(
    value,
    fallback = DEFAULT_STATION_CONSULTORIO
) {
    return Number(value || fallback) === 2 ? 2 : 1;
}

export function normalizeAutoStart(value, fallback = true) {
    if (typeof value === 'boolean') {
        return value;
    }

    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
    }
    return Boolean(fallback);
}

export function normalizeUpdateChannel(
    value,
    fallback = DEFAULT_UPDATE_CHANNEL
) {
    const preferred = String(value || '')
        .trim()
        .toLowerCase();
    if (preferred === 'pilot' || preferred === 'stable') {
        return preferred;
    }

    const fallbackChannel = String(fallback || DEFAULT_UPDATE_CHANNEL)
        .trim()
        .toLowerCase();
    return fallbackChannel === 'pilot' ? 'pilot' : DEFAULT_UPDATE_CHANNEL;
}

export function normalizeOneTap(value, fallback = false) {
    if (typeof value === 'boolean') {
        return value;
    }

    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
    }
    return Boolean(fallback);
}

export function buildOperatorSurfaceState(value = {}) {
    const stationConsultorio = normalizeStationConsultorio(
        value.stationConsultorio,
        DEFAULT_STATION_CONSULTORIO
    );
    const stationMode = normalizeStationMode(
        value.stationMode,
        DEFAULT_STATION_MODE
    );
    const oneTap = normalizeOneTap(value.oneTap, false);
    const locked = stationMode === 'locked';
    const stationKey = `c${stationConsultorio}`;

    return {
        stationConsultorio,
        stationMode,
        oneTap,
        locked,
        stationKey,
        instance: locked ? stationKey : 'free',
    };
}

export function applyOperatorSurfaceSearchParams(searchParams, value = {}) {
    const params =
        searchParams instanceof URLSearchParams
            ? searchParams
            : new URLSearchParams(searchParams);
    const surfaceState = buildOperatorSurfaceState(value);

    params.set('station', surfaceState.stationKey);
    params.set('lock', surfaceState.locked ? '1' : '0');
    params.set('one_tap', surfaceState.oneTap ? '1' : '0');

    return params;
}
