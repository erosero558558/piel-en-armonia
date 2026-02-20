<?php
declare(strict_types=1);

namespace Tests\Unit\Security;

use PHPUnit\Framework\TestCase;

// Include the code under test
require_once __DIR__ . '/../../../lib/ratelimit.php';
// We also need storage.php because ratelimit uses data_dir_path()
require_once __DIR__ . '/../../../lib/storage.php';

class RateLimiterTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        // Create a temporary directory for rate limit data
        $this->tempDir = sys_get_temp_dir() . '/pielarmonia_test_ratelimit_' . bin2hex(random_bytes(8));
        if (!mkdir($this->tempDir, 0777, true) && !is_dir($this->tempDir)) {
            $this->fail('Could not create temp dir: ' . $this->tempDir);
        }

        // Force storage.php to use this directory
        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);

        // Reset resolved directory cache if possible, but data_dir_path uses a static variable in resolve_data_dir
        // resolve_data_dir has static $resolved.
        // If it was already called, we are in trouble.
        // But in a fresh PHPUnit process, it should be fine.
        // However, PHPUnit runs tests in the same process usually.
        // We might need to use reflection to reset the static variable or run in separate process.
        // Let's rely on @runInSeparateProcess for this test class or methods.
    }

    protected function tearDown(): void
    {
        // Cleanup
        $this->removeDirectory($this->tempDir);
        putenv('PIELARMONIA_DATA_DIR');
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                unlink($path);
            }
        }
        rmdir($dir);
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testCheckRateLimitAllowsWithinLimit(): void
    {
        $action = 'test_action';
        $max = 5;
        $window = 60;

        // First 5 requests should be allowed
        for ($i = 0; $i < $max; $i++) {
            $this->assertTrue(check_rate_limit($action, $max, $window), "Request $i should be allowed");
        }

        // 6th request should be denied
        $this->assertFalse(check_rate_limit($action, $max, $window), "Request 6 should be denied");
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testIsRateLimitedDoesNotIncrement(): void
    {
        $action = 'test_check';
        $max = 2;
        $window = 60;

        // Perform 2 requests to reach limit
        check_rate_limit($action, $max, $window);
        check_rate_limit($action, $max, $window);

        // is_rate_limited should return true (limit reached)
        $this->assertTrue(is_rate_limited($action, $max, $window));

        // It should NOT increment, so calling it again should still be true (and count remains 2)
        // If we increase max to 3, check_rate_limit should pass.
        $this->assertTrue(check_rate_limit($action, 3, $window));
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testResetRateLimit(): void
    {
        $action = 'test_reset';
        $max = 1;
        $window = 60;

        check_rate_limit($action, $max, $window);
        $this->assertFalse(check_rate_limit($action, $max, $window));

        reset_rate_limit($action);

        $this->assertTrue(check_rate_limit($action, $max, $window), "Should be allowed after reset");
    }
}
