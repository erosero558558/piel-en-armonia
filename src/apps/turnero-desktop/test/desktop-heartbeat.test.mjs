import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildDesktopHeartbeatEndpoint,
    buildDesktopHeartbeatPayload,
    shouldRunDesktopHeartbeat,
} from '../src/runtime/desktop-heartbeat.mjs';

function createSnapshot(overrides = {}) {
    return {
        config: {
            surface: 'operator',
            baseUrl: 'https://pielarmonia.com',
            stationMode: 'locked',
            stationConsultorio: 2,
            oneTap: true,
            updateChannel: 'pilot',
            ...overrides.config,
        },
        status: {
            level: 'info',
            phase: 'settings',
            message: 'Configuracion del equipo abierta (manual).',
            ...overrides.status,
        },
        surfaceUrl:
            'https://pielarmonia.com/operador-turnos.html?station=c2&lock=1&one_tap=1',
        packaged: true,
        platform: 'win32',
        version: '0.1.0',
        name: 'Turnero Operador',
        updateFeedUrl:
            'https://pielarmonia.com/desktop-updates/pilot/operator/win/',
        updateMetadataUrl:
            'https://pielarmonia.com/desktop-updates/pilot/operator/win/latest.yml',
        installGuideUrl:
            'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1',
        configPath:
            'C:\\Users\\Operador\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json',
        firstRun: false,
        settingsMode: true,
        ...overrides,
    };
}

test('desktop heartbeat expone operador en configuracion local', () => {
    const snapshot = createSnapshot();
    assert.equal(shouldRunDesktopHeartbeat(snapshot), true);
    assert.equal(
        buildDesktopHeartbeatEndpoint(snapshot),
        'https://pielarmonia.com/api.php?resource=queue-surface-heartbeat'
    );

    const payload = buildDesktopHeartbeatPayload(snapshot, {
        reason: 'settings_open',
        now: '2026-03-11T20:00:00.000Z',
    });

    assert.ok(payload);
    assert.equal(payload.surface, 'operator');
    assert.equal(payload.instance, 'c2');
    assert.equal(payload.deviceLabel, 'Operador C2 fijo');
    assert.equal(payload.status, 'warning');
    assert.equal(payload.lastEvent, 'settings_open');
    assert.equal(payload.lastEventAt, '2026-03-11T20:00:00.000Z');
    assert.equal(payload.details.shellContext, 'boot');
    assert.equal(payload.details.shellPhase, 'settings');
    assert.equal(payload.details.numpadRequired, 4);
    assert.equal(payload.details.numpadReady, false);
    assert.equal(payload.details.station, 'c2');
    assert.equal(payload.details.oneTap, true);
    assert.equal(
        payload.details.shellUpdateMetadataUrl,
        'https://pielarmonia.com/desktop-updates/pilot/operator/win/latest.yml'
    );
    assert.equal(
        payload.details.shellInstallGuideUrl,
        'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1'
    );
    assert.match(payload.details.shellConfigPath, /turnero-desktop\.json$/i);
});

test('desktop heartbeat marca retry como alerta y deja de correr cuando operador ya esta listo', () => {
    const retrySnapshot = createSnapshot({
        settingsMode: false,
        status: {
            level: 'warn',
            phase: 'retry',
            message:
                'No se pudo abrir la superficie operator. Reintentando en 5s.',
        },
        retry: {
            active: true,
            attempt: 2,
            delayMs: 5000,
            nextRetryAt: '2026-03-11T20:00:05.000Z',
            remainingMs: 5000,
            reason: 'No se pudo abrir la superficie operator',
        },
    });

    const retryPayload = buildDesktopHeartbeatPayload(retrySnapshot, {
        reason: 'retry_loop',
    });
    assert.ok(retryPayload);
    assert.equal(retryPayload.status, 'alert');
    assert.equal(retryPayload.networkOnline, false);
    assert.match(retryPayload.summary, /Reintentando|reintentando/i);
    assert.equal(retryPayload.details.shellRetryActive, true);
    assert.equal(retryPayload.details.shellRetryAttempt, 2);
    assert.equal(retryPayload.details.shellRetryDelayMs, 5000);
    assert.equal(
        retryPayload.details.shellNextRetryAt,
        '2026-03-11T20:00:05.000Z'
    );

    const readySnapshot = createSnapshot({
        settingsMode: false,
        firstRun: false,
        status: {
            level: 'info',
            phase: 'ready',
            message: 'operator conectado correctamente.',
        },
    });
    assert.equal(shouldRunDesktopHeartbeat(readySnapshot), false);
    assert.equal(buildDesktopHeartbeatPayload(readySnapshot), null);
});

test('desktop heartbeat conserva progreso del updater cuando el shell sigue en boot local', () => {
    const updateSnapshot = createSnapshot({
        status: {
            level: 'info',
            phase: 'download',
            message: 'Descargando update 42%',
            percent: 42,
            version: '0.2.0',
        },
    });

    const payload = buildDesktopHeartbeatPayload(updateSnapshot, {
        reason: 'update_download',
    });

    assert.ok(payload);
    assert.equal(payload.status, 'warning');
    assert.equal(payload.details.shellStatusPhase, 'download');
    assert.equal(payload.details.shellStatusPercent, 42);
    assert.equal(payload.details.shellStatusVersion, '0.2.0');
    assert.equal(payload.details.shellMessage, 'Descargando update 42%');
});

test('desktop heartbeat deriva metadata de update y guia cuando el snapshot no trae urls resueltas', () => {
    const payload = buildDesktopHeartbeatPayload(
        createSnapshot({
            updateMetadataUrl: '',
            installGuideUrl: '',
        }),
        {
            reason: 'settings_open',
        }
    );

    assert.ok(payload);
    assert.equal(
        payload.details.shellUpdateMetadataUrl,
        'https://pielarmonia.com/desktop-updates/pilot/operator/win/latest.yml'
    );
    assert.equal(
        payload.details.shellInstallGuideUrl,
        'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1'
    );
});
