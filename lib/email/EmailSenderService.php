<?php

declare(strict_types=1);

final class EmailSenderService
{
public static function smtp_config(): array
{
    return AppConfig::getSmtpConfig();
}

public static function smtp_enabled(): bool
{
    $cfg = self::smtp_config();
    return $cfg['user'] !== '' && $cfg['pass'] !== '';
}

public static function smtp_send_mail(string $to, string $subject, string $body, bool $isHtml = false, array $attachments = [], string $altBody = ''): bool
{
    $cfg = self::smtp_config();

    if ($cfg['user'] === '' || $cfg['pass'] === '') {
        error_log('Aurora Derm: SMTP no configurado (AURORADERM_SMTP_USER / AURORADERM_SMTP_PASS)');
        return false;
    }

    // Verificar si PHPMailer está disponible
    if (!class_exists('PHPMailer\PHPMailer\PHPMailer')) {
        error_log('Aurora Derm: PHPMailer no encontrado. Ejecuta "composer install".');
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
            $mail->AltBody = $altBody !== '' ? $altBody : trim(strip_tags($body));
        }

        foreach ($attachments as $attachment) {
            if (!is_array($attachment)) {
                continue;
            }
            $content = isset($attachment['content']) ? (string) $attachment['content'] : '';
            $name = isset($attachment['name']) ? (string) $attachment['name'] : '';
            if ($content === '' || $name === '') {
                continue;
            }
            $encoding = isset($attachment['encoding']) ? (string) $attachment['encoding'] : 'base64';
            $type = isset($attachment['type']) ? (string) $attachment['type'] : '';
            $mail->addStringAttachment($content, $name, $encoding, $type);
        }

        $mail->send();
        return true;

    } catch (PHPMailer\PHPMailer\Exception $e) {
        error_log("Aurora Derm SMTP: Error al enviar - {$mail->ErrorInfo}");
        return false;
    } catch (Throwable $e) {
        error_log("Aurora Derm SMTP: Excepción general - {$e->getMessage()}");
        return false;
    }
}

public static function send_mail(string $to, string $subject, string $body, bool $isHtml = false, array $attachments = [], string $altBody = ''): bool
{
    if (self::smtp_enabled()) {
        return self::smtp_send_mail($to, $subject, $body, $isHtml, $attachments, $altBody);
    }

    if (defined('TESTING_ENV') && TESTING_ENV === true) {
        $GLOBALS['__TEST_EMAIL_OUTBOX'][] = [
            'to' => $to,
            'subject' => $subject,
            'body' => $body,
            'isHtml' => $isHtml,
            'attachments' => $attachments,
            'attachmentsCount' => count($attachments),
            'altBody' => $altBody,
        ];
        error_log('Aurora Derm: envio de email omitido en TESTING_ENV para evitar dependencia de sendmail');
        return true;
    }

    // Fallback a mail() nativo
    $from = AppConfig::getNoReplyEmail();
    $contentType = $isHtml ? 'text/html; charset=UTF-8' : 'text/plain; charset=UTF-8';

    $profile = function_exists('read_turnero_clinic_profile') ? read_turnero_clinic_profile() : [];
    $brandName = !empty($profile['branding']['name']) ? $profile['branding']['name'] : AppConfig::BRAND_NAME;

    $headers = "From: " . $brandName . " <{$from}>\r\nContent-Type: {$contentType}";

    $sent = @mail($to, $subject, $body, $headers);
    if (!$sent) {
        error_log('Aurora Derm: fallo al enviar email (mail nativo) a ' . $to);
    }
    return $sent;
}

public static function send_mail_to_recipient(string $recipient, string $subject, string $body, bool $isHtml = false, array $attachments = [], string $altBody = ''): bool
{
    $to = EmailTemplateService::email_recipient_or_empty($recipient);
    if ($to === '') {
        return false;
    }

    return self::send_mail($to, $subject, $body, $isHtml, $attachments, $altBody);
}

public static function maybe_send_appointment_whatsapp(array $appointment): bool
{
    if (!function_exists('whatsapp_openclaw_repository')) {
        $bootstrapPath = __DIR__ . '/whatsapp_openclaw/bootstrap.php';
        if (is_file($bootstrapPath)) {
            require_once $bootstrapPath;
        } else {
            return false;
        }
    }

    $phone = trim((string) ($appointment['phone'] ?? ''));
    if ($phone === '') {
        return false;
    }

    $context = EmailTemplateService::build_appointment_email_context($appointment);
    $prepInstructions = EmailTemplateService::get_service_preparation_instructions((string) ($appointment['service'] ?? ''));
    
    $body = "Hola " . $context['name'] . " 👋,\n";
    $body .= "Tu cita está *confirmada*. Aquí tienes los detalles:\n\n";
    $body .= "📋 *Servicio:* " . $context['serviceLabel'] . "\n";
    $body .= "👩‍⚕️ *Doctor:* " . $context['doctorLabel'] . "\n";
    $body .= "🗓 *Fecha:* " . $context['dateLabel'] . "\n";
    $body .= "⏰ *Hora:* " . $context['timeLabel'] . "\n\n";
    
    $body .= "💡 *Preparación previa:*\n";
    $body .= $prepInstructions . "\n\n";

    $profile = function_exists('read_turnero_clinic_profile') ? read_turnero_clinic_profile() : [];
    $brandName = !empty($profile['branding']['name']) ? $profile['branding']['name'] : AppConfig::BRAND_NAME;
    $address = !empty($profile['branding']['address']) ? $profile['branding']['address'] : AppConfig::ADDRESS;

    if ($context['checkinToken'] !== '') {
        $body .= "🔑 *Tu código para ingreso:* " . $context['checkinToken'] . "\n\n";
    }

    $body .= "📍 " . $brandName . "\n" . $address . "\n\n";
    $body .= "Si necesitas *reprogramar*, entra a este enlace:\n" . $context['rescheduleUrl'];

    try {
        whatsapp_openclaw_repository()->enqueueOutbox([
            'phone' => $phone,
            'status' => 'pending',
            'type' => 'text',
            'payload' => [
                'text' => $body
            ]
        ]);
        return true;
    } catch (\Throwable $e) {
        error_log("No se pudo encolar WhatsApp de confirmación: " . $e->getMessage());
        return false;
    }
}

public static function maybe_send_appointment_email(array $appointment): bool
{
    // WhatsApp notification
    self::maybe_send_appointment_whatsapp($appointment);

    $subject = EmailTemplateService::build_email_subject('Confirmacion de cita');
    $htmlBody = EmailTemplateService::build_appointment_email_html($appointment);
    $textBody = EmailTemplateService::build_appointment_email_text($appointment);
    $icsContent = EmailTemplateService::generate_ics_content($appointment);
    $attachments = [];
    if ($icsContent !== '') {
        $attachments[] = [
            'content' => $icsContent,
            'name' => 'cita-pielarmonia.ics',
            'type' => 'text/calendar; charset=utf-8; method=PUBLISH',
            'encoding' => 'base64'
        ];
    }

    return self::send_mail_to_recipient(
        (string) ($appointment['email'] ?? ''),
        $subject,
        $htmlBody,
        true,
        $attachments,
        $textBody
    );
}

public static function maybe_send_admin_notification(array $appointment): bool
{
    $adminEmail = AppConfig::getAdminEmail();
    if (EmailTemplateService::email_recipient_or_empty($adminEmail) === '') {
        error_log('Aurora Derm: AURORADERM_ADMIN_EMAIL invalido');
        return false;
    }

    $subject = EmailTemplateService::build_email_subject('Nueva cita agendada');
    $body = EmailTemplateService::build_notification_body(
        "Se ha agendado una nueva cita:\n\n",
        EmailTemplateService::build_admin_appointment_notification_rows($appointment),
        "\nFecha de registro: " . local_date('d/m/Y H:i') . "\n"
    );

    return self::send_mail_to_recipient($adminEmail, $subject, $body);
}

public static function maybe_send_cancellation_email(array $appointment): bool
{
    $subject = EmailTemplateService::build_email_subject('Cita cancelada');
    $htmlBody = EmailTemplateService::build_cancellation_email_html($appointment);
    $textBody = EmailTemplateService::build_cancellation_email_text($appointment);

    return self::send_mail_to_recipient(
        (string) ($appointment['email'] ?? ''),
        $subject,
        $htmlBody,
        true,
        [],
        $textBody
    );
}

public static function maybe_send_callback_admin_notification(array $callback): bool
{
    $adminEmail = AppConfig::getAdminEmail();
    if (EmailTemplateService::email_recipient_or_empty($adminEmail) === '') {
        return false;
    }

    $subject = EmailTemplateService::build_email_subject('Nueva solicitud de llamada');
    $body = EmailTemplateService::build_notification_body(
        "Un paciente solicita que le llamen:\n\n",
        EmailTemplateService::build_callback_notification_rows($callback),
        "\nPor favor contactar lo antes posible."
    );

    return self::send_mail_to_recipient($adminEmail, $subject, $body);
}

public static function maybe_send_preconsultation_admin_notification(array $payload): bool
{
    $adminEmail = AppConfig::getAdminEmail();
    if (EmailTemplateService::email_recipient_or_empty($adminEmail) === '') {
        return false;
    }

    $subject = EmailTemplateService::build_email_subject('Nueva preconsulta digital');
    $body = EmailTemplateService::build_notification_body(
        "Se recibio una preconsulta digital desde el sitio web:\n\n",
        EmailTemplateService::build_preconsultation_notification_rows($payload),
        "\nFrontdesk debe revisar el caso y responder por WhatsApp."
    );

    return self::send_mail_to_recipient($adminEmail, $subject, $body);
}

public static function maybe_send_reminder_email(array $appointment): bool
{
    $subject = EmailTemplateService::build_email_subject('Recordatorio de cita');
    $htmlBody = EmailTemplateService::build_reminder_email_html($appointment);
    $textBody = EmailTemplateService::build_reminder_email_text($appointment);

    return self::send_mail_to_recipient(
        (string) ($appointment['email'] ?? ''),
        $subject,
        $htmlBody,
        true,
        [],
        $textBody
    );
}

public static function maybe_send_reschedule_email(array $appointment): bool
{
    $subject = EmailTemplateService::build_email_subject('Cita reprogramada');
    $htmlBody = EmailTemplateService::build_reschedule_email_html($appointment);
    $textBody = EmailTemplateService::build_reschedule_email_text($appointment);

    return self::send_mail_to_recipient(
        (string) ($appointment['email'] ?? ''),
        $subject,
        $htmlBody,
        true,
        [],
        $textBody
    );
}

public static function maybe_send_gift_card_reminder_email($giftCard): bool
{
    // Handle both array and object representations
    $cardArray = is_object($giftCard) ? (array) $giftCard : $giftCard;
    
    $recipient = trim((string) ($cardArray['recipient_email'] ?? ''));
    if ($recipient === '') {
        return false;
    }

    $amount = number_format(($cardArray['balance_cents'] ?? 0) / 100, 2);
    $code = $cardArray['code'] ?? '';
    
    $profile = function_exists('read_turnero_clinic_profile') ? read_turnero_clinic_profile() : [];
    $brandName = !empty($profile['branding']['name']) ? $profile['branding']['name'] : AppConfig::BRAND_NAME;

    $subject = EmailTemplateService::build_email_subject('Tu Gift Card vence pronto');
    
    $body = "Hola,\n\n";
    $body .= "Te recordamos que tienes una Gift Card con saldo pendiente de $" . $amount . " en " . $brandName . ".\n\n";
    $body .= "El código es: " . $code . "\n";
    
    if (!empty($cardArray['expires_at'])) {
        $body .= "Este saldo vencerá el " . substr($cardArray['expires_at'], 0, 10) . ".\n\n";
    }
    
    $body .= "Puedes usar este saldo en tus próximos tratamientos dermatológicos.\n";
    $body .= "Visita " . rtrim(AppConfig::BASE_URL, '/') . "/es/reservar/ o contáctanos para agendar.\n\n";
    $body .= "Saludos,\n" . $brandName . "\n";
    
    return self::send_mail_to_recipient($recipient, $subject, $body, false);
}

public static function maybe_send_post_consultation_followup_email(array $appointment): bool
{
    $recipient = (string) ($appointment['email'] ?? '');
    if (EmailTemplateService::email_recipient_or_empty($recipient) === '') {
        return false;
    }

    $subject = EmailTemplateService::build_email_subject('Seguimiento de tu consulta');
    $htmlBody = EmailTemplateService::build_post_consultation_followup_email_html($appointment);
    $textBody = EmailTemplateService::build_post_consultation_followup_email_text($appointment);

    return self::send_mail_to_recipient($recipient, $subject, $htmlBody, true, [], $textBody);
}

public static function maybe_send_prescription_ready_email(array $store, array $prescription, array $session = [], array $options = []): bool
{
    $caseId = trim((string) ($prescription['caseId'] ?? ''));
    if ($caseId === '') {
        return false;
    }

    $contact = EmailTemplateService::resolve_case_contact_context($store, $caseId, $session);
    $recipient = EmailTemplateService::email_recipient_or_empty((string) ($contact['email'] ?? ''));
    if ($recipient === '') {
        return false;
    }

    $portalUrl = trim((string) ($options['portalUrl'] ?? rtrim(AppConfig::BASE_URL, '/') . '/es/portal/recetas/'));
    $normalizedPrescription = $prescription;
    $normalizedPrescription['caseId'] = $caseId;
    $normalizedPrescription['medications'] = EmailTemplateService::normalize_prescription_email_items($prescription);

    $attachments = [];
    try {
        require_once __DIR__ . '/ClinicProfileStore.php';
        require_once __DIR__ . '/openclaw/PrescriptionPdfRenderer.php';

        $pdfBytes = PrescriptionPdfRenderer::generatePdfBytes(
            $normalizedPrescription,
            isset($contact['patient']) && is_array($contact['patient']) ? $contact['patient'] : [],
            read_clinic_profile()
        );
        if ($pdfBytes !== '') {
            $attachments[] = [
                'content' => $pdfBytes,
                'name' => 'receta-' . trim((string) ($prescription['id'] ?? 'documento')) . '.pdf',
                'type' => 'application/pdf',
                'encoding' => 'base64',
            ];
        }
    } catch (Throwable $exception) {
        error_log('Aurora Derm: no se pudo adjuntar PDF de receta al email - ' . $exception->getMessage());
    }

    $subject = EmailTemplateService::build_email_subject('Tu receta esta lista');
    $htmlBody = EmailTemplateService::build_prescription_ready_email_html($contact, $normalizedPrescription, $portalUrl);
    $textBody = EmailTemplateService::build_prescription_ready_email_text($contact, $normalizedPrescription, $portalUrl);

    return self::send_mail_to_recipient($recipient, $subject, $htmlBody, true, $attachments, $textBody);
}

}
