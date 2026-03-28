import { refreshAdminData } from '../../../shared/modules/data.js';
import { getState, updateState } from '../../../shared/core/store.js';
import { apiRequest } from '../../../shared/core/api-client.js';
import {
    getQueryParam,
    setQueryParam,
} from '../../../shared/core/persistence.js';
import {
    createToast,
    escapeHtml,
    formatDateTime,
    setHtml,
    setText,
} from '../../../shared/ui/render.js';
import { renderDashboard } from '../../dashboard.js';
import { renderAdminChrome } from '../../../ui/frame.js';

const CLINICAL_HISTORY_SESSION_QUERY_PARAM = 'clinicalSessionId';
const CLINICAL_HISTORY_WORKSPACE_QUERY_PARAM = 'clinicalWorkspace';
const CLINICAL_HISTORY_QUEUE_FILTERS = Object.freeze([
    'all',
    'ready_to_approve',
    'pending_ai',
    'consent',
    'alert',
]);
const CLINICAL_HISTORY_QUEUE_FILTER_OPTIONS = Object.freeze([
    { id: 'all', label: 'Todos' },
    { id: 'ready_to_approve', label: 'Lista' },
    { id: 'pending_ai', label: 'IA' },
    { id: 'consent', label: 'Consent.' },
    { id: 'alert', label: 'Alertas' },
]);
const CLINICAL_HISTORY_WORKSPACE_OPTIONS = Object.freeze([
    {
        workspace: 'review',
        label: 'Cabina HCE',
        metaLabel: (meta) =>
            `${normalizeList(meta.reviewQueue).length} caso(s) clinicos`,
    },
]);
const CLINICAL_HISTORY_SEX_CHOICES = Object.freeze([
    { value: '', label: 'Sin dato' },
    { value: 'femenino', label: 'Femenino' },
    { value: 'masculino', label: 'Masculino' },
    { value: 'intersexual', label: 'Intersexual' },
]);
const CLINICAL_HISTORY_PREGNANCY_CHOICES = Object.freeze([
    { value: '', label: 'Sin dato' },
    { value: 'no', label: 'No' },
    { value: 'yes', label: 'Si' },
]);

let scheduledAutoSelection = '';

function normalizeString(value) {
    return String(value || '').trim();
}

function normalizeList(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeStringList(value) {
    return normalizeList(value)
        .map((item) => normalizeString(item))
        .filter(Boolean);
}

export function normalizeClinicalHistoryWorkspace(value) {
    return 'review';
}

function normalizeClinicalQueueFilter(value) {
    const normalized = normalizeString(value).toLowerCase();
    return CLINICAL_HISTORY_QUEUE_FILTERS.includes(normalized)
        ? normalized
        : 'all';
}

function readWorkspaceQuery() {
    const raw = normalizeString(
        getQueryParam(CLINICAL_HISTORY_WORKSPACE_QUERY_PARAM)
    );
    return raw ? normalizeClinicalHistoryWorkspace(raw) : '';
}

function normalizeNumber(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeNullableInt(value) {
    if (value === '' || value === null || value === undefined) {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return null;
    }

    return Math.max(0, Math.round(parsed));
}

function normalizeNullableFloat(value) {
    if (value === '' || value === null || value === undefined) {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return null;
    }

    return Math.max(0, Number(parsed));
}

function cloneValue(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
}

function emptyPosology() {
    return {
        texto: '',
        baseCalculo: '',
        pesoKg: null,
        edadAnios: null,
        units: '',
        ambiguous: true,
    };
}

function emptyDraft() {
    return {
        sessionId: '',
        caseId: '',
        appointmentId: null,
        patientRecordId: '',
        episodeId: '',
        encounterId: '',
        reviewStatus: 'pending_review',
        requiresHumanReview: true,
        confidence: 0,
        reviewReasons: [],
        intake: {
            motivoConsulta: '',
            enfermedadActual: '',
            antecedentes: '',
            alergias: '',
            medicacionActual: '',
            rosRedFlags: [],
            adjuntos: [],
            resumenClinico: '',
            cie10Sugeridos: [],
            tratamientoBorrador: '',
            posologiaBorrador: emptyPosology(),
            preguntasFaltantes: [],
            datosPaciente: {
                edadAnios: null,
                pesoKg: null,
                sexoBiologico: '',
                embarazo: null,
            },
        },
        clinicianDraft: {
            resumen: '',
            preguntasFaltantes: [],
            cie10Sugeridos: [],
            tratamientoBorrador: '',
            posologiaBorrador: emptyPosology(),
        },
        recordMeta: {
            archiveState: 'active',
            lastAttentionAt: '',
            passiveAfterYears: 5,
            confidentialityLabel: 'CONFIDENCIAL',
            identityProtectionMode: 'standard',
            copyDeliverySlaHours: 48,
            formsCatalogStatus: 'official_partial_traceability',
            confirmedForms: [
                'SNS-MSP/HCU-form.001/2008',
                'SNS-MSP/HCU-form.005/2008',
                'SNS-MSP/HCU-form.007/2008',
                'SNS-MSP/HCU-form.024',
            ],
            normativeScope: 'ecuador_private_consultorio_v1',
        },
        documents: {
            finalNote: {
                status: 'draft',
                summary: '',
                content: '',
                version: 1,
                generatedAt: '',
                confidential: true,
            },
            prescription: {
                status: 'draft',
                medication: '',
                directions: '',
                signedAt: '',
                confidential: true,
            },
            certificate: {
                status: 'draft',
                summary: '',
                restDays: null,
                signedAt: '',
                confidential: true,
            },
        },
        consent: {
            required: false,
            status: 'not_required',
            informedBy: '',
            informedAt: '',
            explainedWhat: '',
            risksExplained: '',
            alternativesExplained: '',
            capacityAssessment: '',
            privateCommunicationConfirmed: false,
            companionShareAuthorized: false,
            acceptedAt: '',
            declinedAt: '',
            revokedAt: '',
            notes: '',
        },
        approval: {
            status: 'pending',
            approvedBy: '',
            approvedAt: '',
            finalDraftVersion: null,
            checklistSnapshot: [],
            aiTraceSnapshot: {},
            notes: '',
            normativeSources: [],
        },
        pendingAi: {},
        updatedAt: '',
        createdAt: '',
    };
}

function emptyReview() {
    return {
        session: {
            sessionId: '',
            caseId: '',
            appointmentId: null,
            surface: '',
            status: '',
            patient: {
                name: '',
                email: '',
                phone: '',
                ageYears: null,
                weightKg: null,
                sexAtBirth: '',
                pregnant: null,
            },
            transcript: [],
            pendingAi: {},
            metadata: {},
            createdAt: '',
            updatedAt: '',
            lastMessageAt: '',
        },
        draft: emptyDraft(),
        events: [],
        patientRecord: {},
        activeEpisode: {},
        encounter: {},
        documents: cloneValue(emptyDraft().documents),
        consent: cloneValue(emptyDraft().consent),
        approval: cloneValue(emptyDraft().approval),
        approvalState: cloneValue(emptyDraft().approval),
        legalReadiness: {
            status: 'blocked',
            ready: false,
            label: 'Bloqueada',
            summary: '',
            checklist: [],
            blockingReasons: [],
        },
        recordsGovernance: {},
        accessAudit: [],
        disclosureLog: [],
        copyRequests: [],
        archiveReadiness: {},
        approvalBlockedReasons: [],
        closureChecklist: {},
        auditSummary: {},
    };
}

function normalizePatient(patient) {
    const source = patient && typeof patient === 'object' ? patient : {};
    return {
        name: normalizeString(source.name || source.fullName),
        email: normalizeString(source.email),
        phone: normalizeString(source.phone),
        ageYears: normalizeNullableInt(source.ageYears || source.edadAnios),
        weightKg: normalizeNullableFloat(source.weightKg || source.pesoKg),
        sexAtBirth: normalizeString(source.sexAtBirth || source.sexoBiologico),
        pregnant:
            source.pregnant === null || source.pregnant === undefined
                ? source.embarazo === null || source.embarazo === undefined
                    ? null
                    : source.embarazo === true
                : source.pregnant === true,
    };
}

function normalizeTranscriptMessage(message) {
    const source = message && typeof message === 'object' ? message : {};
    return {
        id: normalizeString(source.id),
        role: normalizeString(source.role || 'user'),
        actor: normalizeString(source.actor || 'patient'),
        content: normalizeString(source.content),
        surface: normalizeString(source.surface),
        createdAt: normalizeString(source.createdAt),
        fieldKey: normalizeString(source.fieldKey),
        meta: source.meta && typeof source.meta === 'object' ? source.meta : {},
    };
}

function normalizeAttachment(attachment) {
    const source =
        attachment && typeof attachment === 'object' ? attachment : {};
    return {
        id: normalizeNullableInt(source.id),
        kind: normalizeString(source.kind),
        originalName: normalizeString(source.originalName || source.name),
        mime: normalizeString(source.mime),
        size: Math.max(0, normalizeNumber(source.size)),
        privatePath: normalizeString(source.privatePath),
        appointmentId: normalizeNullableInt(source.appointmentId),
    };
}

function normalizePosology(posology) {
    const source = posology && typeof posology === 'object' ? posology : {};
    return {
        texto: normalizeString(source.texto),
        baseCalculo: normalizeString(source.baseCalculo),
        pesoKg: normalizeNullableFloat(source.pesoKg),
        edadAnios: normalizeNullableInt(source.edadAnios),
        units: normalizeString(source.units),
        ambiguous:
            source.ambiguous === undefined ? true : source.ambiguous === true,
    };
}

function normalizeDocuments(documents) {
    const defaults = emptyDraft().documents;
    const source = documents && typeof documents === 'object' ? documents : {};
    return {
        finalNote: {
            ...defaults.finalNote,
            ...(source.finalNote && typeof source.finalNote === 'object'
                ? source.finalNote
                : {}),
            status: normalizeString(
                source?.finalNote?.status || defaults.finalNote.status
            ),
            summary: normalizeString(source?.finalNote?.summary),
            content: normalizeString(source?.finalNote?.content),
            version: Math.max(
                1,
                normalizeNumber(
                    source?.finalNote?.version || defaults.finalNote.version
                )
            ),
            generatedAt: normalizeString(source?.finalNote?.generatedAt),
            confidential: source?.finalNote?.confidential !== false,
        },
        prescription: {
            ...defaults.prescription,
            ...(source.prescription && typeof source.prescription === 'object'
                ? source.prescription
                : {}),
            status: normalizeString(
                source?.prescription?.status || defaults.prescription.status
            ),
            medication: normalizeString(source?.prescription?.medication),
            directions: normalizeString(source?.prescription?.directions),
            signedAt: normalizeString(source?.prescription?.signedAt),
            confidential: source?.prescription?.confidential !== false,
        },
        certificate: {
            ...defaults.certificate,
            ...(source.certificate && typeof source.certificate === 'object'
                ? source.certificate
                : {}),
            status: normalizeString(
                source?.certificate?.status || defaults.certificate.status
            ),
            summary: normalizeString(source?.certificate?.summary),
            restDays: normalizeNullableInt(source?.certificate?.restDays),
            signedAt: normalizeString(source?.certificate?.signedAt),
            confidential: source?.certificate?.confidential !== false,
        },
    };
}

function normalizeConsent(consent) {
    const defaults = emptyDraft().consent;
    const source = consent && typeof consent === 'object' ? consent : {};
    return {
        ...defaults,
        ...source,
        required: source.required === true,
        status: normalizeString(source.status || defaults.status),
        informedBy: normalizeString(source.informedBy),
        informedAt: normalizeString(source.informedAt),
        explainedWhat: normalizeString(source.explainedWhat),
        risksExplained: normalizeString(source.risksExplained),
        alternativesExplained: normalizeString(source.alternativesExplained),
        capacityAssessment: normalizeString(source.capacityAssessment),
        privateCommunicationConfirmed:
            source.privateCommunicationConfirmed === true,
        companionShareAuthorized: source.companionShareAuthorized === true,
        acceptedAt: normalizeString(source.acceptedAt),
        declinedAt: normalizeString(source.declinedAt),
        revokedAt: normalizeString(source.revokedAt),
        notes: normalizeString(source.notes),
    };
}

function normalizeApproval(approval) {
    const defaults = emptyDraft().approval;
    const source = approval && typeof approval === 'object' ? approval : {};
    return {
        ...defaults,
        ...source,
        status: normalizeString(source.status || defaults.status),
        approvedBy: normalizeString(source.approvedBy),
        approvedAt: normalizeString(source.approvedAt),
        finalDraftVersion:
            source.finalDraftVersion === null ||
            source.finalDraftVersion === undefined
                ? null
                : normalizeNullableInt(source.finalDraftVersion),
        checklistSnapshot: normalizeList(source.checklistSnapshot),
        aiTraceSnapshot:
            source.aiTraceSnapshot && typeof source.aiTraceSnapshot === 'object'
                ? source.aiTraceSnapshot
                : {},
        notes: normalizeString(source.notes),
        normativeSources: normalizeStringList(source.normativeSources),
    };
}

function isPastTimestamp(value) {
    const stamp = normalizeString(value);
    if (!stamp) {
        return false;
    }

    const parsed = Date.parse(stamp);
    if (Number.isNaN(parsed)) {
        return false;
    }

    return parsed <= Date.now();
}

function normalizeAccessAuditEntry(entry) {
    const source = entry && typeof entry === 'object' ? entry : {};
    return {
        auditId: normalizeString(source.auditId || source.id),
        recordId: normalizeString(source.recordId),
        sessionId: normalizeString(source.sessionId),
        episodeId: normalizeString(source.episodeId),
        actor: normalizeString(source.actor),
        actorRole: normalizeString(source.actorRole),
        action: normalizeString(source.action),
        resource: normalizeString(source.resource || 'clinical_record'),
        reason: normalizeString(source.reason),
        createdAt: normalizeString(source.createdAt),
        meta: source.meta && typeof source.meta === 'object' ? source.meta : {},
    };
}

function normalizeDisclosureEntry(entry) {
    const source = entry && typeof entry === 'object' ? entry : {};
    return {
        disclosureId: normalizeString(source.disclosureId || source.id),
        targetType: normalizeString(source.targetType || 'patient'),
        targetName: normalizeString(source.targetName || source.deliveredTo),
        purpose: normalizeString(source.purpose),
        legalBasis: normalizeString(source.legalBasis),
        authorizedByConsent: source.authorizedByConsent === true,
        performedBy: normalizeString(source.performedBy || source.requestedBy),
        performedAt: normalizeString(source.performedAt || source.deliveredAt),
        channel: normalizeString(source.channel || source.mode),
        notes: normalizeString(source.notes),
    };
}

function normalizeCopyRequest(entry) {
    const source = entry && typeof entry === 'object' ? entry : {};
    const effectiveStatus =
        normalizeString(source.effectiveStatus) ||
        (() => {
            if (
                normalizeString(source.status) === 'delivered' ||
                normalizeString(source.deliveredAt)
            ) {
                return 'delivered';
            }
            if (isPastTimestamp(source.dueAt)) {
                return 'overdue';
            }
            return 'requested';
        })();

    return {
        requestId: normalizeString(source.requestId || source.id),
        requestedByType: normalizeString(source.requestedByType || 'patient'),
        requestedByName: normalizeString(
            source.requestedByName || source.requestedBy
        ),
        requestedAt: normalizeString(source.requestedAt),
        dueAt: normalizeString(source.dueAt),
        status: normalizeString(source.status || 'requested'),
        effectiveStatus,
        statusLabel:
            normalizeString(source.statusLabel) ||
            (effectiveStatus === 'delivered'
                ? 'Entregada'
                : effectiveStatus === 'overdue'
                  ? 'Vencida'
                  : 'Pendiente'),
        legalBasis: normalizeString(source.legalBasis),
        notes: normalizeString(source.notes),
        deliveredAt: normalizeString(source.deliveredAt),
        deliveryChannel: normalizeString(source.deliveryChannel),
        deliveredTo: normalizeString(source.deliveredTo),
    };
}

function normalizeArchiveReadiness(readiness) {
    const source = readiness && typeof readiness === 'object' ? readiness : {};
    return {
        archiveState: normalizeString(source.archiveState || 'active'),
        lastAttentionAt: normalizeString(source.lastAttentionAt),
        passiveAfterYears: Math.max(
            1,
            normalizeNumber(source.passiveAfterYears || 5)
        ),
        eligibleForPassive: source.eligibleForPassive === true,
        eligibleAt: normalizeString(source.eligibleAt),
        daysUntilPassive:
            source.daysUntilPassive === null ||
            source.daysUntilPassive === undefined
                ? null
                : normalizeNullableInt(source.daysUntilPassive),
        recommendedState: normalizeString(source.recommendedState || 'active'),
        label: normalizeString(source.label || 'Activa'),
        overrideRequired: source.overrideRequired === true,
    };
}

function normalizeRecordsGovernance(governance) {
    const source =
        governance && typeof governance === 'object' ? governance : {};
    return {
        archiveState: normalizeString(source.archiveState || 'active'),
        archiveReadiness: normalizeArchiveReadiness(source.archiveReadiness),
        copyRequestSummary:
            source.copyRequestSummary &&
            typeof source.copyRequestSummary === 'object'
                ? {
                      total: Math.max(
                          0,
                          normalizeNumber(source.copyRequestSummary.total)
                      ),
                      pending: Math.max(
                          0,
                          normalizeNumber(source.copyRequestSummary.pending)
                      ),
                      delivered: Math.max(
                          0,
                          normalizeNumber(source.copyRequestSummary.delivered)
                      ),
                      overdue: Math.max(
                          0,
                          normalizeNumber(source.copyRequestSummary.overdue)
                      ),
                      latestRequest: normalizeCopyRequest(
                          source.copyRequestSummary.latestRequest
                      ),
                  }
                : {
                      total: 0,
                      pending: 0,
                      delivered: 0,
                      overdue: 0,
                      latestRequest: normalizeCopyRequest({}),
                  },
        disclosureSummary:
            source.disclosureSummary &&
            typeof source.disclosureSummary === 'object'
                ? {
                      total: Math.max(
                          0,
                          normalizeNumber(source.disclosureSummary.total)
                      ),
                      latest: normalizeDisclosureEntry(
                          source.disclosureSummary.latest
                      ),
                  }
                : {
                      total: 0,
                      latest: normalizeDisclosureEntry({}),
                  },
        lastAccessEvent: normalizeAccessAuditEntry(source.lastAccessEvent),
        confidentialityLabel: normalizeString(
            source.confidentialityLabel || 'CONFIDENCIAL'
        ),
        identityProtectionMode: normalizeString(
            source.identityProtectionMode || 'standard'
        ),
    };
}

function normalizeLegalReadiness(readiness) {
    const source = readiness && typeof readiness === 'object' ? readiness : {};
    return {
        status: normalizeString(source.status || 'blocked'),
        ready: source.ready === true,
        label: normalizeString(source.label || 'Bloqueada'),
        summary: normalizeString(source.summary),
        checklist: normalizeList(source.checklist),
        blockingReasons: normalizeList(
            source.blockingReasons || source.approvalBlockedReasons
        ),
    };
}

function normalizeDraftSnapshot(draft) {
    const defaults = emptyDraft();
    const source = draft && typeof draft === 'object' ? draft : {};
    const intakeSource =
        source.intake && typeof source.intake === 'object' ? source.intake : {};
    const clinicianSource =
        source.clinicianDraft && typeof source.clinicianDraft === 'object'
            ? source.clinicianDraft
            : {};
    const patientFactsSource =
        intakeSource.datosPaciente &&
        typeof intakeSource.datosPaciente === 'object'
            ? intakeSource.datosPaciente
            : {};

    const reviewStatus =
        normalizeString(source.reviewStatus) || defaults.reviewStatus;
    let requiresHumanReview =
        source.requiresHumanReview === undefined
            ? defaults.requiresHumanReview
            : source.requiresHumanReview === true;

    if (reviewStatus === 'approved') {
        requiresHumanReview = false;
    } else if (reviewStatus === 'review_required') {
        requiresHumanReview = true;
    }

    return {
        ...defaults,
        sessionId: normalizeString(source.sessionId),
        caseId: normalizeString(source.caseId),
        appointmentId: normalizeNullableInt(source.appointmentId),
        patientRecordId: normalizeString(source.patientRecordId),
        episodeId: normalizeString(source.episodeId),
        encounterId: normalizeString(source.encounterId),
        reviewStatus,
        requiresHumanReview,
        confidence: normalizeNumber(source.confidence),
        reviewReasons: normalizeStringList(source.reviewReasons),
        recordMeta:
            source.recordMeta && typeof source.recordMeta === 'object'
                ? {
                      ...defaults.recordMeta,
                      ...source.recordMeta,
                      archiveState: normalizeString(
                          source.recordMeta.archiveState ||
                              defaults.recordMeta.archiveState
                      ),
                      lastAttentionAt: normalizeString(
                          source.recordMeta.lastAttentionAt
                      ),
                      passiveAfterYears: Math.max(
                          1,
                          normalizeNumber(
                              source.recordMeta.passiveAfterYears ||
                                  defaults.recordMeta.passiveAfterYears
                          )
                      ),
                      confidentialityLabel: normalizeString(
                          source.recordMeta.confidentialityLabel ||
                              defaults.recordMeta.confidentialityLabel
                      ),
                      identityProtectionMode: normalizeString(
                          source.recordMeta.identityProtectionMode ||
                              defaults.recordMeta.identityProtectionMode
                      ),
                      copyDeliverySlaHours: Math.max(
                          1,
                          normalizeNumber(
                              source.recordMeta.copyDeliverySlaHours ||
                                  defaults.recordMeta.copyDeliverySlaHours
                          )
                      ),
                      formsCatalogStatus: normalizeString(
                          source.recordMeta.formsCatalogStatus ||
                              defaults.recordMeta.formsCatalogStatus
                      ),
                      confirmedForms: normalizeStringList(
                          source.recordMeta.confirmedForms ||
                              defaults.recordMeta.confirmedForms
                      ),
                      normativeScope: normalizeString(
                          source.recordMeta.normativeScope ||
                              defaults.recordMeta.normativeScope
                      ),
                  }
                : cloneValue(defaults.recordMeta),
        documents: normalizeDocuments(source.documents),
        consent: normalizeConsent(source.consent),
        approval: normalizeApproval(source.approval),
        pendingAi:
            source.pendingAi && typeof source.pendingAi === 'object'
                ? source.pendingAi
                : {},
        intake: {
            ...defaults.intake,
            motivoConsulta: normalizeString(intakeSource.motivoConsulta),
            enfermedadActual: normalizeString(intakeSource.enfermedadActual),
            antecedentes: normalizeString(intakeSource.antecedentes),
            alergias: normalizeString(intakeSource.alergias),
            medicacionActual: normalizeString(intakeSource.medicacionActual),
            rosRedFlags: normalizeStringList(intakeSource.rosRedFlags),
            adjuntos: normalizeList(intakeSource.adjuntos).map(
                normalizeAttachment
            ),
            resumenClinico: normalizeString(intakeSource.resumenClinico),
            cie10Sugeridos: normalizeStringList(intakeSource.cie10Sugeridos),
            tratamientoBorrador: normalizeString(
                intakeSource.tratamientoBorrador
            ),
            posologiaBorrador: normalizePosology(
                intakeSource.posologiaBorrador
            ),
            preguntasFaltantes: normalizeStringList(
                intakeSource.preguntasFaltantes
            ),
            datosPaciente: {
                edadAnios: normalizeNullableInt(patientFactsSource.edadAnios),
                pesoKg: normalizeNullableFloat(patientFactsSource.pesoKg),
                sexoBiologico: normalizeString(
                    patientFactsSource.sexoBiologico
                ),
                embarazo:
                    patientFactsSource.embarazo === null ||
                    patientFactsSource.embarazo === undefined
                        ? null
                        : patientFactsSource.embarazo === true,
            },
        },
        clinicianDraft: {
            ...defaults.clinicianDraft,
            resumen: normalizeString(
                clinicianSource.resumen || clinicianSource.resumenClinico
            ),
            preguntasFaltantes: normalizeStringList(
                clinicianSource.preguntasFaltantes
            ),
            cie10Sugeridos: normalizeStringList(clinicianSource.cie10Sugeridos),
            tratamientoBorrador: normalizeString(
                clinicianSource.tratamientoBorrador
            ),
            posologiaBorrador: normalizePosology(
                clinicianSource.posologiaBorrador
            ),
        },
        updatedAt: normalizeString(source.updatedAt),
        createdAt: normalizeString(source.createdAt),
    };
}

function normalizeEvent(event) {
    const source = event && typeof event === 'object' ? event : {};
    return {
        eventId: normalizeString(source.eventId),
        sessionId: normalizeString(source.sessionId),
        type: normalizeString(source.type),
        severity: normalizeString(source.severity || 'info'),
        status: normalizeString(source.status || 'open'),
        title: normalizeString(source.title),
        message: normalizeString(source.message),
        requiresAction: source.requiresAction === true,
        occurredAt: normalizeString(source.occurredAt || source.createdAt),
        acknowledgedAt: normalizeString(source.acknowledgedAt),
        resolvedAt: normalizeString(source.resolvedAt),
        patient: normalizePatient(source.patient),
    };
}

function normalizeReviewQueueItem(item) {
    const source = item && typeof item === 'object' ? item : {};
    const severity = normalizeString(source.highestOpenSeverity).toLowerCase();
    return {
        sessionId: normalizeString(source.sessionId),
        caseId: normalizeString(source.caseId),
        appointmentId: normalizeNullableInt(source.appointmentId),
        surface: normalizeString(source.surface),
        sessionStatus: normalizeString(source.sessionStatus),
        reviewStatus: normalizeString(source.reviewStatus),
        requiresHumanReview: source.requiresHumanReview !== false,
        confidence: normalizeNumber(source.confidence),
        reviewReasons: normalizeStringList(source.reviewReasons),
        missingFields: normalizeStringList(source.missingFields),
        redFlags: normalizeStringList(source.redFlags),
        pendingAiStatus: normalizeString(source.pendingAiStatus),
        pendingAiJobId: normalizeString(source.pendingAiJobId),
        patientName: normalizeString(source.patientName),
        patientEmail: normalizeString(source.patientEmail),
        patientPhone: normalizeString(source.patientPhone),
        attachmentCount: Math.max(0, normalizeNumber(source.attachmentCount)),
        openEventCount: Math.max(0, normalizeNumber(source.openEventCount)),
        highestOpenSeverity: ['critical', 'warning', 'info'].includes(severity)
            ? severity
            : '',
        latestOpenEventTitle: normalizeString(source.latestOpenEventTitle),
        legalReadinessStatus: normalizeString(source.legalReadinessStatus),
        legalReadinessLabel: normalizeString(source.legalReadinessLabel),
        legalReadinessSummary: normalizeString(source.legalReadinessSummary),
        approvalBlockedReasons: normalizeList(source.approvalBlockedReasons),
        summary: normalizeString(source.summary),
        createdAt: normalizeString(source.createdAt),
        updatedAt: normalizeString(source.updatedAt),
    };
}

function normalizeReviewPayload(payload) {
    const review = emptyReview();
    const source = payload && typeof payload === 'object' ? payload : {};
    const sessionSource =
        source.session && typeof source.session === 'object'
            ? source.session
            : {};

    review.session = {
        ...review.session,
        sessionId: normalizeString(sessionSource.sessionId),
        caseId: normalizeString(sessionSource.caseId),
        appointmentId: normalizeNullableInt(sessionSource.appointmentId),
        surface: normalizeString(sessionSource.surface),
        status: normalizeString(sessionSource.status),
        patient: normalizePatient(sessionSource.patient),
        transcript: normalizeList(sessionSource.transcript).map(
            normalizeTranscriptMessage
        ),
        pendingAi:
            sessionSource.pendingAi &&
            typeof sessionSource.pendingAi === 'object'
                ? sessionSource.pendingAi
                : {},
        metadata:
            sessionSource.metadata && typeof sessionSource.metadata === 'object'
                ? sessionSource.metadata
                : {},
        createdAt: normalizeString(sessionSource.createdAt),
        updatedAt: normalizeString(sessionSource.updatedAt),
        lastMessageAt: normalizeString(sessionSource.lastMessageAt),
    };
    review.draft = normalizeDraftSnapshot(source.draft);
    review.events = normalizeList(source.events).map(normalizeEvent);
    review.patientRecord =
        source.patientRecord && typeof source.patientRecord === 'object'
            ? source.patientRecord
            : {};
    review.activeEpisode =
        source.activeEpisode && typeof source.activeEpisode === 'object'
            ? source.activeEpisode
            : {};
    review.encounter =
        source.encounter && typeof source.encounter === 'object'
            ? source.encounter
            : {};
    review.documents = normalizeDocuments(
        source.documents || review.draft.documents
    );
    review.consent = normalizeConsent(source.consent || review.draft.consent);
    review.approval = normalizeApproval(
        source.approval || review.draft.approval
    );
    review.approvalState = normalizeApproval(
        source.approvalState || source.approval || review.draft.approval
    );
    review.legalReadiness = normalizeLegalReadiness(
        source.legalReadiness || source.closureChecklist
    );
    review.approvalBlockedReasons = normalizeList(
        source.approvalBlockedReasons || review.legalReadiness.blockingReasons
    );
    review.closureChecklist =
        source.closureChecklist && typeof source.closureChecklist === 'object'
            ? source.closureChecklist
            : review.legalReadiness;
    review.recordsGovernance = normalizeRecordsGovernance(
        source.recordsGovernance
    );
    review.accessAudit = normalizeList(source.accessAudit).map(
        normalizeAccessAuditEntry
    );
    review.disclosureLog = normalizeList(source.disclosureLog).map(
        normalizeDisclosureEntry
    );
    review.copyRequests = normalizeList(source.copyRequests).map(
        normalizeCopyRequest
    );
    review.archiveReadiness = normalizeArchiveReadiness(
        source.archiveReadiness ||
            review.recordsGovernance.archiveReadiness ||
            review.patientRecord?.archiveReadiness
    );
    review.auditSummary =
        source.auditSummary && typeof source.auditSummary === 'object'
            ? source.auditSummary
            : {};
    return review;
}

function readClinicalHistoryMeta(state = getState()) {
    const source =
        state?.data?.clinicalHistoryMeta &&
        typeof state.data.clinicalHistoryMeta === 'object'
            ? state.data.clinicalHistoryMeta
            : {};
    return {
        ...source,
        reviewQueue: normalizeList(source.reviewQueue).map(
            normalizeReviewQueueItem
        ),
    };
}

function getClinicalHistorySlice(state = getState()) {
    return state?.clinicalHistory && typeof state.clinicalHistory === 'object'
        ? state.clinicalHistory
        : {};
}

function currentActiveWorkspace(state = getState()) {
    return (
        readWorkspaceQuery() ||
        normalizeClinicalHistoryWorkspace(
            getClinicalHistorySlice(state).activeWorkspace
        )
    );
}

function currentQueueFilter(state = getState()) {
    return normalizeClinicalQueueFilter(
        getClinicalHistorySlice(state).queueFilter
    );
}

function setClinicalHistoryState(patch) {
    updateState((state) => ({
        ...state,
        clinicalHistory: {
            ...state.clinicalHistory,
            ...patch,
        },
    }));
}

function setActiveClinicalWorkspace(workspace, options = {}) {
    const next = normalizeClinicalHistoryWorkspace(workspace);
    setClinicalHistoryState({
        activeWorkspace: next,
    });
    if (options.syncQuery !== false) {
        setQueryParam(CLINICAL_HISTORY_WORKSPACE_QUERY_PARAM, next);
    }
    if (options.render !== false) {
        renderClinicalHistorySection();
    }
    return next;
}

function setClinicalQueueFilter(filter, options = {}) {
    setClinicalHistoryState({
        queueFilter: normalizeClinicalQueueFilter(filter),
    });
    if (options.render !== false) {
        renderClinicalHistorySection();
    }
}

function formatReviewStatus(status) {
    switch (normalizeString(status).toLowerCase()) {
        case 'approved':
            return 'Aprobada';
        case 'ready_for_review':
            return 'Lista para revisar';
        case 'review_required':
            return 'Revision requerida';
        case 'draft_ready':
            return 'Borrador listo';
        default:
            return 'Pendiente';
    }
}

function formatSeverity(severity) {
    switch (normalizeString(severity).toLowerCase()) {
        case 'critical':
            return 'Critico';
        case 'warning':
            return 'Alerta';
        default:
            return 'Info';
    }
}

function formatPendingAiStatus(status) {
    switch (normalizeString(status).toLowerCase()) {
        case 'queued':
            return 'IA en cola';
        case 'processing':
            return 'IA procesando';
        case 'completed':
            return 'IA conciliada';
        case 'failed':
            return 'IA fallo';
        default:
            return '';
    }
}

function formatConfidence(confidence) {
    const safeConfidence = normalizeNumber(confidence);
    if (safeConfidence <= 0) {
        return 'Sin confianza';
    }

    return `${Math.round(safeConfidence * 100)}% confianza`;
}

function formatTone(
    status,
    requiresHumanReview,
    pendingAiStatus,
    highestOpenSeverity = ''
) {
    if (normalizeString(highestOpenSeverity) === 'critical') {
        return 'danger';
    }
    if (normalizeString(highestOpenSeverity) === 'warning') {
        return 'warning';
    }
    if (normalizeString(pendingAiStatus) !== '') {
        return 'warning';
    }
    if (normalizeString(status) === 'approved') {
        return 'success';
    }
    if (requiresHumanReview) {
        return 'warning';
    }
    return 'neutral';
}

function transcriptActorLabel(message) {
    switch (normalizeString(message.actor).toLowerCase()) {
        case 'clinical_intake':
            return 'IA';
        case 'clinician_review':
            return 'Medico';
        default:
            return 'Paciente';
    }
}

function transcriptActorTone(message) {
    switch (normalizeString(message.actor).toLowerCase()) {
        case 'clinical_intake':
            return 'assistant';
        case 'clinician_review':
            return 'review';
        default:
            return 'patient';
    }
}

function listToTextarea(value) {
    return normalizeStringList(value).join('\n');
}

function serializeTextareaLines(value) {
    return String(value || '')
        .split(/\r?\n/)
        .map((item) => normalizeString(item))
        .filter(Boolean);
}

function readableTimestamp(value) {
    const text = normalizeString(value);
    return text ? formatDateTime(text) : '-';
}

function currentSelectionLabel(review) {
    const patientName = normalizeString(review.session.patient.name);
    if (patientName) {
        return patientName;
    }

    const caseId = normalizeString(review.session.caseId);
    if (caseId) {
        return `Caso ${caseId}`;
    }

    return 'Sin seleccion';
}

function currentReviewSource(state = getState()) {
    const slice = getClinicalHistorySlice(state);
    if (slice.current && typeof slice.current === 'object') {
        return normalizeReviewPayload(slice.current);
    }

    return emptyReview();
}

function currentDraftSource(state = getState()) {
    const slice = getClinicalHistorySlice(state);
    if (slice.draftForm && typeof slice.draftForm === 'object') {
        return normalizeDraftSnapshot(slice.draftForm);
    }

    return currentReviewSource(state).draft;
}

function truncateText(value, limit = 120) {
    const text = normalizeString(value);
    if (text.length <= limit) {
        return text;
    }

    return `${text.slice(0, Math.max(0, limit - 1)).trim()}...`;
}

function formatBytes(value) {
    const size = normalizeNumber(value);
    if (size <= 0) {
        return '0 B';
    }
    if (size < 1024) {
        return `${Math.round(size)} B`;
    }
    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPregnancy(value) {
    if (value === true) {
        return 'Embarazo reportado';
    }
    if (value === false) {
        return 'Sin embarazo';
    }
    return 'Embarazo no documentado';
}

function pregnancySelectValue(value) {
    if (value === true) {
        return 'yes';
    }
    if (value === false) {
        return 'no';
    }
    return '';
}

function normalizePregnancyValue(value) {
    const normalized = normalizeString(value).toLowerCase();
    if (normalized === 'yes') {
        return true;
    }
    if (normalized === 'no') {
        return false;
    }
    return null;
}

function formatPatientFacts(patient, intake) {
    const age = normalizeNullableInt(
        intake?.datosPaciente?.edadAnios ?? patient.ageYears
    );
    const weight = normalizeNullableFloat(
        intake?.datosPaciente?.pesoKg ?? patient.weightKg
    );
    const sex =
        normalizeString(intake?.datosPaciente?.sexoBiologico) ||
        normalizeString(patient.sexAtBirth) ||
        'Sin sexo biologico';
    const pregnancy =
        intake?.datosPaciente?.embarazo !== undefined
            ? intake.datosPaciente.embarazo
            : patient.pregnant;

    return [
        age !== null ? `${age} anos` : '',
        weight !== null ? `${weight} kg` : '',
        sex,
        formatPregnancy(pregnancy),
    ]
        .filter(Boolean)
        .join(' • ');
}

function formatHtmlMultiline(value) {
    const safe = escapeHtml(normalizeString(value));
    return safe ? safe.replace(/\n/g, '<br>') : '';
}

function buildClinicalHistoryFieldHint(hint) {
    return hint
        ? `<small>${escapeHtml(hint)}</small>`
        : '<small>&nbsp;</small>';
}

function buildClinicalHistoryFieldShell(id, label, content, hint = '') {
    return `
        <label class="clinical-history-field" for="${escapeHtml(id)}">
            <span>${escapeHtml(label)}</span>
            ${content}
            ${buildClinicalHistoryFieldHint(hint)}
        </label>
    `;
}

function buildClinicalHistoryChoiceOptions(choices, value) {
    return choices
        .map(
            (choice) => `
                <option
                    value="${escapeHtml(choice.value)}"
                    ${
                        normalizeString(choice.value) === normalizeString(value)
                            ? 'selected'
                            : ''
                    }
                >
                    ${escapeHtml(choice.label)}
                </option>
            `
        )
        .join('');
}

function summaryStatCard(title, value, meta, tone = 'neutral') {
    return `
        <article class="clinical-history-stat-card" data-tone="${escapeHtml(
            tone
        )}">
            <span>${escapeHtml(title)}</span>
            <strong>${escapeHtml(value)}</strong>
            <small>${escapeHtml(meta)}</small>
        </article>
    `;
}

function setButtonDisabled(buttonId, disabled) {
    const button = document.getElementById(buttonId);
    if (button instanceof HTMLButtonElement) {
        button.disabled = disabled;
    }
}

function buildSummaryCards(review) {
    const patient = review.session.patient;
    const draft = review.draft;
    const readiness = normalizeLegalReadiness(review.legalReadiness);
    const pendingAiStatus = formatPendingAiStatus(
        review.session.pendingAi?.status || draft.pendingAi?.status
    );
    const statusTone = formatTone(
        draft.reviewStatus,
        draft.requiresHumanReview,
        pendingAiStatus,
        highestReviewEventSeverity(review)
    );
    const checklistFailures = normalizeList(readiness.checklist).filter(
        (item) => normalizeString(item?.status) !== 'pass'
    );

    const cards = [
        {
            title: 'Paciente',
            value: currentSelectionLabel(review),
            meta: patient.email || patient.phone || 'Sin contacto documentado',
        },
        {
            title: 'Estado legal',
            value: readiness.label || 'Bloqueada',
            meta: pendingAiStatus || readiness.summary || 'Sin resumen legal',
            tone: statusTone,
        },
        {
            title: 'Cierre',
            value:
                normalizeString(review.approvalState?.status) === 'approved'
                    ? 'Aprobada'
                    : draft.requiresHumanReview
                      ? 'Firma humana'
                      : 'Pendiente',
            meta:
                normalizeString(review.approvalState?.approvedAt) !== ''
                    ? `Constancia ${readableTimestamp(
                          review.approvalState.approvedAt
                      )}`
                    : 'Sin constancia de aprobacion final',
            tone:
                normalizeString(review.approvalState?.status) === 'approved'
                    ? 'success'
                    : 'warning',
        },
        {
            title: 'Checklist',
            value: `${checklistFailures.length}`,
            meta:
                checklistFailures.length > 0
                    ? 'Bloqueo(s) medico-legales visibles'
                    : 'Sin bloqueos activos',
            tone: checklistFailures.length > 0 ? 'warning' : 'success',
        },
        {
            title: 'Paciente facts',
            value: formatConfidence(draft.confidence),
            meta:
                formatPatientFacts(patient, draft.intake) ||
                'Sin datos clinicos base',
        },
        {
            title: 'Consentimiento',
            value: normalizeString(review.consent?.status || 'not_required'),
            meta:
                review.consent?.required === true
                    ? 'Consentimiento exigible para este episodio'
                    : 'No exigible en este episodio',
            tone:
                review.consent?.required === true &&
                normalizeString(review.consent?.status) !== 'accepted'
                    ? 'warning'
                    : 'success',
        },
        {
            title: 'Actividad',
            value: readableTimestamp(
                review.session.lastMessageAt ||
                    review.session.updatedAt ||
                    draft.updatedAt
            ),
            meta: review.session.surface || 'Sin superficie',
        },
    ];

    return cards
        .map(({ title, value, meta, tone }) =>
            summaryStatCard(title, value, meta, tone)
        )
        .join('');
}

function buildEmptyClinicalCard(title, message, options = {}) {
    const { cardClass = 'clinical-history-empty-card', tone = '' } = options;

    return `
        <article class="${escapeHtml(cardClass)}"${
            tone ? ` data-tone="${escapeHtml(tone)}"` : ''
        }>
            <strong>${escapeHtml(title)}</strong>
            <p>${escapeHtml(message)}</p>
        </article>
    `;
}

function buildClinicalHistoryCollection(items, emptyRenderer, renderItem) {
    const list = normalizeList(items);
    if (list.length === 0) {
        return typeof emptyRenderer === 'function' ? emptyRenderer() : '';
    }

    return list.map(renderItem).join('');
}

function buildAttachmentStrip(review) {
    return buildClinicalHistoryCollection(
        review.draft.intake.adjuntos,
        () =>
            buildEmptyClinicalCard(
                'Sin adjuntos clinicos',
                'Las fotos y documentos privados del caso apareceran aqui.',
                { cardClass: 'clinical-history-attachment-card is-empty' }
            ),
        (attachment) => {
            const details = [
                normalizeString(attachment.kind) || 'archivo',
                normalizeString(attachment.mime),
                formatBytes(attachment.size),
            ]
                .filter(Boolean)
                .join(' • ');

            return `
                <article class="clinical-history-attachment-card">
                    <strong>${escapeHtml(
                        attachment.originalName ||
                            `Adjunto ${attachment.id || ''}`
                    )}</strong>
                    <small>${escapeHtml(details || 'Adjunto privado')}</small>
                    <span>${escapeHtml(
                        attachment.privatePath || 'Disponible solo para staff'
                    )}</span>
                </article>
            `;
        }
    );
}

function buildLegalReadinessPanel(review) {
    const readiness = normalizeLegalReadiness(review.legalReadiness);
    const checklist = normalizeList(readiness.checklist);

    if (checklist.length === 0) {
        return buildEmptyClinicalCard(
            'Aptitud de cierre',
            'La aptitud medico-legal del episodio aparecera aqui cuando exista un caso activo.'
        );
    }

    return `
        <article class="clinical-history-readiness-card" data-tone="${escapeHtml(
            readiness.ready ? 'success' : 'warning'
        )}">
            <header class="section-header">
                <div>
                    <h4>Aptitud de cierre</h4>
                    <p>${escapeHtml(
                        readiness.summary ||
                            'Checklist medico-legal del episodio activo.'
                    )}</p>
                </div>
                <span class="clinical-history-mini-chip" data-tone="${escapeHtml(
                    readiness.ready ? 'success' : 'warning'
                )}">
                    ${escapeHtml(readiness.label || 'Bloqueada')}
                </span>
            </header>
            <div class="clinical-history-events">
                ${checklist
                    .map(
                        (item) => `
                            <article
                                class="clinical-history-event-card"
                                data-tone="${escapeHtml(
                                    normalizeString(item?.status) === 'pass'
                                        ? 'success'
                                        : 'warning'
                                )}"
                            >
                                <div class="clinical-history-event-head">
                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                        normalizeString(
                                            item?.label || item?.code
                                        )
                                    )}</span>
                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                        normalizeString(item?.status) === 'pass'
                                            ? 'OK'
                                            : 'Bloquea'
                                    )}</span>
                                </div>
                                <p>${escapeHtml(
                                    normalizeString(item?.message) ||
                                        'Sin detalle adicional.'
                                )}</p>
                            </article>
                        `
                    )
                    .join('')}
            </div>
        </article>
    `;
}

function buildApprovalConstancy(review) {
    const approval = normalizeApproval(review.approvalState || review.approval);
    if (approval.status !== 'approved') {
        return buildEmptyClinicalCard(
            'Constancia de aprobacion',
            'Cuando la nota final quede aprobada, aqui se mostrara quien la aprobo, cuando y con que checklist.'
        );
    }

    return `
        <article class="clinical-history-readiness-card" data-tone="success">
            <header class="section-header">
                <div>
                    <h4>Constancia de aprobacion</h4>
                    <p>Version clinica defendible ya cerrada para este episodio.</p>
                </div>
                <span class="clinical-history-mini-chip" data-tone="success">
                    Aprobada
                </span>
            </header>
            <div class="clinical-history-summary-grid">
                ${summaryStatCard(
                    'Aprobador',
                    approval.approvedBy || 'Sin dato',
                    'Responsable humano final',
                    'success'
                )}
                ${summaryStatCard(
                    'Fecha',
                    readableTimestamp(approval.approvedAt),
                    'Marca temporal de cierre',
                    'success'
                )}
                ${summaryStatCard(
                    'Version',
                    String(approval.finalDraftVersion || '-'),
                    'Version aprobada',
                    'success'
                )}
                ${summaryStatCard(
                    'Checklist',
                    String(normalizeList(approval.checklistSnapshot).length),
                    'Snapshot de validaciones',
                    'success'
                )}
            </div>
        </article>
    `;
}

function formatDisclosureTarget(targetType) {
    switch (normalizeString(targetType)) {
        case 'companion':
            return 'Acompanante';
        case 'external_third_party':
            return 'Tercero externo';
        default:
            return 'Paciente';
    }
}

function buildRecordsGovernancePanel(review, saving = false) {
    if (!normalizeString(review.session.sessionId)) {
        return buildEmptyClinicalCard(
            'Gobernanza documental',
            'La custodia del record, las copias certificadas y los disclosures apareceran aqui cuando exista un episodio activo.'
        );
    }

    const governance = normalizeRecordsGovernance(review.recordsGovernance);
    const archiveReadiness = normalizeArchiveReadiness(
        review.archiveReadiness || governance.archiveReadiness
    );
    const copyRequests = normalizeList(review.copyRequests).map(
        normalizeCopyRequest
    );
    const disclosures = normalizeList(review.disclosureLog).map(
        normalizeDisclosureEntry
    );
    const accessAudit = normalizeList(review.accessAudit).map(
        normalizeAccessAuditEntry
    );
    const latestCopy = copyRequests[0] || normalizeCopyRequest({});
    const latestDisclosure = disclosures[0] || normalizeDisclosureEntry({});
    const latestAccess = accessAudit[0] || normalizeAccessAuditEntry({});
    const tone =
        archiveReadiness.archiveState === 'passive'
            ? 'neutral'
            : governance.copyRequestSummary.overdue > 0
              ? 'warning'
              : archiveReadiness.eligibleForPassive
                ? 'success'
                : 'neutral';

    const recentCopyCards = buildClinicalHistoryCollection(
        copyRequests.slice(0, 3),
        () =>
            buildEmptyClinicalCard(
                'Sin solicitudes de copia',
                'Todavia no hay solicitudes de copia certificada registradas para este record.',
                { cardClass: 'clinical-history-event-card is-empty' }
            ),
        (request) => `
            <article class="clinical-history-event-card" data-tone="${escapeHtml(
                request.effectiveStatus === 'overdue'
                    ? 'warning'
                    : request.effectiveStatus === 'delivered'
                      ? 'success'
                      : 'neutral'
            )}">
                <div class="clinical-history-event-head">
                    <span class="clinical-history-mini-chip">${escapeHtml(
                        request.statusLabel
                    )}</span>
                    <span class="clinical-history-mini-chip">${escapeHtml(
                        request.requestedByType || 'patient'
                    )}</span>
                </div>
                <strong>${escapeHtml(
                    request.requestedByName || 'Solicitante sin nombre'
                )}</strong>
                <p>${escapeHtml(
                    request.deliveredAt
                        ? `Entregada a ${request.deliveredTo || 'destinatario documentado'}`
                        : `Vence ${readableTimestamp(request.dueAt)}`
                )}</p>
                <small>${escapeHtml(
                    [
                        request.requestId,
                        readableTimestamp(request.requestedAt),
                        request.deliveryChannel,
                    ]
                        .filter(Boolean)
                        .join(' • ') || 'Sin metadata adicional'
                )}</small>
            </article>
        `
    );

    const recentDisclosureCards = buildClinicalHistoryCollection(
        disclosures.slice(0, 3),
        () =>
            buildEmptyClinicalCard(
                'Sin disclosures registrados',
                'Aun no hay entregas o comparticiones documentadas para este episodio.',
                { cardClass: 'clinical-history-event-card is-empty' }
            ),
        (entry) => `
            <article class="clinical-history-event-card" data-tone="${escapeHtml(
                entry.targetType === 'external_third_party'
                    ? 'warning'
                    : 'neutral'
            )}">
                <div class="clinical-history-event-head">
                    <span class="clinical-history-mini-chip">${escapeHtml(
                        formatDisclosureTarget(entry.targetType)
                    )}</span>
                    <span class="clinical-history-mini-chip">${escapeHtml(
                        entry.authorizedByConsent === true
                            ? 'Consentido'
                            : 'Registrado'
                    )}</span>
                </div>
                <strong>${escapeHtml(
                    entry.targetName || 'Destinatario no documentado'
                )}</strong>
                <p>${escapeHtml(
                    entry.purpose || 'Disclosure sin proposito documentado.'
                )}</p>
                <small>${escapeHtml(
                    [
                        entry.performedBy,
                        readableTimestamp(entry.performedAt),
                        entry.channel,
                    ]
                        .filter(Boolean)
                        .join(' • ') || 'Sin metadata adicional'
                )}</small>
            </article>
        `
    );

    const recentAccessCards = buildClinicalHistoryCollection(
        accessAudit.slice(0, 3),
        () =>
            buildEmptyClinicalCard(
                'Sin auditoria visible',
                'La auditoria persistente aparecera aqui en cuanto se registren accesos o cambios del record.',
                { cardClass: 'clinical-history-event-card is-empty' }
            ),
        (entry) => `
            <article class="clinical-history-event-card">
                <div class="clinical-history-event-head">
                    <span class="clinical-history-mini-chip">${escapeHtml(
                        entry.action || 'view_record'
                    )}</span>
                    <span class="clinical-history-mini-chip">${escapeHtml(
                        entry.actorRole || 'clinician_admin'
                    )}</span>
                </div>
                <strong>${escapeHtml(entry.actor || 'Actor no documentado')}</strong>
                <p>${escapeHtml(entry.reason || 'Accion sobre el record clinico.')}</p>
                <small>${escapeHtml(
                    readableTimestamp(entry.createdAt) || 'Sin timestamp'
                )}</small>
            </article>
        `
    );

    return `
        <article class="clinical-history-readiness-card" data-tone="${escapeHtml(
            tone
        )}">
            <header class="section-header">
                <div>
                    <h4>Gobernanza documental</h4>
                    <p>Custodia, disclosure, copia certificada y auditoria del record activo.</p>
                </div>
                <span class="clinical-history-mini-chip" data-tone="${escapeHtml(
                    archiveReadiness.archiveState === 'passive'
                        ? 'neutral'
                        : archiveReadiness.eligibleForPassive
                          ? 'success'
                          : 'warning'
                )}">
                    ${escapeHtml(archiveReadiness.label || 'Activa')}
                </span>
            </header>
            <div class="clinical-history-summary-grid">
                ${summaryStatCard(
                    'Custodia',
                    archiveReadiness.label || 'Activa',
                    archiveReadiness.eligibleForPassive
                        ? 'Ya puede pasar a archivo pasivo'
                        : archiveReadiness.eligibleAt
                          ? `Elegible ${readableTimestamp(archiveReadiness.eligibleAt)}`
                          : 'Regla de 5 anos desde la ultima atencion',
                    archiveReadiness.eligibleForPassive ? 'success' : 'neutral'
                )}
                ${summaryStatCard(
                    'Copias',
                    String(governance.copyRequestSummary.pending || 0),
                    governance.copyRequestSummary.overdue > 0
                        ? `${governance.copyRequestSummary.overdue} vencida(s)`
                        : latestCopy.requestId
                          ? `Ultima ${latestCopy.statusLabel.toLowerCase()}`
                          : 'Sin solicitudes activas',
                    governance.copyRequestSummary.overdue > 0
                        ? 'warning'
                        : 'neutral'
                )}
                ${summaryStatCard(
                    'Disclosure',
                    String(governance.disclosureSummary.total || 0),
                    latestDisclosure.disclosureId
                        ? `${formatDisclosureTarget(
                              latestDisclosure.targetType
                          )} • ${readableTimestamp(latestDisclosure.performedAt)}`
                        : 'Sin registros recientes',
                    governance.disclosureSummary.total > 0
                        ? 'neutral'
                        : 'success'
                )}
                ${summaryStatCard(
                    'Ultimo acceso',
                    latestAccess.createdAt
                        ? readableTimestamp(latestAccess.createdAt)
                        : '-',
                    latestAccess.actor || 'Sin lectura registrada',
                    latestAccess.createdAt ? 'neutral' : 'success'
                )}
            </div>
            <div class="clinical-history-form-grid">
                ${buildClinicalHistorySection(
                    'Solicitudes de copia',
                    'Registra y entrega copias certificadas con SLA visible de 48 horas.',
                    `
                        ${buildClinicalHistoryInlineGrid([
                            selectField(
                                'governance_copy_requested_by_type',
                                'Solicitada por',
                                'patient',
                                [
                                    { value: 'patient', label: 'Paciente' },
                                    {
                                        value: 'companion',
                                        label: 'Acompanante',
                                    },
                                    {
                                        value: 'external_third_party',
                                        label: 'Tercero externo',
                                    },
                                ],
                                { disabled: saving }
                            ),
                            inputField(
                                'governance_copy_requested_by_name',
                                'Nombre del solicitante',
                                '',
                                {
                                    placeholder: 'Ej.: Ana Ruiz',
                                    disabled: saving,
                                }
                            ),
                        ])}
                        ${buildClinicalHistoryInlineGrid([
                            inputField(
                                'governance_copy_legal_basis',
                                'Base legal',
                                '',
                                {
                                    placeholder:
                                        'Opcional para paciente / obligatoria si aplica',
                                    disabled: saving,
                                }
                            ),
                            inputField(
                                'governance_copy_request_id',
                                'Request ID para entrega',
                                latestCopy.requestId || '',
                                {
                                    placeholder: 'Ej.: copy-123',
                                    disabled: saving,
                                }
                            ),
                        ])}
                        ${textareaField(
                            'governance_copy_notes',
                            'Notas de la solicitud',
                            '',
                            {
                                rows: 3,
                                placeholder:
                                    'Motivo, soporte o condicion de entrega.',
                                disabled: saving,
                            }
                        )}
                        ${buildClinicalHistoryInlineGrid([
                            inputField(
                                'governance_copy_delivered_to',
                                'Entregar a',
                                latestCopy.deliveredTo || '',
                                {
                                    placeholder: 'Ej.: Paciente titular',
                                    disabled: saving,
                                }
                            ),
                            inputField(
                                'governance_copy_delivery_channel',
                                'Canal de entrega',
                                '',
                                {
                                    placeholder: 'Ej.: retiro_fisico',
                                    disabled: saving,
                                }
                            ),
                        ])}
                        <div class="toolbar-row clinical-history-actions-row">
                            <button
                                type="button"
                                id="clinicalHistoryRequestCertifiedCopyBtn"
                                data-clinical-review-action="request-certified-copy"
                            >
                                Solicitar copia certificada
                            </button>
                            <button
                                type="button"
                                id="clinicalHistoryDeliverCertifiedCopyBtn"
                                data-clinical-review-action="deliver-certified-copy"
                            >
                                Marcar entrega
                            </button>
                        </div>
                        <div class="clinical-history-events">${recentCopyCards}</div>
                    `
                )}
                ${buildClinicalHistorySection(
                    'Disclosure y archivo',
                    'Registra disclosure conservador y custodia del expediente sin perder el contexto clinico.',
                    `
                        ${buildClinicalHistoryInlineGrid([
                            selectField(
                                'governance_disclosure_target_type',
                                'Disclosure a',
                                'patient',
                                [
                                    { value: 'patient', label: 'Paciente' },
                                    {
                                        value: 'companion',
                                        label: 'Acompanante',
                                    },
                                    {
                                        value: 'external_third_party',
                                        label: 'Tercero externo',
                                    },
                                ],
                                { disabled: saving }
                            ),
                            inputField(
                                'governance_disclosure_target_name',
                                'Nombre del destinatario',
                                '',
                                {
                                    placeholder: 'Ej.: Familiar autorizado',
                                    disabled: saving,
                                }
                            ),
                        ])}
                        ${buildClinicalHistoryInlineGrid([
                            inputField(
                                'governance_disclosure_purpose',
                                'Proposito',
                                '',
                                {
                                    placeholder:
                                        'Ej.: entrega de indicaciones o copia clinica',
                                    disabled: saving,
                                }
                            ),
                            inputField(
                                'governance_disclosure_channel',
                                'Canal',
                                '',
                                {
                                    placeholder: 'Ej.: entrega_privada',
                                    disabled: saving,
                                }
                            ),
                        ])}
                        ${inputField(
                            'governance_disclosure_legal_basis',
                            'Base legal del disclosure',
                            '',
                            {
                                placeholder:
                                    'Obligatoria para terceros externos',
                                disabled: saving,
                            }
                        )}
                        ${textareaField(
                            'governance_disclosure_notes',
                            'Notas del disclosure',
                            '',
                            {
                                rows: 3,
                                placeholder:
                                    'Detalle breve de lo compartido y contexto.',
                                disabled: saving,
                            }
                        )}
                        ${textareaField(
                            'governance_archive_override_reason',
                            'Razon de override para archivo pasivo',
                            '',
                            {
                                rows: 2,
                                placeholder:
                                    'Usalo solo si aun no es elegible y necesitas forzar el cambio con justificacion.',
                                disabled: saving,
                            }
                        )}
                        <div class="toolbar-row clinical-history-actions-row">
                            <button
                                type="button"
                                id="clinicalHistoryLogDisclosureBtn"
                                data-clinical-review-action="log-disclosure"
                            >
                                Registrar disclosure
                            </button>
                            <button
                                type="button"
                                id="clinicalHistorySetPassiveArchiveBtn"
                                data-clinical-review-action="set-passive-archive"
                            >
                                Pasar a archivo pasivo
                            </button>
                        </div>
                        <div class="clinical-history-events">${recentDisclosureCards}</div>
                        <div class="clinical-history-events">${recentAccessCards}</div>
                    `
                )}
            </div>
        </article>
    `;
}

function queueReasons(item) {
    return [
        ...normalizeStringList(item.missingFields),
        ...normalizeStringList(item.reviewReasons),
        ...normalizeStringList(item.redFlags),
    ];
}

function queueAlertMeta(item) {
    const openEventCount = Math.max(0, normalizeNumber(item.openEventCount));
    if (openEventCount <= 0) {
        return '';
    }
    const severity = normalizeString(item.highestOpenSeverity);
    const label = severity ? formatSeverity(severity) : 'Evento';
    return `${openEventCount} ${label.toLowerCase()}(s) abierto(s)`;
}

function reviewQueueMatchesFilter(item, filter) {
    switch (normalizeClinicalQueueFilter(filter)) {
        case 'ready_to_approve':
            return normalizeString(item.legalReadinessStatus) === 'ready';
        case 'consent':
            return normalizeList(item.approvalBlockedReasons).some((reason) =>
                ['consent_incomplete', 'consent_revoked'].includes(
                    normalizeString(reason?.code)
                )
            );
        case 'review_required':
            return (
                item.requiresHumanReview === true ||
                [
                    'review_required',
                    'pending_review',
                    'ready_for_review',
                ].includes(normalizeString(item.reviewStatus))
            );
        case 'pending_ai':
            return normalizeString(item.pendingAiStatus) !== '';
        case 'alert':
            return (
                ['critical', 'warning'].includes(
                    normalizeString(item.highestOpenSeverity)
                ) || Math.max(0, normalizeNumber(item.openEventCount)) > 0
            );
        default:
            return true;
    }
}

export function filterClinicalReviewQueue(reviewQueue, filter) {
    const normalizedFilter = normalizeClinicalQueueFilter(filter);
    return normalizeList(reviewQueue)
        .map(normalizeReviewQueueItem)
        .filter((item) => reviewQueueMatchesFilter(item, normalizedFilter));
}

function queueFilterLabel(filter) {
    switch (normalizeClinicalQueueFilter(filter)) {
        case 'ready_to_approve':
            return 'Lista para aprobar';
        case 'pending_ai':
            return 'IA';
        case 'consent':
            return 'Consentimiento';
        case 'alert':
            return 'Alertas';
        default:
            return 'Todos';
    }
}

function buildQueueFilterChips(meta, activeFilter) {
    const reviewQueue = normalizeList(meta.reviewQueue).map(
        normalizeReviewQueueItem
    );
    return CLINICAL_HISTORY_QUEUE_FILTER_OPTIONS.map(({ id, label }) => {
        const count =
            id === 'all'
                ? reviewQueue.length
                : filterClinicalReviewQueue(reviewQueue, id).length;
        return `
                <button
                    type="button"
                    class="clinical-history-filter-chip${
                        normalizeClinicalQueueFilter(activeFilter) === id
                            ? ' is-active'
                            : ''
                    }"
                    data-clinical-queue-filter="${escapeHtml(id)}"
                >
                    ${escapeHtml(label)} <span>${escapeHtml(String(count))}</span>
                </button>
            `;
    }).join('');
}

function buildWorkspaceTabs(activeWorkspace, meta) {
    return CLINICAL_HISTORY_WORKSPACE_OPTIONS.map(
        ({ workspace, label, metaLabel }) => {
            const isActive = activeWorkspace === workspace;
            const workspaceMetaLabel =
                typeof metaLabel === 'function' ? metaLabel(meta) : '';
            return `
                <button
                    type="button"
                    class="clinical-history-workspace-tab${
                        isActive ? ' is-active' : ''
                    }"
                    data-clinical-workspace="${escapeHtml(workspace)}"
                    aria-pressed="${isActive ? 'true' : 'false'}"
                >
                    <strong>${escapeHtml(label)}</strong>
                    <small>${escapeHtml(workspaceMetaLabel)}</small>
                </button>
            `;
        }
    ).join('');
}

function buildQueueEmptyState(filter) {
    return buildEmptyClinicalCard(
        normalizeClinicalQueueFilter(filter) === 'all'
            ? 'Sin cola activa'
            : `Sin casos en ${queueFilterLabel(filter)}`,
        normalizeClinicalQueueFilter(filter) === 'all'
            ? 'No hay historias clinicas esperando revision humana.'
            : 'Prueba con otro filtro o vuelve a Todos para revisar el resto de la cola.'
    );
}

function buildQueueItemChips(item, status) {
    return [
        status,
        item.legalReadinessStatus === 'ready' ? 'Lista para aprobar' : '',
        formatConfidence(item.confidence),
        queueAlertMeta(item),
        item.attachmentCount > 0 ? `${item.attachmentCount} adjunto(s)` : '',
    ].filter(Boolean);
}

function buildQueueItemMeta(item) {
    return [
        item.latestOpenEventTitle,
        readableTimestamp(item.updatedAt || item.createdAt),
    ]
        .filter(Boolean)
        .join(' • ');
}

function buildClinicalHistoryMiniChipRow(chips) {
    return `
        <div class="clinical-history-mini-chip-row">
            ${normalizeList(chips)
                .map(
                    (chip) =>
                        `<span class="clinical-history-mini-chip">${escapeHtml(
                            chip
                        )}</span>`
                )
                .join('')}
        </div>
    `;
}

function buildQueueItemCard(item, selectedSessionId, loading) {
    const sessionId = normalizeString(item.sessionId);
    const summary = truncateText(
        item.legalReadinessSummary ||
            item.summary ||
            queueReasons(item).join(' • ') ||
            'Caso listo para lectura clinica.',
        140
    );
    const status =
        formatPendingAiStatus(item.pendingAiStatus) ||
        item.legalReadinessLabel ||
        formatReviewStatus(item.reviewStatus || item.sessionStatus);
    const tone = formatTone(
        item.reviewStatus || item.sessionStatus,
        item.requiresHumanReview,
        item.pendingAiStatus,
        item.highestOpenSeverity
    );
    const chips = buildQueueItemChips(item, status);
    const queueMeta = buildQueueItemMeta(item);

    return `
        <button
            type="button"
            class="clinical-history-queue-item${
                sessionId === selectedSessionId ? ' is-selected' : ''
            }"
            data-clinical-session-id="${escapeHtml(sessionId)}"
            ${loading ? 'disabled' : ''}
        >
            <div class="clinical-history-queue-head">
                <strong>${escapeHtml(
                    item.patientName || item.caseId || 'Caso clinico'
                )}</strong>
                <span class="clinical-history-mini-chip" data-tone="${escapeHtml(
                    tone
                )}">
                    ${escapeHtml(status)}
                </span>
            </div>
            <p>${escapeHtml(summary)}</p>
            ${buildClinicalHistoryMiniChipRow(chips)}
            <small>${escapeHtml(queueMeta || 'Sin timestamp')}</small>
        </button>
    `;
}

function buildQueueList(meta, selectedSessionId, loading, filter) {
    const reviewQueue = filterClinicalReviewQueue(meta.reviewQueue, filter);
    return buildClinicalHistoryCollection(
        reviewQueue,
        () => buildQueueEmptyState(filter),
        (item) => buildQueueItemCard(item, selectedSessionId, loading)
    );
}

function buildQueueMetaText(meta, filter) {
    return `Mostrando ${filterClinicalReviewQueue(meta.reviewQueue, filter).length} de ${
        normalizeList(meta.reviewQueue).length
    } caso(s) en ${queueFilterLabel(filter).toLowerCase()}.`;
}

function buildTranscriptMessageCard(message) {
    const surface = normalizeString(message.surface);
    const fieldKey = normalizeString(message.fieldKey);
    const meta = [surface, fieldKey].filter(Boolean).join(' • ');

    return `
        <article
            class="clinical-history-message"
            data-actor-tone="${escapeHtml(transcriptActorTone(message))}"
        >
            <header>
                <span class="clinical-history-mini-chip">${escapeHtml(
                    transcriptActorLabel(message)
                )}</span>
                <time>${escapeHtml(readableTimestamp(message.createdAt))}</time>
            </header>
            <p>${formatHtmlMultiline(message.content)}</p>
            <small>${escapeHtml(meta || 'Sin metadata clinica')}</small>
        </article>
    `;
}

function buildTranscript(review, loading, error) {
    if (loading && review.session.transcript.length === 0) {
        return buildEmptyClinicalCard(
            'Cargando conversacion',
            'Estamos recuperando el transcript y el borrador medico.'
        );
    }

    if (error && review.session.transcript.length === 0) {
        return buildEmptyClinicalCard('No se pudo cargar el caso', error, {
            tone: 'warning',
        });
    }

    if (review.session.transcript.length === 0) {
        return buildEmptyClinicalCard(
            'Sin transcript',
            'La conversacion del paciente aparecera aqui cuando exista una sesion cargada.'
        );
    }

    return buildClinicalHistoryCollection(
        review.session.transcript,
        () => '',
        buildTranscriptMessageCard
    );
}

function buildTranscriptMetaText(review) {
    return review.session.sessionId
        ? `${currentSelectionLabel(review)} • ${
              review.session.surface || 'clinical_intake'
          }`
        : 'El transcript del paciente aparece aqui.';
}

function buildTranscriptCountText(review) {
    return `${normalizeList(review.session.transcript).length} mensaje(s)`;
}

function buildClinicalEventCard(event) {
    const tone = buildEventTone(event);
    const meta = [
        event.status ? `Estado ${event.status}` : '',
        readableTimestamp(
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
                    formatSeverity(event.severity)
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

function buildEvents(review) {
    return buildClinicalHistoryCollection(
        review.events,
        () =>
            buildEmptyClinicalCard(
                'Sin eventos abiertos',
                'Cuando haya alertas, conciliaciones o acciones pendientes apareceran aqui.'
            ),
        buildClinicalEventCard
    );
}

function buildEventTone(event) {
    const severity = normalizeString(event.severity).toLowerCase();
    if (severity === 'critical') {
        return 'danger';
    }
    if (severity === 'warning' || event.requiresAction) {
        return 'warning';
    }
    return 'neutral';
}

function buildEventsMetaText(review) {
    return review.events.length > 0
        ? `${review.events.length} evento(s) registrados para este caso.`
        : 'Alertas, conciliacion y acciones pendientes.';
}

function highestReviewEventSeverity(review) {
    let highest = '';
    normalizeList(review.events).forEach((event) => {
        const severity = normalizeString(event.severity).toLowerCase();
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

function buildDraftMetaText(slice, draft) {
    if (slice.saving) {
        return 'Guardando borrador clinico...';
    }
    if (slice.loading) {
        return 'Cargando sesion clinica...';
    }
    if (slice.error) {
        return slice.error;
    }
    if (slice.dirty) {
        return 'Cambios sin guardar';
    }
    if (draft.updatedAt) {
        return `Ultima actualizacion ${readableTimestamp(draft.updatedAt)}`;
    }

    return 'Sin cambios';
}

function buildDraftSummaryText(review, draft) {
    return review.session.sessionId
        ? `Editando ${currentSelectionLabel(review)} • ${
              normalizeLegalReadiness(review.legalReadiness).label ||
              formatReviewStatus(draft.reviewStatus)
          }`
        : 'Selecciona un caso para editar nota viva, consentimiento y documentos.';
}

function buildFollowUpMetaText(review) {
    return review.session.sessionId
        ? `La pregunta saldra por el mismo hilo de ${currentSelectionLabel(
              review
          )}.`
        : 'Envia una pregunta puntual al paciente sin salir del review.';
}

function buildClinicalHeaderMetaText(review) {
    const selectedLabel = currentSelectionLabel(review);
    const headerMeta = [
        review.session.caseId ? `Caso ${review.session.caseId}` : '',
        review.session.surface || '',
        review.session.appointmentId
            ? `Cita ${review.session.appointmentId}`
            : '',
        selectedLabel,
    ]
        .filter(Boolean)
        .join(' • ');

    return (
        headerMeta ||
        'Selecciona un caso para revisar la nota viva y la aptitud medico-legal.'
    );
}

function buildClinicalStatusMetaText(draft, pendingAiStatus, meta) {
    const statusMeta = [
        pendingAiStatus,
        draft.requiresHumanReview
            ? 'Firma humana requerida'
            : 'Pendiente de aprobacion final',
        formatConfidence(draft.confidence),
    ]
        .filter(Boolean)
        .join(' • ');

    return (
        statusMeta ||
        `${normalizeList(meta.reviewQueue).length} caso(s) listos para revision`
    );
}

function textareaField(id, label, value, options = {}) {
    const { placeholder = '', rows = 4, hint = '', disabled = false } = options;

    return buildClinicalHistoryFieldShell(
        id,
        label,
        `
            <textarea
                id="${escapeHtml(id)}"
                name="${escapeHtml(id)}"
                rows="${Number(rows) || 4}"
                placeholder="${escapeHtml(placeholder)}"
                ${disabled ? 'disabled' : ''}
            >${escapeHtml(value)}</textarea>
        `,
        hint
    );
}

function inputField(id, label, value, options = {}) {
    const {
        type = 'text',
        placeholder = '',
        hint = '',
        step = '',
        min = '',
        disabled = false,
    } = options;

    return buildClinicalHistoryFieldShell(
        id,
        label,
        `
            <input
                id="${escapeHtml(id)}"
                name="${escapeHtml(id)}"
                type="${escapeHtml(type)}"
                value="${escapeHtml(value)}"
                placeholder="${escapeHtml(placeholder)}"
                ${step !== '' ? `step="${escapeHtml(step)}"` : ''}
                ${min !== '' ? `min="${escapeHtml(min)}"` : ''}
                ${disabled ? 'disabled' : ''}
            />
        `,
        hint
    );
}

function checkboxField(id, label, checked, options = {}) {
    const { hint = '', disabled = false } = options;
    return `
        <label class="clinical-history-toggle" for="${escapeHtml(id)}">
            <input
                id="${escapeHtml(id)}"
                name="${escapeHtml(id)}"
                type="checkbox"
                ${checked ? 'checked' : ''}
                ${disabled ? 'disabled' : ''}
            />
            <span>
                <strong>${escapeHtml(label)}</strong>
                <small>${escapeHtml(hint || ' ')}</small>
            </span>
        </label>
    `;
}

function selectField(id, label, value, choices, options = {}) {
    const { hint = '', disabled = false } = options;
    return buildClinicalHistoryFieldShell(
        id,
        label,
        `
            <select
                id="${escapeHtml(id)}"
                name="${escapeHtml(id)}"
                ${disabled ? 'disabled' : ''}
            >
                ${buildClinicalHistoryChoiceOptions(choices, value)}
            </select>
        `,
        hint
    );
}

function buildClinicalHistoryInlineGrid(fields) {
    return `
        <div class="clinical-history-inline-grid">
            ${fields.join('')}
        </div>
    `;
}

function buildClinicalHistorySection(title, description, body) {
    return `
            <section class="clinical-history-form-section">
                <header>
                    <h4>${escapeHtml(title)}</h4>
                    <p>${escapeHtml(description)}</p>
                </header>
                ${body}
            </section>
    `;
}

function buildClinicalHistoryIntakeSection(draft, disabled, pregnancyValue) {
    return buildClinicalHistorySection(
        'Intake estructurado',
        'Motivo de consulta, evolucion y datos del paciente.',
        `
                ${inputField(
                    'intake_motivo_consulta',
                    'Motivo de consulta',
                    draft.intake.motivoConsulta,
                    {
                        placeholder: 'Ej. prurito, acne inflamatorio, rash',
                        disabled,
                    }
                )}
                ${textareaField(
                    'intake_enfermedad_actual',
                    'Enfermedad actual',
                    draft.intake.enfermedadActual,
                    {
                        rows: 5,
                        placeholder:
                            'Evolucion temporal, distribucion, desencadenantes.',
                        disabled,
                    }
                )}
                ${buildClinicalHistoryInlineGrid([
                    textareaField(
                        'intake_antecedentes',
                        'Antecedentes',
                        draft.intake.antecedentes,
                        {
                            rows: 4,
                            placeholder:
                                'Dermatologicos, familiares, cronicos.',
                            disabled,
                        }
                    ),
                    textareaField(
                        'intake_alergias',
                        'Alergias',
                        draft.intake.alergias,
                        {
                            rows: 4,
                            placeholder: 'Medicamentos, alimentos, contacto.',
                            disabled,
                        }
                    ),
                ])}
                ${buildClinicalHistoryInlineGrid([
                    textareaField(
                        'intake_medicacion_actual',
                        'Medicacion actual',
                        draft.intake.medicacionActual,
                        {
                            rows: 4,
                            placeholder: 'Nombre, dosis, frecuencia.',
                            disabled,
                        }
                    ),
                    textareaField(
                        'intake_ros_red_flags',
                        'ROS / red flags',
                        listToTextarea(draft.intake.rosRedFlags),
                        {
                            rows: 4,
                            placeholder:
                                'Una linea por dato clinico o red flag.',
                            hint: 'Cada linea se guarda como item separado.',
                            disabled,
                        }
                    ),
                ])}
                ${textareaField(
                    'intake_resumen_clinico',
                    'Resumen clinico',
                    draft.intake.resumenClinico,
                    {
                        rows: 4,
                        placeholder: 'Resumen limpio para pasar a la consulta.',
                        disabled,
                    }
                )}
                ${textareaField(
                    'intake_preguntas_faltantes',
                    'Preguntas faltantes del intake',
                    listToTextarea(draft.intake.preguntasFaltantes),
                    {
                        rows: 3,
                        placeholder: 'Una pregunta por linea.',
                        disabled,
                    }
                )}
                ${buildClinicalHistoryInlineGrid([
                    inputField(
                        'patient_edad_anios',
                        'Edad (anos)',
                        draft.intake.datosPaciente.edadAnios ?? '',
                        {
                            type: 'number',
                            min: '0',
                            step: '1',
                            disabled,
                        }
                    ),
                    inputField(
                        'patient_peso_kg',
                        'Peso (kg)',
                        draft.intake.datosPaciente.pesoKg ?? '',
                        {
                            type: 'number',
                            min: '0',
                            step: '0.1',
                            disabled,
                        }
                    ),
                    selectField(
                        'patient_sexo_biologico',
                        'Sexo biologico',
                        draft.intake.datosPaciente.sexoBiologico,
                        CLINICAL_HISTORY_SEX_CHOICES,
                        { disabled }
                    ),
                    selectField(
                        'patient_embarazo',
                        'Embarazo',
                        pregnancyValue,
                        CLINICAL_HISTORY_PREGNANCY_CHOICES,
                        { disabled }
                    ),
                ])}
            `
    );
}

function buildClinicalHistoryClinicianSection(draft, disabled, reviewReasons) {
    return buildClinicalHistorySection(
        'Sintesis del medico',
        'Bloque solo interno: resumen, CIE-10, plan y guardrails.',
        `
                ${textareaField(
                    'clinician_resumen',
                    'Resumen medico',
                    draft.clinicianDraft.resumen,
                    {
                        rows: 4,
                        placeholder: 'Sintesis final para presentar o firmar.',
                        disabled,
                    }
                )}
                ${buildClinicalHistoryInlineGrid([
                    textareaField(
                        'clinician_preguntas_faltantes',
                        'Preguntas faltantes',
                        listToTextarea(draft.clinicianDraft.preguntasFaltantes),
                        {
                            rows: 4,
                            placeholder: 'Una linea por pregunta.',
                            disabled,
                        }
                    ),
                    textareaField(
                        'clinician_cie10',
                        'CIE-10 sugeridos',
                        listToTextarea(draft.clinicianDraft.cie10Sugeridos),
                        {
                            rows: 4,
                            placeholder: 'Ej. L20.9',
                            disabled,
                        }
                    ),
                ])}
                ${textareaField(
                    'clinician_tratamiento',
                    'Tratamiento borrador',
                    draft.clinicianDraft.tratamientoBorrador,
                    {
                        rows: 4,
                        placeholder:
                            'No se muestra al paciente; requiere firma humana.',
                        disabled,
                    }
                )}
                ${buildClinicalHistoryInlineGrid([
                    textareaField(
                        'posologia_texto',
                        'Posologia borrador',
                        draft.clinicianDraft.posologiaBorrador.texto,
                        {
                            rows: 4,
                            placeholder: 'Ej. 1 comp cada 12 h por 7 dias.',
                            disabled,
                        }
                    ),
                    textareaField(
                        'posologia_base_calculo',
                        'Base de calculo',
                        draft.clinicianDraft.posologiaBorrador.baseCalculo,
                        {
                            rows: 4,
                            placeholder: 'Regla, mg/kg, fuente o criterio.',
                            disabled,
                        }
                    ),
                ])}
                ${buildClinicalHistoryInlineGrid([
                    inputField(
                        'posologia_peso_kg',
                        'Peso usado (kg)',
                        draft.clinicianDraft.posologiaBorrador.pesoKg ?? '',
                        {
                            type: 'number',
                            min: '0',
                            step: '0.1',
                            disabled,
                        }
                    ),
                    inputField(
                        'posologia_edad_anios',
                        'Edad usada (anos)',
                        draft.clinicianDraft.posologiaBorrador.edadAnios ?? '',
                        {
                            type: 'number',
                            min: '0',
                            step: '1',
                            disabled,
                        }
                    ),
                    inputField(
                        'posologia_units',
                        'Unidades',
                        draft.clinicianDraft.posologiaBorrador.units,
                        {
                            placeholder: 'mg, mg/kg/dia, ml',
                            disabled,
                        }
                    ),
                ])}
                ${checkboxField(
                    'posologia_ambiguous',
                    'La posologia sigue ambigua',
                    draft.clinicianDraft.posologiaBorrador.ambiguous === true,
                    {
                        hint: 'Mantiene el caso en revisado con cautela.',
                        disabled,
                    }
                )}
                ${checkboxField(
                    'requires_human_review',
                    'Requiere revision humana',
                    draft.requiresHumanReview === true,
                    {
                        hint:
                            reviewReasons ||
                            'Toda aprobacion final sigue siendo humana.',
                        disabled,
                    }
                )}
            `
    );
}

function buildClinicalHistoryConsentSection(draft, disabled) {
    return buildClinicalHistorySection(
        'Consentimiento informado',
        'Registro del proceso de comunicacion y deliberacion del episodio.',
        `
                ${checkboxField(
                    'consent_required',
                    'Este episodio exige consentimiento informado',
                    draft.consent.required === true,
                    {
                        hint: 'Activa el bloqueo legal hasta que el consentimiento quede aceptado.',
                        disabled,
                    }
                )}
                ${selectField(
                    'consent_status',
                    'Estado del consentimiento',
                    draft.consent.status,
                    [
                        { value: 'not_required', label: 'No requerido' },
                        { value: 'pending', label: 'Pendiente' },
                        { value: 'accepted', label: 'Aceptado' },
                        { value: 'declined', label: 'Negado' },
                        { value: 'revoked', label: 'Revocado' },
                    ],
                    { disabled }
                )}
                ${buildClinicalHistoryInlineGrid([
                    inputField(
                        'consent_informed_by',
                        'Quien informo',
                        draft.consent.informedBy,
                        {
                            placeholder: 'Profesional responsable',
                            disabled,
                        }
                    ),
                    inputField(
                        'consent_informed_at',
                        'Fecha/hora',
                        draft.consent.informedAt,
                        {
                            placeholder: '2026-03-26T20:00:00-05:00',
                            disabled,
                        }
                    ),
                ])}
                ${buildClinicalHistoryInlineGrid([
                    textareaField(
                        'consent_explained_what',
                        'Que se explico',
                        draft.consent.explainedWhat,
                        { rows: 4, disabled }
                    ),
                    textareaField(
                        'consent_risks_explained',
                        'Riesgos explicados',
                        draft.consent.risksExplained,
                        { rows: 4, disabled }
                    ),
                ])}
                ${buildClinicalHistoryInlineGrid([
                    textareaField(
                        'consent_alternatives_explained',
                        'Alternativas explicadas',
                        draft.consent.alternativesExplained,
                        { rows: 4, disabled }
                    ),
                    textareaField(
                        'consent_capacity_assessment',
                        'Capacidad para decidir',
                        draft.consent.capacityAssessment,
                        { rows: 4, disabled }
                    ),
                ])}
                ${checkboxField(
                    'consent_private_communication_confirmed',
                    'La comunicacion se realizo en entorno privado',
                    draft.consent.privateCommunicationConfirmed === true,
                    { disabled }
                )}
                ${checkboxField(
                    'consent_companion_share_authorized',
                    'Hay autorizacion para compartir con acompanante',
                    draft.consent.companionShareAuthorized === true,
                    { disabled }
                )}
                ${textareaField(
                    'consent_notes',
                    'Notas de consentimiento',
                    draft.consent.notes,
                    {
                        rows: 3,
                        disabled,
                    }
                )}
            `
    );
}

function buildClinicalHistoryDocumentsSection(draft, disabled) {
    return buildClinicalHistorySection(
        'Documentos de salida',
        'Nota final, receta y certificado dentro del mismo cockpit clinico.',
        `
                ${textareaField(
                    'document_final_note_summary',
                    'Resumen de nota final',
                    draft.documents.finalNote.summary,
                    { rows: 3, disabled }
                )}
                ${textareaField(
                    'document_prescription_medication',
                    'Receta / medicamento',
                    draft.documents.prescription.medication,
                    { rows: 3, disabled }
                )}
                ${textareaField(
                    'document_prescription_directions',
                    'Indicaciones de receta',
                    draft.documents.prescription.directions,
                    { rows: 3, disabled }
                )}
                ${buildClinicalHistoryInlineGrid([
                    textareaField(
                        'document_certificate_summary',
                        'Certificado',
                        draft.documents.certificate.summary,
                        { rows: 3, disabled }
                    ),
                    inputField(
                        'document_certificate_rest_days',
                        'Dias de reposo',
                        draft.documents.certificate.restDays ?? '',
                        {
                            type: 'number',
                            min: '0',
                            step: '1',
                            disabled,
                        }
                    ),
                ])}
            `
    );
}

function buildDraftForm(draft, saving) {
    const disabled = saving || normalizeString(draft.sessionId) === '';
    const pregnancyValue = pregnancySelectValue(
        draft.intake.datosPaciente.embarazo
    );
    const reviewReasons = draft.reviewReasons.join(', ');

    return `
        <div class="clinical-history-form-grid">
            ${buildClinicalHistoryIntakeSection(draft, disabled, pregnancyValue)}
            ${buildClinicalHistoryClinicianSection(draft, disabled, reviewReasons)}
            ${buildClinicalHistoryConsentSection(draft, disabled)}
            ${buildClinicalHistoryDocumentsSection(draft, disabled)}
        </div>
    `;
}

function syncDraftStatusMeta() {
    const state = getState();
    const slice = getClinicalHistorySlice(state);
    const review = currentReviewSource(state);
    const draft = currentDraftSource(state);
    const readiness = normalizeLegalReadiness(review.legalReadiness);

    setText('#clinicalHistoryDraftMeta', buildDraftMetaText(slice, draft));
    setText(
        '#clinicalHistoryDraftSummary',
        buildDraftSummaryText(review, draft)
    );
    setText('#clinicalHistoryFollowUpMeta', buildFollowUpMetaText(review));

    const hasSelection = normalizeString(review.session.sessionId) !== '';
    const sharedDisabled = !hasSelection || slice.loading || slice.saving;
    [
        'clinicalHistorySaveBtn',
        'clinicalHistoryRefreshBtn',
        'clinicalHistoryReviewRequiredBtn',
        'clinicalHistoryRequestCertifiedCopyBtn',
        'clinicalHistoryDeliverCertifiedCopyBtn',
        'clinicalHistoryLogDisclosureBtn',
    ].forEach((buttonId) => setButtonDisabled(buttonId, sharedDisabled));
    setButtonDisabled(
        'clinicalHistoryApproveBtn',
        sharedDisabled || readiness.ready !== true
    );
    setButtonDisabled(
        'clinicalHistorySetPassiveArchiveBtn',
        sharedDisabled ||
            normalizeString(review.archiveReadiness?.archiveState) === 'passive'
    );
    setButtonDisabled(
        'clinicalHistorySendFollowUpBtn',
        sharedDisabled || normalizeString(slice.followUpQuestion) === ''
    );
}

function serializeDraftForm(form, baseDraft) {
    const snapshot = normalizeDraftSnapshot(
        cloneValue(baseDraft || emptyDraft())
    );

    if (!(form instanceof HTMLFormElement)) {
        return snapshot;
    }

    const readValue = (name) => {
        const field = form.elements.namedItem(name);
        if (
            field instanceof HTMLInputElement ||
            field instanceof HTMLTextAreaElement ||
            field instanceof HTMLSelectElement
        ) {
            return field.value;
        }
        return '';
    };

    const readChecked = (name) => {
        const field = form.elements.namedItem(name);
        return field instanceof HTMLInputElement ? field.checked : false;
    };

    snapshot.intake.motivoConsulta = normalizeString(
        readValue('intake_motivo_consulta')
    );
    snapshot.intake.enfermedadActual = normalizeString(
        readValue('intake_enfermedad_actual')
    );
    snapshot.intake.antecedentes = normalizeString(
        readValue('intake_antecedentes')
    );
    snapshot.intake.alergias = normalizeString(readValue('intake_alergias'));
    snapshot.intake.medicacionActual = normalizeString(
        readValue('intake_medicacion_actual')
    );
    snapshot.intake.rosRedFlags = serializeTextareaLines(
        readValue('intake_ros_red_flags')
    );
    snapshot.intake.resumenClinico = normalizeString(
        readValue('intake_resumen_clinico')
    );
    snapshot.intake.preguntasFaltantes = serializeTextareaLines(
        readValue('intake_preguntas_faltantes')
    );
    snapshot.intake.datosPaciente = {
        ...snapshot.intake.datosPaciente,
        edadAnios: normalizeNullableInt(readValue('patient_edad_anios')),
        pesoKg: normalizeNullableFloat(readValue('patient_peso_kg')),
        sexoBiologico: normalizeString(readValue('patient_sexo_biologico')),
        embarazo: normalizePregnancyValue(readValue('patient_embarazo')),
    };

    snapshot.clinicianDraft.resumen = normalizeString(
        readValue('clinician_resumen')
    );
    snapshot.clinicianDraft.preguntasFaltantes = serializeTextareaLines(
        readValue('clinician_preguntas_faltantes')
    );
    snapshot.clinicianDraft.cie10Sugeridos = serializeTextareaLines(
        readValue('clinician_cie10')
    );
    snapshot.clinicianDraft.tratamientoBorrador = normalizeString(
        readValue('clinician_tratamiento')
    );
    snapshot.clinicianDraft.posologiaBorrador = normalizePosology({
        texto: readValue('posologia_texto'),
        baseCalculo: readValue('posologia_base_calculo'),
        pesoKg: readValue('posologia_peso_kg'),
        edadAnios: readValue('posologia_edad_anios'),
        units: readValue('posologia_units'),
        ambiguous: readChecked('posologia_ambiguous'),
    });

    snapshot.consent = normalizeConsent({
        required: readChecked('consent_required'),
        status: readValue('consent_status'),
        informedBy: readValue('consent_informed_by'),
        informedAt: readValue('consent_informed_at'),
        explainedWhat: readValue('consent_explained_what'),
        risksExplained: readValue('consent_risks_explained'),
        alternativesExplained: readValue('consent_alternatives_explained'),
        capacityAssessment: readValue('consent_capacity_assessment'),
        privateCommunicationConfirmed: readChecked(
            'consent_private_communication_confirmed'
        ),
        companionShareAuthorized: readChecked(
            'consent_companion_share_authorized'
        ),
        notes: readValue('consent_notes'),
    });

    snapshot.documents = normalizeDocuments({
        finalNote: {
            ...snapshot.documents.finalNote,
            summary: readValue('document_final_note_summary'),
        },
        prescription: {
            ...snapshot.documents.prescription,
            medication: readValue('document_prescription_medication'),
            directions: readValue('document_prescription_directions'),
        },
        certificate: {
            ...snapshot.documents.certificate,
            summary: readValue('document_certificate_summary'),
            restDays: readValue('document_certificate_rest_days'),
        },
    });

    snapshot.requiresHumanReview = readChecked('requires_human_review');
    return snapshot;
}

function readClinicalControlValue(id) {
    const field = document.getElementById(id);
    if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement
    ) {
        return field.value;
    }
    return '';
}

function buildGovernanceActionPayload(action) {
    const review = currentReviewSource();
    const sessionId = normalizeString(review.session.sessionId);
    const copyNotes = normalizeString(
        readClinicalControlValue('governance_copy_notes')
    );
    const requestId = normalizeString(
        readClinicalControlValue('governance_copy_request_id')
    );
    const disclosureTargetType = normalizeString(
        readClinicalControlValue('governance_disclosure_target_type')
    );
    const disclosureLegalBasis = normalizeString(
        readClinicalControlValue('governance_disclosure_legal_basis')
    );
    const archiveOverrideReason = normalizeString(
        readClinicalControlValue('governance_archive_override_reason')
    );

    if (action === 'request-certified-copy') {
        return {
            sessionId,
            action: 'request_certified_copy',
            requestedByType:
                normalizeString(
                    readClinicalControlValue(
                        'governance_copy_requested_by_type'
                    )
                ) || 'patient',
            requestedByName: normalizeString(
                readClinicalControlValue('governance_copy_requested_by_name')
            ),
            legalBasis: normalizeString(
                readClinicalControlValue('governance_copy_legal_basis')
            ),
            notes: copyNotes,
        };
    }

    if (action === 'deliver-certified-copy') {
        return {
            sessionId,
            action: 'deliver_certified_copy',
            requestId,
            deliveredTo: normalizeString(
                readClinicalControlValue('governance_copy_delivered_to')
            ),
            deliveryChannel: normalizeString(
                readClinicalControlValue('governance_copy_delivery_channel')
            ),
            notes: copyNotes,
        };
    }

    if (action === 'log-disclosure') {
        return {
            sessionId,
            action: 'log_disclosure',
            targetType: disclosureTargetType || 'patient',
            targetName: normalizeString(
                readClinicalControlValue('governance_disclosure_target_name')
            ),
            purpose: normalizeString(
                readClinicalControlValue('governance_disclosure_purpose')
            ),
            legalBasis: disclosureLegalBasis,
            channel: normalizeString(
                readClinicalControlValue('governance_disclosure_channel')
            ),
            notes: normalizeString(
                readClinicalControlValue('governance_disclosure_notes')
            ),
        };
    }

    if (action === 'set-passive-archive') {
        return {
            sessionId,
            action: 'set_archive_state',
            archiveState: 'passive',
            overrideReason: archiveOverrideReason,
        };
    }

    return {
        sessionId,
        action: '',
    };
}

async function submitGovernanceAction(action) {
    const review = currentReviewSource();
    const sessionId = normalizeString(review.session.sessionId);
    if (!sessionId) {
        createToast(
            'Selecciona un caso clinico antes de registrar gobernanza documental.',
            'warning'
        );
        return null;
    }

    const payload = buildGovernanceActionPayload(action);
    if (
        action === 'deliver-certified-copy' &&
        !normalizeString(payload.requestId)
    ) {
        createToast(
            'Selecciona un request ID antes de marcar la entrega de la copia certificada.',
            'warning'
        );
        return null;
    }
    if (
        action === 'log-disclosure' &&
        payload.targetType === 'companion' &&
        review.consent?.companionShareAuthorized !== true
    ) {
        createToast(
            'El disclosure a acompanante requiere autorizacion expresa en el consentimiento.',
            'warning'
        );
        return null;
    }
    if (
        action === 'log-disclosure' &&
        payload.targetType === 'external_third_party' &&
        !normalizeString(payload.legalBasis)
    ) {
        createToast(
            'El disclosure a tercero externo requiere base legal escrita.',
            'warning'
        );
        return null;
    }
    if (
        action === 'set-passive-archive' &&
        normalizeString(review.archiveReadiness?.archiveState) !== 'passive' &&
        review.archiveReadiness?.eligibleForPassive !== true &&
        !normalizeString(payload.overrideReason)
    ) {
        createToast(
            'Para pasar a archivo pasivo antes de tiempo debes documentar una razon de override.',
            'warning'
        );
        return null;
    }

    setClinicalHistoryState({
        saving: true,
        error: '',
    });
    syncDraftStatusMeta();

    try {
        const response = await apiRequest('clinical-episode-action', {
            method: 'POST',
            body: payload,
        });
        const nextReview = normalizeReviewPayload(response.data);
        setClinicalHistoryState({
            saving: false,
            error: '',
            dirty: false,
            current: nextReview,
            draftForm: cloneValue(nextReview.draft),
            selectedSessionId: nextReview.session.sessionId || sessionId,
            lastLoadedAt: Date.now(),
        });

        try {
            await refreshAdminData();
        } catch (_error) {
            // Keep the clinical workspace usable even if the admin snapshot refresh fails.
        }

        renderAdminChrome(getState());
        renderDashboard(getState());
        renderClinicalHistorySection();

        const targetLabel = currentSelectionLabel(nextReview);
        if (action === 'request-certified-copy') {
            createToast(
                `Solicitud de copia certificada registrada para ${targetLabel}.`,
                'success'
            );
        } else if (action === 'deliver-certified-copy') {
            createToast(
                `Entrega de copia certificada registrada para ${targetLabel}.`,
                'success'
            );
        } else if (action === 'log-disclosure') {
            createToast(
                `Disclosure documentado para ${targetLabel}.`,
                'success'
            );
        } else if (action === 'set-passive-archive') {
            createToast(
                `El record de ${targetLabel} ya quedo marcado en archivo pasivo.`,
                'success'
            );
        }

        return nextReview;
    } catch (error) {
        setClinicalHistoryState({
            saving: false,
            error:
                error?.message ||
                'No se pudo registrar la accion de gobernanza documental.',
        });
        syncDraftStatusMeta();
        createToast(
            error?.message ||
                'No se pudo registrar la accion de gobernanza documental.',
            'error'
        );
        return null;
    }
}

function renderClinicalHeader(review, meta) {
    const draft = currentDraftSource();
    const pendingAiStatus =
        formatPendingAiStatus(
            review.session.pendingAi?.status || draft.pendingAi?.status
        ) || '';
    const tone = formatTone(
        draft.reviewStatus,
        draft.requiresHumanReview,
        pendingAiStatus,
        highestReviewEventSeverity(review)
    );
    const statusChip = document.getElementById('clinicalHistoryStatusChip');
    if (statusChip instanceof HTMLElement) {
        statusChip.dataset.tone = tone;
        statusChip.textContent = review.session.sessionId
            ? formatReviewStatus(draft.reviewStatus)
            : 'Sin seleccion';
    }

    setText('#clinicalHistoryHeaderMeta', buildClinicalHeaderMetaText(review));
    setText(
        '#clinicalHistoryStatusMeta',
        buildClinicalStatusMetaText(draft, pendingAiStatus, meta)
    );
}

function syncFollowUpInput() {
    const slice = getClinicalHistorySlice();
    const input = document.getElementById('clinicalHistoryFollowUpInput');
    if (input instanceof HTMLTextAreaElement) {
        if (input.value !== String(slice.followUpQuestion || '')) {
            input.value = String(slice.followUpQuestion || '');
        }
        input.disabled = slice.loading || slice.saving;
    }
}

function currentSessionId(state = getState()) {
    const slice = getClinicalHistorySlice(state);
    const selected = normalizeString(slice.selectedSessionId);
    if (selected) {
        return selected;
    }

    return normalizeString(currentReviewSource(state).session.sessionId);
}

async function loadClinicalHistorySession(sessionId, options = {}) {
    const desiredSessionId = normalizeString(sessionId);
    if (!desiredSessionId) {
        setQueryParam(CLINICAL_HISTORY_SESSION_QUERY_PARAM, '');
        setClinicalHistoryState({
            selectedSessionId: '',
            loading: false,
            error: '',
            dirty: false,
            current: null,
            draftForm: null,
        });
        renderClinicalHistorySection();
        return null;
    }

    const slice = getClinicalHistorySlice();
    if (
        options.force !== true &&
        desiredSessionId === normalizeString(slice.selectedSessionId) &&
        slice.current
    ) {
        return currentReviewSource();
    }

    setQueryParam(CLINICAL_HISTORY_SESSION_QUERY_PARAM, desiredSessionId);
    setClinicalHistoryState({
        selectedSessionId: desiredSessionId,
        loading: true,
        error: '',
    });
    renderClinicalHistorySection();

    try {
        const response = await apiRequest('clinical-record', {
            query: {
                sessionId: desiredSessionId,
            },
        });
        const review = normalizeReviewPayload(response.data);
        setClinicalHistoryState({
            selectedSessionId: review.session.sessionId || desiredSessionId,
            loading: false,
            error: '',
            dirty: false,
            lastLoadedAt: Date.now(),
            current: review,
            draftForm: cloneValue(review.draft),
        });
        renderClinicalHistorySection();
        return review;
    } catch (error) {
        setClinicalHistoryState({
            selectedSessionId: desiredSessionId,
            loading: false,
            error:
                error?.message ||
                'No se pudo cargar la revision clinica de este caso.',
            current: null,
            draftForm: null,
        });
        renderClinicalHistorySection();
        if (options.silent !== true) {
            createToast(
                error?.message ||
                    'No se pudo cargar la revision clinica de este caso.',
                'error'
            );
        }
        return null;
    }
}

function buildReviewPatch(mode, question) {
    const review = currentReviewSource();
    const draft = currentDraftSource();
    const sessionId = normalizeString(
        review.session.sessionId || draft.sessionId
    );
    const draftPatch = {
        sessionId,
        draft: {
            intake: {
                motivoConsulta: draft.intake.motivoConsulta,
                enfermedadActual: draft.intake.enfermedadActual,
                antecedentes: draft.intake.antecedentes,
                alergias: draft.intake.alergias,
                medicacionActual: draft.intake.medicacionActual,
                rosRedFlags: cloneValue(draft.intake.rosRedFlags),
                resumenClinico: draft.intake.resumenClinico,
                preguntasFaltantes: cloneValue(draft.intake.preguntasFaltantes),
                datosPaciente: cloneValue(draft.intake.datosPaciente),
            },
            clinicianDraft: cloneValue(draft.clinicianDraft),
        },
        documents: cloneValue(draft.documents),
        consent: cloneValue(draft.consent),
        requiresHumanReview: draft.requiresHumanReview === true,
    };

    const actionPayload = {
        sessionId,
        action: 'save_draft',
        draft: draftPatch.draft,
        documents: draftPatch.documents,
        consent: draftPatch.consent,
        requiresHumanReview: draftPatch.requiresHumanReview,
    };

    if (mode === 'review-required') {
        actionPayload.action = 'mark_review_required';
        actionPayload.reviewStatus = 'review_required';
        actionPayload.requiresHumanReview = true;
    }

    if (mode === 'approve') {
        actionPayload.action = 'approve_final_note';
        actionPayload.approve = true;
        actionPayload.requiresHumanReview = false;
    }

    if (mode === 'follow-up') {
        actionPayload.action = 'request_missing_data';
        actionPayload.requestAdditionalQuestion = normalizeString(question);
    }

    return {
        draftPatch,
        actionPayload,
    };
}

async function saveClinicalHistoryReview(mode, question) {
    const review = currentReviewSource();
    const sessionId = normalizeString(review.session.sessionId);
    if (!sessionId) {
        createToast('Selecciona un caso clinico antes de guardar.', 'warning');
        return null;
    }

    const rootForm = document.getElementById('clinicalHistoryDraftForm');
    const nextDraft = serializeDraftForm(rootForm, currentDraftSource());
    setClinicalHistoryState({
        draftForm: cloneValue(nextDraft),
        saving: true,
        error: '',
        dirty: true,
    });
    syncDraftStatusMeta();

    try {
        const payload = buildReviewPatch(mode, question);
        const response =
            mode === 'save'
                ? await apiRequest('clinical-record', {
                      method: 'PATCH',
                      body: payload.draftPatch,
                  })
                : await apiRequest('clinical-episode-action', {
                      method: 'POST',
                      body: payload.actionPayload,
                  });
        const nextReview = normalizeReviewPayload(response.data);
        setClinicalHistoryState({
            saving: false,
            error: '',
            dirty: false,
            current: nextReview,
            draftForm: cloneValue(nextReview.draft),
            selectedSessionId: nextReview.session.sessionId || sessionId,
            followUpQuestion:
                mode === 'follow-up'
                    ? ''
                    : getClinicalHistorySlice().followUpQuestion,
            lastLoadedAt: Date.now(),
        });

        try {
            await refreshAdminData();
        } catch (_error) {
            // If the snapshot refresh fails, keep the local review state usable.
        }

        renderAdminChrome(getState());
        renderDashboard(getState());
        renderClinicalHistorySection();

        const reviewTarget = currentSelectionLabel(nextReview);

        if (mode === 'approve') {
            createToast(
                `Historia clinica aprobada para ${reviewTarget}.`,
                'success'
            );
        } else if (mode === 'review-required') {
            createToast(
                `Caso marcado para revision humana: ${reviewTarget}.`,
                'success'
            );
        } else if (mode === 'follow-up') {
            createToast(
                `Pregunta adicional enviada a ${reviewTarget}.`,
                'success'
            );
        } else {
            createToast(
                `Borrador clinico guardado para ${reviewTarget}.`,
                'success'
            );
        }

        return nextReview;
    } catch (error) {
        setClinicalHistoryState({
            saving: false,
            error:
                error?.message ||
                'No se pudo guardar la revision clinica del caso.',
        });
        syncDraftStatusMeta();
        createToast(
            error?.message ||
                'No se pudo guardar la revision clinica del caso.',
            'error'
        );
        return null;
    }
}

function captureDraftFromDom() {
    const form = document.getElementById('clinicalHistoryDraftForm');
    if (!(form instanceof HTMLFormElement)) {
        return;
    }

    const review = currentReviewSource();
    const nextDraft = serializeDraftForm(form, currentDraftSource());
    const dirty =
        JSON.stringify(nextDraft) !==
        JSON.stringify(normalizeDraftSnapshot(review.draft));

    setClinicalHistoryState({
        draftForm: cloneValue(nextDraft),
        dirty,
    });
    syncDraftStatusMeta();
}

async function maybeSwitchSession(sessionId) {
    const desiredSessionId = normalizeString(sessionId);
    const slice = getClinicalHistorySlice();
    if (!desiredSessionId || slice.loading || slice.saving) {
        return null;
    }

    if (
        desiredSessionId === normalizeString(slice.selectedSessionId) &&
        slice.current
    ) {
        return currentReviewSource();
    }

    if (
        slice.dirty &&
        normalizeString(slice.selectedSessionId) !== desiredSessionId
    ) {
        const confirmed = window.confirm(
            'Hay cambios sin guardar en este borrador. ¿Deseas cambiar de caso igualmente?'
        );
        if (!confirmed) {
            return null;
        }
    }

    return loadClinicalHistorySession(desiredSessionId, { force: true });
}

function ensureSessionSelection() {
    const state = getState();
    if (state?.ui?.activeSection !== 'clinical-history') {
        return;
    }

    const slice = getClinicalHistorySlice(state);
    if (slice.loading || slice.saving) {
        return;
    }

    const querySessionId = normalizeString(
        getQueryParam(CLINICAL_HISTORY_SESSION_QUERY_PARAM)
    );
    const fallbackSessionId = normalizeString(
        normalizeList(readClinicalHistoryMeta(state).reviewQueue)[0]?.sessionId
    );
    const desiredSessionId =
        querySessionId ||
        normalizeString(slice.selectedSessionId) ||
        fallbackSessionId;

    if (!desiredSessionId) {
        scheduledAutoSelection = '';
        return;
    }

    if (
        desiredSessionId === normalizeString(slice.selectedSessionId) &&
        slice.current
    ) {
        scheduledAutoSelection = '';
        return;
    }

    if (
        desiredSessionId === normalizeString(slice.selectedSessionId) &&
        normalizeString(slice.error) !== ''
    ) {
        scheduledAutoSelection = '';
        return;
    }

    if (scheduledAutoSelection === desiredSessionId) {
        return;
    }

    scheduledAutoSelection = desiredSessionId;
    window.setTimeout(() => {
        const stillActive =
            getState()?.ui?.activeSection === 'clinical-history';
        if (!stillActive) {
            scheduledAutoSelection = '';
            return;
        }
        openClinicalHistorySession(desiredSessionId).finally(() => {
            scheduledAutoSelection = '';
        });
    }, 0);
}

function syncWorkspaceVisibility(activeWorkspace) {
    const reviewWorkbench = document.getElementById('clinicalHistoryWorkbench');
    const reviewFooter = document.getElementById('clinicalHistoryFooterGrid');

    if (reviewWorkbench instanceof HTMLElement) {
        reviewWorkbench.hidden = false;
    }
    if (reviewFooter instanceof HTMLElement) {
        reviewFooter.hidden = false;
    }
}

function bindClinicalHistoryEvents() {
    const root = document.getElementById('clinical-history');
    if (!(root instanceof HTMLElement) || root.dataset.bound === 'true') {
        return;
    }

    root.addEventListener('click', async (event) => {
        const actionTarget =
            event.target instanceof Element
                ? event.target.closest('[data-clinical-review-action]')
                : null;
        const workspaceTarget =
            event.target instanceof Element
                ? event.target.closest('[data-clinical-workspace]')
                : null;
        const filterTarget =
            event.target instanceof Element
                ? event.target.closest('[data-clinical-queue-filter]')
                : null;
        const queueTarget =
            event.target instanceof Element
                ? event.target.closest('[data-clinical-session-id]')
                : null;

        if (workspaceTarget instanceof HTMLButtonElement) {
            event.preventDefault();
            setActiveClinicalWorkspace(
                workspaceTarget.dataset.clinicalWorkspace || 'review'
            );
            return;
        }

        if (filterTarget instanceof HTMLButtonElement) {
            event.preventDefault();
            setClinicalQueueFilter(
                filterTarget.dataset.clinicalQueueFilter || 'all'
            );
            return;
        }

        if (queueTarget instanceof HTMLButtonElement) {
            event.preventDefault();
            await maybeSwitchSession(queueTarget.dataset.clinicalSessionId);
            return;
        }

        if (!(actionTarget instanceof HTMLButtonElement)) {
            return;
        }

        event.preventDefault();
        const action = normalizeString(
            actionTarget.dataset.clinicalReviewAction
        );
        if (action === 'refresh-current') {
            await refreshClinicalHistoryCurrentSession();
            return;
        }

        if (action === 'send-follow-up') {
            const question = normalizeString(
                getClinicalHistorySlice().followUpQuestion
            );
            if (!question) {
                createToast(
                    'Escribe la pregunta adicional antes de enviarla.',
                    'warning'
                );
                return;
            }
            await saveClinicalHistoryReview('follow-up', question);
            return;
        }

        if (action === 'mark-review-required') {
            await saveClinicalHistoryReview('review-required', '');
            return;
        }

        if (action === 'approve-current') {
            await saveClinicalHistoryReview('approve', '');
            return;
        }

        if (action === 'request-certified-copy') {
            await submitGovernanceAction('request-certified-copy');
            return;
        }

        if (action === 'deliver-certified-copy') {
            await submitGovernanceAction('deliver-certified-copy');
            return;
        }

        if (action === 'log-disclosure') {
            await submitGovernanceAction('log-disclosure');
            return;
        }

        if (action === 'set-passive-archive') {
            await submitGovernanceAction('set-passive-archive');
        }
    });

    root.addEventListener('submit', async (event) => {
        const form = event.target;
        if (
            !(form instanceof HTMLFormElement) ||
            form.id !== 'clinicalHistoryDraftForm'
        ) {
            return;
        }

        event.preventDefault();
        await saveClinicalHistoryReview('save', '');
    });

    root.addEventListener('input', (event) => {
        const target = event.target;
        if (
            target instanceof HTMLTextAreaElement &&
            target.id === 'clinicalHistoryFollowUpInput'
        ) {
            setClinicalHistoryState({
                followUpQuestion: target.value,
            });
            syncDraftStatusMeta();
            return;
        }

        if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement
        ) {
            if (target.form?.id === 'clinicalHistoryDraftForm') {
                captureDraftFromDom();
            }
        }
    });

    root.addEventListener('change', (event) => {
        const target = event.target;
        if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement
        ) {
            if (target.form?.id === 'clinicalHistoryDraftForm') {
                captureDraftFromDom();
            }
        }
    });

    root.dataset.bound = 'true';
}

export async function openClinicalHistorySession(sessionId = '') {
    const explicitSessionId = normalizeString(sessionId);
    const preferredWorkspace = explicitSessionId
        ? 'review'
        : readWorkspaceQuery() ||
          normalizeClinicalHistoryWorkspace(
              getClinicalHistorySlice().activeWorkspace
          );
    setActiveClinicalWorkspace(preferredWorkspace, {
        render: false,
        syncQuery: true,
    });
    const selected =
        explicitSessionId ||
        normalizeString(getQueryParam(CLINICAL_HISTORY_SESSION_QUERY_PARAM));
    const fallback = normalizeString(
        normalizeList(readClinicalHistoryMeta().reviewQueue)[0]?.sessionId
    );
    return maybeSwitchSession(selected || fallback);
}

export async function refreshClinicalHistoryCurrentSession() {
    const selected =
        currentSessionId() ||
        normalizeString(getQueryParam(CLINICAL_HISTORY_SESSION_QUERY_PARAM));
    if (!selected) {
        renderClinicalHistorySection();
        return null;
    }
    return loadClinicalHistorySession(selected, { force: true });
}

export function renderClinicalHistorySection() {
    const state = getState();
    const meta = readClinicalHistoryMeta(state);
    const slice = getClinicalHistorySlice(state);
    const review = currentReviewSource(state);
    const draft = currentDraftSource(state);
    const activeWorkspace = currentActiveWorkspace(state);
    const queueFilter = currentQueueFilter(state);

    renderClinicalHeader(review, meta);
    setHtml(
        '#clinicalHistoryWorkspaceTabs',
        buildWorkspaceTabs(activeWorkspace, meta)
    );
    setHtml(
        '#clinicalHistoryQueueFilters',
        buildQueueFilterChips(meta, queueFilter)
    );
    setText('#clinicalHistoryQueueMeta', buildQueueMetaText(meta, queueFilter));
    setText('#clinicalHistoryTranscriptMeta', buildTranscriptMetaText(review));
    setText(
        '#clinicalHistoryTranscriptCount',
        buildTranscriptCountText(review)
    );
    setText('#clinicalHistoryEventsMeta', buildEventsMetaText(review));

    setHtml('#clinicalHistorySummaryGrid', buildSummaryCards(review));
    setHtml(
        '#clinicalHistoryLegalReadinessPanel',
        buildLegalReadinessPanel(review)
    );
    setHtml(
        '#clinicalHistoryApprovalConstancy',
        buildApprovalConstancy(review)
    );
    setHtml(
        '#clinicalHistoryRecordsGovernancePanel',
        buildRecordsGovernancePanel(review, slice.saving)
    );
    setHtml('#clinicalHistoryAttachmentStrip', buildAttachmentStrip(review));
    setHtml(
        '#clinicalHistoryQueueList',
        buildQueueList(
            meta,
            normalizeString(slice.selectedSessionId),
            slice.loading,
            queueFilter
        )
    );
    setHtml(
        '#clinicalHistoryTranscript',
        buildTranscript(review, slice.loading, slice.error)
    );
    setHtml('#clinicalHistoryDraftForm', buildDraftForm(draft, slice.saving));
    setHtml('#clinicalHistoryEvents', buildEvents(review));

    syncFollowUpInput();
    syncDraftStatusMeta();
    syncWorkspaceVisibility(activeWorkspace);
    bindClinicalHistoryEvents();
    ensureSessionSelection();
}
