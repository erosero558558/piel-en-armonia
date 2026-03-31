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

    function clearSession() {
        if (portalShell && typeof portalShell.clearSession === 'function') {
            portalShell.clearSession();
        }
    }

    function redirectToLogin() {
        if (portalShell && typeof portalShell.redirectToLogin === 'function') {
            portalShell.redirectToLogin();
            return;
        }

        window.location.replace('/es/portal/login/');
    }

    function updatePatient(patient) {
        if (portalShell && typeof portalShell.updatePatient === 'function') {
            portalShell.updatePatient(patient);
        }
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

    function renderSummarySkeleton() {
        return `
            <div class="portal-plan-hero-grid" data-portal-plan-summary-skeleton>
                <article class="portal-plan-hero-card portal-plan-hero-card--wide" style="opacity:0.82;">
                    <div class="skeleton" style="width: 30%; height: 12px;"></div>
                    <div class="skeleton" style="width: 62%; height: 26px; margin-top: 10px;"></div>
                    <div class="skeleton" style="width: 88%; height: 12px; margin-top: 10px;"></div>
                    <div class="skeleton" style="width: 100%; height: 12px; margin-top: 8px;"></div>
                </article>
                <article class="portal-plan-hero-card" style="opacity:0.82;">
                    <div class="skeleton" style="width: 48%; height: 12px;"></div>
                    <div class="skeleton" style="width: 56%; height: 20px; margin-top: 10px;"></div>
                </article>
                <article class="portal-plan-hero-card" style="opacity:0.82;">
                    <div class="skeleton" style="width: 42%; height: 12px;"></div>
                    <div class="skeleton" style="width: 60%; height: 20px; margin-top: 10px;"></div>
                </article>
            </div>
        `;
    }

    function renderTimelineSkeleton() {
        return `
            <div class="portal-plan-timeline" data-portal-plan-timeline-skeleton>
                <article class="portal-plan-timeline-card" style="opacity:0.82;">
                    <div class="portal-plan-timeline-card__row">
                        <span class="portal-plan-timeline-card__dot"></span>
                        <div style="display:grid; gap:10px;">
                            <div class="skeleton" style="width: 34%; height: 14px;"></div>
                            <div class="skeleton" style="width: 46%; height: 22px;"></div>
                            <div class="skeleton" style="width: 76%; height: 12px;"></div>
                            <div class="skeleton" style="width: 92%; height: 12px;"></div>
                        </div>
                    </div>
                </article>
                <article class="portal-plan-timeline-card" style="opacity:0.82;">
                    <div class="portal-plan-timeline-card__row">
                        <span class="portal-plan-timeline-card__dot"></span>
                        <div style="display:grid; gap:10px;">
                            <div class="skeleton" style="width: 28%; height: 14px;"></div>
                            <div class="skeleton" style="width: 42%; height: 22px;"></div>
                            <div class="skeleton" style="width: 70%; height: 12px;"></div>
                        </div>
                    </div>
                </article>
            </div>
        `;
    }

    function renderNextSkeleton() {
        return `
            <div class="portal-plan-hero-grid" data-portal-plan-next-skeleton>
                <article class="portal-plan-next-card portal-plan-next-card--wide" style="opacity:0.82;">
                    <div class="skeleton" style="width: 32%; height: 12px;"></div>
                    <div class="skeleton" style="width: 58%; height: 22px; margin-top: 10px;"></div>
                    <div class="skeleton" style="width: 100%; height: 12px; margin-top: 10px;"></div>
                    <div class="skeleton" style="width: 76%; height: 12px; margin-top: 8px;"></div>
                </article>
            </div>
        `;
    }

    function renderSummary(plan) {
        const safePlan = plan && typeof plan === 'object' ? plan : {};
        if (!safePlan || Object.keys(safePlan).length === 0) {
            return `
                <section class="portal-support-card portal-plan-empty" data-portal-plan-empty>
                    <div>
                        <h2>Todavía no tenemos un plan activo visible</h2>
                        <p>Cuando tu especialista publique indicaciones y sesiones de seguimiento, aparecerán aquí con su progreso real.</p>
                    </div>
                </section>
            `;
        }

        const adherencePercent = Math.max(0, Math.min(100, Number(safePlan.adherencePercent || 0)));

        return `
            <div class="portal-plan-hero-grid">
                <article class="portal-plan-hero-card portal-plan-hero-card--wide" data-portal-plan-hero-card>
                    <span class="portal-inline-label">Diagnóstico base</span>
                    <strong data-portal-plan-diagnosis>${escapeHtml(safePlan.diagnosis || 'Plan activo')}</strong>
                    <small data-portal-plan-follow-up>${escapeHtml(safePlan.followUpFrequency || 'A requerimiento')}</small>
                    <div class="portal-plan-hero-card__progress">
                        <div class="portal-plan-card__progress-labels">
                            <span data-portal-plan-progress>${escapeHtml(safePlan.progressLabel || '0 de 0 sesiones')}</span>
                            <span>${escapeHtml(safePlan.adherenceLabel || `${adherencePercent}%`)}</span>
                        </div>
                        <div class="portal-plan-card__progress-track" aria-hidden="true">
                            <span style="width:${adherencePercent}%"></span>
                        </div>
                    </div>
                    <div class="portal-plan-hero-card__banner" data-portal-plan-banner>
                        ${escapeHtml(
                            [safePlan.scheduledSessionsLabel, safePlan.unscheduledSessions > 0 ? safePlan.unscheduledSessionsLabel : '']
                                .filter(Boolean)
                                .join(' · ')
                        )}
                    </div>
                </article>
                <article class="portal-plan-hero-card">
                    <span class="portal-inline-label portal-inline-label--muted">Adherencia</span>
                    <strong data-portal-plan-adherence>${escapeHtml(safePlan.adherenceLabel || `${adherencePercent}%`)}</strong>
                    <small>Basada en sesiones realizadas versus planificadas.</small>
                </article>
                <article class="portal-plan-hero-card">
                    <span class="portal-inline-label portal-inline-label--muted">Última actualización</span>
                    <strong data-portal-plan-generated>${escapeHtml(safePlan.generatedAtLabel || 'Plan reciente')}</strong>
                    <small>${escapeHtml(safePlan.timelineLabel || '')}</small>
                </article>
            </div>
        `;
    }

    function renderTimelineCard(item) {
        const safeItem = item && typeof item === 'object' ? item : {};
        const metaParts = [
            safeItem.dateLabel,
            safeItem.timeLabel,
            safeItem.serviceName,
            safeItem.appointmentTypeLabel,
        ].filter(Boolean);
        const auxiliaryParts = [
            safeItem.doctorName,
            safeItem.locationLabel,
        ].filter(Boolean);

        return `
            <article class="portal-plan-timeline-card" data-portal-plan-timeline-card data-tone="${escapeHtml(
                safeItem.tone || 'idle'
            )}">
                <div class="portal-plan-timeline-card__row">
                    <span class="portal-plan-timeline-card__dot" aria-hidden="true"></span>
                    <div>
                        <div class="portal-plan-timeline-card__header">
                            <div class="portal-plan-timeline-card__meta">
                                <span class="portal-inline-label">${escapeHtml(safeItem.label || 'Sesión')}</span>
                                <strong data-portal-plan-session-label>${escapeHtml(safeItem.statusLabel || 'Hito')}</strong>
                                <small data-portal-plan-session-meta>${escapeHtml(
                                    metaParts.join(' · ') || 'Sin fecha confirmada todavía.'
                                )}</small>
                                ${
                                    auxiliaryParts.length > 0
                                        ? `<small data-portal-plan-session-aux>${escapeHtml(auxiliaryParts.join(' · '))}</small>`
                                        : ''
                                }
                            </div>
                            <span class="portal-status-chip portal-status-chip--${escapeHtml(
                                safeItem.tone || 'idle'
                            )}">${escapeHtml(safeItem.status || 'pending')}</span>
                        </div>
                        ${
                            safeItem.preparation
                                ? `<p>${escapeHtml(safeItem.preparation)}</p>`
                                : '<p>Todavía no hay una fecha confirmada para esta sesión.</p>'
                        }
                        ${
                            safeItem.rescheduleUrl || safeItem.whatsappUrl
                                ? `<div class="portal-plan-timeline-card__actions">
                                    ${
                                        safeItem.rescheduleUrl
                                            ? `<a class="btn btn-secondary" href="${escapeHtml(safeItem.rescheduleUrl)}">Reagendar</a>`
                                            : ''
                                    }
                                    ${
                                        safeItem.whatsappUrl
                                            ? `<a class="btn btn-secondary" href="${escapeHtml(safeItem.whatsappUrl)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`
                                            : ''
                                    }
                                </div>`
                                : ''
                        }
                    </div>
                </div>
            </article>
        `;
    }

    function renderTimeline(plan) {
        const safePlan = plan && typeof plan === 'object' ? plan : {};
        const timeline = Array.isArray(safePlan.timeline) ? safePlan.timeline : [];

        if (!safePlan || Object.keys(safePlan).length === 0) {
            return '';
        }

        return `<div class="portal-plan-timeline">${timeline.map(renderTimelineCard).join('')}</div>`;
    }

    function renderTaskList(tasks) {
        const safeTasks = Array.isArray(tasks) ? tasks : [];
        return safeTasks
            .map((task) => {
                const safeTask = task && typeof task === 'object' ? task : {};
                const label = String(safeTask.label || '').trim();
                if (!label) {
                    return '';
                }

                return `
                    <article class="portal-plan-next-item" data-portal-plan-next-item>
                        <span class="portal-plan-next-item__dot" aria-hidden="true"></span>
                        <div>
                            <strong>${escapeHtml(label)}</strong>
                        </div>
                    </article>
                `;
            })
            .filter(Boolean)
            .join('');
    }

    function renderNext(plan) {
        const safePlan = plan && typeof plan === 'object' ? plan : {};
        if (!safePlan || Object.keys(safePlan).length === 0) {
            return '';
        }

        const nextSession =
            safePlan.nextSession && typeof safePlan.nextSession === 'object'
                ? safePlan.nextSession
                : null;
        const tasksHtml = renderTaskList(safePlan.tasks);

        return `
            <div class="portal-plan-hero-grid">
                <article class="portal-plan-next-card portal-plan-next-card--wide" data-portal-plan-next-card>
                    <span class="portal-inline-label">Próxima sesión</span>
                    <strong data-portal-plan-next-session>${escapeHtml(
                        nextSession
                            ? `${nextSession.dateLabel || ''} ${nextSession.timeLabel || ''}`.trim() || 'Por confirmar'
                            : 'Por confirmar'
                    )}</strong>
                    <small>${escapeHtml(
                        nextSession
                            ? [nextSession.serviceName, nextSession.doctorName, nextSession.locationLabel]
                                .filter(Boolean)
                                .join(' · ')
                            : 'Cuando la siguiente sesión quede confirmada aparecerá aquí.'
                    )}</small>
                    ${
                        nextSession && (nextSession.rescheduleUrl || nextSession.whatsappUrl)
                            ? `<div class="portal-plan-timeline-card__actions">
                                ${
                                    nextSession.rescheduleUrl
                                        ? `<a class="btn btn-secondary" href="${escapeHtml(nextSession.rescheduleUrl)}">Reagendar</a>`
                                        : ''
                                }
                                ${
                                    nextSession.whatsappUrl
                                        ? `<a class="btn btn-secondary" href="${escapeHtml(nextSession.whatsappUrl)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`
                                        : ''
                                }
                            </div>`
                            : ''
                    }
                </article>
                <article class="portal-plan-next-card">
                    <span class="portal-inline-label portal-inline-label--muted">Tratamiento</span>
                    <strong data-portal-plan-treatments>${escapeHtml(
                        safePlan.treatmentsText || 'Seguimiento activo publicado por tu especialista.'
                    )}</strong>
                </article>
                <article class="portal-plan-next-card">
                    <span class="portal-inline-label portal-inline-label--muted">Objetivos</span>
                    <strong data-portal-plan-goals>${escapeHtml(
                        safePlan.goalsText || 'Mantener el avance y cumplir los controles programados.'
                    )}</strong>
                </article>
                ${
                    tasksHtml
                        ? `<article class="portal-plan-next-card portal-plan-next-card--wide">
                            <span class="portal-inline-label">Próximos pasos</span>
                            <div class="portal-plan-next-list">${tasksHtml}</div>
                        </article>`
                        : ''
                }
            </div>
        `;
    }

    async function hydratePlan() {
        const summaryContainer = document.getElementById('portal-plan-summary');
        const timelineContainer = document.getElementById('portal-plan-timeline');
        const nextContainer = document.getElementById('portal-plan-next');
        if (
            !(summaryContainer instanceof HTMLElement) ||
            !(timelineContainer instanceof HTMLElement) ||
            !(nextContainer instanceof HTMLElement)
        ) {
            return;
        }

        const session = readSession();
        if (!isFreshSession(session)) {
            clearSession();
            redirectToLogin();
            return;
        }

        const token = String(session.token || '').trim();
        summaryContainer.innerHTML = renderSummarySkeleton();
        timelineContainer.innerHTML = renderTimelineSkeleton();
        nextContainer.innerHTML = renderNextSkeleton();

        try {
            const response = await requestJson('patient-portal-plan', token);
            if (response.status === 401) {
                clearSession();
                redirectToLogin();
                return;
            }

            if (!response.ok || !response.body || response.body.ok !== true) {
                throw new Error('portal_plan_failed');
            }

            const data = response.body.data && typeof response.body.data === 'object' ? response.body.data : {};
            const patient = data.patient && typeof data.patient === 'object' ? data.patient : {};
            const plan =
                data.treatmentPlan && typeof data.treatmentPlan === 'object'
                    ? data.treatmentPlan
                    : null;

            updatePatient(patient);
            summaryContainer.innerHTML = renderSummary(plan || {});
            timelineContainer.innerHTML = renderTimeline(plan || {});
            nextContainer.innerHTML = renderNext(plan || {});
        } catch (_error) {
            summaryContainer.innerHTML = `
                <section class="portal-support-card portal-plan-empty">
                    <div>
                        <h2>No pudimos cargar tu plan ahora mismo</h2>
                        <p>Recarga en unos segundos. Si necesitas confirmar la siguiente sesión, escríbenos por WhatsApp.</p>
                    </div>
                </section>
            `;
            timelineContainer.innerHTML = '';
            nextContainer.innerHTML = '';
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        void hydratePlan();
    });
})(window, document);
