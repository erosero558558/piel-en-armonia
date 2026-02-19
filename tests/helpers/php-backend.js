// @ts-check
'use strict';

let phpRuntimeProbePromise = null;

function looksLikeRawPhpSource(text) {
  return /^\s*<\?php\b/i.test(text || '');
}

async function detectPhpRuntime(request) {
  if (!phpRuntimeProbePromise) {
    phpRuntimeProbePromise = (async () => {
      try {
        const response = await request.get('/api.php?resource=health', { timeout: 7000 });
        const body = await response.text();

        if (looksLikeRawPhpSource(body)) {
          return {
            available: false,
            reason: 'api.php se sirve como texto plano (sin runtime PHP).',
          };
        }

        return {
          available: true,
          reason: `health status ${response.status()}`,
        };
      } catch (error) {
        // No ocultar caidas reales de infraestructura: en duda, no se hace skip.
        return {
          available: true,
          reason: `probe no concluyente: ${error && error.message ? error.message : 'error desconocido'}`,
        };
      }
    })();
  }

  return phpRuntimeProbePromise;
}

async function skipIfPhpRuntimeMissing(test, request) {
  const probe = await detectPhpRuntime(request);
  test.skip(!probe.available, `Saltado: ${probe.reason}`);
  return probe;
}

module.exports = {
  detectPhpRuntime,
  skipIfPhpRuntimeMissing,
};
