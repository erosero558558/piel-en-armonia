function normalizeCallbacks(list) {
    return (Array.isArray(list) ? list : []).map((item) => ({
        ...item,
        status: String(item.status || '')
            .toLowerCase()
            .includes('contact')
            ? 'contacted'
            : 'pending',
        leadOps:
            item.leadOps && typeof item.leadOps === 'object'
                ? item.leadOps
                : {},
    }));
}

function normalizeQueueTickets(data) {
    if (Array.isArray(data.queue_tickets)) return data.queue_tickets;
    if (Array.isArray(data.queueTickets)) return data.queueTickets;
    return [];
}

function normalizeDoctorProfile(data, fallbackState) {
    const source =
        data.doctorProfile && typeof data.doctorProfile === 'object'
            ? data.doctorProfile
            : fallbackState?.doctorProfile &&
                typeof fallbackState.doctorProfile === 'object'
              ? fallbackState.doctorProfile
              : null;

    if (!source) {
        return null;
    }

    return {
        fullName: String(source.fullName || '').trim(),
        specialty: String(source.specialty || '').trim(),
        mspNumber: String(source.mspNumber || '').trim(),
        signatureImage: String(source.signatureImage || '').trim(),
        updatedAt: String(source.updatedAt || '').trim(),
    };
}

function normalizeClinicProfile(data, fallbackState) {
    const source =
        data.clinicProfile && typeof data.clinicProfile === 'object'
            ? data.clinicProfile
            : fallbackState?.clinicProfile &&
                typeof fallbackState.clinicProfile === 'object'
              ? fallbackState.clinicProfile
              : null;

    if (!source) {
        return null;
    }

    return {
        clinicName: String(source.clinicName || '').trim(),
        address: String(source.address || '').trim(),
        phone: String(source.phone || '').trim(),
        logoImage: String(source.logoImage || '').trim(),
        software_plan: String(source.software_plan || 'Free').trim(),
        software_subscription:
            source.software_subscription &&
            typeof source.software_subscription === 'object'
                ? source.software_subscription
                : {},
        updatedAt: String(source.updatedAt || '').trim(),
    };
}

function normalizeReviews(data, fallbackState) {
    const source = Array.isArray(data.reviews) ? data.reviews : (fallbackState?.reviews || []);
    const totalReviews = source.length;
    let averageRating = 0;
    if (totalReviews > 0) {
        let sum = 0;
        for (const review of source) {
            sum += Number(review.rating || 0);
        }
        averageRating = sum / totalReviews;
    }
    
    return {
        items: source,
        totalReviews,
        averageRating: Number(averageRating.toFixed(1)),
        last5Reviews: source.slice(0, 5),
    };
}

export function normalizeAdminDataPayload(data, healthPayload, fallbackState) {
    return {
        appointments: Array.isArray(data.appointments) ? data.appointments : [],
        callbacks: Array.isArray(data.callbacks) ? data.callbacks : [],
        reviewsMeta: normalizeReviews(data, fallbackState),
        availability:
            data.availability && typeof data.availability === 'object'
                ? data.availability
                : {},
        availabilityMeta:
            data.availabilityMeta && typeof data.availabilityMeta === 'object'
                ? data.availabilityMeta
                : {},
        doctorProfile: normalizeDoctorProfile(data, fallbackState),
        clinicProfile: normalizeClinicProfile(data, fallbackState),
        queueTickets: normalizeQueueTickets(data),
        queueMeta:
            data.queueMeta && typeof data.queueMeta === 'object'
                ? data.queueMeta
                : data.queue_state && typeof data.queue_state === 'object'
                  ? data.queue_state
                  : null,
        leadOpsMeta:
            data.leadOpsMeta && typeof data.leadOpsMeta === 'object'
                ? data.leadOpsMeta
                : fallbackState?.leadOpsMeta || null,
        patientFlowMeta:
            data.patientFlowMeta && typeof data.patientFlowMeta === 'object'
                ? data.patientFlowMeta
                : fallbackState?.patientFlowMeta || null,
        clinicalHistoryMeta:
            data.clinicalHistoryMeta &&
            typeof data.clinicalHistoryMeta === 'object'
                ? data.clinicalHistoryMeta
                : fallbackState?.clinicalHistoryMeta || null,
        mediaFlowMeta:
            data.mediaFlowMeta && typeof data.mediaFlowMeta === 'object'
                ? data.mediaFlowMeta
                : fallbackState?.mediaFlowMeta || null,
        telemedicineMeta:
            data.telemedicineMeta && typeof data.telemedicineMeta === 'object'
                ? data.telemedicineMeta
                : fallbackState?.telemedicineMeta || null,
        checkoutReviewMeta:
            data.checkoutReviewMeta &&
            typeof data.checkoutReviewMeta === 'object'
                ? data.checkoutReviewMeta
                : fallbackState?.checkoutReviewMeta || null,
        paymentAccountMeta:
            data.paymentAccountMeta &&
            typeof data.paymentAccountMeta === 'object'
                ? data.paymentAccountMeta
                : fallbackState?.paymentAccountMeta || null,
        multiClinicOverview:
            data.multiClinicOverview &&
            typeof data.multiClinicOverview === 'object'
                ? data.multiClinicOverview
                : fallbackState?.multiClinicOverview || null,
        queueSurfaceStatus:
            data.queueSurfaceStatus &&
            typeof data.queueSurfaceStatus === 'object'
                ? data.queueSurfaceStatus
                : data.queue_surface_status &&
                    typeof data.queue_surface_status === 'object'
                  ? data.queue_surface_status
                  : fallbackState?.queueSurfaceStatus || null,
        appDownloads:
            data.appDownloads && typeof data.appDownloads === 'object'
                ? data.appDownloads
                : fallbackState?.appDownloads || null,
        turneroClinicProfile:
            data.turneroClinicProfile &&
            typeof data.turneroClinicProfile === 'object'
                ? data.turneroClinicProfile
                : fallbackState?.turneroClinicProfile || null,
        turneroClinicProfileMeta:
            data.turneroClinicProfileMeta &&
            typeof data.turneroClinicProfileMeta === 'object'
                ? data.turneroClinicProfileMeta
                : fallbackState?.turneroClinicProfileMeta || null,
        turneroClinicProfileCatalogStatus:
            data.turneroClinicProfileCatalogStatus &&
            typeof data.turneroClinicProfileCatalogStatus === 'object'
                ? data.turneroClinicProfileCatalogStatus
                : fallbackState?.turneroClinicProfileCatalogStatus || null,
        turneroClinicProfiles: Array.isArray(data.turneroClinicProfiles)
            ? data.turneroClinicProfiles
            : fallbackState?.turneroClinicProfiles || [],
        turneroRegionalClinics: Array.isArray(data.turneroRegionalClinics)
            ? data.turneroRegionalClinics
            : fallbackState?.turneroRegionalClinics || [],
        turneroOperatorAccessMeta:
            data.turneroOperatorAccessMeta &&
            typeof data.turneroOperatorAccessMeta === 'object'
                ? data.turneroOperatorAccessMeta
                : fallbackState?.turneroOperatorAccessMeta || null,
        turneroV2Readiness:
            data.turneroV2Readiness &&
            typeof data.turneroV2Readiness === 'object'
                ? data.turneroV2Readiness
                : fallbackState?.turneroV2Readiness || null,
        internalConsoleMeta:
            data.internalConsoleMeta &&
            typeof data.internalConsoleMeta === 'object'
                ? data.internalConsoleMeta
                : fallbackState?.internalConsoleMeta || null,
        funnelMetrics:
            data.funnelMetrics || fallbackState?.funnelMetrics || null,
        health: healthPayload && healthPayload.ok ? healthPayload : null,
    };
}

export function normalizeAdminStorePayload(payload, currentFunnelMetrics) {
    return {
        appointments: payload.appointments || [],
        callbacks: normalizeCallbacks(payload.callbacks || []),
        reviewsMeta: payload.reviewsMeta || { items: [], totalReviews: 0, averageRating: 0, last5Reviews: [] },
        availability: payload.availability || {},
        availabilityMeta: payload.availabilityMeta || {},
        doctorProfile: payload.doctorProfile || null,
        clinicProfile: payload.clinicProfile || null,
        queueTickets: payload.queueTickets || [],
        queueMeta: payload.queueMeta || null,
        leadOpsMeta: payload.leadOpsMeta || null,
        patientFlowMeta: payload.patientFlowMeta || null,
        clinicalHistoryMeta: payload.clinicalHistoryMeta || null,
        mediaFlowMeta: payload.mediaFlowMeta || null,
        telemedicineMeta: payload.telemedicineMeta || null,
        checkoutReviewMeta: payload.checkoutReviewMeta || null,
        paymentAccountMeta: payload.paymentAccountMeta || null,
        multiClinicOverview: payload.multiClinicOverview || null,
        queueSurfaceStatus: payload.queueSurfaceStatus || null,
        appDownloads: payload.appDownloads || null,
        turneroClinicProfile: payload.turneroClinicProfile || null,
        turneroClinicProfileMeta: payload.turneroClinicProfileMeta || null,
        turneroClinicProfileCatalogStatus:
            payload.turneroClinicProfileCatalogStatus || null,
        turneroClinicProfiles: payload.turneroClinicProfiles || [],
        turneroRegionalClinics: payload.turneroRegionalClinics || [],
        turneroOperatorAccessMeta: payload.turneroOperatorAccessMeta || null,
        turneroV2Readiness: payload.turneroV2Readiness || null,
        internalConsoleMeta: payload.internalConsoleMeta || null,
        funnelMetrics: payload.funnelMetrics || currentFunnelMetrics,
        health: payload.health || null,
    };
}
