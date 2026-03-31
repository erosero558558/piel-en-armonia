/**
 * anamnesis-panel.js — S3-15: Formulario de Anamnesis Clínica
 * Aurora Derm — Panel de historia clínica para el médico
 *
 * Estructura:
 *   - motivo de consulta
 *   - antecedentes personales y familiares
 *   - medicamentos actuales y alergias
 *   - examen físico dermatológico
 *   - diagnóstico (con CIE-10)
 *   - plan de tratamiento y evolución
 *
 * Guarda en: POST /api.php?resource=openclaw-save-diagnosis (diagnóstico)
 *            POST /api.php?resource=openclaw-save-evolution (evolución)
 * Lee de:   GET  /api.php?resource=openclaw-patient&case_id=X
 */

(function () {
  'use strict';

  /* ── Estado ── */
  let _caseId = null;
  let _sessionId = null;
  let _patientName = '';
  let _saving = false;

  /* ── Plantilla HTML del panel ── */
  function buildPanelHTML(caseId, patientName) {
    return `
      <div class="anamnesis-panel" id="anamnesis-panel-${caseId}" role="region" aria-label="Historia clínica">
        <header class="anamnesis-header">
          <div class="anamnesis-header-info">
            <span class="anamnesis-eyebrow">Historia Clínica</span>
            <h4 class="anamnesis-patient-name">${escHtml(patientName)}</h4>
          </div>
          <div class="anamnesis-header-actions">
            <button type="button" class="btn-ghost anamnesis-collapse-btn" id="anamnesis-collapse-${caseId}" aria-expanded="true" title="Colapsar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>
            </button>
          </div>
        </header>

        <div class="anamnesis-body" id="anamnesis-body-${caseId}">

          <!-- MOTIVO DE CONSULTA -->
          <section class="anamnesis-section">
            <h5 class="anamnesis-section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              Motivo de Consulta
            </h5>
            <textarea
              id="anamnesis-motivo-${caseId}"
              class="anamnesis-textarea"
              placeholder="Describa el motivo principal de la visita de hoy..."
              rows="3"
              maxlength="1000"
            ></textarea>
            <div class="anamnesis-char-count" aria-live="polite">
              <span id="anamnesis-motivo-count-${caseId}">0</span>/1000
            </div>
          </section>

          <!-- ANTECEDENTES -->
          <section class="anamnesis-section">
            <h5 class="anamnesis-section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Antecedentes
            </h5>
            <div class="anamnesis-grid-2">
              <div class="anamnesis-field">
                <label class="anamnesis-label" for="anamnesis-ant-personales-${caseId}">Personales</label>
                <textarea
                  id="anamnesis-ant-personales-${caseId}"
                  class="anamnesis-textarea anamnesis-textarea--sm"
                  placeholder="HTA, DM2, cirugías previas..."
                  rows="3"
                ></textarea>
              </div>
              <div class="anamnesis-field">
                <label class="anamnesis-label" for="anamnesis-ant-familiares-${caseId}">Familiares</label>
                <textarea
                  id="anamnesis-ant-familiares-${caseId}"
                  class="anamnesis-textarea anamnesis-textarea--sm"
                  placeholder="Enfermedades familiares relevantes..."
                  rows="3"
                ></textarea>
              </div>
            </div>
          </section>

          <!-- MEDICAMENTOS Y ALERGIAS -->
          <section class="anamnesis-section">
            <h5 class="anamnesis-section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Medicamentos y Alergias
            </h5>
            <div class="anamnesis-grid-2">
              <div class="anamnesis-field">
                <label class="anamnesis-label" for="anamnesis-medicamentos-${caseId}">Medicamentos actuales</label>
                <textarea
                  id="anamnesis-medicamentos-${caseId}"
                  class="anamnesis-textarea anamnesis-textarea--sm"
                  placeholder="Isotretinoína 20mg/día, anticonceptivos..."
                  rows="3"
                ></textarea>
              </div>
              <div class="anamnesis-field">
                <label class="anamnesis-label" for="anamnesis-alergias-${caseId}">Alergias conocidas</label>
                <textarea
                  id="anamnesis-alergias-${caseId}"
                  class="anamnesis-textarea anamnesis-textarea--sm"
                  placeholder="Penicilina, látex, retinoides tópicos..."
                  rows="3"
                ></textarea>
              </div>
            </div>
          </section>

          <!-- EXAMEN FÍSICO -->
          <section class="anamnesis-section">
            <h5 class="anamnesis-section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              Examen Físico Dermatológico
            </h5>
            <div class="anamnesis-exam-quick">
              <button type="button" class="anamnesis-quick-btn" data-target="anamnesis-examen-${caseId}" data-text="Piel: ">Piel</button>
              <button type="button" class="anamnesis-quick-btn" data-target="anamnesis-examen-${caseId}" data-text="Lesión primaria: ">Lesión prim.</button>
              <button type="button" class="anamnesis-quick-btn" data-target="anamnesis-examen-${caseId}" data-text="Distribución: ">Distribución</button>
              <button type="button" class="anamnesis-quick-btn" data-target="anamnesis-examen-${caseId}" data-text="Morfología: ">Morfología</button>
              <button type="button" class="anamnesis-quick-btn" data-target="anamnesis-examen-${caseId}" data-text="Fototipos: ">Fototipo</button>
            </div>
            <textarea
              id="anamnesis-examen-${caseId}"
              class="anamnesis-textarea"
              placeholder="Describa los hallazgos del examen físico dermatológico..."
              rows="4"
              maxlength="2000"
            ></textarea>
          </section>

          <!-- DIAGNÓSTICO (CIE-10) -->
          <section class="anamnesis-section">
            <h5 class="anamnesis-section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Diagnóstico
            </h5>
            <div class="anamnesis-dx-row">
              <div class="anamnesis-field" style="flex:2">
                <label class="anamnesis-label" for="anamnesis-dx-${caseId}">Diagnóstico principal</label>
                <input
                  type="text"
                  id="anamnesis-dx-${caseId}"
                  class="anamnesis-input"
                  placeholder="Ej: Acné vulgar moderado, dermatitis seborreica..."
                  autocomplete="off"
                >
              </div>
              <div class="anamnesis-field" style="flex:1">
                <label class="anamnesis-label" for="anamnesis-cie10-${caseId}">CIE-10</label>
                <div class="anamnesis-cie10-wrapper">
                  <input
                    type="text"
                    id="anamnesis-cie10-${caseId}"
                    class="anamnesis-input anamnesis-cie10-input"
                    placeholder="Ej: L70.0"
                    autocomplete="off"
                    maxlength="10"
                    style="text-transform:uppercase"
                  >
                  <div class="anamnesis-cie10-dropdown" id="anamnesis-cie10-dd-${caseId}" hidden></div>
                </div>
              </div>
            </div>
            <div class="anamnesis-field" style="margin-top:0.75rem">
              <label class="anamnesis-label" for="anamnesis-dx2-${caseId}">Diagnóstico secundario (opcional)</label>
              <input
                type="text"
                id="anamnesis-dx2-${caseId}"
                class="anamnesis-input"
                placeholder="Diagnóstico adicional si aplica..."
              >
            </div>
          </section>

          <!-- PLAN DE TRATAMIENTO Y EVOLUCIÓN -->
          <section class="anamnesis-section">
            <h5 class="anamnesis-section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
              Plan y Evolución
            </h5>
            <div class="anamnesis-grid-2">
              <div class="anamnesis-field">
                <label class="anamnesis-label" for="anamnesis-plan-${caseId}">Plan de tratamiento</label>
                <textarea
                  id="anamnesis-plan-${caseId}"
                  class="anamnesis-textarea"
                  placeholder="Terapia tópica, procedimientos planificados, referencias..."
                  rows="4"
                ></textarea>
              </div>
              <div class="anamnesis-field">
                <label class="anamnesis-label" for="anamnesis-evolucion-${caseId}">Nota de evolución</label>
                <textarea
                  id="anamnesis-evolucion-${caseId}"
                  class="anamnesis-textarea"
                  placeholder="Evolución respecto a visita anterior, adherencia al tratamiento..."
                  rows="4"
                ></textarea>
              </div>
            </div>
            <div class="anamnesis-field" style="margin-top:0.75rem">
              <label class="anamnesis-label" for="anamnesis-seguimiento-${caseId}">Próximo control</label>
              <input
                type="text"
                id="anamnesis-seguimiento-${caseId}"
                class="anamnesis-input"
                placeholder="Ej: En 4 semanas, al finalizar el ciclo de isotretinoína..."
              >
            </div>
          </section>

          <!-- ACCIONES -->
          <footer class="anamnesis-footer">
            <div class="anamnesis-status" id="anamnesis-status-${caseId}" aria-live="polite"></div>
            <div class="anamnesis-actions">
              <button type="button" class="btn-ghost anamnesis-clear-btn" id="anamnesis-clear-${caseId}">
                Limpiar
              </button>
              <button type="button" class="btn-primary anamnesis-save-btn" id="anamnesis-save-${caseId}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Guardar Historia Clínica
              </button>
            </div>
          </footer>

        </div><!-- /.anamnesis-body -->
      </div><!-- /.anamnesis-panel -->
    `;
  }

  /* ── Utilidades ── */
  function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function el(id) {
    return document.getElementById(id);
  }

  function setStatus(caseId, msg, type) {
    const s = el('anamnesis-status-' + caseId);
    if (!s) return;
    s.textContent = msg;
    s.className = 'anamnesis-status anamnesis-status--' + (type || 'neutral');
    if (type === 'success') {
      setTimeout(() => { if (s) { s.textContent = ''; s.className = 'anamnesis-status'; } }, 4000);
    }
  }

  function getFormData(caseId) {
    return {
      motivo:           (el('anamnesis-motivo-' + caseId) || {}).value || '',
      ant_personales:   (el('anamnesis-ant-personales-' + caseId) || {}).value || '',
      ant_familiares:   (el('anamnesis-ant-familiares-' + caseId) || {}).value || '',
      medicamentos:     (el('anamnesis-medicamentos-' + caseId) || {}).value || '',
      alergias:         (el('anamnesis-alergias-' + caseId) || {}).value || '',
      examen_fisico:    (el('anamnesis-examen-' + caseId) || {}).value || '',
      diagnostico:      (el('anamnesis-dx-' + caseId) || {}).value || '',
      diagnostico_cie10:(el('anamnesis-cie10-' + caseId) || {}).value || '',
      diagnostico2:     (el('anamnesis-dx2-' + caseId) || {}).value || '',
      plan_tratamiento: (el('anamnesis-plan-' + caseId) || {}).value || '',
      evolucion:        (el('anamnesis-evolucion-' + caseId) || {}).value || '',
      seguimiento:      (el('anamnesis-seguimiento-' + caseId) || {}).value || '',
    };
  }

  function populateForm(caseId, data) {
    const fields = [
      ['anamnesis-motivo-', 'motivo'],
      ['anamnesis-ant-personales-', 'ant_personales'],
      ['anamnesis-ant-familiares-', 'ant_familiares'],
      ['anamnesis-medicamentos-', 'medicamentos'],
      ['anamnesis-alergias-', 'alergias'],
      ['anamnesis-examen-', 'examen_fisico'],
      ['anamnesis-dx-', 'diagnostico'],
      ['anamnesis-cie10-', 'diagnostico_cie10'],
      ['anamnesis-dx2-', 'diagnostico2'],
      ['anamnesis-plan-', 'plan_tratamiento'],
      ['anamnesis-evolucion-', 'evolucion'],
      ['anamnesis-seguimiento-', 'seguimiento'],
    ];
    fields.forEach(([prefix, key]) => {
      const field = el(prefix + caseId);
      if (field && data[key] != null) field.value = data[key];
    });
  }

  /* ── CIE-10 autocomplete ligero ── */
  const CIE10_COMMON = [
    { code: 'L70.0', desc: 'Acné vulgaris' },
    { code: 'L70.1', desc: 'Acné conglobado' },
    { code: 'L21.0', desc: 'Dermatitis seborreica del cuero cabelludo' },
    { code: 'L21.8', desc: 'Otras dermatitis seborreicas' },
    { code: 'L20.9', desc: 'Dermatitis atópica, sin otra especificación' },
    { code: 'L23.9', desc: 'Dermatitis alérgica de contacto, no especificada' },
    { code: 'L29.9', desc: 'Prurito, no especificado' },
    { code: 'L30.9', desc: 'Dermatitis, no especificada' },
    { code: 'L40.0', desc: 'Psoriasis vulgar' },
    { code: 'L50.0', desc: 'Urticaria alérgica' },
    { code: 'L57.0', desc: 'Queratosis actínica' },
    { code: 'L60.0', desc: 'Onicolisis' },
    { code: 'L63.9', desc: 'Alopecia areata, no especificada' },
    { code: 'L64.9', desc: 'Alopecia androgénica, no especificada' },
    { code: 'L71.0', desc: 'Dermatitis perioral' },
    { code: 'L71.9', desc: 'Rosácea, no especificada' },
    { code: 'L72.0', desc: 'Quiste epidérmico' },
    { code: 'L81.1', desc: 'Cloasma / melasma' },
    { code: 'L81.4', desc: 'Otras hiperpigmentaciones melanínicas' },
    { code: 'L82',   desc: 'Queratosis seborreica' },
    { code: 'L85.1', desc: 'Queratodermia adquirida' },
    { code: 'L90.0', desc: 'Liquen escleroso y atrófico' },
    { code: 'L98.0', desc: 'Granuloma piógeno' },
    { code: 'B02.9', desc: 'Zóster sin complicaciones (herpes zóster)' },
    { code: 'B07',   desc: 'Verrugas víricas' },
    { code: 'B35.1', desc: 'Tiña de la cabeza' },
    { code: 'B36.0', desc: 'Pitiriasis versicolor' },
    { code: 'C43.9', desc: 'Melanoma maligno de piel, no especificado' },
    { code: 'C44.9', desc: 'Carcinoma de células basales, sin otra especificación' },
    { code: 'D22.9', desc: 'Nevo melanocítico, no especificado' },
  ];

  function setupCie10Autocomplete(caseId) {
    const input = el('anamnesis-cie10-' + caseId);
    const dropdown = el('anamnesis-cie10-dd-' + caseId);
    if (!input || !dropdown) return;

    input.addEventListener('input', () => {
      const q = input.value.trim().toUpperCase();
      if (q.length < 1) { dropdown.hidden = true; return; }

      const matches = CIE10_COMMON.filter(item =>
        item.code.startsWith(q) || item.desc.toUpperCase().includes(q)
      ).slice(0, 8);

      if (matches.length === 0) { dropdown.hidden = true; return; }

      dropdown.innerHTML = matches.map(m =>
        `<button type="button" class="anamnesis-cie10-item" data-code="${escHtml(m.code)}" data-desc="${escHtml(m.desc)}">
          <strong>${escHtml(m.code)}</strong> — ${escHtml(m.desc)}
        </button>`
      ).join('');
      dropdown.hidden = false;
    });

    dropdown.addEventListener('click', (e) => {
      const btn = e.target.closest('.anamnesis-cie10-item');
      if (!btn) return;
      input.value = btn.dataset.code;
      // Also populate diagnosis field if empty
      const dxField = el('anamnesis-dx-' + caseId);
      if (dxField && !dxField.value.trim()) {
        dxField.value = btn.dataset.desc;
      }
      dropdown.hidden = true;
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== input) {
        dropdown.hidden = true;
      }
    });
  }

  /* ── Guardar historia clínica ── */
  async function saveAnamnesis(caseId, sessionId) {
    if (_saving) return;
    _saving = true;

    const saveBtn = el('anamnesis-save-' + caseId);
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando...'; }
    setStatus(caseId, 'Guardando historia clínica...', 'neutral');

    const data = getFormData(caseId);
    const timestamp = new Date().toISOString();

    try {
      // Save diagnosis via openclaw (has CIE-10 support)
      const dxPayload = {
        case_id: caseId,
        session_id: sessionId || '',
        diagnosis: data.diagnostico,
        cie10_code: data.diagnostico_cie10,
        secondary_diagnosis: data.diagnostico2,
        anamnesis: {
          motivo_consulta: data.motivo,
          antecedentes_personales: data.ant_personales,
          antecedentes_familiares: data.ant_familiares,
          medicamentos: data.medicamentos,
          alergias: data.alergias,
          examen_fisico: data.examen_fisico,
        },
        treatment_plan: data.plan_tratamiento,
        follow_up: data.seguimiento,
        recorded_at: timestamp,
      };

      const dxRes = await fetch('/api.php?resource=openclaw-save-diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dxPayload),
        credentials: 'same-origin',
      });

      const dxJson = await dxRes.json().catch(() => ({}));

      // Save evolution note separately
      if (data.evolucion.trim()) {
        const evPayload = {
          case_id: caseId,
          session_id: sessionId || '',
          note: data.evolucion,
          recorded_at: timestamp,
        };
        await fetch('/api.php?resource=openclaw-save-evolution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(evPayload),
          credentials: 'same-origin',
        }).catch(() => {});
      }

      if (dxJson.ok !== false) {
        setStatus(caseId, '✓ Historia clínica guardada correctamente', 'success');
        // Dispatch event for other panels to react
        document.dispatchEvent(new CustomEvent('aurora:anamnesis:saved', {
          detail: { caseId, data, dxResult: dxJson }
        }));
      } else {
        setStatus(caseId, 'Error al guardar: ' + (dxJson.error || 'Sin respuesta del servidor'), 'error');
      }
    } catch (err) {
      console.error('[AnamnesisPanel] Error guardando:', err);
      setStatus(caseId, 'Error de red al guardar la historia clínica.', 'error');
    } finally {
      _saving = false;
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar Historia Clínica`;
      }
    }
  }

  /* ── Cargar datos existentes ── */
  async function loadExistingRecord(caseId) {
    try {
      const res = await fetch(`/api.php?resource=openclaw-patient&case_id=${encodeURIComponent(caseId)}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const json = await res.json().catch(() => ({}));
      const patient = json.data || json.patient || {};

      // Populate known fields from patient record
      const lastDiagnosis = patient.lastDiagnosis || {};
      const lastAnamnesis = lastDiagnosis.anamnesis || {};

      const prefilled = {
        motivo:           lastAnamnesis.motivo_consulta || '',
        ant_personales:   patient.antecedentes_personales || lastAnamnesis.antecedentes_personales || '',
        ant_familiares:   patient.antecedentes_familiares || lastAnamnesis.antecedentes_familiares || '',
        medicamentos:     patient.medicamentos_actuales || lastAnamnesis.medicamentos || '',
        alergias:         patient.alergias || lastAnamnesis.alergias || '',
        examen_fisico:    lastAnamnesis.examen_fisico || '',
        diagnostico:      lastDiagnosis.diagnosis || '',
        diagnostico_cie10:lastDiagnosis.cie10_code || '',
        diagnostico2:     lastDiagnosis.secondary_diagnosis || '',
        plan_tratamiento: lastDiagnosis.treatment_plan || '',
        evolucion:        '',
        seguimiento:      lastDiagnosis.follow_up || '',
      };

      populateForm(caseId, prefilled);
    } catch (_) {
      // Silent — new patient with no record
    }
  }

  /* ── Bind eventos del panel ── */
  function bindPanelEvents(caseId, sessionId) {
    // Collapse
    const collapseBtn = el('anamnesis-collapse-' + caseId);
    const body = el('anamnesis-body-' + caseId);
    if (collapseBtn && body) {
      collapseBtn.addEventListener('click', () => {
        const expanded = collapseBtn.getAttribute('aria-expanded') === 'true';
        collapseBtn.setAttribute('aria-expanded', String(!expanded));
        body.hidden = expanded;
        collapseBtn.querySelector('svg path').setAttribute('d',
          expanded ? 'M6 9l6 6 6-6' : 'M18 15l-6-6-6 6'
        );
      });
    }

    // Char counter for motivo
    const motivoTA = el('anamnesis-motivo-' + caseId);
    const motivoCount = el('anamnesis-motivo-count-' + caseId);
    if (motivoTA && motivoCount) {
      motivoTA.addEventListener('input', () => {
        motivoCount.textContent = motivoTA.value.length;
      });
    }

    // Quick insert buttons (examen físico)
    document.querySelectorAll('.anamnesis-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = el(btn.dataset.target);
        if (!target) return;
        const text = btn.dataset.text || '';
        const pos = target.selectionStart || target.value.length;
        const before = target.value.slice(0, pos);
        const after = target.value.slice(pos);
        target.value = before + (before && !before.endsWith('\n') ? '\n' : '') + text + after;
        target.focus();
        target.selectionStart = target.selectionEnd = pos + text.length + (before && !before.endsWith('\n') ? 1 : 0);
      });
    });

    // CIE-10 autocomplete
    setupCie10Autocomplete(caseId);

    // Save button
    const saveBtn = el('anamnesis-save-' + caseId);
    if (saveBtn) {
      saveBtn.addEventListener('click', () => saveAnamnesis(caseId, sessionId));
    }

    // Clear button
    const clearBtn = el('anamnesis-clear-' + caseId);
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!confirm('¿Limpiar todos los campos del formulario de anamnesis?')) return;
        populateForm(caseId, {
          motivo: '', ant_personales: '', ant_familiares: '',
          medicamentos: '', alergias: '', examen_fisico: '',
          diagnostico: '', diagnostico_cie10: '', diagnostico2: '',
          plan_tratamiento: '', evolucion: '', seguimiento: '',
        });
        setStatus(caseId, '', 'neutral');
      });
    }

    // Keyboard shortcut: Ctrl+S / Cmd+S inside the panel
    document.querySelector('#anamnesis-panel-' + caseId).addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveAnamnesis(caseId, sessionId);
      }
    });
  }

  /* ── API Pública ── */
  window.AnamnesisPanel = {
    /**
     * Monta el panel de anamnesis en un contenedor dado
     * @param {string} containerId — ID del elemento contenedor
     * @param {string} caseId — ID del caso clínico
     * @param {string} patientName — Nombre del paciente
     * @param {string} [sessionId] — ID de sesión clínica opcional
     */
    mount(containerId, caseId, patientName, sessionId) {
      const container = document.getElementById(containerId);
      if (!container) {
        console.warn('[AnamnesisPanel] Contenedor no encontrado:', containerId);
        return;
      }

      _caseId = caseId;
      _sessionId = sessionId || null;
      _patientName = patientName || 'Paciente';

      container.innerHTML = buildPanelHTML(caseId, patientName);
      bindPanelEvents(caseId, sessionId || '');
      loadExistingRecord(caseId);

      console.info('[AnamnesisPanel] Montado para caso:', caseId);
    },

    /**
     * Obtiene los datos del formulario sin guardar
     */
    getData(caseId) {
      return getFormData(caseId || _caseId);
    },

    /**
     * Guarda manualmente
     */
    save(caseId, sessionId) {
      saveAnamnesis(caseId || _caseId, sessionId || _sessionId);
    },
  };

  /* ── Inicialización automática si existe el placeholder ── */
  document.addEventListener('DOMContentLoaded', () => {
    const placeholder = document.getElementById('anamnesis-panel-placeholder');
    if (placeholder) {
      const caseId = placeholder.dataset.caseId;
      const patientName = placeholder.dataset.patientName || 'Paciente';
      const sessionId = placeholder.dataset.sessionId || '';
      if (caseId) {
        AnamnesisPanel.mount('anamnesis-panel-placeholder', caseId, patientName, sessionId);
      }
    }
  });

  // Listen for case changes from admin shell
  document.addEventListener('aurora:case:opened', (e) => {
    const { caseId, patientName, sessionId, containerId } = e.detail || {};
    if (caseId && containerId) {
      AnamnesisPanel.mount(containerId, caseId, patientName, sessionId);
    }
  });

})();
