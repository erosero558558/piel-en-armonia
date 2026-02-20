import resolve from '@rollup/plugin-node-resolve';

export default {
    input: 'src/booking-ui-entry.js',
    output: {
        file: 'booking-ui.js',
        format: 'iife',
        sourcemap: false,
        paths: {
            'booking-calendar-lazy': './js/booking-calendar.js'
        }
    },
    plugins: [resolve()],
    external: ['booking-calendar-lazy']
};
