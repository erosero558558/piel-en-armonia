document.addEventListener('DOMContentLoaded', () => {
    const phone = '593982453672';
    const locale = document.documentElement.lang === 'en' ? 'en' : 'es';

    const isClinicWhatsAppUrl = (value) => {
        try {
            const url =
                value instanceof URL
                    ? value
                    : new URL(String(value || ''), window.location.href);
            const host = String(url.hostname || '')
                .replace(/^www\./, '')
                .toLowerCase();
            return (
                (host === 'wa.me' &&
                    url.pathname.replace(/\//g, '') === phone) ||
                ((host === 'api.whatsapp.com' ||
                    host === 'web.whatsapp.com') &&
                    String(url.searchParams.get('phone') || '').replace(
                        /\D/g,
                        ''
                    ) === phone)
            );
        } catch (_error) {
            return false;
        }
    };

    const pushAnalyticsEvent = (eventName, payload) => {
        const safePayload =
            payload && typeof payload === 'object' ? payload : {};
        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, safePayload);
            return;
        }

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: eventName,
            ...safePayload,
        });
    };

    const contextualizeWhatsAppLinks = () => {
        const message =
            locale === 'en'
                ? "Hello, I'd like to book a dermatology evaluation"
                : 'Hola, me gustaria agendar una evaluacion dermatologica';

        document
            .querySelectorAll('a[href*="wa.me/"], a[href*="whatsapp.com/"]')
            .forEach((link) => {
                if (!(link instanceof HTMLAnchorElement)) return;
                try {
                    const url = new URL(link.href, window.location.href);
                    if (!isClinicWhatsAppUrl(url)) return;
                    if (String(url.searchParams.get('text') || '').trim()) {
                        return;
                    }
                    url.searchParams.set('text', message);
                    link.setAttribute('href', url.toString());
                } catch (_error) {
                    // Keep authored hrefs untouched when parsing fails.
                }
            });
    };

    const bindWhatsAppTracking = () => {
        document.addEventListener(
            'click',
            (event) => {
                const target = event.target instanceof Element ? event.target : null;
                if (!target) return;

                const link = target.closest(
                    'a[href*="wa.me/"], a[href*="whatsapp.com/"]'
                );
                if (!(link instanceof HTMLAnchorElement)) return;

                const rawHref = String(link.getAttribute('href') || '').trim();
                if (!rawHref || !isClinicWhatsAppUrl(rawHref)) return;

                pushAnalyticsEvent('whatsapp_click', {
                    service: 'home',
                    page: window.location.pathname || '/',
                });
            },
            true
        );
    };

    contextualizeWhatsAppLinks();
    bindWhatsAppTracking();

    const obs = new IntersectionObserver(
        (es, o) => {
            es.forEach((e) => {
                if (e.isIntersecting) {
                    e.target.classList.add('active');
                    o.unobserve(e.target);
                }
            });
        },
        { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => obs.observe(el));
    const nav = document.querySelector('.navbar-glass'),
        sticky = document.getElementById('stickyCta'),
        heroH = document.querySelector('.hero-clinical')?.offsetHeight || 700;
    let ticking = false;
    window.addEventListener(
        'scroll',
        () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const y = window.scrollY;
                    if (nav) nav.classList.toggle('scrolled', y > 80);
                    if (sticky)
                        sticky.classList.toggle('visible', y > heroH * 0.7);
                    ticking = false;
                });
                ticking = true;
            }
        },
        { passive: true }
    );
    const cObs = new IntersectionObserver(
        (es, o) => {
            es.forEach((e) => {
                if (!e.isIntersecting) return;
                const el = e.target,
                    t = parseFloat(el.dataset.count),
                    s = el.dataset.suffix || '',
                    d = t % 1 !== 0,
                    st = performance.now();
                const a = (n) => {
                    const p = Math.min((n - st) / 1800, 1),
                        ea = 1 - Math.pow(1 - p, 4);
                    el.textContent =
                        (d ? (t * ea).toFixed(1) : Math.floor(t * ea)) + s;
                    if (p < 1) requestAnimationFrame(a);
                };
                requestAnimationFrame(a);
                o.unobserve(el);
            });
        },
        { threshold: 0.5 }
    );
    document.querySelectorAll('[data-count]').forEach((c) => cObs.observe(c));
    document.querySelectorAll('.faq-question').forEach((b) => {
        b.addEventListener('click', () => {
            const i = b.closest('.faq-item'),
                o = i.classList.contains('open');
            document
                .querySelectorAll('.faq-item.open')
                .forEach((el) => el.classList.remove('open'));
            if (!o) i.classList.add('open');
        });
    });
    const bi = document.querySelector('.pub-ba-slider'),
        ba = document.querySelector('.pub-ba-after'),
        bh = document.querySelector('.pub-ba-divider');
    if (bi && ba && bh) {
        const u = (v) => {
            ba.style.clipPath = `inset(0 ${100 - v}% 0 0)`;
            bh.style.left = `${v}%`;
        };
        bi.addEventListener('input', (e) => u(e.target.value));
        u(50);
    }
    const hb = document.getElementById('navHamburger'),
        md = document.getElementById('mobileDrawer'),
        mo = document.getElementById('menuOverlay');
        
    const closeMenu = () => {
        hb?.classList.remove('open');
        hb?.setAttribute('aria-expanded', 'false');
        md?.classList.remove('open');
        mo?.classList.remove('active');
        mo?.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    };

    hb?.addEventListener('click', () => {
        const o = md?.classList.toggle('open');
        if (o) {
            hb.classList.add('open');
            hb.setAttribute('aria-expanded', 'true');
            mo?.classList.add('active');
            mo?.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        } else {
            closeMenu();
        }
    });

    mo?.addEventListener('click', closeMenu);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && md?.classList.contains('open')) {
            closeMenu();
        }
    });

    md?.querySelectorAll('a').forEach((a) => {
        a.addEventListener('click', closeMenu);
    });
});
