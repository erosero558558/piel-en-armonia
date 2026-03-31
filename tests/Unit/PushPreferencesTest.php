<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../lib/PushPreferencesService.php';
require_once __DIR__ . '/../../lib/PushService.php';

use PHPUnit\Framework\TestCase;

class PushPreferencesTest extends TestCase
{
    private string $originalDataDir;
    private string $testDataDir;

    protected function setUp(): void
    {
        $this->originalDataDir = data_dir_path();
        $this->testDataDir = sys_get_temp_dir() . '/ad_test_push_prefs_' . uniqid();
        mkdir($this->testDataDir, 0777, true);
        
        $GLOBALS['__OVERRIDE_DATA_DIR'] = $this->testDataDir;

        // Custom transport to capture calls without sending
        $GLOBALS['__TEST_PUSH_TRANSPORT'] = function ($items, $payload, $criteria) {
            return [
                'success' => count($items),
                'failed' => 0,
                'errors' => []
            ];
        };
        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }
    }

    protected function tearDown(): void
    {
        unset($GLOBALS['__OVERRIDE_DATA_DIR']);
        unset($GLOBALS['__TEST_PUSH_TRANSPORT']);
        $this->removeDir($this->testDataDir);
    }

    private function removeDir(string $dir): void
    {
        if (!is_dir($dir)) return;
        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = "$dir/$file";
            is_dir($path) ? $this->removeDir($path) : unlink($path);
        }
        rmdir($dir);
    }

    public function testStoreAndReadPreferences(): void
    {
        $service = new PushPreferencesService();
        $patientId = 'pat_' . uniqid();

        // Check defaults
        $prefs = $service->getPreferences($patientId);
        $this->assertTrue($prefs['appointments']);
        $this->assertTrue($prefs['queue_updates']);
        $this->assertFalse($prefs['marketing']);

        // Update prefs
        $success = $service->setPreferences($patientId, ['queue_updates' => false, 'marketing' => true]);
        $this->assertTrue($success);

        // Check updated
        $updated = $service->getPreferences($patientId);
        $this->assertTrue($updated['appointments']);
        $this->assertFalse($updated['queue_updates']);
        $this->assertTrue($updated['marketing']);

        // Check wants
        $this->assertFalse($service->wants($patientId, 'queue_updates'));
        $this->assertTrue($service->wants($patientId, 'marketing'));
        $this->assertTrue($service->wants($patientId, 'appointments'));
    }

    public function testPushServiceFiltersOutExcludedCategories(): void
    {
        $patientId = 'pat_' . uniqid();
        $prefs = new PushPreferencesService();
        $prefs->setPreferences($patientId, ['queue_updates' => false]);

        $push = new PushService();
        
        // Arrange manual subscription
        $sub = [
            'endpoint' => 'http://test.local/push',
            'keys' => ['p256dh' => 'foo', 'auth' => 'bar']
        ];
        $push->subscribe($sub, 'test-agent', ['patientId' => $patientId]);

        // Attempt to send queue update
        $payloadQ = ['category' => 'queue_updates', 'title' => 'Test'];
        $resultQ = $push->sendNotification($payloadQ);

        // Targeted should be 0 because it's filtered out
        $this->assertEquals(0, $resultQ['targeted'], 'Siguiente push de turno debe omitirse si queue_updates es false');

        // Attempt to send appointment update
        $payloadA = ['category' => 'appointments', 'title' => 'Test'];
        $resultA = $push->sendNotification($payloadA);

        // Targeted should be 1 because it's not filtered out
        $this->assertEquals(1, $resultA['targeted']);
    }
}
