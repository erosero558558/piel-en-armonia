const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HTML_PAGES = [
    'index.html',
    'telemedicina.html',
    'servicios/acne.html',
    'servicios/laser.html'
];

function isLocalAssetRef(ref) {
    if (!ref) return false;
    if (ref.startsWith('http://') || ref.startsWith('https://')) return false;
    if (ref.startsWith('data:') || ref.startsWith('javascript:')) return false;
    if (ref.startsWith('#')) return false;
    return true;
}

function normalizeRefToLocalPath(baseDir, ref) {
    const cleanRef = ref.split('?')[0].split('#')[0].trim();
    if (!cleanRef) return null;
    const normalized = cleanRef.startsWith('/')
        ? cleanRef.slice(1)
        : path.join(baseDir, cleanRef);
    return path.normalize(normalized);
}

function collectHtmlAssetRefs(htmlText) {
    const refs = [];
    const regex = /<(?:script|link)\b[^>]+(?:src|href)="([^"]+)"/gi;
    let match;
    while ((match = regex.exec(htmlText)) !== null) {
        refs.push(match[1]);
    }
    return refs;
}

function collectScriptAssetRefs(scriptText) {
    const refs = [];
    const regex = /['"]\/([^'"]+\.(?:js|css)(?:\?[^'"]*)?)['"]/gi;
    let match;
    while ((match = regex.exec(scriptText)) !== null) {
        refs.push(`/${match[1]}`);
    }
    return refs;
}

function findMissingHtmlAssetsForPage(pagePath) {
    const absolutePagePath = path.join(ROOT, pagePath);
    const htmlText = fs.readFileSync(absolutePagePath, 'utf8');
    const refs = collectHtmlAssetRefs(htmlText);
    const baseDir = path.dirname(pagePath);

    return refs
        .filter((ref) => isLocalAssetRef(ref))
        .filter((ref) => /\.(js|css)(\?|#|$)/i.test(ref))
        .map((ref) => {
            const localPath = normalizeRefToLocalPath(baseDir, ref);
            return {
                ref,
                localPath,
                absoluteRefPath: localPath ? path.join(ROOT, localPath) : null
            };
        })
        .filter((item) => !item.localPath || !fs.existsSync(item.absoluteRefPath))
        .map((item) => `${pagePath} -> ${item.ref}`);
}

function findMissingScriptLocalRefs(scriptText) {
    return collectScriptAssetRefs(scriptText)
        .filter((ref) => isLocalAssetRef(ref))
        .map((ref) => {
            const localPath = normalizeRefToLocalPath('.', ref);
            return {
                ref,
                localPath,
                absoluteRefPath: localPath ? path.join(ROOT, localPath) : null
            };
        })
        .filter((item) => !item.localPath || !fs.existsSync(item.absoluteRefPath))
        .map((item) => item.ref);
}

test.describe('Asset reference integrity', () => {
    test('critical html pages only reference existing local js/css assets', () => {
        const missing = HTML_PAGES.flatMap((pagePath) =>
            findMissingHtmlAssetsForPage(pagePath)
        );

        expect(missing, `Missing referenced assets:\n${missing.join('\n')}`).toEqual([]);
    });

    test('script.js deferred/local js-css references exist on disk', () => {
        const scriptPath = path.join(ROOT, 'script.js');
        const scriptText = fs.readFileSync(scriptPath, 'utf8');
        const missing = findMissingScriptLocalRefs(scriptText);

        expect(
            missing,
            `Missing deferred/local assets from script.js:\n${missing.join('\n')}`
        ).toEqual([]);
    });
});
