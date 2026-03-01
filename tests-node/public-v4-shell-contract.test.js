#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const CORE_PAGES = [
    'es/index.html',
    'en/index.html',
    'es/servicios/acne-rosacea/index.html',
    'en/services/acne-rosacea/index.html',
];

function readPage(relativePath) {
    const filePath = path.join(REPO_ROOT, relativePath);
    assert.equal(
        fs.existsSync(filePath),
        true,
        `missing page: ${relativePath}`
    );
    return fs.readFileSync(filePath, 'utf8');
}

function extractPublicV4Flags(html, pageName) {
    const match = html.match(/window\.__PUBLIC_V4_FLAGS\s*=\s*(\{[^;]+\});/);
    assert.ok(match, `missing __PUBLIC_V4_FLAGS script in ${pageName}`);
    let payload = null;
    assert.doesNotThrow(() => {
        payload = JSON.parse(match[1]);
    }, `invalid __PUBLIC_V4_FLAGS JSON in ${pageName}`);
    return payload;
}

test('public shell pages do not contain unresolved template placeholders', () => {
    for (const relativePath of CORE_PAGES) {
        const html = readPage(relativePath);
        assert.equal(
            html.includes('{JSON.stringify('),
            false,
            `unresolved JSON placeholder found in ${relativePath}`
        );
        assert.equal(
            html.includes('{Number.isFinite('),
            false,
            `unresolved Number placeholder found in ${relativePath}`
        );
        assert.equal(
            html.includes('{v4'),
            false,
            `unresolved v4 placeholder found in ${relativePath}`
        );
    }
});

test('public shell pages publish V4 flags and body attributes consistently', () => {
    for (const relativePath of CORE_PAGES) {
        const html = readPage(relativePath);
        const flags = extractPublicV4Flags(html, relativePath);

        assert.equal(typeof flags.public_v4_enabled, 'boolean');
        assert.equal(Number.isFinite(Number(flags.public_v4_ratio)), true);
        assert.equal(typeof flags.public_v4_force_locale, 'string');
        assert.equal(typeof flags.public_v4_kill_switch, 'boolean');

        assert.match(
            html,
            /data-public-v4-enabled="(true|false)"/,
            `missing data-public-v4-enabled in ${relativePath}`
        );
        assert.match(
            html,
            /data-public-v4-ratio="[^"]+"/,
            `missing data-public-v4-ratio in ${relativePath}`
        );
        assert.match(
            html,
            /data-public-v4-kill-switch="(true|false)"/,
            `missing data-public-v4-kill-switch in ${relativePath}`
        );
    }
});

test('service hero price label is localized in ES/EN static outputs', () => {
    const esHtml = readPage('es/servicios/acne-rosacea/index.html');
    const enHtml = readPage('en/services/acne-rosacea/index.html');

    const esHeroPrice = esHtml.match(
        /<div class="service-hero-v3__meta">\s*<span>[^<]+<\/span>\s*<span>([^<]+)<\/span>/i
    );
    const enHeroPrice = enHtml.match(
        /<div class="service-hero-v3__meta">\s*<span>[^<]+<\/span>\s*<span>([^<]+)<\/span>/i
    );

    assert.ok(esHeroPrice, 'missing ES hero price meta');
    assert.ok(enHeroPrice, 'missing EN hero price meta');
    assert.match(esHeroPrice[1], /IVA/i, 'ES hero price must use IVA label');
    assert.match(enHeroPrice[1], /Tax/i, 'EN hero price must use Tax label');
    assert.equal(
        /IVA/i.test(enHeroPrice[1]),
        false,
        'EN hero price must not contain IVA label'
    );
});

test('booking shell exposes trust layer and policy links in ES/EN outputs', () => {
    const esHtml = readPage('es/servicios/acne-rosacea/index.html');
    const enHtml = readPage('en/services/acne-rosacea/index.html');

    assert.match(
        esHtml,
        /data-booking-assurance/,
        'missing booking assurance in ES'
    );
    assert.match(
        enHtml,
        /data-booking-assurance/,
        'missing booking assurance in EN'
    );

    assert.match(
        esHtml,
        /data-entry-surface="booking_companion_whatsapp"/i,
        'ES WhatsApp companion CTA is missing'
    );
    assert.match(
        enHtml,
        /data-entry-surface="booking_companion_whatsapp"/i,
        'EN WhatsApp companion CTA is missing'
    );
    assert.match(
        esHtml,
        /data-service-intent="remote"/i,
        'ES booking shell should expose remote intent for companion routes'
    );
    assert.match(
        enHtml,
        /data-service-intent="remote"/i,
        'EN booking shell should expose remote intent for companion routes'
    );
    assert.match(
        esHtml,
        /data-booking-hint="acne"/i,
        'ES booking shell should expose booking hint in companion CTAs'
    );
    assert.match(
        enHtml,
        /data-booking-hint="acne"/i,
        'EN booking shell should expose booking hint in companion CTAs'
    );

    assert.match(
        esHtml,
        /href="\/es\/legal\/terminos\/#cancelaciones"/i,
        'ES booking policy link must point to terms cancellations section'
    );
    assert.match(
        enHtml,
        /href="\/en\/legal\/terms\/#cancellations"/i,
        'EN booking policy link must point to terms cancellations section'
    );

    assert.match(
        esHtml,
        /Confianza de pago/i,
        'ES payment trust section missing'
    );
    assert.match(enHtml, /Payment trust/i, 'EN payment trust section missing');
    assert.match(
        esHtml,
        /Preguntas frecuentes de pago/i,
        'ES payment FAQ missing'
    );
    assert.match(enHtml, /Payment FAQ/i, 'EN payment FAQ missing');
});
