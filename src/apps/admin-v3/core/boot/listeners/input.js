import {
    setAppointmentFilter,
    setAppointmentSearch,
    setAppointmentSort,
} from '../../../sections/appointments.js';
import {
    applyCallbackWhatsappTemplate,
    setCallbackWhatsappDraft,
    setCallbacksDay,
    setCallbacksFilter,
    setCallbacksSearch,
    setCallbacksSort,
} from '../../../sections/callbacks.js';
import { createToast } from '../../../shared/ui/render.js';
import { hideCommandPalette } from '../../../ui/frame.js';
import { setQueueSearch } from '../../../shared/modules/queue.js';
import { parseQuickCommand, runQuickAction } from '../navigation.js';

function attachQuickCommandInput(input) {
    input.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const action = parseQuickCommand(input.value);
        if (action) {
            await runQuickAction(action);
            input.value = '';
            hideCommandPalette();
        }
    });
}

export function attachInputListeners() {
    const appointmentFilter = document.getElementById('appointmentFilter');
    if (appointmentFilter instanceof HTMLSelectElement) {
        appointmentFilter.addEventListener('change', () => {
            setAppointmentFilter(appointmentFilter.value);
        });
    }

    const appointmentSort = document.getElementById('appointmentSort');
    if (appointmentSort instanceof HTMLSelectElement) {
        appointmentSort.addEventListener('change', () => {
            setAppointmentSort(appointmentSort.value);
        });
    }

    const searchAppointments = document.getElementById('searchAppointments');
    if (searchAppointments instanceof HTMLInputElement) {
        searchAppointments.addEventListener('input', () => {
            setAppointmentSearch(searchAppointments.value);
        });
    }

    const callbackFilter = document.getElementById('callbackFilter');
    if (callbackFilter instanceof HTMLSelectElement) {
        callbackFilter.addEventListener('change', () => {
            setCallbacksFilter(callbackFilter.value);
        });
    }

    const callbackSort = document.getElementById('callbackSort');
    if (callbackSort instanceof HTMLSelectElement) {
        callbackSort.addEventListener('change', () => {
            setCallbacksSort(callbackSort.value);
        });
    }

    const callbackDayFilter = document.getElementById('callbackDayFilter');
    if (callbackDayFilter instanceof HTMLInputElement) {
        const syncCallbackDayFilter = () => {
            setCallbacksDay(callbackDayFilter.value);
        };
        callbackDayFilter.addEventListener('input', syncCallbackDayFilter);
        callbackDayFilter.addEventListener('change', syncCallbackDayFilter);
    }

    const searchCallbacks = document.getElementById('searchCallbacks');
    if (searchCallbacks instanceof HTMLInputElement) {
        searchCallbacks.addEventListener('input', () => {
            setCallbacksSearch(searchCallbacks.value);
        });
    }

    const searchQueue = document.getElementById('queueSearchInput');
    if (searchQueue instanceof HTMLInputElement) {
        searchQueue.addEventListener('input', () => {
            setQueueSearch(searchQueue.value);
        });
    }

    const quickCommand = document.getElementById('adminQuickCommand');
    if (quickCommand instanceof HTMLInputElement) {
        attachQuickCommandInput(quickCommand);
    }

    document.addEventListener('change', async (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        const templateSelect = target.closest('[data-callback-template-select]');
        if (templateSelect instanceof HTMLSelectElement) {
            try {
                await applyCallbackWhatsappTemplate(
                    Number(templateSelect.dataset.callbackId || 0),
                    templateSelect.value
                );
            } catch (error) {
                createToast(
                    error?.message || 'No se pudo preparar la plantilla',
                    'error'
                );
            }
            return;
        }

        const draftInput = target.closest('[data-callback-template-draft]');
        if (draftInput instanceof HTMLTextAreaElement) {
            const card = draftInput.closest('.callback-card');
            const linkedTemplate =
                card?.querySelector('[data-callback-template-select]');
            try {
                await setCallbackWhatsappDraft(
                    Number(draftInput.dataset.callbackId || 0),
                    draftInput.value,
                    linkedTemplate instanceof HTMLSelectElement
                        ? linkedTemplate.value
                        : ''
                );
            } catch (error) {
                createToast(
                    error?.message || 'No se pudo guardar el mensaje',
                    'error'
                );
            }
        }
    });
}
