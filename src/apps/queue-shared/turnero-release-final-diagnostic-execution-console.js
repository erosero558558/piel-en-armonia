import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { buildTurneroReleaseCloseoutPlanBuilder } from './turnero-release-closeout-plan-builder.js';
import { buildTurneroReleaseDomainConvergenceAudit } from './turnero-release-domain-convergence-audit.js';
import { buildTurneroReleaseFinalDiagnosticReadiness } from './turnero-release-final-diagnostic-readiness.js';
import { buildTurneroReleaseFinalGapNormalizer } from './turnero-release-final-gap-normalizer.js';
import { buildTurneroReleaseStepManifest } from './turnero-release-step-manifest.js';
import { buildTurneroReleaseSurfaceContractAudit } from './turnero-release-surface-contract-audit.js';
import { buildTurneroReleaseWiringAuditModel } from './turnero-release-wiring-audit-model.js';

const DEFAULT_DOWNLOAD_FILE_NAME = 'turnero-release-final-diagnostic-pack.json';
const DEFAULT_SURFACE_ORDER = ['admin', 'operator', 'kiosk', 'display'];

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

function escapeHtml(value) {
    return toText(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeRows(value, fallbackPrefix = 'row') {
    if (Array.isArray(value)) {
        return value.filter(Boolean).map((item, index) => {
            const row = asObject(item);
            const fallbackId = `${fallbackPrefix}-${index + 1}`;
            const id = toText(row.id || row.key, fallbackId);

            return {
                ...row,
                id,
                key: toText(row.key, id),
            };
        });
    }

    if (value && typeof value === 'object') {
        return Object.entries(value)
            .filter(([, entry]) => Boolean(entry))
            .map(([key, entry], index) => {
                const row = asObject(entry);
                const fallbackId = `${fallbackPrefix}-${index + 1}`;
                const id = toText(row.id || row.key || key, fallbackId);

                return {
                    ...row,
                    id,
                    key: toText(row.key, id),
                };
            });
    }

    return [];
}

function normalizeSurfaceRows(value) {
    const rows = normalizeRows(value, 'surface');
    if (rows.length > 0) {
        return rows.map((surface, index) => {
            const key = toText(
                surface.key,
                surface.id ||
                    DEFAULT_SURFACE_ORDER[index] ||
                    `surface-${index + 1}`
            );
            const domains = [
                ...toArray(surface.domains).map((entry) => toText(entry)),
                toText(surface.domain),
                key,
            ].filter(Boolean);

            return {
                ...surface,
                id: toText(surface.id, key),
                key,
                label: toText(surface.label, `Surface ${index + 1}`),
                owner: toText(surface.owner, 'ops'),
                route: toText(surface.route, ''),
                enabled: surface.enabled !== false,
                domains: [...new Set(domains)],
            };
        });
    }

    return DEFAULT_SURFACE_ORDER.map((key) => ({
        id: key,
        key,
        label:
            key === 'admin'
                ? 'Admin web'
                : key === 'operator'
                  ? 'Operador web'
                  : key === 'kiosk'
                    ? 'Kiosco web'
                    : 'Sala web',
        owner: key === 'admin' || key === 'display' ? 'deploy' : 'ops',
        route:
            key === 'admin'
                ? '/admin.html#queue'
                : key === 'operator'
                  ? '/operador-turnos.html'
                  : key === 'kiosk'
                    ? '/kiosco-turnos.html'
                    : '/sala-turnos.html',
        enabled: true,
        domains:
            key === 'admin'
                ? [
                      'service',
                      'integration',
                      'governance',
                      'assurance',
                      'telemetry',
                      'strategy',
                      'orchestration',
                      'privacy',
                  ]
                : key === 'operator'
                  ? [
                        'service',
                        'integration',
                        'assurance',
                        'reliability',
                        'telemetry',
                    ]
                  : key === 'kiosk'
                    ? ['service', 'privacy', 'orchestration']
                    : ['service', 'reliability', 'orchestration'],
    }));
}

function surfaceSupportsDomain(surface, domain, key) {
    const domains = toArray(surface.domains)
        .map((entry) => toText(entry))
        .filter(Boolean);

    if (surface.enabled === false) {
        return false;
    }

    return (
        domains.includes(domain) ||
        domains.includes(key) ||
        domains.includes(surface.key) ||
        domains.includes(surface.id)
    );
}

function normalizeContracts(value, surfaces) {
    const rows = normalizeRows(value, 'contract');
    if (rows.length > 0) {
        return rows.map((contract, index) => ({
            ...contract,
            id: toText(contract.id, contract.key || `contract-${index + 1}`),
            key: toText(contract.key, contract.id || `contract-${index + 1}`),
            label: toText(contract.label, `Contract ${index + 1}`),
            source: toText(contract.source, ''),
            target: toText(contract.target, ''),
            owner: toText(contract.owner, 'ops'),
            version: toText(contract.version, 'v1'),
            criticality: toText(contract.criticality, 'medium'),
            state: toText(contract.state, 'active'),
            surfaceId: toText(
                contract.surfaceId || contract.surface || contract.source,
                ''
            ),
        }));
    }

    return surfaces.map((surface, index) => ({
        id: `${surface.key}-contract`,
        key: `${surface.key}-contract`,
        label: `${surface.label} contract`,
        source: surface.key,
        target: surface.route || surface.label,
        owner: surface.owner,
        version: 'v1',
        criticality:
            surface.key === 'admin' || surface.key === 'display'
                ? 'critical'
                : 'high',
        state: surface.enabled === false ? 'degraded' : 'active',
        surfaceId: surface.key,
        freshnessSlaMinutes: index === 0 ? 10 : 15,
    }));
}

function buildRegistryRows(manifestRows, wiringRows, surfaces, value) {
    const rows = normalizeRows(value, 'registry');
    if (rows.length > 0) {
        return rows.map((row, index) => {
            const manifest = manifestRows[index] || {};
            const mounted =
                row.mounted === true ||
                ['present', 'ready', 'pass'].includes(
                    toText(row.state).trim().toLowerCase()
                );

            return {
                ...row,
                key: toText(
                    row.key,
                    toText(manifest.domain || manifest.key, row.id)
                ),
                label: toText(
                    row.label,
                    manifest.label || row.key || `Registry ${index + 1}`
                ),
                mounted,
                state: toText(row.state, mounted ? 'present' : 'missing'),
                surfaceCount: Number(row.surfaceCount || 0),
                source: toText(row.source, 'manual'),
            };
        });
    }

    return manifestRows.map((manifest) => {
        const wiringRow =
            wiringRows.find((row) => row.key === manifest.key) ||
            wiringRows.find((row) => row.domain === manifest.domain) ||
            {};
        const coveragePct = Number(wiringRow.coveragePct || 0);
        const mounted =
            wiringRow.state === 'pass' ||
            (wiringRow.state === 'partial' && coveragePct >= 50);
        const state = mounted
            ? 'present'
            : wiringRow.state === 'partial'
              ? 'partial'
              : 'missing';
        const supportingSurfaces = toArray(manifest.requiredSurfaces)
            .map((surfaceId) =>
                surfaces.find(
                    (surface) =>
                        surface.key === surfaceId || surface.id === surfaceId
                )
            )
            .filter((surface) =>
                surfaceSupportsDomain(
                    surface || {},
                    manifest.domain,
                    manifest.key
                )
            ).length;

        return {
            id: `registry-${manifest.key}`,
            key: manifest.domain || manifest.key,
            label: manifest.label,
            mounted,
            state,
            surfaceCount: supportingSurfaces,
            source: 'wiring-audit',
        };
    });
}

function buildInventoryRows(
    manifestRows,
    wiringRows,
    surfaceContractRows,
    surfaces,
    value
) {
    const rows = normalizeRows(value, 'inventory');
    if (rows.length > 0) {
        return rows.map((row, index) => {
            const manifest = manifestRows[index] || {};
            const readiness = toText(
                row.readiness || row.state,
                row.mounted === true ? 'present' : 'missing'
            );

            return {
                ...row,
                key: toText(
                    row.key,
                    toText(manifest.domain || manifest.key, row.id)
                ),
                label: toText(
                    row.label,
                    manifest.label || row.key || `Inventory ${index + 1}`
                ),
                readiness,
                state: toText(row.state, readiness || 'missing'),
                surfaceCount: Number(row.surfaceCount || 0),
                contractCount: Number(row.contractCount || 0),
                watchContracts: Number(row.watchContracts || 0),
                missingContracts: Number(row.missingContracts || 0),
                source: toText(row.source, 'manual'),
            };
        });
    }

    return manifestRows.map((manifest) => {
        const requiredSurfaces = toArray(manifest.requiredSurfaces)
            .map((entry) => toText(entry))
            .filter(Boolean);
        const wiringRow =
            wiringRows.find((row) => row.key === manifest.key) ||
            wiringRows.find((row) => row.domain === manifest.domain) ||
            {};
        const mappedContracts = requiredSurfaces
            .map((surfaceId) =>
                surfaceContractRows.find((row) => row.surfaceId === surfaceId)
            )
            .filter((row) => Boolean(row && row.state));
        const passContracts = mappedContracts.filter(
            (row) => row.state === 'pass'
        ).length;
        const watchContracts = mappedContracts.filter(
            (row) => row.state === 'watch'
        ).length;
        const missingContracts = mappedContracts.filter(
            (row) => row.state === 'missing'
        ).length;
        const ready =
            wiringRow.state === 'pass' &&
            mappedContracts.length > 0 &&
            passContracts === mappedContracts.length;
        const readiness = ready
            ? 'present'
            : watchContracts > 0 || wiringRow.state === 'partial'
              ? 'partial'
              : 'missing';
        const state = readiness === 'present' ? 'ready' : readiness;
        const surfaceCount = requiredSurfaces.filter((surfaceId) =>
            surfaces.some(
                (surface) =>
                    surface.key === surfaceId &&
                    surfaceSupportsDomain(
                        surface,
                        manifest.domain,
                        manifest.key
                    )
            )
        ).length;

        return {
            id: `inventory-${manifest.key}`,
            key: manifest.domain || manifest.key,
            label: manifest.label,
            readiness,
            state,
            surfaceCount,
            contractCount: mappedContracts.length,
            watchContracts,
            missingContracts,
            source: 'contract-audit',
        };
    });
}

function buildGapRows({
    releaseEvidenceBundle = {},
    wiringRows = [],
    surfaceContractRows = [],
    registryRows = [],
    inventoryRows = [],
} = {}) {
    const blockerRows = toArray(releaseEvidenceBundle?.blockers).map(
        (blocker, index) => ({
            id: `blocker-${index + 1}`,
            title: toText(
                blocker?.title || blocker?.detail || 'Evidence blocker'
            ),
            domain: toText(blocker?.lane || blocker?.domain || 'deployment'),
            owner: toText(blocker?.owner, 'ops'),
            surface: toText(blocker?.surface || 'admin'),
            severity: toText(blocker?.severity || 'high'),
            status: 'open',
            source: toText(blocker?.source, 'evidence'),
            note: toText(blocker?.detail || blocker?.note || ''),
        })
    );

    const wiringGaps = wiringRows
        .filter((row) => row.state !== 'pass')
        .map((row, index) => ({
            id: `wiring-gap-${index + 1}`,
            title: `Wiring gap: ${row.label}`,
            domain: row.domain,
            owner: row.owner,
            surface:
                row.coverage?.find((entry) => !entry.present)?.surfaceId ||
                'admin',
            severity: row.state === 'missing' ? 'high' : 'medium',
            status: 'open',
            source: 'wiring-audit',
        }));

    const contractGaps = surfaceContractRows
        .filter((row) => row.state !== 'pass')
        .map((row, index) => ({
            id: `contract-gap-${index + 1}`,
            title: `Contract gap: ${row.label}`,
            domain: 'deployment',
            owner:
                row.surfaceId === 'admin' || row.surfaceId === 'display'
                    ? 'deploy'
                    : 'ops',
            surface: row.surfaceId,
            severity: row.state === 'missing' ? 'high' : 'medium',
            status: 'open',
            source: 'contract-audit',
        }));

    const registryGaps = registryRows
        .filter((row) => row.state !== 'present')
        .map((row, index) => ({
            id: `registry-gap-${index + 1}`,
            title: `Registry gap: ${row.label}`,
            domain: 'deployment',
            owner: 'ops',
            surface: 'admin',
            severity: row.state === 'missing' ? 'high' : 'medium',
            status: 'open',
            source: 'registry-audit',
        }));

    const inventoryGaps = inventoryRows
        .filter((row) => row.state !== 'ready' && row.readiness !== 'present')
        .map((row, index) => ({
            id: `inventory-gap-${index + 1}`,
            title: `Inventory gap: ${row.label}`,
            domain: 'deployment',
            owner: 'ops',
            surface: 'admin',
            severity: row.readiness === 'missing' ? 'high' : 'medium',
            status: 'open',
            source: 'inventory-audit',
        }));

    return [
        ...blockerRows,
        ...wiringGaps,
        ...contractGaps,
        ...registryGaps,
        ...inventoryGaps,
    ];
}

function buildDiagnosticContext(
    input = {},
    currentSnapshot = {},
    releaseEvidenceBundle = {},
    clinicProfile = {}
) {
    const clinicId = toText(
        input.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            currentSnapshot.clinicId ||
            releaseEvidenceBundle.clinicId ||
            'default-clinic',
        'default-clinic'
    );
    const clinicLabel = toText(
        input.clinicLabel ||
            clinicProfile.branding?.name ||
            clinicProfile.clinic_name ||
            clinicProfile.clinicName ||
            currentSnapshot.clinicName ||
            currentSnapshot.brandName ||
            'Aurora Derm',
        'Aurora Derm'
    );
    const detectedPlatform = toText(
        input.detectedPlatform ||
            input.platform ||
            currentSnapshot.detectedPlatform,
        ''
    );

    return {
        clinicId,
        clinicLabel,
        detectedPlatform,
        generatedAt: toText(input.generatedAt, new Date().toISOString()),
    };
}

function buildTurneroReleaseFinalDiagnosticExecutionConsoleBrief(pack) {
    const topPlanRows = pack.closeoutPlan.rows.slice(0, 4);

    return [
        '# Final Diagnostic Execution Console',
        '',
        `Clinic: ${pack.context.clinicLabel} (${pack.context.clinicId})`,
        `Platform: ${pack.context.detectedPlatform || 'unknown'}`,
        `Readiness score: ${pack.readiness.score} (${pack.readiness.band})`,
        `Decision: ${pack.readiness.decision}`,
        `Manifest steps: ${pack.manifest.summary.all}`,
        `Surfaces: ${pack.surfaces.length}`,
        `Wiring: ${pack.wiringAudit.summary.pass} pass · ${pack.wiringAudit.summary.partial} partial · ${pack.wiringAudit.summary.missing} missing`,
        `Contracts: ${pack.surfaceContractAudit.summary.pass} pass · ${pack.surfaceContractAudit.summary.watch} watch · ${pack.surfaceContractAudit.summary.missing} missing`,
        `Registry gaps: ${pack.summary.registryMissingCount}`,
        `Inventory partials: ${pack.summary.inventoryPartialCount}`,
        `Open gaps: ${pack.finalGaps.summary.open}`,
        `High gaps: ${pack.finalGaps.summary.high}`,
        `Closeout items: ${pack.closeoutPlan.summary.all}`,
        '',
        '## Closeout priorities',
        ...topPlanRows.map(
            (row) => `- [${row.priority}] ${row.title} · ${row.nextAction}`
        ),
        '',
        `Generated at: ${pack.generatedAt}`,
    ].join('\n');
}

export function buildTurneroReleaseFinalDiagnosticExecutionConsolePack(
    input = {}
) {
    const currentSnapshot = asObject(
        input.currentSnapshot || input.snapshot || {}
    );
    const releaseEvidenceBundle = asObject(
        input.releaseEvidenceBundle ||
            currentSnapshot.releaseEvidenceBundle ||
            currentSnapshot.parts?.releaseEvidenceBundle ||
            {}
    );
    const clinicProfile = asObject(
        input.clinicProfile ||
            input.turneroClinicProfile ||
            currentSnapshot.clinicProfile ||
            currentSnapshot.turneroClinicProfile ||
            releaseEvidenceBundle.clinicProfile ||
            releaseEvidenceBundle.turneroClinicProfile ||
            {}
    );
    const context = buildDiagnosticContext(
        input,
        currentSnapshot,
        releaseEvidenceBundle,
        clinicProfile
    );
    const manifest = buildTurneroReleaseStepManifest({
        steps: input.steps,
    });
    const surfaces = normalizeSurfaceRows(
        input.surfaces ||
            currentSnapshot.surfaces ||
            clinicProfile.surfaces ||
            releaseEvidenceBundle.surfaces
    );
    const contracts = normalizeContracts(
        input.contracts ||
            currentSnapshot.contracts ||
            releaseEvidenceBundle.contracts,
        surfaces
    );
    const wiringAudit = buildTurneroReleaseWiringAuditModel({
        manifestRows: manifest.rows,
        surfaces,
    });
    const surfaceContractAudit = buildTurneroReleaseSurfaceContractAudit({
        surfaces,
        contracts,
    });
    const registryRows = buildRegistryRows(
        manifest.rows,
        wiringAudit.rows,
        surfaces,
        input.registryRows ||
            currentSnapshot.registryRows ||
            releaseEvidenceBundle.registryRows
    );
    const inventoryRows = buildInventoryRows(
        manifest.rows,
        wiringAudit.rows,
        surfaceContractAudit.rows,
        surfaces,
        input.inventoryRows ||
            currentSnapshot.inventoryRows ||
            releaseEvidenceBundle.inventoryRows
    );
    const domainConvergenceAudit = buildTurneroReleaseDomainConvergenceAudit({
        manifestRows: manifest.rows,
        registryRows,
        inventoryRows,
    });
    const gaps = normalizeRows(
        input.gaps || currentSnapshot.gaps || releaseEvidenceBundle.gaps,
        'gap'
    );
    const finalGaps = buildTurneroReleaseFinalGapNormalizer({
        gaps: gaps.concat(
            buildGapRows({
                releaseEvidenceBundle,
                wiringRows: wiringAudit.rows,
                surfaceContractRows: surfaceContractAudit.rows,
                registryRows,
                inventoryRows,
            })
        ),
        wiringRows: wiringAudit.rows,
        convergenceRows: domainConvergenceAudit.rows,
    });
    const closeoutPlan = buildTurneroReleaseCloseoutPlanBuilder({
        gaps: finalGaps.rows,
    });
    const readiness = buildTurneroReleaseFinalDiagnosticReadiness({
        manifestSummary: manifest.summary,
        wiringSummary: wiringAudit.summary,
        contractSummary: surfaceContractAudit.summary,
        convergenceSummary: domainConvergenceAudit.summary,
        finalGapSummary: finalGaps.summary,
    });
    const summary = {
        manifestCount: manifest.summary.all,
        surfaceCount: surfaces.length,
        wiringPassCount: wiringAudit.summary.pass,
        wiringMissingCount: wiringAudit.summary.missing,
        contractWatchCount: surfaceContractAudit.summary.watch,
        contractMissingCount: surfaceContractAudit.summary.missing,
        registryMissingCount: registryRows.filter(
            (row) => row.state !== 'present' && row.state !== 'ready'
        ).length,
        inventoryPartialCount: inventoryRows.filter((row) =>
            ['partial', 'warning', 'watch'].includes(
                toText(row.readiness || row.state)
                    .trim()
                    .toLowerCase()
            )
        ).length,
        openGapCount: finalGaps.summary.open,
        highGapCount: finalGaps.summary.high,
        closeoutCount: closeoutPlan.summary.all,
        readinessScore: readiness.score,
        readinessBand: readiness.band,
        readinessDecision: readiness.decision,
    };

    return {
        context,
        manifest,
        surfaces,
        contracts,
        wiringAudit,
        surfaceContractAudit,
        registryRows,
        inventoryRows,
        domainConvergenceAudit,
        gaps,
        finalGaps,
        closeoutPlan,
        readiness,
        summary,
        downloadFileName: toText(
            input.downloadFileName,
            DEFAULT_DOWNLOAD_FILE_NAME
        ),
        briefMarkdown: buildTurneroReleaseFinalDiagnosticExecutionConsoleBrief({
            context,
            manifest,
            surfaces,
            contracts,
            wiringAudit,
            surfaceContractAudit,
            registryRows,
            inventoryRows,
            domainConvergenceAudit,
            gaps,
            finalGaps,
            closeoutPlan,
            readiness,
            summary,
            generatedAt: context.generatedAt,
        }),
        generatedAt: context.generatedAt,
    };
}

function renderMetricCard(label, value, detail, tone = 'ready', role = '') {
    return `
        <article class="turnero-release-final-diagnostic-execution-console__metric" data-state="${escapeHtml(
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

function renderRowList(title, rows, options = {}) {
    const itemTone =
        options.itemTone || ((row) => row.severity || row.state || 'ready');
    const emptyLabel = options.emptyLabel || 'Sin elementos';
    const previewRows = rows.slice(0, Number(options.limit || 4));

    return `
        <section class="turnero-release-final-diagnostic-execution-console__panel">
            <div class="turnero-release-final-diagnostic-execution-console__panel-header">
                <p class="queue-app-card__eyebrow">${escapeHtml(title)}</p>
                <strong>${escapeHtml(String(rows.length))}</strong>
            </div>
            ${
                previewRows.length
                    ? `<ul class="turnero-release-final-diagnostic-execution-console__list">${previewRows
                          .map(
                              (row) => `
                    <li data-state="${escapeHtml(itemTone(row))}">
                        <strong>${escapeHtml(
                            row.title || row.label || row.key || 'Item'
                        )}</strong>
                        <span>${escapeHtml(
                            row.nextAction || row.note || row.state || ''
                        )}</span>
                    </li>`
                          )
                          .join('')}</ul>`
                    : `<p class="turnero-release-final-diagnostic-execution-console__empty">${escapeHtml(
                          emptyLabel
                      )}</p>`
            }
        </section>
    `;
}

function renderTurneroReleaseFinalDiagnosticExecutionConsoleHtml(pack) {
    return `
        <article class="turnero-release-final-diagnostic-execution-console__card" data-state="${escapeHtml(
            pack.readiness.band
        )}">
            <header class="turnero-release-final-diagnostic-execution-console__header">
                <div>
                    <p class="queue-app-card__eyebrow">Final diagnostic</p>
                    <h3>Final Diagnostic Execution Console</h3>
                    <p>
                        Closeout brief for the current release snapshot: wiring,
                        contracts, registry, inventory and the remaining gaps.
                    </p>
                </div>
                <div class="turnero-release-final-diagnostic-execution-console__actions">
                    <button type="button" data-action="copy-closeout-brief">Copy closeout brief</button>
                    <button type="button" data-action="download-final-diagnostic-pack">Download final diagnostic JSON</button>
                </div>
            </header>
            <div class="turnero-release-final-diagnostic-execution-console__metrics">
                ${renderMetricCard(
                    'Readiness',
                    String(pack.readiness.score),
                    pack.readiness.band,
                    pack.readiness.band,
                    'readiness-score'
                )}
                ${renderMetricCard(
                    'Decision',
                    pack.readiness.decision,
                    'Readiness gate',
                    pack.readiness.band,
                    'readiness-decision'
                )}
                ${renderMetricCard(
                    'Manifest',
                    String(pack.manifest.summary.all),
                    `${pack.manifest.summary.surfaces} surface tags`,
                    'ready',
                    'manifest-count'
                )}
                ${renderMetricCard(
                    'Wiring',
                    `${pack.wiringAudit.summary.pass} pass`,
                    `${pack.wiringAudit.summary.partial} partial · ${pack.wiringAudit.summary.missing} missing`,
                    pack.wiringAudit.summary.missing > 0 ? 'warning' : 'ready',
                    'wiring-missing'
                )}
                ${renderMetricCard(
                    'Contracts',
                    `${pack.surfaceContractAudit.summary.pass} pass`,
                    `${pack.surfaceContractAudit.summary.watch} watch · ${pack.surfaceContractAudit.summary.missing} missing`,
                    pack.surfaceContractAudit.summary.watch > 0 ||
                        pack.surfaceContractAudit.summary.missing > 0
                        ? 'warning'
                        : 'ready',
                    'contract-watch'
                )}
                ${renderMetricCard(
                    'Registry',
                    String(pack.summary.registryMissingCount),
                    'missing rows',
                    pack.summary.registryMissingCount > 0 ? 'warning' : 'ready',
                    'registry-missing'
                )}
                ${renderMetricCard(
                    'Inventory',
                    String(pack.summary.inventoryPartialCount),
                    'partial rows',
                    pack.summary.inventoryPartialCount > 0
                        ? 'warning'
                        : 'ready',
                    'inventory-partial'
                )}
                ${renderMetricCard(
                    'Gaps',
                    String(pack.finalGaps.summary.open),
                    `${pack.finalGaps.summary.high} high`,
                    pack.finalGaps.summary.open > 0 ? 'warning' : 'ready',
                    'gap-open'
                )}
                ${renderMetricCard(
                    'Closeout',
                    String(pack.closeoutPlan.summary.all),
                    `${pack.closeoutPlan.summary.p1} P1`,
                    pack.closeoutPlan.summary.p1 > 0 ? 'warning' : 'ready',
                    'closeout-count'
                )}
            </div>
            <div class="turnero-release-final-diagnostic-execution-console__body">
                ${renderRowList('Closeout plan', pack.closeoutPlan.rows, {
                    limit: 4,
                    emptyLabel: 'No open closeout items',
                    itemTone: (row) =>
                        row.priority === 'P1' ? 'alert' : row.priority,
                })}
                ${renderRowList('Open gaps', pack.finalGaps.rows, {
                    limit: 4,
                    emptyLabel: 'No open gaps',
                    itemTone: (row) => row.severity || row.state || 'ready',
                })}
            </div>
            <pre class="turnero-release-final-diagnostic-execution-console__brief" data-role="closeout-brief">${escapeHtml(
                pack.briefMarkdown
            )}</pre>
        </article>
    `;
}

export function mountTurneroReleaseFinalDiagnosticExecutionConsole(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!isDomElement(host)) {
        return null;
    }

    const pack = buildTurneroReleaseFinalDiagnosticExecutionConsolePack(input);
    const root = document.createElement('section');
    root.id = 'turneroReleaseFinalDiagnosticExecutionConsole';
    root.className = 'turnero-release-final-diagnostic-execution-console';
    root.dataset.turneroReleaseFinalDiagnosticExecutionConsole = 'mounted';
    root.dataset.turneroReleaseFinalDiagnosticReadiness = pack.readiness.band;
    root.dataset.turneroReleaseFinalDiagnosticDecision =
        pack.readiness.decision;
    root.dataset.turneroReleaseFinalDiagnosticClinicId = pack.context.clinicId;
    root.innerHTML =
        renderTurneroReleaseFinalDiagnosticExecutionConsoleHtml(pack);

    if (typeof host.replaceChildren === 'function') {
        host.replaceChildren(root);
    } else {
        host.innerHTML = '';
        host.appendChild(root);
    }

    host.dataset.turneroReleaseFinalDiagnosticExecutionConsole = 'mounted';
    host.dataset.turneroReleaseFinalDiagnosticReadiness = pack.readiness.band;

    const handleClick = async (event) => {
        const action = event.target?.getAttribute?.('data-action');
        if (!action) {
            return;
        }

        if (action === 'copy-closeout-brief') {
            await copyToClipboardSafe(pack.briefMarkdown);
            return;
        }

        if (action === 'download-final-diagnostic-pack') {
            downloadJsonSnapshot(pack.downloadFileName, pack);
        }
    };

    if (host.__turneroReleaseFinalDiagnosticExecutionConsoleClickHandler) {
        host.removeEventListener(
            'click',
            host.__turneroReleaseFinalDiagnosticExecutionConsoleClickHandler
        );
    }

    host.__turneroReleaseFinalDiagnosticExecutionConsoleClickHandler =
        handleClick;
    host.addEventListener('click', handleClick);

    root.__turneroReleaseFinalDiagnosticExecutionConsolePack = pack;

    return {
        root,
        pack,
    };
}

export default mountTurneroReleaseFinalDiagnosticExecutionConsole;
