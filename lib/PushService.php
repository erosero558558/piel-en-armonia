<?php

declare(strict_types=1);

require_once __DIR__ . '/storage.php';

class PushService
{
    private const STORAGE_FILENAME = 'push-subscriptions.json';

    public function getPublicKey(): string
    {
        return (string) ($this->getVapidConfig()['publicKey'] ?? '');
    }

    public function isConfigured(): bool
    {
        $config = $this->getVapidConfig();
        return $config['publicKey'] !== '' && $config['privateKey'] !== '';
    }

    public function getDiagnostics(): array
    {
        $store = $this->readSubscriptions();
        $items = is_array($store['items'] ?? null) ? $store['items'] : [];
        $bySurface = [];

        foreach ($items as $item) {
            $channel = trim((string) ($item['channel'] ?? 'unknown'));
            if ($channel === '') {
                $channel = 'unknown';
            }
            $bySurface[$channel] = ($bySurface[$channel] ?? 0) + 1;
        }

        $metrics = $this->readMetrics();

        return [
            'configured' => $this->isConfigured(),
            'publicKeyPresent' => $this->getPublicKey() !== '',
            'subscriptionsTotal' => count($items),
            'subscriptionsBySurface' => $bySurface,
            'lastTestAt' => $metrics['lastTestAt'] ?? null,
            'lastSendStatus' => $metrics['lastSendStatus'] ?? null,
        ];
    }

    public function recordTestMetric(array $result): void
    {
        $metrics = $this->readMetrics();
        $metrics['lastTestAt'] = local_date('c');
        $metrics['lastSendStatus'] = ((int) ($result['success'] ?? 0)) > 0 ? 'success' : 'failed';
        $this->writeMetrics($metrics);
    }

    private function readMetrics(): array
    {
        $path = data_dir_path() . DIRECTORY_SEPARATOR . 'push-metrics.json';
        if (!is_file($path)) return [];
        $raw = @file_get_contents($path);
        if (!$raw) return [];
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function writeMetrics(array $data): void
    {
        $path = data_dir_path() . DIRECTORY_SEPARATOR . 'push-metrics.json';
        @file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT));
    }

    public function canSendNotifications(): bool
    {
        if ($this->hasTestTransport()) {
            return true;
        }

        return $this->isConfigured()
            && class_exists('\Minishlink\WebPush\WebPush')
            && class_exists('\Minishlink\WebPush\Subscription');
    }

    public function subscribe(array $subscription, string $userAgent = '', array $meta = []): bool
    {
        $normalized = $this->normalizeSubscription($subscription, $userAgent, $meta);
        if ($normalized === null) {
            return false;
        }

        $store = $this->readSubscriptions();
        $items = is_array($store['items'] ?? null) ? $store['items'] : [];
        $endpoint = $normalized['endpoint'];
        /** @psalm-suppress RedundantFunctionCall */
        $items = array_values(array_filter($items, static function ($item) use ($endpoint): bool {
            return (string) ($item['endpoint'] ?? '') !== $endpoint;
        }));
        $items[] = $normalized;

        $store['items'] = $items;
        $store['updatedAt'] = local_date('c');
        return $this->writeSubscriptions($store);
    }

    public function unsubscribe(string $endpoint, array $criteria = []): bool
    {
        $endpoint = trim($endpoint);
        if ($endpoint === '') {
            return false;
        }

        $store = $this->readSubscriptions();
        $items = is_array($store['items'] ?? null) ? $store['items'] : [];
        /** @psalm-suppress RedundantFunctionCall */
        $filtered = array_values(array_filter($items, function ($item) use ($endpoint, $criteria): bool {
            if ((string) ($item['endpoint'] ?? '') !== $endpoint) {
                return true;
            }

            return !$this->itemMatchesCriteria($item, $criteria);
        }));

        if (count($filtered) === count($items)) {
            return true;
        }

        $store['items'] = $filtered;
        $store['updatedAt'] = local_date('c');
        return $this->writeSubscriptions($store);
    }

    public function subscriptionsCount(array $criteria = []): int
    {
        return count($this->filterSubscriptions($criteria));
    }

    public function sendNotification(array $payload, array $criteria = []): array
    {
        $items = $this->filterSubscriptions($criteria);
        
        $category = (string)($payload['category'] ?? '');
        if ($category !== '') {
            if (!class_exists('PushPreferencesService')) {
                require_once __DIR__ . '/PushPreferencesService.php';
            }
            $prefsService = new PushPreferencesService();
            $items = array_values(array_filter($items, function($item) use ($prefsService, $category): bool {
                $patientId = trim((string)($item['patientId'] ?? ''));
                if ($patientId === '') {
                    return true;
                }
                return $prefsService->wants($patientId, $category);
            }));
        }

        if (count($items) === 0) {
            return [
                'success' => 0,
                'failed' => 0,
                'targeted' => 0,
                'errors' => ['No hay suscripciones activas']
            ];
        }

        if ($this->hasTestTransport()) {
            return $this->sendViaTestTransport($items, $payload, $criteria);
        }

        if (!$this->isConfigured()) {
            return [
                'success' => 0,
                'failed' => 0,
                'targeted' => count($items),
                'errors' => ['Push VAPID no configurado']
            ];
        }

        if (!class_exists('\Minishlink\WebPush\WebPush') || !class_exists('\Minishlink\WebPush\Subscription')) {
            return [
                'success' => 0,
                'failed' => 0,
                'targeted' => count($items),
                'errors' => ['Dependencia minishlink/web-push no instalada']
            ];
        }

        $auth = $this->getVapidConfig();
        $success = 0;
        $failed = 0;
        $errors = [];

        try {
            $webPush = new \Minishlink\WebPush\WebPush(['VAPID' => $auth]);

            $encodedPayload = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (!is_string($encodedPayload) || $encodedPayload === '') {
                $encodedPayload = '{"title":"Aurora Derm","body":"Nueva notificacion"}';
            }

            foreach ($items as $item) {
                $endpoint = (string) ($item['endpoint'] ?? '');
                $p256dh = (string) ($item['p256dh'] ?? '');
                $authKey = (string) ($item['auth'] ?? '');
                if ($endpoint === '' || $p256dh === '' || $authKey === '') {
                    continue;
                }

                $subscription = \Minishlink\WebPush\Subscription::create([
                    'endpoint' => $endpoint,
                    'keys' => [
                        'p256dh' => $p256dh,
                        'auth' => $authKey
                    ]
                ]);
                $webPush->queueNotification($subscription, $encodedPayload);
            }

            foreach ($webPush->flush() as $report) {
                $endpoint = (string) $report->getRequest()->getUri();
                if ($report->isSuccess()) {
                    $success++;
                    continue;
                }

                $failed++;
                $reason = trim((string) $report->getReason());
                $errors[] = ($reason !== '' ? $reason : 'Error enviando push') . ' [' . $endpoint . ']';

                if ($report->isSubscriptionExpired()) {
                    $this->unsubscribe($endpoint);
                }
            }
        } catch (Throwable $e) {
            $failed = count($items);
            $errors[] = $e->getMessage();
        }

        return [
            'success' => $success,
            'failed' => $failed,
            'targeted' => count($items),
            'errors' => $errors
        ];
    }

    private function getVapidConfig(): array
    {
        $publicKey = trim((string) (
            getenv('AURORADERM_VAPID_PUBLIC_KEY')
            ?: getenv('PIELARMONIA_VAPID_PUBLIC_KEY')
            ?: getenv('VAPID_PUBLIC_KEY')
            ?: ''
        ));
        $privateKey = trim((string) (
            getenv('AURORADERM_VAPID_PRIVATE_KEY')
            ?: getenv('PIELARMONIA_VAPID_PRIVATE_KEY')
            ?: getenv('VAPID_PRIVATE_KEY')
            ?: ''
        ));
        $subject = trim((string) (
            getenv('AURORADERM_VAPID_SUBJECT')
            ?: getenv('PIELARMONIA_VAPID_SUBJECT')
            ?: getenv('VAPID_SUBJECT')
            ?: 'mailto:admin@pielarmonia.com'
        ));

        return [
            'publicKey' => $publicKey,
            'privateKey' => $privateKey,
            'subject' => $subject !== '' ? $subject : 'mailto:admin@pielarmonia.com'
        ];
    }

    private function normalizeSubscription(array $subscription, string $userAgent, array $meta = []): ?array
    {
        $endpoint = trim((string) ($subscription['endpoint'] ?? ''));
        $keys = is_array($subscription['keys'] ?? null) ? $subscription['keys'] : [];
        $p256dh = trim((string) ($keys['p256dh'] ?? ''));
        $auth = trim((string) ($keys['auth'] ?? ''));

        if ($endpoint === '' || $p256dh === '' || $auth === '') {
            return null;
        }

        if (!preg_match('/^https?:\/\//i', $endpoint)) {
            return null;
        }

        return array_merge([
            'endpoint' => $endpoint,
            'p256dh' => $p256dh,
            'auth' => $auth,
            'userAgent' => substr(trim($userAgent), 0, 300),
            'updatedAt' => local_date('c')
        ], $this->normalizeMeta($meta));
    }

    private function normalizeMeta(array $meta): array
    {
        $channel = strtolower(trim((string) ($meta['channel'] ?? 'admin')));
        if (!in_array($channel, ['admin', 'patient_portal'], true)) {
            $channel = 'admin';
        }

        $locale = strtolower(trim((string) ($meta['locale'] ?? '')));
        if (!in_array($locale, ['es', 'en'], true)) {
            $locale = '';
        }

        $subject = trim((string) ($meta['subject'] ?? ''));
        $patientId = trim((string) ($meta['patientId'] ?? ''));
        $patientCaseId = trim((string) ($meta['patientCaseId'] ?? ''));
        $scope = trim((string) ($meta['scope'] ?? ''));
        $phone = preg_replace('/\D+/', '', (string) ($meta['phone'] ?? ''));
        if (!is_string($phone)) {
            $phone = '';
        }

        return [
            'channel' => substr($channel, 0, 40),
            'scope' => substr($scope, 0, 80),
            'subject' => substr($subject, 0, 120),
            'patientId' => substr($patientId, 0, 120),
            'patientCaseId' => substr($patientCaseId, 0, 120),
            'phone' => substr($phone, 0, 20),
            'locale' => $locale,
        ];
    }

    private function filterSubscriptions(array $criteria = []): array
    {
        $store = $this->readSubscriptions();
        $items = is_array($store['items'] ?? null) ? $store['items'] : [];
        return array_values(array_filter($items, function ($item) use ($criteria): bool {
            return $this->itemMatchesCriteria($item, $criteria);
        }));
    }

    private function itemMatchesCriteria(array $item, array $criteria): bool
    {
        foreach ($criteria as $key => $expected) {
            if ($expected === null || $expected === '' || $expected === []) {
                continue;
            }

            $actual = trim((string) ($item[$key] ?? ''));
            if (is_array($expected)) {
                $options = array_values(array_filter(array_map(static function ($value): string {
                    return trim((string) $value);
                }, $expected), static function (string $value): bool {
                    return $value !== '';
                }));
                if ($options === []) {
                    continue;
                }
                if (!in_array($actual, $options, true)) {
                    return false;
                }
                continue;
            }

            if ($actual !== trim((string) $expected)) {
                return false;
            }
        }

        return true;
    }

    private function hasTestTransport(): bool
    {
        return defined('TESTING_ENV')
            && isset($GLOBALS['__TEST_PUSH_TRANSPORT'])
            && is_callable($GLOBALS['__TEST_PUSH_TRANSPORT']);
    }

    private function sendViaTestTransport(array $items, array $payload, array $criteria): array
    {
        try {
            $callback = $GLOBALS['__TEST_PUSH_TRANSPORT'];
            $result = $callback($items, $payload, $criteria);
            if (!is_array($result)) {
                $result = [];
            }

            return [
                'success' => (int) ($result['success'] ?? count($items)),
                'failed' => (int) ($result['failed'] ?? 0),
                'targeted' => count($items),
                'errors' => is_array($result['errors'] ?? null) ? $result['errors'] : [],
            ];
        } catch (Throwable $error) {
            return [
                'success' => 0,
                'failed' => count($items),
                'targeted' => count($items),
                'errors' => [$error->getMessage()],
            ];
        }
    }

    private function storagePath(): string
    {
        return data_dir_path() . DIRECTORY_SEPARATOR . self::STORAGE_FILENAME;
    }

    private function readSubscriptions(): array
    {
        $path = $this->storagePath();
        if (!is_file($path)) {
            return [
                'items' => [],
                'updatedAt' => local_date('c')
            ];
        }

        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return [
                'items' => [],
                'updatedAt' => local_date('c')
            ];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [
                'items' => [],
                'updatedAt' => local_date('c')
            ];
        }

        return [
            'items' => is_array($decoded['items'] ?? null) ? $decoded['items'] : [],
            'updatedAt' => (string) ($decoded['updatedAt'] ?? local_date('c'))
        ];
    }

    private function writeSubscriptions(array $payload): bool
    {
        $path = $this->storagePath();
        $dir = dirname($path);
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            return false;
        }

        $encoded = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded) || trim($encoded) === '') {
            return false;
        }

        return @file_put_contents($path, $encoded . PHP_EOL, LOCK_EX) !== false;
    }
}
