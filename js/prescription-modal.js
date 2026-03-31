/**
 * prescription-modal.js — S3-19: Receta Digital
 * Aurora Derm — Generador de receta médica en el admin
 *
 * Flujo: médico abre modal → llena medicamentos → guarda (POST openclaw-prescription)
 *        → descarga PDF o envía por WhatsApp
 *
 * Endpoint: POST /api.php?resource=openclaw-prescription
 *           GET  /api.php?resource=openclaw-prescription&case_id=X
 */

(function () {
  'use strict';

  /* ── Constants ── */
  const MODAL_ID = 'prescription-modal';
  const MAX_MEDS = 8;

  /* ── State ── */
  let _caseId = null;
  let _sessionId = null;
  let _patientName = '';
  let _patientPhone = '';
  let _medCount = 0;
  let _saving = false;
  let _lastPrescriptionId = null;
  let _lastPdfUrl = null;
  let _lastWaUrl = null;

  /* ── Inyectar HTML del modal ── */
  function injectModal() {
    if (document.getElementById(MODAL_ID)) return;

    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'prescription-modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'prescription-modal-title');
    modal.hidden = true;
    modal.innerHTML = `
      <div class="prescription-modal-panel">

        <header class="prescription-modal-header">
          <div class="prescription-modal-header-info">
            <div class="prescription-modal-rx">Rx</div>
            <div>
              <h3 id="prescription-modal-title" class="prescription-modal-title">Receta Médica</h3>
              <span id="prescription-modal-patient" class="prescription-modal-subtitle"></span>
            </div>
          </div>
          <button type="button" id="prescription-modal-close" class="prescription-modal-close" aria-label="Cerrar receta">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <div class="prescription-modal-body">

          <!-- Instrucciones generales -->
          <div class="prescription-field-group">
            <label class="prescription-label" for="prescription-general-instructions">Indicaciones generales (opcional)</label>
            <textarea
              id="prescription-general-instructions"
              class="prescription-textarea"
              placeholder="Ej: Aplicar en piel limpia y seca. Evitar exposición solar. Usar protector FPS 50+."
              rows="2"
              maxlength="500"
            ></textarea>
          </div>

          <!-- Lista de medicamentos -->
          <div class="prescription-meds-header">
            <h4 class="prescription-meds-title">Medicamentos</h4>
            <button type="button" id="prescription-add-med" class="prescription-add-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              Agregar
            </button>
          </div>

          <div id="prescription-meds-list" class="prescription-meds-list">
            <!-- Medicamentos se agregan dinámicamente -->
          </div>

          <div id="prescription-meds-empty" class="prescription-meds-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <p>No hay medicamentos agregados. Haga clic en "Agregar".</p>
          </div>

        </div><!-- /.prescription-modal-body -->

        <footer class="prescription-modal-footer">
          <div class="prescription-status" id="prescription-status" aria-live="polite"></div>
          <div class="prescription-footer-actions">
            <button type="button" id="prescription-btn-cancel" class="btn-ghost">Cancelar</button>
            <button type="button" id="prescription-btn-save" class="prescription-save-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/></svg>
              Generar Receta PDF
            </button>
          </div>
        </footer>

        <!-- Panel de resultado post-generación -->
        <div id="prescription-result-panel" class="prescription-result-panel" hidden>
          <div class="prescription-result-success">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>Receta generada exitosamente</span>
          </div>
          <div class="prescription-result-actions">
            <a id="prescription-pdf-link" href="#" target="_blank" rel="noopener" class="btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"/></svg>
              Descargar PDF
            </a>
            <a id="prescription-wa-link" href="#" target="_blank" rel="noopener" class="prescription-wa-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
              Enviar por WhatsApp
            </a>
            <button type="button" id="prescription-new-btn" class="btn-ghost">Nueva Receta</button>
          </div>
        </div>

      </div><!-- /.prescription-modal-panel -->
    `;

    document.body.appendChild(modal);
    bindModalEvents();
  }

  /* ── Crear fila de medicamento ── */
  function buildMedRow(index) {
    return `
      <div class="prescription-med-row" id="prescription-med-row-${index}" data-med-index="${index}">
        <div class="prescription-med-row-header">
          <span class="prescription-med-number">${index + 1}</span>
          <button type="button" class="prescription-med-remove" data-remove="${index}" aria-label="Eliminar medicamento ${index + 1}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="prescription-med-fields">
          <div class="prescription-med-field prescription-med-name-field">
            <label class="prescription-label" for="med-name-${index}">Medicamento / Principio activo</label>
            <input type="text" id="med-name-${index}" class="prescription-input" placeholder="Ej: Clindamicina 1% gel" required>
          </div>
          <div class="prescription-med-field">
            <label class="prescription-label" for="med-dose-${index}">Dosis</label>
            <input type="text" id="med-dose-${index}" class="prescription-input" placeholder="Ej: Una aplicación" required>
          </div>
          <div class="prescription-med-field">
            <label class="prescription-label" for="med-freq-${index}">Frecuencia</label>
            <input type="text" id="med-freq-${index}" class="prescription-input" placeholder="Ej: Cada noche">
          </div>
          <div class="prescription-med-field">
            <label class="prescription-label" for="med-duration-${index}">Duración</label>
            <input type="text" id="med-duration-${index}" class="prescription-input" placeholder="Ej: 30 días">
          </div>
          <div class="prescription-med-field prescription-med-field--full">
            <label class="prescription-label" for="med-instructions-${index}">Indicaciones especiales</label>
            <input type="text" id="med-instructions-${index}" class="prescription-input" placeholder="Ej: Aplicar sobre piel limpia, evitar ojos">
          </div>
        </div>
      </div>
    `;
  }

  /* ── Bind eventos del modal ── */
  function bindModalEvents() {
    // Close
    ['prescription-modal-close', 'prescription-btn-cancel'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', closeModal);
    });

    // Close on backdrop click
    const overlay = document.getElementById(MODAL_ID);
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
    }

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay && !overlay.hidden) closeModal();
    });

    // Add medication
    const addBtn = document.getElementById('prescription-add-med');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (_medCount >= MAX_MEDS) {
          setStatus('Máximo ' + MAX_MEDS + ' medicamentos por receta', 'error');
          return;
        }
        addMedRow();
      });
    }

    // Save / Generate PDF
    const saveBtn = document.getElementById('prescription-btn-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', generatePrescription);
    }

    // New prescription
    const newBtn = document.getElementById('prescription-new-btn');
    if (newBtn) {
      newBtn.addEventListener('click', resetForNew);
    }

    // Delegate remove buttons
    const medList = document.getElementById('prescription-meds-list');
    if (medList) {
      medList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-remove]');
        if (!btn) return;
        const idx = parseInt(btn.dataset.remove, 10);
        removeMedRow(idx);
      });
    }
  }

  /* ── Medicamentos ── */
  function addMedRow() {
    const list = document.getElementById('prescription-meds-list');
    const empty = document.getElementById('prescription-meds-empty');
    if (!list) return;

    list.insertAdjacentHTML('beforeend', buildMedRow(_medCount));
    _medCount++;
    if (empty) empty.hidden = true;

    // Focus first field of new row
    const newInput = document.getElementById('med-name-' + (_medCount - 1));
    if (newInput) newInput.focus();

    updateAddBtn();
  }

  function removeMedRow(index) {
    const row = document.getElementById('prescription-med-row-' + index);
    if (row) row.remove();

    // Recount visible rows
    const rows = document.querySelectorAll('.prescription-med-row');
    const empty = document.getElementById('prescription-meds-empty');
    if (empty) empty.hidden = rows.length > 0;

    updateAddBtn();
  }

  function updateAddBtn() {
    const addBtn = document.getElementById('prescription-add-med');
    const rows = document.querySelectorAll('.prescription-med-row');
    if (addBtn) {
      addBtn.disabled = rows.length >= MAX_MEDS;
    }
  }

  function collectMedications() {
    const rows = document.querySelectorAll('.prescription-med-row');
    return Array.from(rows).map(row => {
      const idx = parseInt(row.dataset.medIndex, 10);
      return {
        medication:   (document.getElementById('med-name-' + idx) || {}).value || '',
        dose:         (document.getElementById('med-dose-' + idx) || {}).value || '',
        frequency:    (document.getElementById('med-freq-' + idx) || {}).value || '',
        duration:     (document.getElementById('med-duration-' + idx) || {}).value || '',
        instructions: (document.getElementById('med-instructions-' + idx) || {}).value || '',
      };
    }).filter(m => m.medication.trim() !== '');
  }

  /* ── Generar receta ── */
  async function generatePrescription() {
    if (_saving) return;

    const medications = collectMedications();
    if (medications.length === 0) {
      setStatus('Agregue al menos un medicamento antes de generar la receta.', 'error');
      return;
    }

    _saving = true;
    const saveBtn = document.getElementById('prescription-btn-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Generando...'; }
    setStatus('Generando receta médica PDF...', 'neutral');

    const instructions = (document.getElementById('prescription-general-instructions') || {}).value || '';

    const payload = {
      case_id:               _caseId,
      session_id:            _sessionId || '',
      medications,
      general_instructions:  instructions,
      patient_name:          _patientName,
      patient_phone:         _patientPhone,
    };

    try {
      const res = await fetch('/api.php?resource=openclaw-prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      });

      const json = await res.json().catch(() => ({}));

      if (json.ok !== false && (json.prescription_id || json.pdf_url)) {
        _lastPrescriptionId = json.prescription_id || '';
        _lastPdfUrl = json.pdf_url || '#';
        _lastWaUrl = json.whatsapp_url || '';

        // Update result links
        const pdfLink = document.getElementById('prescription-pdf-link');
        const waLink = document.getElementById('prescription-wa-link');
        if (pdfLink) pdfLink.href = _lastPdfUrl;
        if (waLink) {
          if (_lastWaUrl) {
            waLink.href = _lastWaUrl;
            waLink.style.display = '';
          } else {
            waLink.style.display = 'none';
          }
        }

        // Show result panel
        const resultPanel = document.getElementById('prescription-result-panel');
        const modalBody = document.querySelector('#prescription-modal .prescription-modal-body');
        const footer = document.querySelector('#prescription-modal .prescription-modal-footer');
        if (resultPanel) resultPanel.hidden = false;
        if (modalBody) modalBody.hidden = true;
        if (footer) footer.hidden = true;

        document.dispatchEvent(new CustomEvent('aurora:prescription:created', {
          detail: { caseId: _caseId, prescriptionId: _lastPrescriptionId, pdfUrl: _lastPdfUrl }
        }));

        setStatus('', 'neutral');
      } else {
        setStatus('Error al generar la receta: ' + (json.error || 'Respuesta inesperada del servidor'), 'error');
      }
    } catch (err) {
      console.error('[PrescriptionModal] Error:', err);
      setStatus('Error de conexión al generar la receta. Intente de nuevo.', 'error');
    } finally {
      _saving = false;
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/></svg> Generar Receta PDF`;
      }
    }
  }

  /* ── Helpers ── */
  function setStatus(msg, type) {
    const s = document.getElementById('prescription-status');
    if (!s) return;
    s.textContent = msg;
    s.className = 'prescription-status' + (type ? ' prescription-status--' + type : '');
    if (type === 'success') {
      setTimeout(() => { if (s) { s.textContent = ''; s.className = 'prescription-status'; } }, 4000);
    }
  }

  function resetForNew() {
    // Reset to input form
    const resultPanel = document.getElementById('prescription-result-panel');
    const modalBody = document.querySelector('#prescription-modal .prescription-modal-body');
    const footer = document.querySelector('#prescription-modal .prescription-modal-footer');
    if (resultPanel) resultPanel.hidden = true;
    if (modalBody) modalBody.hidden = false;
    if (footer) footer.hidden = false;

    // Clear meds
    const medList = document.getElementById('prescription-meds-list');
    if (medList) medList.innerHTML = '';
    const empty = document.getElementById('prescription-meds-empty');
    if (empty) empty.hidden = false;

    const generalInstr = document.getElementById('prescription-general-instructions');
    if (generalInstr) generalInstr.value = '';

    _medCount = 0;
    _lastPrescriptionId = null;
    _lastPdfUrl = null;
    _lastWaUrl = null;
    setStatus('', 'neutral');
    updateAddBtn();
  }

  function openModal(caseId, patientName, patientPhone, sessionId) {
    _caseId = caseId;
    _patientName = patientName || 'Paciente';
    _patientPhone = patientPhone || '';
    _sessionId = sessionId || '';

    const modal = document.getElementById(MODAL_ID);
    const patientLabel = document.getElementById('prescription-modal-patient');
    if (patientLabel) patientLabel.textContent = _patientName;

    if (modal) {
      modal.hidden = false;
      document.body.style.overflow = 'hidden';

      // Auto-add first med row if empty
      const rows = document.querySelectorAll('.prescription-med-row');
      if (rows.length === 0) addMedRow();

      // Focus first field
      setTimeout(() => {
        const first = document.getElementById('med-name-0') || document.getElementById('prescription-general-instructions');
        if (first) first.focus();
      }, 50);
    }
  }

  function closeModal() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) {
      modal.hidden = true;
      document.body.style.overflow = '';
    }
    resetForNew();
    _caseId = null;
    _patientName = '';
    _patientPhone = '';
    _sessionId = '';
  }

  /* ── API Pública ── */
  window.PrescriptionModal = {
    /**
     * Abre el modal de receta para un caso
     * @param {string} caseId
     * @param {string} patientName
     * @param {string} patientPhone - Número en formato internacional
     * @param {string} [sessionId]
     */
    open(caseId, patientName, patientPhone, sessionId) {
      injectModal();
      openModal(caseId, patientName, patientPhone, sessionId);
    },

    close() {
      closeModal();
    },

    /** Inicializa solo el modal (útil para precargar) */
    init() {
      injectModal();
    },
  };

  /* ── Botones de trigger en el DOM ── */
  document.addEventListener('DOMContentLoaded', () => {
    // Escuchar clicks en cualquier botón con data-open-prescription
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-open-prescription]');
      if (!btn) return;

      const caseId = btn.dataset.caseId || btn.closest('[data-case-id]')?.dataset.caseId || '';
      const patientName = btn.dataset.patientName || btn.closest('[data-patient-name]')?.dataset.patientName || '';
      const patientPhone = btn.dataset.patientPhone || '';
      const sessionId = btn.dataset.sessionId || '';

      if (!caseId) {
        console.warn('[PrescriptionModal] data-case-id no encontrado en el botón o su contenedor');
        return;
      }

      PrescriptionModal.open(caseId, patientName, patientPhone, sessionId);
    });

    // Escuchar evento global para abrir desde cualquier parte del admin
    document.addEventListener('aurora:open:prescription', (e) => {
      const { caseId, patientName, patientPhone, sessionId } = e.detail || {};
      if (caseId) PrescriptionModal.open(caseId, patientName, patientPhone, sessionId);
    });
  });

})();
