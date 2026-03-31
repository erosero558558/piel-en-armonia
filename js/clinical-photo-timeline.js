/**
 * js/clinical-photo-timeline.js — COMP-B1
 * Aurora Derm — Historia clínica fotográfica dermatológica
 *
 * Panel de timeline de fotos por paciente/caso para el admin clínico.
 * Diferenciador competitivo: ningún competidor en Ecuador tiene esto nativo.
 *
 * Características:
 *  - Timeline ordenado cronológicamente por consulta
 *  - Comparador lado-a-lado (antes/después) con slider
 *  - Tags de región anatómica por foto
 *  - Upload desde el admin (médico puede agregar fotos durante consulta)
 *  - Lightbox para revisión de detalle
 *
 * Uso:
 *   ClinicalPhotoTimeline.mount('clinicalPhotoTimelineHost', { caseId: 'CASE_ID' });
 */

(function (window, document) {
    'use strict';

    const ANATOMIC_REGIONS = [
        { value: 'cara',        label: 'Cara' },
        { value: 'cuello',      label: 'Cuello' },
        { value: 'torax',       label: 'Tórax' },
        { value: 'espalda',     label: 'Espalda' },
        { value: 'abdomen',     label: 'Abdomen' },
        { value: 'brazo_der',   label: 'Brazo der.' },
        { value: 'brazo_izq',   label: 'Brazo izq.' },
        { value: 'antebrazo',   label: 'Antebrazo' },
        { value: 'mano',        label: 'Mano' },
        { value: 'pierna_der',  label: 'Pierna der.' },
        { value: 'pierna_izq',  label: 'Pierna izq.' },
        { value: 'pie',         label: 'Pie' },
        { value: 'cuero_cabelludo', label: 'Cuero cabelludo' },
        { value: 'unas',        label: 'Uñas' },
        { value: 'mucosa',      label: 'Mucosa' },
        { value: 'otro',        label: 'Otro' },
    ];

    // ── Helpers ───────────────────────────────────────────────────────────────

    function esc(v) {
        return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function formatDate(isoStr) {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        return d.toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function regionLabel(value) {
        return ANATOMIC_REGIONS.find(r => r.value === value)?.label ?? value ?? 'Sin región';
    }

    // ── API calls ─────────────────────────────────────────────────────────────

    async function fetchPhotos(caseId) {
        const res = await fetch(`/api.php?resource=clinical-photos&caseId=${encodeURIComponent(caseId)}`, {
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data = await res.json();
        return Array.isArray(data.photos) ? data.photos : [];
    }

    async function uploadPhoto(caseId, file, region, notes) {
        const form = new FormData();
        form.append('caseId',  caseId);
        form.append('region',  region);
        form.append('notes',   notes);
        form.append('photo',   file);
        const res = await fetch('/api.php?resource=clinical-photo-upload', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            body: form,
        });
        if (!res.ok) throw new Error(`Upload error ${res.status}`);
        return res.json();
    }

    // ── Render: timeline card ─────────────────────────────────────────────────

    function renderPhotoCard(photo, index) {
        const src    = esc(photo.thumbnailUrl || photo.url || '');
        const full   = esc(photo.url || '');
        const date   = formatDate(photo.capturedAt || photo.createdAt);
        const region = regionLabel(photo.region);
        const notes  = esc(photo.notes || '');
        const visit  = photo.visitLabel ? `<span class="cpt-visit-chip">${esc(photo.visitLabel)}</span>` : '';

        return `
        <article class="cpt-card" data-cpt-index="${index}" data-cpt-full="${full}">
            <div class="cpt-card-thumb-wrap">
                <img class="cpt-card-thumb" src="${src}" alt="${region} — ${date}" loading="lazy">
                <button class="cpt-card-zoom-btn" data-cpt-zoom="${full}" title="Ver en detalle" aria-label="Ampliar foto">
                    ⤢
                </button>
                <label class="cpt-card-compare-lbl">
                    <input type="checkbox" class="cpt-compare-check" data-cpt-index="${index}" data-cpt-url="${full}">
                    <span>Comparar</span>
                </label>
            </div>
            <div class="cpt-card-meta">
                <span class="cpt-region-tag">${esc(region)}</span>
                ${visit}
                <time class="cpt-date" datetime="${esc(photo.capturedAt || '')}"> ${date}</time>
                ${notes ? `<p class="cpt-notes">${notes}</p>` : ''}
            </div>
        </article>`;
    }

    // ── Render: comparison panel ──────────────────────────────────────────────

    function renderComparePanel(urlA, urlB, labelA, labelB) {
        return `
        <div class="cpt-compare-panel">
            <div class="cpt-compare-header">
                <h4>Comparador lado a lado</h4>
                <button class="cpt-compare-close-btn" id="cptCompareCloseBtn">✕ Cerrar</button>
            </div>
            <div class="cpt-compare-grid">
                <figure class="cpt-compare-figure">
                    <img src="${esc(urlA)}" alt="Foto A" class="cpt-compare-img">
                    <figcaption>${esc(labelA)}</figcaption>
                </figure>
                <figure class="cpt-compare-figure">
                    <img src="${esc(urlB)}" alt="Foto B" class="cpt-compare-img">
                    <figcaption>${esc(labelB)}</figcaption>
                </figure>
            </div>
            <p class="cpt-compare-tip">
                💡 Selecciona 2 fotos del timeline para comparar la evolución de la lesión entre visitas.
            </p>
        </div>`;
    }

    // ── Render: upload form ───────────────────────────────────────────────────

    function renderUploadForm() {
        const options = ANATOMIC_REGIONS.map(r =>
            `<option value="${esc(r.value)}">${esc(r.label)}</option>`
        ).join('');
        return `
        <details class="cpt-upload-details" id="cptUploadDetails">
            <summary class="cpt-upload-summary">
                📷 Agregar foto clínica
            </summary>
            <form class="cpt-upload-form" id="cptUploadForm" novalidate>
                <label class="cpt-upload-label">
                    <span>Región anatómica</span>
                    <select name="region" id="cptRegionSelect" required>
                        <option value="">— Seleccionar —</option>
                        ${options}
                    </select>
                </label>
                <label class="cpt-upload-label">
                    <span>Notas clínicas (opcional)</span>
                    <input type="text" name="notes" id="cptNotesInput"
                           placeholder="Ej.: lesión 2x2cm, borde irregular, 3 sem evolución">
                </label>
                <label class="cpt-upload-label cpt-file-label">
                    <span>Foto (JPG/PNG, máx. 10 MB)</span>
                    <input type="file" name="photo" id="cptFileInput"
                           accept="image/jpeg,image/png,image/webp" required>
                </label>
                <div class="cpt-upload-preview-wrap" id="cptUploadPreviewWrap" hidden>
                    <img id="cptUploadPreview" class="cpt-upload-preview" alt="Vista previa">
                </div>
                <div class="cpt-upload-actions">
                    <button type="submit" id="cptUploadSubmitBtn" class="btn-primary">
                        Guardar foto
                    </button>
                    <span class="cpt-upload-status" id="cptUploadStatus" aria-live="polite"></span>
                </div>
            </form>
        </details>`;
    }

    // ── Render: full panel ────────────────────────────────────────────────────

    function renderPanel(photos, caseId) {
        const byVisit = groupByVisit(photos);
        const groups = Object.entries(byVisit).map(([visitKey, visitPhotos]) => {
            const [date] = visitKey.split('|');
            const cards = visitPhotos.map((p, i) => renderPhotoCard(p, photos.indexOf(p))).join('');
            return `
            <section class="cpt-visit-group">
                <h4 class="cpt-visit-label">
                    <span class="cpt-visit-icon">📅</span>
                    Consulta — ${date}
                    <span class="cpt-visit-count">${visitPhotos.length} foto${visitPhotos.length !== 1 ? 's' : ''}</span>
                </h4>
                <div class="cpt-card-grid">${cards}</div>
            </section>`;
        });

        const emptyState = photos.length === 0
            ? `<div class="cpt-empty-state">
                <span class="cpt-empty-icon">🩻</span>
                <p>Sin fotos clínicas para este caso.</p>
                <p class="cpt-empty-hint">Agrega fotos durante la consulta para documentar la evolución.</p>
               </div>`
            : '';

        return `
        <div class="cpt-panel" id="cptPanel">
            <header class="cpt-header">
                <div>
                    <h3 class="cpt-title">📸 Fotos clínicas</h3>
                    <p class="cpt-subtitle">
                        ${photos.length} foto${photos.length !== 1 ? 's' : ''} · ${Object.keys(byVisit).length} visita${Object.keys(byVisit).length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div class="cpt-header-actions">
                    <button class="cpt-compare-btn-trigger" id="cptCompareTrigger"
                            disabled title="Selecciona 2 fotos con el checkbox">
                        ⇆ Comparar 0/2
                    </button>
                </div>
            </header>

            <div id="cptCompareZone"></div>

            ${renderUploadForm()}

            <div class="cpt-timeline" id="cptTimeline" aria-label="Timeline fotográfico clínico">
                ${emptyState}
                ${groups.join('')}
            </div>
        </div>

        <!-- Lightbox -->
        <div class="cpt-lightbox" id="cptLightbox" hidden role="dialog" aria-modal="true" aria-label="Foto en detalle">
            <div class="cpt-lightbox-backdrop" id="cptLightboxBackdrop"></div>
            <div class="cpt-lightbox-content">
                <button class="cpt-lightbox-close" id="cptLightboxClose" aria-label="Cerrar">✕</button>
                <img class="cpt-lightbox-img" id="cptLightboxImg" alt="Foto clínica">
            </div>
        </div>`;
    }

    function groupByVisit(photos) {
        const groups = {};
        for (const photo of photos) {
            const dateStr = formatDate(photo.capturedAt || photo.createdAt);
            const key = `${dateStr}|${photo.visitId || 'no-visit'}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(photo);
        }
        return groups;
    }

    // ── Event wiring ──────────────────────────────────────────────────────────

    function wireEvents(host, caseId, photos, onRefresh) {
        const panel = host.querySelector('#cptPanel');
        if (!panel) return;

        // Lightbox
        const lightbox   = host.querySelector('#cptLightbox');
        const lightboxImg = host.querySelector('#cptLightboxImg');
        const lightboxClose = host.querySelector('#cptLightboxClose');
        const lightboxBackdrop = host.querySelector('#cptLightboxBackdrop');

        panel.addEventListener('click', (e) => {
            const zoomBtn = e.target.closest('[data-cpt-zoom]');
            if (zoomBtn) {
                const url = zoomBtn.dataset.cptZoom;
                if (lightboxImg && lightbox) {
                    lightboxImg.src = url;
                    lightbox.hidden = false;
                    lightboxClose?.focus();
                }
            }
        });
        [lightboxClose, lightboxBackdrop].forEach(el => {
            el?.addEventListener('click', () => { if (lightbox) lightbox.hidden = true; });
        });
        lightbox?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') lightbox.hidden = true;
        });

        // Comparison
        const compareZone    = host.querySelector('#cptCompareZone');
        const compareTrigger = host.querySelector('#cptCompareTrigger');
        let selectedForCompare = [];

        panel.addEventListener('change', (e) => {
            const cb = e.target.closest('.cpt-compare-check');
            if (!cb) return;
            const url = cb.dataset.cptUrl;
            const idx = parseInt(cb.dataset.cptIndex, 10);
            const photo = photos[idx];

            if (cb.checked) {
                if (selectedForCompare.length < 2) {
                    selectedForCompare.push({ url, photo });
                } else {
                    cb.checked = false;
                    return;
                }
            } else {
                selectedForCompare = selectedForCompare.filter(s => s.url !== url);
            }

            const count = selectedForCompare.length;
            if (compareTrigger) {
                compareTrigger.textContent = `⇆ Comparar ${count}/2`;
                compareTrigger.disabled = count < 2;
            }

            if (count === 2 && compareZone) {
                const [a, b] = selectedForCompare;
                const labelA = `${regionLabel(a.photo?.region)} — ${formatDate(a.photo?.capturedAt)}`;
                const labelB = `${regionLabel(b.photo?.region)} — ${formatDate(b.photo?.capturedAt)}`;
                compareZone.innerHTML = renderComparePanel(a.url, b.url, labelA, labelB);
                compareZone.querySelector('#cptCompareCloseBtn')?.addEventListener('click', () => {
                    compareZone.innerHTML = '';
                    selectedForCompare = [];
                    host.querySelectorAll('.cpt-compare-check').forEach(c => { c.checked = false; });
                    if (compareTrigger) { compareTrigger.textContent = '⇆ Comparar 0/2'; compareTrigger.disabled = true; }
                });
                compareZone.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });

        // Upload form
        const form       = host.querySelector('#cptUploadForm');
        const fileInput  = host.querySelector('#cptFileInput');
        const preview    = host.querySelector('#cptUploadPreview');
        const previewWrap = host.querySelector('#cptUploadPreviewWrap');
        const status     = host.querySelector('#cptUploadStatus');
        const submitBtn  = host.querySelector('#cptUploadSubmitBtn');

        fileInput?.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            if (file && preview && previewWrap) {
                const reader = new FileReader();
                reader.onload = e => {
                    preview.src = e.target?.result ?? '';
                    previewWrap.hidden = false;
                };
                reader.readAsDataURL(file);
            }
        });

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const file   = fileInput?.files?.[0];
            const region = host.querySelector('#cptRegionSelect')?.value ?? '';
            const notes  = host.querySelector('#cptNotesInput')?.value ?? '';

            if (!file || !region) {
                if (status) status.textContent = 'Selecciona una foto y la región anatómica.';
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                if (status) status.textContent = 'La foto supera el límite de 10 MB.';
                return;
            }

            if (submitBtn) submitBtn.disabled = true;
            if (status) status.textContent = 'Subiendo...';

            try {
                await uploadPhoto(caseId, file, region, notes);
                if (status) status.textContent = '✅ Foto guardada';
                form.reset();
                if (previewWrap) previewWrap.hidden = true;
                if (typeof onRefresh === 'function') onRefresh();
            } catch (err) {
                if (status) status.textContent = `❌ Error: ${err.message}`;
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // ── Public API ────────────────────────────────────────────────────────────

    const ClinicalPhotoTimeline = {
        /**
         * Mount the photo timeline panel into a DOM element.
         * @param {string|HTMLElement} hostIdOrEl — container element or its ID
         * @param {{ caseId: string }} opts
         */
        async mount(hostIdOrEl, opts = {}) {
            const host = typeof hostIdOrEl === 'string'
                ? document.getElementById(hostIdOrEl)
                : hostIdOrEl;
            if (!host) { console.warn('[ClinicalPhotoTimeline] Host not found:', hostIdOrEl); return; }

            const caseId = opts.caseId || '';
            if (!caseId) { host.innerHTML = '<p class="cpt-error">Error: caseId requerido.</p>'; return; }

            host.innerHTML = '<div class="cpt-loading" aria-busy="true">Cargando fotos clínicas...</div>';

            let photos = [];
            try {
                photos = await fetchPhotos(caseId);
            } catch (err) {
                host.innerHTML = `<p class="cpt-error">No se pudieron cargar las fotos: ${esc(err.message)}</p>`;
                return;
            }

            host.innerHTML = renderPanel(photos, caseId);

            const doRefresh = () => this.mount(host, opts);
            wireEvents(host, caseId, photos, doRefresh);
        },

        /** Reload the panel programmatically */
        refresh(hostIdOrEl, opts) {
            return this.mount(hostIdOrEl, opts);
        },
    };

    window.ClinicalPhotoTimeline = ClinicalPhotoTimeline;

})(window, document);
