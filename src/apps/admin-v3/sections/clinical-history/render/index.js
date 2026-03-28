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

function normalizeAdmission001(source, fallbackPatient = {}, fallbackIntake = {}) {
    const defaults = emptyAdmission001();
    const safeSource = source && typeof source === 'object' ? source : {};
    const facts =
        fallbackIntake?.datosPaciente && typeof fallbackIntake.datosPaciente === 'object'
            ? fallbackIntake.datosPaciente
            : {};
    const patient = normalizePatient(fallbackPatient);
    const identity = safeSource.identity && typeof safeSource.identity === 'object'
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
        identity.documentType || patient.documentType || defaults.identity.documentType
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
                demographics.birthDate || facts.fechaNacimiento || patient.birthDate
            ),
            ageYears: normalizeNullableInt(
                demographics.ageYears || facts.edadAnios || patient.ageYears
            ),
            sexAtBirth: normalizeString(
                demographics.sexAtBirth || facts.sexoBiologico || patient.sexAtBirth
            ),
            maritalStatus: normalizeString(demographics.maritalStatus),
            educationLevel: normalizeString(demographics.educationLevel),
            occupation: normalizeString(demographics.occupation),
            employer: normalizeString(demographics.employer),
            nationalityCountry: normalizeString(demographics.nationalityCountry),
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
            phone: normalizeString(residence.phone || facts.telefono || patient.phone),
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
    const hasInsurance =
        normalizeString(coverage.healthInsuranceType) !== '';
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
        admission001: normalizeAdmission001(
            admissionSource,
            {},
            intakeSource
        ),
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

    return {
        ...snapshot,
        admission001,
        clinicianDraft,
        intake: {
            ...(snapshot.intake || {}),
            datosPaciente: patientFacts,
        },
        documents,
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
                  changeLog: normalizeList(
                      source.patientRecord.changeLog
                  ).map(normalizeAdmissionChangeItem),
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
    const hcu001Status = hcu001StatusMeta(readiness.hcu001Status?.status);
    const hcu005Status = hcu005StatusMeta(readiness.hcu005Status?.status);
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
        item.hcu001Label || '',
        item.hcu005Label || '',
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
            item.hcu001Summary ||
            item.hcu005Summary ||
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
    ]
        .filter(Boolean)
        .join(' • ');

    return (
        headerMeta ||
        'Selecciona un caso para revisar la nota viva y la aptitud medico-legal.'
    );
}

function buildClinicalStatusMetaText(draft, pendingAiStatus, meta) {
    const admission = normalizeAdmission001(draft.admission001, {}, draft.intake);
    const hcu001Status = hcu001StatusMeta(
        evaluateHcu001(admission, {
            intake: draft.intake,
        }).status
    );
    const hcu005Status = hcu005StatusMeta(
        evaluateHcu005(draft.clinicianDraft.hcu005).status
    );
    const statusMeta = [
        pendingAiStatus,
        hcu001Status.label,
        hcu005Status.label,
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
            `
    );
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
            ${buildClinicalHistoryHcu005Section(draft, disabled, reviewReasons)}
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

    setText('#clinicalHistoryDraftMeta', buildDraftMetaText(slice, review, draft));
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
            maritalStatus: readValue(
                'admission_demographics_marital_status'
            ),
            educationLevel: readValue(
                'admission_demographics_education_level'
            ),
            occupation: readValue('admission_demographics_occupation'),
            employer: readValue('admission_demographics_employer'),
            nationalityCountry: readValue(
                'admission_demographics_nationality_country'
            ),
            culturalGroup: readValue(
                'admission_demographics_cultural_group'
            ),
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
        },
        prescription: {
            ...snapshot.documents.prescription,
        },
        certificate: {
            ...snapshot.documents.certificate,
            summary: readValue('document_certificate_summary'),
            restDays: readValue('document_certificate_rest_days'),
        },
    });

    snapshot.requiresHumanReview = readChecked('requires_human_review');
    return synchronizeDraftClinicalState(snapshot);
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
            admission001: cloneValue(draft.admission001),
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
    setHtml(
        '#clinicalHistoryDraftForm',
        buildDraftForm(review, draft, slice.saving)
    );
    setHtml('#clinicalHistoryEvents', buildEvents(review));

    syncFollowUpInput();
    syncDraftStatusMeta();
    syncWorkspaceVisibility(activeWorkspace);
    bindClinicalHistoryEvents();
    ensureSessionSelection();
}
