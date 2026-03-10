import { getState } from '../../../core/store.js';
import { escapeHtml, formatDateTime, setHtml } from '../../../ui/render.js';

export function renderQueueActivity() {
    const activity = getState().queue.activity || [];
    setHtml(
        '#queueActivityList',
        activity.length
            ? activity
                  .map(
                      (item) =>
                          `<li><span>${escapeHtml(formatDateTime(item.at))}</span><strong>${escapeHtml(item.message)}</strong></li>`
                  )
                  .join('')
            : '<li><span>-</span><strong>Sin actividad</strong></li>'
    );
}
