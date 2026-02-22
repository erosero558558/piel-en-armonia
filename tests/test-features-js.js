import { initFeatureFlags, isFeatureEnabled } from '../src/apps/shared/features.js';

// Mock DOM
global.sessionStorage = {
    store: {},
    getItem: function(key) { return this.store[key] || null; },
    setItem: function(key, value) { this.store[key] = value.toString(); }
};

global.fetch = async function(url) {
    console.log('Fetching:', url);
    return {
        ok: true,
        json: async () => ({
            ok: true,
            data: { new_booking_ui: true, dark_mode: false }
        })
    };
};

async function run() {
    console.log('Initializing features...');
    await initFeatureFlags();

    console.log('Checking features...');
    const ui = isFeatureEnabled('new_booking_ui');
    const dark = isFeatureEnabled('dark_mode');

    console.log('new_booking_ui:', ui);
    console.log('dark_mode:', dark);

    if (ui === true && dark === false) {
        console.log('Test Passed');
    } else {
        console.log('Test Failed');
        process.exit(1);
    }
}

run();
