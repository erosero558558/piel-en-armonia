import {
    getTurneroClinicBrandName,
    getTurneroClinicShortName,
    normalizeTurneroClinicProfile,
} from './clinic-profile.js';

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

export function buildTurneroSurfaceCommercialSnapshot(input = {}) {
    const clinicProfile = normalizeTurneroClinicProfile(input.clinicProfile);

    return {
        surfaceKey: toString(input.surfaceKey, 'surface'),
        clinicId: toString(
            input.clinicProfile?.clinicId ||
                input.clinicProfile?.clinic_id ||
                clinicProfile.clinic_id,
            clinicProfile.clinic_id
        ),
        clinicLabel: toString(
            input.clinicProfile?.label ||
                input.clinicProfile?.name ||
                getTurneroClinicBrandName(clinicProfile) ||
                getTurneroClinicShortName(clinicProfile),
            ''
        ),
        runtimeState: toString(input.runtimeState, 'unknown'),
        truth: toString(input.truth, 'unknown'),
        packageTier: toString(input.packageTier, 'pilot'),
        commercialOwner: toString(input.commercialOwner, ''),
        opsOwner: toString(input.opsOwner, ''),
        scopeState: toString(input.scopeState, 'draft'),
        pricingState: toString(input.pricingState, 'draft'),
        updatedAt: toString(input.updatedAt, new Date().toISOString()),
    };
}
