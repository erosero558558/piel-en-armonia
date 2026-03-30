<?php

declare(strict_types=1);

namespace Tests\Smoke;

require_once __DIR__ . '/SmokeTestCase.php';
require_once __DIR__ . '/../../controllers/CertificateController.php';

final class CertificateSmokeTest extends SmokeTestCase
{
    /**
     * @runInSeparateProcess
     */
    public function testCertificateIssueRequiresAuth(): void
    {
        $response = $this->captureResponse(
            static fn () => \CertificateController::index([]),
            'GET'
        );

        // Usually it requires auth and if not provided or ID is missing, emits 400 or 401
        $this->assertContains($response['status'], [400, 401]);
    }
}
