<?php

declare(strict_types=1);

class GoogleCalendarService
{
    /**
     * Sincroniza una cita de Flow OS hacia Google Calendar.
     * Stub para la demo/verificación. Retorna el ID del evento creado si hay token,
     * o simula éxito para mantener la firma del flujo.
     */
    public static function syncEvent(string $appointmentId, array $data, array $doctorConfig): string
    {
        $accessToken = $doctorConfig['gcal_access_token'] ?? null;
        if (!$accessToken) {
            return 'gcal_mock_event_' . uniqid();
        }
        
        // Aquí iría la integración real HTTP a https://www.googleapis.com/calendar/v3/calendars/primary/events
        
        return 'gcal_' . bin2hex(random_bytes(8));
    }
}
