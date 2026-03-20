import { getState } from '../../../../../core/store.js';
import {
    asObject,
    toArray,
    toText,
} from '../../../../../../../queue-shared/turnero-release-control-center.js';
import { mountTurneroReleaseFinalRepoDiagnosticHandoffPack } from '../../../../../../../queue-shared/turnero-release-final-repo-diagnostic-handoff-pack.js';

const DEFAULT_FINAL_REPO_EVIDENCE = Object.freeze([
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

const DEFAULT_FINAL_REPO_BLOCKERS = Object.freeze([
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

function resolveFinalRepoDiagnosticHandoffHost(mountNode) {
    if (mountNode) {
        return mountNode;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    return (
        document.getElementById('queueFinalRepoDiagnosticHandoffPackHost') ||
        document.querySelector(
            '[data-turnero-release-final-repo-diagnostic-handoff-pack]'
        )
    );
}

function pickArray(...candidates) {
    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length > 0) {
            return candidate;
        }
    }

    return null;
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

function resolveCurrentSnapshot(deps = {}, state = {}) {
    return asObject(
        deps.currentSnapshot ||
            state.turneroReleaseEvidenceBundle ||
            state.turneroReleaseSnapshot ||
            state.currentSnapshot ||
            {}
    );
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

function buildQueueFinalRepoDiagnosticHandoffPackInput(
    manifest,
    detectedPlatform,
    deps = {}
) {
    const state = asObject(getState().data || {});
    const currentSnapshot = resolveCurrentSnapshot(deps, state);
    const clinicProfile = resolveClinicProfile(deps, currentSnapshot, state);
    const clinicId = toText(
        deps.clinicId ||
            currentSnapshot.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            '',
        ''
    );
    const region = toText(
        deps.region ||
            currentSnapshot.region ||
            clinicProfile.region ||
            clinicProfile.address?.region ||
            clinicId ||
            'regional',
        'regional'
    );
    const scope = toText(
        deps.scope || currentSnapshot.scope || region || clinicId || 'global',
        'global'
    );
    const clinicLabel = toText(
        deps.clinicLabel ||
            currentSnapshot.clinicLabel ||
            currentSnapshot.clinicName ||
            currentSnapshot.brandName ||
            clinicProfile.branding?.name ||
            clinicProfile.branding?.short_name ||
            clinicId ||
            region,
        region
    );
    const clinicShortName = toText(
        deps.clinicShortName ||
            currentSnapshot.clinicShortName ||
            clinicProfile.branding?.short_name ||
            clinicProfile.branding?.name ||
            clinicLabel,
        clinicLabel
    );
    const evidence =
        pickArray(
            deps.evidence,
            currentSnapshot.evidence,
            currentSnapshot.releaseEvidenceBundle?.evidence,
            currentSnapshot.releaseEvidenceBundle?.items
        ) || DEFAULT_FINAL_REPO_EVIDENCE;
    const blockers =
        pickArray(
            deps.blockers,
            currentSnapshot.blockers,
            currentSnapshot.releaseEvidenceBundle?.blockers
        ) || DEFAULT_FINAL_REPO_BLOCKERS;
    const launchGate = pickObject(
        deps.launchGate,
        currentSnapshot.launchGate,
        currentSnapshot.releaseEvidenceBundle?.launchGate
    ) || {
        decision: 'collect-last-signoffs',
    };
    const workspaceVerdict = pickObject(
        deps.workspaceVerdict,
        currentSnapshot.workspaceVerdict,
        currentSnapshot.releaseEvidenceBundle?.workspaceVerdict
    ) || {
        verdict: 'review',
    };

    return {
        manifest,
        detectedPlatform,
        scope,
        region,
        clinicId,
        clinicLabel,
        clinicShortName,
        clinicProfile,
        currentSnapshot,
        evidence: toArray(evidence),
        blockers: toArray(blockers),
        launchGate,
        workspaceVerdict,
        nowLabel: toText(
            deps.nowLabel || currentSnapshot.nowLabel || 'ahora',
            'ahora'
        ),
        generatedAt: toText(
            deps.generatedAt || currentSnapshot.generatedAt,
            new Date().toISOString()
        ),
    };
}

export function wireTurneroReleaseFinalRepoDiagnosticHandoffPack({
    mountNode,
    manifest,
    detectedPlatform,
    ...deps
} = {}) {
    const host = resolveFinalRepoDiagnosticHandoffHost(mountNode);
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    return mountTurneroReleaseFinalRepoDiagnosticHandoffPack(
        host,
        buildQueueFinalRepoDiagnosticHandoffPackInput(
            manifest,
            detectedPlatform,
            deps
        )
    );
}

export function renderQueueFinalRepoDiagnosticHandoffPack(
    manifest,
    detectedPlatform,
    deps = {}
) {
    return wireTurneroReleaseFinalRepoDiagnosticHandoffPack({
        manifest,
        detectedPlatform,
        ...deps,
    });
}
