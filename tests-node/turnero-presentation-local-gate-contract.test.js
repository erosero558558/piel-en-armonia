const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readScripts() {
    return JSON.parse(read('package.json')).scripts;
}

test('turnero presentation cut usa el wrapper local con build publico, engine node y runtime root explicito', () => {
    const scripts = readScripts();
    const command = String(scripts['test:turnero:presentation-cut'] || '');

    assert.match(
        command,
        /^npm run build:public:v6 && node bin\/run-playwright-local\.js /u
    );
    assert.match(command, /--server-engine node/u);
    assert.match(command, /--runtime-root src\/apps\/astro\/dist/u);
    assert.match(command, /tests\/turnero-presentation-cut\.spec\.js/u);
});

test('turnero sony premium usa el wrapper local y evita raw playwright directo', () => {
    const scripts = readScripts();
    const command = String(scripts['test:turnero:sony-premium'] || '');

    assert.match(command, /^node bin\/run-playwright-local\.js /u);
    assert.match(command, /tests\/turnero-sony-premium-contract\.spec\.js/u);
    assert.doesNotMatch(command, /npx playwright test/u);
});

test('gate turnero presentation local compone el carril con scripts canonicos y sin raw playwright directo', () => {
    const gateScript = read('bin/gate-turnero-presentation-local.js');
    const orderedCommands = [
        'npm run build',
        'npm run test:frontend:qa:v6',
        'npm run audit:public:v6:visual-contract',
        'npm run audit:public:v6:sony-evidence',
        'npm run test:turnero:presentation-cut',
        'npm run test:turnero:sony-premium',
        'npm run test:turnero:web-pilot:ui',
    ];

    let previousIndex = -1;
    for (const command of orderedCommands) {
        const currentIndex = gateScript.indexOf(`'${command}'`);
        assert.notEqual(currentIndex, -1, `gate must include ${command}`);
        assert.ok(
            currentIndex > previousIndex,
            `gate must keep ${command} after the previous step`
        );
        previousIndex = currentIndex;
    }

    assert.doesNotMatch(
        gateScript,
        /npx playwright test tests\/turnero-presentation-cut\.spec\.js/u
    );
});
