import { apiRequest } from './api.js';
import { storageGetJSON, storageSetJSON, showToast, getInitials, getRelativeDateLabel, renderStars, escapeHtml } from './utils.js';
import { getReviewsCache, setReviewsCache, getReviewsPrefetched, setReviewsPrefetched, getCurrentLang, LOCAL_FALLBACK_ENABLED } from './state.js';
import { DEFAULT_PUBLIC_REVIEWS } from './config.js';
import { loadDeferredModule, createWarmupRunner, bindWarmupTarget, scheduleDeferredTask, runDeferredModule, observeOnceWhenVisible } from './loader.js';
import { trackEvent } from './analytics.js';

const ENGAGEMENT_FORMS_ENGINE_URL = '/engagement-forms-engine.js?v=figo-engagement-20260218-phase1';

export async function createCallbackRecord(callback) {
    try {
        await apiRequest('callbacks', {
            method: 'POST',
            body: callback
        });
    } catch (error) {
        if (!LOCAL_FALLBACK_ENABLED) {
            throw error;
        }
        const callbacks = storageGetJSON('callbacks', []);
        callbacks.push(callback);
        storageSetJSON('callbacks', callbacks);
    }
}

export async function createReviewRecord(review) {
    try {
        const payload = await apiRequest('reviews', {
            method: 'POST',
            body: review
        });
        return payload.data;
    } catch (error) {
        if (!LOCAL_FALLBACK_ENABLED) {
            throw error;
        }
        const localReviews = storageGetJSON('reviews', []);
        localReviews.unshift(review);
        storageSetJSON('reviews', localReviews);
        return review;
    }
}

export function mergePublicReviews(inputReviews) {
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

export function renderPublicReviews(reviews) {
    const grid = document.querySelector('.reviews-grid');
    if (!grid || !Array.isArray(reviews) || reviews.length === 0) return;

    const topReviews = reviews.slice(0, 6);
    grid.innerHTML = topReviews.map(review => {
        const text = String(review.text || '').trim();
        const textHtml = text !== ''
            ? `<p class="review-text">"${escapeHtml(text)}"</p>`
            : '';
        return `
        <div class="review-card">
            <div class="review-header">
                <div class="review-avatar">${escapeHtml(getInitials(review.name))}</div>
                <div class="review-meta">
                    <h4>${escapeHtml(review.name || (getCurrentLang() === 'es' ? 'Paciente' : 'Patient'))}</h4>
                    <div class="review-stars">${renderStars(review.rating)}</div>
                </div>
            </div>
            ${textHtml}
            <span class="review-date">${getRelativeDateLabel(review.date)}</span>
        </div>
    `;
    }).join('');

    // Actualizar promedio dinamico en hero + seccion de resenas
    if (reviews.length > 0) {
        const avg = reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length;
        const starsHtml = renderStars(Math.round(avg));

        document.querySelectorAll('.rating-number').forEach(el => {
            el.textContent = avg.toFixed(1);
        });

        document.querySelectorAll('.rating-stars').forEach(el => {
            el.innerHTML = starsHtml;
        });
    }

    const countText = getCurrentLang() === 'es'
        ? `${reviews.length} rese\u00f1as verificadas`
        : `${reviews.length} verified reviews`;

    document.querySelectorAll('.rating-count').forEach(el => {
        el.textContent = countText;
    });
}

export async function loadPublicReviews() {
    try {
        const payload = await apiRequest('reviews');
        const fetchedReviews = Array.isArray(payload.data) ? payload.data : [];
        setReviewsCache(mergePublicReviews(fetchedReviews));
    } catch (error) {
        const localReviews = storageGetJSON('reviews', []);
        setReviewsCache(mergePublicReviews(localReviews));
    }
    renderPublicReviews(getReviewsCache());
}

export function prefetchReviewsData(source = 'unknown') {
    if (getReviewsPrefetched()) {
        return;
    }
    setReviewsPrefetched(true);
    loadPublicReviews().catch(() => {
        setReviewsPrefetched(false);
    });
    trackEvent('reviews_prefetch', {
        source
    });
}

function getEngagementFormsEngineDeps() {
    return {
        createCallbackRecord,
        createReviewRecord,
        renderPublicReviews,
        showToast,
        getCurrentLang: getCurrentLang,
        getReviewsCache: () => {
            const cache = getReviewsCache();
            return Array.isArray(cache) ? cache.slice() : [];
        },
        setReviewsCache: (items) => {
            setReviewsCache(Array.isArray(items) ? items.slice() : []);
        }
    };
}

export function loadEngagementFormsEngine() {
    return loadDeferredModule({
        cacheKey: 'engagement-forms-engine',
        src: ENGAGEMENT_FORMS_ENGINE_URL,
        scriptDataAttribute: 'data-engagement-forms-engine',
        resolveModule: () => window.PielEngagementFormsEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getEngagementFormsEngineDeps()),
        missingApiError: 'engagement-forms-engine loaded without API',
        loadError: 'No se pudo cargar engagement-forms-engine.js',
        logLabel: 'Engagement forms engine'
    });
}

export function initEngagementFormsEngineWarmup() {
    const warmup = createWarmupRunner(() => loadEngagementFormsEngine());

    bindWarmupTarget('#callbackForm', 'focusin', warmup, false);
    bindWarmupTarget('#callbackForm', 'pointerdown', warmup);
    bindWarmupTarget('#resenas [data-action="open-review-modal"]', 'mouseenter', warmup);
    bindWarmupTarget('#resenas [data-action="open-review-modal"]', 'touchstart', warmup);

    if (document.getElementById('callbackForm')) {
        setTimeout(warmup, 120);
    }

    const reviewSection = document.getElementById('resenas');
    observeOnceWhenVisible(reviewSection, warmup, {
        threshold: 0.05,
        rootMargin: '280px 0px',
        onNoObserver: warmup
    });

    scheduleDeferredTask(warmup, {
        idleTimeout: 2600,
        fallbackDelay: 1500
    });
}

export function initDeferredSectionPrefetch() {
    const reviewsSection = document.getElementById('resenas');
    if (!reviewsSection) {
        return;
    }

    observeOnceWhenVisible(reviewsSection, () => {
        prefetchReviewsData('reviews_section_visible');
    }, {
        threshold: 0.2,
        rootMargin: '120px 0px',
        onNoObserver: () => {
            prefetchReviewsData('fallback_no_observer');
        }
    });
}

export function openReviewModal() {
    runDeferredModule(
        loadEngagementFormsEngine,
        (engine) => engine.openReviewModal(),
        () => {
            const modal = document.getElementById('reviewModal');
            if (modal) {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        }
    );
}

export function closeReviewModal() {
    const modal = document.getElementById('reviewModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.body.style.overflow = '';

    runDeferredModule(loadEngagementFormsEngine, (engine) => engine.closeReviewModal());
}
