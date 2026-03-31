import { escapeHtml, formatDateTime } from '../../../shared/ui/render.js';
import {
    aiDraftText,
    aiStatusLabel,
    heuristicScore,
    lastContactAt,
    nextActionLabel,
    outcomeLabel,
    phoneLabel,
    priorityBand,
    priorityLabel,
    scoreSummary,
    serviceHint,
    waitingLabel,
    waitingMinutes,
} from '../utils.js';
import {
    buildCallbackWhatsappUrl,
    callbackWhatsappComposerHint,
    getCallbackWhatsappDraft,
    getCallbackWhatsappTemplate,
    getCallbackWhatsappTemplateKey,
    listCallbackWhatsappTemplates,
} from '../whatsapp-templates.js';

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

function whatsappComposer(item) {
    const id = Number(item.id || 0);
    const templateKey = getCallbackWhatsappTemplateKey(item);
    const draft = getCallbackWhatsappDraft(item);
    const template = getCallbackWhatsappTemplate(templateKey);
    const sendUrl = buildCallbackWhatsappUrl(item, draft);
    const helperText = callbackWhatsappComposerHint(item);

    return `
        <div class="callback-message-composer">
            <div class="callback-message-head">
                <span>Plantillas WhatsApp</span>
                <small>${escapeHtml(template?.description || helperText)}</small>
            </div>
            <label class="callback-message-field">
                <span>Plantilla</span>
                <select data-callback-template-select data-callback-id="${id}">
                    <option value="">Elegir plantilla</option>
                    ${listCallbackWhatsappTemplates()
                        .map(
                            (option) =>
                                `<option value="${escapeHtml(option.key)}"${option.key === templateKey ? ' selected' : ''}>${escapeHtml(option.label)}</option>`
                        )
                        .join('')}
                </select>
            </label>
            <label class="callback-message-field">
                <span>Mensaje listo</span>
                <textarea data-callback-template-draft data-callback-id="${id}" rows="4" placeholder="Selecciona una plantilla para comenzar.">${escapeHtml(draft)}</textarea>
            </label>
            <p class="callback-message-footnote">${escapeHtml(helperText)}</p>
            <div class="callback-actions callback-actions--composer">
                <button type="button" class="ghost" data-action="callback-copy-template" data-callback-id="${id}" ${draft ? '' : 'disabled'}>Copiar mensaje</button>
                <button type="button" data-action="callback-send-whatsapp-template" data-callback-id="${id}" ${sendUrl ? '' : 'disabled'}>Enviar por WhatsApp</button>
            </div>
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
    const score = heuristicScore(item);
    const scoreMeta = scoreSummary(item);
    const contactedAt = lastContactAt(item);

    return `
        <article class="callback-card ${escapeHtml(band)} ${status === 'pending' ? 'pendiente' : 'contactado'}${selected ? ' is-selected' : ''}" data-callback-id="${id}" data-callback-status="${status === 'pending' ? 'pendiente' : 'contactado'}">
            <header>
                <div class="callback-card-heading">
                    <div class="callback-card-badges">
                        <span class="callback-status-pill" data-tone="${escapeHtml(band)}">${escapeHtml(priorityLabel(item))}</span>
                        <span class="callback-status-pill subtle">${escapeHtml(aiStatusLabel(item, workerMode))}</span>
                    </div>
                    <h4>${escapeHtml(phone)}${score ? ` · Score ${escapeHtml(String(score))}` : ''}</h4>
                    <p class="callback-card-subtitle">${escapeHtml(status === 'pending' ? (position === 1 ? 'Siguiente lead por score' : 'Lead pendiente') : 'Lead atendido')}${scoreMeta ? ` · ${escapeHtml(scoreMeta)}` : ''}</p>
                </div>
                <span class="callback-card-wait" data-tone="${escapeHtml(status === 'pending' ? band : 'success')}">${escapeHtml(waitingLabel(ageMinutes))}</span>
            </header>
            <div class="callback-card-grid">
                <p><span>Servicio</span><strong>${escapeHtml(serviceHint(item))}</strong></p>
                <p><span>Ingreso</span><strong>${escapeHtml(formatDateTime(item.fecha || item.createdAt || ''))}</strong></p>
                <p><span>Ultimo contacto</span><strong>${escapeHtml(contactedAt ? formatDateTime(contactedAt) : 'Sin contacto')}</strong></p>
                <p><span>Siguiente accion</span><strong>${escapeHtml(nextActionLabel(item))}</strong></p>
                <p><span>Outcome</span><strong>${escapeHtml(outcomeLabel(item))}</strong></p>
            </div>
            <p class="callback-card-note">${escapeHtml(item.preferencia || 'Sin preferencia registrada')}</p>
            ${
                draft
                    ? `<div class="callback-card-draft"><span>Borrador IA</span><p>${escapeHtml(draft)}</p></div>`
                    : ''
            }
            ${whatsappComposer(item)}
            ${actionButtons(item, status)}
        </article>
    `;
}
