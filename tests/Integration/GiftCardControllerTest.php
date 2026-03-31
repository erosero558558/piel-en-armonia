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

    /**
     * @param array<string,mixed> $body
     * @return array{status:int,payload:array<string,mixed>,stdout:string,stderr:string}
     */
    private function invokeIssueEndpoint(array $body): array
    {
        $runner = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'gift_card_issue_runner_' . bin2hex(random_bytes(5)) . '.php';
        $script = <<<'PHP'
<?php
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_HOST'] = '127.0.0.1:8011';
$_GET['resource'] = 'gift-card-issue';
$GLOBALS['__TEST_JSON_BODY'] = $argv[1];
register_shutdown_function(static function (): void {
    $code = http_response_code();
    file_put_contents('php://stderr', 'HTTP_CODE:' . ($code ?: 200));
});
require 'api.php';
PHP;
        file_put_contents($runner, $script);

        $env = array_merge($_ENV, [
            'PIELARMONIA_DATA_DIR' => $this->tempDir,
            'AURORADERM_DATA_DIR' => $this->tempDir,
            'PIELARMONIA_SKIP_ENV_FILE' => '1',
            'AURORADERM_SKIP_ENV_FILE' => '1',
        ]);

        $process = proc_open(
            [PHP_BINARY, $runner, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)],
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
            $this->fail('No se pudo ejecutar api.php para gift-card-issue.');
        }

        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($process);
        @unlink($runner);

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
