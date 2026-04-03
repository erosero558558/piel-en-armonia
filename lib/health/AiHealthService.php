<?php

declare(strict_types=1);

final class AiHealthService
{
public static function collectAiRouterSnapshot(): array
    {
        $status = [
            'router_mode' => 'unknown',
            'active_provider' => 'local_heuristic',
            'active_tier' => 'tier_3',
            'degraded' => false,
            'providers' => [],
            'last_updated' => gmdate('c'),
        ];

        if (class_exists('OpenclawAIRouter')) {
            $routerStatus = (new OpenclawAIRouter())->getStatus();
            if (is_array($routerStatus)) {
                $status = array_merge($status, $routerStatus);
            }
        }

        $providers = is_array($status['providers'] ?? null) ? array_values($status['providers']) : [];
        $codexProvider = self::findAiProviderSnapshot($providers, static fn(array $provider): bool => (string) ($provider['provider'] ?? '') === 'codex_oauth');
        $openRouterProviders = array_values(array_filter(
            $providers,
            static fn(array $provider): bool => str_starts_with((string) ($provider['provider'] ?? ''), 'openrouter:')
        ));
        $localProvider = self::findAiProviderSnapshot($providers, static fn(array $provider): bool => (string) ($provider['provider'] ?? '') === 'local_heuristic');

        return [
            'ok' => true,
            'router_mode' => (string) ($status['router_mode'] ?? 'unknown'),
            'active_provider' => (string) ($status['active_provider'] ?? 'local_heuristic'),
            'active_tier' => (string) ($status['active_tier'] ?? 'tier_3'),
            'degraded' => (bool) ($status['degraded'] ?? false),
            'last_updated' => (string) ($status['last_updated'] ?? gmdate('c')),
            'tiers' => [
                'codex' => [
                    'available' => self::isAiCodexConfigured(),
                    'active' => (bool) ($codexProvider['active'] ?? false),
                    'cooldown_remaining_seconds' => (int) ($codexProvider['cooldown_remaining_seconds'] ?? 0),
                ],
                'openrouter' => [
                    'available' => self::isAiOpenRouterConfigured(),
                    'active' => self::anyAiProviderActive($openRouterProviders),
                    'providers_configured' => count($openRouterProviders),
                    'cooldown_remaining_seconds' => self::maxAiProviderCooldown($openRouterProviders),
                ],
                'local' => [
                    'available' => true,
                    'active' => (bool) ($localProvider['active'] ?? false),
                    'cooldown_remaining_seconds' => (int) ($localProvider['cooldown_remaining_seconds'] ?? 0),
                ],
            ],
            'providers' => $providers,
        ];
    }

public static function publicAiRouterSummary(array $snapshot): array
    {
        return [
            'ok' => (bool) ($snapshot['ok'] ?? false),
            'router_mode' => (string) ($snapshot['router_mode'] ?? 'unknown'),
            'active_provider' => (string) ($snapshot['active_provider'] ?? 'local_heuristic'),
            'active_tier' => (string) ($snapshot['active_tier'] ?? 'tier_3'),
            'degraded' => (bool) ($snapshot['degraded'] ?? false),
            'codex' => self::publicAiTierSummary($snapshot['tiers']['codex'] ?? null),
            'openrouter' => self::publicAiTierSummary($snapshot['tiers']['openrouter'] ?? null),
            'local' => self::publicAiTierSummary($snapshot['tiers']['local'] ?? null),
        ];
    }

public static function publicAiTierSummary($raw): array
    {
        if (!is_array($raw)) {
            return [
                'available' => false,
                'active' => false,
            ];
        }

        $payload = [
            'available' => (bool) ($raw['available'] ?? false),
            'active' => (bool) ($raw['active'] ?? false),
        ];

        if (array_key_exists('providers_configured', $raw)) {
            $payload['providers_configured'] = (int) ($raw['providers_configured'] ?? 0);
        }

        return $payload;
    }

public static function findAiProviderSnapshot(array $providers, callable $matcher): array
    {
        foreach ($providers as $provider) {
            if (is_array($provider) && $matcher($provider)) {
                return $provider;
            }
        }

        return [];
    }

public static function anyAiProviderActive(array $providers): bool
    {
        foreach ($providers as $provider) {
            if ((bool) ($provider['active'] ?? false)) {
                return true;
            }
        }

        return false;
    }

public static function maxAiProviderCooldown(array $providers): int
    {
        $max = 0;
        foreach ($providers as $provider) {
            $max = max($max, (int) ($provider['cooldown_remaining_seconds'] ?? 0));
        }

        return $max;
    }

public static function isAiCodexConfigured(): bool
    {
        return api_figo_env_gateway_endpoint() !== '' || trim((string) (getenv('OPENCLAW_CODEX_ENDPOINT') ?: '')) !== '';
    }

public static function isAiOpenRouterConfigured(): bool
    {
        return api_first_non_empty([
            getenv('OPENCLAW_OPENROUTER_KEY'),
            getenv('OPENROUTER_API_KEY'),
        ]) !== '';
    }

}
