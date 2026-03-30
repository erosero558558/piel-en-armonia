const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function extractBetween(content, startMarker, endMarker) {
    const start = content.indexOf(startMarker);
    const end = content.indexOf(endMarker);
    if (start === -1 || end === -1 || end <= start) {
        return '';
    }
    return content.slice(start + startMarker.length, end);
}

test('booking shells expose system classes and inline error targets', () => {
    const bookingV3 = read(
        'src/apps/astro/src/components/public-v3/BookingShellV3.astro'
    );
    const bookingV5 = read(
        'src/apps/astro/src/components/public-v5/BookingShellV5.astro'
    );

    for (const content of [bookingV3, bookingV5]) {
        assert.match(content, /class="select"/);
        assert.match(content, /class="input"/);
        assert.match(content, /class="textarea"/);
        assert.match(content, /class=".*btn-primary.*"/);
        assert.match(content, /aria-describedby="[^"]*appointmentPhoneError/);
        assert.match(content, /privacyConsentError/);
    }
});

test('pre-consulta and admin forms wire aria-describedby to stable messages', () => {
    const preconsulta = read(
        'src/apps/astro/src/components/public-v6/PreConsultationPageV6.astro'
    );
    const adminLogin = read(
        'src/apps/admin-v3/ui/frame/templates/login/panel.js'
    );
    const adminSettings = read(
        'src/apps/admin-v3/ui/frame/templates/sections/settings.js'
    );
    const clinicalHistory = read(
        'src/apps/admin-v3/sections/clinical-history/render/index.js'
    );

    assert.match(preconsulta, /aria-describedby="pre-name-error"/);
    assert.match(preconsulta, /aria-describedby="pre-consent-note pre-consent-error"/);
    assert.match(adminLogin, /aria-describedby="adminLoginStatusMessage"/);
    assert.match(adminSettings, /aria-describedby="doctorProfileSaveMeta"/);
    assert.match(clinicalHistory, /class="textarea"/);
    assert.match(clinicalHistory, /class="input"/);
    assert.match(clinicalHistory, /class="select"/);
});

test('form consistency CSS scope avoids direct color hex declarations', () => {
    const sharedComponents = read('styles/components.css');
    const preconsultaCss = read(
        'src/apps/astro/src/styles/public-v6/preconsultation.css'
    );
    const v5Components = read(
        'src/apps/astro/src/styles/public-v5/components.css'
    );
    const v5Scope = extractBetween(
        v5Components,
        '/* UI2-17 form-consistency:start */',
        '/* UI2-17 form-consistency:end */'
    );
    const preconsultaScope = extractBetween(
        preconsultaCss,
        '/* UI2-17 form-consistency:start */',
        '/* UI2-17 form-consistency:end */'
    );

    assert.equal(/color\s*:\s*#/i.test(sharedComponents), false);
    assert.ok(
        preconsultaScope.length > 0,
        'expected pre-consultation form consistency scope markers'
    );
    assert.equal(/color\s*:\s*#/i.test(preconsultaScope), false);
    assert.ok(v5Scope.length > 0, 'expected V5 form consistency scope markers');
    assert.equal(/color\s*:\s*#/i.test(v5Scope), false);
});
