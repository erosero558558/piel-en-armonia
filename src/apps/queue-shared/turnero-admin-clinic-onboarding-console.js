import {
    buildTurneroClinicOnboardingPack,
    getDefaultTurneroClinicOnboardingDraft,
} from './turnero-clinic-onboarding-pack.js';
import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    escapeHtml,
    resolveTarget,
    toArray,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroAdminClinicOnboardingConsoleInlineStyles';
const STORAGE_KEY = 'turnero-admin-clinic-onboarding-console/v1';

function ensureConsoleStyles() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) {
        return;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-admin-clinic-onboarding-console{display:grid;gap:1rem}
        .turnero-admin-clinic-onboarding-console__header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.85rem;align-items:flex-start}
        .turnero-admin-clinic-onboarding-console__header h3,.turnero-admin-clinic-onboarding-console__section h4,.turnero-admin-clinic-onboarding-console__meta,.turnero-admin-clinic-onboarding-console__eyebrow,.turnero-admin-clinic-onboarding-console__support{margin:0}
        .turnero-admin-clinic-onboarding-console__eyebrow{font-size:.76rem;letter-spacing:.12em;text-transform:uppercase;opacity:.68}
        .turnero-admin-clinic-onboarding-console__header h3{font-family:'FrauncesSoft',serif;font-weight:500}
        .turnero-admin-clinic-onboarding-console__support{font-size:.86rem;line-height:1.45;opacity:.82}
        .turnero-admin-clinic-onboarding-console__actions{display:flex;flex-wrap:wrap;gap:.45rem}
        .turnero-admin-clinic-onboarding-console__button{min-height:38px;padding:.56rem .84rem;border-radius:999px;border:1px solid rgb(15 23 32 / 12%);background:rgb(255 255 255 / 88%);color:inherit;font:inherit;cursor:pointer}
        .turnero-admin-clinic-onboarding-console__button[data-tone='primary']{border-color:rgb(15 107 220 / 22%);background:rgb(15 107 220 / 10%);color:rgb(10 67 137)}
        .turnero-admin-clinic-onboarding-console__button[data-tone='danger']{border-color:rgb(190 24 93 / 20%);background:rgb(190 24 93 / 10%);color:rgb(157 23 77)}
        .turnero-admin-clinic-onboarding-console__metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.65rem}
        .turnero-admin-clinic-onboarding-console__metric{display:grid;gap:.15rem;padding:.82rem .9rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%)}
        .turnero-admin-clinic-onboarding-console__metric strong{font-size:1.03rem}
        .turnero-admin-clinic-onboarding-console__layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(300px,.95fr);gap:.9rem}
        .turnero-admin-clinic-onboarding-console__stack,.turnero-admin-clinic-onboarding-console__preview{display:grid;gap:.9rem}
        .turnero-admin-clinic-onboarding-console__section{display:grid;gap:.6rem;padding:.95rem 1rem;border-radius:22px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%)}
        .turnero-admin-clinic-onboarding-console__section[data-state='ready']{border-color:rgb(22 163 74 / 20%)}
        .turnero-admin-clinic-onboarding-console__section[data-state='watch']{border-color:rgb(180 83 9 / 18%)}
        .turnero-admin-clinic-onboarding-console__section[data-state='blocked']{border-color:rgb(190 24 93 / 18%)}
        .turnero-admin-clinic-onboarding-console__forms{display:grid;gap:.75rem}
        .turnero-admin-clinic-onboarding-console__form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem}
        .turnero-admin-clinic-onboarding-console__form label{display:grid;gap:.28rem;font-size:.78rem}
        .turnero-admin-clinic-onboarding-console__form input,.turnero-admin-clinic-onboarding-console__form select{min-height:38px;padding:.48rem .62rem;border-radius:12px;border:1px solid rgb(15 23 32 / 14%);background:rgb(255 255 255 / 96%);color:inherit;font:inherit}
        .turnero-admin-clinic-onboarding-console__entry-list,.turnero-admin-clinic-onboarding-console__url-list{display:grid;gap:.5rem}
        .turnero-admin-clinic-onboarding-console__entry,.turnero-admin-clinic-onboarding-console__url{display:grid;gap:.2rem;padding:.72rem .8rem;border-radius:16px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 76%)}
        .turnero-admin-clinic-onboarding-console__url code,.turnero-admin-clinic-onboarding-console__json{overflow:auto}
        .turnero-admin-clinic-onboarding-console__json,.turnero-admin-clinic-onboarding-console__brief{margin:0;padding:.85rem .95rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(247 248 250 / 96%);white-space:pre-wrap;font-size:.82rem;line-height:1.5}
        .turnero-admin-clinic-onboarding-console__flag-list{display:grid;gap:.32rem}
        .turnero-admin-clinic-onboarding-console__flag{padding:.58rem .72rem;border-radius:14px;background:rgb(15 23 32 / 4%);font-size:.82rem}
        .turnero-admin-clinic-onboarding-console__flag[data-tone='blocked']{background:rgb(190 24 93 / 10%)}
        .turnero-admin-clinic-onboarding-console__flag[data-tone='watch']{background:rgb(180 83 9 / 10%)}
        @media (max-width:980px){.turnero-admin-clinic-onboarding-console__layout{grid-template-columns:1fr}}
        @media (max-width:760px){.turnero-admin-clinic-onboarding-console__header{flex-direction:column}}
    `;
    document.head.appendChild(styleEl);
}

function getStorage(storage) {
    if (storage && typeof storage.getItem === 'function') {
        return storage;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
        return localStorage;
    }
    return null;
}

function cloneRows(rows = []) {
    return toArray(rows).map((entry) => ({ ...asObject(entry) }));
}

function loadPersistedState(storage, fallbackState) {
    if (!storage || typeof storage.getItem !== 'function') {
        return fallbackState;
    }

    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) {
            return fallbackState;
        }
        const parsed = JSON.parse(raw);
        return {
            clinicDraft: {
                ...fallbackState.clinicDraft,
                ...asObject(parsed.clinicDraft),
            },
            staffRows:
                cloneRows(parsed.staffRows).length > 0
                    ? cloneRows(parsed.staffRows)
                    : fallbackState.staffRows,
            serviceRows:
                cloneRows(parsed.serviceRows).length > 0
                    ? cloneRows(parsed.serviceRows)
                    : fallbackState.serviceRows,
        };
    } catch (_error) {
        return fallbackState;
    }
}

function persistState(storage, state) {
    if (!storage || typeof storage.setItem !== 'function') {
        return;
    }
    try {
        storage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                clinicDraft: state.clinicDraft,
                staffRows: state.staffRows,
                serviceRows: state.serviceRows,
            })
        );
    } catch (_error) {
        // best effort only
    }
}

function clearPersistedState(storage) {
    if (!storage || typeof storage.removeItem !== 'function') {
        return;
    }
    try {
        storage.removeItem(STORAGE_KEY);
    } catch (_error) {
        // best effort only
    }
}

function getFieldValue(host, selector, fallback = '') {
    return toString(host.querySelector(selector)?.value, fallback);
}

function getClinicDraftFromForm(host, previousDraft = {}) {
    return {
        ...previousDraft,
        brandName: getFieldValue(
            host,
            '[data-field="clinic-brand-name"]',
            previousDraft.brandName
        ),
        shortName: getFieldValue(
            host,
            '[data-field="clinic-short-name"]',
            previousDraft.shortName
        ),
        city: getFieldValue(host, '[data-field="clinic-city"]', previousDraft.city),
        clinicId: getFieldValue(
            host,
            '[data-field="clinic-id"]',
            previousDraft.clinicId
        ),
        tenantDomain: getFieldValue(
            host,
            '[data-field="clinic-tenant-domain"]',
            previousDraft.tenantDomain
        ),
        baseUrl: getFieldValue(
            host,
            '[data-field="clinic-base-url"]',
            previousDraft.baseUrl
        ),
        consultorio1Label: getFieldValue(
            host,
            '[data-field="clinic-c1-label"]',
            previousDraft.consultorio1Label
        ),
        consultorio1ShortLabel: getFieldValue(
            host,
            '[data-field="clinic-c1-short-label"]',
            previousDraft.consultorio1ShortLabel
        ),
        consultorio2Label: getFieldValue(
            host,
            '[data-field="clinic-c2-label"]',
            previousDraft.consultorio2Label
        ),
        consultorio2ShortLabel: getFieldValue(
            host,
            '[data-field="clinic-c2-short-label"]',
            previousDraft.consultorio2ShortLabel
        ),
        releaseMode: getFieldValue(
            host,
            '[data-field="clinic-release-mode"]',
            previousDraft.releaseMode
        ),
    };
}

function getStaffRowFromForm(host) {
    return {
        name: getFieldValue(host, '[data-field="staff-name"]'),
        role: getFieldValue(host, '[data-field="staff-role"]', 'doctor'),
        station: getFieldValue(host, '[data-field="staff-station"]', 'c1'),
        shift: getFieldValue(host, '[data-field="staff-shift"]', 'am'),
    };
}

function getServiceRowFromForm(host) {
    return {
        label: getFieldValue(host, '[data-field="service-label"]'),
        category: getFieldValue(
            host,
            '[data-field="service-category"]',
            'dermatologia'
        ),
        mode: getFieldValue(host, '[data-field="service-mode"]', 'presencial'),
        durationMinutes: Number(
            getFieldValue(host, '[data-field="service-duration"]', '30')
        ),
    };
}

function clearFormFields(host, selectors = []) {
    selectors.forEach((selector) => {
        const field = host.querySelector(selector);
        if (field) {
            field.value = '';
        }
    });
}

function renderMetric(label, value, detail) {
    return `<article class="turnero-admin-clinic-onboarding-console__metric"><span>${escapeHtml(
        label
    )}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(
        detail
    )}</small></article>`;
}

function renderEntries(rows, emptyMessage, formatter) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return `<p class="turnero-admin-clinic-onboarding-console__meta">${escapeHtml(
            emptyMessage
        )}</p>`;
    }

    return `<div class="turnero-admin-clinic-onboarding-console__entry-list">${rows
        .map((row) => formatter(row))
        .join('')}</div>`;
}

function renderFlags(summary) {
    const rows = [
        ...toArray(summary.blockers).map((item) => ({
            tone: 'blocked',
            label: item,
        })),
        ...toArray(summary.warnings).map((item) => ({
            tone: 'watch',
            label: item,
        })),
    ];

    if (rows.length === 0) {
        return `<p class="turnero-admin-clinic-onboarding-console__meta">Sin bloqueos ni advertencias.</p>`;
    }

    return `<div class="turnero-admin-clinic-onboarding-console__flag-list">${rows
        .map(
            (row) =>
                `<div class="turnero-admin-clinic-onboarding-console__flag" data-tone="${escapeHtml(
                    row.tone
                )}">${escapeHtml(row.label)}</div>`
        )
        .join('')}</div>`;
}

function renderConsoleHtml(state) {
    const summary = asObject(state.pack?.summary);
    const profile = asObject(state.pack?.turneroClinicProfile);
    const urls = toArray(state.pack?.urls);

    return `
        <section class="turnero-admin-clinic-onboarding-console" data-role="console" data-state="${escapeHtml(
            summary.state || 'blocked'
        )}">
            <div class="turnero-admin-clinic-onboarding-console__header">
                <div>
                    <p class="turnero-admin-clinic-onboarding-console__eyebrow">Clinic onboarding</p>
                    <h3>Clinic Onboarding Studio</h3>
                    <p class="turnero-admin-clinic-onboarding-console__meta">${escapeHtml(
                        summary.label ||
                            'Registra la clinica, genera TurneroClinicProfile, carga staff y activa servicios.'
                    )}</p>
                    <p class="turnero-admin-clinic-onboarding-console__support">Registrar clinica → generar <code>TurneroClinicProfile</code> → cargar staff → activar servicios → compartir URLs canonicas.</p>
                </div>
                <div class="turnero-admin-clinic-onboarding-console__actions">
                    <button type="button" class="turnero-admin-clinic-onboarding-console__button" data-action="copy-brief" data-tone="primary">Copy brief</button>
                    <button type="button" class="turnero-admin-clinic-onboarding-console__button" data-action="download-json">Download JSON</button>
                    <button type="button" class="turnero-admin-clinic-onboarding-console__button" data-action="reset-console" data-tone="danger">Reset</button>
                </div>
            </div>
            <div class="turnero-admin-clinic-onboarding-console__metrics">
                ${renderMetric(
                    'TurneroClinicProfile',
                    summary.profileFingerprint || 'sin fingerprint',
                    `${profile.release?.mode || 'web_pilot'} · admin ${profile.release?.admin_mode_default || 'basic'}`
                )}
                ${renderMetric(
                    'Staff cargado',
                    String(summary.staffCount || 0),
                    'roles operativos listos para onboarding'
                )}
                ${renderMetric(
                    'Servicios activos',
                    String(summary.serviceCount || 0),
                    'servicios que se publican en el tenant'
                )}
                ${renderMetric(
                    'URLs generadas',
                    String(summary.urlCount || 0),
                    'admin, operador, kiosco y sala'
                )}
            </div>
            <div class="turnero-admin-clinic-onboarding-console__layout">
                <div class="turnero-admin-clinic-onboarding-console__stack">
                    <section class="turnero-admin-clinic-onboarding-console__section" data-state="${escapeHtml(
                        summary.state || 'blocked'
                    )}">
                        <div>
                            <h4>Registrar clinica</h4>
                            <p class="turnero-admin-clinic-onboarding-console__meta">Base del tenant, consultorios y modo de rollout.</p>
                        </div>
                        <div class="turnero-admin-clinic-onboarding-console__forms turnero-admin-clinic-onboarding-console__form">
                            <div class="turnero-admin-clinic-onboarding-console__form-grid">
                                <label><span>Brand</span><input data-field="clinic-brand-name" value="${escapeHtml(
                                    state.clinicDraft.brandName
                                )}" /></label>
                                <label><span>Short name</span><input data-field="clinic-short-name" value="${escapeHtml(
                                    state.clinicDraft.shortName
                                )}" /></label>
                                <label><span>City</span><input data-field="clinic-city" value="${escapeHtml(
                                    state.clinicDraft.city
                                )}" /></label>
                                <label><span>Clinic ID</span><input data-field="clinic-id" value="${escapeHtml(
                                    state.clinicDraft.clinicId
                                )}" /></label>
                                <label><span>Tenant domain</span><input data-field="clinic-tenant-domain" value="${escapeHtml(
                                    state.clinicDraft.tenantDomain
                                )}" /></label>
                                <label><span>Base URL</span><input data-field="clinic-base-url" value="${escapeHtml(
                                    state.clinicDraft.baseUrl
                                )}" /></label>
                                <label><span>C1 label</span><input data-field="clinic-c1-label" value="${escapeHtml(
                                    state.clinicDraft.consultorio1Label
                                )}" /></label>
                                <label><span>C1 short</span><input data-field="clinic-c1-short-label" value="${escapeHtml(
                                    state.clinicDraft.consultorio1ShortLabel
                                )}" /></label>
                                <label><span>C2 label</span><input data-field="clinic-c2-label" value="${escapeHtml(
                                    state.clinicDraft.consultorio2Label
                                )}" /></label>
                                <label><span>C2 short</span><input data-field="clinic-c2-short-label" value="${escapeHtml(
                                    state.clinicDraft.consultorio2ShortLabel
                                )}" /></label>
                                <label><span>Release mode</span><select data-field="clinic-release-mode">
                                    <option value="web_pilot"${
                                        state.clinicDraft.releaseMode ===
                                        'web_pilot'
                                            ? ' selected'
                                            : ''
                                    }>web_pilot</option>
                                    <option value="suite_v2"${
                                        state.clinicDraft.releaseMode ===
                                        'suite_v2'
                                            ? ' selected'
                                            : ''
                                    }>suite_v2</option>
                                </select></label>
                            </div>
                            <button type="button" class="turnero-admin-clinic-onboarding-console__button" data-action="save-clinic" data-tone="primary">Guardar clinica</button>
                        </div>
                    </section>
                    <section class="turnero-admin-clinic-onboarding-console__section" data-state="${escapeHtml(
                        (summary.staffCount || 0) > 0 ? 'ready' : 'blocked'
                    )}">
                        <div>
                            <h4>Cargar staff</h4>
                            <p class="turnero-admin-clinic-onboarding-console__meta">Recepcion, consulta, soporte u operacion del tenant.</p>
                        </div>
                        <div class="turnero-admin-clinic-onboarding-console__forms turnero-admin-clinic-onboarding-console__form">
                            <div class="turnero-admin-clinic-onboarding-console__form-grid">
                                <label><span>Name</span><input data-field="staff-name" placeholder="Dra. Maria Perez" /></label>
                                <label><span>Role</span><select data-field="staff-role">
                                    <option value="doctor">doctor</option>
                                    <option value="frontdesk">frontdesk</option>
                                    <option value="operator">operator</option>
                                    <option value="nurse">nurse</option>
                                    <option value="support">support</option>
                                </select></label>
                                <label><span>Station</span><select data-field="staff-station">
                                    <option value="c1">c1</option>
                                    <option value="c2">c2</option>
                                    <option value="frontdesk">frontdesk</option>
                                    <option value="remote">remote</option>
                                </select></label>
                                <label><span>Shift</span><select data-field="staff-shift">
                                    <option value="am">am</option>
                                    <option value="pm">pm</option>
                                    <option value="full">full</option>
                                    <option value="weekend">weekend</option>
                                </select></label>
                            </div>
                            <button type="button" class="turnero-admin-clinic-onboarding-console__button" data-action="add-staff" data-tone="primary">Add staff</button>
                        </div>
                        ${renderEntries(
                            state.pack.staff,
                            'Sin staff cargado.',
                            (row) => `
                                <article class="turnero-admin-clinic-onboarding-console__entry">
                                    <strong>${escapeHtml(row.name)}</strong>
                                    <small>${escapeHtml(
                                        `${row.role} · ${row.station} · ${row.shift}`
                                    )}</small>
                                </article>
                            `
                        )}
                    </section>
                    <section class="turnero-admin-clinic-onboarding-console__section" data-state="${escapeHtml(
                        (summary.serviceCount || 0) > 0 ? 'ready' : 'blocked'
                    )}">
                        <div>
                            <h4>Activar servicios</h4>
                            <p class="turnero-admin-clinic-onboarding-console__meta">Servicios que quedan listos en el rollout inicial de la clinica.</p>
                        </div>
                        <div class="turnero-admin-clinic-onboarding-console__forms turnero-admin-clinic-onboarding-console__form">
                            <div class="turnero-admin-clinic-onboarding-console__form-grid">
                                <label><span>Service</span><input data-field="service-label" placeholder="Dermatologia general" /></label>
                                <label><span>Category</span><select data-field="service-category">
                                    <option value="dermatologia">dermatologia</option>
                                    <option value="medicina-estetica">medicina-estetica</option>
                                    <option value="telemedicina">telemedicina</option>
                                    <option value="procedimientos">procedimientos</option>
                                </select></label>
                                <label><span>Mode</span><select data-field="service-mode">
                                    <option value="presencial">presencial</option>
                                    <option value="hibrido">hibrido</option>
                                    <option value="virtual">virtual</option>
                                </select></label>
                                <label><span>Duration</span><input data-field="service-duration" type="number" min="10" step="5" value="30" /></label>
                            </div>
                            <button type="button" class="turnero-admin-clinic-onboarding-console__button" data-action="add-service" data-tone="primary">Add service</button>
                        </div>
                        ${renderEntries(
                            state.pack.services,
                            'Sin servicios activos.',
                            (row) => `
                                <article class="turnero-admin-clinic-onboarding-console__entry">
                                    <strong>${escapeHtml(row.label)}</strong>
                                    <small>${escapeHtml(
                                        `${row.category} · ${row.mode} · ${row.durationMinutes} min`
                                    )}</small>
                                </article>
                            `
                        )}
                    </section>
                </div>
                <div class="turnero-admin-clinic-onboarding-console__preview">
                    <section class="turnero-admin-clinic-onboarding-console__section" data-state="${escapeHtml(
                        summary.state || 'blocked'
                    )}">
                        <div>
                            <h4>URLs generadas</h4>
                            <p class="turnero-admin-clinic-onboarding-console__meta">Paquete canonico para admin, operador, kiosco y sala.</p>
                        </div>
                        ${
                            urls.length > 0
                                ? `<div class="turnero-admin-clinic-onboarding-console__url-list">${urls
                                      .map(
                                          (row) => `
                                            <article class="turnero-admin-clinic-onboarding-console__url">
                                                <strong>${escapeHtml(
                                                    row.label
                                                )}</strong>
                                                <small>${escapeHtml(
                                                    row.route
                                                )}</small>
                                                <code>${escapeHtml(
                                                    row.url
                                                )}</code>
                                            </article>
                                        `
                                      )
                                      .join('')}</div>`
                                : `<p class="turnero-admin-clinic-onboarding-console__meta">Sin URLs generadas.</p>`
                        }
                    </section>
                    <section class="turnero-admin-clinic-onboarding-console__section" data-state="${escapeHtml(
                        summary.state || 'blocked'
                    )}">
                        <div>
                            <h4>Readiness</h4>
                            <p class="turnero-admin-clinic-onboarding-console__meta">${escapeHtml(
                                summary.label || 'Sin resumen.'
                            )}</p>
                        </div>
                        ${renderFlags(summary)}
                    </section>
                    <section class="turnero-admin-clinic-onboarding-console__section" data-state="${escapeHtml(
                        summary.state || 'blocked'
                    )}">
                        <div>
                            <h4>Brief</h4>
                            <p class="turnero-admin-clinic-onboarding-console__meta">Resumen listo para handoff o cierre comercial.</p>
                        </div>
                        <pre class="turnero-admin-clinic-onboarding-console__brief" data-role="brief">${escapeHtml(
                            state.pack.brief || ''
                        )}</pre>
                    </section>
                    <section class="turnero-admin-clinic-onboarding-console__section" data-state="${escapeHtml(
                        summary.state || 'blocked'
                    )}">
                        <div>
                            <h4>TurneroClinicProfile</h4>
                            <p class="turnero-admin-clinic-onboarding-console__meta">JSON canonico listo para catalogo o staging local.</p>
                        </div>
                        <pre class="turnero-admin-clinic-onboarding-console__json" data-role="profile-json">${escapeHtml(
                            JSON.stringify(state.pack.turneroClinicProfile, null, 2)
                        )}</pre>
                    </section>
                </div>
            </div>
        </section>
    `;
}

export function mountTurneroAdminClinicOnboardingConsole(target, options = {}) {
    const host = resolveTarget(target);
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    ensureConsoleStyles();

    const storage = getStorage(options.storage);
    const baseState = {
        clinicDraft: getDefaultTurneroClinicOnboardingDraft(options),
        staffRows: cloneRows(options.staffRows || options.staff || []),
        serviceRows: cloneRows(options.serviceRows || options.services || []),
    };
    const state = loadPersistedState(storage, baseState);

    function recompute() {
        state.pack = buildTurneroClinicOnboardingPack({
            clinicDraft: state.clinicDraft,
            staffRows: state.staffRows,
            serviceRows: state.serviceRows,
            clinicProfile:
                options.clinicProfile ||
                options.turneroClinicProfile ||
                null,
        });
    }

    function render() {
        recompute();
        host.innerHTML = renderConsoleHtml(state);
        host.dataset.state = toString(state.pack?.summary?.state, 'blocked');
        host.__turneroClinicOnboardingConsoleModel = model;
        persistState(storage, state);
    }

    async function handleAction(action) {
        switch (action) {
            case 'save-clinic':
                state.clinicDraft = getClinicDraftFromForm(host, state.clinicDraft);
                render();
                break;
            case 'add-staff': {
                const row = getStaffRowFromForm(host);
                if (!row.name) {
                    return;
                }
                state.staffRows = [...state.staffRows, row];
                render();
                clearFormFields(host, ['[data-field="staff-name"]']);
                break;
            }
            case 'add-service': {
                const row = getServiceRowFromForm(host);
                if (!row.label) {
                    return;
                }
                state.serviceRows = [...state.serviceRows, row];
                render();
                clearFormFields(host, ['[data-field="service-label"]']);
                const durationField = host.querySelector(
                    '[data-field="service-duration"]'
                );
                if (durationField) {
                    durationField.value = '30';
                }
                break;
            }
            case 'copy-brief':
                await copyToClipboardSafe(state.pack?.brief || '');
                break;
            case 'download-json':
                downloadJsonSnapshot(
                    `turnero-clinic-onboarding-${toString(
                        state.pack?.turneroClinicProfile?.clinic_id,
                        'clinica-demo'
                    )}.json`,
                    state.pack
                );
                break;
            case 'reset-console':
                clearPersistedState(storage);
                state.clinicDraft = getDefaultTurneroClinicOnboardingDraft(options);
                state.staffRows = cloneRows(options.staffRows || options.staff || []);
                state.serviceRows = cloneRows(
                    options.serviceRows || options.services || []
                );
                render();
                break;
            default:
                break;
        }
    }

    host.onclick = async (event) => {
        const action = toString(
            event?.target?.getAttribute?.('data-action'),
            ''
        );
        if (!action) {
            return;
        }
        await handleAction(action);
    };

    const model = {
        host,
        state,
        render,
        handleAction,
    };

    render();
    return model;
}
