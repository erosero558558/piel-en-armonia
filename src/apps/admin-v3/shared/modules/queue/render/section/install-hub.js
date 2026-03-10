import { getState } from '../../../../core/store.js';
import { escapeHtml, formatDateTime, setHtml, setText } from '../../../../ui/render.js';

const DEFAULT_APP_DOWNLOADS = Object.freeze({
    operator: {
        version: '0.1.0',
        updatedAt: '2026-03-10T00:00:00Z',
        webFallbackUrl: '/operador-turnos.html',
        guideUrl: '/app-downloads/?surface=operator',
        targets: {
            win: {
                url: '/app-downloads/stable/operator/win/TurneroOperadorSetup.exe',
                label: 'Windows',
            },
            mac: {
                url: '/app-downloads/stable/operator/mac/TurneroOperador.dmg',
                label: 'macOS',
            },
        },
    },
    kiosk: {
        version: '0.1.0',
        updatedAt: '2026-03-10T00:00:00Z',
        webFallbackUrl: '/kiosco-turnos.html',
        guideUrl: '/app-downloads/?surface=kiosk',
        targets: {
            win: {
                url: '/app-downloads/stable/kiosk/win/TurneroKioscoSetup.exe',
                label: 'Windows',
            },
            mac: {
                url: '/app-downloads/stable/kiosk/mac/TurneroKiosco.dmg',
                label: 'macOS',
            },
        },
    },
    sala_tv: {
        version: '0.1.0',
        updatedAt: '2026-03-10T00:00:00Z',
        webFallbackUrl: '/sala-turnos.html',
        guideUrl: '/app-downloads/?surface=sala_tv',
        targets: {
            android_tv: {
                url: '/app-downloads/stable/sala-tv/android/TurneroSalaTV.apk',
                label: 'Android TV APK',
            },
        },
    },
});

const APP_COPY = Object.freeze({
    operator: {
        eyebrow: 'Recepción + consultorio',
        title: 'Operador',
        description:
            'Superficie diaria para llamar, re-llamar, completar y operar con el Genius Numpad 1000.',
        recommendedFor: 'PC operador',
        notes: [
            'Conecta aquí el receptor USB 2.4 GHz del numpad.',
            'La app desktop ahora puede quedar configurada como C1, C2 o modo libre desde el primer arranque.',
        ],
    },
    kiosk: {
        eyebrow: 'Recepción de pacientes',
        title: 'Kiosco',
        description:
            'Instalador dedicado para check-in, generación de ticket y operación simple en mostrador.',
        recommendedFor: 'PC o mini PC de kiosco',
        notes: [
            'Mantén el equipo en fullscreen y con impresora térmica conectada.',
            'La versión web sigue disponible como respaldo inmediato.',
        ],
    },
    sala_tv: {
        eyebrow: 'Pantalla de sala',
        title: 'Sala TV',
        description:
            'APK para Android TV en la TCL C655 con WebView controlado, reconexión y campanilla.',
        recommendedFor: 'TCL C655 / Google TV',
        notes: [
            'Instala en la TV y prioriza Ethernet sobre Wi-Fi.',
            'Usa el QR desde otra pantalla para simplificar la instalación del APK.',
        ],
    },
});

let installPreset = null;

function detectPlatform() {
    const platform = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
    if (platform.includes('mac')) return 'mac';
    if (platform.includes('win')) return 'win';
    return 'other';
}

function absoluteUrl(url) {
    try {
        return new URL(String(url || ''), window.location.origin).toString();
    } catch (_error) {
        return String(url || '');
    }
}

function buildQrUrl(url) {
    const encoded = encodeURIComponent(absoluteUrl(url));
    return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encoded}`;
}

function buildGuideUrl(surfaceKey, preset, appConfig) {
    const base = new URL(
        String(appConfig.guideUrl || `/app-downloads/?surface=${surfaceKey}`),
        `${window.location.origin}/`
    );
    base.searchParams.set('surface', surfaceKey);
    if (surfaceKey === 'sala_tv') {
        base.searchParams.set('platform', 'android_tv');
    } else {
        base.searchParams.set('platform', preset.platform === 'mac' ? 'mac' : 'win');
    }
    if (surfaceKey === 'operator') {
        base.searchParams.set('station', preset.station === 'c2' ? 'c2' : 'c1');
        base.searchParams.set('lock', preset.lock ? '1' : '0');
        base.searchParams.set('one_tap', preset.oneTap ? '1' : '0');
    } else {
        base.searchParams.delete('station');
        base.searchParams.delete('lock');
        base.searchParams.delete('one_tap');
    }
    return `${base.pathname}${base.search}`;
}

function mergeManifest() {
    const appDownloads = getState().data.appDownloads;
    if (!appDownloads || typeof appDownloads !== 'object') {
        return DEFAULT_APP_DOWNLOADS;
    }
    return {
        operator: {
            ...DEFAULT_APP_DOWNLOADS.operator,
            ...(appDownloads.operator || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.operator.targets,
                ...((appDownloads.operator && appDownloads.operator.targets) || {}),
            },
        },
        kiosk: {
            ...DEFAULT_APP_DOWNLOADS.kiosk,
            ...(appDownloads.kiosk || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.kiosk.targets,
                ...((appDownloads.kiosk && appDownloads.kiosk.targets) || {}),
            },
        },
        sala_tv: {
            ...DEFAULT_APP_DOWNLOADS.sala_tv,
            ...(appDownloads.sala_tv || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.sala_tv.targets,
                ...((appDownloads.sala_tv && appDownloads.sala_tv.targets) || {}),
            },
        },
    };
}

function ensureInstallPreset(detectedPlatform) {
    if (installPreset) {
        return installPreset;
    }

    const state = getState();
    installPreset = {
        surface: 'operator',
        station:
            Number(state.queue && state.queue.stationConsultorio) === 2
                ? 'c2'
                : 'c1',
        lock:
            Boolean(state.queue && state.queue.stationMode === 'locked'),
        oneTap: Boolean(state.queue && state.queue.oneTap),
        platform:
            detectedPlatform === 'win' || detectedPlatform === 'mac'
                ? detectedPlatform
                : 'win',
    };
    return installPreset;
}

function getDesktopTarget(appConfig, platform) {
    if (platform === 'mac' && appConfig.targets.mac) {
        return appConfig.targets.mac;
    }
    if (platform === 'win' && appConfig.targets.win) {
        return appConfig.targets.win;
    }
    return appConfig.targets.win || appConfig.targets.mac || null;
}

function buildPreparedSurfaceUrl(surfaceKey, appConfig, preset) {
    const url = new URL(
        String(appConfig.webFallbackUrl || '/'),
        `${window.location.origin}/`
    );

    if (surfaceKey === 'operator') {
        url.searchParams.set('station', preset.station === 'c2' ? 'c2' : 'c1');
        url.searchParams.set('lock', preset.lock ? '1' : '0');
        url.searchParams.set('one_tap', preset.oneTap ? '1' : '0');
    }

    return url.toString();
}

function renderDesktopCard(key, appConfig, platform) {
    const copy = APP_COPY[key];
    const preset = ensureInstallPreset(platform);
    const detectedTarget = getDesktopTarget(appConfig, platform);
    const detectedLabel =
        platform === 'mac'
            ? 'macOS'
            : platform === 'win'
              ? 'Windows'
              : (detectedTarget && detectedTarget.label) || 'este equipo';
    const alternateTargets = Object.entries(appConfig.targets || {})
        .filter(([_targetKey, value]) => value && value.url)
        .map(
            ([targetKey, value]) => `
                <a
                    href="${escapeHtml(value.url)}"
                    class="${targetKey === platform ? 'queue-app-card__recommended' : ''}"
                    download
                >
                    ${escapeHtml(value.label || targetKey)}
                </a>
            `
        )
        .join('');

    return `
        <article class="queue-app-card">
            <div>
                <p class="queue-app-card__eyebrow">${escapeHtml(copy.eyebrow)}</p>
                <h5 class="queue-app-card__title">${escapeHtml(copy.title)}</h5>
                <p class="queue-app-card__description">${escapeHtml(copy.description)}</p>
            </div>
            <p class="queue-app-card__meta">
                v${escapeHtml(appConfig.version || '0.1.0')} · ${escapeHtml(
                    formatDateTime(appConfig.updatedAt || '')
                )}
            </p>
            <span class="queue-app-card__tag">Ideal para ${escapeHtml(copy.recommendedFor)}</span>
            <div class="queue-app-card__actions">
                ${
                    detectedTarget && detectedTarget.url
                        ? `<a href="${escapeHtml(
                              detectedTarget.url
                          )}" class="queue-app-card__cta-primary" download>Descargar para ${escapeHtml(
                              detectedLabel
                          )}</a>`
                        : ''
                }
            </div>
            <div class="queue-app-card__targets">${alternateTargets}</div>
            <div class="queue-app-card__links">
                <a href="${escapeHtml(appConfig.webFallbackUrl || '/')}">Abrir versión web</a>
                <a href="${escapeHtml(buildGuideUrl(key, preset, appConfig))}">Centro de instalación</a>
                <button
                    type="button"
                    data-action="queue-copy-install-link"
                    data-queue-install-url="${escapeHtml(
                        absoluteUrl((detectedTarget && detectedTarget.url) || '')
                    )}"
                >
                    Copiar enlace
                </button>
            </div>
            <ul class="queue-app-card__notes">
                ${copy.notes
                    .map((note) => `<li>${escapeHtml(note)}</li>`)
                    .join('')}
            </ul>
        </article>
    `;
}

function renderTvCard(appConfig) {
    const copy = APP_COPY.sala_tv;
    const preset = ensureInstallPreset(detectPlatform());
    const target = appConfig.targets.android_tv || {};
    const apkUrl = String(target.url || '');
    const qrUrl = buildQrUrl(apkUrl);

    return `
        <article class="queue-app-card">
            <div>
                <p class="queue-app-card__eyebrow">${escapeHtml(copy.eyebrow)}</p>
                <h5 class="queue-app-card__title">${escapeHtml(copy.title)}</h5>
                <p class="queue-app-card__description">${escapeHtml(copy.description)}</p>
            </div>
            <p class="queue-app-card__meta">
                v${escapeHtml(appConfig.version || '0.1.0')} · ${escapeHtml(
                    formatDateTime(appConfig.updatedAt || '')
                )}
            </p>
            <span class="queue-app-card__tag">Ideal para ${escapeHtml(copy.recommendedFor)}</span>
            <div class="queue-app-card__actions">
                <a
                    href="${escapeHtml(qrUrl)}"
                    class="queue-app-card__cta-primary"
                    target="_blank"
                    rel="noopener"
                >
                    Mostrar QR de instalación
                </a>
                <a href="${escapeHtml(apkUrl)}" download>Descargar APK</a>
            </div>
            <div class="queue-app-card__links">
                <a href="${escapeHtml(appConfig.webFallbackUrl || '/sala-turnos.html')}">
                    Abrir fallback web
                </a>
                <a href="${escapeHtml(buildGuideUrl('sala_tv', preset, appConfig))}">
                    Centro de instalación
                </a>
                <button
                    type="button"
                    data-action="queue-copy-install-link"
                    data-queue-install-url="${escapeHtml(absoluteUrl(apkUrl))}"
                >
                    Copiar enlace
                </button>
            </div>
            <ul class="queue-app-card__notes">
                ${copy.notes
                    .map((note) => `<li>${escapeHtml(note)}</li>`)
                    .join('')}
            </ul>
        </article>
    `;
}

function buildPresetSummaryTitle(preset) {
    if (preset.surface === 'sala_tv') {
        return 'Sala TV lista para TCL C655';
    }
    if (preset.surface === 'kiosk') {
        return 'Kiosco listo para mostrador';
    }

    if (!preset.lock) {
        return 'Operador en modo libre';
    }

    return `Operador ${preset.station === 'c2' ? 'C2' : 'C1'} fijo`;
}

function buildPresetSteps(preset) {
    if (preset.surface === 'sala_tv') {
        return [
            'Abre el QR desde otra pantalla o descarga la APK directamente.',
            'Instala la app en la TCL C655 y prioriza Ethernet sobre Wi-Fi.',
            'Valida audio, reconexión y que la sala refleje llamados reales.',
        ];
    }

    if (preset.surface === 'kiosk') {
        return [
            'Instala la app en el mini PC o PC del kiosco.',
            'Deja la impresora térmica conectada y la app en fullscreen.',
            'Usa la versión web como respaldo inmediato si el equipo se reinicia.',
        ];
    }

    const stationLabel = preset.station === 'c2' ? 'C2' : 'C1';
    return [
        `Instala Turnero Operador en el PC de ${stationLabel} y conecta el receptor USB del Genius Numpad 1000.`,
        `En el primer arranque deja el equipo como ${preset.lock ? `${stationLabel} fijo` : 'modo libre'}${preset.oneTap ? ' con 1 tecla' : ''}.`,
        'Si el numpad no reporta Enter como se espera, calibra la tecla externa dentro de la app.',
    ];
}

function renderInstallConfigurator(manifest, detectedPlatform) {
    const root = document.getElementById('queueInstallConfigurator');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const preset = ensureInstallPreset(detectedPlatform);
    const surfaceKey =
        preset.surface === 'kiosk' || preset.surface === 'sala_tv'
            ? preset.surface
            : 'operator';
    const appConfig = manifest[surfaceKey];
    if (!appConfig) {
        root.innerHTML = '';
        return;
    }

    const targetKey =
        surfaceKey === 'sala_tv'
            ? 'android_tv'
            : preset.platform === 'mac'
              ? 'mac'
              : 'win';
    const downloadTarget =
        (appConfig.targets && appConfig.targets[targetKey]) ||
        getDesktopTarget(appConfig, detectedPlatform) ||
        null;
    const preparedWebUrl = buildPreparedSurfaceUrl(surfaceKey, appConfig, preset);
    const qrUrl =
        surfaceKey === 'sala_tv'
            ? buildQrUrl((downloadTarget && downloadTarget.url) || preparedWebUrl)
            : buildQrUrl(preparedWebUrl);
    const guideUrl = buildGuideUrl(surfaceKey, preset, appConfig);
    const setupSteps = buildPresetSteps(preset)
        .map((step) => `<li>${escapeHtml(step)}</li>`)
        .join('');

    setHtml(
        '#queueInstallConfigurator',
        `
            <div class="queue-install-configurator__grid">
                <section class="queue-install-configurator__panel">
                    <div>
                        <p class="queue-app-card__eyebrow">Preparar equipo</p>
                        <h5 class="queue-app-card__title">Asistente de instalación</h5>
                        <p class="queue-app-card__description">
                            Genera el perfil recomendado para cada equipo y copia la ruta exacta antes de instalar.
                        </p>
                    </div>
                    <div class="queue-install-configurator__fields">
                        <label class="queue-install-field" for="queueInstallSurfaceSelect">
                            <span>Equipo</span>
                            <select id="queueInstallSurfaceSelect">
                                <option value="operator"${surfaceKey === 'operator' ? ' selected' : ''}>Operador</option>
                                <option value="kiosk"${surfaceKey === 'kiosk' ? ' selected' : ''}>Kiosco</option>
                                <option value="sala_tv"${surfaceKey === 'sala_tv' ? ' selected' : ''}>Sala TV</option>
                            </select>
                        </label>
                        ${
                            surfaceKey === 'operator'
                                ? `
                                    <label class="queue-install-field" for="queueInstallProfileSelect">
                                        <span>Perfil operador</span>
                                        <select id="queueInstallProfileSelect">
                                            <option value="c1_locked"${
                                                preset.lock && preset.station === 'c1'
                                                    ? ' selected'
                                                    : ''
                                            }>C1 fijo</option>
                                            <option value="c2_locked"${
                                                preset.lock && preset.station === 'c2'
                                                    ? ' selected'
                                                    : ''
                                            }>C2 fijo</option>
                                            <option value="free"${
                                                !preset.lock ? ' selected' : ''
                                            }>Modo libre</option>
                                        </select>
                                    </label>
                                `
                                : ''
                        }
                        ${
                            surfaceKey !== 'sala_tv'
                                ? `
                                    <label class="queue-install-field" for="queueInstallPlatformSelect">
                                        <span>Plataforma</span>
                                        <select id="queueInstallPlatformSelect">
                                            <option value="win"${
                                                preset.platform === 'win' ? ' selected' : ''
                                            }>Windows</option>
                                            <option value="mac"${
                                                preset.platform === 'mac' ? ' selected' : ''
                                            }>macOS</option>
                                        </select>
                                    </label>
                                `
                                : ''
                        }
                        ${
                            surfaceKey === 'operator'
                                ? `
                                    <label class="queue-install-toggle">
                                        <input id="queueInstallOneTapInput" type="checkbox"${
                                            preset.oneTap ? ' checked' : ''
                                        } />
                                        <span>Activar 1 tecla para este operador</span>
                                    </label>
                                `
                                : ''
                        }
                    </div>
                </section>
                <section class="queue-install-configurator__panel queue-install-configurator__result">
                    <div>
                        <p class="queue-app-card__eyebrow">Resultado listo</p>
                        <h5 class="queue-app-card__title">${escapeHtml(
                            buildPresetSummaryTitle(preset)
                        )}</h5>
                        <p class="queue-app-card__description">
                            ${
                                surfaceKey === 'sala_tv'
                                    ? 'Usa el APK para la TV y mantén el fallback web como respaldo.'
                                    : 'Descarga la app correcta y usa la ruta preparada como validación o respaldo.'
                            }
                        </p>
                    </div>
                    <div class="queue-install-result__chips">
                        <span class="queue-app-card__tag">
                            ${escapeHtml(
                                downloadTarget && downloadTarget.label
                                    ? downloadTarget.label
                                    : 'Perfil listo'
                            )}
                        </span>
                        ${
                            surfaceKey === 'operator'
                                ? `<span class="queue-app-card__tag">${
                                      preset.lock
                                          ? preset.station === 'c2'
                                              ? 'C2 bloqueado'
                                              : 'C1 bloqueado'
                                          : 'Modo libre'
                                  }</span>`
                                : ''
                        }
                    </div>
                    <div class="queue-install-result__meta">
                        <span>Descarga recomendada</span>
                        <strong>${escapeHtml(
                            (downloadTarget && downloadTarget.url) || 'Sin artefacto'
                        )}</strong>
                    </div>
                    <div class="queue-install-result__meta">
                        <span>Ruta web preparada</span>
                        <strong>${escapeHtml(preparedWebUrl)}</strong>
                    </div>
                    <div class="queue-install-configurator__actions">
                        ${
                            downloadTarget && downloadTarget.url
                                ? `<a href="${escapeHtml(
                                      downloadTarget.url
                                  )}" class="queue-app-card__cta-primary" download>Descargar artefacto</a>`
                                : ''
                        }
                        <button
                            type="button"
                            data-action="queue-copy-install-link"
                            data-queue-install-url="${escapeHtml(
                                absoluteUrl((downloadTarget && downloadTarget.url) || '')
                            )}"
                        >
                            Copiar descarga
                        </button>
                        <a href="${escapeHtml(preparedWebUrl)}" target="_blank" rel="noopener">
                            Abrir ruta preparada
                        </a>
                        <button
                            type="button"
                            data-action="queue-copy-install-link"
                            data-queue-install-url="${escapeHtml(preparedWebUrl)}"
                        >
                            Copiar ruta preparada
                        </button>
                        <a href="${escapeHtml(qrUrl)}" target="_blank" rel="noopener">
                            Mostrar QR
                        </a>
                        <a href="${escapeHtml(guideUrl)}" target="_blank" rel="noopener">
                            Abrir centro público
                        </a>
                    </div>
                    <ul class="queue-app-card__notes">${setupSteps}</ul>
                </section>
            </div>
        `
    );

    const surfaceSelect = document.getElementById('queueInstallSurfaceSelect');
    if (surfaceSelect instanceof HTMLSelectElement) {
        surfaceSelect.onchange = () => {
            installPreset = {
                ...preset,
                surface: surfaceSelect.value,
            };
            renderInstallConfigurator(manifest, detectedPlatform);
        };
    }

    const profileSelect = document.getElementById('queueInstallProfileSelect');
    if (profileSelect instanceof HTMLSelectElement) {
        profileSelect.onchange = () => {
            installPreset = {
                ...preset,
                station: profileSelect.value === 'c2_locked' ? 'c2' : 'c1',
                lock: profileSelect.value !== 'free',
            };
            renderInstallConfigurator(manifest, detectedPlatform);
        };
    }

    const platformSelect = document.getElementById('queueInstallPlatformSelect');
    if (platformSelect instanceof HTMLSelectElement) {
        platformSelect.onchange = () => {
            installPreset = {
                ...preset,
                platform: platformSelect.value === 'mac' ? 'mac' : 'win',
            };
            renderInstallConfigurator(manifest, detectedPlatform);
        };
    }

    const oneTapInput = document.getElementById('queueInstallOneTapInput');
    if (oneTapInput instanceof HTMLInputElement) {
        oneTapInput.onchange = () => {
            installPreset = {
                ...preset,
                oneTap: oneTapInput.checked,
            };
            renderInstallConfigurator(manifest, detectedPlatform);
        };
    }
}

export function renderQueueInstallHub() {
    const cardsRoot = document.getElementById('queueAppDownloadsCards');
    if (!(cardsRoot instanceof HTMLElement)) {
        return;
    }

    const platform = detectPlatform();
    const platformChip = document.getElementById('queueAppsPlatformChip');
    const platformLabel =
        platform === 'mac'
            ? 'macOS detectado'
            : platform === 'win'
              ? 'Windows detectado'
              : 'Selecciona la plataforma del equipo';
    setText('#queueAppsPlatformChip', platformLabel);
    if (platformChip instanceof HTMLElement) {
        platformChip.setAttribute('data-platform', platform);
    }

    const manifest = mergeManifest();
    setHtml(
        '#queueAppDownloadsCards',
        [
            renderDesktopCard('operator', manifest.operator, platform),
            renderDesktopCard('kiosk', manifest.kiosk, platform),
            renderTvCard(manifest.sala_tv),
        ].join('')
    );
    renderInstallConfigurator(manifest, platform);
}
