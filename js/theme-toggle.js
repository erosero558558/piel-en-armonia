/**
 * js/theme-toggle.js
 * (UI3-10) Theme persistency and anti-FOUC handler
 */

// Este archivo es cargado en head y maneja el boton si esta disponible
(function() {
    const savedTheme = localStorage.getItem('aurora-theme') || 'system';
    document.documentElement.setAttribute('data-theme-mode', savedTheme);
    
    document.addEventListener('DOMContentLoaded', () => {
        const toggleBtn = document.getElementById('adminThemeToggle');
        if (!toggleBtn) return;
        
        const currentTheme = document.documentElement.getAttribute('data-theme-mode');
        updateIcon(currentTheme);

        toggleBtn.addEventListener('click', () => {
            const nowTheme = document.documentElement.getAttribute('data-theme-mode');
            const targetTheme = nowTheme === 'dark' ? 'light' : 'dark';
            
            document.documentElement.setAttribute('data-theme-mode', targetTheme);
            localStorage.setItem('aurora-theme', targetTheme);
            updateIcon(targetTheme);
        });

        function updateIcon(theme) {
            // Un simple toggle visual
            if (theme === 'dark') {
                toggleBtn.innerHTML = `<svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`;
            } else {
                toggleBtn.innerHTML = `<svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`;
            }
        }
    });
})();
