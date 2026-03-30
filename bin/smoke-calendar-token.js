#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

function trimToString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function parsePhpEnvFile(raw) {
    const parsed = {};
    const lines = String(raw || '').split(/\r?\n/);

    for (const line of lines) {
        const match = line.match(
            /^\s*putenv\(\s*(['"])([A-Z0-9_]+)=([\s\S]*?)\1\s*\)\s*;\s*$/
        );
        if (!match) continue;
        const key = trimToString(match[2]);
        const value = String(match[3] || '')
            .replace(/\\'/g, "'")
            .replace(/\\"/g, '"')
            .trim();
        if (key !== '') parsed[key] = value;
    }
    return parsed;
}

function loadEnvConfig() {
    const envFile = path.join(REPO_ROOT, 'env.php');
    let phpEnv = {};
    if (fs.existsSync(envFile)) {
        try {
            phpEnv = parsePhpEnvFile(fs.readFileSync(envFile, 'utf8'));
        } catch (_error) {
            // Ignorar error
        }
    }
    return { ...phpEnv, ...process.env };
}

function envValue(envObj, primary, alt = '') {
    const valPrimary = trimToString(envObj[primary]);
    if (valPrimary !== '') return valPrimary;
    const valAlt = trimToString(envObj[alt]);
    if (valAlt !== '') return valAlt;
    return '';
}

function getTelegramConfig(envObj) {
    const token =
        envValue(envObj, 'FIGO_TELEGRAM_BOT_TOKEN') ||
        envValue(envObj, 'TELEGRAM_BOT_TOKEN');
    const chatId =
        envValue(envObj, 'FIGO_TELEGRAM_CHAT_ID') ||
        envValue(envObj, 'TELEGRAM_CHAT_ID');
    return { token, chatId };
}

function sendTelegramAlert(token, chatId, text) {
    return new Promise((resolve) => {
        if (!token || !chatId) {
            resolve(false);
            return;
        }

        const payload = JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
        });

        const request = https.request(
            {
                method: 'POST',
                hostname: 'api.telegram.org',
                path: `/bot${token}/sendMessage`,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                },
                timeout: 5000,
            },
            (response) => {
                response.on('data', () => {});
                response.on('end', () => resolve(response.statusCode === 200));
            }
        );

        request.on('error', () => resolve(false));
        request.write(payload);
        request.end();
    });
}

function postFormUrlencoded(url, data) {
    return new Promise((resolve, reject) => {
        const payload = new URLSearchParams(data).toString();
        const request = https.request(
            url,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(payload),
                    Accept: 'application/json',
                },
                timeout: 10000,
            },
            (response) => {
                let raw = '';
                response.setEncoding('utf8');
                response.on('data', (chunk) => {
                    raw += chunk;
                });
                response.on('end', () => {
                    resolve({ status: response.statusCode, body: raw });
                });
            }
        );
        request.on('error', reject);
        request.write(payload);
        request.end();
    });
}

function checkExpirationPredicted(expiresAtIso) {
    if (!expiresAtIso) return { danger: false, message: '' };

    const expiresDate = new Date(expiresAtIso);
    if (Number.isNaN(expiresDate.getTime())) {
        return {
            danger: false,
            message: `Fecha de expiración mal formateada (ISO8601 esperado): ${expiresAtIso}`,
        };
    }

    const diffMs = expiresDate.getTime() - Date.now();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays <= 0) {
        return {
            danger: true,
            message: `⚠️ El token de Google Calendar EXPIRÓ hace ${Math.abs(diffDays).toFixed(1)} días (${expiresAtIso}).`,
        };
    }

    if (diffDays < 7) {
        return {
            danger: true,
            message: `⚠️ El token de Google Calendar expira en ${diffDays.toFixed(1)} días (${expiresAtIso}). Renovación URGENTE requerida.`,
        };
    }

    return { danger: false, message: '' };
}

async function main() {
    const envObj = loadEnvConfig();

    const authMode = envValue(
        envObj,
        'AURORADERM_CALENDAR_AUTH_MODE',
        'PIELARMONIA_CALENDAR_AUTH_MODE'
    ).toLowerCase();

    // Solo corre en OAuth explicitamente or auto si hay variables presentes.
    if (authMode !== 'oauth_refresh_token' && authMode !== 'oauth_refresh') {
        process.stdout.write(
            `smoke-calendar-token: auth_mode no es oauth_refresh (${authMode}), saltando verificación.\n`
        );
        process.exit(0);
    }

    const clientId = envValue(
        envObj,
        'AURORADERM_GOOGLE_OAUTH_CLIENT_ID',
        'PIELARMONIA_GOOGLE_OAUTH_CLIENT_ID'
    );
    const clientSecret = envValue(
        envObj,
        'AURORADERM_GOOGLE_OAUTH_CLIENT_SECRET',
        'PIELARMONIA_GOOGLE_OAUTH_CLIENT_SECRET'
    );
    const refreshToken = envValue(
        envObj,
        'AURORADERM_GOOGLE_OAUTH_REFRESH_TOKEN',
        'PIELARMONIA_GOOGLE_OAUTH_REFRESH_TOKEN'
    );
    const expiresAt = envValue(
        envObj,
        'AURORADERM_GOOGLE_OAUTH_TOKEN_EXPIRES_AT',
        'PIELARMONIA_GOOGLE_OAUTH_TOKEN_EXPIRES_AT'
    );

    const telegramConfig = getTelegramConfig(envObj);
    const alertPrefix = '<b>[🚨 ALERTA - Aurora Derm Token]</b>';

    if (!clientId || !clientSecret || !refreshToken) {
        process.stderr.write(
            'smoke-calendar-token: Faltan credenciales (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN).\n'
        );
        process.exit(1);
    }

    // 1. Verificación predictiva local (opcional)
    const predicted = checkExpirationPredicted(expiresAt);
    if (predicted.danger) {
        process.stderr.write(`${predicted.message}\n`);
        await sendTelegramAlert(
            telegramConfig.token,
            telegramConfig.chatId,
            `${alertPrefix}\n${predicted.message}\n\nAciónenos inmediatamente usando \`php bin/calendar-oauth.js\`.`
        );
        process.exit(1);
    }

    // 2. Verificación contra endpoint estático
    try {
        const response = await postFormUrlencoded(
            'https://oauth2.googleapis.com/token',
            {
                grant_type: 'refresh_token',
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
            }
        );

        const status = Number(response.status);
        let errorMsg = '';
        let errorReason = '';

        try {
            const body = JSON.parse(response.body);
            if (status >= 200 && status < 300) {
                process.stdout.write(
                    'smoke-calendar-token: Token válido y Google lo ha verificado (OK).\n'
                );
                process.exit(0);
            }
            errorReason = body.error || 'unknown_grant_error';
            errorMsg = body.error_description || body.error || 'Server error';
        } catch (_e) {
            errorMsg = `Respuesta no parseable (HTTP ${status})`;
            errorReason = 'invalid_format';
        }

        const notifyMsg = `⚠️ El token de Google Calendar falló la aserción ante Google. El token está <b>REVOCADO o EXPIRADO.</b>
Razón: <code>${errorReason}</code>
Mensaje: <i>${errorMsg}</i>

Aciónenos inmediatamente. La integración del calendario ESTÁ ROTA.`;

        process.stderr.write(`${notifyMsg}\n`);
        await sendTelegramAlert(
            telegramConfig.token,
            telegramConfig.chatId,
            `${alertPrefix}\n${notifyMsg}`
        );
        process.exit(1);
    } catch (networkError) {
        process.stderr.write(
            `smoke-calendar-token: Fallo comunicándose con Google - ${networkError.message}\n`
        );
        // Error temporal de red, asumimos que no es falla del token sino de GCP o nuestro DNS
        process.exit(2);
    }
}

main().catch((error) => {
    process.stderr.write(`smoke-calendar-token fatal error: ${error}\n`);
    process.exit(1);
});
