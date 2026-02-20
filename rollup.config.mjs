import resolve from '@rollup/plugin-node-resolve';

export default [
    {
        input: 'src/booking-ui-entry.js',
        output: {
            file: 'booking-ui.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    },
    {
        input: 'js/main.js',
        output: {
            file: 'script.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve()]
    }
];
