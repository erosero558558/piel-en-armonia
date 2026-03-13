// @ts-check
'use strict';

const {
    buildConfig,
    signBridgePayload,
} = require('../../bin/lib/operator-auth-bridge.js');

function getEnv(name, fallback = '') {
    const value = process.env[name];
    return typeof value === 'string' ? value.trim() : fallback;
}

function firstNonEmpty(...values) {
    for (const value of values) {
        const normalized = String(value || '').trim();
        if (normalized) {
            return normalized;
        }
    }

    return '';
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

async function safeJson(response) {
    try {
        return await response.json();
    } catch {
        return {};
    }
}

async function getAdminAuthStatus(request) {
    const response = await request.get('/admin-auth.php?action=status');
    const body = await safeJson(response);

    return {
        ok: response.ok(),
        httpStatus: response.status(),
        body,
        mode: typeof body.mode === 'string' ? body.mode : '',
        status: typeof body.status === 'string' ? body.status : '',
        configured: body.configured !== false,
        recommendedMode:
            typeof body.recommendedMode === 'string'
                ? body.recommendedMode
                : '',
    };
}

function getOperatorAuthTestConfig(overrides = {}) {
    const rawAllowlist = firstNonEmpty(
        overrides.allowlist,
        getEnv('TEST_OPERATOR_AUTH_ALLOWLIST'),
        getEnv('PIELARMONIA_OPERATOR_AUTH_ALLOWLIST'),
        getEnv('PIELARMONIA_OPERATOR_AUTH_ALLOWED_EMAILS'),
        getEnv('PIELARMONIA_ADMIN_EMAIL'),
        'operator@example.com'
    );
    const allowlist = String(rawAllowlist)
        .split(',')
        .map((item) => normalizeEmail(item))
        .filter(Boolean);
    const email = normalizeEmail(
        firstNonEmpty(overrides.email, getEnv('TEST_OPERATOR_AUTH_EMAIL'), allowlist[0])
    );
    if (email && !allowlist.includes(email)) {
        allowlist.unshift(email);
    }

    const bridgeConfig = buildConfig({
        ...process.env,
        PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL: firstNonEmpty(
            overrides.helperBaseUrl,
            getEnv('TEST_OPERATOR_AUTH_HELPER_BASE_URL'),
            getEnv('PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL'),
            'http://127.0.0.1:4173'
        ),
        PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN: firstNonEmpty(
            overrides.bridgeToken,
            getEnv('TEST_OPERATOR_AUTH_BRIDGE_TOKEN'),
            getEnv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN'),
            'operator-auth-bridge-test-token'
        ),
        PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET: firstNonEmpty(
            overrides.bridgeSecret,
            getEnv('TEST_OPERATOR_AUTH_BRIDGE_SECRET'),
            getEnv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET')
        ),
        PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER: firstNonEmpty(
            overrides.bridgeHeader,
            getEnv('TEST_OPERATOR_AUTH_BRIDGE_HEADER'),
            getEnv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER')
        ),
        PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_PREFIX: firstNonEmpty(
            overrides.bridgePrefix,
            getEnv('TEST_OPERATOR_AUTH_BRIDGE_PREFIX'),
            getEnv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_PREFIX')
        ),
        PIELARMONIA_OPERATOR_AUTH_DEVICE_ID: firstNonEmpty(
            overrides.deviceId,
            getEnv('TEST_OPERATOR_AUTH_DEVICE_ID'),
            'device-test-operator'
        ),
    });

    return {
        mode: 'openclaw_chatgpt',
        allowlist,
        email: email || 'operator@example.com',
        profileId: firstNonEmpty(
            overrides.profileId,
            getEnv('TEST_OPERATOR_AUTH_PROFILE_ID'),
            'openai-codex:test-profile'
        ),
        accountId: firstNonEmpty(
            overrides.accountId,
            getEnv('TEST_OPERATOR_AUTH_ACCOUNT_ID'),
            'acct-test-operator'
        ),
        deviceId: bridgeConfig.helperDeviceId || 'device-test-operator',
        bridgeToken: bridgeConfig.bridgeToken,
        bridgeSecret:
            bridgeConfig.bridgeSecret || bridgeConfig.bridgeToken,
        bridgeHeader: bridgeConfig.bridgeTokenHeader,
        bridgePrefix: bridgeConfig.bridgeTokenPrefix,
        helperBaseUrl: bridgeConfig.helperBaseUrl,
    };
}

async function adminPasswordLogin(request, password) {
    const response = await request.post('/admin-auth.php?action=login', {
        data: { password },
    });
    const body = await safeJson(response);

    if (!response.ok() || body.ok === false) {
        return {
            ok: false,
            reason: body.error || `HTTP ${response.status()}`,
        };
    }

    if (body.twoFactorRequired) {
        return {
            ok: false,
            reason: '2FA requerido para panel admin',
        };
    }

    const csrfToken = typeof body.csrfToken === 'string' ? body.csrfToken : '';
    if (!csrfToken) {
        return {
            ok: false,
            reason: 'Login admin sin CSRF token',
        };
    }

    return {
        ok: true,
        csrfToken,
        body,
    };
}

async function startOpenClawChallenge(request) {
    const response = await request.post('/admin-auth.php?action=start', {
        data: {},
    });
    const body = await safeJson(response);

    if (response.status() !== 202 || body.ok !== true) {
        return {
            ok: false,
            reason: body.error || `No se pudo iniciar challenge OpenClaw (HTTP ${response.status()}).`,
            body,
        };
    }

    const challenge =
        body.challenge && typeof body.challenge === 'object'
            ? body.challenge
            : null;
    if (!challenge) {
        return {
            ok: false,
            reason: 'Challenge OpenClaw ausente en la respuesta del backend.',
            body,
        };
    }

    return {
        ok: true,
        challenge,
        body,
    };
}

async function completeOpenClawChallenge(request, challenge, overrides = {}) {
    const config = getOperatorAuthTestConfig(overrides);
    const payload = {
        challengeId: String(challenge?.challengeId || '').trim(),
        nonce: String(challenge?.nonce || '').trim(),
        status: 'completed',
        email: config.email,
        profileId: config.profileId,
        accountId: config.accountId,
        deviceId: config.deviceId,
        timestamp: new Date().toISOString(),
    };

    if (!payload.challengeId || !payload.nonce) {
        return {
            ok: false,
            reason: 'Challenge OpenClaw invalido: faltan challengeId o nonce.',
        };
    }

    payload.signature = signBridgePayload(payload, config.bridgeSecret);
    const authHeader = config.bridgePrefix
        ? `${config.bridgePrefix} ${config.bridgeToken}`
        : config.bridgeToken;
    const response = await request.post(
        '/api.php?resource=operator-auth-complete',
        {
            headers: {
                [config.bridgeHeader]: authHeader,
            },
            data: payload,
        }
    );
    const body = await safeJson(response);

    if (response.status() !== 202 || body.ok !== true) {
        return {
            ok: false,
            reason:
                body.error ||
                `No se pudo completar challenge OpenClaw (HTTP ${response.status()}).`,
            body,
            payload,
        };
    }

    return {
        ok: true,
        body,
        payload,
    };
}

async function consumeOpenClawSession(request, { retries = 4 } = {}) {
    for (let attempt = 0; attempt < retries; attempt += 1) {
        const response = await request.get('/admin-auth.php?action=status');
        const body = await safeJson(response);

        if (response.ok() && body.authenticated === true) {
            const csrfToken =
                typeof body.csrfToken === 'string' ? body.csrfToken : '';
            if (!csrfToken) {
                return {
                    ok: false,
                    reason: 'Sesion OpenClaw autenticada sin CSRF token.',
                    body,
                };
            }

            return {
                ok: true,
                csrfToken,
                body,
            };
        }

        const status = String(body.status || '').trim();
        if (
            status &&
            status !== 'pending' &&
            status !== 'anonymous' &&
            status !== 'operator_auth_not_configured'
        ) {
            return {
                ok: false,
                reason: body.error || `OpenClaw devolvio estado terminal ${status}.`,
                body,
            };
        }
    }

    return {
        ok: false,
        reason: 'OpenClaw no llego a estado autenticado dentro del polling esperado.',
    };
}

async function adminOpenClawLogin(request, overrides = {}) {
    const start = await startOpenClawChallenge(request);
    if (!start.ok) {
        return start;
    }

    const completion = await completeOpenClawChallenge(
        request,
        start.challenge,
        overrides
    );
    if (!completion.ok) {
        return completion;
    }

    const session = await consumeOpenClawSession(request, overrides);
    if (!session.ok) {
        return session;
    }

    return {
        ok: true,
        csrfToken: session.csrfToken,
        challenge: start.challenge,
        body: session.body,
    };
}

async function adminLogin(request, overrides = {}) {
    const snapshot = await getAdminAuthStatus(request);
    if (!snapshot.ok) {
        return {
            ok: false,
            reason: `No se pudo consultar admin-auth status (HTTP ${snapshot.httpStatus}).`,
        };
    }

    if (snapshot.mode === 'openclaw_chatgpt') {
        if (
            snapshot.status === 'operator_auth_not_configured' ||
            snapshot.configured === false
        ) {
            return {
                ok: false,
                reason: 'OpenClaw auth no configurado. Define bridge token, bridge secret y allowlist para este entorno.',
            };
        }

        return adminOpenClawLogin(request, overrides);
    }

    const password = firstNonEmpty(
        overrides.password,
        getEnv('TEST_ADMIN_PASSWORD'),
        getEnv('PIELARMONIA_ADMIN_PASSWORD')
    );

    if (!password) {
        return {
            ok: false,
            reason: 'TEST_ADMIN_PASSWORD o PIELARMONIA_ADMIN_PASSWORD es requerido para login legacy.',
        };
    }

    if (
        snapshot.status === 'legacy_auth_not_configured' ||
        snapshot.configured === false
    ) {
        return {
            ok: false,
            reason: 'Login legacy no configurado. Define PIELARMONIA_ADMIN_PASSWORD y el override legacy en este entorno.',
        };
    }

    return adminPasswordLogin(request, password);
}

module.exports = {
    adminLogin,
    adminOpenClawLogin,
    adminPasswordLogin,
    completeOpenClawChallenge,
    getAdminAuthStatus,
    getEnv,
    getOperatorAuthTestConfig,
    safeJson,
    startOpenClawChallenge,
};
