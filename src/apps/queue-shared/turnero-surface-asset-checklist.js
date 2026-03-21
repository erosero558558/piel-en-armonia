import { asObject, toArray, toString } from './turnero-surface-helpers.js';

const DEFAULT_CHECKLIST_ITEMS = Object.freeze([
    {
        id: 'surface',
        label: 'Surface',
        required: true,
    },
    {
        id: 'owner',
        label: 'Owner',
        required: false,
    },
    {
        id: 'assetTag',
        label: 'Asset tag',
        required: false,
    },
    {
        id: 'stationLabel',
        label: 'Station',
        required: true,
    },
    {
        id: 'installMode',
        label: 'Install mode',
        required: true,
    },
    {
        id: 'ledger',
        label: 'Ledger',
        required: true,
    },
]);

function normalizeChecklistValue(value) {
    if (Array.isArray(value)) {
        return value;
    }
    if (value && typeof value === 'object') {
        return value;
    }
    return toString(value);
}

function resolveChecklistValue(snapshot, item) {
    switch (item.id) {
        case 'surface':
            return toString(
                snapshot.surfaceLabel ||
                    snapshot.surfaceName ||
                    snapshot.surfaceKey ||
                    snapshot.surfaceId
            );
        case 'owner':
            return toString(snapshot.owner || snapshot.rolloutOwner);
        case 'assetTag':
            return toString(snapshot.assetTag || snapshot.asset || '');
        case 'stationLabel':
            return toString(snapshot.stationLabel || snapshot.station || '');
        case 'installMode':
            return toString(
                snapshot.installMode || snapshot.install_mode || ''
            );
        case 'ledger':
            if (Array.isArray(snapshot.ledger)) {
                return snapshot.ledger;
            }
            if (snapshot.ledger && typeof snapshot.ledger === 'object') {
                return Array.isArray(snapshot.ledger.entries)
                    ? snapshot.ledger.entries
                    : [];
            }
            return [];
        default:
            return '';
    }
}

function buildChecklistItem(snapshot, item) {
    const value = normalizeChecklistValue(
        resolveChecklistValue(snapshot, item)
    );
    const hasValue = Array.isArray(value)
        ? true
        : typeof value === 'object'
          ? Object.keys(value).length > 0
          : Boolean(String(value || '').trim());

    return {
        id: item.id,
        label: item.label,
        required: item.required === true,
        state: hasValue ? 'pass' : 'fail',
        value: Array.isArray(value)
            ? `${value.length} registro${value.length === 1 ? '' : 's'}`
            : toString(value, 'pendiente'),
        detail: hasValue ? `${item.label} listo.` : `${item.label} pendiente.`,
    };
}

export function buildTurneroSurfaceAssetChecklist(input = {}) {
    const snapshot = asObject(input.snapshot);
    const items = DEFAULT_CHECKLIST_ITEMS.map((item) =>
        buildChecklistItem(snapshot, item)
    );
    const requiredFail = items.filter(
        (item) => item.required && item.state === 'fail'
    ).length;
    const optionalFail = items.filter(
        (item) => !item.required && item.state === 'fail'
    ).length;
    const summary = items.reduce(
        (accumulator, item) => {
            accumulator.all += 1;
            accumulator[item.state] += 1;
            return accumulator;
        },
        {
            all: 0,
            pass: 0,
            fail: 0,
            requiredFail: 0,
            optionalFail: 0,
        }
    );
    summary.requiredFail = requiredFail;
    summary.optionalFail = optionalFail;
    const coverage = summary.all
        ? Math.max(
              0,
              Math.min(100, Math.round((summary.pass / summary.all) * 100))
          )
        : 0;

    return {
        items,
        summary,
        coverage,
        requiredFail,
        optionalFail,
        state:
            requiredFail > 0 ? 'blocked' : optionalFail > 0 ? 'watch' : 'ready',
        generatedAt: new Date().toISOString(),
    };
}

export { DEFAULT_CHECKLIST_ITEMS };
