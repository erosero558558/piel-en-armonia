<?php

declare(strict_types=1);

namespace Tests\Smoke;

require_once __DIR__ . '/../../controllers/CertificateController.php';

final class CertificateSmokeTest extends SmokeTestCase
{
    /**
     * @runInSeparateProcess
     */
    public function testCertificateIssueRequiresAuth(): void
    {
        $response = $this->captureResponse(
            static fn () => \CertificateController::issuePost([]),
            'POST',
            []
        );

        $this->assertSame(401, $response['status']);
    }
}
