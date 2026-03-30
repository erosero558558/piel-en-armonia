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
import { renderClinicalMediaFlow } from './media-flow.js';

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
    {
        workspace: 'media-flow',
        label: 'Before/After',
        metaLabel: (_meta, state = getState()) =>
            `${normalizeList(state?.data?.mediaFlowMeta?.queue).length} caso(s) con media`,
    },
    {
        workspace: 'compare',
        label: 'Evolución Visual',
        metaLabel: () => 'Comparación fotográfica',
    },
]);
const CLINICAL_HISTORY_SEX_CHOICES = Object.freeze([
    { value: '', label: 'Sin dato' },
    { value: 'femenino', label: 'Femenino' },
    { value: 'masculino', label: 'Masculino' },
    { value: 'intersexual', label: 'Intersexual' },
]);
const CLINICAL_HISTORY_DOCUMENT_TYPE_CHOICES = Object.freeze([
    { value: 'cedula', label: 'Cédula' },
    { value: 'passport', label: 'Pasaporte' },
    { value: 'other', label: 'Otro' },
]);
const CLINICAL_HISTORY_ADMISSION_KIND_CHOICES = Object.freeze([
    { value: '', label: 'Sin dato' },
    { value: 'first', label: 'Primera' },
    { value: 'subsequent', label: 'Subsecuente' },
]);
const CLINICAL_HISTORY_ZONE_TYPE_CHOICES = Object.freeze([
    { value: '', label: 'Sin dato' },
    { value: 'urbana', label: 'Urbana' },
    { value: 'rural', label: 'Rural' },
]);
const CLINICAL_HISTORY_PREGNANCY_CHOICES = Object.freeze([
    { value: '', label: 'Sin dato' },
    { value: 'no', label: 'No' },
    { value: 'yes', label: 'Si' },
]);
const CLINICAL_HISTORY_LAB_ORDER_PRIORITY_CHOICES = Object.freeze([
    { value: 'routine', label: 'Rutina' },
    { value: 'urgent', label: 'Urgente' },
    { value: 'control', label: 'Control' },
]);
const CLINICAL_HISTORY_IMAGING_STUDY_GROUPS = Object.freeze([
    {
        key: 'conventionalRadiography',
        label: 'R-X convencional',
        hint: 'Una linea por estudio solicitado.',
    },
    {
        key: 'tomography',
        label: 'Tomografia',
        hint: 'Ej.: TAC macizo facial, TAC torax.',
    },
    {
        key: 'magneticResonance',
        label: 'Resonancia',
        hint: 'Ej.: RM cerebral, RM partes blandas.',
    },
    {
        key: 'ultrasound',
        label: 'Ecografia',
        hint: 'Incluye ecografia general u obstetrica si aplica.',
    },
    {
        key: 'procedures',
        label: 'Procedimiento',
        hint: 'Procedimientos guiados o intervencionistas.',
    },
    {
        key: 'others',
        label: 'Otros',
        hint: 'Modalidades no cubiertas por los grupos anteriores.',
    },
]);
const CLINICAL_HISTORY_LAB_STUDY_OPTIONS = Object.freeze({
    hematology: [
        'Biometria hematica',
        'Plaquetas',
        'Grupo sanguineo y RH',
        'Indices hematicos',
        'TP / TTP',
        'Reticulocitos',
    ],
    urinalysis: [
        'Elemental y microscopico',
        'Gota fresca',
        'Prueba de embarazo',
    ],
    coprological: [
        'Coproparasitario',
        'Copro seriado',
        'Sangre oculta',
        'Investigacion de polimorfos',
        'Rotavirus',
    ],
    bloodChemistry: [
        'Glucosa en ayunas',
        'Urea',
        'Creatinina',
        'Colesterol total',
        'Trigliceridos',
        'ALT / TGP',
        'AST / TGO',
        'Acido urico',
        'Proteina total',
        'Albumina',
    ],
    serology: ['VDRL', 'Latex', 'ASTO', 'Aglutinaciones febriles'],
    bacteriology: ['Gram', 'Ziehl', 'Cultivo con antibiograma', 'Hongos'],
});
const CLINICAL_RED_FLAG_LABELS = Object.freeze({
    lesion_over_6mm: 'Lesion mayor a 6 mm',
    mole_color_change: 'Cambio de color en lunar',
    rapid_growth: 'Crecimiento rapido',
    rosacea_flare: 'Brote de rosacea',
    telemedicine_follow_up: 'Seguimiento clinico requerido',
    pediatric_case: 'Caso pediatrico',
    dolor_pecho: 'Dolor toracico',
    disnea: 'Disnea',
    sangrado: 'Sangrado activo',
    fiebre_alta: 'Fiebre alta',
    anafilaxia: 'Anafilaxia',
    embarazo: 'Embarazo',
});

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

function normalizeTextareaList(value) {
    if (Array.isArray(value)) {
        return normalizeStringList(value);
    }

    return normalizeString(value)
        .split(/\r?\n|,/)
        .map((item) => normalizeString(item))
        .filter(Boolean);
}

function formatTextareaList(value) {
    return normalizeStringList(value).join('\n');
}

export function normalizeClinicalHistoryWorkspace(value) {
    const normalized = normalizeString(value).toLowerCase();
    return normalized === 'media-flow' ? 'media-flow' : 'review';
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

function hasClinicalMediaFlowCases(state = getState()) {
    return normalizeList(state?.data?.mediaFlowMeta?.queue).length > 0;
}

function availableClinicalHistoryWorkspaces(state = getState()) {
    return CLINICAL_HISTORY_WORKSPACE_OPTIONS.filter(({ workspace }) =>
        workspace === 'media-flow' ? hasClinicalMediaFlowCases(state) : true
    );
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

function emptyPrescriptionItem() {
    return {
        medication: '',
        presentation: '',
        dose: '',
        route: '',
        frequency: '',
        duration: '',
        quantity: '',
        instructions: '',
    };
}

function emptyHcu005() {
    return {
        evolutionNote: '',
        diagnosticImpression: '',
        therapeuticPlan: '',
        careIndications: '',
        prescriptionItems: [],
    };
}

function emptyConsentPacket() {
    return {
        packetId: '',
        templateKey: 'generic',
        sourceMode: '',
        title: 'Consentimiento informado HCU-form.024/2008',
        procedureKey: 'generic',
        procedureLabel: 'Consentimiento genérico',
        status: 'draft',
        writtenRequired: true,
        careMode: 'ambulatorio',
        serviceLabel: '',
        establishmentLabel: '',
        patientName: '',
        patientDocumentNumber: '',
        patientRecordId: '',
        encounterDateTime: '',
        diagnosisLabel: '',
        diagnosisCie10: '',
        procedureName: '',
        procedureWhatIsIt: '',
        procedureHowItIsDone: '',
        durationEstimate: '',
        graphicRef: '',
        benefits: '',
        frequentRisks: '',
        rareSeriousRisks: '',
        patientSpecificRisks: '',
        alternatives: '',
        postProcedureCare: '',
        noProcedureConsequences: '',
        privateCommunicationConfirmed: false,
        companionShareAuthorized: false,
        declaration: {
            declaredAt: '',
            patientCanConsent: true,
            capacityAssessment: '',
            notes: '',
        },
        denial: {
            declinedAt: '',
            reason: '',
            patientRefusedSignature: false,
            notes: '',
        },
        revocation: {
            revokedAt: '',
            receivedBy: '',
            reason: '',
            notes: '',
        },
        patientAttestation: {
            name: '',
            documentNumber: '',
            signedAt: '',
            refusedSignature: false,
        },
        representativeAttestation: {
            name: '',
            kinship: '',
            documentNumber: '',
            phone: '',
            signedAt: '',
        },
        professionalAttestation: {
            name: '',
            role: 'medico_tratante',
            documentNumber: '',
            signedAt: '',
        },
        anesthesiologistAttestation: {
            applicable: false,
            name: '',
            documentNumber: '',
            signedAt: '',
        },
        witnessAttestation: {
            name: '',
            documentNumber: '',
            phone: '',
            signedAt: '',
        },
        history: [],
        createdAt: '',
        updatedAt: '',
    };
}

function emptyConsentFormSnapshot() {
    return {
        snapshotId: '',
        finalizedAt: '',
        snapshotAt: '',
        ...emptyConsentPacket(),
    };
}

function emptyInterconsultationDiagnosis(type = 'pre') {
    return {
        type,
        label: '',
        cie10: '',
    };
}

function emptyInterconsultReport() {
    return {
        status: 'not_received',
        reportedAt: '',
        reportedBy: '',
        receivedBy: '',
        respondingEstablishment: '',
        respondingService: '',
        consultantProfessionalName: '',
        consultantProfessionalRole: '',
        reportSummary: '',
        clinicalFindings: '',
        diagnosticOpinion: '',
        recommendations: '',
        followUpIndications: '',
        sourceDocumentType: '',
        sourceReference: '',
        attachments: [],
        history: [],
        createdAt: '',
        updatedAt: '',
    };
}

function emptyInterconsultation() {
    return {
        interconsultId: '',
        status: 'draft',
        reportStatus: 'not_received',
        requiredForCurrentPlan: false,
        priority: 'normal',
        requestedAt: '',
        requestingEstablishment: '',
        requestingService: '',
        destinationEstablishment: '',
        destinationService: '',
        consultedProfessionalName: '',
        patientName: '',
        patientDocumentNumber: '',
        patientRecordId: '',
        patientAgeYears: null,
        patientSexAtBirth: '',
        clinicalPicture: '',
        requestReason: '',
        diagnoses: [
            emptyInterconsultationDiagnosis('pre'),
            emptyInterconsultationDiagnosis('def'),
        ],
        performedDiagnosticsSummary: '',
        therapeuticMeasuresDone: '',
        questionForConsultant: '',
        issuedBy: '',
        issuedAt: '',
        cancelledAt: '',
        cancelReason: '',
        report: emptyInterconsultReport(),
        history: [],
        createdAt: '',
        updatedAt: '',
    };
}

function emptyInterconsultFormSnapshot() {
    return {
        snapshotId: '',
        finalizedAt: '',
        snapshotAt: '',
        ...emptyInterconsultation(),
    };
}

function emptyInterconsultReportSnapshot() {
    return {
        snapshotId: '',
        interconsultId: '',
        interconsultStatus: '',
        destinationEstablishment: '',
        destinationService: '',
        consultedProfessionalName: '',
        reportStatus: 'draft',
        finalizedAt: '',
        snapshotAt: '',
        report: emptyInterconsultReport(),
    };
}

function emptyLabOrder() {
    return {
        labOrderId: '',
        status: 'draft',
        requiredForCurrentPlan: false,
        priority: 'routine',
        requestedAt: '',
        sampleDate: '',
        requestingEstablishment: '',
        requestingService: '',
        careSite: '',
        bedLabel: '',
        requestedBy: '',
        patientName: '',
        patientDocumentNumber: '',
        patientRecordId: '',
        patientAgeYears: null,
        patientSexAtBirth: '',
        diagnoses: [
            emptyInterconsultationDiagnosis('pre'),
            emptyInterconsultationDiagnosis('def'),
        ],
        studySelections: {
            hematology: [],
            urinalysis: [],
            coprological: [],
            bloodChemistry: [],
            serology: [],
            bacteriology: [],
            others: '',
        },
        bacteriologySampleSource: '',
        physicianPresentAtExam: false,
        notes: '',
        issuedAt: '',
        cancelledAt: '',
        cancelReason: '',
        history: [],
        createdAt: '',
        updatedAt: '',
    };
}

function emptyLabOrderSnapshot() {
    return {
        snapshotId: '',
        finalizedAt: '',
        snapshotAt: '',
        ...emptyLabOrder(),
    };
}

function emptyImagingOrder() {
    return {
        imagingOrderId: '',
        status: 'draft',
        resultStatus: 'not_received',
        requiredForCurrentPlan: false,
        priority: 'routine',
        requestedAt: '',
        studyDate: '',
        requestingEstablishment: '',
        requestingService: '',
        careSite: '',
        bedLabel: '',
        requestedBy: '',
        patientName: '',
        patientDocumentNumber: '',
        patientRecordId: '',
        patientAgeYears: null,
        patientSexAtBirth: '',
        diagnoses: [
            emptyInterconsultationDiagnosis('pre'),
            emptyInterconsultationDiagnosis('def'),
        ],
        studySelections: {
            conventionalRadiography: [],
            tomography: [],
            magneticResonance: [],
            ultrasound: [],
            procedures: [],
            others: [],
        },
        requestReason: '',
        clinicalSummary: '',
        canMobilize: false,
        canRemoveDressingsOrCasts: false,
        physicianPresentAtExam: false,
        bedsideRadiography: false,
        notes: '',
        issuedAt: '',
        cancelledAt: '',
        cancelReason: '',
        result: {
            status: 'not_received',
            reportedAt: '',
            reportedBy: '',
            receivedBy: '',
            reportingEstablishment: '',
            reportingService: '',
            radiologistProfessionalName: '',
            radiologistProfessionalRole: '',
            studyPerformedSummary: '',
            findings: '',
            diagnosticImpression: '',
            recommendations: '',
            followUpIndications: '',
            sourceDocumentType: '',
            sourceReference: '',
            attachments: [],
            history: [],
            createdAt: '',
            updatedAt: '',
        },
        history: [],
        createdAt: '',
        updatedAt: '',
    };
}

function emptyImagingOrderSnapshot() {
    return {
        snapshotId: '',
        finalizedAt: '',
        snapshotAt: '',
        ...emptyImagingOrder(),
    };
}

function emptyImagingReport() {
    return {
        status: 'not_received',
        reportedAt: '',
        reportedBy: '',
        receivedBy: '',
        reportingEstablishment: '',
        reportingService: '',
        radiologistProfessionalName: '',
        radiologistProfessionalRole: '',
        studyPerformedSummary: '',
        findings: '',
        diagnosticImpression: '',
        recommendations: '',
        followUpIndications: '',
        sourceDocumentType: '',
        sourceReference: '',
        attachments: [],
        history: [],
        createdAt: '',
        updatedAt: '',
    };
}

function emptyImagingReportSnapshot() {
    return {
        snapshotId: '',
        imagingOrderId: '',
        imagingOrderStatus: '',
        studySelections: {
            conventionalRadiography: [],
            tomography: [],
            magneticResonance: [],
            ultrasound: [],
            procedures: [],
            others: [],
        },
        requestReason: '',
        reportStatus: 'draft',
        finalizedAt: '',
        snapshotAt: '',
        report: emptyImagingReport(),
    };
}

function emptyAdmission001() {
    return {
        identity: {
            documentType: 'cedula',
            documentNumber: '',
            apellidoPaterno: '',
            apellidoMaterno: '',
            primerNombre: '',
            segundoNombre: '',
        },
        demographics: {
            birthDate: '',
            ageYears: null,
            sexAtBirth: '',
            maritalStatus: '',
            educationLevel: '',
            occupation: '',
            employer: '',
            nationalityCountry: '',
            culturalGroup: '',
            birthPlace: '',
        },
        residence: {
            addressLine: '',
            neighborhood: '',
            zoneType: '',
            parish: '',
            canton: '',
            province: '',
            phone: '',
        },
        coverage: {
            healthInsuranceType: '',
        },
        referral: {
            referredBy: '',
        },
        emergencyContact: {
            name: '',
            kinship: '',
            phone: '',
        },
        admissionMeta: {
            admissionDate: '',
            admissionKind: '',
            admittedBy: '',
            transitionMode: 'legacy_inferred',
        },
        history: {
            admissionHistory: [],
            changeLog: [],
        },
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
        redFlags: [],
        intake: {
            motivoConsulta: '',
            enfermedadActual: '',
            antecedentes: '',
            alergias: '',
            medicacionActual: '',
            fototipoFitzpatrick: '',
            habitos: '',
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
                telefono: '',
                fechaNacimiento: '',
                embarazo: null,
            },
        },
        clinicianDraft: {
            resumen: '',
            preguntasFaltantes: [],
            cie10Sugeridos: [],
            tratamientoBorrador: '',
            posologiaBorrador: emptyPosology(),
            hcu005: emptyHcu005(),
        },
        admission001: emptyAdmission001(),
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
                'SNS-MSP/HCU-form.010A/2008',
                'SNS-MSP/HCU-form.012A/2008',
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
                sections: {
                    hcu001: emptyAdmission001(),
                    hcu005: emptyHcu005(),
                },
            },
            prescription: {
                status: 'draft',
                medication: '',
                directions: '',
                signedAt: '',
                confidential: true,
                items: [],
            },
            certificate: {
                status: 'draft',
                summary: '',
                restDays: null,
                signedAt: '',
                confidential: true,
            },
            carePlan: {
                status: 'draft',
                diagnosis: '',
                treatments: '',
                followUpFrequency: '',
                goals: '',
                generatedAt: '',
            },
            interconsultForms: [],
            interconsultReports: [],
            labOrders: [],
            imagingOrders: [],
            imagingReports: [],
            consentForms: [],
        },
        interconsultations: [],
        activeInterconsultationId: '',
        labOrders: [],
        activeLabOrderId: '',
        imagingOrders: [],
        activeImagingOrderId: '',
        consentPackets: [],
        activeConsentPacketId: '',
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
                birthDate: '',
                documentType: '',
                documentNumber: '',
                legalName: '',
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
        interconsultations: [],
        activeInterconsultationId: '',
        activeInterconsultation: emptyInterconsultation(),
        labOrders: [],
        activeLabOrderId: '',
        activeLabOrder: emptyLabOrder(),
        imagingOrders: [],
        activeImagingOrderId: '',
        activeImagingOrder: emptyImagingOrder(),
        consentPackets: [],
        activeConsentPacketId: '',
        activeConsentPacket: emptyConsentPacket(),
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
            hcu001Status: hcu001StatusMeta('missing'),
            hcu005Status: hcu005StatusMeta('missing'),
            hcu007Status: hcu007StatusMeta('not_applicable'),
            hcu007ReportStatus: hcu007ReportStatusMeta('not_received'),
            hcu010AStatus: hcu010AStatusMeta('not_applicable'),
            hcu012AStatus: hcu012AStatusMeta('not_applicable'),
            hcu012AReportStatus: hcu012AReportStatusMeta('not_received'),
            hcu024Status: hcu024StatusMeta('not_applicable'),
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
        birthDate: normalizeString(source.birthDate || source.fechaNacimiento),
        documentType: normalizeString(source.documentType),
        documentNumber: normalizeString(source.documentNumber),
        legalName: normalizeString(source.legalName),
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

function normalizeAttachmentList(items) {
    return normalizeList(items).map(normalizeAttachment);
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

function normalizePrescriptionItem(item) {
    const source = item && typeof item === 'object' ? item : {};
    return {
        medication: normalizeString(source.medication),
        presentation: normalizeString(source.presentation),
        dose: normalizeString(source.dose),
        route: normalizeString(source.route),
        frequency: normalizeString(source.frequency),
        duration: normalizeString(source.duration),
        quantity: normalizeString(source.quantity),
        instructions: normalizeString(source.instructions),
    };
}

function normalizePrescriptionItems(items) {
    return normalizeList(items).map(normalizePrescriptionItem);
}

function prescriptionItemStarted(item) {
    return Object.values(normalizePrescriptionItem(item)).some(
        (value) => normalizeString(value) !== ''
    );
}

function normalizeHcu005(source, fallback = {}) {
    const defaults = emptyHcu005();
    const safeSource = source && typeof source === 'object' ? source : {};
    const safeFallback =
        fallback && typeof fallback === 'object' ? fallback : {};

    return {
        ...defaults,
        ...safeFallback,
        ...safeSource,
        evolutionNote: normalizeString(
            safeSource.evolutionNote ?? safeFallback.evolutionNote
        ),
        diagnosticImpression: normalizeString(
            safeSource.diagnosticImpression ?? safeFallback.diagnosticImpression
        ),
        therapeuticPlan: normalizeString(
            safeSource.therapeuticPlan ?? safeFallback.therapeuticPlan
        ),
        careIndications: normalizeString(
            safeSource.careIndications ?? safeFallback.careIndications
        ),
        prescriptionItems: normalizePrescriptionItems(
            safeSource.prescriptionItems ?? safeFallback.prescriptionItems
        ),
    };
}

function normalizeAdmissionHistoryItem(item) {
    const source = item && typeof item === 'object' ? item : {};
    return {
        entryId: normalizeString(source.entryId || source.id),
        episodeId: normalizeString(source.episodeId),
        caseId: normalizeString(source.caseId),
        admissionDate: normalizeString(source.admissionDate),
        admissionKind: normalizeString(source.admissionKind),
        admittedBy: normalizeString(source.admittedBy),
        createdAt: normalizeString(source.createdAt || source.admissionDate),
    };
}

function normalizeAdmissionChangeItem(item) {
    const source = item && typeof item === 'object' ? item : {};
    return {
        changeId: normalizeString(source.changeId || source.id),
        actor: normalizeString(source.actor),
        actorRole: normalizeString(source.actorRole),
        changedAt: normalizeString(source.changedAt || source.createdAt),
        fields: normalizeStringList(source.fields),
        summary: normalizeString(source.summary),
    };
}

function buildAdmissionLegalName(admission, fallbackPatient = {}) {
    const normalized = normalizeAdmission001(admission, fallbackPatient);
    const identity = normalized.identity;
    const legalName = [
        identity.primerNombre,
        identity.segundoNombre,
        identity.apellidoPaterno,
        identity.apellidoMaterno,
    ]
        .filter(Boolean)
        .join(' ');

    return legalName || normalizeString(fallbackPatient.name);
}

function normalizeAdmission001(
    source,
    fallbackPatient = {},
    fallbackIntake = {}
) {
    const defaults = emptyAdmission001();
    const safeSource = source && typeof source === 'object' ? source : {};
    const facts =
        fallbackIntake?.datosPaciente &&
        typeof fallbackIntake.datosPaciente === 'object'
            ? fallbackIntake.datosPaciente
            : {};
    const patient = normalizePatient(fallbackPatient);
    const identity =
        safeSource.identity && typeof safeSource.identity === 'object'
            ? safeSource.identity
            : {};
    const demographics =
        safeSource.demographics && typeof safeSource.demographics === 'object'
            ? safeSource.demographics
            : {};
    const residence =
        safeSource.residence && typeof safeSource.residence === 'object'
            ? safeSource.residence
            : {};
    const coverage =
        safeSource.coverage && typeof safeSource.coverage === 'object'
            ? safeSource.coverage
            : {};
    const referral =
        safeSource.referral && typeof safeSource.referral === 'object'
            ? safeSource.referral
            : {};
    const emergency =
        safeSource.emergencyContact &&
        typeof safeSource.emergencyContact === 'object'
            ? safeSource.emergencyContact
            : {};
    const admissionMeta =
        safeSource.admissionMeta && typeof safeSource.admissionMeta === 'object'
            ? safeSource.admissionMeta
            : {};
    const history =
        safeSource.history && typeof safeSource.history === 'object'
            ? safeSource.history
            : {};
    const documentType = normalizeString(
        identity.documentType ||
            patient.documentType ||
            defaults.identity.documentType
    );

    return {
        identity: {
            ...defaults.identity,
            documentType: ['cedula', 'passport', 'other'].includes(documentType)
                ? documentType
                : defaults.identity.documentType,
            documentNumber: normalizeString(
                identity.documentNumber || patient.documentNumber
            ),
            apellidoPaterno: normalizeString(identity.apellidoPaterno),
            apellidoMaterno: normalizeString(identity.apellidoMaterno),
            primerNombre: normalizeString(identity.primerNombre),
            segundoNombre: normalizeString(identity.segundoNombre),
        },
        demographics: {
            ...defaults.demographics,
            birthDate: normalizeString(
                demographics.birthDate ||
                    facts.fechaNacimiento ||
                    patient.birthDate
            ),
            ageYears: normalizeNullableInt(
                demographics.ageYears || facts.edadAnios || patient.ageYears
            ),
            sexAtBirth: normalizeString(
                demographics.sexAtBirth ||
                    facts.sexoBiologico ||
                    patient.sexAtBirth
            ),
            maritalStatus: normalizeString(demographics.maritalStatus),
            educationLevel: normalizeString(demographics.educationLevel),
            occupation: normalizeString(demographics.occupation),
            employer: normalizeString(demographics.employer),
            nationalityCountry: normalizeString(
                demographics.nationalityCountry
            ),
            culturalGroup: normalizeString(demographics.culturalGroup),
            birthPlace: normalizeString(demographics.birthPlace),
        },
        residence: {
            ...defaults.residence,
            addressLine: normalizeString(residence.addressLine),
            neighborhood: normalizeString(residence.neighborhood),
            zoneType: normalizeString(residence.zoneType),
            parish: normalizeString(residence.parish),
            canton: normalizeString(residence.canton),
            province: normalizeString(residence.province),
            phone: normalizeString(
                residence.phone || facts.telefono || patient.phone
            ),
        },
        coverage: {
            ...defaults.coverage,
            healthInsuranceType: normalizeString(coverage.healthInsuranceType),
        },
        referral: {
            ...defaults.referral,
            referredBy: normalizeString(referral.referredBy),
        },
        emergencyContact: {
            ...defaults.emergencyContact,
            name: normalizeString(emergency.name),
            kinship: normalizeString(emergency.kinship),
            phone: normalizeString(emergency.phone),
        },
        admissionMeta: {
            ...defaults.admissionMeta,
            admissionDate: normalizeString(admissionMeta.admissionDate),
            admissionKind: normalizeString(admissionMeta.admissionKind),
            admittedBy: normalizeString(admissionMeta.admittedBy),
            transitionMode:
                normalizeString(admissionMeta.transitionMode) ||
                defaults.admissionMeta.transitionMode,
        },
        history: {
            admissionHistory: normalizeList(
                history.admissionHistory || safeSource.admissionHistory
            ).map(normalizeAdmissionHistoryItem),
            changeLog: normalizeList(
                history.changeLog || safeSource.changeLog
            ).map(normalizeAdmissionChangeItem),
        },
    };
}

function evaluateHcu001(admission, fallbackPatient = {}, fallbackIntake = {}) {
    const normalized = normalizeAdmission001(
        admission,
        fallbackPatient,
        fallbackIntake
    );
    const identity = normalized.identity;
    const demographics = normalized.demographics;
    const residence = normalized.residence;
    const coverage = normalized.coverage;
    const emergencyContact = normalized.emergencyContact;
    const admissionMeta = normalized.admissionMeta;
    const hasResidence = Boolean(
        normalizeString(residence.addressLine) ||
        normalizeString(residence.neighborhood) ||
        normalizeString(residence.parish) ||
        normalizeString(residence.canton) ||
        normalizeString(residence.province)
    );
    const hasIdentity =
        normalizeString(identity.documentNumber) !== '' &&
        normalizeString(identity.primerNombre) !== '' &&
        normalizeString(identity.apellidoPaterno) !== '';
    const hasBirthReference =
        normalizeString(demographics.birthDate) !== '' ||
        demographics.ageYears !== null;
    const hasSex = normalizeString(demographics.sexAtBirth) !== '';
    const hasResidenceContact =
        normalizeString(residence.phone) !== '' && hasResidence;
    const hasInsurance = normalizeString(coverage.healthInsuranceType) !== '';
    const hasEmergency =
        normalizeString(emergencyContact.name) !== '' &&
        normalizeString(emergencyContact.phone) !== '';
    const hasAdmissionDate =
        normalizeString(admissionMeta.admissionDate) !== '';
    const hasAdmissionKind =
        normalizeString(admissionMeta.admissionKind) === 'first' ||
        normalizeString(admissionMeta.admissionKind) === 'subsequent';
    const complete =
        hasIdentity &&
        hasBirthReference &&
        hasSex &&
        hasResidenceContact &&
        hasInsurance &&
        hasEmergency &&
        hasAdmissionDate &&
        hasAdmissionKind;
    const patient = normalizePatient(fallbackPatient);
    const legacySignals =
        normalizeString(patient.name) !== '' ||
        normalizeString(patient.phone) !== '' ||
        patient.ageYears !== null ||
        normalizeString(patient.sexAtBirth) !== '' ||
        normalizeString(fallbackIntake?.motivoConsulta) !== '' ||
        normalizeString(fallbackIntake?.resumenClinico) !== '';
    const explicitContent =
        complete ||
        normalizeString(identity.apellidoMaterno) !== '' ||
        normalizeString(identity.segundoNombre) !== '' ||
        normalizeString(demographics.maritalStatus) !== '' ||
        normalizeString(demographics.educationLevel) !== '' ||
        normalizeString(demographics.occupation) !== '' ||
        normalizeString(demographics.employer) !== '' ||
        normalizeString(demographics.nationalityCountry) !== '' ||
        normalizeString(demographics.culturalGroup) !== '' ||
        normalizeString(demographics.birthPlace) !== '' ||
        normalizeString(residence.zoneType) !== '' ||
        normalizeString(residence.phone) !== '' ||
        normalizeList(normalized.history.admissionHistory).length > 0;
    const legacyPartial =
        !complete &&
        normalizeString(admissionMeta.transitionMode) !== 'new_required' &&
        (legacySignals || explicitContent);
    const missingCoreFields = [];
    if (!hasIdentity) missingCoreFields.push('identity');
    if (!hasAdmissionDate) missingCoreFields.push('admission_date');
    if (!hasAdmissionKind) missingCoreFields.push('admission_kind');
    if (!hasSex) missingCoreFields.push('sex_at_birth');
    if (!hasBirthReference) missingCoreFields.push('birth_reference');
    if (!hasResidenceContact) missingCoreFields.push('residence_contact');
    if (!hasInsurance) missingCoreFields.push('health_insurance_type');
    if (!hasEmergency) missingCoreFields.push('emergency_contact');

    return {
        status: complete
            ? 'complete'
            : legacyPartial
              ? 'legacy_partial'
              : explicitContent
                ? 'partial'
                : 'missing',
        missingCoreFields,
        blocksApproval: !complete && !legacyPartial,
        transitionMode:
            normalizeString(admissionMeta.transitionMode) || 'legacy_inferred',
    };
}

function hcu001StatusMeta(status) {
    switch (normalizeString(status)) {
        case 'complete':
            return {
                status: 'complete',
                label: 'HCU-001 completa',
                summary:
                    'La admisión longitudinal ya deja identidad y contacto base defendibles.',
            };
        case 'legacy_partial':
            return {
                status: 'legacy_partial',
                label: 'HCU-001 heredada por regularizar',
                summary:
                    'El expediente heredado necesita regularización de admisión, pero no se congela por eso.',
            };
        case 'partial':
            return {
                status: 'partial',
                label: 'HCU-001 parcial',
                summary:
                    'La admisión ya tiene datos, pero aún faltan campos núcleo del expediente.',
            };
        default:
            return {
                status: 'missing',
                label: 'HCU-001 faltante',
                summary:
                    'Todavía falta registrar la admisión HCU-001 del expediente.',
            };
    }
}

function formatAdmissionKindLabel(kind) {
    switch (normalizeString(kind)) {
        case 'first':
            return 'Primera admision';
        case 'subsequent':
            return 'Admision subsecuente';
        default:
            return '';
    }
}

function renderHcu005Summary(hcu005) {
    const normalized = normalizeHcu005(hcu005);
    return (
        normalized.diagnosticImpression ||
        normalized.evolutionNote ||
        [normalized.therapeuticPlan, normalized.careIndications]
            .filter(Boolean)
            .join(' | ')
    );
}

function renderHcu005Content(hcu005) {
    const normalized = normalizeHcu005(hcu005);
    return [
        normalized.evolutionNote
            ? `Evolución clínica: ${normalized.evolutionNote}`
            : '',
        normalized.diagnosticImpression
            ? `Impresión diagnóstica: ${normalized.diagnosticImpression}`
            : '',
        normalized.therapeuticPlan
            ? `Plan terapéutico: ${normalized.therapeuticPlan}`
            : '',
        normalized.careIndications
            ? `Indicaciones / cuidados: ${normalized.careIndications}`
            : '',
    ]
        .filter(Boolean)
        .join('\n');
}

function renderPrescriptionMedicationMirror(items) {
    return normalizePrescriptionItems(items)
        .filter(prescriptionItemStarted)
        .map((item) =>
            [item.medication, item.presentation].filter(Boolean).join(' ')
        )
        .filter(Boolean)
        .join('\n');
}

function renderPrescriptionDirectionsMirror(items) {
    return normalizePrescriptionItems(items)
        .filter(prescriptionItemStarted)
        .map((item) => {
            const segments = [
                item.dose,
                item.route,
                item.frequency,
                item.duration,
                item.quantity ? `Cantidad ${item.quantity}` : '',
            ].filter(Boolean);
            const base = item.medication
                ? `${item.medication}: ${segments.join(' • ')}`
                : segments.join(' • ');
            return item.instructions
                ? [base, item.instructions].filter(Boolean).join('. ')
                : base;
        })
        .filter(Boolean)
        .join('\n');
}

function evaluateHcu005(hcu005) {
    const normalized = normalizeHcu005(hcu005);
    const startedItems = normalized.prescriptionItems.filter(
        prescriptionItemStarted
    );
    const incompleteItems = startedItems.filter((item) =>
        Object.values(item).some((value) => normalizeString(value) === '')
    );
    const hasEvolutionNote = normalized.evolutionNote !== '';
    const hasDiagnosticImpression = normalized.diagnosticImpression !== '';
    const hasPlanOrCare =
        normalized.therapeuticPlan !== '' || normalized.careIndications !== '';
    const hasAnyContent =
        hasEvolutionNote ||
        hasDiagnosticImpression ||
        hasPlanOrCare ||
        startedItems.length > 0;
    const status = !hasAnyContent
        ? 'missing'
        : hasEvolutionNote &&
            hasDiagnosticImpression &&
            hasPlanOrCare &&
            incompleteItems.length === 0
          ? 'complete'
          : 'partial';

    return {
        status,
        hasEvolutionNote,
        hasDiagnosticImpression,
        hasPlanOrCare,
        startedPrescriptionItems: startedItems.length,
        incompletePrescriptionItems: incompleteItems.length,
    };
}

function hcu005StatusMeta(status) {
    switch (normalizeString(status)) {
        case 'complete':
            return {
                status: 'complete',
                label: 'HCU-005 completo',
                summary:
                    'La evolución, la impresión diagnóstica y el plan ya sostienen el HCU-005.',
            };
        case 'partial':
            return {
                status: 'partial',
                label: 'HCU-005 parcial',
                summary:
                    'El episodio ya tiene contenido HCU-005, pero faltan bloques o prescripciones por cerrar.',
            };
        default:
            return {
                status: 'missing',
                label: 'HCU-005 pendiente',
                summary:
                    'Todavía no hay cobertura suficiente del HCU-005 para este episodio.',
            };
    }
}

function normalizeInterconsultationDiagnosis(diagnosis, fallbackType = 'pre') {
    const source = diagnosis && typeof diagnosis === 'object' ? diagnosis : {};
    const type = normalizeString(source.type || fallbackType);
    return {
        type: ['pre', 'def'].includes(type) ? type : fallbackType,
        label: normalizeString(source.label),
        cie10: normalizeString(source.cie10),
    };
}

function normalizeInterconsultationDiagnoses(items) {
    const normalized = normalizeList(items).map((item, index) =>
        normalizeInterconsultationDiagnosis(item, index === 1 ? 'def' : 'pre')
    );
    if (normalized.length === 0) {
        return [
            emptyInterconsultationDiagnosis('pre'),
            emptyInterconsultationDiagnosis('def'),
        ];
    }
    if (!normalized.some((item) => item.type === 'pre')) {
        normalized.unshift(emptyInterconsultationDiagnosis('pre'));
    }
    if (!normalized.some((item) => item.type === 'def')) {
        normalized.push(emptyInterconsultationDiagnosis('def'));
    }
    return normalized;
}

function normalizeInterconsultReport(report, fallback = {}) {
    const defaults = emptyInterconsultReport();
    const safeSource = report && typeof report === 'object' ? report : {};
    const safeFallback =
        fallback && typeof fallback === 'object' ? fallback : {};

    return {
        ...defaults,
        ...safeFallback,
        ...safeSource,
        status:
            normalizeString(safeSource.status ?? safeFallback.status) ||
            defaults.status,
        reportedAt: normalizeString(
            safeSource.reportedAt ?? safeFallback.reportedAt
        ),
        reportedBy: normalizeString(
            safeSource.reportedBy ?? safeFallback.reportedBy
        ),
        receivedBy: normalizeString(
            safeSource.receivedBy ?? safeFallback.receivedBy
        ),
        respondingEstablishment: normalizeString(
            safeSource.respondingEstablishment ??
                safeFallback.respondingEstablishment
        ),
        respondingService: normalizeString(
            safeSource.respondingService ?? safeFallback.respondingService
        ),
        consultantProfessionalName: normalizeString(
            safeSource.consultantProfessionalName ??
                safeFallback.consultantProfessionalName
        ),
        consultantProfessionalRole: normalizeString(
            safeSource.consultantProfessionalRole ??
                safeFallback.consultantProfessionalRole
        ),
        reportSummary: normalizeString(
            safeSource.reportSummary ?? safeFallback.reportSummary
        ),
        clinicalFindings: normalizeString(
            safeSource.clinicalFindings ?? safeFallback.clinicalFindings
        ),
        diagnosticOpinion: normalizeString(
            safeSource.diagnosticOpinion ?? safeFallback.diagnosticOpinion
        ),
        recommendations: normalizeString(
            safeSource.recommendations ?? safeFallback.recommendations
        ),
        followUpIndications: normalizeString(
            safeSource.followUpIndications ?? safeFallback.followUpIndications
        ),
        sourceDocumentType: normalizeString(
            safeSource.sourceDocumentType ?? safeFallback.sourceDocumentType
        ),
        sourceReference: normalizeString(
            safeSource.sourceReference ?? safeFallback.sourceReference
        ),
        attachments: normalizeAttachmentList(
            safeSource.attachments ?? safeFallback.attachments
        ),
        history: normalizeList(safeSource.history ?? safeFallback.history),
        createdAt: normalizeString(
            safeSource.createdAt ?? safeFallback.createdAt
        ),
        updatedAt: normalizeString(
            safeSource.updatedAt ?? safeFallback.updatedAt
        ),
    };
}

function normalizeInterconsultReportSnapshot(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return {
        ...emptyInterconsultReportSnapshot(),
        ...source,
        snapshotId: normalizeString(source.snapshotId),
        interconsultId: normalizeString(source.interconsultId),
        interconsultStatus: normalizeString(source.interconsultStatus),
        destinationEstablishment: normalizeString(
            source.destinationEstablishment
        ),
        destinationService: normalizeString(source.destinationService),
        consultedProfessionalName: normalizeString(
            source.consultedProfessionalName
        ),
        reportStatus: normalizeString(source.reportStatus || 'draft'),
        finalizedAt: normalizeString(source.finalizedAt),
        snapshotAt: normalizeString(source.snapshotAt),
        report: normalizeInterconsultReport(source.report || source),
    };
}

function normalizeInterconsultReportSnapshots(items) {
    return normalizeList(items).map(normalizeInterconsultReportSnapshot);
}

function normalizeLabOrderStudySelections(items) {
    const source = items && typeof items === 'object' ? items : {};
    return {
        hematology: normalizeStringList(source.hematology),
        urinalysis: normalizeStringList(source.urinalysis),
        coprological: normalizeStringList(source.coprological),
        bloodChemistry: normalizeStringList(source.bloodChemistry),
        serology: normalizeStringList(source.serology),
        bacteriology: normalizeStringList(source.bacteriology),
        others: normalizeString(source.others),
    };
}

function flattenLabOrderStudySelections(studySelections) {
    const normalized = normalizeLabOrderStudySelections(studySelections);
    return [
        ...normalized.hematology,
        ...normalized.urinalysis,
        ...normalized.coprological,
        ...normalized.bloodChemistry,
        ...normalized.serology,
        ...normalized.bacteriology,
        normalized.others,
    ].filter((value) => normalizeString(value));
}

function normalizeImagingStudySelections(items) {
    const source = items && typeof items === 'object' ? items : {};
    return {
        conventionalRadiography: normalizeStringList(
            source.conventionalRadiography
        ),
        tomography: normalizeStringList(source.tomography),
        magneticResonance: normalizeStringList(source.magneticResonance),
        ultrasound: normalizeStringList(source.ultrasound),
        procedures: normalizeStringList(source.procedures),
        others: normalizeStringList(source.others),
    };
}

function flattenImagingStudySelections(studySelections) {
    const normalized = normalizeImagingStudySelections(studySelections);
    return [
        ...normalized.conventionalRadiography,
        ...normalized.tomography,
        ...normalized.magneticResonance,
        ...normalized.ultrasound,
        ...normalized.procedures,
        ...normalized.others,
    ].filter((value) => normalizeString(value));
}

function normalizeLabOrder(labOrder, fallback = {}) {
    const defaults = emptyLabOrder();
    const safeSource = labOrder && typeof labOrder === 'object' ? labOrder : {};
    const safeFallback =
        fallback && typeof fallback === 'object' ? fallback : {};

    return {
        ...defaults,
        ...safeFallback,
        ...safeSource,
        labOrderId: normalizeString(
            safeSource.labOrderId ?? safeFallback.labOrderId
        ),
        status:
            normalizeString(safeSource.status ?? safeFallback.status) ||
            defaults.status,
        requiredForCurrentPlan:
            safeSource.requiredForCurrentPlan === true ||
            (safeSource.requiredForCurrentPlan === undefined &&
                safeFallback.requiredForCurrentPlan === true),
        priority:
            normalizeString(safeSource.priority ?? safeFallback.priority) ||
            defaults.priority,
        requestedAt: normalizeString(
            safeSource.requestedAt ?? safeFallback.requestedAt
        ),
        sampleDate: normalizeString(
            safeSource.sampleDate ?? safeFallback.sampleDate
        ),
        requestingEstablishment: normalizeString(
            safeSource.requestingEstablishment ??
                safeFallback.requestingEstablishment
        ),
        requestingService: normalizeString(
            safeSource.requestingService ?? safeFallback.requestingService
        ),
        careSite: normalizeString(safeSource.careSite ?? safeFallback.careSite),
        bedLabel: normalizeString(safeSource.bedLabel ?? safeFallback.bedLabel),
        requestedBy: normalizeString(
            safeSource.requestedBy ?? safeFallback.requestedBy
        ),
        patientName: normalizeString(
            safeSource.patientName ?? safeFallback.patientName
        ),
        patientDocumentNumber: normalizeString(
            safeSource.patientDocumentNumber ??
                safeFallback.patientDocumentNumber
        ),
        patientRecordId: normalizeString(
            safeSource.patientRecordId ?? safeFallback.patientRecordId
        ),
        patientAgeYears: normalizeNullableInt(
            safeSource.patientAgeYears ?? safeFallback.patientAgeYears
        ),
        patientSexAtBirth: normalizeString(
            safeSource.patientSexAtBirth ?? safeFallback.patientSexAtBirth
        ),
        diagnoses: normalizeInterconsultationDiagnoses(
            safeSource.diagnoses ?? safeFallback.diagnoses
        ),
        studySelections: normalizeLabOrderStudySelections(
            safeSource.studySelections ?? safeFallback.studySelections
        ),
        bacteriologySampleSource: normalizeString(
            safeSource.bacteriologySampleSource ??
                safeFallback.bacteriologySampleSource
        ),
        physicianPresentAtExam:
            safeSource.physicianPresentAtExam === true ||
            (safeSource.physicianPresentAtExam === undefined &&
                safeFallback.physicianPresentAtExam === true),
        notes: normalizeString(safeSource.notes ?? safeFallback.notes),
        issuedAt: normalizeString(safeSource.issuedAt ?? safeFallback.issuedAt),
        cancelledAt: normalizeString(
            safeSource.cancelledAt ?? safeFallback.cancelledAt
        ),
        cancelReason: normalizeString(
            safeSource.cancelReason ?? safeFallback.cancelReason
        ),
        history: normalizeList(safeSource.history ?? safeFallback.history),
        createdAt: normalizeString(
            safeSource.createdAt ?? safeFallback.createdAt
        ),
        updatedAt: normalizeString(
            safeSource.updatedAt ?? safeFallback.updatedAt
        ),
    };
}

function normalizeLabOrders(items) {
    return normalizeList(items).map((item) => normalizeLabOrder(item));
}

function normalizeLabOrderSnapshot(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return {
        ...emptyLabOrderSnapshot(),
        ...normalizeLabOrder(source),
        snapshotId: normalizeString(source.snapshotId),
        finalizedAt: normalizeString(source.finalizedAt),
        snapshotAt: normalizeString(source.snapshotAt),
    };
}

function normalizeLabOrderSnapshots(items) {
    return normalizeList(items).map(normalizeLabOrderSnapshot);
}

function normalizeImagingOrder(imagingOrder, fallback = {}) {
    const defaults = emptyImagingOrder();
    const safeSource =
        imagingOrder && typeof imagingOrder === 'object' ? imagingOrder : {};
    const safeFallback =
        fallback && typeof fallback === 'object' ? fallback : {};

    return {
        ...defaults,
        ...safeFallback,
        ...safeSource,
        imagingOrderId: normalizeString(
            safeSource.imagingOrderId ?? safeFallback.imagingOrderId
        ),
        status:
            normalizeString(safeSource.status ?? safeFallback.status) ||
            defaults.status,
        resultStatus:
            normalizeString(
                safeSource.resultStatus ??
                    safeSource.result?.status ??
                    safeFallback.resultStatus ??
                    safeFallback.result?.status
            ) || defaults.resultStatus,
        requiredForCurrentPlan:
            safeSource.requiredForCurrentPlan === true ||
            (safeSource.requiredForCurrentPlan === undefined &&
                safeFallback.requiredForCurrentPlan === true),
        priority:
            normalizeString(safeSource.priority ?? safeFallback.priority) ||
            defaults.priority,
        requestedAt: normalizeString(
            safeSource.requestedAt ?? safeFallback.requestedAt
        ),
        studyDate: normalizeString(
            safeSource.studyDate ?? safeFallback.studyDate
        ),
        requestingEstablishment: normalizeString(
            safeSource.requestingEstablishment ??
                safeFallback.requestingEstablishment
        ),
        requestingService: normalizeString(
            safeSource.requestingService ?? safeFallback.requestingService
        ),
        careSite: normalizeString(safeSource.careSite ?? safeFallback.careSite),
        bedLabel: normalizeString(safeSource.bedLabel ?? safeFallback.bedLabel),
        requestedBy: normalizeString(
            safeSource.requestedBy ?? safeFallback.requestedBy
        ),
        patientName: normalizeString(
            safeSource.patientName ?? safeFallback.patientName
        ),
        patientDocumentNumber: normalizeString(
            safeSource.patientDocumentNumber ??
                safeFallback.patientDocumentNumber
        ),
        patientRecordId: normalizeString(
            safeSource.patientRecordId ?? safeFallback.patientRecordId
        ),
        patientAgeYears: normalizeNullableInt(
            safeSource.patientAgeYears ?? safeFallback.patientAgeYears
        ),
        patientSexAtBirth: normalizeString(
            safeSource.patientSexAtBirth ?? safeFallback.patientSexAtBirth
        ),
        diagnoses: normalizeInterconsultationDiagnoses(
            safeSource.diagnoses ?? safeFallback.diagnoses
        ),
        studySelections: normalizeImagingStudySelections(
            safeSource.studySelections ?? safeFallback.studySelections
        ),
        requestReason: normalizeString(
            safeSource.requestReason ?? safeFallback.requestReason
        ),
        clinicalSummary: normalizeString(
            safeSource.clinicalSummary ?? safeFallback.clinicalSummary
        ),
        canMobilize:
            safeSource.canMobilize === true ||
            (safeSource.canMobilize === undefined &&
                safeFallback.canMobilize === true),
        canRemoveDressingsOrCasts:
            safeSource.canRemoveDressingsOrCasts === true ||
            (safeSource.canRemoveDressingsOrCasts === undefined &&
                safeFallback.canRemoveDressingsOrCasts === true),
        physicianPresentAtExam:
            safeSource.physicianPresentAtExam === true ||
            (safeSource.physicianPresentAtExam === undefined &&
                safeFallback.physicianPresentAtExam === true),
        bedsideRadiography:
            safeSource.bedsideRadiography === true ||
            (safeSource.bedsideRadiography === undefined &&
                safeFallback.bedsideRadiography === true),
        notes: normalizeString(safeSource.notes ?? safeFallback.notes),
        issuedAt: normalizeString(safeSource.issuedAt ?? safeFallback.issuedAt),
        cancelledAt: normalizeString(
            safeSource.cancelledAt ?? safeFallback.cancelledAt
        ),
        cancelReason: normalizeString(
            safeSource.cancelReason ?? safeFallback.cancelReason
        ),
        result: normalizeImagingReport(
            safeSource.result ?? safeFallback.result,
            safeFallback.result
        ),
        history: normalizeList(safeSource.history ?? safeFallback.history),
        createdAt: normalizeString(
            safeSource.createdAt ?? safeFallback.createdAt
        ),
        updatedAt: normalizeString(
            safeSource.updatedAt ?? safeFallback.updatedAt
        ),
    };
}

function normalizeImagingOrders(items) {
    return normalizeList(items).map((item) => normalizeImagingOrder(item));
}

function normalizeImagingOrderSnapshot(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return {
        ...emptyImagingOrderSnapshot(),
        ...normalizeImagingOrder(source),
        snapshotId: normalizeString(source.snapshotId),
        finalizedAt: normalizeString(source.finalizedAt),
        snapshotAt: normalizeString(source.snapshotAt),
    };
}

function normalizeImagingOrderSnapshots(items) {
    return normalizeList(items).map(normalizeImagingOrderSnapshot);
}

function normalizeImagingReport(report, fallback = {}) {
    const defaults = emptyImagingReport();
    const safeSource = report && typeof report === 'object' ? report : {};
    const safeFallback =
        fallback && typeof fallback === 'object' ? fallback : {};

    return {
        ...defaults,
        ...safeFallback,
        ...safeSource,
        status:
            normalizeString(safeSource.status ?? safeFallback.status) ||
            defaults.status,
        reportedAt: normalizeString(
            safeSource.reportedAt ?? safeFallback.reportedAt
        ),
        reportedBy: normalizeString(
            safeSource.reportedBy ?? safeFallback.reportedBy
        ),
        receivedBy: normalizeString(
            safeSource.receivedBy ?? safeFallback.receivedBy
        ),
        reportingEstablishment: normalizeString(
            safeSource.reportingEstablishment ??
                safeFallback.reportingEstablishment
        ),
        reportingService: normalizeString(
            safeSource.reportingService ?? safeFallback.reportingService
        ),
        radiologistProfessionalName: normalizeString(
            safeSource.radiologistProfessionalName ??
                safeFallback.radiologistProfessionalName
        ),
        radiologistProfessionalRole: normalizeString(
            safeSource.radiologistProfessionalRole ??
                safeFallback.radiologistProfessionalRole
        ),
        studyPerformedSummary: normalizeString(
            safeSource.studyPerformedSummary ??
                safeFallback.studyPerformedSummary
        ),
        findings: normalizeString(safeSource.findings ?? safeFallback.findings),
        diagnosticImpression: normalizeString(
            safeSource.diagnosticImpression ?? safeFallback.diagnosticImpression
        ),
        recommendations: normalizeString(
            safeSource.recommendations ?? safeFallback.recommendations
        ),
        followUpIndications: normalizeString(
            safeSource.followUpIndications ?? safeFallback.followUpIndications
        ),
        sourceDocumentType: normalizeString(
            safeSource.sourceDocumentType ?? safeFallback.sourceDocumentType
        ),
        sourceReference: normalizeString(
            safeSource.sourceReference ?? safeFallback.sourceReference
        ),
        attachments: normalizeAttachmentList(
            safeSource.attachments ?? safeFallback.attachments
        ),
        history: normalizeList(safeSource.history ?? safeFallback.history),
        createdAt: normalizeString(
            safeSource.createdAt ?? safeFallback.createdAt
        ),
        updatedAt: normalizeString(
            safeSource.updatedAt ?? safeFallback.updatedAt
        ),
    };
}

function normalizeImagingReportSnapshot(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return {
        ...emptyImagingReportSnapshot(),
        ...source,
        imagingOrderId: normalizeString(source.imagingOrderId),
        imagingOrderStatus: normalizeString(source.imagingOrderStatus),
        studySelections: normalizeImagingStudySelections(
            source.studySelections
        ),
        requestReason: normalizeString(source.requestReason),
        reportStatus:
            normalizeString(source.reportStatus || source.report?.status) ||
            'draft',
        finalizedAt: normalizeString(source.finalizedAt),
        snapshotAt: normalizeString(source.snapshotAt),
        report: normalizeImagingReport(source.report),
    };
}

function normalizeImagingReportSnapshots(items) {
    return normalizeList(items).map(normalizeImagingReportSnapshot);
}

function normalizeInterconsultation(interconsultation, fallback = {}) {
    const defaults = emptyInterconsultation();
    const safeSource =
        interconsultation && typeof interconsultation === 'object'
            ? interconsultation
            : {};
    const safeFallback =
        fallback && typeof fallback === 'object' ? fallback : {};
    const report = normalizeInterconsultReport(
        safeSource.report ?? safeFallback.report,
        {
            consultantProfessionalName: normalizeString(
                safeSource.consultedProfessionalName ??
                    safeFallback.consultedProfessionalName
            ),
            respondingEstablishment: normalizeString(
                safeSource.destinationEstablishment ??
                    safeFallback.destinationEstablishment
            ),
            respondingService: normalizeString(
                safeSource.destinationService ?? safeFallback.destinationService
            ),
        }
    );
    const reportEvaluation = evaluateInterconsultReport(report);
    let reportStatus = normalizeString(
        safeSource.reportStatus ?? safeFallback.reportStatus
    );
    if (!reportStatus) {
        reportStatus = reportEvaluation.status;
    }

    return {
        ...defaults,
        ...safeFallback,
        ...safeSource,
        interconsultId: normalizeString(
            safeSource.interconsultId ?? safeFallback.interconsultId
        ),
        status:
            normalizeString(safeSource.status ?? safeFallback.status) ||
            defaults.status,
        reportStatus: reportStatus || defaults.reportStatus,
        requiredForCurrentPlan:
            safeSource.requiredForCurrentPlan === true ||
            (safeSource.requiredForCurrentPlan === undefined &&
                safeFallback.requiredForCurrentPlan === true),
        priority:
            normalizeString(safeSource.priority ?? safeFallback.priority) ||
            defaults.priority,
        requestedAt: normalizeString(
            safeSource.requestedAt ?? safeFallback.requestedAt
        ),
        requestingEstablishment: normalizeString(
            safeSource.requestingEstablishment ??
                safeFallback.requestingEstablishment
        ),
        requestingService: normalizeString(
            safeSource.requestingService ?? safeFallback.requestingService
        ),
        destinationEstablishment: normalizeString(
            safeSource.destinationEstablishment ??
                safeFallback.destinationEstablishment
        ),
        destinationService: normalizeString(
            safeSource.destinationService ?? safeFallback.destinationService
        ),
        consultedProfessionalName: normalizeString(
            safeSource.consultedProfessionalName ??
                safeFallback.consultedProfessionalName
        ),
        patientName: normalizeString(
            safeSource.patientName ?? safeFallback.patientName
        ),
        patientDocumentNumber: normalizeString(
            safeSource.patientDocumentNumber ??
                safeFallback.patientDocumentNumber
        ),
        patientRecordId: normalizeString(
            safeSource.patientRecordId ?? safeFallback.patientRecordId
        ),
        patientAgeYears: normalizeNullableInt(
            safeSource.patientAgeYears ?? safeFallback.patientAgeYears
        ),
        patientSexAtBirth: normalizeString(
            safeSource.patientSexAtBirth ?? safeFallback.patientSexAtBirth
        ),
        clinicalPicture: normalizeString(
            safeSource.clinicalPicture ?? safeFallback.clinicalPicture
        ),
        requestReason: normalizeString(
            safeSource.requestReason ?? safeFallback.requestReason
        ),
        diagnoses: normalizeInterconsultationDiagnoses(
            safeSource.diagnoses ?? safeFallback.diagnoses
        ),
        performedDiagnosticsSummary: normalizeString(
            safeSource.performedDiagnosticsSummary ??
                safeFallback.performedDiagnosticsSummary
        ),
        therapeuticMeasuresDone: normalizeString(
            safeSource.therapeuticMeasuresDone ??
                safeFallback.therapeuticMeasuresDone
        ),
        questionForConsultant: normalizeString(
            safeSource.questionForConsultant ??
                safeFallback.questionForConsultant
        ),
        issuedBy: normalizeString(safeSource.issuedBy ?? safeFallback.issuedBy),
        issuedAt: normalizeString(safeSource.issuedAt ?? safeFallback.issuedAt),
        cancelledAt: normalizeString(
            safeSource.cancelledAt ?? safeFallback.cancelledAt
        ),
        cancelReason: normalizeString(
            safeSource.cancelReason ?? safeFallback.cancelReason
        ),
        report,
        history: normalizeList(safeSource.history ?? safeFallback.history),
        createdAt: normalizeString(
            safeSource.createdAt ?? safeFallback.createdAt
        ),
        updatedAt: normalizeString(
            safeSource.updatedAt ?? safeFallback.updatedAt
        ),
    };
}

function normalizeInterconsultations(items) {
    return normalizeList(items).map((item) => normalizeInterconsultation(item));
}

function normalizeInterconsultFormSnapshot(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return {
        ...emptyInterconsultFormSnapshot(),
        ...normalizeInterconsultation(source),
        snapshotId: normalizeString(source.snapshotId),
        finalizedAt: normalizeString(source.finalizedAt),
        snapshotAt: normalizeString(source.snapshotAt),
    };
}

function normalizeInterconsultFormSnapshots(items) {
    return normalizeList(items).map(normalizeInterconsultFormSnapshot);
}

function evaluateInterconsultReport(report) {
    const normalized = normalizeInterconsultReport(report);
    const missing = [];
    if (
        !normalizeString(normalized.respondingEstablishment) &&
        !normalizeString(normalized.respondingService)
    ) {
        missing.push('responding_service');
    }
    if (!normalizeString(normalized.consultantProfessionalName)) {
        missing.push('consultant_professional_name');
    }
    if (!normalizeString(normalized.reportedAt)) {
        missing.push('reported_at');
    }
    if (
        !normalizeString(normalized.clinicalFindings) &&
        !normalizeString(normalized.diagnosticOpinion)
    ) {
        missing.push('clinical_findings');
    }
    if (
        !normalizeString(normalized.recommendations) &&
        !normalizeString(normalized.followUpIndications)
    ) {
        missing.push('recommendations');
    }
    const readyToReceive = missing.length === 0;
    const hasAnyContent =
        normalizeString(normalized.reportedAt) ||
        normalizeString(normalized.reportedBy) ||
        normalizeString(normalized.respondingEstablishment) ||
        normalizeString(normalized.respondingService) ||
        normalizeString(normalized.consultantProfessionalName) ||
        normalizeString(normalized.consultantProfessionalRole) ||
        normalizeString(normalized.reportSummary) ||
        normalizeString(normalized.clinicalFindings) ||
        normalizeString(normalized.diagnosticOpinion) ||
        normalizeString(normalized.recommendations) ||
        normalizeString(normalized.followUpIndications) ||
        normalizeString(normalized.sourceDocumentType) ||
        normalizeString(normalized.sourceReference) ||
        normalized.attachments.length > 0;

    let status = 'not_received';
    if (normalizeString(normalized.status) === 'received') {
        status = readyToReceive ? 'received' : 'draft';
    } else if (readyToReceive) {
        status = 'ready_to_receive';
    } else if (hasAnyContent) {
        status = 'draft';
    }

    return {
        status,
        readyToReceive,
        missingFields: Array.from(new Set(missing)),
    };
}

function evaluateInterconsultation(interconsultation) {
    const normalized = normalizeInterconsultation(interconsultation);
    const diagnoses = normalizeInterconsultationDiagnoses(normalized.diagnoses);
    const reportEvaluation = evaluateInterconsultReport(normalized.report);
    const missing = [];
    if (!normalizeString(normalized.destinationEstablishment)) {
        missing.push('destination_establishment');
    }
    if (!normalizeString(normalized.destinationService)) {
        missing.push('destination_service');
    }
    if (
        !normalizeString(normalized.requestReason) &&
        !normalizeString(normalized.questionForConsultant)
    ) {
        missing.push('request_reason');
    }
    if (!normalizeString(normalized.clinicalPicture)) {
        missing.push('clinical_picture');
    }
    if (!diagnoses.some((item) => normalizeString(item.label))) {
        missing.push('diagnosis');
    }
    if (!normalizeString(normalized.performedDiagnosticsSummary)) {
        missing.push('performed_diagnostics_summary');
    }
    if (!normalizeString(normalized.therapeuticMeasuresDone)) {
        missing.push('therapeutic_measures_done');
    }
    if (!normalizeString(normalized.issuedBy)) {
        missing.push('issued_by');
    }
    const readyToIssue = missing.length === 0;
    const hasAnyContent =
        normalizeString(normalized.destinationEstablishment) ||
        normalizeString(normalized.destinationService) ||
        normalizeString(normalized.consultedProfessionalName) ||
        normalizeString(normalized.requestReason) ||
        normalizeString(normalized.questionForConsultant) ||
        normalizeString(normalized.clinicalPicture) ||
        normalizeString(normalized.performedDiagnosticsSummary) ||
        normalizeString(normalized.therapeuticMeasuresDone) ||
        diagnoses.some(
            (item) => normalizeString(item.label) || normalizeString(item.cie10)
        );

    let status = 'draft';
    if (normalizeString(normalized.status) === 'issued') {
        status =
            reportEvaluation.status === 'received'
                ? 'received'
                : readyToIssue && normalizeString(normalized.issuedAt)
                  ? 'issued'
                  : 'incomplete';
    } else if (normalizeString(normalized.status) === 'cancelled') {
        status = normalizeString(normalized.cancelledAt)
            ? 'cancelled'
            : 'incomplete';
    } else if (readyToIssue) {
        status = 'ready_to_issue';
    } else if (hasAnyContent) {
        status = 'incomplete';
    }

    return {
        status,
        readyToIssue,
        reportStatus: reportEvaluation.status,
        missingFields: Array.from(new Set(missing)),
    };
}

function hcu007StatusMeta(status) {
    switch (normalizeString(status)) {
        case 'received':
            return {
                status: 'received',
                label: 'HCU-007 informe recibido',
                summary:
                    'La interconsulta ya fue emitida y el informe del consultado quedó recibido como respaldo documental.',
            };
        case 'issued':
            return {
                status: 'issued',
                label: 'HCU-007 emitida',
                summary:
                    'La interconsulta requerida ya fue emitida sin esperar respuesta del consultado.',
            };
        case 'ready_to_issue':
            return {
                status: 'ready_to_issue',
                label: 'HCU-007 lista para emitir',
                summary:
                    'La interconsulta ya cubre los campos mínimos para emisión.',
            };
        case 'cancelled':
            return {
                status: 'cancelled',
                label: 'HCU-007 cancelada',
                summary:
                    'La interconsulta del episodio fue cancelada y no bloquea el cierre actual.',
            };
        case 'incomplete':
            return {
                status: 'incomplete',
                label: 'HCU-007 incompleta',
                summary:
                    'Existe una interconsulta con campos clínicos todavía incompletos.',
            };
        case 'draft':
            return {
                status: 'draft',
                label: 'HCU-007 borrador',
                summary: 'Existe una interconsulta en borrador aún no emitida.',
            };
        default:
            return {
                status: 'not_applicable',
                label: 'HCU-007 no aplica',
                summary:
                    'No hay interconsulta formal exigible para este episodio.',
            };
    }
}

function hcu007ReportStatusMeta(status) {
    switch (normalizeString(status)) {
        case 'received':
            return {
                status: 'received',
                label: 'Informe recibido',
                summary:
                    'El informe del consultado ya quedó recibido y anexado al episodio.',
            };
        case 'ready_to_receive':
            return {
                status: 'ready_to_receive',
                label: 'Informe listo para recibir',
                summary:
                    'El informe ya cubre los mínimos y puede recibirse formalmente.',
            };
        case 'draft':
            return {
                status: 'draft',
                label: 'Informe en borrador',
                summary:
                    'Existe un borrador del informe del consultado aún sin recepción formal.',
            };
        default:
            return {
                status: 'not_received',
                label: 'Informe no recibido',
                summary:
                    'Todavía no se ha recibido informe del consultado en este episodio.',
            };
    }
}

function evaluateLabOrder(labOrder) {
    const normalized = normalizeLabOrder(labOrder);
    const diagnoses = normalizeInterconsultationDiagnoses(normalized.diagnoses);
    const selectedStudies = flattenLabOrderStudySelections(
        normalized.studySelections
    );
    const missing = [];

    if (!normalizeString(normalized.sampleDate)) {
        missing.push('sample_date');
    }
    if (!normalizeString(normalized.priority)) {
        missing.push('priority');
    }
    if (
        !normalizeString(normalized.requestingEstablishment) &&
        !normalizeString(normalized.requestingService)
    ) {
        missing.push('requesting_service');
    }
    if (!normalizeString(normalized.requestedBy)) {
        missing.push('requested_by');
    }
    if (!diagnoses.some((item) => normalizeString(item.label))) {
        missing.push('diagnosis');
    }
    if (selectedStudies.length === 0) {
        missing.push('studies');
    }
    if (
        normalizeLabOrderStudySelections(normalized.studySelections)
            .bacteriology.length > 0 &&
        !normalizeString(normalized.bacteriologySampleSource)
    ) {
        missing.push('bacteriology_sample_source');
    }

    const readyToIssue = missing.length === 0;
    const hasAnyContent =
        normalizeString(normalized.sampleDate) ||
        normalizeString(normalized.requestedBy) ||
        normalizeString(normalized.notes) ||
        diagnoses.some(
            (item) => normalizeString(item.label) || normalizeString(item.cie10)
        ) ||
        selectedStudies.length > 0;

    let status = 'draft';
    if (normalizeString(normalized.status) === 'issued') {
        status =
            readyToIssue && normalizeString(normalized.issuedAt)
                ? 'issued'
                : 'incomplete';
    } else if (normalizeString(normalized.status) === 'cancelled') {
        status = normalizeString(normalized.cancelledAt)
            ? 'cancelled'
            : 'incomplete';
    } else if (readyToIssue) {
        status = 'ready_to_issue';
    } else if (hasAnyContent) {
        status = 'incomplete';
    }

    return {
        status,
        readyToIssue,
        selectedStudiesCount: selectedStudies.length,
        missingFields: Array.from(new Set(missing)),
    };
}

function hcu010AStatusMeta(status) {
    switch (normalizeString(status)) {
        case 'issued':
            return {
                status: 'issued',
                label: 'HCU-010A emitida',
                summary:
                    'La solicitud de laboratorio requerida ya fue emitida dentro del episodio.',
            };
        case 'ready_to_issue':
            return {
                status: 'ready_to_issue',
                label: 'HCU-010A lista para emitir',
                summary:
                    'La solicitud de laboratorio ya cubre los campos minimos del MSP y esta lista para emitirse.',
            };
        case 'cancelled':
            return {
                status: 'cancelled',
                label: 'HCU-010A cancelada',
                summary:
                    'La solicitud de laboratorio del episodio fue cancelada y no bloquea el cierre actual.',
            };
        case 'incomplete':
            return {
                status: 'incomplete',
                label: 'HCU-010A incompleta',
                summary:
                    'Existe una solicitud de laboratorio requerida con campos todavia incompletos.',
            };
        case 'draft':
            return {
                status: 'draft',
                label: 'HCU-010A borrador',
                summary:
                    'Existe una solicitud de laboratorio en borrador aun no emitida.',
            };
        default:
            return {
                status: 'not_applicable',
                label: 'HCU-010A no aplica',
                summary:
                    'No hay solicitud formal de laboratorio exigible para este episodio.',
            };
    }
}

function evaluateImagingOrder(imagingOrder) {
    const normalized = normalizeImagingOrder(imagingOrder);
    const diagnoses = normalizeInterconsultationDiagnoses(normalized.diagnoses);
    const selectedStudies = flattenImagingStudySelections(
        normalized.studySelections
    );
    const resultEvaluation = evaluateImagingReport(normalized.result);
    const missing = [];

    if (!normalizeString(normalized.studyDate)) {
        missing.push('study_date');
    }
    if (!normalizeString(normalized.priority)) {
        missing.push('priority');
    }
    if (!normalizeString(normalized.requestedBy)) {
        missing.push('requested_by');
    }
    if (!normalizeString(normalized.requestReason)) {
        missing.push('request_reason');
    }
    if (!normalizeString(normalized.clinicalSummary)) {
        missing.push('clinical_summary');
    }
    if (!diagnoses.some((item) => normalizeString(item.label))) {
        missing.push('diagnosis');
    }
    if (selectedStudies.length === 0) {
        missing.push('studies');
    }
    if (
        normalized.bedsideRadiography === true &&
        normalizeImagingStudySelections(normalized.studySelections)
            .conventionalRadiography.length === 0
    ) {
        missing.push('bedside_radiography_requires_conventional');
    }

    const readyToIssue = missing.length === 0;
    const hasAnyContent =
        normalizeString(normalized.studyDate) ||
        normalizeString(normalized.requestedBy) ||
        normalizeString(normalized.requestReason) ||
        normalizeString(normalized.clinicalSummary) ||
        normalizeString(normalized.notes) ||
        diagnoses.some(
            (item) => normalizeString(item.label) || normalizeString(item.cie10)
        ) ||
        selectedStudies.length > 0;

    let status = 'draft';
    if (normalizeString(normalized.status) === 'issued') {
        status =
            resultEvaluation.status === 'received'
                ? 'received'
                : readyToIssue && normalizeString(normalized.issuedAt)
                  ? 'issued'
                  : 'incomplete';
    } else if (normalizeString(normalized.status) === 'cancelled') {
        status = normalizeString(normalized.cancelledAt)
            ? 'cancelled'
            : 'incomplete';
    } else if (readyToIssue) {
        status = 'ready_to_issue';
    } else if (hasAnyContent) {
        status = 'incomplete';
    }

    return {
        status,
        reportStatus: resultEvaluation.status,
        readyToIssue,
        selectedStudiesCount: selectedStudies.length,
        missingFields: Array.from(new Set(missing)),
    };
}

function evaluateImagingReport(report) {
    const normalized = normalizeImagingReport(report);
    const missing = [];

    if (
        !normalizeString(normalized.reportingEstablishment) &&
        !normalizeString(normalized.reportingService)
    ) {
        missing.push('reporting_service');
    }
    if (!normalizeString(normalized.radiologistProfessionalName)) {
        missing.push('radiologist_professional_name');
    }
    if (!normalizeString(normalized.reportedAt)) {
        missing.push('reported_at');
    }
    if (
        !normalizeString(normalized.findings) &&
        !normalizeString(normalized.diagnosticImpression)
    ) {
        missing.push('findings');
    }
    if (
        !normalizeString(normalized.recommendations) &&
        !normalizeString(normalized.followUpIndications)
    ) {
        missing.push('recommendations');
    }

    const readyToReceive = missing.length === 0;
    const hasAnyContent =
        normalizeString(normalized.reportedAt) ||
        normalizeString(normalized.reportedBy) ||
        normalizeString(normalized.receivedBy) ||
        normalizeString(normalized.reportingEstablishment) ||
        normalizeString(normalized.reportingService) ||
        normalizeString(normalized.radiologistProfessionalName) ||
        normalizeString(normalized.radiologistProfessionalRole) ||
        normalizeString(normalized.studyPerformedSummary) ||
        normalizeString(normalized.findings) ||
        normalizeString(normalized.diagnosticImpression) ||
        normalizeString(normalized.recommendations) ||
        normalizeString(normalized.followUpIndications) ||
        normalizeString(normalized.sourceDocumentType) ||
        normalizeString(normalized.sourceReference) ||
        normalized.attachments.length > 0;

    let status = 'not_received';
    if (normalizeString(normalized.status) === 'received') {
        status = readyToReceive ? 'received' : 'draft';
    } else if (readyToReceive) {
        status = 'ready_to_receive';
    } else if (hasAnyContent) {
        status = 'draft';
    }

    return {
        status,
        readyToReceive,
        missingFields: Array.from(new Set(missing)),
    };
}

function hcu012AStatusMeta(status) {
    switch (normalizeString(status)) {
        case 'received':
            return {
                status: 'received',
                label: 'HCU-012A resultado recibido',
                summary:
                    'La solicitud de imagenologia ya fue emitida y su resultado radiologico quedó recibido como respaldo documental.',
            };
        case 'issued':
            return {
                status: 'issued',
                label: 'HCU-012A emitida',
                summary:
                    'La solicitud de imagenologia requerida ya fue emitida dentro del episodio.',
            };
        case 'ready_to_issue':
            return {
                status: 'ready_to_issue',
                label: 'HCU-012A lista para emitir',
                summary:
                    'La solicitud de imagenologia ya cubre los campos minimos del MSP y esta lista para emitirse.',
            };
        case 'cancelled':
            return {
                status: 'cancelled',
                label: 'HCU-012A cancelada',
                summary:
                    'La solicitud de imagenologia del episodio fue cancelada y no bloquea el cierre actual.',
            };
        case 'incomplete':
            return {
                status: 'incomplete',
                label: 'HCU-012A incompleta',
                summary:
                    'Existe una solicitud de imagenologia requerida con campos todavia incompletos.',
            };
        case 'draft':
            return {
                status: 'draft',
                label: 'HCU-012A borrador',
                summary:
                    'Existe una solicitud de imagenologia en borrador aun no emitida.',
            };
        default:
            return {
                status: 'not_applicable',
                label: 'HCU-012A no aplica',
                summary:
                    'No hay solicitud formal de imagenologia exigible para este episodio.',
            };
    }
}

function hcu012AReportStatusMeta(status) {
    switch (normalizeString(status)) {
        case 'received':
            return {
                status: 'received',
                label: 'Resultado radiologico recibido',
                summary:
                    'El resultado radiologico ya quedó capturado y anexado al episodio.',
            };
        case 'ready_to_receive':
            return {
                status: 'ready_to_receive',
                label: 'Resultado listo para recibir',
                summary:
                    'El resultado radiologico ya cubre los campos mínimos para recepción formal.',
            };
        case 'draft':
            return {
                status: 'draft',
                label: 'Resultado radiologico en borrador',
                summary:
                    'Existe un borrador del resultado radiologico aún sin recepción formal.',
            };
        case 'not_received':
            return {
                status: 'not_received',
                label: 'Resultado radiologico no recibido',
                summary:
                    'Todavía no se ha recibido resultado radiologico para la solicitud emitida.',
            };
        default:
            return {
                status: 'not_applicable',
                label: 'Resultado radiologico no aplica',
                summary:
                    'No hay resultado radiologico aplicable para este episodio.',
            };
    }
}

function consentPacketTemplate(templateKey) {
    const normalizedTemplate = normalizeString(templateKey) || 'generic';
    const base = {
        templateKey: normalizedTemplate,
        title: 'Consentimiento informado HCU-form.024/2008',
        writtenRequired: true,
        careMode: 'ambulatorio',
        serviceLabel: 'Dermatología ambulatoria',
        establishmentLabel: 'Consultorio privado',
        procedureKey: 'generic',
        procedureLabel: 'Consentimiento genérico',
        procedureName: 'Procedimiento ambulatorio',
        procedureWhatIsIt: '',
        procedureHowItIsDone: '',
        durationEstimate: '',
        benefits: '',
        frequentRisks: '',
        rareSeriousRisks: '',
        patientSpecificRisks: '',
        alternatives: '',
        postProcedureCare: '',
        noProcedureConsequences: '',
        anesthesiologistAttestation: {
            applicable: false,
        },
    };

    if (normalizedTemplate === 'laser-dermatologico') {
        return {
            ...base,
            procedureKey: 'laser-dermatologico',
            procedureLabel: 'Láser dermatológico',
            procedureName: 'Procedimiento con láser dermatológico',
            procedureWhatIsIt:
                'Aplicación dirigida de energía láser sobre la piel para manejo dermatológico ambulatorio.',
            procedureHowItIsDone:
                'Se delimita el área, se protege la zona y se aplica el láser por sesiones según criterio clínico.',
            durationEstimate: '20 a 45 minutos según área tratada',
            benefits:
                'Mejoría del objetivo dermatológico indicado y manejo ambulatorio controlado.',
            frequentRisks:
                'Eritema, edema, ardor transitorio, costras leves o hiperpigmentación postinflamatoria.',
            rareSeriousRisks:
                'Quemadura, cicatriz, infección secundaria o alteraciones pigmentarias persistentes.',
            postProcedureCare:
                'Fotoprotección estricta, cuidado gentil de la zona y seguimiento clínico.',
            noProcedureConsequences:
                'Persistencia del problema dermatológico o necesidad de otras alternativas.',
        };
    }

    if (normalizedTemplate === 'peeling-quimico') {
        return {
            ...base,
            procedureKey: 'peeling-quimico',
            procedureLabel: 'Peeling químico',
            procedureName: 'Peeling químico ambulatorio',
            procedureWhatIsIt:
                'Aplicación controlada de agentes químicos sobre la piel para renovación superficial o media.',
            procedureHowItIsDone:
                'Se prepara la piel, se aplica el agente por tiempo definido y luego se neutraliza o retira según técnica.',
            durationEstimate: '20 a 40 minutos según protocolo',
            benefits:
                'Mejoría de textura, tono, lesiones superficiales y apoyo al plan dermatológico.',
            frequentRisks:
                'Ardor, eritema, descamación, sensibilidad y cambios pigmentarios transitorios.',
            rareSeriousRisks:
                'Quemadura química, cicatriz, infección o discromías persistentes.',
            postProcedureCare:
                'Hidratación, fotoprotección y seguimiento según indicaciones postratamiento.',
            noProcedureConsequences:
                'Persistencia del problema cutáneo o necesidad de otras alternativas terapéuticas.',
        };
    }

    if (normalizedTemplate === 'botox') {
        return {
            ...base,
            procedureKey: 'botox',
            procedureLabel: 'Botox',
            procedureName: 'Aplicación de toxina botulínica',
            procedureWhatIsIt:
                'Aplicación intramuscular o intradérmica de toxina botulínica en puntos definidos.',
            procedureHowItIsDone:
                'Se realiza marcación anatómica y se aplica el medicamento en dosis distribuidas según plan clínico.',
            durationEstimate: '15 a 30 minutos según zonas tratadas',
            benefits:
                'Mejoría funcional o estética según la indicación clínica establecida.',
            frequentRisks:
                'Dolor leve, hematoma, edema, asimetría transitoria o cefalea.',
            rareSeriousRisks:
                'Ptosis, debilidad muscular no deseada, reacción alérgica o difusión del efecto.',
            postProcedureCare:
                'Evitar masaje local, seguir indicaciones médicas y asistir a control si se programa.',
            noProcedureConsequences:
                'Persistencia del motivo de consulta o necesidad de otras alternativas terapéuticas.',
        };
    }

    return base;
}

function normalizeConsentPacket(packet, fallback = {}) {
    const defaults = emptyConsentPacket();
    const safeSource = packet && typeof packet === 'object' ? packet : {};
    const safeFallback =
        fallback && typeof fallback === 'object' ? fallback : {};
    const template = consentPacketTemplate(
        safeSource.templateKey ||
            safeFallback.templateKey ||
            defaults.templateKey
    );
    const source = {
        ...defaults,
        ...template,
        ...safeFallback,
        ...safeSource,
    };
    const declaration =
        source.declaration && typeof source.declaration === 'object'
            ? source.declaration
            : {};
    const denial =
        source.denial && typeof source.denial === 'object' ? source.denial : {};
    const revocation =
        source.revocation && typeof source.revocation === 'object'
            ? source.revocation
            : {};
    const patientAttestation =
        source.patientAttestation &&
        typeof source.patientAttestation === 'object'
            ? source.patientAttestation
            : {};
    const representativeAttestation =
        source.representativeAttestation &&
        typeof source.representativeAttestation === 'object'
            ? source.representativeAttestation
            : {};
    const professionalAttestation =
        source.professionalAttestation &&
        typeof source.professionalAttestation === 'object'
            ? source.professionalAttestation
            : {};
    const anesthesiologistAttestation =
        source.anesthesiologistAttestation &&
        typeof source.anesthesiologistAttestation === 'object'
            ? source.anesthesiologistAttestation
            : {};
    const witnessAttestation =
        source.witnessAttestation &&
        typeof source.witnessAttestation === 'object'
            ? source.witnessAttestation
            : {};

    return {
        ...source,
        packetId: normalizeString(source.packetId),
        templateKey: normalizeString(
            source.templateKey || template.templateKey
        ),
        sourceMode: normalizeString(source.sourceMode),
        title: normalizeString(source.title),
        procedureKey: normalizeString(source.procedureKey),
        procedureLabel: normalizeString(source.procedureLabel),
        status: normalizeString(source.status || 'draft'),
        writtenRequired: source.writtenRequired !== false,
        careMode: normalizeString(source.careMode || 'ambulatorio'),
        serviceLabel: normalizeString(source.serviceLabel),
        establishmentLabel: normalizeString(source.establishmentLabel),
        patientName: normalizeString(source.patientName),
        patientDocumentNumber: normalizeString(source.patientDocumentNumber),
        patientRecordId: normalizeString(source.patientRecordId),
        encounterDateTime: normalizeString(source.encounterDateTime),
        diagnosisLabel: normalizeString(source.diagnosisLabel),
        diagnosisCie10: normalizeString(source.diagnosisCie10),
        procedureName: normalizeString(source.procedureName),
        procedureWhatIsIt: normalizeString(source.procedureWhatIsIt),
        procedureHowItIsDone: normalizeString(source.procedureHowItIsDone),
        durationEstimate: normalizeString(source.durationEstimate),
        graphicRef: normalizeString(source.graphicRef),
        benefits: normalizeString(source.benefits),
        frequentRisks: normalizeString(source.frequentRisks),
        rareSeriousRisks: normalizeString(source.rareSeriousRisks),
        patientSpecificRisks: normalizeString(source.patientSpecificRisks),
        alternatives: normalizeString(source.alternatives),
        postProcedureCare: normalizeString(source.postProcedureCare),
        noProcedureConsequences: normalizeString(
            source.noProcedureConsequences
        ),
        privateCommunicationConfirmed:
            source.privateCommunicationConfirmed === true,
        companionShareAuthorized: source.companionShareAuthorized === true,
        declaration: {
            declaredAt: normalizeString(declaration.declaredAt),
            patientCanConsent:
                declaration.patientCanConsent === undefined
                    ? true
                    : declaration.patientCanConsent === true,
            capacityAssessment: normalizeString(declaration.capacityAssessment),
            notes: normalizeString(declaration.notes),
        },
        denial: {
            declinedAt: normalizeString(denial.declinedAt),
            reason: normalizeString(denial.reason),
            patientRefusedSignature: denial.patientRefusedSignature === true,
            notes: normalizeString(denial.notes),
        },
        revocation: {
            revokedAt: normalizeString(revocation.revokedAt),
            receivedBy: normalizeString(revocation.receivedBy),
            reason: normalizeString(revocation.reason),
            notes: normalizeString(revocation.notes),
        },
        patientAttestation: {
            name: normalizeString(patientAttestation.name),
            documentNumber: normalizeString(patientAttestation.documentNumber),
            signedAt: normalizeString(patientAttestation.signedAt),
            refusedSignature: patientAttestation.refusedSignature === true,
        },
        representativeAttestation: {
            name: normalizeString(representativeAttestation.name),
            kinship: normalizeString(representativeAttestation.kinship),
            documentNumber: normalizeString(
                representativeAttestation.documentNumber
            ),
            phone: normalizeString(representativeAttestation.phone),
            signedAt: normalizeString(representativeAttestation.signedAt),
        },
        professionalAttestation: {
            name: normalizeString(professionalAttestation.name),
            role:
                normalizeString(professionalAttestation.role) ||
                'medico_tratante',
            documentNumber: normalizeString(
                professionalAttestation.documentNumber
            ),
            signedAt: normalizeString(professionalAttestation.signedAt),
        },
        anesthesiologistAttestation: {
            applicable: anesthesiologistAttestation.applicable === true,
            name: normalizeString(anesthesiologistAttestation.name),
            documentNumber: normalizeString(
                anesthesiologistAttestation.documentNumber
            ),
            signedAt: normalizeString(anesthesiologistAttestation.signedAt),
        },
        witnessAttestation: {
            name: normalizeString(witnessAttestation.name),
            documentNumber: normalizeString(witnessAttestation.documentNumber),
            phone: normalizeString(witnessAttestation.phone),
            signedAt: normalizeString(witnessAttestation.signedAt),
        },
        history: normalizeList(source.history),
        createdAt: normalizeString(source.createdAt),
        updatedAt: normalizeString(source.updatedAt),
    };
}

function normalizeConsentPackets(items) {
    return normalizeList(items).map((item) => normalizeConsentPacket(item));
}

function normalizeConsentFormSnapshot(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return {
        ...emptyConsentFormSnapshot(),
        ...normalizeConsentPacket(source),
        snapshotId: normalizeString(source.snapshotId),
        finalizedAt: normalizeString(source.finalizedAt),
        snapshotAt: normalizeString(source.snapshotAt),
    };
}

function normalizeConsentFormSnapshots(items) {
    return normalizeList(items).map(normalizeConsentFormSnapshot);
}

function buildLegacyConsentFromPacket(packet, fallback = {}) {
    const normalized = normalizeConsentPacket(packet);
    const acceptedAt =
        normalizeString(normalized.patientAttestation.signedAt) ||
        normalizeString(normalized.representativeAttestation.signedAt);
    return normalizeConsent({
        ...fallback,
        required: normalized.writtenRequired === true,
        status:
            normalizeString(normalized.status) ||
            (normalized.writtenRequired === true ? 'draft' : 'not_required'),
        informedBy: normalized.professionalAttestation.name,
        informedAt: normalized.declaration.declaredAt,
        explainedWhat: normalized.procedureWhatIsIt,
        risksExplained: normalized.frequentRisks,
        alternativesExplained: normalized.alternatives,
        capacityAssessment: normalized.declaration.capacityAssessment,
        privateCommunicationConfirmed:
            normalized.privateCommunicationConfirmed === true,
        companionShareAuthorized: normalized.companionShareAuthorized === true,
        acceptedAt,
        declinedAt: normalized.denial.declinedAt,
        revokedAt: normalized.revocation.revokedAt,
        notes:
            normalized.declaration.notes ||
            normalized.denial.notes ||
            normalized.revocation.notes,
    });
}

function consentPacketHasSubstantiveContent(packet) {
    const normalized = normalizeConsentPacket(packet);
    return [
        normalized.procedureName,
        normalized.diagnosisLabel,
        normalized.procedureWhatIsIt,
        normalized.benefits,
        normalized.frequentRisks,
        normalized.alternatives,
        normalized.status,
    ].some(
        (value) =>
            normalizeString(value) !== '' && normalizeString(value) !== 'draft'
    );
}

function evaluateConsentPacket(packet) {
    const normalized = normalizeConsentPacket(packet);
    const legacyBridge =
        normalizeString(normalized.sourceMode) === 'legacy_bridge' ||
        normalizeString(normalized.templateKey) === 'legacy-bridge';
    const missing = [];
    [
        ['title', normalized.title],
        ['establishment', normalized.establishmentLabel],
        ['service', normalized.serviceLabel],
        ['encounter_datetime', normalized.encounterDateTime],
        ['record_id', normalized.patientRecordId],
        ['patient_name', normalized.patientName],
        ['patient_document', normalized.patientDocumentNumber],
        ['diagnosis', normalized.diagnosisLabel],
        ['procedure_name', normalized.procedureName],
        ['procedure_what_is_it', normalized.procedureWhatIsIt],
        ['procedure_how', normalized.procedureHowItIsDone],
        ['frequent_risks', normalized.frequentRisks],
        ['alternatives', normalized.alternatives],
        ['professional_attestation', normalized.professionalAttestation.name],
    ].forEach(([key, value]) => {
        if (!normalizeString(value)) {
            missing.push(key);
        }
    });
    if (!legacyBridge) {
        [
            ['duration', normalized.durationEstimate],
            ['benefits', normalized.benefits],
            ['rare_serious_risks', normalized.rareSeriousRisks],
            ['patient_specific_risks', normalized.patientSpecificRisks],
            ['post_procedure_care', normalized.postProcedureCare],
            ['no_procedure_consequences', normalized.noProcedureConsequences],
        ].forEach(([key, value]) => {
            if (!normalizeString(value)) {
                missing.push(key);
            }
        });
    }
    if (normalized.declaration.patientCanConsent !== true) {
        [
            ['representative_name', normalized.representativeAttestation.name],
            [
                'representative_document',
                normalized.representativeAttestation.documentNumber,
            ],
            [
                'representative_phone',
                normalized.representativeAttestation.phone,
            ],
            [
                'representative_kinship',
                normalized.representativeAttestation.kinship,
            ],
        ].forEach(([key, value]) => {
            if (!normalizeString(value)) {
                missing.push(key);
            }
        });
    }
    if (normalized.anesthesiologistAttestation.applicable === true) {
        if (!normalizeString(normalized.anesthesiologistAttestation.name)) {
            missing.push('anesthesiologist_name');
        }
        if (
            !normalizeString(
                normalized.anesthesiologistAttestation.documentNumber
            )
        ) {
            missing.push('anesthesiologist_document');
        }
    }

    const readyForDeclaration = missing.length === 0;
    const signedAt =
        normalizeString(normalized.patientAttestation.signedAt) ||
        normalizeString(normalized.representativeAttestation.signedAt);
    let status = readyForDeclaration ? 'ready_for_declaration' : 'incomplete';
    if (normalizeString(normalized.status) === 'accepted') {
        status = readyForDeclaration && signedAt ? 'accepted' : 'incomplete';
    } else if (normalizeString(normalized.status) === 'declined') {
        const witnessReady =
            normalizeString(normalized.witnessAttestation.name) &&
            normalizeString(normalized.witnessAttestation.documentNumber);
        if (
            normalized.denial.patientRefusedSignature === true &&
            !witnessReady
        ) {
            missing.push('witness_attestation');
            status = 'incomplete';
        } else {
            status = normalizeString(normalized.denial.declinedAt)
                ? 'declined'
                : 'incomplete';
        }
    } else if (normalizeString(normalized.status) === 'revoked') {
        status =
            normalizeString(normalized.revocation.revokedAt) &&
            normalizeString(normalized.revocation.receivedBy)
                ? 'revoked'
                : 'incomplete';
    } else if (normalizeString(normalized.status) === 'draft') {
        status = readyForDeclaration ? 'ready_for_declaration' : 'draft';
    }

    return {
        status,
        readyForDeclaration,
        missingFields: Array.from(new Set(missing)),
    };
}

function complianceMspStatusMeta(status) {
    switch (normalizeString(status)) {
        case 'complete':
            return {
                status: 'complete',
                label: 'Compliance MSP OK',
                summary: 'Cumple con los campos mínimos requeridos.',
            };
        case 'incomplete':
            return {
                status: 'incomplete',
                label: 'Faltan campos MSP',
                summary: 'Faltan campos obligatorios para cerrar el registro.',
            };
        default:
            return {
                status: 'incomplete',
                label: 'Faltan campos MSP',
                summary: 'Validación MSP pendiente.',
            };
    }
}

function hcu024StatusMeta(status) {
    switch (normalizeString(status)) {
        case 'accepted':
            return {
                status: 'accepted',
                label: 'HCU-024 aceptado',
                summary:
                    'El consentimiento escrito por procedimiento ya quedó aceptado.',
            };
        case 'ready_for_declaration':
            return {
                status: 'ready_for_declaration',
                label: 'HCU-024 lista para declarar',
                summary:
                    'El formulario ya cubre los bloques obligatorios y está listo para declarar.',
            };
        case 'declined':
            return {
                status: 'declined',
                label: 'HCU-024 negado',
                summary:
                    'Existe una negativa registrada para el procedimiento escrito.',
            };
        case 'revoked':
            return {
                status: 'revoked',
                label: 'HCU-024 revocado',
                summary:
                    'El consentimiento escrito fue revocado y exige reconciliar la indicación.',
            };
        case 'draft':
            return {
                status: 'draft',
                label: 'HCU-024 borrador',
                summary:
                    'Existe un consentimiento por procedimiento aún en borrador.',
            };
        case 'incomplete':
            return {
                status: 'incomplete',
                label: 'HCU-024 incompleto',
                summary:
                    'El consentimiento por procedimiento todavía no cubre todos los campos del formulario.',
            };
        default:
            return {
                status: 'not_applicable',
                label: 'HCU-024 no aplica',
                summary:
                    'No hay consentimiento escrito por procedimiento exigible para este episodio.',
            };
    }
}

function resolveClinicProfileDisplay() {
    const profile =
        getState()?.data?.turneroClinicProfile &&
        typeof getState().data.turneroClinicProfile === 'object'
            ? getState().data.turneroClinicProfile
            : {};
    return {
        establishmentLabel: normalizeString(
            profile?.branding?.name ||
                profile?.branding?.short_name ||
                profile?.clinic_name ||
                profile?.clinicName ||
                'Consultorio privado'
        ),
        serviceLabel: normalizeString(
            profile?.services?.defaultLabel ||
                profile?.serviceLabel ||
                'Dermatología ambulatoria'
        ),
    };
}

function deriveInterconsultationContext(
    interconsultation,
    draft,
    fallbackPatient = {}
) {
    const normalized = normalizeInterconsultation(interconsultation);
    const admission = normalizeAdmission001(
        draft?.admission001,
        fallbackPatient,
        draft?.intake
    );
    const patient = normalizePatient(fallbackPatient);
    const clinic = resolveClinicProfileDisplay();
    const hcu005 = normalizeHcu005(draft?.clinicianDraft?.hcu005);
    const cie10List = normalizeStringList(
        draft?.clinicianDraft?.cie10Sugeridos
    );
    const diagnoses = normalizeInterconsultationDiagnoses(
        normalized.diagnoses
    ).map((item, index) =>
        normalizeInterconsultationDiagnosis(
            {
                ...item,
                label:
                    item.label ||
                    (index === 0
                        ? normalizeString(hcu005.diagnosticImpression)
                        : ''),
                cie10:
                    item.cie10 ||
                    (index === 0 ? normalizeString(cie10List[0]) : ''),
            },
            index === 1 ? 'def' : 'pre'
        )
    );

    const report = normalizeInterconsultReport(normalized.report, {
        consultantProfessionalName: normalized.consultedProfessionalName || '',
        respondingEstablishment: normalized.destinationEstablishment || '',
        respondingService: normalized.destinationService || '',
    });

    return normalizeInterconsultation({
        ...normalized,
        patientName:
            normalized.patientName ||
            buildAdmissionLegalName(admission, patient),
        patientDocumentNumber:
            normalized.patientDocumentNumber ||
            normalizeString(admission.identity.documentNumber),
        patientRecordId:
            normalized.patientRecordId ||
            normalizeString(draft.patientRecordId),
        patientAgeYears:
            normalized.patientAgeYears ?? admission.demographics.ageYears,
        patientSexAtBirth:
            normalized.patientSexAtBirth ||
            normalizeString(admission.demographics.sexAtBirth),
        requestedAt:
            normalized.requestedAt ||
            normalizeString(
                draft.updatedAt ||
                    draft.createdAt ||
                    admission?.admissionMeta?.admissionDate
            ),
        requestingEstablishment:
            normalized.requestingEstablishment || clinic.establishmentLabel,
        requestingService: normalized.requestingService || clinic.serviceLabel,
        clinicalPicture:
            normalized.clinicalPicture ||
            normalizeString(
                hcu005.evolutionNote || draft?.intake?.enfermedadActual
            ),
        requestReason:
            normalized.requestReason ||
            normalizeString(draft?.intake?.motivoConsulta),
        diagnoses,
        therapeuticMeasuresDone:
            normalized.therapeuticMeasuresDone ||
            [hcu005.therapeuticPlan, hcu005.careIndications]
                .filter(Boolean)
                .join('\n'),
        report,
    });
}

function deriveLabOrderContext(labOrder, draft, fallbackPatient = {}) {
    const normalized = normalizeLabOrder(labOrder);
    const admission = normalizeAdmission001(
        draft?.admission001,
        fallbackPatient,
        draft?.intake
    );
    const patient = normalizePatient(fallbackPatient);
    const clinic = resolveClinicProfileDisplay();
    const hcu005 = normalizeHcu005(draft?.clinicianDraft?.hcu005);
    const cie10List = normalizeStringList(
        draft?.clinicianDraft?.cie10Sugeridos
    );
    const diagnoses = normalizeInterconsultationDiagnoses(
        normalized.diagnoses
    ).map((item, index) =>
        normalizeInterconsultationDiagnosis(
            {
                ...item,
                label:
                    item.label ||
                    (index === 0
                        ? normalizeString(hcu005.diagnosticImpression)
                        : ''),
                cie10:
                    item.cie10 ||
                    (index === 0 ? normalizeString(cie10List[0]) : ''),
            },
            index === 1 ? 'def' : 'pre'
        )
    );

    return normalizeLabOrder({
        ...normalized,
        patientName:
            normalized.patientName ||
            buildAdmissionLegalName(admission, patient),
        patientDocumentNumber:
            normalized.patientDocumentNumber ||
            normalizeString(admission.identity.documentNumber),
        patientRecordId:
            normalized.patientRecordId ||
            normalizeString(draft.patientRecordId),
        patientAgeYears:
            normalized.patientAgeYears ?? admission.demographics.ageYears,
        patientSexAtBirth:
            normalized.patientSexAtBirth ||
            normalizeString(admission.demographics.sexAtBirth),
        requestedAt:
            normalized.requestedAt ||
            normalizeString(
                draft.updatedAt ||
                    draft.createdAt ||
                    admission?.admissionMeta?.admissionDate
            ),
        requestingEstablishment:
            normalized.requestingEstablishment || clinic.establishmentLabel,
        requestingService: normalized.requestingService || clinic.serviceLabel,
        careSite: normalized.careSite || 'Consulta externa',
        diagnoses,
    });
}

function deriveImagingOrderContext(imagingOrder, draft, fallbackPatient = {}) {
    const normalized = normalizeImagingOrder(imagingOrder);
    const admission = normalizeAdmission001(
        draft?.admission001,
        fallbackPatient,
        draft?.intake
    );
    const patient = normalizePatient(fallbackPatient);
    const clinic = resolveClinicProfileDisplay();
    const hcu005 = normalizeHcu005(draft?.clinicianDraft?.hcu005);
    const cie10List = normalizeStringList(
        draft?.clinicianDraft?.cie10Sugeridos
    );
    const diagnoses = normalizeInterconsultationDiagnoses(
        normalized.diagnoses
    ).map((item, index) =>
        normalizeInterconsultationDiagnosis(
            {
                ...item,
                label:
                    item.label ||
                    (index === 0
                        ? normalizeString(hcu005.diagnosticImpression)
                        : ''),
                cie10:
                    item.cie10 ||
                    (index === 0 ? normalizeString(cie10List[0]) : ''),
            },
            index === 1 ? 'def' : 'pre'
        )
    );

    return normalizeImagingOrder({
        ...normalized,
        patientName:
            normalized.patientName ||
            buildAdmissionLegalName(admission, patient),
        patientDocumentNumber:
            normalized.patientDocumentNumber ||
            normalizeString(admission.identity.documentNumber),
        patientRecordId:
            normalized.patientRecordId ||
            normalizeString(draft.patientRecordId),
        patientAgeYears:
            normalized.patientAgeYears ?? admission.demographics.ageYears,
        patientSexAtBirth:
            normalized.patientSexAtBirth ||
            normalizeString(admission.demographics.sexAtBirth),
        requestedAt:
            normalized.requestedAt ||
            normalizeString(
                draft.updatedAt ||
                    draft.createdAt ||
                    admission?.admissionMeta?.admissionDate
            ),
        requestingEstablishment:
            normalized.requestingEstablishment || clinic.establishmentLabel,
        requestingService: normalized.requestingService || clinic.serviceLabel,
        careSite: normalized.careSite || 'Consulta externa',
        requestReason:
            normalized.requestReason ||
            normalizeString(draft?.intake?.motivoConsulta),
        clinicalSummary:
            normalized.clinicalSummary ||
            [
                hcu005.evolutionNote,
                hcu005.therapeuticPlan,
                hcu005.careIndications,
            ]
                .filter(Boolean)
                .join('\n'),
        diagnoses,
    });
}

function deriveConsentPacketContext(packet, draft, fallbackPatient = {}) {
    const normalized = normalizeConsentPacket(packet);
    const admission = normalizeAdmission001(
        draft?.admission001,
        fallbackPatient,
        draft?.intake
    );
    const patient = normalizePatient(fallbackPatient);
    const clinic = resolveClinicProfileDisplay();

    return normalizeConsentPacket(
        {
            ...normalized,
            title:
                normalized.title ||
                'Consentimiento informado HCU-form.024/2008',
            establishmentLabel:
                normalized.establishmentLabel || clinic.establishmentLabel,
            serviceLabel: normalized.serviceLabel || clinic.serviceLabel,
            patientName:
                normalized.patientName ||
                buildAdmissionLegalName(admission, patient),
            patientDocumentNumber:
                normalized.patientDocumentNumber ||
                normalizeString(admission.identity.documentNumber),
            patientRecordId:
                normalized.patientRecordId ||
                normalizeString(draft.patientRecordId),
            encounterDateTime:
                normalized.encounterDateTime ||
                normalizeString(
                    draft.updatedAt ||
                        draft.createdAt ||
                        admission?.admissionMeta?.admissionDate
                ),
            diagnosisLabel:
                normalized.diagnosisLabel ||
                normalizeString(
                    draft?.clinicianDraft?.hcu005?.diagnosticImpression
                ),
            diagnosisCie10:
                normalized.diagnosisCie10 ||
                normalizeStringList(draft?.clinicianDraft?.cie10Sugeridos).join(
                    ', '
                ),
            procedureHowItIsDone:
                normalized.procedureHowItIsDone ||
                normalizeString(draft?.clinicianDraft?.hcu005?.careIndications),
            benefits:
                normalized.benefits ||
                normalizeString(draft?.clinicianDraft?.hcu005?.therapeuticPlan),
        },
        consentPacketTemplate(normalized.templateKey)
    );
}

function normalizeDocuments(documents) {
    const defaults = emptyDraft().documents;
    const source = documents && typeof documents === 'object' ? documents : {};
    const hcu001Source =
        source?.finalNote?.sections?.hcu001 &&
        typeof source.finalNote.sections.hcu001 === 'object'
            ? source.finalNote.sections.hcu001
            : {};
    const sectionSource =
        source?.finalNote?.sections?.hcu005 &&
        typeof source.finalNote.sections.hcu005 === 'object'
            ? source.finalNote.sections.hcu005
            : {};
    const hcu001 = normalizeAdmission001(hcu001Source);
    const fallbackHcu005 = normalizeHcu005({
        evolutionNote: source?.finalNote?.summary,
        diagnosticImpression: '',
        therapeuticPlan: '',
        careIndications: source?.prescription?.directions,
        prescriptionItems:
            source?.prescription?.items || source?.prescriptionItems || [],
    });
    const hcu005 = normalizeHcu005(sectionSource, fallbackHcu005);
    const prescriptionItems = normalizePrescriptionItems(
        source?.prescription?.items ||
            source?.prescriptionItems ||
            hcu005.prescriptionItems ||
            []
    );
    const summary = renderHcu005Summary(hcu005);
    const content = renderHcu005Content(hcu005);
    const medication = renderPrescriptionMedicationMirror(prescriptionItems);
    const directions = renderPrescriptionDirectionsMirror(prescriptionItems);
    const interconsultForms = normalizeInterconsultFormSnapshots(
        source?.interconsultForms
    );
    const interconsultReports = normalizeInterconsultReportSnapshots(
        source?.interconsultReports
    );
    const labOrders = normalizeLabOrderSnapshots(source?.labOrders);
    const imagingOrders = normalizeImagingOrderSnapshots(source?.imagingOrders);
    const imagingReports = normalizeImagingReportSnapshots(
        source?.imagingReports
    );
    const consentForms = normalizeConsentFormSnapshots(source?.consentForms);

    return {
        finalNote: {
            ...defaults.finalNote,
            ...(source.finalNote && typeof source.finalNote === 'object'
                ? source.finalNote
                : {}),
            status: normalizeString(
                source?.finalNote?.status || defaults.finalNote.status
            ),
            summary,
            content,
            version: Math.max(
                1,
                normalizeNumber(
                    source?.finalNote?.version || defaults.finalNote.version
                )
            ),
            generatedAt: normalizeString(source?.finalNote?.generatedAt),
            confidential: source?.finalNote?.confidential !== false,
            sections: {
                hcu001,
                hcu005,
            },
        },
        prescription: {
            ...defaults.prescription,
            ...(source.prescription && typeof source.prescription === 'object'
                ? source.prescription
                : {}),
            status: normalizeString(
                source?.prescription?.status || defaults.prescription.status
            ),
            medication,
            directions,
            signedAt: normalizeString(source?.prescription?.signedAt),
            confidential: source?.prescription?.confidential !== false,
            items: prescriptionItems,
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
        carePlan: {
            ...defaults.carePlan,
            ...(source.carePlan && typeof source.carePlan === 'object'
                ? source.carePlan
                : {}),
            status: normalizeString(
                source?.carePlan?.status || defaults.carePlan.status
            ),
            diagnosis: normalizeString(source?.carePlan?.diagnosis),
            treatments: normalizeString(source?.carePlan?.treatments),
            followUpFrequency: normalizeString(source?.carePlan?.followUpFrequency),
            goals: normalizeString(source?.carePlan?.goals),
            generatedAt: normalizeString(source?.carePlan?.generatedAt),
        },
        interconsultForms,
        interconsultReports,
        labOrders,
        imagingOrders,
        imagingReports,
        consentForms,
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
        hcu001Status: hcu001StatusMeta(source?.hcu001Status?.status),
        hcu005Status: hcu005StatusMeta(source?.hcu005Status?.status),
        hcu007Status: hcu007StatusMeta(source?.hcu007Status?.status),
        hcu007ReportStatus: hcu007ReportStatusMeta(
            source?.hcu007ReportStatus?.status
        ),
        hcu010AStatus: hcu010AStatusMeta(source?.hcu010AStatus?.status),
        hcu012AStatus: hcu012AStatusMeta(source?.hcu012AStatus?.status),
        hcu012AReportStatus: hcu012AReportStatusMeta(
            source?.hcu012AReportStatus?.status
        ),
        hcu024Status: hcu024StatusMeta(source?.hcu024Status?.status),
        complianceMspStatus: complianceMspStatusMeta(source?.complianceMspStatus?.status),
    };
}

function normalizeDraftSnapshot(draft) {
    const defaults = emptyDraft();
    const source = draft && typeof draft === 'object' ? draft : {};
    const normalizedDocuments = normalizeDocuments(source.documents);
    const intakeSource =
        source.intake && typeof source.intake === 'object' ? source.intake : {};
    const clinicianSource =
        source.clinicianDraft && typeof source.clinicianDraft === 'object'
            ? source.clinicianDraft
            : {};
    const admissionSource =
        source.admission001 && typeof source.admission001 === 'object'
            ? source.admission001
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
        redFlags: normalizeStringList(
            source.redFlags || source.lastAiEnvelope?.redFlags
        ),
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
        documents: normalizedDocuments,
        interconsultations: normalizeInterconsultations(
            source.interconsultations
        ),
        activeInterconsultationId: normalizeString(
            source.activeInterconsultationId
        ),
        labOrders: normalizeLabOrders(source.labOrders),
        activeLabOrderId: normalizeString(source.activeLabOrderId),
        imagingOrders: normalizeImagingOrders(source.imagingOrders),
        activeImagingOrderId: normalizeString(source.activeImagingOrderId),
        consentPackets: normalizeConsentPackets(source.consentPackets),
        activeConsentPacketId: normalizeString(source.activeConsentPacketId),
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
            fototipoFitzpatrick: normalizeString(intakeSource.fototipoFitzpatrick),
            habitos: normalizeString(intakeSource.habitos),
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
                telefono: normalizeString(patientFactsSource.telefono),
                fechaNacimiento: normalizeString(
                    patientFactsSource.fechaNacimiento
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
            hcu005: normalizeHcu005(
                clinicianSource.hcu005,
                normalizeHcu005({
                    evolutionNote:
                        clinicianSource.resumen || intakeSource.resumenClinico,
                    diagnosticImpression: normalizeStringList(
                        clinicianSource.cie10Sugeridos
                    ).join(', '),
                    therapeuticPlan: clinicianSource.tratamientoBorrador,
                    careIndications:
                        clinicianSource?.posologiaBorrador?.texto ||
                        normalizedDocuments.prescription.directions,
                    prescriptionItems:
                        clinicianSource?.hcu005?.prescriptionItems ||
                        normalizedDocuments.prescription.items,
                })
            ),
        },
        admission001: normalizeAdmission001(admissionSource, {}, intakeSource),
        updatedAt: normalizeString(source.updatedAt),
        createdAt: normalizeString(source.createdAt),
    };
}

function synchronizeDraftClinicalState(draft) {
    const snapshot = draft && typeof draft === 'object' ? draft : emptyDraft();
    const admission001 = normalizeAdmission001(
        snapshot.admission001,
        {},
        snapshot.intake
    );
    const clinicianDraft = {
        ...snapshot.clinicianDraft,
        hcu005: normalizeHcu005(
            snapshot?.clinicianDraft?.hcu005,
            normalizeHcu005({
                evolutionNote:
                    snapshot?.clinicianDraft?.resumen ||
                    snapshot?.intake?.resumenClinico,
                diagnosticImpression: normalizeStringList(
                    snapshot?.clinicianDraft?.cie10Sugeridos
                ).join(', '),
                therapeuticPlan: snapshot?.clinicianDraft?.tratamientoBorrador,
                careIndications:
                    snapshot?.clinicianDraft?.posologiaBorrador?.texto ||
                    snapshot?.documents?.prescription?.directions,
                prescriptionItems:
                    snapshot?.documents?.prescription?.items || [],
            })
        ),
    };
    const patientFacts = {
        ...snapshot.intake.datosPaciente,
        edadAnios:
            admission001.demographics.ageYears ??
            snapshot?.intake?.datosPaciente?.edadAnios ??
            null,
        sexoBiologico:
            admission001.demographics.sexAtBirth ||
            snapshot?.intake?.datosPaciente?.sexoBiologico ||
            '',
        telefono:
            admission001.residence.phone ||
            snapshot?.intake?.datosPaciente?.telefono ||
            '',
        fechaNacimiento:
            admission001.demographics.birthDate ||
            snapshot?.intake?.datosPaciente?.fechaNacimiento ||
            '',
    };
    const documents = normalizeDocuments({
        ...snapshot.documents,
        finalNote: {
            ...snapshot?.documents?.finalNote,
            sections: {
                ...(snapshot?.documents?.finalNote?.sections || {}),
                hcu001: admission001,
                hcu005: normalizeHcu005(clinicianDraft.hcu005),
            },
        },
        prescription: {
            ...snapshot?.documents?.prescription,
            items: normalizePrescriptionItems(
                clinicianDraft.hcu005.prescriptionItems
            ),
        },
    });
    const interconsultations = normalizeInterconsultations(
        snapshot.interconsultations
    ).map((interconsultation) =>
        deriveInterconsultationContext(
            interconsultation,
            {
                ...snapshot,
                admission001,
                clinicianDraft,
                documents,
            },
            normalizePatient({})
        )
    );
    let activeInterconsultationId = normalizeString(
        snapshot.activeInterconsultationId
    );
    if (!activeInterconsultationId && interconsultations.length > 0) {
        activeInterconsultationId = normalizeString(
            interconsultations[0].interconsultId
        );
    }
    const labOrders = normalizeLabOrders(snapshot.labOrders).map((labOrder) =>
        deriveLabOrderContext(
            labOrder,
            {
                ...snapshot,
                admission001,
                clinicianDraft,
                documents,
            },
            normalizePatient({})
        )
    );
    let activeLabOrderId = normalizeString(snapshot.activeLabOrderId);
    if (!activeLabOrderId && labOrders.length > 0) {
        activeLabOrderId = normalizeString(labOrders[0].labOrderId);
    }
    const imagingOrders = normalizeImagingOrders(snapshot.imagingOrders).map(
        (imagingOrder) =>
            deriveImagingOrderContext(
                imagingOrder,
                {
                    ...snapshot,
                    admission001,
                    clinicianDraft,
                    documents,
                },
                normalizePatient({})
            )
    );
    let activeImagingOrderId = normalizeString(snapshot.activeImagingOrderId);
    if (!activeImagingOrderId && imagingOrders.length > 0) {
        activeImagingOrderId = normalizeString(imagingOrders[0].imagingOrderId);
    }
    const packets = normalizeConsentPackets(snapshot.consentPackets).map(
        (packet) =>
            deriveConsentPacketContext(packet, snapshot, normalizePatient({}))
    );
    let activeConsentPacketId = normalizeString(snapshot.activeConsentPacketId);
    if (!activeConsentPacketId && packets.length > 0) {
        activeConsentPacketId = normalizeString(packets[0].packetId);
    }
    let activePacket = packets.find(
        (packet) => normalizeString(packet.packetId) === activeConsentPacketId
    );
    if (!activePacket && packets.length > 0) {
        activePacket = packets[0];
        activeConsentPacketId = normalizeString(activePacket.packetId);
    }
    const consent = activePacket
        ? buildLegacyConsentFromPacket(activePacket, snapshot.consent)
        : normalizeConsent(snapshot.consent);

    return {
        ...snapshot,
        admission001,
        clinicianDraft,
        intake: {
            ...(snapshot.intake || {}),
            datosPaciente: patientFacts,
        },
        documents,
        interconsultations,
        activeInterconsultationId,
        labOrders,
        activeLabOrderId,
        imagingOrders,
        activeImagingOrderId,
        consentPackets: packets,
        activeConsentPacketId,
        consent,
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
        hcu001Status: normalizeString(source.hcu001Status || 'missing'),
        hcu001Label: normalizeString(source.hcu001Label),
        hcu001Summary: normalizeString(source.hcu001Summary),
        hcu005Status: normalizeString(source.hcu005Status || 'missing'),
        hcu005Label: normalizeString(source.hcu005Label),
        hcu005Summary: normalizeString(source.hcu005Summary),
        hcu007Status: normalizeString(source.hcu007Status || 'not_applicable'),
        hcu007Label: normalizeString(source.hcu007Label),
        hcu007Summary: normalizeString(source.hcu007Summary),
        hcu010AStatus: normalizeString(
            source.hcu010AStatus || 'not_applicable'
        ),
        hcu010ALabel: normalizeString(source.hcu010ALabel),
        hcu010ASummary: normalizeString(source.hcu010ASummary),
        hcu012AStatus: normalizeString(
            source.hcu012AStatus || 'not_applicable'
        ),
        hcu012ALabel: normalizeString(source.hcu012ALabel),
        hcu012ASummary: normalizeString(source.hcu012ASummary),
        hcu024Status: normalizeString(source.hcu024Status || 'not_applicable'),
        hcu024Label: normalizeString(source.hcu024Label),
        hcu024Summary: normalizeString(source.hcu024Summary),
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
            ? {
                  ...source.patientRecord,
                  patient: normalizePatient(source.patientRecord.patient),
                  admission001: normalizeAdmission001(
                      source.patientRecord.admission001,
                      source.patientRecord.patient,
                      review.draft.intake
                  ),
                  admissionHistory: normalizeList(
                      source.patientRecord.admissionHistory
                  ).map(normalizeAdmissionHistoryItem),
                  changeLog: normalizeList(source.patientRecord.changeLog).map(
                      normalizeAdmissionChangeItem
                  ),
                  admission001Status: hcu001StatusMeta(
                      source?.patientRecord?.admission001Status?.status ||
                          source?.patientRecord?.admission001Status
                  ),
              }
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
    review.interconsultations = normalizeInterconsultations(
        source.interconsultations || review.draft.interconsultations
    );
    review.activeInterconsultationId = normalizeString(
        source.activeInterconsultationId ||
            review.draft.activeInterconsultationId
    );
    review.activeInterconsultation = normalizeInterconsultation(
        source.activeInterconsultation ||
            review.interconsultations.find(
                (interconsultation) =>
                    normalizeString(interconsultation.interconsultId) ===
                    review.activeInterconsultationId
            ) ||
            {}
    );
    review.labOrders = normalizeLabOrders(
        source.labOrders || review.draft.labOrders
    );
    review.activeLabOrderId = normalizeString(
        source.activeLabOrderId || review.draft.activeLabOrderId
    );
    review.activeLabOrder = normalizeLabOrder(
        source.activeLabOrder ||
            review.labOrders.find(
                (labOrder) =>
                    normalizeString(labOrder.labOrderId) ===
                    review.activeLabOrderId
            ) ||
            {}
    );
    review.imagingOrders = normalizeImagingOrders(
        source.imagingOrders || review.draft.imagingOrders
    );
    review.activeImagingOrderId = normalizeString(
        source.activeImagingOrderId || review.draft.activeImagingOrderId
    );
    review.activeImagingOrder = normalizeImagingOrder(
        source.activeImagingOrder ||
            review.imagingOrders.find(
                (imagingOrder) =>
                    normalizeString(imagingOrder.imagingOrderId) ===
                    review.activeImagingOrderId
            ) ||
            {}
    );
    review.consentPackets = normalizeConsentPackets(
        source.consentPackets || review.draft.consentPackets
    );
    review.activeConsentPacketId = normalizeString(
        source.activeConsentPacketId || review.draft.activeConsentPacketId
    );
    review.activeConsentPacket = normalizeConsentPacket(
        source.activeConsentPacket ||
            review.consentPackets.find(
                (packet) =>
                    normalizeString(packet.packetId) ===
                    review.activeConsentPacketId
            ) ||
            {}
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
    const preferred =
        readWorkspaceQuery() ||
        normalizeClinicalHistoryWorkspace(
            getClinicalHistorySlice(state).activeWorkspace
        );
    return availableClinicalHistoryWorkspaces(state).some(
        ({ workspace }) => workspace === preferred
    )
        ? preferred
        : 'review';
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
    const preferred = normalizeClinicalHistoryWorkspace(workspace);
    const next = availableClinicalHistoryWorkspaces().some(
        ({ workspace: optionWorkspace }) => optionWorkspace === preferred
    )
        ? preferred
        : 'review';
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

function humanizeClinicalCode(code) {
    return normalizeString(code)
        .split('_')
        .filter(Boolean)
        .map((fragment, index) => {
            const lower = fragment.toLowerCase();
            if (lower === '') {
                return '';
            }

            if (index === 0) {
                return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
            }

            return lower;
        })
        .filter(Boolean)
        .join(' ');
}

function formatClinicalRedFlagLabel(flag) {
    const normalized = normalizeString(flag).toLowerCase();
    if (!normalized) {
        return '';
    }

    return (
        CLINICAL_RED_FLAG_LABELS[normalized] || humanizeClinicalCode(normalized)
    );
}

function formatClinicalRedFlags(flags, limit = Number.POSITIVE_INFINITY) {
    const labels = normalizeStringList(flags)
        .map((flag) => formatClinicalRedFlagLabel(flag))
        .filter(Boolean);

    return Number.isFinite(limit) ? labels.slice(0, limit) : labels;
}

function buildClinicalRedFlagChipRow(flags, limit = 3) {
    const labels = formatClinicalRedFlags(flags, limit);
    if (labels.length === 0) {
        return '';
    }

    return `
        <div class="clinical-history-mini-chip-row">
            ${labels
                .map(
                    (label) => `
                        <span class="clinical-history-mini-chip" data-tone="danger">${escapeHtml(
                            label
                        )}</span>
                    `
                )
                .join('')}
        </div>
    `;
}

function buildClinicalRedFlagNotice(flags) {
    const labels = formatClinicalRedFlags(flags);
    if (labels.length === 0) {
        return '';
    }

    return `
        <div class="clinical-history-section-block">
            <div class="clinical-history-event-head">
                <strong>Alertas clinicas del caso</strong>
                <span class="clinical-history-mini-chip" data-tone="danger">
                    Revision prioritaria
                </span>
            </div>
            ${buildClinicalRedFlagChipRow(labels)}
            <small>
                El badge rojo se mantiene mientras existan criterios de alarma dermatologica activos.
            </small>
        </div>
    `;
}

function formatTone(
    status,
    requiresHumanReview,
    pendingAiStatus,
    highestOpenSeverity = '',
    redFlagsCount = 0
) {
    if (redFlagsCount > 0) {
        return 'danger';
    }
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
    const patientName =
        buildAdmissionLegalName(
            review.patientRecord?.admission001,
            review.session.patient
        ) || normalizeString(review.session.patient.name);
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
    const phone =
        normalizeString(intake?.datosPaciente?.telefono) ||
        normalizeString(patient.phone);

    return [
        age !== null ? `${age} anos` : '',
        weight !== null ? `${weight} kg` : '',
        sex,
        formatPregnancy(pregnancy),
        phone ? `Tel. ${phone}` : '',
    ]
        .filter(Boolean)
        .join(' • ');
}

function formatHtmlMultiline(value) {
    const safe = escapeHtml(normalizeString(value));
    return safe ? safe.replace(/\n/g, '<br>') : '';
}

function formatClinicalRecordExportLabel(value, fallback = 'No documentado') {
    const text = normalizeString(value);
    return text || fallback;
}

function formatClinicalRecordExportBoolean(
    value,
    yesLabel = 'Si',
    noLabel = 'No',
    emptyLabel = 'No documentado'
) {
    if (value === true) {
        return yesLabel;
    }
    if (value === false) {
        return noLabel;
    }
    return emptyLabel;
}

function slugifyClinicalRecordExportFragment(value) {
    return normalizeString(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function buildClinicalRecordExportFileName(review) {
    const normalizedReview = normalizeReviewPayload(review);
    const patient = normalizePatient(
        normalizedReview.patientRecord?.patient ||
            normalizedReview.session.patient
    );
    const admission = normalizeAdmission001(
        normalizedReview.patientRecord?.admission001 ||
            normalizedReview.draft.admission001,
        patient,
        normalizedReview.draft.intake
    );
    const patientLabel =
        buildAdmissionLegalName(admission, patient) ||
        normalizeString(patient.name) ||
        normalizeString(normalizedReview.session.caseId) ||
        'historia-clinica';
    const recordLabel =
        normalizeString(normalizedReview.patientRecord?.recordId) ||
        normalizeString(normalizedReview.draft.patientRecordId) ||
        normalizeString(normalizedReview.session.sessionId);
    const stamp = new Date().toISOString().slice(0, 10);
    const base = slugifyClinicalRecordExportFragment(
        `${patientLabel}-${recordLabel}`
    );

    return `${base || 'historia-clinica'}-${stamp}`;
}

function buildClinicalRecordExportStatusPill(label, tone = 'neutral') {
    return `
        <span class="clinical-history-export-pill is-${escapeHtml(tone)}">
            ${escapeHtml(formatClinicalRecordExportLabel(label, '-'))}
        </span>
    `;
}

function buildClinicalRecordExportSection(title, description, content) {
    return `
        <section class="clinical-history-export-section">
            <div class="clinical-history-export-section-head">
                <h2>${escapeHtml(title)}</h2>
                ${
                    normalizeString(description)
                        ? `<p>${escapeHtml(description)}</p>`
                        : ''
                }
            </div>
            ${content}
        </section>
    `;
}

function buildClinicalRecordExportFieldGrid(
    fields,
    emptyMessage = 'Sin informacion registrada.'
) {
    const rows = normalizeList(fields)
        .map((field) => {
            if (!Array.isArray(field) || field.length < 2) {
                return '';
            }
            const label = normalizeString(field[0]);
            const value = normalizeString(field[1]);
            if (!label || !value) {
                return '';
            }

            return `
                <div class="clinical-history-export-field">
                    <dt>${escapeHtml(label)}</dt>
                    <dd>${formatHtmlMultiline(value)}</dd>
                </div>
            `;
        })
        .filter(Boolean)
        .join('');

    return rows
        ? `<dl class="clinical-history-export-fields">${rows}</dl>`
        : `<p class="clinical-history-export-empty">${escapeHtml(
              emptyMessage
          )}</p>`;
}

function buildClinicalRecordExportList(items, emptyMessage = 'Sin registros.') {
    const rows = normalizeList(items)
        .map((item) => normalizeString(item))
        .filter(Boolean)
        .map(
            (item) => `
                <li>${formatHtmlMultiline(item)}</li>
            `
        )
        .join('');

    return rows
        ? `<ul class="clinical-history-export-list">${rows}</ul>`
        : `<p class="clinical-history-export-empty">${escapeHtml(
              emptyMessage
          )}</p>`;
}

function buildClinicalRecordExportCard(title, meta, body, tone = 'neutral') {
    return `
        <article class="clinical-history-export-card is-${escapeHtml(tone)}">
            <header>
                <h3>${escapeHtml(formatClinicalRecordExportLabel(title, '-'))}</h3>
                ${normalizeString(meta) ? `<p>${escapeHtml(meta)}</p>` : ''}
            </header>
            <div class="clinical-history-export-card-body">${body}</div>
        </article>
    `;
}

function buildClinicalRecordExportCards(
    cards,
    emptyMessage = 'Sin registros.'
) {
    const content = normalizeList(cards).filter(Boolean).join('');
    return content
        ? `<div class="clinical-history-export-cards">${content}</div>`
        : `<p class="clinical-history-export-empty">${escapeHtml(
              emptyMessage
          )}</p>`;
}

function buildClinicalRecordExportHtml(review) {
    const normalizedReview = normalizeReviewPayload(review);
    const draft = normalizedReview.draft;
    const documents = normalizedReview.documents || {};
    const patient = normalizePatient(
        normalizedReview.patientRecord?.patient ||
            normalizedReview.session.patient
    );
    const admission = normalizeAdmission001(
        normalizedReview.patientRecord?.admission001 || draft.admission001,
        patient,
        draft.intake
    );
    const readiness = normalizeLegalReadiness(normalizedReview.legalReadiness);
    const approval = normalizeApproval(
        normalizedReview.approvalState || normalizedReview.approval
    );
    const archiveReadiness = normalizeArchiveReadiness(
        normalizedReview.archiveReadiness ||
            normalizedReview.recordsGovernance?.archiveReadiness ||
            normalizedReview.patientRecord?.archiveReadiness
    );
    const accessAudit = normalizeList(normalizedReview.accessAudit).map(
        normalizeAccessAuditEntry
    );
    const latestExport =
        accessAudit.find(
            (entry) => normalizeString(entry.action) === 'export_full_record'
        ) ||
        accessAudit[0] ||
        {};
    const generatedAt =
        normalizeString(latestExport.createdAt) || new Date().toISOString();
    const generatedBy = normalizeString(latestExport.actor) || 'admin@local';
    const legalName =
        buildAdmissionLegalName(admission, patient) ||
        normalizeString(patient.name) ||
        'Paciente sin identificar';
    const documentNumber = [
        normalizeString(admission.identity.documentType),
        normalizeString(admission.identity.documentNumber),
    ]
        .filter(Boolean)
        .join(' ');
    const address = [
        admission.residence.addressLine,
        admission.residence.neighborhood,
        admission.residence.parish,
        admission.residence.canton,
        admission.residence.province,
    ]
        .map((item) => normalizeString(item))
        .filter(Boolean)
        .join(', ');
    const redFlags = formatClinicalRedFlags(
        draft.redFlags || draft.intake.rosRedFlags
    );
    const missingFields = normalizeStringList(draft.intake.preguntasFaltantes);
    const prescriptionItems = normalizePrescriptionItems(
        draft?.clinicianDraft?.hcu005?.prescriptionItems ||
            documents?.prescription?.items
    );
    const intakeSection = buildClinicalRecordExportFieldGrid([
        ['Motivo de consulta', draft.intake.motivoConsulta],
        ['Enfermedad actual', draft.intake.enfermedadActual],
        ['Antecedentes', draft.intake.antecedentes],
        ['Alergias', draft.intake.alergias],
        ['Medicacion actual', draft.intake.medicacionActual],
        ['Fototipo Fitzpatrick', draft.intake.fototipoFitzpatrick],
        ['Habitos', draft.intake.habitos],
        ['Resumen clinico', draft.intake.resumenClinico],
    ]);
    const hcu005Section = buildClinicalRecordExportFieldGrid([
        ['Evolucion clinica', draft.clinicianDraft?.hcu005?.evolutionNote],
        [
            'Impresion diagnostica',
            draft.clinicianDraft?.hcu005?.diagnosticImpression,
        ],
        ['Plan terapeutico', draft.clinicianDraft?.hcu005?.therapeuticPlan],
        [
            'Indicaciones de cuidado',
            draft.clinicianDraft?.hcu005?.careIndications,
        ],
    ]);
    const readinessChecklistCards = normalizeList(readiness.checklist).map(
        (item) =>
            buildClinicalRecordExportCard(
                normalizeString(item.label) ||
                    humanizeClinicalCode(item.code || 'check'),
                formatClinicalRecordExportLabel(
                    normalizeString(item.status)
                        ? humanizeClinicalCode(item.status)
                        : '',
                    'Sin estado'
                ),
                normalizeString(item.message)
                    ? `<p>${formatHtmlMultiline(item.message)}</p>`
                    : '<p class="clinical-history-export-empty">Sin detalle adicional.</p>',
                normalizeString(item.status) === 'pass'
                    ? 'success'
                    : normalizeString(item.status) === 'warn'
                      ? 'warning'
                      : 'danger'
            )
    );
    const interconsultCards = normalizeList(
        normalizedReview.interconsultations
    ).map((item) =>
        buildClinicalRecordExportCard(
            normalizeString(item.destinationService) ||
                normalizeString(item.interconsultId) ||
                'Interconsulta',
            [
                formatClinicalRecordExportLabel(
                    humanizeClinicalCode(item.status),
                    'Sin estado'
                ),
                readableTimestamp(item.requestedAt || item.createdAt),
            ]
                .filter((value) => value && value !== '-')
                .join(' • '),
            `${buildClinicalRecordExportFieldGrid([
                ['Establecimiento', item.destinationEstablishment],
                ['Profesional consultado', item.consultedProfessionalName],
                ['Motivo', item.requestReason],
                ['Cuadro clinico', item.clinicalPicture],
                [
                    'Diagnosticos',
                    normalizeStringList(item.diagnoses).join(', '),
                ],
                ['Reporte', item.report?.summary || item.report?.assessment],
                [
                    'Estado del reporte',
                    formatClinicalRecordExportLabel(
                        humanizeClinicalCode(item.reportStatus),
                        'Sin reporte'
                    ),
                ],
            ])}`,
            normalizeString(item.status) === 'issued' ? 'success' : 'neutral'
        )
    );
    const labOrderCards = normalizeList(normalizedReview.labOrders).map(
        (item) =>
            buildClinicalRecordExportCard(
                normalizeString(item.labOrderId) || 'Orden de laboratorio',
                [
                    formatClinicalRecordExportLabel(
                        humanizeClinicalCode(item.status),
                        'Sin estado'
                    ),
                    readableTimestamp(item.sampleDate || item.requestedAt),
                ]
                    .filter((value) => value && value !== '-')
                    .join(' • '),
                `${buildClinicalRecordExportFieldGrid([
                    ['Servicio solicitante', item.requestingService],
                    ['Establecimiento', item.requestingEstablishment],
                    ['Prioridad', item.priority],
                    [
                        'Estudios',
                        normalizeList([
                            ...normalizeStringList(
                                item.studySelections?.hematology
                            ),
                            ...normalizeStringList(
                                item.studySelections?.urinalysis
                            ),
                            ...normalizeStringList(
                                item.studySelections?.coprological
                            ),
                            ...normalizeStringList(
                                item.studySelections?.bloodChemistry
                            ),
                            ...normalizeStringList(
                                item.studySelections?.serology
                            ),
                            ...normalizeStringList(
                                item.studySelections?.bacteriology
                            ),
                            item.studySelections?.others,
                        ])
                            .map((study) => normalizeString(study))
                            .filter(Boolean)
                            .join(', '),
                    ],
                    ['Notas', item.notes],
                ])}`,
                normalizeString(item.status) === 'issued'
                    ? 'success'
                    : 'neutral'
            )
    );
    const imagingOrderCards = normalizeList(normalizedReview.imagingOrders).map(
        (item) =>
            buildClinicalRecordExportCard(
                normalizeString(item.imagingOrderId) || 'Orden de imagenologia',
                [
                    formatClinicalRecordExportLabel(
                        humanizeClinicalCode(item.status),
                        'Sin estado'
                    ),
                    readableTimestamp(item.studyDate || item.requestedAt),
                ]
                    .filter((value) => value && value !== '-')
                    .join(' • '),
                `${buildClinicalRecordExportFieldGrid([
                    ['Servicio solicitante', item.requestingService],
                    ['Establecimiento', item.requestingEstablishment],
                    ['Prioridad', item.priority],
                    [
                        'Estudios',
                        normalizeList([
                            ...normalizeStringList(item.studySelections?.xray),
                            ...normalizeStringList(
                                item.studySelections?.ultrasound
                            ),
                            ...normalizeStringList(
                                item.studySelections?.tomography
                            ),
                            ...normalizeStringList(
                                item.studySelections?.magneticResonance
                            ),
                            ...normalizeStringList(
                                item.studySelections?.mammography
                            ),
                            item.studySelections?.others,
                        ])
                            .map((study) => normalizeString(study))
                            .filter(Boolean)
                            .join(', '),
                    ],
                    ['Resumen clinico', item.clinicalSummary],
                    ['Motivo', item.requestReason],
                    [
                        'Estado del resultado',
                        formatClinicalRecordExportLabel(
                            humanizeClinicalCode(item.resultStatus),
                            'Sin resultado'
                        ),
                    ],
                ])}`,
                normalizeString(item.status) === 'issued'
                    ? 'success'
                    : 'neutral'
            )
    );
    const consentPacketCards = normalizeList(
        normalizedReview.consentPackets
    ).map((item) =>
        buildClinicalRecordExportCard(
            item.procedureLabel || item.title || 'Consentimiento informado',
            [
                formatClinicalRecordExportLabel(
                    humanizeClinicalCode(item.status),
                    'Sin estado'
                ),
                readableTimestamp(
                    item.declaration?.declaredAt ||
                        item.patientAttestation?.signedAt ||
                        item.representativeAttestation?.signedAt
                ),
            ]
                .filter((value) => value && value !== '-')
                .join(' • '),
            `${buildClinicalRecordExportFieldGrid([
                ['Formulario', item.title],
                ['Procedimiento', item.procedureName],
                ['Diagnostico', item.diagnosisLabel || item.diagnosisCie10],
                ['En que consiste', item.procedureWhatIsIt],
                ['Como se realiza', item.procedureHowItIsDone],
                ['Beneficios', item.benefits],
                ['Riesgos frecuentes', item.frequentRisks],
                ['Alternativas', item.alternatives],
                [
                    'Consecuencias de no realizarlo',
                    item.noProcedureConsequences,
                ],
                [
                    'Comunicacion privada confirmada',
                    formatClinicalRecordExportBoolean(
                        item.privateCommunicationConfirmed
                    ),
                ],
                [
                    'Autorizacion para acompanante',
                    formatClinicalRecordExportBoolean(
                        item.companionShareAuthorized
                    ),
                ],
            ])}`,
            ['accepted', 'declined', 'revoked'].includes(
                normalizeString(item.status)
            )
                ? 'success'
                : 'neutral'
        )
    );
    const copyRequestCards = normalizeList(normalizedReview.copyRequests).map(
        (item) =>
            buildClinicalRecordExportCard(
                item.requestId || 'Solicitud de copia',
                [
                    item.statusLabel ||
                        humanizeClinicalCode(item.effectiveStatus),
                    readableTimestamp(item.requestedAt),
                ]
                    .filter((value) => value && value !== '-')
                    .join(' • '),
                `${buildClinicalRecordExportFieldGrid([
                    [
                        'Solicitada por',
                        item.requestedByName || item.requestedByType,
                    ],
                    ['Base legal', item.legalBasis],
                    ['Entrega a', item.deliveredTo],
                    ['Canal de entrega', item.deliveryChannel],
                    ['Vence', readableTimestamp(item.dueAt)],
                    ['Entregada', readableTimestamp(item.deliveredAt)],
                    ['Notas', item.notes],
                ])}`,
                normalizeString(item.effectiveStatus) === 'overdue'
                    ? 'danger'
                    : normalizeString(item.effectiveStatus) === 'delivered'
                      ? 'success'
                      : 'warning'
            )
    );
    const disclosureCards = normalizeList(normalizedReview.disclosureLog).map(
        (item) =>
            buildClinicalRecordExportCard(
                formatDisclosureTarget(item.targetType),
                [readableTimestamp(item.performedAt), item.performedBy]
                    .filter(Boolean)
                    .join(' • '),
                `${buildClinicalRecordExportFieldGrid([
                    ['Destinatario', item.targetName],
                    ['Proposito', item.purpose],
                    ['Canal', item.channel],
                    ['Base legal', item.legalBasis],
                    [
                        'Autorizado por consentimiento',
                        formatClinicalRecordExportBoolean(
                            item.authorizedByConsent
                        ),
                    ],
                    ['Notas', item.notes],
                ])}`
            )
    );
    const auditCards = accessAudit.map((item) =>
        buildClinicalRecordExportCard(
            formatClinicalRecordExportLabel(
                humanizeClinicalCode(item.action),
                'Acceso'
            ),
            [readableTimestamp(item.createdAt), item.actor]
                .filter(Boolean)
                .join(' • '),
            `${buildClinicalRecordExportFieldGrid([
                ['Razon', humanizeClinicalCode(item.reason)],
                ['Recurso', humanizeClinicalCode(item.resource)],
                [
                    'Meta',
                    normalizeList(
                        Object.entries(item.meta || {}).map(([key, value]) => {
                            if (
                                value === null ||
                                value === undefined ||
                                value === ''
                            ) {
                                return '';
                            }
                            if (typeof value === 'boolean') {
                                return `${humanizeClinicalCode(key)}: ${
                                    value ? 'Si' : 'No'
                                }`;
                            }
                            return `${humanizeClinicalCode(key)}: ${String(
                                value
                            )}`;
                        })
                    )
                        .map((entry) => normalizeString(entry))
                        .filter(Boolean)
                        .join(' • '),
                ],
            ])}`
        )
    );
    const transcriptCards = normalizeList(
        normalizedReview.session.transcript
    ).map((item) =>
        buildClinicalRecordExportCard(
            normalizeString(item.actor) || humanizeClinicalCode(item.role),
            [
                humanizeClinicalCode(item.role || 'mensaje'),
                readableTimestamp(item.createdAt),
            ]
                .filter((value) => value && value !== '-')
                .join(' • '),
            normalizeString(item.content)
                ? `<p>${formatHtmlMultiline(item.content)}</p>`
                : '<p class="clinical-history-export-empty">Sin contenido.</p>',
            normalizeString(item.role) === 'assistant' ? 'neutral' : 'success'
        )
    );
    const eventCards = normalizeList(normalizedReview.events).map((item) =>
        buildClinicalRecordExportCard(
            item.title || humanizeClinicalCode(item.type),
            [
                formatClinicalRecordExportLabel(
                    humanizeClinicalCode(item.severity),
                    'Sin severidad'
                ),
                formatClinicalRecordExportLabel(
                    humanizeClinicalCode(item.status),
                    'Sin estado'
                ),
                readableTimestamp(item.occurredAt),
            ]
                .filter((value) => value && value !== '-')
                .join(' • '),
            normalizeString(item.message)
                ? `<p>${formatHtmlMultiline(item.message)}</p>`
                : '<p class="clinical-history-export-empty">Sin mensaje adicional.</p>',
            normalizeString(item.severity) === 'critical'
                ? 'danger'
                : normalizeString(item.severity) === 'warning'
                  ? 'warning'
                  : 'neutral'
        )
    );
    const historyCards = normalizeList(
        normalizedReview.patientRecord?.admissionHistory
    ).map((item) =>
        buildClinicalRecordExportCard(
            humanizeClinicalCode(item.type || 'admission_history'),
            readableTimestamp(item.recordedAt || item.createdAt),
            `${buildClinicalRecordExportFieldGrid([
                ['Resumen', item.summary],
                ['Responsable', item.recordedBy || item.actor],
                ['Observaciones', item.notes],
            ])}`
        )
    );
    const changeLogCards = normalizeList(
        normalizedReview.patientRecord?.changeLog
    ).map((item) =>
        buildClinicalRecordExportCard(
            humanizeClinicalCode(item.fieldKey || 'change'),
            readableTimestamp(item.changedAt || item.createdAt),
            `${buildClinicalRecordExportFieldGrid([
                ['Valor previo', item.previousValue],
                ['Valor nuevo', item.nextValue],
                ['Actualizado por', item.changedBy || item.actor],
                ['Motivo', item.reason],
            ])}`
        )
    );
    const snapshotCards = []
        .concat(
            normalizeList(documents.interconsultForms).map((item) =>
                buildClinicalRecordExportCard(
                    item.destinationService || item.interconsultId || 'HCU-007',
                    readableTimestamp(item.issuedAt || item.snapshotAt),
                    `${buildClinicalRecordExportFieldGrid([
                        [
                            'Estado',
                            humanizeClinicalCode(
                                item.interconsultStatus || item.status
                            ),
                        ],
                        ['Establecimiento', item.destinationEstablishment],
                    ])}`
                )
            )
        )
        .concat(
            normalizeList(documents.interconsultReports).map((item) =>
                buildClinicalRecordExportCard(
                    item.destinationService ||
                        item.interconsultId ||
                        'Reporte HCU-007',
                    readableTimestamp(item.finalizedAt || item.snapshotAt),
                    `${buildClinicalRecordExportFieldGrid([
                        [
                            'Estado',
                            humanizeClinicalCode(
                                item.reportStatus || item.status
                            ),
                        ],
                        [
                            'Profesional',
                            item.consultedProfessionalName ||
                                item.report?.consultantProfessionalName,
                        ],
                    ])}`
                )
            )
        )
        .concat(
            normalizeList(documents.labOrders).map((item) =>
                buildClinicalRecordExportCard(
                    item.labOrderId || 'HCU-010A',
                    readableTimestamp(item.issuedAt || item.snapshotAt),
                    `${buildClinicalRecordExportFieldGrid([
                        ['Estado', humanizeClinicalCode(item.status)],
                        ['Servicio', item.requestingService],
                    ])}`
                )
            )
        )
        .concat(
            normalizeList(documents.imagingOrders).map((item) =>
                buildClinicalRecordExportCard(
                    item.imagingOrderId || 'HCU-012A',
                    readableTimestamp(item.issuedAt || item.snapshotAt),
                    `${buildClinicalRecordExportFieldGrid([
                        ['Estado', humanizeClinicalCode(item.status)],
                        ['Servicio', item.requestingService],
                    ])}`
                )
            )
        )
        .concat(
            normalizeList(documents.imagingReports).map((item) =>
                buildClinicalRecordExportCard(
                    item.imagingOrderId || 'Reporte HCU-012A',
                    readableTimestamp(item.finalizedAt || item.snapshotAt),
                    `${buildClinicalRecordExportFieldGrid([
                        [
                            'Estado',
                            humanizeClinicalCode(
                                item.resultStatus || item.status
                            ),
                        ],
                        ['Radiologo', item.report?.radiologistProfessionalName],
                    ])}`
                )
            )
        )
        .concat(
            normalizeList(documents.consentForms).map((item) =>
                buildClinicalRecordExportCard(
                    item.procedureLabel || item.packetId || 'HCU-024',
                    readableTimestamp(
                        item.patientAttestation?.signedAt ||
                            item.representativeAttestation?.signedAt
                    ),
                    `${buildClinicalRecordExportFieldGrid([
                        ['Estado', humanizeClinicalCode(item.status)],
                        ['Formulario', item.title],
                    ])}`
                )
            )
        );

    return `<!doctype html>
<html lang="es">
    <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(buildClinicalRecordExportFileName(normalizedReview))}</title>
        <style>
            :root {
                color-scheme: light;
                --ink: #1f2937;
                --muted: #5b6474;
                --line: #d7dee7;
                --panel: #f5f7fb;
                --success: #146c43;
                --warning: #9a4d00;
                --danger: #a61b1b;
                --neutral: #385170;
            }
            * { box-sizing: border-box; }
            body {
                margin: 0;
                font-family: "Georgia", "Times New Roman", serif;
                color: var(--ink);
                background: #eef2f7;
            }
            main {
                max-width: 1120px;
                margin: 0 auto;
                padding: 32px 24px 48px;
            }
            .clinical-history-export-shell {
                background: #fff;
                border: 1px solid var(--line);
                border-radius: 24px;
                overflow: hidden;
                box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
            }
            .clinical-history-export-header {
                padding: 32px;
                background:
                    linear-gradient(135deg, rgba(14, 116, 144, 0.08), rgba(148, 163, 184, 0.08)),
                    #fff;
                border-bottom: 1px solid var(--line);
            }
            .clinical-history-export-header h1 {
                margin: 0 0 8px;
                font-size: 2rem;
            }
            .clinical-history-export-header p {
                margin: 0;
                color: var(--muted);
            }
            .clinical-history-export-toolbar {
                display: flex;
                justify-content: space-between;
                gap: 16px;
                align-items: center;
                margin-top: 20px;
                flex-wrap: wrap;
            }
            .clinical-history-export-toolbar button {
                border: none;
                border-radius: 999px;
                background: #0f172a;
                color: #fff;
                padding: 12px 18px;
                font: inherit;
                cursor: pointer;
            }
            .clinical-history-export-meta {
                display: grid;
                gap: 14px;
                grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
                padding: 24px 32px 0;
            }
            .clinical-history-export-meta article {
                border: 1px solid var(--line);
                border-radius: 18px;
                padding: 16px;
                background: var(--panel);
            }
            .clinical-history-export-meta span {
                display: block;
                font-size: 0.78rem;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: var(--muted);
            }
            .clinical-history-export-meta strong {
                display: block;
                margin-top: 6px;
                font-size: 1.04rem;
            }
            .clinical-history-export-pills {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 20px;
            }
            .clinical-history-export-pill {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                border-radius: 999px;
                padding: 8px 14px;
                font-size: 0.86rem;
                font-weight: 600;
                border: 1px solid currentColor;
            }
            .clinical-history-export-pill.is-success { color: var(--success); }
            .clinical-history-export-pill.is-warning { color: var(--warning); }
            .clinical-history-export-pill.is-danger { color: var(--danger); }
            .clinical-history-export-pill.is-neutral { color: var(--neutral); }
            .clinical-history-export-content {
                padding: 24px 32px 40px;
            }
            .clinical-history-export-section + .clinical-history-export-section {
                margin-top: 28px;
                padding-top: 28px;
                border-top: 1px solid var(--line);
            }
            .clinical-history-export-section-head h2 {
                margin: 0 0 6px;
                font-size: 1.35rem;
            }
            .clinical-history-export-section-head p {
                margin: 0 0 18px;
                color: var(--muted);
            }
            .clinical-history-export-fields {
                display: grid;
                gap: 12px;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                margin: 0;
            }
            .clinical-history-export-field {
                margin: 0;
                padding: 14px;
                border: 1px solid var(--line);
                border-radius: 16px;
                background: #fff;
            }
            .clinical-history-export-field dt {
                margin: 0 0 6px;
                font-size: 0.76rem;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: var(--muted);
            }
            .clinical-history-export-field dd {
                margin: 0;
                line-height: 1.55;
            }
            .clinical-history-export-list {
                margin: 0;
                padding-left: 20px;
                display: grid;
                gap: 8px;
            }
            .clinical-history-export-empty {
                margin: 0;
                color: var(--muted);
                font-style: italic;
            }
            .clinical-history-export-cards {
                display: grid;
                gap: 14px;
            }
            .clinical-history-export-card {
                border: 1px solid var(--line);
                border-left-width: 6px;
                border-radius: 18px;
                padding: 18px;
                background: #fff;
            }
            .clinical-history-export-card.is-success { border-left-color: rgba(20, 108, 67, 0.85); }
            .clinical-history-export-card.is-warning { border-left-color: rgba(154, 77, 0, 0.85); }
            .clinical-history-export-card.is-danger { border-left-color: rgba(166, 27, 27, 0.85); }
            .clinical-history-export-card.is-neutral { border-left-color: rgba(56, 81, 112, 0.85); }
            .clinical-history-export-card header {
                display: flex;
                justify-content: space-between;
                gap: 16px;
                align-items: baseline;
                flex-wrap: wrap;
                margin-bottom: 12px;
            }
            .clinical-history-export-card h3 {
                margin: 0;
                font-size: 1rem;
            }
            .clinical-history-export-card p {
                margin: 0;
                color: var(--muted);
            }
            .clinical-history-export-card-body {
                display: grid;
                gap: 12px;
            }
            @media print {
                body {
                    background: #fff;
                }
                main {
                    max-width: none;
                    padding: 0;
                }
                .clinical-history-export-shell {
                    border: none;
                    border-radius: 0;
                    box-shadow: none;
                }
                .clinical-history-export-toolbar {
                    display: none;
                }
            }
        </style>
    </head>
    <body>
        <main>
            <div class="clinical-history-export-shell">
                <header class="clinical-history-export-header">
                    <h1>Historia clinica electronica completa</h1>
                    <p>
                        Export de HCE listo para imprimir o guardar como PDF con
                        base en el estado actual del expediente y la trazabilidad
                        medico-legal disponible.
                    </p>
                    <div class="clinical-history-export-toolbar">
                        <button type="button" onclick="window.print()">
                            Imprimir / Guardar PDF
                        </button>
                        <span>${escapeHtml(
                            `Generado ${readableTimestamp(generatedAt)} por ${generatedBy}`
                        )}</span>
                    </div>
                    <div class="clinical-history-export-pills">
                        ${buildClinicalRecordExportStatusPill(
                            readiness.label || readiness.status,
                            readiness.ready ? 'success' : 'danger'
                        )}
                        ${buildClinicalRecordExportStatusPill(
                            approval.status === 'approved'
                                ? 'Aprobacion final emitida'
                                : `Aprobacion ${approval.status || 'pendiente'}`,
                            approval.status === 'approved'
                                ? 'success'
                                : 'warning'
                        )}
                        ${buildClinicalRecordExportStatusPill(
                            archiveReadiness.label ||
                                humanizeClinicalCode(
                                    archiveReadiness.archiveState
                                ),
                            archiveReadiness.archiveState === 'passive'
                                ? 'neutral'
                                : 'warning'
                        )}
                    </div>
                </header>
                <div class="clinical-history-export-meta">
                    <article>
                        <span>Paciente</span>
                        <strong>${escapeHtml(legalName)}</strong>
                        <p>${escapeHtml(
                            formatPatientFacts(patient, draft.intake) ||
                                'Sin datos demograficos completos.'
                        )}</p>
                    </article>
                    <article>
                        <span>Record / caso</span>
                        <strong>${escapeHtml(
                            formatClinicalRecordExportLabel(
                                normalizedReview.patientRecord?.recordId ||
                                    draft.patientRecordId,
                                'Sin recordId'
                            )
                        )}</strong>
                        <p>${escapeHtml(
                            `Caso ${formatClinicalRecordExportLabel(
                                normalizedReview.session.caseId,
                                'Sin caseId'
                            )} • Sesion ${formatClinicalRecordExportLabel(
                                normalizedReview.session.sessionId,
                                'Sin sessionId'
                            )}`
                        )}</p>
                    </article>
                    <article>
                        <span>Documento</span>
                        <strong>${escapeHtml(
                            formatClinicalRecordExportLabel(
                                documentNumber,
                                'Sin documento'
                            )
                        )}</strong>
                        <p>${escapeHtml(
                            address || 'Direccion no registrada.'
                        )}</p>
                    </article>
                    <article>
                        <span>Resumen legal</span>
                        <strong>${escapeHtml(
                            readiness.label || 'Sin readiness'
                        )}</strong>
                        <p>${escapeHtml(
                            readiness.summary ||
                                'Sin comentario medico-legal adicional.'
                        )}</p>
                    </article>
                </div>
                <div class="clinical-history-export-content">
                    ${buildClinicalRecordExportSection(
                        'Identificacion y admision',
                        'Datos base del paciente y apertura del episodio.',
                        buildClinicalRecordExportFieldGrid([
                            ['Paciente', legalName],
                            ['Documento', documentNumber],
                            ['Email', patient.email],
                            [
                                'Fecha de nacimiento',
                                admission.demographics.birthDate,
                            ],
                            [
                                'Edad',
                                admission.demographics.ageYears !== null
                                    ? `${admission.demographics.ageYears} anos`
                                    : '',
                            ],
                            [
                                'Sexo biologico',
                                admission.demographics.sexAtBirth,
                            ],
                            [
                                'Embarazo',
                                formatPregnancy(
                                    draft.intake?.datosPaciente?.embarazo ??
                                        patient.pregnant
                                ),
                            ],
                            [
                                'Telefono',
                                admission.residence.phone || patient.phone,
                            ],
                            ['Direccion', address],
                            [
                                'Fecha de admision',
                                admission.admissionMeta.admissionDate,
                            ],
                            [
                                'Tipo de admision',
                                admission.admissionMeta.admissionKind,
                            ],
                            [
                                'Modo de transicion',
                                humanizeClinicalCode(
                                    admission.admissionMeta.transitionMode
                                ),
                            ],
                        ])
                    )}
                    ${buildClinicalRecordExportSection(
                        'Motivo e historia actual',
                        'Resumen del intake y alertas activas del episodio.',
                        `${intakeSection}
                        ${buildClinicalRecordExportSection(
                            'Red flags y preguntas pendientes',
                            '',
                            `
                                <div class="clinical-history-export-cards">
                                    ${buildClinicalRecordExportCard(
                                        'Red flags clinicos',
                                        redFlags.length > 0
                                            ? `${redFlags.length} alerta(s)`
                                            : 'Sin alertas',
                                        buildClinicalRecordExportList(
                                            redFlags,
                                            'Sin red flags activos.'
                                        ),
                                        redFlags.length > 0
                                            ? 'danger'
                                            : 'success'
                                    )}
                                    ${buildClinicalRecordExportCard(
                                        'Campos pendientes',
                                        missingFields.length > 0
                                            ? `${missingFields.length} pendiente(s)`
                                            : 'Completo',
                                        buildClinicalRecordExportList(
                                            missingFields,
                                            'No hay preguntas faltantes.'
                                        ),
                                        missingFields.length > 0
                                            ? 'warning'
                                            : 'success'
                                    )}
                                </div>
                            `
                        )}`
                    )}
                    ${buildClinicalRecordExportSection(
                        'Evolucion clinica y documentos de salida',
                        'Contenido clinico consolidado en HCU-005, nota final, receta y certificado.',
                        `${hcu005Section}
                        ${buildClinicalRecordExportCards(
                            [
                                buildClinicalRecordExportCard(
                                    'Nota final',
                                    [
                                        humanizeClinicalCode(
                                            documents.finalNote?.status
                                        ),
                                        readableTimestamp(
                                            documents.finalNote?.generatedAt
                                        ),
                                    ]
                                        .filter(
                                            (value) => value && value !== '-'
                                        )
                                        .join(' • '),
                                    `${buildClinicalRecordExportFieldGrid([
                                        [
                                            'Resumen',
                                            documents.finalNote?.summary,
                                        ],
                                        [
                                            'Contenido',
                                            documents.finalNote?.content,
                                        ],
                                    ])}`,
                                    normalizeString(
                                        documents.finalNote?.status
                                    ) === 'approved'
                                        ? 'success'
                                        : 'neutral'
                                ),
                                buildClinicalRecordExportCard(
                                    'Receta',
                                    [
                                        humanizeClinicalCode(
                                            documents.prescription?.status
                                        ),
                                        readableTimestamp(
                                            documents.prescription?.signedAt
                                        ),
                                    ]
                                        .filter(
                                            (value) => value && value !== '-'
                                        )
                                        .join(' • '),
                                    `${buildClinicalRecordExportFieldGrid([
                                        [
                                            'Medicacion',
                                            documents.prescription?.medication,
                                        ],
                                        [
                                            'Indicaciones',
                                            documents.prescription?.directions,
                                        ],
                                    ])}
                                    ${buildClinicalRecordExportList(
                                        prescriptionItems.map((item) =>
                                            [
                                                item.medication,
                                                item.presentation,
                                                item.dose,
                                                item.route,
                                                item.frequency,
                                                item.duration,
                                                item.quantity,
                                                item.instructions,
                                            ]
                                                .map((value) =>
                                                    normalizeString(value)
                                                )
                                                .filter(Boolean)
                                                .join(' • ')
                                        ),
                                        'Sin items prescritos.'
                                    )}`,
                                    normalizeString(
                                        documents.prescription?.status
                                    ) === 'issued'
                                        ? 'success'
                                        : 'neutral'
                                ),
                                buildClinicalRecordExportCard(
                                    'Certificado medico',
                                    [
                                        humanizeClinicalCode(
                                            documents.certificate?.status
                                        ),
                                        readableTimestamp(
                                            documents.certificate?.signedAt
                                        ),
                                    ]
                                        .filter(
                                            (value) => value && value !== '-'
                                        )
                                        .join(' • '),
                                    `${buildClinicalRecordExportFieldGrid([
                                        [
                                            'Resumen',
                                            documents.certificate?.summary,
                                        ],
                                        [
                                            'Dias de reposo',
                                            documents.certificate?.restDays !==
                                            null
                                                ? String(
                                                      documents.certificate
                                                          .restDays
                                                  )
                                                : '',
                                        ],
                                    ])}`,
                                    normalizeString(
                                        documents.certificate?.status
                                    ) === 'issued'
                                        ? 'success'
                                        : 'neutral'
                                ),
                            ],
                            'Sin documentos de salida.'
                        )}`
                    )}
                    ${buildClinicalRecordExportSection(
                        'Interconsultas, laboratorio, imagenologia y consentimiento',
                        'Ordenes, formularios y consentimientos asociados al mismo episodio.',
                        `
                            ${buildClinicalRecordExportSection(
                                'Interconsultas',
                                '',
                                buildClinicalRecordExportCards(
                                    interconsultCards,
                                    'Sin interconsultas registradas.'
                                )
                            )}
                            ${buildClinicalRecordExportSection(
                                'Laboratorio',
                                '',
                                buildClinicalRecordExportCards(
                                    labOrderCards,
                                    'Sin ordenes de laboratorio.'
                                )
                            )}
                            ${buildClinicalRecordExportSection(
                                'Imagenologia',
                                '',
                                buildClinicalRecordExportCards(
                                    imagingOrderCards,
                                    'Sin ordenes de imagenologia.'
                                )
                            )}
                            ${buildClinicalRecordExportSection(
                                'Consentimientos HCU-024',
                                '',
                                buildClinicalRecordExportCards(
                                    consentPacketCards,
                                    'Sin consentimientos documentados.'
                                )
                            )}
                        `
                    )}
                    ${buildClinicalRecordExportSection(
                        'Checklist legal y readiness',
                        'Criterios medico-legales vigentes al momento de la exportacion.',
                        `
                            ${buildClinicalRecordExportFieldGrid([
                                [
                                    'Estado legal',
                                    readiness.label || readiness.status,
                                ],
                                [
                                    'Aprobacion',
                                    humanizeClinicalCode(
                                        approval.status || 'pending'
                                    ),
                                ],
                                ['Aprobado por', approval.approvedBy],
                                [
                                    'Aprobado en',
                                    readableTimestamp(approval.approvedAt),
                                ],
                            ])}
                            ${buildClinicalRecordExportSection(
                                'Checklist',
                                '',
                                buildClinicalRecordExportCards(
                                    readinessChecklistCards,
                                    'Sin checklist legal.'
                                )
                            )}
                            ${buildClinicalRecordExportSection(
                                'Bloqueos activos',
                                '',
                                buildClinicalRecordExportList(
                                    normalizeList(
                                        readiness.blockingReasons
                                    ).map(
                                        (item) =>
                                            normalizeString(item.title) ||
                                            normalizeString(item.message) ||
                                            humanizeClinicalCode(item.code)
                                    ),
                                    'No hay bloqueos medico-legales abiertos.'
                                )
                            )}
                        `
                    )}
                    ${buildClinicalRecordExportSection(
                        'Gobernanza documental y trazabilidad',
                        'Copias certificadas, disclosures, archivo y auditoria de accesos.',
                        `
                            ${buildClinicalRecordExportFieldGrid([
                                [
                                    'Estado de archivo',
                                    archiveReadiness.label ||
                                        archiveReadiness.archiveState,
                                ],
                                [
                                    'Ultima atencion',
                                    readableTimestamp(
                                        archiveReadiness.lastAttentionAt
                                    ),
                                ],
                                [
                                    'Elegible para archivo pasivo',
                                    formatClinicalRecordExportBoolean(
                                        archiveReadiness.eligibleForPassive
                                    ),
                                ],
                                [
                                    'Fecha elegible',
                                    readableTimestamp(
                                        archiveReadiness.eligibleAt
                                    ),
                                ],
                            ])}
                            ${buildClinicalRecordExportSection(
                                'Solicitudes de copia',
                                '',
                                buildClinicalRecordExportCards(
                                    copyRequestCards,
                                    'Sin solicitudes de copia certificada.'
                                )
                            )}
                            ${buildClinicalRecordExportSection(
                                'Disclosure',
                                '',
                                buildClinicalRecordExportCards(
                                    disclosureCards,
                                    'Sin disclosures registrados.'
                                )
                            )}
                            ${buildClinicalRecordExportSection(
                                'Auditoria de accesos',
                                '',
                                buildClinicalRecordExportCards(
                                    auditCards,
                                    'Sin auditoria registrada.'
                                )
                            )}
                        `
                    )}
                    ${buildClinicalRecordExportSection(
                        'Historial longitudinal y transcript',
                        'Trazabilidad narrativa del caso y modificaciones del expediente.',
                        `
                            ${buildClinicalRecordExportSection(
                                'Historial de admision',
                                '',
                                buildClinicalRecordExportCards(
                                    historyCards,
                                    'Sin historial longitudinal adicional.'
                                )
                            )}
                            ${buildClinicalRecordExportSection(
                                'Change log',
                                '',
                                buildClinicalRecordExportCards(
                                    changeLogCards,
                                    'Sin cambios longitudinales registrados.'
                                )
                            )}
                            ${buildClinicalRecordExportSection(
                                'Transcript',
                                '',
                                buildClinicalRecordExportCards(
                                    transcriptCards,
                                    'Sin transcript disponible.'
                                )
                            )}
                            ${buildClinicalRecordExportSection(
                                'Eventos clinicos',
                                '',
                                buildClinicalRecordExportCards(
                                    eventCards,
                                    'Sin eventos asociados.'
                                )
                            )}
                        `
                    )}
                    ${buildClinicalRecordExportSection(
                        'Snapshots documentales',
                        'Formularios y snapshots que quedaron congelados en el episodio.',
                        buildClinicalRecordExportCards(
                            snapshotCards,
                            'Sin snapshots documentales emitidos.'
                        )
                    )}
                </div>
            </div>
        </main>
    </body>
</html>`;
}

function openClinicalRecordExport(review) {
    const exportWindow = window.open('', '_blank');
    if (!exportWindow || !exportWindow.document) {
        return false;
    }

    exportWindow.document.open();
    exportWindow.document.write(buildClinicalRecordExportHtml(review));
    exportWindow.document.close();
    try {
        exportWindow.document.title = buildClinicalRecordExportFileName(review);
        exportWindow.focus();
        if (navigator.webdriver !== true) {
            window.setTimeout(() => {
                try {
                    exportWindow.print();
                } catch (_error) {
                    // Ignore print failures and leave the export window open.
                }
            }, 150);
        }
    } catch (_error) {
        // Ignore focus/print issues so the document remains accessible.
    }

    return true;
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
    const admission = normalizeAdmission001(
        review.patientRecord?.admission001 || draft.admission001,
        patient,
        draft.intake
    );
    const legalName = buildAdmissionLegalName(admission, patient);
    const documentLabel = [
        normalizeString(admission.identity.documentType),
        normalizeString(admission.identity.documentNumber),
    ]
        .filter(Boolean)
        .join(' ');
    const hcu001Status = hcu001StatusMeta(readiness.hcu001Status?.status);
    const hcu005Status = hcu005StatusMeta(readiness.hcu005Status?.status);
    const hcu007Status = hcu007StatusMeta(readiness.hcu007Status?.status);
    const hcu010AStatus = hcu010AStatusMeta(readiness.hcu010AStatus?.status);
    const hcu012AStatus = hcu012AStatusMeta(readiness.hcu012AStatus?.status);
    const hcu024Status = hcu024StatusMeta(readiness.hcu024Status?.status);
    const pendingAiStatus = formatPendingAiStatus(
        review.session.pendingAi?.status || draft.pendingAi?.status
    );
    const statusTone = formatTone(
        draft.reviewStatus,
        draft.requiresHumanReview,
        pendingAiStatus,
        highestReviewEventSeverity(review),
        draft.redFlags?.length || 0
    );
    const checklistFailures = normalizeList(readiness.checklist).filter(
        (item) => normalizeString(item?.status) !== 'pass'
    );
    const redFlags = formatClinicalRedFlags(draft.redFlags);

    const cards = [
        {
            title: 'Paciente',
            value: currentSelectionLabel(review),
            meta:
                documentLabel ||
                patient.email ||
                admission.residence.phone ||
                patient.phone ||
                'Sin contacto documentado',
        },
        {
            title: 'HCU-001',
            value: hcu001Status.label,
            meta:
                hcu001Status.summary ||
                legalName ||
                'Admisión longitudinal del expediente.',
            tone:
                hcu001Status.status === 'complete'
                    ? 'success'
                    : hcu001Status.status === 'legacy_partial'
                      ? 'warning'
                      : hcu001Status.status === 'partial'
                        ? 'warning'
                        : 'neutral',
        },
        {
            title: 'Estado legal',
            value: readiness.label || 'Bloqueada',
            meta: pendingAiStatus || readiness.summary || 'Sin resumen legal',
            tone: statusTone,
        },
        {
            title: 'Red flags',
            value:
                redFlags.length > 0
                    ? `${redFlags.length} alerta(s)`
                    : 'Sin alerta',
            meta:
                redFlags.length > 0
                    ? redFlags.join(' • ')
                    : 'Sin criterios de alarma dermatologica activos.',
            tone: redFlags.length > 0 ? 'danger' : 'success',
        },
        {
            title: 'HCU-005',
            value: hcu005Status.label,
            meta: hcu005Status.summary,
            tone:
                hcu005Status.status === 'complete'
                    ? 'success'
                    : hcu005Status.status === 'partial'
                      ? 'warning'
                      : 'neutral',
        },
        {
            title: 'HCU-007',
            value: hcu007Status.label,
            meta: hcu007Status.summary,
            tone:
                hcu007Status.status === 'issued'
                    ? 'success'
                    : ['ready_to_issue', 'incomplete', 'draft'].includes(
                            hcu007Status.status
                        )
                      ? 'warning'
                      : 'neutral',
        },
        {
            title: 'HCU-010A',
            value: hcu010AStatus.label,
            meta: hcu010AStatus.summary,
            tone:
                hcu010AStatus.status === 'issued'
                    ? 'success'
                    : ['ready_to_issue', 'incomplete', 'draft'].includes(
                            hcu010AStatus.status
                        )
                      ? 'warning'
                      : 'neutral',
        },
        {
            title: 'HCU-012A',
            value: hcu012AStatus.label,
            meta: hcu012AStatus.summary,
            tone: ['issued', 'received'].includes(hcu012AStatus.status)
                ? 'success'
                : ['ready_to_issue', 'incomplete', 'draft'].includes(
                        hcu012AStatus.status
                    )
                  ? 'warning'
                  : 'neutral',
        },
        {
            title: 'HCU-024',
            value: hcu024Status.label,
            meta: hcu024Status.summary,
            tone:
                hcu024Status.status === 'accepted'
                    ? 'success'
                    : ['declined', 'revoked', 'incomplete'].includes(
                            hcu024Status.status
                        )
                      ? 'warning'
                      : 'neutral',
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
    const hcu001Status = hcu001StatusMeta(readiness.hcu001Status?.status);
    const hcu005Status = hcu005StatusMeta(readiness.hcu005Status?.status);
    const hcu007Status = hcu007StatusMeta(readiness.hcu007Status?.status);
    const hcu010AStatus = hcu010AStatusMeta(readiness.hcu010AStatus?.status);
    const hcu012AStatus = hcu012AStatusMeta(readiness.hcu012AStatus?.status);
    const hcu024Status = hcu024StatusMeta(readiness.hcu024Status?.status);
    const complianceMspStatus = complianceMspStatusMeta(readiness.complianceMspStatus?.status);
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
                <div class="clinical-history-mini-chip-row">
                    <span class="clinical-history-mini-chip" data-tone="${escapeHtml(
                        readiness.ready ? 'success' : 'warning'
                    )}">
                        ${escapeHtml(readiness.label || 'Bloqueada')}
                    </span>
                    <span class="clinical-history-mini-chip">
                        ${escapeHtml(hcu001Status.label)}
                    </span>
                    <span class="clinical-history-mini-chip">
                        ${escapeHtml(hcu005Status.label)}
                    </span>
                    <span class="clinical-history-mini-chip">
                        ${escapeHtml(hcu007Status.label)}
                    </span>
                    <span class="clinical-history-mini-chip">
                        ${escapeHtml(hcu010AStatus.label)}
                    </span>
                    <span class="clinical-history-mini-chip">
                        ${escapeHtml(hcu012AStatus.label)}
                    </span>
                    <span class="clinical-history-mini-chip">
                        ${escapeHtml(hcu024Status.label)}
                    </span>
                    ${complianceMspStatus.status === 'incomplete' ? `
                    <span class="clinical-history-mini-chip" data-tone="danger">
                        ${escapeHtml(complianceMspStatus.label)}
                    </span>` : ''}
                </div>
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
        ...formatClinicalRedFlags(item.redFlags),
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
                [
                    'consent_incomplete',
                    'consent_revoked',
                    'hcu024_consent_incomplete',
                    'hcu024_consent_revoked',
                    'hcu024_consent_declined',
                ].includes(normalizeString(reason?.code))
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
    return availableClinicalHistoryWorkspaces().map(
        ({ workspace, label, metaLabel }) => {
            const isActive = activeWorkspace === workspace;
            const workspaceMetaLabel =
                typeof metaLabel === 'function'
                    ? metaLabel(meta, getState())
                    : '';
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
        item.hcu001Label || '',
        item.hcu005Label || '',
        item.hcu007Label || '',
        item.hcu010ALabel || '',
        item.hcu012ALabel || '',
        item.hcu024Label || '',
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
    const redFlagLabels = formatClinicalRedFlags(item.redFlags);
    const summary = truncateText(
        item.legalReadinessSummary ||
            item.hcu001Summary ||
            item.hcu005Summary ||
            item.hcu007Summary ||
            item.hcu010ASummary ||
            item.hcu012ASummary ||
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
        item.highestOpenSeverity,
        item.redFlags?.length || 0
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
            ${buildClinicalRedFlagChipRow(redFlagLabels, 2)}
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

function buildDraftMetaText(slice, review, draft) {
    const admission = normalizeAdmission001(
        review.patientRecord?.admission001 || draft.admission001,
        review.session.patient,
        draft.intake
    );
    const hcu001Status = hcu001StatusMeta(
        evaluateHcu001(admission, {
            patient: review.session.patient,
            intake: draft.intake,
        }).status
    );
    const admissionKindLabel = formatAdmissionKindLabel(
        admission.admissionMeta.admissionKind
    );
    const hcu024Status = hcu024StatusMeta(
        normalizeLegalReadiness(review.legalReadiness).hcu024Status?.status
    );
    const hcu010AStatus = hcu010AStatusMeta(
        normalizeLegalReadiness(review.legalReadiness).hcu010AStatus?.status
    );
    const hcu012AStatus = hcu012AStatusMeta(
        normalizeLegalReadiness(review.legalReadiness).hcu012AStatus?.status
    );

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

    const marks = [
        draft.updatedAt
            ? `Ultima actualizacion ${readableTimestamp(draft.updatedAt)}`
            : '',
        hcu001Status.label,
        hcu007StatusMeta(
            normalizeLegalReadiness(review.legalReadiness).hcu007Status?.status
        ).label,
        hcu010AStatus.label,
        hcu012AStatus.label,
        hcu024Status.label,
        admissionKindLabel,
    ].filter(Boolean);

    return marks.join(' • ') || 'Sin cambios';
}

function buildDraftSummaryText(review, draft) {
    const readiness = normalizeLegalReadiness(review.legalReadiness);
    const admission = normalizeAdmission001(
        review.patientRecord?.admission001 || draft.admission001,
        review.session.patient,
        draft.intake
    );
    const hcu001Status = hcu001StatusMeta(readiness.hcu001Status?.status);
    const hcu005Status = hcu005StatusMeta(readiness.hcu005Status?.status);
    const hcu007Status = hcu007StatusMeta(readiness.hcu007Status?.status);
    const hcu010AStatus = hcu010AStatusMeta(readiness.hcu010AStatus?.status);
    const hcu012AStatus = hcu012AStatusMeta(readiness.hcu012AStatus?.status);
    const hcu024Status = hcu024StatusMeta(readiness.hcu024Status?.status);
    const documentLabel = [
        normalizeString(admission.identity.documentType),
        normalizeString(admission.identity.documentNumber),
    ]
        .filter(Boolean)
        .join(' ');

    return review.session.sessionId
        ? [
              `Editando ${currentSelectionLabel(review)}`,
              documentLabel,
              hcu001Status.label,
              hcu005Status.label,
              hcu007Status.label,
              hcu010AStatus.label,
              hcu012AStatus.label,
              hcu024Status.label,
              readiness.label || formatReviewStatus(draft.reviewStatus),
          ]
              .filter(Boolean)
              .join(' • ')
        : 'Selecciona un caso para regularizar admision HCU-001, nota viva y documentos.';
}

function buildFollowUpMetaText(review) {
    return review.session.sessionId
        ? `La pregunta saldra por el mismo hilo de ${currentSelectionLabel(
              review
          )}.`
        : 'Envia una pregunta puntual al paciente sin salir del review.';
}

function buildClinicalHeaderMetaText(review) {
    const admission = normalizeAdmission001(
        review.patientRecord?.admission001 || review.draft.admission001,
        review.session.patient,
        review.draft.intake
    );
    const selectedLabel = currentSelectionLabel(review);
    const documentLabel = [
        normalizeString(admission.identity.documentType),
        normalizeString(admission.identity.documentNumber),
    ]
        .filter(Boolean)
        .join(' ');
    const hcu001Status = hcu001StatusMeta(
        normalizeLegalReadiness(review.legalReadiness).hcu001Status?.status
    );
    const hcu024Status = hcu024StatusMeta(
        normalizeLegalReadiness(review.legalReadiness).hcu024Status?.status
    );
    const hcu007Status = hcu007StatusMeta(
        normalizeLegalReadiness(review.legalReadiness).hcu007Status?.status
    );
    const hcu010AStatus = hcu010AStatusMeta(
        normalizeLegalReadiness(review.legalReadiness).hcu010AStatus?.status
    );
    const hcu012AStatus = hcu012AStatusMeta(
        normalizeLegalReadiness(review.legalReadiness).hcu012AStatus?.status
    );
    const headerMeta = [
        review.session.caseId ? `Caso ${review.session.caseId}` : '',
        review.session.surface || '',
        review.session.appointmentId
            ? `Cita ${review.session.appointmentId}`
            : '',
        selectedLabel,
        documentLabel,
        admission.residence.phone ? `Tel. ${admission.residence.phone}` : '',
        formatAdmissionKindLabel(admission.admissionMeta.admissionKind),
        hcu001Status.label,
        hcu007Status.label,
        hcu010AStatus.label,
        hcu012AStatus.label,
        hcu024Status.label,
    ]
        .filter(Boolean)
        .join(' • ');

    return (
        headerMeta ||
        'Selecciona un caso para revisar la nota viva y la aptitud medico-legal.'
    );
}

function buildClinicalStatusMetaText(draft, pendingAiStatus, meta) {
    const admission = normalizeAdmission001(
        draft.admission001,
        {},
        draft.intake
    );
    const hcu001Status = hcu001StatusMeta(
        evaluateHcu001(admission, {
            intake: draft.intake,
        }).status
    );
    const hcu005Status = hcu005StatusMeta(
        evaluateHcu005(draft.clinicianDraft.hcu005).status
    );
    const hcu007Status = hcu007StatusMeta(
        normalizeLegalReadiness(currentReviewSource().legalReadiness)
            .hcu007Status?.status
    );
    const hcu010AStatus = hcu010AStatusMeta(
        normalizeLegalReadiness(currentReviewSource().legalReadiness)
            .hcu010AStatus?.status
    );
    const hcu012AStatus = hcu012AStatusMeta(
        normalizeLegalReadiness(currentReviewSource().legalReadiness)
            .hcu012AStatus?.status
    );
    const hcu024Status = hcu024StatusMeta(
        normalizeLegalReadiness(currentReviewSource().legalReadiness)
            .hcu024Status?.status
    );
    const statusMeta = [
        pendingAiStatus,
        hcu001Status.label,
        hcu005Status.label,
        hcu007Status.label,
        hcu010AStatus.label,
        hcu012AStatus.label,
        hcu024Status.label,
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

function buildAdmissionHistoryCards(admission) {
    const history = normalizeList(admission?.history?.admissionHistory);
    if (history.length === 0) {
        return buildEmptyClinicalCard(
            'Sin historial de admisiones',
            'La primera apertura del episodio creará la traza longitudinal en este expediente.'
        );
    }

    return history
        .map(
            (item) => `
                <article class="clinical-history-event-card">
                    <div class="clinical-history-event-head">
                        <span class="clinical-history-mini-chip">${escapeHtml(
                            formatAdmissionKindLabel(item.admissionKind) ||
                                'Admisión'
                        )}</span>
                        <span class="clinical-history-mini-chip">${escapeHtml(
                            readableTimestamp(
                                item.admissionDate || item.createdAt
                            ) || 'Sin fecha'
                        )}</span>
                    </div>
                    <p>${escapeHtml(
                        item.caseId || item.episodeId || 'Episodio longitudinal'
                    )}</p>
                    <small>${escapeHtml(
                        item.admittedBy || 'Sin responsable registrado'
                    )}</small>
                </article>
            `
        )
        .join('');
}

function buildAdmissionChangeLogCards(admission) {
    const changeLog = normalizeList(admission?.history?.changeLog);
    if (changeLog.length === 0) {
        return buildEmptyClinicalCard(
            'Sin cambios registrados',
            'Los cambios de identidad, cobertura o residencia quedarán auditados aquí.'
        );
    }

    return changeLog
        .map(
            (item) => `
                <article class="clinical-history-event-card">
                    <div class="clinical-history-event-head">
                        <span class="clinical-history-mini-chip">${escapeHtml(
                            item.actor || 'Staff clinico'
                        )}</span>
                        <span class="clinical-history-mini-chip">${escapeHtml(
                            readableTimestamp(item.changedAt) || 'Sin fecha'
                        )}</span>
                    </div>
                    <p>${escapeHtml(
                        item.summary ||
                            normalizeList(item.fields).join(', ') ||
                            'Cambio de admisión'
                    )}</p>
                    <small>${escapeHtml(
                        normalizeList(item.fields).join(', ') ||
                            item.actorRole ||
                            'Sin detalle adicional'
                    )}</small>
                </article>
            `
        )
        .join('');
}

function buildClinicalHistoryAdmissionSection(review, draft, disabled) {
    const admission = normalizeAdmission001(
        draft.admission001,
        review.session.patient,
        draft.intake
    );

    return buildClinicalHistorySection(
        'Admisión HCU-form.001/2008',
        'Datos de admisión FlowOS en espejo editable para el expediente longitudinal.',
        `
                ${buildClinicalHistoryInlineGrid([
                    selectField(
                        'admission_identity_document_type',
                        'Tipo de documento',
                        admission.identity.documentType,
                        CLINICAL_HISTORY_DOCUMENT_TYPE_CHOICES,
                        { disabled }
                    ),
                    inputField(
                        'admission_identity_document_number',
                        'Número de documento',
                        admission.identity.documentNumber,
                        {
                            placeholder: '0102030405',
                            disabled,
                        }
                    ),
                ])}
                ${buildClinicalHistoryInlineGrid([
                    inputField(
                        'admission_identity_last_name_1',
                        'Apellido paterno',
                        admission.identity.apellidoPaterno,
                        { disabled }
                    ),
                    inputField(
                        'admission_identity_last_name_2',
                        'Apellido materno',
                        admission.identity.apellidoMaterno,
                        { disabled }
                    ),
                    inputField(
                        'admission_identity_first_name',
                        'Primer nombre',
                        admission.identity.primerNombre,
                        { disabled }
                    ),
                    inputField(
                        'admission_identity_second_name',
                        'Segundo nombre',
                        admission.identity.segundoNombre,
                        { disabled }
                    ),
                ])}
                ${buildClinicalHistoryInlineGrid([
                    inputField(
                        'admission_demographics_birth_date',
                        'Fecha de nacimiento',
                        admission.demographics.birthDate,
                        {
                            type: 'date',
                            disabled,
                        }
                    ),
                    inputField(
                        'admission_demographics_age_years',
                        'Edad (años)',
                        admission.demographics.ageYears ?? '',
                        {
                            type: 'number',
                            min: '0',
                            step: '1',
                            disabled,
                        }
                    ),
                    selectField(
                        'admission_demographics_sex_at_birth',
                        'Sexo biológico',
                        admission.demographics.sexAtBirth,
                        CLINICAL_HISTORY_SEX_CHOICES,
                        { disabled }
                    ),
                ])}
                ${buildClinicalHistoryInlineGrid([
                    inputField(
                        'admission_demographics_marital_status',
                        'Estado civil',
                        admission.demographics.maritalStatus,
                        { disabled }
                    ),
                    inputField(
                        'admission_demographics_education_level',
                        'Instrucción',
                        admission.demographics.educationLevel,
                        { disabled }
                    ),
                    inputField(
                        'admission_demographics_occupation',
                        'Ocupación',
                        admission.demographics.occupation,
                        { disabled }
                    ),
                    inputField(
                        'admission_demographics_employer',
                        'Empresa',
                        admission.demographics.employer,
                        { disabled }
                    ),
                ])}
                ${buildClinicalHistoryInlineGrid([
                    inputField(
                        'admission_demographics_nationality_country',
                        'Nacionalidad',
                        admission.demographics.nationalityCountry,
                        { disabled }
                    ),
                    inputField(
                        'admission_demographics_cultural_group',
                        'Grupo cultural',
                        admission.demographics.culturalGroup,
                        { disabled }
                    ),
                    inputField(
                        'admission_demographics_birth_place',
                        'Lugar de nacimiento',
                        admission.demographics.birthPlace,
                        { disabled }
                    ),
                ])}
                ${buildClinicalHistoryInlineGrid([
                    inputField(
                        'admission_residence_address_line',
                        'Dirección',
                        admission.residence.addressLine,
                        { disabled }
                    ),
                    inputField(
                        'admission_residence_neighborhood',
                        'Barrio / sector',
                        admission.residence.neighborhood,
                        { disabled }
                    ),
                    selectField(
                        'admission_residence_zone_type',
                        'Zona',
                        admission.residence.zoneType,
                        CLINICAL_HISTORY_ZONE_TYPE_CHOICES,
                        { disabled }
                    ),
                ])}
                ${buildClinicalHistoryInlineGrid([
                    inputField(
                        'admission_residence_parish',
                        'Parroquia',
                        admission.residence.parish,
                        { disabled }
                    ),
                    inputField(
                        'admission_residence_canton',
                        'Cantón',
                        admission.residence.canton,
                        { disabled }
                    ),
                    inputField(
                        'admission_residence_province',
                        'Provincia',
                        admission.residence.province,
                        { disabled }
                    ),
                    inputField(
                        'admission_residence_phone',
                        'Teléfono',
                        admission.residence.phone,
                        { disabled }
                    ),
                ])}
                ${buildClinicalHistoryInlineGrid([
                    inputField(
                        'admission_coverage_health_insurance_type',
                        'Tipo de seguro',
                        admission.coverage.healthInsuranceType,
                        { disabled }
                    ),
                    inputField(
                        'admission_referral_referred_by',
                        'Referido por',
                        admission.referral.referredBy,
                        { disabled }
                    ),
                ])}
                ${buildClinicalHistoryInlineGrid([
                    inputField(
                        'admission_meta_admission_date',
                        'Fecha de admisión',
                        admission.admissionMeta.admissionDate,
                        {
                            placeholder: '2026-03-15T08:45:00-05:00',
                            disabled,
                        }
                    ),
                    selectField(
                        'admission_meta_admission_kind',
                        'Tipo de admisión',
                        admission.admissionMeta.admissionKind,
                        CLINICAL_HISTORY_ADMISSION_KIND_CHOICES,
                        { disabled }
                    ),
                    inputField(
                        'admission_meta_admitted_by',
                        'Admitido por',
                        admission.admissionMeta.admittedBy,
                        { disabled }
                    ),
                ])}
                ${buildClinicalHistoryInlineGrid([
                    inputField(
                        'admission_emergency_name',
                        'Contacto de emergencia',
                        admission.emergencyContact.name,
                        { disabled }
                    ),
                    inputField(
                        'admission_emergency_kinship',
                        'Parentesco',
                        admission.emergencyContact.kinship,
                        { disabled }
                    ),
                    inputField(
                        'admission_emergency_phone',
                        'Teléfono de emergencia',
                        admission.emergencyContact.phone,
                        { disabled }
                    ),
                ])}
                <div class="clinical-history-section-block">
                    <div class="clinical-history-event-head">
                        <strong>Historial de admisiones</strong>
                        <span class="clinical-history-mini-chip">${escapeHtml(
                            formatAdmissionKindLabel(
                                admission.admissionMeta.admissionKind
                            ) || 'Sin clasificación'
                        )}</span>
                    </div>
                    <div class="clinical-history-events">
                        ${buildAdmissionHistoryCards(admission)}
                    </div>
                </div>
                <div class="clinical-history-section-block">
                    <div class="clinical-history-event-head">
                        <strong>Registro de cambios</strong>
                        <span class="clinical-history-mini-chip">${escapeHtml(
                            normalizeString(
                                admission.admissionMeta.transitionMode
                            ) === 'new_required'
                                ? 'Nueva admisión'
                                : 'Regularización heredada'
                        )}</span>
                    </div>
                    <div class="clinical-history-events">
                        ${buildAdmissionChangeLogCards(admission)}
                    </div>
                </div>
            `
    );
}

function buildClinicalHistoryIntakeSection(draft, disabled, pregnancyValue) {
    return buildClinicalHistorySection(
        'Intake estructurado',
        'Motivo de consulta, evolucion y datos del paciente.',
        `
                ${buildClinicalRedFlagNotice(draft.redFlags)}
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
                        'intake_habitos',
                        'Habitos',
                        draft.intake.habitos,
                        {
                            rows: 4,
                            placeholder: 'Sol, tabaco, alcohol...',
                            disabled,
                        }
                    ),
                ])}
                ${buildClinicalHistoryInlineGrid([
                    inputField(
                        'intake_fototipo_fitzpatrick',
                        'Fototipo Fitzpatrick',
                        draft.intake.fototipoFitzpatrick,
                        {
                            placeholder: 'Ej. III, IV',
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

function buildPrescriptionItemEditor(item, index, disabled) {
    const safeItem = normalizePrescriptionItem(item);
    return `
        <article class="clinical-history-event-card" data-hcu005-prescription-item="${escapeHtml(
            String(index)
        )}">
            <div class="clinical-history-event-head">
                <span class="clinical-history-mini-chip">Prescripción ${escapeHtml(
                    String(index + 1)
                )}</span>
                <button
                    type="button"
                    class="clinical-history-mini-chip"
                    data-clinical-draft-action="remove-prescription-item"
                    data-prescription-index="${escapeHtml(String(index))}"
                    ${disabled ? 'disabled' : ''}
                >
                    Quitar
                </button>
            </div>
            ${buildClinicalHistoryInlineGrid([
                inputField(
                    `hcu005_prescription_${index}_medication`,
                    'Medicamento',
                    safeItem.medication,
                    {
                        placeholder: 'Nombre del medicamento',
                        disabled,
                    }
                ),
                inputField(
                    `hcu005_prescription_${index}_presentation`,
                    'Presentación',
                    safeItem.presentation,
                    {
                        placeholder: 'Tableta, crema, solución',
                        disabled,
                    }
                ),
            ])}
            ${buildClinicalHistoryInlineGrid([
                inputField(
                    `hcu005_prescription_${index}_dose`,
                    'Dosis',
                    safeItem.dose,
                    {
                        placeholder: '500 mg',
                        disabled,
                    }
                ),
                inputField(
                    `hcu005_prescription_${index}_route`,
                    'Vía',
                    safeItem.route,
                    {
                        placeholder: 'VO, tópica, IM',
                        disabled,
                    }
                ),
                inputField(
                    `hcu005_prescription_${index}_frequency`,
                    'Frecuencia',
                    safeItem.frequency,
                    {
                        placeholder: 'Cada 12 horas',
                        disabled,
                    }
                ),
            ])}
            ${buildClinicalHistoryInlineGrid([
                inputField(
                    `hcu005_prescription_${index}_duration`,
                    'Duración',
                    safeItem.duration,
                    {
                        placeholder: '7 días',
                        disabled,
                    }
                ),
                inputField(
                    `hcu005_prescription_${index}_quantity`,
                    'Cantidad',
                    safeItem.quantity,
                    {
                        placeholder: '14 tabletas',
                        disabled,
                    }
                ),
            ])}
            ${textareaField(
                `hcu005_prescription_${index}_instructions`,
                'Indicaciones',
                safeItem.instructions,
                {
                    rows: 3,
                    placeholder:
                        'Instrucciones detalladas para uso y seguimiento.',
                    disabled,
                }
            )}
        </article>
    `;
}

function buildClinicalHistoryHcu005Section(draft, disabled, reviewReasons) {
    const hcu005 = normalizeHcu005(draft.clinicianDraft.hcu005);
    const visibleItems =
        hcu005.prescriptionItems.length > 0
            ? hcu005.prescriptionItems
            : [emptyPrescriptionItem()];

    return buildClinicalHistorySection(
        'HCU-form.005/2008',
        'Paridad semántica trazable para evolución, impresión, plan e indicaciones del episodio.',
        `
                ${textareaField(
                    'hcu005_evolution_note',
                    'Evolución clínica',
                    hcu005.evolutionNote,
                    {
                        rows: 5,
                        placeholder:
                            'Describe la evolución clínica del episodio.',
                        disabled,
                    }
                )}
                ${buildClinicalHistoryInlineGrid([
                    textareaField(
                        'hcu005_diagnostic_impression',
                        'Impresión diagnóstica',
                        hcu005.diagnosticImpression,
                        {
                            rows: 4,
                            placeholder:
                                'Impresión diagnóstica clínicamente defendible.',
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
                ${buildClinicalHistoryInlineGrid([
                    textareaField(
                        'hcu005_therapeutic_plan',
                        'Plan terapéutico',
                        hcu005.therapeuticPlan,
                        {
                            rows: 4,
                            placeholder: 'Plan terapéutico del episodio.',
                            disabled,
                        }
                    ),
                    textareaField(
                        'hcu005_care_indications',
                        'Indicaciones / cuidados',
                        hcu005.careIndications,
                        {
                            rows: 4,
                            placeholder:
                                'Cuidados, advertencias y recomendaciones.',
                            disabled,
                        }
                    ),
                ])}
                ${textareaField(
                    'clinician_preguntas_faltantes',
                    'Preguntas faltantes',
                    listToTextarea(draft.clinicianDraft.preguntasFaltantes),
                    {
                        rows: 3,
                        placeholder: 'Una línea por pregunta pendiente.',
                        disabled,
                    }
                )}
                <div class="clinical-history-section-block">
                    <div class="clinical-history-event-head">
                        <strong>Prescripciones</strong>
                        <button
                            type="button"
                            class="clinical-history-mini-chip"
                            data-clinical-draft-action="add-prescription-item"
                            ${disabled ? 'disabled' : ''}
                        >
                            Agregar prescripción
                        </button>
                    </div>
                    <div class="clinical-history-events">
                        ${visibleItems
                            .map((item, index) =>
                                buildPrescriptionItemEditor(
                                    item,
                                    index,
                                    disabled
                                )
                            )
                            .join('')}
                    </div>
                </div>
                ${checkboxField(
                    'requires_human_review',
                    'Requiere revisión humana',
                    draft.requiresHumanReview === true,
                    {
                        hint:
                            reviewReasons ||
                            'Toda aprobación final sigue siendo un acto clínico humano.',
                        disabled,
                    }
                )}
            `
    );
}

function buildInterconsultationChip(
    interconsultation,
    activeInterconsultationId,
    disabled
) {
    const normalized = normalizeInterconsultation(interconsultation);
    const status = hcu007StatusMeta(
        evaluateInterconsultation(normalized).status
    );
    const isActive =
        normalizeString(normalized.interconsultId) ===
        normalizeString(activeInterconsultationId);

    return `
        <button
            type="button"
            class="clinical-history-workspace-tab${isActive ? ' is-active' : ''}"
            data-clinical-review-action="select-interconsultation"
            data-interconsult-id="${escapeHtml(normalized.interconsultId)}"
            ${disabled ? 'disabled' : ''}
        >
            <strong>${escapeHtml(
                normalized.destinationService ||
                    normalized.requestReason ||
                    'Interconsulta'
            )}</strong>
            <small>${escapeHtml(status.label)}</small>
        </button>
    `;
}

function buildClinicalHistoryInterconsultSection(review, draft, disabled) {
    const interconsultations = normalizeInterconsultations(
        draft.interconsultations
    );
    const activeInterconsultationId = normalizeString(
        draft.activeInterconsultationId
    );
    const activeInterconsultation =
        interconsultations.find(
            (item) =>
                normalizeString(item.interconsultId) ===
                activeInterconsultationId
        ) || null;
    const hydratedInterconsultation = activeInterconsultation
        ? deriveInterconsultationContext(
              activeInterconsultation,
              draft,
              review.session.patient
          )
        : null;
    const activeStatus = hcu007StatusMeta(
        hydratedInterconsultation
            ? evaluateInterconsultation(hydratedInterconsultation).status
            : 'not_applicable'
    );
    const activeReport = hydratedInterconsultation
        ? normalizeInterconsultReport(hydratedInterconsultation.report, {
              consultantProfessionalName:
                  hydratedInterconsultation.consultedProfessionalName,
              respondingEstablishment:
                  hydratedInterconsultation.destinationEstablishment,
              respondingService: hydratedInterconsultation.destinationService,
          })
        : emptyInterconsultReport();
    const activeReportStatus = hcu007ReportStatusMeta(
        hydratedInterconsultation
            ? evaluateInterconsultReport(activeReport).status
            : 'not_received'
    );
    const interconsultForms = normalizeInterconsultFormSnapshots(
        draft.documents.interconsultForms
    );
    const interconsultReports = normalizeInterconsultReportSnapshots(
        draft.documents.interconsultReports
    );
    const supportAttachments = normalizeAttachmentList(draft.intake.adjuntos);
    const selectedAttachmentIds = new Set(
        normalizeAttachmentList(activeReport.attachments).map((attachment) =>
            String(attachment.id || '')
        )
    );
    const attachmentSelector =
        supportAttachments.length > 0
            ? supportAttachments
                  .map((attachment) => {
                      const attachmentId = String(attachment.id || '');
                      const checked =
                          attachmentId &&
                          selectedAttachmentIds.has(attachmentId);
                      const meta = [
                          normalizeString(attachment.kind) || 'archivo',
                          normalizeString(attachment.mime),
                          attachment.size > 0
                              ? formatBytes(attachment.size)
                              : '',
                      ]
                          .filter(Boolean)
                          .join(' • ');
                      return `
                            <label class="clinical-history-inline-checkbox">
                                <input
                                    type="checkbox"
                                    name="interconsult_report_attachment_ids"
                                    value="${escapeHtml(attachmentId)}"
                                    ${checked ? 'checked' : ''}
                                    ${disabled ? 'disabled' : ''}
                                />
                                <span>
                                    <strong>${escapeHtml(
                                        attachment.originalName ||
                                            `Adjunto ${attachmentId}`
                                    )}</strong>
                                    <small>${escapeHtml(meta || 'Soporte clínico')}</small>
                                </span>
                            </label>
                        `;
                  })
                  .join('')
            : buildEmptyClinicalCard(
                  'Sin adjuntos clínicos disponibles',
                  'Cuando el caso tenga adjuntos de clinical_uploads podrás seleccionarlos como respaldo del informe.'
              );
    const diagnoses = hydratedInterconsultation
        ? normalizeInterconsultationDiagnoses(
              hydratedInterconsultation.diagnoses
          )
        : normalizeInterconsultationDiagnoses([]);
    const preDiagnosis =
        diagnoses.find((item) => item.type === 'pre') ||
        emptyInterconsultationDiagnosis('pre');
    const defDiagnosis =
        diagnoses.find((item) => item.type === 'def') ||
        emptyInterconsultationDiagnosis('def');

    return buildClinicalHistorySection(
        'Interconsulta HCU-form.007/2008',
        'Documento formal de interconsulta emitida con captura estructurada del informe del consultado y adjunto opcional.',
        `
                <input
                    type="hidden"
                    id="interconsult_active_id"
                    name="interconsult_active_id"
                    value="${escapeHtml(activeInterconsultationId)}"
                />
                <div class="clinical-history-summary-grid">
                    ${summaryStatCard(
                        'HCU-007',
                        activeStatus.label,
                        activeStatus.summary,
                        ['issued', 'received'].includes(activeStatus.status)
                            ? 'success'
                            : [
                                    'ready_to_issue',
                                    'incomplete',
                                    'draft',
                                ].includes(activeStatus.status)
                              ? 'warning'
                              : 'neutral'
                    )}
                    ${summaryStatCard(
                        'Informe del consultado',
                        activeReportStatus.label,
                        activeReportStatus.summary,
                        activeReportStatus.status === 'received'
                            ? 'success'
                            : ['ready_to_receive', 'draft'].includes(
                                    activeReportStatus.status
                                )
                              ? 'warning'
                              : 'neutral'
                    )}
                    ${summaryStatCard(
                        'Paciente / HCU',
                        hydratedInterconsultation?.patientName ||
                            buildAdmissionLegalName(
                                draft.admission001,
                                review.session.patient
                            ) ||
                            'Sin paciente',
                        [
                            hydratedInterconsultation?.patientDocumentNumber,
                            hydratedInterconsultation?.patientRecordId,
                        ]
                            .filter(Boolean)
                            .join(' • ') || 'Sin documento',
                        'neutral'
                    )}
                    ${summaryStatCard(
                        'Solicitante',
                        hydratedInterconsultation?.requestingService ||
                            resolveClinicProfileDisplay().serviceLabel,
                        hydratedInterconsultation?.requestingEstablishment ||
                            resolveClinicProfileDisplay().establishmentLabel,
                        'neutral'
                    )}
                    ${summaryStatCard(
                        'Snapshots',
                        String(
                            interconsultForms.length +
                                interconsultReports.length
                        ),
                        interconsultReports.length > 0
                            ? 'Hay snapshots emitidos/cancelados y al menos un informe recibido.'
                            : interconsultForms.length > 0
                              ? 'Snapshots documentales HCU-007 emitidos o cancelados.'
                              : 'Todavía no hay snapshots HCU-007 emitidos.',
                        interconsultForms.length + interconsultReports.length >
                            0
                            ? 'success'
                            : 'neutral'
                    )}
                </div>
                <div class="toolbar-row clinical-history-actions-row">
                    <button
                        type="button"
                        data-clinical-review-action="create-interconsultation"
                        ${disabled ? 'disabled' : ''}
                    >
                        Nueva interconsulta
                    </button>
                    <button
                        type="button"
                        data-clinical-review-action="issue-current-interconsultation"
                        ${disabled || !hydratedInterconsultation ? 'disabled' : ''}
                    >
                        Emitir interconsulta
                    </button>
                    <button
                        type="button"
                        data-clinical-review-action="cancel-current-interconsultation"
                        ${disabled || !hydratedInterconsultation ? 'disabled' : ''}
                    >
                        Cancelar interconsulta
                    </button>
                    <button
                        type="button"
                        data-clinical-review-action="receive-current-interconsult-report"
                        ${disabled || !hydratedInterconsultation ? 'disabled' : ''}
                    >
                        Recibir informe
                    </button>
                </div>
                <div class="toolbar-row clinical-history-actions-row">
                    ${interconsultations
                        .map((item) =>
                            buildInterconsultationChip(
                                item,
                                activeInterconsultationId,
                                disabled
                            )
                        )
                        .join('')}
                </div>
                ${
                    !hydratedInterconsultation
                        ? buildEmptyClinicalCard(
                              'Sin interconsulta activa',
                              'Crea una interconsulta del episodio para empezar el HCU-007.'
                          )
                        : `
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'interconsult_requested_at',
                                    'Fecha/hora',
                                    hydratedInterconsultation.requestedAt,
                                    { disabled }
                                ),
                                inputField(
                                    'interconsult_priority',
                                    'Prioridad',
                                    hydratedInterconsultation.priority,
                                    { disabled }
                                ),
                                inputField(
                                    'interconsult_issued_by',
                                    'Profesional solicitante',
                                    hydratedInterconsultation.issuedBy,
                                    { disabled }
                                ),
                            ])}
                            ${checkboxField(
                                'interconsult_required_for_current_plan',
                                'La interconsulta es parte del plan actual',
                                hydratedInterconsultation.requiredForCurrentPlan ===
                                    true,
                                {
                                    hint: 'Si está marcada, la aprobación final exige emitirla o cancelarla.',
                                    disabled,
                                }
                            )}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'interconsult_patient_name',
                                    'Paciente',
                                    hydratedInterconsultation.patientName,
                                    { disabled: true }
                                ),
                                inputField(
                                    'interconsult_patient_record',
                                    'Documento / HCU',
                                    [
                                        hydratedInterconsultation.patientDocumentNumber,
                                        hydratedInterconsultation.patientRecordId,
                                    ]
                                        .filter(Boolean)
                                        .join(' '),
                                    { disabled: true }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'interconsult_requesting_establishment',
                                    'Establecimiento solicitante',
                                    hydratedInterconsultation.requestingEstablishment,
                                    { disabled: true }
                                ),
                                inputField(
                                    'interconsult_requesting_service',
                                    'Servicio solicitante',
                                    hydratedInterconsultation.requestingService,
                                    { disabled: true }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'interconsult_destination_establishment',
                                    'Establecimiento destino',
                                    hydratedInterconsultation.destinationEstablishment,
                                    { disabled }
                                ),
                                inputField(
                                    'interconsult_destination_service',
                                    'Servicio destino',
                                    hydratedInterconsultation.destinationService,
                                    { disabled }
                                ),
                                inputField(
                                    'interconsult_consulted_professional_name',
                                    'Profesional consultado',
                                    hydratedInterconsultation.consultedProfessionalName,
                                    { disabled }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                textareaField(
                                    'interconsult_request_reason',
                                    'Motivo de interconsulta',
                                    hydratedInterconsultation.requestReason,
                                    { rows: 4, disabled }
                                ),
                                textareaField(
                                    'interconsult_question_for_consultant',
                                    'Pregunta para el consultado',
                                    hydratedInterconsultation.questionForConsultant,
                                    { rows: 4, disabled }
                                ),
                            ])}
                            ${textareaField(
                                'interconsult_clinical_picture',
                                'Cuadro clínico actual',
                                hydratedInterconsultation.clinicalPicture,
                                {
                                    rows: 5,
                                    placeholder:
                                        'Resumen clínico actual del episodio que justifica la interconsulta.',
                                    disabled,
                                }
                            )}
                            ${buildClinicalHistoryInlineGrid([
                                textareaField(
                                    'interconsult_performed_diagnostics_summary',
                                    'Exámenes y procedimientos diagnósticos relevantes',
                                    hydratedInterconsultation.performedDiagnosticsSummary,
                                    { rows: 4, disabled }
                                ),
                                textareaField(
                                    'interconsult_therapeutic_measures_done',
                                    'Medidas terapéuticas y educativas realizadas',
                                    hydratedInterconsultation.therapeuticMeasuresDone,
                                    { rows: 4, disabled }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'interconsult_diagnosis_pre_label',
                                    'Diagnóstico PRE',
                                    preDiagnosis.label,
                                    { disabled }
                                ),
                                inputField(
                                    'interconsult_diagnosis_pre_cie10',
                                    'CIE-10 PRE',
                                    preDiagnosis.cie10,
                                    { disabled }
                                ),
                                inputField(
                                    'interconsult_diagnosis_def_label',
                                    'Diagnóstico DEF',
                                    defDiagnosis.label,
                                    { disabled }
                                ),
                                inputField(
                                    'interconsult_diagnosis_def_cie10',
                                    'CIE-10 DEF',
                                    defDiagnosis.cie10,
                                    { disabled }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'interconsult_issued_at',
                                    'Emitida el',
                                    hydratedInterconsultation.issuedAt,
                                    { disabled: true }
                                ),
                                inputField(
                                    'interconsult_cancelled_at',
                                    'Cancelada el',
                                    hydratedInterconsultation.cancelledAt,
                                    { disabled: true }
                                ),
                                inputField(
                                    'interconsult_cancel_reason',
                                    'Razón de cancelación',
                                    hydratedInterconsultation.cancelReason,
                                    { disabled }
                                ),
                            ])}
                            <div class="clinical-history-section-block">
                                <div class="clinical-history-event-head">
                                    <strong>Informe del consultado</strong>
                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                        activeReportStatus.label
                                    )}</span>
                                </div>
                                ${
                                    activeReportStatus.status === 'received'
                                        ? `
                                            <div class="clinical-history-banner clinical-history-banner-success">
                                                Informe recibido: reconciliar manualmente en HCU-005/HCU-024 si aplica.
                                            </div>
                                        `
                                        : ''
                                }
                                ${buildClinicalHistoryInlineGrid([
                                    inputField(
                                        'interconsult_report_reported_at',
                                        'Fecha/hora del informe',
                                        activeReport.reportedAt,
                                        { disabled }
                                    ),
                                    inputField(
                                        'interconsult_report_reported_by',
                                        'Reportado por',
                                        activeReport.reportedBy,
                                        { disabled }
                                    ),
                                    inputField(
                                        'interconsult_report_received_by',
                                        'Recibido por',
                                        activeReport.receivedBy,
                                        { disabled: true }
                                    ),
                                ])}
                                ${buildClinicalHistoryInlineGrid([
                                    inputField(
                                        'interconsult_report_responding_establishment',
                                        'Establecimiento respondiente',
                                        activeReport.respondingEstablishment,
                                        { disabled }
                                    ),
                                    inputField(
                                        'interconsult_report_responding_service',
                                        'Servicio respondiente',
                                        activeReport.respondingService,
                                        { disabled }
                                    ),
                                ])}
                                ${buildClinicalHistoryInlineGrid([
                                    inputField(
                                        'interconsult_report_consultant_professional_name',
                                        'Profesional consultado',
                                        activeReport.consultantProfessionalName,
                                        { disabled }
                                    ),
                                    inputField(
                                        'interconsult_report_consultant_professional_role',
                                        'Rol profesional',
                                        activeReport.consultantProfessionalRole,
                                        { disabled }
                                    ),
                                ])}
                                ${textareaField(
                                    'interconsult_report_summary',
                                    'Resumen del informe',
                                    activeReport.reportSummary,
                                    {
                                        rows: 3,
                                        disabled,
                                    }
                                )}
                                ${buildClinicalHistoryInlineGrid([
                                    textareaField(
                                        'interconsult_report_clinical_findings',
                                        'Hallazgos clínicos',
                                        activeReport.clinicalFindings,
                                        {
                                            rows: 4,
                                            disabled,
                                        }
                                    ),
                                    textareaField(
                                        'interconsult_report_diagnostic_opinion',
                                        'Criterio / impresión del consultado',
                                        activeReport.diagnosticOpinion,
                                        {
                                            rows: 4,
                                            disabled,
                                        }
                                    ),
                                ])}
                                ${buildClinicalHistoryInlineGrid([
                                    textareaField(
                                        'interconsult_report_recommendations',
                                        'Recomendaciones',
                                        activeReport.recommendations,
                                        {
                                            rows: 4,
                                            disabled,
                                        }
                                    ),
                                    textareaField(
                                        'interconsult_report_follow_up_indications',
                                        'Conducta sugerida / seguimiento',
                                        activeReport.followUpIndications,
                                        {
                                            rows: 4,
                                            disabled,
                                        }
                                    ),
                                ])}
                                ${buildClinicalHistoryInlineGrid([
                                    inputField(
                                        'interconsult_report_source_document_type',
                                        'Tipo de documento fuente',
                                        activeReport.sourceDocumentType,
                                        { disabled }
                                    ),
                                    inputField(
                                        'interconsult_report_source_reference',
                                        'Referencia / folio',
                                        activeReport.sourceReference,
                                        { disabled }
                                    ),
                                ])}
                                <div class="clinical-history-section-block">
                                    <div class="clinical-history-event-head">
                                        <strong>Adjunto opcional de respaldo</strong>
                                        <small>Reutiliza adjuntos ya cargados por clinical_uploads.</small>
                                    </div>
                                    <div class="clinical-history-inline-checkbox-list">
                                        ${attachmentSelector}
                                    </div>
                                </div>
                            </div>
                        `
                }
            `
    );
}

function buildConsentPacketChip(packet, activePacketId, disabled) {
    const normalized = normalizeConsentPacket(packet);
    const status = hcu024StatusMeta(evaluateConsentPacket(normalized).status);
    const isActive =
        normalizeString(normalized.packetId) ===
        normalizeString(activePacketId);

    return `
        <button
            type="button"
            class="clinical-history-workspace-tab${isActive ? ' is-active' : ''}"
            data-clinical-draft-action="select-consent-packet-local"
            data-packet-id="${escapeHtml(normalized.packetId)}"
            ${disabled ? 'disabled' : ''}
        >
            <strong>${escapeHtml(
                normalized.procedureLabel || 'Consentimiento'
            )}</strong>
            <small>${escapeHtml(status.label)}</small>
        </button>
    `;
}

function buildLabOrderChip(labOrder, activeLabOrderId, disabled) {
    const normalized = normalizeLabOrder(labOrder);
    const status = hcu010AStatusMeta(evaluateLabOrder(normalized).status);
    const isActive =
        normalizeString(normalized.labOrderId) ===
        normalizeString(activeLabOrderId);

    return `
        <button
            type="button"
            class="clinical-history-workspace-tab${isActive ? ' is-active' : ''}"
            data-clinical-review-action="select-lab-order"
            data-lab-order-id="${escapeHtml(normalized.labOrderId)}"
            ${disabled ? 'disabled' : ''}
        >
            <strong>${escapeHtml(
                normalized.sampleDate ||
                    normalized.requestedAt ||
                    'Orden laboratorio'
            )}</strong>
            <small>${escapeHtml(status.label)}</small>
        </button>
    `;
}

function buildImagingOrderChip(imagingOrder, activeImagingOrderId, disabled) {
    const normalized = normalizeImagingOrder(imagingOrder);
    const status = hcu012AStatusMeta(evaluateImagingOrder(normalized).status);
    const isActive =
        normalizeString(normalized.imagingOrderId) ===
        normalizeString(activeImagingOrderId);

    return `
        <button
            type="button"
            class="clinical-history-workspace-tab${isActive ? ' is-active' : ''}"
            data-clinical-review-action="select-imaging-order"
            data-imaging-order-id="${escapeHtml(normalized.imagingOrderId)}"
            ${disabled ? 'disabled' : ''}
        >
            <strong>${escapeHtml(
                normalized.studyDate ||
                    normalized.requestedAt ||
                    'Orden imagenologia'
            )}</strong>
            <small>${escapeHtml(status.label)}</small>
        </button>
    `;
}

function buildLabOrderStudyChecklist(
    groupKey,
    label,
    selectedValues,
    disabled
) {
    const options = normalizeList(CLINICAL_HISTORY_LAB_STUDY_OPTIONS[groupKey]);
    const selected = new Set(normalizeStringList(selectedValues));

    return `
        <div class="clinical-history-section-block">
            <div class="clinical-history-event-head">
                <strong>${escapeHtml(label)}</strong>
                <span class="clinical-history-mini-chip">${escapeHtml(
                    String(selected.size)
                )}</span>
            </div>
            <div class="clinical-history-events">
                ${options
                    .map(
                        (option, index) => `
                            <label class="clinical-history-inline-checkbox">
                                <input
                                    type="checkbox"
                                    id="lab_order_study_${escapeHtml(
                                        groupKey
                                    )}_${index}"
                                    name="lab_order_study_${escapeHtml(
                                        groupKey
                                    )}"
                                    value="${escapeHtml(option)}"
                                    ${
                                        selected.has(normalizeString(option))
                                            ? 'checked'
                                            : ''
                                    }
                                    ${disabled ? 'disabled' : ''}
                                />
                                <span>${escapeHtml(option)}</span>
                            </label>
                        `
                    )
                    .join('')}
            </div>
        </div>
    `;
}

function buildImagingStudyGroupField(groupKey, label, value, hint, disabled) {
    return textareaField(
        `imaging_order_studies_${groupKey}`,
        label,
        formatTextareaList(value),
        {
            rows: 3,
            hint,
            placeholder: 'Una linea por estudio',
            disabled,
        }
    );
}

function buildClinicalHistoryLabOrderSection(review, draft, disabled) {
    const labOrders = normalizeLabOrders(draft.labOrders);
    const activeLabOrderId = normalizeString(draft.activeLabOrderId);
    const activeLabOrder =
        labOrders.find(
            (item) => normalizeString(item.labOrderId) === activeLabOrderId
        ) || null;
    const hydratedLabOrder = activeLabOrder
        ? deriveLabOrderContext(activeLabOrder, draft, review.session.patient)
        : null;
    const evaluation = hydratedLabOrder
        ? evaluateLabOrder(hydratedLabOrder)
        : { status: 'not_applicable', selectedStudiesCount: 0 };
    const activeStatus = hcu010AStatusMeta(evaluation.status);
    const labOrderSnapshots = normalizeLabOrderSnapshots(
        draft.documents.labOrders
    );
    const diagnoses = hydratedLabOrder
        ? normalizeInterconsultationDiagnoses(hydratedLabOrder.diagnoses)
        : normalizeInterconsultationDiagnoses([]);
    const preDiagnosis =
        diagnoses.find((item) => item.type === 'pre') ||
        emptyInterconsultationDiagnosis('pre');
    const defDiagnosis =
        diagnoses.find((item) => item.type === 'def') ||
        emptyInterconsultationDiagnosis('def');
    const studySelections = hydratedLabOrder
        ? normalizeLabOrderStudySelections(hydratedLabOrder.studySelections)
        : normalizeLabOrderStudySelections({});
    const selectedStudies = flattenLabOrderStudySelections(studySelections);

    return buildClinicalHistorySection(
        'Laboratorio HCU-form.010A/2008',
        'Solicitud formal de laboratorio clinico trazable al formulario MSP, con emision y cancelacion documentadas por episodio.',
        `
                <input
                    type="hidden"
                    id="lab_order_active_id"
                    name="lab_order_active_id"
                    value="${escapeHtml(activeLabOrderId)}"
                />
                <div class="clinical-history-summary-grid">
                    ${summaryStatCard(
                        'HCU-010A',
                        activeStatus.label,
                        activeStatus.summary,
                        activeStatus.status === 'issued'
                            ? 'success'
                            : [
                                    'ready_to_issue',
                                    'incomplete',
                                    'draft',
                                ].includes(activeStatus.status)
                              ? 'warning'
                              : 'neutral'
                    )}
                    ${summaryStatCard(
                        'Paciente / HCU',
                        hydratedLabOrder?.patientName ||
                            buildAdmissionLegalName(
                                draft.admission001,
                                review.session.patient
                            ) ||
                            'Sin paciente',
                        [
                            hydratedLabOrder?.patientDocumentNumber,
                            hydratedLabOrder?.patientRecordId,
                        ]
                            .filter(Boolean)
                            .join(' • ') || 'Sin documento',
                        'neutral'
                    )}
                    ${summaryStatCard(
                        'Solicitante',
                        hydratedLabOrder?.requestingService ||
                            resolveClinicProfileDisplay().serviceLabel,
                        hydratedLabOrder?.requestingEstablishment ||
                            resolveClinicProfileDisplay().establishmentLabel,
                        'neutral'
                    )}
                    ${summaryStatCard(
                        'Estudios',
                        String(selectedStudies.length),
                        selectedStudies.length > 0
                            ? selectedStudies.slice(0, 3).join(' • ')
                            : 'Sin estudios seleccionados',
                        selectedStudies.length > 0 ? 'success' : 'neutral'
                    )}
                    ${summaryStatCard(
                        'Snapshots',
                        String(labOrderSnapshots.length),
                        labOrderSnapshots.length > 0
                            ? 'Snapshots emitidos o cancelados del HCU-010A.'
                            : 'Todavia no hay snapshots HCU-010A emitidos.',
                        labOrderSnapshots.length > 0 ? 'success' : 'neutral'
                    )}
                </div>
                <div class="toolbar-row clinical-history-actions-row">
                    <button
                        type="button"
                        data-clinical-review-action="create-lab-order"
                        ${disabled ? 'disabled' : ''}
                    >
                        Nueva solicitud de laboratorio
                    </button>
                    <button
                        type="button"
                        data-clinical-review-action="issue-current-lab-order"
                        ${disabled || !hydratedLabOrder ? 'disabled' : ''}
                    >
                        Emitir solicitud
                    </button>
                    <button
                        type="button"
                        data-clinical-review-action="cancel-current-lab-order"
                        ${disabled || !hydratedLabOrder ? 'disabled' : ''}
                    >
                        Cancelar solicitud
                    </button>
                </div>
                <div class="toolbar-row clinical-history-actions-row">
                    ${labOrders
                        .map((item) =>
                            buildLabOrderChip(item, activeLabOrderId, disabled)
                        )
                        .join('')}
                </div>
                ${
                    !hydratedLabOrder
                        ? buildEmptyClinicalCard(
                              'Sin solicitud activa',
                              'Crea una solicitud de laboratorio del episodio para empezar el HCU-010A.'
                          )
                        : `
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'lab_order_requested_at',
                                    'Fecha/hora de solicitud',
                                    hydratedLabOrder.requestedAt,
                                    { disabled }
                                ),
                                inputField(
                                    'lab_order_sample_date',
                                    'Fecha de toma',
                                    hydratedLabOrder.sampleDate,
                                    { disabled }
                                ),
                                selectField(
                                    'lab_order_priority',
                                    'Prioridad',
                                    hydratedLabOrder.priority,
                                    CLINICAL_HISTORY_LAB_ORDER_PRIORITY_CHOICES,
                                    { disabled }
                                ),
                                inputField(
                                    'lab_order_requested_by',
                                    'Profesional solicitante',
                                    hydratedLabOrder.requestedBy,
                                    { disabled }
                                ),
                            ])}
                            ${checkboxField(
                                'lab_order_required_for_current_plan',
                                'La solicitud de laboratorio es parte del plan actual',
                                hydratedLabOrder.requiredForCurrentPlan ===
                                    true,
                                {
                                    hint: 'Si esta marcada, la aprobacion final exige emitirla o cancelarla.',
                                    disabled,
                                }
                            )}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'lab_order_patient_name',
                                    'Paciente',
                                    hydratedLabOrder.patientName,
                                    { disabled: true }
                                ),
                                inputField(
                                    'lab_order_patient_record',
                                    'Documento / HCU',
                                    [
                                        hydratedLabOrder.patientDocumentNumber,
                                        hydratedLabOrder.patientRecordId,
                                    ]
                                        .filter(Boolean)
                                        .join(' '),
                                    { disabled: true }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'lab_order_requesting_establishment',
                                    'Establecimiento solicitante',
                                    hydratedLabOrder.requestingEstablishment,
                                    { disabled: true }
                                ),
                                inputField(
                                    'lab_order_requesting_service',
                                    'Servicio solicitante',
                                    hydratedLabOrder.requestingService,
                                    { disabled: true }
                                ),
                                inputField(
                                    'lab_order_care_site',
                                    'Sala / sitio',
                                    hydratedLabOrder.careSite,
                                    { disabled }
                                ),
                                inputField(
                                    'lab_order_bed_label',
                                    'Cama / referencia',
                                    hydratedLabOrder.bedLabel,
                                    { disabled }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'lab_order_diagnosis_pre_label',
                                    'Diagnostico PRE',
                                    preDiagnosis.label,
                                    { disabled }
                                ),
                                inputField(
                                    'lab_order_diagnosis_pre_cie10',
                                    'CIE-10 PRE',
                                    preDiagnosis.cie10,
                                    { disabled }
                                ),
                                inputField(
                                    'lab_order_diagnosis_def_label',
                                    'Diagnostico DEF',
                                    defDiagnosis.label,
                                    { disabled }
                                ),
                                inputField(
                                    'lab_order_diagnosis_def_cie10',
                                    'CIE-10 DEF',
                                    defDiagnosis.cie10,
                                    { disabled }
                                ),
                            ])}
                            ${buildLabOrderStudyChecklist(
                                'hematology',
                                'Hematologia',
                                studySelections.hematology,
                                disabled
                            )}
                            ${buildLabOrderStudyChecklist(
                                'urinalysis',
                                'Uroanalisis',
                                studySelections.urinalysis,
                                disabled
                            )}
                            ${buildLabOrderStudyChecklist(
                                'coprological',
                                'Coprologico',
                                studySelections.coprological,
                                disabled
                            )}
                            ${buildLabOrderStudyChecklist(
                                'bloodChemistry',
                                'Quimica sanguinea',
                                studySelections.bloodChemistry,
                                disabled
                            )}
                            ${buildLabOrderStudyChecklist(
                                'serology',
                                'Serologia',
                                studySelections.serology,
                                disabled
                            )}
                            ${buildLabOrderStudyChecklist(
                                'bacteriology',
                                'Bacteriologia',
                                studySelections.bacteriology,
                                disabled
                            )}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'lab_order_bacteriology_sample_source',
                                    'Muestra de',
                                    hydratedLabOrder.bacteriologySampleSource,
                                    { disabled }
                                ),
                                inputField(
                                    'lab_order_study_others',
                                    'Otros examenes',
                                    studySelections.others,
                                    { disabled }
                                ),
                            ])}
                            ${checkboxField(
                                'lab_order_physician_present',
                                'El medico estara presente en el examen',
                                hydratedLabOrder.physicianPresentAtExam ===
                                    true,
                                {
                                    hint: 'Campo opcional del formulario cuando aplica.',
                                    disabled,
                                }
                            )}
                            ${textareaField(
                                'lab_order_notes',
                                'Observaciones',
                                hydratedLabOrder.notes,
                                {
                                    rows: 3,
                                    placeholder:
                                        'Condiciones de toma, observaciones o instrucciones clinicas complementarias.',
                                    disabled,
                                }
                            )}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'lab_order_issued_at',
                                    'Emitida el',
                                    hydratedLabOrder.issuedAt,
                                    { disabled: true }
                                ),
                                inputField(
                                    'lab_order_cancelled_at',
                                    'Cancelada el',
                                    hydratedLabOrder.cancelledAt,
                                    { disabled: true }
                                ),
                                inputField(
                                    'lab_order_cancel_reason',
                                    'Razon de cancelacion',
                                    hydratedLabOrder.cancelReason,
                                    { disabled }
                                ),
                            ])}
                            <div class="clinical-history-section-block">
                                <div class="clinical-history-event-head">
                                    <strong>Snapshots documentales HCU-010A</strong>
                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                        String(labOrderSnapshots.length)
                                    )}</span>
                                </div>
                                <div class="clinical-history-events">
                                    ${
                                        labOrderSnapshots.length === 0
                                            ? buildEmptyClinicalCard(
                                                  'Sin snapshots emitidos',
                                                  'Las solicitudes emitidas o canceladas quedaran congeladas aqui.'
                                              )
                                            : labOrderSnapshots
                                                  .map(
                                                      (snapshot) => `
                                                            <article class="clinical-history-event-card" data-tone="neutral">
                                                                <div class="clinical-history-event-head">
                                                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                                                        hcu010AStatusMeta(
                                                                            snapshot.status
                                                                        ).label
                                                                    )}</span>
                                                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                                                        readableTimestamp(
                                                                            snapshot.finalizedAt ||
                                                                                snapshot.snapshotAt
                                                                        )
                                                                    )}</span>
                                                                </div>
                                                                <p>${escapeHtml(
                                                                    flattenLabOrderStudySelections(
                                                                        snapshot.studySelections
                                                                    ).join(
                                                                        ' • '
                                                                    ) ||
                                                                        'Sin estudios visibles'
                                                                )}</p>
                                                            </article>
                                                        `
                                                  )
                                                  .join('')
                                    }
                                </div>
                            </div>
                        `
                }
            `
    );
}

function buildClinicalHistoryImagingOrderSection(review, draft, disabled) {
    const imagingOrders = normalizeImagingOrders(draft.imagingOrders);
    const activeImagingOrderId = normalizeString(draft.activeImagingOrderId);
    const activeImagingOrder =
        imagingOrders.find(
            (item) =>
                normalizeString(item.imagingOrderId) === activeImagingOrderId
        ) || null;
    const hydratedImagingOrder = activeImagingOrder
        ? deriveImagingOrderContext(
              activeImagingOrder,
              draft,
              review.session.patient
          )
        : null;
    const evaluation = hydratedImagingOrder
        ? evaluateImagingOrder(hydratedImagingOrder)
        : { status: 'not_applicable', selectedStudiesCount: 0 };
    const activeStatus = hcu012AStatusMeta(evaluation.status);
    const imagingSnapshots = normalizeImagingOrderSnapshots(
        draft.documents.imagingOrders
    );
    const activeReport = hydratedImagingOrder
        ? normalizeImagingReport(hydratedImagingOrder.result)
        : emptyImagingReport();
    const activeReportStatus = hcu012AReportStatusMeta(
        hydratedImagingOrder
            ? evaluateImagingReport(activeReport).status
            : 'not_received'
    );
    const imagingReportSnapshots = normalizeImagingReportSnapshots(
        draft.documents.imagingReports
    );
    const diagnoses = hydratedImagingOrder
        ? normalizeInterconsultationDiagnoses(hydratedImagingOrder.diagnoses)
        : normalizeInterconsultationDiagnoses([]);
    const preDiagnosis =
        diagnoses.find((item) => item.type === 'pre') ||
        emptyInterconsultationDiagnosis('pre');
    const defDiagnosis =
        diagnoses.find((item) => item.type === 'def') ||
        emptyInterconsultationDiagnosis('def');
    const studySelections = hydratedImagingOrder
        ? normalizeImagingStudySelections(hydratedImagingOrder.studySelections)
        : normalizeImagingStudySelections({});
    const selectedStudies = flattenImagingStudySelections(studySelections);
    const supportAttachments = normalizeAttachmentList(draft.intake.adjuntos);
    const selectedAttachmentIds = new Set(
        normalizeAttachmentList(activeReport.attachments).map((attachment) =>
            String(attachment.id || '')
        )
    );
    const attachmentSelector =
        supportAttachments.length > 0
            ? supportAttachments
                  .map((attachment) => {
                      const attachmentId = String(attachment.id || '');
                      const checked =
                          attachmentId &&
                          selectedAttachmentIds.has(attachmentId);
                      const meta = [
                          normalizeString(attachment.kind) || 'archivo',
                          normalizeString(attachment.mime),
                          attachment.size > 0
                              ? formatBytes(attachment.size)
                              : '',
                      ]
                          .filter(Boolean)
                          .join(' • ');
                      return `
                            <label class="clinical-history-inline-checkbox">
                                <input
                                    type="checkbox"
                                    name="imaging_report_attachment_ids"
                                    value="${escapeHtml(attachmentId)}"
                                    ${checked ? 'checked' : ''}
                                    ${disabled ? 'disabled' : ''}
                                />
                                <span>
                                    <strong>${escapeHtml(
                                        attachment.originalName ||
                                            `Adjunto ${attachmentId}`
                                    )}</strong>
                                    <small>${escapeHtml(meta || 'Soporte clínico')}</small>
                                </span>
                            </label>
                        `;
                  })
                  .join('')
            : buildEmptyClinicalCard(
                  'Sin adjuntos clínicos disponibles',
                  'Cuando el caso tenga adjuntos de clinical_uploads podrás seleccionarlos como respaldo del informe radiológico.'
              );

    return buildClinicalHistorySection(
        'Imagenologia HCU-form.012A/2008',
        'Solicitud formal de imagenologia trazable al formulario MSP, con emision, cancelacion y recepcion estructurada del resultado radiologico por episodio.',
        `
                <input
                    type="hidden"
                    id="imaging_order_active_id"
                    name="imaging_order_active_id"
                    value="${escapeHtml(activeImagingOrderId)}"
                />
                <div class="clinical-history-summary-grid">
                    ${summaryStatCard(
                        'HCU-012A',
                        activeStatus.label,
                        activeStatus.summary,
                        ['issued', 'received'].includes(activeStatus.status)
                            ? 'success'
                            : [
                                    'ready_to_issue',
                                    'incomplete',
                                    'draft',
                                ].includes(activeStatus.status)
                              ? 'warning'
                              : 'neutral'
                    )}
                    ${summaryStatCard(
                        'Paciente / HCU',
                        hydratedImagingOrder?.patientName ||
                            buildAdmissionLegalName(
                                draft.admission001,
                                review.session.patient
                            ) ||
                            'Sin paciente',
                        [
                            hydratedImagingOrder?.patientDocumentNumber,
                            hydratedImagingOrder?.patientRecordId,
                        ]
                            .filter(Boolean)
                            .join(' • ') || 'Sin documento',
                        'neutral'
                    )}
                    ${summaryStatCard(
                        'Solicitante',
                        hydratedImagingOrder?.requestingService ||
                            resolveClinicProfileDisplay().serviceLabel,
                        hydratedImagingOrder?.requestingEstablishment ||
                            resolveClinicProfileDisplay().establishmentLabel,
                        'neutral'
                    )}
                    ${summaryStatCard(
                        'Estudios',
                        String(selectedStudies.length),
                        selectedStudies.length > 0
                            ? selectedStudies.slice(0, 3).join(' • ')
                            : 'Sin estudios seleccionados',
                        selectedStudies.length > 0 ? 'success' : 'neutral'
                    )}
                    ${summaryStatCard(
                        'Resultado',
                        activeReportStatus.label,
                        activeReportStatus.summary,
                        activeReportStatus.status === 'received'
                            ? 'success'
                            : ['ready_to_receive', 'draft'].includes(
                                    activeReportStatus.status
                                )
                              ? 'warning'
                              : 'neutral'
                    )}
                    ${summaryStatCard(
                        'Snapshots',
                        String(
                            imagingSnapshots.length +
                                imagingReportSnapshots.length
                        ),
                        imagingSnapshots.length +
                            imagingReportSnapshots.length >
                            0
                            ? 'Incluye snapshots emitidos/cancelados y resultados radiologicos recibidos.'
                            : 'Todavia no hay snapshots HCU-012A emitidos.',
                        imagingSnapshots.length +
                            imagingReportSnapshots.length >
                            0
                            ? 'success'
                            : 'neutral'
                    )}
                </div>
                <div class="toolbar-row clinical-history-actions-row">
                    <button
                        type="button"
                        data-clinical-review-action="create-imaging-order"
                        ${disabled ? 'disabled' : ''}
                    >
                        Nueva solicitud de imagenologia
                    </button>
                    <button
                        type="button"
                        data-clinical-review-action="issue-current-imaging-order"
                        ${disabled || !hydratedImagingOrder ? 'disabled' : ''}
                    >
                        Emitir solicitud
                    </button>
                    <button
                        type="button"
                        data-clinical-review-action="cancel-current-imaging-order"
                        ${disabled || !hydratedImagingOrder ? 'disabled' : ''}
                    >
                        Cancelar solicitud
                    </button>
                    <button
                        type="button"
                        data-clinical-review-action="receive-current-imaging-report"
                        ${disabled || !hydratedImagingOrder ? 'disabled' : ''}
                    >
                        Recibir resultado
                    </button>
                </div>
                <div class="toolbar-row clinical-history-actions-row">
                    ${imagingOrders
                        .map((item) =>
                            buildImagingOrderChip(
                                item,
                                activeImagingOrderId,
                                disabled
                            )
                        )
                        .join('')}
                </div>
                ${
                    !hydratedImagingOrder
                        ? buildEmptyClinicalCard(
                              'Sin solicitud activa',
                              'Crea una solicitud de imagenologia del episodio para empezar el HCU-012A.'
                          )
                        : `
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'imaging_order_requested_at',
                                    'Fecha/hora de solicitud',
                                    hydratedImagingOrder.requestedAt,
                                    { disabled }
                                ),
                                inputField(
                                    'imaging_order_study_date',
                                    'Fecha de toma',
                                    hydratedImagingOrder.studyDate,
                                    { disabled }
                                ),
                                selectField(
                                    'imaging_order_priority',
                                    'Prioridad',
                                    hydratedImagingOrder.priority,
                                    CLINICAL_HISTORY_LAB_ORDER_PRIORITY_CHOICES,
                                    { disabled }
                                ),
                                inputField(
                                    'imaging_order_requested_by',
                                    'Profesional solicitante',
                                    hydratedImagingOrder.requestedBy,
                                    { disabled }
                                ),
                            ])}
                            ${checkboxField(
                                'imaging_order_required_for_current_plan',
                                'La solicitud de imagenologia es parte del plan actual',
                                hydratedImagingOrder.requiredForCurrentPlan ===
                                    true,
                                {
                                    hint: 'Si esta marcada, la aprobacion final exige emitirla o cancelarla.',
                                    disabled,
                                }
                            )}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'imaging_order_patient_name',
                                    'Paciente',
                                    hydratedImagingOrder.patientName,
                                    { disabled: true }
                                ),
                                inputField(
                                    'imaging_order_patient_record',
                                    'Documento / HCU',
                                    [
                                        hydratedImagingOrder.patientDocumentNumber,
                                        hydratedImagingOrder.patientRecordId,
                                    ]
                                        .filter(Boolean)
                                        .join(' '),
                                    { disabled: true }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'imaging_order_requesting_establishment',
                                    'Establecimiento solicitante',
                                    hydratedImagingOrder.requestingEstablishment,
                                    { disabled: true }
                                ),
                                inputField(
                                    'imaging_order_requesting_service',
                                    'Servicio solicitante',
                                    hydratedImagingOrder.requestingService,
                                    { disabled: true }
                                ),
                                inputField(
                                    'imaging_order_care_site',
                                    'Sala / sitio',
                                    hydratedImagingOrder.careSite,
                                    { disabled }
                                ),
                                inputField(
                                    'imaging_order_bed_label',
                                    'Cama / referencia',
                                    hydratedImagingOrder.bedLabel,
                                    { disabled }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'imaging_order_diagnosis_pre_label',
                                    'Diagnostico PRE',
                                    preDiagnosis.label,
                                    { disabled }
                                ),
                                inputField(
                                    'imaging_order_diagnosis_pre_cie10',
                                    'CIE-10 PRE',
                                    preDiagnosis.cie10,
                                    { disabled }
                                ),
                                inputField(
                                    'imaging_order_diagnosis_def_label',
                                    'Diagnostico DEF',
                                    defDiagnosis.label,
                                    { disabled }
                                ),
                                inputField(
                                    'imaging_order_diagnosis_def_cie10',
                                    'CIE-10 DEF',
                                    defDiagnosis.cie10,
                                    { disabled }
                                ),
                            ])}
                            ${CLINICAL_HISTORY_IMAGING_STUDY_GROUPS.map(
                                ({ key, label, hint }) =>
                                    buildImagingStudyGroupField(
                                        key,
                                        label,
                                        studySelections[key],
                                        hint,
                                        disabled
                                    )
                            ).join('')}
                            ${textareaField(
                                'imaging_order_request_reason',
                                'Motivo de la solicitud',
                                hydratedImagingOrder.requestReason,
                                {
                                    rows: 3,
                                    placeholder:
                                        'Registra las razones para solicitar aclaracion diagnostica o apoyo por imagen.',
                                    disabled,
                                }
                            )}
                            ${textareaField(
                                'imaging_order_clinical_summary',
                                'Resumen clinico',
                                hydratedImagingOrder.clinicalSummary,
                                {
                                    rows: 4,
                                    placeholder:
                                        'Sintesis clinica relevante para el estudio solicitado.',
                                    disabled,
                                }
                            )}
                            ${buildClinicalHistoryInlineGrid([
                                checkboxField(
                                    'imaging_order_can_mobilize',
                                    'Puede movilizarse',
                                    hydratedImagingOrder.canMobilize === true,
                                    { disabled }
                                ),
                                checkboxField(
                                    'imaging_order_can_remove_dressings',
                                    'Puede retirarse vendas, apositos o yesos',
                                    hydratedImagingOrder.canRemoveDressingsOrCasts ===
                                        true,
                                    { disabled }
                                ),
                                checkboxField(
                                    'imaging_order_physician_present',
                                    'El medico estara presente en el examen',
                                    hydratedImagingOrder.physicianPresentAtExam ===
                                        true,
                                    { disabled }
                                ),
                                checkboxField(
                                    'imaging_order_bedside_radiography',
                                    'Toma de radiografia en la cama',
                                    hydratedImagingOrder.bedsideRadiography ===
                                        true,
                                    {
                                        hint: 'Si la marcas, debe existir al menos un estudio en R-X convencional.',
                                        disabled,
                                    }
                                ),
                            ])}
                            ${textareaField(
                                'imaging_order_notes',
                                'Observaciones',
                                hydratedImagingOrder.notes,
                                {
                                    rows: 3,
                                    placeholder:
                                        'Condiciones logisticas, observaciones o instrucciones complementarias.',
                                    disabled,
                                }
                            )}
                            <div class="clinical-history-section-block">
                                <div class="clinical-history-event-head">
                                    <strong>Resultado / informe radiologico</strong>
                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                        activeReportStatus.label
                                    )}</span>
                                </div>
                                ${buildClinicalHistoryInlineGrid([
                                    inputField(
                                        'imaging_report_reported_at',
                                        'Fecha/hora del informe',
                                        activeReport.reportedAt,
                                        { disabled }
                                    ),
                                    inputField(
                                        'imaging_report_reported_by',
                                        'Cargado por',
                                        activeReport.reportedBy,
                                        {
                                            disabled,
                                            placeholder:
                                                'Staff o medico que registra el resultado',
                                        }
                                    ),
                                    inputField(
                                        'imaging_report_reporting_establishment',
                                        'Establecimiento respondiente',
                                        activeReport.reportingEstablishment,
                                        { disabled }
                                    ),
                                    inputField(
                                        'imaging_report_reporting_service',
                                        'Servicio respondiente',
                                        activeReport.reportingService,
                                        { disabled }
                                    ),
                                    inputField(
                                        'imaging_report_radiologist_professional_name',
                                        'Profesional/radiologo',
                                        activeReport.radiologistProfessionalName,
                                        { disabled }
                                    ),
                                    inputField(
                                        'imaging_report_radiologist_professional_role',
                                        'Rol del profesional',
                                        activeReport.radiologistProfessionalRole,
                                        { disabled }
                                    ),
                                ])}
                                ${textareaField(
                                    'imaging_report_study_performed_summary',
                                    'Estudio realizado',
                                    activeReport.studyPerformedSummary,
                                    {
                                        rows: 2,
                                        placeholder:
                                            'Describe el estudio efectivamente realizado o la modalidad reportada.',
                                        disabled,
                                    }
                                )}
                                ${textareaField(
                                    'imaging_report_findings',
                                    'Hallazgos',
                                    activeReport.findings,
                                    {
                                        rows: 3,
                                        placeholder:
                                            'Hallazgos radiologicos relevantes del informe.',
                                        disabled,
                                    }
                                )}
                                ${textareaField(
                                    'imaging_report_diagnostic_impression',
                                    'Impresion diagnostica',
                                    activeReport.diagnosticImpression,
                                    {
                                        rows: 3,
                                        placeholder:
                                            'Criterio o impresion diagnostica del estudio.',
                                        disabled,
                                    }
                                )}
                                ${textareaField(
                                    'imaging_report_recommendations',
                                    'Recomendaciones',
                                    activeReport.recommendations,
                                    {
                                        rows: 3,
                                        placeholder:
                                            'Recomendaciones o conducta sugerida desde imagenologia.',
                                        disabled,
                                    }
                                )}
                                ${textareaField(
                                    'imaging_report_follow_up_indications',
                                    'Indicaciones de seguimiento',
                                    activeReport.followUpIndications,
                                    {
                                        rows: 2,
                                        placeholder:
                                            'Indicaciones posteriores o hallazgos a vigilar.',
                                        disabled,
                                    }
                                )}
                                ${buildClinicalHistoryInlineGrid([
                                    inputField(
                                        'imaging_report_source_document_type',
                                        'Tipo de documento fuente',
                                        activeReport.sourceDocumentType,
                                        { disabled }
                                    ),
                                    inputField(
                                        'imaging_report_source_reference',
                                        'Referencia del documento',
                                        activeReport.sourceReference,
                                        { disabled }
                                    ),
                                    inputField(
                                        'imaging_report_received_by',
                                        'Recibido por',
                                        activeReport.receivedBy,
                                        { disabled: true }
                                    ),
                                ])}
                                <div class="clinical-history-section-block">
                                    <div class="clinical-history-event-head">
                                        <strong>Adjuntos del informe</strong>
                                        <span class="clinical-history-mini-chip">${escapeHtml(
                                            String(
                                                activeReport.attachments.length
                                            )
                                        )}</span>
                                    </div>
                                    <div class="clinical-history-inline-checks">
                                        ${attachmentSelector}
                                    </div>
                                    <small>Reutiliza adjuntos ya cargados por clinical_uploads.</small>
                                </div>
                                ${
                                    activeReportStatus.status === 'received'
                                        ? `
                                            <div class="clinical-history-section-block">
                                                <div class="clinical-history-event-head">
                                                    <strong>Reconciliacion manual requerida</strong>
                                                </div>
                                                <p>Informe recibido: reconciliar manualmente en HCU-005/HCU-024 si aplica.</p>
                                            </div>
                                        `
                                        : ''
                                }
                            </div>
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'imaging_order_issued_at',
                                    'Emitida el',
                                    hydratedImagingOrder.issuedAt,
                                    { disabled: true }
                                ),
                                inputField(
                                    'imaging_order_cancelled_at',
                                    'Cancelada el',
                                    hydratedImagingOrder.cancelledAt,
                                    { disabled: true }
                                ),
                                inputField(
                                    'imaging_order_cancel_reason',
                                    'Razon de cancelacion',
                                    hydratedImagingOrder.cancelReason,
                                    { disabled }
                                ),
                            ])}
                            <div class="clinical-history-section-block">
                                <div class="clinical-history-event-head">
                                    <strong>Snapshots documentales HCU-012A</strong>
                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                        String(imagingSnapshots.length)
                                    )}</span>
                                </div>
                                <div class="clinical-history-events">
                                    ${
                                        imagingSnapshots.length === 0
                                            ? buildEmptyClinicalCard(
                                                  'Sin snapshots emitidos',
                                                  'Las solicitudes emitidas o canceladas quedaran congeladas aqui.'
                                              )
                                            : imagingSnapshots
                                                  .map(
                                                      (snapshot) => `
                                                            <article class="clinical-history-event-card" data-tone="neutral">
                                                                <div class="clinical-history-event-head">
                                                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                                                        hcu012AStatusMeta(
                                                                            snapshot.status
                                                                        ).label
                                                                    )}</span>
                                                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                                                        readableTimestamp(
                                                                            snapshot.finalizedAt ||
                                                                                snapshot.snapshotAt
                                                                        )
                                                                    )}</span>
                                                                </div>
                                                                <p>${escapeHtml(
                                                                    flattenImagingStudySelections(
                                                                        snapshot.studySelections
                                                                    ).join(
                                                                        ' • '
                                                                    ) ||
                                                                        'Sin estudios visibles'
                                                                )}</p>
                                                            </article>
                                                        `
                                                  )
                                                  .join('')
                                    }
                                </div>
                            </div>
                            <div class="clinical-history-section-block">
                                <div class="clinical-history-event-head">
                                    <strong>Snapshots de resultados radiologicos</strong>
                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                        String(imagingReportSnapshots.length)
                                    )}</span>
                                </div>
                                <div class="clinical-history-events">
                                    ${
                                        imagingReportSnapshots.length === 0
                                            ? buildEmptyClinicalCard(
                                                  'Sin resultados recibidos',
                                                  'Los resultados radiologicos recibidos quedaran congelados aqui como respaldo documental.'
                                              )
                                            : imagingReportSnapshots
                                                  .map(
                                                      (snapshot) => `
                                                            <article class="clinical-history-event-card" data-tone="neutral">
                                                                <div class="clinical-history-event-head">
                                                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                                                        hcu012AReportStatusMeta(
                                                                            snapshot.reportStatus
                                                                        ).label
                                                                    )}</span>
                                                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                                                        readableTimestamp(
                                                                            snapshot.finalizedAt ||
                                                                                snapshot.snapshotAt
                                                                        )
                                                                    )}</span>
                                                                </div>
                                                                <p>${escapeHtml(
                                                                    snapshot
                                                                        .report
                                                                        ?.studyPerformedSummary ||
                                                                        snapshot
                                                                            .report
                                                                            ?.diagnosticImpression ||
                                                                        snapshot
                                                                            .report
                                                                            ?.findings ||
                                                                        'Sin resumen visible'
                                                                )}</p>
                                                            </article>
                                                        `
                                                  )
                                                  .join('')
                                    }
                                </div>
                            </div>
                        `
                }
            `
    );
}

function buildClinicalHistoryConsentSection(review, draft, disabled) {
    const packets = normalizeConsentPackets(draft.consentPackets);
    const activePacketId = normalizeString(draft.activeConsentPacketId);
    const activePacket =
        packets.find(
            (packet) => normalizeString(packet.packetId) === activePacketId
        ) || null;
    const hydratedPacket = activePacket
        ? deriveConsentPacketContext(
              activePacket,
              draft,
              review.session.patient
          )
        : null;
    const activeStatus = hcu024StatusMeta(
        hydratedPacket
            ? evaluateConsentPacket(hydratedPacket).status
            : 'not_applicable'
    );
    const consentForms = normalizeConsentFormSnapshots(
        draft.documents.consentForms
    );

    return buildClinicalHistorySection(
        'Consentimiento HCU-form.024/2008',
        'Consentimientos escritos por procedimiento, con bridge legacy hacia el consentimiento activo.',
        `
                <input
                    type="hidden"
                    id="consent_active_packet_id"
                    name="consent_active_packet_id"
                    value="${escapeHtml(activePacketId)}"
                />
                <div class="clinical-history-summary-grid">
                    ${summaryStatCard(
                        'HCU-024',
                        activeStatus.label,
                        activeStatus.summary,
                        activeStatus.status === 'accepted'
                            ? 'success'
                            : ['declined', 'revoked', 'incomplete'].includes(
                                    activeStatus.status
                                )
                              ? 'warning'
                              : 'neutral'
                    )}
                    ${summaryStatCard(
                        'Paciente',
                        hydratedPacket?.patientName ||
                            buildAdmissionLegalName(
                                draft.admission001,
                                review.session.patient
                            ) ||
                            'Sin paciente',
                        hydratedPacket?.patientDocumentNumber ||
                            normalizeString(
                                draft.admission001.identity.documentNumber
                            ) ||
                            'Sin documento',
                        'neutral'
                    )}
                    ${summaryStatCard(
                        'Establecimiento',
                        hydratedPacket?.establishmentLabel ||
                            resolveClinicProfileDisplay().establishmentLabel,
                        hydratedPacket?.serviceLabel ||
                            resolveClinicProfileDisplay().serviceLabel,
                        'neutral'
                    )}
                    ${summaryStatCard(
                        'Snapshots',
                        String(consentForms.length),
                        consentForms.length > 0
                            ? 'Snapshots documentales inmutables del episodio'
                            : 'Todavía no hay snapshots HCU-024 emitidos',
                        consentForms.length > 0 ? 'success' : 'neutral'
                    )}
                </div>
                <div class="toolbar-row clinical-history-actions-row">
                    <button
                        type="button"
                        data-clinical-draft-action="create-consent-packet-local"
                        data-template-key="laser-dermatologico"
                        ${disabled ? 'disabled' : ''}
                    >
                        Láser dermatológico
                    </button>
                    <button
                        type="button"
                        data-clinical-draft-action="create-consent-packet-local"
                        data-template-key="peeling-quimico"
                        ${disabled ? 'disabled' : ''}
                    >
                        Peeling químico
                    </button>
                    <button
                        type="button"
                        data-clinical-draft-action="create-consent-packet-local"
                        data-template-key="botox"
                        ${disabled ? 'disabled' : ''}
                    >
                        Botox
                    </button>
                    <button
                        type="button"
                        data-clinical-draft-action="create-consent-packet-local"
                        data-template-key="generic"
                        ${disabled ? 'disabled' : ''}
                    >
                        Consentimiento genérico
                    </button>
                </div>
                <div class="toolbar-row clinical-history-actions-row">
                    ${packets
                        .map((packet) =>
                            buildConsentPacketChip(
                                packet,
                                activePacketId,
                                disabled
                            )
                        )
                        .join('')}
                </div>
                ${
                    !hydratedPacket
                        ? buildEmptyClinicalCard(
                              'Sin consentimiento activo',
                              'Crea un consentimiento por procedimiento para empezar el HCU-024 del episodio.'
                          )
                        : `
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'consent_packet_title',
                                    'Título del formulario',
                                    hydratedPacket.title,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_care_mode',
                                    'Tipo de atención',
                                    hydratedPacket.careMode,
                                    { disabled }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'consent_packet_service_label',
                                    'Servicio',
                                    hydratedPacket.serviceLabel,
                                    { disabled: true }
                                ),
                                inputField(
                                    'consent_packet_establishment_label',
                                    'Establecimiento',
                                    hydratedPacket.establishmentLabel,
                                    { disabled: true }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'consent_packet_patient_name',
                                    'Paciente',
                                    hydratedPacket.patientName,
                                    { disabled: true }
                                ),
                                inputField(
                                    'consent_packet_patient_document',
                                    'Documento / HCU',
                                    `${
                                        hydratedPacket.patientDocumentNumber ||
                                        ''
                                    } ${
                                        hydratedPacket.patientRecordId || ''
                                    }`.trim(),
                                    { disabled: true }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'consent_packet_encounter_datetime',
                                    'Fecha/hora',
                                    hydratedPacket.encounterDateTime,
                                    { disabled: true }
                                ),
                                inputField(
                                    'consent_packet_diagnosis_cie10',
                                    'CIE-10',
                                    hydratedPacket.diagnosisCie10,
                                    { disabled }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'consent_packet_diagnosis_label',
                                    'Diagnóstico principal',
                                    hydratedPacket.diagnosisLabel,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_procedure_name',
                                    'Procedimiento',
                                    hydratedPacket.procedureName,
                                    { disabled }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                textareaField(
                                    'consent_packet_procedure_what_is_it',
                                    'En qué consiste',
                                    hydratedPacket.procedureWhatIsIt,
                                    { rows: 4, disabled }
                                ),
                                textareaField(
                                    'consent_packet_procedure_how',
                                    'Cómo se realiza',
                                    hydratedPacket.procedureHowItIsDone,
                                    { rows: 4, disabled }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'consent_packet_duration_estimate',
                                    'Duración estimada',
                                    hydratedPacket.durationEstimate,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_graphic_ref',
                                    'Referencia gráfica',
                                    hydratedPacket.graphicRef,
                                    { disabled }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                textareaField(
                                    'consent_packet_benefits',
                                    'Beneficios',
                                    hydratedPacket.benefits,
                                    { rows: 4, disabled }
                                ),
                                textareaField(
                                    'consent_packet_frequent_risks',
                                    'Riesgos frecuentes',
                                    hydratedPacket.frequentRisks,
                                    { rows: 4, disabled }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                textareaField(
                                    'consent_packet_rare_serious_risks',
                                    'Riesgos poco frecuentes graves',
                                    hydratedPacket.rareSeriousRisks,
                                    { rows: 4, disabled }
                                ),
                                textareaField(
                                    'consent_packet_patient_specific_risks',
                                    'Riesgos específicos del paciente',
                                    hydratedPacket.patientSpecificRisks,
                                    { rows: 4, disabled }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                textareaField(
                                    'consent_packet_alternatives',
                                    'Alternativas',
                                    hydratedPacket.alternatives,
                                    { rows: 4, disabled }
                                ),
                                textareaField(
                                    'consent_packet_post_procedure_care',
                                    'Manejo posterior',
                                    hydratedPacket.postProcedureCare,
                                    { rows: 4, disabled }
                                ),
                            ])}
                            ${textareaField(
                                'consent_packet_no_procedure_consequences',
                                'Consecuencias de no realizarlo',
                                hydratedPacket.noProcedureConsequences,
                                { rows: 3, disabled }
                            )}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'consent_packet_declared_at',
                                    'Fecha/hora de información',
                                    hydratedPacket.declaration.declaredAt,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_professional_name',
                                    'Profesional tratante',
                                    hydratedPacket.professionalAttestation.name,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_professional_document',
                                    'Documento profesional',
                                    hydratedPacket.professionalAttestation
                                        .documentNumber,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_professional_signed_at',
                                    'Firma profesional',
                                    hydratedPacket.professionalAttestation
                                        .signedAt,
                                    { disabled }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                textareaField(
                                    'consent_packet_capacity_assessment',
                                    'Capacidad para decidir',
                                    hydratedPacket.declaration
                                        .capacityAssessment,
                                    { rows: 3, disabled }
                                ),
                                textareaField(
                                    'consent_packet_declaration_notes',
                                    'Notas de declaración',
                                    hydratedPacket.declaration.notes,
                                    { rows: 3, disabled }
                                ),
                            ])}
                            ${checkboxField(
                                'consent_packet_patient_can_consent',
                                'El paciente puede consentir por sí mismo',
                                hydratedPacket.declaration.patientCanConsent !==
                                    false,
                                { disabled }
                            )}
                            ${checkboxField(
                                'consent_packet_private_communication_confirmed',
                                'La comunicación ocurrió en entorno privado',
                                hydratedPacket.privateCommunicationConfirmed ===
                                    true,
                                { disabled }
                            )}
                            ${checkboxField(
                                'consent_packet_companion_share_authorized',
                                'Hay autorización para compartir con acompañante',
                                hydratedPacket.companionShareAuthorized ===
                                    true,
                                { disabled }
                            )}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'consent_packet_patient_attestation_name',
                                    'Paciente compareciente',
                                    hydratedPacket.patientAttestation.name,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_patient_attestation_document',
                                    'Documento del paciente',
                                    hydratedPacket.patientAttestation
                                        .documentNumber,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_patient_attestation_signed_at',
                                    'Fecha de firma del paciente',
                                    hydratedPacket.patientAttestation.signedAt,
                                    { disabled }
                                ),
                            ])}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'consent_packet_representative_name',
                                    'Representante',
                                    hydratedPacket.representativeAttestation
                                        .name,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_representative_kinship',
                                    'Parentesco',
                                    hydratedPacket.representativeAttestation
                                        .kinship,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_representative_document',
                                    'Documento representante',
                                    hydratedPacket.representativeAttestation
                                        .documentNumber,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_representative_phone',
                                    'Teléfono representante',
                                    hydratedPacket.representativeAttestation
                                        .phone,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_representative_signed_at',
                                    'Firma representante',
                                    hydratedPacket.representativeAttestation
                                        .signedAt,
                                    { disabled }
                                ),
                            ])}
                            ${checkboxField(
                                'consent_packet_patient_attestation_refused_signature',
                                'El paciente se negó a firmar la declaración',
                                hydratedPacket.patientAttestation
                                    .refusedSignature === true,
                                { disabled }
                            )}
                            ${checkboxField(
                                'consent_packet_denial_refused_signature',
                                'Si hay negativa, el paciente se niega a firmarla',
                                hydratedPacket.denial
                                    .patientRefusedSignature === true,
                                { disabled }
                            )}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'consent_packet_denial_declined_at',
                                    'Fecha/hora de negativa',
                                    hydratedPacket.denial.declinedAt,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_denial_reason',
                                    'Razón de negativa',
                                    hydratedPacket.denial.reason,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_witness_name',
                                    'Testigo',
                                    hydratedPacket.witnessAttestation.name,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_witness_document',
                                    'Documento testigo',
                                    hydratedPacket.witnessAttestation
                                        .documentNumber,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_witness_phone',
                                    'Teléfono testigo',
                                    hydratedPacket.witnessAttestation.phone,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_witness_signed_at',
                                    'Firma testigo',
                                    hydratedPacket.witnessAttestation.signedAt,
                                    { disabled }
                                ),
                            ])}
                            ${textareaField(
                                'consent_packet_denial_notes',
                                'Notas de negativa',
                                hydratedPacket.denial.notes,
                                { rows: 3, disabled }
                            )}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'consent_packet_revocation_revoked_at',
                                    'Fecha/hora de revocatoria',
                                    hydratedPacket.revocation.revokedAt,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_revocation_received_by',
                                    'Profesional que recibe revocatoria',
                                    hydratedPacket.revocation.receivedBy,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_revocation_reason',
                                    'Razón de revocatoria',
                                    hydratedPacket.revocation.reason,
                                    { disabled }
                                ),
                            ])}
                            ${textareaField(
                                'consent_packet_revocation_notes',
                                'Notas de revocatoria',
                                hydratedPacket.revocation.notes,
                                { rows: 3, disabled }
                            )}
                            ${checkboxField(
                                'consent_packet_anesthesiologist_applicable',
                                'Requiere comparecencia de anestesiología',
                                hydratedPacket.anesthesiologistAttestation
                                    .applicable === true,
                                { disabled }
                            )}
                            ${buildClinicalHistoryInlineGrid([
                                inputField(
                                    'consent_packet_anesthesiologist_name',
                                    'Anestesiólogo',
                                    hydratedPacket.anesthesiologistAttestation
                                        .name,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_anesthesiologist_document',
                                    'Documento anestesiólogo',
                                    hydratedPacket.anesthesiologistAttestation
                                        .documentNumber,
                                    { disabled }
                                ),
                                inputField(
                                    'consent_packet_anesthesiologist_signed_at',
                                    'Firma anestesiología',
                                    hydratedPacket.anesthesiologistAttestation
                                        .signedAt,
                                    { disabled }
                                ),
                            ])}
                            <div class="toolbar-row clinical-history-actions-row">
                                <button
                                    type="button"
                                    data-clinical-review-action="declare-current-consent"
                                    ${disabled ? 'disabled' : ''}
                                >
                                    Declarar consentimiento
                                </button>
                                <button
                                    type="button"
                                    data-clinical-review-action="deny-current-consent"
                                    ${disabled ? 'disabled' : ''}
                                >
                                    Registrar negativa
                                </button>
                                <button
                                    type="button"
                                    data-clinical-review-action="revoke-current-consent"
                                    ${disabled ? 'disabled' : ''}
                                >
                                    Registrar revocatoria
                                </button>
                            </div>
                        `
                }
            `
    );
}

function buildClinicalHistoryDocumentsSection(draft, disabled) {
    return buildClinicalHistorySection(
        'Certificado y salida',
        'La nota final y la receta se regeneran desde HCU-005; aquí solo mantienes el certificado.',
        `
                <article class="clinical-history-event-card">
                    <div class="clinical-history-event-head">
                        <span class="clinical-history-mini-chip">Mirror HCU-005</span>
                        <span class="clinical-history-mini-chip">${escapeHtml(
                            hcu005StatusMeta(
                                evaluateHcu005(draft.clinicianDraft.hcu005)
                                    .status
                            ).label
                        )}</span>
                    </div>
                    <p>${escapeHtml(
                        draft.documents.finalNote.summary ||
                            'La nota final se construirá desde HCU-005.'
                    )}</p>
                    <small>${escapeHtml(
                        draft.documents.prescription.directions ||
                            'La receta se reflejará aquí cuando existan prescripciones completas.'
                    )}</small>
                </article>
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
                <div class="toolbar-row clinical-history-actions-row">
                    <button
                        type="button"
                        id="clinicalHistoryExportFullRecordBtn"
                        data-clinical-review-action="export-full-record"
                        ${disabled ? 'disabled' : ''}
                    >
                        Exportar HCE completa (PDF)
                    </button>
                </div>
                <small>
                    Genera una version imprimible con todo el historial, el
                    estado legal y la trazabilidad documental del episodio.
                </small>
            `
    );
}

function buildClinicalHistoryCarePlanSection(draft, disabled) {
    return buildClinicalHistorySection(
        'Plan de Tratamiento',
        'Detalle de diagnostico, tratamientos, costos y seguimiento.',
        `
            ${buildClinicalHistoryInlineGrid([
                textareaField(
                    'document_care_plan_diagnosis',
                    'Diagnostico Resumido',
                    draft.documents.carePlan.diagnosis,
                    {
                        rows: 3,
                        disabled,
                        placeholder: 'Acne severo, etc.',
                    }
                ),
                textareaField(
                    'document_care_plan_treatments',
                    'Tratamientos, Sesiones, Costos',
                    draft.documents.carePlan.treatments,
                    {
                        rows: 4,
                        disabled,
                        placeholder: 'Pelling Facial | 3 sesiones | $150\\nLaser Q-Switched | 1 sesion | $200',
                    }
                ),
            ])}
            ${buildClinicalHistoryInlineGrid([
                inputField(
                    'document_care_plan_followup',
                    'Frecuencia de seguimiento',
                    draft.documents.carePlan.followUpFrequency,
                    {
                        disabled,
                        placeholder: 'Ej. Cada 2 semanas',
                    }
                ),
                textareaField(
                    'document_care_plan_goals',
                    'Metas Terapeuticas',
                    draft.documents.carePlan.goals,
                    {
                        rows: 3,
                        disabled,
                        placeholder: 'Reduccion del 80% de lesiones inflamatorias',
                    }
                ),
            ])}
            <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
                <button
                    type="button"
                    class="clinical-history-action-btn"
                    data-clinical-review-action="deliver-care-plan"
                    ${disabled ? 'disabled' : ''}
                >
                    Generar PDF del Plan de Tratamiento
                </button>
            </div>
        `
    );
}
function buildClinicalHistoryPhotosSection(review, draft, disabled) {
    const assets = Array.isArray(review.caseMediaAssets) ? review.caseMediaAssets : [];
    
    const photosList = assets.map(asset => {
        const url = escapeHtml(asset.url || '');
        return `
            <div class="clinical-photo-card" style="border: 1px solid var(--borderBase); padding: 10px; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: start; gap: 15px; background: var(--bgLayer)">
                <img src="${url}" alt="Foto Clínica" style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px;" />
                <div style="flex: 1;">
                    <strong style="display:block; color: var(--textStrong);">${escapeHtml(asset.bodyZone || 'Sin zona especificada')}</strong>
                    <span style="font-size: 13px; color: var(--textBase);">${escapeHtml(asset.createdAt || '')}</span>
                </div>
            </div>
        `;
    }).join('');

    return `
        <section class="clinical-history-section content-card" style="grid-column: 1 / -1;">
            <div class="clinical-history-section-header" style="display:flex; justify-content:space-between; align-items:center;">
                <h3>Fotografías Clínicas</h3>
                <div style="display:flex; gap:10px; align-items:center;">
                    <select id="clinical_photo_zone" class="clinical-history-picker" ${disabled ? 'disabled' : ''}>
                        <option value="">Zona corporal...</option>
                        <option value="Cara">Cara</option>
                        <option value="Cuello">Cuello</option>
                        <option value="Torax">Tórax</option>
                        <option value="Espalda">Espalda</option>
                        <option value="Brazo Izquierdo">Brazo Izq.</option>
                        <option value="Brazo Derecho">Brazo Der.</option>
                        <option value="Pierna Izquierda">Pierna Izq.</option>
                        <option value="Pierna Derecha">Pierna Der.</option>
                        <option value="Otra">Otra</option>
                    </select>
                    <label class="clinical-history-action-btn ${disabled ? 'disabled' : ''}" style="cursor: pointer; padding: 6px 12px; background: var(--brandBase); color: #fff; border-radius: 4px; font-weight: 600; font-size: 13px; ${disabled ? 'opacity:0.5; pointer-events:none;' : ''}">
                        Tomar Foto
                        <input type="file" id="clinical_photo_upload_input" accept="image/*" capture="environment" style="display:none;" />
                    </label>
                </div>
            </div>
            <div class="clinical-history-section-body">
                ${assets.length === 0 ? '<p class="clinical-history-empty-text">No hay fotografías registradas.</p>' : `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:15px;">${photosList}</div>`}
            </div>
        </section>
    `;
}

function buildDraftForm(review, draft, saving) {
    const disabled = saving || normalizeString(draft.sessionId) === '';
    const pregnancyValue = pregnancySelectValue(
        draft.intake.datosPaciente.embarazo
    );
    const reviewReasons = draft.reviewReasons.join(', ');

    return `
        <div class="clinical-history-form-grid">
            ${buildClinicalHistoryAdmissionSection(review, draft, disabled)}
            ${buildClinicalHistoryIntakeSection(draft, disabled, pregnancyValue)}
            ${buildClinicalHistoryPhotosSection(review, draft, disabled)}
            ${buildClinicalHistoryHcu005Section(draft, disabled, reviewReasons)}
            ${buildClinicalHistoryInterconsultSection(review, draft, disabled)}
            ${buildClinicalHistoryLabOrderSection(review, draft, disabled)}
            ${buildClinicalHistoryImagingOrderSection(review, draft, disabled)}
            ${buildClinicalHistoryConsentSection(review, draft, disabled)}
            ${buildClinicalHistoryCarePlanSection(draft, disabled)}
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

    setText(
        '#clinicalHistoryDraftMeta',
        buildDraftMetaText(slice, review, draft)
    );
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

    const readCheckedValues = (name) =>
        Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(
            (field) =>
                field instanceof HTMLInputElement
                    ? normalizeString(field.value)
                    : ''
        );

    snapshot.admission001 = normalizeAdmission001({
        ...snapshot.admission001,
        identity: {
            ...snapshot.admission001.identity,
            documentType: readValue('admission_identity_document_type'),
            documentNumber: readValue('admission_identity_document_number'),
            apellidoPaterno: readValue('admission_identity_last_name_1'),
            apellidoMaterno: readValue('admission_identity_last_name_2'),
            primerNombre: readValue('admission_identity_first_name'),
            segundoNombre: readValue('admission_identity_second_name'),
        },
        demographics: {
            ...snapshot.admission001.demographics,
            birthDate: readValue('admission_demographics_birth_date'),
            ageYears: normalizeNullableInt(
                readValue('admission_demographics_age_years')
            ),
            sexAtBirth: readValue('admission_demographics_sex_at_birth'),
            maritalStatus: readValue('admission_demographics_marital_status'),
            educationLevel: readValue('admission_demographics_education_level'),
            occupation: readValue('admission_demographics_occupation'),
            employer: readValue('admission_demographics_employer'),
            nationalityCountry: readValue(
                'admission_demographics_nationality_country'
            ),
            culturalGroup: readValue('admission_demographics_cultural_group'),
            birthPlace: readValue('admission_demographics_birth_place'),
        },
        residence: {
            ...snapshot.admission001.residence,
            addressLine: readValue('admission_residence_address_line'),
            neighborhood: readValue('admission_residence_neighborhood'),
            zoneType: readValue('admission_residence_zone_type'),
            parish: readValue('admission_residence_parish'),
            canton: readValue('admission_residence_canton'),
            province: readValue('admission_residence_province'),
            phone: readValue('admission_residence_phone'),
        },
        coverage: {
            ...snapshot.admission001.coverage,
            healthInsuranceType: readValue(
                'admission_coverage_health_insurance_type'
            ),
        },
        referral: {
            ...snapshot.admission001.referral,
            referredBy: readValue('admission_referral_referred_by'),
        },
        emergencyContact: {
            ...snapshot.admission001.emergencyContact,
            name: readValue('admission_emergency_name'),
            kinship: readValue('admission_emergency_kinship'),
            phone: readValue('admission_emergency_phone'),
        },
        admissionMeta: {
            ...snapshot.admission001.admissionMeta,
            admissionDate: readValue('admission_meta_admission_date'),
            admissionKind: readValue('admission_meta_admission_kind'),
            admittedBy: readValue('admission_meta_admitted_by'),
        },
    });

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
    snapshot.intake.fototipoFitzpatrick = normalizeString(
        readValue('intake_fototipo_fitzpatrick')
    );
    snapshot.intake.habitos = normalizeString(readValue('intake_habitos'));
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
        telefono:
            normalizeString(readValue('admission_residence_phone')) ||
            normalizeString(snapshot.intake.datosPaciente.telefono),
        fechaNacimiento:
            normalizeString(readValue('admission_demographics_birth_date')) ||
            normalizeString(snapshot.intake.datosPaciente.fechaNacimiento),
        embarazo: normalizePregnancyValue(readValue('patient_embarazo')),
    };

    snapshot.clinicianDraft.resumen = normalizeString(
        readValue('hcu005_evolution_note')
    );
    snapshot.clinicianDraft.preguntasFaltantes = serializeTextareaLines(
        readValue('clinician_preguntas_faltantes')
    );
    snapshot.clinicianDraft.cie10Sugeridos = serializeTextareaLines(
        readValue('clinician_cie10')
    );
    snapshot.clinicianDraft.tratamientoBorrador = normalizeString(
        readValue('hcu005_therapeutic_plan')
    );
    snapshot.clinicianDraft.posologiaBorrador = normalizePosology({
        texto: readValue('hcu005_care_indications'),
        baseCalculo: '',
        pesoKg: snapshot.clinicianDraft.posologiaBorrador.pesoKg,
        edadAnios: snapshot.clinicianDraft.posologiaBorrador.edadAnios,
        units: snapshot.clinicianDraft.posologiaBorrador.units,
        ambiguous: false,
    });
    snapshot.clinicianDraft.hcu005 = normalizeHcu005({
        evolutionNote: readValue('hcu005_evolution_note'),
        diagnosticImpression: readValue('hcu005_diagnostic_impression'),
        therapeuticPlan: readValue('hcu005_therapeutic_plan'),
        careIndications: readValue('hcu005_care_indications'),
        prescriptionItems: Array.from(
            form.querySelectorAll('[data-hcu005-prescription-item]')
        )
            .map((row, index) =>
                normalizePrescriptionItem({
                    medication: readValue(
                        `hcu005_prescription_${index}_medication`
                    ),
                    presentation: readValue(
                        `hcu005_prescription_${index}_presentation`
                    ),
                    dose: readValue(`hcu005_prescription_${index}_dose`),
                    route: readValue(`hcu005_prescription_${index}_route`),
                    frequency: readValue(
                        `hcu005_prescription_${index}_frequency`
                    ),
                    duration: readValue(
                        `hcu005_prescription_${index}_duration`
                    ),
                    quantity: readValue(
                        `hcu005_prescription_${index}_quantity`
                    ),
                    instructions: readValue(
                        `hcu005_prescription_${index}_instructions`
                    ),
                })
            )
            .filter(prescriptionItemStarted),
    });

    const interconsultations = normalizeInterconsultations(
        snapshot.interconsultations
    );
    let activeInterconsultationId =
        normalizeString(readValue('interconsult_active_id')) ||
        normalizeString(snapshot.activeInterconsultationId);
    if (!activeInterconsultationId && interconsultations.length > 0) {
        activeInterconsultationId = normalizeString(
            interconsultations[0].interconsultId
        );
    }
    const activeInterconsultationIndex = interconsultations.findIndex(
        (interconsultation) =>
            normalizeString(interconsultation.interconsultId) ===
            activeInterconsultationId
    );
    if (activeInterconsultationIndex >= 0) {
        const baseInterconsultation = deriveInterconsultationContext(
            interconsultations[activeInterconsultationIndex],
            snapshot
        );
        const supportAttachments = normalizeAttachmentList(
            snapshot.intake.adjuntos
        );
        const selectedReportAttachmentIds = Array.from(
            form.querySelectorAll(
                'input[name="interconsult_report_attachment_ids"]:checked'
            )
        )
            .map((field) => normalizeString(field.value))
            .filter(Boolean);
        interconsultations[activeInterconsultationIndex] =
            normalizeInterconsultation({
                ...baseInterconsultation,
                requestedAt:
                    readValue('interconsult_requested_at') ||
                    baseInterconsultation.requestedAt,
                priority:
                    readValue('interconsult_priority') ||
                    baseInterconsultation.priority,
                issuedBy:
                    readValue('interconsult_issued_by') ||
                    baseInterconsultation.issuedBy,
                requiredForCurrentPlan: readChecked(
                    'interconsult_required_for_current_plan'
                ),
                destinationEstablishment: readValue(
                    'interconsult_destination_establishment'
                ),
                destinationService: readValue(
                    'interconsult_destination_service'
                ),
                consultedProfessionalName: readValue(
                    'interconsult_consulted_professional_name'
                ),
                requestReason: readValue('interconsult_request_reason'),
                questionForConsultant: readValue(
                    'interconsult_question_for_consultant'
                ),
                clinicalPicture: readValue('interconsult_clinical_picture'),
                performedDiagnosticsSummary: readValue(
                    'interconsult_performed_diagnostics_summary'
                ),
                therapeuticMeasuresDone: readValue(
                    'interconsult_therapeutic_measures_done'
                ),
                diagnoses: [
                    normalizeInterconsultationDiagnosis({
                        type: 'pre',
                        label: readValue('interconsult_diagnosis_pre_label'),
                        cie10: readValue('interconsult_diagnosis_pre_cie10'),
                    }),
                    normalizeInterconsultationDiagnosis({
                        type: 'def',
                        label: readValue('interconsult_diagnosis_def_label'),
                        cie10: readValue('interconsult_diagnosis_def_cie10'),
                    }),
                ],
                issuedAt:
                    readValue('interconsult_issued_at') ||
                    baseInterconsultation.issuedAt,
                cancelledAt:
                    readValue('interconsult_cancelled_at') ||
                    baseInterconsultation.cancelledAt,
                cancelReason: readValue('interconsult_cancel_reason'),
                report: normalizeInterconsultReport({
                    ...baseInterconsultation.report,
                    reportedAt:
                        readValue('interconsult_report_reported_at') ||
                        baseInterconsultation.report.reportedAt,
                    reportedBy: readValue('interconsult_report_reported_by'),
                    receivedBy: baseInterconsultation.report.receivedBy || '',
                    respondingEstablishment: readValue(
                        'interconsult_report_responding_establishment'
                    ),
                    respondingService: readValue(
                        'interconsult_report_responding_service'
                    ),
                    consultantProfessionalName: readValue(
                        'interconsult_report_consultant_professional_name'
                    ),
                    consultantProfessionalRole: readValue(
                        'interconsult_report_consultant_professional_role'
                    ),
                    reportSummary: readValue('interconsult_report_summary'),
                    clinicalFindings: readValue(
                        'interconsult_report_clinical_findings'
                    ),
                    diagnosticOpinion: readValue(
                        'interconsult_report_diagnostic_opinion'
                    ),
                    recommendations: readValue(
                        'interconsult_report_recommendations'
                    ),
                    followUpIndications: readValue(
                        'interconsult_report_follow_up_indications'
                    ),
                    sourceDocumentType: readValue(
                        'interconsult_report_source_document_type'
                    ),
                    sourceReference: readValue(
                        'interconsult_report_source_reference'
                    ),
                    attachments: supportAttachments.filter((attachment) =>
                        selectedReportAttachmentIds.includes(
                            normalizeString(attachment.id)
                        )
                    ),
                }),
            });
    }
    snapshot.interconsultations = interconsultations;
    snapshot.activeInterconsultationId = activeInterconsultationId;

    const labOrders = normalizeLabOrders(snapshot.labOrders);
    let activeLabOrderId =
        normalizeString(readValue('lab_order_active_id')) ||
        normalizeString(snapshot.activeLabOrderId);
    if (!activeLabOrderId && labOrders.length > 0) {
        activeLabOrderId = normalizeString(labOrders[0].labOrderId);
    }
    const activeLabOrderIndex = labOrders.findIndex(
        (labOrder) => normalizeString(labOrder.labOrderId) === activeLabOrderId
    );
    if (activeLabOrderIndex >= 0) {
        const baseLabOrder = deriveLabOrderContext(
            labOrders[activeLabOrderIndex],
            snapshot
        );
        labOrders[activeLabOrderIndex] = normalizeLabOrder({
            ...baseLabOrder,
            requestedAt:
                readValue('lab_order_requested_at') || baseLabOrder.requestedAt,
            sampleDate:
                readValue('lab_order_sample_date') || baseLabOrder.sampleDate,
            priority: readValue('lab_order_priority') || baseLabOrder.priority,
            requestedBy:
                readValue('lab_order_requested_by') || baseLabOrder.requestedBy,
            requiredForCurrentPlan: readChecked(
                'lab_order_required_for_current_plan'
            ),
            careSite: readValue('lab_order_care_site') || baseLabOrder.careSite,
            bedLabel: readValue('lab_order_bed_label') || baseLabOrder.bedLabel,
            diagnoses: [
                normalizeInterconsultationDiagnosis({
                    type: 'pre',
                    label: readValue('lab_order_diagnosis_pre_label'),
                    cie10: readValue('lab_order_diagnosis_pre_cie10'),
                }),
                normalizeInterconsultationDiagnosis({
                    type: 'def',
                    label: readValue('lab_order_diagnosis_def_label'),
                    cie10: readValue('lab_order_diagnosis_def_cie10'),
                }),
            ],
            studySelections: normalizeLabOrderStudySelections({
                hematology: readCheckedValues('lab_order_study_hematology'),
                urinalysis: readCheckedValues('lab_order_study_urinalysis'),
                coprological: readCheckedValues('lab_order_study_coprological'),
                bloodChemistry: readCheckedValues(
                    'lab_order_study_bloodChemistry'
                ),
                serology: readCheckedValues('lab_order_study_serology'),
                bacteriology: readCheckedValues('lab_order_study_bacteriology'),
                others: readValue('lab_order_study_others'),
            }),
            bacteriologySampleSource: readValue(
                'lab_order_bacteriology_sample_source'
            ),
            physicianPresentAtExam: readChecked('lab_order_physician_present'),
            notes: readValue('lab_order_notes'),
            issuedAt: readValue('lab_order_issued_at') || baseLabOrder.issuedAt,
            cancelledAt:
                readValue('lab_order_cancelled_at') || baseLabOrder.cancelledAt,
            cancelReason: readValue('lab_order_cancel_reason'),
        });
    }
    snapshot.labOrders = labOrders;
    snapshot.activeLabOrderId = activeLabOrderId;

    const imagingOrders = normalizeImagingOrders(snapshot.imagingOrders);
    let activeImagingOrderId =
        normalizeString(readValue('imaging_order_active_id')) ||
        normalizeString(snapshot.activeImagingOrderId);
    if (!activeImagingOrderId && imagingOrders.length > 0) {
        activeImagingOrderId = normalizeString(imagingOrders[0].imagingOrderId);
    }
    const activeImagingOrderIndex = imagingOrders.findIndex(
        (imagingOrder) =>
            normalizeString(imagingOrder.imagingOrderId) ===
            activeImagingOrderId
    );
    if (activeImagingOrderIndex >= 0) {
        const baseImagingOrder = deriveImagingOrderContext(
            imagingOrders[activeImagingOrderIndex],
            snapshot
        );
        const supportAttachments = normalizeAttachmentList(
            snapshot.intake.adjuntos
        );
        const selectedReportAttachmentIds = Array.from(
            form.querySelectorAll(
                'input[name="imaging_report_attachment_ids"]:checked'
            )
        )
            .map((field) => normalizeString(field.value))
            .filter(Boolean);
        imagingOrders[activeImagingOrderIndex] = normalizeImagingOrder({
            ...baseImagingOrder,
            requestedAt:
                readValue('imaging_order_requested_at') ||
                baseImagingOrder.requestedAt,
            studyDate:
                readValue('imaging_order_study_date') ||
                baseImagingOrder.studyDate,
            priority:
                readValue('imaging_order_priority') ||
                baseImagingOrder.priority,
            requestedBy:
                readValue('imaging_order_requested_by') ||
                baseImagingOrder.requestedBy,
            requiredForCurrentPlan: readChecked(
                'imaging_order_required_for_current_plan'
            ),
            careSite:
                readValue('imaging_order_care_site') ||
                baseImagingOrder.careSite,
            bedLabel:
                readValue('imaging_order_bed_label') ||
                baseImagingOrder.bedLabel,
            diagnoses: [
                normalizeInterconsultationDiagnosis({
                    type: 'pre',
                    label: readValue('imaging_order_diagnosis_pre_label'),
                    cie10: readValue('imaging_order_diagnosis_pre_cie10'),
                }),
                normalizeInterconsultationDiagnosis({
                    type: 'def',
                    label: readValue('imaging_order_diagnosis_def_label'),
                    cie10: readValue('imaging_order_diagnosis_def_cie10'),
                }),
            ],
            studySelections: normalizeImagingStudySelections({
                conventionalRadiography: normalizeTextareaList(
                    readValue('imaging_order_studies_conventionalRadiography')
                ),
                tomography: normalizeTextareaList(
                    readValue('imaging_order_studies_tomography')
                ),
                magneticResonance: normalizeTextareaList(
                    readValue('imaging_order_studies_magneticResonance')
                ),
                ultrasound: normalizeTextareaList(
                    readValue('imaging_order_studies_ultrasound')
                ),
                procedures: normalizeTextareaList(
                    readValue('imaging_order_studies_procedures')
                ),
                others: normalizeTextareaList(
                    readValue('imaging_order_studies_others')
                ),
            }),
            requestReason: readValue('imaging_order_request_reason'),
            clinicalSummary: readValue('imaging_order_clinical_summary'),
            canMobilize: readChecked('imaging_order_can_mobilize'),
            canRemoveDressingsOrCasts: readChecked(
                'imaging_order_can_remove_dressings'
            ),
            physicianPresentAtExam: readChecked(
                'imaging_order_physician_present'
            ),
            bedsideRadiography: readChecked(
                'imaging_order_bedside_radiography'
            ),
            notes: readValue('imaging_order_notes'),
            issuedAt:
                readValue('imaging_order_issued_at') ||
                baseImagingOrder.issuedAt,
            cancelledAt:
                readValue('imaging_order_cancelled_at') ||
                baseImagingOrder.cancelledAt,
            cancelReason: readValue('imaging_order_cancel_reason'),
            result: normalizeImagingReport({
                ...baseImagingOrder.result,
                reportedAt:
                    readValue('imaging_report_reported_at') ||
                    baseImagingOrder.result.reportedAt,
                reportedBy: readValue('imaging_report_reported_by'),
                receivedBy: baseImagingOrder.result.receivedBy || '',
                reportingEstablishment: readValue(
                    'imaging_report_reporting_establishment'
                ),
                reportingService: readValue('imaging_report_reporting_service'),
                radiologistProfessionalName: readValue(
                    'imaging_report_radiologist_professional_name'
                ),
                radiologistProfessionalRole: readValue(
                    'imaging_report_radiologist_professional_role'
                ),
                studyPerformedSummary: readValue(
                    'imaging_report_study_performed_summary'
                ),
                findings: readValue('imaging_report_findings'),
                diagnosticImpression: readValue(
                    'imaging_report_diagnostic_impression'
                ),
                recommendations: readValue('imaging_report_recommendations'),
                followUpIndications: readValue(
                    'imaging_report_follow_up_indications'
                ),
                sourceDocumentType: readValue(
                    'imaging_report_source_document_type'
                ),
                sourceReference: readValue('imaging_report_source_reference'),
                attachments: supportAttachments.filter((attachment) =>
                    selectedReportAttachmentIds.includes(
                        normalizeString(attachment.id)
                    )
                ),
            }),
        });
    }
    snapshot.imagingOrders = imagingOrders;
    snapshot.activeImagingOrderId = activeImagingOrderId;

    const consentPackets = normalizeConsentPackets(snapshot.consentPackets);
    let activeConsentPacketId =
        normalizeString(readValue('consent_active_packet_id')) ||
        normalizeString(snapshot.activeConsentPacketId);
    if (!activeConsentPacketId && consentPackets.length > 0) {
        activeConsentPacketId = normalizeString(consentPackets[0].packetId);
    }
    const activeConsentPacketIndex = consentPackets.findIndex(
        (packet) => normalizeString(packet.packetId) === activeConsentPacketId
    );
    if (activeConsentPacketIndex >= 0) {
        const basePacket = deriveConsentPacketContext(
            consentPackets[activeConsentPacketIndex],
            snapshot
        );
        consentPackets[activeConsentPacketIndex] = normalizeConsentPacket({
            ...basePacket,
            title: readValue('consent_packet_title'),
            careMode: readValue('consent_packet_care_mode'),
            serviceLabel:
                readValue('consent_packet_service_label') ||
                basePacket.serviceLabel,
            establishmentLabel:
                readValue('consent_packet_establishment_label') ||
                basePacket.establishmentLabel,
            patientName:
                readValue('consent_packet_patient_name') ||
                basePacket.patientName,
            encounterDateTime:
                readValue('consent_packet_encounter_datetime') ||
                basePacket.encounterDateTime,
            diagnosisCie10: readValue('consent_packet_diagnosis_cie10'),
            diagnosisLabel: readValue('consent_packet_diagnosis_label'),
            procedureName: readValue('consent_packet_procedure_name'),
            procedureWhatIsIt: readValue('consent_packet_procedure_what_is_it'),
            procedureHowItIsDone: readValue('consent_packet_procedure_how'),
            durationEstimate: readValue('consent_packet_duration_estimate'),
            graphicRef: readValue('consent_packet_graphic_ref'),
            benefits: readValue('consent_packet_benefits'),
            frequentRisks: readValue('consent_packet_frequent_risks'),
            rareSeriousRisks: readValue('consent_packet_rare_serious_risks'),
            patientSpecificRisks: readValue(
                'consent_packet_patient_specific_risks'
            ),
            alternatives: readValue('consent_packet_alternatives'),
            postProcedureCare: readValue('consent_packet_post_procedure_care'),
            noProcedureConsequences: readValue(
                'consent_packet_no_procedure_consequences'
            ),
            privateCommunicationConfirmed: readChecked(
                'consent_packet_private_communication_confirmed'
            ),
            companionShareAuthorized: readChecked(
                'consent_packet_companion_share_authorized'
            ),
            declaration: {
                ...basePacket.declaration,
                declaredAt: readValue('consent_packet_declared_at'),
                patientCanConsent: readChecked(
                    'consent_packet_patient_can_consent'
                ),
                capacityAssessment: readValue(
                    'consent_packet_capacity_assessment'
                ),
                notes: readValue('consent_packet_declaration_notes'),
            },
            denial: {
                ...basePacket.denial,
                declinedAt: readValue('consent_packet_denial_declined_at'),
                reason: readValue('consent_packet_denial_reason'),
                patientRefusedSignature: readChecked(
                    'consent_packet_denial_refused_signature'
                ),
                notes: readValue('consent_packet_denial_notes'),
            },
            revocation: {
                ...basePacket.revocation,
                revokedAt: readValue('consent_packet_revocation_revoked_at'),
                receivedBy: readValue('consent_packet_revocation_received_by'),
                reason: readValue('consent_packet_revocation_reason'),
                notes: readValue('consent_packet_revocation_notes'),
            },
            patientAttestation: {
                ...basePacket.patientAttestation,
                name: readValue('consent_packet_patient_attestation_name'),
                documentNumber: readValue(
                    'consent_packet_patient_attestation_document'
                ),
                signedAt: readValue(
                    'consent_packet_patient_attestation_signed_at'
                ),
                refusedSignature: readChecked(
                    'consent_packet_patient_attestation_refused_signature'
                ),
            },
            representativeAttestation: {
                ...basePacket.representativeAttestation,
                name: readValue('consent_packet_representative_name'),
                kinship: readValue('consent_packet_representative_kinship'),
                documentNumber: readValue(
                    'consent_packet_representative_document'
                ),
                phone: readValue('consent_packet_representative_phone'),
                signedAt: readValue('consent_packet_representative_signed_at'),
            },
            professionalAttestation: {
                ...basePacket.professionalAttestation,
                name: readValue('consent_packet_professional_name'),
                documentNumber: readValue(
                    'consent_packet_professional_document'
                ),
                signedAt: readValue('consent_packet_professional_signed_at'),
            },
            anesthesiologistAttestation: {
                ...basePacket.anesthesiologistAttestation,
                applicable: readChecked(
                    'consent_packet_anesthesiologist_applicable'
                ),
                name: readValue('consent_packet_anesthesiologist_name'),
                documentNumber: readValue(
                    'consent_packet_anesthesiologist_document'
                ),
                signedAt: readValue(
                    'consent_packet_anesthesiologist_signed_at'
                ),
            },
            witnessAttestation: {
                ...basePacket.witnessAttestation,
                name: readValue('consent_packet_witness_name'),
                documentNumber: readValue('consent_packet_witness_document'),
                phone: readValue('consent_packet_witness_phone'),
                signedAt: readValue('consent_packet_witness_signed_at'),
            },
        });
    }
    snapshot.consentPackets = consentPackets;
    snapshot.activeConsentPacketId = activeConsentPacketId;
    snapshot.consent =
        activeConsentPacketIndex >= 0
            ? buildLegacyConsentFromPacket(
                  consentPackets[activeConsentPacketIndex],
                  snapshot.consent
              )
            : normalizeConsent(snapshot.consent);

    snapshot.documents = normalizeDocuments({
        finalNote: {
            ...snapshot.documents.finalNote,
        },
        prescription: {
            ...snapshot.documents.prescription,
        },
        certificate: {
            ...snapshot.documents.certificate,
            summary: readValue('document_certificate_summary'),
            restDays: readValue('document_certificate_rest_days'),
        },
        carePlan: {
            ...snapshot.documents.carePlan,
            diagnosis: readValue('document_care_plan_diagnosis'),
            treatments: readValue('document_care_plan_treatments'),
            followUpFrequency: readValue('document_care_plan_followup'),
            goals: readValue('document_care_plan_goals'),
        },
    });

    snapshot.requiresHumanReview = readChecked('requires_human_review');
    return synchronizeDraftClinicalState(snapshot);
}

function currentSerializedDraft() {
    const rootForm = document.getElementById('clinicalHistoryDraftForm');
    return rootForm instanceof HTMLFormElement
        ? serializeDraftForm(rootForm, currentDraftSource())
        : synchronizeDraftClinicalState(cloneValue(currentDraftSource()));
}

function createLocalOpaqueId(prefix) {
    if (
        typeof window !== 'undefined' &&
        window.crypto &&
        typeof window.crypto.randomUUID === 'function'
    ) {
        return `${prefix}-${window.crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createLocalConsentPacket(templateKey) {
    const template = consentPacketTemplate(templateKey);
    return normalizeConsentPacket({
        ...template,
        packetId: createLocalOpaqueId('consent-packet'),
        templateKey: template.templateKey,
        sourceMode: 'workspace_local',
        status: 'draft',
        history: [
            {
                eventId: createLocalOpaqueId('consent-history'),
                type: 'created_local',
                status: 'draft',
                actor: 'workspace',
                actorRole: 'clinician_admin',
                at: new Date().toISOString(),
                notes: 'Consentimiento creado localmente en la cabina HCU-024.',
            },
        ],
    });
}

function mutateConsentPackets(mutator, nextActiveId = '') {
    const baseDraft = currentSerializedDraft();
    const nextDraft = synchronizeDraftClinicalState(cloneValue(baseDraft));
    const packets = normalizeConsentPackets(nextDraft.consentPackets);
    const mutatedPackets = normalizeConsentPackets(mutator(packets) || packets);
    nextDraft.consentPackets = mutatedPackets;

    const requestedActiveId = normalizeString(nextActiveId);
    const currentActiveId = normalizeString(nextDraft.activeConsentPacketId);
    const resolvedActiveId =
        (requestedActiveId &&
        mutatedPackets.some(
            (packet) => normalizeString(packet.packetId) === requestedActiveId
        )
            ? requestedActiveId
            : currentActiveId &&
                mutatedPackets.some(
                    (packet) =>
                        normalizeString(packet.packetId) === currentActiveId
                )
              ? currentActiveId
              : normalizeString(mutatedPackets[0]?.packetId)) || '';
    nextDraft.activeConsentPacketId = resolvedActiveId;

    const review = currentReviewSource();
    const normalizedNext = synchronizeDraftClinicalState(nextDraft);
    const dirty =
        JSON.stringify(normalizedNext) !==
        JSON.stringify(normalizeDraftSnapshot(review.draft));

    setClinicalHistoryState({
        draftForm: cloneValue(normalizedNext),
        dirty,
    });
    renderClinicalHistorySection();
}

function buildConsentPacketActionPayload(action) {
    const review = currentReviewSource();
    const draft = currentSerializedDraft();
    const sessionId = normalizeString(
        review.session.sessionId || draft.sessionId
    );
    const packetId = normalizeString(
        draft.activeConsentPacketId ||
            draft.consentPackets?.[0]?.packetId ||
            review.activeConsentPacketId
    );
    const payload = {
        sessionId,
        action,
        packetId,
        draft: {
            intake: cloneValue(draft.intake),
            clinicianDraft: cloneValue(draft.clinicianDraft),
            admission001: cloneValue(draft.admission001),
        },
        documents: cloneValue(draft.documents),
        interconsultations: cloneValue(draft.interconsultations),
        activeInterconsultationId: draft.activeInterconsultationId,
        labOrders: cloneValue(draft.labOrders),
        activeLabOrderId: draft.activeLabOrderId,
        imagingOrders: cloneValue(draft.imagingOrders),
        activeImagingOrderId: draft.activeImagingOrderId,
        consentPackets: cloneValue(draft.consentPackets),
        activeConsentPacketId: packetId,
        consent: cloneValue(draft.consent),
        requiresHumanReview: draft.requiresHumanReview === true,
    };

    if (action === 'revoke_consent') {
        payload.receivedBy = normalizeString(
            draft.consentPackets.find(
                (packet) => normalizeString(packet.packetId) === packetId
            )?.revocation?.receivedBy
        );
    }

    return payload;
}

async function submitConsentPacketAction(action) {
    const sessionId = normalizeString(currentSessionId());
    if (!sessionId) {
        createToast(
            'Selecciona un caso clinico antes de operar el consentimiento HCU-024.',
            'warning'
        );
        return null;
    }

    const payload = buildConsentPacketActionPayload(action);
    if (!normalizeString(payload.packetId)) {
        createToast(
            'Crea o selecciona un consentimiento por procedimiento antes de continuar.',
            'warning'
        );
        return null;
    }

    setClinicalHistoryState({
        saving: true,
        error: '',
        draftForm: cloneValue(
            synchronizeDraftClinicalState({
                ...currentDraftSource(),
                ...payload.draft,
                documents: payload.documents,
                interconsultations: payload.interconsultations,
                activeInterconsultationId: payload.activeInterconsultationId,
                labOrders: payload.labOrders,
                activeLabOrderId: payload.activeLabOrderId,
                imagingOrders: payload.imagingOrders,
                activeImagingOrderId: payload.activeImagingOrderId,
                consentPackets: payload.consentPackets,
                activeConsentPacketId: payload.activeConsentPacketId,
                consent: payload.consent,
                requiresHumanReview: payload.requiresHumanReview,
            })
        ),
        dirty: true,
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
        if (action === 'declare_consent') {
            createToast(
                `Consentimiento HCU-024 declarado para ${targetLabel}.`,
                'success'
            );
        } else if (action === 'deny_consent') {
            createToast(
                `Negativa del consentimiento registrada para ${targetLabel}.`,
                'success'
            );
        } else if (action === 'revoke_consent') {
            createToast(
                `Revocatoria del consentimiento registrada para ${targetLabel}.`,
                'success'
            );
        }

        return nextReview;
    } catch (error) {
        setClinicalHistoryState({
            saving: false,
            error:
                error?.message ||
                'No se pudo actualizar el consentimiento HCU-024.',
        });
        syncDraftStatusMeta();
        createToast(
            error?.message ||
                'No se pudo actualizar el consentimiento HCU-024.',
            'error'
        );
        return null;
    }
}

function buildInterconsultationActionPayload(action, interconsultId = '') {
    const review = currentReviewSource();
    const draft = currentSerializedDraft();
    const sessionId = normalizeString(
        review.session.sessionId || draft.sessionId
    );
    const resolvedInterconsultId =
        normalizeString(interconsultId) ||
        normalizeString(
            draft.activeInterconsultationId ||
                draft.interconsultations?.[0]?.interconsultId ||
                review.activeInterconsultationId
        );

    const payload = {
        sessionId,
        action,
        interconsultId: resolvedInterconsultId,
        draft: {
            intake: cloneValue(draft.intake),
            clinicianDraft: cloneValue(draft.clinicianDraft),
            admission001: cloneValue(draft.admission001),
        },
        documents: cloneValue(draft.documents),
        interconsultations: cloneValue(draft.interconsultations),
        activeInterconsultationId:
            resolvedInterconsultId || draft.activeInterconsultationId,
        labOrders: cloneValue(draft.labOrders),
        activeLabOrderId: draft.activeLabOrderId,
        imagingOrders: cloneValue(draft.imagingOrders),
        activeImagingOrderId: draft.activeImagingOrderId,
        consentPackets: cloneValue(draft.consentPackets),
        activeConsentPacketId: draft.activeConsentPacketId,
        consent: cloneValue(draft.consent),
        requiresHumanReview: draft.requiresHumanReview === true,
    };

    if (action === 'cancel_interconsultation') {
        payload.cancelReason = normalizeString(
            draft.interconsultations.find(
                (item) =>
                    normalizeString(item.interconsultId) ===
                    resolvedInterconsultId
            )?.cancelReason
        );
    }

    if (action === 'create_interconsultation') {
        delete payload.interconsultId;
    }

    return payload;
}

async function submitInterconsultationAction(action, interconsultId = '') {
    const sessionId = normalizeString(currentSessionId());
    if (!sessionId) {
        createToast(
            'Selecciona un caso clínico antes de operar la interconsulta HCU-007.',
            'warning'
        );
        return null;
    }

    const payload = buildInterconsultationActionPayload(action, interconsultId);
    if (
        action !== 'create_interconsultation' &&
        !normalizeString(payload.interconsultId)
    ) {
        createToast(
            'Crea o selecciona una interconsulta antes de continuar.',
            'warning'
        );
        return null;
    }

    setClinicalHistoryState({
        saving: true,
        error: '',
        draftForm: cloneValue(
            synchronizeDraftClinicalState({
                ...currentDraftSource(),
                ...payload.draft,
                documents: payload.documents,
                interconsultations: payload.interconsultations,
                activeInterconsultationId: payload.activeInterconsultationId,
                labOrders: payload.labOrders,
                activeLabOrderId: payload.activeLabOrderId,
                imagingOrders: payload.imagingOrders,
                activeImagingOrderId: payload.activeImagingOrderId,
                consentPackets: payload.consentPackets,
                activeConsentPacketId: payload.activeConsentPacketId,
                consent: payload.consent,
                requiresHumanReview: payload.requiresHumanReview,
            })
        ),
        dirty: true,
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
            // Keep the workspace usable even if the admin snapshot refresh fails.
        }

        renderAdminChrome(getState());
        renderDashboard(getState());
        renderClinicalHistorySection();

        const targetLabel = currentSelectionLabel(nextReview);
        if (action === 'create_interconsultation') {
            createToast(
                `Interconsulta HCU-007 creada para ${targetLabel}.`,
                'success'
            );
        } else if (action === 'issue_interconsultation') {
            createToast(
                `Interconsulta HCU-007 emitida para ${targetLabel}.`,
                'success'
            );
        } else if (action === 'cancel_interconsultation') {
            createToast(
                `Interconsulta HCU-007 cancelada para ${targetLabel}.`,
                'success'
            );
        } else if (action === 'receive_interconsult_report') {
            createToast(
                `Informe del consultado recibido para ${targetLabel}.`,
                'success'
            );
        }

        return nextReview;
    } catch (error) {
        setClinicalHistoryState({
            saving: false,
            error:
                error?.message ||
                'No se pudo actualizar la interconsulta HCU-007.',
        });
        syncDraftStatusMeta();
        createToast(
            error?.message || 'No se pudo actualizar la interconsulta HCU-007.',
            'error'
        );
        return null;
    }
}

function buildLabOrderActionPayload(action, labOrderId = '') {
    const review = currentReviewSource();
    const draft = currentSerializedDraft();
    const sessionId = normalizeString(
        review.session.sessionId || draft.sessionId
    );
    const resolvedLabOrderId =
        normalizeString(labOrderId) ||
        normalizeString(
            draft.activeLabOrderId ||
                draft.labOrders?.[0]?.labOrderId ||
                review.activeLabOrderId
        );

    const payload = {
        sessionId,
        action,
        labOrderId: resolvedLabOrderId,
        draft: {
            intake: cloneValue(draft.intake),
            clinicianDraft: cloneValue(draft.clinicianDraft),
            admission001: cloneValue(draft.admission001),
        },
        documents: cloneValue(draft.documents),
        interconsultations: cloneValue(draft.interconsultations),
        activeInterconsultationId: draft.activeInterconsultationId,
        labOrders: cloneValue(draft.labOrders),
        activeLabOrderId: resolvedLabOrderId || draft.activeLabOrderId,
        imagingOrders: cloneValue(draft.imagingOrders),
        activeImagingOrderId: draft.activeImagingOrderId,
        consentPackets: cloneValue(draft.consentPackets),
        activeConsentPacketId: draft.activeConsentPacketId,
        consent: cloneValue(draft.consent),
        requiresHumanReview: draft.requiresHumanReview === true,
    };

    if (action === 'cancel_lab_order') {
        payload.cancelReason = normalizeString(
            draft.labOrders.find(
                (item) =>
                    normalizeString(item.labOrderId) === resolvedLabOrderId
            )?.cancelReason
        );
    }

    if (action === 'create_lab_order') {
        delete payload.labOrderId;
    }

    return payload;
}

function buildImagingOrderActionPayload(action, imagingOrderId = '') {
    const review = currentReviewSource();
    const draft = currentSerializedDraft();
    const sessionId = normalizeString(
        review.session.sessionId || draft.sessionId
    );
    const resolvedImagingOrderId =
        normalizeString(imagingOrderId) ||
        normalizeString(
            draft.activeImagingOrderId ||
                draft.imagingOrders?.[0]?.imagingOrderId ||
                review.activeImagingOrderId
        );

    const payload = {
        sessionId,
        action,
        imagingOrderId: resolvedImagingOrderId,
        draft: {
            intake: cloneValue(draft.intake),
            clinicianDraft: cloneValue(draft.clinicianDraft),
            admission001: cloneValue(draft.admission001),
        },
        documents: cloneValue(draft.documents),
        interconsultations: cloneValue(draft.interconsultations),
        activeInterconsultationId: draft.activeInterconsultationId,
        labOrders: cloneValue(draft.labOrders),
        activeLabOrderId: draft.activeLabOrderId,
        imagingOrders: cloneValue(draft.imagingOrders),
        activeImagingOrderId:
            resolvedImagingOrderId || draft.activeImagingOrderId,
        consentPackets: cloneValue(draft.consentPackets),
        activeConsentPacketId: draft.activeConsentPacketId,
        consent: cloneValue(draft.consent),
        requiresHumanReview: draft.requiresHumanReview === true,
    };

    if (action === 'cancel_imaging_order') {
        payload.cancelReason = normalizeString(
            draft.imagingOrders.find(
                (item) =>
                    normalizeString(item.imagingOrderId) ===
                    resolvedImagingOrderId
            )?.cancelReason
        );
    }

    if (action === 'create_imaging_order') {
        delete payload.imagingOrderId;
    }

    return payload;
}

async function submitLabOrderAction(action, labOrderId = '') {
    const sessionId = normalizeString(currentSessionId());
    if (!sessionId) {
        createToast(
            'Selecciona un caso clínico antes de operar la solicitud HCU-010A.',
            'warning'
        );
        return null;
    }

    const payload = buildLabOrderActionPayload(action, labOrderId);
    if (action !== 'create_lab_order' && !normalizeString(payload.labOrderId)) {
        createToast(
            'Crea o selecciona una solicitud de laboratorio antes de continuar.',
            'warning'
        );
        return null;
    }

    setClinicalHistoryState({
        saving: true,
        error: '',
        draftForm: cloneValue(
            synchronizeDraftClinicalState({
                ...currentDraftSource(),
                ...payload.draft,
                documents: payload.documents,
                interconsultations: payload.interconsultations,
                activeInterconsultationId: payload.activeInterconsultationId,
                labOrders: payload.labOrders,
                activeLabOrderId: payload.activeLabOrderId,
                imagingOrders: payload.imagingOrders,
                activeImagingOrderId: payload.activeImagingOrderId,
                consentPackets: payload.consentPackets,
                activeConsentPacketId: payload.activeConsentPacketId,
                consent: payload.consent,
                requiresHumanReview: payload.requiresHumanReview,
            })
        ),
        dirty: true,
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
            // Keep the workspace usable even if the admin snapshot refresh fails.
        }

        renderAdminChrome(getState());
        renderDashboard(getState());
        renderClinicalHistorySection();

        const targetLabel = currentSelectionLabel(nextReview);
        if (action === 'create_lab_order') {
            createToast(
                `Solicitud HCU-010A creada para ${targetLabel}.`,
                'success'
            );
        } else if (action === 'issue_lab_order') {
            createToast(
                `Solicitud HCU-010A emitida para ${targetLabel}.`,
                'success'
            );
        } else if (action === 'cancel_lab_order') {
            createToast(
                `Solicitud HCU-010A cancelada para ${targetLabel}.`,
                'success'
            );
        }

        return nextReview;
    } catch (error) {
        setClinicalHistoryState({
            saving: false,
            error:
                error?.message ||
                'No se pudo actualizar la solicitud HCU-010A.',
        });
        syncDraftStatusMeta();
        createToast(
            error?.message || 'No se pudo actualizar la solicitud HCU-010A.',
            'error'
        );
        return null;
    }
}

async function submitImagingOrderAction(action, imagingOrderId = '') {
    const sessionId = normalizeString(currentSessionId());
    if (!sessionId) {
        createToast(
            'Selecciona un caso clinico antes de operar la solicitud HCU-012A.',
            'warning'
        );
        return null;
    }

    const payload = buildImagingOrderActionPayload(action, imagingOrderId);
    if (
        action !== 'create_imaging_order' &&
        !normalizeString(payload.imagingOrderId)
    ) {
        createToast(
            'Crea o selecciona una solicitud de imagenologia antes de continuar.',
            'warning'
        );
        return null;
    }

    setClinicalHistoryState({
        saving: true,
        error: '',
        draftForm: cloneValue(
            synchronizeDraftClinicalState({
                ...currentDraftSource(),
                ...payload.draft,
                documents: payload.documents,
                interconsultations: payload.interconsultations,
                activeInterconsultationId: payload.activeInterconsultationId,
                labOrders: payload.labOrders,
                activeLabOrderId: payload.activeLabOrderId,
                imagingOrders: payload.imagingOrders,
                activeImagingOrderId: payload.activeImagingOrderId,
                consentPackets: payload.consentPackets,
                activeConsentPacketId: payload.activeConsentPacketId,
                consent: payload.consent,
                requiresHumanReview: payload.requiresHumanReview,
            })
        ),
        dirty: true,
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
            // Keep the workspace usable even if the admin snapshot refresh fails.
        }

        renderAdminChrome(getState());
        renderDashboard(getState());
        renderClinicalHistorySection();

        const targetLabel = currentSelectionLabel(nextReview);
        if (action === 'create_imaging_order') {
            createToast(
                `Solicitud HCU-012A creada para ${targetLabel}.`,
                'success'
            );
        } else if (action === 'issue_imaging_order') {
            createToast(
                `Solicitud HCU-012A emitida para ${targetLabel}.`,
                'success'
            );
        } else if (action === 'cancel_imaging_order') {
            createToast(
                `Solicitud HCU-012A cancelada para ${targetLabel}.`,
                'success'
            );
        } else if (action === 'receive_imaging_report') {
            createToast(
                `Resultado radiologico recibido para ${targetLabel}.`,
                'success'
            );
        }

        return nextReview;
    } catch (error) {
        setClinicalHistoryState({
            saving: false,
            error:
                error?.message ||
                'No se pudo actualizar la solicitud HCU-012A.',
        });
        syncDraftStatusMeta();
        createToast(
            error?.message || 'No se pudo actualizar la solicitud HCU-012A.',
            'error'
        );
        return null;
    }
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

    if (action === 'export-full-record') {
        return {
            sessionId,
            action: 'export_full_record',
        };
    }

    if (action === 'deliver-care-plan') {
        return {
            sessionId,
            action: 'deliver_care_plan',
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
        const exportOpened =
            action === 'export-full-record'
                ? openClinicalRecordExport(nextReview)
                : true;
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
        if (action === 'export-full-record') {
            createToast(
                exportOpened
                    ? `Export listo para ${targetLabel}. Usa imprimir o Guardar como PDF en la nueva ventana.`
                    : `La exportacion se preparo para ${targetLabel}, pero el navegador bloqueo la ventana emergente.`,
                exportOpened ? 'success' : 'warning'
            );
        } else if (action === 'deliver-care-plan') {
            const pdfUrl = '/api.php?resource=care-plan-pdf&session_id=' + encodeURIComponent(sessionId);
            window.open(pdfUrl, '_blank');
            createToast(
                `Plan de Tratamiento renderizado en PDF para ${targetLabel}.`,
                'success'
            );
        } else if (action === 'request-certified-copy') {
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
                fototipoFitzpatrick: draft.intake.fototipoFitzpatrick,
                habitos: draft.intake.habitos,
                rosRedFlags: cloneValue(draft.intake.rosRedFlags),
                resumenClinico: draft.intake.resumenClinico,
                preguntasFaltantes: cloneValue(draft.intake.preguntasFaltantes),
                datosPaciente: cloneValue(draft.intake.datosPaciente),
            },
            clinicianDraft: cloneValue(draft.clinicianDraft),
            admission001: cloneValue(draft.admission001),
        },
        documents: cloneValue(draft.documents),
        interconsultations: cloneValue(draft.interconsultations),
        activeInterconsultationId: draft.activeInterconsultationId,
        labOrders: cloneValue(draft.labOrders),
        activeLabOrderId: draft.activeLabOrderId,
        imagingOrders: cloneValue(draft.imagingOrders),
        activeImagingOrderId: draft.activeImagingOrderId,
        consentPackets: cloneValue(draft.consentPackets),
        activeConsentPacketId: draft.activeConsentPacketId,
        consent: cloneValue(draft.consent),
        requiresHumanReview: draft.requiresHumanReview === true,
    };

    const actionPayload = {
        sessionId,
        action: 'save_draft',
        draft: draftPatch.draft,
        documents: draftPatch.documents,
        interconsultations: draftPatch.interconsultations,
        activeInterconsultationId: draftPatch.activeInterconsultationId,
        labOrders: draftPatch.labOrders,
        activeLabOrderId: draftPatch.activeLabOrderId,
        imagingOrders: draftPatch.imagingOrders,
        activeImagingOrderId: draftPatch.activeImagingOrderId,
        consentPackets: draftPatch.consentPackets,
        activeConsentPacketId: draftPatch.activeConsentPacketId,
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

function mutatePrescriptionItems(mutator) {
    const rootForm = document.getElementById('clinicalHistoryDraftForm');
    const baseDraft =
        rootForm instanceof HTMLFormElement
            ? serializeDraftForm(rootForm, currentDraftSource())
            : currentDraftSource();
    const nextDraft = synchronizeDraftClinicalState(cloneValue(baseDraft));
    const items = normalizePrescriptionItems(
        nextDraft?.clinicianDraft?.hcu005?.prescriptionItems || []
    );
    const mutatedItems = mutator(items) || items;

    nextDraft.clinicianDraft.hcu005 = normalizeHcu005(
        nextDraft.clinicianDraft.hcu005,
        {
            prescriptionItems: mutatedItems,
        }
    );

    const review = currentReviewSource();
    const normalizedNext = synchronizeDraftClinicalState(nextDraft);
    const dirty =
        JSON.stringify(normalizedNext) !==
        JSON.stringify(normalizeDraftSnapshot(review.draft));

    setClinicalHistoryState({
        draftForm: cloneValue(normalizedNext),
        dirty,
    });
    renderClinicalHistorySection();
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
    const mediaFlowWorkbench = document.getElementById(
        'clinicalMediaFlowWorkbench'
    );
    const compareWorkbench = document.getElementById(
        'clinicalCompareWorkbench'
    );

    const isMediaFlow = activeWorkspace === 'media-flow';
    const isCompare = activeWorkspace === 'compare';
    const isReview = !isMediaFlow && !isCompare;

    if (reviewWorkbench instanceof HTMLElement) {
        reviewWorkbench.hidden = !isReview;
    }
    if (reviewFooter instanceof HTMLElement) {
        reviewFooter.hidden = !isReview;
    }
    if (mediaFlowWorkbench instanceof HTMLElement) {
        mediaFlowWorkbench.hidden = !isMediaFlow;
    }
    if (compareWorkbench instanceof HTMLElement) {
        compareWorkbench.hidden = !isCompare;
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
        const draftActionTarget =
            event.target instanceof Element
                ? event.target.closest('[data-clinical-draft-action]')
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
            if (draftActionTarget instanceof HTMLButtonElement) {
                event.preventDefault();
                const draftAction = normalizeString(
                    draftActionTarget.dataset.clinicalDraftAction
                );
                if (draftAction === 'add-prescription-item') {
                    mutatePrescriptionItems((items) => [
                        ...items,
                        emptyPrescriptionItem(),
                    ]);
                    return;
                }
                if (draftAction === 'remove-prescription-item') {
                    const index = normalizeNumber(
                        draftActionTarget.dataset.prescriptionIndex
                    );
                    mutatePrescriptionItems((items) =>
                        items.filter((_, itemIndex) => itemIndex !== index)
                    );
                    return;
                }
                if (draftAction === 'create-consent-packet-local') {
                    const templateKey =
                        draftActionTarget.dataset.templateKey || 'generic';
                    const packet = createLocalConsentPacket(templateKey);
                    mutateConsentPackets(
                        (items) => [packet, ...items],
                        packet.packetId
                    );
                    return;
                }
                if (draftAction === 'select-consent-packet-local') {
                    mutateConsentPackets(
                        (items) => items,
                        draftActionTarget.dataset.packetId || ''
                    );
                    return;
                }
            }
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

        if (action === 'create-interconsultation') {
            await submitInterconsultationAction('create_interconsultation');
            return;
        }

        if (action === 'create-lab-order') {
            await submitLabOrderAction('create_lab_order');
            return;
        }

        if (action === 'create-imaging-order') {
            await submitImagingOrderAction('create_imaging_order');
            return;
        }

        if (action === 'select-interconsultation') {
            await submitInterconsultationAction(
                'select_interconsultation',
                actionTarget.dataset.interconsultId || ''
            );
            return;
        }

        if (action === 'select-lab-order') {
            await submitLabOrderAction(
                'select_lab_order',
                actionTarget.dataset.labOrderId || ''
            );
            return;
        }

        if (action === 'select-imaging-order') {
            await submitImagingOrderAction(
                'select_imaging_order',
                actionTarget.dataset.imagingOrderId || ''
            );
            return;
        }

        if (action === 'issue-current-interconsultation') {
            await submitInterconsultationAction('issue_interconsultation');
            return;
        }

        if (action === 'issue-current-lab-order') {
            await submitLabOrderAction('issue_lab_order');
            return;
        }

        if (action === 'issue-current-imaging-order') {
            await submitImagingOrderAction('issue_imaging_order');
            return;
        }

        if (action === 'cancel-current-interconsultation') {
            await submitInterconsultationAction('cancel_interconsultation');
            return;
        }

        if (action === 'cancel-current-lab-order') {
            await submitLabOrderAction('cancel_lab_order');
            return;
        }

        if (action === 'cancel-current-imaging-order') {
            await submitImagingOrderAction('cancel_imaging_order');
            return;
        }

        if (action === 'receive-current-imaging-report') {
            await submitImagingOrderAction('receive_imaging_report');
            return;
        }

        if (action === 'receive-current-interconsult-report') {
            await submitInterconsultationAction('receive_interconsult_report');
            return;
        }

        if (action === 'declare-current-consent') {
            await submitConsentPacketAction('declare_consent');
            return;
        }

        if (action === 'deny-current-consent') {
            await submitConsentPacketAction('deny_consent');
            return;
        }

        if (action === 'revoke-current-consent') {
            await submitConsentPacketAction('revoke_consent');
            return;
        }

        if (action === 'request-certified-copy') {
            await submitGovernanceAction('request-certified-copy');
            return;
        }

        if (action === 'export-full-record') {
            await submitGovernanceAction('export-full-record');
            return;
        }

        if (action === 'deliver-care-plan') {
            await submitGovernanceAction('deliver-care-plan');
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

    root.addEventListener('change', async (event) => {
        const target = event.target;

        if (target.id === 'clinical_photo_upload_input') {
            const review = currentReviewSource();
            const caseId = normalizeString(review.session.caseId);
            const patientId = normalizeString(review.session.patientId);
            const zoneSelect = document.getElementById('clinical_photo_zone');
            const bodyZone = zoneSelect ? normalizeString(zoneSelect.value) : '';
            const file = target.files && target.files.length > 0 ? target.files[0] : null;

            if (!caseId) {
                createToast('Debes tener un caso activo.', 'warning');
                target.value = '';
                return;
            }
            if (!bodyZone) {
                createToast('Por favor, selecciona la zona corporal antes de subir la foto.', 'warning');
                target.value = '';
                return;
            }
            if (!file) {
                return;
            }

            try {
                const formData = new FormData();
                formData.append('photo', file);
                formData.append('caseId', caseId);
                formData.append('patientId', patientId);
                formData.append('bodyZone', bodyZone);

                createToast('Subiendo fotografía...', 'info');
                const response = await fetch('/api.php?resource=clinical-media-upload', {
                    method: 'POST',
                    body: formData,
                });
                
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload.error || 'No se pudo subir la foto');
                }

                createToast('Fotografía clínica guardada.', 'success');
                if (zoneSelect) zoneSelect.value = '';
                target.value = '';
                await refreshClinicalHistoryCurrentSession();
            } catch (error) {
                createToast(error.message, 'error');
                target.value = '';
            }
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
    setHtml(
        '#clinicalHistoryDraftForm',
        buildDraftForm(review, draft, slice.saving)
    );
    setHtml('#clinicalHistoryEvents', buildEvents(review));

    syncFollowUpInput();
    syncDraftStatusMeta();
    syncWorkspaceVisibility(activeWorkspace);
    bindClinicalHistoryEvents();
    renderClinicalMediaFlow();
    renderClinicalCompareFlow();
    ensureSessionSelection();
}
