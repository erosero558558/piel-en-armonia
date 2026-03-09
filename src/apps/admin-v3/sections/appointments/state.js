import { updateState } from '../../shared/core/store.js';
import {
    DEFAULT_APPOINTMENT_DENSITY,
    DEFAULT_APPOINTMENT_SORT,
} from './constants.js';
import { renderAppointmentsSection } from './render.js';
import { normalize } from './utils.js';

function updateAppointmentState(patch) {
    updateState((state) => ({
        ...state,
        appointments: {
            ...state.appointments,
            ...patch,
        },
    }));
    renderAppointmentsSection();
}

export function setAppointmentFilter(filter) {
    updateAppointmentState({ filter: normalize(filter) || 'all' });
}

export function setAppointmentSearch(search) {
    updateAppointmentState({ search: String(search || '') });
}

export function clearAppointmentFilters() {
    updateAppointmentState({
        filter: 'all',
        search: '',
    });
}

export function setAppointmentSort(sort) {
    updateAppointmentState({
        sort: normalize(sort) || DEFAULT_APPOINTMENT_SORT,
    });
}

export function setAppointmentDensity(density) {
    updateAppointmentState({
        density:
            normalize(density) === 'compact'
                ? 'compact'
                : DEFAULT_APPOINTMENT_DENSITY,
    });
}

export function mutateAppointmentInState(id, patch) {
    const targetId = Number(id || 0);

    updateState((state) => ({
        ...state,
        data: {
            ...state.data,
            appointments: (state.data.appointments || []).map((item) =>
                Number(item.id || 0) === targetId
                    ? {
                          ...item,
                          ...patch,
                      }
                    : item
            ),
        },
    }));

    renderAppointmentsSection();
}
