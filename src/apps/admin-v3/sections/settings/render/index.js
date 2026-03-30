import { apiRequest } from '../../../shared/core/api-client.js';
import { getState } from '../../../shared/core/store.js';
import { persistLocalAdminData } from '../../../shared/modules/data/local.js';
import { writeAdminDataInStore } from '../../../shared/modules/data/store.js';
import {
    createToast,
    escapeHtml,
    formatDateTime,
    qs,
    setHtml,
    setText,
} from '../../../shared/ui/render.js';

let activeSignatureImage = '';
let saving = false;

function normalizeDoctorProfile(profile) {
    const source = profile && typeof profile === 'object' ? profile : {};
    return {
        fullName: String(source.fullName || '').trim(),
        specialty: String(source.specialty || '').trim(),
        mspNumber: String(source.mspNumber || '').trim(),
        signatureImage: String(source.signatureImage || '').trim(),
        updatedAt: String(source.updatedAt || '').trim(),
    };
}

function getDoctorProfileFromState() {
    return normalizeDoctorProfile(getState()?.data?.doctorProfile || {});
}

function countCompletedFields(profile) {
    const normalized = normalizeDoctorProfile(profile);
    return [
        normalized.fullName,
        normalized.specialty,
        normalized.mspNumber,
        normalized.signatureImage,
    ].filter(Boolean).length;
}

function readProfileFromForm(root) {
    const fullName = qs('#doctorProfileFullName', root);
    const specialty = qs('#doctorProfileSpecialty', root);
    const mspNumber = qs('#doctorProfileMspNumber', root);

    return normalizeDoctorProfile({
        fullName:
            fullName instanceof HTMLInputElement ? fullName.value : '',
        specialty:
            specialty instanceof HTMLInputElement ? specialty.value : '',
        mspNumber:
            mspNumber instanceof HTMLInputElement ? mspNumber.value : '',
        signatureImage: activeSignatureImage,
        updatedAt: getDoctorProfileFromState().updatedAt,
    });
}

function renderSignaturePreview(root, signatureImage) {
    if (signatureImage) {
        setHtml(
            '#doctorProfileSignaturePreview',
            `<img src="${escapeHtml(signatureImage)}" alt="Firma digital del medico">`
        );
        setText('#doctorProfileSignatureState', 'Firma lista para PDFs');
    } else {
        setHtml(
            '#doctorProfileSignaturePreview',
            '<div class="settings-signature-placeholder">Sin firma digital</div>'
        );
        setText('#doctorProfileSignatureState', 'Sin firma cargada');
    }
}

function syncPreview(root) {
    const form = qs('#doctorProfileForm', root);
    const profile = readProfileFromForm(root);
    const completed = countCompletedFields(profile);
    const dirty =
        form instanceof HTMLFormElement && form.dataset.dirty === 'true';

    setText(
        '#doctorProfilePreviewName',
        profile.fullName || 'Sin nombre definido'
    );
    setText(
        '#doctorProfilePreviewHeadline',
        profile.specialty ||
            'Completa el perfil para publicar certificados consistentes.'
    );
    setText(
        '#doctorProfilePreviewMeta',
        profile.mspNumber
            ? `Registro MSP: ${profile.mspNumber}`
            : 'Registro MSP pendiente'
    );
    setText('#doctorProfileCompletion', `${completed} / 4 campos listos`);
    setText('#settingsBadge', completed);
    setText(
        '#doctorProfileSaveMeta',
        dirty
            ? 'Cambios sin guardar.'
            : profile.updatedAt
              ? `Actualizado ${formatDateTime(profile.updatedAt)}`
              : 'Sin cambios guardados todavia.'
    );
    renderSignaturePreview(root, profile.signatureImage);

    if (profile.signatureImage) {
        setHtml(
            '#doctorProfilePreviewSignature',
            `<img src="${escapeHtml(profile.signatureImage)}" alt="Firma digital lista para documentos">`
        );
    } else {
        setHtml(
            '#doctorProfilePreviewSignature',
            '<p>La firma aparecera aqui cuando cargues una imagen PNG o JPG.</p>'
        );
    }
}

function applyProfileToForm(root, profile) {
    const form = qs('#doctorProfileForm', root);
    const fullName = qs('#doctorProfileFullName', root);
    const specialty = qs('#doctorProfileSpecialty', root);
    const mspNumber = qs('#doctorProfileMspNumber', root);
    const signatureFile = qs('#doctorProfileSignatureFile', root);

    if (fullName instanceof HTMLInputElement) {
        fullName.value = profile.fullName;
    }
    if (specialty instanceof HTMLInputElement) {
        specialty.value = profile.specialty;
    }
    if (mspNumber instanceof HTMLInputElement) {
        mspNumber.value = profile.mspNumber;
    }
    if (signatureFile instanceof HTMLInputElement) {
        signatureFile.value = '';
    }
    if (form instanceof HTMLFormElement) {
        form.dataset.dirty = 'false';
    }

    activeSignatureImage = profile.signatureImage;
    syncPreview(root);
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('No se pudo leer la firma.'));
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
    });
}

function saveProfileInState(profile) {
    const currentState = getState();
    const nextData = {
        ...currentState.data,
        doctorProfile: profile,
    };
    writeAdminDataInStore(nextData);
    persistLocalAdminData(nextData);
}

function attachListeners(root) {
    const form = qs('#doctorProfileForm', root);
    if (!(form instanceof HTMLFormElement) || form.dataset.bound === 'true') {
        return;
    }

    form.dataset.bound = 'true';
    form.addEventListener('input', () => {
        form.dataset.dirty = 'true';
        syncPreview(root);
    });

    const signatureFile = qs('#doctorProfileSignatureFile', root);
    if (signatureFile instanceof HTMLInputElement) {
        signatureFile.addEventListener('change', async () => {
            const file = signatureFile.files?.[0];
            if (!file) {
                return;
            }

            if (!['image/png', 'image/jpeg'].includes(file.type)) {
                createToast('La firma debe ser PNG o JPG.', 'warning');
                signatureFile.value = '';
                return;
            }

            if (file.size > 512 * 1024) {
                createToast('La firma supera el maximo de 512 KB.', 'warning');
                signatureFile.value = '';
                return;
            }

            try {
                activeSignatureImage = String(await readFileAsDataUrl(file));
                form.dataset.dirty = 'true';
                syncPreview(root);
            } catch (error) {
                createToast(
                    error?.message || 'No se pudo procesar la firma digital.',
                    'error'
                );
            }
        });
    }

    const clearSignatureButton = qs('#doctorProfileSignatureClearBtn', root);
    if (clearSignatureButton instanceof HTMLButtonElement) {
        clearSignatureButton.addEventListener('click', () => {
            activeSignatureImage = '';
            if (signatureFile instanceof HTMLInputElement) {
                signatureFile.value = '';
            }
            form.dataset.dirty = 'true';
            syncPreview(root);
        });
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (saving) {
            return;
        }

        const saveButton = qs('#doctorProfileSaveBtn', root);
        const nextProfile = readProfileFromForm(root);
        saving = true;

        if (saveButton instanceof HTMLButtonElement) {
            saveButton.disabled = true;
            saveButton.textContent = 'Guardando...';
        }

        try {
            const response = await apiRequest('doctor-profile', {
                method: 'POST',
                body: nextProfile,
            });
            const savedProfile = normalizeDoctorProfile(response?.data || {});
            saveProfileInState(savedProfile);
            form.dataset.dirty = 'false';
            activeSignatureImage = savedProfile.signatureImage;
            renderSettingsSection({ force: true });
            createToast('Perfil del medico guardado.', 'success');
        } catch (error) {
            createToast(
                error?.message || 'No se pudo guardar el perfil del medico.',
                'error'
            );
        } finally {
            saving = false;
            if (saveButton instanceof HTMLButtonElement) {
                saveButton.disabled = false;
                saveButton.textContent = 'Guardar perfil';
            }
        }
    });
}

export function renderSettingsSection(options = {}) {
    const root = qs('#settings');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    attachListeners(root);

    const currentProfile = getDoctorProfileFromState();
    const form = qs('#doctorProfileForm', root);
    const shouldHydrate =
        options.force === true ||
        !(form instanceof HTMLFormElement) ||
        form.dataset.dirty !== 'true';

    if (shouldHydrate) {
        applyProfileToForm(root, currentProfile);
    } else {
        syncPreview(root);
    }

    setText(
        '#doctorProfileUpdatedAt',
        currentProfile.updatedAt
            ? formatDateTime(currentProfile.updatedAt)
            : 'Sin guardar'
    );
}
