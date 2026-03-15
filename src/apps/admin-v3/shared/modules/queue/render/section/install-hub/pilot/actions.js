export function renderQueueOpsPilotActionMarkup(
    action,
    variant = 'secondary',
    deps
) {
    const { escapeHtml } = deps;
    if (!action) {
        return '';
    }

    const className =
        variant === 'primary'
            ? 'queue-ops-pilot__action queue-ops-pilot__action--primary'
            : 'queue-ops-pilot__action';

    if (action.kind === 'button') {
        return `
            <button
                ${action.id ? `id="${escapeHtml(action.id)}"` : ''}
                type="button"
                class="${className}"
                ${action.action ? `data-action="${escapeHtml(action.action)}"` : ''}
            >
                ${escapeHtml(action.label || 'Continuar')}
            </button>
        `;
    }

    return `
        <a
            ${action.id ? `id="${escapeHtml(action.id)}"` : ''}
            href="${escapeHtml(action.href || '/')}"
            class="${className}"
            ${
                String(action.href || '').startsWith('#')
                    ? ''
                    : 'target="_blank" rel="noopener"'
            }
        >
            ${escapeHtml(action.label || 'Continuar')}
        </a>
    `;
}

export function bindQueueOpsPilotActions(manifest, detectedPlatform, deps) {
    const {
        buildOpeningChecklistAssist,
        buildQueueOpsPilot,
        applyOpeningChecklistSuggestions,
        appendOpsLogEntry,
        createToast,
        getInstallPresetLabel,
        renderQueueFocusMode,
        renderQueueQuickConsole,
        renderQueuePlaybook,
        renderQueueOpsPilot,
        renderOpeningChecklist,
        renderShiftHandoff,
        renderQueueOpsLog,
        renderQueueHubDomainView,
    } = deps;

    const focusPilotHeading = () => {
        const pilotTitle = document.getElementById('queueOpsPilotTitle');
        if (!(pilotTitle instanceof HTMLElement)) {
            return;
        }

        pilotTitle.focus({ preventScroll: true });
        pilotTitle.scrollIntoView({
            block: 'start',
            behavior: 'smooth',
        });
    };

    const copyHandoffButton = document.getElementById(
        'queueOpsPilotHandoffCopyBtn'
    );
    if (copyHandoffButton instanceof HTMLButtonElement) {
        copyHandoffButton.onclick = async () => {
            const pilot = buildQueueOpsPilot(manifest, detectedPlatform);
            const clinicLabel =
                pilot.handoffItems.find((item) => item.id === 'clinic')
                    ?.value || pilot.title;
            const report = [
                `Paquete de apertura - ${pilot.title}`,
                pilot.handoffSummary,
                ...pilot.handoffItems.map(
                    (item) => `${item.label}: ${item.value}`
                ),
                '',
                'Rutas canónicas:',
                ...pilot.canonicalSurfaces.map(
                    (item) => `- ${item.label}: ${item.url || item.route}`
                ),
                '',
                'Secuencia de smoke:',
                ...pilot.smokeSteps.map(
                    (step) =>
                        `- [${step.ready ? 'x' : ' '}] ${step.label}: ${step.detail}`
                ),
            ]
                .join('\n')
                .trim();
            try {
                await navigator.clipboard.writeText(report);
                appendOpsLogEntry({
                    tone: 'success',
                    source: 'pilot_handoff',
                    title: 'Handoff del piloto copiado',
                    summary: `Se copió el paquete de apertura para ${clinicLabel}.`,
                });
                renderQueueFocusMode(manifest, detectedPlatform);
                if (typeof renderQueueHubDomainView === 'function') {
                    renderQueueHubDomainView();
                }
                renderQueueQuickConsole(manifest, detectedPlatform);
                renderQueuePlaybook(manifest, detectedPlatform);
                renderQueueOpsPilot(manifest, detectedPlatform);
                renderOpeningChecklist(manifest, detectedPlatform);
                renderShiftHandoff(manifest, detectedPlatform);
                renderQueueOpsLog(manifest, detectedPlatform);
                createToast('Paquete de apertura copiado', 'success');
            } catch (_error) {
                createToast(
                    'No se pudo copiar el paquete de apertura',
                    'error'
                );
            }
        };
    }

    const applyButton = document.getElementById('queueOpsPilotApplyBtn');
    const flowCtaButton = document.getElementById('queueOpsPilotFlowCta');
    const hasBoundApplyButton =
        applyButton instanceof HTMLButtonElement ||
        flowCtaButton instanceof HTMLButtonElement;
    if (!hasBoundApplyButton) {
        return;
    }

    const runApplySuggestions = () => {
        const assist = buildOpeningChecklistAssist(detectedPlatform);
        if (!assist.suggestedIds.length) {
            return;
        }
        applyOpeningChecklistSuggestions(assist.suggestedIds);
        appendOpsLogEntry({
            tone: 'success',
            source: 'opening',
            title: `Apertura: ${assist.suggestedIds.length} sugerido(s) confirmados`,
            summary: `Se confirmaron pasos de apertura ya validados por telemetría. Perfil activo: ${getInstallPresetLabel(
                detectedPlatform
            )}.`,
        });
        renderQueueFocusMode(manifest, detectedPlatform);
        if (typeof renderQueueHubDomainView === 'function') {
            renderQueueHubDomainView();
        }
        renderQueueQuickConsole(manifest, detectedPlatform);
        renderQueuePlaybook(manifest, detectedPlatform);
        renderQueueOpsPilot(manifest, detectedPlatform);
        renderOpeningChecklist(manifest, detectedPlatform);
        renderShiftHandoff(manifest, detectedPlatform);
        renderQueueOpsLog(manifest, detectedPlatform);
        focusPilotHeading();
    };

    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = runApplySuggestions;
    }

    const shouldBindFlowCta =
        flowCtaButton instanceof HTMLButtonElement &&
        (!flowCtaButton.dataset.action ||
            flowCtaButton.dataset.action ===
                (applyButton instanceof HTMLButtonElement
                    ? applyButton.dataset.action
                    : 'queue-pilot-apply-suggestions') ||
            flowCtaButton.dataset.action === 'queue-pilot-apply-suggestions');
    if (shouldBindFlowCta) {
        flowCtaButton.onclick = runApplySuggestions;
    }
}
