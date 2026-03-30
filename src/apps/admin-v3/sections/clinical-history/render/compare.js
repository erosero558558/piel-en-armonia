import { apiRequest } from '../../../shared/core/api-client.js';
import { getState } from '../../../shared/core/store.js';
import { createToast, escapeHtml, setHtml } from '../../../shared/ui/render.js';

let galleryData = null;
let selectedIds = [];

function currentClinicalCaseId(state = getState()) {
    return String(
        state?.clinicalHistory?.current?.session?.caseId ||
            state?.clinicalHistory?.draftForm?.caseId || ''
    ).trim();
}

async function loadGallery(caseId) {
    if (!caseId) return;
    try {
        const response = await apiRequest(`clinical-history-gallery?case_id=${encodeURIComponent(caseId)}`);
        if (response.ok) {
            galleryData = response.data || [];
            selectedIds = [];
            renderCompareWorkbench();
        }
    } catch (e) {
        createToast('Error cargando historial fotográfico', 'error');
    }
}

export function renderClinicalCompareFlow() {
    const state = getState();
    const activeWorkspace = state?.clinicalHistory?.activeWorkspace || 'review';
    if (activeWorkspace !== 'compare') {
        return;
    }
    
    const caseId = currentClinicalCaseId(state);
    if (!galleryData && caseId) {
        setHtml('#clinicalCompareWorkbench', `
            <article class="clinical-history-empty-card">
                <strong>Cargando galería...</strong>
            </article>
        `);
        loadGallery(caseId);
        return;
    }
    
    renderCompareWorkbench();
}

function renderCompareWorkbench() {
    const state = getState();
    const caseId = currentClinicalCaseId(state);
    
    if (!caseId) {
        setHtml('#clinicalCompareWorkbench', `
            <article class="clinical-history-empty-card">
                <strong>Sin selección</strong>
                <small>Selecciona un caso clínico para visualizar la evolución fotográfica.</small>
            </article>
        `);
        return;
    }

    if (!galleryData) {
        return;
    }

    if (galleryData.length === 0) {
        setHtml('#clinicalCompareWorkbench', `
            <article class="clinical-history-empty-card">
                <strong>Sin historial fotográfico</strong>
                <small>No hay fotos en el historial clínico de este paciente.</small>
            </article>
        `);
        return;
    }

    const galleryHtml = galleryData.map(item => {
        const isSelected = selectedIds.includes(item.id);
        const indexInSelection = selectedIds.indexOf(item.id);
        const badgeLabel = indexInSelection === 0 ? 'Before' : (indexInSelection === 1 ? 'After' : '');
        
        return `
            <div class="clinical-history-gallery-item ${isSelected ? 'is-selected' : ''}" 
                 data-compare-id="${escapeHtml(item.id)}"
                 data-selection-label="${escapeHtml(badgeLabel)}">
                <img src="${escapeHtml('/api.php?resource=media-flow-private-asset&path=' + encodeURIComponent(item.privatePath))}" 
                     class="clinical-history-gallery-img" 
                     loading="lazy" />
            </div>
        `;
    }).join('');

    let sliderHtml = '';
    if (selectedIds.length === 2) {
        const beforeItem = galleryData.find(i => i.id === selectedIds[0]);
        const afterItem = galleryData.find(i => i.id === selectedIds[1]);
        
        const beforeSrc = '/api.php?resource=media-flow-private-asset&path=' + encodeURIComponent(beforeItem.privatePath);
        const afterSrc = '/api.php?resource=media-flow-private-asset&path=' + encodeURIComponent(afterItem.privatePath);
        
        sliderHtml = `
            <div class="clinical-compare-container">
                <header class="section-header">
                    <div>
                        <h3>Vista de Comparación</h3>
                        <p>Desliza para comparar el estado anterior y posterior (Before / After).</p>
                    </div>
                </header>
                <div class="clinical-compare-slider" id="clinicalCompareSlider">
                    <img src="${escapeHtml(afterSrc)}" class="clinical-compare-img clinical-compare-after" />
                    <img src="${escapeHtml(beforeSrc)}" class="clinical-compare-img clinical-compare-before" id="clinicalCompareBeforeImg" />
                    <input type="range" class="clinical-compare-range" id="clinicalCompareRange" min="0" max="100" value="50" />
                </div>
            </div>
        `;
    }

    const html = `
        <article class="sony-panel">
            <header class="section-header">
                <div>
                    <h3>Galería Histórica</h3>
                    <p>Selecciona precisamente 2 fotos para compararlas en el slider inferior.</p>
                </div>
                <button type="button" id="clinicalCompareClearBtn">Limpiar selección</button>
            </header>
            <div class="clinical-history-gallery-grid">
                ${galleryHtml}
            </div>
        </article>
        ${sliderHtml}
    `;

    setHtml('#clinicalCompareWorkbench', html);
    bindCompareEvents();
}

function bindCompareEvents() {
    const workbench = document.getElementById('clinicalCompareWorkbench');
    if (!workbench) return;
    
    const clearBtn = document.getElementById('clinicalCompareClearBtn');
    if (clearBtn) {
        clearBtn.onclick = () => {
            selectedIds = [];
            renderCompareWorkbench();
        };
    }
    
    const items = workbench.querySelectorAll('.clinical-history-gallery-item');
    items.forEach(item => {
        item.onclick = () => {
            const id = item.dataset.compareId;
            if (selectedIds.includes(id)) {
                selectedIds = selectedIds.filter(sel => sel !== id);
                renderCompareWorkbench();
            } else {
                if (selectedIds.length < 2) {
                    selectedIds.push(id);
                    renderCompareWorkbench();
                } else {
                    createToast('Solo puedes comparar 2 fotos simultáneamente. Limpia la selección.', 'warning');
                }
            }
        };
    });
    
    const range = document.getElementById('clinicalCompareRange');
    const beforeImg = document.getElementById('clinicalCompareBeforeImg');
    if (range && beforeImg) {
        range.oninput = (e) => {
            const val = e.target.value;
            const rightPadding = 100 - val;
            beforeImg.style.clipPath = `inset(0 ${rightPadding}% 0 0)`;
        };
    }
}

export function clearCompareGalleryCache() {
    galleryData = null;
    selectedIds = [];
}
