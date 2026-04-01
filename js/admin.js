// inactivity timer session expire inactivity

/**
 * Focus Mode UI Trigger (S27-01 Liquid Glass)
 * @param {Object} currentCase - El objeto de datos correspondiente al caso actual
 */
window.toggleConsultationFocus = function(currentCase) {
    // Audit Requirement: Verificable: case.status === in_consultation
    if (currentCase && currentCase.status === 'in_consultation') {
        document.body.classList.add('focus-mode');
        
        // Hydrate identity (dummy protection for the structure)
        if (currentCase.patientData) {
            const elName = document.getElementById('focusPatientName');
            const elMeta = document.getElementById('focusPatientMeta');
            if (elName) elName.textContent = currentCase.patientData.name || 'Paciente Activo';
            if (elMeta) elMeta.textContent = currentCase.patientData.meta || 'En consulta presencial';
        }
    } else {
        document.body.classList.remove('focus-mode');
    }
};

// Listen to actions from the focus UI
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.js-focus-action');
        if (!btn) return;
        
        const action = btn.getAttribute('data-action');
        if (action === 'close-focus') {
            document.body.classList.remove('focus-mode');
            if (window.toast && window.toast.show) {
                window.toast.show('Consulta finalizada.', 'success');
            }
        }
    });
    
    // Trigger via "Focus" button in topbar
    const btnFocus = document.getElementById('btnFocusMode');
    if (btnFocus) {
        btnFocus.addEventListener('click', () => {
            // Emulate state for visual UI review
            window.toggleConsultationFocus({ status: 'in_consultation' });
        });
    }
});
