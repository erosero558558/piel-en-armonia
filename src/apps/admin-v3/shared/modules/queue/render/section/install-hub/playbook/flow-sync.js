const OPENING_PLAYBOOK_STEP_MAP = Object.freeze({
    opening_operator: ['operator_ready'],
    opening_kiosk: ['kiosk_ready'],
    opening_sala: ['sala_ready'],
});

const CLOSING_PLAYBOOK_STEP_MAP = Object.freeze({
    closing_queue: ['queue_clear'],
    closing_surfaces: ['operator_handoff', 'kiosk_handoff', 'sala_handoff'],
});

function getModeStepMap(mode) {
    if (mode === 'opening') {
        return OPENING_PLAYBOOK_STEP_MAP;
    }
    if (mode === 'closing') {
        return CLOSING_PLAYBOOK_STEP_MAP;
    }
    return {};
}

function dedupeStepIds(stepIds) {
    return Array.from(
        new Set(
            (Array.isArray(stepIds) ? stepIds : []).filter(
                (stepId) => String(stepId || '').trim().length > 0
            )
        )
    );
}

export function getPlaybookLinkedStepIds(mode, stepId) {
    const stepMap = getModeStepMap(mode);
    return dedupeStepIds(stepMap[String(stepId || '').trim()] || []);
}

export function mapPlaybookStepIdsToLinkedIds(mode, stepIds) {
    return dedupeStepIds(
        (Array.isArray(stepIds) ? stepIds : []).flatMap((stepId) =>
            getPlaybookLinkedStepIds(mode, stepId)
        )
    );
}

export function buildLinkedPlaybookModeState(mode, modeState, sources = {}) {
    const safeModeState =
        modeState && typeof modeState === 'object' ? modeState : {};

    if (mode === 'opening') {
        const openingSteps =
            sources.openingState && typeof sources.openingState === 'object'
                ? sources.openingState.steps || {}
                : {};
        return {
            ...safeModeState,
            opening_operator: Boolean(openingSteps.operator_ready),
            opening_kiosk: Boolean(openingSteps.kiosk_ready),
            opening_sala: Boolean(openingSteps.sala_ready),
        };
    }

    if (mode === 'closing') {
        const shiftSteps =
            sources.shiftState && typeof sources.shiftState === 'object'
                ? sources.shiftState.steps || {}
                : {};
        return {
            ...safeModeState,
            closing_queue: Boolean(shiftSteps.queue_clear),
            closing_surfaces:
                Boolean(shiftSteps.operator_handoff) &&
                Boolean(shiftSteps.kiosk_handoff) &&
                Boolean(shiftSteps.sala_handoff),
        };
    }

    return safeModeState;
}
