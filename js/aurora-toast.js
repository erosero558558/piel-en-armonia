/**
 * Aurora Derm - Toast Notifications Glass System (UI5-19)
 * Reemplaza los alert() nativos del sistema con componentes Liquid Glass.
 */

(function() {
    // 1. Inyectar estilos CSS para los Toasts si no existen
    if (!document.getElementById('aurora-toast-styles')) {
        const style = document.createElement('style');
        style.id = 'aurora-toast-styles';
        style.textContent = `
            .aurora-toast-container {
                position: fixed;
                bottom: 32px;
                right: 32px;
                display: flex;
                flex-direction: column;
                gap: 16px;
                z-index: 9999;
                pointer-events: none;
            }
            .toast-glass {
                background: rgba(15, 23, 42, 0.75);
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                padding: 16px 24px;
                color: #ffffff;
                font-family: var(--reborn-font-base, 'Inter', sans-serif);
                font-size: 1rem;
                display: flex;
                align-items: center;
                gap: 12px;
                box-shadow: 0 16px 32px rgba(0, 0, 0, 0.4);
                pointer-events: auto;
                
                /* Entrada toast-spring */
                animation: toast-spring-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            
            /* Salida spring con fade-out */
            .toast-glass.toast-leaving {
                animation: toast-spring-out 0.4s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards;
            }

            @keyframes toast-spring-in {
                0% { transform: translateY(100px) scale(0.9); opacity: 0; }
                100% { transform: translateY(0) scale(1); opacity: 1; }
            }

            @keyframes toast-spring-out {
                0% { transform: scale(1); opacity: 1; }
                100% { transform: scale(0.9) translateY(20px); opacity: 0; }
            }

            /* Iconos por estado */
            .toast-icon {
                font-size: 1.2rem;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .toast-success .toast-icon { color: #2ecc71; }
            .toast-error .toast-icon { color: #e74c3c; }
            .toast-warning .toast-icon { color: #f1c40f; }
            .toast-info .toast-icon { color: #3498db; }
        `;
        document.head.appendChild(style);
    }

    // 2. Crear el contenedor principal
    let container = document.querySelector('.aurora-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'aurora-toast-container';
        document.body.appendChild(container);
    }

    // 3. Objeto singleton para el API global
    window.toast = {
        show: function(msg, type = 'info') {
            const el = document.createElement('div');
            el.className = `toast-glass toast-${type}`;
            
            let iconText = 'ℹ️';
            if (type === 'success') iconText = '✓';
            if (type === 'error') iconText = '✕';
            if (type === 'warning') iconText = '⚠️';

            el.innerHTML = `<div class="toast-icon">${iconText}</div><div>${msg}</div>`;
            
            container.appendChild(el);

            // Auto dismiss en 4000ms
            setTimeout(() => {
                el.classList.add('toast-leaving');
                // Remover del DOM una vez completada la animacion
                setTimeout(() => el.remove(), 400);
            }, 4000);
        }
    };
})();
