import { phoneLabel, serviceHint } from './utils.js';

const CALLBACK_WHATSAPP_TEMPLATES = Object.freeze([
    {
        key: 'no_show',
        label: 'No-show · Te esperamos',
        description:
            'Recupera un lead que falto o dejo de responder sin cerrar la puerta.',
    },
    {
        key: 'rebooking_slot',
        label: 'Reagendamiento · Slot abierto',
        description:
            'Ofrece un cupo puntual y empuja cierre rapido por WhatsApp.',
    },
    {
        key: 'pre_consult_incomplete',
        label: 'Pre-consulta incompleta',
        description:
            'Recuerda terminar la pre-consulta para destrabar la valoracion.',
    },
    {
        key: 'post_procedure',
        label: 'Post-procedimiento · Cuidados',
        description:
            'Comparte cuidados base y deja una salida clara para soporte humano.',
    },
    {
        key: 'prescription_ready',
        label: 'Receta lista · Link',
        description:
            'Entrega el link del portal cuando la receta ya esta disponible.',
    },
]);

function serviceLine(item) {
    const service = String(serviceHint(item) || '').trim();
    return service && service !== 'Sin sugerencia' ? ` para ${service}` : '';
}

function preferenceLine(item) {
    const preference = String(item?.preferencia || '').trim();
    return preference ? ` Tengo anotado: ${preference}.` : '';
}

function portalHistoryUrl() {
    const path = '/es/portal/historial/';
    if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}${path}`;
    }
    return path;
}

function normalizeCallbackWhatsappTemplateKey(value) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    return CALLBACK_WHATSAPP_TEMPLATES.some(
        (template) => template.key === normalized
    )
        ? normalized
        : '';
}

export function listCallbackWhatsappTemplates() {
    return CALLBACK_WHATSAPP_TEMPLATES;
}

export function getCallbackWhatsappTemplate(key) {
    const normalized = normalizeCallbackWhatsappTemplateKey(key);
    return (
        CALLBACK_WHATSAPP_TEMPLATES.find(
            (template) => template.key === normalized
        ) || null
    );
}

export function getCallbackWhatsappTemplateKey(item) {
    return normalizeCallbackWhatsappTemplateKey(
        item?.leadOps?.whatsappTemplateKey || ''
    );
}

export function buildCallbackWhatsappMessage(key, item) {
    const normalized = normalizeCallbackWhatsappTemplateKey(key);
    if (!normalized) return '';

    const greeting = 'Hola, te escribe el equipo de Aurora Derm.';
    const service = serviceLine(item);

    if (normalized === 'no_show') {
        return `${greeting} Te esperamos${service}.${preferenceLine(item)} Si hoy ya no te queda bien, te ayudo a reagendar sin problema.`;
    }

    if (normalized === 'rebooking_slot') {
        return `${greeting} Se abrio un cupo${service} y te lo puedo reservar hoy.${preferenceLine(item)} Si te sirve, te confirmo el horario por aqui.`;
    }

    if (normalized === 'pre_consult_incomplete') {
        return `${greeting} Tu pre-consulta${service} quedo incompleta.${preferenceLine(item)} Si la terminas hoy, avanzamos con la valoracion y te proponemos horario.`;
    }

    if (normalized === 'post_procedure') {
        return `${greeting} Te comparto cuidados despues de tu procedimiento${service}: evita sol directo, no manipules la zona y escribenos si notas molestia intensa o enrojecimiento marcado.`;
    }

    if (normalized === 'prescription_ready') {
        return `${greeting} Tu receta${service} ya esta lista. La puedes revisar aqui: ${portalHistoryUrl()} Si quieres, tambien te ayudo con los siguientes pasos.`;
    }

    return '';
}

export function getCallbackWhatsappDraft(item) {
    const current = String(item?.leadOps?.whatsappMessageDraft || '').trim();
    if (current) {
        return current;
    }

    const templateKey = getCallbackWhatsappTemplateKey(item);
    return templateKey ? buildCallbackWhatsappMessage(templateKey, item) : '';
}

export function buildCallbackWhatsappUrl(item, message) {
    const digits = String(item?.telefono || item?.phone || '').replace(
        /\D+/g,
        ''
    );
    const draft = String(message || '').trim();
    if (!digits || !draft) return '';
    return `https://wa.me/${digits}?text=${encodeURIComponent(draft)}`;
}

export function callbackWhatsappComposerHint(item) {
    const template = getCallbackWhatsappTemplate(
        getCallbackWhatsappTemplateKey(item)
    );
    if (template?.description) {
        return template.description;
    }

    if (phoneLabel(item) === 'Sin telefono') {
        return 'Este lead no tiene telefono valido para abrir WhatsApp.';
    }

    return 'Elige una plantilla operativa, personalizala y abre WhatsApp con un clic.';
}

export { normalizeCallbackWhatsappTemplateKey };
