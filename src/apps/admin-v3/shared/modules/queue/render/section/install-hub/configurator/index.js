import { buildInstallConfiguratorViewModel } from './model.js';
import { renderInstallConfiguratorMarkup } from './render.js';
import { bindInstallConfigurator } from './bindings.js';

export function renderInstallConfigurator(
    manifest,
    detectedPlatform,
    rerenderAll
) {
    const root = document.getElementById('queueInstallConfigurator');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const viewModel = buildInstallConfiguratorViewModel(
        manifest,
        detectedPlatform
    );
    if (!viewModel) {
        root.innerHTML = '';
        return;
    }

    renderInstallConfiguratorMarkup(viewModel);
    bindInstallConfigurator(detectedPlatform, rerenderAll);
}
