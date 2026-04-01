#!/usr/bin/env node

/**
 * Aurora Derm - Alert Pipeline
 * S7-30: Envia notificaciones operativas a Telegram
 * Uso: echo "Mensaje" | npm run gov:alert
 * Uso: npm run gov:alert -- "Mensaje"
 */

const https = require('https');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token || !chatId) {
    console.warn('[Alert] TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurados. Saltando alerta.');
    process.exit(0); // Exit graceful, no rompemos el build
}

let message = process.argv.slice(2).join(' ');

function sendAlert(text) {
    if (!text.trim()) {
        console.warn('[Alert] Mensaje vacío. No se enviará.');
        process.exit(0);
    }

    const payload = JSON.stringify({
        chat_id: chatId,
        text: `🚨 *Aurora Derm Alert*\n\n${text}`,
        parse_mode: 'Markdown'
    });

    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': payload.length
        }
    };

    const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (d) => responseBody += d);
        res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log('[Alert] Mensaje enviado a Telegram con éxito.');
            } else {
                console.error(`[Alert] Fallo al enviar a Telegram (${res.statusCode}):`, responseBody);
            }
        });
    });

    req.on('error', (e) => {
        console.error('[Alert] Error de red enviando telegram alert:', e.message);
    });

    req.write(payload);
    req.end();
}

if (!message && !process.stdin.isTTY) {
    // Read from STDIN
    let data = '';
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => sendAlert(data));
} else {
    sendAlert(message);
}
