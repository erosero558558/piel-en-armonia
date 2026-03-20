import { asObject, toArray, toText } from './turnero-release-control-center.js';

const DEFAULT_STEPS = Object.freeze([
    { window: 'ahora', label: 'Congelar snapshot y evidencias' },
    { window: '+15m', label: 'Validar blockers y signoff restante' },
    { window: '+30m', label: 'Armar paquete final de diagnostico' },
    {
        window: 'siguiente-turno',
        label: 'Revision humana del diagnostico honesto',
    },
]);

function normalizeTimelineStep(step, index) {
    const row = asObject(step);

    return {
        id: toText(row.id || row.key || `timeline-${index + 1}`),
        window: toText(row.window || row.slot || `+${index * 15}m`),
        label: toText(row.label || row.title || `Timeline step ${index + 1}`),
        state: toText(row.state || (index === 0 ? 'active' : 'queued'))
            .trim()
            .toLowerCase(),
        note: toText(row.note || ''),
    };
}

function resolveTimelineRows(input = {}) {
    const candidates = [input.rows, input.steps, input.timelineRows];

    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length > 0) {
            return candidate;
        }
    }

    return DEFAULT_STEPS;
}

export function buildTurneroReleaseDiagnosticHandoffTimeline(input = {}) {
    const rows = toArray(resolveTimelineRows(input)).map(normalizeTimelineStep);

    return {
        rows,
        summary: {
            all: rows.length,
            active: rows.filter((row) => row.state === 'active').length,
        },
        generatedAt: new Date().toISOString(),
    };
}
