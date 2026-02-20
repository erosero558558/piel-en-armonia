const globals = require('globals');
const pluginPlaywright = require('eslint-plugin-playwright');
const js = require('@eslint/js');

module.exports = [
    js.configs.recommended,
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            'no-unused-vars': 'warn',
            'no-console': 'off',
            'no-undef': 'warn',
            'no-useless-assignment': 'warn',
            'preserve-caught-error': 'off',
            'no-empty': 'warn',
            'no-redeclare': 'warn',
        },
    },
    {
        files: ['js/**/*.js', '**/*.mjs'],
        languageOptions: {
            sourceType: 'module',
        },
    },
    {
        files: ['tests/**/*.spec.js'],
        ...pluginPlaywright.configs['flat/recommended'],
        rules: {
            ...pluginPlaywright.configs['flat/recommended'].rules,
            'playwright/expect-expect': 'off',
            'playwright/no-conditional-in-test': 'warn',
            'playwright/no-conditional-expect': 'warn',
            'playwright/no-wait-for-timeout': 'warn',
            'playwright/no-useless-not': 'warn'
        },
    },
];
