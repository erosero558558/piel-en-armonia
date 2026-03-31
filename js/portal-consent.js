(function (window, document) {
    'use strict';

    const portalShell = window.AuroraPatientPortalShell || null;
    const state = {
        consent: null,
        signatureDirty: false,
        pointerActive: false,
        lastPoint: null,
    };

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

    function requestJson(resource, token, options) {
        const requestOptions = options && typeof options === 'object' ? options : {};
        const method = String(requestOptions.method || 'GET').toUpperCase();
        const body =
            method === 'GET' || requestOptions.body == null
                ? undefined
                : JSON.stringify(requestOptions.body);

        return window
            .fetch(`/api.php?resource=${resource}`, {
                method,
                headers: {
                    Accept: 'application/json',
                    ...(body ? { 'Content-Type': 'application/json' } : {}),
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body,
            })
            .then(async (response) => ({
                ok: response.ok,
                status: response.status,
                body: await response.json().catch(() => ({})),
            }));
    }

    function requestDocument(url, token) {
        return window
            .fetch(url, {
                headers: {
                    Accept: 'application/pdf',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            })
            .then(async (response) => ({
                ok: response.ok,
                status: response.status,
                blob: response.ok ? await response.blob() : null,
                headers: response.headers,
            }));
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

        return fallbackName || 'consentimiento-aurora-derm.pdf';
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

    function setStatus(message, tone) {
        const statusNode = document.querySelector('[data-portal-consent-status]');
        if (!(statusNode instanceof HTMLElement)) {
            return;
        }

        statusNode.textContent = String(message || '');
        if (message) {
            statusNode.dataset.state = String(tone || 'idle');
        } else {
            statusNode.removeAttribute('data-state');
        }
    }

    function resizeSignatureCanvas() {
        const canvas = document.querySelector('[data-portal-consent-signature]');
        if (!(canvas instanceof HTMLCanvasElement)) {
            return null;
        }

        const rect = canvas.getBoundingClientRect();
        const ratio = Math.max(1, window.devicePixelRatio || 1);
        const width = Math.max(240, Math.round(rect.width || canvas.clientWidth || 320));
        const height = Math.max(180, Math.round(rect.height || canvas.clientHeight || 220));

        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return null;
        }

        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#0f172a';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2.4;

        state.signatureDirty = false;
        state.lastPoint = null;
        updateSignatureState('Firma pendiente');

        return ctx;
    }

    function updateSignatureState(label) {
        const node = document.querySelector('[data-portal-consent-signature-state]');
        if (node) {
            node.textContent = label;
        }
    }

    function currentCanvasContext() {
        const canvas = document.querySelector('[data-portal-consent-signature]');
        if (!(canvas instanceof HTMLCanvasElement)) {
            return null;
        }

        const ctx = canvas.getContext('2d');
        return ctx ? { canvas, ctx } : null;
    }

    function canvasPoint(event, canvas) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    }

    function touchLikeEvent(event) {
        const touch =
            (event.touches && event.touches[0]) ||
            (event.changedTouches && event.changedTouches[0]) ||
            null;

        if (!touch) {
            return null;
        }

        return {
            clientX: touch.clientX,
            clientY: touch.clientY,
            preventDefault() {
                event.preventDefault();
            },
        };
    }

    function beginStroke(event) {
        const current = currentCanvasContext();
        if (!current) {
            return;
        }

        state.pointerActive = true;
        state.lastPoint = canvasPoint(event, current.canvas);
        current.ctx.beginPath();
        current.ctx.moveTo(state.lastPoint.x, state.lastPoint.y);
        event.preventDefault();
    }

    function continueStroke(event) {
        if (!state.pointerActive) {
            return;
        }

        const current = currentCanvasContext();
        if (!current || !state.lastPoint) {
            return;
        }

        const point = canvasPoint(event, current.canvas);
        current.ctx.beginPath();
        current.ctx.moveTo(state.lastPoint.x, state.lastPoint.y);
        current.ctx.lineTo(point.x, point.y);
        current.ctx.stroke();

        state.lastPoint = point;
        state.signatureDirty = true;
        updateSignatureState('Firma lista');
        event.preventDefault();
    }

    function endStroke(event) {
        if (!state.pointerActive) {
            return;
        }

        state.pointerActive = false;
        state.lastPoint = null;
        if (event) {
            event.preventDefault();
        }
    }

    function clearSignatureCanvas() {
        resizeSignatureCanvas();
    }

    function currentSignatureDataUrl() {
        const current = currentCanvasContext();
        if (!current || state.signatureDirty !== true) {
            return '';
        }

        return current.canvas.toDataURL('image/png');
    }

    function fillText(selector, value) {
        const node = document.querySelector(selector);
        if (node) {
            node.textContent = String(value || 'Por confirmar');
        }
    }

    function renderConsentSummary(consent) {
        const shell = document.querySelector('[data-portal-consent-shell]');
        const emptyState = document.querySelector('[data-portal-consent-empty]');
        const form = document.querySelector('[data-portal-consent-form]');
        const signedCopy = document.querySelector('[data-portal-consent-signed]');
        const pdfCopy = document.querySelector('[data-portal-consent-pdf]');
        const downloadButton = document.querySelector('[data-portal-consent-download]');
        const submitButton = document.querySelector('[data-portal-consent-submit]');

        if (!(shell instanceof HTMLElement) || !(emptyState instanceof HTMLElement)) {
            return;
        }

        if (!consent || typeof consent !== 'object') {
            shell.hidden = true;
            emptyState.hidden = false;
            return;
        }

        state.consent = consent;
        shell.hidden = false;
        emptyState.hidden = true;

        fillText('[data-portal-consent-title]', consent.title || 'Consentimiento informado digital');
        fillText('[data-portal-consent-service]', consent.serviceLabel);
        fillText('[data-portal-consent-procedure]', consent.procedureName);
        fillText('[data-portal-consent-diagnosis]', consent.diagnosisLabel);
        fillText('[data-portal-consent-duration]', consent.durationEstimate);
        fillText('[data-portal-consent-what]', consent.procedureWhatIsIt);
        fillText('[data-portal-consent-how]', consent.procedureHowItIsDone);
        fillText('[data-portal-consent-benefits]', consent.benefits);
        fillText('[data-portal-consent-risks]', consent.frequentRisks);
        fillText('[data-portal-consent-rare-risks]', consent.rareSeriousRisks);
        fillText('[data-portal-consent-alternatives]', consent.alternatives);
        fillText('[data-portal-consent-aftercare]', consent.postProcedureCare);

        if (form instanceof HTMLFormElement) {
            form.patientName.value = String(consent.patientName || '');
            form.patientDocumentNumber.value = String(consent.patientDocumentNumber || '');
            form.accepted.checked = false;
            form.hidden = consent.status === 'signed';
        }

        if (signedCopy instanceof HTMLElement) {
            signedCopy.hidden = consent.status !== 'signed';
            if (consent.status === 'signed') {
                signedCopy.textContent =
                    consent.signedAtLabel && consent.signedAtLabel !== ''
                        ? `Consentimiento archivado correctamente el ${consent.signedAtLabel}.`
                        : 'Consentimiento archivado correctamente.';
            }
        }

        if (pdfCopy instanceof HTMLElement) {
            const hasPdf = consent.pdfAvailable === true && consent.downloadUrl;
            pdfCopy.hidden = !hasPdf;
            pdfCopy.textContent = hasPdf
                ? `Tu PDF firmado quedó archivado y listo para descarga segura desde este portal.`
                : '';
        }

        if (downloadButton instanceof HTMLElement) {
            const hasPdf = consent.pdfAvailable === true && consent.downloadUrl;
            downloadButton.hidden = !hasPdf;
        }

        if (submitButton instanceof HTMLButtonElement) {
            submitButton.disabled = consent.readyForSignature === false;
        }

        clearSignatureCanvas();

        if (consent.status === 'signed') {
            updateSignatureState('Documento ya firmado');
            setStatus('', '');
            return;
        }

        if (consent.readyForSignature === false) {
            setStatus(
                'Tu equipo clínico todavía está completando este documento antes de habilitar la firma digital.',
                'loading'
            );
            updateSignatureState('Firma bloqueada hasta completar el documento');
            return;
        }

        setStatus('', '');
    }

    async function loadConsent() {
        const session = readSession();
        if (!isFreshSession(session)) {
            clearSession();
            redirectToLogin();
            return;
        }

        const response = await requestJson('patient-portal-consent', session.token);
        if (response.status === 401) {
            clearSession();
            redirectToLogin();
            return;
        }

        if (!response.ok || response.body.ok !== true) {
            setStatus(
                response.body.error || 'No pudimos cargar tu consentimiento digital por ahora.',
                'error'
            );
            return;
        }

        const patient =
            response.body.data && response.body.data.patient && typeof response.body.data.patient === 'object'
                ? response.body.data.patient
                : null;
        if (patient) {
            updatePatient(patient);
        }

        renderConsentSummary(response.body.data ? response.body.data.consent : null);
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const form = event.currentTarget;
        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        const session = readSession();
        if (!isFreshSession(session)) {
            clearSession();
            redirectToLogin();
            return;
        }

        const consent = state.consent && typeof state.consent === 'object' ? state.consent : null;
        if (!consent || consent.status === 'signed') {
            return;
        }

        const signatureDataUrl = currentSignatureDataUrl();
        if (!signatureDataUrl) {
            setStatus('Firma con tu dedo antes de guardar el consentimiento.', 'error');
            return;
        }

        const submitButton = document.querySelector('[data-portal-consent-submit]');
        if (submitButton instanceof HTMLButtonElement) {
            submitButton.disabled = true;
        }

        setStatus('Guardando tu firma digital y archivando el PDF...', 'loading');

        const response = await requestJson('patient-portal-consent', session.token, {
            method: 'POST',
            body: {
                packetId: consent.packetId || '',
                patientName: String(form.patientName.value || '').trim(),
                patientDocumentNumber: String(form.patientDocumentNumber.value || '').trim(),
                signatureDataUrl,
                accepted: Boolean(form.accepted.checked),
            },
        });

        if (submitButton instanceof HTMLButtonElement) {
            submitButton.disabled = false;
        }

        if (response.status === 401) {
            clearSession();
            redirectToLogin();
            return;
        }

        if (!response.ok || response.body.ok !== true) {
            setStatus(
                response.body.error || 'No pudimos guardar tu consentimiento firmado.',
                'error'
            );
            return;
        }

        renderConsentSummary(response.body.data ? response.body.data.consent : null);
        setStatus('', '');
    }

    async function handleDownload() {
        const session = readSession();
        if (!isFreshSession(session)) {
            clearSession();
            redirectToLogin();
            return;
        }

        const consent = state.consent && typeof state.consent === 'object' ? state.consent : null;
        if (!consent || !consent.downloadUrl) {
            return;
        }

        setStatus('Preparando tu PDF firmado...', 'loading');
        const documentResponse = await requestDocument(consent.downloadUrl, session.token);
        if (!documentResponse.ok || !documentResponse.blob) {
            setStatus('No pudimos descargar tu PDF firmado en este momento.', 'error');
            return;
        }

        triggerBlobDownload(
            documentResponse.blob,
            parseFilename(documentResponse.headers, consent.pdfFileName || 'consentimiento-aurora-derm.pdf')
        );
        setStatus('', '');
    }

    function bindCanvas() {
        const current = currentCanvasContext();
        const clearButton = document.querySelector('[data-portal-consent-clear]');
        if (!current) {
            return;
        }

        resizeSignatureCanvas();

        current.canvas.addEventListener('pointerdown', beginStroke);
        current.canvas.addEventListener('pointermove', continueStroke);
        current.canvas.addEventListener('pointerup', endStroke);
        current.canvas.addEventListener('pointerleave', endStroke);
        current.canvas.addEventListener('pointercancel', endStroke);
        current.canvas.addEventListener('mousedown', beginStroke);
        current.canvas.addEventListener('mousemove', continueStroke);
        current.canvas.addEventListener('mouseup', endStroke);
        current.canvas.addEventListener('mouseleave', endStroke);
        current.canvas.addEventListener('touchstart', (event) => {
            const synthetic = touchLikeEvent(event);
            if (synthetic) {
                beginStroke(synthetic);
            }
        });
        current.canvas.addEventListener('touchmove', (event) => {
            const synthetic = touchLikeEvent(event);
            if (synthetic) {
                continueStroke(synthetic);
            }
        });
        current.canvas.addEventListener('touchend', (event) => {
            const synthetic = touchLikeEvent(event);
            if (synthetic) {
                endStroke(synthetic);
                return;
            }

            endStroke(event);
        });
        current.canvas.addEventListener('touchcancel', endStroke);

        if (clearButton instanceof HTMLElement) {
            clearButton.addEventListener('click', clearSignatureCanvas);
        }

        window.addEventListener('resize', clearSignatureCanvas);
    }

    function bindEvents() {
        const form = document.querySelector('[data-portal-consent-form]');
        const downloadButton = document.querySelector('[data-portal-consent-download]');

        if (form instanceof HTMLFormElement) {
            form.addEventListener('submit', handleSubmit);
        }

        if (downloadButton instanceof HTMLElement) {
            downloadButton.addEventListener('click', handleDownload);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        bindCanvas();
        bindEvents();
        loadConsent().catch(() => {
            setStatus('No pudimos cargar tu consentimiento digital por ahora.', 'error');
        });
    });
})(window, document);
