import { updateState } from '../../shared/core/store.js';
import {
    APPOINTMENT_DENSITY_STORAGE_KEY,
    APPOINTMENT_SORT_STORAGE_KEY,
    DEFAULT_APPOINTMENT_DENSITY,
    DEFAULT_APPOINTMENT_SORT,
} from './constants.js';

export function persistPreferences(appointmentsState) {
    try {
        localStorage.setItem(
            APPOINTMENT_SORT_STORAGE_KEY,
            JSON.stringify(appointmentsState.sort)
        );
        localStorage.setItem(
            APPOINTMENT_DENSITY_STORAGE_KEY,
            JSON.stringify(appointmentsState.density)
        );
    } catch (_error) {
        // no-op
    }
}

export function hydrateAppointmentPreferences() {
    let sort = DEFAULT_APPOINTMENT_SORT;
    let density = DEFAULT_APPOINTMENT_DENSITY;

    try {
        sort = JSON.parse(
            localStorage.getItem(APPOINTMENT_SORT_STORAGE_KEY) ||
                `"${DEFAULT_APPOINTMENT_SORT}"`
        );
        density = JSON.parse(
            localStorage.getItem(APPOINTMENT_DENSITY_STORAGE_KEY) ||
                `"${DEFAULT_APPOINTMENT_DENSITY}"`
        );
    } catch (_error) {
        // no-op
    }

    updateState((state) => ({
        ...state,
        appointments: {
            ...state.appointments,
            sort: typeof sort === 'string' ? sort : DEFAULT_APPOINTMENT_SORT,
            density:
                typeof density === 'string'
                    ? density
                    : DEFAULT_APPOINTMENT_DENSITY,
        },
    }));
}
