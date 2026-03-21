import { createTurneroSurfaceEscalationLedger } from './turnero-surface-escalation-ledger.js';
import { createTurneroSurfaceSupportContactStore } from './turnero-surface-support-contact-store.js';
import {
    buildTurneroSurfaceSupportPack,
    formatTurneroSurfaceSupportBrief,
} from './turnero-surface-support-pack.js';
import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import { renderTurneroSurfaceSupportChecklist } from './turnero-surface-support-checklist.js';
import {
    asObject,
    copyTextToClipboard,
    downloadJsonSnapshot,
    escapeHtml,
    formatTimestamp,
    resolveTarget,
    toArray,
    toString,
} from './turnero-surface-helpers.js';
import { normalizeTurneroSurfaceRecoveryKey } from './turnero-surface-contract-snapshot.js';

const STYLE_ID = 'turneroSurfaceSupportConsoleInlineStyles';

function ensureSupportConsoleStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-admin-queue-surface-support-console__header-copy {
            display: grid;
            gap: 0.18rem;
        }
        .turnero-admin-queue-surface-support-console__metric {
            display: grid;
            gap: 0.2rem;
            padding: 0.78rem 0.88rem;
            border-radius: 18px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 80%);
        }
        .turnero-admin-queue-surface-support-console__metric strong {
            font-size: 1.05rem;
        }
        .turnero-admin-queue-surface-support-console__surface-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 0.5rem;
        }
        .turnero-admin-queue-surface-support-console__surface-grid div {
            padding: 0.55rem 0.62rem;
            border-radius: 14px;
            background: rgb(15 23 32 / 3%);
        }
        .turnero-admin-queue-surface-support-console__surface-grid dt {
            font-size: 0.72rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            opacity: 0.68;
        }
        .turnero-admin-queue-surface-support-console__surface-grid dd {
            margin: 0.2rem 0 0;
            font-weight: 700;
        }
        .turnero-admin-queue-surface-support-console__split {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 0.72rem;
        }
        .turnero-admin-queue-surface-support-console__form {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 0.6rem;
            padding: 0.8rem;
            border-radius: 18px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 72%);
        }
        .turnero-admin-queue-surface-support-console__form label {
            display: grid;
            gap: 0.3rem;
            font-size: 0.78rem;
        }
        .turnero-admin-queue-surface-support-console__form input,
        .turnero-admin-queue-surface-support-console__form select,
        .turnero-admin-queue-surface-support-console__form textarea {
            min-height: 38px;
            padding: 0.48rem 0.62rem;
            border-radius: 12px;
            border: 1px solid rgb(15 23 32 / 14%);
            background: rgb(255 255 255 / 96%);
            color: inherit;
            font: inherit;
        }
        .turnero-admin-queue-surface-support-console__form textarea {
            min-height: 82px;
            resize: vertical;
        }
        .turnero-admin-queue-surface-support-console__form-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.45rem;
            align-items: end;
        }
        .turnero-admin-queue-surface-support-console__checklist,
        .turnero-admin-queue-surface-support-console__list {
            display: grid;
            gap: 0.45rem;
        }
        .turnero-admin-queue-surface-support-console__entry {
            display: flex;
            justify-content: space-between;
            gap: 0.7rem;
            align-items: flex-start;
            padding: 0.72rem 0.8rem;
            border-radius: 16px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 76%);
        }
        .turnero-admin-queue-surface-support-console__entry p {
            margin: 0.08rem 0 0;
        }
        .turnero-admin-queue-surface-support-console__entry[data-state='open'] {
            border-color: rgb(180 83 9 / 18%);
        }
        .turnero-admin-queue-surface-support-console__entry[data-state='closed'] {
            opacity: 0.72;
        }
        .turnero-admin-queue-surface-support-console__entry-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 0.35rem;
            align-items: center;
            justify-content: flex-end;
        }
        .turnero-admin-queue-surface-support-console__pill {
            display: inline-flex;
            align-items: center;
            min-height: 28px;
            padding: 0.22rem 0.5rem;
            border-radius: 999px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 84%);
            font-size: 0.72rem;
        }
        .turnero-admin-queue-surface-support-console__brief {
            margin: 0;
            padding: 0.85rem 0.95rem;
            border-radius: 18px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 82%);
            white-space: pre-wrap;
            font-size: 0.84rem;
            line-height: 1.5;
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

function buildDefaultSurfaceOptions(clinicProfile = null) {
    const surfaces =
        clinicProfile?.surfaces && typeof clinicProfile.surfaces === 'object'
            ? clinicProfile.surfaces
            : {};
    const order = ['admin', 'operator', 'kiosk', 'display'];
    return order.map((surfaceKey) => ({
        surfaceKey,
        label: toString(
            surfaces?.[surfaceKey]?.label ||
                surfaces?.[surfaceKey]?.short_label ||
                surfaceKey,
            surfaceKey
        ),
    }));
}

function normalizeSurfaceOptions(input = {}, clinicProfile = null) {
    if (
        Array.isArray(input.surfaceOptions) &&
        input.surfaceOptions.length > 0
    ) {
        return input.surfaceOptions
            .map((option) => {
                const source = asObject(option);
                const surfaceKey = normalizeTurneroSurfaceRecoveryKey(
                    source.surfaceKey || source.value || source.key || 'admin'
                );
                return {
                    surfaceKey,
                    label: toString(
                        source.label || source.name || surfaceKey,
                        surfaceKey
                    ),
                };
            })
            .filter((option) => Boolean(option.surfaceKey));
    }

    return buildDefaultSurfaceOptions(clinicProfile);
}

function resolveScope(input = {}, clinicProfile = null) {
    return toString(
        input.scope ||
            clinicProfile?.region ||
            clinicProfile?.branding?.city ||
            'queue-support',
        'queue-support'
    );
}

function buildMetricCard(label, value, state = 'ready') {
    return `
        <article class="turnero-admin-queue-surface-support-console__metric" data-state="${escapeHtml(
            state
        )}">
            <strong>${escapeHtml(String(value))}</strong>
            <span>${escapeHtml(label)}</span>
        </article>
    `;
}

function renderChecklistSection(pack) {
    return `
        <div class="turnero-surface-ops-console__section">
            <h4>Checklist</h4>
            ${renderTurneroSurfaceSupportChecklist(pack.checklist)}
        </div>
    `;
}

function renderContactsForm(state) {
    const options = state.surfaceOptions
        .map(
            (option) => `
                <option value="${escapeHtml(option.surfaceKey)}">${escapeHtml(
                    option.label || option.surfaceKey
                )}</option>
            `
        )
        .join('');

    return `
        <form class="turnero-admin-queue-surface-support-console__form" data-role="contact-form">
            <label>
                <span>Surface</span>
                <select data-field="contact-surface-key">${options}</select>
            </label>
            <label>
                <span>Name</span>
                <input type="text" data-field="contact-name" placeholder="Nombre de soporte" />
            </label>
            <label>
                <span>Role</span>
                <input type="text" data-field="contact-role" placeholder="ops" />
            </label>
            <label>
                <span>Channel</span>
                <select data-field="contact-channel">
                    <option value="phone">phone</option>
                    <option value="whatsapp">whatsapp</option>
                    <option value="email">email</option>
                    <option value="sms">sms</option>
                </select>
            </label>
            <label>
                <span>Phone</span>
                <input type="text" data-field="contact-phone" placeholder="+593..." />
            </label>
            <label>
                <span>Priority</span>
                <select data-field="contact-priority">
                    <option value="primary">primary</option>
                    <option value="backup">backup</option>
                    <option value="other">other</option>
                </select>
            </label>
            <label style="grid-column: 1 / -1;">
                <span>Note</span>
                <textarea data-field="contact-note" placeholder="Contacto de soporte"></textarea>
            </label>
            <div class="turnero-admin-queue-surface-support-console__form-actions" style="grid-column: 1 / -1;">
                <button type="button" class="turnero-surface-ops-console__button" data-action="add-contact" data-tone="primary">
                    Add contact
                </button>
            </div>
        </form>
    `;
}

function renderEscalationForm(state) {
    const options = state.surfaceOptions
        .map(
            (option) => `
                <option value="${escapeHtml(option.surfaceKey)}">${escapeHtml(
                    option.label || option.surfaceKey
                )}</option>
            `
        )
        .join('');

    return `
        <form class="turnero-admin-queue-surface-support-console__form" data-role="escalation-form">
            <label>
                <span>Surface</span>
                <select data-field="escalation-surface-key">${options}</select>
            </label>
            <label>
                <span>Title</span>
                <input type="text" data-field="escalation-title" placeholder="Escalation title" />
            </label>
            <label>
                <span>Severity</span>
                <select data-field="escalation-severity">
                    <option value="low">low</option>
                    <option value="medium" selected>medium</option>
                    <option value="high">high</option>
                    <option value="critical">critical</option>
                </select>
            </label>
            <label>
                <span>Owner</span>
                <input type="text" data-field="escalation-owner" placeholder="ops" />
            </label>
            <label style="grid-column: 1 / -1;">
                <span>Detail</span>
                <textarea data-field="escalation-detail" placeholder="Que debe revisarse"></textarea>
            </label>
            <div class="turnero-admin-queue-surface-support-console__form-actions" style="grid-column: 1 / -1;">
                <button type="button" class="turnero-surface-ops-console__button" data-action="add-escalation" data-tone="primary">
                    Add escalation
                </button>
            </div>
        </form>
    `;
}

function renderContactList(state) {
    const contacts = Array.isArray(state.contacts) ? state.contacts : [];
    if (contacts.length === 0) {
        return '<p class="turnero-surface-ops-console__empty">Sin contactos activos.</p>';
    }

    return `
        <div class="turnero-admin-queue-surface-support-console__list">
            ${contacts
                .map(
                    (contact) => `
                        <article class="turnero-admin-queue-surface-support-console__entry" data-state="${escapeHtml(
                            contact.state || 'active'
                        )}" data-priority="${escapeHtml(
                            contact.priority || 'other'
                        )}">
                            <div>
                                <strong>${escapeHtml(contact.name || 'Support contact')}</strong>
                                <p>${escapeHtml(
                                    `${contact.surfaceKey || 'surface'} · ${contact.role || 'ops'} · ${contact.channel || 'phone'} · ${contact.phone || ''}`
                                )}</p>
                                <p>${escapeHtml(contact.note || 'Sin nota')}</p>
                            </div>
                            <div class="turnero-admin-queue-surface-support-console__entry-meta">
                                <span class="turnero-admin-queue-surface-support-console__pill">${escapeHtml(
                                    contact.priority || 'other'
                                )}</span>
                                <span class="turnero-admin-queue-surface-support-console__pill">${escapeHtml(
                                    formatTimestamp(
                                        contact.updatedAt || contact.createdAt
                                    )
                                )}</span>
                            </div>
                        </article>
                    `
                )
                .join('')}
        </div>
    `;
}

function renderEscalationList(state) {
    const escalations = Array.isArray(state.openEscalations)
        ? state.openEscalations
        : [];
    if (escalations.length === 0) {
        return '<p class="turnero-surface-ops-console__empty">Sin escalaciones abiertas.</p>';
    }

    return `
        <div class="turnero-admin-queue-surface-support-console__list">
            ${escalations
                .map(
                    (escalation) => `
                        <article class="turnero-admin-queue-surface-support-console__entry" data-state="${escapeHtml(
                            escalation.state || 'open'
                        )}" data-severity="${escapeHtml(
                            escalation.severity || 'medium'
                        )}">
                            <div>
                                <strong>${escapeHtml(
                                    escalation.title || 'Support escalation'
                                )}</strong>
                                <p>${escapeHtml(
                                    `${escalation.surfaceKey || 'surface'} · ${escalation.severity || 'medium'} · ${escalation.owner || 'ops'}`
                                )}</p>
                                <p>${escapeHtml(escalation.detail || 'Sin detalle')}</p>
                            </div>
                            <div class="turnero-admin-queue-surface-support-console__entry-meta">
                                <span class="turnero-admin-queue-surface-support-console__pill">${escapeHtml(
                                    escalation.state || 'open'
                                )}</span>
                                <span class="turnero-admin-queue-surface-support-console__pill">${escapeHtml(
                                    formatTimestamp(
                                        escalation.updatedAt ||
                                            escalation.createdAt
                                    )
                                )}</span>
                                <button type="button" class="turnero-surface-ops-console__button" data-action="close-escalation" data-escalation-id="${escapeHtml(
                                    escalation.id
                                )}">
                                    Close
                                </button>
                            </div>
                        </article>
                    `
                )
                .join('')}
        </div>
    `;
}

function buildDownloadPayload(state) {
    return {
        scope: state.scope,
        clinicProfile: state.clinicProfile,
        pack: state.pack,
        contacts: state.contacts,
        openEscalations: state.openEscalations,
        allEscalations: state.allEscalations,
        surfaceOptions: state.surfaceOptions,
        generatedAt: state.generatedAt,
        currentRoute:
            typeof window !== 'undefined'
                ? `${window.location.pathname || ''}${window.location.search || ''}${
                      window.location.hash || ''
                  }`
                : '',
    };
}

function buildConsoleState(input = {}) {
    const clinicProfile = asObject(input.clinicProfile);
    const scope = resolveScope(input, clinicProfile);
    const surfaceKey = normalizeTurneroSurfaceRecoveryKey(
        input.surfaceKey || 'admin'
    );
    const contactStore =
        input.contactStore &&
        typeof input.contactStore.list === 'function' &&
        typeof input.contactStore.add === 'function'
            ? input.contactStore
            : createTurneroSurfaceSupportContactStore(scope, clinicProfile);
    const escalationLedger =
        input.escalationLedger &&
        typeof input.escalationLedger.list === 'function' &&
        typeof input.escalationLedger.add === 'function'
            ? input.escalationLedger
            : createTurneroSurfaceEscalationLedger(scope, clinicProfile);
    const pack = buildTurneroSurfaceSupportPack({
        ...input,
        scope,
        surfaceKey,
        clinicProfile,
        contactStore,
        escalationLedger,
    });
    const contactSnapshot =
        typeof contactStore.snapshot === 'function'
            ? contactStore.snapshot()
            : { contacts: [], summary: {} };
    const escalationSnapshot =
        typeof escalationLedger.snapshot === 'function'
            ? escalationLedger.snapshot()
            : { escalations: [], summary: {} };

    return {
        scope,
        clinicProfile,
        surfaceKey,
        surfaceOptions: normalizeSurfaceOptions(input, clinicProfile),
        contactStore,
        escalationLedger,
        pack,
        contacts: contactStore.list({ includeInactive: false }),
        allContacts: Array.isArray(contactSnapshot.contacts)
            ? contactSnapshot.contacts
            : [],
        openEscalations: escalationLedger.list({ includeClosed: false }),
        allEscalations: Array.isArray(escalationSnapshot.escalations)
            ? escalationSnapshot.escalations
            : [],
        brief: formatTurneroSurfaceSupportBrief(pack),
        generatedAt: new Date().toISOString(),
    };
}

function renderMetricsHtml(state) {
    const contactSummary = asObject(state.pack.snapshot?.contactSummary);
    const escalationSummary = asObject(state.pack.snapshot?.escalationSummary);
    const maintenance = asObject(state.pack.snapshot?.maintenanceWindow);
    const backup = asObject(state.pack.snapshot?.backupMode);
    const gate = asObject(state.pack.gate);

    return `
        ${buildMetricCard(
            'Contacts',
            `${Number(contactSummary.active || 0)}/${Number(contactSummary.all || 0)}`,
            Number(contactSummary.active || 0) === 0
                ? 'alert'
                : Number(contactSummary.primary || 0) === 0
                  ? 'warning'
                  : 'ready'
        )}
        ${buildMetricCard(
            'Open escalations',
            Number(escalationSummary.open || 0),
            Number(escalationSummary.open || 0) >= 2
                ? 'alert'
                : Number(escalationSummary.open || 0) === 1
                  ? 'warning'
                  : 'ready'
        )}
        ${buildMetricCard(
            'Gate',
            `${Number(gate.score || 0) || 0} · ${toString(gate.band, 'watch')}`,
            gate.band === 'ready'
                ? 'ready'
                : gate.band === 'watch'
                  ? 'warning'
                  : 'alert'
        )}
        ${buildMetricCard(
            'Maintenance',
            `${toString(maintenance.state, 'ready')} / ${toString(backup.state, 'ready')}`,
            maintenance.state === 'degraded' || backup.state === 'degraded'
                ? 'alert'
                : maintenance.state === 'watch' || backup.state === 'watch'
                  ? 'warning'
                  : 'ready'
        )}
    `;
}

function renderConsoleHtml(state) {
    const pack = asObject(state.pack);
    const readout = asObject(pack.readout);
    const checklistSection = renderChecklistSection(pack);

    return `
        <section
            class="turnero-surface-ops-console turnero-admin-queue-surface-support-console"
            data-scope="${escapeHtml(state.scope)}"
            data-state="${escapeHtml(toString(pack.gate?.band, 'watch'))}"
        >
            <div class="turnero-surface-ops-console__header">
                <div class="turnero-admin-queue-surface-support-console__header-copy">
                    <p class="turnero-surface-ops-console__surface-title">Surface support</p>
                    <h3>Surface Support Console</h3>
                    <p>
                        ${escapeHtml(
                            `${toString(readout.summary, 'Support ready.')} · ${toString(readout.detail, '')}`
                        )}
                    </p>
                </div>
                <div class="turnero-surface-ops-console__actions">
                    <button type="button" class="turnero-surface-ops-console__button" data-action="copy-brief" data-tone="primary">
                        Copy brief
                    </button>
                    <button type="button" class="turnero-surface-ops-console__button" data-action="download-json">
                        Download JSON
                    </button>
                </div>
            </div>
            <div class="turnero-surface-ops-console__grid">
                ${renderMetricsHtml(state)}
            </div>
            ${checklistSection}
            <div class="turnero-surface-ops-console__section">
                <h4>Contacts</h4>
                ${renderContactsForm(state)}
                ${renderContactList(state)}
            </div>
            <div class="turnero-surface-ops-console__section">
                <h4>Escalations</h4>
                ${renderEscalationForm(state)}
                ${renderEscalationList(state)}
            </div>
            <pre class="turnero-admin-queue-surface-support-console__brief" data-role="brief">${escapeHtml(
                state.brief || ''
            )}</pre>
        </section>
    `;
}

function bindConsoleActions(root, controller) {
    if (
        !(root instanceof HTMLElement) ||
        root.dataset.turneroSupportConsoleBound === 'true'
    ) {
        return;
    }

    root.dataset.turneroSupportConsoleBound = 'true';
    root.addEventListener('click', async (event) => {
        const targetNode =
            event.target instanceof Element
                ? event.target.closest('[data-action]')
                : null;
        if (!(targetNode instanceof HTMLElement)) {
            return;
        }

        const action = String(targetNode.dataset.action || '');
        if (!action) {
            return;
        }

        if (action === 'copy-brief') {
            await copyTextToClipboard(controller.state.brief);
            return;
        }

        if (action === 'download-json') {
            downloadJsonSnapshot(
                'turnero-surface-support-console.json',
                buildDownloadPayload(controller.state)
            );
            return;
        }

        if (action === 'add-contact') {
            const surfaceField = root.querySelector(
                '[data-field="contact-surface-key"]'
            );
            const nameField = root.querySelector('[data-field="contact-name"]');
            const roleField = root.querySelector('[data-field="contact-role"]');
            const channelField = root.querySelector(
                '[data-field="contact-channel"]'
            );
            const phoneField = root.querySelector(
                '[data-field="contact-phone"]'
            );
            const priorityField = root.querySelector(
                '[data-field="contact-priority"]'
            );
            const noteField = root.querySelector('[data-field="contact-note"]');

            controller.state.contactStore.add({
                surfaceKey: toString(
                    surfaceField?.value,
                    controller.state.surfaceKey
                ),
                name: toString(nameField?.value, 'Support contact'),
                role: toString(roleField?.value, 'ops'),
                channel: toString(channelField?.value, 'phone'),
                phone: toString(phoneField?.value, ''),
                priority: toString(priorityField?.value, 'primary'),
                note: toString(noteField?.value, ''),
                source: 'manual',
                state: 'active',
            });

            if (nameField) {
                nameField.value = '';
            }
            if (roleField) {
                roleField.value = '';
            }
            if (phoneField) {
                phoneField.value = '';
            }
            if (noteField) {
                noteField.value = '';
            }
            controller.refresh();
            return;
        }

        if (action === 'add-escalation') {
            const surfaceField = root.querySelector(
                '[data-field="escalation-surface-key"]'
            );
            const titleField = root.querySelector(
                '[data-field="escalation-title"]'
            );
            const severityField = root.querySelector(
                '[data-field="escalation-severity"]'
            );
            const ownerField = root.querySelector(
                '[data-field="escalation-owner"]'
            );
            const detailField = root.querySelector(
                '[data-field="escalation-detail"]'
            );

            controller.state.escalationLedger.add({
                surfaceKey: toString(
                    surfaceField?.value,
                    controller.state.surfaceKey
                ),
                title: toString(titleField?.value, 'Support escalation'),
                severity: toString(severityField?.value, 'medium'),
                owner: toString(ownerField?.value, 'ops'),
                detail: toString(detailField?.value, ''),
                source: 'manual',
                state: 'open',
            });

            if (titleField) {
                titleField.value = '';
            }
            if (ownerField) {
                ownerField.value = '';
            }
            if (detailField) {
                detailField.value = '';
            }
            controller.refresh();
            return;
        }

        if (action === 'close-escalation') {
            const escalationId = toString(
                targetNode.getAttribute('data-escalation-id'),
                ''
            );
            if (!escalationId) {
                return;
            }
            controller.state.escalationLedger.close(escalationId);
            controller.refresh();
        }
    });
}

export function buildTurneroAdminQueueSurfaceSupportConsoleHtml(input = {}) {
    return renderConsoleHtml(buildConsoleState(input));
}

export function mountTurneroAdminQueueSurfaceSupportConsole(
    target,
    input = {}
) {
    if (typeof document === 'undefined') {
        return null;
    }

    const host = resolveTarget(target);
    if (!host) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureSupportConsoleStyles();

    const controller = {
        root: null,
        state: buildConsoleState(input),
        refresh() {
            controller.state = buildConsoleState({
                ...input,
                contactStore: controller.state.contactStore,
                escalationLedger: controller.state.escalationLedger,
                surfaceKey: controller.state.surfaceKey,
                scope: controller.state.scope,
            });
            if (controller.root) {
                controller.root.innerHTML = renderConsoleHtml(controller.state);
            }
            return controller.root;
        },
    };

    host.innerHTML = renderConsoleHtml(controller.state);
    controller.root = host;
    bindConsoleActions(controller.root, controller);
    controller.ready = Promise.resolve(controller);
    return controller;
}
