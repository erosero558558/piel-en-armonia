import { PurgeCSS } from 'purgecss';
import fs from 'fs/promises';
import path from 'path';

// Optional: Try to import cssnano and postcss
let cssnano;
let postcss;
try {
    const cssnanoModule = await import('cssnano');
    cssnano = cssnanoModule.default;
    const postcssModule = await import('postcss');
    postcss = postcssModule.default;
    console.log('PostCSS and CSSNano available. Minification enabled.');
} catch (e) {
    console.log('PostCSS or CSSNano not available. Minification disabled.');
}

import config from '../purgecss.config.mjs';

const filesToProcess = [
    { src: 'styles.css', dist: 'styles.min.css' },
    { src: 'styles-critical.css', dist: 'styles-critical.min.css' },
    { src: 'styles-deferred.css', dist: 'styles-deferred.min.css' }
];

async function processCss() {
    console.log('Starting CSS optimization...');

    // Config content/safelist from purgecss.config.mjs
    const purgeOptions = {
        content: config.content,
        safelist: config.safelist
    };

    for (const file of filesToProcess) {
        try {
            console.log(`Processing ${file.src}...`);

            // Check if file exists
            try {
                await fs.access(file.src);
            } catch {
                console.warn(`File ${file.src} not found. Skipping.`);
                continue;
            }

            const purge = new PurgeCSS();
            const result = await purge.purge({
                ...purgeOptions,
                css: [file.src]
            });

            if (result.length > 0) {
                let cssContent = result[0].css;

                // Minify if available
                if (postcss && cssnano) {
                    const minified = await postcss([cssnano]).process(cssContent, { from: file.src });
                    cssContent = minified.css;
                }

                await fs.writeFile(file.dist, cssContent);

                const srcStats = await fs.stat(file.src);
                const distStats = await fs.stat(file.dist);

                console.log(`Saved ${file.dist}`);
                console.log(`Size: ${(srcStats.size / 1024).toFixed(2)}kb -> ${(distStats.size / 1024).toFixed(2)}kb`);
            } else {
                console.warn(`No content generated for ${file.src}`);
            }

        } catch (error) {
            console.error(`Error processing ${file.src}:`, error);
        }
    }
    console.log('CSS optimization complete.');
}

processCss();
