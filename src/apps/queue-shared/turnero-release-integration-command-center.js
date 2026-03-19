import { buildTurneroReleaseIntegrationContractRegistry } from './turnero-release-integration-contract-registry.js';
import { buildTurneroReleaseDataExchangeMap } from './turnero-release-data-exchange-map.js';
import { buildTurneroReleaseSyncSlaMonitor } from './turnero-release-sync-sla-monitor.js';
import { createTurneroReleaseReplayRecoveryQueue } from './turnero-release-replay-recovery-queue.js';
import { createTurneroReleaseMappingDebtLedger } from './turnero-release-mapping-debt-ledger.js';
import { buildTurneroReleaseBridgeObservabilityPack } from './turnero-release-bridge-observability-pack.js';
import { buildTurneroReleaseIntegrationConfidenceScore } from './turnero-release-integration-confidence-score.js';
import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { escapeHtml, formatDateTime } from '../admin-v3/shared/ui/render.js';

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

function pickObject(...values) {
    for (const value of values) {
        const objectValue = asObject(value);
        if (Object.keys(objectValue).length > 0) {
            return objectValue;
        }
    }

    return {};
}

function getCurrentSnapshot(input = {}) {
    return pickObject(
        input.currentSnapshot,
        input.snapshot,
        input.parts?.currentSnapshot
    );
}

function getReleaseEvidenceBundle(input = {}, currentSnapshot = {}) {
    return pickObject(
        input.releaseEvidenceBundle,
        currentSnapshot.releaseEvidenceBundle,
        currentSnapshot.parts?.releaseEvidenceBundle
    );
}

function getClinicProfile(input = {}, currentSnapshot = {}) {
    return pickObject(
        input.clinicProfile,
        input.turneroClinicProfile,
        currentSnapshot.clinicProfile,
        currentSnapshot.turneroClinicProfile,
        getReleaseEvidenceBundle(input, currentSnapshot).clinicProfile,
        getReleaseEvidenceBundle(input, currentSnapshot).turneroClinicProfile
    );
}

function getClinicId(input = {}, clinicProfile = {}, currentSnapshot = {}) {
    return toText(
        input.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            currentSnapshot.clinicId ||
            getReleaseEvidenceBundle(input, currentSnapshot).clinicId ||
            '',
        ''
    );
}

function getRegion(input = {}, clinicProfile = {}, currentSnapshot = {}) {
    return toText(
        input.region ||
            clinicProfile.region ||
            currentSnapshot.region ||
            getReleaseEvidenceBundle(input, currentSnapshot).region ||
            '',
        ''
    );
}

function getScope(input = {}, clinicProfile = {}, currentSnapshot = {}) {
    return (
        getClinicId(input, clinicProfile, currentSnapshot) ||
        getRegion(input, clinicProfile, currentSnapshot) ||
        'global'
    );
}

function getReleaseDecision(input = {}, currentSnapshot = {}) {
    const releaseEvidenceBundle = getReleaseEvidenceBundle(
        input,
        currentSnapshot
    );
    return (
        toText(
            input.releaseDecision ||
                currentSnapshot.releaseDecision ||
                currentSnapshot.decision ||
                currentSnapshot.remoteReleaseModel?.finalState ||
                currentSnapshot.remoteReleaseModel?.status ||
                currentSnapshot.remoteReleaseModel?.releaseStatus ||
                releaseEvidenceBundle.decision ||
                releaseEvidenceBundle.releaseDecision ||
                'review',
            'review'
        )
            .trim()
            .toLowerCase() || 'review'
    );
}

function getReleaseIncidents(input = {}, currentSnapshot = {}) {
    const releaseEvidenceBundle = getReleaseEvidenceBundle(
        input,
        currentSnapshot
    );
    return toArray(
        input.incidents ||
            input.releaseIncidents ||
            currentSnapshot.incidents ||
            releaseEvidenceBundle.incidents
    );
}

function getClinicLabel(input = {}, clinicProfile = {}, currentSnapshot = {}) {
    const scope = getScope(input, clinicProfile, currentSnapshot);
    return toText(
        input.clinicLabel ||
            clinicProfile.branding?.name ||
            clinicProfile.clinic_name ||
            clinicProfile.clinicName ||
            currentSnapshot.clinicName ||
            currentSnapshot.brandName ||
            currentSnapshot.clinicLabel ||
            scope,
        scope
    );
}

function getClinicShortName(
    input = {},
    clinicProfile = {},
    currentSnapshot = {}
) {
    const scope = getScope(input, clinicProfile, currentSnapshot);
    return toText(
        input.clinicShortName ||
            clinicProfile.branding?.short_name ||
            clinicProfile.short_name ||
            clinicProfile.clinicShortName ||
            currentSnapshot.clinicShortName ||
            currentSnapshot.clinicName ||
            currentSnapshot.brandName ||
            getClinicId(input, clinicProfile, currentSnapshot) ||
            scope,
        scope
    );
}

function countOpenRows(rows = []) {
    return toArray(rows).filter((row) => {
        const state = toText(row?.state, '').trim().toLowerCase();
        return state !== 'closed';
    }).length;
}

function renderTag(label, value, tone = 'ready') {
    return `<span class="queue-app-card__tag" data-state="${escapeHtml(
        tone
    )}">${escapeHtml(label)}: ${escapeHtml(value)}</span>`;
}

function renderSummaryCard({
    label,
    value,
    detail,
    preview = '',
    tone = 'ready',
    role = '',
}) {
    return `
        <article class="turnero-release-integration-command-center__summary-card" data-state="${escapeHtml(
            tone
        )}">
            <p class="queue-app-card__eyebrow">${escapeHtml(label)}</p>
            <strong${role ? ` data-role="${escapeHtml(role)}"` : ''}>${escapeHtml(
                value
            )}</strong>
            <span>${escapeHtml(detail)}</span>
            <small>${escapeHtml(preview || '\u00a0')}</small>
        </article>
    `;
}

function renderPreviewLabels(rows = [], options = {}) {
    const list = toArray(rows).filter((row) => {
        if (!options.openOnly) {
            return true;
        }

        return toText(row?.state, '').trim().toLowerCase() !== 'closed';
    });
    const labels = list
        .slice(0, Number(options.limit || 2))
        .map((row) =>
            toText(
                row?.label || row?.contractId || row?.target || row?.id || '',
                ''
            )
        )
        .filter(Boolean);

    return labels.length
        ? labels.join(' · ')
        : toText(options.fallback, 'Sin elementos');
}

function toneForDecision(decision) {
    const normalized = String(decision || '')
        .trim()
        .toLowerCase();
    if (normalized === 'hold') {
        return 'alert';
    }
    if (normalized === 'review') {
        return 'warning';
    }
    return 'ready';
}

function toneForCount(count, options = {}) {
    const value = Number(count || 0);
    const alertThreshold = Number(options.alertThreshold || Infinity);
    const warningThreshold = Number(options.warningThreshold || 0);

    if (value >= alertThreshold) {
        return 'alert';
    }
    if (value > warningThreshold) {
        return 'warning';
    }
    return 'ready';
}

function toneForConfidence(confidence = {}) {
    if (confidence.decision === 'hold') {
        return 'alert';
    }
    if (confidence.decision === 'review' || confidence.band === 'watch') {
        return 'warning';
    }
    return 'ready';
}

function integrationBriefToMarkdown(pack = {}) {
    const contracts = pack.contracts || { summary: {}, rows: [] };
    const exchangeMap = pack.exchangeMap || { summary: {}, rows: [] };
    const sla = pack.sla || { summary: {}, rows: [] };
    const bridge = pack.bridge || { summary: {}, rows: [] };
    const summary = pack.summary || {};

    return [
        '# Integration Command Center',
        '',
        `Clinic: ${toText(pack.clinicLabel || pack.clinicShortName, 'unknown')}`,
        `Scope: ${toText(pack.scope, 'global')}`,
        `Region: ${toText(pack.region, 'regional')}`,
        `Release decision: ${toText(pack.releaseDecision, 'review')}`,
        `Confidence: ${summary.confidenceScore ?? 0} (${
            summary.confidenceBand || 'n/a'
        }) · ${summary.confidenceDecision || 'review'}`,
        `Contracts: ${contracts.summary?.all ?? 0} total | ${
            contracts.summary?.critical ?? 0
        } critical | ${contracts.summary?.watch ?? 0} watch | ${
            contracts.summary?.degraded ?? 0
        } degraded`,
        `Exchange map: ${exchangeMap.summary?.all ?? 0} total | ${
            exchangeMap.summary?.bidirectional ?? 0
        } bidirectional | ${exchangeMap.summary?.sensitive ?? 0} sensitive`,
        `Sync SLA: ${sla.summary?.all ?? 0} total | ${sla.summary?.healthy ?? 0} healthy | ${
            sla.summary?.watch ?? 0
        } watch | ${sla.summary?.breach ?? 0} breach`,
        `Bridge: ${bridge.summary?.all ?? 0} total | ${
            bridge.summary?.healthy ?? 0
        } healthy | ${bridge.summary?.watch ?? 0} watch | ${
            bridge.summary?.degraded ?? 0
        } degraded`,
        `Replay backlog: ${summary.replayOpenCount ?? 0} open · ${
            summary.replayClosedCount ?? 0
        } closed`,
        `Mapping debt: ${summary.mappingOpenCount ?? 0} open · ${
            summary.mappingClosedCount ?? 0
        } closed`,
        `Live incidents: ${summary.incidentCount ?? 0}`,
        `Generated at: ${formatDateTime(pack.generatedAt || new Date().toISOString())}`,
    ].join('\n');
}

function buildIntegrationCommandCenterPack(input = {}) {
    const currentSnapshot = getCurrentSnapshot(input);
    const clinicProfile = getClinicProfile(input, currentSnapshot);
    const releaseEvidenceBundle = getReleaseEvidenceBundle(
        input,
        currentSnapshot
    );
    const incidents = getReleaseIncidents(input, currentSnapshot);
    const releaseDecision = getReleaseDecision(input, currentSnapshot);
    const scope = getScope(input, clinicProfile, currentSnapshot);
    const clinicId = getClinicId(input, clinicProfile, currentSnapshot);
    const region = getRegion(input, clinicProfile, currentSnapshot);

    const contracts = buildTurneroReleaseIntegrationContractRegistry({
        contracts: toArray(input.contracts),
    });
    const exchangeMap = buildTurneroReleaseDataExchangeMap({
        exchanges: toArray(input.exchanges),
    });
    const sla = buildTurneroReleaseSyncSlaMonitor({
        contracts: contracts.rows,
        healthSignals: toArray(input.healthSignals),
    });
    const bridge = buildTurneroReleaseBridgeObservabilityPack({
        bridgeSignals: toArray(input.bridgeSignals),
    });

    const replayQueueStore = createTurneroReleaseReplayRecoveryQueue(scope);
    const mappingDebtStore = createTurneroReleaseMappingDebtLedger(scope);
    const replayQueue = replayQueueStore.list();
    const mappingDebt = mappingDebtStore.list();
    const replayOpenCount = countOpenRows(replayQueue);
    const mappingOpenCount = countOpenRows(mappingDebt);
    const confidence = buildTurneroReleaseIntegrationConfidenceScore({
        contractSummary: contracts.summary,
        slaSummary: sla.summary,
        replayQueue,
        mappingDebt,
        bridgeSummary: bridge.summary,
        releaseDecision,
    });

    const summary = {
        contractCount: contracts.summary.all,
        exchangeCount: exchangeMap.summary.all,
        slaCount: sla.summary.all,
        bridgeCount: bridge.summary.all,
        replayOpenCount,
        replayClosedCount: replayQueue.length - replayOpenCount,
        mappingOpenCount,
        mappingClosedCount: mappingDebt.length - mappingOpenCount,
        confidenceScore: confidence.score,
        confidenceBand: confidence.band,
        confidenceDecision: confidence.decision,
        incidentCount: incidents.length,
    };

    const pack = {
        scope,
        region,
        clinicId,
        clinicLabel: getClinicLabel(input, clinicProfile, currentSnapshot),
        clinicShortName: getClinicShortName(
            input,
            clinicProfile,
            currentSnapshot
        ),
        releaseDecision,
        sourceContext: {
            clinicId,
            region,
            scope,
            releaseDecision,
            incidentCount: incidents.length,
            currentSnapshotAt: toText(
                currentSnapshot.generatedAt || currentSnapshot.savedAt || '',
                ''
            ),
            releaseEvidenceBundleAt: toText(
                releaseEvidenceBundle.generatedAt ||
                    releaseEvidenceBundle.savedAt ||
                    '',
                ''
            ),
        },
        incidents,
        contracts,
        exchangeMap,
        sla,
        bridge,
        replayQueue,
        mappingDebt,
        confidence,
        summary,
        generatedAt: new Date().toISOString(),
    };

    pack.briefMarkdown = integrationBriefToMarkdown(pack);

    return {
        pack,
        replayQueueStore,
        mappingDebtStore,
    };
}

function renderIntegrationMarkup(pack = {}) {
    const contractPreview = renderPreviewLabels(pack.contracts?.rows, {
        fallback: 'Sin contratos',
    });
    const exchangePreview = renderPreviewLabels(pack.exchangeMap?.rows, {
        fallback: 'Sin exchanges',
    });
    const slaPreview = renderPreviewLabels(pack.sla?.rows, {
        fallback: 'Sin SLA',
    });
    const bridgePreview = renderPreviewLabels(pack.bridge?.rows, {
        fallback: 'Sin bridges',
    });
    const replayPreview = renderPreviewLabels(pack.replayQueue, {
        fallback: 'Sin backlog de replay',
        openOnly: true,
    });
    const mappingPreview = renderPreviewLabels(pack.mappingDebt, {
        fallback: 'Sin deuda de mapeo',
        openOnly: true,
    });

    return `
        <section
            id="turneroReleaseIntegrationCommandCenter"
            class="queue-app-card turnero-release-integration-command-center"
            data-scope="${escapeHtml(pack.scope || 'global')}"
            data-region="${escapeHtml(pack.region || 'regional')}"
            data-clinic-id="${escapeHtml(pack.clinicId || '')}"
            data-release-decision="${escapeHtml(pack.releaseDecision || 'review')}"
            data-state="${escapeHtml(pack.confidence?.band || 'stable')}"
        >
            <header class="queue-app-card__header">
                <div>
                    <p class="queue-app-card__eyebrow">Integration command center</p>
                    <h6>Integration Command Center</h6>
                    <p>
                        ${escapeHtml(pack.clinicLabel || pack.clinicShortName || 'unknown')}
                        · ${escapeHtml(pack.region || pack.scope || 'global')}
                        · release ${escapeHtml(pack.releaseDecision || 'review')}
                    </p>
                </div>
                <div class="queue-app-card__meta">
                    ${renderTag(
                        'Confidence',
                        `${pack.confidence?.score ?? 0}/100`,
                        pack.confidence?.band || 'stable'
                    )}
                    ${renderTag(
                        'Decision',
                        pack.confidence?.decision || 'review',
                        toneForDecision(pack.confidence?.decision)
                    )}
                    ${renderTag(
                        'Incidents',
                        String(pack.summary?.incidentCount ?? 0),
                        Number(pack.summary?.incidentCount || 0) > 0
                            ? 'warning'
                            : 'ready'
                    )}
                </div>
            </header>
            <p class="queue-app-card__description">
                Contratos, intercambio de datos, SLA, observabilidad del bridge,
                replay recovery y mapping debt para el rollout multi-clínica.
            </p>
            <div
                class="turnero-release-integration-command-center__summary-grid"
                style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:16px;"
            >
                ${renderSummaryCard({
                    label: 'Contracts',
                    value: String(pack.summary?.contractCount ?? 0),
                    detail: `${
                        pack.contracts?.summary?.critical ?? 0
                    } critical · ${pack.contracts?.summary?.watch ?? 0} watch · ${
                        pack.contracts?.summary?.degraded ?? 0
                    } degraded`,
                    preview: contractPreview,
                    tone: toneForCount(pack.contracts?.summary?.degraded, {
                        warningThreshold: 0,
                    }),
                    role: 'contracts-total',
                })}
                ${renderSummaryCard({
                    label: 'Exchange map',
                    value: String(pack.summary?.exchangeCount ?? 0),
                    detail: `${
                        pack.exchangeMap?.summary?.bidirectional ?? 0
                    } bidirectional · ${
                        pack.exchangeMap?.summary?.sensitive ?? 0
                    } sensitive`,
                    preview: exchangePreview,
                    tone: 'ready',
                    role: 'exchange-total',
                })}
                ${renderSummaryCard({
                    label: 'Sync SLA',
                    value: String(pack.summary?.slaCount ?? 0),
                    detail: `${
                        pack.sla?.summary?.healthy ?? 0
                    } healthy · ${pack.sla?.summary?.watch ?? 0} watch · ${
                        pack.sla?.summary?.breach ?? 0
                    } breach`,
                    preview: slaPreview,
                    tone:
                        pack.sla?.summary?.breach > 0
                            ? 'alert'
                            : pack.sla?.summary?.watch > 0
                              ? 'warning'
                              : 'ready',
                    role: 'sla-total',
                })}
                ${renderSummaryCard({
                    label: 'Bridge',
                    value: String(pack.summary?.bridgeCount ?? 0),
                    detail: `${
                        pack.bridge?.summary?.healthy ?? 0
                    } healthy · ${pack.bridge?.summary?.watch ?? 0} watch · ${
                        pack.bridge?.summary?.degraded ?? 0
                    } degraded`,
                    preview: bridgePreview,
                    tone:
                        pack.bridge?.summary?.degraded > 0
                            ? 'alert'
                            : pack.bridge?.summary?.watch > 0
                              ? 'warning'
                              : 'ready',
                    role: 'bridge-total',
                })}
                ${renderSummaryCard({
                    label: 'Replay recovery',
                    value: String(pack.summary?.replayOpenCount ?? 0),
                    detail: `${
                        pack.summary?.replayClosedCount ?? 0
                    } closed · ${pack.summary?.incidentCount ?? 0} incident(s)`,
                    preview: replayPreview,
                    tone: toneForCount(pack.summary?.replayOpenCount, {
                        alertThreshold: 6,
                        warningThreshold: 0,
                    }),
                    role: 'replay-open-count',
                })}
                ${renderSummaryCard({
                    label: 'Mapping debt',
                    value: String(pack.summary?.mappingOpenCount ?? 0),
                    detail: `${
                        pack.summary?.mappingClosedCount ?? 0
                    } closed · clinic scoped`,
                    preview: mappingPreview,
                    tone: toneForCount(pack.summary?.mappingOpenCount, {
                        alertThreshold: 4,
                        warningThreshold: 0,
                    }),
                    role: 'mapping-open-count',
                })}
                ${renderSummaryCard({
                    label: 'Confidence',
                    value: String(pack.confidence?.score ?? 0),
                    detail: `${pack.confidence?.band || 'stable'} · ${
                        pack.confidence?.decision || 'review'
                    }`,
                    preview: pack.confidence?.summary || '',
                    tone: toneForConfidence(pack.confidence || {}),
                    role: 'confidence-score',
                })}
            </div>
            <div
                class="turnero-release-integration-command-center__actions"
                style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;"
            >
                <button type="button" data-action="copy-integration-brief">
                    Copy integration brief
                </button>
                <button type="button" data-action="download-integration-pack">
                    Download integration JSON
                </button>
            </div>
            <div
                class="turnero-release-integration-command-center__workspace"
                style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:16px;"
            >
                <section class="turnero-release-integration-command-center__panel">
                    <header class="turnero-release-integration-command-center__panel-head">
                        <p class="queue-app-card__eyebrow">Replay recovery</p>
                        <h6>Backlog clínico</h6>
                    </header>
                    <p data-role="replay-summary">
                        Open ${String(pack.summary?.replayOpenCount ?? 0)} · Closed ${String(
                            pack.summary?.replayClosedCount ?? 0
                        )}
                    </p>
                    <div class="turnero-release-integration-command-center__form">
                        <input data-field="replay-label" placeholder="Replay item" />
                        <input data-field="replay-owner" placeholder="Owner" />
                        <input data-field="replay-contract" placeholder="Contract ID" />
                        <button type="button" data-action="add-replay-item">
                            Add replay item
                        </button>
                    </div>
                </section>
                <section class="turnero-release-integration-command-center__panel">
                    <header class="turnero-release-integration-command-center__panel-head">
                        <p class="queue-app-card__eyebrow">Mapping debt</p>
                        <h6>Deuda de mapeo</h6>
                    </header>
                    <p data-role="mapping-summary">
                        Open ${String(pack.summary?.mappingOpenCount ?? 0)} · Closed ${String(
                            pack.summary?.mappingClosedCount ?? 0
                        )}
                    </p>
                    <div class="turnero-release-integration-command-center__form">
                        <input data-field="mapping-label" placeholder="Debt label" />
                        <input data-field="mapping-owner" placeholder="Owner" />
                        <input data-field="mapping-flow" placeholder="Impacted flow" />
                        <button type="button" data-action="add-mapping-debt">
                            Add mapping debt
                        </button>
                    </div>
                </section>
            </div>
            <pre
                data-role="integration-brief"
                style="white-space:pre-wrap;margin-top:16px;"
            >${escapeHtml(pack.briefMarkdown || integrationBriefToMarkdown(pack))}</pre>
        </section>
    `;
}

function collectRenderedNodes(rootElement) {
    return {
        confidenceScore: rootElement.querySelector(
            '[data-role="confidence-score"]'
        ),
        replaySummary: rootElement.querySelector(
            '[data-role="replay-summary"]'
        ),
        mappingSummary: rootElement.querySelector(
            '[data-role="mapping-summary"]'
        ),
        integrationBrief: rootElement.querySelector(
            '[data-role="integration-brief"]'
        ),
        replayLabel: rootElement.querySelector('[data-field="replay-label"]'),
        replayOwner: rootElement.querySelector('[data-field="replay-owner"]'),
        replayContract: rootElement.querySelector(
            '[data-field="replay-contract"]'
        ),
        mappingLabel: rootElement.querySelector('[data-field="mapping-label"]'),
        mappingOwner: rootElement.querySelector('[data-field="mapping-owner"]'),
        mappingFlow: rootElement.querySelector('[data-field="mapping-flow"]'),
    };
}

function setNodeText(node, value) {
    if (!node || typeof node !== 'object') {
        return;
    }

    node.textContent = String(value ?? '');
}

function syncRenderedState(host, rootElement, nodes, pack) {
    if (host && host.dataset) {
        host.dataset.turneroIntegrationCommandCenterMounted = 'true';
        host.dataset.turneroIntegrationCommandCenterScope =
            pack.scope || 'global';
        host.dataset.turneroIntegrationCommandCenterClinicId =
            pack.clinicId || '';
        host.dataset.turneroIntegrationCommandCenterDecision =
            pack.confidence?.decision || 'review';
        host.dataset.turneroIntegrationCommandCenterReleaseDecision =
            pack.releaseDecision || 'review';
        host.dataset.turneroIntegrationCommandCenterScore = String(
            pack.confidence?.score ?? 0
        );
        host.dataset.turneroIntegrationCommandCenterBand =
            pack.confidence?.band || 'stable';
        host.dataset.turneroIntegrationCommandCenterReplayOpen = String(
            pack.summary?.replayOpenCount ?? 0
        );
        host.dataset.turneroIntegrationCommandCenterMappingOpen = String(
            pack.summary?.mappingOpenCount ?? 0
        );
    }

    if (rootElement && rootElement.dataset) {
        rootElement.dataset.scope = pack.scope || 'global';
        rootElement.dataset.region = pack.region || 'regional';
        rootElement.dataset.clinicId = pack.clinicId || '';
        rootElement.dataset.releaseDecision = pack.releaseDecision || 'review';
        rootElement.dataset.state = pack.confidence?.band || 'stable';
    }

    setNodeText(nodes.confidenceScore, pack.confidence?.score ?? 0);
    setNodeText(
        nodes.replaySummary,
        `Open ${String(pack.summary?.replayOpenCount ?? 0)} · Closed ${String(
            pack.summary?.replayClosedCount ?? 0
        )}`
    );
    setNodeText(
        nodes.mappingSummary,
        `Open ${String(pack.summary?.mappingOpenCount ?? 0)} · Closed ${String(
            pack.summary?.mappingClosedCount ?? 0
        )}`
    );
    setNodeText(nodes.integrationBrief, pack.briefMarkdown || '');
}

export function mountTurneroReleaseIntegrationCommandCenter(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!isDomElement(host)) {
        return null;
    }

    const mountState = buildIntegrationCommandCenterPack(input);
    let { pack } = mountState;
    let rootElement = null;
    let nodes = {};
    const result = {
        root: null,
        pack,
        recompute: null,
        replayQueueStore: mountState.replayQueueStore,
        mappingDebtStore: mountState.mappingDebtStore,
    };

    const render = () => {
        host.innerHTML = renderIntegrationMarkup(pack);
        rootElement =
            host.querySelector('#turneroReleaseIntegrationCommandCenter') ||
            host;
        nodes = collectRenderedNodes(rootElement);
        syncRenderedState(host, rootElement, nodes, pack);
        result.root = rootElement;
        result.pack = pack;
    };

    const recompute = () => {
        const nextPack = buildIntegrationCommandCenterPack(input).pack;
        Object.keys(pack).forEach((key) => {
            delete pack[key];
        });
        Object.assign(pack, nextPack);
        mountState.pack = pack;
        render();
    };
    result.recompute = recompute;

    const handleClick = async (event) => {
        const action = event.target?.getAttribute?.('data-action');
        if (!action) {
            return;
        }

        if (action === 'copy-integration-brief') {
            await copyToClipboardSafe(pack.briefMarkdown || '');
            return;
        }

        if (action === 'download-integration-pack') {
            downloadJsonSnapshot('turnero-release-integration-pack.json', pack);
            return;
        }

        if (action === 'add-replay-item') {
            const label = toText(nodes.replayLabel?.value, '');
            const owner = toText(nodes.replayOwner?.value, '');
            const contractId = toText(nodes.replayContract?.value, '');
            if (!label) {
                return;
            }

            mountState.replayQueueStore.add({
                label,
                owner,
                contractId,
                state: 'queued',
                priority: 'medium',
            });
            recompute();
            return;
        }

        if (action === 'add-mapping-debt') {
            const label = toText(nodes.mappingLabel?.value, '');
            const owner = toText(nodes.mappingOwner?.value, '');
            const impactedFlow = toText(nodes.mappingFlow?.value, '');
            if (!label) {
                return;
            }

            mountState.mappingDebtStore.add({
                label,
                owner,
                impactedFlow,
                severity: 'medium',
                state: 'open',
            });
            recompute();
        }
    };

    if (host.__turneroIntegrationCommandCenterClickHandler) {
        host.removeEventListener(
            'click',
            host.__turneroIntegrationCommandCenterClickHandler
        );
    }

    host.__turneroIntegrationCommandCenterClickHandler = handleClick;
    host.addEventListener('click', handleClick);

    render();

    return result;
}

export {
    buildTurneroReleaseIntegrationContractRegistry,
    buildTurneroReleaseDataExchangeMap,
    buildTurneroReleaseSyncSlaMonitor,
    createTurneroReleaseReplayRecoveryQueue,
    createTurneroReleaseMappingDebtLedger,
    buildTurneroReleaseBridgeObservabilityPack,
    buildTurneroReleaseIntegrationConfidenceScore,
    integrationBriefToMarkdown,
    buildIntegrationCommandCenterPack,
};

export default mountTurneroReleaseIntegrationCommandCenter;
