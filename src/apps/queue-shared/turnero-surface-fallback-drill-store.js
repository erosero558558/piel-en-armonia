import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';
import { getTurneroClinicProfileFingerprint } from './clinic-profile.js';

const STORAGE_KEY = 'turneroSurfaceFallbackDrillsV1';
const STORAGE_SCHEMA = 'turnero-surface-fallback-drills/v1';
const MAX_DRILLS_PER_SURFACE = 20;

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
    const profiles = asObject(source.profiles);
    return {
        schema: normalizeText(source.schema, STORAGE_SCHEMA),
        profiles,
    };
}

function normalizeDrillEntry(input = {}, surface = 'operator', index = 0) {
    const entry = asObject(input);
    const createdAt = normalizeText(
        entry.createdAt || entry.at || new Date().toISOString(),
        new Date().toISOString()
    );
    return {
        id: normalizeText(
            entry.id,
            `${normalizeSurface(surface)}-drill-${createdAt}-${index + 1}`
        ),
        surface: normalizeSurface(surface),
        title: normalizeText(entry.title, 'Drill registrado'),
        detail: normalizeText(
            entry.detail || entry.summary || entry.note,
            'Sin detalle adicional.'
        ),
        state: normalizeText(
            entry.state || entry.status,
            'ready'
        ).toLowerCase(),
        decision: normalizeText(entry.decision, 'review').toLowerCase(),
        actor: normalizeText(entry.actor || entry.owner, 'ops'),
        createdAt,
    };
}

function normalizeDrillList(value, surface) {
    const items = Array.isArray(value) ? value : [];
    return items
        .map((entry, index) => normalizeDrillEntry(entry, surface, index))
        .sort((left, right) =>
            String(right.createdAt || '').localeCompare(
                String(left.createdAt || '')
            )
        )
        .slice(0, MAX_DRILLS_PER_SURFACE);
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

export function readTurneroSurfaceFallbackDrills(clinicProfile) {
    return readBucket(clinicProfile);
}

export function listTurneroSurfaceFallbackDrills({
    clinicProfile,
    surface,
} = {}) {
    const bucket = readBucket(clinicProfile);
    const fingerprintKey = resolveFingerprintKey(clinicProfile);
    const profileBucket = asObject(bucket.profiles[fingerprintKey]);
    return normalizeDrillList(
        profileBucket[normalizeSurface(surface)],
        surface
    );
}

export function appendTurneroSurfaceFallbackDrill({
    clinicProfile,
    surface,
    entry,
} = {}) {
    const normalizedSurface = normalizeSurface(surface);
    const bucket = readBucket(clinicProfile);
    const fingerprintKey = resolveFingerprintKey(clinicProfile);
    const profileBucket = asObject(bucket.profiles[fingerprintKey]);
    const nextEntries = normalizeDrillList(
        [
            normalizeDrillEntry(entry, normalizedSurface),
            ...normalizeDrillList(
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

export function clearTurneroSurfaceFallbackDrills({
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
