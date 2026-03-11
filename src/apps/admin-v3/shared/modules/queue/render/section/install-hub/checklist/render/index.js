import { setHtml } from '../../../../../../../ui/render.js';
import { ensureOpeningChecklistState } from '../../state.js';
import { buildOpeningChecklistAssist } from '../assist.js';
import { buildOpeningChecklistSteps } from '../steps.js';
import {
    bindOpeningChecklistActions,
    bindOpeningChecklistStepToggles,
} from './bindings.js';
import { renderOpeningChecklistShell } from './shell.js';

export function renderOpeningChecklist(
    manifest,
    detectedPlatform,
    rerenderAll
) {
    const root = document.getElementById('queueOpeningChecklist');
    if (!(root instanceof HTMLElement)) return;

    const checklist = ensureOpeningChecklistState();
    const steps = buildOpeningChecklistSteps(manifest, detectedPlatform);
    const assist = buildOpeningChecklistAssist(detectedPlatform);

    setHtml(
        '#queueOpeningChecklist',
        renderOpeningChecklistShell(steps, checklist, assist)
    );

    bindOpeningChecklistStepToggles(root, rerenderAll);
    bindOpeningChecklistActions(assist, rerenderAll);
}
