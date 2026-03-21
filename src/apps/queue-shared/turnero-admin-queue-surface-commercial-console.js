import {
    getTurneroClinicBrandName,
    getTurneroClinicShortName,
} from './clinic-profile.js';
import { createTurneroSurfaceCommercialLedger } from './turnero-surface-commercial-ledger.js';
import { createTurneroSurfaceCommercialOwnerStore } from './turnero-surface-commercial-owner-store.js';
import { buildTurneroSurfaceCommercialGate } from './turnero-surface-commercial-gate.js';
import { buildTurneroSurfaceCommercialPack } from './turnero-surface-commercial-pack.js';
import { buildTurneroSurfaceCommercialReadout } from './turnero-surface-commercial-readout.js';
import { buildTurneroSurfaceCommercialSnapshot } from './turnero-surface-commercial-snapshot.js';
import { mountTurneroSurfaceCommercialBanner } from './turnero-surface-commercial-banner.js';
import {
    ensureTurneroSurfaceOpsStyles,
    mountTurneroSurfaceCheckpointChip,
} from './turnero-surface-checkpoint-chip.js';
import {
    asObject,
    copyTextToClipboard,
    downloadJsonSnapshot,
    escapeHtml,
    formatTimestamp,
    resolveTarget,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroAdminQueueSurfaceCommercialConsoleInlineStyles';

function ensureStyles() {
    if (typeof document === 'undefined') return false;
    if (document.getElementById(STYLE_ID)) return true;

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-admin-queue-surface-commercial-console{display:grid;gap:.9rem}
        .turnero-admin-queue-surface-commercial-console__header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.85rem;align-items:flex-start}
        .turnero-admin-queue-surface-commercial-console__header h3{margin:0;font-family:'FrauncesSoft',serif;font-weight:500;letter-spacing:.01em}
        .turnero-admin-queue-surface-commercial-console__eyebrow,.turnero-admin-queue-surface-commercial-console__summary,.turnero-admin-queue-surface-commercial-console__section h4,.turnero-admin-queue-surface-commercial-console__section p{margin:0}
        .turnero-admin-queue-surface-commercial-console__eyebrow{font-size:.76rem;text-transform:uppercase;letter-spacing:.12em;opacity:.68}
        .turnero-admin-queue-surface-commercial-console__actions,.turnero-admin-queue-surface-commercial-console__form-actions,.turnero-admin-queue-surface-commercial-console__section-header{display:flex;flex-wrap:wrap;gap:.5rem}
        .turnero-admin-queue-surface-commercial-console__button{min-height:38px;padding:.56rem .84rem;border-radius:999px;border:1px solid rgb(15 23 32 / 12%);background:rgb(255 255 255 / 88%);color:inherit;font:inherit;cursor:pointer}
        .turnero-admin-queue-surface-commercial-console__button[data-tone='primary']{border-color:rgb(15 107 220 / 22%);background:rgb(15 107 220 / 10%);color:rgb(10 67 137)}
        .turnero-admin-queue-surface-commercial-console__banner-host{min-height:1px}
        .turnero-admin-queue-surface-commercial-console__metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem}
        .turnero-admin-queue-surface-commercial-console__metric{display:grid;gap:.2rem;padding:.78rem .88rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 80%)}
        .turnero-admin-queue-surface-commercial-console__metric strong{font-size:1.02rem}
        .turnero-admin-queue-surface-commercial-console__surface-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:.75rem}
        .turnero-admin-queue-surface-commercial-console__surface{display:grid;gap:.65rem;padding:.95rem 1rem;border-radius:22px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%)}
        .turnero-admin-queue-surface-commercial-console__surface[data-state='ready']{border-color:rgb(22 163 74 / 20%)}
        .turnero-admin-queue-surface-commercial-console__surface[data-state='watch']{border-color:rgb(180 83 9 / 18%)}
        .turnero-admin-queue-surface-commercial-console__surface[data-state='degraded']{border-color:rgb(234 88 12 / 18%)}
        .turnero-admin-queue-surface-commercial-console__surface[data-state='blocked']{border-color:rgb(190 24 93 / 18%)}
        .turnero-admin-queue-surface-commercial-console__surface-header{display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start}
        .turnero-admin-queue-surface-commercial-console__surface-title{display:grid;gap:.15rem}
        .turnero-admin-queue-surface-commercial-console__surface-title strong{font-size:.98rem}
        .turnero-admin-queue-surface-commercial-console__surface-title p,.turnero-admin-queue-surface-commercial-console__entry-meta{margin:0;font-size:.8rem;opacity:.82;line-height:1.45}
        .turnero-admin-queue-surface-commercial-console__surface-badge{padding:.38rem .6rem;border-radius:999px;background:rgb(15 23 32 / 5%);font-size:.76rem;white-space:nowrap}
        .turnero-admin-queue-surface-commercial-console__surface-summary,.turnero-admin-queue-surface-commercial-console__entry-note{margin:0;font-size:.85rem;line-height:1.45}
        .turnero-admin-queue-surface-commercial-console__surface-chip-row{display:flex;flex-wrap:wrap;gap:.45rem}
        .turnero-admin-queue-surface-commercial-console__section{display:grid;gap:.55rem}
        .turnero-admin-queue-surface-commercial-console__form{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.6rem;padding:.8rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 72%)}
        .turnero-admin-queue-surface-commercial-console__form label{display:grid;gap:.3rem;font-size:.78rem}
        .turnero-admin-queue-surface-commercial-console__form input,.turnero-admin-queue-surface-commercial-console__form select,.turnero-admin-queue-surface-commercial-console__form textarea{min-height:38px;padding:.48rem .62rem;border-radius:12px;border:1px solid rgb(15 23 32 / 14%);background:rgb(255 255 255 / 96%);color:inherit;font:inherit}
        .turnero-admin-queue-surface-commercial-console__form textarea{min-height:82px;resize:vertical}
        .turnero-admin-queue-surface-commercial-console__list{display:grid;gap:.45rem}
        .turnero-admin-queue-surface-commercial-console__entry{display:grid;gap:.22rem;padding:.72rem .8rem;border-radius:16px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 76%)}
        .turnero-admin-queue-surface-commercial-console__entry-head{display:flex;justify-content:space-between;gap:.7rem;align-items:flex-start}
        .turnero-admin-queue-surface-commercial-console__empty{margin:0;font-size:.84rem;opacity:.72}
        .turnero-admin-queue-surface-commercial-console__brief{margin:0;padding:.85rem .95rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%);white-space:pre-wrap;font-size:.84rem;line-height:1.5}
        @media (max-width:760px){.turnero-admin-queue-surface-commercial-console__header,.turnero-admin-queue-surface-commercial-console__surface-header,.turnero-admin-queue-surface-commercial-console__entry-head{flex-direction:column}}
    `;
    document.head.appendChild(styleEl);
    return true;
}

function getSurfaceLabel(surfaceKey, clinicProfile) {
    if (surfaceKey === 'operator-turnos') {
        return toString(
            clinicProfile?.surfaces?.operator?.label,
            'Turnero Operador'
        );
    }
    if (surfaceKey === 'kiosco-turnos') {
        return toString(
            clinicProfile?.surfaces?.kiosk?.label,
            'Turnero Kiosco'
        );
    }
    if (surfaceKey === 'sala-turnos') {
        return toString(
            clinicProfile?.surfaces?.display?.label,
            'Turnero Sala TV'
        );
    }
    return toString(surfaceKey, 'surface');
}

function normalizeChecklistSummary(checklist = {}) {
    const summary =
        checklist && typeof checklist === 'object' ? checklist.summary : null;
    return {
        all: Math.max(0, Number(summary?.all || 0) || 0),
        pass: Math.max(0, Number(summary?.pass || 0) || 0),
        fail: Math.max(0, Number(summary?.fail || 0) || 0),
    };
}

function defaultChecklistForSurface(surfaceKey) {
    return surfaceKey === 'kiosco-turnos'
        ? { summary: { all: 4, pass: 2, fail: 2 } }
        : { summary: { all: 4, pass: 3, fail: 1 } };
}

function resolveSnapshotSeeds(input = {}, clinicProfile = null) {
    const source = Array.isArray(input.snapshots)
        ? input.snapshots
        : Array.isArray(input.surfacePacks)
          ? input.surfacePacks.map((item) => item?.snapshot || item)
          : [];
    const direct = source.length
        ? source
        : [
              {
                  surfaceKey: 'operator-turnos',
                  label: getSurfaceLabel('operator-turnos', clinicProfile),
                  runtimeState: 'ready',
                  truth: 'watch',
                  packageTier: 'pilot-plus',
                  commercialOwner: 'ernesto',
                  opsOwner: 'ops-lead',
                  scopeState: 'ready',
                  pricingState: 'watch',
                  checklist: defaultChecklistForSurface('operator-turnos'),
              },
              {
                  surfaceKey: 'kiosco-turnos',
                  label: getSurfaceLabel('kiosco-turnos', clinicProfile),
                  runtimeState: 'ready',
                  truth: 'watch',
                  packageTier: 'pilot',
                  commercialOwner: '',
                  opsOwner: 'ops-kiosk',
                  scopeState: 'draft',
                  pricingState: 'draft',
                  checklist: defaultChecklistForSurface('kiosco-turnos'),
              },
              {
                  surfaceKey: 'sala-turnos',
                  label: getSurfaceLabel('sala-turnos', clinicProfile),
                  runtimeState: 'ready',
                  truth: 'aligned',
                  packageTier: 'pilot-plus',
                  commercialOwner: 'ernesto',
                  opsOwner: 'ops-display',
                  scopeState: 'ready',
                  pricingState: 'ready',
                  checklist: defaultChecklistForSurface('sala-turnos'),
              },
          ];

    return direct.map((seed) => {
        const surfaceKey = toString(seed.surfaceKey, 'surface');
        return {
            label: toString(
                seed.label,
                getSurfaceLabel(surfaceKey, clinicProfile)
            ),
            surfaceKey,
            clinicProfile,
            runtimeState: toString(seed.runtimeState, 'unknown'),
            truth: toString(seed.truth, 'unknown'),
            packageTier: toString(seed.packageTier, 'pilot'),
            commercialOwner: toString(seed.commercialOwner, ''),
            opsOwner: toString(seed.opsOwner, ''),
            scopeState: toString(seed.scopeState, 'draft'),
            pricingState: toString(seed.pricingState, 'draft'),
            updatedAt: toString(seed.updatedAt, new Date().toISOString()),
            checklist:
                seed.checklist && typeof seed.checklist === 'object'
                    ? seed.checklist
                    : defaultChecklistForSurface(surfaceKey),
        };
    });
}

function resolveChecklist(input = {}, surfacePacks = []) {
    if (input.checklist && input.checklist.summary) {
        return normalizeChecklistSummary(input.checklist);
    }

    return surfacePacks.reduce(
        (accumulator, item) => {
            const summary = normalizeChecklistSummary(item.checklist);
            accumulator.all += summary.all;
            accumulator.pass += summary.pass;
            accumulator.fail += summary.fail;
            return accumulator;
        },
        { all: 0, pass: 0, fail: 0 }
    );
}

function buildSurfacePack(seed, ledgerRows = [], ownerRows = []) {
    const surfaceKey = toString(seed.surfaceKey, 'surface');
    const ledger = ledgerRows.filter(
        (entry) => entry.surfaceKey === surfaceKey
    );
    const owners = ownerRows.filter((entry) => entry.surfaceKey === surfaceKey);
    const pack = buildTurneroSurfaceCommercialPack({ ...seed, ledger, owners });
    return {
        label: toString(seed.label, surfaceKey),
        surfaceKey,
        snapshot: pack.snapshot,
        checklist: pack.checklist,
        ledger,
        owners,
        gate: pack.gate,
        readout: buildTurneroSurfaceCommercialReadout({
            snapshot: pack.snapshot,
            gate: pack.gate,
        }),
    };
}

function buildConsoleState(input = {}, ledgerRows = [], ownerRows = []) {
    const clinicProfile = asObject(input.clinicProfile);
    const snapshots = resolveSnapshotSeeds(input, clinicProfile);
    const ledger = Array.isArray(ledgerRows) ? ledgerRows.filter(Boolean) : [];
    const owners = Array.isArray(ownerRows) ? ownerRows.filter(Boolean) : [];
    const surfacePacks = snapshots.map((seed) =>
        buildSurfacePack(seed, ledger, owners)
    );
    const checklist = resolveChecklist(input, surfacePacks);
    const gate = buildTurneroSurfaceCommercialGate({
        checklist: { summary: checklist },
        ledger,
        owners,
    });
    const clinicLabel =
        getTurneroClinicBrandName(clinicProfile) ||
        getTurneroClinicShortName(clinicProfile) ||
        '';
    const bannerSnapshot = buildTurneroSurfaceCommercialSnapshot({
        surfaceKey: 'regional-commercial',
        clinicProfile,
        runtimeState: gate.band === 'ready' ? 'ready' : 'watch',
        truth: gate.band === 'ready' ? 'aligned' : 'watch',
        packageTier: 'pilot-plus',
        commercialOwner: toString(input.commercialOwner, 'ernesto'),
        opsOwner: 'ops-admin',
        scopeState: gate.band === 'ready' ? 'ready' : 'review',
        pricingState: gate.band === 'ready' ? 'ready' : 'watch',
        updatedAt: new Date().toISOString(),
    });

    return {
        scope: toString(input.scope, 'global') || 'global',
        clinicProfile,
        clinicLabel,
        snapshots,
        surfacePacks,
        ledger,
        owners,
        checklist,
        gate,
        bannerSnapshot,
        generatedAt: bannerSnapshot.updatedAt,
        brief: '',
        metrics: {
            totalSurfaces: surfacePacks.length,
            readyCount: surfacePacks.filter(
                (item) => item.gate.band === 'ready'
            ).length,
            watchCount: surfacePacks.filter(
                (item) => item.gate.band === 'watch'
            ).length,
            degradedCount: surfacePacks.filter(
                (item) => item.gate.band === 'degraded'
            ).length,
            blockedCount: surfacePacks.filter(
                (item) => item.gate.band === 'blocked'
            ).length,
            commercialItems: ledger.length,
            owners: owners.length,
            checklistAll: checklist.all,
            checklistPass: checklist.pass,
            checklistFail: checklist.fail,
        },
    };
}

function updateBrief(state) {
    state.brief = [
        '# Surface Commercial Readiness',
        `Scope: ${toString(state.scope, 'global')}`,
        `Clinic: ${toString(
            state.clinicLabel || state.clinicProfile?.clinic_id,
            'sin-clinica'
        )}`,
        `Gate: ${toString(state.gate.band, 'degraded')} · ${Number(
            state.gate.score || 0
        )} · ${toString(state.gate.decision, 'hold-commercial-readiness')}`,
        '',
        ...state.surfacePacks.map(
            (card) =>
                `- ${card.label}: ${card.readout.packageTier} · ${card.readout.gateBand} · ${Number(
                    card.readout.gateScore || 0
                )} · owner ${toString(card.readout.commercialOwner, 'sin owner') || 'sin owner'} · ops ${toString(card.readout.opsOwner, 'ops')}`
        ),
        '',
        `Commercial items: ${state.ledger.length}`,
        `Owners: ${state.owners.length}`,
    ].join('\n');
    return state.brief;
}

function buildDownloadPayload(state) {
    return {
        scope: state.scope,
        clinicProfile: state.clinicProfile,
        snapshots: state.snapshots,
        surfacePacks: state.surfacePacks,
        ledger: state.ledger,
        owners: state.owners,
        checklist: state.checklist,
        gate: state.gate,
        summary: {
            totalSurfaces: state.metrics.totalSurfaces,
            readyCount: state.metrics.readyCount,
            watchCount: state.metrics.watchCount,
            degradedCount: state.metrics.degradedCount,
            blockedCount: state.metrics.blockedCount,
            commercialItems: state.metrics.commercialItems,
            owners: state.metrics.owners,
        },
        brief: state.brief,
        generatedAt: state.generatedAt,
        currentRoute:
            typeof window !== 'undefined'
                ? `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`
                : '',
    };
}

function readValue(root, selector, fallback = '') {
    const field = root.querySelector(selector);
    return field && 'value' in field
        ? toString(field.value, fallback)
        : toString(fallback);
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
    updateBrief(controller.state);
    controller.root.dataset.state = controller.state.gate.band;
    controller.root.innerHTML = renderConsoleHtml(controller.state);

    const bannerHost = controller.root.querySelector('[data-role="banner"]');
    if (bannerHost instanceof HTMLElement) {
        mountTurneroSurfaceCommercialBanner(bannerHost, {
            snapshot: controller.state.bannerSnapshot,
            gate: controller.state.gate,
            title: 'Surface Commercial Readiness',
            eyebrow: 'Commercial gate',
        });
    }

    renderChips(controller.root, controller.state);

    const brief = controller.root.querySelector('[data-role="brief"]');
    if (brief instanceof HTMLElement) {
        brief.textContent = controller.state.brief;
    }

    return controller.state;
}

function buildController(input, ledgerStore, ownerStore) {
    const controller = {
        root: document.createElement('section'),
        state: null,
        refresh: null,
        destroy: null,
    };

    const onClick = async (event) => {
        const actionTarget =
            event.target && typeof event.target.closest === 'function'
                ? event.target.closest('[data-action]')
                : event.target instanceof HTMLElement
                  ? event.target
                  : null;
        if (!(actionTarget instanceof HTMLElement)) return;
        const action = toString(actionTarget.dataset.action);
        if (!action) return;

        if (action === 'copy-brief') {
            await copyTextToClipboard(controller.state.brief);
            return;
        }
        if (action === 'download-json') {
            downloadJsonSnapshot(
                'turnero-surface-commercial-readiness.json',
                buildDownloadPayload(controller.state)
            );
            return;
        }
        if (action === 'clear-ledger') {
            ledgerStore.clear();
            syncState(controller, input, ledgerStore, ownerStore);
            return;
        }
        if (action === 'clear-owners') {
            ownerStore.clear();
            syncState(controller, input, ledgerStore, ownerStore);
            return;
        }
        if (action === 'refresh') {
            syncState(controller, input, ledgerStore, ownerStore);
        }
    };

    const onSubmit = (event) => {
        const formTarget =
            event.target && typeof event.target.closest === 'function'
                ? event.target.closest('form[data-action]')
                : event.target instanceof HTMLElement
                  ? event.target
                  : null;
        if (!(formTarget instanceof HTMLElement)) return;
        const action = toString(formTarget.dataset.action);
        if (!action) return;
        event.preventDefault();

        if (action === 'add-ledger') {
            ledgerStore.add({
                surfaceKey: readValue(
                    controller.root,
                    '[data-field="ledger-surface-key"]',
                    controller.state.snapshots[0]?.surfaceKey || 'surface'
                ),
                kind: readValue(
                    controller.root,
                    '[data-field="ledger-kind"]',
                    'package-note'
                ),
                status: readValue(
                    controller.root,
                    '[data-field="ledger-status"]',
                    'ready'
                ),
                owner: readValue(
                    controller.root,
                    '[data-field="ledger-owner"]',
                    'ops'
                ),
                note: readValue(
                    controller.root,
                    '[data-field="ledger-note"]',
                    ''
                ),
            });
            resetValue(controller.root, '[data-field="ledger-note"]', '');
            syncState(controller, input, ledgerStore, ownerStore);
            return;
        }

        if (action === 'add-owner') {
            ownerStore.add({
                surfaceKey: readValue(
                    controller.root,
                    '[data-field="owner-surface-key"]',
                    controller.state.snapshots[0]?.surfaceKey || 'surface'
                ),
                actor: readValue(
                    controller.root,
                    '[data-field="owner-actor"]',
                    'owner'
                ),
                role: readValue(
                    controller.root,
                    '[data-field="owner-role"]',
                    'commercial'
                ),
                status: readValue(
                    controller.root,
                    '[data-field="owner-status"]',
                    'active'
                ),
                note: readValue(
                    controller.root,
                    '[data-field="owner-note"]',
                    ''
                ),
            });
            resetValue(controller.root, '[data-field="owner-note"]', '');
            syncState(controller, input, ledgerStore, ownerStore);
        }
    };

    controller.refresh = () =>
        syncState(controller, input, ledgerStore, ownerStore);
    controller.destroy = () => {
        controller.root.removeEventListener('click', onClick);
        controller.root.removeEventListener('submit', onSubmit);
    };

    controller.root.addEventListener('click', onClick);
    controller.root.addEventListener('submit', onSubmit);
    return controller;
}

export function buildTurneroAdminQueueSurfaceCommercialConsoleHtml(input = {}) {
    const scope = toString(input.scope, 'global') || 'global';
    const clinicProfile = asObject(input.clinicProfile);
    const ledgerStore = createTurneroSurfaceCommercialLedger(
        scope,
        clinicProfile
    );
    const ownerStore = createTurneroSurfaceCommercialOwnerStore(
        scope,
        clinicProfile
    );
    const state = buildConsoleState(
        input,
        Array.isArray(input.ledger) ? input.ledger : ledgerStore.list(),
        Array.isArray(input.owners) ? input.owners : ownerStore.list()
    );
    updateBrief(state);
    return renderConsoleHtml(state);
}

export function mountTurneroAdminQueueSurfaceCommercialConsole(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!(host instanceof HTMLElement) || typeof document === 'undefined') {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureStyles();
    const scope = toString(input.scope, 'global') || 'global';
    const clinicProfile = asObject(input.clinicProfile);
    const ledgerStore = createTurneroSurfaceCommercialLedger(
        scope,
        clinicProfile
    );
    const ownerStore = createTurneroSurfaceCommercialOwnerStore(
        scope,
        clinicProfile
    );
    const controller = buildController(input, ledgerStore, ownerStore);
    controller.root.className =
        'turnero-admin-queue-surface-commercial-console';
    host.replaceChildren(controller.root);
    controller.refresh();
    return controller;
}

function renderMetric(label, value, detail = '') {
    return `
        <article class="turnero-admin-queue-surface-commercial-console__metric">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            ${detail ? `<span class="turnero-admin-queue-surface-commercial-console__entry-meta">${escapeHtml(detail)}</span>` : ''}
        </article>
    `;
}

function renderSurfaceCard(card) {
    const checklist = normalizeChecklistSummary(card.checklist);
    return `
        <article class="turnero-admin-queue-surface-commercial-console__surface" data-surface-key="${escapeHtml(card.surfaceKey)}" data-state="${escapeHtml(card.readout.gateBand)}">
            <div class="turnero-admin-queue-surface-commercial-console__surface-header">
                <div class="turnero-admin-queue-surface-commercial-console__surface-title">
                    <strong>${escapeHtml(card.label)}</strong>
                    <p>${escapeHtml(card.readout.surfaceKey)}</p>
                </div>
                <span class="turnero-admin-queue-surface-commercial-console__surface-badge">${escapeHtml(`${card.readout.gateBand} · ${Number(card.readout.gateScore || 0)}`)}</span>
            </div>
            <p class="turnero-admin-queue-surface-commercial-console__surface-summary">${escapeHtml(`${card.readout.packageTier} · runtime ${card.readout.runtimeState} · truth ${card.readout.truth}`)}</p>
            <p class="turnero-admin-queue-surface-commercial-console__entry-meta">${escapeHtml(`Owner ${toString(card.readout.commercialOwner, 'sin owner') || 'sin owner'} · Ops ${toString(card.readout.opsOwner, 'ops')} · Scope ${toString(card.readout.scopeState, 'draft')} · Pricing ${toString(card.readout.pricingState, 'draft')}`)}</p>
            <p class="turnero-admin-queue-surface-commercial-console__entry-meta">${escapeHtml(`Checklist ${checklist.pass}/${checklist.all} · Ledger ${card.ledger.length} · Owners ${card.owners.length} · Decision ${card.readout.gateDecision}`)}</p>
            <div class="turnero-admin-queue-surface-commercial-console__surface-chip-row">
                <span data-role="tier-chip"></span>
                <span data-role="commercial-chip"></span>
                <span data-role="score-chip"></span>
            </div>
        </article>
    `;
}

function renderEntry(entry, kind) {
    const meta =
        kind === 'ledger'
            ? `${toString(entry.owner, 'ops')} · ${toString(entry.kind, 'package-note')} · ${formatTimestamp(entry.updatedAt || entry.createdAt)}`
            : `${toString(entry.actor, 'owner')} · ${toString(entry.role, 'commercial')} · ${formatTimestamp(entry.updatedAt || entry.createdAt)}`;
    return `
        <article class="turnero-admin-queue-surface-commercial-console__entry" data-state="${escapeHtml(toString(entry.status, 'ready'))}">
            <div class="turnero-admin-queue-surface-commercial-console__entry-head">
                <strong>${escapeHtml(`${toString(entry.surfaceKey, 'surface')} · ${toString(entry.kind || entry.role, 'entry')} · status ${toString(entry.status, 'ready')}`)}</strong>
                <span class="turnero-admin-queue-surface-commercial-console__surface-badge">${escapeHtml(toString(entry.status, 'ready'))}</span>
            </div>
            <p class="turnero-admin-queue-surface-commercial-console__entry-meta">${escapeHtml(meta)}</p>
            ${entry.note ? `<p class="turnero-admin-queue-surface-commercial-console__entry-note">${escapeHtml(entry.note)}</p>` : ''}
        </article>
    `;
}

function renderEntryList(entries, kind) {
    return entries.length
        ? `<div class="turnero-admin-queue-surface-commercial-console__list">${entries.map((entry) => renderEntry(entry, kind)).join('')}</div>`
        : '<p class="turnero-admin-queue-surface-commercial-console__empty">Sin entradas todavía.</p>';
}

function renderConsoleHtml(state) {
    return `
        <section class="turnero-admin-queue-surface-commercial-console" data-state="${escapeHtml(state.gate.band)}">
            <div class="turnero-admin-queue-surface-commercial-console__header">
                <div>
                    <p class="turnero-admin-queue-surface-commercial-console__eyebrow">Turnero commercial</p>
                    <h3>Surface Commercial Readiness</h3>
                    <p class="turnero-admin-queue-surface-commercial-console__summary">Paquete mínimo, owners y gate simple de vendibilidad por surface.</p>
                </div>
                <div class="turnero-admin-queue-surface-commercial-console__actions">
                    <button type="button" class="turnero-admin-queue-surface-commercial-console__button" data-action="copy-brief">Copy brief</button>
                    <button type="button" class="turnero-admin-queue-surface-commercial-console__button" data-action="download-json">Download JSON</button>
                    <button type="button" class="turnero-admin-queue-surface-commercial-console__button" data-action="refresh">Refresh</button>
                </div>
            </div>
            <div data-role="banner" class="turnero-admin-queue-surface-commercial-console__banner-host" aria-live="polite"></div>
            <div class="turnero-admin-queue-surface-commercial-console__metrics">
                ${renderMetric('Snapshots', String(state.metrics.totalSurfaces), `${state.metrics.readyCount} ready / ${state.metrics.watchCount} watch`)}
                ${renderMetric('Commercial items', String(state.metrics.commercialItems), `${state.metrics.degradedCount + state.metrics.blockedCount} with attention`)}
                ${renderMetric('Owners', String(state.metrics.owners), `${state.metrics.checklistPass}/${state.metrics.checklistAll} checklist pass`)}
                ${renderMetric('Commercial gate', `${Number(state.gate.score || 0)} · ${state.gate.band}`, state.gate.decision)}
            </div>
            <div class="turnero-admin-queue-surface-commercial-console__surface-grid">${state.surfacePacks.map((card) => renderSurfaceCard(card)).join('')}</div>
            <section class="turnero-admin-queue-surface-commercial-console__section">
                <div class="turnero-admin-queue-surface-commercial-console__section-header">
                    <div>
                        <h4>Commercial items</h4>
                        <p>Evidencia mínima de propuesta, paquete o alcance para la clínica activa.</p>
                    </div>
                    <button type="button" class="turnero-admin-queue-surface-commercial-console__button" data-action="clear-ledger">Clear ledger</button>
                </div>
                <form class="turnero-admin-queue-surface-commercial-console__form" data-action="add-ledger">
                    <label>Surface key <input data-field="ledger-surface-key" type="text" value="${escapeHtml(state.snapshots[0]?.surfaceKey || 'operator-turnos')}" /></label>
                    <label>Kind <input data-field="ledger-kind" type="text" value="package-note" /></label>
                    <label>Status <input data-field="ledger-status" type="text" value="ready" /></label>
                    <label>Owner <input data-field="ledger-owner" type="text" value="ops" /></label>
                    <label style="grid-column:1 / -1;">Note <textarea data-field="ledger-note">Commercial note</textarea></label>
                    <div class="turnero-admin-queue-surface-commercial-console__form-actions"><button type="submit" class="turnero-admin-queue-surface-commercial-console__button" data-tone="primary">Add commercial item</button></div>
                </form>
                ${renderEntryList(state.ledger, 'ledger')}
            </section>
            <section class="turnero-admin-queue-surface-commercial-console__section">
                <div class="turnero-admin-queue-surface-commercial-console__section-header">
                    <div>
                        <h4>Owners</h4>
                        <p>Responsables comercial-operativos de seguimiento por surface.</p>
                    </div>
                    <button type="button" class="turnero-admin-queue-surface-commercial-console__button" data-action="clear-owners">Clear owners</button>
                </div>
                <form class="turnero-admin-queue-surface-commercial-console__form" data-action="add-owner">
                    <label>Surface key <input data-field="owner-surface-key" type="text" value="${escapeHtml(state.snapshots[0]?.surfaceKey || 'operator-turnos')}" /></label>
                    <label>Actor <input data-field="owner-actor" type="text" value="owner" /></label>
                    <label>Role <input data-field="owner-role" type="text" value="commercial" /></label>
                    <label>Status <input data-field="owner-status" type="text" value="active" /></label>
                    <label style="grid-column:1 / -1;">Note <textarea data-field="owner-note">Owner note</textarea></label>
                    <div class="turnero-admin-queue-surface-commercial-console__form-actions"><button type="submit" class="turnero-admin-queue-surface-commercial-console__button" data-tone="primary">Add owner</button></div>
                </form>
                ${renderEntryList(state.owners, 'owner')}
            </section>
            <pre data-role="brief" class="turnero-admin-queue-surface-commercial-console__brief">${escapeHtml(state.brief)}</pre>
        </section>
    `;
}

function renderChips(root, state) {
    state.surfacePacks.forEach((card) => {
        const cardHost = root.querySelector(
            `[data-surface-key="${card.surfaceKey}"]`
        );
        if (!(cardHost instanceof HTMLElement)) return;
        const tier = cardHost.querySelector('[data-role="tier-chip"]');
        const commercial = cardHost.querySelector(
            '[data-role="commercial-chip"]'
        );
        const score = cardHost.querySelector('[data-role="score-chip"]');
        if (tier instanceof HTMLElement) {
            mountTurneroSurfaceCheckpointChip(tier, {
                label: 'tier',
                value: card.readout.packageTier,
                state:
                    card.readout.packageTier === 'pilot-plus'
                        ? 'ready'
                        : 'warning',
            });
        }
        if (commercial instanceof HTMLElement) {
            mountTurneroSurfaceCheckpointChip(commercial, {
                label: 'commercial',
                value: card.readout.gateBand,
                state:
                    card.readout.gateBand === 'ready'
                        ? 'ready'
                        : card.readout.gateBand === 'watch'
                          ? 'warning'
                          : 'alert',
            });
        }
        if (score instanceof HTMLElement) {
            mountTurneroSurfaceCheckpointChip(score, {
                label: 'score',
                value: String(Number(card.readout.gateScore || 0)),
                state:
                    card.readout.gateBand === 'ready'
                        ? 'ready'
                        : card.readout.gateBand === 'watch'
                          ? 'warning'
                          : 'alert',
            });
        }
    });
}
