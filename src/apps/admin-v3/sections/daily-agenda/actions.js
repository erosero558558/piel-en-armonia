import { apiRequest } from '../../shared/core/api-client.js';
import { renderDailyAgendaContent } from './render.js';
import { createToast } from '../../shared/ui/render.js';
import { applyQueueStateResponse } from '../../shared/modules/queue/sync.js';

export async function checkInPatient(appointment) {
    if (!appointment || !appointment.id) return;

    // Use kiosk check-in logic
    const checkinToken = String(
        appointment.checkinToken || appointment.checkin_token || ''
    ).trim();
    const payload =
        checkinToken !== ''
            ? {
                  checkinToken,
                  patientInitials: String(appointment.name || '')
                      .trim()
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part.charAt(0))
                      .join('')
                      .toUpperCase(),
              }
            : {
                  telefono: appointment.phone || appointment.telefono,
                  fecha: appointment.date,
                  hora: appointment.time,
              };

    try {
        const response = await apiRequest('queue-checkin', {
            method: 'POST',
            body: payload,
        });

        applyQueueStateResponse(response, {
            syncMode: 'live',
            bumpRuntimeRevision: true,
        });
        createToast('Paciente marcado como llegó', 'success');
        renderDailyAgendaContent();
    } catch (e) {
        createToast('Error de red al marcar llegada', 'error');
        console.error('Check-in error', e);
    }
}
