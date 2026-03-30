/**
 * js/admin-search.js
 * (UI3-08) Búsqueda en tiempo real de pacientes
 */

document.addEventListener('DOMContentLoaded', () => {
    const searchContainer = document.querySelector('.admin-search');
    if (!searchContainer) return;

    const input = searchContainer.querySelector('input');
    if (!input) return;

    // Set A11y attributes
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', 'adminSearchResults');
    input.setAttribute('aria-autocomplete', 'list');

    // Create dropdown container
    const dropdown = document.createElement('div');
    dropdown.id = 'adminSearchResults';
    dropdown.className = 'search-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.style.display = 'none';

    // Basic styling for the dropdown
    Object.assign(dropdown.style, {
        position: 'absolute',
        top: 'calc(100% + 4px)',
        left: '0',
        right: '0',
        background: 'var(--admin-bg-surface)',
        border: '1px solid var(--admin-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)',
        zIndex: '100',
        maxHeight: '350px',
        overflowY: 'auto'
    });
    
    // Ensure parent is relative to hold absolute dropdown
    searchContainer.style.position = 'relative';
    searchContainer.appendChild(dropdown);

    let debounceTimer = null;
    let selectedIndex = -1;
    let currentResults = [];

    const closeDropdown = () => {
        dropdown.style.display = 'none';
        input.setAttribute('aria-expanded', 'false');
        selectedIndex = -1;
    };

    const renderResults = (results) => {
        dropdown.innerHTML = '';
        currentResults = results;
        
        if (results.length === 0) {
            const empty = document.createElement('div');
            empty.style.padding = 'var(--space-4)';
            empty.style.color = 'var(--admin-text-muted)';
            empty.style.fontSize = 'var(--text-sm)';
            empty.style.textAlign = 'center';
            empty.innerText = 'No se encontraron pacientes.';
            dropdown.appendChild(empty);
            
            dropdown.style.display = 'block';
            input.setAttribute('aria-expanded', 'true');
            return;
        }

        results.forEach((pt, index) => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.setAttribute('role', 'option');
            item.setAttribute('data-index', index);
            
            // Standardizing styling
            Object.assign(item.style, {
                padding: 'var(--space-3) var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                cursor: 'pointer',
                borderBottom: '1px solid var(--admin-border)',
                transition: 'background var(--transition-fast)'
            });
            
            item.innerHTML = `
                <div class="avatar avatar-sm">${pt.avatarUrl ? '' : pt.name.substring(0, 2).toUpperCase()}</div>
                <div style="flex: 1; display:flex; flex-direction:column;">
                    <strong style="font-size: var(--text-sm); color: var(--admin-text-primary);">${pt.name}</strong>
                    <span style="font-size: var(--text-xs); color: var(--admin-text-muted);">C.I / RUC: ${pt.document}</span>
                </div>
                <div style="font-size: var(--text-xs); color: var(--admin-text-muted); text-align:right;">
                    Última Visita<br>${pt.lastVisit || 'N/A'}
                </div>
            `;
            
            item.addEventListener('mouseenter', () => {
                highlightIndex(index);
            });
            
            item.addEventListener('click', () => {
                selectResult(index);
            });

            dropdown.appendChild(item);
        });

        // Remove last border
        if(dropdown.lastChild) {
            dropdown.lastChild.style.borderBottom = 'none';
        }

        dropdown.style.display = 'block';
        input.setAttribute('aria-expanded', 'true');
    };

    const highlightIndex = (index) => {
        const items = dropdown.querySelectorAll('.search-result-item');
        items.forEach((it, i) => {
            if (i === index) {
                it.style.background = 'var(--admin-accent-glow)';
                selectedIndex = i;
            } else {
                it.style.background = 'transparent';
            }
        });
    };

    const selectResult = (index) => {
        const pt = currentResults[index];
        if (!pt) return;
        
        // Emulate filling form or dispatching
        input.value = pt.name;
        
        // Dispatch global event for other components to listen
        window.dispatchEvent(new CustomEvent('patient-selected', { detail: pt }));
        
        closeDropdown();
    };

    const fetchPatients = async (query) => {
        try {
            const resp = await fetch(`/api.php?resource=patient-search&q=${encodeURIComponent(query)}`);
            const data = await resp.json();
            if (data.ok) {
                renderResults(data.data || []);
            }
        } catch (e) {
            console.error('Error in patient search', e);
            renderResults([]);
        }
    };

    input.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        clearTimeout(debounceTimer);
        
        if (val.length < 2) {
            closeDropdown();
            return;
        }

        debounceTimer = setTimeout(() => {
            fetchPatients(val);
        }, 250);
    });

    input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.search-result-item');
        if (e.key === 'Escape') {
            closeDropdown();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (selectedIndex < items.length - 1) {
                highlightIndex(selectedIndex + 1);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selectedIndex > 0) {
                highlightIndex(selectedIndex - 1);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0) {
                selectResult(selectedIndex);
            } else if (currentResults.length > 0) {
                selectResult(0);
            }
        }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!searchContainer.contains(e.target)) {
            closeDropdown();
        }
    });

    // Handle cross-site escape
    input.addEventListener('focus', () => {
        if (input.value.trim().length >= 2 && currentResults.length > 0) {
            dropdown.style.display = 'block';
            input.setAttribute('aria-expanded', 'true');
        }
    });
});
