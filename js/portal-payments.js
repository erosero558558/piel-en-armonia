(function (window, document) {
    'use strict';

    const portalShell = window.AuroraPatientPortalShell || null;

    function getSessionToken() {
        const session = portalShell && typeof portalShell.getSession === 'function' ? portalShell.getSession() : null;
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
            const response = await fetch('/api.php?resource=patient-portal-payments', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

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

            renderPayments(payload.data.payments, container);

        } catch (err) {
            console.error('Failed to load payments:', err);
            container.innerHTML = `
                <div style="padding: 24px; text-align: center; color: rgba(255,255,255,0.6); font-size: 0.9rem;">
                    <p>Ocurrió un error al cargar tu historial financiero.</p>
                    <button onclick="window.location.reload()" class="rb-btn-action rb-btn-action--secondary" style="margin-top:12px;">Reintentar</button>
                </div>
            `;
        }
    }

    function renderPayments(payments, container) {
        if (!Array.isArray(payments) || payments.length === 0) {
            container.innerHTML = `
                <div style="padding: 32px 16px; text-align: center;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" style="margin-bottom:16px;">
                        <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                        <line x1="2" y1="10" x2="22" y2="10"></line>
                    </svg>
                    <h3 style="color:#fff; font-size:1.1rem; margin-bottom:8px;">No hay pagos registrados</h3>
                    <p style="color:rgba(255,255,255,0.5); font-size:0.9rem; line-height:1.4;">Tus próximos abonos por atenciones o procedimientos aparecerán aquí.</p>
                </div>
            `;
            return;
        }

        // Sort basically handles by backend, we just map
        const html = payments.map(payment => {
            const isPending = payment.status === 'pending' || payment.amountDue > 0;
            
            // Formatear montos localmente por si acaso, aunque el backend manda el label
            const dueFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
            const dueLabel = isPending ? dueFormatter.format(payment.amountDue) : '$0.00';
            
            let ctaHtml = '';
            if (isPending) {
                const wtext = encodeURIComponent(`Hola Aurora Derm, tengo un saldo pendiente de ${dueLabel} en mi cuenta y deseo liquidarlo.`);
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
                        <span style="font-size:0.75rem; color:rgba(255,255,255,0.5); margin-top:2px;">
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
        }).join('');

        container.innerHTML = html;
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

})(window, document);
