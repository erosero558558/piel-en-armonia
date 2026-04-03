<?php

declare(strict_types=1);

final class EmailTemplateService
{
public static function generate_ics_content(array $appointment): string
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

public static function get_email_template(string $title, string $content, string $preheader = ''): string
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

public static function email_recipient_or_empty(string $email): string
{
    $recipient = trim($email);
    if ($recipient === '' || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
        return '';
    }

    return $recipient;
}

public static function build_email_subject(string $subject): string
{
    $profile = function_exists('read_turnero_clinic_profile') ? read_turnero_clinic_profile() : [];
    $brandName = !empty($profile['branding']['name']) ? $profile['branding']['name'] : AppConfig::BRAND_NAME;
    return $subject . ' - ' . $brandName;
}

public static function build_appointment_email_context(array $appointment): array
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
            ? rtrim(AppConfig::BASE_URL, '/') . '/es/reservar/?reschedule=' . rawurlencode($rescheduleToken)
            : rtrim(AppConfig::BASE_URL, '/') . '/es/reservar/',
    ];
}

public static function build_email_detail_rows(array $rows, string $labelStyle, string $valueStyle): string
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

public static function build_appointment_detail_rows(array $context): array
{
    return [
        ['label' => 'Servicio', 'value' => $context['serviceLabel']],
        ['label' => 'Doctor', 'value' => $context['doctorLabel']],
        ['label' => 'Fecha', 'value' => $context['dateLabel']],
        ['label' => 'Hora', 'value' => $context['timeLabel']],
    ];
}

public static function build_appointment_detail_table(array $context, string $tableStyle, string $labelStyle, string $valueStyle): string
{
    return '<table style="' . $tableStyle . '">'
        . self::build_email_detail_rows(self::build_appointment_detail_rows($context), $labelStyle, $valueStyle)
        . '</table>';
}

public static function build_email_cta_button(string $href, string $label): string
{
    $profile = function_exists('read_turnero_clinic_profile') ? read_turnero_clinic_profile() : [];
    $primaryColor = !empty($profile['branding']['theme']['primary_color']) ? $profile['branding']['theme']['primary_color'] : '#0284c7';

    return '<div style="text-align:center;margin-bottom:30px;">'
        . '<a href="' . htmlspecialchars($href, ENT_QUOTES, 'UTF-8') . '" style="display:inline-block;background-color:' . htmlspecialchars($primaryColor, ENT_QUOTES, 'UTF-8') . ';color:#ffffff;text-decoration:none;padding:12px 25px;border-radius:6px;font-weight:bold;">'
        . htmlspecialchars($label, ENT_QUOTES, 'UTF-8')
        . '</a>'
        . '</div>';
}

public static function build_appointment_detail_text(array $context, bool $includeRescheduleLink = false): string
{
    $body = self::build_text_rows(self::build_appointment_detail_rows($context));
    $body .= "\n";

    if ($includeRescheduleLink && $context['rescheduleToken'] !== '') {
        $body .= "Si necesitas reprogramar, usa este enlace:\n" . $context['rescheduleUrl'] . "\n\n";
    }

    return $body;
}

public static function build_text_rows(array $rows): string
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

public static function build_notification_body(string $intro, array $rows, string $footer = ''): string
{
    $body = $intro;
    $body .= self::build_text_rows($rows);
    $body .= $footer;

    return $body;
}

public static function build_admin_appointment_notification_rows(array $appointment): array
{
    $context = self::build_appointment_email_context($appointment);
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

public static function build_reschedule_notification_rows(array $context): array
{
    return [
        ['label' => 'Servicio', 'value' => $context['serviceLabel']],
        ['label' => 'Doctor', 'value' => $context['doctorLabel']],
        ['label' => 'Nueva fecha', 'value' => $context['dateLabel']],
        ['label' => 'Nueva hora', 'value' => $context['timeLabel']],
    ];
}

public static function build_reschedule_notification_footer(array $context): string
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

public static function build_reschedule_email_text(array $appointment): string
{
    $context = self::build_appointment_email_context($appointment);

    return self::build_notification_body(
        "Hola " . $context['name'] . ",\n\n" . "Tu cita ha sido reprogramada exitosamente.\n\n",
        self::build_reschedule_notification_rows($context),
        self::build_reschedule_notification_footer($context)
    );
}

public static function build_reschedule_email_html(array $appointment): string
{
    $context = self::build_appointment_email_context($appointment);
    $name = htmlspecialchars($context['name'], ENT_QUOTES, 'UTF-8');
    $dateLabel = htmlspecialchars($context['dateLabel'], ENT_QUOTES, 'UTF-8');

    $rows = self::build_reschedule_notification_rows($context);
    $content = '<h2 style="margin:0 0 20px;color:#0d1a2f;font-size:20px;">Cita Reprogramada</h2>'
        . '<p style="margin:0 0 15px;line-height:1.6;color:#555;">Hola <strong>' . $name . '</strong>,</p>'
        . '<p style="margin:0 0 20px;line-height:1.6;color:#555;">Tu cita fue reprogramada exitosamente. Estos son los nuevos datos:</p>'
        . '<table style="width:100%;border-collapse:separate;border-spacing:0;background-color:#f8fafc;border-radius:8px;padding:15px;margin-bottom:25px;">'
        . self::build_email_detail_rows(
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
        . self::build_email_cta_button($context['rescheduleUrl'], 'Gestionar cita')
        . '<p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Si necesitas ayuda, responde a este correo.</p>';

    return self::get_email_template(
        'Cita Reprogramada',
        $content,
        'Tu cita fue reprogramada para el ' . $dateLabel
    );
}

public static function split_patient_name(string $fullName): array
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

public static function resolve_case_contact_context(array $store, string $caseId, array $session = []): array
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
    $nameParts = self::split_patient_name(
        (string) ($sessionPatient['name'] ?? $caseSummary['patientLabel'] ?? $matchedAppointment['name'] ?? '')
    );
    $firstName = trim((string) ($patientRecord['firstName'] ?? $nameParts['firstName']));
    $lastName = trim((string) ($patientRecord['lastName'] ?? $nameParts['lastName']));

    return [
        'name' => trim(implode(' ', array_filter([$firstName, $lastName], static fn (string $value): bool => $value !== ''))),
        'email' => self::email_recipient_or_empty((string) ($sessionPatient['email'] ?? $caseSummary['contactEmail'] ?? $matchedAppointment['email'] ?? '')),
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

public static function normalize_prescription_email_items(array $prescription): array
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

public static function build_post_consultation_followup_email_html(array $appointment): string
{
    $context = self::build_appointment_email_context($appointment);
    $portalUrl = rtrim(AppConfig::BASE_URL, '/') . '/es/portal/';
    $name = htmlspecialchars($context['name'], ENT_QUOTES, 'UTF-8');
    $whatsapp = htmlspecialchars((string) ((read_turnero_clinic_profile()['branding']['whatsapp'] ?? AppConfig::WHATSAPP_NUMBER)), ENT_QUOTES, 'UTF-8');

    $content = '<h2 style="margin:0 0 20px;color:#0d1a2f;font-size:20px;">Seguimiento de tu consulta</h2>'
        . '<p style="margin:0 0 15px;line-height:1.6;color:#555;">Hola <strong>' . $name . '</strong>,</p>'
        . '<p style="margin:0 0 20px;line-height:1.6;color:#555;">Queremos saber cómo te has sentido después de tu consulta. Si sigues con molestias o tienes dudas sobre tus indicaciones, estamos para ayudarte.</p>'
        . self::build_appointment_detail_table(
            $context,
            'width:100%;border-collapse:separate;border-spacing:0;background-color:#f8fafc;border-radius:8px;padding:15px;margin-bottom:25px;',
            'padding:8px 0;color:#64748b;font-weight:bold;width:120px;',
            'padding:8px 0;color:#334155;'
        )
        . self::build_email_cta_button($portalUrl, 'Abrir portal del paciente')
        . '<p style="margin:0;line-height:1.6;color:#555;">También puedes responder este correo o escribirnos por WhatsApp: <strong>' . $whatsapp . '</strong>.</p>';

    return self::get_email_template('Seguimiento de tu consulta', $content, 'Queremos saber cómo te has sentido después de tu consulta');
}

public static function build_post_consultation_followup_email_text(array $appointment): string
{
    $context = self::build_appointment_email_context($appointment);
    $portalUrl = rtrim(AppConfig::BASE_URL, '/') . '/es/portal/';

    $profile = function_exists('read_turnero_clinic_profile') ? read_turnero_clinic_profile() : [];
    $brandName = !empty($profile['branding']['name']) ? $profile['branding']['name'] : AppConfig::BRAND_NAME;
    $whatsapp = !empty($profile['branding']['whatsapp']) ? $profile['branding']['whatsapp'] : AppConfig::WHATSAPP_NUMBER;

    $body = "Hola " . $context['name'] . ",\n\n";
    $body .= "Queremos saber como te has sentido despues de tu consulta.\n\n";
    $body .= self::build_appointment_detail_text($context, false);
    $body .= "Si sigues con molestias o tienes dudas, puedes responder este correo.\n";
    $body .= "Portal del paciente: " . $portalUrl . "\n";
    $body .= "WhatsApp: " . $whatsapp . "\n\n";
    $body .= "- Equipo " . $brandName;

    return $body;
}

public static function build_prescription_ready_email_html(array $contact, array $prescription, string $portalUrl): string
{
    $medications = self::normalize_prescription_email_items($prescription);
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
        . self::build_email_detail_rows([
            ['label' => 'Profesional', 'value' => $doctorLabel],
            ['label' => 'Emitida', 'value' => $issuedLabel],
            ['label' => 'Items', 'value' => (string) count($medications)],
        ], 'padding:8px 0;color:#64748b;font-weight:bold;width:120px;', 'padding:8px 0;color:#334155;')
        . '</table>'
        . ($listItems !== ''
            ? '<div style="margin:0 0 24px;padding:16px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;"><p style="margin:0 0 12px;font-weight:700;color:#0f172a;">Resumen de la receta</p><ul style="margin:0;padding-left:20px;">' . $listItems . '</ul></div>'
            : '')
        . self::build_email_cta_button($portalUrl, 'Abrir portal del paciente')
        . '<p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Si tienes dudas sobre la indicación o la dosis, responde este correo.</p>';

    return self::get_email_template('Tu receta esta lista', $content, 'Tu receta medica ya esta disponible');
}

public static function build_prescription_ready_email_text(array $contact, array $prescription, string $portalUrl): string
{
    $medications = self::normalize_prescription_email_items($prescription);
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

public static function build_callback_notification_rows(array $callback): array
{
    return [
        ['label' => 'Teléfono', 'value' => $callback['telefono'] ?? '-'],
        ['label' => 'Preferencia', 'value' => $callback['preferencia'] ?? '-'],
        ['label' => 'Fecha de solicitud', 'value' => local_date('d/m/Y H:i')],
    ];
}

public static function build_preconsultation_notification_rows(array $payload): array
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

public static function get_service_preparation_instructions(string $service): string
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

public static function build_appointment_email_html(array $appointment): string
{
    $context = self::build_appointment_email_context($appointment);
    $name = htmlspecialchars($context['name'], ENT_QUOTES, 'UTF-8');
    $dateLabel = htmlspecialchars($context['dateLabel'], ENT_QUOTES, 'UTF-8');
    $checkinToken = htmlspecialchars($context['checkinToken'], ENT_QUOTES, 'UTF-8');
    $prepInstructions = htmlspecialchars(self::get_service_preparation_instructions((string) ($appointment['service'] ?? '')), ENT_QUOTES, 'UTF-8');

    $whatsappPhone = preg_replace('/[^0-9]/', '', (string) ((read_turnero_clinic_profile()['branding']['whatsapp'] ?? AppConfig::WHATSAPP_NUMBER)));
    $waText = rawurlencode('Confirmo mi cita del ' . $context['dateLabel'] . ' a las ' . $context['timeLabel']);
    $waDeeplink = 'https://wa.me/' . $whatsappPhone . '?text=' . $waText;
    $waBtn = $whatsappPhone !== '' ? self::build_email_cta_button($waDeeplink, 'Confirmar asistencia por WhatsApp') : '';

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
        . self::build_appointment_detail_table(
            $context,
            'width:100%;border-collapse:separate;border-spacing:0;background-color:#f8fafc;border-radius:8px;padding:15px;margin-bottom:25px;',
            'padding:8px 0;color:#64748b;font-weight:bold;width:120px;',
            'padding:8px 0;color:#334155;'
        )
        . $prepBlock
        . $checkinBlock
        . $waBtn
        . '<p style="margin:25px 0 25px;line-height:1.6;color:#555;">Adjuntamos un archivo de calendario (.ics) para que puedas agregar esta cita a tu agenda.</p>'
        . self::build_email_cta_button($context['rescheduleUrl'], 'Reprogramar Cita')
        . '<p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Si necesitas ayuda, responde a este correo.</p>';

    return self::get_email_template('Confirmación de Cita', $content, 'Tu cita ha sido confirmada para el ' . $dateLabel);
}

public static function build_appointment_email_text(array $appointment): string
{
    $context = self::build_appointment_email_context($appointment);
    $prepInstructions = self::get_service_preparation_instructions((string) ($appointment['service'] ?? ''));

    $body = "Hola " . $context['name'] . ",\n\n";
    $body .= "Tu cita ha sido registrada exitosamente.\n\n";
    $body .= "Detalles:\n";
    $body .= self::build_appointment_detail_text($context, false);
    
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

public static function build_reminder_email_html(array $appointment): string
{
    $context = self::build_appointment_email_context($appointment);
    $name = htmlspecialchars($context['name'], ENT_QUOTES, 'UTF-8');
    $dateLabel = htmlspecialchars($context['dateLabel'], ENT_QUOTES, 'UTF-8');
    $timeLabel = htmlspecialchars($context['timeLabel'], ENT_QUOTES, 'UTF-8');

    $content = '<h2 style="margin:0 0 20px;color:#0d1a2f;font-size:20px;">Recordatorio de Cita</h2>'
        . '<p style="margin:0 0 15px;line-height:1.6;color:#555;">Hola <strong>' . $name . '</strong>,</p>'
        . '<p style="margin:0 0 20px;line-height:1.6;color:#555;">Te recordamos que tienes una cita programada para mañana. ¡Te esperamos!</p>'
        . self::build_appointment_detail_table(
            $context,
            'width:100%;border-collapse:separate;border-spacing:0;background-color:#f8fafc;border-radius:8px;padding:15px;margin-bottom:25px;',
            'padding:8px 0;color:#64748b;font-weight:bold;width:120px;',
            'padding:8px 0;color:#334155;'
        )
        . self::build_email_cta_button($context['rescheduleUrl'], 'Reprogramar Cita')
        . '<p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Nos vemos pronto.</p>';

    return self::get_email_template('Recordatorio de Cita', $content, 'Tu cita es mañana a las ' . $timeLabel);
}

public static function build_reminder_email_text(array $appointment): string
{
    $context = self::build_appointment_email_context($appointment);

    $profile = function_exists('read_turnero_clinic_profile') ? read_turnero_clinic_profile() : [];
    $brandName = !empty($profile['branding']['name']) ? $profile['branding']['name'] : AppConfig::BRAND_NAME;
    $whatsapp = !empty($profile['branding']['whatsapp']) ? $profile['branding']['whatsapp'] : AppConfig::WHATSAPP_NUMBER;

    $body = "Hola " . $context['name'] . ",\n\n";
    $body .= "Te recordamos que tienes una cita programada para mañana.\n\n";
    $body .= self::build_appointment_detail_text($context, true);
    $body .= "Te esperamos. ¡Gracias por confiar en nosotros!\n\n";
    $body .= "- Equipo " . $brandName . "\n";
    $body .= "WhatsApp: " . $whatsapp;

    return $body;
}

public static function build_cancellation_email_html(array $appointment): string
{
    $context = self::build_appointment_email_context($appointment);
    $name = htmlspecialchars($context['name'], ENT_QUOTES, 'UTF-8');
    $bookingUrl = rtrim(AppConfig::BASE_URL, '/') . '/es/reservar/';

    $content = '<h2 style="margin:0 0 20px;color:#ef4444;font-size:20px;">Cita Cancelada</h2>'
        . '<p style="margin:0 0 15px;line-height:1.6;color:#555;">Hola <strong>' . $name . '</strong>,</p>'
        . '<p style="margin:0 0 20px;line-height:1.6;color:#555;">Tu cita ha sido cancelada.</p>'
        . self::build_appointment_detail_table(
            $context,
            'width:100%;border-collapse:separate;border-spacing:0;background-color:#fef2f2;border-radius:8px;padding:15px;margin-bottom:25px;',
            'padding:8px 0;color:#991b1b;font-weight:bold;width:120px;',
            'padding:8px 0;color:#7f1d1d;'
        )
        . '<p style="margin:0 0 25px;line-height:1.6;color:#555;">Si deseas agendar una nueva cita, puedes hacerlo en nuestro sitio web o contactarnos por WhatsApp.</p>'
        . self::build_email_cta_button($bookingUrl, 'Agendar Nueva Cita');

    return self::get_email_template('Cita Cancelada', $content, 'Tu cita ha sido cancelada');
}

public static function build_cancellation_email_text(array $appointment): string
{
    $context = self::build_appointment_email_context($appointment);

    $profile = function_exists('read_turnero_clinic_profile') ? read_turnero_clinic_profile() : [];
    $brandName = !empty($profile['branding']['name']) ? $profile['branding']['name'] : AppConfig::BRAND_NAME;
    $whatsapp = !empty($profile['branding']['whatsapp']) ? $profile['branding']['whatsapp'] : AppConfig::WHATSAPP_NUMBER;

    $body = "Hola " . $context['name'] . ",\n\n";
    $body .= "Tu cita ha sido cancelada.\n\n";
    $body .= "Detalles de la cita cancelada:\n";
    $body .= self::build_appointment_detail_text($context, false);
    $body .= "Si deseas reprogramar, visita " . rtrim(AppConfig::BASE_URL, '/') . "/es/reservar/ o escríbenos por WhatsApp: " . $whatsapp . ".\n\n";
    $body .= "Gracias por confiar en nosotros.\n\n";
    $body .= "- Equipo " . $brandName;

    return $body;
}

}
