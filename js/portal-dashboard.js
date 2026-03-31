(function (window, document) {
    'use strict';

    const portalShell = window.AuroraPatientPortalShell || null;

    if (!document.getElementById('portal-skeleton-css')) {
        const style = document.createElement('style');
        style.id = 'portal-skeleton-css';
        style.textContent = `
            .skeleton {
                background: linear-gradient(90deg, rgba(148, 163, 184, 0.12) 25%, rgba(248, 250, 252, 0.24) 50%, rgba(148, 163, 184, 0.12) 75%);
                background-size: 200% 100%;
                animation: aurora-portal-shimmer 1.4s infinite linear;
                border-radius: 16px;
            }
            @keyframes aurora-portal-shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
        `;
        document.head.appendChild(style);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function readSession() {
        return portalShell && typeof portalShell.getSession === 'function'
            ? portalShell.getSession()
            : null;
    }

    function isFreshSession(session) {
        return Boolean(
            portalShell &&
                typeof portalShell.isFreshSession === 'function' &&
                portalShell.isFreshSession(session)
        );
    }

    function redirectToLogin() {
        if (portalShell && typeof portalShell.redirectToLogin === 'function') {
            portalShell.redirectToLogin();
            return;
        }

        window.location.replace('/es/portal/login/');
    }

    async function requestJson(resource, token) {
        const response = await window.fetch(`/api.php?resource=${resource}`, {
            headers: {
                Accept: 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });

        const body = await response.json().catch(() => ({}));
        return {
            ok: response.ok,
            status: response.status,
            body,
        };
    }

    function renderSkeletonCard() {
        return `
            <section class="portal-card-next" data-portal-next-skeleton style="opacity:0.78;">
                <div class="portal-card-next__header">
                    <div class="skeleton" style="width: 132px; height: 14px;"></div>
                    <div class="skeleton" style="width: 44px; height: 14px;"></div>
                </div>
                <div class="portal-card-next__time" style="display:flex; flex-direction:column; gap:12px;">
                    <div class="skeleton" style="width: 78%; height: 34px;"></div>
                    <div class="skeleton" style="width: 54%; height: 16px;"></div>
                </div>
                <div class="portal-card-next__doctor">
                    <div class="skeleton portal-card-next__avatar" style="border-radius:50%;"></div>
                    <div style="display:flex; flex-direction:column; gap:8px; flex:1;">
                        <div class="skeleton" style="width: 46%; height: 14px;"></div>
                        <div class="skeleton" style="width: 68%; height: 12px;"></div>
                    </div>
                </div>
                <div class="portal-appointment-prep" style="margin-top:18px;">
                    <div class="skeleton" style="width: 34%; height: 14px; margin-bottom:10px;"></div>
                    <div class="skeleton" style="width: 100%; height: 48px;"></div>
                </div>
                <div class="portal-cta-row" style="margin-top:18px;">
                    <div class="skeleton" style="width: 48%; height: 44px;"></div>
                    <div class="skeleton" style="width: 48%; height: 44px;"></div>
                </div>
            </section>
        `;
    }

    function renderActionSkeletons() {
        return `
            <article class="portal-support-card" style="opacity:0.78;">
                <div class="skeleton" style="width: 42px; height: 42px; border-radius: 14px;"></div>
                <div style="display:flex; flex-direction:column; gap:8px; flex:1;">
                    <div class="skeleton" style="width: 52%; height: 16px;"></div>
                    <div class="skeleton" style="width: 90%; height: 12px;"></div>
                </div>
            </article>
            <article class="portal-support-card" style="opacity:0.78;">
                <div class="skeleton" style="width: 42px; height: 42px; border-radius: 14px;"></div>
                <div style="display:flex; flex-direction:column; gap:8px; flex:1;">
                    <div class="skeleton" style="width: 48%; height: 16px;"></div>
                    <div class="skeleton" style="width: 82%; height: 12px;"></div>
                </div>
            </article>
        `;
    }

    function renderTreatmentPlanSkeleton() {
        return `
            <section class="portal-plan-card" data-portal-treatment-plan-skeleton style="opacity:0.8;">
                <div style="display:grid; gap:12px; width:100%;">
                    <div class="skeleton" style="width: 36%; height: 14px;"></div>
                    <div class="skeleton" style="width: 62%; height: 22px;"></div>
                    <div class="skeleton" style="width: 100%; height: 10px; border-radius: 999px;"></div>
                    <div class="portal-plan-card__metrics">
                        <div class="skeleton" style="width: 100%; height: 58px;"></div>
                        <div class="skeleton" style="width: 100%; height: 58px;"></div>
                    </div>
                    <div class="skeleton" style="width: 40%; height: 14px;"></div>
                    <div class="skeleton" style="width: 100%; height: 44px;"></div>
                    <div class="skeleton" style="width: 100%; height: 44px;"></div>
                </div>
            </section>
        `;
    }

    function renderBillingSkeleton() {
        return `
            <section class="portal-plan-card portal-billing-card" data-portal-billing-skeleton style="opacity:0.8;">
                <div style="display:grid; gap:12px; width:100%;">
                    <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
                        <div style="display:grid; gap:8px; flex:1;">
                            <div class="skeleton" style="width: 34%; height: 14px;"></div>
                            <div class="skeleton" style="width: 56%; height: 20px;"></div>
                        </div>
                        <div class="skeleton" style="width: 90px; height: 28px; border-radius:999px;"></div>
                    </div>
                    <div class="portal-billing-card__metrics">
                        <div class="skeleton" style="width: 100%; height: 92px;"></div>
                        <div class="skeleton" style="width: 100%; height: 92px;"></div>
                        <div class="skeleton" style="width: 100%; height: 92px;"></div>
                    </div>
                    <div class="skeleton" style="width: 100%; height: 40px;"></div>
                    <div class="skeleton" style="width: 100%; height: 44px;"></div>
                </div>
            </section>
        `;
    }

    function doctorInitials(name) {
        return String(name || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('') || 'AD';
    }

    function renderNextAppointment(appointment) {
        const safeAppointment =
            appointment && typeof appointment === 'object' ? appointment : {};
        const rescheduleUrl = String(safeAppointment.rescheduleUrl || '').trim();
        const whatsappUrl = String(safeAppointment.whatsappUrl || '').trim();

        return `
            <section class="portal-card-next" data-portal-next-appointment-card>
                <div class="portal-card-next__header">
                    <span class="portal-card-next__kicker">Próxima cita confirmada</span>
                    <span class="portal-status-chip">Activa</span>
                </div>
                <div class="portal-card-next__time">
                    <strong data-portal-next-date>${escapeHtml(safeAppointment.dateLabel || safeAppointment.date || 'Por confirmar')}</strong>
                    <span data-portal-next-time>${escapeHtml(safeAppointment.timeLabel || safeAppointment.time || 'Por confirmar')} · ${escapeHtml(safeAppointment.locationLabel || 'Aurora Derm')}</span>
                </div>
                <div class="portal-card-next__doctor">
                    <div class="portal-card-next__avatar" aria-hidden="true">${escapeHtml(doctorInitials(safeAppointment.doctorName))}</div>
                    <div style="flex:1;">
                        <span data-portal-next-doctor>${escapeHtml(safeAppointment.doctorName || 'Especialista Aurora Derm')}</span>
                        <small data-portal-next-type>${escapeHtml(safeAppointment.appointmentTypeLabel || 'Consulta presencial')}</small>
                        <small data-portal-next-service>${escapeHtml(safeAppointment.serviceName || 'Consulta Aurora Derm')}</small>
                    </div>
                </div>
                <div class="portal-appointment-prep">
                    <span class="portal-inline-label">Preparación requerida</span>
                    <p data-portal-next-preparation>${escapeHtml(safeAppointment.preparation || 'Te avisaremos si hace falta una preparación adicional.')}</p>
                </div>
                <div class="portal-cta-row">
                    ${
                        safeAppointment.appointmentType === 'telemedicine' && safeAppointment.id
                            ? `<a class="btn btn-primary" data-portal-next-telemed href="/es/telemedicina/sala/index.html?id=${escapeHtml(safeAppointment.id)}">Entrar a Sala</a>`
                            : ''
                    }
                    ${
                        whatsappUrl && safeAppointment.appointmentType !== 'telemedicine'
                            ? `<a class="btn btn-primary" data-portal-next-whatsapp href="${escapeHtml(whatsappUrl)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`
                            : (whatsappUrl ? `<a class="btn btn-secondary" data-portal-next-whatsapp href="${escapeHtml(whatsappUrl)}" target="_blank" rel="noopener noreferrer">Ayuda</a>` : '')
                    }
                    ${
                        rescheduleUrl
                            ? `<a class="btn btn-secondary" data-portal-next-reagendar href="${escapeHtml(rescheduleUrl)}">Reagendar</a>`
                            : ''
                    }
                </div>
            </section>
        `;
    }

    function renderEmptyState(support) {
        const safeSupport = support && typeof support === 'object' ? support : {};
        const bookingUrl = String(safeSupport.bookingUrl || '/#citas').trim() || '/#citas';
        const whatsappUrl = String(safeSupport.whatsappUrl || '').trim();

        return `
            <section class="portal-card-next portal-empty-state" data-portal-empty-state>
                <span class="portal-card-next__kicker">Sin cita pendiente</span>
                <strong>No tienes una cita activa por ahora</strong>
                <p>Agenda tu próxima consulta desde el sitio o escríbenos y te ayudamos a encontrar el mejor horario.</p>
                <div class="portal-cta-row">
                    <a class="btn btn-primary" data-portal-booking-cta href="${escapeHtml(bookingUrl)}">Agendar nueva cita</a>
                    ${
                        whatsappUrl
                            ? `<a class="btn btn-secondary" data-portal-empty-whatsapp href="${escapeHtml(whatsappUrl)}" target="_blank" rel="noopener noreferrer">Pedir ayuda</a>`
                            : ''
                    }
                </div>
            </section>
        `;
    }

    function renderErrorState() {
        return `
            <section class="portal-card-next portal-empty-state">
                <span class="portal-card-next__kicker">Portal temporalmente ocupado</span>
                <strong>No pudimos cargar tu próxima cita</strong>
                <p>Intenta recargar en unos segundos o escríbenos por WhatsApp para confirmarla.</p>
            </section>
        `;
    }

    function renderSupportActions(support) {
        const safeSupport = support && typeof support === 'object' ? support : {};
        const items = [
            {
                href: String(safeSupport.historyUrl || '/es/portal/historial/').trim() || '/es/portal/historial/',
                label: 'Historial',
                copy: 'Consulta recetas, certificados y próximos documentos desde una misma vista.',
                icon: 'docs',
            },
            {
                href: String(safeSupport.planUrl || '/es/portal/plan/').trim() || '/es/portal/plan/',
                label: 'Mi plan',
                copy: 'Sigue el progreso real de tus sesiones, lo que viene y lo que todavía falta agendar.',
                icon: 'plan',
            },
            {
                href: String(safeSupport.prescriptionUrl || '/es/portal/receta/').trim() || '/es/portal/receta/',
                label: 'Mi receta',
                copy: 'Revisa tu receta activa, descarga el PDF firmado y valida su autenticidad con QR.',
                icon: 'prescription',
            },
            {
                href: String(safeSupport.photosUrl || '/es/portal/fotos/').trim() || '/es/portal/fotos/',
                label: 'Mis fotos',
                copy: 'Sigue tu evolución por zona y fecha con las imágenes visibles para tu portal.',
                icon: 'photos',
            },
            {
                href: String(safeSupport.whatsappUrl || '').trim(),
                label: 'Soporte por WhatsApp',
                copy: 'Habla con recepción si necesitas mover tu horario o confirmar indicaciones.',
                icon: 'whatsapp',
                external: true,
            },
            {
                href: '/es/portal/referidos/',
                label: 'Mis Referidos',
                copy: 'Comparte tu código único y obtén beneficios en tu próxima consulta.',
                icon: 'referral',
            },
            {
                href: String(safeSupport.bookingUrl || '/#citas').trim() || '/#citas',
                label: 'Nueva reserva',
                copy: 'Si ya cerraste tu tratamiento, agenda tu siguiente control desde aquí.',
                icon: 'calendar',
            },
        ];

        return items
            .filter((item) => item.href !== '')
            .map((item) => {
                const icon =
                    item.icon === 'whatsapp'
                        ? 'W'
                        : item.icon === 'plan'
                            ? 'P'
                        : item.icon === 'prescription'
                            ? 'R'
                        : item.icon === 'photos'
                            ? 'F'
                        : item.icon === 'calendar'
                            ? 'A'
                        : item.icon === 'referral'
                            ? '★'
                            : 'H';
                return `
                    <a class="portal-support-card" href="${escapeHtml(item.href)}"${item.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>
                        <span class="portal-support-card__icon" aria-hidden="true">${icon}</span>
                        <span class="portal-support-card__body">
                            <strong>${escapeHtml(item.label)}</strong>
                            <small>${escapeHtml(item.copy)}</small>
                        </span>
                    </a>
                `;
            })
            .join('');
    }

    function progressTone(adherencePercent) {
        const percent = Number(adherencePercent || 0);
        if (percent >= 80) {
            return 'good';
        }
        if (percent >= 50) {
            return 'warning';
        }
        return 'attention';
    }

    function renderTreatmentTasks(tasks) {
        const safeTasks = Array.isArray(tasks) ? tasks : [];
        return safeTasks
            .map((task) => {
                const safeTask = task && typeof task === 'object' ? task : {};
                const label = String(safeTask.label || '').trim();
                if (!label) {
                    return '';
                }

                return `
                    <li class="portal-plan-card__task" data-portal-treatment-task>
                        <span class="portal-plan-card__task-dot" aria-hidden="true"></span>
                        <span>${escapeHtml(label)}</span>
                    </li>
                `;
            })
            .filter(Boolean)
            .join('');
    }

    function renderTreatmentPlan(plan) {
        const safePlan = plan && typeof plan === 'object' ? plan : {};
        const adherencePercent = Math.max(
            0,
            Math.min(100, Number(safePlan.adherencePercent || 0))
        );
        const nextSession =
            safePlan.nextSession && typeof safePlan.nextSession === 'object'
                ? safePlan.nextSession
                : null;
        const tasksHtml = renderTreatmentTasks(safePlan.tasks);

        return `
            <section class="portal-plan-card" data-portal-treatment-plan-card>
                <div class="portal-plan-card__header">
                    <div class="portal-plan-card__info">
                        <span class="portal-inline-label">Plan activo</span>
                        <strong data-portal-treatment-diagnosis>${escapeHtml(safePlan.diagnosis || 'Seguimiento activo')}</strong>
                        <span data-portal-treatment-follow-up>${escapeHtml(safePlan.followUpFrequency || 'A requerimiento')}</span>
                    </div>
                    <span class="portal-status-chip portal-status-chip--${escapeHtml(progressTone(adherencePercent))}" data-portal-treatment-adherence>
                        ${escapeHtml(safePlan.adherenceLabel || `${adherencePercent}%`)}
                    </span>
                </div>

                <div class="portal-plan-card__progress">
                    <div class="portal-plan-card__progress-labels">
                        <span data-portal-treatment-progress>${escapeHtml(safePlan.progressLabel || '0 de 0 sesiones')}</span>
                        <span>${escapeHtml(safePlan.adherenceLabel || `${adherencePercent}%`)}</span>
                    </div>
                    <div class="portal-plan-card__progress-track" aria-hidden="true">
                        <span style="width:${adherencePercent}%"></span>
                    </div>
                </div>

                <div class="portal-plan-card__metrics">
                    <article class="portal-plan-card__metric">
                        <strong>Sesiones realizadas</strong>
                        <span>${escapeHtml(String(safePlan.completedSessions || 0))}</span>
                    </article>
                    <article class="portal-plan-card__metric">
                        <strong>Próxima sesión</strong>
                        <span data-portal-treatment-next-session>${escapeHtml(
                            nextSession
                                ? `${nextSession.dateLabel || ''} ${nextSession.timeLabel || ''}`.trim() || 'Por confirmar'
                                : 'Por confirmar'
                        )}</span>
                    </article>
                </div>

                ${
                    tasksHtml
                        ? `
                            <div class="portal-plan-card__tasks">
                                <span class="portal-inline-label">Tareas pendientes</span>
                                <ul>${tasksHtml}</ul>
                            </div>
                        `
                        : ''
                }
            </section>
        `;
    }

    function renderTreatmentPlanEmpty() {
        return `
            <section class="portal-plan-card portal-plan-card--empty" data-portal-treatment-plan-empty>
                <div class="portal-plan-card__info">
                    <span class="portal-inline-label">Plan en preparación</span>
                    <strong>Todavía no tenemos un plan activo visible</strong>
                    <span>Cuando tu especialista publique indicaciones y seguimiento, aparecerán aquí con su progreso real.</span>
                </div>
            </section>
        `;
    }

    function renderBillingMetric(title, value, note, attr) {
        return `
            <article class="portal-plan-card__metric portal-billing-card__metric">
                <strong>${escapeHtml(title)}</strong>
                <span${attr ? ` ${attr}` : ''}>${escapeHtml(value)}</span>
                <small>${escapeHtml(note)}</small>
            </article>
        `;
    }

    function renderBillingCard(billing) {
        const safeBilling = billing && typeof billing === 'object' ? billing : {};
        const tone = ['good', 'warning', 'attention', 'idle'].includes(String(safeBilling.tone || ''))
            ? String(safeBilling.tone || 'idle')
            : 'idle';
        const lastPayment =
            safeBilling.lastPayment && typeof safeBilling.lastPayment === 'object'
                ? safeBilling.lastPayment
                : null;
        const nextObligation =
            safeBilling.nextObligation && typeof safeBilling.nextObligation === 'object'
                ? safeBilling.nextObligation
                : null;
        const payNowUrl = String(safeBilling.payNowUrl || '/es/pago/').trim() || '/es/pago/';
        const reviewBalanceCents = Number(safeBilling.reviewBalanceCents || 0);
        const detailParts = [String(safeBilling.statusDetail || '').trim()].filter(Boolean);

        if (reviewBalanceCents > 0 && String(safeBilling.reviewBalanceLabel || '').trim()) {
            detailParts.push(`Incluye ${String(safeBilling.reviewBalanceLabel).trim()} en revisión manual.`);
        }

        return `
            <section class="portal-plan-card portal-billing-card" data-portal-billing-card>
                <div class="portal-plan-card__header">
                    <div class="portal-plan-card__info">
                        <span class="portal-inline-label">Resumen financiero</span>
                        <strong>Saldo y próximos cobros</strong>
                        <span>No mostramos datos bancarios ni comprobantes sensibles en esta vista.</span>
                    </div>
                    <span class="portal-status-chip portal-status-chip--${escapeHtml(tone)}" data-portal-billing-status>
                        ${escapeHtml(String(safeBilling.statusLabel || 'Sin datos'))}
                    </span>
                </div>

                <div class="portal-billing-card__metrics">
                    ${renderBillingMetric(
                        'Total pendiente',
                        String(safeBilling.totalPendingLabel || '$0.00'),
                        reviewBalanceCents > 0
                            ? 'Incluye cobros pendientes y pagos en revisión.'
                            : 'Solo lectura desde tu portal.',
                        'data-portal-billing-total'
                    )}
                    ${renderBillingMetric(
                        'Último pago',
                        lastPayment ? String(lastPayment.amountLabel || 'Sin registro') : 'Sin registro',
                        lastPayment
                            ? `${String(lastPayment.paymentMethodLabel || 'Pago')} · ${String(lastPayment.paidAtLabel || 'Sin fecha')}`
                            : 'Todavía no hay pagos confirmados.',
                        'data-portal-billing-last-payment'
                    )}
                    ${renderBillingMetric(
                        'Próxima obligación',
                        nextObligation ? String(nextObligation.dueAtLabel || 'Por confirmar') : 'Sin vencimientos',
                        nextObligation
                            ? `${String(nextObligation.concept || 'Saldo pendiente')} · ${String(nextObligation.amountLabel || '')}`.trim()
                            : 'No tienes cobros pendientes ahora mismo.',
                        'data-portal-billing-next-due'
                    )}
                </div>

                <p class="portal-billing-card__detail" data-portal-billing-detail>${escapeHtml(
                    detailParts.join(' ')
                )}</p>

                <div class="portal-cta-row portal-cta-row--single">
                    <a class="btn btn-primary" data-portal-billing-cta href="${escapeHtml(payNowUrl)}">Pagar ahora</a>
                </div>
            </section>
        `;
    }

    function renderBillingUnavailable() {
        return renderBillingCard({
            tone: 'idle',
            statusLabel: 'No disponible',
            statusDetail:
                'No pudimos cargar tu resumen de pagos en este momento. Puedes abrir el checkout seguro si necesitas pagar ahora.',
            totalPendingLabel: '$0.00',
            reviewBalanceCents: 0,
            lastPayment: null,
            nextObligation: null,
            payNowUrl: '/es/pago/',
        });
    }

    function renderEvolutionSkeleton() {
        return `
            <section class="portal-section" data-portal-evolution-skeleton style="opacity:0.8;">
                <div class="portal-section-heading">
                    <span class="portal-section-copy">Evolución</span>
                    <h2 class="portal-section-title">Tu progreso en el tratamiento</h2>
                </div>
                <div class="skeleton" style="width: 100%; height: 320px; border-radius: 16px;"></div>
            </section>
        `;
    }

    function renderEvolutionCard(evolution) {
        const safeEvo = evolution && typeof evolution === 'object' ? evolution : {};
        if (!safeEvo.before || !safeEvo.after) return '';

        const before = safeEvo.before;
        const after = safeEvo.after;

        return `
            <section class="portal-section" aria-labelledby="portal-evolution-title">
                <div class="portal-section-heading">
                    <span class="portal-section-copy">Tu progreso clínico (${escapeHtml(safeEvo.diffDays)} días de monitoreo)</span>
                    <h2 id="portal-evolution-title" class="portal-section-title">Resultados de tu tratamiento</h2>
                    <p>Observa tu evolución médica comparando tu registro de ${escapeHtml(safeEvo.bodyZone)} a través del tiempo.</p>
                </div>
                <div style="overflow: hidden; position: relative;">
                    <div class="pub-ba-container" id="baSliderPortal" style="height: 340px; border-radius: var(--radius-lg); width: 100%;">
                        <div class="pub-ba-img pub-ba-before">
                            <img src="${escapeHtml(before.url)}" alt="Antes del tratamiento - ${escapeHtml(before.label)}" style="width: 100%; height: 100%; object-fit: cover; object-position: center;">
                            <span class="pub-ba-label" style="background: rgba(0,0,0,0.6);">${escapeHtml(before.label)}</span>
                        </div>
                        <div class="pub-ba-img pub-ba-after">
                            <img src="${escapeHtml(after.url)}" alt="Después del tratamiento - ${escapeHtml(after.label)}" style="width: 100%; height: 100%; object-fit: cover; object-position: center;">
                            <span class="pub-ba-label" style="background: rgba(0,0,0,0.6);">${escapeHtml(after.label)}</span>
                        </div>
                        <div class="pub-ba-divider">
                            <div class="pub-ba-handle">
                                <svg viewBox="0 0 24 24" fill="none" class="pub-ba-arrows" style="width: 18px; height: 18px; stroke: currentColor; stroke-width: 2.5;"><path d="M15 18l5-6-5-6M9 6L4 12l5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            </div>
                        </div>
                        <input type="range" class="pub-ba-slider" min="0" max="100" value="50" aria-label="Deslizar para comparar evolución">
                    </div>
                </div>
            </section>
        `;
    }

    async function hydrateDashboard() {
        const nextAppointmentContainer = document.getElementById('portal-next-appointment');
        const treatmentPlanContainer = document.getElementById('portal-treatment-plan');
        const evolutionContainer = document.getElementById('portal-evolution');
        const billingContainer = document.getElementById('portal-billing-summary');
        const actionsContainer = document.getElementById('portal-appointment-actions');
        if (!(nextAppointmentContainer instanceof HTMLElement)) {
            return;
        }

        const session = readSession();
        if (!isFreshSession(session)) {
            if (portalShell && typeof portalShell.clearSession === 'function') {
                portalShell.clearSession();
            }
            redirectToLogin();
            return;
        }

        nextAppointmentContainer.innerHTML = renderSkeletonCard();
        if (treatmentPlanContainer instanceof HTMLElement) {
            treatmentPlanContainer.innerHTML = renderTreatmentPlanSkeleton();
        }
        if (evolutionContainer instanceof HTMLElement) {
            evolutionContainer.innerHTML = renderEvolutionSkeleton();
        }
        if (billingContainer instanceof HTMLElement) {
            billingContainer.innerHTML = renderBillingSkeleton();
        }
        if (actionsContainer instanceof HTMLElement) {
            actionsContainer.innerHTML = renderActionSkeletons();
        }

        try {
            const result = await requestJson('patient-portal-dashboard', String(session.token || ''));
            if (!result.ok || !result.body || result.body.ok !== true) {
                if (result.status === 401) {
                    if (portalShell && typeof portalShell.clearSession === 'function') {
                        portalShell.clearSession();
                    }
                    redirectToLogin();
                    return;
                }

                throw new Error(
                    result.body && result.body.error
                        ? result.body.error
                        : 'portal_dashboard_unavailable'
                );
            }

            const payload = result.body.data && typeof result.body.data === 'object' ? result.body.data : {};
            const patient = payload.patient && typeof payload.patient === 'object' ? payload.patient : {};
            const nextAppointment =
                payload.nextAppointment && typeof payload.nextAppointment === 'object'
                    ? payload.nextAppointment
                    : null;
            const treatmentPlan =
                payload.treatmentPlan && typeof payload.treatmentPlan === 'object'
                    ? payload.treatmentPlan
                    : null;
            const billing =
                payload.billing && typeof payload.billing === 'object' ? payload.billing : null;
            const evolution =
                payload.evolution && typeof payload.evolution === 'object' ? payload.evolution : null;
            const support = payload.support && typeof payload.support === 'object' ? payload.support : {};

            if (portalShell && typeof portalShell.updatePatient === 'function' && patient.name) {
                portalShell.updatePatient(patient);
            }

            nextAppointmentContainer.innerHTML = nextAppointment
                ? renderNextAppointment(nextAppointment)
                : renderEmptyState(support);
            if (treatmentPlanContainer instanceof HTMLElement) {
                treatmentPlanContainer.innerHTML = treatmentPlan
                    ? renderTreatmentPlan(treatmentPlan)
                    : renderTreatmentPlanEmpty();
            }
            if (evolutionContainer instanceof HTMLElement) {
                evolutionContainer.innerHTML = evolution
                    ? renderEvolutionCard(evolution)
                    : '';
                const baContainer = document.getElementById('baSliderPortal');
                if (baContainer) {
                    const slider = baContainer.querySelector('.pub-ba-slider');
                    if (slider) {
                        slider.addEventListener('input', function(e) {
                            baContainer.style.setProperty('--position', e.target.value + '%');
                        });
                        baContainer.style.setProperty('--position', slider.value + '%');
                    }
                }
            }
            if (billingContainer instanceof HTMLElement) {
                billingContainer.innerHTML = renderBillingCard(billing);
            }

            if (actionsContainer instanceof HTMLElement) {
                actionsContainer.innerHTML = renderSupportActions(support);
            }
        } catch (error) {
            console.error('[portal-dashboard] failed to load next appointment', error);
            nextAppointmentContainer.innerHTML = renderErrorState();
            if (treatmentPlanContainer instanceof HTMLElement) {
                treatmentPlanContainer.innerHTML = renderTreatmentPlanEmpty();
            }
            if (evolutionContainer instanceof HTMLElement) {
                evolutionContainer.innerHTML = '';
            }
            if (billingContainer instanceof HTMLElement) {
                billingContainer.innerHTML = renderBillingUnavailable();
            }
            if (actionsContainer instanceof HTMLElement) {
                actionsContainer.innerHTML = renderSupportActions({
                    bookingUrl: '/#citas',
                    historyUrl: '/es/portal/historial/',
                    photosUrl: '/es/portal/fotos/',
                    whatsappUrl: 'https://wa.me/593982453672?text=Hola%2C%20necesito%20ayuda%20con%20mi%20portal%20de%20Aurora%20Derm.',
                });
            }
        }
    }

    document.addEventListener('DOMContentLoaded', hydrateDashboard);
})(window, document);
