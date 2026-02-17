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
    
    toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${titles[type]}</div>
            <div class="toast-message">${message}</div>
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
        benefit_2: "Pago seguro",
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
        btn_pay: "Pagar Ahora",
        success_title: "¡Cita Confirmada!",
        success_desc: "Hemos enviado los detalles de tu cita a tu email.",
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
        benefit_2: "Secure payment",
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
        btn_pay: "Pay Now",
        success_title: "Appointment Confirmed!",
        success_desc: "We have sent the details of your appointment to your email.",
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

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('language', lang);
    
    // Update buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    
    // Update all elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (translations[lang][key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = translations[lang][key];
            } else {
                el.innerHTML = translations[lang][key];
            }
        }
    });
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
    
    // Price calculation
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
        
        // Update available times based on availability
        updateAvailableTimes();
    });
    
    // Date change - update available times
    if (dateInput) {
        dateInput.min = new Date().toISOString().split('T')[0];
        dateInput.addEventListener('change', updateAvailableTimes);
    }
    
    // Update available times based on admin availability
    function updateAvailableTimes() {
        const selectedDate = dateInput?.value;
        if (!selectedDate || !timeSelect) return;
        
        const availability = JSON.parse(localStorage.getItem('availability') || '{}');
        const appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
        
        // Get available slots for this date
        const availableSlots = availability[selectedDate] || ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00'];
        
        // Get booked slots
        const bookedSlots = appointments
            .filter(a => a.date === selectedDate && a.status !== 'cancelled')
            .map(a => a.time);
        
        // Filter out booked slots
        const freeSlots = availableSlots.filter(slot => !bookedSlots.includes(slot));
        
        // Update time select
        const currentValue = timeSelect.value;
        timeSelect.innerHTML = '<option value="">Hora</option>';
        
        if (freeSlots.length === 0) {
            timeSelect.innerHTML += '<option value="" disabled>No hay horarios disponibles</option>';
            showToast('No hay horarios disponibles para esta fecha', 'warning');
        } else {
            freeSlots.forEach(time => {
                const option = document.createElement('option');
                option.value = time;
                option.textContent = time;
                if (time === currentValue) option.selected = true;
                timeSelect.appendChild(option);
            });
        }
    }
    
    // Appointment form submission
    const appointmentForm = document.getElementById('appointmentForm');
    if (appointmentForm) {
        appointmentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalContent = submitBtn.innerHTML;
            
            // Loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
            
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
            
            // Validate slot is still available
            const appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
            const isSlotTaken = appointments.some(a => 
                a.date === appointment.date && 
                a.time === appointment.time && 
                a.status !== 'cancelled'
            );
            
            if (isSlotTaken) {
                showToast('Este horario ya fue reservado. Por favor selecciona otro.', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalContent;
                updateAvailableTimes();
                return;
            }
            
            localStorage.setItem('currentAppointment', JSON.stringify(appointment));
            
            // Restore button
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalContent;
            
            openPaymentModal();
        });
    }
});

// ========================================
// PAYMENT MODAL
// ========================================
function openPaymentModal() {
    const modal = document.getElementById('paymentModal');
    const appointment = JSON.parse(localStorage.getItem('currentAppointment') || '{}');
    
    document.getElementById('paymentTotal').textContent = appointment.price || '$0.00';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Payment method selection
document.addEventListener('DOMContentLoaded', function() {
    const paymentMethods = document.querySelectorAll('.payment-method');
    const paymentForms = document.querySelectorAll('.payment-form');
    
    paymentMethods.forEach(method => {
        method.addEventListener('click', () => {
            paymentMethods.forEach(m => m.classList.remove('active'));
            method.classList.add('active');
            
            const methodType = method.dataset.method;
            paymentForms.forEach(form => form.style.display = 'none');
            document.querySelector(`.${methodType}-form`).style.display = 'block';
        });
    });
});

function processPayment() {
    const btn = document.querySelector('#paymentModal .btn-primary');
    const originalContent = btn.innerHTML;
    
    // Loading state
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
    
    setTimeout(() => {
        closePaymentModal();
        showSuccessModal();
        
        // Restore button
        btn.disabled = false;
        btn.innerHTML = originalContent;
        
        // Save appointment to history
        const appointment = JSON.parse(localStorage.getItem('currentAppointment') || '{}');
        let history = JSON.parse(localStorage.getItem('appointments') || '[]');
        appointment.id = Date.now();
        appointment.status = 'confirmed';
        appointment.dateBooked = new Date().toISOString();
        history.push(appointment);
        localStorage.setItem('appointments', JSON.stringify(history));
        
        showToast('Cita reservada correctamente', 'success');
        
        // Reset form
        document.getElementById('appointmentForm').reset();
        document.getElementById('priceSummary').style.display = 'none';
    }, 1500);
}

// ========================================
// SUCCESS MODAL
// ========================================
function showSuccessModal() {
    const modal = document.getElementById('successModal');
    const appointment = JSON.parse(localStorage.getItem('currentAppointment') || '{}');
    const detailsDiv = document.getElementById('appointmentDetails');
    
    // Generate Google Calendar link
    const startDate = new Date(`${appointment.date}T${appointment.time}`);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration
    
    const googleCalendarUrl = generateGoogleCalendarUrl(appointment, startDate, endDate);
    const icsContent = generateICS(appointment, startDate, endDate);
    const icsBlob = new Blob([icsContent], { type: 'text/calendar' });
    const icsUrl = URL.createObjectURL(icsBlob);
    
    detailsDiv.innerHTML = `
        <div style="background: #f5f5f7; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: left;">
            <p style="margin-bottom: 8px;"><strong>${currentLang === 'es' ? 'Doctor:' : 'Doctor:'}</strong> ${getDoctorName(appointment.doctor)}</p>
            <p style="margin-bottom: 8px;"><strong>${currentLang === 'es' ? 'Fecha:' : 'Date:'}</strong> ${appointment.date}</p>
            <p style="margin-bottom: 8px;"><strong>${currentLang === 'es' ? 'Hora:' : 'Time:'}</strong> ${appointment.time}</p>
            <p><strong>${currentLang === 'es' ? 'Total:' : 'Total:'}</strong> ${appointment.price}</p>
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
        narvaez: 'Dra. Carolina Narváez',
        indiferente: 'Primera disponible'
    };
    return names[doctor] || doctor;
}

function generateGoogleCalendarUrl(appointment, startDate, endDate) {
    const formatDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const title = encodeURIComponent(`Cita - Piel en Armonía`);
    const details = encodeURIComponent(`Servicio: ${getServiceName(appointment.service)}\nDoctor: ${getDoctorName(appointment.doctor)}\nPrecio: ${appointment.price}`);
    const location = encodeURIComponent('Valparaíso 13-183 y Sodiro, Quito, Ecuador');
    
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
LOCATION:Valparaíso 13-183 y Sodiro, Quito, Ecuador
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
        callbackForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalContent = submitBtn.innerHTML;
            
            // Loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
            
            const formData = new FormData(this);
            const callback = {
                telefono: formData.get('telefono'),
                preferencia: formData.get('preferencia'),
                fecha: new Date().toISOString(),
                status: 'pendiente'
            };
            
            let callbacks = JSON.parse(localStorage.getItem('callbacks') || '[]');
            callbacks.push(callback);
            localStorage.setItem('callbacks', JSON.stringify(callbacks));
            
            // Show toast
            showToast(
                currentLang === 'es' 
                    ? '¡Solicitud enviada! El doctor te llamará pronto.' 
                    : 'Request sent! The doctor will call you soon.',
                'success'
            );
            
            // Restore button
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalContent;
            
            this.reset();
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
    
    // Review form
    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) {
        reviewForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (selectedRating === 0) {
                alert(currentLang === 'es' ? 'Por favor selecciona una calificación' : 'Please select a rating');
                return;
            }
            
            const formData = new FormData(this);
            const review = {
                name: formData.get('reviewerName'),
                rating: selectedRating,
                text: formData.get('reviewText'),
                date: new Date().toISOString(),
                verified: true
            };
            
            let reviews = JSON.parse(localStorage.getItem('reviews') || '[]');
            reviews.unshift(review);
            localStorage.setItem('reviews', JSON.stringify(reviews));
            
            showToast(
                currentLang === 'es' 
                    ? '¡Gracias por tu reseña!' 
                    : 'Thank you for your review!',
                'success'
            );
            
            closeReviewModal();
            this.reset();
            selectedRating = 0;
            stars.forEach(s => {
                s.classList.remove('active', 'fas');
                s.classList.add('far');
            });
        });
    }
});

// ========================================
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
// CHATBOT CON KIMI AI (MOONSHOT AI)
// ========================================
let chatbotOpen = false;
let chatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
let conversationContext = [];

// CONFIGURACIÓN KIMI API
const KIMI_CONFIG = {
    apiKey: 'sk-kimi-lMIpVZxWGocfNOqaKO68Ws54Gi2lBuiFHkyBRA7VlCDWVeW0PWUAup1fUucHjHLZ',
    apiUrl: '/figo-chat.php',
    model: 'moonshot-v1-8k',
    maxTokens: 1000,
    temperature: 0.7
};

// Funcion simple para detectar si usar IA real
function shouldUseRealAI() {
    if (localStorage.getItem('forceAI') === 'true') {
        console.log('Modo IA forzado');
        return true;
    }
    
    var protocol = window.location.protocol;
    var hostname = window.location.hostname;
    
    console.log('Protocolo: ' + protocol);
    console.log('Hostname: ' + hostname);
    
    if (protocol === 'file:') {
        console.log('Modo archivo - Sin IA');
        return false;
    }
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        console.log('Localhost - Sin IA');
        return false;
    }
    
    console.log('Servidor real - Con IA');
    return true;
}

// Contexto del sistema para Kimi
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
            
            console.log('🤖 Estado del chatbot:', usandoIA ? 'IA REAL' : 'Respuestas locales');
            
            var welcomeMsg;
            
            if (usandoIA) {
                welcomeMsg = '¡Hola! Soy el <strong>Dr. Virtual</strong> de <strong>Piel en Armonia</strong>.<br><br>';
                welcomeMsg += '<strong>Conectado con Inteligencia Artificial</strong><br><br>';
                welcomeMsg += 'Puedo ayudarte con informacion detallada sobre:<br>';
                welcomeMsg += '• Nuestros servicios dermatologicos<br>';
                welcomeMsg += '• Precios de consultas y tratamientos<br>';
                welcomeMsg += '• Agendar citas presenciales o online<br>';
                welcomeMsg += '• Ubicacion y horarios de atencion<br>';
                welcomeMsg += '• Resolver tus dudas sobre cuidado de la piel<br><br>';
                welcomeMsg += '¿En que puedo ayudarte hoy?';
            } else {
                welcomeMsg = '¡Hola! Soy el <strong>Dr. Virtual</strong> de <strong>Piel en Armonia</strong>.<br><br>';
                welcomeMsg += 'Puedo ayudarte con informacion sobre:<br>';
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
    
    // Verificar si hay API key configurada
    if (!KIMI_CONFIG.apiKey || KIMI_CONFIG.apiKey === '') {
        showApiKeyModal();
        return;
    }
    
    // Procesar con Kimi AI
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
    
    if (!KIMI_CONFIG.apiKey || KIMI_CONFIG.apiKey === '') {
        showApiKeyModal();
        return;
    }
    
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
    
    // Guardar en historial
    chatHistory.push({ type: 'user', text, time: new Date().toISOString() });
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    
    // Agregar al contexto de conversación (evitar duplicados)
    const lastMsg = conversationContext[conversationContext.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== text) {
        conversationContext.push({ role: 'user', content: text });
    }
}

function addBotMessage(html, showOfflineLabel = false) {
    const messagesContainer = document.getElementById('chatMessages');
    
    // Verificar si el último mensaje es idéntico (evitar duplicados en UI)
    const lastMessage = messagesContainer.querySelector('.chat-message.bot:last-child');
    if (lastMessage) {
        const lastContent = lastMessage.querySelector('.message-content');
        if (lastContent && lastContent.innerHTML === html) {
            console.log('⚠️ Mensaje duplicado detectado, no se muestra');
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
        <div class="message-content">${offlineIndicator}${html}</div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    
    // Guardar en historial
    chatHistory.push({ type: 'bot', text: html, time: new Date().toISOString() });
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
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
// INTEGRACIÓN CON KIMI API
// ========================================
async function processWithKimi(message) {
    showTypingIndicator();
    
    // Siempre usar modo offline primero (más rápido y confiable)
    // El modo offline ahora tiene respuestas muy completas
    console.log('📝 Procesando mensaje:', message);
    
    // Intentar usar IA real solo si estamos en servidor real
    if (shouldUseRealAI()) {
        console.log('🤖 Intentando usar IA real...');
        await tryRealAI(message);
    } else {
        console.log('💬 Usando respuestas locales (modo offline)');
        setTimeout(() => {
            removeTypingIndicator();
            processLocalResponse(message, false); // false = no mostrar indicador de offline
        }, 600);
    }
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
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...conversationContext.slice(-10)
        ];
        
        const payload = {
            api_key: KIMI_CONFIG.apiKey,
            model: KIMI_CONFIG.model,
            messages: messages,
            max_tokens: KIMI_CONFIG.maxTokens,
            temperature: KIMI_CONFIG.temperature
        };
        
        console.log('🚀 Enviando a:', KIMI_CONFIG.apiUrl);
        console.log('📊 Contexto actual:', conversationContext.length, 'mensajes');
        
        const response = await fetch(KIMI_CONFIG.apiUrl + '?t=' + Date.now(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(payload)
        });
        
        console.log('📡 Status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const responseText = await response.text();
        console.log('📄 Respuesta cruda:', responseText.substring(0, 500));
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('❌ Error parseando JSON:', e);
            throw new Error('Respuesta no es JSON válido');
        }
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('❌ Estructura inválida:', data);
            throw new Error('Respuesta inválida');
        }
        
        const botResponse = data.choices[0].message.content;
        console.log('✅ Respuesta recibida:', botResponse.substring(0, 100) + '...');
        
        // Evitar duplicados: verificar si el último mensaje ya es del asistente con el mismo contenido
        const lastMsg = conversationContext[conversationContext.length - 1];
        if (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.content !== botResponse) {
            conversationContext.push({ role: 'assistant', content: botResponse });
        }
        
        removeTypingIndicator();
        addBotMessage(formatMarkdown(botResponse), false);
        console.log('💬 Mensaje mostrado en chat');
        
    } catch (error) {
        console.error('❌ Error con Kimi API:', error);
        removeTypingIndicator();
        
        // Mostrar error específico
        if (error.message.includes('Failed to fetch')) {
            addBotMessage(`<div style="color: #ff3b30;">
                <strong>Error de conexión:</strong><br>
                No se pudo conectar con el servidor.<br>
                Verifica que <code>figo-chat.php</code> exista.
            </div>`, true);
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
    
    // Comando especial: forzar IA
    if (/forzar ia|activar ia|modo ia|usar ia/.test(lowerMsg)) {
        forzarModoIA();
        return;
    }
    
    // Comando especial: debug info
    if (/debug|info sistema|informacion tecnica/.test(lowerMsg)) {
        mostrarInfoDebug();
        return;
    }
    
    // Intentar detectar intención y dar respuesta local
    let response = null;
    
    // AYUDA / MENU
    if (/ayuda|help|menu|opciones|que puedes hacer/.test(lowerMsg)) {
        response = 'Opciones disponibles:<br><br>';
        response += '<strong>Servicios:</strong> Informacion sobre consultas<br>';
        response += '<strong>Precios:</strong> Tarifas de servicios<br>';
        response += '<strong>Citas:</strong> Como agendar<br>';
        response += '<strong>Ubicacion:</strong> Direccion y horarios<br>';
        response += '<strong>Contacto:</strong> WhatsApp y telefono';
    }
    // SALUDO
    else if (/hola|buenos dias|buenas tardes|buenas noches|hey|hi|hello/.test(lowerMsg)) {
        response = '¡Hola! Soy el asistente de <strong>Piel en Armonia</strong>.<br><br>';
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
        response += '• Deteccion de cancer de piel: desde $70';
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
    else if (/donde|ubicacion|direccion|lugar|mapa|quito/.test(lowerMsg)) {
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
        response = `Entiendo tu consulta. Como estoy en modo offline, te sugiero:

<strong>Para información más detallada:</strong>
📱 <a href="https://wa.me/593982453672" target="_blank">Escríbenos por WhatsApp</a>
📞 <a href="tel:+593982453672">Llámanos: +593 98 245 3672</a>

<strong>O visita estas secciones:</strong>
• <a href="#servicios" onclick="minimizeChatbot()">Servicios</a> - Ver todos los tratamientos
• <a href="#citas" onclick="minimizeChatbot()">Reservar Cita</a> - Agenda tu consulta
• <a href="#consultorio" onclick="minimizeChatbot()">Ubicación</a> - Cómo llegar

¿Hay algo más en lo que pueda orientarte?`;
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
// CONFIGURACIÓN DE API KEY
// ========================================
function showApiKeyModal() {
    const html = `
        <div class="chat-suggestions" style="margin-top: 12px;">
            <p style="color: #ff9500; margin-bottom: 12px;">
                <i class="fas fa-exclamation-triangle"></i>
                Para usar el chatbot inteligente, necesitas configurar tu API key de Moonshot AI.
            </p>
            <button class="chat-suggestion-btn" onclick="showApiKeyInput()">
                <i class="fas fa-key"></i> Configurar API Key
            </button>
            <button class="chat-suggestion-btn" onclick="window.open('https://platform.moonshot.cn/','_blank')">
                <i class="fas fa-external-link-alt"></i> Obtener API Key
            </button>
            <button class="chat-suggestion-btn" onclick="window.open('https://wa.me/593982453672','_blank')">
                <i class="fab fa-whatsapp"></i> Hablar por WhatsApp
            </button>
        </div>
    `;
    addBotMessage(html);
}

function showApiKeyInput() {
    const apiKey = prompt('Ingresa tu API Key de Moonshot AI (Kimi):\n\nObtén tu API key en: https://platform.moonshot.cn/');
    
    if (apiKey && apiKey.trim()) {
        localStorage.setItem('kimiApiKey', apiKey.trim());
        KIMI_CONFIG.apiKey = apiKey.trim();
        showToast('API Key configurada correctamente', 'success');
        addBotMessage('¡Perfecto! API Key configurada. ¿En qué puedo ayudarte?');
    }
}

// Función para limpiar contexto cada cierto tiempo
function resetConversation() {
    conversationContext = [];
    localStorage.removeItem('chatHistory');
    chatHistory = [];
    showToast('Conversación reiniciada', 'info');
}

// Mostrar notificación después de 30 segundos en la página
setTimeout(() => {
    if (!chatbotOpen && chatHistory.length === 0) {
        document.getElementById('chatNotification').style.display = 'flex';
    }
}, 30000);

// ========================================
// DETECTAR SI SE EJECUTA DESDE FILE://
// ========================================
function checkServerEnvironment() {
    if (window.location.protocol === 'file:') {
        console.warn('⚠️ Ejecutando desde archivo local (file://)');
        console.warn('El chatbot con Kimi AI requiere un servidor web.');
        console.warn('Ver SERVIDOR-LOCAL.md para instrucciones.');
        
        // Mostrar mensaje en la consola del navegador
        setTimeout(() => {
            showToast('Para usar el chatbot con IA, necesitas un servidor web. Ver SERVIDOR-LOCAL.md', 'warning', 'Servidor requerido');
        }, 2000);
        
        return false;
    }
    return true;
}

// ========================================
// FORZAR MODO IA (para debugging)
// ========================================
function forzarModoIA() {
    KIMI_CONFIG._useRealAI = true;
    console.log('🤖 Modo IA forzado manualmente');
    showToast('Modo IA activado manualmente', 'success');
    
    // Recargar mensaje de bienvenida
    if (chatHistory.length > 0) {
        addBotMessage('<strong>✅ Modo IA activado</strong><br>Ahora estoy usando inteligencia artificial real. ¿En qué puedo ayudarte?');
    }
}

// ========================================
// MOSTRAR INFO DE DEBUG
// ========================================
function mostrarInfoDebug() {
    var usaIA = shouldUseRealAI();
    var protocolo = window.location.protocol;
    var hostname = window.location.hostname;
    var forzado = localStorage.getItem('forceAI') === 'true';
    
    var msg = '<strong>Informacion del sistema:</strong><br><br>';
    msg += 'Protocolo: ' + protocolo + '<br>';
    msg += 'Hostname: ' + hostname + '<br>';
    msg += 'Usa IA: ' + (usaIA ? 'SI' : 'NO') + '<br>';
    msg += 'Forzado: ' + (forzado ? 'SI' : 'NO') + '<br><br>';
    
    if (!usaIA) {
        msg += 'Para activar IA, escribe: forzar ia';
    } else {
        msg += 'IA activada correctamente';
    }
    
    addBotMessage(msg);
}

// ========================================
// VERIFICAR PROXY (TEST)
// ========================================
async function testProxyConnection() {
    try {
        console.log('🧪 Probando conexión con proxy...');
        const response = await fetch(KIMI_CONFIG.apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Proxy funcionando:', data);
            return true;
        } else {
            console.error('❌ Proxy respondió con error:', response.status);
            return false;
        }
    } catch (error) {
        console.error('❌ No se pudo conectar con proxy:', error);
        return false;
    }
}

// ========================================
// INITIALIZE
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    // Set initial language
    changeLanguage(currentLang);
    
    // Verificar entorno
    const isServer = checkServerEnvironment();
    
    console.log('🩺 Piel en Armonía - Loaded');
    console.log('📞 Phone: +593 98 245 3672');
    console.log('💬 WhatsApp: wa.me/593982453672');
    console.log('🤖 Chatbot: Ready');
    
    if (!isServer) {
        console.log('⚠️ Chatbot en modo offline (funciona con respuestas locales)');
    }
});
