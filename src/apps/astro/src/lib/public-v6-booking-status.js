import { homePath, mapServiceHint } from './content.js';

const BOOKING_STATUS_COPY = {
    service: {
        es: {
            description:
                'La agenda web general sigue en mantenimiento, pero desde aqui puede abrir la reserva enfocada en esta especialidad y llegar con su motivo de consulta ya mejor ubicado.',
            ctaLabel: 'Abrir reserva de esta especialidad',
        },
        en: {
            description:
                'The general online agenda is still under maintenance, but from here you can open booking for this specialty and arrive with a clearer reason for consultation.',
            ctaLabel: 'Open booking for this specialty',
        },
    },
    blog: {
        es: {
            description:
                'Si esta guia ya le ayudo a ubicar su caso, siga con una pre-consulta corta para ordenar el siguiente paso antes de elegir servicio o modalidad.',
            ctaLabel: 'Abrir pre-consulta',
            ctaHref: '/es/pre-consulta/',
        },
    },
    firstConsultation: {
        es: {
            ctaHref:
                'https://wa.me/593982453672?text=Hola%2C%20quiero%20coordinar%20mi%20primera%20consulta%20en%20Aurora%20Derm',
        },
        en: {
            ctaHref:
                'https://wa.me/593982453672?text=Hello%2C%20I%20want%20to%20schedule%20my%20first%20consultation%20at%20Aurora%20Derm',
        },
    },
};

function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function normalizeText(value) {
    return hasText(value) ? value.trim() : '';
}

function normalizeHref(value) {
    const raw = normalizeText(value);
    return raw && raw !== '#' ? raw : '';
}

function normalizeStatus(status = {}) {
    return {
        eyebrow: normalizeText(status?.eyebrow),
        title: normalizeText(status?.title),
        description: normalizeText(status?.description),
        ctaLabel: normalizeText(status?.ctaLabel),
        ctaHref: normalizeHref(status?.ctaHref),
    };
}

function getLocalizedCopy(group, locale) {
    return group?.[locale] || group?.es || {};
}

function buildServiceBookingHref(locale, serviceSlug) {
    const slug = normalizeText(serviceSlug);
    if (!slug) {
        return '';
    }

    return `${homePath(locale)}?service=${encodeURIComponent(mapServiceHint(slug))}#citas`;
}

export function resolveBookingStatus(status = {}, options = {}) {
    const { locale = 'es', surface = 'generic', serviceSlug = '' } = options;
    const normalized = normalizeStatus(status);

    if (surface === 'service') {
        const ctaHref = buildServiceBookingHref(locale, serviceSlug);
        if (!ctaHref) {
            return normalized;
        }

        const copy = getLocalizedCopy(BOOKING_STATUS_COPY.service, locale);
        return {
            ...normalized,
            description: normalizeText(copy.description) || normalized.description,
            ctaLabel: normalizeText(copy.ctaLabel) || normalized.ctaLabel,
            ctaHref,
        };
    }

    if (surface === 'blog') {
        const copy = getLocalizedCopy(BOOKING_STATUS_COPY.blog, locale);
        if (!normalizeHref(copy.ctaHref)) {
            return normalized;
        }

        return {
            ...normalized,
            description: normalizeText(copy.description) || normalized.description,
            ctaLabel: normalizeText(copy.ctaLabel) || normalized.ctaLabel,
            ctaHref: normalizeHref(copy.ctaHref),
        };
    }

    if (surface === 'first-consultation') {
        const copy = getLocalizedCopy(BOOKING_STATUS_COPY.firstConsultation, locale);
        return {
            ...normalized,
            ctaHref: normalizeHref(copy.ctaHref) || normalized.ctaHref,
        };
    }

    return normalized;
}

export function getBookingStatusCta(status = {}, options = {}) {
    const resolved = resolveBookingStatus(status, options);
    return {
        label: resolved.ctaLabel,
        href: resolved.ctaHref,
    };
}
