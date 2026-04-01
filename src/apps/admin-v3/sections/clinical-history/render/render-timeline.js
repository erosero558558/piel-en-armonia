import { getState, updateState } from '../../../shared/core/store.js';
import { setHtml, setText, escapeHtml, createToast, formatDateTime } from '../../../shared/ui/render.js';
import * as helpers from './index.js';

export function buildTranscript(review, loading, error) {
    if (loading && review.session.transcript.length === 0) {
        return helpers.buildEmptyClinicalCard(
            'Cargando conversacion',
            'Estamos recuperando el transcript y el borrador medico.'
        );
    }

    if (error && review.session.transcript.length === 0) {
        return helpers.buildEmptyClinicalCard('No se pudo cargar el caso', error, {
            tone: 'warning',
        });
    }

    if (review.session.transcript.length === 0) {
        return helpers.buildEmptyClinicalCard(
            'Sin transcript',
            'La conversacion del paciente aparecera aqui cuando exista una sesion cargada.'
        );
    }

    return helpers.buildClinicalHistoryCollection(
        review.session.transcript,
        () => '',
        buildTranscriptMessageCard
    );
}

export function buildTranscriptMessageCard(message) {
    const surface = helpers.normalizeString(message.surface);
    const fieldKey = helpers.normalizeString(message.fieldKey);
    const meta = [surface, fieldKey].filter(Boolean).join(' • ');

    return `
        <article
            class="clinical-history-message"
            data-actor-tone="${escapeHtml(helpers.transcriptActorTone(message))}"
        >
            <header>
                <span class="clinical-history-mini-chip">${escapeHtml(
                    helpers.transcriptActorLabel(message)
                )}</span>
                <time>${escapeHtml(helpers.readableTimestamp(message.createdAt))}</time>
            </header>
            <p>${helpers.formatHtmlMultiline(message.content)}</p>
            <small>${escapeHtml(meta || 'Sin metadata clinica')}</small>
        </article>
    `;
}

export function buildTranscriptMetaText(review) {
    return review.session.sessionId
        ? `${helpers.currentSelectionLabel(review)} • ${
              review.session.surface || 'clinical_intake'
          }`
        : 'El transcript del paciente aparece aqui.';
}

export function buildTranscriptCountText(review) {
    return `${helpers.normalizeList(review.session.transcript).length} mensaje(s)`;
}

export function buildClinicalEventCard(event) {
    const tone = buildEventTone(event);
    const meta = [
        event.status ? `Estado ${event.status}` : '',
        helpers.readableTimestamp(
            event.occurredAt || event.acknowledgedAt || event.resolvedAt
        ),
    ]
        .filter(Boolean)
        .join(' • ');

    return `
        <article class="clinical-history-event-card" data-tone="${escapeHtml(
            tone
        )}">
            <div class="clinical-history-event-head">
                <span class="clinical-history-mini-chip">${escapeHtml(
                    helpers.formatSeverity(event.severity)
                )}</span>
                <span class="clinical-history-mini-chip">${escapeHtml(
                    event.status || 'open'
                )}</span>
            </div>
            <strong>${escapeHtml(event.title || event.type || 'Evento clinico')}</strong>
            <p>${escapeHtml(event.message || 'Sin detalle operativo adicional.')}</p>
            <small>${escapeHtml(meta || 'Sin timestamp')}</small>
        </article>
    `;
}

export function buildEvents(review) {
    return helpers.buildClinicalHistoryCollection(
        review.events,
        () =>
            helpers.buildEmptyClinicalCard(
                'Sin eventos abiertos',
                'Cuando haya alertas, conciliaciones o acciones pendientes apareceran aqui.'
            ),
        buildClinicalEventCard
    );
}

export function buildEventTone(event) {
    const severity = helpers.normalizeString(event.severity).toLowerCase();
    if (severity === 'critical') {
        return 'danger';
    }
    if (severity === 'warning' || event.requiresAction) {
        return 'warning';
    }
    return 'neutral';
}

export function buildEventsMetaText(review) {
    return review.events.length > 0
        ? `${review.events.length} evento(s) registrados para este caso.`
        : 'Alertas, conciliacion y acciones pendientes.';
}

export function highestReviewEventSeverity(review) {
    let highest = '';
    helpers.normalizeList(review.events).forEach((event) => {
        const severity = helpers.normalizeString(event.severity).toLowerCase();
        if (severity === 'critical') {
            highest = 'critical';
            return;
        }
        if (severity === 'warning' && highest !== 'critical') {
            highest = 'warning';
        }
        if (
            severity === 'info' &&
            highest !== 'critical' &&
            highest !== 'warning'
        ) {
            highest = 'info';
        }
    });
    return highest;
}

