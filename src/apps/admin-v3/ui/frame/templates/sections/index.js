import { renderAppointmentsSection } from './appointments.js';
import { renderDailyAgendaSection } from './daily-agenda.js';
import { renderAvailabilitySection } from './availability.js';
import { renderCallbacksSection } from './callbacks.js';
import { renderClinicalHistorySection } from './clinical-history.js';
import { renderDashboardSection } from './dashboard.js';
import { renderQueueSection } from './queue.js';
import { renderReviewsSection } from './reviews.js';
import { renderSettingsSection } from './settings.js';
import { renderGiftCardsSection } from './gift-cards.js';

export function renderAllSections() {
    return `
        ${renderDashboardSection()}
        ${renderAppointmentsSection()}
        ${renderDailyAgendaSection()}
        ${renderCallbacksSection()}
        ${renderReviewsSection()}
        ${renderAvailabilitySection()}
        ${renderQueueSection()}
        ${renderClinicalHistorySection()}
        ${renderSettingsSection()}
        ${renderGiftCardsSection()}
    `;
}
