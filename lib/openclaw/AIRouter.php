<?php

declare(strict_types=1);

/**
 * OpenClaw AI Router — Capa de routing multi-proveedor
 *
 * PROBLEMA QUE RESUELVE:
 *   No poner todos los huevos en una sola canasta.
 *   ChatGPT puede subir el precio. Codex tiene límites por sesión.
 *   El médico no puede quedarse sin IA a mitad de consulta.
 *
 * ARQUITECTURA DE PROVEEDORES:
 *
 *   Tier 1 — Codecalidad maxima (cero costo para la clínica)
 *     • codex_oauth   → Codex/ChatGPT via OAuth del usuario
 *       Límite: se recarga cada 5h, hay límite semanal
 *       Cuando se agota → baja automáticamente a Tier 2
 *
 *   Tier 2 — Fallback económico (costo mínimo para la clínica)
 *     • openrouter    → OpenRouter.ai con modelos chinos/libres
 *       Modelos: DeepSeek-V3 ($0.014/1M tokens), Qwen-72B (free),
 *                Mistral-7B (free), Llama-3.3-70B (free)
 *       Costo: ~$2-5/mes para 40 pacientes/día
 *
 *   Tier 3 — Fallback local (costo $0, calidad reducida)
 *     • local_heuristic → Respuestas basadas en patrones predefinidos
 *       Solo para emergencia. El médico ve aviso claro.
 *
 * FLUJO:
 *   1. Intentar Tier 1 (Codex OAuth)
 *   2. Si 429/rate-limit/timeout → intentar Tier 2 (OpenRouter)
 *   3. Si Tier 2 falla → Tier 3 (heurístico local)
 *   4. El médico siempre recibe respuesta. El proveedor usado se loguea.
 *
 * CONFIGURACIÓN (.env):
 *   OPENCLAW_ROUTER_MODE=auto         # auto|codex_only|openrouter_only|local_only
 *   OPENCLAW_CODEX_ENDPOINT=...       # URL del endpoint OAuth/Codex
 *   OPENCLAW_CODEX_TOKEN_PATH=...     # Dónde guardar el token OAuth
 *   OPENCLAW_OPENROUTER_KEY=...       # API key de OpenRouter (gratis para registrarse)
 *   OPENCLAW_OPENROUTER_MODEL=...     # Modelo preferido (default: deepseek/deepseek-chat-v3-0324:free)
 *   OPENCLAW_OPENROUTER_FALLBACK_MODELS=... # CSV de modelos de respaldo
 */

require_once __DIR__ . '/../figo_utils.php';
require_once __DIR__ . '/../storage.php';

final class OpenclawAIRouter
{
    private const LOCAL_OFFLINE_BADGE = '🔴 IA sin conexión — respuestas locales';
    private const LOCAL_OFFLINE_NOTICE = '🔴 IA sin conexión — respuestas locales. OpenClaw está respondiendo con plantillas locales mientras se recupera la IA.';

    // Modelos free/económicos de OpenRouter en orden de preferencia
    // Ver la lista actualizada en: https://openrouter.ai/models?order=pricing-asc
    private const OPENROUTER_MODEL_CHAIN = [
        'deepseek/deepseek-chat-v3-0324:free',   // DeepSeek V3 — gratis, muy capaz
        'qwen/qwen3-235b-a22b:free',              // Qwen 235B — gratis, chino, excelente
        'meta-llama/llama-3.3-70b-instruct:free', // Llama 70B — gratis, buena calidad
        'mistralai/mistral-small-3.1-24b-instruct:free', // Mistral — gratis
        'google/gemma-3-27b-it:free',             // Gemma — gratis
        'deepseek/deepseek-r1:free',              // DeepSeek R1 razonamiento — gratis
        'deepseek/deepseek-chat:free',            // DeepSeek V2 — respaldo
        'openchat/openchat-7b:free',               // OpenChat — último recurso
    ];

    private const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
    private const ROUTER_STATE_FILE = 'ai-router-state.json';
    private const COOLDOWN_SECONDS = 300; // 5 minutos de cooldown por proveedor en error

    private string $routerMode;
    private string $statePath;

    public function __construct()
    {
        $this->routerMode = $this->resolveMode();
        $this->statePath = data_dir_path() . DIRECTORY_SEPARATOR . self::ROUTER_STATE_FILE;
    }

    /**
     * Punto de entrada principal.
     * Recibe el payload del mismo formato que figo-ai-bridge.php
     * Devuelve la respuesta del proveedor que funcionó.
     */
    public function route(array $payload): array
    {
        $providers = $this->buildProviderChain();

        foreach ($providers as $provider) {
            if ($this->isInCooldown($provider)) {
                continue;
            }

            $result = $this->tryProvider($provider, $payload);

            if ($result['ok']) {
                $this->clearCooldown($provider);
                $result['provider_used'] = $provider;
                $result['provider_tier'] = $this->getTier($provider);
                return $result;
            }

            // Rate limited or quota exceeded → cooldown + try next
            if (in_array($result['error_code'] ?? '', ['rate_limit', 'quota_exceeded', 'context_length'], true)) {
                $this->setCooldown($provider, self::COOLDOWN_SECONDS);
                error_log("[OpenclawAIRouter] Provider {$provider} rate limited. Cooldown set. Trying next.");
                continue;
            }

            // Timeout or network error → short cooldown
            if (in_array($result['error_code'] ?? '', ['timeout', 'network_error'], true)) {
                $this->setCooldown($provider, 60);
                continue;
            }

            // Fatal error (config, auth) → long cooldown
            $this->setCooldown($provider, self::COOLDOWN_SECONDS * 6);
            error_log("[OpenclawAIRouter] Provider {$provider} fatal error: " . ($result['error'] ?? 'unknown'));
        }

        // All providers failed → local heuristic
        error_log("[LOCAL] AIRouter degenerated to Tier 3 fallback due to AI provider failures for payload signature.");
        $fallback = $this->localHeuristicFallback($payload);
        $fallback['provider_used'] = 'local_heuristic';
        $fallback['provider_tier'] = 'tier_3';
        return $fallback;
    }

    /**
     * Status del router — qué proveedor está activo, cuáles en cooldown
     * Para mostrar en npm run report y en el panel de admin.
     */
    public function getStatus(): array
    {
        $state = $this->loadState();
        $chain = $this->buildProviderChain();
        $providerStatus = [];

        foreach ($chain as $provider) {
            $cooldownUntil = $state['cooldowns'][$provider] ?? 0;
            $remaining = max(0, $cooldownUntil - time());
            $providerStatus[] = [
                'provider' => $provider,
                'tier' => $this->getTier($provider),
                'active' => $remaining === 0,
                'cooldown_remaining_seconds' => $remaining,
                'last_error' => $state['last_errors'][$provider] ?? null,
            ];
        }

        $active = array_values(array_filter($providerStatus, fn($p) => $p['active']));

        $isLocalFallback = ($active[0]['provider'] ?? 'local_heuristic') === 'local_heuristic';

        return [
            'router_mode' => $this->routerMode,
            'active_provider' => $active[0]['provider'] ?? 'local_heuristic',
            'active_tier' => $active[0]['tier'] ?? 'tier_3',
            'degraded' => $isLocalFallback,
            'offline_badge' => $isLocalFallback ? self::LOCAL_OFFLINE_BADGE : '',
            'degraded_notice' => $isLocalFallback ? self::LOCAL_OFFLINE_NOTICE : '',
            'providers' => $providerStatus,
            'last_updated' => gmdate('c'),
        ];
    }

    // ── Provider chain construction ───────────────────────────────────────────

    private function buildProviderChain(): array
    {
        switch ($this->routerMode) {
            case 'codex_only':
                return ['codex_oauth'];
            case 'openrouter_only':
                return $this->openRouterProviders();
            case 'local_only':
                return ['local_heuristic'];
            default: // auto
                $chain = [];
                // Tier 1: Codex/ChatGPT OAuth if configured
                if ($this->isCodexConfigured()) {
                    $chain[] = 'codex_oauth';
                }
                // Tier 2: OpenRouter models if key configured
                if ($this->isOpenRouterConfigured()) {
                    $chain = array_merge($chain, $this->openRouterProviders());
                }
                // Tier 3: Local heuristic (always available)
                $chain[] = 'local_heuristic';
                return $chain;
        }
    }

    private function openRouterProviders(): array
    {
        // Start with configured model, then fall through the chain
        $preferred = $this->getOpenRouterModel();
        $chain = [$preferred];

        foreach (self::OPENROUTER_MODEL_CHAIN as $model) {
            $provider = 'openrouter:' . $model;
            if ($provider !== $preferred && !in_array($provider, $chain, true)) {
                $chain[] = $provider;
            }
        }
        return $chain;
    }

    // ── Provider execution ────────────────────────────────────────────────────

    private function tryProvider(string $provider, array $payload): array
    {
        if ($provider === 'codex_oauth') {
            return $this->callCodexOAuth($payload);
        }

        if ($provider === 'local_heuristic') {
            return $this->localHeuristicFallback($payload);
        }

        if (str_starts_with($provider, 'openrouter:')) {
            $model = substr($provider, strlen('openrouter:'));
            return $this->callOpenRouter($model, $payload);
        }

        // Legacy: use the existing figo queue gateway (backward compat)
        if ($provider === 'figo_queue') {
            return $this->callFigoGateway($payload);
        }

        return ['ok' => false, 'error' => "Unknown provider: {$provider}", 'error_code' => 'config_error'];
    }

    /**
     * Tier 1: Llamar al gateway Codex/ChatGPT via OAuth.
     * El token lo tiene el médico en su sesión (lo obtuvo al autenticarse).
     * El endpoint puede ser: el figo-ai-bridge propio, o un proxy OAuth.
     */
    private function callCodexOAuth(array $payload): array
    {
        $endpoint = api_first_non_empty([
            getenv('OPENCLAW_CODEX_ENDPOINT'),
            getenv('FIGO_AI_API_URL'),
            getenv('FIGO_AI_ENDPOINT'),
            api_figo_env_gateway_endpoint(),
        ]);

        if ($endpoint === '') {
            return ['ok' => false, 'error' => 'Codex endpoint not configured', 'error_code' => 'config_error'];
        }

        $apiKey = api_first_non_empty([
            getenv('OPENCLAW_CODEX_API_KEY'),
            api_figo_env_gateway_api_key(),
        ]);

        return $this->callOpenAICompatible($endpoint, $apiKey, $payload, 'Bearer');
    }

    /**
     * Tier 2: Llamar a OpenRouter.ai
     * Multi-modelo, precio muy bajo, modelos chinos/gratis disponibles.
     * El médico no nota la diferencia en calidad clínica.
     */
    private function callOpenRouter(string $model, array $payload): array
    {
        $apiKey = $this->getOpenRouterKey();

        if ($apiKey === '') {
            return ['ok' => false, 'error' => 'OpenRouter key not configured', 'error_code' => 'config_error'];
        }

        $openRouterPayload = $payload;
        $openRouterPayload['model'] = $model;

        // OpenRouter needs these headers for tracking
        $extraHeaders = [
            'HTTP-Referer: https://pielarmonia.com',
            'X-Title: OpenClaw-AuroraDerm',
        ];

        return $this->callOpenAICompatible(
            self::OPENROUTER_ENDPOINT,
            $apiKey,
            $openRouterPayload,
            'Bearer',
            $extraHeaders,
            providerLabel: "openrouter:{$model}"
        );
    }

    /**
     * Llamador genérico OpenAI-compatible (OpenAI, OpenRouter, Codex, etc.)
     */
    private function callOpenAICompatible(
        string $endpoint,
        string $apiKey,
        array $payload,
        string $keyScheme = 'Bearer',
        array $extraHeaders = [],
        string $providerLabel = ''
    ): array {
        $timeoutSeconds = api_figo_env_ai_timeout_seconds() ?: 15;

        $messages = QueueConfig::normalizeMessages($payload['messages'] ?? []);
        if (empty($messages)) {
            return ['ok' => false, 'error' => 'No messages', 'error_code' => 'bad_request'];
        }

        $model = QueueConfig::normalizeModelName($payload['model'] ?? api_figo_env_gateway_model());
        $requestBody = [
            'model' => $model,
            'messages' => $messages,
            'max_tokens' => min(2000, max(64, (int) ($payload['max_tokens'] ?? 1400))),
            'temperature' => min(1.0, max(0.0, (float) ($payload['temperature'] ?? 0.3))),
        ];

        $headers = array_merge([
            'Content-Type: application/json',
            "Authorization: {$keyScheme} {$apiKey}",
        ], $extraHeaders);

        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeoutSeconds,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => json_encode($requestBody, JSON_UNESCAPED_UNICODE),
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $raw = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError !== '') {
            return [
                'ok' => false,
                'error' => "cURL error: {$curlError}",
                'error_code' => 'network_error',
            ];
        }

        // Map HTTP errors to error codes
        if ($httpCode === 429) {
            return ['ok' => false, 'error' => 'Rate limited', 'error_code' => 'rate_limit', 'http_code' => 429];
        }
        if ($httpCode === 402) {
            return ['ok' => false, 'error' => 'Quota exceeded', 'error_code' => 'quota_exceeded', 'http_code' => 402];
        }
        if ($httpCode === 401 || $httpCode === 403) {
            return ['ok' => false, 'error' => 'Auth error', 'error_code' => 'auth_error', 'http_code' => $httpCode];
        }
        if ($httpCode >= 500) {
            return ['ok' => false, 'error' => "Server error {$httpCode}", 'error_code' => 'server_error', 'http_code' => $httpCode];
        }

        $decoded = @json_decode((string) $raw, true);
        if (!is_array($decoded)) {
            return ['ok' => false, 'error' => 'Invalid JSON response', 'error_code' => 'parse_error'];
        }

        // Check for embedded error
        if (!empty($decoded['error'])) {
            $errMsg = is_array($decoded['error']) ? ($decoded['error']['message'] ?? 'API error') : (string) $decoded['error'];
            return ['ok' => false, 'error' => $errMsg, 'error_code' => 'api_error'];
        }

        if (!isset($decoded['choices'][0]['message']['content'])) {
            return ['ok' => false, 'error' => 'No content in response', 'error_code' => 'empty_response'];
        }

        return [
            'ok' => true,
            'choices' => $decoded['choices'],
            'usage' => $decoded['usage'] ?? null,
            'model_used' => $decoded['model'] ?? $model,
            'provider_label' => $providerLabel,
        ];
    }

    /**
     * Backward compatibility: usar el figo_queue gateway existente
     */
    private function callFifoGateway(array $payload): array
    {
        $result = figo_queue_bridge_result($payload);
        $response = $result['payload'] ?? [];

        if (isset($response['choices'][0]['message']['content'])) {
            return ['ok' => true, 'choices' => $response['choices'], 'usage' => $response['usage'] ?? null];
        }

        $errorCode = $response['errorCode'] ?? 'gateway_error';
        if ($errorCode === 'rate_limit_exceeded') {
            return ['ok' => false, 'error' => 'Rate limited', 'error_code' => 'rate_limit'];
        }
        return ['ok' => false, 'error' => $response['error'] ?? 'Gateway error', 'error_code' => $errorCode];
    }

    /**
     * Tier 3: Fallback heurístico local.
     * Sin LLM. Responde con plantillas predefinidas.
     * El médico ve un aviso de que está en modo offline/degradado.
     * NUNCA falla — siempre devuelve algo útil.
     */
    private function localHeuristicFallback(array $payload): array
    {
        $userMessage = '';
        foreach (array_reverse($payload['messages'] ?? []) as $msg) {
            if (($msg['role'] ?? '') === 'user') {
                $userMessage = (string) ($msg['content'] ?? '');
                break;
            }
        }

        // Basic pattern matching for most common clinical queries
        $response = $this->matchLocalPattern($userMessage);

        return [
            'ok' => true,
            'choices' => [[
                'message' => [
                    'role' => 'assistant',
                    'content' => $response,
                ],
                'finish_reason' => 'stop',
            ]],
            'provider_tier' => 'tier_3',
            'degraded_mode' => true,
            'degraded_notice' => self::LOCAL_OFFLINE_NOTICE,
            'offline_badge' => self::LOCAL_OFFLINE_BADGE,
            'offline_mode' => 'local_heuristic',
        ];
    }

    private function matchLocalPattern(string $query): string
    {
        $query = $this->normalizeLocalQuery($query);

        if ($this->isDiagnosticDifferentialPrompt($query)) {
            return $this->formatLocalTemplate(
                "### Plantilla offline de diagnóstico diferencial\n"
                . "- Morfología: mácula, pápula, placa, nódulo, vesícula, costra o descamación.\n"
                . "- Distribución: localizada/generalizada, unilateral/bilateral, flexuras, extensores o zonas fotoexpuestas.\n"
                . "- Síntomas clave: prurito, dolor, ardor, secreción, fiebre y tiempo de evolución.\n"
                . "- Diagnóstico diferencial inicial:\n"
                . "  - dermatitis de contacto o eczema\n"
                . "  - tiña o infección superficial\n"
                . "  - psoriasis o dermatitis seborreica\n"
                . "  - acné inflamatorio o foliculitis\n"
                . "  - urticaria o reacción medicamentosa\n"
                . "- Signos de alarma: compromiso mucoso, ampollas extensas, necrosis, dolor intenso o fiebre.\n"
                . "- Siguiente paso: correlacionar con examen físico, dermatoscopía y estudios dirigidos si aplica."
            );
        }

        if ($this->isPrescriptionPrompt($query)) {
            return $this->formatLocalTemplate(
                "### Plantilla offline de receta en blanco\n"
                . "- Medicamento:\n"
                . "- Presentación:\n"
                . "- Dosis:\n"
                . "- Vía:\n"
                . "- Frecuencia:\n"
                . "- Duración:\n"
                . "- Indicaciones al paciente:\n\n"
                . "Completa la plantilla y luego usa la receta digital del paciente para emitirla."
            );
        }

        if ($this->isCertificatePrompt($query)) {
            return $this->formatLocalTemplate(
                "Para emitir el certificado, usa el botón **Generar Certificado** del caso actual.\n"
                . "Mientras vuelve la IA puedes completar el motivo, los días de reposo y las indicaciones manualmente."
            );
        }

        // CIE-10 shortcuts
        if (str_contains($query, 'dermatitis atopica')) {
            return $this->formatLocalTemplate(
                "**L20 — Dermatitis atópica**\n"
                . "Primera línea: emolientes + hidrocortisona 1% tópica bid × 14 días.\n"
                . "Evitar jabones irritantes."
            );
        }
        if (str_contains($query, 'acné') || str_contains($query, 'acne')) {
            return $this->formatLocalTemplate(
                "**L70.0 — Acné vulgar**\n"
                . "Leve: peróxido de benzoilo 5% + adapaleno 0.1%.\n"
                . "Moderado: eritromicina tópica + gel peróxido.\n"
                . "Seguimiento: 8 semanas."
            );
        }
        if (str_contains($query, 'psoriasis')) {
            return $this->formatLocalTemplate(
                "**L40 — Psoriasis**\n"
                . "Placas leves: betametasona 0.05% + calcipotriol.\n"
                . "Fotobioterapia si >30% superficie corporal.\n"
                . "Derivación si requiere biológico."
            );
        }
        if (str_contains($query, 'urticaria')) {
            return $this->formatLocalTemplate(
                "**L50 — Urticaria**\n"
                . "Aguda: cetirizina 10mg/día. Si angioedema: adrenalina 0.3mg IM.\n"
                . "Crónica: loratadina 10mg + ranitidina 150mg bis."
            );
        }

        // Generic fallback
        return $this->formatLocalTemplate(
            "### OpenClaw en modo offline temporal\n"
            . "Funciones disponibles mientras vuelve la IA:\n"
            . "- Historia clínica manual\n"
            . "- Receta digital\n"
            . "- Certificados\n"
            . "- Botones clínicos del caso\n\n"
            . "Puedes continuar la consulta y registrar la decisión clínica manualmente."
        );
    }

    private function normalizeLocalQuery(string $query): string
    {
        $normalized = strtolower(trim($query));
        $normalized = strtr($normalized, [
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' => 'o',
            'ú' => 'u',
            'ü' => 'u',
            'ñ' => 'n',
        ]);
        $normalized = preg_replace('/\s+/', ' ', $normalized) ?? $normalized;
        return $normalized;
    }

    private function isDiagnosticDifferentialPrompt(string $query): bool
    {
        if (str_contains($query, 'diagnostico diferencial')) {
            return true;
        }

        $asksWhatItIs = str_contains($query, 'que es esto en la piel')
            || str_contains($query, 'que puede ser esto en la piel')
            || str_contains($query, 'que puede ser en la piel')
            || str_contains($query, 'que es esta lesion')
            || str_contains($query, 'que puede ser esta lesion');

        $mentionsSkinFinding = str_contains($query, 'piel')
            || str_contains($query, 'lesion')
            || str_contains($query, 'mancha')
            || str_contains($query, 'placa')
            || str_contains($query, 'roncha')
            || str_contains($query, 'rash')
            || str_contains($query, 'erupcion')
            || str_contains($query, 'sarpullido');

        $asksForDx = str_contains($query, 'diagnostico')
            || str_contains($query, 'diferencial')
            || str_contains($query, 'que es')
            || str_contains($query, 'que puede ser');

        return $asksWhatItIs || ($mentionsSkinFinding && $asksForDx);
    }

    private function isPrescriptionPrompt(string $query): bool
    {
        return str_contains($query, 'genera receta')
            || str_contains($query, 'genera una receta')
            || str_contains($query, 'hacer receta')
            || str_contains($query, 'prescripcion')
            || str_contains($query, 'receta en blanco')
            || str_contains($query, 'receta');
    }

    private function isCertificatePrompt(string $query): bool
    {
        return str_contains($query, 'genera certificado')
            || str_contains($query, 'generar certificado')
            || str_contains($query, 'certificado')
            || str_contains($query, 'reposo')
            || str_contains($query, 'constancia medica');
    }

    private function formatLocalTemplate(string $body): string
    {
        return trim($body) . "\n\n⚠️ *Plantilla offline local: confirma con criterio clínico y examen físico.*";
    }

    // ── Cooldown management ───────────────────────────────────────────────────

    private function setCooldown(string $provider, int $seconds): void
    {
        $state = $this->loadState();
        $state['cooldowns'][$provider] = time() + $seconds;
        $this->saveState($state);
    }

    private function clearCooldown(string $provider): void
    {
        $state = $this->loadState();
        unset($state['cooldowns'][$provider]);
        $this->saveState($state);
    }

    private function isInCooldown(string $provider): bool
    {
        $state = $this->loadState();
        $until = $state['cooldowns'][$provider] ?? 0;
        return time() < $until;
    }

    private function loadState(): array
    {
        if (!file_exists($this->statePath)) {
            return ['cooldowns' => [], 'last_errors' => []];
        }
        $decoded = @json_decode(file_get_contents($this->statePath), true);
        return is_array($decoded) ? $decoded : ['cooldowns' => [], 'last_errors' => []];
    }

    private function saveState(array $state): void
    {
        @file_put_contents($this->statePath, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    // ── Config helpers ────────────────────────────────────────────────────────

    private function resolveMode(): string
    {
        $mode = strtolower(trim((string) (getenv('OPENCLAW_ROUTER_MODE') ?: 'auto')));
        return in_array($mode, ['auto', 'codex_only', 'openrouter_only', 'local_only'], true) ? $mode : 'auto';
    }

    private function isCodexConfigured(): bool
    {
        return api_figo_env_gateway_endpoint() !== '' || getenv('OPENCLAW_CODEX_ENDPOINT') !== false;
    }

    private function isOpenRouterConfigured(): bool
    {
        return $this->getOpenRouterKey() !== '';
    }

    private function getOpenRouterKey(): string
    {
        return api_first_non_empty([
            getenv('OPENCLAW_OPENROUTER_KEY'),
            getenv('OPENROUTER_API_KEY'),
        ]);
    }

    private function getOpenRouterModel(): string
    {
        $configured = api_first_non_empty([
            getenv('OPENCLAW_OPENROUTER_MODEL'),
            getenv('OPENROUTER_MODEL'),
        ]);
        return 'openrouter:' . ($configured ?: self::OPENROUTER_MODEL_CHAIN[0]);
    }

    private function getTier(string $provider): string
    {
        if ($provider === 'codex_oauth' || $provider === 'figo_queue') return 'tier_1';
        if (str_starts_with($provider, 'openrouter:')) return 'tier_2';
        return 'tier_3';
    }
}
