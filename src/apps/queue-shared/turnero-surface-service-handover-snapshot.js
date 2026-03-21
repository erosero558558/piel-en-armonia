function normalizeText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function normalizeState(value, fallback = 'unknown') {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase();
    return normalized || fallback;
}

function getClinicLabel(clinicProfile = {}) {
    return normalizeText(
        clinicProfile?.branding?.name ||
            clinicProfile?.branding?.short_name ||
            clinicProfile?.label ||
            clinicProfile?.name ||
            '',
        ''
    );
}

export function buildTurneroSurfaceServiceHandoverSnapshot(input = {}) {
    const clinicProfile =
        input.clinicProfile && typeof input.clinicProfile === 'object'
            ? input.clinicProfile
            : {};
    const surfaceKey = normalizeText(input.surfaceKey, 'surface');
    const clinicId = normalizeText(
        input.clinicId ||
            clinicProfile?.clinic_id ||
            clinicProfile?.clinicId ||
            clinicProfile?.id,
        ''
    );

    return {
        scope: normalizeText(input.scope, clinicId || surfaceKey || 'global'),
        surfaceKey,
        surfaceLabel: normalizeText(input.surfaceLabel, surfaceKey),
        clinicId,
        clinicLabel: normalizeText(
            input.clinicLabel || getClinicLabel(clinicProfile) || clinicId,
            ''
        ),
        runtimeState: normalizeState(input.runtimeState),
        truth: normalizeState(input.truth),
        primaryOwner: normalizeText(input.primaryOwner),
        backupOwner: normalizeText(input.backupOwner),
        playbookState: normalizeState(input.playbookState, 'missing'),
        supportChannel: normalizeText(input.supportChannel),
        handoverMode: normalizeText(input.handoverMode, 'manual'),
        updatedAt: normalizeText(input.updatedAt, new Date().toISOString()),
    };
}
