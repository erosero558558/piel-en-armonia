#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');

const PORT = 8999;
const API_URL = `http://127.0.0.1:${PORT}/api.php`;

async function fetchJSON(action, options = {}, retries = 3) {
    const url = `${API_URL}?action=${action}`;
    const opts = {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    };
    if (options.body) {
        opts.body = JSON.stringify(options.body);
    }
    
    // In Node < 18 we might not have global fetch, but we assume Node 18+
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, opts);
            const text = await res.text();
            if (options.rawResult) {
                return { status: res.status, ok: res.ok, body: text, headers: res.headers };
            }
            try {
                return JSON.parse(text);
            } catch (e) {
                if (res.ok) return { ok: true, raw: text };
                throw new Error(`Invalid JSON response: ${text.substring(0, 50)}...`);
            }
        } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, 200));
        }
    }
}

async function runSmokeTest() {
    console.log('🔥 Iniciando Smoke E2E en ambiente sintético...');
    const startTime = performance.now();

    // 1. Boot PHP Server
    const phpServer = spawn('php', ['-d', 'display_errors=stderr', '-S', `127.0.0.1:${PORT}`, 'api.php'], {
        env: { ...process.env, AURORADERM_PATIENT_PORTAL_EXPOSE_OTP: 'true' },
        stdio: 'inherit'
    });

    // Clean up on exit
    process.on('exit', () => phpServer.kill());
    process.on('SIGINT', () => { phpServer.kill(); process.exit(1); });

    // Wait for server to boot
    await new Promise(r => setTimeout(r, 500));

    try {
        // --- Paso 1: Healthcheck ---
        console.log('-> Diagnosticando Health...');
        const health = await fetchJSON('health');
        if (!health.ok) {
            throw new Error('Health check falló');
        }

        // --- Paso 1.5: Obtener Slot Valido ---
        console.log('-> Buscando slot disponible...');
        const availReq = await fetchJSON('availability');
        if (!availReq.ok || !availReq.data) {
             throw new Error('No se pudo cargar availability');
        }
        const availDates = Object.keys(availReq.data);
        if (availDates.length === 0) {
             throw new Error('No hay slots disponibles para agendar el synthetic test');
        }
        const targetDate = availDates[0];
        const targetTime = availReq.data[targetDate][0];

        // --- Paso 2: Booking Sintetico ---
        console.log(`-> Mock reservación de prueba en ${targetDate} ${targetTime}...`);
        const testPhone = '593998887777';
        // Mock payload basico
        const bookingReq = await fetchJSON('appointments', {
            method: 'POST',
            body: {
                date: targetDate,
                time: targetTime,
                service: 'consulta',
                name: 'Paciente Sintetico',
                email: 'smoke@auroraderm.com',
                phone: testPhone,
                privacyConsent: true,
                idempotencyKey: 'smoke-1234'
            }
        });
        
        // No necesitamos que la booking sea 100% exitosa si el slot esta ocupado,
        // nos interesa que responda validamente la estructura JSON de reservas.
        if (!bookingReq.ok) {
             console.log('Booking request details:', bookingReq);
             throw new Error('Cita no pudo ser reservada');
        }

        // --- Paso 3: Patient Portal Auth ---
        console.log('-> Portal Auth con OTP Interceptado...');
        const authStart = await fetchJSON('patient-portal-auth-start', {
            method: 'POST',
            body: { phone: testPhone }
        });

        if (!authStart.ok || !authStart.data || !authStart.data.debugCode) {
             throw new Error('Auth Start falló o no retornó el code sobre-expuesto para pruebas: ' + JSON.stringify(authStart));
        }

        const authComplete = await fetchJSON('patient-portal-auth-complete', {
             method: 'POST',
             body: { phone: testPhone, code: authStart.data.debugCode }
        });

        if (!authComplete.ok || !authComplete.data || !authComplete.data.token) {
             throw new Error('Auth Complete falló, JWT token no capturado');
        }

        // --- Paso 4: Descarga Historial PDF ---
        console.log('-> Solicitando Patient Record PDF...');
        const pdfReq = await fetchJSON('patient-portal-history-pdf', {
            method: 'GET',
            headers: {
                 'Authorization': `Bearer ${authComplete.data.token}`
            },
            rawResult: true
        });

        if (pdfReq.status !== 200) {
             throw new Error('PDF Request fail: HTTP ' + pdfReq.status);
        }

        if (!pdfReq.body.includes('%PDF-')) {
             throw new Error('El payload devuelto no es un archivo PDF válido');
        }

        const elap = performance.now() - startTime;
        console.log(`✅ Smoke E2E superado. Tiempo total: ${Math.round(elap)}ms`);

        if (elap > 5000) {
            console.error('❌ Tiempos excedidos. La directiva estricta requiere < 5s.');
            process.exit(1);
        }

        phpServer.kill();
        process.exit(0);

    } catch (e) {
        console.error('❌ E2E Smoke Fracasó:', e.message);
        phpServer.kill();
        process.exit(1);
    }

}

runSmokeTest();
