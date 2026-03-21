function normalizeText(value, fallback = '') {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase();
    return normalized || fallback;
}

function normalizeBoolean(value) {
    if (value === true || value === 1 || value === '1' || value === 'true') {
        return true;
    }

    return false;
}

function isPassingState(value) {
    const normalized = normalizeText(value);
    if (!normalized) {
        return false;
    }

    return ![
        'unknown',
        'offline',
        'down',
        'missing',
        'alert',
        'blocked',
        'critical',
        'error',
        'halt',
    ].includes(normalized);
}

function buildCheck(key, label, pass) {
    return {
        key,
        label,
        pass: Boolean(pass),
        state: pass ? 'ready' : 'alert',
    };
}

export function buildTurneroSurfaceHardwareChecklist(input = {}) {
    const snapshot =
        input.snapshot && typeof input.snapshot === 'object'
            ? input.snapshot
            : {};
    const runtimeState = normalizeText(snapshot.runtimeState);
    const truth = normalizeText(snapshot.truth);
    const printerState = normalizeText(snapshot.printerState);
    const bellState = normalizeText(snapshot.bellState);
    const signageState = normalizeText(snapshot.signageState);
    const operatorReady = normalizeBoolean(snapshot.operatorReady);

    const checks = [
        buildCheck('runtime', 'Runtime visible', isPassingState(runtimeState)),
        buildCheck('truth', 'Truth resuelto', isPassingState(truth)),
        buildCheck(
            'printer',
            'Impresora/control local',
            isPassingState(printerState)
        ),
        buildCheck('bell', 'Campanilla/audio', isPassingState(bellState)),
        buildCheck(
            'signage',
            'Senaletica/ubicacion',
            isPassingState(signageState)
        ),
        buildCheck('operator', 'Operador listo', operatorReady),
    ];

    return {
        checks,
        summary: {
            all: checks.length,
            pass: checks.filter((item) => item.pass).length,
            fail: checks.filter((item) => !item.pass).length,
        },
        generatedAt: new Date().toISOString(),
    };
}
