import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const critical = require('critical');

const indexHtmlPath = 'index.html';
const stylesCssPath = 'styles.css';
const tempHtmlPath = '_temp_index.html';
const deferredCssPath = 'styles-deferred.css';

async function buildCss() {
    console.log('Starting Critical CSS generation...');

    // 1. Read index.html
    let htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

    // 2. Clean up existing critical CSS and deferred CSS references
    htmlContent = htmlContent.replace(/<style>[\s\S]*?<\/style>/gi, '');
    htmlContent = htmlContent.replace(/<link[^>]*href=["']styles-deferred\.css[^"']*["'][^>]*>/gi, '');

    // 3. Inject reference to main styles.css
    const styleLink = `<link rel="stylesheet" href="${stylesCssPath}">`;
    htmlContent = htmlContent.replace('</head>', `${styleLink}\n</head>`);

    // 4. Save to temp file
    fs.writeFileSync(tempHtmlPath, htmlContent);
    console.log(`Created temporary file ${tempHtmlPath}`);

    try {
        // 5. Run critical
        const result = await critical.generate({
            base: '.',
            src: tempHtmlPath,
            target: {
                html: indexHtmlPath,
                uncritical: deferredCssPath,
            },
            inline: true,
            extract: true,
            width: 1300,
            height: 900,
            dimensions: [
                { width: 375, height: 812 },
                { width: 1300, height: 900 }
            ],
            // Force include specific selectors for layout stability and themes
            include: [
                /^\.showcase-hero-image/,
                /^\.showcase-card-image/,
                /^\.showcase-split-image/,
                /^\.service-card-img/,
                /^\.team-image/,
                /^\.clinic-map/,
                /^\.ba-slider/,
                /html\[data-theme/, // Keep theme overrides
                /^\.pricing-container/, // Pricing fallback
                /^\.pricing-category/,
                /^\.pricing-item/,
                /^\.appointment-container/,
                /^\.appointment-form-container/,
                /^#citas/,
                /^\.section-dark/,
                /^\.form-group/,
                /^input/,
                /^select/,
                /^\.price-summary/
            ],
            ignore: {
                atrule: ['@font-face'],
            }
        });

        console.log('Critical CSS generated and inlined.');

        // 6. Post-processing
        let finalHtml = fs.readFileSync(indexHtmlPath, 'utf8');

        // Add versioning to deferred CSS
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        const versionedHref = `${deferredCssPath}?v=${timestamp}`;
        finalHtml = finalHtml.replace(new RegExp(deferredCssPath, 'g'), versionedHref);

        fs.writeFileSync(indexHtmlPath, finalHtml);
        console.log(`Updated ${indexHtmlPath} with versioned deferred CSS.`);

    } catch (err) {
        console.error('Error generating critical CSS:', err);
        process.exit(1);
    } finally {
        // 7. Cleanup
        if (fs.existsSync(tempHtmlPath)) {
            fs.unlinkSync(tempHtmlPath);
            console.log(`Removed temporary file ${tempHtmlPath}`);
        }
    }
}

buildCss();
