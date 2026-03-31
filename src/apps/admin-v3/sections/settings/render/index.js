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
let activeLogoImage = '';
let savingDoctor = false;
let savingClinic = false;
let subscriptionCheckoutBusy = false;

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

function normalizeSoftwareSubscription(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const invoices = Array.isArray(source.invoices) ? source.invoices : [];

    return {
        status: String(source.status || 'free').trim(),
        statusLabel: String(source.statusLabel || '').trim(),
        planKey: String(source.planKey || 'free').trim(),
        planLabel: String(source.planLabel || 'Free').trim(),
        pendingPlanKey: String(source.pendingPlanKey || '').trim(),
        pendingPlanLabel: String(source.pendingPlanLabel || '').trim(),
        billingInterval: String(source.billingInterval || '').trim(),
        currency: String(source.currency || 'USD').trim(),
        amountCents: Number(source.amountCents || 0),
        amountLabel: String(source.amountLabel || '').trim(),
        startedAt: String(source.startedAt || '').trim(),
        renewalAt: String(source.renewalAt || '').trim(),
        trialEndsAt: String(source.trialEndsAt || '').trim(),
        trialReminderSentAt: String(source.trialReminderSentAt || '').trim(),
        trialReminderChannel: String(source.trialReminderChannel || '').trim(),
        trialReminderOutboxId: String(source.trialReminderOutboxId || '').trim(),
        endedAt: String(source.endedAt || '').trim(),
        downgradedAt: String(source.downgradedAt || '').trim(),
        checkoutSessionId: String(source.checkoutSessionId || '').trim(),
        checkoutUrl: String(source.checkoutUrl || '').trim(),
        stripeCustomerId: String(source.stripeCustomerId || '').trim(),
        stripeSubscriptionId: String(source.stripeSubscriptionId || '').trim(),
        latestInvoiceId: String(source.latestInvoiceId || '').trim(),
        updatedAt: String(source.updatedAt || '').trim(),
        invoices: invoices.map((invoice) => ({
            id: String(invoice?.id || '').trim(),
            number: String(invoice?.number || '').trim(),
            status: String(invoice?.status || '').trim(),
            statusLabel: String(invoice?.statusLabel || '').trim(),
            amountLabel: String(invoice?.amountLabel || '').trim(),
            issuedAt: String(invoice?.issuedAt || '').trim(),
            paidAt: String(invoice?.paidAt || '').trim(),
            periodStart: String(invoice?.periodStart || '').trim(),
            periodEnd: String(invoice?.periodEnd || '').trim(),
            hostedInvoiceUrl: String(invoice?.hostedInvoiceUrl || '').trim(),
            invoicePdf: String(invoice?.invoicePdf || '').trim(),
        })),
    };
}

function normalizeClinicProfile(profile) {
    const source = profile && typeof profile === 'object' ? profile : {};
    return {
        clinicName: String(source.clinicName || '').trim(),
        address: String(source.address || '').trim(),
        phone: String(source.phone || '').trim(),
        logoImage: String(source.logoImage || '').trim(),
        software_plan: String(source.software_plan || 'Free').trim(),
        software_subscription: normalizeSoftwareSubscription(
            source.software_subscription || {}
        ),
        updatedAt: String(source.updatedAt || '').trim(),
    };
}

function getClinicProfileFromState() {
    return normalizeClinicProfile(getState()?.data?.clinicProfile || {});
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

function readClinicProfileFromForm(root) {
    const clinicName = qs('#clinicProfileName', root);
    const address = qs('#clinicProfileAddress', root);
    const phone = qs('#clinicProfilePhone', root);
    const softwarePlan = qs('#clinicProfileSoftwarePlan', root);

    return normalizeClinicProfile({
        clinicName: clinicName instanceof HTMLInputElement ? clinicName.value : '',
        address: address instanceof HTMLInputElement ? address.value : '',
        phone: phone instanceof HTMLInputElement ? phone.value : '',
        logoImage: activeLogoImage,
        software_plan: softwarePlan instanceof HTMLSelectElement ? softwarePlan.value : 'Free',
        software_subscription: getClinicProfileFromState().software_subscription,
        updatedAt: getClinicProfileFromState().updatedAt,
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

function renderLogoPreview(root, logoImage) {
    if (logoImage) {
        setHtml(
            '#clinicProfileLogoPreview',
            `<img src="${escapeHtml(logoImage)}" alt="Logo Institucional">`
        );
        setText('#clinicProfileLogoState', 'Logo cargado');
    } else {
        setHtml(
            '#clinicProfileLogoPreview',
            '<div class="settings-signature-placeholder">Sin logo digital</div>'
        );
        setText('#clinicProfileLogoState', 'Sin logo cargado');
    }
}

function resolveSubscriptionTone(subscription) {
    if (subscription.status === 'past_due') {
        return 'warning';
    }
    if (subscription.status === 'active' || subscription.status === 'trialing') {
        return 'success';
    }
    if (subscription.status === 'pending_checkout') {
        return 'neutral';
    }
    return 'neutral';
}

function resolveSubscriptionStatusLine(subscription) {
    const label = subscription.statusLabel || 'Sin suscripción activa';
    if (subscription.status === 'active') {
        return `${label}. ${subscription.amountLabel || 'Plan recurrente'} ya está corriendo en Stripe.`;
    }
    if (subscription.status === 'trialing') {
        if (subscription.trialReminderSentAt) {
            return `${label}. El plan ${subscription.planLabel || 'Flow OS'} sigue en trial y ya se envió recordatorio de renovación.`;
        }
        return `${label}. El plan ${subscription.planLabel || 'Flow OS'} sigue dentro del período promocional.`;
    }
    if (subscription.status === 'past_due') {
        return `${label}. Stripe reportó un cobro pendiente y conviene revisar la factura más reciente.`;
    }
    if (subscription.status === 'pending_checkout') {
        return `Checkout pendiente para ${subscription.pendingPlanLabel || subscription.planLabel || 'Flow OS'}.`;
    }
    if (subscription.planKey === 'enterprise') {
        return 'Plan Enterprise bajo coordinación comercial.';
    }
    return 'Sin suscripción recurrente activa todavía.';
}

function resolveSubscriptionRenewalLine(subscription) {
    if (subscription.renewalAt) {
        return `Próxima renovación: ${formatDateTime(subscription.renewalAt)}.`;
    }
    if (subscription.trialEndsAt) {
        return `Trial hasta ${formatDateTime(subscription.trialEndsAt)}.`;
    }
    if (subscription.endedAt) {
        return `Terminó el ${formatDateTime(subscription.endedAt)}.`;
    }
    return 'Renovación no disponible.';
}

function resolveSubscriptionPendingLine(subscription) {
    if (subscription.pendingPlanLabel) {
        return `Cambio preparado a ${subscription.pendingPlanLabel}.`;
    }
    if (subscription.status === 'trialing' && subscription.trialReminderSentAt) {
        return `Recordatorio enviado ${formatDateTime(subscription.trialReminderSentAt)}${subscription.trialReminderChannel ? ` por ${subscription.trialReminderChannel}` : ''}.`;
    }
    if (subscription.status === 'trialing') {
        return 'Convierte el trial a pago antes del corte o la clínica volverá a Free.';
    }
    return 'Puedes activar Starter o Pro sin salir del panel.';
}

function buildSoftwareSubscriptionInvoiceItems(subscription) {
    const invoices = Array.isArray(subscription.invoices)
        ? subscription.invoices
        : [];
    if (!invoices.length) {
        return `
            <li class="dashboard-attention-item" data-tone="neutral">
                <div class="dashboard-payment-account__copy">
                    <strong>Sin facturas todavía</strong>
                    <small>Cuando Stripe confirme el primer ciclo mensual, las invoices aparecerán aquí.</small>
                </div>
            </li>
        `;
    }

    return invoices
        .slice(0, 4)
        .map((invoice) => {
            const href = invoice.hostedInvoiceUrl || invoice.invoicePdf || '#';
            const meta = [
                invoice.amountLabel || '',
                invoice.statusLabel || invoice.status || '',
                invoice.issuedAt ? `Emitida ${formatDateTime(invoice.issuedAt)}` : '',
                invoice.paidAt ? `Pagada ${formatDateTime(invoice.paidAt)}` : '',
            ]
                .filter(Boolean)
                .join(' • ');

            return `
                <li class="dashboard-attention-item" data-tone="${escapeHtml(
                    invoice.status === 'paid' ? 'success' : 'neutral'
                )}">
                    <div class="dashboard-payment-account__copy">
                        <strong>${escapeHtml(invoice.number || invoice.id || 'Factura')}</strong>
                        <small>${escapeHtml(meta || 'Sin metadatos todavía')}</small>
                    </div>
                    ${
                        href !== '#'
                            ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">Abrir</a>`
                            : ''
                    }
                </li>
            `;
        })
        .join('');
}

function renderSoftwareSubscriptionPanel(root, clinicProfile) {
    const subscription = normalizeSoftwareSubscription(
        clinicProfile?.software_subscription || {}
    );
    const tone = resolveSubscriptionTone(subscription);
    const statusPill = qs('#softwareSubscriptionStatusPill', root);
    const checkoutLink = qs('#softwareSubscriptionCheckoutLink', root);
    const softwarePlan = qs('#clinicProfileSoftwarePlan', root);
    const starterButton = qs('#softwareSubscriptionStarterBtn', root);
    const proButton = qs('#softwareSubscriptionProBtn', root);
    const isLockedPlan =
        ['active', 'trialing', 'past_due', 'pending_checkout'].includes(
            subscription.status
        ) &&
        subscription.planKey !== 'free';

    setText(
        '#softwareSubscriptionPlanHeadline',
        subscription.planLabel || 'Free'
    );
    setText(
        '#softwareSubscriptionStatusLine',
        resolveSubscriptionStatusLine(subscription)
    );
    setText(
        '#softwareSubscriptionRenewalLine',
        resolveSubscriptionRenewalLine(subscription)
    );
    setText(
        '#softwareSubscriptionPendingLine',
        resolveSubscriptionPendingLine(subscription)
    );
    setText(
        '#softwareSubscriptionStripeMeta',
        subscription.checkoutSessionId
            ? `Checkout ${subscription.checkoutSessionId} listo o sincronizado con Stripe.`
            : 'Aún no se ha iniciado un checkout recurrente.'
    );
    setText(
        '#softwareSubscriptionInvoiceCount',
        `${Number(subscription.invoices?.length || 0)} registradas`
    );
    setText(
        '#softwareSubscriptionUpdatedAt',
        subscription.updatedAt
            ? formatDateTime(subscription.updatedAt)
            : 'Sin sincronizar'
    );
    setHtml(
        '#softwareSubscriptionInvoiceList',
        buildSoftwareSubscriptionInvoiceItems(subscription)
    );
    if (statusPill instanceof HTMLElement) {
        statusPill.textContent = subscription.statusLabel || 'Free';
        statusPill.dataset.state = tone;
    }
    if (checkoutLink instanceof HTMLAnchorElement) {
        if (subscription.checkoutUrl) {
            checkoutLink.hidden = false;
            checkoutLink.href = subscription.checkoutUrl;
        } else {
            checkoutLink.hidden = true;
            checkoutLink.href = '#';
        }
    }
    if (softwarePlan instanceof HTMLSelectElement) {
        softwarePlan.disabled = isLockedPlan;
    }
    if (starterButton instanceof HTMLButtonElement) {
        starterButton.disabled =
            subscriptionCheckoutBusy ||
            (subscription.pendingPlanKey === 'starter' &&
                subscription.status === 'pending_checkout') ||
            (subscription.planKey === 'starter' &&
                ['active', 'past_due'].includes(subscription.status));
    }
    if (proButton instanceof HTMLButtonElement) {
        proButton.disabled =
            subscriptionCheckoutBusy ||
            (subscription.pendingPlanKey === 'pro' &&
                subscription.status === 'pending_checkout') ||
            (subscription.planKey === 'pro' &&
                ['active', 'past_due'].includes(subscription.status));
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

function applyClinicProfileToForm(root, profile) {
    const form = qs('#clinicProfileForm', root);
    const clinicName = qs('#clinicProfileName', root);
    const address = qs('#clinicProfileAddress', root);
    const phone = qs('#clinicProfilePhone', root);
    const logoFile = qs('#clinicProfileLogoFile', root);
    const softwarePlan = qs('#clinicProfileSoftwarePlan', root);

    if (clinicName instanceof HTMLInputElement) {
        clinicName.value = profile.clinicName;
    }
    if (address instanceof HTMLInputElement) {
        address.value = profile.address;
    }
    if (phone instanceof HTMLInputElement) {
        phone.value = profile.phone;
    }
    if (softwarePlan instanceof HTMLSelectElement) {
        softwarePlan.value = profile.software_plan || 'Free';
    }
    if (logoFile instanceof HTMLInputElement) {
        logoFile.value = '';
    }
    if (form instanceof HTMLFormElement) {
        form.dataset.dirty = 'false';
    }

    activeLogoImage = profile.logoImage;
    syncClinicPreview(root);
}

function syncClinicPreview(root) {
    const form = qs('#clinicProfileForm', root);
    const profile = readClinicProfileFromForm(root);
    const dirty = form instanceof HTMLFormElement && form.dataset.dirty === 'true';

    setText(
        '#clinicProfileSaveMeta',
        dirty
            ? 'Cambios sin guardar.'
            : profile.updatedAt
              ? `Actualizado ${formatDateTime(profile.updatedAt)}`
              : 'Sin cambios guardados todavia.'
    );
    renderLogoPreview(root, profile.logoImage);
    renderSoftwareSubscriptionPanel(root, getClinicProfileFromState());
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

function saveClinicProfileInState(profile) {
    const currentState = getState();
    const nextData = {
        ...currentState.data,
        clinicProfile: profile,
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
        if (savingDoctor) {
            return;
        }

        const saveButton = qs('#doctorProfileSaveBtn', root);
        const nextProfile = readProfileFromForm(root);
        savingDoctor = true;

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
            savingDoctor = false;
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
    attachClinicListeners(root);

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

    const currentClinic = getClinicProfileFromState();
    const clinicForm = qs('#clinicProfileForm', root);
    const shouldHydrateClinic =
        options.force === true ||
        !(clinicForm instanceof HTMLFormElement) ||
        clinicForm.dataset.dirty !== 'true';

    if (shouldHydrateClinic) {
        applyClinicProfileToForm(root, currentClinic);
    } else {
        syncClinicPreview(root);
    }

    setText(
        '#clinicProfileUpdatedAt',
        currentClinic.updatedAt
            ? formatDateTime(currentClinic.updatedAt)
            : 'Sin guardar'
    );
}

function attachClinicListeners(root) {
    const form = qs('#clinicProfileForm', root);
    if (!(form instanceof HTMLFormElement) || form.dataset.bound === 'true') {
        return;
    }

    form.dataset.bound = 'true';
    form.addEventListener('input', () => {
        form.dataset.dirty = 'true';
        syncClinicPreview(root);
    });

    const logoFile = qs('#clinicProfileLogoFile', root);
    if (logoFile instanceof HTMLInputElement) {
        logoFile.addEventListener('change', async () => {
            const file = logoFile.files?.[0];
            if (!file) return;
            if (!['image/png', 'image/jpeg'].includes(file.type)) {
                createToast('El logo debe ser PNG o JPG.', 'warning');
                logoFile.value = '';
                return;
            }
            if (file.size > 512 * 1024) {
                createToast('El logo supera el maximo de 512 KB.', 'warning');
                logoFile.value = '';
                return;
            }
            try {
                activeLogoImage = String(await readFileAsDataUrl(file));
                form.dataset.dirty = 'true';
                syncClinicPreview(root);
            } catch (error) {
                createToast(
                    error?.message || 'No se pudo procesar el logo.',
                    'error'
                );
            }
        });
    }

    const clearLogoBtn = qs('#clinicProfileLogoClearBtn', root);
    if (clearLogoBtn instanceof HTMLButtonElement) {
        clearLogoBtn.addEventListener('click', () => {
            activeLogoImage = '';
            if (logoFile instanceof HTMLInputElement) {
                logoFile.value = '';
            }
            form.dataset.dirty = 'true';
            syncClinicPreview(root);
        });
    }

    const bindSubscriptionButton = (selector, planKey, idleLabel) => {
        const button = qs(selector, root);
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }

        button.addEventListener('click', async () => {
            if (subscriptionCheckoutBusy) {
                return;
            }

            subscriptionCheckoutBusy = true;
            button.disabled = true;
            button.textContent = 'Preparando Stripe...';

            try {
                const response = await apiRequest('software-subscription-checkout', {
                    method: 'POST',
                    body: { planKey },
                });
                const savedClinic = normalizeClinicProfile(
                    response?.data?.clinicProfile || getClinicProfileFromState()
                );
                saveClinicProfileInState(savedClinic);
                renderSettingsSection({ force: true });
                createToast(
                    `Checkout de Stripe listo para ${savedClinic.software_subscription.pendingPlanLabel || savedClinic.software_subscription.planLabel || planKey}.`,
                    'success'
                );
            } catch (error) {
                createToast(
                    error?.message || 'No se pudo iniciar el checkout de Stripe.',
                    'error'
                );
            } finally {
                subscriptionCheckoutBusy = false;
                button.disabled = false;
                button.textContent = idleLabel;
                renderSettingsSection({ force: true });
            }
        });
    };

    bindSubscriptionButton(
        '#softwareSubscriptionStarterBtn',
        'starter',
        'Activar Starter con Stripe'
    );
    bindSubscriptionButton(
        '#softwareSubscriptionProBtn',
        'pro',
        'Activar Pro con Stripe'
    );

    const previewBtn = qs('#clinicProfilePreviewBtn', root);
    const previewModal = qs('#clinicPreviewModal', root);
    const surfaceSelect = qs('#clinicPreviewSurfaceSelect', root);
    const previewIframe = qs('#clinicPreviewIframe', root);

    if (previewBtn instanceof HTMLButtonElement && previewModal instanceof HTMLDialogElement) {
        previewBtn.addEventListener('click', () => {
            const currentUnsavedProfile = readClinicProfileFromForm(root);
            sessionStorage.setItem('aurora_clinic_preview_data', JSON.stringify({
                clinicName: currentUnsavedProfile.clinicName,
                logoImage: activeLogoImage
            }));
            
            const loadIframe = () => {
                if (previewIframe instanceof HTMLIFrameElement && surfaceSelect instanceof HTMLSelectElement) {
                    previewIframe.src = surfaceSelect.value;
                }
            };

            loadIframe();
            previewModal.showModal();

            if (surfaceSelect instanceof HTMLSelectElement) {
                surfaceSelect.onchange = loadIframe;
            }
        });

        previewModal.addEventListener('close', () => {
            sessionStorage.removeItem('aurora_clinic_preview_data');
            if (previewIframe instanceof HTMLIFrameElement) previewIframe.src = 'about:blank';
        });
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (savingClinic) return;

        const saveButton = qs('#clinicProfileSaveBtn', root);
        const nextProfile = readClinicProfileFromForm(root);
        savingClinic = true;

        if (saveButton instanceof HTMLButtonElement) {
            saveButton.disabled = true;
            saveButton.textContent = 'Guardando...';
        }

        try {
            const response = await apiRequest('clinic-profile', {
                method: 'POST',
                body: { clinicProfile: nextProfile },
            });
            const savedProfile = normalizeClinicProfile(response?.data || {});
            saveClinicProfileInState(savedProfile);
            form.dataset.dirty = 'false';
            activeLogoImage = savedProfile.logoImage;
            renderSettingsSection({ force: true });
            createToast('Perfil de la clinica guardado.', 'success');
        } catch (error) {
            createToast(
                error?.message || 'No se pudo guardar el perfil de la clinica.',
                'error'
            );
        } finally {
            savingClinic = false;
            if (saveButton instanceof HTMLButtonElement) {
                saveButton.disabled = false;
                saveButton.textContent = 'Guardar perfil';
            }
        }
    });
}
