<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/storage.php';

use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

class PushService
{
    private $webPush;
    private $auth;

    public function __construct()
    {
        $this->auth = $this->getVapidKeys();
        if ($this->auth) {
            try {
                $this->webPush = new WebPush(['VAPID' => $this->auth]);
            } catch (Exception $e) {
                error_log('PushService Init Error: ' . $e->getMessage());
                $this->webPush = null;
            }
        }
    }

    public function getPublicKey(): ?string
    {
        return $this->auth['publicKey'] ?? null;
    }

    private function getVapidKeys(): ?array
    {
        // Try Environment Variables
        $publicKey = getenv('VAPID_PUBLIC_KEY');
        $privateKey = getenv('VAPID_PRIVATE_KEY');
        $subject = getenv('VAPID_SUBJECT') ?: 'mailto:admin@pielarmonia.com';

        if ($publicKey && $privateKey) {
            return [
                'subject' => $subject,
                'publicKey' => $publicKey,
                'privateKey' => $privateKey,
            ];
        }

        // Try Database (kv_store)
        $pdo = get_db_connection(data_file_path());
        if (!$pdo) return null;

        $stmt = $pdo->prepare("SELECT value FROM kv_store WHERE key = ?");
        $stmt->execute(['vapid_public_key']);
        $dbPublicKey = $stmt->fetchColumn();

        $stmt->execute(['vapid_private_key']);
        $dbPrivateKey = $stmt->fetchColumn();

        if ($dbPublicKey && $dbPrivateKey) {
            return [
                'subject' => $subject,
                'publicKey' => $dbPublicKey,
                'privateKey' => $dbPrivateKey,
            ];
        }

        // Generate new keys if none exist
        try {
            $keys = \Minishlink\WebPush\VAPID::createVapidKeys();

            $stmt = $pdo->prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)");
            $stmt->execute(['vapid_public_key', $keys['publicKey']]);
            $stmt->execute(['vapid_private_key', $keys['privateKey']]);

            return [
                'subject' => $subject,
                'publicKey' => $keys['publicKey'],
                'privateKey' => $keys['privateKey'],
            ];
        } catch (Exception $e) {
            error_log('VAPID Key Generation Error: ' . $e->getMessage());
            return null;
        }
    }

    public function subscribe(array $subscription, string $userAgent = ''): bool
    {
        if (empty($subscription['endpoint'])) {
            return false;
        }

        $endpoint = $subscription['endpoint'];
        $keys = json_encode($subscription['keys'] ?? [], JSON_UNESCAPED_UNICODE);

        $pdo = get_db_connection(data_file_path());
        if (!$pdo) return false;

        try {
            $stmt = $pdo->prepare("INSERT OR REPLACE INTO push_subscriptions (endpoint, keys, user_agent) VALUES (?, ?, ?)");
            $stmt->execute([$endpoint, $keys, $userAgent]);
            return true;
        } catch (PDOException $e) {
            error_log('Push Subscribe Error: ' . $e->getMessage());
            return false;
        }
    }

    public function unsubscribe(string $endpoint): bool
    {
        $pdo = get_db_connection(data_file_path());
        if (!$pdo) return false;

        try {
            $stmt = $pdo->prepare("DELETE FROM push_subscriptions WHERE endpoint = ?");
            $stmt->execute([$endpoint]);
            return true;
        } catch (PDOException $e) {
            error_log('Push Unsubscribe Error: ' . $e->getMessage());
            return false;
        }
    }

    public function sendNotification(string $payload, ?array $subscriptions = null): array
    {
        if (!$this->webPush) {
            return ['success' => 0, 'failed' => 0, 'errors' => ['WebPush not initialized']];
        }

        $pdo = get_db_connection(data_file_path());
        if (!$pdo) return ['success' => 0, 'failed' => 0, 'errors' => ['DB Connection failed']];

        if ($subscriptions === null) {
            // Broadcast to all
            $stmt = $pdo->query("SELECT endpoint, keys FROM push_subscriptions");
            $rows = $stmt->fetchAll();
        } else {
            // Send to specific subscriptions (not implemented fully for simplicity, assumes all if null)
            $rows = $subscriptions;
        }

        $success = 0;
        $failed = 0;
        $errors = [];

        foreach ($rows as $row) {
            $keys = json_decode($row['keys'], true);
            $subscription = Subscription::create([
                'endpoint' => $row['endpoint'],
                'keys' => [
                    'p256dh' => $keys['p256dh'] ?? null,
                    'auth' => $keys['auth'] ?? null
                ],
            ]);

            $this->webPush->queueNotification($subscription, $payload);
        }

        foreach ($this->webPush->flush() as $report) {
            $endpoint = $report->getRequest()->getUri()->__toString();

            if ($report->isSuccess()) {
                $success++;
            } else {
                $failed++;
                $errors[] = "Message failed to send for subscription {$endpoint}: {$report->getReason()}";

                // Remove expired subscriptions
                if ($report->isSubscriptionExpired()) {
                    $this->unsubscribe($endpoint);
                }
            }
        }

        return ['success' => $success, 'failed' => $failed, 'errors' => $errors];
    }
}
