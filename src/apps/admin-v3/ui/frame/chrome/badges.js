import { setText } from '../../../shared/ui/render.js';

export function renderChromeBadges(metrics) {
    setText('#dashboardBadge', metrics.dashboardAlerts);
    setText('#clinical-historyBadge', metrics.clinicalHistoryQueue);
    setText('#appointmentsBadge', metrics.appointments.length);
    setText('#callbacksBadge', metrics.pendingCallbacks);
    setText('#reviewsBadge', metrics.reviews.length);
    setText('#availabilityBadge', metrics.availabilityDays);
    setText('#queueBadge', metrics.waitingTickets);

    if (metrics.workload) {
        setText('[data-workload-text]', `${metrics.workload.total} pacientes hoy / ${metrics.workload.completed} completados`);
        const pill = document.getElementById('adminWorkloadPill');
        if (pill) {
            const w = metrics.workload;
            let bgColor, borderColor, textColor;
            if (w.color === 'green') {
                bgColor = 'rgba(34, 197, 94, 0.15)';
                borderColor = 'rgba(34, 197, 94, 0.3)';
                textColor = '#4ade80';
            } else if (w.color === 'amber') {
                bgColor = 'rgba(245, 158, 11, 0.15)';
                borderColor = 'rgba(245, 158, 11, 0.3)';
                textColor = '#fbbf24';
            } else {
                bgColor = 'rgba(239, 68, 68, 0.15)';
                borderColor = 'rgba(239, 68, 68, 0.3)';
                textColor = '#f87171';
            }
            pill.style.background = bgColor;
            pill.style.borderColor = borderColor;
            pill.style.color = textColor;
        }
    }
}
