(function installOpsThemeGlobal() {
    const VALID_THEME_MODES = new Set(['light', 'dark', 'system']);
    const COMMAND_SURFACES = new Set(['admin', 'operator']);
    const AMBIENT_SURFACES = new Set(['kiosk', 'display']);
    const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';

    let systemThemeListenerBound = false;
    let hashThemeListenerBound = false;
    let bodySyncListenerBound = false;
    let systemThemeQuery = null;

    function isValidThemeMode(mode) {
        return VALID_THEME_MODES.has(
            String(mode || '')
                .trim()
                .toLowerCase()
        );
    }

    function normalizeThemeMode(mode, fallback = 'system') {
        const normalized = String(mode || '')
            .trim()
            .toLowerCase();
        if (isValidThemeMode(normalized)) {
            return normalized;
        }
        return fallback;
    }

    function safeReadStorageItem(key) {
        try {
            return localStorage.getItem(key) || '';
        } catch (_error) {
            return '';
        }
    }

    function getCurrentPathname() {
        return String(window.location.pathname || '')
            .trim()
            .toLowerCase();
    }

    function detectSurface(explicitSurface = '') {
        const normalized = String(explicitSurface || '')
            .trim()
            .toLowerCase();
        if (
            normalized === 'admin' ||
            normalized === 'operator' ||
            normalized === 'kiosk' ||
            normalized === 'display'
        ) {
            return normalized;
        }

        const pathname = getCurrentPathname();
        if (pathname.endsWith('/admin.html') || pathname === '/admin.html') {
            return 'admin';
        }
        if (
            pathname.endsWith('/operador-turnos.html') ||
            pathname === '/operador-turnos.html'
        ) {
            return 'operator';
        }
        if (
            pathname.endsWith('/kiosco-turnos.html') ||
            pathname === '/kiosco-turnos.html'
        ) {
            return 'kiosk';
        }
        if (
            pathname.endsWith('/sala-turnos.html') ||
            pathname === '/sala-turnos.html'
        ) {
            return 'display';
        }
        return '';
    }

    function detectFamily(surface, explicitFamily = '') {
        const normalizedFamily = String(explicitFamily || '')
            .trim()
            .toLowerCase();
        if (normalizedFamily === 'command' || normalizedFamily === 'ambient') {
            return normalizedFamily;
        }

        if (COMMAND_SURFACES.has(surface)) {
            return 'command';
        }
        if (AMBIENT_SURFACES.has(surface)) {
            return 'ambient';
        }
        return 'command';
    }

    function readStoredAdminThemeMode() {
        return normalizeThemeMode(safeReadStorageItem('themeMode'), 'system');
    }

    function isAdminQueueSurface() {
        if (detectSurface() !== 'admin') {
            return false;
        }

        const hash = String(window.location.hash || '')
            .trim()
            .toLowerCase();
        if (hash === '#queue') {
            return true;
        }
        if (hash !== '') {
            return false;
        }

        return (
            String(safeReadStorageItem('adminLastSection') || '')
                .trim()
                .toLowerCase() === 'queue'
        );
    }

    function getSystemThemeQuery() {
        if (systemThemeQuery) {
            return systemThemeQuery;
        }

        systemThemeQuery = window.matchMedia
            ? window.matchMedia(SYSTEM_THEME_QUERY)
            : null;
        return systemThemeQuery;
    }

    function resolveTone(mode) {
        const normalizedMode = normalizeThemeMode(mode, 'system');
        if (normalizedMode === 'light' || normalizedMode === 'dark') {
            return normalizedMode;
        }

        return getSystemThemeQuery() && getSystemThemeQuery().matches
            ? 'dark'
            : 'light';
    }

    function buildThemeState(options = {}) {
        const surface = detectSurface(options.surface);
        const family = detectFamily(surface, options.family);
        const explicitMode = normalizeThemeMode(options.mode, '');
        const mode =
            explicitMode ||
            (surface === 'admin' && !isAdminQueueSurface()
                ? readStoredAdminThemeMode()
                : 'system');

        return {
            surface,
            family,
            mode,
            tone: resolveTone(mode),
        };
    }

    function syncBodyToneFromRoot() {
        if (!(document.body instanceof HTMLElement)) {
            return;
        }

        const root = document.documentElement;
        const tone = String(root.getAttribute('data-ops-tone') || '').trim();
        const family = String(
            root.getAttribute('data-ops-family') || ''
        ).trim();
        const surface = String(
            root.getAttribute('data-ops-surface') || ''
        ).trim();
        const theme = String(root.getAttribute('data-theme') || '').trim();

        if (tone) {
            document.body.setAttribute('data-ops-tone', tone);
        }
        if (family) {
            document.body.setAttribute('data-ops-family', family);
        }
        if (surface) {
            document.body.setAttribute('data-ops-surface', surface);
        }
        if (theme) {
            document.body.setAttribute('data-theme', theme);
        }
    }

    function applyThemeState(state, { syncBody = true } = {}) {
        const root = document.documentElement;
        root.setAttribute('data-theme-mode', state.mode);
        root.setAttribute('data-theme', state.tone);
        root.setAttribute('data-ops-tone', state.tone);
        root.setAttribute('data-ops-family', state.family);
        if (state.surface) {
            root.setAttribute('data-ops-surface', state.surface);
        }
        if (state.surface === 'admin' && isAdminQueueSurface()) {
            root.setAttribute('data-admin-section', 'queue');
        }

        if (syncBody) {
            syncBodyToneFromRoot();
        }

        return state;
    }

    function applyOpsTheme(options = {}) {
        const state = buildThemeState(options);
        return applyThemeState(state, options);
    }

    function handleSystemThemeChange() {
        if (
            normalizeThemeMode(
                document.documentElement.getAttribute('data-theme-mode')
            ) !== 'system'
        ) {
            return;
        }

        applyOpsTheme({
            surface: document.documentElement.getAttribute('data-ops-surface'),
            family: document.documentElement.getAttribute('data-ops-family'),
            mode: 'system',
        });
    }

    function handleHashThemeChange() {
        if (detectSurface() !== 'admin') {
            return;
        }

        applyOpsTheme({
            surface: 'admin',
            family: 'command',
        });
    }

    function bindBodySyncListener() {
        if (bodySyncListenerBound) {
            return;
        }

        bodySyncListenerBound = true;
        if (document.readyState === 'loading') {
            document.addEventListener(
                'DOMContentLoaded',
                syncBodyToneFromRoot,
                {
                    once: true,
                }
            );
            return;
        }

        syncBodyToneFromRoot();
    }

    function bindSystemThemeListener() {
        if (systemThemeListenerBound) {
            return;
        }

        const mediaQuery = getSystemThemeQuery();
        if (!mediaQuery) {
            return;
        }

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleSystemThemeChange);
            systemThemeListenerBound = true;
            return;
        }

        if (typeof mediaQuery.addListener === 'function') {
            mediaQuery.addListener(handleSystemThemeChange);
            systemThemeListenerBound = true;
        }
    }

    function bindHashThemeListener() {
        if (hashThemeListenerBound || detectSurface() !== 'admin') {
            return;
        }

        window.addEventListener('hashchange', handleHashThemeChange);
        hashThemeListenerBound = true;
    }

    function initAutoOpsTheme(options = {}) {
        bindBodySyncListener();
        bindSystemThemeListener();
        bindHashThemeListener();
        return applyOpsTheme(options);
    }

    window.PielOpsTheme = {
        isValidThemeMode,
        normalizeThemeMode,
        detectSurface,
        detectFamily,
        isAdminQueueSurface,
        readStoredAdminThemeMode,
        resolveTone,
        buildThemeState,
        applyOpsTheme,
        initAutoOpsTheme,
        syncBodyTone: syncBodyToneFromRoot,
    };

    const surface = detectSurface();
    if (surface) {
        initAutoOpsTheme({ surface });
    }
})();
