<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/models.php';
require_once __DIR__ . '/AppConfig.php';
require_once __DIR__ . '/ServiceCatalog.php';
require_once __DIR__ . '/TurneroClinicProfile.php';

/**
 * Email sending logic.
 */

/**
 * Reads SMTP configuration from environment variables.
 *
 * @return array{host:string,port:int,user:string,pass:string,from:string,from_name:string}
 */
function smtp_config(): array
{
    return AppConfig::getSmtpConfig();
}

/**
 * Returns true when SMTP credentials are configured.
 */
function smtp_enabled(): bool
{
    $cfg = smtp_config();
    return $cfg['user'] !== '' && $cfg['pass'] !== '';
}

/**
 * Envía email vía SMTP con autenticación STARTTLS.
 * Compatible con Gmail y cualquier servidor SMTP estándar.
 */
function smtp_send_mail(string $to, string $subject, string $body, bool $isHtml = false, array $attachments = [], string $altBody = ''): bool
{
    $cfg = smtp_config();

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

/**
 * Envía email usando SMTP si está configurado, o mail() como fallback.
 */
function send_mail(string $to, string $subject, string $body, bool $isHtml = false, array $attachments = [], string $altBody = ''): bool
{
    if (smtp_enabled()) {
        return smtp_send_mail($to, $subject, $body, $isHtml, $attachments, $altBody);
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

/**
 * Generates an ICS calendar payload for an appointment.
 *
 * @param array<string,mixed> $appointment
 */
function generate_ics_content(array $appointment): string
{
    $date = trim((string) ($appointment['date'] ?? ''));
    $time = trim((string) ($appointment['time'] ?? ''));
    if ($date === '' || $time === '') {
        return '';
    }

    $startTs = strtotime($date . ' ' . $time);
    if ($startTs === false) {
        return '';
    }

    $duration = isset($appointment['slotDurationMin']) ? (int) $appointment['slotDurationMin'] : 30;
    if ($duration <= 0) {
        $duration = 30;
    }

    $endTs = $startTs + ($duration * 60);
    $uid = 'pielarmonia-' . (string) ($appointment['id'] ?? bin2hex(random_bytes(8))) . '@pielarmonia.com';
    $serviceLabel = function_exists('get_service_label')
        ? get_service_label((string) ($appointment['service'] ?? 'consulta'))
        : (string) ($appointment['service'] ?? 'consulta');
    $doctorLabel = function_exists('get_doctor_label')
        ? get_doctor_label((string) ($appointment['doctor'] ?? ''))
        : (string) ($appointment['doctor'] ?? '');

    $profile = function_exists('read_turnero_clinic_profile') ? read_turnero_clinic_profile() : [];
    $brandName = !empty($profile['branding']['name']) ? $profile['branding']['name'] : AppConfig::BRAND_NAME;
    $address = !empty($profile['branding']['address']) ? $profile['branding']['address'] : AppConfig::ADDRESS;

    $summary = 'Cita ' . $brandName . ' - ' . $serviceLabel;
    $description = "Servicio: {$serviceLabel}\\nDoctor: {$doctorLabel}\\n";
    $location = AppConfig::ADDRESS;

    $lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Aurora Derm//Citas//ES',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'UID:' . $uid,
        'DTSTAMP:' . gmdate('Ymd\\THis\\Z'),
        'DTSTART;TZID=America/Guayaquil:' . date('Ymd\\THis', $startTs),
        'DTEND;TZID=America/Guayaquil:' . date('Ymd\\THis', $endTs),
        'SUMMARY:' . $summary,
        'DESCRIPTION:' . $description,
        'LOCATION:' . $address,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
    ];

    return implode("\r\n", $lines) . "\r\n";
}

function get_email_template(string $title, string $content, string $preheader = ''): string
{
    $preheaderHtml = $preheader !== ''
        ? '<div style="display:none;font-size:1px;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;font-family: sans-serif;">' . $preheader . '</div>'
        : '';

    $profile = function_exists('read_turnero_clinic_profile') ? read_turnero_clinic_profile() : [];
    $brandName = !empty($profile['branding']['name']) ? $profile['branding']['name'] : AppConfig::BRAND_NAME;
    $address = !empty($profile['branding']['address']) ? $profile['branding']['address'] : AppConfig::ADDRESS;
    $whatsapp = !empty($profile['branding']['whatsapp']) ? $profile['branding']['whatsapp'] : AppConfig::WHATSAPP_NUMBER;
    $primaryColor = !empty($profile['branding']['theme']['primary_color']) ? $profile['branding']['theme']['primary_color'] : '#0d1a2f';
    $logoUrl = !empty($profile['branding']['logo_url']) ? $profile['branding']['logo_url'] : '';

    $headerContent = $logoUrl !== ''
        ? '<img src="' . htmlspecialchars($logoUrl, ENT_QUOTES, 'UTF-8') . '" alt="' . htmlspecialchars($brandName, ENT_QUOTES, 'UTF-8') . ' Logo" style="max-height: 50px; display: inline-block;">'
        : '<h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">' . htmlspecialchars($brandName, ENT_QUOTES, 'UTF-8') . '</h1>';

    return '<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>' . $title . '</title>
    <style>
        @media screen and (max-width: 600px) {
            .container { width: 100% !important; }
            .content-padding { padding: 20px !important; }
        }
    </style>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f5f8fc;color:#333333;">
    ' . $preheaderHtml . '
    <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f5f8fc;">
        <tr>
            <td align="center" style="padding:40px 0;">
                <table class="container" role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;text-align:left;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);margin:0 auto;">
                    <tr>
                        <td style="padding:30px 40px;background-color:' . htmlspecialchars($primaryColor, ENT_QUOTES, 'UTF-8') . ';text-align:center;">
                            ' . $headerContent . '
                        </td>
                    </tr>
                    <tr>
                        <td class="content-padding" style="padding:40px;">
                            ' . $content . '
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:30px 40px;background-color:#f0f4f8;border-top:1px solid #e1e8ed;text-align:center;">
                            <p style="margin:0 0 10px;font-size:14px;color:#5a6d85;">
                                <strong>' . htmlspecialchars($brandName, ENT_QUOTES, 'UTF-8') . '</strong><br>
                                ' . htmlspecialchars($address, ENT_QUOTES, 'UTF-8') . '
                            </p>
                            <p style="margin:0 0 10px;font-size:14px;color:#5a6d85;">
                                <a href="https://wa.me/' . preg_replace('/[^0-9]/', '', $whatsapp) . '" style="color:' . htmlspecialchars($primaryColor, ENT_QUOTES, 'UTF-8') . ';text-decoration:none;">WhatsApp: ' . htmlspecialchars($whatsapp, ENT_QUOTES, 'UTF-8') . '</a>
                            </p>
                            <p style="margin:0;font-size:12px;color:#8b9bb4;">
                                &copy; ' . date('Y') . ' ' . htmlspecialchars($brandName, ENT_QUOTES, 'UTF-8') . '. Todos los derechos reservados.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>';
}

/**
 * Normalizes a recipient email address and returns an empty string when invalid.
 */
function email_recipient_or_empty(string $email): string
{
    $recipient = trim($email);
    if ($recipient === '' || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
        return '';
    }

    return $recipient;
}

/**
 * Builds a subject line that keeps the clinic branding consistent.
 */
function build_email_subject(string $subject): string
{
    $profile = function_exists('read_turnero_clinic_profile') ? read_turnero_clinic_profile() : [];
    $brandName = !empty($profile['branding']['name']) ? $profile['branding']['name'] : AppConfig::BRAND_NAME;
    return $subject . ' - ' . $brandName;
}

/**
 * Sends mail only when the recipient address is valid.
 */
function send_mail_to_recipient(string $recipient, string $subject, string $body, bool $isHtml = false, array $attachments = [], string $altBody = ''): bool
{
    $to = email_recipient_or_empty($recipient);
    if ($to === '') {
        return false;
    }

    return send_mail($to, $subject, $body, $isHtml, $attachments, $altBody);
}

/**
 * Builds shared appointment email context values.
 *
 * @param array<string,mixed> $appointment
 * @return array{name:string,serviceLabel:string,doctorLabel:string,dateLabel:string,timeLabel:string,rescheduleToken:string,rescheduleUrl:string,checkinToken:string}
 */
function build_appointment_email_context(array $appointment): array
{
    $serviceLabel = function_exists('get_service_label')
        ? get_service_label((string) ($appointment['service'] ?? ''))
        : (string) ($appointment['service'] ?? '');
    $doctorLabel = function_exists('get_doctor_label')
        ? get_doctor_label((string) ($appointment['doctor'] ?? ''))
        : (string) ($appointment['doctor'] ?? '');
    $dateLabel = function_exists('format_date_label')
        ? format_date_label((string) ($appointment['date'] ?? ''))
        : (string) ($appointment['date'] ?? '');
    $rescheduleToken = trim((string) ($appointment['rescheduleToken'] ?? ''));
    $checkinToken = trim((string) (($appointment['checkinToken'] ?? ($appointment['checkin_token'] ?? ''))));

    return [
        'name' => (string) ($appointment['name'] ?? 'Paciente'),
        'serviceLabel' => $serviceLabel,
        'doctorLabel' => $doctorLabel,
        'dateLabel' => $dateLabel,
        'timeLabel' => (string) ($appointment['time'] ?? ''),
        'rescheduleToken' => $rescheduleToken,
        'checkinToken' => $checkinToken,
        'rescheduleUrl' => $rescheduleToken !== ''
            ? AppConfig::BASE_URL . '/?reschedule=' . rawurlencode($rescheduleToken)
            : AppConfig::BASE_URL . '/#citas',
    ];
}

/**
 * Builds table rows for appointment detail blocks.
 *
 * @param array<int,array{label:string,value:string}> $rows
 */
function build_email_detail_rows(array $rows, string $labelStyle, string $valueStyle): string
{
    $html = '';

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $label = htmlspecialchars((string) ($row['label'] ?? ''), ENT_QUOTES, 'UTF-8');
        $value = htmlspecialchars((string) ($row['value'] ?? ''), ENT_QUOTES, 'UTF-8');
        if ($label === '' && $value === '') {
            continue;
        }

        $label = rtrim($label, ':') . ':';
        $html .= '<tr><td style="' . $labelStyle . '">' . $label . '</td><td style="' . $valueStyle . '">' . $value . '</td></tr>';
    }

    return $html;
}

/**
 * Builds the shared appointment detail rows.
 *
 * @param array{name:string,serviceLabel:string,doctorLabel:string,dateLabel:string,timeLabel:string,rescheduleToken:string,rescheduleUrl:string,checkinToken:string} $context
 * @return array<int,array{label:string,value:string}>
 */
function build_appointment_detail_rows(array $context): array
{
    return [
        ['label' => 'Servicio', 'value' => $context['serviceLabel']],
        ['label' => 'Doctor', 'value' => $context['doctorLabel']],
        ['label' => 'Fecha', 'value' => $context['dateLabel']],
        ['label' => 'Hora', 'value' => $context['timeLabel']],
    ];
}

/**
 * Builds the shared appointment detail table.
 *
 * @param array{name:string,serviceLabel:string,doctorLabel:string,dateLabel:string,timeLabel:string,rescheduleToken:string,rescheduleUrl:string,checkinToken:string} $context
 */
function build_appointment_detail_table(array $context, string $tableStyle, string $labelStyle, string $valueStyle): string
{
    return '<table style="' . $tableStyle . '">'
        . build_email_detail_rows(build_appointment_detail_rows($context), $labelStyle, $valueStyle)
        . '</table>';
}

/**
 * Builds a centered CTA button for email templates.
 */
function build_email_cta_button(string $href, string $label): string
{
    $profile = function_exists('read_turnero_clinic_profile') ? read_turnero_clinic_profile() : [];
    $primaryColor = !empty($profile['branding']['theme']['primary_color']) ? $profile['branding']['theme']['primary_color'] : '#0284c7';

    return '<div style="text-align:center;margin-bottom:30px;">'
        . '<a href="' . htmlspecialchars($href, ENT_QUOTES, 'UTF-8') . '" style="display:inline-block;background-color:' . htmlspecialchars($primaryColor, ENT_QUOTES, 'UTF-8') . ';color:#ffffff;text-decoration:none;padding:12px 25px;border-radius:6px;font-weight:bold;">'
        . htmlspecialchars($label, ENT_QUOTES, 'UTF-8')
        . '</a>'
        . '</div>';
}

/**
 * Builds the shared plain-text appointment detail block.
 *
 * @param array{name:string,serviceLabel:string,doctorLabel:string,dateLabel:string,timeLabel:string,rescheduleToken:string,rescheduleUrl:string} $context
 */
function build_appointment_detail_text(array $context, bool $includeRescheduleLink = false): string
{
    $body = build_text_rows(build_appointment_detail_rows($context));
    $body .= "\n";

    if ($includeRescheduleLink && $context['rescheduleToken'] !== '') {
        $body .= "Si necesitas reprogramar, usa este enlace:\n" . $context['rescheduleUrl'] . "\n\n";
    }

    return $body;
}

/**
 * Builds plain-text label/value rows.
 *
 * @param array<int,array{label:string,value:mixed}> $rows
 */
function build_text_rows(array $rows): string
{
    $body = '';

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $label = trim((string) ($row['label'] ?? ''));
        if ($label === '') {
            continue;
        }

        $body .= $label . ': ' . (string) ($row['value'] ?? '') . "\n";
    }

    return $body;
}

/**
 * Builds a plain-text notification body from intro, rows and an optional footer.
 *
 * @param array<int,array{label:string,value:mixed}> $rows
 */
function build_notification_body(string $intro, array $rows, string $footer = ''): string
{
    $body = $intro;
    $body .= build_text_rows($rows);
    $body .= $footer;

    return $body;
}

/**
 * Builds the standard admin appointment notification rows.
 *
 * @param array<string,mixed> $appointment
 * @return array<int,array{label:string,value:mixed}>
 */
function build_admin_appointment_notification_rows(array $appointment): array
{
    $context = build_appointment_email_context($appointment);
    $rows = [
        ['label' => 'Paciente', 'value' => $appointment['name'] ?? '-'],
        ['label' => 'Email', 'value' => $appointment['email'] ?? '-'],
        ['label' => 'Telefono', 'value' => $appointment['phone'] ?? '-'],
        ['label' => 'Motivo', 'value' => $appointment['reason'] ?? '-'],
        ['label' => 'Zona', 'value' => $appointment['affectedArea'] ?? '-'],
        ['label' => 'Evolucion', 'value' => $appointment['evolutionTime'] ?? '-'],
        [
            'label' => 'Consentimiento datos',
            'value' => (isset($appointment['privacyConsent']) && $appointment['privacyConsent']) ? 'si' : 'no',
        ],
        ['label' => 'Servicio', 'value' => $context['serviceLabel']],
        ['label' => 'Doctor', 'value' => $context['doctorLabel']],
        ['label' => 'Fecha', 'value' => $appointment['date'] ?? '-'],
        ['label' => 'Hora', 'value' => $appointment['time'] ?? '-'],
        ['label' => 'Precio', 'value' => $appointment['price'] ?? '-'],
        ['label' => 'Metodo de pago', 'value' => $appointment['paymentMethod'] ?? '-'],
        ['label' => 'Estado de pago', 'value' => $appointment['paymentStatus'] ?? '-'],
        ['label' => 'Fotos adjuntas', 'value' => (int) ($appointment['casePhotoCount'] ?? 0)],
    ];

    if (!empty($appointment['telemedicineChannel'])) {
        $rows = array_merge(
            $rows,
            [
                ['label' => 'Canal telemedicina', 'value' => $appointment['telemedicineChannel'] ?? '-'],
                ['label' => 'Telemedicine intake id', 'value' => $appointment['telemedicineIntakeId'] ?? '-'],
                ['label' => 'Suitability', 'value' => $appointment['telemedicineSuitability'] ?? '-'],
                [
                    'label' => 'Revision humana',
                    'value' => (isset($appointment['telemedicineReviewRequired']) && $appointment['telemedicineReviewRequired']) ? 'si' : 'no',
                ],
                ['label' => 'Escalamiento', 'value' => $appointment['telemedicineEscalationRecommendation'] ?? '-'],
                [
                    'label' => 'Media clinica privada',
                    'value' => count(is_array($appointment['clinicalMediaIds'] ?? null) ? $appointment['clinicalMediaIds'] : []) . ' archivo(s)',
                ],
            ]
        );
    }

    return $rows;
}

/**
 * Builds the standard plain-text rows for a rescheduled appointment.
 *
 * @param array{name:string,serviceLabel:string,doctorLabel:string,dateLabel:string,timeLabel:string,rescheduleToken:string,rescheduleUrl:string} $context
 * @return array<int,array{label:string,value:mixed}>
 */
function build_reschedule_notification_rows(array $context): array
{
    return [
        ['label' => 'Servicio', 'value' => $context['serviceLabel']],
        ['label' => 'Doctor', 'value' => $context['doctorLabel']],
        ['label' => 'Nueva fecha', 'value' => $context['dateLabel']],
        ['label' => 'Nueva hora', 'value' => $context['timeLabel']],
    ];
}

/**
 * Builds the standard footer for reschedule notifications.
 *
 * @param array{name:string,serviceLabel:string,doctorLabel:string,dateLabel:string,timeLabel:string,rescheduleToken:string,rescheduleUrl:string} $context
 */
function build_reschedule_notification_footer(array $context): string
{
    $footer = "\n";

    if ($context['rescheduleToken'] !== '') {
        $footer .= "Si necesitas reprogramar de nuevo:\n";
        $footer .= $context['rescheduleUrl'] . "\n\n";
    }

    $profile = function_exists('read_turnero_clinic_profile') ? read_turnero_clinic_profile() : [];
    $brandName = !empty($profile['branding']['name']) ? $profile['branding']['name'] : AppConfig::BRAND_NAME;

    $footer .= "Te esperamos. ¡Gracias por confiar en nosotros!\n";
    $footer .= "- Equipo " . $brandName;

    return $footer;
}

/**
 * Builds the plain-text body for a rescheduled appointment email.
 *
 * @param array<string,mixed> $appointment
 */
function build_reschedule_email_text(array $appointment): string
{
    $context = build_appointment_email_context($appointment);

    return build_notification_body(
        "Hola " . $context['name'] . ",\n\n" . "Tu cita ha sido reprogramada exitosamente.\n\n",
        build_reschedule_notification_rows($context),
        build_reschedule_notification_footer($context)
    );
}

/**
 * Builds the responsive HTML body for a rescheduled appointment email.
 *
 * @param array<string,mixed> $appointment
 */
function build_reschedule_email_html(array $appointment): string
{
    $context = build_appointment_email_context($appointment);
    $name = htmlspecialchars($context['name'], ENT_QUOTES, 'UTF-8');
    $dateLabel = htmlspecialchars($context['dateLabel'], ENT_QUOTES, 'UTF-8');

    $rows = build_reschedule_notification_rows($context);
    $content = '<h2 style="margin:0 0 20px;color:#0d1a2f;font-size:20px;">Cita Reprogramada</h2>'
        . '<p style="margin:0 0 15px;line-height:1.6;color:#555;">Hola <strong>' . $name . '</strong>,</p>'
        . '<p style="margin:0 0 20px;line-height:1.6;color:#555;">Tu cita fue reprogramada exitosamente. Estos son los nuevos datos:</p>'
        . '<table style="width:100%;border-collapse:separate;border-spacing:0;background-color:#f8fafc;border-radius:8px;padding:15px;margin-bottom:25px;">'
        . build_email_detail_rows(
            array_map(static function (array $row): array {
                return [
                    'label' => (string) ($row['label'] ?? ''),
                    'value' => (string) ($row['value'] ?? ''),
                ];
            }, $rows),
            'padding:8px 0;color:#64748b;font-weight:bold;width:140px;',
            'padding:8px 0;color:#334155;'
        )
        . '</table>'
        . build_email_cta_button($context['rescheduleUrl'], 'Gestionar cita')
        . '<p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Si necesitas ayuda, responde a este correo.</p>';

    return get_email_template(
        'Cita Reprogramada',
        $content,
        'Tu cita fue reprogramada para el ' . $dateLabel
    );
}

/**
 * Splits a display name into first and last name components for document payloads.
 *
 * @return array{firstName:string,lastName:string}
 */
function split_patient_name(string $fullName): array
{
    $normalized = trim(preg_replace('/\s+/', ' ', $fullName) ?? '');
    if ($normalized === '') {
        return [
            'firstName' => 'Paciente',
            'lastName' => '',
        ];
    }

    $parts = preg_split('/\s+/', $normalized) ?: [];
    $firstName = trim((string) array_shift($parts));

    return [
        'firstName' => $firstName !== '' ? $firstName : 'Paciente',
        'lastName' => trim(implode(' ', $parts)),
    ];
}

/**
 * Resolves patient-facing contact details for a case.
 *
 * @param array<string,mixed> $store
 * @param array<string,mixed> $session
 * @return array{
 *   name:string,
 *   email:string,
 *   phone:string,
 *   patient:array<string,mixed>,
 *   appointment:array<string,mixed>
 * }
 */
function resolve_case_contact_context(array $store, string $caseId, array $session = []): array
{
    $sessionPatient = isset($session['patient']) && is_array($session['patient'])
        ? $session['patient']
        : [];
    $caseSummary = [];
    foreach (($store['patient_cases'] ?? []) as $candidateCase) {
        if (!is_array($candidateCase) || trim((string) ($candidateCase['id'] ?? '')) !== $caseId) {
            continue;
        }

        $caseSummary = isset($candidateCase['summary']) && is_array($candidateCase['summary'])
            ? $candidateCase['summary']
            : [];
        break;
    }

    $matchedAppointment = [];
    $sessionAppointmentId = (int) ($session['appointmentId'] ?? 0);
    foreach (($store['appointments'] ?? []) as $appointment) {
        if (!is_array($appointment)) {
            continue;
        }

        $appointmentId = (int) ($appointment['id'] ?? 0);
        $appointmentCaseId = trim((string) ($appointment['patientCaseId'] ?? ''));
        if ($sessionAppointmentId > 0 && $appointmentId === $sessionAppointmentId) {
            $matchedAppointment = $appointment;
            break;
        }
        if ($appointmentCaseId !== '' && $appointmentCaseId === $caseId) {
            $matchedAppointment = $appointment;
        }
    }

    $patientRecord = isset($store['patients'][$caseId]) && is_array($store['patients'][$caseId])
        ? $store['patients'][$caseId]
        : [];
    $nameParts = split_patient_name(
        (string) ($sessionPatient['name'] ?? $caseSummary['patientLabel'] ?? $matchedAppointment['name'] ?? '')
    );
    $firstName = trim((string) ($patientRecord['firstName'] ?? $nameParts['firstName']));
    $lastName = trim((string) ($patientRecord['lastName'] ?? $nameParts['lastName']));

    return [
        'name' => trim(implode(' ', array_filter([$firstName, $lastName], static fn (string $value): bool => $value !== ''))),
        'email' => email_recipient_or_empty((string) ($sessionPatient['email'] ?? $caseSummary['contactEmail'] ?? $matchedAppointment['email'] ?? '')),
        'phone' => trim((string) ($sessionPatient['phone'] ?? $caseSummary['contactPhone'] ?? $matchedAppointment['phone'] ?? '')),
        'patient' => array_merge($patientRecord, [
            'firstName' => $firstName !== '' ? $firstName : 'Paciente',
            'lastName' => $lastName,
            'ci' => (string) ($patientRecord['ci'] ?? $patientRecord['cedula'] ?? $sessionPatient['documentNumber'] ?? ''),
            'birthDate' => (string) ($patientRecord['birthDate'] ?? ''),
        ]),
        'appointment' => $matchedAppointment,
    ];
}

/**
 * Normalizes medication rows coming from either document items or stored prescriptions.
 *
 * @param array<string,mixed> $prescription
 * @return array<int,array<string,string>>
 */
function normalize_prescription_email_items(array $prescription): array
{
    $rawItems = [];
    if (isset($prescription['medications']) && is_array($prescription['medications'])) {
        $rawItems = $prescription['medications'];
    } elseif (isset($prescription['items']) && is_array($prescription['items'])) {
        $rawItems = $prescription['items'];
    }

    $items = [];
    foreach ($rawItems as $item) {
        if (!is_array($item)) {
            continue;
        }

        $label = trim((string) ($item['medication'] ?? $item['name'] ?? ''));
        if ($label === '') {
            continue;
        }

        $items[] = [
            'medication' => $label,
            'dose' => trim((string) ($item['dose'] ?? '')),
            'frequency' => trim((string) ($item['frequency'] ?? '')),
            'duration' => trim((string) ($item['duration'] ?? '')),
            'instructions' => trim((string) ($item['instructions'] ?? '')),
        ];
    }

    return $items;
}

/**
 * Builds a branded HTML email for post-consultation follow-up.
 *
 * @param array<string,mixed> $appointment
 */
function build_post_consultation_followup_email_html(array $appointment): string
{
    $context = build_appointment_email_context($appointment);
    $portalUrl = AppConfig::BASE_URL . '/es/portal/';
    $name = htmlspecialchars($context['name'], ENT_QUOTES, 'UTF-8');
    $whatsapp = htmlspecialchars((string) ((read_turnero_clinic_profile()['branding']['whatsapp'] ?? AppConfig::WHATSAPP_NUMBER)), ENT_QUOTES, 'UTF-8');

    $content = '<h2 style="margin:0 0 20px;color:#0d1a2f;font-size:20px;">Seguimiento de tu consulta</h2>'
        . '<p style="margin:0 0 15px;line-height:1.6;color:#555;">Hola <strong>' . $name . '</strong>,</p>'
        . '<p style="margin:0 0 20px;line-height:1.6;color:#555;">Queremos saber cómo te has sentido después de tu consulta. Si sigues con molestias o tienes dudas sobre tus indicaciones, estamos para ayudarte.</p>'
        . build_appointment_detail_table(
            $context,
            'width:100%;border-collapse:separate;border-spacing:0;background-color:#f8fafc;border-radius:8px;padding:15px;margin-bottom:25px;',
            'padding:8px 0;color:#64748b;font-weight:bold;width:120px;',
            'padding:8px 0;color:#334155;'
        )
        . build_email_cta_button($portalUrl, 'Abrir portal del paciente')
        . '<p style="margin:0;line-height:1.6;color:#555;">También puedes responder este correo o escribirnos por WhatsApp: <strong>' . $whatsapp . '</strong>.</p>';

    return get_email_template('Seguimiento de tu consulta', $content, 'Queremos saber cómo te has sentido después de tu consulta');
}

/**
 * Builds a plain-text email for post-consultation follow-up.
 *
 * @param array<string,mixed> $appointment
 */
function build_post_consultation_followup_email_text(array $appointment): string
{
    $context = build_appointment_email_context($appointment);
    $portalUrl = AppConfig::BASE_URL . '/es/portal/';

    $profile = function_exists('read_turnero_clinic_profile') ? read_turnero_clinic_profile() : [];
    $brandName = !empty($profile['branding']['name']) ? $profile['branding']['name'] : AppConfig::BRAND_NAME;
    $whatsapp = !empty($profile['branding']['whatsapp']) ? $profile['branding']['whatsapp'] : AppConfig::WHATSAPP_NUMBER;

    $body = "Hola " . $context['name'] . ",\n\n";
    $body .= "Queremos saber como te has sentido despues de tu consulta.\n\n";
    $body .= build_appointment_detail_text($context, false);
    $body .= "Si sigues con molestias o tienes dudas, puedes responder este correo.\n";
    $body .= "Portal del paciente: " . $portalUrl . "\n";
    $body .= "WhatsApp: " . $whatsapp . "\n\n";
    $body .= "- Equipo " . $brandName;

    return $body;
}

/**
 * Sends the branded post-consultation follow-up email.
 *
 * @param array<string,mixed> $appointment
 */
function maybe_send_post_consultation_followup_email(array $appointment): bool
{
    $recipient = (string) ($appointment['email'] ?? '');
    if (email_recipient_or_empty($recipient) === '') {
        return false;
    }

    $subject = build_email_subject('Seguimiento de tu consulta');
    $htmlBody = build_post_consultation_followup_email_html($appointment);
    $textBody = build_post_consultation_followup_email_text($appointment);

    return send_mail_to_recipient($recipient, $subject, $htmlBody, true, [], $textBody);
}

/**
 * Builds the branded HTML email for a ready prescription.
 *
 * @param array<string,mixed> $contact
 * @param array<string,mixed> $prescription
 */
function build_prescription_ready_email_html(array $contact, array $prescription, string $portalUrl): string
{
    $medications = normalize_prescription_email_items($prescription);
    $name = htmlspecialchars((string) ($contact['name'] ?? 'Paciente'), ENT_QUOTES, 'UTF-8');
    $issuedAt = trim((string) ($prescription['issued_at'] ?? $prescription['issuedAt'] ?? ''));
    $issuedLabel = $issuedAt !== '' ? htmlspecialchars(format_date_label(substr($issuedAt, 0, 10)), ENT_QUOTES, 'UTF-8') : 'Hoy';
    $doctor = function_exists('doctor_profile_document_fields')
        ? doctor_profile_document_fields(isset($prescription['doctor']) && is_array($prescription['doctor']) ? $prescription['doctor'] : [])
        : [];
    $doctorLabel = htmlspecialchars((string) ($doctor['name'] ?? $prescription['issued_by'] ?? 'Medico tratante'), ENT_QUOTES, 'UTF-8');

    $listItems = '';
    foreach (array_slice($medications, 0, 4) as $item) {
        $detail = htmlspecialchars((string) ($item['medication'] ?? ''), ENT_QUOTES, 'UTF-8');
        $support = trim(implode(' · ', array_filter([
            (string) ($item['dose'] ?? ''),
            (string) ($item['frequency'] ?? ''),
            (string) ($item['duration'] ?? ''),
        ], static fn (string $value): bool => $value !== '')));
        $supportHtml = $support !== ''
            ? '<span style="display:block;font-size:13px;color:#64748b;">' . htmlspecialchars($support, ENT_QUOTES, 'UTF-8') . '</span>'
            : '';
        $listItems .= '<li style="margin-bottom:10px;color:#334155;">' . $detail . $supportHtml . '</li>';
    }

    $content = '<h2 style="margin:0 0 20px;color:#0d1a2f;font-size:20px;">Tu receta ya está lista</h2>'
        . '<p style="margin:0 0 15px;line-height:1.6;color:#555;">Hola <strong>' . $name . '</strong>,</p>'
        . '<p style="margin:0 0 20px;line-height:1.6;color:#555;">Ya dejamos lista tu receta médica. También adjuntamos el PDF para que puedas guardarlo o compartirlo cuando lo necesites.</p>'
        . '<table style="width:100%;border-collapse:separate;border-spacing:0;background-color:#f8fafc;border-radius:8px;padding:15px;margin-bottom:25px;">'
        . build_email_detail_rows([
            ['label' => 'Profesional', 'value' => $doctorLabel],
            ['label' => 'Emitida', 'value' => $issuedLabel],
            ['label' => 'Items', 'value' => (string) count($medications)],
        ], 'padding:8px 0;color:#64748b;font-weight:bold;width:120px;', 'padding:8px 0;color:#334155;')
        . '</table>'
        . ($listItems !== ''
            ? '<div style="margin:0 0 24px;padding:16px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;"><p style="margin:0 0 12px;font-weight:700;color:#0f172a;">Resumen de la receta</p><ul style="margin:0;padding-left:20px;">' . $listItems . '</ul></div>'
            : '')
        . build_email_cta_button($portalUrl, 'Abrir portal del paciente')
        . '<p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Si tienes dudas sobre la indicación o la dosis, responde este correo.</p>';

    return get_email_template('Tu receta esta lista', $content, 'Tu receta medica ya esta disponible');
}

/**
 * Builds the plain-text email for a ready prescription.
 *
 * @param array<string,mixed> $contact
 * @param array<string,mixed> $prescription
 */
function build_prescription_ready_email_text(array $contact, array $prescription, string $portalUrl): string
{
    $medications = normalize_prescription_email_items($prescription);
    $doctor = function_exists('doctor_profile_document_fields')
        ? doctor_profile_document_fields(isset($prescription['doctor']) && is_array($prescription['doctor']) ? $prescription['doctor'] : [])
        : [];

    $body = "Hola " . (string) ($contact['name'] ?? 'Paciente') . ",\n\n";
    $body .= "Tu receta medica ya esta lista.\n";
    $body .= "Adjuntamos el PDF y tambien puedes revisarla desde el portal del paciente.\n\n";
    $body .= "Profesional: " . (string) ($doctor['name'] ?? $prescription['issued_by'] ?? 'Medico tratante') . "\n";
    $body .= "Portal del paciente: " . $portalUrl . "\n";

    if ($medications !== []) {
        $body .= "\nResumen:\n";
        foreach ($medications as $item) {
            $row = '- ' . (string) ($item['medication'] ?? '');
            $support = trim(implode(' · ', array_filter([
                (string) ($item['dose'] ?? ''),
                (string) ($item['frequency'] ?? ''),
                (string) ($item['duration'] ?? ''),
            ], static fn (string $value): bool => $value !== '')));
            if ($support !== '') {
                $row .= ' (' . $support . ')';
            }
            $body .= $row . "\n";
        }
    }

    $body .= "\nSi tienes dudas, responde este correo.\n";
    return $body;
}

/**
 * Sends the branded prescription-ready email using the patient contact resolved from store data.
 *
 * @param array<string,mixed> $store
 * @param array<string,mixed> $prescription
 * @param array<string,mixed> $session
 */
function maybe_send_prescription_ready_email(array $store, array $prescription, array $session = [], array $options = []): bool
{
    $caseId = trim((string) ($prescription['caseId'] ?? ''));
    if ($caseId === '') {
        return false;
    }

    $contact = resolve_case_contact_context($store, $caseId, $session);
    $recipient = email_recipient_or_empty((string) ($contact['email'] ?? ''));
    if ($recipient === '') {
        return false;
    }

    $portalUrl = trim((string) ($options['portalUrl'] ?? (AppConfig::BASE_URL . '/es/portal/receta/')));
    $normalizedPrescription = $prescription;
    $normalizedPrescription['caseId'] = $caseId;
    $normalizedPrescription['medications'] = normalize_prescription_email_items($prescription);

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

    $subject = build_email_subject('Tu receta esta lista');
    $htmlBody = build_prescription_ready_email_html($contact, $normalizedPrescription, $portalUrl);
    $textBody = build_prescription_ready_email_text($contact, $normalizedPrescription, $portalUrl);

    return send_mail_to_recipient($recipient, $subject, $htmlBody, true, $attachments, $textBody);
}

/**
 * Builds the standard callback notification rows.
 *
 * @param array<string,mixed> $callback
 * @return array<int,array{label:string,value:mixed}>
 */
function build_callback_notification_rows(array $callback): array
{
    return [
        ['label' => 'Teléfono', 'value' => $callback['telefono'] ?? '-'],
        ['label' => 'Preferencia', 'value' => $callback['preferencia'] ?? '-'],
        ['label' => 'Fecha de solicitud', 'value' => local_date('d/m/Y H:i')],
    ];
}

/**
 * Builds the standard pre-consultation notification rows.
 *
 * @param array<string,mixed> $payload
 * @return array<int,array{label:string,value:mixed}>
 */
function build_preconsultation_notification_rows(array $payload): array
{
    return [
        ['label' => 'Nombre', 'value' => $payload['patientLabel'] ?? '-'],
        ['label' => 'WhatsApp', 'value' => $payload['contactPhone'] ?? '-'],
        ['label' => 'Tipo de piel', 'value' => $payload['skinType'] ?? 'No especificado'],
        ['label' => 'Condición', 'value' => $payload['condition'] ?? '-'],
        ['label' => 'Fotos adjuntas', 'value' => (int) ($payload['photoCount'] ?? 0)],
        ['label' => 'Case ID', 'value' => $payload['caseId'] ?? '-'],
        ['label' => 'Fecha de solicitud', 'value' => local_date('d/m/Y H:i')],
    ];
}

/**
 * @param string $service
 * @return string
 */
function get_service_preparation_instructions(string $service): string
{
    $catalogPreparation = service_catalog_preparation_for($service);
    if ($catalogPreparation !== '') {
        return $catalogPreparation;
    }

    switch (strtolower(trim($service))) {
        case 'consulta':
            return 'Por favor, acuda con 10 min de anticipación. Evite maquillaje pesado o productos cubrientes para facilitar la valoración de la textura de su piel.';
        case 'video':
        case 'telefono':
            return 'Asegúrese de contar con buena luz y conexión. Tenga a mano fotos claras de las zonas a tratar y los nombres de cremas o medicación que esté usando.';
        case 'acne':
            return 'Recomendamos no utilizar cremas densas ni bloqueadores con color al menos 2h antes de la cita para no alterar la apariencia de las lesiones.';
        case 'cancer':
            return 'Dado que la revisión de lunares es de cuerpo entero, sugerimos vestir ropa cómoda y fácil de retirar.';
        case 'laser':
        case 'rejuvenecimiento':
            return 'Evite exposición solar fuerte y suspenda exfoliantes o retinol 48h antes de su cita. Venga con la piel limpia si es posible.';
        default:
            return 'Llegue 10 min antes y traiga cualquier examen previo o receta que considere relevante.';
    }
}

/**
 * Builds the responsive HTML confirmation email for patient appointments.
 *
 * @param array<string,mixed> $appointment
 */
function build_appointment_email_html(array $appointment): string
{
    $context = build_appointment_email_context($appointment);
    $name = htmlspecialchars($context['name'], ENT_QUOTES, 'UTF-8');
    $dateLabel = htmlspecialchars($context['dateLabel'], ENT_QUOTES, 'UTF-8');
    $checkinToken = htmlspecialchars($context['checkinToken'], ENT_QUOTES, 'UTF-8');
    $prepInstructions = htmlspecialchars(get_service_preparation_instructions((string) ($appointment['service'] ?? '')), ENT_QUOTES, 'UTF-8');

    $checkinBlock = $context['checkinToken'] !== ''
        ? '<div style="margin:0 0 20px;padding:16px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;">'
            . '<p style="margin:0 0 8px;font-weight:700;color:#0d1a2f;">Codigo de llegada al kiosco</p>'
            . '<p style="margin:0 0 6px;line-height:1.6;color:#475569;">Cuando llegues, puedes escanear tu QR de confirmacion o mostrar este codigo en el kiosco:</p>'
            . '<p style="margin:0;font-size:15px;font-weight:700;letter-spacing:0.08em;color:#0f172a;">' . $checkinToken . '</p>'
        . '</div>'
        : '';

    $prepBlock = '<div style="margin:0 0 20px;padding:16px;border-radius:12px;background:#fef9c3;border:1px solid #fef08a;">'
        . '<p style="margin:0 0 8px;font-weight:700;color:#854d0e;">Instrucciones de preparación</p>'
        . '<p style="margin:0;line-height:1.6;color:#713f12;">' . $prepInstructions . '</p>'
        . '</div>';

    $content = '<h2 style="margin:0 0 20px;color:#0d1a2f;font-size:20px;">Cita Confirmada</h2>'
        . '<p style="margin:0 0 15px;line-height:1.6;color:#555;">Hola <strong>' . $name . '</strong>,</p>'
        . '<p style="margin:0 0 20px;line-height:1.6;color:#555;">Tu cita ha sido registrada exitosamente. Aquí tienes los detalles:</p>'
        . build_appointment_detail_table(
            $context,
            'width:100%;border-collapse:separate;border-spacing:0;background-color:#f8fafc;border-radius:8px;padding:15px;margin-bottom:25px;',
            'padding:8px 0;color:#64748b;font-weight:bold;width:120px;',
            'padding:8px 0;color:#334155;'
        )
        . $prepBlock
        . $checkinBlock
        . '<p style="margin:0 0 25px;line-height:1.6;color:#555;">Adjuntamos un archivo de calendario (.ics) para que puedas agregar esta cita a tu agenda.</p>'
        . build_email_cta_button($context['rescheduleUrl'], 'Reprogramar Cita')
        . '<p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Si necesitas ayuda, responde a este correo.</p>';

    return get_email_template('Confirmación de Cita', $content, 'Tu cita ha sido confirmada para el ' . $dateLabel);
}

/**
 * @param array<string,mixed> $appointment
 */
function build_appointment_email_text(array $appointment): string
{
    $context = build_appointment_email_context($appointment);
    $prepInstructions = get_service_preparation_instructions((string) ($appointment['service'] ?? ''));

    $body = "Hola " . $context['name'] . ",\n\n";
    $body .= "Tu cita ha sido registrada exitosamente.\n\n";
    $body .= "Detalles:\n";
    $body .= build_appointment_detail_text($context, false);
    
    $body .= "Instrucciones previas:\n";
    $body .= $prepInstructions . "\n\n";

    $profile = function_exists('read_turnero_clinic_profile') ? read_turnero_clinic_profile() : [];
    $brandName = !empty($profile['branding']['name']) ? $profile['branding']['name'] : AppConfig::BRAND_NAME;
    $address = !empty($profile['branding']['address']) ? $profile['branding']['address'] : AppConfig::ADDRESS;
    $whatsapp = !empty($profile['branding']['whatsapp']) ? $profile['branding']['whatsapp'] : AppConfig::WHATSAPP_NUMBER;

    if ($context['checkinToken'] !== '') {
        $body .= "Codigo de llegada al kiosco: " . $context['checkinToken'] . "\n";
        $body .= "Puedes usar este codigo o tu QR de confirmacion cuando llegues.\n\n";
    }
    
    $body .= "Adjuntamos un archivo de calendario (.ics) para que puedas agregar esta cita a tu agenda.\n\n";
    $body .= "Si deseas reprogramar, visita: " . $context['rescheduleUrl'] . "\n\n";
    $body .= "Si tienes dudas, responde este correo o escribe por WhatsApp: " . $whatsapp . ".\n\n";
    $body .= $brandName . "\n" . $address;

    return $body;
}

/**
 * @param array<string,mixed> $appointment
 */
function build_reminder_email_html(array $appointment): string
{
    $context = build_appointment_email_context($appointment);
    $name = htmlspecialchars($context['name'], ENT_QUOTES, 'UTF-8');
    $dateLabel = htmlspecialchars($context['dateLabel'], ENT_QUOTES, 'UTF-8');
    $timeLabel = htmlspecialchars($context['timeLabel'], ENT_QUOTES, 'UTF-8');

    $content = '<h2 style="margin:0 0 20px;color:#0d1a2f;font-size:20px;">Recordatorio de Cita</h2>'
        . '<p style="margin:0 0 15px;line-height:1.6;color:#555;">Hola <strong>' . $name . '</strong>,</p>'
        . '<p style="margin:0 0 20px;line-height:1.6;color:#555;">Te recordamos que tienes una cita programada para mañana. ¡Te esperamos!</p>'
        . build_appointment_detail_table(
            $context,
            'width:100%;border-collapse:separate;border-spacing:0;background-color:#f8fafc;border-radius:8px;padding:15px;margin-bottom:25px;',
            'padding:8px 0;color:#64748b;font-weight:bold;width:120px;',
            'padding:8px 0;color:#334155;'
        )
        . build_email_cta_button($context['rescheduleUrl'], 'Reprogramar Cita')
        . '<p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Nos vemos pronto.</p>';

    return get_email_template('Recordatorio de Cita', $content, 'Tu cita es mañana a las ' . $timeLabel);
}

/**
 * @param array<string,mixed> $appointment
 */
function build_reminder_email_text(array $appointment): string
{
    $context = build_appointment_email_context($appointment);

    $profile = function_exists('read_turnero_clinic_profile') ? read_turnero_clinic_profile() : [];
    $brandName = !empty($profile['branding']['name']) ? $profile['branding']['name'] : AppConfig::BRAND_NAME;
    $whatsapp = !empty($profile['branding']['whatsapp']) ? $profile['branding']['whatsapp'] : AppConfig::WHATSAPP_NUMBER;

    $body = "Hola " . $context['name'] . ",\n\n";
    $body .= "Te recordamos que tienes una cita programada para mañana.\n\n";
    $body .= build_appointment_detail_text($context, true);
    $body .= "Te esperamos. ¡Gracias por confiar en nosotros!\n\n";
    $body .= "- Equipo " . $brandName . "\n";
    $body .= "WhatsApp: " . $whatsapp;

    return $body;
}

/**
 * @param array<string,mixed> $appointment
 */
function build_cancellation_email_html(array $appointment): string
{
    $context = build_appointment_email_context($appointment);
    $name = htmlspecialchars($context['name'], ENT_QUOTES, 'UTF-8');
    $bookingUrl = AppConfig::BASE_URL . '/#citas';

    $content = '<h2 style="margin:0 0 20px;color:#ef4444;font-size:20px;">Cita Cancelada</h2>'
        . '<p style="margin:0 0 15px;line-height:1.6;color:#555;">Hola <strong>' . $name . '</strong>,</p>'
        . '<p style="margin:0 0 20px;line-height:1.6;color:#555;">Tu cita ha sido cancelada.</p>'
        . build_appointment_detail_table(
            $context,
            'width:100%;border-collapse:separate;border-spacing:0;background-color:#fef2f2;border-radius:8px;padding:15px;margin-bottom:25px;',
            'padding:8px 0;color:#991b1b;font-weight:bold;width:120px;',
            'padding:8px 0;color:#7f1d1d;'
        )
        . '<p style="margin:0 0 25px;line-height:1.6;color:#555;">Si deseas agendar una nueva cita, puedes hacerlo en nuestro sitio web o contactarnos por WhatsApp.</p>'
        . build_email_cta_button($bookingUrl, 'Agendar Nueva Cita');

    return get_email_template('Cita Cancelada', $content, 'Tu cita ha sido cancelada');
}

/**
 * @param array<string,mixed> $appointment
 */
function build_cancellation_email_text(array $appointment): string
{
    $context = build_appointment_email_context($appointment);

    $profile = function_exists('read_turnero_clinic_profile') ? read_turnero_clinic_profile() : [];
    $brandName = !empty($profile['branding']['name']) ? $profile['branding']['name'] : AppConfig::BRAND_NAME;
    $whatsapp = !empty($profile['branding']['whatsapp']) ? $profile['branding']['whatsapp'] : AppConfig::WHATSAPP_NUMBER;

    $body = "Hola " . $context['name'] . ",\n\n";
    $body .= "Tu cita ha sido cancelada.\n\n";
    $body .= "Detalles de la cita cancelada:\n";
    $body .= build_appointment_detail_text($context, false);
    $body .= "Si deseas reprogramar, visita " . AppConfig::BASE_URL . "/#citas o escríbenos por WhatsApp: " . $whatsapp . ".\n\n";
    $body .= "Gracias por confiar en nosotros.\n\n";
    $body .= "- Equipo " . $brandName;

    return $body;
}
/**
 * Sends patient confirmation WhatsApp.
 *
 * @param array<string,mixed> $appointment
 */
function maybe_send_appointment_whatsapp(array $appointment): bool
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

    $context = build_appointment_email_context($appointment);
    $prepInstructions = get_service_preparation_instructions((string) ($appointment['service'] ?? ''));
    
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

/**
 * Sends patient confirmation email and optional ICS attachment, plus WhatsApp.
 *
 * @param array<string,mixed> $appointment
 */
function maybe_send_appointment_email(array $appointment): bool
{
    // WhatsApp notification
    maybe_send_appointment_whatsapp($appointment);

    $subject = build_email_subject('Confirmacion de cita');
    $htmlBody = build_appointment_email_html($appointment);
    $textBody = build_appointment_email_text($appointment);
    $icsContent = generate_ics_content($appointment);
    $attachments = [];
    if ($icsContent !== '') {
        $attachments[] = [
            'content' => $icsContent,
            'name' => 'cita-pielarmonia.ics',
            'type' => 'text/calendar; charset=utf-8; method=PUBLISH',
            'encoding' => 'base64'
        ];
    }

    return send_mail_to_recipient(
        (string) ($appointment['email'] ?? ''),
        $subject,
        $htmlBody,
        true,
        $attachments,
        $textBody
    );
}

/**
 * Sends a plain-text admin notification when a new appointment is created.
 *
 * @param array<string,mixed> $appointment
 */
function maybe_send_admin_notification(array $appointment): bool
{
    $adminEmail = AppConfig::getAdminEmail();
    if (email_recipient_or_empty($adminEmail) === '') {
        error_log('Aurora Derm: AURORADERM_ADMIN_EMAIL invalido');
        return false;
    }

    $subject = build_email_subject('Nueva cita agendada');
    $body = build_notification_body(
        "Se ha agendado una nueva cita:\n\n",
        build_admin_appointment_notification_rows($appointment),
        "\nFecha de registro: " . local_date('d/m/Y H:i') . "\n"
    );

    return send_mail_to_recipient($adminEmail, $subject, $body);
}

/**
 * Sends patient cancellation confirmation email.
 *
 * @param array<string,mixed> $appointment
 */
function maybe_send_cancellation_email(array $appointment): bool
{
    $subject = build_email_subject('Cita cancelada');
    $htmlBody = build_cancellation_email_html($appointment);
    $textBody = build_cancellation_email_text($appointment);

    return send_mail_to_recipient(
        (string) ($appointment['email'] ?? ''),
        $subject,
        $htmlBody,
        true,
        [],
        $textBody
    );
}

/**
 * Sends callback-request notification to admin email.
 *
 * @param array<string,mixed> $callback
 */
function maybe_send_callback_admin_notification(array $callback): bool
{
    $adminEmail = AppConfig::getAdminEmail();
    if (email_recipient_or_empty($adminEmail) === '') {
        return false;
    }

    $subject = build_email_subject('Nueva solicitud de llamada');
    $body = build_notification_body(
        "Un paciente solicita que le llamen:\n\n",
        build_callback_notification_rows($callback),
        "\nPor favor contactar lo antes posible."
    );

    return send_mail_to_recipient($adminEmail, $subject, $body);
}

/**
 * Sends pre-consultation notification to frontdesk/admin email.
 *
 * @param array<string,mixed> $payload
 */
function maybe_send_preconsultation_admin_notification(array $payload): bool
{
    $adminEmail = AppConfig::getAdminEmail();
    if (email_recipient_or_empty($adminEmail) === '') {
        return false;
    }

    $subject = build_email_subject('Nueva preconsulta digital');
    $body = build_notification_body(
        "Se recibio una preconsulta digital desde el sitio web:\n\n",
        build_preconsultation_notification_rows($payload),
        "\nFrontdesk debe revisar el caso y responder por WhatsApp."
    );

    return send_mail_to_recipient($adminEmail, $subject, $body);
}

/**
 * Sends appointment reminder email to the patient.
 *
 * @param array<string,mixed> $appointment
 */
function maybe_send_reminder_email(array $appointment): bool
{
    $subject = build_email_subject('Recordatorio de cita');
    $htmlBody = build_reminder_email_html($appointment);
    $textBody = build_reminder_email_text($appointment);

    return send_mail_to_recipient(
        (string) ($appointment['email'] ?? ''),
        $subject,
        $htmlBody,
        true,
        [],
        $textBody
    );
}

/**
 * Sends patient notification after an appointment is rescheduled.
 *
 * @param array<string,mixed> $appointment
 */
function maybe_send_reschedule_email(array $appointment): bool
{
    $subject = build_email_subject('Cita reprogramada');
    $htmlBody = build_reschedule_email_html($appointment);
    $textBody = build_reschedule_email_text($appointment);

    return send_mail_to_recipient(
        (string) ($appointment['email'] ?? ''),
        $subject,
        $htmlBody,
        true,
        [],
        $textBody
    );
}

/**
 * Sends a reminder email for an expiring gift card.
 *
 * @param array<string,mixed>|object $giftCard
 */
function maybe_send_gift_card_reminder_email($giftCard): bool
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

    $subject = build_email_subject('Tu Gift Card vence pronto');
    
    $body = "Hola,\n\n";
    $body .= "Te recordamos que tienes una Gift Card con saldo pendiente de $" . $amount . " en " . $brandName . ".\n\n";
    $body .= "El código es: " . $code . "\n";
    
    if (!empty($cardArray['expires_at'])) {
        $body .= "Este saldo vencerá el " . substr($cardArray['expires_at'], 0, 10) . ".\n\n";
    }
    
    $body .= "Puedes usar este saldo en tus próximos tratamientos dermatológicos.\n";
    $body .= "Visita " . AppConfig::BASE_URL . "/#citas o contáctanos para agendar.\n\n";
    $body .= "Saludos,\n" . $brandName . "\n";
    
    return send_mail_to_recipient($recipient, $subject, $body, false);
}
