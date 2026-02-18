/**
 * PIEL EN ARMONÍA - Apple Design
 * Todas las funcionalidades integradas
 * 
 * Incluye:
 * - Toast notifications
 * - Loading states
 * - Exportar a calendario
 * - Validación de disponibilidad
 */

// ========================================
// TOAST NOTIFICATIONS SYSTEM
// ========================================
function showToast(message, type = 'info', title = '') {
    // Create container if doesn't exist
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    
    const titles = {
        success: title || 'Éxito',
        error: title || 'Error',
        warning: title || 'Advertencia',
        info: title || 'Información'
    };
    
    // Escapar mensaje para prevenir XSS
    const safeMsg = String(message).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${titles[type]}</div>
            <div class="toast-message">${safeMsg}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
        <div class="toast-progress"></div>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

const DEBUG = false;
function debugLog(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}

// ========================================
// TRANSLATIONS
// ========================================
const translations = {
    es: {
        brand: "Piel en Armonía",
        nav_home: "Inicio",
        nav_services: "Servicios",
        nav_telemedicine: "Telemedicina",
        nav_team: "Equipo",
        nav_gallery: "Resultados",
        nav_clinic: "Consultorio",
        nav_reviews: "Reseñas",
        nav_book: "Reservar Cita",
        theme_light: "Claro",
        theme_dark: "Oscuro",
        theme_system: "Sistema",
        hero_title1: "Tu piel.",
        hero_title2: "En las mejores manos.",
        hero_subtitle: "Dermatología especializada con tecnología de vanguardia. Tratamientos personalizados para que tu piel luzca saludable y radiante.",
        hero_cta_primary: "Reservar Consulta",
        hero_cta_secondary: "Consulta Online",
        services_title: "Nuestros Servicios",
        services_subtitle: "Tratamientos dermatológicos de excelencia",
        service_consulta: "Consulta Dermatológica",
        service_consulta_desc: "Evaluación completa de tu piel con diagnóstico preciso y plan de tratamiento personalizado.",
        service_telemedicina: "Telemedicina",
        service_telemedicina_desc: "Consulta médica desde la comodidad de tu hogar por teléfono o videollamada.",
        service_laser: "Láser Dermatológico",
        service_laser_desc: "Tratamientos con láser de última generación para diversas afecciones de la piel.",
        service_rejuvenation: "Rejuvenecimiento",
        service_rejuvenation_desc: "Tratamientos estéticos para recuperar la juventud y luminosidad de tu piel.",
        service_acne: "Tratamiento de Acné",
        service_acne_desc: "Soluciones efectivas para controlar y eliminar el acné en todas sus formas.",
        service_cancer: "Detección de Cáncer de Piel",
        service_cancer_desc: "Examen dermatoscópico completo para detección temprana de lesiones sospechosas.",
        badge_popular: "Popular",
        price_from: "Desde",
        telemedicine_title: "Consulta desde cualquier lugar",
        telemedicine_subtitle: "Tres formas simples de conectarte con tu dermatólogo",
        tele_phone_title: "Llamada Telefónica",
        tele_phone_desc: "La forma más fácil. Toca el botón y habla directamente con el doctor desde tu teléfono.",
        tele_feature1: "Funciona en cualquier celular",
        tele_feature2: "Sin internet necesario",
        tele_feature3: "Perfecto para adultos mayores",
        tele_whatsapp_title: "WhatsApp Video",
        tele_whatsapp_desc: "Videollamada por WhatsApp. Si ya tienes WhatsApp instalado, es la opción más cómoda.",
        tele_feature4: "Videollamada HD",
        tele_feature5: "Envía fotos de tu piel",
        tele_feature6: "Chat incluido",
        tele_web_title: "Video desde Navegador",
        tele_web_desc: "Sin instalar nada. Solo abre el enlace y permite acceso a tu cámara. Funciona en computadora o celular.",
        tele_feature7: "Sin apps ni registro",
        tele_feature8: "Pantalla más grande",
        tele_feature9: "Ideal para compartir pantalla",
        btn_call: "Llamar Ahora",
        btn_whatsapp: "Abrir WhatsApp",
        btn_video: "Iniciar Video",
        callback_title: "¿Prefieres que te llamemos?",
        callback_desc: "Déjanos tu número y el doctor te llamará en los próximos minutos.",
        callback_when: "¿Cuándo prefieres?",
        callback_now: "Lo antes posible",
        callback_15min: "En 15 minutos",
        callback_30min: "En 30 minutos",
        callback_1hour: "En 1 hora",
        btn_request: "Solicitar Llamada",
        badge_recommended: "Recomendado",
        team_title: "Nuestro Equipo",
        team_subtitle: "Especialistas dedicados al cuidado de tu piel",
        role_dermatologo: "Dermatólogo Clínico",
        role_estetica: "Dermatóloga Estética",
        desc_rosero: "15 años de experiencia en dermatología clínica y quirúrgica. Especialista en detección temprana de cáncer de piel.",
        desc_narvaez: "Especialista en rejuvenecimiento facial, láser dermatológico y tratamientos estéticos no invasivos.",
        status_available: "Disponible hoy",
        gallery_title: "Resultados que hablan por sí solos",
        gallery_subtitle: "Transformaciones reales de nuestros pacientes",
        filter_all: "Todos",
        filter_acne: "Acné",
        filter_rejuvenation: "Rejuvenecimiento",
        filter_laser: "Láser",
        filter_spots: "Manchas",
        label_before: "Antes",
        label_after: "Después",
        case_acne: "Tratamiento de Acné Severo",
        case_acne_desc: "6 meses de tratamiento combinado",
        case_rejuvenation: "Rejuvenecimiento Facial",
        case_rejuvenation_desc: "Láser + peelings químicos",
        case_laser: "Tratamiento Láser",
        case_laser_desc: "Eliminación de lesiones vasculares",
        case_spots: "Eliminación de Manchas",
        case_spots_desc: "Tratamiento despigmentante",
        clinic_title: "Nuestro Consultorio",
        clinic_desc: "Ubicados en el corazón de Quito, contamos con instalaciones modernas y equipamiento de última generación para brindarte la mejor atención.",
        clinic_address_label: "Dirección",
        clinic_hours_label: "Horario de Atención",
        clinic_hours: "Lunes - Viernes: 9:00 - 18:00<br>Sábados: 9:00 - 13:00",
        clinic_phone_label: "Teléfono",
        clinic_parking_label: "Estacionamiento",
        clinic_parking: "Estacionamiento privado disponible",
        btn_directions: "Cómo llegar",
        reviews_title: "Lo que dicen nuestros pacientes",
        reviews_count: "500+ consultas atendidas",
        review_1: "\"Soy señora de 78 años y pude llamar al doctor sin problemas. Muy amable y profesional. Me resolvió todas mis dudas sobre mi piel.\"",
        review_2: "\"La videollamada por WhatsApp fue súper fácil. No tuve que instalar nada nuevo. El doctor fue muy paciente y me explicó todo detalladamente.\"",
        review_3: "\"Solicité que me llamaran y en 10 minutos el doctor me contactó. Excelente servicio. Mi acné ha mejorado notablemente.\"",
        btn_write_review: "Escribir Reseña",
        appointment_title: "Reserva tu Cita",
        appointment_desc: "Agenda tu consulta de forma rápida y sencilla. Selecciona el tipo de servicio, el doctor de tu preferencia y la fecha que más te convenga.",
        benefit_1: "Confirmación inmediata",
        benefit_2: "Confirmación de pago asistida",
        benefit_3: "Reprogramación gratuita",
        form_title: "Nueva Cita",
        label_service: "Tipo de Consulta",
        select_service: "Selecciona un servicio",
        opt_consulta: "Consulta Dermatológica - $40",
        opt_telefono: "Consulta Telefónica - $25",
        opt_video: "Video Consulta - $30",
        opt_laser: "Tratamiento Láser - desde $150",
        opt_rejuvenation: "Rejuvenecimiento - desde $120",
        label_doctor: "Doctor",
        select_doctor: "Selecciona un doctor",
        opt_rosero: "Dr. Javier Rosero - Dermatólogo Clínico",
        opt_narvaez: "Dra. Carolina Narváez - Dermatóloga Estética",
        opt_any: "Primera disponible",
        label_date: "Fecha",
        label_time: "Hora",
        select_time: "Hora",
        label_name: "Nombre completo",
        label_email: "Email",
        label_phone: "Teléfono",
        summary_subtotal: "Subtotal",
        summary_iva: "IVA (12%)",
        summary_total: "Total",
        btn_continue: "Continuar al Pago",
        payment_title: "Método de Pago",
        pay_card: "Tarjeta",
        pay_transfer: "Transferencia",
        pay_cash: "Efectivo",
        label_card_number: "Número de tarjeta",
        label_expiry: "Vencimiento",
        label_cvv: "CVV",
        label_card_name: "Nombre en la tarjeta",
        bank_name: "Banco Pichincha",
        bank_account: "Cuenta de Ahorros: 1234567890",
        bank_owner: "Titular: Dra. Cecilio Caiza e hijas",
        bank_ruc: "RUC: 1234567890001",
        label_transfer_ref: "Número de referencia",
        cash_info: "Paga directamente en el consultorio el día de tu cita.",
        payment_total: "Total a pagar:",
        btn_pay: "Confirmar Reserva",
        success_title: "¡Cita Confirmada!",
        success_desc: "Tu cita fue registrada correctamente.",
        btn_done: "Entendido",
        video_modal_title: "Elige cómo quieres hacer la videollamada:",
        video_jitsi: "Jitsi Meet (Recomendado)",
        video_jitsi_desc: "Sin registro. Funciona en cualquier navegador.",
        video_whatsapp: "WhatsApp Video",
        video_whatsapp_desc: "Usa la app de WhatsApp que ya tienes.",
        video_tip: "Después de abrir la videollamada, comparte el enlace o ID con el doctor por WhatsApp.",
        review_modal_title: "Escribe tu Reseña",
        label_your_name: "Tu nombre",
        label_rating: "Calificación",
        label_review: "Tu experiencia",
        btn_submit_review: "Publicar Reseña",
        footer_tagline: "Dermatología especializada en Quito",
        footer_rights: "Todos los derechos reservados."
    },
    en: {
        brand: "Piel en Armonía",
        nav_home: "Home",
        nav_services: "Services",
        nav_telemedicine: "Telemedicine",
        nav_team: "Team",
        nav_gallery: "Results",
        nav_clinic: "Clinic",
        nav_reviews: "Reviews",
        nav_book: "Book Appointment",
        theme_light: "Light",
        theme_dark: "Dark",
        theme_system: "System",
        hero_title1: "Your skin.",
        hero_title2: "In the best hands.",
        hero_subtitle: "Specialized dermatology with cutting-edge technology. Personalized treatments for healthy, radiant skin.",
        hero_cta_primary: "Book Consultation",
        hero_cta_secondary: "Online Consultation",
        services_title: "Our Services",
        services_subtitle: "Excellence in dermatological treatments",
        service_consulta: "Dermatology Consultation",
        service_consulta_desc: "Complete skin evaluation with accurate diagnosis and personalized treatment plan.",
        service_telemedicina: "Telemedicine",
        service_telemedicina_desc: "Medical consultation from the comfort of your home via phone or video call.",
        service_laser: "Laser Dermatology",
        service_laser_desc: "State-of-the-art laser treatments for various skin conditions.",
        service_rejuvenation: "Rejuvenation",
        service_rejuvenation_desc: "Aesthetic treatments to recover the youth and luminosity of your skin.",
        service_acne: "Acne Treatment",
        service_acne_desc: "Effective solutions to control and eliminate acne in all its forms.",
        service_cancer: "Skin Cancer Detection",
        service_cancer_desc: "Complete dermatoscopic examination for early detection of suspicious lesions.",
        badge_popular: "Popular",
        price_from: "From",
        telemedicine_title: "Consult from anywhere",
        telemedicine_subtitle: "Three simple ways to connect with your dermatologist",
        tele_phone_title: "Phone Call",
        tele_phone_desc: "The easiest way. Tap the button and speak directly with the doctor from your phone.",
        tele_feature1: "Works on any phone",
        tele_feature2: "No internet needed",
        tele_feature3: "Perfect for seniors",
        tele_whatsapp_title: "WhatsApp Video",
        tele_whatsapp_desc: "Video call via WhatsApp. If you already have WhatsApp installed, it's the most convenient option.",
        tele_feature4: "HD video call",
        tele_feature5: "Send photos of your skin",
        tele_feature6: "Chat included",
        tele_web_title: "Browser Video",
        tele_web_desc: "Nothing to install. Just open the link and allow camera access. Works on computer or phone.",
        tele_feature7: "No apps or registration",
        tele_feature8: "Larger screen",
        tele_feature9: "Great for screen sharing",
        btn_call: "Call Now",
        btn_whatsapp: "Open WhatsApp",
        btn_video: "Start Video",
        callback_title: "Prefer us to call you?",
        callback_desc: "Leave your number and the doctor will call you in the next few minutes.",
        callback_when: "When do you prefer?",
        callback_now: "As soon as possible",
        callback_15min: "In 15 minutes",
        callback_30min: "In 30 minutes",
        callback_1hour: "In 1 hour",
        btn_request: "Request Call",
        badge_recommended: "Recommended",
        team_title: "Our Team",
        team_subtitle: "Specialists dedicated to your skin care",
        role_dermatologo: "Clinical Dermatologist",
        role_estetica: "Aesthetic Dermatologist",
        desc_rosero: "15 years of experience in clinical and surgical dermatology. Specialist in early detection of skin cancer.",
        desc_narvaez: "Specialist in facial rejuvenation, dermatological laser, and non-invasive aesthetic treatments.",
        status_available: "Available today",
        gallery_title: "Results that speak for themselves",
        gallery_subtitle: "Real transformations of our patients",
        filter_all: "All",
        filter_acne: "Acne",
        filter_rejuvenation: "Rejuvenation",
        filter_laser: "Laser",
        filter_spots: "Spots",
        label_before: "Before",
        label_after: "After",
        case_acne: "Severe Acne Treatment",
        case_acne_desc: "6 months of combined treatment",
        case_rejuvenation: "Facial Rejuvenation",
        case_rejuvenation_desc: "Laser + chemical peels",
        case_laser: "Laser Treatment",
        case_laser_desc: "Removal of vascular lesions",
        case_spots: "Spot Removal",
        case_spots_desc: "Depigmenting treatment",
        clinic_title: "Our Clinic",
        clinic_desc: "Located in the heart of Quito, we have modern facilities and state-of-the-art equipment to provide you with the best care.",
        clinic_address_label: "Address",
        clinic_hours_label: "Opening Hours",
        clinic_hours: "Monday - Friday: 9:00 - 18:00<br>Saturdays: 9:00 - 13:00",
        clinic_phone_label: "Phone",
        clinic_parking_label: "Parking",
        clinic_parking: "Private parking available",
        btn_directions: "Get Directions",
        reviews_title: "What our patients say",
        reviews_count: "500+ consultations attended",
        review_1: "\"I'm a 78-year-old lady and I was able to call the doctor without problems. Very kind and professional. He solved all my doubts about my skin.\"",
        review_2: "\"The WhatsApp video call was super easy. I didn't have to install anything new. The doctor was very patient and explained everything in detail.\"",
        review_3: "\"I requested a call back and the doctor contacted me in 10 minutes. Excellent service. My acne has improved noticeably.\"",
        btn_write_review: "Write Review",
        appointment_title: "Book Your Appointment",
        appointment_desc: "Schedule your consultation quickly and easily. Select the type of service, preferred doctor, and the date that suits you best.",
        benefit_1: "Immediate confirmation",
        benefit_2: "Assisted payment confirmation",
        benefit_3: "Free rescheduling",
        form_title: "New Appointment",
        label_service: "Type of Consultation",
        select_service: "Select a service",
        opt_consulta: "Dermatology Consultation - $40",
        opt_telefono: "Phone Consultation - $25",
        opt_video: "Video Consultation - $30",
        opt_laser: "Laser Treatment - from $150",
        opt_rejuvenation: "Rejuvenation - from $120",
        label_doctor: "Doctor",
        select_doctor: "Select a doctor",
        opt_rosero: "Dr. Javier Rosero - Clinical Dermatologist",
        opt_narvaez: "Dr. Carolina Narváez - Aesthetic Dermatologist",
        opt_any: "First available",
        label_date: "Date",
        label_time: "Time",
        select_time: "Time",
        label_name: "Full name",
        label_email: "Email",
        label_phone: "Phone",
        summary_subtotal: "Subtotal",
        summary_iva: "VAT (12%)",
        summary_total: "Total",
        btn_continue: "Continue to Payment",
        payment_title: "Payment Method",
        pay_card: "Card",
        pay_transfer: "Transfer",
        pay_cash: "Cash",
        label_card_number: "Card number",
        label_expiry: "Expiry",
        label_cvv: "CVV",
        label_card_name: "Name on card",
        bank_name: "Banco Pichincha",
        bank_account: "Savings Account: 1234567890",
        bank_owner: "Holder: Dra. Cecilio Caiza e hijas",
        bank_ruc: "RUC: 1234567890001",
        label_transfer_ref: "Reference number",
        cash_info: "Pay directly at the clinic on the day of your appointment.",
        payment_total: "Total to pay:",
        btn_pay: "Confirm Booking",
        success_title: "Appointment Confirmed!",
        success_desc: "Your appointment was registered successfully.",
        btn_done: "Got it",
        video_modal_title: "Choose how you want to make the video call:",
        video_jitsi: "Jitsi Meet (Recommended)",
        video_jitsi_desc: "No registration. Works in any browser.",
        video_whatsapp: "WhatsApp Video",
        video_whatsapp_desc: "Use the WhatsApp app you already have.",
        video_tip: "After opening the video call, share the link or ID with the doctor via WhatsApp.",
        review_modal_title: "Write Your Review",
        label_your_name: "Your name",
        label_rating: "Rating",
        label_review: "Your experience",
        btn_submit_review: "Submit Review",
        footer_tagline: "Specialized dermatology in Quito",
        footer_rights: "All rights reserved."
    }
};

let currentLang = localStorage.getItem('language') || 'es';
const THEME_STORAGE_KEY = 'themeMode';
const VALID_THEME_MODES = new Set(['light', 'dark', 'system']);
let currentThemeMode = localStorage.getItem(THEME_STORAGE_KEY) || 'system';
const API_ENDPOINT = '/api.php';
const DEFAULT_TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00'];
let currentAppointment = null;
let availabilityCache = {};
let reviewsCache = [];
let paymentConfig = { enabled: false, provider: 'stripe', publishableKey: '', currency: 'USD' };
let stripeClient = null;
let stripeElements = null;
let stripeCardElement = null;
let stripeMounted = false;
const LOCAL_FALLBACK_ENABLED = window.location.protocol === 'file:';
const systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let themeTransitionTimer = null;

if (!VALID_THEME_MODES.has(currentThemeMode)) {
    currentThemeMode = 'system';
}

function resolveThemeMode(mode = currentThemeMode) {
    if (mode === 'system') {
        if (systemThemeQuery && systemThemeQuery.matches) {
            return 'dark';
        }
        return 'light';
    }
    return mode;
}

function applyThemeMode(mode = currentThemeMode) {
    const resolvedTheme = resolveThemeMode(mode);
    document.documentElement.setAttribute('data-theme-mode', mode);
    document.documentElement.setAttribute('data-theme', resolvedTheme);
}

function updateThemeButtons() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.themeMode === currentThemeMode);
    });
}

function animateThemeTransition() {
    if (!document.body) return;

    if (themeTransitionTimer) {
        clearTimeout(themeTransitionTimer);
    }

    document.body.classList.remove('theme-transition');
    void document.body.offsetWidth;
    document.body.classList.add('theme-transition');

    themeTransitionTimer = setTimeout(() => {
        document.body.classList.remove('theme-transition');
    }, 320);
}

function setThemeMode(mode) {
    if (!VALID_THEME_MODES.has(mode)) {
        return;
    }

    currentThemeMode = mode;
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    animateThemeTransition();
    applyThemeMode(mode);
    updateThemeButtons();
}

function initThemeMode() {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'system';
    currentThemeMode = VALID_THEME_MODES.has(storedTheme) ? storedTheme : 'system';
    applyThemeMode(currentThemeMode);
    updateThemeButtons();
}

function handleSystemThemeChange() {
    if (currentThemeMode === 'system') {
        applyThemeMode('system');
    }
}

if (systemThemeQuery) {
    if (typeof systemThemeQuery.addEventListener === 'function') {
        systemThemeQuery.addEventListener('change', handleSystemThemeChange);
    } else if (typeof systemThemeQuery.addListener === 'function') {
        systemThemeQuery.addListener(handleSystemThemeChange);
    }
}

function storageGetJSON(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value === null ? fallback : value;
    } catch (error) {
        return fallback;
    }
}

function storageSetJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        // Ignore storage quota errors.
    }
}

async function apiRequest(resource, options = {}) {
    const method = options.method || 'GET';
    const query = new URLSearchParams({ resource: resource });
    if (options.query && typeof options.query === 'object') {
        Object.entries(options.query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                query.set(key, String(value));
            }
        });
    }
    const url = `${API_ENDPOINT}?${query.toString()}`;
    const requestInit = {
        method: method,
        credentials: 'same-origin',
        headers: {
            'Accept': 'application/json'
        }
    };

    if (options.body !== undefined) {
        requestInit.headers['Content-Type'] = 'application/json';
        requestInit.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, requestInit);
    const responseText = await response.text();

    let payload = {};
    try {
        payload = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
        throw new Error('Respuesta del servidor no es JSON valido');
    }

    if (!response.ok || payload.ok === false) {
        const message = payload.error || `HTTP ${response.status}`;
        throw new Error(message);
    }

    return payload;
}

async function loadPaymentConfig() {
    try {
        const payload = await apiRequest('payment-config');
        paymentConfig = {
            enabled: payload.enabled === true,
            provider: payload.provider || 'stripe',
            publishableKey: payload.publishableKey || '',
            currency: payload.currency || 'USD'
        };
    } catch (error) {
        paymentConfig = { enabled: false, provider: 'stripe', publishableKey: '', currency: 'USD' };
    }
    return paymentConfig;
}

async function createPaymentIntent(appointment) {
    const payload = await apiRequest('payment-intent', {
        method: 'POST',
        body: appointment
    });
    return payload;
}

async function verifyPaymentIntent(paymentIntentId) {
    return apiRequest('payment-verify', {
        method: 'POST',
        body: { paymentIntentId }
    });
}

async function uploadTransferProof(file) {
    const formData = new FormData();
    formData.append('proof', file);

    const query = new URLSearchParams({ resource: 'transfer-proof' });
    const response = await fetch(`${API_ENDPOINT}?${query.toString()}`, {
        method: 'POST',
        credentials: 'same-origin',
        body: formData
    });

    const text = await response.text();
    let payload = {};
    try {
        payload = text ? JSON.parse(text) : {};
    } catch (error) {
        throw new Error('No se pudo interpretar la respuesta de subida');
    }

    if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return payload.data || {};
}

async function loadAvailabilityData() {
    try {
        const payload = await apiRequest('availability');
        availabilityCache = payload.data || {};
        storageSetJSON('availability', availabilityCache);
    } catch (error) {
        availabilityCache = storageGetJSON('availability', {});
    }
    return availabilityCache;
}

async function getBookedSlots(date) {
    try {
        const payload = await apiRequest('booked-slots', {
            query: { date: date }
        });
        return Array.isArray(payload.data) ? payload.data : [];
    } catch (error) {
        if (!LOCAL_FALLBACK_ENABLED) {
            throw error;
        }
        const appointments = storageGetJSON('appointments', []);
        return appointments
            .filter(a => a.date === date && a.status !== 'cancelled')
            .map(a => a.time);
    }
}

async function createAppointmentRecord(appointment, options = {}) {
    const allowLocalFallback = options.allowLocalFallback !== false;
    try {
        const payload = await apiRequest('appointments', {
            method: 'POST',
            body: appointment
        });
        const localAppointments = storageGetJSON('appointments', []);
        localAppointments.push(payload.data);
        storageSetJSON('appointments', localAppointments);
        return {
            appointment: payload.data,
            emailSent: payload.emailSent === true
        };
    } catch (error) {
        if (!LOCAL_FALLBACK_ENABLED || !allowLocalFallback) {
            throw error;
        }
        const localAppointments = storageGetJSON('appointments', []);
        const fallback = {
            ...appointment,
            id: Date.now(),
            status: 'confirmed',
            dateBooked: new Date().toISOString(),
            paymentStatus: appointment.paymentStatus || 'pending'
        };
        localAppointments.push(fallback);
        storageSetJSON('appointments', localAppointments);
        return {
            appointment: fallback,
            emailSent: false
        };
    }
}

async function createCallbackRecord(callback) {
    try {
        await apiRequest('callbacks', {
            method: 'POST',
            body: callback
        });
    } catch (error) {
        if (!LOCAL_FALLBACK_ENABLED) {
            throw error;
        }
        const callbacks = storageGetJSON('callbacks', []);
        callbacks.push(callback);
        storageSetJSON('callbacks', callbacks);
    }
}

async function createReviewRecord(review) {
    try {
        const payload = await apiRequest('reviews', {
            method: 'POST',
            body: review
        });
        return payload.data;
    } catch (error) {
        if (!LOCAL_FALLBACK_ENABLED) {
            throw error;
        }
        const localReviews = storageGetJSON('reviews', []);
        localReviews.unshift(review);
        storageSetJSON('reviews', localReviews);
        return review;
    }
}

async function loadPublicReviews() {
    try {
        const payload = await apiRequest('reviews');
        reviewsCache = Array.isArray(payload.data) ? payload.data : [];
    } catch (error) {
        reviewsCache = storageGetJSON('reviews', []);
    }
    renderPublicReviews(reviewsCache);
}

function getInitials(name) {
    const parts = String(name || 'Paciente')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2);
    if (parts.length === 0) return 'PA';
    return parts.map(part => part[0].toUpperCase()).join('');
}

function getRelativeDateLabel(dateText) {
    const date = new Date(dateText);
    if (Number.isNaN(date.getTime())) {
        return currentLang === 'es' ? 'Reciente' : 'Recent';
    }
    const now = new Date();
    const days = Math.max(0, Math.floor((now - date) / (1000 * 60 * 60 * 24)));
    if (currentLang === 'es') {
        if (days <= 1) return 'Hoy';
        if (days < 7) return `Hace ${days} d${days === 1 ? 'ia' : 'ias'}`;
        if (days < 30) return `Hace ${Math.floor(days / 7)} semana(s)`;
        return date.toLocaleDateString('es-EC');
    }
    if (days <= 1) return 'Today';
    if (days < 7) return `${days} day(s) ago`;
    if (days < 30) return `${Math.floor(days / 7)} week(s) ago`;
    return date.toLocaleDateString('en-US');
}

function renderStars(rating) {
    const value = Math.max(1, Math.min(5, Number(rating) || 0));
    let html = '';
    for (let i = 1; i <= 5; i += 1) {
        html += `<i class="${i <= value ? 'fas' : 'far'} fa-star"></i>`;
    }
    return html;
}

function renderPublicReviews(reviews) {
    const grid = document.querySelector('.reviews-grid');
    if (!grid || !Array.isArray(reviews) || reviews.length === 0) return;

    const topReviews = reviews.slice(0, 6);
    grid.innerHTML = topReviews.map(review => `
        <div class="review-card">
            <div class="review-header">
                <div class="review-avatar">${escapeHtml(getInitials(review.name))}</div>
                <div class="review-meta">
                    <h4>${escapeHtml(review.name || (currentLang === 'es' ? 'Paciente' : 'Patient'))}</h4>
                    <div class="review-stars">${renderStars(review.rating)}</div>
                </div>
            </div>
            <p class="review-text">"${escapeHtml(review.text || '')}"</p>
            <span class="review-date">${getRelativeDateLabel(review.date)}</span>
        </div>
    `).join('');

    const countLabel = document.querySelector('.rating-count');
    if (countLabel) {
        countLabel.textContent = currentLang === 'es'
            ? `${reviews.length} reseñas verificadas`
            : `${reviews.length} verified reviews`;
    }
}

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('language', lang);
    
    // Update buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    
    // Update all elements with data-i18n
    const htmlAllowedKeys = ['clinic_hours'];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (translations[lang][key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = translations[lang][key];
            } else if (htmlAllowedKeys.includes(key)) {
                el.innerHTML = translations[lang][key];
            } else {
                el.textContent = translations[lang][key];
            }
        }
    });

    if (reviewsCache.length > 0) {
        renderPublicReviews(reviewsCache);
    }
}

// ========================================
// MOBILE MENU
// ========================================
function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('active');
    document.body.style.overflow = menu.classList.contains('active') ? 'hidden' : '';
}

// ========================================
// VIDEO MODAL
// ========================================
function startWebVideo() {
    const modal = document.getElementById('videoModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeVideoModal() {
    const modal = document.getElementById('videoModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// ========================================
// GALLERY FILTER
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active button
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            
            // Filter items
            galleryItems.forEach(item => {
                if (filter === 'all' || item.dataset.category === filter) {
                    item.style.display = 'block';
                    setTimeout(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'scale(1)';
                    }, 10);
                } else {
                    item.style.opacity = '0';
                    item.style.transform = 'scale(0.9)';
                    setTimeout(() => {
                        item.style.display = 'none';
                    }, 300);
                }
            });
        });
    });
});

// ========================================
// BEFORE/AFTER SLIDER
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    const sliders = document.querySelectorAll('.ba-slider');
    
    sliders.forEach(slider => {
        const handle = slider.querySelector('.ba-handle');
        const after = slider.querySelector('.ba-after');
        let isDragging = false;
        
        const updateSlider = (x) => {
            const rect = slider.getBoundingClientRect();
            let percent = ((x - rect.left) / rect.width) * 100;
            percent = Math.max(0, Math.min(100, percent));
            
            after.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
            handle.style.left = `${percent}%`;
        };
        
        handle.addEventListener('mousedown', () => isDragging = true);
        document.addEventListener('mouseup', () => isDragging = false);
        document.addEventListener('mousemove', (e) => {
            if (isDragging) updateSlider(e.clientX);
        });
        
        // Touch support
        handle.addEventListener('touchstart', () => isDragging = true);
        document.addEventListener('touchend', () => isDragging = false);
        document.addEventListener('touchmove', (e) => {
            if (isDragging) updateSlider(e.touches[0].clientX);
        });
        
        // Click to move
        slider.addEventListener('click', (e) => {
            if (e.target !== handle) updateSlider(e.clientX);
        });
    });
});

// ========================================
// APPOINTMENT FORM & PRICING
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    const serviceSelect = document.getElementById('serviceSelect');
    const priceSummary = document.getElementById('priceSummary');
    const subtotalEl = document.getElementById('subtotalPrice');
    const ivaEl = document.getElementById('ivaPrice');
    const totalEl = document.getElementById('totalPrice');
    const dateInput = document.querySelector('input[name="date"]');
    const timeSelect = document.querySelector('select[name="time"]');
    const appointmentForm = document.getElementById('appointmentForm');

    if (!serviceSelect || !priceSummary || !subtotalEl || !ivaEl || !totalEl || !appointmentForm) {
        return;
    }

    serviceSelect.addEventListener('change', function() {
        const selected = this.options[this.selectedIndex];
        const price = parseFloat(selected.dataset.price) || 0;

        if (price > 0) {
            const iva = price * 0.12;
            const total = price + iva;
            subtotalEl.textContent = `$${price.toFixed(2)}`;
            ivaEl.textContent = `$${iva.toFixed(2)}`;
            totalEl.textContent = `$${total.toFixed(2)}`;
            priceSummary.style.display = 'block';
        } else {
            priceSummary.style.display = 'none';
        }

        updateAvailableTimes().catch(() => undefined);
    });

    if (dateInput) {
        dateInput.min = new Date().toISOString().split('T')[0];
        dateInput.addEventListener('change', () => updateAvailableTimes().catch(() => undefined));
    }

    async function updateAvailableTimes() {
        const selectedDate = dateInput?.value;
        if (!selectedDate || !timeSelect) return;

        const availability = await loadAvailabilityData();
        const bookedSlots = await getBookedSlots(selectedDate);
        const availableSlots = availability[selectedDate] || DEFAULT_TIME_SLOTS;
        const freeSlots = availableSlots.filter(slot => !bookedSlots.includes(slot));

        const currentValue = timeSelect.value;
        timeSelect.innerHTML = '<option value="">Hora</option>';

        if (freeSlots.length === 0) {
            timeSelect.innerHTML += '<option value="" disabled>No hay horarios disponibles</option>';
            showToast('No hay horarios disponibles para esta fecha', 'warning');
            return;
        }

        freeSlots.forEach(time => {
            const option = document.createElement('option');
            option.value = time;
            option.textContent = time;
            if (time === currentValue) option.selected = true;
            timeSelect.appendChild(option);
        });
    }

    appointmentForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const submitBtn = this.querySelector('button[type="submit"]');
        const originalContent = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

        try {
            const formData = new FormData(this);
            const appointment = {
                service: formData.get('service'),
                doctor: formData.get('doctor'),
                date: formData.get('date'),
                time: formData.get('time'),
                name: formData.get('name'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                price: totalEl.textContent
            };

            const bookedSlots = await getBookedSlots(appointment.date);
            if (bookedSlots.includes(appointment.time)) {
                showToast('Este horario ya fue reservado. Por favor selecciona otro.', 'error');
                await updateAvailableTimes();
                return;
            }

            currentAppointment = appointment;
            openPaymentModal(appointment);
        } catch (error) {
            showToast(error?.message || 'No se pudo preparar la reserva. Intenta nuevamente.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalContent;
        }
    });

    // Carga de disponibilidad diferida: se consulta cuando el usuario elige fecha/servicio.
});

// ========================================
// PAYMENT MODAL
// ========================================
function openPaymentModal(appointmentData) {
    const modal = document.getElementById('paymentModal');
    if (appointmentData) {
        currentAppointment = appointmentData;
    }
    const appointment = currentAppointment || {};

    document.getElementById('paymentTotal').textContent = appointment.price || '$0.00';
    clearPaymentError();
    resetTransferProofState();
    const cardNameInput = document.getElementById('cardholderName');
    if (cardNameInput && appointment.name) {
        cardNameInput.value = appointment.name;
    }
    if (stripeCardElement && typeof stripeCardElement.clear === 'function') {
        stripeCardElement.clear();
    }
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    refreshCardPaymentAvailability().catch(() => undefined);
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    clearPaymentError();
}

function getActivePaymentMethod() {
    const activeMethod = document.querySelector('.payment-method.active');
    return activeMethod?.dataset.method || 'cash';
}

function setPaymentError(message) {
    const errorEl = document.getElementById('paymentError');
    if (!errorEl) return;
    if (!message) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
        return;
    }
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function clearPaymentError() {
    setPaymentError('');
}

function resetTransferProofState() {
    const refInput = document.getElementById('transferReference');
    if (refInput) refInput.value = '';

    const proofInput = document.getElementById('transferProofFile');
    if (proofInput) proofInput.value = '';

    const fileNameEl = document.getElementById('transferProofFileName');
    if (fileNameEl) fileNameEl.textContent = '';
}

function updateTransferProofFileName() {
    const input = document.getElementById('transferProofFile');
    const fileNameEl = document.getElementById('transferProofFileName');
    if (!input || !fileNameEl) return;
    const file = input.files && input.files[0] ? input.files[0] : null;
    fileNameEl.textContent = file ? file.name : '';
}

function setCardMethodEnabled(enabled) {
    const cardMethod = document.querySelector('.payment-method[data-method="card"]');
    if (!cardMethod) return;

    cardMethod.classList.toggle('disabled', !enabled);
    cardMethod.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    cardMethod.title = enabled
        ? ''
        : 'Pago con tarjeta temporalmente no disponible';

    if (!enabled && cardMethod.classList.contains('active')) {
        const transferMethod = document.querySelector('.payment-method[data-method="transfer"]');
        const cashMethod = document.querySelector('.payment-method[data-method="cash"]');
        const fallback = transferMethod || cashMethod;
        if (fallback) {
            fallback.click();
        }
    }
}

async function refreshCardPaymentAvailability() {
    const config = await loadPaymentConfig();
    const enabled = config.enabled === true && typeof window.Stripe === 'function';
    setCardMethodEnabled(enabled);

    if (!enabled) {
        return false;
    }

    await mountStripeCardElement();
    return true;
}

async function mountStripeCardElement() {
    if (!paymentConfig.enabled || typeof window.Stripe !== 'function') {
        return;
    }
    if (!paymentConfig.publishableKey) {
        return;
    }

    if (!stripeClient) {
        stripeClient = window.Stripe(paymentConfig.publishableKey);
        stripeElements = stripeClient.elements();
    }

    if (!stripeElements) {
        throw new Error('No se pudo inicializar el formulario de tarjeta');
    }

    if (!stripeCardElement) {
        stripeCardElement = stripeElements.create('card', {
            hidePostalCode: true,
            style: {
                base: {
                    color: '#1d1d1f',
                    fontFamily: '"Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif',
                    fontSize: '16px',
                    '::placeholder': {
                        color: '#9aa6b2'
                    }
                },
                invalid: {
                    color: '#d14343'
                }
            }
        });
    }

    if (!stripeMounted) {
        stripeCardElement.mount('#stripeCardElement');
        stripeMounted = true;
    }
}

async function processCardPaymentFlow() {
    const cardAvailable = await refreshCardPaymentAvailability();
    if (!cardAvailable) {
        throw new Error('Pago con tarjeta no disponible en este momento.');
    }
    if (!stripeClient || !stripeCardElement) {
        throw new Error('No se pudo inicializar el formulario de tarjeta.');
    }

    const cardholderName = (document.getElementById('cardholderName')?.value || '').trim();
    if (cardholderName.length < 3) {
        throw new Error('Ingresa el nombre del titular de la tarjeta.');
    }

    const intent = await createPaymentIntent(currentAppointment);
    if (!intent.clientSecret || !intent.paymentIntentId) {
        throw new Error('No se pudo iniciar el cobro con tarjeta.');
    }

    const result = await stripeClient.confirmCardPayment(intent.clientSecret, {
        payment_method: {
            card: stripeCardElement,
            billing_details: {
                name: cardholderName,
                email: currentAppointment.email || undefined,
                phone: currentAppointment.phone || undefined
            }
        }
    });

    if (result.error) {
        throw new Error(result.error.message || 'No se pudo completar el pago con tarjeta.');
    }

    const paymentIntent = result.paymentIntent;
    if (!paymentIntent || paymentIntent.status !== 'succeeded') {
        throw new Error('El pago no fue confirmado por la pasarela.');
    }

    const verification = await verifyPaymentIntent(paymentIntent.id);
    if (!verification.paid) {
        throw new Error('No pudimos verificar el pago. Intenta nuevamente.');
    }

    const payload = {
        ...currentAppointment,
        paymentMethod: 'card',
        paymentStatus: 'paid',
        paymentProvider: 'stripe',
        paymentIntentId: paymentIntent.id,
        status: 'confirmed'
    };

    return createAppointmentRecord(payload, { allowLocalFallback: false });
}

async function processTransferPaymentFlow() {
    const transferReference = (document.getElementById('transferReference')?.value || '').trim();
    if (transferReference.length < 3) {
        throw new Error('Ingresa el numero de referencia de la transferencia.');
    }

    const proofInput = document.getElementById('transferProofFile');
    const proofFile = proofInput?.files && proofInput.files[0] ? proofInput.files[0] : null;
    if (!proofFile) {
        throw new Error('Adjunta el comprobante de transferencia.');
    }
    if (proofFile.size > 5 * 1024 * 1024) {
        throw new Error('El comprobante supera el limite de 5 MB.');
    }

    const upload = await uploadTransferProof(proofFile);
    const payload = {
        ...currentAppointment,
        paymentMethod: 'transfer',
        paymentStatus: 'pending_transfer_review',
        transferReference,
        transferProofPath: upload.transferProofPath || '',
        transferProofUrl: upload.transferProofUrl || '',
        transferProofName: upload.transferProofName || '',
        transferProofMime: upload.transferProofMime || '',
        status: 'confirmed'
    };

    return createAppointmentRecord(payload, { allowLocalFallback: false });
}

async function processCashPaymentFlow() {
    const payload = {
        ...currentAppointment,
        paymentMethod: 'cash',
        paymentStatus: 'pending_cash',
        status: 'confirmed'
    };

    return createAppointmentRecord(payload);
}

// Payment method selection
document.addEventListener('DOMContentLoaded', function() {
    const paymentMethods = document.querySelectorAll('.payment-method');
    const paymentForms = document.querySelectorAll('.payment-form');

    paymentMethods.forEach(method => {
        method.addEventListener('click', () => {
            if (method.classList.contains('disabled')) {
                showToast('Pago con tarjeta no disponible por el momento.', 'warning');
                return;
            }

            paymentMethods.forEach(m => m.classList.remove('active'));
            method.classList.add('active');

            const methodType = method.dataset.method;
            paymentForms.forEach(form => form.style.display = 'none');
            const form = document.querySelector(`.${methodType}-form`);
            if (form) {
                form.style.display = 'block';
            }
            clearPaymentError();

            if (methodType === 'card') {
                mountStripeCardElement().catch(error => {
                    setPaymentError(error?.message || 'No se pudo cargar el formulario de tarjeta');
                });
            }
        });
    });

    const transferProofInput = document.getElementById('transferProofFile');
    if (transferProofInput) {
        transferProofInput.addEventListener('change', updateTransferProofFileName);
    }
});

let isPaymentProcessing = false;
async function processPayment() {
    if (isPaymentProcessing) return;
    isPaymentProcessing = true;

    const btn = document.querySelector('#paymentModal .btn-primary');
    if (!btn) { isPaymentProcessing = false; return; }

    const originalContent = btn.innerHTML;
    let paymentMethodUsed = 'cash';

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

    try {
        if (!currentAppointment) {
            showToast('Primero completa el formulario de cita.', 'warning');
            return;
        }

        const paymentMethod = getActivePaymentMethod();
        paymentMethodUsed = paymentMethod;
        clearPaymentError();

        let result;
        if (paymentMethod === 'card') {
            result = await processCardPaymentFlow();
        } else if (paymentMethod === 'transfer') {
            result = await processTransferPaymentFlow();
        } else {
            result = await processCashPaymentFlow();
        }

        currentAppointment = result.appointment;

        closePaymentModal();
        showSuccessModal(result.emailSent === true);
        showToast(
            paymentMethod === 'card'
                ? 'Pago aprobado y cita registrada.'
                : 'Cita registrada correctamente.',
            'success'
        );

        const form = document.getElementById('appointmentForm');
        if (form) form.reset();

        const summary = document.getElementById('priceSummary');
        if (summary) summary.style.display = 'none';
    } catch (error) {
        let message = error?.message || 'No se pudo registrar la cita. Intenta nuevamente.';
        if (
            paymentMethodUsed === 'card'
            && /horario ya fue reservado/i.test(message)
        ) {
            message = 'El pago fue aprobado, pero el horario acaba de ocuparse. Escribenos por WhatsApp para resolverlo de inmediato: +593 98 245 3672.';
        }
        setPaymentError(message);
        showToast(message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
        isPaymentProcessing = false;
    }
}

// ========================================
// SUCCESS MODAL
// ========================================
function showSuccessModal(emailSent = false) {
    const modal = document.getElementById('successModal');
    const appointment = currentAppointment || {};
    const detailsDiv = document.getElementById('appointmentDetails');
    const successDesc = modal.querySelector('[data-i18n="success_desc"]');

    if (successDesc) {
        if (emailSent) {
            successDesc.textContent = currentLang === 'es'
                ? 'Enviamos un correo de confirmacion con los detalles de tu cita.'
                : 'A confirmation email with your appointment details was sent.';
        } else {
            successDesc.textContent = currentLang === 'es'
                ? 'Tu cita fue registrada. Te contactaremos para confirmar detalles.'
                : 'Your appointment was saved. We will contact you to confirm details.';
        }
    }
    
    // Generate Google Calendar link
    const startDate = new Date(`${appointment.date}T${appointment.time}`);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration
    
    const googleCalendarUrl = generateGoogleCalendarUrl(appointment, startDate, endDate);
    const icsContent = generateICS(appointment, startDate, endDate);
    const icsBlob = new Blob([icsContent], { type: 'text/calendar' });
    const icsUrl = URL.createObjectURL(icsBlob);
    
    detailsDiv.innerHTML = `
        <div style="background: #f5f5f7; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: left;">
            <p style="margin-bottom: 8px;"><strong>${currentLang === 'es' ? 'Doctor:' : 'Doctor:'}</strong> ${escapeHtml(getDoctorName(appointment.doctor))}</p>
            <p style="margin-bottom: 8px;"><strong>${currentLang === 'es' ? 'Fecha:' : 'Date:'}</strong> ${escapeHtml(appointment.date || '-')}</p>
            <p style="margin-bottom: 8px;"><strong>${currentLang === 'es' ? 'Hora:' : 'Time:'}</strong> ${escapeHtml(appointment.time || '-')}</p>
            <p style="margin-bottom: 8px;"><strong>${currentLang === 'es' ? 'Pago:' : 'Payment:'}</strong> ${escapeHtml(getPaymentMethodLabel(appointment.paymentMethod))} - ${escapeHtml(getPaymentStatusLabel(appointment.paymentStatus))}</p>
            <p><strong>${currentLang === 'es' ? 'Total:' : 'Total:'}</strong> ${escapeHtml(appointment.price || '$0.00')}</p>
        </div>
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <a href="${googleCalendarUrl}" target="_blank" class="btn btn-secondary" style="flex: 1;">
                <i class="fab fa-google"></i> Google Calendar
            </a>
            <a href="${icsUrl}" download="cita-piel-en-armonia.ics" class="btn btn-secondary" style="flex: 1;">
                <i class="fas fa-calendar-alt"></i> Outlook/Apple
            </a>
        </div>
    `;
    
    modal.classList.add('active');
}

function getDoctorName(doctor) {
    const names = {
        rosero: 'Dr. Javier Rosero',
        narvaez: 'Dra. Carolina Narvaez',
        indiferente: 'Primera disponible'
    };
    return names[doctor] || doctor;
}

function getPaymentMethodLabel(method) {
    const map = {
        card: currentLang === 'es' ? 'Tarjeta' : 'Card',
        transfer: currentLang === 'es' ? 'Transferencia' : 'Transfer',
        cash: currentLang === 'es' ? 'Efectivo' : 'Cash',
        unpaid: currentLang === 'es' ? 'Pendiente' : 'Pending'
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
    const map = currentLang === 'es' ? es : en;
    return map[key] || (status || map.pending);
}

function generateGoogleCalendarUrl(appointment, startDate, endDate) {
    const formatDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const title = encodeURIComponent(`Cita - Piel en Armonía`);
    const details = encodeURIComponent(`Servicio: ${getServiceName(appointment.service)}\nDoctor: ${getDoctorName(appointment.doctor)}\nPrecio: ${appointment.price}`);
    const location = encodeURIComponent('Valparaiso 13-183 y Sodiro, Quito, Ecuador');
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDate(startDate)}/${formatDate(endDate)}&details=${details}&location=${location}`;
}

function generateICS(appointment, startDate, endDate) {
    const formatICSDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0];
    
    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Piel en Armonía//Consulta//ES
BEGIN:VEVENT
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:Cita - Piel en Armonía
DESCRIPTION:Servicio: ${getServiceName(appointment.service)}\\nDoctor: ${getDoctorName(appointment.doctor)}\\nPrecio: ${appointment.price}
LOCATION:Valparaiso 13-183 y Sodiro, Quito, Ecuador
END:VEVENT
END:VCALENDAR`;
}

function getServiceName(service) {
    const names = {
        consulta: 'Consulta Dermatológica',
        telefono: 'Consulta Telefónica',
        video: 'Video Consulta',
        laser: 'Tratamiento Láser',
        rejuvenecimiento: 'Rejuvenecimiento'
    };
    return names[service] || service;
}

function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// ========================================
// CALLBACK FORM
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    const callbackForm = document.getElementById('callbackForm');
    if (callbackForm) {
        callbackForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalContent = submitBtn.innerHTML;
            
            // Loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
            
            const formData = new FormData(this);
            const callback = {
                id: Date.now(),
                telefono: formData.get('telefono'),
                preferencia: formData.get('preferencia'),
                fecha: new Date().toISOString(),
                status: 'pendiente'
            };
            
            try {
                await createCallbackRecord(callback);
                showToast(
                    currentLang === 'es'
                        ? 'Solicitud enviada. Te llamaremos pronto.'
                        : 'Request sent. We will call you soon.',
                    'success'
                );
                this.reset();
            } catch (error) {
                showToast(
                    currentLang === 'es'
                        ? 'No se pudo enviar tu solicitud. Intenta de nuevo.'
                        : 'We could not send your request. Try again.',
                    'error'
                );
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalContent;
            }
        });
    }
});

// ========================================
// REVIEW MODAL
// ========================================
function openReviewModal() {
    const modal = document.getElementById('reviewModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeReviewModal() {
    const modal = document.getElementById('reviewModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal') && e.target.classList.contains('active')) {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Star rating
document.addEventListener('DOMContentLoaded', function() {
    const stars = document.querySelectorAll('.star-rating i');
    let selectedRating = 0;

    stars.forEach((star, index) => {
        star.addEventListener('click', () => {
            selectedRating = index + 1;
            stars.forEach((s, i) => {
                s.classList.toggle('active', i < selectedRating);
                s.classList.toggle('far', i >= selectedRating);
                s.classList.toggle('fas', i < selectedRating);
            });
        });
    });

    const reviewForm = document.getElementById('reviewForm');
    if (!reviewForm) return;

    reviewForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (selectedRating === 0) {
            alert(currentLang === 'es' ? 'Por favor selecciona una calificacion' : 'Please select a rating');
            return;
        }

        const formData = new FormData(this);
        const review = {
            id: Date.now(),
            name: formData.get('reviewerName'),
            rating: selectedRating,
            text: formData.get('reviewText'),
            date: new Date().toISOString(),
            verified: true
        };

        try {
            const savedReview = await createReviewRecord(review);
            reviewsCache = [savedReview, ...reviewsCache.filter(item => item.id !== savedReview.id)];
            renderPublicReviews(reviewsCache);

            showToast(
                currentLang === 'es' ? 'Gracias por tu reseña.' : 'Thank you for your review.',
                'success'
            );

            closeReviewModal();
            this.reset();
            selectedRating = 0;
            stars.forEach(s => {
                s.classList.remove('active', 'fas');
                s.classList.add('far');
            });
        } catch (error) {
            showToast(
                currentLang === 'es'
                    ? 'No pudimos guardar tu reseña. Intenta nuevamente.'
                    : 'We could not save your review. Try again.',
                'error'
            );
        }
    });
});

// MODAL CLOSE HANDLERS
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    // Close on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });
    
    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.remove('active');
            });
            document.body.style.overflow = '';
            toggleMobileMenu(false);
        }
    });
});

// ========================================
// SCROLL ANIMATIONS
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.service-card, .tele-card, .team-card, .gallery-item, .review-card').forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });
});

// ========================================
// NAVBAR SCROLL
// ========================================
let lastScroll = 0;
const nav = document.querySelector('.nav');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        nav.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.08)';
    } else {
        nav.style.boxShadow = 'none';
    }
    
    lastScroll = currentScroll;
});

// ========================================
// SMOOTH SCROLL
// ========================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href !== '#') {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const navHeight = nav.offsetHeight;
                const targetPosition = target.offsetTop - navHeight - 20;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        }
    });
});

// ========================================
// CHATBOT CON FIGO
// ========================================
let chatbotOpen = false;
let chatHistory = (function() {
    try {
        const raw = localStorage.getItem('chatHistory');
        const saved = raw ? JSON.parse(raw) : [];
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const valid = saved.filter(m => m.time && new Date(m.time).getTime() > cutoff);
        if (valid.length !== saved.length) {
            try { localStorage.setItem('chatHistory', JSON.stringify(valid)); } catch(e) {}
        }
        return valid;
    } catch(e) { return []; }
})();
let conversationContext = [];

// CONFIGURACIÓN DE CHAT
const KIMI_CONFIG = {
    apiUrl: '/figo-chat.php',
    model: 'figo-assistant',
    maxTokens: 1000,
    temperature: 0.7
};

// Funcion simple para detectar si usar IA real
function shouldUseRealAI() {
    if (localStorage.getItem('forceAI') === 'true') {
        return true;
    }
    
    var protocol = window.location.protocol;
    
    if (protocol === 'file:') {
        return false;
    }

    return true;
}

// Contexto del sistema para el asistente
const SYSTEM_PROMPT = `Eres el Dr. Virtual, asistente inteligente de la clínica dermatológica "Piel en Armonía" en Quito, Ecuador.

INFORMACIÓN DE LA CLÍNICA:
- Nombre: Piel en Armonía
- Doctores: Dr. Javier Rosero (Dermatólogo Clínico) y Dra. Carolina Narváez (Dermatóloga Estética)
- Dirección: Valparaíso 13-183 y Sodiro, Quito, Ecuador
- Teléfono/WhatsApp: +593 98 245 3672
- Horario: Lunes-Viernes 9:00-18:00, Sábados 9:00-13:00
- Estacionamiento privado disponible

SERVICIOS Y PRECIOS:
- Consulta Dermatológica: $40 (incluye IVA)
- Consulta Telefónica: $25
- Video Consulta: $30
- Tratamiento Láser: desde $150
- Rejuvenecimiento: desde $120
- Tratamiento de Acné: desde $80
- Detección de Cáncer de Piel: desde $70

OPCIONES DE CONSULTA ONLINE:
1. Llamada telefónica: tel:+593982453672
2. WhatsApp Video: https://wa.me/593982453672
3. Video Web (Jitsi): https://meet.jit.si/PielEnArmonia-Consulta

INSTRUCCIONES:
- Sé profesional, amable y empático
- Responde en español (o en el idioma que use el paciente)
- Si el paciente tiene síntomas graves o emergencias, recomienda acudir a urgencias
- Para agendar citas, dirige al formulario web, WhatsApp o llamada telefónica
- Si no sabes algo específico, ofrece transferir al doctor real
- No hagas diagnósticos médicos definitivos, solo orientación general
- Usa emojis ocasionalmente para ser amigable
- Mantén respuestas concisas pero informativas

Tu objetivo es ayudar a los pacientes a:
1. Conocer los servicios de la clínica
2. Entender los precios
3. Agendar citas
4. Resolver dudas básicas sobre dermatología
5. Conectar con un doctor real cuando sea necesario`;

function toggleChatbot() {
    const container = document.getElementById('chatbotContainer');
    chatbotOpen = !chatbotOpen;
    
    if (chatbotOpen) {
        container.classList.add('active');
        document.getElementById('chatNotification').style.display = 'none';
        scrollToBottom();
        
        // Si es la primera vez, mostrar mensaje inicial
        if (chatHistory.length === 0) {
            // Verificar si estamos usando IA real
            const usandoIA = shouldUseRealAI();
            
            debugLog('🤖 Estado del chatbot:', usandoIA ? 'IA REAL' : 'Respuestas locales');
            
            var welcomeMsg;
            
            if (usandoIA) {
                welcomeMsg = '¡Hola! Soy el <strong>Dr. Virtual</strong> de <strong>Piel en Armonía</strong>.<br><br>';
                welcomeMsg += '<strong>Conectado con Inteligencia Artificial</strong><br><br>';
                welcomeMsg += 'Puedo ayudarte con información detallada sobre:<br>';
                welcomeMsg += '• Nuestros servicios dermatologicos<br>';
                welcomeMsg += '• Precios de consultas y tratamientos<br>';
                welcomeMsg += '• Agendar citas presenciales o online<br>';
                welcomeMsg += '• Ubicacion y horarios de atencion<br>';
                welcomeMsg += '• Resolver tus dudas sobre cuidado de la piel<br><br>';
                welcomeMsg += '¿En que puedo ayudarte hoy?';
            } else {
                welcomeMsg = '¡Hola! Soy el <strong>Dr. Virtual</strong> de <strong>Piel en Armonía</strong>.<br><br>';
                welcomeMsg += 'Puedo ayudarte con información sobre:<br>';
                welcomeMsg += '• Nuestros servicios dermatologicos<br>';
                welcomeMsg += '• Precios de consultas y tratamientos<br>';
                welcomeMsg += '• Agendar citas presenciales o online<br>';
                welcomeMsg += '• Ubicacion y horarios de atencion<br><br>';
                welcomeMsg += '¿En que puedo ayudarte hoy?';
            }
            
            addBotMessage(welcomeMsg);
            
            // Sugerir opciones rapidas
            setTimeout(function() {
                var quickOptions = '<div class="chat-suggestions">';
                quickOptions += '<button class="chat-suggestion-btn" onclick="sendQuickMessage(\'services\')">';
                quickOptions += '<i class="fas fa-stethoscope"></i> Ver servicios';
                quickOptions += '</button>';
                quickOptions += '<button class="chat-suggestion-btn" onclick="sendQuickMessage(\'appointment\')">';
                quickOptions += '<i class="fas fa-calendar-check"></i> Agendar cita';
                quickOptions += '</button>';
                quickOptions += '<button class="chat-suggestion-btn" onclick="sendQuickMessage(\'prices\')">';
                quickOptions += '<i class="fas fa-tag"></i> Consultar precios';
                quickOptions += '</button>';
                quickOptions += '</div>';
                addBotMessage(quickOptions);
            }, 500);
        }
    } else {
        container.classList.remove('active');
    }
}

function minimizeChatbot() {
    document.getElementById('chatbotContainer').classList.remove('active');
    chatbotOpen = false;
}

function handleChatKeypress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    addUserMessage(message);
    input.value = '';

    await processWithKimi(message);
}

function sendQuickMessage(type) {
    const messages = {
        services: '¿Qué servicios ofrecen?',
        appointment: 'Quiero agendar una cita',
        prices: '¿Cuáles son los precios?',
        telemedicine: '¿Cómo funciona la consulta online?',
        human: 'Quiero hablar con un doctor real',
        acne: 'Tengo problemas de acné',
        laser: 'Información sobre tratamientos láser',
        location: '¿Dónde están ubicados?'
    };
    
    const message = messages[type] || type;
    addUserMessage(message);

    processWithKimi(message);
}

function addUserMessage(text) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message user';
    messageDiv.innerHTML = `
        <div class="message-avatar"><i class="fas fa-user"></i></div>
        <div class="message-content"><p>${escapeHtml(text)}</p></div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    chatHistory.push({ type: 'user', text, time: new Date().toISOString() });
    try { localStorage.setItem('chatHistory', JSON.stringify(chatHistory)); } catch(e) {}

    // Agregar al contexto de conversación (evitar duplicados)
    const lastMsg = conversationContext[conversationContext.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== text) {
        conversationContext.push({ role: 'user', content: text });
    }
}

function sanitizeBotHtml(html) {
    const allowed = ['b', 'strong', 'i', 'em', 'br', 'p', 'ul', 'ol', 'li', 'a'];
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('script, style, iframe, object, embed').forEach(el => el.remove());
    div.querySelectorAll('*').forEach(el => {
        if (!allowed.includes(el.tagName.toLowerCase())) {
            el.replaceWith(document.createTextNode(el.textContent));
        } else {
            Array.from(el.attributes).forEach(attr => {
                if (el.tagName === 'A' && ['href', 'target', 'onclick'].includes(attr.name)) return;
                el.removeAttribute(attr.name);
            });
            if (el.tagName === 'A') {
                const href = el.getAttribute('href') || '';
                if (!/^https?:\/\/|^#/.test(href)) el.removeAttribute('href');
                if (href.startsWith('http')) {
                    el.setAttribute('target', '_blank');
                    el.setAttribute('rel', 'noopener noreferrer');
                }
            }
        }
    });
    return div.innerHTML;
}

function addBotMessage(html, showOfflineLabel = false) {
    const messagesContainer = document.getElementById('chatMessages');
    const safeHtml = sanitizeBotHtml(html);

    // Verificar si el ultimo mensaje es identico (evitar duplicados en UI)
    const lastMessage = messagesContainer.querySelector('.chat-message.bot:last-child');
    if (lastMessage) {
        const lastContent = lastMessage.querySelector('.message-content');
        if (lastContent && lastContent.innerHTML === safeHtml) {
            debugLog('⚠️ Mensaje duplicado detectado, no se muestra');
            return;
        }
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message bot';
    
    // Solo mostrar indicador offline si se solicita explícitamente (para debug)
    const offlineIndicator = showOfflineLabel ? 
        `<div style="font-size: 0.7rem; color: #86868b; margin-bottom: 4px; opacity: 0.7;">
            <i class="fas fa-robot"></i> Asistente Virtual
        </div>` : '';
    
    messageDiv.innerHTML = `
        <div class="message-avatar"><i class="fas fa-user-md"></i></div>
        <div class="message-content">${offlineIndicator}${safeHtml}</div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    
    // Guardar en historial
    chatHistory.push({ type: 'bot', text: safeHtml, time: new Date().toISOString() });
    try { localStorage.setItem('chatHistory', JSON.stringify(chatHistory)); } catch(e) {}
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message bot typing';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div class="message-avatar"><i class="fas fa-user-md"></i></div>
        <div class="typing-indicator">
            <span></span><span></span><span></span>
        </div>
    `;
    messagesContainer.appendChild(typingDiv);
    scrollToBottom();
}

function removeTypingIndicator() {
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
}

function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// INTEGRACIÓN CON BOT DEL SERVIDOR
// ========================================
let isProcessingMessage = false; // Evitar duplicados
async function processWithKimi(message) {
    if (isProcessingMessage) {
        debugLog('⏳ Ya procesando, ignorando duplicado');
        return;
    }
    isProcessingMessage = true;
    
    showTypingIndicator();

    if (isOutOfScopeIntent(message)) {
        removeTypingIndicator();
        addBotMessage(`Puedo ayudarte con temas de <strong>Piel en Armonía</strong> (servicios, precios, citas, pagos, horarios y ubicación).<br><br>Si deseas, te ayudo ahora con:<br>- <a href="#servicios" onclick="minimizeChatbot()">Servicios y tratamientos</a><br>- <a href="#citas" onclick="minimizeChatbot()">Reservar cita</a><br>- <a href="https://wa.me/593982453672" target="_blank">WhatsApp directo</a>`, false);
        isProcessingMessage = false;
        return;
    }
    
    // Prioriza IA real cuando el servidor esta disponible.
    // Si falla la conexion, usa fallback local para no romper la experiencia.
    debugLog('📝 Procesando mensaje:', message);
    
    try {
        if (shouldUseRealAI()) {
            debugLog('🤖 Consultando bot del servidor...');
            await tryRealAI(message);
        } else {
            debugLog('💬 Usando respuestas locales (modo offline)');
            setTimeout(() => {
                removeTypingIndicator();
                processLocalResponse(message, false);
            }, 600);
        }
    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();
        processLocalResponse(message, false);
    } finally {
        isProcessingMessage = false;
    }
}

function normalizeIntentText(text) {
    if (!text) return '';

    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function isPaymentIntent(text) {
    const normalized = normalizeIntentText(text);
    return /(pago|pagar|metodo de pago|tarjeta|transferencia|efectivo|deposito|comprobante|referencia|factura|visa|mastercard)/.test(normalized);
}

function isHighValueClinicIntent(text) {
    const normalized = normalizeIntentText(text);
    return isPaymentIntent(normalized) || /(cita|agendar|reservar|turno|hora|precio|cuanto cuesta|valor|tarifa|costo|servicio|tratamiento)/.test(normalized);
}

function isClinicScopeIntent(text) {
    const normalized = normalizeIntentText(text);
    if (!normalized) return true;

    const clinicScopePattern = /(piel|dermat|acne|grano|espinilla|mancha|lesion|consulta|cita|agendar|reservar|turno|doctor|dra|dr|rosero|narvaez|quito|ubicación|dirección|horario|precio|costo|tarifa|pago|pagar|transferencia|efectivo|tarjeta|whatsapp|teléfono|telemedicina|video|laser|rejuvenecimiento|cancer|consultorio|servicio|tratamiento)/;
    return clinicScopePattern.test(normalized);
}

function isOutOfScopeIntent(text) {
    const normalized = normalizeIntentText(text);
    if (!normalized) return false;

    if (/^(hola|buenos dias|buenas tardes|buenas noches|hi|hello|gracias|adios|bye|ok|vale)$/.test(normalized)) {
        return false;
    }

    if (isClinicScopeIntent(normalized)) {
        return false;
    }

    return /(capital|presidente|deporte|futbol|partido|clima|temperatura|noticia|historia|geografia|matematica|programacion|codigo|traduce|traducir|pelicula|musica|bitcoin|criptomoneda|politica)/.test(normalized);
}

function isGenericAssistantReply(text) {
    const normalized = normalizeIntentText(text);
    if (!normalized) return true;

    const genericPatterns = [
        /gracias por tu mensaje/,
        /puedo ayudarte con piel en armonia/,
        /soy figo/,
        /asistente virtual/,
        /modo offline/,
        /te sugiero/,
        /para información más detallada/,
        /escribenos por whatsapp/,
        /visita estas secciones/,
        /hay algo mas en lo que pueda orientarte/
    ];

    let matches = 0;
    for (const pattern of genericPatterns) {
        if (pattern.test(normalized)) matches += 1;
    }

    return matches >= 2;
}

function shouldRefineWithFigo(userMessage, botResponse) {
    return isHighValueClinicIntent(userMessage) && isGenericAssistantReply(botResponse);
}

const FIGO_EXPERT_PROMPT = `MODO FIGO PRO:
- Responde con pasos claros y accionables, no con texto general.
- Si preguntan por pagos, explica el flujo real del sitio: reservar cita -> modal de pago -> metodo (tarjeta/transferencia/efectivo) -> confirmacion.
- Si faltan datos para ayudar mejor, haz una sola pregunta de seguimiento concreta.
- Mantente enfocado en Piel en Armonía (servicios, precios, citas, pagos, ubicación y contacto).
- Si preguntan temas fuera de la clínica (capitales, noticias, deportes o cultura general), explica que solo atiendes temas de Piel en Armonía y redirige a servicios/citas.
- Evita decir "modo offline" salvo que realmente no haya conexion con el servidor.`;

function buildAppointmentContextSummary() {
    if (!currentAppointment) return 'sin cita activa';

    const parts = [];
    if (currentAppointment.service) parts.push(`servicio=${currentAppointment.service}`);
    if (currentAppointment.doctor) parts.push(`doctor=${currentAppointment.doctor}`);
    if (currentAppointment.date) parts.push(`fecha=${currentAppointment.date}`);
    if (currentAppointment.time) parts.push(`hora=${currentAppointment.time}`);
    if (currentAppointment.price) parts.push(`precio=${currentAppointment.price}`);

    return parts.length ? parts.join(', ') : 'sin datos relevantes';
}

function getChatRuntimeContext() {
    const section = window.location.hash || '#inicio';
    const paymentModalOpen = !!document.getElementById('paymentModal')?.classList.contains('active');
    const appointmentSummary = buildAppointmentContextSummary();

    return `CONTEXTO WEB EN TIEMPO REAL:
- Seccion actual: ${section}
- Modal de pago abierto: ${paymentModalOpen ? 'si' : 'no'}
- Cita en progreso: ${appointmentSummary}

FLUJO DE PAGO REAL DEL SITIO:
1) El paciente completa el formulario de cita.
2) Se abre el modal de pago automaticamente.
3) Puede elegir tarjeta, transferencia o efectivo.
4) Al confirmar, la cita se registra y el equipo valida por WhatsApp.`;
}

function buildFigoMessages() {
    return [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: FIGO_EXPERT_PROMPT },
        { role: 'system', content: getChatRuntimeContext() },
        ...conversationContext.slice(-10)
    ];
}

async function requestFigoCompletion(messages, overrides = {}, debugLabel = 'principal') {
    const payload = {
        model: KIMI_CONFIG.model,
        messages: messages,
        max_tokens: KIMI_CONFIG.maxTokens,
        temperature: KIMI_CONFIG.temperature,
        ...overrides
    };

    const controller = new AbortController();
    const timeoutMs = 9000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
        response = await fetch(KIMI_CONFIG.apiUrl + '?t=' + Date.now(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
    } catch (error) {
        if (error && error.name === 'AbortError') {
            throw new Error('TIMEOUT');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }

    debugLog(`📡 Status (${debugLabel}):`, response.status);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const responseText = await response.text();
    debugLog(`📄 Respuesta cruda (${debugLabel}):`, responseText.substring(0, 500));

    let data;
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        console.error('❌ Error parseando JSON:', e);
        throw new Error('Respuesta no es JSON valido');
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('❌ Estructura invalida:', data);
        throw new Error('Respuesta invalida');
    }

    return data.choices[0].message.content;
}

async function tryRealAI(message) {
    try {
        // Limpiar duplicados del contexto antes de enviar
        const uniqueContext = [];
        for (const msg of conversationContext) {
            const last = uniqueContext[uniqueContext.length - 1];
            if (!last || last.role !== msg.role || last.content !== msg.content) {
                uniqueContext.push(msg);
            }
        }
        conversationContext = uniqueContext;
        
        // Preparar mensajes para la API
        const messages = buildFigoMessages();
        
        debugLog('🚀 Enviando a:', KIMI_CONFIG.apiUrl);
        debugLog('📊 Contexto actual:', conversationContext.length, 'mensajes');
        let botResponse = await requestFigoCompletion(messages, {}, 'principal');
        debugLog('✅ Respuesta recibida:', botResponse.substring(0, 100) + '...');

        if (shouldRefineWithFigo(message, botResponse)) {
            debugLog('⚠️ Respuesta generica detectada, solicitando precision adicional a Figo');

            const precisionPrompt = `Tu respuesta anterior fue demasiado general.
Responde con información específica para la web de Piel en Armonía.
Incluye pasos concretos y el siguiente paso recomendado para el paciente.
Pregunta original del paciente: "${message}"`;

            const refinedMessages = [
                ...messages,
                { role: 'assistant', content: botResponse },
                { role: 'user', content: precisionPrompt }
            ];

            try {
                const refinedResponse = await requestFigoCompletion(
                    refinedMessages,
                    { temperature: 0.3 },
                    'refinada'
                );

                if (refinedResponse && !isGenericAssistantReply(refinedResponse)) {
                    botResponse = refinedResponse;
                    debugLog('✅ Respuesta refinada aplicada');
                }
            } catch (refineError) {
                console.warn('⚠️ No se pudo refinar con Figo:', refineError);
            }

            if (isGenericAssistantReply(botResponse)) {
                debugLog('⚠️ Respuesta sigue generica, usando fallback local especializado');
                removeTypingIndicator();
                processLocalResponse(message, false);
                return;
            }
        }
        
        // Evitar duplicados: verificar si el último mensaje ya es del asistente con el mismo contenido
        const lastMsg = conversationContext[conversationContext.length - 1];
        if (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.content !== botResponse) {
            conversationContext.push({ role: 'assistant', content: botResponse });
        }
        
        removeTypingIndicator();
        addBotMessage(formatMarkdown(botResponse), false);
        debugLog('💬 Mensaje mostrado en chat');
        
    } catch (error) {
        console.error('❌ Error con bot del servidor:', error);
        removeTypingIndicator();
        
        // Mostrar error específico
        if (error.message.includes('HTTP 503')) {
            processLocalResponse(message, false);
        } else if (error.message.includes('TIMEOUT')) {
            processLocalResponse(message, false);
        } else if (error.message.includes('Failed to fetch')) {
            processLocalResponse(message, false);
        } else {
            processLocalResponse(message, false);
        }
    }
}

// ========================================
// SISTEMA DE RESPUESTAS LOCALES (FALLBACK)
// ========================================
function processLocalResponse(message, isOffline = true) {
    const lowerMsg = message.toLowerCase();
    const normalizedMsg = normalizeIntentText(message);
    
    // Comando especial: forzar IA
    if (/forzar ia|activar ia|modo ia|usar ia/.test(normalizedMsg)) {
        forzarModoIA();
        return;
    }
    
    // Comando especial: debug info
    if (/debug|info sistema|información técnica/.test(normalizedMsg)) {
        mostrarInfoDebug();
        return;
    }
    
    // Intentar detectar intención y dar respuesta local
    let response = null;
    
    // AYUDA / MENU
    if (/ayuda|help|menu|opciones|que puedes hacer/.test(lowerMsg)) {
        response = 'Opciones disponibles:<br><br>';
        response += '<strong>Servicios:</strong> Información sobre consultas<br>';
        response += '<strong>Precios:</strong> Tarifas de servicios<br>';
        response += '<strong>Citas:</strong> Como agendar<br>';
        response += '<strong>Ubicación:</strong> Dirección y horarios<br>';
        response += '<strong>Contacto:</strong> WhatsApp y teléfono';
    }
    // FUERA DE ALCANCE
    else if (isOutOfScopeIntent(normalizedMsg)) {
        response = `Puedo ayudarte solo con temas de <strong>Piel en Armonía</strong>.<br><br>
Puedes consultarme sobre:<br>
- Servicios y tratamientos dermatologicos<br>
- Precios y formas de pago<br>
- Agenda de citas y horarios<br>
- Ubicacion y contacto<br><br>
Si quieres, te llevo directo a <a href="#citas" onclick="minimizeChatbot()">Reservar Cita</a> o te conecto por <a href="https://wa.me/593982453672" target="_blank">WhatsApp</a>.`;
        addBotMessage(response, isOffline);
        return;
    }
    // SALUDO
    else if (/hola|buenos dias|buenas tardes|buenas noches|hey|hi|hello/.test(lowerMsg)) {
        response = '¡Hola! Soy el asistente de <strong>Piel en Armonía</strong>.<br><br>';
        response += 'Puedo ayudarte con:<br>';
        response += '• Servicios dermatologicos<br>';
        response += '• Precios de tratamientos<br>';
        response += '• Agendar citas<br>';
        response += '• Ubicacion y horarios<br><br>';
        response += '¿En que puedo ayudarte?';
    }
    // SERVICIOS
    else if (/servicio|tratamiento|hacen|ofrecen|que hacen/.test(lowerMsg)) {
        response = 'Servicios dermatologicos:<br><br>';
        response += '<strong>Consultas:</strong><br>';
        response += '• Presencial: $40<br>';
        response += '• Telefonica: $25<br>';
        response += '• Video: $30<br><br>';
        response += '<strong>Tratamientos:</strong><br>';
        response += '• Acne: desde $80<br>';
        response += '• Laser: desde $150<br>';
        response += '• Rejuvenecimiento: desde $120<br>';
        response += '• Detección de cáncer de piel: desde $70';
    }
    // PRECIOS
    else if (/precio|cuanto cuesta|valor|tarifa|costo/.test(lowerMsg)) {
        response = 'Precios (incluyen IVA 12%):<br><br>';
        response += '<strong>Consultas:</strong><br>';
        response += '• Presencial: $40<br>';
        response += '• Telefonica: $25<br>';
        response += '• Video: $30<br><br>';
        response += '<strong>Tratamientos (desde):</strong><br>';
        response += '• Acne: $80<br>';
        response += '• Laser: $150<br>';
        response += '• Rejuvenecimiento: $120<br><br>';
        response += 'Para presupuesto preciso, agenda una consulta.';
    }
    // PAGOS
    else if (isPaymentIntent(normalizedMsg)) {
        response = `Asi puedes realizar tu pago en la web:<br><br>
<strong>1) Reserva tu cita</strong><br>
Ve a <a href="#citas" onclick="minimizeChatbot()">Reservar Cita</a>, completa tus datos y selecciona fecha/hora.<br><br>

<strong>2) Abre el modulo de pago</strong><br>
Al enviar el formulario se abre la ventana de pago automaticamente.<br><br>

<strong>3) Elige metodo de pago</strong><br>
• <strong>Tarjeta:</strong> ingresa numero, fecha de vencimiento, CVV y nombre.<br>
• <strong>Transferencia:</strong> realiza la transferencia y coloca el numero de referencia.<br>
• <strong>Efectivo:</strong> dejas la reserva registrada y pagas en consultorio.<br><br>

<strong>4) Confirmacion</strong><br>
Tu cita queda registrada y te contactamos para confirmar detalles por WhatsApp: <a href="https://wa.me/593982453672" target="_blank">+593 98 245 3672</a>.<br><br>

Si quieres, te guio paso a paso segun el metodo que prefieras.`;
    }
    // CITAS
    else if (/cita|agendar|reservar|turno|hora/.test(lowerMsg)) {
        response = `Puedes agendar tu cita de estas formas:

<strong>🌐 Online (recomendado):</strong>
Haz clic en "Reservar Cita" en el menú superior

<strong>📱 WhatsApp:</strong>
<a href="https://wa.me/593982453672?text=Hola,+quiero+agendar+una+cita" target="_blank">+593 98 245 3672</a>

<strong>📞 Teléfono:</strong>
<a href="tel:+593982453672">+593 98 245 3672</a>

<strong>Horario de atención:</strong>
Lunes a Viernes: 9:00 - 18:00
Sábados: 9:00 - 13:00`;
    }
    // ACNÉ
    else if (/acne|grano|espinilla|barro/.test(lowerMsg)) {
        response = 'El acne es muy comun y tenemos soluciones efectivas.<br><br>';
        response += 'Nuestro enfoque:<br>';
        response += '• Evaluacion personalizada<br>';
        response += '• Tratamientos topicos<br>';
        response += '• Medicacion oral si es necesario<br>';
        response += '• Peelings quimicos<br>';
        response += '• Laser para cicatrices<br><br>';
        response += 'Primera consulta: $40<br><br>';
        response += '¿Te gustaria agendar?';
    }
    // LASER
    else if (/laser/.test(lowerMsg)) {
        response = 'Tecnologia laser de ultima generacion.<br><br>';
        response += 'Tratamientos:<br>';
        response += '• Eliminacion de lesiones vasculares<br>';
        response += '• Tratamiento de manchas<br>';
        response += '• Rejuvenecimiento facial<br>';
        response += '• Cicatrices de acne<br><br>';
        response += 'Precio: Desde $150<br><br>';
        response += 'Se requiere consulta de evaluacion previa.<br>';
        response += '¿Deseas agendar?';
    }
    // UBICACION
    else if (/donde|ubicación|dirección|lugar|mapa|quito/.test(lowerMsg)) {
        response = '<strong>Ubicacion:</strong><br>';
        response += 'Valparaiso 13-183 y Sodiro<br>';
        response += 'Quito, Ecuador<br><br>';
        response += '<strong>Horario:</strong><br>';
        response += 'Lunes - Viernes: 9:00 - 18:00<br>';
        response += 'Sabados: 9:00 - 13:00<br><br>';
        response += '<strong>Estacionamiento:</strong> Privado disponible<br><br>';
        response += '<strong>Contacto:</strong> +593 98 245 3672';
    }
    // DOCTORES
    else if (/doctor|médico|medico|especialista|rosero|narvaez|dr|dra/.test(lowerMsg)) {
        response = `Contamos con dos excelentes especialistas:

<strong>👨‍⚕️ Dr. Javier Rosero</strong>
Dermatólogo Clínico
15 años de experiencia
Especialista en detección temprana de cáncer de piel

<strong>👩‍⚕️ Dra. Carolina Narváez</strong>
Dermatóloga Estética
Especialista en rejuvenecimiento facial y láser

Ambos están disponibles para consulta presencial y online.

¿Con quién te gustaría agendar?`;
    }
    // TELEMEDICINA
    else if (/online|virtual|video|remota|telemedicina|whatsapp|llamada/.test(lowerMsg)) {
        response = `Ofrecemos 3 opciones de consulta remota:

<strong>📞 1. Llamada Telefónica - $25</strong>
Ideal para consultas rápidas y seguimientos

<strong>💬 2. WhatsApp Video - $30</strong>
Videollamada por WhatsApp, muy fácil de usar

<strong>🖥️ 3. Video Web (Jitsi) - $30</strong>
No necesitas instalar nada, funciona en el navegador

Todas incluyen:
✓ Evaluación médica completa
✓ Receta digital
✓ Recomendaciones personalizadas
✓ Seguimiento por WhatsApp

¿Cuál prefieres?`;
    }
    // DESPEDIDA
    else if (/gracias|thank|adios|chao|hasta luego|bye/.test(lowerMsg)) {
        response = `¡De nada! 😊

Si tienes más dudas, no dudes en escribirme. También puedes contactarnos directamente:

📱 WhatsApp: +593 98 245 3672
📞 Teléfono: +593 98 245 3672

¡Que tengas un excelente día!`;
    }
    // RESPUESTA POR DEFECTO
    else {
        response = `Puedo ayudarte mejor si eliges una opcion:<br><br>
1) <strong>Servicios y precios</strong><br>
2) <strong>Reservar cita</strong><br>
3) <strong>Pagos</strong><br><br>
Tambien puedes ir directo:<br>
- <a href="#servicios" onclick="minimizeChatbot()">Servicios</a><br>
- <a href="#citas" onclick="minimizeChatbot()">Reservar Cita</a><br>
- <a href="https://wa.me/593982453672" target="_blank">WhatsApp +593 98 245 3672</a>`;
    }
    
    addBotMessage(response, isOffline);
}

function formatMarkdown(text) {
    // Convertir markdown básico a HTML
    let html = text
        // Negritas
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Cursiva
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Links
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
        // Saltos de línea
        .replace(/\n/g, '<br>');
    
    return html;
}

// ========================================
// UTILIDADES DEL CHATBOT
// ========================================
function showBotServerHelp() {
    const html = `
        <div class="chat-suggestions" style="margin-top: 12px;">
            <p style="color: #0a84ff; margin-bottom: 12px;">
                <i class="fas fa-comments"></i>
                Estoy aqui para ayudarte ahora mismo.
            </p>
            <p style="margin-bottom: 12px;">Si deseas atencion inmediata, abre WhatsApp.</p>
            <button class="chat-suggestion-btn" onclick="window.open('https://wa.me/593982453672','_blank')">
                <i class="fab fa-whatsapp"></i> Hablar por WhatsApp
            </button>
        </div>
    `;
    addBotMessage(html, true);
}

function resetConversation() {
    conversationContext = [];
    localStorage.removeItem('chatHistory');
    chatHistory = [];
    showToast('Conversacion reiniciada', 'info');
}

setTimeout(() => {
    const notification = document.getElementById('chatNotification');
    if (notification && !chatbotOpen && chatHistory.length === 0) {
        notification.style.display = 'flex';
    }
}, 30000);

function checkServerEnvironment() {
    if (window.location.protocol === 'file:') {
        setTimeout(() => {
            showToast('Para usar funciones online, abre el sitio en un servidor local. Ver SERVIDOR-LOCAL.md', 'warning', 'Servidor requerido');
        }, 2000);
        return false;
    }
    return true;
}

function forzarModoIA() {
    localStorage.setItem('forceAI', 'true');
    showToast('Modo IA activado manualmente', 'success');

    if (chatHistory.length > 0) {
        addBotMessage('<strong>Modo IA activado</strong><br>Intentare usar inteligencia artificial real en los proximos mensajes.');
    }
}

function mostrarInfoDebug() {
    const usaIA = shouldUseRealAI();
    const protocolo = window.location.protocol;
    const hostname = window.location.hostname;
    const forzado = localStorage.getItem('forceAI') === 'true';

    let msg = '<strong>Información del sistema:</strong><br><br>';
    msg += 'Protocolo: ' + protocolo + '<br>';
    msg += 'Hostname: ' + hostname + '<br>';
    msg += 'Usa IA: ' + (usaIA ? 'SI' : 'NO') + '<br>';
    msg += 'Forzado: ' + (forzado ? 'SI' : 'NO') + '<br><br>';
    msg += 'Endpoint: ' + KIMI_CONFIG.apiUrl;

    addBotMessage(msg);
}

async function testProxyConnection() {
    try {
        const response = await fetch(KIMI_CONFIG.apiUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initThemeMode();
    changeLanguage(currentLang);
    const isServer = checkServerEnvironment();

    // Evitar llamadas iniciales innecesarias al backend durante la carga.
    if (isServer) {
        loadPaymentConfig()
            .then(() => refreshCardPaymentAvailability())
            .catch(() => undefined);
    }

    if (!isServer) {
        console.warn('Chatbot en modo offline: abre el sitio desde servidor para usar IA real.');
    }
});

// ========================================
// ANIMACIONES APPLE - SCROLL
// ========================================

// Animación de elementos al hacer scroll
function initScrollAnimations() {
    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -100px 0px',
        threshold: 0.1
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observar elementos
    document.querySelectorAll('.service-card, .team-card, .section-header, .telemedicine-card, .review-card').forEach(el => {
        el.classList.add('animate-on-scroll');
        observer.observe(el);
    });
}

// Efecto parallax suave en el hero
function initParallax() {
    const heroImage = document.querySelector('.hero-image-container');
    if (!heroImage) return;
    
    let ticking = false;
    
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const scrolled = window.pageYOffset;
                const rate = scrolled * 0.3;
                heroImage.style.transform = `translateY(calc(-50% + ${rate}px))`;
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
}

// Navbar efecto al hacer scroll
function initNavbarScroll() {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    }, { passive: true });
}

// Inicializar animaciones cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initScrollAnimations();
        initParallax();
        initNavbarScroll();
    });
} else {
    initScrollAnimations();
    initParallax();
    initNavbarScroll();
}

