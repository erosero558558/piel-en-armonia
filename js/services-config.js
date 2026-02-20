/**
 * Configuración de Servicios con Manejo de IVA
 * Piel en Armonía - Sistema de Precios Transparente
 */

// Tasa de IVA general configurable
export const IVA_GENERAL_RATE = 0.15; // 15%

// Configuración de servicios con campos de impuestos
export const SERVICES_CONFIG = [
    {
        id: 'consulta',
        name: 'Consulta Dermatológica',
        nameShort: 'Consulta',
        priceBase: 40,
        isFromPrice: false,
        taxRate: 0.00, // 0% IVA (servicios de salud)
        category: 'clinico',
        description: 'Evaluación completa de tu piel con diagnóstico preciso y plan de tratamiento personalizado.',
        includes: ['Evaluación dermatológica completa', 'Diagnóstico', 'Plan de tratamiento']
    },
    {
        id: 'telefono',
        name: 'Consulta Telefónica',
        nameShort: 'Teléfono',
        priceBase: 25,
        isFromPrice: false,
        taxRate: 0.00, // 0% IVA
        category: 'telemedicina',
        description: 'Consulta médica por teléfono para controles y dudas puntuales.',
        note: 'Solo para controles establecidos',
        includes: ['Llamada telefónica', 'Orientación médica']
    },
    {
        id: 'video',
        name: 'Video Consulta',
        nameShort: 'Video',
        priceBase: 30,
        isFromPrice: false,
        taxRate: 0.00, // 0% IVA
        category: 'telemedicina',
        description: 'Consulta médica por videollamada desde la comodidad de tu hogar.',
        includes: ['Videollamada', 'Evaluación visual', 'Orientación médica']
    },
    {
        id: 'laser',
        name: 'Láser Dermatológico',
        nameShort: 'Láser',
        priceBase: 150,
        isFromPrice: true,
        taxRate: 0.15, // 15% IVA (procedimientos estéticos)
        category: 'procedimiento',
        description: 'Tratamientos con láser de última generación para diversas afecciones de la piel.',
        note: 'Según evaluación clínica',
        includes: ['Evaluación previa', 'Sesión de láser', 'Seguimiento']
    },
    {
        id: 'rejuvenecimiento',
        name: 'Rejuvenecimiento Facial',
        nameShort: 'Rejuvenecimiento',
        priceBase: 120,
        isFromPrice: true,
        taxRate: 0.15, // 15% IVA
        category: 'estetico',
        description: 'Tratamientos estéticos para recuperar la juventud y luminosidad de tu piel.',
        note: 'Según evaluación clínica',
        includes: ['Evaluación estética', 'Tratamiento personalizado', 'Seguimiento']
    },
    {
        id: 'acne',
        name: 'Tratamiento de Acné',
        nameShort: 'Acné',
        priceBase: 80,
        isFromPrice: true,
        taxRate: 0.00, // 0% IVA (tratamiento médico)
        category: 'clinico',
        description: 'Soluciones efectivas para controlar y eliminar el acné en todas sus formas.',
        note: 'Según evaluación clínica',
        includes: ['Evaluación dermatológica', 'Plan de tratamiento', 'Productos recomendados']
    },
    {
        id: 'cancer',
        name: 'Detección de Cáncer de Piel',
        nameShort: 'Detección',
        priceBase: 70,
        isFromPrice: true,
        taxRate: 0.00, // 0% IVA (prevención médica)
        category: 'clinico',
        description: 'Examen dermatoscópico completo para detección temprana de lesiones sospechosas.',
        note: 'Según evaluación clínica',
        includes: ['Dermatoscopía completa', 'Documentación fotográfica', 'Informe médico']
    }
];

// Servicios especiales (cupos solidarios, pediátricos, etc.)
export const SPECIAL_SERVICES = {
    cupoSolidario: {
        id: 'cupo-solidario',
        name: 'Cupo Solidario',
        description: 'Atención accesible para pacientes de escasos recursos.',
        discountRate: 0.375, // 37.5% de descuento sobre precio base
        taxRate: 0.00,
        availability: 'Limitado por semana'
    }
};

/**
 * Calcula el impuesto (IVA) para un monto base y tasa
 * @param {number} priceBase - Precio base
 * @param {number} taxRate - Tasa de impuesto (ej: 0.15 para 15%)
 * @returns {number} Monto del impuesto
 */
export function computeTax(priceBase, taxRate) {
    if (typeof priceBase !== 'number' || typeof taxRate !== 'number') {
        console.warn('computeTax: Invalid parameters', { priceBase, taxRate });
        return 0;
    }
    return roundToTwo(priceBase * taxRate);
}

/**
 * Calcula el total a pagar incluyendo impuestos
 * @param {number} priceBase - Precio base
 * @param {number} taxRate - Tasa de impuesto
 * @returns {number} Total a pagar
 */
export function computeTotal(priceBase, taxRate) {
    if (typeof priceBase !== 'number' || typeof taxRate !== 'number') {
        console.warn('computeTotal: Invalid parameters', { priceBase, taxRate });
        return priceBase || 0;
    }
    const tax = computeTax(priceBase, taxRate);
    return roundToTwo(priceBase + tax);
}

/**
 * Redondea un número a 2 decimales
 * @param {number} num - Número a redondear
 * @returns {number} Número redondeado
 */
export function roundToTwo(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Formatea un monto como moneda USD
 * @param {number} amount - Monto a formatear
 * @param {Object} options - Opciones de formato
 * @returns {string} Monto formateado
 */
export function formatMoney(amount, options = {}) {
    const { 
        showCurrency = true, 
        currency = 'USD',
        locale = 'es-EC',
        minimumFractionDigits = 2,
        maximumFractionDigits = 2
    } = options;
    
    if (typeof amount !== 'number' || isNaN(amount)) {
        console.warn('formatMoney: Invalid amount', amount);
        return showCurrency ? '$0.00' : '0.00';
    }
    
    const formatted = amount.toLocaleString(locale, {
        minimumFractionDigits,
        maximumFractionDigits
    });
    
    return showCurrency ? `$${formatted}` : formatted;
}

/**
 * Obtiene la información completa de un servicio por su ID
 * @param {string} serviceId - ID del servicio
 * @returns {Object|null} Configuración del servicio
 */
export function getServiceById(serviceId) {
    return SERVICES_CONFIG.find(s => s.id === serviceId) || null;
}

/**
 * Obtiene el precio a mostrar para un servicio
 * @param {string} serviceId - ID del servicio
 * @param {Object} options - Opciones
 * @returns {Object} Información de precio formateada
 */
export function getServicePriceInfo(serviceId, options = {}) {
    const service = getServiceById(serviceId);
    if (!service) {
        return null;
    }
    
    const { includeTax = true } = options;
    const priceBase = service.priceBase;
    const taxRate = service.taxRate;
    const taxAmount = computeTax(priceBase, taxRate);
    const total = includeTax ? computeTotal(priceBase, taxRate) : priceBase;
    
    return {
        service,
        priceBase,
        taxRate,
        taxAmount,
        total,
        isFromPrice: service.isFromPrice,
        formatted: {
            base: formatMoney(priceBase),
            tax: formatMoney(taxAmount),
            total: formatMoney(total),
            display: service.isFromPrice 
                ? `Desde ${formatMoney(total)}` 
                : formatMoney(total)
        },
        taxLabel: getTaxLabel(taxRate)
    };
}

/**
 * Genera la etiqueta de impuesto según la tasa
 * @param {number} taxRate - Tasa de impuesto
 * @returns {string} Etiqueta descriptiva
 */
export function getTaxLabel(taxRate) {
    if (taxRate === 0 || taxRate === 0.00) {
        return 'IVA 0%';
    } else if (taxRate === IVA_GENERAL_RATE) {
        return `IVA ${(taxRate * 100).toFixed(0)}% incluido`;
    } else {
        return `IVA ${(taxRate * 100).toFixed(0)}%`;
    }
}

/**
 * Genera el desglose completo de un servicio para checkout
 * @param {string} serviceId - ID del servicio
 * @param {Object} additionalOptions - Opciones adicionales (descuentos, etc.)
 * @returns {Object} Desglose completo
 */
export function getCheckoutBreakdown(serviceId, additionalOptions = {}) {
    const service = getServiceById(serviceId);
    if (!service) {
        return null;
    }
    
    // Changed from const to let to allow reassignment of discountRate
    let {
        discountAmount = 0,
        isCupoSolidario = false
    } = additionalOptions;

    let { discountRate = 0 } = additionalOptions;
    
    let { discountRate = 0 } = additionalOptions;

    let priceBase = service.priceBase;
    let finalDiscountRate = discountRate;
    
    // Aplicar descuento de cupo solidario si aplica
    let finalDiscountRate = discountRate;
    if (isCupoSolidario && SPECIAL_SERVICES.cupoSolidario) {
        finalDiscountRate = SPECIAL_SERVICES.cupoSolidario.discountRate;
    }
    
    // Calcular descuento
    const discount = finalDiscountRate > 0
        ? roundToTwo(priceBase * finalDiscountRate)
        : discountAmount;
    
    const priceAfterDiscount = roundToTwo(priceBase - discount);
    
    // Calcular impuestos sobre el precio con descuento
    const taxRate = service.taxRate;
    const taxAmount = computeTax(priceAfterDiscount, taxRate);
    const total = computeTotal(priceAfterDiscount, taxRate);
    
    return {
        service: {
            id: service.id,
            name: service.name,
            isFromPrice: service.isFromPrice,
            note: service.note
        },
        pricing: {
            base: priceBase,
            discount,
            discountRate: finalDiscountRate,
            priceAfterDiscount,
            taxRate,
            taxAmount,
            total
        },
        formatted: {
            base: formatMoney(priceBase),
            discount: discount > 0 ? formatMoney(discount) : null,
            priceAfterDiscount: formatMoney(priceAfterDiscount),
            taxAmount: formatMoney(taxAmount),
            taxRate: `${(taxRate * 100).toFixed(0)}%`,
            total: formatMoney(total)
        },
        labels: {
            tax: getTaxLabel(taxRate),
            note: service.note || null
        }
    };
}

/**
 * Valida que un monto de pago coincida con el esperado
 * @param {string} serviceId - ID del servicio
 * @param {number} amount - Monto recibido
 * @param {number} tolerance - Tolerancia de diferencia (default: 0.01)
 * @returns {boolean} Si el monto es válido
 */
export function validatePaymentAmount(serviceId, amount, tolerance = 0.01) {
    const priceInfo = getServicePriceInfo(serviceId);
    if (!priceInfo) return false;
    
    const expectedAmount = priceInfo.total;
    return Math.abs(amount - expectedAmount) <= tolerance;
}

// Textos informativos obligatorios
export const PRICING_DISCLAIMERS = {
    referralNote: 'Valores referenciales. El costo final depende de la valoración clínica y el plan indicado.',
    economicHelp: 'Si tienes limitaciones económicas, escríbenos: buscaremos opciones según disponibilidad.',
    ivaNote: 'Los valores mostrados indican el IVA aplicable (0% en servicios de salud / tarifa general en servicios gravados), según facturación.',
    fromPriceNote: 'Los servicios marcados como "Desde" requieren valoración previa para determinar el costo exacto.',
    solidarioNote: 'Cupos solidarios limitados por semana. Se asignan por orden de llegada y disponibilidad.'
};

// Exportar todo para uso global si es necesario
export default {
    IVA_GENERAL_RATE,
    SERVICES_CONFIG,
    SPECIAL_SERVICES,
    computeTax,
    computeTotal,
    roundToTwo,
    formatMoney,
    getServiceById,
    getServicePriceInfo,
    getTaxLabel,
    getCheckoutBreakdown,
    validatePaymentAmount,
    PRICING_DISCLAIMERS
};