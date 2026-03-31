(function () {
  const amountButtons = Array.from(document.querySelectorAll('[data-gift-amount]'));
  const form = document.getElementById('gift-card-form');
  const resetButton = document.querySelector('[data-gift-reset]');
  const previewAmount = document.getElementById('gift-preview-amount');
  const previewRecipient = document.getElementById('gift-preview-recipient');
  const previewSender = document.getElementById('gift-preview-sender');
  const previewNote = document.getElementById('gift-preview-note');
  const previewCode = document.getElementById('gift-preview-code');
  const downloadLink = document.getElementById('gift-download');
  const whatsappLink = document.getElementById('gift-whatsapp');
  const feedback = document.getElementById('gift-feedback');

  if (!form || !previewAmount || !previewRecipient || !previewSender || !previewNote || !previewCode || !downloadLink || !whatsappLink) {
    return;
  }

  const state = {
    amount: 50,
    code: '',
    pdfUrl: '',
    issuedAt: '',
    expiresAt: '',
  };

  const fields = {
    recipient: document.getElementById('gift-recipient'),
    sender: document.getElementById('gift-sender'),
    note: document.getElementById('gift-note'),
    email: document.getElementById('gift-email'),
  };

  function escapePdfText(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  function wrapText(value, maxLength) {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return [];
    }

    const lines = [];
    let current = '';

    words.forEach((word) => {
      const next = current ? current + ' ' + word : word;
      if (next.length > maxLength && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });

    if (current) {
      lines.push(current);
    }

    return lines;
  }

  function buildPdfBlob(payload) {
    const lines = [
      { text: 'Aurora Derm Gift Card', x: 72, y: 760, size: 24 },
      { text: 'Codigo: ' + payload.code, x: 72, y: 724, size: 13 },
      { text: 'Saldo: $' + payload.amount, x: 72, y: 700, size: 18 },
      { text: 'Para: ' + payload.recipient, x: 72, y: 664, size: 13 },
      { text: 'De parte de: ' + payload.sender, x: 72, y: 640, size: 13 },
      { text: 'Emitida: ' + payload.issuedAt, x: 72, y: 616, size: 12 },
      { text: 'Vence: ' + payload.expiresAt, x: 72, y: 594, size: 12 },
      { text: 'Uso sujeto a servicios elegibles y criterio medico.', x: 72, y: 560, size: 12 },
    ];

    wrapText(payload.note, 48).forEach((line, index) => {
      lines.push({
        text: index === 0 ? 'Mensaje: ' + line : line,
        x: 72,
        y: 530 - index * 18,
        size: 12,
      });
    });

    const content = lines
      .map((line) => `BT /F1 ${line.size} Tf 1 0 0 1 ${line.x} ${line.y} Tm (${escapePdfText(line.text)}) Tj ET`)
      .join('\n');

    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
      `4 0 obj << /Length ${new TextEncoder().encode(content).length} >> stream\n${content}\nendstream\nendobj`,
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    ];

    const encoder = new TextEncoder();
    let pdf = '%PDF-1.4\n';
    const offsets = [];

    objects.forEach((object) => {
      offsets.push(encoder.encode(pdf).length);
      pdf += object + '\n';
    });

    const xrefOffset = encoder.encode(pdf).length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    offsets.forEach((offset) => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new Blob([pdf], { type: 'application/pdf' });
  }

  function setFeedback(message) {
    feedback.textContent = message;
  }

  function setActionState(enabled) {
    downloadLink.classList.toggle('is-disabled', !enabled);
    whatsappLink.classList.toggle('is-disabled', !enabled);
    downloadLink.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    whatsappLink.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  }

  function formatAmount(amount) {
    return '$' + Number(amount).toFixed(0);
  }

  function formatDateLabel(value) {
    if (!value) {
      return 'Pendiente';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString('es-EC', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  function updatePreview() {
    previewAmount.textContent = formatAmount(state.amount);
    previewRecipient.textContent = fields.recipient.value.trim() || 'Nombre pendiente';
    previewSender.textContent = fields.sender.value.trim() || 'Nombre pendiente';
    previewNote.textContent = fields.note.value.trim() || 'Añada un mensaje corto para que la tarjeta salga más personal.';
    previewCode.textContent = state.code || 'AUR-GIFT-PENDIENTE';
  }

  function generateCode() {
    const amountPart = String(state.amount).padStart(3, '0');
    const randomPart = Math.random().toString(36).slice(2, 10).toUpperCase();
    return `AUR-${amountPart}-${randomPart}`;
  }

  function clearObjectUrl() {
    if (state.pdfUrl) {
      URL.revokeObjectURL(state.pdfUrl);
      state.pdfUrl = '';
    }
  }

  async function requestGiftCardIssue() {
    const response = await fetch('/api.php?resource=gift-card-issue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: state.amount,
        recipient: fields.recipient.value.trim(),
        sender: fields.sender.value.trim(),
        note: fields.note.value.trim(),
        email: fields.email.value.trim(),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload || payload.ok !== true) {
      throw new Error(payload && payload.error ? payload.error : 'No se pudo emitir la gift card.');
    }

    return payload.data || {};
  }

  function updateAmount(nextAmount) {
    state.amount = nextAmount;
    amountButtons.forEach((button) => {
      const active = Number(button.getAttribute('data-gift-amount')) === nextAmount;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    updatePreview();
  }

  amountButtons.forEach((button) => {
    button.addEventListener('click', function () {
      updateAmount(Number(button.getAttribute('data-gift-amount')));
    });
  });

  ['recipient', 'sender', 'note'].forEach((key) => {
    const field = fields[key];
    if (field) {
      field.addEventListener('input', updatePreview);
    }
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
    }
    setActionState(false);
    setFeedback('Generando gift card con código persistido...');

    try {
      const data = await requestGiftCardIssue();
      const giftCard = data.giftCard || {};

      state.code = data.code || giftCard.code || generateCode();
      state.issuedAt = giftCard.issued_at || '';
      state.expiresAt = giftCard.expires_at || '';
      updatePreview();
      clearObjectUrl();

      const pdfBlob = buildPdfBlob({
        amount: state.amount,
        code: state.code,
        recipient: fields.recipient.value.trim(),
        sender: fields.sender.value.trim(),
        note: fields.note.value.trim(),
        issuedAt: formatDateLabel(state.issuedAt),
        expiresAt: formatDateLabel(state.expiresAt),
      });

      state.pdfUrl = URL.createObjectURL(pdfBlob);
      downloadLink.href = state.pdfUrl;
      downloadLink.download = `${state.code}.pdf`;

      const whatsappMessage = [
        'Hola, te comparto una gift card de Aurora Derm.',
        `Codigo: ${state.code}`,
        `Saldo: ${formatAmount(state.amount)}`,
        `Para: ${fields.recipient.value.trim()}`,
        `De parte de: ${fields.sender.value.trim()}`,
        state.expiresAt ? `Vence: ${formatDateLabel(state.expiresAt)}` : '',
        fields.note.value.trim() ? `Mensaje: ${fields.note.value.trim()}` : '',
        fields.email.value.trim() ? `Correo de referencia: ${fields.email.value.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      whatsappLink.href = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
      setActionState(true);
      setFeedback('Gift card lista. Ya puede descargar el PDF o enviarlo por WhatsApp.');
    } catch (error) {
      setFeedback(error && error.message ? error.message : 'No se pudo emitir la gift card.');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });

  if (resetButton) {
    resetButton.addEventListener('click', function () {
      form.reset();
      clearObjectUrl();
      state.code = '';
      state.issuedAt = '';
      state.expiresAt = '';
      updateAmount(50);
      updatePreview();
      downloadLink.href = '#';
      whatsappLink.href = '#';
      setActionState(false);
      setFeedback('Complete el formulario para generar la tarjeta y activar la descarga.');
    });
  }

  updateAmount(50);
  updatePreview();
  setActionState(false);
})();
