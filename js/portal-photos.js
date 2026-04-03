(function (window, document) {
    'use strict';

    const portalShell = window.AuroraPatientPortalShell || null;
    const blobUrls = [];

    if (!document.getElementById('portal-skeleton-css')) {
        const style = document.createElement('style');
        style.id = 'portal-skeleton-css';
        style.textContent = `
            .skeleton {
                background: linear-gradient(90deg, rgba(148, 163, 184, 0.12) 25%, rgba(248, 250, 252, 0.24) 50%, rgba(148, 163, 184, 0.12) 75%);
                background-size: 200% 100%;
                animation: aurora-portal-shimmer 1.4s infinite linear;
                border-radius: 16px;
            }
            @keyframes aurora-portal-shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
        `;
        document.head.appendChild(style);
    }

    function readSession() {
        return portalShell && typeof portalShell.getSession === 'function'
            ? portalShell.getSession()
            : null;
    }

    function isFreshSession(session) {
        return Boolean(
            portalShell &&
                typeof portalShell.isFreshSession === 'function' &&
                portalShell.isFreshSession(session)
        );
    }

    function clearSession() {
        if (portalShell && typeof portalShell.clearSession === 'function') {
            portalShell.clearSession();
        }
    }

    function redirectToLogin() {
        if (portalShell && typeof portalShell.redirectToLogin === 'function') {
            portalShell.redirectToLogin();
            return;
        }

        window.location.replace('/es/portal/login/');
    }

    function updatePatient(patient) {
        if (portalShell && typeof portalShell.updatePatient === 'function') {
            portalShell.updatePatient(patient);
        }
    }

    async function requestJson(resource, token) {
        const response = await window.fetch(`/api.php?resource=${resource}`, {
            headers: {
                Accept: 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });

        const body = await response.json().catch(() => ({}));
        return {
            ok: response.ok,
            status: response.status,
            body,
        };
    }

    async function requestBlob(url, token) {
        const response = await window.fetch(url, {
            headers: {
                Accept: 'image/*',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });

        return {
            ok: response.ok,
            status: response.status,
            blob: response.ok ? await response.blob() : null,
        };
    }

    function rememberBlobUrl(url) {
        blobUrls.push(url);
        return url;
    }

    function cleanupBlobUrls() {
        while (blobUrls.length > 0) {
            const url = blobUrls.pop();
            if (url) {
                window.URL.revokeObjectURL(url);
            }
        }
    }

    function renderSummarySkeleton() {
        return `
            <div class="portal-photo-summary-grid" data-portal-photos-summary-skeleton>
                <article class="portal-photo-summary-card" style="opacity:0.82;">
                    <div class="skeleton" style="width: 58%; height: 12px;"></div>
                    <div class="skeleton" style="width: 42%; height: 26px;"></div>
                    <div class="skeleton" style="width: 70%; height: 12px;"></div>
                </article>
                <article class="portal-photo-summary-card" style="opacity:0.82;">
                    <div class="skeleton" style="width: 50%; height: 12px;"></div>
                    <div class="skeleton" style="width: 34%; height: 26px;"></div>
                    <div class="skeleton" style="width: 66%; height: 12px;"></div>
                </article>
            </div>
        `;
    }

    function renderGroupsSkeleton() {
        return `
            <section class="portal-support-card portal-photo-empty" style="opacity:0.82;">
                <div style="display:grid; gap: 12px; width:100%;">
                    <div class="skeleton" style="width: 36%; height: 16px;"></div>
                    <div class="skeleton" style="width: 62%; height: 12px;"></div>
                    <div class="portal-photo-grid">
                        <div class="skeleton" style="height: 180px; border-radius: 22px;"></div>
                        <div class="skeleton" style="height: 180px; border-radius: 22px;"></div>
                    </div>
                </div>
            </section>
        `;
    }

    function renderSummary(gallery) {
        const safeGallery = gallery && typeof gallery === 'object' ? gallery : {};
        const totalPhotos = Number(safeGallery.totalPhotos || 0);
        const bodyZoneCount = Number(safeGallery.bodyZoneCount || 0);
        const latestCreatedAtLabel =
            String(safeGallery.latestCreatedAtLabel || '').trim() || 'Todavía sin capturas visibles';

        return `
            <div class="portal-photo-summary-grid">
                <article class="portal-photo-summary-card" data-portal-photos-total-card>
                    <span class="portal-inline-label portal-inline-label--muted">Fotos visibles</span>
                    <strong data-portal-photos-total>${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(totalPhotos)}</strong>
                    <small>Solo las capturas compartidas contigo en el portal.</small>
                </article>
                <article class="portal-photo-summary-card" data-portal-photos-zones-card>
                    <span class="portal-inline-label portal-inline-label--muted">Zonas</span>
                    <strong data-portal-photos-zones>${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(bodyZoneCount)}</strong>
                    <small>Áreas con seguimiento clínico visible.</small>
                </article>
                <article class="portal-photo-summary-card portal-photo-summary-card--wide" data-portal-photos-latest-card>
                    <span class="portal-inline-label portal-inline-label--muted">Última actualización</span>
                    <strong data-portal-photos-latest>${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(latestCreatedAtLabel)}</strong>
                    <small>La tarjeta se renueva cuando el equipo comparte nuevas fotos contigo.</small>
                </article>
            </div>
        `;
    }

    function renderPhotoCard(item) {
        const safeItem = item && typeof item === 'object' ? item : {};
        const roleLabel = String(safeItem.photoRoleLabel || '').trim();
        const createdAtLabel = String(safeItem.createdAtLabel || '').trim();
        const fileName = String(safeItem.fileName || 'Foto clínica').trim() || 'Foto clínica';
        const alt = String(safeItem.alt || fileName).trim() || fileName;
        const imageUrl = String(safeItem.imageUrl || '').trim();

        return `
            <article class="portal-photo-card" data-portal-photo-card>
                <div class="portal-photo-card__frame">
                    <div class="portal-photo-card__placeholder" data-portal-photo-placeholder>
                        Cargando imagen segura...
                    </div>
                    <img
                        class="portal-photo-card__image"
                        data-portal-photo-image
                        data-photo-url="${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(imageUrl)}"
                        alt="${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(alt)}"
                    />
                </div>
                <div class="portal-photo-card__meta">
                    <div class="portal-photo-card__chips">
                        ${
                            roleLabel
                                ? `<span class="portal-timeline-chip portal-photo-chip">${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(roleLabel)}</span>`
                                : ''
                        }
                    </div>
                    <strong data-portal-photo-file-name>${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(fileName)}</strong>
                    <small data-portal-photo-date>${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(createdAtLabel)}</small>
                </div>
            </article>
        `;
    }

    function renderGroups(gallery) {
        const safeGallery = gallery && typeof gallery === 'object' ? gallery : {};
        const groups = Array.isArray(safeGallery.groups) ? safeGallery.groups : [];

        if (groups.length === 0) {
            return `
                <section class="portal-support-card portal-photo-empty" data-portal-photos-empty>
                    <div>
                        <h2>Todavía no hay fotos visibles en tu portal</h2>
                        <p>
                            Cuando el equipo comparta imágenes de seguimiento contigo, aparecerán aquí
                            agrupadas por zona y fecha.
                        </p>
                    </div>
                </section>
            `;
        }

        return groups
            .map((group) => {
                const safeGroup = group && typeof group === 'object' ? group : {};
                const items = Array.isArray(safeGroup.items) ? safeGroup.items : [];

                return `
                    <section class="portal-photo-group" data-portal-photo-group>
                        <div class="portal-photo-group__header">
                            <div>
                                <span class="portal-inline-label">${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(safeGroup.bodyZoneLabel || 'Seguimiento general')}</span>
                                <h3>${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(safeGroup.bodyZoneLabel || 'Seguimiento general')}</h3>
                            </div>
                            <div class="portal-photo-group__meta">
                                <strong data-portal-photo-group-count>${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(safeGroup.photoCount || items.length)}</strong>
                                <small>${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(safeGroup.latestCreatedAtLabel || '')}</small>
                            </div>
                        </div>
                        <div class="portal-photo-grid">
                            ${items.map(renderPhotoCard).join('')}
                        </div>
                    </section>
                `;
            })
            .join('');
    }

    async function hydratePhotoAssets(token) {
        const images = Array.from(document.querySelectorAll('[data-portal-photo-image][data-photo-url]'));

        await Promise.all(
            images.map(async (node) => {
                if (!(node instanceof HTMLImageElement)) {
                    return;
                }

                const imageUrl = String(node.dataset.photoUrl || '').trim();
                if (!imageUrl) {
                    return;
                }

                const placeholder = node.parentElement
                    ? node.parentElement.querySelector('[data-portal-photo-placeholder]')
                    : null;

                try {
                    const response = await requestBlob(imageUrl, token);
                    if (response.status === 401) {
                        clearSession();
                        redirectToLogin();
                        return;
                    }

                    if (!response.ok || !response.blob) {
                        throw new Error('portal_photo_fetch_failed');
                    }

                    const objectUrl = rememberBlobUrl(window.URL.createObjectURL(response.blob));
                    node.src = objectUrl;
                    node.dataset.loaded = 'true';
                    if (placeholder instanceof HTMLElement) {
                        placeholder.setAttribute('hidden', 'hidden');
                    }
                } catch (_error) {
                    if (placeholder instanceof HTMLElement) {
                        placeholder.textContent = 'No pudimos cargar esta foto.';
                    }
                }
            })
        );
    }

    async function hydratePhotos() {
        const summaryContainer = document.getElementById('portal-photos-summary');
        const groupsContainer = document.getElementById('portal-photos-groups');
        if (!(summaryContainer instanceof HTMLElement) || !(groupsContainer instanceof HTMLElement)) {
            return;
        }

        const session = readSession();
        if (!isFreshSession(session)) {
            clearSession();
            redirectToLogin();
            return;
        }

        const token = String(session.token || '').trim();
        cleanupBlobUrls();
        summaryContainer.innerHTML = renderSummarySkeleton();
        groupsContainer.innerHTML = renderGroupsSkeleton();

        try {
            const response = await requestJson('patient-portal-photos', token);
            if (response.status === 401) {
                clearSession();
                redirectToLogin();
                return;
            }

            if (!response.ok || !response.body || response.body.ok !== true) {
                throw new Error('portal_photos_failed');
            }

            const data = response.body.data && typeof response.body.data === 'object' ? response.body.data : {};
            const patient = data.patient && typeof data.patient === 'object' ? data.patient : {};
            const gallery = data.gallery && typeof data.gallery === 'object' ? data.gallery : {};

            updatePatient(patient);
            summaryContainer.innerHTML = renderSummary(gallery);
            groupsContainer.innerHTML = renderGroups(gallery);
            await hydratePhotoAssets(token);
        } catch (_error) {
            summaryContainer.innerHTML = renderSummary({
                totalPhotos: 0,
                bodyZoneCount: 0,
                latestCreatedAtLabel: 'No disponible en este momento',
            });
            groupsContainer.innerHTML = `
                <section class="portal-support-card portal-photo-empty">
                    <div>
                        <h2>No pudimos cargar tu galería</h2>
                        <p>
                            Intenta recargar en unos segundos. Si necesitas una foto específica,
                            escríbenos por WhatsApp para ayudarte.
                        </p>
                    </div>
                </section>
            `;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        void hydratePhotos();
    });

    window.addEventListener('beforeunload', cleanupBlobUrls);
})(window, document);
