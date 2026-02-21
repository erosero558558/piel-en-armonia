<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/models.php';

/**
 * Email sending logic.
 */

function generate_ics_content(array $appt): string
{
    $date = (string)($appt['date'] ?? '');
    $time = (string)($appt['time'] ?? '');
    $id = (string)($appt['id'] ?? uniqid());
    $doctor = (string)($appt['doctor'] ?? 'Doctor');
    $service = (string)($appt['service'] ?? 'Servicio');

    if ($date === '' || $time === '') {
        return '';
    }

    $startStr = $date . ' ' . $time;
    $startTimestamp = strtotime($startStr);
    if ($startTimestamp === false) {
        return '';
    }

    $start = gmdate('Ymd\THis\Z', $startTimestamp);
    $end = gmdate('Ymd\THis\Z', $startTimestamp + 3600); // 1 hour duration
    $now = gmdate('Ymd\THis\Z');

    $out = "BEGIN:VCALENDAR\r\n";
    $out .= "VERSION:2.0\r\n";
    $out .= "PRODID:-//Piel en Armonia//Reserva//ES\r\n";
    $out .= "METHOD:REQUEST\r\n";
    $out .= "BEGIN:VEVENT\r\n";
    $out .= "UID:" . $id . "@pielarmonia.com\r\n";
    $out .= "DTSTAMP:" . $now . "\r\n";
    $out .= "DTSTART:" . $start . "\r\n";
    $out .= "DTEND:" . $end . "\r\n";
    $out .= "SUMMARY:Cita Piel en Armonía\r\n";
    $out .= "DESCRIPTION:Cita con " . $doctor . " para " . $service . "\r\n";
    $out .= "LOCATION:Piel en Armonía, Quito\r\n";
    $out .= "STATUS:CONFIRMED\r\n";
    $out .= "SEQUENCE:0\r\n";
    $out .= "END:VEVENT\r\n";
    $out .= "END:VCALENDAR\r\n";

    return $out;
}

function get_email_template(string $type, array $appt): string
{
    $name = sanitize_xss((string)($appt['name'] ?? 'Paciente'));
    $serviceLabel = function_exists('get_service_label') ? get_service_label((string)($appt['service'] ?? '')) : ($appt['service'] ?? '-');
    $doctorLabel = function_exists('get_doctor_label') ? get_doctor_label((string)($appt['doctor'] ?? '')) : ($appt['doctor'] ?? '-');
    $dateLabel = function_exists('format_date_label') ? format_date_label((string)($appt['date'] ?? '')) : ($appt['date'] ?? '-');
    $time = sanitize_xss((string)($appt['time'] ?? '-'));

    $token = $appt['rescheduleToken'] ?? '';
    $rescheduleLink = $token !== '' ? "https://pielarmonia.com/?reschedule=" . $token : "https://pielarmonia.com/#citas";

    $title = '';
    $intro = '';

    if ($type === 'confirmation') {
        $title = 'Confirmación de Cita';
        $intro = 'Tu cita ha sido registrada correctamente.';
    } elseif ($type === 'reminder') {
        $title = 'Recordatorio de Cita';
        $intro = 'Te recordamos que tienes una cita programada para mañana.';
    } elseif ($type === 'reschedule') {
        $title = 'Cita Reprogramada';
        $intro = 'Tu cita ha sido reprogramada exitosamente.';
    } elseif ($type === 'cancellation') {
        $title = 'Cita Cancelada';
        $intro = 'Tu cita ha sido cancelada.';
    }

    return <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{$title}</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
        .header { background-color: #f8f9fa; padding: 15px; text-align: center; border-bottom: 1px solid #eee; }
        .header h1 { margin: 0; color: #2c3e50; font-size: 24px; }
        .content { padding: 20px; }
        .details { background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .detail-row { margin-bottom: 10px; }
        .detail-label { font-weight: bold; color: #555; }
        .footer { margin-top: 30px; font-size: 12px; color: #777; text-align: center; border-top: 1px solid #eee; padding-top: 15px; }
        .btn { display: inline-block; background-color: #e6b8af; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 10px; }
        .btn:hover { background-color: #d6a89f; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Piel en Armonía</h1>
        </div>
        <div class="content">
            <h2>{$title}</h2>
            <p>Hola <strong>{$name}</strong>,</p>
            <p>{$intro}</p>

            <div class="details">
                <div class="detail-row"><span class="detail-label">Servicio:</span> {$serviceLabel}</div>
                <div class="detail-row"><span class="detail-label">Doctor:</span> {$doctorLabel}</div>
                <div class="detail-row"><span class="detail-label">Fecha:</span> {$dateLabel}</div>
                <div class="detail-row"><span class="detail-label">Hora:</span> {$time}</div>
            </div>

            <p>Si necesitas gestionar tu cita, puedes hacerlo aquí:</p>
            <a href="{$rescheduleLink}" class="btn">Gestionar Cita</a>

            <p>Si tienes dudas, contáctanos por WhatsApp: +593 98 245 3672.</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Piel en Armonía. Todos los derechos reservados.</p>
            <p>Este es un mensaje automático, por favor no responder.</p>
        </div>
    </div>
</body>
</html>
HTML;
}

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

        // Adjuntos
        foreach ($attachments as $att) {
            if (isset($att['content'], $att['name'])) {
                $encoding = $att['encoding'] ?? 'base64';
                $type = $att['type'] ?? 'application/octet-stream';
                $mail->addStringAttachment($att['content'], $att['name'], $encoding, $type);
            }
        }

        // Contenido
        $mail->isHTML($isHtml);
        $mail->Subject = $subject;
        $mail->Body    = $body;
        if ($isHtml) {
            $mail->AltBody = strip_tags($body);
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

    $headers = "From: Piel en Armonía <{$from}>\r\n";
    $headers .= "MIME-Version: 1.0\r\n";

    if ($isHtml) {
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    } else {
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    }

    $sent = @mail($to, $subject, $body, $headers);
    if (!$sent) {
        error_log('Piel en Armonía: fallo al enviar email (mail nativo) a ' . $to);
    }
    return $sent;
}

function maybe_send_appointment_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = 'Piel en Armonía';
    $subject = 'Confirmacion de cita - ' . $clinicName;
    $body = get_email_template('confirmation', $appointment);

    $ics = generate_ics_content($appointment);
    $attachments = [];
    if ($ics !== '') {
        $attachments[] = [
            'content' => $ics,
            'name' => 'cita.ics',
            'type' => 'text/calendar; charset=utf-8; method=REQUEST'
        ];
    }

    return send_mail($to, $subject, $body, true, $attachments);
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

    $clinicName = 'Piel en Armonía';
    $subject = 'Cita cancelada - ' . $clinicName;
    $body = get_email_template('cancellation', $appointment);

    return send_mail($to, $subject, $body, true);
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

    $clinicName = 'Piel en Armonía';
    $subject = 'Recordatorio de cita - ' . $clinicName;
    $body = get_email_template('reminder', $appointment);

    $ics = generate_ics_content($appointment);
    $attachments = [];
    if ($ics !== '') {
        $attachments[] = [
            'content' => $ics,
            'name' => 'cita.ics',
            'type' => 'text/calendar; charset=utf-8; method=REQUEST'
        ];
    }

    return send_mail($to, $subject, $body, true, $attachments);
}

function maybe_send_reschedule_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = 'Piel en Armonía';
    $subject = 'Cita reprogramada - ' . $clinicName;
    $body = get_email_template('reschedule', $appointment);

    return send_mail($to, $subject, $body, true);
}
