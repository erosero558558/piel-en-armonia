import {
    escapeHtml,
    formatTimestamp,
    toArray,
    toString,
} from './turnero-surface-helpers.js';
import { normalizeTurneroSurfaceRecoveryKey } from './turnero-surface-contract-snapshot.js';

const STYLE_ID = 'turneroSurfaceSupportChecklistInlineStyles';

function ensureSupportChecklistStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-surface-support-checklist {
            display: grid;
            gap: 0.55rem;
        }
        .turnero-surface-support-checklist__header {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 0.65rem;
            align-items: flex-start;
        }
        .turnero-surface-support-checklist__header p,
        .turnero-surface-support-checklist__header h4,
        .turnero-surface-support-checklist__header span {
            margin: 0;
        }
        .turnero-surface-support-checklist__eyebrow {
            font-size: 0.72rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            opacity: 0.72;
        }
        .turnero-surface-support-checklist__summary {
            display: inline-flex;
            align-items: center;
            min-height: 34px;
            padding: 0.34rem 0.58rem;
            border-radius: 999px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 82%);
            font-size: 0.8rem;
            font-weight: 700;
            white-space: nowrap;
        }
        .turnero-surface-support-checklist__items {
            margin: 0;
            padding: 0;
            list-style: none;
            display: grid;
            gap: 0.38rem;
        }
        .turnero-surface-support-checklist__item {
            display: grid;
            gap: 0.14rem;
            padding: 0.64rem 0.72rem;
            border-radius: 14px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 78%);
        }
        .turnero-surface-support-checklist__item[data-state='pass'] {
            border-color: rgb(22 163 74 / 18%);
            background: rgb(240 253 244 / 82%);
        }
        .turnero-surface-support-checklist__item[data-state='warn'] {
            border-color: rgb(180 83 9 / 18%);
            background: rgb(255 251 235 / 82%);
        }
        .turnero-surface-support-checklist__item[data-state='fail'] {
            border-color: rgb(190 24 93 / 18%);
            background: rgb(255 241 242 / 84%);
        }
        .turnero-surface-support-checklist__label {
            font-weight: 700;
        }
        .turnero-surface-support-checklist__detail {
            opacity: 0.84;
            font-size: 0.8rem;
            line-height: 1.45;
        }
        .turnero-surface-support-checklist__empty {
            margin: 0;
            padding: 0.68rem 0.72rem;
            border-radius: 14px;
            border: 1px dashed rgb(15 23 32 / 14%);
            background: rgb(255 255 255 / 70%);
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

function createCheck(key, label, state, detail = '') {
    const normalized = ['pass', 'warn', 'fail'].includes(toString(state))
        ? toString(state)
        : 'warn';
    return {
        key,
        label,
        state: normalized,
        pass: normalized === 'pass',
        warn: normalized === 'warn',
        fail: normalized === 'fail',
        detail: toString(detail),
    };
}

function isClosedEscalation(escalation) {
    const state = toString(escalation?.state).toLowerCase();
    return ['closed', 'resolved', 'dismissed'].includes(state);
}

function isActiveContact(contact) {
    const state = toString(contact?.state).toLowerCase();
    return !['inactive', 'archived', 'disabled', 'hidden', 'removed'].includes(
        state
    );
}

function resolveSupportState(value, fallback = 'unknown') {
    const normalized = toString(value, fallback).toLowerCase();
    if (
        ['ready', 'watch', 'degraded', 'blocked', 'unknown'].includes(
            normalized
        )
    ) {
        return normalized;
    }
    if (['warning', 'pending', 'scheduled'].includes(normalized)) {
        return 'watch';
    }
    if (['alert', 'error'].includes(normalized)) {
        return 'blocked';
    }
    return fallback;
}

function normalizeMaintenanceWindow(source = {}) {
    const window = source && typeof source === 'object' ? source : {};
    const state = resolveSupportState(window.state || window.status, 'ready');
    const windows = Array.isArray(window.windows)
        ? window.windows.map((item) => ({
              ...item,
              startAt: toString(item?.startAt || item?.start_at || ''),
              endAt: toString(item?.endAt || item?.end_at || ''),
              label: toString(
                  item?.label || item?.title || 'Maintenance window'
              ),
              state: resolveSupportState(item?.state || item?.status, state),
          }))
        : [];

    return {
        state,
        label: toString(window.label || 'Maintenance window'),
        summary: toString(
            window.summary || window.supportCopy || window.detail,
            state === 'ready'
                ? 'Sin ventana activa.'
                : state === 'watch'
                  ? 'Ventana visible en observacion.'
                  : state === 'degraded'
                    ? 'Ventana degradada.'
                    : state === 'blocked'
                      ? 'Ventana bloqueada.'
                      : 'Ventana no definida.'
        ),
        supportCopy: toString(window.supportCopy || window.detail, ''),
        windows,
        generatedAt: toString(window.generatedAt || window.updatedAt || ''),
    };
}

function normalizeBackupMode(source = {}, clinicProfile = null) {
    const explicit = source && typeof source === 'object' ? source : {};
    const release =
        clinicProfile?.release && typeof clinicProfile.release === 'object'
            ? clinicProfile.release
            : {};

    const state = resolveSupportState(
        explicit.state || explicit.status || explicit.mode,
        release.separate_deploy === false ? 'watch' : 'ready'
    );
    const enabled =
        typeof explicit.enabled === 'boolean'
            ? explicit.enabled
            : release.separate_deploy !== false;

    return {
        state: enabled ? state : state === 'ready' ? 'watch' : state,
        enabled,
        label: toString(explicit.label || 'Backup mode'),
        summary: toString(
            explicit.summary || explicit.supportCopy || explicit.detail,
            enabled
                ? release.separate_deploy === false
                    ? 'Respaldo compartido o pendiente de separar.'
                    : 'Backup listo.'
                : 'Backup deshabilitado.'
        ),
        supportCopy: toString(explicit.supportCopy || explicit.detail, ''),
        detail: toString(explicit.detail || ''),
        generatedAt: toString(explicit.generatedAt || explicit.updatedAt || ''),
    };
}

function summarizeContacts(contacts = []) {
    const summary = {
        all: 0,
        active: 0,
        primary: 0,
        backup: 0,
        other: 0,
    };

    toArray(contacts).forEach((contact) => {
        summary.all += 1;
        if (isActiveContact(contact)) {
            summary.active += 1;
        }

        const priority = toString(contact?.priority, 'other').toLowerCase();
        if (priority === 'primary') {
            summary.primary += 1;
        } else if (priority === 'backup') {
            summary.backup += 1;
        } else {
            summary.other += 1;
        }
    });

    return summary;
}

function summarizeEscalations(escalations = []) {
    const summary = {
        all: 0,
        open: 0,
        closed: 0,
        tracking: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
    };

    toArray(escalations).forEach((escalation) => {
        summary.all += 1;
        const state = toString(escalation?.state, 'open').toLowerCase();
        const severity = toString(escalation?.severity, 'medium').toLowerCase();

        if (isClosedEscalation(escalation)) {
            summary.closed += 1;
        } else {
            summary.open += 1;
        }
        if (state === 'tracking') {
            summary.tracking += 1;
        }
        if (severity === 'critical') {
            summary.critical += 1;
        } else if (severity === 'high') {
            summary.high += 1;
        } else if (severity === 'low') {
            summary.low += 1;
        } else {
            summary.medium += 1;
        }
    });

    return summary;
}

function resolveChecklistState({
    contacts = [],
    escalations = [],
    maintenanceWindow = {},
    backupMode = {},
    clinicProfile = null,
    surfaceKey = 'admin',
} = {}) {
    const normalizedSurfaceKey = normalizeTurneroSurfaceRecoveryKey(surfaceKey);
    const contactSummary = summarizeContacts(contacts);
    const escalationSummary = summarizeEscalations(escalations);
    const maintenance = normalizeMaintenanceWindow(maintenanceWindow);
    const backup = normalizeBackupMode(backupMode, clinicProfile);
    const checks = [];

    checks.push(
        createCheck(
            'clinic-profile',
            'Perfil clinico visible',
            clinicProfile &&
                toString(clinicProfile.clinic_id || clinicProfile.clinicId)
                ? 'pass'
                : 'fail',
            clinicProfile &&
                toString(clinicProfile.clinic_id || clinicProfile.clinicId)
                ? 'Clinic profile listo para soporte.'
                : 'No hay profile de clinica visible.'
        )
    );
    checks.push(
        createCheck(
            'contact-roster',
            'Roster de contactos visible',
            contactSummary.primary > 0
                ? 'pass'
                : contactSummary.active > 0
                  ? 'warn'
                  : 'fail',
            contactSummary.active > 0
                ? `${contactSummary.active} contacto(s) activos en ${normalizedSurfaceKey}.`
                : 'No hay contactos activos visibles.'
        )
    );
    checks.push(
        createCheck(
            'backup-contact',
            'Contacto de respaldo visible',
            contactSummary.backup > 0
                ? 'pass'
                : contactSummary.active > 1
                  ? 'warn'
                  : 'fail',
            contactSummary.backup > 0
                ? `${contactSummary.backup} contacto(s) de respaldo visibles.`
                : contactSummary.active > 1
                  ? 'Hay mas de un contacto activo pero sin etiqueta backup.'
                  : 'Falta un respaldo visible.'
        )
    );
    checks.push(
        createCheck(
            'open-escalations',
            'Escalaciones controladas',
            escalationSummary.open >= 2
                ? 'fail'
                : escalationSummary.open === 1
                  ? 'warn'
                  : 'pass',
            escalationSummary.open > 0
                ? `${escalationSummary.open} escalacion(es) abiertas.`
                : 'No hay escalaciones abiertas.'
        )
    );
    checks.push(
        createCheck(
            'maintenance-window',
            'Ventana de mantenimiento visible',
            maintenance.state === 'blocked' || maintenance.state === 'degraded'
                ? 'fail'
                : maintenance.state === 'watch' ||
                    maintenance.state === 'unknown'
                  ? 'warn'
                  : 'pass',
            maintenance.summary
        )
    );
    checks.push(
        createCheck(
            'backup-mode',
            'Modo backup visible',
            backup.state === 'blocked' || backup.state === 'degraded'
                ? 'fail'
                : backup.state === 'watch'
                  ? 'warn'
                  : 'pass',
            backup.summary
        )
    );

    const passCount = checks.filter((check) => check.pass).length;
    const warnCount = checks.filter((check) => check.warn).length;
    const failCount = checks.filter((check) => check.fail).length;
    const score = Math.max(
        0,
        Math.min(
            100,
            Math.round(
                ((passCount + warnCount * 0.5) / Math.max(1, checks.length)) *
                    100
            )
        )
    );

    return {
        surfaceKey: normalizedSurfaceKey,
        checks,
        summary: {
            all: checks.length,
            pass: passCount,
            warn: warnCount,
            fail: failCount,
            score,
            openEscalations: escalationSummary.open,
            activeContacts: contactSummary.active,
            primaryContacts: contactSummary.primary,
            backupContacts: contactSummary.backup,
            maintenanceState: maintenance.state,
            backupState: backup.state,
        },
        contactSummary,
        escalationSummary,
        maintenanceWindow: maintenance,
        backupMode: backup,
        generatedAt: new Date().toISOString(),
    };
}

export function buildTurneroSurfaceSupportChecklist(input = {}) {
    return resolveChecklistState(input);
}

export function renderTurneroSurfaceSupportChecklist(checklist = {}) {
    ensureSupportChecklistStyles();
    const summary = checklist.summary || {
        pass: 0,
        warn: 0,
        fail: 0,
        all: 0,
        score: 0,
    };
    const items = toArray(checklist.checks);

    return `
        <section class="turnero-surface-support-checklist" data-score="${escapeHtml(
            String(summary.score || 0)
        )}">
            <header class="turnero-surface-support-checklist__header">
                <div>
                    <p class="turnero-surface-support-checklist__eyebrow">Support checklist</p>
                    <h4>Checklist de soporte</h4>
                </div>
                <span class="turnero-surface-support-checklist__summary">
                    ${escapeHtml(
                        `${Number(summary.pass || 0)}/${Number(summary.all || 0)} pass · ${Number(summary.warn || 0)} warn · ${Number(summary.fail || 0)} fail`
                    )}
                </span>
            </header>
            ${
                items.length
                    ? `<ul class="turnero-surface-support-checklist__items">${items
                          .map(
                              (item) => `
                                <li class="turnero-surface-support-checklist__item" data-state="${escapeHtml(
                                    item.state
                                )}">
                                    <span class="turnero-surface-support-checklist__label">${escapeHtml(
                                        item.label
                                    )}</span>
                                    <span class="turnero-surface-support-checklist__detail">${escapeHtml(
                                        item.detail || ''
                                    )}</span>
                                </li>
                            `
                          )
                          .join('')}</ul>`
                    : '<p class="turnero-surface-support-checklist__empty">Sin checks de soporte.</p>'
            }
        </section>
    `.trim();
}

export {
    ensureSupportChecklistStyles,
    normalizeMaintenanceWindow as normalizeTurneroSurfaceSupportMaintenanceWindow,
    normalizeBackupMode as normalizeTurneroSurfaceSupportBackupMode,
    summarizeContacts as summarizeTurneroSurfaceSupportContacts,
    summarizeEscalations as summarizeTurneroSurfaceSupportEscalations,
};
