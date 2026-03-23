import { escapeHtml, formatDateTime, setHtml } from '../../../../ui/render.js';
import { asArray } from '../../helpers.js';
import { overlayActiveHelpRequests } from '../../model.js';
import { queueRow } from '../rows.js';

function helpRequestStatusLabel(status) {
    const normalized = String(status || 'pending')
        .trim()
        .toLowerCase();
    if (normalized === 'attending') {
        return 'En atencion';
    }
    if (normalized === 'resolved') {
        return 'Resuelto';
    }
    return 'Pendiente';
}

function helpRequestGuide(reason) {
    const normalized = String(reason || 'general')
        .trim()
        .toLowerCase();

    return (
        {
            human_help: {
                nextStep:
                    'Acercate al paciente, confirma que necesita y encaminalo al mostrador o al flujo correcto del kiosco.',
                closeStep:
                    'Resolver cuando el paciente ya tenga un siguiente paso claro y acompanamiento asignado.',
            },
            lost_ticket: {
                nextStep:
                    'Busca el ticket vigente, confirmalo con el paciente y reimprime o indicale su codigo antes de llamarlo.',
                closeStep:
                    'Resolver cuando el paciente vuelva a tener un ticket valido y pueda seguir la fila.',
                shortcut: {
                    kind: 'reprint',
                    label: 'Reimprimir ticket',
                },
            },
            printer_issue: {
                nextStep:
                    'Verifica impresora, reimprime el ticket si aplica y confirma que el paciente conserve el codigo correcto.',
                closeStep:
                    'Resolver cuando el ticket ya este impreso o la recepcion haya tomado el caso manualmente.',
                shortcut: {
                    kind: 'reprint',
                    label: 'Reimprimir ticket',
                },
            },
            appointment_not_found: {
                nextStep:
                    'Valida telefono, fecha y hora de la cita y confirma si corresponde check-in o derivacion manual.',
                closeStep:
                    'Resolver cuando la cita aparezca o el paciente quede redirigido al proceso correcto.',
                shortcut: {
                    kind: 'appointments',
                    label: 'Validar cita',
                },
            },
            ticket_duplicate: {
                nextStep:
                    'Confirma cual ticket debe seguir activo y anula el duplicado antes de llamar al paciente.',
                closeStep:
                    'Resolver cuando solo quede un ticket vigente para ese paciente en la cola.',
            },
            special_priority: {
                nextStep:
                    'Coordina atencion prioritaria y deja visible la prioridad antes del siguiente llamado.',
                closeStep:
                    'Resolver cuando la prioridad ya este reflejada y el paciente tenga ruta clara de espera.',
            },
            accessibility: {
                nextStep:
                    'Acompana el registro presencialmente y confirma si necesita lectura guiada o apoyo visual.',
                closeStep:
                    'Resolver cuando el paciente ya haya completado el paso operativo con apoyo suficiente.',
            },
            clinical_redirect: {
                nextStep:
                    'No des consejo medico. Deriva al doctor o al personal clinico adecuado desde recepcion.',
                closeStep:
                    'Resolver cuando el paciente ya este derivado al personal adecuado y fuera del kiosco.',
            },
            late_arrival: {
                nextStep:
                    'Valida la hora original y confirma si todavia entra en agenda o requiere manejo manual.',
                closeStep:
                    'Resolver cuando el paciente ya sepa si esperara, sera reubicado o seguira otro circuito.',
                shortcut: {
                    kind: 'appointments',
                    label: 'Revisar agenda',
                },
            },
            offline_pending: {
                nextStep:
                    'Revisa pendientes offline del kiosco y decide si conviene sincronizar o registrar manualmente en mostrador.',
                closeStep:
                    'Resolver cuando el turno quede sincronizado o registrado manualmente sin duplicados.',
            },
            no_phone: {
                nextStep:
                    'Valida identidad y datos basicos presencialmente para completar el registro sin celular.',
                closeStep:
                    'Resolver cuando el paciente ya quede ingresado por via presencial.',
            },
            schedule_taken: {
                nextStep:
                    'Confirma disponibilidad vigente y explica que el ajuste de horario se resuelve en recepcion.',
                closeStep:
                    'Resolver cuando el paciente ya tenga confirmacion de disponibilidad o derivacion administrativa.',
                shortcut: {
                    kind: 'appointments',
                    label: 'Abrir agenda',
                },
            },
            reprint_requested: {
                nextStep:
                    'Reimprime el ticket solicitado y verifica que el paciente conserve el codigo correcto.',
                closeStep:
                    'Resolver cuando la reimpresion quede entregada o el ticket ya no sea necesario.',
                shortcut: {
                    kind: 'reprint',
                    label: 'Reimprimir ticket',
                },
            },
            general: {
                nextStep:
                    'Confirma el motivo con el paciente y orientalo al siguiente paso operativo disponible.',
                closeStep:
                    'Resolver cuando el paciente ya tenga apoyo concreto o derivacion definida.',
            },
        }[normalized] || {
            nextStep:
                'Confirma el motivo con el paciente y orientalo al siguiente paso operativo disponible.',
            closeStep:
                'Resolver cuando el paciente ya tenga apoyo concreto o derivacion definida.',
        }
    );
}

function readHelpRequestContextValue(context, ...keys) {
    if (!context || typeof context !== 'object') {
        return '';
    }

    for (const key of keys) {
        const value = context[key];
        if (value === undefined || value === null) {
            continue;
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        const normalized = String(value).trim();
        if (normalized !== '') {
            return normalized;
        }
    }

    return '';
}

function helpRequestAttendLabel(reason) {
    const normalized = String(reason || 'general')
        .trim()
        .toLowerCase();

    if (normalized === 'clinical_redirect') {
        return 'Derivar a doctor';
    }

    return 'Marcar en atencion';
}

function helpRequestResolveLabel(reason) {
    const normalized = String(reason || 'general')
        .trim()
        .toLowerCase();

    if (normalized === 'clinical_redirect') {
        return 'Cerrar derivacion';
    }

    return 'Resolver apoyo';
}

function readRequestContextValue(request, ...keys) {
    const source = request && typeof request === 'object' ? request : {};

    for (const key of keys) {
        const directValue = source[key];
        if (directValue !== undefined && directValue !== null) {
            const normalized = String(directValue).trim();
            if (normalized !== '') {
                return normalized;
            }
        }
    }

    return readHelpRequestContextValue(source.context, ...keys);
}

function buildHelpRequestAssessment(request) {
    const kind = String(
        readRequestContextValue(
            request,
            'reviewAssessmentKind',
            'review_assessment_kind'
        )
    )
        .trim()
        .toLowerCase();
    const label = String(
        readRequestContextValue(
            request,
            'reviewAssessmentLabel',
            'review_assessment_label'
        )
    ).trim();
    const detail = String(
        readRequestContextValue(
            request,
            'reviewAssessmentDetail',
            'review_assessment_detail'
        )
    ).trim();

    return {
        kind,
        label,
        detail,
    };
}

function assessmentTone(kind) {
    switch (
        String(kind || '')
            .trim()
            .toLowerCase()
    ) {
        case 'appointment_match':
            return 'success';
        case 'slot_published':
        case 'day_open':
            return 'info';
        case 'slot_taken':
        case 'slot_missing':
            return 'warning';
        case 'day_closed':
            return 'danger';
        default:
            return 'neutral';
    }
}

function buildResolutionSuggestion(request, guide) {
    const reason = String(request?.reason || 'general')
        .trim()
        .toLowerCase();
    const assessment = buildHelpRequestAssessment(request);
    const base = {
        nextStep: guide.nextStep,
        closeStep: guide.closeStep,
        buttonLabel: helpRequestResolveLabel(reason),
        outcome: '',
        outcomeLabel: '',
        note: '',
    };

    if (
        reason === 'appointment_not_found' &&
        assessment.kind === 'appointment_match'
    ) {
        return {
            ...base,
            nextStep:
                'La cita exacta ya aparece en agenda. Confirma identidad y devuelve al paciente al flujo correcto sin reabrir la duda.',
            closeStep:
                'Resolver como cita vigente confirmada cuando el paciente ya quede listo para check-in o espera.',
            buttonLabel: 'Confirmar cita vigente',
            outcome: 'appointment_confirmed',
            outcomeLabel: 'Cita vigente confirmada',
            note:
                assessment.detail ||
                'Recepcion confirmo que la cita exacta sigue vigente en agenda.',
            assessment,
        };
    }

    if (reason === 'schedule_taken' && assessment.kind === 'slot_taken') {
        return {
            ...base,
            nextStep:
                'Explica al paciente que el horario pedido ya esta ocupado y evita prometer ese espacio desde recepcion.',
            closeStep:
                'Resolver como conflicto horario confirmado cuando el siguiente paso administrativo ya quede claro.',
            buttonLabel: 'Confirmar horario ocupado',
            outcome: 'schedule_conflict',
            outcomeLabel: 'Conflicto horario confirmado',
            note:
                assessment.detail ||
                'Recepcion confirmo que el horario solicitado ya estaba ocupado.',
            assessment,
        };
    }

    if (reason === 'schedule_taken' && assessment.kind === 'slot_missing') {
        return {
            ...base,
            nextStep:
                'Explica que el horario pedido ya no aparece publicado y deja claro que el ajuste se resuelve en recepcion.',
            closeStep:
                'Resolver como horario ya no publicado cuando el paciente ya tenga una salida administrativa clara.',
            buttonLabel: 'Confirmar horario no publicado',
            outcome: 'slot_not_published',
            outcomeLabel: 'Horario ya no publicado',
            note:
                assessment.detail ||
                'Recepcion confirmo que el horario solicitado ya no esta publicado.',
            assessment,
        };
    }

    if (reason === 'schedule_taken' && assessment.kind === 'day_closed') {
        return {
            ...base,
            nextStep:
                'Explica que ese dia ya no tiene slots publicados y evita mantener la expectativa de ese horario.',
            closeStep:
                'Resolver como dia sin slots confirmado cuando recepcion ya haya dado la salida correcta al paciente.',
            buttonLabel: 'Confirmar dia sin slots',
            outcome: 'day_without_slots',
            outcomeLabel: 'Dia sin slots confirmado',
            note:
                assessment.detail ||
                'Recepcion confirmo que el dia solicitado ya no tiene slots publicados.',
            assessment,
        };
    }

    if (reason === 'clinical_redirect') {
        return {
            ...base,
            closeStep:
                'Resolver como derivacion clinica confirmada cuando el paciente ya quede encaminado con el personal adecuado.',
            buttonLabel: 'Cerrar derivacion',
            outcome: 'clinical_redirect_confirmed',
            outcomeLabel: 'Derivacion clinica confirmada',
            note: 'Recepcion mantuvo la consulta fuera del kiosco y la derivo al carril clinico presencial.',
            assessment,
        };
    }

    if (reason === 'special_priority') {
        return {
            ...base,
            closeStep:
                'Resolver como prioridad visible confirmada cuando la cola ya refleje la prioridad antes del siguiente llamado.',
            buttonLabel: 'Confirmar prioridad visible',
            outcome: 'priority_confirmed',
            outcomeLabel: 'Prioridad visible confirmada',
            note: 'Recepcion confirmo que la prioridad del paciente ya quedo visible en la cola.',
            assessment,
        };
    }

    return {
        ...base,
        assessment,
    };
}

function renderHelpRequestContextSummary(request) {
    const context =
        request?.context && typeof request.context === 'object'
            ? request.context
            : {};
    const phoneLast4 = String(
        readHelpRequestContextValue(context, 'phoneLast4', 'phone_last4')
    ).trim();
    const requestedDate = String(
        readHelpRequestContextValue(context, 'requestedDate', 'requested_date')
    ).trim();
    const requestedTime = String(
        readHelpRequestContextValue(context, 'requestedTime', 'requested_time')
    ).trim();
    const appointmentId =
        Number(
            readHelpRequestContextValue(
                context,
                'appointmentId',
                'appointment_id'
            ) || 0
        ) || 0;
    const contextParts = [];

    if (phoneLast4) {
        contextParts.push(`tel. *${phoneLast4.slice(-4)}`);
    }
    if (requestedDate) {
        contextParts.push(requestedDate);
    }
    if (requestedTime) {
        contextParts.push(requestedTime);
    }
    if (appointmentId > 0) {
        contextParts.push(`cita #${appointmentId}`);
    }

    if (!contextParts.length) {
        return '';
    }

    return `<p><strong>Contexto operativo:</strong> ${escapeHtml(contextParts.join(' · '))}</p>`;
}

function renderHelpRequestActionButton({
    action,
    label,
    shortcut = '',
    helpRequestId = 0,
    helpRequestStatus = '',
    ticketId = 0,
    ticketCode = '',
    dataAttributes = {},
}) {
    const attributes = [`type="button"`, `data-action="${escapeHtml(action)}"`];

    if (shortcut) {
        attributes.push(
            `data-queue-guidance-shortcut="${escapeHtml(shortcut)}"`
        );
    }
    if (helpRequestId > 0) {
        attributes.push(`data-queue-help-request-id="${helpRequestId}"`);
    }
    if (helpRequestStatus) {
        attributes.push(
            `data-queue-help-request-status="${escapeHtml(helpRequestStatus)}"`
        );
    }
    if (ticketId > 0) {
        attributes.push(`data-queue-id="${ticketId}"`);
    }
    if (ticketCode) {
        attributes.push(`data-queue-ticket-code="${escapeHtml(ticketCode)}"`);
    }
    Object.entries(
        dataAttributes && typeof dataAttributes === 'object'
            ? dataAttributes
            : {}
    ).forEach(([key, value]) => {
        const text = String(value ?? '').trim();
        if (!text) {
            return;
        }
        const attrName = key
            .replace(/_/g, '-')
            .replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
        attributes.push(`data-${escapeHtml(attrName)}="${escapeHtml(text)}"`);
    });

    return `<button ${attributes.join(' ')}>${escapeHtml(label)}</button>`;
}

function renderHelpRequestActions(request, guide) {
    const status = String(request?.status || 'pending')
        .trim()
        .toLowerCase();
    const helpRequestId = Number(request?.id || 0) || 0;
    const ticketId = Number(request?.ticketId || 0) || 0;
    const ticketCode = String(request?.ticketCode || '').trim();
    const reason = String(request?.reason || 'general')
        .trim()
        .toLowerCase();
    const resolutionSuggestion = buildResolutionSuggestion(request, guide);
    const actions = [];

    if (status === 'pending' && (helpRequestId > 0 || ticketId > 0)) {
        actions.push(
            renderHelpRequestActionButton({
                action: 'queue-help-request-status',
                label: helpRequestAttendLabel(reason),
                shortcut: 'attend',
                helpRequestId,
                helpRequestStatus: 'attending',
                ticketId,
                ticketCode,
            })
        );
    }

    if (status === 'attending' && (helpRequestId > 0 || ticketId > 0)) {
        actions.push(
            renderHelpRequestActionButton({
                action: 'queue-help-request-status',
                label: resolutionSuggestion.buttonLabel,
                shortcut: 'resolve',
                helpRequestId,
                helpRequestStatus: 'resolved',
                ticketId,
                ticketCode,
                dataAttributes: resolutionSuggestion.outcome
                    ? {
                          queueReviewAssessmentKind:
                              resolutionSuggestion.assessment.kind,
                          queueReviewAssessmentLabel:
                              resolutionSuggestion.assessment.label,
                          queueReviewAssessmentDetail:
                              resolutionSuggestion.assessment.detail,
                          queueResolutionOutcome: resolutionSuggestion.outcome,
                          queueResolutionOutcomeLabel:
                              resolutionSuggestion.outcomeLabel,
                          queueResolutionSource: 'queue',
                          queueResolutionNote: resolutionSuggestion.note,
                      }
                    : {},
            })
        );
    }

    if (guide?.shortcut?.kind === 'reprint' && ticketId > 0) {
        actions.push(
            renderHelpRequestActionButton({
                action: 'queue-reprint-ticket',
                label: guide.shortcut.label || 'Reimprimir ticket',
                shortcut: 'reprint',
                helpRequestId,
                ticketId,
                ticketCode,
            })
        );
    }

    if (guide?.shortcut?.kind === 'appointments') {
        actions.push(
            renderHelpRequestActionButton({
                action: 'queue-open-appointments',
                label: guide.shortcut.label || 'Abrir agenda',
                shortcut: 'appointments',
                helpRequestId,
                ticketId,
                ticketCode,
            })
        );
    }

    if (ticketId > 0 || ticketCode) {
        actions.push(
            renderHelpRequestActionButton({
                action: 'queue-focus-ticket',
                label: 'Ir al ticket',
                shortcut: 'focus',
                helpRequestId,
                ticketId,
                ticketCode,
            })
        );
    }

    return actions.length
        ? `<div class="queue-reception-guidance__actions">${actions.join('')}</div>`
        : '';
}

function resolutionSourceLabel(value) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    if (normalized === 'appointments') {
        return 'Desde agenda';
    }
    if (normalized === 'queue') {
        return 'Desde cola';
    }
    return normalized ? 'Desde recepcion' : '';
}

function renderResolvedRequestActions(request) {
    const ticketId = Number(request?.ticketId || 0) || 0;
    const ticketCode = String(request?.ticketCode || '').trim();
    if (ticketId <= 0 && !ticketCode) {
        return '';
    }

    return `<div class="queue-reception-guidance__actions">${renderHelpRequestActionButton(
        {
            action: 'queue-focus-ticket',
            label: 'Ir al ticket',
            shortcut: 'focus',
            ticketId,
            ticketCode,
        }
    )}</div>`;
}

function renderRecentResolutionItem(request) {
    const outcomeLabel = String(
        request?.resolutionOutcomeLabel ||
            request?.reviewAssessmentLabel ||
            'Apoyo resuelto'
    ).trim();
    const outcomeNote = String(
        request?.resolutionNote || request?.reviewAssessmentDetail || ''
    ).trim();
    const sourceLabel = resolutionSourceLabel(request?.resolutionSource);
    const resolvedAt = String(
        request?.resolvedAt || request?.updatedAt || request?.createdAt || ''
    ).trim();

    return `
        <li class="queue-reception-guidance__item" data-state="resolved">
            <div class="queue-reception-guidance__item-head">
                <div>
                    <strong>${escapeHtml(String(request?.ticketCode || '--'))} · ${escapeHtml(outcomeLabel)}</strong>
                    <small>Paciente ${escapeHtml(String(request?.patientInitials || '--'))} · ${escapeHtml(String(request?.reasonLabel || 'Apoyo resuelto'))}</small>
                </div>
                <span class="queue-reception-guidance__pill" data-state="resolved">
                    Resuelto
                </span>
            </div>
            ${
                sourceLabel || resolvedAt
                    ? `<p><strong>Cierre:</strong> ${escapeHtml(
                          [
                              sourceLabel,
                              resolvedAt ? formatDateTime(resolvedAt) : '',
                          ]
                              .filter(Boolean)
                              .join(' · ')
                      )}</p>`
                    : ''
            }
            ${
                outcomeNote
                    ? `<p><strong>Resultado:</strong> ${escapeHtml(outcomeNote)}</p>`
                    : ''
            }
            ${renderHelpRequestContextSummary(request)}
            ${renderResolvedRequestActions(request)}
        </li>
    `;
}

function renderReceptionGuidanceItem(request) {
    const status = String(request?.status || 'pending')
        .trim()
        .toLowerCase();
    const statusLabel = helpRequestStatusLabel(status);
    const reasonLabel = String(request?.reasonLabel || 'Apoyo general').trim();
    const ticketCode = String(request?.ticketCode || '').trim() || '--';
    const patientInitials = String(request?.patientInitials || '--').trim();
    const guide = helpRequestGuide(request?.reason);
    const resolutionSuggestion = buildResolutionSuggestion(request, guide);
    const assessment = resolutionSuggestion.assessment;

    return `
        <li class="queue-reception-guidance__item" data-state="${escapeHtml(status)}">
            <div class="queue-reception-guidance__item-head">
                <div>
                    <strong>${escapeHtml(ticketCode)} · ${escapeHtml(reasonLabel)}</strong>
                    <small>Paciente ${escapeHtml(patientInitials)} · ${escapeHtml(statusLabel)}</small>
                </div>
                <span class="queue-reception-guidance__pill" data-state="${escapeHtml(status)}">
                    ${escapeHtml(statusLabel)}
                </span>
            </div>
            ${
                assessment.label
                    ? `<div class="queue-reception-guidance__assessment" data-tone="${escapeHtml(
                          assessmentTone(assessment.kind)
                      )}">
                            <strong>Validacion actual: ${escapeHtml(
                                assessment.label
                            )}</strong>
                            ${
                                assessment.detail
                                    ? `<small>${escapeHtml(
                                          assessment.detail
                                      )}</small>`
                                    : ''
                            }
                       </div>`
                    : ''
            }
            <p><strong>Siguiente paso:</strong> ${escapeHtml(resolutionSuggestion.nextStep)}</p>
            <p><strong>Cierre sugerido:</strong> ${escapeHtml(resolutionSuggestion.closeStep)}</p>
            ${
                status === 'attending' && resolutionSuggestion.outcomeLabel
                    ? `<p><strong>Cierre recomendado ahora:</strong> ${escapeHtml(
                          resolutionSuggestion.outcomeLabel
                      )}</p>`
                    : ''
            }
            ${renderHelpRequestContextSummary(request)}
            ${renderHelpRequestActions(request, guide)}
        </li>
    `;
}

export function renderQueueTableBody(visible, queueMeta = null) {
    const renderedTickets = overlayActiveHelpRequests(visible, queueMeta);
    setHtml(
        '#queueTableBody',
        renderedTickets.length
            ? renderedTickets.map(queueRow).join('')
            : '<tr><td colspan="7">No hay tickets para filtro</td></tr>'
    );
}

export function renderQueueNextAdminList(queueMeta, fallbackPartial) {
    const nextTickets = asArray(queueMeta.nextTickets);
    const waitingCount = Number(
        queueMeta.waitingCount || queueMeta.counts?.waiting || 0
    );
    const nextSummary =
        fallbackPartial &&
        nextTickets.length &&
        waitingCount > nextTickets.length
            ? `<li><span>-</span><strong>Mostrando primeros ${nextTickets.length} de ${waitingCount} en espera</strong></li>`
            : '';

    setHtml(
        '#queueNextAdminList',
        nextTickets.length
            ? `${nextSummary}${nextTickets
                  .map(
                      (ticket) =>
                          `<li><span>${escapeHtml(ticket.ticketCode || ticket.ticket_code || '--')}</span><strong>${escapeHtml(
                              ticket.patientInitials ||
                                  ticket.patient_initials ||
                                  '--'
                          )}</strong></li>`
                  )
                  .join('')}`
            : '<li><span>-</span><strong>Sin siguientes</strong></li>'
    );
}

export function renderQueueReceptionGuidance(queueMeta) {
    const activeHelpRequests = asArray(queueMeta.activeHelpRequests);
    const metaText = activeHelpRequests.length
        ? `${activeHelpRequests.length} apoyo(s) activos con siguiente paso y atajos contextuales.`
        : 'Sin apoyos activos para recepcion.';

    setHtml('#queueReceptionGuidanceMeta', escapeHtml(metaText));
    setHtml(
        '#queueReceptionGuidanceList',
        activeHelpRequests.length
            ? activeHelpRequests.map(renderReceptionGuidanceItem).join('')
            : `<li class="queue-reception-guidance__item is-empty">
                    <strong>Sin apoyos activos</strong>
                    <p>Cuando el kiosco escale una excepcion, recepcion vera aqui el siguiente paso recomendado.</p>
               </li>`
    );
}

export function renderQueueRecentResolutions(queueMeta) {
    const recentResolved = asArray(queueMeta.recentResolvedHelpRequests);
    const metaText = recentResolved.length
        ? `${recentResolved.length} cierre(s) recientes con resultado operativo trazable.`
        : 'Sin cierres asistidos todavia.';

    setHtml('#queueRecentResolutionsMeta', escapeHtml(metaText));
    setHtml(
        '#queueRecentResolutionsList',
        recentResolved.length
            ? recentResolved.map(renderRecentResolutionItem).join('')
            : `<li class="queue-reception-guidance__item is-empty">
                    <strong>Sin resoluciones recientes</strong>
                    <p>Cuando recepcion cierre un apoyo con resultado estructurado, aparecera aqui para mantener el contexto de sala.</p>
               </li>`
    );
}
