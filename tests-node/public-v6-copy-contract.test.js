const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readJson(relativePath) {
    const full = path.join(ROOT, relativePath);
    return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function pick(obj, pathExpr) {
    return pathExpr.split('.').reduce((acc, key) => {
        if (acc === null || acc === undefined) return undefined;
        return acc[key];
    }, obj);
}

function assertString(obj, file, pathExpr) {
    const value = pick(obj, pathExpr);
    assert.equal(
        typeof value,
        'string',
        `${file}: ${pathExpr} must be a string`
    );
    assert.ok(value.trim(), `${file}: ${pathExpr} must not be empty`);
}

test('public-v6 copy contract: required ui labels exist in ES and EN', () => {
    const files = [
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

    const requiredByFile = {
        'navigation.json': [
            'ui.header.primaryNavAria',
            'ui.header.megaCategoryTabsAria',
            'ui.header.openCategoryLabel',
            'ui.pageHead.breadcrumbAria',
            'ui.pageHead.pageNavigationTitle',
            'ui.footer.policyAria',
        ],
        'home.json': [
            'hero.labels.prev',
            'hero.labels.next',
            'hero.labels.pause',
            'hero.labels.play',
            'newsStrip.expandLabel',
            'editorial.ctaLabel',
            'corporateMatrix.ctaLabel',
            'bookingStatus.eyebrow',
        ],
        'hub.json': [
            'ui.menu.featured',
            'ui.menu.initiatives',
            'ui.ctaLabel',
            'ui.railAria',
            'bookingStatus.eyebrow',
        ],
        'service.json': [
            'ui.menu.glance',
            'ui.menu.faq',
            'ui.breadcrumb.home',
            'ui.sections.relatedTitle',
            'ui.relatedCta',
            'ui.bookingStatus.title',
        ],
        'telemedicine.json': [
            'ui.menu.initiatives',
            'ui.kpis.blocks',
            'ui.initiatives.ctaLabel',
            'ui.blockCtaLabel',
            'bookingStatus.eyebrow',
        ],
        'legal.json': [
            'ui.breadcrumb.home',
            'ui.menu.legalIndex',
            'ui.thesis.title',
            'ui.statement.title',
            'ui.clausesLabel',
        ],
    };

    for (const file of files) {
        const json = readJson(file);
        const base = path.basename(file);
        const required = requiredByFile[base] || [];
        for (const field of required) {
            assertString(json, file, field);
        }
    }
});

test('public-v6 copy contract: anti-robot legacy phrases removed', () => {
    const files = [
        'content/public-v6/es/home.json',
        'content/public-v6/es/hub.json',
        'content/public-v6/es/service.json',
        'content/public-v6/es/telemedicine.json',
        'content/public-v6/en/home.json',
        'content/public-v6/en/hub.json',
        'content/public-v6/en/service.json',
        'content/public-v6/en/telemedicine.json',
    ];

    const blocked = [
        /protocolo,\s*evidencia\s*y\s*seguimiento/i,
        /nunca promesas vacias/i,
        /bloque corporativo/i,
        /v6 recalibration/i,
        /corporate block/i,
    ];

    for (const file of files) {
        const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
        for (const pattern of blocked) {
            assert.equal(
                pattern.test(raw),
                false,
                `${file}: unexpected legacy phrase ${pattern}`
            );
        }
    }
});
