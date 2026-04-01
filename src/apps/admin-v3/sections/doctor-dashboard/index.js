export function renderDoctorDashboardSection() {
    return `
    <section id="section-doctor-dashboard" class="admin-v3-section" hidden>
        <div class="admin-v3-section__header" style="margin-bottom: 32px;">
            <div class="admin-v3-section__title">
                <h2>Doctor Dashboard</h2>
                <p>Monitor Clínico en Tiempo Real (Liquid Glass)</p>
            </div>
        </div>
        
        <style>
            .bento-doctor-grid {
                display: grid;
                grid-template-columns: repeat(12, 1fr);
                gap: 20px;
                max-width: 1400px;
            }
            .bento-doctor {
                backdrop-filter: blur(16px);
                border-radius: 24px;
                padding: 24px;
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.05);
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                position: relative;
                overflow: hidden;
            }
            
            /* Crisis Card - (1) */
            .crisis-card {
                grid-column: span 8;
                background: linear-gradient(135deg, rgba(220, 38, 38, 0.15), rgba(15, 23, 42, 0.6));
                border-color: rgba(220, 38, 38, 0.3);
            }
            .vital-alert-pulse {
                position: absolute;
                top: 24px;
                right: 24px;
                width: 12px;
                height: 12px;
                background: #ef4444;
                border-radius: 50%;
                box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
                animation: pulse-red 2s infinite;
            }
            @keyframes pulse-red {
                0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                70% { transform: scale(1); box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
                100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
            }

            /* Labs Card - (2) */
            .labs-card {
                grid-column: span 4;
                background: linear-gradient(135deg, rgba(217, 119, 6, 0.15), rgba(15, 23, 42, 0.6));
                border-color: rgba(217, 119, 6, 0.3);
            }
            
            /* Chronic Card - (3) */
            .chronic-card {
                grid-column: span 4;
                background: linear-gradient(135deg, rgba(30, 58, 138, 0.15), rgba(15, 23, 42, 0.6));
                border-color: rgba(30, 58, 138, 0.3);
            }
            
            /* Telemed Card - (4) */
            .telemed-card {
                grid-column: span 4;
                background: linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(15, 23, 42, 0.6));
                border-color: rgba(6, 182, 212, 0.3);
            }

            /* Agenda Card - (5) */
            .agenda-card {
                grid-column: span 4;
                background: rgba(15, 23, 42, 0.4);
                grid-row: span 2;
            }

            /* Typography & utils */
            .bento-num {
                font-family: var(--font-display, inherit);
                font-size: 3rem;
                font-weight: 700;
                line-height: 1;
                margin-top: 16px;
                display: block;
            }
            .bento-num.amber { color: #fbbf24; }
            .bento-num.cyan { color: #22d3ee; }
            .bento-num.red { color: #f87171; }
            
            .bento-label {
                text-transform: uppercase;
                letter-spacing: 0.1em;
                font-size: 0.75rem;
                font-weight: 600;
                color: rgba(255,255,255,0.6);
            }
            
            .bento-title {
                margin: 4px 0 0 0;
                font-size: 1.25rem;
                font-weight: 600;
                color: white;
            }
        </style>

        <div class="bento-doctor-grid">
            <!-- 1. Crisis P.A. -->
            <article class="bento-doctor crisis-card">
                <div class="vital-alert-pulse"></div>
                <span class="bento-label" style="color:#ef4444;">Alerta Vital Hoy</span>
                <h3 class="bento-title">Crisis detectada</h3>
                <div style="margin-top:24px;">
                    <span style="font-size:1.1rem; color:rgba(255,255,255,0.7);">Paciente: <strong>Esteban Quiroz</strong></span><br>
                    <span class="bento-num red">185/110 <small style="font-size:1rem;">mmHg</small></span>
                    <button class="rb-btn-action" style="margin-top:16px; background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); padding:8px 16px; border-radius:999px; color:#f87171; font-weight:600; cursor:pointer;">Atender Emergencia</button>
                </div>
            </article>

            <!-- 2. Labs Críticos -->
            <article class="bento-doctor labs-card">
                <span class="bento-label">Labs Pendientes</span>
                <h3 class="bento-title">Resultados Críticos</h3>
                <span class="bento-num amber">3</span>
                <p style="margin-top:12px; font-size:0.9rem; color:rgba(255,255,255,0.6);">Exámenes de patología y biopsias urgentes requieren revisión.</p>
            </article>

            <!-- 3. Crónicos atrasados -->
            <article class="bento-doctor chronic-card">
                <span class="bento-label">Seguimiento Clínico</span>
                <h3 class="bento-title">Crónicos en Desacato</h3>
                <span class="bento-num" style="color:#93c5fd;">12</span>
                <p style="margin-top:12px; font-size:0.9rem; color:rgba(255,255,255,0.6);">Pacientes con más de 90 días sin control de Roacután/Psoriasis.</p>
            </article>

            <!-- 4. Teleconsultas abiertas -->
            <article class="bento-doctor telemed-card">
                <span class="bento-label">Portal Digital</span>
                <h3 class="bento-title">Telemedicina Abierta</h3>
                <span class="bento-num cyan">5</span>
                <p style="margin-top:12px; font-size:0.9rem; color:rgba(255,255,255,0.6);">Mensajes de pacientes VIP y salas de espera virtuales activas.</p>
            </article>

            <!-- 5. Citas del día -->
            <article class="bento-doctor agenda-card">
                <span class="bento-label">Agenda Diaria</span>
                <h3 class="bento-title">Próximos Turnos</h3>
                <div style="margin-top:16px; display:flex; flex-direction:column; gap:12px;">
                    
                    <div style="display:flex; gap:12px; align-items:flex-start; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.05);">
                        <strong style="color:#fbbf24;">10:00</strong>
                        <div>
                            <span style="display:block; font-weight:600;">María Augusta Silva</span>
                            <span style="font-size:0.8rem; color:rgba(255,255,255,0.5);">Chequeo de Lunares (Dermatoscopia)</span>
                        </div>
                    </div>
                    
                    <div style="display:flex; gap:12px; align-items:flex-start; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.05);">
                        <strong style="color:var(--rb-accent, #c7a36d);">10:30</strong>
                        <div>
                            <span style="display:block; font-weight:600;">Jorge Viteri</span>
                            <span style="font-size:0.8rem; color:rgba(255,255,255,0.5);">Primera Consulta (Acné Severo)</span>
                        </div>
                    </div>

                    <div style="display:flex; gap:12px; align-items:flex-start;">
                        <strong style="color:rgba(255,255,255,0.4);">11:00</strong>
                        <div>
                            <span style="display:block; font-weight:600;">Carla Espinosa</span>
                            <span style="font-size:0.8rem; color:rgba(255,255,255,0.5);">Control Rosácea</span>
                        </div>
                    </div>
                    
                </div>
            </article>

        </div>
    </section>
    `;
}
