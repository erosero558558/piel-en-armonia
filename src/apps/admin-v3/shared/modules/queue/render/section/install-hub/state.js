import { getState } from '../../../../../core/store.js';
import {
    OPENING_CHECKLIST_STEP_IDS,
    QUEUE_OPENING_CHECKLIST_STORAGE_KEY,
} from './constants.js';

let installPreset = null;
let openingChecklistState = null;

function getTodayLocalIsoDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatOpeningChecklistDate(isoDate) {
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
    return {
        date: String(source.date || '').trim() === today ? today : today,
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

export function ensureOpeningChecklistState() {
    const today = getTodayLocalIsoDate();
    if (!openingChecklistState || openingChecklistState.date !== today) {
        openingChecklistState = loadOpeningChecklistState();
    }
    return openingChecklistState;
}

export function setOpeningChecklistStep(stepId, complete) {
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

export function resetOpeningChecklistState() {
    return persistOpeningChecklistState(
        createOpeningChecklistState(getTodayLocalIsoDate())
    );
}

export function applyOpeningChecklistSuggestions(stepIds) {
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

export function ensureInstallPreset(detectedPlatform) {
    if (installPreset) {
        return installPreset;
    }

    const state = getState();
    installPreset = {
        surface: 'operator',
        station:
            Number(state.queue && state.queue.stationConsultorio) === 2
                ? 'c2'
                : 'c1',
        lock: Boolean(state.queue && state.queue.stationMode === 'locked'),
        oneTap: Boolean(state.queue && state.queue.oneTap),
        platform:
            detectedPlatform === 'win' || detectedPlatform === 'mac'
                ? detectedPlatform
                : 'win',
    };
    return installPreset;
}

export function setInstallPreset(nextPreset) {
    installPreset = { ...nextPreset };
    return installPreset;
}

export function updateInstallPreset(patch, detectedPlatform) {
    installPreset = {
        ...ensureInstallPreset(detectedPlatform),
        ...(patch || {}),
    };
    return installPreset;
}

export function buildPresetSummaryTitle(preset) {
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

export function buildPresetSteps(preset) {
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
