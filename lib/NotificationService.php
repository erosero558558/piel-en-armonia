<?php

declare(strict_types=1);

require_once __DIR__ . '/PushService.php';

final class NotificationService
{
    public static function scope(): string
    {
        return 'appointment_reminder_24h';
    }

    public static function subscriptionCriteriaForSnapshot(array $snapshot): array
    {
        $patientId = trim((string) ($snapshot['patientId'] ?? ''));
        $patientCaseId = trim((string) ($snapshot['patientCaseId'] ?? ''));
        $subject = trim((string) ($snapshot['subject'] ?? ''));

        $criteria = [
            'channel' => 'patient_portal',
            'scope' => self::scope(),
        ];

        if ($patientId !== '') {
            $criteria['patientId'] = $patientId;
            return $criteria;
        }

        if ($patientCaseId !== '') {
            $criteria['patientCaseId'] = $patientCaseId;
            return $criteria;
        }

        if ($subject !== '') {
            $criteria['subject'] = $subject;
        }

        return $criteria;
    }

    public static function subscriptionMetaForSnapshot(array $snapshot, string $locale = 'es'): array
    {
        $locale = strtolower(trim($locale));
        if (!in_array($locale, ['es', 'en'], true)) {
            $locale = 'es';
        }

        return [
            'channel' => 'patient_portal',
            'scope' => self::scope(),
            'subject' => trim((string) ($snapshot['subject'] ?? '')),
            'patientId' => trim((string) ($snapshot['patientId'] ?? '')),
            'patientCaseId' => trim((string) ($snapshot['patientCaseId'] ?? '')),
            'phone' => self::normalizePhone((string) ($snapshot['phone'] ?? '')),
            'locale' => $locale,
        ];
    }

    public static function queueAppointmentPushReminders(array &$store, array $options = []): array
    {
        $today = self::normalizeDate((string) ($options['today'] ?? local_date('Y-m-d')));
        if ($today === '') {
            $today = local_date('Y-m-d');
        }

        $tomorrow = self::normalizeDate((string) ($options['tomorrow'] ?? ''));
        if ($tomorrow === '') {
            try {
                $tomorrow = (new DateTimeImmutable($today))->modify('+1 day')->format('Y-m-d');
            } catch (Throwable $error) {
                $tomorrow = date('Y-m-d', strtotime('+1 day'));
            }
        }

        $appointments = isset($store['appointments']) && is_array($store['appointments'])
            ? array_values($store['appointments'])
            : [];
        $push = new PushService();

        $summary = [
            'today' => $today,
            'tomorrow' => $tomorrow,
            'queued' => 0,
            'sentDevices' => 0,
            'alreadySent' => 0,
            'notTomorrow' => 0,
            'notConfirmed' => 0,
            'missingTime' => 0,
            'noSubscribers' => 0,
            'notConfigured' => 0,
            'failed' => 0,
            'subscriptionsMatched' => 0,
            'candidates' => 0,
            'skipped' => 0,
        ];

        foreach ($appointments as $index => $appointment) {
            if (!is_array($appointment)) {
                continue;
            }

            $summary['candidates']++;

            $status = trim((string) ($appointment['status'] ?? ''));
            if ($status !== 'confirmed') {
                $summary['notConfirmed']++;
                $summary['skipped']++;
                continue;
            }

            $date = self::normalizeDate((string) ($appointment['date'] ?? ''));
            if ($date !== $tomorrow) {
                $summary['notTomorrow']++;
                $summary['skipped']++;
                continue;
            }

            $time = trim((string) ($appointment['time'] ?? ''));
            if ($time === '') {
                $summary['missingTime']++;
                $summary['skipped']++;
                continue;
            }

            if (trim((string) ($appointment['portalPushReminderSentAt'] ?? '')) !== '') {
                $summary['alreadySent']++;
                $summary['skipped']++;
                continue;
            }

            $criteria = self::criteriaForAppointment($appointment);
            if ($criteria === []) {
                $summary['noSubscribers']++;
                $summary['skipped']++;
                continue;
            }

            $matchedSubscriptions = $push->subscriptionsCount($criteria);
            if ($matchedSubscriptions === 0) {
                $summary['noSubscribers']++;
                $summary['skipped']++;
                continue;
            }

            if (!$push->canSendNotifications()) {
                $summary['notConfigured']++;
                $summary['skipped']++;
                continue;
            }

            $result = $push->sendNotification(self::buildAppointmentReminderPayload($appointment), $criteria);
            $summary['subscriptionsMatched'] += $matchedSubscriptions;
            $summary['sentDevices'] += (int) ($result['success'] ?? 0);

            if ((int) ($result['success'] ?? 0) > 0) {
                $appointment['portalPushReminderSentAt'] = local_date('c');
                $appointment['portalPushReminderChannel'] = 'web_push';
                $appointment['portalPushReminderDevices'] = (int) ($result['success'] ?? 0);
                $appointments[$index] = $appointment;
                $summary['queued']++;
                continue;
            }

            $summary['failed'] += max(1, (int) ($result['failed'] ?? 0));
        }

        $store['appointments'] = $appointments;
        return $summary;
    }

    private static function criteriaForAppointment(array $appointment): array
    {
        $base = [
            'channel' => 'patient_portal',
            'scope' => self::scope(),
        ];

        $patientId = trim((string) ($appointment['patientId'] ?? ''));
        if ($patientId !== '') {
            $base['patientId'] = $patientId;
            return $base;
        }

        $patientCaseId = trim((string) ($appointment['patientCaseId'] ?? ($appointment['caseId'] ?? '')));
        if ($patientCaseId !== '') {
            $base['patientCaseId'] = $patientCaseId;
            return $base;
        }

        $subjects = self::subjectCandidatesForAppointment($appointment);
        if ($subjects !== []) {
            $base['subject'] = $subjects;
            return $base;
        }

        return [];
    }

    private static function subjectCandidatesForAppointment(array $appointment): array
    {
        $candidates = [];
        $patientId = trim((string) ($appointment['patientId'] ?? ''));
        if ($patientId !== '') {
            $candidates[] = $patientId;
        }

        $phone = self::normalizePhone((string) ($appointment['phone'] ?? ''));
        if ($phone !== '') {
            $candidates[] = 'phone:' . $phone;
        }

        return array_values(array_unique(array_filter($candidates, static function (string $value): bool {
            return $value !== '';
        })));
    }

    private static function buildAppointmentReminderPayload(array $appointment): array
    {
        $context = function_exists('build_appointment_email_context')
            ? build_appointment_email_context($appointment)
            : [
                'doctorLabel' => (string) ($appointment['doctor'] ?? 'su especialista'),
                'timeLabel' => (string) ($appointment['time'] ?? ''),
                'rescheduleUrl' => self::portalHomeUrl(),
            ];

        $doctor = trim((string) ($context['doctorLabel'] ?? 'su especialista'));
        $time = trim((string) ($context['timeLabel'] ?? ($appointment['time'] ?? '')));
        $portalUrl = self::portalHomeUrl();
        $rescheduleUrl = trim((string) ($context['rescheduleUrl'] ?? $portalUrl));

        return [
            'title' => 'Aurora Derm',
            'body' => 'Mañana tienes consulta con ' . $doctor . ' a las ' . $time . '.',
            'url' => $portalUrl,
            'rescheduleUrl' => $rescheduleUrl !== '' ? $rescheduleUrl : $portalUrl,
            'type' => self::scope(),
            'tag' => 'appointment-reminder-' . (string) ($appointment['id'] ?? 'portal'),
            'appointmentId' => (int) ($appointment['id'] ?? 0),
            'actions' => [
                ['action' => 'open', 'title' => 'Ver cita'],
                ['action' => 'reschedule', 'title' => 'Reagendar'],
            ],
        ];
    }

    private static function portalHomeUrl(): string
    {
        $baseUrl = defined('AppConfig::BASE_URL')
            ? rtrim((string) AppConfig::BASE_URL, '/')
            : '';

        return $baseUrl !== '' ? $baseUrl . '/es/portal/' : '/es/portal/';
    }

    private static function normalizeDate(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        $timestamp = strtotime($value);
        if ($timestamp === false) {
            return '';
        }

        return date('Y-m-d', $timestamp);
    }

    private static function normalizePhone(string $value): string
    {
        $digits = preg_replace('/\D+/', '', $value);
        return is_string($digits) ? $digits : '';
    }

    public static function sendAppointmentCreatedPush(array $appointment): void
    {
        $criteria = self::criteriaForAppointment($appointment);
        if ($criteria === []) {
            return;
        }

        $context = function_exists('build_appointment_email_context')
            ? build_appointment_email_context($appointment)
            : [
                'doctorLabel' => (string) ($appointment['doctor'] ?? 'su especialista'),
                'timeLabel'   => (string) ($appointment['time'] ?? ''),
                'dateLabel'   => (string) ($appointment['date'] ?? ''),
            ];

        $doctor = trim((string) ($context['doctorLabel'] ?? 'su especialista'));
        $time = trim((string) ($context['timeLabel'] ?? ($appointment['time'] ?? '')));
        $date = trim((string) ($context['dateLabel'] ?? ($appointment['date'] ?? '')));

        $payload = [
            'category' => 'appointments',
            'title' => 'Cita Reservada',
            'body' => "Hemos confirmado tu cita con {$doctor} el {$date} a las {$time}.",
            'data' => [
                'type' => 'appointment_created',
                'appointmentId' => $appointment['id'] ?? null,
                'url' => '/patient/appointments'
            ]
        ];

        self::push($payload, $criteria);
    }

    public static function sendQueueCallNextPush(array $ticket, int $room): void
    {
        $patientId = trim((string) ($ticket['patientId'] ?? $ticket['patient_id'] ?? ''));
        if ($patientId === '') {
            return;
        }

        $code = trim((string) ($ticket['code'] ?? ''));
        $criteria = [
            'patientId' => $patientId,
            'channel' => 'patient_portal',
        ];

        $payload = [
            'category' => 'queue_updates',
            'title' => '¡Es tu turno!',
            'body' => "Turno {$code}, por favor acércate al consultorio {$room}.",
            'data' => [
                'type' => 'queue_call_next',
                'ticketCode' => $code,
                'room' => $room,
                'url' => '/patient/queue'
            ]
        ];

        self::push($payload, $criteria);
    }

    public static function sendDocumentReadyPush(array $patient, string $docType, string $docId): void
    {
        $patientId = trim((string) ($patient['id'] ?? ''));
        if ($patientId === '') {
            $phone = self::normalizePhone((string) ($patient['phone'] ?? ''));
            if ($phone === '') {
                return; // no target
            }
            $criteria = [
                'phone' => $phone,
                'channel' => 'patient_portal',
            ];
        } else {
            $criteria = [
                'patientId' => $patientId,
                'channel' => 'patient_portal',
            ];
        }

        $typeLabel = match($docType) {
            'prescription' => 'receta médica',
            'certificate' => 'certificado médico',
            'order' => 'orden de laboratorio',
            default => 'documento',
        };

        $payload = [
            'category' => 'documents_ready',
            'title' => 'Documento Listo',
            'body' => "Tu {$typeLabel} ya está disponible en el portal.",
            'data' => [
                'type' => 'document_ready',
                'docType' => $docType,
                'docId' => $docId,
                'url' => '/patient/documents'
            ]
        ];

        self::push($payload, $criteria);
    }

    public static function sendLabResultReadyPush(array $patient, string $labName): void
    {
        $patientId = trim((string) ($patient['id'] ?? ''));
        if ($patientId === '') {
            $phone = self::normalizePhone((string) ($patient['phone'] ?? ''));
            if ($phone === '') {
                return;
            }
            $criteria = [
                'phone' => $phone,
                'channel' => 'patient_portal',
            ];
        } else {
            $criteria = [
                'patientId' => $patientId,
                'channel' => 'patient_portal',
            ];
        }

        $payload = [
            'category' => 'lab_results_ready',
            'title' => 'Resultados Disponibles',
            'body' => "Sus resultados de {$labName} ya están disponibles en su portal.",
            'data' => [
                'type' => 'lab_result_ready',
                'url' => '/es/portal/historial/'
            ]
        ];

        self::push($payload, $criteria);
    }

    private static function push(array $payload, array $criteria): void
    {
        require_once __DIR__ . '/PushService.php';
        (new PushService())->sendNotification($payload, $criteria);
    }
}
