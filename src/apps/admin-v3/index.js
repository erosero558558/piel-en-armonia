import { bootAdminV3 } from './core/boot.js';

function runBoot() {
    if (document.readyState === 'loading') {
        return new Promise((resolve, reject) => {
            document.addEventListener(
                'DOMContentLoaded',
                () => {
                    bootAdminV3().then(resolve).catch(reject);
                },
                { once: true }
            );
        });
    }
    return bootAdminV3();
}

const bootPromise = runBoot().catch((error) => {
    console.error('admin-v3 boot failed', error);
    throw error;
});

export default bootPromise;
