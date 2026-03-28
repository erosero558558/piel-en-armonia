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

function buildClinicalRecordPayload({
    sessionId,
    caseId,
    patientName,
    clinicianSummary,
    legalReadiness,
    approval,
    documents = {},
    consent = {},
    copyRequests = [],
    disclosureLog = [],
    accessAudit = [],
    archiveReadiness = {},
    recordsGovernance = {},
}) {
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
                phone: '0990001111',
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
                    edadAnios: 34,
                    pesoKg: 63,
                    sexoBiologico: 'femenino',
                    embarazo: false,
                },
            },
            clinicianDraft: {
                resumen: clinicianSummary,
                preguntasFaltantes:
                    legalReadiness.status === 'ready'
                        ? []
                        : ['Confirmar alergias'],
                cie10Sugeridos: ['L71.9'],
                tratamientoBorrador: 'Mantener metronidazol topico',
                posologiaBorrador: {
                    texto: 'Aplicacion nocturna',
                    baseCalculo: 'criterio_clinico',
                    pesoKg: 63,
                    edadAnios: 34,
                    units: '',
                    ambiguous: legalReadiness.status !== 'ready',
                },
            },
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
                        'Nota final en preparacion medico-legal.',
                    content: documents.finalNote?.content || '',
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
                        (legalReadiness.status === 'ready'
                            ? 'Metronidazol topico'
                            : ''),
                    directions:
                        documents.prescription?.directions ||
                        (legalReadiness.status === 'ready'
                            ? 'Aplicacion nocturna por 8 semanas'
                            : ''),
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
            summary: clinicianSummary,
            draftVersion: approval?.finalDraftVersion || 1,
            requiresHumanReview: approval?.status !== 'approved',
            reviewStatus:
                approval?.status === 'approved'
                    ? 'approved'
                    : 'review_required',
        },
        documents: {
            finalNote: {
                status: approval?.status === 'approved' ? 'approved' : 'draft',
                summary:
                    documents.finalNote?.summary ||
                    'Nota final en preparacion medico-legal.',
                content: documents.finalNote?.content || '',
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
                    (legalReadiness.status === 'ready'
                        ? 'Metronidazol topico'
                        : ''),
                directions:
                    documents.prescription?.directions ||
                    (legalReadiness.status === 'ready'
                        ? 'Aplicacion nocturna por 8 semanas'
                        : ''),
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
        legalReadiness,
        closureChecklist: legalReadiness,
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
    ).toContainText('Datos minimos clinicos');
    await expect(page.locator('#clinicalHistoryApproveBtn')).toBeDisabled();

    await page.locator('[data-clinical-session-id="chs-002"]').click();
    await expect(
        page.locator('#clinicalHistoryLegalReadinessPanel')
    ).toContainText('Lista para aprobar');
    await expect(page.locator('#clinicalHistoryApproveBtn')).toBeEnabled();
    await expect(page.locator('#consent_status')).toHaveValue('accepted');
    await expect(page.locator('#document_prescription_medication')).toHaveValue(
        'Metronidazol topico'
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
