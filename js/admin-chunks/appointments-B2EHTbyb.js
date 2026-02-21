import { s as showToast, a as apiRequest, r as refreshData, c as currentAppointments, e as escapeHtml, g as getServiceName, b as getDoctorName, f as formatDate, d as getPaymentMethodText, h as getPaymentStatusText, i as sanitizePublicHref, j as getStatusText } from '../../admin.js';
import { loadDashboardData } from './dashboard-B6tqHnCY.js';

function getWeekRange() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
}

function renderAppointments(appointments) {
    const tbody = document.getElementById('appointmentsTableBody');
    if (!tbody) return;

    if (appointments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-message">No hay citas registradas</td></tr>';
        return;
    }

    const sorted = [...appointments].sort((a, b) => {
        const dateA = (a.date || '') + ' ' + (a.time || '');
        const dateB = (b.date || '') + ' ' + (b.time || '');
        return dateB.localeCompare(dateA);
    });

    tbody.innerHTML = sorted.map(a => `
        <tr>
            <td>
                <strong>${escapeHtml(a.name)}</strong><br>
                <small>${escapeHtml(a.email)}</small>
            </td>
            <td>${escapeHtml(getServiceName(a.service))}</td>
            <td>${escapeHtml(getDoctorName(a.doctor))}${a.doctorAssigned ? '<br><small>Asignado: ' + escapeHtml(getDoctorName(a.doctorAssigned)) + '</small>' : ''}</td>
            <td>${escapeHtml(formatDate(a.date))}</td>
            <td>${escapeHtml(a.time)}</td>
            <td>
                <strong>${escapeHtml(a.price || '$0.00')}</strong><br>
                <small>${escapeHtml(getPaymentMethodText(a.paymentMethod))} - ${escapeHtml(getPaymentStatusText(a.paymentStatus))}</small>
                ${(a.transferReference ? `<br><small>Ref: ${escapeHtml(a.transferReference)}</small>` : '')}
                ${(sanitizePublicHref(a.transferProofUrl) ? `<br><a href="${escapeHtml(sanitizePublicHref(a.transferProofUrl))}" target="_blank" rel="noopener noreferrer">Ver comprobante</a>` : '')}
            </td>
            <td>
                <span class="status-badge status-${escapeHtml(a.status || 'confirmed')}">
                    ${escapeHtml(getStatusText(a.status || 'confirmed'))}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    ${(a.paymentStatus === 'pending_transfer_review' ? `
                    <button type="button" class="btn-icon success" data-action="approve-transfer" data-id="${Number(a.id) || 0}" title="Aprobar transferencia">
                        <i class="fas fa-check"></i>
                    </button>
                    <button type="button" class="btn-icon danger" data-action="reject-transfer" data-id="${Number(a.id) || 0}" title="Rechazar transferencia">
                        <i class="fas fa-ban"></i>
                    </button>
                    ` : '')}
                    <a href="tel:${escapeHtml(a.phone)}" class="btn-icon" title="Llamar">
                        <i class="fas fa-phone"></i>
                    </a>
                    <a href="https://wa.me/${escapeHtml(String(a.phone || '').replace(/\\D/g, ''))}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                    <button type="button" class="btn-icon danger" data-action="cancel-appointment" data-id="${Number(a.id) || 0}" title="Cancelar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function loadAppointments() {
    renderAppointments(currentAppointments);
}

function filterAppointments() {
    const filter = document.getElementById('appointmentFilter').value;
    let filtered = [...currentAppointments];

    const today = new Date().toISOString().split('T')[0];
    const currentWeek = getWeekRange();
    const currentMonthNumber = new Date().getMonth();

    switch (filter) {
        case 'today':
            filtered = filtered.filter(a => a.date === today);
            break;
        case 'week':
            filtered = filtered.filter(a => a.date >= currentWeek.start && a.date <= currentWeek.end);
            break;
        case 'month':
            filtered = filtered.filter(a => new Date(a.date).getMonth() === currentMonthNumber);
            break;
        case 'confirmed':
        case 'cancelled':
            filtered = filtered.filter(a => (a.status || 'confirmed') === filter);
            break;
        case 'pending_transfer':
            filtered = filtered.filter(a => a.paymentStatus === 'pending_transfer_review');
            break;
    }

    renderAppointments(filtered);
}

function searchAppointments() {
    const search = document.getElementById('searchAppointments').value.toLowerCase();
    const filtered = currentAppointments.filter(a =>
        String(a.name || '').toLowerCase().includes(search) ||
        String(a.email || '').toLowerCase().includes(search) ||
        String(a.phone || '').includes(search)
    );
    renderAppointments(filtered);
}

async function cancelAppointment(id) {
    if (!confirm('¿Estas seguro de cancelar esta cita?')) return;
    if (!id) {
        showToast('Id de cita invalido', 'error');
        return;
    }
    try {
        await apiRequest('appointments', {
            method: 'PATCH',
            body: { id: id, status: 'cancelled' }
        });
        await refreshData();
        loadAppointments();
        loadDashboardData();
        showToast('Cita cancelada correctamente', 'success');
    } catch (error) {
        showToast(`No se pudo cancelar la cita: ${error.message}`, 'error');
    }
}

async function approveTransfer(id) {
    if (!confirm('¿Aprobar el comprobante de transferencia de esta cita?')) return;
    if (!id) { showToast('Id de cita invalido', 'error'); return; }
    try {
        await apiRequest('appointments', {
            method: 'PATCH',
            body: { id: id, paymentStatus: 'paid', paymentPaidAt: new Date().toISOString() }
        });
        await refreshData();
        loadAppointments();
        loadDashboardData();
        showToast('Transferencia aprobada', 'success');
    } catch (error) {
        showToast(`No se pudo aprobar: ${error.message}`, 'error');
    }
}

async function rejectTransfer(id) {
    if (!confirm('¿Rechazar el comprobante de transferencia? La cita quedará como pago fallido.')) return;
    if (!id) { showToast('Id de cita invalido', 'error'); return; }
    try {
        await apiRequest('appointments', {
            method: 'PATCH',
            body: { id: id, paymentStatus: 'failed' }
        });
        await refreshData();
        loadAppointments();
        loadDashboardData();
        showToast('Transferencia rechazada', 'warning');
    } catch (error) {
        showToast(`No se pudo rechazar: ${error.message}`, 'error');
    }
}

export { approveTransfer, cancelAppointment, filterAppointments, loadAppointments, rejectTransfer, renderAppointments, searchAppointments };
