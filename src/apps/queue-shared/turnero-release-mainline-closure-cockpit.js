import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { escapeHtml, formatDateTime } from '../admin-v3/shared/ui/render.js';

const DEFAULT_DOWNLOAD_FILE_NAME = 'turnero-release-mainline-closure-pack.json';
const STORAGE_KEY = 'turnero-release-owner-closeout-ledger:v1';

const DEFAULT_TRUTH_ITEMS = Object.freeze([
    {
        key: 'admin-queue',
        label: 'Admin Queue',
        owner: 'ops',
        surface: 'admin-queue',
        kind: 'surface',
    },
    {
        key: 'operator-turnos',
        label: 'Operator Turnos',
        owner: 'ops',
        surface: 'operator-turnos',
        kind: 'surface',
    },
    {
        key: 'kiosco-turnos',
        label: 'Kiosco Turnos',
        owner: 'frontdesk',
        surface: 'kiosco-turnos',
        kind: 'surface',
    },
    {
        key: 'sala-turnos',
        label: 'Sala Turnos',
        owner: 'display',
        surface: 'sala-turnos',
        kind: 'surface',
    },
    {
        key: 'remote-health',
        label: 'Remote Health',
        owner: 'infra',
        surface: 'admin-queue',
        kind: 'integration',
    },
    {
        key: 'public-sync',
        label: 'Public Sync',
        owner: 'web',
        surface: 'admin-queue',
        kind: 'integration',
    },
    {
        key: 'figo-bridge',
        label: 'Figo Bridge',
        owner: 'backend',
        surface: 'admin-queue',
        kind: 'integration',
    },
    {
        key: 'final-diagnostic',
        label: 'Final Diagnostic Readiness',
        owner: 'program',
        surface: 'admin-queue',
        kind: 'diagnostic',
    },
]);

const DEFAULT_SURFACES = Object.freeze([
    { id: 'admin-queue', label: 'Admin Queue' },
    { id: 'operator-turnos', label: 'Operator Turnos' },
    { id: 'kiosco-turnos', label: 'Kiosco Turnos' },
    { id: 'sala-turnos', label: 'Sala Turnos' },
]);

const DEFAULT_RUNTIME_ROWS = Object.freeze([
    {
        key: 'admin-queue',
        surface: 'admin-queue',
        present: true,
        fingerprint: 'runtime-admin',
    },
    {
        key: 'operator-turnos',
        surface: 'operator-turnos',
        present: true,
        fingerprint: 'runtime-operator',
    },
    {
        key: 'kiosco-turnos',
        surface: 'kiosco-turnos',
        present: true,
        fingerprint: 'runtime-kiosk',
    },
    {
        key: 'sala-turnos',
        surface: 'sala-turnos',
        present: true,
        fingerprint: 'runtime-display',
    },
    {
        key: 'remote-health',
        surface: 'admin-queue',
        present: true,
        fingerprint: 'runtime-health',
    },
    {
        key: 'public-sync',
        surface: 'admin-queue',
        present: true,
        fingerprint: 'runtime-public-sync',
    },
    {
        key: 'figo-bridge',
        surface: 'admin-queue',
        present: true,
        fingerprint: 'runtime-figo',
    },
    {
        key: 'final-diagnostic',
        surface: 'admin-queue',
        present: true,
        fingerprint: 'runtime-diagnostic',
    },
]);

const DEFAULT_AUDIT_ROWS = Object.freeze([
    { surfaceId: 'admin-queue', state: 'strong' },
    { surfaceId: 'operator-turnos', state: 'watch' },
    { surfaceId: 'kiosco-turnos', state: 'watch' },
    { surfaceId: 'sala-turnos', state: 'watch' },
    { key: 'remote-health', state: 'pass' },
    { key: 'public-sync', state: 'watch' },
    { key: 'figo-bridge', state: 'pass' },
    { key: 'final-diagnostic', state: 'watch' },
]);

const MEMORY_STORAGE = new Map();

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
    return toText(value, 'regional');
}

function normalizeRows(value, fallbackPrefix = 'row') {
    return toArray(value).map((entry, index) => {
        const item = asObject(entry);
        const fallbackId = `${fallbackPrefix}-${index + 1}`;
        const id = toText(item.id || item.key, fallbackId);
        return {
            ...item,
            id,
            key: toText(item.key, id),
        };
    });
}

function getStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_error) {
        return null;
    }
}

function readLedgerState() {
    const storage = getStorage();
    if (storage) {
        try {
            return JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
        } catch (_error) {
            return {};
        }
    }

    return MEMORY_STORAGE.get(STORAGE_KEY) || {};
}

function writeLedgerState(data) {
    const storage = getStorage();
    if (storage) {
        storage.setItem(STORAGE_KEY, JSON.stringify(data));
        return;
    }

    MEMORY_STORAGE.set(STORAGE_KEY, data);
}

function resolveClinicProfile(input = {}) {
    const currentSnapshot = asObject(
        input.currentSnapshot ||
            input.snapshot ||
            input.releaseEvidenceBundle ||
            {}
    );

    return asObject(
        input.clinicProfile ||
            input.turneroClinicProfile ||
            currentSnapshot.turneroClinicProfile ||
            currentSnapshot.clinicProfile ||
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
    return normalizeScope(
        input.region ||
            currentSnapshot.region ||
            clinicProfile.region ||
            clinicProfile.address?.region ||
            'regional'
    );
}

function resolveScope(input = {}, currentSnapshot = {}, clinicProfile = {}) {
    return normalizeScope(
        input.scope ||
            input.region ||
            currentSnapshot.scope ||
            currentSnapshot.region ||
            clinicProfile.region ||
            'regional'
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

function resolveManifestRows(input = {}) {
    const source =
        input.manifestRows || input.manifest?.rows || input.items || [];
    if (Array.isArray(source) && source.length > 0) {
        return source;
    }

    return DEFAULT_TRUTH_ITEMS.map((item) => ({ ...item }));
}

function resolveRuntimeRows(input = {}) {
    const source = input.runtimeRows || input.runtime?.rows || [];
    if (Array.isArray(source) && source.length > 0) {
        return source;
    }

    return DEFAULT_RUNTIME_ROWS.map((item) => ({ ...item }));
}

function resolveAuditRows(input = {}) {
    const source =
        input.auditRows || input.audit?.rows || input.surfaceAuditRows || [];
    if (Array.isArray(source) && source.length > 0) {
        return source;
    }

    return DEFAULT_AUDIT_ROWS.map((item) => ({ ...item }));
}

function buildMainlineClosureSnapshot(input = {}, ledgerRows = []) {
    const currentSnapshot = asObject(
        input.currentSnapshot ||
            input.snapshot ||
            input.releaseEvidenceBundle ||
            {}
    );
    const clinicProfile = resolveClinicProfile(input);
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
    const manifest = buildTurneroReleaseFinalTruthManifest({
        items: resolveManifestRows(input),
    });
    const evidence = buildTurneroReleaseCloseoutEvidencePack({
        manifestRows: manifest.rows,
        runtimeRows: resolveRuntimeRows(input),
        auditRows: resolveAuditRows(input),
    });
    const closeoutLedgerStore = createTurneroReleaseOwnerCloseoutLedger(scope);
    const closeoutLedger =
        ledgerRows.length > 0 ? ledgerRows : closeoutLedgerStore.list();
    const surfaces = toArray(input.surfaces).length
        ? normalizeRows(input.surfaces, 'surface').map((surface, index) => ({
              id: toText(surface.id, `surface-${index + 1}`),
              label: toText(surface.label, `Surface ${index + 1}`),
          }))
        : DEFAULT_SURFACES.map((surface) => ({ ...surface }));
    const handoff = buildTurneroReleaseSurfaceHandoffAudit({
        surfaces,
        closeoutRows: closeoutLedger,
        evidenceRows: evidence.rows,
    });
    const closurePlan = buildTurneroReleaseMainlineClosurePlan({
        ledgerRows: closeoutLedger,
        blockedSurfaces: handoff.rows.filter((row) => row.state !== 'ready'),
    });
    const readout = buildTurneroReleaseDiagnosticReadoutScore({
        evidenceSummary: evidence.summary,
        handoffSummary: handoff.summary,
        ledgerRows: closeoutLedger,
        closureRows: closurePlan.rows,
    });
    const finalHandoff = buildTurneroReleaseFinalDiagnosticHandoff({
        scope,
        region,
        clinicId,
        clinicLabel,
        clinicShortName,
        evidence,
        handoff,
        closeoutLedger,
        closurePlan,
        readout,
    });
    const generatedAt = new Date().toISOString();
    const downloadFileName = DEFAULT_DOWNLOAD_FILE_NAME;
    const snapshot = {
        generatedAt,
        scope,
        region,
        clinicId,
        clinicLabel,
        clinicShortName,
        clinicProfile,
        manifest,
        evidence,
        closeoutLedger: closeoutLedger.map((row) => ({ ...row })),
        handoff,
        closurePlan,
        readout,
        finalHandoff,
        downloadFileName,
        snapshotFileName: downloadFileName,
        clipboardSummary: finalHandoff.markdown,
    };

    return {
        ...snapshot,
        clipboardSummary: finalHandoff.markdown,
        downloadFileName,
        snapshotFileName: downloadFileName,
        snapshot,
        closeoutLedgerStore,
    };
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

function renderListItem(row, detail) {
    return `
        <li data-state="${escapeHtml(row.state || row.priority || 'ready')}">
            <strong>${escapeHtml(row.label || row.title || row.key || 'Item')}</strong>
            <span>${escapeHtml(detail)}</span>
        </li>
    `;
}

function renderPreviewPanel(title, count, rows, formatter, emptyLabel) {
    const previewRows = toArray(rows).slice(0, 4);
    return `
        <section class="queue-app-card__panel">
            <header class="queue-app-card__panel-head">
                <p class="queue-app-card__eyebrow">${escapeHtml(title)}</p>
                <strong>${escapeHtml(String(count))}</strong>
            </header>
            <ul class="queue-app-card__list">
                ${
                    previewRows.length > 0
                        ? previewRows
                              .map((row) => renderListItem(row, formatter(row)))
                              .join('')
                        : `<li data-state="ready">${escapeHtml(
                              emptyLabel || 'No items'
                          )}</li>`
                }
            </ul>
        </section>
    `;
}

export function buildTurneroReleaseFinalTruthManifest(input = {}) {
    const items =
        Array.isArray(input.items) && input.items.length > 0
            ? input.items
            : DEFAULT_TRUTH_ITEMS;
    const rows = items.map((item, index) => ({
        id: toText(item.id, `truth-${index + 1}`),
        key: toText(item.key, `truth-${index + 1}`),
        label: toText(item.label, `Truth Item ${index + 1}`),
        owner: toText(item.owner, 'ops'),
        surface: toText(item.surface, 'admin-queue'),
        kind: toText(item.kind, 'general'),
    }));

    return {
        rows,
        summary: {
            all: rows.length,
            surfaces: rows.filter((row) => row.kind === 'surface').length,
            integrations: rows.filter((row) => row.kind === 'integration')
                .length,
            diagnostics: rows.filter((row) => row.kind === 'diagnostic').length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export function buildTurneroReleaseCloseoutEvidencePack(input = {}) {
    const manifestRows = resolveManifestRows(input);
    const runtimeRows = resolveRuntimeRows(input);
    const auditRows = resolveAuditRows(input);
    const rows = manifestRows.map((row, index) => {
        const runtime =
            runtimeRows.find(
                (item) =>
                    toText(item.key) === row.key ||
                    toText(item.surface) === row.surface
            ) || {};
        const audit =
            auditRows.find(
                (item) =>
                    toText(item.surfaceId || item.surface) === row.surface ||
                    toText(item.key) === row.key
            ) || {};
        const evidenceState =
            runtime.present &&
            ['strong', 'pass'].includes(toText(audit.state).toLowerCase())
                ? 'complete'
                : runtime.present || toText(audit.state)
                  ? 'partial'
                  : 'missing';

        return {
            id: toText(row.id, `evidence-${index + 1}`),
            key: row.key,
            label: row.label,
            owner: row.owner,
            surface: row.surface,
            kind: row.kind,
            runtimeFingerprint: toText(
                runtime.fingerprint || runtime.commitRef || runtime.hash || ''
            ),
            auditState: toText(audit.state || ''),
            evidenceState,
        };
    });

    return {
        rows,
        summary: {
            all: rows.length,
            complete: rows.filter((row) => row.evidenceState === 'complete')
                .length,
            partial: rows.filter((row) => row.evidenceState === 'partial')
                .length,
            missing: rows.filter((row) => row.evidenceState === 'missing')
                .length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export function createTurneroReleaseOwnerCloseoutLedger(scope = 'global') {
    const scopeKey = normalizeScope(scope);

    function normalizeLedgerRow(entry = {}, fallbackIndex = 0) {
        return {
            id: toText(entry.id, `closeout-${Date.now()}-${fallbackIndex + 1}`),
            owner: toText(entry.owner, 'ops'),
            title: toText(entry.title, 'Closeout item'),
            surface: toText(entry.surface, 'admin-queue'),
            status: toText(entry.status, 'open').toLowerCase(),
            note: toText(entry.note, ''),
            createdAt: toText(entry.createdAt, new Date().toISOString()),
            updatedAt: toText(entry.updatedAt, new Date().toISOString()),
        };
    }

    return {
        scope: scopeKey,
        list() {
            const data = readLedgerState();
            return Array.isArray(data[scopeKey])
                ? data[scopeKey].map((entry, index) =>
                      normalizeLedgerRow(entry, index)
                  )
                : [];
        },
        add(entry = {}) {
            const data = readLedgerState();
            const rows = Array.isArray(data[scopeKey]) ? data[scopeKey] : [];
            const next = normalizeLedgerRow(entry, rows.length);
            data[scopeKey] = [next, ...rows].slice(0, 300);
            writeLedgerState(data);
            return next;
        },
        clear() {
            const data = readLedgerState();
            delete data[scopeKey];
            writeLedgerState(data);
        },
    };
}

export function buildTurneroReleaseSurfaceHandoffAudit(input = {}) {
    const surfaces = toArray(input.surfaces).length
        ? normalizeRows(input.surfaces, 'surface').map((surface, index) => ({
              id: toText(surface.id, `surface-${index + 1}`),
              label: toText(surface.label, `Surface ${index + 1}`),
          }))
        : DEFAULT_SURFACES.map((surface) => ({ ...surface }));
    const closeoutRows = toArray(input.closeoutRows || input.ledgerRows);
    const evidenceRows = toArray(input.evidenceRows || input.evidence?.rows);
    const rows = surfaces.map((surface, index) => {
        const surfaceId = toText(surface.id, `surface-${index + 1}`);
        const surfaceCloseouts = closeoutRows.filter(
            (item) => toText(item.surface) === surfaceId
        );
        const openCloseouts = surfaceCloseouts.filter(
            (item) => toText(item.status, 'open').toLowerCase() !== 'closed'
        ).length;
        const surfaceEvidence = evidenceRows.filter(
            (item) => toText(item.surface) === surfaceId
        );
        const complete = surfaceEvidence.filter(
            (item) => item.evidenceState === 'complete'
        ).length;
        const totalEvidence = surfaceEvidence.length;
        const evidencePct =
            totalEvidence > 0
                ? Number(((complete / totalEvidence) * 100).toFixed(1))
                : 0;
        const state =
            openCloseouts === 0 && evidencePct >= 85
                ? 'ready'
                : openCloseouts <= 2 && evidencePct >= 60
                  ? 'watch'
                  : 'blocked';

        return {
            surfaceId,
            label: toText(surface.label, `Surface ${index + 1}`),
            closeoutOpen: openCloseouts,
            evidencePct,
            evidenceComplete: complete,
            evidenceTotal: totalEvidence,
            state,
        };
    });

    return {
        rows,
        summary: {
            all: rows.length,
            ready: rows.filter((row) => row.state === 'ready').length,
            watch: rows.filter((row) => row.state === 'watch').length,
            blocked: rows.filter((row) => row.state === 'blocked').length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export function buildTurneroReleaseMainlineClosurePlan(input = {}) {
    const ledgerRows = toArray(input.ledgerRows || input.closeoutLedger);
    const blockedSurfaces = toArray(input.blockedSurfaces);
    const planRows = [
        ...blockedSurfaces.map((row, index) => ({
            id: `surface-plan-${index + 1}`,
            owner: 'ops',
            title: `Resolve handoff for ${row.label || row.surfaceId}`,
            priority: row.state === 'blocked' ? 'P1' : 'P2',
            nextAction: 'Close pending items and revalidate surface',
            surface: row.surfaceId || 'admin-queue',
            state: row.state || 'blocked',
        })),
        ...ledgerRows
            .filter(
                (item) => toText(item.status, 'open').toLowerCase() !== 'closed'
            )
            .map((item, index) => ({
                id: `ledger-plan-${index + 1}`,
                owner: toText(item.owner, 'ops'),
                title: toText(item.title, 'Closeout item'),
                priority: 'P2',
                nextAction: toText(
                    item.note || 'Close item and update evidence',
                    'Close item and update evidence'
                ),
                surface: toText(item.surface, 'admin-queue'),
                state: toText(item.status, 'open'),
            })),
    ];
    const priorityRank = { P1: 0, P2: 1, P3: 2 };
    const rows = planRows.sort(
        (left, right) =>
            (priorityRank[left.priority] || 9) -
                (priorityRank[right.priority] || 9) ||
            left.title.localeCompare(right.title)
    );

    return {
        rows,
        byOwner: rows.reduce((acc, row) => {
            const owner = row.owner || 'ops';
            acc[owner] = acc[owner] || [];
            acc[owner].push(row);
            return acc;
        }, {}),
        summary: {
            all: rows.length,
            p1: rows.filter((row) => row.priority === 'P1').length,
            p2: rows.filter((row) => row.priority === 'P2').length,
            p3: rows.filter((row) => row.priority === 'P3').length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export function buildTurneroReleaseDiagnosticReadoutScore(input = {}) {
    const evidenceSummary = asObject(
        input.evidenceSummary || input.evidence?.summary
    );
    const handoffSummary = asObject(
        input.handoffSummary || input.handoff?.summary
    );
    const ledgerRows = toArray(input.ledgerRows || input.closeoutLedger);
    const closureRows = toArray(input.closureRows || input.closurePlan?.rows);
    const evidencePct =
        Number(evidenceSummary.all || 0) > 0
            ? (Number(evidenceSummary.complete || 0) /
                  Number(evidenceSummary.all || 0)) *
              100
            : 0;
    const handoffPct =
        Number(handoffSummary.all || 0) > 0
            ? (Number(handoffSummary.ready || 0) /
                  Number(handoffSummary.all || 0)) *
              100
            : 0;
    const openLedger = ledgerRows.filter(
        (item) => toText(item.status, 'open').toLowerCase() !== 'closed'
    ).length;
    const planPressure = closureRows.filter(
        (item) => item.priority === 'P1'
    ).length;

    let score = 0;
    score += evidencePct * 0.4;
    score += handoffPct * 0.3;
    score += Math.max(0, 100 - openLedger * 5) * 0.15;
    score += Math.max(0, 100 - planPressure * 10) * 0.15;
    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    const band =
        score >= 90
            ? 'ready'
            : score >= 75
              ? 'near-ready'
              : score >= 60
                ? 'review'
                : 'blocked';

    return {
        score,
        band,
        decision:
            band === 'ready'
                ? 'run-honest-diagnostic'
                : band === 'near-ready'
                  ? 'close-small-gaps'
                  : 'closeout-first',
        evidencePct: Number(evidencePct.toFixed(1)),
        handoffPct: Number(handoffPct.toFixed(1)),
        openLedger,
        planPressure,
        generatedAt: new Date().toISOString(),
    };
}

export function buildTurneroReleaseFinalDiagnosticHandoff(pack = {}) {
    const topPlanRows = toArray(pack.closurePlan?.rows).slice(0, 4);
    const openLedger = toArray(pack.closeoutLedger).filter(
        (item) => toText(item.status, 'open').toLowerCase() !== 'closed'
    ).length;

    return {
        markdown: [
            '# Mainline Closure Cockpit',
            '',
            `Scope: ${pack.scope || 'regional'}`,
            `Region: ${pack.region || 'regional'}`,
            `Clinic: ${pack.clinicLabel || pack.clinicShortName || pack.clinicId || 'n/a'}`,
            `Closure score: ${pack.readout?.score ?? 0} (${pack.readout?.band || 'n/a'})`,
            `Decision: ${pack.readout?.decision || 'review'}`,
            `Complete evidence: ${pack.evidence?.summary?.complete ?? 0}/${pack.evidence?.summary?.all ?? 0}`,
            `Ready surfaces: ${pack.handoff?.summary?.ready ?? 0}/${pack.handoff?.summary?.all ?? 0}`,
            `Open closeout items: ${openLedger}`,
            `P1 closure actions: ${pack.closurePlan?.summary?.p1 ?? 0}`,
            '',
            '## Closeout plan',
            ...(topPlanRows.length > 0
                ? topPlanRows.map(
                      (row) =>
                          `- [${row.priority}] ${row.title} · ${row.nextAction}`
                  )
                : ['- No open closeout items.']),
            '',
            `Generated at: ${formatDateTime(pack.generatedAt || new Date().toISOString())}`,
        ].join('\n'),
        generatedAt: new Date().toISOString(),
    };
}

function renderMainlineClosureCockpitHtml(pack) {
    const manifestRows = toArray(pack.manifest?.rows);
    const evidenceRows = toArray(pack.evidence?.rows);
    const handoffRows = toArray(pack.handoff?.rows);
    const planRows = toArray(pack.closurePlan?.rows);
    const openLedgerRows = toArray(pack.closeoutLedger).filter(
        (item) => toText(item.status, 'open').toLowerCase() !== 'closed'
    );

    return `
        <article class="queue-app-card turnero-release-mainline-closure-cockpit__card" data-state="${escapeHtml(
            pack.readout.band
        )}">
            <header class="turnero-release-mainline-closure-cockpit__header">
                <div>
                    <p class="queue-app-card__eyebrow">Release closeout</p>
                    <h3>Mainline Closure Cockpit</h3>
                    <p>
                        Final closeout slice for the admin queue before the
                        honest diagnosis handoff.
                    </p>
                    <p class="turnero-release-mainline-closure-cockpit__meta">
                        ${escapeHtml(pack.clinicLabel || pack.region || 'regional')}
                        · ${escapeHtml(formatDateTime(pack.generatedAt))}
                    </p>
                </div>
                <div class="turnero-release-mainline-closure-cockpit__actions">
                    <button type="button" data-action="copy-closure-brief">
                        Copy closure brief
                    </button>
                    <button type="button" data-action="download-closure-pack">
                        Download closure JSON
                    </button>
                </div>
            </header>

            <div class="turnero-release-mainline-closure-cockpit__metrics">
                ${renderMetric(
                    'Closure score',
                    String(pack.readout.score),
                    pack.readout.band,
                    pack.readout.band,
                    'score'
                )}
                ${renderMetric(
                    'Decision',
                    pack.readout.decision,
                    'Closure gate',
                    pack.readout.band,
                    'decision'
                )}
                ${renderMetric(
                    'Complete evidence',
                    `${pack.evidence.summary.complete}/${pack.evidence.summary.all}`,
                    `${pack.evidence.summary.partial} partial`,
                    pack.evidence.summary.missing > 0 ? 'warning' : 'ready',
                    'complete-evidence'
                )}
                ${renderMetric(
                    'Ready surfaces',
                    `${pack.handoff.summary.ready}/${pack.handoff.summary.all}`,
                    `${pack.handoff.summary.watch} watch`,
                    pack.handoff.summary.blocked > 0 ? 'warning' : 'ready',
                    'ready-surfaces'
                )}
                ${renderMetric(
                    'Open closeout',
                    String(openLedgerRows.length),
                    `${pack.closurePlan.summary.p1} P1`,
                    openLedgerRows.length > 0 ? 'warning' : 'ready',
                    'open-count'
                )}
                ${renderMetric(
                    'P1 actions',
                    String(pack.closurePlan.summary.p1),
                    `${pack.closurePlan.summary.all} total`,
                    pack.closurePlan.summary.p1 > 0 ? 'warning' : 'ready',
                    'p1-actions'
                )}
            </div>

            <div class="turnero-release-mainline-closure-cockpit__body">
                ${renderPreviewPanel(
                    'Manifest',
                    manifestRows.length,
                    manifestRows,
                    (row) => `${row.owner} · ${row.surface} · ${row.kind}`,
                    'No manifest rows'
                )}
                ${renderPreviewPanel(
                    'Evidence',
                    evidenceRows.length,
                    evidenceRows,
                    (row) =>
                        `${row.evidenceState} · ${row.surface}${row.runtimeFingerprint ? ` · ${row.runtimeFingerprint}` : ''}`,
                    'No evidence rows'
                )}
                ${renderPreviewPanel(
                    'Handoff',
                    handoffRows.length,
                    handoffRows,
                    (row) =>
                        `${row.state} · ${row.evidencePct}% · ${row.closeoutOpen} open`,
                    'No handoff rows'
                )}
                ${renderPreviewPanel(
                    'Closure plan',
                    planRows.length,
                    planRows,
                    (row) => `${row.priority} · ${row.nextAction}`,
                    'No closeout plan'
                )}
            </div>

            <section class="turnero-release-mainline-closure-cockpit__ledger-panel">
                <div class="turnero-release-mainline-closure-cockpit__ledger-head">
                    <p class="queue-app-card__eyebrow">Closeout ledger</p>
                    <strong data-role="open-count">${escapeHtml(
                        String(openLedgerRows.length)
                    )}</strong>
                </div>
                <div class="turnero-release-mainline-closure-cockpit__ledger-form">
                    <input data-field="closeout-title" placeholder="Closeout title" />
                    <input data-field="closeout-owner" placeholder="Owner" />
                    <input data-field="closeout-surface" placeholder="Surface" />
                    <button type="button" data-action="add-closeout-item">
                        Add closeout item
                    </button>
                </div>
                ${
                    openLedgerRows.length > 0
                        ? `<ul class="queue-app-card__list turnero-release-mainline-closure-cockpit__ledger-list">${openLedgerRows
                              .slice(0, 4)
                              .map((row) =>
                                  renderListItem(
                                      row,
                                      `${row.owner} · ${row.surface} · ${row.status}`
                                  )
                              )
                              .join('')}</ul>`
                        : '<p class="turnero-release-mainline-closure-cockpit__empty">No open closeout items</p>'
                }
            </section>

            <pre class="turnero-release-mainline-closure-cockpit__brief" data-role="closure-brief">${escapeHtml(
                pack.finalHandoff.markdown
            )}</pre>
        </article>
    `;
}

export function mountTurneroReleaseMainlineClosureCockpit(target, input = {}) {
    const host = resolveTarget(target);
    if (!isDomElement(host)) {
        return null;
    }

    const scope = resolveScope(
        input,
        asObject(
            input.currentSnapshot ||
                input.snapshot ||
                input.releaseEvidenceBundle ||
                {}
        ),
        resolveClinicProfile(input)
    );
    const closeoutLedgerStore = createTurneroReleaseOwnerCloseoutLedger(scope);
    let pack = buildMainlineClosureSnapshot(input, closeoutLedgerStore.list());
    const result = {
        root: null,
        pack,
        recompute: () => {},
    };
    let root = null;

    const render = () => {
        pack = buildMainlineClosureSnapshot(input, closeoutLedgerStore.list());
        result.pack = pack;

        if (!root) {
            root = document.createElement('section');
            root.id = 'turneroReleaseMainlineClosureCockpit';
            root.className = 'turnero-release-mainline-closure-cockpit';
            root.dataset.turneroReleaseMainlineClosureCockpit = 'mounted';
            root.addEventListener('click', async (event) => {
                const actionElement =
                    event.target?.closest?.('[data-action]') || event.target;
                const action = actionElement?.getAttribute?.('data-action');
                if (!action) {
                    return;
                }

                if (action === 'copy-closure-brief') {
                    await copyToClipboardSafe(pack.finalHandoff.markdown);
                    return;
                }

                if (action === 'download-closure-pack') {
                    downloadJsonSnapshot(pack.downloadFileName, pack.snapshot);
                    return;
                }

                if (action === 'add-closeout-item') {
                    const title =
                        root.querySelector('[data-field="closeout-title"]')
                            ?.value || '';
                    const owner =
                        root.querySelector('[data-field="closeout-owner"]')
                            ?.value || '';
                    const surface =
                        root.querySelector('[data-field="closeout-surface"]')
                            ?.value || '';

                    if (!title.trim()) {
                        return;
                    }

                    closeoutLedgerStore.add({
                        title,
                        owner: owner || 'ops',
                        surface: surface || 'admin-queue',
                        status: 'open',
                        note: 'Pending closeout before final diagnostic handoff',
                    });
                    render();
                }
            });
        }

        root.innerHTML = renderMainlineClosureCockpitHtml(pack);
        root.dataset.turneroReleaseMainlineClosureCockpit = 'mounted';
        root.dataset.turneroReleaseMainlineClosureScope = pack.scope;
        root.dataset.turneroReleaseMainlineClosureRegion = pack.region;
        root.dataset.turneroReleaseMainlineClosureScore = String(
            pack.readout.score
        );
        root.dataset.turneroReleaseMainlineClosureBand = pack.readout.band;
        root.dataset.turneroReleaseMainlineClosureDecision =
            pack.readout.decision;
        root.dataset.turneroReleaseMainlineClosureOpenCount = String(
            toArray(pack.closeoutLedger).filter(
                (item) => toText(item.status, 'open').toLowerCase() !== 'closed'
            ).length
        );
        root.dataset.turneroReleaseMainlineClosureGeneratedAt =
            pack.generatedAt;

        const scoreNode = root.querySelector('[data-role="score"]');
        const decisionNode = root.querySelector('[data-role="decision"]');
        const openNode = root.querySelector('[data-role="open-count"]');
        const briefNode = root.querySelector('[data-role="closure-brief"]');
        if (scoreNode) {
            scoreNode.textContent = String(pack.readout.score);
        }
        if (decisionNode) {
            decisionNode.textContent = pack.readout.decision;
        }
        if (openNode) {
            openNode.textContent = String(
                toArray(pack.closeoutLedger).filter(
                    (item) =>
                        toText(item.status, 'open').toLowerCase() !== 'closed'
                ).length
            );
        }
        if (briefNode) {
            briefNode.textContent = pack.finalHandoff.markdown;
        }

        if (typeof host.replaceChildren === 'function') {
            host.replaceChildren(root);
        } else {
            host.innerHTML = '';
            host.appendChild(root);
        }

        host.dataset.turneroReleaseMainlineClosureCockpit = 'mounted';
        host.dataset.turneroReleaseMainlineClosureScope = pack.scope;
        host.dataset.turneroReleaseMainlineClosureRegion = pack.region;
        host.dataset.turneroReleaseMainlineClosureScore = String(
            pack.readout.score
        );
        host.dataset.turneroReleaseMainlineClosureBand = pack.readout.band;
        host.dataset.turneroReleaseMainlineClosureDecision =
            pack.readout.decision;

        result.root = root;
        return result;
    };

    result.recompute = render;
    return render();
}

export function renderTurneroReleaseMainlineClosureCockpit(target, input = {}) {
    return mountTurneroReleaseMainlineClosureCockpit(target, input);
}

export default mountTurneroReleaseMainlineClosureCockpit;
