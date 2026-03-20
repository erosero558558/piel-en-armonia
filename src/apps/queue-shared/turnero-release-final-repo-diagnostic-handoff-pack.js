import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { buildTurneroReleaseEvidenceExportIndex } from './turnero-release-evidence-export-index.js';
import { createTurneroReleaseDiagnosticSessionRegistry } from './turnero-release-diagnostic-session-registry.js';
import { createTurneroReleaseRepoAuditQueue } from './turnero-release-repo-audit-queue.js';
import { buildTurneroReleaseFinalVerdictAssembler } from './turnero-release-final-verdict-assembler.js';
import { buildTurneroReleaseDiagnosticHandoffTimeline } from './turnero-release-diagnostic-handoff-timeline.js';
import { buildTurneroReleaseFinalDiagnosticPackageScore } from './turnero-release-final-diagnostic-package-score.js';
import { buildTurneroReleaseFinalDiagnosticPackage } from './turnero-release-final-diagnostic-package-builder.js';
import { escapeHtml, formatDateTime } from '../admin-v3/shared/ui/render.js';

const DEFAULT_DOWNLOAD_FILE_NAME =
    'turnero-release-final-repo-diagnostic-handoff-pack.json';
const DEFAULT_EVIDENCE_SEED = Object.freeze([
    {
        id: 'ev-1',
        label: 'Mainline audit pack',
        kind: 'audit',
        owner: 'program',
        status: 'ready',
        exportKey: 'mainline-audit',
    },
    {
        id: 'ev-2',
        label: 'Closure cockpit pack',
        kind: 'closure',
        owner: 'ops',
        status: 'ready',
        exportKey: 'closure-cockpit',
    },
    {
        id: 'ev-3',
        label: 'Honest diagnosis pack',
        kind: 'verdict',
        owner: 'program',
        status: 'ready',
        exportKey: 'honest-diagnosis',
    },
    {
        id: 'ev-4',
        label: 'Runtime/source comparison',
        kind: 'runtime',
        owner: 'infra',
        status: 'pending',
        exportKey: 'runtime-diff',
    },
]);
const DEFAULT_BLOCKERS = Object.freeze([
    {
        id: 'blk-1',
        kind: 'runtime-source-drift',
        owner: 'infra',
        severity: 'high',
        status: 'open',
        note: 'Runtime source and deployed bundle diverged.',
    },
    {
        id: 'blk-2',
        kind: 'signoff-gap',
        owner: 'program',
        severity: 'medium',
        status: 'open',
        note: 'Final signoff is still pending.',
    },
]);

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function resolveTarget(target) {
    if (typeof target === 'string') {
        if (typeof document === 'undefined') {
            return null;
        }

        return (
            document.getElementById(target) || document.querySelector(target)
        );
    }

    return target;
}

function pickObject(...candidates) {
    for (const candidate of candidates) {
        if (
            candidate &&
            typeof candidate === 'object' &&
            !Array.isArray(candidate) &&
            Object.keys(candidate).length > 0
        ) {
            return candidate;
        }
    }

    return null;
}

function resolveClinicProfile(deps = {}, currentSnapshot = {}, state = {}) {
    return asObject(
        deps.clinicProfile ||
            deps.turneroClinicProfile ||
            currentSnapshot.turneroClinicProfile ||
            currentSnapshot.clinicProfile ||
            state.turneroClinicProfile ||
            {}
    );
}

function resolveClinicId(input = {}, currentSnapshot = {}, clinicProfile = {}) {
    return toText(
        input.clinicId ||
            currentSnapshot.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            '',
        ''
    );
}

function resolveRegion(input = {}, currentSnapshot = {}, clinicProfile = {}) {
    return toText(
        input.region ||
            currentSnapshot.region ||
            clinicProfile.region ||
            clinicProfile.address?.region ||
            resolveClinicId(input, currentSnapshot, clinicProfile) ||
            'regional',
        'regional'
    );
}

function resolveScope(input = {}, currentSnapshot = {}, clinicProfile = {}) {
    return toText(
        input.scope ||
            currentSnapshot.scope ||
            currentSnapshot.region ||
            clinicProfile.region ||
            resolveRegion(input, currentSnapshot, clinicProfile) ||
            'global',
        'global'
    );
}

function resolveClinicLabel(
    input = {},
    currentSnapshot = {},
    clinicProfile = {},
    fallback = 'regional'
) {
    return toText(
        input.clinicLabel ||
            currentSnapshot.clinicLabel ||
            currentSnapshot.clinicName ||
            currentSnapshot.brandName ||
            clinicProfile.branding?.name ||
            clinicProfile.branding?.short_name ||
            resolveClinicId(input, currentSnapshot, clinicProfile) ||
            fallback,
        fallback
    );
}

function resolveClinicShortName(
    input = {},
    currentSnapshot = {},
    clinicProfile = {},
    fallback = 'regional'
) {
    return toText(
        input.clinicShortName ||
            currentSnapshot.clinicShortName ||
            clinicProfile.branding?.short_name ||
            clinicProfile.branding?.name ||
            resolveClinicLabel(input, currentSnapshot, clinicProfile, fallback),
        fallback
    );
}

function resolveEvidenceRows(input = {}, currentSnapshot = {}) {
    const candidates = [
        input.evidence,
        input.evidenceRows,
        currentSnapshot.evidence,
        currentSnapshot.evidenceRows,
        currentSnapshot.releaseEvidenceBundle?.evidence,
        currentSnapshot.releaseEvidenceBundle?.items,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length > 0) {
            return candidate;
        }
    }

    return DEFAULT_EVIDENCE_SEED;
}

function resolveBlockers(input = {}, currentSnapshot = {}) {
    const candidates = [
        input.blockers,
        input.blockerRows,
        currentSnapshot.blockers,
        currentSnapshot.releaseEvidenceBundle?.blockers,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length > 0) {
            return candidate;
        }
    }

    return DEFAULT_BLOCKERS;
}

function resolveLaunchGate(input = {}, currentSnapshot = {}) {
    return (
        pickObject(
            input.launchGate,
            currentSnapshot.launchGate,
            currentSnapshot.releaseEvidenceBundle?.launchGate
        ) || {
            decision: 'collect-last-signoffs',
        }
    );
}

function resolveWorkspaceVerdict(input = {}, currentSnapshot = {}) {
    return (
        pickObject(
            input.workspaceVerdict,
            currentSnapshot.workspaceVerdict,
            currentSnapshot.releaseEvidenceBundle?.workspaceVerdict
        ) || {
            verdict: 'review',
        }
    );
}

function countOpenRows(rows = []) {
    return toArray(rows).filter((row) => {
        const status = toText(row.status || row.state || 'open', 'open')
            .trim()
            .toLowerCase();
        return status !== 'closed';
    }).length;
}

function renderMetricCard(label, value, detail, tone = 'ready', role = '') {
    return `
        <article class="turnero-release-final-repo-diagnostic-handoff-pack__metric" data-state="${escapeHtml(
            tone
        )}">
            <p class="queue-app-card__eyebrow">${escapeHtml(label)}</p>
            <strong${role ? ` data-role="${escapeHtml(role)}"` : ''}>${escapeHtml(
                value
            )}</strong>
            <small>${escapeHtml(detail || '\u00a0')}</small>
        </article>
    `;
}

function renderPreviewList(title, rows, formatter, emptyLabel) {
    const previewRows = toArray(rows).slice(0, 4);

    return `
        <section class="turnero-release-final-repo-diagnostic-handoff-pack__panel">
            <div class="turnero-release-final-repo-diagnostic-handoff-pack__panel-head">
                <p class="queue-app-card__eyebrow">${escapeHtml(title)}</p>
                <strong>${escapeHtml(String(rows.length))}</strong>
            </div>
            ${
                previewRows.length > 0
                    ? `<ul class="turnero-release-final-repo-diagnostic-handoff-pack__list">${previewRows
                          .map(
                              (row) => `
                    <li data-state="${escapeHtml(
                        toText(row.status || row.state || 'ready', 'ready')
                    )}">
                        <strong>${escapeHtml(
                            row.label ||
                                row.title ||
                                row.kind ||
                                row.id ||
                                'Item'
                        )}</strong>
                        <span>${escapeHtml(formatter(row))}</span>
                    </li>`
                          )
                          .join('')}</ul>`
                    : `<p class="turnero-release-final-repo-diagnostic-handoff-pack__empty">${escapeHtml(
                          emptyLabel
                      )}</p>`
            }
        </section>
    `;
}

function renderFinalRepoDiagnosticHandoffPackHtml(pack) {
    const openQueueRows = pack.auditQueue.filter((item) => {
        const status = toText(item.status || item.state || 'open', 'open')
            .trim()
            .toLowerCase();
        return status !== 'closed';
    });

    return `
        <article class="turnero-release-final-repo-diagnostic-handoff-pack__card" data-state="${escapeHtml(
            pack.packageScore.band
        )}">
            <header class="turnero-release-final-repo-diagnostic-handoff-pack__header">
                <div>
                    <p class="queue-app-card__eyebrow">Final repo handoff</p>
                    <h3>Final Repo Diagnostic Handoff Pack</h3>
                    <p>
                        Paquete exportable para entregar el diagnostico honesto
                        del repo/panel.
                    </p>
                    <p class="turnero-release-final-repo-diagnostic-handoff-pack__meta">
                        ${escapeHtml(pack.clinicLabel || pack.region || 'regional')}
                        · ${escapeHtml(formatDateTime(pack.generatedAt))}
                    </p>
                </div>
                <div class="turnero-release-final-repo-diagnostic-handoff-pack__actions">
                    <button type="button" data-action="prepare-session">
                        Prepare session
                    </button>
                    <button type="button" data-action="copy-handoff-pack">
                        Copy handoff brief
                    </button>
                    <button type="button" data-action="download-handoff-pack">
                        Download handoff JSON
                    </button>
                </div>
            </header>

            <div class="turnero-release-final-repo-diagnostic-handoff-pack__metrics">
                ${renderMetricCard(
                    'Package score',
                    String(pack.packageScore.score),
                    pack.packageScore.band,
                    pack.packageScore.band,
                    'package-score'
                )}
                ${renderMetricCard(
                    'Package decision',
                    pack.packageScore.decision,
                    'Final package gate',
                    pack.packageScore.band,
                    'package-decision'
                )}
                ${renderMetricCard(
                    'Session',
                    pack.session?.status || 'unprepared',
                    pack.session?.operator || 'program',
                    pack.session?.status === 'prepared' ? 'ready' : 'warning',
                    'session-status'
                )}
                ${renderMetricCard(
                    'Evidence',
                    `${pack.exportIndex.summary.ready}/${pack.exportIndex.summary.all}`,
                    `${pack.exportIndex.summary.pending} pending`,
                    pack.exportIndex.summary.pending > 0 ? 'warning' : 'ready',
                    'export-ready'
                )}
                ${renderMetricCard(
                    'Audit queue',
                    String(openQueueRows.length),
                    `${pack.auditQueue.length} total`,
                    openQueueRows.length > 0 ? 'warning' : 'ready',
                    'queue-open'
                )}
                ${renderMetricCard(
                    'Blockers',
                    `${pack.verdict.highOpen} high`,
                    `${pack.verdict.openBlockers} open`,
                    pack.verdict.highOpen > 0 ? 'alert' : 'ready',
                    'blocker-open'
                )}
            </div>

            <div class="turnero-release-final-repo-diagnostic-handoff-pack__body">
                ${renderPreviewList(
                    'Evidence exports',
                    pack.exportIndex.rows,
                    (row) => `${row.status} · ${row.kind} · ${row.exportKey}`,
                    'No evidence exports'
                )}
                ${renderPreviewList(
                    'Audit queue',
                    openQueueRows,
                    (row) => `${row.owner} · ${row.area} · ${row.status}`,
                    'No audit queue items'
                )}
                ${renderPreviewList(
                    'Blockers',
                    pack.verdict.blockers,
                    (row) => `${row.severity} · ${row.status} · ${row.owner}`,
                    'No blockers'
                )}
                ${renderPreviewList(
                    'Timeline',
                    pack.timeline.rows,
                    (row) => `${row.window} · ${row.label}`,
                    'No timeline steps'
                )}
            </div>

            <section class="turnero-release-final-repo-diagnostic-handoff-pack__form">
                <div>
                    <p class="queue-app-card__eyebrow">Audit queue</p>
                    <h4>Append audit task</h4>
                    <p>
                        Enqueue the next repo/panel task before copying or
                        exporting the handoff pack.
                    </p>
                </div>
                <div class="turnero-release-final-repo-diagnostic-handoff-pack__inputs">
                    <input data-field="queue-title" placeholder="Audit task" />
                    <input data-field="queue-owner" placeholder="Owner" />
                    <input data-field="queue-area" placeholder="Area" />
                    <button type="button" data-action="add-audit-queue">
                        Add audit task
                    </button>
                </div>
            </section>

            <pre class="turnero-release-final-repo-diagnostic-handoff-pack__brief" data-role="handoff-brief">${escapeHtml(
                pack.packageReport.markdown
            )}</pre>
        </article>
    `;
}

export function buildTurneroReleaseFinalRepoDiagnosticHandoffPack(input = {}) {
    const currentSnapshot = asObject(
        input.currentSnapshot ||
            input.snapshot ||
            input.releaseEvidenceBundle ||
            {}
    );
    const clinicProfile = resolveClinicProfile(
        input,
        currentSnapshot,
        currentSnapshot.clinicProfile || {}
    );
    const scope = resolveScope(input, currentSnapshot, clinicProfile);
    const region = resolveRegion(input, currentSnapshot, clinicProfile);
    const clinicId = resolveClinicId(input, currentSnapshot, clinicProfile);
    const clinicLabel = resolveClinicLabel(
        input,
        currentSnapshot,
        clinicProfile,
        scope
    );
    const clinicShortName = resolveClinicShortName(
        input,
        currentSnapshot,
        clinicProfile,
        clinicLabel
    );
    const detectedPlatform = toText(
        input.detectedPlatform || currentSnapshot.detectedPlatform,
        ''
    );
    const sourceManifest = input.sourceManifest || input.manifest || null;
    const sessionStore =
        input.sessionStore ||
        createTurneroReleaseDiagnosticSessionRegistry(scope);
    const auditQueueStore =
        input.auditQueueStore || createTurneroReleaseRepoAuditQueue(scope);
    const session = sessionStore.get();
    const evidence = resolveEvidenceRows(input, currentSnapshot);
    const blockers = resolveBlockers(input, currentSnapshot);
    const exportIndex = buildTurneroReleaseEvidenceExportIndex({ evidence });
    const auditQueue = auditQueueStore.list();
    const launchGate = resolveLaunchGate(input, currentSnapshot);
    const workspaceVerdict = resolveWorkspaceVerdict(input, currentSnapshot);
    const verdict = buildTurneroReleaseFinalVerdictAssembler({
        launchGate,
        workspaceVerdict,
        blockers,
        currentSnapshot,
    });
    const timeline = buildTurneroReleaseDiagnosticHandoffTimeline({
        nowLabel: input.nowLabel || currentSnapshot.nowLabel || 'ahora',
    });
    const packageScore = buildTurneroReleaseFinalDiagnosticPackageScore({
        exportSummary: exportIndex.summary,
        auditQueue,
        verdict,
        session,
    });
    const generatedAt = toText(
        input.generatedAt || currentSnapshot.generatedAt,
        new Date().toISOString()
    );
    const packageReport = buildTurneroReleaseFinalDiagnosticPackage({
        scope,
        region,
        clinicId,
        clinicLabel,
        clinicShortName,
        detectedPlatform,
        sourceManifest,
        currentSnapshot,
        session,
        exportIndex,
        auditQueue,
        blockers: verdict.blockers,
        verdict,
        timeline,
        packageScore,
        generatedAt,
    });
    const summary = {
        evidenceReadyCount: exportIndex.summary.ready,
        evidencePendingCount: exportIndex.summary.pending,
        auditQueueOpenCount: countOpenRows(auditQueue),
        blockerOpenCount: verdict.openBlockers,
        blockerHighOpenCount: verdict.highOpen,
        score: packageScore.score,
        band: packageScore.band,
        decision: packageScore.decision,
    };
    const snapshot = {
        generatedAt,
        scope,
        region,
        clinicId,
        clinicLabel,
        clinicShortName,
        clinicProfile,
        detectedPlatform,
        sourceManifest,
        currentSnapshot,
        evidence,
        blockers: verdict.blockers,
        session,
        exportIndex,
        auditQueue,
        launchGate,
        workspaceVerdict,
        verdict,
        timeline,
        packageScore,
        packageReport,
        summary,
    };
    const serializableSnapshot = {
        ...snapshot,
        clinicProfile: asObject(clinicProfile),
        currentSnapshot: asObject(currentSnapshot),
        sourceManifest:
            sourceManifest && typeof sourceManifest === 'object'
                ? asObject(sourceManifest)
                : sourceManifest,
        session: session ? { ...session } : null,
        exportIndex: {
            ...exportIndex,
            rows: exportIndex.rows.map((row) => ({ ...row })),
        },
        blockers: verdict.blockers.map((row) => ({ ...row })),
        auditQueue: auditQueue.map((row) => ({ ...row })),
        launchGate: { ...launchGate },
        workspaceVerdict: { ...workspaceVerdict },
        verdict: {
            ...verdict,
            blockers: verdict.blockers.map((row) => ({ ...row })),
        },
        timeline: {
            ...timeline,
            rows: timeline.rows.map((row) => ({ ...row })),
        },
        packageScore: { ...packageScore },
        packageReport: { ...packageReport },
        summary: { ...summary },
    };

    return {
        ...serializableSnapshot,
        sessionStore,
        auditQueueStore,
        downloadFileName: DEFAULT_DOWNLOAD_FILE_NAME,
        snapshotFileName: DEFAULT_DOWNLOAD_FILE_NAME,
        clipboardSummary: packageReport.markdown,
        briefMarkdown: packageReport.markdown,
        snapshot: serializableSnapshot,
    };
}

function syncFinalRepoDiagnosticHandoffPackState(root, pack) {
    const scoreNode = root.querySelector('[data-role="package-score"]');
    const decisionNode = root.querySelector('[data-role="package-decision"]');
    const sessionNode = root.querySelector('[data-role="session-status"]');
    const exportNode = root.querySelector('[data-role="export-ready"]');
    const queueNode = root.querySelector('[data-role="queue-open"]');
    const blockerNode = root.querySelector('[data-role="blocker-open"]');
    const briefNode = root.querySelector('[data-role="handoff-brief"]');
    const openQueueRows = pack.auditQueue.filter((item) => {
        const status = toText(item.status || item.state || 'open', 'open')
            .trim()
            .toLowerCase();
        return status !== 'closed';
    });

    if (scoreNode) {
        scoreNode.textContent = String(pack.packageScore.score);
    }
    if (decisionNode) {
        decisionNode.textContent = pack.packageScore.decision;
    }
    if (sessionNode) {
        sessionNode.textContent = pack.session?.status || 'unprepared';
    }
    if (exportNode) {
        exportNode.textContent = `${pack.exportIndex.summary.ready}/${pack.exportIndex.summary.all}`;
    }
    if (queueNode) {
        queueNode.textContent = String(openQueueRows.length);
    }
    if (blockerNode) {
        blockerNode.textContent = `${pack.verdict.highOpen} high`;
    }
    if (briefNode) {
        briefNode.textContent = pack.packageReport.markdown;
    }
}

export function mountTurneroReleaseFinalRepoDiagnosticHandoffPack(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!isDomElement(host)) {
        return null;
    }

    const currentSnapshot = asObject(
        input.currentSnapshot ||
            input.snapshot ||
            input.releaseEvidenceBundle ||
            {}
    );
    const clinicProfile = resolveClinicProfile(
        input,
        currentSnapshot,
        currentSnapshot.clinicProfile || {}
    );
    const scope = resolveScope(input, currentSnapshot, clinicProfile);
    const sessionStore =
        input.sessionStore ||
        createTurneroReleaseDiagnosticSessionRegistry(scope);
    const auditQueueStore =
        input.auditQueueStore || createTurneroReleaseRepoAuditQueue(scope);
    let pack = buildTurneroReleaseFinalRepoDiagnosticHandoffPack({
        ...input,
        sessionStore,
        auditQueueStore,
    });
    let root = null;

    const result = {
        root: null,
        pack,
        recompute: () => {},
    };

    const render = () => {
        pack = buildTurneroReleaseFinalRepoDiagnosticHandoffPack({
            ...input,
            sessionStore,
            auditQueueStore,
        });
        result.pack = pack;

        if (!root) {
            root = document.createElement('section');
            root.id = 'turneroReleaseFinalRepoDiagnosticHandoffPack';
            root.className =
                'turnero-release-final-repo-diagnostic-handoff-pack';
            root.dataset.turneroReleaseFinalRepoDiagnosticHandoffPack =
                'mounted';
            root.addEventListener('click', async (event) => {
                const actionElement =
                    event.target?.closest?.('[data-action]') || event.target;
                const action = actionElement?.getAttribute?.('data-action');
                if (!action) {
                    return;
                }

                if (action === 'prepare-session') {
                    sessionStore.set({
                        status: 'prepared',
                        operator: 'program',
                        note: 'Diagnostic handoff package prepared',
                    });
                    render();
                    return;
                }

                if (action === 'copy-handoff-pack') {
                    await copyToClipboardSafe(
                        pack.clipboardSummary || pack.briefMarkdown || ''
                    );
                    return;
                }

                if (action === 'download-handoff-pack') {
                    downloadJsonSnapshot(pack.downloadFileName, pack.snapshot);
                    return;
                }

                if (action === 'add-audit-queue') {
                    const title =
                        root.querySelector('[data-field="queue-title"]')
                            ?.value || '';
                    const owner =
                        root.querySelector('[data-field="queue-owner"]')
                            ?.value || '';
                    const area =
                        root.querySelector('[data-field="queue-area"]')
                            ?.value || '';
                    if (!title.trim()) {
                        return;
                    }

                    auditQueueStore.add({
                        title,
                        owner: owner || 'program',
                        area: area || 'repo',
                        status: 'queued',
                        note: 'Final repo diagnostic handoff item',
                    });
                    render();
                }
            });
        }

        root.innerHTML = renderFinalRepoDiagnosticHandoffPackHtml(pack);
        root.dataset.turneroReleaseFinalRepoDiagnosticHandoffPack = 'mounted';
        root.dataset.turneroReleaseFinalRepoDiagnosticHandoffScope = pack.scope;
        root.dataset.turneroReleaseFinalRepoDiagnosticHandoffRegion =
            pack.region;
        root.dataset.turneroReleaseFinalRepoDiagnosticHandoffClinicId =
            pack.clinicId;
        root.dataset.turneroReleaseFinalRepoDiagnosticHandoffScore = String(
            pack.packageScore.score
        );
        root.dataset.turneroReleaseFinalRepoDiagnosticHandoffBand =
            pack.packageScore.band;
        root.dataset.turneroReleaseFinalRepoDiagnosticHandoffDecision =
            pack.packageScore.decision;
        root.dataset.turneroReleaseFinalRepoDiagnosticHandoffSessionStatus =
            pack.session?.status || 'unprepared';
        root.dataset.turneroReleaseFinalRepoDiagnosticHandoffOpenQueue = String(
            countOpenRows(pack.auditQueue)
        );
        root.dataset.turneroReleaseFinalRepoDiagnosticHandoffGeneratedAt =
            pack.generatedAt;

        syncFinalRepoDiagnosticHandoffPackState(root, pack);

        if (typeof host.replaceChildren === 'function') {
            host.replaceChildren(root);
        } else {
            host.innerHTML = '';
            host.appendChild(root);
        }

        host.dataset.turneroReleaseFinalRepoDiagnosticHandoffPack = 'mounted';
        host.dataset.turneroReleaseFinalRepoDiagnosticHandoffScope = pack.scope;
        host.dataset.turneroReleaseFinalRepoDiagnosticHandoffRegion =
            pack.region;
        host.dataset.turneroReleaseFinalRepoDiagnosticHandoffClinicId =
            pack.clinicId;
        host.dataset.turneroReleaseFinalRepoDiagnosticHandoffScore = String(
            pack.packageScore.score
        );
        host.dataset.turneroReleaseFinalRepoDiagnosticHandoffBand =
            pack.packageScore.band;
        host.dataset.turneroReleaseFinalRepoDiagnosticHandoffDecision =
            pack.packageScore.decision;
        host.dataset.turneroReleaseFinalRepoDiagnosticHandoffSessionStatus =
            pack.session?.status || 'unprepared';
        host.dataset.turneroReleaseFinalRepoDiagnosticHandoffOpenQueue = String(
            countOpenRows(pack.auditQueue)
        );
        host.dataset.turneroReleaseFinalRepoDiagnosticHandoffGeneratedAt =
            pack.generatedAt;

        result.root = root;
        return result;
    };

    result.recompute = render;
    return render();
}

export function renderTurneroReleaseFinalRepoDiagnosticHandoffPack(
    target,
    input = {}
) {
    return mountTurneroReleaseFinalRepoDiagnosticHandoffPack(target, input);
}

export default mountTurneroReleaseFinalRepoDiagnosticHandoffPack;
