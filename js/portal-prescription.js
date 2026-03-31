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

        return fallbackName || 'receta-aurora-derm.pdf';
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

    function renderSummarySkeleton() {
        return `
            <div class="portal-rx-summary-grid" data-portal-rx-summary-skeleton>
                <article class="portal-rx-summary-card portal-rx-summary-card--wide" style="opacity:0.82;">
                    <div class="portal-rx-summary-card__hero">
                        <div style="display:grid; gap:10px; flex:1;">
                            <div class="skeleton" style="width: 28%; height: 12px;"></div>
                            <div class="skeleton" style="width: 60%; height: 28px;"></div>
                            <div class="skeleton" style="width: 90%; height: 13px;"></div>
                        </div>
                        <div class="skeleton" style="width: 88px; height: 32px; border-radius:999px;"></div>
                    </div>
                </article>
                <article class="portal-rx-summary-card" style="opacity:0.82;">
                    <div class="skeleton" style="width: 48%; height: 12px;"></div>
                    <div class="skeleton" style="width: 66%; height: 20px;"></div>
                    <div class="skeleton" style="width: 54%; height: 12px;"></div>
                </article>
                <article class="portal-rx-summary-card" style="opacity:0.82;">
                    <div class="skeleton" style="width: 44%; height: 12px;"></div>
                    <div class="skeleton" style="width: 58%; height: 20px;"></div>
                    <div class="skeleton" style="width: 50%; height: 12px;"></div>
                </article>
            </div>
        `;
    }

    function renderMedicationsSkeleton() {
        return `
            <div class="portal-rx-med-list" data-portal-rx-med-skeleton>
                <article class="portal-rx-med-card" style="opacity:0.82;">
                    <div class="skeleton" style="width: 48%; height: 16px;"></div>
                    <div class="skeleton" style="width: 84%; height: 12px; margin-top: 12px;"></div>
                    <div class="skeleton" style="width: 100%; height: 12px; margin-top: 8px;"></div>
                    <div class="portal-rx-med-card__chips">
                        <div class="skeleton" style="width: 88px; height: 28px; border-radius:999px;"></div>
                        <div class="skeleton" style="width: 112px; height: 28px; border-radius:999px;"></div>
                    </div>
                </article>
            </div>
        `;
    }

    function renderVerificationSkeleton() {
        return `
            <div class="portal-rx-verify-grid" data-portal-rx-verify-skeleton>
                <article class="portal-rx-verify-card portal-rx-verify-card--wide" style="opacity:0.82;">
                    <div class="portal-rx-verify-card__row">
                        <div style="display:grid; gap:10px;">
                            <div class="skeleton" style="width: 34%; height: 12px;"></div>
                            <div class="skeleton" style="width: 60%; height: 22px;"></div>
                            <div class="skeleton" style="width: 100%; height: 12px;"></div>
                            <div class="skeleton" style="width: 74%; height: 12px;"></div>
                        </div>
                        <div class="skeleton" style="width:124px; height:124px; border-radius:22px;"></div>
                    </div>
                </article>
            </div>
        `;
    }

    function renderSummary(prescription) {
        const safePrescription = prescription && typeof prescription === 'object' ? prescription : {};
        const status = String(safePrescription.status || '').trim();

        if (status !== 'available') {
            return `
                <section class="portal-support-card portal-rx-empty" data-portal-rx-empty>
                    <div>
                        <h2>${escapeHtml(safePrescription.title || 'Mi receta activa')}</h2>
                        <p>${escapeHtml(safePrescription.description || 'Aún no hay una receta emitida visible.')}</p>
                    </div>
                </section>
            `;
        }

        return `
            <div class="portal-rx-summary-grid">
                <article class="portal-rx-summary-card portal-rx-summary-card--wide" data-portal-rx-summary-card>
                    <div class="portal-rx-summary-card__hero">
                        <div style="flex:1;">
                            <span class="portal-inline-label">Receta vigente</span>
                            <strong data-portal-rx-title>${escapeHtml(safePrescription.medicationCountLabel || safePrescription.title || 'Mi receta activa')}</strong>
                            <small data-portal-rx-description>${escapeHtml(safePrescription.description || '')}</small>
                        </div>
                        <span class="portal-status-chip" data-portal-rx-status>${escapeHtml(safePrescription.statusLabel || 'Activa')}</span>
                    </div>
                    ${
                        safePrescription.hasPendingUpdate
                            ? `<div class="portal-rx-banner" data-portal-rx-pending-banner>${escapeHtml(safePrescription.pendingUpdateLabel || '')}</div>`
                            : ''
                    }
                </article>
                <article class="portal-rx-summary-card">
                    <span class="portal-inline-label portal-inline-label--muted">Emitida por</span>
                    <strong data-portal-rx-doctor>${escapeHtml(safePrescription.doctorName || 'Equipo clínico Aurora Derm')}</strong>
                    <small data-portal-rx-doctor-meta>${escapeHtml(
                        [safePrescription.doctorSpecialty, safePrescription.doctorMsp ? `MSP ${safePrescription.doctorMsp}` : '']
                            .filter(Boolean)
                            .join(' · ')
                    )}</small>
                </article>
                <article class="portal-rx-summary-card">
                    <span class="portal-inline-label portal-inline-label--muted">Última emisión</span>
                    <strong data-portal-rx-issued>${escapeHtml(safePrescription.issuedAtLabel || 'Fecha por confirmar')}</strong>
                    <small data-portal-rx-service>${escapeHtml(
                        [safePrescription.serviceName, safePrescription.consultationDateLabel].filter(Boolean).join(' · ')
                    )}</small>
                </article>
            </div>
        `;
    }

    function renderMedicationCard(item) {
        const safeItem = item && typeof item === 'object' ? item : {};
        const chips = Array.isArray(safeItem.chips) ? safeItem.chips : [];

        return `
            <article class="portal-rx-med-card" data-portal-rx-med-card>
                <span class="portal-inline-label portal-inline-label--muted">Medicamento</span>
                <h3 data-portal-rx-med-name>${escapeHtml(safeItem.medication || 'Indicaciones médicas')}</h3>
                ${
                    safeItem.instructions
                        ? `<p data-portal-rx-med-instructions>${escapeHtml(safeItem.instructions)}</p>`
                        : ''
                }
                ${
                    chips.length > 0
                        ? `<div class="portal-rx-med-card__chips">
                            ${chips
                                .map(
                                    (chip) =>
                                        `<span class="portal-rx-chip" data-portal-rx-med-chip>${escapeHtml(chip)}</span>`
                                )
                                .join('')}
                        </div>`
                        : ''
                }
            </article>
        `;
    }

    function renderMedications(prescription) {
        const safePrescription = prescription && typeof prescription === 'object' ? prescription : {};
        const medications = Array.isArray(safePrescription.medications) ? safePrescription.medications : [];

        if (String(safePrescription.status || '') !== 'available') {
            return `
                <section class="portal-support-card portal-rx-empty">
                    <div>
                        <h2>Sin indicaciones visibles todavía</h2>
                        <p>Cuando la receta quede firmada, aquí verás la lista de medicamentos y sus instrucciones.</p>
                    </div>
                </section>
            `;
        }

        if (medications.length === 0) {
            return `
                <section class="portal-support-card portal-rx-empty">
                    <div>
                        <h2>La receta está lista pero no pudimos resumir sus ítems</h2>
                        <p>Usa el PDF firmado para revisar el detalle completo o escríbenos para reenviártelo.</p>
                    </div>
                </section>
            `;
        }

        return `<div class="portal-rx-med-list">${medications.map(renderMedicationCard).join('')}</div>`;
    }

    function renderVerification(prescription) {
        const safePrescription = prescription && typeof prescription === 'object' ? prescription : {};
        if (String(safePrescription.status || '') !== 'available') {
            return `
                <section class="portal-support-card portal-rx-empty">
                    <div>
                        <h2>La verificación aparecerá cuando tu receta esté emitida</h2>
                        <p>En cuanto el PDF quede listo, verás el QR y el enlace público de autenticidad aquí.</p>
                    </div>
                </section>
            `;
        }

        return `
            <div class="portal-rx-verify-grid">
                <article class="portal-rx-verify-card portal-rx-verify-card--wide" data-portal-rx-verify-card>
                    <div class="portal-rx-verify-card__row">
                        <div>
                            <span class="portal-inline-label">Código de verificación</span>
                            <strong class="portal-rx-verify-card__code" data-portal-rx-verification-code>${escapeHtml(
                                safePrescription.verificationCode || ''
                            )}</strong>
                            <p data-portal-rx-verification-copy>
                                Escanea el QR o abre el enlace para comprobar fecha de emisión, médico y autenticidad del documento.
                            </p>
                            <small data-portal-rx-verification-issued>${escapeHtml(safePrescription.issuedAtLabel || '')}</small>
                        </div>
                        ${
                            safePrescription.verificationQrImageUrl
                                ? `<img
                                    class="portal-rx-verify-card__qr"
                                    data-portal-rx-qr
                                    src="${escapeHtml(safePrescription.verificationQrImageUrl)}"
                                    alt="QR de verificación de receta"
                                />`
                                : ''
                        }
                    </div>
                    <div class="portal-rx-verify-card__actions">
                        <button class="btn btn-primary" type="button" data-portal-prescription-download data-download-url="${escapeHtml(
                            safePrescription.downloadUrl || ''
                        )}" data-file-name="${escapeHtml(safePrescription.fileName || 'receta-aurora-derm.pdf')}">
                            Descargar PDF
                        </button>
                        ${
                            safePrescription.verificationUrl
                                ? `<a
                                    class="btn btn-secondary"
                                    data-portal-rx-verification-link
                                    href="${escapeHtml(safePrescription.verificationUrl)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Abrir verificación
                                </a>`
                                : ''
                        }
                    </div>
                </article>
            </div>
        `;
    }

    async function bindDownload(session) {
        const button = document.querySelector('[data-portal-prescription-download]');
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }

        button.addEventListener('click', async () => {
            const token = String(session?.token || '').trim();
            const downloadUrl = String(button.dataset.downloadUrl || '').trim();
            const fileName = String(button.dataset.fileName || '').trim();
            if (!token || !downloadUrl) {
                return;
            }

            button.disabled = true;
            const originalLabel = button.textContent;
            button.textContent = 'Descargando...';

            try {
                const response = await requestDocument(downloadUrl, token);
                if (response.status === 401) {
                    clearSession();
                    redirectToLogin();
                    return;
                }

                if (!response.ok || !response.blob) {
                    throw new Error('portal_prescription_download_failed');
                }

                triggerBlobDownload(response.blob, parseFilename(response.headers, fileName));
            } catch (_error) {
                button.textContent = 'Reintentar PDF';
                button.disabled = false;
                return;
            }

            button.textContent = originalLabel || 'Descargar PDF';
            button.disabled = false;
        });
    }

    async function hydratePrescription() {
        const summaryContainer = document.getElementById('portal-prescription-summary');
        const medsContainer = document.getElementById('portal-prescription-meds');
        const verifyContainer = document.getElementById('portal-prescription-verify');
        if (
            !(summaryContainer instanceof HTMLElement) ||
            !(medsContainer instanceof HTMLElement) ||
            !(verifyContainer instanceof HTMLElement)
        ) {
            return;
        }

        const session = readSession();
        if (!isFreshSession(session)) {
            clearSession();
            redirectToLogin();
            return;
        }

        const token = String(session.token || '').trim();
        summaryContainer.innerHTML = renderSummarySkeleton();
        medsContainer.innerHTML = renderMedicationsSkeleton();
        verifyContainer.innerHTML = renderVerificationSkeleton();

        try {
            const response = await requestJson('patient-portal-prescription', token);
            if (response.status === 401) {
                clearSession();
                redirectToLogin();
                return;
            }

            if (!response.ok || !response.body || response.body.ok !== true) {
                throw new Error('portal_prescription_failed');
            }

            const data = response.body.data && typeof response.body.data === 'object' ? response.body.data : {};
            const patient = data.patient && typeof data.patient === 'object' ? data.patient : {};
            const prescription =
                data.prescription && typeof data.prescription === 'object' ? data.prescription : {};

            updatePatient(patient);
            summaryContainer.innerHTML = renderSummary(prescription);
            medsContainer.innerHTML = renderMedications(prescription);
            verifyContainer.innerHTML = renderVerification(prescription);
            await bindDownload(session);
        } catch (_error) {
            summaryContainer.innerHTML = `
                <section class="portal-support-card portal-rx-empty">
                    <div>
                        <h2>No pudimos cargar tu receta activa</h2>
                        <p>Recarga en unos segundos. Si necesitas el PDF ahora mismo, pídelo por WhatsApp a recepción.</p>
                    </div>
                </section>
            `;
            medsContainer.innerHTML = '';
            verifyContainer.innerHTML = '';
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        void hydratePrescription();
    });
})(window, document);
