function normalizeText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function normalizeState(value) {
    const normalized = normalizeText(value, 'unknown').toLowerCase();
    return normalized || 'unknown';
}

function normalizeBoolean(value) {
    if (value === true || value === 1 || value === '1' || value === 'true') {
        return true;
    }

    return false;
}

export function buildTurneroSurfaceGoLiveSnapshot(input = {}) {
    const clinicProfile =
        input.clinicProfile && typeof input.clinicProfile === 'object'
            ? input.clinicProfile
            : {};
    const clinicId = normalizeText(
        input.clinicId || clinicProfile.clinic_id || clinicProfile.clinicId,
        ''
    );
    const surfaceKey = normalizeText(input.surfaceKey, 'surface');

    return {
        scope: normalizeText(input.scope, clinicId || surfaceKey || 'global'),
        surfaceKey,
        surfaceLabel: normalizeText(input.surfaceLabel, surfaceKey),
        clinicId,
        clinicLabel: normalizeText(
            input.clinicLabel ||
                clinicProfile?.branding?.name ||
                clinicProfile?.branding?.short_name ||
                clinicId,
            ''
        ),
        runtimeState: normalizeState(input.runtimeState),
        truth: normalizeState(input.truth),
        printerState: normalizeState(input.printerState),
        bellState: normalizeState(input.bellState),
        signageState: normalizeState(input.signageState),
        operatorReady: normalizeBoolean(input.operatorReady),
        updatedAt: normalizeText(input.updatedAt, new Date().toISOString()),
    };
}
