export function renderSettingsSection() {
    return `
        <section id="settings" class="admin-section" tabindex="-1">
            <div class="settings-stage">
                <article class="sony-panel settings-form-panel">
                    <header class="section-header">
                        <div>
                            <h3>Perfil del medico</h3>
                            <p>Este perfil alimenta automaticamente certificados, recetas y evoluciones.</p>
                        </div>
                        <span class="settings-completion-pill" id="doctorProfileCompletion">0 / 4 campos listos</span>
                    </header>

                    <form id="doctorProfileForm" class="settings-form" novalidate>
                        <div class="settings-fields">
                            <label class="settings-field">
                                <span>Nombre completo</span>
                                <input
                                    id="doctorProfileFullName"
                                    name="fullName"
                                    type="text"
                                    autocomplete="name"
                                    placeholder="Dra. Nombre Apellido"
                                >
                            </label>
                            <label class="settings-field">
                                <span>Especialidad</span>
                                <input
                                    id="doctorProfileSpecialty"
                                    name="specialty"
                                    type="text"
                                    autocomplete="organization-title"
                                    placeholder="Dermatologia clinica"
                                >
                            </label>
                            <label class="settings-field">
                                <span>Registro MSP</span>
                                <input
                                    id="doctorProfileMspNumber"
                                    name="mspNumber"
                                    type="text"
                                    placeholder="MSP-000000"
                                >
                            </label>
                            <label class="settings-field">
                                <span>Firma digital</span>
                                <input
                                    id="doctorProfileSignatureFile"
                                    name="signatureFile"
                                    type="file"
                                    accept="image/png,image/jpeg"
                                >
                                <small>PNG o JPG. Se guarda como base64 en data/config/doctor-profile.json.</small>
                            </label>
                        </div>

                        <div class="settings-signature-block">
                            <div id="doctorProfileSignaturePreview" class="settings-signature-preview"></div>
                            <div class="settings-signature-meta">
                                <strong id="doctorProfileSignatureState">Sin firma cargada</strong>
                                <p>Usa una firma limpia y corta para evitar PDFs pesados.</p>
                                <button
                                    type="button"
                                    id="doctorProfileSignatureClearBtn"
                                    class="admin-theme-btn settings-secondary-btn"
                                >
                                    Eliminar firma
                                </button>
                            </div>
                        </div>

                        <div class="settings-form-actions">
                            <p id="doctorProfileSaveMeta">Sin cambios guardados todavia.</p>
                            <button
                                type="submit"
                                id="doctorProfileSaveBtn"
                                class="admin-v3-command-btn settings-primary-btn"
                            >
                                Guardar perfil
                            </button>
                        </div>
                    </form>
                </article>

                <aside class="settings-rail">
                    <article class="sony-panel soft settings-preview-panel">
                        <header class="section-header">
                            <div>
                                <h3>Preview documental</h3>
                                <p>Asi saldra el bloque de firma en los documentos.</p>
                            </div>
                        </header>
                        <div class="settings-preview-card">
                            <p class="settings-preview-eyebrow">Medico principal</p>
                            <strong id="doctorProfilePreviewName">Sin nombre definido</strong>
                            <p id="doctorProfilePreviewHeadline">Completa el perfil para publicar certificados consistentes.</p>
                            <p id="doctorProfilePreviewMeta">Registro MSP pendiente</p>
                            <div id="doctorProfilePreviewSignature" class="settings-preview-signature"></div>
                        </div>
                    </article>

                    <article class="sony-panel soft settings-status-panel">
                        <header class="section-header">
                            <div>
                                <h3>Estado</h3>
                                <p>Fuente canonica del perfil</p>
                            </div>
                        </header>
                        <dl class="settings-status-list">
                            <div>
                                <dt>Storage</dt>
                                <dd>data/config/doctor-profile.json</dd>
                            </div>
                            <div>
                                <dt>Ultima actualizacion</dt>
                                <dd id="doctorProfileUpdatedAt">Sin guardar</dd>
                            </div>
                            <div>
                                <dt>Superficies</dt>
                                <dd>Certificados, recetas y evoluciones</dd>
                            </div>
                        </dl>
                    </article>
                </aside>
            </div>
        </section>
    `;
}
