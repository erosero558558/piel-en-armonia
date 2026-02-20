<?php
declare(strict_types=1);

require_once __DIR__ . '/../events/BookingCreated.php';
require_once __DIR__ . '/../events/BookingCancelled.php';
require_once __DIR__ . '/../events/BookingRescheduled.php';
require_once __DIR__ . '/../email.php';

class EmailListener
{
    public function onBookingCreated(BookingCreated $event): void
    {
        $appt = $event->appointment;
        $event->emailSent = maybe_send_appointment_email($appt);
        maybe_send_admin_notification($appt);
    }

    public function onBookingCancelled(BookingCancelled $event): void
    {
        $appt = $event->appointment;
        maybe_send_cancellation_email($appt);
    }

    public function onBookingRescheduled(BookingRescheduled $event): void
    {
        $appt = $event->appointment;
        maybe_send_reschedule_email($appt);
    }
}
