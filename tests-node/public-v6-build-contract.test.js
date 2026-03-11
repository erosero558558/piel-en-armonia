const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function parseModuleSpecifiers(source) {
    const specifiers = [];
    const patterns = [
        /\bimport\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g,
        /\bfrom\s*(['"`])([^'"`]+)\1/g,
        /\bimport\s*(['"`])([^'"`]+)\1/g,
    ];

    for (const pattern of patterns) {
        let match = pattern.exec(source);
        while (match) {
            const value = String(match[2] || '').trim();
            if (value) {
                specifiers.push(value);
            }
            match = pattern.exec(source);
        }
    }

    return specifiers;
}

function toChunkFilename(specifier) {
    const cleanValue = String(specifier || '')
        .split('?')[0]
        .split('#')[0];
    if (!cleanValue) return '';

    if (cleanValue.includes('js/chunks/')) {
        return cleanValue.slice(cleanValue.lastIndexOf('/') + 1);
    }

    if (cleanValue.startsWith('./') && !cleanValue.slice(2).includes('/')) {
        return cleanValue.slice(2);
    }

    return '';
}

function collectReachablePublicChunks() {
    const entryPath = path.join(repoRoot, 'script.js');
    const chunksDir = path.join(repoRoot, 'js', 'chunks');
    const reachable = new Set();
    const pendingFiles = [entryPath];
    const visited = new Set();

    while (pendingFiles.length > 0) {
        const current = pendingFiles.shift();
        if (!current || visited.has(current) || !fs.existsSync(current)) {
            continue;
        }

        visited.add(current);

        const source = fs.readFileSync(current, 'utf8');
        const specifiers = parseModuleSpecifiers(source);

        for (const specifier of specifiers) {
            const chunkFilename = toChunkFilename(specifier);
            if (!chunkFilename || !chunkFilename.endsWith('.js')) {
                continue;
            }

            reachable.add(chunkFilename);

            const nextChunkPath = path.join(chunksDir, chunkFilename);
            if (fs.existsSync(nextChunkPath) && !visited.has(nextChunkPath)) {
                pendingFiles.push(nextChunkPath);
            }
        }
    }

    return reachable;
}

test('build:public:v6 uses the dedicated Node runner instead of shell chaining', () => {
    const packageJson = JSON.parse(read('package.json'));
    const buildScript = String(packageJson.scripts['build:public:v6'] || '');

    assert.equal(
        buildScript,
        'node bin/build-public-v6.js',
        'build:public:v6 must point to the dedicated runner'
    );
    assert.doesNotMatch(
        buildScript,
        /&&/u,
        'build:public:v6 must not rely on shell chaining'
    );
});

test('canonical build wires public chunk pruning after rollup', () => {
    const packageJson = JSON.parse(read('package.json'));
    const buildScript = String(packageJson.scripts.build || '');

    assert.equal(
        packageJson.scripts['chunks:public:check'],
        'node bin/clean-public-chunks.js --dry-run --strict',
        'package.json debe exponer chunks:public:check'
    );
    assert.equal(
        packageJson.scripts['chunks:public:prune'],
        'node bin/clean-public-chunks.js',
        'package.json debe exponer chunks:public:prune'
    );
    assert.match(
        buildScript,
        /rollup -c/u,
        'build debe seguir compilando los bundles publicos con rollup'
    );
    assert.match(
        buildScript,
        /npm run chunks:public:prune/u,
        'build debe podar chunks publicos huerfanos despues de rollup'
    );
    assert.match(
        buildScript,
        /npm run chunks:admin:prune/u,
        'build debe seguir podando chunks admin huerfanos'
    );
});

test('build-public-v6 runner preserves canonical sequence and report output', () => {
    const runner = read(path.join('bin', 'build-public-v6.js'));

    assert.match(
        runner,
        /content:public-v6:validate/u,
        'runner must validate V6 content first'
    );
    assert.match(runner, /astro:build/u, 'runner must build Astro artifacts');
    assert.match(
        runner,
        /astro:sync/u,
        'runner must sync dist artifacts to root'
    );
    assert.match(
        runner,
        /check:public:v6:artifacts/u,
        'runner must verify root artifacts against dist'
    );
    assert.match(
        runner,
        /build-report\.json/u,
        'runner must write a canonical build report'
    );
    assert.match(
        runner,
        /--skip-build/u,
        'runner must call artifact drift check without rebuilding twice'
    );
});

test('astro sync recreates canonical targets before copying dist contents', () => {
    const syncScript = read(path.join('src', 'apps', 'astro', 'scripts', 'sync-dist.mjs'));

    assert.match(
        syncScript,
        /ensureEmptyDirectory/u,
        'sync-dist must normalize target directories explicitly before copying'
    );
    assert.match(
        syncScript,
        /fs\.mkdirSync\(targetDir, \{ recursive: true \}\)/u,
        'sync-dist must recreate canonical targets after cleanup'
    );
    assert.match(
        syncScript,
        /for \(const entry of fs\.readdirSync\(sourceDir\)\)/u,
        'sync-dist must copy dist contents entry-by-entry'
    );
});

test('public V6 audits reuse the canonical local helper and avoid hardcoded 8000 assumptions', () => {
    const visualContract = read(
        path.join('bin', 'audit-public-v6-visual-contract.js')
    );
    const sonyEvidence = read(
        path.join('bin', 'audit-public-v6-sony-evidence.js')
    );
    const baselineCapture = read(
        path.join('bin', 'capture-public-baseline.js')
    );

    assert.match(
        visualContract,
        /public-v6-local-server/u,
        'visual contract audit must import the canonical public-v6 local helper'
    );
    assert.match(
        visualContract,
        /startLocalPublicServer/u,
        'visual contract audit must start the canonical local V6 server helper'
    );
    assert.match(
        visualContract,
        /parseArg\('--base-url'/u,
        'visual contract audit must support explicit --base-url overrides'
    );
    assert.doesNotMatch(
        visualContract,
        /127\.0\.0\.1:8000|http\.server 8000/u,
        'visual contract audit must not hardcode localhost:8000 anymore'
    );
    assert.doesNotMatch(
        sonyEvidence,
        /127\.0\.0\.1:8000/u,
        'sony evidence audit must not keep a stale localhost:8000 default'
    );
    assert.match(
        sonyEvidence,
        /parseArg\('--base-url'/u,
        'sony evidence audit must support explicit --base-url overrides'
    );
    assert.match(
        sonyEvidence,
        /contract_base_url/u,
        'sony evidence audit must persist the contract runtime base URL'
    );
    assert.match(
        baselineCapture,
        /public-v6-local-server/u,
        'baseline capture must import the canonical public-v6 local helper'
    );
    assert.match(
        baselineCapture,
        /startLocalPublicServer/u,
        'baseline capture must start the canonical local V6 server helper'
    );
    assert.match(
        baselineCapture,
        /runtimeSource/u,
        'baseline capture manifest must persist runtime source metadata'
    );
    assert.doesNotMatch(
        baselineCapture,
        /127\.0\.0\.1:8092|php -S/u,
        'baseline capture must not keep a bespoke fixed-port PHP server'
    );
});

test('script.js deja solo chunks publicos alcanzables y un shell activo', () => {
    const chunksDir = path.join(repoRoot, 'js', 'chunks');
    const allChunks = fs
        .readdirSync(chunksDir)
        .filter((entry) => entry.endsWith('.js'))
        .sort();
    const reachable = Array.from(collectReachablePublicChunks()).sort();
    const stale = allChunks.filter((entry) => !reachable.includes(entry));
    const activeShells = reachable.filter((entry) => entry.startsWith('shell-'));

    assert.deepEqual(
        stale,
        [],
        `js/chunks no debe conservar chunks huerfanos: ${stale.join(', ')}`
    );
    assert.equal(
        activeShells.length,
        1,
        'script.js debe dejar exactamente un shell chunk activo'
    );
    assert.match(
        read('script.js'),
        new RegExp(activeShells[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'),
        'script.js debe apuntar al shell chunk activo'
    );
});
