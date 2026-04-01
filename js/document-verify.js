(function (window, document) {
    'use strict';

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function readToken() {
        const params = new window.URLSearchParams(window.location.search);
        return String(params.get('token') || '').trim();
    }

    async function requestVerification(token) {
        const response = await window.fetch(
            `/api.php?resource=document-verify&token=${encodeURIComponent(token)}`,
            {
                headers: {
                    Accept: 'application/json',
                },
            }
        );

        const body = await response.json().catch(() => ({}));
        return {
            ok: response.ok,
            status: response.status,
            body,
        };
    }

    function renderSkeleton() {
        return `
            <section class="document-verify-card">
                <span class="document-verify-eyebrow">Verificando</span>
                <h1>Comprobando documento</h1>
                <p>Espera un momento mientras validamos el código.</p>
            </section>
        `;
    }

    function renderInvalid(copy) {
        return `
            <section class="document-verify-card document-verify-state--invalid" data-document-verify-state="invalid">
                <span class="document-verify-eyebrow">No válido</span>
                <h1>No pudimos verificar este documento</h1>
                <p>${escapeHtml(copy || 'El código fue alterado, expiró o no corresponde a un documento emitido por Aurora Derm.')}</p>
            </section>
        `;
    }

    function renderValid(documentData) {
        const safeDocument = documentData && typeof documentData === 'object' ? documentData : {};
        return `
            <section class="document-verify-card document-verify-state--valid" data-document-verify-state="valid">
                <span class="document-verify-eyebrow">Documento válido</span>
                <h1>${escapeHtml(safeDocument.typeLabel || 'Documento clínico')}</h1>
                <p>${escapeHtml(safeDocument.message || 'La información coincide con el registro actual de Aurora Derm.')}</p>
                <span class="document-verify-code" data-document-verify-code>${escapeHtml(safeDocument.verificationCode || '')}</span>
                <div class="document-verify-grid">
                    <article class="document-verify-metric">
                        <small>Paciente</small>
                        <strong data-document-verify-patient>${escapeHtml(safeDocument.patientName || 'Paciente Aurora Derm')}</strong>
                    </article>
                    <article class="document-verify-metric">
                        <small>Emisión</small>
                        <strong data-document-verify-issued>${escapeHtml(safeDocument.issuedAtLabel || 'Fecha por confirmar')}</strong>
                    </article>
                    <article class="document-verify-metric">
                        <small>Médico</small>
                        <strong data-document-verify-doctor>${escapeHtml(safeDocument.doctorName || 'Equipo clínico Aurora Derm')}</strong>
                        <small>${escapeHtml(
                            [safeDocument.doctorSpecialty, safeDocument.doctorMsp ? `MSP ${safeDocument.doctorMsp}` : '']
                                .filter(Boolean)
                                .join(' · ')
                        )}</small>
                    </article>
                    <article class="document-verify-metric">
                        <small>Clínica</small>
                        <strong data-document-verify-clinic>${escapeHtml(safeDocument.clinicName || 'Aurora Derm')}</strong>
                        ${
                            safeDocument.medicationSummary
                                ? `<small data-document-verify-extra>${escapeHtml(
                                    `Primer medicamento: ${safeDocument.medicationSummary}`
                                )}</small>`
                                : safeDocument.certificateTypeLabel
                                    ? `<small data-document-verify-extra>${escapeHtml(
                                        safeDocument.certificateTypeLabel
                                    )}</small>`
                                    : ''
                        }
                    </article>
                </div>
                <div class="disclaimer disclaimer--certificate">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                    <div class="disclaimer-content">
                        <strong>Validez del documento</strong>
                        <p style="margin:0">La verificaci&oacute;n electr&oacute;nica garantiza que este documento fue emitido y respaldado por Aurora Derm.</p>
                    </div>
                </div>
            </section>
        `;
    }

    async function hydrateVerification() {
        const root = document.getElementById('document-verify-root');
        if (!(root instanceof HTMLElement)) {
            return;
        }

        const token = readToken();
        if (!token) {
            root.innerHTML = renderInvalid('Falta el token de verificación en el enlace.');
            return;
        }

        root.innerHTML = renderSkeleton();

        try {
            const response = await requestVerification(token);
            if (!response.ok || !response.body) {
                throw new Error('document_verify_failed');
            }

            const data = response.body.data && typeof response.body.data === 'object' ? response.body.data : {};
            if (data.valid !== true) {
                root.innerHTML = renderInvalid(data.message || data.statusLabel || '');
                return;
            }

            root.innerHTML = renderValid(data.document);
        } catch (_error) {
            root.innerHTML = renderInvalid('No pudimos completar la verificación en este momento.');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        void hydrateVerification();
    });
})(window, document);
