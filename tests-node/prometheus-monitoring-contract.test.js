const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readRepoFile(relPath) {
    return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('docker-compose.monitoring uses Aurora Derm names and diagnostics token bootstrap', () => {
    const compose = readRepoFile('docker-compose.monitoring.yml');

    assert.match(compose, /container_name:\s*AURORADERM_prometheus/);
    assert.match(compose, /container_name:\s*AURORADERM_grafana/);
    assert.match(compose, /AURORADERM_DIAGNOSTICS_ACCESS_TOKEN/);
    assert.match(compose, /\/tmp\/prometheus_diagnostics\.token/);
    assert.doesNotMatch(compose, /pielarmonia_prometheus/);
    assert.doesNotMatch(compose, /pielarmonia_grafana/);
});

test('prometheus target scrapes Aurora Derm metrics endpoint with bearer auth', () => {
    const config = readRepoFile('prometheus.docker.yml');

    assert.match(config, /job_name:\s*'auroraderm_app'/);
    assert.match(config, /resource:\s*\['metrics'\]/);
    assert.match(config, /credentials_file:\s*\/tmp\/prometheus_diagnostics\.token/);
    assert.match(config, /targets:\s*\['host\.docker\.internal:8080'\]/);
    assert.doesNotMatch(config, /job_name:\s*'pielarmonia'/);
});

test('prometheus rules include Aurora Derm queue and api error alerts', () => {
    const rules = readRepoFile('prometheus.rules.yml');

    assert.match(rules, /record:\s*auroraderm_api_error_rate_5m/);
    assert.match(rules, /alert:\s*AuroraDermQueueBacklogHigh/);
    assert.match(rules, /max_over_time\(auroraderm_queue_size\[5m\]\)\s*>\s*20/);
    assert.match(rules, /alert:\s*AuroraDermApiErrorRateHigh/);
    assert.match(rules, /auroraderm_api_error_rate_5m\s*>\s*0\.05/);
});

test('monitoring docs explain the diagnostics token flow and alert names', () => {
    const monitoringDoc = readRepoFile(path.join('docs', 'MONITORING.md'));

    assert.match(monitoringDoc, /AURORADERM_DIAGNOSTICS_ACCESS_TOKEN/);
    assert.match(monitoringDoc, /host\.docker\.internal:8080\/api\.php\?resource=metrics/);
    assert.match(monitoringDoc, /AuroraDermQueueBacklogHigh/);
    assert.match(monitoringDoc, /AuroraDermApiErrorRateHigh/);
});
