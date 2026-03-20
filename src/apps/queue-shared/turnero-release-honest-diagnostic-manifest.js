import { asObject, toText } from './turnero-release-control-center.js';

const DEFAULT_ITEMS = Object.freeze([
    {
        key: 'evidence',
        label: 'Evidence Completeness',
        owner: 'program',
        criticality: 'critical',
    },
    {
        key: 'runtime-alignment',
        label: 'Runtime Alignment',
        owner: 'infra',
        criticality: 'critical',
    },
    {
        key: 'surface-handoff',
        label: 'Surface Handoff',
        owner: 'ops',
        criticality: 'high',
    },
    {
        key: 'integration-trust',
        label: 'Integration Trust',
        owner: 'infra',
        criticality: 'critical',
    },
    {
        key: 'safety-privacy',
        label: 'Safety Privacy',
        owner: 'governance',
        criticality: 'high',
    },
    {
        key: 'service-readiness',
        label: 'Service Readiness',
        owner: 'ops',
        criticality: 'high',
    },
    {
        key: 'closeout',
        label: 'Closeout Completeness',
        owner: 'program',
        criticality: 'critical',
    },
]);

function normalizeCriticality(value, fallback = 'high') {
    const criticality = toText(value, fallback).toLowerCase();
    return ['critical', 'high', 'medium', 'low'].includes(criticality)
        ? criticality
        : fallback;
}

function normalizeManifestItem(item, index) {
    const entry = asObject(item);
    const key = toText(entry.key || entry.id, `honest-item-${index + 1}`);

    return {
        id: toText(entry.id, key),
        key,
        label: toText(entry.label, `Honest Item ${index + 1}`),
        owner: toText(entry.owner, 'program'),
        criticality: normalizeCriticality(entry.criticality, 'high'),
        status: toText(entry.status || entry.state, 'open'),
    };
}

export function buildTurneroReleaseHonestDiagnosticManifest(input = {}) {
    const items =
        Array.isArray(input.items) && input.items.length > 0
            ? input.items
            : DEFAULT_ITEMS;
    const rows = items.map(normalizeManifestItem);

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

export default buildTurneroReleaseHonestDiagnosticManifest;
