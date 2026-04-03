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
            <article class="portal-timeline-item lg-surface-timeline glass-stepper" style="opacity:0.82;">
                <span class="portal-timeline-dot" aria-hidden="true"></span>
                <div class="portal-timeline-content">
                    <div class="skeleton" style="width: 42%; height: 18px; margin-bottom: 12px;"></div>
                    <div class="skeleton" style="width: 64%; height: 14px; margin-bottom: 10px;"></div>
                    <div class="skeleton" style="width: 48%; height: 14px;"></div>
                </div>
            </article>
        `;
    }

    function renderEmptyState() {
        return `
            <section class="portal-support-card portal-history-empty" data-portal-history-empty>
                <div>
                    <h2>Todavía no hay atenciones por mostrar</h2>
                    <p>Cuando completes una consulta verás aquí tu timeline con documentos, fotos y próximos pasos.</p>
                </div>
            </section>
        `;
    }

    function renderHistoryExportAction(exportItem) {
        const safeItem =
            exportItem && typeof exportItem === 'object' ? exportItem : {};
        const downloadUrl = String(safeItem.downloadUrl || '').trim();
        if (!downloadUrl) {
            return '';
        }

        const label =
            String(safeItem.ctaLabel || '').trim() || 'Exportar mi historia completa';
        const fileName =
            String(safeItem.fileName || '').trim() || 'historia-clinica-portal.pdf';

        return `
            <a
                class="portal-history-export-link"
                data-portal-history-export-link
                href="${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(downloadUrl)}"
                download="${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(fileName)}"
            >${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(label)}</a>
        `;
    }

    function hydrateHistoryExport(exportItem) {
        const container = document.querySelector('[data-portal-history-actions]');
        if (!(container instanceof HTMLElement)) {
            return;
        }

        const markup = renderHistoryExportAction(exportItem);
        if (!markup) {
            container.hidden = true;
            container.innerHTML = '';
            return;
        }

        container.hidden = false;
        container.innerHTML = markup;
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

    function renderEventIcon(iconName) {
        const name = String(iconName || 'visit').trim() || 'visit';

        if (name === 'calendar') {
            return `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="4" width="18" height="17" rx="3"></rect>
                    <line x1="8" y1="2.5" x2="8" y2="6"></line>
                    <line x1="16" y1="2.5" x2="16" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
            `;
        }

        if (name === 'document') {
            return `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M7 3h7l5 5v13H7z"></path>
                    <path d="M14 3v5h5"></path>
                    <path d="M10 13h6"></path>
                    <path d="M10 17h4"></path>
                </svg>
            `;
        }

        if (name === 'prescription') {
            return `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M9.5 8.5a3.5 3.5 0 0 1 5 0l1 1a3.5 3.5 0 0 1 0 5l-2 2a3.5 3.5 0 0 1-5 0l-1-1a3.5 3.5 0 0 1 0-5z"></path>
                    <path d="m9 15 6-6"></path>
                </svg>
            `;
        }

        if (name === 'photo') {
            return `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="5" width="18" height="14" rx="3"></rect>
                    <circle cx="8.5" cy="10" r="1.5"></circle>
                    <path d="m21 15-4.5-4.5L8 19"></path>
                </svg>
            `;
        }

        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M12 8v8"></path>
                <path d="M8 12h8"></path>
            </svg>
        `;
    }

    function renderHistoryEvent(eventItem) {
        const safeItem = eventItem && typeof eventItem === 'object' ? eventItem : {};
        const label = String(safeItem.label || '').trim();
        if (!label) {
            return '';
        }

        const meta = String(safeItem.meta || '').trim();
        const tone = String(safeItem.tone || 'idle').trim() || 'idle';
        const type = String(safeItem.type || safeItem.icon || 'event').trim() || 'event';
        const icon = String(safeItem.icon || type).trim() || type;

        return `
            <article class="portal-history-event" data-portal-history-event data-event-type="${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(type)}" data-event-tone="${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(tone)}">
                <span class="portal-history-event__icon" aria-hidden="true">
                    ${renderEventIcon(icon)}
                </span>
                <div class="portal-history-event__body">
                    <strong class="portal-history-event__title" data-portal-history-event-label>${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(label)}</strong>
                    ${meta ? `<small class="portal-history-event__meta">${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(meta)}</small>` : ''}
                </div>
            </article>
        `;
    }

    function renderHistoryEvents(events) {
        const safeEvents = Array.isArray(events) ? events.map(renderHistoryEvent).filter(Boolean) : [];
        if (safeEvents.length === 0) {
            return '';
        }

        return `
            <div class="portal-history-events" data-portal-history-events>
                ${safeEvents.join('')}
            </div>
        `;
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
            <article class="portal-timeline-document lg-surface--dark portal-glass-card" data-status="${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(status)}">
                <div class="portal-timeline-document__header">
                    <div class="portal-timeline-document__copy">
                        <strong>${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(title)}</strong>
                        <small>${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(description)}</small>
                    </div>
                    <span class="${statusChipClass(status)}">${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(safeItem.statusLabel || 'No emitido')}</span>
                </div>
                ${issuedAtLabel ? `<span class="portal-timeline-document__meta">${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(issuedAtLabel)}</span>` : ''}
                ${
                    status === 'available' && downloadUrl
                        ? `<a class="portal-timeline-document__action btn btn-secondary glass-pill" data-portal-document-link data-document-type="${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(safeItem.type || '')}" href="${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(downloadUrl)}" download="${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(fileName || 'documento-aurora-derm.pdf')}">Descargar PDF</a>`
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
        
        // Diagnóstico real del servidor únicamente — sin fallback dummy (Q43-02)
        const diagnosisLabel = String(safeItem.diagnosis || '').trim();
        const diagnosisBadgeHtml = diagnosisLabel
            ? `<span class="lg-diagnosis-badge">${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(diagnosisLabel)}</span>`
            : '';
        
        // Píldoras médicas estandarizadas (Dummy safe data for visual integrity)
        // Medicamentos reales del servidor únicamente — sin fallback dummy (Q43-02)
        const meds = Array.isArray(safeItem.medications) ? safeItem.medications : [];
        const medMarkup = meds.length > 0
            ? meds.map(m => `
            <span class="lg-medication-pill">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14"><rect x="4" y="8" width="16" height="8" rx="4"></rect><line x1="12" y1="8" x2="12" y2="16"></line></svg>
                ${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(m.name)} <small style="opacity:0.6; margin-left:4px;">${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(m.dosage)}</small>
            </span>
        `).join('')
            : '<span style="font-size:0.85rem; color:rgba(255,255,255,0.35);">Sin medicamentos activos registrados</span>';

        // Fotos clínicas reales del servidor únicamente — sin placeholder dummy (Q43-02)
        const photos = Array.isArray(safeItem.photos) && safeItem.photos.length > 0
            ? safeItem.photos.filter(p => typeof p === 'string' && p.startsWith('/') && !p.includes('placeholder'))
            : [];
        const photoMarkup = photos.length > 0 ? `
            <div class="lg-history-photo-gallery">
                ${photos.map(p => `<img src="${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(p)}" class="lg-history-photo" loading="lazy" alt="Foto clínica de consulta">`).join('')}
            </div>
        ` : '';

        return `
            <article class="portal-timeline-item lg-surface-timeline glass-stepper portal-history-card timeline-consulta" data-portal-consultation-item>
                <span class="portal-timeline-dot" aria-hidden="true"></span>
                
                <svg class="portal-timeline-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>

                <div class="portal-timeline-content">
                    <span class="portal-timeline-date">${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(safeItem.dateLabel || 'Fecha por confirmar')}</span>
                    <div class="portal-timeline-meta">
                        <span class="${statusChipClass(safeItem.status || 'completed')}">${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(safeItem.statusLabel || 'Consulta registrada')}</span>
                        ${timeLabel ? `<span class="portal-inline-label portal-inline-label--muted">${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(timeLabel)}</span>` : ''}
                    </div>
                    
                    ${diagnosisBadgeHtml}
                    <p class="portal-timeline-reason" style="margin-top: 4px; margin-bottom: 4px;">${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(serviceName)}</p>
                    
                    <div class="portal-timeline-doctor" style="color: var(--reborn-color-muted); font-size: 0.85em;">
                        <span>${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(doctorName)}</span>
                        ${locationLabel ? `<span>· ${(window.AuroraUtils ? window.AuroraUtils.escapeHtml : (x=>x))(locationLabel)}</span>` : ''}
                    </div>
                    
                    <div class="portal-timeline-content-body-wrap episode-collapsible">
                        <div class="portal-timeline-content-body">
                            
                            <div style="margin-bottom: 16px;">
                                <strong style="display:block; font-size:0.85rem; color:rgba(255,255,255,0.5); text-transform:uppercase; margin-bottom:8px;">Plan Farmacológico</strong>
                                <div style="display:flex; flex-wrap:wrap; gap:8px;">
                                    ${medMarkup}
                                </div>
                            </div>
                            
                            <div style="margin-bottom: 16px;">
                                <strong style="display:block; font-size:0.85rem; color:rgba(255,255,255,0.5); text-transform:uppercase; margin-bottom:4px;">Fotos Clínicas</strong>
                                ${photoMarkup}
                            </div>
                        
                            ${renderHistoryEvents(safeItem.events)}
                            <div class="portal-timeline-document-grid" style="margin-top: 16px;">
                                <strong style="display:block; font-size:0.85rem; color:rgba(255,255,255,0.5); text-transform:uppercase; margin-bottom:8px;">Documentos</strong>
                                ${renderDocumentCard(documents.prescription)}
                                ${renderDocumentCard(documents.certificate)}
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        `;
    }

    function handleDocumentClick(event) {
        const trigger = event.target instanceof Element
            ? event.target.closest('[data-portal-document-link], [data-portal-history-export-link]')
            : null;
        if (!(trigger instanceof HTMLAnchorElement)) {
            return;
        }

        const session = readSession();
        if (!isFreshSession(session)) {
            event.preventDefault();
            clearSession();
            redirectToLogin();
            return;
        }

        // Si tenemos un token de descarga de 1 un solo uso, lo inyectamos y dejamos que el navegador descargue nativamente.
        const otpToken = window.auroraPortalDownloadToken || '';
        if (otpToken) {
            let href = String(trigger.getAttribute('href') || '').trim();
            // Evitar duplicaciones de querystring &t=
            if (href.indexOf('&t=') > -1) {
                href = href.split('&t=')[0];
            }
            if (href.indexOf('?resource=') > -1) {
                trigger.setAttribute('href', href + '&t=' + encodeURIComponent(otpToken));
                trigger.setAttribute('target', '_blank');
            }
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
            const exportInfo =
                data.export && typeof data.export === 'object' ? data.export : null;

            window.auroraPortalDownloadToken = data.downloadToken || '';

            updatePatient(patient);
            hydrateHistoryExport(exportInfo);

            if (consultations.length === 0) {
                container.innerHTML = renderEmptyState();
                return;
            }

            container.innerHTML = `
                <div class="portal-timeline">
                    ${consultations.map(renderConsultationItem).join('')}
                </div>
            `;
        } catch (_error) {
            hydrateHistoryExport(null);
            container.innerHTML = renderErrorState();
        }
    }

    async function handleHistoryDownloadClick(event) {
        const trigger = event.target instanceof Element
            ? event.target.closest('#download-history-btn')
            : null;
        if (!(trigger instanceof HTMLButtonElement)) {
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
        if (!token) {
            return;
        }

        const originalHtml = trigger.innerHTML;
        trigger.setAttribute('aria-busy', 'true');
        trigger.disabled = true;
        trigger.innerHTML = 'Generando PDF...';

        try {
            const response = await requestDocument('/api.php?resource=patient-portal-history-pdf', token);
            if (response.status === 401) {
                clearSession();
                redirectToLogin();
                return;
            }

            if (!response.ok || !response.blob) {
                throw new Error('portal_history_pdf_download_failed');
            }

            const fileName = parseFilename(response.headers, 'historia-clinica-paciente.pdf');
            triggerBlobDownload(response.blob, fileName);
        } catch (_error) {
            // Q43-01: error inline — sin prompt de alerta nativo en producción
            const btn = document.querySelector('#download-history-btn');
            const errDiv = document.createElement('div');
            errDiv.setAttribute('role', 'alert');
            errDiv.style.cssText = 'margin-top:12px;padding:12px 14px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:10px;color:#fca5a5;font-size:0.88rem;text-align:center;';
            errDiv.textContent = 'No pudimos generar la historia clínica en este momento. Inténtalo más tarde.';
            if (btn && btn.parentNode) {
                btn.parentNode.insertBefore(errDiv, btn.nextSibling);
                window.setTimeout(() => errDiv.remove(), 6000);
            }

        } finally {
            trigger.removeAttribute('aria-busy');
            trigger.disabled = false;
            trigger.innerHTML = originalHtml;
        }
    }

    function handleTimelineExpand(event) {
        const item = event.target instanceof Element ? event.target.closest('.lg-surface-timeline') : null;
        if (!item || event.target.closest('a, button')) {
            return;
        }
        item.classList.toggle('is-expanded');
    }

    document.addEventListener('click', (event) => {
        void handleDocumentClick(event);
        void handleHistoryDownloadClick(event);
        handleTimelineExpand(event);
    });

    document.addEventListener('DOMContentLoaded', () => {
        void hydrateHistory();
    });
})(window, document);
