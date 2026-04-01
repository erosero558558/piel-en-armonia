/**
 * js/aurora-theme-toggle.js — Toggle día/noche Aurora Derm
 *
 * Uso en HTML:
 *   <button class="theme-toggle" id="themeToggle" aria-label="Cambiar tema">
 *     <span class="theme-toggle-icon">☀️</span>
 *     <span class="theme-toggle-label">Modo claro</span>
 *   </button>
 *
 * O simplemente: <script src="/js/aurora-theme-toggle.js"></script>
 * El script auto-inyecta el botón y aplica el tema guardado.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'aurora-theme';
  const DARK = 'dark';
  const LIGHT = 'light';

  // ── Detectar preferencia del sistema ────────────────────────────────────────
  function systemPrefersDark() {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  }

  // ── Leer tema guardado o usar el del sistema ─────────────────────────────────
  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) || (systemPrefersDark() ? DARK : LIGHT);
  }

  // ── Aplicar tema al <html> ───────────────────────────────────────────────────
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    updateAllToggles(theme);
  }

  // ── Actualizar todos los botones de toggle en la página ─────────────────────
  function updateAllToggles(theme) {
    const isDark = theme === DARK;
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      const icon = btn.querySelector('.theme-toggle-icon');
      const label = btn.querySelector('.theme-toggle-label');
      if (icon) icon.textContent = isDark ? '☀️' : '🌙';
      if (label) label.textContent = isDark ? 'Modo claro' : 'Modo oscuro';
      btn.setAttribute('aria-pressed', String(!isDark));
      btn.setAttribute('aria-label', isDark ? 'Activar modo claro' : 'Activar modo oscuro');
    });
  }

  // ── Toggle ───────────────────────────────────────────────────────────────────
  function toggle() {
    const current = document.documentElement.getAttribute('data-theme') || getTheme();
    applyTheme(current === DARK ? LIGHT : DARK);
  }

  // ── Auto-inyectar botón si hay un #themeToggle o [data-theme-auto-inject] ───
  function injectToggleButton() {
    const placeholder = document.getElementById('themeToggle')
      || document.querySelector('[data-theme-toggle]');

    if (placeholder) {
      // Ya existe un botón — solo asignar el evento
      placeholder.setAttribute('data-theme-toggle', '');
      placeholder.addEventListener('click', toggle);
      return;
    }

    // Crear e inyectar en la navbar si existe
    const navbar = document.querySelector(
      'nav, .navbar, .nav-bar, .header, header, [data-inject-theme-toggle]'
    );
    if (!navbar) return;

    const btn = document.createElement('button');
    btn.id = 'themeToggle';
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.setAttribute('data-theme-toggle', '');
    btn.setAttribute('aria-label', 'Cambiar tema');
    btn.innerHTML = `
      <span class="theme-toggle-icon" aria-hidden="true">☀️</span>
      <span class="theme-toggle-label">Modo claro</span>
    `;
    btn.addEventListener('click', toggle);
    navbar.appendChild(btn);
  }

  // ── Escuchar cambios del sistema en tiempo real ──────────────────────────────
  function watchSystemPreference() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      // Solo actualizar si el usuario no ha guardado una preferencia manual
      if (!localStorage.getItem(STORAGE_KEY)) {
        applyTheme(e.matches ? DARK : LIGHT);
      }
    });
  }

  // ── API pública ──────────────────────────────────────────────────────────────
  window.AuroraTheme = {
    toggle,
    setDark:  () => applyTheme(DARK),
    setLight: () => applyTheme(LIGHT),
    getTheme,
    isDark:   () => getTheme() === DARK,
    isLight:  () => getTheme() === LIGHT,
  };

  // ── Inicialización inmediata (antes de DOMContentLoaded para evitar FOUC) ────
  // Aplicar tema lo antes posible
  applyTheme(getTheme());

  // Wire eventos cuando DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectToggleButton();
      updateAllToggles(getTheme());
    });
  } else {
    injectToggleButton();
    updateAllToggles(getTheme());
  }

  watchSystemPreference();

})();
