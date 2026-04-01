/**
 * admin-offline.js - S24-04
 * Modo degradado offline para interface administrativa.
 * Evita mutaciones y guardados silently fallidos al perderse la red en plena consulta.
 * Actúa globalmente levantando `.offline-banner` y bloqueando selectores `[data-action="save-diagnosis"]` y `[data-action="issue-prescription"]`.
 */
document.addEventListener('DOMContentLoaded', () => {
    
    // Inject #offline-banner securely into DOM
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline-banner';
    banner.setAttribute('hidden', '');
    banner.innerHTML = `
        <div class="offline-banner-content">
            <svg class="offline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.36 5.64a9 9 0 0 0-12.72 0M15.54 8.46a5 5 0 0 0-7.08 0M12 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"></path>
                <line x1="2" y1="2" x2="22" y2="22" stroke-linecap="round"></line>
            </svg>
            <strong>Conexión Perdida: Modo Visualización Local (Caché).</strong> 
            <span>Las acciones clínicas estarán deshabilitadas para prevenir desconexión de base de datos. Los últimos casos están legibles localmente.</span>
        </div>
    `;
    document.body.prepend(banner);

    // List of targeted critical API buttons
    const TARGET_SELECTORS = '[data-action="save-diagnosis"], [data-action="issue-prescription"]';

    const handleOffline = () => {
        banner.removeAttribute('hidden');
        document.body.classList.add('is-offline');
        
        // Grab elements and disable them safely
        document.querySelectorAll(TARGET_SELECTORS).forEach(btn => {
            btn.dataset.wasDisabled = btn.disabled; // store previous state
            btn.disabled = true;
            btn.dataset.originalTitle = btn.getAttribute('title') || '';
            btn.setAttribute('title', 'Sin conexión — los cambios no se guardarán');
            btn.classList.add('offline-restricted');
        });
        
        console.warn('Network Offline [S24-04] => Entering degraded state');
    };

    const handleOnline = () => {
        banner.setAttribute('hidden', '');
        document.body.classList.remove('is-offline');
        
        // Restore elements safely
        document.querySelectorAll(TARGET_SELECTORS).forEach(btn => {
            btn.disabled = btn.dataset.wasDisabled === 'true'; // Restore specific logical state
            if (btn.dataset.originalTitle) {
                btn.setAttribute('title', btn.dataset.originalTitle);
            } else {
                btn.removeAttribute('title');
            }
            btn.classList.remove('offline-restricted');
        });
        
        console.info('Network Online [S24-04] => System restored');
    };

    // Listeners
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Init Check
    if (navigator.onLine === false) {
        handleOffline();
    }
});
