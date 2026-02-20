<?php
declare(strict_types=1);

namespace Tests\Unit\Security;

use PHPUnit\Framework\TestCase;

<<<<<<< HEAD
// Include necessary files
require_once __DIR__ . '/../../../lib/storage.php';
require_once __DIR__ . '/../../../lib/ratelimit.php';
=======
// Include the code under test
require_once __DIR__ . '/../../../lib/ratelimit.php';
// We also need storage.php because ratelimit uses data_dir_path()
require_once __DIR__ . '/../../../lib/storage.php';
>>>>>>> origin/test-coverage-and-refactor-17521770790336322433

class RateLimiterTest extends TestCase
{
    private string $tempDir;
<<<<<<< HEAD
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
=======

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
>>>>>>> origin/test-coverage-and-refactor-17521770790336322433
    }

    protected function tearDown(): void
    {
<<<<<<< HEAD
        // Restore environment variable
        if ($this->originalEnv !== false) {
            putenv("PIELARMONIA_DATA_DIR={$this->originalEnv}");
        } else {
            putenv('PIELARMONIA_DATA_DIR');
        }

        // Clean up temp directory
        $this->removeDirectory($this->tempDir);
=======
        // Cleanup
        $this->removeDirectory($this->tempDir);
        putenv('PIELARMONIA_DATA_DIR');
>>>>>>> origin/test-coverage-and-refactor-17521770790336322433
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
<<<<<<< HEAD
            $path = "$dir/$file";
            (is_dir($path)) ? $this->removeDirectory($path) : unlink($path);
=======
            $path = $dir . '/' . $file;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                unlink($path);
            }
>>>>>>> origin/test-coverage-and-refactor-17521770790336322433
        }
        rmdir($dir);
    }

<<<<<<< HEAD
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
=======
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
>>>>>>> origin/test-coverage-and-refactor-17521770790336322433
    }
}
