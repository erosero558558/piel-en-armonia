import { jsonClient } from '../../shared/core/api.js';
import { getState, setState } from '../../shared/core/store.js';
import { renderDailyAgendaContent } from './render.js';
import { showToast } from '../../shared/ui/toast.js';
import { syncQueueState } from '../../shared/modules/queue.js';

export async function checkInPatient(appointment) {
    if (!appointment || !appointment.id) return;

    // Use kiosk check-in logic
    const payload = {
        phone: appointment.phone || appointment.telefono,
        date: appointment.date,
        time: appointment.time,
    };

    try {
        const response = await jsonClient('/api.php?resource=queue-checkin', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            showToast('Paciente marcado como llegó', 'success');
            // Refresh queue state internally to fetch new ticket
            await syncQueueState();
            
            // Re-render
            renderDailyAgendaContent();
        } else {
            showToast('Error al marcar llegada: ' + (response.error || 'Desconocido'), 'error');
        }
    } catch (e) {
        showToast('Error de red al marcar llegada', 'error');
        console.error('Check-in error', e);
    }
}
