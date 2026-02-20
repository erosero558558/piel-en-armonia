<?php
declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use EventDispatcher;
use BookingCreated;

require_once __DIR__ . '/../../lib/events/EventDispatcher.php';
require_once __DIR__ . '/../../lib/events/BookingCreated.php';

class EventDispatcherTest extends TestCase
{
    public function testDispatch(): void
    {
        $dispatcher = new EventDispatcher();
        $called = false;

        $dispatcher->addListener(BookingCreated::class, function (BookingCreated $event) use (&$called) {
            $called = true;
            $event->emailSent = true;
        });

        $event = new BookingCreated(['id' => 1]);
        $dispatcher->dispatch($event);

        $this->assertTrue($called);
        $this->assertTrue($event->emailSent);
    }

    public function testPropagationStopped(): void
    {
        $dispatcher = new EventDispatcher();
        $firstCalled = false;
        $secondCalled = false;

        $dispatcher->addListener(BookingCreated::class, function (BookingCreated $event) use (&$firstCalled) {
            $firstCalled = true;
            $event->stopPropagation();
        });

        $dispatcher->addListener(BookingCreated::class, function (BookingCreated $event) use (&$secondCalled) {
            $secondCalled = true;
        });

        $event = new BookingCreated(['id' => 1]);
        $dispatcher->dispatch($event);

        $this->assertTrue($firstCalled);
        $this->assertFalse($secondCalled);
    }
}
