import { getState } from '../../../shared/core/store.js';
import {
    applyFilter,
    applySearch,
    computeOps,
    sortItems,
} from '../selectors.js';
import { syncAppointmentControls } from './controls.js';
import { renderOpsDeck } from './deck.js';
import { renderAppointmentsTable } from './rows.js';

export function renderAppointmentsSection() {
    const state = getState();
    const source = Array.isArray(state?.data?.appointments)
        ? state.data.appointments
        : [];
    const appointmentsState = state?.appointments || {
        filter: 'all',
        search: '',
        sort: 'datetime_desc',
        density: 'comfortable',
    };

    const filtered = applyFilter(source, appointmentsState.filter);
    const searched = applySearch(filtered, appointmentsState.search);
    const sorted = sortItems(searched, appointmentsState.sort);

    renderAppointmentsTable(sorted);
    syncAppointmentControls(appointmentsState, sorted.length, source.length);
    renderOpsDeck(computeOps(source), sorted.length, source.length);
}
