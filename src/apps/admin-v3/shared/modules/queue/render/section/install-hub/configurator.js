import { escapeHtml, setHtml } from '../../../../../ui/render.js';
import {
    buildGuideUrl,
    buildPreparedSurfaceUrl,
    getDesktopTarget,
} from './manifest.js';
import { buildQrUrl } from './platform.js';
import {
    buildPresetSteps,
    buildPresetSummaryTitle,
    ensureInstallPreset,
    updateInstallPreset,
} from './state.js';

export function renderInstallConfigurator(
    manifest,
    detectedPlatform,
    rerenderAll
) {
    const root = document.getElementById('queueInstallConfigurator');
    if (!(root instanceof HTMLElement)) return;

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
    const preparedWebUrl = buildPreparedSurfaceUrl(
        surfaceKey,
        appConfig,
        preset
    );
    const qrUrl =
        surfaceKey === 'sala_tv'
            ? buildQrUrl(
                  (downloadTarget && downloadTarget.url) || preparedWebUrl
              )
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
                    <p class="queue-app-card__description">Genera el perfil recomendado para cada equipo y copia la ruta exacta antes de instalar.</p>
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
                                <option value="c1_locked"${preset.lock && preset.station === 'c1' ? ' selected' : ''}>C1 fijo</option>
                                <option value="c2_locked"${preset.lock && preset.station === 'c2' ? ' selected' : ''}>C2 fijo</option>
                                <option value="free"${!preset.lock ? ' selected' : ''}>Modo libre</option>
                            </select>
                        </label>`
                            : ''
                    }
                    ${
                        surfaceKey !== 'sala_tv'
                            ? `
                        <label class="queue-install-field" for="queueInstallPlatformSelect">
                            <span>Plataforma</span>
                            <select id="queueInstallPlatformSelect">
                                <option value="win"${preset.platform === 'win' ? ' selected' : ''}>Windows</option>
                                <option value="mac"${preset.platform === 'mac' ? ' selected' : ''}>macOS</option>
                            </select>
                        </label>`
                            : ''
                    }
                    ${
                        surfaceKey === 'operator'
                            ? `
                        <label class="queue-install-toggle">
                            <input id="queueInstallOneTapInput" type="checkbox"${preset.oneTap ? ' checked' : ''} />
                            <span>Activar 1 tecla para este operador</span>
                        </label>`
                            : ''
                    }
                </div>
            </section>
            <section class="queue-install-configurator__panel queue-install-configurator__result">
                <div>
                    <p class="queue-app-card__eyebrow">Resultado listo</p>
                    <h5 class="queue-app-card__title">${escapeHtml(buildPresetSummaryTitle(preset))}</h5>
                    <p class="queue-app-card__description">${surfaceKey === 'sala_tv' ? 'Usa el APK para la TV y mantén el fallback web como respaldo.' : 'Descarga la app correcta y usa la ruta preparada como validación o respaldo.'}</p>
                </div>
                <div class="queue-install-result__chips">
                    <span class="queue-app-card__tag">${escapeHtml(downloadTarget && downloadTarget.label ? downloadTarget.label : 'Perfil listo')}</span>
                    ${surfaceKey === 'operator' ? `<span class="queue-app-card__tag">${preset.lock ? (preset.station === 'c2' ? 'C2 bloqueado' : 'C1 bloqueado') : 'Modo libre'}</span>` : ''}
                </div>
                <div class="queue-install-result__meta"><span>Descarga recomendada</span><strong>${escapeHtml((downloadTarget && downloadTarget.url) || 'Sin artefacto')}</strong></div>
                <div class="queue-install-result__meta"><span>Ruta web preparada</span><strong>${escapeHtml(preparedWebUrl)}</strong></div>
                <div class="queue-install-configurator__actions">
                    ${downloadTarget && downloadTarget.url ? `<a href="${escapeHtml(downloadTarget.url)}" class="queue-app-card__cta-primary" download>Descargar artefacto</a>` : ''}
                    <button type="button" data-action="queue-copy-install-link" data-queue-install-url="${escapeHtml((downloadTarget && downloadTarget.url) || '')}">Copiar descarga</button>
                    <a href="${escapeHtml(preparedWebUrl)}" target="_blank" rel="noopener">Abrir ruta preparada</a>
                    <button type="button" data-action="queue-copy-install-link" data-queue-install-url="${escapeHtml(preparedWebUrl)}">Copiar ruta preparada</button>
                    <a href="${escapeHtml(qrUrl)}" target="_blank" rel="noopener">Mostrar QR</a>
                    <a href="${escapeHtml(guideUrl)}" target="_blank" rel="noopener">Abrir centro público</a>
                </div>
                <ul class="queue-app-card__notes">${setupSteps}</ul>
            </section>
        </div>
    `
    );

    const surfaceSelect = document.getElementById('queueInstallSurfaceSelect');
    if (surfaceSelect instanceof HTMLSelectElement) {
        surfaceSelect.onchange = () => {
            updateInstallPreset(
                { surface: surfaceSelect.value },
                detectedPlatform
            );
            rerenderAll();
        };
    }

    const profileSelect = document.getElementById('queueInstallProfileSelect');
    if (profileSelect instanceof HTMLSelectElement) {
        profileSelect.onchange = () => {
            updateInstallPreset(
                {
                    station: profileSelect.value === 'c2_locked' ? 'c2' : 'c1',
                    lock: profileSelect.value !== 'free',
                },
                detectedPlatform
            );
            rerenderAll();
        };
    }

    const platformSelect = document.getElementById(
        'queueInstallPlatformSelect'
    );
    if (platformSelect instanceof HTMLSelectElement) {
        platformSelect.onchange = () => {
            updateInstallPreset(
                { platform: platformSelect.value === 'mac' ? 'mac' : 'win' },
                detectedPlatform
            );
            rerenderAll();
        };
    }

    const oneTapInput = document.getElementById('queueInstallOneTapInput');
    if (oneTapInput instanceof HTMLInputElement) {
        oneTapInput.onchange = () => {
            updateInstallPreset(
                { oneTap: oneTapInput.checked },
                detectedPlatform
            );
            rerenderAll();
        };
    }
}
