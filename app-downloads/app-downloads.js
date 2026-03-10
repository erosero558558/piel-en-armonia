(function () {
    const dataNode = document.getElementById('appDownloadsCatalogData');
    if (!dataNode) {
        return;
    }

    let payload = null;
    try {
        payload = JSON.parse(dataNode.textContent || '{}');
    } catch (_error) {
        return;
    }

    const catalog = payload.catalog || {};
    const copy = payload.copy || {};
    const notes = payload.notes || {};
    const state = payload.state || {};

    const surfaceInput = document.getElementById('appDownloadsSurface');
    const platformInput = document.getElementById('appDownloadsPlatform');
    const stationInput = document.getElementById('appDownloadsStation');
    const lockInput = document.getElementById('appDownloadsLock');
    const oneTapInput = document.getElementById('appDownloadsOneTap');
    const operatorFields = document.getElementById('appDownloadsOperatorFields');
    const platformField = document.getElementById('appDownloadsPlatformField');
    const queryPreview = document.getElementById('appDownloadsQueryPreview');
    const resultEyebrow = document.getElementById('appDownloadsResultEyebrow');
    const resultTitle = document.getElementById('appDownloadsResultTitle');
    const resultDescription = document.getElementById('appDownloadsResultDescription');
    const versionNode = document.getElementById('appDownloadsVersion');
    const updatedAtNode = document.getElementById('appDownloadsUpdatedAt');
    const targetLabelNode = document.getElementById('appDownloadsTargetLabel');
    const targetUrlNode = document.getElementById('appDownloadsTargetUrl');
    const preparedUrlNode = document.getElementById('appDownloadsPreparedUrl');
    const primaryAction = document.getElementById('appDownloadsPrimaryAction');
    const openPreparedBtn = document.getElementById('appDownloadsOpenPreparedBtn');
    const qrBtn = document.getElementById('appDownloadsQrBtn');
    const notesNode = document.getElementById('appDownloadsNotes');
    const toastNode = document.getElementById('appDownloadsToast');
    const copyDownloadBtn = document.getElementById('appDownloadsCopyDownloadBtn');
    const copyPreparedBtn = document.getElementById('appDownloadsCopyPreparedBtn');
    const setupTitleNode = document.getElementById('appDownloadsSetupTitle');
    const setupSummaryNode = document.getElementById('appDownloadsSetupSummary');
    const setupChecksNode = document.getElementById('appDownloadsSetupChecks');
    const surfaceCards = Array.from(
        document.querySelectorAll('[data-surface-card]')
    );
    let readinessTimerId = 0;
    let readinessRunToken = 0;

    function buildQuery(next) {
        const params = new URLSearchParams();
        params.set('surface', next.surface);
        params.set('platform', next.surface === 'sala_tv' ? 'android_tv' : next.platform);
        if (next.surface === 'operator') {
            params.set('station', next.station);
            params.set('lock', next.lock ? '1' : '0');
            params.set('one_tap', next.oneTap ? '1' : '0');
        }
        return params.toString();
    }

    function buildPreparedUrl(next, surfaceConfig) {
        const url = new URL(
            String(surfaceConfig.webFallbackUrl || '/'),
            window.location.origin
        );
        if (next.surface === 'operator') {
            url.searchParams.set('station', next.station === 'c2' ? 'c2' : 'c1');
            url.searchParams.set('lock', next.lock ? '1' : '0');
            url.searchParams.set('one_tap', next.oneTap ? '1' : '0');
        }
        return url.toString();
    }

    function buildQrUrl(value) {
        return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(
            value
        )}`;
    }

    function showToast(message) {
        if (!(toastNode instanceof HTMLElement)) {
            return;
        }
        toastNode.textContent = message;
        toastNode.hidden = false;
        window.clearTimeout(showToast.timerId);
        showToast.timerId = window.setTimeout(() => {
            toastNode.hidden = true;
        }, 2200);
    }

    async function copyText(value) {
        const resolved = String(value || '').trim();
        if (!resolved) {
            return;
        }
        try {
            await navigator.clipboard.writeText(resolved);
            showToast('Enlace copiado');
        } catch (_error) {
            showToast('No se pudo copiar');
        }
    }

    function getCurrentState() {
        return {
            surface: surfaceInput instanceof HTMLSelectElement ? surfaceInput.value : state.surface || 'operator',
            platform: platformInput instanceof HTMLSelectElement ? platformInput.value : state.platform || 'win',
            station: stationInput instanceof HTMLSelectElement ? stationInput.value : state.station || 'c1',
            lock: lockInput instanceof HTMLInputElement ? lockInput.checked : Boolean(state.lock),
            oneTap: oneTapInput instanceof HTMLInputElement ? oneTapInput.checked : Boolean(state.oneTap),
        };
    }

    function renderNotes(surface) {
        if (!(notesNode instanceof HTMLElement)) {
            return;
        }
        const surfaceNotes = Array.isArray(notes[surface]) ? notes[surface] : [];
        notesNode.innerHTML = surfaceNotes.map((note) => `<li>${String(note)}</li>`).join('');
    }

    async function probeUrl(url) {
        const resolved = String(url || '').trim();
        if (!resolved) {
            return {
                ok: false,
                state: 'danger',
                detail: 'No hay URL configurada para esta verificación.',
            };
        }

        try {
            let response = await fetch(resolved, {
                method: 'HEAD',
                cache: 'no-store',
                credentials: 'same-origin',
            });

            if (response.status === 405 || response.status === 501) {
                response = await fetch(resolved, {
                    method: 'GET',
                    cache: 'no-store',
                    credentials: 'same-origin',
                });
            }

            return {
                ok: response.ok,
                state: response.ok ? 'ready' : 'danger',
                detail: response.ok
                    ? `Disponible (${response.status})`
                    : `No responde (${response.status})`,
            };
        } catch (_error) {
            return {
                ok: false,
                state: 'danger',
                detail: 'No se pudo conectar con el servidor desde este navegador.',
            };
        }
    }

    function renderSetupStatus(payload) {
        if (setupTitleNode) {
            setupTitleNode.textContent = String(payload.title || 'Puesta en marcha');
        }
        if (setupSummaryNode) {
            setupSummaryNode.textContent = String(payload.summary || '');
        }
        if (setupChecksNode instanceof HTMLElement) {
            setupChecksNode.innerHTML = (Array.isArray(payload.checks) ? payload.checks : [])
                .map(
                    (check) => `
                        <article class="app-downloads-setup-check" data-state="${String(
                            check.state || 'warning'
                        )}">
                            <strong>${String(check.label || 'Check')}</strong>
                            <span>${String(check.detail || '')}</span>
                        </article>
                    `
                )
                .join('');
        }
    }

    function scheduleReadinessCheck(next, absoluteTargetUrl, preparedUrl) {
        window.clearTimeout(readinessTimerId);

        renderSetupStatus({
            title: 'Comprobando equipo',
            summary:
                'Verificando instalador, ruta preparada y siguientes pasos recomendados.',
            checks: [
                {
                    label: 'Servidor',
                    state: 'warning',
                    detail: 'Esperando respuesta del servidor...',
                },
            ],
        });

        readinessTimerId = window.setTimeout(async () => {
            const runToken = Date.now();
            readinessRunToken = runToken;

            const [downloadProbe, preparedProbe] = await Promise.all([
                probeUrl(absoluteTargetUrl),
                probeUrl(preparedUrl),
            ]);

            if (readinessRunToken !== runToken) {
                return;
            }

            const hardwareCheck =
                next.surface === 'operator'
                    ? {
                          label: 'Hardware',
                          state: 'warning',
                          detail:
                              'Conecta el receptor USB del Genius Numpad 1000 y valida la primera tecla en Operador.',
                      }
                    : next.surface === 'kiosk'
                      ? {
                            label: 'Hardware',
                            state: 'warning',
                            detail:
                                'Conecta impresora térmica y deja el equipo en pantalla completa antes del primer ticket.',
                        }
                      : {
                            label: 'Hardware',
                            state: 'warning',
                            detail:
                                'Instala la APK en la TCL C655, prioriza Ethernet y valida audio/campanilla.',
                        };

            const checks = [
                {
                    label: 'Instalador o APK',
                    state: downloadProbe.state,
                    detail:
                        downloadProbe.ok
                            ? `${next.surface === 'sala_tv' ? 'APK' : 'Descarga'} publicada y disponible.`
                            : `Publicación pendiente. ${downloadProbe.detail}`,
                },
                {
                    label: 'Ruta preparada',
                    state: preparedProbe.state,
                    detail:
                        preparedProbe.ok
                            ? `La superficie responde con este preset. ${preparedProbe.detail}`
                            : `La ruta aún no responde. ${preparedProbe.detail}`,
                },
                {
                    label: 'Perfil del equipo',
                    state: 'ready',
                    detail:
                        next.surface === 'operator'
                            ? `${next.station === 'c2' ? 'C2' : 'C1'} ${
                                  next.lock ? 'fijo' : 'libre'
                              } · ${next.oneTap ? '1 tecla ON' : '1 tecla OFF'}`
                            : next.surface === 'kiosk'
                              ? `${next.platform === 'mac' ? 'macOS' : 'Windows'} para kiosco dedicado`
                              : 'Android TV para TCL C655',
                },
                hardwareCheck,
            ];

            const hasDanger = checks.some((check) => check.state === 'danger');
            const title = hasDanger ? 'Falta publicación o ruta' : 'Listo para instalación';
            const summary = hasDanger
                ? 'Todavía no conviene pasar al equipo final: falta confirmar instalador o superficie.'
                : 'La descarga y la ruta preparada ya responden. Continúa con la instalación física.';

            renderSetupStatus({
                title,
                summary,
                checks,
            });
        }, 180);
    }

    function render() {
        const next = getCurrentState();
        const surfaceConfig = catalog[next.surface] || catalog.operator || {};
        const surfaceCopy = copy[next.surface] || copy.operator || {};
        const targetKey = next.surface === 'sala_tv' ? 'android_tv' : next.platform;
        const target =
            (surfaceConfig.targets && surfaceConfig.targets[targetKey]) ||
            (surfaceConfig.targets && (surfaceConfig.targets.win || surfaceConfig.targets.mac)) ||
            { label: 'Sin artefacto', url: '' };
        const absoluteTargetUrl = target.url
            ? new URL(String(target.url), window.location.origin).toString()
            : '';
        const preparedUrl = buildPreparedUrl(next, surfaceConfig);
        const query = buildQuery(next);
        const qrTarget =
            next.surface === 'sala_tv' ? absoluteTargetUrl : preparedUrl;

        if (operatorFields instanceof HTMLElement) {
            operatorFields.classList.toggle('is-hidden', next.surface !== 'operator');
        }
        if (platformField instanceof HTMLElement) {
            platformField.classList.toggle('is-hidden', next.surface === 'sala_tv');
        }
        if (resultEyebrow) {
            resultEyebrow.textContent = String(surfaceCopy.eyebrow || '');
        }
        if (resultTitle) {
            resultTitle.textContent = String(surfaceCopy.title || '');
        }
        if (resultDescription) {
            resultDescription.textContent = String(surfaceCopy.description || '');
        }
        if (versionNode) {
            versionNode.textContent = `v${String(surfaceConfig.version || '0.1.0')}`;
        }
        if (updatedAtNode) {
            updatedAtNode.textContent = String(surfaceConfig.updatedAt || '');
        }
        if (targetLabelNode) {
            targetLabelNode.textContent = String(target.label || 'Sin artefacto');
        }
        if (targetUrlNode) {
            targetUrlNode.textContent = absoluteTargetUrl;
        }
        if (preparedUrlNode) {
            preparedUrlNode.textContent = preparedUrl;
        }
        if (queryPreview) {
            queryPreview.textContent = query;
        }
        if (primaryAction instanceof HTMLAnchorElement) {
            primaryAction.href = absoluteTargetUrl || '#';
            primaryAction.textContent = next.surface === 'sala_tv' ? 'Descargar APK' : 'Descargar instalador';
            if (next.surface === 'sala_tv') {
                primaryAction.removeAttribute('download');
            } else {
                primaryAction.setAttribute('download', '');
            }
        }
        if (openPreparedBtn instanceof HTMLAnchorElement) {
            openPreparedBtn.href = preparedUrl;
        }
        if (qrBtn instanceof HTMLAnchorElement) {
            qrBtn.href = buildQrUrl(qrTarget);
        }
        surfaceCards.forEach((node) => {
            node.classList.toggle(
                'is-active',
                String(node.getAttribute('data-surface-card') || '') === next.surface
            );
        });
        renderNotes(next.surface);
        scheduleReadinessCheck(next, absoluteTargetUrl, preparedUrl);

        const nextUrl = `${window.location.pathname}?${query}`;
        window.history.replaceState(null, '', nextUrl);
    }

    [surfaceInput, platformInput, stationInput, lockInput, oneTapInput]
        .filter(Boolean)
        .forEach((node) => {
            node.addEventListener('change', render);
            node.addEventListener('input', render);
        });

    if (copyDownloadBtn) {
        copyDownloadBtn.addEventListener('click', () => {
            copyText(targetUrlNode ? targetUrlNode.textContent || '' : '');
        });
    }

    if (copyPreparedBtn) {
        copyPreparedBtn.addEventListener('click', () => {
            copyText(preparedUrlNode ? preparedUrlNode.textContent || '' : '');
        });
    }

    render();
})();
