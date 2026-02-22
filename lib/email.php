<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/models.php';

/**
 * Email sending logic.
 */

function smtp_config(): array
{
    return [
        'host' => (string) (getenv('PIELARMONIA_SMTP_HOST') ?: 'smtp.gmail.com'),
        'port' => (int) (getenv('PIELARMONIA_SMTP_PORT') ?: 587),
        'user' => (string) (getenv('PIELARMONIA_SMTP_USER') ?: ''),
        'pass' => (string) (getenv('PIELARMONIA_SMTP_PASS') ?: ''),
        'from' => (string) (getenv('PIELARMONIA_EMAIL_FROM') ?: ''),
        'from_name' => 'Piel en Armonía',
    ];
}

function smtp_enabled(): bool
{
    $cfg = smtp_config();
    return $cfg['user'] !== '' && $cfg['pass'] !== '';
}

/**
 * Envía email vía SMTP con autenticación STARTTLS.
 * Compatible con Gmail y cualquier servidor SMTP estándar.
 */
function smtp_send_mail(string $to, string $subject, string $body, bool $isHtml = false, array $attachments = []): bool
{
    $cfg = smtp_config();

    if ($cfg['user'] === '' || $cfg['pass'] === '') {
        error_log('Piel en Armonía: SMTP no configurado (PIELARMONIA_SMTP_USER / PIELARMONIA_SMTP_PASS)');
        return false;
    }

    // Verificar si PHPMailer está disponible
    if (!class_exists('PHPMailer\PHPMailer\PHPMailer')) {
        error_log('Piel en Armonía: PHPMailer no encontrado. Ejecuta "composer install".');
        return false;
    }

    $mail = new PHPMailer\PHPMailer\PHPMailer(true);

    try {
        // Configuración del servidor
        $mail->isSMTP();
        $mail->Host       = $cfg['host'];
        $mail->SMTPAuth   = true;
        $mail->Username   = $cfg['user'];
        $mail->Password   = $cfg['pass'];
        // STARTTLS explícito como en la implementación original (puerto 587)
        $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = $cfg['port'];
        $mail->CharSet    = 'UTF-8';

        // Remitente y destinatario
        $from = $cfg['from'] !== '' ? $cfg['from'] : $cfg['user'];
        $fromName = $cfg['from_name'];

        $mail->setFrom($from, $fromName);
        $mail->addAddress($to);

        // Contenido
        $mail->isHTML($isHtml);
        $mail->Subject = $subject;
        $mail->Body    = $body;
        if ($isHtml) {
            $mail->AltBody = strip_tags($body);
        }

        // Attachments
        foreach ($attachments as $att) {
            if (isset($att['content'], $att['name'])) {
                $type = $att['type'] ?? '';
                $encoding = $att['encoding'] ?? 'base64';
                $mail->addStringAttachment($att['content'], $att['name'], $encoding, $type);
            }
        }

        $mail->send();
        return true;

    } catch (PHPMailer\PHPMailer\Exception $e) {
        error_log("Piel en Armonía SMTP: Error al enviar - {$mail->ErrorInfo}");
        return false;
    } catch (Throwable $e) {
        error_log("Piel en Armonía SMTP: Excepción general - {$e->getMessage()}");
        return false;
    }
}

/**
 * Envía email usando SMTP si está configurado, o mail() como fallback.
 */
function send_mail(string $to, string $subject, string $body, bool $isHtml = false, array $attachments = []): bool
{
    if (smtp_enabled()) {
        return smtp_send_mail($to, $subject, $body, $isHtml, $attachments);
    }

    // Fallback a mail() nativo
    $from = getenv('PIELARMONIA_EMAIL_FROM');
    if (!is_string($from) || $from === '') {
        $from = 'no-reply@pielarmonia.com';
    }

    $contentType = $isHtml ? "text/html; charset=UTF-8" : "text/plain; charset=UTF-8";
    $headers = "From: Piel en Armonía <{$from}>\r\nContent-Type: {$contentType}";

    $sent = @mail($to, $subject, $body, $headers);
    if (!$sent) {
        error_log('Piel en Armonía: fallo al enviar email (mail nativo) a ' . $to);
    }
    return $sent;
}

function generate_ics_content(array $appointment): string
{
    $date = (string) ($appointment['date'] ?? '');
    $time = (string) ($appointment['time'] ?? '');
    if ($date === '' || $time === '') {
        return '';
    }

    $start = date('Ymd\THis', strtotime("$date $time"));
    // Default duration 30 min if not specified
    $duration = isset($appointment['slotDurationMin']) ? (int) $appointment['slotDurationMin'] : 30;
    if ($duration <= 0) {
        $duration = 30;
    }
    $end = date('Ymd\THis', strtotime("$date $time + $duration minutes"));
    $now = date('Ymd\THis\Z');

    $summary = 'Cita Piel en Armonía';
    $serviceLabel = function_exists('get_service_label') ? get_service_label((string)($appointment['service'] ?? '')) : ($appointment['service'] ?? '');
    if ($serviceLabel !== '') {
        $summary .= " - $serviceLabel";
    }

    $description = "Cita confirmada con Piel en Armonía.\\n";
    $description .= "Servicio: $serviceLabel\\n";
    $doctorLabel = function_exists('get_doctor_label') ? get_doctor_label((string)($appointment['doctor'] ?? '')) : ($appointment['doctor'] ?? '-');
    $description .= "Doctor: $doctorLabel\\n";

    $ics = "BEGIN:VCALENDAR\r\n";
    $ics .= "VERSION:2.0\r\n";
    $ics .= "PRODID:-//Piel en Armonia//Booking System//ES\r\n";
    $ics .= "CALSCALE:GREGORIAN\r\n";
    $ics .= "METHOD:REQUEST\r\n";
    $ics .= "BEGIN:VEVENT\r\n";
    $ics .= "UID:pielarmonia-" . ($appointment['id'] ?? uniqid()) . "\r\n";
    $ics .= "DTSTAMP:$now\r\n";
    $ics .= "DTSTART;TZID=America/Guayaquil:$start\r\n";
    $ics .= "DTEND;TZID=America/Guayaquil:$end\r\n";
    $ics .= "SUMMARY:$summary\r\n";
    $ics .= "DESCRIPTION:$description\r\n";
    $ics .= "LOCATION:Piel en Armonía, Quito\r\n";
    $ics .= "STATUS:CONFIRMED\r\n";
    $ics .= "SEQUENCE:0\r\n";
    $ics .= "END:VEVENT\r\n";
    $ics .= "END:VCALENDAR\r\n";

    return $ics;
}

function get_appointment_email_template(array $appointment): string
{
    $name = htmlspecialchars((string) ($appointment['name'] ?? 'Paciente'));
    $service = function_exists('get_service_label') ? get_service_label((string)($appointment['service'] ?? '')) : ($appointment['service'] ?? '-');
    $doctor = function_exists('get_doctor_label') ? get_doctor_label((string)($appointment['doctor'] ?? '')) : ($appointment['doctor'] ?? '-');
    $dateLabel = function_exists('format_date_label') ? format_date_label((string)($appointment['date'] ?? '')) : ($appointment['date'] ?? '-');
    $time = $appointment['time'] ?? '-';

    $token = $appointment['rescheduleToken'] ?? '';
    $rescheduleLink = $token !== '' ? "https://pielarmonia.com/?reschedule=$token" : "https://pielarmonia.com/#citas";

    return <<<HTML
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        .header { text-align: center; border-bottom: 2px solid #0a84ff; padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { color: #0a84ff; margin: 0; font-size: 24px; }
        .details { background-color: #f0f7ff; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .details p { margin: 10px 0; border-bottom: 1px solid #e1e4e8; padding-bottom: 5px; }
        .details p:last-child { border-bottom: none; }
        .label { font-weight: bold; color: #555; display: inline-block; width: 100px; }
        .footer { text-align: center; font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
        .btn { display: inline-block; background-color: #0a84ff; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Piel en Armonía</h1>
            <p>Confirmación de Cita</p>
        </div>
        <p>Hola <strong>$name</strong>,</p>
        <p>Tu cita ha sido registrada exitosamente. A continuación los detalles:</p>

        <div class="details">
            <p><span class="label">Servicio:</span> $service</p>
            <p><span class="label">Doctor:</span> $doctor</p>
            <p><span class="label">Fecha:</span> $dateLabel</p>
            <p><span class="label">Hora:</span> $time</p>
        </div>

        <p>Hemos adjuntado un archivo de calendario (ICS) para que puedas agregarlo a tu agenda.</p>

        <p style="text-align: center;">
            <a href="$rescheduleLink" class="btn" style="color: #ffffff;">Reprogramar Cita</a>
        </p>

        <p>Si tienes alguna duda, puedes contactarnos por WhatsApp.</p>

        <div class="footer">
            <p>Piel en Armonía - Dermatología & Estética<br>Quito, Ecuador</p>
        </div>
    </div>
</body>
</html>
HTML;
}

function maybe_send_appointment_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = 'Piel en Armonía';
    $subject = 'Confirmacion de cita - ' . $clinicName;

    // Generate content
    $htmlBody = get_appointment_email_template($appointment);
    $icsContent = generate_ics_content($appointment);

    $attachments = [];
    if ($icsContent !== '') {
        $attachments[] = [
            'content' => $icsContent,
            'name' => 'cita.ics',
            'type' => 'text/calendar; charset=utf-8; method=REQUEST'
        ];
    }

    return send_mail($to, $subject, $htmlBody, true, $attachments);
}

function maybe_send_admin_notification(array $appointment): bool
{
    $adminEmail = getenv('PIELARMONIA_ADMIN_EMAIL');
    if (!is_string($adminEmail) || trim($adminEmail) === '') {
        $adminEmail = 'javier.rosero94@gmail.com';
    }
    $adminEmail = trim((string) $adminEmail);
    if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
        error_log('Piel en Armonía: PIELARMONIA_ADMIN_EMAIL invalido');
        return false;
    }

    $serviceLabel = function_exists('get_service_label') ? get_service_label((string)($appointment['service'] ?? '')) : ($appointment['service'] ?? '-');
    $doctorLabel = function_exists('get_doctor_label') ? get_doctor_label((string)($appointment['doctor'] ?? '')) : ($appointment['doctor'] ?? '-');

    $clinicName = 'Piel en Armonía';
    $subject = 'Nueva cita agendada - ' . $clinicName;
    $body = "Se ha agendado una nueva cita:\n\n";
    $body .= "Paciente: " . ($appointment['name'] ?? '-') . "\n";
    $body .= "Email: " . ($appointment['email'] ?? '-') . "\n";
    $body .= "Telefono: " . ($appointment['phone'] ?? '-') . "\n";
    $body .= "Motivo: " . ($appointment['reason'] ?? '-') . "\n";
    $body .= "Zona: " . ($appointment['affectedArea'] ?? '-') . "\n";
    $body .= "Evolucion: " . ($appointment['evolutionTime'] ?? '-') . "\n";
    $body .= "Consentimiento datos: " . ((isset($appointment['privacyConsent']) && $appointment['privacyConsent']) ? 'si' : 'no') . "\n";
    $body .= "Servicio: " . $serviceLabel . "\n";
    $body .= "Doctor: " . $doctorLabel . "\n";
    $body .= "Fecha: " . ($appointment['date'] ?? '-') . "\n";
    $body .= "Hora: " . ($appointment['time'] ?? '-') . "\n";
    $body .= "Precio: " . ($appointment['price'] ?? '-') . "\n";
    $body .= "Metodo de pago: " . ($appointment['paymentMethod'] ?? '-') . "\n";
    $body .= "Estado de pago: " . ($appointment['paymentStatus'] ?? '-') . "\n";
    $body .= "Fotos adjuntas: " . (int) ($appointment['casePhotoCount'] ?? 0) . "\n";
    if (isset($appointment['casePhotoUrls']) && is_array($appointment['casePhotoUrls']) && count($appointment['casePhotoUrls']) > 0) {
        $body .= "URLs de fotos:\n";
        foreach ($appointment['casePhotoUrls'] as $photoUrl) {
            $url = trim((string) $photoUrl);
            if ($url !== '') {
                $body .= "- " . $url . "\n";
            }
        }
    }
    $body .= "\nFecha de registro: " . local_date('d/m/Y H:i') . "\n";

    return send_mail($adminEmail, $subject, $body);
}

function maybe_send_cancellation_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $serviceLabel = function_exists('get_service_label') ? get_service_label((string)($appointment['service'] ?? '')) : ($appointment['service'] ?? '-');
    $doctorLabel = function_exists('get_doctor_label') ? get_doctor_label((string)($appointment['doctor'] ?? '')) : ($appointment['doctor'] ?? '-');
    $dateLabel = function_exists('format_date_label') ? format_date_label((string)($appointment['date'] ?? '')) : ($appointment['date'] ?? '-');

    $clinicName = 'Piel en Armonía';
    $subject = 'Cita cancelada - ' . $clinicName;
    $message = "Hola " . ($appointment['name'] ?? 'paciente') . ",\n\n";
    $message .= "Tu cita ha sido cancelada.\n\n";
    $message .= "Detalles de la cita cancelada:\n";
    $message .= "Servicio: " . $serviceLabel . "\n";
    $message .= "Doctor: " . $doctorLabel . "\n";
    $message .= "Fecha: " . $dateLabel . "\n";
    $message .= "Hora: " . ($appointment['time'] ?? '-') . "\n\n";
    $message .= "Si deseas reprogramar, visita https://pielarmonia.com/#citas o escribenos por WhatsApp: +593 98 245 3672.\n\n";
    $message .= "Gracias por confiar en nosotros.";

    return send_mail($to, $subject, $message);
}

function maybe_send_callback_admin_notification(array $callback): bool
{
    $adminEmail = getenv('PIELARMONIA_ADMIN_EMAIL');
    if (!is_string($adminEmail) || $adminEmail === '') {
        return false;
    }
    if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = 'Piel en Armonía';
    $subject = 'Nueva solicitud de llamada - ' . $clinicName;
    $body = "Un paciente solicita que le llamen:\n\n";
    $body .= "Teléfono: " . ($callback['telefono'] ?? '-') . "\n";
    $body .= "Preferencia: " . ($callback['preferencia'] ?? '-') . "\n";
    $body .= "Fecha de solicitud: " . local_date('d/m/Y H:i') . "\n\n";
    $body .= "Por favor contactar lo antes posible.";

    return send_mail($adminEmail, $subject, $body);
}

function maybe_send_reminder_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $serviceLabel = function_exists('get_service_label') ? get_service_label((string)($appointment['service'] ?? '')) : ($appointment['service'] ?? '-');
    $doctorLabel = function_exists('get_doctor_label') ? get_doctor_label((string)($appointment['doctor'] ?? '')) : ($appointment['doctor'] ?? '-');
    $dateLabel = function_exists('format_date_label') ? format_date_label((string)($appointment['date'] ?? '')) : ($appointment['date'] ?? '-');

    $clinicName = 'Piel en Armonía';
    $subject = 'Recordatorio de cita - ' . $clinicName;
    $body = "Hola " . ($appointment['name'] ?? 'paciente') . ",\n\n";
    $body .= "Te recordamos que tienes una cita programada para mañana.\n\n";
    $body .= "Servicio: " . $serviceLabel . "\n";
    $body .= "Doctor: " . $doctorLabel . "\n";
    $body .= "Fecha: " . $dateLabel . "\n";
    $body .= "Hora: " . ($appointment['time'] ?? '-') . "\n\n";

    $token = $appointment['rescheduleToken'] ?? '';
    if ($token !== '') {
        $body .= "Si necesitas reprogramar, usa este enlace:\n";
        $body .= "https://pielarmonia.com/?reschedule=" . $token . "\n\n";
    }

    $body .= "Te esperamos. ¡Gracias por confiar en nosotros!\n";
    $body .= "- Equipo Piel en Armonía\n";
    $body .= "WhatsApp: +593 98 245 3672";

    return send_mail($to, $subject, $body);
}

function maybe_send_reschedule_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $serviceLabel = function_exists('get_service_label') ? get_service_label((string)($appointment['service'] ?? '')) : ($appointment['service'] ?? '-');
    $doctorLabel = function_exists('get_doctor_label') ? get_doctor_label((string)($appointment['doctor'] ?? '')) : ($appointment['doctor'] ?? '-');
    $dateLabel = function_exists('format_date_label') ? format_date_label((string)($appointment['date'] ?? '')) : ($appointment['date'] ?? '-');

    $clinicName = 'Piel en Armonía';
    $subject = 'Cita reprogramada - ' . $clinicName;
    $body = "Hola " . ($appointment['name'] ?? 'paciente') . ",\n\n";
    $body .= "Tu cita ha sido reprogramada exitosamente.\n\n";
    $body .= "Servicio: " . $serviceLabel . "\n";
    $body .= "Doctor: " . $doctorLabel . "\n";
    $body .= "Nueva fecha: " . $dateLabel . "\n";
    $body .= "Nueva hora: " . ($appointment['time'] ?? '-') . "\n\n";

    $token = $appointment['rescheduleToken'] ?? '';
    if ($token !== '') {
        $body .= "Si necesitas reprogramar de nuevo:\n";
        $body .= "https://pielarmonia.com/?reschedule=" . $token . "\n\n";
    }

    $body .= "Te esperamos. ¡Gracias por confiar en nosotros!\n";
    $body .= "- Equipo Piel en Armonía";

    return send_mail($to, $subject, $body);
}
