/**
 * js/format.js — Formateo de datos clínicos y de UI — Aurora Derm
 * JS-07 [Gemini]
 *
 * Uso:
 *   formatDate('2026-04-03')         → 'jue 3 abr 2026'
 *   formatTime('09:30')              → '09:30'
 *   formatCurrency(1500)             → '$1,500'
 *   formatPhone('+525551234567')     → '+52 555 123 4567'
 *   initials('Lucía García Sánchez') → 'LG'
 */

'use strict';

(function () {

  const DAYS   = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MONTHS_FULL = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];

  /**
   * Parsea una fecha ISO 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:mm:ss' sin drift de timezone.
   * @param {string} raw
   * @returns {Date|null}
   */
  function parseDate(raw) {
    if (!raw) return null;
    const str = String(raw).trim();
    // 'YYYY-MM-DD' → parse como UTC local directo para evitar drift
    const iso = str.length === 10 ? str + 'T00:00:00' : str;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * 'jue 3 abr 2026'
   * @param {string} raw  ISO date string
   * @param {string} [fallback='—']
   */
  function formatDate(raw, fallback) {
    const d = parseDate(raw);
    if (!d) return fallback ?? '—';
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  /**
   * '3 de abril de 2026'
   */
  function formatDateLong(raw, fallback) {
    const d = parseDate(raw);
    if (!d) return fallback ?? '—';
    return d.getDate() + ' de ' + MONTHS_FULL[d.getMonth()] + ' de ' + d.getFullYear();
  }

  /**
   * 'abr 2026'
   */
  function formatMonthYear(raw, fallback) {
    const d = parseDate(raw);
    if (!d) return fallback ?? '—';
    return MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  /**
   * '09:30' — trunca a HH:mm si viene HH:mm:ss
   * @param {string} raw
   * @param {string} [fallback='Por confirmar']
   */
  function formatTime(raw, fallback) {
    const str = String(raw || '').trim();
    if (!str) return fallback ?? 'Por confirmar';
    const match = str.match(/^(\d{2}:\d{2})/);
    return match ? match[1] : str;
  }

  /**
   * 'jue 3 abr · 09:30'
   */
  function formatDateTime(rawDate, rawTime, fallback) {
    const datePart = formatDate(rawDate, '');
    const timePart = formatTime(rawTime, '');
    if (!datePart) return fallback ?? '—';
    return timePart ? datePart + ' · ' + timePart : datePart;
  }

  /**
   * '2 horas', '45 min', 'justo ahora'
   * @param {string|number} raw  ISO timestamp o unix ms
   */
  function formatRelative(raw) {
    const ts = typeof raw === 'number' ? raw : new Date(String(raw)).getTime();
    if (isNaN(ts)) return '';
    const diffMs  = Date.now() - ts;
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffH   = Math.round(diffMin / 60);
    const diffD   = Math.round(diffH / 24);

    if (diffSec < 30)  return 'justo ahora';
    if (diffMin < 60)  return diffMin + ' min';
    if (diffH   < 24)  return diffH   + (diffH === 1 ? ' hora' : ' horas');
    if (diffD   < 30)  return diffD   + (diffD === 1 ? ' día' : ' días');
    const d = new Date(ts);
    return MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  /**
   * '$1,500' o '$1,500.50'
   * @param {number|string} amount
   * @param {string} [currency='$']
   */
  function formatCurrency(amount, currency) {
    const n = parseFloat(String(amount));
    if (isNaN(n)) return '—';
    const sym = currency ?? '$';
    const cents = n % 1 !== 0;
    const formatted = n.toLocaleString('es-MX', {
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: 2,
    });
    return sym + formatted;
  }

  /**
   * Formatea teléfono: intenta groupar dígitos de forma legible.
   * '+525551234567' → '+52 555 123 4567'
   * '5551234567'    → '555 123 4567'
   */
  function formatPhone(raw) {
    const str = String(raw || '').trim();
    if (!str) return '';
    const digits = str.replace(/\D+/g, '');
    const hasPlus = str.startsWith('+');

    if (digits.length === 12 && digits.startsWith('52')) {
      // México con código de país
      return '+52 ' + digits.slice(2, 5) + ' ' + digits.slice(5, 8) + ' ' + digits.slice(8);
    }
    if (digits.length === 10) {
      return digits.slice(0, 3) + ' ' + digits.slice(3, 6) + ' ' + digits.slice(6);
    }
    return (hasPlus ? '+' : '') + digits;
  }

  /**
   * Iniciales de un nombre: 'Lucía García Sánchez' → 'LG'
   * Toma la primera letra del primer nombre y primer apellido.
   * @param {string} name
   */
  function initials(name) {
    const str = String(name || '').trim();
    if (!str) return '?';
    const parts = str.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  /**
   * Trunca texto con elipsis.
   * @param {string} text
   * @param {number} maxLen
   */
  function truncate(text, maxLen) {
    const str = String(text || '');
    return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + '…';
  }

  /**
   * Capitaliza la primera letra de cada palabra.
   * 'acne_vulgaris' → 'Acne Vulgaris'
   */
  function humanize(raw) {
    return String(raw || '')
      .replace(/[_-]/g, ' ')
      .replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  /**
   * Estado de cita → badge label + color
   * @param {string} status
   * @returns {{ label: string, tone: 'success'|'warning'|'danger'|'neutral' }}
   */
  function appointmentStatus(status) {
    const map = {
      scheduled:  { label: 'Programada',   tone: 'info' },
      confirmed:  { label: 'Confirmada',   tone: 'success' },
      completed:  { label: 'Atendida',     tone: 'neutral' },
      cancelled:  { label: 'Cancelada',    tone: 'danger' },
      'no-show':  { label: 'No se presentó', tone: 'warning' },
      rescheduled:{ label: 'Reagendada',   tone: 'warning' },
    };
    return map[status] || { label: humanize(status), tone: 'neutral' };
  }

  /**
   * Estado de turno → badge
   */
  function queueStatus(status) {
    const map = {
      waiting:   { label: 'En espera',  tone: 'warning' },
      called:    { label: 'Llamado',    tone: 'info' },
      attending: { label: 'En consulta',tone: 'success' },
      done:      { label: 'Atendido',   tone: 'neutral' },
      skipped:   { label: 'Omitido',    tone: 'danger' },
    };
    return map[status] || { label: humanize(status), tone: 'neutral' };
  }

  /**
   * Formatea 'minutos de espera' como texto legible.
   * 0  → 'Próximo'
   * 5  → '~5 min'
   * 65 → '~1 h 5 min'
   */
  function formatWaitTime(minutes) {
    const n = parseInt(String(minutes), 10);
    if (isNaN(n) || n <= 0) return 'Próximo';
    if (n < 60) return '~' + n + ' min';
    const h = Math.floor(n / 60);
    const m = n % 60;
    return '~' + h + ' h' + (m > 0 ? ' ' + m + ' min' : '');
  }

  // Exports globales
  const fmt = {
    date: formatDate,
    dateLong: formatDateLong,
    monthYear: formatMonthYear,
    time: formatTime,
    dateTime: formatDateTime,
    relative: formatRelative,
    currency: formatCurrency,
    phone: formatPhone,
    initials,
    truncate,
    humanize,
    appointmentStatus,
    queueStatus,
    waitTime: formatWaitTime,
  };

  window.fmt = fmt;

  // Compat individual
  window.formatDate     = formatDate;
  window.formatTime     = formatTime;
  window.formatCurrency = formatCurrency;
  window.formatPhone    = formatPhone;
  window.initials       = initials;

  if (typeof module !== 'undefined') module.exports = fmt;
})();
