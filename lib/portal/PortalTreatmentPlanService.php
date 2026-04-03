<?php

declare(strict_types=1);

require_once __DIR__ . '/../../lib/api_helpers.php';
require_once __DIR__ . '/../../payment-lib.php';
require_once __DIR__ . '/../../lib/PatientPortalAuth.php';
require_once __DIR__ . '/../../lib/business.php';
require_once __DIR__ . '/../../lib/ClinicProfileStore.php';
require_once __DIR__ . '/../../lib/DocumentVerificationService.php';
require_once __DIR__ . '/../../lib/clinical_history/ClinicalHistoryService.php';
require_once __DIR__ . '/../../lib/clinical_history/ClinicalHistorySessionRepository.php';
require_once __DIR__ . '/../../controllers/PatientPortalDocumentController.php';

final class PortalTreatmentPlanService
{

    public static function buildTreatmentPlanSummary(
        array $store,
        array $snapshot,
        array $patient,
        array $nextAppointment
    , ?string $tenantId = null): ?array {
        $caseIds = self::collectPatientCaseIds($store, $snapshot, $tenantId);
        $activeDraft = self::findLatestCarePlanDraft($store, $caseIds, $tenantId);

        if (!is_array($activeDraft)) {
            return null;
        }

        $documents = is_array($activeDraft['documents'] ?? null) ? $activeDraft['documents'] : [];
        $carePlan = is_array($documents['carePlan'] ?? null) ? $documents['carePlan'] : [];
        if (!self::carePlanHasContent($carePlan)) {
            return null;
        }

        $planStartedAt = self::recordTimestamp([
            'updatedAt' => (string) ($carePlan['generatedAt'] ?? ''),
            'createdAt' => (string) ($activeDraft['updatedAt'] ?? $activeDraft['createdAt'] ?? ''),
        ]);
        $sessionMetrics = self::countTreatmentSessions($store, $snapshot, $planStartedAt);
        $plannedSessions = self::resolvePlannedSessions($carePlan, $sessionMetrics);
        $completedSessions = (int) ($sessionMetrics['completed'] ?? 0);
        $scheduledSessions = (int) ($sessionMetrics['scheduled'] ?? 0);
        $adherencePercent = $plannedSessions > 0
            ? max(0, min(100, (int) round(($completedSessions / $plannedSessions) * 100)))
            : 0;

        $caseId = trim((string) ($activeDraft['caseId'] ?? ''));
        $prescription = self::findLatestPrescriptionForCase($store, $caseId, $tenantId);
        $tasks = self::buildTreatmentPlanTasks($carePlan, $prescription, $nextAppointment);
        $nextSession = $nextAppointment === [] ? null : self::buildAppointmentSummary($nextAppointment, $patient);

        return [
            'status' => trim((string) ($carePlan['status'] ?? 'draft')) ?: 'draft',
            'diagnosis' => trim((string) ($carePlan['diagnosis'] ?? 'Plan de tratamiento activo')) ?: 'Plan de tratamiento activo',
            'followUpFrequency' => trim((string) ($carePlan['followUpFrequency'] ?? 'A requerimiento')),
            'generatedAt' => trim((string) ($carePlan['generatedAt'] ?? '')),
            'generatedAtLabel' => self::buildDocumentIssuedLabel((string) ($carePlan['generatedAt'] ?? '')),
            'completedSessions' => $completedSessions,
            'plannedSessions' => $plannedSessions,
            'scheduledSessions' => $scheduledSessions,
            'adherencePercent' => $adherencePercent,
            'adherenceLabel' => $adherencePercent . '%',
            'progressLabel' => $completedSessions . ' de ' . $plannedSessions . ' sesiones',
            'nextSession' => $nextSession,
            'tasks' => $tasks,
        ];
    }

    /**
     * Builds the aggregated view of a patient's active treatment plan.
     * Computes session adherence, future scheduled sessions, unresolved
     * clinical tasks, and structures the care plan instructions for the
     * Patient Portal UI payload.
     *
     * @param array $store             The complete system data store.
     * @param array $snapshot          The patient snapshot profile array.
     * @param array $patient           The active patient record.
     * @param array $nextAppointment   The next upcoming appointment, if any.
     *
     * @return array|null Returns the structured plan data or null if no active plan exists.
     */


    public static function buildTreatmentPlanDetail(
        array $store,
        array $snapshot,
        array $patient,
        array $nextAppointment
    , ?string $tenantId = null): ?array {
        $caseIds = self::collectPatientCaseIds($store, $snapshot, $tenantId);
        $activeDraft = self::findLatestCarePlanDraft($store, $caseIds, $tenantId);

        if (!is_array($activeDraft)) {
            return null;
        }

        $documents = is_array($activeDraft['documents'] ?? null) ? $activeDraft['documents'] : [];
        $carePlan = is_array($documents['carePlan'] ?? null) ? $documents['carePlan'] : [];
        if (!self::carePlanHasContent($carePlan)) {
            return null;
        }

        $planStartedAt = self::recordTimestamp([
            'updatedAt' => (string) ($carePlan['generatedAt'] ?? ''),
            'createdAt' => (string) ($activeDraft['updatedAt'] ?? $activeDraft['createdAt'] ?? ''),
        ]);
        $sessionMetrics = self::countTreatmentSessions($store, $snapshot, $planStartedAt);
        $plannedSessions = self::resolvePlannedSessions($carePlan, $sessionMetrics);
        $completedSessions = (int) ($sessionMetrics['completed'] ?? 0);
        $scheduledSessions = (int) ($sessionMetrics['scheduled'] ?? 0);
        $futureSessions = max(0, (int) ($sessionMetrics['future'] ?? 0));
        $adherencePercent = $plannedSessions > 0
            ? max(0, min(100, (int) round(($completedSessions / $plannedSessions) * 100)))
            : 0;

        $caseId = trim((string) ($activeDraft['caseId'] ?? ''));
        $prescription = self::findLatestPrescriptionForCase($store, $caseId, $tenantId);
        $tasks = self::buildTreatmentPlanTasks($carePlan, $prescription, $nextAppointment);
        $nextSession = $nextAppointment === [] ? null : self::buildAppointmentSummary($nextAppointment, $patient);
        $timeline = self::buildTreatmentPlanTimeline($store, $snapshot, $patient, $planStartedAt, $plannedSessions);
        $unscheduledSessions = max(0, $plannedSessions - $scheduledSessions);

        return [
            'status' => trim((string) ($carePlan['status'] ?? 'draft')) ?: 'draft',
            'diagnosis' => trim((string) ($carePlan['diagnosis'] ?? 'Plan de tratamiento activo')) ?: 'Plan de tratamiento activo',
            'followUpFrequency' => trim((string) ($carePlan['followUpFrequency'] ?? 'A requerimiento')),
            'generatedAt' => trim((string) ($carePlan['generatedAt'] ?? '')),
            'generatedAtLabel' => self::buildDocumentIssuedLabel((string) ($carePlan['generatedAt'] ?? '')),
            'completedSessions' => $completedSessions,
            'plannedSessions' => $plannedSessions,
            'scheduledSessions' => $scheduledSessions,
            'futureSessions' => $futureSessions,
            'unscheduledSessions' => $unscheduledSessions,
            'adherencePercent' => $adherencePercent,
            'adherenceLabel' => $adherencePercent . '%',
            'progressLabel' => $completedSessions . ' de ' . $plannedSessions . ' sesiones',
            'nextSession' => $nextSession,
            'tasks' => $tasks,
            'treatmentsText' => trim((string) ($carePlan['treatments'] ?? '')),
            'goalsText' => trim((string) ($carePlan['goals'] ?? '')),
            'worseningInstructions' => trim((string) ($carePlan['worseningInstructions'] ?? 'Acude a revisión anticipada o comunícate vía WhatsApp si notas un empeoramiento clínico inesperado.')),
            'medications' => self::normalizePortalPrescriptionItems($prescription ?? []),
            'timeline' => $timeline,
            'timelineCount' => count($timeline),
            'timelineLabel' => count($timeline) === 1 ? '1 hito del plan' : count($timeline) . ' hitos del plan',
            'scheduledSessionsLabel' => $scheduledSessions === 1
                ? '1 sesión ya definida'
                : $scheduledSessions . ' sesiones ya definidas',
            'unscheduledSessionsLabel' => $unscheduledSessions === 1
                ? '1 sesión pendiente por agendar'
                : $unscheduledSessions . ' sesiones pendientes por agendar',
        ];
    }


    public static function findLatestCarePlanDraft(array $store, array $caseIds, ?string $tenantId = null): ?array
    {
        $latestDraft = null;
        $latestTimestamp = 0;

        foreach ($caseIds as $caseId) {
            foreach (ClinicalHistorySessionRepository::findAllDraftsByCaseId($store, $caseId) as $draft) {
                $documents = is_array($draft['documents'] ?? null) ? $draft['documents'] : [];
                $carePlan = is_array($documents['carePlan'] ?? null) ? $documents['carePlan'] : [];
                if (!self::carePlanHasContent($carePlan)) {
                    continue;
                }

                $timestamp = self::recordTimestamp([
                    'updatedAt' => (string) ($carePlan['generatedAt'] ?? ''),
                    'createdAt' => (string) ($draft['updatedAt'] ?? $draft['createdAt'] ?? ''),
                ]);
                if ($timestamp >= $latestTimestamp) {
                    $latestTimestamp = $timestamp;
                    $latestDraft = $draft;
                }
            }
        }

        return is_array($latestDraft) ? $latestDraft : null;
    }


    public static function carePlanHasContent(array $carePlan): bool
    {
        return trim((string) ($carePlan['diagnosis'] ?? '')) !== ''
            || trim((string) ($carePlan['treatments'] ?? '')) !== ''
            || trim((string) ($carePlan['followUpFrequency'] ?? '')) !== ''
            || trim((string) ($carePlan['goals'] ?? '')) !== '';
    }


    public static function countTreatmentSessions(array $store, array $snapshot, int $planStartedAt): array
    {
        $completed = 0;
        $future = 0;
        $now = time();

        foreach (($store['appointments'] ?? []) as $appointment) {
            $itemTenant = trim((string) ($appointment['tenantId'] ?? ''));
            if ($tenantId !== null && $tenantId !== '' && $itemTenant !== '' && $itemTenant !== $tenantId) continue;
            if (!is_array($appointment) || !self::appointmentMatchesPatient($appointment, $snapshot)) {
                continue;
            }

            $timestamp = self::appointmentTimestamp($appointment) ?? self::recordTimestamp($appointment);
            if ($timestamp > 0 && $planStartedAt > 0 && $timestamp < $planStartedAt) {
                continue;
            }

            $status = function_exists('map_appointment_status')
                ? map_appointment_status((string) ($appointment['status'] ?? 'confirmed'))
                : strtolower(trim((string) ($appointment['status'] ?? 'confirmed')));

            if ($status === 'cancelled' || $status === 'no_show') {
                continue;
            }

            if ($status === 'completed' || ($timestamp > 0 && $timestamp < $now)) {
                $completed++;
                continue;
            }

            $future++;
        }

        return [
            'completed' => $completed,
            'future' => $future,
            'scheduled' => $completed + $future,
        ];
    }


    public static function buildTreatmentPlanTimeline(
        array $store,
        array $snapshot,
        array $patient,
        int $planStartedAt,
        int $plannedSessions
    ): array {
        $appointments = [];
        foreach (($store['appointments'] ?? []) as $appointment) {
            $itemTenant = trim((string) ($appointment['tenantId'] ?? ''));
            if ($tenantId !== null && $tenantId !== '' && $itemTenant !== '' && $itemTenant !== $tenantId) continue;
            if (!is_array($appointment) || !self::appointmentMatchesPatient($appointment, $snapshot)) {
                continue;
            }

            $timestamp = self::appointmentTimestamp($appointment) ?? self::recordTimestamp($appointment);
            if ($timestamp > 0 && $planStartedAt > 0 && $timestamp < $planStartedAt) {
                continue;
            }

            $status = function_exists('map_appointment_status')
                ? map_appointment_status((string) ($appointment['status'] ?? 'confirmed'))
                : strtolower(trim((string) ($appointment['status'] ?? 'confirmed')));
            if (in_array($status, ['cancelled', 'no_show'], true)) {
                continue;
            }

            $appointments[] = [
                'appointment' => $appointment,
                'status' => $status,
                'timestamp' => $timestamp,
            ];
        }

        usort($appointments, static function (array $left, array $right): int {
            return ((int) ($left['timestamp'] ?? 0)) <=> ((int) ($right['timestamp'] ?? 0));
        });

        $timeline = [];
        $now = time();
        $sessionNumber = 0;
        $nextMarked = false;

        foreach ($appointments as $entry) {
            $appointment = is_array($entry['appointment'] ?? null) ? $entry['appointment'] : [];
            $timestamp = (int) ($entry['timestamp'] ?? 0);
            $status = trim((string) ($entry['status'] ?? ''));
            $sessionNumber++;

            $summary = self::buildAppointmentSummary($appointment, $patient);
            $isCompleted = $status === 'completed' || ($timestamp > 0 && $timestamp < $now);
            $isNext = !$isCompleted && !$nextMarked;
            if ($isNext) {
                $nextMarked = true;
            }

            $timeline[] = [
                'id' => 'session-' . $sessionNumber . '-' . (string) ($summary['id'] ?? $sessionNumber),
                'sessionNumber' => $sessionNumber,
                'label' => 'Sesión ' . $sessionNumber,
                'status' => $isCompleted ? 'completed' : 'scheduled',
                'statusLabel' => $isCompleted ? 'Realizada' : ($isNext ? 'Próxima' : 'Agendada'),
                'tone' => $isCompleted ? 'good' : ($isNext ? 'warning' : 'idle'),
                'isNext' => $isNext,
                'dateLabel' => (string) ($summary['dateLabel'] ?? ''),
                'timeLabel' => (string) ($summary['timeLabel'] ?? ''),
                'doctorName' => (string) ($summary['doctorName'] ?? ''),
                'serviceName' => (string) ($summary['serviceName'] ?? ''),
                'appointmentTypeLabel' => (string) ($summary['appointmentTypeLabel'] ?? ''),
                'locationLabel' => (string) ($summary['locationLabel'] ?? ''),
                'preparation' => (string) ($summary['preparation'] ?? ''),
                'rescheduleUrl' => (string) ($summary['rescheduleUrl'] ?? ''),
                'whatsappUrl' => (string) ($summary['whatsappUrl'] ?? ''),
            ];
        }

        $targetSessions = max($plannedSessions, count($timeline));
        for ($sessionNumber = count($timeline) + 1; $sessionNumber <= $targetSessions; $sessionNumber++) {
            $timeline[] = [
                'id' => 'session-pending-' . $sessionNumber,
                'sessionNumber' => $sessionNumber,
                'label' => 'Sesión ' . $sessionNumber,
                'status' => 'pending',
                'statusLabel' => 'Por agendar',
                'tone' => 'idle',
                'isNext' => false,
                'dateLabel' => '',
                'timeLabel' => '',
                'doctorName' => '',
                'serviceName' => '',
                'appointmentTypeLabel' => '',
                'locationLabel' => '',
                'preparation' => '',
                'rescheduleUrl' => '',
                'whatsappUrl' => '',
            ];
        }

        return $timeline;
    }


    public static function resolvePlannedSessions(array $carePlan, array $sessionMetrics): int
    {
        $parsed = self::parsePlannedSessions(
            trim((string) ($carePlan['treatments'] ?? '')) . "\n" . trim((string) ($carePlan['goals'] ?? ''))
        );
        $scheduled = max(1, (int) ($sessionMetrics['scheduled'] ?? 0));

        if ($parsed !== null && $parsed > 0) {
            return max($parsed, $scheduled);
        }

        return $scheduled;
    }


    public static function parsePlannedSessions(string $text): ?int
    {
        if ($text === '') {
            return null;
        }

        if (preg_match('/(\d+)\s+sesion(?:es)?/i', $text, $matches) === 1) {
            return max(1, (int) ($matches[1] ?? 0));
        }

        return null;
    }


    public static function findLatestPrescriptionForCase(array $store, string $caseId, ?string $tenantId = null): ?array
    {
        $latestPrescription = null;
        $latestTimestamp = 0;

        foreach (($store['prescriptions'] ?? []) as $prescriptionId => $prescription) {
            if (!is_array($prescription) || trim((string) ($prescription['caseId'] ?? '')) !== $caseId) {
                continue;
            }

            $prescription['id'] = trim((string) ($prescription['id'] ?? (string) $prescriptionId));
            $timestamp = self::documentTimestamp($prescription, ['issued_at', 'issuedAt', 'createdAt']);
            if ($timestamp >= $latestTimestamp) {
                $latestTimestamp = $timestamp;
                $latestPrescription = $prescription;
            }
        }

        return is_array($latestPrescription) ? $latestPrescription : null;
    }


    public static function findLatestPrescriptionForCases(array $store, array $caseIds): ?array
    {
        $caseMap = [];
        foreach ($caseIds as $caseId) {
            $caseId = trim((string) $caseId);
            if ($caseId !== '') {
                $caseMap[$caseId] = true;
            }
        }

        $latestPrescription = null;
        $latestTimestamp = 0;

        foreach (($store['prescriptions'] ?? []) as $prescriptionId => $prescription) {
            if (!is_array($prescription)) {
                continue;
            }

            $caseId = trim((string) ($prescription['caseId'] ?? ''));
            if ($caseId === '' || !isset($caseMap[$caseId]) || !self::isIssuedPortalPrescription($prescription)) {
                continue;
            }

            $prescription['id'] = trim((string) ($prescription['id'] ?? (string) $prescriptionId));
            $timestamp = self::documentTimestamp($prescription, ['issued_at', 'issuedAt', 'createdAt']);
            if ($timestamp >= $latestTimestamp) {
                $latestTimestamp = $timestamp;
                $latestPrescription = $prescription;
            }
        }

        return is_array($latestPrescription) ? $latestPrescription : null;
    }


    public static function isIssuedPortalPrescription(array $prescription): bool
    {
        $status = strtolower(trim((string) ($prescription['status'] ?? '')));
        if ($status === '') {
            return true;
        }

        return !in_array($status, ['draft', 'pending', 'not_issued', 'cancelled', 'revoked', 'voided', 'replaced'], true);
    }


    public static function hasPendingPrescriptionDraftsForCases(array $store, array $caseIds): bool
    {
        foreach ($caseIds as $caseId) {
            foreach (ClinicalHistorySessionRepository::findAllDraftsByCaseId($store, (string) $caseId) as $draft) {
                $documents = is_array($draft['documents'] ?? null) ? $draft['documents'] : [];
                $prescription = is_array($documents['prescription'] ?? null) ? $documents['prescription'] : [];
                $status = strtolower(trim((string) ($prescription['status'] ?? '')));
                $items = is_array($prescription['items'] ?? null) ? $prescription['items'] : [];
                $medication = trim((string) ($prescription['medication'] ?? ''));
                $directions = trim((string) ($prescription['directions'] ?? ''));

                if ($items !== [] || $medication !== '' || $directions !== '') {
                    return true;
                }

                if ($status !== '' && !in_array($status, ['draft', 'not_issued'], true)) {
                    return true;
                }
            }
        }

        return false;
    }


    public static function buildActivePrescriptionSummary(array $store, array $snapshot, ?string $tenantId = null): array
    {
        $caseIds = self::collectPatientCaseIds($store, $snapshot, $tenantId);
        $prescription = self::findLatestPrescriptionForCases($store, $caseIds);
        $hasPendingUpdate = self::hasPendingPrescriptionDraftsForCases($store, $caseIds);

        if (!is_array($prescription)) {
            return [
                'title' => 'Mi receta activa',
                'status' => $hasPendingUpdate ? 'pending' : 'not_issued',
                'statusLabel' => $hasPendingUpdate ? 'En preparación' : 'Sin receta activa',
                'description' => $hasPendingUpdate
                    ? 'Tu receta se está terminando de firmar y aparecerá aquí cuando quede lista.'
                    : 'Todavía no hay una receta emitida visible para esta cuenta.',
                'medications' => [],
                'medicationCount' => 0,
                'medicationCountLabel' => '0 medicamentos activos',
                'downloadUrl' => '',
                'fileName' => '',
                'issuedAt' => '',
                'issuedAtLabel' => '',
                'doctorName' => '',
                'doctorSpecialty' => '',
                'doctorMsp' => '',
                'verificationUrl' => '',
                'verificationApiUrl' => '',
                'verificationQrImageUrl' => '',
                'verificationCode' => '',
                'hasPendingUpdate' => false,
                'pendingUpdateLabel' => '',
            ];
        }

        $document = PatientPortalDocumentController::buildPortalDocumentPayload('prescription', $prescription, false);
        $caseId = trim((string) ($prescription['caseId'] ?? ''));
        $caseRecord = self::findPatientCaseRecord($store, $caseId, $tenantId);
        $doctor = PatientPortalDocumentController::resolveDocumentDoctor($prescription);
        $medications = self::normalizePortalPrescriptionItems($prescription);
        $medicationCount = count($medications);
        $consultationDate = self::firstNonEmptyString(
            (string) ($caseRecord['latestActivityAt'] ?? ''),
            (string) ($prescription['issued_at'] ?? ''),
            (string) ($prescription['issuedAt'] ?? '')
        );
        $serviceName = self::firstNonEmptyString(
            (string) (($caseRecord['summary']['serviceName'] ?? '')),
            'Consulta dermatológica'
        );

        return array_merge($document, [
            'title' => 'Mi receta activa',
            'status' => 'available',
            'statusLabel' => 'Activa',
            'description' => $hasPendingUpdate
                ? 'Esta es tu última receta emitida. Si tu consulta más reciente generó cambios, la actualización aparecerá aquí cuando quede firmada.'
                : 'PDF listo para descargar y consultar desde tu teléfono cuando lo necesites.',
            'patientName' => self::buildPatientDisplayName(self::resolveCasePatient($store, $caseId)),
            'doctorName' => (string) ($doctor['name'] ?? ''),
            'doctorSpecialty' => (string) ($doctor['specialty'] ?? ''),
            'doctorMsp' => (string) ($doctor['msp'] ?? ''),
            'serviceName' => $serviceName,
            'consultationDateLabel' => self::buildCaseDateLabel($consultationDate),
            'medications' => $medications,
            'medicationCount' => $medicationCount,
            'medicationCountLabel' => $medicationCount === 1
                ? '1 medicamento activo'
                : $medicationCount . ' medicamentos activos',
            'hasPendingUpdate' => $hasPendingUpdate,
            'pendingUpdateLabel' => $hasPendingUpdate
                ? 'Hay una actualización clínica en preparación desde tu atención más reciente.'
                : '',
            'verificationUrl' => (string) ($document['verificationUrl'] ?? ''),
            'verificationApiUrl' => (string) ($document['verificationApiUrl'] ?? ''),
            'verificationQrImageUrl' => (string) ($document['verificationQrImageUrl'] ?? ''),
            'verificationCode' => (string) ($document['verificationCode'] ?? ''),
        ]);
    }


    public static function normalizePortalPrescriptionItems(array $prescription): array
    {
        $rawItems = [];
        if (is_array($prescription['medications'] ?? null)) {
            $rawItems = $prescription['medications'];
        } elseif (is_array($prescription['items'] ?? null)) {
            $rawItems = $prescription['items'];
        }

        if ($rawItems !== [] && array_values($rawItems) !== $rawItems) {
            $rawItems = [$rawItems];
        }

        if ($rawItems === []) {
            $fallbackMedication = self::firstNonEmptyString(
                (string) ($prescription['medication'] ?? ''),
                (string) ($prescription['name'] ?? '')
            );
            if ($fallbackMedication !== '') {
                $rawItems = [[
                    'medication' => $fallbackMedication,
                    'dose' => (string) ($prescription['dose'] ?? ''),
                    'frequency' => (string) ($prescription['frequency'] ?? ''),
                    'duration' => (string) ($prescription['duration'] ?? ''),
                    'instructions' => self::firstNonEmptyString(
                        (string) ($prescription['instructions'] ?? ''),
                        (string) ($prescription['directions'] ?? '')
                    ),
                ]];
            }
        }

        $items = [];
        foreach ($rawItems as $index => $item) {
            if (!is_array($item)) {
                continue;
            }

            $medication = self::firstNonEmptyString(
                (string) ($item['medication'] ?? ''),
                (string) ($item['name'] ?? ''),
                (string) ($item['genericName'] ?? ''),
                (string) ($item['drug'] ?? ''),
                (string) ($item['title'] ?? '')
            );
            if ($medication === '') {
                continue;
            }

            $dose = self::firstNonEmptyString(
                (string) ($item['dose'] ?? ''),
                (string) ($item['dosage'] ?? ''),
                (string) ($item['presentation'] ?? '')
            );
            $frequency = self::firstNonEmptyString(
                (string) ($item['frequency'] ?? ''),
                (string) ($item['schedule'] ?? '')
            );
            $duration = self::firstNonEmptyString(
                (string) ($item['duration'] ?? ''),
                (string) ($item['length'] ?? ''),
                (string) ($item['days'] ?? '')
            );
            $instructions = self::firstNonEmptyString(
                (string) ($item['instructions'] ?? ''),
                (string) ($item['directions'] ?? ''),
                (string) ($item['indications'] ?? '')
            );
            $chips = array_values(array_filter([$dose, $frequency, $duration], static function ($value): bool {
                return trim((string) $value) !== '';
            }));

            $items[] = [
                'id' => (string) ($item['id'] ?? ('rx-item-' . ($index + 1))),
                'medication' => $medication,
                'dose' => $dose,
                'frequency' => $frequency,
                'duration' => $duration,
                'instructions' => $instructions,
                'summary' => implode(' · ', $chips),
                'chips' => $chips,
            ];
        }

        return $items;
    }


    public static function buildTreatmentPlanTasks(
        array $carePlan,
        ?array $prescription,
        array $nextAppointment
    , ?string $tenantId = null): array {
        $tasks = [];
        foreach ([
            self::splitPlanTasks((string) ($carePlan['treatments'] ?? '')),
            self::splitPlanTasks((string) ($carePlan['goals'] ?? '')),
        ] as $taskGroup) {
            foreach ($taskGroup as $label) {
                self::rememberTask($tasks, $label);
            }
        }

        if (is_array($prescription)) {
            $medications = is_array($prescription['medications'] ?? null) ? $prescription['medications'] : [];
            $firstMedication = is_array($medications[0] ?? null) ? $medications[0] : [];
            $medicationName = trim((string) ($firstMedication['medication'] ?? ''));
            $instructions = trim((string) ($firstMedication['instructions'] ?? ''));
            $medicationTask = $medicationName !== ''
                ? 'Tomar ' . $medicationName . ($instructions !== '' ? ' · ' . $instructions : ' según la receta.')
                : '';
            self::rememberTask($tasks, $medicationTask);
        }

        if ($nextAppointment !== []) {
            $summary = self::buildAppointmentSummary($nextAppointment, []);
            $nextTask = 'Asistir a tu próxima sesión';
            $dateLabel = trim((string) ($summary['dateLabel'] ?? ''));
            $timeLabel = trim((string) ($summary['timeLabel'] ?? ''));
            if ($dateLabel !== '' || $timeLabel !== '') {
                $nextTask .= ' el ' . trim($dateLabel . ' ' . $timeLabel);
            }
            self::rememberTask($tasks, $nextTask . '.');
        }

        return array_values(array_slice($tasks, 0, 4));
    }


    public static function splitPlanTasks(string $text): array
    {
        $text = trim($text);
        if ($text === '') {
            return [];
        }

        $normalized = preg_replace('/[•\-]+/u', "\n", $text);
        $parts = preg_split('/[\n\r;]+/', (string) $normalized) ?: [];
        $tasks = [];

        foreach ($parts as $part) {
            $label = trim($part);
            if ($label === '') {
                continue;
            }

            $label = preg_replace('/^\d+\.\s*/', '', $label) ?? $label;
            $tasks[] = rtrim($label, " .") . '.';
        }

        return $tasks;
    }


    public static function rememberTask(array &$tasks, string $label): void
    {
        $label = trim($label);
        if ($label === '') {
            return;
        }

        $key = strtolower($label);
        if (!isset($tasks[$key])) {
            $tasks[$key] = [
                'label' => $label,
            ];
        }
    }


    public static function slugifyPortalFileToken(string $value, string $fallback): string
    {
        $value = strtolower(trim($value));
        $slug = preg_replace('/[^a-z0-9_-]+/', '-', $value);
        $slug = trim((string) $slug, '-_');

        return $slug !== '' ? $slug : $fallback;
    }


    public static function resolvePortalPatientProfile(array $store, array $snapshot, array $patient): array
    {
        $resolved = [];
        $caseIds = self::collectPatientCaseIds($store, $snapshot, $tenantId);

        foreach ($caseIds as $caseId) {
            $candidate = self::resolveCasePatient($store, $caseId);
            if ($candidate !== []) {
                $resolved = $candidate;
                break;
            }
        }

        $merged = array_merge($resolved, $patient);
        $merged['name'] = self::buildPatientDisplayName($merged);
        return $merged;
    }

}
