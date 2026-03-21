import {
    getTurneroClinicBrandName,
    getTurneroClinicShortName,
} from './clinic-profile.js';
import { buildTurneroSurfaceExpansionPack } from './turnero-surface-expansion-pack.js';
import {
    buildTurneroSurfaceExpansionSnapshot,
    normalizeTurneroSurfaceExpansionSurfaceKey,
} from './turnero-surface-expansion-snapshot.js';
import { createTurneroSurfaceExpansionLedger } from './turnero-surface-expansion-ledger.js';
import { createTurneroSurfaceExpansionOwnerStore } from './turnero-surface-expansion-owner-store.js';
import { mountTurneroSurfaceExpansionBanner } from './turnero-surface-expansion-banner.js';
import {
    ensureTurneroSurfaceOpsStyles,
    mountTurneroSurfaceCheckpointChip,
} from './turnero-surface-checkpoint-chip.js';
import {
    asObject,
    copyTextToClipboard,
    downloadJsonSnapshot,
    escapeHtml,
    resolveTarget,
    toArray,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroAdminQueueSurfaceExpansionConsoleInlineStyles';
const SURFACE_ORDER = Object.freeze(['operator', 'kiosk', 'display']);
const SURFACE_LABELS = Object.freeze({
    operator: 'Turnero Operador',
    kiosk: 'Turnero Kiosco',
    display: 'Turnero Sala TV',
});

function ensureStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-admin-queue-surface-expansion-console{display:grid;gap:.9rem}
        .turnero-admin-queue-surface-expansion-console__header,.turnero-admin-queue-surface-expansion-console__actions,.turnero-admin-queue-surface-expansion-console__chips{display:flex;flex-wrap:wrap;gap:.5rem}
        .turnero-admin-queue-surface-expansion-console__header{justify-content:space-between;align-items:flex-start}
        .turnero-admin-queue-surface-expansion-console__button{min-height:38px;padding:.56rem .84rem;border-radius:999px;border:1px solid rgb(15 23 32 / 12%);background:rgb(255 255 255 / 88%);color:inherit;font:inherit;cursor:pointer}
        .turnero-admin-queue-surface-expansion-console__button[data-tone='primary']{border-color:rgb(15 107 220 / 22%);background:rgb(15 107 220 / 10%);color:rgb(10 67 137)}
        .turnero-admin-queue-surface-expansion-console__metrics,.turnero-admin-queue-surface-expansion-console__grid,.turnero-admin-queue-surface-expansion-console__forms{display:grid;gap:.7rem}
        .turnero-admin-queue-surface-expansion-console__metrics{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
        .turnero-admin-queue-surface-expansion-console__grid{grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
        .turnero-admin-queue-surface-expansion-console__metric,.turnero-admin-queue-surface-expansion-console__surface,.turnero-admin-queue-surface-expansion-console__entry,.turnero-admin-queue-surface-expansion-console__form,.turnero-admin-queue-surface-expansion-console__brief{padding:.82rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%)}
        .turnero-admin-queue-surface-expansion-console__surface{display:grid;gap:.55rem}
        .turnero-admin-queue-surface-expansion-console__surface-head{display:flex;justify-content:space-between;gap:.7rem;align-items:flex-start}
        .turnero-admin-queue-surface-expansion-console__surface[data-state='ready']{border-color:rgb(22 163 74 / 20%)}
        .turnero-admin-queue-surface-expansion-console__surface[data-state='watch']{border-color:rgb(180 83 9 / 18%)}
        .turnero-admin-queue-surface-expansion-console__surface[data-state='degraded']{border-color:rgb(234 88 12 / 18%)}
        .turnero-admin-queue-surface-expansion-console__surface[data-state='blocked']{border-color:rgb(190 24 93 / 18%)}
        .turnero-admin-queue-surface-expansion-console__meta,.turnero-admin-queue-surface-expansion-console__summary{margin:0;font-size:.84rem;line-height:1.45;opacity:.86}
        .turnero-admin-queue-surface-expansion-console__fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.45rem}
        .turnero-admin-queue-surface-expansion-console__field{padding:.58rem .66rem;border-radius:14px;border:1px solid rgb(15 23 32 / 9%);background:rgb(255 255 255 / 74%)}
        .turnero-admin-queue-surface-expansion-console__field strong{display:block;font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;opacity:.7}
        .turnero-admin-queue-surface-expansion-console__form{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.55rem}
        .turnero-admin-queue-surface-expansion-console__form label{display:grid;gap:.25rem;font-size:.78rem}
        .turnero-admin-queue-surface-expansion-console__form input,.turnero-admin-queue-surface-expansion-console__form select,.turnero-admin-queue-surface-expansion-console__form textarea{min-height:38px;padding:.48rem .62rem;border-radius:12px;border:1px solid rgb(15 23 32 / 14%);background:rgb(255 255 255 / 96%);color:inherit;font:inherit}
        .turnero-admin-queue-surface-expansion-console__form textarea{min-height:82px;resize:vertical}
        .turnero-admin-queue-surface-expansion-console__list{display:grid;gap:.45rem}
        .turnero-admin-queue-surface-expansion-console__brief{margin:0;white-space:pre-wrap;font-size:.84rem;line-height:1.5}
        @media (max-width:760px){.turnero-admin-queue-surface-expansion-console__header,.turnero-admin-queue-surface-expansion-console__surface-head{flex-direction:column}}
    `;
    document.head.appendChild(styleEl);
    return true;
}

function resolveScope(input = {}, clinicProfile = null) {
    return toString(
        input.scope ||
            clinicProfile?.region ||
            clinicProfile?.branding?.city ||
            'queue-expansion',
        'queue-expansion'
    );
}

function getSurfaceLabel(surfaceKey, clinicProfile, surfaceRegistry = {}) {
    const normalizedSurfaceKey = normalizeTurneroSurfaceExpansionSurfaceKey(
        surfaceKey
    );
    return toString(
        surfaceRegistry?.[normalizedSurfaceKey]?.label ||
            clinicProfile?.surfaces?.[normalizedSurfaceKey]?.label ||
            SURFACE_LABELS[normalizedSurfaceKey] ||
            normalizedSurfaceKey,
        SURFACE_LABELS[normalizedSurfaceKey] || normalizedSurfaceKey
    );
}

function buildSeed(surfaceKey, clinicProfile, scope) {
    return buildTurneroSurfaceExpansionSnapshot({
        scope,
        surfaceKey,
        clinicProfile,
        runtimeState: 'ready',
        updatedAt: new Date().toISOString(),
    });
}

function normalizeChecklist(summary, surfaceKey) {
    if (summary && typeof summary === 'object') {
        return summary;
    }
    return surfaceKey === 'kiosk'
        ? { summary: { all: 4, pass: 2, fail: 2 } }
        : { summary: { all: 4, pass: 3, fail: 1 } };
}

function resolveSnapshots(input = {}, clinicProfile = null, scope = 'queue-expansion') {
    const source = Array.isArray(input.snapshots)
        ? input.snapshots
        : Array.isArray(input.surfacePacks)
          ? input.surfacePacks.map((item) => item?.snapshot || item)
          : [];
    const provided = new Map();

    source.forEach((item) => {
        const normalizedSurfaceKey = normalizeTurneroSurfaceExpansionSurfaceKey(
            item?.surfaceKey || ''
        );
        if (SURFACE_ORDER.includes(normalizedSurfaceKey)) {
            provided.set(normalizedSurfaceKey, item);
        }
    });

    return SURFACE_ORDER.map((surfaceKey) => {
        const seed = asObject(provided.get(surfaceKey) || buildSeed(surfaceKey, clinicProfile, scope));
        return {
            ...buildTurneroSurfaceExpansionSnapshot({
                ...seed,
                scope,
                surfaceKey: seed.surfaceKey || surfaceKey,
                clinicProfile,
            }),
            checklist: normalizeChecklist(seed.checklist, surfaceKey),
        };
    });
}

function buildSurfacePack(snapshot, ledgerRows, ownerRows, clinicProfile, scope) {
    const surfaceKey = normalizeTurneroSurfaceExpansionSurfaceKey(
        snapshot.surfaceKey
    );
    const ledger = ledgerRows.filter(
        (entry) =>
            normalizeTurneroSurfaceExpansionSurfaceKey(entry.surfaceKey) ===
            surfaceKey
    );
    const owners = ownerRows.filter(
        (entry) =>
            normalizeTurneroSurfaceExpansionSurfaceKey(entry.surfaceKey) ===
            surfaceKey
    );
    return buildTurneroSurfaceExpansionPack({
        ...snapshot,
        clinicProfile,
        scope,
        checklist: snapshot.checklist,
        ledger,
        owners,
    });
}

function resolveOverviewPack(input, clinicProfile, scope, checklist, ledger, owners, surfacePacks) {
    return buildTurneroSurfaceExpansionPack({
        surfaceKey: 'admin',
        clinicProfile,
        scope,
        truth: toString(input.truth, 'watch'),
        opportunityState: toString(
            input.opportunityState,
            surfacePacks.every((item) => item.gate.band === 'ready')
                ? 'ready'
                : 'watch'
        ),
        demandSignal: toString(
            input.demandSignal,
            surfacePacks.some((item) => item.snapshot.demandSignal === 'medium')
                ? 'medium'
                : 'low'
        ),
        gapState: toString(input.gapState, 'surface-expansion'),
        expansionOwner: toString(
            input.expansionOwner,
            surfacePacks.find((item) => toString(item.snapshot.expansionOwner))
                ?.snapshot?.expansionOwner || ''
        ),
        nextModuleHint: toString(
            input.nextModuleHint,
            surfacePacks.find((item) => toString(item.snapshot.nextModuleHint))
                ?.snapshot?.nextModuleHint || ''
        ),
        checklist: { summary: checklist },
        ledger,
        owners,
    });
}

function buildConsoleState(input = {}, ledgerRows = [], ownerRows = []) {
    const clinicProfile = asObject(input.clinicProfile);
    const scope = resolveScope(input, clinicProfile);
    const snapshots = resolveSnapshots(input, clinicProfile, scope);
    const ledger = Array.isArray(ledgerRows) ? ledgerRows.filter(Boolean) : [];
    const owners = Array.isArray(ownerRows) ? ownerRows.filter(Boolean) : [];
    const surfacePacks = snapshots.map((snapshot) =>
        buildSurfacePack(snapshot, ledger, owners, clinicProfile, scope)
    );
    const checklist = input.checklist?.summary || surfacePacks.reduce(
        (accumulator, item) => {
            accumulator.all += Number(item.checklist?.all || 0) || 0;
            accumulator.pass += Number(item.checklist?.pass || 0) || 0;
            accumulator.fail += Number(item.checklist?.fail || 0) || 0;
            return accumulator;
        },
        { all: 0, pass: 0, fail: 0 }
    );
    const overviewPack = resolveOverviewPack(
        input,
        clinicProfile,
        scope,
        checklist,
        ledger,
        owners,
        surfacePacks
    );
    const clinicLabel =
        getTurneroClinicBrandName(clinicProfile) ||
        getTurneroClinicShortName(clinicProfile) ||
        '';

    return {
        scope,
        clinicProfile,
        clinicLabel,
        releaseManifest: asObject(input.releaseManifest),
        surfaceRegistry: asObject(input.surfaceRegistry),
        snapshots,
        surfacePacks,
        ledger,
        owners,
        checklist,
        overviewPack,
        gate: overviewPack.gate,
        readout: overviewPack.readout,
        metrics: {
            totalSurfaces: surfacePacks.length,
            readyCount: surfacePacks.filter((item) => item.gate.band === 'ready').length,
            watchCount: surfacePacks.filter((item) => item.gate.band === 'watch').length,
            degradedCount: surfacePacks.filter((item) => item.gate.band === 'degraded').length,
            blockedCount: surfacePacks.filter((item) => item.gate.band === 'blocked').length,
            ledgerCount: ledger.length,
            ownerCount: owners.length,
            activeOwnerCount: Number(overviewPack.readout.activeOwnerCount || 0) || 0,
            readyLedgerCount: Number(overviewPack.readout.readyLedgerCount || 0) || 0,
            hintedSurfaceCount: surfacePacks.filter((item) =>
                Boolean(item.snapshot.nextModuleHint)
            ).length,
        },
    };
}

function buildBrief(state) {
    return [
        '# Surface Expansion Upsell',
        `Scope: ${toString(state.scope, 'queue-expansion')}`,
        `Clinic: ${toString(state.clinicLabel || state.clinicProfile?.clinic_id, 'sin-clinica')}`,
        `Gate: ${toString(state.gate.band, 'blocked')} · ${Number(state.gate.score || 0)} · ${toString(state.gate.decision, 'hold-expansion-readiness')}`,
        '',
        ...state.surfacePacks.map(
            (card) =>
                `- ${toString(card.readout.surfaceLabel, card.snapshot.surfaceKey)}: ${toString(card.gate.band, 'blocked')} · ${Number(card.gate.score || 0)} · demand ${toString(card.readout.demandSignal, 'none')} · expansion ${toString(card.readout.opportunityState, 'watch')} · next ${toString(card.readout.nextModuleHint, 'sin siguiente modulo') || 'sin siguiente modulo'}`
        ),
        '',
        `Ledger entries: ${state.metrics.ledgerCount}`,
        `Owners: ${state.metrics.ownerCount}`,
        `Checklist: ${Number(state.checklist?.pass || 0)}/${Number(state.checklist?.all || 0)} pass`,
    ].join('\n').trim();
}

function renderMetric(label, value, detail = '') {
    return `
        <article class="turnero-admin-queue-surface-expansion-console__metric">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            ${detail ? `<span class="turnero-admin-queue-surface-expansion-console__meta">${escapeHtml(detail)}</span>` : ''}
        </article>
    `;
}

function renderField(label, value, detail = '') {
    return `
        <article class="turnero-admin-queue-surface-expansion-console__field">
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(value)}</span>
            ${detail ? `<p class="turnero-admin-queue-surface-expansion-console__meta">${escapeHtml(detail)}</p>` : ''}
        </article>
    `;
}

function renderEntryList(entries, kind) {
    if (!entries.length) {
        return '<p class="turnero-admin-queue-surface-expansion-console__meta">Sin entradas todavia.</p>';
    }

    return `<div class="turnero-admin-queue-surface-expansion-console__list">${entries
        .map(
            (entry) => `
                <article class="turnero-admin-queue-surface-expansion-console__entry">
                    <strong>${escapeHtml(`${toString(entry.surfaceKey, 'surface')} · ${toString(entry.title || entry.kind || entry.role, 'entry')}`)}</strong>
                    <p class="turnero-admin-queue-surface-expansion-console__meta">${escapeHtml(
                        kind === 'ledger'
                            ? `${toString(entry.owner, 'ops')} · ${toString(entry.kind, 'module-hint')} · ${toString(entry.status, 'watch')}`
                            : `${toString(entry.actor, 'owner')} · ${toString(entry.role, 'expansion')} · ${toString(entry.status, 'active')}`
                    )}</p>
                    ${entry.note ? `<p class="turnero-admin-queue-surface-expansion-console__summary">${escapeHtml(entry.note)}</p>` : ''}
                </article>
            `
        )
        .join('')}</div>`;
}

function renderSurfaceCard(card) {
    return `
        <article class="turnero-admin-queue-surface-expansion-console__surface" data-surface-key="${escapeHtml(card.surfaceKey)}" data-state="${escapeHtml(card.gate.band)}">
            <div class="turnero-admin-queue-surface-expansion-console__surface-head">
                <div>
                    <strong>${escapeHtml(card.readout.surfaceLabel)}</strong>
                    <p class="turnero-admin-queue-surface-expansion-console__meta">${escapeHtml(card.readout.surfaceKey)}</p>
                </div>
                <span>${escapeHtml(`${card.gate.band} · ${Number(card.gate.score || 0)}`)}</span>
            </div>
            <div data-role="banner"></div>
            <div data-role="chips" class="turnero-admin-queue-surface-expansion-console__chips"></div>
            <p class="turnero-admin-queue-surface-expansion-console__summary">${escapeHtml(card.readout.summary)}</p>
            <div class="turnero-admin-queue-surface-expansion-console__fields">
                ${renderField('Demand', toString(card.readout.demandSignal, 'none'))}
                ${renderField('Expansion', toString(card.readout.opportunityState, 'watch'), toString(card.readout.gapState, 'sin gap') || 'sin gap')}
                ${renderField('Owner', toString(card.readout.expansionOwner, 'sin owner') || 'sin owner')}
                ${renderField('Next module', toString(card.readout.nextModuleHint, 'sin siguiente modulo') || 'sin siguiente modulo')}
            </div>
        </article>
    `;
}

function renderConsoleHtml(state, brief) {
    const options = SURFACE_ORDER.map((surfaceKey) => {
        const label = getSurfaceLabel(
            surfaceKey,
            state.clinicProfile,
            state.surfaceRegistry
        );
        return `<option value="${escapeHtml(surfaceKey)}">${escapeHtml(label)}</option>`;
    }).join('');

    return `
        <section class="turnero-admin-queue-surface-expansion-console" data-state="${escapeHtml(state.gate.band)}">
            <div class="turnero-admin-queue-surface-expansion-console__header">
                <div>
                    <p>Turnero expansion</p>
                    <h3>Surface Expansion Upsell</h3>
                    <p class="turnero-admin-queue-surface-expansion-console__summary">Oportunidades visibles por surface con ledger, owners y gate determinista de expansion.</p>
                </div>
                <div class="turnero-admin-queue-surface-expansion-console__actions">
                    <button type="button" class="turnero-admin-queue-surface-expansion-console__button" data-action="copy-brief">Copy brief</button>
                    <button type="button" class="turnero-admin-queue-surface-expansion-console__button" data-action="download-json">Download JSON</button>
                    <button type="button" class="turnero-admin-queue-surface-expansion-console__button" data-action="refresh">Refresh</button>
                </div>
            </div>
            <div data-role="banner"></div>
            <div class="turnero-admin-queue-surface-expansion-console__metrics">
                ${renderMetric('Surfaces', String(state.metrics.totalSurfaces), `${state.metrics.readyCount} ready · ${state.metrics.watchCount} watch`)}
                ${renderMetric('Gate', `${state.gate.band} · ${Number(state.gate.score || 0)}`, toString(state.gate.decision, 'hold-expansion-readiness'))}
                ${renderMetric('Ledger', String(state.metrics.ledgerCount), `${state.metrics.readyLedgerCount} ready`)}
                ${renderMetric('Owners', String(state.metrics.ownerCount), `${state.metrics.activeOwnerCount} active`)}
                ${renderMetric('Module hints', String(state.metrics.hintedSurfaceCount))}
            </div>
            <div class="turnero-admin-queue-surface-expansion-console__grid">
                ${state.surfacePacks.map((card) => renderSurfaceCard(card)).join('')}
            </div>
            <div class="turnero-admin-queue-surface-expansion-console__forms">
                <form class="turnero-admin-queue-surface-expansion-console__form" data-action="add-entry">
                    <label><span>Surface</span><select data-field="entry-surface-key">${options}</select></label>
                    <label><span>Kind</span><select data-field="entry-kind"><option value="module-hint" selected>module-hint</option><option value="pilot-addon">pilot-addon</option><option value="followup-note">followup-note</option></select></label>
                    <label><span>Status</span><select data-field="entry-status"><option value="ready" selected>ready</option><option value="watch">watch</option><option value="degraded">degraded</option><option value="blocked">blocked</option></select></label>
                    <label><span>Owner</span><input type="text" data-field="entry-owner" value="ops" /></label>
                    <label><span>Title</span><input type="text" data-field="entry-title" value="Expansion item" /></label>
                    <label style="grid-column:1 / -1;"><span>Note</span><textarea data-field="entry-note" placeholder="Expansion note"></textarea></label>
                    <div style="grid-column:1 / -1;"><button type="submit" class="turnero-admin-queue-surface-expansion-console__button" data-tone="primary">Add expansion item</button></div>
                </form>
                ${renderEntryList(state.ledger, 'ledger')}
                <form class="turnero-admin-queue-surface-expansion-console__form" data-action="add-owner">
                    <label><span>Surface</span><select data-field="owner-surface-key">${options}</select></label>
                    <label><span>Actor</span><input type="text" data-field="owner-actor" value="owner" /></label>
                    <label><span>Role</span><input type="text" data-field="owner-role" value="expansion" /></label>
                    <label><span>Status</span><input type="text" data-field="owner-status" value="active" /></label>
                    <label style="grid-column:1 / -1;"><span>Note</span><textarea data-field="owner-note" placeholder="Owner note"></textarea></label>
                    <div style="grid-column:1 / -1;"><button type="submit" class="turnero-admin-queue-surface-expansion-console__button" data-tone="primary">Add owner</button></div>
                </form>
                ${renderEntryList(state.owners, 'owner')}
            </div>
            <pre data-role="brief" class="turnero-admin-queue-surface-expansion-console__brief">${escapeHtml(brief)}</pre>
        </section>
    `;
}

function mountChips(host, checkpoints = []) {
    host.replaceChildren();
    checkpoints.forEach((chip) => {
        const node = document.createElement('span');
        host.appendChild(node);
        mountTurneroSurfaceCheckpointChip(node, chip);
    });
}

function readValue(root, selector, fallback = '') {
    const field = root.querySelector(selector);
    return field && 'value' in field ? toString(field.value, fallback) : fallback;
}

function resetValue(root, selector, value = '') {
    const field = root.querySelector(selector);
    if (field && 'value' in field) {
        field.value = value;
    }
}

function syncState(controller, input, ledgerStore, ownerStore) {
    controller.state = buildConsoleState(
        input,
        ledgerStore.list(),
        ownerStore.list()
    );
    controller.brief = buildBrief(controller.state);
    controller.root.dataset.state = controller.state.gate.band;
    controller.root.innerHTML = renderConsoleHtml(controller.state, controller.brief);

    const overviewBanner = controller.root.querySelector('[data-role="banner"]');
    if (overviewBanner instanceof HTMLElement) {
        mountTurneroSurfaceExpansionBanner(overviewBanner, {
            pack: controller.state.overviewPack,
            title: 'Surface Expansion Upsell',
            eyebrow: 'Expansion overview',
        });
    }

    controller.state.surfacePacks.forEach((card) => {
        const cardHost = controller.root.querySelector(
            `[data-surface-key="${card.surfaceKey}"]`
        );
        if (!(cardHost instanceof HTMLElement)) {
            return;
        }

        const bannerHost = cardHost.querySelector('[data-role="banner"]');
        if (bannerHost instanceof HTMLElement) {
            mountTurneroSurfaceExpansionBanner(bannerHost, {
                pack: card,
                title: card.readout.surfaceLabel,
                eyebrow: 'Expansion gate',
            });
        }

        const chipsHost = cardHost.querySelector('[data-role="chips"]');
        if (chipsHost instanceof HTMLElement) {
            mountChips(chipsHost, toArray(card.readout.checkpoints));
        }
    });

    const briefHost = controller.root.querySelector('[data-role="brief"]');
    if (briefHost instanceof HTMLElement) {
        briefHost.textContent = controller.brief;
    }
}

function buildController(input, ledgerStore, ownerStore) {
    const controller = {
        root: document.createElement('section'),
        state: null,
        brief: '',
        refresh: null,
        destroy: null,
    };

    const onClick = async (event) => {
        const target =
            event.target && typeof event.target.closest === 'function'
                ? event.target.closest('[data-action]')
                : null;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const action = toString(target.dataset.action);
        if (action === 'copy-brief') {
            await copyTextToClipboard(controller.brief);
            return;
        }
        if (action === 'download-json') {
            downloadJsonSnapshot('turnero-surface-expansion-console.json', {
                scope: controller.state.scope,
                clinicProfile: controller.state.clinicProfile,
                surfacePacks: controller.state.surfacePacks,
                ledger: controller.state.ledger,
                owners: controller.state.owners,
                checklist: controller.state.checklist,
                overviewPack: controller.state.overviewPack,
                releaseManifest: controller.state.releaseManifest,
                brief: controller.brief,
            });
            return;
        }
        if (action === 'refresh') {
            syncState(controller, input, ledgerStore, ownerStore);
        }
    };

    const onSubmit = (event) => {
        const form =
            event.target && typeof event.target.closest === 'function'
                ? event.target.closest('form[data-action]')
                : null;
        if (!(form instanceof HTMLElement)) {
            return;
        }

        event.preventDefault();
        const action = toString(form.dataset.action);
        if (action === 'add-entry') {
            ledgerStore.add({
                surfaceKey: readValue(form, '[data-field="entry-surface-key"]', 'operator'),
                kind: readValue(form, '[data-field="entry-kind"]', 'module-hint'),
                status: readValue(form, '[data-field="entry-status"]', 'ready'),
                owner: readValue(form, '[data-field="entry-owner"]', 'ops'),
                title: readValue(form, '[data-field="entry-title"]', 'Expansion item'),
                note: readValue(form, '[data-field="entry-note"]', ''),
            });
            resetValue(form, '[data-field="entry-note"]', '');
            syncState(controller, input, ledgerStore, ownerStore);
            return;
        }

        if (action === 'add-owner') {
            ownerStore.add({
                surfaceKey: readValue(form, '[data-field="owner-surface-key"]', 'operator'),
                actor: readValue(form, '[data-field="owner-actor"]', 'owner'),
                role: readValue(form, '[data-field="owner-role"]', 'expansion'),
                status: readValue(form, '[data-field="owner-status"]', 'active'),
                note: readValue(form, '[data-field="owner-note"]', ''),
            });
            resetValue(form, '[data-field="owner-note"]', '');
            syncState(controller, input, ledgerStore, ownerStore);
        }
    };

    controller.refresh = () => syncState(controller, input, ledgerStore, ownerStore);
    controller.destroy = () => {
        controller.root.removeEventListener('click', onClick);
        controller.root.removeEventListener('submit', onSubmit);
    };

    controller.root.addEventListener('click', onClick);
    controller.root.addEventListener('submit', onSubmit);
    return controller;
}

export function buildTurneroAdminQueueSurfaceExpansionConsoleHtml(input = {}) {
    const scope = resolveScope(input, asObject(input.clinicProfile));
    const clinicProfile = asObject(input.clinicProfile);
    const ledgerStore = createTurneroSurfaceExpansionLedger(scope, clinicProfile);
    const ownerStore = createTurneroSurfaceExpansionOwnerStore(
        scope,
        clinicProfile
    );
    const state = buildConsoleState(
        input,
        Array.isArray(input.ledger) ? input.ledger : ledgerStore.list(),
        Array.isArray(input.owners) ? input.owners : ownerStore.list()
    );
    return renderConsoleHtml(state, buildBrief(state));
}

export function mountTurneroAdminQueueSurfaceExpansionConsole(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!(host instanceof HTMLElement) || typeof document === 'undefined') {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureStyles();
    const scope = resolveScope(input, asObject(input.clinicProfile));
    const clinicProfile = asObject(input.clinicProfile);
    const ledgerStore = createTurneroSurfaceExpansionLedger(scope, clinicProfile);
    const ownerStore = createTurneroSurfaceExpansionOwnerStore(
        scope,
        clinicProfile
    );
    const controller = buildController(input, ledgerStore, ownerStore);
    controller.root.className = 'turnero-admin-queue-surface-expansion-console';
    controller.root.dataset.turneroAdminQueueSurfaceExpansionConsole = 'mounted';
    controller.root.dataset.turneroAdminQueueSurfaceExpansionScope = scope;
    host.replaceChildren(controller.root);
    controller.refresh();
    return controller;
}
