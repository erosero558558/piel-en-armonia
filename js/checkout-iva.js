/**
 * Checkout con Desglose de IVA
 * Piel en Armonía - Módulo de Pago Transparente
 */

import {
    getServiceById,
    getServicePriceInfo,
    getCheckoutBreakdown,
    formatMoney,
    PRICING_DISCLAIMERS,
    SERVICES_CONFIG,
} from './services-config.js';

export function renderCheckoutBreakdown(serviceId, options = {}) {
    const breakdown = getCheckoutBreakdown(serviceId, options);
    if (!breakdown) {
        return '<p class="error">Error al cargar información de precios</p>';
    }

    const { service, pricing, formatted, labels } = breakdown;
    const isFromPrice = service.isFromPrice;

    return `
        <div class="checkout-breakdown ${isFromPrice ? 'requires-quote' : ''}" data-service-id="${service.id}">
            <div class="checkout-header">
                <h4 class="checkout-service-name">${service.name}</h4>
                ${service.note ? `<span class="checkout-service-note">${service.note}</span>` : ''}
            </div>
            <div class="checkout-pricing">
                ${
                    pricing.discount > 0
                        ? `
                    <div class="checkout-row checkout-discount">
                        <span class="checkout-label">Precio base</span>
                        <span class="checkout-value checkout-strike">${formatted.base}</span>
                    </div>
                    <div class="checkout-row checkout-discount-amount">
                        <span class="checkout-label">Descuento</span>
                        <span class="checkout-value checkout-discount-value">-${formatted.discount}</span>
                    </div>
                `
                        : `
                    <div class="checkout-row">
                        <span class="checkout-label">Subtotal</span>
                        <span class="checkout-value">${formatted.base}</span>
                    </div>
                `
                }
                ${
                    pricing.taxRate > 0
                        ? `
                    <div class="checkout-row checkout-tax">
                        <span class="checkout-label">
                            IVA (${formatted.taxRate})
                            <span class="tax-badge">${labels.tax}</span>
                        </span>
                        <span class="checkout-value">${formatted.taxAmount}</span>
                    </div>
                `
                        : `
                    <div class="checkout-row checkout-tax-zero">
                        <span class="checkout-label">
                            IVA (0%)
                            <span class="tax-badge tax-badge-zero">${labels.tax}</span>
                        </span>
                        <span class="checkout-value">$0.00</span>
                    </div>
                `
                }
                <div class="checkout-divider"></div>
                <div class="checkout-row checkout-total">
                    <span class="checkout-label">Total a pagar</span>
                    <span class="checkout-value checkout-total-amount">${formatted.total}</span>
                </div>
            </div>
            ${
                isFromPrice
                    ? `
                <div class="checkout-quote-notice">
                    <i class="fas fa-info-circle"></i>
                    <div>
                        <strong>Valoración previa requerida</strong>
                        <p>Este servicio requiere una consulta inicial para determinar el plan y costo exacto.</p>
                    </div>
                </div>
            `
                    : ''
            }
            <div class="checkout-disclaimers">
                <p class="disclaimer-text">
                    <i class="fas fa-info-circle"></i>
                    ${PRICING_DISCLAIMERS.referralNote}
                </p>
            </div>
        </div>
    `;
}

export function renderServiceSelector() {
    const options = SERVICES_CONFIG.map((service) => {
        const priceInfo = getServicePriceInfo(service.id);
        const displayPrice = service.isFromPrice
            ? `Desde ${priceInfo.formatted.total}`
            : priceInfo.formatted.total;
        return `
            <option value="${service.id}" data-price="${priceInfo.total}" data-tax="${service.taxRate}">
                ${service.name} - ${displayPrice} (${priceInfo.taxLabel})
            </option>
        `;
    }).join('');

    return `
        <div class="service-selector-container">
            <label for="service-select" class="form-label">Selecciona el servicio</label>
            <select id="service-select" name="service" class="form-select" required>
                <option value="" disabled selected>Elige un servicio...</option>
                ${options}
            </select>
            <div id="service-breakdown" class="service-breakdown-preview"></div>
        </div>
    `;
}

export function updateServiceBreakdown(serviceId, container, options = {}) {
    if (!container) return;
    container.innerHTML = renderCheckoutBreakdown(serviceId, options);
}

export function initServiceSelectorHandler(
    selectId = 'service-select',
    containerId = 'service-breakdown'
) {
    const select = document.getElementById(selectId);
    const container = document.getElementById(containerId);
    if (!select || !container) return;

    select.addEventListener('change', (e) => {
        const serviceId = e.target.value;
        if (serviceId) {
            updateServiceBreakdown(serviceId, container);
        }
    });
}

export function validateCheckoutPayment(serviceId, amount) {
    const priceInfo = getServicePriceInfo(serviceId);
    if (!priceInfo) {
        return { valid: false, error: 'Servicio no encontrado' };
    }

    const expectedAmount = priceInfo.total;
    const tolerance = 0.01;
    const difference = Math.abs(amount - expectedAmount);

    if (difference <= tolerance) {
        return { valid: true, expected: expectedAmount, received: amount };
    }

    return {
        valid: false,
        error: `Monto incorrecto. Esperado: $${expectedAmount}, Recibido: $${amount}`,
        expected: expectedAmount,
        received: amount,
    };
}

export function getServiceDataForAPI(serviceId, options = {}) {
    const breakdown = getCheckoutBreakdown(serviceId, options);
    if (!breakdown) return null;

    return {
        service_id: breakdown.service.id,
        service_name: breakdown.service.name,
        is_from_price: breakdown.service.isFromPrice,
        pricing: {
            base_amount: breakdown.pricing.base,
            discount_amount: breakdown.pricing.discount,
            tax_rate: breakdown.pricing.taxRate,
            tax_amount: breakdown.pricing.taxAmount,
            total_amount: breakdown.pricing.total,
        },
        timestamp: new Date().toISOString(),
    };
}

export default {
    renderCheckoutBreakdown,
    renderServiceSelector,
    updateServiceBreakdown,
    initServiceSelectorHandler,
    validateCheckoutPayment,
    getServiceDataForAPI,
};
