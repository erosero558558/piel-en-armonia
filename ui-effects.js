(function () {
    'use strict';

    let initialized = false;

    function initScrollAnimations() {
        const targets = document.querySelectorAll('.service-card, .team-card, .section-header, .tele-card, .review-card, .showcase-card, .showcase-hero, .showcase-split');
        if (!targets.length) return;

        // Skip only if user explicitly prefers reduced motion
        const shouldSkipObserver = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (shouldSkipObserver) {
            targets.forEach((el) => el.classList.add('visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    // Add small staggered delay based on index relative to viewport if needed,
                    // but simple class add is usually performant enough.
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            root: null,
            rootMargin: '0px 0px -60px 0px', // Trigger slightly before bottom
            threshold: 0.05
        });

        targets.forEach((el) => {
            el.classList.add('animate-on-scroll');
            observer.observe(el);
        });
    }

    function initParallax() {
        const heroImage = document.querySelector('.hero-image-container');
        if (!heroImage) return;
        // Keep parallax disabled on mobile for performance/battery
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
            const shouldBeScrolled = window.scrollY > 20; // Lower threshold for faster response
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

    function initServiceTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        const cards = document.querySelectorAll('.service-card');

        if (!tabs.length || !cards.length) return;

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Prevent multiple clicks animation spam
                if (tab.classList.contains('active')) return;

                // Active state
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const filter = tab.dataset.filter;

                // 1. Fade out all currently visible
                cards.forEach(card => {
                    // Only fade out if it's currently visible (not hidden)
                    if (!card.classList.contains('hidden')) {
                        card.classList.remove('fade-in');
                        card.classList.add('fade-out');
                    }
                });

                // 2. Wait for fade out, then swap
                setTimeout(() => {
                    cards.forEach(card => {
                        const category = card.dataset.category;
                        const shouldShow = filter === 'all' || category === filter;

                        if (shouldShow) {
                            card.classList.remove('hidden');
                            card.classList.remove('fade-out');
                            // Force reflow for restart animation
                            // void card.offsetWidth;
                            card.classList.add('fade-in');
                        } else {
                            card.classList.add('hidden');
                            card.classList.remove('fade-out'); // Clean up
                        }
                    });
                }, 250); // Slightly faster than CSS for snap feel
            });
        });
    }

    function initDeferredVisualEffects() {
        const run = () => {
            initScrollAnimations();
            initParallax();
            initServiceTabs();
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
