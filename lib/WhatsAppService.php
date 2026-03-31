<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/AppConfig.php';

// Asegurar carga del Repositorio de OpenClaw si existe su sistema
$repoPath = __DIR__ . '/whatsapp_openclaw/Repository.php';
if (file_exists($repoPath)) {
    require_once $repoPath;
}

class WhatsAppService
{
    /**
     * Encola un mensaje de confirmacion de cita por WhatsApp en el outbox del paciente.
     * Segun S13-20: La confirmación debe incluir: fecha, hora, dirección,
     * instrucciones previas según servicio y link de cancelación.
     */
    public static function sendConfirmation(array $appointment): void
    {
        $phone = trim((string)($appointment['phone'] ?? ''));
        if ($phone === '') {
            return; // Sin numero no podemos enviar WhatsApp
        }

        // Limpieza basica del telefono para formato internacional (esperamos que el front envia +593 o similar)
        $cleanPhone = preg_replace('/[^\d+]/', '', $phone);
        if ($cleanPhone === '') {
            return;
        }

        $date = trim((string)($appointment['date'] ?? ''));
        $time = trim((string)($appointment['time'] ?? ''));
        $service = trim((string)($appointment['service'] ?? ''));
        $doctor = trim((string)($appointment['doctor'] ?? 'su especialista'));

        $baseUrl = defined('AppConfig::BASE_URL') ? rtrim(AppConfig::BASE_URL, '/') : 'https://pielarmonia.com';
        $clinicName = defined('AppConfig::BRAND_NAME') ? AppConfig::BRAND_NAME : 'Aurora Derm';
        $address = defined('AppConfig::ADDRESS') ? AppConfig::ADDRESS : 'Av. de los Shyris y Naciones Unidas';

        $directions = static::getInstructionsForService($service);
        $portalUrl = $baseUrl . '/es/portal/';

        $text = "Hola, tu cita para *{$service}* con {$doctor} ha sido confirmada para el *{$date}* a las *{$time}* en {$clinicName}.\n\n";
        $text .= "📍 *Dirección:* {$address}\n\n";
        if ($directions !== '') {
            $text .= "📝 *Instrucciones Previas:*\n{$directions}\n\n";
        }
        $text .= "Para reagendar o cancelar tu cita, por favor ingresa con anticipación a tu portal de paciente: {$portalUrl}";

        static::enqueueOpenclawOutbox($cleanPhone, $text, $appointment);
    }

    private static function getInstructionsForService(string $service): string
    {
        $service = strtolower(trim($service));
        switch ($service) {
            case 'laser':
                return "- Evitar exposición al sol directa 48 horas antes.\n- Venir con el área limpia y sin maquillaje ni lociones.";
            case 'acne':
                return "- Traer lista de productos dermatológicos que estés usando actualmente.";
            case 'video':
            case 'telefono':
            case 'telemedicina':
                return "- Asegúrate de tener buena conexión a internet y estar en un lugar iluminado.\n- El enlace de llamada lo recibirás unos minutos antes.";
            default:
                return "- Por favor llegar 10 minutos antes de la hora programada.";
        }
    }

    private static function enqueueOpenclawOutbox(string $phone, string $text, array $appointment): void
    {
        // Encolamiento via el repositorio de Openclaw.
        if (!class_exists('WhatsappOpenclawRepository', false)) {
            // Si no detecta la clase Repository, intentamos de nuevo asegurandola si no falló arriba
            $repoClass = 'WhatsappOpenclawRepository';
            if (!class_exists($repoClass) && file_exists(__DIR__ . '/whatsapp_openclaw/Repository.php')) {
                require_once __DIR__ . '/whatsapp_openclaw/Repository.php';
            }
            if (!class_exists($repoClass)) {
                error_log("Aurora Derm: WhatsAppService no puede enviar porque whatsapp_openclaw/Repository no existe.");
                return;
            }
        }

        try {
            $repo = new WhatsappOpenclawRepository();
            $id = bin2hex(random_bytes(16));
            $message = [
                'id' => $id,
                'phone' => $phone,
                'type' => 'text',
                'direction' => 'outbound',
                'source' => 'system_confirmation',
                'text' => $text,
                'status' => 'pending',
                'createdAt' => local_date('c'),
                'context' => [
                    'appointmentId' => $appointment['id'] ?? 0,
                    'service' => $appointment['service'] ?? 'unknown',
                    'intent' => 'booking_confirmation'
                ]
            ];
            $repo->enqueueOutbox($message);
        } catch (Throwable $e) {
            error_log("Aurora Derm: Fallo al encolar WhatsApp confirmation - " . $e->getMessage());
        }
    }
}
