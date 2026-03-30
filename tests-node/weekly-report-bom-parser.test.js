'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const TEMP_DIR = path.resolve(__dirname, '.tmp_bom_test');

test('weekly report and generic JSON parsers gracefully handle UTF-8 BOM', async (t) => {
    // 1. Setup temporary directory for test fixtures
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const bomJsonContext = '\uFEFF{"weeklyMode": true, "status": "ok"}';
    const fixturePath = path.resolve(TEMP_DIR, 'weekly-report-20260302.json');
    fs.writeFileSync(fixturePath, bomJsonContext, 'utf8');

    // Also inject a broken stuck list to test bin/report.js 
    const claimsPath = path.resolve(ROOT, 'data/claims');
    if (!fs.existsSync(claimsPath)) fs.mkdirSync(claimsPath, { recursive: true });
    
    // We will write a file to test `bin/report.js`
    const stubClaim = path.resolve(claimsPath, 'stuck.json');
    let originalStuck = null;
    if (fs.existsSync(stubClaim)) {
        originalStuck = fs.readFileSync(stubClaim);
    }
    fs.writeFileSync(stubClaim, '\uFEFF{"test": true}', 'utf8');

    t.after(() => {
        // Cleanup wrapper
        if (fs.existsSync(fixturePath)) fs.unlinkSync(fixturePath);
        if (fs.existsSync(TEMP_DIR)) fs.rmdirSync(TEMP_DIR);
        
        if (originalStuck !== null) {
            fs.writeFileSync(stubClaim, originalStuck);
        } else if (fs.existsSync(stubClaim)) {
            fs.unlinkSync(stubClaim);
        }
    });

    // 2. Ejecutar prod-readiness-summary
    const readinessRes = spawnSync(process.execPath, [
        path.join(ROOT, 'bin', 'prod-readiness-summary.js'),
        '--weekly-source=local',
        `--weekly-dir=${path.relative(ROOT, TEMP_DIR)}`,
        '--json'
    ], { encoding: 'utf8', cwd: ROOT });

    assert.equal(
        readinessRes.stderr.includes('SyntaxError: Unexpected token'),
        false,
        'prod-readiness-summary.js no debe morir con SyntaxError de JSON por BOM'
    );

    // 3. Ejecutar report.js
    const reportRes = spawnSync(process.execPath, [
        path.join(ROOT, 'bin', 'report.js')
    ], { encoding: 'utf8', cwd: ROOT });

    assert.equal(
        reportRes.stderr.includes('SyntaxError: Unexpected token'),
        false,
        'report.js no debe morir con SyntaxError por leer un claims/stuck.json con BOM'
    );
});
