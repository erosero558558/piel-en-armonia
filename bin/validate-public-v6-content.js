#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const requiredFiles = [
    'content/public-v6/assets-manifest.json',
    'content/public-v6/image-slot-registry.json',
    'content/public-v6/image-decisions.json',
    'content/public-v6/es/navigation.json',
    'content/public-v6/es/home.json',
    'content/public-v6/es/hub.json',
    'content/public-v6/es/service.json',
    'content/public-v6/es/telemedicine.json',
    'content/public-v6/es/legal.json',
    'content/public-v6/en/navigation.json',
    'content/public-v6/en/home.json',
    'content/public-v6/en/hub.json',
    'content/public-v6/en/service.json',
    'content/public-v6/en/telemedicine.json',
    'content/public-v6/en/legal.json',
];

const LEGAL_SLOT_MAP = {
    terms: 'terminos',
    privacy: 'privacidad',
    cookies: 'cookies',
    'medical-disclaimer': 'aviso-medico',
};
const VALID_SOURCE_KINDS = new Set(['real_photo', 'ai_photoreal']);
const VALID_IDENTITY_POLICIES = new Set(['generic', 'staff_real']);
const STAFF_REAL_REQUIRED_ASSETS = new Set([
    'v6-clinic-doctor-rosero',
    'v6-clinic-doctor-narvaez',
    'v6-clinic-team-roundtable',
]);
const MAX_PRIMARY_IMAGE_REFS = 8;

function readJson(relativePath) {
    const full = path.join(ROOT, relativePath);
    const raw = fs.readFileSync(full, 'utf8');
    return JSON.parse(raw);
}

function normalizeAssetBasePath(value) {
    return String(value || '')
        .trim()
        .split(/\s+/u)[0]
        .replace(
            /-(400|500|640|800|900|1024|1200|1344|1400|lqip)(?=\.(webp|jpg)$)/u,
            ''
        );
}

function collectPrimaryImageRefs(value, counts) {
    if (!value || typeof value === 'string') {
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item) => collectPrimaryImageRefs(item, counts));
        return;
    }

    if (typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) {
            if (
                (key === 'src' || key === 'image' || key === 'heroImage') &&
                typeof item === 'string' &&
                item.startsWith('/images/optimized/')
            ) {
                const normalized = normalizeAssetBasePath(item);
                counts.set(normalized, (counts.get(normalized) || 0) + 1);
            }
            collectPrimaryImageRefs(item, counts);
        }
    }
}

function collectSectionRefs(items, field) {
    return Array.isArray(items)
        ? items
              .map((item) =>
                  normalizeAssetBasePath(
                      item && typeof item === 'object' ? item[field] : ''
                  )
              )
              .filter(Boolean)
        : [];
}

function checkUniqueSectionImages(issues, label, items, field = 'image') {
    const refs = collectSectionRefs(items, field);
    if (refs.length !== new Set(refs).size) {
        issues.push({
            type: 'section_image_reuse',
            detail: `${label} must not repeat image refs inside the same section`,
        });
    }
}

function flattenImageRefs(value, collector) {
    if (!value) return;
    if (typeof value === 'string') {
        if (value.startsWith('/images/')) {
            if (value.includes(',')) {
                value.split(',').forEach((entry) => {
                    const src = entry.trim().split(/\s+/)[0];
                    if (src.startsWith('/images/')) {
                        collector.add(src);
                    }
                });
            } else {
                const src = value.trim().split(/\s+/)[0];
                if (src.startsWith('/images/')) {
                    collector.add(src);
                }
            }
        }
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item) => flattenImageRefs(item, collector));
        return;
    }

    if (typeof value === 'object') {
        Object.entries(value).forEach(([key, item]) => {
            if (key === 'src' || key === 'image' || key === 'heroImage') {
                flattenImageRefs(item, collector);
            }
            if (key === 'srcset' && typeof item === 'string') {
                item.split(',').forEach((entry) => {
                    const src = entry.trim().split(/\s+/)[0];
                    if (src.startsWith('/images/')) {
                        collector.add(src);
                    }
                });
            }
            flattenImageRefs(item, collector);
        });
    }
}

function existsWebAsset(webPath) {
    const local = path.join(ROOT, webPath.replace(/^\//, ''));
    return fs.existsSync(local);
}

function findRasterMaster(assetId) {
    const supported = ['.jpg', '.jpeg', '.png'];
    for (const extension of supported) {
        const candidate = path.join(
            ROOT,
            'images',
            'src',
            `${assetId}${extension}`
        );
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return '';
}

function readPath(obj, pathExpr) {
    return pathExpr.split('.').reduce((acc, key) => {
        if (acc === null || acc === undefined) return undefined;
        return acc[key];
    }, obj);
}

function requireStringField(issues, file, json, pathExpr, type) {
    const value = readPath(json, pathExpr);
    if (typeof value !== 'string' || !value.trim()) {
        issues.push({
            type,
            file,
            detail: `missing string: ${pathExpr}`,
        });
    }
}

function run() {
    const issues = [];
    const expectedSlotIds = new Set();
    const parsedFiles = new Map();

    for (const file of requiredFiles) {
        if (!fs.existsSync(path.join(ROOT, file))) {
            issues.push({ type: 'missing_file', file });
        }
    }

    if (issues.length) {
        return finalize(issues);
    }

    const manifest = readJson('content/public-v6/assets-manifest.json');
    const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
    const registry = readJson('content/public-v6/image-slot-registry.json');
    const slotRegistry = Array.isArray(registry.slots) ? registry.slots : [];
    const decisionsPayload = readJson('content/public-v6/image-decisions.json');
    const decisions = Array.isArray(decisionsPayload.decisions)
        ? decisionsPayload.decisions
        : [];
    const assetIds = new Set(assets.map((asset) => String(asset.id || '').trim()).filter(Boolean));
    const assetsById = new Map(
        assets.map((asset) => [String(asset.id || '').trim(), asset])
    );

    if (!assets.length) {
        issues.push({ type: 'empty_assets_manifest' });
    }

    assets.forEach((asset) => {
        if (!asset.id || !asset.src) {
            issues.push({ type: 'asset_schema', asset });
            return;
        }
        [
            'status',
            'sourceType',
            'orientation',
            'tone',
        ].forEach((field) => {
            if (typeof asset[field] !== 'string' || !asset[field].trim()) {
                issues.push({
                    type: 'asset_schema',
                    asset: asset.id,
                    detail: `missing string field ${field}`,
                });
            }
        });
        if (typeof asset.publicWebSafe !== 'boolean') {
            issues.push({
                type: 'asset_schema',
                asset: asset.id,
                detail: 'publicWebSafe must be boolean',
            });
        }
        if (
            !Array.isArray(asset.editorialTags) ||
            asset.editorialTags.some((item) => typeof item !== 'string' || !item.trim())
        ) {
            issues.push({
                type: 'asset_schema',
                asset: asset.id,
                detail: 'editorialTags invalid',
            });
        }
        if (
            !Array.isArray(asset.allowedSlotRoles) ||
            asset.allowedSlotRoles.some((item) => typeof item !== 'string' || !item.trim())
        ) {
            issues.push({
                type: 'asset_schema',
                asset: asset.id,
                detail: 'allowedSlotRoles invalid',
            });
        }
        if (
            !asset.localeAlt ||
            typeof asset.localeAlt !== 'object' ||
            typeof asset.localeAlt.es !== 'string' ||
            typeof asset.localeAlt.en !== 'string'
        ) {
            issues.push({
                type: 'asset_schema',
                asset: asset.id,
                detail: 'localeAlt.es/en required',
            });
        }
        if (
            !asset.generation ||
            typeof asset.generation !== 'object' ||
            typeof asset.generation.strategy !== 'string' ||
            typeof asset.generation.source !== 'string'
        ) {
            issues.push({
                type: 'asset_schema',
                asset: asset.id,
                detail: 'generation.strategy/source required',
            });
        }
        if (asset.sourceType === 'real_case' && asset.publicWebSafe !== false) {
            issues.push({
                type: 'asset_policy',
                asset: asset.id,
                detail: 'real_case assets cannot be publicWebSafe=true',
            });
        }
        if (!VALID_SOURCE_KINDS.has(asset.sourceKind)) {
            issues.push({
                type: 'asset_schema',
                asset: asset.id,
                detail: `invalid sourceKind: ${asset.sourceKind || ''}`,
            });
        }
        if (!VALID_IDENTITY_POLICIES.has(asset.identityPolicy)) {
            issues.push({
                type: 'asset_schema',
                asset: asset.id,
                detail: `invalid identityPolicy: ${asset.identityPolicy || ''}`,
            });
        }
        if (
            STAFF_REAL_REQUIRED_ASSETS.has(asset.id) &&
            asset.identityPolicy !== 'staff_real'
        ) {
            issues.push({
                type: 'identity_policy_violation',
                asset: asset.id,
                detail: 'doctor/team assets must be marked staff_real',
            });
        }
        if (
            asset.identityPolicy === 'staff_real' &&
            asset.sourceKind !== 'real_photo'
        ) {
            issues.push({
                type: 'identity_policy_violation',
                asset: asset.id,
                detail: 'staff_real assets must use sourceKind=real_photo',
            });
        }
        if (!findRasterMaster(asset.id)) {
            issues.push({
                type: 'missing_raster_master',
                asset: asset.id,
                detail: 'photo-first assets must ship a jpg/png master in images/src',
            });
        }
        if (!existsWebAsset(asset.src)) {
            issues.push({
                type: 'missing_asset_file',
                asset: asset.id,
                src: asset.src,
            });
        }
        if (asset.srcset) {
            asset.srcset.split(',').forEach((entry) => {
                const src = entry.trim().split(/\s+/)[0];
                if (src && src.startsWith('/images/') && !existsWebAsset(src)) {
                    issues.push({
                        type: 'missing_asset_file',
                        asset: asset.id,
                        src,
                    });
                }
            });
        }
    });

    if (!slotRegistry.length) {
        issues.push({ type: 'empty_slot_registry' });
    }

    const seenSlotIds = new Set();
    slotRegistry.forEach((slot) => {
        const slotId = String(slot?.slotId || '').trim();
        if (!slotId) {
            issues.push({ type: 'slot_registry_schema', detail: 'slotId missing' });
            return;
        }
        if (seenSlotIds.has(slotId)) {
            issues.push({ type: 'slot_registry_schema', detail: `duplicate slotId ${slotId}` });
        }
        seenSlotIds.add(slotId);
        [
            'surface',
            'pageKey',
            'slotRole',
            'localeMode',
        ].forEach((field) => {
            if (typeof slot[field] !== 'string' || !slot[field].trim()) {
                issues.push({
                    type: 'slot_registry_schema',
                    detail: `${slotId}: missing string ${field}`,
                });
            }
        });
        if (
            !Array.isArray(slot.allowedAssetKinds) ||
            slot.allowedAssetKinds.some((item) => typeof item !== 'string' || !item.trim())
        ) {
            issues.push({
                type: 'slot_registry_schema',
                detail: `${slotId}: allowedAssetKinds invalid`,
            });
        }
        if (
            !Array.isArray(slot.requiredTags) ||
            slot.requiredTags.some((item) => typeof item !== 'string' || !item.trim())
        ) {
            issues.push({
                type: 'slot_registry_schema',
                detail: `${slotId}: requiredTags invalid`,
            });
        }
        ['currentAssetId', 'fallbackAssetId'].forEach((field) => {
            const value = String(slot?.[field] || '').trim();
            if (value && !assetIds.has(value)) {
                issues.push({
                    type: 'slot_registry_schema',
                    detail: `${slotId}: unknown ${field} ${value}`,
                });
            }
        });
    });

    const seenDecisionSlots = new Set();
    decisions.forEach((decision) => {
        const slotId = String(decision?.slotId || '').trim();
        const assetId = String(decision?.assetId || '').trim();
        if (!slotId || !assetId) {
            issues.push({
                type: 'image_decisions_schema',
                detail: 'slotId and assetId required',
            });
            return;
        }
        if (!seenSlotIds.has(slotId)) {
            issues.push({
                type: 'image_decisions_schema',
                detail: `${slotId}: slot missing from registry`,
            });
        }
        if (!assetIds.has(assetId)) {
            issues.push({
                type: 'image_decisions_schema',
                detail: `${slotId}: asset ${assetId} missing from manifest`,
            });
        }
        if (seenDecisionSlots.has(slotId)) {
            issues.push({
                type: 'image_decisions_schema',
                detail: `${slotId}: duplicate decision`,
            });
        }
        if (!Number.isInteger(decision?.revision) || Number(decision.revision) <= 0) {
            issues.push({
                type: 'image_decisions_schema',
                detail: `${slotId}: revision must be a positive integer`,
            });
        }
        ['approvedAt', 'approvedBy'].forEach((field) => {
            if (typeof decision?.[field] !== 'string' || !decision[field].trim()) {
                issues.push({
                    type: 'image_decisions_schema',
                    detail: `${slotId}: missing ${field}`,
                });
            }
        });
        const asset = assetsById.get(assetId);
        if (asset && (asset.publicWebSafe !== true || asset.sourceType === 'real_case')) {
            issues.push({
                type: 'image_decisions_schema',
                detail: `${slotId}: asset ${assetId} is not eligible for public web publication`,
            });
        }
        seenDecisionSlots.add(slotId);
    });

    const contentFiles = requiredFiles.filter(
        (file) =>
            file.endsWith('.json') &&
            !file.endsWith('assets-manifest.json') &&
            !file.endsWith('image-slot-registry.json') &&
            !file.endsWith('image-decisions.json')
    );
    const imageRefs = new Set();
    const primaryImageRefCounts = new Map();
    contentFiles.forEach((file) => {
        const json = readJson(file);
        parsedFiles.set(file, json);
        flattenImageRefs(json, imageRefs);
        collectPrimaryImageRefs(json, primaryImageRefCounts);

        if (file.endsWith('navigation.json')) {
            if (
                !json.header ||
                !Array.isArray(json.header.links) ||
                json.header.links.length < 4
            ) {
                issues.push({
                    type: 'navigation_schema',
                    file,
                    detail: 'header.links invalid',
                });
            }
            [
                'ui.header.primaryNavAria',
                'ui.header.megaCategoryTabsAria',
                'ui.header.openCategoryLabel',
                'ui.header.mobileNavAria',
                'ui.footer.policyAria',
                'ui.pageHead.breadcrumbAria',
                'ui.pageHead.languageSwitchAria',
                'ui.pageHead.pageNavigationLabel',
                'ui.pageHead.pageNavigationTitle',
                'ui.pageHead.noSections',
                'header.contactLabel',
                'header.searchLabel',
                'header.menuLabel',
                'header.closeMenuLabel',
                'header.switchLabel',
                'header.switchHref',
                'mega.title',
                'mega.closeLabel',
                'footer.headline',
                'footer.deck',
            ].forEach((field) =>
                requireStringField(
                    issues,
                    file,
                    json,
                    field,
                    'navigation_schema'
                )
            );
        }

        if (file.endsWith('home.json')) {
            if (
                !json.hero ||
                !Array.isArray(json.hero.slides) ||
                json.hero.slides.length < 3
            ) {
                issues.push({
                    type: 'home_schema',
                    file,
                    detail: 'hero.slides must be >= 3',
                });
            }
            [
                'hero.labels.prev',
                'hero.labels.next',
                'hero.labels.pause',
                'hero.labels.play',
                'hero.labels.openRoute',
                'hero.labels.indicators',
                'newsStrip.label',
                'newsStrip.headline',
                'newsStrip.expandLabel',
                'newsStrip.localeAria',
                'editorial.ctaLabel',
                'corporateMatrix.ctaLabel',
                'bookingStatus.eyebrow',
                'bookingStatus.title',
                'bookingStatus.description',
                'bookingStatus.ctaLabel',
                'bookingStatus.ctaHref',
            ].forEach((field) =>
                requireStringField(issues, file, json, field, 'home_schema')
            );

            (Array.isArray(json.hero?.slides) ? json.hero.slides : []).forEach(
                (slide, index) => {
                    const slotId =
                        String(slide?.id || '').trim() || `s${index + 1}`;
                    expectedSlotIds.add(`home.hero.slides.${slotId}`);
                }
            );
            (Array.isArray(json.editorial?.cards) ? json.editorial.cards : []).forEach(
                (card, index) => {
                    const slotId =
                        String(card?.id || '').trim() || `card${index + 1}`;
                    expectedSlotIds.add(`home.editorial.cards.${slotId}`);
                }
            );
            (Array.isArray(json.corporateMatrix?.cards)
                ? json.corporateMatrix.cards
                : []
            ).forEach((card, index) => {
                const slotId =
                    String(card?.id || '').trim() || `card${index + 1}`;
                expectedSlotIds.add(`home.corporateMatrix.cards.${slotId}`);
            });
        }

        if (file.endsWith('hub.json')) {
            if (!Array.isArray(json.sections) || json.sections.length < 3) {
                issues.push({
                    type: 'hub_schema',
                    file,
                    detail: 'sections missing or < 3',
                });
            }
            if (
                !Array.isArray(json.initiatives) ||
                json.initiatives.length < 8
            ) {
                issues.push({
                    type: 'hub_schema',
                    file,
                    detail: 'initiatives must be >= 8',
                });
            }
            [
                'ui.menu.featured',
                'ui.menu.initiatives',
                'ui.featured.eyebrow',
                'ui.featured.title',
                'ui.sectionLabelPrefix',
                'ui.routeLabel',
                'ui.ctaLabel',
                'ui.railAria',
                'ui.initiatives.eyebrow',
                'ui.initiatives.title',
                'bookingStatus.eyebrow',
                'bookingStatus.title',
                'bookingStatus.description',
                'bookingStatus.ctaLabel',
                'bookingStatus.ctaHref',
            ].forEach((field) =>
                requireStringField(issues, file, json, field, 'hub_schema')
            );

            expectedSlotIds.add('hub.hero');
            (Array.isArray(json.featured) ? json.featured : []).forEach(
                (_card, index) => {
                    expectedSlotIds.add(`hub.featured.${index}`);
                }
            );
            (Array.isArray(json.sections) ? json.sections : []).forEach(
                (section, sectionIndex) => {
                    const sectionId =
                        String(section?.id || '').trim() ||
                        `section-${sectionIndex + 1}`;
                    (Array.isArray(section?.cards) ? section.cards : []).forEach(
                        (card, cardIndex) => {
                            const cardKey =
                                String(card?.slug || '').trim() ||
                                `card-${cardIndex + 1}`;
                            expectedSlotIds.add(
                                `hub.sections.${sectionId}.cards.${cardKey}`
                            );
                        }
                    );
                }
            );
            (Array.isArray(json.initiatives) ? json.initiatives : []).forEach(
                (_card, index) => {
                    expectedSlotIds.add(`hub.initiatives.${index}`);
                }
            );
        }

        if (file.endsWith('service.json')) {
            if (!Array.isArray(json.services) || !json.services.length) {
                issues.push({
                    type: 'service_schema',
                    file,
                    detail: 'services missing',
                });
            }
            [
                'ui.menu.glance',
                'ui.menu.checkpoints',
                'ui.menu.process',
                'ui.menu.faq',
                'ui.menu.related',
                'ui.menu.booking',
                'ui.breadcrumb.home',
                'ui.breadcrumb.hub',
                'ui.thesis.eyebrow',
                'ui.thesis.titleSuffix',
                'ui.thesis.body',
                'ui.statement.eyebrow',
                'ui.statement.titleTemplate',
                'ui.statement.signature',
                'ui.rail.title',
                'ui.rail.aria',
                'ui.glance.routeType',
                'ui.glance.checkpoints',
                'ui.glance.processStages',
                'ui.sections.checkpointsTitle',
                'ui.sections.processTitle',
                'ui.sections.faqTitle',
                'ui.sections.relatedTitle',
                'ui.faqPrefix',
                'ui.faqAnswerNote',
                'ui.relatedCta',
                'ui.bookingStatus.eyebrow',
                'ui.bookingStatus.title',
                'ui.bookingStatus.description',
                'ui.bookingStatus.ctaLabel',
                'ui.bookingStatus.ctaHref',
            ].forEach((field) =>
                requireStringField(issues, file, json, field, 'service_schema')
            );

            if (Array.isArray(json.services)) {
                json.services.forEach((service, index) => {
                    const label = `${service?.slug || `service_${index + 1}`}`;
                    const faq = Array.isArray(service?.faq) ? service.faq : [];
                    const faqAnswers = Array.isArray(service?.faqAnswers)
                        ? service.faqAnswers
                        : [];

                    if (!faq.length) {
                        issues.push({
                            type: 'service_schema',
                            file,
                            detail: `${label}: faq missing`,
                        });
                        return;
                    }

                    if (faqAnswers.length !== faq.length) {
                        issues.push({
                            type: 'service_schema',
                            file,
                            detail: `${label}: faqAnswers length (${faqAnswers.length}) must match faq length (${faq.length})`,
                        });
                    }

                    faqAnswers.forEach((answer, answerIndex) => {
                        if (typeof answer !== 'string' || !answer.trim()) {
                            issues.push({
                                type: 'service_schema',
                                file,
                                detail: `${label}: faqAnswers[${answerIndex}] must be a non-empty string`,
                            });
                        }
                    });

                    [
                        'slug',
                        'category',
                        'title',
                        'summary',
                        'heroImage',
                        'heroAlt',
                        'lead',
                    ].forEach((field) => {
                        if (
                            typeof service?.[field] !== 'string' ||
                            !service[field].trim()
                        ) {
                            issues.push({
                                type: 'service_schema',
                                file,
                                detail: `${label}: ${field} must be a non-empty string`,
                            });
                        }
                    });

                    const bullets = Array.isArray(service?.bullets)
                        ? service.bullets
                        : [];
                    const process = Array.isArray(service?.process)
                        ? service.process
                        : [];
                    const related = Array.isArray(service?.related)
                        ? service.related
                        : [];

                    if (bullets.length < 3) {
                        issues.push({
                            type: 'service_schema',
                            file,
                            detail: `${label}: bullets must contain at least 3 items`,
                        });
                    }
                    if (process.length < 3) {
                        issues.push({
                            type: 'service_schema',
                            file,
                            detail: `${label}: process must contain at least 3 items`,
                        });
                    }
                    if (!related.length) {
                        issues.push({
                            type: 'service_schema',
                            file,
                            detail: `${label}: related must contain at least 1 slug`,
                        });
                    }

                    if (typeof service?.slug === 'string' && service.slug.trim()) {
                        expectedSlotIds.add(`service.${service.slug.trim()}.hero`);
                        expectedSlotIds.add(
                            `service.${service.slug.trim()}.statement`
                        );
                    }
                });
            }
        }

        if (file.endsWith('telemedicine.json')) {
            [
                'ui.menu.initiatives',
                'ui.menu.bookingStatus',
                'ui.thesis.eyebrow',
                'ui.thesis.title',
                'ui.thesis.body',
                'ui.statement.eyebrow',
                'ui.statement.title',
                'ui.statement.signature',
                'ui.internalMessage.description',
                'ui.rail.title',
                'ui.rail.aria',
                'ui.kpis.blocks',
                'ui.kpis.criteria',
                'ui.kpis.model',
                'ui.kpis.modelValue',
                'ui.initiatives.aria',
                'ui.initiatives.ctaLabel',
                'ui.blockCtaLabel',
                'bookingStatus.eyebrow',
                'bookingStatus.title',
                'bookingStatus.description',
                'bookingStatus.ctaLabel',
                'bookingStatus.ctaHref',
            ].forEach((field) =>
                requireStringField(
                    issues,
                    file,
                    json,
                    field,
                    'telemedicine_schema'
                )
            );

            expectedSlotIds.add('telemedicine.hero');
            expectedSlotIds.add('telemedicine.statement');
            (Array.isArray(json.initiatives) ? json.initiatives : []).forEach(
                (_item, index) => {
                    expectedSlotIds.add(`telemedicine.initiatives.${index}`);
                }
            );
        }

        if (file.endsWith('legal.json')) {
            if (
                !Array.isArray(json.index) ||
                !json.pages ||
                typeof json.pages !== 'object'
            ) {
                issues.push({
                    type: 'legal_schema',
                    file,
                    detail: 'index/pages missing',
                });
            }
            [
                'ui.breadcrumb.home',
                'ui.breadcrumb.legal',
                'ui.menu.legalIndex',
                'ui.menu.clausesSummary',
                'ui.menu.policyIndex',
                'ui.thesis.eyebrow',
                'ui.thesis.title',
                'ui.thesis.body',
                'ui.statement.eyebrow',
                'ui.statement.title',
                'ui.statement.signature',
                'ui.internalMessage.description',
                'ui.sectionLabel',
                'ui.blockLabel',
                'ui.clausesLabel',
            ].forEach((field) =>
                requireStringField(issues, file, json, field, 'legal_schema')
            );

            expectedSlotIds.add('legal.statement');
            Object.keys(json.pages || {}).forEach((slug) => {
                const canonicalSlug = LEGAL_SLOT_MAP[slug] || slug;
                expectedSlotIds.add(`legal.pages.${canonicalSlug}.hero`);
                expectedSlotIds.add(`legal.indexCards.${canonicalSlug}`);
            });
        }
    });

    expectedSlotIds.forEach((slotId) => {
        if (!seenSlotIds.has(slotId)) {
            issues.push({
                type: 'slot_registry_coverage',
                detail: `missing expected slot ${slotId}`,
            });
        }
    });

    slotRegistry.forEach((slot) => {
        const slotId = String(slot?.slotId || '').trim();
        if (!slotId) {
            return;
        }

        if (!seenDecisionSlots.has(slotId)) {
            issues.push({
                type: 'image_decisions_coverage',
                detail: `${slotId}: missing approved decision`,
            });
            return;
        }

        const decision = decisions.find(
            (item) => String(item?.slotId || '').trim() === slotId
        );
        const asset = assetsById.get(String(decision?.assetId || '').trim());
        if (!asset) {
            return;
        }

        if (
            Array.isArray(slot.allowedAssetKinds) &&
            slot.allowedAssetKinds.length &&
            !slot.allowedAssetKinds.includes(String(asset.kind || '').trim())
        ) {
            issues.push({
                type: 'image_decisions_policy',
                detail: `${slotId}: asset ${asset.id} kind ${asset.kind} not allowed`,
            });
        }

        if (
            Array.isArray(asset.allowedSlotRoles) &&
            asset.allowedSlotRoles.length &&
            !asset.allowedSlotRoles.includes(String(slot.slotRole || '').trim())
        ) {
            issues.push({
                type: 'image_decisions_policy',
                detail: `${slotId}: asset ${asset.id} slot role mismatch`,
            });
        }
    });

    imageRefs.forEach((src) => {
        if (!existsWebAsset(src)) {
            issues.push({ type: 'missing_referenced_image', src });
        }
    });

    const overLimit = Array.from(primaryImageRefCounts.entries()).filter(
        ([, count]) => count > MAX_PRIMARY_IMAGE_REFS
    );
    overLimit.forEach(([src, count]) => {
        issues.push({
            type: 'primary_image_reuse_limit',
            src,
            detail: `primary image refs must stay at or below ${MAX_PRIMARY_IMAGE_REFS}; received ${count}`,
        });
    });

    ['es', 'en'].forEach((locale) => {
        const home = parsedFiles.get(`content/public-v6/${locale}/home.json`);
        const hub = parsedFiles.get(`content/public-v6/${locale}/hub.json`);
        const telemedicine = parsedFiles.get(
            `content/public-v6/${locale}/telemedicine.json`
        );

        checkUniqueSectionImages(
            issues,
            `${locale} home hero`,
            home?.hero?.slides
        );
        checkUniqueSectionImages(
            issues,
            `${locale} home editorial`,
            home?.editorial?.cards
        );
        checkUniqueSectionImages(
            issues,
            `${locale} home corporate matrix`,
            home?.corporateMatrix?.cards
        );
        checkUniqueSectionImages(
            issues,
            `${locale} hub featured`,
            hub?.featured
        );
        checkUniqueSectionImages(
            issues,
            `${locale} hub initiatives`,
            hub?.initiatives
        );
        checkUniqueSectionImages(
            issues,
            `${locale} telemedicine initiatives`,
            telemedicine?.initiatives
        );

        (Array.isArray(hub?.sections) ? hub.sections : []).forEach(
            (section) => {
                checkUniqueSectionImages(
                    issues,
                    `${locale} hub section ${section?.id || 'unknown'}`,
                    section?.cards
                );
            }
        );
    });

    finalize(issues);
}

function finalize(issues) {
    const output = {
        ok: issues.length === 0,
        issues,
    };

    const outDir = path.join(ROOT, 'verification', 'public-v6-audit');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
        path.join(outDir, 'content-validation.json'),
        `${JSON.stringify(output, null, 2)}\n`,
        'utf8'
    );

    if (issues.length) {
        console.error(JSON.stringify(output, null, 2));
        process.exit(1);
    }

    console.log(
        JSON.stringify(
            { ok: true, checkedFiles: requiredFiles.length },
            null,
            2
        )
    );
}

run();
