(function () {
    'use strict';

    let initialized = false;
    let galleryFiltersInitialized = false;
    let beforeAfterInitialized = false;

    function initGalleryFilter() {
        if (galleryFiltersInitialized) {
            return;
        }

        const filterBtns = document.querySelectorAll('.filter-btn');
        const galleryItems = document.querySelectorAll('.gallery-item');
        if (filterBtns.length === 0 || galleryItems.length === 0) {
            return;
        }

        galleryFiltersInitialized = true;

        filterBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                filterBtns.forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');

                const filter = btn.dataset.filter;

                galleryItems.forEach((item) => {
                    if (filter === 'all' || item.dataset.category === filter) {
                        item.style.display = 'block';
                        setTimeout(() => {
                            item.style.opacity = '1';
                            item.style.transform = 'scale(1)';
                        }, 10);
                    } else {
                        item.style.opacity = '0';
                        item.style.transform = 'scale(0.9)';
                        setTimeout(() => {
                            item.style.display = 'none';
                        }, 300);
                    }
                });
            });
        });
    }

    function initBeforeAfterSlider() {
        if (beforeAfterInitialized) {
            return;
        }

        const sliders = document.querySelectorAll('.ba-slider');
        if (sliders.length === 0) {
            return;
        }

        beforeAfterInitialized = true;

        sliders.forEach((slider) => {
            const handle = slider.querySelector('.ba-handle');
            const after = slider.querySelector('.ba-after');
            if (!handle || !after) {
                return;
            }

            let isDragging = false;

            const updateSlider = (x) => {
                const rect = slider.getBoundingClientRect();
                let percent = ((x - rect.left) / rect.width) * 100;
                percent = Math.max(0, Math.min(100, percent));

                after.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
                handle.style.left = `${percent}%`;
            };

            handle.addEventListener('mousedown', () => {
                isDragging = true;
            });
            document.addEventListener('mouseup', () => {
                isDragging = false;
            });
            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    updateSlider(e.clientX);
                }
            });

            handle.addEventListener(
                'touchstart',
                (e) => {
                    isDragging = true;
                    e.preventDefault();
                },
                { passive: false }
            );
            document.addEventListener('touchend', () => {
                isDragging = false;
            });
            document.addEventListener(
                'touchmove',
                (e) => {
                    if (isDragging) {
                        e.preventDefault();
                        updateSlider(e.touches[0].clientX);
                    }
                },
                { passive: false }
            );

            slider.addEventListener('click', (e) => {
                if (e.target !== handle) {
                    updateSlider(e.clientX);
                }
            });
        });
    }

    function initDeferredGalleryInteractions() {
        const gallerySection = document.getElementById('galeria');
        if (!gallerySection) {
            return;
        }

        const initAll = () => {
            initGalleryFilter();
            initBeforeAfterSlider();
        };

        if (!('IntersectionObserver' in window)) {
            initAll();
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return;
                    }
                    initAll();
                    observer.disconnect();
                });
            },
            { threshold: 0.15, rootMargin: '200px 0px' }
        );

        observer.observe(gallerySection);
    }

    function init() {
        if (initialized) {
            return;
        }
        initialized = true;
        initDeferredGalleryInteractions();
    }

    window.PielGalleryInteractions = {
        init,
    };
})();
