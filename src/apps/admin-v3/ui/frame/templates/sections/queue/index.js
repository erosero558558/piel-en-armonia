import { renderQueueSensitiveDialog } from './dialog.js';
import {
    renderQueueAppsHub,
    renderQueueHeader,
    renderQueueKpiGrid,
    renderQueueOpsConsoleSummary,
} from './header.js';
import {
    renderQueueStationControls,
    renderQueueShortcutPanel,
} from './station.js';
import { renderQueueTableShell } from './table.js';
import { renderQueueTriageMeta, renderQueueTriageToolbar } from './triage.js';

export function renderQueueSection() {
    return `
        <section id="queue" class="admin-section" tabindex="-1">
            <div class="sony-panel">
                ${renderQueueHeader()}
                ${renderQueueOpsConsoleSummary()}
                ${renderQueueKpiGrid()}
                ${renderQueueTriageToolbar()}
                ${renderQueueTriageMeta()}
                ${renderQueueTableShell()}
                ${renderQueueStationControls()}
                ${renderQueueShortcutPanel()}
                ${renderQueueAppsHub()}
            </div>

            ${renderQueueSensitiveDialog()}
        </section>
    `;
}
