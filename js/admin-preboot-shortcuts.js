(function installAdminPreboot() {
    const SECTION_BY_SHORTCUT = new Map([
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
    const SHIFTED_ALIASES = Object.freeze({
        '!': 'digit1',
        '@': 'digit2',
        '#': 'digit3',
        $: 'digit4',
        '%': 'digit5',
        '^': 'digit6',
        '"': 'digit2',
        '&': 'digit6',
    });
    const LAST_SECTION_KEY = 'adminLastSection';
    const VARIANT_STORAGE_KEY = 'adminUiVariant';
    const RESET_QUERY_KEY = 'admin_ui_reset';
    const VARIANT_QUERY_KEY = 'admin_ui';
    const VARIANTS = new Set(['legacy', 'sony_v2', 'sony_v3']);

    function normalizeVariant(value) {
        const normalized = String(value || '')
            .trim()
            .toLowerCase();
        return VARIANTS.has(normalized) ? normalized : '';
    }

    function readVariantFromLocation() {
        try {
            const url = new URL(window.location.href);
            if (url.searchParams.has(RESET_QUERY_KEY)) {
                return '';
            }
            const queryVariant = normalizeVariant(
                url.searchParams.get(VARIANT_QUERY_KEY)
            );
            if (queryVariant) return queryVariant;
            return normalizeVariant(localStorage.getItem(VARIANT_STORAGE_KEY));
        } catch (_error) {
            return '';
        }
    }

    function applyPrebootVariantStyles(variant) {
        if (!variant) return;

        const legacyStyles = [
            document.getElementById('adminLegacyBaseStyles'),
            document.getElementById('adminLegacyMinStyles'),
            document.getElementById('adminLegacyStyles'),
        ];
        const v2Styles = document.getElementById('adminV2Styles');
        const v3Styles = document.getElementById('adminV3Styles');
        const enableLegacy = variant === 'legacy';
        const enableV2 = variant === 'sony_v2';
        const enableV3 = variant === 'sony_v3';

        legacyStyles.forEach((node) => {
            if (node instanceof HTMLLinkElement) {
                node.disabled = !enableLegacy;
            }
        });
        if (v2Styles instanceof HTMLLinkElement) {
            v2Styles.disabled = !enableV2;
        }
        if (v3Styles instanceof HTMLLinkElement) {
            v3Styles.disabled = !enableV3;
        }

        document.documentElement.setAttribute('data-admin-ui', variant);
    }

    function isTypingTarget(target) {
        if (!(target instanceof HTMLElement)) return false;
        if (target.isContentEditable) return true;
        return Boolean(
            target.closest('input, textarea, select, [contenteditable="true"]')
        );
    }

    function resolveSection(event) {
        if (
            !event.altKey ||
            !event.shiftKey ||
            event.ctrlKey ||
            event.metaKey
        ) {
            return '';
        }

        const key = String(event.key || '').toLowerCase();
        const code = String(event.code || '').toLowerCase();
        const candidates = [];

        if (code) candidates.push(code);
        if (key) candidates.push(key);
        if (SHIFTED_ALIASES[key]) {
            candidates.push(SHIFTED_ALIASES[key]);
        }

        for (const candidate of candidates) {
            const section = SECTION_BY_SHORTCUT.get(candidate);
            if (section) return section;
        }

        return '';
    }

    function persistSection(section) {
        try {
            localStorage.setItem(LAST_SECTION_KEY, section);
        } catch (_error) {
            // no-op
        }

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

    applyPrebootVariantStyles(readVariantFromLocation());

    window.addEventListener(
        'keydown',
        (event) => {
            if (isTypingTarget(event.target)) return;
            const section = resolveSection(event);
            if (!section) return;
            persistSection(section);
        },
        true
    );
})();
