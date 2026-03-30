/**
 * CIE-10 Autocomplete Widget
 * Provee autocompletado nativo y fluido con debounce para textareas e inputs
 * cuyos IDs contengan la palabra "cie10".
 */

(function () {
    // ── Configuration ───────────────────────────────────────────────────────────
    const MIN_LENGTH = 3;
    const DEBOUNCE_MS = 200;
    const API_ENDPOINT = '/api.php?resource=openclaw-cie10-suggest&q=';

    // ── State ────────────────────────────────────────────────────────────────────
    let debounceTimer = null;
    let activeTarget = null;
    let dropdownElement = null;

    // ── Inject Styles ────────────────────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('cie10-autocomplete-styles')) return;
        const style = document.createElement('style');
        style.id = 'cie10-autocomplete-styles';
        style.textContent = `
            .cie10-dropdown {
                position: absolute;
                background: var(--bg-primary, #ffffff);
                border: 1px solid var(--border-color, #d1d5db);
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                border-radius: 4px;
                max-height: 200px;
                overflow-y: auto;
                z-index: 9999;
                width: max-content;
                min-width: 300px;
                max-width: 500px;
                display: none;
                padding: 4px 0;
            }
            .cie10-dropdown::-webkit-scrollbar {
                width: 6px;
            }
            .cie10-dropdown::-webkit-scrollbar-thumb {
                background-color: var(--color-gray-300, #cbd5e1);
                border-radius: 4px;
            }
            .cie10-item {
                padding: 8px 12px;
                cursor: pointer;
                font-size: 0.875rem;
                color: var(--text-primary, #111827);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .cie10-item:hover, .cie10-item.active {
                background-color: var(--color-aurora-50, #f0fdf4);
                color: var(--color-aurora-700, #15803d);
            }
            .cie10-item-code {
                font-weight: 600;
                color: var(--color-aurora-600, #166534);
                background: var(--color-aurora-100, #dcfce7);
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 0.75rem;
            }
            .cie10-item-desc {
                flex-grow: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
        `;
        document.head.appendChild(style);
    }

    // ── Core Logic ───────────────────────────────────────────────────────────────

    // Create dropdown element
    function ensureDropdown() {
        if (!dropdownElement) {
            dropdownElement = document.createElement('ul');
            dropdownElement.className = 'cie10-dropdown';
            document.body.appendChild(dropdownElement);

            // Handle selection
            dropdownElement.addEventListener('mousedown', (e) => {
                const item = e.target.closest('.cie10-item');
                if (!item) return;
                
                // Prevent blurring the textarea
                e.preventDefault(); 
                
                insertSelection(item.dataset.code, item.dataset.desc);
            });
        }
        return dropdownElement;
    }

    // Hide dropdown
    function hideDropdown() {
        if (dropdownElement) {
            dropdownElement.style.display = 'none';
        }
        activeTarget = null;
    }

    // Position dropdown under the input/textarea
    function showDropdown(items, targetElement) {
        const dropdown = ensureDropdown();
        dropdown.innerHTML = '';
        
        if (!items || items.length === 0) {
            dropdown.innerHTML = '<div class="cie10-item" style="cursor:default; color:#6b7280;">No se encontraron resultados</div>';
        } else {
            items.forEach((item, idx) => {
                const li = document.createElement('li');
                li.className = 'cie10-item';
                li.dataset.code = item.code || item.cie10;
                li.dataset.desc = item.description || item.label;
                
                li.innerHTML = `
                    <span class="cie10-item-code">${escapeHtml(li.dataset.code)}</span>
                    <span class="cie10-item-desc">${escapeHtml(li.dataset.desc)}</span>
                `;
                dropdown.appendChild(li);
            });
        }

        // Positioning logic
        const rect = targetElement.getBoundingClientRect();
        dropdown.style.left = `${rect.left + window.scrollX}px`;
        dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`;
        dropdown.style.display = 'block';
        dropdown.style.width = `${rect.width}px`;
        activeTarget = targetElement;
    }

    // Helper: Escape HTML
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag])
        );
    }

    // Find current line text based on cursor position
    function getCurrentLineContext(element) {
        const value = element.value;
        const cursor = element.selectionStart;
        
        // Find line start
        let start = value.lastIndexOf('\n', cursor - 1);
        start = start === -1 ? 0 : start + 1;
        
        // Find line end
        let end = value.indexOf('\n', cursor);
        end = end === -1 ? value.length : end;
        
        const lineText = value.substring(start, end).trim();

        // If it looks like it's already a code (e.g. "L20.9 - Dermatitis..."), don't autocomplete
        const alreadyFormatted = /^[A-Z][0-9]+\.?[0-9]*\s*-/.test(lineText);
        
        return {
            text: lineText,
            startPos: start,
            endPos: end,
            skip: alreadyFormatted
        };
    }

    // Fetch data
    async function fetchSuggest(query, targetElement) {
        try {
            const res = await fetch(API_ENDPOINT + encodeURIComponent(query));
            if (!res.ok) throw new Error('Network error');
            const data = await res.json();
            // Expected format: array of { code/cie10: '...', description/label: '...' }
            showDropdown(data.data || data, targetElement);
        } catch (error) {
            console.error('[CIE10-Autocomplete] Error fetching suggestions:', error);
            hideDropdown();
        }
    }

    // Replace current line with selected item
    function insertSelection(code, desc) {
        if (!activeTarget) return;
        const el = activeTarget;
        const lineInfo = getCurrentLineContext(el);
        
        const newValue = `${code} - ${desc}`;
        
        const originalValue = el.value;
        const before = originalValue.substring(0, lineInfo.startPos);
        const after = originalValue.substring(lineInfo.endPos);
        
        el.value = before + newValue + after;
        
        // Move cursor to end of the newly inserted line
        const newCursorPos = before.length + newValue.length;
        el.setSelectionRange(newCursorPos, newCursorPos);
        
        // Trigger generic input/change events so Redux/React/Vanilla models pick up the change
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        
        hideDropdown();
        el.focus();
        
        if (window.openProtocolPanel) {
            window.openProtocolPanel(code);
        }
    }

    // ── Bind Events ──────────────────────────────────────────────────────────────

    // Event delegation on the document body
    document.body.addEventListener('input', (event) => {
        const target = event.target;
        if (!target || typeof target.id !== 'string' || !target.id.toLowerCase().includes('cie10')) return;

        // Clear debounce
        if (debounceTimer) clearTimeout(debounceTimer);

        const ctx = getCurrentLineContext(target);

        if (ctx.skip || ctx.text.length < MIN_LENGTH) {
            hideDropdown();
            return;
        }

        debounceTimer = setTimeout(() => {
            fetchSuggest(ctx.text, target);
        }, DEBOUNCE_MS);
    });

    document.body.addEventListener('focusout', (event) => {
        const target = event.target;
        if (!target || typeof target.id !== 'string' || !target.id.toLowerCase().includes('cie10')) return;
        
        // Use timeout to allow mousedown on dropdown item to fire first
        setTimeout(() => {
            if (activeTarget === target) {
                hideDropdown();
            }
        }, 150);
    });

    // Handle generic clicks outside
    document.addEventListener('click', (event) => {
        if (activeTarget && !activeTarget.contains(event.target) && (!dropdownElement || !dropdownElement.contains(event.target))) {
            hideDropdown();
        }
    });

    // Initialize styles
    injectStyles();
    
    console.log('🩺 [CIE10-Autocomplete] Loaded and monitoring #cie10 boundaries');

})();
