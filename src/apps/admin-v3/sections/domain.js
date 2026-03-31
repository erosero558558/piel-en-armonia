/**
 * S6-07: Dominio Propio / Custom SSL
 * Controlador para la verificación simulada de DNS y Let's Encrypt
 */

export function bootDomainSection() {
    const section = document.getElementById('domain');
    if (!section) return;

    const domainInput = document.getElementById('custom-domain-input');
    const btnSaveInput = document.getElementById('btnSaveDomainInput');
    const dnsHostValue = document.getElementById('dns-host-value');
    
    const btnVerify = document.getElementById('btnVerifyDomain');
    const badgeDns = document.getElementById('badgeDns');
    const badgeSsl = document.getElementById('badgeSsl');

    // 1. Manejo del Input del Dominio (Paso 1)
    btnSaveInput.addEventListener('click', () => {
        const val = domainInput.value.trim().toLowerCase();
        
        // Validación básica de dominio
        if (!val || val.length < 4 || !val.includes('.')) {
            document.body.dispatchEvent(new CustomEvent('admin-toast', {
                detail: { message: 'Por favor, ingresa un formato de dominio válido (ej. citas.mi-clinica.com).', type: 'alert' }
            }));
            return;
        }

        // Extraer el prefijo (subdominio) si lo hay para la guía DNS
        const parts = val.split('.');
        const host = parts.length > 2 ? parts[0] : '@'; 
        
        dnsHostValue.textContent = host;

        document.body.dispatchEvent(new CustomEvent('admin-toast', {
            detail: { message: 'Dominio configurado. Por favor, actualiza tus registros DNS físicos.', type: 'info' }
        }));
    });

    // 2. Simulador de Validación Let's Encrypt (Paso 3)
    btnVerify.addEventListener('click', () => {
        if (!domainInput.value.trim().includes('.')) {
            document.body.dispatchEvent(new CustomEvent('admin-toast', {
                detail: { message: 'Primero guarda un dominio corporativo válido en el Paso 1.', type: 'alert' }
            }));
            return;
        }

        btnVerify.disabled = true;
        btnVerify.textContent = 'Contactando Name Servers...';

        // Fake network latency for DNS propagation check and Certbot challenge
        setTimeout(() => {
            btnVerify.textContent = 'Aprovisionando TLS...';
            
            setTimeout(() => {
                btnVerify.disabled = false;
                btnVerify.textContent = 'Re-verificar Conexión';
                
                // Muta Badges a estado Activo/Seguro
                badgeDns.className = 'domain-status-badge success';
                badgeDns.innerHTML = '<div style="width:6px; height:6px; border-radius:50%; background:currentColor;"></div> DNS Propagado';
                
                badgeSsl.className = 'domain-status-badge success';
                badgeSsl.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> SSL Activo Seguro';
                
                document.body.dispatchEvent(new CustomEvent('admin-toast', {
                    detail: { message: `Dominio verificado y asegurado con TLS Let's Encrypt.`, type: 'success' }
                }));
            }, 1200);

        }, 1500);
    });
}
