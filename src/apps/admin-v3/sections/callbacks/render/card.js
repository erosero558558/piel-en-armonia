import { escapeHtml, formatDateTime } from '../../../shared/ui/render.js';
import {
    aiDraftText,
    aiStatusLabel,
    heuristicScore,
    nextActionLabel,
    outcomeLabel,
    phoneLabel,
    priorityBand,
    priorityLabel,
    serviceHint,
    waitingLabel,
    waitingMinutes,
} from '../utils.js';

function actionButtons(item, status) {
    const id = Number(item.id || 0);
    const draft = aiDraftText(item);

    return `
        <div class="callback-actions">
            <button type="button" data-action="mark-contacted" data-callback-id="${id}" data-callback-date="${escapeHtml(item.fecha || '')}" ${status !== 'pending' ? 'disabled' : ''}>${status === 'pending' ? 'Marcar contactado' : 'Contactado'}</button>
            <button type="button" class="ghost" data-action="lead-ai-request" data-callback-id="${id}" data-objective="whatsapp_draft">Generar borrador IA</button>
            <button type="button" class="ghost" data-action="callback-outcome" data-callback-id="${id}" data-outcome="cita_cerrada">Cita cerrada</button>
            <button type="button" class="ghost" data-action="callback-outcome" data-callback-id="${id}" data-outcome="sin_respuesta">Sin respuesta</button>
            <button type="button" class="ghost" data-action="callback-outcome" data-callback-id="${id}" data-outcome="descartado">Descartar</button>
            ${
                draft
                    ? `<button type="button" class="ghost" data-action="callback-copy-ai" data-callback-id="${id}">Copiar borrador</button>`
                    : ''
            }
        </div>
    `;
}

export function callbackCard(
    item,
    { selected = false, position = null, workerMode = '' } = {}
) {
    const status = String(item.status || '')
        .toLowerCase()
        .includes('contact')
        ? 'contacted'
        : 'pending';
    const id = Number(item.id || 0);
    const phone = phoneLabel(item);
    const ageMinutes = waitingMinutes(item);
    const band = priorityBand(item);
    const draft = aiDraftText(item);

    return `
        <article class="callback-card ${escapeHtml(band)} ${status === 'pending' ? 'pendiente' : 'contactado'}${selected ? ' is-selected' : ''}" data-callback-id="${id}" data-callback-status="${status === 'pending' ? 'pendiente' : 'contactado'}">
            <header>
                <div class="callback-card-heading">
                    <div class="callback-card-badges">
                        <span class="callback-status-pill" data-tone="${escapeHtml(band)}">${escapeHtml(priorityLabel(item))}</span>
                        <span class="callback-status-pill subtle">${escapeHtml(aiStatusLabel(item, workerMode))}</span>
                    </div>
                    <h4>${escapeHtml(phone)}</h4>
                    <p class="callback-card-subtitle">${escapeHtml(position === 1 ? 'Siguiente lead sugerido' : 'Lead interno')}${heuristicScore(item) ? ` · Score ${escapeHtml(String(heuristicScore(item)))}` : ''}</p>
                </div>
                <span class="callback-card-wait" data-tone="${escapeHtml(status === 'pending' ? band : 'success')}">${escapeHtml(waitingLabel(ageMinutes))}</span>
            </header>
            <div class="callback-card-grid">
                <p><span>Servicio</span><strong>${escapeHtml(serviceHint(item))}</strong></p>
                <p><span>Fecha</span><strong>${escapeHtml(formatDateTime(item.fecha || item.createdAt || ''))}</strong></p>
                <p><span>Siguiente accion</span><strong>${escapeHtml(nextActionLabel(item))}</strong></p>
                <p><span>Outcome</span><strong>${escapeHtml(outcomeLabel(item))}</strong></p>
            </div>
            <p class="callback-card-note">${escapeHtml(item.preferencia || 'Sin preferencia registrada')}</p>
            ${
                draft
                    ? `<div class="callback-card-draft"><span>Borrador IA</span><p>${escapeHtml(draft)}</p></div>`
                    : ''
            }
            ${actionButtons(item, status)}
        </article>
    `;
}
