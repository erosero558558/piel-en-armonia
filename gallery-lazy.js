const galleryObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const src = img.dataset.src;
                const srcset = img.dataset.srcset;

                if (srcset) img.srcset = srcset;
                img.src = src;
                img.classList.add('loaded');

                galleryObserver.unobserve(img);
            }
        });
    },
    { rootMargin: '200px' }
);

document.querySelectorAll('.gallery-img[data-src]').forEach((img) => {
    galleryObserver.observe(img);
});
