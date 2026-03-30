// js/aurora-lightbox.js

document.addEventListener('DOMContentLoaded', () => {
    // Escuchar clicks en cualquier imagen de galería clínica
    document.body.addEventListener('click', (e) => {
        if (e.target && e.target.matches('.clinical-photo')) {
            e.preventDefault();
            openLightbox(e.target);
        }
    });

    let currentImages = [];
    let currentIndex = 0;
    let overlayStyles = null;

    function openLightbox(startImg) {
        // Encontrar todas las imágenes del mismo grupo/contenedor
        // Si hay un contenedor de historia clínica, buscar dentro. Si no, en todo el doc.
        const container = startImg.closest('.clinical-history-dashboard') || document.body;
        const imgsNodeList = container.querySelectorAll('.clinical-photo');
        currentImages = Array.from(imgsNodeList);
        
        currentIndex = currentImages.indexOf(startImg);
        if (currentIndex === -1) currentIndex = 0;

        renderOverlay();
        updateImage();
        
        document.addEventListener('keydown', handleKeydown);
    }

    function renderOverlay() {
        if (document.getElementById('aurora-lightbox-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'aurora-lightbox-overlay';
        overlay.className = 'aurora-lightbox-overlay';
        overlay.innerHTML = `
            <div class="aurora-lightbox-controls">
                <div id="aurora-lightbox-counter" class="aurora-lightbox-counter"></div>
                <button id="aurora-lightbox-close" class="aurora-lightbox-btn" aria-label="Cerrar">&times;</button>
            </div>
            <button id="aurora-lightbox-prev" class="aurora-lightbox-btn aurora-lightbox-nav prev" aria-label="Anterior">&#10094;</button>
            <div class="aurora-lightbox-content">
                <img id="aurora-lightbox-img" src="" alt="Foto clínica ampliada" aria-label="Foto clínica ampliada">
            </div>
            <button id="aurora-lightbox-next" class="aurora-lightbox-btn aurora-lightbox-nav next" aria-label="Siguiente">&#10095;</button>
        `;

        document.body.appendChild(overlay);

        // Listeners
        document.getElementById('aurora-lightbox-close').addEventListener('click', closeLightbox);
        document.getElementById('aurora-lightbox-prev').addEventListener('click', (e) => { e.stopPropagation(); prevImage(); });
        document.getElementById('aurora-lightbox-next').addEventListener('click', (e) => { e.stopPropagation(); nextImage(); });
        
        // Cerrar al clickear el fondo
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target.classList.contains('aurora-lightbox-content')) {
                closeLightbox();
            }
        });

        // Doble click para zoom
        const imgEl = document.getElementById('aurora-lightbox-img');
        imgEl.addEventListener('dblclick', () => {
            imgEl.classList.toggle('is-zoomed');
        });
        
        // Prevenir arrastre predeterminado que ensucia la experiencia
        imgEl.addEventListener('dragstart', e => e.preventDefault());
    }

    function updateImage() {
        const imgEl = document.getElementById('aurora-lightbox-img');
        const counterEl = document.getElementById('aurora-lightbox-counter');
        const prevBtn = document.getElementById('aurora-lightbox-prev');
        const nextBtn = document.getElementById('aurora-lightbox-next');

        if (!imgEl) return;

        // Reset zoom
        imgEl.classList.remove('is-zoomed');

        // Intentar buscar una versión de alta resolución si es que usa data-full-src o data-src
        const sourceImg = currentImages[currentIndex];
        const hqSrc = sourceImg.getAttribute('data-full-src') || sourceImg.src;

        imgEl.src = hqSrc;
        counterEl.textContent = `${currentIndex + 1} de ${currentImages.length}`;
        
        // Flechas ocultas si es 1 sola imagen
        if (currentImages.length <= 1) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        } else {
            prevBtn.style.display = 'block';
            nextBtn.style.display = 'block';
        }
    }

    function prevImage() {
        if (currentImages.length <= 1) return;
        currentIndex = (currentIndex > 0) ? currentIndex - 1 : currentImages.length - 1;
        updateImage();
    }

    function nextImage() {
        if (currentImages.length <= 1) return;
        currentIndex = (currentIndex < currentImages.length - 1) ? currentIndex + 1 : 0;
        updateImage();
    }

    function closeLightbox() {
        const overlay = document.getElementById('aurora-lightbox-overlay');
        if (overlay) document.body.removeChild(overlay);
        document.removeEventListener('keydown', handleKeydown);
    }

    function handleKeydown(e) {
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') prevImage();
        else if (e.key === 'ArrowRight') nextImage();
    }
});
