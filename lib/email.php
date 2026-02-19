<?php
declare(strict_types=1);

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
function smtp_send_mail(string $to, string $subject, string $body): bool
{
    $cfg = smtp_config();

    if ($cfg['user'] === '' || $cfg['pass'] === '') {
        error_log('Piel en Armonía: SMTP no configurado (PIELARMONIA_SMTP_USER / PIELARMONIA_SMTP_PASS)');
        return false;
    }

    $from = $cfg['from'] !== '' ? $cfg['from'] : $cfg['user'];
    $fromName = $cfg['from_name'];

    $socket = @fsockopen($cfg['host'], $cfg['port'], $errno, $errstr, 10);
    if (!$socket) {
        error_log("Piel en Armonía SMTP: no se pudo conectar a {$cfg['host']}:{$cfg['port']} - {$errstr}");
        return false;
    }
    stream_set_timeout($socket, 15);

    $log = [];

    $readLine = static function () use ($socket, &$log): string {
        $response = '';
        while (($line = fgets($socket, 512)) !== false) {
            $response .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        $log[] = 'S: ' . trim($response);
        return $response;
    };

    $sendCmd = static function (string $cmd) use ($socket, $readLine, &$log): string {
        $log[] = 'C: ' . trim($cmd);
        fwrite($socket, $cmd . "\r\n");
        return $readLine();
    };

    try {
        // Greeting
        $greeting = $readLine();
        if (strpos($greeting, '220') !== 0) {
            error_log('Piel en Armonía SMTP: saludo inesperado: ' . trim($greeting));
            fclose($socket);
            return false;
        }

        // EHLO
        $sendCmd('EHLO pielarmonia.com');

        // STARTTLS
        $tlsResp = $sendCmd('STARTTLS');
        if (strpos($tlsResp, '220') !== 0) {
            error_log('Piel en Armonía SMTP: STARTTLS falló: ' . trim($tlsResp));
            fclose($socket);
            return false;
        }

        $cryptoOk = stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT);
        if (!$cryptoOk) {
            error_log('Piel en Armonía SMTP: fallo al habilitar TLS');
            fclose($socket);
            return false;
        }

        // Re-EHLO after TLS
        $sendCmd('EHLO pielarmonia.com');

        // AUTH LOGIN
        $authResp = $sendCmd('AUTH LOGIN');
        if (strpos($authResp, '334') !== 0) {
            error_log('Piel en Armonía SMTP: AUTH LOGIN no aceptado: ' . trim($authResp));
            fclose($socket);
            return false;
        }

        $userResp = $sendCmd(base64_encode($cfg['user']));
        if (strpos($userResp, '334') !== 0) {
            error_log('Piel en Armonía SMTP: usuario rechazado');
            fclose($socket);
            return false;
        }

        $passResp = $sendCmd(base64_encode($cfg['pass']));
        if (strpos($passResp, '235') !== 0) {
            error_log('Piel en Armonía SMTP: autenticación falló - verifica contraseña de aplicación');
            fclose($socket);
            return false;
        }

        // MAIL FROM
        $fromResp = $sendCmd("MAIL FROM:<{$from}>");
        if (strpos($fromResp, '250') !== 0) {
            error_log('Piel en Armonía SMTP: MAIL FROM rechazado: ' . trim($fromResp));
            fclose($socket);
            return false;
        }

        // RCPT TO
        $rcptResp = $sendCmd("RCPT TO:<{$to}>");
        if (strpos($rcptResp, '250') !== 0) {
            error_log('Piel en Armonía SMTP: RCPT TO rechazado: ' . trim($rcptResp));
            fclose($socket);
            return false;
        }

        // DATA
        $dataResp = $sendCmd('DATA');
        if (strpos($dataResp, '354') !== 0) {
            error_log('Piel en Armonía SMTP: DATA rechazado: ' . trim($dataResp));
            fclose($socket);
            return false;
        }

        // Construir mensaje
        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $encodedFrom = '=?UTF-8?B?' . base64_encode($fromName) . '?= <' . $from . '>';
        $messageId = '<' . bin2hex(random_bytes(16)) . '@pielarmonia.com>';

        $headers = "From: {$encodedFrom}\r\n";
        $headers .= "To: {$to}\r\n";
        $headers .= "Subject: {$encodedSubject}\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $headers .= "Content-Transfer-Encoding: base64\r\n";
        $headers .= "Message-ID: {$messageId}\r\n";
        $headers .= "Date: " . date('r') . "\r\n";

        $encodedBody = chunk_split(base64_encode($body), 76, "\r\n");
        $fullMessage = $headers . "\r\n" . $encodedBody . "\r\n.";

        $endResp = $sendCmd($fullMessage);
        if (strpos($endResp, '250') !== 0) {
            error_log('Piel en Armonía SMTP: mensaje no aceptado: ' . trim($endResp));
            fclose($socket);
            return false;
        }

        $sendCmd('QUIT');
        fclose($socket);
        return true;

    } catch (Throwable $e) {
        error_log('Piel en Armonía SMTP: excepción - ' . $e->getMessage());
        @fclose($socket);
        return false;
    }
}

/**
 * Envía email usando SMTP si está configurado, o mail() como fallback.
 */
function send_mail(string $to, string $subject, string $body): bool
{
    if (smtp_enabled()) {
        return smtp_send_mail($to, $subject, $body);
    }

    // Fallback a mail() nativo
    $from = getenv('PIELARMONIA_EMAIL_FROM');
    if (!is_string($from) || $from === '') {
        $from = 'no-reply@pielarmonia.com';
    }
    $headers = "From: Piel en Armonía <{$from}>\r\nContent-Type: text/plain; charset=UTF-8";

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

    $clinic = 'Piel en Armonia';
    $name = $appointment['name'] ?? 'paciente';
    $service = get_service_label((string) ($appointment['service'] ?? ''));
    $doctor = get_doctor_label((string) ($appointment['doctor'] ?? ''));
    $date = format_date_label((string) ($appointment['date'] ?? ''));
    $rawDate = (string) ($appointment['date'] ?? '');
    $time = (string) ($appointment['time'] ?? '-');
    $price = (string) ($appointment['price'] ?? get_service_total_price((string) ($appointment['service'] ?? '')));
    $payment = get_payment_method_label((string) ($appointment['paymentMethod'] ?? 'unpaid'));
    $paymentStatus = get_payment_status_label((string) ($appointment['paymentStatus'] ?? 'pending'));

    $subject = 'Confirmacion de cita | ' . $rawDate . ' ' . $time . ' | ' . $clinic;

    $m = "";
    $m .= "PIEL EN ARMONIA\n";
    $m .= "Dermatologia Especializada\n";
    $m .= str_repeat("-", 45) . "\n\n";

    $m .= "Hola " . $name . ",\n\n";
    $m .= "Tu cita ha sido registrada exitosamente.\n";
    $m .= "A continuacion los detalles:\n\n";

    $m .= str_repeat("-", 45) . "\n";
    $m .= "  DETALLES DE TU CITA\n";
    $m .= str_repeat("-", 45) . "\n\n";
    $m .= "  Servicio:     " . $service . "\n";
    $m .= "  Doctor:       " . $doctor . "\n";
    $m .= "  Fecha:        " . $date . "\n";
    $m .= "  Hora:         " . $time . "\n";
    $m .= "  Precio:       " . $price . "\n";
    $m .= "  Pago:         " . $payment . "\n";
    $m .= "  Estado:       " . $paymentStatus . "\n\n";

    $m .= str_repeat("-", 45) . "\n";
    $m .= "  ANTES DE TU CITA\n";
    $m .= str_repeat("-", 45) . "\n\n";
    $m .= "  * Llega 10 minutos antes de tu hora.\n";
    $m .= "  * Trae tu cedula o documento de identidad.\n";
    $m .= "  * Si tienes examenes previos, trailos a la consulta.\n\n";

    $m .= str_repeat("-", 45) . "\n";
    $m .= "  COMO LLEGAR\n";
    $m .= str_repeat("-", 45) . "\n\n";
    $m .= "  Direccion:\n";
    $m .= "  " . clinic_address_display() . "\n\n";
    $m .= "  Referencia: Frente al Colegio de las Mercedarias,\n";
    $m .= "  a 2 cuadras de la Maternidad Isidro Ayora.\n\n";
    $m .= "  Ver en Google Maps:\n";
    $m .= "  " . clinic_map_url() . "\n\n";

    $m .= "  Horario de atencion:\n";
    $m .= "  " . clinic_schedule_display() . "\n\n";

    $token = $appointment['rescheduleToken'] ?? '';
    if ($token !== '') {
        $m .= str_repeat("-", 45) . "\n";
        $m .= "  REPROGRAMAR O CANCELAR\n";
        $m .= str_repeat("-", 45) . "\n\n";
        $m .= "  Si necesitas cambiar la fecha u hora:\n";
        $m .= "  https://pielarmonia.com/?reschedule=" . $token . "\n\n";
    }

    $m .= str_repeat("-", 45) . "\n\n";
    $m .= "Gracias por confiar en Piel en Armonia.\n";
    $m .= "Estamos para cuidarte.\n\n";
    $m .= "Telefono/WhatsApp: " . clinic_whatsapp_display() . "\n";
    $m .= "Web: https://pielarmonia.com\n";

    return send_mail($to, $subject, $m);
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

    $name = $appointment['name'] ?? '-';
    $email = $appointment['email'] ?? '-';
    $phone = $appointment['phone'] ?? '-';
    $service = get_service_label((string) ($appointment['service'] ?? ''));
    $doctor = get_doctor_label((string) ($appointment['doctor'] ?? ''));
    $date = format_date_label((string) ($appointment['date'] ?? ''));
    $rawDate = (string) ($appointment['date'] ?? '');
    $time = (string) ($appointment['time'] ?? '-');
    $price = (string) ($appointment['price'] ?? get_service_total_price((string) ($appointment['service'] ?? '')));
    $payment = get_payment_method_label((string) ($appointment['paymentMethod'] ?? 'unpaid'));
    $paymentStatus = get_payment_status_label((string) ($appointment['paymentStatus'] ?? 'pending'));

    $subject = '[Piel en Armonia] Nueva cita: ' . $name . ' | ' . $rawDate . ' ' . $time;

    $b = "";
    $b .= "PIEL EN ARMONIA - NOTIFICACION DE CITA\n";
    $b .= str_repeat("=", 50) . "\n\n";

    $b .= "Se ha registrado una nueva cita desde la web.\n\n";

    $b .= str_repeat("-", 50) . "\n";
    $b .= "  PACIENTE\n";
    $b .= str_repeat("-", 50) . "\n";
    $b .= "  Nombre:      " . $name . "\n";
    $b .= "  Email:       " . $email . "\n";
    $b .= "  Telefono:    " . $phone . "\n\n";

    $b .= str_repeat("-", 50) . "\n";
    $b .= "  CITA\n";
    $b .= str_repeat("-", 50) . "\n";
    $b .= "  Servicio:    " . $service . "\n";
    $b .= "  Doctor:      " . $doctor . "\n";
    $b .= "  Fecha:       " . $date . "\n";
    $b .= "  Hora:        " . $time . "\n";
    $b .= "  Precio:      " . $price . "\n\n";

    $b .= str_repeat("-", 50) . "\n";
    $b .= "  PAGO\n";
    $b .= str_repeat("-", 50) . "\n";
    $b .= "  Metodo:      " . $payment . "\n";
    $b .= "  Estado:      " . $paymentStatus . "\n\n";

    $reason = trim((string) ($appointment['reason'] ?? ''));
    $area = trim((string) ($appointment['affectedArea'] ?? ''));
    $evolution = trim((string) ($appointment['evolutionTime'] ?? ''));
    if ($reason !== '' || $area !== '' || $evolution !== '') {
        $b .= str_repeat("-", 50) . "\n";
        $b .= "  INFORMACION CLINICA\n";
        $b .= str_repeat("-", 50) . "\n";
        if ($reason !== '') {
            $b .= "  Motivo:              " . $reason . "\n";
        }
        if ($area !== '') {
            $b .= "  Zona afectada:       " . $area . "\n";
        }
        if ($evolution !== '') {
            $b .= "  Tiempo de evolucion: " . $evolution . "\n";
        }
        $b .= "\n";
    }

    $photoCount = (int) ($appointment['casePhotoCount'] ?? 0);
    if ($photoCount > 0) {
        $b .= str_repeat("-", 50) . "\n";
        $b .= "  FOTOS ADJUNTAS (" . $photoCount . ")\n";
        $b .= str_repeat("-", 50) . "\n";
        if (isset($appointment['casePhotoUrls']) && is_array($appointment['casePhotoUrls'])) {
            foreach ($appointment['casePhotoUrls'] as $photoUrl) {
                $url = trim((string) $photoUrl);
                if ($url !== '') {
                    $b .= "  " . $url . "\n";
                }
            }
        }
        $b .= "\n";
    }

    $b .= str_repeat("=", 50) . "\n";
    $b .= "Registrado: " . local_date('d/m/Y H:i') . "\n";
    $b .= "Consentimiento datos: " . ((isset($appointment['privacyConsent']) && $appointment['privacyConsent']) ? 'Si' : 'No') . "\n";
    $b .= "Ubicacion: " . clinic_map_url() . "\n";

    return send_mail($adminEmail, $subject, $b);
}

function maybe_send_cancellation_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = 'Piel en Armonía';
    $subject = 'Cita cancelada - ' . $clinicName;
    $message = "Hola " . ($appointment['name'] ?? 'paciente') . ",\n\n";
    $message .= "Tu cita ha sido cancelada.\n\n";
    $message .= "Detalles de la cita cancelada:\n";
    $message .= "Servicio: " . get_service_label((string) ($appointment['service'] ?? '-')) . "\n";
    $message .= "Doctor: " . get_doctor_label((string) ($appointment['doctor'] ?? '-')) . "\n";
    $message .= "Fecha: " . format_date_label((string) ($appointment['date'] ?? '-')) . "\n";
    $message .= "Hora: " . ($appointment['time'] ?? '-') . "\n\n";
    $message .= "Si deseas reprogramar, visita https://pielarmonia.com/#citas o escribenos por WhatsApp: " . clinic_whatsapp_display() . ".\n\n";
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

    $clinicName = 'Piel en Armonía';
    $subject = 'Recordatorio de cita - ' . $clinicName;
    $body = "Hola " . ($appointment['name'] ?? 'paciente') . ",\n\n";
    $body .= "Te recordamos que tienes una cita programada para mañana.\n\n";
    $body .= "Servicio: " . get_service_label((string) ($appointment['service'] ?? '-')) . "\n";
    $body .= "Doctor: " . get_doctor_label((string) ($appointment['doctor'] ?? '-')) . "\n";
    $body .= "Fecha: " . format_date_label((string) ($appointment['date'] ?? '-')) . "\n";
    $body .= "Hora: " . ($appointment['time'] ?? '-') . "\n\n";

    $token = $appointment['rescheduleToken'] ?? '';
    if ($token !== '') {
        $body .= "Si necesitas reprogramar, usa este enlace:\n";
        $body .= "https://pielarmonia.com/?reschedule=" . $token . "\n\n";
    }

    $body .= "Te esperamos. ¡Gracias por confiar en nosotros!\n";
    $body .= "- Equipo Piel en Armonía\n";
    $body .= "WhatsApp: " . clinic_whatsapp_display();

    return send_mail($to, $subject, $body);
}

function maybe_send_reschedule_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = 'Piel en Armonía';
    $subject = 'Cita reprogramada - ' . $clinicName;
    $body = "Hola " . ($appointment['name'] ?? 'paciente') . ",\n\n";
    $body .= "Tu cita ha sido reprogramada exitosamente.\n\n";
    $body .= "Servicio: " . get_service_label((string) ($appointment['service'] ?? '-')) . "\n";
    $body .= "Doctor: " . get_doctor_label((string) ($appointment['doctor'] ?? '-')) . "\n";
    $body .= "Nueva fecha: " . format_date_label((string) ($appointment['date'] ?? '-')) . "\n";
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
