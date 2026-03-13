import { coalesceNonEmptyString, normalizeStatus } from '../helpers.js';

export function resolveAssistanceReasonLabel(reason) {
    const normalized = String(reason || 'general')
        .trim()
        .toLowerCase();

    return (
        {
            human_help: 'Ayuda humana',
            lost_ticket: 'Perdio su ticket',
            printer_issue: 'Problema de impresion',
            appointment_not_found: 'Cita no encontrada',
            ticket_duplicate: 'Ticket duplicado',
            special_priority: 'Prioridad especial',
            accessibility: 'Accesibilidad',
            clinical_redirect: 'Derivacion clinica',
            late_arrival: 'Llegada tarde',
            offline_pending: 'Pendiente offline',
            no_phone: 'Sin celular',
            schedule_taken: 'Horario ocupado',
            reprint_requested: 'Reimpresion solicitada',
            general: 'Apoyo general',
        }[normalized] || 'Apoyo general'
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
        const normalized = String(value).trim();
        if (normalized !== '') {
            return normalized;
        }
    }

    return '';
}

export function normalizeTicket(raw, fallbackIndex = 0) {
    const id = Number(raw?.id || raw?.ticket_id || fallbackIndex + 1);
    const assistanceReason = String(
        raw?.assistanceReason || raw?.assistance_reason || ''
    )
        .trim()
        .toLowerCase();
    return {
        id,
        ticketCode: String(raw?.ticketCode || raw?.ticket_code || `A-${id}`),
        appointmentId:
            Number(raw?.appointmentId ?? raw?.appointment_id ?? 0) || null,
        phoneLast4: String(raw?.phoneLast4 || raw?.phone_last4 || ''),
        patientCaseId: String(raw?.patientCaseId || raw?.patient_case_id || ''),
        queueType: String(raw?.queueType || raw?.queue_type || 'walk_in'),
        patientInitials: String(
            raw?.patientInitials || raw?.patient_initials || '--'
        ),
        priorityClass: String(
            raw?.priorityClass || raw?.priority_class || 'walk_in'
        ),
        status: normalizeStatus(raw?.status || 'waiting'),
        assignedConsultorio:
            Number(
                raw?.assignedConsultorio || raw?.assigned_consultorio || 0
            ) === 2
                ? 2
                : Number(
                        raw?.assignedConsultorio ||
                            raw?.assigned_consultorio ||
                            0
                    ) === 1
                  ? 1
                  : null,
        createdAt: String(
            raw?.createdAt || raw?.created_at || new Date().toISOString()
        ),
        calledAt: String(raw?.calledAt || raw?.called_at || ''),
        completedAt: String(raw?.completedAt || raw?.completed_at || ''),
        needsAssistance: Boolean(raw?.needsAssistance ?? raw?.needs_assistance),
        assistanceRequestStatus: String(
            raw?.assistanceRequestStatus || raw?.assistance_request_status || ''
        ),
        activeHelpRequestId:
            Number(
                raw?.activeHelpRequestId ?? raw?.active_help_request_id ?? 0
            ) || null,
        assistanceReason,
        assistanceReasonLabel: String(
            raw?.assistanceReasonLabel ||
                raw?.assistance_reason_label ||
                (assistanceReason
                    ? resolveAssistanceReasonLabel(assistanceReason)
                    : '')
        ),
        specialPriority: Boolean(raw?.specialPriority ?? raw?.special_priority),
        lateArrival: Boolean(raw?.lateArrival ?? raw?.late_arrival),
        reprintRequestedAt: String(
            raw?.reprintRequestedAt || raw?.reprint_requested_at || ''
        ),
        estimatedWaitMin: Math.max(
            0,
            Number(raw?.estimatedWaitMin ?? raw?.estimated_wait_min ?? 0) || 0
        ),
    };
}

export function normalizeHelpRequest(raw, fallbackIndex = 0) {
    const id = Number(raw?.id || fallbackIndex + 1);
    const reason = String(raw?.reason || 'general')
        .trim()
        .toLowerCase();
    const status = String(raw?.status || 'pending')
        .trim()
        .toLowerCase();
    const context =
        raw?.context && typeof raw.context === 'object' ? raw.context : {};

    return {
        id,
        ticketId: Number(raw?.ticketId ?? raw?.ticket_id ?? 0) || null,
        ticketCode: String(raw?.ticketCode || raw?.ticket_code || ''),
        patientInitials: String(
            raw?.patientInitials || raw?.patient_initials || '--'
        ),
        source: String(raw?.source || 'assistant'),
        reason,
        reasonLabel: String(
            raw?.reasonLabel ||
                raw?.reason_label ||
                resolveAssistanceReasonLabel(reason)
        ),
        patientCaseId: String(raw?.patientCaseId || raw?.patient_case_id || ''),
        status: ['pending', 'attending', 'resolved'].includes(status)
            ? status
            : 'pending',
        message: String(raw?.message || ''),
        intent: String(raw?.intent || ''),
        sessionId: String(raw?.sessionId || raw?.session_id || ''),
        createdAt: String(
            raw?.createdAt || raw?.created_at || new Date().toISOString()
        ),
        updatedAt: String(
            raw?.updatedAt ||
                raw?.updated_at ||
                raw?.createdAt ||
                raw?.created_at ||
                new Date().toISOString()
        ),
        resolvedAt: String(raw?.resolvedAt || raw?.resolved_at || ''),
        context,
        reviewAssessmentKind: String(
            readHelpRequestContextValue(
                context,
                'reviewAssessmentKind',
                'review_assessment_kind'
            )
        ),
        reviewAssessmentLabel: String(
            readHelpRequestContextValue(
                context,
                'reviewAssessmentLabel',
                'review_assessment_label'
            )
        ),
        reviewAssessmentDetail: String(
            readHelpRequestContextValue(
                context,
                'reviewAssessmentDetail',
                'review_assessment_detail'
            )
        ),
        resolutionOutcome: String(
            readHelpRequestContextValue(
                context,
                'resolutionOutcome',
                'resolution_outcome',
                'reviewOutcome',
                'review_outcome'
            )
        ),
        resolutionOutcomeLabel: String(
            readHelpRequestContextValue(
                context,
                'resolutionOutcomeLabel',
                'resolution_outcome_label',
                'reviewOutcomeLabel',
                'review_outcome_label'
            )
        ),
        resolutionSource: String(
            readHelpRequestContextValue(
                context,
                'resolutionSource',
                'resolution_source',
                'reviewSource',
                'review_source'
            )
        ),
        resolutionNote: String(
            readHelpRequestContextValue(
                context,
                'resolutionNote',
                'resolution_note'
            )
        ),
    };
}

export function normalizeMetaTicket(raw, fallbackIndex = 0, overrides = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const normalized = normalizeTicket(
        {
            ...source,
            ...overrides,
        },
        fallbackIndex
    );

    if (!coalesceNonEmptyString(source.createdAt, source.created_at)) {
        normalized.createdAt = '';
    }
    if (!coalesceNonEmptyString(source.priorityClass, source.priority_class)) {
        normalized.priorityClass = '';
    }
    if (!coalesceNonEmptyString(source.queueType, source.queue_type)) {
        normalized.queueType = '';
    }
    if (
        !coalesceNonEmptyString(source.patientInitials, source.patient_initials)
    ) {
        normalized.patientInitials = '';
    }

    return normalized;
}
