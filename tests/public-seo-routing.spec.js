// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CANONICAL_ORIGIN = 'https://pielarmonia.com';

const SEO_CASES = [
    {
        path: '/es/',
        canonicalPath: '/es/',
        enPath: '/en/',
        esPath: '/es/',
        xDefaultPath: '/es/',
    },
    {
        path: '/en/',
        canonicalPath: '/en/',
        enPath: '/en/',
        esPath: '/es/',
        xDefaultPath: '/es/',
    },
    {
        path: '/es/servicios/',
        canonicalPath: '/es/servicios/',
        enPath: '/en/services/',
        esPath: '/es/servicios/',
        xDefaultPath: '/es/servicios/',
    },
    {
        path: '/en/services/',
        canonicalPath: '/en/services/',
        enPath: '/en/services/',
        esPath: '/es/servicios/',
        xDefaultPath: '/es/servicios/',
    },
    {
        path: '/es/telemedicina/',
        canonicalPath: '/es/telemedicina/',
        enPath: '/en/telemedicine/',
        esPath: '/es/telemedicina/',
        xDefaultPath: '/es/telemedicina/',
    },
    {
        path: '/en/telemedicine/',
        canonicalPath: '/en/telemedicine/',
        enPath: '/en/telemedicine/',
        esPath: '/es/telemedicina/',
        xDefaultPath: '/es/telemedicina/',
    },
    {
        path: '/es/servicios/acne-rosacea/',
        canonicalPath: '/es/servicios/acne-rosacea/',
        enPath: '/en/services/acne-rosacea/',
        esPath: '/es/servicios/acne-rosacea/',
        xDefaultPath: '/es/servicios/acne-rosacea/',
    },
    {
        path: '/en/services/botox/',
        canonicalPath: '/en/services/botox/',
        enPath: '/en/services/botox/',
        esPath: '/es/servicios/botox/',
        xDefaultPath: '/es/servicios/botox/',
    },
    {
        path: '/es/legal/privacidad/',
        canonicalPath: '/es/legal/privacidad/',
        enPath: '/en/legal/privacy/',
        esPath: '/es/legal/privacidad/',
        xDefaultPath: '/es/legal/privacidad/',
    },
    {
        path: '/en/legal/terms/',
        canonicalPath: '/en/legal/terms/',
        enPath: '/en/legal/terms/',
        esPath: '/es/legal/terminos/',
        xDefaultPath: '/es/legal/terminos/',
    },
];

function absolute(pathname) {
    return new URL(pathname, CANONICAL_ORIGIN).toString();
}

function walkIndexPages(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            return walkIndexPages(fullPath);
        }

        return entry.isFile() && entry.name === 'index.html' ? [fullPath] : [];
    });
}

function localizedIndexUrls() {
    return ['es', 'en'].flatMap((locale) =>
        walkIndexPages(path.join(REPO_ROOT, locale)).map((filePath) => {
            const routePath = `/${path
                .relative(REPO_ROOT, filePath)
                .replace(/\\/g, '/')
                .replace(/index\.html$/, '')}`;

            return absolute(
                routePath.endsWith('/') ? routePath : `${routePath}/`
            );
        })
    );
}

function localizedIndexPages() {
    return ['es', 'en'].flatMap((locale) =>
        walkIndexPages(path.join(REPO_ROOT, locale)).map((filePath) => ({
            filePath,
            relativePath: path
                .relative(REPO_ROOT, filePath)
                .replace(/\\/g, '/'),
        }))
    );
}

test.describe('Public SEO routing metadata', () => {
    for (const route of SEO_CASES) {
        test(`route ${route.path} publishes canonical + hreflang`, async ({
            page,
        }) => {
            await page.goto(route.path, { waitUntil: 'domcontentloaded' });

            await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
                'href',
                absolute(route.canonicalPath)
            );
            await expect(
                page.locator('link[rel="alternate"][hreflang="en"]')
            ).toHaveAttribute('href', absolute(route.enPath));
            await expect(
                page.locator('link[rel="alternate"][hreflang="es"]')
            ).toHaveAttribute('href', absolute(route.esPath));
            await expect(
                page.locator('link[rel="alternate"][hreflang="x-default"]')
            ).toHaveAttribute('href', absolute(route.xDefaultPath));
        });
    }
});

test.describe('Public SEO files', () => {
    test('sitemap only exposes new /es/* and /en/* canonical families', async () => {
        const sitemapPath = path.join(REPO_ROOT, 'sitemap.xml');
        const sitemap = fs.readFileSync(sitemapPath, 'utf8');

        for (const route of SEO_CASES) {
            expect(sitemap).toContain(absolute(route.canonicalPath));
        }

        expect(sitemap).not.toContain('https://pielarmonia.com/index.html');
        expect(sitemap).not.toContain(
            'https://pielarmonia.com/telemedicina.html'
        );
        expect(sitemap).not.toContain('/servicios/acne-rosacea.html');
    });

    test('sitemap includes every localized public index route', async () => {
        const sitemapPath = path.join(REPO_ROOT, 'sitemap.xml');
        const sitemap = fs.readFileSync(sitemapPath, 'utf8');

        for (const url of localizedIndexUrls()) {
            expect(sitemap).toContain(url);
        }
    });

    test('localized public html files expose canonical and hreflang metadata', async () => {
        for (const { filePath, relativePath } of localizedIndexPages()) {
            const html = fs.readFileSync(filePath, 'utf8');

            expect(
                /rel=["']canonical["']/i.test(html),
                `${relativePath} should publish canonical metadata`
            ).toBeTruthy();
            expect(
                /hreflang=["']en["']/i.test(html),
                `${relativePath} should publish hreflang=en`
            ).toBeTruthy();
            expect(
                /hreflang=["']es["']/i.test(html),
                `${relativePath} should publish hreflang=es`
            ).toBeTruthy();
            expect(
                /hreflang=["']x-default["']/i.test(html),
                `${relativePath} should publish hreflang=x-default`
            ).toBeTruthy();
        }
    });

    test('robots.txt keeps sitemap pointer and protects non-public surfaces', async () => {
        const robotsPath = path.join(REPO_ROOT, 'robots.txt');
        const robots = fs.readFileSync(robotsPath, 'utf8');

        expect(robots).toContain(
            'Sitemap: https://pielarmonia.com/sitemap.xml'
        );
        expect(robots).toContain('Allow: /');
        expect(robots).toContain('Disallow: /_archive/');
        expect(robots).toContain('Disallow: /api.php');
        expect(robots).toContain('Disallow: /admin.html');
        expect(robots).toContain('Disallow: /data/');
        expect(robots).toContain('Disallow: /tools/');
        expect(robots).not.toContain('Disallow: /es/');
        expect(robots).not.toContain('Disallow: /en/');
    });
});
