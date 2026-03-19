import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { escapeHtml, formatDateTime } from '../admin-v3/shared/ui/render.js';
import {
    readProgramOfficeState,
    resetProgramOfficeState,
    writeProgramOfficeState,
} from './turnero-release-program-office-store.js';
import { buildScenarioPresets } from './turnero-release-scenario-presets.js';
import { buildCapacityPressure } from './turnero-release-capacity-pressure.js';
import { buildWaveCalendar } from './turnero-release-wave-calendar.js';
import { buildOutageDrillMatrix } from './turnero-release-outage-drill-matrix.js';
import { buildPortfolioForecast } from './turnero-release-portfolio-forecast.js';
import { buildExecutivePack } from './turnero-release-executive-pack.js';

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function getClinicProfile(context = {}) {
    return asObject(
        context.turneroClinicProfile ||
            context.clinicProfile ||
            context.profile ||
            context.rollout?.clinicProfile ||
            {}
    );
}

function getRollout(context = {}) {
    const candidates = [
        context.rollout,
        context.multiClinicControlTower?.rollout,
        context.multiClinicRollout,
        context.turneroMultiClinicRollout,
        context.turneroRegionalRollout,
        context.turneroReleaseRollout,
    ];

    for (const candidate of candidates) {
        if (
            candidate &&
            typeof candidate === 'object' &&
            !Array.isArray(candidate)
        ) {
            return candidate;
        }
    }

    return null;
}

function resolveScope(context = {}, fallbackClinicId = 'default-clinic') {
    const profile = getClinicProfile(context);
    return toText(
        context.scope ||
            context.clinicId ||
            profile.clinic_id ||
            profile.clinicId ||
            fallbackClinicId,
        fallbackClinicId
    );
}

function buildFallbackClinic(context = {}, scope = 'default-clinic') {
    const profile = getClinicProfile(context);
    const clinicId = toText(
        context.clinicId ||
            scope ||
            profile.clinic_id ||
            profile.clinicId ||
            'default-clinic',
        'default-clinic'
    );
    const clinicLabel = toText(
        profile.branding?.short_name ||
            profile.branding?.name ||
            profile.clinicName ||
            profile.clinic_name ||
            clinicId,
        clinicId
    );
    const region = toText(
        profile.region ||
            profile.address?.region ||
            profile.location?.region ||
            profile.geo?.region ||
            context.region ||
            'regional',
        'regional'
    );
    const ownerTeam = toText(
        profile.release?.ownerTeam ||
            profile.release?.owner_team ||
            profile.release?.programOfficeOwner ||
            profile.release?.owner ||
            context.ownerTeam ||
            'regional-ops',
        'regional-ops'
    );
    const cohort = toText(
        profile.release?.cohort ||
            profile.release?.target_cohort ||
            profile.release?.targetCohort ||
            context.cohort ||
            'pilot',
        'pilot'
    );
    const decision = toText(profile.release?.decision || 'ready', 'ready');
    const score = Number.isFinite(Number(profile.release?.score))
        ? Number(profile.release.score)
        : 72;
    const blockingCount = decision === 'hold' ? 1 : 0;

    return {
        clinicId,
        clinicLabel,
        region,
        ownerTeam,
        cohort,
        decision,
        score,
        blockingCount,
        incidentLoad: blockingCount,
    };
}

function resolveClinicList(context = {}, fallbackClinic) {
    const rollout = getRollout(context);
    const clinics = Array.isArray(rollout?.registry?.clinics)
        ? rollout.registry.clinics.filter(Boolean)
        : Array.isArray(rollout?.clinics)
          ? rollout.clinics.filter(Boolean)
          : Array.isArray(context.clinics)
            ? context.clinics.filter(Boolean)
            : [];
    return clinics.length ? clinics : [fallbackClinic];
}

function resolvePlanList(context = {}, clinics = []) {
    const rollout = getRollout(context);
    const plans = Array.isArray(rollout?.cohortPlanner?.plans)
        ? rollout.cohortPlanner.plans.filter(Boolean)
        : Array.isArray(rollout?.plans)
          ? rollout.plans.filter(Boolean)
          : Array.isArray(context.plans)
            ? context.plans.filter(Boolean)
            : [];

    if (plans.length) {
        return plans;
    }

    return clinics.map((clinic, index) => ({
        ...clinic,
        planId: `${clinic.clinicId || 'clinic'}-plan-${index + 1}`,
        targetTrafficPercent: Number.isFinite(
            Number(context.store?.trafficLimitPercent)
        )
            ? Number(context.store.trafficLimitPercent)
            : 15,
    }));
}

function buildSnapshotFileName(scope, clinicLabel, generatedAt) {
    const datePart = toText(generatedAt, new Date().toISOString())
        .slice(0, 10)
        .replaceAll('-', '');
    const scopePart =
        toText(scope, clinicLabel || 'default-clinic')
            .toLowerCase()
            .replace(/[^a-z0-9]+/gi, '-')
            .replace(/^-+|-+$/g, '') || 'default-clinic';
    return `turnero-regional-program-office-${scopePart}-${datePart}.json`;
}

function buildSummary(model) {
    return [
        `Regional Program Office · ${model.clinicLabel}`,
        `Scope: ${model.scope}`,
        `Mode: ${model.portfolioMode}`,
        `Preset activo: ${model.activePreset?.label || model.activePresetId}`,
        `Decision: ${model.forecast.recommendedDecision}`,
        `Top owner risk: ${model.capacity.topOwnerRisk?.owner || 'N/A'}`,
        `Top region risk: ${model.capacity.topRegionRisk?.region || 'N/A'}`,
    ].join('\n');
}

function isProgramOfficeModel(value) {
    return Boolean(
        value &&
        typeof value === 'object' &&
        value.presets &&
        value.capacity &&
        value.forecast &&
        value.waveCalendar &&
        value.drills &&
        value.executivePack &&
        value.exportPayload
    );
}

export function buildRegionalProgramOffice(context = {}) {
    const clinicProfile = getClinicProfile(context);
    const resolvedRollout = getRollout(context);
    const scope = resolveScope(context);
    const fallbackClinic = buildFallbackClinic(context, scope);
    const clinics = resolveClinicList(context, fallbackClinic);
    const plans = resolvePlanList(context, clinics);
    const state = readProgramOfficeState(scope);
    const normalizedContext = {
        ...context,
        scope,
        clinicId: fallbackClinic.clinicId,
        clinicLabel: fallbackClinic.clinicLabel,
        clinicProfile,
        turneroClinicProfile: clinicProfile,
        rollout: resolvedRollout,
        clinics,
        plans,
        store: state,
    };
    const presets = buildScenarioPresets(normalizedContext);
    const storedPresetId = toText(state.presetId, '');
    const activePreset =
        presets.presets.find((preset) => preset.id === storedPresetId) ||
        presets.presets.find(
            (preset) => preset.id === presets.recommendedPresetId
        ) ||
        presets.presets[0] ||
        null;
    const activePresetId = activePreset?.id || presets.recommendedPresetId;
    const capacity = buildCapacityPressure(normalizedContext);
    const forecast = buildPortfolioForecast({
        ...normalizedContext,
        store: state,
        presets,
        activePresetId,
        capacity,
    });
    const waveCalendar = buildWaveCalendar({
        ...normalizedContext,
        store: state,
        presets,
        activePresetId,
        capacity,
        forecast,
    });
    const drills = buildOutageDrillMatrix({
        ...normalizedContext,
        store: state,
        presets,
        activePresetId,
        capacity,
        forecast,
        waveCalendar,
    });
    const executivePack = buildExecutivePack({
        ...normalizedContext,
        store: state,
        presets,
        activePresetId,
        capacity,
        forecast,
        waveCalendar,
        drills,
    });
    const rolloutClinicCount = Array.isArray(resolvedRollout?.registry?.clinics)
        ? resolvedRollout.registry.clinics.filter(Boolean).length
        : Array.isArray(resolvedRollout?.clinics)
          ? resolvedRollout.clinics.filter(Boolean).length
          : clinics.length;
    const portfolioMode =
        rolloutClinicCount > 1 ? 'regional-rollout' : 'single-clinic-fallback';
    const generatedAt = executivePack.jsonPack.generatedAt;
    const summary = buildSummary({
        scope,
        clinicLabel: fallbackClinic.clinicLabel,
        portfolioMode,
        activePreset,
        activePresetId,
        forecast,
        capacity,
        state,
        generatedAt,
    });
    const briefs = {
        executive: executivePack.executiveBrief,
        operator: executivePack.operatorBrief,
        regionalAgenda: executivePack.regionalAgenda,
        drillPlan: executivePack.drillPlan,
    };
    const exportPayload = {
        ...executivePack.jsonPack,
        scope,
        title: 'Regional Program Office',
        clinicId: fallbackClinic.clinicId,
        clinicLabel: fallbackClinic.clinicLabel,
        clinicProfile,
        portfolioMode,
        summary,
        briefs,
        state,
        activePresetId,
        activePreset,
        source: {
            rolloutAvailable: Boolean(resolvedRollout),
            clinicsCount: clinics.length,
            plansCount: plans.length,
        },
    };

    return {
        id: 'turneroRegionalProgramOffice',
        hostId: 'queueRegionalProgramOfficeHost',
        panelId: 'queueRegionalProgramOfficePanel',
        title: 'Regional Program Office',
        scope,
        clinicId: fallbackClinic.clinicId,
        clinicLabel: fallbackClinic.clinicLabel,
        clinicProfile,
        rollout: Boolean(resolvedRollout),
        portfolioMode,
        state,
        presets,
        activePresetId,
        activePreset,
        capacity,
        forecast,
        waveCalendar,
        drills,
        executivePack: {
            ...executivePack,
            activePreset,
        },
        briefs,
        summary,
        tone:
            forecast.recommendedDecision === 'hold'
                ? 'alert'
                : forecast.recommendedDecision === 'review'
                  ? 'warning'
                  : 'ready',
        generatedAt,
        snapshotFileName: buildSnapshotFileName(
            scope,
            fallbackClinic.clinicLabel,
            generatedAt
        ),
        exportPayload,
    };
}

export function createRegionalProgramOfficeActions(context = {}) {
    const scope = resolveScope(context);
    const buildModel = () => buildRegionalProgramOffice(context);

    return {
        setPreset(presetId) {
            const model = buildModel();
            const desiredPresetId = toText(presetId, '');
            const validPresetIds = new Set(
                toArray(model.presets.presets).map((preset) => preset.id)
            );
            return writeProgramOfficeState(scope, {
                presetId: validPresetIds.has(desiredPresetId)
                    ? desiredPresetId
                    : model.presets.recommendedPresetId,
            });
        },
        setNotes(notes) {
            return writeProgramOfficeState(scope, {
                notes: typeof notes === 'string' ? notes : '',
            });
        },
        setTrafficLimitPercent(trafficLimitPercent) {
            const numberValue = Number(trafficLimitPercent);
            return writeProgramOfficeState(scope, {
                trafficLimitPercent: Number.isFinite(numberValue)
                    ? Math.max(0, Math.min(100, Math.round(numberValue)))
                    : null,
            });
        },
        setFreeze(freeze) {
            return writeProgramOfficeState(scope, {
                freeze: freeze === true,
            });
        },
        resetState() {
            return resetProgramOfficeState(scope);
        },
        async copyExecutiveBrief() {
            const model = buildModel();
            return copyToClipboardSafe(model.executivePack.executiveBrief);
        },
        async copyOperatorBrief() {
            const model = buildModel();
            return copyToClipboardSafe(model.executivePack.operatorBrief);
        },
        async copyRegionalAgenda() {
            const model = buildModel();
            return copyToClipboardSafe(model.executivePack.regionalAgenda);
        },
        async copyDrillPlan() {
            const model = buildModel();
            return copyToClipboardSafe(model.executivePack.drillPlan);
        },
        async copyForecast() {
            const model = buildModel();
            return copyToClipboardSafe(model.forecast.summary);
        },
        downloadJson(filename = 'turnero-regional-program-office.json') {
            const model = buildModel();
            return downloadJsonSnapshot(filename, model.exportPayload);
        },
    };
}

function renderPill(label, value, state = 'info') {
    return `<span class="turnero-release-war-room__pill" data-state="${escapeHtml(
        state
    )}">${escapeHtml(`${label} ${value}`)}</span>`;
}

function renderList(items, emptyText, itemRenderer) {
    const list = toArray(items);
    if (!list.length) {
        return `<p class="turnero-release-war-room__lane-note">${escapeHtml(
            emptyText
        )}</p>`;
    }

    return `<ul class="queue-regional-program-office__list">${list
        .map((item) => `<li>${itemRenderer(item)}</li>`)
        .join('')}</ul>`;
}

function renderDetails(summary, body, open = false, state = 'info') {
    return `
        <details ${open ? 'open' : ''} data-state="${escapeHtml(state)}">
            <summary>${escapeHtml(summary)}</summary>
            ${body}
        </details>
    `;
}

function renderProgramOffice(model) {
    const tone = model.tone || 'ready';
    const lastRunLabel = formatDateTime(
        model.state.lastRunAt || model.generatedAt
    );
    const globalActions = [
        ['copy-executive-brief', 'Copiar executive brief'],
        ['copy-operator-brief', 'Copiar operator brief'],
        ['copy-regional-agenda', 'Copiar regional agenda'],
        ['copy-drill-plan', 'Copiar drill plan'],
        ['copy-forecast', 'Copiar forecast'],
        ['download-json', 'Descargar JSON'],
        ['reset-state', 'Reset state'],
    ]
        .map(
            ([action, label]) => `
                <button type="button" data-program-office-action="${escapeHtml(
                    action
                )}">${escapeHtml(label)}</button>
            `
        )
        .join('');
    const summaryPills = [
        renderPill('Scope:', model.scope, 'info'),
        renderPill('Mode:', model.portfolioMode, tone),
        renderPill(
            'Preset:',
            model.activePreset?.label || model.activePresetId,
            model.activePresetId === model.presets.recommendedPresetId
                ? 'ready'
                : 'warning'
        ),
        renderPill('Decision:', model.forecast.recommendedDecision, tone),
        renderPill(
            'Last run:',
            lastRunLabel,
            model.state.lastRunAt ? 'ready' : 'info'
        ),
    ].join('');

    const controlsCard = `
        <article class="turnero-release-war-room__lane queue-app-card" data-state="${escapeHtml(
            tone
        )}">
            <header class="turnero-release-war-room__lane-header">
                <div>
                    <span class="turnero-release-war-room__lane-owner">Planning</span>
                    <h4 class="turnero-release-war-room__lane-stage">Estado local y presets</h4>
                </div>
                <div class="turnero-release-war-room__lane-meta">
                    <span>Stored ${escapeHtml(model.state.presetId)}</span>
                    <span>Recommended ${escapeHtml(
                        model.presets.recommendedPresetId
                    )}</span>
                </div>
            </header>
            <p class="turnero-release-war-room__lane-note">
                ${
                    model.portfolioMode === 'single-clinic-fallback'
                        ? 'Fallback de una sola clínica con persistencia local por scope.'
                        : 'Panel regional con estado local persistente por scope.'
                }
            </p>
            <div class="turnero-release-war-room__lane-block">
                <span class="turnero-release-war-room__section-label">Presets</span>
                <div class="turnero-release-war-room__lane-actions">${toArray(
                    model.presets.presets
                )
                    .map((preset) => {
                        const state =
                            preset.id === model.activePresetId
                                ? 'active'
                                : preset.id ===
                                    model.presets.recommendedPresetId
                                  ? 'recommended'
                                  : 'idle';
                        return `
                            <button
                                type="button"
                                id="queueRegionalProgramOfficePreset_${escapeHtml(
                                    preset.id
                                )}"
                                class="queue-install-preset-btn"
                                data-program-office-action="set-preset"
                                data-program-office-preset-id="${escapeHtml(
                                    preset.id
                                )}"
                                data-state="${escapeHtml(state)}"
                            >${escapeHtml(preset.label)}</button>
                        `;
                    })
                    .join('')}</div>
            </div>
            <div class="turnero-release-war-room__lane-block">
                <span class="turnero-release-war-room__section-label">Estado</span>
                <label class="queue-install-field" for="queueRegionalProgramOfficeNotes">
                    <span>Notas ejecutivas</span>
                    <textarea id="queueRegionalProgramOfficeNotes" rows="4" placeholder="Notas, hipótesis y decisiones del program office">${escapeHtml(
                        model.state.notes || ''
                    )}</textarea>
                </label>
                <label class="queue-install-field" for="queueRegionalProgramOfficeTrafficLimit">
                    <span>Límite de tráfico (%)</span>
                    <input
                        id="queueRegionalProgramOfficeTrafficLimit"
                        type="number"
                        min="0"
                        max="100"
                        value="${escapeHtml(
                            model.state.trafficLimitPercent == null
                                ? ''
                                : String(model.state.trafficLimitPercent)
                        )}"
                    />
                </label>
                <label class="queue-install-toggle" for="queueRegionalProgramOfficeFreeze">
                    <input id="queueRegionalProgramOfficeFreeze" type="checkbox" ${
                        model.state.freeze ? 'checked' : ''
                    } />
                    <span>Freeze local opcional</span>
                </label>
                <p class="turnero-release-war-room__lane-note">Última corrida persistida: ${escapeHtml(
                    lastRunLabel
                )}.</p>
            </div>
        </article>
    `;

    const forecastCard = `
        <article class="turnero-release-war-room__lane queue-app-card" data-state="${escapeHtml(
            model.forecast.recommendedDecision === 'hold'
                ? 'alert'
                : model.forecast.recommendedDecision === 'promote'
                  ? 'ready'
                  : 'warning'
        )}">
            <header class="turnero-release-war-room__lane-header">
                <div>
                    <span class="turnero-release-war-room__lane-owner">Forecast</span>
                    <h4 class="turnero-release-war-room__lane-stage">Comparison y pressure</h4>
                </div>
                <div class="turnero-release-war-room__lane-meta">
                    <span>Debt ${escapeHtml(model.forecast.active?.operationalDebt || 0)}</span>
                    <span>Risk ${escapeHtml(model.forecast.active?.aggregatedRisk || 'n/a')}</span>
                </div>
            </header>
            <p class="turnero-release-war-room__lane-note">${escapeHtml(
                model.capacity.summary
            )}</p>
            <div class="turnero-release-war-room__lane-block">
                <span class="turnero-release-war-room__section-label">Owner pressure</span>
                ${renderList(
                    model.capacity.owners,
                    'Sin presión por owner.',
                    (item) => `
                        <strong>${escapeHtml(item.owner)}</strong>
                        <span class="queue-app-card__tag" data-state="info">colas ${escapeHtml(
                            item.queuePressure
                        )}</span>
                        <span class="queue-app-card__tag" data-state="info">gap ${escapeHtml(
                            item.coverageGap
                        )}</span>
                        <span class="queue-app-card__tag" data-state="info">SP ${escapeHtml(
                            item.singlePointRisk
                        )}</span>
                    `
                )}
            </div>
            <div class="turnero-release-war-room__lane-block">
                <span class="turnero-release-war-room__section-label">Forecast portfolio</span>
                ${renderList(
                    model.forecast.forecasts,
                    'Sin presets para forecast.',
                    (item) => `
                        <strong>${escapeHtml(item.label)}</strong>
                        <span class="queue-app-card__tag" data-state="${
                            item.recommendedDecision === 'promote'
                                ? 'ready'
                                : item.recommendedDecision === 'hold'
                                  ? 'alert'
                                  : 'warning'
                        }">${escapeHtml(item.recommendedDecision)}</span>
                        <span class="queue-app-card__tag" data-state="info">clinics ${escapeHtml(
                            item.promotableClinics
                        )}</span>
                        <span class="queue-app-card__tag" data-state="info">debt ${escapeHtml(
                            item.operationalDebt
                        )}</span>
                    `
                )}
            </div>
        </article>
    `;

    const calendarCard = `
        <article class="turnero-release-war-room__lane queue-app-card" data-state="${
            model.state.freeze ? 'warning' : 'ready'
        }">
            <header class="turnero-release-war-room__lane-header">
                <div>
                    <span class="turnero-release-war-room__lane-owner">Calendar</span>
                    <h4 class="turnero-release-war-room__lane-stage">Wave calendar</h4>
                </div>
                <div class="turnero-release-war-room__lane-meta">
                    <span>Preset ${escapeHtml(model.waveCalendar.presetId || 'n/a')}</span>
                    <span>Windows ${escapeHtml(model.waveCalendar.windows.length)}</span>
                </div>
            </header>
            <p class="turnero-release-war-room__lane-note">${escapeHtml(
                model.waveCalendar.summary
            )}</p>
            <div class="turnero-release-war-room__lane-block">
                <span class="turnero-release-war-room__section-label">Próximas ventanas</span>
                ${renderList(
                    model.waveCalendar.windows,
                    'Sin ventanas planeadas.',
                    (item) => `
                        <strong>${escapeHtml(item.windowLabel)}</strong>
                        <span class="queue-app-card__tag" data-state="info">${escapeHtml(
                            formatDateTime(item.startAt)
                        )}</span>
                        <span class="queue-app-card__tag" data-state="info">cohort ${escapeHtml(
                            item.targetCohort
                        )}</span>
                        <span class="queue-app-card__tag" data-state="info">traffic ${escapeHtml(
                            item.targetTrafficPercent
                        )}%</span>
                        <span class="queue-app-card__tag" data-state="info">${escapeHtml(
                            item.goNoGoHint
                        )}</span>
                    `
                )}
            </div>
        </article>
    `;

    const drillsCard = `
        <article class="turnero-release-war-room__lane queue-app-card" data-state="${
            model.drills.topDrill?.priority === 'p1'
                ? 'alert'
                : model.drills.topDrill?.priority === 'p2'
                  ? 'warning'
                  : 'ready'
        }">
            <header class="turnero-release-war-room__lane-header">
                <div>
                    <span class="turnero-release-war-room__lane-owner">Drills</span>
                    <h4 class="turnero-release-war-room__lane-stage">Outage drill matrix</h4>
                </div>
                <div class="turnero-release-war-room__lane-meta">
                    <span>Top ${escapeHtml(model.drills.topDrill?.id || 'n/a')}</span>
                    <span>Count ${escapeHtml(model.drills.drills.length)}</span>
                </div>
            </header>
            <p class="turnero-release-war-room__lane-note">${escapeHtml(
                model.drills.summary
            )}</p>
            <div class="turnero-release-war-room__lane-block">
                <span class="turnero-release-war-room__section-label">Drills priorizados</span>
                ${renderList(
                    model.drills.drills,
                    'Sin drills prioritarios.',
                    (drill) =>
                        renderDetails(
                            `${drill.priority} · ${drill.title} · ${drill.owner}`,
                            `
                                <p class="turnero-release-war-room__lane-note">Risk: ${escapeHtml(
                                    drill.risk
                                )}</p>
                                <ul>
                                    <li><strong>Prechecks:</strong> ${escapeHtml(
                                        drill.prechecks.join(' · ')
                                    )}</li>
                                    <li><strong>Steps:</strong> ${escapeHtml(
                                        drill.steps.join(' · ')
                                    )}</li>
                                    <li><strong>Rollback:</strong> ${escapeHtml(
                                        drill.rollbackSteps.join(' · ')
                                    )}</li>
                                    <li><strong>Evidence:</strong> ${escapeHtml(
                                        drill.evidenceChecklist.join(' · ')
                                    )}</li>
                                    <li><strong>Risk notes:</strong> ${escapeHtml(
                                        drill.riskNotes.join(' · ')
                                    )}</li>
                                </ul>
                            `,
                            drill.priority === 'p1',
                            drill.priority === 'p1'
                                ? 'alert'
                                : drill.priority === 'p2'
                                  ? 'warning'
                                  : 'info'
                        )
                )}
            </div>
        </article>
    `;

    const briefsCard = `
        <article class="turnero-release-war-room__lane queue-app-card" data-state="${escapeHtml(
            tone
        )}">
            <header class="turnero-release-war-room__lane-header">
                <div>
                    <span class="turnero-release-war-room__lane-owner">Briefs</span>
                    <h4 class="turnero-release-war-room__lane-stage">Executive pack</h4>
                </div>
                <div class="turnero-release-war-room__lane-meta">
                    <span>File ${escapeHtml(model.snapshotFileName)}</span>
                    <span>Generated ${escapeHtml(formatDateTime(model.generatedAt))}</span>
                </div>
            </header>
            <p class="turnero-release-war-room__lane-note">${escapeHtml(
                model.executivePack.executiveBrief.split('\n')[0] || ''
            )}</p>
            <div class="turnero-release-war-room__lane-block">
                <span class="turnero-release-war-room__section-label">Copy-ready briefs</span>
                ${renderDetails(
                    'Executive brief',
                    `<pre class="queue-regional-program-office__brief">${escapeHtml(
                        model.executivePack.executiveBrief
                    )}</pre>`,
                    true,
                    tone
                )}
                ${renderDetails(
                    'Operator brief',
                    `<pre class="queue-regional-program-office__brief">${escapeHtml(
                        model.executivePack.operatorBrief
                    )}</pre>`
                )}
                ${renderDetails(
                    'Regional agenda',
                    `<pre class="queue-regional-program-office__brief">${escapeHtml(
                        model.executivePack.regionalAgenda
                    )}</pre>`
                )}
                ${renderDetails(
                    'Drill plan',
                    `<pre class="queue-regional-program-office__brief">${escapeHtml(
                        model.executivePack.drillPlan
                    )}</pre>`
                )}
            </div>
            <div class="turnero-release-war-room__lane-block">
                <span class="turnero-release-war-room__section-label">JSON pack</span>
                <p class="turnero-release-war-room__lane-note">
                    Export consolidado: <strong>${escapeHtml(
                        model.snapshotFileName
                    )}</strong>
                </p>
                <p class="turnero-release-war-room__lane-note">
                    Contiene state, presets, capacity, forecast, waveCalendar, drills y briefs.
                </p>
            </div>
        </article>
    `;

    return `
        <section
            id="queueRegionalProgramOfficePanel"
            class="turnero-release-war-room queue-app-card queue-regional-program-office"
            data-state="${escapeHtml(tone)}"
            data-scope="${escapeHtml(model.scope)}"
            data-portfolio-mode="${escapeHtml(model.portfolioMode)}"
            data-program-office-preset="${escapeHtml(model.activePresetId)}"
            aria-labelledby="queueRegionalProgramOfficeTitle"
            aria-live="polite"
        >
            <header class="turnero-release-war-room__header">
                <div>
                    <span class="turnero-release-war-room__kicker">Regional Program Office</span>
                    <h3 class="turnero-release-war-room__title" id="queueRegionalProgramOfficeTitle">${escapeHtml(
                        model.clinicLabel
                    )}</h3>
                    <p class="turnero-release-war-room__subtitle">${escapeHtml(
                        model.summary
                    )}</p>
                </div>
                <div class="turnero-release-war-room__meta">
                    <span>Scope: ${escapeHtml(model.scope)}</span>
                    <span>Preset: ${escapeHtml(
                        model.activePreset?.label || model.activePresetId
                    )}</span>
                    <span>Decision: ${escapeHtml(
                        model.forecast.recommendedDecision
                    )}</span>
                </div>
            </header>

            <div class="turnero-release-war-room__global-summary">
                ${summaryPills}
            </div>

            <div class="turnero-release-war-room__global-actions">
                ${globalActions}
            </div>

            <div class="turnero-release-war-room__lanes">
                ${controlsCard}
                ${forecastCard}
                ${calendarCard}
                ${drillsCard}
                ${briefsCard}
            </div>
        </section>
    `.trim();
}

function bindRegionalProgramOfficeActions(section, context, rerender) {
    const actions = createRegionalProgramOfficeActions(context);
    const buttons = Array.from(
        section.querySelectorAll('[data-program-office-action]') || []
    );

    buttons.forEach((button) => {
        if (
            typeof HTMLButtonElement === 'undefined' ||
            !(button instanceof HTMLButtonElement)
        ) {
            return;
        }

        button.addEventListener('click', async () => {
            const action = String(
                button.dataset.programOfficeAction || ''
            ).trim();
            const presetId = String(
                button.dataset.programOfficePresetId || ''
            ).trim();
            let result = false;

            if (action === 'set-preset') {
                result = actions.setPreset(presetId);
                rerender();
            } else if (action === 'copy-executive-brief') {
                result = await actions.copyExecutiveBrief();
            } else if (action === 'copy-operator-brief') {
                result = await actions.copyOperatorBrief();
            } else if (action === 'copy-regional-agenda') {
                result = await actions.copyRegionalAgenda();
            } else if (action === 'copy-drill-plan') {
                result = await actions.copyDrillPlan();
            } else if (action === 'copy-forecast') {
                result = await actions.copyForecast();
            } else if (action === 'download-json') {
                result = actions.downloadJson();
            } else if (action === 'reset-state') {
                result = actions.resetState();
                rerender();
            }

            button.dataset.state =
                result === false || result == null ? 'error' : 'done';
        });
    });

    const notesField = section.querySelector(
        '#queueRegionalProgramOfficeNotes'
    );
    if (
        typeof HTMLTextAreaElement !== 'undefined' &&
        notesField instanceof HTMLTextAreaElement
    ) {
        notesField.onchange = () => {
            actions.setNotes(notesField.value);
            rerender();
        };
    }

    const trafficField = section.querySelector(
        '#queueRegionalProgramOfficeTrafficLimit'
    );
    if (
        typeof HTMLInputElement !== 'undefined' &&
        trafficField instanceof HTMLInputElement
    ) {
        trafficField.onchange = () => {
            actions.setTrafficLimitPercent(trafficField.value);
            rerender();
        };
    }

    const freezeField = section.querySelector(
        '#queueRegionalProgramOfficeFreeze'
    );
    if (
        typeof HTMLInputElement !== 'undefined' &&
        freezeField instanceof HTMLInputElement
    ) {
        freezeField.onchange = () => {
            actions.setFreeze(freezeField.checked);
            rerender();
        };
    }
}

export function renderRegionalProgramOfficeCard(input = {}, options = {}) {
    const model = isProgramOfficeModel(input)
        ? input
        : buildRegionalProgramOffice({
              ...input,
              ...options,
          });

    return renderProgramOffice(model);
}

export function mountRegionalProgramOfficeCard(
    target,
    context = {},
    options = {}
) {
    if (!isDomElement(target)) {
        return null;
    }

    const renderContext = {
        ...context,
        storage: options.storage || context.storage || null,
    };
    const rerender = () => {
        const nextModel = buildRegionalProgramOffice(renderContext);
        target.innerHTML = renderProgramOffice(nextModel);
        const nextSection = target.querySelector(
            '#queueRegionalProgramOfficePanel'
        );
        if (nextSection instanceof HTMLElement) {
            nextSection.__turneroRegionalProgramOfficeModel = nextModel;
            bindRegionalProgramOfficeActions(
                nextSection,
                renderContext,
                rerender
            );
            target.dataset.turneroRegionalProgramOfficeScope =
                nextModel.scope || 'default';
            target.dataset.turneroRegionalProgramOfficeRequestId =
                nextModel.generatedAt || new Date().toISOString();
            target.dataset.turneroRegionalProgramOfficeMode =
                nextModel.portfolioMode || 'single-clinic-fallback';
            return nextSection;
        }

        return null;
    };

    const model = buildRegionalProgramOffice(renderContext);
    target.innerHTML = renderProgramOffice(model);
    const section = target.querySelector('#queueRegionalProgramOfficePanel');
    if (section instanceof HTMLElement) {
        section.__turneroRegionalProgramOfficeModel = model;
        bindRegionalProgramOfficeActions(section, renderContext, rerender);
        target.dataset.turneroRegionalProgramOfficeScope =
            model.scope || 'default';
        target.dataset.turneroRegionalProgramOfficeRequestId =
            model.generatedAt || new Date().toISOString();
        target.dataset.turneroRegionalProgramOfficeMode =
            model.portfolioMode || 'single-clinic-fallback';
        return section;
    }

    return target;
}

export default buildRegionalProgramOffice;
