export function openLabManualDrawer(caseId, patientId, availableOrders) {
    let drawer = document.getElementById('lab-manual-drawer');
    if (!drawer) {
        drawer = document.createElement('div');
        drawer.id = 'lab-manual-drawer';
        // Base glass styles for Admin V3
        drawer.style.position = 'fixed';
        drawer.style.top = '0';
        drawer.style.right = '0';
        drawer.style.bottom = '0';
        drawer.style.width = '420px';
        drawer.style.background = 'var(--rb-surface, rgba(15, 23, 42, 0.85))';
        drawer.style.backdropFilter = 'blur(20px)';
        drawer.style.borderLeft = '1px solid var(--border-color, rgba(255, 255, 255, 0.1))';
        drawer.style.boxShadow = '-10px 0 40px rgba(0,0,0,0.6)';
        drawer.style.zIndex = '9999';
        drawer.style.padding = '32px 24px';
        drawer.style.color = 'var(--text-color, #fff)';
        drawer.style.transition = 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
        drawer.style.transform = 'translateX(100%)';
        drawer.style.display = 'flex';
        drawer.style.flexDirection = 'column';
        drawer.style.gap = '24px';
        drawer.style.boxSizing = 'border-box';
        drawer.style.overflowY = 'auto';

        drawer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h2 style="margin:0; font-size:1.4rem; color:var(--text-color);">Ingreso de Resultados</h2>
                <button type="button" class="btn-close-drawer" style="background:transparent; border:none; color:var(--text-color); cursor:pointer; padding:8px;" aria-label="Cerrar panel">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            
            <p style="margin:0; color:var(--text-muted, #94a3b8); font-size:0.9rem;">
                Digita los valores recibidos o adjunta un extracto de laboratorio para guardar la trazabilidad clínica de la orden seleccionada.
            </p>

            <form id="lab-result-submit" style="display:flex; flex-direction:column; gap:20px; flex:1;">
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <label style="font-size:0.85rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted, #94a3b8);">Orden Médica Previa</label>
                    <select name="orderId" class="admin-input form-control" style="width:100%; padding:10px; border-radius:8px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#fff;">
                        <option value="">-- Sin orden asignada --</option>
                    </select>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <label style="font-size:0.85rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted, #94a3b8);">Valor Registrado</label>
                        <input type="text" name="value" class="admin-input form-control" required placeholder="Ej. 110" style="width:100%; padding:10px; border-radius:8px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#fff;">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <label style="font-size:0.85rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted, #94a3b8);">Unidad</label>
                        <input type="text" name="unit" class="admin-input form-control" placeholder="mg/dL, UI, etc." style="width:100%; padding:10px; border-radius:8px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#fff;">
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:8px;">
                    <label style="font-size:0.85rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted, #94a3b8);">Valores de Referencia</label>
                    <input type="text" name="reference" class="admin-input form-control" placeholder="Ej. 70 - 100 mg/dL" style="width:100%; padding:10px; border-radius:8px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#fff;">
                </div>

                <div style="display:flex; flex-direction:column; gap:8px;">
                    <label style="font-size:0.85rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted, #94a3b8);">Estado Clínico</label>
                    <select name="status" class="admin-input form-control" id="lab-status-toggle" style="width:100%; padding:10px; border-radius:8px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#fff;">
                        <option value="normal" style="color:black;">Normal (Dentro del rango)</option>
                        <option value="elevated" style="color:black;">Elevado / Anormal</option>
                        <option value="critical" style="color:red; font-weight:bold;">Estado Crítico 🔴</option>
                    </select>
                </div>

                <div style="display:flex; flex-direction:column; gap:8px;">
                    <label style="font-size:0.85rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted, #94a3b8);">Notas del Revisor</label>
                    <textarea name="notes" class="admin-input form-control" rows="3" placeholder="Observaciones adicionales sobre este resultado..." style="width:100%; padding:10px; border-radius:8px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#fff; resize:vertical;"></textarea>
                </div>

                <div style="display:flex; align-items:center; gap:12px; margin-top:8px;">
                    <input type="checkbox" name="shareWithPatient" id="labSharePac" checked style="width:20px; height:20px; accent-color:var(--rb-accent, #c9a96e);">
                    <label for="labSharePac" style="font-size:0.95rem; cursor:pointer;">Compartir con el paciente ahora</label>
                </div>

                <div style="margin-top:auto; display:flex; justify-content:flex-end; gap:12px;">
                    <button type="button" class="btn-close-drawer btn btn-secondary" style="padding:12px 24px; border-radius:999px; cursor:pointer; background:rgba(255,255,255,0.1); border:none; color:#fff;">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="padding:12px 24px; border-radius:999px; cursor:pointer; background:var(--rb-accent, #c9a96e); border:none; color:#000; font-weight:600;">Guardar Resultado</button>
                </div>
            </form>
        `;

        document.body.appendChild(drawer);

        // Bind Events
        const closeBtns = drawer.querySelectorAll('.btn-close-drawer');
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                drawer.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    drawer.style.display = 'none';
                }, 350);
            });
        });

        const form = drawer.querySelector('#lab-result-submit');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Guardando...';

            const fd = new FormData(form);
            const status = fd.get('status');

            const payload = {
                caseId,
                patientId,
                orderId: fd.get('orderId'),
                value: fd.get('value'),
                unit: fd.get('unit'),
                reference: fd.get('reference'),
                status,
                notes: fd.get('notes'),
                shareWithPatient: fd.get('shareWithPatient') === 'on'
            };

            // Play Critical Sound if selected
            if (status === 'critical') {
                try {
                    const audio = new Audio('/sfx/alert-critical.mp3');
                    audio.className = 'critical-alert-sound';
                    audio.volume = 0.8;
                    const playPromise = audio.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(error => {
                            console.warn('Autoplay blocked for critical alert sound', error);
                        });
                    }
                } catch (err) {
                    console.warn('Error playing critical alert sound', err);
                }
            }

            try {
                const res = await window.fetch('/api.php?resource=receive-lab-result', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': 'Bearer ' + String(window.adminToken || '')
                    },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) throw new Error('Network error');
                
                const data = await res.json();
                if (data.ok) {
                    // Close drawer securely
                    drawer.style.transform = 'translateX(100%)';
                    setTimeout(() => {
                        drawer.style.display = 'none';
                        // Force UI refresh on history if method available
                        if (window.AuroraDerm && typeof window.AuroraDerm.refreshClinicalHistoryCurrentSession === 'function') {
                            window.AuroraDerm.refreshClinicalHistoryCurrentSession();
                        }
                    }, 350);
                } else {
                    alert('Error al guardar: ' + (data.error || 'Server error'));
                }
            } catch (err) {
                console.error('Error post lab result:', err);
                alert('No se pudo comunicar con el servidor para guardar el resultado.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Guardar Resultado';
            }
        });
    }

    // Reset and Populate
    drawer.style.display = 'flex';
    
    // Force reflow for animation
    void drawer.offsetWidth;
    drawer.style.transform = 'translateX(0)';

    const select = drawer.querySelector('select[name="orderId"]');
    select.innerHTML = '<option value="">-- Sin orden asignada (Ingreso libre) --</option>';
    
    if (Array.isArray(availableOrders) && availableOrders.length > 0) {
        availableOrders.forEach(ord => {
            const opt = document.createElement('option');
            opt.value = ord.id;
            opt.textContent = String(ord.name || ord.labName || `Orden ${ord.id}`);
            select.appendChild(opt);
        });
    }

    const valueInput = drawer.querySelector('input[name="value"]');
    if (valueInput) valueInput.focus();
}
