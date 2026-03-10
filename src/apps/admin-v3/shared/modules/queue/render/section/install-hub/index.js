import { setHtml, setText } from '../../../../../ui/render.js';
import { renderDesktopCard } from './desktop-card.js';
import { renderTvCard } from './tv-card.js';
import { mergeManifest } from './manifest.js';
import { detectPlatform } from './platform.js';
import { renderQueueOpsPilot } from './pilot.js';
import { renderSurfaceTelemetry } from './telemetry.js';
import { renderContingencyDeck } from './contingency.js';
import { renderOpeningChecklist } from './checklist.js';
import { renderInstallConfigurator } from './configurator.js';

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

    const rerenderAll = () => {
        renderQueueOpsPilot(manifest, platform, rerenderAll);
        renderSurfaceTelemetry(manifest, platform);
        renderContingencyDeck(manifest, platform);
        renderOpeningChecklist(manifest, platform, rerenderAll);
        renderInstallConfigurator(manifest, platform, rerenderAll);
    };

    rerenderAll();
}
