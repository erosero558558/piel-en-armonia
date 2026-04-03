/**
 * js/poll.js — Polling reactivo con backoff — Aurora Derm
 * JS-08 [Gemini]
 *
 * Uso:
 *   const poller = createPoller(async () => {
 *     const { ok, data } = await apiGet('queue-state');
 *     if (ok) renderQueue(data);
 *   }, 5000);
 *
 *   poller.start();   // arranca
 *   poller.stop();    // detiene
 *   poller.refresh(); // ejecuta ahora sin esperar
 */

'use strict';

(function () {

  /**
   * Crea un poller reactivo.
   *
   * @param {() => Promise<void>} fn         Función async a ejecutar en cada ciclo
   * @param {number} [intervalMs=5000]       Intervalo base en ms
   * @param {object} [opts]
   * @param {number} [opts.maxBackoff=30000] Máximo intervalo con backoff
   * @param {number} [opts.backoffFactor=2]  Multiplicador de backoff por error
   * @param {boolean} [opts.immediate=true]  Ejecutar inmediatamente al start()
   * @param {(err: Error) => void} [opts.onError] Callback de error
   *
   * @returns {{ start: Function, stop: Function, refresh: Function, isRunning: Function }}
   */
  function createPoller(fn, intervalMs, opts) {
    const interval    = intervalMs || 5000;
    const o           = opts || {};
    const maxBackoff  = o.maxBackoff  || 30000;
    const backoffFactor = o.backoffFactor || 2;
    const immediate   = o.immediate !== false;
    const onError     = o.onError || null;

    let _timer        = null;
    let _running      = false;
    let _currentInterval = interval;
    let _executing    = false;

    async function tick() {
      if (_executing) return; // evitar solapamiento
      _executing = true;
      try {
        await fn();
        _currentInterval = interval; // reset backoff en éxito
      } catch (err) {
        _currentInterval = Math.min(_currentInterval * backoffFactor, maxBackoff);
        if (onError) onError(err);
        else console.warn('[poll] Error en poller, backoff a ' + _currentInterval + 'ms:', err);
      } finally {
        _executing = false;
        if (_running) schedule();
      }
    }

    function schedule() {
      if (_timer) clearTimeout(_timer);
      _timer = setTimeout(tick, _currentInterval);
    }

    function start() {
      if (_running) return;
      _running = true;
      _currentInterval = interval;
      if (immediate) {
        tick(); // ejecuta de inmediato, luego agenda
      } else {
        schedule();
      }
    }

    function stop() {
      _running = false;
      if (_timer) { clearTimeout(_timer); _timer = null; }
    }

    function refresh() {
      if (_timer) { clearTimeout(_timer); _timer = null; }
      tick();
    }

    function isRunning() { return _running; }

    return { start, stop, refresh, isRunning };
  }

  // Export
  window.createPoller = createPoller;
  if (typeof module !== 'undefined') module.exports = { createPoller };
})();
