/**
 * Onboarding Wizard State Machine
 * Handles the multi-step form for creating a new clinic tenant in Flow OS.
 */

(function() {
    'use strict';

    let currentStep = 1;
    const totalSteps = 5;

    const views = document.querySelectorAll('.wizard-view');
    const dots = document.querySelectorAll('.wizard-step-dot');
    
    const btnNext = document.getElementById('btnNext');
    const btnBack = document.getElementById('btnBack');
    const wizardFooter = document.getElementById('wizardFooter');
    const errorBox = document.getElementById('w_error');

    // UI Elements
    const clinicName = document.getElementById('w_clinicName');
    const clinicEmail = document.getElementById('w_clinicEmail');
    const clinicPhone = document.getElementById('w_clinicPhone');
    const docName = document.getElementById('w_docName');
    const docSpec = document.getElementById('w_docSpec');
    const slugInput = document.getElementById('w_slug');

    const modEmr = document.getElementById('mod_emr');
    const modTelemed = document.getElementById('mod_telemed');

    const colorPicker = document.getElementById('w_colorPicker');
    const logoUrl = document.getElementById('w_logoUrl');

    function updateView() {
        // Hide all
        views.forEach(v => v.classList.remove('active'));
        
        // Show current
        const currentView = document.querySelector(`.wizard-view[data-step="${currentStep}"]`);
        if (currentView) currentView.classList.add('active');

        // Update dots
        dots.forEach((dot, index) => {
            dot.classList.remove('active', 'completed');
            if (index < currentStep - 1) {
                dot.classList.add('completed');
            } else if (index === currentStep - 1) {
                dot.classList.add('active');
            }
        });

        // Update Buttons
        btnBack.style.visibility = currentStep > 1 ? 'visible' : 'hidden';
        btnNext.textContent = currentStep === totalSteps ? 'Activar mi Clínica' : 'Continuar';

        // Auto-generate slug on step 5
        if (currentStep === 5 && clinicName.value && !slugInput.value) {
            slugInput.value = clinicName.value
                .toLowerCase()
                .normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            updateSummary();
        }
        
        // Cleanup errors
        showError('');
    }

    function updateSummary() {
        document.getElementById('lbl_cname').textContent = clinicName.value || 'N/A';
        document.getElementById('lbl_dname').textContent = docName.value || 'N/A';
        
        let extras = [];
        if (modEmr.checked) extras.push('HCE');
        if (modTelemed.checked) extras.push('Telemedicina');
        
        document.getElementById('lbl_mods').textContent = extras.length > 0 ? ', ' + extras.join(', ') : '';
    }

    function showError(msg) {
        if (!msg) {
            errorBox.style.display = 'none';
        } else {
            errorBox.textContent = msg;
            errorBox.style.display = 'block';
        }
    }

    function validateStep(step) {
        if (step === 1) {
            if (!clinicName.value.trim() || !clinicEmail.value.trim() || !clinicPhone.value.trim()) {
                return "Todos los campos obligatorios de la clínica deben estar llenos.";
            }
            if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(clinicEmail.value)) {
                return "Correo electrónico inválido.";
            }
        }
        if (step === 2) {
            if (!docName.value.trim() || !docSpec.value.trim()) {
                return "Debes proveer al menos el nombre y especialidad del médico titular.";
            }
        }
        
        if (step === 5) {
            if (!slugInput.value.trim() || slugInput.value.length < 3) {
                return "El dominio Flow OS debe tener al menos 3 caracteres.";
            }
            if (!/^[a-z0-9-]+$/.test(slugInput.value)) {
                return "El dominio solo puede contener letras minúsculas, números y guiones.";
            }
        }
        return null;
    }

    async function submitWizard() {
        btnNext.disabled = true;
        btnNext.textContent = "Creando Infraestructura...";
        btnBack.disabled = true;
        showError('');

        const payload = {
            clinic: {
                name: clinicName.value.trim(),
                email: clinicEmail.value.trim(),
                phone: clinicPhone.value.trim()
            },
            doctor: {
                name: docName.value.trim(),
                specialty: docSpec.value.trim()
            },
            modules: {
                turnero: true,
                emr: modEmr.checked,
                telemedicine: modTelemed.checked
            },
            branding: {
                primaryColor: colorPicker.value,
                logoUrl: logoUrl.value.trim()
            },
            slug: slugInput.value.trim(),
            loadDemoData: document.getElementById('w_loadDemo') ? document.getElementById('w_loadDemo').checked : false
        };

        try {
            // MOCK DELAY SIMULATING INFRASTRUCTURE SETUP
            await new Promise(r => setTimeout(r, 2000));
            
            /* TODO: Wire with real backend
            const response = await fetch('/api.php?action=create-clinic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if(!data.ok) throw new Error(data.error || "Error al crear la instancia de la base de datos.");
            */
            
            // Success State (Step 6)
            currentStep = 6;
            document.querySelector('.wizard-header').style.display = 'none';
            wizardFooter.style.display = 'none';
            updateView();
            
            // Redirect after 3s
            setTimeout(() => {
                window.location.href = '/es/admin/';
            }, 3000);

        } catch (err) {
            showError(err.message);
            btnNext.disabled = false;
            btnNext.textContent = "Reintentar Activación";
            btnBack.disabled = false;
        }
    }

    btnNext.addEventListener('click', () => {
        const error = validateStep(currentStep);
        if (error) {
            alert(error); // simple alert para UX rápida
            return;
        }

        if (currentStep < totalSteps) {
            currentStep++;
            updateView();
        } else if (currentStep === totalSteps) {
            submitWizard();
        }
    });

    btnBack.addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            updateView();
        }
    });

    // Inputs event listeners config
    clinicName.addEventListener('input', updateSummary);
    slugInput.addEventListener('input', () => {
        slugInput.value = slugInput.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    });

})();
