import { debugLog, withDeployAssetVersion } from './utils.js';

const CONTENT_JSON_URL = withDeployAssetVersion('/content/index.json');

export function hydrateDeferredText(container) {
    if (!window.PIEL_CONTENT) return;
    const nodes = container.querySelectorAll('[data-i18n]');
    nodes.forEach((node) => {
        const key = node.getAttribute('data-i18n');
        if (window.PIEL_CONTENT[key]) {
            if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
                node.placeholder = window.PIEL_CONTENT[key];
            } else {
                node.innerHTML = window.PIEL_CONTENT[key];
            }
        }
    });
}

export async function loadDeferredContent() {
    try {
        const response = await fetch(CONTENT_JSON_URL);
        if (!response.ok) {
            throw new Error(`Failed to load content: ${response.status}`);
        }
        const data = await response.json();

        Object.keys(data).forEach((id) => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = data[id];
                container.classList.remove('deferred-content'); // Optional cleanup
                hydrateDeferredText(container);
            } else {
                debugLog(`Warning: Container #${id} not found for deferred content.`);
            }
        });

        debugLog('Deferred content loaded and hydrated.');
        return true;
    } catch (error) {
        console.error('Error loading deferred content:', error);
        return false;
    }
}
