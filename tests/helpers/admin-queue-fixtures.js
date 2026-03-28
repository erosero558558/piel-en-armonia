// @ts-check
const { expect } = require('@playwright/test');
const {
    buildAdminDataPayload,
    installBasicAdminApiMocks,
} = require('./admin-api-mocks');
const { installLegacyAdminAuthMock } = require('./admin-auth-mocks');
const {
    buildEvidenceSnapshot,
    buildPilotReadiness,
    buildRemoteReadiness,
    buildShellDrift,
} = require('../../tests-node/turnero-release-test-fixtures.js');

function json(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

const ADMIN_UI_VARIANT = 'sony_v3';

function adminUrl(query = '') {
    const params = new URLSearchParams(String(query || ''));
    const search = params.toString();
    return `/admin.html${search ? `?${search}` : ''}`;
}

async function expectFlowOsRecoveryHostFrozen(locator) {
    await expect(locator).toHaveAttribute(
        'data-flow-os-recovery-frozen',
        'true'
    );
    await expect(locator).toHaveAttribute(
        'data-flow-os-recovery-note',
        /Recovery cycle 2026-03-21 -> 2026-04-20/i
    );
    const frozenState = await locator.evaluate((element) => ({
        childElementCount: element.childElementCount,
        textContent: String(element.textContent || '').trim(),
    }));
    expect(frozenState.childElementCount).toBe(0);
    expect(frozenState.textContent).toBe('');
}

function installQueueAdminAuthMock(page, csrfToken) {
    return installLegacyAdminAuthMock(page, { csrfToken });
}

function buildQueueMetaFromState(state) {
    const byConsultorio = { 1: null, 2: null };
    for (const ticket of state.callingNow || []) {
        const room = String(ticket.assignedConsultorio || '');
        if (room === '1' || room === '2') {
            byConsultorio[room] = ticket;
        }
    }
    return {
        updatedAt: state.updatedAt,
        waitingCount: state.waitingCount,
        calledCount: state.calledCount,
        estimatedWaitMin: state.estimatedWaitMin || 0,
        delayReason: state.delayReason || '',
        assistancePendingCount: state.assistancePendingCount || 0,
        activeHelpRequests: state.activeHelpRequests || [],
        recentResolvedHelpRequests: state.recentResolvedHelpRequests || [],
        counts: state.counts || {},
        callingNowByConsultorio: byConsultorio,
        nextTickets: state.nextTickets || [],
    };
}

function buildTurneroClinicProfileCatalogStatus(options = {}) {
    const clinicId = String(options.clinicId || '').trim();
    const matchingProfileId =
        options.matchingProfileId === undefined
            ? clinicId
            : String(options.matchingProfileId || '').trim();
    const catalogAvailable = options.catalogAvailable !== false;
    const catalogCount = Number(
        options.catalogCount === undefined ? 2 : options.catalogCount
    );
    const matchesCatalog = options.matchesCatalog !== false;

    return {
        catalogAvailable,
        catalogCount,
        activePath: '/content/turnero/clinic-profile.json',
        clinicId,
        matchingProfileId,
        matchingCatalogPath: matchingProfileId
            ? `/content/turnero/clinic-profiles/${matchingProfileId}.json`
            : '',
        matchesCatalog,
        ready: Boolean(catalogAvailable && matchingProfileId && matchesCatalog),
    };
}

function buildQueueIdleState(updatedAt, overrides = {}) {
    return {
        updatedAt: updatedAt || new Date().toISOString(),
        waitingCount: 0,
        calledCount: 0,
        counts: {
            waiting: 0,
            called: 0,
            completed: 0,
            no_show: 0,
            cancelled: 0,
        },
        callingNow: [],
        nextTickets: [],
        ...overrides,
    };
}

function buildQueuePilotClinicProfile(options = {}) {
    const clinicId = String(options.clinicId || 'clinica-demo').trim();
    const surfacesOverride =
        options.surfaces && typeof options.surfaces === 'object'
            ? options.surfaces
            : {};
    const releaseOverride =
        options.release && typeof options.release === 'object'
            ? options.release
            : {};
    const brandingOverride =
        options.branding && typeof options.branding === 'object'
            ? options.branding
            : {};

    return {
        schema: 'turnero-clinic-profile/v1',
        clinic_id: clinicId,
        branding: {
            name: clinicId,
            short_name: clinicId,
            base_url: `https://${clinicId}.example`,
            ...brandingOverride,
        },
        consultorios: options.consultorios || {
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
                ...(surfacesOverride.admin || {}),
            },
            operator: {
                enabled: true,
                label: 'Operador web',
                route: '/operador-turnos.html',
                ...(surfacesOverride.operator || {}),
            },
            kiosk: {
                enabled: true,
                label: 'Kiosco web',
                route: '/kiosco-turnos.html',
                ...(surfacesOverride.kiosk || {}),
            },
            display: {
                enabled: true,
                label: 'Sala web',
                route: '/sala-turnos.html',
                ...(surfacesOverride.display || {}),
            },
        },
        release: {
            mode: 'suite_v2',
            admin_mode_default: 'basic',
            separate_deploy: true,
            native_apps_blocking: true,
            ...releaseOverride,
        },
    };
}

function hashClinicProfileSource(input) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildQueuePilotProfileFingerprint(profile) {
    if (!profile || typeof profile !== 'object') {
        return '';
    }

    const source = [
        String(profile?.clinic_id || '').trim(),
        String(profile?.branding?.base_url || '').trim(),
        String(profile?.consultorios?.c1?.label || '').trim(),
        String(profile?.consultorios?.c1?.short_label || '').trim(),
        String(profile?.consultorios?.c2?.label || '').trim(),
        String(profile?.consultorios?.c2?.short_label || '').trim(),
        profile?.surfaces?.admin?.enabled ? '1' : '0',
        String(profile?.surfaces?.admin?.route || '').trim(),
        profile?.surfaces?.operator?.enabled ? '1' : '0',
        String(profile?.surfaces?.operator?.route || '').trim(),
        profile?.surfaces?.kiosk?.enabled ? '1' : '0',
        String(profile?.surfaces?.kiosk?.route || '').trim(),
        profile?.surfaces?.display?.enabled ? '1' : '0',
        String(profile?.surfaces?.display?.route || '').trim(),
        String(profile?.release?.mode || '').trim(),
        String(profile?.release?.admin_mode_default || '').trim(),
        profile?.release?.separate_deploy ? '1' : '0',
        profile?.release?.native_apps_blocking ? '1' : '0',
    ].join('|');

    return source ? hashClinicProfileSource(source) : '';
}

function buildQueuePilotSurfaceStatusEntry(surface, options = {}) {
    const defaultsBySurface = {
        operator: {
            label: 'Operador',
            summary: 'Operador listo.',
            route: '/operador-turnos.html',
            deviceLabel: 'Operador principal',
        },
        kiosk: {
            label: 'Kiosco',
            summary: 'Kiosco listo.',
            route: '/kiosco-turnos.html',
            deviceLabel: 'Kiosco principal',
        },
        display: {
            label: 'Sala',
            summary: 'Sala lista.',
            route: '/sala-turnos.html',
            deviceLabel: 'Sala principal',
        },
    };

    const defaults = defaultsBySurface[surface];
    const {
        clinicId = '',
        ageSec = surface === 'operator' ? 6 : surface === 'kiosk' ? 7 : 8,
        latest: latestOverride = {},
        details: detailsOverride = {},
        instances = [],
        ...rest
    } = options;
    const latestDetailsOverride =
        latestOverride.details && typeof latestOverride.details === 'object'
            ? latestOverride.details
            : {};

    return {
        surface,
        label: defaults.label,
        status: 'ready',
        updatedAt: options.updatedAt || new Date().toISOString(),
        ageSec,
        stale: false,
        summary: defaults.summary,
        latest: {
            deviceLabel: defaults.deviceLabel,
            appMode: 'browser',
            ageSec,
            ...latestOverride,
            details: {
                clinicId,
                surfaceContractState: 'ready',
                surfaceRouteExpected: defaults.route,
                surfaceRouteCurrent: defaults.route,
                ...detailsOverride,
                ...latestDetailsOverride,
            },
        },
        instances,
        ...rest,
    };
}

function buildQueuePilotSurfaceStatus(options = {}) {
    const updatedAt = options.updatedAt || new Date().toISOString();
    return {
        operator: buildQueuePilotSurfaceStatusEntry('operator', {
            updatedAt,
            clinicId: options.clinicId || '',
            ...(options.operator || {}),
        }),
        kiosk: buildQueuePilotSurfaceStatusEntry('kiosk', {
            updatedAt,
            clinicId: options.clinicId || '',
            ...(options.kiosk || {}),
        }),
        display: buildQueuePilotSurfaceStatusEntry('display', {
            updatedAt,
            clinicId: options.clinicId || '',
            ...(options.display || {}),
        }),
    };
}

function buildQueuePilotHealthPayload(options = {}) {
    const checksOverride =
        options.checks && typeof options.checks === 'object'
            ? options.checks
            : {};
    const publicSyncOverride =
        options.publicSync && typeof options.publicSync === 'object'
            ? options.publicSync
            : {};

    return {
        ok: true,
        status: 'ok',
        checks: {
            publicSync: {
                configured: true,
                healthy: true,
                state: 'ok',
                deployedCommit: '8c4ee5cb7f2f5034f6f471234567890abcdef12',
                headDrift: false,
                ageSeconds: 18,
                failureReason: '',
                ...publicSyncOverride,
            },
            ...checksOverride,
        },
    };
}

function buildQueuePilotHealthDiagnosticsPayload(options = {}) {
    const publicSyncOverride =
        options.publicSync && typeof options.publicSync === 'object'
            ? options.publicSync
            : {};
    const turneroPilotOverride =
        options.turneroPilot && typeof options.turneroPilot === 'object'
            ? options.turneroPilot
            : {};
    const checksOverride =
        options.checks && typeof options.checks === 'object'
            ? options.checks
            : {};

    return {
        ok: true,
        status: 'ok',
        figoConfigured:
            options.figoConfigured === undefined
                ? true
                : options.figoConfigured === true,
        figoRecursiveConfig:
            options.figoRecursiveConfig === undefined
                ? false
                : options.figoRecursiveConfig === true,
        calendarConfigured:
            options.calendarConfigured === undefined
                ? true
                : options.calendarConfigured === true,
        calendarReachable:
            options.calendarReachable === undefined
                ? true
                : options.calendarReachable === true,
        calendarRequirementMet:
            options.calendarRequirementMet === undefined
                ? true
                : options.calendarRequirementMet === true,
        calendarMode: options.calendarMode || 'google',
        calendarSource: options.calendarSource || 'primary',
        checks: {
            publicSync: {
                configured: true,
                healthy: true,
                operationallyHealthy: true,
                repoHygieneIssue: false,
                state: 'ok',
                deployedCommit: '8c4ee5cb7f2f5034f6f471234567890abcdef12',
                headDrift: false,
                ageSeconds: 18,
                expectedMaxLagSeconds: 120,
                failureReason: '',
                ...publicSyncOverride,
            },
            turneroPilot: {
                available: true,
                configured: true,
                ready: true,
                profileSource: 'file',
                clinicId: String(options.clinicId || '').trim(),
                profileFingerprint: String(
                    options.profileFingerprint || ''
                ).trim(),
                catalogAvailable: true,
                catalogMatched: true,
                catalogReady: true,
                releaseMode: 'suite_v2',
                adminModeDefault: 'basic',
                separateDeploy: true,
                nativeAppsBlocking: true,
                ...turneroPilotOverride,
            },
            ...checksOverride,
        },
    };
}

function buildQueuePilotBookedSlotsPayload(options = {}) {
    const bookedSlots =
        Array.isArray(options.bookedSlots) || Array.isArray(options.data)
            ? options.bookedSlots || options.data || []
            : [];
    const metaOverride =
        options.meta && typeof options.meta === 'object' ? options.meta : {};

    return {
        ok: true,
        data: bookedSlots,
        meta: {
            source: 'store',
            mode: 'live',
            generatedAt: new Date().toISOString(),
            degraded: false,
            ...metaOverride,
        },
    };
}

function buildQueueStateFromTickets(queueTickets) {
    const waiting = queueTickets.filter(
        (ticket) => ticket.status === 'waiting'
    );
    const called = queueTickets.filter((ticket) => ticket.status === 'called');

    const callingNowByConsultorio = new Map();
    for (const ticket of called) {
        const room = Number(ticket.assignedConsultorio || 0);
        if ((room === 1 || room === 2) && !callingNowByConsultorio.has(room)) {
            callingNowByConsultorio.set(room, {
                id: ticket.id,
                ticketCode: ticket.ticketCode,
                patientInitials: ticket.patientInitials,
                assignedConsultorio: room,
                calledAt: ticket.calledAt || new Date().toISOString(),
            });
        }
    }

    return {
        updatedAt: new Date().toISOString(),
        waitingCount: waiting.length,
        calledCount: called.length,
        counts: {
            waiting: waiting.length,
            called: called.length,
            completed: queueTickets.filter(
                (ticket) => ticket.status === 'completed'
            ).length,
            no_show: queueTickets.filter(
                (ticket) => ticket.status === 'no_show'
            ).length,
            cancelled: queueTickets.filter(
                (ticket) => ticket.status === 'cancelled'
            ).length,
        },
        callingNow: Array.from(callingNowByConsultorio.values()),
        nextTickets: waiting.map((ticket, index) => ({
            id: ticket.id,
            ticketCode: ticket.ticketCode,
            patientInitials: ticket.patientInitials,
            position: index + 1,
        })),
    };
}

function buildQueueOperationalSurfaceStatusEntry(surface, options = {}) {
    const labels = {
        operator: 'Operador',
        kiosk: 'Kiosco',
        display: 'Sala TV',
    };

    return {
        surface,
        label: labels[surface] || surface,
        status: 'unknown',
        updatedAt: '',
        ageSec: 0,
        stale: true,
        summary: 'Sin heartbeat',
        latest: null,
        instances: [],
        ...options,
    };
}

function buildQueueUnknownOperationalSurfaceStatus(surface, options = {}) {
    return buildQueueOperationalSurfaceStatusEntry(surface, {
        status: 'unknown',
        updatedAt: '',
        ageSec: 0,
        stale: true,
        summary: 'Sin heartbeat',
        latest: null,
        instances: [],
        ...options,
    });
}

function buildQueueDesktopOperatorInstance(options = {}) {
    const detailsOverride =
        options.details && typeof options.details === 'object'
            ? options.details
            : {};
    const station = String(
        detailsOverride.station || options.station || 'c1'
    ).toLowerCase();
    const ageSec = Number(options.ageSec === undefined ? 4 : options.ageSec);
    const stationLabel = station.toUpperCase();
    const oneTap =
        detailsOverride.oneTap !== undefined
            ? Boolean(detailsOverride.oneTap)
            : Boolean(options.oneTap);

    return {
        deviceLabel: options.deviceLabel || `Operador ${stationLabel} fijo`,
        appMode: 'desktop',
        ageSec,
        stale: false,
        effectiveStatus: options.effectiveStatus || 'ready',
        summary:
            options.summary ||
            `Equipo listo para operar en ${stationLabel} fijo.`,
        details: {
            station,
            stationMode: 'locked',
            oneTap,
            numpadSeen: true,
            numpadReady: true,
            numpadProgress: 4,
            numpadRequired: 4,
            numpadLabel: 'Numpad listo',
            numpadSummary: 'Numpad listo · Numpad Enter, +, ., -',
            shellPackaged: true,
            shellPlatform: 'win32',
            shellUpdateChannel: 'stable',
            ...detailsOverride,
        },
    };
}

function buildQueueDesktopOperatorSurfaceStatus(options = {}) {
    const instances = Array.isArray(options.instances) ? options.instances : [];
    const latest =
        options.latest === undefined
            ? instances[0] || null
            : options.latest || null;
    const updatedAt =
        String(options.updatedAt || latest?.updatedAt || '').trim() ||
        new Date().toISOString();

    return buildQueueOperationalSurfaceStatusEntry('operator', {
        status: latest ? 'ready' : 'unknown',
        updatedAt,
        ageSec: latest ? latest.ageSec || 0 : 0,
        stale: false,
        summary: latest ? latest.summary || '' : 'Sin heartbeat',
        latest,
        instances,
        ...options,
    });
}

function buildQueueOperationalAppsSurfaceStatus(options = {}) {
    return {
        operator:
            options.operator ||
            buildQueueUnknownOperationalSurfaceStatus('operator'),
        kiosk:
            options.kiosk || buildQueueUnknownOperationalSurfaceStatus('kiosk'),
        display:
            options.display ||
            buildQueueUnknownOperationalSurfaceStatus('display'),
    };
}

function resolveAdminQueueFixture(value) {
    return typeof value === 'function' ? value() : value;
}

async function installAdminQueueApiMocks(page, options = {}) {
    const {
        appointments = [],
        callbacks = [],
        reviews = [],
        availability = {},
        availabilityMeta = {},
        dataOverrides = {},
        queueTickets = [],
        queueState = {},
        featuresPayload = {
            data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
        },
        healthPayload = { ok: true, status: 'ok' },
        funnelMetrics = {},
        defaultPayload = {},
        handleRoute = null,
    } = options;

    const getQueueState = () => resolveAdminQueueFixture(queueState);
    const getQueueTickets = () => resolveAdminQueueFixture(queueTickets);
    const getDataOverrides = () => resolveAdminQueueFixture(dataOverrides);

    return installBasicAdminApiMocks(page, {
        featuresPayload,
        healthPayload,
        funnelMetrics,
        defaultPayload,
        handleRoute: async (context) => {
            if (typeof handleRoute === 'function') {
                const handled = await handleRoute({
                    ...context,
                    getQueueState,
                    getQueueTickets,
                });
                if (handled) {
                    return true;
                }
            }

            if (context.resource === 'data') {
                await context.fulfillJson(context.route, {
                    ok: true,
                    data: buildAdminDataPayload({
                        appointments: resolveAdminQueueFixture(appointments),
                        callbacks: resolveAdminQueueFixture(callbacks),
                        reviews: resolveAdminQueueFixture(reviews),
                        availability: resolveAdminQueueFixture(availability),
                        availabilityMeta: {
                            generatedAt:
                                String(
                                    getQueueState()?.updatedAt || ''
                                ).trim() || new Date().toISOString(),
                            ...availabilityMeta,
                        },
                        queue_tickets: getQueueTickets(),
                        queueMeta: buildQueueMetaFromState(getQueueState()),
                        ...((getDataOverrides() &&
                            typeof getDataOverrides() === 'object' &&
                            getDataOverrides()) ||
                            {}),
                    }),
                });
                return true;
            }

            if (context.resource === 'queue-state') {
                await context.fulfillJson(context.route, {
                    ok: true,
                    data: getQueueState(),
                });
                return true;
            }

            return false;
        },
    });
}

async function installQueuePilotApiMocks(page, options = {}) {
    const clinicProfile = options.clinicProfile || null;
    const updatedAt =
        String(
            options.queueState?.updatedAt ||
                options.clinicProfileMeta?.fetchedAt ||
                ''
        ).trim() || new Date().toISOString();
    const queueState = options.queueState || buildQueueIdleState(updatedAt);
    const queueTickets = options.queueTickets || [];
    const clinicId =
        String(
            options.clinicId ||
                clinicProfile?.clinic_id ||
                options.clinicProfileMeta?.clinicId ||
                ''
        ).trim() || '';
    const profileFingerprint = String(
        options.profileFingerprint ||
            options.clinicProfileMeta?.profileFingerprint ||
            buildQueuePilotProfileFingerprint(clinicProfile)
    ).trim();
    const clinicProfileCatalogStatus =
        options.clinicProfileCatalogStatus === undefined
            ? clinicId
                ? buildTurneroClinicProfileCatalogStatus({ clinicId })
                : null
            : options.clinicProfileCatalogStatus;
    const healthPayload =
        options.healthPayload || buildQueuePilotHealthPayload();
    const healthDiagnosticsPayload =
        options.healthDiagnosticsPayload ||
        buildQueuePilotHealthDiagnosticsPayload({
            clinicId,
            profileFingerprint,
            publicSync:
                healthPayload?.checks?.publicSync &&
                typeof healthPayload.checks.publicSync === 'object'
                    ? healthPayload.checks.publicSync
                    : {},
            turneroPilot:
                healthPayload?.checks?.turneroPilot &&
                typeof healthPayload.checks.turneroPilot === 'object'
                    ? healthPayload.checks.turneroPilot
                    : {},
            figoConfigured: options.figoConfigured,
            figoRecursiveConfig: options.figoRecursiveConfig,
            calendarConfigured: options.calendarConfigured,
            calendarReachable: options.calendarReachable,
            calendarRequirementMet: options.calendarRequirementMet,
            calendarMode: options.calendarMode,
            calendarSource: options.calendarSource,
        });
    const bookedSlotsPayload =
        options.bookedSlotsPayload ||
        buildQueuePilotBookedSlotsPayload({
            bookedSlots: options.bookedSlots,
            meta: options.bookedSlotsMeta,
        });

    return installAdminQueueApiMocks(page, {
        queueTickets,
        queueState,
        healthPayload,
        availability: options.availability || {},
        availabilityMeta: options.availabilityMeta || {},
        dataOverrides: {
            ...(clinicProfile ? { turneroClinicProfile: clinicProfile } : {}),
            ...(options.clinicProfileMeta
                ? { turneroClinicProfileMeta: options.clinicProfileMeta }
                : {}),
            ...(clinicProfileCatalogStatus
                ? {
                      turneroClinicProfileCatalogStatus:
                          clinicProfileCatalogStatus,
                  }
                : {}),
            ...(options.queueSurfaceStatus
                ? { queueSurfaceStatus: options.queueSurfaceStatus }
                : {}),
        },
        handleRoute: async (context) => {
            if (typeof options.handleRoute === 'function') {
                const handled = await options.handleRoute(context);
                if (handled) {
                    return true;
                }
            }

            if (context.resource === 'health-diagnostics') {
                await context.fulfillJson(
                    context.route,
                    healthDiagnosticsPayload
                );
                return true;
            }

            if (context.resource === 'booked-slots') {
                await context.fulfillJson(context.route, bookedSlotsPayload);
                return true;
            }

            return false;
        },
    });
}

async function installQueueOperationalAppsApiMocks(page, options = {}) {
    const updatedAt =
        String(options.updatedAt || '').trim() || new Date().toISOString();
    const queueStateFixture =
        options.queueState || buildQueueIdleState(updatedAt);

    return installAdminQueueApiMocks(page, {
        queueState: queueStateFixture,
        healthPayload: options.healthPayload || { ok: true, status: 'ok' },
        funnelMetrics: options.funnelMetrics || {},
        dataOverrides: () => {
            const extraDataOverrides = resolveAdminQueueFixture(
                options.dataOverrides
            );
            const queueSurfaceStatus =
                resolveAdminQueueFixture(options.queueSurfaceStatus) ||
                buildQueueOperationalAppsSurfaceStatus();

            return {
                queueSurfaceStatus,
                ...((extraDataOverrides &&
                    typeof extraDataOverrides === 'object' &&
                    extraDataOverrides) ||
                    {}),
            };
        },
        handleRoute: options.handleRoute || null,
    });
}

function getTodayLocalIsoDateForTest() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function openQueuePilotDetailGroup(page, groupId) {
    const locator = page.locator(`#${groupId}`);
    await expect(locator).toBeVisible();
    await expect
        .poll(() =>
            locator.evaluate((element) => {
                if (element instanceof HTMLDetailsElement) {
                    element.open = true;
                    return element.open;
                }
                return false;
            })
        )
        .toBe(true);
}

module.exports = {
    ADMIN_UI_VARIANT,
    json,
    adminUrl,
    expectFlowOsRecoveryHostFrozen,
    installQueueAdminAuthMock,
    buildQueueMetaFromState,
    buildTurneroClinicProfileCatalogStatus,
    buildQueueIdleState,
    buildQueuePilotClinicProfile,
    hashClinicProfileSource,
    buildQueuePilotProfileFingerprint,
    buildQueuePilotSurfaceStatusEntry,
    buildQueuePilotSurfaceStatus,
    buildQueuePilotHealthPayload,
    buildQueuePilotHealthDiagnosticsPayload,
    buildQueuePilotBookedSlotsPayload,
    buildQueueStateFromTickets,
    buildQueueOperationalSurfaceStatusEntry,
    buildQueueUnknownOperationalSurfaceStatus,
    buildQueueDesktopOperatorInstance,
    buildQueueDesktopOperatorSurfaceStatus,
    buildQueueOperationalAppsSurfaceStatus,
    resolveAdminQueueFixture,
    installAdminQueueApiMocks,
    installQueuePilotApiMocks,
    installQueueOperationalAppsApiMocks,
    getTodayLocalIsoDateForTest,
    openQueuePilotDetailGroup,
};
