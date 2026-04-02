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

export const EVENT_ICONS = {
    soap: '🩺', prescription: '💊', certificate: '📋',
    lab_result: '🧪', lab_critical: '🚨', photo: '📷',
    telemedicine: '💻', imaging: '🔬', consent: '✍️',
    followup: '📅', anamnesis: '📝', interconsult: '🔗',
};

export function buildClinicalTimeline(events = [], options = {}) {
    if (!events.length) {
        return `<div class="clinical-timeline-empty" data-clinical-timeline="true">
            <p style="color:#9ca3af;text-align:center;padding:24px 0;">Sin eventos clínicos registrados aún.</p>
        </div>`;
    }
    // Sort newest-first
    const sorted = [...events].sort((a, b) => {
        const da = a.createdAt || a.date || '';
        const db = b.createdAt || b.date || '';
        return db.localeCompare(da);
    });

    const items = sorted.map((event, idx) => {
        const type = event.type || 'unknown';
        const icon = EVENT_ICONS[type] || '📌';
        const date = event.createdAt || event.date || '';
        const displayDate = date ? new Date(date).toLocaleDateString('es-EC', {day:'2-digit', month:'short', year:'numeric'}) : '—';
        const isCritical = type === 'lab_critical' || event.data?.critical === true;

        // Summary line by type
        let summary = '';
        if (type === 'soap' || type === 'evolution') {
            const soap = event.data?.soap || {};
            summary = soap.assessment || event.data?.note || 'Nota clínica';
            summary = summary.length > 80 ? summary.slice(0, 77) + '…' : summary;
        } else if (type === 'prescription') {
            const meds = (event.data?.medications || []).map(m => m.medication || m.name || '').filter(Boolean);
            summary = meds.length ? meds.slice(0,3).join(', ') + (meds.length > 3 ? '…' : '') : 'Prescripción';
        } else if (type === 'lab_result' || type === 'lab_critical') {
            const vals = event.data?.values || [];
            summary = vals.length ? vals.slice(0,2).map(v => `${v.test}: ${v.value} ${v.unit||''}`).join(' | ') : 'Resultado de laboratorio';
        } else if (type === 'certificate') {
            summary = event.data?.reason || 'Certificado médico';
        } else if (type === 'imaging') {
            summary = event.data?.impression || event.data?.type || 'Imagen diagnóstica';
        } else {
            summary = event.data?.summary || event.data?.note || type;
        }

        // Gap indicator: if next event > 7 days apart
        let gapHtml = '';
        if (idx < sorted.length - 1) {
            const nextDate = sorted[idx + 1].createdAt || sorted[idx + 1].date || '';
            if (date && nextDate) {
                const gapDays = Math.round((new Date(date) - new Date(nextDate)) / 86400000);
                if (gapDays >= 7) {
                    gapHtml = `<div class="timeline-gap-indicator" data-gap-days="\${gapDays}">
                        <span>⏱ \${gapDays} días sin visita</span>
                    </div>`;
                }
            }
        }

        return `
        <li class="timeline-event \${isCritical ? 'timeline-event--critical' : ''}"
            data-timeline-event-type="\${type}"
            data-timeline-expand="\${event.id || idx}">
            <div class="timeline-event-icon">\${icon}</div>
            <div class="timeline-event-body">
                <div class="timeline-event-header">
                    <span class="timeline-event-type">\${type.replace(/_/g,' ')}</span>
                    <span class="timeline-event-date">\${displayDate}</span>
                </div>
                <p class="timeline-event-summary">\${summary}</p>
            </div>
        </li>\${gapHtml}`;
    }).join('');

    return `
    <ol class="clinical-timeline" data-clinical-timeline="true">
        \${items}
    </ol>
    <style>
        .clinical-timeline { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:0; }
        .timeline-event { display:flex; gap:12px; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.06); cursor:pointer; transition:background 0.15s; border-radius:8px; }
        .timeline-event:hover { background:rgba(255,255,255,0.03); }
        .timeline-event--critical { border-left:3px solid #ef4444; padding-left:8px; }
        .timeline-event-icon { font-size:18px; flex-shrink:0; width:28px; text-align:center; }
        .timeline-event-body { flex:1; min-width:0; }
        .timeline-event-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:2px; }
        .timeline-event-type { font-size:11px; font-weight:600; color:#9ca3af; text-transform:capitalize; }
        .timeline-event-date { font-size:11px; color:#6b7280; }
        .timeline-event-summary { margin:0; font-size:13px; color:#dbe3ed; line-height:1.4; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .timeline-event--critical .timeline-event-summary { color:#fca5a5; }
        .timeline-gap-indicator { display:flex; justify-content:center; padding:6px; }
        .timeline-gap-indicator span { font-size:11px; color:#6b7280; background:rgba(255,255,255,0.04); padding:3px 10px; border-radius:12px; }
        .clinical-timeline-empty { border:1px dashed rgba(255,255,255,0.1); border-radius:12px; }
    </style>`;
}

export function buildTimelineEventDetail(event) {
    // Stub definition placeholder
    return '';
}
