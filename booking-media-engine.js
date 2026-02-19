/**
 * Booking media engine (deferred-loaded).
 * Handles case-photo validation, upload and payload shaping for appointments.
 */
(function () {
    'use strict';

    const DEFAULT_MAX_CASE_PHOTOS = 3;
    const DEFAULT_MAX_CASE_PHOTO_BYTES = 5 * 1024 * 1024;
    const DEFAULT_UPLOAD_CONCURRENCY = 2;
    const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    let deps = null;

    function init(inputDeps) {
        deps = inputDeps || {};
        return window.PielBookingMediaEngine;
    }

    function normalizePositiveInteger(value, fallback) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return fallback;
        }
        return Math.floor(parsed);
    }

    function getCurrentLang() {
        if (deps && typeof deps.getCurrentLang === 'function') {
            const lang = deps.getCurrentLang();
            return lang === 'en' ? 'en' : 'es';
        }
        return 'es';
    }

    function getMaxCasePhotos() {
        return normalizePositiveInteger(deps && deps.maxCasePhotos, DEFAULT_MAX_CASE_PHOTOS);
    }

    function getMaxCasePhotoBytes() {
        return normalizePositiveInteger(deps && deps.maxCasePhotoBytes, DEFAULT_MAX_CASE_PHOTO_BYTES);
    }

    function getUploadConcurrency() {
        return normalizePositiveInteger(deps && deps.uploadConcurrency, DEFAULT_UPLOAD_CONCURRENCY);
    }

    function getAllowedCasePhotoTypes() {
        const configured = Array.isArray(deps && deps.allowedCasePhotoTypes)
            ? deps.allowedCasePhotoTypes
            : DEFAULT_ALLOWED_TYPES;
        const normalized = configured
            .map((item) => String(item || '').toLowerCase())
            .filter(Boolean);
        return new Set(normalized.length > 0 ? normalized : DEFAULT_ALLOWED_TYPES);
    }

    function getUploadTransferProof() {
        if (deps && typeof deps.uploadTransferProof === 'function') {
            return deps.uploadTransferProof;
        }
        throw new Error('BookingMediaEngine dependency missing: uploadTransferProof');
    }

    function getCasePhotoFiles(formElement) {
        const input = formElement && typeof formElement.querySelector === 'function'
            ? formElement.querySelector('#casePhotos')
            : null;
        if (!input || !input.files) {
            return [];
        }
        return Array.from(input.files);
    }

    function validateCasePhotoFiles(files) {
        if (!Array.isArray(files) || files.length === 0) {
            return;
        }

        const maxCasePhotos = getMaxCasePhotos();
        const maxCasePhotoBytes = getMaxCasePhotoBytes();
        const allowedTypes = getAllowedCasePhotoTypes();
        const lang = getCurrentLang();

        if (files.length > maxCasePhotos) {
            throw new Error(
                lang === 'es'
                    ? `Puedes subir máximo ${maxCasePhotos} fotos.`
                    : `You can upload up to ${maxCasePhotos} photos.`
            );
        }

        for (const file of files) {
            if (!file) {
                continue;
            }

            if (file.size > maxCasePhotoBytes) {
                const limitMb = Math.round(maxCasePhotoBytes / (1024 * 1024));
                throw new Error(
                    lang === 'es'
                        ? `Cada foto debe pesar máximo ${limitMb} MB.`
                        : `Each photo must be at most ${limitMb} MB.`
                );
            }

            const mime = String(file.type || '').toLowerCase();
            const validByMime = allowedTypes.has(mime);
            const validByExt = /\.(jpe?g|png|webp)$/i.test(String(file.name || ''));
            if (!validByMime && !validByExt) {
                throw new Error(
                    lang === 'es'
                        ? 'Solo se permiten imágenes JPG, PNG o WEBP.'
                        : 'Only JPG, PNG or WEBP images are allowed.'
                );
            }
        }
    }

    function mapUploadedFiles(items) {
        if (!Array.isArray(items) || items.length === 0) {
            return { names: [], urls: [], paths: [] };
        }
        return {
            names: items.map((item) => String(item && item.name || '')).filter(Boolean),
            urls: items.map((item) => String(item && item.url || '')).filter(Boolean),
            paths: items.map((item) => String(item && item.path || '')).filter(Boolean)
        };
    }

    async function ensureCasePhotosUploaded(appointment) {
        const target = appointment && typeof appointment === 'object' ? appointment : {};
        const files = Array.isArray(target.casePhotoFiles) ? target.casePhotoFiles : [];
        if (files.length === 0) {
            return { names: [], urls: [], paths: [] };
        }

        if (Array.isArray(target.casePhotoUploads) && target.casePhotoUploads.length > 0) {
            return mapUploadedFiles(target.casePhotoUploads);
        }

        const uploads = new Array(files.length);
        const workerCount = Math.max(1, Math.min(getUploadConcurrency(), files.length));
        let cursor = 0;
        const uploadTransferProof = getUploadTransferProof();

        const uploadWorker = async () => {
            while (cursor < files.length) {
                const index = cursor;
                cursor += 1;
                const file = files[index];
                const uploaded = await uploadTransferProof(file, { retries: 2 });
                uploads[index] = {
                    name: uploaded.transferProofName || (file && file.name) || '',
                    url: uploaded.transferProofUrl || '',
                    path: uploaded.transferProofPath || ''
                };
            }
        };

        await Promise.all(Array.from({ length: workerCount }, () => uploadWorker()));
        target.casePhotoUploads = uploads;
        return mapUploadedFiles(uploads);
    }

    function stripTransientAppointmentFields(appointment) {
        const payload = { ...(appointment || {}) };
        delete payload.casePhotoFiles;
        delete payload.casePhotoUploads;
        return payload;
    }

    async function buildAppointmentPayload(appointment) {
        const payload = stripTransientAppointmentFields(appointment || {});
        const uploadedPhotos = await ensureCasePhotosUploaded(appointment || {});
        payload.casePhotoCount = uploadedPhotos.urls.length;
        payload.casePhotoNames = uploadedPhotos.names;
        payload.casePhotoUrls = uploadedPhotos.urls;
        payload.casePhotoPaths = uploadedPhotos.paths;
        return payload;
    }

    window.PielBookingMediaEngine = {
        init,
        getCasePhotoFiles,
        validateCasePhotoFiles,
        ensureCasePhotosUploaded,
        stripTransientAppointmentFields,
        buildAppointmentPayload
    };
})();
