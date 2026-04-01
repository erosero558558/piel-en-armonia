<?php

declare(strict_types=1);

class WebhookService
{
    public static function dispatch(string $event, array $payload, array $config): void
    {
        $webhookUrl = $config['webhookUrl'] ?? null;
        if (!$webhookUrl || !filter_var($webhookUrl, FILTER_VALIDATE_URL)) {
            return;
        }

        $data = json_encode([
            'event' => $event,
            'timestamp' => gmdate('c'),
            'data' => $payload,
        ]);

        $ch = curl_init($webhookUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'X-Flow-OS-Event: ' . $event,
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
        
        curl_exec($ch);
        curl_close($ch);
    }

    public static function onAppointmentStatusChange(string $appointmentId, string $newStatus, array $store): void
    {
        $config = $store['config'] ?? [];
        $domainConfig = $store['domainConfig'] ?? [];
        $mergedConfig = array_merge($config, $domainConfig);

        self::dispatch('appointment.status_changed', [
            'appointmentId' => $appointmentId,
            'status' => $newStatus,
        ], $mergedConfig);
    }
}
