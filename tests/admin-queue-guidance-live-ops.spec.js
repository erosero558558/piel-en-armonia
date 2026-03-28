// @ts-check
const { test, expect } = require('@playwright/test');
const { buildAdminDataPayload } = require('./helpers/admin-api-mocks');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');
const {
    ADMIN_UI_VARIANT,
    adminUrl,
    buildQueueMetaFromState,
    buildTurneroClinicProfileCatalogStatus,
    buildQueueIdleState,
    buildQueuePilotClinicProfile,
    buildQueuePilotProfileFingerprint,
    buildQueuePilotSurfaceStatus,
    buildQueuePilotHealthPayload,
    buildQueuePilotHealthDiagnosticsPayload,
    buildQueuePilotBookedSlotsPayload,
    buildQueueStateFromTickets,
    buildQueueDesktopOperatorInstance,
    buildQueueDesktopOperatorSurfaceStatus,
    buildQueueOperationalAppsSurfaceStatus,
    buildQueueOperationalSurfaceStatusEntry,
    installAdminQueueApiMocks,
    installQueueAdminAuthMock,
    installQueuePilotApiMocks,
    installQueueOperationalAppsApiMocks,
    getTodayLocalIsoDateForTest,
    json,
    openAdminQueue,
} = require('./helpers/admin-queue-fixtures');

test.describe('Admin turnero sala', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('queueAdminViewModeV1', 'expert');
        });
    });

    test('cola muestra guia accionable para apoyos activos y enfoca el ticket correcto', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const queueTickets = [
            {
                id: 1501,
                ticketCode: 'A-1501',
                queueType: 'appointment',
                patientInitials: 'EP',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: nowIso,
                needsAssistance: true,
                assistanceRequestStatus: 'pending',
                activeHelpRequestId: 901,
                assistanceReason: 'no_phone',
                assistanceReasonLabel: 'Sin celular',
            },
        ];

        const queueState = {
            updatedAt: nowIso,
            waitingCount: 1,
            calledCount: 0,
            estimatedWaitMin: 8,
            delayReason: 'Recepcion atendiendo solicitudes de apoyo.',
            assistancePendingCount: 1,
            activeHelpRequests: [
                {
                    id: 901,
                    ticketId: 1501,
                    ticketCode: 'A-1501',
                    patientInitials: 'EP',
                    reason: 'no_phone',
                    reasonLabel: 'Sin celular',
                    status: 'pending',
                    source: 'assistant',
                    createdAt: nowIso,
                    updatedAt: nowIso,
                },
            ],
            counts: {
                waiting: 1,
                called: 0,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNow: [],
            nextTickets: [
                {
                    id: 1501,
                    ticketCode: 'A-1501',
                    patientInitials: 'EP',
                    position: 1,
                    queueType: 'appointment',
                    priorityClass: 'appt_current',
                    needsAssistance: true,
                    assistanceRequestStatus: 'pending',
                    activeHelpRequestId: 901,
                    assistanceReason: 'no_phone',
                    assistanceReasonLabel: 'Sin celular',
                },
            ],
        };

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_guidance',
        });

        await installAdminQueueApiMocks(page, {
            queueTickets,
            queueState,
        });

        await page.goto(adminUrl());
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(
            page.locator('#queueReceptionGuidancePanel')
        ).toBeVisible();
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Sin celular'
        );
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Valida identidad y datos basicos presencialmente'
        );

        await page.locator('[data-queue-filter="called"]').first().click();
        await expect(page.locator('#queueTableBody')).toContainText(
            'No hay tickets para filtro'
        );

        await page
            .locator('[data-action="queue-focus-ticket"][data-queue-id="1501"]')
            .click();

        await expect(
            page.locator('#queueTableBody tr[data-queue-id="1501"]')
        ).toHaveClass(/queue-row-focus/);
        await expect(page.locator('#queueTableBody')).toContainText('A-1501');
    });

    test('guia de recepcion ofrece atajos contextuales por motivo y los ejecuta', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        let reprintRequests = 0;
        const appointments = [
            {
                id: 4201,
                name: 'Carla Torres',
                email: 'carla@example.com',
                phone: '0991234567',
                date: '2026-03-13',
                time: '10:30',
                service: 'Consulta de control',
                doctor: 'Dra. Vega',
                paymentStatus: 'paid',
                status: 'confirmed',
            },
        ];
        const availability = {
            '2026-03-13': ['10:30', '11:00'],
            '2026-03-14': ['09:00', '09:30'],
        };
        let queueTickets = [
            {
                id: 1601,
                ticketCode: 'A-1601',
                queueType: 'walk_in',
                patientInitials: 'PR',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: nowIso,
            },
            {
                id: 1602,
                ticketCode: 'A-1602',
                queueType: 'appointment',
                patientInitials: 'CT',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: nowIso,
                appointmentId: 4201,
                phoneLast4: '4567',
            },
            {
                id: 1603,
                ticketCode: 'A-1603',
                queueType: 'appointment',
                patientInitials: 'MD',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: nowIso,
            },
        ];
        let queueHelpRequests = [
            {
                id: 911,
                ticketId: 1601,
                ticketCode: 'A-1601',
                patientInitials: 'PR',
                reason: 'printer_issue',
                reasonLabel: 'Problema de impresion',
                status: 'pending',
                source: 'assistant',
                createdAt: nowIso,
                updatedAt: nowIso,
            },
            {
                id: 912,
                ticketId: 1602,
                ticketCode: 'A-1602',
                patientInitials: 'CT',
                reason: 'appointment_not_found',
                reasonLabel: 'Cita no encontrada',
                status: 'pending',
                source: 'assistant',
                createdAt: nowIso,
                updatedAt: nowIso,
                context: {
                    appointmentId: 4201,
                    phoneLast4: '4567',
                    requestedDate: '2026-03-13',
                    requestedTime: '10:30',
                },
            },
            {
                id: 913,
                ticketId: 1603,
                ticketCode: 'A-1603',
                patientInitials: 'MD',
                reason: 'clinical_redirect',
                reasonLabel: 'Derivacion clinica',
                status: 'pending',
                source: 'assistant',
                createdAt: nowIso,
                updatedAt: nowIso,
            },
        ];
        let queueState = {
            updatedAt: nowIso,
            waitingCount: 0,
            calledCount: 0,
            estimatedWaitMin: 0,
            delayReason: '',
            assistancePendingCount: 0,
            activeHelpRequests: [],
            recentResolvedHelpRequests: [],
            counts: {
                waiting: 0,
                called: 0,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNow: [],
            nextTickets: [],
        };

        function syncQueueHelpState() {
            const updatedAt = new Date().toISOString();
            const activeHelpRequests = queueHelpRequests.filter((request) =>
                ['pending', 'attending'].includes(String(request.status || ''))
            );
            const recentResolvedHelpRequests = queueHelpRequests
                .filter(
                    (request) => String(request.status || '') === 'resolved'
                )
                .sort(
                    (left, right) =>
                        Date.parse(
                            String(right.resolvedAt || right.updatedAt || '')
                        ) -
                        Date.parse(
                            String(left.resolvedAt || left.updatedAt || '')
                        )
                )
                .slice(0, 5);
            queueTickets = queueTickets.map((ticket) => {
                const activeHelpRequest =
                    activeHelpRequests.find(
                        (request) =>
                            Number(request.ticketId || 0) ===
                            Number(ticket.id || 0)
                    ) || null;
                if (!activeHelpRequest) {
                    return {
                        ...ticket,
                        needsAssistance: false,
                        assistanceRequestStatus: '',
                        activeHelpRequestId: null,
                    };
                }

                return {
                    ...ticket,
                    needsAssistance: true,
                    assistanceRequestStatus: String(
                        activeHelpRequest.status || 'pending'
                    ),
                    activeHelpRequestId:
                        Number(activeHelpRequest.id || 0) || null,
                    assistanceReason: String(
                        activeHelpRequest.reason || ''
                    ).trim(),
                    assistanceReasonLabel: String(
                        activeHelpRequest.reasonLabel || ''
                    ).trim(),
                };
            });

            const waitingTickets = queueTickets.filter(
                (ticket) => ticket.status === 'waiting'
            );
            queueState = {
                updatedAt,
                waitingCount: waitingTickets.length,
                calledCount: queueTickets.filter(
                    (ticket) => ticket.status === 'called'
                ).length,
                estimatedWaitMin: waitingTickets.length * 8,
                delayReason: activeHelpRequests.length
                    ? 'Recepcion atendiendo solicitudes de apoyo.'
                    : '',
                assistancePendingCount: activeHelpRequests.filter(
                    (request) => String(request.status || '') === 'pending'
                ).length,
                activeHelpRequests,
                recentResolvedHelpRequests,
                counts: {
                    waiting: waitingTickets.length,
                    called: queueTickets.filter(
                        (ticket) => ticket.status === 'called'
                    ).length,
                    completed: queueTickets.filter(
                        (ticket) => ticket.status === 'completed'
                    ).length,
                    no_show: queueTickets.filter(
                        (ticket) => ticket.status === 'no_show'
                    ).length,
                    cancelled: queueTickets.filter(
                        (ticket) => ticket.status === 'cancelled'
                    ).length,
                },
                callingNow: [],
                nextTickets: waitingTickets.map((ticket, index) => ({
                    id: ticket.id,
                    ticketCode: ticket.ticketCode,
                    patientInitials: ticket.patientInitials,
                    position: index + 1,
                    queueType: ticket.queueType,
                    priorityClass: ticket.priorityClass,
                    needsAssistance: Boolean(ticket.needsAssistance),
                    assistanceRequestStatus:
                        ticket.assistanceRequestStatus || '',
                    activeHelpRequestId: ticket.activeHelpRequestId || null,
                    assistanceReason: ticket.assistanceReason || '',
                    assistanceReasonLabel: ticket.assistanceReasonLabel || '',
                })),
            };
        }

        syncQueueHelpState();

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_guidance_shortcuts',
        });

        await installAdminQueueApiMocks(page, {
            appointments,
            availability,
            queueTickets: () => queueTickets,
            queueState: () => queueState,
            handleRoute: async ({
                route,
                resource,
                intendedMethod,
                payload,
                fulfillJson,
            }) => {
                if (
                    resource === 'queue-help-request' &&
                    intendedMethod === 'PATCH'
                ) {
                    const helpRequestId = Number(payload.id || 0);
                    const status = String(
                        payload.status || 'pending'
                    ).toLowerCase();
                    const ticketId = Number(
                        payload.ticketId || payload.ticket_id || 0
                    );
                    let updatedRequest = null;

                    queueHelpRequests = queueHelpRequests.map((requestItem) => {
                        const matchesById =
                            helpRequestId > 0 &&
                            Number(requestItem.id || 0) === helpRequestId;
                        const matchesByTicket =
                            helpRequestId <= 0 &&
                            ticketId > 0 &&
                            Number(requestItem.ticketId || 0) === ticketId &&
                            ['pending', 'attending'].includes(
                                String(requestItem.status || '')
                            );
                        if (!matchesById && !matchesByTicket) {
                            return requestItem;
                        }

                        updatedRequest = {
                            ...requestItem,
                            status,
                            updatedAt: new Date().toISOString(),
                            context:
                                payload.context &&
                                typeof payload.context === 'object'
                                    ? {
                                          ...(requestItem.context || {}),
                                          ...payload.context,
                                      }
                                    : requestItem.context || {},
                            ...(status === 'resolved'
                                ? { resolvedAt: new Date().toISOString() }
                                : {}),
                        };
                        return updatedRequest;
                    });

                    syncQueueHelpState();
                    await fulfillJson(route, {
                        ok: true,
                        data: {
                            helpRequest: updatedRequest,
                            queueState,
                        },
                    });
                    return true;
                }

                if (resource === 'queue-reprint' && intendedMethod === 'POST') {
                    reprintRequests += 1;
                    await fulfillJson(route, {
                        ok: true,
                        printed: true,
                        data: {
                            ticket: queueTickets.find(
                                (ticket) =>
                                    Number(ticket.id || 0) ===
                                    Number(payload.id || 0)
                            ),
                        },
                        print: {
                            ok: true,
                            errorCode: '',
                            message: 'ok',
                        },
                    });
                    return true;
                }

                return false;
            },
        });

        await page.goto(adminUrl());
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Problema de impresion'
        );
        await expect(
            page.locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="911"][data-queue-help-request-status="attending"]'
            )
        ).toContainText('Marcar en atencion');
        await expect(
            page.locator(
                '[data-action="queue-reprint-ticket"][data-queue-help-request-id="911"][data-queue-guidance-shortcut="reprint"]'
            )
        ).toContainText('Reimprimir ticket');
        await expect(
            page.locator(
                '[data-action="queue-open-appointments"][data-queue-help-request-id="912"][data-queue-guidance-shortcut="appointments"]'
            )
        ).toContainText('Validar cita');
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Contexto operativo'
        );
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'tel. *4567'
        );
        await expect(
            page.locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="913"][data-queue-help-request-status="attending"]'
            )
        ).toContainText('Derivar a doctor');

        await page
            .locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="913"][data-queue-help-request-status="attending"]'
            )
            .click();
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Cerrar derivacion'
        );

        await page
            .locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="911"][data-queue-help-request-status="attending"]'
            )
            .click();
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'En atencion'
        );

        await page
            .locator(
                '[data-action="queue-reprint-ticket"][data-queue-help-request-id="911"][data-queue-guidance-shortcut="reprint"]'
            )
            .click();
        await expect.poll(() => reprintRequests).toBe(1);

        await page
            .locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="911"][data-queue-help-request-status="resolved"]'
            )
            .click();
        await expect(
            page.locator('#queueReceptionGuidanceList')
        ).not.toContainText('A-1601');
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'A-1602'
        );
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'A-1603'
        );

        await page
            .locator(
                '[data-action="queue-open-appointments"][data-queue-help-request-id="912"][data-queue-guidance-shortcut="appointments"]'
            )
            .click();
        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page.locator('#searchAppointments')).toHaveValue('4567');
        await expect(
            page.locator(
                '#appointmentsTableBody tr[data-appointment-id="4201"]'
            )
        ).toContainText('Carla Torres');
        await expect(page.locator('#appointmentsFocusLabel')).toContainText(
            'Revision desde sala'
        );
        await expect(page.locator('#appointmentsFocusPatient')).toContainText(
            'Carla Torres'
        );
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            'A-1602'
        );
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            'Cita no encontrada'
        );
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            'Cita vigente'
        );
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            'tel. *4567'
        );
        await expect(
            page.locator(
                '[data-action="appointment-review-confirm-appointment"][data-review-ticket-id="1602"]'
            )
        ).toContainText('Confirmar cita vigente');
        await expect(
            page.locator(
                '[data-action="appointment-review-help-request-status"][data-review-ticket-id="1602"][data-review-help-request-status="attending"]'
            )
        ).toContainText('Marcar apoyo en atencion');

        await page
            .locator(
                '[data-action="appointment-review-help-request-status"][data-review-ticket-id="1602"][data-review-help-request-status="attending"]'
            )
            .click();
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            'En atencion'
        );
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            'Cita vigente'
        );

        await page
            .locator(
                '[data-action="appointment-review-open-queue"][data-review-ticket-id="1602"]'
            )
            .click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(
            page.locator('#queueTableBody tr[data-queue-id="1602"]')
        ).toContainText('A-1602');
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Validacion actual: Cita vigente'
        );
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Cierre recomendado ahora: Cita vigente confirmada'
        );
        await expect(
            page.locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="912"][data-queue-help-request-status="resolved"]'
            )
        ).toContainText('Confirmar cita vigente');

        await page
            .locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="912"][data-queue-help-request-status="resolved"]'
            )
            .click();
        await expect(page.locator('#queueActivityList')).toContainText(
            'Apoyo resuelto 1602 · Cita vigente confirmada'
        );
        await expect(
            page.locator('#queueReceptionGuidanceList')
        ).not.toContainText('A-1602');
        await expect(page.locator('#queueRecentResolutionsList')).toContainText(
            'A-1602'
        );
        await expect(page.locator('#queueRecentResolutionsList')).toContainText(
            'Cita vigente confirmada'
        );
    });

    test('agenda lee disponibilidad real y abre el dia pedido para conflicto horario', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const availability = {
            '2026-03-14': ['09:00', '09:30'],
        };
        const queueTickets = [
            {
                id: 1701,
                ticketCode: 'A-1701',
                queueType: 'appointment',
                patientInitials: 'LS',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: nowIso,
                phoneLast4: '8899',
            },
        ];
        const queueState = {
            updatedAt: nowIso,
            waitingCount: 1,
            calledCount: 0,
            estimatedWaitMin: 8,
            delayReason: 'Recepcion validando agenda.',
            assistancePendingCount: 1,
            activeHelpRequests: [
                {
                    id: 971,
                    ticketId: 1701,
                    ticketCode: 'A-1701',
                    patientInitials: 'LS',
                    reason: 'schedule_taken',
                    reasonLabel: 'Horario ocupado',
                    status: 'pending',
                    source: 'assistant',
                    createdAt: nowIso,
                    updatedAt: nowIso,
                    context: {
                        phoneLast4: '8899',
                        requestedDate: '2026-03-14',
                        requestedTime: '11:00',
                    },
                },
            ],
            recentResolvedHelpRequests: [],
            counts: {
                waiting: 1,
                called: 0,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNow: [],
            nextTickets: [
                {
                    id: 1701,
                    ticketCode: 'A-1701',
                    patientInitials: 'LS',
                    position: 1,
                    queueType: 'appointment',
                    priorityClass: 'appt_current',
                    needsAssistance: true,
                    assistanceRequestStatus: 'pending',
                    activeHelpRequestId: 971,
                    assistanceReason: 'schedule_taken',
                    assistanceReasonLabel: 'Horario ocupado',
                },
            ],
        };

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_schedule_conflict',
        });

        await installAdminQueueApiMocks(page, {
            availability,
            queueTickets,
            queueState,
            handleRoute: async ({
                route,
                resource,
                intendedMethod,
                payload,
                fulfillJson,
            }) => {
                if (
                    resource === 'queue-help-request' &&
                    intendedMethod === 'PATCH'
                ) {
                    const nextStatus = String(payload.status || 'pending')
                        .trim()
                        .toLowerCase();
                    const updatedAt = new Date().toISOString();
                    const requestItem = queueState.activeHelpRequests[0];
                    const updatedRequest = {
                        ...requestItem,
                        status: nextStatus,
                        updatedAt,
                        context:
                            payload.context &&
                            typeof payload.context === 'object'
                                ? {
                                      ...(requestItem.context || {}),
                                      ...payload.context,
                                  }
                                : requestItem.context || {},
                        ...(nextStatus === 'attending'
                            ? { attendedAt: updatedAt }
                            : {}),
                        ...(nextStatus === 'resolved'
                            ? { resolvedAt: updatedAt }
                            : {}),
                    };

                    queueState.activeHelpRequests =
                        nextStatus === 'resolved' ? [] : [updatedRequest];
                    queueState.assistancePendingCount =
                        nextStatus === 'pending' ? 1 : 0;
                    queueState.recentResolvedHelpRequests =
                        nextStatus === 'resolved' ? [updatedRequest] : [];
                    queueState.updatedAt = updatedAt;

                    await fulfillJson(route, {
                        ok: true,
                        data: {
                            helpRequest: updatedRequest,
                            queueState,
                        },
                    });
                    return true;
                }

                return false;
            },
        });

        await page.goto(adminUrl());
        await page.locator('.nav-item[data-section="queue"]').click();
        await page
            .locator(
                '[data-action="queue-open-appointments"][data-queue-help-request-id="971"]'
            )
            .click();

        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            'Slot no publicado'
        );
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            '11:00 no aparece'
        );
        await expect(
            page.locator(
                '[data-action="appointment-review-open-availability"][data-review-requested-date="2026-03-14"]'
            )
        ).toContainText('Revisar disponibilidad');
        await expect(
            page.locator(
                '[data-action="appointment-review-help-request-status"][data-review-ticket-id="1701"][data-review-help-request-status="attending"]'
            )
        ).toContainText('Marcar apoyo en atencion');

        await page
            .locator(
                '[data-action="appointment-review-help-request-status"][data-review-ticket-id="1701"][data-review-help-request-status="attending"]'
            )
            .click();
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            'En atencion'
        );

        await page
            .locator(
                '[data-action="appointment-review-open-availability"][data-review-requested-date="2026-03-14"]'
            )
            .click();

        await expect(page.locator('#availability')).toHaveClass(/active/);
        await expect(page.locator('#selectedDate')).toHaveText('2026-03-14');
        await expect(page.locator('#timeSlotsList')).toContainText('09:00');
        await expect(page.locator('#timeSlotsList')).toContainText('09:30');
        await expect(page.locator('#timeSlotsList')).not.toContainText('11:00');
        await expect(page.locator('#availabilityReviewContext')).toContainText(
            'Disponibilidad abierta desde sala'
        );
        await expect(page.locator('#availabilityReviewContext')).toContainText(
            'Slot no publicado'
        );
        await expect(
            page.locator(
                '#availabilityReviewContext [data-action="appointment-review-open-queue"][data-review-ticket-id="1701"]'
            )
        ).toContainText('Volver a cola con conflicto horario');

        await page
            .locator(
                '#availabilityReviewContext [data-action="appointment-review-open-queue"][data-review-ticket-id="1701"]'
            )
            .click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Validacion actual: Slot no publicado'
        );
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Cierre recomendado ahora: Horario ya no publicado'
        );
        await expect(
            page.locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="971"][data-queue-help-request-status="resolved"]'
            )
        ).toContainText('Confirmar horario no publicado');

        await page
            .locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="971"][data-queue-help-request-status="resolved"]'
            )
            .click();
        await expect(page.locator('#queueRecentResolutionsList')).toContainText(
            'Horario ya no publicado'
        );
    });

    test('permite llamar siguiente ticket en consultorio 1', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 501,
                ticketCode: 'A-501',
                queueType: 'appointment',
                patientInitials: 'EP',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 120000).toISOString(),
            },
            {
                id: 502,
                ticketCode: 'A-502',
                queueType: 'walk_in',
                patientInitials: 'JP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date().toISOString(),
            },
        ];

        let queueState = {
            updatedAt: new Date().toISOString(),
            waitingCount: 2,
            calledCount: 0,
            counts: {
                waiting: 2,
                called: 0,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNow: [],
            nextTickets: [
                {
                    id: 501,
                    ticketCode: 'A-501',
                    patientInitials: 'EP',
                    position: 1,
                },
                {
                    id: 502,
                    ticketCode: 'A-502',
                    patientInitials: 'JP',
                    position: 2,
                },
            ],
        };

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_admin',
        });

        await installAdminQueueApiMocks(page, {
            queueTickets: () => queueTickets,
            queueState: () => queueState,
            healthPayload: {
                ok: true,
                status: 'ok',
                checks: {
                    publicSync: {
                        configured: true,
                        healthy: true,
                        state: 'ok',
                        deployedCommit:
                            '3de287e27f2f5034f6f471234567890abcdef12',
                        headDrift: false,
                        ageSeconds: 32,
                        failureReason: '',
                    },
                },
            },
            handleRoute: async ({ route, resource, fulfillJson }) => {
                if (resource === 'queue-call-next') {
                    const calledTicket = {
                        ...queueTickets[0],
                        status: 'called',
                        assignedConsultorio: 1,
                        calledAt: new Date().toISOString(),
                    };
                    queueTickets = [calledTicket, queueTickets[1]];
                    queueState = {
                        ...queueState,
                        updatedAt: new Date().toISOString(),
                        waitingCount: 1,
                        calledCount: 1,
                        counts: {
                            waiting: 1,
                            called: 1,
                            completed: 0,
                            no_show: 0,
                            cancelled: 0,
                        },
                        callingNow: [calledTicket],
                        nextTickets: [
                            {
                                id: 502,
                                ticketCode: 'A-502',
                                patientInitials: 'JP',
                                position: 1,
                            },
                        ],
                    };
                    await fulfillJson(route, {
                        ok: true,
                        data: {
                            ticket: calledTicket,
                            queueState,
                        },
                    });
                    return true;
                }

                if (resource === 'queue-ticket') {
                    await fulfillJson(route, {
                        ok: true,
                        data: {
                            ticket: queueTickets[0],
                            queueState,
                        },
                    });
                    return true;
                }

                if (resource === 'queue-reprint') {
                    await fulfillJson(route, {
                        ok: true,
                        printed: false,
                        print: {
                            ok: true,
                            errorCode: 'printer_disabled',
                            message: 'disabled',
                        },
                    });
                    return true;
                }

                return false;
            },
        });

        await page.goto(adminUrl(), { waitUntil: 'domcontentloaded' });
        await expect(page.locator('#adminDashboard')).toBeVisible({
            timeout: 15000,
        });

        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('2');
        await expect(page.locator('#queueSyncStatus')).toContainText('vivo');

        await page
            .locator(
                '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first()
            .click();

        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');
        await expect(page.locator('#queueC1Now')).toContainText('A-501');
        await expect(page.locator('#queueTableBody')).toContainText('A-501');
        await expect(page.locator('#queueReleaseC1')).toContainText('A-501');
    });

    test('triage de cola aplica filtros SLA y busqueda por ticket', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 900,
                ticketCode: 'A-900',
                queueType: 'appointment',
                patientInitials: 'ER',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
            },
            {
                id: 901,
                ticketCode: 'A-901',
                queueType: 'walk_in',
                patientInitials: 'JP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
            {
                id: 902,
                ticketCode: 'A-902',
                queueType: 'appointment',
                patientInitials: 'MC',
                priorityClass: 'appt_current',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];

        const queueState = {
            updatedAt: new Date().toISOString(),
            waitingCount: 2,
            calledCount: 1,
            counts: {
                waiting: 2,
                called: 1,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNow: [queueTickets[2]],
            nextTickets: [
                {
                    id: 900,
                    ticketCode: 'A-900',
                    patientInitials: 'ER',
                    position: 1,
                },
                {
                    id: 901,
                    ticketCode: 'A-901',
                    patientInitials: 'JP',
                    position: 2,
                },
            ],
        };

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_triage',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'health') {
                return json(route, {
                    ok: true,
                    status: 'ok',
                    checks: {
                        publicSync: {
                            configured: true,
                            healthy: true,
                            state: 'ok',
                            deployedCommit:
                                '3de287e27f2f5034f6f471234567890abcdef12',
                            headDrift: false,
                            ageSeconds: 32,
                            failureReason: '',
                        },
                    },
                });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueTriageToolbar')).toBeVisible();
        await expect(page.locator('#queueTriageSummary')).toContainText(
            'riesgo'
        );

        await page.locator('[data-queue-filter="sla_risk"]').click();
        await expect(page.locator('#queueTableBody tr')).toHaveCount(1);
        await expect(page.locator('#queueTableBody')).toContainText('A-900');
        await expect(page.locator('#queueTableBody')).not.toContainText(
            'A-901'
        );

        await page.locator('[data-queue-filter="all"]').click();
        await page.fill('#queueSearchInput', 'A-901');
        await expect(page.locator('#queueTableBody')).toContainText('A-901');
        await expect(page.locator('#queueTableBody')).not.toContainText(
            'A-900'
        );

        await page.locator('[data-action="queue-clear-search"]').click();
        await expect(page.locator('#queueSearchInput')).toHaveValue('');
        await expect(page.locator('#queueTableBody')).toContainText('A-900');
    });

    test('watchdog realtime marca cola estancada y deja traza operativa', async ({
        page,
    }) => {
        const staleUpdatedAt = new Date(Date.now() - 75 * 1000).toISOString();
        const queueTickets = [
            {
                id: 930,
                ticketCode: 'A-930',
                queueType: 'appointment',
                patientInitials: 'LR',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = {
            updatedAt: staleUpdatedAt,
            waitingCount: 1,
            calledCount: 0,
            counts: {
                waiting: 1,
                called: 0,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNow: [],
            nextTickets: [
                {
                    id: 930,
                    ticketCode: 'A-930',
                    patientInitials: 'LR',
                    position: 1,
                },
            ],
        };

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_watchdog',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'health') {
                return json(route, {
                    ok: true,
                    status: 'ok',
                    checks: {
                        publicSync: {
                            configured: true,
                            healthy: true,
                            state: 'ok',
                            deployedCommit:
                                '3de287e27f2f5034f6f471234567890abcdef12',
                            headDrift: false,
                            ageSeconds: 32,
                            failureReason: '',
                        },
                    },
                });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(page.locator('#queueActivityPanel')).toBeVisible();
        await expect
            .poll(async () => {
                const text = await page
                    .locator('#queueSyncStatus')
                    .textContent();
                return text || '';
            })
            .toContain('Watchdog');
        await expect
            .poll(async () => {
                const state = await page
                    .locator('#queueSyncStatus')
                    .getAttribute('data-state');
                return state || '';
            })
            .toContain('reconnecting');
        await expect(page.locator('#queueActivityList')).toContainText(
            'Watchdog de cola'
        );
    });

    test('atajos de teclado en turnero aplican filtro SLA y accion masiva', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 910,
                ticketCode: 'A-910',
                queueType: 'appointment',
                patientInitials: 'ER',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
            },
            {
                id: 911,
                ticketCode: 'A-911',
                queueType: 'walk_in',
                patientInitials: 'JP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 912,
                ticketCode: 'A-912',
                queueType: 'appointment',
                patientInitials: 'MC',
                priorityClass: 'appt_current',
                status: 'called',
                assignedConsultorio: 2,
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
                createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            },
        ];

        let queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_shortcuts',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-ticket') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const action = String(body.action || '').toLowerCase();
                const idx = queueTickets.findIndex(
                    (ticket) => Number(ticket.id) === ticketId
                );
                if (idx >= 0) {
                    if (action === 'no_show') {
                        queueTickets[idx] = {
                            ...queueTickets[idx],
                            status: 'no_show',
                            assignedConsultorio: null,
                            completedAt: new Date().toISOString(),
                        };
                    } else if (action === 'cancelar') {
                        queueTickets[idx] = {
                            ...queueTickets[idx],
                            status: 'cancelled',
                            assignedConsultorio: null,
                            completedAt: new Date().toISOString(),
                        };
                    } else if (action === 'completar') {
                        queueTickets[idx] = {
                            ...queueTickets[idx],
                            status: 'completed',
                            completedAt: new Date().toISOString(),
                        };
                    }
                }
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets[idx],
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);

        await page.keyboard.press('Alt+Shift+W');
        await expect(page.locator('#queueTableBody tr')).toHaveCount(2);
        await expect(page.locator('#queueTableBody')).toContainText('A-910');
        await expect(page.locator('#queueTableBody')).toContainText('A-911');

        await page.keyboard.press('Alt+Shift+C');
        await expect(page.locator('#queueTableBody tr')).toHaveCount(1);
        await expect(page.locator('#queueTableBody')).toContainText('A-912');

        await page.keyboard.press('Alt+Shift+A');
        await expect(page.locator('#queueTableBody')).toContainText('A-910');
        await expect(page.locator('#queueTableBody')).toContainText('A-912');

        await page.keyboard.press('Alt+Shift+L');
        await expect(page.locator('#queueTableBody tr')).toHaveCount(1);
        await expect(page.locator('#queueTableBody')).toContainText('A-910');

        let dialogMessage = '';
        page.once('dialog', async (dialog) => {
            dialogMessage = dialog.message();
            await dialog.accept();
        });
        await page
            .locator(
                '[data-action="queue-bulk-action"][data-queue-action="no_show"]'
            )
            .evaluate((element) => {
                element.dispatchEvent(
                    new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                    })
                );
            });
        await expect.poll(() => dialogMessage).toContain('No show');

        await expect(page.locator('#queueTableBody')).toContainText(
            /Sin tickets en cola|No hay tickets para/
        );
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');

        await page.keyboard.press('Alt+Shift+O');
        await expect(page.locator('#queueTableBody')).toContainText('A-910');
        await expect(page.locator('#queueTableBody')).toContainText(
            'No asistio'
        );
        await expect(page.locator('#queueTableBody')).toContainText('A-911');
    });

    test('usa fallback queue-state cuando /data no incluye queue_tickets', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const queueState = {
            updatedAt: nowIso,
            waitingCount: 14,
            calledCount: 1,
            counts: {
                waiting: 14,
                called: 1,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNow: [
                {
                    id: 1599,
                    ticketCode: 'A-1599',
                    patientInitials: 'CC',
                    assignedConsultorio: 1,
                    calledAt: nowIso,
                    status: 'called',
                },
            ],
            nextTickets: Array.from({ length: 10 }, (_item, index) => ({
                id: 1501 + index,
                ticketCode: `A-${1501 + index}`,
                patientInitials: `Q${index}`,
                queueType: 'walk_in',
                priorityClass: 'walk_in',
                position: index + 1,
                createdAt: nowIso,
            })),
        };
        let queueStateRequests = 0;

        await installQueueAdminAuthMock(page, 'csrf_queue_state_fallback');
        await installAdminQueueApiMocks(page, {
            handleRoute: async ({ resource, route, fulfillJson }) => {
                if (resource === 'data') {
                    await fulfillJson(route, {
                        ok: true,
                        data: buildAdminDataPayload(),
                    });
                    return true;
                }

                if (resource === 'queue-state') {
                    queueStateRequests += 1;
                    await fulfillJson(route, {
                        ok: true,
                        data: queueState,
                    });
                    return true;
                }

                return false;
            },
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueTableBody')).toContainText('A-1501');
        await expect(page.locator('#queueTableBody')).toContainText('A-1510');
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('14');
        await expect(page.locator('#queueTriageSummary')).toContainText(
            'fallback parcial'
        );
        await expect(page.locator('#queueNextAdminList')).toContainText(
            'Mostrando primeros 10 de 14 en espera'
        );
        await expect.poll(() => queueStateRequests).toBeGreaterThan(0);
    });

    test('usa queueMeta como fallback local cuando /data no trae queue_tickets', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        let queueStateRequests = 0;
        const queueMetaPayload = {
            updatedAt: nowIso,
            waitingCount: 6,
            calledCount: 1,
            counts: {
                waiting: 6,
                called: 1,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNowByConsultorio: {
                1: {
                    id: 2601,
                    ticketCode: 'A-2601',
                    patientInitials: 'CV',
                    assignedConsultorio: 1,
                    calledAt: nowIso,
                    status: 'called',
                },
                2: null,
            },
            nextTickets: [
                {
                    id: 2602,
                    ticketCode: 'A-2602',
                    patientInitials: 'JP',
                    queueType: 'appointment',
                    priorityClass: 'appt_overdue',
                    position: 1,
                    createdAt: nowIso,
                },
                {
                    id: 2603,
                    ticketCode: 'A-2603',
                    patientInitials: 'LM',
                    queueType: 'walk_in',
                    priorityClass: 'walk_in',
                    position: 2,
                    createdAt: nowIso,
                },
            ],
        };

        await installQueueAdminAuthMock(page, 'csrf_queue_meta_fallback');
        await installAdminQueueApiMocks(page, {
            handleRoute: async ({ resource, route, fulfillJson }) => {
                if (resource === 'data') {
                    await fulfillJson(route, {
                        ok: true,
                        data: buildAdminDataPayload({
                            queueMeta: queueMetaPayload,
                        }),
                    });
                    return true;
                }

                if (resource === 'queue-state') {
                    queueStateRequests += 1;
                    await fulfillJson(
                        route,
                        {
                            ok: false,
                            error: 'queue-state should not be needed in this case',
                        },
                        500
                    );
                    return true;
                }

                return false;
            },
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('6');
        await expect(page.locator('#queueTableBody')).toContainText('A-2602');
        await expect(page.locator('#queueTableBody')).toContainText('A-2603');
        await expect(page.locator('#queueC1Now')).toContainText('A-2601');
        await expect(page.locator('#queueTriageSummary')).toContainText(
            'fallback parcial'
        );
        await expect(page.locator('#queueSyncStatus')).toContainText(
            'fallback'
        );
        await expect.poll(() => queueStateRequests).toBe(0);
    });

    test('usa queue_state de /data como fallback local sin llamar /queue-state', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        let queueStateRequests = 0;
        const queueStatePayload = {
            updated_at: nowIso,
            waiting_count: 4,
            called_count: 1,
            counts: {
                waiting: 4,
                called: 1,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            calling_now_by_consultorio: {
                1: {
                    id: 3601,
                    ticket_code: 'A-3601',
                    patient_initials: 'CV',
                    assigned_consultorio: 1,
                    called_at: nowIso,
                    status: 'called',
                },
                2: null,
            },
            next_tickets: [
                {
                    id: 3602,
                    ticket_code: 'A-3602',
                    patient_initials: 'JP',
                    queue_type: 'appointment',
                    priority_class: 'appt_overdue',
                    position: 1,
                    created_at: nowIso,
                },
                {
                    id: 3603,
                    ticket_code: 'A-3603',
                    patient_initials: 'LM',
                    queue_type: 'walk_in',
                    priority_class: 'walk_in',
                    position: 2,
                    created_at: nowIso,
                },
            ],
        };

        await installQueueAdminAuthMock(page, 'csrf_queue_state_data_fallback');
        await installAdminQueueApiMocks(page, {
            handleRoute: async ({ resource, route, fulfillJson }) => {
                if (resource === 'data') {
                    await fulfillJson(route, {
                        ok: true,
                        data: buildAdminDataPayload({
                            queue_state: queueStatePayload,
                        }),
                    });
                    return true;
                }

                if (resource === 'queue-state') {
                    queueStateRequests += 1;
                    await fulfillJson(
                        route,
                        {
                            ok: false,
                            error: 'queue-state should not be needed for queue_state fallback',
                        },
                        500
                    );
                    return true;
                }

                return false;
            },
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('4');
        await expect(page.locator('#queueTableBody')).toContainText('A-3602');
        await expect(page.locator('#queueTableBody')).toContainText('A-3603');
        await expect(page.locator('#queueC1Now')).toContainText('A-3601');
        await expect(page.locator('#queueTriageSummary')).toContainText(
            'fallback parcial'
        );
        await expect(page.locator('#queueSyncStatus')).toContainText(
            'fallback'
        );
        await expect.poll(() => queueStateRequests).toBe(0);
    });

    test('evita duplicar llamado cuando hay doble clic en rafaga para el mismo consultorio', async ({
        page,
    }) => {
        let queueCallNextRequests = 0;
        let queueTickets = [
            {
                id: 951,
                ticketCode: 'A-951',
                queueType: 'appointment',
                patientInitials: 'EP',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_burst',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next') {
                queueCallNextRequests += 1;
                await new Promise((resolve) => setTimeout(resolve, 250));
                queueTickets = [
                    {
                        ...queueTickets[0],
                        status: 'called',
                        assignedConsultorio: 1,
                        calledAt: new Date().toISOString(),
                    },
                ];
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets[0],
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');

        await page
            .locator(
                '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first()
            .evaluate((button) => {
                const firstClick = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                });
                const secondClick = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                });
                button.dispatchEvent(firstClick);
                button.dispatchEvent(secondClick);
            });

        await expect(page.locator('#queueC1Now')).toContainText('A-951');
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('0');
        await expect.poll(() => queueCallNextRequests).toBe(1);
    });

    test('permite reintento despues de error transitorio en llamado de consultorio', async ({
        page,
    }) => {
        let queueCallNextRequests = 0;
        let queueTickets = [
            {
                id: 961,
                ticketCode: 'A-961',
                queueType: 'walk_in',
                patientInitials: 'JP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_retry',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next') {
                queueCallNextRequests += 1;
                if (queueCallNextRequests === 1) {
                    return json(
                        route,
                        { ok: false, error: 'Fallo temporal de backend' },
                        503
                    );
                }
                queueTickets = [
                    {
                        ...queueTickets[0],
                        status: 'called',
                        assignedConsultorio: 1,
                        calledAt: new Date().toISOString(),
                    },
                ];
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets[0],
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);

        const callC1Button = page.locator(
            '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
        );

        await callC1Button.first().click();
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');
        await expect(page.locator('#queueActivityList')).toContainText(
            'Error llamando siguiente en C1'
        );

        await callC1Button.first().click();
        await expect(page.locator('#queueC1Now')).toContainText('A-961');
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('0');
        await expect.poll(() => queueCallNextRequests).toBe(2);
    });

    test('llamados en paralelo para C1 y C2 asignan tickets distintos y conservan cola', async ({
        page,
    }) => {
        let queueCallNextRequests = 0;
        let queueTickets = [
            {
                id: 971,
                ticketCode: 'A-971',
                queueType: 'appointment',
                patientInitials: 'AA',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 972,
                ticketCode: 'A-972',
                queueType: 'appointment',
                patientInitials: 'BB',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
            {
                id: 973,
                ticketCode: 'A-973',
                queueType: 'walk_in',
                patientInitials: 'CC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_parallel_rooms',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next') {
                queueCallNextRequests += 1;
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                const nextWaiting = queueTickets.find(
                    (ticket) => ticket.status === 'waiting'
                );
                if (!nextWaiting) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos en espera' },
                        409
                    );
                }

                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === nextWaiting.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                const calledTicket = queueTickets.find(
                    (ticket) => ticket.id === nextWaiting.id
                );
                return json(route, {
                    ok: true,
                    data: {
                        ticket: calledTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('3');

        const callC1Button = page
            .locator(
                '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first();
        const callC2Button = page
            .locator(
                '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="2"]'
            )
            .first();

        await expect(callC1Button).toBeVisible();
        await expect(callC2Button).toBeVisible();
        await page.evaluate(() => {
            const c1 = document.querySelector(
                '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
            );
            const c2 = document.querySelector(
                '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="2"]'
            );
            if (!c1 || !c2) return;
            const clickC1 = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
            });
            const clickC2 = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
            });
            c1.dispatchEvent(clickC1);
            c2.dispatchEvent(clickC2);
        });

        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');
        await expect(page.locator('#queueTableBody')).toContainText('A-973');
        await expect.poll(() => queueCallNextRequests).toBe(2);

        const c1NowText =
            (await page.locator('#queueC1Now').textContent()) || '';
        const c2NowText =
            (await page.locator('#queueC2Now').textContent()) || '';
        const c1Code = (c1NowText.match(/A-\d+/) || [])[0] || '';
        const c2Code = (c2NowText.match(/A-\d+/) || [])[0] || '';

        expect(c1Code).toBeTruthy();
        expect(c2Code).toBeTruthy();
        expect(c1Code).not.toEqual(c2Code);
        expect([c1Code, c2Code]).toEqual(
            expect.arrayContaining(['A-971', 'A-972'])
        );
    });

    test('acciones de ticket (reasignar y completar) mantienen consistencia por consultorio', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 981,
                ticketCode: 'A-981',
                queueType: 'appointment',
                patientInitials: 'RR',
                priorityClass: 'appt_current',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 982,
                ticketCode: 'A-982',
                queueType: 'walk_in',
                patientInitials: 'WW',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_lifecycle',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const action = String(body.action || '').toLowerCase();
                const consultorio = Number(body.consultorio || 0);
                const ticketIndex = queueTickets.findIndex(
                    (ticket) => Number(ticket.id || 0) === ticketId
                );

                if (ticketIndex < 0) {
                    return json(
                        route,
                        { ok: false, error: 'Ticket no encontrado' },
                        404
                    );
                }

                const currentTicket = queueTickets[ticketIndex];
                if (
                    (action === 'reasignar' || action === 'reassign') &&
                    ![1, 2].includes(consultorio)
                ) {
                    return json(
                        route,
                        { ok: false, error: 'Consultorio invalido' },
                        400
                    );
                }

                const nowIso = new Date().toISOString();
                let updatedTicket = { ...currentTicket };

                if (action === 'reasignar' || action === 'reassign') {
                    updatedTicket = {
                        ...currentTicket,
                        assignedConsultorio: consultorio,
                    };
                } else if (
                    action === 'completar' ||
                    action === 'complete' ||
                    action === 'completed'
                ) {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'completed',
                        assignedConsultorio: null,
                        completedAt: nowIso,
                    };
                } else {
                    return json(
                        route,
                        { ok: false, error: 'Accion no soportada' },
                        400
                    );
                }

                queueTickets = queueTickets.map((ticket, index) =>
                    index === ticketIndex ? updatedTicket : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);

                return json(route, {
                    ok: true,
                    data: {
                        ticket: updatedTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'queue-call-next') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                const candidate = queueTickets.find(
                    (ticket) => ticket.status === 'waiting'
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos en espera' },
                        409
                    );
                }
                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === candidate.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => ticket.id === candidate.id
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);

        await expect(page.locator('#queueC1Now')).toContainText('A-981');
        await expect(page.locator('#queueC2Now')).toContainText('Sin llamado');
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');

        const rowA981 = page
            .locator('#queueTableBody tr')
            .filter({ hasText: 'A-981' })
            .first();

        await rowA981
            .locator(
                '[data-action="queue-ticket-action"][data-queue-action="reasignar"][data-queue-consultorio="2"]'
            )
            .click();

        await expect(page.locator('#queueC2Now')).toContainText('A-981');
        await expect(page.locator('#queueC1Now')).toContainText('Sin llamado');

        await rowA981
            .locator(
                '[data-action="queue-ticket-action"][data-queue-action="completar"]'
            )
            .click();

        await expect(page.locator('#queueC2Now')).toContainText('Sin llamado');
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');
        await expect(rowA981).toContainText('Completado');

        await page
            .locator(
                '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first()
            .click();

        await expect(page.locator('#queueC1Now')).toContainText('A-982');
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('0');
    });

    test('despacho sugerido reasigna ticket general y luego permite llamarlo', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1202,
                ticketCode: 'A-1202',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_dispatch',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                        clinicId: 'clinica-norte-demo',
                                        profileSource: 'remote',
                                        surfaceContractState: 'ready',
                                        surfaceRouteExpected:
                                            '/operador-turnos.html',
                                        surfaceRouteCurrent:
                                            '/operador-turnos.html',
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const consultorio = Number(body.consultorio || 0);
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === ticketId
                        ? {
                              ...ticket,
                              assignedConsultorio: consultorio,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => Number(ticket.id || 0) === ticketId
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                const candidate = queueTickets.find(
                    (ticket) =>
                        ticket.status === 'waiting' &&
                        Number(ticket.assignedConsultorio || 0) === consultorio
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos asignados' },
                        409
                    );
                }
                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === candidate.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => ticket.id === candidate.id
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await page.locator('#queueDomainOperations').dispatchEvent('click');
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'operations'
        );
        await expect(page.locator('#queueDispatchDeck')).toBeVisible();
        await expect(page.locator('#queueDispatchDeckStatus')).toContainText(
            '1 acción'
        );
        await expect(page.locator('#queueDispatchHeadline_c1')).toContainText(
            'puede absorber A-1202'
        );
        await expect(page.locator('#queueDispatchPrimary_c1')).toContainText(
            'Asignar A-1202'
        );

        await page.locator('#queueDispatchPrimary_c1').click();

        await expect(page.locator('#queueDispatchPrimary_c1')).toContainText(
            'Llamar A-1202'
        );
        await expect(page.locator('#queueDispatchTarget_c1')).toContainText(
            'A-1202'
        );

        await page.locator('#queueDispatchPrimary_c1').click();

        await expect(page.locator('#queueC1Now')).toContainText('A-1202');
        await expect(page.locator('#queueDispatchCard_c1')).toContainText(
            'En atención'
        );
    });

    test('seguimiento de atencion re-llama y prepara el siguiente ticket del consultorio', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1211,
                ticketCode: 'A-1211',
                queueType: 'appointment',
                patientInitials: 'AT',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
            },
            {
                id: 1212,
                ticketCode: 'A-1212',
                queueType: 'walk_in',
                patientInitials: 'NX',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_attention_deck',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const action = String(body.action || '').toLowerCase();
                const consultorio = Number(body.consultorio || 0);
                const ticketIndex = queueTickets.findIndex(
                    (ticket) => Number(ticket.id || 0) === ticketId
                );
                if (ticketIndex < 0) {
                    return json(
                        route,
                        { ok: false, error: 'Ticket no encontrado' },
                        404
                    );
                }

                const currentTicket = queueTickets[ticketIndex];
                const nowIso = new Date().toISOString();
                let updatedTicket = { ...currentTicket };

                if (action === 're-llamar' || action === 'rellamar') {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'called',
                        assignedConsultorio:
                            Number(currentTicket.assignedConsultorio || 1) || 1,
                        calledAt: nowIso,
                    };
                } else if (action === 'completar') {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'completed',
                        assignedConsultorio: null,
                        completedAt: nowIso,
                    };
                } else if (action === 'liberar') {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'waiting',
                        assignedConsultorio: null,
                        calledAt: '',
                    };
                }

                queueTickets = queueTickets.map((ticket, index) =>
                    index === ticketIndex ? updatedTicket : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: updatedTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                const candidate = queueTickets.find(
                    (ticket) =>
                        ticket.status === 'waiting' &&
                        Number(ticket.assignedConsultorio || 0) === consultorio
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos asignados' },
                        409
                    );
                }
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === Number(candidate.id || 0)
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) =>
                                Number(ticket.id || 0) ===
                                Number(candidate.id || 0)
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(page.locator('#queueAttentionDeck')).toBeVisible();
        await expect(page.locator('#queueAttentionDeckTitle')).toContainText(
            'Seguimiento de atención'
        );
        await expect(page.locator('#queueAttentionDeckStatus')).toContainText(
            '1 llamado'
        );
        await expect(page.locator('#queueAttentionHeadline_c1')).toContainText(
            'A-1211'
        );
        await expect(
            page.locator('#queueAttentionRecommendation_c1')
        ).toContainText('Re-llamar A-1211');
        await expect(page.locator('#queueAttentionPrimary_c1')).toContainText(
            'Re-llamar A-1211'
        );

        await page.locator('#queueAttentionPrimary_c1').click();

        await expect(page.locator('#queueAttentionPrimary_c1')).toContainText(
            /Abrir Operador (?:Consultorio\s+1|C1)/
        );
        await expect(
            page.locator('#queueAttentionRecommendation_c1')
        ).toContainText('Completa A-1211 cuando salga para llamar A-1212');

        await page.locator('#queueAttentionComplete_c1').click();

        await expect(page.locator('#queueAttentionCurrent_c1')).toContainText(
            'Sin llamado activo'
        );
        await expect(page.locator('#queueAttentionPrimary_c1')).toContainText(
            'Llamar A-1212'
        );
        await expect(page.locator('#queueAttentionNext_c1')).toContainText(
            'A-1212'
        );
    });

    test('resolucion rapida prepara no show y confirma el cierre desde el hub', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1221,
                ticketCode: 'A-1221',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 21 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1222,
                ticketCode: 'A-1222',
                queueType: 'walk_in',
                patientInitials: 'YL',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_resolution_deck',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const action = String(body.action || '').toLowerCase();
                const ticketIndex = queueTickets.findIndex(
                    (ticket) => Number(ticket.id || 0) === ticketId
                );
                if (ticketIndex < 0) {
                    return json(
                        route,
                        { ok: false, error: 'Ticket no encontrado' },
                        404
                    );
                }

                const currentTicket = queueTickets[ticketIndex];
                const nowIso = new Date().toISOString();
                let updatedTicket = { ...currentTicket };
                if (action === 'no_show') {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'no_show',
                        assignedConsultorio: null,
                        completedAt: nowIso,
                    };
                } else if (action === 'completar') {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'completed',
                        assignedConsultorio: null,
                        completedAt: nowIso,
                    };
                } else if (action === 'liberar') {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'waiting',
                        assignedConsultorio: null,
                        calledAt: '',
                    };
                }

                queueTickets = queueTickets.map((ticket, index) =>
                    index === ticketIndex ? updatedTicket : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: updatedTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                const candidate = queueTickets.find(
                    (ticket) =>
                        ticket.status === 'waiting' &&
                        Number(ticket.assignedConsultorio || 0) === consultorio
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos asignados' },
                        409
                    );
                }
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === Number(candidate.id || 0)
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) =>
                                Number(ticket.id || 0) ===
                                Number(candidate.id || 0)
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(page.locator('#queueResolutionDeck')).toBeVisible();
        await expect(page.locator('#queueResolutionDeckTitle')).toContainText(
            'Resolución rápida'
        );
        await expect(page.locator('#queueResolutionPrimary_c1')).toContainText(
            'Completar A-1221'
        );
        await expect(
            page.locator('#queueResolutionNoShowPreview_c1')
        ).toContainText('A-1222');

        await page.locator('#queueResolutionNoShow_c1').click();

        await expect(page.locator('#queueSensitiveConfirmDialog')).toBeHidden();
        await expect(page.locator('#queueResolutionPending')).toContainText(
            /marcar no show A-1221 en (?:Consultorio\s+1|C1)/
        );

        await page.locator('#queueResolutionPendingConfirm').click();

        await expect(page.locator('#queueSensitiveConfirmDialog')).toBeHidden();
        await expect(page.locator('#queueResolutionCurrent_c1')).toContainText(
            'Sin ticket en cierre'
        );
        await expect(page.locator('#queueResolutionPrimary_c1')).toContainText(
            'Llamar A-1222'
        );
    });

    test('atajo por ticket localiza un turno general y lo reasigna sin bajar a la tabla', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1228,
                ticketCode: 'A-1228',
                queueType: 'walk_in',
                patientInitials: 'MN',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1229,
                ticketCode: 'A-1229',
                queueType: 'appointment',
                patientInitials: 'QP',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_ticket_lookup',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C2 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C2 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c2',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const consultorio = Number(body.consultorio || 0);
                const action = String(body.action || '')
                    .trim()
                    .toLowerCase();
                queueTickets = queueTickets.map((ticket) => {
                    if (Number(ticket.id || 0) !== ticketId) {
                        return ticket;
                    }
                    if (action === 'reasignar' || action === 'reassign') {
                        return {
                            ...ticket,
                            assignedConsultorio: consultorio,
                        };
                    }
                    if (action === 'completar' || action === 'complete') {
                        return {
                            ...ticket,
                            status: 'completed',
                            completedAt: new Date().toISOString(),
                        };
                    }
                    return ticket;
                });
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => Number(ticket.id || 0) === ticketId
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                const candidate = queueTickets.find(
                    (ticket) =>
                        ticket.status === 'waiting' &&
                        Number(ticket.assignedConsultorio || 0) === consultorio
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos asignados' },
                        409
                    );
                }
                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === candidate.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => Number(ticket.id || 0) === candidate.id
                        ),
                        queueState,
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();
        await expect(page.locator('#queueAppsHub')).toBeVisible();

        await expect(page.locator('#queueTicketLookup')).toBeVisible();
        await page.fill('#queueTicketLookupInput', 'A-1228');
        await page.locator('#queueTicketLookupSearchBtn').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1228'
        );
        await expect(page.locator('#queueTicketLookupHeadline')).toContainText(
            'cola general'
        );
        const queueLookupPrimary = page.locator('#queueTicketLookupPrimary');
        const queueLookupBadge = page.locator('#queueTicketLookupBadge');
        const badgeTargetText = await queueLookupBadge.textContent();
        const badgeTargetMatch = String(badgeTargetText || '').match(
            /(?:Consultorio\s+|C)([12])/i
        );
        const targetConsultorio = Number(
            badgeTargetMatch ? badgeTargetMatch[1] : 1
        );
        await expect(queueLookupBadge).toContainText(
            new RegExp(`Listo para (?:Consultorio\\s+|C)${targetConsultorio}`)
        );
        await expect(queueLookupPrimary).toContainText('Asignar a');

        await queueLookupPrimary.click();

        await expect
            .poll(
                () =>
                    queueTickets.find((ticket) => ticket.id === 1228)
                        ?.assignedConsultorio
            )
            .toBe(targetConsultorio);
        await expect(queueLookupBadge).toContainText(
            new RegExp(`Siguiente en (?:Consultorio\\s+|C)${targetConsultorio}`)
        );
        await expect(page.locator('#queueTicketLookupPrimary')).toContainText(
            'Llamar A-1228'
        );

        await page.locator('#queueTicketLookupPrimary').click();

        await expect
            .poll(
                () => queueTickets.find((ticket) => ticket.id === 1228)?.status
            )
            .toBe('called');
        await expect(page.locator('#queueTicketLookupBadge')).toContainText(
            'En atención C2'
        );
        await expect(page.locator('#queueTicketLookupPrimary')).toContainText(
            'Completar A-1228'
        );
    });

    test('ruta del ticket explica bloqueo y pivota al ticket activo del mismo consultorio', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1231,
                ticketCode: 'A-1231',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1232,
                ticketCode: 'A-1232',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1233,
                ticketCode: 'A-1233',
                queueType: 'walk_in',
                patientInitials: 'QP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_ticket_route',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await page.fill('#queueTicketLookupInput', 'A-1232');
        await page.locator('#queueTicketLookupSearchBtn').click();

        await expect(page.locator('#queueTicketRoute')).toBeVisible();
        await expect(page.locator('#queueTicketRouteTitle')).toContainText(
            'Ruta de A-1232'
        );
        await expect(page.locator('#queueTicketRouteLane')).toContainText('C1');
        await expect(page.locator('#queueTicketRoutePosition')).toContainText(
            '1 paso'
        );
        await expect(page.locator('#queueTicketRouteImpact')).toContainText(
            'A-1231'
        );
        await expect(
            page.locator('#queueTicketRoutePivotPrimary')
        ).toContainText('Ver ticket activo A-1231');

        await page.locator('#queueTicketRoutePivotPrimary').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1231'
        );
        await expect(page.locator('#queueTicketRouteTitle')).toContainText(
            'Ruta de A-1231'
        );
        await expect(page.locator('#queueTicketRoutePosition')).toContainText(
            'Paciente en atención'
        );
    });

    test('simulacion operativa proyecta el cierre y carga el siguiente ticket listo', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1241,
                ticketCode: 'A-1241',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1242,
                ticketCode: 'A-1242',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1243,
                ticketCode: 'A-1243',
                queueType: 'walk_in',
                patientInitials: 'QP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_ticket_simulation',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await page.fill('#queueTicketLookupInput', 'A-1241');
        await page.locator('#queueTicketLookupSearchBtn').click();

        await expect(page.locator('#queueTicketSimulation')).toBeVisible();
        await expect(page.locator('#queueTicketSimulationTitle')).toContainText(
            'A-1241'
        );
        await expect(
            page.locator('#queueTicketSimulationAction')
        ).toContainText('Completar A-1241');
        await expect(page.locator('#queueTicketSimulationAfter')).toContainText(
            'A-1242'
        );
        await expect(
            page.locator('#queueTicketSimulationFocusBtn')
        ).toContainText('A-1242');

        await page.locator('#queueTicketSimulationFocusBtn').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1242'
        );
        await expect(page.locator('#queueTicketSimulationTitle')).toContainText(
            'A-1242'
        );
        await expect(
            page.locator('#queueTicketSimulationAction')
        ).toContainText('Llamar A-1242');
    });

    test('proximos turnos arma la ronda inmediata y carga tickets al lookup', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1251,
                ticketCode: 'A-1251',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1252,
                ticketCode: 'A-1252',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1253,
                ticketCode: 'A-1253',
                queueType: 'walk_in',
                patientInitials: 'QP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1254,
                ticketCode: 'A-1254',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 1255,
                ticketCode: 'A-1255',
                queueType: 'walk_in',
                patientInitials: 'BT',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_next_turns',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueNextTurns')).toBeVisible();
        await expect(page.locator('#queueNextTurnsTitle')).toContainText(
            'Próximos turnos'
        );
        await expect(page.locator('#queueNextTurnsStep_c1_0')).toContainText(
            'Completar A-1251'
        );
        await expect(page.locator('#queueNextTurnsStep_c1_1')).toContainText(
            'Llamar A-1252'
        );
        await expect(
            page.locator('#queueNextTurnsStep_general_0')
        ).toContainText('Asignar A-1254 a C1');

        await page.locator('#queueNextTurnsLoad_c1_1').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1252'
        );
        await expect(page.locator('#queueTicketLookupHeadline')).toContainText(
            /(?:Consultorio\s+1|C1)/
        );
    });

    test('ronda maestra prioriza la secuencia global y carga el ticket elegido', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1261,
                ticketCode: 'A-1261',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1262,
                ticketCode: 'A-1262',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1263,
                ticketCode: 'A-1263',
                queueType: 'walk_in',
                patientInitials: 'QP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1264,
                ticketCode: 'A-1264',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_master_sequence',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueMasterSequence')).toBeVisible();
        await expect(page.locator('#queueMasterSequenceTitle')).toContainText(
            'Ronda maestra'
        );
        await expect(
            page.locator('#queueMasterSequenceAction_0')
        ).toContainText('Completar A-1261');
        await expect(
            page.locator('#queueMasterSequenceAction_1')
        ).toContainText('Llamar A-1262');
        await expect(
            page.locator('#queueMasterSequenceAction_2')
        ).toContainText('Asignar A-1264 a C1');

        await page.locator('#queueMasterSequenceLoad_2').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1264'
        );
        await expect(page.locator('#queueTicketLookupHeadline')).toContainText(
            'cola general'
        );
    });

    test('bloqueos vivos prioriza cierres y operadores faltantes', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1271,
                ticketCode: 'A-1271',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1272,
                ticketCode: 'A-1272',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
            },
            {
                id: 1273,
                ticketCode: 'A-1273',
                queueType: 'walk_in',
                patientInitials: 'QP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1274,
                ticketCode: 'A-1274',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_blockers',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueBlockers')).toBeVisible();
        await expect(page.locator('#queueBlockersTitle')).toContainText(
            'Bloqueos vivos'
        );
        await expect(page.locator('#queueBlockersAction_0')).toContainText(
            'Completar A-1271'
        );
        await expect(page.locator('#queueBlockersAction_1')).toContainText(
            'Abrir Operador C2'
        );

        await page.locator('#queueBlockersLoad_1').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1273'
        );
        await expect(page.locator('#queueTicketLookupHeadline')).toContainText(
            'C2'
        );
    });

    test('sla vivo prioriza tickets vencidos o por vencer y los carga al lookup', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1281,
                ticketCode: 'A-1281',
                queueType: 'walk_in',
                patientInitials: 'RS',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
            },
            {
                id: 1282,
                ticketCode: 'A-1282',
                queueType: 'appointment',
                patientInitials: 'LM',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 1283,
                ticketCode: 'A-1283',
                queueType: 'walk_in',
                patientInitials: 'QP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 21 * 60 * 1000).toISOString(),
            },
            {
                id: 1284,
                ticketCode: 'A-1284',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_sla_deck',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueSlaDeck')).toBeVisible();
        await expect(page.locator('#queueSlaDeckTitle')).toContainText(
            'SLA vivo'
        );
        await expect(page.locator('#queueSlaDeckHeadline_0')).toContainText(
            'A-1282'
        );
        await expect(page.locator('#queueSlaDeckDue_0')).toContainText(
            'cita ya vencida'
        );
        await expect(page.locator('#queueSlaDeckHeadline_1')).toContainText(
            'A-1283'
        );

        await page.locator('#queueSlaDeckLoad_0').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1282'
        );
        await expect(page.locator('#queueTicketLookupHeadline')).toContainText(
            'cola general'
        );
    });

    test('cobertura siguiente marca consultorios cubiertos y huecos proximos', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1291,
                ticketCode: 'A-1291',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1292,
                ticketCode: 'A-1292',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1293,
                ticketCode: 'A-1293',
                queueType: 'appointment',
                patientInitials: 'QP',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1294,
                ticketCode: 'A-1294',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_coverage_deck',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueCoverageDeck')).toBeVisible();
        await expect(page.locator('#queueCoverageDeckTitle')).toContainText(
            'Cobertura siguiente'
        );
        await expect(page.locator('#queueCoverageHeadline_c1')).toContainText(
            'C1 ya tiene cubierto el siguiente paso'
        );
        await expect(page.locator('#queueCoverageGap_c1')).toContainText(
            'A-1292 entra cuando cierres A-1291'
        );
        await expect(page.locator('#queueCoverageHeadline_c2')).toContainText(
            'C2 quedará sin cobertura tras A-1293'
        );
        await expect(page.locator('#queueCoverageGap_c2')).toContainText(
            'A-1294 podría cubrir el hueco'
        );
        await expect(page.locator('#queueCoveragePrimary_c2')).toContainText(
            'Cargar A-1294'
        );

        await page.locator('#queueCoveragePrimary_c2').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1294'
        );
        await expect(page.locator('#queueTicketLookupHeadline')).toContainText(
            'cola general'
        );
    });

    test('reserva inmediata marca segundo paso cubierto y dependencia de cola general', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1295,
                ticketCode: 'A-1295',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1296,
                ticketCode: 'A-1296',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1297,
                ticketCode: 'A-1297',
                queueType: 'walk_in',
                patientInitials: 'QP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1298,
                ticketCode: 'A-1298',
                queueType: 'appointment',
                patientInitials: 'AD',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1299,
                ticketCode: 'A-1299',
                queueType: 'walk_in',
                patientInitials: 'BT',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 1300,
                ticketCode: 'A-1300',
                queueType: 'walk_in',
                patientInitials: 'NV',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_reserve_deck',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueReserveDeck')).toBeVisible();
        await expect(page.locator('#queueReserveDeckTitle')).toContainText(
            'Reserva inmediata'
        );
        await expect(page.locator('#queueReserveHeadline_c1')).toContainText(
            'C1 ya tiene reserva después del siguiente turno'
        );
        await expect(page.locator('#queueReserveBuffer_c1')).toContainText(
            'A-1297'
        );
        await expect(page.locator('#queueReserveHeadline_c2')).toContainText(
            'C2 depende de cola general después de A-1299'
        );
        await expect(page.locator('#queueReserveBuffer_c2')).toContainText(
            'A-1300 en cola general'
        );
        await expect(page.locator('#queueReserveSupport_c2')).toContainText(
            'A-1300 puede ser la reserva'
        );
        await expect(page.locator('#queueReservePrimary_c2')).toContainText(
            'Cargar A-1300'
        );

        await page.locator('#queueReservePrimary_c2').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1300'
        );
        await expect(page.locator('#queueTicketLookupHeadline')).toContainText(
            'cola general'
        );
    });

    test('cola general guiada reparte los siguientes tickets por hueco y reserva', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1301,
                ticketCode: 'A-1301',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1302,
                ticketCode: 'A-1302',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1303,
                ticketCode: 'A-1303',
                queueType: 'appointment',
                patientInitials: 'QP',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1304,
                ticketCode: 'A-1304',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1305,
                ticketCode: 'A-1305',
                queueType: 'walk_in',
                patientInitials: 'BT',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_general_guidance',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueGeneralGuidance')).toBeVisible();
        await expect(page.locator('#queueGeneralGuidanceTitle')).toContainText(
            'Cola general guiada'
        );
        await expect(
            page.locator('#queueGeneralGuidanceHeadline_0')
        ).toContainText('A-1304');
        await expect(
            page.locator('#queueGeneralGuidanceReason_0')
        ).toContainText('Cubre el hueco');
        await expect(
            page.locator('#queueGeneralGuidanceTarget_0')
        ).toContainText('C2');
        await expect(
            page.locator('#queueGeneralGuidanceHeadline_1')
        ).toContainText('A-1305');
        await expect(
            page.locator('#queueGeneralGuidanceReason_1')
        ).toContainText('Deja una reserva');
        await expect(
            page.locator('#queueGeneralGuidanceTarget_1')
        ).toContainText('C1');

        await page.locator('#queueGeneralGuidanceLoad_0').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1304'
        );
        await expect(page.locator('#queueTicketLookupHeadline')).toContainText(
            'cola general'
        );
    });

    test('proyeccion de cola resume los carriles despues de aplicar la guia general', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1306,
                ticketCode: 'A-1306',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1307,
                ticketCode: 'A-1307',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1308,
                ticketCode: 'A-1308',
                queueType: 'appointment',
                patientInitials: 'QP',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1309,
                ticketCode: 'A-1309',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1310,
                ticketCode: 'A-1310',
                queueType: 'walk_in',
                patientInitials: 'BT',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_projected_deck',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueProjectedDeck')).toBeVisible();
        await expect(page.locator('#queueProjectedDeckTitle')).toContainText(
            'Proyección de cola'
        );
        await expect(page.locator('#queueProjectedHeadline_c1')).toContainText(
            'C1 quedaría con reserva real'
        );
        await expect(page.locator('#queueProjectedSequence_c1')).toContainText(
            'A-1307 -> A-1310'
        );
        await expect(page.locator('#queueProjectedHeadline_c2')).toContainText(
            'C2 queda cubierto, pero sin reserva'
        );
        await expect(page.locator('#queueProjectedSequence_c2')).toContainText(
            'A-1309'
        );
        await page.locator('#queueProjectedPrimary_c2').click();
        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1309'
        );
    });

    test('ingresos nuevos reparte los dos siguientes ingresos sobre la proyeccion actual', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1321,
                ticketCode: 'A-1321',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1322,
                ticketCode: 'A-1322',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1323,
                ticketCode: 'A-1323',
                queueType: 'appointment',
                patientInitials: 'QP',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1324,
                ticketCode: 'A-1324',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1325,
                ticketCode: 'A-1325',
                queueType: 'walk_in',
                patientInitials: 'BT',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_incoming_deck',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueIncomingDeck')).toBeVisible();
        await expect(page.locator('#queueIncomingDeckTitle')).toContainText(
            'Ingresos nuevos'
        );
        await expect(page.locator('#queueIncomingDeckSummary')).toContainText(
            'Ingreso 1 conviene a C2'
        );
        await expect(page.locator('#queueIncomingHeadline_c1')).toContainText(
            'C1 absorbería 1 ingreso nuevo'
        );
        await expect(page.locator('#queueIncomingSequence_c1')).toContainText(
            'Ingreso 2'
        );
        await expect(page.locator('#queueIncomingHeadline_c2')).toContainText(
            'C2 absorbería 1 ingreso nuevo'
        );
        await expect(page.locator('#queueIncomingSequence_c2')).toContainText(
            'Ingreso 1'
        );
        await expect(page.locator('#queueIncomingOpen_c2')).toHaveAttribute(
            'href',
            /operador-turnos\.html\?station=c2&lock=1/
        );
    });
});
