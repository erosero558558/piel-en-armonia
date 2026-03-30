(function (window, document) {
    'use strict';

    const portalShell = window.AuroraPatientPortalShell || null;

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

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
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

    async function requestDocument(url, token) {
        const response = await window.fetch(url, {
            headers: {
                Accept: 'application/pdf',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });

        const blob = response.ok ? await response.blob() : null;
        return {
            ok: response.ok,
            status: response.status,
            blob,
            headers: response.headers,
        };
    }

    function parseFilename(headers, fallbackName) {
        const disposition = String(headers.get('content-disposition') || '');
        const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (utf8Match && utf8Match[1]) {
            return decodeURIComponent(utf8Match[1]);
        }

        const asciiMatch = disposition.match(/filename="?([^";]+)"?/i);
        if (asciiMatch && asciiMatch[1]) {
            return asciiMatch[1];
        }

        return fallbackName || 'documento-aurora-derm.pdf';
    }

    function triggerBlobDownload(blob, fileName) {
        const objectUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1200);
    }

    function renderSkeleton() {
        return `
            <div class="portal-timeline" data-portal-history-skeleton>
                ${renderSkeletonItem()}
                ${renderSkeletonItem()}
            </div>
        `;
    }

    function renderSkeletonItem() {
        return `
            <article class="portal-timeline-item" style="opacity:0.82;">
                <span class="portal-timeline-dot" aria-hidden="true"></span>
                <div class="portal-timeline-content">
                    <div class="skeleton" style="width: 42%; height: 18px; margin-bottom: 12px;"></div>
                    <div class="skeleton" style="width: 64%; height: 14px; margin-bottom: 10px;"></div>
                    <div class="skeleton" style="width: 48%; height: 14px;"></div>
                    <div class="portal-timeline-document-grid">
                        <div class="portal-timeline-document">
                            <div class="skeleton" style="width: 46%; height: 14px;"></div>
                            <div class="skeleton" style="width: 100%; height: 36px;"></div>
                        </div>
                        <div class="portal-timeline-document">
                            <div class="skeleton" style="width: 52%; height: 14px;"></div>
                            <div class="skeleton" style="width: 100%; height: 36px;"></div>
                        </div>
                    </div>
                </div>
            </article>
        `;
    }

    function renderEmptyState() {
        return `
            <section class="portal-support-card portal-history-empty" data-portal-history-empty>
                <div>
                    <h2>Todavía no hay documentos por mostrar</h2>
                    <p>Cuando tu receta o certificado esté listo aparecerá aquí con su descarga directa.</p>
                </div>
            </section>
        `;
    }

    function renderErrorState() {
        return `
            <section class="portal-support-card portal-history-empty">
                <div>
                    <h2>No pudimos cargar tu historial</h2>
                    <p>Recarga en unos segundos. Si ya salió tu receta, también podemos enviártela por WhatsApp desde recepción.</p>
                </div>
            </section>
        `;
    }

    function statusChipClass(status) {
        if (status === 'pending') {
            return 'portal-status-chip portal-status-chip--pending';
        }

        if (status === 'available') {
            return 'portal-status-chip';
        }

        return 'portal-status-chip portal-status-chip--idle';
    }

    function renderDocumentCard(documentItem) {
        const safeItem =
            documentItem && typeof documentItem === 'object' ? documentItem : {};
        const status = String(safeItem.status || 'not_issued').trim() || 'not_issued';
        const title = String(safeItem.title || 'Documento').trim() || 'Documento';
        const description =
            String(safeItem.description || '').trim() || 'Estado del documento no disponible.';
        const issuedAtLabel = String(safeItem.issuedAtLabel || '').trim();
        const downloadUrl = String(safeItem.downloadUrl || '').trim();
        const fileName = String(safeItem.fileName || '').trim();

        return `
            <article class="portal-timeline-document" data-status="${escapeHtml(status)}">
                <div class="portal-timeline-document__header">
                    <div class="portal-timeline-document__copy">
                        <strong>${escapeHtml(title)}</strong>
                        <small>${escapeHtml(description)}</small>
                    </div>
                    <span class="${statusChipClass(status)}">${escapeHtml(safeItem.statusLabel || 'No emitido')}</span>
                </div>
                ${issuedAtLabel ? `<span class="portal-timeline-document__meta">${escapeHtml(issuedAtLabel)}</span>` : ''}
                ${
                    status === 'available' && downloadUrl
                        ? `<a class="portal-timeline-document__action" data-portal-document-link data-document-type="${escapeHtml(safeItem.type || '')}" href="${escapeHtml(downloadUrl)}" download="${escapeHtml(fileName || 'documento-aurora-derm.pdf')}">Descargar PDF</a>`
                        : ''
                }
            </article>
        `;
    }

    function renderConsultationItem(item) {
        const safeItem = item && typeof item === 'object' ? item : {};
        const documents =
            safeItem.documents && typeof safeItem.documents === 'object'
                ? safeItem.documents
                : {};
        const doctorName = String(safeItem.doctorName || 'Equipo clínico Aurora Derm').trim() || 'Equipo clínico Aurora Derm';
        const serviceName = String(safeItem.serviceName || 'Atención Aurora Derm').trim() || 'Atención Aurora Derm';
        const appointmentTypeLabel = String(safeItem.appointmentTypeLabel || '').trim();
        const locationLabel = String(safeItem.locationLabel || '').trim();
        const timeLabel = String(safeItem.timeLabel || '').trim();

        return `
            <article class="portal-timeline-item" data-portal-consultation-item>
                <span class="portal-timeline-dot" aria-hidden="true"></span>
                <div class="portal-timeline-content">
                    <span class="portal-timeline-date">${escapeHtml(safeItem.dateLabel || 'Fecha por confirmar')}</span>
                    <div class="portal-timeline-meta">
                        <span class="${statusChipClass(safeItem.status || 'completed')}">${escapeHtml(safeItem.statusLabel || 'Consulta registrada')}</span>
                        ${timeLabel ? `<span class="portal-inline-label portal-inline-label--muted">${escapeHtml(timeLabel)}</span>` : ''}
                    </div>
                    <p class="portal-timeline-reason">${escapeHtml(serviceName)}</p>
                    <div class="portal-timeline-doctor">
                        <span>${escapeHtml(doctorName)}</span>
                        ${appointmentTypeLabel ? `<span>· ${escapeHtml(appointmentTypeLabel)}</span>` : ''}
                        ${locationLabel ? `<span>· ${escapeHtml(locationLabel)}</span>` : ''}
                    </div>
                    <div class="portal-timeline-document-grid">
                        ${renderDocumentCard(documents.prescription)}
                        ${renderDocumentCard(documents.certificate)}
                    </div>
                </div>
            </article>
        `;
    }

    async function handleDocumentClick(event) {
        const trigger = event.target instanceof Element
            ? event.target.closest('[data-portal-document-link]')
            : null;
        if (!(trigger instanceof HTMLAnchorElement)) {
            return;
        }

        event.preventDefault();

        const session = readSession();
        if (!isFreshSession(session)) {
            clearSession();
            redirectToLogin();
            return;
        }

        const token = String(session.token || '').trim();
        const href = String(trigger.getAttribute('href') || '').trim();
        const originalLabel = trigger.textContent || 'Descargar PDF';
        if (!token || !href) {
            return;
        }

        trigger.setAttribute('aria-busy', 'true');
        trigger.textContent = 'Descargando...';

        try {
            const response = await requestDocument(href, token);
            if (response.status === 401) {
                clearSession();
                redirectToLogin();
                return;
            }

            if (!response.ok || !response.blob) {
                throw new Error('portal_document_download_failed');
            }

            const fallbackName = String(trigger.getAttribute('download') || 'documento-aurora-derm.pdf').trim();
            const fileName = parseFilename(response.headers, fallbackName);
            triggerBlobDownload(response.blob, fileName);
        } catch (_error) {
            window.alert('No pudimos descargar el PDF en este momento. Intenta nuevamente en unos segundos.');
        } finally {
            trigger.removeAttribute('aria-busy');
            trigger.textContent = originalLabel;
        }
    }

    async function hydrateHistory() {
        const container = document.getElementById('portal-history-feed');
        if (!(container instanceof HTMLElement)) {
            return;
        }

        const session = readSession();
        if (!isFreshSession(session)) {
            clearSession();
            redirectToLogin();
            return;
        }

        const token = String(session.token || '').trim();
        container.innerHTML = renderSkeleton();

        try {
            const response = await requestJson('patient-portal-history', token);
            if (response.status === 401) {
                clearSession();
                redirectToLogin();
                return;
            }

            if (!response.ok || !response.body || response.body.ok !== true) {
                throw new Error('portal_history_failed');
            }

            const data =
                response.body.data && typeof response.body.data === 'object'
                    ? response.body.data
                    : {};
            const patient =
                data.patient && typeof data.patient === 'object' ? data.patient : {};
            const consultations = Array.isArray(data.consultations) ? data.consultations : [];

            updatePatient(patient);

            if (consultations.length === 0) {
                container.innerHTML = renderEmptyState();
                return;
            }

            container.innerHTML = `
                <div class="portal-timeline" data-portal-history-feed>
                    ${consultations.map(renderConsultationItem).join('')}
                </div>
            `;
        } catch (_error) {
            container.innerHTML = renderErrorState();
        }
    }

    document.addEventListener('click', (event) => {
        void handleDocumentClick(event);
    });

    document.addEventListener('DOMContentLoaded', () => {
        void hydrateHistory();
    });
})(window, document);
