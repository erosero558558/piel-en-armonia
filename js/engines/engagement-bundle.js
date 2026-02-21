(function () {
    'use strict';

    // build-sync: 20260219-sync1

    let deps$1 = null;
    let initialized = false;
    let selectedRating = 0;
    let stars = [];

    function getLang$1() {
        return deps$1 && typeof deps$1.getCurrentLang === 'function'
            ? deps$1.getCurrentLang()
            : 'es';
    }

    function t(esText, enText) {
        return getLang$1() === 'en' ? enText : esText;
    }

    function getCaptchaToken(action) {
        try {
            return deps$1.getCaptchaToken
                ? deps$1.getCaptchaToken(action)
                : Promise.resolve(null);
        } catch (e) {
            return Promise.resolve(null);
        }
    }

    function resetStarVisuals() {
        stars.forEach((star) => {
            star.classList.remove('active', 'fas');
            star.classList.add('far');
        });
    }

    function applySelectedRating(rating) {
        selectedRating = rating;
        stars.forEach((star, index) => {
            const active = index < selectedRating;
            star.classList.toggle('active', active);
            star.classList.toggle('fas', active);
            star.classList.toggle('far', !active);
        });
    }

    function bindCallbackForm() {
        const callbackForm = document.getElementById('callbackForm');
        if (
            !callbackForm ||
            callbackForm.dataset.callbackEngineBound === 'true'
        ) {
            return;
        }
        callbackForm.dataset.callbackEngineBound = 'true';

        callbackForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const submitBtn = this.querySelector('button[type="submit"]');
            const originalContent = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML =
                    '<i class="fas fa-spinner fa-spin"></i> Enviando...';
            }

            const formData = new FormData(this);
            const token = await getCaptchaToken('callback');
            const callback = {
                id: Date.now(),
                telefono: formData.get('telefono'),
                preferencia: formData.get('preferencia'),
                fecha: new Date().toISOString(),
                status: 'pendiente',
                captchaToken: token,
            };

            try {
                if (deps$1 && typeof deps$1.createCallbackRecord === 'function') {
                    await deps$1.createCallbackRecord(callback);
                }
                if (deps$1 && typeof deps$1.showToast === 'function') {
                    deps$1.showToast(
                        t(
                            'Solicitud enviada. Te llamaremos pronto.',
                            'Request sent. We will call you soon.'
                        ),
                        'success'
                    );
                }
                this.reset();
            } catch (error) {
                if (deps$1 && typeof deps$1.showToast === 'function') {
                    deps$1.showToast(
                        t(
                            'No se pudo enviar tu solicitud. Intenta de nuevo.',
                            'We could not send your request. Try again.'
                        ),
                        'error'
                    );
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalContent;
                }
            }
        });
    }

    function bindReviewForm() {
        const reviewForm = document.getElementById('reviewForm');
        const reviewStars = Array.from(
            document.querySelectorAll('.star-rating i')
        );
        if (!reviewForm || reviewForm.dataset.reviewEngineBound === 'true') {
            stars = reviewStars;
            return;
        }

        reviewForm.dataset.reviewEngineBound = 'true';
        stars = reviewStars;
        selectedRating = 0;

        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                applySelectedRating(index + 1);
            });
        });

        reviewForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            if (selectedRating === 0) {
                alert(
                    t(
                        'Por favor selecciona una calificacion',
                        'Please select a rating'
                    )
                );
                return;
            }

            const formData = new FormData(this);
            const token = await getCaptchaToken('review');
            const review = {
                id: Date.now(),
                name: formData.get('reviewerName'),
                rating: selectedRating,
                text: formData.get('reviewText'),
                date: new Date().toISOString(),
                verified: true,
                captchaToken: token,
            };

            try {
                const savedReview =
                    deps$1 && typeof deps$1.createReviewRecord === 'function'
                        ? await deps$1.createReviewRecord(review)
                        : review;

                const currentReviews =
                    deps$1 && typeof deps$1.getReviewsCache === 'function'
                        ? deps$1.getReviewsCache()
                            : [];
                const mergedReviews = [
                    savedReview,
                    ...currentReviews.filter(
                        (item) => item.id !== savedReview.id
                    ),
                ];

                if (deps$1 && typeof deps$1.setReviewsCache === 'function') {
                    deps$1.setReviewsCache(mergedReviews);
                }
                if (deps$1 && typeof deps$1.renderPublicReviews === 'function') {
                    deps$1.renderPublicReviews(mergedReviews);
                }

                if (deps$1 && typeof deps$1.showToast === 'function') {
                    deps$1.showToast(
                        t(
                            'Gracias por tu reseña.',
                            'Thank you for your review.'
                        ),
                        'success'
                    );
                }

                closeReviewModal();
                this.reset();
                selectedRating = 0;
                resetStarVisuals();
            } catch (error) {
                if (deps$1 && typeof deps$1.showToast === 'function') {
                    deps$1.showToast(
                        t(
                            'No pudimos guardar tu reseña. Intenta nuevamente.',
                            'We could not save your review. Try again.'
                        ),
                        'error'
                    );
                }
            }
        });
    }

    function openReviewModal() {
        const modal = document.getElementById('reviewModal');
        if (!modal) return;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeReviewModal() {
        const modal = document.getElementById('reviewModal');
        if (!modal) return;
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function init$1(inputDeps) {
        deps$1 = inputDeps || deps$1;
        bindCallbackForm();
        bindReviewForm();
        initialized = true;
        return window.PielEngagementFormsEngine;
    }

    function isInitialized() {
        return initialized;
    }

    window.PielEngagementFormsEngine = {
        init: init$1,
        isInitialized,
        openReviewModal,
        closeReviewModal,
    };

    let deps = null;
    let reviewsCache = [];

    const DEFAULT_PUBLIC_REVIEWS = [
        {
            id: 'google-jose-gancino',
            name: 'Jose Gancino',
            rating: 5,
            text: 'Buena atencion, solo faltan los numeros de la oficina y horarios de atencion.',
            date: '2025-10-01T10:00:00-05:00',
            verified: true
        },
        {
            id: 'google-jacqueline-ruiz-torres',
            name: 'Jacqueline Ruiz Torres',
            rating: 5,
            text: 'Excelente atencion y economico.',
            date: '2025-04-15T10:00:00-05:00',
            verified: true
        },
        {
            id: 'google-cris-lema',
            name: 'Cris Lema',
            rating: 5,
            text: '',
            date: '2025-10-10T10:00:00-05:00',
            verified: true
        },
        {
            id: 'google-camila-escobar',
            name: 'Camila Escobar',
            rating: 5,
            text: '',
            date: '2025-02-01T10:00:00-05:00',
            verified: true
        }
    ];

    function getLang() {
        return deps && typeof deps.getCurrentLang === 'function' ? deps.getCurrentLang() : 'es';
    }

    function escapeText(value) {
        if (deps && typeof deps.escapeHtml === 'function') {
            return deps.escapeHtml(value);
        }
        return '';
    }

    function mergePublicReviews(inputReviews) {
        const merged = [];
        const seen = new Set();

        const addReview = (review) => {
            if (!review || typeof review !== 'object') return;
            const name = String(review.name || '').trim().toLowerCase();
            const text = String(review.text || '').trim().toLowerCase();
            const date = String(review.date || '').trim();
            const signature = `${name}|${text}|${date}`;
            if (!name || seen.has(signature)) return;
            seen.add(signature);
            merged.push(review);
        };

        DEFAULT_PUBLIC_REVIEWS.forEach(addReview);
        if (Array.isArray(inputReviews)) {
            inputReviews.forEach(addReview);
        }

        return merged;
    }

    function getInitials(name) {
        if (deps && typeof deps.getInitials === 'function') {
            return deps.getInitials(name);
        }
        return 'PA';
    }

    function getRelativeDateLabel(dateText) {
        if (deps && typeof deps.getRelativeDateLabel === 'function') {
            return deps.getRelativeDateLabel(dateText);
        }
        return '';
    }

    function renderStars(rating) {
        if (deps && typeof deps.renderStars === 'function') {
            return deps.renderStars(rating);
        }
        return '';
    }

    function renderPublicReviews(reviews) {
        const grid = document.querySelector('.reviews-grid');
        if (!grid || !Array.isArray(reviews) || reviews.length === 0) return;

        const topReviews = reviews.slice(0, 6);
        grid.innerHTML = topReviews.map((review) => {
            const text = String(review.text || '').trim();
            const textHtml = text !== ''
                ? `<p class="review-text">"${escapeText(text)}"</p>`
                : '';
            return `
    <div class="review-card">
        <div class="review-header">
            <div class="review-avatar">${escapeText(getInitials(review.name))}</div>
            <div class="review-meta">
                <h4>${escapeText(review.name || (getLang() === 'es' ? 'Paciente' : 'Patient'))}</h4>
                <div class="review-stars">${renderStars(review.rating)}</div>
            </div>
        </div>
        ${textHtml}
        <span class="review-date">${getRelativeDateLabel(review.date)}</span>
    </div>
`;
        }).join('');

        if (reviews.length > 0) {
            const avg = reviews.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) / reviews.length;
            const starsHtml = renderStars(Math.round(avg));

            document.querySelectorAll('.rating-number').forEach((el) => {
                el.textContent = avg.toFixed(1);
            });

            document.querySelectorAll('.rating-stars').forEach((el) => {
                el.innerHTML = starsHtml;
            });
        }

        const countText = getLang() === 'es'
            ? `${reviews.length} reseñas verificadas`
            : `${reviews.length} verified reviews`;

        document.querySelectorAll('.rating-count').forEach((el) => {
            el.textContent = countText;
        });
    }

    async function loadPublicReviews(options = {}) {
        const background = options && options.background === true;

        try {
            if (!deps || typeof deps.apiRequest !== 'function') {
                throw new Error('reviews-engine missing apiRequest dependency');
            }

            const payload = await deps.apiRequest('reviews', {
                background,
                silentSlowNotice: background
            });
            const fetchedReviews = Array.isArray(payload.data) ? payload.data : [];
            reviewsCache = mergePublicReviews(fetchedReviews);
        } catch (error) {
            const localReviews = deps && typeof deps.storageGetJSON === 'function'
                ? deps.storageGetJSON('reviews', [])
                : [];
            reviewsCache = mergePublicReviews(localReviews);
        }

        renderPublicReviews(reviewsCache);
        return getCache();
    }

    function getCache() {
        return Array.isArray(reviewsCache) ? reviewsCache.slice() : [];
    }

    function setCache(items) {
        reviewsCache = mergePublicReviews(Array.isArray(items) ? items : []);
        return getCache();
    }

    function init(inputDeps) {
        deps = inputDeps || deps || {};
        if (reviewsCache.length === 0) {
            reviewsCache = mergePublicReviews([]);
        }
        return window.PielReviewsEngine;
    }

    window.Piel = window.Piel || {};
    window.Piel.ReviewsEngine = {
        init,
        loadPublicReviews,
        renderPublicReviews,
        getCache,
        setCache
    };

})();
