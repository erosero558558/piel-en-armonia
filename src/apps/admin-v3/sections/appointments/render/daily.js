import {
    escapeHtml,
    formatDate,
    setHtml,
} from '../../../shared/ui/render.js';
import { humanizeToken, relativeWindow } from '../utils.js';

function renderSummaryCard(label, value, detail = '') {
    return `
        <article class="appointments-daily-agenda__stat">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            <small>${escapeHtml(detail)}</small>
        </article>
    `;
}

function renderAlertItem(slot) {
    return `
        <article class="appointments-daily-agenda__alert" data-overbooking-slot="true">
            <strong>${escapeHtml(slot.label)}</strong>
            <small>${escapeHtml(slot.detail)}</small>
        </article>
    `;
}

function renderQueueChip(queueTicket) {
    if (!queueTicket?.ticketCode) {
        return '';
    }

    return `<span class="appointments-daily-agenda__queue-chip">${escapeHtml(queueTicket.ticketCode)}</span>`;
}

function renderAgendaItem(item) {
    const appointment = item.appointment || {};
    const doctorLabel = humanizeToken(appointment.doctor, 'Sin asignar');
    const serviceLabel = humanizeToken(
        appointment.service,
        'Servicio pendiente'
    );
    const metadataLine = `${serviceLabel} · ${doctorLabel}`;
    const detailParts = [item.status?.detail || ''];

    if (item.overbooking?.detail) {
        detailParts.push(item.overbooking.detail);
    }

    return `
        <article
            class="appointments-daily-agenda__item"
            data-daily-agenda-item="true"
            data-appointment-id="${Number(item.appointmentId || 0)}"
            data-queue-status="${escapeHtml(item.queueStatus || '')}"
            data-overbooking="${item.overbooking ? 'true' : 'false'}"
        >
            <div class="appointments-daily-agenda__time">
                <strong>${escapeHtml(appointment.time || '--:--')}</strong>
                <small>${escapeHtml(relativeWindow(item.timestamp))}</small>
            </div>
            <div class="appointments-daily-agenda__body">
                <div class="appointments-daily-agenda__identity">
                    <strong>${escapeHtml(appointment.name || 'Sin nombre')}</strong>
                    <p>${escapeHtml(metadataLine)}</p>
                </div>
                <div class="appointments-daily-agenda__meta">
                    <span class="appointments-daily-agenda__status-pill" data-tone="${escapeHtml(item.status?.tone || 'neutral')}" data-daily-status="true">${escapeHtml(item.status?.label || 'Pendiente')}</span>
                    ${renderQueueChip(item.queueTicket)}
                    ${
                        item.overbooking
                            ? `<span class="appointments-daily-agenda__status-pill" data-tone="danger">Overbooking</span>`
                            : ''
                    }
                </div>
                <small>${escapeHtml(detailParts.filter(Boolean).join(' '))}</small>
            </div>
            <div class="appointments-daily-agenda__actions">
                ${
                    item.canMarkArrived
                        ? `<button type="button" data-action="appointment-mark-arrived" data-id="${Number(item.appointmentId || 0)}">Marcar llegó</button>`
                        : '<span class="appointments-daily-agenda__action-state">Sin acción inmediata</span>'
                }
            </div>
        </article>
    `;
}

export function renderDailyAgenda(dailyAgenda) {
    const items = Array.isArray(dailyAgenda?.items) ? dailyAgenda.items : [];

    if (!items.length) {
        setHtml(
            '#appointmentsDailyAgenda',
            `
                <section class="appointments-daily-agenda__empty" data-daily-agenda-empty="true">
                    <p class="sony-kicker">Agenda del día</p>
                    <strong>Sin citas para hoy</strong>
                    <small>Cuando entren pacientes en la agenda diaria aparecerán aquí con su check-in operativo.</small>
                </section>
            `
        );
        return;
    }

    const dateLabel = formatDate(items[0]?.appointment?.date || '');
    const metaLabel =
        dailyAgenda.pendingArrivalCount > 0
            ? `${dailyAgenda.pendingArrivalCount} por recibir`
            : 'Todas las llegadas registradas';
    const overbookingSummary =
        dailyAgenda.overbookingCount > 0
            ? `${dailyAgenda.overbookingCount} alerta(s) de overbooking`
            : 'Sin choques detectados';

    setHtml(
        '#appointmentsDailyAgenda',
        `
            <section class="appointments-daily-agenda__shell" data-overbooking-count="${Number(dailyAgenda.overbookingCount || 0)}">
                <header class="appointments-daily-agenda__head">
                    <div>
                        <p class="sony-kicker">Agenda del día</p>
                        <h4>${escapeHtml(dateLabel || 'Hoy')}</h4>
                        <p>${escapeHtml(overbookingSummary)} · ${escapeHtml(metaLabel)}</p>
                    </div>
                    <div class="appointments-daily-agenda__stats">
                        ${renderSummaryCard(
                            'Pacientes',
                            String(dailyAgenda.totalCount || 0),
                            'citas en agenda'
                        )}
                        ${renderSummaryCard(
                            'Llegaron',
                            String(dailyAgenda.arrivedCount || 0),
                            'ya están en cola'
                        )}
                        ${renderSummaryCard(
                            'Check-in',
                            String(dailyAgenda.pendingArrivalCount || 0),
                            'pendientes de llegada'
                        )}
                    </div>
                </header>
                ${
                    dailyAgenda.overbookingCount > 0
                        ? `<div class="appointments-daily-agenda__alerts">${dailyAgenda.overbookingSlots
                              .map(renderAlertItem)
                              .join('')}</div>`
                        : ''
                }
                <div class="appointments-daily-agenda__list">
                    ${items.map(renderAgendaItem).join('')}
                </div>
            </section>
        `
    );
}
