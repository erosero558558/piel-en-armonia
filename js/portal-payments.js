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

    function renderSkeleton() {
        const summarySkeleton = `
            <div class="payment-card lg-surface--dark portal-glass-card" style="opacity:0.8;">
                <div class="skeleton" style="width: 50%; height: 16px; margin-bottom: 8px;"></div>
                <div class="skeleton" style="width: 70%; height: 32px; margin-bottom: 12px;"></div>
                <div class="skeleton" style="width: 40%; height: 14px;"></div>
            </div>
        `;
        const feedSkeleton = `
            <div class="payment-card lg-surface--dark portal-glass-card" style="opacity:0.8;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                    <div class="skeleton" style="width: 40%; height: 16px;"></div>
                    <div class="skeleton" style="width: 20%; height: 16px;"></div>
                </div>
                <div class="skeleton" style="width: 60%; height: 14px; margin-bottom: 8px;"></div>
                <div class="skeleton" style="width: 30%; height: 14px;"></div>
            </div>
            <div class="payment-card lg-surface--dark portal-glass-card" style="opacity:0.8;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                    <div class="skeleton" style="width: 45%; height: 16px;"></div>
                    <div class="skeleton" style="width: 25%; height: 16px;"></div>
                </div>
                <div class="skeleton" style="width: 55%; height: 14px; margin-bottom: 8px;"></div>
                <div class="skeleton" style="width: 35%; height: 14px;"></div>
            </div>
        `;
        
        return { summary: summarySkeleton, feed: feedSkeleton };
    }

    function renderEmptyState() {
        return `
            <div class="payment-card lg-surface--dark portal-glass-card" style="justify-content:center; align-items:center; text-align:center; padding: 32px 16px;">
                <div style="margin-bottom: 16px; color: rgba(255,255,255,0.4);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>
                <h3 style="color: #fff; margin-bottom: 8px; font-size: 1.1rem;">Aún no tienes pagos registrados</h3>
                <p style="color: rgba(255,255,255,0.6); font-size: 0.9rem;">Cuando realices un pago en clínica, aparecerá aquí detallado.</p>
            </div>
        `;
    }

    function renderErrorState() {
        return `
            <div class="payment-card lg-surface--dark portal-glass-card" style="justify-content:center; align-items:center; text-align:center; padding: 32px 16px;">
                <h3 style="color: #fff; margin-bottom: 8px; font-size: 1.1rem;">No pudimos cargar tus finanzas</h3>
                <p style="color: rgba(255,255,255,0.6); font-size: 0.9rem;">Por favor intenta nuevamente en unos segundos.</p>
            </div>
        `;
    }

    function renderSummaryCard(summary) {
        if (!summary) return '';
        const total = summary.totalPaid || '$0.00';
        const lastDate = summary.lastPaymentDate ? `Último pago el ${summary.lastPaymentDate}` : 'Ningún pago reciente';
        
        return `
            <div class="payment-card lg-surface--gold portal-glass-card" style="padding: 24px;">
                <span style="color: rgba(255,255,255,0.7); font-size: 0.9rem; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;">Total Abonado</span>
                <div class="payment-card__amount" style="font-size: 2.2rem; margin: 8px 0;">${escapeHtml(total)}</div>
                <span style="color: rgba(255,255,255,0.8); font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    ${escapeHtml(lastDate)}
                </span>
            </div>
        `;
    }

    function renderPaymentItem(payment) {
        const dotColor = payment.status === 'completed' ? '#22c55e' : '#f59e0b'; // verde o ámbar
        return `
            <div class="payment-card lg-surface--dark portal-glass-card">
                <div class="payment-card__header">
                    <div>
                        <div class="payment-card__title">${escapeHtml(payment.concept || 'Servicio Médico')}</div>
                        <div class="payment-card__details">
                            <span>${escapeHtml(payment.dateLabel || '')}</span>
                            <span style="display: flex; align-items: center; gap: 4px;">
                                <span style="display:inline-block; width:6px; height:6px; background-color:${dotColor}; border-radius:50%;"></span>
                                ${escapeHtml(payment.methodLabel || 'Pago')}
                            </span>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="display: block; font-weight: 600; color: #fff; font-size: 1.1rem; margin-bottom: 4px;">${escapeHtml(payment.amountLabel || '$0.00')}</span>
                        ${payment.pdfUrl ? `<a href="${escapeHtml(payment.pdfUrl)}" download style="color: var(--color-gold); font-size: 0.8rem; text-decoration: underline;">Descargar</a>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    async function hydratePayments() {
        const feedContainer = document.getElementById('portal-payments-feed');
        const summaryContainer = document.getElementById('portal-payments-summary');
        
        if (!feedContainer || !summaryContainer) return;

        const session = readSession();
        if (!isFreshSession(session)) {
            clearSession();
            redirectToLogin();
            return;
        }

        const token = String(session.token || '').trim();
        const skeletons = renderSkeleton();
        summaryContainer.innerHTML = skeletons.summary;
        feedContainer.innerHTML = skeletons.feed;

        try {
            const response = await requestJson('patient-portal-payments', token);
            if (response.status === 401) {
                clearSession();
                redirectToLogin();
                return;
            }

            if (!response.ok || !response.body || response.body.ok !== true) {
                throw new Error('portal_payments_failed');
            }

            const data = response.body.data && typeof response.body.data === 'object' ? response.body.data : {};
            const summary = data.summary && typeof data.summary === 'object' ? data.summary : null;
            const payments = Array.isArray(data.payments) ? data.payments : [];

            if (summary) {
                summaryContainer.innerHTML = renderSummaryCard(summary);
            } else {
                summaryContainer.innerHTML = '';
            }

            if (payments.length === 0) {
                feedContainer.innerHTML = renderEmptyState();
                return;
            }

            feedContainer.innerHTML = payments.map(renderPaymentItem).join('');

        } catch (error) {
            summaryContainer.innerHTML = '';
            feedContainer.innerHTML = renderErrorState();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        void hydratePayments();
    });

})(window, document);
