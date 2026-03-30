(function initCie10Autocomplete() {
    const FIELD_CONFIGS = {
        clinician_cie10: {
            companionId: 'hcu005_diagnostic_impression',
            multiline: true,
        },
        interconsult_diagnosis_pre_cie10: {
            companionId: 'interconsult_diagnosis_pre_label',
        },
        interconsult_diagnosis_def_cie10: {
            companionId: 'interconsult_diagnosis_def_label',
        },
        lab_order_diagnosis_pre_cie10: {
            companionId: 'lab_order_diagnosis_pre_label',
        },
        lab_order_diagnosis_def_cie10: {
            companionId: 'lab_order_diagnosis_def_label',
        },
        imaging_order_diagnosis_pre_cie10: {
            companionId: 'imaging_order_diagnosis_pre_label',
        },
        imaging_order_diagnosis_def_cie10: {
            companionId: 'imaging_order_diagnosis_def_label',
        },
        consent_packet_diagnosis_cie10: {
            companionId: 'consent_packet_diagnosis_label',
        },
    };

    const stateByField = new WeakMap();
    const fieldsBound = new WeakSet();

    function injectStyles() {
        if (document.getElementById('cie10AutocompleteStyles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'cie10AutocompleteStyles';
        style.textContent = `
            .clinical-history-field[data-cie10-autocomplete-ready="true"] {
                position: relative;
            }

            .cie10-autocomplete-menu {
                position: absolute;
                top: calc(100% + 6px);
                left: 0;
                right: 0;
                z-index: 80;
                display: grid;
                gap: 6px;
                padding: 10px;
                border-radius: 18px;
                border: 1px solid rgba(15, 23, 42, 0.12);
                background: rgba(255, 255, 255, 0.98);
                box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
            }

            .cie10-autocomplete-menu[hidden] {
                display: none;
            }

            .cie10-autocomplete-option {
                display: grid;
                gap: 4px;
                width: 100%;
                padding: 10px 12px;
                border: 0;
                border-radius: 14px;
                background: transparent;
                color: inherit;
                text-align: left;
                cursor: pointer;
            }

            .cie10-autocomplete-option:hover,
            .cie10-autocomplete-option:focus,
            .cie10-autocomplete-option.is-active {
                background: rgba(194, 155, 72, 0.12);
                outline: none;
            }

            .cie10-autocomplete-code {
                font-size: 0.82rem;
                font-weight: 700;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: #7c5b12;
            }

            .cie10-autocomplete-description {
                font-size: 0.95rem;
                line-height: 1.35;
                color: #10233d;
            }

            .cie10-autocomplete-empty {
                padding: 10px 12px;
                border-radius: 14px;
                background: rgba(15, 23, 42, 0.04);
                color: #4a5d76;
                font-size: 0.92rem;
            }

            .cie10-autocomplete-summary {
                margin-top: 6px;
                font-size: 0.83rem;
                color: #4a5d76;
            }
        `;

        document.head.appendChild(style);
    }

    function createState(field, config) {
        const shell = field.closest('.clinical-history-field') || field.parentElement;
        if (!shell) {
            return null;
        }

        shell.dataset.cie10AutocompleteReady = 'true';

        const menu = document.createElement('div');
        menu.className = 'cie10-autocomplete-menu';
        menu.hidden = true;
        menu.setAttribute('role', 'listbox');
        menu.setAttribute('aria-label', 'Sugerencias CIE-10');

        const summary = document.createElement('div');
        summary.className = 'cie10-autocomplete-summary';
        summary.hidden = true;

        shell.appendChild(menu);
        shell.appendChild(summary);

        return {
            field,
            config,
            shell,
            menu,
            summary,
            results: [],
            activeIndex: -1,
            debounceTimer: null,
            blurTimer: null,
            controller: null,
            suppressNextInput: false,
        };
    }

    function dispatchSyntheticInput(field) {
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function currentLineRange(field) {
        const value = String(field.value || '');
        const caret = Number.isFinite(field.selectionStart)
            ? field.selectionStart
            : value.length;
        const start = value.lastIndexOf('\n', Math.max(caret - 1, 0)) + 1;
        const nextNewLine = value.indexOf('\n', caret);
        const end = nextNewLine === -1 ? value.length : nextNewLine;

        return { start, end, value };
    }

    function currentQuery(state) {
        const { field, config } = state;
        if (config.multiline && field.tagName === 'TEXTAREA') {
            const range = currentLineRange(field);
            return range.value.slice(range.start, range.end).trim();
        }

        return String(field.value || '').trim();
    }

    function hideMenu(state) {
        state.menu.hidden = true;
        state.activeIndex = -1;
        state.results = [];
        state.menu.innerHTML = '';
    }

    function renderActiveOption(state) {
        const options = state.menu.querySelectorAll('.cie10-autocomplete-option');
        options.forEach((option, index) => {
            option.classList.toggle('is-active', index === state.activeIndex);
        });
    }

    function renderMenu(state, results) {
        state.results = Array.isArray(results) ? results : [];
        state.activeIndex = state.results.length > 0 ? 0 : -1;

        if (state.results.length === 0) {
            state.menu.innerHTML =
                '<div class="cie10-autocomplete-empty">Sin coincidencias CIE-10.</div>';
            state.menu.hidden = false;
            return;
        }

        state.menu.innerHTML = state.results
            .map((item, index) => {
                const code = String(item.code || '').trim();
                const description = String(item.description || '').trim();

                return `
                    <button
                        type="button"
                        class="cie10-autocomplete-option${index === 0 ? ' is-active' : ''}"
                        data-cie10-code="${code}"
                        data-cie10-description="${description}"
                        role="option"
                        aria-selected="${index === 0 ? 'true' : 'false'}"
                    >
                        <span class="cie10-autocomplete-code">${code}</span>
                        <span class="cie10-autocomplete-description">${description}</span>
                    </button>
                `;
            })
            .join('');

        state.menu.hidden = false;
    }

    function applySelection(state, item) {
        const code = String(item.code || '').trim();
        const description = String(item.description || '').trim();
        if (!code) {
            return;
        }

        if (state.config.multiline && state.field.tagName === 'TEXTAREA') {
            const range = currentLineRange(state.field);
            state.field.value =
                range.value.slice(0, range.start) +
                code +
                range.value.slice(range.end);
            const caret = range.start + code.length;
            if (typeof state.field.setSelectionRange === 'function') {
                state.field.setSelectionRange(caret, caret);
            }
        } else {
            state.field.value = code;
        }

        if (state.config.companionId) {
            const companion = document.getElementById(state.config.companionId);
            if (
                companion &&
                !companion.disabled &&
                String(companion.value || '').trim() === '' &&
                description !== ''
            ) {
                companion.value = description;
                dispatchSyntheticInput(companion);
            }
        }

        state.summary.textContent = description
            ? `${code} - ${description}`
            : code;
        state.summary.hidden = false;
        state.suppressNextInput = true;
        dispatchSyntheticInput(state.field);
        hideMenu(state);
    }

    async function requestSuggestions(state) {
        const query = currentQuery(state);
        if (query.length < 2 || state.field.disabled) {
            hideMenu(state);
            return;
        }

        if (state.controller) {
            state.controller.abort();
        }

        state.controller = new AbortController();

        try {
            const response = await fetch(
                `/api.php?resource=openclaw-cie10-suggest&q=${encodeURIComponent(query)}`,
                {
                    credentials: 'same-origin',
                    signal: state.controller.signal,
                }
            );

            if (!response.ok) {
                hideMenu(state);
                return;
            }

            const payload = await response.json();
            const suggestions = Array.isArray(payload?.suggestions)
                ? payload.suggestions
                : Array.isArray(payload?.data?.suggestions)
                  ? payload.data.suggestions
                  : [];

            if (document.activeElement !== state.field) {
                return;
            }

            renderMenu(state, suggestions);
        } catch (error) {
            if (error && error.name === 'AbortError') {
                return;
            }
            hideMenu(state);
        }
    }

    function scheduleSuggestions(state) {
        if (state.debounceTimer) {
            window.clearTimeout(state.debounceTimer);
        }

        state.debounceTimer = window.setTimeout(() => {
            requestSuggestions(state);
        }, 200);
    }

    function handleKeydown(state, event) {
        if (event.key === 'Escape') {
            hideMenu(state);
            return;
        }

        if (state.menu.hidden) {
            if (event.key === 'ArrowDown' && currentQuery(state).length >= 2) {
                event.preventDefault();
                scheduleSuggestions(state);
            }
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            state.activeIndex = Math.min(
                state.results.length - 1,
                state.activeIndex + 1
            );
            renderActiveOption(state);
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            state.activeIndex = Math.max(0, state.activeIndex - 1);
            renderActiveOption(state);
            return;
        }

        if (event.key === 'Enter' && state.activeIndex >= 0) {
            event.preventDefault();
            applySelection(state, state.results[state.activeIndex]);
        }
    }

    function bindField(field, config) {
        if (!field || fieldsBound.has(field)) {
            return;
        }

        const state = createState(field, config);
        if (!state) {
            return;
        }

        fieldsBound.add(field);
        stateByField.set(field, state);

        field.setAttribute('autocomplete', 'off');
        field.setAttribute('spellcheck', 'false');

        field.addEventListener('focus', () => {
            if (currentQuery(state).length >= 2) {
                scheduleSuggestions(state);
            }
        });

        field.addEventListener('input', () => {
            if (state.suppressNextInput) {
                state.suppressNextInput = false;
                return;
            }

            state.summary.hidden = true;
            scheduleSuggestions(state);
        });

        field.addEventListener('keydown', (event) => {
            handleKeydown(state, event);
        });

        field.addEventListener('blur', () => {
            if (state.blurTimer) {
                window.clearTimeout(state.blurTimer);
            }

            state.blurTimer = window.setTimeout(() => {
                hideMenu(state);
            }, 120);
        });

        state.menu.addEventListener('mousedown', (event) => {
            const option = event.target.closest('.cie10-autocomplete-option');
            if (!option) {
                return;
            }

            event.preventDefault();
            applySelection(state, {
                code: option.dataset.cie10Code || '',
                description: option.dataset.cie10Description || '',
            });
        });

        state.menu.addEventListener('mousemove', (event) => {
            const option = event.target.closest('.cie10-autocomplete-option');
            if (!option) {
                return;
            }

            const options = Array.from(
                state.menu.querySelectorAll('.cie10-autocomplete-option')
            );
            state.activeIndex = options.indexOf(option);
            renderActiveOption(state);
        });
    }

    function bindExistingFields() {
        Object.entries(FIELD_CONFIGS).forEach(([fieldId, config]) => {
            bindField(document.getElementById(fieldId), config);
        });
    }

    function observeDynamicFields() {
        const observer = new MutationObserver(() => {
            bindExistingFields();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    function boot() {
        injectStyles();
        bindExistingFields();
        observeDynamicFields();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
        return;
    }

    boot();
})();
