'use strict';
// build-sync: 20260219-sync1

let deps = null;
let activeIcsUrl = '';
let crossSellCatalogPromise = null;

function getLang() {
    return deps && typeof deps.getCurrentLang === 'function' ? deps.getCurrentLang() : 'es';
}

function getAppointment() {
    if (deps && typeof deps.getCurrentAppointment === 'function') {
        return deps.getCurrentAppointment() || {};
    }
    return {};
}

function getClinicAddress() {
    if (deps && typeof deps.getClinicAddress === 'function') {
        return String(deps.getClinicAddress() || '');
    }
    return '';
}

function isHttpContext() {
    return typeof window !== 'undefined'
        && window.location
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

function loadCrossSellCatalog() {
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

function getCrossSellSuggestion(serviceId) {
    const normalizedServiceId = normalizeCrossSellToken(serviceId);
    if (!normalizedServiceId) {
        return Promise.resolve(null);
    }

    return loadCrossSellCatalog().then((suggestions) => {
        const match = suggestions.find((entry) => {
            if (!entry || typeof entry !== 'object') {
                return false;
            }

            return normalizeCrossSellToken(entry.service_id) === normalizedServiceId;
        });

        return match && typeof match === 'object' ? match : null;
    });
}

function localizedSuggestionValue(suggestion, baseKey, lang, fallback = '') {
    if (!suggestion || typeof suggestion !== 'object') {
        return fallback;
    }

    const langKey = `${baseKey}_${lang === 'en' ? 'en' : 'es'}`;
    const localized = String(suggestion[langKey] || '').trim();
    if (localized !== '') {
        return localized;
    }

    const spanish = String(suggestion[`${baseKey}_es`] || '').trim();
    if (spanish !== '') {
        return spanish;
    }

    return String(suggestion[baseKey] || fallback).trim();
}

function renderCrossSellCard(suggestion, lang) {
    if (!suggestion || typeof suggestion !== 'object') {
        return '';
    }

    const href = String(suggestion.href || '').trim();
    const badge = localizedSuggestionValue(
        suggestion,
        'badge',
        lang,
        lang === 'en' ? 'Recommended add-on' : 'Complemento recomendado'
    );
    const title = localizedSuggestionValue(suggestion, 'title', lang, '');
    const description = localizedSuggestionValue(suggestion, 'description', lang, '');
    const ctaLabel = localizedSuggestionValue(
        suggestion,
        'cta_label',
        lang,
        lang === 'en' ? 'View service' : 'Ver servicio'
    );

    if (!href || !title || !description) {
        return '';
    }

    return `
        <section
            data-success-cross-sell-card
            style="margin-top:20px;padding:18px;border-radius:18px;background:linear-gradient(180deg, rgba(15,23,42,0.04), rgba(82,113,255,0.10));border:1px solid rgba(82,113,255,0.20);"
        >
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5271ff;">
                ${escapeHtml(badge)}
            </p>
            <p data-success-cross-sell-title style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">
                ${escapeHtml(title)}
            </p>
            <p style="margin:0 0 14px;line-height:1.5;color:#475569;">
                ${escapeHtml(description)}
            </p>
            <a
                href="${escapeHtml(href)}"
                data-success-cross-sell-cta
                class="btn btn-secondary success-calendar-btn"
                style="width:100%;justify-content:center;"
            >
                ${escapeHtml(ctaLabel)}
            </a>
        </section>
    `;
}

function hydrateCrossSellSuggestion(detailsDiv, appointment, lang) {
    const anchor = detailsDiv && typeof detailsDiv.querySelector === 'function'
        ? detailsDiv.querySelector('[data-success-cross-sell-anchor]')
        : null;
    if (!anchor) {
        return;
    }

    const serviceId = appointment && typeof appointment === 'object'
        ? String(appointment.service || '')
        : '';
    if (!serviceId) {
        anchor.innerHTML = '';
        return;
    }

    getCrossSellSuggestion(serviceId)
        .then((suggestion) => {
            anchor.innerHTML = renderCrossSellCard(suggestion, lang);
        })
        .catch(() => {
            anchor.innerHTML = '';
        });
}

function escapeHtml(value) {
    if (deps && typeof deps.escapeHtml === 'function') {
        return deps.escapeHtml(String(value || ''));
    }
    const div = document.createElement('div');
    div.textContent = String(value || '');
    return div.innerHTML;
}

function getDoctorName(doctor) {
    const names = {
        rosero: 'Dr. Javier Rosero',
        narvaez: 'Dra. Carolina Narvaez',
        indiferente: 'Cualquiera disponible'
    };
    return names[doctor] || doctor || '-';
}

function getPaymentMethodLabel(method) {
    const lang = getLang();
    const map = {
        card: lang === 'es' ? 'Tarjeta' : 'Card',
        transfer: lang === 'es' ? 'Transferencia' : 'Transfer',
        cash: lang === 'es' ? 'Efectivo' : 'Cash',
        unpaid: lang === 'es' ? 'Pendiente' : 'Pending'
    };
    const key = String(method || '').toLowerCase();
    return map[key] || (method || map.unpaid);
}

function getPaymentStatusLabel(status) {
    const es = {
        paid: 'Pagado',
        pending_cash: 'Pago en consultorio',
        pending_transfer_review: 'Comprobante en validacion',
        pending_transfer: 'Transferencia pendiente',
        pending_gateway: 'Procesando pago',
        pending: 'Pendiente',
        failed: 'Fallido'
    };
    const en = {
        paid: 'Paid',
        pending_cash: 'Pay at clinic',
        pending_transfer_review: 'Proof under review',
        pending_transfer: 'Transfer pending',
        pending_gateway: 'Processing payment',
        pending: 'Pending',
        failed: 'Failed'
    };
    const key = String(status || '').toLowerCase();
    const map = getLang() === 'es' ? es : en;
    return map[key] || (status || map.pending);
}

function getServiceName(service) {
    const names = {
        consulta: 'Consulta Dermatologica',
        telefono: 'Consulta Telefónica',
        video: 'Video Consulta',
        laser: 'Tratamiento Láser',
        rejuvenecimiento: 'Rejuvenecimiento'
    };
    return names[service] || service || '-';
}

function getCheckinToken(appointment) {
    return String(
        appointment?.checkinToken || appointment?.checkin_token || ''
    ).trim();
}

function buildCheckinQrImageUrl(checkinToken) {
    const token = String(checkinToken || '').trim();
    if (!token) {
        return '';
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(token)}`;
}

function formatDateForGoogle(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function formatDateForIcs(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0];
}

function generateGoogleCalendarUrl(appointment, startDate, endDate) {
    const title = encodeURIComponent('Cita - Aurora Derm');
    const details = encodeURIComponent(
        `Servicio: ${getServiceName(appointment.service)}\nDoctor: ${getDoctorName(appointment.doctor)}\nPrecio: ${appointment.price || ''}`
    );
    const location = encodeURIComponent(getClinicAddress());

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}&details=${details}&location=${location}`;
}

function generateIcs(appointment, startDate, endDate) {
    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Aurora Derm//Consulta//ES
BEGIN:VEVENT
DTSTART:${formatDateForIcs(startDate)}
DTEND:${formatDateForIcs(endDate)}
SUMMARY:Cita - Aurora Derm
DESCRIPTION:Servicio: ${getServiceName(appointment.service)}\\nDoctor: ${getDoctorName(appointment.doctor)}\\nPrecio: ${appointment.price || ''}
LOCATION:${getClinicAddress()}
END:VEVENT
END:VCALENDAR`;
}

function cleanupIcsUrl() {
    if (activeIcsUrl) {
        URL.revokeObjectURL(activeIcsUrl);
        activeIcsUrl = '';
    }
}

function showSuccessModal(emailSent) {
    const modal = document.getElementById('successModal');
    if (!modal) return;

    const appointment = getAppointment();
    const detailsDiv = document.getElementById('appointmentDetails');
    const successDesc = modal.querySelector('[data-i18n="success_desc"]');
    const lang = getLang();
    const checkinToken = getCheckinToken(appointment);

    if (successDesc) {
        if (emailSent) {
            successDesc.textContent = lang === 'es'
                ? 'Enviamos un correo de confirmacion con los detalles de tu cita.'
                : 'A confirmation email with your appointment details was sent.';
        } else {
            successDesc.textContent = lang === 'es'
                ? 'Tu cita fue registrada. Te contactaremos para confirmar detalles.'
                : 'Your appointment was saved. We will contact you to confirm details.';
        }
    }

    const rawStart = appointment.date && appointment.time
        ? new Date(`${appointment.date}T${appointment.time}`)
        : new Date();
    const startDate = Number.isNaN(rawStart.getTime()) ? new Date() : rawStart;
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const googleCalendarUrl = generateGoogleCalendarUrl(appointment, startDate, endDate);
    const icsContent = generateIcs(appointment, startDate, endDate);
    const icsBlob = new Blob([icsContent], { type: 'text/calendar' });

    cleanupIcsUrl();
    activeIcsUrl = URL.createObjectURL(icsBlob);

    if (detailsDiv) {
        const checkinQrImageUrl = buildCheckinQrImageUrl(checkinToken);
        const checkinTitle =
            lang === 'es' ? 'Check-in rapido en kiosco' : 'Fast kiosk check-in';
        const checkinMessage =
            lang === 'es'
                ? 'Cuando llegues, escanea este QR en el kiosco o muestra el codigo.'
                : 'When you arrive, scan this QR at the kiosk or show the code.';
        const checkinCodeLabel =
            lang === 'es' ? 'Codigo de llegada:' : 'Arrival code:';
        const checkinNote =
            lang === 'es'
                ? 'Guarda este QR o el codigo para confirmar tu llegada en el kiosco.'
                : 'Save this QR or code to confirm your arrival at the kiosk.';
        const checkinBlock = checkinToken
            ? `
            <div style="margin-top:20px;padding:18px;border-radius:16px;background:#f8fafc;border:1px solid rgba(15,23,42,0.08);text-align:center;">
                <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#0d1a2f;">${escapeHtml(checkinTitle)}</p>
                <p style="margin:0 0 14px;line-height:1.5;color:#475569;">${escapeHtml(checkinMessage)}</p>
                <img
                    src="${checkinQrImageUrl}"
                    alt="${escapeHtml(
                        lang === 'es'
                            ? 'QR de check-in para kiosco'
                            : 'Kiosk check-in QR'
                    )}"
                    width="220"
                    height="220"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    style="display:block;margin:0 auto 14px;border-radius:18px;background:#fff;padding:10px;border:1px solid rgba(15,23,42,0.08);"
                />
                <p style="margin:0 0 6px;font-size:13px;color:#64748b;">${escapeHtml(checkinCodeLabel)}</p>
                <p style="margin:0;font-size:15px;font-weight:700;letter-spacing:0.08em;color:#0f172a;">${escapeHtml(checkinToken)}</p>
                <p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#64748b;">${escapeHtml(checkinNote)}</p>
            </div>
        `
            : '';
        detailsDiv.innerHTML = `
            <div class="success-details-card">
                <p class="success-details-line"><strong>${lang === 'es' ? 'Doctor:' : 'Doctor:'}</strong> ${escapeHtml(getDoctorName(appointment.doctor))}</p>
                <p class="success-details-line"><strong>${lang === 'es' ? 'Fecha:' : 'Date:'}</strong> ${escapeHtml(appointment.date || '-')}</p>
                <p class="success-details-line"><strong>${lang === 'es' ? 'Hora:' : 'Time:'}</strong> ${escapeHtml(appointment.time || '-')}</p>
                <p class="success-details-line"><strong>${lang === 'es' ? 'Pago:' : 'Payment:'}</strong> ${escapeHtml(getPaymentMethodLabel(appointment.paymentMethod))} - ${escapeHtml(getPaymentStatusLabel(appointment.paymentStatus))}</p>
                <p><strong>${lang === 'es' ? 'Total:' : 'Total:'}</strong> ${escapeHtml(appointment.price || '$0.00')}</p>
            </div>
            ${checkinBlock}
            <div data-success-cross-sell-anchor></div>
            <div class="success-calendar-actions">
                <a href="${googleCalendarUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary success-calendar-btn">
                    <i class="fab fa-google"></i> Google Calendar
                </a>
                <a href="${activeIcsUrl}" download="cita-piel-en-armonia.ics" class="btn btn-secondary success-calendar-btn">
                    <i class="fas fa-calendar-alt"></i> Outlook/Apple
                </a>
            </div>
        `;
        hydrateCrossSellSuggestion(detailsDiv, appointment, lang);
    }

    modal.classList.add('active');
}

function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.body.style.overflow = '';
    cleanupIcsUrl();
}

function init(inputDeps) {
    deps = inputDeps || deps;
    return window.PielSuccessModalEngine;
}

window.PielSuccessModalEngine = {
    init,
    showSuccessModal,
    closeSuccessModal
};
