import { getState } from '../../shared/core/store.js';
import { escapeHtml, formatDate, setHtml } from '../../shared/ui/render.js';
import { checkInPatient } from './actions.js';

function isToday(dateString) {
    if (!dateString) return false;
    const today = new Date();
    const [y, m, d] = dateString.split('-');
    return (
        today.getFullYear() === Number(y) &&
        today.getMonth() + 1 === Number(m) &&
        today.getDate() === Number(d)
    );
}

function groupAppointmentsByTimeAndDoctor(appointments) {
    const map = {};
    for (const appt of appointments) {
        if (!isToday(appt.date)) continue;
        if (appt.status === 'cancelled' || appt.status === 'no_show') continue;

        const time = appt.time || '00:00';
        const doc = appt.doctor || 'indiferente';
        const key = `${time}-${doc}`;
        
        if (!map[key]) {
            map[key] = { time, doctor: doc, items: [] };
        }
        map[key].items.push(appt);
    }
    return Object.values(map).sort((a, b) => a.time.localeCompare(b.time));
}

export function renderDailyAgendaContent() {
    const state = getState();
    const source = Array.isArray(state?.data?.appointments)
        ? state.data.appointments
        : [];

    const queueTickets = Array.isArray(state?.data?.queueState?.tickets)
        ? state.data.queueState.tickets
        : [];
    
    // Check if an appointment is already in queue
    const getTicketForAppointment = (apptId) => {
        return queueTickets.find(t => 
            Number(t.appointment?.id) === Number(apptId) || 
            (t.context && Number(t.context.appointmentId) === Number(apptId))
        );
    };

    const grouped = groupAppointmentsByTimeAndDoctor(source);

    if (grouped.length === 0) {
        setHtml('#dailyAgendaUI', '<div class="admin-empty-state">No hay citas confirmadas para el día de hoy.</div>');
        return;
    }

    const htmlTokens = [];
    htmlTokens.push('<div class="daily-agenda-grid">');

    for (const group of grouped) {
        const isOverbooked = group.items.length > 1;
        const overbookClass = isOverbooked ? 'is-overbooked' : '';

        htmlTokens.push(`
            <div class="agenda-time-slot ${overbookClass}">
                <div class="agenda-time-header">
                    <h4>${escapeHtml(group.time)} - ${escapeHtml(group.doctor)}</h4>
                    ${isOverbooked ? '<span class="status-badge error">Overbooking</span>' : ''}
                </div>
                <div class="agenda-time-appointments">
        `);

        for (const appt of group.items) {
            const ticket = getTicketForAppointment(appt.id);
            const isArrived = Boolean(ticket);
            
            htmlTokens.push(`
                <div class="agenda-card">
                    <div class="agenda-card-info">
                        <strong>${escapeHtml(appt.name)}</strong>
                        <span>${escapeHtml(appt.service)}</span>
                        <span>📄 ${escapeHtml(appt.status)}</span>
                        ${isArrived ? `<span class="status-badge success">En Kiosco (${escapeHtml(ticket.status)})</span>` : ''}
                    </div>
                    <div class="agenda-card-actions">
                        ${!isArrived ? `<button class="ops-btn primary js-agenda-checkin" data-id="${Number(appt.id)}">Marcar Llegó</button>` : ''}
                    </div>
                </div>
            `);
        }

        htmlTokens.push(`
                </div>
            </div>
        `);
    }

    htmlTokens.push('</div>');
    setHtml('#dailyAgendaUI', htmlTokens.join(''));

    // Bind events
    const container = document.getElementById('dailyAgendaUI');
    if (container) {
        const buttons = container.querySelectorAll('.js-agenda-checkin');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const id = Number(btn.dataset.id);
                const appointment = source.find(a => Number(a.id) === id);
                if (appointment) {
                    btn.disabled = true;
                    btn.textContent = 'Enviando...';
                    checkInPatient(appointment).finally(() => {
                        if (btn) {
                            btn.disabled = false;
                            btn.textContent = 'Marcar Llegó';
                        }
                    });
                }
            });
        });
    }
}
