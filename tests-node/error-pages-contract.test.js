const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

for (const relativePath of ['404.html', '500.html']) {
    test(`${relativePath} wires the Design System shell and recovery CTAs`, () => {
        const content = read(relativePath);

        assert.match(content, /data-theme="public"/);
        assert.match(content, /href="\/styles\/tokens\.css"/);
        assert.match(content, /href="\/styles\/base\.css"/);
        assert.match(content, /href="\/styles\/components\.css"/);
        assert.match(content, /href="\/styles\/aurora-public\.css"/);
        assert.match(content, /href="\/styles\/error-pages\.css"/);
        assert.match(content, /Aurora Derm/);
        assert.match(content, /wa\.me\/593982453672/);
        assert.match(content, /href="\/es\/index\.html"/);
        assert.match(content, /href="\/es\/servicios\/index\.html"/);
    });
}

test('error pages stylesheet stays token-driven', () => {
    const css = read('styles/error-pages.css');

    assert.match(css, /var\(--color-aurora-600\)/);
    assert.match(css, /var\(--pub-border\)/);
    assert.equal(/color\s*:\s*#/i.test(css), false);
    assert.equal(/background(?:-color)?\s*:\s*#/i.test(css), false);
});
