import { escapeHtml, formatDateTime } from '../../../shared/ui/render.js';
import {
    normalizeStatus,
    phoneLabel,
    waitBand,
    waitingLabel,
    waitingMinutes,
} from '../utils.js';

export function callbackCard(item, { selected = false, position = null } = {}) {
    const status = normalizeStatus(item.status);
    const cardClass =
        status === 'pending'
            ? 'callback-card pendiente'
            : 'callback-card contactado';
    const cardStatus = status === 'pending' ? 'pendiente' : 'contactado';
    const id = Number(item.id || 0);
    const phone = phoneLabel(item);
    const ageMinutes = waitingMinutes(item);
    const band = waitBand(ageMinutes);
    const preference = item.preferencia || 'Sin preferencia';
    const headline =
        status === 'pending'
            ? position === 1
                ? 'Siguiente contacto recomendado'
                : 'Caso pendiente en cola'
            : 'Caso ya resuelto';

    return `
        <article class="${cardClass}${selected ? ' is-selected' : ''}" data-callback-id="${id}" data-callback-status="${cardStatus}">
            <header>
                <div class="callback-card-heading">
                    <span class="callback-status-pill" data-tone="${escapeHtml(status === 'pending' ? band.tone : 'success')}">${escapeHtml(status === 'pending' ? 'Pendiente' : 'Contactado')}</span>
                    <h4>${escapeHtml(phone)}</h4>
                </div>
                <span class="callback-card-wait" data-tone="${escapeHtml(status === 'pending' ? band.tone : 'success')}">${escapeHtml(status === 'pending' ? band.label : 'Cerrado')}</span>
            </header>
            <div class="callback-card-grid">
                <p><span>Preferencia</span><strong>${escapeHtml(preference)}</strong></p>
                <p><span>Fecha</span><strong>${escapeHtml(formatDateTime(item.fecha || item.createdAt || ''))}</strong></p>
                <p><span>Espera</span><strong>${escapeHtml(waitingLabel(ageMinutes))}</strong></p>
                <p><span>Lectura</span><strong>${escapeHtml(headline)}</strong></p>
            </div>
            <p class="callback-card-note">${escapeHtml(status === 'pending' ? band.note : 'Registro ya marcado como contactado.')}</p>
            <div class="callback-actions">
                <button type="button" data-action="mark-contacted" data-callback-id="${id}" data-callback-date="${escapeHtml(item.fecha || '')}" ${status !== 'pending' ? 'disabled' : ''}>${status === 'pending' ? 'Marcar contactado' : 'Contactado'}</button>
            </div>
        </article>
    `;
}
