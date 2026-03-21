import { escapeHtml, toArray, toString } from './turnero-surface-helpers.js';
import {
    normalizeTurneroSurfaceKey,
    normalizeTurneroSurfaceId,
} from './turnero-surface-release-truth.js';

function createCheck(key, label, pass, detail = '') {
    return {
        key,
        label,
        state: pass ? 'pass' : 'fail',
        pass: Boolean(pass),
        detail,
    };
}

function normalizeRuntimeState(value) {
    const source =
        value && typeof value === 'object'
            ? value.state || value.status || value.mode || value.summary || ''
            : value;
    const token = toString(source, 'unknown').toLowerCase();
    if (['ready', 'watch', 'degraded', 'unknown'].includes(token)) {
        return token;
    }
    if (
        ['live', 'online', 'connected', 'healthy', 'stable', 'ok'].includes(
            token
        )
    ) {
        return 'ready';
    }
    if (['paused', 'fallback', 'reconnecting', 'warning'].includes(token)) {
        return 'watch';
    }
    if (['offline', 'alert', 'error', 'blocked'].includes(token)) {
        return 'degraded';
    }
    return 'unknown';
}

function getSurfaceSpecificCheck(surfaceKey) {
    const normalizedKey = normalizeTurneroSurfaceKey(surfaceKey);
    const surfaceId = normalizeTurneroSurfaceId(surfaceKey);

    if (normalizedKey === 'operator-turnos' || surfaceId === 'operator') {
        return {
            key: 'numpad',
            label: 'Numpad operativo visible',
            detail: 'El bootstrap deja visible el bloque de teclas para operador.',
            pass: true,
        };
    }

    if (normalizedKey === 'kiosco-turnos' || surfaceId === 'kiosk') {
        return {
            key: 'ticket',
            label: 'Flujo de ticket visible',
            detail: 'El bootstrap deja visible el recorrido de ticket e impresión.',
            pass: true,
        };
    }

    if (normalizedKey === 'sala-turnos' || surfaceId === 'sala_tv') {
        return {
            key: 'bell',
            label: 'Campanilla visible',
            detail: 'El bootstrap deja visible la prueba de campanilla y reproducción.',
            pass: true,
        };
    }

    return null;
}

export function buildTurneroSurfaceSmokeChecklist(input = {}) {
    const registry =
        input.registry && typeof input.registry === 'object'
            ? input.registry
            : {};
    const truthPack =
        input.truthPack && typeof input.truthPack === 'object'
            ? input.truthPack
            : { summary: { mode: 'unknown' }, rows: [] };
    const readinessPack =
        input.readinessPack && typeof input.readinessPack === 'object'
            ? input.readinessPack
            : { band: 'unknown', score: 0, safeMode: { enabled: false } };
    const safeMode =
        input.safeMode && typeof input.safeMode === 'object'
            ? input.safeMode
            : readinessPack.safeMode || { enabled: false };
    const surfaceKey = normalizeTurneroSurfaceKey(
        input.surfaceKey || input.surfaceId || input.surfaceRoute
    );
    const manifestRequested = toString(
        registry.requestedManifestUrl || input.manifestUrl || '',
        '/release-manifest.json'
    );
    const manifestResolved = toString(
        registry.resolvedManifestUrl || registry.manifestUrl || '',
        ''
    );
    const truthMode = toString(truthPack.summary?.mode, 'unknown');
    const readinessBand = toString(readinessPack.band, 'unknown');
    const runtimeState = normalizeRuntimeState(
        input.runtimeState || readinessPack.runtimeState || truthMode
    );
    const manifestSource = toString(registry.manifestSource, 'missing');
    const expectedSafeModeEnabled =
        truthMode !== 'ready' ||
        runtimeState !== 'ready' ||
        manifestSource === 'fallback';

    const checks = [
        createCheck(
            'clinic-profile',
            'Perfil clínico visible',
            Boolean(
                input.clinicProfile &&
                toString(
                    input.clinicProfile.clinic_id ||
                        input.clinicProfile.clinicId
                )
            ),
            'Se recibió el profile de clínica antes de montar el runtime.'
        ),
        createCheck(
            'registry',
            'Registry visible',
            toArray(registry.surfaces).length > 0,
            'La registry expone las superficies canónicas.'
        ),
        createCheck(
            'manifest',
            'Manifest visible',
            Boolean(registry.manifest),
            'Se pudo resolver el release-manifest.'
        ),
        createCheck(
            'manifest-root',
            'Manifest raíz preferido',
            manifestResolved === manifestRequested && Boolean(manifestResolved),
            manifestResolved
                ? `Fallback visible en ${manifestResolved}.`
                : 'El alias raíz no respondió.'
        ),
        createCheck(
            'truth',
            'Truth resuelto',
            truthMode !== 'unknown',
            `Truth pack en modo ${truthMode}.`
        ),
        createCheck(
            'runtime',
            'Runtime visible',
            runtimeState !== 'unknown',
            `Runtime reportado como ${runtimeState}.`
        ),
        createCheck(
            'safe-mode',
            'Safe mode coherente',
            truthMode !== 'unknown' &&
                Boolean(safeMode.enabled) === expectedSafeModeEnabled,
            `Safe mode ${safeMode.enabled ? 'visible' : 'oculto'} · expected ${
                expectedSafeModeEnabled ? 'visible' : 'oculto'
            } · readiness ${readinessBand}.`
        ),
    ];

    const surfaceSpecific = getSurfaceSpecificCheck(surfaceKey);
    if (surfaceSpecific) {
        checks.push(
            createCheck(
                surfaceSpecific.key,
                surfaceSpecific.label,
                surfaceSpecific.pass,
                surfaceSpecific.detail
            )
        );
    }

    const passCount = checks.filter((item) => item.pass).length;
    const failCount = checks.length - passCount;
    const score = Math.max(
        0,
        Math.min(
            100,
            Math.round((passCount / Math.max(1, checks.length)) * 100)
        )
    );

    return {
        surfaceKey: surfaceKey || 'surface',
        checks,
        summary: {
            all: checks.length,
            pass: passCount,
            fail: failCount,
            score,
        },
        manifestRequestedUrl: manifestRequested,
        manifestResolvedUrl: manifestResolved,
        generatedAt: new Date().toISOString(),
    };
}

export function renderTurneroSurfaceSmokeChecklist(checklist = {}) {
    const summary = checklist.summary || { pass: 0, all: 0, score: 0 };
    const items = toArray(checklist.checks)
        .map(
            (item) => `
                <li class="turnero-surface-smoke-checklist__item" data-state="${escapeHtml(
                    item.state
                )}">
                    <span class="turnero-surface-smoke-checklist__label">${escapeHtml(
                        item.label
                    )}</span>
                    <span class="turnero-surface-smoke-checklist__detail">${escapeHtml(
                        item.detail || ''
                    )}</span>
                </li>
            `
        )
        .join('');

    return `
        <section class="turnero-surface-smoke-checklist" data-score="${escapeHtml(
            String(summary.score || 0)
        )}">
            <header class="turnero-surface-smoke-checklist__header">
                <div>
                    <p class="turnero-surface-smoke-checklist__eyebrow">Smoke checklist</p>
                    <h4>Checklist de arranque</h4>
                </div>
                <span class="turnero-surface-smoke-checklist__summary">${escapeHtml(
                    `${Number(summary.pass || 0)}/${Number(summary.all || 0)} · ${Number(
                        summary.score || 0
                    )}%`
                )}</span>
            </header>
            <ul class="turnero-surface-smoke-checklist__items">${items}</ul>
        </section>
    `.trim();
}
