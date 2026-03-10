import { escapeHtml, setHtml } from '../../../../../../ui/render.js';

function renderOperatorProfileField(preset, surfaceKey) {
    if (surfaceKey !== 'operator') {
        return '';
    }

    return `
        <label class="queue-install-field" for="queueInstallProfileSelect">
            <span>Perfil operador</span>
            <select id="queueInstallProfileSelect">
                <option value="c1_locked"${preset.lock && preset.station === 'c1' ? ' selected' : ''}>C1 fijo</option>
                <option value="c2_locked"${preset.lock && preset.station === 'c2' ? ' selected' : ''}>C2 fijo</option>
                <option value="free"${!preset.lock ? ' selected' : ''}>Modo libre</option>
            </select>
        </label>`;
}

function renderPlatformField(preset, surfaceKey) {
    if (surfaceKey === 'sala_tv') {
        return '';
    }

    return `
        <label class="queue-install-field" for="queueInstallPlatformSelect">
            <span>Plataforma</span>
            <select id="queueInstallPlatformSelect">
                <option value="win"${preset.platform === 'win' ? ' selected' : ''}>Windows</option>
                <option value="mac"${preset.platform === 'mac' ? ' selected' : ''}>macOS</option>
            </select>
        </label>`;
}

function renderOneTapField(preset, surfaceKey) {
    if (surfaceKey !== 'operator') {
        return '';
    }

    return `
        <label class="queue-install-toggle">
            <input id="queueInstallOneTapInput" type="checkbox"${preset.oneTap ? ' checked' : ''} />
            <span>Activar 1 tecla para este operador</span>
        </label>`;
}

function renderChips(viewModel) {
    const { downloadTarget, preset, surfaceKey } = viewModel;
    const modeChip =
        surfaceKey === 'operator'
            ? `<span class="queue-app-card__tag">${preset.lock ? (preset.station === 'c2' ? 'C2 bloqueado' : 'C1 bloqueado') : 'Modo libre'}</span>`
            : '';
    return `
        <span class="queue-app-card__tag">${escapeHtml(downloadTarget && downloadTarget.label ? downloadTarget.label : 'Perfil listo')}</span>
        ${modeChip}`;
}

function renderActions(viewModel) {
    const { downloadTarget, preparedWebUrl, qrUrl, guideUrl } = viewModel;
    const downloadUrl = (downloadTarget && downloadTarget.url) || '';
    const downloadCta = downloadUrl
        ? `<a href="${escapeHtml(downloadUrl)}" class="queue-app-card__cta-primary" download>Descargar artefacto</a>`
        : '';

    return `
        ${downloadCta}
        <button type="button" data-action="queue-copy-install-link" data-queue-install-url="${escapeHtml(downloadUrl)}">Copiar descarga</button>
        <a href="${escapeHtml(preparedWebUrl)}" target="_blank" rel="noopener">Abrir ruta preparada</a>
        <button type="button" data-action="queue-copy-install-link" data-queue-install-url="${escapeHtml(preparedWebUrl)}">Copiar ruta preparada</button>
        <a href="${escapeHtml(qrUrl)}" target="_blank" rel="noopener">Mostrar QR</a>
        <a href="${escapeHtml(guideUrl)}" target="_blank" rel="noopener">Abrir centro público</a>`;
}

function renderSteps(steps) {
    return steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('');
}

export function renderInstallConfiguratorMarkup(viewModel) {
    const {
        preset,
        surfaceKey,
        downloadTarget,
        preparedWebUrl,
        summaryTitle,
        setupSteps,
    } = viewModel;

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
                    ${renderOperatorProfileField(preset, surfaceKey)}
                    ${renderPlatformField(preset, surfaceKey)}
                    ${renderOneTapField(preset, surfaceKey)}
                </div>
            </section>
            <section class="queue-install-configurator__panel queue-install-configurator__result">
                <div>
                    <p class="queue-app-card__eyebrow">Resultado listo</p>
                    <h5 class="queue-app-card__title">${escapeHtml(summaryTitle)}</h5>
                    <p class="queue-app-card__description">${surfaceKey === 'sala_tv' ? 'Usa el APK para la TV y mantén el fallback web como respaldo.' : 'Descarga la app correcta y usa la ruta preparada como validación o respaldo.'}</p>
                </div>
                <div class="queue-install-result__chips">
                    ${renderChips(viewModel)}
                </div>
                <div class="queue-install-result__meta"><span>Descarga recomendada</span><strong>${escapeHtml((downloadTarget && downloadTarget.url) || 'Sin artefacto')}</strong></div>
                <div class="queue-install-result__meta"><span>Ruta web preparada</span><strong>${escapeHtml(preparedWebUrl)}</strong></div>
                <div class="queue-install-configurator__actions">
                    ${renderActions(viewModel)}
                </div>
                <ul class="queue-app-card__notes">${renderSteps(setupSteps)}</ul>
            </section>
        </div>
    `
    );
}
