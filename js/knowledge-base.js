/**
 * knowledge-base.js
 * In-app Contextual KB panel interaction script for Admin/Operator.
 */

document.addEventListener('DOMContentLoaded', () => {
    const kbBtns = document.querySelectorAll('.aurora-kb-trigger');
    const kbSidebar = document.getElementById('aurora-kb-sidebar');
    const kbOverlay = document.getElementById('aurora-kb-overlay');
    const kbCloseBtn = document.getElementById('aurora-kb-close');
    const kbInput = document.getElementById('aurora-kb-search');
    const kbResults = document.getElementById('aurora-kb-results');
    let articlesData = null;

    if (!kbSidebar) return;

    // Toggle logic
    const toggleKB = async () => {
        const isOpen = kbSidebar.classList.contains('is-open');
        if (isOpen) {
            closeKB();
        } else {
            await openKB();
        }
    };

    const closeKB = () => {
        kbSidebar.classList.remove('is-open');
        if (kbOverlay) kbOverlay.classList.remove('is-open');
    };

    const openKB = async () => {
        kbSidebar.classList.add('is-open');
        if (kbOverlay) kbOverlay.classList.add('is-open');
        kbInput.focus();
        
        if (!articlesData) await fetchKB();
        
        renderKB(kbInput.value);
    };

    // Events bindings
    kbBtns.forEach(btn => btn.addEventListener('click', toggleKB));
    if (kbCloseBtn) kbCloseBtn.addEventListener('click', closeKB);
    if (kbOverlay) kbOverlay.addEventListener('click', closeKB);
    if (kbInput) {
        kbInput.addEventListener('input', (e) => {
            renderKB(e.target.value);
        });
    }

    // Context detection
    const getCurrentContext = () => {
        // Admin V3 section context
        const activeSection = document.querySelector('section.admin-section.active');
        if (activeSection) {
            return activeSection.getAttribute('data-admin-raw-section') || 'all';
        }
        // Operations context
        if (document.body.classList.contains('queue-operator-body')) {
            return 'queue';    
        }
        return 'all';
    };

    const fetchKB = async () => {
        try {
            const req = await fetch('/data/kb/articles.json');
            articlesData = await req.json();
        } catch (e) {
            console.error('KB Error fetching articles:', e);
            articlesData = [];
        }
    };

    const renderKB = (query = '') => {
        if (!articlesData) return;
        
        const context = getCurrentContext();
        let list = articlesData;

        // Filtering
        if (query.trim() !== '') {
            const s = query.trim().toLowerCase();
            list = list.filter(a => 
                a.title.toLowerCase().includes(s) || 
                a.content.toLowerCase().includes(s) ||
                (a.tags && a.tags.some(t => t.toLowerCase().includes(s)))
            );
        }

        // Context Scoring
        list.sort((a, b) => {
            const aMatch = (a.contexto || []).includes(context) || (a.contexto || []).includes('all') ? 1 : 0;
            const bMatch = (b.contexto || []).includes(context) || (b.contexto || []).includes('all') ? 1 : 0;
            return bMatch - aMatch; // descending sort
        });

        // Rendering
        if (list.length === 0) {
            kbResults.innerHTML = '<p class="kb-empty">No hay ayuda disponible para esta consulta.</p>';
            return;
        }

        kbResults.innerHTML = list.map(art => `
            <article class="kb-article is-context-match-${(art.contexto || []).includes(context)}">
                <h4>${art.title}</h4>
                <div class="kb-content">${art.content}</div>
                ${art.tags ? `<div class="kb-tags">${art.tags.map(t => `<span>${t}</span>`).join('')}</div>` : ''}
            </article>
        `).join('');
    };
});
