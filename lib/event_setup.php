<?php
declare(strict_types=1);

require_once __DIR__ . '/events/EventDispatcher.php';
require_once __DIR__ . '/events/BookingCreated.php';
require_once __DIR__ . '/events/BookingCancelled.php';
require_once __DIR__ . '/events/BookingRescheduled.php';
require_once __DIR__ . '/listeners/EmailListener.php';

// Instantiate dispatcher
$eventDispatcher = new EventDispatcher();

// Instantiate listeners
$emailListener = new EmailListener();

// Register listeners
$eventDispatcher->addListener(BookingCreated::class, [$emailListener, 'onBookingCreated']);
$eventDispatcher->addListener(BookingCancelled::class, [$emailListener, 'onBookingCancelled']);
$eventDispatcher->addListener(BookingRescheduled::class, [$emailListener, 'onBookingRescheduled']);

/**
 * Returns the global event dispatcher.
 *
 * @return EventDispatcher
 */
function get_event_dispatcher(): EventDispatcher
{
    global $eventDispatcher;
    return $eventDispatcher;
}
