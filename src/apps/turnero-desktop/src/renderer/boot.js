(function () {
    const titleEl = document.getElementById('bootTitle');
    const messageEl = document.getElementById('bootMessage');
    const surfaceEl = document.getElementById('bootSurface');
    const baseUrlEl = document.getElementById('bootBaseUrl');
    const phaseEl = document.getElementById('bootPhase');
    const retryBtn = document.getElementById('bootRetryBtn');
    const configModeEl = document.getElementById('bootConfigMode');
    const configHintEl = document.getElementById('bootConfigHint');
    const launchUrlPreviewEl = document.getElementById('bootConfigLaunchUrl');
    const openSurfaceBtn = document.getElementById('bootOpenSurfaceBtn');
    const runPreflightBtn = document.getElementById('bootRunPreflightBtn');
    const preflightSummaryEl = document.getElementById('bootPreflightSummary');
    const preflightChecksEl = document.getElementById('bootPreflightChecks');
    const configForm = document.getElementById('bootConfigForm');
    const baseUrlInput = document.getElementById('bootConfigBaseUrl');
    const profileSelect = document.getElementById('bootConfigProfile');
    const oneTapInput = document.getElementById('bootConfigOneTap');
    const launchModeSelect = document.getElementById('bootConfigLaunchMode');
    const autoStartInput = document.getElementById('bootConfigAutoStart');
    const operatorFields = document.getElementById('bootConfigOperatorFields');

    let latestSnapshot = null;
    let lastPreflightRunToken = 0;

    function isOperatorSurface(surface) {
        return String(surface || '').trim().toLowerCase() === 'operator';
    }

    function buildLaunchUrl(config) {
        try {
            const surface = String(config.surface || 'operator');
            const baseUrl = String(config.baseUrl || 'https://pielarmonia.com').trim();
            const route =
                surface === 'kiosk'
                    ? '/kiosco-turnos.html'
                    : '/operador-turnos.html';
            const url = new URL(route, baseUrl);

            if (surface === 'operator') {
                const profile = String(config.profile || 'free');
                url.searchParams.set(
                    'station',
                    profile === 'c2_locked' ? 'c2' : 'c1'
                );
                url.searchParams.set(
                    'lock',
                    profile === 'free' ? '0' : '1'
                );
                url.searchParams.set('one_tap', config.oneTap ? '1' : '0');
            }

            return url.toString();
        } catch (_error) {
            return '-';
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

    function createRuntimePatch(formPayload) {
        const profile = String(formPayload.profile || 'free');
        return {
            baseUrl: formPayload.baseUrl,
            launchMode: formPayload.launchMode,
            autoStart: formPayload.autoStart,
            stationMode: profile === 'free' ? 'free' : 'locked',
            stationConsultorio: profile === 'c2_locked' ? 2 : 1,
            oneTap: Boolean(formPayload.oneTap),
        };
    }

    function renderLaunchPreview() {
        if (!launchUrlPreviewEl) {
            return;
        }
        launchUrlPreviewEl.textContent = buildLaunchUrl(getFormPayload());
    }

    function renderPreflight(report) {
        if (preflightSummaryEl instanceof HTMLElement) {
            if (!report) {
                preflightSummaryEl.setAttribute('data-state', 'warning');
                preflightSummaryEl.textContent =
                    'Ejecuta la comprobación para validar servidor, superficie y perfil del equipo.';
            } else {
                preflightSummaryEl.setAttribute('data-state', report.state || 'warning');
                preflightSummaryEl.textContent = `${report.title || 'Equipo en revisión'}: ${
                    report.summary || ''
                }`;
            }
        }

        if (preflightChecksEl instanceof HTMLElement) {
            const checks = Array.isArray(report?.checks) ? report.checks : [];
            preflightChecksEl.innerHTML = checks
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
    }

    async function runPreflight() {
        if (!window.turneroDesktop || typeof window.turneroDesktop.runPreflight !== 'function') {
            renderPreflight(null);
            return;
        }

        const token = Date.now();
        lastPreflightRunToken = token;

        if (runPreflightBtn instanceof HTMLButtonElement) {
            runPreflightBtn.disabled = true;
        }
        if (preflightSummaryEl instanceof HTMLElement) {
            preflightSummaryEl.setAttribute('data-state', 'warning');
            preflightSummaryEl.textContent = 'Comprobando servidor, superficie y salud del equipo...';
        }

        try {
            const report = await window.turneroDesktop.runPreflight(
                createRuntimePatch(getFormPayload())
            );
            if (lastPreflightRunToken === token) {
                renderPreflight(report);
            }
        } catch (_error) {
            if (lastPreflightRunToken === token) {
                renderPreflight({
                    state: 'danger',
                    title: 'No se pudo comprobar el equipo',
                    summary: 'La verificación remota falló antes de completar el checklist.',
                    checks: [],
                });
            }
        } finally {
            if (runPreflightBtn instanceof HTMLButtonElement) {
                runPreflightBtn.disabled = false;
            }
        }
    }

    function hydrateForm(snapshot) {
        const config = snapshot?.config || {};
        const operator = isOperatorSurface(config.surface);
        const profile =
            config.stationMode === 'locked'
                ? Number(config.stationConsultorio || 1) === 2
                    ? 'c2_locked'
                    : 'c1_locked'
                : 'free';

        if (baseUrlInput instanceof HTMLInputElement) {
            baseUrlInput.value = String(config.baseUrl || '');
        }
        if (profileSelect instanceof HTMLSelectElement) {
            profileSelect.value = profile;
        }
        if (oneTapInput instanceof HTMLInputElement) {
            oneTapInput.checked = Boolean(config.oneTap);
        }
        if (launchModeSelect instanceof HTMLSelectElement) {
            launchModeSelect.value = String(config.launchMode || 'fullscreen');
        }
        if (autoStartInput instanceof HTMLInputElement) {
            autoStartInput.checked = config.autoStart !== false;
        }
        if (operatorFields instanceof HTMLElement) {
            operatorFields.hidden = !operator;
        }
        renderLaunchPreview();
    }

    function render(snapshot) {
        if (!snapshot) {
            return;
        }

        latestSnapshot = snapshot;

        if (titleEl) {
            titleEl.textContent =
                snapshot.phase === 'ready'
                    ? 'Shell conectado'
                    : snapshot.settingsMode || snapshot.firstRun
                      ? 'Configura este equipo'
                      : 'Inicializando shell operativo';
        }
        if (messageEl) {
            messageEl.textContent =
                snapshot.message || 'Cargando la superficie y comprobando conectividad.';
        }
        if (surfaceEl) {
            surfaceEl.textContent = snapshot.config?.surface || '-';
        }
        if (baseUrlEl) {
            baseUrlEl.textContent = snapshot.config?.baseUrl || '-';
        }
        if (phaseEl) {
            phaseEl.textContent = snapshot.phase || 'boot';
        }
        if (configModeEl) {
            configModeEl.textContent = snapshot.firstRun
                ? 'Primer arranque'
                : snapshot.settingsMode
                  ? 'Reconfiguracion'
                  : 'Perfil persistido';
        }
        if (configHintEl) {
            configHintEl.innerHTML = snapshot.firstRun
                ? 'Confirma este equipo antes de abrir el turnero.'
                : 'Presiona <code>F10</code> o <code>Ctrl/Cmd + ,</code> para volver a esta configuracion.';
        }
        if (openSurfaceBtn instanceof HTMLButtonElement) {
            openSurfaceBtn.hidden = Boolean(snapshot.firstRun);
        }

        hydrateForm(snapshot);
    }

    async function refreshSnapshot() {
        if (!window.turneroDesktop) {
            return;
        }

        const snapshot = await window.turneroDesktop.getRuntimeSnapshot();
        render({
            ...snapshot.status,
            config: snapshot.config,
            surfaceUrl: snapshot.surfaceUrl,
            firstRun: snapshot.firstRun,
            settingsMode: snapshot.settingsMode,
        });
    }

    if (window.turneroDesktop) {
        refreshSnapshot()
            .then(() => runPreflight())
            .catch(() => {});

        window.turneroDesktop.onBootStatus(() => {
            refreshSnapshot().catch(() => {});
        });
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

            const saveButton = document.getElementById('bootSaveBtn');
            if (saveButton instanceof HTMLButtonElement) {
                saveButton.disabled = true;
            }

            window.turneroDesktop
                .saveRuntimeConfig(createRuntimePatch(getFormPayload()))
                .then(() => window.turneroDesktop.openSurface())
                .catch(() => {})
                .finally(() => {
                    if (saveButton instanceof HTMLButtonElement) {
                        saveButton.disabled = false;
                    }
                });
        });
    }

    if (openSurfaceBtn && window.turneroDesktop) {
        openSurfaceBtn.addEventListener('click', () => {
            openSurfaceBtn.disabled = true;
            window.turneroDesktop.openSurface().finally(() => {
                openSurfaceBtn.disabled = false;
            });
        });
    }

    if (runPreflightBtn && window.turneroDesktop) {
        runPreflightBtn.addEventListener('click', () => {
            void runPreflight();
        });
    }

    [baseUrlInput, profileSelect, oneTapInput, launchModeSelect, autoStartInput]
        .filter(Boolean)
        .forEach((element) => {
            element.addEventListener('input', renderLaunchPreview);
            element.addEventListener('change', renderLaunchPreview);
            element.addEventListener('change', () => {
                void runPreflight();
            });
        });

    renderPreflight(null);
})();
