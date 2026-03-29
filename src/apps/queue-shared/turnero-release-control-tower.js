import {
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { buildMultiClinicRollout } from './turnero-release-multi-clinic-rollout.js';

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function resolveTarget(target) {
    if (typeof target === 'string') {
        if (typeof document === 'undefined') {
            return null;
        }

        return (
            document.querySelector(target) || document.getElementById(target)
        );
    }

    return isDomElement(target) ? target : null;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function canUseClipboard() {
    return Boolean(
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
    );
}

async function copyText(text) {
    return copyToClipboardSafe(text);
}

function downloadJson(filename, payload) {
    return downloadJsonSnapshot(filename, payload);
}

function toneForDecision(decision) {
    if (decision === 'promote') {
        return 'ready';
    }

    if (decision === 'review') {
        return 'warning';
    }

    return 'alert';
}

function toneForCoverage(status) {
    if (status === 'green') {
        return 'ready';
    }

    if (status === 'yellow') {
        return 'warning';
    }

    return 'alert';
}

function toneForScenario(recommendation) {
    if (recommendation === 'safe-expand') {
        return 'ready';
    }

    if (recommendation === 'review-expand') {
        return 'warning';
    }

    return 'alert';
}

function renderChip(label, value, state = 'info') {
    return `<span class="queue-ops-pilot__chip" data-state="${escapeHtml(
        state
    )}">${escapeHtml(label)} ${escapeHtml(value)}</span>`;
}

function resolveControlTowerIdPrefix(options = {}) {
    const prefix = toText(options.idPrefix || '');
    return prefix || 'queueReleaseMultiClinicControlTower';
}

function renderListItem(title, detail, meta, state = 'info') {
    return `<article class="queue-ops-pilot__issues-item" role="listitem" data-state="${escapeHtml(
        state
    )}"><div class="queue-ops-pilot__issues-item-head"><strong>${escapeHtml(
        title
    )}</strong><span class="queue-ops-pilot__issues-item-badge">${escapeHtml(
        meta
    )}</span></div><p>${escapeHtml(detail)}</p></article>`;
}

function renderSection(title, eyebrow, body) {
    return `
        <section class="queue-ops-pilot__issues">
            <div class="queue-ops-pilot__issues-head">
                <div><p class="queue-app-card__eyebrow">${escapeHtml(
                    eyebrow
                )}</p><h6>${escapeHtml(title)}</h6></div>
            </div>
            ${body}
        </section>
    `.trim();
}

function renderCohorts(model) {
    const cohorts = toArray(model.cohortPlanner?.cohorts);
    if (!cohorts.length) {
        return renderSection(
            'Cohorts',
            'Cohort planner',
            '<p class="queue-ops-pilot__issues-summary">Sin cohortes disponibles.</p>'
        );
    }

    return renderSection(
        'Cohorts',
        'Cohort planner',
        `
            <p class="queue-ops-pilot__issues-summary">${escapeHtml(
                model.cohortPlanner?.summary || ''
            )}</p>
            <div class="queue-ops-pilot__issues-items" role="list">
                ${cohorts
                    .map((cohort) =>
                        renderListItem(
                            cohort.label,
                            `${cohort.summary} · traffic ${cohort.targetTrafficPercent}% · avg score ${cohort.averageScore}`,
                            `${cohort.count} clínica(s)`,
                            cohort.tone
                        )
                    )
                    .join('')}
            </div>
        `
    );
}

function renderScoreboard(model) {
    const regions = toArray(model.scoreboard?.regions);
    if (!regions.length) {
        return renderSection(
            'Scoreboard',
            'Regional scoreboard',
            '<p class="queue-ops-pilot__issues-summary">Sin scoreboard regional.</p>'
        );
    }

    return renderSection(
        'Scoreboard',
        'Regional scoreboard',
        `
            <p class="queue-ops-pilot__issues-summary">${escapeHtml(
                model.scoreboard?.summary || ''
            )}</p>
            <div class="queue-ops-pilot__issues-items" role="list">
                ${regions
                    .map((region) =>
                        renderListItem(
                            region.region,
                            `avg score ${region.averageScore} · avg risk ${region.averageRisk} · ready ${region.readyCount} · review ${region.reviewCount} · hold ${region.holdCount}`,
                            `${region.clinicCount} clínica(s)`,
                            region.tone
                        )
                    )
                    .join('')}
            </div>
        `
    );
}

function renderHotspots(model) {
    const hotspots = toArray(model.heatmap?.hotspots);
    if (!hotspots.length) {
        return renderSection(
            'Hotspots',
            'Portfolio heatmap',
            '<p class="queue-ops-pilot__issues-summary">Sin hotspots destacados.</p>'
        );
    }

    return renderSection(
        'Hotspots',
        'Portfolio heatmap',
        `
            <p class="queue-ops-pilot__issues-summary">${escapeHtml(
                model.heatmap?.summary || ''
            )}</p>
            <div class="queue-ops-pilot__issues-items" role="list">
                ${hotspots
                    .map((hotspot) =>
                        renderListItem(
                            hotspot.clinicLabel,
                            `${hotspot.region} · ${hotspot.reason} · risk ${hotspot.riskScore} · decision ${hotspot.decision}`,
                            hotspot.ownerTeam,
                            hotspot.tone
                        )
                    )
                    .join('')}
            </div>
        `
    );
}

function renderSimulator(model) {
    const scenarios = toArray(model.simulator?.scenarios);
    if (!scenarios.length) {
        return renderSection(
            'Simulator',
            'Expansion simulator',
            '<p class="queue-ops-pilot__issues-summary">Sin escenarios de simulación.</p>'
        );
    }

    return renderSection(
        'Simulator',
        'Expansion simulator',
        `
            <p class="queue-ops-pilot__issues-summary">${escapeHtml(
                model.simulator?.summary || ''
            )}</p>
            <div class="queue-ops-pilot__issues-items" role="list">
                ${scenarios
                    .map((scenario) =>
                        renderListItem(
                            scenario.name,
                            `cohort ${scenario.targetCohort} · gain ${scenario.expectedGain} · risk ${scenario.riskDelta} · rollback ${scenario.rollbackExposure} · coverage ${scenario.coverageNeed}`,
                            `${scenario.trafficPercent}%`,
                            toneForScenario(scenario.recommendation)
                        )
                    )
                    .join('')}
            </div>
        `
    );
}

function renderCoverage(model) {
    const coverage = toArray(model.coverage?.coverage);
    if (!coverage.length) {
        return renderSection(
            'Coverage',
            'Regional coverage',
            '<p class="queue-ops-pilot__issues-summary">Sin cobertura regional.</p>'
        );
    }

    return renderSection(
        'Coverage',
        'Regional coverage',
        `
            <p class="queue-ops-pilot__issues-summary">${escapeHtml(
                model.coverage?.summary || ''
            )}</p>
            <div class="queue-ops-pilot__issues-items" role="list">
                ${coverage
                    .map((entry) =>
                        renderListItem(
                            entry.region,
                            `${entry.notes} · clinics ${entry.clinicCount} · avg risk ${entry.averageRisk} · avg score ${entry.averageScore}`,
                            `${entry.status}`,
                            toneForCoverage(model.coverage?.overallStatus)
                        )
                    )
                    .join('')}
            </div>
        `
    );
}

function renderDecision(model) {
    const decision = model.portfolioDecision || {};
    const registry = model.registry || {};
    const planner = model.cohortPlanner || {};

    return `
        <div class="queue-ops-pilot__chips" aria-label="Multi-clinic metrics">
            ${renderChip('Decision', decision.decision || 'hold', toneForDecision(decision.decision))}
            ${renderChip('Cohort', model.recommendedNextCohort || 'holdouts', 'info')}
            ${renderChip('Registry', `${toArray(registry.clinics).length} clinics`, 'info')}
            ${renderChip('Coverage', model.coverage?.overallStatus || 'unknown', toneForCoverage(model.coverage?.overallStatus))}
            ${renderChip('Risk', model.scoreboard?.highestRisk?.clinicLabel || 'n/a', 'warning')}
            ${renderChip('Planner', planner.counts?.total || 0, 'info')}
        </div>
        <p class="queue-ops-pilot__issues-summary">${escapeHtml(
            model.summary || ''
        )}</p>
        <p class="queue-ops-pilot__issues-support">${escapeHtml(
            decision.reason || ''
        )}</p>
    `;
}

function renderCompactDecision(model, options = {}) {
    const decision = model.portfolioDecision || {};
    const highestRiskLabel =
        model.scoreboard?.highestRisk?.clinicLabel || 'n/a';

    return `
        <div class="queue-ops-pilot__chips" aria-label="Resumen multi-clinica">
            ${renderChip(
                'Decision',
                decision.decision || 'hold',
                toneForDecision(decision.decision)
            )}
            ${renderChip(
                'Cohort',
                model.recommendedNextCohort || 'holdouts',
                'info'
            )}
            ${renderChip(
                'Coverage',
                model.coverage?.overallStatus || 'unknown',
                toneForCoverage(model.coverage?.overallStatus)
            )}
            ${renderChip('Riesgo', highestRiskLabel, 'warning')}
        </div>
        <p class="queue-ops-pilot__issues-summary">${escapeHtml(
            model.summary || ''
        )}</p>
        <p class="queue-ops-pilot__issues-support">${escapeHtml(
            decision.reason || ''
        )}</p>
        <div class="queue-ops-pilot__actions" aria-label="Acciones compactas del tower">
            <button id="${escapeHtml(
                `${resolveControlTowerIdPrefix(options)}CopyBriefBtn`
            )}" type="button" class="queue-ops-pilot__action queue-ops-pilot__action--primary" data-control-tower-action="copy-brief" data-state="${
                canUseClipboard() ? 'ready' : 'warning'
            }">Copiar brief</button>
            <button id="${escapeHtml(
                `${resolveControlTowerIdPrefix(options)}DownloadJsonBtn`
            )}" type="button" class="queue-ops-pilot__action" data-control-tower-action="download-json">Descargar JSON</button>
        </div>
    `;
}

function renderActions(model) {
    const clipboardState = canUseClipboard() ? 'ready' : 'warning';

    return `
        <div class="queue-ops-pilot__actions" aria-label="Acciones del tower">
            <button id="queueReleaseMultiClinicControlTowerCopyBriefBtn" type="button" class="queue-ops-pilot__action queue-ops-pilot__action--primary" data-control-tower-action="copy-brief" data-state="${clipboardState}">Copiar brief ejecutivo</button>
            <button id="queueReleaseMultiClinicControlTowerCopyCohortPlanBtn" type="button" class="queue-ops-pilot__action" data-control-tower-action="copy-cohort-plan" data-state="${clipboardState}">Copiar cohortes</button>
            <button id="queueReleaseMultiClinicControlTowerCopyScoreboardBtn" type="button" class="queue-ops-pilot__action" data-control-tower-action="copy-scoreboard" data-state="${clipboardState}">Copiar scoreboard</button>
            <button id="queueReleaseMultiClinicControlTowerCopyHotspotsBtn" type="button" class="queue-ops-pilot__action" data-control-tower-action="copy-hotspots" data-state="${clipboardState}">Copiar hotspots</button>
            <button id="queueReleaseMultiClinicControlTowerCopySimulatorBtn" type="button" class="queue-ops-pilot__action" data-control-tower-action="copy-simulator" data-state="${clipboardState}">Copiar simulador</button>
            <button id="queueReleaseMultiClinicControlTowerCopyCoverageBtn" type="button" class="queue-ops-pilot__action" data-control-tower-action="copy-coverage" data-state="${clipboardState}">Copiar cobertura</button>
            <button id="queueReleaseMultiClinicControlTowerDownloadJsonBtn" type="button" class="queue-ops-pilot__action" data-control-tower-action="download-json">Descargar JSON</button>
        </div>
        <p class="queue-ops-pilot__issues-support">Archivo: ${escapeHtml(
            model.jsonPackFileName || 'turnero-multi-clinic-control-tower.json'
        )}</p>
    `;
}

function normalizeCompactClinics(model) {
    const registryClinics = toArray(model.registry?.clinics).filter(Boolean);
    const selectedClinicId = toText(
        model.registry?.selectedClinicId ||
            model.registry?.selectedClinic?.clinicId
    );
    const selectedClinic =
        registryClinics.find((clinic) => clinic.clinicId === selectedClinicId) ||
        model.registry?.selectedClinic ||
        registryClinics[0] ||
        null;
    const otherClinics = registryClinics.filter(
        (clinic) => clinic && clinic.clinicId !== selectedClinic?.clinicId
    );

    return {
        selectedClinic,
        clinics: selectedClinic
            ? [selectedClinic, ...otherClinics].slice(0, 3)
            : registryClinics.slice(0, 3),
    };
}

function renderCompactClinic(clinic, options = {}) {
    if (!clinic) {
        return '';
    }

    const { active = false } = options;
    const detail = `Estado ${clinic.decision || clinic.state || 'review'} · readiness ${toText(
        clinic.readinessScore,
        '0'
    )}/100 · risk ${toText(clinic.riskScore, '0')}/100`;

    return `
        <article class="queue-ops-pilot__issues-item" role="listitem" data-state="${escapeHtml(
            clinic.state || 'info'
        )}">
            <div class="queue-ops-pilot__issues-item-head">
                <strong>${escapeHtml(
                    clinic.clinicLabel ||
                        clinic.clinicName ||
                        clinic.clinicId ||
                        'Clínica'
                )}</strong>
                <span class="queue-ops-pilot__issues-item-badge">${escapeHtml(
                    active ? 'Clínica activa' : `Tier ${toText(clinic.priorityTier, '3')}`
                )}</span>
            </div>
            <p>${escapeHtml(
                `${clinic.clinicLabel || clinic.clinicName || clinic.clinicId} · ${clinic.clinicId || ''}`
            )}</p>
            <p>${escapeHtml(detail)}</p>
        </article>
    `.trim();
}

export function renderMultiClinicControlTowerCompactCard(
    input = {},
    options = {}
) {
    const model = input.model || buildMultiClinicRollout(input);
    const { selectedClinic, clinics } = normalizeCompactClinics(model);
    const ctaLabel = toText(options.openExpertLabel, 'Abrir vista expert');

    return `
        <section id="queueReleaseMultiClinicControlTowerBasic" class="queue-ops-pilot__card turnero-release-control-tower turnero-release-control-tower--compact" data-state="${escapeHtml(
            toneForDecision(model.portfolioDecision?.decision)
        )}">
            <div class="queue-ops-pilot__issues-head">
                <div>
                    <p class="queue-app-card__eyebrow">Multi-Clinic Control Tower</p>
                    <h6 id="queueReleaseMultiClinicControlTowerBasicTitle">Resumen multi-clínica</h6>
                </div>
                <span class="queue-ops-pilot__issues-status" data-state="${escapeHtml(
                    toneForDecision(model.portfolioDecision?.decision)
                )}">
                    ${escapeHtml(model.portfolioDecision?.decision || 'review')}
                </span>
            </div>
            <div class="queue-ops-pilot__chips" aria-label="Resumen multi-clínica en basic">
                ${renderChip(
                    'Activa',
                    selectedClinic?.clinicLabel || selectedClinic?.clinicId || 'n/a',
                    'info'
                )}
                ${renderChip(
                    'Cohorte',
                    model.recommendedNextCohort || 'holdouts',
                    'info'
                )}
                ${renderChip(
                    'Cobertura',
                    model.coverage?.overallStatus || 'unknown',
                    toneForCoverage(model.coverage?.overallStatus)
                )}
                ${renderChip(
                    'Clínicas',
                    `${toArray(model.registry?.clinics).length}`,
                    'info'
                )}
            </div>
            <p id="queueReleaseMultiClinicControlTowerBasicSummary" class="queue-ops-pilot__issues-summary">${escapeHtml(
                model.summary || ''
            )}</p>
            <div id="queueReleaseMultiClinicControlTowerBasicClinics" class="queue-ops-pilot__issues-items" role="list" aria-label="Resumen por clínica">
                ${clinics
                    .map((clinic) =>
                        renderCompactClinic(clinic, {
                            active:
                                clinic.clinicId &&
                                clinic.clinicId === selectedClinic?.clinicId,
                        })
                    )
                    .join('')}
            </div>
            <div class="queue-ops-pilot__actions" aria-label="Acciones del resumen multi-clínica">
                <button
                    id="queueReleaseMultiClinicControlTowerBasicOpenExpertBtn"
                    type="button"
                    class="queue-ops-pilot__action queue-ops-pilot__action--primary"
                    data-control-tower-basic-action="open-expert"
                >
                    ${escapeHtml(ctaLabel)}
                </button>
            </div>
            <p id="queueReleaseMultiClinicControlTowerBasicSupport" class="queue-ops-pilot__issues-support">${escapeHtml(
                selectedClinic
                    ? `La vista compacta mantiene visible ${selectedClinic.clinicLabel} y deja la consola completa para expert.`
                    : 'La vista compacta resume el rollout multi-clínica y deja la consola completa para expert.'
            )}</p>
        </section>
    `.trim();
}

function bindCompactActions(host, options = {}) {
    if (!isDomElement(host)) {
        return;
    }

    if (host.__turneroReleaseMultiClinicControlTowerCompactClickHandler) {
        host.removeEventListener(
            'click',
            host.__turneroReleaseMultiClinicControlTowerCompactClickHandler
        );
    }

    host.__turneroReleaseMultiClinicControlTowerCompactClickHandler = (
        event
    ) => {
        const button =
            typeof Element !== 'undefined' && event.target instanceof Element
                ? event.target.closest('button[data-control-tower-basic-action]')
                : null;

        if (
            typeof HTMLElement === 'undefined' ||
            !(button instanceof HTMLElement)
        ) {
            return;
        }

        const action = button.getAttribute('data-control-tower-basic-action');
        if (action !== 'open-expert') {
            return;
        }

        if (typeof options.onOpenExpert === 'function') {
            options.onOpenExpert();
        }
    };

    host.addEventListener(
        'click',
        host.__turneroReleaseMultiClinicControlTowerCompactClickHandler
    );
}

function bindButtons(host, model, actions) {
    if (!isDomElement(host)) {
        return;
    }

    if (host.__turneroReleaseMultiClinicControlTowerClickHandler) {
        host.removeEventListener(
            'click',
            host.__turneroReleaseMultiClinicControlTowerClickHandler
        );
    }

    host.__turneroReleaseMultiClinicControlTowerClickHandler = async (
        event
    ) => {
        const button =
            typeof Element !== 'undefined' && event.target instanceof Element
                ? event.target.closest('button[data-control-tower-action]')
                : null;

        if (
            typeof HTMLElement === 'undefined' ||
            !(button instanceof HTMLElement)
        ) {
            return;
        }

        const action = button.getAttribute('data-control-tower-action');
        if (!action || typeof actions[action] !== 'function') {
            return;
        }

        await actions[action]();
    };

    host.addEventListener(
        'click',
        host.__turneroReleaseMultiClinicControlTowerClickHandler
    );
}

export function createMultiClinicControlTowerActions(model = {}) {
    const pack = model.jsonPack || {};

    return {
        async ['copy-brief']() {
            await copyText(model.copyableExecutiveBrief || '');
        },
        async ['copy-cohort-plan']() {
            await copyText(model.copyableCohortPlan || '');
        },
        async ['copy-scoreboard']() {
            await copyText(model.copyableScoreboard || '');
        },
        async ['copy-hotspots']() {
            await copyText(model.copyableHotspots || '');
        },
        async ['copy-simulator']() {
            await copyText(model.copyableSimulator || '');
        },
        async ['copy-coverage']() {
            await copyText(model.copyableCoverage || '');
        },
        async ['download-json']() {
            downloadJson(
                model.jsonPackFileName ||
                    'turnero-multi-clinic-control-tower.json',
                pack
            );
        },
    };
}

export function renderMultiClinicControlTowerCard(input = {}, options = {}) {
    const model = input.model || buildMultiClinicRollout(input);
    const compact = options.variant === 'compact';
    const idPrefix = resolveControlTowerIdPrefix(options);

    return `
        <section id="${escapeHtml(
            idPrefix
        )}" class="queue-ops-pilot__card turnero-release-control-tower${
            compact ? ' turnero-release-control-tower--compact' : ''
        }" data-state="${escapeHtml(
            toneForDecision(model.portfolioDecision?.decision)
        )}">
            <div class="queue-ops-pilot__issues-head">
                <div>
                    <p class="queue-app-card__eyebrow">${
                        compact
                            ? 'Resumen multi-clinica'
                            : 'Multi-Clinic Control Tower'
                    }</p>
                    <h6>${
                        compact
                            ? 'Control tower compacto'
                            : 'Control tower multi-clinic'
                    }</h6>
                </div>
            </div>
            ${
                compact
                    ? renderCompactDecision(model, options)
                    : [
                          renderDecision(model),
                          renderActions(model, options),
                          renderCohorts(model),
                          renderScoreboard(model),
                          renderHotspots(model),
                          renderSimulator(model),
                          renderCoverage(model),
                      ].join('')
            }
        </section>
    `.trim();
}

export function mountMultiClinicControlTowerCard(
    target,
    input = {},
    options = {}
) {
    const host = resolveTarget(target);
    if (!host) {
        return null;
    }

    const model = input.model || buildMultiClinicRollout(input);
    const requestId =
        toText(
            options.requestId ||
                input.requestId ||
                `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        ) || `tower-${Date.now().toString(36)}`;

    host.dataset.turneroReleaseMultiClinicControlTowerRequestId = requestId;
    host.innerHTML = renderMultiClinicControlTowerCard(
        {
            ...input,
            model,
        },
        options
    );
    host.__turneroReleaseMultiClinicControlTowerModel = model;

    const section = host.querySelector(`#${resolveControlTowerIdPrefix(options)}`);
    if (section instanceof HTMLElement) {
        section.__turneroReleaseMultiClinicControlTowerModel = model;
        section.dataset.turneroReleaseMultiClinicControlTowerRequestId =
            requestId;
    }

    const actions = createMultiClinicControlTowerActions(model);
    bindButtons(host, model, actions);

    return host;
}

export function mountMultiClinicControlTowerCompactCard(
    target,
    input = {},
    options = {}
) {
    const host = resolveTarget(target);
    if (!host) {
        return null;
    }

    const model = input.model || buildMultiClinicRollout(input);
    const requestId =
        toText(
            options.requestId ||
                input.requestId ||
                `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        ) || `tower-compact-${Date.now().toString(36)}`;

    host.dataset.turneroReleaseMultiClinicControlTowerCompactRequestId =
        requestId;
    host.innerHTML = renderMultiClinicControlTowerCompactCard(
        {
            ...input,
            model,
        },
        options
    );
    host.__turneroReleaseMultiClinicControlTowerCompactModel = model;

    const section = host.querySelector(
        '#queueReleaseMultiClinicControlTowerBasic'
    );
    if (section instanceof HTMLElement) {
        section.__turneroReleaseMultiClinicControlTowerCompactModel = model;
        section.dataset.turneroReleaseMultiClinicControlTowerCompactRequestId =
            requestId;
    }

    bindCompactActions(host, options);

    return host;
}

export { canUseClipboard, copyText, downloadJson };

export const buildMultiClinicControlTower = buildMultiClinicRollout;

export { buildMultiClinicRollout };

export default buildMultiClinicRollout;
