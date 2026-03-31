import { formatDateTime, setText } from '../../../shared/ui/render.js';
import {
    aiStatusLabel,
    heuristicScore,
    lastContactAt,
    nextActionLabel,
    phoneLabel,
    serviceHint,
    waitingLabel,
    waitingMinutes,
} from '../utils.js';

export function renderCallbackDeck(
    ops,
    visibleCount,
    scopedCount,
    totalCount,
    selectedCount
) {
    setText(
        '#callbacksDeckSummary',
        totalCount > 0
            ? `${ops.pendingCount} sin responder, ${ops.hotCount} hot y ${visibleCount} visibles.${scopedCount !== totalCount ? ` ${scopedCount} pertenecen al dia filtrado.` : ''}`
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
            ? `${serviceHint(next)} · Prioriza ${phoneLabel(next)} antes de seguir con la cola.`
            : 'La siguiente llamada prioritaria aparecera aqui.'
    );
    setText('#callbacksNextScore', next ? heuristicScore(next) : 0);
    setText(
        '#callbacksNextWait',
        next ? waitingLabel(waitingMinutes(next)) : '0 min'
    );
    setText('#callbacksNextPreference', next ? serviceHint(next) : '-');
    setText(
        '#callbacksNextLastContact',
        next
            ? lastContactAt(next)
                ? formatDateTime(lastContactAt(next))
                : 'Sin contacto'
            : 'Sin contacto'
    );
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
