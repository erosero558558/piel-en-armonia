<?php
declare(strict_types=1);

namespace Tests\Unit\Auth;

use PHPUnit\Framework\TestCase;

// Include necessary files
require_once __DIR__ . '/../../../lib/auth.php';

class AuthSessionTest extends TestCase
{
    private string|false $originalPassword;
    private string|false $originalSecret;

    protected function setUp(): void
    {
        // Save original environment
        $this->originalPassword = getenv('PIELARMONIA_ADMIN_PASSWORD');
        $this->originalSecret = getenv('PIELARMONIA_ADMIN_2FA_SECRET');

        // Set test environment
        putenv('PIELARMONIA_ADMIN_PASSWORD=test_password');
        putenv('PIELARMONIA_ADMIN_2FA_SECRET=JBSWY3DPEHPK3PXP'); // Base32 secret
    }

    protected function tearDown(): void
    {
        // Restore environment
        if ($this->originalPassword !== false) {
            putenv("PIELARMONIA_ADMIN_PASSWORD={$this->originalPassword}");
        } else {
            putenv('PIELARMONIA_ADMIN_PASSWORD');
        }

        if ($this->originalSecret !== false) {
            putenv("PIELARMONIA_ADMIN_2FA_SECRET={$this->originalSecret}");
        } else {
            putenv('PIELARMONIA_ADMIN_2FA_SECRET');
        }
    }

    public function testVerifyAdminPassword(): void
    {
        $this->assertTrue(verify_admin_password('test_password'));
        $this->assertFalse(verify_admin_password('wrong_password'));
    }

    public function testVerify2FACode(): void
    {
        $secret = 'JBSWY3DPEHPK3PXP';
        $code = $this->generateValidTOTP($secret);

        $this->assertTrue(verify_2fa_code($code), "Valid code $code should be accepted");

        $invalidCode = '123456';
        if ($invalidCode === $code) {
            $invalidCode = '654321';
        }
        $this->assertFalse(verify_2fa_code($invalidCode), "Invalid code should be rejected");
    }

    /**
     * Helper to generate a valid TOTP code for testing.
     * Logic adapted from lib/totp.php private method getCode.
     */
    private function generateValidTOTP(string $secret): string
    {
        $timestamp = time();
        $period = 30;
        $digits = 6;

        $timeSlice = (int) floor($timestamp / $period);
        $timePacked = pack('N*', 0) . pack('N*', $timeSlice);

        $key = $this->base32Decode($secret);
        $hmac = hash_hmac('sha1', $timePacked, $key, true);
        $offset = ord($hmac[19]) & 0xf;
        $token = (
            ((ord($hmac[$offset+0]) & 0x7f) << 24) |
            ((ord($hmac[$offset+1]) & 0xff) << 16) |
            ((ord($hmac[$offset+2]) & 0xff) << 8) |
            (ord($hmac[$offset+3]) & 0xff)
        ) % 1000000;

        return str_pad((string)$token, $digits, '0', STR_PAD_LEFT);
    }

    private function base32Decode(string $base32): string
    {
        $base32 = strtoupper($base32);
        $l = strlen($base32);
        $n = 0;
        $j = 0;
        $binary = '';
        $map = array_flip(str_split('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'));

        for ($i = 0; $i < $l; $i++) {
            if (!isset($map[$base32[$i]])) continue;
            $n = $n << 5;
            $n = $n + $map[$base32[$i]];
            $j = $j + 5;
            if ($j >= 8) {
                $j = $j - 8;
                $binary .= chr(($n & (0xFF << $j)) >> $j);
            }
        }
        return $binary;
    }
}
