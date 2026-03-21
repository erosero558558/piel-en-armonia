import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';
import { normalizeTurneroSurfaceRecoveryKey } from './turnero-surface-contract-snapshot.js';
import { asObject, toArray, toString } from './turnero-surface-helpers.js';

const TURNERO_SURFACE_SUPPORT_CONTACT_STORE_KEY =
    'turneroSurfaceSupportContactsV1';
const STORE_SCHEMA = 'turnero-surface-support-contacts/v1';

const memoryFallbackStores = new Map();

function getClinicId(clinicProfile) {
    return toString(
        clinicProfile?.clinic_id || clinicProfile?.clinicId,
        'default-clinic'
    );
}

function getFallbackStoreKey(storageKey, clinicProfile) {
    return `${toString(storageKey, TURNERO_SURFACE_SUPPORT_CONTACT_STORE_KEY)}:${getClinicId(
        clinicProfile
    )}`;
}

function clearFallbackStore(storageKey, clinicProfile) {
    return memoryFallbackStores.delete(
        getFallbackStoreKey(storageKey, clinicProfile)
    );
}

function normalizeEnvelope(rawValue, clinicProfile) {
    if (Array.isArray(rawValue)) {
        return {
            schema: STORE_SCHEMA,
            clinicId: getClinicId(clinicProfile),
            updatedAt: '',
            scopes: {
                global: rawValue,
            },
        };
    }

    const source = asObject(rawValue);
    const scopes =
        source.scopes && typeof source.scopes === 'object' ? source.scopes : {};

    return {
        schema: toString(source.schema, STORE_SCHEMA),
        clinicId: toString(source.clinicId, getClinicId(clinicProfile)),
        updatedAt: toString(source.updatedAt, ''),
        scopes,
    };
}

function normalizeContactState(value) {
    const normalized = toString(value, 'active').toLowerCase();
    if (
        ['inactive', 'archived', 'hidden', 'disabled', 'removed'].includes(
            normalized
        )
    ) {
        return 'inactive';
    }
    if (['standby', 'waiting'].includes(normalized)) {
        return 'standby';
    }
    if (['available', 'ready', 'active'].includes(normalized)) {
        return 'active';
    }
    return 'active';
}

function normalizeContactPriority(value) {
    const normalized = toString(value, 'primary').toLowerCase();
    if (['primary', 'lead'].includes(normalized)) {
        return 'primary';
    }
    if (['backup', 'secondary', 'oncall', 'standby'].includes(normalized)) {
        return 'backup';
    }
    return 'other';
}

function normalizeContactChannel(value) {
    const normalized = toString(value, 'phone').toLowerCase();
    if (['phone', 'call', 'tel', 'telephone'].includes(normalized)) {
        return 'phone';
    }
    if (['whatsapp', 'wa', 'chat'].includes(normalized)) {
        return 'whatsapp';
    }
    if (['email', 'mail'].includes(normalized)) {
        return 'email';
    }
    if (['sms', 'message', 'text'].includes(normalized)) {
        return 'sms';
    }
    return 'phone';
}

function normalizeContact(entry = {}, fallbackSurfaceKey = 'admin') {
    const source = asObject(entry);
    const surfaceKey = normalizeTurneroSurfaceRecoveryKey(
        source.surfaceKey || source.surface || fallbackSurfaceKey
    );
    const createdAt = toString(
        source.createdAt || source.created_at || source.updatedAt
    );
    const updatedAt = toString(
        source.updatedAt || source.updated_at || createdAt
    );

    return {
        id: toString(source.id || `${surfaceKey}-${createdAt || Date.now()}`),
        scope: toString(source.scope, 'queue-support'),
        surfaceKey,
        name: toString(
            source.name || source.label || source.title,
            'Support contact'
        ),
        role: toString(source.role || source.position || 'ops'),
        channel: normalizeContactChannel(source.channel || source.medium),
        phone: toString(source.phone || source.value || ''),
        priority: normalizeContactPriority(source.priority || source.rank),
        state: normalizeContactState(source.state || source.status),
        note: toString(source.note || source.detail || ''),
        source: toString(source.source || 'manual'),
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: updatedAt || createdAt || new Date().toISOString(),
        meta:
            source.meta && typeof source.meta === 'object'
                ? { ...source.meta }
                : {},
    };
}

function isActiveContact(contact) {
    return normalizeContactState(contact?.state) !== 'inactive';
}

function contactPriorityRank(priority) {
    switch (normalizeContactPriority(priority)) {
        case 'primary':
            return 0;
        case 'backup':
            return 1;
        default:
            return 2;
    }
}

function sortContacts(contacts) {
    return [...contacts].sort((left, right) => {
        const priorityDelta =
            contactPriorityRank(left.priority) -
            contactPriorityRank(right.priority);
        if (priorityDelta !== 0) {
            return priorityDelta;
        }

        const leftTime = Date.parse(
            String(left.updatedAt || left.createdAt || '')
        );
        const rightTime = Date.parse(
            String(right.updatedAt || right.createdAt || '')
        );
        const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
        const safeRight = Number.isFinite(rightTime) ? rightTime : 0;

        return (
            safeRight - safeLeft ||
            String(left.id).localeCompare(String(right.id))
        );
    });
}

function readEnvelope(storageKey, clinicProfile) {
    const persisted = readClinicScopedStorageValue(storageKey, clinicProfile, {
        fallbackValue: null,
        normalizeValue: (value) => normalizeEnvelope(value, clinicProfile),
    });

    if (persisted && typeof persisted === 'object') {
        return normalizeEnvelope(persisted, clinicProfile);
    }

    const fallbackKey = getFallbackStoreKey(storageKey, clinicProfile);
    const fallbackEnvelope = memoryFallbackStores.get(fallbackKey);
    if (fallbackEnvelope) {
        return normalizeEnvelope(fallbackEnvelope, clinicProfile);
    }

    return normalizeEnvelope(null, clinicProfile);
}

function persistEnvelope(storageKey, clinicProfile, envelope) {
    const normalized = normalizeEnvelope(envelope, clinicProfile);
    const persisted = persistClinicScopedStorageValue(
        storageKey,
        clinicProfile,
        normalized
    );

    const fallbackKey = getFallbackStoreKey(storageKey, clinicProfile);
    if (persisted) {
        memoryFallbackStores.delete(fallbackKey);
    } else {
        memoryFallbackStores.set(fallbackKey, normalized);
    }

    return persisted;
}

function readScopeContacts(storageKey, clinicProfile, scope) {
    const envelope = readEnvelope(storageKey, clinicProfile);
    const rawContacts = toArray(envelope.scopes?.[scope]);
    return sortContacts(
        rawContacts.map((contact) => normalizeContact(contact))
    );
}

function writeScopeContacts(storageKey, clinicProfile, scope, contacts) {
    const normalizedContacts = sortContacts(
        toArray(contacts)
            .map((contact) => normalizeContact(contact))
            .filter((contact) => Boolean(contact.id))
    );
    const envelope = readEnvelope(storageKey, clinicProfile);
    const nextEnvelope = {
        schema: STORE_SCHEMA,
        clinicId: getClinicId(clinicProfile),
        updatedAt: new Date().toISOString(),
        scopes: {
            ...(envelope.scopes && typeof envelope.scopes === 'object'
                ? envelope.scopes
                : {}),
        },
    };

    if (!normalizedContacts.length) {
        delete nextEnvelope.scopes[scope];
        if (Object.keys(nextEnvelope.scopes).length === 0) {
            const cleared = removeClinicScopedStorageValue(
                storageKey,
                clinicProfile
            );
            const fallbackCleared = clearFallbackStore(
                storageKey,
                clinicProfile
            );
            return cleared || fallbackCleared;
        }

        return persistEnvelope(storageKey, clinicProfile, nextEnvelope);
    }

    nextEnvelope.scopes[scope] = normalizedContacts;
    return persistEnvelope(storageKey, clinicProfile, nextEnvelope);
}

function summarizeContacts(contacts = []) {
    const summary = {
        all: contacts.length,
        active: 0,
        primary: 0,
        backup: 0,
        other: 0,
        phone: 0,
        whatsapp: 0,
        email: 0,
    };

    for (const contact of contacts) {
        if (isActiveContact(contact)) {
            summary.active += 1;
        }

        const priority = normalizeContactPriority(contact.priority);
        summary[priority] += 1;

        const channel = normalizeContactChannel(contact.channel);
        summary[channel] += 1;
    }

    return summary;
}

export function createTurneroSurfaceSupportContactStore(
    scope = 'queue-support',
    clinicProfile = null
) {
    const normalizedScope = toString(scope, 'queue-support') || 'queue-support';
    const normalizedClinicProfile =
        clinicProfile && typeof clinicProfile === 'object' ? clinicProfile : {};

    return {
        scope: normalizedScope,
        clinicId: getClinicId(normalizedClinicProfile),
        list({ includeInactive = false, surfaceKey = '' } = {}) {
            const normalizedSurfaceKey = surfaceKey
                ? normalizeTurneroSurfaceRecoveryKey(surfaceKey)
                : '';
            return readScopeContacts(
                TURNERO_SURFACE_SUPPORT_CONTACT_STORE_KEY,
                normalizedClinicProfile,
                normalizedScope
            )
                .filter((contact) => {
                    if (!includeInactive && !isActiveContact(contact)) {
                        return false;
                    }
                    if (
                        normalizedSurfaceKey &&
                        contact.surfaceKey !== normalizedSurfaceKey
                    ) {
                        return false;
                    }
                    return true;
                })
                .map((contact) => ({ ...contact }));
        },
        add(entry = {}) {
            const nextEntry = normalizeContact(
                {
                    ...entry,
                    scope: normalizedScope,
                    state: entry.state || 'active',
                    channel: entry.channel || 'phone',
                    priority: entry.priority || 'primary',
                },
                entry.surfaceKey || 'admin'
            );
            const current = readScopeContacts(
                TURNERO_SURFACE_SUPPORT_CONTACT_STORE_KEY,
                normalizedClinicProfile,
                normalizedScope
            );
            writeScopeContacts(
                TURNERO_SURFACE_SUPPORT_CONTACT_STORE_KEY,
                normalizedClinicProfile,
                normalizedScope,
                [nextEntry, ...current].slice(0, 100)
            );
            return nextEntry;
        },
        update(contactId, patch = {}) {
            const targetId = toString(contactId, '');
            if (!targetId) {
                return null;
            }

            let updatedContact = null;
            const contacts = readScopeContacts(
                TURNERO_SURFACE_SUPPORT_CONTACT_STORE_KEY,
                normalizedClinicProfile,
                normalizedScope
            ).map((contact) => {
                if (contact.id !== targetId) {
                    return contact;
                }

                updatedContact = normalizeContact(
                    {
                        ...contact,
                        ...asObject(patch),
                        id: contact.id,
                        scope: normalizedScope,
                        updatedAt: new Date().toISOString(),
                    },
                    contact.surfaceKey
                );
                return updatedContact;
            });

            if (!updatedContact) {
                return null;
            }

            writeScopeContacts(
                TURNERO_SURFACE_SUPPORT_CONTACT_STORE_KEY,
                normalizedClinicProfile,
                normalizedScope,
                contacts
            );
            return updatedContact;
        },
        remove(contactId) {
            const targetId = toString(contactId, '');
            if (!targetId) {
                return false;
            }

            const remaining = readScopeContacts(
                TURNERO_SURFACE_SUPPORT_CONTACT_STORE_KEY,
                normalizedClinicProfile,
                normalizedScope
            ).filter((contact) => contact.id !== targetId);
            return writeScopeContacts(
                TURNERO_SURFACE_SUPPORT_CONTACT_STORE_KEY,
                normalizedClinicProfile,
                normalizedScope,
                remaining
            );
        },
        clear({ surfaceKey = '' } = {}) {
            const normalizedSurfaceKey = surfaceKey
                ? normalizeTurneroSurfaceRecoveryKey(surfaceKey)
                : '';
            if (!normalizedSurfaceKey) {
                return writeScopeContacts(
                    TURNERO_SURFACE_SUPPORT_CONTACT_STORE_KEY,
                    normalizedClinicProfile,
                    normalizedScope,
                    []
                );
            }

            const remaining = readScopeContacts(
                TURNERO_SURFACE_SUPPORT_CONTACT_STORE_KEY,
                normalizedClinicProfile,
                normalizedScope
            ).filter((contact) => contact.surfaceKey !== normalizedSurfaceKey);
            return writeScopeContacts(
                TURNERO_SURFACE_SUPPORT_CONTACT_STORE_KEY,
                normalizedClinicProfile,
                normalizedScope,
                remaining
            );
        },
        snapshot() {
            const allContacts = readScopeContacts(
                TURNERO_SURFACE_SUPPORT_CONTACT_STORE_KEY,
                normalizedClinicProfile,
                normalizedScope
            );
            const activeContacts = allContacts.filter(isActiveContact);
            return {
                scope: normalizedScope,
                clinicId: getClinicId(normalizedClinicProfile),
                contacts: allContacts,
                activeContacts,
                summary: summarizeContacts(allContacts),
                generatedAt: new Date().toISOString(),
            };
        },
        summary() {
            return summarizeContacts(
                readScopeContacts(
                    TURNERO_SURFACE_SUPPORT_CONTACT_STORE_KEY,
                    normalizedClinicProfile,
                    normalizedScope
                )
            );
        },
        refresh() {
            return readEnvelope(
                TURNERO_SURFACE_SUPPORT_CONTACT_STORE_KEY,
                normalizedClinicProfile
            );
        },
    };
}

export {
    normalizeContact as normalizeTurneroSurfaceSupportContact,
    normalizeEnvelope as normalizeTurneroSurfaceSupportContactEnvelope,
    TURNERO_SURFACE_SUPPORT_CONTACT_STORE_KEY,
};
