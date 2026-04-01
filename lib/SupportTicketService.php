<?php

declare(strict_types=1);

class SupportTicketService
{
    /**
     * Creates a support ticket from a clinic admin panel.
     * 
     * @param string $clinicId The ID of the clinic creating the ticket
     * @param string $description The issue description
     * @param string|null $screenshotBase64 Optional screenshot evidence
     * @return string The created ticket ID
     */
    public static function createTicket(string $clinicId, string $description, ?string $screenshotBase64 = null): string
    {
        $ticketId = 'TICKET-' . strtoupper(bin2hex(random_bytes(4)));
        
        $ticketData = [
            'id' => $ticketId,
            'clinic_id' => $clinicId,
            'description' => $description,
            'has_screenshot' => !empty($screenshotBase64),
            'status' => 'open',
            'created_at' => gmdate('c'),
        ];
        
        // Mock save to database/external system
        // file_put_contents(__DIR__ . '/../data/tickets/' . $ticketId . '.json', json_encode($ticketData));
        
        // Dispara notificación al Slack del equipo de Flow OS
        WebhookService::dispatch('support.ticket_created', $ticketData, ['webhookUrl' => 'internal_flow_os_slack_webhook']);
        
        return $ticketId;
    }
}
