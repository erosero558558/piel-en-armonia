import resolve from '@rollup/plugin-node-resolve';

export default [
    // Booking UI
    {
        input: 'src/apps/booking/ui-entry.js',
        output: {
            file: 'booking-ui.js',
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
            file: 'booking-engine.js',
            format: 'iife',
            name: 'Piel.BookingEngine',
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
            dir: '.',
            entryFileNames: 'admin.js',
            chunkFileNames: 'js/admin-chunks/[name].js',
            format: 'es',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Chat UI Engine
    {
        input: 'src/apps/chat/ui-engine.js',
        output: {
            file: 'chat-ui-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Chat Widget Engine
    {
        input: 'src/apps/chat/widget-engine.js',
        output: {
            file: 'chat-widget-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Chat Booking Engine
    {
        input: 'src/apps/chat/booking-engine.js',
        output: {
            file: 'chat-booking-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    // Figo Chat Engine
    {
        input: 'src/apps/chat/engine.js',
        output: {
            file: 'chat-engine.js',
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
