export default {
    content: [
        './**/*.html',
        './js/**/*.js',
        './src/**/*.js',
        './content/**/*.json'
    ],
    css: [
        'styles.css',
        'styles-critical.css',
        'styles-deferred.css'
    ],
    safelist: {
        standard: [
            'html',
            'body',
            'active',
            'open',
            'show',
            'visible',
            'scrolled',
            'loaded',
            'cookie-banner-active',
            'theme-transition',
            'is-hidden',
            'is-disabled-link',
            'disabled'
        ],
        deep: [
            /^is-/,
            /^has-/,
            /active$/,
            /open$/,
            /show$/,
            /visible$/,
            /^cookie-/,
            /^modal-/,
            /^nav-/,
            /^mobile-/,
            /^hero-/,
            /^section-/,
            /^showcase-/,
            /^service-/,
            /^pricing-/,
            /^tele-/,
            /^team-/,
            /^gallery-/,
            /^clinic-/,
            /^review-/,
            /^payment-/,
            /^chatbot-/,
            /^toast-/,
            /^typing-/,
            /^blur-up/
        ],
        greedy: [
            /^data-theme/
        ]
    }
};
