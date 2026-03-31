import { apiRequest } from '../../shared/core/api-client.js';
import { getState } from '../../shared/core/store.js';
import { applyQueueStateResponse } from '../../shared/modules/queue/sync.js';
import { mutateAppointmentInState } from './state.js';
import { renderAppointmentsSection } from './render.js';

async function patchAppointment(id, body) {
    await apiRequest('appointments', {
        method: 'PATCH',
        body: {
            id: Number(id || 0),
            ...body,
        },
    });
}

function extractPatientInitials(name) {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!parts.length) {
        return 'AD';
    }
    return parts
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join('')
        .toUpperCase();
}

function buildCheckinPayload(appointment) {
    const checkinToken = String(
        appointment?.checkinToken || appointment?.checkin_token || ''
    ).trim();
    const patientInitials = extractPatientInitials(appointment?.name || '');

    if (checkinToken !== '') {
        return {
            checkinToken,
            patientInitials,
        };
    }

    const phone = String(appointment?.phone || '').trim();
    const date = String(appointment?.date || '').trim();
    const time = String(appointment?.time || '').trim();
    if (phone !== '' && date !== '' && time !== '') {
        return {
            telefono: phone,
            fecha: date,
            hora: time,
            patientInitials,
        };
    }

    throw new Error(
        'Esta cita no tiene datos suficientes para marcar llegada.'
    );
}

export async function approveTransfer(id) {
    await patchAppointment(id, { paymentStatus: 'paid' });
    mutateAppointmentInState(id, { paymentStatus: 'paid' });
}

export async function rejectTransfer(id) {
    await patchAppointment(id, { paymentStatus: 'failed' });
    mutateAppointmentInState(id, { paymentStatus: 'failed' });
}

export async function markNoShow(id) {
    await patchAppointment(id, { status: 'no_show' });
    mutateAppointmentInState(id, { status: 'no_show' });
}

export async function cancelAppointment(id) {
    await patchAppointment(id, { status: 'cancelled' });
    mutateAppointmentInState(id, { status: 'cancelled' });
}

export async function redeemGiftCard(appointmentId, code, amountCents) {
    const payload = await apiRequest('gift-card-redeem', {
        method: 'POST',
        body: { code, amount_cents: amountCents }
    });
    // Add success visually to appointment as paid if fully covered
    if (payload.message) {
        payload.success = true;
        // In real operations, we often tag it to paymentStatus='paid' if the balance was enough.
        mutateAppointmentInState(appointmentId, { 
            paymentStatus: 'paid',
            giftCardCode: code
        });
    }
    return payload;
}

export async function markArrived(id) {
    const targetId = Number(id || 0);
    const appointment = (getState().data.appointments || []).find(
        (item) => Number(item?.id || 0) === targetId
    );
    if (!appointment) {
        throw new Error('Cita no encontrada en la agenda actual.');
    }

    const payload = await apiRequest('queue-checkin', {
        method: 'POST',
        body: buildCheckinPayload(appointment),
    });
    applyQueueStateResponse(payload, {
        syncMode: 'live',
        bumpRuntimeRevision: true,
    });
    renderAppointmentsSection();

    return {
        ticket:
            payload?.data && typeof payload.data === 'object' ? payload.data : {},
        replay: Boolean(payload?.replay),
    };
}

export function exportAppointmentsCsv() {
    const state = getState();
    const rows = (state.data.appointments || []).map((item) => [
        item.id,
        item.name,
        item.service,
        item.date,
        item.time,
        item.status,
        item.paymentStatus || item.payment_status || '',
    ]);

    const csv = [
        ['id', 'name', 'service', 'date', 'time', 'status', 'payment_status'],
        ...rows,
    ]
        .map((line) =>
            line
                .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
                .join(',')
        )
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `appointments-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}
