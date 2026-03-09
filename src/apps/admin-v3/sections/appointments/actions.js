import { apiRequest } from '../../shared/core/api-client.js';
import { getState } from '../../shared/core/store.js';
import { mutateAppointmentInState } from './state.js';

async function patchAppointment(id, body) {
    await apiRequest('appointments', {
        method: 'PATCH',
        body: {
            id: Number(id || 0),
            ...body,
        },
    });
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
