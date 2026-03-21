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
import { createTurneroSurfaceGoLiveLedger } from './turnero-surface-go-live-ledger.js';
import { buildTurneroSurfaceGoLivePack } from './turnero-surface-go-live-pack.js';
import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';

const STYLE_ID = 'turneroAdminQueueSurfaceGoLiveConsoleInlineStyles';

function ensureGoLiveConsoleStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-admin-queue-surface-go-live-console__tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.45rem;
            margin-top: 0.45rem;
        }
        .turnero-admin-queue-surface-go-live-console__surface {
            display: grid;
            gap: 0.7rem;
        }
        .turnero-admin-queue-surface-go-live-console__surface[data-state='ready'] {
            border-color: rgb(22 163 74 / 20%);
        }
        .turnero-admin-queue-surface-go-live-console__surface[data-state='watch'] {
            border-color: rgb(180 83 9 / 18%);
        }
        .turnero-admin-queue-surface-go-live-console__surface[data-state='degraded'] {
            border-color: rgb(234 88 12 / 18%);
        }
        .turnero-admin-queue-surface-go-live-console__surface[data-state='blocked'] {
            border-color: rgb(190 24 93 / 18%);
        }
        .turnero-admin-queue-surface-go-live-console__surface-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 0.5rem;
        }
        .turnero-admin-queue-surface-go-live-console__surface-grid div {
            padding: 0.55rem 0.62rem;
            border-radius: 14px;
            background: rgb(15 23 32 / 3%);
        }
        .turnero-admin-queue-surface-go-live-console__surface-grid dt {
            font-size: 0.72rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            opacity: 0.68;
        }
        .turnero-admin-queue-surface-go-live-console__surface-grid dd {
            margin: 0.2rem 0 0;
            font-weight: 700;
        }
        .turnero-admin-queue-surface-go-live-console__form {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 0.6rem;
            padding: 0.8rem;
            border-radius: 18px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 72%);
        }
        .turnero-admin-queue-surface-go-live-console__form label {
            display: grid;
            gap: 0.3rem;
            font-size: 0.78rem;
        }
        .turnero-admin-queue-surface-go-live-console__form input,
        .turnero-admin-queue-surface-go-live-console__form select,
        .turnero-admin-queue-surface-go-live-console__form textarea {
            min-height: 38px;
            padding: 0.48rem 0.62rem;
            border-radius: 12px;
            border: 1px solid rgb(15 23 32 / 14%);
            background: rgb(255 255 255 / 96%);
            color: inherit;
            font: inherit;
        }
        .turnero-admin-queue-surface-go-live-console__form textarea {
            min-height: 82px;
            resize: vertical;
        }
        .turnero-admin-queue-surface-go-live-console__evidence-list {
            display: grid;
            gap: 0.45rem;
        }
        .turnero-admin-queue-surface-go-live-console__evidence-item {
            display: flex;
            justify-content: space-between;
            gap: 0.7rem;
            align-items: flex-start;
            padding: 0.72rem 0.8rem;
            border-radius: 16px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 76%);
        }
        .turnero-admin-queue-surface-go-live-console__evidence-item p {
            margin: 0.08rem 0 0;
        }
        .turnero-admin-queue-surface-go-live-console__brief {
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

function getClinicLabel(clinicProfile = {}) {
    return toString(
        clinicProfile?.branding?.name || clinicProfile?.branding?.short_name,
        ''
    );
}

function normalizeSnapshotInput(snapshot = {}, clinicProfile = null) {
    const source = asObject(snapshot);
    const surfaceKey = toString(source.surfaceKey, 'surface');
    return {
        scope: toString(source.scope, surfaceKey),
        surfaceKey,
        surfaceLabel: toString(source.surfaceLabel, surfaceKey),
        clinicId: toString(
            source.clinicId ||
                clinicProfile?.clinic_id ||
                clinicProfile?.clinicId,
            ''
        ),
        clinicLabel: toString(
            source.clinicLabel || getClinicLabel(clinicProfile || {}),
            ''
        ),
        runtimeState: toString(source.runtimeState, 'unknown'),
        truth: toString(source.truth, 'unknown'),
        printerState: toString(source.printerState, 'unknown'),
        bellState: toString(source.bellState, 'unknown'),
        signageState: toString(source.signageState, 'unknown'),
        operatorReady:
            source.operatorReady === true ||
            source.operatorReady === 'true' ||
            source.operatorReady === 1 ||
            source.operatorReady === '1',
        updatedAt: toString(source.updatedAt, new Date().toISOString()),
    };
}

function resolveSnapshotInputs(input = {}, clinicProfile = null) {
    const provided = Array.isArray(input.snapshots)
        ? input.snapshots
        : Array.isArray(input.surfacePacks)
          ? input.surfacePacks.map((item) => item?.snapshot || item)
          : [];
    if (provided.length > 0) {
        return provided.map((snapshot) =>
            normalizeSnapshotInput(snapshot, clinicProfile)
        );
    }

    return ['operator', 'kiosk', 'display'].map((surfaceKey) =>
        normalizeSnapshotInput(
            {
                scope: surfaceKey,
                surfaceKey,
                surfaceLabel: surfaceKey,
                clinicId: clinicProfile?.clinic_id || '',
                clinicLabel: getClinicLabel(clinicProfile || {}),
                runtimeState: 'unknown',
                truth: 'unknown',
                printerState: 'unknown',
                bellState: 'unknown',
                signageState: 'unknown',
                operatorReady: false,
                updatedAt: new Date().toISOString(),
            },
            clinicProfile
        )
    );
}

function buildSurfacePack(snapshot, clinicProfile, ledger) {
    const scope = toString(snapshot.scope, snapshot.surfaceKey || 'global');
    const evidence = ledger.list({ surfaceKey: snapshot.surfaceKey });
    const pack = buildTurneroSurfaceGoLivePack({
        ...snapshot,
        scope,
        clinicProfile,
        evidence,
    });

    return {
        scope,
        snapshot: pack.snapshot,
        checklist: pack.checklist,
        evidence: pack.evidence,
        gate: pack.gate,
        readout: pack.readout,
    };
}

function buildAggregateChecklist(surfacePacks = []) {
    const checks = surfacePacks.flatMap((item) =>
        toArray(item.checklist?.checks)
    );
    return {
        checks,
        summary: {
            all: checks.length,
            pass: checks.filter((item) => item.pass).length,
            fail: checks.filter((item) => !item.pass).length,
        },
    };
}

function buildAggregateGate(checklist, evidence = []) {
    const readyEvidenceCount = evidence.filter(
        (item) => toString(item?.status, '').toLowerCase() === 'ready'
    ).length;
    const evidencePct =
        evidence.length > 0 ? (readyEvidenceCount / evidence.length) * 100 : 0;
    const checklistPct =
        Number(checklist.summary?.all || 0) > 0
            ? (Number(checklist.summary?.pass || 0) /
                  Number(checklist.summary?.all || 1)) *
              100
            : 0;
    const score = Math.max(
        0,
        Math.min(
            100,
            Number((checklistPct * 0.75 + evidencePct * 0.25).toFixed(1))
        )
    );
    const band =
        Number(checklist.summary?.fail || 0) >= 4 ||
        Number(checklist.summary?.pass || 0) === 0 ||
        score < 40
            ? 'blocked'
            : score >= 90
              ? 'ready'
              : score >= 70
                ? 'watch'
                : 'degraded';

    return {
        score,
        band,
        decision:
            band === 'ready'
                ? 'go-live-ok'
                : band === 'watch'
                  ? 'review-evidence-before-go-live'
                  : band === 'degraded'
                    ? 'fix-open-checkpoints'
                    : 'hold-go-live',
        readyEvidenceCount,
        evidenceCount: evidence.length,
        generatedAt: new Date().toISOString(),
    };
}

function buildBrief(state) {
    const gate = state.gate || {};
    const lines = [
        '# Surface Go-Live Readiness',
        '',
        `Clinic: ${toString(state.clinicLabel, state.clinicId || 'n/a')}`,
        `Scope: ${toString(state.scope, 'global')}`,
        `Aggregate gate: ${toString(gate.band, 'unknown')} (${Number(
            gate.score || 0
        )})`,
        `Decision: ${toString(gate.decision, 'review')}`,
        '',
        '## Surfaces',
    ];

    state.surfacePacks.forEach((pack) => {
        lines.push(
            `- ${toString(pack.readout.surfaceLabel, pack.snapshot.surfaceKey)}: ${toString(
                pack.readout.gateBand,
                'unknown'
            )} · ${Number(pack.readout.gateScore || 0)} · ${toString(
                pack.readout.summary,
                ''
            )}`
        );
    });

    lines.push('', '## Evidence');
    if (state.evidence.length === 0) {
        lines.push('- Sin evidencia.');
    } else {
        state.evidence.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'ready')}] ${toString(
                    entry.surfaceKey,
                    'surface'
                )} · ${toString(entry.kind, 'go-live-evidence')} · ${toString(
                    entry.note,
                    ''
                )}`
            );
        });
    }

    return lines.join('\n').trim();
}

function buildDownloadSnapshot(state) {
    return {
        scope: state.scope,
        clinicProfile: state.clinicProfile,
        surfacePacks: state.surfacePacks,
        checklist: state.checklist,
        gate: state.gate,
        evidence: state.evidence,
        generatedAt: state.generatedAt,
        currentRoute:
            typeof window !== 'undefined'
                ? `${window.location.pathname || ''}${window.location.search || ''}${
                      window.location.hash || ''
                  }`
                : '',
    };
}

function renderSurfaceCards(surfacePacks = []) {
    if (surfacePacks.length === 0) {
        return `
            <article class="turnero-surface-ops-console__surface turnero-admin-queue-surface-go-live-console__surface" data-state="blocked">
                <strong>Sin snapshots</strong>
                <p>No hay superficies para mostrar.</p>
            </article>
        `;
    }

    return surfacePacks
        .map((item) => {
            const checklistRows = toArray(item.checklist?.checks)
                .map(
                    (check) => `
                        <li data-state="${escapeHtml(
                            check.pass ? 'ready' : 'alert'
                        )}">
                            <span>${escapeHtml(check.label || check.key)}</span>
                            <strong>${escapeHtml(check.pass ? 'Listo' : 'Falta')}</strong>
                        </li>
                    `
                )
                .join('');
            const latestEvidence = item.evidence[0] || null;
            const snapshot = item.snapshot || {};

            return `
                <article class="turnero-surface-ops-console__surface turnero-admin-queue-surface-go-live-console__surface" data-state="${escapeHtml(
                    item.readout.gateBand
                )}">
                    <div class="turnero-surface-ops-console__surface-header">
                        <div>
                            <strong>${escapeHtml(
                                item.readout.surfaceLabel || snapshot.surfaceKey
                            )}</strong>
                            <span>${escapeHtml(
                                snapshot.clinicLabel || snapshot.clinicId || ''
                            )}</span>
                        </div>
                        <span class="queue-app-card__tag" data-state="${escapeHtml(
                            item.readout.gateBand
                        )}">${escapeHtml(
                            `${item.readout.gateBand} · ${Number(
                                item.readout.gateScore || 0
                            )}`
                        )}</span>
                    </div>
                    <p>${escapeHtml(item.readout.summary)}</p>
                    <div class="turnero-surface-ops-console__section">
                        <h4>Snapshot</h4>
                        <div class="turnero-admin-queue-surface-go-live-console__surface-grid">
                            <div><dt>Runtime</dt><dd>${escapeHtml(
                                snapshot.runtimeState || 'unknown'
                            )}</dd></div>
                            <div><dt>Truth</dt><dd>${escapeHtml(
                                snapshot.truth || 'unknown'
                            )}</dd></div>
                            <div><dt>Printer</dt><dd>${escapeHtml(
                                snapshot.printerState || 'unknown'
                            )}</dd></div>
                            <div><dt>Bell</dt><dd>${escapeHtml(
                                snapshot.bellState || 'unknown'
                            )}</dd></div>
                            <div><dt>Signage</dt><dd>${escapeHtml(
                                snapshot.signageState || 'unknown'
                            )}</dd></div>
                            <div><dt>Operator</dt><dd>${escapeHtml(
                                snapshot.operatorReady ? 'ready' : 'pending'
                            )}</dd></div>
                        </div>
                    </div>
                    <div class="turnero-surface-ops-console__section">
                        <h4>Checklist</h4>
                        <ul class="turnero-surface-ops-console__list">
                            ${checklistRows}
                        </ul>
                    </div>
                    <div class="turnero-surface-ops-console__section">
                        <h4>Evidence</h4>
                        <p class="turnero-surface-ops-console__meta">
                            ${escapeHtml(
                                `${item.readout.readyEvidenceCount}/${item.readout.evidenceCount} ready`
                            )}
                        </p>
                        <p class="turnero-surface-ops-console__meta">
                            ${escapeHtml(
                                latestEvidence
                                    ? `${latestEvidence.surfaceKey} · ${latestEvidence.kind} · ${latestEvidence.note || 'Sin nota'}`
                                    : 'Sin evidencia registrada.'
                            )}
                        </p>
                    </div>
                </article>
            `;
        })
        .join('');
}

function renderEvidenceItems(evidence = []) {
    if (evidence.length === 0) {
        return `
            <p class="turnero-surface-ops-console__empty">Sin evidencia manual.</p>
        `;
    }

    return evidence
        .map(
            (entry) => `
                <article class="turnero-admin-queue-surface-go-live-console__evidence-item" data-surface="${escapeHtml(
                    entry.surfaceKey || 'surface'
                )}">
                    <div>
                        <strong>${escapeHtml(
                            entry.kind || 'go-live-evidence'
                        )}</strong>
                        <p>${escapeHtml(
                            `${entry.surfaceKey || 'surface'} · ${entry.status || 'ready'} · ${formatTimestamp(entry.updatedAt || entry.createdAt)}`
                        )}</p>
                        <p>${escapeHtml(entry.note || 'Sin nota')}</p>
                    </div>
                </article>
            `
        )
        .join('');
}

function getSurfaceLabelFromSnapshot(snapshot = {}) {
    return toString(snapshot.surfaceLabel, snapshot.surfaceKey || 'surface');
}

function createFormField(labelText, fieldNode) {
    const label = document.createElement('label');
    const caption = document.createElement('span');
    caption.textContent = labelText;
    label.appendChild(caption);
    label.appendChild(fieldNode);
    return label;
}

function createTextInput({ placeholder = '', type = 'text' } = {}) {
    const input = document.createElement(
        type === 'textarea' ? 'textarea' : 'input'
    );
    if (type !== 'textarea') {
        input.type = type;
    }
    input.placeholder = placeholder;
    return input;
}

export function mountTurneroAdminQueueSurfaceGoLiveConsole(target, input = {}) {
    const host = resolveTarget(target);
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureGoLiveConsoleStyles();

    const clinicProfile = asObject(input.clinicProfile);
    const scope = toString(
        input.scope || clinicProfile?.clinic_id || clinicProfile?.clinicId,
        'global'
    );
    const snapshots = resolveSnapshotInputs(input, clinicProfile);
    const ledgersByScope = new Map();
    const state = {
        scope,
        clinicProfile,
        clinicId: toString(
            clinicProfile?.clinic_id || clinicProfile?.clinicId,
            ''
        ),
        clinicLabel: getClinicLabel(clinicProfile),
        snapshotInputs: snapshots,
        surfacePacks: [],
        checklist: {
            checks: [],
            summary: { all: 0, pass: 0, fail: 0 },
        },
        gate: {
            score: 0,
            band: 'blocked',
            decision: 'hold-go-live',
            readyEvidenceCount: 0,
            evidenceCount: 0,
        },
        evidence: [],
        brief: '',
        generatedAt: new Date().toISOString(),
    };

    function getLedger(surfaceScope) {
        const normalizedScope = toString(surfaceScope, 'global');
        if (!ledgersByScope.has(normalizedScope)) {
            ledgersByScope.set(
                normalizedScope,
                createTurneroSurfaceGoLiveLedger(normalizedScope, clinicProfile)
            );
        }
        return ledgersByScope.get(normalizedScope);
    }

    function recompute() {
        const surfacePacks = state.snapshotInputs.map((snapshot) => {
            const normalizedSnapshot = normalizeSnapshotInput(
                snapshot,
                clinicProfile
            );
            const ledger = getLedger(
                normalizedSnapshot.scope || normalizedSnapshot.surfaceKey
            );
            return buildSurfacePack(normalizedSnapshot, clinicProfile, ledger);
        });
        const checklist = buildAggregateChecklist(surfacePacks);
        const evidence = surfacePacks.flatMap((item) =>
            toArray(item.evidence).map((entry) => ({
                ...entry,
                surfaceLabel: getSurfaceLabelFromSnapshot(item.snapshot),
            }))
        );
        const gate = buildAggregateGate(checklist, evidence);

        Object.assign(state, {
            surfacePacks,
            checklist,
            evidence,
            gate,
            brief: buildBrief({
                ...state,
                surfacePacks,
                checklist,
                evidence,
                gate,
            }),
            generatedAt: new Date().toISOString(),
        });
    }

    const root = document.createElement('section');
    root.className =
        'queue-app-card turnero-surface-ops-console turnero-admin-queue-surface-go-live-console';
    root.dataset.state = state.gate.band;
    root.dataset.scope = state.scope;

    const header = document.createElement('div');
    header.className = 'turnero-surface-ops-console__header';

    const headerCopy = document.createElement('div');
    headerCopy.className =
        'turnero-admin-queue-surface-go-live-console__header-copy';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'queue-app-card__eyebrow';
    eyebrow.textContent = 'Surface go-live';
    const title = document.createElement('h3');
    title.className = 'queue-app-card__title';
    title.textContent = 'Admin queue · go-live readiness';
    const description = document.createElement('p');
    description.className = 'queue-app-card__description';
    description.textContent =
        'Checklist de sitio, evidencia clinic-scoped y gate de salida.';
    headerCopy.appendChild(eyebrow);
    headerCopy.appendChild(title);
    headerCopy.appendChild(description);

    const tags = document.createElement('div');
    tags.className = 'turnero-admin-queue-surface-go-live-console__tags';

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'turnero-surface-ops-console__button';
    copyButton.dataset.action = 'copy-brief';
    copyButton.textContent = 'Copy brief';

    const downloadButton = document.createElement('button');
    downloadButton.type = 'button';
    downloadButton.className = 'turnero-surface-ops-console__button';
    downloadButton.dataset.action = 'download-json';
    downloadButton.textContent = 'Download JSON';

    header.appendChild(headerCopy);
    header.appendChild(tags);
    header.appendChild(copyButton);
    header.appendChild(downloadButton);

    const surfaceGrid = document.createElement('div');
    surfaceGrid.className = 'turnero-surface-ops-console__grid';
    surfaceGrid.dataset.role = 'surfaces';

    const form = document.createElement('div');
    form.className = 'turnero-admin-queue-surface-go-live-console__form';
    form.dataset.role = 'evidence-form';

    const surfaceSelect = document.createElement('select');
    surfaceSelect.dataset.field = 'surface-key';

    state.snapshotInputs.forEach((snapshot) => {
        const option = document.createElement('option');
        option.value = snapshot.scope || snapshot.surfaceKey;
        option.textContent = getSurfaceLabelFromSnapshot(snapshot);
        surfaceSelect.appendChild(option);
    });
    surfaceSelect.value = state.snapshotInputs[0]?.scope || 'global';

    const kindInput = createTextInput({
        placeholder: 'go-live-evidence',
    });
    kindInput.dataset.field = 'kind';
    kindInput.value = 'go-live-evidence';

    const noteInput = createTextInput({
        placeholder: 'Notas de evidencia',
        type: 'textarea',
    });
    noteInput.dataset.field = 'note';

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'turnero-surface-ops-console__button';
    addButton.dataset.action = 'add-evidence';
    addButton.textContent = 'Add evidence';

    form.appendChild(createFormField('Surface', surfaceSelect));
    form.appendChild(createFormField('Kind', kindInput));
    form.appendChild(createFormField('Note', noteInput));
    form.appendChild(addButton);

    const evidenceList = document.createElement('div');
    evidenceList.className =
        'turnero-admin-queue-surface-go-live-console__evidence-list';
    evidenceList.dataset.role = 'evidence-list';

    const briefNode = document.createElement('pre');
    briefNode.className = 'turnero-admin-queue-surface-go-live-console__brief';
    briefNode.dataset.role = 'brief';

    function render() {
        root.dataset.state = state.gate.band;
        tags.replaceChildren();
        [
            `${state.surfacePacks.length} surfaces`,
            `${state.checklist.summary.pass}/${state.checklist.summary.all} checks`,
            `${state.gate.readyEvidenceCount}/${state.gate.evidenceCount} evidence`,
            `${state.gate.band} · ${Number(state.gate.score || 0)}`,
        ].forEach((labelText) => {
            const tag = document.createElement('span');
            tag.className = 'queue-app-card__tag';
            tag.textContent = labelText;
            tags.appendChild(tag);
        });
        surfaceGrid.innerHTML = renderSurfaceCards(state.surfacePacks);
        evidenceList.innerHTML = renderEvidenceItems(state.evidence);
        briefNode.textContent = state.brief;
    }

    copyButton.addEventListener('click', async () => {
        await copyTextToClipboard(state.brief);
    });

    downloadButton.addEventListener('click', () => {
        downloadJsonSnapshot(
            'turnero-surface-go-live-readiness.json',
            buildDownloadSnapshot(state)
        );
    });

    addButton.addEventListener('click', () => {
        const surfaceScope = toString(surfaceSelect.value, 'global');
        const ledger = getLedger(surfaceScope);
        ledger.add({
            surfaceKey: surfaceScope,
            kind: toString(kindInput.value, 'go-live-evidence'),
            status: 'ready',
            owner: 'ops',
            note: toString(noteInput.value, ''),
        });
        noteInput.value = '';
        kindInput.value = 'go-live-evidence';
        surfaceSelect.value = surfaceScope;
        state.generatedAt = new Date().toISOString();
        recompute();
        render();
    });

    recompute();

    root.appendChild(header);
    root.appendChild(surfaceGrid);
    root.appendChild(form);
    root.appendChild(evidenceList);
    root.appendChild(briefNode);
    host.appendChild(root);
    render();

    return {
        root,
        pack: state,
        recompute: () => {
            recompute();
            render();
            return state;
        },
        refs: {
            copyButton,
            downloadButton,
            addButton,
            surfaceSelect,
            kindInput,
            noteInput,
            surfaceGrid,
            evidenceList,
            briefNode,
        },
    };
}
