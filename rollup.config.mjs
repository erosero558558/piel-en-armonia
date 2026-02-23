import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const plugins = [resolve(), terser()];

export default [
    // Admin App
    {
        input: 'src/apps/admin/index.js',
        output: {
            file: 'admin.js',
            format: 'es',
            sourcemap: false
        },
        plugins
    },
    // Booking UI
    {
        input: 'src/apps/booking/ui-entry.js',
        output: {
            file: 'js/engines/booking-ui.js',
            format: 'es',
            sourcemap: false
        },
        plugins
        // Removed external: ['booking-calendar-lazy'] to bundle it inline
    },
    // Booking Engine
    {
        input: 'src/apps/booking/engine.js',
        output: {
            file: 'js/engines/booking-engine.js',
            format: 'es',
            sourcemap: false
        },
        plugins
    },
    // Booking Calendar
    {
        input: 'src/apps/booking/components/calendar.js',
        output: {
            file: 'js/booking-calendar.js',
            format: 'es',
            sourcemap: false
        },
        plugins
    },
    // Chat UI Engine
    {
        input: 'src/apps/chat/ui-engine.js',
        output: {
            file: 'js/engines/chat-ui-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins
    },
    // Chat Widget Engine
    {
        input: 'src/apps/chat/widget-engine.js',
        output: {
            file: 'js/engines/chat-widget-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins
    },
    // Chat Booking Engine
    {
        input: 'src/apps/chat/booking-engine.js',
        output: {
            file: 'js/engines/chat-booking-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins
    },
    // Figo Chat Engine
    {
        input: 'src/apps/chat/engine.js',
        output: {
            file: 'js/engines/chat-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins
    },
    // Analytics Engine
    {
        input: 'src/apps/analytics/engine.js',
        output: {
            file: 'js/engines/analytics-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins
    },
    // Booking Utils Bundle
    {
        input: 'src/bundles/booking-utils.js',
        output: {
            file: 'js/engines/booking-utils.js',
            format: 'iife',
            sourcemap: false
        },
        plugins
    },
    // Data Bundle
    {
        input: 'src/bundles/data.js',
        output: {
            file: 'js/engines/data-bundle.js',
            format: 'iife',
            sourcemap: false
        },
        plugins
    },
    // UI Bundle
    {
        input: 'src/bundles/ui.js',
        output: {
            file: 'js/engines/ui-bundle.js',
            format: 'iife',
            sourcemap: false
        },
        plugins
    },
    // Engagement Bundle
    {
        input: 'src/bundles/engagement.js',
        output: {
            file: 'js/engines/engagement-bundle.js',
            format: 'iife',
            sourcemap: false
        },
        plugins
    },
    // Main Script
    {
        input: 'js/main.js',
        output: {
            file: 'script.js',
            format: 'iife',
            sourcemap: false,
            banner: '/* GENERATED FILE - DO NOT EDIT DIRECTLY - Edit source in js/main.js and run npm run build */',
        },
        plugins,
    },
];
