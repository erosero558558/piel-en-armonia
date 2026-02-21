<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/PushService.php';

class PushController
{
    private static function getService(): PushService
    {
        static $service = null;
        if ($service === null) {
            $service = new PushService();
        }
        return $service;
    }

    public static function config(array $context): void
    {
        $service = self::getService();
        $publicKey = $service->getPublicKey();

        if ($publicKey) {
            json_response(['ok' => true, 'publicKey' => $publicKey]);
        } else {
            json_response(['ok' => false, 'error' => 'Push service not configured'], 503);
        }
    }

    public static function subscribe(array $context): void
    {
        $data = require_json_body();

        if (empty($data['subscription']) || empty($data['subscription']['endpoint'])) {
            json_response(['ok' => false, 'error' => 'Invalid subscription data'], 400);
        }

        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';

        $service = self::getService();
        if ($service->subscribe($data['subscription'], $userAgent)) {
            json_response(['ok' => true, 'message' => 'Subscribed successfully']);
        } else {
            json_response(['ok' => false, 'error' => 'Failed to subscribe'], 500);
        }
    }

    public static function unsubscribe(array $context): void
    {
        $data = require_json_body();

        if (empty($data['endpoint'])) {
            json_response(['ok' => false, 'error' => 'Endpoint required'], 400);
        }

        $service = self::getService();
        if ($service->unsubscribe($data['endpoint'])) {
            json_response(['ok' => true, 'message' => 'Unsubscribed successfully']);
        } else {
            json_response(['ok' => false, 'error' => 'Failed to unsubscribe'], 500);
        }
    }

    public static function test(array $context): void
    {
        // Admin only check is handled by ApiKernel if endpoint is not public.
        // But double check just in case.
        if (!$context['isAdmin']) {
             json_response(['ok' => false, 'error' => 'Unauthorized'], 401);
        }

        $service = self::getService();
        $payload = json_encode([
            'title' => 'Test Notification',
            'body' => 'This is a test notification from Piel en Armonía Admin.',
            'url' => '/admin.html'
        ]);

        $result = $service->sendNotification($payload);

        json_response([
            'ok' => true,
            'result' => $result
        ]);
    }
}
