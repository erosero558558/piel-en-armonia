#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const catalogPath = path.join(repoRoot, 'content', 'public-v4', 'catalog.json');

function readCatalog() {
    const raw = fs.readFileSync(catalogPath, 'utf8');
    return JSON.parse(raw);
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readServiceHtml(locale, slug) {
    const relativePath =
        locale === 'en'
            ? path.join('en', 'services', slug, 'index.html')
            : path.join('es', 'servicios', slug, 'index.html');
    const fullPath = path.join(repoRoot, relativePath);
    assert.equal(
        fs.existsSync(fullPath),
        true,
        `missing static page: ${relativePath}`
    );
    return fs.readFileSync(fullPath, 'utf8');
}

function expectedBookingLabel(option, locale) {
    const base = Number(option?.base_price_usd || 0);
    const taxRate = Number(option?.tax_rate || 0);
    const taxPercent = Math.round(taxRate * 100);
    if (locale === 'en') {
        return (
            String(option?.price_label_short_en || '').trim() ||
            `USD ${base.toFixed(2)} + Tax ${taxPercent}%`
        );
    }
    return (
        String(option?.price_label_short_es || '').trim() ||
        String(option?.price_label_short || '').trim() ||
        `USD ${base.toFixed(2)} + IVA ${taxPercent}%`
    );
}

function expectedBookingDisclaimer(option, locale) {
    if (locale === 'en') {
        return (
            String(option?.price_disclaimer_en || '').trim() ||
            'Final amount is confirmed before payment authorization.'
        );
    }
    return (
        String(option?.price_disclaimer_es || '').trim() ||
        'El valor final se confirma antes de autorizar el pago.'
    );
}

function expectedPolicyPath(locale) {
    return locale === 'en'
        ? '/en/legal/terms/#cancellations'
        : '/es/legal/terminos/#cancelaciones';
}

function extractOptionTag(html, value) {
    const pattern = new RegExp(
        `<option\\s+[^>]*value="${escapeRegExp(value)}"[^>]*>`,
        'i'
    );
    const match = html.match(pattern);
    assert.equal(
        Boolean(match),
        true,
        `missing booking option for value="${value}"`
    );
    return match[0];
}

function extractAttr(tag, attribute) {
    const pattern = new RegExp(`${escapeRegExp(attribute)}="([^"]*)"`, 'i');
    const match = tag.match(pattern);
    return match ? String(match[1]) : '';
}

function toVisibleText(html) {
    return String(html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

test('public-v4 static service pages keep ES/EN parity for pricing, hints, and localization', () => {
    const catalog = readCatalog();
    const services = Array.isArray(catalog?.services) ? catalog.services : [];
    const bookingOptions = Array.isArray(catalog?.booking_options)
        ? catalog.booking_options
        : [];
    const bookingById = new Map(
        bookingOptions.map((option) => [
            String(option?.id || '').trim(),
            option,
        ])
    );

    assert.equal(
        services.length > 0,
        true,
        'catalog.services must not be empty'
    );

    const englishRawAudiencePattern =
        /\badults?\b|\bseniors?\b|\bchildren\b|\bteenagers?\b/i;
    const spanishRawAudiencePattern =
        /\badultos\b|\bninos\b|\badolescentes\b|\badultos mayores\b/i;

    for (const service of services) {
        const slug = String(service?.slug || '').trim();
        const runtimeId = String(service?.runtime_service_id || '').trim();
        const hint = String(service?.cta?.service_hint || '').trim();
        assert.equal(Boolean(slug), true, 'service slug must be non-empty');
        assert.equal(
            Boolean(runtimeId),
            true,
            `runtime_service_id missing for ${slug}`
        );
        assert.equal(
            Boolean(hint),
            true,
            `cta.service_hint missing for ${slug}`
        );
        assert.equal(
            hint,
            runtimeId,
            `service ${slug} must keep service_hint == runtime_service_id`
        );

        const option = bookingById.get(runtimeId);
        assert.equal(
            Boolean(option),
            true,
            `missing booking option ${runtimeId} for ${slug}`
        );

        const expectedTotal = Number(
            (
                Number(option.base_price_usd || 0) *
                (1 + Number(option.tax_rate || 0))
            ).toFixed(2)
        );

        for (const locale of ['es', 'en']) {
            const html = readServiceHtml(locale, slug);
            const visibleText = toVisibleText(html);
            const localePrefix = locale === 'en' ? '/en' : '/es';
            const expectedLabel = expectedBookingLabel(option, locale);
            const expectedOptionDisclaimer = expectedBookingDisclaimer(
                option,
                locale
            );
            const expectedServiceDisclaimer =
                locale === 'en'
                    ? String(service?.price_disclaimer_en || '').trim()
                    : String(service?.price_disclaimer_es || '').trim();
            const expectedHeroAlt =
                locale === 'en'
                    ? String(service?.media?.alt_en || '').trim()
                    : String(service?.media?.alt_es || '').trim();

            assert.equal(
                html.includes(`href="${localePrefix}/?service=${hint}#citas"`),
                true,
                `service CTA missing normalized booking URL for ${locale}/${slug}`
            );
            assert.equal(
                html.includes(`data-service-slug="${slug}"`),
                true,
                `service slug analytics attribute missing for ${locale}/${slug}`
            );
            assert.equal(
                html.includes(`data-booking-hint="${hint}"`),
                true,
                `booking hint missing for ${locale}/${slug}`
            );
            assert.equal(
                html.includes(`data-service-hint="${hint}"`),
                true,
                `booking mount hint missing for ${locale}/${slug}`
            );
            assert.equal(
                html.includes(expectedLabel),
                true,
                `localized booking label missing for ${locale}/${slug}`
            );
            assert.equal(
                html.includes(expectedServiceDisclaimer),
                true,
                `service price disclaimer missing for ${locale}/${slug}`
            );
            assert.equal(
                html.includes(`href="${expectedPolicyPath(locale)}"`),
                true,
                `policy link missing for ${locale}/${slug}`
            );
            assert.equal(
                html.includes(`alt="${expectedHeroAlt}"`),
                true,
                `hero media alt mismatch for ${locale}/${slug}`
            );

            const optionTag = extractOptionTag(html, hint);
            const optionBase = Number(extractAttr(optionTag, 'data-price'));
            const optionTax = Number(
                extractAttr(optionTag, 'data-service-tax')
            );
            const optionTotal = Number(
                extractAttr(optionTag, 'data-price-total')
            );
            const optionLabel = extractAttr(
                optionTag,
                'data-price-label-short'
            );
            const optionDisclaimer = extractAttr(
                optionTag,
                'data-price-disclaimer'
            );

            assert.equal(
                optionBase,
                Number(option.base_price_usd || 0),
                `base price mismatch in static option for ${locale}/${slug}`
            );
            assert.equal(
                optionTax,
                Number(option.tax_rate || 0),
                `tax mismatch in static option for ${locale}/${slug}`
            );
            assert.equal(
                Math.abs(optionTotal - expectedTotal) < 0.000001,
                true,
                `total mismatch in static option for ${locale}/${slug}`
            );
            assert.equal(
                optionLabel,
                expectedLabel,
                `label mismatch in static option for ${locale}/${slug}`
            );
            assert.equal(
                optionDisclaimer,
                expectedOptionDisclaimer,
                `disclaimer mismatch in static option for ${locale}/${slug}`
            );
            assert.equal(
                /\sselected(\s|>)/i.test(optionTag),
                true,
                `service option should be preselected for ${locale}/${slug}`
            );

            if (locale === 'es') {
                assert.equal(
                    englishRawAudiencePattern.test(visibleText),
                    false,
                    `raw EN audience token leaked in ES page for ${slug}`
                );
            } else {
                assert.equal(
                    spanishRawAudiencePattern.test(visibleText),
                    false,
                    `raw ES audience token leaked in EN page for ${slug}`
                );
            }
        }
    }
});
