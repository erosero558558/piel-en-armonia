/**
 * CIE10Search
 * Ultra-fast, in-memory ICD-10 search modal cloning cpockets.com aesthetics. 
 */
class CIE10Search {
    constructor(options = {}) {
        this.dataPath = options.dataPath || '/data/cie10-derm.json';
        this.onSelect = options.onSelect || (() => {});
        this.data = [];
        this.results = [];
        this.activeIndex = -1;
        this.MAX_RESULTS = 20;

        this.dialog = null;
        this.input = null;
        this.resultsList = null;
        this.statusText = null;

        this.init();
    }

    async init() {
        this.buildUI();
        this.bindEvents();
        
        try {
            const res = await fetch(this.dataPath);
            this.data = await res.json();
        } catch (err) {
            console.error('CIE10Search: Failed to load dictionary', err);
        }
    }

    buildUI() {
        this.dialog = document.createElement('dialog');
        this.dialog.classList.add('cie10-modal');

        const container = document.createElement('div');
        container.classList.add('cie10-container');

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.placeholder = 'Buscar por código o diagnóstico (ej. L400 o PSORIASIS)';
        this.input.classList.add('cie10-input');
        this.input.setAttribute('autocomplete', 'off');

        this.resultsList = document.createElement('ul');
        this.resultsList.classList.add('cie10-results');

        this.statusText = document.createElement('div');
        this.statusText.classList.add('cie10-status');
        this.statusText.style.display = 'none';

        container.appendChild(this.input);
        container.appendChild(this.resultsList);
        container.appendChild(this.statusText);
        this.dialog.appendChild(container);

        document.body.appendChild(this.dialog);
    }

    bindEvents() {
        // Handle trigger (Ctrl+K or Cmd+K)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.open();
            }
        });

        // Handle Escape in dialog
        this.dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        });

        // Handle backdrop click
        this.dialog.addEventListener('mousedown', (e) => {
            if (e.target === this.dialog) {
                this.close();
            }
        });

        // Handle input searching
        this.input.addEventListener('input', (e) => {
            this.search(e.target.value);
        });

        // Handle keyboard navigation
        this.input.addEventListener('keydown', (e) => {
            if (!this.results.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.activeIndex = Math.min(this.activeIndex + 1, this.results.length - 1);
                this.renderSelection();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.activeIndex = Math.max(this.activeIndex - 1, 0);
                this.renderSelection();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (this.activeIndex >= 0 && this.activeIndex < this.results.length) {
                    this.selectItem(this.results[this.activeIndex]);
                }
            }
        });

        // Handle click on results
        this.resultsList.addEventListener('click', (e) => {
            const li = e.target.closest('li.cie10-item');
            if (li) {
                const code = li.dataset.code;
                const item = this.results.find(r => r.code === code);
                if (item) {
                    this.selectItem(item);
                }
            }
        });
    }

    open() {
        this.dialog.showModal();
        this.input.value = '';
        this.results = [];
        this.activeIndex = -1;
        this.renderResults();
        this.input.focus();
    }

    close() {
        this.dialog.close();
    }

    normalizeSearch(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    }

    search(query) {
        if (!query.trim()) {
            this.results = [];
            this.activeIndex = -1;
            this.renderResults();
            return;
        }

        const normalizedQuery = this.normalizeSearch(query);
        
        // Match partial text or exact code
        const matched = this.data.filter(item => {
            const matchCode = item.code.includes(normalizedQuery);
            const matchLabel = this.normalizeSearch(item.label).includes(normalizedQuery);
            return matchCode || matchLabel;
        });

        this.results = matched.slice(0, this.MAX_RESULTS);
        this.activeIndex = this.results.length > 0 ? 0 : -1;
        
        if (matched.length > this.MAX_RESULTS) {
            this.statusText.textContent = `+${matched.length - this.MAX_RESULTS} resultados adicionales. Refine su búsqueda.`;
            this.statusText.style.display = 'block';
        } else if (matched.length === 0) {
            this.statusText.textContent = 'No hay resultados.';
            this.statusText.style.display = 'block';
        } else {
            this.statusText.style.display = 'none';
        }

        this.renderResults();
    }

    renderResults() {
        this.resultsList.innerHTML = '';
        
        this.results.forEach((item, idx) => {
            const li = document.createElement('li');
            li.classList.add('cie10-item');
            if (idx === this.activeIndex) {
                li.classList.add('active');
            }
            li.dataset.idx = idx;
            li.dataset.code = item.code;
            
            li.innerHTML = `
                <span class="cie10-code">${item.code}</span>
                <span class="cie10-label">${item.label}</span>
            `;
            this.resultsList.appendChild(li);
        });
        
        this.renderSelection();
    }

    renderSelection() {
        const items = this.resultsList.querySelectorAll('li.cie10-item');
        items.forEach((li, idx) => {
            if (idx === this.activeIndex) {
                li.classList.add('active');
                li.scrollIntoView({ block: 'nearest' });
            } else {
                li.classList.remove('active');
            }
        });
    }

    selectItem(item) {
        this.onSelect(item);
        this.close();
    }
}
window.CIE10Search = CIE10Search;
