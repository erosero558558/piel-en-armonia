<?php

require_once __DIR__ . '/OpenclawController.php';

class OpenclawAiController
{
    public static function chat(array $context): void
        {
            OpenclawController::requireAuth();
    
            $payload = require_json_body();
    
            require_once __DIR__ . '/../lib/openclaw/AIRouter.php';
            $router = new OpenclawAIRouter();
            $result = $router->route($payload);
    
            if (!$result['ok']) {
                json_response([
                    'ok'    => false,
                    'error' => $result['error'] ?? 'Router error',
                    'mode'  => 'failed',
                ], 503);
            }
    
            $response = [
                'ok'           => true,
                'choices'      => $result['choices'],
                'provider'     => $result['provider_used'] ?? 'unknown',
                'tier'         => $result['provider_tier'] ?? 'unknown',
            ];
    
            if (!empty($result['degraded_mode'])) {
                $response['degraded']        = true;
                $response['degraded_notice'] = $result['degraded_notice'];
                $response['offline_badge']   = $result['offline_badge'] ?? '';
                $response['offline_mode']    = $result['offline_mode'] ?? 'local_heuristic';
            }
    
            json_response($response);
        }

    public static function cie10Suggest(array $context): void
        {
            OpenclawController::requireAuth();
    
            $q = strtolower(trim((string) ($_GET['q'] ?? '')));
            if (strlen($q) < 2) {
                json_response(['ok' => true, 'suggestions' => []]);
            }
    
            $cie10Path = __DIR__ . '/../data/cie10.json';
            if (!file_exists($cie10Path)) {
                json_response(['ok' => false, 'error' => 'Catálogo CIE-10 no disponible'], 503);
            }
    
            $data  = json_decode((string) file_get_contents($cie10Path), true) ?? [];
            $codes = $data['codes'] ?? [];
    
            $suggestions = [];
            $qWords      = explode(' ', $q);
    
            foreach ($codes as $code => $info) {
                $description = strtolower((string) ($info['d'] ?? ''));
                $category    = strtolower((string) ($info['c'] ?? ''));
                $codeL       = strtolower($code);
    
                $score = 0;
    
                // Exact code match
                if ($codeL === $q || str_starts_with($codeL, $q)) {
                    $score += 100;
                }
    
                // All words present in description
                $allFound = true;
                foreach ($qWords as $word) {
                    if (!str_contains($description, $word) && !str_contains($category, $word)) {
                        $allFound = false;
                        break;
                    }
                }
                if ($allFound && count($qWords) > 1) {
                    $score += 80;
                }
    
                // Partial word match
                foreach ($qWords as $word) {
                    if (str_contains($description, $word)) {
                        $score += 20;
                    }
                    if (str_contains($category, $word)) {
                        $score += 10;
                    }
                }
    
                if ($score > 0) {
                    $suggestions[] = [
                        'code'        => $code,
                        'description' => $info['d'],
                        'category'    => $info['c'],
                        'confidence'  => min(1.0, round($score / 100, 2)),
                    ];
                }
            }
    
            // Sort by confidence DESC
            usort($suggestions, static fn($a, $b) => $b['confidence'] <=> $a['confidence']);
    
            json_response([
                'ok'          => true,
                'suggestions' => array_slice($suggestions, 0, 8),
            ]);
        }

    public static function suggestCie10(array $context): void
        {
            OpenclawController::cie10Suggest($context);
        }

    public static function protocol(array $context): void
        {
            OpenclawController::requireAuth();
    
            $code = strtoupper(trim((string) ($_GET['code'] ?? '')));
            if ($code === '') {
                json_response(['ok' => false, 'error' => 'code requerido'], 400);
            }
    
            // Buscar protocolo específico
            $protocolPath = __DIR__ . '/../data/protocols/' . preg_replace('/[^A-Z0-9.]/', '', $code) . '.json';
            if (file_exists($protocolPath)) {
                $protocol = json_decode((string) file_get_contents($protocolPath), true) ?? [];
                json_response(['ok' => true] + $protocol);
            }
    
            // Protocolo genérico por categoría CIE-10
            $generic = OpenclawController::genericProtocol($code);
            json_response(['ok' => true] + $generic);
        }

    public static function getTreatmentProtocol(array $context): void
        {
            OpenclawController::protocol($context);
        }

}
