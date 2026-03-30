<?php

declare(strict_types=1);

namespace Tests\Smoke;

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

        // Or 400 if it validates sessionId first, but recordGet without auth exits with 401
        $this->assertSame(401, $response['status']);
    }
}
