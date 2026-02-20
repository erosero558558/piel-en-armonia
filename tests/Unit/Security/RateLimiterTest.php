<?php
declare(strict_types=1);

namespace Tests\Unit\Security;

use PHPUnit\Framework\TestCase;

// Include necessary files
require_once __DIR__ . '/../../../lib/storage.php';
require_once __DIR__ . '/../../../lib/ratelimit.php';

class RateLimiterTest extends TestCase
{
    private string $tempDir;
    private string|false $originalEnv;

    protected function setUp(): void
    {
        // Create a unique temporary directory for this test run
        $this->tempDir = sys_get_temp_dir() . '/test_ratelimit_' . uniqid();
        if (!mkdir($this->tempDir, 0777, true)) {
            $this->markTestSkipped('Could not create temp directory');
        }

        // Save original environment variable
        $this->originalEnv = getenv('PIELARMONIA_DATA_DIR');

        // Set environment variable to point to temp dir
        putenv("PIELARMONIA_DATA_DIR={$this->tempDir}");
    }

    protected function tearDown(): void
    {
        // Restore environment variable
        if ($this->originalEnv !== false) {
            putenv("PIELARMONIA_DATA_DIR={$this->originalEnv}");
        } else {
            putenv('PIELARMONIA_DATA_DIR');
        }

        // Clean up temp directory
        $this->removeDirectory($this->tempDir);
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = "$dir/$file";
            (is_dir($path)) ? $this->removeDirectory($path) : unlink($path);
        }
        rmdir($dir);
    }

    public function testRateLimitKeyGeneration(): void
    {
        $action = 'login_attempt';
        $ip = '127.0.0.1';
        $key = rate_limit_key($action, $ip);

        $this->assertIsString($key);
        $this->assertEquals(32, strlen($key)); // MD5 hash length

        // Same inputs should produce same key
        $key2 = rate_limit_key($action, $ip);
        $this->assertEquals($key, $key2);

        // Different IP should produce different key
        $key3 = rate_limit_key($action, '192.168.1.1');
        $this->assertNotEquals($key, $key3);
    }

    public function testCheckRateLimitEnforcement(): void
    {
        $action = 'test_action_' . uniqid();
        $limit = 5;
        $window = 60;

        // Perform allowed requests
        for ($i = 0; $i < $limit; $i++) {
            $allowed = check_rate_limit($action, $limit, $window);
            $this->assertTrue($allowed, "Request $i should be allowed");
        }

        // Perform blocked request
        $blocked = check_rate_limit($action, $limit, $window);
        $this->assertFalse($blocked, "Request exceeding limit should be blocked");
    }

    public function testRateLimitReset(): void
    {
        $action = 'reset_test_' . uniqid();
        $limit = 1;
        $window = 60;

        // First request allowed
        $this->assertTrue(check_rate_limit($action, $limit, $window));

        // Second request blocked
        $this->assertFalse(check_rate_limit($action, $limit, $window));

        // Reset limit
        reset_rate_limit($action);

        // Should be allowed again
        $this->assertTrue(check_rate_limit($action, $limit, $window));
    }

    public function testIsRateLimitedCheckOnly(): void
    {
        $action = 'check_only_' . uniqid();
        $limit = 2;
        $window = 60;

        // Use check_rate_limit to increment count
        check_rate_limit($action, $limit, $window);
        check_rate_limit($action, $limit, $window); // Now at 2/2

        // check_rate_limit would return false next time and increment.
        // is_rate_limited should return true (blocked) without incrementing?
        // Let's verify behavior. is_rate_limited checks if count >= maxRequests.

        $this->assertTrue(is_rate_limited($action, $limit, $window));

        // It shouldn't increment, so let's verify count stays same if we could inspect file,
        // but functionally: calling is_rate_limited repeatedly should consistently return true.
        $this->assertTrue(is_rate_limited($action, $limit, $window));
    }
}
