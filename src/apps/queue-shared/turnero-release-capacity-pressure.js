function toText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function safeNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function groupBy(items, pick) {
    return items.reduce((acc, item) => {
        const key = pick(item);
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(item);
        return acc;
    }, {});
}

function getClinicProfile(context = {}) {
    return (
        context.turneroClinicProfile ||
        context.clinicProfile ||
        context.profile ||
        context.rollout?.clinicProfile ||
        {}
    );
}

function buildFallbackClinic(context = {}) {
    const profile = getClinicProfile(context);
    const clinicId = toText(
        context.clinicId ||
            context.scope ||
            profile.clinic_id ||
            profile.clinicId ||
            'default-clinic',
        'default-clinic'
    );
    const clinicLabel = toText(
        profile.branding?.short_name ||
            profile.branding?.name ||
            profile.clinicName ||
            profile.clinic_name ||
            clinicId,
        clinicId
    );
    const region = toText(
        profile.region ||
            profile.address?.region ||
            profile.location?.region ||
            profile.geo?.region ||
            context.region ||
            'regional',
        'regional'
    );
    const ownerTeam = toText(
        profile.release?.ownerTeam ||
            profile.release?.owner_team ||
            profile.release?.programOfficeOwner ||
            profile.release?.owner ||
            context.ownerTeam ||
            'regional-ops',
        'regional-ops'
    );
    const cohort = toText(
        profile.release?.cohort ||
            profile.release?.target_cohort ||
            profile.release?.targetCohort ||
            context.cohort ||
            'pilot',
        'pilot'
    );
    const score = safeNumber(profile.release?.score, 72);
    const decision = toText(profile.release?.decision || 'ready', 'ready');
    const blockingCount = decision === 'hold' ? 1 : 0;

    return {
        clinicId,
        clinicLabel,
        region,
        ownerTeam,
        cohort,
        decision,
        score,
        blockingCount,
        incidentLoad: blockingCount,
    };
}

function normalizeClinic(item, index) {
    return {
        clinicId: item.clinicId || `clinic-${index + 1}`,
        clinicLabel:
            item.clinicLabel ||
            item.label ||
            item.clinicId ||
            `Clinic ${index + 1}`,
        region: item.region || 'unknown',
        ownerTeam: item.ownerTeam || item.owner || 'unassigned',
        cohort: item.cohort || 'backlog',
        decision: item.decision || 'review',
        score: safeNumber(item.score, 50),
        blockingCount: safeNumber(item.blockingCount, 0),
        incidentLoad: safeNumber(
            item.incidentLoad,
            safeNumber(item.blockingCount, 0)
        ),
    };
}

export function buildCapacityPressure(context = {}) {
    const source = Array.isArray(context.rollout?.cohortPlanner?.plans)
        ? context.rollout.cohortPlanner.plans
        : Array.isArray(context.plans)
          ? context.plans
          : Array.isArray(context.clinics)
            ? context.clinics
            : [];
    const clinics = (
        source.length ? source : [buildFallbackClinic(context)]
    ).map(normalizeClinic);
    const byOwner = groupBy(clinics, (item) => item.ownerTeam);
    const byRegion = groupBy(clinics, (item) => item.region);
    const byCohort = groupBy(clinics, (item) => item.cohort);

    const owners = Object.entries(byOwner)
        .map(([owner, ownerClinics]) => {
            const clinicCount = ownerClinics.length;
            const incidents = ownerClinics.reduce(
                (sum, item) => sum + item.incidentLoad,
                0
            );
            const blocking = ownerClinics.reduce(
                (sum, item) => sum + item.blockingCount,
                0
            );
            const avgScore = Math.round(
                ownerClinics.reduce((sum, item) => sum + item.score, 0) /
                    Math.max(1, clinicCount)
            );
            const coverageGap =
                clinicCount >= 4 ? 'high' : clinicCount >= 2 ? 'medium' : 'low';
            const singlePointRisk =
                clinicCount <= 1
                    ? 'high'
                    : clinicCount === 2
                      ? 'medium'
                      : 'low';
            const queuePressure = incidents + blocking;
            const expansionCapacity =
                singlePointRisk === 'high' || avgScore < 55
                    ? 'low'
                    : queuePressure > clinicCount * 2
                      ? 'medium'
                      : 'high';

            return {
                owner,
                clinicCount,
                incidents,
                blocking,
                avgScore,
                coverageGap,
                singlePointRisk,
                queuePressure,
                expansionCapacity,
            };
        })
        .sort(
            (a, b) =>
                b.queuePressure - a.queuePressure || a.avgScore - b.avgScore
        );

    const regions = Object.entries(byRegion)
        .map(([region, regionClinics]) => {
            const clinicCount = regionClinics.length;
            const uniqueOwners = [
                ...new Set(regionClinics.map((item) => item.ownerTeam)),
            ].filter(Boolean);
            const blocking = regionClinics.reduce(
                (sum, item) => sum + item.blockingCount,
                0
            );
            const avgScore = Math.round(
                regionClinics.reduce((sum, item) => sum + item.score, 0) /
                    Math.max(1, clinicCount)
            );
            return {
                region,
                clinicCount,
                uniqueOwners,
                ownerCoverage: uniqueOwners.length,
                blocking,
                avgScore,
                singlePointRisk:
                    uniqueOwners.length <= 1
                        ? 'high'
                        : uniqueOwners.length === 2
                          ? 'medium'
                          : 'low',
                expansionCapacity:
                    avgScore >= 70 && blocking === 0
                        ? 'high'
                        : avgScore >= 55
                          ? 'medium'
                          : 'low',
            };
        })
        .sort((a, b) => a.avgScore - b.avgScore || b.blocking - a.blocking);

    const cohorts = Object.entries(byCohort).map(([cohort, items]) => ({
        cohort,
        clinics: items.length,
        avgScore: Math.round(
            items.reduce((sum, item) => sum + item.score, 0) /
                Math.max(1, items.length)
        ),
        blocking: items.reduce((sum, item) => sum + item.blockingCount, 0),
    }));

    const summary = [
        owners[0]
            ? `Owner más cargado: ${owners[0].owner} (${owners[0].queuePressure})`
            : 'Sin owners',
        regions[0] ? `Región más frágil: ${regions[0].region}` : 'Sin regiones',
        cohorts[0]
            ? `Cohorte visible: ${cohorts
                  .map((item) => `${item.cohort}:${item.clinics}`)
                  .join(', ')}`
            : 'Sin cohortes',
    ].join('\n');

    return {
        clinics,
        owners,
        regions,
        cohorts,
        summary,
        topOwnerRisk: owners[0] || null,
        topRegionRisk: regions[0] || null,
    };
}
