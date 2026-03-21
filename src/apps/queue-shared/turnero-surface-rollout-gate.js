import { asObject, toString } from './turnero-surface-helpers.js';

function normalizeBand(value, fallback = 'watch') {
    const normalized = toString(value, fallback).toLowerCase();
    if (['ready', 'watch', 'blocked'].includes(normalized)) {
        return normalized;
    }
    return fallback;
}

function normalizeRolloutState(value, fallback = 'watch') {
    const normalized = toString(value, fallback).toLowerCase();
    if (
        [
            'ready',
            'watch',
            'blocked',
            'pending',
            'aligned',
            'alert',
            'degraded',
        ].includes(normalized)
    ) {
        return normalized;
    }
    return fallback;
}

function isBlockedState(value) {
    return ['blocked', 'alert', 'degraded'].includes(
        normalizeRolloutState(value, 'watch')
    );
}

function isWatchState(value) {
    return ['watch', 'pending'].includes(normalizeRolloutState(value, 'watch'));
}

function isReadyState(value) {
    return ['ready', 'aligned'].includes(normalizeRolloutState(value, 'watch'));
}

function normalizeTone(band) {
    const normalized = normalizeBand(band);
    if (normalized === 'ready') {
        return 'ready';
    }
    if (normalized === 'blocked') {
        return 'alert';
    }
    return 'warning';
}

function buildIssues({
    checklist,
    contract,
    manifest,
    ledger,
    runtimeState,
    registryState,
    truth,
}) {
    const issues = [];
    const requiredFail = Number(checklist?.requiredFail || 0) || 0;
    const optionalFail = Number(checklist?.optionalFail || 0) || 0;

    if (requiredFail > 0) {
        issues.push(
            `${requiredFail} requisito${requiredFail === 1 ? '' : 's'} pendiente${requiredFail === 1 ? '' : 's'}`
        );
    }
    if (optionalFail > 0) {
        issues.push(
            `${optionalFail} recomendacion${optionalFail === 1 ? '' : 'es'} pendiente${optionalFail === 1 ? '' : 's'}`
        );
    }
    if (isBlockedState(contract?.state)) {
        issues.push('Contrato de superficie desalineado');
    }
    if (normalizeRolloutState(manifest?.state, 'watch') === 'pending') {
        issues.push(
            `Manifest pendiente para ${toString(manifest?.appKey || manifest?.expectedAppKey, 'surface')}`
        );
    } else if (isWatchState(manifest?.state)) {
        issues.push('Manifest parcial');
    }
    if (isBlockedState(ledger?.state)) {
        issues.push('Ledger con incidencias bloqueantes');
    } else if (isWatchState(ledger?.state)) {
        issues.push(
            `${Number(ledger?.openCount || 0) || 0} entrada${Number(ledger?.openCount || 0) === 1 ? '' : 's'} abierta${Number(ledger?.openCount || 0) === 1 ? '' : 's'}`
        );
    }
    if (isBlockedState(runtimeState?.state)) {
        issues.push('Runtime bloqueado');
    } else if (isWatchState(runtimeState?.state)) {
        issues.push('Runtime en observacion');
    }
    if (isWatchState(registryState)) {
        issues.push('Registry en observacion');
    }
    if (truth === 'watch') {
        issues.push('Truth en observacion');
    } else if (truth === 'pending') {
        issues.push('Truth pendiente');
    }

    return issues;
}

function resolveGateScore({
    checklist,
    contract,
    manifest,
    ledger,
    runtimeState,
    registryState,
    truth,
}) {
    let score = 100;
    const requiredFail = Number(checklist?.requiredFail || 0) || 0;
    const optionalFail = Number(checklist?.optionalFail || 0) || 0;
    const coverage = Number(checklist?.coverage || 0) || 0;

    if (requiredFail > 0) {
        score -= 55 + requiredFail * 8;
    }
    if (optionalFail > 0) {
        score -= 8 + optionalFail * 6;
    }
    if (coverage > 0 && coverage < 100) {
        score -= Math.max(2, Math.round((100 - coverage) * 0.3));
    }
    if (isBlockedState(contract?.state)) {
        score -= 18;
    }
    if (normalizeRolloutState(manifest?.state, 'watch') === 'pending') {
        score -= 10;
    } else if (isWatchState(manifest?.state)) {
        score -= 6;
    }
    if (isBlockedState(ledger?.state)) {
        score -= 20;
    } else if (isWatchState(ledger?.state)) {
        score -= 8;
    }
    if (isBlockedState(runtimeState?.state)) {
        score -= 18;
    } else if (isWatchState(runtimeState?.state)) {
        score -= 6;
    }
    if (isWatchState(registryState)) {
        score -= 6;
    }
    if (truth === 'blocked') {
        score -= 22;
    } else if (truth === 'watch') {
        score -= 8;
    } else if (truth === 'pending') {
        score -= 10;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
}

function resolveGateBand({
    checklist,
    contract,
    manifest,
    ledger,
    runtimeState,
    registryState,
    truth,
    score,
}) {
    const requiredFail = Number(checklist?.requiredFail || 0) || 0;
    const blocked =
        requiredFail > 0 ||
        truth === 'blocked' ||
        isBlockedState(contract?.state) ||
        isBlockedState(manifest?.state) ||
        isBlockedState(ledger?.state) ||
        isBlockedState(runtimeState?.state);

    if (blocked) {
        return 'blocked';
    }

    const ready =
        score >= 90 &&
        normalizeRolloutState(checklist?.state, 'watch') === 'ready' &&
        truth === 'aligned' &&
        isReadyState(contract?.state) &&
        isReadyState(manifest?.state) &&
        isReadyState(ledger?.state) &&
        isReadyState(runtimeState?.state) &&
        isReadyState(registryState);

    return ready ? 'ready' : 'watch';
}

function buildSummary({
    band,
    checklist,
    manifest,
    ledger,
    runtimeState,
    truth,
    surfaceLabel,
    clinicShortName,
    issues,
}) {
    const checklistPass = Number(checklist?.summary?.pass || 0) || 0;
    const checklistAll = Number(checklist?.summary?.all || 0) || 0;
    const manifestState = normalizeRolloutState(manifest?.state, 'watch');
    const ledgerState = normalizeRolloutState(ledger?.state, 'watch');
    const runtimeBand = normalizeRolloutState(runtimeState?.state, 'watch');
    const truthBand = truth || 'pending';

    if (band === 'ready') {
        return `${surfaceLabel} listo para ${clinicShortName || 'la clínica'}. Checklist ${checklistPass}/${checklistAll} y manifest ${manifestState}.`;
    }

    const issue = issues[0] || 'Se requieren más señales antes de avanzar.';
    const prefix = band === 'blocked' ? 'Bloqueado' : 'Observacion';

    return `${prefix} · ${surfaceLabel} · ${issue}. Checklist ${checklistPass}/${checklistAll}, manifest ${manifestState}, ledger ${ledgerState}, runtime ${runtimeBand}, truth ${truthBand}.`;
}

function buildDetail({
    snapshot,
    checklist,
    manifest,
    ledger,
    runtimeState,
    contract,
    issues,
}) {
    const parts = [
        `Visita ${toString(snapshot.visitDate, 'pendiente') || 'pendiente'}`,
        `Owner ${toString(snapshot.owner, 'pendiente') || 'pendiente'}`,
        `Asset ${toString(snapshot.assetTag, 'none') || 'none'}`,
        `Station ${toString(snapshot.stationLabel, 'pendiente') || 'pendiente'}`,
        `Install ${toString(snapshot.installMode, 'pendiente') || 'pendiente'}`,
        `Checklist ${Number(checklist?.summary?.pass || 0) || 0}/${Number(checklist?.summary?.all || 0) || 0}`,
        `Manifest ${toString(manifest?.state, 'watch')}`,
        `Ledger ${toString(ledger?.state, 'watch')} (${Number(ledger?.openCount || 0) || 0} abiertas)`,
        `Runtime ${toString(runtimeState?.state, 'watch')}`,
        `Contract ${toString(contract?.state, 'ready')}`,
    ];

    if (issues.length > 0) {
        parts.push(`Pendientes ${issues.join(' · ')}`);
    }

    return parts.join(' · ');
}

export function buildTurneroSurfaceRolloutGate(input = {}) {
    const snapshot = asObject(input.snapshot);
    const checklist = asObject(input.checklist || snapshot.checklist);
    const manifest = asObject(input.manifest || snapshot.manifest);
    const ledger = asObject(input.ledger || snapshot.ledger);
    const runtimeState = asObject(input.runtimeState || snapshot.runtimeState);
    const contract = asObject(input.contract || snapshot.contract);
    const registryState = toString(
        input.registryState || snapshot.registryState,
        'watch'
    );
    const truth = normalizeRolloutState(
        input.truth || snapshot.truth,
        'pending'
    );
    const issues = buildIssues({
        checklist,
        contract,
        manifest,
        ledger,
        runtimeState,
        registryState,
        truth,
    });
    const score = resolveGateScore({
        checklist,
        contract,
        manifest,
        ledger,
        runtimeState,
        registryState,
        truth,
    });
    const band = resolveGateBand({
        checklist,
        contract,
        manifest,
        ledger,
        runtimeState,
        registryState,
        truth,
        score,
    });
    const checklistPass = Number(checklist?.summary?.pass || 0) || 0;
    const checklistAll = Number(checklist?.summary?.all || 0) || 0;
    const checklistFail = Number(checklist?.summary?.fail || 0) || 0;

    return {
        surfaceKey: toString(snapshot.surfaceKey, 'operator-turnos'),
        surfaceId: toString(
            snapshot.surfaceId || snapshot.surfaceKey,
            'operator'
        ),
        surfaceLabel: toString(
            snapshot.surfaceLabel,
            snapshot.surfaceKey || 'surface'
        ),
        band,
        state: band,
        tone: normalizeTone(band),
        score,
        decision:
            band === 'ready'
                ? 'proceed-rollout'
                : band === 'blocked'
                  ? 'hold-rollout'
                  : 'review-rollout',
        title:
            band === 'ready'
                ? 'Rollout listo'
                : band === 'blocked'
                  ? 'Rollout bloqueado'
                  : 'Rollout en observacion',
        summary: buildSummary({
            band,
            checklist,
            manifest,
            ledger,
            runtimeState,
            truth,
            surfaceLabel: toString(
                snapshot.surfaceLabel,
                snapshot.surfaceKey || 'surface'
            ),
            clinicShortName: toString(snapshot.clinicShortName, ''),
            issues,
        }),
        detail: buildDetail({
            snapshot,
            checklist,
            manifest,
            ledger,
            runtimeState,
            contract,
            issues,
        }),
        checklistPass,
        checklistAll,
        checklistFail,
        checklistCoverage: Number(checklist?.coverage || 0) || 0,
        requiredFail: Number(checklist?.requiredFail || 0) || 0,
        optionalFail: Number(checklist?.optionalFail || 0) || 0,
        manifestState: normalizeBand(manifest?.state, 'watch'),
        manifestAppKey: toString(
            manifest?.appKey || manifest?.expectedAppKey,
            ''
        ),
        ledgerState: normalizeBand(ledger?.state, 'watch'),
        runtimeState: normalizeBand(runtimeState?.state, 'watch'),
        registryState: normalizeBand(registryState, 'watch'),
        truth,
        issues,
        primaryIssue: issues[0] || '',
        badge: `${band} · ${score}`,
        generatedAt: new Date().toISOString(),
    };
}
