<?php

declare(strict_types=1);

namespace Tests\Smoke;

require_once __DIR__ . '/SmokeTestCase.php';
require_once __DIR__ . '/../../controllers/ClinicalHistoryController.php';

final class ClinicalHistorySmokeTest extends SmokeTestCase
{
    /**
     * @runInSeparateProcess
     */
    public function testClinicalHistoryRequiresAuthForAdminActions(): void
    {
        $response = $this->captureResponse(
            static fn () => \ClinicalHistoryController::recordGet(['isAdmin' => true]),
            'GET'
        );

        // Usually it checks for sessionId and fails with 401 or 404
        $this->assertContains($response['status'], [401, 404]);
    }
}
