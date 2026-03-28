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
            },
            consent: {
                required: consent.required === true,
                status: consent.status || 'not_required',
                informedBy: consent.informedBy || '',
                informedAt: consent.informedAt || '',
                explainedWhat: consent.explainedWhat || '',
                risksExplained: consent.risksExplained || '',
                alternativesExplained: consent.alternativesExplained || '',
                capacityAssessment: consent.capacityAssessment || '',
                privateCommunicationConfirmed:
                    consent.privateCommunicationConfirmed === true,
                companionShareAuthorized:
                    consent.companionShareAuthorized === true,
                acceptedAt: consent.acceptedAt || '',
                declinedAt: '',
                revokedAt: '',
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
        },
        consent: {
            required: consent.required === true,
            status: consent.status || 'not_required',
            informedBy: consent.informedBy || '',
            informedAt: consent.informedAt || '',
            explainedWhat: consent.explainedWhat || '',
            risksExplained: consent.risksExplained || '',
            alternativesExplained: consent.alternativesExplained || '',
            capacityAssessment: consent.capacityAssessment || '',
            privateCommunicationConfirmed:
                consent.privateCommunicationConfirmed === true,
            companionShareAuthorized: consent.companionShareAuthorized === true,
            acceptedAt: consent.acceptedAt || '',
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
    await expect(page.locator('#clinicalHistoryApproveBtn')).toBeEnabled();
    await expect(page.locator('#clinicalHistoryHeaderMeta')).toContainText(
        'Primera admision'
    );
    await expect(page.locator('#consent_status')).toHaveValue('accepted');
    await expect(page.locator('#admission_identity_document_number')).toHaveValue(
        '0912345678'
    );
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
