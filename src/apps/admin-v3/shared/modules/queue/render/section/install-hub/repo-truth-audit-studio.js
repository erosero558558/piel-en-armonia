import { getState } from '../../../../../core/store.js';
import {
    asObject,
    toText,
} from '../../../../../../../queue-shared/turnero-release-control-center.js';
import { mountTurneroReleaseRepoTruthAuditStudio } from '../../../../../../../queue-shared/turnero-release-repo-truth-audit-studio.js';

const REPO_TRUTH_AUDIT_SURFACES = Object.freeze([
    { id: 'admin-queue', label: 'Admin Queue' },
    { id: 'operator-turnos', label: 'Operator Turnos' },
    { id: 'kiosco-turnos', label: 'Kiosco Turnos' },
    { id: 'sala-turnos', label: 'Sala Turnos' },
]);

const REPO_TRUTH_AUDIT_ACTUAL_MODULES = Object.freeze([
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

function resolveRepoTruthAuditStudioHost(mountNode) {
    if (mountNode) {
        return mountNode;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    return (
        document.getElementById('queueReleaseRepoTruthAuditStudioHost') ||
        document.querySelector('[data-turnero-release-repo-truth-audit-studio]')
    );
}

function buildRepoTruthAuditStudioInput(manifest, detectedPlatform, deps = {}) {
    const state = asObject(getState().data || {});
    const currentSnapshot = asObject(
        deps.currentSnapshot ||
            state.turneroReleaseEvidenceBundle ||
            state.turneroReleaseSnapshot ||
            state.currentSnapshot ||
            {}
    );
    const clinicProfile = asObject(
        deps.clinicProfile ||
            currentSnapshot.turneroClinicProfile ||
            currentSnapshot.clinicProfile ||
            state.turneroClinicProfile ||
            {}
    );

    return {
        manifest,
        detectedPlatform,
        scope: toText(
            deps.scope ||
                currentSnapshot.region ||
                clinicProfile.region ||
                'regional',
            'regional'
        ),
        region: toText(
            deps.region ||
                currentSnapshot.region ||
                clinicProfile.region ||
                'regional',
            'regional'
        ),
        clinicProfile,
        currentSnapshot,
        surfaces: REPO_TRUTH_AUDIT_SURFACES,
        actualModules: REPO_TRUTH_AUDIT_ACTUAL_MODULES,
    };
}

export function wireTurneroRepoTruthAuditStudio({
    mountNode,
    manifest,
    detectedPlatform,
    ...deps
} = {}) {
    const host = resolveRepoTruthAuditStudioHost(mountNode);
    if (!isDomElement(host)) {
        return null;
    }

    return mountTurneroReleaseRepoTruthAuditStudio(
        host,
        buildRepoTruthAuditStudioInput(manifest, detectedPlatform, deps)
    );
}

export function renderQueueRepoTruthAuditStudio(
    manifest,
    detectedPlatform,
    deps = {}
) {
    return wireTurneroRepoTruthAuditStudio({
        manifest,
        detectedPlatform,
        ...deps,
    });
}
