import {
    buildDesktopLaunchUrl,
    buildDesktopPreflightFingerprint,
    buildDesktopRuntimePatchFromForm,
    getDesktopPreflightGateState,
} from '../runtime/snapshot-contract.mjs';
import {
    getBootConfigFormView,
    getBootShellView,
} from './boot-shell-view-state.mjs';
import {
    getBootPendingPreflightView,
    getBootPreflightView,
    getBootRetryView,
} from './boot-view-state.mjs';

(function () {
    const titleEl = document.getElementById('bootTitle');
    const messageEl = document.getElementById('bootMessage');
    const surfaceEl = document.getElementById('bootSurface');
    const baseUrlEl = document.getElementById('bootBaseUrl');
    const phaseEl = document.getElementById('bootPhase');
    const retryBtn = document.getElementById('bootRetryBtn');
    const retryCardEl = document.getElementById('bootRetryCard');
    const retrySummaryEl = document.getElementById('bootRetrySummary');
    const retryHintEl = document.getElementById('bootRetryHint');
    const configModeEl = document.getElementById('bootConfigMode');
    const configHintEl = document.getElementById('bootConfigHint');
    const launchUrlPreviewEl = document.getElementById('bootConfigLaunchUrl');
    const openSurfaceBtn = document.getElementById('bootOpenSurfaceBtn');
    const saveBtn = document.getElementById('bootSaveBtn');
    const runPreflightBtn = document.getElementById('bootRunPreflightBtn');
    const preflightSummaryEl = document.getElementById('bootPreflightSummary');
    const preflightChecksEl = document.getElementById('bootPreflightChecks');
    const preflightGateHintEl = document.getElementById(
        'bootPreflightGateHint'
    );
    const supportSummaryEl = document.getElementById('bootSupportSummary');
    const supportProfileEl = document.getElementById('bootSupportProfile');
    const supportProvisioningEl = document.getElementById(
        'bootSupportProvisioning'
    );
    const shellRuntimeCardEl = document.getElementById('bootShellRuntimeCard');
    const shellRuntimeModeEl = document.getElementById('bootShellRuntimeMode');
    const shellRuntimeSummaryEl = document.getElementById(
        'bootShellRuntimeSummary'
    );
    const shellRuntimeMetaEl = document.getElementById('bootShellRuntimeMeta');
    const supportFeedUrlEl = document.getElementById('bootSupportFeedUrl');
    const supportGuideUrlEl = document.getElementById('bootSupportGuideUrl');
    const supportConfigPathEl = document.getElementById(
        'bootSupportConfigPath'
    );
    const configForm = document.getElementById('bootConfigForm');
    const baseUrlInput = document.getElementById('bootConfigBaseUrl');
    const profileSelect = document.getElementById('bootConfigProfile');
    const oneTapInput = document.getElementById('bootConfigOneTap');
    const launchModeSelect = document.getElementById('bootConfigLaunchMode');
    const autoStartInput = document.getElementById('bootConfigAutoStart');
    const operatorFields = document.getElementById('bootConfigOperatorFields');
    const supportCopyButtons = Array.from(
        document.querySelectorAll('[data-boot-copy-target]')
    );

    let latestSnapshot = null;
    let lastPreflightRunToken = 0;
    let latestPreflightReport = null;
    let lastPreflightFingerprint = '';
    let preflightRunning = false;
    let retryCountdownTimer = 0;

    function setSupportValue(element, value) {
        if (!(element instanceof HTMLElement)) {
            return;
        }

        const normalized = String(value || '').trim();
        element.textContent = normalized || '-';
        element.dataset.copyValue = normalized;
    }

    function syncSupportCopyButtons() {
        supportCopyButtons.forEach((button) => {
            if (!(button instanceof HTMLButtonElement)) {
                return;
            }

            const targetId = String(button.dataset.bootCopyTarget || '').trim();
            const targetEl = targetId
                ? document.getElementById(targetId)
                : null;
            const copyValue =
                targetEl instanceof HTMLElement
                    ? String(targetEl.dataset.copyValue || '').trim()
                    : '';
            button.disabled = copyValue === '';
            button.title =
                copyValue === ''
                    ? 'Sin dato disponible para copiar'
                    : 'Copiar al portapapeles';
        });
    }

    function renderSupport(supportView) {
        const view =
            supportView && typeof supportView === 'object' ? supportView : {};

        if (supportSummaryEl instanceof HTMLElement) {
            supportSummaryEl.textContent = String(view.summary || '');
        }

        if (supportProfileEl instanceof HTMLElement) {
            supportProfileEl.textContent = String(view.profile || '');
        }
        if (supportProvisioningEl instanceof HTMLElement) {
            supportProvisioningEl.textContent = String(view.provisioning || '');
        }

        setSupportValue(supportFeedUrlEl, view.feedUrl);
        setSupportValue(supportGuideUrlEl, view.guideUrl);
        setSupportValue(supportConfigPathEl, view.configPath);
        syncSupportCopyButtons();
    }

    function formatRelativeAge(seconds) {
        const ageSec = Number(seconds);
        if (!Number.isFinite(ageSec) || ageSec < 0) {
            return 'sin sync válido';
        }
        if (ageSec < 60) {
            return `${Math.round(ageSec)}s`;
        }
        if (ageSec < 3600) {
            return `${Math.round(ageSec / 60)}m`;
        }
        return `${Math.round(ageSec / 3600)}h`;
    }

    function formatIsoDate(value) {
        const date = new Date(value || '');
        if (Number.isNaN(date.getTime())) {
            return 'sin registro';
        }
        return date.toLocaleString('es-EC', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function renderShellRuntime(shellStatus, shellSnapshot) {
        if (
            !(shellRuntimeCardEl instanceof HTMLElement) ||
            !(shellRuntimeModeEl instanceof HTMLElement) ||
            !(shellRuntimeSummaryEl instanceof HTMLElement) ||
            !(shellRuntimeMetaEl instanceof HTMLElement)
        ) {
            return;
        }

        const status =
            shellStatus && typeof shellStatus === 'object' ? shellStatus : null;
        const snapshot =
            shellSnapshot && typeof shellSnapshot === 'object'
                ? shellSnapshot
                : null;
        const mode = String(status?.mode || 'safe')
            .trim()
            .toLowerCase();
        const state =
            mode === 'live'
                ? 'ready'
                : mode === 'offline'
                  ? 'warning'
                  : 'danger';
        const reconciliationSize = Number(status?.reconciliationSize || 0);
        const outboxSize = Number(status?.outboxSize || 0);

        let summary =
            'Solo lectura hasta recuperar red y confirmar una sesión válida.';
        if (mode === 'live') {
            summary =
                reconciliationSize > 0
                    ? 'En línea, pero hay acciones pendientes de conciliación.'
                    : 'Equipo conectado y listo para sincronizar en vivo.';
        } else if (mode === 'offline') {
            summary =
                'Offline operativo con snapshot fresco y replay pendiente al reconectar.';
        } else if (status?.reason === 'reconciliation_pending') {
            summary =
                'Modo seguro por conciliación pendiente. Limpia el outbox antes de volver a contingencia.';
        } else if (status?.reason === 'snapshot_expired') {
            summary =
                'Modo seguro: el último snapshot ya venció y no conviene operar así.';
        } else if (status?.reason === 'no_authenticated_session') {
            summary =
                'Modo seguro: no hay sesión previa válida y el login offline no está habilitado.';
        }

        shellRuntimeCardEl.setAttribute('data-state', state);
        shellRuntimeModeEl.textContent =
            mode === 'live' ? 'live' : mode === 'offline' ? 'offline' : 'safe';
        shellRuntimeSummaryEl.textContent = summary;
        shellRuntimeMetaEl.textContent = [
            `Sync ${formatIsoDate(status?.lastSuccessfulSyncAt)}`,
            `edad ${formatRelativeAge(status?.snapshotAgeSec)}`,
            `outbox ${outboxSize}`,
            `conciliación ${reconciliationSize}`,
            `canal ${String(status?.updateChannel || 'stable')}`,
            snapshot?.hasAuthenticatedSession
                ? 'sesión previa OK'
                : 'sin sesión previa',
        ].join(' · ');
    }

    function clearRetryCountdownTimer() {
        if (retryCountdownTimer) {
            window.clearInterval(retryCountdownTimer);
            retryCountdownTimer = 0;
        }
    }

    function renderRetryState(now = Date.now()) {
        const retryState = getBootRetryView(latestSnapshot, now);

        if (!(retryCardEl instanceof HTMLElement)) {
            return;
        }

        if (!retryState) {
            retryCardEl.hidden = true;
            clearRetryCountdownTimer();
            return;
        }

        retryCardEl.hidden = false;
        if (retrySummaryEl instanceof HTMLElement) {
            retrySummaryEl.textContent = retryState.summary;
        }
        if (retryHintEl instanceof HTMLElement) {
            retryHintEl.textContent = retryState.hint;
        }

        if (!retryCountdownTimer) {
            retryCountdownTimer = window.setInterval(() => {
                renderRetryState(Date.now());
            }, 1000);
        }
    }

    function getFormPayload() {
        return {
            surface: latestSnapshot?.config?.surface || 'operator',
            baseUrl:
                baseUrlInput instanceof HTMLInputElement
                    ? baseUrlInput.value
                    : 'https://pielarmonia.com',
            profile:
                profileSelect instanceof HTMLSelectElement
                    ? profileSelect.value
                    : 'free',
            launchMode:
                launchModeSelect instanceof HTMLSelectElement
                    ? launchModeSelect.value
                    : 'fullscreen',
            autoStart:
                autoStartInput instanceof HTMLInputElement
                    ? autoStartInput.checked
                    : true,
            oneTap:
                oneTapInput instanceof HTMLInputElement
                    ? oneTapInput.checked
                    : false,
        };
    }

    function getRuntimePatchFromForm() {
        return buildDesktopRuntimePatchFromForm(getFormPayload());
    }

    function getPreflightFingerprint() {
        return buildDesktopPreflightFingerprint(
            latestSnapshot,
            getRuntimePatchFromForm()
        );
    }

    function getPreflightGateState() {
        return getDesktopPreflightGateState({
            snapshot: latestSnapshot,
            preflightRunning,
            preflightReport: latestPreflightReport,
            preflightFingerprint: lastPreflightFingerprint,
            currentFingerprint: getPreflightFingerprint(),
        });
    }

    function syncLaunchGuard() {
        const gate = getPreflightGateState();

        if (saveBtn instanceof HTMLButtonElement) {
            saveBtn.disabled = gate.blocked;
            saveBtn.title = gate.detail;
        }

        if (openSurfaceBtn instanceof HTMLButtonElement) {
            openSurfaceBtn.disabled = gate.blocked;
            openSurfaceBtn.title = gate.detail;
        }

        if (preflightGateHintEl instanceof HTMLElement) {
            preflightGateHintEl.setAttribute('data-state', gate.state);
            preflightGateHintEl.textContent = gate.detail;
        }
    }

    function renderLaunchPreview() {
        if (!launchUrlPreviewEl) {
            return;
        }
        launchUrlPreviewEl.textContent = buildDesktopLaunchUrl(
            getRuntimePatchFromForm()
        );
    }

    function renderPreflight(report) {
        const viewState = getBootPreflightView(report);

        if (preflightSummaryEl instanceof HTMLElement) {
            preflightSummaryEl.setAttribute(
                'data-state',
                viewState.summaryState
            );
            preflightSummaryEl.textContent = viewState.summaryText;
        }

        if (preflightChecksEl instanceof HTMLElement) {
            preflightChecksEl.innerHTML = viewState.checks
                .map(
                    (check) => `
                        <article class="boot-preflight__check" data-state="${String(
                            check.state || 'warning'
                        )}">
                            <strong>${String(check.label || check.id || 'Check')}</strong>
                            <span>${String(check.detail || '')}</span>
                        </article>
                    `
                )
                .join('');
        }

        syncLaunchGuard();
    }

    async function runPreflight() {
        if (
            !window.turneroDesktop ||
            typeof window.turneroDesktop.runPreflight !== 'function'
        ) {
            latestPreflightReport = null;
            lastPreflightFingerprint = '';
            renderPreflight(null);
            return;
        }

        const token = Date.now();
        const fingerprint = getPreflightFingerprint();
        lastPreflightRunToken = token;
        preflightRunning = true;
        syncLaunchGuard();

        if (runPreflightBtn instanceof HTMLButtonElement) {
            runPreflightBtn.disabled = true;
        }
        if (preflightSummaryEl instanceof HTMLElement) {
            const pendingView = getBootPendingPreflightView();
            preflightSummaryEl.setAttribute(
                'data-state',
                pendingView.summaryState
            );
            preflightSummaryEl.textContent = pendingView.summaryText;
        }

        try {
            const report = await window.turneroDesktop.runPreflight(
                getRuntimePatchFromForm()
            );
            if (lastPreflightRunToken === token) {
                latestPreflightReport =
                    report && typeof report === 'object' ? report : null;
                lastPreflightFingerprint = fingerprint;
                renderPreflight(report);
            }
        } catch (_error) {
            if (lastPreflightRunToken === token) {
                latestPreflightReport = {
                    state: 'danger',
                    title: 'No se pudo comprobar el equipo',
                    summary:
                        'La verificación remota falló antes de completar el checklist.',
                    checks: [],
                };
                lastPreflightFingerprint = fingerprint;
                renderPreflight(latestPreflightReport);
            }
        } finally {
            if (lastPreflightRunToken === token) {
                preflightRunning = false;
            }
            if (runPreflightBtn instanceof HTMLButtonElement) {
                runPreflightBtn.disabled = false;
            }
            syncLaunchGuard();
        }
    }

    function hydrateForm(snapshot) {
        const formView = getBootConfigFormView(snapshot);

        if (baseUrlInput instanceof HTMLInputElement) {
            baseUrlInput.value = formView.baseUrl;
        }
        if (profileSelect instanceof HTMLSelectElement) {
            profileSelect.value = formView.profile;
        }
        if (oneTapInput instanceof HTMLInputElement) {
            oneTapInput.checked = formView.oneTap;
        }
        if (launchModeSelect instanceof HTMLSelectElement) {
            launchModeSelect.value = formView.launchMode;
        }
        if (autoStartInput instanceof HTMLInputElement) {
            autoStartInput.checked = formView.autoStart;
        }
        if (operatorFields instanceof HTMLElement) {
            operatorFields.hidden = !formView.operator;
        }
        renderLaunchPreview();
    }

    function render(snapshot) {
        if (!snapshot) {
            return;
        }

        latestSnapshot = snapshot;
        const shellView = getBootShellView(snapshot);

        if (titleEl) {
            titleEl.textContent = shellView.title;
        }
        if (surfaceEl) {
            surfaceEl.textContent = shellView.surface;
        }
        if (baseUrlEl) {
            baseUrlEl.textContent = shellView.baseUrl;
        }
        if (phaseEl) {
            phaseEl.textContent = shellView.phase;
        }
        if (configModeEl) {
            configModeEl.textContent = shellView.configMode;
        }
        if (configHintEl) {
            configHintEl.innerHTML = shellView.configHintHtml;
        }
        if (openSurfaceBtn instanceof HTMLButtonElement) {
            openSurfaceBtn.hidden = Boolean(shellView.openSurfaceHidden);
            openSurfaceBtn.textContent = shellView.openSurfaceLabel;
        }
        if (messageEl) {
            messageEl.textContent = shellView.message;
        }

        hydrateForm(snapshot);
        renderSupport(shellView.support);
        renderShellRuntime(snapshot.shellStatus, snapshot.shellSnapshot);
        renderRetryState();
        syncLaunchGuard();
    }

    async function refreshSnapshot() {
        if (!window.turneroDesktop) {
            return;
        }

        const [snapshot, shellStatus, shellSnapshot] = await Promise.all([
            window.turneroDesktop.getRuntimeSnapshot(),
            typeof window.turneroDesktop.getShellStatus === 'function'
                ? window.turneroDesktop.getShellStatus()
                : Promise.resolve(null),
            typeof window.turneroDesktop.getOfflineSnapshot === 'function'
                ? window.turneroDesktop.getOfflineSnapshot()
                : Promise.resolve(null),
        ]);
        render({
            ...snapshot,
            ...snapshot.status,
            shellStatus,
            shellSnapshot,
        });
    }

    if (window.turneroDesktop) {
        refreshSnapshot()
            .then(() => runPreflight())
            .catch(() => {});

        window.turneroDesktop.onBootStatus(() => {
            refreshSnapshot().catch(() => {});
        });
        if (typeof window.turneroDesktop.onShellEvent === 'function') {
            window.turneroDesktop.onShellEvent((payload) => {
                renderShellRuntime(payload?.status, payload);
            });
        }
    }

    if (retryBtn && window.turneroDesktop) {
        retryBtn.addEventListener('click', () => {
            retryBtn.disabled = true;
            window.turneroDesktop.retryLoad().finally(() => {
                retryBtn.disabled = false;
            });
        });
    }

    if (configForm instanceof HTMLFormElement && window.turneroDesktop) {
        configForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const gate = getPreflightGateState();
            if (gate.blocked) {
                syncLaunchGuard();
                return;
            }

            if (saveBtn instanceof HTMLButtonElement) {
                saveBtn.disabled = true;
            }

            window.turneroDesktop
                .saveRuntimeConfig(getRuntimePatchFromForm())
                .then(() => window.turneroDesktop.openSurface())
                .catch(() => {})
                .finally(() => {
                    if (saveBtn instanceof HTMLButtonElement) {
                        saveBtn.disabled = false;
                    }
                    syncLaunchGuard();
                });
        });
    }

    if (openSurfaceBtn && window.turneroDesktop) {
        openSurfaceBtn.addEventListener('click', () => {
            const gate = getPreflightGateState();
            if (gate.blocked) {
                syncLaunchGuard();
                return;
            }

            openSurfaceBtn.disabled = true;
            window.turneroDesktop.openSurface().finally(() => {
                syncLaunchGuard();
            });
        });
    }

    if (runPreflightBtn && window.turneroDesktop) {
        runPreflightBtn.addEventListener('click', () => {
            void runPreflight();
        });
    }

    supportCopyButtons.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }

        const defaultLabel = String(button.textContent || 'Copiar').trim();
        button.dataset.defaultLabel = defaultLabel;
        button.addEventListener('click', async () => {
            const targetId = String(button.dataset.bootCopyTarget || '').trim();
            const targetEl = targetId
                ? document.getElementById(targetId)
                : null;
            const copyValue =
                targetEl instanceof HTMLElement
                    ? String(targetEl.dataset.copyValue || '').trim()
                    : '';
            if (!copyValue || !navigator.clipboard?.writeText) {
                return;
            }

            button.disabled = true;
            try {
                await navigator.clipboard.writeText(copyValue);
                button.textContent = 'Copiado';
            } catch (_error) {
                button.textContent = 'Sin copiar';
            } finally {
                window.setTimeout(() => {
                    button.textContent =
                        button.dataset.defaultLabel || 'Copiar';
                    syncSupportCopyButtons();
                }, 1200);
            }
        });
    });

    [baseUrlInput, profileSelect, oneTapInput, launchModeSelect, autoStartInput]
        .filter(Boolean)
        .forEach((element) => {
            element.addEventListener('input', () => {
                renderLaunchPreview();
                syncLaunchGuard();
            });
            element.addEventListener('change', renderLaunchPreview);
            element.addEventListener('change', () => {
                syncLaunchGuard();
                void runPreflight();
            });
        });

    renderPreflight(null);
    syncSupportCopyButtons();
})();
