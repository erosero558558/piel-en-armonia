import { withDeployAssetVersion } from './utils.js';
import { loadDeferredModule, runDeferredModule } from './loader.js';
import { getCurrentThemeMode, setCurrentThemeMode } from './state.js';
import { THEME_STORAGE_KEY, VALID_THEME_MODES } from './config.js';

const THEME_ENGINE_URL = withDeployAssetVersion('/theme-engine.js?v=figo-theme-20260219-phase1');
const systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function getThemeEngineDeps() {
    return {
        getCurrentThemeMode: getCurrentThemeMode,
        setCurrentThemeMode: (mode) => {
            setCurrentThemeMode(VALID_THEME_MODES.has(mode) ? mode : 'system');
        },
        themeStorageKey: THEME_STORAGE_KEY,
        validThemeModes: Array.from(VALID_THEME_MODES),
        getSystemThemeQuery: () => systemThemeQuery
    };
}

export function loadThemeEngine() {
    return loadDeferredModule({
        cacheKey: 'theme-engine',
        src: THEME_ENGINE_URL,
        scriptDataAttribute: 'data-theme-engine',
        resolveModule: () => window.PielThemeEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getThemeEngineDeps()),
        missingApiError: 'theme-engine loaded without API',
        loadError: 'No se pudo cargar theme-engine.js',
        logLabel: 'Theme engine'
    });
}

export function setThemeMode(mode) {
    runDeferredModule(loadThemeEngine, (engine) => engine.setThemeMode(mode));
}

export function initThemeMode() {
    runDeferredModule(loadThemeEngine, (engine) => engine.initThemeMode());
}
