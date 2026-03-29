document.addEventListener('DOMContentLoaded', () => {
    const contextualizeWhatsAppLinks = () => {
        const phone = '593982453672';
        const locale = document.documentElement.lang === 'en' ? 'en' : 'es';
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
                    const host = String(url.hostname || '')
                        .replace(/^www\./, '')
                        .toLowerCase();
                    const isClinicLink =
                        (host === 'wa.me' &&
                            url.pathname.replace(/\//g, '') === phone) ||
                        ((host === 'api.whatsapp.com' ||
                            host === 'web.whatsapp.com') &&
                            String(url.searchParams.get('phone') || '').replace(
                                /\D/g,
                                ''
                            ) === phone);
                    if (!isClinicLink) return;
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

    contextualizeWhatsAppLinks();

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
    const nav = document.querySelector('.nav-bar'),
        sticky = document.getElementById('stickyCta'),
        heroH = document.querySelector('.hero-fullscreen')?.offsetHeight || 700;
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
    const bi = document.querySelector('.ba-slider-input'),
        ba = document.querySelector('.ba-img.ba-after'),
        bh = document.querySelector('.ba-handle');
    if (bi && ba && bh) {
        const u = (v) => {
            ba.style.clipPath = `polygon(0 0,${v}% 0,${v}% 100%,0 100%)`;
            bh.style.left = `${v}%`;
        };
        bi.addEventListener('input', (e) => u(e.target.value));
        u(50);
    }
    const hb = document.getElementById('navHamburger'),
        ov = document.getElementById('navOverlay');
    const closeMenu = () => {
        hb?.classList.remove('open');
        ov?.classList.remove('open');
        document.body.style.overflow = '';
    };
    hb?.addEventListener('click', () => {
        const o = hb.classList.toggle('open');
        ov?.classList.toggle('open', o);
        document.body.style.overflow = o ? 'hidden' : '';
    });
    ov?.addEventListener('click', (e) => {
        if (e.target === ov) closeMenu();
    });
    ov?.querySelectorAll('.nav-mobile-menu a').forEach((a) => {
        a.addEventListener('click', closeMenu);
    });
});
