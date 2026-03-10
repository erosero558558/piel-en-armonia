export function buildQueueMeta(tickets) {
    const waiting = tickets.filter((item) => item.status === 'waiting');
    const called = tickets.filter((item) => item.status === 'called');

    const nowByConsultorio = {
        1: called.find((item) => item.assignedConsultorio === 1) || null,
        2: called.find((item) => item.assignedConsultorio === 2) || null,
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
        nextTickets: waiting.slice(0, 5).map((item, index) => ({
            id: item.id,
            ticketCode: item.ticketCode,
            patientInitials: item.patientInitials,
            position: index + 1,
        })),
    };
}
