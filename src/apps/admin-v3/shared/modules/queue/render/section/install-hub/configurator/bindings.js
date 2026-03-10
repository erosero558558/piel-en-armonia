import { updateInstallPreset } from '../state.js';

function bindSurfaceSelect(detectedPlatform, rerenderAll) {
    const surfaceSelect = document.getElementById('queueInstallSurfaceSelect');
    if (!(surfaceSelect instanceof HTMLSelectElement)) {
        return;
    }

    surfaceSelect.onchange = () => {
        updateInstallPreset({ surface: surfaceSelect.value }, detectedPlatform);
        rerenderAll();
    };
}

function bindProfileSelect(detectedPlatform, rerenderAll) {
    const profileSelect = document.getElementById('queueInstallProfileSelect');
    if (!(profileSelect instanceof HTMLSelectElement)) {
        return;
    }

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

function bindPlatformSelect(detectedPlatform, rerenderAll) {
    const platformSelect = document.getElementById(
        'queueInstallPlatformSelect'
    );
    if (!(platformSelect instanceof HTMLSelectElement)) {
        return;
    }

    platformSelect.onchange = () => {
        updateInstallPreset(
            { platform: platformSelect.value === 'mac' ? 'mac' : 'win' },
            detectedPlatform
        );
        rerenderAll();
    };
}

function bindOneTapInput(detectedPlatform, rerenderAll) {
    const oneTapInput = document.getElementById('queueInstallOneTapInput');
    if (!(oneTapInput instanceof HTMLInputElement)) {
        return;
    }

    oneTapInput.onchange = () => {
        updateInstallPreset({ oneTap: oneTapInput.checked }, detectedPlatform);
        rerenderAll();
    };
}

export function bindInstallConfigurator(detectedPlatform, rerenderAll) {
    bindSurfaceSelect(detectedPlatform, rerenderAll);
    bindProfileSelect(detectedPlatform, rerenderAll);
    bindPlatformSelect(detectedPlatform, rerenderAll);
    bindOneTapInput(detectedPlatform, rerenderAll);
}
