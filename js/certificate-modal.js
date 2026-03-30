/**
 * js/certificate-modal.js
 * Genera, inyecta y gestiona el modal de emisión de certificados médicos.
 * (S3-43 / UI2-10)
 */

(function() {
    let modalElement = null;

    function createModalDom() {
        if (modalElement) {
            document.body.removeChild(modalElement);
        }

        modalElement = document.createElement('div');
        modalElement.className = 'aurora-cert-modal-overlay cert-hidden';
        
        // El HTML incluye clases de UI "Clinical Luxury" y variables de nuestro main-aurora.css
        modalElement.innerHTML = `
            <div class="aurora-cert-modal">
                <div class="aurora-cert-modal-header">
                    <h3 style="margin:0; font-family:var(--font-display); font-size:var(--text-xl);">📋 Emitir Certificado</h3>
                    <button type="button" class="aurora-cert-close-btn">&times;</button>
                </div>
                
                <div class="aurora-cert-modal-body" id="cert-form-container">
                    <form id="cert-issue-form">
                        <input type="hidden" id="cert-case-id" name="case_id">
                        
                        <div class="cert-form-group">
                            <label>Tipo de Certificado</label>
                            <select name="type" id="cert-type-select" class="input" required>
                                <option value="reposo_laboral" selected>Reposo Médico (Laboral/Estudiantil)</option>
                                <option value="aptitud_medica">Aptitud Médica</option>
                                <option value="constancia_tratamiento">Constancia de Tratamiento</option>
                                <option value="control_salud">Control de Salud</option>
                                <option value="incapacidad_temporal">Incapacidad Temporal (IESS)</option>
                            </select>
                        </div>

                        <div class="cert-form-group" id="cert-rest-days-group">
                            <label>Días de Reposo</label>
                            <input type="number" name="rest_days" id="cert-rest-days" class="input" min="1" max="90" value="1" required>
                        </div>
                        
                        <div class="cert-form-group">
                            <label>Diagnóstico Libre</label>
                            <input type="text" name="diagnosis_text" id="cert-diagnosis-text" class="input" placeholder="Ej: Dermatitis atópica severa" required>
                        </div>
                        
                        <div class="cert-form-group">
                            <label>Código CIE-10 (Auto-búsqueda activa)</label>
                            <input type="text" name="cie10_code" id="cert-cie10-code" class="input" placeholder="Ej: L20.9" autocomplete="off">
                            <small style="color:var(--text-muted); font-size:11px;">El autocompletado CIE-10 funciona automáticamente al teclear aquí.</small>
                        </div>
                        
                        <div class="cert-form-group">
                            <label>Restricciones / Limitaciones (Opcional)</label>
                            <input type="text" name="restrictions" class="input" placeholder="Ej: No realizar esfuerzo físico por 48h">
                        </div>
                        
                        <div class="cert-form-group">
                            <label>Observaciones Adicionales (Opcional)</label>
                            <textarea name="observations" class="input" rows="2" placeholder="Notas extra para la entidad receptora..."></textarea>
                        </div>
                        
                        <div class="cert-form-actions">
                            <button type="button" class="btn btn-secondary" id="cert-btn-cancel">Cancelar</button>
                            <button type="submit" class="btn btn-primary" id="cert-btn-submit">Generar PDF Oficial</button>
                        </div>
                    </form>
                </div>
                
                <!-- SUCCESS STATE STATE -->
                <div class="aurora-cert-modal-body cert-hidden" id="cert-success-container" style="text-align:center; padding: 2rem 1rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
                    <h3 style="margin-bottom: 0.5rem; color: var(--color-aurora-700);">Certificado Emitido</h3>
                    <p style="margin-bottom: 1.5rem; color: var(--text-muted);">Folio Oficial: <strong id="cert-success-folio" style="color:var(--text-primary); font-size:1.1rem;"></strong></p>
                    
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <button type="button" class="btn btn-primary" id="cert-btn-download" style="justify-content:center;">📄 Descargar PDF</button>
                        <button type="button" class="btn btn-secondary" id="cert-btn-whatsapp" style="justify-content:center; background:#25D366; color:#fff; border-color:#25D366;">💬 Enviar por WhatsApp</button>
                        <button type="button" class="btn" id="cert-btn-done" style="margin-top:1rem; border:none; background:transparent; text-decoration:underline;">Cerrar ventana</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalElement);
        bindEvents();
    }

    function bindEvents() {
        const modal = modalElement;
        const form = modal.querySelector('#cert-issue-form');
        const typeSelect = modal.querySelector('#cert-type-select');
        const restGroup = modal.querySelector('#cert-rest-days-group');
        const restInput = modal.querySelector('#cert-rest-days');
        
        const closeBtns = [
            modal.querySelector('.aurora-cert-close-btn'),
            modal.querySelector('#cert-btn-cancel'),
            modal.querySelector('#cert-btn-done')
        ];

        closeBtns.forEach(btn => btn?.addEventListener('click', close));

        // Toggle reposo field dependency
        typeSelect.addEventListener('change', () => {
            if (typeSelect.value === 'reposo_laboral' || typeSelect.value === 'incapacidad_temporal') {
                restGroup.style.display = 'block';
                restInput.required = true;
            } else {
                restGroup.style.display = 'none';
                restInput.required = false;
                restInput.value = '0';
            }
        });

        // Submit Logic
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = modal.querySelector('#cert-btn-submit');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Generando...';

            const formData = new FormData(form);
            const payload = Object.fromEntries(formData.entries());
            
            payload.rest_days = parseInt(payload.rest_days, 10) || 0;

            try {
                const res = await fetch('/api.php?resource=certificate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                
                if (!data.ok) throw new Error(data.error || 'Error desconocido al generar');

                // Mostrar success state
                modal.querySelector('#cert-form-container').classList.add('cert-hidden');
                modal.querySelector('#cert-success-container').classList.remove('cert-hidden');
                
                modal.querySelector('#cert-success-folio').textContent = data.folio;
                
                modal.querySelector('#cert-btn-download').onclick = () => window.open(data.pdf_url, '_blank');
                if (data.whatsapp_url) {
                    modal.querySelector('#cert-btn-whatsapp').onclick = () => window.open(data.whatsapp_url, '_blank');
                    modal.querySelector('#cert-btn-whatsapp').style.display = '';
                } else {
                    modal.querySelector('#cert-btn-whatsapp').style.display = 'none';
                }

                window.dispatchEvent(new CustomEvent('aurora:certificate-issued', {
                    detail: {
                        caseId: payload.case_id || '',
                        certificateId: data.certificate_id || '',
                        folio: data.folio || ''
                    }
                }));

            } catch (err) {
                alert('No se pudo generar el certificado: ' + err.message);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Generar PDF Oficial';
            }
        });
    }

    function close() {
        if (modalElement) {
            modalElement.classList.add('cert-hidden');
        }
    }

    // Public API
    window.openCertificateModal = function(caseId) {
        if (!caseId) {
            if(window.showToast) window.showToast('No hay caso activo para emitir certificado', 'error');
            return;
        }

        createModalDom();
        modalElement.querySelector('#cert-case-id').value = caseId;
        
        // Reset state si fue re-abierto
        modalElement.querySelector('#cert-form-container').classList.remove('cert-hidden');
        modalElement.querySelector('#cert-success-container').classList.add('cert-hidden');
        const submitBtn = modalElement.querySelector('#cert-btn-submit');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Generar PDF Oficial';
        modalElement.querySelector('#cert-btn-whatsapp').style.display = '';
        modalElement.querySelector('#cert-issue-form').reset();
        
        // Auto-llenar desde el diagnostico en la UI si existe
        const currentPrimaryCie10 = document.getElementById('clinician_cie10');
        if (currentPrimaryCie10 && currentPrimaryCie10.value) {
            modalElement.querySelector('#cert-cie10-code').value = currentPrimaryCie10.value.split('-')[0].trim();
            modalElement.querySelector('#cert-diagnosis-text').value = currentPrimaryCie10.value.includes('-') 
                ? currentPrimaryCie10.value.split('-')[1].trim()
                : '';
        }

        modalElement.classList.remove('cert-hidden');
    };

    // Inject CSS programmatically to avoid an extra network request for just 1 component
    const style = document.createElement('style');
    style.textContent = `
        .aurora-cert-modal-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px);
            z-index: 99999; display: flex; align-items: center; justify-content: center;
            opacity: 1; transition: opacity 0.2s;
        }
        .aurora-cert-modal-overlay.cert-hidden {
            opacity: 0; pointer-events: none;
        }
        .aurora-cert-modal {
            background: var(--bg-primary, #fff); width: 100%; max-width: 500px;
            border-radius: var(--radius-xl, 12px); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
            overflow: hidden; transform: scale(1); transition: transform 0.2s;
        }
        .cert-hidden .aurora-cert-modal { transform: scale(0.95); }
        
        .aurora-cert-modal-header {
            padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color, #e5e7eb);
            display: flex; justify-content: space-between; align-items: center;
            background: var(--bg-secondary, #f8fafc);
        }
        .aurora-cert-close-btn {
            background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);
        }
        .aurora-cert-close-btn:hover { color: var(--color-red-600); }
        
        .aurora-cert-modal-body { padding: 1.5rem; }
        .cert-form-group { margin-bottom: 1.25rem; }
        .cert-form-group label {
            display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem;
        }
        .cert-form-actions {
            margin-top: 2rem; display: flex; justify-content: flex-end; gap: 10px;
        }
        .cert-hidden { display: none !important; }
    `;
    document.head.appendChild(style);
})();
