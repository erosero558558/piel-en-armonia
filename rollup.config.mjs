import resolve from '@rollup/plugin-node-resolve';

export default [
    // Booking UI
    {
        input: 'src/apps/booking/ui-entry.js',
        output: {
            file: 'booking-ui.js',
            format: 'iife',
            sourcemap: false,
            paths: {
                'booking-calendar-lazy': './js/booking-calendar.js',
            },
        },
        plugins: [resolve()],
        external: ['booking-calendar-lazy'],
    },
    // Booking Engine
    {
        input: 'src/apps/booking/engine.js',
        output: {
            file: 'booking-engine.js',
            format: 'iife',
            name: 'PielBookingEngine',
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
    // Admin App
    {
        input: 'src/apps/admin/index.js',
        output: {
            file: 'admin.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Main Script
    {
        input: 'js/main.js',
        output: {
            file: 'script.js',
            format: 'iife',
            sourcemap: false,
        },
        plugins: [resolve()],
    },
];
