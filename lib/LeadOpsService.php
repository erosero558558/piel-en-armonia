<?php

declare(strict_types=1);

require_once __DIR__ . '/lead/LeadScoringService.php';
require_once __DIR__ . '/ServiceCatalog.php';
require_once __DIR__ . '/email.php';

final class LeadOpsService
{
    private const OBJECTIVES = ['service_match', 'call_opening', 'whatsapp_draft'];
    private const AI_STATUSES = ['idle', 'requested', 'completed', 'accepted', 'failed'];
    private const OUTCOMES = ['', 'contactado', 'cita_cerrada', 'sin_respuesta', 'descartado'];
    private const PRIORITY_BANDS = ['hot', 'warm', 'cold'];
    private const LEAD_ORIGIN_FIELDS = ['source', 'campaign', 'surface', 'service_intent'];
    private const WHATSAPP_TEMPLATE_KEYS = [
        'no_show',
        'rebooking_slot',
        'pre_consult_incomplete',
        'post_procedure',
        'prescription_ready',
    ];

    /** @var array{path:string,mtime:int,services:array<int,array<string,mixed>>}|null */
    private static ?array $catalogCache = null;

    public static function allowedObjectives(): array
    {
        return self::OBJECTIVES;
    }

    public static function allowedOutcomes(): array
    {
        return array_values(array_filter(self::OUTCOMES, static fn (string $value): bool => $value !== ''));
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

    public static function queueBirthdayGreetings(array &$store, array $options = []): array
    {
        $today = self::normalizeBirthdayDate((string) ($options['today'] ?? local_date('Y-m-d')));
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

            $birthDate = self::normalizeBirthdayDate((string) ($candidate['birthDate'] ?? ''));
            if ($birthDate === '') {
                $summary['missingBirthDate']++;
                continue;
            }

            if (substr($birthDate, 5, 5) !== $birthdayKey) {
                $summary['notBirthday']++;
                continue;
            }

            $phone = self::normalizeBirthdayPhone((string) ($candidate['phone'] ?? ''));
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

            $firstName = self::extractBirthdayFirstName((string) ($candidate['name'] ?? 'Paciente'));
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
        $today = self::normalizeBirthdayDate((string) ($options['today'] ?? local_date('Y-m-d')));
        if ($today === '') {
            $today = local_date('Y-m-d');
        }

        $tomorrow = self::normalizeBirthdayDate((string) ($options['tomorrow'] ?? ''));
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

            $date = self::normalizeBirthdayDate((string) ($appointment['date'] ?? ''));
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

            $phone = self::normalizeBirthdayPhone((string) ($appointment['phone'] ?? ''));
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
        $now = self::normalizeAppointmentReminderTimestamp($nowRaw);
        if ($now === null) {
            $now = self::normalizeAppointmentReminderTimestamp(local_date('c'));
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

            $phone = self::normalizeBirthdayPhone((string) ($appointment['phone'] ?? ''));
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
        $now = self::normalizeAppointmentReminderTimestamp($nowRaw);
        if ($now === null) {
            $now = self::normalizeAppointmentReminderTimestamp(local_date('c'));
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

                $issuedAt = self::normalizeAppointmentReminderTimestamp(
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
            $phone = self::normalizeBirthdayPhone((string) ($patient['phone'] ?? ''));
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

    public static function enrichCallbacks(array $callbacks, array $store, ?array $funnelMetrics = null): array
    {
        $enriched = [];
        foreach ($callbacks as $callback) {
            if (!is_array($callback)) {
                continue;
            }
            $enriched[] = self::enrichCallback($callback, $store, $funnelMetrics);
        }

        usort($enriched, static function (array $left, array $right): int {
            $leftScore = (int) (($left['leadOps']['heuristicScore'] ?? 0));
            $rightScore = (int) (($right['leadOps']['heuristicScore'] ?? 0));
            if ($leftScore !== $rightScore) {
                return $rightScore <=> $leftScore;
            }

            $leftAt = self::timestampValue((string) ($left['fecha'] ?? ''));
            $rightAt = self::timestampValue((string) ($right['fecha'] ?? ''));
            if ($leftAt !== $rightAt) {
                return $leftAt <=> $rightAt;
            }

            return (int) ($right['id'] ?? 0) <=> (int) ($left['id'] ?? 0);
        });

        return $enriched;
    }

    public static function enrichCallback(array $callback, array $store, ?array $funnelMetrics = null): array
    {
        $originContext = self::buildCallbackOriginContext($callback, $store);
        $callback = self::applyLeadOrigin($callback, $originContext);
        $leadOps = self::normalizeLeadOps($callback['leadOps'] ?? [], array_merge($originContext, $callback));
        $heuristic = self::buildHeuristic($callback, $store, $funnelMetrics);

        $callback['leadOps'] = array_merge($leadOps, [
            'heuristicScore' => $heuristic['score'],
            'priorityBand' => $heuristic['priorityBand'],
            'reasonCodes' => $heuristic['reasonCodes'],
            'serviceHints' => $heuristic['serviceHints'],
            'nextAction' => $heuristic['nextAction'],
            'scoreSummary' => $heuristic['scoreSummary'],
            'scoreFactors' => $heuristic['scoreFactors'],
        ]);

        return $callback;
    }

    public static function normalizeLeadOrigin($value, array $context = []): array
    {
        $lead = is_array($value) ? $value : [];
        $contextLead = isset($context['leadOps']) && is_array($context['leadOps']) ? $context['leadOps'] : [];
        $explicitSource = self::resolveLeadOriginValue(['source'], $lead, $contextLead, $context);
        $explicitCampaign = self::resolveLeadOriginValue(['campaign', 'utm_campaign', 'utmCampaign'], $lead, $contextLead, $context);
        $explicitSurface = self::resolveLeadOriginValue(
            ['surface', 'entrySurface', 'checkoutEntry', 'channel', 'lastChannel', 'public_surface'],
            $lead,
            $contextLead,
            $context
        );
        $explicitServiceIntent = self::resolveLeadOriginValue(
            ['service_intent', 'serviceIntent', 'service', 'legacyService', 'serviceLine'],
            $lead,
            $contextLead,
            $context
        );

        $source = self::normalizeLeadOriginToken($explicitSource, '');
        $campaign = self::normalizeLeadOriginToken($explicitCampaign, '');
        $surface = self::normalizeLeadOriginToken($explicitSurface, '');
        $serviceIntent = self::normalizeLeadOriginToken($explicitServiceIntent, '');

        if ($source === '') {
            $source = self::inferLeadOriginSource($surface, $serviceIntent);
        }
        if ($surface === '') {
            $surface = self::inferLeadOriginSurface($source);
        }
        if ($serviceIntent === '' && $source === 'public_preconsultation') {
            $serviceIntent = 'preconsulta_digital';
        }

        return [
            'source' => $source !== '' ? $source : 'unknown',
            'campaign' => $campaign !== '' ? $campaign : 'unknown',
            'surface' => $surface !== '' ? $surface : 'unknown',
            'service_intent' => $serviceIntent !== '' ? $serviceIntent : 'unknown',
        ];
    }

    public static function applyLeadOrigin(array $record, array $context = []): array
    {
        $origin = self::normalizeLeadOrigin($record, $context);
        foreach (self::LEAD_ORIGIN_FIELDS as $field) {
            $record[$field] = $origin[$field];
        }

        if (array_key_exists('leadOps', $record)) {
            $record['leadOps'] = self::normalizeLeadOps(
                is_array($record['leadOps']) ? $record['leadOps'] : [],
                array_merge($context, $record)
            );
        }

        return $record;
    }

    public static function normalizeLeadOps($value, array $context = []): array
    {
        $leadOps = is_array($value) ? $value : [];
        $origin = self::normalizeLeadOrigin($leadOps, $context);
        $aiObjective = self::normalizeObjective((string) ($leadOps['aiObjective'] ?? ''));
        $aiStatus = self::normalizeAiStatus((string) ($leadOps['aiStatus'] ?? 'idle'));
        $outcome = self::normalizeOutcome((string) ($leadOps['outcome'] ?? ''));
        $whatsappTemplateKey = self::normalizeWhatsappTemplateKey((string) ($leadOps['whatsappTemplateKey'] ?? ''));

        return array_merge($origin, [
            'heuristicScore' => self::clampInt((int) ($leadOps['heuristicScore'] ?? 0), 0, 100),
            'priorityBand' => self::normalizePriorityBand((string) ($leadOps['priorityBand'] ?? 'cold')),
            'reasonCodes' => self::sanitizeList($leadOps['reasonCodes'] ?? [], 8, 60),
            'serviceHints' => self::sanitizeList($leadOps['serviceHints'] ?? [], 3, 80),
            'nextAction' => truncate_field(sanitize_xss((string) ($leadOps['nextAction'] ?? '')), 180),
            'scoreSummary' => truncate_field(sanitize_xss((string) ($leadOps['scoreSummary'] ?? '')), 220),
            'scoreFactors' => self::sanitizeList($leadOps['scoreFactors'] ?? [], 4, 80),
            'aiStatus' => $aiStatus,
            'aiObjective' => $aiObjective,
            'aiSummary' => truncate_field(sanitize_xss((string) ($leadOps['aiSummary'] ?? '')), 1600),
            'aiDraft' => truncate_field(sanitize_xss((string) ($leadOps['aiDraft'] ?? '')), 2400),
            'aiProvider' => truncate_field(sanitize_xss((string) ($leadOps['aiProvider'] ?? '')), 80),
            'requestedAt' => self::normalizeTimestamp((string) ($leadOps['requestedAt'] ?? '')),
            'completedAt' => self::normalizeTimestamp((string) ($leadOps['completedAt'] ?? '')),
            'contactedAt' => self::normalizeTimestamp((string) ($leadOps['contactedAt'] ?? '')),
            'outcome' => $outcome,
            'whatsappTemplateKey' => $whatsappTemplateKey,
            'whatsappMessageDraft' => truncate_field(sanitize_xss((string) ($leadOps['whatsappMessageDraft'] ?? '')), 2400),
            'whatsappLastPreparedAt' => self::normalizeTimestamp((string) ($leadOps['whatsappLastPreparedAt'] ?? '')),
            'whatsappLastOpenedAt' => self::normalizeTimestamp((string) ($leadOps['whatsappLastOpenedAt'] ?? '')),
        ]);
    }

    public static function mergeLeadOps(array $callback, array $incomingLeadOps, array $store = [], ?array $funnelMetrics = null): array
    {
        $current = self::normalizeLeadOps($callback['leadOps'] ?? [], $callback);
        $merged = $current;

        foreach ([
            'aiStatus',
            'aiObjective',
            'aiSummary',
            'aiDraft',
            'aiProvider',
            'requestedAt',
            'completedAt',
            'contactedAt',
            'outcome',
            'nextAction',
            'source',
            'campaign',
            'surface',
            'service_intent',
            'whatsappTemplateKey',
            'whatsappMessageDraft',
            'whatsappLastPreparedAt',
            'whatsappLastOpenedAt',
        ] as $field) {
            if (!array_key_exists($field, $incomingLeadOps)) {
                continue;
            }
            $merged[$field] = $incomingLeadOps[$field];
        }

        if (array_key_exists('reasonCodes', $incomingLeadOps)) {
            $merged['reasonCodes'] = $incomingLeadOps['reasonCodes'];
        }

        if (array_key_exists('serviceHints', $incomingLeadOps)) {
            $merged['serviceHints'] = $incomingLeadOps['serviceHints'];
        }

        $normalized = self::normalizeLeadOps($merged, $callback);
        $status = map_callback_status((string) ($callback['status'] ?? 'pendiente'));
        if ($status === 'contactado' && $normalized['contactedAt'] === '') {
            $normalized['contactedAt'] = local_date('c');
        }

        if ($normalized['outcome'] !== '' && $normalized['contactedAt'] === '') {
            $normalized['contactedAt'] = local_date('c');
        }

        if ($normalized['aiStatus'] === 'accepted' && $current['aiStatus'] !== 'accepted' && class_exists('Metrics')) {
            Metrics::increment('lead_ops_ai_acceptances_total', [
                'objective' => $normalized['aiObjective'] !== '' ? $normalized['aiObjective'] : 'unknown',
            ]);
        }

        if ($normalized['outcome'] !== '' && $normalized['outcome'] !== $current['outcome'] && class_exists('Metrics')) {
            Metrics::increment('lead_ops_callback_outcomes_total', [
                'outcome' => $normalized['outcome'],
            ]);
        }

        if ($normalized['contactedAt'] !== '' && $current['contactedAt'] === '') {
            self::recordFirstContactMetric($callback, $normalized['contactedAt']);
        }

        return self::enrichCallback(
            array_merge($callback, ['leadOps' => $normalized]),
            $store,
            $funnelMetrics
        )['leadOps'];
    }

    public static function requestLeadAi(array $callback, string $objective, array $store = [], ?array $funnelMetrics = null): array
    {
        $objective = self::normalizeObjective($objective);
        if ($objective === '') {
            throw new InvalidArgumentException('Objetivo IA inválido');
        }

        if (class_exists('Metrics')) {
            Metrics::increment('lead_ops_ai_requests_total', ['objective' => $objective]);
        }

        return self::mergeLeadOps($callback, [
            'aiStatus' => 'requested',
            'aiObjective' => $objective,
            'requestedAt' => local_date('c'),
            'completedAt' => '',
            'aiSummary' => '',
            'aiDraft' => '',
            'aiProvider' => '',
        ], $store, $funnelMetrics);
    }

    public static function applyAiResult(array $callback, array $payload, array $store = [], ?array $funnelMetrics = null): array
    {
        $objective = self::normalizeObjective((string) ($payload['objective'] ?? ($callback['leadOps']['aiObjective'] ?? '')));
        $status = self::normalizeAiStatus((string) ($payload['status'] ?? 'completed'));
        if (!in_array($status, ['completed', 'failed'], true)) {
            $status = 'completed';
        }

        if (class_exists('Metrics')) {
            Metrics::increment('lead_ops_ai_results_total', [
                'status' => $status,
                'objective' => $objective !== '' ? $objective : 'unknown',
            ]);
        }

        return self::mergeLeadOps($callback, [
            'aiStatus' => $status,
            'aiObjective' => $objective,
            'aiSummary' => $payload['summary'] ?? '',
            'aiDraft' => $payload['draft'] ?? '',
            'aiProvider' => $payload['provider'] ?? 'openclaw',
            'completedAt' => local_date('c'),
        ], $store, $funnelMetrics);
    }

    public static function buildMeta(array $callbacks, array $store, ?array $funnelMetrics = null): array
    {
        $enriched = self::enrichCallbacks($callbacks, $store, $funnelMetrics);
        $priority = ['hot' => 0, 'warm' => 0, 'cold' => 0];
        $priorityPending = ['hot' => 0, 'warm' => 0, 'cold' => 0];
        $aiStatus = ['idle' => 0, 'requested' => 0, 'completed' => 0, 'accepted' => 0, 'failed' => 0];
        $outcomes = ['contactado' => 0, 'cita_cerrada' => 0, 'sin_respuesta' => 0, 'descartado' => 0];
        $pending = 0;
        $contacted = 0;
        $aiAccepted = 0;
        $firstContactMinutes = [];

        foreach ($enriched as $callback) {
            $status = map_callback_status((string) ($callback['status'] ?? 'pendiente'));
            $leadOps = self::normalizeLeadOps($callback['leadOps'] ?? []);
            if ($status === 'contactado') {
                $contacted++;
            } else {
                $pending++;
                $priorityPending[$leadOps['priorityBand']]++;
            }

            $priority[$leadOps['priorityBand']]++;
            $aiStatus[$leadOps['aiStatus']]++;
            if ($leadOps['aiStatus'] === 'accepted') {
                $aiAccepted++;
            }
            if ($leadOps['outcome'] !== '') {
                $outcomes[$leadOps['outcome']]++;
            }

            $firstContact = self::minutesToFirstContact($callback, $leadOps['contactedAt']);
            if ($firstContact !== null) {
                $firstContactMinutes[] = $firstContact;
            }
        }

        $worker = self::workerStatus();
        $total = count($enriched);
        $aiCompleted = (int) (($aiStatus['completed'] ?? 0) + ($aiStatus['accepted'] ?? 0));
        $closedWon = (int) ($outcomes['cita_cerrada'] ?? 0);
        $noResponse = (int) ($outcomes['sin_respuesta'] ?? 0);
        $discarded = (int) ($outcomes['descartado'] ?? 0);
        $firstContactSamples = count($firstContactMinutes);

        return [
            'source' => 'lead_ops_v1',
            'generatedAt' => local_date('c'),
            'defaultSort' => 'priority_desc',
            'objectiveOptions' => self::allowedObjectives(),
            'outcomeOptions' => self::allowedOutcomes(),
            'totalCount' => $total,
            'pendingCount' => $pending,
            'contactedCount' => $contacted,
            'priorityCounts' => $priority,
            'priorityPendingCounts' => $priorityPending,
            'aiStatusCounts' => $aiStatus,
            'aiAcceptedCount' => $aiAccepted,
            'aiCompletedCount' => $aiCompleted,
            'outcomeCounts' => $outcomes,
            'closedWonCount' => $closedWon,
            'noResponseCount' => $noResponse,
            'discardedCount' => $discarded,
            'firstContact' => [
                'samples' => $firstContactSamples,
                'avgMinutes' => self::roundMetric(self::average($firstContactMinutes)),
                'p95Minutes' => self::roundMetric(self::percentile($firstContactMinutes, 95.0)),
            ],
            'rates' => [
                'aiAcceptancePct' => self::percentage($aiAccepted, $aiCompleted),
                'closedPct' => self::percentage($closedWon, $total),
                'closedFromContactedPct' => self::percentage($closedWon, $contacted),
            ],
            'worker' => $worker,
            'degraded' => in_array((string) ($worker['mode'] ?? ''), ['offline', 'degraded', 'disabled'], true),
        ];
    }

    public static function buildQueuePayload(array $callbacks, array $store, ?array $funnelMetrics = null): array
    {
        $items = [];
        foreach (self::enrichCallbacks($callbacks, $store, $funnelMetrics) as $callback) {
            $leadOps = self::normalizeLeadOps($callback['leadOps'] ?? []);
            if ($leadOps['aiStatus'] !== 'requested' || $leadOps['aiObjective'] === '') {
                continue;
            }

            $items[] = [
                'callbackId' => (int) ($callback['id'] ?? 0),
                'objective' => $leadOps['aiObjective'],
                'priorityBand' => $leadOps['priorityBand'],
                'heuristicScore' => (int) $leadOps['heuristicScore'],
                'reasonCodes' => $leadOps['reasonCodes'],
                'serviceHints' => $leadOps['serviceHints'],
                'nextAction' => $leadOps['nextAction'],
                'requestedAt' => $leadOps['requestedAt'],
                'telefonoMasked' => self::maskPhone((string) ($callback['telefono'] ?? '')),
                'preferencia' => truncate_field(sanitize_xss((string) ($callback['preferencia'] ?? '')), 240),
                'fecha' => (string) ($callback['fecha'] ?? ''),
            ];
        }

        return [
            'items' => $items,
            'meta' => [
                'generatedAt' => local_date('c'),
                'count' => count($items),
                'worker' => self::workerStatus(),
            ],
        ];
    }

    public static function workerStatus(): array
    {
        $configured = trim((string) getenv('PIELARMONIA_LEADOPS_MACHINE_TOKEN')) !== '';
        $path = self::workerStatusPath();
        $snapshot = [];

        if (is_file($path)) {
            $decoded = json_decode((string) file_get_contents($path), true);
            if (is_array($decoded)) {
                $snapshot = $decoded;
            }
        }

        $lastSeenAt = self::normalizeTimestamp((string) ($snapshot['lastSeenAt'] ?? ''));
        $lastSuccessAt = self::normalizeTimestamp((string) ($snapshot['lastSuccessAt'] ?? ''));
        $lastErrorAt = self::normalizeTimestamp((string) ($snapshot['lastErrorAt'] ?? ''));
        $mode = 'pending';

        if (!$configured) {
            $mode = 'disabled';
        } elseif ($lastSeenAt === '') {
            $mode = 'pending';
        } elseif ((time() - self::timestampValue($lastSeenAt)) > self::workerStaleAfterSeconds()) {
            $mode = 'offline';
        } elseif ($lastErrorAt !== '' && self::timestampValue($lastErrorAt) > self::timestampValue($lastSuccessAt)) {
            $mode = 'degraded';
        } else {
            $mode = 'online';
        }

        return [
            'configured' => $configured,
            'mode' => $mode,
            'lastSeenAt' => $lastSeenAt,
            'lastSuccessAt' => $lastSuccessAt,
            'lastErrorAt' => $lastErrorAt,
            'lastErrorMessage' => truncate_field(sanitize_xss((string) ($snapshot['lastErrorMessage'] ?? '')), 240),
            'lastQueuePollAt' => self::normalizeTimestamp((string) ($snapshot['lastQueuePollAt'] ?? '')),
            'lastResultAt' => self::normalizeTimestamp((string) ($snapshot['lastResultAt'] ?? '')),
            'statusPath' => $path,
        ];
    }

    public static function touchWorkerHeartbeat(string $event, array $meta = []): array
    {
        $path = self::workerStatusPath();
        $current = self::workerStatus();
        $now = local_date('c');
        $snapshot = array_merge($current, [
            'lastSeenAt' => $now,
        ]);

        if ($event === 'queue_poll') {
            $snapshot['lastQueuePollAt'] = $now;
        }

        if ($event === 'result_ok') {
            $snapshot['lastResultAt'] = $now;
            $snapshot['lastSuccessAt'] = $now;
            $snapshot['lastErrorAt'] = '';
            $snapshot['lastErrorMessage'] = '';
        }

        if ($event === 'result_error') {
            $snapshot['lastResultAt'] = $now;
            $snapshot['lastErrorAt'] = $now;
            $snapshot['lastErrorMessage'] = truncate_field(sanitize_xss((string) ($meta['message'] ?? '')), 240);
        }

        @file_put_contents($path, json_encode($snapshot, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        return self::workerStatus();
    }

    public static function buildHealthSnapshot(array $store): array
    {
        $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
        $meta = self::buildMeta($callbacks, $store);

        return [
            'configured' => (bool) ($meta['worker']['configured'] ?? false),
            'mode' => (string) ($meta['worker']['mode'] ?? 'disabled'),
            'degraded' => (bool) ($meta['degraded'] ?? true),
            'callbacksTotal' => (int) ($meta['totalCount'] ?? 0),
            'pendingCallbacks' => (int) ($meta['pendingCount'] ?? 0),
            'contactedCount' => (int) ($meta['contactedCount'] ?? 0),
            'priorityHot' => (int) (($meta['priorityCounts']['hot'] ?? 0)),
            'priorityWarm' => (int) (($meta['priorityCounts']['warm'] ?? 0)),
            'priorityHotPending' => (int) (($meta['priorityPendingCounts']['hot'] ?? 0)),
            'priorityWarmPending' => (int) (($meta['priorityPendingCounts']['warm'] ?? 0)),
            'aiRequested' => (int) (($meta['aiStatusCounts']['requested'] ?? 0)),
            'aiCompleted' => (int) (($meta['aiStatusCounts']['completed'] ?? 0) + ($meta['aiStatusCounts']['accepted'] ?? 0)),
            'aiAccepted' => (int) ($meta['aiAcceptedCount'] ?? 0),
            'outcomeClosedWon' => (int) ($meta['closedWonCount'] ?? 0),
            'outcomeNoResponse' => (int) ($meta['noResponseCount'] ?? 0),
            'outcomeDiscarded' => (int) ($meta['discardedCount'] ?? 0),
            'firstContactSamples' => (int) (($meta['firstContact']['samples'] ?? 0)),
            'firstContactAvgMinutes' => (float) (($meta['firstContact']['avgMinutes'] ?? 0.0)),
            'firstContactP95Minutes' => (float) (($meta['firstContact']['p95Minutes'] ?? 0.0)),
            'aiAcceptanceRatePct' => (float) (($meta['rates']['aiAcceptancePct'] ?? 0.0)),
            'closeRatePct' => (float) (($meta['rates']['closedPct'] ?? 0.0)),
            'closeFromContactedRatePct' => (float) (($meta['rates']['closedFromContactedPct'] ?? 0.0)),
            'workerLastSeenAt' => (string) ($meta['worker']['lastSeenAt'] ?? ''),
            'workerLastErrorAt' => (string) ($meta['worker']['lastErrorAt'] ?? ''),
        ];
    }

    public static function renderPrometheusMetrics(array $store): string
    {
        $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
        $meta = self::buildMeta($callbacks, $store);
        $health = self::buildHealthSnapshot($store);
        $output = '';

        $output .= "\n# TYPE auroraderm_leadops_callbacks_pending_total gauge";
        $output .= "\nauroraderm_leadops_callbacks_pending_total " . (int) ($meta['pendingCount'] ?? 0);

        $output .= "\n# TYPE auroraderm_leadops_callbacks_total gauge";
        $output .= "\nauroraderm_leadops_callbacks_total " . (int) ($meta['totalCount'] ?? 0);

        $output .= "\n# TYPE auroraderm_leadops_callbacks_contacted_total gauge";
        $output .= "\nauroraderm_leadops_callbacks_contacted_total " . (int) ($meta['contactedCount'] ?? 0);

        foreach ((array) ($meta['priorityCounts'] ?? []) as $band => $count) {
            $output .= "\n# TYPE auroraderm_leadops_priority_band_total gauge";
            $output .= "\nauroraderm_leadops_priority_band_total{band=\"" . $band . "\"} " . (int) $count;
        }

        foreach ((array) ($meta['priorityPendingCounts'] ?? []) as $band => $count) {
            $output .= "\n# TYPE auroraderm_leadops_priority_band_pending_total gauge";
            $output .= "\nauroraderm_leadops_priority_band_pending_total{band=\"" . $band . "\"} " . (int) $count;
        }

        foreach ((array) ($meta['aiStatusCounts'] ?? []) as $status => $count) {
            $output .= "\n# TYPE auroraderm_leadops_ai_status_total gauge";
            $output .= "\nauroraderm_leadops_ai_status_total{status=\"" . $status . "\"} " . (int) $count;
        }

        $output .= "\n# TYPE auroraderm_leadops_ai_accepted_total gauge";
        $output .= "\nauroraderm_leadops_ai_accepted_total " . (int) ($meta['aiAcceptedCount'] ?? 0);

        foreach ((array) ($meta['outcomeCounts'] ?? []) as $outcome => $count) {
            $output .= "\n# TYPE auroraderm_leadops_outcome_total gauge";
            $output .= "\nauroraderm_leadops_outcome_total{outcome=\"" . $outcome . "\"} " . (int) $count;
        }

        $output .= "\n# TYPE auroraderm_leadops_closed_won_total gauge";
        $output .= "\nauroraderm_leadops_closed_won_total " . (int) ($meta['closedWonCount'] ?? 0);

        $output .= "\n# TYPE auroraderm_leadops_first_contact_samples_total gauge";
        $output .= "\nauroraderm_leadops_first_contact_samples_total " . (int) (($meta['firstContact']['samples'] ?? 0));

        $output .= "\n# TYPE auroraderm_leadops_first_contact_avg_minutes gauge";
        $output .= "\nauroraderm_leadops_first_contact_avg_minutes " . (float) (($meta['firstContact']['avgMinutes'] ?? 0.0));

        $output .= "\n# TYPE auroraderm_leadops_first_contact_p95_minutes gauge";
        $output .= "\nauroraderm_leadops_first_contact_p95_minutes " . (float) (($meta['firstContact']['p95Minutes'] ?? 0.0));

        $output .= "\n# TYPE auroraderm_leadops_ai_acceptance_rate_pct gauge";
        $output .= "\nauroraderm_leadops_ai_acceptance_rate_pct " . (float) (($meta['rates']['aiAcceptancePct'] ?? 0.0));

        $output .= "\n# TYPE auroraderm_leadops_close_rate_pct gauge";
        $output .= "\nauroraderm_leadops_close_rate_pct " . (float) (($meta['rates']['closedPct'] ?? 0.0));

        $output .= "\n# TYPE auroraderm_leadops_close_from_contacted_rate_pct gauge";
        $output .= "\nauroraderm_leadops_close_from_contacted_rate_pct " . (float) (($meta['rates']['closedFromContactedPct'] ?? 0.0));

        foreach (['online', 'degraded', 'offline', 'pending', 'disabled'] as $mode) {
            $output .= "\n# TYPE auroraderm_leadops_worker_mode gauge";
            $output .= "\nauroraderm_leadops_worker_mode{mode=\"" . $mode . "\"} " . (($health['mode'] ?? '') === $mode ? 1 : 0);
        }

        $output .= "\n# TYPE auroraderm_leadops_worker_degraded gauge";
        $output .= "\nauroraderm_leadops_worker_degraded " . (($health['degraded'] ?? false) ? 1 : 0) . "\n";

        return app_prometheus_alias_output($output);
    }

    private static function buildHeuristic(array $callback, array $store, ?array $funnelMetrics): array
    {
        $preference = self::normalizeText((string) ($callback['preferencia'] ?? ''));
        $status = map_callback_status((string) ($callback['status'] ?? 'pendiente'));
        $createdAt = self::timestampValue((string) ($callback['fecha'] ?? ''));
        $ageMinutes = $createdAt > 0
            ? max(0, (int) round((time() - $createdAt) / 60))
            : 0;
        [$serviceHints, , $serviceReasons] = self::resolveServiceHints($preference, $funnelMetrics);
        $scoring = LeadScoringService::scoreCallback($callback, $store, [
            'preference' => $preference,
            'ageMinutes' => $ageMinutes,
            'serviceHints' => $serviceHints,
        ]);
        $score = (int) ($scoring['score'] ?? 0);
        $reasonCodes = array_merge(
            is_array($scoring['reasonCodes'] ?? null) ? $scoring['reasonCodes'] : [],
            $serviceReasons
        );

        foreach ([
            'precio' => ['precio', 'costo', 'cuanto', 'valor', 'tarifa'],
            'agenda' => ['agenda', 'cita', 'turno', 'hora', 'disponible', 'manana', 'tarde'],
        ] as $code => $tokens) {
            foreach ($tokens as $token) {
                if (!str_contains($preference, $token)) {
                    continue;
                }
                $reasonCodes[] = 'keyword_' . $code;
                break;
            }
        }

        if (($funnelMetrics['summary']['checkoutAbandon'] ?? 0) > 0) {
            $score += 4;
            $reasonCodes[] = 'funnel_dropoff_active';
        }

        $score = self::clampInt($score, 0, 100);
        $priorityBand = (string) ($scoring['priorityBand'] ?? '');
        if ($priorityBand === '') {
            $priorityBand = $score >= 72 ? 'hot' : ($score >= 45 ? 'warm' : 'cold');
        } elseif (($priorityBand === 'hot' && $score < 72) || ($priorityBand === 'warm' && $score < 45)) {
            $priorityBand = $score >= 72 ? 'hot' : ($score >= 45 ? 'warm' : 'cold');
        }

        $nextAction = $priorityBand === 'hot'
            ? 'Llamar en menos de 10 min'
            : ($priorityBand === 'warm'
                ? 'Responder en esta franja y proponer horario'
                : 'Mantener visible y reagrupar en bloque');

        if (in_array('keyword_precio', $reasonCodes, true)) {
            $nextAction = 'Responder precio y cerrar cita en el mismo contacto';
        }

        if ($status === 'contactado') {
            $nextAction = 'Seguimiento registrado';
        }

        return [
            'score' => $score,
            'priorityBand' => $priorityBand,
            'reasonCodes' => array_slice(array_values(array_unique($reasonCodes)), 0, 8),
            'serviceHints' => array_slice($serviceHints, 0, 3),
            'nextAction' => $nextAction,
            'scoreSummary' => truncate_field(sanitize_xss((string) ($scoring['summary'] ?? '')), 220),
            'scoreFactors' => self::sanitizeList($scoring['factorLabels'] ?? [], 4, 80),
        ];
    }

    private static function resolveServiceHints(string $preference, ?array $funnelMetrics): array
    {
        $catalog = self::serviceCatalog();
        $funnelMap = self::funnelSignals($funnelMetrics);
        $matches = [];

        foreach ($catalog['services'] as $service) {
            $hits = 0;
            foreach ($service['tokens'] as $token) {
                if ($token !== '' && str_contains($preference, $token)) {
                    $hits++;
                }
            }

            if ($hits === 0) {
                continue;
            }

            $signal = $funnelMap[$service['metricSlug']] ?? ['bookingIntent' => 0, 'checkoutStarts' => 0];
            $score = ($hits * 6)
                + (int) min(
                    12,
                    (($signal['bookingIntent'] ?? 0) * 2)
                    + (($signal['checkoutStarts'] ?? 0) * 3)
                    + (($signal['bookingConfirmed'] ?? 0) * 4)
                )
                + self::servicePriorityBoost($service, $signal);
            $matches[] = [
                'label' => $service['label'],
                'reason' => 'service_' . $service['metricSlug'],
                'score' => $score,
            ];
        }

        usort($matches, static fn (array $left, array $right): int => ($right['score'] ?? 0) <=> ($left['score'] ?? 0));

        $labels = [];
        $reasons = [];
        $score = 0;
        foreach ($matches as $match) {
            $labels[] = $match['label'];
            $reasons[] = $match['reason'];
            $score += (int) ($match['score'] ?? 0);
            if (count($labels) >= 3) {
                break;
            }
        }

        return [
            array_values(array_unique($labels)),
            min(24, $score),
            array_values(array_unique($reasons)),
        ];
    }

    private static function serviceCatalog(): array
    {
        $catalog = load_service_catalog_payload();
        $path = (string) ($catalog['path'] ?? '');
        $mtime = (int) ($catalog['mtime'] ?? 0);

        if (
            self::$catalogCache !== null
            && self::$catalogCache['path'] === $path
            && self::$catalogCache['mtime'] === $mtime
        ) {
            return [
                'services' => self::$catalogCache['services'],
            ];
        }

        $services = [];

        foreach (service_catalog_services('public_route') as $service) {
            if (!is_array($service)) {
                continue;
            }

            $slug = self::normalizeToken((string) ($service['slug'] ?? ''));
            if ($slug === '') {
                continue;
            }

            $hint = self::normalizeToken((string) (($service['cta']['service_hint'] ?? '')));
            $label = $hint !== '' && function_exists('get_service_label')
                ? get_service_label($hint)
                : trim((string) ($service['hero'] ?? $slug));

            $tokens = array_merge(
                self::extractTokens($slug),
                self::extractTokens((string) ($service['hero'] ?? '')),
                self::extractTokens((string) ($service['summary'] ?? ''))
            );

            foreach ((array) ($service['indications'] ?? []) as $indication) {
                $tokens = array_merge($tokens, self::extractTokens((string) $indication));
            }

            $services[] = [
                'metricSlug' => str_replace('-', '_', $slug),
                'label' => $label !== '' ? $label : $slug,
                'category' => self::normalizeToken((string) ($service['category'] ?? '')),
                'tokens' => array_values(array_unique($tokens)),
            ];
        }

        self::$catalogCache = [
            'path' => $path,
            'mtime' => $mtime,
            'services' => $services,
        ];

        return [
            'services' => $services,
        ];
    }

    private static function funnelSignals(?array $funnelMetrics): array
    {
        $map = [];
        foreach ((array) ($funnelMetrics['serviceFunnel'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $slug = self::normalizeToken((string) ($row['serviceSlug'] ?? ''));
            if ($slug === '') {
                continue;
            }
            $map[$slug] = [
                'detailViews' => (int) ($row['detailViews'] ?? 0),
                'bookingIntent' => (int) ($row['bookingIntent'] ?? 0),
                'checkoutStarts' => (int) ($row['checkoutStarts'] ?? 0),
                'bookingConfirmed' => (int) ($row['bookingConfirmed'] ?? 0),
                'detailToConfirmedPct' => (float) ($row['detailToConfirmedPct'] ?? 0.0),
            ];
        }
        return $map;
    }

    private static function servicePriorityBoost(array $service, array $signal): int
    {
        $categoryWeight = self::serviceCategoryBaseWeight((string) ($service['category'] ?? ''));
        $confirmedBoost = min(2, (int) ($signal['bookingConfirmed'] ?? 0));
        $conversionBoost = min(3, (int) round(((float) ($signal['detailToConfirmedPct'] ?? 0.0)) / 20));

        return min(8, $categoryWeight + $confirmedBoost + $conversionBoost);
    }

    private static function serviceCategoryBaseWeight(string $category): int
    {
        $category = self::normalizeToken($category);
        if (str_contains($category, 'pediatric') || str_contains($category, 'children') || str_contains($category, 'ninos')) {
            return 4;
        }
        if (str_contains($category, 'clinical') || str_contains($category, 'diagnostic') || str_contains($category, 'medic')) {
            return 3;
        }
        if (str_contains($category, 'telemed')) {
            return 2;
        }
        if (str_contains($category, 'aesthetic') || str_contains($category, 'estet')) {
            return 2;
        }
        return 1;
    }

    private static function recordFirstContactMetric(array $callback, string $contactedAt): void
    {
        if (!class_exists('Metrics')) {
            return;
        }

        $minutes = self::minutesToFirstContact($callback, $contactedAt);
        if ($minutes === null) {
            return;
        }

        Metrics::observe(
            'lead_ops_first_contact_minutes',
            $minutes,
            [],
            [5, 10, 20, 30, 60, 120, 240, 480, 1440]
        );
    }

    private static function minutesToFirstContact(array $callback, string $contactedAt): ?float
    {
        $createdAt = self::timestampValue((string) ($callback['fecha'] ?? ''));
        $contactedTs = self::timestampValue($contactedAt);
        if ($createdAt <= 0 || $contactedTs <= $createdAt) {
            return null;
        }

        return ($contactedTs - $createdAt) / 60;
    }

    /**
     * @param list<float> $values
     */
    private static function average(array $values): float
    {
        if ($values === []) {
            return 0.0;
        }

        return array_sum($values) / count($values);
    }

    /**
     * @param list<float> $values
     */
    private static function percentile(array $values, float $percentile): float
    {
        if ($values === []) {
            return 0.0;
        }

        sort($values, SORT_NUMERIC);
        $rank = (int) ceil((max(0.0, min(100.0, $percentile)) / 100) * count($values));
        $index = max(0, min(count($values) - 1, $rank - 1));

        return (float) $values[$index];
    }

    private static function percentage(int $numerator, int $denominator): float
    {
        if ($denominator <= 0) {
            return 0.0;
        }

        return self::roundMetric(($numerator / $denominator) * 100);
    }

    private static function roundMetric(float $value): float
    {
        return round($value, 2);
    }

    private static function workerStatusPath(): string
    {
        return rtrim(data_dir_path(), '\\/') . DIRECTORY_SEPARATOR . 'leadops-worker-status.json';
    }

    private static function workerStaleAfterSeconds(): int
    {
        $raw = (int) getenv('PIELARMONIA_LEADOPS_WORKER_STALE_AFTER_SECONDS');
        return $raw > 0 ? $raw : 900;
    }

    private static function buildBirthdayGreetingCandidates(array $store): array
    {
        $draftsByKey = [];
        $uniqueDrafts = [];

        foreach ((array) ($store['clinical_history_drafts'] ?? []) as $index => $draft) {
            if (!is_array($draft)) {
                continue;
            }

            $draftIdentity = self::firstNonEmptyString(
                trim((string) ($draft['sessionId'] ?? '')),
                trim((string) ($draft['caseId'] ?? '')),
                'draft:' . (string) $index
            );
            $currentStamp = self::timestampValue(
                (string) ($draft['updatedAt'] ?? $draft['createdAt'] ?? '')
            );
            $existingDraftStamp = isset($uniqueDrafts[$draftIdentity])
                ? self::timestampValue(
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
                    ? self::timestampValue(
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

    private static function buildBirthdayDraftIdentity(array $draft): string
    {
        return self::firstNonEmptyString(
            trim((string) ($draft['sessionId'] ?? '')),
            trim((string) ($draft['caseId'] ?? '')),
            'draft:' . sha1(json_encode($draft))
        );
    }

    private static function buildBirthdayGreetingCandidate(array $session, array $draft): array
    {
        $patient = isset($session['patient']) && is_array($session['patient']) ? $session['patient'] : [];
        $draftPatient = isset($draft['patient']) && is_array($draft['patient']) ? $draft['patient'] : [];
        $intake = isset($draft['intake']) && is_array($draft['intake']) ? $draft['intake'] : [];
        $patientFacts = isset($intake['datosPaciente']) && is_array($intake['datosPaciente']) ? $intake['datosPaciente'] : [];
        $admission = isset($draft['admission001']) && is_array($draft['admission001']) ? $draft['admission001'] : [];
        $identity = isset($admission['identity']) && is_array($admission['identity']) ? $admission['identity'] : [];
        $demographics = isset($admission['demographics']) && is_array($admission['demographics']) ? $admission['demographics'] : [];
        $residence = isset($admission['residence']) && is_array($admission['residence']) ? $admission['residence'] : [];

        $fullName = self::firstNonEmptyString(
            (string) ($patient['name'] ?? ''),
            (string) ($draftPatient['name'] ?? ''),
            self::buildBirthdayLegalName($identity)
        );
        $phone = self::firstNonEmptyString(
            (string) ($patient['phone'] ?? ''),
            (string) ($patient['contactNumber'] ?? ''),
            (string) ($draftPatient['phone'] ?? ''),
            (string) ($patientFacts['telefono'] ?? ''),
            (string) ($residence['phone'] ?? '')
        );
        $birthDate = self::firstNonEmptyString(
            (string) ($patient['birthDate'] ?? ''),
            (string) ($patient['fechaNacimiento'] ?? ''),
            (string) ($draftPatient['birthDate'] ?? ''),
            (string) ($draftPatient['fechaNacimiento'] ?? ''),
            (string) ($patientFacts['fechaNacimiento'] ?? ''),
            (string) ($demographics['birthDate'] ?? '')
        );
        $documentNumber = self::firstNonEmptyString(
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
            'patientKey' => self::buildBirthdayPatientKey(
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

    private static function resolvePrescriptionReminderPatient(array $store, array $prescription): array
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
            'name' => self::firstNonEmptyString(
                (string) ($patientSnapshot['name'] ?? ''),
                (string) ($hydratedPatient['name'] ?? ''),
                (string) ($appointment['name'] ?? '')
            ),
            'phone' => self::firstNonEmptyString(
                (string) ($patientSnapshot['phone'] ?? ''),
                (string) ($hydratedPatient['phone'] ?? ''),
                (string) ($appointment['phone'] ?? '')
            ),
        ];
    }

    private static function findPrescriptionAppointmentContext(array $store, string $caseId, string $appointmentId): array
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

            $score = self::timestampValue((string) ($appointment['dateBooked'] ?? ''));
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

    private static function buildMedicationReminderSchedule(DateTimeImmutable $issuedAt, int $durationDays): array
    {
        $halfwayOffsetDays = max(0, (int) floor($durationDays / 2));
        $endOffsetDays = max(0, $durationDays - 1);

        return [
            'dueAt' => $issuedAt->modify('+' . $halfwayOffsetDays . ' days'),
            'endAt' => $issuedAt->modify('+' . $endOffsetDays . ' days'),
        ];
    }

    private static function parseMedicationDurationDays(string $duration): ?int
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

    private static function buildMedicationReminderLabel(array $medication): string
    {
        $name = trim((string) ($medication['medication'] ?? $medication['name'] ?? ''));
        $dose = trim((string) ($medication['dose'] ?? ''));
        return trim($name . ($dose !== '' ? ' ' . $dose : ''));
    }

    private static function buildMedicationTreatmentReminderText(array $patient, array $items): string
    {
        $name = self::extractBirthdayFirstName((string) ($patient['name'] ?? 'Paciente'));

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

    private static function buildBirthdayGreetingText(string $firstName): string
    {
        $name = self::firstNonEmptyString($firstName, 'Paciente');
        return "Hola {$name}, hoy queremos saludarte por tu cumpleaños desde Aurora Derm. "
            . "Que tengas un dia tranquilo, acompanado y con mucha salud. "
            . "Gracias por permitirnos acompanarte en el cuidado de tu piel.";
    }

    private static function buildAppointmentReminderText(array $appointment): string
    {
        $context = function_exists('build_appointment_email_context')
            ? build_appointment_email_context($appointment)
            : [
                'name' => (string) ($appointment['name'] ?? 'Paciente'),
                'doctorLabel' => (string) ($appointment['doctor'] ?? 'su especialista'),
                'timeLabel' => (string) ($appointment['time'] ?? ''),
                'rescheduleUrl' => rtrim(AppConfig::BASE_URL, '/') . '/es/reservar/',
            ];

        $name = self::extractBirthdayFirstName((string) ($context['name'] ?? 'Paciente'));
        $doctor = self::firstNonEmptyString((string) ($context['doctorLabel'] ?? ''), 'su especialista');
        $time = self::firstNonEmptyString((string) ($context['timeLabel'] ?? ''), (string) ($appointment['time'] ?? ''));
        $rescheduleUrl = self::firstNonEmptyString(
            (string) ($context['rescheduleUrl'] ?? ''),
            rtrim(AppConfig::BASE_URL, '/') . '/es/reservar/'
        );

        return "Hola {$name}, le recordamos que manana tiene consulta con {$doctor} a las {$time}. "
            . "Si desea confirmar, puede responder a este mensaje. "
            . "Si necesita reagendar, use este enlace: {$rescheduleUrl}";
    }

    private static function buildPostConsultationFollowUpText(array $appointment): string
    {
        $name = self::extractBirthdayFirstName((string) ($appointment['name'] ?? 'Paciente'));
        $portalUrl = rtrim(AppConfig::BASE_URL, '/') . '/es/portal/';

        return "Hola {$name}, como se ha sentido despues de su consulta? "
            . "Si tiene dudas, escribanos por este medio. "
            . "Tambien puede revisar su portal aqui: {$portalUrl}";
    }

    private static function buildAppointmentScheduledAt(array $appointment): ?DateTimeImmutable
    {
        $date = self::normalizeBirthdayDate((string) ($appointment['date'] ?? ''));
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

    private static function normalizeAppointmentReminderTimestamp(string $value): ?DateTimeImmutable
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        try {
            return new DateTimeImmutable($trimmed);
        } catch (Throwable $e) {
            return null;
        }
    }

    private static function extractBirthdayFirstName(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return 'Paciente';
        }

        $parts = preg_split('/\s+/', $trimmed);
        if (!is_array($parts) || $parts === []) {
            return 'Paciente';
        }

        return trim((string) ($parts[0] ?? 'Paciente'));
    }

    private static function buildCallbackOriginContext(array $callback, array $store): array
    {
        $case = self::findLeadOriginCaseContext($store, $callback);
        $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
        $appointment = self::findLeadOriginAppointmentContext($store, $callback, $case);

        return [
            'source' => self::firstNonEmptyString(
                (string) ($summary['source'] ?? ''),
                (string) ($appointment['source'] ?? '')
            ),
            'campaign' => self::firstNonEmptyString(
                (string) ($summary['campaign'] ?? ''),
                (string) ($appointment['campaign'] ?? '')
            ),
            'surface' => self::firstNonEmptyString(
                (string) ($summary['surface'] ?? ''),
                (string) ($summary['entrySurface'] ?? ''),
                (string) ($appointment['surface'] ?? ''),
                (string) ($appointment['checkoutEntry'] ?? ''),
                (string) ($appointment['telemedicineChannel'] ?? ''),
                (string) ($summary['lastChannel'] ?? '')
            ),
            'service_intent' => self::firstNonEmptyString(
                (string) ($summary['service_intent'] ?? ''),
                (string) ($appointment['service_intent'] ?? ''),
                (string) ($appointment['service'] ?? ''),
                (string) ($summary['serviceLine'] ?? '')
            ),
            'entrySurface' => (string) ($summary['entrySurface'] ?? ''),
            'checkoutEntry' => (string) ($appointment['checkoutEntry'] ?? ''),
            'channel' => self::firstNonEmptyString(
                (string) ($appointment['telemedicineChannel'] ?? ''),
                (string) ($summary['lastChannel'] ?? '')
            ),
            'serviceLine' => (string) ($summary['serviceLine'] ?? ''),
        ];
    }

    private static function findLeadOriginCaseContext(array $store, array $callback): array
    {
        $callbacksCaseId = trim((string) ($callback['patientCaseId'] ?? ''));
        $callbackPatientId = trim((string) ($callback['patientId'] ?? ''));
        $callbackId = trim((string) ($callback['id'] ?? ''));
        $callbackPhone = self::normalizeComparablePhone((string) ($callback['telefono'] ?? ''));
        $cases = isset($store['patient_cases']) && is_array($store['patient_cases'])
            ? array_values($store['patient_cases'])
            : [];

        $best = [];
        $bestScore = -1;
        $bestTimestamp = 0;

        foreach ($cases as $case) {
            if (!is_array($case)) {
                continue;
            }

            $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
            $score = 0;
            if ($callbacksCaseId !== '' && trim((string) ($case['id'] ?? '')) === $callbacksCaseId) {
                $score += 12;
            }
            if ($callbackPatientId !== '' && trim((string) ($case['patientId'] ?? '')) === $callbackPatientId) {
                $score += 8;
            }
            if (
                $callbackId !== ''
                && trim((string) ($summary['latestCallbackId'] ?? '')) !== ''
                && trim((string) ($summary['latestCallbackId'] ?? '')) === $callbackId
            ) {
                $score += 4;
            }

            $casePhone = self::normalizeComparablePhone((string) ($summary['contactPhone'] ?? ''));
            if ($callbackPhone !== '' && $casePhone !== '' && $casePhone === $callbackPhone) {
                $score += 6;
            }

            if ($score <= 0) {
                continue;
            }

            $timestamp = max(
                self::timestampValue((string) ($case['latestActivityAt'] ?? '')),
                self::timestampValue((string) ($case['openedAt'] ?? ''))
            );

            if ($best === [] || $score > $bestScore || ($score === $bestScore && $timestamp >= $bestTimestamp)) {
                $best = $case;
                $bestScore = $score;
                $bestTimestamp = $timestamp;
            }
        }

        return $best;
    }

    private static function findLeadOriginAppointmentContext(array $store, array $callback, array $case): array
    {
        $caseId = self::firstNonEmptyString(
            trim((string) ($callback['patientCaseId'] ?? '')),
            trim((string) ($case['id'] ?? ''))
        );
        $patientId = self::firstNonEmptyString(
            trim((string) ($callback['patientId'] ?? '')),
            trim((string) ($case['patientId'] ?? ''))
        );
        $callbackPhone = self::normalizeComparablePhone((string) ($callback['telefono'] ?? ''));
        $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
        $latestAppointmentId = trim((string) ($summary['latestAppointmentId'] ?? ''));
        $appointments = isset($store['appointments']) && is_array($store['appointments'])
            ? array_values($store['appointments'])
            : [];

        $best = [];
        $bestScore = -1;
        $bestTimestamp = 0;

        foreach ($appointments as $appointment) {
            if (!is_array($appointment)) {
                continue;
            }

            $score = 0;
            if ($latestAppointmentId !== '' && trim((string) ($appointment['id'] ?? '')) === $latestAppointmentId) {
                $score += 4;
            }
            if (
                $caseId !== ''
                && trim((string) ($appointment['patientCaseId'] ?? $appointment['caseId'] ?? '')) === $caseId
            ) {
                $score += 12;
            }
            if ($patientId !== '' && trim((string) ($appointment['patientId'] ?? '')) === $patientId) {
                $score += 8;
            }

            $appointmentPhone = self::normalizeComparablePhone((string) ($appointment['phone'] ?? ''));
            if ($callbackPhone !== '' && $appointmentPhone !== '' && $appointmentPhone === $callbackPhone) {
                $score += 6;
            }

            if ($score <= 0) {
                continue;
            }

            $timestamp = max(
                self::timestampValue((string) ($appointment['dateBooked'] ?? '')),
                self::buildAppointmentScheduledAt($appointment)?->getTimestamp() ?? 0
            );

            if ($best === [] || $score > $bestScore || ($score === $bestScore && $timestamp >= $bestTimestamp)) {
                $best = $appointment;
                $bestScore = $score;
                $bestTimestamp = $timestamp;
            }
        }

        return $best;
    }

    private static function buildBirthdayLegalName(array $identity): string
    {
        return trim(implode(' ', array_filter([
            trim((string) ($identity['primerNombre'] ?? '')),
            trim((string) ($identity['segundoNombre'] ?? '')),
            trim((string) ($identity['apellidoPaterno'] ?? '')),
            trim((string) ($identity['apellidoMaterno'] ?? '')),
        ])));
    }

    private static function buildBirthdayPatientKey(
        string $documentNumber,
        string $phone,
        string $birthDate,
        string $name,
        string $caseId,
        string $sessionId
    ): string {
        $document = preg_replace('/\W+/', '', strtolower($documentNumber));
        if (is_string($document) && $document !== '') {
            return 'doc:' . $document;
        }

        $normalizedPhone = self::normalizeBirthdayPhone($phone);
        if ($normalizedPhone !== '') {
            return 'phone:' . $normalizedPhone . '|' . self::normalizeBirthdayDate($birthDate);
        }

        $nameKey = preg_replace('/[^a-z0-9]+/', '_', strtolower(trim($name)));
        if (is_string($nameKey) && $nameKey !== '' && self::normalizeBirthdayDate($birthDate) !== '') {
            return 'name:' . trim($nameKey, '_') . '|' . self::normalizeBirthdayDate($birthDate);
        }

        return 'case:' . self::firstNonEmptyString($caseId, $sessionId, sha1($name . '|' . $birthDate));
    }

    private static function normalizeBirthdayPhone(string $value): string
    {
        $digits = preg_replace('/\D+/', '', $value);
        if (!is_string($digits)) {
            return '';
        }

        return ltrim($digits, '0');
    }

    private static function normalizeBirthdayDate(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', substr($trimmed, 0, 10)) === 1) {
            return substr($trimmed, 0, 10);
        }

        try {
            return (new DateTimeImmutable($trimmed))->format('Y-m-d');
        } catch (Throwable $e) {
            return '';
        }
    }

    private static function firstNonEmptyString(string ...$values): string
    {
        foreach ($values as $value) {
            $trimmed = trim($value);
            if ($trimmed !== '') {
                return $trimmed;
            }
        }

        return '';
    }

    private static function maskPhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone);
        if (!is_string($digits) || $digits === '') {
            return 'Sin telefono';
        }
        $tail = substr($digits, -2);
        return str_repeat('*', max(0, strlen($digits) - 2)) . $tail;
    }

    private static function normalizeObjective(string $objective): string
    {
        $objective = self::normalizeToken($objective);
        return in_array($objective, self::OBJECTIVES, true) ? $objective : '';
    }

    private static function normalizeAiStatus(string $status): string
    {
        $status = self::normalizeToken($status);
        return in_array($status, self::AI_STATUSES, true) ? $status : 'idle';
    }

    private static function normalizeOutcome(string $outcome): string
    {
        $outcome = self::normalizeToken($outcome);
        return in_array($outcome, self::OUTCOMES, true) ? $outcome : '';
    }

    private static function normalizeWhatsappTemplateKey(string $value): string
    {
        $value = self::normalizeToken($value);
        return in_array($value, self::WHATSAPP_TEMPLATE_KEYS, true)
            ? $value
            : '';
    }

    private static function normalizePriorityBand(string $band): string
    {
        $band = self::normalizeToken($band);
        return in_array($band, self::PRIORITY_BANDS, true) ? $band : 'cold';
    }

    private static function normalizeTimestamp(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        return strtotime($value) === false ? '' : $value;
    }

    private static function sanitizeList($values, int $limit, int $maxLength): array
    {
        $list = [];
        foreach ((array) $values as $value) {
            $sanitized = truncate_field(sanitize_xss((string) $value), $maxLength);
            if ($sanitized === '') {
                continue;
            }
            $list[] = $sanitized;
            if (count($list) >= $limit) {
                break;
            }
        }
        return array_values(array_unique($list));
    }

    private static function resolveLeadOriginValue(array $keys, array ...$sources): string
    {
        foreach ($sources as $source) {
            foreach ($keys as $key) {
                if (!array_key_exists($key, $source)) {
                    continue;
                }

                $value = trim((string) ($source[$key] ?? ''));
                if ($value !== '' && self::normalizeLeadOriginToken($value, '') !== 'unknown') {
                    return $value;
                }
            }
        }

        return '';
    }

    private static function inferLeadOriginSource(string $surface, string $serviceIntent): string
    {
        if ($surface === 'unknown') {
            $surface = '';
        }
        if ($serviceIntent === 'unknown') {
            $serviceIntent = '';
        }
        if (str_contains($surface, 'whatsapp')) {
            return 'whatsapp_openclaw';
        }
        if (str_contains($surface, 'preconsulta') || $serviceIntent === 'preconsulta_digital') {
            return 'public_preconsultation';
        }
        if ($surface !== '' || $serviceIntent !== '') {
            return 'booking';
        }

        return 'unknown';
    }

    private static function inferLeadOriginSurface(string $source): string
    {
        if ($source === 'unknown') {
            $source = '';
        }
        if ($source === 'whatsapp_openclaw') {
            return 'whatsapp_openclaw';
        }
        if ($source === 'public_preconsultation') {
            return 'preconsulta_publica';
        }
        if ($source === 'booking') {
            return 'booking';
        }

        return 'unknown';
    }

    private static function extractTokens(string $value): array
    {
        $normalized = self::normalizeText($value);
        $parts = preg_split('/[^a-z0-9]+/', $normalized) ?: [];
        return array_values(array_filter($parts, static fn (string $token): bool => strlen($token) >= 4));
    }

    private static function normalizeText(string $value): string
    {
        $value = trim($value);
        $value = function_exists('mb_strtolower')
            ? mb_strtolower($value, 'UTF-8')
            : strtolower($value);
        $value = strtr($value, [
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' => 'o',
            'ú' => 'u',
            'ñ' => 'n',
        ]);
        return $value;
    }

    private static function normalizeToken(string $value): string
    {
        return trim(preg_replace('/[^a-z0-9_\\-]+/', '-', self::normalizeText($value)) ?? '', '-');
    }

    private static function normalizeLeadOriginToken(string $value, string $fallback = 'unknown'): string
    {
        $normalized = trim(preg_replace('/[^a-z0-9]+/', '_', self::normalizeText($value)) ?? '', '_');
        return $normalized !== '' ? $normalized : $fallback;
    }

    private static function timestampValue(string $value): int
    {
        $timestamp = strtotime($value);
        return $timestamp === false ? 0 : $timestamp;
    }

    private static function clampInt(int $value, int $min, int $max): int
    {
        return max($min, min($max, $value));
    }

    private static function normalizeComparablePhone(string $value): string
    {
        $digits = preg_replace('/\D+/', '', $value);
        if (!is_string($digits)) {
            return '';
        }

        return ltrim($digits, '0');
    }
}
