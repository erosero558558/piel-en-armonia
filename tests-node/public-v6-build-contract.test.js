const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
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

test('build-public-v6 runner preserves canonical sequence and report output', () => {
    const runner = read(path.join('bin', 'build-public-v6.js'));

    assert.match(
        runner,
        /content:public-v6:validate/u,
        'runner must validate V6 content first'
    );
    assert.match(runner, /astro:build/u, 'runner must build Astro artifacts');
    assert.match(runner, /astro:sync/u, 'runner must sync dist artifacts to root');
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
