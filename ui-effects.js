(function () {
    'use strict';

    let initialized = false;

    function initScrollAnimations() {
        const targets = document.querySelectorAll('.service-card, .team-card, .section-header, .tele-card, .review-card');
        if (!targets.length) return;

        const shouldSkipObserver = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

        if (shouldSkipObserver) {
            targets.forEach((el) => el.classList.add('visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
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

    function initServicesCarousel() {
        const wrapper = document.querySelector('.services-carousel-wrapper');
        if (!wrapper) return;

        const container = wrapper.querySelector('.services-carousel');
        const prevBtn = wrapper.querySelector('[data-action="carousel-prev"]');
        const nextBtn = wrapper.querySelector('[data-action="carousel-next"]');

        if (!container || !prevBtn || !nextBtn) return;

        const getScrollAmount = () => {
            const card = container.querySelector('.service-card');
            // width + gap (20px)
            return card ? card.offsetWidth + 20 : 320;
        };

        prevBtn.addEventListener('click', () => {
            container.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' });
        });

        nextBtn.addEventListener('click', () => {
            container.scrollBy({ left: getScrollAmount(), behavior: 'smooth' });
        });
    }

    function initDeferredVisualEffects() {
        const run = () => {
            initScrollAnimations();
            initParallax();
            initServicesCarousel();
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