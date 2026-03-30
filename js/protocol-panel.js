/**
 * Protocol Panel - Slide-in para asistir la decisión clínica post-diagnóstico.
 */
(function() {
    let panelElement = null;

    function ensurePanel() {
        if (!panelElement) {
            panelElement = document.createElement('div');
            panelElement.className = 'protocol-panel-slide-in protocol-hidden';
            document.body.appendChild(panelElement);
        }
        return panelElement;
    }

    window.openProtocolPanel = async function(cie10Code) {
        if (!cie10Code) return;
        
        const panel = ensurePanel();
        panel.innerHTML = `
            <div class="protocol-panel-header">
                <div>
                    <h3 style="margin:0; font-family:var(--font-display); font-size:var(--text-lg);">Protocolo</h3>
                    <span class="protocol-badge">${cie10Code}</span>
                </div>
                <button class="protocol-close-btn">&times;</button>
            </div>
            <div class="protocol-panel-body" id="protocol-panel-loader">
                <div class="skeleton" style="height:20px; width:60%; margin-bottom:12px;"></div>
                <div class="skeleton" style="height:40px; width:100%; margin-bottom:12px;"></div>
                <div class="skeleton" style="height:40px; width:100%;"></div>
            </div>
        `;
        
        panel.classList.remove('protocol-hidden');
        
        panel.querySelector('.protocol-close-btn').addEventListener('click', () => {
            panel.classList.add('protocol-hidden');
        });
        
        try {
            const res = await fetch('/api.php?resource=openclaw-protocol&code=' + encodeURIComponent(cie10Code));
            const data = await res.json();
            
            if (!data.ok) throw new Error(data.error || 'Error al obtener protocolo');
            
            renderData(data, panel.querySelector('.protocol-panel-body'));
        } catch(err) {
            panel.querySelector('.protocol-panel-body').innerHTML = `
                <div style="padding:1rem;color:var(--color-red-600);background:var(--color-red-50);border-radius:4px;">
                    Error: ${err.message}
                </div>`;
        }
    };
    
    function renderData(data, container) {
        let medsHtml = '';
        if (data.first_line && data.first_line.length > 0) {
            data.first_line.forEach(m => {
                const rxText = `${m.medication}. Dosis: ${m.dose}. Duración: ${m.duration}.`;
                medsHtml += `
                    <div class="protocol-med-card">
                        <div class="protocol-med-info">
                            <strong>${m.medication}</strong>
                            <span>${m.dose} &middot; ${m.duration}</span>
                        </div>
                        <button type="button" class="btn protocol-add-rx-btn" data-rx="${escapeHtml(rxText)}">+ a plan</button>
                    </div>
                `;
            });
        } else {
            medsHtml = '<p style="color:var(--text-muted); font-size:small;">No hay tratamiento de primera línea disponible.</p>';
        }
        
        let altHtml = '';
        if (data.alternatives && data.alternatives.length > 0) {
            altHtml = `<ul style="font-size:0.875rem; margin-top:4px; padding-left:20px; color:var(--text-secondary);">
                ${data.alternatives.map(a => `<li>${a}</li>`).join('')}
            </ul>`;
        }
        
        const followUp = data.follow_up || '';
        const instructions = data.patient_instructions || '';
        const referal = data.referral_criteria || '';
        
        container.innerHTML = `
            <div class="protocol-section">
                <h4>Primera Línea</h4>
                ${medsHtml}
            </div>
            
            ${altHtml ? `<div class="protocol-section"><h4>Alternativas</h4>${altHtml}</div>` : ''}
            
            <div class="protocol-section">
                <h4>Instrucciones para el Paciente</h4>
                <p style="font-size:0.875rem; color:var(--text-secondary);">${instructions || '-'}</p>
            </div>
            
            <div class="protocol-section" style="font-size:0.875rem;">
                <p><strong>Seguimiento:</strong> ${followUp || '-'}</p>
                <p><strong>Criterios de Derivación:</strong> ${referal || '-'}</p>
            </div>
            
            <div style="margin-top:24px;">
                <button type="button" class="btn btn-primary" style="width:100%; justify-content:center;" id="protocol-accept-all-btn">
                    Cargar Protocolo a Historia Clínica
                </button>
            </div>
            <p style="text-align:center; font-size:11px; margin-top:12px; color:var(--text-muted);">
                Generado por Aurora AI. Verifique el tratamiento.
            </p>
        `;
        
        container.querySelectorAll('.protocol-add-rx-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const rx = e.target.dataset.rx;
                const ta = document.getElementById('hcu005_therapeutic_plan') || document.getElementById('clinician_cie10');
                if (ta) {
                    ta.value = ta.value ? ta.value + '\n- ' + rx : '- ' + rx;
                    ta.dispatchEvent(new Event('input', {bubbles:true}));
                    if (window.showToast) window.showToast('Agregado a Plan Terapéutico', 'success');
                }
            });
        });
        
        const acceptBtn = container.querySelector('#protocol-accept-all-btn');
        if (acceptBtn) {
            acceptBtn.addEventListener('click', () => {
                const taPlan = document.getElementById('hcu005_therapeutic_plan');
                const taInst = document.getElementById('hcu005_care_indications');
                
                let added = false;
                if (taInst && instructions) {
                    taInst.value = taInst.value ? taInst.value + '\n\n' + instructions : instructions;
                    taInst.dispatchEvent(new Event('input', {bubbles:true}));
                    added = true;
                }
                if (taPlan && data.first_line && data.first_line.length > 0) {
                    let rxBlock = data.first_line.map(m => `- ${m.medication} (${m.dose}, ${m.duration})`).join('\n');
                    taPlan.value = taPlan.value ? taPlan.value + '\n' + rxBlock : rxBlock;
                    taPlan.dispatchEvent(new Event('input', {bubbles:true}));
                    added = true;
                }
                
                if (added && window.showToast) window.showToast('Protocolo transferido exitosamente', 'success');
                panelElement.classList.add('protocol-hidden');
            });
        }
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag])
        );
    }
})();
