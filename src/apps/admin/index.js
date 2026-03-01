const ADMIN_UI_QUERY_KEY = 'admin_ui';
const ADMIN_UI_STORAGE_KEY = 'adminUiVariant';
const ADMIN_UI_RESET_QUERY_KEY = 'admin_ui_reset';
const ADMIN_UI_FALLBACK = 'legacy';
const ADMIN_UI_VARIANTS = new Set(['legacy', 'sony_v2', 'sony_v3']);
const TRUTHY_QUERY_VALUES = new Set([
    '1',
    'true',
    'yes',
    'on',
    'clear',
    'reset',
]);
const FEATURE_FLAG_TIMEOUT_MS = 3500;
const ADMIN_LAST_SECTION_STORAGE_KEY = 'adminLastSection';
const PREBOOT_SECTION_SHORTCUTS = new Map([
    ['digit1', 'dashboard'],
    ['digit2', 'appointments'],
    ['digit3', 'callbacks'],
    ['digit4', 'reviews'],
    ['digit5', 'availability'],
    ['digit6', 'queue'],
    ['numpad1', 'dashboard'],
    ['numpad2', 'appointments'],
    ['numpad3', 'callbacks'],
    ['numpad4', 'reviews'],
    ['numpad5', 'availability'],
    ['numpad6', 'queue'],
    ['1', 'dashboard'],
    ['2', 'appointments'],
    ['3', 'callbacks'],
    ['4', 'reviews'],
    ['5', 'availability'],
    ['6', 'queue'],
]);
const SHIFTED_SHORTCUT_ALIASES = Object.freeze({
    '!': 'digit1',
    '@': 'digit2',
    '#': 'digit3',
    $: 'digit4',
    '%': 'digit5',
    '^': 'digit6',
    '"': 'digit2',
    '&': 'digit6',
});

function isTypingTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return Boolean(
        target.closest('input, textarea, select, [contenteditable="true"]')
    );
}

function resolvePrebootShortcutSection(event) {
    if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) {
        return '';
    }

    const key = String(event.key || '').toLowerCase();
    const code = String(event.code || '').toLowerCase();
    const candidates = [];

    if (code) candidates.push(code);
    if (key) candidates.push(key);

    const shiftedAlias = SHIFTED_SHORTCUT_ALIASES[key];
    if (shiftedAlias) {
        candidates.push(shiftedAlias);
    }

    for (const candidate of candidates) {
        const section = PREBOOT_SECTION_SHORTCUTS.get(candidate);
        if (section) return section;
    }

    return '';
}

function persistLastSection(section) {
    if (!section) return;
    try {
        localStorage.setItem(ADMIN_LAST_SECTION_STORAGE_KEY, section);
    } catch (_error) {
        // no-op
    }
}

function updateSectionHash(section) {
    if (!section) return;
    try {
        const url = new URL(window.location.href);
        url.hash = `#${section}`;
        window.history.replaceState(
            null,
            '',
            `${url.pathname}${url.search}${url.hash}`
        );
    } catch (_error) {
        // no-op
    }
}

function installPrebootShortcutCapture() {
    const handler = (event) => {
        if (
            document.documentElement.getAttribute('data-admin-ready') === 'true'
        ) {
            return;
        }
        if (isTypingTarget(event.target)) {
            return;
        }

        const section = resolvePrebootShortcutSection(event);
        if (!section) return;

        event.preventDefault();
        persistLastSection(section);
        updateSectionHash(section);
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
}

function normalizeVariant(value) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    return ADMIN_UI_VARIANTS.has(normalized) ? normalized : '';
}

function readVariantFromQuery() {
    try {
        const url = new URL(window.location.href);
        return normalizeVariant(url.searchParams.get(ADMIN_UI_QUERY_KEY));
    } catch (_error) {
        return '';
    }
}

function readVariantFromStorage() {
    try {
        return normalizeVariant(localStorage.getItem(ADMIN_UI_STORAGE_KEY));
    } catch (_error) {
        return '';
    }
}

function clearStoredVariant() {
    try {
        localStorage.removeItem(ADMIN_UI_STORAGE_KEY);
    } catch (_error) {
        // no-op
    }
}

function persistVariant(value) {
    const variant = normalizeVariant(value);
    if (!variant) return;
    try {
        localStorage.setItem(ADMIN_UI_STORAGE_KEY, variant);
    } catch (_error) {
        // no-op
    }
}

function readResetStorageFromQuery() {
    try {
        const url = new URL(window.location.href);
        if (!url.searchParams.has(ADMIN_UI_RESET_QUERY_KEY)) {
            return false;
        }
        const rawValue = String(
            url.searchParams.get(ADMIN_UI_RESET_QUERY_KEY) || ''
        )
            .trim()
            .toLowerCase();
        if (!rawValue) {
            return true;
        }
        return TRUTHY_QUERY_VALUES.has(rawValue);
    } catch (_error) {
        return false;
    }
}

function stripQueryParam(name) {
    try {
        const url = new URL(window.location.href);
        if (!url.searchParams.has(name)) {
            return;
        }
        url.searchParams.delete(name);
        const nextSearch = url.searchParams.toString();
        const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
        window.history.replaceState(null, '', nextUrl);
    } catch (_error) {
        // no-op
    }
}

async function readFeatureFlags() {
    const supportsAbortController = typeof AbortController === 'function';
    const controller = supportsAbortController ? new AbortController() : null;
    const timeoutId = window.setTimeout(() => {
        if (controller) {
            controller.abort();
        }
    }, FEATURE_FLAG_TIMEOUT_MS);

    try {
        const response = await fetch('/api.php?resource=features', {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
            },
            ...(controller ? { signal: controller.signal } : {}),
        });
        if (!response.ok) {
            return {
                sony_v2: null,
                sony_v3: null,
            };
        }

        const payload = await response.json();
        const data =
            payload &&
            payload.ok === true &&
            payload.data &&
            typeof payload.data === 'object'
                ? payload.data
                : null;

        return {
            sony_v2:
                data &&
                Object.prototype.hasOwnProperty.call(data, 'admin_sony_ui')
                    ? data.admin_sony_ui === true
                    : null,
            sony_v3:
                data &&
                Object.prototype.hasOwnProperty.call(data, 'admin_sony_ui_v3')
                    ? data.admin_sony_ui_v3 === true
                    : null,
        };
    } catch (_error) {
        return {
            sony_v2: null,
            sony_v3: null,
        };
    } finally {
        window.clearTimeout(timeoutId);
    }
}

async function resolveRequestedVariant(
    requested,
    getFeatureFlags,
    options = {}
) {
    const normalized = normalizeVariant(requested);
    if (!normalized) {
        return ADMIN_UI_FALLBACK;
    }

    const { persistAllowed = false } = options;
    if (normalized === 'legacy') {
        if (persistAllowed) {
            persistVariant('legacy');
        }
        return 'legacy';
    }

    const featureFlags = await getFeatureFlags();
    const sonyV2Enabled = featureFlags.sony_v2;
    const sonyV3Enabled = featureFlags.sony_v3;

    if (normalized === 'sony_v2' && sonyV2Enabled === false) {
        persistVariant('legacy');
        return 'legacy';
    }

    if (normalized === 'sony_v3') {
        if (sonyV3Enabled === false) {
            const degraded = sonyV2Enabled === true ? 'sony_v2' : 'legacy';
            persistVariant(degraded);
            return degraded;
        }
        if (sonyV2Enabled === false) {
            persistVariant('legacy');
            return 'legacy';
        }
    }

    if (persistAllowed) {
        persistVariant(normalized);
    }
    return normalized;
}

async function resolveVariant({ resetStorage } = { resetStorage: false }) {
    if (resetStorage) {
        clearStoredVariant();
    }

    let featureFlagsCache;
    const getFeatureFlags = async () => {
        if (featureFlagsCache !== undefined) {
            return featureFlagsCache;
        }
        featureFlagsCache = await readFeatureFlags();
        return featureFlagsCache;
    };

    const queryVariant = readVariantFromQuery();
    if (queryVariant) {
        return resolveRequestedVariant(queryVariant, getFeatureFlags, {
            persistAllowed: !resetStorage,
        });
    }

    const storageVariant = resetStorage ? '' : readVariantFromStorage();
    if (storageVariant) {
        return resolveRequestedVariant(storageVariant, getFeatureFlags, {
            persistAllowed: false,
        });
    }

    const featureFlags = await getFeatureFlags();
    if (featureFlags.sony_v3 === true) {
        persistVariant('sony_v3');
        return 'sony_v3';
    }
    if (featureFlags.sony_v2 === true) {
        persistVariant('sony_v2');
        return 'sony_v2';
    }

    return ADMIN_UI_FALLBACK;
}

function setDocumentVariant(variant) {
    document.documentElement.setAttribute('data-admin-ui', variant);
}

function setDocumentReadyState(ready) {
    document.documentElement.setAttribute(
        'data-admin-ready',
        ready ? 'true' : 'false'
    );
}

function toggleStylesheets(variant) {
    const legacyStyles = [
        document.getElementById('adminLegacyBaseStyles'),
        document.getElementById('adminLegacyMinStyles'),
        document.getElementById('adminLegacyStyles'),
    ];
    const v2Styles = document.getElementById('adminV2Styles');
    const v3Styles = document.getElementById('adminV3Styles');

    const legacyEnabled = variant === 'legacy';
    const v2Enabled = variant === 'sony_v2';
    const v3Enabled = variant === 'sony_v3';

    legacyStyles.forEach((node) => {
        if (node instanceof HTMLLinkElement) {
            node.disabled = !legacyEnabled;
        }
    });
    if (v2Styles instanceof HTMLLinkElement) {
        v2Styles.disabled = !v2Enabled;
    }
    if (v3Styles instanceof HTMLLinkElement) {
        v3Styles.disabled = !v3Enabled;
    }
}

async function bootModuleExport(module, preferredExportName = '') {
    if (!module || typeof module !== 'object') return;

    if (preferredExportName) {
        const preferred = module[preferredExportName];
        if (typeof preferred === 'function') {
            await preferred();
            return;
        }
    }

    const exported = module.default;
    if (typeof exported === 'function') {
        await exported();
        return;
    }

    if (exported && typeof exported.then === 'function') {
        await exported;
    }
}

async function loadSonyV2Variant() {
    const module = await import('../admin-v2/index.js');
    await bootModuleExport(module);
}

async function loadSonyV3Variant() {
    const module = await import('../admin-v3/index.js');
    await bootModuleExport(module);
}

async function loadLegacyVariant() {
    const module = await import('./legacy-index.js');
    await bootModuleExport(module, 'bootLegacyAdminAuto');
}

async function loadVariant(variant) {
    if (variant === 'sony_v3') {
        await loadSonyV3Variant();
        return;
    }
    if (variant === 'sony_v2') {
        await loadSonyV2Variant();
        return;
    }
    await loadLegacyVariant();
}

async function resolveFallbackVariant(variant) {
    if (variant === 'sony_v3') {
        const featureFlags = await readFeatureFlags();
        if (featureFlags.sony_v2 !== false) {
            return 'sony_v2';
        }
    }
    return 'legacy';
}

(async function bootstrapAdminVariant() {
    setDocumentReadyState(false);
    const removePrebootShortcutCapture = installPrebootShortcutCapture();
    const resetStorage = readResetStorageFromQuery();
    if (resetStorage) {
        stripQueryParam(ADMIN_UI_RESET_QUERY_KEY);
    }
    try {
        const variant = await resolveVariant({ resetStorage });
        setDocumentVariant(variant);
        toggleStylesheets(variant);

        try {
            await loadVariant(variant);
            setDocumentReadyState(true);
        } catch (error) {
            const fallbackVariant = await resolveFallbackVariant(variant);
            if (fallbackVariant !== variant) {
                setDocumentVariant(fallbackVariant);
                toggleStylesheets(fallbackVariant);
                persistVariant(fallbackVariant);
                await loadVariant(fallbackVariant);
                setDocumentReadyState(true);
                return;
            }
            setDocumentReadyState(false);
            throw error;
        }
    } catch (error) {
        setDocumentReadyState(false);
        throw error;
    } finally {
        removePrebootShortcutCapture();
    }
})();
