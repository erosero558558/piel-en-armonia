<?php

declare(strict_types=1);

namespace Tests\Smoke;

require_once __DIR__ . '/../../controllers/QueueController.php';

final class QueueSmokeTest extends SmokeTestCase
{
    /**
     * @runInSeparateProcess
     */
    public function testQueueTicketFailsOnEmptyPayload(): void
    {
        $response = $this->captureResponse(
            static fn () => \QueueController::ticket([]),
            'POST',
            [] // empty payload triggers validation error
        );

        $this->assertSame(400, $response['status']);
        $this->assertFalse((bool) ($response['payload']['ok'] ?? true));
    }
}
