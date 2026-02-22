<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/PushService.php';

class PushController
{
    public static function config(array $context): void
    {
        self::ensureAdmin($context);

        $service = new PushService();
        $publicKey = $service->getPublicKey();

        json_response([
            'ok' => $publicKey !== '',
            'publicKey' => $publicKey,
            'configured' => $service->isConfigured(),
            'subscriptions' => $service->subscriptionsCount(),
        ], $publicKey !== '' ? 200 : 503);
    }

    public static function subscribe(array $context): void
    {
        self::ensureAdmin($context);

        $payload = require_json_body();
        $subscription = is_array($payload['subscription'] ?? null) ? $payload['subscription'] : [];
        $userAgent = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');

        $service = new PushService();
        if (!$service->subscribe($subscription, $userAgent)) {
            json_response([
                'ok' => false,
                'error' => 'Suscripcion invalida o no se pudo guardar'
            ], 400);
        }

        json_response([
            'ok' => true,
            'subscriptions' => $service->subscriptionsCount()
        ]);
    }

    public static function unsubscribe(array $context): void
    {
        self::ensureAdmin($context);

        $payload = require_json_body();
        $endpoint = trim((string) ($payload['endpoint'] ?? ''));
        if ($endpoint === '') {
            json_response([
                'ok' => false,
                'error' => 'Endpoint requerido'
            ], 400);
        }

        $service = new PushService();
        if (!$service->unsubscribe($endpoint)) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo desuscribir'
            ], 500);
        }

        json_response([
            'ok' => true,
            'subscriptions' => $service->subscriptionsCount()
        ]);
    }

    public static function test(array $context): void
    {
        self::ensureAdmin($context);

        $payload = [
            'title' => 'Piel en Armonia',
            'body' => 'Notificacion de prueba desde el panel admin.',
            'url' => '/admin.html',
            'timestamp' => local_date('c')
        ];

        $service = new PushService();
        $result = $service->sendNotification($payload);

        json_response([
            'ok' => true,
            'result' => $result
        ]);
    }

    private static function ensureAdmin(array $context): void
    {
        if (($context['isAdmin'] ?? false) === true) {
            return;
        }

        json_response([
            'ok' => false,
            'error' => 'No autorizado'
        ], 401);
    }
}
