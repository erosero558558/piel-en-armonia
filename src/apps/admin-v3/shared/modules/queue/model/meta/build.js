function buildMetaTicket(ticket, overrides = {}) {
    return {
        id: ticket.id,
        ticketCode: ticket.ticketCode,
        patientCaseId: ticket.patientCaseId,
        patientInitials: ticket.patientInitials,
        patientLabel: ticket.patientLabel,
        queueType: ticket.queueType,
        priorityClass: ticket.priorityClass,
        visitReason: ticket.visitReason,
        visitReasonLabel: ticket.visitReasonLabel,
        priorVisitsCount: ticket.priorVisitsCount,
        journeyStage: ticket.journeyStage,
        journeyStageLabel: ticket.journeyStageLabel,
        journeyDisplayStage: ticket.journeyDisplayStage,
        journeyDisplayStageLabel: ticket.journeyDisplayStageLabel,
        journeyOwnerLabel: ticket.journeyOwnerLabel,
        operatorAlerts: Array.isArray(ticket.operatorAlerts)
            ? ticket.operatorAlerts
            : [],
        createdAt: ticket.createdAt,
        calledAt: ticket.calledAt,
        needsAssistance: ticket.needsAssistance,
        assistanceRequestStatus: ticket.assistanceRequestStatus,
        activeHelpRequestId: ticket.activeHelpRequestId,
        specialPriority: ticket.specialPriority,
        lateArrival: ticket.lateArrival,
        reprintRequestedAt: ticket.reprintRequestedAt,
        estimatedWaitMin: ticket.estimatedWaitMin,
        ...overrides,
    };
}

export function buildQueueMeta(tickets) {
    const waiting = tickets.filter((item) => item.status === 'waiting');
    const called = tickets.filter((item) => item.status === 'called');
    const calledC1 = called.find((item) => item.assignedConsultorio === 1);
    const calledC2 = called.find((item) => item.assignedConsultorio === 2);

    const nowByConsultorio = {
        1: calledC1
            ? buildMetaTicket(calledC1, {
                  status: 'called',
                  assignedConsultorio: 1,
              })
            : null,
        2: calledC2
            ? buildMetaTicket(calledC2, {
                  status: 'called',
                  assignedConsultorio: 2,
              })
            : null,
    };

    return {
        updatedAt: new Date().toISOString(),
        waitingCount: waiting.length,
        calledCount: called.length,
        counts: {
            waiting: waiting.length,
            called: called.length,
            completed: tickets.filter((item) => item.status === 'completed')
                .length,
            no_show: tickets.filter((item) => item.status === 'no_show').length,
            cancelled: tickets.filter((item) => item.status === 'cancelled')
                .length,
        },
        callingNowByConsultorio: nowByConsultorio,
        nextTickets: waiting
            .slice(0, 5)
            .map((item, index) => buildMetaTicket(item, { position: index + 1 })),
        recentResolvedHelpRequests: [],
    };
}
