(function () {
    'use strict';
    // build-sync: 20260220-sync2

    let initialized = false;

    function initScrollAnimations() {
        const selector = '.service-card, .team-card, .section-header, .tele-card, .review-card, .showcase-hero, .showcase-card, .showcase-split, .clinic-info, .clinic-map, .footer-content > *, .appointment-form-container, .appointment-info';
        const targets = document.querySelectorAll(selector);
        if (!targets.length) return;

        const shouldSkipObserver = window.innerWidth < 900
            || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

        if (shouldSkipObserver) {
            targets.forEach((el) => el.classList.add('visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            let intersectCount = 0;
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const delay = intersectCount * 100;
                    entry.target.style.transitionDelay = `${delay}ms`;
                    intersectCount++;

                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            root: null,
            rootMargin: '0px 0px -100px 0px',
            threshold: 0.1
        });

        targets.forEach((el) => {
            el.classList.add('animate-on-scroll');
            observer.observe(el);
        });
    }

    function initParallax() {
        const heroImage = document.querySelector('.hero-image-container');
        if (!heroImage) return;
        if (window.innerWidth < 1100) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        let ticking = false;
        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(() => {
                const scrolled = window.pageYOffset;
                const rate = Math.min(80, scrolled * 0.12);
                heroImage.style.transform = `translateY(calc(-50% + ${rate}px))`;
                ticking = false;
            });
        }, { passive: true });
    }

    function initNavbarScroll() {
        const nav = document.querySelector('.nav');
        if (!nav) return;

        let ticking = false;
        let isScrolled = false;

        const applyScrollState = () => {
            const shouldBeScrolled = window.scrollY > 50;
            if (shouldBeScrolled !== isScrolled) {
                nav.classList.toggle('scrolled', shouldBeScrolled);
                isScrolled = shouldBeScrolled;
            }
            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(applyScrollState);
        }, { passive: true });

        applyScrollState();
    }

    function initMapLoader() {
        const placeholder = document.getElementById('mapPlaceholder');
        if (!placeholder) return;

        const loadMap = () => {
            const src = placeholder.dataset.src;
            if (!src) return;

            const iframe = document.createElement('iframe');
            iframe.src = src;
            iframe.width = '100%';
            iframe.height = '100%';
            iframe.allowFullscreen = true;
            iframe.loading = 'lazy';
            iframe.referrerPolicy = 'no-referrer-when-downgrade';
            iframe.style.border = '0';

            placeholder.innerHTML = '';
            placeholder.appendChild(iframe);
            placeholder.classList.remove('map-placeholder');
            placeholder.style.backgroundColor = 'transparent';
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    loadMap();
                    observer.disconnect();
                }
            });
        }, { rootMargin: '200px' });

        observer.observe(placeholder);
        placeholder.addEventListener('click', loadMap, { once: true });
    }

    function initBlurUpImages() {
        const images = document.querySelectorAll('.blur-up img');
        images.forEach(img => {
            if (img.complete) {
                img.classList.add('loaded');
            } else {
                img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
            }
        });
    }

    function initDeferredVisualEffects() {
        const run = () => {
            initScrollAnimations();
            initParallax();
            initMapLoader();
            initBlurUpImages();
        };

        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(run, { timeout: 1200 });
        } else {
            setTimeout(run, 180);
        }
    }

    function init() {
        if (initialized) return;
        initialized = true;
        initNavbarScroll();
        initDeferredVisualEffects();
    }

    window.PielUiEffects = {
        init
    };
})();
