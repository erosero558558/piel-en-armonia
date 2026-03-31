<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/promotions/PromotionEngine.php';

final class PromotionController
{
    public static function active(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $data = PromotionEngine::getActivePromotions($store, [
            'patient_id' => $_GET['patient_id'] ?? '',
            'name' => $_GET['name'] ?? '',
            'email' => $_GET['email'] ?? '',
            'phone' => $_GET['phone'] ?? '',
            'referral_code' => $_GET['referral_code'] ?? ($_GET['ref'] ?? ''),
        ]);

        json_response([
            'ok' => true,
            'data' => $data,
        ]);
    }

    public static function configGet(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        json_response([
            'ok' => true,
            'data' => PromotionEngine::getConfig($store),
        ]);
    }

    public static function configUpdate(array $context): void
    {
        require_admin_auth();

        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $payload = require_json_body();
        $result = PromotionEngine::updateConfig($store, is_array($payload) ? $payload : []);

        $nextStore = is_array($result['store'] ?? null) ? $result['store'] : $store;
        if (!write_store($nextStore, false)) {
            json_response(['ok' => false, 'error' => 'No se pudo guardar la configuración de promociones'], 500);
            return;
        }

        json_response([
            'ok' => true,
            'data' => $result['config'] ?? PromotionEngine::getConfig($nextStore),
        ]);
    }
}
