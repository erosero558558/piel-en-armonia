import {
    applyOpeningChecklistSuggestions,
    ensureOpeningChecklistState,
    resetOpeningChecklistState,
    setOpeningChecklistStep,
} from '../../state.js';

export function bindOpeningChecklistStepToggles(root, rerenderAll) {
    root.querySelectorAll('[data-queue-opening-step]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        button.onclick = () => {
            const stepId = String(button.dataset.queueOpeningStep || '');
            const current = ensureOpeningChecklistState();
            setOpeningChecklistStep(stepId, !current.steps[stepId]);
            rerenderAll();
        };
    });
}

export function bindOpeningChecklistActions(assist, rerenderAll) {
    const applyButton = document.getElementById(
        'queueOpeningChecklistApplyBtn'
    );
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            if (!assist.suggestedIds.length) return;
            applyOpeningChecklistSuggestions(assist.suggestedIds);
            rerenderAll();
        };
    }

    const resetButton = document.getElementById(
        'queueOpeningChecklistResetBtn'
    );
    if (resetButton instanceof HTMLButtonElement) {
        resetButton.onclick = () => {
            resetOpeningChecklistState();
            rerenderAll();
        };
    }
}
