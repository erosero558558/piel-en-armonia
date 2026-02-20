<?php
declare(strict_types=1);

require_once __DIR__ . '/Event.php';

/**
 * Event dispatched when a booking is rescheduled.
 */
class BookingRescheduled extends Event
{
    public array $appointment;

    public function __construct(array $appointment)
    {
        $this->appointment = $appointment;
    }
}
