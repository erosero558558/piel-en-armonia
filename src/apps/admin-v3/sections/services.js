/**
 * S6-04: Activación de Servicios (Módulos SaaS)
 * Controlador de interactividad para los toggles del panel de servicios
 */

export function bootServicesSection() {
    const section = document.getElementById('services');
    if (!section) return;

    // Listen to changes on all service toggles
    const switches = section.querySelectorAll('.service-switch input[type="checkbox"]');
    
    switches.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const container = e.target.closest('.service-card');
            const serviceName = container ? container.querySelector('h4').textContent : 'Módulo';

            // Temporarily disable to prevent double clicks
            e.target.disabled = true;

            // Simula petición backend POST /api.php?action=toggle-service
            setTimeout(() => {
                e.target.disabled = false;
                
                // Emite notificación exitosa
                document.body.dispatchEvent(new CustomEvent('admin-toast', {
                    detail: { 
                        message: `${serviceName} ${isChecked ? 'activado' : 'desactivado'} correctamente.`, 
                        type: isChecked ? 'success' : 'alert' 
                    }
                }));

            }, 450); // Mocks API latency
        });
    });
}
