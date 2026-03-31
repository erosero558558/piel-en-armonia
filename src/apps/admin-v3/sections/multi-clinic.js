export function renderMultiClinicDashboard(state) {
    const activeSection = state.ui.activeSection;

    // Solo renderizar si la sección activa es multi-clinic
    if (activeSection !== 'multi-clinic') {
        return;
    }

    const regionalClinics = state.data.turneroRegionalClinics || [];
    const container = document.getElementById('multiClinicTableContainer');
    const aggregatesContainer = document.getElementById('multiClinicAggregates');

    if (!container || !aggregatesContainer) return;

    let totalAppointments = 0;
    let totalRevenue = 0;
    let totalPatients = 0;

    let rowsHtml = '';
    
    // Sort clinics by some metric or priority
    [...regionalClinics].sort((a, b) => (a.priorityTier || Infinity) - (b.priorityTier || Infinity)).forEach(clinic => {
        const stats = clinic.stats || {
            appointments_today: 0,
            revenue_today: 0,
            active_patients: 0
        };

        totalAppointments += stats.appointments_today;
        totalRevenue += stats.revenue_today;
        totalPatients += stats.active_patients;

        const warningIcon = clinic.blockingCount > 0 ? `<svg width="16" height="16" style="color:var(--color-red-500); vertical-align: middle; margin-left: 4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/></svg>` : '';
        const stateColor = clinic.state === 'ready' ? 'var(--color-green-500)' : 'var(--color-yellow-500)';

        rowsHtml += `
            <tr style="border-bottom: 1px solid var(--border-color); padding: 0.5rem 0;">
                <td style="padding: 1rem 0.5rem;">
                    <strong>${clinic.clinicName}</strong>
                    <div style="font-size: 0.85rem; color: var(--text-color-muted);">${clinic.city}</div>
                </td>
                <td style="padding: 1rem 0.5rem; text-align: center;">${stats.appointments_today}</td>
                <td style="padding: 1rem 0.5rem; text-align: center;">$${stats.revenue_today.toFixed(2)}</td>
                <td style="padding: 1rem 0.5rem; text-align: center;">${stats.active_patients}</td>
                <td style="padding: 1rem 0.5rem; text-align: center;">
                    <span style="color: ${stateColor}; font-weight: 500;">
                        ${String(clinic.status || '').toUpperCase()}
                    </span>
                    ${warningIcon}
                </td>
            </tr>
        `;
    });

    const tableHtml = `
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
                <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-color-muted); font-size: 0.85rem; text-transform: uppercase;">
                    <th style="padding: 0.5rem;">Sucursal</th>
                    <th style="padding: 0.5rem; text-align: center;">Turnos Día</th>
                    <th style="padding: 0.5rem; text-align: center;">Ingresos</th>
                    <th style="padding: 0.5rem; text-align: center;">Pacientes Activos</th>
                    <th style="padding: 0.5rem; text-align: center;">Estado Sistema</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    `;
    container.innerHTML = tableHtml;

    aggregatesContainer.innerHTML = `
        <article class="kpi-card" style="padding: var(--space-4); background: var(--bg-surface-2); border-radius: var(--radius-2); border: 1px solid var(--border-color);">
            <h4 class="kpi-title" style="margin: 0; font-size: 0.85rem; color: var(--text-color-muted);">Turnos Totales (Tenant)</h4>
            <div class="kpi-value" style="font-size: 1.5rem; font-weight: 600; color: var(--text-color); margin-top: 0.5rem;">${totalAppointments}</div>
        </article>
        <article class="kpi-card" style="padding: var(--space-4); background: var(--bg-surface-2); border-radius: var(--radius-2); border: 1px solid var(--border-color);">
            <h4 class="kpi-title" style="margin: 0; font-size: 0.85rem; color: var(--text-color-muted);">Ingresos Totales (Tenant)</h4>
            <div class="kpi-value" style="font-size: 1.5rem; font-weight: 600; color: var(--color-gold-400); margin-top: 0.5rem;">$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </article>
        <article class="kpi-card" style="padding: var(--space-4); background: var(--bg-surface-2); border-radius: var(--radius-2); border: 1px solid var(--border-color);">
            <h4 class="kpi-title" style="margin: 0; font-size: 0.85rem; color: var(--text-color-muted);">Pacientes Activos (Tenant)</h4>
            <div class="kpi-value" style="font-size: 1.5rem; font-weight: 600; color: var(--color-aurora-500); margin-top: 0.5rem;">${totalPatients}</div>
        </article>
    `;
}
