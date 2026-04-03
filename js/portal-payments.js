(function (window, document) {
    'use strict';

    const portalShell = window.AuroraPatientPortalShell || null;

    function getSessionToken() {
        const session =
            portalShell && typeof portalShell.getSession === 'function'
                ? portalShell.getSession()
                : null;
        return session ? session.token : null;
    }

    function redirectToLogin() {
        if (portalShell && typeof portalShell.redirectToLogin === 'function') {
            portalShell.redirectToLogin();
            return;
        }
        window.location.replace('/es/portal/login/');
    }

    document.addEventListener('DOMContentLoaded', () => {
        initPaymentsFeed();
    });

    async function initPaymentsFeed() {
        const token = getSessionToken();
        if (!token) {
            redirectToLogin();
            return;
        }

        const container = document.getElementById('v6-payments-feed');
        if (!container) return;

        try {
            const response = await fetch(
                '/api.php?resource=patient-portal-payments',
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    redirectToLogin();
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const payload = await response.json();
            if (!payload.ok || !payload.data) {
                throw new Error('Invalid payload');
            }

            const paymentData = payload.data;
            const summary = paymentData.summary || {};

            // GA4 — telemetría de pagos (Q43-10)
            if (typeof gtag === 'function') {
                gtag('event', 'portal_payments_viewed', {
                    has_pending_balance: (summary.totalDue || 0) > 0,
                    payment_count: Array.isArray(paymentData.payments)
                        ? paymentData.payments.length
                        : 0,
                    pending_count: summary.pendingCount || 0,
                });
            }

            renderPayments(paymentData.payments, summary, container);
        } catch (err) {
            console.error('Failed to load payments:', err);
            container.innerHTML = `
                <div class="rb-error-state">
                    <p>Ocurrió un error al cargar tu historial financiero.</p>
                    <button onclick="window.location.reload()" class="rb-btn-action rb-btn-action--secondary">Reintentar</button>
                </div>
            `;
        }
    }

    function renderPayments(payments, summary, container) {
        // Banner de saldo total pendiente (Q43-10 / S42-10)
        let summaryHtml = '';
        const totalDue = parseFloat(summary?.totalDue || 0);
        if (totalDue > 0) {
            const dueFormatted = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
            }).format(totalDue);
            const wtext = encodeURIComponent(
                `Hola Aurora Derm, tengo un saldo pendiente de ${dueFormatted} y deseo liquidarlo.`
            );
            summaryHtml = `
                <div class="rb-alert-banner--danger" role="alert">
                    <div class="rb-alert-banner__icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <div class="rb-alert-banner__content">
                        <strong class="rb-alert-banner__title">Tienes un saldo pendiente de ${dueFormatted}</strong>
                        <p class="rb-alert-banner__text">Puedes coordinarlo directamente con nuestra clínica.</p>
                    </div>
                    <a href="https://wa.me/593987866885?text=${wtext}" target="_blank" rel="noopener" class="rb-alert-banner__action">Pagar ahora</a>
                </div>`;
        }

        if (!Array.isArray(payments) || payments.length === 0) {
            container.innerHTML =
                summaryHtml +
                `
                <div class="rb-empty-state">
                    <div class="rb-empty-state__icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5">
                            <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                            <line x1="2" y1="10" x2="22" y2="10"></line>
                        </svg>
                    </div>
                    <h3 class="rb-empty-state__title">No hay pagos registrados</h3>
                    <p class="rb-empty-state__text">Tus próximos abonos por atenciones o procedimientos aparecerán aquí.</p>
                </div>
            `;
            return;
        }

        // Sort basically handles by backend, we just map
        const html = payments
            .map((payment) => {
                const isPending =
                    payment.status === 'pending' || payment.amountDue > 0;

                // Formatear montos localmente por si acaso, aunque el backend manda el label
                const dueFormatter = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                });
                const dueLabel = isPending
                    ? dueFormatter.format(payment.amountDue)
                    : '$0.00';

                let ctaHtml = '';
                if (isPending) {
                    const wtext = encodeURIComponent(
                        `Hola Aurora Derm, tengo un saldo pendiente de ${dueLabel} en mi cuenta y deseo liquidarlo.`
                    );
                    ctaHtml = `<a href="https://wa.me/593987866885?text=${wtext}" target="_blank" class="rb-btn-action rb-btn-action--primary">Pagar ahora</a>`;
                } else if (payment.receipt_url) {
                    ctaHtml = `<a href="${payment.receipt_url}" target="_blank" class="rb-btn-action rb-btn-action--secondary">Ver Factura PDF</a>`;
                }

                return `
                <article class="rb-payment-card ${isPending ? 'is-pending' : ''}">
                    <div class="rb-payment-card__header">
                        <span class="rb-payment-card__date">${payment.dateLabel || 'Fecha no disponible'}</span>
                        <span class="rb-payment-card__status">${isPending ? 'Saldo Pendiente' : 'Pagado'}</span>
                    </div>
                    
                    <h3 class="rb-payment-card__title">${escapeHtml(payment.serviceName || 'Atención Médica')}</h3>
                    
                    <div class="rb-payment-card__amount-group">
                        <strong class="rb-payment-card__amount">${isPending ? dueLabel : payment.amountLabel}</strong>
                        <span class="rb-payment-card__amount-caption">
                            ${isPending ? `Abonado: ${payment.amountLabel}` : 'Total liquidado'}
                        </span>
                    </div>

                    <div class="rb-payment-card__footer">
                        <div class="rb-payment-card__method">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                                <line x1="2" y1="10" x2="22" y2="10"></line>
                            </svg>
                            <span>${escapeHtml(payment.methodLabel)}</span>
                        </div>
                        ${ctaHtml ? `<div>${ctaHtml}</div>` : ''}
                    </div>
                </article>
            `;
            })
            .join('');

        container.innerHTML = summaryHtml + html;
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
})(window, document);
