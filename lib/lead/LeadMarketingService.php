<?php

declare(strict_types=1);

final class LeadMarketingService
{
public static function queueBirthdayGreetings(array &$store, array $options = []): array
    {
        $today = LeadOpsService::normalizeBirthdayDate((string) ($options['today'] ?? local_date('Y-m-d')));
        if ($today === '') {
            $today = local_date('Y-m-d');
        }

        $sentYear = substr($today, 0, 4);
        $birthdayKey = substr($today, 5, 5);

        $store['patient_birthday_messages'] = isset($store['patient_birthday_messages']) && is_array($store['patient_birthday_messages'])
            ? array_values($store['patient_birthday_messages'])
            : [];
        $logEntries = $store['patient_birthday_messages'];
        $sentRegistry = [];

        foreach ($logEntries as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $year = trim((string) ($entry['sentYear'] ?? ''));
            $patientKey = trim((string) ($entry['patientKey'] ?? ''));
            if ($year === '' || $patientKey === '') {
                continue;
            }

            $sentRegistry[$year . '|' . $patientKey] = true;
        }

        $queueAvailable = false;
        if (function_exists('whatsapp_openclaw_repository')) {
            $queueAvailable = true;
        } elseif (file_exists(__DIR__ . '/whatsapp_openclaw/bootstrap.php')) {
            require_once __DIR__ . '/whatsapp_openclaw/bootstrap.php';
            $queueAvailable = function_exists('whatsapp_openclaw_repository');
        }

        $summary = [
            'date' => $today,
            'queued' => 0,
            'alreadySent' => 0,
            'missingPhone' => 0,
            'missingBirthDate' => 0,
            'notBirthday' => 0,
            'queueUnavailable' => 0,
            'candidates' => 0,
        ];

        $seenThisRun = [];

        foreach (self::buildBirthdayGreetingCandidates($store) as $candidate) {
            $summary['candidates']++;

            $birthDate = LeadOpsService::normalizeBirthdayDate((string) ($candidate['birthDate'] ?? ''));
            if ($birthDate === '') {
                $summary['missingBirthDate']++;
                continue;
            }

            if (substr($birthDate, 5, 5) !== $birthdayKey) {
                $summary['notBirthday']++;
                continue;
            }

            $phone = LeadOpsService::normalizeBirthdayPhone((string) ($candidate['phone'] ?? ''));
            if ($phone === '') {
                $summary['missingPhone']++;
                continue;
            }

            $patientKey = trim((string) ($candidate['patientKey'] ?? ''));
            if ($patientKey === '') {
                $patientKey = sha1($phone . '|' . $birthDate);
            }

            $registryKey = $sentYear . '|' . $patientKey;
            if (isset($sentRegistry[$registryKey]) || isset($seenThisRun[$registryKey])) {
                $summary['alreadySent']++;
                continue;
            }

            if (!$queueAvailable) {
                $summary['queueUnavailable']++;
                continue;
            }

            $firstName = LeadOpsService::extractBirthdayFirstName((string) ($candidate['name'] ?? 'Paciente'));
            $text = self::buildBirthdayGreetingText($firstName);
            $record = whatsapp_openclaw_repository()->enqueueOutbox([
                'phone' => $phone,
                'source' => 'system',
                'type' => 'text',
                'text' => $text,
                'status' => 'pending',
                'priority' => 'normal',
                'category' => 'birthday_greeting',
                'template' => 'birthday_greeting',
                'meta' => [
                    'patientKey' => $patientKey,
                    'birthDate' => $birthDate,
                    'sentYear' => $sentYear,
                    'sessionId' => (string) ($candidate['sessionId'] ?? ''),
                    'caseId' => (string) ($candidate['caseId'] ?? ''),
                ],
            ]);

            $logEntries[] = [
                'id' => (string) ($record['id'] ?? ''),
                'patientKey' => $patientKey,
                'sessionId' => (string) ($candidate['sessionId'] ?? ''),
                'caseId' => (string) ($candidate['caseId'] ?? ''),
                'name' => (string) ($candidate['name'] ?? ''),
                'phone' => $phone,
                'birthDate' => $birthDate,
                'sentOn' => $today,
                'sentYear' => $sentYear,
                'channel' => 'whatsapp',
                'outboxId' => (string) ($record['id'] ?? ''),
                'createdAt' => local_date('c'),
            ];
            $seenThisRun[$registryKey] = true;
            $sentRegistry[$registryKey] = true;
            $summary['queued']++;
        }

        $store['patient_birthday_messages'] = array_values($logEntries);
        return $summary;
    }

public static function queueAppointmentReminders(array &$store, array $options = []): array
    {
        $today = LeadOpsService::normalizeBirthdayDate((string) ($options['today'] ?? local_date('Y-m-d')));
        if ($today === '') {
            $today = local_date('Y-m-d');
        }

        $tomorrow = LeadOpsService::normalizeBirthdayDate((string) ($options['tomorrow'] ?? ''));
        if ($tomorrow === '') {
            try {
                $tomorrow = (new DateTimeImmutable($today))->modify('+1 day')->format('Y-m-d');
            } catch (Throwable $e) {
                $tomorrow = date('Y-m-d', strtotime('+1 day'));
            }
        }

        $queueAvailable = false;
        if (function_exists('whatsapp_openclaw_repository')) {
            $queueAvailable = true;
        } elseif (file_exists(__DIR__ . '/whatsapp_openclaw/bootstrap.php')) {
            require_once __DIR__ . '/whatsapp_openclaw/bootstrap.php';
            $queueAvailable = function_exists('whatsapp_openclaw_repository');
        }

        $appointments = isset($store['appointments']) && is_array($store['appointments'])
            ? array_values($store['appointments'])
            : [];

        $summary = [
            'today' => $today,
            'tomorrow' => $tomorrow,
            'queued' => 0,
            'alreadySent' => 0,
            'missingPhone' => 0,
            'missingTime' => 0,
            'notConfirmed' => 0,
            'notTomorrow' => 0,
            'queueUnavailable' => 0,
            'tokensCreated' => 0,
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

            $date = LeadOpsService::normalizeBirthdayDate((string) ($appointment['date'] ?? ''));
            if ($date !== $tomorrow) {
                $summary['notTomorrow']++;
                $summary['skipped']++;
                continue;
            }

            $reminderSentAt = trim((string) ($appointment['reminderSentAt'] ?? ''));
            if ($reminderSentAt !== '') {
                $summary['alreadySent']++;
                $summary['skipped']++;
                continue;
            }

            $phone = LeadOpsService::normalizeBirthdayPhone((string) ($appointment['phone'] ?? ''));
            if ($phone === '') {
                $summary['missingPhone']++;
                $summary['skipped']++;
                continue;
            }

            $time = trim((string) ($appointment['time'] ?? ''));
            if ($time === '') {
                $summary['missingTime']++;
                $summary['skipped']++;
                continue;
            }

            if (!$queueAvailable) {
                $summary['queueUnavailable']++;
                continue;
            }

            if (trim((string) ($appointment['rescheduleToken'] ?? '')) === '') {
                $appointment['rescheduleToken'] = bin2hex(random_bytes(16));
                $summary['tokensCreated']++;
            }

            $text = self::buildAppointmentReminderText($appointment);
            $record = whatsapp_openclaw_repository()->enqueueOutbox([
                'phone' => $phone,
                'source' => 'system',
                'type' => 'text',
                'text' => $text,
                'status' => 'pending',
                'priority' => 'normal',
                'category' => 'appointment_reminder',
                'template' => 'appointment_reminder_24h',
                'meta' => [
                    'appointmentId' => (int) ($appointment['id'] ?? 0),
                    'date' => $date,
                    'time' => $time,
                    'doctor' => (string) ($appointment['doctor'] ?? ''),
                    'rescheduleToken' => (string) ($appointment['rescheduleToken'] ?? ''),
                ],
            ]);

            $appointment['phone'] = $phone;
            $appointment['reminderSentAt'] = local_date('c');
            $appointment['reminderChannel'] = 'whatsapp';
            $appointment['reminderOutboxId'] = (string) ($record['id'] ?? '');
            $appointments[$index] = $appointment;
            $summary['queued']++;
        }

        $store['appointments'] = $appointments;
        return $summary;
    }

public static function queuePostConsultationFollowUps(array &$store, array $options = []): array
    {
        $nowRaw = trim((string) ($options['now'] ?? local_date('c')));
        $now = LeadOpsService::normalizeAppointmentReminderTimestamp($nowRaw);
        if ($now === null) {
            $now = LeadOpsService::normalizeAppointmentReminderTimestamp(local_date('c'));
        }

        $queueAvailable = false;
        if (function_exists('whatsapp_openclaw_repository')) {
            $queueAvailable = true;
        } elseif (file_exists(__DIR__ . '/whatsapp_openclaw/bootstrap.php')) {
            require_once __DIR__ . '/whatsapp_openclaw/bootstrap.php';
            $queueAvailable = function_exists('whatsapp_openclaw_repository');
        }

        $appointments = isset($store['appointments']) && is_array($store['appointments'])
            ? array_values($store['appointments'])
            : [];

        $summary = [
            'now' => $now ? $now->format(DATE_ATOM) : '',
            'queued' => 0,
            'emailSent' => 0,
            'alreadySent' => 0,
            'missingPhone' => 0,
            'missingEmail' => 0,
            'notCompleted' => 0,
            'notDue' => 0,
            'invalidSchedule' => 0,
            'queueUnavailable' => 0,
            'candidates' => 0,
            'skipped' => 0,
        ];

        foreach ($appointments as $index => $appointment) {
            if (!is_array($appointment)) {
                continue;
            }

            $summary['candidates']++;

            $status = trim((string) ($appointment['status'] ?? ''));
            if ($status !== 'completed') {
                $summary['notCompleted']++;
                $summary['skipped']++;
                continue;
            }

            $followUpSentAt = trim((string) ($appointment['followUpSentAt'] ?? ''));
            if ($followUpSentAt !== '') {
                $summary['alreadySent']++;
                $summary['skipped']++;
                continue;
            }

            $phone = LeadOpsService::normalizeBirthdayPhone((string) ($appointment['phone'] ?? ''));
            $recipientEmail = function_exists('email_recipient_or_empty')
                ? email_recipient_or_empty((string) ($appointment['email'] ?? ''))
                : '';

            $scheduledAt = self::buildAppointmentScheduledAt($appointment);
            if ($scheduledAt === null) {
                $summary['invalidSchedule']++;
                $summary['skipped']++;
                continue;
            }

            $dueAt = $scheduledAt->modify('+48 hours');
            if (!$now || $dueAt > $now) {
                $summary['notDue']++;
                $summary['skipped']++;
                continue;
            }

            $delivered = false;
            $channels = [];

            if ($phone === '') {
                $summary['missingPhone']++;
            } elseif (!$queueAvailable) {
                $summary['queueUnavailable']++;
            } else {
                $text = self::buildPostConsultationFollowUpText($appointment);
                $record = whatsapp_openclaw_repository()->enqueueOutbox([
                    'phone' => $phone,
                    'source' => 'system',
                    'type' => 'text',
                    'text' => $text,
                    'status' => 'pending',
                    'priority' => 'normal',
                    'category' => 'post_consult_follow_up',
                    'template' => 'post_consult_follow_up_48h',
                    'meta' => [
                        'appointmentId' => (int) ($appointment['id'] ?? 0),
                        'date' => (string) ($appointment['date'] ?? ''),
                        'time' => (string) ($appointment['time'] ?? ''),
                        'doctor' => (string) ($appointment['doctor'] ?? ''),
                    ],
                ]);

                $appointment['phone'] = $phone;
                $appointment['followUpOutboxId'] = (string) ($record['id'] ?? '');
                $appointment['followUpChannel'] = 'whatsapp';
                $channels[] = 'whatsapp';
                $delivered = true;
            }

            if ($recipientEmail === '') {
                $summary['missingEmail']++;
            } elseif (maybe_send_post_consultation_followup_email($appointment)) {
                $appointment['followUpEmailSentAt'] = local_date('c');
                $appointment['followUpEmailChannel'] = 'email';
                $channels[] = 'email';
                $summary['emailSent']++;
                $delivered = true;
            }

            if (!$delivered) {
                $summary['skipped']++;
                $appointments[$index] = $appointment;
                continue;
            }

            $appointment['followUpSentAt'] = local_date('c');
            if (count($channels) > 1) {
                $appointment['followUpChannels'] = $channels;
            }
            $appointments[$index] = $appointment;
            $summary['queued']++;
        }

        $store['appointments'] = $appointments;
        return $summary;
    }

public static function queueMedicationTreatmentReminders(array &$store, array $options = []): array
    {
        $nowRaw = trim((string) ($options['now'] ?? local_date('c')));
        $now = LeadOpsService::normalizeAppointmentReminderTimestamp($nowRaw);
        if ($now === null) {
            $now = LeadOpsService::normalizeAppointmentReminderTimestamp(local_date('c'));
        }

        $queueAvailable = false;
        if (function_exists('whatsapp_openclaw_repository')) {
            $queueAvailable = true;
        } elseif (file_exists(__DIR__ . '/whatsapp_openclaw/bootstrap.php')) {
            require_once __DIR__ . '/whatsapp_openclaw/bootstrap.php';
            $queueAvailable = function_exists('whatsapp_openclaw_repository');
        }

        $prescriptions = isset($store['prescriptions']) && is_array($store['prescriptions'])
            ? $store['prescriptions']
            : [];

        $summary = [
            'now' => $now ? $now->format(DATE_ATOM) : '',
            'queued' => 0,
            'medicationsQueued' => 0,
            'medicationsDue' => 0,
            'alreadySent' => 0,
            'missingPhone' => 0,
            'missingDuration' => 0,
            'unsupportedDuration' => 0,
            'notDue' => 0,
            'invalidIssuedAt' => 0,
            'queueUnavailable' => 0,
            'candidates' => 0,
            'skipped' => 0,
        ];

        foreach ($prescriptions as $prescriptionKey => $prescription) {
            if (!is_array($prescription)) {
                continue;
            }

            $prescriptionId = trim((string) ($prescription['id'] ?? ''));
            if ($prescriptionId === '' && is_string($prescriptionKey)) {
                $prescriptionId = trim($prescriptionKey);
            }
            if ($prescriptionId === '') {
                continue;
            }

            $prescription['id'] = $prescriptionId;
            $medications = isset($prescription['medications']) && is_array($prescription['medications'])
                ? array_values($prescription['medications'])
                : [];
            $dueItems = [];

            foreach ($medications as $index => $medication) {
                if (!is_array($medication)) {
                    continue;
                }

                $summary['candidates']++;

                $durationValue = trim((string) ($medication['duration'] ?? ''));
                if ($durationValue === '') {
                    $summary['missingDuration']++;
                    $summary['skipped']++;
                    continue;
                }

                $durationDays = self::parseMedicationDurationDays($durationValue);
                if ($durationDays === null) {
                    $summary['unsupportedDuration']++;
                    $summary['skipped']++;
                    continue;
                }

                $issuedAt = LeadOpsService::normalizeAppointmentReminderTimestamp(
                    (string) ($prescription['issued_at'] ?? $prescription['issuedAt'] ?? $prescription['createdAt'] ?? '')
                );
                if ($issuedAt === null) {
                    $summary['invalidIssuedAt']++;
                    $summary['skipped']++;
                    continue;
                }

                $schedule = self::buildMedicationReminderSchedule($issuedAt, $durationDays);

                $sentAt = trim((string) ($medication['halfwayReminderSentAt'] ?? ''));
                if ($sentAt !== '') {
                    $summary['alreadySent']++;
                    $summary['skipped']++;
                    continue;
                }

                if ($now === null || $schedule['dueAt'] > $now) {
                    $summary['notDue']++;
                    $summary['skipped']++;
                    continue;
                }

                $dueItems[] = [
                    'index' => $index,
                    'label' => self::buildMedicationReminderLabel($medication),
                    'endAt' => $schedule['endAt'],
                    'endLabel' => function_exists('format_date_label')
                        ? format_date_label($schedule['endAt']->format('Y-m-d'))
                        : $schedule['endAt']->format('Y-m-d'),
                ];
            }

            if ($dueItems === []) {
                $prescriptions[$prescriptionId] = $prescription;
                if (is_string($prescriptionKey) && $prescriptionKey !== $prescriptionId) {
                    unset($prescriptions[$prescriptionKey]);
                }
                continue;
            }

            $summary['medicationsDue'] += count($dueItems);

            $patient = self::resolvePrescriptionReminderPatient($store, $prescription);
            $phone = LeadOpsService::normalizeBirthdayPhone((string) ($patient['phone'] ?? ''));
            if ($phone === '') {
                $summary['missingPhone'] += count($dueItems);
                $summary['skipped'] += count($dueItems);
                $prescriptions[$prescriptionId] = $prescription;
                if (is_string($prescriptionKey) && $prescriptionKey !== $prescriptionId) {
                    unset($prescriptions[$prescriptionKey]);
                }
                continue;
            }

            if (!$queueAvailable) {
                $summary['queueUnavailable']++;
                $prescriptions[$prescriptionId] = $prescription;
                if (is_string($prescriptionKey) && $prescriptionKey !== $prescriptionId) {
                    unset($prescriptions[$prescriptionKey]);
                }
                continue;
            }

            $text = self::buildMedicationTreatmentReminderText($patient, $dueItems);
            $record = whatsapp_openclaw_repository()->enqueueOutbox([
                'phone' => $phone,
                'source' => 'system',
                'type' => 'text',
                'text' => $text,
                'status' => 'pending',
                'priority' => 'normal',
                'category' => 'medication_treatment_reminder',
                'template' => 'medication_halfway_reminder',
                'meta' => [
                    'prescriptionId' => $prescriptionId,
                    'caseId' => (string) ($prescription['caseId'] ?? ''),
                    'medications' => array_values(array_map(static function (array $item): string {
                        return (string) ($item['label'] ?? '');
                    }, $dueItems)),
                ],
            ]);

            foreach ($dueItems as $item) {
                $medications[$item['index']]['halfwayReminderSentAt'] = local_date('c');
                $medications[$item['index']]['halfwayReminderChannel'] = 'whatsapp';
                $medications[$item['index']]['halfwayReminderOutboxId'] = (string) ($record['id'] ?? '');
            }

            $prescription['medications'] = $medications;
            $prescriptions[$prescriptionId] = $prescription;
            if (is_string($prescriptionKey) && $prescriptionKey !== $prescriptionId) {
                unset($prescriptions[$prescriptionKey]);
            }

            $summary['queued']++;
            $summary['medicationsQueued'] += count($dueItems);
        }

        $store['prescriptions'] = $prescriptions;
        return $summary;
    }

public static function dispatchPostConsultationSummary(array $session, array $draft): void
    {
        $patient = $session['patient'] ?? [];
        $phone = trim((string)($patient['contactNumber'] ?? ''));
        if ($phone === '') {
            $phone = trim((string)($patient['emergencyContactPhone'] ?? ''));
        }
        if ($phone === '') {
            return; // No phone to send to
        }

        $firstName = trim((string)($patient['firstName'] ?? 'Paciente'));
        $documents = $draft['documents'] ?? [];
        $carePlan = $documents['carePlan'] ?? [];
        
        $diagnosis = trim((string)($carePlan['diagnosis'] ?? 'Evaluacion general'));
        $treatments = trim((string)($carePlan['treatments'] ?? 'Sin indicaciones adicionales'));
        $followUp = trim((string)($carePlan['followUpFrequency'] ?? 'A requerimiento'));

        $text = "Hola *{$firstName}*, te compartimos un resumen de tu consulta medica hoy en Aurora Derm:\n\n";
        $text .= "🔬 *Diagnóstico:* {$diagnosis}\n";
        $text .= "📝 *Indicaciones / Receta:* {$treatments}\n";
        $text .= "📅 *Próxima Cita:* {$followUp}\n\n";
        $text .= "Si tienes dudas sobre tus medicamentos, puedes responder a este chat. ¡Cuidamos tu piel!";

        if (class_exists('WhatsappOpenclawRepository', false) || file_exists(__DIR__ . '/whatsapp_openclaw/bootstrap.php')) {
            if (!class_exists('WhatsappOpenclawRepository', false)) {
                require_once __DIR__ . '/whatsapp_openclaw/bootstrap.php';
            }
            $repo = new WhatsappOpenclawRepository();
            $repo->enqueueOutbox([
                'phone' => $phone,
                'source' => 'system',
                'type' => 'text',
                'text' => $text,
                'priority' => 'high'
            ]);
        }
    }

public static function buildBirthdayGreetingCandidates(array $store): array
    {
        $draftsByKey = [];
        $uniqueDrafts = [];

        foreach ((array) ($store['clinical_history_drafts'] ?? []) as $index => $draft) {
            if (!is_array($draft)) {
                continue;
            }

            $draftIdentity = LeadOpsService::firstNonEmptyString(
                trim((string) ($draft['sessionId'] ?? '')),
                trim((string) ($draft['caseId'] ?? '')),
                'draft:' . (string) $index
            );
            $currentStamp = LeadOpsService::timestampValue(
                (string) ($draft['updatedAt'] ?? $draft['createdAt'] ?? '')
            );
            $existingDraftStamp = isset($uniqueDrafts[$draftIdentity])
                ? LeadOpsService::timestampValue(
                    (string) (($uniqueDrafts[$draftIdentity]['updatedAt'] ?? $uniqueDrafts[$draftIdentity]['createdAt'] ?? ''))
                )
                : -1;

            if (!isset($uniqueDrafts[$draftIdentity]) || $currentStamp >= $existingDraftStamp) {
                $uniqueDrafts[$draftIdentity] = $draft;
            }

            foreach ([
                trim((string) ($draft['sessionId'] ?? '')),
                trim((string) ($draft['caseId'] ?? '')),
            ] as $key) {
                if ($key === '') {
                    continue;
                }

                $existingStamp = isset($draftsByKey[$key])
                    ? LeadOpsService::timestampValue(
                        (string) (($draftsByKey[$key]['updatedAt'] ?? $draftsByKey[$key]['createdAt'] ?? ''))
                    )
                    : -1;

                if (!isset($draftsByKey[$key]) || $currentStamp >= $existingStamp) {
                    $draftsByKey[$key] = $draft;
                }
            }
        }

        $candidates = [];
        $processedDrafts = [];

        foreach ((array) ($store['clinical_history_sessions'] ?? []) as $session) {
            if (!is_array($session)) {
                continue;
            }

            $sessionId = trim((string) ($session['sessionId'] ?? ''));
            $caseId = trim((string) ($session['caseId'] ?? ''));
            $draft = [];

            if ($sessionId !== '' && isset($draftsByKey[$sessionId]) && is_array($draftsByKey[$sessionId])) {
                $draft = $draftsByKey[$sessionId];
            } elseif ($caseId !== '' && isset($draftsByKey[$caseId]) && is_array($draftsByKey[$caseId])) {
                $draft = $draftsByKey[$caseId];
            }

            if ($draft !== []) {
                $processedDrafts[self::buildBirthdayDraftIdentity($draft)] = true;
            }

            $candidates[] = self::buildBirthdayGreetingCandidate($session, $draft);
        }

        foreach ($uniqueDrafts as $draftIdentity => $draft) {
            if (isset($processedDrafts[$draftIdentity]) || !is_array($draft)) {
                continue;
            }

            $candidates[] = self::buildBirthdayGreetingCandidate([], $draft);
        }

        return $candidates;
    }

public static function buildBirthdayDraftIdentity(array $draft): string
    {
        return LeadOpsService::firstNonEmptyString(
            trim((string) ($draft['sessionId'] ?? '')),
            trim((string) ($draft['caseId'] ?? '')),
            'draft:' . sha1(json_encode($draft))
        );
    }

public static function buildBirthdayGreetingCandidate(array $session, array $draft): array
    {
        $patient = isset($session['patient']) && is_array($session['patient']) ? $session['patient'] : [];
        $draftPatient = isset($draft['patient']) && is_array($draft['patient']) ? $draft['patient'] : [];
        $intake = isset($draft['intake']) && is_array($draft['intake']) ? $draft['intake'] : [];
        $patientFacts = isset($intake['datosPaciente']) && is_array($intake['datosPaciente']) ? $intake['datosPaciente'] : [];
        $admission = isset($draft['admission001']) && is_array($draft['admission001']) ? $draft['admission001'] : [];
        $identity = isset($admission['identity']) && is_array($admission['identity']) ? $admission['identity'] : [];
        $demographics = isset($admission['demographics']) && is_array($admission['demographics']) ? $admission['demographics'] : [];
        $residence = isset($admission['residence']) && is_array($admission['residence']) ? $admission['residence'] : [];

        $fullName = LeadOpsService::firstNonEmptyString(
            (string) ($patient['name'] ?? ''),
            (string) ($draftPatient['name'] ?? ''),
            LeadOpsService::buildBirthdayLegalName($identity)
        );
        $phone = LeadOpsService::firstNonEmptyString(
            (string) ($patient['phone'] ?? ''),
            (string) ($patient['contactNumber'] ?? ''),
            (string) ($draftPatient['phone'] ?? ''),
            (string) ($patientFacts['telefono'] ?? ''),
            (string) ($residence['phone'] ?? '')
        );
        $birthDate = LeadOpsService::firstNonEmptyString(
            (string) ($patient['birthDate'] ?? ''),
            (string) ($patient['fechaNacimiento'] ?? ''),
            (string) ($draftPatient['birthDate'] ?? ''),
            (string) ($draftPatient['fechaNacimiento'] ?? ''),
            (string) ($patientFacts['fechaNacimiento'] ?? ''),
            (string) ($demographics['birthDate'] ?? '')
        );
        $documentNumber = LeadOpsService::firstNonEmptyString(
            (string) ($patient['documentNumber'] ?? ''),
            (string) ($draftPatient['documentNumber'] ?? ''),
            (string) ($identity['documentNumber'] ?? '')
        );
        $sessionId = trim((string) ($session['sessionId'] ?? $draft['sessionId'] ?? ''));
        $caseId = trim((string) ($session['caseId'] ?? $draft['caseId'] ?? ''));

        return [
            'name' => $fullName,
            'phone' => $phone,
            'birthDate' => $birthDate,
            'patientKey' => LeadOpsService::buildBirthdayPatientKey(
                $documentNumber,
                $phone,
                $birthDate,
                $fullName,
                $caseId,
                $sessionId
            ),
            'sessionId' => $sessionId,
            'caseId' => $caseId,
        ];
    }

public static function resolvePrescriptionReminderPatient(array $store, array $prescription): array
    {
        $caseId = trim((string) ($prescription['caseId'] ?? ''));
        $patientSnapshot = isset($prescription['patient']) && is_array($prescription['patient'])
            ? $prescription['patient']
            : [];
        $hydratedPatient = $caseId !== '' && isset($store['patients'][$caseId]) && is_array($store['patients'][$caseId])
            ? $store['patients'][$caseId]
            : [];
        $appointment = self::findPrescriptionAppointmentContext($store, $caseId, (string) ($prescription['appointmentId'] ?? ''));

        return [
            'name' => LeadOpsService::firstNonEmptyString(
                (string) ($patientSnapshot['name'] ?? ''),
                (string) ($hydratedPatient['name'] ?? ''),
                (string) ($appointment['name'] ?? '')
            ),
            'phone' => LeadOpsService::firstNonEmptyString(
                (string) ($patientSnapshot['phone'] ?? ''),
                (string) ($hydratedPatient['phone'] ?? ''),
                (string) ($appointment['phone'] ?? '')
            ),
        ];
    }

public static function findPrescriptionAppointmentContext(array $store, string $caseId, string $appointmentId): array
    {
        $appointments = isset($store['appointments']) && is_array($store['appointments'])
            ? array_values($store['appointments'])
            : [];
        $best = [];
        $bestScore = -1;

        foreach ($appointments as $appointment) {
            if (!is_array($appointment)) {
                continue;
            }

            $matches = false;
            if ($appointmentId !== '' && (string) ($appointment['id'] ?? '') === $appointmentId) {
                $matches = true;
            }
            if (
                !$matches
                && $caseId !== ''
                && trim((string) ($appointment['patientCaseId'] ?? $appointment['caseId'] ?? '')) === $caseId
            ) {
                $matches = true;
            }
            if (!$matches) {
                continue;
            }

            $score = LeadOpsService::timestampValue((string) ($appointment['dateBooked'] ?? ''));
            $scheduledAt = self::buildAppointmentScheduledAt($appointment);
            if ($scheduledAt !== null) {
                $score = max($score, $scheduledAt->getTimestamp());
            }

            if ($best === [] || $score >= $bestScore) {
                $best = $appointment;
                $bestScore = $score;
            }
        }

        return $best;
    }

public static function buildMedicationReminderSchedule(DateTimeImmutable $issuedAt, int $durationDays): array
    {
        $halfwayOffsetDays = max(0, (int) floor($durationDays / 2));
        $endOffsetDays = max(0, $durationDays - 1);

        return [
            'dueAt' => $issuedAt->modify('+' . $halfwayOffsetDays . ' days'),
            'endAt' => $issuedAt->modify('+' . $endOffsetDays . ' days'),
        ];
    }

public static function parseMedicationDurationDays(string $duration): ?int
    {
        $normalized = strtolower(trim($duration));
        if ($normalized === '') {
            return null;
        }

        $normalized = str_replace(
            ['á', 'é', 'í', 'ó', 'ú'],
            ['a', 'e', 'i', 'o', 'u'],
            $normalized
        );

        if (preg_match('/(\d+)\s*(dia|dias|semana|semanas|mes|meses)\b/', $normalized, $matches) !== 1) {
            return null;
        }

        $value = (int) ($matches[1] ?? 0);
        $unit = (string) ($matches[2] ?? '');
        if ($value <= 0) {
            return null;
        }

        if (str_starts_with($unit, 'dia')) {
            return $value;
        }
        if (str_starts_with($unit, 'semana')) {
            return $value * 7;
        }
        if (str_starts_with($unit, 'mes')) {
            return $value * 30;
        }

        return null;
    }

public static function buildMedicationReminderLabel(array $medication): string
    {
        $name = trim((string) ($medication['medication'] ?? $medication['name'] ?? ''));
        $dose = trim((string) ($medication['dose'] ?? ''));
        return trim($name . ($dose !== '' ? ' ' . $dose : ''));
    }

public static function buildMedicationTreatmentReminderText(array $patient, array $items): string
    {
        $name = LeadOpsService::extractBirthdayFirstName((string) ($patient['name'] ?? 'Paciente'));

        if (count($items) === 1) {
            $item = $items[0];
            return "Hola {$name}, recuerde continuar con {$item['label']} hasta {$item['endLabel']}. "
                . "Si tiene dudas, responda a este mensaje.";
        }

        $lines = [];
        foreach ($items as $item) {
            $lines[] = '- ' . (string) ($item['label'] ?? '') . ' hasta ' . (string) ($item['endLabel'] ?? '');
        }

        return "Hola {$name}, le recordamos continuar con su tratamiento:\n"
            . implode("\n", $lines)
            . "\nSi tiene dudas, responda a este mensaje.";
    }

public static function buildBirthdayGreetingText(string $firstName): string
    {
        $name = LeadOpsService::firstNonEmptyString($firstName, 'Paciente');
        return "Hola {$name}, hoy queremos saludarte por tu cumpleaños desde Aurora Derm. "
            . "Que tengas un dia tranquilo, acompanado y con mucha salud. "
            . "Gracias por permitirnos acompanarte en el cuidado de tu piel.";
    }

public static function buildAppointmentReminderText(array $appointment): string
    {
        $context = function_exists('build_appointment_email_context')
            ? build_appointment_email_context($appointment)
            : [
                'name' => (string) ($appointment['name'] ?? 'Paciente'),
                'doctorLabel' => (string) ($appointment['doctor'] ?? 'su especialista'),
                'timeLabel' => (string) ($appointment['time'] ?? ''),
                'rescheduleUrl' => rtrim(AppConfig::BASE_URL, '/') . '/es/reservar/',
            ];

        $name = LeadOpsService::extractBirthdayFirstName((string) ($context['name'] ?? 'Paciente'));
        $doctor = LeadOpsService::firstNonEmptyString((string) ($context['doctorLabel'] ?? ''), 'su especialista');
        $time = LeadOpsService::firstNonEmptyString((string) ($context['timeLabel'] ?? ''), (string) ($appointment['time'] ?? ''));
        $rescheduleUrl = LeadOpsService::firstNonEmptyString(
            (string) ($context['rescheduleUrl'] ?? ''),
            rtrim(AppConfig::BASE_URL, '/') . '/es/reservar/'
        );

        return "Hola {$name}, le recordamos que manana tiene consulta con {$doctor} a las {$time}. "
            . "Si desea confirmar, puede responder a este mensaje. "
            . "Si necesita reagendar, use este enlace: {$rescheduleUrl}";
    }

public static function buildPostConsultationFollowUpText(array $appointment): string
    {
        $name = LeadOpsService::extractBirthdayFirstName((string) ($appointment['name'] ?? 'Paciente'));
        $portalUrl = rtrim(AppConfig::BASE_URL, '/') . '/es/portal/';

        return "Hola {$name}, como se ha sentido despues de su consulta? "
            . "Si tiene dudas, escribanos por este medio. "
            . "Tambien puede revisar su portal aqui: {$portalUrl}";
    }

public static function buildAppointmentScheduledAt(array $appointment): ?DateTimeImmutable
    {
        $date = LeadOpsService::normalizeBirthdayDate((string) ($appointment['date'] ?? ''));
        $time = trim((string) ($appointment['time'] ?? ''));
        if ($date === '' || $time === '') {
            return null;
        }

        try {
            return new DateTimeImmutable($date . ' ' . $time);
        } catch (Throwable $e) {
            return null;
        }
    }

}
