/**
 * js/aurora-counters.js
 * Anima los números incrementales en el hero intro (stat-card > stat-number).
 * (UI3-03)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check user preference for reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
        return; // Sin animación -> solo texto estático
    }

    const counters = document.querySelectorAll('.stat-number');
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    // Ease-out expo easing function
    const easeOutExpo = (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

    function animateCounter(el) {
        const text = el.innerText.trim();
        const numericPart = parseInt(text.replace(/[^0-9]/g, ''), 10);
        const suffix = text.replace(/[0-9]/g, '');

        if (isNaN(numericPart)) {
            return;
        }

        const duration = 1500; // 1.5s
        const startTime = performance.now();
        const startValue = 0;
        const endValue = numericPart;

        function updateNumber(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easedProgress = easeOutExpo(progress);
            const currentVal = Math.floor(startValue + (endValue - startValue) * easedProgress);
            
            // Format number (e.g., 2000 -> 2.000) using local formatting if it is larger than 999
            const formattedVal = currentVal > 999 ? new Intl.NumberFormat('es-EC').format(currentVal) : currentVal;
            
            el.innerText = formattedVal + suffix;

            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            } else {
                // Ensure precise final value
                const finalFormatted = endValue > 999 ? new Intl.NumberFormat('es-EC').format(endValue) : endValue;
                el.innerText = finalFormatted + suffix;
            }
        }

        requestAnimationFrame(updateNumber);
    }

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                // Unobserve after animating once
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    counters.forEach(counter => {
        // Pre-prepare them locally to 0 to prevent harsh jumps if they load inside viewport 
        // (but keep them intact on source for SEO/reduced-motion)
        const initText = counter.innerText.trim();
        const suffix = initText.replace(/[0-9]/g, '');
        counter.dataset.original = initText;
        counter.innerText = '0' + suffix;
        
        observer.observe(counter);
    });
});
