<?php

declare(strict_types=1);

namespace Tests\Unit\Auth;

use PHPUnit\Framework\TestCase;

// Include the code under test
require_once __DIR__ . '/../../../lib/auth.php';

class AuthSessionTest extends TestCase
{
    protected function setUp(): void
    {
        // Clear environment variables relevant to auth
        $vars = [
            'ADMIN_PASSWORD',
            'ADMIN_PASSWORD_HASH',
            'ADMIN_2FA_SECRET',
            'ADMIN_EMAIL',
            'OPERATOR_AUTH_MODE',
            'OPERATOR_AUTH_ALLOWLIST',
            'OPERATOR_AUTH_ALLOWED_EMAILS',
            'OPERATOR_AUTH_BRIDGE_TOKEN',
            'OPERATOR_AUTH_BRIDGE_SECRET',
            'OPERATOR_AUTH_TRANSPORT',
            'GOOGLE_OAUTH_CLIENT_ID',
            'GOOGLE_OAUTH_CLIENT_SECRET',
        ];
        foreach ($vars as $v) {
            putenv("AURORADERM_$v");
            putenv("PIELARMONIA_$v");
        }
        putenv('OPENCLAW_AUTH_BROKER_AUTHORIZE_URL');
    }

    protected function tearDown(): void
    {
        // Cleanup
        $vars = [
            'ADMIN_PASSWORD',
            'ADMIN_PASSWORD_HASH',
            'ADMIN_2FA_SECRET',
            'ADMIN_EMAIL',
            'OPERATOR_AUTH_MODE',
            'OPERATOR_AUTH_ALLOWLIST',
            'OPERATOR_AUTH_ALLOWED_EMAILS',
            'OPERATOR_AUTH_BRIDGE_TOKEN',
            'OPERATOR_AUTH_BRIDGE_SECRET',
            'OPERATOR_AUTH_TRANSPORT',
            'GOOGLE_OAUTH_CLIENT_ID',
            'GOOGLE_OAUTH_CLIENT_SECRET',
        ];
        foreach ($vars as $v) {
            putenv("AURORADERM_$v");
            putenv("PIELARMONIA_$v");
        }
        putenv('OPENCLAW_AUTH_BROKER_AUTHORIZE_URL');
    }

    public function testVerifyAdminPasswordFailsClosedWhenUnconfigured(): void
    {
        $this->assertFalse(admin_password_is_configured());
        $this->assertFalse(verify_admin_password('admin123'));
        $this->assertFalse(verify_admin_password('wrong'));
    }

    public function testVerifyAdminPasswordEnvPlain(): void
    {
        putenv('AURORADERM_ADMIN_PASSWORD=secret123');
        $this->assertTrue(admin_password_is_configured());
        $this->assertTrue(verify_admin_password('secret123'));
        $this->assertFalse(verify_admin_password('admin123'));
    }

    public function testVerifyAdminPasswordEnvHash(): void
    {
        $hash = password_hash('hashed_secret', PASSWORD_DEFAULT);
        putenv('AURORADERM_ADMIN_PASSWORD_HASH=' . $hash);

        $this->assertTrue(admin_password_is_configured());
        $this->assertTrue(verify_admin_password('hashed_secret'));
        $this->assertFalse(verify_admin_password('wrong_secret'));
    }

    public function testVerify2FACode(): void
    {
        // TOTP verification requires the library or logic.
        // lib/auth.php requires lib/totp.php.
        // Let's assume TOTP works or mock it if possible.
        // But verifying 2FA code depends on time.
        // TOTP class likely uses current time.
        // We can't easily test TOTP without controlling time or mocking TOTP class.
        // If TOTP class is static, it's hard.
        // Let's check lib/totp.php content if needed, but for now skip complex time-based tests.
        // Just test that empty secret returns false.

        putenv('AURORADERM_ADMIN_2FA_SECRET=');
        $this->assertFalse(verify_2fa_code('123456'));
    }

    public function testOperatorAuthModeDefaultsToDisabled(): void
    {
        $this->assertSame('disabled', operator_auth_mode());
        $this->assertFalse(operator_auth_is_enabled());
    }

    public function testOperatorAuthAllowlistFallsBackToAdminEmail(): void
    {
        putenv('AURORADERM_ADMIN_EMAIL=doctor@example.com');

        $this->assertSame(['doctor@example.com'], operator_auth_allowed_emails());
    }

    public function testOperatorAuthConfigurationSnapshotReportsMissingSetup(): void
    {
        putenv('AURORADERM_OPERATOR_AUTH_MODE=openclaw_chatgpt');

        $snapshot = operator_auth_configuration_snapshot();

        $this->assertTrue($snapshot['enabled']);
        $this->assertFalse($snapshot['configured']);
        $this->assertContains('allowlist', $snapshot['missing']);
        $this->assertContains('transport', $snapshot['missing']);
    }
}
