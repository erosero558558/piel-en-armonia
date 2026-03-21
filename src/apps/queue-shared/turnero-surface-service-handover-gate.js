function toText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeChecklistSummary(checklist) {
    const source = asObject(checklist);
    const summary = asObject(source.summary);
    const checks = toArray(source.checks).map((item) => asObject(item));
    const allFromChecks = checks.length;
    const passFromChecks = checks.filter((check) => check.pass === true).length;
    const failFromChecks = checks.filter((check) => check.pass !== true).length;

    return {
        all: Math.max(0, toNumber(summary.all || allFromChecks)),
        pass: Math.max(0, toNumber(summary.pass || passFromChecks)),
        fail: Math.max(0, toNumber(summary.fail || failFromChecks)),
        checks,
    };
}

function normalizePlaybookStatus(value) {
    const normalized = toText(value, 'ready').toLowerCase();
    if (['ready', 'done', 'published'].includes(normalized)) {
        return 'ready';
    }
    if (['watch', 'review', 'pending'].includes(normalized)) {
        return 'watch';
    }
    if (
        ['blocked', 'hold', 'alert', 'critical', 'error', 'draft'].includes(
            normalized
        )
    ) {
        return 'blocked';
    }
    return 'watch';
}

function normalizeRosterStatus(value) {
    const normalized = toText(value, 'active').toLowerCase();
    if (['active', 'assigned', 'primary'].includes(normalized)) {
        return 'active';
    }
    if (
        ['backup', 'watch', 'standby', 'handoff', 'pending'].includes(
            normalized
        )
    ) {
        return 'watch';
    }
    if (
        ['blocked', 'inactive', 'alert', 'critical', 'error'].includes(
            normalized
        )
    ) {
        return 'blocked';
    }
    return 'watch';
}

function normalizeSnapshotState(snapshot = {}) {
    const runtimeState = toText(snapshot.runtimeState, 'unknown').toLowerCase();
    const truthState = toText(snapshot.truth, 'unknown').toLowerCase();
    const playbookState = toText(
        snapshot.playbookState,
        'missing'
    ).toLowerCase();
    const handoverMode = toText(snapshot.handoverMode, 'manual').toLowerCase();
    const supportChannel = toText(snapshot.supportChannel, '').toLowerCase();
    const primaryOwner = toText(snapshot.primaryOwner, '');
    const backupOwner = toText(snapshot.backupOwner, '');

    if (
        ['blocked', 'alert', 'critical', 'error'].includes(runtimeState) ||
        ['blocked', 'alert', 'critical', 'error'].includes(truthState) ||
        ['blocked', 'alert', 'critical', 'error'].includes(playbookState) ||
        ['blocked', 'alert', 'critical', 'error'].includes(handoverMode) ||
        ['blocked', 'alert', 'critical', 'error'].includes(supportChannel)
    ) {
        return 'blocked';
    }

    if (
        playbookState === 'missing' ||
        handoverMode === 'manual' ||
        !primaryOwner ||
        !backupOwner ||
        !supportChannel ||
        ['watch', 'warning', 'review', 'unknown'].includes(runtimeState) ||
        ['watch', 'warning', 'review', 'missing', 'unknown'].includes(
            truthState
        )
    ) {
        return 'watch';
    }

    return 'ready';
}

function normalizeSnapshots(input = {}) {
    const direct = Array.isArray(input.snapshots)
        ? input.snapshots
        : Array.isArray(input.surfacePacks)
          ? input.surfacePacks.map((item) => item?.snapshot || item)
          : input.snapshot
            ? [input.snapshot]
            : [];

    return direct.map((snapshot) => asObject(snapshot));
}

export function buildTurneroSurfaceServiceHandoverGate(input = {}) {
    const checklist = normalizeChecklistSummary(input.checklist);
    const playbook = toArray(input.playbook).map((item) => asObject(item));
    const roster = toArray(input.roster).map((item) => asObject(item));
    const snapshots = normalizeSnapshots(input);

    const playbookStates = playbook.map((entry) =>
        normalizePlaybookStatus(entry.status || entry.state)
    );
    const rosterStates = roster.map((entry) =>
        normalizeRosterStatus(entry.status || entry.state)
    );
    const snapshotStates = snapshots.map((snapshot) =>
        normalizeSnapshotState(snapshot)
    );

    const readyPlaybookCount = playbookStates.filter(
        (status) => status === 'ready'
    ).length;
    const activeOwnerCount = rosterStates.filter(
        (status) => status === 'active'
    ).length;
    const readySnapshotCount = snapshotStates.filter(
        (status) => status === 'ready'
    ).length;
    const watchSnapshotCount = snapshotStates.filter(
        (status) => status === 'watch'
    ).length;
    const blockedSnapshotCount = snapshotStates.filter(
        (status) => status === 'blocked'
    ).length;
    const blockedPlaybookCount = playbookStates.filter(
        (status) => status === 'blocked'
    ).length;
    const blockedRosterCount = rosterStates.filter(
        (status) => status === 'blocked'
    ).length;

    const checklistPct =
        checklist.all > 0 ? (checklist.pass / checklist.all) * 100 : 0;
    const playbookPct =
        playbook.length > 0 ? (readyPlaybookCount / playbook.length) * 100 : 0;
    const rosterPct =
        roster.length > 0 ? (activeOwnerCount / roster.length) * 100 : 0;
    const snapshotPct =
        snapshots.length > 0
            ? (readySnapshotCount * 100 + watchSnapshotCount * 65) /
              snapshots.length
            : 0;

    let score =
        checklistPct * 0.35 +
        playbookPct * 0.3 +
        rosterPct * 0.2 +
        snapshotPct * 0.15;
    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    const hardBlock =
        blockedSnapshotCount > 0 ||
        blockedPlaybookCount > 0 ||
        blockedRosterCount > 0 ||
        (checklist.fail >= 2 &&
            (playbook.length === 0 || roster.length === 0)) ||
        (checklist.all > 0 && checklist.pass === 0);

    const band = hardBlock
        ? 'blocked'
        : score >= 90 && watchSnapshotCount === 0
          ? 'ready'
          : score >= 70
            ? 'watch'
            : 'blocked';

    return {
        score,
        band,
        decision:
            band === 'ready'
                ? 'service-handover-ready'
                : band === 'watch'
                  ? 'review-service-handover'
                  : 'hold-service-handover',
        checklistAll: checklist.all,
        checklistPass: checklist.pass,
        checklistFail: checklist.fail,
        playbookCount: playbook.length,
        readyPlaybookCount,
        rosterCount: roster.length,
        activeOwnerCount,
        snapshotCount: snapshots.length,
        readySnapshotCount,
        watchSnapshotCount,
        blockedSnapshotCount,
        blockedPlaybookCount,
        blockedRosterCount,
        generatedAt: new Date().toISOString(),
    };
}
