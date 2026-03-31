// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CANONICAL_ORIGIN = 'https://pielarmonia.com';
const GA4_MEASUREMENT_ID = 'G-2DWZ5PJ4MC';
const LEGAL_SLUG_MAP_ES_TO_EN = {
    terminos: 'terms',
    privacidad: 'privacy',
    cookies: 'cookies',
    'aviso-medico': 'medical-disclaimer',
};
const LEGAL_SLUG_MAP_EN_TO_ES = {
    terms: 'terminos',
    privacy: 'privacidad',
    cookies: 'cookies',
    'medical-disclaimer': 'aviso-medico',
};
const SOFTWARE_ROUTE_MAP = {
    es: {
        landing: '/es/software/turnero-clinicas/',
        apiDocs: '/es/software/turnero-clinicas/api-docs/',
        demo: '/es/software/turnero-clinicas/demo/',
        status: '/es/software/turnero-clinicas/estado-turno/',
        dashboard: '/es/software/turnero-clinicas/dashboard/',
    },
    en: {
        landing: '/en/software/clinic-flow-suite/',
        apiDocs: '/en/software/clinic-flow-suite/api-docs/',
        demo: '/en/software/clinic-flow-suite/demo/',
        status: '/en/software/clinic-flow-suite/queue-status/',
        dashboard: '/en/software/clinic-flow-suite/dashboard/',
    },
};

const SEO_CASES = [
    {
        path: '/es/',
        canonicalPath: '/es/',
        currentLocale: 'es',
        currentLocalePath: '/es/',
        otherLocale: 'en',
        otherLocalePath: '/en/',
        xDefaultPath: '/es/',
    },
    {
        path: '/en/',
        canonicalPath: '/en/',
        currentLocale: 'en',
        currentLocalePath: '/en/',
        otherLocale: 'es',
        otherLocalePath: '/es/',
        xDefaultPath: '/es/',
    },
    {
        path: '/es/servicios/',
        canonicalPath: '/es/servicios/',
        currentLocale: 'es',
        currentLocalePath: '/es/servicios/',
        otherLocale: 'en',
        otherLocalePath: '/en/services/',
        xDefaultPath: '/es/servicios/',
    },
    {
        path: '/en/services/',
        canonicalPath: '/en/services/',
        currentLocale: 'en',
        currentLocalePath: '/en/services/',
        otherLocale: 'es',
        otherLocalePath: '/es/servicios/',
        xDefaultPath: '/es/servicios/',
    },
    {
        path: '/es/telemedicina/',
        canonicalPath: '/es/telemedicina/',
        currentLocale: 'es',
        currentLocalePath: '/es/telemedicina/',
        otherLocale: 'en',
        otherLocalePath: '/en/telemedicine/',
        xDefaultPath: '/es/telemedicina/',
    },
    {
        path: '/es/telemedicina/consulta/',
        canonicalPath: '/es/telemedicina/consulta/',
        currentLocale: 'es',
        currentLocalePath: '/es/telemedicina/consulta/',
        otherLocale: 'en',
        otherLocalePath: null,
        xDefaultPath: '/es/telemedicina/consulta/',
    },
    {
        path: '/es/telemedicina/pre-consulta/',
        canonicalPath: '/es/telemedicina/pre-consulta/',
        currentLocale: 'es',
        currentLocalePath: '/es/telemedicina/pre-consulta/',
        otherLocale: 'en',
        otherLocalePath: null,
        xDefaultPath: '/es/telemedicina/pre-consulta/',
    },
    {
        path: '/en/telemedicine/',
        canonicalPath: '/en/telemedicine/',
        currentLocale: 'en',
        currentLocalePath: '/en/telemedicine/',
        otherLocale: 'es',
        otherLocalePath: '/es/telemedicina/',
        xDefaultPath: '/es/telemedicina/',
    },
    {
        path: '/es/software/turnero-clinicas/api-docs/',
        canonicalPath: '/es/software/turnero-clinicas/api-docs/',
        currentLocale: 'es',
        currentLocalePath: '/es/software/turnero-clinicas/api-docs/',
        otherLocale: 'en',
        otherLocalePath: '/en/software/clinic-flow-suite/api-docs/',
        xDefaultPath: '/es/software/turnero-clinicas/api-docs/',
    },
    {
        path: '/en/software/clinic-flow-suite/api-docs/',
        canonicalPath: '/en/software/clinic-flow-suite/api-docs/',
        currentLocale: 'en',
        currentLocalePath: '/en/software/clinic-flow-suite/api-docs/',
        otherLocale: 'es',
        otherLocalePath: '/es/software/turnero-clinicas/api-docs/',
        xDefaultPath: '/es/software/turnero-clinicas/api-docs/',
    },
    {
        path: '/es/servicios/acne-rosacea/',
        canonicalPath: '/es/servicios/acne-rosacea/',
        currentLocale: 'es',
        currentLocalePath: '/es/servicios/acne-rosacea/',
        otherLocale: 'en',
        otherLocalePath: '/en/services/acne-rosacea/',
        xDefaultPath: '/es/servicios/acne-rosacea/',
    },
    {
        path: '/en/services/botox/',
        canonicalPath: '/en/services/botox/',
        currentLocale: 'en',
        currentLocalePath: '/en/services/botox/',
        otherLocale: 'es',
        otherLocalePath: '/es/servicios/botox/',
        xDefaultPath: '/es/servicios/botox/',
    },
    {
        path: '/en/services/depilacion-laser/',
        canonicalPath: '/en/services/depilacion-laser/',
        currentLocale: 'en',
        currentLocalePath: '/en/services/depilacion-laser/',
        otherLocale: 'es',
        otherLocalePath: '/es/servicios/depilacion-laser/',
        xDefaultPath: '/es/servicios/depilacion-laser/',
    },
    {
        path: '/es/legal/privacidad/',
        canonicalPath: '/es/legal/privacidad/',
        currentLocale: 'es',
        currentLocalePath: '/es/legal/privacidad/',
        otherLocale: 'en',
        otherLocalePath: '/en/legal/privacy/',
        xDefaultPath: '/es/legal/privacidad/',
    },
    {
        path: '/en/legal/terms/',
        canonicalPath: '/en/legal/terms/',
        currentLocale: 'en',
        currentLocalePath: '/en/legal/terms/',
        otherLocale: 'es',
        otherLocalePath: '/es/legal/terminos/',
        xDefaultPath: '/es/legal/terminos/',
    },
    {
        path: '/es/blog/',
        canonicalPath: '/es/blog/',
        currentLocale: 'es',
        currentLocalePath: '/es/blog/',
        otherLocale: 'en',
        otherLocalePath: null,
        xDefaultPath: '/es/blog/',
    },
    {
        path: '/es/pre-consulta/',
        canonicalPath: '/es/pre-consulta/',
        currentLocale: 'es',
        currentLocalePath: '/es/pre-consulta/',
        otherLocale: 'en',
        otherLocalePath: null,
        xDefaultPath: '/es/pre-consulta/',
    },
    {
        path: '/es/pago/',
        canonicalPath: '/es/pago/',
        currentLocale: 'es',
        currentLocalePath: '/es/pago/',
        otherLocale: 'en',
        otherLocalePath: null,
        xDefaultPath: '/es/pago/',
    },
    {
        path: '/es/blog/como-elegir-dermatologo-quito/',
        canonicalPath: '/es/blog/como-elegir-dermatologo-quito/',
        currentLocale: 'es',
        currentLocalePath: '/es/blog/como-elegir-dermatologo-quito/',
        otherLocale: 'en',
        otherLocalePath: null,
        xDefaultPath: '/es/blog/como-elegir-dermatologo-quito/',
    },
    {
        path: '/es/blog/senales-alarma-lunares/',
        canonicalPath: '/es/blog/senales-alarma-lunares/',
        currentLocale: 'es',
        currentLocalePath: '/es/blog/senales-alarma-lunares/',
        otherLocale: 'en',
        otherLocalePath: null,
        xDefaultPath: '/es/blog/senales-alarma-lunares/',
    },
    {
        path: '/es/blog/proteccion-solar-ecuador/',
        canonicalPath: '/es/blog/proteccion-solar-ecuador/',
        currentLocale: 'es',
        currentLocalePath: '/es/blog/proteccion-solar-ecuador/',
        otherLocale: 'en',
        otherLocalePath: null,
        xDefaultPath: '/es/blog/proteccion-solar-ecuador/',
    },
    {
        path: '/es/blog/acne-adulto/',
        canonicalPath: '/es/blog/acne-adulto/',
        currentLocale: 'es',
        currentLocalePath: '/es/blog/acne-adulto/',
        otherLocale: 'en',
        otherLocalePath: null,
        xDefaultPath: '/es/blog/acne-adulto/',
    },
    {
        path: '/es/blog/melasma-embarazo/',
        canonicalPath: '/es/blog/melasma-embarazo/',
        currentLocale: 'es',
        currentLocalePath: '/es/blog/melasma-embarazo/',
        otherLocale: 'en',
        otherLocalePath: null,
        xDefaultPath: '/es/blog/melasma-embarazo/',
    },
    {
        path: '/es/blog/bioestimuladores-vs-rellenos/',
        canonicalPath: '/es/blog/bioestimuladores-vs-rellenos/',
        currentLocale: 'es',
        currentLocalePath: '/es/blog/bioestimuladores-vs-rellenos/',
        otherLocale: 'en',
        otherLocalePath: null,
        xDefaultPath: '/es/blog/bioestimuladores-vs-rellenos/',
    },
];

function absolute(pathname) {
    return new URL(pathname, CANONICAL_ORIGIN).toString();
}

function normalizeRoute(pathname) {
    const raw = String(pathname || '').trim() || '/';
    const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
    return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

function routeToRelativeIndexFile(pathname) {
    return `${normalizeRoute(pathname).replace(/^\//, '')}index.html`;
}

function relativeIndexFileToRoute(relativePath) {
    const routePath = `/${String(relativePath)
        .replace(/\\/g, '/')
        .replace(/index\.html$/, '')}`;
    return normalizeRoute(routePath);
}

function mapLegalSwitch(pathname, locale) {
    const parts = normalizeRoute(pathname).split('/').filter(Boolean);
    if (parts.length < 3 || parts[1] !== 'legal') {
        return null;
    }

    const slug = parts[2];
    if (locale === 'es') {
        const mapped = LEGAL_SLUG_MAP_ES_TO_EN[slug];
        return mapped ? `/en/legal/${mapped}/` : null;
    }

    const mapped = LEGAL_SLUG_MAP_EN_TO_ES[slug];
    return mapped ? `/es/legal/${mapped}/` : null;
}

function mapPublicSectionSwitch(pathname, locale) {
    const safePath = normalizeRoute(pathname);

    if (locale === 'es') {
        if (safePath === '/es/servicios/') {
            return '/en/services/';
        }
        if (safePath.startsWith('/es/servicios/')) {
            return `/en/services/${safePath.slice('/es/servicios/'.length)}`;
        }
        if (safePath === '/es/telemedicina/') {
            return '/en/telemedicine/';
        }
        if (safePath.startsWith('/es/telemedicina/')) {
            return `/en/telemedicine/${safePath.slice('/es/telemedicina/'.length)}`;
        }
        return null;
    }

    if (safePath === '/en/services/') {
        return '/es/servicios/';
    }
    if (safePath.startsWith('/en/services/')) {
        return `/es/servicios/${safePath.slice('/en/services/'.length)}`;
    }
    if (safePath === '/en/telemedicine/') {
        return '/es/telemedicina/';
    }
    if (safePath.startsWith('/en/telemedicine/')) {
        return `/es/telemedicina/${safePath.slice('/en/telemedicine/'.length)}`;
    }
    return null;
}

function mapSoftwareSwitch(pathname, locale) {
    const safePath = normalizeRoute(pathname);
    const sourceMap = SOFTWARE_ROUTE_MAP[locale];
    const targetMap = SOFTWARE_ROUTE_MAP[locale === 'es' ? 'en' : 'es'];
    const match = Object.entries(sourceMap).find(
        ([, route]) => route === safePath
    );
    return match ? targetMap[match[0]] || null : null;
}

function counterpartRoutePath(pathname) {
    const safePath = normalizeRoute(pathname);
    const locale = safePath.startsWith('/en/') ? 'en' : 'es';

    const legalSwitch = mapLegalSwitch(safePath, locale);
    if (legalSwitch) {
        return legalSwitch;
    }

    const sectionSwitch = mapPublicSectionSwitch(safePath, locale);
    if (sectionSwitch) {
        return sectionSwitch;
    }

    const softwareSwitch = mapSoftwareSwitch(safePath, locale);
    if (softwareSwitch) {
        return softwareSwitch;
    }

    if (locale === 'es') {
        return safePath.startsWith('/es/')
            ? `/en/${safePath.slice(4)}`
            : '/en/';
    }

    return safePath.startsWith('/en/') ? `/es/${safePath.slice(4)}` : '/es/';
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

function spanishServiceDetailPages() {
    return walkIndexPages(path.join(REPO_ROOT, 'es', 'servicios'))
        .map((filePath) => ({
            filePath,
            relativePath: path
                .relative(REPO_ROOT, filePath)
                .replace(/\\/g, '/'),
        }))
        .filter(
            ({ relativePath }) => relativePath !== 'es/servicios/index.html'
        );
}

function publicAnalyticsPages() {
    return [
        {
            filePath: path.join(REPO_ROOT, 'index.html'),
            relativePath: 'index.html',
        },
        ...localizedIndexPages(),
    ];
}

function normalizeHtmlEntities(value) {
    return String(value || '')
        .replace(/&iacute;/gi, 'í')
        .replace(/&#237;/g, 'í');
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
                page.locator(
                    `link[rel="alternate"][hreflang="${route.currentLocale}"]`
                )
            ).toHaveAttribute('href', absolute(route.currentLocalePath));
            if (route.otherLocalePath) {
                await expect(
                    page.locator(
                        `link[rel="alternate"][hreflang="${route.otherLocale}"]`
                    )
                ).toHaveAttribute('href', absolute(route.otherLocalePath));
            } else {
                await expect(
                    page.locator(
                        `link[rel="alternate"][hreflang="${route.otherLocale}"]`
                    )
                ).toHaveCount(0);
            }
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
            const routePath = relativeIndexFileToRoute(relativePath);
            const currentLocale = routePath.startsWith('/en/') ? 'en' : 'es';
            const otherLocale = currentLocale === 'es' ? 'en' : 'es';
            const counterpartPath = counterpartRoutePath(routePath);
            const counterpartExists = fs.existsSync(
                path.join(REPO_ROOT, routeToRelativeIndexFile(counterpartPath))
            );

            expect(
                /rel=["']canonical["']/i.test(html),
                `${relativePath} should publish canonical metadata`
            ).toBeTruthy();
            expect(
                new RegExp(`hreflang=["']${currentLocale}["']`, 'i').test(html),
                `${relativePath} should publish hreflang=${currentLocale}`
            ).toBeTruthy();
            expect(
                /hreflang=["']x-default["']/i.test(html),
                `${relativePath} should publish hreflang=x-default`
            ).toBeTruthy();
            if (counterpartExists) {
                expect(
                    new RegExp(`hreflang=["']${otherLocale}["']`, 'i').test(
                        html
                    ),
                    `${relativePath} should publish hreflang=${otherLocale}`
                ).toBeTruthy();
            }
        }
    });

    test('English service detail pages mirror the Spanish service set except non-page aliases', async () => {
        const toSlug = (relativePath) =>
            relativePath.split('/').slice(-2, -1).join('');
        const esSlugs = spanishServiceDetailPages()
            .map(({ relativePath }) => toSlug(relativePath))
            .sort();
        const enSlugs = walkIndexPages(path.join(REPO_ROOT, 'en', 'services'))
            .map((filePath) =>
                path.relative(REPO_ROOT, filePath).replace(/\\/g, '/')
            )
            .filter((relativePath) => relativePath !== 'en/services/index.html')
            .map((relativePath) => toSlug(relativePath))
            .sort();

        expect(enSlugs).toEqual(esSlugs);
        expect(enSlugs).not.toContain('bioestimuladores');
    });

    test('blog feed publishes RSS with every live article', async () => {
        const feedPath = path.join(REPO_ROOT, 'es', 'blog', 'feed.xml');
        const feed = fs.readFileSync(feedPath, 'utf8');
        const expectedUrls = [
            '/es/blog/bioestimuladores-vs-rellenos/',
            '/es/blog/melasma-embarazo/',
            '/es/blog/acne-adulto/',
            '/es/blog/proteccion-solar-ecuador/',
            '/es/blog/senales-alarma-lunares/',
            '/es/blog/como-elegir-dermatologo-quito/',
        ].map(absolute);

        expect(feed).toContain('<rss version="2.0"');
        expect(feed).toContain('<title>Aurora Derm Blog</title>');
        expect(feed).toContain('<link>https://pielarmonia.com/es/blog/</link>');
        expect(feed).toContain(
            '<atom:link href="https://pielarmonia.com/es/blog/feed.xml" rel="self" type="application/rss+xml" />'
        );
        expect(feed.match(/<item>/g) || []).toHaveLength(expectedUrls.length);

        for (const url of expectedUrls) {
            expect(feed).toContain(url);
        }
    });

    test('all Spanish service detail pages publish the standard medical results disclaimer', async () => {
        const disclaimer =
            'Los resultados varían. Consulte a nuestro especialista.';

        for (const { filePath, relativePath } of spanishServiceDetailPages()) {
            const html = normalizeHtmlEntities(
                fs.readFileSync(filePath, 'utf8')
            );
            expect(
                html.includes(disclaimer),
                `${relativePath} should include the standard results disclaimer`
            ).toBeTruthy();
        }
    });

    test('public home and localized pages delegate GA4 bootstrap to the consent shell', async () => {
        for (const { filePath, relativePath } of publicAnalyticsPages()) {
            const html = fs.readFileSync(filePath, 'utf8');

            expect(
                /\/js\/public-v6-shell\.js\?v=public-v6-shell-20260315-r3/.test(
                    html
                ),
                `${relativePath} should load the consent-managed public shell`
            ).toBeTruthy();
            expect(
                new RegExp(
                    `googletagmanager\\.com/gtag/js\\?id=${GA4_MEASUREMENT_ID}`
                ).test(html),
                `${relativePath} should not load the GA4 gtag.js bootstrap inline`
            ).toBeFalsy();
            expect(
                /window\.dataLayer\s*=\s*window\.dataLayer\s*\|\|\s*\[\]/.test(
                    html
                ),
                `${relativePath} should not initialize dataLayer inline`
            ).toBeFalsy();
            expect(/gtag\(['"]config['"]/.test(html)).toBeFalsy();
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
        expect(robots).toContain('Disallow: /lib/');
        expect(robots).toContain('Disallow: /templates/');
        expect(robots).toContain('Disallow: /backup/');
        expect(robots).toContain('Disallow: /bin/');
        expect(robots).toContain('Disallow: /store/');
        expect(robots).not.toContain('Disallow: /es/');
        expect(robots).not.toContain('Disallow: /en/');
    });
});
