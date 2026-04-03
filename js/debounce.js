/**
 * js/debounce.js — Debounce y Throttle — Aurora Derm
 * JS-06 [Gemini]
 *
 * Uso:
 *   const buscar = debounce((q) => apiGet('patient-search', { q }), 300);
 *   input.addEventListener('input', e => buscar(e.target.value));
 */

'use strict';

(function () {

  /**
   * Retarda la ejecución de fn hasta que no se llame por `wait` ms.
   * @param {Function} fn
   * @param {number}   wait  Ms de espera
   * @param {boolean}  [leading=false]  Ejecutar en el borde inicial también
   * @returns {Function}
   */
  function debounce(fn, wait, leading) {
    let timer = null;
    let lastResult;

    function debounced() {
      const args    = arguments;
      const context = this;
      const callNow = leading && !timer;

      if (timer) clearTimeout(timer);

      timer = setTimeout(function () {
        timer = null;
        if (!leading) lastResult = fn.apply(context, args);
      }, wait || 300);

      if (callNow) lastResult = fn.apply(context, args);
      return lastResult;
    }

    debounced.cancel = function () {
      if (timer) { clearTimeout(timer); timer = null; }
    };

    return debounced;
  }

  /**
   * Limita la ejecución a una vez cada `limit` ms como máximo.
   * @param {Function} fn
   * @param {number}   limit  Ms mínimos entre ejecuciones
   * @returns {Function}
   */
  function throttle(fn, limit) {
    let inThrottle = false;
    return function () {
      if (inThrottle) return;
      fn.apply(this, arguments);
      inThrottle = true;
      setTimeout(function () { inThrottle = false; }, limit || 200);
    };
  }

  // Exports
  window.debounce = debounce;
  window.throttle = throttle;
  if (typeof module !== 'undefined') module.exports = { debounce, throttle };
})();
