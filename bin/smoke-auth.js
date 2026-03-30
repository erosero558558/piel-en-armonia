#!/usr/bin/env node

/**
 * bin/smoke-auth.js
 * 
 * Monitoreo de latencia y disponibilidad de los endpoints de autenticación críticos (S8-05).
 * Valida de forma anónima que los recursos respondan sin hacer crash del proxy (Zero 5xx) 
 * en menos de 3.0 segundos.
 */

const { performance } = require('perf_hooks');

const baseUrl = process.env.APP_URL || 'https://pielarmonia.com';
const TIMEOUT_MS = 3000;

const targets = [
  `${baseUrl}/api.php?resource=operator-auth-status`,
  `${baseUrl}/admin-auth.php?action=status`
];

async function checkEndpoint(url) {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, { 
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AuroraDerm-SmokeAuth/1.0'
      },
      signal: controller.signal 
    });
    
    clearTimeout(timeout);
    const duration = performance.now() - start;

    if (res.status >= 500 && res.status <= 599) {
      return { ok: false, duration, error: `Critical Proxy/Backend failure (HTTP ${res.status})` };
    }

    return { ok: true, duration, status: res.status };
  } catch (error) {
    const duration = performance.now() - start;
    if (error.name === 'AbortError') {
      return { ok: false, duration, error: `Timeout excedido (${TIMEOUT_MS}ms)` };
    }
    return { ok: false, duration, error: error.message };
  }
}

async function runSmoke() {
  console.log(`\n🚀 Iniciando Smoke Test de Auth Recovery (Target: ${baseUrl})\n`);
  let hasErrors = false;

  for (const url of targets) {
    process.stdout.write(`   Verificando [${url}] ... `);
    
    const result = await checkEndpoint(url);
    
    if (result.ok) {
      const msLabel = result.duration.toFixed(0).padStart(4, ' ');
      console.log(`✅ OK (${msLabel}ms) [HTTP ${result.status}]`);
    } else {
      console.log(`❌ FALLO (${result.duration.toFixed(0)}ms) - ${result.error}`);
      hasErrors = true;
    }
  }

  console.log();
  if (hasErrors) {
    console.error(`🚨 Smoke Test falló. Posible 502/Timeout. Revisa docs/AUTH_RECOVERY_RUNBOOK.md`);
    process.exit(1);
  } else {
    console.log(`🌟 Endpoints de Auth estables y de baja latencia.`);
    process.exit(0);
  }
}

runSmoke();
