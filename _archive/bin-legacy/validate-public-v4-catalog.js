#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const catalogPath = path.join(repoRoot, 'content', 'public-v4', 'catalog.json');
const assetsPath = path.join(
    repoRoot,
    'content',
    'public-v4',
    'assets-manifest.json'
);

function fail(message) {
    console.error(`[public-v4] ${message}`);
    process.exitCode = 1;
}

function readJson(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
}

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
    const normalized = normalizeAssetPath(assetPath).replace(/^\/+/, '');
    return path.join(repoRoot, normalized);
}

function normalizeComparableLocalizedText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function buildAssetPathIndexes(manifest) {
    const byPath = new Map();

    const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
    assets.forEach((asset) => {
        const src = normalizeAssetPath(asset?.src);
        if (src) {
            byPath.set(src, asset);
        }
        const derivatives = Array.isArray(asset?.derivatives)
            ? asset.derivatives
            : [];
        derivatives.forEach((entry) => {
            const normalized = normalizeAssetPath(entry);
            if (normalized) {
                byPath.set(normalized, asset);
            }
        });
    });

    return { byPath };
}

function validateCatalog(catalog, manifest) {
    const errors = [];

    if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
        errors.push('catalog must be an object.');
        return errors;
    }

    ['version', 'currency', 'updated_at'].forEach((key) => {
        if (!isNonEmptyString(catalog[key])) {
            errors.push(`catalog.${key} must be a non-empty string.`);
        }
    });

    if (
        !Array.isArray(catalog.booking_options) ||
        catalog.booking_options.length === 0
    ) {
        errors.push('catalog.booking_options must be a non-empty array.');
    } else {
        catalog.booking_options.forEach((option, index) => {
            const prefix = `catalog.booking_options[${index}]`;
            [
                'id',
                'label_es',
                'label_en',
                'final_price_rule',
                'price_label_short',
                'price_disclaimer_es',
                'price_disclaimer_en',
            ].forEach((key) => {
                if (!isNonEmptyString(option && option[key])) {
                    errors.push(`${prefix}.${key} must be a non-empty string.`);
                }
            });

            const base = Number(option && option.base_price_usd);
            const tax = Number(option && option.tax_rate);
            if (!Number.isFinite(base) || base < 0) {
                errors.push(
                    `${prefix}.base_price_usd must be a non-negative number.`
                );
            }
            if (!Number.isFinite(tax) || tax < 0 || tax > 1) {
                errors.push(`${prefix}.tax_rate must be between 0 and 1.`);
            }
        });
    }

    const bookingOptionMap = new Map();
    (Array.isArray(catalog.booking_options)
        ? catalog.booking_options
        : []
    ).forEach((option, index) => {
        const key = String(option?.id || '')
            .trim()
            .toLowerCase();
        if (!key) {
            return;
        }
        if (bookingOptionMap.has(key)) {
            errors.push(
                `catalog.booking_options[${index}].id is duplicated (${option.id}).`
            );
            return;
        }
        bookingOptionMap.set(key, option);
    });
    const assetIndexes = buildAssetPathIndexes(manifest);

    if (!Array.isArray(catalog.services) || catalog.services.length === 0) {
        errors.push('catalog.services must be a non-empty array.');
    } else {
        const seenSlugs = new Set();
        const mediaSources = new Set();
        catalog.services.forEach((service, index) => {
            const prefix = `catalog.services[${index}]`;
            [
                'slug',
                'category',
                'hero',
                'summary',
                'duration',
                'runtime_service_id',
                'final_price_rule',
            ].forEach((key) => {
                if (!isNonEmptyString(service && service[key])) {
                    errors.push(`${prefix}.${key} must be a non-empty string.`);
                }
            });

            if (isNonEmptyString(service && service.slug)) {
                if (seenSlugs.has(service.slug)) {
                    errors.push(
                        `${prefix}.slug is duplicated (${service.slug}).`
                    );
                }
                seenSlugs.add(service.slug);
            }

            const base = Number(service && service.base_price_usd);
            const tax = Number(service && service.tax_rate);
            if (!Number.isFinite(base) || base < 0) {
                errors.push(
                    `${prefix}.base_price_usd must be a non-negative number.`
                );
            }
            if (!Number.isFinite(tax) || tax < 0 || tax > 1) {
                errors.push(`${prefix}.tax_rate must be between 0 and 1.`);
            }
            if (!isNonEmptyString(service && service.price_label_short)) {
                errors.push(
                    `${prefix}.price_label_short must be a non-empty string.`
                );
            }
            if (!isNonEmptyString(service && service.price_disclaimer_es)) {
                errors.push(
                    `${prefix}.price_disclaimer_es must be a non-empty string.`
                );
            }
            if (!isNonEmptyString(service && service.price_disclaimer_en)) {
                errors.push(
                    `${prefix}.price_disclaimer_en must be a non-empty string.`
                );
            }
            if (
                !service ||
                !service.cta ||
                !isNonEmptyString(service.cta.service_hint)
            ) {
                errors.push(
                    `${prefix}.cta.service_hint must be a non-empty string.`
                );
            } else {
                const hint = String(service.cta.service_hint || '')
                    .trim()
                    .toLowerCase();
                if (!bookingOptionMap.has(hint)) {
                    errors.push(
                        `${prefix}.cta.service_hint references an unknown booking option (${service.cta.service_hint}).`
                    );
                }
            }

            const runtimeServiceId = String(service?.runtime_service_id || '')
                .trim()
                .toLowerCase();
            if (runtimeServiceId) {
                const runtimeBooking = bookingOptionMap.get(runtimeServiceId);
                if (!runtimeBooking) {
                    errors.push(
                        `${prefix}.runtime_service_id references an unknown booking option (${service.runtime_service_id}).`
                    );
                } else {
                    const hint = String(service?.cta?.service_hint || '')
                        .trim()
                        .toLowerCase();
                    if (hint && hint !== runtimeServiceId) {
                        errors.push(
                            `${prefix}.cta.service_hint must match runtime_service_id (${service.cta.service_hint} != ${service.runtime_service_id}).`
                        );
                    }

                    const serviceBase = Number(service?.base_price_usd);
                    const serviceTax = Number(service?.tax_rate);
                    const serviceTotal = Number(service?.final_price_usd);
                    const expectedTotal = Number(
                        (
                            Number(runtimeBooking.base_price_usd || 0) *
                            (1 + Number(runtimeBooking.tax_rate || 0))
                        ).toFixed(2)
                    );
                    if (
                        Number.isFinite(serviceBase) &&
                        Number(serviceBase) !==
                            Number(runtimeBooking.base_price_usd || 0)
                    ) {
                        errors.push(
                            `${prefix}.base_price_usd must match booking option ${service.runtime_service_id}.`
                        );
                    }
                    if (
                        Number.isFinite(serviceTax) &&
                        Number(serviceTax) !==
                            Number(runtimeBooking.tax_rate || 0)
                    ) {
                        errors.push(
                            `${prefix}.tax_rate must match booking option ${service.runtime_service_id}.`
                        );
                    }
                    if (
                        isNonEmptyString(service?.final_price_rule) &&
                        String(service.final_price_rule)
                            .trim()
                            .toLowerCase() !==
                            String(runtimeBooking.final_price_rule || '')
                                .trim()
                                .toLowerCase()
                    ) {
                        errors.push(
                            `${prefix}.final_price_rule must match booking option ${service.runtime_service_id}.`
                        );
                    }
                    if (
                        Number.isFinite(serviceTotal) &&
                        Math.abs(serviceTotal - expectedTotal) > 0.000001
                    ) {
                        errors.push(
                            `${prefix}.final_price_usd must equal base*(1+tax) from booking option ${service.runtime_service_id}.`
                        );
                    }

                    if (
                        Number.isFinite(Number(service?.price_from)) &&
                        Number(service.price_from) !== Number(serviceBase)
                    ) {
                        errors.push(
                            `${prefix}.price_from must match base_price_usd.`
                        );
                    }
                    if (
                        Number.isFinite(Number(service?.iva)) &&
                        Number(service.iva) !== Number(serviceTax)
                    ) {
                        errors.push(`${prefix}.iva must match tax_rate.`);
                    }
                }
            }

            if (
                !service ||
                !service.media ||
                typeof service.media !== 'object'
            ) {
                errors.push(`${prefix}.media must be an object.`);
                return;
            }

            if (!isNonEmptyString(service.media.src)) {
                errors.push(`${prefix}.media.src must be a non-empty string.`);
            } else {
                const mediaPath = normalizeAssetPath(service.media.src);
                mediaSources.add(mediaPath);
                const mediaAsset = assetIndexes.byPath.get(mediaPath) || null;
                if (!mediaAsset) {
                    errors.push(
                        `${prefix}.media.src must exist in assets-manifest paths (${service.media.src}).`
                    );
                } else {
                    const usage = Array.isArray(mediaAsset.usage_scope)
                        ? mediaAsset.usage_scope.map((entry) =>
                              String(entry || '')
                                  .trim()
                                  .toLowerCase()
                          )
                        : [];
                    if (
                        !usage.includes('services') &&
                        !usage.includes('service-detail')
                    ) {
                        errors.push(
                            `${prefix}.media.src must point to an asset with usage_scope including services or service-detail.`
                        );
                    }
                }
            }

            if (!isNonEmptyString(service.media.alt_es)) {
                errors.push(
                    `${prefix}.media.alt_es must be a non-empty string.`
                );
            }
            if (!isNonEmptyString(service.media.alt_en)) {
                errors.push(
                    `${prefix}.media.alt_en must be a non-empty string.`
                );
            }
            if (
                isNonEmptyString(service.media.alt_es) &&
                isNonEmptyString(service.media.alt_en)
            ) {
                const comparableEs = normalizeComparableLocalizedText(
                    service.media.alt_es
                );
                const comparableEn = normalizeComparableLocalizedText(
                    service.media.alt_en
                );
                if (comparableEs && comparableEs === comparableEn) {
                    errors.push(
                        `${prefix}.media.alt_en appears untranslated (matches alt_es).`
                    );
                }
            }
        });

        const minUniqueMediaSources = Math.min(
            6,
            Math.max(3, Math.ceil(catalog.services.length / 3))
        );
        if (mediaSources.size < minUniqueMediaSources) {
            errors.push(
                `catalog.services.media.src must use at least ${minUniqueMediaSources} unique sources (found ${mediaSources.size}).`
            );
        }
    }

    return errors;
}

function validateAssets(manifest) {
    const errors = [];

    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        errors.push('assets manifest must be an object.');
        return errors;
    }

    if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
        errors.push('assets manifest.assets must be a non-empty array.');
        return errors;
    }

    const seenAssetIds = new Set();
    let assetsWithAvif = 0;
    manifest.assets.forEach((asset, index) => {
        const prefix = `assets[${index}]`;
        ['id', 'src', 'license', 'alt_es', 'alt_en'].forEach((key) => {
            if (!isNonEmptyString(asset && asset[key])) {
                errors.push(`${prefix}.${key} must be a non-empty string.`);
            }
        });
        if (
            isNonEmptyString(asset?.alt_es) &&
            isNonEmptyString(asset?.alt_en)
        ) {
            const comparableEs = normalizeComparableLocalizedText(asset.alt_es);
            const comparableEn = normalizeComparableLocalizedText(asset.alt_en);
            if (comparableEs && comparableEs === comparableEn) {
                errors.push(
                    `${prefix}.alt_en appears untranslated (matches alt_es).`
                );
            }
        }
        if (isNonEmptyString(asset?.id)) {
            const normalizedId = String(asset.id).trim().toLowerCase();
            if (seenAssetIds.has(normalizedId)) {
                errors.push(`${prefix}.id is duplicated (${asset.id}).`);
            }
            seenAssetIds.add(normalizedId);
        }
        if (
            !Array.isArray(asset.usage_scope) ||
            asset.usage_scope.length === 0
        ) {
            errors.push(`${prefix}.usage_scope must be a non-empty array.`);
        }
        if (
            !Array.isArray(asset.derivatives) ||
            asset.derivatives.length === 0
        ) {
            errors.push(`${prefix}.derivatives must be a non-empty array.`);
            return;
        }

        const files = [asset.src, ...asset.derivatives].map((entry) =>
            normalizeAssetPath(entry)
        );
        const formats = new Set(
            files.map((entry) => assetFormat(entry)).filter(Boolean)
        );
        ['webp', 'jpg'].forEach((requiredFormat) => {
            if (!formats.has(requiredFormat)) {
                errors.push(
                    `${prefix} is missing required ${requiredFormat} derivative.`
                );
            }
        });
        if (formats.has('avif')) {
            assetsWithAvif += 1;
        }

        files.forEach((entry) => {
            if (!entry) {
                errors.push(`${prefix} contains an empty asset path.`);
                return;
            }
            if (!fs.existsSync(toRepoPath(entry))) {
                errors.push(`${prefix} file does not exist in repo: ${entry}`);
            }
        });
    });

    if (assetsWithAvif === 0) {
        errors.push(
            'assets manifest must include at least one AVIF asset variant.'
        );
    }

    return errors;
}

try {
    if (!fs.existsSync(catalogPath)) {
        fail(`Missing ${path.relative(repoRoot, catalogPath)}.`);
        process.exit(1);
    }
    if (!fs.existsSync(assetsPath)) {
        fail(`Missing ${path.relative(repoRoot, assetsPath)}.`);
        process.exit(1);
    }

    const catalog = readJson(catalogPath);
    const assets = readJson(assetsPath);

    const errors = [
        ...validateCatalog(catalog, assets),
        ...validateAssets(assets),
    ];

    if (errors.length > 0) {
        errors.forEach((message) => fail(message));
        process.exit(1);
    }

    console.log('[public-v4] catalog and assets manifest are valid.');
} catch (error) {
    fail(error && error.message ? error.message : String(error));
    process.exit(1);
}
