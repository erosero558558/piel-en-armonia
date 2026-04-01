<?php

declare(strict_types=1);

require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../lib/promotions/PromotionEngine.php';

class PromotionController
{
    public static function getActivePromotions(array $context): void
    {
        $store = $context['store'];
        $promotions = $store['promotions'] ?? [];

        // Fallback default state if store's promotion array is missing or empty
        if (empty($promotions)) {
            $promotions = [
                [
                    'id' => 'promo-bienvenida',
                    'title' => 'Primera consulta',
                    'description' => '15% de beneficio en tu primera visita dermatológica',
                    'vigencia_start' => '2020-01-01',
                    'vigencia_end' => '2099-12-31',
                    'elegibilidad' => 'primera_vez',
                    'exclusiones' => ['miembro'],
                    'descuento' => '15%',
                    'is_active' => true
                ]
            ];
        }

        $ci = $_GET['ci'] ?? null;
        $patient = null;

        if ($ci) {
            // Attempt to build patient context based on CI
            // If they have appointments in store, they are not "primera_vez"
            // If they have membership ...
            $appointmentsCount = 0;
            $hasActiveMembership = false;
            
            if (isset($store['appointments']) && is_array($store['appointments'])) {
                foreach ($store['appointments'] as $appt) {
                    if (isset($appt['ci']) && $appt['ci'] === $ci) {
                        $appointmentsCount++;
                    }
                }
            }

            // Mocking Membership - since Membership is normally checked via Package balance/status
            // We'll rely on a basic check if needed or just use appointmentsCount.
            // If we've integrated MembershipController logic, we'd check it here.

            $patient = [
                'ci' => $ci,
                'appointments_count' => $appointmentsCount,
                'has_active_membership' => $hasActiveMembership
            ];
        }

        $activePromos = PromotionEngine::evaluatePromotions($promotions, $patient);

        json_response([
            'ok' => true,
            'promotions' => $activePromos
        ]);
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:active-promotions':
                self::getActivePromotions($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'getActivePromotions':
                            self::getActivePromotions($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
