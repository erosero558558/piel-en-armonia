import {
    buildTurneroSurfaceAcceptanceSnapshot,
    normalizeTurneroSurfaceAcceptanceKey,
    resolveTurneroSurfaceAcceptancePreset,
} from './turnero-surface-acceptance-snapshot.js';
import { buildTurneroSurfaceAcceptanceGate } from './turnero-surface-acceptance-gate.js';
import { buildTurneroSurfaceAcceptanceReadout } from './turnero-surface-acceptance-readout.js';
import { createTurneroSurfaceAcceptanceLedger } from './turnero-surface-acceptance-ledger.js';
import { createTurneroSurfaceStakeholderSignoffStore } from './turnero-surface-stakeholder-signoff-store.js';
import { asObject, toArray, toString } from './turnero-surface-helpers.js';

function resolveCurrentRoute(input = {}, profile, surfaceKey) {
    const explicit = toString(input.currentRoute || input.route);
    if (explicit) {
        return explicit;
    }

    const preset = resolveTurneroSurfaceAcceptancePreset(surfaceKey);
    const profileRoute = toString(
        profile?.surfaces?.[surfaceKey]?.route ||
            profile?.surfaces?.[surfaceKey]?.path ||
            preset.route ||
            ''
    );
    if (profileRoute) {
        return profileRoute;
    }

    if (
        typeof window !== 'undefined' &&
        window.location &&
        typeof window.location.pathname === 'string'
    ) {
        return `${window.location.pathname || ''}${window.location.hash || ''}`;
    }

    return preset.route || '';
}

function buildEvidenceList(input = {}, ledger, surfaceKey) {
    if (Array.isArray(input.evidence)) {
        return input.evidence;
    }

    return ledger?.list?.({ surfaceKey }) || [];
}

function buildSignoffList(input = {}, signoffStore, surfaceKey) {
    if (Array.isArray(input.signoffs)) {
        return input.signoffs;
    }

    return signoffStore?.list?.({ surfaceKey }) || [];
}

export function buildTurneroSurfaceAcceptancePack(input = {}) {
    const profile = asObject(input.clinicProfile || input.profile);
    const surfaceKey = normalizeTurneroSurfaceAcceptanceKey(
        input.surfaceKey || input.surface || 'operator'
    );
    const ledger =
        input.ledger && typeof input.ledger.list === 'function'
            ? input.ledger
            : createTurneroSurfaceAcceptanceLedger(profile, {
                  storageKey: input.ledgerStorageKey,
              });
    const signoffStore =
        input.signoffStore && typeof input.signoffStore.list === 'function'
            ? input.signoffStore
            : createTurneroSurfaceStakeholderSignoffStore(profile, {
                  storageKey: input.signoffStorageKey,
              });
    const currentRoute = resolveCurrentRoute(input, profile, surfaceKey);
    const evidence = buildEvidenceList(input, ledger, surfaceKey);
    const signoffs = buildSignoffList(input, signoffStore, surfaceKey);
    const snapshot = buildTurneroSurfaceAcceptanceSnapshot({
        ...input,
        clinicProfile: profile,
        surfaceKey,
        currentRoute,
        evidence,
        signoffs,
    });
    const gate = buildTurneroSurfaceAcceptanceGate({
        snapshot,
        evidence,
        signoffs,
    });
    const readout = buildTurneroSurfaceAcceptanceReadout({
        snapshot,
        gate,
    });

    return {
        surfaceKey,
        snapshot,
        gate,
        readout,
        ledger,
        signoffStore,
        evidence,
        signoffs,
        generatedAt: snapshot.generatedAt,
        refresh() {
            return buildTurneroSurfaceAcceptancePack({
                ...input,
                clinicProfile: profile,
                surfaceKey,
                currentRoute,
                ledger,
                signoffStore,
            });
        },
    };
}

export default buildTurneroSurfaceAcceptancePack;
