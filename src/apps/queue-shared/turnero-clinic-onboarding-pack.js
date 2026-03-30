import {
    getTurneroClinicOpeningPackage,
    getTurneroClinicProfileFingerprint,
    normalizeTurneroClinicProfile,
} from './clinic-profile.js';
import { asObject, toArray, toString } from './turnero-surface-helpers.js';

const DEFAULT_TENANT_DOMAIN = 'flowos.ec';
const DEFAULT_RELEASE_MODE = 'web_pilot';
const DEFAULT_CITY = 'Quito';
const DEFAULT_SURFACE_ROUTES = Object.freeze({
    admin: '/admin.html#queue',
    operator: '/operador-turnos.html',
    kiosk: '/kiosco-turnos.html',
    display: '/sala-turnos.html',
});

function normalizeAsciiToken(value, fallback = '') {
    const normalized = String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || fallback;
}

function normalizeClinicId(value, fallback = 'clinica-demo') {
    return normalizeAsciiToken(value, fallback);
}

function normalizeTenantDomain(value, fallback = DEFAULT_TENANT_DOMAIN) {
    const raw = toString(value, fallback)
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*$/, '')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
    return raw || fallback;
}

function normalizeAbsoluteUrl(value, fallback = '') {
    const raw = toString(value, fallback);
    if (!raw) {
        return '';
    }

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    try {
        const parsed = new URL(withProtocol);
        return parsed.toString().replace(/\/$/, '');
    } catch (_error) {
        return fallback;
    }
}

function joinAbsoluteUrl(baseUrl, route) {
    const base = normalizeAbsoluteUrl(baseUrl);
    const normalizedRoute = toString(route, '/');
    if (!base || !normalizedRoute) {
        return '';
    }

    const [pathname, hash = ''] = normalizedRoute.split('#');
    try {
        const target = new URL(pathname || '/', `${base}/`);
        if (hash) {
            target.hash = hash;
        }
        return target.toString();
    } catch (_error) {
        return `${base}${normalizedRoute.startsWith('/') ? '' : '/'}${normalizedRoute}`;
    }
}

function isMeaningfulProfile(profile) {
    const normalized = normalizeTurneroClinicProfile(profile);
    return (
        normalized.clinic_id !== 'default-clinic' ||
        normalized.branding.base_url !== '' ||
        normalized.branding.name !== 'Aurora Derm'
    );
}

function resolveReleaseMode(value, fallback = DEFAULT_RELEASE_MODE) {
    const normalized = toString(value, fallback).toLowerCase();
    return normalized === 'suite_v2' ? 'suite_v2' : 'web_pilot';
}

function buildDefaultClinicDraft(input = {}, options = {}) {
    const source = asObject(input);
    const currentProfile = isMeaningfulProfile(options.currentProfile)
        ? normalizeTurneroClinicProfile(options.currentProfile)
        : null;
    const brandName = toString(
        source.brandName || source.name,
        currentProfile?.branding?.name || 'Nueva clinica'
    );
    const shortName = toString(
        source.shortName,
        currentProfile?.branding?.short_name || brandName
    );
    const clinicId = normalizeClinicId(
        source.clinicId || source.slug || brandName,
        currentProfile?.clinic_id || 'clinica-demo'
    );
    const tenantDomain = normalizeTenantDomain(
        source.tenantDomain,
        DEFAULT_TENANT_DOMAIN
    );
    const baseUrl = normalizeAbsoluteUrl(
        source.baseUrl,
        currentProfile?.branding?.base_url || `https://${clinicId}.${tenantDomain}`
    );
    const releaseMode = resolveReleaseMode(
        source.releaseMode,
        currentProfile?.release?.mode || DEFAULT_RELEASE_MODE
    );

    return {
        brandName,
        shortName,
        clinicId,
        city: toString(source.city, currentProfile?.branding?.city || DEFAULT_CITY),
        tenantDomain,
        baseUrl,
        consultorio1Label: toString(
            source.consultorio1Label,
            currentProfile?.consultorios?.c1?.label || 'Consultorio 1'
        ),
        consultorio1ShortLabel: toString(
            source.consultorio1ShortLabel,
            currentProfile?.consultorios?.c1?.short_label || 'C1'
        ),
        consultorio2Label: toString(
            source.consultorio2Label,
            currentProfile?.consultorios?.c2?.label || 'Consultorio 2'
        ),
        consultorio2ShortLabel: toString(
            source.consultorio2ShortLabel,
            currentProfile?.consultorios?.c2?.short_label || 'C2'
        ),
        releaseMode,
    };
}

function normalizeStaffRow(entry = {}, index = 0) {
    const source = asObject(entry);
    const name = toString(source.name || source.staffName);
    return {
        id:
            toString(source.id) ||
            `staff-${index + 1}-${normalizeClinicId(name || source.role || 'row', 'row')}`,
        name,
        role: toString(source.role, 'doctor'),
        station: toString(source.station, 'c1'),
        shift: toString(source.shift, 'am'),
    };
}

function normalizeServiceRow(entry = {}, index = 0) {
    const source = asObject(entry);
    const label = toString(source.label || source.name || source.serviceName);
    const durationMinutes = Number(source.durationMinutes || source.duration || 30);
    return {
        id:
            toString(source.id) ||
            `service-${index + 1}-${normalizeClinicId(label || source.category || 'row', 'row')}`,
        label,
        category: toString(source.category, 'dermatologia'),
        mode: toString(source.mode, 'presencial'),
        durationMinutes:
            Number.isFinite(durationMinutes) && durationMinutes > 0
                ? Math.round(durationMinutes)
                : 30,
    };
}

function buildProfileFromDraft(clinicDraft = {}) {
    const draft = buildDefaultClinicDraft(clinicDraft);
    return normalizeTurneroClinicProfile({
        schema: 'turnero-clinic-profile/v1',
        clinic_id: draft.clinicId,
        branding: {
            name: draft.brandName,
            short_name: draft.shortName,
            city: draft.city,
            base_url: draft.baseUrl,
        },
        consultorios: {
            c1: {
                label: draft.consultorio1Label,
                short_label: draft.consultorio1ShortLabel,
            },
            c2: {
                label: draft.consultorio2Label,
                short_label: draft.consultorio2ShortLabel,
            },
        },
        surfaces: {
            admin: {
                enabled: true,
                label: 'Admin web',
                route: DEFAULT_SURFACE_ROUTES.admin,
            },
            operator: {
                enabled: true,
                label: 'Operador web',
                route: DEFAULT_SURFACE_ROUTES.operator,
            },
            kiosk: {
                enabled: true,
                label: 'Kiosco web',
                route: DEFAULT_SURFACE_ROUTES.kiosk,
            },
            display: {
                enabled: true,
                label: 'Sala web',
                route: DEFAULT_SURFACE_ROUTES.display,
            },
        },
        release: {
            mode: draft.releaseMode,
            admin_mode_default: 'basic',
            separate_deploy: true,
            native_apps_blocking: draft.releaseMode === 'suite_v2',
            notes: [
                draft.releaseMode === 'suite_v2'
                    ? 'Suite V2 deja la ola nativa posterior como dependencia del rollout completo.'
                    : 'Web pilot publica admin, operador, kiosco y sala web como paquete inicial por clinica.',
                `Tenant sugerido: ${draft.baseUrl}`,
            ],
        },
    });
}

function buildReadiness(profile, staffRows, serviceRows) {
    const blockers = [];
    const warnings = [];

    if (!toString(profile?.clinic_id)) {
        blockers.push('clinic_id obligatorio');
    }
    if (!toString(profile?.branding?.name)) {
        blockers.push('branding.name obligatorio');
    }
    if (!toString(profile?.branding?.base_url)) {
        blockers.push('branding.base_url obligatorio');
    }
    if (staffRows.length === 0) {
        blockers.push('cargar al menos 1 miembro de staff');
    } else if (staffRows.length < 2) {
        warnings.push('conviene cargar al menos 2 roles para recepcion y consulta');
    }
    if (serviceRows.length === 0) {
        blockers.push('activar al menos 1 servicio');
    } else if (serviceRows.length < 2) {
        warnings.push('conviene activar un servicio primario y uno de respaldo');
    }

    const state =
        blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'watch' : 'ready';
    const label =
        state === 'blocked'
            ? 'Onboarding bloqueado'
            : state === 'watch'
              ? 'Onboarding en revision'
              : 'Onboarding listo';

    return { state, label, blockers, warnings };
}

function buildBrief(pack) {
    const staffSummary =
        pack.staff.length > 0
            ? pack.staff
                  .map((row) => `${row.name} · ${row.role} · ${row.station}`)
                  .join('\n')
            : 'Sin staff cargado';
    const servicesSummary =
        pack.services.length > 0
            ? pack.services
                  .map(
                      (row) =>
                          `${row.label} · ${row.category} · ${row.mode} · ${row.durationMinutes} min`
                  )
                  .join('\n')
            : 'Sin servicios activos';
    const urlSummary =
        pack.urls.length > 0
            ? pack.urls.map((row) => `${row.label}: ${row.url}`).join('\n')
            : 'Sin URLs generadas';

    return [
        '# Clinic Onboarding Studio',
        `Clinica: ${pack.turneroClinicProfile.branding.name} (${pack.turneroClinicProfile.clinic_id})`,
        `Modo: ${pack.turneroClinicProfile.release.mode} · admin ${pack.turneroClinicProfile.release.admin_mode_default}`,
        `Base URL: ${pack.turneroClinicProfile.branding.base_url}`,
        `Fingerprint: ${pack.summary.profileFingerprint}`,
        '',
        '## Staff',
        staffSummary,
        '',
        '## Servicios activos',
        servicesSummary,
        '',
        '## URLs',
        urlSummary,
        '',
        '## Estado',
        pack.summary.label,
        ...pack.summary.blockers.map((item) => `- Bloquea: ${item}`),
        ...pack.summary.warnings.map((item) => `- Revisar: ${item}`),
    ].join('\n');
}

export function buildTurneroClinicOnboardingPack(input = {}) {
    const source = asObject(input);
    const clinicDraft = buildDefaultClinicDraft(
        source.clinicDraft || source.clinic || source,
        {
            currentProfile:
                source.currentProfile ||
                source.clinicProfile ||
                source.turneroClinicProfile ||
                null,
        }
    );
    const turneroClinicProfile = buildProfileFromDraft(clinicDraft);
    const staff = toArray(source.staffRows || source.staff)
        .map((entry, index) => normalizeStaffRow(entry, index))
        .filter((row) => row.name);
    const services = toArray(source.serviceRows || source.services)
        .map((entry, index) => normalizeServiceRow(entry, index))
        .filter((row) => row.label);
    const openingPackage = getTurneroClinicOpeningPackage(turneroClinicProfile);
    const urls = openingPackage.surfaces
        .filter((surface) => surface.enabled)
        .map((surface) => ({
            id: surface.id,
            label: surface.label,
            route: surface.route,
            url: joinAbsoluteUrl(
                turneroClinicProfile.branding.base_url,
                surface.route
            ),
        }));
    const readiness = buildReadiness(turneroClinicProfile, staff, services);
    const summary = {
        ...readiness,
        staffCount: staff.length,
        serviceCount: services.length,
        urlCount: urls.length,
        profileFingerprint: getTurneroClinicProfileFingerprint(
            turneroClinicProfile
        ),
    };

    const pack = {
        generatedAt: new Date().toISOString(),
        clinicDraft,
        turneroClinicProfile,
        openingPackage,
        staff,
        services,
        urls,
        summary,
    };

    return {
        ...pack,
        brief: buildBrief(pack),
    };
}

export function getDefaultTurneroClinicOnboardingDraft(options = {}) {
    return buildDefaultClinicDraft(options.clinicDraft || {}, {
        currentProfile:
            options.currentProfile ||
            options.clinicProfile ||
            options.turneroClinicProfile ||
            null,
    });
}
