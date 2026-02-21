import { initCalendar, updateAvailableTimes } from './components/calendar.js';

window.Piel = window.Piel || {};
window.Piel.BookingCalendarEngine = {
    initCalendar,
    updateAvailableTimes
};

// Legacy support
window.PielBookingCalendarEngine = window.Piel.BookingCalendarEngine;
