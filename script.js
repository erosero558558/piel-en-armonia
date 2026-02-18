/**
 * PIEL EN ARMONÃA - Apple Design
 * Todas las funcionalidades integradas
 * 
 * Incluye:
 * - Toast notifications
 * - Loading states
 * - Exportar a calendario
 * - ValidaciÃ³n de disponibilidad
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
        success: title || 'Ã‰xito',
        error: title || 'Error',
        warning: title || 'Advertencia',
        info: title || 'InformaciÃ³n'
    };
    
    // Escapar mensaje para prevenir XSS
    const safeMsg = String(message).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${titles[type]}</div>
            <div class="toast-message">${safeMsg}</div>
        </div>
        <button type="button" class="toast-close" data-action="toast-close">
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
        brand: "Piel en ArmonÃ­a",
        nav_home: "Inicio",
        nav_services: "Servicios",
        nav_telemedicine: "Telemedicina",
        nav_team: "Equipo",
        nav_gallery: "Resultados",
        nav_clinic: "Consultorio",
        nav_reviews: "ReseÃ±as",
        nav_book: "Reservar Cita",
        theme_light: "Claro",
        theme_dark: "Oscuro",
        theme_system: "Sistema",
        hero_title1: "Tu piel.",
        hero_title2: "En las mejores manos.",
        hero_subtitle: "DermatologÃ­a especializada con tecnologÃ­a de vanguardia. Tratamientos personalizados para que tu piel luzca saludable y radiante.",
        hero_cta_primary: "Reservar Consulta",
        hero_cta_secondary: "Consulta Online",
        services_title: "Nuestros Servicios",
        services_subtitle: "Tratamientos dermatolÃ³gicos de excelencia",
        service_consulta: "Consulta DermatolÃ³gica",
        service_consulta_desc: "EvaluaciÃ³n completa de tu piel con diagnÃ³stico preciso y plan de tratamiento personalizado.",
        service_telemedicina: "Telemedicina",
        service_telemedicina_desc: "Consulta mÃ©dica desde la comodidad de tu hogar por telÃ©fono o videollamada.",
        service_laser: "LÃ¡ser DermatolÃ³gico",
        service_laser_desc: "Tratamientos con lÃ¡ser de Ãºltima generaciÃ³n para diversas afecciones de la piel.",
        service_rejuvenation: "Rejuvenecimiento",
        service_rejuvenation_desc: "Tratamientos estÃ©ticos para recuperar la juventud y luminosidad de tu piel.",
        service_acne: "Tratamiento de AcnÃ©",
        service_acne_desc: "Soluciones efectivas para controlar y eliminar el acnÃ© en todas sus formas.",
        service_cancer: "DetecciÃ³n de CÃ¡ncer de Piel",
        service_cancer_desc: "Examen dermatoscÃ³pico completo para detecciÃ³n temprana de lesiones sospechosas.",
        badge_popular: "Popular",
        price_from: "Desde",
        telemedicine_title: "Consulta desde cualquier lugar",
        telemedicine_subtitle: "Tres formas simples de conectarte con tu dermatÃ³logo",
        tele_phone_title: "Llamada TelefÃ³nica",
        tele_phone_desc: "La forma mÃ¡s fÃ¡cil. Toca el botÃ³n y habla directamente con el doctor desde tu telÃ©fono.",
        tele_feature1: "Funciona en cualquier celular",
        tele_feature2: "Sin internet necesario",
        tele_feature3: "Perfecto para adultos mayores",
        tele_whatsapp_title: "WhatsApp Video",
        tele_whatsapp_desc: "Videollamada por WhatsApp. Si ya tienes WhatsApp instalado, es la opciÃ³n mÃ¡s cÃ³moda.",
        tele_feature4: "Videollamada HD",
        tele_feature5: "EnvÃ­a fotos de tu piel",
        tele_feature6: "Chat incluido",
        tele_web_title: "Video desde Navegador",
        tele_web_desc: "Sin instalar nada. Solo abre el enlace y permite acceso a tu cÃ¡mara. Funciona en computadora o celular.",
        tele_feature7: "Sin apps ni registro",
        tele_feature8: "Pantalla mÃ¡s grande",
        tele_feature9: "Ideal para compartir pantalla",
        btn_call: "Llamar Ahora",
        btn_whatsapp: "Abrir WhatsApp",
        btn_video: "Iniciar Video",
        callback_title: "Â¿Prefieres que te llamemos?",
        callback_desc: "DÃ©janos tu nÃºmero y el doctor te llamarÃ¡ en los prÃ³ximos minutos.",
        callback_when: "Â¿CuÃ¡ndo prefieres?",
        callback_now: "Lo antes posible",
        callback_15min: "En 15 minutos",
        callback_30min: "En 30 minutos",
        callback_1hour: "En 1 hora",
        btn_request: "Solicitar Llamada",
        badge_recommended: "Recomendado",
        team_title: "Nuestro Equipo",
        team_subtitle: "Especialistas dedicados al cuidado de tu piel",
        role_dermatologo: "DermatÃ³logo ClÃ­nico",
        role_estetica: "DermatÃ³loga EstÃ©tica",
        desc_rosero: "15 aÃ±os de experiencia en dermatologÃ­a clÃ­nica y quirÃºrgica. Especialista en detecciÃ³n temprana de cÃ¡ncer de piel.",
        desc_narvaez: "Especialista en rejuvenecimiento facial, lÃ¡ser dermatolÃ³gico y tratamientos estÃ©ticos no invasivos.",
        status_available: "Disponible hoy",
        gallery_title: "Resultados que hablan por sÃ­ solos",
        gallery_subtitle: "Transformaciones reales de nuestros pacientes",
        filter_all: "Todos",
        filter_acne: "AcnÃ©",
        filter_rejuvenation: "Rejuvenecimiento",
        filter_laser: "LÃ¡ser",
        filter_spots: "Manchas",
        label_before: "Antes",
        label_after: "DespuÃ©s",
        case_acne: "Tratamiento de AcnÃ© Severo",
        case_acne_desc: "6 meses de tratamiento combinado",
        case_rejuvenation: "Rejuvenecimiento Facial",
        case_rejuvenation_desc: "LÃ¡ser + peelings quÃ­micos",
        case_laser: "Tratamiento LÃ¡ser",
        case_laser_desc: "EliminaciÃ³n de lesiones vasculares",
        case_spots: "EliminaciÃ³n de Manchas",
        case_spots_desc: "Tratamiento despigmentante",
        results_note_consent: "Casos reales publicados con consentimiento informado del paciente.",
        results_note_variability: "Los resultados pueden variar seg\u00fan el diagn\u00f3stico, adherencia y tipo de piel.",
        results_note_timeline: "El tiempo mostrado en cada caso corresponde al proceso real del paciente.",
        showcase_eyebrow: "DermatologÃ­a avanzada",
        showcase_title: "TecnologÃ­a que transforma tu piel.",
        showcase_desc: "Combinamos ciencia y experiencia para ofrecerte los tratamientos m\u00e1s efectivos y personalizados del mercado.",
        showcase_diag_eyebrow: "Diagn\u00f3stico",
        showcase_diag_title: "PrecisiÃ³n en cada detalle.",
        showcase_diag_desc: "Dermatoscopia digital y evaluaciÃ³n integral para un diagnÃ³stico certero desde la primera consulta.",
        showcase_clinic_eyebrow: "Instalaciones",
        showcase_clinic_title: "Espacios pensados para ti.",
        showcase_clinic_desc: "Un ambiente moderno, limpio y acogedor, equipado con la Ãºltima tecnologÃ­a en tratamientos dermatolÃ³gicos.",
        showcase_treat_eyebrow: "Tratamientos",
        showcase_treat_title: "Resultados visibles desde la primera sesiÃ³n.",
        showcase_treat_desc: "Cada tratamiento es personalizado. Utilizamos protocolos basados en evidencia cientÃ­fica para garantizar los mejores resultados para tu tipo de piel.",
        stat_satisfaction: "SatisfacciÃ³n",
        stat_years: "AÃ±os de experiencia",
        stat_patients: "Pacientes atendidos",
        clinic_title: "Nuestro Consultorio",
        clinic_desc: "Ubicados en el corazÃ³n de Quito, contamos con instalaciones modernas y equipamiento de Ãºltima generaciÃ³n para brindarte la mejor atenciÃ³n.",
        clinic_address_label: "DirecciÃ³n",
        clinic_hours_label: "Horario de AtenciÃ³n",
        clinic_hours: "Lunes - Viernes: 9:00 - 18:00<br>SÃ¡bados: 9:00 - 13:00",
        clinic_phone_label: "TelÃ©fono",
        clinic_parking_label: "Estacionamiento",
        clinic_parking: "Estacionamiento privado disponible",
        btn_directions: "CÃ³mo llegar",
        reviews_title: "Lo que dicen nuestros pacientes",
        reviews_count: "ReseÃ±as verificadas",
        review_1: "\"Soy seÃ±ora de 78 aÃ±os y pude llamar al doctor sin problemas. Muy amable y profesional. Me resolviÃ³ todas mis dudas sobre mi piel.\"",
        review_2: "\"La videollamada por WhatsApp fue sÃºper fÃ¡cil. No tuve que instalar nada nuevo. El doctor fue muy paciente y me explicÃ³ todo detalladamente.\"",
        review_3: "\"SolicitÃ© que me llamaran y en 10 minutos el doctor me contactÃ³. Excelente servicio. Mi acnÃ© ha mejorado notablemente.\"",
        btn_write_review: "Escribir ReseÃ±a",
        appointment_title: "Reserva tu Cita",
        appointment_desc: "Agenda tu consulta de forma rÃ¡pida y sencilla. Selecciona el tipo de servicio, el doctor de tu preferencia y la fecha que mÃ¡s te convenga.",
        benefit_1: "ConfirmaciÃ³n inmediata",
        benefit_2: "ConfirmaciÃ³n de pago asistida",
        benefit_3: "Reprogramaci\u00f3n gratuita",
        
        benefit_3_link: "Ver pol\u00edtica de reprogramaci\u00f3n y cancelaci\u00f3n",
        benefit_3_note: "Cambios sin costo hasta 24h antes. Sujeto a disponibilidad.",
        form_title: "Nueva Cita",
        label_service: "Tipo de Consulta",
        select_service: "Selecciona un servicio",
        opt_consulta: "Consulta DermatolÃ³gica - $40",
        opt_telefono: "Consulta TelefÃ³nica - $25",
        opt_video: "Video Consulta - $30",
        opt_laser: "Tratamiento LÃ¡ser - desde $150",
        opt_rejuvenation: "Rejuvenecimiento - desde $120",
        label_doctor: "Doctor",
        select_doctor: "Selecciona un doctor",
        opt_rosero: "Dr. Javier Rosero - DermatÃ³logo ClÃ­nico",
        opt_narvaez: "Dra. Carolina NarvÃ¡ez - DermatÃ³loga EstÃ©tica",
        opt_any: "Primera disponible",
        label_date: "Fecha",
        label_time: "Hora",
        select_time: "Hora",
        label_name: "Nombre completo",
        label_email: "Email",
        label_reason: "Motivo de consulta (opcional)",
        placeholder_reason: "Ej: acn\u00e9 inflamatorio en mejillas, picaz\u00f3n o manchas recientes",
        label_area: "Zona de la piel (opcional)",
        select_area: "Selecciona una zona",
        area_face: "Rostro",
        area_neck: "Cuello",
        area_scalp: "Cuero cabelludo",
        area_torso: "Tronco",
        area_arms: "Brazos y manos",
        area_legs: "Piernas y pies",
        area_other: "Otra zona",
        label_evolution: "Tiempo de evoluci\u00f3n (opcional)",
        select_evolution: "Selecciona un tiempo",
        evolution_1w: "Menos de 1 semana",
        evolution_1m: "1 a 4 semanas",
        evolution_3m: "1 a 3 meses",
        evolution_12m: "3 a 12 meses",
        evolution_year: "M\u00e1s de 1 a\u00f1o",
        label_case_photos: "Fotos de apoyo (opcional, max 3)",
        case_photos_help: "Puedes subir hasta 3 fotos (max 5 MB c/u) para orientar mejor la primera consulta.",
        privacy_consent_label: "Acepto el tratamiento de mis datos para gestionar la cita y evaluaci\u00f3n m\u00e9dica inicial.",
        privacy_images_note: "Las im\u00e1genes y datos de contacto se usan solo con fines asistenciales internos y se resguardan de forma confidencial.",
        privacy_link_label: "Ver pol\u00edtica de privacidad",
        label_phone: "TelÃ©fono",
        
        placeholder_phone: "+593 9XXXXXXXX",
        summary_subtotal: "Subtotal",
        summary_iva: "IVA (12%)",
        summary_total: "Total",
        btn_continue: "Continuar al Pago",
        payment_title: "MÃ©todo de Pago",
        pay_card: "Tarjeta",
        pay_transfer: "Transferencia",
        pay_cash: "Efectivo",
        label_card_number: "NÃºmero de tarjeta",
        label_expiry: "Vencimiento",
        label_cvv: "CVV",
        label_card_name: "Nombre en la tarjeta",
        bank_name: "Banco Pichincha",
        bank_account: "Cuenta de Ahorros: 2200160272",
        bank_owner: "Titular: Rosero Caiza Javier Alejandro",
        label_transfer_ref: "N\u00famero de referencia",
        cash_info: "Paga directamente en el consultorio el dÃ­a de tu cita.",
        payment_total: "Total a pagar:",
        payment_trust_ssl: "Conexi\u00f3n segura SSL/TLS",
        payment_trust_stripe: "Cobro protegido con Stripe",
        payment_trust_invoice: "Facturaci\u00f3n y soporte por WhatsApp",
        payment_faq_title: "Preguntas frecuentes de pago",
        payment_faq_refund_q: "Reembolsos y cancelaciones",
        payment_faq_refund_a: "Si cancelas con anticipaciÃ³n, coordinamos reembolso o saldo a favor segÃºn el caso clÃ­nico y tÃ©rminos vigentes.",
        payment_faq_reschedule_q: "ReprogramaciÃ³n de citas",
        payment_faq_reschedule_a: "Puedes reprogramar sin costo en horarios disponibles. Si ya pagaste, tu pago se mantiene para la nueva fecha.",
        payment_faq_billing_q: "FacturaciÃ³n",
        payment_faq_billing_a: "Emitimos comprobante/factura con los datos enviados en la reserva. Si necesitas ajuste, escrÃ­benos por WhatsApp.",
        payment_faq_include_q: "QuÃ© incluye cada servicio",
        payment_faq_include_a: "Cada servicio indica valor base y tipo de atenciÃ³n. Si requiere procedimientos adicionales, se informa antes de confirmar.",
        btn_pay: "Confirmar Reserva",
        success_title: "Â¡Cita Confirmada!",
        success_desc: "Tu cita fue registrada correctamente.",
        btn_done: "Entendido",
        reschedule_title: "Reprogramar Cita",
        reschedule_new_date: "Nueva fecha",
        reschedule_new_time: "Nuevo horario",
        reschedule_select_time: "Selecciona un horario",
        reschedule_confirm: "Confirmar reprogramaciÃ³n",
        video_modal_title: "Elige cÃ³mo quieres hacer la videollamada:",
        video_jitsi: "Jitsi Meet (Recomendado)",
        video_jitsi_desc: "Sin registro. Funciona en cualquier navegador.",
        video_whatsapp: "WhatsApp Video",
        video_whatsapp_desc: "Usa la app de WhatsApp que ya tienes.",
        video_tip: "DespuÃ©s de abrir la videollamada, comparte el enlace o ID con el doctor por WhatsApp.",
        review_modal_title: "Escribe tu ReseÃ±a",
        label_your_name: "Tu nombre",
        label_rating: "CalificaciÃ³n",
        label_review: "Tu experiencia",
        btn_submit_review: "Publicar ReseÃ±a",
        legal_terms: "TÃ©rminos y Condiciones",
        legal_privacy: "PolÃ­tica de Privacidad",
        legal_cookies: "PolÃ­tica de Cookies",
        legal_disclaimer: "Aviso de Responsabilidad MÃ©dica",
        chat_disclaimer: "Este asistente ofrece orientacion general y no reemplaza una consulta medica profesional.",
        cookie_banner_text: "Usamos cookies esenciales para seguridad y funcionamiento. Puedes aceptar o rechazar cookies opcionales.",
        cookie_reject: "Rechazar",
        cookie_accept: "Aceptar",
        cookie_more: "MÃ¡s informaciÃ³n",
        footer_privacy_note: "Si compartes fotos por web o WhatsApp, se usan solo para orientaciÃ³n clÃ­nica y gestiÃ³n de tu cita.",
        footer_tagline: "DermatologÃ­a especializada en Quito",
        footer_rights: "Todos los derechos reservados."
    },
    en: {
        brand: "Piel en ArmonÃ­a",
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
        results_note_consent: "Real cases published with informed patient consent.",
        results_note_variability: "Results may vary based on diagnosis, adherence, and skin type.",
        results_note_timeline: "The timeline shown in each case reflects the real patient process.",
        showcase_eyebrow: "Advanced Dermatology",
        showcase_title: "Technology that transforms your skin.",
        showcase_desc: "We combine science and experience to offer you the most effective and personalized treatments on the market.",
        showcase_diag_eyebrow: "Diagnosis",
        showcase_diag_title: "Precision in every detail.",
        showcase_diag_desc: "Digital dermatoscopy and comprehensive evaluation for an accurate diagnosis from the first consultation.",
        showcase_clinic_eyebrow: "Facilities",
        showcase_clinic_title: "Spaces designed for you.",
        showcase_clinic_desc: "A modern, clean and welcoming environment, equipped with the latest technology in dermatological treatments.",
        showcase_treat_eyebrow: "Treatments",
        showcase_treat_title: "Visible results from the first session.",
        showcase_treat_desc: "Each treatment is personalized. We use evidence-based protocols to guarantee the best results for your skin type.",
        stat_satisfaction: "Satisfaction",
        stat_years: "Years of experience",
        stat_patients: "Patients treated",
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
        reviews_count: "Verified reviews",
        review_1: "\"I'm a 78-year-old lady and I was able to call the doctor without problems. Very kind and professional. He solved all my doubts about my skin.\"",
        review_2: "\"The WhatsApp video call was super easy. I didn't have to install anything new. The doctor was very patient and explained everything in detail.\"",
        review_3: "\"I requested a call back and the doctor contacted me in 10 minutes. Excellent service. My acne has improved noticeably.\"",
        btn_write_review: "Write Review",
        appointment_title: "Book Your Appointment",
        appointment_desc: "Schedule your consultation quickly and easily. Select the type of service, preferred doctor, and the date that suits you best.",
        benefit_1: "Immediate confirmation",
        benefit_2: "Assisted payment confirmation",
        benefit_3: "Free rescheduling",
        
        benefit_3_link: "View rescheduling and cancellation policy",
        benefit_3_note: "Free changes up to 24h before. Subject to availability.",
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
        opt_narvaez: "Dr. Carolina NarvÃ¡ez - Aesthetic Dermatologist",
        opt_any: "First available",
        label_date: "Date",
        label_time: "Time",
        select_time: "Time",
        label_name: "Full name",
        label_email: "Email",
        label_reason: "Reason for consultation (optional)",
        placeholder_reason: "Example: inflammatory acne on cheeks, itching, or recent spots",
        label_area: "Skin area (optional)",
        select_area: "Select an area",
        area_face: "Face",
        area_neck: "Neck",
        area_scalp: "Scalp",
        area_torso: "Torso",
        area_arms: "Arms and hands",
        area_legs: "Legs and feet",
        area_other: "Other area",
        label_evolution: "Progress time (optional)",
        select_evolution: "Select duration",
        evolution_1w: "Less than 1 week",
        evolution_1m: "1 to 4 weeks",
        evolution_3m: "1 to 3 months",
        evolution_12m: "3 to 12 months",
        evolution_year: "More than 1 year",
        label_case_photos: "Support photos (optional, max 3)",
        case_photos_help: "Upload up to 3 photos (max 5 MB each) to improve the first consultation.",
        privacy_consent_label: "I accept data processing to manage my appointment and initial medical evaluation.",
        privacy_images_note: "Images and contact data are used only for internal care purposes and handled confidentially.",
        privacy_link_label: "View privacy policy",
        label_phone: "Phone",
        placeholder_phone: "+593 9XXXXXXXX",
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
        bank_account: "Savings Account: 2200160272",
        bank_owner: "Holder: Rosero Caiza Javier Alejandro",
        label_transfer_ref: "Reference number",
        cash_info: "Pay directly at the clinic on the day of your appointment.",
        payment_total: "Total to pay:",
        payment_trust_ssl: "Secure SSL/TLS connection",
        payment_trust_stripe: "Protected checkout with Stripe",
        payment_trust_invoice: "Billing and support via WhatsApp",
        payment_faq_title: "Payment FAQ",
        payment_faq_refund_q: "Refunds and cancellations",
        payment_faq_refund_a: "If you cancel in advance, we coordinate a refund or credit based on your case and current terms.",
        payment_faq_reschedule_q: "Rescheduling appointments",
        payment_faq_reschedule_a: "You can reschedule at no cost for available times. If you already paid, your payment remains valid.",
        payment_faq_billing_q: "Billing",
        payment_faq_billing_a: "We issue receipt/invoice with the booking data. If you need changes, contact us on WhatsApp.",
        payment_faq_include_q: "What each service includes",
        payment_faq_include_a: "Each service shows a base price and care type. If extra procedures are needed, we inform you before confirmation.",
        btn_pay: "Confirm Booking",
        success_title: "Appointment Confirmed!",
        success_desc: "Your appointment was registered successfully.",
        btn_done: "Got it",
        reschedule_title: "Reschedule Appointment",
        reschedule_new_date: "New date",
        reschedule_new_time: "New time",
        reschedule_select_time: "Select a time",
        reschedule_confirm: "Confirm reschedule",
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
        legal_terms: "Terms and Conditions",
        legal_privacy: "Privacy Policy",
        legal_cookies: "Cookie Policy",
        legal_disclaimer: "Medical Liability Notice",
        chat_disclaimer: "This assistant provides general guidance and does not replace a professional medical consultation.",
        cookie_banner_text: "We use essential cookies for security and operation. You can accept or reject optional cookies.",
        cookie_reject: "Reject",
        cookie_accept: "Accept",
        cookie_more: "More information",
        footer_privacy_note: "If you share photos by web or WhatsApp, they are used only for clinical guidance and appointment management.",
        footer_tagline: "Specialized dermatology in Quito",
        footer_rights: "All rights reserved."
    }
};

let currentLang = localStorage.getItem('language') || 'es';
const THEME_STORAGE_KEY = 'themeMode';
const VALID_THEME_MODES = new Set(['light', 'dark', 'system']);
let currentThemeMode = localStorage.getItem(THEME_STORAGE_KEY) || 'system';
const API_ENDPOINT = '/api.php';
const CLINIC_ADDRESS = 'Dr. Cecilio Caiza e hijas, Quito, Ecuador';
const CLINIC_MAP_URL = 'https://www.google.com/maps/place/Dr.+Cecilio+Caiza+e+hijas/@-0.1740225,-78.4865596,15z/data=!4m6!3m5!1s0x91d59b0024fc4507:0xdad3a4e6c831c417!8m2!3d-0.2165855!4d-78.4998702!16s%2Fg%2F11vpt0vjj1?entry=ttu&g_ep=EgoyMDI2MDIxMS4wIKXMDSoASAFQAw%3D%3D';
const DOCTOR_CAROLINA_PHONE = '+593 98 786 6885';
const DOCTOR_CAROLINA_EMAIL = 'caro93narvaez@gmail.com';
const MAX_CASE_PHOTOS = 3;
const MAX_CASE_PHOTO_BYTES = 5 * 1024 * 1024;
const CASE_PHOTO_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const COOKIE_CONSENT_KEY = 'pa_cookie_consent_v1';
const API_REQUEST_TIMEOUT_MS = 9000;
const API_RETRY_BASE_DELAY_MS = 450;
const API_DEFAULT_RETRIES = 1;
const API_SLOW_NOTICE_MS = 1200;
const API_SLOW_NOTICE_COOLDOWN_MS = 25000;
const AVAILABILITY_CACHE_TTL_MS = 5 * 60 * 1000;
const BOOKED_SLOTS_CACHE_TTL_MS = 45 * 1000;
let apiSlowNoticeLastAt = 0;
let bookingViewTracked = false;
let chatStartedTracked = false;
let availabilityPrefetched = false;
let reviewsPrefetched = false;
let galleryFiltersInitialized = false;
let beforeAfterInitialized = false;
let checkoutSession = {
    active: false,
    completed: false,
    startedAt: 0,
    service: '',
    doctor: ''
};
const DEFAULT_PUBLIC_REVIEWS = [
    {
        id: 'google-jose-gancino',
        name: 'Jose Gancino',
        rating: 5,
        text: 'Buena atenciÃ³n solo falta los nÃºmeros de la oficina y horarios de atenciÃ³n.',
        date: '2025-10-01T10:00:00-05:00',
        verified: true
    },
    {
        id: 'google-jacqueline-ruiz-torres',
        name: 'Jacqueline Ruiz Torres',
        rating: 5,
        text: 'Exelente atenciÃ³n y econÃ³mico ðŸ™ðŸ¤—ðŸ‘Œ',
        date: '2025-04-15T10:00:00-05:00',
        verified: true
    },
    {
        id: 'google-cris-lema',
        name: 'Cris Lema',
        rating: 5,
        text: '',
        date: '2025-10-10T10:00:00-05:00',
        verified: true
    },
    {
        id: 'google-camila-escobar',
        name: 'Camila Escobar',
        rating: 5,
        text: '',
        date: '2025-02-01T10:00:00-05:00',
        verified: true
    }
];
const DEFAULT_TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00'];
let currentAppointment = null;
let availabilityCache = {};
let availabilityCacheLoadedAt = 0;
let availabilityCachePromise = null;
const bookedSlotsCache = new Map();
let reviewsCache = [];
let paymentConfig = { enabled: false, provider: 'stripe', publishableKey: '', currency: 'USD' };
let paymentConfigLoaded = false;
let paymentConfigLoadedAt = 0;
let stripeClient = null;
let stripeElements = null;
let stripeCardElement = null;
let stripeMounted = false;
let stripeSdkPromise = null;
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

function getCookieConsent() {
    try {
        const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (!raw) return '';
        const parsed = JSON.parse(raw);
        return typeof parsed?.status === 'string' ? parsed.status : '';
    } catch (error) {
        return '';
    }
}

function setCookieConsent(status) {
    const normalized = status === 'accepted' ? 'accepted' : 'rejected';
    try {
        localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
            status: normalized,
            at: new Date().toISOString()
        }));
    } catch (error) {
        // noop
    }
}

function trackEvent(eventName, params = {}) {
    if (!eventName || typeof eventName !== 'string') {
        return;
    }

    const payload = {
        event_category: 'conversion',
        ...params
    };

    if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, payload);
        return;
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
        event: eventName,
        ...payload
    });
}

function normalizeAnalyticsLabel(value, fallback = 'unknown') {
    if (value === null || value === undefined) {
        return fallback;
    }
    const normalized = String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64);
    return normalized || fallback;
}

function markBookingViewed(source = 'unknown') {
    if (bookingViewTracked) {
        return;
    }
    bookingViewTracked = true;
    trackEvent('view_booking', {
        source
    });
}

function prefetchAvailabilityData(source = 'unknown') {
    if (availabilityPrefetched) {
        return;
    }
    availabilityPrefetched = true;
    loadAvailabilityData().catch(() => {
        availabilityPrefetched = false;
    });
    trackEvent('availability_prefetch', {
        source
    });
}

function prefetchReviewsData(source = 'unknown') {
    if (reviewsPrefetched) {
        return;
    }
    reviewsPrefetched = true;
    loadPublicReviews().catch(() => {
        reviewsPrefetched = false;
    });
    trackEvent('reviews_prefetch', {
        source
    });
}

function initBookingFunnelObserver() {
    const bookingSection = document.getElementById('citas');
    if (!bookingSection) {
        return;
    }

    if (!('IntersectionObserver' in window)) {
        markBookingViewed('fallback_no_observer');
        prefetchAvailabilityData('fallback_no_observer');
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                markBookingViewed('observer');
                prefetchAvailabilityData('booking_section_visible');
                observer.disconnect();
            }
        });
    }, { threshold: 0.35 });

    observer.observe(bookingSection);
}

function initDeferredSectionPrefetch() {
    const reviewsSection = document.getElementById('resenas');
    if (!reviewsSection) {
        return;
    }

    if (!('IntersectionObserver' in window)) {
        prefetchReviewsData('fallback_no_observer');
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }
            prefetchReviewsData('reviews_section_visible');
            observer.disconnect();
        });
    }, { threshold: 0.2, rootMargin: '120px 0px' });

    observer.observe(reviewsSection);
}

function startCheckoutSession(appointment) {
    checkoutSession = {
        active: true,
        completed: false,
        startedAt: Date.now(),
        service: appointment?.service || '',
        doctor: appointment?.doctor || ''
    };
}

function completeCheckoutSession(method) {
    if (!checkoutSession.active) {
        return;
    }
    checkoutSession.completed = true;
    trackEvent('booking_confirmed', {
        payment_method: method || 'unknown',
        service: checkoutSession.service || '',
        doctor: checkoutSession.doctor || ''
    });
}

function maybeTrackCheckoutAbandon(reason = 'unknown') {
    if (!checkoutSession.active || checkoutSession.completed) {
        return;
    }

    const startedAt = checkoutSession.startedAt || Date.now();
    const elapsedSec = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    trackEvent('checkout_abandon', {
        service: checkoutSession.service || '',
        doctor: checkoutSession.doctor || '',
        elapsed_sec: elapsedSec,
        reason: normalizeAnalyticsLabel(reason, 'unknown')
    });
}

function waitMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function initGA4() {
    if (window._ga4Loaded) return;
    if (getCookieConsent() !== 'accepted') return;
    window._ga4Loaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-GYY8PE5M8W';
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('config', 'G-GYY8PE5M8W');
}

function initCookieBanner() {
    const banner = document.getElementById('cookieBanner');
    if (!banner) return;

    const consent = getCookieConsent();
    if (consent === 'accepted' || consent === 'rejected') {
        banner.classList.remove('active');
    } else {
        banner.classList.add('active');
    }

    const acceptBtn = document.getElementById('cookieAcceptBtn');
    const rejectBtn = document.getElementById('cookieRejectBtn');

    if (acceptBtn) {
        acceptBtn.addEventListener('click', () => {
            setCookieConsent('accepted');
            banner.classList.remove('active');
            showToast(currentLang === 'es' ? 'Preferencias de cookies guardadas.' : 'Cookie preferences saved.', 'success');
            initGA4();
            trackEvent('cookie_consent_update', { status: 'accepted' });
        });
    }

    if (rejectBtn) {
        rejectBtn.addEventListener('click', () => {
            setCookieConsent('rejected');
            banner.classList.remove('active');
            showToast(currentLang === 'es' ? 'Solo se mantendran cookies esenciales.' : 'Only essential cookies will be kept.', 'info');
            trackEvent('cookie_consent_update', { status: 'rejected' });
        });
    }
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
    const method = String(options.method || 'GET').toUpperCase();
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

    const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1500, Number(options.timeoutMs)) : API_REQUEST_TIMEOUT_MS;
    const maxRetries = Number.isInteger(options.retries)
        ? Math.max(0, Number(options.retries))
        : (method === 'GET' ? API_DEFAULT_RETRIES : 0);

    const shouldShowSlowNotice = options.silentSlowNotice !== true;
    const retryableStatusCodes = new Set([408, 425, 429, 500, 502, 503, 504]);

    function makeApiError(message, status = 0, retryable = false, code = '') {
        const error = new Error(message);
        error.status = status;
        error.retryable = retryable;
        error.code = code;
        return error;
    }

    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        let slowNoticeTimer = null;

        if (shouldShowSlowNotice) {
            slowNoticeTimer = setTimeout(() => {
                const now = Date.now();
                if ((now - apiSlowNoticeLastAt) > API_SLOW_NOTICE_COOLDOWN_MS) {
                    apiSlowNoticeLastAt = now;
                    showToast(
                        currentLang === 'es'
                            ? 'Conectando con el servidor...'
                            : 'Connecting to server...',
                        'info'
                    );
                }
            }, API_SLOW_NOTICE_MS);
        }

        try {
            const response = await fetch(url, {
                ...requestInit,
                signal: controller.signal
            });

            const responseText = await response.text();
            let payload = {};
            try {
                payload = responseText ? JSON.parse(responseText) : {};
            } catch (error) {
                throw makeApiError('Respuesta del servidor no es JSON valido', response.status, false, 'invalid_json');
            }

            if (!response.ok || payload.ok === false) {
                const message = payload.error || `HTTP ${response.status}`;
                throw makeApiError(message, response.status, retryableStatusCodes.has(response.status), 'http_error');
            }

            return payload;
        } catch (error) {
            const normalizedError = (() => {
                if (error && error.name === 'AbortError') {
                    return makeApiError(
                        currentLang === 'es'
                            ? 'Tiempo de espera agotado con el servidor'
                            : 'Server request timed out',
                        0,
                        true,
                        'timeout'
                    );
                }

                if (error instanceof Error) {
                    if (typeof error.retryable !== 'boolean') {
                        error.retryable = false;
                    }
                    if (typeof error.status !== 'number') {
                        error.status = 0;
                    }
                    return error;
                }

                return makeApiError('Error de conexion con el servidor', 0, true, 'network_error');
            })();

            lastError = normalizedError;

            const canRetry = attempt < maxRetries && normalizedError.retryable === true;
            if (!canRetry) {
                throw normalizedError;
            }

            const retryDelay = API_RETRY_BASE_DELAY_MS * (attempt + 1);
            await waitMs(retryDelay);
        } finally {
            clearTimeout(timeoutId);
            if (slowNoticeTimer !== null) {
                clearTimeout(slowNoticeTimer);
            }
        }
    }

    throw lastError || new Error('No se pudo completar la solicitud');
}

async function loadPaymentConfig() {
    const now = Date.now();
    if (paymentConfigLoaded && (now - paymentConfigLoadedAt) < 5 * 60 * 1000) {
        return paymentConfig;
    }

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
    paymentConfigLoaded = true;
    paymentConfigLoadedAt = now;
    return paymentConfig;
}

async function loadStripeSdk() {
    if (typeof window.Stripe === 'function') {
        return true;
    }

    if (stripeSdkPromise) {
        return stripeSdkPromise;
    }

    stripeSdkPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector('script[data-stripe-sdk="true"]');
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(true), { once: true });
            existingScript.addEventListener('error', () => reject(new Error('No se pudo cargar Stripe SDK')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.async = true;
        script.defer = true;
        script.dataset.stripeSdk = 'true';
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error('No se pudo cargar Stripe SDK'));
        document.head.appendChild(script);
    });

    return stripeSdkPromise;
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

    let response;
    let text = '';
    try {
        response = await fetch(`${API_ENDPOINT}?${query.toString()}`, {
            method: 'POST',
            credentials: 'same-origin',
            body: formData,
            signal: controller.signal
        });
        text = await response.text();
    } catch (error) {
        if (error && error.name === 'AbortError') {
            throw new Error(
                currentLang === 'es'
                    ? 'Tiempo de espera agotado al subir el comprobante'
                    : 'Upload timed out while sending proof file'
            );
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }

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

function getCasePhotoFiles(formElement) {
    const input = formElement?.querySelector('#casePhotos');
    if (!input || !input.files) return [];
    return Array.from(input.files);
}

function validateCasePhotoFiles(files) {
    if (!Array.isArray(files) || files.length === 0) return;

    if (files.length > MAX_CASE_PHOTOS) {
        throw new Error(
            currentLang === 'es'
                ? `Puedes subir maximo ${MAX_CASE_PHOTOS} fotos.`
                : `You can upload up to ${MAX_CASE_PHOTOS} photos.`
        );
    }

    for (const file of files) {
        if (!file) continue;

        if (file.size > MAX_CASE_PHOTO_BYTES) {
            throw new Error(
                currentLang === 'es'
                    ? `Cada foto debe pesar maximo ${Math.round(MAX_CASE_PHOTO_BYTES / (1024 * 1024))} MB.`
                    : `Each photo must be at most ${Math.round(MAX_CASE_PHOTO_BYTES / (1024 * 1024))} MB.`
            );
        }

        const mime = String(file.type || '').toLowerCase();
        const validByMime = CASE_PHOTO_ALLOWED_TYPES.has(mime);
        const validByExt = /\.(jpe?g|png|webp)$/i.test(String(file.name || ''));
        if (!validByMime && !validByExt) {
            throw new Error(
                currentLang === 'es'
                    ? 'Solo se permiten im\u00e1genes JPG, PNG o WEBP.'
                    : 'Only JPG, PNG or WEBP images are allowed.'
            );
        }
    }
}

async function ensureCasePhotosUploaded(appointment) {
    const files = Array.isArray(appointment?.casePhotoFiles) ? appointment.casePhotoFiles : [];
    if (files.length === 0) {
        return { names: [], urls: [], paths: [] };
    }

    if (Array.isArray(appointment.casePhotoUploads) && appointment.casePhotoUploads.length > 0) {
        return {
            names: appointment.casePhotoUploads.map(item => String(item.name || '')).filter(Boolean),
            urls: appointment.casePhotoUploads.map(item => String(item.url || '')).filter(Boolean),
            paths: appointment.casePhotoUploads.map(item => String(item.path || '')).filter(Boolean)
        };
    }

    const uploads = [];
    for (const file of files) {
        const uploaded = await uploadTransferProof(file);
        uploads.push({
            name: uploaded.transferProofName || file.name || '',
            url: uploaded.transferProofUrl || '',
            path: uploaded.transferProofPath || ''
        });
    }
    appointment.casePhotoUploads = uploads;

    return {
        names: uploads.map(item => String(item.name || '')).filter(Boolean),
        urls: uploads.map(item => String(item.url || '')).filter(Boolean),
        paths: uploads.map(item => String(item.path || '')).filter(Boolean)
    };
}

function stripTransientAppointmentFields(appointment) {
    const payload = { ...appointment };
    delete payload.casePhotoFiles;
    delete payload.casePhotoUploads;
    return payload;
}

async function buildAppointmentPayload(appointment) {
    const payload = stripTransientAppointmentFields(appointment || {});
    const uploadedPhotos = await ensureCasePhotosUploaded(appointment || {});
    payload.casePhotoCount = uploadedPhotos.urls.length;
    payload.casePhotoNames = uploadedPhotos.names;
    payload.casePhotoUrls = uploadedPhotos.urls;
    payload.casePhotoPaths = uploadedPhotos.paths;
    return payload;
}

function getBookedSlotsCacheKey(date, doctor = '') {
    return `${String(date || '')}::${String(doctor || '')}`;
}

function invalidateBookedSlotsCache(date = '', doctor = '') {
    const targetDate = String(date || '').trim();
    const targetDoctor = String(doctor || '').trim();
    if (!targetDate) {
        bookedSlotsCache.clear();
        return;
    }

    for (const key of bookedSlotsCache.keys()) {
        if (!key.startsWith(`${targetDate}::`)) {
            continue;
        }
        if (targetDoctor === '' || key === getBookedSlotsCacheKey(targetDate, targetDoctor)) {
            bookedSlotsCache.delete(key);
        }
    }
}

async function loadAvailabilityData(options = {}) {
    const forceRefresh = options && options.forceRefresh === true;
    const now = Date.now();

    if (!forceRefresh && availabilityCacheLoadedAt > 0 && (now - availabilityCacheLoadedAt) < AVAILABILITY_CACHE_TTL_MS) {
        return availabilityCache;
    }

    if (!forceRefresh && availabilityCachePromise) {
        return availabilityCachePromise;
    }

    availabilityCachePromise = (async () => {
        try {
            const payload = await apiRequest('availability');
            availabilityCache = payload.data || {};
            availabilityCacheLoadedAt = Date.now();
            storageSetJSON('availability', availabilityCache);
        } catch (error) {
            availabilityCache = storageGetJSON('availability', {});
            if (availabilityCache && typeof availabilityCache === 'object' && Object.keys(availabilityCache).length > 0) {
                availabilityCacheLoadedAt = Date.now();
            }
        } finally {
            availabilityCachePromise = null;
        }

        return availabilityCache;
    })();

    return availabilityCachePromise;
}

async function getBookedSlots(date, doctor = '') {
    const cacheKey = getBookedSlotsCacheKey(date, doctor);
    const now = Date.now();
    const cachedEntry = bookedSlotsCache.get(cacheKey);
    if (cachedEntry && (now - cachedEntry.at) < BOOKED_SLOTS_CACHE_TTL_MS) {
        return cachedEntry.slots;
    }

    try {
        const query = { date: date };
        if (doctor) query.doctor = doctor;
        const payload = await apiRequest('booked-slots', { query });
        const slots = Array.isArray(payload.data) ? payload.data : [];
        bookedSlotsCache.set(cacheKey, {
            slots,
            at: now
        });
        return slots;
    } catch (error) {
        if (!LOCAL_FALLBACK_ENABLED) {
            throw error;
        }
        const appointments = storageGetJSON('appointments', []);
        const slots = appointments
            .filter(a => {
                if (a.date !== date || a.status === 'cancelled') return false;
                if (doctor && doctor !== 'indiferente') {
                    const aDoc = a.doctor || '';
                    if (aDoc && aDoc !== 'indiferente' && aDoc !== doctor) return false;
                }
                return true;
            })
            .map(a => a.time);
        bookedSlotsCache.set(cacheKey, {
            slots,
            at: now
        });
        return slots;
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
        if (payload && payload.data) {
            invalidateBookedSlotsCache(payload.data.date || appointment?.date || '', payload.data.doctor || appointment?.doctor || '');
        } else {
            invalidateBookedSlotsCache(appointment?.date || '', appointment?.doctor || '');
        }
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
        invalidateBookedSlotsCache(fallback.date || appointment?.date || '', fallback.doctor || appointment?.doctor || '');
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

function mergePublicReviews(inputReviews) {
    const merged = [];
    const seen = new Set();

    const addReview = (review) => {
        if (!review || typeof review !== 'object') return;
        const name = String(review.name || '').trim().toLowerCase();
        const text = String(review.text || '').trim().toLowerCase();
        const date = String(review.date || '').trim();
        const signature = `${name}|${text}|${date}`;
        if (!name || seen.has(signature)) return;
        seen.add(signature);
        merged.push(review);
    };

    DEFAULT_PUBLIC_REVIEWS.forEach(addReview);
    if (Array.isArray(inputReviews)) {
        inputReviews.forEach(addReview);
    }

    return merged;
}

async function loadPublicReviews() {
    try {
        const payload = await apiRequest('reviews');
        const fetchedReviews = Array.isArray(payload.data) ? payload.data : [];
        reviewsCache = mergePublicReviews(fetchedReviews);
    } catch (error) {
        const localReviews = storageGetJSON('reviews', []);
        reviewsCache = mergePublicReviews(localReviews);
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
    grid.innerHTML = topReviews.map(review => {
        const text = String(review.text || '').trim();
        const textHtml = text !== ''
            ? `<p class="review-text">"${escapeHtml(text)}"</p>`
            : '';
        return `
        <div class="review-card">
            <div class="review-header">
                <div class="review-avatar">${escapeHtml(getInitials(review.name))}</div>
                <div class="review-meta">
                    <h4>${escapeHtml(review.name || (currentLang === 'es' ? 'Paciente' : 'Patient'))}</h4>
                    <div class="review-stars">${renderStars(review.rating)}</div>
                </div>
            </div>
            ${textHtml}
            <span class="review-date">${getRelativeDateLabel(review.date)}</span>
        </div>
    `;
    }).join('');

    // Actualizar promedio dinamico en hero + seccion de resenas
    if (reviews.length > 0) {
        const avg = reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length;
        const starsHtml = renderStars(Math.round(avg));

        document.querySelectorAll('.rating-number').forEach(el => {
            el.textContent = avg.toFixed(1);
        });

        document.querySelectorAll('.rating-stars').forEach(el => {
            el.innerHTML = starsHtml;
        });
    }

    const countText = currentLang === 'es'
        ? `${reviews.length} rese\u00f1as verificadas`
        : `${reviews.length} verified reviews`;

    document.querySelectorAll('.rating-count').forEach(el => {
        el.textContent = countText;
    });
}

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;

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
function toggleMobileMenu(forceClose) {
    const menu = document.getElementById('mobileMenu');
    if (forceClose === false) {
        menu.classList.remove('active');
        document.body.style.overflow = '';
        return;
    }
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
function initGalleryFilter() {
    if (galleryFiltersInitialized) {
        return;
    }
    const filterBtns = document.querySelectorAll('.filter-btn');
    const galleryItems = document.querySelectorAll('.gallery-item');
    if (filterBtns.length === 0 || galleryItems.length === 0) {
        return;
    }
    galleryFiltersInitialized = true;
    
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
}

// ========================================
// BEFORE/AFTER SLIDER
// ========================================
function initBeforeAfterSlider() {
    if (beforeAfterInitialized) {
        return;
    }
    const sliders = document.querySelectorAll('.ba-slider');
    if (sliders.length === 0) {
        return;
    }
    beforeAfterInitialized = true;
    
    sliders.forEach(slider => {
        const handle = slider.querySelector('.ba-handle');
        const after = slider.querySelector('.ba-after');
        if (!handle || !after) {
            return;
        }
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
        handle.addEventListener('touchstart', (e) => { isDragging = true; e.preventDefault(); }, { passive: false });
        document.addEventListener('touchend', () => isDragging = false);
        document.addEventListener('touchmove', (e) => {
            if (isDragging) {
                e.preventDefault();
                updateSlider(e.touches[0].clientX);
            }
        }, { passive: false });
        
        // Click to move
        slider.addEventListener('click', (e) => {
            if (e.target !== handle) updateSlider(e.clientX);
        });
    });
}

function initDeferredGalleryInteractions() {
    const gallerySection = document.getElementById('galeria');
    if (!gallerySection) {
        return;
    }

    const initAll = () => {
        initGalleryFilter();
        initBeforeAfterSlider();
    };

    if (!('IntersectionObserver' in window)) {
        initAll();
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }
            initAll();
            observer.disconnect();
        });
    }, { threshold: 0.15, rootMargin: '200px 0px' });

    observer.observe(gallerySection);
}

// ========================================
// APPOINTMENT FORM & PRICING
// ========================================
function normalizeEcuadorPhone(rawValue) {
    const raw = String(rawValue || '').trim();
    if (raw === '') return '';

    const digits = raw.replace(/\D/g, '');

    if (digits.startsWith('593') && digits.length >= 12) {
        return `+${digits}`;
    }

    if (digits.startsWith('09') && digits.length === 10) {
        return `+593${digits.slice(1)}`;
    }

    if (digits.startsWith('9') && digits.length === 9) {
        return `+593${digits}`;
    }

    if (raw.startsWith('+')) {
        return `+${raw.slice(1).replace(/\D/g, '')}`;
    }

    return raw;
}

document.addEventListener('DOMContentLoaded', function() {
    const serviceSelect = document.getElementById('serviceSelect');
    const priceSummary = document.getElementById('priceSummary');
    const subtotalEl = document.getElementById('subtotalPrice');
    const ivaEl = document.getElementById('ivaPrice');
    const totalEl = document.getElementById('totalPrice');
    const dateInput = document.querySelector('input[name="date"]');
    const timeSelect = document.querySelector('select[name="time"]');
    const doctorSelect = document.querySelector('select[name="doctor"]');
    const phoneInput = document.querySelector('input[name="phone"]');
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

    if (doctorSelect) {
        doctorSelect.addEventListener('change', () => updateAvailableTimes().catch(() => undefined));
    }

    if (phoneInput) {
        phoneInput.addEventListener('blur', () => {
            const normalized = normalizeEcuadorPhone(phoneInput.value);
            if (normalized !== '') {
                phoneInput.value = normalized;
            }
        });
    }

    async function updateAvailableTimes() {
        const selectedDate = dateInput?.value;
        if (!selectedDate || !timeSelect) return;

        const selectedDoctor = doctorSelect?.value || '';
        const availability = await loadAvailabilityData();
        const bookedSlots = await getBookedSlots(selectedDate, selectedDoctor);
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
            const casePhotoFiles = getCasePhotoFiles(this);
            validateCasePhotoFiles(casePhotoFiles);
            const privacyConsent = formData.get('privacyConsent') === 'on';

            if (!privacyConsent) {
                throw new Error(
                    currentLang === 'es'
                        ? 'Debes aceptar el tratamiento de datos para continuar.'
                        : 'You must accept data processing to continue.'
                );
            }

            const normalizedPhone = normalizeEcuadorPhone(formData.get('phone'));

            const appointment = {
                service: formData.get('service'),
                doctor: formData.get('doctor'),
                date: formData.get('date'),
                time: formData.get('time'),
                name: formData.get('name'),
                email: formData.get('email'),
                phone: normalizedPhone,
                reason: formData.get('reason') || '',
                affectedArea: formData.get('affectedArea') || '',
                evolutionTime: formData.get('evolutionTime') || '',
                privacyConsent,
                casePhotoFiles,
                casePhotoUploads: [],
                price: totalEl.textContent
            };

            markBookingViewed('form_submit');

            const bookedSlots = await getBookedSlots(appointment.date, appointment.doctor);
            if (bookedSlots.includes(appointment.time)) {
                showToast('Este horario ya fue reservado. Por favor selecciona otro.', 'error');
                await updateAvailableTimes();
                return;
            }

            currentAppointment = appointment;
            startCheckoutSession(appointment);
            trackEvent('start_checkout', {
                service: appointment.service || '',
                doctor: appointment.doctor || '',
                checkout_entry: 'booking_form'
            });
            openPaymentModal(appointment);
        } catch (error) {
            trackEvent('booking_error', {
                stage: 'booking_form',
                error_code: normalizeAnalyticsLabel(error?.code || error?.message, 'booking_prepare_failed')
            });
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
    if (!checkoutSession.active || !checkoutSession.startedAt) {
        startCheckoutSession(appointment);
    }

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

function closePaymentModal(options = {}) {
    const skipAbandonTrack = options && options.skipAbandonTrack === true;
    const abandonReason = options && typeof options.reason === 'string' ? options.reason : 'modal_close';
    const modal = document.getElementById('paymentModal');
    if (!skipAbandonTrack) {
        maybeTrackCheckoutAbandon(abandonReason);
    }
    checkoutSession.active = false;
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
    const gatewayEnabled = config.enabled === true && String(config.provider || '').toLowerCase() === 'stripe';
    if (!gatewayEnabled) {
        setCardMethodEnabled(false);
        return false;
    }

    try {
        await loadStripeSdk();
    } catch (error) {
        setCardMethodEnabled(false);
        return false;
    }

    const enabled = typeof window.Stripe === 'function';
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

    const appointmentPayload = await buildAppointmentPayload(currentAppointment);
    const intent = await createPaymentIntent(stripTransientAppointmentFields(currentAppointment));
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

    trackEvent('payment_success', {
        payment_method: 'card',
        payment_provider: 'stripe',
        payment_intent_id: paymentIntent.id
    });

    const payload = {
        ...appointmentPayload,
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
    const appointmentPayload = await buildAppointmentPayload(currentAppointment);
    const payload = {
        ...appointmentPayload,
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
    const appointmentPayload = await buildAppointmentPayload(currentAppointment);
    const payload = {
        ...appointmentPayload,
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
            trackEvent('payment_method_selected', {
                payment_method: methodType || 'unknown'
            });

            if (methodType === 'card') {
                refreshCardPaymentAvailability().catch(error => {
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

        completeCheckoutSession(paymentMethod);
        closePaymentModal({ skipAbandonTrack: true });
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
        trackEvent('checkout_error', {
            stage: 'payment_submit',
            payment_method: paymentMethodUsed || getActivePaymentMethod(),
            error_code: normalizeAnalyticsLabel(error?.code || message, 'payment_failed')
        });
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
            <a href="${googleCalendarUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="flex: 1;">
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
        narvaez: 'Dra. Carolina NarvÃ¡ez',
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
    
    const title = encodeURIComponent(`Cita - Piel en ArmonÃ­a`);
    const details = encodeURIComponent(`Servicio: ${getServiceName(appointment.service)}\nDoctor: ${getDoctorName(appointment.doctor)}\nPrecio: ${appointment.price}`);
    const location = encodeURIComponent(CLINIC_ADDRESS);
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDate(startDate)}/${formatDate(endDate)}&details=${details}&location=${location}`;
}

function generateICS(appointment, startDate, endDate) {
    const formatICSDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0];
    
    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Piel en ArmonÃ­a//Consulta//ES
BEGIN:VEVENT
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:Cita - Piel en ArmonÃ­a
DESCRIPTION:Servicio: ${getServiceName(appointment.service)}\\nDoctor: ${getDoctorName(appointment.doctor)}\\nPrecio: ${appointment.price}
LOCATION:${CLINIC_ADDRESS}
END:VEVENT
END:VCALENDAR`;
}

function getServiceName(service) {
    const names = {
        consulta: 'Consulta DermatolÃ³gica',
        telefono: 'Consulta TelefÃ³nica',
        video: 'Video Consulta',
        laser: 'Tratamiento LÃ¡ser',
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
        if (e.target.id === 'paymentModal') {
            closePaymentModal();
            return;
        }
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
                currentLang === 'es' ? 'Gracias por tu reseÃ±a.' : 'Thank you for your review.',
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
                    ? 'No pudimos guardar tu reseÃ±a. Intenta nuevamente.'
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
                if (this.id === 'paymentModal') {
                    closePaymentModal();
                    return;
                }
                this.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });
    
    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                if (modal.id === 'paymentModal' && modal.classList.contains('active')) {
                    closePaymentModal();
                    return;
                }
                modal.classList.remove('active');
            });
            document.body.style.overflow = '';
            toggleMobileMenu(false);
        }
    });
});

// ========================================
// SMOOTH SCROLL
// ========================================
const nav = document.querySelector('.nav');
document.addEventListener('click', function(e) {
    const targetEl = e.target instanceof Element ? e.target : null;
    if (!targetEl) return;

    const anchor = targetEl.closest('a[href^="#"]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href || href === '#') return;

    const target = document.querySelector(href);
    if (!target) return;

    e.preventDefault();
    const navHeight = nav ? nav.offsetHeight : 0;
    const targetPosition = target.offsetTop - navHeight - 20;
    window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
    });
});

document.addEventListener('click', function(e) {
    const targetEl = e.target instanceof Element ? e.target : null;
    if (!targetEl) return;

    const waLink = targetEl.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (!waLink) return;

    const inChatContext = !!waLink.closest('#chatbotContainer') || !!waLink.closest('#chatbotWidget');
    if (!inChatContext) return;

    trackEvent('chat_handoff_whatsapp', {
        source: 'chatbot'
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

// CONFIGURACIÃ“N DE CHAT
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
const SYSTEM_PROMPT = `Eres el Dr. Virtual, asistente inteligente de la clÃ­nica dermatolÃ³gica "Piel en ArmonÃ­a" en Quito, Ecuador.

INFORMACIÃ“N DE LA CLÃNICA:
- Nombre: Piel en ArmonÃ­a
- Doctores: Dr. Javier Rosero (DermatÃ³logo ClÃ­nico) y Dra. Carolina NarvÃ¡ez (DermatÃ³loga EstÃ©tica)
- DirecciÃ³n: ${CLINIC_ADDRESS}
- TelÃ©fono/WhatsApp: +593 98 245 3672
- Contacto Dra. Carolina: ${DOCTOR_CAROLINA_PHONE} | ${DOCTOR_CAROLINA_EMAIL}
- Horario: Lunes-Viernes 9:00-18:00, SÃ¡bados 9:00-13:00
- Estacionamiento privado disponible

SERVICIOS Y PRECIOS:
- Consulta DermatolÃ³gica: $40 (incluye IVA)
- Consulta TelefÃ³nica: $25
- Video Consulta: $30
- Tratamiento LÃ¡ser: desde $150
- Rejuvenecimiento: desde $120
- Tratamiento de AcnÃ©: desde $80
- DetecciÃ³n de CÃ¡ncer de Piel: desde $70

OPCIONES DE CONSULTA ONLINE:
1. Llamada telefÃ³nica: tel:+593982453672
2. WhatsApp Video: https://wa.me/593982453672
3. Video Web (Jitsi): https://meet.jit.si/PielEnArmonia-Consulta

INSTRUCCIONES:
- SÃ© profesional, amable y empÃ¡tico
- Responde en espaÃ±ol (o en el idioma que use el paciente)
- Si el paciente tiene sÃ­ntomas graves o emergencias, recomienda acudir a urgencias
- Para agendar citas, dirige al formulario web, WhatsApp o llamada telefÃ³nica
- Si no sabes algo especÃ­fico, ofrece transferir al doctor real
- No hagas diagnÃ³sticos mÃ©dicos definitivos, solo orientaciÃ³n general
- Usa emojis ocasionalmente para ser amigable
- MantÃ©n respuestas concisas pero informativas

Tu objetivo es ayudar a los pacientes a:
1. Conocer los servicios de la clÃ­nica
2. Entender los precios
3. Agendar citas
4. Resolver dudas bÃ¡sicas sobre dermatologÃ­a
5. Conectar con un doctor real cuando sea necesario`;

function toggleChatbot() {
    const container = document.getElementById('chatbotContainer');
    chatbotOpen = !chatbotOpen;
    
    if (chatbotOpen) {
        container.classList.add('active');
        document.getElementById('chatNotification').style.display = 'none';
        scrollToBottom();
        if (!chatStartedTracked) {
            chatStartedTracked = true;
            trackEvent('chat_started', {
                source: 'widget'
            });
        }
        
        // Si es la primera vez, mostrar mensaje inicial
        if (chatHistory.length === 0) {
            // Verificar si estamos usando IA real
            const usandoIA = shouldUseRealAI();
            
            debugLog('ðŸ¤– Estado del chatbot:', usandoIA ? 'IA REAL' : 'Respuestas locales');
            
            var welcomeMsg;
            
            if (usandoIA) {
                welcomeMsg = 'Â¡Hola! Soy el <strong>Dr. Virtual</strong> de <strong>Piel en ArmonÃ­a</strong>.<br><br>';
                welcomeMsg += '<strong>Conectado con Inteligencia Artificial</strong><br><br>';
                welcomeMsg += 'Puedo ayudarte con informaciÃ³n detallada sobre:<br>';
                welcomeMsg += 'â€¢ Nuestros servicios dermatologicos<br>';
                welcomeMsg += 'â€¢ Precios de consultas y tratamientos<br>';
                welcomeMsg += 'â€¢ Agendar citas presenciales o online<br>';
                welcomeMsg += 'â€¢ Ubicacion y horarios de atencion<br>';
                welcomeMsg += 'â€¢ Resolver tus dudas sobre cuidado de la piel<br><br>';
                welcomeMsg += 'Â¿En que puedo ayudarte hoy?';
            } else {
                welcomeMsg = 'Â¡Hola! Soy el <strong>Dr. Virtual</strong> de <strong>Piel en ArmonÃ­a</strong>.<br><br>';
                welcomeMsg += 'Puedo ayudarte con informaciÃ³n sobre:<br>';
                welcomeMsg += 'â€¢ Nuestros servicios dermatologicos<br>';
                welcomeMsg += 'â€¢ Precios de consultas y tratamientos<br>';
                welcomeMsg += 'â€¢ Agendar citas presenciales o online<br>';
                welcomeMsg += 'â€¢ Ubicacion y horarios de atencion<br><br>';
                welcomeMsg += 'Â¿En que puedo ayudarte hoy?';
            }
            
            addBotMessage(welcomeMsg);
            
            // Sugerir opciones rapidas
            setTimeout(function() {
                var quickOptions = '<div class="chat-suggestions">';
                quickOptions += '<button class="chat-suggestion-btn" data-action="quick-message" data-value="services">';
                quickOptions += '<i class="fas fa-stethoscope"></i> Ver servicios';
                quickOptions += '</button>';
                quickOptions += '<button class="chat-suggestion-btn" data-action="quick-message" data-value="appointment">';
                quickOptions += '<i class="fas fa-calendar-check"></i> Agendar cita';
                quickOptions += '</button>';
                quickOptions += '<button class="chat-suggestion-btn" data-action="quick-message" data-value="prices">';
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
    if (type === 'appointment') {
        addUserMessage('Quiero agendar una cita');
        startChatBooking();
        return;
    }

    const messages = {
        services: 'Â¿QuÃ© servicios ofrecen?',
        prices: 'Â¿CuÃ¡les son los precios?',
        telemedicine: 'Â¿CÃ³mo funciona la consulta online?',
        human: 'Quiero hablar con un doctor real',
        acne: 'Tengo problemas de acnÃ©',
        laser: 'InformaciÃ³n sobre tratamientos lÃ¡ser',
        location: 'Â¿DÃ³nde estÃ¡n ubicados?'
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

    // Agregar al contexto de conversaciÃ³n (evitar duplicados)
    const lastMsg = conversationContext[conversationContext.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== text) {
        conversationContext.push({ role: 'user', content: text });
    }
}

function sanitizeBotHtml(html) {
    const allowed = ['b', 'strong', 'i', 'em', 'br', 'p', 'ul', 'ol', 'li', 'a', 'div', 'button', 'input', 'span', 'small'];
    const allowedAttrs = {
        'a': ['href', 'target', 'rel'],
        'button': ['class', 'data-action'],
        'div': ['class', 'style'],
        'input': ['type', 'id', 'min', 'style', 'value'],
        'i': ['class'],
        'span': ['class', 'style'],
        'small': ['class']
    };

    // Convertir onclick inline a data-action antes de sanitizar
    const safeHtml = html
        .replace(/onclick="handleChatBookingSelection\('([^']+)'\)"/g, 'data-action="chat-booking" data-value="$1"')
        .replace(/onclick="sendQuickMessage\('([^']+)'\)"/g, 'data-action="quick-message" data-value="$1"')
        .replace(/onclick="handleChatDateSelect\(this\.value\)"/g, 'data-action="chat-date-select"')
        .replace(/onclick="minimizeChatbot\(\)"/g, 'data-action="minimize-chat"')
        .replace(/onclick="startChatBooking\(\)"/g, 'data-action="start-booking"');

    const div = document.createElement('div');
    div.innerHTML = safeHtml;
    div.querySelectorAll('script, style, iframe, object, embed').forEach(el => el.remove());
    div.querySelectorAll('*').forEach(el => {
        const tag = el.tagName.toLowerCase();
        if (!allowed.includes(tag)) {
            el.replaceWith(document.createTextNode(el.textContent));
        } else {
            const keep = [...(allowedAttrs[tag] || []), 'data-action', 'data-value'];
            Array.from(el.attributes).forEach(attr => {
                if (!keep.includes(attr.name)) {
                    el.removeAttribute(attr.name);
                }
            });
            if (tag === 'a') {
                const href = el.getAttribute('href') || '';
                if (!/^https?:\/\/|^#/.test(href)) el.removeAttribute('href');
                if (href.startsWith('http')) {
                    el.setAttribute('target', '_blank');
                    el.setAttribute('rel', 'noopener noreferrer');
                }
            }
            // Eliminar cualquier atributo on* que haya pasado
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
            });
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
            debugLog('âš ï¸ Mensaje duplicado detectado, no se muestra');
            return;
        }
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message bot';
    
    // Solo mostrar indicador offline si se solicita explÃ­citamente (para debug)
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

// Delegated event handler for sanitized chat actions (replaces inline onclick)
document.addEventListener('click', function(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.getAttribute('data-action');
    const value = actionEl.getAttribute('data-value') || '';
    switch (action) {
        case 'toast-close':
            actionEl.closest('.toast')?.remove();
            break;
        case 'set-theme':
            setThemeMode(value || 'system');
            break;
        case 'set-language':
            changeLanguage(value || 'es');
            break;
        case 'toggle-mobile-menu':
            toggleMobileMenu();
            break;
        case 'start-web-video':
            startWebVideo();
            break;
        case 'open-review-modal':
            openReviewModal();
            break;
        case 'close-review-modal':
            closeReviewModal();
            break;
        case 'close-video-modal':
            closeVideoModal();
            break;
        case 'close-payment-modal':
            closePaymentModal();
            break;
        case 'process-payment':
            processPayment();
            break;
        case 'close-success-modal':
            closeSuccessModal();
            break;
        case 'close-reschedule-modal':
            closeRescheduleModal();
            break;
        case 'submit-reschedule':
            submitReschedule();
            break;
        case 'toggle-chatbot':
            toggleChatbot();
            break;
        case 'send-chat-message':
            sendChatMessage();
            break;
        case 'chat-booking':
            handleChatBookingSelection(value);
            break;
        case 'quick-message':
            sendQuickMessage(value);
            break;
        case 'minimize-chat':
            minimizeChatbot();
            break;
        case 'start-booking':
            startChatBooking();
            break;
    }
});
document.addEventListener('change', function(e) {
    if (e.target.closest('[data-action="chat-date-select"]')) {
        handleChatDateSelect(e.target.value);
    }
});

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
// BOOKING CONVERSACIONAL DESDE CHATBOT
// ========================================
let chatBooking = null;

const CHAT_SERVICES = [
    { key: 'consulta', label: 'Consulta Presencial', price: '$44.80' },
    { key: 'telefono', label: 'Consulta Telefonica', price: '$28.00' },
    { key: 'video', label: 'Video Consulta', price: '$33.60' },
    { key: 'laser', label: 'Tratamiento Laser', price: '$168.00' },
    { key: 'rejuvenecimiento', label: 'Rejuvenecimiento', price: '$134.40' }
];

const CHAT_DOCTORS = [
    { key: 'rosero', label: 'Dr. Javier Rosero' },
    { key: 'narvaez', label: 'Dra. Carolina NarvÃ¡ez' },
    { key: 'indiferente', label: 'Cualquiera' }
];

function startChatBooking() {
    chatBooking = { step: 'service' };
    let msg = 'Vamos a agendar tu cita paso a paso.<br><br>';
    msg += '<strong>Paso 1/7:</strong> Â¿Que servicio necesitas?<br><br>';
    msg += '<div class="chat-suggestions">';
    CHAT_SERVICES.forEach(s => {
        msg += `<button class="chat-suggestion-btn" data-action="chat-booking" data-value="${s.key}">${escapeHtml(s.label)} (${s.price})</button>`;
    });
    msg += '</div>';
    addBotMessage(msg);
}

function cancelChatBooking() {
    chatBooking = null;
    addBotMessage('Reserva cancelada. Si necesitas algo mas, estoy aqui para ayudarte.');
}

function handleChatBookingSelection(value) {
    addUserMessage(value);
    processChatBookingStep(value);
}

function handleChatDateSelect(value) {
    if (value) {
        addUserMessage(value);
        processChatBookingStep(value);
    }
}

async function processChatBookingStep(userInput) {
    if (!chatBooking) return;
    const input = userInput.trim();

    if (/cancelar|salir|no quiero/i.test(input)) {
        cancelChatBooking();
        return;
    }

    switch (chatBooking.step) {
        case 'service': {
            const service = CHAT_SERVICES.find(s => s.key === input || s.label.toLowerCase() === input.toLowerCase());
            if (!service) {
                addBotMessage('Por favor selecciona un servicio valido de las opciones.');
                return;
            }
            chatBooking.service = service.key;
            chatBooking.serviceLabel = service.label;
            chatBooking.price = service.price;
            chatBooking.step = 'doctor';

            let msg = `Servicio: <strong>${escapeHtml(service.label)}</strong> (${service.price})<br><br>`;
            msg += '<strong>Paso 2/7:</strong> Â¿Con que doctor prefieres?<br><br>';
            msg += '<div class="chat-suggestions">';
            CHAT_DOCTORS.forEach(d => {
                msg += `<button class="chat-suggestion-btn" data-action="chat-booking" data-value="${d.key}">${escapeHtml(d.label)}</button>`;
            });
            msg += '</div>';
            addBotMessage(msg);
            break;
        }

        case 'doctor': {
            const doctor = CHAT_DOCTORS.find(d => d.key === input || d.label.toLowerCase() === input.toLowerCase());
            if (!doctor) {
                addBotMessage('Por favor selecciona un doctor de las opciones.');
                return;
            }
            chatBooking.doctor = doctor.key;
            chatBooking.doctorLabel = doctor.label;
            chatBooking.step = 'date';

            const today = new Date().toISOString().split('T')[0];
            let msg = `Doctor: <strong>${escapeHtml(doctor.label)}</strong><br><br>`;
            msg += '<strong>Paso 3/7:</strong> Â¿Que fecha prefieres?<br><br>';
            msg += `<input type="date" id="chatDateInput" min="${today}" `;
            msg += `data-action="chat-date-select" `;
            msg += `style="padding: 10px 14px; border: 1px solid #d2d2d7; border-radius: 10px; font-size: 1rem; width: 100%; max-width: 220px; cursor: pointer;">`;
            addBotMessage(msg);
            break;
        }

        case 'date': {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(input)) {
                addBotMessage('Por favor selecciona una fecha valida (usa el calendario).');
                return;
            }
            const selectedDate = new Date(input + 'T12:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (selectedDate < today) {
                addBotMessage('La fecha debe ser hoy o en el futuro. Selecciona otra fecha.');
                return;
            }
            chatBooking.date = input;
            chatBooking.step = 'time';

            showTypingIndicator();
            try {
                const availability = await loadAvailabilityData();
                const booked = await getBookedSlots(input, chatBooking.doctor || '');
                let allSlots = availability[input] && availability[input].length > 0
                    ? availability[input]
                    : ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00'];
                const freeSlots = allSlots.filter(s => !booked.includes(s)).sort();

                removeTypingIndicator();

                if (freeSlots.length === 0) {
                    addBotMessage('No hay horarios disponibles para esa fecha. Por favor elige otra.<br><br>' +
                        `<input type="date" id="chatDateInput" min="${new Date().toISOString().split('T')[0]}" ` +
                        `data-action="chat-date-select" ` +
                        `style="padding: 10px 14px; border: 1px solid #d2d2d7; border-radius: 10px; font-size: 1rem; width: 100%; max-width: 220px;">`);
                    chatBooking.step = 'date';
                    return;
                }

                const dateLabel = selectedDate.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
                let msg = `Fecha: <strong>${escapeHtml(dateLabel)}</strong><br><br>`;
                msg += '<strong>Paso 4/7:</strong> Horarios disponibles:<br><br>';
                msg += '<div class="chat-suggestions">';
                freeSlots.forEach(time => {
                    msg += `<button class="chat-suggestion-btn" data-action="chat-booking" data-value="${time}">${time}</button>`;
                });
                msg += '</div>';
                addBotMessage(msg);
            } catch (err) {
                removeTypingIndicator();
                addBotMessage('No pude consultar los horarios. Intenta de nuevo.');
                chatBooking.step = 'date';
            }
            break;
        }

        case 'time': {
            if (!/^\d{2}:\d{2}$/.test(input)) {
                addBotMessage('Por favor selecciona un horario valido de las opciones.');
                return;
            }
            chatBooking.time = input;
            chatBooking.step = 'name';
            addBotMessage(`Hora: <strong>${escapeHtml(input)}</strong><br><br><strong>Paso 5/7:</strong> Â¿Cual es tu nombre completo?`);
            break;
        }

        case 'name': {
            if (input.length < 2) {
                addBotMessage('El nombre debe tener al menos 2 caracteres.');
                return;
            }
            chatBooking.name = input;
            chatBooking.step = 'email';
            addBotMessage(`Nombre: <strong>${escapeHtml(input)}</strong><br><br><strong>Paso 6/7:</strong> Â¿Cual es tu email?`);
            break;
        }

        case 'email': {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input)) {
                addBotMessage('El formato del email no es valido. Ejemplo: nombre@correo.com');
                return;
            }
            chatBooking.email = input;
            chatBooking.step = 'phone';
            addBotMessage(`Email: <strong>${escapeHtml(input)}</strong><br><br><strong>Paso 7/7:</strong> Â¿Cual es tu numero de telefono?`);
            break;
        }

        case 'phone': {
            const digits = input.replace(/\D/g, '');
            if (digits.length < 7 || digits.length > 15) {
                addBotMessage('El telefono debe tener entre 7 y 15 digitos.');
                return;
            }
            chatBooking.phone = input;
            chatBooking.step = 'payment';

            let msg = `Telefono: <strong>${escapeHtml(input)}</strong><br><br>`;
            msg += '<strong>Resumen de tu cita:</strong><br>';
            msg += `â€¢ Servicio: ${escapeHtml(chatBooking.serviceLabel)} (${chatBooking.price})<br>`;
            msg += `â€¢ Doctor: ${escapeHtml(chatBooking.doctorLabel)}<br>`;
            msg += `â€¢ Fecha: ${escapeHtml(chatBooking.date)}<br>`;
            msg += `â€¢ Hora: ${escapeHtml(chatBooking.time)}<br>`;
            msg += `â€¢ Nombre: ${escapeHtml(chatBooking.name)}<br>`;
            msg += `â€¢ Email: ${escapeHtml(chatBooking.email)}<br>`;
            msg += `â€¢ Telefono: ${escapeHtml(chatBooking.phone)}<br><br>`;
            msg += 'Â¿Como deseas pagar?<br><br>';
            msg += '<div class="chat-suggestions">';
            msg += '<button class="chat-suggestion-btn" data-action="chat-booking" data-value="efectivo"><i class="fas fa-money-bill-wave"></i> Efectivo</button>';
            msg += '<button class="chat-suggestion-btn" data-action="chat-booking" data-value="tarjeta"><i class="fas fa-credit-card"></i> Tarjeta</button>';
            msg += '<button class="chat-suggestion-btn" data-action="chat-booking" data-value="transferencia"><i class="fas fa-university"></i> Transferencia</button>';
            msg += '</div>';
            addBotMessage(msg);
            break;
        }

        case 'payment': {
            const paymentMap = {
                'efectivo': 'cash', 'cash': 'cash',
                'tarjeta': 'card', 'card': 'card',
                'transferencia': 'transfer', 'transfer': 'transfer'
            };
            const method = paymentMap[input.toLowerCase()];
            if (!method) {
                addBotMessage('Elige un metodo de pago: Efectivo, Tarjeta o Transferencia.');
                return;
            }

            chatBooking.paymentMethod = method;
            chatBooking.step = 'confirm';
            await finalizeChatBooking();
            break;
        }
    }
}

async function finalizeChatBooking() {
    if (!chatBooking) return;

    const appointment = {
        service: chatBooking.service,
        doctor: chatBooking.doctor,
        date: chatBooking.date,
        time: chatBooking.time,
        name: chatBooking.name,
        email: chatBooking.email,
        phone: chatBooking.phone,
        privacyConsent: true,
        price: chatBooking.price
    };

    startCheckoutSession(appointment);
    trackEvent('start_checkout', {
        service: appointment.service || '',
        doctor: appointment.doctor || '',
        checkout_entry: 'chatbot'
    });
    trackEvent('payment_method_selected', {
        payment_method: chatBooking.paymentMethod || 'unknown'
    });

    if (chatBooking.paymentMethod === 'cash') {
        showTypingIndicator();
        try {
            const payload = {
                ...appointment,
                paymentMethod: 'cash',
                paymentStatus: 'pending_cash',
                status: 'confirmed'
            };
            const result = await createAppointmentRecord(payload);
            removeTypingIndicator();
            currentAppointment = result.appointment;
            completeCheckoutSession('cash');

            let msg = '<strong>Â¡Cita agendada con exito!</strong><br><br>';
            msg += 'Tu cita ha sido registrada. ';
            if (result.emailSent) {
                msg += 'Te enviamos un correo de confirmacion.<br><br>';
            } else {
                msg += 'Te contactaremos para confirmar detalles.<br><br>';
            }
            msg += `â€¢ Servicio: ${escapeHtml(chatBooking.serviceLabel)}<br>`;
            msg += `â€¢ Doctor: ${escapeHtml(chatBooking.doctorLabel)}<br>`;
            msg += `â€¢ Fecha: ${escapeHtml(chatBooking.date)}<br>`;
            msg += `â€¢ Hora: ${escapeHtml(chatBooking.time)}<br>`;
            msg += `â€¢ Pago: En consultorio<br><br>`;
            msg += 'Recuerda llegar 10 minutos antes de tu cita.';
            addBotMessage(msg);
            showToast('Cita agendada correctamente desde el asistente.', 'success');
            chatBooking = null;
        } catch (err) {
            removeTypingIndicator();
            addBotMessage(`No se pudo registrar la cita: ${escapeHtml(err.message || 'Error desconocido')}. Intenta de nuevo o agenda desde <a href="#citas" data-action="minimize-chat">el formulario</a>.`);
            chatBooking.step = 'payment';
        }
    } else {
        // Tarjeta o transferencia: abrir modal de pago existente
        currentAppointment = appointment;
        const method = chatBooking.paymentMethod;
        chatBooking = null;

        addBotMessage(`Abriendo el modulo de pago por <strong>${method === 'card' ? 'tarjeta' : 'transferencia'}</strong>...<br>Completa el pago en la ventana que se abrira.`);

        setTimeout(() => {
            minimizeChatbot();
            openPaymentModal(appointment);
            // Activar la tab correcta del modal de pago
            setTimeout(() => {
                const methodEl = document.querySelector(`.payment-method[data-method="${method}"]`);
                if (methodEl && !methodEl.classList.contains('disabled')) {
                    methodEl.click();
                }
            }, 300);
        }, 800);
    }
}

// ========================================
// INTEGRACION CON BOT DEL SERVIDOR (DEFERRED)
// ========================================
let figoChatEnginePromise = null;

function loadFigoChatEngine() {
    if (window.FigoChatEngine) {
        return Promise.resolve(window.FigoChatEngine);
    }

    if (figoChatEnginePromise) {
        return figoChatEnginePromise;
    }

    figoChatEnginePromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-figo-chat-engine="true"]');
        if (existing) {
            existing.addEventListener('load', () => {
                if (window.FigoChatEngine) {
                    resolve(window.FigoChatEngine);
                } else {
                    reject(new Error('Figo chat engine unavailable after load'));
                }
            }, { once: true });
            existing.addEventListener('error', () => reject(new Error('No se pudo cargar chat-engine.js')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = '/chat-engine.js?v=figo-chat-20260218-phase2';
        script.async = true;
        script.defer = true;
        script.dataset.figoChatEngine = 'true';
        script.onload = () => {
            if (window.FigoChatEngine) {
                resolve(window.FigoChatEngine);
                return;
            }
            reject(new Error('Figo chat engine loaded without API'));
        };
        script.onerror = () => reject(new Error('No se pudo cargar chat-engine.js'));
        document.head.appendChild(script);
    }).catch((error) => {
        figoChatEnginePromise = null;
        throw error;
    });

    return figoChatEnginePromise;
}

function initChatEngineWarmup() {
    let warmed = false;
    const markWarmed = () => {
        warmed = true;
    };
    const warmup = () => {
        if (warmed || window.location.protocol === 'file:') {
            return;
        }
        loadFigoChatEngine().then(markWarmed).catch(() => undefined);
    };

    const bindWarmup = (selector, eventName) => {
        const element = document.querySelector(selector);
        if (!element) {
            return;
        }
        element.addEventListener(eventName, warmup, { once: true, passive: true });
    };

    bindWarmup('#chatbotWidget .chatbot-toggle', 'mouseenter');
    bindWarmup('#chatbotWidget .chatbot-toggle', 'touchstart');
    bindWarmup('#chatInput', 'focus');

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isConstrainedNetwork = !!(connection && (
        connection.saveData === true
        || /(^|[^0-9])2g/.test(String(connection.effectiveType || ''))
    ));

    if (isConstrainedNetwork) {
        return;
    }

    const idleWarmup = () => warmup();
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(idleWarmup, { timeout: 7000 });
    } else {
        setTimeout(idleWarmup, 7000);
    }
}

async function processWithKimi(message) {
    try {
        const engine = await loadFigoChatEngine();
        return engine.processWithKimi(message);
    } catch (error) {
        console.error('Error cargando motor de chat:', error);
        removeTypingIndicator();
        addBotMessage('No se pudo iniciar el asistente en este momento. Intenta de nuevo o escríbenos por WhatsApp: <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">+593 98 245 3672</a>.', false);
    }
}

function resetConversation() {
    loadFigoChatEngine().then(engine => engine.resetConversation()).catch(() => {
        showToast('No se pudo reiniciar la conversacion.', 'warning');
    });
}

function forzarModoIA() {
    loadFigoChatEngine().then(engine => engine.forzarModoIA()).catch(() => {
        showToast('No se pudo activar modo IA.', 'warning');
    });
}

function mostrarInfoDebug() {
    loadFigoChatEngine().then(engine => engine.mostrarInfoDebug()).catch(() => {
        showToast('No se pudo mostrar informacion de debug.', 'warning');
    });
}

function checkServerEnvironment() {
    if (window.location.protocol === 'file:') {
        setTimeout(() => {
            showToast('Para usar funciones online, abre el sitio en un servidor local. Ver SERVIDOR-LOCAL.md', 'warning', 'Servidor requerido');
        }, 2000);
        return false;
    }
    return true;
}

setTimeout(() => {
    const notification = document.getElementById('chatNotification');
    if (notification && !chatbotOpen && chatHistory.length === 0) {
        notification.style.display = 'flex';
    }
}, 30000);
// ========================================
// REPROGRAMACIÃ“N ONLINE
// ========================================
let _rescheduleToken = '';
let _rescheduleAppt = null;

async function checkRescheduleParam() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reschedule');
    if (!token) return;
    _rescheduleToken = token;
    try {
        const resp = await apiRequest('reschedule', { query: { token } });
        if (resp.ok && resp.data) {
            _rescheduleAppt = resp.data;
            openRescheduleModal(resp.data);
        } else {
            showToast(resp.error || 'Enlace de reprogramaciÃ³n invÃ¡lido.', 'error');
        }
    } catch (err) {
        showToast('No se pudo cargar la cita. Verifica el enlace.', 'error');
    }
}

function openRescheduleModal(appt) {
    const modal = document.getElementById('rescheduleModal');
    if (!modal) return;
    const info = document.getElementById('rescheduleInfo');
    if (info) {
        const doctorLabel = appt.doctor === 'rosero' ? 'Dr. Javier Rosero' :
            appt.doctor === 'narvaez' ? 'Dra. Carolina NarvÃ¡ez' : appt.doctor;
        info.innerHTML =
            '<p><strong>' + (currentLang === 'es' ? 'Paciente' : 'Patient') + ':</strong> ' + escapeHTML(appt.name) + '</p>' +
            '<p><strong>' + (currentLang === 'es' ? 'Servicio' : 'Service') + ':</strong> ' + escapeHTML(appt.service) + '</p>' +
            '<p><strong>' + (currentLang === 'es' ? 'Doctor' : 'Doctor') + ':</strong> ' + escapeHTML(doctorLabel) + '</p>' +
            '<p><strong>' + (currentLang === 'es' ? 'Fecha actual' : 'Current date') + ':</strong> ' + escapeHTML(appt.date) + ' ' + escapeHTML(appt.time) + '</p>';
    }
    const dateInput = document.getElementById('rescheduleDate');
    if (dateInput) {
        dateInput.min = new Date().toISOString().split('T')[0];
        dateInput.value = '';
        dateInput.addEventListener('change', loadRescheduleSlots);
    }
    document.getElementById('rescheduleTime').innerHTML = '<option value="">' + (currentLang === 'es' ? 'Selecciona un horario' : 'Select a time') + '</option>';
    document.getElementById('rescheduleError').style.display = 'none';
    modal.classList.add('active');
}

function closeRescheduleModal() {
    const modal = document.getElementById('rescheduleModal');
    if (modal) modal.classList.remove('active');
    // limpiar parÃ¡metro de URL
    if (window.history.replaceState) {
        const url = new URL(window.location);
        url.searchParams.delete('reschedule');
        window.history.replaceState({}, '', url);
    }
}

async function loadRescheduleSlots() {
    const dateInput = document.getElementById('rescheduleDate');
    const timeSelect = document.getElementById('rescheduleTime');
    if (!dateInput || !timeSelect || !_rescheduleAppt) return;

    const selectedDate = dateInput.value;
    if (!selectedDate) return;

    timeSelect.innerHTML = '<option value="">' + (currentLang === 'es' ? 'Cargando...' : 'Loading...') + '</option>';

    try {
        const availability = await loadAvailabilityData();
        const daySlots = availability[selectedDate] || DEFAULT_TIME_SLOTS;
        const booked = await getBookedSlots(selectedDate, _rescheduleAppt.doctor || '');

        const freeSlots = daySlots.filter(s => !booked.includes(s));
        timeSelect.innerHTML = '<option value="">' + (currentLang === 'es' ? 'Selecciona un horario' : 'Select a time') + '</option>';
        freeSlots.forEach(slot => {
            const opt = document.createElement('option');
            opt.value = slot;
            opt.textContent = slot;
            timeSelect.appendChild(opt);
        });

        if (freeSlots.length === 0) {
            timeSelect.innerHTML = '<option value="">' + (currentLang === 'es' ? 'Sin horarios disponibles' : 'No slots available') + '</option>';
        }
    } catch (err) {
        timeSelect.innerHTML = '<option value="">' + (currentLang === 'es' ? 'Error al cargar horarios' : 'Error loading slots') + '</option>';
    }
}

async function submitReschedule() {
    const dateInput = document.getElementById('rescheduleDate');
    const timeSelect = document.getElementById('rescheduleTime');
    const errorDiv = document.getElementById('rescheduleError');
    const btn = document.getElementById('rescheduleSubmitBtn');
    if (!dateInput || !timeSelect) return;

    const newDate = dateInput.value;
    const newTime = timeSelect.value;
    errorDiv.style.display = 'none';

    if (!newDate || !newTime) {
        errorDiv.textContent = currentLang === 'es' ? 'Selecciona fecha y horario.' : 'Select date and time.';
        errorDiv.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.textContent = currentLang === 'es' ? 'Reprogramando...' : 'Rescheduling...';

    try {
        const resp = await apiRequest('reschedule', {
            method: 'PATCH',
            body: { token: _rescheduleToken, date: newDate, time: newTime }
        });
        if (resp.ok) {
            const oldDate = _rescheduleAppt?.date || '';
            const doctor = _rescheduleAppt?.doctor || '';
            invalidateBookedSlotsCache(oldDate, doctor);
            invalidateBookedSlotsCache(newDate, doctor);
            closeRescheduleModal();
            showToast(currentLang === 'es' ? 'Â¡Cita reprogramada exitosamente!' : 'Appointment rescheduled successfully!', 'success');
        } else {
            errorDiv.textContent = resp.error || 'Error al reprogramar.';
            errorDiv.style.display = 'block';
        }
    } catch (err) {
        errorDiv.textContent = currentLang === 'es' ? 'Error de conexiÃ³n. IntÃ©ntalo de nuevo.' : 'Connection error. Try again.';
        errorDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = currentLang === 'es' ? 'Confirmar reprogramaciÃ³n' : 'Confirm reschedule';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initThemeMode();
    changeLanguage(currentLang);
    initCookieBanner();
    initGA4();
    initBookingFunnelObserver();
    initDeferredSectionPrefetch();
    initDeferredGalleryInteractions();
    initChatEngineWarmup();
    checkRescheduleParam();
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', handleChatKeypress);
    }
    window.addEventListener('pagehide', () => {
        maybeTrackCheckoutAbandon('page_hide');
    });
    const isServer = checkServerEnvironment();

    if (!isServer) {
        console.warn('Chatbot en modo offline: abre el sitio desde servidor para usar IA real.');
    }
});

// ========================================
// ANIMACIONES APPLE - SCROLL
// ========================================

// AnimaciÃ³n de elementos al hacer scroll
function initScrollAnimations() {
    const targets = document.querySelectorAll('.service-card, .team-card, .section-header, .tele-card, .review-card');
    if (!targets.length) return;

    const shouldSkipObserver = window.innerWidth < 900
        || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    if (shouldSkipObserver) {
        targets.forEach(el => el.classList.add('visible'));
        return;
    }

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
    targets.forEach(el => {
        el.classList.add('animate-on-scroll');
        observer.observe(el);
    });
}

// Efecto parallax suave en el hero
function initParallax() {
    const heroImage = document.querySelector('.hero-image-container');
    if (!heroImage) return;
    if (window.innerWidth < 1100) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    
    let ticking = false;
    
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const scrolled = window.pageYOffset;
                const rate = Math.min(80, scrolled * 0.12);
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

    let ticking = false;
    let isScrolled = false;

    const applyScrollState = () => {
        const shouldBeScrolled = window.scrollY > 50;
        if (shouldBeScrolled !== isScrolled) {
            nav.classList.toggle('scrolled', shouldBeScrolled);
            isScrolled = shouldBeScrolled;
        }
        ticking = false;
    };

    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(applyScrollState);
    }, { passive: true });

    applyScrollState();
}

// Inicializar animaciones cuando el DOM estÃ© listo
function initDeferredVisualEffects() {
    const run = () => {
        initScrollAnimations();
        initParallax();
    };

    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(run, { timeout: 1200 });
    } else {
        setTimeout(run, 180);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initNavbarScroll();
        initDeferredVisualEffects();
    });
} else {
    initNavbarScroll();
    initDeferredVisualEffects();
}


