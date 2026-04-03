<?php

declare(strict_types=1);

namespace Tests\Smoke;

require_once __DIR__ . '/SmokeTestCase.php';
require_once __DIR__ . '/../../controllers/OpenclawController.php';

final class OpenclawSmokeTest extends SmokeTestCase
{
    /**
     * @runInSeparateProcess
     */
    public function testOpenclawPatientFailsWithoutAuth(): void
    {
        $response = $this->captureResponse(
            static fn () => \OpenclawMedicalRecordsController::patient([]),
            'GET'
        );

        $this->assertSame(401, $response['status']);
    }
}
