/**
 * js/portal-dashboard.js
 * Asynchronous orchestrator for the Patient Portal (UI2-12).
 * Fills #portal-next-appointment and #portal-active-plans from Aurora APIs.
 */

// Inject dynamic skeleton CSS for the Portal environment if it doesn't have aurora-admin.css
if (!document.getElementById('portal-skeleton-css')) {
    const style = document.createElement('style');
    style.id = 'portal-skeleton-css';
    style.textContent = `
        .skeleton {
            background: linear-gradient(90deg, var(--bg-level-2, #1e293b) 25%, var(--bg-level-3, #334155) 50%, var(--bg-level-2, #1e293b) 75%);
            background-size: 200% 100%;
            animation: aurora-shimmer 1.5s infinite linear;
            border-radius: var(--radius-md, 8px);
        }
        @keyframes aurora-shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
    `;
    document.head.appendChild(style);
}

document.addEventListener('DOMContentLoaded', async () => {
    const nextApptContainer = document.getElementById('portal-next-appointment');
    const activePlansContainer = document.getElementById('portal-active-plans');

    if (!nextApptContainer || !activePlansContainer) return;

    // 1. Render Initial Skeletons
    nextApptContainer.innerHTML = renderSkeletonCard('next-appt');
    activePlansContainer.innerHTML = renderSkeletonCard('plans');

    try {
        // 2. Parallel API Fetching
        // Using mock parameters to simulate an authenticated payload
        const [apptRes, histRes] = await Promise.allSettled([
            fetch('/api.php?resource=appointment&patient_id=P-TEST', { headers: { 'Authorization': 'Bearer mock-session' } }),
            fetch('/api.php?resource=clinical-history&patient_id=P-TEST', { headers: { 'Authorization': 'Bearer mock-session' } })
        ]);

        // 3. Process Appointments
        if (apptRes.status === 'fulfilled' && apptRes.value.ok) {
            const data = await apptRes.value.json().catch(() => null);
            // Wait, standard API return arrays or objects.
            const appointments = Array.isArray(data) ? data : (data?.data || []);
            
            // Filter future appointments, just grab the first for "Next Visit".
            const nextVisit = appointments.length > 0 ? appointments[0] : null;

            if (nextVisit) {
                nextApptContainer.innerHTML = renderNextAppointment(nextVisit);
            } else {
                nextApptContainer.innerHTML = renderEmptyState('No tienes citas pendientes', 'Agendar Nueva Cita');
            }
        } else {
            nextApptContainer.innerHTML = renderEmptyState('No tienes citas pendientes', 'Agendar Nueva Cita');
        }

        // 4. Process Active Clinical Plans
        if (histRes.status === 'fulfilled' && histRes.value.ok) {
            const data = await histRes.value.json().catch(() => null);
            const plans = Array.isArray(data) ? data : (data?.data || []);

            if (plans.length > 0) {
                activePlansContainer.innerHTML = plans.map(p => renderClinicalPlan(p)).join('');
            } else {
                activePlansContainer.innerHTML = `
                    <div style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
                        <p style="margin-bottom: 8px;">No tienes planes de tratamiento activos.</p>
                        <small>Tu historial clínico está al día.</small>
                    </div>
                `;
            }
        } else {
            activePlansContainer.innerHTML = `
                <div style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
                    <p>No tienes planes de tratamiento activos.</p>
                </div>
            `;
        }

    } catch (err) {
        console.error('Portal Data Error:', err);
        nextApptContainer.innerHTML = renderEmptyState('No tienes citas pendientes', 'Agendar Nueva Cita');
        activePlansContainer.innerHTML = `<div style="text-align: center; padding: 32px;">No tienes planes de tratamiento activos.</div>`;
    }
});

// -- Render Functions --

function renderSkeletonCard(type) {
    if (type === 'next-appt') {
        return `
            <section class="portal-card-next" style="opacity: 0.7;">
                <div class="portal-card-next__header" style="justify-content: space-between; display: flex;">
                    <div class="skeleton" style="width: 100px; height: 16px;"></div>
                    <div class="skeleton" style="width: 20px; height: 20px;"></div>
                </div>
                <div class="portal-card-next__time" style="margin: 16px 0; display:flex; flex-direction:column; gap:8px;">
                    <div class="skeleton" style="width: 150px; height: 24px;"></div>
                    <div class="skeleton" style="width: 200px; height: 14px;"></div>
                </div>
                <div class="portal-card-next__doctor" style="display: flex; gap: 12px; align-items: center; margin-top: 16px;">
                    <div class="skeleton" style="width: 48px; height: 48px; border-radius: 50%;"></div>
                    <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                        <div class="skeleton" style="width: 120px; height: 14px;"></div>
                        <div class="skeleton" style="width: 180px; height: 12px;"></div>
                    </div>
                </div>
            </section>
        `;
    } else {
        return `
            <article class="portal-plan-card" style="opacity: 0.7; display: flex; gap: 16px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 12px; margin-bottom: 12px;">
                <div class="skeleton" style="width: 40px; height: 40px; border-radius: 8px;"></div>
                <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; justify-content: center;">
                    <div class="skeleton" style="width: 60%; height: 16px;"></div>
                    <div class="skeleton" style="width: 40%; height: 12px;"></div>
                </div>
            </article>
        `;
    }
}

function renderEmptyState(message, ctaText) {
    return `
        <section class="portal-card-next" style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 32px 16px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1);">
            <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 50%; margin-bottom: 16px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted, #94a3b8);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <strong style="margin-bottom: 4px; font-size: 16px;">${message}</strong>
            <button class="btn-primary" style="margin-top: 16px; pointer-events: auto; padding: 8px 16px; border-radius: 100px; font-size: 14px;">${ctaText}</button>
        </section>
    `;
}

function renderNextAppointment(appt) {
    const rawDate = appt.date || appt.appointment_date || 'Pronto';
    const time = appt.time || appt.appointment_time || 'Por confirmar';
    const typeLabel = appt.type === 'telemedicine' ? 'Teleconsulta' : (appt.service_name || 'Consulta Presencial');
    const docName = appt.doctor_name || 'Médico Asignado';

    return `
        <section class="portal-card-next">
            <div class="portal-card-next__header">
                <span class="portal-card-next__kicker">Próxima Visita</span>
                <svg class="portal-card-next__menu" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
            </div>
            <div class="portal-card-next__time">
                <strong>${rawDate}</strong>
                <span>${time} · Consultorio</span>
            </div>
            
            <div class="portal-card-next__doctor" style="align-items: center;">
                <img src="https://i.pravatar.cc/150?u=${docName}" alt="${docName}" />
                <div style="flex:1;">
                    <span>${docName}</span>
                    <small>${typeLabel}</small>
                </div>
            </div>

            <div style="margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px; text-align: center;">
                <button class="btn-ghost" style="width: 100%; border-radius: 8px; color: var(--color-aurora-400);">Reagendar Cita</button>
            </div>
        </section>
    `;
}

function renderClinicalPlan(history) {
    const badgeType = history.status === 'completed' ? 'badge-success' : 'badge-primary';
    const statusLabel = history.status === 'completed' ? 'Completado' : 'Activo';
    const protocolName = history.protocol_name || history.reason_for_visit || 'Tratamiento General';
    
    return `
        <article class="portal-plan-card">
            <div class="portal-plan-card__icon" style="color:var(--color-aurora-400); background:rgba(82, 113, 255, 0.1);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
            <div class="portal-plan-card__info" style="flex: 1;">
                <strong style="display:flex; justify-content:space-between; align-items:center;">
                    ${protocolName}
                    <span class="badge ${badgeType}" style="font-size: 10px; padding: 2px 6px;">${statusLabel}</span>
                </strong>
                <span>Actualizado: ${history.date || new Date().toISOString().split('T')[0]}</span>
            </div>
        </article>
    `;
}
