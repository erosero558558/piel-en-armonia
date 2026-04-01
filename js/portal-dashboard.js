(function (window, document) {
    'use strict';

    const portalShell = window.AuroraPatientPortalShell || null;
    let crossSellCatalogPromise = null;

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
            .portal-red-flag {
                background: rgba(220, 38, 38, 0.1);
                border: 1px solid var(--admin-error);
                padding: 16px;
                margin: 24px 24px 0 24px;
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .portal-red-flag strong {
                color: var(--admin-error);
                font-size: 1.05em;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .portal-red-flag p {
                margin: 0;
                font-size: 0.95em;
                color: var(--admin-text);
            }
            .portal-survey-card {
                background: linear-gradient(145deg, var(--pub-bg-surface), rgba(201, 169, 110, 0.05));
                border: 1px solid var(--pub-border);
                margin: 24px 24px 0 24px;
                border-radius: 12px;
                padding: 24px;
                display: flex;
                flex-direction: column;
                gap: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.03);
            }
            .portal-survey-card h3 {
                margin: 0;
                color: var(--pub-text-primary);
                font-size: 1.1em;
            }
            .portal-survey-card p {
                margin: 0;
                color: var(--pub-text-muted);
                font-size: 0.9em;
            }
            .star-rating {
                display: flex;
                gap: 8px;
                flex-direction: row-reverse;
                justify-content: flex-end;
            }
            .star-rating input {
                display: none;
            }
            .star-rating label {
                font-size: 28px;
                color: #ccc;
                cursor: pointer;
                transition: color 0.2s;
            }
            .star-rating input:checked ~ label,
            .star-rating label:hover,
            .star-rating label:hover ~ label {
                color: var(--color-gold-500);
            }
            .portal-survey-input {
                width: 100%;
                border: 1px solid var(--pub-border);
                background: var(--pub-bg-body);
                border-radius: 8px;
                padding: 12px;
                color: var(--pub-text-primary);
                font-family: inherit;
                resize: vertical;
                min-height: 80px;
            }
            .portal-survey-submit {
                background: var(--color-slate-900);
                color: var(--color-white);
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.2s;
                align-self: flex-start;
            }
            .portal-survey-submit:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            .portal-survey-submit:hover:not(:disabled) {
                background: var(--color-gold-600);
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

    function renderSurvey(survey) {
        if (!survey || !survey.appointmentId) {
            return '';
        }
        return `
            <form class="portal-survey-card" id="npsSurveyForm" data-appointment-id="${escapeHtml(survey.appointmentId)}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <h3>Cuéntanos cómo te fue</h3>
                        <p>Nos importa tu experiencia en la cita del ${escapeHtml(survey.dateLabel)} con ${escapeHtml(survey.doctor)}.</p>
                    </div>
                </div>
                <div class="star-rating">
                    <input type="radio" id="star5" name="npsRating" value="5" />
                    <label for="star5" title="5 estrellas">★</label>
                    <input type="radio" id="star4" name="npsRating" value="4" />
                    <label for="star4" title="4 estrellas">★</label>
                    <input type="radio" id="star3" name="npsRating" value="3" />
                    <label for="star3" title="3 estrellas">★</label>
                    <input type="radio" id="star2" name="npsRating" value="2" />
                    <label for="star2" title="2 estrellas">★</label>
                    <input type="radio" id="star1" name="npsRating" value="1" />
                    <label for="star1" title="1 estrella">★</label>
                </div>
                <textarea name="npsComment" class="portal-survey-input" placeholder="Comentario u observación (opcional)"></textarea>
                <div id="surveyFormError" style="color:var(--admin-error); font-size:14px; display:none;">Selecciona una calificación</div>
                <button type="submit" class="portal-survey-submit" id="npsSubmitBtn">Enviar Encuesta</button>
            </form>
        `;
    }

    document.addEventListener('submit', async function(e) {
        if (e.target && e.target.id === 'npsSurveyForm') {
            e.preventDefault();
            const form = e.target;
            const btn = document.getElementById('npsSubmitBtn');
            const errorP = document.getElementById('surveyFormError');

            const ratingInput = form.querySelector('input[name="npsRating"]:checked');
            if (!ratingInput) {
                errorP.textContent = 'Selecciona una calificación de 1 a 5 estrellas.';
                errorP.style.display = 'block';
                return;
            }
            errorP.style.display = 'none';
            btn.disabled = true;
            btn.textContent = 'Enviando...';

            const appointmentId = form.dataset.appointmentId;
            const rating = ratingInput.value;
            const text = form.querySelector('textarea[name="npsComment"]').value;
            const session = readSession();

            try {
                const result = await window.fetch('/api.php?resource=patient-portal-submit-survey', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(session && session.token ? { Authorization: `Bearer ${session.token}` } : {}),
                    },
                    body: JSON.stringify({ appointmentId, rating, text })
                }).then(r => r.json());

                if (result.ok) {
                    form.innerHTML = '<h3 style="color:var(--color-gold-500); text-align:center;">¡Gracias por tu retroalimentación!</h3><p style="text-align:center; color:var(--pub-text-muted);">Nos ayuda a mejorar continuamente nuestra atención.</p>';
                    setTimeout(() => { form.style.display = 'none'; }, 6000);
                } else {
                    throw new Error(result.error || 'Error al enviar');
                }
            } catch (err) {
                errorP.textContent = err.message;
                errorP.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'Intentar de nuevo';
            }
        }
    });

    function isHttpContext() {
        return window.location
            && (window.location.protocol === 'http:' || window.location.protocol === 'https:');
    }

    function normalizeCrossSellToken(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    async function loadCrossSellCatalog() {
        if (crossSellCatalogPromise) {
            return crossSellCatalogPromise;
        }

        if (typeof window.fetch !== 'function') {
            crossSellCatalogPromise = Promise.resolve([]);
            return crossSellCatalogPromise;
        }

        const url = isHttpContext()
            ? `${window.location.origin}/data/catalog/cross-sell.json`
            : '/data/catalog/cross-sell.json';
        crossSellCatalogPromise = window.fetch(url, {
            headers: {
                Accept: 'application/json',
            },
        })
            .then((response) => (response.ok ? response.json() : {}))
            .then((payload) =>
                Array.isArray(payload && payload.suggestions) ? payload.suggestions : []
            )
            .catch(() => []);

        return crossSellCatalogPromise;
    }

    async function getCrossSellSuggestion(serviceId) {
        const normalizedServiceId = normalizeCrossSellToken(serviceId);
        if (!normalizedServiceId) {
            return null;
        }

        const suggestions = await loadCrossSellCatalog();
        const match = suggestions.find((entry) => {
            if (!entry || typeof entry !== 'object') {
                return false;
            }

            return normalizeCrossSellToken(entry.service_id) === normalizedServiceId;
        });

        return match && typeof match === 'object' ? match : null;
    }

    function localizedSuggestionValue(suggestion, baseKey) {
        if (!suggestion || typeof suggestion !== 'object') {
            return '';
        }

        return String(
            suggestion[`${baseKey}_es`] ||
                suggestion[baseKey] ||
                ''
        ).trim();
    }

    function renderCrossSellSuggestion(suggestion) {
        if (!suggestion || typeof suggestion !== 'object') {
            return '';
        }

        const href = String(suggestion.href || '').trim();
        const badge = localizedSuggestionValue(suggestion, 'badge') || 'Complemento recomendado';
        const title = localizedSuggestionValue(suggestion, 'title');
        const description = localizedSuggestionValue(suggestion, 'description');
        const ctaLabel = localizedSuggestionValue(suggestion, 'cta_label') || 'Ver servicio';

        if (!href || !title || !description) {
            return '';
        }

        return `
            <div class="portal-cross-sell" data-portal-next-cross-sell>
                <span class="portal-inline-label portal-cross-sell__badge">${escapeHtml(badge)}</span>
                <strong data-portal-next-cross-sell-title>${escapeHtml(title)}</strong>
                <p data-portal-next-cross-sell-description>${escapeHtml(description)}</p>
                <a
                    class="btn btn-secondary portal-cross-sell__cta"
                    data-portal-next-cross-sell-cta
                    href="${escapeHtml(href)}"
                >${escapeHtml(ctaLabel)}</a>
            </div>
        `;
    }

    function renderBillingUnavailable() {
        return `
            <section class="portal-plan-card portal-billing-card portal-empty-state lg-surface--dark portal-glass-card">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="portal-empty-icon" aria-hidden="true" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <div class="portal-empty-content">
                    <strong>Resumen no disponible</strong>
                    <p>No pudimos cargar tu información de facturación. Por favor intenta más tarde.</p>
                </div>
            </section>
        `;
    }

    function renderMembershipCard(membership) {
        if (!membership || typeof membership !== 'object') {
            return `
                <section class="portal-plan-card portal-empty-state lg-surface--dark portal-glass-card">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="portal-empty-icon" aria-hidden="true" stroke="currentColor" stroke-width="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                    <div class="portal-empty-content">
                        <strong>No tienes una membresía activa</strong>
                        <p>Únete a Aurora Derm para acceder a descuentos exclusivos y prioridad de agendas.</p>
                    </div>
                    <div class="portal-cta-row" style="margin-top: 12px; width: 100%;">
                        <a href="/es/membresia/" class="btn btn-outline" style="width:100%; justify-content:center;">Conocer planes</a>
                    </div>
                </section>
            `;
        }
        
        const isActive = membership.status === 'active';
        const days = Number(membership.days_remaining) || 0;
        const perks = Array.isArray(membership.perks) ? membership.perks : [];
        
        let headerStatus = '<span class="portal-status-chip portal-status-chip--idle">Inactiva</span>';
        if (isActive) {
            headerStatus = '<span class="portal-status-chip">Activa</span>';
        }
        
        let renewAlert = '';
        if (isActive && days <= 15) {
            renewAlert = `
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--admin-border-subtle);">
                    <p style="color: var(--admin-error); font-size: 0.9em; margin-bottom: 12px;">Tu membresía vence en ${days} días.</p>
                    <div class="portal-cta-row" style="width:100%;">
                        <a href="/es/membresia/?renovar=true" class="btn btn-primary" style="width:100%; justify-content:center;">Renovar plan</a>
                    </div>
                </div>
            `;
        }

        const perksHtml = perks.length > 0 
            ? '<ul style="margin: 12px 0 0 16px; padding: 0; font-size: 0.9em; color: var(--admin-text-muted);">' + perks.map(p => `<li>${escapeHtml(p)}</li>`).join('') + '</ul>'
            : '';

        return `
            <section class="portal-plan-card lg-surface--dark portal-glass-card">
                <div class="portal-plan-card__header" style="justify-content:space-between;">
                    <strong style="color:var(--admin-text); font-size:1.1em;">⭐ Membresía Aurora</strong>
                    ${headerStatus}
                </div>
                ${isActive ? `
                    <p style="margin: 8px 0; font-size: 0.95em;">Válida hasta el <strong>${escapeHtml(membership.expires_at ? membership.expires_at.split(' ')[0] : 'Indefinido')}</strong></p>
                    <div style="font-size:0.9em"><strong>Tus beneficios activos:</strong></div>
                    ${perksHtml}
                ` : `
                    <p style="margin: 8px 0; font-size: 0.95em; color: var(--admin-text-muted);">Tu membresía ha expirado o ha sido suspendida.</p>
                    <div class="portal-cta-row" style="margin-top: 12px; width: 100%;">
                        <a href="/es/membresia/?renovar=true" class="btn btn-primary" style="width:100%; justify-content:center;">Reactiva tu plan</a>
                    </div>
                `}
                ${renewAlert}
            </section>
        `;
    }

    function renderSkeletonCard() {
        return `
            <section class="portal-card-next lg-surface--dark portal-glass-card" data-portal-next-skeleton style="opacity:0.78;">
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
            <article class="portal-support-card lg-surface--dark portal-glass-card" style="opacity:0.78;">
                <div class="skeleton" style="width: 42px; height: 42px; border-radius: 14px;"></div>
                <div style="display:flex; flex-direction:column; gap:8px; flex:1;">
                    <div class="skeleton" style="width: 52%; height: 16px;"></div>
                    <div class="skeleton" style="width: 90%; height: 12px;"></div>
                </div>
            </article>
            <article class="portal-support-card lg-surface--dark portal-glass-card" style="opacity:0.78;">
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
            <section class="portal-plan-card lg-surface--dark portal-glass-card" data-portal-treatment-plan-skeleton style="opacity:0.8;">
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

    function renderMembershipSkeleton() {
        return `
            <section class="portal-plan-card lg-surface--dark portal-glass-card" style="opacity:0.8;">
                <div style="display:grid; gap:12px; width:100%;">
                    <div class="skeleton" style="width: 48%; height: 18px;"></div>
                    <div class="skeleton" style="width: 80%; height: 14px;"></div>
                    <div class="skeleton" style="width: 100%; height: 44px; margin-top: 12px;"></div>
                </div>
            </section>
        `;
    }

    function renderBillingSkeleton() {
        return `
            <section class="portal-plan-card portal-billing-card lg-surface--dark portal-glass-card" data-portal-billing-skeleton style="opacity:0.8;">
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

    function renderAlerts(alerts) {
        if (!Array.isArray(alerts) || alerts.length === 0) {
            return '';
        }
        return alerts.map(alert => `
            <div class="portal-red-flag">
                <strong>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    Alerta de tu médico
                </strong>
                <p>${escapeHtml(alert.message)}</p>
            </div>
        `).join('');
    }

    function renderNextAppointment(appointment, crossSellSuggestion) {
        const safeAppointment =
            appointment && typeof appointment === 'object' ? appointment : {};
        const rescheduleUrl = String(safeAppointment.rescheduleUrl || '').trim();
        const whatsappUrl = String(safeAppointment.whatsappUrl || '').trim();
        const roomUrl = String(
            safeAppointment.roomUrl ||
                (safeAppointment.id
                    ? `/es/telemedicina/sala/index.html?id=${safeAppointment.id}`
                    : '')
        ).trim();
        const preConsultationUrl = String(
            safeAppointment.preConsultationUrl || ''
        ).trim();
        const telemedicinePreConsultation =
            safeAppointment.telemedicinePreConsultation &&
            typeof safeAppointment.telemedicinePreConsultation === 'object'
                ? safeAppointment.telemedicinePreConsultation
                : null;
        const preConsultationStatusLabel = String(
            telemedicinePreConsultation?.statusLabel || ''
        ).trim();

        return `
            <section class="portal-card-next lg-surface--dark portal-glass-card" data-portal-next-appointment-card>
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
                    ${
                        safeAppointment.appointmentType === 'telemedicine' &&
                        preConsultationStatusLabel
                            ? `<p class="portal-inline-status" data-portal-next-preconsultation-status>${escapeHtml(preConsultationStatusLabel)}</p>`
                            : ''
                    }
                </div>
                ${renderCrossSellSuggestion(crossSellSuggestion)}
                <div class="portal-cta-row">
                    ${
                        safeAppointment.appointmentType === 'telemedicine' &&
                        preConsultationUrl
                            ? `<a class="btn btn-primary" data-portal-next-preconsultation href="${escapeHtml(preConsultationUrl)}">${escapeHtml(preConsultationStatusLabel ? 'Actualizar pre-consulta' : 'Hacer pre-consulta')}</a>`
                            : ''
                    }
                    ${
                        safeAppointment.appointmentType === 'telemedicine' &&
                        roomUrl
                            ? `<a class="btn btn-secondary" data-portal-next-room href="${escapeHtml(roomUrl)}">Entrar a Sala</a>`
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
            <section class="portal-card-next portal-empty-state lg-surface--dark portal-glass-card" data-portal-empty-state>
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
            <section class="portal-card-next portal-empty-state lg-surface--dark portal-glass-card">
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
                    <a class="portal-support-card lg-surface--dark portal-glass-card" href="${escapeHtml(item.href)}"${item.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>
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
                    <span class="glass-pill" data-portal-treatment-task>${escapeHtml(label)}</span>
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
            <section class="portal-plan-card lg-surface--dark portal-glass-card" data-portal-treatment-plan-card>
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
                                <span class="portal-inline-label">Indicaciones y Tareas</span>
                                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">${tasksHtml}</div>
                            </div>
                        `
                        : ''
                }
            </section>
        `;
    }

    function renderTreatmentPlanEmpty() {
        return `
            <section class="portal-plan-card portal-plan-card--empty lg-surface--dark portal-glass-card" data-portal-treatment-plan-empty>
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
            <section class="portal-plan-card portal-billing-card lg-surface--dark portal-glass-card" data-portal-billing-card>
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

    async function loadMembership(session, container) {
        if (!container) return;
        try {
            const result = await requestJson('membership-status', String(session.token || ''));
            if (result.ok && result.body && result.body.ok) {
                container.innerHTML = renderMembershipCard(result.body.data);
            } else {
                container.innerHTML = renderMembershipCard(null);
            }
        } catch (error) {
            console.error('[portal-dashboard] failed to load membership', error);
            container.innerHTML = renderMembershipCard(null);
        }
    }

    async function hydrateDashboard() {
        const nextAppointmentContainer = document.getElementById('portal-next-appointment');
        const treatmentPlanContainer = document.getElementById('portal-treatment-plan');
        const evolutionContainer = document.getElementById('portal-evolution');
        const billingContainer = document.getElementById('portal-billing-summary');
        const actionsContainer = document.getElementById('portal-appointment-actions');
        const membershipContainer = document.getElementById('portal-membership-status');
        const alertsContainer = document.getElementById('portal-alerts-container');
        const surveyContainer = document.getElementById('portal-survey-container');

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
        if (membershipContainer instanceof HTMLElement) {
            membershipContainer.innerHTML = renderMembershipSkeleton();
            loadMembership(session, membershipContainer);
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
            const crossSellSuggestion = nextAppointment
                ? await getCrossSellSuggestion(nextAppointment.serviceId)
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

            if (alertsContainer instanceof HTMLElement) {
                const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
                alertsContainer.innerHTML = renderAlerts(alerts);
            }

            if (surveyContainer instanceof HTMLElement) {
                surveyContainer.innerHTML = renderSurvey(payload.pendingSurvey);
            }

            nextAppointmentContainer.innerHTML = nextAppointment
                ? renderNextAppointment(nextAppointment, crossSellSuggestion)
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
            if (alertsContainer instanceof HTMLElement) {
                alertsContainer.innerHTML = '';
            }
            if (surveyContainer instanceof HTMLElement) {
                surveyContainer.innerHTML = '';
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
