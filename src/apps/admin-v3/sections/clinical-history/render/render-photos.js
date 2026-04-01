import { getState, updateState } from '../../../shared/core/store.js';
import { setHtml, setText, escapeHtml, createToast, formatDateTime } from '../../../shared/ui/render.js';
import * as helpers from './index.js';

export function hasClinicalMediaFlowCases(state = getState()) {
    return helpers.normalizeList(state?.data?.mediaFlowMeta?.queue).length > 0;
}

export function buildClinicalHistoryPhotosSection(review, draft, disabled) {
    const assets = Array.isArray(review.caseMediaAssets) ? review.caseMediaAssets : [];
    
    const photosList = assets.map(asset => {
        const url = escapeHtml(asset.url || '');
        return `
            <div class="clinical-photo-card" style="border: 1px solid var(--borderBase); padding: 10px; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: start; gap: 15px; background: var(--bgLayer)">
                <img class="clinical-photo" data-full-src="${url}" src="${url}" alt="Foto Clínica" style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px; cursor: pointer;" />
                <div style="flex: 1;">
                    <strong style="display:block; color: var(--textStrong);">${escapeHtml(asset.bodyZone || 'Sin zona especificada')}</strong>
                    <span style="font-size: 13px; color: var(--textBase);">${escapeHtml(asset.createdAt || '')}</span>
                </div>
            </div>
        `;
    }).join('');

    return `
        <section class="clinical-history-section content-card" style="grid-column: 1 / -1;">
            <div class="clinical-history-section-header" style="display:flex; justify-content:space-between; align-items:center;">
                <h3>Fotografías Clínicas</h3>
                <div style="display:flex; gap:10px; align-items:center;">
                    <select id="clinical_photo_zone" class="clinical-history-picker" ${disabled ? 'disabled' : ''}>
                        <option value="">Zona corporal...</option>
                        <option value="Cara">Cara</option>
                        <option value="Cuello">Cuello</option>
                        <option value="Torax">Tórax</option>
                        <option value="Espalda">Espalda</option>
                        <option value="Brazo Izquierdo">Brazo Izq.</option>
                        <option value="Brazo Derecho">Brazo Der.</option>
                        <option value="Pierna Izquierda">Pierna Izq.</option>
                        <option value="Pierna Derecha">Pierna Der.</option>
                        <option value="Otra">Otra</option>
                    </select>
                    <label class="clinical-history-action-btn ${disabled ? 'disabled' : ''}" style="cursor: pointer; padding: 6px 12px; background: var(--brandBase); color: #fff; border-radius: 4px; font-weight: 600; font-size: 13px; ${disabled ? 'opacity:0.5; pointer-events:none;' : ''}">
                        Tomar Foto
                        <input type="file" id="clinical_photo_upload_input" accept="image/*" capture="environment" style="display:none;" />
                    </label>
                </div>
            </div>
            <div class="clinical-history-section-body">
                ${assets.length === 0 ? '<p class="clinical-history-empty-text">No hay fotografías registradas.</p>' : `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:15px;">${photosList}</div>`}
            </div>
        </section>
    `;
}

