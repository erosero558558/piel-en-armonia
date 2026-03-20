import { asObject, toText } from './turnero-release-control-center.js';

const STORAGE_KEY = 'turnero-release-owner-signoff-registry:v1';
const MEMORY_STORAGE = new Map();
const VALID_VERDICTS = new Set(['approve', 'review', 'reject']);

function getStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_error) {
        return null;
    }
}

function readAll() {
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

function writeAll(data) {
    const storage = getStorage();
    if (storage) {
        storage.setItem(STORAGE_KEY, JSON.stringify(data));
        return;
    }

    MEMORY_STORAGE.set(STORAGE_KEY, data);
}

function normalizeVerdict(value, fallback = 'review') {
    const verdict = toText(value, fallback).toLowerCase();
    return VALID_VERDICTS.has(verdict) ? verdict : fallback;
}

function normalizeSignoff(entry = {}, fallbackIndex = 0) {
    const item = asObject(entry);

    return {
        id: toText(item.id, `signoff-${Date.now()}-${fallbackIndex + 1}`),
        owner: toText(item.owner, 'program'),
        verdict: normalizeVerdict(item.verdict, 'review'),
        note: toText(item.note, ''),
        createdAt: toText(item.createdAt, new Date().toISOString()),
    };
}

export function createTurneroReleaseOwnerSignoffRegistry(scope = 'global') {
    const scopeKey = toText(scope, 'global');

    return {
        list() {
            const data = readAll();
            return Array.isArray(data[scopeKey])
                ? data[scopeKey].map((entry, index) =>
                      normalizeSignoff(entry, index)
                  )
                : [];
        },
        add(entry = {}) {
            const data = readAll();
            const rows = Array.isArray(data[scopeKey]) ? data[scopeKey] : [];
            const next = normalizeSignoff(entry, rows.length);
            data[scopeKey] = [next, ...rows].slice(0, 50);
            writeAll(data);
            return next;
        },
        clear() {
            const data = readAll();
            delete data[scopeKey];
            writeAll(data);
        },
    };
}

export default createTurneroReleaseOwnerSignoffRegistry;
