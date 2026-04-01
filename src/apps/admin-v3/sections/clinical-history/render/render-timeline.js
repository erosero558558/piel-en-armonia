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
    const rawEvents = [];
    
    // 1. Evolutions / SOAP (Consulta Presencial / Teleconsulta)
    helpers.normalizeList(review.patientRecord?.evolutions).forEach(evo => {
        rawEvents.push({
            date: new Date(evo.createdAt || evo.date || 0),
            type: evo.modality === 'telemedicine' ? 'teleconsulta' : 'consulta',
            title: evo.modality === 'telemedicine' ? '📞 Teleconsulta' : '🩺 Consulta presencial',
            content: `SOAP registrado. Diagnóstico: ${evo.assessment || evo.note_assessment || 'No especificado'}`,
            original: evo,
            id: evo.id
        });
    });

    // 2. Prescriptions
    helpers.normalizeList(review.patientRecord?.prescriptions).forEach(rx => {
        rawEvents.push({
            date: new Date(rx.createdAt || rx.date || 0),
            type: 'receta',
            title: '💊 Receta emitida',
            content: `${helpers.normalizeList(rx.items).length} medicamento(s) recetados.`,
            original: rx,
            id: rx.id || rx.prescriptionId
        });
    });

    // 3. Certificates
    helpers.normalizeList(review.patientRecord?.certificates).forEach(cert => {
        rawEvents.push({
            date: new Date(cert.createdAt || cert.issuedAt || 0),
            type: 'certificado',
            title: '📋 Certificado Médico',
            content: `Motivo: ${cert.reason || cert.type || 'General'}`,
            original: cert,
            id: cert.id
        });
    });

    // 4. Photos / Media
    helpers.normalizeList(review.patientRecord?.media || review.patientRecord?.photos).forEach(photo => {
        rawEvents.push({
            date: new Date(photo.createdAt || photo.uploadedAt || 0),
            type: 'foto',
            title: '📷 Foto clínica',
            content: `Zona: ${photo.bodyZone || 'No especificada'}`,
            original: photo,
            id: photo.id
        });
    });

    // 5. Labs (Orders and Results)
    helpers.normalizeList(review.patientRecord?.labOrders).forEach(lab => {
        const isCritical = helpers.normalizeList(lab.results).some(r => r.status === 'critical');
        rawEvents.push({
            date: new Date(lab.createdAt || lab.orderedAt || 0),
            type: isCritical ? 'critico' : 'laboratorio',
            title: isCritical ? '⚠️ Resultado crítico' : '🧪 Laboratorio',
            content: `Orden: ${lab.name || lab.testName || 'Pruebas múltiples'}`,
            original: lab,
            id: lab.id
        });
    });
    helpers.normalizeList(review.patientRecord?.labResults).forEach(lab => {
        const isCritical = lab.status === 'critical';
        rawEvents.push({
            date: new Date(lab.createdAt || lab.resultedAt || 0),
            type: isCritical ? 'critico' : 'laboratorio',
            title: isCritical ? '⚠️ Resultado crítico' : '🧪 Laboratorio',
            content: `Resultado: ${lab.testName || 'Prueba'}`,
            original: lab,
            id: lab.id
        });
    });

    // Sort descending
    rawEvents.sort((a, b) => b.date - a.date);

    if (rawEvents.length === 0) {
        return helpers.buildEmptyClinicalCard(
            'Sin historial',
            'No hay eventos cronológicos registrados para este paciente.'
        );
    }

    const timelineHtml = rawEvents.map((evt, index) => {
        const prevEvt = rawEvents[index + 1];
        let diffHtml = '';
        if (prevEvt) {
            const diffDays = Math.floor((evt.date - prevEvt.date) / (1000 * 60 * 60 * 24));
            if (diffDays > 0) {
                diffHtml = `<div class="time-between-visits" style="text-align:center; padding: 4px; font-size: 0.75rem; color: var(--admin-text-muted); background: rgba(255,255,255,0.05); border-radius: 4px; margin: 8px auto; width: max-content;">${diffDays} días después</div>`;
            }
        }

        let expandHtml = '';
        if (evt.type === 'consulta' || evt.type === 'teleconsulta') {
            expandHtml = `
                <details class="timeline-expand" style="margin-top: 8px; font-size: 0.85rem; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px;">
                    <summary style="cursor: pointer; color: var(--color-aurora-400);">Ver nota SOAP</summary>
                    <div class="soap-in-timeline" style="margin-top: 8px; color: #ccc;">
                        <strong>S:</strong> ${escapeHtml(evt.original.subjective || evt.original.note_subjective || '-')}<br>
                        <strong>O:</strong> ${escapeHtml(evt.original.objective || evt.original.note_objective || '-')}<br>
                        <strong>A:</strong> ${escapeHtml(evt.original.assessment || evt.original.note_assessment || '-')}<br>
                        <strong>P:</strong> ${escapeHtml(evt.original.plan || evt.original.note_plan || '-')}
                    </div>
                </details>
            `;
        } else if (evt.type === 'receta') {
            expandHtml = `
                <details class="timeline-expand" style="margin-top: 8px; font-size: 0.85rem; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px;">
                    <summary style="cursor: pointer; color: var(--color-aurora-400);">Ver ítems recetados</summary>
                    <ul style="margin-top: 8px; color: #ccc; padding-left: 20px;">
                        ${helpers.normalizeList(evt.original.items).map(item => `<li>${escapeHtml(item.name || 'Item')} ${escapeHtml(item.dose_amount || '')}${escapeHtml(item.dose_unit || '')}</li>`).join('')}
                    </ul>
                </details>
            `;
        }

        const iconColor = evt.type === 'critico' ? 'var(--color-red-500)' : 
                          evt.type === 'receta' ? 'var(--color-emerald-400)' : 
                          evt.type === 'foto' ? 'var(--color-purple-400)' : 
                          evt.type === 'laboratorio' ? 'var(--color-gold-400)' : 
                          evt.type === 'certificado' ? 'var(--color-slate-300)' : 
                          'var(--color-aurora-500)';

        return `
            ${diffHtml}
            <div data-timeline-event-type="${evt.type}" style="display: flex; gap: 12px; margin-bottom: 4px; position: relative;">
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: ${iconColor}; margin-top: 6px;"></div>
                    <div style="width: 2px; flex: 1; background: var(--admin-border); margin-top: 4px; margin-bottom: 4px;"></div>
                </div>
                <div style="flex: 1; background: rgba(255,255,255,0.02); border: 1px solid var(--admin-border); border-radius: 8px; padding: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <h4 style="margin: 0; font-size: 0.95rem; color: #fff;">${escapeHtml(evt.title)}</h4>
                        <time style="font-size: 0.75rem; color: var(--admin-text-muted);">${helpers.readableTimestamp(evt.date.toISOString())}</time>
                    </div>
                    <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: #aaa;">${escapeHtml(evt.content)}</p>
                    ${expandHtml}
                </div>
            </div>
        `;
    }).join('');

    return `<div class="clinical-timeline" style="display:flex; flex-direction:column; padding: 16px;">${timelineHtml}</div>`;
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

