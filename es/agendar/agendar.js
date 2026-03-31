/**
 * es/agendar/agendar.js
 * Workflow client-side renderer for Aurora Derm Public Booking S3-24
 */

document.addEventListener('DOMContentLoaded', () => {
  // State machine
  const state = {
    step: 'service', // service -> doctor -> datetime -> details -> success
    service: '',
    doctor: '',
    date: '',
    time: '',
    patient: {
      name: '',
      email: '',
      phone: ''
    },
    telemedicine: {
      reason: '',
      affectedArea: '',
      evolutionTime: '',
      privacyConsent: false
    },
    giftCardCode: '',
    loading: null,
    isSubmitting: false // S13-18 double submit lock
  };

  // Catalogue of services corresponding to AppointmentController
  let servicesCatalog = [
    { id: 'consulta', title: 'Consulta dermatológica', desc: 'Primera visita o revisión general en consultorio', price: "$50", duration: "30 min", popular: true, icon: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'></path></svg>" },
    { id: 'video', title: 'Teledermatología', desc: 'Valoración a distancia vía videollamada', price: "$40", duration: "20 min", popular: false, icon: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='2' y='7' width='16' height='10' rx='2' ry='2'></rect><polygon points='22 17 18 14 18 10 22 7 22 17'></polygon></svg>" },
    { id: 'telefono', title: 'Seguimiento telefónico', desc: 'Solo para pacientes regulares', price: "$25", duration: "15 min", popular: false, icon: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z'></path></svg>" },
    { id: 'acne', title: 'Acné y rosácea', desc: 'Tratamiento especializado de brotes', price: "$60", duration: "45 min", popular: true, icon: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6'></path></svg>" },
    { id: 'cancer', title: 'Tamizaje de cáncer de piel', desc: 'Revisión preventiva de lunares', price: "$70", duration: "40 min", popular: false, icon: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='8'></circle><line x1='21' y1='21' x2='16.65' y2='16.65'></line></svg>" },
    { id: 'laser', title: 'Láser dermatológico', desc: 'Terapias de regeneración', price: "$120", duration: "60 min", popular: false, icon: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M13 2L3 14h9l-1 8 10-12h-9l1-8z'></path></svg>" },
    { id: 'rejuvenecimiento', title: 'Rejuvenecimiento', desc: 'Bioestimuladores y estética médica', price: "$150", duration: "45 min", popular: false, icon: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'></polygon></svg>" }
  ];

  // DOM Elements
  const steps = {
    service: document.getElementById('step-service'),
    doctor: document.getElementById('step-doctor'),
    datetime: document.getElementById('step-datetime'),
    details: document.getElementById('step-details'),
    telemedicinaIntake: document.getElementById('step-telemedicina-intake'),
    waitlist: document.getElementById('step-waitlist'),
    success: document.getElementById('step-success'),
    waitlistSuccess: document.getElementById('step-waitlist-success')
  };

  const btnNextService = document.getElementById('btn-next-service');
  const btnPrevDoctor = document.getElementById('btn-prev-doctor');
  const btnNextDoctor = document.getElementById('btn-next-doctor');
  const btnPrevDatetime = document.getElementById('btn-prev-datetime');
  const btnNextDatetime = document.getElementById('btn-next-datetime');
  const btnPrevDetails = document.getElementById('btn-prev-details');
  const btnPrevWaitlist = document.getElementById('btn-prev-waitlist');
  const btnPrevTelemedicina = document.getElementById('btn-prev-telemedicina');
  const formDetails = document.getElementById('patient-form');
  const formTelemedicina = document.getElementById('telemedicina-form');
  const formWaitlist = document.getElementById('waitlist-form');
  
  const inputGiftCard = document.getElementById('booking-gift-card');
  const btnValidateGc = document.getElementById('btn-validate-gc');
  const gcFeedbackContainer = document.getElementById('gc-feedback-container');
  
  const bookingApp = document.getElementById('booking-app');
  const loadingState = document.getElementById('booking-loading-state');
  const loadingTitle = document.getElementById('booking-loading-title');
  const loadingDescription = document.getElementById('booking-loading-description');
  const serviceGrid = document.getElementById('service-grid');
  const doctorInputs = document.querySelectorAll('input[name="doctor"]');
  const dateInput = document.getElementById('booking-date');
  const timeSlotsContainer = document.getElementById('time-slots');

  // Initialization
  function init() {
    renderServices();
    setMinDate();
    dateInput.addEventListener('change', handleDateSelection);
    
    // Bind navigation
    btnNextService.addEventListener('click', () => goStep('doctor'));
    btnPrevDoctor.addEventListener('click', () => goStep('service'));
    btnNextDoctor.addEventListener('click', () => goStep('datetime'));
    btnPrevDatetime.addEventListener('click', () => goStep('doctor'));
    btnNextDatetime.addEventListener('click', () => goStep('details'));
    btnPrevDetails.addEventListener('click', () => goStep('datetime'));
    btnPrevWaitlist.addEventListener('click', () => goStep('datetime'));
    if (btnPrevTelemedicina) btnPrevTelemedicina.addEventListener('click', () => goStep('details'));

    formDetails.addEventListener('submit', handleDetailsSubmit);
    if (formTelemedicina) formTelemedicina.addEventListener('submit', handleTelemedicinaSubmit);
    formWaitlist.addEventListener('submit', handleWaitlistSubmit);
    
    if (btnValidateGc) btnValidateGc.addEventListener('click', handleGiftCardValidation);
    if (inputGiftCard) inputGiftCard.addEventListener('input', () => {
      // Clear feedback and local state on manual input change to force re-validation
      gcFeedbackContainer.innerHTML = '';
      state.giftCardCode = '';
    });
    
    doctorInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        state.doctor = e.target.value;
        btnNextDoctor.disabled = false;
        // Reset times if changing doctor
        resetTimeSelection();
      });
    });
  }

  function setMinDate() {
    const today = new Date();
    // if past 18:00, tomorrow is minimum
    if (today.getHours() >= 18) {
      today.setDate(today.getDate() + 1);
    }
    const isoDate = today.toISOString().split('T')[0];
    dateInput.min = isoDate;
    // Set a reasonable max date to 45 days
    const max = new Date();
    max.setDate(max.getDate() + 45);
    dateInput.max = max.toISOString().split('T')[0];
  }

  function setLoadingState(config) {
    if (!bookingApp || !loadingState || !config || !config.button) {
      return;
    }

    clearLoadingState();

    const button = config.button;
    state.loading = {
      button,
      disabled: button.disabled,
      html: button.innerHTML
    };

    button.disabled = true;
    button.dataset.loading = 'true';
    button.innerHTML = `
      <span class="booking-btn__spinner" aria-hidden="true"></span>
      <span>${config.buttonLabel}</span>
    `;

    bookingApp.dataset.loading = 'true';
    bookingApp.setAttribute('aria-busy', 'true');
    loadingTitle.textContent = config.title;
    loadingDescription.textContent = config.description;
    loadingState.hidden = false;
    loadingState.setAttribute('aria-hidden', 'false');
  }

  function clearLoadingState() {
    if (state.loading && state.loading.button) {
      state.loading.button.disabled = state.loading.disabled;
      state.loading.button.innerHTML = state.loading.html;
      delete state.loading.button.dataset.loading;
    }

    state.loading = null;

    if (bookingApp) {
      delete bookingApp.dataset.loading;
      bookingApp.removeAttribute('aria-busy');
    }

    if (loadingState) {
      loadingState.hidden = true;
      loadingState.setAttribute('aria-hidden', 'true');
    }
  }

  function goStep(newStep) {
    if (steps[state.step]) {
      steps[state.step].hidden = true;
    }
    state.step = newStep;
    if (steps[state.step]) {
      steps[state.step].hidden = false;
      
      updateProgressBar(newStep);

      // Auto-trigger slot fetch if arriving at datetime and date is already picked
      if (newStep === 'datetime' && dateInput.value) {
        handleDateSelection({ target: dateInput });
      }
    }
  }

  function updateProgressBar(currentStep) {
    const pBar = document.getElementById('booking-progress-bar');
    if (!pBar) return;
    
    // Hide bar on success steps
    if (currentStep === 'success' || currentStep === 'waitlist-success') {
      pBar.style.display = 'none';
      return;
    } else {
      pBar.style.display = 'flex';
    }

    const map = {
      'service': ['prog-service'],
      'doctor': ['prog-service', 'prog-doctor'],
      'datetime': ['prog-service', 'prog-doctor', 'prog-datetime'],
      'details': ['prog-service', 'prog-doctor', 'prog-datetime', 'prog-details'],
      'telemedicinaIntake': ['prog-service', 'prog-doctor', 'prog-datetime', 'prog-details'],
      'waitlist': ['prog-service', 'prog-doctor', 'prog-datetime', 'prog-details']
    };

    const activeIds = map[currentStep] || [];
    
    ['prog-service', 'prog-doctor', 'prog-datetime', 'prog-details', 'prog-success'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      
      el.classList.remove('is-active');
      el.classList.remove('is-completed');
      
      if (activeIds.includes(id)) {
        if (id === activeIds[activeIds.length - 1]) {
          el.classList.add('is-active');
        } else {
          el.classList.add('is-completed');
        }
      }
    });
  }

  async function renderServices() {
    try {
      const req = await fetch('/data/catalog/services.json');
      if (req.ok) {
        let text = await req.text();
        if (text) {
            let data = JSON.parse(text);
            if (Array.isArray(data)) {
                servicesCatalog = data;
            } else if (data && Array.isArray(data.services)) {
                servicesCatalog = data.services;
            } else if (data && Array.isArray(data.data)) {
                servicesCatalog = data.data;
            }
        }
      }
    } catch (e) {
      console.warn("Using fallback local catalog", e);
    }
    
    if (!serviceGrid) return;
    serviceGrid.innerHTML = '';
    servicesCatalog.forEach(srv => {
      const label = document.createElement('label');
      label.className = 'service-card glass-card';
      const pop = srv.popular ? `<span class="badge-popular">★ Popular</span>` : '';
      const iconHTML = srv.icon || `<div class="service-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg></div>`;
      
      label.innerHTML = `
        <input type="radio" name="service" value="${srv.id}">
        <div class="service-card-header">
           <div class="service-icon">${iconHTML}</div>
           ${pop}
        </div>
        <div class="service-title" style="color:#fff">${srv.title}</div>
        <div class="service-desc" style="color:var(--pub-text-muted)">${srv.desc}</div>
        <div class="service-meta" style="border-top: 1px solid rgba(255,255,255,0.1)">
           <span class="service-duration" style="color:var(--pub-text-muted)">⏱️ ${srv.duration || '30 min'}</span>
           <span class="service-price" style="color:#fff;font-weight:600">💵 ${srv.price || 'Consultar'}</span>
        </div>
      `;
      serviceGrid.appendChild(label);

      label.querySelector('input').addEventListener('change', (e) => {
        state.service = e.target.value;
        btnNextService.disabled = false;
        resetTimeSelection();
      });
    });
  }

  function resetTimeSelection() {
    state.time = '';
    btnNextDatetime.disabled = true;
    if (state.date) {
      // Re-fetch slots with new parameters
      handleDateSelection({ target: dateInput });
    }
  }

  // Generate basic work day template slots (09:00 to 17:30)
  function generateBaseSlots() {
    const slots = [];
    for (let h = 9; h <= 17; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
      slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }

  async function handleDateSelection(e) {
    const selectedDate = e.target.value;
    if (!selectedDate) return;
    state.date = selectedDate;
    state.time = '';
    btnNextDatetime.disabled = true;

    timeSlotsContainer.innerHTML = '<p class="slots-empty">Buscando horarios...</p>';

    try {
      const resp = await fetch(`/api.php?resource=booked-slots&date=${state.date}&doctor=${state.doctor}&service=${state.service}`);
      const payload = await resp.json();
      
      if (!payload.ok) {
        throw new Error(payload.error || 'Error al consultar disponibilidad');
      }

      const bookedSlots = payload.data || [];
      const allSlots = generateBaseSlots();
      
      // Filter out slots that are in the past if selectedDate is today
      const now = new Date();
      const isToday = selectedDate === now.toISOString().split('T')[0];
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const available = allSlots.filter(slot => {
        if (bookedSlots.includes(slot)) return false;
        if (isToday) {
          const [h, m] = slot.split(':').map(Number);
          if (h < currentHour || (h === currentHour && m <= currentMinute + 30)) {
            return false; // hide past times and upcoming 30 mins
          }
        }
        return true;
      });

      renderTimeSlots(available);
    } catch (err) {
      console.error(err);
      timeSlotsContainer.innerHTML = `<p class="slots-empty" style="color:#ef4444">No se pudo cargar la agenda. Intente más tarde.</p>`;
    }
  }

  function renderTimeSlots(slots) {
    if (slots.length === 0) {
      timeSlotsContainer.innerHTML = `
        <p class="slots-empty">No hay horarios disponibles para esta fecha.</p>
        <div style="text-align:center; margin-top:1rem;">
          <button type="button" class="booking-btn booking-btn--secondary" id="btn-go-waitlist">Unirme a lista de espera</button>
        </div>
      `;
      document.getElementById('btn-go-waitlist').addEventListener('click', () => goStep('waitlist'));
      return;
    }

    timeSlotsContainer.innerHTML = '';
    slots.forEach(slot => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot-btn';
      btn.textContent = slot;
      btn.addEventListener('click', () => {
        // Deselect others
        timeSlotsContainer.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        state.time = slot;
        btnNextDatetime.disabled = false;
      });
      timeSlotsContainer.appendChild(btn);
    });
  }

  async function handleDetailsSubmit(e) {
    e.preventDefault();
    if (!formDetails.checkValidity()) {
      formDetails.reportValidity();
      return;
    }

    state.patient.name = document.getElementById('p-name').value.trim();
    state.patient.email = document.getElementById('p-email').value.trim();
    state.patient.phone = document.getElementById('p-phone').value.trim();

    if (state.service === 'video' || state.service === 'telefono') {
      goStep('telemedicinaIntake');
      return;
    }

    const btn = document.getElementById('btn-next-details');
    setLoadingState({
      button: btn,
      buttonLabel: 'Agendando...',
      title: 'Confirmando tu cita...',
      description: 'Estamos validando disponibilidad y bloqueando tu espacio en agenda.'
    });

    await submitBookingPayload(btn, 'Confirmar Reserva');
  }

  async function handleGiftCardValidation() {
    const code = inputGiftCard.value.trim().toUpperCase();
    if (!code) {
      gcFeedbackContainer.innerHTML = '<span style="color:var(--status-error)">Debe ingresar un código primero.</span>';
      return;
    }
    
    btnValidateGc.disabled = true;
    gcFeedbackContainer.innerHTML = '<span>Validando código...</span>';
    
    try {
      const res = await fetch(`/api.php?resource=gift-card-validate&code=${encodeURIComponent(code)}`);
      const data = await res.json();
      
      if (res.ok && data.valid) {
        state.giftCardCode = data.code;
        const bal = (data.balance_cents / 100).toFixed(2);
        gcFeedbackContainer.innerHTML = `<span style="color:#10b981;font-weight:600;">✅ Válido. Saldo disponible: $${bal}</span>`;
      } else {
        state.giftCardCode = '';
        gcFeedbackContainer.innerHTML = `<span style="color:var(--status-error)">❌ ${data.reason || 'Código inválido o expirado'}</span>`;
      }
    } catch(err) {
      state.giftCardCode = '';
      gcFeedbackContainer.innerHTML = '<span style="color:var(--status-error)">❌ Error al conectar con el servidor.</span>';
    } finally {
      btnValidateGc.disabled = false;
    }
  }

  async function handleTelemedicinaSubmit(e) {
    e.preventDefault();
    if (!formTelemedicina.checkValidity()) {
      formTelemedicina.reportValidity();
      return;
    }

    state.telemedicine.reason = document.getElementById('tm-reason').value.trim();
    state.telemedicine.affectedArea = document.getElementById('tm-area').value.trim();
    state.telemedicine.evolutionTime = document.getElementById('tm-time').value.trim();
    state.telemedicine.privacyConsent = document.getElementById('tm-consent').checked;

    const btn = document.getElementById('btn-next-telemedicina');
    setLoadingState({
      button: btn,
      buttonLabel: 'Evaluando...',
      title: 'Evaluando tu solicitud...',
      description: 'Estamos revisando tu información clínica para asegurar el siguiente paso más seguro.'
    });

    await submitBookingPayload(btn, 'Confirmar Evaluación');
  }

  async function submitBookingPayload(restoreBtn, restoreText) {
    if (state.isSubmitting) {
      console.warn("Bloqueando doble submit concurrente.");
      return;
    }
    state.isSubmitting = true;

    // Optional disabling safety on top of loading state
    if (restoreBtn) restoreBtn.disabled = true;

    const payload = {
      service: state.service,
      doctor: state.doctor,
      date: state.date,
      time: state.time,
      name: state.patient.name,
      email: state.patient.email,
      phone: state.patient.phone,
      idempotencyKey: 'pkg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    };

    if (state.giftCardCode) {
      payload.giftCardCode = state.giftCardCode;
    }

    if (state.service === 'video' || state.service === 'telefono') {
      payload.reason = state.telemedicine.reason;
      payload.affectedArea = state.telemedicine.affectedArea;
      payload.evolutionTime = state.telemedicine.evolutionTime;
      payload.privacyConsent = state.telemedicine.privacyConsent;
    }

    try {
      const req = await fetch('/api.php?resource=appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await req.json();

      if (!data.ok) {
        throw new Error(data.error || 'No se pudo generar la reserva');
      }

      // Check if it was deemed unsuitable
      if (data.data && data.data.telemedicineSuitability === 'unsuitable') {
        const stepSuccess = document.getElementById('step-success');
        stepSuccess.querySelector('.success-banner h2').textContent = '⚠️ Derivación Urgente Requerida';
        stepSuccess.querySelector('.success-banner p').textContent = 'Basado en su evaluación, este caso excede las capacidades seguras de la telemedicina. Le hemos reservado un espacio prioritario en modalidad PRESENCIAL.';
        stepSuccess.querySelector('.success-icon').textContent = '!';
        stepSuccess.querySelector('.success-icon').style.color = 'var(--status-error)';
        stepSuccess.querySelector('.success-banner').style.backgroundColor = 'var(--status-error-subtle)';
        stepSuccess.querySelector('.success-banner').style.borderColor = 'var(--status-error)';
      }

      // Success
      clearLoadingState();
      populateSuccess(data.data);
      goStep('success');

    } catch (err) {
      alert(`Ups: ${err.message}. Revise los datos y vuelva a intentar.`);
      clearLoadingState();
      state.isSubmitting = false; // S13-18 release lock
      if (restoreBtn) restoreBtn.disabled = false;
    }
  }

  function populateSuccess(appointmentData) {
    const srvTitle = servicesCatalog.find(s => s.id === state.service)?.title || state.service;
    
    let docTitle = 'Indiferente';
    if (state.doctor === 'rosero') docTitle = 'Dr. Rosero';
    if (state.doctor === 'narvaez') docTitle = 'Dra. Narváez';

    document.getElementById('sum-name').textContent = state.patient.name;
    document.getElementById('sum-service').textContent = srvTitle;
    document.getElementById('sum-doctor').textContent = docTitle;
    document.getElementById('sum-datetime').textContent = `${state.date} a las ${state.time} hrs`;

    // Google Calendar Link generator
    const pad = (n) => n.toString().padStart(2, '0');
    const [year, month, day] = state.date.split('-');
    const [hh, mm] = state.time.split(':');
    
    // Create base date in UTC logic or assume local tz offset in string
    // Simplified format for GCal: YYYYMMDDTHHMMSS
    // Note: Local timezone vs UTC might shift, simply append Z or leave local
    const startDateRaw = new Date(`${state.date}T${state.time}:00-05:00`); 
    const endDateRaw = new Date(startDateRaw.getTime() + 30 * 60000); // add 30 mins
    
    const fmt = (d) => d.getUTCFullYear() + pad(d.getUTCMonth()+1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
    const dates = fmt(startDateRaw) + '/' + fmt(endDateRaw);
    
    const text = encodeURIComponent(`Cita Aurora Derm: ${srvTitle}`);
    const details = encodeURIComponent(`Paciente: ${state.patient.name}\nMédico: ${docTitle}\n\nGracias por confiar en Aurora Derm.`);
    const location = encodeURIComponent(`Aurora Derm, Quito, Ecuador`);
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
    
    const btnGcal = document.getElementById('btn-gcal');
    if (btnGcal) btnGcal.href = gcalUrl;

    // WhatsApp Share Link
    const wsText = encodeURIComponent(`Hola! He agendado mi turno en Aurora Derm para el ${state.date} a las ${state.time}. Nos vemos pronto!`);
    const btnWs = document.getElementById('btn-share-ws');
    if (btnWs) btnWs.href = `https://api.whatsapp.com/send?text=${wsText}`;

    // Try to notify the system event if we have patient journey integration
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'booking_completed',
        booking_service: state.service,
        booking_doctor: state.doctor
      });
    }
  }

  async function handleWaitlistSubmit(e) {
    e.preventDefault();
    if (!formWaitlist.checkValidity()) {
      formWaitlist.reportValidity();
      return;
    }

    const name = document.getElementById('wl-name').value.trim();
    const email = document.getElementById('wl-email').value.trim();
    const phone = document.getElementById('wl-phone').value.trim();

    const btn = document.getElementById('btn-next-waitlist');
    setLoadingState({
      button: btn,
      buttonLabel: 'Guardando...',
      title: 'Registrando tu lista de espera...',
      description: 'Estamos guardando tus datos para avisarte si se libera un horario compatible.'
    });

    const preferenciaStr = `[WAITLIST] date:${state.date} doctor:${state.doctor} service:${state.service}\nNombre: ${name}\nEmail: ${email}`;
    const payload = {
      telefono: phone,
      preferencia: preferenciaStr
    };

    try {
      const req = await fetch('/api.php?resource=callbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await req.json();

      if (!data.ok) {
        throw new Error(data.error || 'No se pudo guardar la solicitud');
      }

      clearLoadingState();
      populateWaitlistSuccess(name, email, phone);
      goStep('waitlistSuccess');

    } catch (err) {
      alert(`Ups: ${err.message}. Intente más tarde.`);
      clearLoadingState();
    }
  }

  function populateWaitlistSuccess(name, email, phone) {
    const srvTitle = servicesCatalog.find(s => s.id === state.service)?.title || state.service;
    let docTitle = 'Indiferente';
    if (state.doctor === 'rosero') docTitle = 'Dr. Rosero';
    if (state.doctor === 'narvaez') docTitle = 'Dra. Narváez';

    document.getElementById('wl-sum-phone').textContent = phone;
    document.getElementById('wl-sum-service').textContent = srvTitle;
    document.getElementById('wl-sum-doctor').textContent = docTitle;
    document.getElementById('wl-sum-date').textContent = state.date;
  }

  init();
});
