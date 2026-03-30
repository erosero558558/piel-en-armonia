#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'content', 'services.json');
const OUT_SERVICIOS = path.join(ROOT, 'servicios');
const OUT_NINOS = path.join(ROOT, 'ninos');
const SERVICE_ANALYTICS_VERSION = 'service-analytics-20260226-v1';

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * @param {string} category
 * @returns {string}
 */
function getCategoryLabel(category) {
    const normalized = String(category || '')
        .trim()
        .toLowerCase();
    if (normalized === 'clinical') return 'Dermatología clínica';
    if (normalized === 'aesthetic') return 'Estética médica';
    if (normalized === 'children') return 'Pediatría dermatológica';
    return 'Dermatología especializada';
}

/**
 * @param {string} hrefPath
 * @returns {string}
 */
function getCanonical(hrefPath) {
    return `https://pielarmonia.com${hrefPath}`;
}

/**
 * @param {string} title
 * @param {string} description
 * @param {string} canonical
 * @param {string} content
 * @returns {string}
 */
function buildPage(title, description, canonical, content) {
    return `<!DOCTYPE html>
<html lang="es">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <title>${escapeHtml(title)} | Piel en Armonía</title>
        <meta name="description" content="${escapeHtml(description)}" />
        <link rel="canonical" href="${escapeHtml(canonical)}" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="${escapeHtml(title)} | Piel en Armonía" />
        <meta property="og:description" content="${escapeHtml(description)}" />
        <meta property="og:url" content="${escapeHtml(canonical)}" />
        <meta property="og:site_name" content="Piel en Armonía" />
        <meta property="og:image" content="https://pielarmonia.com/images/optimized/showcase-hero.jpg" />
        <link rel="stylesheet" href="/styles.css?v=inline-20260224-extracted1" />
        <link rel="stylesheet" href="/styles-deferred.css?v=ui-20260227-deferredfix1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <script src="/js/service-navigation-analytics.js?v=${escapeHtml(SERVICE_ANALYTICS_VERSION)}" defer></script>
        <script>
          (function() {
            var variant = localStorage.getItem('cro_variant_s12_16');
            if (!variant) {
              variant = Math.random() < 0.5 ? 'control' : 'challenger';
              localStorage.setItem('cro_variant_s12_16', variant);
            }
            window.__CRO_VARIANT = variant;
            document.documentElement.setAttribute('data-cro-variant', variant);
          })();
        </script>
        <style>
          [data-cro-variant="control"] .cro-variant-challenger { display: none !important; }
          [data-cro-variant="challenger"] .cro-variant-control { display: none !important; }
          html:not([data-cro-variant]) .cro-variant-challenger { display: none !important; }
        </style>
    </head>
    <body class="service-page-premium">
        <header class="service-header">
            <a href="/" class="service-back-link">&larr; Volver a Piel en Armonía</a>
            <a href="/#citas" class="service-cta-link">Reservar cita</a>
        </header>
        <main class="service-main">
            ${content}
        </main>
        <footer class="service-footer">
            <p>&copy; 2026 Piel en Armonía · Dermatología especializada en Quito</p>
        </footer>
    </body>
</html>
`;
}

/**
 * @param {any} service
 * @param {string} serviceHrefPath
 * @returns {string}
 */
function buildServiceContent(service, serviceHrefPath) {
    const indications = Array.isArray(service.indications)
        ? service.indications
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join('')
        : '';
    const contraindications = Array.isArray(service.contraindications)
        ? service.contraindications
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join('')
        : '';
    const faq = Array.isArray(service.faq)
        ? service.faq
              .map(
                  (item) =>
                      `<details><summary>${escapeHtml(item)}</summary><p>Durante la consulta se personaliza la respuesta según tu diagnóstico.</p></details>`
              )
              .join('')
        : '';

    const ivaLabel = Number(service.iva) === 0 ? 'IVA 0%' : 'IVA 15%';
    const bookingHint =
        service && service.cta && service.cta.service_hint
            ? String(service.cta.service_hint)
            : 'consulta';
    const ctaLabel =
        service && service.cta && service.cta.label_es
            ? String(service.cta.label_es)
            : 'Reservar valoración';
    const bookingHref = `/?service=${encodeURIComponent(bookingHint)}#citas`;
    const slug = String(service.slug || '').trim();
    const category = String(service.category || '')
        .trim()
        .toLowerCase();

    let socialProofHtml = '';
    if (service.social_proof) {
        const ratingStars = Array.from({length: service.social_proof.rating || 5})
            .map(() => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`)
            .join('');

        const beforeImg = service.social_proof.before_img || "https://placehold.co/400x500/29323c/FFF?text=Antes";
        const afterImg = service.social_proof.after_img || "https://placehold.co/400x500/185a9d/FFF?text=Despues";
        
        socialProofHtml = `
<section class="service-panel service-social-proof">
    <h2>Lo que dicen nuestros pacientes</h2>
    <article class="social-proof-widget">
        <div class="testimony-content">
            <div class="testimony-rating" aria-label="Calificación de ${service.social_proof.rating} estrellas">
                ${ratingStars}
            </div>
            <blockquote>
                "${escapeHtml(service.social_proof.testimonial_text)}"
            </blockquote>
            <cite>
                <span class="author">${escapeHtml(service.social_proof.author)}</span>
                <span class="badge badge-primary">${escapeHtml(service.hero || service.slug)}</span>
            </cite>
        </div>
        <details class="before-after-collapse">
            <summary>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Ver caso clínico antes y después
            </summary>
            <div class="before-after-grid">
                <figure>
                    <img src="${escapeHtml(beforeImg)}" alt="Estado de la piel antes del tratamiento" loading="lazy" />
                    <figcaption>Antes</figcaption>
                </figure>
                <figure>
                    <img src="${escapeHtml(afterImg)}" alt="Estado de la piel después del tratamiento" loading="lazy" />
                    <figcaption>Después</figcaption>
                </figure>
            </div>
        </details>
    </article>
</section>`;
    }

    return `
<section class="service-hero-card" data-service-slug="${escapeHtml(slug)}" data-service-category="${escapeHtml(category)}">
    <div class="cro-variant cro-variant-control">
        <p class="service-hero-kicker">${escapeHtml(getCategoryLabel(category))}</p>
        <h1>${escapeHtml(service.hero || service.slug)}</h1>
        <p>${escapeHtml(service.summary || '')}</p>
        <div class="service-meta-row">
            <span>Duración estimada: ${escapeHtml(service.duration || '30 min')}</span>
            <span>Desde $${escapeHtml(service.price_from)}</span>
            <span>${escapeHtml(ivaLabel)}</span>
        </div>
        <div class="service-actions">
            <a class="btn btn-primary" href="${escapeHtml(bookingHref)}" data-analytics-event="start_booking_from_service" data-service-slug="${escapeHtml(slug)}" data-service-category="${escapeHtml(category)}">${escapeHtml(ctaLabel)}</a>
            <a class="btn btn-secondary" href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">Hablar por WhatsApp</a>
        </div>
    </div>
    <div class="cro-variant cro-variant-challenger">
        <p class="service-hero-kicker">Medicina Clínica Especializada</p>
        <h1>Tratamiento Médico: ${escapeHtml(service.hero || service.slug)}</h1>
        <p>Resultados reales y duraderos basados en diagnóstico clínico avanzado. Cuidado integral, sin promesas cosméticas vacías.</p>
        <div class="service-meta-row">
            <span>Duración clínica: ${escapeHtml(service.duration || '30 min')}</span>
            <span>Desde $${escapeHtml(service.price_from)} (incluye valoración inicial en plan)</span>
            <span>${escapeHtml(ivaLabel)}</span>
        </div>
        <div class="service-actions">
            <a class="btn btn-primary" href="${escapeHtml(bookingHref)}" data-analytics-event="start_booking_from_service" data-service-slug="${escapeHtml(slug)}" data-service-category="${escapeHtml(category)}">Programar inicio de tratamiento médica</a>
            <a class="btn btn-secondary" href="https://wa.me/593982453672?text=Necesito%20ayuda%20m%C3%A9dica%20para%20${encodeURIComponent(service.hero || service.slug)}" target="_blank" rel="noopener noreferrer">Consulta Express WhatsApp</a>
        </div>
    </div>
</section>

<section class="service-grid-block">
    <article class="service-panel">
        <h2>Indicaciones frecuentes</h2>
        <ul>${indications}</ul>
    </article>
    <article class="service-panel">
        <h2>Consideraciones médicas</h2>
        <ul>${contraindications || '<li>Se confirma el plan durante valoración clínica.</li>'}</ul>
    </article>
</section>

<section class="service-panel service-faq">
    <h2>Preguntas frecuentes</h2>
    ${faq}
</section>
${socialProofHtml}
<section class="service-panel">
    <div class="cro-variant cro-variant-control">
        <h2>Siguiente paso recomendado</h2>
        <p>
            Reserva una valoración médica para confirmar diagnóstico, prioridad y plan personalizado.
            Si ya tienes exámenes o fotos clínicas, llévalas a consulta.
        </p>
        <div class="service-actions">
            <a class="btn btn-primary" href="${escapeHtml(bookingHref)}" data-analytics-event="start_booking_from_service" data-service-slug="${escapeHtml(slug)}" data-service-category="${escapeHtml(category)}">Reservar ahora</a>
            <a class="btn btn-secondary" href="${escapeHtml(serviceHrefPath)}">Compartir este servicio</a>
        </div>
    </div>
    <div class="cro-variant cro-variant-challenger">
        <h2>Inicie su recuperación clínica hoy</h2>
        <p>
            Miles de pacientes ya confían la salud de su piel en nuestro criterio médico riguroso. 
            Dé el primer paso y reserve para que nuestros especialistas diagnostiquen su nivel de afección hoy mismo.
        </p>
        <div class="service-actions">
            <a class="btn btn-primary" href="${escapeHtml(bookingHref)}" data-analytics-event="start_booking_from_service" data-service-slug="${escapeHtml(slug)}" data-service-category="${escapeHtml(category)}">Aceptar tratamiento e iniciar registro</a>
            <a class="btn btn-secondary" href="${escapeHtml(serviceHrefPath)}">Guardar evidencia</a>
        </div>
    </div>
</section>`;
}

/**
 * @param {string} filePath
 * @param {string} content
 * @returns {{ changed: boolean, exists: boolean }}
 */
function compareWithFile(filePath, content) {
    if (!fs.existsSync(filePath)) {
        return { changed: true, exists: false };
    }
    const current = fs.readFileSync(filePath, 'utf8');
    return { changed: current !== content, exists: true };
}

/**
 * @param {string} filePath
 * @param {string} content
 */
function writeFileEnsured(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * @param {{ checkOnly?: boolean }} options
 * @returns {{ ok: boolean, mismatches: string[], written: string[] }}
 */
function runPremiumGenerator(options = {}) {
    const checkOnly = options.checkOnly === true;
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    const services = Array.isArray(data.services) ? data.services : [];
    const mismatches = [];
    const written = [];

    fs.mkdirSync(OUT_SERVICIOS, { recursive: true });
    fs.mkdirSync(OUT_NINOS, { recursive: true });

    for (const service of services) {
        if (!service || typeof service.slug !== 'string') continue;
        const slug = service.slug.trim();
        if (!slug) continue;

        const isPediatric = slug === 'dermatologia-pediatrica';
        const hrefPath = isPediatric
            ? `/ninos/${slug}.html`
            : `/servicios/${slug}.html`;
        const canonical = getCanonical(hrefPath);
        const page = buildPage(
            service.hero || slug,
            service.summary ||
                'Servicio dermatológico especializado en Piel en Armonía.',
            canonical,
            buildServiceContent(service, hrefPath)
        );
        const htmlPath = isPediatric
            ? path.join(OUT_NINOS, `${slug}.html`)
            : path.join(OUT_SERVICIOS, `${slug}.html`);
        const routeIndexPath = isPediatric
            ? path.join(OUT_NINOS, slug, 'index.html')
            : path.join(OUT_SERVICIOS, slug, 'index.html');

        const htmlDiff = compareWithFile(htmlPath, page);
        const routeDiff = compareWithFile(routeIndexPath, page);

        if (checkOnly) {
            if (htmlDiff.changed) mismatches.push(htmlPath);
            if (routeDiff.changed) mismatches.push(routeIndexPath);
            continue;
        }

        if (htmlDiff.changed) {
            writeFileEnsured(htmlPath, page);
            written.push(htmlPath);
        }
        if (routeDiff.changed) {
            writeFileEnsured(routeIndexPath, page);
            written.push(routeIndexPath);
        }
    }

    return { ok: mismatches.length === 0, mismatches, written };
}

if (require.main === module) {
    const checkOnly = process.argv.includes('--check');
    const result = runPremiumGenerator({ checkOnly });
    if (checkOnly) {
        if (!result.ok) {
            console.error(
                [
                    'Premium service pages out of sync.',
                    ...result.mismatches.map((item) => `- ${item}`),
                    'Run: node servicios/generate-premium-pages.js',
                ].join('\n')
            );
            process.exit(1);
        }
        console.log('OK: premium service pages are in sync.');
    } else if (result.written.length === 0) {
        console.log(
            'Sin cambios: premium service pages ya estaban sincronizadas.'
        );
    } else {
        console.log(
            `Actualizado: ${result.written.length} archivo(s) premium generado(s).`
        );
    }
}

module.exports = {
    runPremiumGenerator,
};
