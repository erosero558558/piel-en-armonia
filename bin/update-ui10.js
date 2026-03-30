const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const htmlPath = path.join(rootDir, 'admin.html');
const cssPath = path.join(rootDir, 'styles', 'aurora-admin.css');

// 1. Apendizar a aurora-admin.css el CSS de UI-10 (Dashboard Bento Grid, KPIs, Timeline)
const dashboardCss = `
/* ==========================================================================
   Dashboard UI-10 (Bento Grid & Analytics)
   ========================================================================== */

.dashboard-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 1400px;
  margin: 0 auto;
}

/* KPI Top Row */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

.kpi-card {
  background: var(--admin-bg-surface);
  border: 1px solid var(--admin-border);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-2);
  transition: transform var(--transition-fast), border-color var(--transition-fast);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.kpi-card:hover {
  transform: translateY(-4px);
  border-color: var(--color-aurora-500);
}

.kpi-card .kpi-title {
  font-size: var(--text-sm);
  color: var(--admin-text-muted);
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.kpi-card .kpi-value {
  font-family: var(--font-display);
  font-size: var(--text-4xl);
  color: var(--admin-text-primary);
  line-height: 1;
}

.kpi-card .kpi-meta {
  font-size: var(--text-xs);
  color: var(--color-green-400);
  background: rgba(74, 222, 128, 0.1);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  display: inline-block;
  align-self: flex-start;
}

.kpi-card.warn .kpi-meta {
  color: var(--color-gold-400);
  background: rgba(250, 204, 21, 0.1);
}

/* Bento Layout */
.bento-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-6);
}

@media (max-width: 1024px) {
  .bento-grid {
    grid-template-columns: 1fr;
  }
}

.bento-card {
  background: var(--admin-bg-surface);
  border: 1px solid var(--admin-border);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.bento-card-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--admin-text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Chart Resizing Override */
.chart-container {
  flex: 1;
  position: relative;
  min-height: 250px;
  width: 100%;
}
.chart-container canvas {
  width: 100% !important;
  height: 100% !important;
}

/* Agenda Timeline */
.agenda-timeline {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  position: relative;
  padding-left: var(--space-6);
}

.agenda-timeline::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 11px;
  width: 2px;
  background: var(--admin-border);
  border-radius: 2px;
}

.timeline-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: -24px;
  top: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--admin-bg-surface);
  border: 2px solid var(--color-aurora-500);
  z-index: 1;
}

.timeline-item.past::before {
  border-color: var(--admin-text-muted);
  background: var(--admin-text-muted);
}
.timeline-item.active::before {
  border-color: var(--color-gold-400);
  box-shadow: 0 0 10px rgba(250, 204, 21, 0.4);
}

.timeline-time {
  font-size: var(--text-xs);
  color: var(--admin-text-muted);
  font-weight: 600;
}

.timeline-content {
  background: rgba(255, 255, 255, 0.03);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--admin-border);
  color: var(--admin-text-primary);
  font-size: var(--text-sm);
}

/* Quick Actions Grid */
.quick-actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.quick-action-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--admin-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  color: var(--admin-text-primary);
  font-size: var(--text-xs);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.quick-action-btn svg {
  width: 24px;
  height: 24px;
  stroke: var(--color-aurora-400);
  fill: none;
  transition: transform var(--transition-fast);
}

.quick-action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--color-aurora-500);
}
.quick-action-btn:hover svg {
  transform: scale(1.1);
}
`;

let currentCss = fs.readFileSync(cssPath, 'utf8');
if (!currentCss.includes('Dashboard UI-10')) {
  fs.writeFileSync(cssPath, currentCss + '\\n' + dashboardCss, 'utf8');
}

// 2. Modificar admin.html
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

const dashboardSectionRegex = /<section[^>]*?id="dashboard"[^>]*?>([\\s\\S]*?)<\\/section>/;
const newDashboardHTML = `
                <section id="dashboard" class="admin-section" data-admin-raw-section="dashboard">
                    <div class="dashboard-wrapper">
                        
                        <header data-turnero-control-room="raw" style="margin-bottom: var(--space-4); padding-bottom: 0; border: none;">
                            <p>Centro de Comando</p>
                            <h3>Estación de Trabajo Activa</h3>
                        </header>

                        <!-- 4 KPI Cards -->
                        <div class="kpi-row">
                            <article class="kpi-card">
                                <div class="kpi-title">
                                    <span>Citas Hoy</span>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
                                </div>
                                <div class="kpi-value">24</div>
                                <div class="kpi-meta">+12% vs ayer</div>
                            </article>
                            <article class="kpi-card">
                                <div class="kpi-title">
                                    <span>Pacientes Activos</span>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                                </div>
                                <div class="kpi-value">1,280</div>
                                <div class="kpi-meta">+4 esta semana</div>
                            </article>
                            <article class="kpi-card warn">
                                <div class="kpi-title">
                                    <span>Turnos en Espera</span>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                                </div>
                                <div class="kpi-value">4</div>
                                <div class="kpi-meta" id="dashboardPushStatus" data-state="neutral">Push Pendiente</div>
                            </article>
                            <article class="kpi-card warn">
                                <div class="kpi-title">
                                    <span>Alertas Clínicas</span>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                </div>
                                <div class="kpi-value" style="color: var(--color-gold-400);">2</div>
                                <div class="kpi-meta" id="dashboardPushMeta">Requiere revisión médica</div>
                            </article>
                        </div>

                        <!-- Bento Grid -->
                        <div class="bento-grid">
                            
                            <!-- Left Stack: Charts (Preserving canvas ids logic) -->
                            <div style="display: flex; flex-direction: column; gap: var(--space-6);">
                                <article class="bento-card">
                                    <div class="bento-card-title">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
                                        Tiempo de Espera Promedio (ms)
                                    </div>
                                    <div class="chart-container">
                                        <canvas id="waitTimeChart"></canvas>
                                    </div>
                                </article>
                                
                                <article class="bento-card">
                                    <div class="bento-card-title">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                                        Throughput / Hora (Turnos Completados)
                                    </div>
                                    <div class="chart-container">
                                        <canvas id="throughputChart"></canvas>
                                    </div>
                                </article>
                            </div>

                            <!-- Right Stack: Actions & Timeline -->
                            <div style="display: flex; flex-direction: column; gap: var(--space-6);">
                                
                                <article class="bento-card">
                                    <div class="bento-card-title">Accesos Rápidos</div>
                                    <div class="quick-actions-grid">
                                        <button class="quick-action-btn">
                                            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                            Nueva Cita
                                        </button>
                                        <button class="quick-action-btn">
                                            <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                                            HCE Reciente
                                        </button>
                                        <button class="quick-action-btn" style="grid-column: span 2; border-color: var(--color-aurora-500); background: rgba(106, 126, 150, 0.1);">
                                            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                                            Invocar OpenClaw IA
                                        </button>
                                    </div>
                                </article>

                                <article class="bento-card" style="flex: 1;">
                                    <div class="bento-card-title">Agenda Próxima</div>
                                    <div class="agenda-timeline">
                                        <div class="timeline-item past">
                                            <div class="timeline-time">09:00 AM</div>
                                            <div class="timeline-content">Maria Viteri - Limpieza Facial</div>
                                        </div>
                                        <div class="timeline-item past">
                                            <div class="timeline-time">09:30 AM</div>
                                            <div class="timeline-content">Carlos Ruiz - Consulta Inicial</div>
                                        </div>
                                        <div class="timeline-item active">
                                            <div class="timeline-time">10:00 AM (Ahora)</div>
                                            <div class="timeline-content" style="border-color: var(--color-gold-400);">
                                                <strong>Juan Almeida</strong><br>
                                                Láser CO2 Fraccionado
                                            </div>
                                        </div>
                                        <div class="timeline-item">
                                            <div class="timeline-time">10:45 AM</div>
                                            <div class="timeline-content">Lucia Saenz - Revisión Acné</div>
                                        </div>
                                    </div>
                                </article>

                            </div>

                        </div>
                    </div>
                </section>`;

if (dashboardSectionRegex.test(htmlContent)) {
  htmlContent = htmlContent.replace(dashboardSectionRegex, newDashboardHTML);
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log('UI-10: admin.html patched successfully.');
} else {
  console.log('UI-10: section#dashboard not found or already patched.');
}
