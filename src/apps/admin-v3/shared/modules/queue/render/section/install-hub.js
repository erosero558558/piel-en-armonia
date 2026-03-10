import { getState } from '../../../../core/store.js';
import { escapeHtml, formatDateTime, setHtml, setText } from '../../../../ui/render.js';

const DEFAULT_APP_DOWNLOADS = Object.freeze({
    operator: {
        version: '0.1.0',
        updatedAt: '2026-03-10T00:00:00Z',
        webFallbackUrl: '/operador-turnos.html',
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
            'Usa station=c1|c2, lock=1 y one_tap si el equipo queda fijo por consultorio.',
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

function renderDesktopCard(key, appConfig, platform) {
    const copy = APP_COPY[key];
    const detectedTarget =
        platform === 'mac'
            ? appConfig.targets.mac
            : platform === 'win'
              ? appConfig.targets.win
              : appConfig.targets.win || appConfig.targets.mac;
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
}
