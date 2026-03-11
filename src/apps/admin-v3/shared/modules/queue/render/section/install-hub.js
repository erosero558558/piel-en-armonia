import { getState } from '../../../../core/store.js';
import {
    createToast,
    escapeHtml,
    formatDateTime,
    setHtml,
    setText,
} from '../../../../ui/render.js';
import {
    getActiveCalledTicketForStation,
    getCalledTicketForConsultorio,
    getQueueTicketById,
    getQueueSource,
    getWaitingForConsultorio,
} from '../../selectors.js';

const DEFAULT_APP_DOWNLOADS = Object.freeze({
    operator: {
        version: '0.1.0',
        updatedAt: '2026-03-10T00:00:00Z',
        webFallbackUrl: '/operador-turnos.html',
        guideUrl: '/app-downloads/?surface=operator',
        targets: {
            win: {
                url: '/app-downloads/stable/operator/win/TurneroOperadorSetup.exe',
                label: 'Windows',
            },
            mac: {
                url: '/app-downloads/stable/operator/mac/TurneroOperador.dmg',
                label: 'macOS',
            },
        },
    },
    kiosk: {
        version: '0.1.0',
        updatedAt: '2026-03-10T00:00:00Z',
        webFallbackUrl: '/kiosco-turnos.html',
        guideUrl: '/app-downloads/?surface=kiosk',
        targets: {
            win: {
                url: '/app-downloads/stable/kiosk/win/TurneroKioscoSetup.exe',
                label: 'Windows',
            },
            mac: {
                url: '/app-downloads/stable/kiosk/mac/TurneroKiosco.dmg',
                label: 'macOS',
            },
        },
    },
    sala_tv: {
        version: '0.1.0',
        updatedAt: '2026-03-10T00:00:00Z',
        webFallbackUrl: '/sala-turnos.html',
        guideUrl: '/app-downloads/?surface=sala_tv',
        targets: {
            android_tv: {
                url: '/app-downloads/stable/sala-tv/android/TurneroSalaTV.apk',
                label: 'Android TV APK',
            },
        },
    },
});

const APP_COPY = Object.freeze({
    operator: {
        eyebrow: 'Recepción + consultorio',
        title: 'Operador',
        description:
            'Superficie diaria para llamar, re-llamar, completar y operar con el Genius Numpad 1000.',
        recommendedFor: 'PC operador',
        notes: [
            'Conecta aquí el receptor USB 2.4 GHz del numpad.',
            'La app desktop ahora puede quedar configurada como C1, C2 o modo libre desde el primer arranque.',
        ],
    },
    kiosk: {
        eyebrow: 'Recepción de pacientes',
        title: 'Kiosco',
        description:
            'Instalador dedicado para check-in, generación de ticket y operación simple en mostrador.',
        recommendedFor: 'PC o mini PC de kiosco',
        notes: [
            'Mantén el equipo en fullscreen y con impresora térmica conectada.',
            'La versión web sigue disponible como respaldo inmediato.',
        ],
    },
    sala_tv: {
        eyebrow: 'Pantalla de sala',
        title: 'Sala TV',
        description:
            'APK para Android TV en la TCL C655 con WebView controlado, reconexión y campanilla.',
        recommendedFor: 'TCL C655 / Google TV',
        notes: [
            'Instala en la TV y prioriza Ethernet sobre Wi-Fi.',
            'Usa el QR desde otra pantalla para simplificar la instalación del APK.',
        ],
    },
});

const SURFACE_TELEMETRY_COPY = Object.freeze({
    operator: {
        title: 'Operador',
        emptySummary:
            'Todavía no hay señal del equipo operador. Abre la app o el fallback web para registrar heartbeat.',
    },
    kiosk: {
        title: 'Kiosco',
        emptySummary:
            'Todavía no hay señal del kiosco. Abre el equipo o el fallback web antes de dejar autoservicio.',
    },
    display: {
        title: 'Sala TV',
        emptySummary:
            'Todavía no hay señal de la TV de sala. Abre la app Android TV o el fallback web para registrar estado.',
    },
});

const QUEUE_INSTALL_PRESET_STORAGE_KEY = 'queueInstallPresetV1';
const QUEUE_OPENING_CHECKLIST_STORAGE_KEY = 'queueOpeningChecklistV1';
const QUEUE_SHIFT_HANDOFF_STORAGE_KEY = 'queueShiftHandoffV1';
const QUEUE_OPS_LOG_STORAGE_KEY = 'queueOpsLogV1';
const QUEUE_OPS_LOG_FILTER_STORAGE_KEY = 'queueOpsLogFilterV1';
const QUEUE_OPS_ALERTS_STORAGE_KEY = 'queueOpsAlertsV1';
const QUEUE_OPS_FOCUS_MODE_STORAGE_KEY = 'queueOpsFocusModeV1';
const QUEUE_OPS_PLAYBOOK_STORAGE_KEY = 'queueOpsPlaybookV1';
const QUEUE_OPS_LOG_MAX_ITEMS = 24;
const QUEUE_OPS_INTERACTION_HOLD_MS = 900;
const OPENING_CHECKLIST_STEP_IDS = Object.freeze([
    'operator_ready',
    'kiosk_ready',
    'sala_ready',
    'smoke_ready',
]);
const SHIFT_HANDOFF_STEP_IDS = Object.freeze([
    'queue_clear',
    'operator_handoff',
    'kiosk_handoff',
    'sala_handoff',
]);

let installPreset = null;
let openingChecklistState = null;
let shiftHandoffState = null;
let opsLogState = null;
let opsLogFilter = null;
let opsAlertsState = null;
let opsFocusMode = null;
let opsPlaybookState = null;
let queueOpsInteraction = {
    lastAt: 0,
    timerId: 0,
    settleTimerId: 0,
    pendingManifest: null,
    pendingPlatform: '',
};

function detectPlatform() {
    const platform =
        `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
    if (platform.includes('mac')) return 'mac';
    if (platform.includes('win')) return 'win';
    return 'other';
}

function getQueueAppsHubRoot() {
    const root = document.getElementById('queueAppsHub');
    return root instanceof HTMLElement ? root : null;
}

function getQueueAppsRefreshShieldChip() {
    const chip = document.getElementById('queueAppsRefreshShieldChip');
    return chip instanceof HTMLElement ? chip : null;
}

function resolveQueueOpsInteractionMeta() {
    if (queueOpsInteraction.pendingManifest) {
        return {
            state: 'deferred',
            label: 'Refresh en espera',
            detail: 'Se mantiene el hub estable hasta que termine la interacción actual.',
        };
    }
    if (hasActiveQueueOpsInteraction()) {
        return {
            state: 'active',
            label: 'Protegiendo interacción',
            detail: 'El hub aplaza repaints breves mientras estás usando sus controles.',
        };
    }
    return {
        state: 'idle',
        label: 'Refresh sin bloqueo',
        detail: 'El hub puede repintarse cuando llegue información nueva.',
    };
}

function syncQueueOpsInteractionIndicator() {
    const meta = resolveQueueOpsInteractionMeta();
    const root = getQueueAppsHubRoot();
    const chip = getQueueAppsRefreshShieldChip();
    if (root) {
        root.dataset.queueInteractionState = meta.state;
    }
    if (chip) {
        chip.dataset.state = meta.state;
        chip.textContent = meta.label;
        chip.title = meta.detail;
        chip.setAttribute('aria-label', meta.detail);
    }
}

function clearQueueOpsInteractionSettleTimer() {
    if (queueOpsInteraction.settleTimerId) {
        window.clearTimeout(queueOpsInteraction.settleTimerId);
        queueOpsInteraction.settleTimerId = 0;
    }
}

function scheduleQueueOpsInteractionSettle() {
    clearQueueOpsInteractionSettleTimer();
    if (queueOpsInteraction.pendingManifest) {
        syncQueueOpsInteractionIndicator();
        return;
    }
    if (!hasActiveQueueOpsInteraction()) {
        syncQueueOpsInteractionIndicator();
        return;
    }
    const waitMs = Math.max(
        80,
        QUEUE_OPS_INTERACTION_HOLD_MS - getQueueOpsInteractionAgeMs()
    );
    queueOpsInteraction.settleTimerId = window.setTimeout(() => {
        queueOpsInteraction.settleTimerId = 0;
        if (queueOpsInteraction.pendingManifest) {
            syncQueueOpsInteractionIndicator();
            return;
        }
        if (hasActiveQueueOpsInteraction()) {
            scheduleQueueOpsInteractionSettle();
            return;
        }
        syncQueueOpsInteractionIndicator();
    }, waitMs);
}

function markQueueOpsInteraction() {
    queueOpsInteraction.lastAt = Date.now();
    syncQueueOpsInteractionIndicator();
    scheduleQueueOpsInteractionSettle();
}

function getQueueOpsInteractionAgeMs() {
    if (!queueOpsInteraction.lastAt) {
        return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, Date.now() - queueOpsInteraction.lastAt);
}

function hasActiveQueueOpsInteraction() {
    return getQueueOpsInteractionAgeMs() < QUEUE_OPS_INTERACTION_HOLD_MS;
}

function bindQueueOpsInteraction(root) {
    if (
        !(root instanceof HTMLElement) ||
        root.dataset.queueInteractionBound === 'true'
    ) {
        return;
    }

    const signalInteraction = () => {
        markQueueOpsInteraction();
    };

    root.addEventListener('pointerdown', signalInteraction, true);
    root.addEventListener('keydown', signalInteraction, true);
    root.addEventListener('focusin', signalInteraction, true);
    root.addEventListener('input', signalInteraction, true);
    root.addEventListener('change', signalInteraction, true);
    root.dataset.queueInteractionBound = 'true';
}

function clearDeferredQueueOpsInteraction() {
    if (queueOpsInteraction.timerId) {
        window.clearTimeout(queueOpsInteraction.timerId);
        queueOpsInteraction.timerId = 0;
    }
    queueOpsInteraction.pendingManifest = null;
    queueOpsInteraction.pendingPlatform = '';
    syncQueueOpsInteractionIndicator();
    scheduleQueueOpsInteractionSettle();
}

function flushDeferredQueueOpsHubRender() {
    const manifest = queueOpsInteraction.pendingManifest;
    const platform = queueOpsInteraction.pendingPlatform;
    queueOpsInteraction.timerId = 0;
    if (!manifest) {
        clearDeferredQueueOpsInteraction();
        return;
    }
    if (hasActiveQueueOpsInteraction()) {
        scheduleDeferredQueueOpsHubRender(manifest, platform);
        return;
    }
    renderQueueInstallHub({
        allowDuringInteraction: true,
        manifestOverride: manifest,
        platformOverride: platform,
    });
}

function scheduleDeferredQueueOpsHubRender(manifest, detectedPlatform) {
    queueOpsInteraction.pendingManifest = manifest;
    queueOpsInteraction.pendingPlatform = detectedPlatform;
    if (queueOpsInteraction.timerId) {
        window.clearTimeout(queueOpsInteraction.timerId);
    }
    clearQueueOpsInteractionSettleTimer();
    syncQueueOpsInteractionIndicator();
    const waitMs = Math.max(
        80,
        QUEUE_OPS_INTERACTION_HOLD_MS - getQueueOpsInteractionAgeMs()
    );
    queueOpsInteraction.timerId = window.setTimeout(() => {
        flushDeferredQueueOpsHubRender();
    }, waitMs);
}

function absoluteUrl(url) {
    try {
        return new URL(String(url || ''), window.location.origin).toString();
    } catch (_error) {
        return String(url || '');
    }
}

function buildQrUrl(url) {
    const encoded = encodeURIComponent(absoluteUrl(url));
    return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encoded}`;
}

function buildGuideUrl(surfaceKey, preset, appConfig) {
    const base = new URL(
        String(appConfig.guideUrl || `/app-downloads/?surface=${surfaceKey}`),
        `${window.location.origin}/`
    );
    base.searchParams.set('surface', surfaceKey);
    if (surfaceKey === 'sala_tv') {
        base.searchParams.set('platform', 'android_tv');
    } else {
        base.searchParams.set(
            'platform',
            preset.platform === 'mac' ? 'mac' : 'win'
        );
    }
    if (surfaceKey === 'operator') {
        base.searchParams.set('station', preset.station === 'c2' ? 'c2' : 'c1');
        base.searchParams.set('lock', preset.lock ? '1' : '0');
        base.searchParams.set('one_tap', preset.oneTap ? '1' : '0');
    } else {
        base.searchParams.delete('station');
        base.searchParams.delete('lock');
        base.searchParams.delete('one_tap');
    }
    return `${base.pathname}${base.search}`;
}

function mergeManifest() {
    const appDownloads = getState().data.appDownloads;
    if (!appDownloads || typeof appDownloads !== 'object') {
        return DEFAULT_APP_DOWNLOADS;
    }
    return {
        operator: {
            ...DEFAULT_APP_DOWNLOADS.operator,
            ...(appDownloads.operator || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.operator.targets,
                ...((appDownloads.operator && appDownloads.operator.targets) ||
                    {}),
            },
        },
        kiosk: {
            ...DEFAULT_APP_DOWNLOADS.kiosk,
            ...(appDownloads.kiosk || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.kiosk.targets,
                ...((appDownloads.kiosk && appDownloads.kiosk.targets) || {}),
            },
        },
        sala_tv: {
            ...DEFAULT_APP_DOWNLOADS.sala_tv,
            ...(appDownloads.sala_tv || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.sala_tv.targets,
                ...((appDownloads.sala_tv && appDownloads.sala_tv.targets) ||
                    {}),
            },
        },
    };
}

function normalizeInstallPreset(rawPreset, detectedPlatform) {
    const raw = rawPreset && typeof rawPreset === 'object' ? rawPreset : {};
    const platform =
        raw.platform === 'mac'
            ? 'mac'
            : detectedPlatform === 'mac'
              ? 'mac'
              : 'win';

    return {
        surface:
            raw.surface === 'kiosk' || raw.surface === 'sala_tv'
                ? raw.surface
                : 'operator',
        station: raw.station === 'c2' ? 'c2' : 'c1',
        lock: Boolean(raw.lock),
        oneTap: Boolean(raw.oneTap),
        platform,
    };
}

function loadStoredInstallPreset(detectedPlatform) {
    try {
        const rawValue = window.localStorage.getItem(
            QUEUE_INSTALL_PRESET_STORAGE_KEY
        );
        if (!rawValue) {
            return null;
        }
        return normalizeInstallPreset(JSON.parse(rawValue), detectedPlatform);
    } catch (_error) {
        return null;
    }
}

function persistInstallPreset(nextPreset, detectedPlatform) {
    installPreset = normalizeInstallPreset(nextPreset, detectedPlatform);
    try {
        window.localStorage.setItem(
            QUEUE_INSTALL_PRESET_STORAGE_KEY,
            JSON.stringify(installPreset)
        );
    } catch (_error) {
        // localStorage can be unavailable in some browser modes
    }
    return installPreset;
}

function buildDerivedInstallPreset(detectedPlatform) {
    const state = getState();
    const operator = getLatestSurfaceDetails('operator');
    const operatorStation = String(
        operator.details.station || ''
    ).toLowerCase();
    const operatorStationMode = String(operator.details.stationMode || '')
        .trim()
        .toLowerCase();
    const operatorOneTap = operator.details.oneTap;

    return normalizeInstallPreset(
        {
            surface: 'operator',
            station:
                operatorStation === 'c2'
                    ? 'c2'
                    : operatorStation === 'c1'
                      ? 'c1'
                      : Number(
                              state.queue && state.queue.stationConsultorio
                          ) === 2
                        ? 'c2'
                        : 'c1',
            lock:
                operatorStationMode === 'locked'
                    ? true
                    : operatorStationMode === 'free'
                      ? false
                      : Boolean(
                            state.queue && state.queue.stationMode === 'locked'
                        ),
            oneTap:
                typeof operatorOneTap === 'boolean'
                    ? operatorOneTap
                    : Boolean(state.queue && state.queue.oneTap),
            platform:
                detectedPlatform === 'win' || detectedPlatform === 'mac'
                    ? detectedPlatform
                    : 'win',
        },
        detectedPlatform
    );
}

function ensureInstallPreset(detectedPlatform) {
    if (installPreset) {
        return installPreset;
    }

    const storedPreset = loadStoredInstallPreset(detectedPlatform);
    if (storedPreset) {
        installPreset = storedPreset;
        return installPreset;
    }

    installPreset = buildDerivedInstallPreset(detectedPlatform);
    return installPreset;
}

function getInstallPresetLabel(detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const stationLabel = preset.station === 'c2' ? 'C2' : 'C1';
    const modeLabel = preset.lock
        ? `${stationLabel} fijo`
        : `${stationLabel} libre`;
    return `Operador ${modeLabel}${preset.oneTap ? ' · 1 tecla' : ''}`;
}

function buildInstallPresetChoices(detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    return [
        {
            id: 'operator_c1_locked',
            label: 'Operador C1',
            state:
                preset.surface === 'operator' &&
                preset.station === 'c1' &&
                preset.lock,
            nextPreset: {
                ...preset,
                surface: 'operator',
                station: 'c1',
                lock: true,
            },
        },
        {
            id: 'operator_c2_locked',
            label: 'Operador C2',
            state:
                preset.surface === 'operator' &&
                preset.station === 'c2' &&
                preset.lock,
            nextPreset: {
                ...preset,
                surface: 'operator',
                station: 'c2',
                lock: true,
            },
        },
        {
            id: 'operator_free',
            label: 'Operador libre',
            state: preset.surface === 'operator' && !preset.lock,
            nextPreset: {
                ...preset,
                surface: 'operator',
                station: preset.station === 'c2' ? 'c2' : 'c1',
                lock: false,
            },
        },
        {
            id: 'kiosk',
            label: 'Kiosco',
            state: preset.surface === 'kiosk',
            nextPreset: {
                ...preset,
                surface: 'kiosk',
            },
        },
        {
            id: 'sala_tv',
            label: 'Sala TV',
            state: preset.surface === 'sala_tv',
            nextPreset: {
                ...preset,
                surface: 'sala_tv',
            },
        },
    ];
}

function getTodayLocalIsoDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatOpeningChecklistDate(isoDate) {
    const value = String(isoDate || '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
        return value || '--';
    }
    return `${match[3]}/${match[2]}/${match[1]}`;
}

function createOpeningChecklistState(date = getTodayLocalIsoDate()) {
    return {
        date,
        steps: OPENING_CHECKLIST_STEP_IDS.reduce((acc, key) => {
            acc[key] = false;
            return acc;
        }, {}),
    };
}

function normalizeOpeningChecklistState(rawState) {
    const today = getTodayLocalIsoDate();
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    const date = String(source.date || '').trim() === today ? today : today;
    return {
        date,
        steps: OPENING_CHECKLIST_STEP_IDS.reduce((acc, key) => {
            acc[key] = Boolean(source.steps && source.steps[key]);
            return acc;
        }, {}),
    };
}

function loadOpeningChecklistState() {
    const today = getTodayLocalIsoDate();
    try {
        const raw = localStorage.getItem(QUEUE_OPENING_CHECKLIST_STORAGE_KEY);
        if (!raw) {
            return createOpeningChecklistState(today);
        }
        const parsed = JSON.parse(raw);
        if (String(parsed?.date || '') !== today) {
            return createOpeningChecklistState(today);
        }
        return normalizeOpeningChecklistState(parsed);
    } catch (_error) {
        return createOpeningChecklistState(today);
    }
}

function persistOpeningChecklistState(nextState) {
    openingChecklistState = normalizeOpeningChecklistState(nextState);
    try {
        localStorage.setItem(
            QUEUE_OPENING_CHECKLIST_STORAGE_KEY,
            JSON.stringify(openingChecklistState)
        );
    } catch (_error) {
        // ignore storage write failures
    }
    return openingChecklistState;
}

function ensureOpeningChecklistState() {
    const today = getTodayLocalIsoDate();
    if (!openingChecklistState || openingChecklistState.date !== today) {
        openingChecklistState = loadOpeningChecklistState();
    }
    return openingChecklistState;
}

function setOpeningChecklistStep(stepId, complete) {
    const current = ensureOpeningChecklistState();
    if (!OPENING_CHECKLIST_STEP_IDS.includes(stepId)) {
        return current;
    }
    return persistOpeningChecklistState({
        ...current,
        steps: {
            ...current.steps,
            [stepId]: Boolean(complete),
        },
    });
}

function resetOpeningChecklistState() {
    return persistOpeningChecklistState(
        createOpeningChecklistState(getTodayLocalIsoDate())
    );
}

function applyOpeningChecklistSuggestions(stepIds) {
    const current = ensureOpeningChecklistState();
    const validIds = (Array.isArray(stepIds) ? stepIds : []).filter((stepId) =>
        OPENING_CHECKLIST_STEP_IDS.includes(stepId)
    );
    if (!validIds.length) {
        return current;
    }

    const nextSteps = { ...current.steps };
    validIds.forEach((stepId) => {
        nextSteps[stepId] = true;
    });

    return persistOpeningChecklistState({
        ...current,
        steps: nextSteps,
    });
}

function createShiftHandoffState(date = getTodayLocalIsoDate()) {
    return {
        date,
        steps: SHIFT_HANDOFF_STEP_IDS.reduce((acc, key) => {
            acc[key] = false;
            return acc;
        }, {}),
    };
}

function normalizeShiftHandoffState(rawState) {
    const today = getTodayLocalIsoDate();
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    return {
        date: String(source.date || '').trim() === today ? today : today,
        steps: SHIFT_HANDOFF_STEP_IDS.reduce((acc, key) => {
            acc[key] = Boolean(source.steps && source.steps[key]);
            return acc;
        }, {}),
    };
}

function loadShiftHandoffState() {
    const today = getTodayLocalIsoDate();
    try {
        const raw = localStorage.getItem(QUEUE_SHIFT_HANDOFF_STORAGE_KEY);
        if (!raw) {
            return createShiftHandoffState(today);
        }
        const parsed = JSON.parse(raw);
        if (String(parsed?.date || '') !== today) {
            return createShiftHandoffState(today);
        }
        return normalizeShiftHandoffState(parsed);
    } catch (_error) {
        return createShiftHandoffState(today);
    }
}

function persistShiftHandoffState(nextState) {
    shiftHandoffState = normalizeShiftHandoffState(nextState);
    try {
        localStorage.setItem(
            QUEUE_SHIFT_HANDOFF_STORAGE_KEY,
            JSON.stringify(shiftHandoffState)
        );
    } catch (_error) {
        // ignore storage write failures
    }
    return shiftHandoffState;
}

function ensureShiftHandoffState() {
    const today = getTodayLocalIsoDate();
    if (!shiftHandoffState || shiftHandoffState.date !== today) {
        shiftHandoffState = loadShiftHandoffState();
    }
    return shiftHandoffState;
}

function setShiftHandoffStep(stepId, complete) {
    const current = ensureShiftHandoffState();
    if (!SHIFT_HANDOFF_STEP_IDS.includes(stepId)) {
        return current;
    }
    return persistShiftHandoffState({
        ...current,
        steps: {
            ...current.steps,
            [stepId]: Boolean(complete),
        },
    });
}

function resetShiftHandoffState() {
    return persistShiftHandoffState(
        createShiftHandoffState(getTodayLocalIsoDate())
    );
}

function applyShiftHandoffSuggestions(stepIds) {
    const current = ensureShiftHandoffState();
    const validIds = (Array.isArray(stepIds) ? stepIds : []).filter((stepId) =>
        SHIFT_HANDOFF_STEP_IDS.includes(stepId)
    );
    if (!validIds.length) {
        return current;
    }

    const nextSteps = { ...current.steps };
    validIds.forEach((stepId) => {
        nextSteps[stepId] = true;
    });

    return persistShiftHandoffState({
        ...current,
        steps: nextSteps,
    });
}

function createOpsLogState(date = getTodayLocalIsoDate()) {
    return {
        date,
        items: [],
    };
}

function normalizeOpsLogItem(rawItem) {
    const source = rawItem && typeof rawItem === 'object' ? rawItem : {};
    const tone = String(source.tone || 'info')
        .trim()
        .toLowerCase();
    return {
        id: String(
            source.id ||
                `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
        ),
        createdAt: String(source.createdAt || new Date().toISOString()),
        tone:
            tone === 'success' || tone === 'warning' || tone === 'alert'
                ? tone
                : 'info',
        title: String(source.title || 'Evento operativo'),
        summary: String(source.summary || '').trim(),
        source: String(source.source || 'manual').trim() || 'manual',
    };
}

function normalizeOpsLogState(rawState) {
    const today = getTodayLocalIsoDate();
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    return {
        date: String(source.date || '').trim() === today ? today : today,
        items: Array.isArray(source.items)
            ? source.items
                  .map((item) => normalizeOpsLogItem(item))
                  .slice(0, QUEUE_OPS_LOG_MAX_ITEMS)
            : [],
    };
}

function loadOpsLogState() {
    const today = getTodayLocalIsoDate();
    try {
        const raw = localStorage.getItem(QUEUE_OPS_LOG_STORAGE_KEY);
        if (!raw) {
            return createOpsLogState(today);
        }
        const parsed = JSON.parse(raw);
        if (String(parsed?.date || '') !== today) {
            return createOpsLogState(today);
        }
        return normalizeOpsLogState(parsed);
    } catch (_error) {
        return createOpsLogState(today);
    }
}

function persistOpsLogState(nextState) {
    opsLogState = normalizeOpsLogState(nextState);
    try {
        localStorage.setItem(
            QUEUE_OPS_LOG_STORAGE_KEY,
            JSON.stringify(opsLogState)
        );
    } catch (_error) {
        // ignore storage write failures
    }
    return opsLogState;
}

function ensureOpsLogState() {
    const today = getTodayLocalIsoDate();
    if (!opsLogState || opsLogState.date !== today) {
        opsLogState = loadOpsLogState();
    }
    return opsLogState;
}

function appendOpsLogEntry(entry) {
    const current = ensureOpsLogState();
    const nextItem = normalizeOpsLogItem({
        ...entry,
        createdAt: entry?.createdAt || new Date().toISOString(),
    });
    const lastItem = current.items[0];
    if (
        lastItem &&
        lastItem.title === nextItem.title &&
        lastItem.summary === nextItem.summary
    ) {
        const lastMs = Date.parse(lastItem.createdAt);
        const nextMs = Date.parse(nextItem.createdAt);
        if (
            Number.isFinite(lastMs) &&
            Number.isFinite(nextMs) &&
            Math.abs(nextMs - lastMs) < 30000
        ) {
            return current;
        }
    }

    return persistOpsLogState({
        ...current,
        items: [nextItem, ...current.items].slice(0, QUEUE_OPS_LOG_MAX_ITEMS),
    });
}

function clearOpsLogState() {
    return persistOpsLogState(createOpsLogState(getTodayLocalIsoDate()));
}

function normalizeOpsLogFilter(rawValue) {
    const value = String(rawValue || 'all')
        .trim()
        .toLowerCase();
    return value === 'incidents' || value === 'changes' || value === 'status'
        ? value
        : 'all';
}

function loadOpsLogFilter() {
    try {
        return normalizeOpsLogFilter(
            localStorage.getItem(QUEUE_OPS_LOG_FILTER_STORAGE_KEY)
        );
    } catch (_error) {
        return 'all';
    }
}

function ensureOpsLogFilter() {
    if (!opsLogFilter) {
        opsLogFilter = loadOpsLogFilter();
    }
    return opsLogFilter;
}

function persistOpsLogFilter(nextFilter) {
    opsLogFilter = normalizeOpsLogFilter(nextFilter);
    try {
        localStorage.setItem(QUEUE_OPS_LOG_FILTER_STORAGE_KEY, opsLogFilter);
    } catch (_error) {
        // ignore storage write failures
    }
    return opsLogFilter;
}

function createOpsAlertsState(date = getTodayLocalIsoDate()) {
    return {
        date,
        reviewed: {},
    };
}

function normalizeOpsAlertsState(rawState) {
    const today = getTodayLocalIsoDate();
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    const reviewedSource =
        source.reviewed && typeof source.reviewed === 'object'
            ? source.reviewed
            : {};
    const reviewed = Object.entries(reviewedSource).reduce(
        (acc, [alertId, value]) => {
            if (!alertId) {
                return acc;
            }
            const reviewedAt = String(value?.reviewedAt || '').trim();
            acc[String(alertId)] = {
                reviewedAt: reviewedAt || new Date().toISOString(),
            };
            return acc;
        },
        {}
    );

    return {
        date: String(source.date || '').trim() === today ? today : today,
        reviewed,
    };
}

function loadOpsAlertsState() {
    const today = getTodayLocalIsoDate();
    try {
        const raw = localStorage.getItem(QUEUE_OPS_ALERTS_STORAGE_KEY);
        if (!raw) {
            return createOpsAlertsState(today);
        }
        const parsed = JSON.parse(raw);
        if (String(parsed?.date || '') !== today) {
            return createOpsAlertsState(today);
        }
        return normalizeOpsAlertsState(parsed);
    } catch (_error) {
        return createOpsAlertsState(today);
    }
}

function persistOpsAlertsState(nextState) {
    opsAlertsState = normalizeOpsAlertsState(nextState);
    try {
        localStorage.setItem(
            QUEUE_OPS_ALERTS_STORAGE_KEY,
            JSON.stringify(opsAlertsState)
        );
    } catch (_error) {
        // ignore storage write failures
    }
    return opsAlertsState;
}

function ensureOpsAlertsState() {
    const today = getTodayLocalIsoDate();
    if (!opsAlertsState || opsAlertsState.date !== today) {
        opsAlertsState = loadOpsAlertsState();
    }
    return opsAlertsState;
}

function setOpsAlertReviewed(alertId, reviewed) {
    const current = ensureOpsAlertsState();
    const nextReviewed = {
        ...current.reviewed,
    };
    if (reviewed) {
        nextReviewed[String(alertId)] = {
            reviewedAt: new Date().toISOString(),
        };
    } else {
        delete nextReviewed[String(alertId)];
    }
    return persistOpsAlertsState({
        ...current,
        reviewed: nextReviewed,
    });
}

function markOpsAlertsReviewed(alertIds) {
    const validIds = Array.isArray(alertIds)
        ? alertIds
              .map((alertId) => String(alertId || '').trim())
              .filter(Boolean)
        : [];
    if (!validIds.length) {
        return ensureOpsAlertsState();
    }

    const current = ensureOpsAlertsState();
    const nextReviewed = { ...current.reviewed };
    const reviewedAt = new Date().toISOString();
    validIds.forEach((alertId) => {
        nextReviewed[alertId] = { reviewedAt };
    });

    return persistOpsAlertsState({
        ...current,
        reviewed: nextReviewed,
    });
}

function normalizeOpsFocusMode(rawValue) {
    const value = String(rawValue || 'auto')
        .trim()
        .toLowerCase();
    return value === 'opening' ||
        value === 'operations' ||
        value === 'incidents' ||
        value === 'closing'
        ? value
        : 'auto';
}

function loadOpsFocusMode() {
    try {
        return normalizeOpsFocusMode(
            localStorage.getItem(QUEUE_OPS_FOCUS_MODE_STORAGE_KEY)
        );
    } catch (_error) {
        return 'auto';
    }
}

function ensureOpsFocusMode() {
    if (!opsFocusMode) {
        opsFocusMode = loadOpsFocusMode();
    }
    return opsFocusMode;
}

function persistOpsFocusMode(nextMode) {
    opsFocusMode = normalizeOpsFocusMode(nextMode);
    try {
        localStorage.setItem(QUEUE_OPS_FOCUS_MODE_STORAGE_KEY, opsFocusMode);
    } catch (_error) {
        // ignore storage write failures
    }
    return opsFocusMode;
}

function buildPlaybookDefinitions(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const operatorConfig = manifest.operator || DEFAULT_APP_DOWNLOADS.operator;
    const kioskConfig = manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk;
    const salaConfig = manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv;
    const operatorUrl = buildPreparedSurfaceUrl('operator', operatorConfig, {
        ...preset,
        surface: 'operator',
    });
    const kioskUrl = buildPreparedSurfaceUrl('kiosk', kioskConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const salaUrl = buildPreparedSurfaceUrl('sala_tv', salaConfig, {
        ...preset,
        surface: 'sala_tv',
    });

    return {
        opening: [
            {
                id: 'opening_operator',
                title: 'Abrir Operador',
                detail: 'Verifica estación, lock y flujo base del equipo principal.',
                href: operatorUrl,
                actionLabel: 'Abrir Operador',
            },
            {
                id: 'opening_kiosk',
                title: 'Validar Kiosco + térmica',
                detail: 'Confirma ticket térmico, cola viva y contingencia offline limpia.',
                href: kioskUrl,
                actionLabel: 'Abrir Kiosco',
            },
            {
                id: 'opening_sala',
                title: 'Validar Sala TV',
                detail: 'Deja audio, campanilla y visualización listos en la TCL C655.',
                href: salaUrl,
                actionLabel: 'Abrir Sala TV',
            },
        ],
        operations: [
            {
                id: 'operations_monitor',
                title: 'Monitorear equipos vivos',
                detail: 'Revisa heartbeat, cola viva y estado general antes de seguir atendiendo.',
                href: '#queueSurfaceTelemetry',
                actionLabel: 'Ir a equipos',
            },
            {
                id: 'operations_call',
                title: 'Lanzar siguiente llamada',
                detail: 'Usa C1/C2 o el operador actual para mover la cola con el menor roce posible.',
                href: '#queueQuickConsole',
                actionLabel: 'Ir a consola',
            },
            {
                id: 'operations_log',
                title: 'Registrar cambio importante',
                detail: 'Si cambias perfil o detectas desvío, deja rastro en la bitácora operativa.',
                href: '#queueOpsLog',
                actionLabel: 'Ir a bitácora',
            },
        ],
        incidents: [
            {
                id: 'incidents_refresh',
                title: 'Refrescar y confirmar sync',
                detail: 'Atiende primero fallback, retrasos y watchdog antes de tocar hardware.',
                href: '#queueContingencyDeck',
                actionLabel: 'Ir a contingencias',
            },
            {
                id: 'incidents_surface',
                title: 'Abrir el equipo afectado',
                detail: 'Ve directo a Operador, Kiosco o Sala TV según la superficie que cayó.',
                href: '#queueQuickConsole',
                actionLabel: 'Ir a consola',
            },
            {
                id: 'incidents_log',
                title: 'Registrar incidencia',
                detail: 'Deja en la bitácora qué falló, qué se hizo y qué queda pendiente.',
                href: '#queueOpsLog',
                actionLabel: 'Ir a bitácora',
            },
        ],
        closing: [
            {
                id: 'closing_queue',
                title: 'Confirmar cola limpia',
                detail: 'No cierres si todavía hay tickets waiting o called.',
                href: '#queueShiftHandoff',
                actionLabel: 'Ir a relevo',
            },
            {
                id: 'closing_surfaces',
                title: 'Dejar superficies listas',
                detail: 'Operador, Kiosco y Sala TV deben quedar claros para el siguiente turno.',
                href: '#queueSurfaceTelemetry',
                actionLabel: 'Ir a equipos',
            },
            {
                id: 'closing_copy',
                title: 'Copiar y cerrar relevo',
                detail: 'Entrega un resumen textual corto del estado del turno.',
                href: '#queueShiftHandoff',
                actionLabel: 'Ir a resumen',
            },
        ],
    };
}

function createOpsPlaybookState(date = getTodayLocalIsoDate()) {
    return {
        date,
        modes: {
            opening: {},
            operations: {},
            incidents: {},
            closing: {},
        },
    };
}

function normalizeOpsPlaybookState(rawState) {
    const today = getTodayLocalIsoDate();
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    const safeModes =
        source.modes && typeof source.modes === 'object' ? source.modes : {};
    return {
        date: String(source.date || '').trim() === today ? today : today,
        modes: {
            opening:
                safeModes.opening && typeof safeModes.opening === 'object'
                    ? { ...safeModes.opening }
                    : {},
            operations:
                safeModes.operations && typeof safeModes.operations === 'object'
                    ? { ...safeModes.operations }
                    : {},
            incidents:
                safeModes.incidents && typeof safeModes.incidents === 'object'
                    ? { ...safeModes.incidents }
                    : {},
            closing:
                safeModes.closing && typeof safeModes.closing === 'object'
                    ? { ...safeModes.closing }
                    : {},
        },
    };
}

function loadOpsPlaybookState() {
    const today = getTodayLocalIsoDate();
    try {
        const raw = localStorage.getItem(QUEUE_OPS_PLAYBOOK_STORAGE_KEY);
        if (!raw) {
            return createOpsPlaybookState(today);
        }
        const parsed = JSON.parse(raw);
        if (String(parsed?.date || '') !== today) {
            return createOpsPlaybookState(today);
        }
        return normalizeOpsPlaybookState(parsed);
    } catch (_error) {
        return createOpsPlaybookState(today);
    }
}

function persistOpsPlaybookState(nextState) {
    opsPlaybookState = normalizeOpsPlaybookState(nextState);
    try {
        localStorage.setItem(
            QUEUE_OPS_PLAYBOOK_STORAGE_KEY,
            JSON.stringify(opsPlaybookState)
        );
    } catch (_error) {
        // ignore storage write failures
    }
    return opsPlaybookState;
}

function ensureOpsPlaybookState() {
    const today = getTodayLocalIsoDate();
    if (!opsPlaybookState || opsPlaybookState.date !== today) {
        opsPlaybookState = loadOpsPlaybookState();
    }
    return opsPlaybookState;
}

function setOpsPlaybookStep(mode, stepId, complete) {
    const current = ensureOpsPlaybookState();
    const safeMode =
        mode === 'opening' ||
        mode === 'operations' ||
        mode === 'incidents' ||
        mode === 'closing'
            ? mode
            : 'operations';
    return persistOpsPlaybookState({
        ...current,
        modes: {
            ...current.modes,
            [safeMode]: {
                ...(current.modes[safeMode] || {}),
                [stepId]: Boolean(complete),
            },
        },
    });
}

function resetOpsPlaybookMode(mode) {
    const current = ensureOpsPlaybookState();
    const safeMode =
        mode === 'opening' ||
        mode === 'operations' ||
        mode === 'incidents' ||
        mode === 'closing'
            ? mode
            : 'operations';
    return persistOpsPlaybookState({
        ...current,
        modes: {
            ...current.modes,
            [safeMode]: {},
        },
    });
}

function getDesktopTarget(appConfig, platform) {
    if (platform === 'mac' && appConfig.targets.mac) {
        return appConfig.targets.mac;
    }
    if (platform === 'win' && appConfig.targets.win) {
        return appConfig.targets.win;
    }
    return appConfig.targets.win || appConfig.targets.mac || null;
}

function buildPreparedSurfaceUrl(surfaceKey, appConfig, preset) {
    const url = new URL(
        String(appConfig.webFallbackUrl || '/'),
        `${window.location.origin}/`
    );

    if (surfaceKey === 'operator') {
        url.searchParams.set('station', preset.station === 'c2' ? 'c2' : 'c1');
        url.searchParams.set('lock', preset.lock ? '1' : '0');
        url.searchParams.set('one_tap', preset.oneTap ? '1' : '0');
    }

    return url.toString();
}

function renderDesktopCard(key, appConfig, platform) {
    const copy = APP_COPY[key];
    const preset = ensureInstallPreset(platform);
    const detectedTarget = getDesktopTarget(appConfig, platform);
    const detectedLabel =
        platform === 'mac'
            ? 'macOS'
            : platform === 'win'
              ? 'Windows'
              : (detectedTarget && detectedTarget.label) || 'este equipo';
    const alternateTargets = Object.entries(appConfig.targets || {})
        .filter(([_targetKey, value]) => value && value.url)
        .map(
            ([targetKey, value]) => `
                <a
                    href="${escapeHtml(value.url)}"
                    class="${targetKey === platform ? 'queue-app-card__recommended' : ''}"
                    download
                >
                    ${escapeHtml(value.label || targetKey)}
                </a>
            `
        )
        .join('');

    return `
        <article class="queue-app-card">
            <div>
                <p class="queue-app-card__eyebrow">${escapeHtml(copy.eyebrow)}</p>
                <h5 class="queue-app-card__title">${escapeHtml(copy.title)}</h5>
                <p class="queue-app-card__description">${escapeHtml(copy.description)}</p>
            </div>
            <p class="queue-app-card__meta">
                v${escapeHtml(appConfig.version || '0.1.0')} · ${escapeHtml(
                    formatDateTime(appConfig.updatedAt || '')
                )}
            </p>
            <span class="queue-app-card__tag">Ideal para ${escapeHtml(copy.recommendedFor)}</span>
            <div class="queue-app-card__actions">
                ${
                    detectedTarget && detectedTarget.url
                        ? `<a href="${escapeHtml(
                              detectedTarget.url
                          )}" class="queue-app-card__cta-primary" download>Descargar para ${escapeHtml(
                              detectedLabel
                          )}</a>`
                        : ''
                }
            </div>
            <div class="queue-app-card__targets">${alternateTargets}</div>
            <div class="queue-app-card__links">
                <a href="${escapeHtml(appConfig.webFallbackUrl || '/')}">Abrir versión web</a>
                <a href="${escapeHtml(buildGuideUrl(key, preset, appConfig))}">Centro de instalación</a>
                <button
                    type="button"
                    data-action="queue-copy-install-link"
                    data-queue-install-url="${escapeHtml(
                        absoluteUrl(
                            (detectedTarget && detectedTarget.url) || ''
                        )
                    )}"
                >
                    Copiar enlace
                </button>
            </div>
            <ul class="queue-app-card__notes">
                ${copy.notes
                    .map((note) => `<li>${escapeHtml(note)}</li>`)
                    .join('')}
            </ul>
        </article>
    `;
}

function renderTvCard(appConfig) {
    const copy = APP_COPY.sala_tv;
    const preset = ensureInstallPreset(detectPlatform());
    const target = appConfig.targets.android_tv || {};
    const apkUrl = String(target.url || '');
    const qrUrl = buildQrUrl(apkUrl);

    return `
        <article class="queue-app-card">
            <div>
                <p class="queue-app-card__eyebrow">${escapeHtml(copy.eyebrow)}</p>
                <h5 class="queue-app-card__title">${escapeHtml(copy.title)}</h5>
                <p class="queue-app-card__description">${escapeHtml(copy.description)}</p>
            </div>
            <p class="queue-app-card__meta">
                v${escapeHtml(appConfig.version || '0.1.0')} · ${escapeHtml(
                    formatDateTime(appConfig.updatedAt || '')
                )}
            </p>
            <span class="queue-app-card__tag">Ideal para ${escapeHtml(copy.recommendedFor)}</span>
            <div class="queue-app-card__actions">
                <a
                    href="${escapeHtml(qrUrl)}"
                    class="queue-app-card__cta-primary"
                    target="_blank"
                    rel="noopener"
                >
                    Mostrar QR de instalación
                </a>
                <a href="${escapeHtml(apkUrl)}" download>Descargar APK</a>
            </div>
            <div class="queue-app-card__links">
                <a href="${escapeHtml(appConfig.webFallbackUrl || '/sala-turnos.html')}">
                    Abrir fallback web
                </a>
                <a href="${escapeHtml(buildGuideUrl('sala_tv', preset, appConfig))}">
                    Centro de instalación
                </a>
                <button
                    type="button"
                    data-action="queue-copy-install-link"
                    data-queue-install-url="${escapeHtml(absoluteUrl(apkUrl))}"
                >
                    Copiar enlace
                </button>
            </div>
            <ul class="queue-app-card__notes">
                ${copy.notes
                    .map((note) => `<li>${escapeHtml(note)}</li>`)
                    .join('')}
            </ul>
        </article>
    `;
}

function buildPresetSummaryTitle(preset) {
    if (preset.surface === 'sala_tv') {
        return 'Sala TV lista para TCL C655';
    }
    if (preset.surface === 'kiosk') {
        return 'Kiosco listo para mostrador';
    }

    if (!preset.lock) {
        return 'Operador en modo libre';
    }

    return `Operador ${preset.station === 'c2' ? 'C2' : 'C1'} fijo`;
}

function buildPresetSteps(preset) {
    if (preset.surface === 'sala_tv') {
        return [
            'Abre el QR desde otra pantalla o descarga la APK directamente.',
            'Instala la app en la TCL C655 y prioriza Ethernet sobre Wi-Fi.',
            'Valida audio, reconexión y que la sala refleje llamados reales.',
        ];
    }

    if (preset.surface === 'kiosk') {
        return [
            'Instala la app en el mini PC o PC del kiosco.',
            'Deja la impresora térmica conectada y la app en fullscreen.',
            'Usa la versión web como respaldo inmediato si el equipo se reinicia.',
        ];
    }

    const stationLabel = preset.station === 'c2' ? 'C2' : 'C1';
    return [
        `Instala Turnero Operador en el PC de ${stationLabel} y conecta el receptor USB del Genius Numpad 1000.`,
        `En el primer arranque deja el equipo como ${preset.lock ? `${stationLabel} fijo` : 'modo libre'}${preset.oneTap ? ' con 1 tecla' : ''}.`,
        'Si el numpad no reporta Enter como se espera, calibra la tecla externa dentro de la app.',
    ];
}

function buildOpeningChecklistSteps(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const operatorConfig = manifest.operator || DEFAULT_APP_DOWNLOADS.operator;
    const kioskConfig = manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk;
    const salaConfig = manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv;
    const operatorUrl = buildPreparedSurfaceUrl('operator', operatorConfig, {
        ...preset,
        surface: 'operator',
    });
    const kioskUrl = buildPreparedSurfaceUrl('kiosk', kioskConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const salaUrl = buildPreparedSurfaceUrl('sala_tv', salaConfig, {
        ...preset,
        surface: 'sala_tv',
    });
    const stationLabel = preset.station === 'c2' ? 'C2' : 'C1';
    const operatorModeLabel = preset.lock
        ? `${stationLabel} fijo`
        : 'modo libre';

    return [
        {
            id: 'operator_ready',
            title: 'Operador + Genius Numpad 1000',
            detail: `Abre Operador en ${operatorModeLabel}${preset.oneTap ? ' con 1 tecla' : ''} y confirma Numpad Enter, Decimal y Subtract.`,
            hint: 'El receptor USB 2.4 GHz del numpad debe quedar conectado en el PC operador.',
            href: operatorUrl,
            actionLabel: 'Abrir operador',
        },
        {
            id: 'kiosk_ready',
            title: 'Kiosco + ticket térmico',
            detail: 'Abre el kiosco, genera un ticket de prueba y confirma que el panel muestre "Impresion OK".',
            hint: 'Revisa papel, energía y USB de la térmica antes de dejar autoservicio abierto.',
            href: kioskUrl,
            actionLabel: 'Abrir kiosco',
        },
        {
            id: 'sala_ready',
            title: 'Sala TV + audio en TCL C655',
            detail: 'Abre la sala, ejecuta "Probar campanilla" y confirma audio activo con la TV conectada por Ethernet.',
            hint: 'La TCL C655 debe quedar con volumen fijo y sin mute antes del primer llamado real.',
            href: salaUrl,
            actionLabel: 'Abrir sala TV',
        },
        {
            id: 'smoke_ready',
            title: 'Smoke final de apertura',
            detail: 'Haz un llamado real o de prueba desde Operador y verifica que recepción, kiosco y sala entiendan el flujo completo.',
            hint: 'Marca este paso solo cuando el llamado salga end-to-end y sea visible en la TV.',
            href: '/admin.html#queue',
            actionLabel: 'Abrir cola admin',
        },
    ];
}

function getLatestSurfaceDetails(surfaceKey) {
    const group = getSurfaceTelemetryState(surfaceKey);
    const latest =
        group.latest && typeof group.latest === 'object' ? group.latest : null;
    const details =
        latest?.details && typeof latest.details === 'object'
            ? latest.details
            : {};
    return { group, latest, details };
}

function hasRecentQueueSmokeSignal(maxAgeSec = 21600) {
    const queueMeta = getQueueSource().queueMeta;
    if (Number(queueMeta?.calledCount || 0) > 0) {
        return true;
    }

    const queueTickets = Array.isArray(getState().data?.queueTickets)
        ? getState().data.queueTickets
        : [];
    if (
        queueTickets.some((ticket) => String(ticket.status || '') === 'called')
    ) {
        return true;
    }

    return (getState().queue?.activity || []).some((entry) => {
        const message = String(entry?.message || '');
        if (!/(Llamado C\d ejecutado|Re-llamar)/i.test(message)) {
            return false;
        }
        const entryMs = Date.parse(String(entry?.at || ''));
        if (!Number.isFinite(entryMs)) {
            return true;
        }
        return Date.now() - entryMs <= maxAgeSec * 1000;
    });
}

function buildOpeningChecklistAssist(detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const checklist = ensureOpeningChecklistState();
    const expectedStation = preset.station === 'c2' ? 'c2' : 'c1';
    const operator = getLatestSurfaceDetails('operator');
    const kiosk = getLatestSurfaceDetails('kiosk');
    const display = getLatestSurfaceDetails('display');

    const operatorStation = String(
        operator.details.station || ''
    ).toLowerCase();
    const operatorConnection = String(
        operator.details.connection || 'live'
    ).toLowerCase();
    const operatorStationMatches =
        !preset.lock || !operatorStation || operatorStation === expectedStation;
    const operatorSuggested =
        operator.group.status === 'ready' &&
        !operator.group.stale &&
        Boolean(operator.details.numpadSeen) &&
        operatorStationMatches &&
        operatorConnection !== 'fallback';

    const kioskConnection = String(
        kiosk.details.connection || ''
    ).toLowerCase();
    const kioskSuggested =
        kiosk.group.status === 'ready' &&
        !kiosk.group.stale &&
        Boolean(kiosk.details.printerPrinted) &&
        kioskConnection === 'live';

    const displayConnection = String(
        display.details.connection || ''
    ).toLowerCase();
    const displaySuggested =
        display.group.status === 'ready' &&
        !display.group.stale &&
        Boolean(display.details.bellPrimed) &&
        !display.details.bellMuted &&
        displayConnection === 'live';

    const smokeSuggested =
        operatorSuggested && displaySuggested && hasRecentQueueSmokeSignal();

    const suggestions = {
        operator_ready: {
            suggested: operatorSuggested,
            reason: operatorSuggested
                ? `Heartbeat operador listo${preset.lock ? ` en ${expectedStation.toUpperCase()} fijo` : ''} con numpad detectado.`
                : operator.group.status === 'unknown'
                  ? 'Todavía no hay heartbeat reciente del operador.'
                  : !operatorStationMatches
                    ? `El operador reporta ${operatorStation.toUpperCase() || 'otra estación'}. Ajusta el perfil antes de confirmar.`
                    : !operator.details.numpadSeen
                      ? 'Falta una pulsación real del Genius Numpad 1000 para validar el equipo.'
                      : 'Confirma el operador manualmente antes de abrir consulta.',
        },
        kiosk_ready: {
            suggested: kioskSuggested,
            reason: kioskSuggested
                ? 'El kiosco ya reportó impresión OK y conexión en vivo.'
                : kiosk.group.status === 'unknown'
                  ? 'Todavía no hay heartbeat reciente del kiosco.'
                  : !kiosk.details.printerPrinted
                    ? 'Falta imprimir un ticket real o de prueba para validar la térmica.'
                    : kioskConnection !== 'live'
                      ? 'El kiosco no está reportando cola en vivo todavía.'
                      : 'Confirma el kiosco manualmente antes de abrir autoservicio.',
        },
        sala_ready: {
            suggested: displaySuggested,
            reason: displaySuggested
                ? 'La Sala TV reporta audio listo, campanilla activa y conexión estable.'
                : display.group.status === 'unknown'
                  ? 'Todavía no hay heartbeat reciente de la Sala TV.'
                  : display.details.bellMuted
                    ? 'La TV sigue en mute o con campanilla apagada.'
                    : !display.details.bellPrimed
                      ? 'Falta ejecutar la prueba de campanilla en la TV.'
                      : displayConnection !== 'live'
                        ? 'La Sala TV no está reportando conexión en vivo todavía.'
                        : 'Confirma la Sala TV manualmente antes del primer llamado.',
        },
        smoke_ready: {
            suggested: smokeSuggested,
            reason: smokeSuggested
                ? 'Ya hubo un llamado reciente con Operador y Sala TV listos.'
                : 'Haz un llamado real o de prueba para validar el flujo end-to-end antes de abrir completamente.',
        },
    };

    const suggestedIds = Object.entries(suggestions)
        .filter(
            ([stepId, signal]) =>
                !checklist.steps[stepId] && Boolean(signal?.suggested)
        )
        .map(([stepId]) => stepId);

    return {
        suggestedIds,
        suggestions,
        suggestedCount: suggestedIds.length,
    };
}

function buildShiftHandoffSteps(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const operatorConfig = manifest.operator || DEFAULT_APP_DOWNLOADS.operator;
    const kioskConfig = manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk;
    const salaConfig = manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv;
    const operatorUrl = buildPreparedSurfaceUrl('operator', operatorConfig, {
        ...preset,
        surface: 'operator',
    });
    const kioskUrl = buildPreparedSurfaceUrl('kiosk', kioskConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const salaUrl = buildPreparedSurfaceUrl('sala_tv', salaConfig, {
        ...preset,
        surface: 'sala_tv',
    });

    return [
        {
            id: 'queue_clear',
            title: 'Cola sin tickets activos',
            detail: 'Confirma que no quedan pacientes en espera ni llamados activos antes de cerrar el turno.',
            hint: 'No cierres el día si aún hay tickets `waiting` o `called`.',
            href: '/admin.html#queue',
            actionLabel: 'Abrir cola admin',
        },
        {
            id: 'operator_handoff',
            title: 'Operador listo para relevo',
            detail: 'Deja visible el perfil activo, valida el numpad y entrega el equipo sin dejar dudas de estación o modo.',
            hint: 'El PC operador debe quedar identificable para el siguiente turno.',
            href: operatorUrl,
            actionLabel: 'Abrir operador',
        },
        {
            id: 'kiosk_handoff',
            title: 'Kiosco sin pendientes offline',
            detail: 'Verifica que el kiosco no tenga tickets pendientes por sincronizar y que el autoservicio pueda reabrirse limpio.',
            hint: 'Si hay pendientes offline, no cierres sin sincronizar o anotar la contingencia.',
            href: kioskUrl,
            actionLabel: 'Abrir kiosco',
        },
        {
            id: 'sala_handoff',
            title: 'Sala TV lista para mañana',
            detail: 'Deja la TCL C655 identificable, con audio visible y sin mute para la siguiente apertura.',
            hint: 'Una TV sin mute o fuera de foreground complica el arranque del siguiente turno.',
            href: salaUrl,
            actionLabel: 'Abrir sala TV',
        },
    ];
}

function buildShiftHandoffAssist(detectedPlatform) {
    const checklist = ensureShiftHandoffState();
    const { queueMeta } = getQueueSource();
    const operator = getLatestSurfaceDetails('operator');
    const kiosk = getLatestSurfaceDetails('kiosk');
    const display = getLatestSurfaceDetails('display');
    const waitingCount = Number(queueMeta?.waitingCount || 0);
    const calledCount = Number(queueMeta?.calledCount || 0);
    const queueClearSuggested = waitingCount <= 0 && calledCount <= 0;
    const operatorSuggested =
        queueClearSuggested &&
        operator.group.status !== 'unknown' &&
        !operator.group.stale &&
        Boolean(operator.details.numpadSeen);
    const kioskSuggested =
        queueClearSuggested &&
        Number(kiosk.details.pendingOffline || 0) <= 0 &&
        String(kiosk.details.connection || 'live').toLowerCase() !== 'fallback';
    const salaSuggested =
        queueClearSuggested &&
        display.group.status !== 'unknown' &&
        !display.group.stale &&
        !display.details.bellMuted;

    const suggestions = {
        queue_clear: {
            suggested: queueClearSuggested,
            reason: queueClearSuggested
                ? 'La cola ya no reporta tickets en espera ni llamados activos.'
                : `Quedan ${waitingCount} en espera y ${calledCount} llamados activos. Atiende eso antes del cierre.`,
        },
        operator_handoff: {
            suggested: operatorSuggested,
            reason: operatorSuggested
                ? 'El operador sigue reportando numpad detectado y equipo visible para relevo.'
                : 'Abre Operador y deja claro el perfil/estación antes de entregar el puesto.',
        },
        kiosk_handoff: {
            suggested: kioskSuggested,
            reason: kioskSuggested
                ? 'El kiosco no reporta pendientes offline para el siguiente turno.'
                : `El kiosco todavía muestra ${Number(kiosk.details.pendingOffline || 0)} pendiente(s) offline o conexión degradada.`,
        },
        sala_handoff: {
            suggested: salaSuggested,
            reason: salaSuggested
                ? 'La Sala TV sigue visible y sin mute para la siguiente apertura.'
                : 'Valida mute/foreground de la Sala TV antes de cerrar el turno.',
        },
    };

    const suggestedIds = Object.entries(suggestions)
        .filter(
            ([stepId, signal]) =>
                !checklist.steps[stepId] && Boolean(signal?.suggested)
        )
        .map(([stepId]) => stepId);

    return {
        suggestions,
        suggestedIds,
        suggestedCount: suggestedIds.length,
    };
}

function buildShiftHandoffSummary(detectedPlatform) {
    const state = getState();
    const { queueMeta } = getQueueSource();
    const opening = ensureOpeningChecklistState();
    const closing = ensureShiftHandoffState();
    const openingConfirmed = OPENING_CHECKLIST_STEP_IDS.filter(
        (stepId) => opening.steps[stepId]
    ).length;
    const closingConfirmed = SHIFT_HANDOFF_STEP_IDS.filter(
        (stepId) => closing.steps[stepId]
    ).length;
    const operator = getLatestSurfaceDetails('operator');
    const kiosk = getLatestSurfaceDetails('kiosk');
    const display = getLatestSurfaceDetails('display');
    const syncHealth = getQueueSyncHealth();
    const queueLine = `Cola: espera ${Number(queueMeta?.waitingCount || 0)}, llamados ${Number(queueMeta?.calledCount || 0)}, sync ${String(state.queue?.syncMode || 'live')}.`;
    const operatorLine = `Operador: ${String(operator.latest?.deviceLabel || 'sin equipo')} · ${String(operator.group.summary || 'sin resumen')} `;
    const kioskLine = `Kiosco: ${String(kiosk.latest?.deviceLabel || 'sin equipo')} · ${String(kiosk.group.summary || 'sin resumen')} `;
    const salaLine = `Sala TV: ${String(display.latest?.deviceLabel || 'sin equipo')} · ${String(display.group.summary || 'sin resumen')} `;

    return [
        `Relevo Turnero Sala - ${formatDateTime(new Date().toISOString())}`,
        queueLine,
        `Sync operativo: ${syncHealth.title}.`,
        operatorLine.trim(),
        kioskLine.trim(),
        salaLine.trim(),
        `Apertura confirmada: ${openingConfirmed}/${OPENING_CHECKLIST_STEP_IDS.length}.`,
        `Cierre confirmado: ${closingConfirmed}/${SHIFT_HANDOFF_STEP_IDS.length}.`,
        `Perfil actual operador: ${ensureInstallPreset(detectedPlatform).station === 'c2' ? 'C2' : 'C1'}${ensureInstallPreset(detectedPlatform).lock ? ' fijo' : ' libre'}.`,
    ].join('\n');
}

function buildOpsLogStatusEntry(manifest, detectedPlatform) {
    const pilot = buildQueueOpsPilot(manifest, detectedPlatform);
    const syncHealth = getQueueSyncHealth();
    const opening = ensureOpeningChecklistState();
    const closing = ensureShiftHandoffState();
    const openingConfirmed = OPENING_CHECKLIST_STEP_IDS.filter(
        (stepId) => opening.steps[stepId]
    ).length;
    const closingConfirmed = SHIFT_HANDOFF_STEP_IDS.filter(
        (stepId) => closing.steps[stepId]
    ).length;

    return {
        tone:
            syncHealth.state === 'alert'
                ? 'alert'
                : pilot.issueCount > 0
                  ? 'warning'
                  : 'success',
        source: 'status',
        title: 'Estado actual registrado',
        summary: `${pilot.title}. Apertura ${openingConfirmed}/${OPENING_CHECKLIST_STEP_IDS.length}, cierre ${closingConfirmed}/${SHIFT_HANDOFF_STEP_IDS.length}, equipos listos ${pilot.readyEquipmentCount}/3, sync ${syncHealth.title.toLowerCase()}, perfil ${getInstallPresetLabel(
            detectedPlatform
        )}.`,
    };
}

function buildOpsLogIncidentEntry(manifest, detectedPlatform) {
    const syncHealth = getQueueSyncHealth();
    const telemetryCards = buildSurfaceTelemetryCards(
        manifest,
        detectedPlatform
    );
    const criticalCard = telemetryCards.find((card) => card.state === 'alert');
    const warningCard = telemetryCards.find(
        (card) => card.state === 'warning' || card.state === 'unknown'
    );
    const targetCard = criticalCard || warningCard;

    if (syncHealth.state === 'alert') {
        return {
            tone: 'alert',
            source: 'incident',
            title: `Incidencia: ${syncHealth.title}`,
            summary: syncHealth.summary,
        };
    }

    if (targetCard) {
        return {
            tone: targetCard.state === 'alert' ? 'alert' : 'warning',
            source: 'incident',
            title: `Incidencia: ${targetCard.title}`,
            summary: `${targetCard.summary} ${targetCard.ageLabel}.`,
        };
    }

    return {
        tone: 'success',
        source: 'incident',
        title: 'Sin incidencia crítica visible',
        summary:
            'No hay alertas abiertas en Operador, Kiosco o Sala TV. Se registró estabilidad del sistema para seguimiento.',
    };
}

function getOpsLogSourceLabel(source) {
    const value = String(source || '')
        .trim()
        .toLowerCase();
    if (value === 'incident') {
        return 'Incidencia';
    }
    if (value === 'config') {
        return 'Configuración';
    }
    if (value === 'opening') {
        return 'Apertura';
    }
    if (value === 'handoff') {
        return 'Relevo';
    }
    if (value === 'status') {
        return 'Estado';
    }
    if (value === 'dispatch') {
        return 'Despacho';
    }
    return 'Manual';
}

function filterOpsLogItems(items, filter) {
    const list = Array.isArray(items) ? items : [];
    if (filter === 'incidents') {
        return list.filter(
            (item) =>
                item.source === 'incident' ||
                item.tone === 'warning' ||
                item.tone === 'alert'
        );
    }
    if (filter === 'changes') {
        return list.filter((item) =>
            ['config', 'opening', 'handoff', 'dispatch'].includes(item.source)
        );
    }
    if (filter === 'status') {
        return list.filter((item) => item.source === 'status');
    }
    return list;
}

function getOpsLogFilterLabel(filter) {
    if (filter === 'incidents') {
        return 'Incidencias';
    }
    if (filter === 'changes') {
        return 'Cambios';
    }
    if (filter === 'status') {
        return 'Estados';
    }
    return 'Todo';
}

function buildOpsLogReport(detectedPlatform) {
    const state = ensureOpsLogState();
    const entries = state.items.length
        ? state.items.map(
              (item) =>
                  `${formatDateTime(item.createdAt)} · ${item.title}\n${item.summary}`
          )
        : ['Sin eventos registrados hoy.'];

    return [
        `Bitácora Turnero Sala - ${formatDateTime(new Date().toISOString())}`,
        `Perfil actual: ${getInstallPresetLabel(detectedPlatform)}.`,
        '',
        ...entries,
    ].join('\n\n');
}

async function copyOpsLogReport(detectedPlatform) {
    try {
        await navigator.clipboard.writeText(
            buildOpsLogReport(detectedPlatform)
        );
        createToast('Bitácora operativa copiada', 'success');
    } catch (_error) {
        createToast('No se pudo copiar la bitácora operativa', 'error');
    }
}

async function copyShiftHandoffSummary(detectedPlatform) {
    try {
        await navigator.clipboard.writeText(
            buildShiftHandoffSummary(detectedPlatform)
        );
        createToast('Resumen de relevo copiado', 'success');
    } catch (_error) {
        createToast('No se pudo copiar el resumen de relevo', 'error');
    }
}

function buildQueueOpsPilot(manifest, detectedPlatform) {
    const checklist = ensureOpeningChecklistState();
    const steps = buildOpeningChecklistSteps(manifest, detectedPlatform);
    const assist = buildOpeningChecklistAssist(detectedPlatform);
    const syncHealth = getQueueSyncHealth();
    const telemetry = [
        getSurfaceTelemetryState('operator'),
        getSurfaceTelemetryState('kiosk'),
        getSurfaceTelemetryState('display'),
    ];
    const confirmedCount = steps.filter(
        (step) => checklist.steps[step.id]
    ).length;
    const suggestedCount = assist.suggestedCount;
    const pendingSteps = steps.filter((step) => !checklist.steps[step.id]);
    const pendingAfterSuggestions = pendingSteps.filter(
        (step) => !assist.suggestions[step.id]?.suggested
    );
    const readyEquipmentCount = telemetry.filter(
        (entry) => entry.status === 'ready' && !entry.stale
    ).length;
    const issueCount =
        telemetry.filter((entry) => entry.status !== 'ready' || entry.stale)
            .length + (syncHealth.state === 'ready' ? 0 : 1);
    const progressPct =
        steps.length > 0
            ? Math.max(
                  0,
                  Math.min(
                      100,
                      Math.round((confirmedCount / steps.length) * 100)
                  )
              )
            : 0;

    let tone = 'idle';
    let eyebrow = 'Siguiente paso';
    let title = 'Centro de apertura listo';
    let summary =
        'Sigue la siguiente acción sugerida para terminar la apertura sin revisar cada tarjeta por separado.';
    let primaryAction = null;
    let secondaryAction = null;
    let supportCopy = '';

    if (syncHealth.state === 'alert') {
        tone = 'alert';
        title = 'Resuelve la cola antes de abrir';
        summary =
            'Hay fallback o sincronización degradada. Prioriza el refresh de cola antes de validar hardware o instalación.';
        primaryAction = {
            kind: 'button',
            id: 'queueOpsPilotRefreshBtn',
            action: 'queue-refresh-state',
            label: 'Refrescar cola ahora',
        };
        secondaryAction = {
            kind: 'anchor',
            href: '/admin.html#queue',
            label: 'Abrir cola admin',
        };
        supportCopy =
            'Cuando el sync vuelva a vivo, el panel te devolverá el siguiente paso operativo.';
    } else if (suggestedCount > 0) {
        tone = 'suggested';
        title = `Confirma ${suggestedCount} paso(s) ya validados`;
        summary =
            pendingAfterSuggestions.length > 0
                ? `${suggestedCount} paso(s) ya aparecen listos por heartbeat. Después te quedará ${pendingAfterSuggestions[0].title}.`
                : 'El sistema ya detectó los pasos pendientes como listos. Confírmalos para cerrar la apertura.';
        primaryAction = {
            kind: 'button',
            id: 'queueOpsPilotApplyBtn',
            label: `Confirmar sugeridos (${suggestedCount})`,
        };
        secondaryAction = pendingAfterSuggestions.length
            ? {
                  kind: 'anchor',
                  href: pendingAfterSuggestions[0].href,
                  label: pendingAfterSuggestions[0].actionLabel,
              }
            : {
                  kind: 'anchor',
                  href: '/admin.html#queue',
                  label: 'Volver a la cola',
              };
        supportCopy =
            'Usa este botón cuando ya confías en la telemetría y solo quieres avanzar sin recorrer el checklist uno por uno.';
    } else if (pendingAfterSuggestions.length > 0) {
        tone = syncHealth.state === 'warning' ? 'warning' : 'active';
        title = `Siguiente paso: ${pendingAfterSuggestions[0].title}`;
        summary =
            pendingAfterSuggestions.length > 1
                ? `Quedan ${pendingAfterSuggestions.length} validaciones manuales. Empieza por esta para mantener el flujo simple.`
                : 'Solo queda una validación manual para dejar la apertura lista.';
        primaryAction = {
            kind: 'anchor',
            href: pendingAfterSuggestions[0].href,
            label: pendingAfterSuggestions[0].actionLabel,
        };
        secondaryAction =
            syncHealth.state === 'warning'
                ? {
                      kind: 'button',
                      id: 'queueOpsPilotRefreshBtn',
                      action: 'queue-refresh-state',
                      label: 'Refrescar cola',
                  }
                : {
                      kind: 'anchor',
                      href: '/admin.html#queue',
                      label: 'Abrir cola admin',
                  };
        supportCopy = String(
            assist.suggestions[pendingAfterSuggestions[0].id]?.reason ||
                pendingAfterSuggestions[0].hint ||
                ''
        );
    } else {
        tone = 'ready';
        eyebrow = 'Operación lista';
        title = 'Apertura completada';
        summary =
            'Operador, kiosco y sala ya están confirmados. Puedes seguir atendiendo o hacer un llamado de prueba final desde la cola.';
        primaryAction = {
            kind: 'anchor',
            href: '/admin.html#queue',
            label: 'Abrir cola admin',
        };
        secondaryAction = {
            kind: 'anchor',
            href: buildPreparedSurfaceUrl(
                'operator',
                manifest.operator || DEFAULT_APP_DOWNLOADS.operator,
                {
                    ...ensureInstallPreset(detectedPlatform),
                    surface: 'operator',
                }
            ),
            label: 'Abrir operador',
        };
        supportCopy =
            'Si cambia un equipo a warning o alert, este panel volverá a priorizar la acción correcta.';
    }

    return {
        tone,
        eyebrow,
        title,
        summary,
        supportCopy,
        progressPct,
        confirmedCount,
        suggestedCount,
        totalSteps: steps.length,
        readyEquipmentCount,
        issueCount,
        primaryAction,
        secondaryAction,
    };
}

function renderQueueOpsPilotAction(action, variant = 'secondary') {
    if (!action) {
        return '';
    }

    const className =
        variant === 'primary'
            ? 'queue-ops-pilot__action queue-ops-pilot__action--primary'
            : 'queue-ops-pilot__action';

    if (action.kind === 'button') {
        return `
            <button
                ${action.id ? `id="${escapeHtml(action.id)}"` : ''}
                type="button"
                class="${className}"
                ${action.action ? `data-action="${escapeHtml(action.action)}"` : ''}
            >
                ${escapeHtml(action.label || 'Continuar')}
            </button>
        `;
    }

    return `
        <a
            ${action.id ? `id="${escapeHtml(action.id)}"` : ''}
            href="${escapeHtml(action.href || '/')}"
            class="${className}"
            target="_blank"
            rel="noopener"
        >
            ${escapeHtml(action.label || 'Continuar')}
        </a>
    `;
}

function renderQueueOpsPilot(manifest, detectedPlatform) {
    const root = document.getElementById('queueOpsPilot');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const pilot = buildQueueOpsPilot(manifest, detectedPlatform);
    setHtml(
        '#queueOpsPilot',
        `
            <section class="queue-ops-pilot__shell" data-state="${escapeHtml(pilot.tone)}">
                <div class="queue-ops-pilot__layout">
                    <div class="queue-ops-pilot__copy">
                        <p class="queue-app-card__eyebrow">${escapeHtml(pilot.eyebrow)}</p>
                        <h5 id="queueOpsPilotTitle" class="queue-app-card__title">${escapeHtml(
                            pilot.title
                        )}</h5>
                        <p id="queueOpsPilotSummary" class="queue-ops-pilot__summary">${escapeHtml(
                            pilot.summary
                        )}</p>
                        <p class="queue-ops-pilot__support">${escapeHtml(
                            pilot.supportCopy
                        )}</p>
                        <div class="queue-ops-pilot__actions">
                            ${renderQueueOpsPilotAction(pilot.primaryAction, 'primary')}
                            ${renderQueueOpsPilotAction(pilot.secondaryAction, 'secondary')}
                        </div>
                    </div>
                    <div class="queue-ops-pilot__status">
                        <div class="queue-ops-pilot__progress">
                            <div class="queue-ops-pilot__progress-head">
                                <span>Apertura confirmada</span>
                                <strong id="queueOpsPilotProgressValue">${escapeHtml(
                                    `${pilot.confirmedCount}/${pilot.totalSteps}`
                                )}</strong>
                            </div>
                            <div class="queue-ops-pilot__bar" aria-hidden="true">
                                <span style="width:${escapeHtml(String(pilot.progressPct))}%"></span>
                            </div>
                        </div>
                        <div class="queue-ops-pilot__chips">
                            <span id="queueOpsPilotChipConfirmed" class="queue-ops-pilot__chip">
                                Confirmados ${escapeHtml(String(pilot.confirmedCount))}
                            </span>
                            <span id="queueOpsPilotChipSuggested" class="queue-ops-pilot__chip">
                                Sugeridos ${escapeHtml(String(pilot.suggestedCount))}
                            </span>
                            <span id="queueOpsPilotChipEquipment" class="queue-ops-pilot__chip">
                                Equipos listos ${escapeHtml(String(pilot.readyEquipmentCount))}/3
                            </span>
                            <span id="queueOpsPilotChipIssues" class="queue-ops-pilot__chip">
                                Incidencias ${escapeHtml(String(pilot.issueCount))}
                            </span>
                        </div>
                    </div>
                </div>
            </section>
        `
    );

    const applyButton = document.getElementById('queueOpsPilotApplyBtn');
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            const assist = buildOpeningChecklistAssist(detectedPlatform);
            if (!assist.suggestedIds.length) {
                return;
            }
            applyOpeningChecklistSuggestions(assist.suggestedIds);
            appendOpsLogEntry({
                tone: 'success',
                source: 'opening',
                title: `Apertura: ${assist.suggestedIds.length} sugerido(s) confirmados`,
                summary: `Se confirmaron pasos de apertura ya validados por telemetría. Perfil activo: ${getInstallPresetLabel(
                    detectedPlatform
                )}.`,
            });
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }
}

function formatHeartbeatAge(ageSec) {
    const safeAge = Number(ageSec);
    if (!Number.isFinite(safeAge) || safeAge < 0) {
        return 'sin señal';
    }
    if (safeAge < 60) {
        return `${safeAge}s`;
    }
    const minutes = Math.floor(safeAge / 60);
    const seconds = safeAge % 60;
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remMinutes = minutes % 60;
        return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
    }
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function buildSignalAgeLabel(latest, fallback = 'Sin heartbeat reciente') {
    const ageSec = Number(latest?.ageSec);
    if (!Number.isFinite(ageSec)) {
        return fallback;
    }
    return `Heartbeat hace ${formatHeartbeatAge(ageSec)}`;
}

function formatIntervalAge(intervalMs) {
    const safeInterval = Number(intervalMs);
    if (!Number.isFinite(safeInterval) || safeInterval <= 0) {
        return 'cada --';
    }
    const seconds = Math.max(1, Math.round(safeInterval / 1000));
    if (seconds < 60) {
        return `cada ${seconds}s`;
    }
    const minutes = Math.round(seconds / 60);
    return `cada ${minutes}m`;
}

function getSurfaceTelemetryAutoRefreshState() {
    const runtime = getState().ui?.queueAutoRefresh;
    return runtime && typeof runtime === 'object'
        ? runtime
        : {
              state: 'idle',
              reason: 'Abre Turnero Sala para activar el monitoreo continuo.',
              intervalMs: 45000,
              lastAttemptAt: 0,
              lastSuccessAt: 0,
              lastError: '',
              inFlight: false,
          };
}

function buildSurfaceTelemetryAutoRefreshMeta() {
    const runtime = getSurfaceTelemetryAutoRefreshState();
    const state = String(runtime.state || 'idle')
        .trim()
        .toLowerCase();
    const intervalLabel = formatIntervalAge(runtime.intervalMs);
    const lastSuccessLabel = runtime.lastSuccessAt
        ? `ultimo ciclo hace ${formatHeartbeatAge(
              Math.max(
                  0,
                  Math.round(
                      (Date.now() - Number(runtime.lastSuccessAt || 0)) / 1000
                  )
              )
          )}`
        : 'sin ciclo exitoso todavía';

    if (state === 'refreshing' || Boolean(runtime.inFlight)) {
        return {
            state: 'active',
            label: 'Actualizando ahora',
            meta: `${intervalLabel} · sincronizando equipos en vivo`,
        };
    }

    if (state === 'paused') {
        return {
            state: 'paused',
            label: 'Auto-refresh en pausa',
            meta: String(
                runtime.reason || 'Reanuda esta sección para continuar.'
            ),
        };
    }

    if (state === 'warning') {
        return {
            state: 'warning',
            label: 'Auto-refresh degradado',
            meta: String(
                runtime.reason || `Modo degradado · ${lastSuccessLabel}`
            ),
        };
    }

    if (state === 'active') {
        return {
            state: 'active',
            label: 'Auto-refresh activo',
            meta: `${intervalLabel} · ${lastSuccessLabel}`,
        };
    }

    return {
        state: 'idle',
        label: 'Auto-refresh listo',
        meta: String(
            runtime.reason || 'Abre Turnero Sala para empezar el monitoreo.'
        ),
    };
}

function getQueueSurfaceTelemetry() {
    const telemetry = getState().data.queueSurfaceStatus;
    return telemetry && typeof telemetry === 'object' ? telemetry : {};
}

function getSurfaceTelemetryState(surfaceKey) {
    const telemetry = getQueueSurfaceTelemetry();
    const raw = telemetry[surfaceKey];
    return raw && typeof raw === 'object'
        ? raw
        : {
              surface: surfaceKey,
              status: 'unknown',
              stale: true,
              summary: '',
              latest: null,
              instances: [],
          };
}

function buildSurfaceTelemetryChips(surfaceKey, latest) {
    if (!latest || typeof latest !== 'object') {
        return ['Sin señal'];
    }

    const details =
        latest.details && typeof latest.details === 'object'
            ? latest.details
            : {};
    const chips = [];
    const appMode = String(latest.appMode || '').trim();
    if (appMode === 'desktop') {
        chips.push('Desktop');
    } else if (appMode === 'android_tv') {
        chips.push('Android TV');
    } else {
        chips.push('Web');
    }

    if (surfaceKey === 'operator') {
        const station = String(details.station || '').toUpperCase();
        const stationMode = String(details.stationMode || '');
        const oneTap = Boolean(details.oneTap);
        const numpadSeen = Boolean(details.numpadSeen);
        if (station) {
            chips.push(
                stationMode === 'locked'
                    ? `${station} fijo`
                    : `${station} libre`
            );
        }
        chips.push(oneTap ? '1 tecla ON' : '1 tecla OFF');
        chips.push(numpadSeen ? 'Numpad listo' : 'Numpad pendiente');
    } else if (surfaceKey === 'kiosk') {
        chips.push(details.printerPrinted ? 'Térmica OK' : 'Térmica pendiente');
        chips.push(`Offline ${Number(details.pendingOffline || 0)}`);
        chips.push(
            String(details.connection || '').toLowerCase() === 'live'
                ? 'Cola en vivo'
                : 'Cola degradada'
        );
    } else if (surfaceKey === 'display') {
        chips.push(details.bellPrimed ? 'Audio listo' : 'Audio pendiente');
        chips.push(details.bellMuted ? 'Campanilla Off' : 'Campanilla On');
        chips.push(
            String(details.connection || '').toLowerCase() === 'live'
                ? 'Sala en vivo'
                : 'Sala degradada'
        );
    }

    return chips.slice(0, 4);
}

function buildSurfaceTelemetryCards(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const cards = [
        {
            key: 'operator',
            appConfig: manifest.operator || DEFAULT_APP_DOWNLOADS.operator,
            fallbackSurface: 'operator',
            actionLabel: 'Abrir operador',
        },
        {
            key: 'kiosk',
            appConfig: manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk,
            fallbackSurface: 'kiosk',
            actionLabel: 'Abrir kiosco',
        },
        {
            key: 'display',
            appConfig: manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv,
            fallbackSurface: 'sala_tv',
            actionLabel: 'Abrir sala TV',
        },
    ];

    return cards.map((entry) => {
        const group = getSurfaceTelemetryState(entry.key);
        const latest =
            group.latest && typeof group.latest === 'object'
                ? group.latest
                : null;
        const effectiveState = String(group.status || 'unknown');
        const summary =
            String(group.summary || '').trim() ||
            SURFACE_TELEMETRY_COPY[entry.key]?.emptySummary ||
            'Sin señal todavía.';
        const route = buildPreparedSurfaceUrl(
            entry.fallbackSurface,
            entry.appConfig,
            {
                ...preset,
                surface: entry.fallbackSurface,
            }
        );

        return {
            key: entry.key,
            title: SURFACE_TELEMETRY_COPY[entry.key]?.title || entry.key,
            state:
                effectiveState === 'ready' ||
                effectiveState === 'warning' ||
                effectiveState === 'alert'
                    ? effectiveState
                    : 'unknown',
            badge:
                effectiveState === 'ready'
                    ? 'En vivo'
                    : effectiveState === 'alert'
                      ? 'Atender'
                      : effectiveState === 'warning'
                        ? 'Revisar'
                        : 'Sin señal',
            deviceLabel: String(latest?.deviceLabel || 'Sin equipo reportando'),
            summary,
            ageLabel:
                latest && latest.ageSec !== undefined && latest.ageSec !== null
                    ? `Heartbeat hace ${formatHeartbeatAge(latest.ageSec)}`
                    : 'Sin heartbeat todavía',
            chips: buildSurfaceTelemetryChips(entry.key, latest),
            route,
            actionLabel: entry.actionLabel,
        };
    });
}

function renderSurfaceTelemetry(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceTelemetry');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const cards = buildSurfaceTelemetryCards(manifest, detectedPlatform);
    const autoRefresh = buildSurfaceTelemetryAutoRefreshMeta();
    const hasAlert = cards.some((card) => card.state === 'alert');
    const hasWarning = cards.some(
        (card) => card.state === 'warning' || card.state === 'unknown'
    );
    const title = hasAlert
        ? 'Equipos con atención urgente'
        : hasWarning
          ? 'Equipos con señal parcial'
          : 'Equipos en vivo';
    const summary = hasAlert
        ? 'Al menos un equipo reporta una condición crítica. Atiende primero esa tarjeta antes de tocar instalación o configuración.'
        : hasWarning
          ? 'Hay equipos sin heartbeat reciente o con validación pendiente. Usa estas tarjetas para abrir el equipo correcto sin buscar rutas manualmente.'
          : 'Operador, kiosco y sala están enviando heartbeat al admin. Esta vista ya sirve como tablero operativo por equipo.';
    const statusLabel = hasAlert
        ? 'Atender ahora'
        : hasWarning
          ? 'Revisar hoy'
          : 'Todo al día';
    const statusState = hasAlert ? 'alert' : hasWarning ? 'warning' : 'ready';

    setHtml(
        '#queueSurfaceTelemetry',
        `
            <section class="queue-surface-telemetry__shell">
                <div class="queue-surface-telemetry__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Equipos en vivo</p>
                        <h5 id="queueSurfaceTelemetryTitle" class="queue-app-card__title">${escapeHtml(
                            title
                        )}</h5>
                        <p id="queueSurfaceTelemetrySummary" class="queue-surface-telemetry__summary">${escapeHtml(
                            summary
                        )}</p>
                        <div id="queueSurfaceTelemetryAutoMeta" class="queue-surface-telemetry__auto-meta">
                            <span
                                id="queueSurfaceTelemetryAutoState"
                                class="queue-surface-telemetry__auto-state"
                                data-state="${escapeHtml(autoRefresh.state)}"
                            >
                                ${escapeHtml(autoRefresh.label)}
                            </span>
                            <span class="queue-surface-telemetry__auto-copy">${escapeHtml(
                                autoRefresh.meta
                            )}</span>
                        </div>
                    </div>
                    <span
                        id="queueSurfaceTelemetryStatus"
                        class="queue-surface-telemetry__status"
                        data-state="${escapeHtml(statusState)}"
                    >
                        ${escapeHtml(statusLabel)}
                    </span>
                </div>
                <div id="queueSurfaceTelemetryCards" class="queue-surface-telemetry__grid" role="list" aria-label="Estado vivo por equipo">
                    ${cards
                        .map(
                            (card) => `
                                <article
                                    class="queue-surface-card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-surface-card__header">
                                        <div>
                                            <strong>${escapeHtml(card.title)}</strong>
                                            <p class="queue-surface-card__meta">${escapeHtml(
                                                card.deviceLabel
                                            )}</p>
                                        </div>
                                        <span class="queue-surface-card__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p class="queue-surface-card__summary">${escapeHtml(
                                        card.summary
                                    )}</p>
                                    <p class="queue-surface-card__age">${escapeHtml(
                                        card.ageLabel
                                    )}</p>
                                    <div class="queue-surface-card__chips">
                                        ${card.chips
                                            .map(
                                                (chip) =>
                                                    `<span class="queue-surface-card__chip">${escapeHtml(
                                                        chip
                                                    )}</span>`
                                            )
                                            .join('')}
                                    </div>
                                    <div class="queue-surface-card__actions">
                                        <a
                                            href="${escapeHtml(card.route)}"
                                            target="_blank"
                                            rel="noopener"
                                            class="queue-surface-card__action queue-surface-card__action--primary"
                                        >
                                            ${escapeHtml(card.actionLabel)}
                                        </a>
                                        <button
                                            type="button"
                                            class="queue-surface-card__action"
                                            data-action="queue-copy-install-link"
                                            data-queue-install-url="${escapeHtml(card.route)}"
                                        >
                                            Copiar ruta
                                        </button>
                                        <button
                                            type="button"
                                            class="queue-surface-card__action"
                                            data-action="refresh-admin-data"
                                        >
                                            Actualizar estado
                                        </button>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );
}

function getQueueSyncHealth() {
    const state = getState();
    const { queueMeta } = getQueueSource();
    const syncMode = String(state.queue?.syncMode || 'live')
        .trim()
        .toLowerCase();
    const fallbackPartial = Boolean(state.queue?.fallbackPartial);
    const updatedAt = String(queueMeta?.updatedAt || '').trim();
    const updatedAtMs = updatedAt ? Date.parse(updatedAt) : NaN;
    const ageSec = Number.isFinite(updatedAtMs)
        ? Math.max(0, Math.round((Date.now() - updatedAtMs) / 1000))
        : null;

    if (syncMode === 'fallback' || fallbackPartial) {
        return {
            state: 'alert',
            badge: 'Atender ahora',
            title: 'Cola en fallback',
            summary:
                'El admin ya está usando respaldo parcial. Refresca la cola y mantén Operador, Kiosco y Sala TV en sus rutas web preparadas hasta que vuelva el realtime.',
            steps: [
                'Presiona Refrescar y confirma que el sync vuelva a vivo antes de cerrar la apertura.',
                'Mantén un solo operador activo por estación para evitar confusión mientras dura el respaldo.',
                'Si la TV sigue mostrando llamados, no la cierres; prioriza estabilidad sobre reinstalar.',
            ],
        };
    }

    if (Number.isFinite(ageSec) && ageSec >= 60) {
        return {
            state: 'warning',
            badge: `Watchdog ${ageSec}s`,
            title: 'Realtime lento o en reconexión',
            summary:
                'La cola no parece caída, pero el watchdog ya detecta retraso. Conviene refrescar desde admin antes de que el equipo operador se quede desfasado.',
            steps: [
                'Refresca la cola y confirma que Sync vuelva a "vivo".',
                'Si Operador ya estaba abierto, valida un llamado de prueba antes de seguir atendiendo.',
                'Si el retraso persiste, opera desde las rutas web preparadas mientras revisas red local.',
            ],
        };
    }

    return {
        state: 'ready',
        badge: 'Sin incidentes',
        title: 'Cola sincronizada',
        summary:
            'No hay incidentes visibles de realtime. Usa esta sección como ruta rápida si falla numpad, térmica o audio durante el día.',
        steps: [
            'Mantén este panel abierto como tablero de rescate para operador, kiosco y sala.',
            'Si notas un retraso mayor a un minuto, refresca antes de tocar instalación o hardware.',
            'En una caída puntual, prioriza abrir la ruta preparada del equipo antes de reiniciar dispositivos.',
        ],
    };
}

function buildQueueSyncAlert() {
    const syncHealth = getQueueSyncHealth();
    if (syncHealth.state === 'ready') {
        return null;
    }

    const { queueMeta } = getQueueSource();
    const updatedAtMs = Date.parse(String(queueMeta?.updatedAt || ''));
    const ageLabel = Number.isFinite(updatedAtMs)
        ? `Ultima cola actualizada hace ${formatHeartbeatAge(
              Math.max(0, Math.round((Date.now() - updatedAtMs) / 1000))
          )}`
        : 'Sin marca reciente de cola';

    return {
        id: `queue_sync_${syncHealth.state}`,
        scope: 'Cola admin',
        tone: syncHealth.state === 'alert' ? 'alert' : 'warning',
        title:
            syncHealth.state === 'alert'
                ? 'Realtime degradado o en fallback'
                : 'Realtime lento o en reconexión',
        summary: syncHealth.summary,
        meta: ageLabel,
        href: '/admin.html#queue',
        actionLabel: 'Abrir cola admin',
    };
}

function buildOperatorAlert(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const expectedStation = preset.station === 'c2' ? 'c2' : 'c1';
    const appConfig = manifest.operator || DEFAULT_APP_DOWNLOADS.operator;
    const route = buildPreparedSurfaceUrl('operator', appConfig, {
        ...preset,
        surface: 'operator',
    });
    const { group, latest, details } = getLatestSurfaceDetails('operator');
    const station = String(details.station || '')
        .trim()
        .toLowerCase();
    const connection = String(details.connection || 'live')
        .trim()
        .toLowerCase();
    const ageLabel = buildSignalAgeLabel(latest);

    if (!latest || group.stale || String(group.status || '') === 'unknown') {
        return {
            id: 'operator_signal',
            scope: 'Operador',
            tone: String(group.status || '') === 'alert' ? 'alert' : 'warning',
            title: 'Operador sin señal reciente',
            summary:
                String(group.summary || '').trim() ||
                'Todavía no hay heartbeat suficiente del equipo operador para confiar en el llamado diario.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Abrir operador',
        };
    }

    if (preset.lock && station && station !== expectedStation) {
        return {
            id: 'operator_station_mismatch',
            scope: 'Operador',
            tone: 'alert',
            title: `Operador en ${station.toUpperCase()} y perfil activo en ${expectedStation.toUpperCase()}`,
            summary:
                'La estación reportada no coincide con el preset bloqueado. Corrige el perfil o reabre el operador antes del siguiente llamado.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Corregir operador',
        };
    }

    if (!details.numpadSeen) {
        return {
            id: 'operator_numpad_pending',
            scope: 'Operador',
            tone: 'warning',
            title: 'Genius Numpad 1000 sin pulsación reciente',
            summary:
                'Falta una tecla real del numpad para cerrar la validación operativa. Si usas 1 tecla, este chequeo conviene resolverlo primero.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Validar numpad',
        };
    }

    if (connection !== 'live') {
        return {
            id: 'operator_connection',
            scope: 'Operador',
            tone: 'warning',
            title: 'Operador fuera de cola viva',
            summary:
                'El operador sigue arriba, pero no está reportando conexión viva con la cola. Mantén el fallback preparado antes de seguir atendiendo.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Revisar operador',
        };
    }

    return null;
}

function buildKioskAlert(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const appConfig = manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk;
    const route = buildPreparedSurfaceUrl('kiosk', appConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const { group, latest, details } = getLatestSurfaceDetails('kiosk');
    const connection = String(details.connection || 'live')
        .trim()
        .toLowerCase();
    const pendingOffline = Math.max(0, Number(details.pendingOffline || 0));
    const ageLabel = buildSignalAgeLabel(latest);

    if (!latest || group.stale || String(group.status || '') === 'unknown') {
        return {
            id: 'kiosk_signal',
            scope: 'Kiosco',
            tone: String(group.status || '') === 'alert' ? 'alert' : 'warning',
            title: 'Kiosco sin señal reciente',
            summary:
                String(group.summary || '').trim() ||
                'No hay heartbeat reciente del kiosco. Conviene abrir la superficie antes de dejar autoservicio abierto.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Abrir kiosco',
        };
    }

    if (!details.printerPrinted) {
        return {
            id: 'kiosk_printer_pending',
            scope: 'Kiosco',
            tone: 'warning',
            title: 'Térmica pendiente en kiosco',
            summary:
                'Todavía no hay impresión OK reportada. Genera un ticket real o de prueba antes de depender del kiosco.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Probar kiosco',
        };
    }

    if (pendingOffline > 0) {
        return {
            id: 'kiosk_offline_pending',
            scope: 'Kiosco',
            tone: 'warning',
            title: 'Kiosco con pendientes offline',
            summary: `El kiosco mantiene ${pendingOffline} registro(s) sin sincronizar. Resuélvelo antes de dejar el equipo solo por mucho tiempo.`,
            meta: ageLabel,
            href: route,
            actionLabel: 'Revisar kiosco',
        };
    }

    if (connection !== 'live') {
        return {
            id: 'kiosk_connection',
            scope: 'Kiosco',
            tone: 'warning',
            title: 'Kiosco sin cola viva',
            summary:
                'El kiosco está arriba, pero la cola no figura como viva. Mantén una ruta web preparada antes de seguir recibiendo pacientes.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Revisar kiosco',
        };
    }

    return null;
}

function buildDisplayAlert(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const appConfig = manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv;
    const route = buildPreparedSurfaceUrl('sala_tv', appConfig, {
        ...preset,
        surface: 'sala_tv',
    });
    const { group, latest, details } = getLatestSurfaceDetails('display');
    const connection = String(details.connection || 'live')
        .trim()
        .toLowerCase();
    const ageLabel = buildSignalAgeLabel(latest);

    if (!latest || group.stale || String(group.status || '') === 'unknown') {
        return {
            id: 'display_signal',
            scope: 'Sala TV',
            tone: String(group.status || '') === 'alert' ? 'alert' : 'warning',
            title: 'Sala TV sin señal reciente',
            summary:
                String(group.summary || '').trim() ||
                'La TV no está enviando heartbeat reciente. Conviene abrir la app o el fallback antes del siguiente llamado.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Abrir sala TV',
        };
    }

    if (details.bellMuted) {
        return {
            id: 'display_bell_muted',
            scope: 'Sala TV',
            tone: 'alert',
            title: 'Campanilla o volumen apagados en Sala TV',
            summary:
                'La TV reporta mute o campanilla desactivada. El llamado visual puede salir, pero perderás confirmación sonora para pacientes.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Corregir audio',
        };
    }

    if (!details.bellPrimed) {
        return {
            id: 'display_bell_pending',
            scope: 'Sala TV',
            tone: 'warning',
            title: 'Sala TV sin prueba de campanilla',
            summary:
                'Falta ejecutar la prueba de audio o campanilla en la TCL C655. Hazlo antes del siguiente llamado real.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Probar sala TV',
        };
    }

    if (connection !== 'live') {
        return {
            id: 'display_connection',
            scope: 'Sala TV',
            tone: 'warning',
            title: 'Sala TV fuera de cola viva',
            summary:
                'La pantalla sigue abierta, pero no está marcando conexión viva. Conviene revisar la app o la red antes de depender de la TV.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Revisar sala TV',
        };
    }

    return null;
}

function buildQueueOpsAlerts(manifest, detectedPlatform) {
    const reviewState = ensureOpsAlertsState();
    const alerts = [
        buildQueueSyncAlert(),
        buildOperatorAlert(manifest, detectedPlatform),
        buildKioskAlert(manifest, detectedPlatform),
        buildDisplayAlert(manifest, detectedPlatform),
    ]
        .filter(Boolean)
        .map((alert) => {
            const reviewedMeta = reviewState.reviewed[String(alert.id)] || null;
            return {
                ...alert,
                reviewed: Boolean(reviewedMeta),
                reviewedAt: reviewedMeta?.reviewedAt || '',
            };
        });

    const criticalCount = alerts.filter(
        (alert) => alert.tone === 'alert'
    ).length;
    const reviewedCount = alerts.filter((alert) => alert.reviewed).length;
    const pendingCount = alerts.length - reviewedCount;
    const tone =
        criticalCount > 0 ? 'alert' : alerts.length > 0 ? 'warning' : 'ready';
    const title =
        alerts.length === 0
            ? 'Sin alertas activas'
            : criticalCount > 0
              ? 'Alertas activas del turno'
              : 'Observaciones activas del turno';
    const summary =
        alerts.length === 0
            ? 'La cola, Operador, Kiosco y Sala TV no muestran incidencias abiertas ahora mismo.'
            : criticalCount > 0
              ? `${criticalCount} alerta(s) crítica(s) y ${Math.max(0, alerts.length - criticalCount)} observación(es) activas. Marca una alerta como revisada cuando ya alguien la atendió, pero seguirá visible hasta resolverse.`
              : `${alerts.length} observación(es) activas. Usa este panel para decidir qué equipo abrir primero sin bajar por toda la pantalla.`;

    return {
        tone,
        title,
        summary,
        alerts,
        criticalCount,
        reviewedCount,
        pendingCount,
    };
}

function renderQueueOpsAlerts(manifest, detectedPlatform) {
    const root = document.getElementById('queueOpsAlerts');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const alertState = buildQueueOpsAlerts(manifest, detectedPlatform);
    setHtml(
        '#queueOpsAlerts',
        `
            <section class="queue-ops-alerts__shell" data-state="${escapeHtml(alertState.tone)}">
                <div class="queue-ops-alerts__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Prioridad viva</p>
                        <h5 id="queueOpsAlertsTitle" class="queue-app-card__title">${escapeHtml(
                            alertState.title
                        )}</h5>
                        <p id="queueOpsAlertsSummary" class="queue-ops-alerts__summary">${escapeHtml(
                            alertState.summary
                        )}</p>
                    </div>
                    <div class="queue-ops-alerts__meta">
                        <span id="queueOpsAlertsChipTotal" class="queue-ops-alerts__chip">
                            Alertas ${escapeHtml(String(alertState.alerts.length))}
                        </span>
                        <span id="queueOpsAlertsChipPending" class="queue-ops-alerts__chip">
                            Pendientes ${escapeHtml(String(alertState.pendingCount))}
                        </span>
                        <span id="queueOpsAlertsChipReviewed" class="queue-ops-alerts__chip" data-state="${escapeHtml(
                            alertState.reviewedCount > 0 ? 'reviewed' : 'idle'
                        )}">
                            Revisadas ${escapeHtml(String(alertState.reviewedCount))}
                        </span>
                        <button
                            id="queueOpsAlertsApplyBtn"
                            type="button"
                            class="queue-ops-alerts__action queue-ops-alerts__action--primary"
                            ${alertState.pendingCount > 0 ? '' : 'disabled'}
                        >
                            Marcar visibles revisadas
                        </button>
                    </div>
                </div>
                <div id="queueOpsAlertsItems" class="queue-ops-alerts__list" role="list" aria-label="Alertas activas por equipo">
                    ${
                        alertState.alerts.length > 0
                            ? alertState.alerts
                                  .map(
                                      (alert) => `
                                        <article
                                            id="queueOpsAlert_${escapeHtml(alert.id)}"
                                            class="queue-ops-alerts__item"
                                            data-state="${escapeHtml(alert.tone)}"
                                            data-reviewed="${alert.reviewed ? 'true' : 'false'}"
                                            role="listitem"
                                        >
                                            <div class="queue-ops-alerts__item-head">
                                                <div class="queue-ops-alerts__item-copy">
                                                    <span class="queue-ops-alerts__scope">${escapeHtml(
                                                        alert.scope
                                                    )}</span>
                                                    <strong>${escapeHtml(alert.title)}</strong>
                                                </div>
                                                <div class="queue-ops-alerts__item-meta">
                                                    <span class="queue-ops-alerts__severity">${escapeHtml(
                                                        alert.tone === 'alert'
                                                            ? 'Critica'
                                                            : 'Revisar'
                                                    )}</span>
                                                    ${
                                                        alert.reviewed
                                                            ? `<span class="queue-ops-alerts__reviewed">Revisada ${escapeHtml(
                                                                  formatDateTime(
                                                                      alert.reviewedAt
                                                                  )
                                                              )}</span>`
                                                            : ''
                                                    }
                                                </div>
                                            </div>
                                            <p class="queue-ops-alerts__item-summary">${escapeHtml(
                                                alert.summary
                                            )}</p>
                                            <p class="queue-ops-alerts__item-note">${escapeHtml(
                                                alert.meta
                                            )}</p>
                                            <div class="queue-ops-alerts__actions">
                                                <a
                                                    href="${escapeHtml(alert.href)}"
                                                    class="queue-ops-alerts__action queue-ops-alerts__action--primary"
                                                    target="_blank"
                                                    rel="noopener"
                                                >
                                                    ${escapeHtml(alert.actionLabel)}
                                                </a>
                                                <button
                                                    id="queueOpsAlertReview_${escapeHtml(alert.id)}"
                                                    type="button"
                                                    class="queue-ops-alerts__action"
                                                    data-queue-alert-review="${escapeHtml(alert.id)}"
                                                    data-review-state="${alert.reviewed ? 'clear' : 'review'}"
                                                >
                                                    ${escapeHtml(
                                                        alert.reviewed
                                                            ? 'Marcar pendiente otra vez'
                                                            : 'Marcar revisada'
                                                    )}
                                                </button>
                                            </div>
                                        </article>
                                    `
                                  )
                                  .join('')
                            : `
                                <article class="queue-ops-alerts__empty" role="listitem">
                                    <strong>Sin prioridades abiertas</strong>
                                    <p>La telemetría actual no muestra incidentes ni observaciones activas en cola, operador, kiosco o sala.</p>
                                </article>
                            `
                    }
                </div>
            </section>
        `
    );

    const applyButton = document.getElementById('queueOpsAlertsApplyBtn');
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            const pendingIds = alertState.alerts
                .filter((alert) => !alert.reviewed)
                .map((alert) => alert.id);
            if (!pendingIds.length) {
                return;
            }
            markOpsAlertsReviewed(pendingIds);
            appendOpsLogEntry({
                tone: alertState.criticalCount > 0 ? 'warning' : 'info',
                source: 'incident',
                title: `Alertas revisadas: ${pendingIds.length}`,
                summary: `Se marcaron como revisadas las alertas visibles del turno. Perfil activo: ${getInstallPresetLabel(
                    detectedPlatform
                )}.`,
            });
            renderQueueOpsAlerts(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    root.querySelectorAll('[data-queue-alert-review]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const alertId = String(
                button.dataset.queueAlertReview || ''
            ).trim();
            const targetAlert = alertState.alerts.find(
                (alert) => alert.id === alertId
            );
            if (!targetAlert) {
                return;
            }
            const shouldReview = button.dataset.reviewState !== 'clear';
            setOpsAlertReviewed(alertId, shouldReview);
            appendOpsLogEntry({
                tone: shouldReview ? 'info' : 'warning',
                source: 'incident',
                title: `${shouldReview ? 'Alerta revisada' : 'Alerta reabierta'}: ${targetAlert.scope}`,
                summary: shouldReview
                    ? `${targetAlert.title}. Sigue visible hasta que la condición se resuelva.`
                    : `${targetAlert.title}. La alerta vuelve al tablero pendiente del turno.`,
            });
            renderQueueOpsAlerts(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    });
}

function buildQueueFocusMode(manifest, detectedPlatform) {
    const selectedMode = ensureOpsFocusMode();
    const manifestReady = Boolean(manifest && typeof manifest === 'object');
    const syncHealth = getQueueSyncHealth();
    const openingPending =
        OPENING_CHECKLIST_STEP_IDS.length -
        OPENING_CHECKLIST_STEP_IDS.filter(
            (stepId) => ensureOpeningChecklistState().steps[stepId]
        ).length;
    const closingPending =
        SHIFT_HANDOFF_STEP_IDS.length -
        SHIFT_HANDOFF_STEP_IDS.filter(
            (stepId) => ensureShiftHandoffState().steps[stepId]
        ).length;
    const operator = getSurfaceTelemetryState('operator');
    const kiosk = getSurfaceTelemetryState('kiosk');
    const display = getSurfaceTelemetryState('display');
    const hasAlert =
        syncHealth.state === 'alert' ||
        [operator, kiosk, display].some(
            (entry) => String(entry.status || '').toLowerCase() === 'alert'
        );
    const queueClear = Boolean(
        buildShiftHandoffAssist(detectedPlatform).suggestions.queue_clear
            ?.suggested
    );
    const suggestedMode = hasAlert
        ? 'incidents'
        : openingPending > 0
          ? 'opening'
          : queueClear && closingPending > 0
            ? 'closing'
            : 'operations';
    const effectiveMode =
        selectedMode === 'auto' ? suggestedMode : selectedMode;

    if (effectiveMode === 'opening') {
        return {
            selectedMode,
            suggestedMode,
            effectiveMode,
            title: 'Modo foco: Apertura',
            summary:
                openingPending > 0
                    ? `Quedan ${openingPending} validaciones de apertura. Mantén visibles Operador, Telemetría y el checklist hasta dejar lista la mañana.`
                    : 'La apertura ya está confirmada, pero puedes revisar el checklist o ajustar la instalación del equipo.',
            primaryHref: '#queueOpeningChecklist',
            primaryLabel: 'Ir a apertura diaria',
        };
    }

    if (effectiveMode === 'incidents') {
        return {
            selectedMode,
            suggestedMode,
            effectiveMode,
            title: 'Modo foco: Incidencias',
            summary:
                syncHealth.state === 'alert'
                    ? 'La cola está degradada o en fallback. En este modo se priorizan contingencias, equipos vivos y señales críticas.'
                    : 'Mantén a la vista contingencias y equipos con señal parcial para resolver la incidencia sin distraerte con instalación o cierre.',
            primaryHref: '#queueContingencyDeck',
            primaryLabel: 'Ir a contingencias',
        };
    }

    if (effectiveMode === 'closing') {
        return {
            selectedMode,
            suggestedMode,
            effectiveMode,
            title: 'Modo foco: Cierre',
            summary:
                closingPending > 0
                    ? `La cola ya permite relevo y faltan ${closingPending} paso(s) para cerrar el turno con evidencia clara.`
                    : 'El relevo ya quedó completo; usa este foco si necesitas revisar la salida del día o copiar el resumen final.',
            primaryHref: '#queueShiftHandoff',
            primaryLabel: 'Ir a cierre y relevo',
        };
    }

    return {
        selectedMode,
        suggestedMode,
        effectiveMode: 'operations',
        title: 'Modo foco: Operación',
        summary: manifestReady
            ? 'Mantén visibles equipos en vivo, bitácora y contingencias para operar durante el día sin mezclar apertura o cierre.'
            : 'Mantén visibles equipos y bitácora mientras el hub termina de cargar el catálogo operativo.',
        primaryHref: '#queueSurfaceTelemetry',
        primaryLabel: 'Ir a equipos en vivo',
    };
}

function renderQueueFocusMode(manifest, detectedPlatform) {
    const root = document.getElementById('queueFocusMode');
    const hub = document.getElementById('queueAppsHub');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const focus = buildQueueFocusMode(manifest, detectedPlatform);
    if (hub instanceof HTMLElement) {
        hub.dataset.queueFocus = focus.effectiveMode;
        hub.dataset.queueFocusSource =
            focus.selectedMode === 'auto' ? 'auto' : 'manual';
    }

    setHtml(
        '#queueFocusMode',
        `
            <section class="queue-focus-mode__shell">
                <div class="queue-focus-mode__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Modo foco</p>
                        <h5 id="queueFocusModeTitle" class="queue-app-card__title">${escapeHtml(
                            focus.title
                        )}</h5>
                        <p id="queueFocusModeSummary" class="queue-focus-mode__summary">${escapeHtml(
                            focus.summary
                        )}</p>
                    </div>
                    <div class="queue-focus-mode__meta">
                        <span
                            id="queueFocusModeChip"
                            class="queue-focus-mode__chip"
                            data-state="${escapeHtml(
                                focus.selectedMode === 'auto'
                                    ? 'auto'
                                    : 'manual'
                            )}"
                        >
                            ${escapeHtml(
                                focus.selectedMode === 'auto'
                                    ? `Auto -> ${focus.suggestedMode}`
                                    : `Manual -> ${focus.effectiveMode}`
                            )}
                        </span>
                        <a
                            id="queueFocusModePrimary"
                            href="${escapeHtml(focus.primaryHref)}"
                            class="queue-focus-mode__primary"
                        >
                            ${escapeHtml(focus.primaryLabel)}
                        </a>
                    </div>
                </div>
                <div class="queue-focus-mode__choices" role="tablist" aria-label="Cambiar foco del hub operativo">
                    <button id="queueFocusModeAuto" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="auto" data-state="${focus.selectedMode === 'auto' ? 'active' : 'idle'}">Auto</button>
                    <button id="queueFocusModeOpening" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="opening" data-state="${focus.selectedMode === 'opening' ? 'active' : 'idle'}">Apertura</button>
                    <button id="queueFocusModeOperations" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="operations" data-state="${focus.selectedMode === 'operations' ? 'active' : 'idle'}">Operación</button>
                    <button id="queueFocusModeIncidents" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="incidents" data-state="${focus.selectedMode === 'incidents' ? 'active' : 'idle'}">Incidencias</button>
                    <button id="queueFocusModeClosing" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="closing" data-state="${focus.selectedMode === 'closing' ? 'active' : 'idle'}">Cierre</button>
                </div>
            </section>
        `
    );

    root.querySelectorAll('[data-queue-focus-mode]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            persistOpsFocusMode(button.dataset.queueFocusMode || 'auto');
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
        };
    });
}

function formatNumpadBindingLabel(binding) {
    if (!binding || typeof binding !== 'object') {
        return 'Enter integrado';
    }
    const rawCode = String(
        binding.code || binding.key || 'tecla externa'
    ).trim();
    return rawCode ? `Externa ${rawCode}` : 'Tecla externa';
}

function getQueuePendingActionCopy(pendingAction, fallbackTicket) {
    const pending =
        pendingAction && typeof pendingAction === 'object'
            ? pendingAction
            : null;
    if (!pending) {
        return '';
    }
    const action = String(pending.action || '')
        .trim()
        .toLowerCase();
    const consultorio = Number(pending.consultorio || 0) === 2 ? 'C2' : 'C1';
    const ticket =
        getQueueTicketById(pending.ticketId) || fallbackTicket || null;
    const ticketCode = ticket?.ticketCode
        ? String(ticket.ticketCode)
        : 'ticket activo';

    if (action === 'completar') {
        return `completar ${ticketCode} en ${consultorio}`;
    }
    if (action === 'no_show') {
        return `marcar no show ${ticketCode} en ${consultorio}`;
    }
    if (action === 'cancelar') {
        return `cancelar ${ticketCode} en ${consultorio}`;
    }
    if (action === 'liberar') {
        return `liberar ${ticketCode} en ${consultorio}`;
    }
    return `${action || 'confirmar acción'} ${ticketCode} en ${consultorio}`;
}

function buildQueueNumpadGuideKeyCards(state, activeTicket, nextTicket) {
    const station = Number(state.queue.stationConsultorio || 1) === 2 ? 2 : 1;
    const stationLabel = `C${station}`;
    const pendingAction = state.queue.pendingSensitiveAction;
    const pendingCopy = getQueuePendingActionCopy(pendingAction, activeTicket);

    const enterDetail = pendingCopy
        ? `Confirma ${pendingCopy}.`
        : state.queue.oneTap && activeTicket && nextTicket
          ? `Completa ${activeTicket.ticketCode} y llama ${nextTicket.ticketCode} en ${stationLabel}.`
          : state.queue.oneTap && activeTicket
            ? `Completa ${activeTicket.ticketCode}; después no queda ticket en espera para ${stationLabel}.`
            : nextTicket
              ? `Llama ${nextTicket.ticketCode} en ${stationLabel}.`
              : `Sin ticket en espera para ${stationLabel}.`;

    return [
        {
            id: 'enter',
            keyLabel: 'Enter',
            detail: enterDetail,
            state: pendingCopy
                ? 'alert'
                : nextTicket || activeTicket
                  ? 'ready'
                  : 'idle',
        },
        {
            id: 'decimal',
            keyLabel: '.',
            detail: activeTicket
                ? `Prepara completar ${activeTicket.ticketCode}.`
                : `Sin ticket llamado en ${stationLabel}.`,
            state: activeTicket ? 'ready' : 'idle',
        },
        {
            id: 'subtract',
            keyLabel: '-',
            detail: activeTicket
                ? `Prepara no show para ${activeTicket.ticketCode}.`
                : `Sin ticket llamado en ${stationLabel}.`,
            state: activeTicket ? 'ready' : 'idle',
        },
        {
            id: 'add',
            keyLabel: '+',
            detail: activeTicket
                ? `Re-llama ${activeTicket.ticketCode} sin cambiar estación.`
                : `Sin ticket llamado en ${stationLabel}.`,
            state: activeTicket ? 'ready' : 'idle',
        },
        {
            id: 'station',
            keyLabel: '1 / 2',
            detail:
                state.queue.stationMode === 'locked'
                    ? `Bloqueado en ${stationLabel}; 1/2 no cambian estación ahora.`
                    : `1/2 cambian la estación activa antes del siguiente llamado.`,
            state: state.queue.stationMode === 'locked' ? 'warning' : 'ready',
        },
    ];
}

function buildQueueNumpadGuide(manifest, detectedPlatform) {
    const state = getState();
    const station = Number(state.queue.stationConsultorio || 1) === 2 ? 2 : 1;
    const stationLabel = `C${station}`;
    const adminModeLabel =
        state.queue.stationMode === 'locked' ? 'fijo' : 'libre';
    const activeTicket = getActiveCalledTicketForStation();
    const nextTicket = getWaitingForConsultorio(station);
    const pendingAction = state.queue.pendingSensitiveAction;
    const pendingCopy = getQueuePendingActionCopy(pendingAction, activeTicket);
    const bindingLabel = formatNumpadBindingLabel(state.queue.customCallKey);
    const operator = getLatestSurfaceDetails('operator');
    const operatorStation = String(operator.details.station || '')
        .trim()
        .toUpperCase();
    const operatorModeLabel =
        String(operator.details.stationMode || '')
            .trim()
            .toLowerCase() === 'locked'
            ? 'fijo'
            : 'libre';
    const operatorProfileLabel = operatorStation
        ? `${operatorStation} ${operatorModeLabel}`
        : 'sin señal';
    const operatorMismatch =
        operatorStation &&
        (operatorStation !== stationLabel ||
            (String(operator.details.stationMode || '')
                .trim()
                .toLowerCase() ===
                'locked') !==
                (state.queue.stationMode === 'locked'));
    const preset = ensureInstallPreset(detectedPlatform);
    const operatorUrl = buildPreparedSurfaceUrl(
        'operator',
        manifest.operator || DEFAULT_APP_DOWNLOADS.operator,
        {
            ...preset,
            surface: 'operator',
            station: station === 2 ? 'c2' : 'c1',
            lock: state.queue.stationMode === 'locked',
            oneTap: Boolean(state.queue.oneTap),
        }
    );

    let tone = 'ready';
    let summary = `Admin en ${stationLabel} ${adminModeLabel}.`;
    let supportCopy =
        'Usa este bloque para saber qué hará el siguiente toque del Genius Numpad 1000 antes de pulsarlo.';

    if (state.queue.captureCallKeyMode) {
        tone = 'warning';
        summary =
            'Calibración activa: la próxima tecla externa quedará ligada al llamado del operador.';
        supportCopy =
            'Pulsa ahora la tecla del Genius Numpad 1000 que quieras mapear y evita tocar Enter hasta cerrar la calibración.';
    } else if (pendingCopy) {
        tone = 'alert';
        summary = `Enter confirmará ${pendingCopy}.`;
        supportCopy =
            'La acción sensible ya quedó preparada. Enter confirma y Escape cancela antes de seguir llamando.';
    } else if (operatorMismatch) {
        tone = 'warning';
        summary = `Admin en ${stationLabel} ${adminModeLabel}, pero Operador reporta ${operatorProfileLabel}.`;
        supportCopy =
            'Alinea la estación o el lock antes de llamar desde el numpad para evitar operar sobre el consultorio equivocado.';
    } else if (state.queue.oneTap && activeTicket && nextTicket) {
        tone = 'active';
        summary = `Enter completará ${activeTicket.ticketCode} y llamará ${nextTicket.ticketCode} en ${stationLabel}.`;
        supportCopy =
            'Con 1 tecla activo, una sola pulsación de Enter cierra el ticket actual y avanza la cola del mismo consultorio.';
    } else if (state.queue.oneTap && activeTicket) {
        tone = 'active';
        summary = `Enter completará ${activeTicket.ticketCode}; después no quedará siguiente ticket en espera.`;
        supportCopy =
            '1 tecla sigue activa, pero no hay otro paciente listo para llamar en esta estación.';
    } else if (nextTicket) {
        tone = 'ready';
        summary = `Enter llamará ${nextTicket.ticketCode} en ${stationLabel}.`;
        supportCopy =
            'Usa Decimal o Subtract solo si ya hay un ticket activo en la estación y necesitas una acción sensible.';
    } else {
        summary = `No hay ticket en espera para ${stationLabel}.`;
        supportCopy =
            'El numpad sigue listo, pero ahora mismo Enter no avanzará la cola hasta que llegue otro ticket.';
    }

    return {
        tone,
        title: 'Numpad en vivo',
        summary,
        supportCopy,
        chips: [
            { id: 'station', label: `Admin ${stationLabel} ${adminModeLabel}` },
            { id: 'operator', label: `Operador ${operatorProfileLabel}` },
            {
                id: 'one_tap',
                label: `1 tecla ${state.queue.oneTap ? 'ON' : 'OFF'}`,
            },
            { id: 'binding', label: bindingLabel },
        ],
        actions: {
            operatorUrl,
            oneTapLabel: state.queue.oneTap
                ? 'Desactivar 1 tecla'
                : 'Activar 1 tecla',
        },
        keyCards: buildQueueNumpadGuideKeyCards(
            state,
            activeTicket,
            nextTicket
        ),
    };
}

function renderQueueNumpadGuide(manifest, detectedPlatform) {
    const root = document.getElementById('queueNumpadGuide');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const guide = buildQueueNumpadGuide(manifest, detectedPlatform);
    setHtml(
        '#queueNumpadGuide',
        `
            <section class="queue-numpad-guide__shell" data-state="${escapeHtml(guide.tone)}">
                <div class="queue-numpad-guide__header">
                    <div class="queue-numpad-guide__copy">
                        <p class="queue-app-card__eyebrow">Genius Numpad 1000</p>
                        <h5 id="queueNumpadGuideTitle" class="queue-app-card__title">${escapeHtml(
                            guide.title
                        )}</h5>
                        <p id="queueNumpadGuideSummary" class="queue-numpad-guide__summary">${escapeHtml(
                            guide.summary
                        )}</p>
                        <p class="queue-numpad-guide__support">${escapeHtml(
                            guide.supportCopy
                        )}</p>
                    </div>
                    <div class="queue-numpad-guide__meta">
                        <span id="queueNumpadGuideChipStation" class="queue-numpad-guide__chip">
                            ${escapeHtml(guide.chips[0].label)}
                        </span>
                        <span id="queueNumpadGuideChipOperator" class="queue-numpad-guide__chip">
                            ${escapeHtml(guide.chips[1].label)}
                        </span>
                        <span id="queueNumpadGuideChipOneTap" class="queue-numpad-guide__chip">
                            ${escapeHtml(guide.chips[2].label)}
                        </span>
                        <span id="queueNumpadGuideChipBinding" class="queue-numpad-guide__chip">
                            ${escapeHtml(guide.chips[3].label)}
                        </span>
                    </div>
                </div>
                <div id="queueNumpadGuideActions" class="queue-numpad-guide__actions">
                    <button
                        id="queueNumpadGuideToggleOneTap"
                        type="button"
                        class="queue-numpad-guide__action queue-numpad-guide__action--primary"
                    >
                        ${escapeHtml(guide.actions.oneTapLabel)}
                    </button>
                    <button
                        id="queueNumpadGuideCaptureKey"
                        type="button"
                        class="queue-numpad-guide__action"
                    >
                        Calibrar tecla externa
                    </button>
                    <a
                        id="queueNumpadGuideOpenOperator"
                        href="${escapeHtml(guide.actions.operatorUrl)}"
                        class="queue-numpad-guide__action"
                        target="_blank"
                        rel="noopener"
                    >
                        Abrir operador
                    </a>
                </div>
                <div id="queueNumpadGuideKeys" class="queue-numpad-guide__keys" role="list" aria-label="Acciones vivas del numpad">
                    ${guide.keyCards
                        .map(
                            (card) => `
                                <article
                                    id="queueNumpadGuideKey_${escapeHtml(card.id)}"
                                    class="queue-numpad-guide__key"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <strong>${escapeHtml(card.keyLabel)}</strong>
                                    <p>${escapeHtml(card.detail)}</p>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    const toggleOneTapButton = document.getElementById(
        'queueNumpadGuideToggleOneTap'
    );
    if (toggleOneTapButton instanceof HTMLButtonElement) {
        toggleOneTapButton.onclick = () => {
            const stationToggle = document.querySelector(
                '#queueStationControl [data-action="queue-toggle-one-tap"]'
            );
            if (stationToggle instanceof HTMLButtonElement) {
                stationToggle.click();
            }
        };
    }

    const captureKeyButton = document.getElementById(
        'queueNumpadGuideCaptureKey'
    );
    if (captureKeyButton instanceof HTMLButtonElement) {
        captureKeyButton.onclick = () => {
            const stationCapture = document.querySelector(
                '#queueStationControl [data-action="queue-capture-call-key"]'
            );
            if (stationCapture instanceof HTMLButtonElement) {
                stationCapture.click();
            }
        };
    }
}

function formatQueueTicketAgeLabel(ticket, mode) {
    const timestampMs = getQueueTicketTimestampMs(ticket, mode);
    if (!Number.isFinite(timestampMs)) {
        return mode === 'called'
            ? 'sin marca de llamado'
            : 'sin marca de espera';
    }

    const ageSec = Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
    return mode === 'called'
        ? `llamado hace ${formatHeartbeatAge(ageSec)}`
        : `espera hace ${formatHeartbeatAge(ageSec)}`;
}

function getQueueTicketAgeSec(ticket, mode = 'waiting') {
    const timestampMs = getQueueTicketTimestampMs(ticket, mode);
    if (!Number.isFinite(timestampMs)) {
        return null;
    }
    return Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
}

function getQueueTicketTimestampMs(ticket, mode = 'waiting') {
    const rawTimestamp =
        mode === 'called' ? ticket?.calledAt : ticket?.createdAt;
    return Date.parse(String(rawTimestamp || ''));
}

function getSortedWaitingTickets() {
    return getQueueSource()
        .queueTickets.filter((ticket) => ticket.status === 'waiting')
        .sort((left, right) => {
            const leftMs = getQueueTicketTimestampMs(left, 'waiting');
            const rightMs = getQueueTicketTimestampMs(right, 'waiting');
            if (Number.isFinite(leftMs) && Number.isFinite(rightMs)) {
                return leftMs - rightMs;
            }
            if (Number.isFinite(leftMs)) {
                return -1;
            }
            if (Number.isFinite(rightMs)) {
                return 1;
            }
            return Number(left.id || 0) - Number(right.id || 0);
        });
}

function getUnassignedWaitingTickets() {
    return getSortedWaitingTickets().filter(
        (ticket) => !Number(ticket.assignedConsultorio || 0)
    );
}

function getAssignedWaitingTickets(consultorio) {
    const target = Number(consultorio || 0) === 2 ? 2 : 1;
    return getSortedWaitingTickets().filter(
        (ticket) => Number(ticket.assignedConsultorio || 0) === target
    );
}

function buildConsultorioOperatorContext(
    manifest,
    detectedPlatform,
    consultorio
) {
    const slot = Number(consultorio || 0) === 2 ? 2 : 1;
    const slotKey = `c${slot}`;
    const operator = getLatestSurfaceDetails('operator');
    const operatorStation = String(operator.details.station || '')
        .trim()
        .toLowerCase();
    const operatorLocked =
        String(operator.details.stationMode || '')
            .trim()
            .toLowerCase() === 'locked';
    const operatorAssigned = operatorStation === slotKey;
    const operatorLive =
        Boolean(operator.latest) &&
        !operator.group.stale &&
        String(operator.group.status || '')
            .trim()
            .toLowerCase() !== 'unknown';
    const operatorLabel = operatorAssigned
        ? `Operador ${slotKey.toUpperCase()} ${operatorLocked ? 'fijo' : 'libre'}`
        : operatorLive
          ? `Operador activo en ${String(operatorStation || 'otra estación').toUpperCase()}`
          : `Sin operador dedicado`;
    const operatorUrl = buildPreparedSurfaceUrl(
        'operator',
        manifest.operator || DEFAULT_APP_DOWNLOADS.operator,
        {
            ...ensureInstallPreset(detectedPlatform),
            surface: 'operator',
            station: slotKey,
            lock: true,
        }
    );
    return {
        slot,
        slotKey,
        operator,
        operatorStation,
        operatorLocked,
        operatorAssigned,
        operatorLive,
        operatorLabel,
        operatorUrl,
        oneTapLabel: operatorAssigned
            ? `1 tecla ${operator.details.oneTap ? 'ON' : 'OFF'}`
            : '1 tecla sin validar',
        numpadLabel: operatorAssigned
            ? operator.details.numpadSeen
                ? 'Numpad listo'
                : 'Numpad pendiente'
            : 'Numpad sin señal',
        heartbeatLabel: buildSignalAgeLabel(operator.latest, 'Sin heartbeat'),
    };
}

function buildConsultorioBoardCard(manifest, detectedPlatform, consultorio) {
    const operatorContext = buildConsultorioOperatorContext(
        manifest,
        detectedPlatform,
        consultorio
    );
    const {
        slot,
        slotKey,
        operatorAssigned,
        operatorLive,
        operatorLabel,
        operatorUrl,
        oneTapLabel,
        numpadLabel,
        heartbeatLabel,
    } = operatorContext;
    const currentTicket = getCalledTicketForConsultorio(slot);
    const nextTicket = getWaitingForConsultorio(slot);

    let state = 'idle';
    let badge = 'Sin cola';
    let summary =
        'No hay ticket activo ni en espera para este consultorio en este momento.';
    let primaryLabel = 'Sin ticket listo';
    let primaryAction = 'none';

    if (currentTicket) {
        state = 'active';
        badge = 'Llamado activo';
        summary = `${currentTicket.ticketCode} sigue en atención. Puedes re-llamar o liberar ${slotKey.toUpperCase()} sin salir del hub.`;
        primaryLabel = `Re-llamar ${currentTicket.ticketCode}`;
        primaryAction = 'recall';
    } else if (nextTicket && operatorAssigned && operatorLive) {
        state = 'ready';
        badge = 'Listo para llamar';
        summary = `${nextTicket.ticketCode} ya puede llamarse desde ${slotKey.toUpperCase()} con el operador correcto arriba y heartbeat vigente.`;
        primaryLabel = `Llamar ${nextTicket.ticketCode}`;
        primaryAction = 'call';
    } else if (nextTicket) {
        state = 'warning';
        badge = 'Falta operador';
        summary = `${nextTicket.ticketCode} está listo, pero ${slotKey.toUpperCase()} todavía no tiene un operador dedicado o señal suficiente para confiar en el llamado rápido.`;
        primaryLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
        primaryAction = 'open';
    } else if (!operatorAssigned) {
        state = operatorLive ? 'warning' : 'idle';
        badge = operatorLive ? 'Sin operador dedicado' : 'Sin señal';
        summary = operatorLive
            ? `${slotKey.toUpperCase()} no coincide con el operador reportado. Conviene abrir el operador correcto antes del siguiente pico de atención.`
            : `Todavía no hay heartbeat del operador preparado para ${slotKey.toUpperCase()}.`;
        primaryLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
        primaryAction = 'open';
    } else if (operatorAssigned && operatorLive) {
        state = 'ready';
        badge = 'Listo hoy';
        summary = `${slotKey.toUpperCase()} ya tiene operador en vivo y puede recibir el siguiente ticket en cuanto entre a la cola.`;
        primaryLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
        primaryAction = 'open';
    }

    return {
        slot,
        slotKey,
        state,
        badge,
        operatorUrl,
        operatorLabel,
        oneTapLabel,
        numpadLabel,
        heartbeatLabel,
        summary,
        currentLabel: currentTicket
            ? `${currentTicket.ticketCode} · ${formatQueueTicketAgeLabel(
                  currentTicket,
                  'called'
              )}`
            : 'Sin llamado',
        nextLabel: nextTicket
            ? `${nextTicket.ticketCode} · ${formatQueueTicketAgeLabel(
                  nextTicket,
                  'waiting'
              )}`
            : 'Sin ticket en espera',
        primaryLabel,
        primaryAction,
        canRelease: Boolean(currentTicket),
        currentTicketId: Number(currentTicket?.id || 0),
    };
}

function buildConsultorioBoard(manifest, detectedPlatform) {
    const cards = [1, 2].map((consultorio) =>
        buildConsultorioBoardCard(manifest, detectedPlatform, consultorio)
    );
    const activeCount = cards.filter((card) => card.state === 'active').length;
    const readyCount = cards.filter(
        (card) => card.state === 'ready' || card.state === 'active'
    ).length;
    const warningCount = cards.filter(
        (card) => card.state === 'warning' || card.state === 'alert'
    ).length;

    const title =
        warningCount > 0
            ? 'Mesa por consultorio con pendientes'
            : 'Mesa por consultorio lista';
    const summary =
        warningCount > 0
            ? 'Cada tarjeta resume C1 y C2 con ticket actual, siguiente en cola y el operador esperado para resolver el turno sin navegar por toda la tabla.'
            : 'C1 y C2 ya muestran su contexto operativo directo: ticket activo, siguiente en cola y acceso inmediato al operador correcto.';

    return {
        title,
        summary,
        statusLabel:
            warningCount > 0
                ? `${warningCount} pendiente(s)`
                : readyCount > 0
                  ? `${readyCount}/2 listo(s)`
                  : 'Sin cola ahora',
        statusState:
            warningCount > 0 ? 'warning' : readyCount > 0 ? 'ready' : 'idle',
        chips: [
            `Activos ${activeCount}`,
            `Listos ${readyCount}`,
            `Pendientes ${warningCount}`,
        ],
        cards,
    };
}

function renderConsultorioBoard(manifest, detectedPlatform) {
    const root = document.getElementById('queueConsultorioBoard');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const board = buildConsultorioBoard(manifest, detectedPlatform);
    setHtml(
        '#queueConsultorioBoard',
        `
            <section class="queue-consultorio-board__shell" data-state="${escapeHtml(
                board.statusState
            )}">
                <div class="queue-consultorio-board__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Mesa por consultorio</p>
                        <h5 id="queueConsultorioBoardTitle" class="queue-app-card__title">${escapeHtml(
                            board.title
                        )}</h5>
                        <p id="queueConsultorioBoardSummary" class="queue-consultorio-board__summary">${escapeHtml(
                            board.summary
                        )}</p>
                    </div>
                    <div class="queue-consultorio-board__meta">
                        <span
                            id="queueConsultorioBoardStatus"
                            class="queue-consultorio-board__status"
                            data-state="${escapeHtml(board.statusState)}"
                        >
                            ${escapeHtml(board.statusLabel)}
                        </span>
                        <div class="queue-consultorio-board__chips">
                            ${board.chips
                                .map(
                                    (chip) =>
                                        `<span class="queue-consultorio-board__chip">${escapeHtml(
                                            chip
                                        )}</span>`
                                )
                                .join('')}
                        </div>
                    </div>
                </div>
                <div id="queueConsultorioBoardCards" class="queue-consultorio-board__grid" role="list" aria-label="Estado vivo por consultorio">
                    ${board.cards
                        .map(
                            (card) => `
                                <article
                                    id="queueConsultorioCard_${escapeHtml(card.slotKey)}"
                                    class="queue-consultorio-card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-consultorio-card__header">
                                        <div>
                                            <strong>${escapeHtml(
                                                card.slotKey.toUpperCase()
                                            )}</strong>
                                            <p class="queue-consultorio-card__operator">${escapeHtml(
                                                card.operatorLabel
                                            )}</p>
                                        </div>
                                        <span class="queue-consultorio-card__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p class="queue-consultorio-card__summary">${escapeHtml(
                                        card.summary
                                    )}</p>
                                    <div class="queue-consultorio-card__facts">
                                        <div class="queue-consultorio-card__fact">
                                            <span>Ahora</span>
                                            <strong id="queueConsultorioCurrent_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.currentLabel)}</strong>
                                        </div>
                                        <div class="queue-consultorio-card__fact">
                                            <span>Siguiente</span>
                                            <strong id="queueConsultorioNext_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.nextLabel)}</strong>
                                        </div>
                                    </div>
                                    <div class="queue-consultorio-card__chips">
                                        <span class="queue-consultorio-card__chip">${escapeHtml(
                                            card.oneTapLabel
                                        )}</span>
                                        <span class="queue-consultorio-card__chip">${escapeHtml(
                                            card.numpadLabel
                                        )}</span>
                                        <span class="queue-consultorio-card__chip">${escapeHtml(
                                            card.heartbeatLabel
                                        )}</span>
                                    </div>
                                    <div class="queue-consultorio-card__actions">
                                        <button
                                            id="queueConsultorioPrimary_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            type="button"
                                            class="queue-consultorio-card__action queue-consultorio-card__action--primary"
                                            data-queue-consultorio-action="${escapeHtml(
                                                card.primaryAction
                                            )}"
                                            data-queue-consultorio="${escapeHtml(
                                                String(card.slot)
                                            )}"
                                            data-queue-ticket-id="${escapeHtml(
                                                String(card.currentTicketId)
                                            )}"
                                            ${card.primaryAction === 'none' ? 'disabled' : ''}
                                        >
                                            ${escapeHtml(card.primaryLabel)}
                                        </button>
                                        <button
                                            id="queueConsultorioRelease_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            type="button"
                                            class="queue-consultorio-card__action"
                                            data-queue-consultorio-release="${escapeHtml(
                                                String(card.slot)
                                            )}"
                                            ${card.canRelease ? '' : 'disabled'}
                                        >
                                            Liberar ${escapeHtml(card.slotKey.toUpperCase())}
                                        </button>
                                        <a
                                            id="queueConsultorioOpenOperator_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            href="${escapeHtml(card.operatorUrl)}"
                                            class="queue-consultorio-card__action"
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            Operador ${escapeHtml(card.slotKey.toUpperCase())}
                                        </a>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    board.cards.forEach((card) => {
        const primaryButton = document.getElementById(
            `queueConsultorioPrimary_${card.slotKey}`
        );
        if (primaryButton instanceof HTMLButtonElement) {
            primaryButton.onclick = () => {
                if (card.primaryAction === 'call') {
                    const headerButton = document.querySelector(
                        `#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="${card.slot}"]`
                    );
                    if (headerButton instanceof HTMLButtonElement) {
                        headerButton.click();
                    }
                    return;
                }

                if (
                    card.primaryAction === 'recall' &&
                    card.currentTicketId > 0
                ) {
                    const recallButton = document.querySelector(
                        `[data-action="queue-ticket-action"][data-queue-id="${card.currentTicketId}"][data-queue-action="re-llamar"]`
                    );
                    if (recallButton instanceof HTMLButtonElement) {
                        recallButton.click();
                        return;
                    }
                }

                if (card.primaryAction === 'open') {
                    window.open(card.operatorUrl, '_blank', 'noopener');
                }
            };
        }

        const releaseButton = document.getElementById(
            `queueConsultorioRelease_${card.slotKey}`
        );
        if (releaseButton instanceof HTMLButtonElement) {
            releaseButton.onclick = () => {
                const targetButton = document.getElementById(
                    card.slot === 2 ? 'queueReleaseC2' : 'queueReleaseC1'
                );
                if (targetButton instanceof HTMLButtonElement) {
                    targetButton.click();
                }
            };
        }
    });
}

function buildQueueWaitRadarSeverity({ ageSec, backlog, operatorReady }) {
    const safeBacklog = Math.max(0, Number(backlog || 0));
    const safeAgeSec = Number.isFinite(Number(ageSec)) ? Number(ageSec) : null;

    if (safeBacklog <= 0) {
        return {
            state: 'idle',
            badge: 'Sin cola',
            support: 'Sin presión de espera por ahora.',
        };
    }

    if (
        (safeAgeSec !== null && safeAgeSec >= 15 * 60) ||
        safeBacklog >= 4 ||
        (!operatorReady && safeAgeSec !== null && safeAgeSec >= 8 * 60)
    ) {
        return {
            state: 'alert',
            badge: 'Atender ya',
            support:
                safeAgeSec !== null
                    ? `Espera máxima ${formatHeartbeatAge(safeAgeSec)}.`
                    : 'Hay demasiada presión acumulada.',
        };
    }

    if (
        (safeAgeSec !== null && safeAgeSec >= 8 * 60) ||
        safeBacklog >= 2 ||
        !operatorReady
    ) {
        return {
            state: 'warning',
            badge: 'Vigilar',
            support:
                safeAgeSec !== null
                    ? `Espera máxima ${formatHeartbeatAge(safeAgeSec)}.`
                    : 'Hace falta vigilar esta línea.',
        };
    }

    return {
        state: 'ready',
        badge: 'Bajo control',
        support:
            safeAgeSec !== null
                ? `Espera máxima ${formatHeartbeatAge(safeAgeSec)}.`
                : 'Cola controlada.',
    };
}

function buildQueueWaitRadarLaneCard(manifest, detectedPlatform, laneKey) {
    if (laneKey === 'general') {
        const generalWaiting = getUnassignedWaitingTickets();
        const oldestGeneral = generalWaiting[0] || null;
        const c1Dispatch = buildQueueDispatchCard(
            manifest,
            detectedPlatform,
            1
        );
        const c2Dispatch = buildQueueDispatchCard(
            manifest,
            detectedPlatform,
            2
        );
        const assignOptions = [c1Dispatch, c2Dispatch].filter(
            (card) =>
                card.primaryAction === 'assign' &&
                card.targetTicketId === Number(oldestGeneral?.id || 0)
        );
        const preferredAssign =
            assignOptions.sort((left, right) => left.slot - right.slot)[0] ||
            null;
        const fallbackOpen = [c1Dispatch, c2Dispatch].find(
            (card) => card.primaryAction === 'open'
        );
        const severity = buildQueueWaitRadarSeverity({
            ageSec: getQueueTicketAgeSec(oldestGeneral, 'waiting'),
            backlog: generalWaiting.length,
            operatorReady: Boolean(preferredAssign),
        });

        if (!oldestGeneral) {
            return {
                laneKey: 'general',
                laneLabel: 'General',
                state: 'idle',
                badge: 'Sin cola',
                headline: 'Cola general al día',
                detail: 'No hay tickets sin consultorio esperando despacho en este momento.',
                oldestLabel: 'Sin ticket pendiente',
                pressureLabel: 'General 0 · C1 0 · C2 0',
                recommendationLabel: 'Sin movimiento urgente',
                chips: ['Sin consultorio 0', 'Operación estable'],
                primaryLabel: 'Sin acción',
                actionCard: null,
            };
        }

        let detail =
            'Es el ticket más antiguo sin consultorio y merece la próxima revisión del turno.';
        let recommendationLabel = 'Abrir cola admin';
        let actionCard = null;
        const chips = [`Sin consultorio ${generalWaiting.length}`];

        if (preferredAssign) {
            detail = `${preferredAssign.slotKey.toUpperCase()} está en mejor posición para absorber este ticket sin bajar a la tabla completa.`;
            recommendationLabel = `Asignar ${oldestGeneral.ticketCode} a ${preferredAssign.slotKey.toUpperCase()}`;
            actionCard = {
                ...preferredAssign,
                primaryLabel: recommendationLabel,
            };
            chips.push(`Recomendado ${preferredAssign.slotKey.toUpperCase()}`);
        } else if (fallbackOpen) {
            detail = `La cola general ya tiene presión, pero todavía falta dejar listo el operador recomendado antes de reasignar con confianza.`;
            recommendationLabel = `Abrir Operador ${fallbackOpen.slotKey.toUpperCase()}`;
            actionCard = {
                ...fallbackOpen,
                primaryLabel: recommendationLabel,
            };
            chips.push(`Falta ${fallbackOpen.slotKey.toUpperCase()}`);
        } else {
            chips.push('Sin operador listo');
        }

        chips.push(severity.support);

        return {
            laneKey: 'general',
            laneLabel: 'General',
            state: severity.state,
            badge: severity.badge,
            headline: `${oldestGeneral.ticketCode} lidera la cola general`,
            detail,
            oldestLabel: `${oldestGeneral.ticketCode} · ${formatQueueTicketAgeLabel(
                oldestGeneral,
                'waiting'
            )}`,
            pressureLabel: `General ${generalWaiting.length} · C1 ${
                getAssignedWaitingTickets(1).length
            } · C2 ${getAssignedWaitingTickets(2).length}`,
            recommendationLabel,
            chips,
            primaryLabel: actionCard ? actionCard.primaryLabel : 'Sin acción',
            actionCard,
        };
    }

    const slot = laneKey === 'c2' ? 2 : 1;
    const operatorContext = buildConsultorioOperatorContext(
        manifest,
        detectedPlatform,
        slot
    );
    const dispatchCard = buildQueueDispatchCard(
        manifest,
        detectedPlatform,
        slot
    );
    const ownWaiting = getAssignedWaitingTickets(slot);
    const generalWaiting = getUnassignedWaitingTickets();
    const currentTicket = getCalledTicketForConsultorio(slot);
    const candidateTicket =
        ownWaiting[0] ||
        ((dispatchCard.primaryAction === 'assign' ||
            dispatchCard.primaryAction === 'rebalance') &&
        dispatchCard.targetTicketId > 0
            ? getQueueTicketById(dispatchCard.targetTicketId)
            : null);
    const demandCount = ownWaiting.length
        ? ownWaiting.length
        : dispatchCard.primaryAction === 'assign'
          ? generalWaiting.length
          : dispatchCard.primaryAction === 'rebalance'
            ? getAssignedWaitingTickets(slot === 2 ? 1 : 2).length
            : 0;

    if (!candidateTicket && currentTicket) {
        return {
            laneKey,
            laneLabel: laneKey.toUpperCase(),
            state: 'active',
            badge: 'En atención',
            headline: `${currentTicket.ticketCode} está en consulta`,
            detail: `No hay espera nueva para ${laneKey.toUpperCase()}, pero el consultorio sigue ocupado y listo para retomar el siguiente turno desde el mismo hub.`,
            oldestLabel: `${currentTicket.ticketCode} · ${formatQueueTicketAgeLabel(
                currentTicket,
                'called'
            )}`,
            pressureLabel: `Propios ${ownWaiting.length} · General ${generalWaiting.length}`,
            recommendationLabel: dispatchCard.primaryLabel,
            chips: [
                operatorContext.operatorLabel,
                operatorContext.oneTapLabel,
                operatorContext.heartbeatLabel,
            ],
            primaryLabel: dispatchCard.primaryLabel,
            actionCard:
                dispatchCard.primaryAction === 'none' ? null : dispatchCard,
        };
    }

    if (!candidateTicket) {
        return {
            laneKey,
            laneLabel: laneKey.toUpperCase(),
            state:
                operatorContext.operatorAssigned && operatorContext.operatorLive
                    ? 'ready'
                    : 'idle',
            badge:
                operatorContext.operatorAssigned && operatorContext.operatorLive
                    ? 'Listo'
                    : 'Sin cola',
            headline:
                operatorContext.operatorAssigned && operatorContext.operatorLive
                    ? `${laneKey.toUpperCase()} listo para absorber demanda`
                    : `${laneKey.toUpperCase()} sin espera propia`,
            detail:
                operatorContext.operatorAssigned && operatorContext.operatorLive
                    ? `No hay tickets esperando ahora, pero ${laneKey.toUpperCase()} ya tiene operador y heartbeat para responder al siguiente ingreso.`
                    : `No hay presión visible en ${laneKey.toUpperCase()} y todavía no hace falta una acción rápida desde el radar.`,
            oldestLabel: 'Sin ticket pendiente',
            pressureLabel: `Propios ${ownWaiting.length} · General ${generalWaiting.length}`,
            recommendationLabel: dispatchCard.primaryLabel,
            chips: [
                operatorContext.operatorLabel,
                operatorContext.oneTapLabel,
                operatorContext.heartbeatLabel,
            ],
            primaryLabel:
                dispatchCard.primaryAction === 'none'
                    ? 'Sin acción'
                    : dispatchCard.primaryLabel,
            actionCard:
                dispatchCard.primaryAction === 'none' ? null : dispatchCard,
        };
    }

    const severity = buildQueueWaitRadarSeverity({
        ageSec: getQueueTicketAgeSec(candidateTicket, 'waiting'),
        backlog: demandCount,
        operatorReady:
            dispatchCard.primaryAction !== 'open' &&
            dispatchCard.primaryAction !== 'none',
    });
    const badge =
        dispatchCard.primaryAction === 'open'
            ? 'Falta operador'
            : severity.badge;

    return {
        laneKey,
        laneLabel: laneKey.toUpperCase(),
        state:
            dispatchCard.primaryAction === 'open' && severity.state === 'ready'
                ? 'warning'
                : severity.state,
        badge,
        headline: `${candidateTicket.ticketCode} presiona ${laneKey.toUpperCase()}`,
        detail: dispatchCard.detail,
        oldestLabel: `${candidateTicket.ticketCode} · ${formatQueueTicketAgeLabel(
            candidateTicket,
            'waiting'
        )}`,
        pressureLabel: `Propios ${ownWaiting.length} · General ${generalWaiting.length}`,
        recommendationLabel: dispatchCard.primaryLabel,
        chips: [
            operatorContext.operatorLabel,
            operatorContext.oneTapLabel,
            severity.support,
        ],
        primaryLabel: dispatchCard.primaryLabel,
        actionCard: dispatchCard.primaryAction === 'none' ? null : dispatchCard,
    };
}

function buildQueueWaitRadar(manifest, detectedPlatform) {
    const cards = ['general', 'c1', 'c2'].map((laneKey) =>
        buildQueueWaitRadarLaneCard(manifest, detectedPlatform, laneKey)
    );
    const alertCount = cards.filter((card) => card.state === 'alert').length;
    const warningCount = cards.filter(
        (card) => card.state === 'warning'
    ).length;
    const actionableCount = cards.filter((card) => card.actionCard).length;
    const oldestAgeSec = getSortedWaitingTickets().reduce((maxAge, ticket) => {
        const ageSec = getQueueTicketAgeSec(ticket, 'waiting');
        return ageSec !== null ? Math.max(maxAge, ageSec) : maxAge;
    }, 0);

    return {
        title:
            alertCount > 0
                ? 'Radar de espera en rojo'
                : warningCount > 0
                  ? 'Radar de espera con presión'
                  : 'Radar de espera bajo control',
        summary:
            alertCount > 0
                ? 'La cola ya muestra una espera que conviene atender antes de seguir navegando por otras tarjetas del hub.'
                : warningCount > 0
                  ? 'El radar agrupa la línea más vieja por cola general y consultorio para que recepción vea primero dónde está subiendo la presión.'
                  : 'No hay presión visible: la cola general y ambos consultorios están bajo control por ahora.',
        statusLabel:
            alertCount > 0
                ? `${alertCount} en rojo`
                : warningCount > 0
                  ? `${warningCount} por vigilar`
                  : 'Sin espera crítica',
        statusState:
            alertCount > 0 ? 'alert' : warningCount > 0 ? 'warning' : 'ready',
        chips: [
            `Acciones ${actionableCount}`,
            `Alertas ${alertCount}`,
            oldestAgeSec > 0
                ? `Espera máxima ${formatHeartbeatAge(oldestAgeSec)}`
                : 'Espera máxima 0s',
        ],
        cards,
    };
}

async function runQueueWaitRadarAction(card, manifest, detectedPlatform) {
    if (!card?.actionCard) {
        return;
    }
    await runQueueDispatchAction(card.actionCard, manifest, detectedPlatform);
}

function renderQueueWaitRadar(manifest, detectedPlatform) {
    const root = document.getElementById('queueWaitRadar');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const radar = buildQueueWaitRadar(manifest, detectedPlatform);
    setHtml(
        '#queueWaitRadar',
        `
            <section class="queue-wait-radar__shell" data-state="${escapeHtml(
                radar.statusState
            )}">
                <div class="queue-wait-radar__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Radar de espera</p>
                        <h5 id="queueWaitRadarTitle" class="queue-app-card__title">${escapeHtml(
                            radar.title
                        )}</h5>
                        <p id="queueWaitRadarSummary" class="queue-wait-radar__summary">${escapeHtml(
                            radar.summary
                        )}</p>
                    </div>
                    <div class="queue-wait-radar__meta">
                        <span
                            id="queueWaitRadarStatus"
                            class="queue-wait-radar__status"
                            data-state="${escapeHtml(radar.statusState)}"
                        >
                            ${escapeHtml(radar.statusLabel)}
                        </span>
                        <div class="queue-wait-radar__chips">
                            ${radar.chips
                                .map(
                                    (chip) =>
                                        `<span class="queue-wait-radar__chip">${escapeHtml(
                                            chip
                                        )}</span>`
                                )
                                .join('')}
                        </div>
                    </div>
                </div>
                <div id="queueWaitRadarCards" class="queue-wait-radar__grid" role="list" aria-label="Radar de espera por línea">
                    ${radar.cards
                        .map(
                            (card) => `
                                <article
                                    id="queueWaitRadarCard_${escapeHtml(card.laneKey)}"
                                    class="queue-wait-radar__card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-wait-radar__card-header">
                                        <div>
                                            <strong>${escapeHtml(
                                                card.laneLabel
                                            )}</strong>
                                            <p id="queueWaitRadarHeadline_${escapeHtml(
                                                card.laneKey
                                            )}" class="queue-wait-radar__headline">${escapeHtml(
                                                card.headline
                                            )}</p>
                                        </div>
                                        <span class="queue-wait-radar__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p class="queue-wait-radar__detail">${escapeHtml(
                                        card.detail
                                    )}</p>
                                    <div class="queue-wait-radar__facts">
                                        <div class="queue-wait-radar__fact">
                                            <span>Ticket crítico</span>
                                            <strong id="queueWaitRadarOldest_${escapeHtml(
                                                card.laneKey
                                            )}">${escapeHtml(card.oldestLabel)}</strong>
                                        </div>
                                        <div class="queue-wait-radar__fact">
                                            <span>Presión</span>
                                            <strong id="queueWaitRadarPressure_${escapeHtml(
                                                card.laneKey
                                            )}">${escapeHtml(card.pressureLabel)}</strong>
                                        </div>
                                        <div class="queue-wait-radar__fact">
                                            <span>Siguiente jugada</span>
                                            <strong id="queueWaitRadarRecommendation_${escapeHtml(
                                                card.laneKey
                                            )}">${escapeHtml(
                                                card.recommendationLabel
                                            )}</strong>
                                        </div>
                                    </div>
                                    <div class="queue-wait-radar__lane-chips">
                                        ${card.chips
                                            .map(
                                                (chip) =>
                                                    `<span class="queue-wait-radar__lane-chip">${escapeHtml(
                                                        chip
                                                    )}</span>`
                                            )
                                            .join('')}
                                    </div>
                                    <div class="queue-wait-radar__actions">
                                        <button
                                            id="queueWaitRadarPrimary_${escapeHtml(
                                                card.laneKey
                                            )}"
                                            type="button"
                                            class="queue-wait-radar__action queue-wait-radar__action--primary"
                                            ${card.actionCard ? '' : 'disabled'}
                                        >
                                            ${escapeHtml(card.primaryLabel)}
                                        </button>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    radar.cards.forEach((card) => {
        const button = document.getElementById(
            `queueWaitRadarPrimary_${card.laneKey}`
        );
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = async () => {
            button.disabled = true;
            await runQueueWaitRadarAction(card, manifest, detectedPlatform);
        };
    });
}

function buildQueueDispatchCard(manifest, detectedPlatform, consultorio) {
    const operatorContext = buildConsultorioOperatorContext(
        manifest,
        detectedPlatform,
        consultorio
    );
    const {
        slot,
        slotKey,
        operatorAssigned,
        operatorLive,
        operatorLabel,
        operatorUrl,
        oneTapLabel,
        numpadLabel,
        heartbeatLabel,
    } = operatorContext;
    const otherSlot = slot === 2 ? 1 : 2;
    const currentTicket = getCalledTicketForConsultorio(slot);
    const ownWaitingTickets = getAssignedWaitingTickets(slot);
    const otherWaitingTickets = getAssignedWaitingTickets(otherSlot);
    const generalWaitingTickets = getUnassignedWaitingTickets();
    const nextAssignedTicket = ownWaitingTickets[0] || null;
    const nextGeneralTicket = generalWaitingTickets[0] || null;
    const rebalanceTicket =
        ownWaitingTickets.length === 0 && otherWaitingTickets.length >= 2
            ? otherWaitingTickets[1]
            : null;
    const ownBacklog = ownWaitingTickets.length;
    const otherBacklog = otherWaitingTickets.length;
    const generalBacklog = generalWaitingTickets.length;

    let state = 'idle';
    let badge = 'Sin acción inmediata';
    let headline = `${slotKey.toUpperCase()} sin movimiento urgente`;
    let detail =
        'No hay ticket listo para mover o llamar desde este consultorio en este momento.';
    let primaryAction = 'none';
    let primaryLabel = 'Sin acción';
    let targetTicket = null;
    let targetLabel = 'Sin ticket pendiente';

    if (currentTicket) {
        state = 'active';
        badge = 'En atención';
        headline = `${currentTicket.ticketCode} sigue en atención`;
        detail = `${slotKey.toUpperCase()} está ocupado ahora. Deja visible el operador y prepara el siguiente paso sin cambiar de tarjeta.`;
        primaryAction = 'open';
        primaryLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
        targetTicket = currentTicket;
        targetLabel = `${currentTicket.ticketCode} · ${formatQueueTicketAgeLabel(
            currentTicket,
            'called'
        )}`;
    } else if (nextAssignedTicket && operatorAssigned && operatorLive) {
        state = 'ready';
        badge = 'Llamar ahora';
        headline = `${nextAssignedTicket.ticketCode} listo para ${slotKey.toUpperCase()}`;
        detail = `El ticket ya está alineado a ${slotKey.toUpperCase()} y el operador correcto está arriba. Puedes llamarlo sin bajar a la tabla.`;
        primaryAction = 'call';
        primaryLabel = `Llamar ${nextAssignedTicket.ticketCode}`;
        targetTicket = nextAssignedTicket;
        targetLabel = `${nextAssignedTicket.ticketCode} · ${formatQueueTicketAgeLabel(
            nextAssignedTicket,
            'waiting'
        )}`;
    } else if (nextGeneralTicket && operatorAssigned && operatorLive) {
        state = 'suggested';
        badge = 'Tomar de cola general';
        headline = `${slotKey.toUpperCase()} puede absorber ${nextGeneralTicket.ticketCode}`;
        detail = `Hay ${generalBacklog} ticket(s) sin consultorio. Reasigna el más antiguo a ${slotKey.toUpperCase()} para destrabar recepción antes del siguiente pico.`;
        primaryAction = 'assign';
        primaryLabel = `Asignar ${nextGeneralTicket.ticketCode}`;
        targetTicket = nextGeneralTicket;
        targetLabel = `${nextGeneralTicket.ticketCode} · ${formatQueueTicketAgeLabel(
            nextGeneralTicket,
            'waiting'
        )}`;
    } else if (rebalanceTicket && operatorAssigned && operatorLive) {
        state = 'warning';
        badge = 'Rebalancear cola';
        headline = `${slotKey.toUpperCase()} puede ayudar a C${otherSlot}`;
        detail = `C${otherSlot} ya acumula ${otherBacklog} en espera. Mueve ${rebalanceTicket.ticketCode} a ${slotKey.toUpperCase()} para repartir mejor la carga.`;
        primaryAction = 'rebalance';
        primaryLabel = `Mover ${rebalanceTicket.ticketCode}`;
        targetTicket = rebalanceTicket;
        targetLabel = `${rebalanceTicket.ticketCode} · ${formatQueueTicketAgeLabel(
            rebalanceTicket,
            'waiting'
        )}`;
    } else if (nextAssignedTicket || nextGeneralTicket || rebalanceTicket) {
        state = 'warning';
        badge = 'Falta operador';
        headline = `Prepara Operador ${slotKey.toUpperCase()}`;
        detail = `Hay ticket pendiente para ${slotKey.toUpperCase()}, pero todavía no coincide el operador reportado. Abre la app correcta antes de despachar desde aquí.`;
        primaryAction = 'open';
        primaryLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
        targetTicket =
            nextAssignedTicket || nextGeneralTicket || rebalanceTicket;
        targetLabel = targetTicket
            ? `${targetTicket.ticketCode} · ${formatQueueTicketAgeLabel(
                  targetTicket,
                  'waiting'
              )}`
            : 'Sin ticket pendiente';
    } else if (!operatorAssigned && operatorLive) {
        state = 'warning';
        badge = 'Operador en otra estación';
        headline = `${slotKey.toUpperCase()} sin operador dedicado`;
        detail = `El operador vivo no coincide con ${slotKey.toUpperCase()}. Deja abierto el consultorio correcto antes de que vuelva a entrar cola.`;
        primaryAction = 'open';
        primaryLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
    } else if (operatorAssigned && operatorLive) {
        state = 'ready';
        badge = 'Equipo listo';
        headline = `${slotKey.toUpperCase()} preparado para el próximo ticket`;
        detail = `No hay turno esperando ahora, pero ${slotKey.toUpperCase()} ya tiene operador, numpad y heartbeat listos para absorber el siguiente ingreso.`;
        primaryAction = 'open';
        primaryLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
    }

    return {
        slot,
        slotKey,
        state,
        badge,
        headline,
        detail,
        targetTicketId: Number(targetTicket?.id || 0),
        targetTicketCode: String(targetTicket?.ticketCode || ''),
        targetLabel,
        primaryAction,
        primaryLabel,
        operatorUrl,
        queueMixLabel: `${slotKey.toUpperCase()} ${ownBacklog} · General ${generalBacklog}`,
        backlogLabel: `C${otherSlot} ${otherBacklog} · Heartbeat ${heartbeatLabel}`,
        chips: [operatorLabel, oneTapLabel, numpadLabel],
    };
}

function buildQueueDispatchDeck(manifest, detectedPlatform) {
    const cards = [1, 2].map((consultorio) =>
        buildQueueDispatchCard(manifest, detectedPlatform, consultorio)
    );
    const actionableCount = cards.filter((card) =>
        ['call', 'assign', 'rebalance'].includes(card.primaryAction)
    ).length;
    const blockedCount = cards.filter(
        (card) => card.state === 'warning' && card.primaryAction === 'open'
    ).length;
    const waitingGeneralCount = getUnassignedWaitingTickets().length;

    return {
        title:
            actionableCount > 0
                ? 'Despacho sugerido listo'
                : blockedCount > 0
                  ? 'Despacho sugerido con bloqueos'
                  : 'Despacho sugerido estable',
        summary:
            actionableCount > 0
                ? 'Aquí aparece la siguiente jugada útil por consultorio para llamar o mover tickets sin revisar toda la tabla.'
                : blockedCount > 0
                  ? 'El hub detectó tickets movibles, pero aún falta operador o contexto para despacharlos con confianza.'
                  : 'No hay movimiento urgente: ambos consultorios están balanceados o sin cola pendiente.',
        statusLabel:
            actionableCount > 0
                ? `${actionableCount} acción(es) recomendada(s)`
                : blockedCount > 0
                  ? `${blockedCount} bloqueo(s) operativos`
                  : 'Sin movimiento urgente',
        statusState:
            actionableCount > 0
                ? 'ready'
                : blockedCount > 0
                  ? 'warning'
                  : 'idle',
        chips: [
            `Generales ${waitingGeneralCount}`,
            `Acciones ${actionableCount}`,
            `Bloqueos ${blockedCount}`,
        ],
        cards,
    };
}

function describeDispatchAction(card) {
    if (card.primaryAction === 'call') {
        return {
            title: `Despacho ${card.slotKey.toUpperCase()}: llamado rápido`,
            summary: `${card.targetTicketCode} se llamó desde la tarjeta de despacho sugerido.`,
        };
    }
    if (card.primaryAction === 'assign') {
        return {
            title: `Despacho ${card.slotKey.toUpperCase()}: ticket tomado de cola general`,
            summary: `${card.targetTicketCode} se reasignó a ${card.slotKey.toUpperCase()} desde el hub.`,
        };
    }
    if (card.primaryAction === 'rebalance') {
        return {
            title: `Despacho ${card.slotKey.toUpperCase()}: rebalanceo aplicado`,
            summary: `${card.targetTicketCode} se movió a ${card.slotKey.toUpperCase()} para repartir la carga del turno.`,
        };
    }
    return {
        title: `Despacho ${card.slotKey.toUpperCase()}: operador abierto`,
        summary: `Se abrió la ruta preparada de Operador ${card.slotKey.toUpperCase()} desde el hub.`,
    };
}

async function runQueueDispatchAction(card, manifest, detectedPlatform) {
    if (!card || card.primaryAction === 'none') {
        return;
    }

    try {
        const { callNextForConsultorio, runQueueTicketAction } =
            await import('../../actions.js');
        if (card.primaryAction === 'call') {
            await callNextForConsultorio(card.slot);
        } else if (
            (card.primaryAction === 'assign' ||
                card.primaryAction === 'rebalance') &&
            card.targetTicketId > 0
        ) {
            await runQueueTicketAction(
                card.targetTicketId,
                'reasignar',
                card.slot
            );
        } else if (card.primaryAction === 'open') {
            window.open(card.operatorUrl, '_blank', 'noopener');
        }

        appendOpsLogEntry({
            tone: card.primaryAction === 'rebalance' ? 'warning' : 'info',
            source: 'dispatch',
            ...describeDispatchAction(card),
        });
    } catch (_error) {
        createToast('No se pudo ejecutar el despacho sugerido', 'error');
    } finally {
        rerenderQueueOpsHub(manifest, detectedPlatform);
    }
}

function renderQueueDispatchDeck(manifest, detectedPlatform) {
    const root = document.getElementById('queueDispatchDeck');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const deck = buildQueueDispatchDeck(manifest, detectedPlatform);
    setHtml(
        '#queueDispatchDeck',
        `
            <section class="queue-dispatch-deck__shell" data-state="${escapeHtml(
                deck.statusState
            )}">
                <div class="queue-dispatch-deck__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Despacho sugerido</p>
                        <h5 id="queueDispatchDeckTitle" class="queue-app-card__title">${escapeHtml(
                            deck.title
                        )}</h5>
                        <p id="queueDispatchDeckSummary" class="queue-dispatch-deck__summary">${escapeHtml(
                            deck.summary
                        )}</p>
                    </div>
                    <div class="queue-dispatch-deck__meta">
                        <span
                            id="queueDispatchDeckStatus"
                            class="queue-dispatch-deck__status"
                            data-state="${escapeHtml(deck.statusState)}"
                        >
                            ${escapeHtml(deck.statusLabel)}
                        </span>
                        <div class="queue-dispatch-deck__chips">
                            ${deck.chips
                                .map(
                                    (chip) =>
                                        `<span class="queue-dispatch-deck__chip">${escapeHtml(
                                            chip
                                        )}</span>`
                                )
                                .join('')}
                        </div>
                    </div>
                </div>
                <div id="queueDispatchDeckCards" class="queue-dispatch-deck__grid" role="list" aria-label="Despacho sugerido por consultorio">
                    ${deck.cards
                        .map(
                            (card) => `
                                <article
                                    id="queueDispatchCard_${escapeHtml(card.slotKey)}"
                                    class="queue-dispatch-card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-dispatch-card__header">
                                        <div>
                                            <strong>${escapeHtml(
                                                card.slotKey.toUpperCase()
                                            )}</strong>
                                            <p id="queueDispatchHeadline_${escapeHtml(
                                                card.slotKey
                                            )}" class="queue-dispatch-card__headline">${escapeHtml(
                                                card.headline
                                            )}</p>
                                        </div>
                                        <span class="queue-dispatch-card__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p id="queueDispatchDetail_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-dispatch-card__detail">${escapeHtml(
                                        card.detail
                                    )}</p>
                                    <div class="queue-dispatch-card__facts">
                                        <div class="queue-dispatch-card__fact">
                                            <span>Ticket objetivo</span>
                                            <strong id="queueDispatchTarget_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.targetLabel)}</strong>
                                        </div>
                                        <div class="queue-dispatch-card__fact">
                                            <span>Mix de cola</span>
                                            <strong id="queueDispatchQueue_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.queueMixLabel)}</strong>
                                        </div>
                                        <div class="queue-dispatch-card__fact">
                                            <span>Contexto</span>
                                            <strong id="queueDispatchBacklog_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.backlogLabel)}</strong>
                                        </div>
                                    </div>
                                    <div class="queue-dispatch-card__chips">
                                        ${card.chips
                                            .map(
                                                (chip) =>
                                                    `<span class="queue-dispatch-card__chip">${escapeHtml(
                                                        chip
                                                    )}</span>`
                                            )
                                            .join('')}
                                    </div>
                                    <div class="queue-dispatch-card__actions">
                                        <button
                                            id="queueDispatchPrimary_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            type="button"
                                            class="queue-dispatch-card__action queue-dispatch-card__action--primary"
                                            data-queue-dispatch-action="${escapeHtml(
                                                card.primaryAction
                                            )}"
                                            data-queue-consultorio="${escapeHtml(
                                                String(card.slot)
                                            )}"
                                            data-queue-ticket-id="${escapeHtml(
                                                String(card.targetTicketId)
                                            )}"
                                            ${card.primaryAction === 'none' ? 'disabled' : ''}
                                        >
                                            ${escapeHtml(card.primaryLabel)}
                                        </button>
                                        <a
                                            id="queueDispatchOpenOperator_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            href="${escapeHtml(card.operatorUrl)}"
                                            class="queue-dispatch-card__action"
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            Operador ${escapeHtml(card.slotKey.toUpperCase())}
                                        </a>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    deck.cards.forEach((card) => {
        const button = document.getElementById(
            `queueDispatchPrimary_${card.slotKey}`
        );
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = async () => {
            button.disabled = true;
            await runQueueDispatchAction(card, manifest, detectedPlatform);
        };
    });
}

function renderQueueQuickConsoleAction(action, index) {
    const safeId = String(action.id || `queueQuickConsoleAction_${index}`);
    const className =
        action.variant === 'primary'
            ? 'queue-quick-console__action queue-quick-console__action--primary'
            : 'queue-quick-console__action';

    if (action.kind === 'anchor') {
        return `
            <a
                id="${escapeHtml(safeId)}"
                href="${escapeHtml(action.href || '#queue')}"
                class="${className}"
                ${action.external ? 'target="_blank" rel="noopener"' : ''}
            >
                ${escapeHtml(action.label || 'Abrir')}
            </a>
        `;
    }

    return `
        <button
            id="${escapeHtml(safeId)}"
            type="button"
            class="${className}"
            ${action.action ? `data-action="${escapeHtml(action.action)}"` : ''}
            ${action.consultorio ? `data-queue-consultorio="${escapeHtml(String(action.consultorio))}"` : ''}
        >
            ${escapeHtml(action.label || 'Continuar')}
        </button>
    `;
}

function buildQueueQuickConsole(manifest, detectedPlatform) {
    const focus = buildQueueFocusMode(manifest, detectedPlatform);
    const preset = ensureInstallPreset(detectedPlatform);
    const operatorConfig = manifest.operator || DEFAULT_APP_DOWNLOADS.operator;
    const kioskConfig = manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk;
    const salaConfig = manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv;
    const operatorUrl = buildPreparedSurfaceUrl('operator', operatorConfig, {
        ...preset,
        surface: 'operator',
    });
    const kioskUrl = buildPreparedSurfaceUrl('kiosk', kioskConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const salaUrl = buildPreparedSurfaceUrl('sala_tv', salaConfig, {
        ...preset,
        surface: 'sala_tv',
    });
    const openingAssist = buildOpeningChecklistAssist(detectedPlatform);
    const handoffAssist = buildShiftHandoffAssist(detectedPlatform);
    const syncHealth = getQueueSyncHealth();
    const chips = [
        getInstallPresetLabel(detectedPlatform),
        syncHealth.badge,
        focus.effectiveMode === 'closing'
            ? `Relevo ${handoffAssist.suggestedCount}/${SHIFT_HANDOFF_STEP_IDS.length}`
            : `Apertura ${openingAssist.suggestedCount}/${OPENING_CHECKLIST_STEP_IDS.length}`,
    ];

    if (focus.effectiveMode === 'opening') {
        return {
            tone: 'opening',
            title: 'Consola rápida: Apertura',
            summary:
                openingAssist.suggestedCount > 0
                    ? `Confirma pasos sugeridos o abre cada superficie sin bajar al resto del panel. Ideal para dejar listo Operador, Kiosco y Sala TV en menos clics.`
                    : 'Abre cada superficie operativa o vuelve al checklist de apertura para completar las validaciones manuales pendientes.',
            chips,
            actions: [
                {
                    id: 'queueQuickConsoleAction_opening_apply',
                    kind: 'button',
                    label:
                        openingAssist.suggestedCount > 0
                            ? `Confirmar sugeridos (${openingAssist.suggestedCount})`
                            : 'Sin sugeridos ahora',
                    variant: 'primary',
                },
                {
                    id: 'queueQuickConsoleAction_open_operator',
                    kind: 'anchor',
                    label: 'Abrir Operador',
                    href: operatorUrl,
                    external: true,
                },
                {
                    id: 'queueQuickConsoleAction_open_kiosk',
                    kind: 'anchor',
                    label: 'Abrir Kiosco',
                    href: kioskUrl,
                    external: true,
                },
                {
                    id: 'queueQuickConsoleAction_open_sala',
                    kind: 'anchor',
                    label: 'Abrir Sala TV',
                    href: salaUrl,
                    external: true,
                },
            ],
        };
    }

    if (focus.effectiveMode === 'incidents') {
        return {
            tone: 'incidents',
            title: 'Consola rápida: Incidencias',
            summary:
                'Enfoca refresh, contingencia y registro de incidencia sin perder tiempo buscando la acción correcta en todo el hub.',
            chips,
            actions: [
                {
                    id: 'queueQuickConsoleAction_refresh',
                    kind: 'button',
                    label: 'Refrescar cola',
                    variant: 'primary',
                    action: 'queue-refresh-state',
                },
                {
                    id: 'queueQuickConsoleAction_incident_log',
                    kind: 'button',
                    label: 'Registrar incidencia',
                },
                {
                    id: 'queueQuickConsoleAction_open_contingency',
                    kind: 'anchor',
                    label: 'Ir a contingencias',
                    href: '#queueContingencyDeck',
                },
                {
                    id: 'queueQuickConsoleAction_open_log',
                    kind: 'anchor',
                    label: 'Ir a bitácora',
                    href: '#queueOpsLog',
                },
            ],
        };
    }

    if (focus.effectiveMode === 'closing') {
        return {
            tone: 'closing',
            title: 'Consola rápida: Cierre',
            summary:
                handoffAssist.suggestedCount > 0
                    ? 'Confirma el relevo sugerido, copia el resumen y deja a la vista las superficies críticas del cierre.'
                    : 'Abre operador o sala y remata el cierre del turno sin desplazarte por todos los bloques.',
            chips,
            actions: [
                {
                    id: 'queueQuickConsoleAction_closing_apply',
                    kind: 'button',
                    label:
                        handoffAssist.suggestedCount > 0
                            ? `Confirmar relevo (${handoffAssist.suggestedCount})`
                            : 'Sin relevo sugerido ahora',
                    variant: 'primary',
                },
                {
                    id: 'queueQuickConsoleAction_copy_handoff',
                    kind: 'button',
                    label: 'Copiar resumen de relevo',
                },
                {
                    id: 'queueQuickConsoleAction_open_operator_close',
                    kind: 'anchor',
                    label: 'Abrir Operador',
                    href: operatorUrl,
                    external: true,
                },
                {
                    id: 'queueQuickConsoleAction_open_sala_close',
                    kind: 'anchor',
                    label: 'Abrir Sala TV',
                    href: salaUrl,
                    external: true,
                },
            ],
        };
    }

    return {
        tone: 'operations',
        title: 'Consola rápida: Operación',
        summary:
            'Llama el siguiente turno, refresca la cola o abre la superficie correcta sin saltar entre el header y el resto del hub.',
        chips,
        actions: [
            {
                id: 'queueQuickConsoleAction_call_c1',
                kind: 'button',
                label: 'Llamar C1',
                variant: 'primary',
                action: 'queue-call-next',
                consultorio: 1,
            },
            {
                id: 'queueQuickConsoleAction_call_c2',
                kind: 'button',
                label: 'Llamar C2',
                action: 'queue-call-next',
                consultorio: 2,
            },
            {
                id: 'queueQuickConsoleAction_refresh_ops',
                kind: 'button',
                label: 'Refrescar cola',
                action: 'queue-refresh-state',
            },
            {
                id: 'queueQuickConsoleAction_open_operator_ops',
                kind: 'anchor',
                label: 'Abrir Operador',
                href: operatorUrl,
                external: true,
            },
        ],
    };
}

function renderQueueQuickConsole(manifest, detectedPlatform) {
    const root = document.getElementById('queueQuickConsole');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const consoleData = buildQueueQuickConsole(manifest, detectedPlatform);
    setHtml(
        '#queueQuickConsole',
        `
            <section class="queue-quick-console__shell" data-state="${escapeHtml(
                consoleData.tone
            )}">
                <div class="queue-quick-console__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Consola rápida</p>
                        <h5 id="queueQuickConsoleTitle" class="queue-app-card__title">${escapeHtml(
                            consoleData.title
                        )}</h5>
                        <p id="queueQuickConsoleSummary" class="queue-quick-console__summary">${escapeHtml(
                            consoleData.summary
                        )}</p>
                    </div>
                    <div class="queue-quick-console__chips">
                        ${consoleData.chips
                            .map(
                                (chip, index) => `
                                    <span
                                        ${index === 0 ? 'id="queueQuickConsoleChip"' : ''}
                                        class="queue-quick-console__chip"
                                    >
                                        ${escapeHtml(chip)}
                                    </span>
                                `
                            )
                            .join('')}
                    </div>
                </div>
                <div id="queueQuickConsoleActions" class="queue-quick-console__actions">
                    ${consoleData.actions
                        .map((action, index) =>
                            renderQueueQuickConsoleAction(action, index)
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    const openingApplyButton = document.getElementById(
        'queueQuickConsoleAction_opening_apply'
    );
    if (openingApplyButton instanceof HTMLButtonElement) {
        openingApplyButton.disabled =
            buildOpeningChecklistAssist(detectedPlatform).suggestedCount <= 0;
        openingApplyButton.onclick = () => {
            const assist = buildOpeningChecklistAssist(detectedPlatform);
            if (!assist.suggestedIds.length) {
                return;
            }
            applyOpeningChecklistSuggestions(assist.suggestedIds);
            appendOpsLogEntry({
                tone: 'success',
                source: 'opening',
                title: `Apertura: ${assist.suggestedIds.length} sugerido(s) confirmados`,
                summary: `La consola rápida confirmó sugeridos de apertura. Perfil activo: ${getInstallPresetLabel(
                    detectedPlatform
                )}.`,
            });
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const incidentButton = document.getElementById(
        'queueQuickConsoleAction_incident_log'
    );
    if (incidentButton instanceof HTMLButtonElement) {
        incidentButton.onclick = () => {
            appendOpsLogEntry(
                buildOpsLogIncidentEntry(manifest, detectedPlatform)
            );
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const closingApplyButton = document.getElementById(
        'queueQuickConsoleAction_closing_apply'
    );
    if (closingApplyButton instanceof HTMLButtonElement) {
        closingApplyButton.disabled =
            buildShiftHandoffAssist(detectedPlatform).suggestedCount <= 0;
        closingApplyButton.onclick = () => {
            const assist = buildShiftHandoffAssist(detectedPlatform);
            if (!assist.suggestedIds.length) {
                return;
            }
            applyShiftHandoffSuggestions(assist.suggestedIds);
            appendOpsLogEntry({
                tone: 'success',
                source: 'handoff',
                title: `Relevo: ${assist.suggestedIds.length} sugerido(s) confirmados`,
                summary:
                    'La consola rápida confirmó el relevo sugerido del turno.',
            });
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const copyHandoffButton = document.getElementById(
        'queueQuickConsoleAction_copy_handoff'
    );
    if (copyHandoffButton instanceof HTMLButtonElement) {
        copyHandoffButton.onclick = () => {
            void copyShiftHandoffSummary(detectedPlatform);
        };
    }
}

function buildQueuePlaybook(manifest, detectedPlatform) {
    const focus = buildQueueFocusMode(manifest, detectedPlatform);
    const definitions = buildPlaybookDefinitions(manifest, detectedPlatform);
    const mode = focus.effectiveMode;
    const steps = definitions[mode] || [];
    const state = ensureOpsPlaybookState();
    const modeState =
        state.modes && typeof state.modes[mode] === 'object'
            ? state.modes[mode]
            : {};
    const completedCount = steps.filter((step) =>
        Boolean(modeState[step.id])
    ).length;
    const nextStep = steps.find((step) => !modeState[step.id]) || null;
    const summary = nextStep
        ? `Paso actual: ${nextStep.title}. ${nextStep.detail}`
        : 'La secuencia de este modo ya quedó completa. Puedes reiniciarla o pasar al siguiente momento del turno.';

    return {
        mode,
        title: `Playbook activo: ${focus.title.replace('Modo foco: ', '')}`,
        summary,
        steps,
        completedCount,
        totalSteps: steps.length,
        nextStep,
        modeState,
    };
}

function buildQueuePlaybookAssist(manifest, detectedPlatform) {
    const playbook = buildQueuePlaybook(manifest, detectedPlatform);
    const opening = ensureOpeningChecklistState();
    const shift = ensureShiftHandoffState();
    const openingAssist = buildOpeningChecklistAssist(detectedPlatform);
    const handoffAssist = buildShiftHandoffAssist(detectedPlatform);
    const syncHealth = getQueueSyncHealth();
    const operator = getSurfaceTelemetryState('operator');
    const kiosk = getSurfaceTelemetryState('kiosk');
    const display = getSurfaceTelemetryState('display');
    const log = ensureOpsLogState();
    const logHasIncident = log.items.some((item) => item.source === 'incident');
    const logHasStatus = log.items.some((item) => item.source === 'status');
    const openingMap = {
        opening_operator: {
            suggested:
                Boolean(opening.steps.operator_ready) ||
                Boolean(openingAssist.suggestions.operator_ready?.suggested),
            reason:
                openingAssist.suggestions.operator_ready?.reason ||
                'Operador todavía necesita validación explícita.',
        },
        opening_kiosk: {
            suggested:
                Boolean(opening.steps.kiosk_ready) ||
                Boolean(openingAssist.suggestions.kiosk_ready?.suggested),
            reason:
                openingAssist.suggestions.kiosk_ready?.reason ||
                'Kiosco todavía necesita validación explícita.',
        },
        opening_sala: {
            suggested:
                Boolean(opening.steps.sala_ready) ||
                Boolean(openingAssist.suggestions.sala_ready?.suggested),
            reason:
                openingAssist.suggestions.sala_ready?.reason ||
                'Sala TV todavía necesita validación explícita.',
        },
    };
    const surfacesHealthy =
        operator.status === 'ready' &&
        kiosk.status !== 'unknown' &&
        display.status === 'ready';
    const incidentOpen =
        syncHealth.state === 'alert' ||
        [operator, kiosk, display].some((item) =>
            ['alert', 'warning', 'unknown'].includes(
                String(item.status || '').toLowerCase()
            )
        );
    const incidentMap = {
        incidents_refresh: {
            suggested: syncHealth.state !== 'alert',
            reason: syncHealth.summary,
        },
        incidents_surface: {
            suggested:
                operator.status !== 'unknown' ||
                kiosk.status !== 'unknown' ||
                display.status !== 'unknown',
            reason: 'Al menos una superficie ya está reportando señal para investigar desde el equipo correcto.',
        },
        incidents_log: {
            suggested: logHasIncident,
            reason: logHasIncident
                ? 'La bitácora ya tiene al menos una incidencia registrada.'
                : 'Todavía no hay incidencia registrada en la bitácora.',
        },
    };
    const closingSurfacesSuggested =
        (Boolean(shift.steps.operator_handoff) ||
            Boolean(handoffAssist.suggestions.operator_handoff?.suggested)) &&
        (Boolean(shift.steps.kiosk_handoff) ||
            Boolean(handoffAssist.suggestions.kiosk_handoff?.suggested)) &&
        (Boolean(shift.steps.sala_handoff) ||
            Boolean(handoffAssist.suggestions.sala_handoff?.suggested));
    const closingMap = {
        closing_queue: {
            suggested:
                Boolean(shift.steps.queue_clear) ||
                Boolean(handoffAssist.suggestions.queue_clear?.suggested),
            reason:
                handoffAssist.suggestions.queue_clear?.reason ||
                'La cola todavía necesita una validación final.',
        },
        closing_surfaces: {
            suggested: closingSurfacesSuggested,
            reason: closingSurfacesSuggested
                ? 'Operador, Kiosco y Sala TV ya aparecen listos para el siguiente turno.'
                : 'Todavía falta dejar una o más superficies listas para mañana.',
        },
        closing_copy: {
            suggested:
                Boolean(shift.steps.queue_clear) ||
                (Boolean(handoffAssist.suggestions.queue_clear?.suggested) &&
                    closingSurfacesSuggested),
            reason: 'Cuando cola y superficies quedan listas, conviene copiar el resumen final del relevo.',
        },
    };
    const operationsMap = {
        operations_monitor: {
            suggested: surfacesHealthy,
            reason: surfacesHealthy
                ? 'Las superficies ya reportan señal suficiente para operar con seguimiento.'
                : 'Falta señal estable en alguna superficie antes de dar por monitoreo resuelto.',
        },
        operations_call: {
            suggested:
                syncHealth.state !== 'alert' &&
                operator.status === 'ready' &&
                !operator.stale,
            reason: 'Llamar siguiente conviene cuando Operador está listo y la cola no está en fallback.',
        },
        operations_log: {
            suggested: logHasStatus,
            reason: logHasStatus
                ? 'La bitácora ya tiene estado operativo o cambios recientes.'
                : 'No hay estado operativo reciente en la bitácora.',
        },
    };

    const suggestionsByMode = {
        opening: openingMap,
        operations: operationsMap,
        incidents: incidentMap,
        closing: closingMap,
    };
    const modeSuggestions = suggestionsByMode[playbook.mode] || {};
    const suggestedIds = playbook.steps
        .filter(
            (step) =>
                !playbook.modeState[step.id] &&
                Boolean(modeSuggestions[step.id]?.suggested)
        )
        .map((step) => step.id);

    return {
        suggestions: modeSuggestions,
        suggestedIds,
        suggestedCount: suggestedIds.length,
        incidentOpen,
    };
}

function buildQueuePlaybookReport(manifest, detectedPlatform) {
    const playbook = buildQueuePlaybook(manifest, detectedPlatform);
    const assist = buildQueuePlaybookAssist(manifest, detectedPlatform);
    return [
        `${playbook.title} - ${formatDateTime(new Date().toISOString())}`,
        `Progreso: ${playbook.completedCount}/${playbook.totalSteps}`,
        `Sugeridos actuales: ${assist.suggestedCount}`,
        ...playbook.steps.map((step) => {
            const done = Boolean(playbook.modeState[step.id]);
            return `${done ? '[x]' : '[ ]'} ${step.title} - ${step.detail}`;
        }),
    ].join('\n');
}

async function copyQueuePlaybookReport(manifest, detectedPlatform) {
    try {
        await navigator.clipboard.writeText(
            buildQueuePlaybookReport(manifest, detectedPlatform)
        );
        createToast('Playbook copiado', 'success');
    } catch (_error) {
        createToast('No se pudo copiar el playbook', 'error');
    }
}

function renderQueuePlaybook(manifest, detectedPlatform) {
    const root = document.getElementById('queuePlaybook');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const playbook = buildQueuePlaybook(manifest, detectedPlatform);
    const assist = buildQueuePlaybookAssist(manifest, detectedPlatform);
    setHtml(
        '#queuePlaybook',
        `
            <section class="queue-playbook__shell" data-state="${escapeHtml(
                playbook.mode
            )}">
                <div class="queue-playbook__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Playbook activo</p>
                        <h5 id="queuePlaybookTitle" class="queue-app-card__title">${escapeHtml(
                            playbook.title
                        )}</h5>
                        <p id="queuePlaybookSummary" class="queue-playbook__summary">${escapeHtml(
                            playbook.summary
                        )}</p>
                    </div>
                    <div class="queue-playbook__meta">
                        <span
                            id="queuePlaybookChip"
                            class="queue-playbook__chip"
                            data-state="${playbook.completedCount >= playbook.totalSteps ? 'ready' : 'active'}"
                        >
                            ${escapeHtml(
                                playbook.completedCount >= playbook.totalSteps
                                    ? 'Secuencia completa'
                                    : `Paso ${Math.min(playbook.completedCount + 1, playbook.totalSteps)}/${playbook.totalSteps}`
                            )}
                        </span>
                        <span
                            id="queuePlaybookAssistChip"
                            class="queue-playbook__assist"
                            data-state="${assist.suggestedCount > 0 ? 'suggested' : playbook.completedCount >= playbook.totalSteps ? 'ready' : 'idle'}"
                        >
                            ${escapeHtml(
                                assist.suggestedCount > 0
                                    ? `Sugeridos ${assist.suggestedCount}`
                                    : playbook.completedCount >=
                                        playbook.totalSteps
                                      ? 'Rutina completa'
                                      : 'Sin sugeridos'
                            )}
                        </span>
                        <button
                            id="queuePlaybookApplyBtn"
                            type="button"
                            class="queue-playbook__action queue-playbook__action--primary"
                            ${playbook.nextStep ? '' : 'disabled'}
                        >
                            ${
                                playbook.nextStep
                                    ? `Marcar: ${playbook.nextStep.title}`
                                    : 'Sin pasos pendientes'
                            }
                        </button>
                        <button
                            id="queuePlaybookAssistBtn"
                            type="button"
                            class="queue-playbook__action"
                            ${assist.suggestedCount > 0 ? '' : 'disabled'}
                        >
                            ${
                                assist.suggestedCount > 0
                                    ? `Confirmar sugeridos (${assist.suggestedCount})`
                                    : 'Sin sugeridos ahora'
                            }
                        </button>
                        <button
                            id="queuePlaybookCopyBtn"
                            type="button"
                            class="queue-playbook__action"
                        >
                            Copiar secuencia
                        </button>
                        <button
                            id="queuePlaybookResetBtn"
                            type="button"
                            class="queue-playbook__action"
                        >
                            Reiniciar playbook
                        </button>
                    </div>
                </div>
                <div id="queuePlaybookSteps" class="queue-playbook__steps" role="list" aria-label="Secuencia operativa por foco">
                    ${playbook.steps
                        .map((step) => {
                            const done = Boolean(playbook.modeState[step.id]);
                            const isCurrent =
                                !done &&
                                playbook.nextStep &&
                                playbook.nextStep.id === step.id;
                            const isSuggested =
                                !done &&
                                Boolean(assist.suggestions[step.id]?.suggested);
                            const stepState = done
                                ? 'ready'
                                : isCurrent
                                  ? 'current'
                                  : isSuggested
                                    ? 'suggested'
                                    : 'pending';
                            return `
                                <article class="queue-playbook__step" data-state="${stepState}" role="listitem">
                                    <div class="queue-playbook__step-head">
                                        <div>
                                            <strong>${escapeHtml(step.title)}</strong>
                                            <p>${escapeHtml(step.detail)}</p>
                                        </div>
                                        <span class="queue-playbook__step-state">${escapeHtml(
                                            done
                                                ? 'Hecho'
                                                : isCurrent
                                                  ? 'Actual'
                                                  : isSuggested
                                                    ? 'Sugerido'
                                                    : 'Pendiente'
                                        )}</span>
                                    </div>
                                    <p class="queue-playbook__step-note">${escapeHtml(
                                        assist.suggestions[step.id]?.reason ||
                                            step.detail
                                    )}</p>
                                    <div class="queue-playbook__step-actions">
                                        <a
                                            href="${escapeHtml(step.href)}"
                                            class="queue-playbook__step-primary"
                                            ${String(step.href || '').startsWith('#') ? '' : 'target="_blank" rel="noopener"'}
                                        >
                                            ${escapeHtml(step.actionLabel)}
                                        </a>
                                        <button
                                            id="queuePlaybookToggle_${escapeHtml(step.id)}"
                                            type="button"
                                            class="queue-playbook__step-toggle"
                                            data-queue-playbook-step="${escapeHtml(step.id)}"
                                            data-state="${stepState}"
                                        >
                                            ${done ? 'Marcar pendiente' : 'Marcar hecho'}
                                        </button>
                                    </div>
                                </article>
                            `;
                        })
                        .join('')}
                </div>
            </section>
        `
    );

    const applyButton = document.getElementById('queuePlaybookApplyBtn');
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            if (!playbook.nextStep) {
                return;
            }
            setOpsPlaybookStep(playbook.mode, playbook.nextStep.id, true);
            appendOpsLogEntry({
                tone: 'info',
                source: 'status',
                title: `Playbook ${playbook.mode}: paso confirmado`,
                summary: `${playbook.nextStep.title} quedó marcado como hecho desde el playbook activo.`,
            });
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const assistButton = document.getElementById('queuePlaybookAssistBtn');
    if (assistButton instanceof HTMLButtonElement) {
        assistButton.onclick = () => {
            if (!assist.suggestedIds.length) {
                return;
            }
            assist.suggestedIds.forEach((stepId) => {
                setOpsPlaybookStep(playbook.mode, stepId, true);
            });
            appendOpsLogEntry({
                tone: 'success',
                source: 'status',
                title: `Playbook ${playbook.mode}: sugeridos confirmados`,
                summary: `Se confirmaron ${assist.suggestedIds.length} paso(s) sugeridos por señales del sistema.`,
            });
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const copyButton = document.getElementById('queuePlaybookCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueuePlaybookReport(manifest, detectedPlatform);
        };
    }

    const resetButton = document.getElementById('queuePlaybookResetBtn');
    if (resetButton instanceof HTMLButtonElement) {
        resetButton.onclick = () => {
            resetOpsPlaybookMode(playbook.mode);
            appendOpsLogEntry({
                tone: 'warning',
                source: 'status',
                title: `Playbook ${playbook.mode}: reiniciado`,
                summary:
                    'La secuencia del modo activo se reinició para volver a guiar el flujo desde el primer paso.',
            });
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    root.querySelectorAll('[data-queue-playbook-step]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const stepId = String(button.dataset.queuePlaybookStep || '');
            const nextValue = !playbook.modeState[stepId];
            setOpsPlaybookStep(playbook.mode, stepId, nextValue);
            renderQueuePlaybook(manifest, detectedPlatform);
        };
    });
}

function buildContingencyCards(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const operatorConfig = manifest.operator || DEFAULT_APP_DOWNLOADS.operator;
    const kioskConfig = manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk;
    const salaConfig = manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv;
    const syncHealth = getQueueSyncHealth();
    const stationLabel = preset.station === 'c2' ? 'C2' : 'C1';
    const operatorModeLabel = preset.lock
        ? `${stationLabel} fijo`
        : 'modo libre';
    const operatorUrl = buildPreparedSurfaceUrl('operator', operatorConfig, {
        ...preset,
        surface: 'operator',
    });
    const kioskUrl = buildPreparedSurfaceUrl('kiosk', kioskConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const salaUrl = buildPreparedSurfaceUrl('sala_tv', salaConfig, {
        ...preset,
        surface: 'sala_tv',
    });

    return {
        syncHealth,
        cards: [
            {
                id: 'operator_issue',
                state: 'neutral',
                badge: 'Numpad',
                title: 'Numpad no responde',
                summary: `Abre Operador en ${operatorModeLabel}${preset.oneTap ? ' con 1 tecla' : ''}, recalibra la tecla externa y confirma Enter, Decimal y Subtract del Genius Numpad 1000.`,
                steps: [
                    'Confirma que el receptor USB 2.4 GHz siga conectado en el PC operador.',
                    'Dentro de Operador usa "Calibrar tecla" si el Enter del numpad no dispara llamada.',
                    'Mientras corriges el teclado, puedes seguir operando por clics sin cambiar de equipo.',
                ],
                actions: [
                    {
                        type: 'link',
                        href: operatorUrl,
                        label: 'Abrir operador',
                        primary: true,
                    },
                    {
                        type: 'copy',
                        url: operatorUrl,
                        label: 'Copiar ruta',
                    },
                    {
                        type: 'link',
                        href: buildGuideUrl('operator', preset, operatorConfig),
                        label: 'Centro de instalación',
                        external: true,
                    },
                ],
            },
            {
                id: 'kiosk_issue',
                state: 'neutral',
                badge: 'Térmica',
                title: 'Térmica no imprime',
                summary:
                    'Abre Kiosco, genera un ticket de prueba y confirma "Impresion OK" antes de volver al autoservicio.',
                steps: [
                    'Revisa papel, energía y cable USB de la impresora térmica.',
                    'Si el equipo sigue estable, usa el kiosco web preparado mientras validas la app desktop.',
                    'No cierres el flujo de check-in hasta imprimir al menos un ticket de prueba correcto.',
                ],
                actions: [
                    {
                        type: 'link',
                        href: kioskUrl,
                        label: 'Abrir kiosco',
                        primary: true,
                    },
                    {
                        type: 'copy',
                        url: kioskUrl,
                        label: 'Copiar ruta',
                    },
                    {
                        type: 'link',
                        href: buildGuideUrl('kiosk', preset, kioskConfig),
                        label: 'Centro de instalación',
                        external: true,
                    },
                ],
            },
            {
                id: 'sala_issue',
                state: 'neutral',
                badge: 'Audio',
                title: 'Sala TV sin campanilla',
                summary:
                    'Abre la Sala TV, ejecuta la prueba de campanilla y deja la TCL C655 con volumen fijo y Ethernet activo.',
                steps: [
                    'Confirma que la TV no esté en mute y que la app siga en foreground.',
                    'Si la APK falla, usa `sala-turnos.html` como respaldo inmediato en el navegador de la TV.',
                    'Solo reinstala la APK si ya probaste campanilla, red y energía de la pantalla.',
                ],
                actions: [
                    {
                        type: 'link',
                        href: salaUrl,
                        label: 'Abrir sala TV',
                        primary: true,
                    },
                    {
                        type: 'link',
                        href: buildGuideUrl('sala_tv', preset, salaConfig),
                        label: 'Instalar APK',
                        external: true,
                    },
                    {
                        type: 'copy',
                        url: salaUrl,
                        label: 'Copiar fallback web',
                    },
                ],
            },
            {
                id: 'sync_issue',
                state: syncHealth.state,
                badge: syncHealth.badge,
                title: syncHealth.title,
                summary: syncHealth.summary,
                steps: syncHealth.steps,
                actions: [
                    {
                        type: 'button',
                        action: 'queue-refresh-state',
                        label: 'Refrescar cola',
                        primary: syncHealth.state !== 'ready',
                    },
                    {
                        type: 'link',
                        href: operatorUrl,
                        label: 'Abrir operador web',
                    },
                    {
                        type: 'copy',
                        url: kioskUrl,
                        label: 'Copiar kiosco web',
                    },
                ],
            },
        ],
    };
}

function renderContingencyAction(cardId, action, index) {
    const label = escapeHtml(action.label || 'Abrir');
    const className = action.primary
        ? 'queue-contingency-card__action queue-contingency-card__action--primary'
        : 'queue-contingency-card__action';

    if (action.type === 'button') {
        return `
            <button
                type="button"
                class="${className}"
                data-action="${escapeHtml(action.action || '')}"
                data-queue-contingency-card="${escapeHtml(cardId)}"
                data-queue-contingency-action-index="${escapeHtml(String(index))}"
            >
                ${label}
            </button>
        `;
    }

    if (action.type === 'copy') {
        return `
            <button
                type="button"
                class="${className}"
                data-action="queue-copy-install-link"
                data-queue-install-url="${escapeHtml(action.url || '')}"
                data-queue-contingency-card="${escapeHtml(cardId)}"
                data-queue-contingency-action-index="${escapeHtml(String(index))}"
            >
                ${label}
            </button>
        `;
    }

    return `
        <a
            href="${escapeHtml(action.href || '/')}"
            class="${className}"
            ${action.external ? 'target="_blank" rel="noopener"' : ''}
        >
            ${label}
        </a>
    `;
}

function renderContingencyDeck(manifest, detectedPlatform) {
    const root = document.getElementById('queueContingencyDeck');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const { syncHealth, cards } = buildContingencyCards(
        manifest,
        detectedPlatform
    );
    const title =
        syncHealth.state === 'alert'
            ? 'Contingencia activa'
            : syncHealth.state === 'warning'
              ? 'Contingencia preventiva'
              : 'Contingencia rápida lista';
    const summary =
        syncHealth.state === 'alert'
            ? 'Resuelve primero la sincronización y luego ataca hardware puntual. Las rutas de abajo ya quedan preparadas para operar sin perder tiempo.'
            : syncHealth.state === 'warning'
              ? 'Hay señal de retraso en la cola. Usa estas rutas directas antes de que el operador quede fuera de contexto.'
              : 'Las tarjetas de abajo sirven como ruta corta cuando algo falla en medio de la jornada, sin mezclar instalación con operación.';

    setHtml(
        '#queueContingencyDeck',
        `
            <section class="queue-contingency-deck__shell">
                <div class="queue-contingency-deck__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Contingencia rápida</p>
                        <h5 id="queueContingencyTitle" class="queue-app-card__title">${escapeHtml(
                            title
                        )}</h5>
                        <p id="queueContingencySummary" class="queue-contingency-deck__summary">${escapeHtml(
                            summary
                        )}</p>
                    </div>
                    <span
                        id="queueContingencyStatus"
                        class="queue-contingency-deck__status"
                        data-state="${escapeHtml(syncHealth.state)}"
                    >
                        ${escapeHtml(syncHealth.badge)}
                    </span>
                </div>
                <div id="queueContingencyCards" class="queue-contingency-deck__grid" role="list" aria-label="Tarjetas de contingencia rápida">
                    ${cards
                        .map(
                            (card) => `
                                <article
                                    class="queue-contingency-card"
                                    ${card.id === 'sync_issue' ? 'id="queueContingencySyncCard"' : ''}
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-contingency-card__header">
                                        <div>
                                            <strong>${escapeHtml(card.title)}</strong>
                                            <p class="queue-contingency-card__summary">${escapeHtml(
                                                card.summary
                                            )}</p>
                                        </div>
                                        <span class="queue-contingency-card__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <ul class="queue-contingency-card__steps">
                                        ${card.steps
                                            .map(
                                                (step) =>
                                                    `<li>${escapeHtml(step)}</li>`
                                            )
                                            .join('')}
                                    </ul>
                                    <div class="queue-contingency-card__actions">
                                        ${card.actions
                                            .map((action, index) =>
                                                renderContingencyAction(
                                                    card.id,
                                                    action,
                                                    index
                                                )
                                            )
                                            .join('')}
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );
}

function renderOpeningChecklist(manifest, detectedPlatform) {
    const root = document.getElementById('queueOpeningChecklist');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const checklist = ensureOpeningChecklistState();
    const steps = buildOpeningChecklistSteps(manifest, detectedPlatform);
    const assist = buildOpeningChecklistAssist(detectedPlatform);
    const confirmedCount = steps.filter(
        (step) => checklist.steps[step.id]
    ).length;
    const suggestedCount = steps.filter(
        (step) =>
            !checklist.steps[step.id] &&
            Boolean(assist.suggestions[step.id]?.suggested)
    ).length;
    const pendingCount = steps.length - confirmedCount;
    const title =
        pendingCount <= 0
            ? 'Apertura diaria lista'
            : suggestedCount > 0
              ? 'Apertura diaria asistida'
              : confirmedCount <= 0
                ? 'Apertura diaria pendiente'
                : `Apertura diaria: faltan ${pendingCount} paso(s)`;
    const summary =
        pendingCount <= 0
            ? 'Operador, kiosco y sala TV ya quedaron probados en este navegador admin para hoy.'
            : suggestedCount > 0
              ? `${suggestedCount} paso(s) ya aparecen listos por telemetría o actividad reciente. Confírmalos en bloque y deja solo las validaciones pendientes.`
              : 'Sigue cada paso desde esta vista y marca listo solo después de validar el equipo real. El avance se guarda en este navegador.';

    setHtml(
        '#queueOpeningChecklist',
        `
            <section class="queue-opening-checklist__shell">
                <div class="queue-opening-checklist__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Apertura diaria</p>
                        <h5 id="queueOpeningChecklistTitle" class="queue-app-card__title">${escapeHtml(
                            title
                        )}</h5>
                        <p id="queueOpeningChecklistSummary" class="queue-opening-checklist__summary">${escapeHtml(
                            summary
                        )}</p>
                    </div>
                    <div class="queue-opening-checklist__meta">
                        <span
                            id="queueOpeningChecklistAssistChip"
                            class="queue-opening-checklist__assist"
                            data-state="${suggestedCount > 0 ? 'suggested' : pendingCount <= 0 ? 'ready' : 'idle'}"
                        >
                            ${escapeHtml(
                                suggestedCount > 0
                                    ? `Sugeridos ${suggestedCount}`
                                    : pendingCount <= 0
                                      ? 'Checklist completo'
                                      : `Confirmados ${confirmedCount}/${steps.length}`
                            )}
                        </span>
                        <button
                            id="queueOpeningChecklistApplyBtn"
                            type="button"
                            class="queue-opening-checklist__apply"
                            ${suggestedCount > 0 ? '' : 'disabled'}
                        >
                            ${
                                suggestedCount > 0
                                    ? `Confirmar sugeridos (${suggestedCount})`
                                    : 'Sin sugeridos todavía'
                            }
                        </button>
                        <button
                            id="queueOpeningChecklistResetBtn"
                            type="button"
                            class="queue-opening-checklist__reset"
                        >
                            Reiniciar apertura de hoy
                        </button>
                        <span id="queueOpeningChecklistDate" class="queue-opening-checklist__date">
                            ${escapeHtml(formatOpeningChecklistDate(checklist.date))}
                        </span>
                    </div>
                </div>
                <div id="queueOpeningChecklistSteps" class="queue-opening-checklist__steps" role="list" aria-label="Checklist de apertura diaria">
                    ${steps
                        .map((step) => {
                            const isReady = Boolean(checklist.steps[step.id]);
                            const isSuggested =
                                !isReady &&
                                Boolean(assist.suggestions[step.id]?.suggested);
                            const stepState = isReady
                                ? 'ready'
                                : isSuggested
                                  ? 'suggested'
                                  : 'pending';
                            const stateLabel = isReady
                                ? 'Confirmado'
                                : isSuggested
                                  ? 'Sugerido'
                                  : 'Pendiente';
                            const evidence = String(
                                assist.suggestions[step.id]?.reason || step.hint
                            );
                            return `
                                <article
                                    class="queue-opening-step"
                                    data-state="${stepState}"
                                    role="listitem"
                                >
                                    <div class="queue-opening-step__header">
                                        <div>
                                            <strong>${escapeHtml(step.title)}</strong>
                                            <p class="queue-opening-step__detail">${escapeHtml(step.detail)}</p>
                                        </div>
                                        <span class="queue-opening-step__state">
                                            ${escapeHtml(stateLabel)}
                                        </span>
                                    </div>
                                    <p class="queue-opening-step__hint">${escapeHtml(step.hint)}</p>
                                    <p class="queue-opening-step__evidence">${escapeHtml(evidence)}</p>
                                    <div class="queue-opening-step__actions">
                                        <a
                                            href="${escapeHtml(step.href)}"
                                            target="_blank"
                                            rel="noopener"
                                            class="queue-opening-step__primary"
                                        >
                                            ${escapeHtml(step.actionLabel)}
                                        </a>
                                        <button
                                            id="queueOpeningToggle_${escapeHtml(step.id)}"
                                            type="button"
                                            class="queue-opening-step__toggle"
                                            data-queue-opening-step="${escapeHtml(step.id)}"
                                            data-state="${stepState}"
                                        >
                                            ${
                                                isReady
                                                    ? 'Marcar pendiente'
                                                    : isSuggested
                                                      ? 'Confirmar sugerido'
                                                      : 'Marcar listo'
                                            }
                                        </button>
                                    </div>
                                </article>
                            `;
                        })
                        .join('')}
                </div>
            </section>
        `
    );

    root.querySelectorAll('[data-queue-opening-step]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const stepId = String(button.dataset.queueOpeningStep || '');
            const current = ensureOpeningChecklistState();
            const nextValue = !current.steps[stepId];
            setOpeningChecklistStep(stepId, nextValue);
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
        };
    });

    const applyButton = document.getElementById(
        'queueOpeningChecklistApplyBtn'
    );
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            if (!assist.suggestedIds.length) {
                return;
            }
            applyOpeningChecklistSuggestions(assist.suggestedIds);
            appendOpsLogEntry({
                tone: 'success',
                source: 'opening',
                title: `Apertura: ${assist.suggestedIds.length} sugerido(s) confirmados`,
                summary: `El checklist de apertura quedó actualizado usando telemetría reciente. Perfil activo: ${getInstallPresetLabel(
                    detectedPlatform
                )}.`,
            });
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const resetButton = document.getElementById(
        'queueOpeningChecklistResetBtn'
    );
    if (resetButton instanceof HTMLButtonElement) {
        resetButton.onclick = () => {
            resetOpeningChecklistState();
            appendOpsLogEntry({
                tone: 'warning',
                source: 'opening',
                title: 'Apertura reiniciada',
                summary:
                    'Se limpiaron las confirmaciones de apertura del día para volver a validar operador, kiosco, sala y smoke final.',
            });
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }
}

function renderShiftHandoff(manifest, detectedPlatform) {
    const root = document.getElementById('queueShiftHandoff');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const checklist = ensureShiftHandoffState();
    const steps = buildShiftHandoffSteps(manifest, detectedPlatform);
    const assist = buildShiftHandoffAssist(detectedPlatform);
    const confirmedCount = steps.filter(
        (step) => checklist.steps[step.id]
    ).length;
    const suggestedCount = steps.filter(
        (step) =>
            !checklist.steps[step.id] &&
            Boolean(assist.suggestions[step.id]?.suggested)
    ).length;
    const pendingCount = steps.length - confirmedCount;
    const title =
        pendingCount <= 0
            ? 'Relevo listo'
            : assist.suggestions.queue_clear?.suggested
              ? suggestedCount > 0
                  ? 'Cierre y relevo asistido'
                  : `Cierre: faltan ${pendingCount} paso(s)`
              : 'No cierres todavía';
    const summary =
        pendingCount <= 0
            ? 'El relevo quedó documentado para hoy y la cola ya está sin pendientes visibles.'
            : assist.suggestions.queue_clear?.suggested
              ? suggestedCount > 0
                  ? `${suggestedCount} paso(s) de relevo ya aparecen listos por telemetría. Copia el resumen o confirma sugeridos para cerrar más rápido.`
                  : 'Ya no hay tickets activos. Termina las comprobaciones de equipos para dejar el siguiente turno más claro.'
              : String(
                    assist.suggestions.queue_clear?.reason ||
                        'La cola todavía tiene actividad.'
                );

    setHtml(
        '#queueShiftHandoff',
        `
            <section class="queue-shift-handoff__shell">
                <div class="queue-shift-handoff__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Cierre y relevo</p>
                        <h5 id="queueShiftHandoffTitle" class="queue-app-card__title">${escapeHtml(
                            title
                        )}</h5>
                        <p id="queueShiftHandoffSummary" class="queue-shift-handoff__summary">${escapeHtml(
                            summary
                        )}</p>
                    </div>
                    <div class="queue-shift-handoff__meta">
                        <span
                            id="queueShiftHandoffAssistChip"
                            class="queue-shift-handoff__assist"
                            data-state="${suggestedCount > 0 ? 'suggested' : pendingCount <= 0 ? 'ready' : 'idle'}"
                        >
                            ${escapeHtml(
                                suggestedCount > 0
                                    ? `Sugeridos ${suggestedCount}`
                                    : pendingCount <= 0
                                      ? 'Relevo completo'
                                      : `Confirmados ${confirmedCount}/${steps.length}`
                            )}
                        </span>
                        <button
                            id="queueShiftHandoffCopyBtn"
                            type="button"
                            class="queue-shift-handoff__copy"
                        >
                            Copiar resumen de relevo
                        </button>
                        <button
                            id="queueShiftHandoffApplyBtn"
                            type="button"
                            class="queue-shift-handoff__apply"
                            ${suggestedCount > 0 ? '' : 'disabled'}
                        >
                            ${
                                suggestedCount > 0
                                    ? `Confirmar sugeridos (${suggestedCount})`
                                    : 'Sin sugeridos todavía'
                            }
                        </button>
                        <button
                            id="queueShiftHandoffResetBtn"
                            type="button"
                            class="queue-shift-handoff__reset"
                        >
                            Reiniciar relevo de hoy
                        </button>
                    </div>
                </div>
                <div class="queue-shift-handoff__summary-box">
                    <pre id="queueShiftHandoffPreview" class="queue-shift-handoff__preview">${escapeHtml(
                        buildShiftHandoffSummary(detectedPlatform)
                    )}</pre>
                </div>
                <div id="queueShiftHandoffSteps" class="queue-shift-handoff__steps" role="list" aria-label="Checklist de cierre y relevo">
                    ${steps
                        .map((step) => {
                            const isReady = Boolean(checklist.steps[step.id]);
                            const isSuggested =
                                !isReady &&
                                Boolean(assist.suggestions[step.id]?.suggested);
                            const stepState = isReady
                                ? 'ready'
                                : isSuggested
                                  ? 'suggested'
                                  : 'pending';
                            const stateLabel = isReady
                                ? 'Confirmado'
                                : isSuggested
                                  ? 'Sugerido'
                                  : 'Pendiente';
                            const evidence = String(
                                assist.suggestions[step.id]?.reason || step.hint
                            );
                            return `
                                <article class="queue-shift-step" data-state="${stepState}" role="listitem">
                                    <div class="queue-shift-step__header">
                                        <div>
                                            <strong>${escapeHtml(step.title)}</strong>
                                            <p class="queue-shift-step__detail">${escapeHtml(step.detail)}</p>
                                        </div>
                                        <span class="queue-shift-step__state">${escapeHtml(
                                            stateLabel
                                        )}</span>
                                    </div>
                                    <p class="queue-shift-step__hint">${escapeHtml(step.hint)}</p>
                                    <p class="queue-shift-step__evidence">${escapeHtml(
                                        evidence
                                    )}</p>
                                    <div class="queue-shift-step__actions">
                                        <a
                                            href="${escapeHtml(step.href)}"
                                            target="_blank"
                                            rel="noopener"
                                            class="queue-shift-step__primary"
                                        >
                                            ${escapeHtml(step.actionLabel)}
                                        </a>
                                        <button
                                            id="queueShiftToggle_${escapeHtml(step.id)}"
                                            type="button"
                                            class="queue-shift-step__toggle"
                                            data-queue-shift-step="${escapeHtml(step.id)}"
                                            data-state="${stepState}"
                                        >
                                            ${
                                                isReady
                                                    ? 'Marcar pendiente'
                                                    : isSuggested
                                                      ? 'Confirmar sugerido'
                                                      : 'Marcar listo'
                                            }
                                        </button>
                                    </div>
                                </article>
                            `;
                        })
                        .join('')}
                </div>
            </section>
        `
    );

    const copyButton = document.getElementById('queueShiftHandoffCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyShiftHandoffSummary(detectedPlatform);
        };
    }

    const applyButton = document.getElementById('queueShiftHandoffApplyBtn');
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            if (!assist.suggestedIds.length) {
                return;
            }
            applyShiftHandoffSuggestions(assist.suggestedIds);
            appendOpsLogEntry({
                tone: 'success',
                source: 'handoff',
                title: `Relevo: ${assist.suggestedIds.length} sugerido(s) confirmados`,
                summary:
                    'El cierre del día quedó marcado con pasos validados por telemetría para operador, kiosco y sala.',
            });
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const resetButton = document.getElementById('queueShiftHandoffResetBtn');
    if (resetButton instanceof HTMLButtonElement) {
        resetButton.onclick = () => {
            resetShiftHandoffState();
            appendOpsLogEntry({
                tone: 'warning',
                source: 'handoff',
                title: 'Relevo reiniciado',
                summary:
                    'Se limpiaron las marcas de cierre del día para rehacer el relevo con estado fresco.',
            });
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    root.querySelectorAll('[data-queue-shift-step]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const stepId = String(button.dataset.queueShiftStep || '');
            const current = ensureShiftHandoffState();
            const nextValue = !current.steps[stepId];
            setShiftHandoffStep(stepId, nextValue);
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
        };
    });
}

function renderQueueOpsLog(manifest, detectedPlatform) {
    const root = document.getElementById('queueOpsLog');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const logState = ensureOpsLogState();
    const activeFilter = ensureOpsLogFilter();
    const filteredItems = filterOpsLogItems(logState.items, activeFilter);
    const lastEntry = logState.items[0] || null;
    const summary = lastEntry
        ? `${lastEntry.title}. ${lastEntry.summary} Vista actual: ${getOpsLogFilterLabel(
              activeFilter
          )}.`
        : 'Todavía no hay eventos guardados hoy. Registra el estado actual, una incidencia o deja rastro del relevo sin salir del admin.';
    const chipLabel =
        logState.items.length > 0
            ? `${logState.items.length} evento(s) hoy`
            : 'Sin eventos';
    const chipState = lastEntry
        ? lastEntry.tone === 'alert'
            ? 'alert'
            : lastEntry.tone === 'warning'
              ? 'warning'
              : 'ready'
        : 'idle';

    setHtml(
        '#queueOpsLog',
        `
            <section class="queue-ops-log__shell">
                <div class="queue-ops-log__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Bitácora operativa</p>
                        <h5 id="queueOpsLogTitle" class="queue-app-card__title">Bitácora operativa del día</h5>
                        <p id="queueOpsLogSummary" class="queue-ops-log__summary">${escapeHtml(
                            summary
                        )}</p>
                        <div class="queue-ops-log__filters" role="tablist" aria-label="Filtro de bitácora">
                            <button
                                id="queueOpsLogFilterAll"
                                type="button"
                                class="queue-ops-log__filter"
                                data-filter="all"
                                data-state="${activeFilter === 'all' ? 'active' : 'idle'}"
                            >
                                Todo
                            </button>
                            <button
                                id="queueOpsLogFilterIncidents"
                                type="button"
                                class="queue-ops-log__filter"
                                data-filter="incidents"
                                data-state="${activeFilter === 'incidents' ? 'active' : 'idle'}"
                            >
                                Incidencias
                            </button>
                            <button
                                id="queueOpsLogFilterChanges"
                                type="button"
                                class="queue-ops-log__filter"
                                data-filter="changes"
                                data-state="${activeFilter === 'changes' ? 'active' : 'idle'}"
                            >
                                Cambios
                            </button>
                            <button
                                id="queueOpsLogFilterStatus"
                                type="button"
                                class="queue-ops-log__filter"
                                data-filter="status"
                                data-state="${activeFilter === 'status' ? 'active' : 'idle'}"
                            >
                                Estados
                            </button>
                        </div>
                    </div>
                    <div class="queue-ops-log__meta">
                        <span
                            id="queueOpsLogChip"
                            class="queue-ops-log__chip"
                            data-state="${escapeHtml(chipState)}"
                        >
                            ${escapeHtml(chipLabel)}
                        </span>
                        <button
                            id="queueOpsLogStatusBtn"
                            type="button"
                            class="queue-ops-log__action queue-ops-log__action--primary"
                        >
                            Registrar estado actual
                        </button>
                        <button
                            id="queueOpsLogIncidentBtn"
                            type="button"
                            class="queue-ops-log__action"
                        >
                            Registrar incidencia actual
                        </button>
                        <button
                            id="queueOpsLogCopyBtn"
                            type="button"
                            class="queue-ops-log__action"
                        >
                            Copiar bitácora
                        </button>
                        <button
                            id="queueOpsLogClearBtn"
                            type="button"
                            class="queue-ops-log__action"
                        >
                            Limpiar bitácora de hoy
                        </button>
                    </div>
                </div>
                <div id="queueOpsLogItems" class="queue-ops-log__list" role="list" aria-label="Bitácora operativa">
                    ${
                        filteredItems.length > 0
                            ? filteredItems
                                  .map(
                                      (item) => `
                                        <article class="queue-ops-log__item" data-state="${escapeHtml(
                                            item.tone
                                        )}" role="listitem">
                                            <div class="queue-ops-log__item-head">
                                                <div class="queue-ops-log__item-copy">
                                                    <strong>${escapeHtml(item.title)}</strong>
                                                    <span class="queue-ops-log__source">${escapeHtml(
                                                        getOpsLogSourceLabel(
                                                            item.source
                                                        )
                                                    )}</span>
                                                </div>
                                                <span>${escapeHtml(
                                                    formatDateTime(
                                                        item.createdAt
                                                    )
                                                )}</span>
                                            </div>
                                            <p>${escapeHtml(item.summary)}</p>
                                        </article>
                                    `
                                  )
                                  .join('')
                            : `
                                <article class="queue-ops-log__empty" role="listitem">
                                    <strong>Sin eventos para este filtro</strong>
                                    <p>No hay registros en ${escapeHtml(
                                        getOpsLogFilterLabel(
                                            activeFilter
                                        ).toLowerCase()
                                    )} hoy. Cambia el filtro o registra un estado/incidencia nueva.</p>
                                </article>
                            `
                    }
                </div>
            </section>
        `
    );

    const statusButton = document.getElementById('queueOpsLogStatusBtn');
    if (statusButton instanceof HTMLButtonElement) {
        statusButton.onclick = () => {
            appendOpsLogEntry(
                buildOpsLogStatusEntry(manifest, detectedPlatform)
            );
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const incidentButton = document.getElementById('queueOpsLogIncidentBtn');
    if (incidentButton instanceof HTMLButtonElement) {
        incidentButton.onclick = () => {
            appendOpsLogEntry(
                buildOpsLogIncidentEntry(manifest, detectedPlatform)
            );
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const copyButton = document.getElementById('queueOpsLogCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyOpsLogReport(detectedPlatform);
        };
    }

    const clearButton = document.getElementById('queueOpsLogClearBtn');
    if (clearButton instanceof HTMLButtonElement) {
        clearButton.onclick = () => {
            clearOpsLogState();
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    root.querySelectorAll('[data-filter]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            persistOpsLogFilter(button.dataset.filter || 'all');
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    });
}

function rerenderQueueOpsHub(manifest, detectedPlatform) {
    renderQueueFocusMode(manifest, detectedPlatform);
    renderQueueNumpadGuide(manifest, detectedPlatform);
    renderConsultorioBoard(manifest, detectedPlatform);
    renderQueueWaitRadar(manifest, detectedPlatform);
    renderQueueDispatchDeck(manifest, detectedPlatform);
    renderQueueQuickConsole(manifest, detectedPlatform);
    renderQueuePlaybook(manifest, detectedPlatform);
    renderQueueOpsPilot(manifest, detectedPlatform);
    renderSurfaceTelemetry(manifest, detectedPlatform);
    renderQueueOpsAlerts(manifest, detectedPlatform);
    renderContingencyDeck(manifest, detectedPlatform);
    renderOpeningChecklist(manifest, detectedPlatform);
    renderShiftHandoff(manifest, detectedPlatform);
    renderQueueOpsLog(manifest, detectedPlatform);
    renderInstallConfigurator(manifest, detectedPlatform);
    syncQueueOpsInteractionIndicator();
    scheduleQueueOpsInteractionSettle();
}

function renderInstallConfigurator(manifest, detectedPlatform) {
    const root = document.getElementById('queueInstallConfigurator');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const preset = ensureInstallPreset(detectedPlatform);
    const surfaceKey =
        preset.surface === 'kiosk' || preset.surface === 'sala_tv'
            ? preset.surface
            : 'operator';
    const appConfig = manifest[surfaceKey];
    if (!appConfig) {
        root.innerHTML = '';
        return;
    }

    const targetKey =
        surfaceKey === 'sala_tv'
            ? 'android_tv'
            : preset.platform === 'mac'
              ? 'mac'
              : 'win';
    const downloadTarget =
        (appConfig.targets && appConfig.targets[targetKey]) ||
        getDesktopTarget(appConfig, detectedPlatform) ||
        null;
    const preparedWebUrl = buildPreparedSurfaceUrl(
        surfaceKey,
        appConfig,
        preset
    );
    const qrUrl =
        surfaceKey === 'sala_tv'
            ? buildQrUrl(
                  (downloadTarget && downloadTarget.url) || preparedWebUrl
              )
            : buildQrUrl(preparedWebUrl);
    const guideUrl = buildGuideUrl(surfaceKey, preset, appConfig);
    const setupSteps = buildPresetSteps(preset)
        .map((step) => `<li>${escapeHtml(step)}</li>`)
        .join('');
    const presetChoices = buildInstallPresetChoices(detectedPlatform)
        .map(
            (choice) => `
                <button
                    id="queueInstallPreset_${escapeHtml(choice.id)}"
                    type="button"
                    class="queue-install-preset-btn"
                    data-queue-install-preset="${escapeHtml(choice.id)}"
                    data-state="${choice.state ? 'active' : 'idle'}"
                >
                    ${escapeHtml(choice.label)}
                </button>
            `
        )
        .join('');

    setHtml(
        '#queueInstallConfigurator',
        `
            <div class="queue-install-configurator__grid">
                <section class="queue-install-configurator__panel">
                    <div>
                        <p class="queue-app-card__eyebrow">Preparar equipo</p>
                        <h5 class="queue-app-card__title">Asistente de instalación</h5>
                        <p class="queue-app-card__description">
                            Genera el perfil recomendado para cada equipo y copia la ruta exacta antes de instalar.
                        </p>
                    </div>
                    <div class="queue-install-configurator__presets" role="group" aria-label="Perfiles rápidos de instalación">
                        ${presetChoices}
                    </div>
                    <div class="queue-install-configurator__fields">
                        <label class="queue-install-field" for="queueInstallSurfaceSelect">
                            <span>Equipo</span>
                            <select id="queueInstallSurfaceSelect">
                                <option value="operator"${surfaceKey === 'operator' ? ' selected' : ''}>Operador</option>
                                <option value="kiosk"${surfaceKey === 'kiosk' ? ' selected' : ''}>Kiosco</option>
                                <option value="sala_tv"${surfaceKey === 'sala_tv' ? ' selected' : ''}>Sala TV</option>
                            </select>
                        </label>
                        ${
                            surfaceKey === 'operator'
                                ? `
                                    <label class="queue-install-field" for="queueInstallProfileSelect">
                                        <span>Perfil operador</span>
                                        <select id="queueInstallProfileSelect">
                                            <option value="c1_locked"${
                                                preset.lock &&
                                                preset.station === 'c1'
                                                    ? ' selected'
                                                    : ''
                                            }>C1 fijo</option>
                                            <option value="c2_locked"${
                                                preset.lock &&
                                                preset.station === 'c2'
                                                    ? ' selected'
                                                    : ''
                                            }>C2 fijo</option>
                                            <option value="free"${
                                                !preset.lock ? ' selected' : ''
                                            }>Modo libre</option>
                                        </select>
                                    </label>
                                `
                                : ''
                        }
                        ${
                            surfaceKey !== 'sala_tv'
                                ? `
                                    <label class="queue-install-field" for="queueInstallPlatformSelect">
                                        <span>Plataforma</span>
                                        <select id="queueInstallPlatformSelect">
                                            <option value="win"${
                                                preset.platform === 'win'
                                                    ? ' selected'
                                                    : ''
                                            }>Windows</option>
                                            <option value="mac"${
                                                preset.platform === 'mac'
                                                    ? ' selected'
                                                    : ''
                                            }>macOS</option>
                                        </select>
                                    </label>
                                `
                                : ''
                        }
                        ${
                            surfaceKey === 'operator'
                                ? `
                                    <label class="queue-install-toggle">
                                        <input id="queueInstallOneTapInput" type="checkbox"${
                                            preset.oneTap ? ' checked' : ''
                                        } />
                                        <span>Activar 1 tecla para este operador</span>
                                    </label>
                                `
                                : ''
                        }
                    </div>
                </section>
                <section class="queue-install-configurator__panel queue-install-configurator__result">
                    <div>
                        <p class="queue-app-card__eyebrow">Resultado listo</p>
                        <h5 class="queue-app-card__title">${escapeHtml(
                            buildPresetSummaryTitle(preset)
                        )}</h5>
                        <p class="queue-app-card__description">
                            ${
                                surfaceKey === 'sala_tv'
                                    ? 'Usa el APK para la TV y mantén el fallback web como respaldo.'
                                    : 'Descarga la app correcta y usa la ruta preparada como validación o respaldo.'
                            }
                        </p>
                    </div>
                    <div class="queue-install-result__chips">
                        <span class="queue-app-card__tag">
                            ${escapeHtml(
                                downloadTarget && downloadTarget.label
                                    ? downloadTarget.label
                                    : 'Perfil listo'
                            )}
                        </span>
                        ${
                            surfaceKey === 'operator'
                                ? `<span class="queue-app-card__tag">${
                                      preset.lock
                                          ? preset.station === 'c2'
                                              ? 'C2 bloqueado'
                                              : 'C1 bloqueado'
                                          : 'Modo libre'
                                  }</span>`
                                : ''
                        }
                    </div>
                    <div class="queue-install-result__meta">
                        <span>Descarga recomendada</span>
                        <strong>${escapeHtml(
                            (downloadTarget && downloadTarget.url) ||
                                'Sin artefacto'
                        )}</strong>
                    </div>
                    <div class="queue-install-result__meta">
                        <span>Ruta web preparada</span>
                        <strong>${escapeHtml(preparedWebUrl)}</strong>
                    </div>
                    <div class="queue-install-configurator__actions">
                        ${
                            downloadTarget && downloadTarget.url
                                ? `<a href="${escapeHtml(
                                      downloadTarget.url
                                  )}" class="queue-app-card__cta-primary" download>Descargar artefacto</a>`
                                : ''
                        }
                        <button
                            type="button"
                            data-action="queue-copy-install-link"
                            data-queue-install-url="${escapeHtml(
                                absoluteUrl(
                                    (downloadTarget && downloadTarget.url) || ''
                                )
                            )}"
                        >
                            Copiar descarga
                        </button>
                        <a href="${escapeHtml(preparedWebUrl)}" target="_blank" rel="noopener">
                            Abrir ruta preparada
                        </a>
                        <button
                            type="button"
                            data-action="queue-copy-install-link"
                            data-queue-install-url="${escapeHtml(preparedWebUrl)}"
                        >
                            Copiar ruta preparada
                        </button>
                        <a href="${escapeHtml(qrUrl)}" target="_blank" rel="noopener">
                            Mostrar QR
                        </a>
                        <a href="${escapeHtml(guideUrl)}" target="_blank" rel="noopener">
                            Abrir centro público
                        </a>
                    </div>
                    <ul class="queue-app-card__notes">${setupSteps}</ul>
                </section>
            </div>
        `
    );

    root.querySelectorAll('[data-queue-install-preset]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const choice = buildInstallPresetChoices(detectedPlatform).find(
                (item) => item.id === button.dataset.queueInstallPreset
            );
            if (!choice) {
                return;
            }
            persistInstallPreset(choice.nextPreset, detectedPlatform);
            appendOpsLogEntry({
                tone: 'info',
                source: 'config',
                title: `Preset rápido: ${choice.label}`,
                summary: `${getInstallPresetLabel(
                    detectedPlatform
                )}. El asistente ya quedó listo con este perfil.`,
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    });

    const surfaceSelect = document.getElementById('queueInstallSurfaceSelect');
    if (surfaceSelect instanceof HTMLSelectElement) {
        surfaceSelect.onchange = () => {
            persistInstallPreset(
                {
                    ...preset,
                    surface: surfaceSelect.value,
                },
                detectedPlatform
            );
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    }

    const profileSelect = document.getElementById('queueInstallProfileSelect');
    if (profileSelect instanceof HTMLSelectElement) {
        profileSelect.onchange = () => {
            persistInstallPreset(
                {
                    ...preset,
                    station: profileSelect.value === 'c2_locked' ? 'c2' : 'c1',
                    lock: profileSelect.value !== 'free',
                },
                detectedPlatform
            );
            appendOpsLogEntry({
                tone: 'info',
                source: 'config',
                title: 'Perfil operativo ajustado',
                summary: `${getInstallPresetLabel(
                    detectedPlatform
                )}. La ruta preparada ya quedó alineada para descarga y fallback.`,
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    }

    const platformSelect = document.getElementById(
        'queueInstallPlatformSelect'
    );
    if (platformSelect instanceof HTMLSelectElement) {
        platformSelect.onchange = () => {
            persistInstallPreset(
                {
                    ...preset,
                    platform: platformSelect.value === 'mac' ? 'mac' : 'win',
                },
                detectedPlatform
            );
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    }

    const oneTapInput = document.getElementById('queueInstallOneTapInput');
    if (oneTapInput instanceof HTMLInputElement) {
        oneTapInput.onchange = () => {
            persistInstallPreset(
                {
                    ...preset,
                    oneTap: oneTapInput.checked,
                },
                detectedPlatform
            );
            appendOpsLogEntry({
                tone: oneTapInput.checked ? 'info' : 'warning',
                source: 'config',
                title: oneTapInput.checked
                    ? 'Modo 1 tecla activado'
                    : 'Modo 1 tecla desactivado',
                summary: `${getInstallPresetLabel(
                    detectedPlatform
                )}. Ajuste guardado en el preparador de rutas operativas.`,
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    }
}

export function renderQueueInstallHub(options = {}) {
    const {
        allowDuringInteraction = false,
        manifestOverride = null,
        platformOverride = '',
    } = options || {};
    const cardsRoot = document.getElementById('queueAppDownloadsCards');
    if (!(cardsRoot instanceof HTMLElement)) {
        return;
    }
    const hubRoot = getQueueAppsHubRoot();
    if (hubRoot) {
        bindQueueOpsInteraction(hubRoot);
    }

    const platform =
        platformOverride === 'mac' ||
        platformOverride === 'win' ||
        platformOverride === 'other'
            ? platformOverride
            : detectPlatform();
    const platformChip = document.getElementById('queueAppsPlatformChip');
    const platformLabel =
        platform === 'mac'
            ? 'macOS detectado'
            : platform === 'win'
              ? 'Windows detectado'
              : 'Selecciona la plataforma del equipo';
    setText('#queueAppsPlatformChip', platformLabel);
    if (platformChip instanceof HTMLElement) {
        platformChip.setAttribute('data-platform', platform);
    }

    const manifest =
        manifestOverride && typeof manifestOverride === 'object'
            ? manifestOverride
            : mergeManifest();
    if (
        !allowDuringInteraction &&
        hubRoot &&
        hubRoot.dataset.queueHubReady === 'true' &&
        hasActiveQueueOpsInteraction()
    ) {
        scheduleDeferredQueueOpsHubRender(manifest, platform);
        return;
    }

    clearDeferredQueueOpsInteraction();
    setHtml(
        '#queueAppDownloadsCards',
        [
            renderDesktopCard('operator', manifest.operator, platform),
            renderDesktopCard('kiosk', manifest.kiosk, platform),
            renderTvCard(manifest.sala_tv),
        ].join('')
    );
    renderQueueFocusMode(manifest, platform);
    renderQueueNumpadGuide(manifest, platform);
    renderConsultorioBoard(manifest, platform);
    renderQueueWaitRadar(manifest, platform);
    renderQueueDispatchDeck(manifest, platform);
    renderQueueQuickConsole(manifest, platform);
    renderQueuePlaybook(manifest, platform);
    renderQueueOpsPilot(manifest, platform);
    renderSurfaceTelemetry(manifest, platform);
    renderQueueOpsAlerts(manifest, platform);
    renderContingencyDeck(manifest, platform);
    renderOpeningChecklist(manifest, platform);
    renderShiftHandoff(manifest, platform);
    renderQueueOpsLog(manifest, platform);
    renderInstallConfigurator(manifest, platform);
    if (hubRoot) {
        hubRoot.dataset.queueHubReady = 'true';
    }
    syncQueueOpsInteractionIndicator();
    scheduleQueueOpsInteractionSettle();
}
