import { generate } from 'critical';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const indexHtmlPath = path.join(rootDir, 'index.html');
const stylesCssPath = 'styles.css'; // Relative to root
const tempHtmlPath = path.join(rootDir, '_temp_index.html');
const deferredCssPath = 'styles-deferred.css'; // Relative to root

// FIXED VERSION for consistency across build and tests
const CSS_VERSION = 'ui-20260223-critical-css';

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
        const result = await generate({
            base: rootDir,
            src: '_temp_index.html', // Relative to base
            target: {
                html: 'index.html',
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
            include: [
                /^\.showcase-hero-image/,
                /^\.showcase-card-image/,
                /^\.showcase-split-image/,
                /^\.service-card-img/,
                /^\.team-image/,
                /^\.clinic-map/,
                /^\.ba-slider/,
                /html\[data-theme/,
                /^\.pricing-container/,
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

        // 6. Post-processing: Update index.html with versioned deferred CSS
        updateDeferredCssVersion(indexHtmlPath, deferredCssPath, CSS_VERSION);

        // 7. Update other HTML files
        const otherFiles = [
            'telemedicina.html',
            'admin.html',
            'servicios/acne.html',
            'servicios/cancer.html',
            'servicios/consulta.html',
            'servicios/laser.html',
            'servicios/rejuvenecimiento.html',
            'servicios/telemedicina.html'
        ];

        for (const file of otherFiles) {
            const filePath = path.join(rootDir, file);
            if (fs.existsSync(filePath)) {
                updateDeferredCssVersion(filePath, deferredCssPath, CSS_VERSION);
            } else {
                console.warn(`Warning: File ${file} not found.`);
            }
        }

    } catch (err) {
        console.error('Error generating critical CSS:', err);
        process.exit(1);
    } finally {
        // 8. Cleanup
        if (fs.existsSync(tempHtmlPath)) {
            fs.unlinkSync(tempHtmlPath);
            console.log(`Removed temporary file ${tempHtmlPath}`);
        }
    }
}

function updateDeferredCssVersion(filePath, cssFileName, version) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Regex to match existing deferred CSS link: styles-deferred.css?v=... or just styles-deferred.css
    // We want to replace the whole href value
    const regex = new RegExp(`${cssFileName}(\\?v=[^"']*)?`, 'g');
    const versionedHref = `${cssFileName}?v=${version}`;

    // Check if the file actually contains the link
    if (content.match(regex)) {
        content = content.replace(regex, versionedHref);
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${filePath} with ${versionedHref}`);
    } else {
        // If not found (e.g. subpages might refer to ../styles-deferred.css)
        const relativeRegex = new RegExp(`(styles-deferred\\.css)(\\?v=[^"']*)?`, 'g');
        if (content.match(relativeRegex)) {
             content = content.replace(relativeRegex, `$1?v=${version}`);
             fs.writeFileSync(filePath, content);
             console.log(`Updated ${filePath} (relative match) with ?v=${version}`);
        } else {
             console.log(`No deferred CSS link found in ${filePath}`);
        }
    }
}

buildCss();
