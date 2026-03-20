export function buildTurneroReleaseFinalRepoReadout(pack = {}) {
    const lines = [
        '# Final Diagnostic Launch Console',
        '',
        `Launch gate: ${pack.launchGate?.score ?? 0} (${
            pack.launchGate?.band || 'n/a'
        })`,
        `Decision: ${pack.launchGate?.decision || 'review'}`,
        `Evidence lock: ${pack.lock?.status || 'unlocked'}`,
        `Frozen blockers: ${pack.freezeBoard?.summary?.frozen ?? 0}`,
        `High frozen blockers: ${pack.freezeBoard?.summary?.high ?? 0}`,
        `Signoffs approved: ${pack.launchGate?.approved ?? 0}/${
            pack.launchGate?.totalSignoffs ?? 0
        }`,
    ];

    return {
        markdown: lines.join('\n'),
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseFinalRepoReadout;
