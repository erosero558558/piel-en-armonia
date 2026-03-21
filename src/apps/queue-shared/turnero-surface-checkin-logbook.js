import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';
import { getTurneroClinicProfileFingerprint } from './clinic-profile.js';

const STORAGE_KEY = 'turneroSurfaceCheckinLogbookV1';
const STORAGE_SCHEMA = 'turnero-surface-checkin-logbook/v1';
const MAX_LOGBOOK_ENTRIES = 30;

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function normalizeText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function normalizeSurface(surface) {
    const normalized = normalizeText(surface, 'operator').toLowerCase();
    return normalized === 'sala_tv' ? 'display' : normalized;
}

function resolveFingerprintKey(clinicProfile) {
    return (
        normalizeText(getTurneroClinicProfileFingerprint(clinicProfile)) ||
        'default-profile'
    );
}

function resolveScopesBucket(rawValue) {
    const source = asObject(rawValue);
    return {
        schema: normalizeText(source.schema, STORAGE_SCHEMA),
        profiles: asObject(source.profiles),
    };
}

function normalizeSeverity(value) {
    const normalized = normalizeText(value, 'info').toLowerCase();
    if (
        ['alert', 'danger', 'error', 'critical', 'blocked'].includes(normalized)
    ) {
        return 'alert';
    }
    if (['warning', 'warn', 'watch', 'review'].includes(normalized)) {
        return 'warning';
    }
    if (['ready', 'ok', 'success', 'clear'].includes(normalized)) {
        return 'ready';
    }
    return 'info';
}

function normalizeLogbookEntry(input = {}, surface = 'operator', index = 0) {
    const entry = asObject(input);
    const createdAt = normalizeText(
        entry.createdAt ||
            entry.updatedAt ||
            entry.at ||
            new Date().toISOString(),
        new Date().toISOString()
    );
    const title = normalizeText(
        entry.title || entry.label,
        'Entrada de bitácora'
    );
    const detail = normalizeText(
        entry.detail || entry.summary || entry.note,
        title
    );

    return {
        id: normalizeText(
            entry.id,
            `${normalizeSurface(surface)}-log-${createdAt}-${index + 1}`
        ),
        surface: normalizeSurface(surface),
        title,
        detail,
        severity: normalizeSeverity(
            entry.severity || entry.state || entry.status
        ),
        owner: normalizeText(entry.owner || entry.actor, 'ops'),
        createdAt,
    };
}

function normalizeLogbookEntries(value, surface) {
    const items = Array.isArray(value) ? value : [];
    return items
        .map((entry, index) => normalizeLogbookEntry(entry, surface, index))
        .sort((left, right) =>
            String(right.createdAt || '').localeCompare(
                String(left.createdAt || '')
            )
        )
        .slice(0, MAX_LOGBOOK_ENTRIES);
}

function readBucket(clinicProfile) {
    return readClinicScopedStorageValue(STORAGE_KEY, clinicProfile, {
        fallbackValue: {
            schema: STORAGE_SCHEMA,
            profiles: {},
        },
        normalizeValue: resolveScopesBucket,
    });
}

function writeBucket(clinicProfile, bucket) {
    return persistClinicScopedStorageValue(STORAGE_KEY, clinicProfile, bucket);
}

export function readTurneroSurfaceCheckinLogbook(clinicProfile) {
    return readBucket(clinicProfile);
}

export function listTurneroSurfaceCheckinLogbook({
    clinicProfile,
    surface,
} = {}) {
    const bucket = readBucket(clinicProfile);
    const fingerprintKey = resolveFingerprintKey(clinicProfile);
    const profileBucket = asObject(bucket.profiles[fingerprintKey]);
    return normalizeLogbookEntries(
        profileBucket[normalizeSurface(surface)],
        surface
    );
}

export function appendTurneroSurfaceCheckinLogbookEntry({
    clinicProfile,
    surface,
    entry,
} = {}) {
    const normalizedSurface = normalizeSurface(surface);
    const bucket = readBucket(clinicProfile);
    const fingerprintKey = resolveFingerprintKey(clinicProfile);
    const profileBucket = asObject(bucket.profiles[fingerprintKey]);
    const nextEntries = normalizeLogbookEntries(
        [
            normalizeLogbookEntry(entry, normalizedSurface),
            ...normalizeLogbookEntries(
                profileBucket[normalizedSurface],
                normalizedSurface
            ),
        ],
        normalizedSurface
    );

    bucket.profiles[fingerprintKey] = {
        ...profileBucket,
        [normalizedSurface]: nextEntries,
    };
    bucket.schema = STORAGE_SCHEMA;
    return writeBucket(clinicProfile, bucket);
}

export function clearTurneroSurfaceCheckinLogbook({
    clinicProfile,
    surface,
} = {}) {
    const normalizedSurface = normalizeSurface(surface);
    const bucket = readBucket(clinicProfile);
    const fingerprintKey = resolveFingerprintKey(clinicProfile);
    const profileBucket = asObject(bucket.profiles[fingerprintKey]);
    if (
        !Object.prototype.hasOwnProperty.call(profileBucket, normalizedSurface)
    ) {
        return true;
    }

    delete profileBucket[normalizedSurface];
    if (Object.keys(profileBucket).length === 0) {
        delete bucket.profiles[fingerprintKey];
    } else {
        bucket.profiles[fingerprintKey] = profileBucket;
    }

    if (Object.keys(asObject(bucket.profiles)).length === 0) {
        return removeClinicScopedStorageValue(STORAGE_KEY, clinicProfile);
    }

    bucket.schema = STORAGE_SCHEMA;
    return writeBucket(clinicProfile, bucket);
}
