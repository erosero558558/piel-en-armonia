import { toText } from './turnero-release-control-center.js';

const STORAGE_KEY = 'turnero-release-evidence-attestation-ledger:v1';
const FALLBACK_REGISTRY = new Map();

function getStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_error) {
        return null;
    }
}

function safeJsonParse(value, fallback = {}) {
    if (!value) {
        return fallback;
    }

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : fallback;
    } catch (_error) {
        return fallback;
    }
}

function safeJsonStringify(value) {
    const seen = new WeakSet();
    try {
        return JSON.stringify(
            value,
            (_key, entry) => {
                if (typeof entry === 'function') {
                    return undefined;
                }

                if (entry && typeof entry === 'object') {
                    if (seen.has(entry)) {
                        return '[Circular]';
                    }
                    seen.add(entry);
                }

                return entry;
            },
            2
        );
    } catch (_error) {
        return JSON.stringify({ error: 'json_stringify_failed' }, null, 2);
    }
}

function readAll() {
    const storage = getStorage();
    if (storage) {
        try {
            return safeJsonParse(storage.getItem(STORAGE_KEY) || '', {});
        } catch (_error) {
            return safeJsonParse(
                safeJsonStringify(FALLBACK_REGISTRY.get(STORAGE_KEY) || {}),
                {}
            );
        }
    }

    return safeJsonParse(
        safeJsonStringify(FALLBACK_REGISTRY.get(STORAGE_KEY) || {}),
        {}
    );
}

function writeAll(data) {
    const payload = safeJsonStringify(data);
    const storage = getStorage();

    if (storage) {
        try {
            storage.setItem(STORAGE_KEY, payload);
        } catch (_error) {
            // Fall back to in-memory persistence.
        }
    }

    FALLBACK_REGISTRY.set(STORAGE_KEY, safeJsonParse(payload, {}));
}

function cloneRows(rows) {
    return Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
}

function normalizeEntry(entry = {}) {
    const nowIso = new Date().toISOString();
    return {
        id: toText(entry.id, `attestation-${Date.now()}`),
        key: toText(entry.key, 'evidence-attestation'),
        label: toText(entry.label, 'Evidence attestation'),
        owner: toText(entry.owner, 'program'),
        status: toText(entry.status, 'attested'),
        note: toText(entry.note, ''),
        createdAt: toText(entry.createdAt, nowIso),
    };
}

export function createTurneroReleaseEvidenceAttestationLedger(
    scope = 'global'
) {
    const normalizedScope = toText(scope, 'global');

    return {
        list() {
            const data = readAll();
            return cloneRows(
                Array.isArray(data[normalizedScope])
                    ? data[normalizedScope]
                    : []
            );
        },
        add(entry = {}) {
            const data = readAll();
            const rows = Array.isArray(data[normalizedScope])
                ? data[normalizedScope]
                : [];
            const next = normalizeEntry(entry);

            data[normalizedScope] = [next, ...rows].slice(0, 300);
            writeAll(data);
            return { ...next };
        },
        clear() {
            const data = readAll();
            if (Object.prototype.hasOwnProperty.call(data, normalizedScope)) {
                delete data[normalizedScope];
            }
            writeAll(data);
        },
    };
}

export default createTurneroReleaseEvidenceAttestationLedger;
