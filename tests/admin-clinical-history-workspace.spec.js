// @ts-check
const { test, expect } = require('@playwright/test');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');
const { installBasicAdminApiMocks } = require('./helpers/admin-api-mocks');

test.use({
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 960 },
});

async function waitForAdminRuntimeReady(page) {
    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ready',
        'true'
    );
}

function buildLegalNameParts(patientName) {
    const tokens = String(patientName || 'Paciente Clinico')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    return {
        primerNombre: tokens[0] || 'Paciente',
        segundoNombre: tokens[2] || '',
        apellidoPaterno: tokens[1] || tokens[0] || 'Clinico',
        apellidoMaterno: tokens[3] || '',
    };
}

function buildAdmission001Fixture(
    patientName,
    sessionId,
    caseId,
    status,
    overrides = {}
) {
    const names = buildLegalNameParts(patientName);
    const transitionMode =
        status === 'legacy_partial' ? 'legacy_inferred' : 'new_required';

    return {
        identity: {
            documentType: 'cedula',
            documentNumber: '0912345678',
            apellidoPaterno: names.apellidoPaterno,
            apellidoMaterno: names.apellidoMaterno,
            primerNombre: names.primerNombre,
            segundoNombre: names.segundoNombre,
            ...(overrides.identity || {}),
        },
        demographics: {
            birthDate: '1992-04-10',
            ageYears: 34,
            sexAtBirth: 'femenino',
            maritalStatus: 'soltera',
            educationLevel: 'superior',
            occupation: 'Paciente ambulatoria',
            employer: '',
            nationalityCountry: 'Ecuador',
            culturalGroup: '',
            birthPlace: 'Quito',
            ...(overrides.demographics || {}),
        },
        residence: {
            addressLine: 'Av. Siempre Viva 123',
            neighborhood: 'Centro norte',
            zoneType: 'urban',
            parish: 'Inaquito',
            canton: 'Quito',
            province: 'Pichincha',
            phone: '0990001111',
            ...(overrides.residence || {}),
        },
        coverage: {
            healthInsuranceType: 'private',
            ...(overrides.coverage || {}),
        },
        referral: {
            referredBy: 'Consulta espontanea',
            ...(overrides.referral || {}),
        },
        emergencyContact: {
            name: 'Contacto principal',
            kinship: 'Hermana',
            phone: '0981112233',
            ...(overrides.emergencyContact || {}),
        },
        admissionMeta: {
            admissionDate: '2026-03-15T08:45:00-05:00',
            admissionKind: 'first',
            admittedBy: 'Recepcion FlowOS',
            transitionMode,
            ...(overrides.admissionMeta || {}),
        },
        history: {
            admissionHistory: Array.isArray(overrides.history?.admissionHistory)
                ? overrides.history.admissionHistory
                : [
                      {
                          entryId: `adm-${sessionId}`,
                          episodeId: `ep-${sessionId}`,
                          caseId,
                          admissionDate: '2026-03-15T08:45:00-05:00',
                          admissionKind: 'first',
                          admittedBy: 'Recepcion FlowOS',
                          createdAt: '2026-03-15T08:45:00-05:00',
                      },
                  ],
            changeLog: Array.isArray(overrides.history?.changeLog)
                ? overrides.history.changeLog
                : [],
        },
    };
}

function buildHcu024StatusFixture(status) {
    switch (status) {
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
        case 'incomplete':
            return {
                status: 'incomplete',
                label: 'HCU-024 incompleto',
                summary:
                    'El consentimiento por procedimiento todavía no cubre todos los campos del formulario.',
            };
        case 'draft':
            return {
                status: 'draft',
                label: 'HCU-024 borrador',
                summary:
                    'Existe un consentimiento por procedimiento aún en borrador.',
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

function buildHcu007StatusFixture(status) {
    switch (status) {
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
                    'La interconsulta ya cubre los campos mínimos del MSP y está lista para emitirse.',
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
                    'Existe una interconsulta requerida con campos clínicos todavía incompletos.',
            };
        case 'draft':
            return {
                status: 'draft',
                label: 'HCU-007 borrador',
                summary:
                    'Existe una interconsulta en borrador que aún no se ha emitido.',
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

function buildHcu010AStatusFixture(status) {
    switch (status) {
        case 'issued':
            return {
                status: 'issued',
                label: 'HCU-010A emitida',
                summary:
                    'La solicitud de laboratorio ya fue emitida como soporte diagnostico del episodio.',
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
                    'La solicitud de laboratorio fue cancelada y ya no bloquea el plan actual.',
            };
        case 'incomplete':
            return {
                status: 'incomplete',
                label: 'HCU-010A incompleta',
                summary:
                    'La solicitud de laboratorio sigue con campos clinicos o tecnicos incompletos.',
            };
        case 'draft':
            return {
                status: 'draft',
                label: 'HCU-010A borrador',
                summary:
                    'Existe una solicitud de laboratorio en borrador aun sin emitir.',
            };
        default:
            return {
                status: 'not_applicable',
                label: 'HCU-010A no aplica',
                summary:
                    'No hay solicitud de laboratorio formal exigible para este episodio.',
            };
    }
}

function buildHcu012AStatusFixture(status) {
    switch (status) {
        case 'issued':
            return {
                status: 'issued',
                label: 'HCU-012A emitida',
                summary:
                    'La solicitud de imagenologia ya fue emitida como soporte diagnostico del episodio.',
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
                    'La solicitud de imagenologia fue cancelada y ya no bloquea el plan actual.',
            };
        case 'incomplete':
            return {
                status: 'incomplete',
                label: 'HCU-012A incompleta',
                summary:
                    'La solicitud de imagenologia sigue con campos clinicos o logisticos incompletos.',
            };
        case 'draft':
            return {
                status: 'draft',
                label: 'HCU-012A borrador',
                summary:
                    'Existe una solicitud de imagenologia en borrador aun sin emitir.',
            };
        default:
            return {
                status: 'not_applicable',
                label: 'HCU-012A no aplica',
                summary:
                    'No hay solicitud de imagenologia formal exigible para este episodio.',
            };
    }
}

function buildLabOrderFixture(
    patientName,
    sessionId,
    admission001,
    hcu005,
    overrides = {}
) {
    return {
        labOrderId: overrides.labOrderId || `lab-order-${sessionId}-001`,
        status: overrides.status || 'draft',
        requiredForCurrentPlan: overrides.requiredForCurrentPlan === true,
        priority: overrides.priority || 'routine',
        requestedAt: overrides.requestedAt || '2026-03-15T09:18:00-05:00',
        sampleDate: overrides.sampleDate || '',
        requestingEstablishment:
            overrides.requestingEstablishment || 'Piel Armonía',
        requestingService:
            overrides.requestingService || 'Dermatología ambulatoria',
        careSite: overrides.careSite || 'Consulta externa',
        bedLabel: overrides.bedLabel || '',
        requestedBy: overrides.requestedBy || 'Dra. Laura Mena',
        patientName,
        patientDocumentNumber:
            overrides.patientDocumentNumber ||
            admission001.identity.documentNumber,
        patientRecordId: overrides.patientRecordId || `hcu-${sessionId}`,
        patientAgeYears:
            overrides.patientAgeYears || admission001.demographics.ageYears,
        patientSexAtBirth:
            overrides.patientSexAtBirth || admission001.demographics.sexAtBirth,
        diagnoses: Array.isArray(overrides.diagnoses)
            ? overrides.diagnoses
            : [
                  {
                      type: 'pre',
                      label:
                          overrides.diagnosisLabel ||
                          hcu005.diagnosticImpression ||
                          'Diagnóstico clínico en evaluación',
                      cie10: overrides.diagnosisCie10 || 'L71.9',
                  },
              ],
        studySelections: {
            hematology: Array.isArray(overrides.studySelections?.hematology)
                ? overrides.studySelections.hematology
                : [],
            urinalysis: Array.isArray(overrides.studySelections?.urinalysis)
                ? overrides.studySelections.urinalysis
                : [],
            coprological: Array.isArray(overrides.studySelections?.coprological)
                ? overrides.studySelections.coprological
                : [],
            bloodChemistry: Array.isArray(
                overrides.studySelections?.bloodChemistry
            )
                ? overrides.studySelections.bloodChemistry
                : [],
            serology: Array.isArray(overrides.studySelections?.serology)
                ? overrides.studySelections.serology
                : [],
            bacteriology: Array.isArray(overrides.studySelections?.bacteriology)
                ? overrides.studySelections.bacteriology
                : [],
            others: overrides.studySelections?.others || '',
        },
        bacteriologySampleSource: overrides.bacteriologySampleSource || '',
        physicianPresentAtExam: overrides.physicianPresentAtExam === true,
        notes: overrides.notes || '',
        issuedAt: overrides.issuedAt || '',
        cancelledAt: overrides.cancelledAt || '',
        cancelReason: overrides.cancelReason || '',
        history: Array.isArray(overrides.history) ? overrides.history : [],
        createdAt: overrides.createdAt || '2026-03-15T09:18:00-05:00',
        updatedAt: overrides.updatedAt || '2026-03-15T09:18:00-05:00',
    };
}

function buildImagingOrderFixture(
    patientName,
    sessionId,
    admission001,
    hcu005,
    overrides = {}
) {
    return {
        imagingOrderId:
            overrides.imagingOrderId || `img-order-${sessionId}-001`,
        status: overrides.status || 'draft',
        requiredForCurrentPlan: overrides.requiredForCurrentPlan === true,
        priority: overrides.priority || 'routine',
        requestedAt: overrides.requestedAt || '2026-03-15T09:24:00-05:00',
        studyDate: overrides.studyDate || '',
        requestingEstablishment:
            overrides.requestingEstablishment || 'Piel Armonía',
        requestingService:
            overrides.requestingService || 'Dermatología ambulatoria',
        careSite: overrides.careSite || 'Consulta externa',
        bedLabel: overrides.bedLabel || '',
        requestedBy: overrides.requestedBy || 'Dra. Laura Mena',
        patientName,
        patientDocumentNumber:
            overrides.patientDocumentNumber ||
            admission001.identity.documentNumber,
        patientRecordId: overrides.patientRecordId || `hcu-${sessionId}`,
        patientAgeYears:
            overrides.patientAgeYears || admission001.demographics.ageYears,
        patientSexAtBirth:
            overrides.patientSexAtBirth ||
            admission001.demographics.sexAtBirth,
        diagnoses: Array.isArray(overrides.diagnoses)
            ? overrides.diagnoses
            : [
                  {
                      type: 'pre',
                      label:
                          overrides.diagnosisLabel ||
                          hcu005.diagnosticImpression ||
                          'Diagnóstico clínico en evaluación',
                      cie10: overrides.diagnosisCie10 || 'L71.9',
                  },
              ],
        studySelections: {
            conventionalRadiography: Array.isArray(
                overrides.studySelections?.conventionalRadiography
            )
                ? overrides.studySelections.conventionalRadiography
                : [],
            tomography: Array.isArray(overrides.studySelections?.tomography)
                ? overrides.studySelections.tomography
                : [],
            magneticResonance: Array.isArray(
                overrides.studySelections?.magneticResonance
            )
                ? overrides.studySelections.magneticResonance
                : [],
            ultrasound: Array.isArray(overrides.studySelections?.ultrasound)
                ? overrides.studySelections.ultrasound
                : [],
            procedures: Array.isArray(overrides.studySelections?.procedures)
                ? overrides.studySelections.procedures
                : [],
            others: Array.isArray(overrides.studySelections?.others)
                ? overrides.studySelections.others
                : [],
        },
        requestReason:
            overrides.requestReason || 'Solicito imagenologia de apoyo clinico.',
        clinicalSummary:
            overrides.clinicalSummary ||
            [
                hcu005.evolutionNote,
                hcu005.therapeuticPlan,
                hcu005.careIndications,
            ]
                .filter(Boolean)
                .join('\n'),
        canMobilize:
            overrides.canMobilize === undefined ? true : overrides.canMobilize,
        canRemoveDressingsOrCasts:
            overrides.canRemoveDressingsOrCasts === undefined
                ? true
                : overrides.canRemoveDressingsOrCasts,
        physicianPresentAtExam:
            overrides.physicianPresentAtExam === true,
        bedsideRadiography: overrides.bedsideRadiography === true,
        notes: overrides.notes || '',
        issuedAt: overrides.issuedAt || '',
        cancelledAt: overrides.cancelledAt || '',
        cancelReason: overrides.cancelReason || '',
        history: Array.isArray(overrides.history) ? overrides.history : [],
        createdAt: overrides.createdAt || '2026-03-15T09:24:00-05:00',
        updatedAt: overrides.updatedAt || '2026-03-15T09:24:00-05:00',
    };
}

function buildInterconsultationFixture(
    patientName,
    sessionId,
    admission001,
    hcu005,
    overrides = {}
) {
    return {
        interconsultId:
            overrides.interconsultId || `interconsult-${sessionId}-001`,
        status: overrides.status || 'draft',
        requiredForCurrentPlan: overrides.requiredForCurrentPlan === true,
        priority: overrides.priority || 'routine',
        requestedAt: overrides.requestedAt || '2026-03-15T09:12:00-05:00',
        requestingEstablishment:
            overrides.requestingEstablishment || 'Piel Armonía',
        requestingService:
            overrides.requestingService || 'Dermatología ambulatoria',
        destinationEstablishment: overrides.destinationEstablishment || '',
        destinationService: overrides.destinationService || '',
        consultedProfessionalName: overrides.consultedProfessionalName || '',
        patientName,
        patientDocumentNumber:
            overrides.patientDocumentNumber ||
            admission001.identity.documentNumber,
        patientRecordId: overrides.patientRecordId || `hcu-${sessionId}`,
        patientAgeYears:
            overrides.patientAgeYears || admission001.demographics.ageYears,
        patientSexAtBirth:
            overrides.patientSexAtBirth || admission001.demographics.sexAtBirth,
        clinicalPicture:
            overrides.clinicalPicture || hcu005.evolutionNote || '',
        requestReason:
            overrides.requestReason ||
            'Valoración complementaria especializada.',
        diagnoses: Array.isArray(overrides.diagnoses)
            ? overrides.diagnoses
            : [
                  {
                      type: 'pre',
                      label:
                          overrides.diagnosisLabel ||
                          hcu005.diagnosticImpression ||
                          'Diagnóstico en evaluación',
                      cie10: overrides.diagnosisCie10 || 'L71.9',
                  },
              ],
        performedDiagnosticsSummary:
            overrides.performedDiagnosticsSummary ||
            'Evaluación clínica y dermatoscópica ambulatoria.',
        therapeuticMeasuresDone:
            overrides.therapeuticMeasuresDone ||
            hcu005.therapeuticPlan ||
            hcu005.careIndications ||
            '',
        questionForConsultant:
            overrides.questionForConsultant ||
            'Solicito criterio complementario de especialidad.',
        issuedBy: overrides.issuedBy || 'Dra. Laura Mena',
        issuedAt: overrides.issuedAt || '',
        cancelledAt: overrides.cancelledAt || '',
        cancelReason: overrides.cancelReason || '',
        reportStatus: overrides.reportStatus || 'not_received',
        report: {
            status: overrides.report?.status || 'not_received',
            reportedAt: overrides.report?.reportedAt || '',
            reportedBy: overrides.report?.reportedBy || '',
            receivedBy: overrides.report?.receivedBy || '',
            respondingEstablishment:
                overrides.report?.respondingEstablishment ||
                overrides.destinationEstablishment ||
                '',
            respondingService:
                overrides.report?.respondingService ||
                overrides.destinationService ||
                '',
            consultantProfessionalName:
                overrides.report?.consultantProfessionalName ||
                overrides.consultedProfessionalName ||
                '',
            consultantProfessionalRole:
                overrides.report?.consultantProfessionalRole || '',
            reportSummary: overrides.report?.reportSummary || '',
            clinicalFindings: overrides.report?.clinicalFindings || '',
            diagnosticOpinion: overrides.report?.diagnosticOpinion || '',
            recommendations: overrides.report?.recommendations || '',
            followUpIndications: overrides.report?.followUpIndications || '',
            sourceDocumentType: overrides.report?.sourceDocumentType || '',
            sourceReference: overrides.report?.sourceReference || '',
            attachments: Array.isArray(overrides.report?.attachments)
                ? overrides.report.attachments
                : [],
            history: Array.isArray(overrides.report?.history)
                ? overrides.report.history
                : [],
            createdAt: overrides.report?.createdAt || '',
            updatedAt: overrides.report?.updatedAt || '',
        },
        history: Array.isArray(overrides.history) ? overrides.history : [],
        createdAt: overrides.createdAt || '2026-03-15T09:12:00-05:00',
        updatedAt: overrides.updatedAt || '2026-03-15T09:12:00-05:00',
    };
}

function buildConsentPacketFixture(
    patientName,
    sessionId,
    admission001,
    consent = {},
    overrides = {}
) {
    const status =
        overrides.status ||
        consent.status ||
        (consent.required === true ? 'draft' : 'not_applicable');

    return {
        packetId: overrides.packetId || `consent-${sessionId}-001`,
        templateKey: overrides.templateKey || 'laser-dermatologico',
        procedureKey: overrides.procedureKey || 'laser-dermatologico',
        procedureLabel: overrides.procedureLabel || 'Láser dermatológico',
        title: overrides.title || 'Consentimiento informado HCU-form.024/2008',
        sourceMode: overrides.sourceMode || 'fixture',
        status,
        writtenRequired: overrides.writtenRequired ?? consent.required === true,
        careMode: overrides.careMode || 'ambulatorio',
        serviceLabel: overrides.serviceLabel || 'Dermatología ambulatoria',
        establishmentLabel: overrides.establishmentLabel || 'Piel Armonía',
        patientName,
        patientDocumentNumber:
            overrides.patientDocumentNumber ||
            admission001.identity.documentNumber,
        patientRecordId: overrides.patientRecordId || `hcu-${sessionId}`,
        encounterDateTime:
            overrides.encounterDateTime || '2026-03-15T09:05:00-05:00',
        diagnosisLabel:
            overrides.diagnosisLabel ||
            'Rosacea inflamatoria en control clinico.',
        diagnosisCie10: overrides.diagnosisCie10 || 'L71.9',
        procedureName:
            overrides.procedureName || 'Aplicación de láser dermatológico',
        procedureWhatIsIt:
            overrides.procedureWhatIsIt ||
            consent.explainedWhat ||
            'Aplicación de energía lumínica controlada sobre la piel.',
        procedureHowItIsDone:
            overrides.procedureHowItIsDone ||
            'Se delimita el área, se protege al paciente y se aplica el equipo según plan clínico.',
        durationEstimate:
            overrides.durationEstimate ||
            '20 a 30 minutos según zonas tratadas',
        graphicRef: overrides.graphicRef || '',
        benefits:
            overrides.benefits ||
            'Mejoría clínica del motivo de consulta y apoyo al plan dermatológico.',
        frequentRisks:
            overrides.frequentRisks ||
            consent.risksExplained ||
            'Eritema, ardor transitorio y sensibilidad local.',
        rareSeriousRisks:
            overrides.rareSeriousRisks ||
            'Quemadura, discromía persistente o cicatriz.',
        patientSpecificRisks:
            overrides.patientSpecificRisks ||
            'Riesgo de hiperpigmentación postinflamatoria.',
        alternatives:
            overrides.alternatives ||
            consent.alternativesExplained ||
            'Observación clínica, tratamiento tópico o diferir el procedimiento.',
        postProcedureCare:
            overrides.postProcedureCare ||
            'Fotoprotección, hidratación y control clínico posterior.',
        noProcedureConsequences:
            overrides.noProcedureConsequences ||
            'Persistencia del problema cutáneo o necesidad de otras alternativas.',
        privateCommunicationConfirmed:
            overrides.privateCommunicationConfirmed ??
            consent.privateCommunicationConfirmed === true,
        companionShareAuthorized:
            overrides.companionShareAuthorized ??
            consent.companionShareAuthorized === true,
        declaration: {
            declaredAt:
                overrides.declaration?.declaredAt ||
                consent.informedAt ||
                '2026-03-15T09:08:00-05:00',
            patientCanConsent:
                overrides.declaration?.patientCanConsent !== false,
            capacityAssessment:
                overrides.declaration?.capacityAssessment ||
                consent.capacityAssessment ||
                'Paciente capaz de decidir',
            notes: overrides.declaration?.notes || consent.notes || '',
        },
        denial: {
            declinedAt: overrides.denial?.declinedAt || '',
            reason: overrides.denial?.reason || '',
            patientRefusedSignature:
                overrides.denial?.patientRefusedSignature === true,
            notes: overrides.denial?.notes || '',
        },
        revocation: {
            revokedAt: overrides.revocation?.revokedAt || '',
            receivedBy: overrides.revocation?.receivedBy || '',
            reason: overrides.revocation?.reason || '',
            notes: overrides.revocation?.notes || '',
        },
        patientAttestation: {
            name: overrides.patientAttestation?.name || patientName,
            documentNumber:
                overrides.patientAttestation?.documentNumber ||
                admission001.identity.documentNumber,
            signedAt:
                overrides.patientAttestation?.signedAt ||
                consent.acceptedAt ||
                '',
            refusedSignature:
                overrides.patientAttestation?.refusedSignature === true,
        },
        representativeAttestation: {
            name: overrides.representativeAttestation?.name || '',
            kinship: overrides.representativeAttestation?.kinship || '',
            documentNumber:
                overrides.representativeAttestation?.documentNumber || '',
            phone: overrides.representativeAttestation?.phone || '',
            signedAt: overrides.representativeAttestation?.signedAt || '',
        },
        professionalAttestation: {
            name:
                overrides.professionalAttestation?.name ||
                consent.informedBy ||
                'Dra. Laura Mena',
            role: overrides.professionalAttestation?.role || 'medico_tratante',
            documentNumber:
                overrides.professionalAttestation?.documentNumber || 'MED-001',
            signedAt: overrides.professionalAttestation?.signedAt || '',
        },
        anesthesiologistAttestation: {
            applicable:
                overrides.anesthesiologistAttestation?.applicable === true,
            name: overrides.anesthesiologistAttestation?.name || '',
            documentNumber:
                overrides.anesthesiologistAttestation?.documentNumber || '',
            signedAt: overrides.anesthesiologistAttestation?.signedAt || '',
        },
        witnessAttestation: {
            name: overrides.witnessAttestation?.name || '',
            documentNumber: overrides.witnessAttestation?.documentNumber || '',
            phone: overrides.witnessAttestation?.phone || '',
            signedAt: overrides.witnessAttestation?.signedAt || '',
        },
        history: Array.isArray(overrides.history) ? overrides.history : [],
        createdAt: overrides.createdAt || '2026-03-15T09:00:00-05:00',
        updatedAt: overrides.updatedAt || '2026-03-15T09:10:00-05:00',
    };
}

function buildClinicalRecordPayload({
    sessionId,
    caseId,
    patientName,
    clinicianSummary,
    legalReadiness,
    approval,
    documents = {},
    admission001 = {},
    consent = {},
    consentPackets = [],
    activeConsentPacketId = '',
    interconsultations = [],
    activeInterconsultationId = '',
    labOrders = [],
    activeLabOrderId = '',
    imagingOrders = [],
    activeImagingOrderId = '',
    copyRequests = [],
    disclosureLog = [],
    accessAudit = [],
    archiveReadiness = {},
    recordsGovernance = {},
}) {
    const normalizedHcu001Status = legalReadiness.hcu001Status || {
        status: 'complete',
        label: 'HCU-001 completa',
        summary:
            'La admision longitudinal ya deja identidad y contacto base defendibles.',
    };
    const normalizedAdmission001 = buildAdmission001Fixture(
        patientName,
        sessionId,
        caseId,
        normalizedHcu001Status.status,
        admission001
    );
    const normalizedConsentPackets =
        Array.isArray(consentPackets) && consentPackets.length > 0
            ? consentPackets
            : consent.required === true
              ? [
                    buildConsentPacketFixture(
                        patientName,
                        sessionId,
                        normalizedAdmission001,
                        consent
                    ),
                ]
              : [];
    const normalizedActiveConsentPacketId =
        activeConsentPacketId || normalizedConsentPackets[0]?.packetId || '';
    const normalizedActiveConsentPacket =
        normalizedConsentPackets.find(
            (packet) => packet.packetId === normalizedActiveConsentPacketId
        ) || null;
    const normalizedConsentForms = Array.isArray(documents.consentForms)
        ? documents.consentForms
        : normalizedConsentPackets.filter((packet) =>
              ['accepted', 'declined', 'revoked'].includes(packet.status)
          );
    const normalizedHcu024Status =
        legalReadiness.hcu024Status ||
        buildHcu024StatusFixture(
            normalizedActiveConsentPacket?.status ||
                (consent.required === true ? 'draft' : 'not_applicable')
        );
    const normalizedHcu005 = {
        evolutionNote:
            documents.finalNote?.sections?.hcu005?.evolutionNote ||
            clinicianSummary ||
            '',
        diagnosticImpression:
            documents.finalNote?.sections?.hcu005?.diagnosticImpression ||
            (legalReadiness.status === 'ready'
                ? 'Rosacea inflamatoria en control clinico.'
                : ''),
        therapeuticPlan:
            documents.finalNote?.sections?.hcu005?.therapeuticPlan ||
            (legalReadiness.status === 'ready'
                ? 'Mantener manejo topico y control clinico.'
                : ''),
        careIndications:
            documents.finalNote?.sections?.hcu005?.careIndications ||
            (legalReadiness.status === 'ready'
                ? 'Evitar desencadenantes, fotoproteccion y reevaluacion.'
                : ''),
        prescriptionItems: Array.isArray(
            documents.prescription?.items ||
                documents.finalNote?.sections?.hcu005?.prescriptionItems
        )
            ? documents.prescription?.items ||
              documents.finalNote?.sections?.hcu005?.prescriptionItems
            : legalReadiness.status === 'ready'
              ? [
                    {
                        medication: 'Metronidazol topico',
                        presentation: 'Gel 0.75%',
                        dose: 'Aplicacion fina',
                        route: 'Topica',
                        frequency: 'Nocturna',
                        duration: '8 semanas',
                        quantity: '1 tubo',
                        instructions:
                            'Aplicar sobre piel limpia y reevaluar al finalizar.',
                    },
                ]
              : [],
    };
    const normalizedInterconsultations = Array.isArray(interconsultations)
        ? interconsultations
        : [];
    const normalizedActiveInterconsultationId =
        activeInterconsultationId ||
        normalizedInterconsultations[0]?.interconsultId ||
        '';
    const normalizedActiveInterconsultation =
        normalizedInterconsultations.find(
            (item) =>
                item.interconsultId === normalizedActiveInterconsultationId
        ) || null;
    const normalizedInterconsultForms = Array.isArray(
        documents.interconsultForms
    )
        ? documents.interconsultForms
        : normalizedInterconsultations.filter((item) =>
              ['issued', 'cancelled'].includes(item.status)
          );
    const normalizedInterconsultReports = Array.isArray(
        documents.interconsultReports
    )
        ? documents.interconsultReports
        : normalizedInterconsultations
              .filter((item) => item.reportStatus === 'received')
              .map((item) => ({
                  interconsultId: item.interconsultId,
                  interconsultStatus: item.status,
                  destinationEstablishment: item.destinationEstablishment,
                  destinationService: item.destinationService,
                  consultedProfessionalName: item.consultedProfessionalName,
                  reportStatus: 'received',
                  finalizedAt: item.report?.reportedAt || '',
                  snapshotAt: item.report?.reportedAt || '',
                  report: item.report,
              }));
    const normalizedHcu007Status =
        legalReadiness.hcu007Status ||
        buildHcu007StatusFixture(
            normalizedActiveInterconsultation?.status ||
                (normalizedInterconsultations.length > 0
                    ? 'draft'
                    : 'not_applicable')
        );
    const normalizedHcu007ReportStatus = legalReadiness.hcu007ReportStatus || {
        status:
            normalizedActiveInterconsultation?.reportStatus || 'not_received',
        label:
            normalizedActiveInterconsultation?.reportStatus === 'received'
                ? 'Informe del consultado recibido'
                : normalizedActiveInterconsultation?.reportStatus ===
                    'ready_to_receive'
                  ? 'Informe listo para recibir'
                  : normalizedActiveInterconsultation?.reportStatus === 'draft'
                    ? 'Informe del consultado en borrador'
                    : 'Informe del consultado no recibido',
        summary:
            normalizedActiveInterconsultation?.reportStatus === 'received'
                ? 'El informe del consultado ya quedó capturado y anexado al episodio.'
                : normalizedActiveInterconsultation?.reportStatus ===
                    'ready_to_receive'
                  ? 'El informe del consultado ya cubre los campos mínimos para recepción formal.'
                  : normalizedActiveInterconsultation?.reportStatus === 'draft'
                    ? 'Existe un borrador del informe del consultado aún sin recepción formal.'
                    : 'Todavía no se ha recibido informe del consultado.',
    };
    const normalizedLabOrders = Array.isArray(labOrders) ? labOrders : [];
    const normalizedActiveLabOrderId =
        activeLabOrderId || normalizedLabOrders[0]?.labOrderId || '';
    const normalizedActiveLabOrder =
        normalizedLabOrders.find(
            (item) => item.labOrderId === normalizedActiveLabOrderId
        ) || null;
    const normalizedLabOrderSnapshots = Array.isArray(documents.labOrders)
        ? documents.labOrders
        : normalizedLabOrders
              .filter((item) => ['issued', 'cancelled'].includes(item.status))
              .map((item) => ({
                  labOrderId: item.labOrderId,
                  status: item.status,
                  finalizedAt:
                      item.issuedAt || item.cancelledAt || item.updatedAt || '',
                  snapshotAt:
                      item.issuedAt || item.cancelledAt || item.updatedAt || '',
                  patientName: item.patientName,
                  patientDocumentNumber: item.patientDocumentNumber,
                  patientRecordId: item.patientRecordId,
                  sampleDate: item.sampleDate,
                  priority: item.priority,
                  requestedBy: item.requestedBy,
                  diagnoses: item.diagnoses,
                  studySelections: item.studySelections,
                  notes: item.notes,
              }));
    const normalizedHcu010AStatus =
        legalReadiness.hcu010AStatus ||
        buildHcu010AStatusFixture(
            normalizedActiveLabOrder?.status ||
                (normalizedLabOrders.length > 0 ? 'draft' : 'not_applicable')
        );
    const normalizedImagingOrders = Array.isArray(imagingOrders)
        ? imagingOrders
        : [];
    const normalizedActiveImagingOrderId =
        activeImagingOrderId ||
        normalizedImagingOrders[0]?.imagingOrderId ||
        '';
    const normalizedActiveImagingOrder =
        normalizedImagingOrders.find(
            (item) =>
                item.imagingOrderId === normalizedActiveImagingOrderId
        ) || null;
    const normalizedImagingOrderSnapshots = Array.isArray(documents.imagingOrders)
        ? documents.imagingOrders
        : normalizedImagingOrders
              .filter((item) => ['issued', 'cancelled'].includes(item.status))
              .map((item) => ({
                  imagingOrderId: item.imagingOrderId,
                  status: item.status,
                  finalizedAt:
                      item.issuedAt || item.cancelledAt || item.updatedAt || '',
                  snapshotAt:
                      item.issuedAt || item.cancelledAt || item.updatedAt || '',
                  patientName: item.patientName,
                  patientDocumentNumber: item.patientDocumentNumber,
                  patientRecordId: item.patientRecordId,
                  studyDate: item.studyDate,
                  priority: item.priority,
                  requestedBy: item.requestedBy,
                  diagnoses: item.diagnoses,
                  studySelections: item.studySelections,
                  requestReason: item.requestReason,
                  clinicalSummary: item.clinicalSummary,
                  notes: item.notes,
              }));
    const normalizedHcu012AStatus =
        legalReadiness.hcu012AStatus ||
        buildHcu012AStatusFixture(
            normalizedActiveImagingOrder?.status ||
                (normalizedImagingOrders.length > 0
                    ? 'draft'
                    : 'not_applicable')
        );
    const prescriptionMedication = normalizedHcu005.prescriptionItems
        .map((item) => item.medication)
        .filter(Boolean)
        .join(', ');
    const prescriptionDirections = normalizedHcu005.prescriptionItems
        .map((item) =>
            [
                item.presentation,
                item.dose,
                item.route,
                item.frequency,
                item.duration,
                item.quantity,
                item.instructions,
            ]
                .filter(Boolean)
                .join(' | ')
        )
        .filter(Boolean)
        .join('\n');
    const normalizedArchiveReadiness = {
        archiveState: 'active',
        lastAttentionAt: '2026-03-15T09:06:00-05:00',
        passiveAfterYears: 5,
        eligibleForPassive: false,
        eligibleAt: '2031-03-15T09:06:00-05:00',
        daysUntilPassive: 1825,
        recommendedState: 'active',
        label: 'Activa',
        overrideRequired: true,
        ...archiveReadiness,
    };
    const normalizedCopyRequests = Array.isArray(copyRequests)
        ? copyRequests
        : [];
    const normalizedDisclosureLog = Array.isArray(disclosureLog)
        ? disclosureLog
        : [];
    const normalizedAccessAudit = Array.isArray(accessAudit) ? accessAudit : [];
    const normalizedRecordsGovernance = {
        archiveState: normalizedArchiveReadiness.archiveState,
        archiveReadiness: normalizedArchiveReadiness,
        copyRequestSummary: {
            total: normalizedCopyRequests.length,
            pending: normalizedCopyRequests.filter(
                (item) => item.effectiveStatus !== 'delivered'
            ).length,
            delivered: normalizedCopyRequests.filter(
                (item) => item.effectiveStatus === 'delivered'
            ).length,
            overdue: normalizedCopyRequests.filter(
                (item) => item.effectiveStatus === 'overdue'
            ).length,
            latestRequest: normalizedCopyRequests[0] || null,
        },
        disclosureSummary: {
            total: normalizedDisclosureLog.length,
            latest: normalizedDisclosureLog[0] || null,
        },
        lastAccessEvent: normalizedAccessAudit[0] || null,
        confidentialityLabel: 'CONFIDENCIAL',
        identityProtectionMode: 'standard',
        ...recordsGovernance,
    };

    return {
        session: {
            sessionId,
            caseId,
            appointmentId: 451,
            surface: 'telemedicine_chat',
            status:
                approval?.status === 'approved'
                    ? 'approved'
                    : 'review_required',
            patient: {
                name: patientName,
                email: `${sessionId}@example.test`,
                phone: normalizedAdmission001.residence.phone,
                ageYears: normalizedAdmission001.demographics.ageYears,
                sexAtBirth: normalizedAdmission001.demographics.sexAtBirth,
                birthDate: normalizedAdmission001.demographics.birthDate,
                documentType: normalizedAdmission001.identity.documentType,
                documentNumber: normalizedAdmission001.identity.documentNumber,
                legalName: patientName,
            },
            transcript: [
                {
                    id: `${sessionId}-msg-1`,
                    role: 'user',
                    actor: 'patient',
                    content: `Paciente ${patientName}: describe brote facial persistente.`,
                    surface: 'telemedicine_chat',
                    createdAt: '2026-03-15T09:00:00-05:00',
                },
                {
                    id: `${sessionId}-msg-2`,
                    role: 'assistant',
                    actor: 'clinical_intake',
                    content:
                        'Se solicita documentar factores desencadenantes y plan de manejo.',
                    surface: 'telemedicine_chat',
                    createdAt: '2026-03-15T09:03:00-05:00',
                },
            ],
            pendingAi: {},
            metadata: {},
            createdAt: '2026-03-15T08:45:00-05:00',
            updatedAt: '2026-03-15T09:04:00-05:00',
            lastMessageAt: '2026-03-15T09:03:00-05:00',
        },
        draft: {
            sessionId,
            caseId,
            appointmentId: 451,
            patientRecordId: `hcu-${sessionId}`,
            episodeId: `ep-${sessionId}`,
            encounterId: `enc-${sessionId}`,
            reviewStatus:
                approval?.status === 'approved'
                    ? 'approved'
                    : 'review_required',
            requiresHumanReview: approval?.status !== 'approved',
            reviewReasons:
                legalReadiness.status === 'ready'
                    ? []
                    : ['legal_blockers_present'],
            confidence: 0.81,
            intake: {
                motivoConsulta: 'Rosacea facial',
                enfermedadActual: 'Brote recurrente con eritema centrofacial.',
                antecedentes:
                    legalReadiness.status === 'ready'
                        ? 'Sin antecedentes dermatologicos de alarma.'
                        : '',
                alergias:
                    legalReadiness.status === 'ready'
                        ? 'Niega alergias medicamentosas.'
                        : '',
                medicacionActual: '',
                rosRedFlags: ['ardor'],
                adjuntos: [
                    {
                        id: 1,
                        kind: 'photo',
                        originalName: 'ana-ruiz-1.jpg',
                        mime: 'image/jpeg',
                        size: 1024,
                        privatePath: '/private/case-001/a1.jpg',
                    },
                ],
                resumenClinico: 'Caso compatible con rosacea inflamatoria.',
                cie10Sugeridos: [],
                tratamientoBorrador: '',
                posologiaBorrador: {
                    texto: '',
                    baseCalculo: '',
                    pesoKg: null,
                    edadAnios: null,
                    units: '',
                    ambiguous: true,
                },
                preguntasFaltantes:
                    legalReadiness.status === 'ready'
                        ? []
                        : ['Alergias actuales'],
                datosPaciente: {
                    edadAnios: normalizedAdmission001.demographics.ageYears,
                    pesoKg: 63,
                    sexoBiologico:
                        normalizedAdmission001.demographics.sexAtBirth,
                    telefono: normalizedAdmission001.residence.phone,
                    fechaNacimiento:
                        normalizedAdmission001.demographics.birthDate,
                    embarazo: false,
                },
            },
            clinicianDraft: {
                resumen:
                    normalizedHcu005.evolutionNote || clinicianSummary || '',
                preguntasFaltantes:
                    legalReadiness.status === 'ready'
                        ? []
                        : ['Confirmar alergias'],
                cie10Sugeridos: ['L71.9'],
                tratamientoBorrador:
                    normalizedHcu005.therapeuticPlan ||
                    'Mantener metronidazol topico',
                posologiaBorrador: {
                    texto:
                        normalizedHcu005.careIndications ||
                        prescriptionDirections ||
                        'Aplicacion nocturna',
                    baseCalculo: 'criterio_clinico',
                    pesoKg: 63,
                    edadAnios: 34,
                    units: '',
                    ambiguous: legalReadiness.status !== 'ready',
                },
                hcu005: normalizedHcu005,
            },
            admission001: normalizedAdmission001,
            recordMeta: {
                archiveState: normalizedArchiveReadiness.archiveState,
                lastAttentionAt: normalizedArchiveReadiness.lastAttentionAt,
                passiveAfterYears: normalizedArchiveReadiness.passiveAfterYears,
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
                    status:
                        approval?.status === 'approved' ? 'approved' : 'draft',
                    summary:
                        documents.finalNote?.summary ||
                        normalizedHcu005.evolutionNote ||
                        'Nota final en preparacion medico-legal.',
                    content:
                        documents.finalNote?.content ||
                        [
                            normalizedHcu005.evolutionNote,
                            normalizedHcu005.diagnosticImpression,
                            normalizedHcu005.therapeuticPlan,
                            normalizedHcu005.careIndications,
                        ]
                            .filter(Boolean)
                            .join('\n\n'),
                    sections: {
                        hcu001: normalizedAdmission001,
                        hcu005: normalizedHcu005,
                    },
                    version: approval?.finalDraftVersion || 1,
                    generatedAt: approval?.approvedAt || '',
                    confidential: true,
                },
                prescription: {
                    status:
                        documents.prescription?.status ||
                        (legalReadiness.status === 'ready' ? 'draft' : 'draft'),
                    medication:
                        documents.prescription?.medication ||
                        prescriptionMedication,
                    directions:
                        documents.prescription?.directions ||
                        prescriptionDirections,
                    items: normalizedHcu005.prescriptionItems,
                    signedAt: approval?.approvedAt || '',
                    confidential: true,
                },
                certificate: {
                    status: documents.certificate?.status || 'draft',
                    summary: documents.certificate?.summary || '',
                    restDays: documents.certificate?.restDays || null,
                    signedAt: approval?.approvedAt || '',
                    confidential: true,
                },
                consentForms: normalizedConsentForms,
                interconsultForms: normalizedInterconsultForms,
                interconsultReports: normalizedInterconsultReports,
                labOrders: normalizedLabOrderSnapshots,
                imagingOrders: normalizedImagingOrderSnapshots,
            },
            labOrders: normalizedLabOrders,
            activeLabOrderId: normalizedActiveLabOrderId,
            imagingOrders: normalizedImagingOrders,
            activeImagingOrderId: normalizedActiveImagingOrderId,
            consentPackets: normalizedConsentPackets,
            activeConsentPacketId: normalizedActiveConsentPacketId,
            interconsultations: normalizedInterconsultations,
            activeInterconsultationId: normalizedActiveInterconsultationId,
            consent: {
                required: consent.required === true,
                status:
                    consent.status ||
                    normalizedActiveConsentPacket?.status ||
                    'not_required',
                informedBy:
                    consent.informedBy ||
                    normalizedActiveConsentPacket?.professionalAttestation
                        ?.name ||
                    '',
                informedAt:
                    consent.informedAt ||
                    normalizedActiveConsentPacket?.declaration?.declaredAt ||
                    '',
                explainedWhat:
                    consent.explainedWhat ||
                    normalizedActiveConsentPacket?.procedureWhatIsIt ||
                    '',
                risksExplained:
                    consent.risksExplained ||
                    normalizedActiveConsentPacket?.frequentRisks ||
                    '',
                alternativesExplained:
                    consent.alternativesExplained ||
                    normalizedActiveConsentPacket?.alternatives ||
                    '',
                capacityAssessment:
                    consent.capacityAssessment ||
                    normalizedActiveConsentPacket?.declaration
                        ?.capacityAssessment ||
                    '',
                privateCommunicationConfirmed:
                    consent.privateCommunicationConfirmed === true ||
                    normalizedActiveConsentPacket?.privateCommunicationConfirmed ===
                        true,
                companionShareAuthorized:
                    consent.companionShareAuthorized === true ||
                    normalizedActiveConsentPacket?.companionShareAuthorized ===
                        true,
                acceptedAt:
                    consent.acceptedAt ||
                    normalizedActiveConsentPacket?.patientAttestation
                        ?.signedAt ||
                    normalizedActiveConsentPacket?.representativeAttestation
                        ?.signedAt ||
                    '',
                declinedAt:
                    consent.declinedAt ||
                    normalizedActiveConsentPacket?.denial?.declinedAt ||
                    '',
                revokedAt:
                    consent.revokedAt ||
                    normalizedActiveConsentPacket?.revocation?.revokedAt ||
                    '',
                notes: consent.notes || '',
            },
            approval: approval || {
                status: 'pending',
                approvedBy: '',
                approvedAt: '',
                finalDraftVersion: null,
                checklistSnapshot: [],
                aiTraceSnapshot: {},
                notes: '',
                normativeSources: [],
            },
            disclosureLog: normalizedDisclosureLog,
            copyRequests: normalizedCopyRequests,
            pendingAi: {},
            updatedAt: '2026-03-15T09:06:00-05:00',
            createdAt: '2026-03-15T08:50:00-05:00',
        },
        events: [
            {
                eventId: `${sessionId}-evt-1`,
                sessionId,
                type: 'clinical_alert',
                severity:
                    legalReadiness.status === 'ready' ? 'info' : 'critical',
                status: legalReadiness.status === 'ready' ? 'resolved' : 'open',
                title:
                    legalReadiness.status === 'ready'
                        ? 'Caso estable para aprobacion'
                        : 'Alerta clinica abierta',
                message:
                    legalReadiness.status === 'ready'
                        ? 'El caso esta alineado para cierre.'
                        : 'Persisten hallazgos que requieren revision.',
                createdAt: '2026-03-15T09:05:00-05:00',
            },
        ],
        patientRecord: {
            recordId: `hcu-${sessionId}`,
            archiveState: normalizedArchiveReadiness.archiveState,
            archiveStatusLabel: normalizedArchiveReadiness.label,
            archiveReadiness: normalizedArchiveReadiness,
            lastAttentionAt: '2026-03-15T09:06:00-05:00',
            patient: {
                name: patientName,
                phone: normalizedAdmission001.residence.phone,
                ageYears: normalizedAdmission001.demographics.ageYears,
                sexAtBirth: normalizedAdmission001.demographics.sexAtBirth,
                birthDate: normalizedAdmission001.demographics.birthDate,
                documentType: normalizedAdmission001.identity.documentType,
                documentNumber: normalizedAdmission001.identity.documentNumber,
                legalName: patientName,
            },
            admission001: normalizedAdmission001,
            admissionHistory: normalizedAdmission001.history.admissionHistory,
            changeLog: normalizedAdmission001.history.changeLog,
            admission001Status: normalizedHcu001Status,
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
        },
        activeEpisode: {
            episodeId: `ep-${sessionId}`,
            caseId,
            status:
                approval?.status === 'approved'
                    ? 'approved'
                    : 'review_required',
            legalStatus: legalReadiness.status,
            legalLabel: legalReadiness.label,
            updatedAt: '2026-03-15T09:06:00-05:00',
        },
        encounter: {
            encounterId: `enc-${sessionId}`,
            appointmentId: 451,
            surface: 'telemedicine_chat',
            startedAt: '2026-03-15T08:45:00-05:00',
            updatedAt: '2026-03-15T09:06:00-05:00',
        },
        liveNote: {
            summary: normalizedHcu005.evolutionNote || clinicianSummary,
            draftVersion: approval?.finalDraftVersion || 1,
            requiresHumanReview: approval?.status !== 'approved',
            reviewStatus:
                approval?.status === 'approved'
                    ? 'approved'
                    : 'review_required',
            hcu001Status: normalizedHcu001Status,
            hcu005Status:
                legalReadiness.hcu005Status?.status ||
                (legalReadiness.status === 'ready' ? 'complete' : 'partial'),
            hcu007Status: normalizedHcu007Status.status,
            hcu010AStatus: normalizedHcu010AStatus.status,
            hcu012AStatus: normalizedHcu012AStatus.status,
            hcu024Status: normalizedHcu024Status.status,
        },
        documents: {
            finalNote: {
                status: approval?.status === 'approved' ? 'approved' : 'draft',
                summary:
                    documents.finalNote?.summary ||
                    normalizedHcu005.evolutionNote ||
                    'Nota final en preparacion medico-legal.',
                content:
                    documents.finalNote?.content ||
                    [
                        normalizedHcu005.evolutionNote,
                        normalizedHcu005.diagnosticImpression,
                        normalizedHcu005.therapeuticPlan,
                        normalizedHcu005.careIndications,
                    ]
                        .filter(Boolean)
                        .join('\n\n'),
                sections: {
                    hcu001: normalizedAdmission001,
                    hcu005: normalizedHcu005,
                },
                version: approval?.finalDraftVersion || 1,
                generatedAt: approval?.approvedAt || '',
                confidential: true,
            },
            prescription: {
                status:
                    documents.prescription?.status ||
                    (legalReadiness.status === 'ready' ? 'draft' : 'draft'),
                medication:
                    documents.prescription?.medication ||
                    prescriptionMedication,
                directions:
                    documents.prescription?.directions ||
                    prescriptionDirections,
                items: normalizedHcu005.prescriptionItems,
                signedAt: approval?.approvedAt || '',
                confidential: true,
            },
            certificate: {
                status: documents.certificate?.status || 'draft',
                summary: documents.certificate?.summary || '',
                restDays: documents.certificate?.restDays || null,
                signedAt: approval?.approvedAt || '',
                confidential: true,
            },
            consentForms: normalizedConsentForms,
            interconsultForms: normalizedInterconsultForms,
            interconsultReports: normalizedInterconsultReports,
            labOrders: normalizedLabOrderSnapshots,
            imagingOrders: normalizedImagingOrderSnapshots,
        },
        interconsultations: normalizedInterconsultations,
        activeInterconsultationId: normalizedActiveInterconsultationId,
        activeInterconsultation: normalizedActiveInterconsultation,
        labOrders: normalizedLabOrders,
        activeLabOrderId: normalizedActiveLabOrderId,
        activeLabOrder: normalizedActiveLabOrder,
        imagingOrders: normalizedImagingOrders,
        activeImagingOrderId: normalizedActiveImagingOrderId,
        activeImagingOrder: normalizedActiveImagingOrder,
        consentPackets: normalizedConsentPackets,
        activeConsentPacketId: normalizedActiveConsentPacketId,
        activeConsentPacket: normalizedActiveConsentPacket,
        consent: {
            required: consent.required === true,
            status:
                consent.status ||
                normalizedActiveConsentPacket?.status ||
                'not_required',
            informedBy:
                consent.informedBy ||
                normalizedActiveConsentPacket?.professionalAttestation?.name ||
                '',
            informedAt:
                consent.informedAt ||
                normalizedActiveConsentPacket?.declaration?.declaredAt ||
                '',
            explainedWhat:
                consent.explainedWhat ||
                normalizedActiveConsentPacket?.procedureWhatIsIt ||
                '',
            risksExplained:
                consent.risksExplained ||
                normalizedActiveConsentPacket?.frequentRisks ||
                '',
            alternativesExplained:
                consent.alternativesExplained ||
                normalizedActiveConsentPacket?.alternatives ||
                '',
            capacityAssessment:
                consent.capacityAssessment ||
                normalizedActiveConsentPacket?.declaration
                    ?.capacityAssessment ||
                '',
            privateCommunicationConfirmed:
                consent.privateCommunicationConfirmed === true ||
                normalizedActiveConsentPacket?.privateCommunicationConfirmed ===
                    true,
            companionShareAuthorized:
                consent.companionShareAuthorized === true ||
                normalizedActiveConsentPacket?.companionShareAuthorized ===
                    true,
            acceptedAt:
                consent.acceptedAt ||
                normalizedActiveConsentPacket?.patientAttestation?.signedAt ||
                normalizedActiveConsentPacket?.representativeAttestation
                    ?.signedAt ||
                '',
            declinedAt:
                consent.declinedAt ||
                normalizedActiveConsentPacket?.denial?.declinedAt ||
                '',
            revokedAt:
                consent.revokedAt ||
                normalizedActiveConsentPacket?.revocation?.revokedAt ||
                '',
            notes: consent.notes || '',
        },
        approval: approval || {
            status: 'pending',
            approvedBy: '',
            approvedAt: '',
            finalDraftVersion: null,
            checklistSnapshot: [],
            aiTraceSnapshot: {},
            notes: '',
            normativeSources: [
                'MSP-AM-5216A',
                'MSP-AM-0457-ref',
                'MSP-AM-5316',
                'MSP-HCU-FORM-001',
                'MSP-HCU-FORM-005',
                'MSP-HCU-FORM-007',
                'MSP-HCU-FORM-010A',
                'MSP-HCU-FORM-012A',
                'MSP-HCU-FORM-024',
            ],
        },
        approvalState: approval || {
            status: 'pending',
            approvedBy: '',
            approvedAt: '',
            finalDraftVersion: null,
            checklistSnapshot: [],
            aiTraceSnapshot: {},
            notes: '',
            normativeSources: [
                'MSP-AM-5216A',
                'MSP-AM-0457-ref',
                'MSP-AM-5316',
                'MSP-HCU-FORM-001',
                'MSP-HCU-FORM-005',
                'MSP-HCU-FORM-007',
                'MSP-HCU-FORM-010A',
                'MSP-HCU-FORM-012A',
                'MSP-HCU-FORM-024',
            ],
        },
        legalReadiness: {
            ...legalReadiness,
            hcu001Status: normalizedHcu001Status,
            hcu005Status: legalReadiness.hcu005Status || {
                status:
                    legalReadiness.status === 'ready' ? 'complete' : 'partial',
                label:
                    legalReadiness.status === 'ready'
                        ? 'HCU-005 completo'
                        : 'HCU-005 parcial',
                summary:
                    legalReadiness.status === 'ready'
                        ? 'La evolucion, la impresion y la prescripcion trazable estan completas.'
                        : 'La evolucion o las prescripciones del HCU-005 aun tienen faltantes.',
            },
            hcu007Status: normalizedHcu007Status,
            hcu007ReportStatus: normalizedHcu007ReportStatus,
            hcu010AStatus: normalizedHcu010AStatus,
            hcu012AStatus: normalizedHcu012AStatus,
            hcu024Status: normalizedHcu024Status,
        },
        closureChecklist: {
            ...legalReadiness,
            hcu001Status: normalizedHcu001Status,
            hcu005Status: legalReadiness.hcu005Status || {
                status:
                    legalReadiness.status === 'ready' ? 'complete' : 'partial',
                label:
                    legalReadiness.status === 'ready'
                        ? 'HCU-005 completo'
                        : 'HCU-005 parcial',
                summary:
                    legalReadiness.status === 'ready'
                        ? 'La evolucion, la impresion y la prescripcion trazable estan completas.'
                        : 'La evolucion o las prescripciones del HCU-005 aun tienen faltantes.',
            },
            hcu007Status: normalizedHcu007Status,
            hcu007ReportStatus: normalizedHcu007ReportStatus,
            hcu010AStatus: normalizedHcu010AStatus,
            hcu012AStatus: normalizedHcu012AStatus,
            hcu024Status: normalizedHcu024Status,
        },
        recordsGovernance: normalizedRecordsGovernance,
        accessAudit: normalizedAccessAudit,
        disclosureLog: normalizedDisclosureLog,
        copyRequests: normalizedCopyRequests,
        archiveReadiness: normalizedArchiveReadiness,
        approvalBlockedReasons: legalReadiness.blockingReasons || [],
        auditSummary: {
            accessAuditCount: normalizedAccessAudit.length,
            disclosureLogCount: normalizedDisclosureLog.length,
            copyRequestsCount: normalizedCopyRequests.length,
            pendingCopyRequestsCount:
                normalizedRecordsGovernance.copyRequestSummary.pending,
            overdueCopyRequestsCount:
                normalizedRecordsGovernance.copyRequestSummary.overdue,
            lastAccessAt:
                normalizedRecordsGovernance.lastAccessEvent?.createdAt || '',
            lastApprovedAt: approval?.approvedAt || '',
            approvalStatus: approval?.status || 'pending',
        },
    };
}

test('historia clinica opera como cabina medico-legal y deja media flow fuera del workspace', async ({
    page,
}) => {
    const blockedRecord = buildClinicalRecordPayload({
        sessionId: 'chs-001',
        caseId: 'case-001',
        patientName: 'Ana Ruiz',
        clinicianSummary: 'Rosacea facial en seguimiento clinico.',
        legalReadiness: {
            status: 'blocked',
            ready: false,
            label: 'Bloqueada',
            summary:
                'La aprobacion esta bloqueada hasta resolver los faltantes medico-legales visibles.',
            hcu005Status: {
                status: 'partial',
                label: 'HCU-005 parcial',
                summary: 'Falta completar la evolucion clinica del episodio.',
            },
            checklist: [
                {
                    code: 'minimum_clinical_data',
                    status: 'fail',
                    label: 'Datos minimos clinicos',
                    message:
                        'Aun faltan datos clinicos minimos para sostener el cierre.',
                },
            ],
            blockingReasons: [
                {
                    code: 'missing_minimum_clinical_data',
                    label: 'Faltan datos clinicos minimos',
                    message:
                        'Completa intake y preguntas faltantes antes de aprobar.',
                },
            ],
        },
    });

    const readyRecord = buildClinicalRecordPayload({
        sessionId: 'chs-002',
        caseId: 'case-002',
        patientName: 'Bruno Paz',
        clinicianSummary: 'Dermatitis en observacion con nota final lista.',
        legalReadiness: {
            status: 'ready',
            ready: true,
            label: 'Lista para aprobar',
            summary:
                'La historia clinica cumple los bloqueos medico-legales minimos para aprobar.',
            hcu005Status: {
                status: 'complete',
                label: 'HCU-005 completo',
                summary:
                    'La evolucion, la impresion y la prescripcion trazable estan completas.',
            },
            checklist: [
                {
                    code: 'minimum_clinical_data',
                    status: 'pass',
                    label: 'Datos minimos clinicos',
                    message:
                        'No hay preguntas faltantes abiertas en el intake.',
                },
                {
                    code: 'consent',
                    status: 'pass',
                    label: 'Consentimiento informado',
                    message:
                        'El consentimiento exigible ya esta resuelto para este episodio.',
                },
            ],
            blockingReasons: [],
        },
        consent: {
            required: true,
            status: 'accepted',
            informedBy: 'Dra. Laura Mena',
            informedAt: '2026-03-15T09:10:00-05:00',
            explainedWhat: 'Se explico el plan y las alternativas.',
            risksExplained: 'Irritacion transitoria',
            alternativesExplained: 'Observacion y cambios topicos',
            capacityAssessment: 'Paciente capaz de decidir',
            privateCommunicationConfirmed: true,
            companionShareAuthorized: false,
            acceptedAt: '2026-03-15T09:10:00-05:00',
        },
    });

    const approvedRecord = buildClinicalRecordPayload({
        sessionId: 'chs-002',
        caseId: 'case-002',
        patientName: 'Bruno Paz',
        clinicianSummary: 'Dermatitis aprobada y cerrada.',
        legalReadiness: {
            status: 'ready',
            ready: true,
            label: 'Lista para aprobar',
            summary:
                'La historia clinica cumple los bloqueos medico-legales minimos para aprobar.',
            hcu005Status: {
                status: 'complete',
                label: 'HCU-005 completo',
                summary:
                    'La evolucion, la impresion y la prescripcion trazable estan completas.',
            },
            checklist: [
                {
                    code: 'minimum_clinical_data',
                    status: 'pass',
                    label: 'Datos minimos clinicos',
                    message:
                        'No hay preguntas faltantes abiertas en el intake.',
                },
            ],
            blockingReasons: [],
        },
        approval: {
            status: 'approved',
            approvedBy: 'Dra. Laura Mena',
            approvedAt: '2026-03-15T09:22:00-05:00',
            finalDraftVersion: 4,
            checklistSnapshot: [
                {
                    code: 'minimum_clinical_data',
                    status: 'pass',
                },
            ],
            aiTraceSnapshot: {},
            notes: '',
            normativeSources: [
                'MSP-AM-5216A',
                'MSP-AM-0457-ref',
                'MSP-AM-5316',
                'MSP-HCU-FORM-001',
                'MSP-HCU-FORM-005',
                'MSP-HCU-FORM-007',
                'MSP-HCU-FORM-024',
            ],
        },
        documents: {
            finalNote: {
                summary: 'Nota final aprobada y defendible.',
                content: 'Contenido final de la nota.',
            },
            prescription: {
                status: 'issued',
                medication: 'Metronidazol topico',
                directions: 'Aplicacion nocturna por 8 semanas',
            },
        },
        consent: {
            required: true,
            status: 'accepted',
            informedBy: 'Dra. Laura Mena',
            informedAt: '2026-03-15T09:10:00-05:00',
            explainedWhat: 'Se explico el plan y las alternativas.',
            risksExplained: 'Irritacion transitoria',
            alternativesExplained: 'Observacion y cambios topicos',
            capacityAssessment: 'Paciente capaz de decidir',
            privateCommunicationConfirmed: true,
            companionShareAuthorized: false,
            acceptedAt: '2026-03-15T09:10:00-05:00',
        },
    });

    const reviewBySessionId = {
        'chs-001': blockedRecord,
        'chs-002': readyRecord,
    };

    const dataState = {
        clinicalHistoryMeta: {
            summary: {
                drafts: {
                    reviewQueueCount: 2,
                    pendingAiCount: 0,
                    hcu001: {
                        complete: 2,
                        partial: 0,
                        legacy_partial: 0,
                        missing: 0,
                    },
                },
                events: {
                    openCount: 1,
                    unreadCount: 1,
                },
                diagnostics: {
                    status: 'degraded',
                },
            },
            reviewQueue: [
                {
                    sessionId: 'chs-001',
                    caseId: 'case-001',
                    patientName: 'Ana Ruiz',
                    summary: 'Rosacea facial con faltantes clinicos.',
                    sessionStatus: 'review_required',
                    reviewStatus: 'review_required',
                    requiresHumanReview: true,
                    reviewReasons: ['legal_blockers_present'],
                    pendingAiStatus: '',
                    attachmentCount: 1,
                    openEventCount: 1,
                    highestOpenSeverity: 'critical',
                    latestOpenEventTitle: 'Alerta clinica abierta',
                    legalReadinessStatus: 'blocked',
                    legalReadinessLabel: 'Bloqueada',
                    legalReadinessSummary:
                        'La aprobacion esta bloqueada hasta resolver los faltantes medico-legales visibles.',
                    hcu001Status: 'complete',
                    hcu001Label: 'HCU-001 completa',
                    hcu001Summary:
                        'La admision longitudinal ya deja identidad y contacto base defendibles.',
                    hcu005Status: 'partial',
                    hcu005Label: 'HCU-005 parcial',
                    hcu005Summary:
                        'Falta completar la evolucion clinica del episodio.',
                    hcu024Status: 'draft',
                    hcu024Label: 'HCU-024 borrador',
                    hcu024Summary:
                        'Existe un consentimiento por procedimiento aún en borrador.',
                    approvalBlockedReasons: [
                        {
                            code: 'missing_minimum_clinical_data',
                        },
                    ],
                },
                {
                    sessionId: 'chs-002',
                    caseId: 'case-002',
                    patientName: 'Bruno Paz',
                    summary: 'Dermatitis lista para aprobacion final.',
                    sessionStatus: 'review_required',
                    reviewStatus: 'review_required',
                    requiresHumanReview: true,
                    reviewReasons: [],
                    pendingAiStatus: '',
                    attachmentCount: 0,
                    openEventCount: 0,
                    highestOpenSeverity: '',
                    latestOpenEventTitle: '',
                    legalReadinessStatus: 'ready',
                    legalReadinessLabel: 'Lista para aprobar',
                    legalReadinessSummary:
                        'La historia clinica cumple los bloqueos medico-legales minimos para aprobar.',
                    hcu001Status: 'complete',
                    hcu001Label: 'HCU-001 completa',
                    hcu001Summary:
                        'La admision longitudinal ya deja identidad y contacto base defendibles.',
                    hcu005Status: 'complete',
                    hcu005Label: 'HCU-005 completo',
                    hcu005Summary:
                        'La evolucion, la impresion y la prescripcion trazable estan completas.',
                    hcu024Status: 'accepted',
                    hcu024Label: 'HCU-024 aceptado',
                    hcu024Summary:
                        'El consentimiento escrito por procedimiento ya quedó aceptado.',
                    approvalBlockedReasons: [],
                },
            ],
            events: [
                {
                    eventId: 'che-001',
                    type: 'clinical_alert',
                    severity: 'critical',
                    status: 'open',
                },
            ],
        },
    };

    await installLegacyAdminAuthMock(page, {
        capabilities: {
            adminAgent: true,
        },
    });

    await installBasicAdminApiMocks(page, {
        dataOverrides: dataState,
        handleRoute: async ({
            route,
            resource,
            method,
            payload,
            fulfillJson,
        }) => {
            if (resource === 'clinical-record' && method === 'GET') {
                const requestUrl = new URL(route.request().url());
                const sessionId =
                    requestUrl.searchParams.get('sessionId') || 'chs-001';
                await fulfillJson(route, {
                    ok: true,
                    data: reviewBySessionId[sessionId] || blockedRecord,
                });
                return true;
            }

            if (resource === 'clinical-record' && method === 'PATCH') {
                await fulfillJson(route, {
                    ok: true,
                    data: readyRecord,
                });
                return true;
            }

            if (resource === 'clinical-episode-action' && method === 'POST') {
                if (payload.action === 'approve_final_note') {
                    reviewBySessionId['chs-002'] = approvedRecord;
                    await fulfillJson(route, {
                        ok: true,
                        data: approvedRecord,
                    });
                    return true;
                }

                await fulfillJson(route, {
                    ok: true,
                    data: readyRecord,
                });
                return true;
            }

            return false;
        },
    });

    await page.goto('/admin.html');
    await waitForAdminRuntimeReady(page);

    await page.keyboard.press('Control+K');
    await page.locator('#adminQuickCommand').fill('telemedicina pendiente');
    await page.keyboard.press('Enter');

    await expect(page.locator('#clinical-history')).toHaveClass(/active/);
    await expect(page).toHaveURL(/clinicalWorkspace=review/);
    await expect(
        page.locator('[data-clinical-workspace="review"]')
    ).toHaveClass(/is-active/);
    await expect(
        page.locator('[data-clinical-workspace="media-flow"]')
    ).toHaveCount(0);

    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('Aptitud de cierre');
    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('Bloqueada');
    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-001 completa');
    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-005 parcial');
    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-007 no aplica');
    await expect(page.locator('#clinicalHistoryHeaderMeta')).toContainText(
        'cedula 0912345678'
    );
    await expect(page.locator('#clinicalHistoryHeaderMeta')).toContainText(
        'Tel. 0990001111'
    );
    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('Datos minimos clinicos');
    await expect(page.locator('#clinicalHistoryDraftForm')).toContainText(
        'Admisión HCU-form.001/2008'
    );
    await expect(page.locator('#clinicalHistoryDraftForm')).toContainText(
        'Interconsulta HCU-form.007/2008'
    );
    await expect(page.locator('#clinicalHistoryApproveBtn')).toBeDisabled();

    await page.locator('[data-clinical-session-id="chs-002"]').click();
    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('Lista para aprobar');
    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-001 completa');
    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-005 completo');
    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-007 no aplica');
    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-024 aceptado');
    await expect(page.locator('#clinicalHistoryApproveBtn')).toBeEnabled();
    await expect(page.locator('#clinicalHistoryHeaderMeta')).toContainText(
        'Primera admision'
    );
    await expect(page.locator('#clinicalHistoryDraftForm')).toContainText(
        'Consentimiento HCU-form.024/2008'
    );
    await expect(page.locator('#consent_packet_procedure_name')).toHaveValue(
        'Aplicación de láser dermatológico'
    );
    await expect(
        page.locator('#admission_identity_document_number')
    ).toHaveValue('0912345678');
    await expect(page.locator('#hcu005_prescription_0_medication')).toHaveValue(
        'Metronidazol topico'
    );
    await expect(page.locator('#hcu005_diagnostic_impression')).toHaveValue(
        'Rosacea inflamatoria en control clinico.'
    );

    await page.locator('#clinicalHistoryApproveBtn').click();
    await expect(
        page.locator('#clinicalHistoryApprovalConstancy')
    ).toContainText('Constancia de aprobacion');
    await expect(
        page.locator('#clinicalHistoryApprovalConstancy')
    ).toContainText('Dra. Laura Mena');
    await expect(page.locator('#clinicalHistoryStatusChip')).toContainText(
        'Aprobada'
    );
});

test('interconsulta HCU-007 permite crear, emitir y cancelar documentos del episodio', async ({
    page,
}) => {
    const baseRecord = buildClinicalRecordPayload({
        sessionId: 'chs-hcu007-001',
        caseId: 'case-hcu007-001',
        patientName: 'Paula Vera',
        clinicianSummary:
            'Caso con necesidad eventual de interconsulta dermatológica.',
        legalReadiness: {
            status: 'ready',
            ready: true,
            label: 'Lista para aprobar',
            summary:
                'La nota actual no exige interconsulta emitida antes del cierre.',
            hcu005Status: {
                status: 'complete',
                label: 'HCU-005 completo',
                summary:
                    'La evolución, la impresión y el plan terapéutico ya están trazados.',
            },
            hcu007Status: buildHcu007StatusFixture('not_applicable'),
            checklist: [
                {
                    code: 'hcu007_interconsultation',
                    status: 'pass',
                    label: 'HCU-007 interconsulta',
                    message:
                        'No hay interconsultas exigibles para este episodio.',
                },
            ],
            blockingReasons: [],
        },
        consent: {
            required: true,
            status: 'accepted',
            informedBy: 'Dra. Laura Mena',
            informedAt: '2026-03-15T09:00:00-05:00',
            explainedWhat: 'Se explicó el plan terapéutico del episodio.',
            risksExplained: 'Irritación transitoria',
            alternativesExplained: 'Observación y ajustes tópicos',
            capacityAssessment: 'Paciente capaz de decidir',
            privateCommunicationConfirmed: true,
            companionShareAuthorized: false,
            acceptedAt: '2026-03-15T09:05:00-05:00',
        },
    });

    const draftInterconsultation = buildInterconsultationFixture(
        'Paula Vera',
        'chs-hcu007-001',
        baseRecord.patientRecord.admission001,
        baseRecord.draft.clinicianDraft.hcu005,
        {
            interconsultId: 'interconsult-hcu007-001',
            requiredForCurrentPlan: false,
            destinationEstablishment: '',
            destinationService: '',
            consultedProfessionalName: '',
            requestReason: '',
            questionForConsultant: '',
            performedDiagnosticsSummary: '',
            therapeuticMeasuresDone: '',
            issuedAt: '',
            cancelReason: '',
        }
    );

    const createdRecord = buildClinicalRecordPayload({
        sessionId: 'chs-hcu007-001',
        caseId: 'case-hcu007-001',
        patientName: 'Paula Vera',
        clinicianSummary: 'Caso con interconsulta en borrador aún no emitida.',
        legalReadiness: {
            status: 'ready',
            ready: true,
            label: 'Lista para aprobar',
            summary:
                'La interconsulta existe como borrador, pero aún no forma parte obligatoria del plan.',
            hcu005Status: {
                status: 'complete',
                label: 'HCU-005 completo',
                summary:
                    'La evolución, la impresión y el plan terapéutico ya están trazados.',
            },
            hcu007Status: buildHcu007StatusFixture('draft'),
            checklist: [
                {
                    code: 'hcu007_interconsultation',
                    status: 'pass',
                    label: 'HCU-007 interconsulta',
                    message:
                        'La interconsulta está en borrador, pero no congela el cierre mientras no sea parte obligatoria del plan.',
                },
            ],
            blockingReasons: [],
        },
        consent: baseRecord.consent,
        interconsultations: [draftInterconsultation],
        activeInterconsultationId: draftInterconsultation.interconsultId,
    });

    const issuedInterconsultation = buildInterconsultationFixture(
        'Paula Vera',
        'chs-hcu007-001',
        baseRecord.patientRecord.admission001,
        baseRecord.draft.clinicianDraft.hcu005,
        {
            ...draftInterconsultation,
            status: 'issued',
            requiredForCurrentPlan: true,
            destinationEstablishment: 'Hospital dermatológico aliado',
            destinationService: 'Dermatología clínica',
            consultedProfessionalName: 'Dr. Rafael Suárez',
            requestReason:
                'Solicito valoración complementaria para plan ambulatorio.',
            questionForConsultant:
                'Confirmar conducta y prioridad del seguimiento especializado.',
            performedDiagnosticsSummary:
                'Evaluación clínica, dermatoscopia y fotografías de control.',
            therapeuticMeasuresDone:
                'Metronidazol tópico, fotoprotección y educación del paciente.',
            issuedAt: '2026-03-15T09:40:00-05:00',
        }
    );

    const issuedRecord = buildClinicalRecordPayload({
        sessionId: 'chs-hcu007-001',
        caseId: 'case-hcu007-001',
        patientName: 'Paula Vera',
        clinicianSummary: 'Interconsulta emitida como parte del plan actual.',
        legalReadiness: {
            status: 'ready',
            ready: true,
            label: 'Lista para aprobar',
            summary:
                'La interconsulta requerida ya fue emitida y no espera aún respuesta del consultado.',
            hcu005Status: {
                status: 'complete',
                label: 'HCU-005 completo',
                summary:
                    'La evolución, la impresión y el plan terapéutico ya están trazados.',
            },
            hcu007Status: buildHcu007StatusFixture('issued'),
            checklist: [
                {
                    code: 'hcu007_interconsultation',
                    status: 'pass',
                    label: 'HCU-007 interconsulta',
                    message:
                        'La interconsulta marcada como parte del plan actual ya fue emitida.',
                },
            ],
            blockingReasons: [],
        },
        consent: baseRecord.consent,
        interconsultations: [issuedInterconsultation],
        activeInterconsultationId: issuedInterconsultation.interconsultId,
        documents: {
            interconsultForms: [issuedInterconsultation],
        },
    });

    const cancelledInterconsultation = buildInterconsultationFixture(
        'Paula Vera',
        'chs-hcu007-001',
        baseRecord.patientRecord.admission001,
        baseRecord.draft.clinicianDraft.hcu005,
        {
            ...issuedInterconsultation,
            status: 'cancelled',
            cancelledAt: '2026-03-15T09:48:00-05:00',
            cancelReason: 'La paciente decidió diferir la valoración externa.',
        }
    );

    const cancelledRecord = buildClinicalRecordPayload({
        sessionId: 'chs-hcu007-001',
        caseId: 'case-hcu007-001',
        patientName: 'Paula Vera',
        clinicianSummary:
            'Interconsulta cancelada y documentada en el episodio.',
        legalReadiness: {
            status: 'ready',
            ready: true,
            label: 'Lista para aprobar',
            summary:
                'La interconsulta fue cancelada y quedó documentada sin bloquear el cierre actual.',
            hcu005Status: {
                status: 'complete',
                label: 'HCU-005 completo',
                summary:
                    'La evolución, la impresión y el plan terapéutico ya están trazados.',
            },
            hcu007Status: buildHcu007StatusFixture('cancelled'),
            checklist: [
                {
                    code: 'hcu007_interconsultation',
                    status: 'pass',
                    label: 'HCU-007 interconsulta',
                    message:
                        'La interconsulta marcada como parte del plan actual fue cancelada.',
                },
            ],
            blockingReasons: [],
        },
        consent: baseRecord.consent,
        interconsultations: [cancelledInterconsultation],
        activeInterconsultationId: cancelledInterconsultation.interconsultId,
        documents: {
            interconsultForms: [
                issuedInterconsultation,
                cancelledInterconsultation,
            ],
        },
    });

    let currentRecord = baseRecord;
    const actionPayloads = [];

    await installLegacyAdminAuthMock(page, {
        capabilities: {
            adminAgent: true,
        },
    });

    await installBasicAdminApiMocks(page, {
        dataOverrides: {
            clinicalHistoryMeta: {
                summary: {
                    drafts: {
                        reviewQueueCount: 1,
                        pendingAiCount: 0,
                        hcu007: {
                            not_applicable: 0,
                            draft: 1,
                            ready_to_issue: 0,
                            issued: 0,
                            cancelled: 0,
                            incomplete: 0,
                        },
                    },
                    events: {
                        openCount: 0,
                        unreadCount: 0,
                    },
                    diagnostics: {
                        status: 'healthy',
                    },
                },
                reviewQueue: [
                    {
                        sessionId: 'chs-hcu007-001',
                        caseId: 'case-hcu007-001',
                        patientName: 'Paula Vera',
                        summary:
                            'Caso ambulatorio con posibilidad de interconsulta.',
                        sessionStatus: 'review_required',
                        reviewStatus: 'review_required',
                        requiresHumanReview: true,
                        reviewReasons: [],
                        pendingAiStatus: '',
                        attachmentCount: 0,
                        openEventCount: 0,
                        highestOpenSeverity: '',
                        latestOpenEventTitle: '',
                        legalReadinessStatus: 'ready',
                        legalReadinessLabel: 'Lista para aprobar',
                        legalReadinessSummary:
                            'El caso está listo y la interconsulta no es requerida todavía.',
                        hcu001Status: 'complete',
                        hcu001Label: 'HCU-001 completa',
                        hcu001Summary:
                            'La admisión longitudinal ya deja identidad y contacto base defendibles.',
                        hcu005Status: 'complete',
                        hcu005Label: 'HCU-005 completo',
                        hcu005Summary:
                            'La evolución y el plan terapéutico ya están trazados.',
                        hcu007Status: 'draft',
                        hcu007Label: 'HCU-007 borrador',
                        hcu007Summary:
                            'Existe una interconsulta en borrador que aún no se ha emitido.',
                        hcu024Status: 'accepted',
                        hcu024Label: 'HCU-024 aceptado',
                        hcu024Summary:
                            'El consentimiento escrito por procedimiento ya quedó aceptado.',
                        approvalBlockedReasons: [],
                    },
                ],
                events: [],
            },
        },
        handleRoute: async ({
            route,
            resource,
            method,
            payload,
            fulfillJson,
        }) => {
            if (resource === 'clinical-record' && method === 'GET') {
                await fulfillJson(route, {
                    ok: true,
                    data: currentRecord,
                });
                return true;
            }

            if (resource === 'clinical-episode-action' && method === 'POST') {
                actionPayloads.push(payload);

                if (payload.action === 'create_interconsultation') {
                    currentRecord = createdRecord;
                    await fulfillJson(route, {
                        ok: true,
                        data: createdRecord,
                    });
                    return true;
                }

                if (payload.action === 'issue_interconsultation') {
                    currentRecord = issuedRecord;
                    await fulfillJson(route, {
                        ok: true,
                        data: issuedRecord,
                    });
                    return true;
                }

                if (payload.action === 'cancel_interconsultation') {
                    currentRecord = cancelledRecord;
                    await fulfillJson(route, {
                        ok: true,
                        data: cancelledRecord,
                    });
                    return true;
                }
            }

            return false;
        },
    });

    await page.goto('/admin.html');
    await waitForAdminRuntimeReady(page);

    await page.keyboard.press('Control+K');
    await page.locator('#adminQuickCommand').fill('telemedicina pendiente');
    await page.keyboard.press('Enter');

    await expect(page.locator('#clinicalHistoryDraftForm')).toContainText(
        'Interconsulta HCU-form.007/2008'
    );
    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-007 no aplica');

    await page
        .locator('[data-clinical-review-action="create-interconsultation"]')
        .click();

    await expect.poll(() => actionPayloads.length).toBe(1);
    expect(actionPayloads[0]).toMatchObject({
        action: 'create_interconsultation',
        sessionId: 'chs-hcu007-001',
    });

    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-007 borrador');

    await page
        .locator('#interconsult_destination_establishment')
        .fill('Hospital dermatológico aliado');
    await page
        .locator('#interconsult_destination_service')
        .fill('Dermatología clínica');
    await page
        .locator('#interconsult_consulted_professional_name')
        .fill('Dr. Rafael Suárez');
    await page
        .locator('#interconsult_request_reason')
        .fill('Solicito valoración complementaria para plan ambulatorio.');
    await page
        .locator('#interconsult_question_for_consultant')
        .fill('Confirmar conducta y prioridad del seguimiento especializado.');
    await page
        .locator('#interconsult_performed_diagnostics_summary')
        .fill('Evaluación clínica, dermatoscopia y fotografías de control.');
    await page
        .locator('#interconsult_therapeutic_measures_done')
        .fill('Metronidazol tópico, fotoprotección y educación del paciente.');
    await page.locator('#interconsult_required_for_current_plan').check();
    await page
        .locator(
            '[data-clinical-review-action="issue-current-interconsultation"]'
        )
        .click();

    await expect.poll(() => actionPayloads.length).toBe(2);
    expect(actionPayloads[1]).toMatchObject({
        action: 'issue_interconsultation',
        sessionId: 'chs-hcu007-001',
        interconsultId: 'interconsult-hcu007-001',
        activeInterconsultationId: 'interconsult-hcu007-001',
        interconsultations: [
            expect.objectContaining({
                interconsultId: 'interconsult-hcu007-001',
                requiredForCurrentPlan: true,
                destinationEstablishment: 'Hospital dermatológico aliado',
                destinationService: 'Dermatología clínica',
                consultedProfessionalName: 'Dr. Rafael Suárez',
            }),
        ],
    });

    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-007 emitida');
    await expect(page.locator('#clinicalHistoryDraftForm')).toContainText(
        'Snapshots documentales HCU-007 emitidos o cancelados'
    );

    await page
        .locator('#interconsult_cancel_reason')
        .fill('La paciente decidió diferir la valoración externa.');
    await page
        .locator(
            '[data-clinical-review-action="cancel-current-interconsultation"]'
        )
        .click();

    await expect.poll(() => actionPayloads.length).toBe(3);
    expect(actionPayloads[2]).toMatchObject({
        action: 'cancel_interconsultation',
        sessionId: 'chs-hcu007-001',
        interconsultId: 'interconsult-hcu007-001',
        cancelReason: 'La paciente decidió diferir la valoración externa.',
    });

    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-007 cancelada');
    await expect(page.locator('#interconsult_cancel_reason')).toHaveValue(
        'La paciente decidió diferir la valoración externa.'
    );
});

test('interconsulta HCU-007 permite recibir el informe del consultado y mostrar reconciliación manual', async ({
    page,
}) => {
    const baseRecord = buildClinicalRecordPayload({
        sessionId: 'chs-hcu007-report-001',
        caseId: 'case-hcu007-report-001',
        patientName: 'Paula Vera',
        clinicianSummary:
            'Caso con interconsulta emitida y pendiente de informe.',
        legalReadiness: {
            status: 'ready',
            ready: true,
            label: 'Lista para aprobar',
            summary:
                'La interconsulta requerida ya fue emitida y no espera aún respuesta del consultado.',
            hcu005Status: {
                status: 'complete',
                label: 'HCU-005 completo',
                summary:
                    'La evolución, la impresión y el plan terapéutico ya están trazados.',
            },
            hcu007Status: buildHcu007StatusFixture('issued'),
            hcu007ReportStatus: {
                status: 'not_received',
                label: 'Informe del consultado no recibido',
                summary:
                    'Todavía no se ha recibido informe del consultado en este episodio.',
            },
            checklist: [
                {
                    code: 'hcu007_interconsultation',
                    status: 'pass',
                    label: 'HCU-007 interconsulta',
                    message:
                        'La interconsulta marcada como parte del plan actual ya fue emitida.',
                },
            ],
            blockingReasons: [],
        },
        consent: {
            required: false,
            status: 'not_required',
        },
    });

    const issuedInterconsultation = buildInterconsultationFixture(
        'Paula Vera',
        'chs-hcu007-report-001',
        baseRecord.patientRecord.admission001,
        baseRecord.draft.clinicianDraft.hcu005,
        {
            interconsultId: 'interconsult-hcu007-report-001',
            status: 'issued',
            requiredForCurrentPlan: true,
            destinationEstablishment: 'Hospital dermatológico aliado',
            destinationService: 'Dermatología clínica',
            consultedProfessionalName: 'Dr. Rafael Suárez',
            requestReason:
                'Solicito valoración complementaria para plan ambulatorio.',
            questionForConsultant:
                'Confirmar conducta y prioridad del seguimiento especializado.',
            performedDiagnosticsSummary:
                'Evaluación clínica, dermatoscopia y fotografías de control.',
            therapeuticMeasuresDone:
                'Metronidazol tópico, fotoprotección y educación del paciente.',
            issuedAt: '2026-03-15T09:40:00-05:00',
        }
    );

    const issuedRecord = buildClinicalRecordPayload({
        sessionId: 'chs-hcu007-report-001',
        caseId: 'case-hcu007-report-001',
        patientName: 'Paula Vera',
        clinicianSummary: 'Interconsulta emitida y lista para recibir informe.',
        legalReadiness: {
            ...baseRecord.legalReadiness,
            hcu007Status: buildHcu007StatusFixture('issued'),
            hcu007ReportStatus: {
                status: 'ready_to_receive',
                label: 'Informe listo para recibir',
                summary:
                    'El informe del consultado ya cubre los campos mínimos para recepción formal.',
            },
        },
        consent: baseRecord.consent,
        interconsultations: [issuedInterconsultation],
        activeInterconsultationId: issuedInterconsultation.interconsultId,
        documents: {
            interconsultForms: [issuedInterconsultation],
        },
    });

    const receivedInterconsultation = buildInterconsultationFixture(
        'Paula Vera',
        'chs-hcu007-report-001',
        baseRecord.patientRecord.admission001,
        baseRecord.draft.clinicianDraft.hcu005,
        {
            ...issuedInterconsultation,
            status: 'issued',
            reportStatus: 'received',
            report: {
                status: 'received',
                reportedAt: '2026-03-15T10:25:00-05:00',
                reportedBy: 'Lic. Andrea Paredes',
                receivedBy: 'Dra. Laura Mena',
                respondingEstablishment: 'Hospital dermatológico aliado',
                respondingService: 'Dermatología clínica',
                consultantProfessionalName: 'Dr. Rafael Suárez',
                consultantProfessionalRole: 'Dermatólogo',
                reportSummary: 'Criterio complementario recibido.',
                clinicalFindings:
                    'Rosacea inflamatoria en control parcial, sin signos de alarma.',
                diagnosticOpinion:
                    'Mantener manejo ambulatorio y control evolutivo.',
                recommendations:
                    'Continuar metronidazol tópico y reevaluar en cuatro semanas.',
                followUpIndications:
                    'Control dermatológico si hay recrudecimiento.',
                sourceDocumentType: 'nota_especialista',
                sourceReference: 'INT-007-2026',
                attachments: [
                    {
                        id: 1,
                        kind: 'photo',
                        originalName: 'ana-ruiz-1.jpg',
                        mime: 'image/jpeg',
                        size: 1024,
                        privatePath: '/private/case-001/a1.jpg',
                    },
                ],
            },
        }
    );

    const receivedRecord = buildClinicalRecordPayload({
        sessionId: 'chs-hcu007-report-001',
        caseId: 'case-hcu007-report-001',
        patientName: 'Paula Vera',
        clinicianSummary:
            'Interconsulta emitida con informe recibido y pendiente de conciliación manual.',
        legalReadiness: {
            ...baseRecord.legalReadiness,
            hcu007Status: buildHcu007StatusFixture('received'),
            hcu007ReportStatus: {
                status: 'received',
                label: 'Informe del consultado recibido',
                summary:
                    'El informe del consultado ya quedó capturado y anexado al episodio.',
            },
        },
        consent: baseRecord.consent,
        interconsultations: [receivedInterconsultation],
        activeInterconsultationId: receivedInterconsultation.interconsultId,
        documents: {
            interconsultForms: [issuedInterconsultation],
            interconsultReports: [
                {
                    interconsultId: receivedInterconsultation.interconsultId,
                    interconsultStatus: 'issued',
                    destinationEstablishment:
                        receivedInterconsultation.destinationEstablishment,
                    destinationService:
                        receivedInterconsultation.destinationService,
                    consultedProfessionalName:
                        receivedInterconsultation.consultedProfessionalName,
                    reportStatus: 'received',
                    finalizedAt: receivedInterconsultation.report.reportedAt,
                    snapshotAt: receivedInterconsultation.report.reportedAt,
                    report: receivedInterconsultation.report,
                },
            ],
        },
        accessAudit: [
            {
                auditId: 'audit-007-report-001',
                action: 'receive_interconsult_report',
                actor: 'Dra. Laura Mena',
                actorRole: 'clinician_admin',
                createdAt: '2026-03-15T10:26:00-05:00',
            },
        ],
    });

    let currentRecord = issuedRecord;
    const actionPayloads = [];

    await installLegacyAdminAuthMock(page, {
        capabilities: {
            adminAgent: true,
        },
    });

    await installBasicAdminApiMocks(page, {
        dataOverrides: {
            clinicalHistoryMeta: {
                summary: {
                    drafts: {
                        reviewQueueCount: 1,
                        pendingAiCount: 0,
                        hcu007: {
                            not_applicable: 0,
                            draft: 0,
                            ready_to_issue: 0,
                            received: 0,
                            issued: 1,
                            cancelled: 0,
                            incomplete: 0,
                        },
                    },
                    events: {
                        openCount: 0,
                        unreadCount: 0,
                    },
                    diagnostics: {
                        status: 'healthy',
                    },
                },
                reviewQueue: [
                    {
                        sessionId: 'chs-hcu007-report-001',
                        caseId: 'case-hcu007-report-001',
                        patientName: 'Paula Vera',
                        summary:
                            'Caso ambulatorio con interconsulta emitida y pendiente de informe.',
                        sessionStatus: 'review_required',
                        reviewStatus: 'review_required',
                        requiresHumanReview: true,
                        reviewReasons: [],
                        pendingAiStatus: '',
                        attachmentCount: 1,
                        openEventCount: 0,
                        highestOpenSeverity: '',
                        latestOpenEventTitle: '',
                        legalReadinessStatus: 'ready',
                        legalReadinessLabel: 'Lista para aprobar',
                        legalReadinessSummary:
                            'La interconsulta requerida ya fue emitida y no espera aún respuesta del consultado.',
                        hcu001Status: 'complete',
                        hcu001Label: 'HCU-001 completa',
                        hcu001Summary:
                            'La admisión longitudinal ya deja identidad y contacto base defendibles.',
                        hcu005Status: 'complete',
                        hcu005Label: 'HCU-005 completo',
                        hcu005Summary:
                            'La evolución y el plan terapéutico ya están trazados.',
                        hcu007Status: 'issued',
                        hcu007Label: 'HCU-007 emitida',
                        hcu007Summary:
                            'La interconsulta requerida ya fue emitida sin esperar respuesta del consultado.',
                        hcu024Status: 'not_applicable',
                        hcu024Label: 'HCU-024 no aplica',
                        hcu024Summary:
                            'No hay consentimiento escrito por procedimiento exigible para este episodio.',
                        approvalBlockedReasons: [],
                    },
                ],
                events: [],
            },
        },
        handleRoute: async ({
            route,
            resource,
            method,
            payload,
            fulfillJson,
        }) => {
            if (resource === 'clinical-record' && method === 'GET') {
                await fulfillJson(route, {
                    ok: true,
                    data: currentRecord,
                });
                return true;
            }

            if (resource === 'clinical-episode-action' && method === 'POST') {
                actionPayloads.push(payload);

                if (payload.action === 'receive_interconsult_report') {
                    currentRecord = receivedRecord;
                    await fulfillJson(route, {
                        ok: true,
                        data: receivedRecord,
                    });
                    return true;
                }
            }

            return false;
        },
    });

    await page.goto('/admin.html');
    await waitForAdminRuntimeReady(page);

    await page.keyboard.press('Control+K');
    await page.locator('#adminQuickCommand').fill('telemedicina pendiente');
    await page.keyboard.press('Enter');

    await expect(page.locator('#clinicalHistoryDraftForm')).toContainText(
        'Informe del consultado'
    );
    await expect(page.locator('#clinicalHistoryDraftForm')).toContainText(
        'Recibir informe'
    );

    await page
        .locator('#interconsult_report_reported_at')
        .fill('2026-03-15T10:25');
    await page
        .locator('#interconsult_report_reported_by')
        .fill('Lic. Andrea Paredes');
    await page
        .locator('#interconsult_report_consultant_professional_name')
        .fill('Dr. Rafael Suárez');
    await page
        .locator('#interconsult_report_consultant_professional_role')
        .fill('Dermatólogo');
    await page
        .locator('#interconsult_report_responding_establishment')
        .fill('Hospital dermatológico aliado');
    await page
        .locator('#interconsult_report_responding_service')
        .fill('Dermatología clínica');
    await page
        .locator('#interconsult_report_summary')
        .fill('Criterio complementario recibido.');
    await page
        .locator('#interconsult_report_clinical_findings')
        .fill('Rosacea inflamatoria en control parcial, sin signos de alarma.');
    await page
        .locator('#interconsult_report_diagnostic_opinion')
        .fill('Mantener manejo ambulatorio y control evolutivo.');
    await page
        .locator('#interconsult_report_recommendations')
        .fill('Continuar metronidazol tópico y reevaluar en cuatro semanas.');
    await page
        .locator('#interconsult_report_follow_up_indications')
        .fill('Control dermatológico si hay recrudecimiento.');
    await page
        .locator('#interconsult_report_source_document_type')
        .fill('nota_especialista');
    await page
        .locator('#interconsult_report_source_reference')
        .fill('INT-007-2026');
    await page
        .locator('input[name="interconsult_report_attachment_ids"][value="1"]')
        .check();

    await page
        .locator(
            '[data-clinical-review-action="receive-current-interconsult-report"]'
        )
        .click();

    await expect.poll(() => actionPayloads.length).toBe(1);
    expect(actionPayloads[0]).toMatchObject({
        action: 'receive_interconsult_report',
        sessionId: 'chs-hcu007-report-001',
        interconsultId: 'interconsult-hcu007-report-001',
        interconsultations: [
            expect.objectContaining({
                interconsultId: 'interconsult-hcu007-report-001',
                report: expect.objectContaining({
                    consultantProfessionalName: 'Dr. Rafael Suárez',
                    respondingService: 'Dermatología clínica',
                    sourceReference: 'INT-007-2026',
                    attachments: [
                        expect.objectContaining({
                            id: 1,
                            originalName: 'ana-ruiz-1.jpg',
                        }),
                    ],
                }),
            }),
        ],
    });

    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-007 informe recibido');
    await expect(page.locator('#clinicalHistoryDraftForm')).toContainText(
        'Informe recibido: reconciliar manualmente en HCU-005/HCU-024 si aplica.'
    );
    await expect(page.locator('#interconsult_report_received_by')).toHaveValue(
        'Dra. Laura Mena'
    );
    await expect(page.locator('#clinicalHistoryDraftForm')).toContainText(
        'ana-ruiz-1.jpg'
    );
});

test('laboratorio HCU-010A permite crear y emitir solicitudes del episodio', async ({
    page,
}) => {
    const baseRecord = buildClinicalRecordPayload({
        sessionId: 'chs-hcu010a-001',
        caseId: 'case-hcu010a-001',
        patientName: 'Lina Vela',
        clinicianSummary:
            'Caso con apoyo diagnostico de laboratorio aun no formalizado.',
        legalReadiness: {
            status: 'ready',
            ready: true,
            label: 'Lista para aprobar',
            summary:
                'Todavia no existe una solicitud formal de laboratorio exigible para este episodio.',
            hcu005Status: {
                status: 'complete',
                label: 'HCU-005 completo',
                summary:
                    'La evolucion, la impresion y el plan terapeutico ya estan trazados.',
            },
            hcu010AStatus: buildHcu010AStatusFixture('not_applicable'),
            checklist: [
                {
                    code: 'hcu010a_laboratory',
                    status: 'pass',
                    label: 'HCU-010A laboratorio',
                    message:
                        'No hay solicitud de laboratorio requerida para este episodio.',
                },
            ],
            blockingReasons: [],
        },
        consent: {
            required: false,
            status: 'not_required',
        },
    });

    const draftLabOrder = buildLabOrderFixture(
        'Lina Vela',
        'chs-hcu010a-001',
        baseRecord.patientRecord.admission001,
        baseRecord.draft.clinicianDraft.hcu005,
        {
            labOrderId: 'lab-order-hcu010a-001',
            requiredForCurrentPlan: false,
            sampleDate: '',
            requestedBy: '',
            studySelections: {
                hematology: [],
                urinalysis: [],
                coprological: [],
                bloodChemistry: [],
                serology: [],
                bacteriology: [],
                others: '',
            },
        }
    );

    const createdRecord = buildClinicalRecordPayload({
        sessionId: 'chs-hcu010a-001',
        caseId: 'case-hcu010a-001',
        patientName: 'Lina Vela',
        clinicianSummary: 'Solicitud de laboratorio creada y aun en borrador.',
        legalReadiness: {
            status: 'ready',
            ready: true,
            label: 'Lista para aprobar',
            summary:
                'La solicitud existe como borrador, pero todavia no forma parte obligatoria del plan.',
            hcu005Status: {
                status: 'complete',
                label: 'HCU-005 completo',
                summary:
                    'La evolucion, la impresion y el plan terapeutico ya estan trazados.',
            },
            hcu010AStatus: buildHcu010AStatusFixture('draft'),
            checklist: [
                {
                    code: 'hcu010a_laboratory',
                    status: 'pass',
                    label: 'HCU-010A laboratorio',
                    message:
                        'La solicitud existe como borrador y aun no congela el cierre.',
                },
            ],
            blockingReasons: [],
        },
        consent: baseRecord.consent,
        labOrders: [draftLabOrder],
        activeLabOrderId: draftLabOrder.labOrderId,
    });

    const issuedLabOrder = buildLabOrderFixture(
        'Lina Vela',
        'chs-hcu010a-001',
        baseRecord.patientRecord.admission001,
        baseRecord.draft.clinicianDraft.hcu005,
        {
            ...draftLabOrder,
            status: 'issued',
            requiredForCurrentPlan: true,
            sampleDate: '2026-03-15',
            requestedBy: 'Dra. Laura Mena',
            studySelections: {
                hematology: ['Biometria hematica'],
                urinalysis: [],
                coprological: [],
                bloodChemistry: [],
                serology: [],
                bacteriology: [],
                others: '',
            },
            issuedAt: '2026-03-15T10:15:00-05:00',
            notes: 'Solicitar biometria hematica de control.',
        }
    );

    const issuedRecord = buildClinicalRecordPayload({
        sessionId: 'chs-hcu010a-001',
        caseId: 'case-hcu010a-001',
        patientName: 'Lina Vela',
        clinicianSummary: 'Solicitud de laboratorio emitida y documentada.',
        legalReadiness: {
            status: 'ready',
            ready: true,
            label: 'Lista para aprobar',
            summary:
                'La solicitud de laboratorio requerida ya fue emitida y no bloquea el cierre actual.',
            hcu005Status: {
                status: 'complete',
                label: 'HCU-005 completo',
                summary:
                    'La evolucion, la impresion y el plan terapeutico ya estan trazados.',
            },
            hcu010AStatus: buildHcu010AStatusFixture('issued'),
            checklist: [
                {
                    code: 'hcu010a_laboratory',
                    status: 'pass',
                    label: 'HCU-010A laboratorio',
                    message:
                        'La solicitud de laboratorio requerida ya fue emitida.',
                },
            ],
            blockingReasons: [],
        },
        consent: baseRecord.consent,
        labOrders: [issuedLabOrder],
        activeLabOrderId: issuedLabOrder.labOrderId,
        documents: {
            labOrders: [issuedLabOrder],
        },
    });

    let currentRecord = baseRecord;
    const actionPayloads = [];

    await installLegacyAdminAuthMock(page, {
        capabilities: {
            adminAgent: true,
        },
    });

    await installBasicAdminApiMocks(page, {
        dataOverrides: {
            clinicalHistoryMeta: {
                summary: {
                    drafts: {
                        reviewQueueCount: 1,
                        pendingAiCount: 0,
                        hcu010A: {
                            not_applicable: 1,
                            draft: 0,
                            ready_to_issue: 0,
                            issued: 0,
                            cancelled: 0,
                            incomplete: 0,
                        },
                    },
                    events: {
                        openCount: 0,
                        unreadCount: 0,
                    },
                    diagnostics: {
                        status: 'healthy',
                    },
                },
                reviewQueue: [
                    {
                        sessionId: 'chs-hcu010a-001',
                        caseId: 'case-hcu010a-001',
                        patientName: 'Lina Vela',
                        summary:
                            'Caso ambulatorio con apoyo diagnostico potencial.',
                        sessionStatus: 'review_required',
                        reviewStatus: 'review_required',
                        requiresHumanReview: true,
                        reviewReasons: [],
                        pendingAiStatus: '',
                        attachmentCount: 0,
                        openEventCount: 0,
                        highestOpenSeverity: '',
                        latestOpenEventTitle: '',
                        legalReadinessStatus: 'ready',
                        legalReadinessLabel: 'Lista para aprobar',
                        legalReadinessSummary:
                            'Todavia no existe una solicitud formal de laboratorio exigible para este episodio.',
                        hcu001Status: 'complete',
                        hcu001Label: 'HCU-001 completa',
                        hcu001Summary:
                            'La admision longitudinal ya deja identidad y contacto base defendibles.',
                        hcu005Status: 'complete',
                        hcu005Label: 'HCU-005 completo',
                        hcu005Summary:
                            'La evolucion y el plan terapeutico ya estan trazados.',
                        hcu010AStatus: 'not_applicable',
                        hcu010ALabel: 'HCU-010A no aplica',
                        hcu010ASummary:
                            'No hay solicitud de laboratorio formal exigible para este episodio.',
                        hcu024Status: 'not_applicable',
                        hcu024Label: 'HCU-024 no aplica',
                        hcu024Summary:
                            'No hay consentimiento escrito por procedimiento exigible para este episodio.',
                        approvalBlockedReasons: [],
                    },
                ],
                events: [],
            },
        },
        handleRoute: async ({
            route,
            resource,
            method,
            payload,
            fulfillJson,
        }) => {
            if (resource === 'clinical-record' && method === 'GET') {
                await fulfillJson(route, {
                    ok: true,
                    data: currentRecord,
                });
                return true;
            }

            if (resource === 'clinical-episode-action' && method === 'POST') {
                actionPayloads.push(payload);

                if (payload.action === 'create_lab_order') {
                    currentRecord = createdRecord;
                    await fulfillJson(route, {
                        ok: true,
                        data: createdRecord,
                    });
                    return true;
                }

                if (payload.action === 'issue_lab_order') {
                    currentRecord = issuedRecord;
                    await fulfillJson(route, {
                        ok: true,
                        data: issuedRecord,
                    });
                    return true;
                }
            }

            return false;
        },
    });

    await page.goto('/admin.html');
    await waitForAdminRuntimeReady(page);

    await page.keyboard.press('Control+K');
    await page.locator('#adminQuickCommand').fill('telemedicina pendiente');
    await page.keyboard.press('Enter');

    await expect(page.locator('#clinicalHistoryDraftForm')).toContainText(
        'Laboratorio HCU-form.010A/2008'
    );
    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-010A no aplica');

    await page
        .locator('[data-clinical-review-action="create-lab-order"]')
        .click();

    await expect.poll(() => actionPayloads.length).toBe(1);
    expect(actionPayloads[0]).toMatchObject({
        action: 'create_lab_order',
        sessionId: 'chs-hcu010a-001',
    });

    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-010A borrador');

    await page.locator('#lab_order_sample_date').fill('2026-03-15');
    await page.locator('#lab_order_requested_by').fill('Dra. Laura Mena');
    await page.locator('#lab_order_required_for_current_plan').check();
    await page
        .locator(
            'input[name="lab_order_study_hematology"][value="Biometria hematica"]'
        )
        .check();
    await page
        .locator('#lab_order_notes')
        .fill('Solicitar biometria hematica de control.');

    await page
        .locator('[data-clinical-review-action="issue-current-lab-order"]')
        .click();

    await expect.poll(() => actionPayloads.length).toBe(2);
    expect(actionPayloads[1]).toMatchObject({
        action: 'issue_lab_order',
        sessionId: 'chs-hcu010a-001',
        labOrderId: 'lab-order-hcu010a-001',
        activeLabOrderId: 'lab-order-hcu010a-001',
        labOrders: [
            expect.objectContaining({
                labOrderId: 'lab-order-hcu010a-001',
                requiredForCurrentPlan: true,
                sampleDate: '2026-03-15',
                requestedBy: 'Dra. Laura Mena',
                studySelections: expect.objectContaining({
                    hematology: ['Biometria hematica'],
                }),
            }),
        ],
    });

    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-010A emitida');
    await expect(page.locator('#clinicalHistoryDraftForm')).toContainText(
        'Snapshots documentales HCU-010A'
    );
    await expect(page.locator('#lab_order_issued_at')).toHaveValue(
        /2026-03-15/
    );
});

test('imagenologia HCU-012A permite crear y emitir solicitudes del episodio', async ({
    page,
}) => {
    const baseRecord = buildClinicalRecordPayload({
        sessionId: 'chs-hcu012a-001',
        caseId: 'case-hcu012a-001',
        patientName: 'Elena Paredes',
        clinicianSummary:
            'Caso con apoyo diagnostico de imagenologia aun no formalizado.',
        legalReadiness: {
            status: 'ready',
            ready: true,
            label: 'Lista para aprobar',
            summary:
                'Todavia no existe una solicitud formal de imagenologia exigible para este episodio.',
            hcu005Status: {
                status: 'complete',
                label: 'HCU-005 completo',
                summary:
                    'La evolucion, la impresion y el plan terapeutico ya estan trazados.',
            },
            hcu012AStatus: buildHcu012AStatusFixture('not_applicable'),
            checklist: [
                {
                    code: 'hcu012a_imaging',
                    status: 'pass',
                    label: 'HCU-012A imagenologia',
                    message:
                        'No hay solicitud de imagenologia requerida para este episodio.',
                },
            ],
            blockingReasons: [],
        },
        consent: {
            required: false,
            status: 'not_required',
        },
    });

    const draftImagingOrder = buildImagingOrderFixture(
        'Elena Paredes',
        'chs-hcu012a-001',
        baseRecord.patientRecord.admission001,
        baseRecord.draft.clinicianDraft.hcu005,
        {
            imagingOrderId: 'img-order-hcu012a-001',
            requiredForCurrentPlan: false,
            studyDate: '',
            requestedBy: '',
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
        }
    );

    const createdRecord = buildClinicalRecordPayload({
        sessionId: 'chs-hcu012a-001',
        caseId: 'case-hcu012a-001',
        patientName: 'Elena Paredes',
        clinicianSummary:
            'Solicitud de imagenologia creada y aun en borrador.',
        legalReadiness: {
            status: 'ready',
            ready: true,
            label: 'Lista para aprobar',
            summary:
                'La solicitud existe como borrador, pero todavia no forma parte obligatoria del plan.',
            hcu005Status: {
                status: 'complete',
                label: 'HCU-005 completo',
                summary:
                    'La evolucion, la impresion y el plan terapeutico ya estan trazados.',
            },
            hcu012AStatus: buildHcu012AStatusFixture('draft'),
            checklist: [
                {
                    code: 'hcu012a_imaging',
                    status: 'pass',
                    label: 'HCU-012A imagenologia',
                    message:
                        'La solicitud existe como borrador y aun no congela el cierre.',
                },
            ],
            blockingReasons: [],
        },
        consent: baseRecord.consent,
        imagingOrders: [draftImagingOrder],
        activeImagingOrderId: draftImagingOrder.imagingOrderId,
    });

    const issuedImagingOrder = buildImagingOrderFixture(
        'Elena Paredes',
        'chs-hcu012a-001',
        baseRecord.patientRecord.admission001,
        baseRecord.draft.clinicianDraft.hcu005,
        {
            ...draftImagingOrder,
            status: 'issued',
            requiredForCurrentPlan: true,
            studyDate: '2026-03-15',
            requestedBy: 'Dra. Laura Mena',
            studySelections: {
                conventionalRadiography: ['Rx de senos paranasales'],
                tomography: [],
                magneticResonance: [],
                ultrasound: [],
                procedures: [],
                others: [],
            },
            requestReason: 'Documentar soporte de imagen para cefalea facial.',
            clinicalSummary:
                'Paciente con cefalea facial y rosacea en seguimiento; requiere imagenologia complementaria.',
            issuedAt: '2026-03-15T10:25:00-05:00',
            notes: 'Coordinar radiografia convencional en consulta externa.',
        }
    );

    const issuedRecord = buildClinicalRecordPayload({
        sessionId: 'chs-hcu012a-001',
        caseId: 'case-hcu012a-001',
        patientName: 'Elena Paredes',
        clinicianSummary:
            'Solicitud de imagenologia emitida y documentada.',
        legalReadiness: {
            status: 'ready',
            ready: true,
            label: 'Lista para aprobar',
            summary:
                'La solicitud de imagenologia requerida ya fue emitida y no bloquea el cierre actual.',
            hcu005Status: {
                status: 'complete',
                label: 'HCU-005 completo',
                summary:
                    'La evolucion, la impresion y el plan terapeutico ya estan trazados.',
            },
            hcu012AStatus: buildHcu012AStatusFixture('issued'),
            checklist: [
                {
                    code: 'hcu012a_imaging',
                    status: 'pass',
                    label: 'HCU-012A imagenologia',
                    message:
                        'La solicitud de imagenologia requerida ya fue emitida.',
                },
            ],
            blockingReasons: [],
        },
        consent: baseRecord.consent,
        imagingOrders: [issuedImagingOrder],
        activeImagingOrderId: issuedImagingOrder.imagingOrderId,
        documents: {
            imagingOrders: [issuedImagingOrder],
        },
    });

    let currentRecord = baseRecord;
    const actionPayloads = [];

    await installLegacyAdminAuthMock(page, {
        capabilities: {
            adminAgent: true,
        },
    });

    await installBasicAdminApiMocks(page, {
        dataOverrides: {
            clinicalHistoryMeta: {
                summary: {
                    drafts: {
                        reviewQueueCount: 1,
                        pendingAiCount: 0,
                        hcu012A: {
                            not_applicable: 1,
                            draft: 0,
                            ready_to_issue: 0,
                            issued: 0,
                            cancelled: 0,
                            incomplete: 0,
                        },
                    },
                    events: {
                        openCount: 0,
                        unreadCount: 0,
                    },
                    diagnostics: {
                        status: 'healthy',
                    },
                },
                reviewQueue: [
                    {
                        sessionId: 'chs-hcu012a-001',
                        caseId: 'case-hcu012a-001',
                        patientName: 'Elena Paredes',
                        summary:
                            'Caso ambulatorio con apoyo diagnostico de imagenologia potencial.',
                        sessionStatus: 'review_required',
                        reviewStatus: 'review_required',
                        requiresHumanReview: true,
                        reviewReasons: [],
                        pendingAiStatus: '',
                        attachmentCount: 0,
                        openEventCount: 0,
                        highestOpenSeverity: '',
                        latestOpenEventTitle: '',
                        legalReadinessStatus: 'ready',
                        legalReadinessLabel: 'Lista para aprobar',
                        legalReadinessSummary:
                            'Todavia no existe una solicitud formal de imagenologia exigible para este episodio.',
                        hcu001Status: 'complete',
                        hcu001Label: 'HCU-001 completa',
                        hcu001Summary:
                            'La admision longitudinal ya deja identidad y contacto base defendibles.',
                        hcu005Status: 'complete',
                        hcu005Label: 'HCU-005 completo',
                        hcu005Summary:
                            'La evolucion y el plan terapeutico ya estan trazados.',
                        hcu012AStatus: 'not_applicable',
                        hcu012ALabel: 'HCU-012A no aplica',
                        hcu012ASummary:
                            'No hay solicitud de imagenologia formal exigible para este episodio.',
                        hcu024Status: 'not_applicable',
                        hcu024Label: 'HCU-024 no aplica',
                        hcu024Summary:
                            'No hay consentimiento escrito por procedimiento exigible para este episodio.',
                        approvalBlockedReasons: [],
                    },
                ],
                events: [],
            },
        },
        handleRoute: async ({
            route,
            resource,
            method,
            payload,
            fulfillJson,
        }) => {
            if (resource === 'clinical-record' && method === 'GET') {
                await fulfillJson(route, {
                    ok: true,
                    data: currentRecord,
                });
                return true;
            }

            if (resource === 'clinical-episode-action' && method === 'POST') {
                actionPayloads.push(payload);

                if (payload.action === 'create_imaging_order') {
                    currentRecord = createdRecord;
                    await fulfillJson(route, {
                        ok: true,
                        data: createdRecord,
                    });
                    return true;
                }

                if (payload.action === 'issue_imaging_order') {
                    currentRecord = issuedRecord;
                    await fulfillJson(route, {
                        ok: true,
                        data: issuedRecord,
                    });
                    return true;
                }
            }

            return false;
        },
    });

    await page.goto('/admin.html');
    await waitForAdminRuntimeReady(page);

    await page.keyboard.press('Control+K');
    await page.locator('#adminQuickCommand').fill('telemedicina pendiente');
    await page.keyboard.press('Enter');

    await expect(page.locator('#clinicalHistoryDraftForm')).toContainText(
        'Imagenologia HCU-form.012A/2008'
    );
    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-012A no aplica');

    await page
        .locator('[data-clinical-review-action="create-imaging-order"]')
        .click();

    await expect.poll(() => actionPayloads.length).toBe(1);
    expect(actionPayloads[0]).toMatchObject({
        action: 'create_imaging_order',
        sessionId: 'chs-hcu012a-001',
    });

    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-012A borrador');

    await page.locator('#imaging_order_study_date').fill('2026-03-15');
    await page.locator('#imaging_order_requested_by').fill('Dra. Laura Mena');
    await page.locator('#imaging_order_required_for_current_plan').check();
    await page
        .locator('#imaging_order_studies_conventionalRadiography')
        .fill('Rx de senos paranasales');
    await page
        .locator('#imaging_order_request_reason')
        .fill('Documentar soporte de imagen para cefalea facial.');
    await page
        .locator('#imaging_order_clinical_summary')
        .fill(
            'Paciente con cefalea facial y rosacea en seguimiento; requiere imagenologia complementaria.'
        );
    await page
        .locator('#imaging_order_notes')
        .fill('Coordinar radiografia convencional en consulta externa.');

    await page
        .locator('[data-clinical-review-action="issue-current-imaging-order"]')
        .click();

    await expect.poll(() => actionPayloads.length).toBe(2);
    expect(actionPayloads[1]).toMatchObject({
        action: 'issue_imaging_order',
        sessionId: 'chs-hcu012a-001',
        imagingOrderId: 'img-order-hcu012a-001',
        activeImagingOrderId: 'img-order-hcu012a-001',
        imagingOrders: [
            expect.objectContaining({
                imagingOrderId: 'img-order-hcu012a-001',
                requiredForCurrentPlan: true,
                studyDate: '2026-03-15',
                requestedBy: 'Dra. Laura Mena',
                studySelections: expect.objectContaining({
                    conventionalRadiography: ['Rx de senos paranasales'],
                }),
            }),
        ],
    });

    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-012A emitida');
    await expect(page.locator('#clinicalHistoryDraftForm')).toContainText(
        'Snapshots documentales HCU-012A'
    );
    await expect(page.locator('#imaging_order_issued_at')).toHaveValue(
        /2026-03-15/
    );
});

test('consentimiento HCU-024 permite crear packets por procedimiento y declarar el activo', async ({
    page,
}) => {
    const baseRecord = buildClinicalRecordPayload({
        sessionId: 'chs-consent-001',
        caseId: 'case-consent-001',
        patientName: 'Lucía Vega',
        clinicianSummary:
            'Láser dermatológico sugerido con consentimiento escrito pendiente.',
        legalReadiness: {
            status: 'blocked',
            ready: false,
            label: 'Bloqueada',
            summary:
                'El procedimiento requiere completar y declarar el HCU-024.',
            hcu005Status: {
                status: 'complete',
                label: 'HCU-005 completo',
                summary:
                    'La evolución y el plan terapéutico ya están trazados.',
            },
            hcu024Status: buildHcu024StatusFixture('draft'),
            checklist: [
                {
                    code: 'hcu024_consent',
                    status: 'fail',
                    label: 'HCU-024 consentimiento por procedimiento',
                    message:
                        'Aún falta declarar el consentimiento escrito del procedimiento.',
                },
            ],
            blockingReasons: [
                {
                    code: 'hcu024_consent_incomplete',
                    label: 'HCU-024 incompleto',
                    message:
                        'Completa y declara el consentimiento escrito antes de aprobar.',
                },
            ],
        },
    });

    const declaredPacket = buildConsentPacketFixture(
        'Lucía Vega',
        'chs-consent-001',
        baseRecord.patientRecord.admission001,
        {
            required: true,
            status: 'accepted',
            informedBy: 'Dra. Laura Mena',
            informedAt: '2026-03-15T09:25:00-05:00',
            explainedWhat:
                'Aplicación de toxina botulínica en puntos definidos.',
            risksExplained: 'Dolor leve, hematoma y asimetría transitoria.',
            alternativesExplained:
                'Observación clínica o manejo alternativo no infiltrativo.',
            capacityAssessment: 'Paciente capaz de decidir',
            acceptedAt: '2026-03-15T09:27:00-05:00',
            privateCommunicationConfirmed: true,
        },
        {
            templateKey: 'botox',
            procedureKey: 'botox',
            procedureLabel: 'Botox',
            procedureName: 'Aplicación de toxina botulínica',
            patientSpecificRisks:
                'Antecedente de equimosis fácil y edema postprocedimiento.',
            professionalAttestation: {
                name: 'Dra. Laura Mena',
                role: 'medico_tratante',
                documentNumber: 'MED-024',
                signedAt: '2026-03-15T09:27:00-05:00',
            },
            patientAttestation: {
                name: 'Lucía Vega',
                documentNumber: '0912345678',
                signedAt: '2026-03-15T09:27:00-05:00',
            },
        }
    );

    const declaredRecord = buildClinicalRecordPayload({
        sessionId: 'chs-consent-001',
        caseId: 'case-consent-001',
        patientName: 'Lucía Vega',
        clinicianSummary:
            'Láser dermatológico sugerido con consentimiento escrito aceptado.',
        legalReadiness: {
            status: 'ready',
            ready: true,
            label: 'Lista para aprobar',
            summary: 'El HCU-024 del procedimiento ya quedó aceptado.',
            hcu005Status: {
                status: 'complete',
                label: 'HCU-005 completo',
                summary:
                    'La evolución y el plan terapéutico ya están trazados.',
            },
            hcu024Status: buildHcu024StatusFixture('accepted'),
            checklist: [
                {
                    code: 'hcu024_consent',
                    status: 'pass',
                    label: 'HCU-024 consentimiento por procedimiento',
                    message:
                        'El consentimiento escrito del procedimiento ya quedó aceptado.',
                },
            ],
            blockingReasons: [],
        },
        consent: {
            required: true,
            status: 'accepted',
            informedBy: 'Dra. Laura Mena',
            informedAt: '2026-03-15T09:25:00-05:00',
            explainedWhat:
                'Aplicación de toxina botulínica en puntos definidos.',
            risksExplained: 'Dolor leve, hematoma y asimetría transitoria.',
            alternativesExplained:
                'Observación clínica o manejo alternativo no infiltrativo.',
            capacityAssessment: 'Paciente capaz de decidir',
            privateCommunicationConfirmed: true,
            acceptedAt: '2026-03-15T09:27:00-05:00',
        },
        consentPackets: [declaredPacket],
        activeConsentPacketId: declaredPacket.packetId,
        documents: {
            consentForms: [declaredPacket],
        },
    });

    const actionPayloads = [];

    await installLegacyAdminAuthMock(page, {
        capabilities: {
            adminAgent: true,
        },
    });

    await installBasicAdminApiMocks(page, {
        dataOverrides: {
            clinicalHistoryMeta: {
                summary: {
                    drafts: {
                        reviewQueueCount: 1,
                        pendingAiCount: 0,
                    },
                    events: {
                        openCount: 0,
                        unreadCount: 0,
                    },
                    diagnostics: {
                        status: 'warning',
                    },
                },
                reviewQueue: [
                    {
                        sessionId: 'chs-consent-001',
                        caseId: 'case-consent-001',
                        patientName: 'Lucía Vega',
                        summary:
                            'Procedimiento con consentimiento escrito todavía sin declarar.',
                        sessionStatus: 'review_required',
                        reviewStatus: 'review_required',
                        requiresHumanReview: true,
                        reviewReasons: ['legal_blockers_present'],
                        pendingAiStatus: '',
                        attachmentCount: 0,
                        openEventCount: 0,
                        highestOpenSeverity: '',
                        latestOpenEventTitle: '',
                        legalReadinessStatus: 'blocked',
                        legalReadinessLabel: 'Bloqueada',
                        legalReadinessSummary:
                            'El procedimiento requiere completar y declarar el HCU-024.',
                        hcu001Status: 'complete',
                        hcu001Label: 'HCU-001 completa',
                        hcu001Summary:
                            'La admisión longitudinal ya deja identidad y contacto base defendibles.',
                        hcu005Status: 'complete',
                        hcu005Label: 'HCU-005 completo',
                        hcu005Summary:
                            'La evolución y el plan terapéutico ya están trazados.',
                        hcu024Status: 'draft',
                        hcu024Label: 'HCU-024 borrador',
                        hcu024Summary:
                            'Existe un consentimiento por procedimiento aún en borrador.',
                        approvalBlockedReasons: [
                            {
                                code: 'hcu024_consent_incomplete',
                            },
                        ],
                    },
                ],
                events: [],
            },
        },
        handleRoute: async ({
            route,
            resource,
            method,
            payload,
            fulfillJson,
        }) => {
            if (resource === 'clinical-record' && method === 'GET') {
                await fulfillJson(route, {
                    ok: true,
                    data: baseRecord,
                });
                return true;
            }

            if (resource === 'clinical-episode-action' && method === 'POST') {
                actionPayloads.push(payload);
                if (payload.action === 'declare_consent') {
                    await fulfillJson(route, {
                        ok: true,
                        data: declaredRecord,
                    });
                    return true;
                }
            }

            return false;
        },
    });

    await page.goto('/admin.html');
    await waitForAdminRuntimeReady(page);

    await page.keyboard.press('Control+K');
    await page.locator('#adminQuickCommand').fill('telemedicina pendiente');
    await page.keyboard.press('Enter');

    await expect(page.locator('#clinicalHistoryDraftForm')).toContainText(
        'Consentimiento HCU-form.024/2008'
    );
    await page
        .locator(
            '[data-clinical-draft-action="create-consent-packet-local"][data-template-key="botox"]'
        )
        .click();
    await expect(
        page
            .locator(
                '[data-clinical-draft-action="select-consent-packet-local"]'
            )
            .filter({ hasText: 'Botox' })
    ).toHaveCount(1);

    await page
        .locator('#consent_packet_patient_specific_risks')
        .fill('Antecedente de equimosis fácil y edema postprocedimiento.');
    await page
        .locator('#consent_packet_professional_name')
        .fill('Dra. Laura Mena');
    await page.locator('#consent_packet_professional_document').fill('MED-024');
    await page
        .locator('#consent_packet_private_communication_confirmed')
        .check();
    await page
        .locator('[data-clinical-review-action="declare-current-consent"]')
        .click();

    expect(actionPayloads).toHaveLength(1);
    expect(actionPayloads[0]).toMatchObject({
        action: 'declare_consent',
        sessionId: 'chs-consent-001',
        activeConsentPacketId: expect.any(String),
        consentPackets: [
            expect.objectContaining({
                procedureKey: 'botox',
                procedureLabel: 'Botox',
                professionalAttestation: expect.objectContaining({
                    name: 'Dra. Laura Mena',
                    documentNumber: 'MED-024',
                }),
                patientSpecificRisks:
                    'Antecedente de equimosis fácil y edema postprocedimiento.',
            }),
        ],
    });

    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('HCU-024 aceptado');
    await expect(page.locator('#clinicalHistoryDraftForm')).toContainText(
        'Snapshots documentales inmutables del episodio'
    );
});

test('gobernanza documental muestra SLA, bloquea disclosure no autorizado y exige override para archivo pasivo', async ({
    page,
}) => {
    const baseRecord = buildClinicalRecordPayload({
        sessionId: 'chs-gov-001',
        caseId: 'case-gov-001',
        patientName: 'Marta Leon',
        clinicianSummary:
            'Historia clinica con custodia activa y copia pendiente.',
        legalReadiness: {
            status: 'ready',
            ready: true,
            label: 'Lista para aprobar',
            summary:
                'La nota esta lista, pero la gobernanza documental sigue visible.',
            checklist: [
                {
                    code: 'minimum_clinical_data',
                    status: 'pass',
                    label: 'Datos minimos clinicos',
                    message: 'La nota ya puede sostener cierre medico-legal.',
                },
            ],
            blockingReasons: [],
        },
        consent: {
            required: true,
            status: 'accepted',
            informedBy: 'Dra. Sofia Paredes',
            informedAt: '2026-03-15T09:10:00-05:00',
            explainedWhat: 'Se explico el manejo terapeutico.',
            risksExplained: 'Irritacion leve',
            alternativesExplained: 'Observacion',
            capacityAssessment: 'Paciente capaz',
            privateCommunicationConfirmed: true,
            companionShareAuthorized: false,
            acceptedAt: '2026-03-15T09:10:00-05:00',
        },
        copyRequests: [
            {
                requestId: 'copy-gov-001',
                requestedByType: 'patient',
                requestedByName: 'Marta Leon',
                requestedAt: '2026-03-13T09:00:00-05:00',
                dueAt: '2026-03-14T09:00:00-05:00',
                status: 'requested',
                effectiveStatus: 'overdue',
                statusLabel: 'Vencida',
                legalBasis: '',
                notes: 'Paciente solicita copia certificada para archivo personal.',
                deliveredAt: '',
                deliveryChannel: '',
                deliveredTo: '',
            },
        ],
        disclosureLog: [
            {
                disclosureId: 'disclosure-gov-001',
                targetType: 'patient',
                targetName: 'Marta Leon',
                purpose: 'Entrega previa de indicaciones',
                legalBasis: '',
                authorizedByConsent: false,
                performedBy: 'Dra. Sofia Paredes',
                performedAt: '2026-03-15T09:20:00-05:00',
                channel: 'entrega_privada',
                notes: '',
            },
        ],
        accessAudit: [
            {
                auditId: 'audit-gov-001',
                recordId: 'hcu-chs-gov-001',
                sessionId: 'chs-gov-001',
                episodeId: 'ep-chs-gov-001',
                actor: 'Dra. Sofia Paredes',
                actorRole: 'clinician_admin',
                action: 'view_record',
                resource: 'clinical_record',
                reason: 'authorized_clinical_record_read',
                createdAt: '2026-03-15T09:21:00-05:00',
                meta: {},
            },
        ],
        archiveReadiness: {
            archiveState: 'active',
            lastAttentionAt: '2026-03-15T09:06:00-05:00',
            passiveAfterYears: 5,
            eligibleForPassive: false,
            eligibleAt: '2031-03-15T09:06:00-05:00',
            daysUntilPassive: 1825,
            recommendedState: 'active',
            label: 'Activa',
            overrideRequired: true,
        },
    });

    const passiveRecord = buildClinicalRecordPayload({
        ...baseRecord.session,
        sessionId: 'chs-gov-001',
        caseId: 'case-gov-001',
        patientName: 'Marta Leon',
        clinicianSummary: 'Historia clinica con custodia pasiva justificada.',
        legalReadiness: baseRecord.legalReadiness,
        consent: baseRecord.consent,
        copyRequests: baseRecord.copyRequests,
        disclosureLog: baseRecord.disclosureLog,
        accessAudit: [
            {
                auditId: 'audit-gov-002',
                recordId: 'hcu-chs-gov-001',
                sessionId: 'chs-gov-001',
                episodeId: 'ep-chs-gov-001',
                actor: 'Dra. Sofia Paredes',
                actorRole: 'clinician_admin',
                action: 'set_archive_state',
                resource: 'clinical_record',
                reason: 'archive_state_changed',
                createdAt: '2026-03-15T09:30:00-05:00',
                meta: {
                    archiveState: 'passive',
                },
            },
            ...baseRecord.accessAudit,
        ],
        archiveReadiness: {
            archiveState: 'passive',
            lastAttentionAt: '2026-03-15T09:06:00-05:00',
            passiveAfterYears: 5,
            eligibleForPassive: false,
            eligibleAt: '2031-03-15T09:06:00-05:00',
            daysUntilPassive: 1825,
            recommendedState: 'active',
            label: 'Pasiva',
            overrideRequired: false,
        },
    });

    const actionPayloads = [];

    await installLegacyAdminAuthMock(page, {
        capabilities: {
            adminAgent: true,
        },
    });

    await installBasicAdminApiMocks(page, {
        dataOverrides: {
            clinicalHistoryMeta: {
                summary: {
                    drafts: {
                        reviewQueueCount: 1,
                        pendingAiCount: 0,
                    },
                    events: {
                        openCount: 0,
                        unreadCount: 0,
                    },
                    recordsGovernance: {
                        pendingCopyRequests: 1,
                        overdueCopyRequests: 1,
                        disclosures: 1,
                        archiveEligible: 0,
                    },
                    diagnostics: {
                        status: 'healthy',
                    },
                },
                reviewQueue: [
                    {
                        sessionId: 'chs-gov-001',
                        caseId: 'case-gov-001',
                        patientName: 'Marta Leon',
                        summary:
                            'Copia certificada pendiente y custodia activa.',
                        sessionStatus: 'review_required',
                        reviewStatus: 'review_required',
                        requiresHumanReview: false,
                        reviewReasons: [],
                        pendingAiStatus: '',
                        attachmentCount: 1,
                        openEventCount: 0,
                        highestOpenSeverity: '',
                        latestOpenEventTitle: '',
                        legalReadinessStatus: 'ready',
                        legalReadinessLabel: 'Lista para aprobar',
                        legalReadinessSummary:
                            'La nota ya esta lista y la gobernanza documental sigue disponible.',
                        approvalBlockedReasons: [],
                        pendingCopyRequests: 1,
                        overdueCopyRequests: 1,
                        disclosureCount: 1,
                        archiveEligibleForPassive: false,
                    },
                ],
                events: [],
            },
        },
        handleRoute: async ({
            route,
            resource,
            method,
            payload,
            fulfillJson,
        }) => {
            if (resource === 'clinical-record' && method === 'GET') {
                await fulfillJson(route, {
                    ok: true,
                    data: baseRecord,
                });
                return true;
            }

            if (resource === 'clinical-episode-action' && method === 'POST') {
                actionPayloads.push(payload);
                if (payload.action === 'set_archive_state') {
                    await fulfillJson(route, {
                        ok: true,
                        data: passiveRecord,
                    });
                    return true;
                }

                await fulfillJson(route, {
                    ok: true,
                    data: baseRecord,
                });
                return true;
            }

            return false;
        },
    });

    await page.goto('/admin.html');
    await waitForAdminRuntimeReady(page);

    await page.keyboard.press('Control+K');
    await page.locator('#adminQuickCommand').fill('telemedicina pendiente');
    await page.keyboard.press('Enter');

    await expect(
        page.locator('#clinicalHistoryRecordsGovernancePanel')
    ).toContainText('Gobernanza documental');
    await expect(
        page.locator('#clinicalHistoryRecordsGovernancePanel')
    ).toContainText('Vencida');
    await expect(
        page.locator('#clinicalHistoryRecordsGovernancePanel')
    ).toContainText('Dra. Sofia Paredes');

    await page
        .locator('#governance_disclosure_target_type')
        .selectOption('companion');
    await page
        .locator('#governance_disclosure_target_name')
        .fill('Hermana de Marta');
    await page
        .locator('#governance_disclosure_purpose')
        .fill('Compartir indicaciones');
    await page.locator('#clinicalHistoryLogDisclosureBtn').click();
    expect(actionPayloads).toHaveLength(0);

    await page.locator('#clinicalHistorySetPassiveArchiveBtn').click();
    expect(actionPayloads).toHaveLength(0);

    await page
        .locator('#governance_archive_override_reason')
        .fill('Cierre anticipado por reorganizacion documental supervisada.');
    await page.locator('#clinicalHistorySetPassiveArchiveBtn').click();

    expect(actionPayloads).toHaveLength(1);
    expect(actionPayloads[0]).toMatchObject({
        action: 'set_archive_state',
        archiveState: 'passive',
    });
    await expect(
        page.locator('#clinicalHistoryRecordsGovernancePanel')
    ).toContainText('Pasiva');
});
