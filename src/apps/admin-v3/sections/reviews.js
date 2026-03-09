import { getState } from '../shared/core/store.js';
import {
    escapeHtml,
    formatDateTime,
    setHtml,
    setText,
} from '../shared/ui/render.js';

function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .trim();
}

function reviewTimestamp(item) {
    const date = new Date(item?.date || item?.createdAt || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getSortedReviews(reviews) {
    return reviews
        .slice()
        .sort((a, b) => reviewTimestamp(b) - reviewTimestamp(a));
}

function getStarLabel(rating) {
    const safeRating = Math.max(
        0,
        Math.min(5, Math.round(Number(rating || 0)))
    );
    return `${safeRating}/5`;
}

function getInitials(name) {
    const parts = String(name || 'Anonimo')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);

    if (!parts.length) return 'AN';
    return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

function getAverageRating(reviews) {
    if (!reviews.length) return 0;
    return (
        reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) /
        reviews.length
    );
}

function countRecentReviews(reviews, days = 30) {
    const now = Date.now();
    return reviews.filter((item) => {
        const stamp = reviewTimestamp(item);
        if (!stamp) return false;
        return now - stamp <= days * 24 * 60 * 60 * 1000;
    }).length;
}

function countLowRatedReviews(reviews) {
    return reviews.filter((item) => Number(item.rating || 0) <= 3).length;
}

function getSentimentLabel(avgRating, totalReviews, lowRatedCount) {
    if (!totalReviews) return 'Sin senal suficiente';
    if (lowRatedCount > 0 && avgRating < 4) return 'Atencion requerida';
    if (avgRating >= 4.7) return 'Confianza alta';
    if (avgRating >= 4.2) return 'Tono solido';
    if (avgRating >= 3.5) return 'Lectura mixta';
    return 'Atencion requerida';
}

function getSpotlightReview(sortedReviews) {
    const lowRated = sortedReviews.find(
        (item) => Number(item.rating || 0) <= 3
    );
    if (lowRated) {
        return {
            item: lowRated,
            eyebrow: 'Feedback accionable',
            summary:
                'Empieza por la resena mas fragil para entender si hay friccion operativa real.',
        };
    }

    const premiumSignal = sortedReviews.find(
        (item) => Number(item.rating || 0) >= 5
    );
    if (premiumSignal) {
        return {
            item: premiumSignal,
            eyebrow: 'Senal a repetir',
            summary:
                'Usa este comentario como referencia del recorrido que conviene proteger.',
        };
    }

    if (sortedReviews[0]) {
        return {
            item: sortedReviews[0],
            eyebrow: 'Ultima voz',
            summary: 'Es la resena mas reciente dentro del corte actual.',
        };
    }

    return {
        item: null,
        eyebrow: 'Sin spotlight',
        summary:
            'Cuando entren resenas apareceran aqui con lectura prioritaria.',
    };
}

function clipCopy(value, maxLength = 220) {
    const text = String(value || '').trim();
    if (!text) return 'Sin comentario escrito.';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trim()}...`;
}

function buildSummaryRail(sortedReviews, recentCount, lowRatedCount) {
    const latestReview = sortedReviews[0];
    const latestDate = latestReview
        ? formatDateTime(latestReview.date || latestReview.createdAt || '')
        : '-';
    const latestAuthor = latestReview
        ? String(latestReview.name || 'Anonimo')
        : 'Sin datos';

    return `
        <article class="reviews-rail-card">
            <span>Ultima resena</span>
            <strong>${escapeHtml(latestAuthor)}</strong>
            <small>${escapeHtml(latestDate)}</small>
        </article>
        <article class="reviews-rail-card">
            <span>Cadencia</span>
            <strong>${escapeHtml(String(recentCount))} en 30 dias</strong>
            <small>Volumen reciente de feedback.</small>
        </article>
        <article class="reviews-rail-card">
            <span>Riesgo</span>
            <strong>${escapeHtml(lowRatedCount > 0 ? `${lowRatedCount} por revisar` : 'Sin alertas')}</strong>
            <small>${escapeHtml(lowRatedCount > 0 ? 'Hay comentarios que requieren lectura completa.' : 'La conversacion reciente esta estable.')}</small>
        </article>
    `;
}

function reviewCard(item, { featured = false } = {}) {
    const rating = Number(item.rating || 0);
    const tone = rating >= 5 ? 'success' : rating <= 3 ? 'danger' : 'neutral';
    const meta =
        rating >= 5
            ? 'Resena de alta confianza'
            : rating <= 3
              ? 'Revisar posible friccion'
              : 'Resena util para contexto';

    return `
        <article class="review-card${featured ? ' is-featured' : ''}" data-rating="${escapeHtml(String(rating))}">
            <header>
                <div class="review-card-heading">
                    <span class="review-avatar">${escapeHtml(
                        getInitials(item.name || 'Anonimo')
                    )}</span>
                    <div>
                        <strong>${escapeHtml(item.name || 'Anonimo')}</strong>
                        <small>${escapeHtml(
                            formatDateTime(item.date || item.createdAt || '')
                        )}</small>
                    </div>
                </div>
                <span class="review-rating-badge" data-tone="${escapeHtml(
                    tone
                )}">${escapeHtml(getStarLabel(rating))}</span>
            </header>
            <p>${escapeHtml(clipCopy(item.comment || item.review || ''))}</p>
            <small>${escapeHtml(meta)}</small>
        </article>
    `;
}

export function renderReviewsSection() {
    const state = getState();
    const reviews = Array.isArray(state?.data?.reviews)
        ? state.data.reviews
        : [];
    const sortedReviews = getSortedReviews(reviews);
    const avgRating = getAverageRating(reviews);
    const fiveStarCount = reviews.filter(
        (item) => Number(item.rating || 0) >= 5
    ).length;
    const recentCount = countRecentReviews(reviews);
    const lowRatedCount = countLowRatedReviews(reviews);
    const spotlight = getSpotlightReview(sortedReviews);

    setText('#reviewsAverageRating', avgRating.toFixed(1));
    setText('#reviewsFiveStarCount', fiveStarCount);
    setText('#reviewsRecentCount', recentCount);
    setText('#reviewsTotalCount', reviews.length);
    setText(
        '#reviewsSentimentLabel',
        getSentimentLabel(avgRating, reviews.length, lowRatedCount)
    );
    setHtml(
        '#reviewsSummaryRail',
        buildSummaryRail(sortedReviews, recentCount, lowRatedCount)
    );

    if (!reviews.length) {
        setHtml(
            '#reviewsSpotlight',
            `
                <div class="reviews-empty-state" data-admin-empty-state="reviews">
                    <strong>Sin feedback reciente</strong>
                    <p>No hay resenas registradas todavia.</p>
                </div>
            `
        );
        setHtml(
            '#reviewsGrid',
            `
                <div class="reviews-empty-state" data-admin-empty-state="reviews-grid">
                    <strong>No hay resenas registradas.</strong>
                    <p>Cuando entren comentarios, apareceran aqui con spotlight y lectura editorial.</p>
                </div>
            `
        );
        return;
    }

    if (!spotlight.item) {
        setHtml(
            '#reviewsSpotlight',
            `
                <div class="reviews-empty-state" data-admin-empty-state="reviews-spotlight">
                    <strong>Sin spotlight disponible</strong>
                    <p>${escapeHtml(spotlight.summary)}</p>
                </div>
            `
        );
    } else {
        const spotlightItem = spotlight.item;
        setHtml(
            '#reviewsSpotlight',
            `
                <article class="reviews-spotlight-card">
                    <div class="reviews-spotlight-top">
                        <span class="review-avatar">${escapeHtml(
                            getInitials(spotlightItem.name || 'Anonimo')
                        )}</span>
                        <div>
                            <small>${escapeHtml(spotlight.eyebrow)}</small>
                            <strong>${escapeHtml(spotlightItem.name || 'Anonimo')}</strong>
                            <small>${escapeHtml(
                                formatDateTime(
                                    spotlightItem.date ||
                                        spotlightItem.createdAt ||
                                        ''
                                )
                            )}</small>
                        </div>
                    </div>
                    <p class="reviews-spotlight-stars">${escapeHtml(
                        getStarLabel(spotlightItem.rating)
                    )}</p>
                    <p>${escapeHtml(
                        clipCopy(
                            spotlightItem.comment || spotlightItem.review || '',
                            320
                        )
                    )}</p>
                    <small>${escapeHtml(spotlight.summary)}</small>
                </article>
            `
        );
    }

    const cards = sortedReviews
        .map((item) =>
            reviewCard(item, {
                featured:
                    spotlight.item &&
                    normalize(item.name) === normalize(spotlight.item.name) &&
                    reviewTimestamp(item) === reviewTimestamp(spotlight.item),
            })
        )
        .join('');

    setHtml('#reviewsGrid', cards);
}
