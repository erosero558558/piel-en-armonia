// @ts-check
const { test, expect } = require('@playwright/test');

test.use({
    serviceWorkers: 'block',
    viewport: { width: 1366, height: 960 },
});

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toDateTimePartsFromNow(hoursFromNow) {
    const target = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    return {
        date: toDateKey(target),
        time: `${String(target.getHours()).padStart(2, '0')}:${String(
            target.getMinutes()
        ).padStart(2, '0')}`,
    };
}

function isoMinutesAgo(minutesAgo) {
    return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

function buildAvailabilitySeed() {
    const dayOne = new Date();
    dayOne.setDate(dayOne.getDate() + 1);
    const dayTwo = new Date();
    dayTwo.setDate(dayTwo.getDate() + 3);
    return {
        [toDateKey(dayOne)]: ['09:00', '10:30'],
        [toDateKey(dayTwo)]: ['16:00'],
    };
}

function buildFixtureState() {
    const near = toDateTimePartsFromNow(2);
    const tomorrow = toDateTimePartsFromNow(26);

    return {
        appointments: [
            {
                id: 701,
                name: 'Ana Transfer',
                email: 'ana@example.com',
                phone: '+593 99 111 2222',
                service: 'limpieza_facial',
                doctor: 'rosero',
                date: near.date,
                time: near.time,
                price: '$45.00',
                status: 'confirmed',
                paymentMethod: 'transfer',
                paymentStatus: 'pending_transfer_review',
                transferProofUrl: 'https://example.com/proof-701.jpg',
            },
            {
                id: 702,
                name: 'Bruno Confirmado',
                email: 'bruno@example.com',
                phone: '+593 98 222 3333',
                service: 'consulta_dermatologica',
                doctor: 'narvaez',
                date: tomorrow.date,
                time: tomorrow.time,
                price: '$35.00',
                status: 'confirmed',
                paymentMethod: 'cash',
                paymentStatus: 'paid',
            },
        ],
        callbacks: [
            {
                id: 401,
                telefono: '+593 98 111 2222',
                preferencia: 'ahora',
                fecha: isoMinutesAgo(220),
                status: 'pending',
            },
            {
                id: 402,
                telefono: '+593 97 333 4444',
                preferencia: '30min',
                fecha: isoMinutesAgo(40),
                status: 'pendiente',
            },
        ],
        reviews: [
            {
                id: 1,
                name: 'Maria Torres',
                rating: 5,
                comment: 'Excelente atencion y seguimiento.',
                createdAt: new Date().toISOString(),
            },
            {
                id: 2,
                name: 'Luis Paredes',
                rating: 4,
                comment: 'Proceso claro y consulta puntual.',
                createdAt: new Date(
                    Date.now() - 6 * 24 * 60 * 60 * 1000
                ).toISOString(),
            },
        ],
        availability: buildAvailabilitySeed(),
        availabilityMeta: {
            source: 'store',
            mode: 'live',
            timezone: 'America/Guayaquil',
            calendarConfigured: true,
            calendarReachable: true,
            generatedAt: new Date().toISOString(),
        },
        clinicalHistoryMeta: {
            summary: {
                reviewQueueCount: 1,
                latestActivityAt: isoMinutesAgo(8),
                sessions: {
                    total: 1,
                },
                drafts: {
                    total: 1,
                    pendingAiCount: 0,
                    reviewQueueCount: 1,
                },
                events: {
                    total: 1,
                    openCount: 1,
                    unreadCount: 1,
                },
            },
            reviewQueue: [
                {
                    sessionId: 'chs_001',
                    caseId: 'CASE-001',
                    appointmentId: 991,
                    surface: 'waiting_room',
                    sessionStatus: 'review_required',
                    reviewStatus: 'review_required',
                    requiresHumanReview: true,
                    confidence: 0.74,
                    reviewReasons: ['pediatria', 'alergias'],
                    missingFields: ['desencadenantes'],
                    redFlags: ['lesiones pruriginosas'],
                    pendingAiStatus: '',
                    patientName: 'Sofia Vega',
                    patientEmail: 'sofia@example.com',
                    patientPhone: '+593 99 777 8888',
                    attachmentCount: 1,
                    summary:
                        'Brotes pruriginosos en codos y cuello desde hace 2 semanas.',
                    createdAt: isoMinutesAgo(120),
                    updatedAt: isoMinutesAgo(8),
                },
            ],
            events: [
                {
                    eventId: 'evt_001',
                    sessionId: 'chs_001',
                    caseId: 'CASE-001',
                    appointmentId: 991,
                    type: 'guardrail',
                    severity: 'warning',
                    status: 'open',
                    title: 'Revision pediatrica sugerida',
                    message:
                        'El caso requiere firma humana por edad y alergias.',
                    patientName: 'Sofia Vega',
                    reviewStatus: 'review_required',
                    requiresHumanReview: true,
                    confidence: 0.74,
                    createdAt: isoMinutesAgo(10),
                    occurredAt: isoMinutesAgo(10),
                },
            ],
        },
        mediaFlowMeta: {
            summary: {
                totalCases: 1,
                eligibleCases: 1,
                blockedCases: 0,
                publishedCases: 0,
                needsReviewCases: 0,
                latestActivityAt: isoMinutesAgo(12),
            },
            queue: [
                {
                    caseId: 'CASE-MEDIA-001',
                    appointmentId: 1201,
                    patientName: 'Camila Ruiz',
                    serviceLabel: 'Control de acne',
                    assetCount: 2,
                    policyStatus: 'eligible',
                    policyFlags: [],
                    recommendation: 'publish_ready',
                    proposalStatus: 'draft',
                    publicationStatus: 'draft',
                    consentStatus: 'explicit',
                    latestActivityAt: isoMinutesAgo(12),
                    summary:
                        'Control de acne con dos activos clinicos listos para curacion editorial.',
                },
            ],
            recentEvents: [],
        },
        funnel: {
            summary: {
                viewBooking: 120,
                startCheckout: 54,
                bookingConfirmed: 31,
                abandonRatePct: 42.5,
            },
            checkoutAbandonByStep: [],
            checkoutEntryBreakdown: [],
            paymentMethodBreakdown: [],
            bookingStepBreakdown: [],
            sourceBreakdown: [],
            abandonReasonBreakdown: [],
            errorCodeBreakdown: [],
        },
    };
}

function buildClinicalReviewFixture() {
    return {
        session: {
            sessionId: 'chs_001',
            caseId: 'CASE-001',
            appointmentId: 991,
            surface: 'waiting_room',
            status: 'review_required',
            patient: {
                name: 'Sofia Vega',
                email: 'sofia@example.com',
                phone: '+593 99 777 8888',
                ageYears: 14,
                weightKg: 52,
                sexAtBirth: 'femenino',
                pregnant: false,
            },
            transcript: [
                {
                    id: 'msg_patient_1',
                    role: 'user',
                    actor: 'patient',
                    content: 'Tengo ronchas que pican mucho en codos y cuello.',
                    surface: 'waiting_room',
                    createdAt: isoMinutesAgo(26),
                },
                {
                    id: 'msg_ai_1',
                    role: 'assistant',
                    actor: 'clinical_intake',
                    content:
                        'Gracias. Ya registre tu motivo de consulta y la picazon.',
                    surface: 'waiting_room',
                    createdAt: isoMinutesAgo(22),
                },
            ],
            pendingAi: {},
            metadata: {},
            createdAt: isoMinutesAgo(30),
            updatedAt: isoMinutesAgo(8),
            lastMessageAt: isoMinutesAgo(22),
        },
        draft: {
            sessionId: 'chs_001',
            caseId: 'CASE-001',
            appointmentId: 991,
            reviewStatus: 'review_required',
            requiresHumanReview: true,
            confidence: 0.74,
            reviewReasons: ['pediatria', 'alergias'],
            intake: {
                motivoConsulta: 'Ronchas pruriginosas',
                enfermedadActual:
                    'Brotes pruriginosos en codos y cuello de 2 semanas de evolucion.',
                antecedentes: 'Dermatitis atopica en la infancia.',
                alergias: 'Penicilina',
                medicacionActual: 'Ninguna',
                rosRedFlags: ['Prurito nocturno'],
                adjuntos: [
                    {
                        id: 1,
                        kind: 'photo',
                        originalName: 'brote-codo.jpg',
                        mime: 'image/jpeg',
                        size: 20480,
                        privatePath: 'clinical/private/brote-codo.jpg',
                        appointmentId: 991,
                    },
                ],
                resumenClinico:
                    'Paciente adolescente con brotes pruriginosos y antecedentes atopicos.',
                preguntasFaltantes: ['Confirmar desencadenantes'],
                datosPaciente: {
                    edadAnios: 14,
                    pesoKg: 52,
                    sexoBiologico: 'femenino',
                    embarazo: false,
                },
            },
            clinicianDraft: {
                resumen:
                    'Dermatitis en estudio con necesidad de validar desencadenantes.',
                preguntasFaltantes: ['Confirmar contacto con irritantes'],
                cie10Sugeridos: ['L20.9'],
                tratamientoBorrador:
                    'Emoliente BID mientras se confirma diagnostico.',
                posologiaBorrador: {
                    texto: 'Emoliente BID',
                    baseCalculo: 'Plan de soporte inicial',
                    pesoKg: 52,
                    edadAnios: 14,
                    units: 'aplicaciones/dia',
                    ambiguous: true,
                },
            },
            pendingAi: {},
            updatedAt: isoMinutesAgo(8),
            createdAt: isoMinutesAgo(30),
        },
        events: [
            {
                eventId: 'evt_001',
                sessionId: 'chs_001',
                type: 'guardrail',
                severity: 'warning',
                status: 'open',
                title: 'Revision pediatrica sugerida',
                message: 'El caso requiere firma humana por edad y alergias.',
                requiresAction: true,
                occurredAt: isoMinutesAgo(10),
                patient: {
                    name: 'Sofia Vega',
                },
            },
        ],
    };
}

function buildMediaFlowCaseFixture() {
    return {
        caseId: 'CASE-MEDIA-001',
        appointmentId: 1201,
        patient: {
            name: 'Camila Ruiz',
            ageYears: 29,
            sexAtBirth: 'femenino',
        },
        service: {
            label: 'Control de acne',
            summary: 'Seguimiento de acne con par before/after listo.',
        },
        consent: {
            status: 'explicit',
            privacyAccepted: true,
            publicationExplicit: true,
        },
        policy: {
            status: 'eligible',
            flags: [],
        },
        summary: {
            headline: 'Camila Ruiz',
            deck: 'Control de acne con dos activos clinicos listos para curacion editorial.',
        },
        mediaAssets: [
            {
                assetId: 'cma_1001',
                kind: 'before',
                visibility: 'candidate',
                previewUrl:
                    '/api.php?resource=media-flow-private-asset&assetId=cma_1001',
                originalName: 'before-acne.jpg',
                qualityFlags: [],
                riskFlags: [],
            },
            {
                assetId: 'cma_1002',
                kind: 'after',
                visibility: 'candidate',
                previewUrl:
                    '/api.php?resource=media-flow-private-asset&assetId=cma_1002',
                originalName: 'after-acne.jpg',
                qualityFlags: [],
                riskFlags: [],
            },
        ],
        proposal: null,
        publication: {
            status: 'draft',
        },
        timeline: [],
    };
}

async function setupSonyV3Mocks(page, options = {}) {
    const state = buildFixtureState();
    const clinicalReview = buildClinicalReviewFixture();
    const mediaFlowCase = buildMediaFlowCaseFixture();
    const calls = {
        lastClinicalPatch: null,
        lastMediaReview: null,
        lastMediaAgentTurn: null,
    };
    const agentSessionId = 'ags_test_shell';
    const liveSyncTimestamp = new Date().toISOString();
    const agentAccess = options.agentAccess !== false;

    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
        jsonResponse(route, {
            ok: true,
            authenticated: true,
            csrfToken: 'csrf_test_token',
            capabilities: {
                adminAgent: agentAccess,
            },
            operator: {
                email: agentAccess
                    ? 'editorial@auroraderm.test'
                    : 'operaciones@auroraderm.test',
                source: 'openclaw_chatgpt',
            },
        })
    );

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = String(
            url.searchParams.get('resource') || ''
        ).toLowerCase();

        if (resource === 'features') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    admin_sony_ui: true,
                    admin_sony_ui_v3: true,
                },
            });
        }

        if (resource === 'data') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    appointments: state.appointments,
                    callbacks: state.callbacks,
                    reviews: state.reviews,
                    availability: state.availability,
                    availabilityMeta: state.availabilityMeta,
                    clinicalHistoryMeta: state.clinicalHistoryMeta,
                    mediaFlowMeta: state.mediaFlowMeta,
                },
            });
        }

        if (resource === 'funnel-metrics') {
            return jsonResponse(route, {
                ok: true,
                data: state.funnel,
            });
        }

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: state.availability,
                meta: state.availabilityMeta,
            });
        }

        if (resource === 'clinical-history-review') {
            if (route.request().method() === 'PATCH') {
                calls.lastClinicalPatch = route.request().postDataJSON();
                const patch = calls.lastClinicalPatch || {};
                const clinicianDraft = patch?.draft?.clinicianDraft || {};
                if (typeof clinicianDraft.resumen === 'string') {
                    clinicalReview.draft.clinicianDraft.resumen =
                        clinicianDraft.resumen;
                }
                if (patch.approve === true) {
                    clinicalReview.draft.reviewStatus = 'approved';
                    clinicalReview.draft.requiresHumanReview = false;
                    clinicalReview.session.status = 'approved';
                    state.clinicalHistoryMeta.reviewQueue = [];
                    state.clinicalHistoryMeta.summary.reviewQueueCount = 0;
                }
                clinicalReview.draft.updatedAt = new Date().toISOString();
                return jsonResponse(route, {
                    ok: true,
                    data: clinicalReview,
                });
            }

            return jsonResponse(route, {
                ok: true,
                data: clinicalReview,
            });
        }

        if (resource === 'media-flow-case') {
            return jsonResponse(route, {
                ok: true,
                data: mediaFlowCase,
            });
        }

        if (resource === 'media-flow-proposal-generate') {
            mediaFlowCase.proposal = {
                proposalId: 'msp_test_media_flow',
                status: 'draft',
                recommendation: 'publish_ready',
                publicationScore: 88,
                category: 'Acne controlado',
                tags: ['Acne', 'Seguimiento'],
                disclaimer:
                    'Contenido editorial con fines informativos. Requiere gate humano final.',
                comparePairs: [
                    {
                        beforeAssetId: 'cma_1001',
                        afterAssetId: 'cma_1002',
                    },
                ],
                copy: {
                    es: {
                        title: 'Caso acne editorial',
                        summary:
                            'Seguimiento de acne preparado desde el flujo clinico.',
                    },
                    en: {
                        title: 'Editorial acne case',
                        summary:
                            'Acne follow-up prepared from the clinical flow.',
                    },
                },
                alt: {
                    es: {
                        cover: 'Caso acne publicado desde media flow',
                    },
                    en: {
                        cover: 'Acne case published from media flow',
                    },
                },
            };
            mediaFlowCase.timeline = [
                {
                    eventId: 'mfe_generate_1',
                    type: 'media_flow.proposal_generated',
                    title: 'Propuesta OpenClaw generada',
                    message:
                        'Se preparo una propuesta editorial para revisar activos, copy y comparativas.',
                    createdAt: new Date().toISOString(),
                },
            ];
            state.mediaFlowMeta.queue[0].proposalStatus = 'draft';
            state.mediaFlowMeta.queue[0].recommendation = 'publish_ready';
            return jsonResponse(route, {
                ok: true,
                data: {
                    case: mediaFlowCase,
                    proposal: mediaFlowCase.proposal,
                },
            });
        }

        if (resource === 'media-flow-proposal-review') {
            calls.lastMediaReview = route.request().postDataJSON();
            mediaFlowCase.proposal = {
                ...(mediaFlowCase.proposal || {}),
                status:
                    calls.lastMediaReview?.decision === 'edit_and_publish'
                        ? 'published'
                        : 'approved',
                copy:
                    calls.lastMediaReview?.edits?.copy ||
                    mediaFlowCase.proposal?.copy,
                alt:
                    calls.lastMediaReview?.edits?.alt ||
                    mediaFlowCase.proposal?.alt,
                category:
                    calls.lastMediaReview?.edits?.category ||
                    mediaFlowCase.proposal?.category,
                tags:
                    calls.lastMediaReview?.edits?.tags ||
                    mediaFlowCase.proposal?.tags,
            };
            mediaFlowCase.publication = {
                status:
                    calls.lastMediaReview?.decision === 'edit_and_publish'
                        ? 'published'
                        : 'approved',
            };
            mediaFlowCase.timeline = [
                {
                    eventId: 'mfe_review_1',
                    type: 'media_flow.proposal_reviewed',
                    title: 'Revision editorial registrada',
                    message:
                        'La mesa operativa reviso la propuesta y dejo una decision auditable.',
                    createdAt: new Date().toISOString(),
                },
                ...mediaFlowCase.timeline,
            ];
            state.mediaFlowMeta.summary.publishedCases = 1;
            state.mediaFlowMeta.queue[0].proposalStatus =
                mediaFlowCase.proposal.status;
            state.mediaFlowMeta.queue[0].publicationStatus =
                mediaFlowCase.publication.status;
            return jsonResponse(route, {
                ok: true,
                data: {
                    case: mediaFlowCase,
                    proposal: mediaFlowCase.proposal,
                    publication: mediaFlowCase.publication,
                },
            });
        }

        if (resource === 'media-flow-publication-state') {
            mediaFlowCase.publication = {
                status: 'published',
            };
            state.mediaFlowMeta.summary.publishedCases = 1;
            state.mediaFlowMeta.queue[0].publicationStatus = 'published';
            return jsonResponse(route, {
                ok: true,
                data: {
                    case: mediaFlowCase,
                    publication: mediaFlowCase.publication,
                },
            });
        }

        if (resource === 'media-flow-private-asset') {
            return route.fulfill({
                status: 200,
                contentType: 'image/svg+xml; charset=utf-8',
                body: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220"><rect width="320" height="220" fill="#dfe7ef"/><text x="28" y="116" font-size="22" fill="#30445a">Media Flow</text></svg>`,
            });
        }

        if (resource === 'admin-agent-status') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    session: null,
                    health: {
                        relay: {
                            mode: 'online',
                        },
                    },
                    tools: [],
                },
            });
        }

        if (resource === 'admin-agent-session-start') {
            const body = route.request().postDataJSON();
            return jsonResponse(route, {
                ok: true,
                data: {
                    session: {
                        sessionId: agentSessionId,
                        status: 'active',
                        riskMode: 'autopilot_partial',
                    },
                    context: body?.context || {
                        section: 'dashboard',
                    },
                    messages: [],
                    turns: [],
                    toolCalls: [],
                    approvals: [],
                    events: [],
                    health: {
                        relay: {
                            mode: 'online',
                        },
                    },
                    tools: [],
                },
            });
        }

        if (resource === 'admin-agent-turn') {
            let prompt = '';
            let body = {};
            try {
                body = route.request().postDataJSON();
                prompt = String(body?.message || '').toLowerCase();
            } catch (_error) {
                prompt = '';
                body = {};
            }

            if (String(body?.context?.workspace || '') === 'media-flow') {
                calls.lastMediaAgentTurn = body;
                mediaFlowCase.proposal = {
                    ...(mediaFlowCase.proposal || {
                        proposalId: 'msp_test_media_flow',
                        status: 'draft',
                        recommendation: 'publish_ready',
                        publicationScore: 88,
                        category: 'Acne controlado',
                        tags: ['Acne', 'Seguimiento'],
                        disclaimer:
                            'Contenido editorial con fines informativos. Requiere gate humano final.',
                        comparePairs: [
                            {
                                beforeAssetId: 'cma_1001',
                                afterAssetId: 'cma_1002',
                            },
                        ],
                    }),
                    copy: {
                        es: {
                            title: 'Caso acne editorial reescrito',
                            summary:
                                'OpenClaw reajusto el copy editorial del caso desde Media Flow.',
                        },
                        en: {
                            title: 'Editorial acne case refreshed',
                            summary:
                                'OpenClaw refreshed the editorial copy from Media Flow.',
                        },
                    },
                    alt: {
                        es: {
                            cover: 'Caso acne revisado dentro de media flow',
                        },
                        en: {
                            cover: 'Acne case reviewed inside media flow',
                        },
                    },
                };
                mediaFlowCase.timeline = [
                    {
                        eventId: 'mfe_patch_1',
                        type: 'media_flow.proposal_patched',
                        title: 'Propuesta editorial ajustada',
                        message:
                            'OpenClaw ajusto la propuesta activa sin aprobar ni publicar automaticamente.',
                        createdAt: new Date().toISOString(),
                    },
                    ...mediaFlowCase.timeline,
                ];

                return jsonResponse(route, {
                    ok: true,
                    data: {
                        session: {
                            session: {
                                sessionId: agentSessionId,
                                status: 'completed',
                                riskMode: 'autopilot_partial',
                            },
                            context: body?.context,
                            messages: [
                                {
                                    role: 'user',
                                    content: String(body?.message || ''),
                                    createdAt: new Date().toISOString(),
                                    context: body?.context,
                                },
                                {
                                    role: 'assistant',
                                    content:
                                        'OpenClaw ajusto la propuesta activa sin aprobar ni publicar automaticamente.',
                                    createdAt: new Date().toISOString(),
                                    context: body?.context,
                                },
                            ],
                            turns: [
                                {
                                    turnId: 'agt_test_shell_media_flow',
                                    status: 'completed',
                                    finalAnswer:
                                        'OpenClaw ajusto la propuesta activa sin aprobar ni publicar automaticamente.',
                                    context: body?.context,
                                    domainResponse: {
                                        domain: 'media-flow',
                                        workspace: 'media-flow',
                                        caseId: 'CASE-MEDIA-001',
                                        proposalId: 'msp_test_media_flow',
                                        assistantMessage:
                                            'OpenClaw ajusto la propuesta activa sin aprobar ni publicar automaticamente.',
                                        recommendation: 'publish_ready',
                                        policyStatus: 'eligible',
                                        comparePairs: [
                                            {
                                                beforeAssetId: 'cma_1001',
                                                afterAssetId: 'cma_1002',
                                            },
                                        ],
                                        toolSuggestions: [
                                            {
                                                id: 'approve-ready',
                                                label: 'Approve ready',
                                                prompt:
                                                    'Confirma si este caso esta listo para aprobacion humana',
                                                tone: 'success',
                                                description:
                                                    'Valida si el paquete ya puede pasar al gate humano final.',
                                            },
                                        ],
                                    },
                                },
                            ],
                            toolCalls: [
                                {
                                    toolCallId: 'atc_test_shell_media_flow',
                                    tool: 'media_flow.rewrite_proposal',
                                    status: 'completed',
                                    reason:
                                        'Ajustar la propuesta editorial sin aprobar ni publicar',
                                },
                            ],
                            approvals: [],
                            events: [
                                {
                                    event: 'agent.turn_processed',
                                    status: 'completed',
                                    createdAt: new Date().toISOString(),
                                },
                            ],
                            health: {
                                relay: {
                                    mode: 'online',
                                },
                            },
                            tools: [],
                        },
                        turn: {
                            turnId: 'agt_test_shell_media_flow',
                            status: 'completed',
                            toolPlan: [
                                {
                                    tool: 'media_flow.rewrite_proposal',
                                    status: 'completed',
                                },
                            ],
                            finalAnswer:
                                'OpenClaw ajusto la propuesta activa sin aprobar ni publicar automaticamente.',
                            context: body?.context,
                            domainResponse: {
                                domain: 'media-flow',
                                workspace: 'media-flow',
                                caseId: 'CASE-MEDIA-001',
                                proposalId: 'msp_test_media_flow',
                                assistantMessage:
                                    'OpenClaw ajusto la propuesta activa sin aprobar ni publicar automaticamente.',
                                recommendation: 'publish_ready',
                                policyStatus: 'eligible',
                                comparePairs: [
                                    {
                                        beforeAssetId: 'cma_1001',
                                        afterAssetId: 'cma_1002',
                                    },
                                ],
                                toolSuggestions: [
                                    {
                                        id: 'approve-ready',
                                        label: 'Approve ready',
                                        prompt:
                                            'Confirma si este caso esta listo para aprobacion humana',
                                        tone: 'success',
                                        description:
                                            'Valida si el paquete ya puede pasar al gate humano final.',
                                    },
                                ],
                            },
                        },
                        clientActions: [],
                        refreshRecommended: true,
                    },
                });
            }

            if (prompt.includes('horarios')) {
                const selectedDate = Object.keys(state.availability)[0] || '';
                return jsonResponse(route, {
                    ok: true,
                    data: {
                        session: {
                            session: {
                                sessionId: agentSessionId,
                                status: 'completed',
                                riskMode: 'autopilot_partial',
                            },
                            context: {
                                section: 'availability',
                            },
                            messages: [
                                {
                                    role: 'user',
                                    content: `Revisa horarios del ${selectedDate}`,
                                    createdAt: new Date().toISOString(),
                                },
                                {
                                    role: 'assistant',
                                    content: `Disponibilidad ${selectedDate}: 2 slot(s).`,
                                    createdAt: new Date().toISOString(),
                                },
                            ],
                            turns: [
                                {
                                    turnId: 'agt_test_shell_availability',
                                    status: 'completed',
                                    finalAnswer: `Disponibilidad ${selectedDate}: 2 slot(s).`,
                                },
                            ],
                            toolCalls: [
                                {
                                    toolCallId: 'atc_test_shell_date',
                                    tool: 'ui.select_availability_date',
                                    status: 'completed',
                                    reason: 'Sincronizar la fecha consultada en la UI',
                                },
                                {
                                    toolCallId: 'atc_test_shell_day',
                                    tool: 'availability.day_summary',
                                    status: 'completed',
                                    reason: 'Leer la disponibilidad del dia activo',
                                },
                            ],
                            approvals: [],
                            events: [
                                {
                                    event: 'agent.turn_processed',
                                    status: 'completed',
                                    createdAt: new Date().toISOString(),
                                },
                            ],
                            health: {
                                relay: {
                                    mode: 'online',
                                },
                            },
                            tools: [],
                        },
                        turn: {
                            turnId: 'agt_test_shell_availability',
                            status: 'completed',
                            toolPlan: [
                                {
                                    tool: 'ui.select_availability_date',
                                    status: 'completed',
                                },
                                {
                                    tool: 'availability.day_summary',
                                    status: 'completed',
                                },
                            ],
                            finalAnswer: `Disponibilidad ${selectedDate}: 2 slot(s).`,
                        },
                        clientActions: [
                            {
                                tool: 'ui.select_availability_date',
                                args: {
                                    date: selectedDate,
                                },
                            },
                        ],
                        refreshRecommended: false,
                    },
                });
            }

            return jsonResponse(route, {
                ok: true,
                data: {
                    session: {
                        session: {
                            sessionId: agentSessionId,
                            status: 'completed',
                            riskMode: 'autopilot_partial',
                        },
                        context: {
                            section: 'callbacks',
                        },
                        messages: [
                            {
                                role: 'user',
                                content: 'Resume los callbacks pendientes',
                                createdAt: new Date().toISOString(),
                            },
                            {
                                role: 'assistant',
                                content: 'Callbacks consultados: 2.',
                                createdAt: new Date().toISOString(),
                            },
                        ],
                        turns: [
                            {
                                turnId: 'agt_test_shell',
                                status: 'completed',
                                finalAnswer: 'Callbacks consultados: 2.',
                            },
                        ],
                        toolCalls: [
                            {
                                toolCallId: 'atc_test_shell',
                                tool: 'callbacks.list',
                                status: 'completed',
                                reason: 'Leer los callbacks relevantes',
                            },
                        ],
                        approvals: [],
                        events: [
                            {
                                event: 'agent.turn_processed',
                                status: 'completed',
                                createdAt: new Date().toISOString(),
                            },
                        ],
                        health: {
                            relay: {
                                mode: 'online',
                            },
                        },
                        tools: [],
                    },
                    turn: {
                        turnId: 'agt_test_shell',
                        status: 'completed',
                        toolPlan: [
                            {
                                tool: 'callbacks.list',
                                status: 'completed',
                            },
                        ],
                        finalAnswer: 'Callbacks consultados: 2.',
                    },
                    clientActions: [
                        {
                            tool: 'ui.navigate',
                            args: {
                                section: 'callbacks',
                            },
                        },
                    ],
                    refreshRecommended: false,
                },
            });
        }

        if (resource === 'admin-agent-events') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    session: {
                        sessionId: agentSessionId,
                        status: 'waiting_approval',
                        riskMode: 'autopilot_partial',
                        updatedAt: liveSyncTimestamp,
                    },
                    context: {
                        section: 'callbacks',
                    },
                    messages: [
                        {
                            role: 'user',
                            content: 'Resume los callbacks pendientes',
                            createdAt: new Date().toISOString(),
                        },
                        {
                            role: 'assistant',
                            content:
                                'Hay una salida externa pendiente y otra ya encolada.',
                            createdAt: new Date().toISOString(),
                        },
                    ],
                    turns: [
                        {
                            turnId: 'agt_test_shell_live',
                            status: 'waiting_approval',
                            finalAnswer:
                                'Hay una salida externa pendiente y otra ya encolada.',
                        },
                    ],
                    toolCalls: [
                        {
                            toolCallId: 'atc_test_shell_live_1',
                            tool: 'external.whatsapp.send_template',
                            status: 'waiting_approval',
                            reason: 'La solicitud pide una salida externa',
                        },
                        {
                            toolCallId: 'atc_test_shell_live_2',
                            tool: 'external.email.send',
                            status: 'completed',
                            reason: 'Seguimiento multicanal ya encolado',
                        },
                    ],
                    approvals: [
                        {
                            approvalId: 'aap_test_shell_live',
                            toolCallId: 'atc_test_shell_live_1',
                            tool: 'external.whatsapp.send_template',
                            channel: 'whatsapp',
                            template: 'seguimiento_callback',
                            status: 'pending',
                            reason: 'Accion externa en cola de aprobacion',
                            expiresAt: new Date(
                                Date.now() + 15 * 60 * 1000
                            ).toISOString(),
                        },
                    ],
                    events: [
                        {
                            event: 'agent.approval_requested',
                            status: 'waiting_approval',
                            createdAt: liveSyncTimestamp,
                        },
                        {
                            event: 'agent.external_dispatched',
                            status: 'completed',
                            createdAt: liveSyncTimestamp,
                        },
                    ],
                    outbox: [
                        {
                            outboxId: 'aox_test_shell_live',
                            tool: 'external.email.send',
                            channel: 'email',
                            template: 'seguimiento_operativo',
                            message: 'Confirmacion operativa enviada',
                            status: 'queued',
                            createdAt: liveSyncTimestamp,
                        },
                    ],
                    health: {
                        relay: {
                            mode: 'degraded',
                        },
                        counts: {
                            pendingApprovals: 1,
                            outboxQueued: 1,
                            outboxTotal: 1,
                        },
                        allowlists: {
                            externalChannels: ['whatsapp', 'email'],
                            externalTemplates: [
                                'seguimiento_callback',
                                'seguimiento_operativo',
                            ],
                        },
                    },
                    tools: [],
                    syncAt: liveSyncTimestamp,
                },
            });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });

    return {
        state,
        clinicalReview,
        calls,
    };
}

async function openAdminSonyV3(page, options = {}) {
    const fixture = await setupSonyV3Mocks(page, options);
    await page.goto('/admin.html');
    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ui',
        'sony_v3'
    );
    await expect(page.locator('body')).toHaveClass(/admin-v3-mode/);
    await expect(page.locator('#adminDashboard')).toBeVisible();
    return fixture;
}

test.describe('Admin sony_v3 shell', () => {
    test('renderiza shell editorial y abre el copiloto sin estilos legacy', async ({
        page,
    }) => {
        await openAdminSonyV3(page);

        await expect(page.locator('#adminProductivityStrip')).toBeVisible();
        await expect(page.locator('#pageTitle')).toHaveText('Inicio');
        await expect(page.locator('#adminPrimaryNav')).toContainText('Inicio');
        await expect(page.locator('#adminPrimaryNav')).toContainText('Agenda');
        await expect(page.locator('#adminPrimaryNav')).toContainText(
            'Pendientes'
        );
        await expect(page.locator('#adminPrimaryNav')).toContainText(
            'Horarios'
        );
        await expect(page.locator('#adminSecondaryNav')).toContainText(
            'Mas herramientas'
        );
        await expect(page.locator('#openOperatorAppBtn')).toBeVisible();
        await expect(page.locator('#opsTodaySummaryCard')).toBeVisible();
        await expect(page.locator('#opsPendingSummaryCard')).toBeVisible();
        await expect(page.locator('#opsAvailabilitySummaryCard')).toBeVisible();
        await expect(
            page.locator('#dashboardAdvancedAnalytics')
        ).not.toHaveJSProperty('open', true);
        await expect(page.locator('#adminCommandPalette')).toHaveClass(
            /is-hidden/
        );

        const styles = await page.evaluate(() => ({
            legacyCount: document.querySelectorAll(
                '#adminLegacyBaseStyles, #adminLegacyMinStyles, #adminLegacyStyles, #adminV2Styles'
            ).length,
            v3Count: document.querySelectorAll('#adminV3Styles').length,
        }));

        expect(styles.legacyCount).toBe(0);
        expect(styles.v3Count).toBe(1);

        await page.keyboard.press('Control+K');
        await expect(page.locator('#adminAgentPanel')).not.toHaveClass(
            /is-hidden/
        );
        await expect(page.locator('#adminAgentPrompt')).toBeFocused();
        await page
            .locator('#adminAgentPrompt')
            .fill('Resume los callbacks pendientes');
        await page.locator('#adminAgentSubmitBtn').click();
        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(page.locator('#adminAgentToolPlan')).toContainText(
            'callbacks.list'
        );
        await expect(page.locator('#adminAgentEventTimeline')).toContainText(
            'agent.turn_processed'
        );
    });

    test('conserva navegacion por atajos y workbench de citas', async ({
        page,
    }) => {
        await openAdminSonyV3(page);

        await page.keyboard.press('Alt+Shift+Digit2');
        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page.locator('#pageTitle')).toHaveText('Agenda');
        await expect(
            page.locator('#appointmentsTableBody tr.appointment-row')
        ).toHaveCount(2);
        await expect(page.locator('#appointmentsFocusPatient')).toContainText(
            'Ana Transfer'
        );
    });

    test('abre la revision clinica desde dashboard y guarda el borrador medico', async ({
        page,
    }) => {
        const fixture = await openAdminSonyV3(page);

        await page
            .locator(
                '#dashboardClinicalHistoryActions [data-action="context-open-clinical-history"]'
            )
            .first()
            .click();

        await expect(page.locator('#clinical-history')).toHaveClass(/active/);
        await expect(page.locator('#clinicalHistoryTranscript')).toContainText(
            'Tengo ronchas que pican mucho en codos y cuello.'
        );
        await expect(page.locator('#clinicalHistoryQueueList')).toContainText(
            'Sofia Vega'
        );

        await page
            .locator('#clinician_resumen')
            .fill('Resumen ajustado por staff.');
        await page.locator('#clinicalHistorySaveBtn').click();

        await expect
            .poll(
                () =>
                    fixture.calls.lastClinicalPatch?.draft?.clinicianDraft
                        ?.resumen
            )
            .toBe('Resumen ajustado por staff.');
        await expect(
            page.locator('#clinicalHistoryDraftSummary')
        ).toContainText('Sofia Vega');
        await expect(
            page.locator('#clinicalHistoryDraftMeta')
        ).not.toContainText('Cambios sin guardar');
    });

    test('aplica seleccion de fecha de availability desde el copiloto', async ({
        page,
    }) => {
        const fixture = await openAdminSonyV3(page);
        const selectedDate = Object.keys(fixture.state.availability)[0];

        await page.keyboard.press('Alt+Shift+Digit5');
        await expect(page.locator('#availability')).toHaveClass(/active/);

        await page.keyboard.press('Control+K');
        await page
            .locator('#adminAgentPrompt')
            .fill(`Revisa horarios del ${selectedDate}`);
        await page.locator('#adminAgentSubmitBtn').click();

        await expect(page.locator('#selectedDate')).toHaveText(selectedDate);
        await expect(page.locator('#adminAgentToolPlan')).toContainText(
            'ui.select_availability_date'
        );
        await expect(page.locator('#adminAgentToolPlan')).toContainText(
            'availability.day_summary'
        );
    });

    test('sincroniza approvals y outbox desde el event feed live', async ({
        page,
    }) => {
        await openAdminSonyV3(page);

        await page.keyboard.press('Control+K');
        await page
            .locator('#adminAgentPrompt')
            .fill('Resume los callbacks pendientes');
        await page.locator('#adminAgentSubmitBtn').click();

        await page.locator('button[data-action="admin-agent-refresh"]').click();

        await expect(page.locator('#adminAgentApprovalQueue')).toContainText(
            'whatsapp'
        );
        await expect(page.locator('#adminAgentApprovalQueue')).toContainText(
            'seguimiento_callback'
        );
        await expect(page.locator('#adminAgentOutboxList')).toContainText(
            'email'
        );
        await expect(page.locator('#adminAgentOutboxList')).toContainText(
            'seguimiento_operativo'
        );
        await expect(page.locator('#adminAgentRelayBadge')).toContainText(
            'relay degraded'
        );
        await expect(page.locator('#adminAgentLiveMeta')).toContainText(
            'Ultima sincronizacion'
        );
    });

    test('opera media flow dentro de clinical history', async ({ page }) => {
        const fixture = await openAdminSonyV3(page);

        await page
            .locator(
                '#dashboardClinicalHistoryActions [data-action="context-open-clinical-history"]'
            )
            .first()
            .click();

        await expect(page.locator('#clinicalMediaFlowQueueList')).toContainText(
            'Camila Ruiz'
        );
        await expect(
            page.locator(
                '#clinicalMediaFlowAssetGrid .clinical-media-flow-asset-card'
            )
        ).toHaveCount(2);
        await expect(
            page.locator('#clinicalMediaFlowAgentSurface')
        ).toContainText('OpenClaw por caso');

        await page.locator('#clinicalMediaFlowGenerateBtn').click();
        await expect(page.locator('#clinicalMediaFlowProposalForm')).toContainText(
            'Copy editorial'
        );
        await page
            .locator('#clinicalMediaFlowAgentPrompt')
            .fill('Reescribe el copy editorial de este caso');
        await page
            .locator('[data-media-agent-action="submit"]')
            .click();
        await expect(page.locator('#clinicalMediaFlowAgentSurface')).toContainText(
            'OpenClaw ajusto la propuesta activa'
        );

        await page
            .locator('[data-media-agent-action="open-panel"]')
            .click();
        await expect(page.locator('#adminAgentPanel')).not.toHaveClass(
            /is-hidden/
        );
        await expect(page.locator('#adminAgentContextMeta')).toContainText(
            'CASE-MEDIA-001'
        );
        await expect(page.locator('#adminAgentToolPlan')).toContainText(
            'media_flow.rewrite_proposal'
        );

        await page
            .locator('#clinicalMediaFlowTitleEs')
            .fill('Caso acne editorial aprobado');
        await page
            .locator(
                '[data-media-flow-action="review"][data-media-flow-decision="edit_and_publish"]'
            )
            .click();

        await expect(page.locator('#clinicalMediaFlowStatusMeta')).toContainText(
            'published'
        );
        await expect(page.locator('#clinicalMediaFlowTimeline')).toContainText(
            'Revision editorial registrada'
        );
        expect(fixture.calls.lastMediaReview).toMatchObject({
            caseId: 'CASE-MEDIA-001',
            decision: 'edit_and_publish',
        });
        expect(fixture.calls.lastMediaAgentTurn).toMatchObject({
            caseId: 'CASE-MEDIA-001',
            workspace: 'media-flow',
        });
    });

    test('oculta OpenClaw cuando el perfil no tiene acceso editorial', async ({
        page,
    }) => {
        await openAdminSonyV3(page, { agentAccess: false });

        await expect(
            page.locator('[data-action="open-agent-panel"]')
        ).toBeHidden();

        await page
            .locator(
                '#dashboardClinicalHistoryActions [data-action="context-open-clinical-history"]'
            )
            .first()
            .click();

        await expect(page.locator('#clinicalMediaFlowAgentSurface')).toContainText(
            'Acceso restringido'
        );
    });
});
