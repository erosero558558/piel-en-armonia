'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { chmodSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(REPO_ROOT, 'ops', 'check-secrets.sh');

function encodeSecretMap(entries) {
    return (
        Object.entries(entries)
            .map(([key, value]) => `${key}=${Buffer.from(String(value), 'utf8').toString('base64')}`)
            .join('\n') + '\n'
    );
}

function createKubectlStub(t, output) {
    const dir = mkdtempSync(join(tmpdir(), 'aurora-kubectl-'));
    const stubPath = join(dir, 'kubectl');
    writeFileSync(
        stubPath,
        `#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -lt 4 ]; then
  echo "unexpected args: $*" >&2
  exit 91
fi
if [ "$1" != "get" ] || [ "$2" != "secret" ]; then
  echo "unexpected args: $*" >&2
  exit 92
fi
cat <<'EOF'
${output}EOF
`,
        'utf8'
    );
    chmodSync(stubPath, 0o755);
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

function runScript(t, output, extraArgs = []) {
    const stubDir = createKubectlStub(t, output);
    return spawnSync('bash', [SCRIPT_PATH, ...extraArgs], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: {
            ...process.env,
            PATH: `${stubDir}:${process.env.PATH || ''}`,
        },
    });
}

test('ops/check-secrets.sh passes when the live secret has materialized values', (t) => {
    const output = encodeSecretMap({
        AURORADERM_ADMIN_PASSWORD: 'CorrectHorseBatteryStaple',
        AURORADERM_STRIPE_SECRET_KEY: 'stripe_secret_materialized_value_for_contract_test',
        FIGO_CHAT_ENDPOINT: 'https://chat.aurora-derm.internal/api',
    });

    const result = runScript(t, output, ['--secret', 'pielarmonia-secret', '--namespace', 'pielarmonia']);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /OK:/);
    assert.match(result.stdout, /pielarmonia-secret/);
  });

test('ops/check-secrets.sh fails when placeholder sentinels remain in the live secret', (t) => {
    const output = encodeSecretMap({
        AURORADERM_ADMIN_PASSWORD: 'change-me',
        FIGO_AI_API_KEY: 'sk-...',
        AURORADERM_SMTP_USER: '__REPLACE_AURORADERM_SMTP_USER__',
    });

    const result = runScript(t, output);

    assert.notEqual(result.status, 0, 'el script debe fallar con placeholders');
    assert.match(result.stderr, /placeholders/i);
    assert.match(result.stderr, /AURORADERM_ADMIN_PASSWORD: sentinel change-me/);
    assert.match(result.stderr, /FIGO_AI_API_KEY: ellipsis placeholder/);
    assert.match(result.stderr, /AURORADERM_SMTP_USER: sentinel __PLACEHOLDER__/);
});
