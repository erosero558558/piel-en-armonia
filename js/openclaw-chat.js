/**
 * OpenClaw Chat — Interfaz de consulta médica con IA
 *
 * La pantalla principal de la consulta clínica.
 * El médico habla con OpenClaw como ChatGPT, pero OpenClaw ya sabe quién es el paciente.
 *
 * Arquitectura:
 *   - Izquierda: chat con IA (foto, voz, texto)
 *   - Derecha: contexto del paciente (cargado automáticamente)
 *   - Inferior: acciones sugeridas por la IA (un click llena la HCE)
 *
 * Uso:
 *   <script src="/js/openclaw-chat.js"></script>
 *   <div id="openclaw-chat" data-patient-id="123" data-case-id="456"></div>
 *   OpenclawChat.mount('#openclaw-chat');
 */

const OpenclawChat = (() => {

  // ── Configuration ───────────────────────────────────────────────────────────

  const CONFIG = {
    apiBase: '/api/openclaw',
    interactionApiBase: '/api.php?resource=openclaw-interactions',
    streamTimeout: 30000,
    maxPhotoSizeMb: 10,
    voiceLanguage: 'es-EC',
    systemPrompt: `Eres OpenClaw, copiloto clínico de Aurora Derm.
Eres un asistente médico especializado en dermatología.
SIEMPRE respondes en español, con lenguaje clínico pero claro.
Cuando sugiereas un diagnóstico, incluye el código CIE-10.
Cuando sugiereas tratamiento, menciona medicamentos con dosis y duración.
El médico tiene 7 minutos por consulta. Sé conciso y preciso.
NUNCA reemplazas el criterio clínico del médico. Siempre confirmas.
Contexto del paciente se te dará como sistema de contexto.`,
  };

  // ── State ────────────────────────────────────────────────────────────────────

  let state = {
    patientId: null,
    caseId: null,
    messages: [],
    patientContext: null,
    isStreaming: false,
    isRecording: false,
    pendingActions: [],
    recognition: null,
  };

  // ── Templates ────────────────────────────────────────────────────────────────

  function renderShell() {
    return `
    <div class="oc-shell">
      <!-- Header -->
      <div class="oc-header">
        <div class="oc-header-left">
          <div class="oc-logo">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="9" stroke="var(--oc-accent)" stroke-width="1.5"/>
              <path d="M6 10 C6 7 14 7 14 10 C14 13 6 13 6 10Z" fill="var(--oc-accent)" opacity="0.3"/>
              <circle cx="10" cy="10" r="2" fill="var(--oc-accent)"/>
            </svg>
            OpenClaw
          </div>
          <span class="oc-status" id="oc-status">listo</span>
        </div>
        <div class="oc-header-right">
          <span class="oc-runtime-badge" id="oc-offline-badge" hidden></span>
          <button class="oc-btn-icon" id="oc-new-session" title="Nueva consulta">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          <button class="oc-btn-icon" id="oc-close-session" title="Cerrar consulta">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Main layout -->
      <div class="oc-layout">

        <!-- Chat panel -->
        <div class="oc-chat-panel">
          <div class="oc-messages" id="oc-messages">
            <div class="oc-welcome">
              <div class="oc-welcome-icon">🩺</div>
              <p>Paciente cargado. Describe el motivo de consulta, sube una foto, o pregunta lo que necesites.</p>
            </div>
          </div>

          <!-- Pending actions bar -->
          <div class="oc-actions-bar" id="oc-actions-bar" style="display:none">
            <span class="oc-actions-label">Aplicar a la historia clínica:</span>
            <div class="oc-actions-row" id="oc-actions-row"></div>
          </div>

          <div class="oc-alert-banner" id="oc-interaction-banner" data-tone="warning" style="display:none"></div>

          <!-- Input area -->
          <div class="oc-input-area">
            <div class="oc-input-row">
              <button class="oc-btn-icon oc-photo-btn" id="oc-photo-btn" title="Subir foto clínica">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="2" y="4" width="14" height="11" rx="2" stroke="currentColor" stroke-width="1.4"/>
                  <circle cx="9" cy="10" r="2.5" stroke="currentColor" stroke-width="1.4"/>
                  <path d="M6 4V3a1 1 0 011-1h4a1 1 0 011 1v1" stroke="currentColor" stroke-width="1.4"/>
                </svg>
              </button>
              <input type="file" id="oc-photo-input" accept="image/*" capture="environment" style="display:none">

              <textarea
                id="oc-input"
                class="oc-textarea"
                placeholder="Escribe el motivo de consulta, pregunta sobre el diagnóstico, pide una receta..."
                rows="1"
                maxlength="2000"
              ></textarea>

              <button class="oc-btn-icon oc-voice-btn" id="oc-voice-btn" title="Dictado por voz">
                <svg id="oc-mic-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="6" y="2" width="6" height="9" rx="3" stroke="currentColor" stroke-width="1.4"/>
                  <path d="M3 9a6 6 0 0012 0M9 15v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                </svg>
              </button>

              <button class="oc-send-btn" id="oc-send-btn" title="Enviar (Enter)">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M16 2L2 9l6 2 2 6 6-15z" fill="currentColor"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Context panel -->
        <div class="oc-context-panel" id="oc-context-panel">
          <div class="oc-context-header">Contexto del paciente</div>
          <div class="oc-context-body" id="oc-context-body">
            <div class="oc-loading-context">Cargando...</div>
          </div>
        </div>

      </div>
    </div>
    `;
  }

  function renderMessageBubble(msg) {
    const isDoctor = msg.role === 'user';
    const time = new Date(msg.ts).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    return `
    <div class="oc-msg ${isDoctor ? 'oc-msg-doctor' : 'oc-msg-ai'}" data-id="${msg.id}">
      ${!isDoctor ? '<div class="oc-msg-avatar">🤖</div>' : ''}
      <div class="oc-msg-content">
        ${msg.photo ? `<img src="${msg.photo}" class="oc-msg-photo" alt="Foto clínica">` : ''}
        <div class="oc-msg-text">${formatMarkdown(msg.content)}</div>
        ${msg.actions && msg.actions.length ? renderInlineActions(msg.actions, msg.id) : ''}
        <div class="oc-msg-time">${time}</div>
      </div>
      ${isDoctor ? '<div class="oc-msg-avatar oc-msg-avatar-dr">Dr.</div>' : ''}
    </div>`;
  }

  function renderInlineActions(actions, msgId) {
    return `
    <div class="oc-inline-actions">
      ${actions.map(a => `
        <button class="oc-action-chip" data-action="${a.type}" data-msg-id="${msgId}" data-value='${JSON.stringify(a.value)}'>
          ${a.icon} ${a.label}
        </button>
      `).join('')}
    </div>`;
  }

  function renderPatientContext(ctx) {
    if (!ctx) return '<div class="oc-no-context">Sin contexto cargado.</div>';
    return `
    <div class="oc-patient-card">
      <div class="oc-patient-name">${ctx.name || 'Paciente'}</div>
      <div class="oc-patient-info">
        <span>${ctx.age || '--'} años</span>
        <span>${ctx.sex === 'F' ? '♀ Femenino' : ctx.sex === 'M' ? '♂ Masculino' : '--'}</span>
      </div>
    </div>

    ${ctx.lastDx ? `
    <div class="oc-context-section">
      <div class="oc-context-section-title">Diagnóstico anterior</div>
      <div class="oc-context-section-body">${ctx.lastDx.code} — ${ctx.lastDx.description}</div>
      <div class="oc-context-section-meta">${ctx.lastDx.date}</div>
    </div>` : ''}

    ${ctx.medications && ctx.medications.length ? `
    <div class="oc-context-section">
      <div class="oc-context-section-title">Medicamentos activos</div>
      ${ctx.medications.map(m => `<div class="oc-context-item">💊 ${m.name} ${m.dose}</div>`).join('')}
    </div>` : ''}

    ${ctx.allergies && ctx.allergies.length ? `
    <div class="oc-context-section oc-context-alert">
      <div class="oc-context-section-title">⚠️ Alergias</div>
      ${ctx.allergies.map(a => `<div class="oc-context-item">${a}</div>`).join('')}
    </div>` : ''}

    ${ctx.lastVisitSummary ? `
    <div class="oc-context-section">
      <div class="oc-context-section-title">Última visita — resumen IA</div>
      <div class="oc-context-section-body oc-context-summary">${ctx.lastVisitSummary}</div>
    </div>` : ''}

    <div class="oc-context-section">
      <div class="oc-context-section-title">Historial de consultas</div>
      ${(ctx.visits || []).slice(0, 3).map(v => `
        <div class="oc-context-item">
          <span class="oc-context-date">${v.date}</span>
          <span>${v.reason}</span>
        </div>`).join('') || '<div class="oc-context-item">Sin visitas previas</div>'}
    </div>`;
  }

  // ── Markdown formatter (minimal) ─────────────────────────────────────────────

  function formatMarkdown(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^(.+)$/, '<p>$1</p>');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeMedicationEntry(entry) {
    if (typeof entry === 'string') {
      const label = entry.trim();
      return label ? { name: label, dose: '' } : null;
    }

    if (!entry || typeof entry !== 'object') return null;

    const name = String(entry.name || entry.medication || '').trim();
    const dose = String(entry.dose || '').trim();
    if (!name) return null;

    return { name, dose };
  }

  function normalizePatientContext(payload) {
    if (!payload || payload.ok === false) return null;

    const medications = (Array.isArray(payload.medications) ? payload.medications : payload.medications_active || [])
      .map(normalizeMedicationEntry)
      .filter(Boolean);

    const diagnoses = Array.isArray(payload.diagnoses)
      ? payload.diagnoses
      : (payload.diagnoses_history || [])
          .map(item => {
            if (!item || typeof item !== 'object') return '';
            const code = String(item.cie10_code || '').trim();
            const description = String(item.cie10_description || '').trim();
            return [code, description].filter(Boolean).join(' — ');
          })
          .filter(Boolean);

    return {
      ...payload,
      medications,
      diagnoses,
      vitalAlerts: Array.isArray(payload.vital_alerts) ? payload.vital_alerts : [],
      vitalAlertCritical: payload.vital_alert_critical === true,
      lastDx: payload.lastDx || payload.last_dx || null,
      lastVisitSummary: String(payload.lastVisitSummary || payload.ai_summary || ''),
      visits: Array.isArray(payload.visits) ? payload.visits : [],
    };
  }

  function activeMedicationLabels() {
    return (state.patientContext?.medications || [])
      .map(item => [item.name, item.dose].filter(Boolean).join(' ').trim())
      .filter(Boolean);
  }

  async function checkMedicationInteractions(value) {
    const proposed = [];
    const label = [value?.name, value?.dose].filter(Boolean).join(' ').trim();
    if (label) proposed.push(label);

    if (!state.caseId || proposed.length === 0) {
      return { ok: true, has_interactions: false, interactions: [] };
    }

    const response = await fetch(CONFIG.interactionApiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        case_id: state.caseId,
        proposed_medications: proposed,
        active_medications: activeMedicationLabels(),
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      throw new Error(payload?.error || 'No se pudo verificar interacciones medicamentosas.');
    }

    return payload;
  }

  function clearInteractionBanner() {
    const banner = document.getElementById('oc-interaction-banner');
    if (!(banner instanceof HTMLElement)) return;
    banner.innerHTML = '';
    banner.style.display = 'none';
  }

  function clearRuntimeBadge() {
    const badge = document.getElementById('oc-offline-badge');
    if (!(badge instanceof HTMLElement)) return;
    badge.hidden = true;
    badge.textContent = '';
    badge.removeAttribute('title');
  }

  function applyRuntimeState(meta) {
    const badge = document.getElementById('oc-offline-badge');
    if (!(badge instanceof HTMLElement)) return;

    const isLocalMode =
      meta?.degraded === true ||
      meta?.tier === 'tier_3' ||
      meta?.provider === 'local_heuristic' ||
      meta?.offlineMode === 'local_heuristic';

    const label = String(meta?.offlineBadge || '').trim();
    if (!isLocalMode || !label) {
      clearRuntimeBadge();
      return;
    }

    badge.hidden = false;
    badge.textContent = label;

    const notice = String(meta?.degradedNotice || '').trim();
    if (notice) {
      badge.title = notice;
    } else {
      badge.removeAttribute('title');
    }
  }

  function renderInteractionBanner(payload) {
    const banner = document.getElementById('oc-interaction-banner');
    if (!(banner instanceof HTMLElement)) return;

    const interactions = Array.isArray(payload?.interactions) ? payload.interactions : [];
    if (!(payload?.has_interactions) || interactions.length === 0) {
      clearInteractionBanner();
      return;
    }

    const items = interactions.map(interaction => {
      const proposedMedication = String(interaction.proposed_medication || interaction.drug_a || '').trim();
      const activeMedication = String(interaction.active_medication || interaction.drug_b || '').trim();
      const description = String(interaction.description || '').trim();
      const severity = String(interaction.severity || 'medium').trim().toUpperCase();
      return `
        <li class="oc-alert-item">
          <strong>${escapeHtml(proposedMedication)}</strong>
          <span>con</span>
          <strong>${escapeHtml(activeMedication)}</strong>
          <span class="oc-alert-severity">${escapeHtml(severity)}</span>
          <div class="oc-alert-description">${escapeHtml(description)}</div>
        </li>`;
    }).join('');

    banner.innerHTML = `
      <div class="oc-alert-header">
        <div>
          <strong>Advertencia de interacciones</strong>
          <p>Se detectaron posibles interacciones con medicamentos activos del paciente. La alerta no bloquea el guardado.</p>
        </div>
        <button type="button" class="oc-alert-dismiss" id="oc-interaction-dismiss" aria-label="Cerrar alerta">×</button>
      </div>
      <ul class="oc-alert-list">${items}</ul>`;
    banner.style.display = 'block';
  }

  // ── Action extraction from AI response ───────────────────────────────────────

  function extractActions(text) {
    const actions = [];

    // CIE-10 pattern: "L20.0", "J03", "K29.7" etc
    const cie10 = text.match(/\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/g);
    if (cie10 && cie10.length > 0) {
      actions.push({
        type: 'apply_dx',
        label: `Diagnóstico: ${cie10[0]}`,
        icon: '🏷️',
        value: { code: cie10[0] },
      });
    }

    // Medication detection (simple heuristic)
    const medPatterns = /(\w+(?:cilina|mycin|mab|nib|vir|pril|sartan|olol|statin|micina|zol|sol|cortisona|prednisona|dexametasona|metformina|amoxicilina|azitromicina|ibuprofeno|paracetamol|loratadina|cetirizina|ivermectina|fluconazol))\s+(\d+(?:\.\d+)?\s*mg)/gi;
    const meds = [...text.matchAll(medPatterns)];
    if (meds.length > 0) {
      actions.push({
        type: 'add_medication',
        label: `Agregar a receta: ${meds[0][1]} ${meds[0][2]}`,
        icon: '💊',
        value: { name: meds[0][1], dose: meds[0][2] },
      });
    }

    // Certificate detection
    if (text.match(/certificado|reposo|días de baja|aptitud/i)) {
      actions.push({
        type: 'generate_certificate',
        label: 'Generar certificado',
        icon: '📄',
        value: {},
      });
    }

    // WhatsApp summary
    if (text.length > 200) {
      actions.push({
        type: 'send_whatsapp',
        label: 'Enviar resumen al paciente',
        icon: '💬',
        value: { summary: text.slice(0, 300) },
      });
    }

    return actions;
  }

  // ── API calls ────────────────────────────────────────────────────────────────

  async function loadPatientContext(patientId, caseId) {
    try {
      const res = await fetch(`${CONFIG.apiBase}/context?patient_id=${patientId}&case_id=${caseId}`);
      if (!res.ok) return null;
      return normalizePatientContext(await res.json());
    } catch { return null; }
  }

  function extractChatText(payload) {
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) {
      return content;
    }

    return String(payload?.text || payload?.content || '').trim();
  }

  function extractRuntimeMeta(payload) {
    const provider = String(payload?.provider || payload?.provider_used || '').trim();
    const tier = String(payload?.tier || payload?.provider_tier || '').trim();
    const degraded = payload?.degraded === true || payload?.degraded_mode === true;
    const offlineBadge = String(payload?.offline_badge || '').trim();
    const degradedNotice = String(payload?.degraded_notice || '').trim();
    const offlineMode = String(payload?.offline_mode || '').trim();

    if (!provider && !tier && !degraded && !offlineBadge && !degradedNotice && !offlineMode) {
      return null;
    }

    return {
      provider,
      tier,
      degraded,
      offlineBadge,
      degradedNotice,
      offlineMode,
    };
  }

  async function* streamChat(messages, patientContext) {
    const systemCtx = patientContext ? `
CONTEXTO DEL PACIENTE:
- Nombre: ${patientContext.name}
- Edad: ${patientContext.age} años, Sexo: ${patientContext.sex}
- Diagnósticos previos: ${(patientContext.diagnoses || []).join(', ') || 'ninguno'}
- Medicamentos activos: ${(patientContext.medications || []).map(m => m.name + ' ' + m.dose).join(', ') || 'ninguno'}
- Alergias: ${(patientContext.allergies || []).join(', ') || 'ninguna conocida'}
- Alertas de Signos Vitales Tomados en Admisión: ${(patientContext.vitalAlerts || []).join('; ') || 'ninguna alerta'}
- Última visita: ${patientContext.lastVisitSummary || 'sin visitas previas'}
` : '';

    const res = await fetch(`${CONFIG.apiBase}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: CONFIG.systemPrompt + '\n\n' + systemCtx },
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ],
        stream: true,
      }),
    });

    if (!res.ok) { yield { error: `Error ${res.status}: ${await res.text()}` }; return; }

    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/event-stream')) {
      const payload = await res.json().catch(() => null);
      if (!payload) {
        yield { error: 'Respuesta inválida del asistente.' };
        return;
      }

      const text = extractChatText(payload);
      if (!text) {
        yield { error: payload.error || 'Respuesta vacía del asistente.' };
        return;
      }

      yield {
        token: text,
        meta: extractRuntimeMeta(payload),
      };
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          const meta = extractRuntimeMeta(parsed);
          if (delta || meta) yield { token: delta || '', meta };
        } catch { /* ignore malformed chunks */ }
      }
    }
  }

  async function analyzePhoto(file) {
    const formData = new FormData();
    formData.append('photo', file);
    if (state.patientContext) {
      formData.append('patient_age', state.patientContext.age);
      formData.append('patient_sex', state.patientContext.sex);
      formData.append('prev_dx', (state.patientContext.diagnoses || []).join(', '));
    }

    const res = await fetch(`${CONFIG.apiBase}/analyze-photo`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(`Error analizando foto: ${res.status}`);
    return res.json();
  }

  // ── Mount & lifecycle ────────────────────────────────────────────────────────

  async function mount(selector) {
    const container = document.querySelector(selector);
    if (!container) { console.error(`OpenClaw: selector "${selector}" not found`); return; }

    const patientId = container.dataset.patientId;
    const caseId = container.dataset.caseId;

    state = { ...state, patientId, caseId, messages: [] };
    container.innerHTML = renderShell();

    injectStyles();
    bindEvents();

    // Load patient context
    setStatus('cargando contexto...');
    state.patientContext = await loadPatientContext(patientId, caseId);
    document.getElementById('oc-context-body').innerHTML = renderPatientContext(state.patientContext);

    // Add context to initial AI message if patient found
    if (state.patientContext) {
      const summary = state.patientContext.lastVisitSummary;
      addMessage('assistant', summary
        ? `Contexto cargado. ${state.patientContext.name}, ${state.patientContext.age} años. Última visita: ${summary.slice(0, 100)}... ¿Cuál es el motivo de consulta de hoy?`
        : `Contexto cargado. Paciente nuevo: ${state.patientContext.name}, ${state.patientContext.age} años. ¿Cuál es el motivo de consulta?`
      );
    }

    setStatus('listo');
  }

  function bindEvents() {
    const input = document.getElementById('oc-input');
    const sendBtn = document.getElementById('oc-send-btn');
    const voiceBtn = document.getElementById('oc-voice-btn');
    const photoBtn = document.getElementById('oc-photo-btn');
    const photoInput = document.getElementById('oc-photo-input');

    // Send on Enter (Shift+Enter = newline)
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    input.addEventListener('input', () => autoResize(input));
    sendBtn.addEventListener('click', sendMessage);

    // Voice
    voiceBtn.addEventListener('click', toggleVoice);

    // Photo
    photoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', e => handlePhoto(e.target.files[0]));

    // Action chips (delegated)
    document.getElementById('oc-messages').addEventListener('click', e => {
      const chip = e.target.closest('.oc-action-chip');
      if (chip) handleAction(chip.dataset.action, JSON.parse(chip.dataset.value));
    });
    document.addEventListener('click', e => {
      const dismiss = e.target.closest('#oc-interaction-dismiss');
      if (dismiss) clearInteractionBanner();
    });

    // New/close session
    document.getElementById('oc-new-session').addEventListener('click', newSession);
    document.getElementById('oc-close-session').addEventListener('click', closeSession);
  }

  // ── Message handling ─────────────────────────────────────────────────────────

  function addMessage(role, content, photo = null) {
    const msg = {
      id: `msg-${Date.now()}`,
      role,
      content,
      photo,
      ts: Date.now(),
      actions: role === 'assistant' ? extractActions(content) : [],
    };
    state.messages.push(msg);

    const container = document.getElementById('oc-messages');
    const welcome = container.querySelector('.oc-welcome');
    if (welcome) welcome.remove();

    container.insertAdjacentHTML('beforeend', renderMessageBubble(msg));
    container.scrollTop = container.scrollHeight;
    return msg;
  }

  async function sendMessage(contentOverride = null) {
    if (state.isStreaming) return;
    const input = document.getElementById('oc-input');
    const content = contentOverride || input.value.trim();
    if (!content) return;

    input.value = '';
    autoResize(input);
    addMessage('user', content);

    await streamResponse(content);
  }

  async function streamResponse(_userContent) {
    state.isStreaming = true;
    setStatus('pensando...');
    document.getElementById('oc-send-btn').disabled = true;

    const msgEl = addStreamingPlaceholder();
    let fullText = '';
    let runtimeMeta = null;

    try {
      for await (const chunk of streamChat(state.messages, state.patientContext)) {
        if (chunk.error) { updateStreamingMessage(msgEl, `Error: ${chunk.error}`); break; }
        if (chunk.meta) {
          runtimeMeta = { ...(runtimeMeta || {}), ...chunk.meta };
        }
        if (chunk.token) {
          fullText += chunk.token;
          updateStreamingMessage(msgEl, fullText);
        }
      }

      applyRuntimeState(runtimeMeta);

      // Finalize message
      const actions = extractActions(fullText);
      finalizeStreamingMessage(msgEl, fullText, actions);
      state.messages[state.messages.length - 1].content = fullText;
      state.messages[state.messages.length - 1].actions = actions;

    } catch (error) {
      updateStreamingMessage(msgEl, `Error de conexión: ${error.message}`);
    }

    state.isStreaming = false;
    setStatus('listo');
    document.getElementById('oc-send-btn').disabled = false;
  }

  function addStreamingPlaceholder() {
    const container = document.getElementById('oc-messages');
    const id = `stream-${Date.now()}`;
    const html = `
    <div class="oc-msg oc-msg-ai oc-msg-streaming" id="${id}">
      <div class="oc-msg-avatar">🤖</div>
      <div class="oc-msg-content">
        <div class="oc-msg-text"><span class="oc-typing-dot"></span><span class="oc-typing-dot"></span><span class="oc-typing-dot"></span></div>
      </div>
    </div>`;
    container.insertAdjacentHTML('beforeend', html);
    container.scrollTop = container.scrollHeight;
    return document.getElementById(id);
  }

  function updateStreamingMessage(el, text) {
    el.querySelector('.oc-msg-text').innerHTML = formatMarkdown(text) + '<span class="oc-cursor">▌</span>';
    el.closest('#oc-messages').scrollTop = el.closest('#oc-messages').scrollHeight;
  }

  function finalizeStreamingMessage(el, text, actions) {
    el.classList.remove('oc-msg-streaming');
    const time = new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    el.querySelector('.oc-msg-content').innerHTML = `
      <div class="oc-msg-text">${formatMarkdown(text)}</div>
      ${actions.length ? renderInlineActions(actions, el.id) : ''}
      <div class="oc-msg-time">${time}</div>`;
  }

  // ── Photo handling ───────────────────────────────────────────────────────────

  async function handlePhoto(file) {
    if (!file) return;
    if (file.size > CONFIG.maxPhotoSizeMb * 1024 * 1024) {
      alert(`La foto no puede superar ${CONFIG.maxPhotoSizeMb}MB`);
      return;
    }

    const photoUrl = URL.createObjectURL(file);
    state.isStreaming = true;
    setStatus('analizando foto...');

    // Show photo in chat immediately
    addMessage('user', 'Foto clínica para análisis:', photoUrl);

    try {
      const analysis = await analyzePhoto(file);
      // Analysis comes back as structured response
      const text = analysis.text || 'Análisis completado.';
      addMessage('assistant', text);
    } catch (_error) {
      // Fall back to regular chat with photo context
      await streamResponse(`Analiza esta foto clínica del paciente`);
    }

    state.isStreaming = false;
    setStatus('listo');
  }

  // ── Voice input ──────────────────────────────────────────────────────────────

  function toggleVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Tu navegador no soporta dictado por voz. Usa Chrome o Edge.');
      return;
    }

    if (state.isRecording) {
      state.recognition?.stop();
      state.isRecording = false;
      document.getElementById('oc-voice-btn').classList.remove('oc-recording');
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    state.recognition = new SR();
    state.recognition.lang = CONFIG.voiceLanguage;
    state.recognition.continuous = false;
    state.recognition.interimResults = true;

    const input = document.getElementById('oc-input');

    state.recognition.onresult = e => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      input.value = transcript;
      autoResize(input);
    };

    state.recognition.onend = () => {
      state.isRecording = false;
      document.getElementById('oc-voice-btn').classList.remove('oc-recording');
      if (input.value.trim()) sendMessage();
    };

    state.recognition.start();
    state.isRecording = true;
    document.getElementById('oc-voice-btn').classList.add('oc-recording');
    setStatus('escuchando...');
  }

  // ── Action handlers ──────────────────────────────────────────────────────────

  async function handleAction(type, value) {
    switch (type) {
      case 'apply_dx':
        // POST to API to update case diagnosis
        await fetch(`${CONFIG.apiBase}/action/apply-dx`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ case_id: state.caseId, ...value }),
        });
        
        // S27-03: Guardar en localStorage las últimas búsquedas CIE-10 del médico.
        if (window.saveCie10ToRecent) {
            window.saveCie10ToRecent(value.code, "Sugerencia Clínica IA");
        } else {
            // Standalone fallback
            try {
                let recents = JSON.parse(localStorage.getItem('aurora_cie10_recent') || '[]');
                recents = recents.filter(r => r.code !== value.code);
                recents.unshift({ code: value.code, description: "Sugerencia Clínica IA" });
                if (recents.length > 10) recents.pop();
                localStorage.setItem('aurora_cie10_recent', JSON.stringify(recents));
            } catch (e) {}
        }
        
        showToast(`✅ Diagnóstico ${value.code} aplicado a la historia clínica`);
        break;

      case 'add_medication': {
        try {
          const interactionPayload = await checkMedicationInteractions(value);
          renderInteractionBanner(interactionPayload);
        } catch (error) {
          console.warn('No se pudo verificar interacciones medicamentosas.', error);
        }

        const medicationResponse = await fetch(`${CONFIG.apiBase}/action/add-medication`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ case_id: state.caseId, ...value }),
        });
        if (!medicationResponse.ok) {
          throw new Error('No se pudo agregar el medicamento a la receta.');
        }
        showToast(`✅ ${value.name} ${value.dose} agregado a la receta`);
        break;
      }

      case 'generate_certificate':
        // Open certificate modal
        window.dispatchEvent(new CustomEvent('openclaw:generate-certificate', {
          detail: { caseId: state.caseId, patientContext: state.patientContext }
        }));
        break;

      case 'send_whatsapp': {
        const phone = state.patientContext?.phone;
        if (phone) {
          const msg = encodeURIComponent(`Resumen de su consulta en Aurora Derm:\n\n${value.summary}`);
          window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
        }
        break;
      }
    }
  }

  async function newSession() {
    if (state.messages.length > 0 && !confirm('¿Iniciar nueva consulta? Se perderá el chat actual.')) return;
    state.messages = [];
    clearInteractionBanner();
    document.getElementById('oc-messages').innerHTML = `
      <div class="oc-welcome">
        <div class="oc-welcome-icon">🩺</div>
        <p>Nueva consulta iniciada. ¿Cuál es el motivo?</p>
      </div>`;
  }

  async function closeSession() {
    if (state.messages.length === 0) { window.history.back(); return; }

    // Generate auto-summary before closing
    setStatus('generando resumen...');
    const summary = await fetch(`${CONFIG.apiBase}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: state.messages, case_id: state.caseId }),
    }).then(r => r.json()).catch(() => null);

    if (summary?.evolution) {
      window.dispatchEvent(new CustomEvent('openclaw:session-closed', {
        detail: { caseId: state.caseId, evolution: summary.evolution, actions: summary.actions }
      }));
    }

    setStatus('listo');
  }

  // ── Utilities ────────────────────────────────────────────────────────────────

  function setStatus(text) {
    const el = document.getElementById('oc-status');
    if (el) el.textContent = text;
  }

  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  function showToast(msg) {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      // openclaw usually sends success messages by default with an emoji, let's map it
      const type = msg.includes('❌') || msg.toLowerCase().includes('error') ? 'error' 
                 : msg.includes('⚠️') ? 'warning' 
                 : 'success';
      window.showToast(msg, type);
      return;
    }
    
    // Fallback if global toast system is missing
    const toast = document.createElement('div');
    toast.className = 'oc-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ── Styles (injected once) ───────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('oc-styles')) return;
    const style = document.createElement('style');
    style.id = 'oc-styles';
    style.textContent = `
      :root {
        --oc-bg: #0f0f13;
        --oc-surface: #1a1a24;
        --oc-surface-2: #23232f;
        --oc-border: #2d2d3d;
        --oc-accent: #7c6fff;
        --oc-accent-glow: rgba(124, 111, 255, 0.2);
        --oc-text: #f0f0f0;
        --oc-text-dim: #8888aa;
        --oc-green: #22c55e;
        --oc-yellow: #f59e0b;
        --oc-red: #ef4444;
        --oc-radius: 12px;
        --oc-font: 'Inter', -apple-system, sans-serif;
      }

      .oc-shell {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--oc-bg);
        color: var(--oc-text);
        font-family: var(--oc-font);
        font-size: 14px;
        border-radius: var(--oc-radius);
        overflow: hidden;
        border: 1px solid var(--oc-border);
      }

      /* Header */
      .oc-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid var(--oc-border);
        background: var(--oc-surface);
      }
      .oc-header-left { display: flex; align-items: center; gap: 10px; }
      .oc-header-right { display: flex; gap: 4px; }
      .oc-logo {
        display: flex; align-items: center; gap: 6px;
        font-weight: 600; font-size: 14px; color: var(--oc-accent);
      }
      .oc-status {
        font-size: 11px; color: var(--oc-text-dim);
        background: var(--oc-surface-2);
        padding: 2px 8px; border-radius: 20px;
      }
      .oc-runtime-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(239, 68, 68, 0.48);
        background: rgba(239, 68, 68, 0.18);
        color: #fecaca;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.01em;
      }

      /* Layout */
      .oc-layout {
        display: flex;
        flex: 1;
        overflow: hidden;
      }

      /* Chat panel */
      .oc-chat-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-right: 1px solid var(--oc-border);
      }

      .oc-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        scrollbar-width: thin;
        scrollbar-color: var(--oc-border) transparent;
      }

      /* Welcome state */
      .oc-welcome {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
        min-height: 200px;
        color: var(--oc-text-dim);
        text-align: center;
        gap: 10px;
      }
      .oc-welcome-icon { font-size: 40px; }

      /* Messages */
      .oc-msg {
        display: flex;
        gap: 10px;
        max-width: 85%;
        animation: oc-fade-in 0.2s ease;
      }
      @keyframes oc-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
      .oc-msg-doctor { align-self: flex-end; flex-direction: row-reverse; }
      .oc-msg-ai { align-self: flex-start; }

      .oc-msg-avatar {
        width: 28px; height: 28px;
        border-radius: 50%;
        background: var(--oc-surface-2);
        border: 1px solid var(--oc-border);
        display: flex; align-items: center; justify-content: center;
        font-size: 13px;
        flex-shrink: 0;
      }
      .oc-msg-avatar-dr {
        background: var(--oc-accent-glow);
        border-color: var(--oc-accent);
        font-size: 9px; font-weight: 700; color: var(--oc-accent);
      }

      .oc-msg-content {
        background: var(--oc-surface);
        border: 1px solid var(--oc-border);
        border-radius: var(--oc-radius);
        padding: 10px 14px;
        max-width: 100%;
      }
      .oc-msg-doctor .oc-msg-content {
        background: var(--oc-accent-glow);
        border-color: var(--oc-accent);
      }

      .oc-msg-text { line-height: 1.6; }
      .oc-msg-text p { margin: 0 0 8px; }
      .oc-msg-text p:last-child { margin: 0; }
      .oc-msg-text ul { margin: 4px 0; padding-left: 18px; }
      .oc-msg-text li { margin: 2px 0; }
      .oc-msg-text h3, .oc-msg-text h4 { font-size: 13px; font-weight: 600; margin: 8px 0 4px; color: var(--oc-accent); }
      .oc-msg-text code { background: var(--oc-surface-2); padding: 2px 5px; border-radius: 4px; font-size: 12px; }
      .oc-msg-text strong { color: #fff; }

      .oc-msg-photo { max-width: 240px; border-radius: 8px; display: block; margin-bottom: 8px; }
      .oc-msg-time { font-size: 10px; color: var(--oc-text-dim); margin-top: 6px; }

      /* Streaming */
      .oc-cursor { animation: oc-blink 0.7s infinite; }
      @keyframes oc-blink { 50% { opacity: 0; } }
      .oc-typing-dot {
        display: inline-block; width: 6px; height: 6px;
        border-radius: 50%; background: var(--oc-text-dim); margin: 0 2px;
        animation: oc-bounce 1.2s infinite;
      }
      .oc-typing-dot:nth-child(2) { animation-delay: 0.2s; }
      .oc-typing-dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes oc-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }

      /* Inline actions */
      .oc-inline-actions {
        display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px;
      }
      .oc-action-chip {
        background: var(--oc-surface-2);
        border: 1px solid var(--oc-border);
        color: var(--oc-text);
        padding: 5px 10px; border-radius: 20px;
        font-size: 12px; cursor: pointer;
        transition: all 0.15s;
        display: flex; align-items: center; gap: 4px;
      }
      .oc-action-chip:hover {
        background: var(--oc-accent-glow);
        border-color: var(--oc-accent);
        color: var(--oc-accent);
      }

      /* Actions bar */
      .oc-actions-bar {
        padding: 8px 16px; border-top: 1px solid var(--oc-border);
        background: var(--oc-surface);
        display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      }
      .oc-actions-label { font-size: 11px; color: var(--oc-text-dim); white-space: nowrap; }
      .oc-actions-row { display: flex; gap: 6px; flex-wrap: wrap; }
      .oc-alert-banner {
        margin: 12px 16px 0;
        padding: 12px 14px;
        border-radius: 10px;
        border: 1px solid rgba(245, 158, 11, 0.45);
        background: rgba(245, 158, 11, 0.12);
      }
      .oc-alert-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }
      .oc-alert-header p {
        margin: 4px 0 0;
        color: var(--oc-text-dim);
        line-height: 1.5;
      }
      .oc-alert-dismiss {
        background: none;
        border: none;
        color: var(--oc-text);
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        padding: 0;
      }
      .oc-alert-list {
        margin: 0;
        padding-left: 18px;
      }
      .oc-alert-item + .oc-alert-item { margin-top: 10px; }
      .oc-alert-item span { color: var(--oc-text-dim); margin-left: 4px; }
      .oc-alert-severity {
        display: inline-block;
        margin-left: 8px;
        padding: 1px 8px;
        border-radius: 999px;
        background: rgba(245, 158, 11, 0.18);
        color: #fbbf24;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
      }
      .oc-alert-description {
        margin-top: 4px;
        color: var(--oc-text-dim);
        line-height: 1.5;
      }

      /* Input area */
      .oc-input-area {
        border-top: 1px solid var(--oc-border);
        padding: 12px 16px;
        background: var(--oc-surface);
      }
      .oc-input-row {
        display: flex; align-items: flex-end; gap: 8px;
        background: var(--oc-surface-2);
        border: 1px solid var(--oc-border);
        border-radius: var(--oc-radius);
        padding: 8px 10px;
        transition: border-color 0.15s;
      }
      .oc-input-row:focus-within { border-color: var(--oc-accent); }
      .oc-textarea {
        flex: 1; background: none; border: none; outline: none;
        color: var(--oc-text); font-family: var(--oc-font); font-size: 14px;
        resize: none; line-height: 1.5; max-height: 120px;
        scrollbar-width: thin;
      }
      .oc-textarea::placeholder { color: var(--oc-text-dim); }

      /* Buttons */
      .oc-btn-icon {
        background: none; border: none; cursor: pointer;
        color: var(--oc-text-dim); padding: 6px;
        border-radius: 6px; transition: all 0.15s;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .oc-btn-icon:hover { color: var(--oc-text); background: var(--oc-surface-2); }
      .oc-recording { color: var(--oc-red) !important; animation: oc-pulse 1s infinite; }
      @keyframes oc-pulse { 50% { opacity: 0.5; } }

      .oc-send-btn {
        background: var(--oc-accent); border: none; cursor: pointer;
        color: #fff; padding: 8px; border-radius: 8px;
        transition: all 0.15s; display: flex; align-items: center;
        flex-shrink: 0;
      }
      .oc-send-btn:hover { background: #6b5ee0; transform: translateY(-1px); }
      .oc-send-btn:active { transform: none; }
      .oc-send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

      /* Context panel */
      .oc-context-panel {
        width: 260px; flex-shrink: 0;
        overflow-y: auto; background: var(--oc-surface);
        scrollbar-width: thin;
      }
      .oc-context-header {
        padding: 12px 16px; font-size: 11px; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.08em;
        color: var(--oc-text-dim); border-bottom: 1px solid var(--oc-border);
        position: sticky; top: 0; background: var(--oc-surface);
      }
      .oc-context-body { padding: 12px; display: flex; flex-direction: column; gap: 12px; }

      .oc-patient-card {
        background: var(--oc-accent-glow); border: 1px solid var(--oc-accent);
        border-radius: 8px; padding: 12px;
      }
      .oc-patient-name { font-weight: 600; font-size: 15px; margin-bottom: 4px; }
      .oc-patient-info { display: flex; gap: 10px; font-size: 12px; color: var(--oc-text-dim); }

      .oc-context-section {
        background: var(--oc-surface-2); border: 1px solid var(--oc-border);
        border-radius: 8px; padding: 10px;
      }
      .oc-context-alert { border-color: var(--oc-yellow); background: rgba(245, 158, 11, 0.08); }
      .oc-context-section-title {
        font-size: 10px; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.06em; color: var(--oc-text-dim); margin-bottom: 6px;
      }
      .oc-context-section-body { font-size: 13px; line-height: 1.5; }
      .oc-context-section-meta { font-size: 11px; color: var(--oc-text-dim); margin-top: 4px; }
      .oc-context-item {
        font-size: 12px; padding: 3px 0;
        border-bottom: 1px solid var(--oc-border); display: flex; gap: 6px;
      }
      .oc-context-item:last-child { border-bottom: none; }
      .oc-context-date { color: var(--oc-text-dim); flex-shrink: 0; }
      .oc-context-summary { font-size: 12px; color: var(--oc-text-dim); font-style: italic; }

      /* Toast */
      .oc-toast {
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        background: var(--oc-green); color: #fff; padding: 10px 20px;
        border-radius: 20px; font-size: 13px; z-index: 9999;
        animation: oc-toast-in 0.2s ease; pointer-events: none;
      }
      @keyframes oc-toast-in { from { opacity:0; transform: translateX(-50%) translateY(10px); } }

      /* Loading */
      .oc-loading-context { text-align: center; color: var(--oc-text-dim); padding: 20px; font-size: 13px; }

      /* Mobile */
      @media (max-width: 768px) {
        .oc-context-panel { display: none; }
        .oc-msg { max-width: 95%; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  return { mount, sendMessage, handleAction, newSession, closeSession };

})();

// Auto-mount if data attribute present
document.addEventListener('DOMContentLoaded', () => {
  const el = document.querySelector('[data-openclaw]');
  if (el) OpenclawChat.mount('[data-openclaw]');
});
