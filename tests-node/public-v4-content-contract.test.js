#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const catalogPath = path.join(repoRoot, 'content', 'public-v4', 'catalog.json');
const assetsPath = path.join(
    repoRoot,
    'content',
    'public-v4',
    'assets-manifest.json'
);

function normalizeAssetPath(value) {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/');
}

function assetFormat(value) {
    const normalized = normalizeAssetPath(value).toLowerCase();
    if (normalized.endsWith('.avif')) return 'avif';
    if (normalized.endsWith('.webp')) return 'webp';
    if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg'))
        return 'jpg';
    if (normalized.endsWith('.png')) return 'png';
    return '';
}

function toRepoPath(assetPath) {
    return path.join(
        repoRoot,
        normalizeAssetPath(assetPath).replace(/^\/+/, '')
    );
}

function normalizeComparableLocalizedText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

test('public-v4 catalog exists and includes required pricing fields', () => {
    assert.equal(fs.existsSync(catalogPath), true, 'catalog.json must exist');
    assert.equal(
        fs.existsSync(assetsPath),
        true,
        'assets-manifest.json must exist'
    );
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));

    assert.equal(
        Array.isArray(catalog.services),
        true,
        'services must be an array'
    );
    assert.equal(
        catalog.services.length > 0,
        true,
        'services must not be empty'
    );
    assert.equal(
        Array.isArray(catalog.booking_options),
        true,
        'booking_options must be an array'
    );
    assert.equal(
        catalog.booking_options.length > 0,
        true,
        'booking_options must not be empty'
    );
    assert.equal(
        Array.isArray(manifest.assets),
        true,
        'assets must be an array'
    );

    const bookingById = new Map();
    for (const option of catalog.booking_options) {
        const key = String(option?.id || '')
            .trim()
            .toLowerCase();
        if (!key) {
            continue;
        }
        assert.equal(
            bookingById.has(key),
            false,
            `booking option id must be unique (${option.id})`
        );
        bookingById.set(key, option);
    }
    const manifestPaths = new Set();
    for (const asset of manifest.assets) {
        const source = normalizeAssetPath(asset?.src);
        if (source) manifestPaths.add(source);
        for (const entry of Array.isArray(asset?.derivatives)
            ? asset.derivatives
            : []) {
            const normalized = normalizeAssetPath(entry);
            if (normalized) manifestPaths.add(normalized);
        }
    }
    const mediaSources = new Set();

    for (const option of catalog.booking_options) {
        assert.equal(typeof option.id, 'string');
        assert.equal(typeof option.label_es, 'string');
        assert.equal(typeof option.label_en, 'string');
        assert.equal(Number.isFinite(Number(option.base_price_usd)), true);
        assert.equal(Number.isFinite(Number(option.tax_rate)), true);
        assert.equal(typeof option.final_price_rule, 'string');
        assert.equal(typeof option.price_label_short, 'string');
        assert.equal(typeof option.price_disclaimer_es, 'string');
        assert.equal(typeof option.price_disclaimer_en, 'string');
    }

    for (const service of catalog.services) {
        assert.equal(typeof service.slug, 'string');
        assert.equal(typeof service.runtime_service_id, 'string');
        assert.equal(Number.isFinite(Number(service.base_price_usd)), true);
        assert.equal(Number.isFinite(Number(service.tax_rate)), true);
        assert.equal(typeof service.final_price_rule, 'string');
        assert.equal(typeof service.price_label_short, 'string');
        assert.equal(typeof service.price_disclaimer_es, 'string');
        assert.equal(typeof service.price_disclaimer_en, 'string');
        assert.equal(typeof service.cta?.service_hint, 'string');
        const runtimeId = String(service.runtime_service_id || '')
            .trim()
            .toLowerCase();
        const hintId = String(service.cta.service_hint || '')
            .trim()
            .toLowerCase();
        assert.equal(
            hintId,
            runtimeId,
            `service ${service.slug} must keep cta.service_hint and runtime_service_id aligned`
        );
        assert.equal(
            bookingById.has(hintId),
            true,
            `service ${service.slug} must reference an existing booking option`
        );
        const bookingOption = bookingById.get(runtimeId);
        assert.equal(
            Boolean(bookingOption),
            true,
            `missing booking option for ${service.slug}`
        );
        assert.equal(
            Number(service.base_price_usd),
            Number(bookingOption.base_price_usd),
            `service ${service.slug} must match booking base price`
        );
        assert.equal(
            Number(service.tax_rate),
            Number(bookingOption.tax_rate),
            `service ${service.slug} must match booking tax rate`
        );
        assert.equal(
            String(service.final_price_rule || '')
                .trim()
                .toLowerCase(),
            String(bookingOption.final_price_rule || '')
                .trim()
                .toLowerCase(),
            `service ${service.slug} must match booking final_price_rule`
        );
        const expectedTotal = Number(
            (
                Number(bookingOption.base_price_usd || 0) *
                (1 + Number(bookingOption.tax_rate || 0))
            ).toFixed(2)
        );
        assert.equal(
            Number(service.final_price_usd),
            expectedTotal,
            `service ${service.slug} final_price_usd must be base*(1+tax)`
        );
        assert.equal(
            Number(service.price_from),
            Number(service.base_price_usd),
            `service ${service.slug} price_from must match base_price_usd`
        );
        assert.equal(
            Number(service.iva),
            Number(service.tax_rate),
            `service ${service.slug} iva must match tax_rate`
        );
        assert.equal(
            typeof service.media,
            'object',
            `service ${service.slug} must include media`
        );
        assert.equal(typeof service.media?.src, 'string');
        assert.equal(service.media.src.trim().length > 0, true);
        assert.equal(typeof service.media?.alt_es, 'string');
        assert.equal(service.media.alt_es.trim().length > 0, true);
        assert.equal(typeof service.media?.alt_en, 'string');
        assert.equal(service.media.alt_en.trim().length > 0, true);
        assert.equal(
            normalizeComparableLocalizedText(service.media.alt_es) !==
                normalizeComparableLocalizedText(service.media.alt_en),
            true,
            `service ${service.slug} must localize alt_en independently from alt_es`
        );
        const mediaPath = normalizeAssetPath(service.media.src);
        mediaSources.add(mediaPath);
        assert.equal(
            manifestPaths.has(mediaPath),
            true,
            `service ${service.slug} media path must exist in assets manifest`
        );
    }

    const minUniqueMediaSources = Math.min(
        6,
        Math.max(3, Math.ceil(catalog.services.length / 3))
    );
    assert.equal(
        mediaSources.size >= minUniqueMediaSources,
        true,
        `catalog should expose at least ${minUniqueMediaSources} unique service media sources (found ${mediaSources.size})`
    );
});

test('public-v4 assets manifest exists and has stock-license metadata', () => {
    assert.equal(
        fs.existsSync(assetsPath),
        true,
        'assets-manifest.json must exist'
    );
    const manifest = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));

    assert.equal(
        Array.isArray(manifest.assets),
        true,
        'assets must be an array'
    );
    assert.equal(manifest.assets.length > 0, true, 'assets must not be empty');

    let assetsWithAvif = 0;
    for (const asset of manifest.assets) {
        assert.equal(typeof asset.id, 'string');
        assert.equal(typeof asset.src, 'string');
        assert.equal(typeof asset.license, 'string');
        assert.equal(
            asset.license.includes('stock'),
            true,
            'license should indicate stock usage'
        );
        assert.equal(Array.isArray(asset.usage_scope), true);
        assert.equal(asset.usage_scope.length > 0, true);
        assert.equal(Array.isArray(asset.derivatives), true);
        assert.equal(asset.derivatives.length > 0, true);
        assert.equal(typeof asset.alt_es, 'string');
        assert.equal(typeof asset.alt_en, 'string');
        assert.equal(
            normalizeComparableLocalizedText(asset.alt_es) !==
                normalizeComparableLocalizedText(asset.alt_en),
            true,
            `asset ${asset.id} must provide localized alt_en text`
        );

        const files = [asset.src, ...asset.derivatives];
        const formats = new Set(
            files.map((entry) => assetFormat(entry)).filter(Boolean)
        );
        assert.equal(
            formats.has('webp'),
            true,
            `asset ${asset.id} must include webp`
        );
        assert.equal(
            formats.has('jpg'),
            true,
            `asset ${asset.id} must include jpg/jpeg`
        );
        if (formats.has('avif')) {
            assetsWithAvif += 1;
        }
        for (const file of files) {
            assert.equal(
                fs.existsSync(toRepoPath(file)),
                true,
                `asset file must exist: ${file}`
            );
        }
    }
    assert.equal(
        assetsWithAvif > 0,
        true,
        'at least one asset should include avif variant'
    );
});
