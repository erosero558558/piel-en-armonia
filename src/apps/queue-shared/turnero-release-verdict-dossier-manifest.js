import { asObject, toText } from './turnero-release-control-center.js';

const DEFAULT_ITEMS = Object.freeze([
    {
        key: 'evidence-consensus',
        label: 'Evidence Consensus',
        owner: 'program',
        criticality: 'critical',
    },
    {
        key: 'binder-readout',
        label: 'Binder Readout',
        owner: 'program',
        criticality: 'critical',
    },
    {
        key: 'risk-residual',
        label: 'Residual Risk',
        owner: 'infra',
        criticality: 'high',
    },
    {
        key: 'review-disagreements',
        label: 'Review Disagreements',
        owner: 'program',
        criticality: 'high',
    },
    {
        key: 'repo-casefile',
        label: 'Repo Casefile',
        owner: 'program',
        criticality: 'critical',
    },
]);

function normalizeCriticality(value, fallback = 'high') {
    const criticality = toText(value, fallback).trim().toLowerCase();
    return ['critical', 'high', 'medium', 'low'].includes(criticality)
        ? criticality
        : fallback;
}

function normalizeManifestItem(item, index) {
    const entry = asObject(item);
    const fallbackKey = `dossier-item-${index + 1}`;
    const key = toText(entry.key || entry.id, fallbackKey);

    return {
        id: toText(entry.id, key),
        key,
        label: toText(entry.label, `Dossier Item ${index + 1}`),
        owner: toText(entry.owner, 'program'),
        criticality: normalizeCriticality(entry.criticality, 'high'),
        status: toText(entry.status || entry.state, 'open'),
    };
}

export function buildTurneroReleaseVerdictDossierManifest(input = {}) {
    const items =
        Array.isArray(input.items) && input.items.length > 0
            ? input.items
            : DEFAULT_ITEMS;
    const rows = items.map((item, index) => normalizeManifestItem(item, index));

    return {
        rows,
        summary: {
            all: rows.length,
            critical: rows.filter((row) => row.criticality === 'critical')
                .length,
            high: rows.filter((row) => row.criticality === 'high').length,
            medium: rows.filter((row) => row.criticality === 'medium').length,
            low: rows.filter((row) => row.criticality === 'low').length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export { DEFAULT_ITEMS as DEFAULT_VERDICT_DOSSIER_ITEMS };

export default buildTurneroReleaseVerdictDossierManifest;
