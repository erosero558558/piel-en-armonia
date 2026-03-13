(function () {
    const dataNode = document.getElementById('appDownloadsCatalogData');
    if (!dataNode) {
        return;
    }

    const payloadText = dataNode.textContent || '{}';
    let payload;
    try {
        payload = JSON.parse(payloadText);
    } catch (_error) {
        return;
    }

    const catalog = payload.catalog || {};
    const surfaces = payload.surfaces || {};
    const state = payload.state || {};
    const surfaceIds = Object.keys(surfaces);
    const fallbackSurfaceId =
        surfaceIds[0] || Object.keys(catalog)[0] || 'operator';

    const surfaceInput = document.getElementById('appDownloadsSurface');
    const platformInput = document.getElementById('appDownloadsPlatform');
    const stationInput = document.getElementById('appDownloadsStation');
    const lockInput = document.getElementById('appDownloadsLock');
    const oneTapInput = document.getElementById('appDownloadsOneTap');
    const operatorFields = document.getElementById(
        'appDownloadsOperatorFields'
    );
    const platformField = document.getElementById('appDownloadsPlatformField');
    const queryPreview = document.getElementById('appDownloadsQueryPreview');
    const resultEyebrow = document.getElementById('appDownloadsResultEyebrow');
    const resultTitle = document.getElementById('appDownloadsResultTitle');
    const resultDescription = document.getElementById(
        'appDownloadsResultDescription'
    );
    const versionNode = document.getElementById('appDownloadsVersion');
    const updatedAtNode = document.getElementById('appDownloadsUpdatedAt');
    const targetLabelNode = document.getElementById('appDownloadsTargetLabel');
    const targetUrlNode = document.getElementById('appDownloadsTargetUrl');
    const preparedUrlNode = document.getElementById('appDownloadsPreparedUrl');
    const feedCardNode = document.getElementById('appDownloadsFeedCard');
    const feedLabelNode = document.getElementById('appDownloadsFeedLabel');
    const feedUrlNode = document.getElementById('appDownloadsFeedUrl');
    const primaryAction = document.getElementById('appDownloadsPrimaryAction');
    const openPreparedBtn = document.getElementById(
        'appDownloadsOpenPreparedBtn'
    );
    const qrBtn = document.getElementById('appDownloadsQrBtn');
    const notesNode = document.getElementById('appDownloadsNotes');
    const toastNode = document.getElementById('appDownloadsToast');
    const copyDownloadBtn = document.getElementById(
        'appDownloadsCopyDownloadBtn'
    );
    const copyPreparedBtn = document.getElementById(
        'appDownloadsCopyPreparedBtn'
    );
    const setupTitleNode = document.getElementById('appDownloadsSetupTitle');
    const setupSummaryNode = document.getElementById(
        'appDownloadsSetupSummary'
    );
    const setupChecksNode = document.getElementById('appDownloadsSetupChecks');
    const rolloutCardNode = document.getElementById('appDownloadsRolloutCard');
    const rolloutTitleNode = document.getElementById(
        'appDownloadsRolloutTitle'
    );
    const rolloutSummaryNode = document.getElementById(
        'appDownloadsRolloutSummary'
    );
    const rolloutLanesNode = document.getElementById(
        'appDownloadsRolloutLanes'
    );
    const surfaceCards = Array.from(
        document.querySelectorAll('[data-surface-card]')
    );
    let readinessTimerId = 0;
    let readinessRunToken = 0;

    function escapeHtml(value) {
        return String(value || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function getSurfaceMeta(surfaceId) {
        return surfaces[surfaceId] || surfaces[fallbackSurfaceId] || {};
    }

    function getSurfaceCatalog(surfaceId) {
        return catalog[surfaceId] || catalog[fallbackSurfaceId] || {};
    }

    function toAbsoluteUrl(value) {
        const resolved = String(value || '').trim();
        if (!resolved) {
            return '';
        }
        try {
            return new URL(resolved, window.location.origin).toString();
        } catch (_error) {
            return resolved;
        }
    }

    function getFileNameFromUrl(value) {
        const resolved = String(value || '').trim();
        if (!resolved) {
            return '';
        }

        try {
            const url = new URL(resolved, window.location.origin);
            const parts = url.pathname.split('/').filter(Boolean);
            return parts[parts.length - 1] || '';
        } catch (_error) {
            const parts = resolved.split('/').filter(Boolean);
            return parts[parts.length - 1] || '';
        }
    }

    function getTargetKeys(surfaceId) {
        const surfaceMeta = getSurfaceMeta(surfaceId);
        const surfaceCatalog = getSurfaceCatalog(surfaceId);
        const catalogTargets =
            surfaceCatalog && typeof surfaceCatalog.targets === 'object'
                ? surfaceCatalog.targets
                : {};
        const orderedKeys = Array.isArray(surfaceMeta.targetOrder)
            ? surfaceMeta.targetOrder.filter((targetKey) =>
                  Object.prototype.hasOwnProperty.call(
                      catalogTargets,
                      targetKey
                  )
              )
            : [];
        return orderedKeys.length > 0
            ? orderedKeys
            : Object.keys(catalogTargets);
    }

    function getDefaultTargetKey(surfaceId) {
        const targetKeys = getTargetKeys(surfaceId);
        if (targetKeys.includes('win')) {
            return 'win';
        }
        return targetKeys[0] || '';
    }

    function normalizeState(rawState) {
        const requestedSurface =
            String(rawState.surface || '').trim() || fallbackSurfaceId;
        const surface = surfaces[requestedSurface]
            ? requestedSurface
            : fallbackSurfaceId;
        const surfaceMeta = getSurfaceMeta(surface);
        const launchDefaults =
            surfaceMeta.launchDefaults &&
            typeof surfaceMeta.launchDefaults === 'object'
                ? surfaceMeta.launchDefaults
                : {};
        const targetKeys = getTargetKeys(surface);
        const requestedPlatform = String(rawState.platform || '').trim();
        const platform = targetKeys.includes(requestedPlatform)
            ? requestedPlatform
            : getDefaultTargetKey(surface);

        return {
            surface,
            platform,
            station:
                String(rawState.station || launchDefaults.station || 'c1')
                    .trim()
                    .toLowerCase() === 'c2'
                    ? 'c2'
                    : 'c1',
            lock:
                typeof rawState.lock === 'boolean'
                    ? rawState.lock
                    : Boolean(launchDefaults.lock),
            oneTap:
                typeof rawState.oneTap === 'boolean'
                    ? rawState.oneTap
                    : Boolean(launchDefaults.one_tap),
        };
    }

    function buildQuery(next) {
        const params = new URLSearchParams();
        params.set('surface', next.surface);
        params.set('platform', next.platform);
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
            url.searchParams.set(
                'station',
                next.station === 'c2' ? 'c2' : 'c1'
            );
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

    function buildOperatorPilotPreset(next, station) {
        return {
            surface: 'operator',
            platform: 'win',
            station,
            lock: true,
            oneTap: Boolean(next.oneTap),
        };
    }

    function renderOperatorRollout(next, surfaceCatalog, absoluteTargetUrl) {
        if (
            !(rolloutCardNode instanceof HTMLElement) ||
            !(rolloutLanesNode instanceof HTMLElement)
        ) {
            return;
        }

        const visible = next.surface === 'operator' && next.platform === 'win';
        rolloutCardNode.classList.toggle('is-hidden', !visible);
        if (!visible) {
            rolloutLanesNode.innerHTML = '';
            return;
        }

        const installerName =
            getFileNameFromUrl(absoluteTargetUrl) || 'TurneroOperadorSetup.exe';
        const currentLabel =
            next.lock && next.station === 'c2'
                ? 'PC 2 queda como C2 fijo'
                : next.lock
                  ? 'PC 1 queda como C1 fijo'
                  : 'El preset actual sigue en modo libre';

        if (rolloutTitleNode) {
            rolloutTitleNode.textContent = 'Despliegue operador Windows';
        }
        if (rolloutSummaryNode) {
            rolloutSummaryNode.textContent = `Usa el mismo ${installerName} en las dos PCs operador. ${currentLabel}; la otra PC debe provisionarse con el perfil fijo restante en el primer arranque.`;
        }

        rolloutLanesNode.innerHTML = ['c1', 'c2']
            .map((station) => {
                const preset = buildOperatorPilotPreset(next, station);
                const preparedUrl = buildPreparedUrl(preset, surfaceCatalog);
                const active = next.lock && next.station === station;
                const laneLabel = station === 'c2' ? 'PC 2' : 'PC 1';
                const stationLabel = station === 'c2' ? 'C2 fijo' : 'C1 fijo';
                return `
                    <article class="app-downloads-rollout-lane" data-state="${active ? 'active' : 'ready'}">
                        <span>${escapeHtml(laneLabel)}</span>
                        <strong>${escapeHtml(stationLabel)}</strong>
                        <p>
                            ${escapeHtml(installerName)} + ${
                                next.oneTap ? '1 tecla ON' : '1 tecla OFF'
                            }. El perfil se fija en el primer arranque del shell.
                        </p>
                        <code>${escapeHtml(preparedUrl)}</code>
                        <a href="${escapeHtml(preparedUrl)}" target="_blank" rel="noopener">
                            Abrir preset web
                        </a>
                    </article>
                `;
            })
            .join('');
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
            surface:
                surfaceInput instanceof HTMLSelectElement
                    ? surfaceInput.value
                    : state.surface || fallbackSurfaceId,
            platform:
                platformInput instanceof HTMLSelectElement
                    ? platformInput.value
                    : state.platform || getDefaultTargetKey(fallbackSurfaceId),
            station:
                stationInput instanceof HTMLSelectElement
                    ? stationInput.value
                    : state.station || 'c1',
            lock:
                lockInput instanceof HTMLInputElement
                    ? lockInput.checked
                    : Boolean(state.lock),
            oneTap:
                oneTapInput instanceof HTMLInputElement
                    ? oneTapInput.checked
                    : Boolean(state.oneTap),
        };
    }

    function populatePlatformOptions(surfaceId, selectedTargetKey) {
        if (!(platformInput instanceof HTMLSelectElement)) {
            return;
        }

        const surfaceCatalog = getSurfaceCatalog(surfaceId);
        const targetKeys = getTargetKeys(surfaceId);
        const selectedKey = targetKeys.includes(selectedTargetKey)
            ? selectedTargetKey
            : getDefaultTargetKey(surfaceId);

        platformInput.innerHTML = targetKeys
            .map((targetKey) => {
                const target =
                    surfaceCatalog.targets && surfaceCatalog.targets[targetKey]
                        ? surfaceCatalog.targets[targetKey]
                        : {};
                return `<option value="${escapeHtml(targetKey)}"${
                    targetKey === selectedKey ? ' selected' : ''
                }>${escapeHtml(String(target.label || targetKey))}</option>`;
            })
            .join('');
        platformInput.value = selectedKey;

        if (platformField instanceof HTMLElement) {
            platformField.classList.toggle('is-hidden', targetKeys.length <= 1);
        }
    }

    function renderNotes(surfaceId) {
        if (!(notesNode instanceof HTMLElement)) {
            return;
        }

        const notes =
            getSurfaceMeta(surfaceId).catalog &&
            Array.isArray(getSurfaceMeta(surfaceId).catalog.notes)
                ? getSurfaceMeta(surfaceId).catalog.notes
                : [];
        notesNode.innerHTML = notes
            .map((note) => `<li>${escapeHtml(String(note || ''))}</li>`)
            .join('');
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
            setupTitleNode.textContent = String(
                payload.title || 'Puesta en marcha'
            );
        }
        if (setupSummaryNode) {
            setupSummaryNode.textContent = String(payload.summary || '');
        }
        if (setupChecksNode instanceof HTMLElement) {
            setupChecksNode.innerHTML = (
                Array.isArray(payload.checks) ? payload.checks : []
            )
                .map(
                    (check) => `
                        <article class="app-downloads-setup-check" data-state="${String(
                            check.state || 'warning'
                        )}">
                            <strong>${escapeHtml(String(check.label || 'Check'))}</strong>
                            <span>${escapeHtml(String(check.detail || ''))}</span>
                        </article>
                    `
                )
                .join('');
        }
    }

    function buildProfileSummary(next, surfaceMeta, target) {
        if (next.surface === 'operator') {
            return `${next.station === 'c2' ? 'C2' : 'C1'} ${
                next.lock ? 'fijo' : 'libre'
            } · ${next.oneTap ? '1 tecla ON' : '1 tecla OFF'}`;
        }
        if (surfaceMeta.family === 'android') {
            return String(target?.label || 'Android');
        }
        return `${String(target?.label || 'Descarga')} para ${String(
            surfaceMeta.catalog?.title || next.surface
        )}`;
    }

    function buildHardwareSummary(next, surfaceMeta) {
        const notes = Array.isArray(surfaceMeta.catalog?.notes)
            ? surfaceMeta.catalog.notes
            : [];
        if (notes.length > 0) {
            return String(notes[0] || '');
        }
        if (surfaceMeta.family === 'android') {
            return 'Valida audio, red y apertura automática antes de operar.';
        }
        return 'Confirma el equipo físico y el shell asignado antes de instalar.';
    }

    function scheduleReadinessCheck(
        next,
        surfaceMeta,
        target,
        absoluteTargetUrl,
        preparedUrl,
        absoluteFeedUrl
    ) {
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
            const shouldProbeFeed = Boolean(
                absoluteFeedUrl && surfaceMeta.family === 'desktop'
            );

            const [downloadProbe, preparedProbe, feedProbe] = await Promise.all(
                [
                    probeUrl(absoluteTargetUrl),
                    probeUrl(preparedUrl),
                    shouldProbeFeed
                        ? probeUrl(absoluteFeedUrl)
                        : Promise.resolve(null),
                ]
            );

            if (readinessRunToken !== runToken) {
                return;
            }

            const checks = [
                {
                    label: 'Instalador o APK',
                    state: downloadProbe.state,
                    detail: downloadProbe.ok
                        ? `${
                              surfaceMeta.family === 'android'
                                  ? 'APK'
                                  : 'Descarga'
                          } publicada y disponible.`
                        : `Publicación pendiente. ${downloadProbe.detail}`,
                },
                {
                    label: 'Ruta preparada',
                    state: preparedProbe.state,
                    detail: preparedProbe.ok
                        ? `La superficie responde con este preset. ${preparedProbe.detail}`
                        : `La ruta aun no responde. ${preparedProbe.detail}`,
                },
                {
                    label: 'Perfil del equipo',
                    state: 'ready',
                    detail: buildProfileSummary(next, surfaceMeta, target),
                },
                {
                    label: 'Hardware',
                    state: 'warning',
                    detail: buildHardwareSummary(next, surfaceMeta),
                },
            ];

            if (surfaceMeta.family === 'desktop') {
                if (shouldProbeFeed && feedProbe) {
                    checks.splice(1, 0, {
                        label: 'Auto-update',
                        state: feedProbe.state,
                        detail: feedProbe.ok
                            ? `Feed ${getFileNameFromUrl(absoluteFeedUrl)} disponible. ${feedProbe.detail}`
                            : `Feed pendiente. ${feedProbe.detail}`,
                    });
                } else {
                    checks.splice(1, 0, {
                        label: 'Auto-update',
                        state: 'danger',
                        detail: 'No hay feed de auto-update configurado para este target desktop.',
                    });
                }
            }

            const hasDanger = checks.some((check) => check.state === 'danger');
            renderSetupStatus({
                title: hasDanger
                    ? 'Falta publicación o ruta'
                    : 'Listo para instalacion',
                summary: hasDanger
                    ? 'Todavia no conviene pasar al equipo final: falta confirmar instalador o superficie.'
                    : 'La descarga y la ruta preparada ya responden. Continua con la instalacion fisica.',
                checks,
            });
        }, 180);
    }

    function render() {
        const next = normalizeState(getCurrentState());
        const surfaceMeta = getSurfaceMeta(next.surface);
        const surfaceCatalog = getSurfaceCatalog(next.surface);

        populatePlatformOptions(next.surface, next.platform);
        next.platform =
            platformInput instanceof HTMLSelectElement
                ? platformInput.value
                : next.platform;

        const target = (surfaceCatalog.targets &&
            surfaceCatalog.targets[next.platform]) ||
            (surfaceCatalog.targets &&
                surfaceCatalog.targets[getDefaultTargetKey(next.surface)]) || {
                label: 'Sin artefacto',
                url: '',
                feedUrl: '',
            };
        const absoluteTargetUrl = toAbsoluteUrl(target.url);
        const absoluteFeedUrl = toAbsoluteUrl(target.feedUrl);
        const preparedUrl = buildPreparedUrl(next, surfaceCatalog);
        const query = buildQuery(next);
        const qrTarget =
            surfaceMeta.catalog?.qrTarget === 'download'
                ? absoluteTargetUrl
                : preparedUrl;

        if (surfaceInput instanceof HTMLSelectElement) {
            surfaceInput.value = next.surface;
        }
        if (stationInput instanceof HTMLSelectElement) {
            stationInput.value = next.station;
        }
        if (lockInput instanceof HTMLInputElement) {
            lockInput.checked = next.lock;
        }
        if (oneTapInput instanceof HTMLInputElement) {
            oneTapInput.checked = next.oneTap;
        }
        if (operatorFields instanceof HTMLElement) {
            operatorFields.classList.toggle(
                'is-hidden',
                next.surface !== 'operator'
            );
        }
        if (resultEyebrow) {
            resultEyebrow.textContent = String(
                surfaceMeta.catalog?.eyebrow || ''
            );
        }
        if (resultTitle) {
            resultTitle.textContent = String(
                surfaceMeta.catalog?.title || next.surface
            );
        }
        if (resultDescription) {
            resultDescription.textContent = String(
                surfaceMeta.catalog?.description || ''
            );
        }
        if (versionNode) {
            versionNode.textContent = `v${String(surfaceCatalog.version || '0.1.0')}`;
        }
        if (updatedAtNode) {
            updatedAtNode.textContent = String(surfaceCatalog.updatedAt || '');
        }
        if (targetLabelNode) {
            targetLabelNode.textContent = String(
                target.label || 'Sin artefacto'
            );
        }
        if (targetUrlNode) {
            targetUrlNode.textContent = absoluteTargetUrl;
        }
        if (preparedUrlNode) {
            preparedUrlNode.textContent = preparedUrl;
        }
        if (feedCardNode instanceof HTMLElement) {
            feedCardNode.classList.toggle('is-hidden', !absoluteFeedUrl);
        }
        if (feedLabelNode) {
            feedLabelNode.textContent = absoluteFeedUrl
                ? getFileNameFromUrl(absoluteFeedUrl)
                : 'Sin feed';
        }
        if (feedUrlNode) {
            feedUrlNode.textContent = absoluteFeedUrl;
        }
        if (queryPreview) {
            queryPreview.textContent = query;
        }
        if (primaryAction instanceof HTMLAnchorElement) {
            primaryAction.href = absoluteTargetUrl || '#';
            primaryAction.textContent =
                surfaceMeta.family === 'android'
                    ? 'Descargar APK'
                    : 'Descargar instalador';
            if (surfaceMeta.family === 'android') {
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
                String(node.getAttribute('data-surface-card') || '') ===
                    next.surface
            );
        });
        renderNotes(next.surface);
        renderOperatorRollout(next, surfaceCatalog, absoluteTargetUrl);
        scheduleReadinessCheck(
            next,
            surfaceMeta,
            target,
            absoluteTargetUrl,
            preparedUrl,
            absoluteFeedUrl
        );

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
