<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/NotificationService.php';
require_once __DIR__ . '/../lib/PatientPortalAuth.php';

final class NotificationController
{
    public static function config(array $context): void
    {
        $session = self::requirePortalSession($context);
        $snapshot = is_array($session['snapshot'] ?? null) ? $session['snapshot'] : [];
        $service = new PushService();
        $criteria = NotificationService::subscriptionCriteriaForSnapshot($snapshot);
        $publicKey = $service->getPublicKey();

        json_response([
            'ok' => $publicKey !== '',
            'data' => [
                'configured' => $publicKey !== '',
                'publicKey' => $publicKey,
                'scope' => NotificationService::scope(),
                'subscribed' => $service->subscriptionsCount($criteria) > 0,
                'subscriptions' => $service->subscriptionsCount($criteria),
            ],
        ], $publicKey !== '' ? 200 : 503);
    }

    public static function subscribe(array $context): void
    {
        $session = self::requirePortalSession($context);
        $payload = require_json_body();
        $subscription = is_array($payload['subscription'] ?? null) ? $payload['subscription'] : [];
        $locale = trim((string) ($payload['locale'] ?? 'es'));

        $service = new PushService();
        $userAgent = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
        $snapshot = is_array($session['snapshot'] ?? null) ? $session['snapshot'] : [];
        $meta = NotificationService::subscriptionMetaForSnapshot($snapshot, $locale);

        if (!$service->subscribe($subscription, $userAgent, $meta)) {
            json_response([
                'ok' => false,
                'error' => 'Suscripcion invalida o no se pudo guardar',
            ], 400);
        }

        $criteria = NotificationService::subscriptionCriteriaForSnapshot($snapshot);
        json_response([
            'ok' => true,
            'data' => [
                'scope' => NotificationService::scope(),
                'subscribed' => true,
                'subscriptions' => $service->subscriptionsCount($criteria),
            ],
        ]);
    }

    public static function unsubscribe(array $context): void
    {
        $session = self::requirePortalSession($context);
        $payload = require_json_body();
        $endpoint = trim((string) ($payload['endpoint'] ?? ''));
        if ($endpoint === '') {
            json_response([
                'ok' => false,
                'error' => 'Endpoint requerido',
            ], 400);
        }

        $service = new PushService();
        $snapshot = is_array($session['snapshot'] ?? null) ? $session['snapshot'] : [];
        $criteria = NotificationService::subscriptionCriteriaForSnapshot($snapshot);

        if (!$service->unsubscribe($endpoint, $criteria)) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo desuscribir',
            ], 500);
        }

        json_response([
            'ok' => true,
            'data' => [
                'scope' => NotificationService::scope(),
                'subscribed' => false,
                'subscriptions' => $service->subscriptionsCount($criteria),
            ],
        ]);
    }

    private static function requirePortalSession(array $context): array
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : read_store();
        $token = PatientPortalAuth::bearerTokenFromRequest();
        $auth = PatientPortalAuth::authenticateSession($store, $token);
        if (($auth['ok'] ?? false) === true) {
            return is_array($auth['data'] ?? null) ? $auth['data'] : [];
        }

        json_response([
            'ok' => false,
            'error' => (string) ($auth['error'] ?? 'No autorizado'),
            'code' => (string) ($auth['code'] ?? 'patient_portal_auth_required'),
        ], (int) ($auth['status'] ?? 401));
    }
}
