import {
    renderAppointmentsCommandDeck,
    renderAppointmentsDailyAgendaPanel,
    renderAppointmentsFocusPanel,
} from './deck.js';
import { renderAppointmentsWorkbench } from './workbench.js';

export function renderAppointmentsSection() {
    return `
        <section id="appointments" class="admin-section" tabindex="-1">
            <div class="appointments-stage">
                ${renderAppointmentsCommandDeck()}
                <div class="appointments-signal-rail">
                    ${renderAppointmentsFocusPanel()}
                    ${renderAppointmentsDailyAgendaPanel()}
                </div>
            </div>

            ${renderAppointmentsWorkbench()}
        </section>
    `;
}
