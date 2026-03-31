/**
 * aurora-scroll-reveal.js — Fluid Scroll Reveal con spring physics
 *
 * S10-UI4-10: reemplaza transiciones opacity planas por sistema físico
 * Inspiración: Apple WWDC motion design language
 *
 * Cada elemento que tiene [data-reveal] o la clase .reveal-on-scroll
 * entra con:
 *   - translateY +24px → 0
 *   - blur(8px)     → blur(0)
 *   - opacity 0     → 1
 * Spring: cubic-bezier(0.34, 1.56, 0.64, 1) — duración 480ms
 * Stagger entre hermanos: 60ms
 *
 * Auto-inicializado: sólo carga si IntersectionObserver está disponible.
 */

(function () {
  'use strict';

  // ── Constantes ─────────────────────────────────────────────────────────────

  var SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  var DURATION = 480;
  var STAGGER = 60;
  var THRESHOLD = 0.12;
  var ROOT_MARGIN = '0px 0px -48px 0px';

  // Selectores que participan automáticamente
  var AUTO_SELECTORS = [
    '[data-reveal]',
    '.reveal-on-scroll',
    '.lg-surface',
    '.lg-surface--dark',
    '.lg-surface--gold',
    '.v6-corporate-matrix__card',
    '.v6-editorial__card',
    '.v6-trust-signal',
    '.v6-news-strip__item',
  ].join(', ');

  // ── Estado ─────────────────────────────────────────────────────────────────

  var observer = null;
  var staggerCounts = new WeakMap(); // parent → next stagger index

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getStaggerDelay(el) {
    var parent = el.parentElement;
    if (!parent) return 0;

    var override = el.dataset && el.dataset.revealDelay;
    if (override !== undefined) return parseInt(override, 10) || 0;

    var idx = staggerCounts.get(parent) || 0;
    staggerCounts.set(parent, idx + 1);
    return idx * STAGGER;
  }

  function prepareElement(el) {
    if (el._auroraRevealReady) return;
    el._auroraRevealReady = true;

    // Soporte reducedMotion — accesibilidad
    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      el._auroraRevealSkip = true;
      return;
    }

    el.style.setProperty('opacity', '0');
    el.style.setProperty('transform', 'translateY(24px)');
    el.style.setProperty('filter', 'blur(8px)');
    el.style.setProperty('will-change', 'opacity, transform, filter');
  }

  function revealElement(el) {
    if (el._auroraRevealSkip || el._auroraRevealed) return;
    el._auroraRevealed = true;

    var delay = getStaggerDelay(el);
    var transition = [
      'opacity ' + DURATION + 'ms ' + SPRING + ' ' + delay + 'ms',
      'transform ' + DURATION + 'ms ' + SPRING + ' ' + delay + 'ms',
      'filter ' + DURATION + 'ms ease-out ' + delay + 'ms',
    ].join(', ');

    el.style.setProperty('transition', transition);
    el.style.setProperty('opacity', '');
    el.style.setProperty('transform', '');
    el.style.setProperty('filter', '');

    // Cleanup after animation
    setTimeout(function () {
      el.style.removeProperty('will-change');
      el.style.removeProperty('transition');
    }, DURATION + delay + 100);
  }

  // ── IntersectionObserver ───────────────────────────────────────────────────

  function createObserver() {
    return new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            revealElement(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: THRESHOLD,
        rootMargin: ROOT_MARGIN,
      }
    );
  }

  function observeAll() {
    var elements = document.querySelectorAll(AUTO_SELECTORS);
    // Reset stagger counts para re-runs
    staggerCounts = new WeakMap();

    elements.forEach(function (el) {
      // Skip elementos con [data-no-reveal] o que ya se revelaron
      if (el.dataset && el.dataset.noReveal !== undefined) return;
      if (el._auroraRevealed) return;

      prepareElement(el);
      if (!el._auroraRevealSkip) {
        observer.observe(el);
      }
    });
  }

  // ── API Pública ────────────────────────────────────────────────────────────

  window.AuroraScrollReveal = {
    /**
     * Revela manualmente un elemento (útil para contenido cargado dinámicamente)
     */
    reveal: function (el) {
      if (!(el instanceof Element)) return;
      prepareElement(el);
      requestAnimationFrame(function () { revealElement(el); });
    },

    /**
     * Añade nuevos elementos al observer (útil para contenido AJAX)
     */
    observe: function (el) {
      if (!(el instanceof Element)) return;
      if (el._auroraRevealed || el._auroraRevealSkip) return;
      prepareElement(el);
      if (observer && !el._auroraRevealSkip) observer.observe(el);
    },

    /**
     * Re-escanea el DOM (útil tras navegaciones SPA)
     */
    refresh: function () {
      observeAll();
    },
  };

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    if (!window.IntersectionObserver) return; // Fallback: nada, los elementos quedan visibles

    observer = createObserver();
    observeAll();

    // Escuchar mutaciones del DOM para contenido cargado dinámicamente
    if (window.MutationObserver) {
      var mutationObs = new MutationObserver(function (mutations) {
        var hasNewNodes = mutations.some(function (m) {
          return m.addedNodes && m.addedNodes.length > 0;
        });
        if (hasNewNodes) {
          // Debounce para no re-escanear con cada micro-mutación
          clearTimeout(mutationObs._timer);
          mutationObs._timer = setTimeout(observeAll, 150);
        }
      });

      mutationObs.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
