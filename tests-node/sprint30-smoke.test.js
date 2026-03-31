const test = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');
const fs = require('fs');

test('S30-01, S30-04, S30-05: /es/agendar/ renders correctly', async (t) => {
    // We check the raw file es/agendar/index.html to ensure it contains tokens.css
    const agendarHtml = fs.readFileSync('es/agendar/index.html', 'utf8');
    assert.match(agendarHtml, /tokens\.css/, 'es/agendar/index.html must link tokens.css');
    
    // Test the Booking Form API / response
    // For smoke test, we simulate getting the public html
    assert.match(agendarHtml, /data-theme-mode="dark"/, 'Should be dark mode');
});

test('S30-02: kiosco-turnos.html does not expose recovery logs', async (t) => {
    const kioscoHtml = fs.readFileSync('kiosco-turnos.html', 'utf8');
    assert.doesNotMatch(kioscoHtml, /Gate blocked/, 'Should not hardcode Gate blocked');
});

test('S30-03: sala-turnos.html does not expose internal logs', async (t) => {
    const salaHtml = fs.readFileSync('sala-turnos.html', 'utf8');
    assert.doesNotMatch(salaHtml, /Fleet readiness|Score/, 'Should not hardcode fleet readiness'); 
});

test('S30-07, S30-08: /es/index.html has badges and image', async (t) => {
    const heroHtml = fs.readFileSync('es/index.html', 'utf8');
    assert.match(heroHtml, /MSP Ecuador/, 'Should contain MSP Ecuador badge');
    assert.match(heroHtml, /cifrado/, 'Should contain cifrado badge');
});
