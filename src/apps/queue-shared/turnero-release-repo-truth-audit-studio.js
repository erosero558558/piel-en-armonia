import {
    copyToClipboardSafe,
    downloadJsonSnapshot,
} from './turnero-release-control-center.js';
import { escapeHtml } from '../admin-v3/shared/ui/render.js';
import { buildTurneroReleaseExpectedModuleCatalog } from './turnero-release-expected-module-catalog.js';
import { buildTurneroReleaseActualRepoIntake } from './turnero-release-actual-repo-intake.js';
import { createTurneroReleaseProvenanceLedger } from './turnero-release-provenance-ledger.js';
import { buildTurneroReleaseRepoTruthComparator } from './turnero-release-repo-truth-comparator.js';
import { buildTurneroReleaseWiringTruthMatrix } from './turnero-release-wiring-truth-matrix.js';
import { buildTurneroReleaseDriftWatchlist } from './turnero-release-drift-watchlist.js';
import { buildTurneroReleaseRepoTruthScore } from './turnero-release-repo-truth-score.js';

const DEFAULT_DOWNLOAD_FILE_NAME = 'turnero-release-repo-truth-pack.json';
const DEFAULT_SURFACES = Object.freeze([
    {
        id: 'admin-queue',
        label: 'Admin Queue',
    },
    {
        id: 'operator-turnos',
        label: 'Operator Turnos',
    },
    {
        id: 'kiosco-turnos',
        label: 'Kiosco Turnos',
    },
    {
        id: 'sala-turnos',
        label: 'Sala Turnos',
    },
]);
const DEFAULT_ACTUAL_MODULES = Object.freeze([
    {
        key: 'release-control',
        label: 'Release Control',
        domain: 'governance',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'assurance',
        label: 'Assurance',
        domain: 'assurance',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'reliability',
        label: 'Reliability',
        domain: 'reliability',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'service-excellence',
        label: 'Service Excellence',
        domain: 'service',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'safety-privacy',
        label: 'Safety Privacy',
        domain: 'privacy',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'integration',
        label: 'Integration',
        domain: 'integration',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'telemetry',
        label: 'Telemetry',
        domain: 'telemetry',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'strategy',
        label: 'Strategy',
        domain: 'strategy',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'orchestration',
        label: 'Orchestration',
        domain: 'orchestration',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'diagnostic',
        label: 'Diagnostic Prep',
        domain: 'diagnostic',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
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

function normalizeScope(value) {
    return String(value || '').trim() || 'global';
}

function resolveSurfaceRows(value) {
    if (Array.isArray(value) && value.length > 0) {
        return value.map((surface, index) => ({
            id: String(surface.id || surface.key || `surface-${index + 1}`),
            label: String(surface.label || `Surface ${index + 1}`),
        }));
    }

    return DEFAULT_SURFACES.map((surface) => ({ ...surface }));
}

function resolveActualModules(value) {
    if (Array.isArray(value) && value.length > 0) {
        return value;
    }

    return DEFAULT_ACTUAL_MODULES.map((module) => ({ ...module }));
}

function buildRepoTruthPack(input = {}) {
    const scope = normalizeScope(input.scope || input.region || 'global');
    const region = normalizeScope(input.region || input.scope || 'global');
    const expected = buildTurneroReleaseExpectedModuleCatalog(input);
    const actual = buildTurneroReleaseActualRepoIntake({
        actualModules: resolveActualModules(input.actualModules),
    });
    const provenanceStore = createTurneroReleaseProvenanceLedger(scope);
    const provenance = provenanceStore.list();
    const compare = buildTurneroReleaseRepoTruthComparator({
        expectedRows: expected.rows,
        actualRows: actual.rows,
    });
    const truthMatrix = buildTurneroReleaseWiringTruthMatrix({
        surfaces: resolveSurfaceRows(input.surfaces),
        compareRows: compare.rows,
    });
    const drift = buildTurneroReleaseDriftWatchlist({
        compareRows: compare.rows,
        provenance,
    });
    const truthScore = buildTurneroReleaseRepoTruthScore({
        compareSummary: compare.summary,
        truthRows: truthMatrix.rows,
        driftSummary: drift.summary,
        provenance,
    });

    return {
        scope,
        region,
        expected,
        actual,
        provenance,
        compare,
        truthMatrix,
        drift,
        truthScore,
        provenanceStore,
    };
}

function repoTruthBriefToMarkdown(pack = {}) {
    const lines = [
        '# Repo Truth Audit Studio',
        '',
        `Truth score: ${pack.truthScore?.score ?? 0} (${
            pack.truthScore?.band || 'n/a'
        })`,
        `Decision: ${pack.truthScore?.decision || 'review'}`,
        `Expected modules: ${pack.expected?.summary?.all ?? 0}`,
        `Present modules: ${pack.compare?.summary?.present ?? 0}`,
        `Missing modules: ${pack.compare?.summary?.missing ?? 0}`,
        `Drift watchlist: ${pack.drift?.summary?.all ?? 0}`,
        `Provenance entries: ${(pack.provenance || []).length}`,
    ];
    return lines.join('\n');
}

function renderMetric(label, value, detail, tone = 'ready', role = '') {
    return `
        <article class="queue-app-card__metric" data-state="${escapeHtml(tone)}">
            <p class="queue-app-card__eyebrow">${escapeHtml(label)}</p>
            <strong${role ? ` data-role="${escapeHtml(role)}"` : ''}>${escapeHtml(
                value
            )}</strong>
            <small>${escapeHtml(detail || '\u00a0')}</small>
        </article>
    `;
}

function renderRepoTruthAuditStudioHtml(pack) {
    return `
        <article class="turnero-release-repo-truth-audit-studio__card" data-state="${escapeHtml(
            pack.truthScore.band
        )}">
            <header class="turnero-release-repo-truth-audit-studio__header">
                <div>
                    <p class="queue-app-card__eyebrow">Repo truth</p>
                    <h3>Repo Truth Audit Studio</h3>
                    <p>
                        Contraste entre catálogo esperado, integración real,
                        provenance y drift antes del diagnóstico final.
                    </p>
                </div>
                <div class="turnero-release-repo-truth-audit-studio__actions">
                    <button type="button" data-action="copy-repo-truth-brief">
                        Copy repo truth brief
                    </button>
                    <button type="button" data-action="download-repo-truth-pack">
                        Download repo truth JSON
                    </button>
                </div>
            </header>
            <div class="turnero-release-repo-truth-audit-studio__metrics">
                ${renderMetric(
                    'Truth score',
                    String(pack.truthScore.score),
                    pack.truthScore.band,
                    pack.truthScore.band,
                    'score'
                )}
                ${renderMetric(
                    'Decision',
                    pack.truthScore.decision,
                    'Repo truth gate',
                    pack.truthScore.band,
                    'decision'
                )}
                ${renderMetric(
                    'Expected',
                    String(pack.expected.summary.all),
                    `${pack.expected.summary.high} high-priority`,
                    'ready',
                    'expected-count'
                )}
                ${renderMetric(
                    'Present',
                    String(pack.compare.summary.present),
                    `${pack.compare.summary.partial} partial · ${pack.compare.summary.missing} missing`,
                    pack.compare.summary.missing > 0 ? 'warning' : 'ready',
                    'present-count'
                )}
                ${renderMetric(
                    'Drift',
                    String(pack.drift.summary.all),
                    `${pack.drift.summary.high} high`,
                    pack.drift.summary.all > 0 ? 'warning' : 'ready',
                    'drift-count'
                )}
                ${renderMetric(
                    'Provenance',
                    String(pack.provenance.length),
                    'ledger entries',
                    pack.provenance.length > 0 ? 'ready' : 'warning',
                    'provenance-count'
                )}
            </div>
            <div class="turnero-release-repo-truth-audit-studio__body">
                <section class="turnero-release-repo-truth-audit-studio__panel">
                    <header class="turnero-release-repo-truth-audit-studio__panel-header">
                        <p class="queue-app-card__eyebrow">Provenance</p>
                        <strong>${escapeHtml(String(pack.provenance.length))}</strong>
                    </header>
                    <div class="turnero-release-repo-truth-audit-studio__panel-grid">
                        <input data-field="prov-module" placeholder="Module key" />
                        <input data-field="prov-commit" placeholder="Commit ref" />
                        <input data-field="prov-owner" placeholder="Owner" />
                        <button type="button" data-action="add-provenance-entry">
                            Add provenance
                        </button>
                    </div>
                </section>
                <section class="turnero-release-repo-truth-audit-studio__panel">
                    <header class="turnero-release-repo-truth-audit-studio__panel-header">
                        <p class="queue-app-card__eyebrow">Wiring truth</p>
                        <strong>${escapeHtml(String(pack.truthMatrix.rows.length))}</strong>
                    </header>
                    <ul class="turnero-release-repo-truth-audit-studio__list">
                        ${pack.truthMatrix.rows
                            .slice(0, 4)
                            .map(
                                (row) => `
                        <li data-state="${escapeHtml(row.state)}">
                            <strong>${escapeHtml(row.label)}</strong>
                            <span>${escapeHtml(
                                `${row.present}/${row.expected} · ${row.truthPct}%`
                            )}</span>
                        </li>`
                            )
                            .join('')}
                    </ul>
                </section>
                <section class="turnero-release-repo-truth-audit-studio__panel">
                    <header class="turnero-release-repo-truth-audit-studio__panel-header">
                        <p class="queue-app-card__eyebrow">Drift watchlist</p>
                        <strong>${escapeHtml(String(pack.drift.summary.all))}</strong>
                    </header>
                    <ul class="turnero-release-repo-truth-audit-studio__list">
                        ${pack.drift.rows
                            .slice(0, 4)
                            .map(
                                (row) => `
                        <li data-state="${escapeHtml(row.severity)}">
                            <strong>${escapeHtml(row.label)}</strong>
                            <span>${escapeHtml(`${row.driftKind} · ${row.owner}`)}</span>
                        </li>`
                            )
                            .join('')}
                    </ul>
                </section>
            </div>
            <pre class="turnero-release-repo-truth-audit-studio__brief" data-role="truth-brief">${escapeHtml(
                repoTruthBriefToMarkdown(pack)
            )}</pre>
        </article>
    `;
}

export function mountTurneroReleaseRepoTruthAuditStudio(target, input = {}) {
    const host = resolveTarget(target);
    if (!isDomElement(host)) {
        return null;
    }

    let pack = buildRepoTruthPack(input);
    const root = document.createElement('section');
    root.id = 'turneroReleaseRepoTruthAuditStudio';
    root.className = 'turnero-release-repo-truth-audit-studio';
    root.dataset.turneroReleaseRepoTruthAuditStudio = 'mounted';
    root.dataset.turneroReleaseRepoTruthScore = String(pack.truthScore.score);
    root.dataset.turneroReleaseRepoTruthBand = pack.truthScore.band;
    root.dataset.turneroReleaseRepoTruthDecision = pack.truthScore.decision;
    root.dataset.turneroReleaseRepoTruthScope = pack.scope;
    root.innerHTML = renderRepoTruthAuditStudioHtml(pack);

    const result = {
        root,
        pack,
        recompute: () => {},
    };

    const scoreNode = root.querySelector('[data-role="score"]');
    const decisionNode = root.querySelector('[data-role="decision"]');
    const briefNode = root.querySelector('[data-role="truth-brief"]');

    if (scoreNode) {
        scoreNode.textContent = String(pack.truthScore.score);
    }
    if (decisionNode) {
        decisionNode.textContent = pack.truthScore.decision;
    }
    if (briefNode) {
        briefNode.textContent = repoTruthBriefToMarkdown(pack);
    }

    const recompute = () => {
        pack = buildRepoTruthPack(input);
        result.pack = pack;
        root.dataset.turneroReleaseRepoTruthScore = String(
            pack.truthScore.score
        );
        root.dataset.turneroReleaseRepoTruthBand = pack.truthScore.band;
        root.dataset.turneroReleaseRepoTruthDecision = pack.truthScore.decision;
        root.dataset.turneroReleaseRepoTruthScope = pack.scope;

        if (scoreNode) {
            scoreNode.textContent = String(pack.truthScore.score);
        }
        if (decisionNode) {
            decisionNode.textContent = pack.truthScore.decision;
        }
        if (briefNode) {
            briefNode.textContent = repoTruthBriefToMarkdown(pack);
        }
    };

    result.recompute = recompute;

    root.addEventListener('click', async (event) => {
        const action = event.target?.getAttribute?.('data-action');
        if (!action) {
            return;
        }

        if (action === 'copy-repo-truth-brief') {
            await copyToClipboardSafe(repoTruthBriefToMarkdown(pack));
            return;
        }

        if (action === 'download-repo-truth-pack') {
            downloadJsonSnapshot(DEFAULT_DOWNLOAD_FILE_NAME, pack);
            return;
        }

        if (action === 'add-provenance-entry') {
            const moduleKey =
                root.querySelector('[data-field="prov-module"]')?.value || '';
            const commitRef =
                root.querySelector('[data-field="prov-commit"]')?.value || '';
            const owner =
                root.querySelector('[data-field="prov-owner"]')?.value || '';

            if (!moduleKey.trim()) {
                return;
            }

            pack.provenanceStore.add({
                moduleKey,
                commitRef,
                owner,
            });
            recompute();
        }
    });

    if (typeof host.replaceChildren === 'function') {
        host.replaceChildren(root);
    } else {
        host.innerHTML = '';
        host.appendChild(root);
    }

    return result;
}

export {
    buildTurneroReleaseExpectedModuleCatalog,
    buildTurneroReleaseActualRepoIntake,
    createTurneroReleaseProvenanceLedger,
    buildTurneroReleaseRepoTruthComparator,
    buildTurneroReleaseWiringTruthMatrix,
    buildTurneroReleaseDriftWatchlist,
    buildTurneroReleaseRepoTruthScore,
    repoTruthBriefToMarkdown,
    buildRepoTruthPack,
};
export default mountTurneroReleaseRepoTruthAuditStudio;
