<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
final class GiftCardControllerTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'gift-card-controller-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        foreach ([
            'PIELARMONIA_DATA_DIR' => $this->tempDir,
            'AURORADERM_DATA_DIR' => $this->tempDir,
            'PIELARMONIA_SKIP_ENV_FILE' => '1',
            'AURORADERM_SKIP_ENV_FILE' => '1',
        ] as $key => $value) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }

        $_GET = [];
        $_POST = [];
        $_SERVER['REQUEST_METHOD'] = 'GET';
        $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
        $_SERVER['HTTP_HOST'] = '127.0.0.1:8011';

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../lib/gift_cards/GiftCardService.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'AURORADERM_DATA_DIR',
            'PIELARMONIA_SKIP_ENV_FILE',
            'AURORADERM_SKIP_ENV_FILE',
        ] as $key) {
            putenv($key);
            unset($_ENV[$key], $_SERVER[$key]);
        }

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
    }

    public function testGiftCardIssueEndpointPersistsCodeAndQrData(): void
    {
        $response = $this->invokeIssueEndpoint([
            'amount' => 100,
            'recipient' => 'Paciente Demo',
            'sender' => 'Aurora Demo',
            'note' => 'Para tu siguiente consulta con calma.',
            'email' => 'paciente@example.com',
        ]);

        $this->assertSame(201, $response['status']);
        $this->assertTrue((bool) ($response['payload']['ok'] ?? false));

        $data = is_array($response['payload']['data'] ?? null) ? $response['payload']['data'] : [];
        $code = (string) ($data['code'] ?? '');
        $this->assertMatchesRegularExpression('/^AUR-GIFT-[A-F0-9]{8}$/', $code);
        $this->assertStringContainsString($code, (string) ($data['qrData'] ?? ''));
        $this->assertStringContainsString('api.qrserver.com', (string) ($data['qrImageUrl'] ?? ''));
        $this->assertSame(10000, (int) ($data['giftCard']['amount_cents'] ?? 0));
        $this->assertSame(10000, (int) ($data['giftCard']['balance_cents'] ?? 0));
        $this->assertSame('paciente@example.com', (string) ($data['giftCard']['recipient_email'] ?? ''));

        $store = \read_store();
        $this->assertArrayHasKey($code, $store['gift_cards'] ?? []);
        $this->assertSame('Aurora Demo', (string) ($store['gift_cards'][$code]['issuer_id'] ?? ''));
        $this->assertSame('Paciente Demo', (string) ($store['gift_cards'][$code]['recipient_name'] ?? ''));
    }

    public function testGiftCardServiceValidateAndRedeemTracksRemainingBalance(): void
    {
        $service = new \GiftCardService();
        $issue = $service->issue(
            \read_store(),
            18000,
            'Aurora Demo',
            'paciente@example.com',
            [
                'recipient_name' => 'Paciente Demo',
                'sender_name' => 'Aurora Demo',
            ]
        );

        $code = (string) ($issue['giftCard']['code'] ?? '');
        $validated = $service->validate($issue['store'], $code);
        $this->assertNotNull($validated);
        $this->assertSame(18000, (int) ($validated['balance_cents'] ?? 0));

        $partialRedeem = $service->redeem($issue['store'], $code, 2500, [
            'reference' => 'booking_checkout',
        ]);
        $this->assertTrue((bool) ($partialRedeem['ok'] ?? false));
        $this->assertSame(15500, (int) ($partialRedeem['giftCard']['balance_cents'] ?? 0));
        $this->assertSame('active', (string) ($partialRedeem['giftCard']['status'] ?? ''));

        $fullRedeem = $service->redeem($partialRedeem['store'], $code, 15500);
        $this->assertTrue((bool) ($fullRedeem['ok'] ?? false));
        $this->assertSame(0, (int) ($fullRedeem['giftCard']['balance_cents'] ?? 0));
        $this->assertSame('redeemed', (string) ($fullRedeem['giftCard']['status'] ?? ''));
        $this->assertNull($service->validate($fullRedeem['store'], $code));
    }

    public function testGiftCardValidateEndpointReturnsRemainingBalance(): void
    {
        $service = new \GiftCardService();
        $issue = $service->issue(
            \read_store(),
            12500,
            'Aurora Demo',
            'paciente@example.com',
            [
                'recipient_name' => 'Paciente Demo',
                'sender_name' => 'Aurora Demo',
            ]
        );
        \write_store($issue['store'], false);

        $code = (string) ($issue['giftCard']['code'] ?? '');
        $response = $this->invokeEndpoint('gift-card-validate', 'GET', [], [
            'code' => $code,
        ]);

        $this->assertSame(200, $response['status']);
        $this->assertTrue((bool) ($response['payload']['ok'] ?? false));
        $this->assertSame($code, (string) ($response['payload']['data']['code'] ?? ''));
        $this->assertSame(12500, (int) ($response['payload']['data']['balance_cents'] ?? 0));
        $this->assertSame('$125.00', (string) ($response['payload']['data']['balanceLabel'] ?? ''));
    }

    public function testGiftCardRedeemEndpointMarksAppointmentAsPaidWithGiftCard(): void
    {
        $service = new \GiftCardService();
        $issue = $service->issue(
            \read_store(),
            10000,
            'Aurora Demo',
            'paciente@example.com',
            [
                'recipient_name' => 'Paciente Demo',
                'sender_name' => 'Aurora Demo',
            ]
        );
        \write_store($issue['store'], false);
        $code = (string) ($issue['giftCard']['code'] ?? '');

        $store = \read_store();
        $store['appointments'][] = \normalize_appointment([
            'id' => 451,
            'service' => 'consulta',
            'doctor' => 'rosero',
            'date' => '2026-04-02',
            'time' => '10:00',
            'name' => 'Paciente Demo',
            'email' => 'paciente@example.com',
            'phone' => '0991234567',
            'privacyConsent' => true,
            'status' => 'confirmed',
            'paymentMethod' => 'cash',
            'paymentStatus' => 'pending_cash',
        ]);
        \write_store($store, false);

        $response = $this->invokeEndpoint('gift-card-redeem', 'POST', [
            'code' => $code,
            'appointmentId' => 451,
            'sessionId' => 'chs-gift-001',
            'caseId' => 'case-gift-001',
            'actor' => 'Dra. Aurora Demo',
        ]);

        $this->assertSame(200, $response['status']);
        $this->assertTrue((bool) ($response['payload']['ok'] ?? false));
        $this->assertSame(4000, (int) ($response['payload']['data']['amountCents'] ?? 0));
        $this->assertSame('gift_card', (string) ($response['payload']['data']['appointment']['paymentMethod'] ?? ''));
        $this->assertSame('paid', (string) ($response['payload']['data']['appointment']['paymentStatus'] ?? ''));

        $updatedStore = \read_store();
        $updatedAppointment = $updatedStore['appointments'][0] ?? [];
        $this->assertSame('gift_card', (string) ($updatedAppointment['paymentMethod'] ?? ''));
        $this->assertSame('paid', (string) ($updatedAppointment['paymentStatus'] ?? ''));
        $this->assertSame($code, (string) ($updatedAppointment['giftCardCode'] ?? ''));
        $this->assertSame(4000, (int) ($updatedAppointment['giftCardAppliedAmountCents'] ?? 0));
        $this->assertSame(6000, (int) ($updatedAppointment['giftCardBalanceCents'] ?? 0));
    }

    public function testGiftCardRedeemEndpointPreventsConcurrentDoubleUse(): void
    {
        $service = new \GiftCardService();
        $issue = $service->issue(
            \read_store(),
            4000,
            'Aurora Demo',
            'paciente@example.com',
            [
                'recipient_name' => 'Paciente Demo',
                'sender_name' => 'Aurora Demo',
            ]
        );
        \write_store($issue['store'], false);
        $code = (string) ($issue['giftCard']['code'] ?? '');

        $store = \read_store();
        $store['appointments'][] = \normalize_appointment([
            'id' => 777,
            'service' => 'consulta',
            'doctor' => 'rosero',
            'date' => '2026-04-03',
            'time' => '09:00',
            'name' => 'Paciente Doble',
            'email' => 'doble@example.com',
            'phone' => '0992223344',
            'privacyConsent' => true,
            'status' => 'confirmed',
            'paymentMethod' => 'cash',
            'paymentStatus' => 'pending_cash',
        ]);
        \write_store($store, false);

        $payload = [
            'code' => $code,
            'appointmentId' => 777,
            'sessionId' => 'chs-gift-concurrent',
            'caseId' => 'case-gift-concurrent',
            'actor' => 'Dra. Aurora Demo',
        ];

        $processA = $this->startEndpointProcess('gift-card-redeem', 'POST', $payload);
        $processB = $this->startEndpointProcess('gift-card-redeem', 'POST', $payload);

        $resultA = $this->finishEndpointProcess($processA);
        $resultB = $this->finishEndpointProcess($processB);

        $statuses = [$resultA['status'], $resultB['status']];
        sort($statuses);
        $this->assertSame([200, 409], $statuses);

        $updatedStore = \read_store();
        $updatedGiftCard = $updatedStore['gift_cards'][$code] ?? [];
        $updatedAppointment = $updatedStore['appointments'][0] ?? [];
        $this->assertSame('redeemed', (string) ($updatedGiftCard['status'] ?? ''));
        $this->assertSame(0, (int) ($updatedGiftCard['balance_cents'] ?? -1));
        $this->assertSame('gift_card', (string) ($updatedAppointment['paymentMethod'] ?? ''));
        $this->assertSame('paid', (string) ($updatedAppointment['paymentStatus'] ?? ''));
    }

    /**
     * @param array<string,mixed> $body
     * @param array<string,mixed> $query
     * @param array<string,mixed> $body
     * @return array{status:int,payload:array<string,mixed>,stdout:string,stderr:string}
     */
    private function invokeEndpoint(
        string $resource,
        string $method,
        array $body = [],
        array $query = []
    ): array
    {
        $handle = $this->startEndpointProcess($resource, $method, $body, $query);
        return $this->finishEndpointProcess($handle);
    }

    /**
     * @param array<string,mixed> $body
     * @return array{status:int,payload:array<string,mixed>,stdout:string,stderr:string}
     */
    private function invokeIssueEndpoint(array $body): array
    {
        return $this->invokeEndpoint('gift-card-issue', 'POST', $body);
    }

    /**
     * @param array<string,mixed> $body
     * @param array<string,mixed> $query
     * @return array{process:resource,pipes:array<int,resource>,runner:string}
     */
    private function startEndpointProcess(
        string $resource,
        string $method,
        array $body = [],
        array $query = []
    ): array {
        $sessionId = 'gift-card-test-' . bin2hex(random_bytes(6));
        $csrfToken = 'csrf-' . bin2hex(random_bytes(6));
        $runner = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'gift_card_api_runner_' . bin2hex(random_bytes(5)) . '.php';
        $script = sprintf(<<<'PHP'
<?php
$_SERVER['HTTP_X_CSRF_TOKEN'] = '%s';
session_id('%s');
session_start();
$_SESSION['admin_logged_in'] = true;
$_SESSION['csrf_token'] = '%s';
session_write_close();
session_id('%s');
$_SERVER['REQUEST_METHOD'] = $argv[1];
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_HOST'] = '127.0.0.1:8011';
$query = json_decode($argv[2], true);
$_GET = is_array($query) ? $query : [];
$_GET['resource'] = $argv[3];
$GLOBALS['__TEST_JSON_BODY'] = $argv[4] ?? '';
register_shutdown_function(static function (): void {
    $code = http_response_code();
    file_put_contents('php://stderr', 'HTTP_CODE:' . ($code ?: 200));
});
require 'api.php';
PHP,
            $csrfToken,
            $sessionId,
            $csrfToken,
            $sessionId
        );
        file_put_contents($runner, $script);

        $env = array_merge($_ENV, [
            'PIELARMONIA_DATA_DIR' => $this->tempDir,
            'AURORADERM_DATA_DIR' => $this->tempDir,
            'PIELARMONIA_SKIP_ENV_FILE' => '1',
            'AURORADERM_SKIP_ENV_FILE' => '1',
        ]);

        $process = proc_open(
            [
                PHP_BINARY,
                $runner,
                strtoupper($method),
                json_encode($query, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                $resource,
                json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ],
            [
                1 => ['pipe', 'w'],
                2 => ['pipe', 'w'],
            ],
            $pipes,
            dirname(__DIR__, 2),
            $env
        );

        if (!is_resource($process)) {
            @unlink($runner);
            $this->fail('No se pudo ejecutar api.php para GiftCardController.');
        }

        return [
            'process' => $process,
            'pipes' => $pipes,
            'runner' => $runner,
        ];
    }

    /**
     * @param array{process:resource,pipes:array<int,resource>,runner:string} $handle
     * @return array{status:int,payload:array<string,mixed>,stdout:string,stderr:string}
     */
    private function finishEndpointProcess(array $handle): array
    {
        $stdout = stream_get_contents($handle['pipes'][1]);
        $stderr = stream_get_contents($handle['pipes'][2]);
        fclose($handle['pipes'][1]);
        fclose($handle['pipes'][2]);
        proc_close($handle['process']);
        @unlink($handle['runner']);

        $status = 200;
        if (preg_match('/HTTP_CODE:(\d+)/', $stderr, $matches) === 1) {
            $status = (int) $matches[1];
        }

        $payload = json_decode($stdout, true);

        return [
            'status' => $status,
            'payload' => is_array($payload) ? $payload : [],
            'stdout' => is_string($stdout) ? $stdout : '',
            'stderr' => is_string($stderr) ? $stderr : '',
        ];
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $entries = array_diff(scandir($dir) ?: [], ['.', '..']);
        foreach ($entries as $entry) {
            $path = $dir . DIRECTORY_SEPARATOR . $entry;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                @unlink($path);
            }
        }

        @rmdir($dir);
    }
}
