(function () {
  const GA4_MEASUREMENT_ID = 'G-2DWZ5PJ4MC';
  const COOKIE_CONSENT_STORAGE_KEY = 'pa_cookie_consent_v1';
  const sentStages = {
    visit: false,
    scroll: false,
  };

  function normalizeLabel(value, fallback) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64);

    return normalized || fallback || 'unknown';
  }

  function getCookieConsent() {
    try {
      const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
      if (!raw) {
        return '';
      }

      const parsed = JSON.parse(raw);
      return typeof parsed?.status === 'string' ? parsed.status : '';
    } catch (_error) {
      return '';
    }
  }

  function ensureGa4Bridge() {
    if (typeof window.gtag === 'function') {
      return true;
    }

    if (getCookieConsent() !== 'accepted') {
      return false;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };

    if (!document.querySelector(`script[data-aurora-revenue-ga4="${GA4_MEASUREMENT_ID}"]`)) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
      script.dataset.auroraRevenueGa4 = GA4_MEASUREMENT_ID;
      document.head.appendChild(script);
    }

    if (!window.__auroraRevenueGa4Configured) {
      window.__auroraRevenueGa4Configured = true;
      window.gtag('js', new Date());
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
      window.gtag('config', GA4_MEASUREMENT_ID);
    }

    return true;
  }

  function getRevenuePage() {
    if (document.body && document.body.dataset.revenuePage) {
      return normalizeLabel(document.body.dataset.revenuePage, 'revenue');
    }

    const segments = String(window.location.pathname || '/')
      .split('/')
      .filter(Boolean);
    return normalizeLabel(segments[segments.length - 1] || 'revenue', 'revenue');
  }

  function getSectionLabel(element) {
    const section = element && typeof element.closest === 'function'
      ? element.closest('section')
      : null;

    if (!section) {
      return 'page';
    }

    if (section.id) {
      return normalizeLabel(section.id, 'page');
    }

    if (section.classList && section.classList.length > 0) {
      return normalizeLabel(section.classList[0], 'page');
    }

    return 'page';
  }

  function getClickLabel(element) {
    const label = element?.dataset?.revenueLabel
      || element?.getAttribute?.('aria-label')
      || element?.textContent;
    return normalizeLabel(label, 'cta');
  }

  function trackEvent(eventName, params) {
    if (!ensureGa4Bridge()) {
      return false;
    }

    const payload = {
      event_category: 'revenue_funnel',
      revenue_page: getRevenuePage(),
      page_path: window.location.pathname || '/',
      ...params,
    };

    window.gtag('event', eventName, payload);
    return true;
  }

  function trackVisit() {
    if (sentStages.visit) {
      return;
    }

    sentStages.visit = true;
    trackEvent('revenue_page_visit', {
      funnel_step: 'visit',
    });
  }

  function trackScroll() {
    if (sentStages.scroll) {
      return;
    }

    const doc = document.documentElement;
    const scrollableHeight = Math.max(
      0,
      (doc?.scrollHeight || document.body?.scrollHeight || 0) - window.innerHeight
    );
    const scrollTop = window.scrollY || doc?.scrollTop || document.body?.scrollTop || 0;
    const progress = scrollableHeight > 0 ? scrollTop / scrollableHeight : 1;

    if (progress < 0.45) {
      return;
    }

    sentStages.scroll = true;
    trackEvent('revenue_page_scroll', {
      funnel_step: 'scroll',
      scroll_depth_percent: Math.round(progress * 100),
    });
  }

  function trackWhatsAppClick(detail) {
    const payload = detail && typeof detail === 'object' ? detail : {};
    trackEvent('revenue_whatsapp_click', {
      funnel_step: 'whatsapp_click',
      cta_label: normalizeLabel(payload.cta_label, 'cta'),
      cta_section: normalizeLabel(payload.cta_section, 'page'),
      click_channel: normalizeLabel(payload.click_channel, 'whatsapp_link'),
      has_prefilled_text: payload.has_prefilled_text ? 'true' : 'false',
    });
  }

  function trackMessageIntent(detail) {
    const payload = detail && typeof detail === 'object' ? detail : {};
    trackEvent('revenue_message_intent', {
      funnel_step: 'message',
      cta_label: normalizeLabel(payload.cta_label, 'cta'),
      cta_section: normalizeLabel(payload.cta_section, 'page'),
      message_channel: normalizeLabel(payload.message_channel, 'unknown'),
      message_length: Number.isFinite(payload.message_length)
        ? Math.max(0, Number(payload.message_length))
        : 0,
    });
  }

  function handleDocumentClick(event) {
    const anchor = event.target instanceof Element
      ? event.target.closest('a[href*="wa.me/"], a[href*="api.whatsapp.com"], a[href*="web.whatsapp.com"]')
      : null;

    if (!(anchor instanceof HTMLAnchorElement)) {
      return;
    }

    let messageText = '';
    try {
      const url = new URL(anchor.href, window.location.origin);
      messageText = String(url.searchParams.get('text') || '');
    } catch (_error) {
      messageText = '';
    }

    const detail = {
      cta_label: getClickLabel(anchor),
      cta_section: getSectionLabel(anchor),
      click_channel: 'whatsapp_link',
      has_prefilled_text: Boolean(messageText.trim()),
    };

    trackWhatsAppClick(detail);

    if (messageText.trim()) {
      trackMessageIntent({
        cta_label: detail.cta_label,
        cta_section: detail.cta_section,
        message_channel: 'whatsapp_prefill',
        message_length: messageText.trim().length,
      });
    }
  }

  function bindScrollTracking() {
    let ticking = false;

    function onScroll() {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        trackScroll();
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
  }

  function captureGlobalReferral() {
    try {
      if (typeof window === 'undefined' || !window.location || !window.URLSearchParams) return;
      
      const searchParams = new URLSearchParams(window.location.search);
      const refCode = searchParams.get('ref');
      
      if (refCode && refCode.trim() !== '') {
        const cleanlyRefCode = refCode.trim();
        window.localStorage.setItem('aurora_referral_code', cleanlyRefCode);
        
        // Track the click transparently
        fetch('/api.php?resource=referral-click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: cleanlyRefCode })
        }).catch(() => {});
      }
    } catch (_e) {
      // Ignorar errores relacionados a localStorage cross-origin
    }
  }

  function init() {
    window.AuroraRevenueFunnel = {
      trackEvent,
      trackMessageIntent,
      trackWhatsAppClick,
    };

    captureGlobalReferral();
    trackVisit();
    bindScrollTracking();
    document.addEventListener('click', handleDocumentClick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
