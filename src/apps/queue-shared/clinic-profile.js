const FALLBACK_PROFILE = Object.freeze({
    schema: 'turnero-clinic-profile/v1',
    clinic_id: 'default-clinic',
    branding: {
        name: 'Consultorio Medicina General',
        short_name: 'Medicina General',
        city: '',
        base_url: '',
    },
    consultorios: {
        c1: {
            label: 'Consultorio 1',
            short_label: 'C1',
        },
        c2: {
            label: 'Consultorio 2',
            short_label: 'C2',
        },
    },
    surfaces: {
        admin: {
            enabled: true,
            label: 'Admin web',
            route: '/admin.html#queue',
        },
        operator: {
            enabled: true,
            label: 'Operador web',
            route: '/operador-turnos.html',
        },
        kiosk: {
            enabled: true,
            label: 'Kiosco web',
            route: '/kiosco-turnos.html',
        },
        display: {
            enabled: true,
            label: 'Sala web',
            route: '/sala-turnos.html',
        },
    },
    release: {
        mode: 'web_pilot',
        admin_mode_default: 'basic',
        separate_deploy: true,
        native_apps_blocking: false,
        notes: [],
    },
});

let clinicProfilePromise = null;

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function getTurneroRuntimeProductConfig() {
    if (typeof window === 'undefined') {
        return {};
    }

    const payload = window.__TURNERO_PRODUCT_CONFIG__;
    return payload && typeof payload === 'object' ? payload : {};
}

export function normalizeTurneroClinicProfile(rawProfile) {
    const source =
        rawProfile && typeof rawProfile === 'object' ? rawProfile : {};
    const productConfig = getTurneroRuntimeProductConfig();
    const productSurfaces =
        productConfig.surfaces && typeof productConfig.surfaces === 'object'
            ? productConfig.surfaces
            : {};
    const branding =
        source.branding && typeof source.branding === 'object'
            ? source.branding
            : {};
    const consultorios =
        source.consultorios && typeof source.consultorios === 'object'
            ? source.consultorios
            : {};
    const surfaces =
        source.surfaces && typeof source.surfaces === 'object'
            ? source.surfaces
            : {};
    const release =
        source.release && typeof source.release === 'object'
            ? source.release
            : {};
    const runtimeOperator = productSurfaces.operator || {};
    const runtimeKiosk = productSurfaces.kiosk || {};
    const runtimeDisplay = productSurfaces.sala_tv || {};

    return {
        schema: toString(source.schema, FALLBACK_PROFILE.schema),
        clinic_id: toString(source.clinic_id, FALLBACK_PROFILE.clinic_id),
        branding: {
            name: toString(
                productConfig.brandName,
                toString(branding.name, FALLBACK_PROFILE.branding.name)
            ),
            short_name: toString(
                productConfig.brandShortName,
                toString(
                    branding.short_name,
                    toString(
                        productConfig.brandName,
                        toString(
                            branding.name,
                            FALLBACK_PROFILE.branding.short_name
                        )
                    )
                )
            ),
            city: toString(branding.city, FALLBACK_PROFILE.branding.city),
            base_url: toString(
                productConfig.baseUrl,
                toString(branding.base_url, FALLBACK_PROFILE.branding.base_url)
            ),
        },
        consultorios: {
            c1: {
                label: toString(
                    consultorios?.c1?.label,
                    FALLBACK_PROFILE.consultorios.c1.label
                ),
                short_label: toString(
                    consultorios?.c1?.short_label,
                    FALLBACK_PROFILE.consultorios.c1.short_label
                ),
            },
            c2: {
                label: toString(
                    consultorios?.c2?.label,
                    FALLBACK_PROFILE.consultorios.c2.label
                ),
                short_label: toString(
                    consultorios?.c2?.short_label,
                    FALLBACK_PROFILE.consultorios.c2.short_label
                ),
            },
        },
        surfaces: {
            admin: {
                enabled:
                    typeof surfaces?.admin?.enabled === 'boolean'
                        ? surfaces.admin.enabled
                        : true,
                label: toString(
                    surfaces?.admin?.label,
                    FALLBACK_PROFILE.surfaces.admin.label
                ),
                route: toString(
                    surfaces?.admin?.route,
                    FALLBACK_PROFILE.surfaces.admin.route
                ),
            },
            operator: {
                enabled:
                    typeof surfaces?.operator?.enabled === 'boolean'
                        ? surfaces.operator.enabled
                        : true,
                label: toString(
                    surfaces?.operator?.label,
                    toString(
                        runtimeOperator.catalogTitle,
                        FALLBACK_PROFILE.surfaces.operator.label
                    )
                ),
                route: toString(
                    surfaces?.operator?.route,
                    toString(
                        runtimeOperator.webFallbackUrl,
                        FALLBACK_PROFILE.surfaces.operator.route
                    )
                ),
            },
            kiosk: {
                enabled:
                    typeof surfaces?.kiosk?.enabled === 'boolean'
                        ? surfaces.kiosk.enabled
                        : true,
                label: toString(
                    surfaces?.kiosk?.label,
                    toString(
                        runtimeKiosk.catalogTitle,
                        FALLBACK_PROFILE.surfaces.kiosk.label
                    )
                ),
                route: toString(
                    surfaces?.kiosk?.route,
                    toString(
                        runtimeKiosk.webFallbackUrl,
                        FALLBACK_PROFILE.surfaces.kiosk.route
                    )
                ),
            },
            display: {
                enabled:
                    typeof surfaces?.display?.enabled === 'boolean'
                        ? surfaces.display.enabled
                        : true,
                label: toString(
                    surfaces?.display?.label,
                    toString(
                        runtimeDisplay.catalogTitle,
                        FALLBACK_PROFILE.surfaces.display.label
                    )
                ),
                route: toString(
                    surfaces?.display?.route,
                    toString(
                        runtimeDisplay.webFallbackUrl,
                        FALLBACK_PROFILE.surfaces.display.route
                    )
                ),
            },
        },
        release: {
            mode: toString(release.mode, FALLBACK_PROFILE.release.mode),
            admin_mode_default:
                toString(
                    release.admin_mode_default,
                    FALLBACK_PROFILE.release.admin_mode_default
                ) === 'expert'
                    ? 'expert'
                    : 'basic',
            separate_deploy:
                typeof release.separate_deploy === 'boolean'
                    ? release.separate_deploy
                    : true,
            native_apps_blocking:
                typeof release.native_apps_blocking === 'boolean'
                    ? release.native_apps_blocking
                    : false,
            notes: Array.isArray(release.notes)
                ? release.notes.map((note) => toString(note)).filter(Boolean)
                : [],
        },
    };
}

export function getTurneroClinicBrandName(profile) {
    return toString(profile?.branding?.name, FALLBACK_PROFILE.branding.name);
}

export function getTurneroClinicShortName(profile) {
    return toString(
        profile?.branding?.short_name,
        getTurneroClinicBrandName(profile)
    );
}

export function getTurneroConsultorioLabel(profile, consultorio, options = {}) {
    const short = Boolean(options.short);
    const key = Number(consultorio || 0) === 2 ? 'c2' : 'c1';
    const fallback = FALLBACK_PROFILE.consultorios[key];
    const source =
        profile?.consultorios && typeof profile.consultorios === 'object'
            ? profile.consultorios[key]
            : null;
    return short
        ? toString(source?.short_label, fallback.short_label)
        : toString(source?.label, fallback.label);
}

export function loadTurneroClinicProfile() {
    if (clinicProfilePromise) {
        return clinicProfilePromise;
    }

    clinicProfilePromise = fetch('/content/turnero/clinic-profile.json', {
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
        },
    })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`clinic_profile_http_${response.status}`);
            }
            return response.json();
        })
        .then((payload) => normalizeTurneroClinicProfile(payload))
        .catch(() => normalizeTurneroClinicProfile(FALLBACK_PROFILE));

    return clinicProfilePromise;
}
