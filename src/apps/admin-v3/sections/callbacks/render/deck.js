import { setText } from '../../../shared/ui/render.js';
import {
    aiStatusLabel,
    nextActionLabel,
    phoneLabel,
    serviceHint,
    waitingLabel,
    waitingMinutes,
} from '../utils.js';

export function renderCallbackDeck(
    ops,
    visibleCount,
    totalCount,
    selectedCount
) {
    setText(
        '#callbacksDeckSummary',
        totalCount > 0
            ? `${ops.pendingCount} pendiente(s), ${ops.hotCount} hot y ${visibleCount} visibles.`
            : 'Sin callbacks pendientes.'
    );
    const queueChip = document.getElementById('callbacksQueueChip');
    if (queueChip) {
        queueChip.textContent =
            ops.queueState === 'danger'
                ? 'Prioridad alta'
                : ops.queueState === 'warning'
                  ? 'Cola activa'
                  : 'Cola estable';
        queueChip.setAttribute('data-state', ops.queueState);
    }

    const queueHealth = document.getElementById('callbacksOpsQueueHealth');
    if (queueHealth) {
        queueHealth.setAttribute('data-state', ops.queueState);
    }

    const next = ops.next;
    setText('#callbacksOpsNext', next ? phoneLabel(next) : 'Sin telefono');
    setText(
        '#callbacksNextSummary',
        next
            ? `Prioriza ${phoneLabel(next)} antes de seguir con la cola.`
            : 'La siguiente llamada prioritaria aparecera aqui.'
    );
    setText(
        '#callbacksNextWait',
        next ? waitingLabel(waitingMinutes(next)) : '0 min'
    );
    setText('#callbacksNextPreference', next ? serviceHint(next) : '-');
    setText('#callbacksNextState', next ? nextActionLabel(next) : 'Pendiente');
    setText(
        '#callbacksDeckHint',
        next ? aiStatusLabel(next, ops.workerMode) : 'Sin bloqueos'
    );

    const selectionChip = document.getElementById('callbacksSelectionChip');
    if (selectionChip) {
        selectionChip.classList.toggle('is-hidden', selectedCount === 0);
    }
    setText('#callbacksSelectedCount', selectedCount);
}
