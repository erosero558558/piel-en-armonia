import resolve from '@rollup/plugin-node-resolve';

export default [
    // Admin App
    {
        input: 'src/apps/admin/index.js',
        output: {
            file: 'admin.js',
            format: 'es',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Booking UI
    {
        input: 'src/apps/booking/ui-entry.js',
        output: {
            file: 'js/engines/booking-ui.js',
            format: 'es',
            sourcemap: false
        },
        plugins: [resolve()]
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
        plugins: [resolve()]
    },
    // Booking Calendar
    {
        input: 'src/apps/booking/components/calendar.js',
        output: {
            file: 'js/booking-calendar.js',
            format: 'es',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Chat UI Engine
    {
        input: 'src/apps/chat/ui-engine.js',
        output: {
            file: 'js/engines/chat-ui-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Chat Widget Engine
    {
        input: 'src/apps/chat/widget-engine.js',
        output: {
            file: 'js/engines/chat-widget-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Chat Booking Engine
    {
        input: 'src/apps/chat/booking-engine.js',
        output: {
            file: 'js/engines/chat-booking-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Figo Chat Engine
    {
        input: 'src/apps/chat/engine.js',
        output: {
            file: 'js/engines/chat-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Analytics Engine
    {
        input: 'src/apps/analytics/engine.js',
        output: {
            file: 'js/engines/analytics-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Booking Utils Bundle
    {
        input: 'src/bundles/booking-utils.js',
        output: {
            file: 'js/engines/booking-utils.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Data Bundle
    {
        input: 'src/bundles/data.js',
        output: {
            file: 'js/engines/data-bundle.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // UI Bundle
    {
        input: 'src/bundles/ui.js',
        output: {
            file: 'js/engines/ui-bundle.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Engagement Bundle
    {
        input: 'src/bundles/engagement.js',
        output: {
            file: 'js/engines/engagement-bundle.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Main Script
    {
        input: 'src/apps/main/index.js',
        output: {
            file: 'script.js',
            format: 'iife',
            sourcemap: false,
            banner: '/* GENERATED FILE - DO NOT EDIT DIRECTLY - Edit source in src/apps/main/index.js and run npm run build */',
        },
        plugins: [resolve()],
    },
    // Bootstrap Inline Engine
    {
        input: 'src/apps/shared/bootstrap.js',
        output: {
            file: 'js/bootstrap-inline-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Monitoring Loader
    {
        input: 'src/apps/monitoring/loader.js',
        output: {
            file: 'js/monitoring-loader.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Services Init
    {
        input: 'src/apps/services/init.js',
        output: {
            file: 'js/services-init.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Telemedicina Init
    {
        input: 'src/apps/telemedicine/init.js',
        output: {
            file: 'js/telemedicina-init.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
];
