function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

const SURFACE_KEY_ALIASES = Object.freeze({
    admin: 'admin',
    queue: 'admin',
    'queue-admin': 'admin',
    'admin-queue': 'admin',
    operator: 'operator',
    operador: 'operator',
    'operator-turnos': 'operator',
    'operador-turnos': 'operator',
    kiosk: 'kiosk',
    kiosko: 'kiosk',
    kiosco: 'kiosk',
    'kiosk-turnos': 'kiosk',
    'kiosko-turnos': 'kiosk',
    'kiosco-turnos': 'kiosk',
    display: 'display',
    sala: 'display',
    'sala-turnos': 'display',
    sala_tv: 'display',
    'sala-tv': 'display',
});

function normalizeSurfaceKey(value) {
    const normalized = toString(value, 'surface').toLowerCase();
    return SURFACE_KEY_ALIASES[normalized] || normalized || 'surface';
}

function resolveClinicId(clinicProfile) {
    return toString(
        clinicProfile?.clinic_id ||
            clinicProfile?.clinicId ||
            clinicProfile?.id,
        ''
    );
}

function resolveClinicLabel(clinicProfile, clinicId) {
    return toString(
        clinicProfile?.branding?.name ||
            clinicProfile?.branding?.short_name ||
            clinicProfile?.label ||
            clinicProfile?.name ||
            clinicId,
        ''
    );
}

function resolveRegion(inputRegion, clinicProfile, fallbackScope) {
    return toString(
        inputRegion || clinicProfile?.region || fallbackScope || 'regional',
        'regional'
    );
}

export function buildTurneroSurfaceFleetSnapshot(input = {}) {
    const clinicProfile =
        input.clinicProfile && typeof input.clinicProfile === 'object'
            ? input.clinicProfile
            : {};
    const clinicId = resolveClinicId(clinicProfile);
    const surfaceKey = normalizeSurfaceKey(input.surfaceKey);
    const region = resolveRegion(input.region, clinicProfile, input.scope);

    return {
        surfaceKey,
        clinicId,
        clinicLabel: resolveClinicLabel(clinicProfile, clinicId),
        runtimeState: toString(input.runtimeState, 'unknown'),
        truth: toString(input.truth, 'unknown'),
        region,
        waveLabel: toString(input.waveLabel, ''),
        fleetOwner: toString(input.fleetOwner, ''),
        rolloutBatch: toString(input.rolloutBatch, 'unassigned'),
        documentationState: toString(input.documentationState, 'draft'),
        updatedAt: toString(input.updatedAt, new Date().toISOString()),
    };
}
