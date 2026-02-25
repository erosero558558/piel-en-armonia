<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use FigoChatHandler;
use TestingExitException;

// Define TESTING_ENV to trigger exception in json_response
if (!defined('TESTING_ENV')) {
    define('TESTING_ENV', true);
}

// Require dependencies
require_once __DIR__ . '/../../api-lib.php';
require_once __DIR__ . '/../../figo-brain.php';
require_once __DIR__ . '/../../lib/FigoChatHandler.php';

class FigoChatHandlerTest extends TestCase
{
    private $handler;

    protected function setUp(): void
    {
        $this->handler = new FigoChatHandler();
        // Reset globals
        $_SERVER['REQUEST_METHOD'] = 'GET';
        $_SERVER['HTTP_ORIGIN'] = 'https://pielarmonia.com';
        unset($GLOBALS['__TEST_JSON_BODY']);
    }

    public function testHandleGetReturnsStatus(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'GET';

        try {
            $this->handler->handle();
            $this->fail('Expected TestingExitException was not thrown');
        } catch (TestingExitException $e) {
            $payload = $e->payload;
            $status = $e->status;

            $this->assertSame(200, $status);
            $this->assertTrue($payload['ok']);
            $this->assertSame('figo-chat', $payload['service']);
            $this->assertArrayHasKey('mode', $payload);
        }
    }

    public function testHandlePostWithValidMessage(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'messages' => [
                ['role' => 'user', 'content' => 'Hola']
            ]
        ]);

        try {
            $this->handler->handle();
            $this->fail('Expected TestingExitException was not thrown');
        } catch (TestingExitException $e) {
            $payload = $e->payload;
            $status = $e->status;

            // Since 'Hola' triggers fast local content
            $this->assertSame(200, $status);
            $this->assertArrayHasKey('choices', $payload);
            $this->assertStringContainsString('Figo', $payload['choices'][0]['message']['content']);
            $this->assertTrue($payload['fastPath'] ?? false);
        }
    }

    public function testHandlePostMissingMessages(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([]);

        try {
            $this->handler->handle();
            $this->fail('Expected TestingExitException was not thrown');
        } catch (TestingExitException $e) {
            $payload = $e->payload;
            $status = $e->status;

            $this->assertSame(400, $status);
            $this->assertFalse($payload['ok']);
            $this->assertSame('messages_required', $payload['reason']);
        }
    }
}
