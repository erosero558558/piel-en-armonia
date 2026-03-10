import { setText } from '../../../shared/ui/render.js';
import {
    phoneLabel,
    waitBand,
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
            ? `${ops.pendingCount} pendiente(s), ${ops.urgentCount} fuera de SLA y ${visibleCount} visibles.`
            : 'Sin callbacks pendientes.'
    );
    setText(
        '#callbacksDeckHint',
        ops.urgentCount > 0
            ? 'Escala primero los casos criticos.'
            : ops.pendingCount > 0
              ? 'La cola se puede drenar en esta misma vista.'
              : 'Sin bloqueos'
    );

    const queueChip = document.getElementById('callbacksQueueChip');
    if (queueChip) {
        queueChip.textContent =
            ops.queueState === 'danger'
                ? 'SLA comprometido'
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
    setText('#callbacksNextPreference', next ? next.preferencia || '-' : '-');
    setText(
        '#callbacksNextState',
        next ? waitBand(waitingMinutes(next)).label : 'Pendiente'
    );

    const selectionChip = document.getElementById('callbacksSelectionChip');
    if (selectionChip) {
        selectionChip.classList.toggle('is-hidden', selectedCount === 0);
    }
    setText('#callbacksSelectedCount', selectedCount);
}
