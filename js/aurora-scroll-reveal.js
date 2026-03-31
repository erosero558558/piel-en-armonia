/**
 * Aurora Derm — Liquid Glass Fluid Scroll Reveal System
 * Replaces old flat opacity reveals with a spring physics approach.
 * UI Sprint 4 - Fluid Motion (UI4-10)
 */

class AuroraScrollReveal {
    constructor(options = {}) {
        this.observerOptions = {
            root: null,
            rootMargin: options.rootMargin || '0px 0px -50px 0px',
            threshold: options.threshold || 0.1
        };
        
        // Use the spring cubic-bezier for fluid dynamics (UI4-10 requirement)
        // Spring profile: cubic-bezier(0.34, 1.56, 0.64, 1)
        this.easeSpring = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
        this.duration = '480ms';
        this.staggerDelay = 60; // ms between siblings
        
        this.observer = new IntersectionObserver(this.handleIntersect.bind(this), this.observerOptions);
        
        // Add core styles dynamically to ensure consistency
        this.injectStyles();
        this.init();
    }

    injectStyles() {
        if (document.getElementById('aurora-reveal-styles')) return;

        const style = document.createElement('style');
        style.id = 'aurora-reveal-styles';
        style.textContent = `
            /* Initial state: translated +24px Y, blur(8px), 0 opacity */
            .lg-reveal {
                opacity: 0;
                transform: translateY(24px);
                filter: blur(8px);
                will-change: opacity, transform, filter;
                transition: 
                    opacity ${this.duration} ${this.easeSpring}, 
                    transform ${this.duration} ${this.easeSpring}, 
                    filter ${this.duration} ${this.easeSpring};
            }
            /* End state: su posición final */
            .lg-reveal.is-revealed {
                opacity: 1;
                transform: translateY(0);
                filter: blur(0);
            }

            /* Respect reduced motion preferences */
            @media (prefers-reduced-motion: reduce) {
                .lg-reveal {
                    transition: opacity ${this.duration} ease !important;
                    transform: none !important;
                    filter: none !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    handleIntersect(entries) {
        // Find visible entries
        const intersecting = entries.filter(entry => entry.isIntersecting);
        if (intersecting.length === 0) return;

        // Apply stagger delay to elements appearing at the same time
        intersecting.forEach((entry, idx) => {
            const target = entry.target;
            const delay = idx * this.staggerDelay;

            if (delay > 0) {
                target.style.transitionDelay = `${delay}ms`;
            }

            // Reveal the element
            requestAnimationFrame(() => {
                target.classList.add('is-revealed');
            });

            // Stop observing once revealed (run once)
            this.observer.unobserve(target);
        });
    }

    init() {
        // Automatically hook any element with the reveal class
        const elements = document.querySelectorAll('.aurora-reveal, [data-aurora-reveal], .lg-reveal-target');
        elements.forEach(el => this.observe(el));
    }

    /**
     * Programmatically observe a new element for scroll reveal
     * @param {HTMLElement} node 
     */
    observe(node) {
        if (!node.classList.contains('lg-reveal')) {
            node.classList.add('lg-reveal');
        }
        this.observer.observe(node);
    }

    /**
     * Re-scan the DOM for dynamically added elements
     */
    refresh() {
        this.init();
    }
}

// Ensure execution on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.auroraScrollReveal = new AuroraScrollReveal();
});
