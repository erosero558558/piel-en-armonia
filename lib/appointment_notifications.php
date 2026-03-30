<?php

declare(strict_types=1);

require_once __DIR__ . '/email.php';
require_once __DIR__ . '/whatsapp_openclaw/bootstrap.php';

/**
 * @param array<string,mixed> $appointment
 */
function build_appointment_whatsapp_confirmation_text(array $appointment): string
{
    $context = build_appointment_email_context($appointment);

    $body = 'Hola ' . $context['name'] . ", tu cita en " . AppConfig::BRAND_NAME . " fue confirmada.\n\n";
    $body .= build_appointment_detail_text($context, false);
    if ($context['checkinToken'] !== '') {
        $body .= 'Codigo de llegada al kiosco: ' . $context['checkinToken'] . "\n";
        $body .= "Puedes mostrar este codigo o tu QR al llegar.\n\n";
    }
    $body .= build_appointment_preparation_text($context['preparationInstructions']);
    $body .= 'Si necesitas reprogramar, visita: ' . $context['rescheduleUrl'] . "\n\n";
    $body .= 'Equipo ' . AppConfig::BRAND_NAME;

    return $body;
}

/**
 * @param array<string,mixed> $appointment
 * @return array{queued:bool,outbox:array<string,mixed>,mode:string}
 */
function maybe_queue_appointment_whatsapp_confirmation(array $appointment): array
{
    if (!class_exists('WhatsappOpenclawConfig') || !function_exists('whatsapp_openclaw_repository')) {
        return ['queued' => false, 'outbox' => [], 'mode' => 'disabled'];
    }

    if (!WhatsappOpenclawConfig::isEnabled()) {
        return ['queued' => false, 'outbox' => [], 'mode' => 'disabled'];
    }

    $phone = whatsapp_openclaw_normalize_phone((string) ($appointment['phone'] ?? ''));
    if ($phone === '') {
        return ['queued' => false, 'outbox' => [], 'mode' => 'disabled'];
    }

    try {
        $repository = whatsapp_openclaw_repository();
        $conversation = $repository->getConversation('', $phone);
        $conversation['phone'] = $phone;
        $conversation['status'] = 'appointment_confirmation';
        $conversation['lastIntent'] = 'appointment_confirmation';
        $conversation['lastOutboundAt'] = '';
        $conversation['lastMessageAt'] = '';
        $conversation['outboundPending'] = max(0, (int) ($conversation['outboundPending'] ?? 0)) + 1;
        $conversation['meta'] = array_merge(
            is_array($conversation['meta'] ?? null) ? $conversation['meta'] : [],
            [
                'latestAppointmentId' => (int) ($appointment['id'] ?? 0),
                'latestService' => (string) ($appointment['service'] ?? ''),
            ]
        );
        $conversation = $repository->saveConversation($conversation);

        $mode = WhatsappOpenclawConfig::resolveMutationMode($phone);
        $outbox = $repository->enqueueOutbox([
            'conversationId' => (string) ($conversation['id'] ?? ''),
            'phone' => $phone,
            'type' => 'text',
            'text' => truncate_field(build_appointment_whatsapp_confirmation_text($appointment), 1600),
            'meta' => [
                'template' => 'appointment_confirmation',
                'appointmentId' => (int) ($appointment['id'] ?? 0),
                'service' => (string) ($appointment['service'] ?? ''),
                'deliveryMode' => $mode,
            ],
        ]);

        return ['queued' => true, 'outbox' => $outbox, 'mode' => $mode];
    } catch (Throwable $e) {
        error_log('Aurora Derm: no se pudo encolar confirmacion por WhatsApp - ' . $e->getMessage());
        return ['queued' => false, 'outbox' => [], 'mode' => 'failed'];
    }
}
