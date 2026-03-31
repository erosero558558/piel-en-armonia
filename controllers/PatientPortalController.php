<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/PatientPortalAuth.php';
require_once __DIR__ . '/../lib/business.php';
require_once __DIR__ . '/../lib/ClinicProfileStore.php';
require_once __DIR__ . '/../lib/api_helpers.php';
require_once __DIR__ . '/../lib/openclaw/PrescriptionPdfRenderer.php';
require_once __DIR__ . '/../lib/clinical_history/ClinicalHistorySessionRepository.php';
require_once __DIR__ . '/../payment-lib.php';

final class PatientPortalController
{
    public static function start(array $context): void
    {
        $payload = require_json_body();
        $phone = trim((string) ($payload['phone'] ?? ($payload['whatsapp'] ?? '')));

        $result = PatientPortalAuth::startLogin(
            is_array($context['store'] ?? null) ? $context['store'] : [],
            $phone
        );

        self::emit($result);
    }

    public static function complete(array $context): void
    {
        $payload = require_json_body();
        $phone = trim((string) ($payload['phone'] ?? ($payload['whatsapp'] ?? '')));
        $code = trim((string) ($payload['code'] ?? ($payload['otp'] ?? '')));
        $challengeId = trim((string) ($payload['challengeId'] ?? ''));

        $result = PatientPortalAuth::completeLogin(
            is_array($context['store'] ?? null) ? $context['store'] : [],
            $phone,
            $code,
            $challengeId
        );

        self::emit($result);
    }

    public static function status(array $context): void
    {
        $result = PatientPortalAuth::readStatus(
            is_array($context['store'] ?? null) ? $context['store'] : [],
            PatientPortalAuth::bearerTokenFromRequest()
        );

        self::emit($result);
    }

    public static function dashboard(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
        $nextAppointment = self::findNextAppointment($store, $snapshot);

        self::emit([
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'patient' => $patient,
                'nextAppointment' => $nextAppointment === []
                    ? null
                    : self::buildAppointmentSummary($nextAppointment, $patient),
                'treatmentPlan' => self::buildTreatmentPlanSummary($store, $snapshot, $patient, $nextAppointment),
                'billing' => self::buildBillingSummary($store, $snapshot),
                'evolution' => self::buildEvolutionSummary($store, $snapshot),
                'support' => [
                    'bookingUrl' => '/#citas',
                    'historyUrl' => '/es/portal/historial/',
                    'photosUrl' => '/es/portal/fotos/',
                    'whatsappUrl' => self::buildSupportWhatsappUrl($patient, $nextAppointment),
                ],
                'generatedAt' => local_date('c'),
            ],
        ]);
    }

    public static function history(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];

        self::emit([
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'patient' => $patient,
                'consultations' => self::buildPortalHistory($store, $snapshot, $patient),
                'generatedAt' => local_date('c'),
            ],
        ]);
    }

    public static function photos(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];

        self::emit([
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'patient' => $patient,
                'gallery' => self::buildPortalPhotoGallery($store, $snapshot),
                'generatedAt' => local_date('c'),
            ],
        ]);
    }

    public static function document(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $type = strtolower(trim((string) ($_GET['type'] ?? '')));
        $documentId = trim((string) ($_GET['id'] ?? ''));
        if ($type === '' || $documentId === '') {
            json_response(['ok' => false, 'error' => 'type e id son requeridos'], 400);
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $caseIds = self::collectPatientCaseIds($store, $snapshot);

        if ($type === 'prescription') {
            $prescription = self::findPrescriptionById($store, $documentId);
            $caseId = trim((string) ($prescription['caseId'] ?? ''));

            if (!is_array($prescription) || !self::caseBelongsToPortalPatient($caseId, $caseIds, $snapshot)) {
                json_response(['ok' => false, 'error' => 'Documento no disponible para esta sesión'], 404);
            }

            $patient = self::resolveCasePatient($store, $caseId);
            $pdfBytes = PrescriptionPdfRenderer::generatePdfBytes(
                $prescription,
                $patient,
                read_clinic_profile()
            );

            self::emitPdfResponse($pdfBytes, self::buildPrescriptionFileName($documentId));
            return;
        }

        if ($type === 'certificate') {
            $certificate = self::findCertificateById($store, $documentId);
            $caseId = trim((string) ($certificate['caseId'] ?? ''));

            if (!is_array($certificate) || !self::caseBelongsToPortalPatient($caseId, $caseIds, $snapshot)) {
                json_response(['ok' => false, 'error' => 'Documento no disponible para esta sesión'], 404);
            }

            $patient = self::resolveCasePatient($store, $caseId);
            $pdfBytes = self::generateCertificatePdfBytes($certificate, $patient);

            self::emitPdfResponse($pdfBytes, self::buildCertificateFileName($certificate, $documentId));
            return;
        }

        json_response(['ok' => false, 'error' => 'Tipo de documento no soportado'], 400);
    }

    public static function photoFile(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $photoId = trim((string) ($_GET['id'] ?? ''));
        if ($photoId === '') {
            json_response(['ok' => false, 'error' => 'id requerido'], 400);
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $caseIds = self::collectPatientCaseIds($store, $snapshot);

        $upload = self::findPortalVisiblePhotoUpload($store, $caseIds, $photoId);
        if (!is_array($upload)) {
            json_response(['ok' => false, 'error' => 'Foto no disponible para esta sesión'], 404);
        }

        $asset = self::resolvePortalPhotoAsset($upload);
        if (($asset['path'] ?? '') === '') {
            json_response(['ok' => false, 'error' => 'Foto no disponible para esta sesión'], 404);
        }

        self::emitBinaryResponse(
            (string) file_get_contents((string) $asset['path']),
            (string) ($asset['contentType'] ?? 'application/octet-stream'),
            (string) ($asset['fileName'] ?? 'foto-clinica.jpg')
        );
    }

    private static function findNextAppointment(array $store, array $snapshot): array
    {
        $matches = [];
        $now = time();

        foreach (($store['appointments'] ?? []) as $appointment) {
            if (!is_array($appointment) || !self::appointmentMatchesPatient($appointment, $snapshot)) {
                continue;
            }

            $status = function_exists('map_appointment_status')
                ? map_appointment_status((string) ($appointment['status'] ?? 'confirmed'))
                : strtolower(trim((string) ($appointment['status'] ?? 'confirmed')));
            if (in_array($status, ['cancelled', 'completed', 'no_show'], true)) {
                continue;
            }

            $timestamp = self::appointmentTimestamp($appointment);
            if ($timestamp === null || $timestamp < $now) {
                continue;
            }

            $matches[] = [
                'timestamp' => $timestamp,
                'appointment' => $appointment,
            ];
        }

        usort($matches, static function (array $left, array $right): int {
            return ((int) ($left['timestamp'] ?? 0)) <=> ((int) ($right['timestamp'] ?? 0));
        });

        return is_array($matches[0]['appointment'] ?? null) ? $matches[0]['appointment'] : [];
    }

    private static function buildPortalHistory(array $store, array $snapshot, array $patient): array
    {
        $caseIds = self::collectPatientCaseIds($store, $snapshot);
        $documentsByCase = self::buildDocumentsByCaseId($store, $caseIds);
        $photoSummaryByCase = self::buildCasePhotoSummaryByCaseId($store, $caseIds);
        $consultations = [];
        $representedCaseIds = [];

        foreach (($store['appointments'] ?? []) as $appointment) {
            if (!is_array($appointment) || !self::appointmentMatchesPatient($appointment, $snapshot)) {
                continue;
            }

            $status = function_exists('map_appointment_status')
                ? map_appointment_status((string) ($appointment['status'] ?? 'confirmed'))
                : strtolower(trim((string) ($appointment['status'] ?? 'confirmed')));
            if ($status === 'cancelled') {
                continue;
            }

            $caseId = self::resolveAppointmentCaseId($appointment, $snapshot);
            $documents = $documentsByCase[$caseId] ?? self::defaultDocumentState($caseId);
            $timestamp = self::appointmentTimestamp($appointment) ?? self::recordTimestamp($appointment);

            if (!self::shouldIncludeConsultationInHistory($status, $timestamp, $documents)) {
                continue;
            }

            $consultations[] = self::buildHistoryConsultationFromAppointment(
                $store,
                $appointment,
                $patient,
                $caseId,
                $documents,
                $timestamp,
                $photoSummaryByCase[$caseId] ?? []
            );

            if ($caseId !== '') {
                $representedCaseIds[$caseId] = true;
            }
        }

        foreach ($caseIds as $caseId) {
            if ($caseId === '' || isset($representedCaseIds[$caseId])) {
                continue;
            }

            $documents = $documentsByCase[$caseId] ?? self::defaultDocumentState($caseId);
            if (!self::documentsHavePortalSignal($documents)) {
                continue;
            }

            $caseRecord = self::findPatientCaseRecord($store, $caseId);
            $consultations[] = self::buildHistoryConsultationFromCase(
                $caseRecord,
                $patient,
                $caseId,
                $documents,
                $photoSummaryByCase[$caseId] ?? []
            );
        }

        usort($consultations, static function (array $left, array $right): int {
            return ((int) ($right['sortTimestamp'] ?? 0)) <=> ((int) ($left['sortTimestamp'] ?? 0));
        });

        $upcomingAppointment = self::findNextAppointment($store, $snapshot);
        if ($consultations !== [] && $upcomingAppointment !== []) {
            if (!isset($consultations[0]['events']) || !is_array($consultations[0]['events'])) {
                $consultations[0]['events'] = [];
            }

            $consultations[0]['events'][] = self::buildPortalNextControlEvent(
                self::buildAppointmentSummary($upcomingAppointment, $patient)
            );
        }

        return array_values(array_map(static function (array $consultation): array {
            unset($consultation['sortTimestamp']);
            return $consultation;
        }, $consultations));
    }

    private static function buildTreatmentPlanSummary(
        array $store,
        array $snapshot,
        array $patient,
        array $nextAppointment
    ): ?array {
        $caseIds = self::collectPatientCaseIds($store, $snapshot);
        $activeDraft = self::findLatestCarePlanDraft($store, $caseIds);

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
        $prescription = self::findLatestPrescriptionForCase($store, $caseId);
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

    private static function findLatestCarePlanDraft(array $store, array $caseIds): ?array
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

    private static function carePlanHasContent(array $carePlan): bool
    {
        return trim((string) ($carePlan['diagnosis'] ?? '')) !== ''
            || trim((string) ($carePlan['treatments'] ?? '')) !== ''
            || trim((string) ($carePlan['followUpFrequency'] ?? '')) !== ''
            || trim((string) ($carePlan['goals'] ?? '')) !== '';
    }

    private static function countTreatmentSessions(array $store, array $snapshot, int $planStartedAt): array
    {
        $completed = 0;
        $future = 0;
        $now = time();

        foreach (($store['appointments'] ?? []) as $appointment) {
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

    private static function resolvePlannedSessions(array $carePlan, array $sessionMetrics): int
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

    private static function parsePlannedSessions(string $text): ?int
    {
        if ($text === '') {
            return null;
        }

        if (preg_match('/(\d+)\s+sesion(?:es)?/i', $text, $matches) === 1) {
            return max(1, (int) ($matches[1] ?? 0));
        }

        return null;
    }

    private static function findLatestPrescriptionForCase(array $store, string $caseId): ?array
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

    private static function buildTreatmentPlanTasks(
        array $carePlan,
        ?array $prescription,
        array $nextAppointment
    ): array {
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

    private static function splitPlanTasks(string $text): array
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

    private static function rememberTask(array &$tasks, string $label): void
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

    private static function buildBillingSummary(array $store, array $snapshot): array
    {
        $orders = self::collectPortalBillingOrders($store, $snapshot);
        $currency = self::portalPaymentCurrency();

        if ($orders === []) {
            return [
                'tone' => 'good',
                'statusLabel' => 'Sin saldo pendiente',
                'statusDetail' => 'No encontramos cobros activos asociados a tu portal por ahora.',
                'totalPendingCents' => 0,
                'totalPendingLabel' => self::formatPortalCurrency(0, $currency),
                'reviewBalanceCents' => 0,
                'reviewBalanceLabel' => self::formatPortalCurrency(0, $currency),
                'lastPayment' => null,
                'nextObligation' => null,
                'payNowUrl' => '/es/pago/',
            ];
        }

        $outstandingBalanceCents = 0;
        $reviewBalanceCents = 0;
        $outstandingCount = 0;
        $overdueCount = 0;

        foreach ($orders as $order) {
            $amountCents = (int) ($order['amountCents'] ?? 0);
            $bucket = (string) ($order['statusBucket'] ?? '');
            if ($bucket === 'outstanding') {
                $outstandingBalanceCents += $amountCents;
                $outstandingCount += 1;
                if ((string) ($order['dueState'] ?? '') === 'overdue') {
                    $overdueCount += 1;
                }
            } elseif ($bucket === 'reconciliating') {
                $reviewBalanceCents += $amountCents;
            }
        }

        $totalPendingCents = $outstandingBalanceCents + $reviewBalanceCents;
        $lastPayment = self::findLatestPortalBillingOrder($orders, 'settled');
        $nextObligation = self::findNextPortalBillingOrder($orders);

        [$tone, $statusLabel, $statusDetail] = self::resolveBillingStatus(
            $outstandingBalanceCents,
            $reviewBalanceCents,
            $outstandingCount,
            $overdueCount,
            $lastPayment,
            $nextObligation
        );

        return [
            'tone' => $tone,
            'statusLabel' => $statusLabel,
            'statusDetail' => $statusDetail,
            'totalPendingCents' => $totalPendingCents,
            'totalPendingLabel' => self::formatPortalCurrency($totalPendingCents, $currency),
            'reviewBalanceCents' => $reviewBalanceCents,
            'reviewBalanceLabel' => self::formatPortalCurrency($reviewBalanceCents, $currency),
            'lastPayment' => $lastPayment,
            'nextObligation' => $nextObligation,
            'payNowUrl' => '/es/pago/',
        ];
    }

    private static function buildEvolutionSummary(array $store, array $snapshot): ?array
    {
        $caseIds = self::collectPatientCaseIds($store, $snapshot);
        $caseMap = [];
        foreach ($caseIds as $caseId) {
            $caseId = trim((string) $caseId);
            if ($caseId !== '') {
                $caseMap[$caseId] = true;
            }
        }

        $photosByGroup = [];
        foreach (($store['clinical_uploads'] ?? []) as $upload) {
            if (!is_array($upload)) {
                continue;
            }

            $caseId = self::firstNonEmptyString(
                (string) ($upload['patientCaseId'] ?? ''),
                (string) ($upload['clinicalHistoryCaseId'] ?? '')
            );
            if ($caseId === '' || !isset($caseMap[$caseId])) {
                continue;
            }

            if (strtolower(trim((string) ($upload['kind'] ?? ''))) !== 'case_photo') {
                continue;
            }

            $bodyZone = trim((string) ($upload['bodyZone'] ?? 'rostro'));
            $groupId = $caseId . '|' . strtolower($bodyZone);
            if (!isset($photosByGroup[$groupId])) {
                $photosByGroup[$groupId] = [];
            }
            $photosByGroup[$groupId][] = $upload;
        }

        $bestEvolution = null;
        $maxDiff = 0;

        foreach ($photosByGroup as $groupId => $photos) {
            if (count($photos) < 2) {
                continue;
            }

            usort($photos, static function (array $a, array $b): int {
                return strtotime((string) ($a['createdAt'] ?? '')) <=> strtotime((string) ($b['createdAt'] ?? ''));
            });

            $firstPhoto = $photos[0];
            $lastPhoto = $photos[count($photos) - 1];

            $firstTs = strtotime((string) ($firstPhoto['createdAt'] ?? '')) ?: 0;
            $lastTs = strtotime((string) ($lastPhoto['createdAt'] ?? '')) ?: 0;
            $diffSeconds = $lastTs - $firstTs;

            // Al menos 1 día de diferencia
            if ($diffSeconds >= 86400 && $diffSeconds > $maxDiff) {
                $maxDiff = $diffSeconds;
                
                $days = (int) floor($diffSeconds / 86400);
                $weeks = (int) floor($days / 7);
                $afterLabel = $weeks > 0 ? "Semana $weeks" : "Día $days";

                $bestEvolution = [
                    'before' => [
                        'url' => (string) ($firstPhoto['optimizedUrl'] ?? $firstPhoto['url'] ?? ''),
                        'label' => 'Día 1',
                        'date' => (string) ($firstPhoto['createdAt'] ?? ''),
                    ],
                    'after' => [
                        'url' => (string) ($lastPhoto['optimizedUrl'] ?? $lastPhoto['url'] ?? ''),
                        'label' => $afterLabel,
                        'date' => (string) ($lastPhoto['createdAt'] ?? ''),
                    ],
                    'bodyZone' => trim((string) ($firstPhoto['bodyZone'] ?? 'Seguimiento general')),
                    'diffDays' => $days,
                ];
            }
        }

        return $bestEvolution;
    }

    private static function buildPortalPhotoGallery(array $store, array $snapshot): array
    {
        $caseIds = self::collectPatientCaseIds($store, $snapshot);
        $caseMap = [];
        foreach ($caseIds as $caseId) {
            $caseId = trim((string) $caseId);
            if ($caseId !== '') {
                $caseMap[$caseId] = true;
            }
        }

        $groups = [];
        $totalPhotos = 0;
        $latestTimestamp = 0;
        $latestCreatedAt = '';

        foreach (($store['clinical_uploads'] ?? []) as $upload) {
            if (!is_array($upload) || !self::portalPhotoBelongsToCaseMap($upload, $caseMap)) {
                continue;
            }

            if (!self::isPortalVisiblePhoto($upload)) {
                continue;
            }

            $normalized = self::normalizePortalPhotoItem($upload);
            if ($normalized === null) {
                continue;
            }

            $groupKey = strtolower(trim((string) ($normalized['bodyZone'] ?? 'general')));
            if (!isset($groups[$groupKey])) {
                $groups[$groupKey] = [
                    'bodyZone' => (string) ($normalized['bodyZone'] ?? 'general'),
                    'bodyZoneLabel' => (string) ($normalized['bodyZoneLabel'] ?? 'Seguimiento general'),
                    'photoCount' => 0,
                    'latestCreatedAt' => '',
                    'latestCreatedAtLabel' => '',
                    'items' => [],
                    'sortTimestamp' => 0,
                ];
            }

            $groups[$groupKey]['items'][] = $normalized;
            $groups[$groupKey]['photoCount']++;
            $itemTimestamp = (int) ($normalized['sortTimestamp'] ?? 0);
            if ($itemTimestamp >= (int) ($groups[$groupKey]['sortTimestamp'] ?? 0)) {
                $groups[$groupKey]['sortTimestamp'] = $itemTimestamp;
                $groups[$groupKey]['latestCreatedAt'] = (string) ($normalized['createdAt'] ?? '');
                $groups[$groupKey]['latestCreatedAtLabel'] = (string) ($normalized['createdAtLabel'] ?? '');
            }

            $totalPhotos++;
            if ($itemTimestamp >= $latestTimestamp) {
                $latestTimestamp = $itemTimestamp;
                $latestCreatedAt = (string) ($normalized['createdAt'] ?? '');
            }
        }

        foreach ($groups as &$group) {
            usort($group['items'], static function (array $left, array $right): int {
                return ((int) ($right['sortTimestamp'] ?? 0)) <=> ((int) ($left['sortTimestamp'] ?? 0));
            });

            $group['items'] = array_values(array_map(static function (array $item): array {
                unset($item['sortTimestamp']);
                return $item;
            }, $group['items']));
        }
        unset($group);

        usort($groups, static function (array $left, array $right): int {
            return ((int) ($right['sortTimestamp'] ?? 0)) <=> ((int) ($left['sortTimestamp'] ?? 0));
        });

        $groups = array_values(array_map(static function (array $group): array {
            unset($group['sortTimestamp']);
            return $group;
        }, $groups));

        return [
            'totalPhotos' => $totalPhotos,
            'bodyZoneCount' => count($groups),
            'latestCreatedAt' => $latestCreatedAt,
            'latestCreatedAtLabel' => self::buildPortalDateTimeLabel($latestCreatedAt, ''),
            'groups' => $groups,
        ];
    }

    private static function collectPortalBillingOrders(array $store, array $snapshot): array
    {
        $orders = [];
        $portalPhone = trim((string) ($snapshot['phone'] ?? ''));
        $portalEmail = self::normalizePortalEmail((string) ($snapshot['email'] ?? ''));

        foreach (($store['checkout_orders'] ?? []) as $order) {
            if (!is_array($order) || !self::checkoutOrderMatchesPortalPatient($order, $portalPhone, $portalEmail)) {
                continue;
            }

            $amountCents = (int) ($order['amountCents'] ?? 0);
            if ($amountCents <= 0) {
                continue;
            }

            $status = strtolower(trim((string) ($order['paymentStatus'] ?? 'pending')));
            $paymentMethod = strtolower(trim((string) ($order['paymentMethod'] ?? '')));
            $currency = strtoupper(trim((string) ($order['currency'] ?? self::portalPaymentCurrency())));
            $dueAt = self::resolvePortalBillingDueAt($order);
            $activityAt = self::resolvePortalBillingActivityAt($order);
            $statusBucket = self::resolvePortalBillingBucket($status);
            $dueState = self::resolvePortalBillingDueState($statusBucket, $dueAt);

            $orders[] = [
                'id' => (string) ($order['id'] ?? ''),
                'concept' => trim((string) ($order['concept'] ?? 'Saldo pendiente')),
                'amountCents' => $amountCents,
                'amountLabel' => self::formatPortalCurrency($amountCents, $currency),
                'currency' => $currency,
                'paymentStatus' => $status,
                'paymentStatusLabel' => self::portalPaymentStatusLabel($status, $order),
                'paymentMethod' => $paymentMethod,
                'paymentMethodLabel' => self::portalPaymentMethodLabel($paymentMethod),
                'statusBucket' => $statusBucket,
                'dueAt' => $dueAt,
                'dueAtLabel' => self::buildPortalDateTimeLabel($dueAt, 'Por confirmar'),
                'dueState' => $dueState,
                'activityAt' => $activityAt,
                'activityAtLabel' => self::buildPortalDateTimeLabel($activityAt, 'Sin fecha'),
            ];
        }

        return $orders;
    }

    private static function checkoutOrderMatchesPortalPatient(array $order, string $portalPhone, string $portalEmail): bool
    {
        $payerEmail = self::normalizePortalEmail((string) ($order['payerEmail'] ?? ''));
        if ($portalEmail !== '' && $payerEmail !== '' && $portalEmail === $payerEmail) {
            return true;
        }

        $payerWhatsapp = trim((string) ($order['payerWhatsapp'] ?? ''));
        if ($portalPhone !== '' && $payerWhatsapp !== '' && PatientPortalAuth::matchesPatientPhone($payerWhatsapp, $portalPhone)) {
            return true;
        }

        return false;
    }

    private static function normalizePortalEmail(string $value): string
    {
        return strtolower(trim($value));
    }

    private static function resolvePortalBillingBucket(string $status): string
    {
        return match ($status) {
            'paid', 'applied' => 'settled',
            'verified_transfer' => 'reconciliating',
            default => 'outstanding',
        };
    }

    private static function resolvePortalBillingDueAt(array $order): string
    {
        $dueAt = self::normalizePortalIsoDateTime((string) ($order['dueAt'] ?? ''));
        if ($dueAt !== '') {
            return $dueAt;
        }

        $createdAt = self::normalizePortalIsoDateTime((string) ($order['createdAt'] ?? ''));
        if ($createdAt === '') {
            return '';
        }

        $modifier = strtolower(trim((string) ($order['paymentMethod'] ?? ''))) === 'card'
            ? '+60 minutes'
            : '+72 hours';

        try {
            return (new \DateTimeImmutable($createdAt))->modify($modifier)->format('c');
        } catch (\Throwable $error) {
            return '';
        }
    }

    private static function resolvePortalBillingActivityAt(array $order): string
    {
        return self::firstNonEmptyString(
            self::normalizePortalIsoDateTime((string) ($order['transferAppliedAt'] ?? '')),
            self::normalizePortalIsoDateTime((string) ($order['paymentPaidAt'] ?? '')),
            self::normalizePortalIsoDateTime((string) ($order['transferVerifiedAt'] ?? '')),
            self::normalizePortalIsoDateTime((string) ($order['updatedAt'] ?? '')),
            self::normalizePortalIsoDateTime((string) ($order['createdAt'] ?? ''))
        );
    }

    private static function resolvePortalBillingDueState(string $bucket, string $dueAt): string
    {
        if ($bucket !== 'outstanding' || $dueAt === '') {
            return 'none';
        }

        $dueTs = strtotime($dueAt);
        if ($dueTs === false) {
            return 'scheduled';
        }

        return $dueTs <= time() ? 'overdue' : 'scheduled';
    }

    private static function findLatestPortalBillingOrder(array $orders, string $bucket): ?array
    {
        $match = null;
        $matchTs = 0;

        foreach ($orders as $order) {
            if ((string) ($order['statusBucket'] ?? '') !== $bucket) {
                continue;
            }

            $activityTs = strtotime((string) ($order['activityAt'] ?? '')) ?: 0;
            if ($activityTs >= $matchTs) {
                $match = $order;
                $matchTs = $activityTs;
            }
        }

        if (!is_array($match)) {
            return null;
        }

        return [
            'concept' => (string) ($match['concept'] ?? ''),
            'amountLabel' => (string) ($match['amountLabel'] ?? ''),
            'paidAt' => (string) ($match['activityAt'] ?? ''),
            'paidAtLabel' => (string) ($match['activityAtLabel'] ?? ''),
            'paymentMethodLabel' => (string) ($match['paymentMethodLabel'] ?? ''),
        ];
    }

    private static function findNextPortalBillingOrder(array $orders): ?array
    {
        $match = null;
        $matchTs = 0;

        foreach ($orders as $order) {
            if ((string) ($order['statusBucket'] ?? '') !== 'outstanding') {
                continue;
            }

            $dueAt = (string) ($order['dueAt'] ?? '');
            $dueTs = strtotime($dueAt) ?: 0;
            if ($match === null) {
                $match = $order;
                $matchTs = $dueTs;
                continue;
            }

            if ($dueTs > 0 && ($matchTs === 0 || $dueTs < $matchTs)) {
                $match = $order;
                $matchTs = $dueTs;
            }
        }

        if (!is_array($match)) {
            return null;
        }

        return [
            'concept' => (string) ($match['concept'] ?? ''),
            'amountLabel' => (string) ($match['amountLabel'] ?? ''),
            'dueAt' => (string) ($match['dueAt'] ?? ''),
            'dueAtLabel' => (string) ($match['dueAtLabel'] ?? ''),
            'statusLabel' => (string) ($match['paymentStatusLabel'] ?? ''),
            'dueState' => (string) ($match['dueState'] ?? 'scheduled'),
        ];
    }

    private static function resolveBillingStatus(
        int $outstandingBalanceCents,
        int $reviewBalanceCents,
        int $outstandingCount,
        int $overdueCount,
        ?array $lastPayment,
        ?array $nextObligation
    ): array {
        if ($overdueCount > 0) {
            return [
                'attention',
                'Pago vencido',
                $nextObligation !== null
                    ? 'Tienes un cobro vencido. Regularízalo desde el checkout seguro para evitar retrasos en tu atención.'
                    : 'Tienes un cobro vencido pendiente de regularización.',
            ];
        }

        if ($outstandingBalanceCents > 0) {
            return [
                'warning',
                'Saldo pendiente',
                $nextObligation !== null
                    ? 'Tu próxima obligación ya está visible en el portal. Puedes pagarla sin exponer datos bancarios.'
                    : 'Tienes un saldo pendiente disponible para pago seguro.',
            ];
        }

        if ($reviewBalanceCents > 0) {
            return [
                'warning',
                'Pago en revisión',
                'Ya recibimos tu comprobante y el equipo lo está validando antes de aplicarlo a tu saldo.',
            ];
        }

        return [
            'good',
            'Al día',
            $lastPayment !== null
                ? 'Tu último pago quedó aplicado y no tienes obligaciones pendientes por ahora.'
                : 'No tienes obligaciones pendientes asociadas a este portal.',
        ];
    }

    private static function portalPaymentCurrency(): string
    {
        if (function_exists('payment_currency')) {
            $currency = strtoupper(trim((string) payment_currency()));
            if ($currency !== '') {
                return $currency;
            }
        }

        return 'USD';
    }

    private static function formatPortalCurrency(int $amountCents, string $currency): string
    {
        $safeCurrency = strtoupper(trim($currency));
        if ($safeCurrency === '') {
            $safeCurrency = 'USD';
        }

        $prefix = $safeCurrency === 'USD' ? '$' : $safeCurrency . ' ';
        return $prefix . number_format($amountCents / 100, 2, '.', ',');
    }

    private static function portalPaymentMethodLabel(string $method): string
    {
        return match ($method) {
            'card' => 'Tarjeta',
            'transfer' => 'Transferencia',
            'cash' => 'Efectivo en consultorio',
            default => 'Pendiente',
        };
    }

    private static function portalPaymentStatusLabel(string $status, array $order): string
    {
        if (
            $status === 'pending_transfer' &&
            trim((string) ($order['transferProofUploadedAt'] ?? '')) !== ''
        ) {
            return 'Pendiente de verificación';
        }

        return match ($status) {
            'paid' => 'Pagado',
            'pending_gateway' => 'Esperando confirmación',
            'pending_transfer' => 'Pendiente de transferencia',
            'pending_cash' => 'Pendiente de pago en consultorio',
            'verified_transfer' => 'En revisión',
            'applied' => 'Aplicado',
            'failed' => 'Fallido',
            default => 'Pendiente',
        };
    }

    private static function normalizePortalIsoDateTime(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        try {
            return (new \DateTimeImmutable($value))->format('c');
        } catch (\Throwable $error) {
            return '';
        }
    }

    private static function buildPortalDateTimeLabel(string $value, string $fallback): string
    {
        $normalized = self::normalizePortalIsoDateTime($value);
        if ($normalized === '') {
            return $fallback;
        }

        try {
            $dateTime = new \DateTimeImmutable($normalized);
            return self::buildDateLabel($dateTime->format('Y-m-d')) . ' · ' . self::buildTimeLabel($dateTime->format('H:i'));
        } catch (\Throwable $error) {
            return $fallback;
        }
    }

    private static function collectPatientCaseIds(array $store, array $snapshot): array
    {
        $caseIds = [];
        $remember = static function (string $caseId) use (&$caseIds): void {
            $caseId = trim($caseId);
            if ($caseId !== '') {
                $caseIds[$caseId] = true;
            }
        };

        $remember((string) ($snapshot['patientCaseId'] ?? ''));

        foreach (($store['appointments'] ?? []) as $appointment) {
            if (!is_array($appointment) || !self::appointmentMatchesPatient($appointment, $snapshot)) {
                continue;
            }

            $remember((string) ($appointment['patientCaseId'] ?? ''));
        }

        foreach (($store['patient_cases'] ?? []) as $caseRecord) {
            if (!is_array($caseRecord)) {
                continue;
            }

            if (self::patientCaseMatchesSnapshot($caseRecord, $snapshot)) {
                $remember((string) ($caseRecord['id'] ?? ''));
            }
        }

        return array_keys($caseIds);
    }

    private static function patientCaseMatchesSnapshot(array $caseRecord, array $snapshot): bool
    {
        $caseId = trim((string) ($snapshot['patientCaseId'] ?? ''));
        if ($caseId !== '' && $caseId === trim((string) ($caseRecord['id'] ?? ''))) {
            return true;
        }

        $patientId = trim((string) ($snapshot['patientId'] ?? ''));
        if ($patientId !== '' && $patientId === trim((string) ($caseRecord['patientId'] ?? ''))) {
            return true;
        }

        $summary = is_array($caseRecord['summary'] ?? null) ? $caseRecord['summary'] : [];
        $candidatePhones = [
            (string) ($summary['contactPhone'] ?? ''),
            (string) ($caseRecord['contactPhone'] ?? ''),
            (string) ($summary['patientPhone'] ?? ''),
        ];
        $phone = trim((string) ($snapshot['phone'] ?? ''));

        foreach ($candidatePhones as $candidatePhone) {
            if ($phone !== '' && PatientPortalAuth::matchesPatientPhone($candidatePhone, $phone)) {
                return true;
            }
        }

        return false;
    }

    private static function resolveAppointmentCaseId(array $appointment, array $snapshot): string
    {
        $caseId = trim((string) ($appointment['patientCaseId'] ?? ''));
        if ($caseId !== '') {
            return $caseId;
        }

        return trim((string) ($snapshot['patientCaseId'] ?? ''));
    }

    private static function shouldIncludeConsultationInHistory(string $status, ?int $timestamp, array $documents): bool
    {
        if ($status === 'completed') {
            return true;
        }

        if ($timestamp !== null && $timestamp <= time()) {
            return true;
        }

        return self::documentsHavePortalSignal($documents);
    }

    private static function documentsHavePortalSignal(array $documents): bool
    {
        foreach (['prescription', 'certificate'] as $type) {
            $status = (string) ($documents[$type]['status'] ?? '');
            if ($status !== '' && $status !== 'not_issued') {
                return true;
            }
        }

        return false;
    }

    private static function buildDocumentsByCaseId(array $store, array $caseIds): array
    {
        $caseMap = [];
        foreach ($caseIds as $caseId) {
            $caseId = trim((string) $caseId);
            if ($caseId !== '') {
                $caseMap[$caseId] = true;
            }
        }

        $latestPrescriptions = [];
        foreach (($store['prescriptions'] ?? []) as $prescriptionId => $prescription) {
            if (!is_array($prescription)) {
                continue;
            }

            $caseId = trim((string) ($prescription['caseId'] ?? ''));
            if ($caseId === '' || !isset($caseMap[$caseId])) {
                continue;
            }

            $prescription['id'] = trim((string) ($prescription['id'] ?? (string) $prescriptionId));
            $candidateTimestamp = self::documentTimestamp($prescription, ['issued_at', 'issuedAt', 'createdAt']);
            $currentTimestamp = isset($latestPrescriptions[$caseId])
                ? self::documentTimestamp($latestPrescriptions[$caseId], ['issued_at', 'issuedAt', 'createdAt'])
                : 0;

            if ($candidateTimestamp >= $currentTimestamp) {
                $latestPrescriptions[$caseId] = $prescription;
            }
        }

        $latestCertificates = [];
        foreach (($store['certificates'] ?? []) as $certificateId => $certificate) {
            if (!is_array($certificate)) {
                continue;
            }

            $caseId = trim((string) ($certificate['caseId'] ?? ''));
            if ($caseId === '' || !isset($caseMap[$caseId])) {
                continue;
            }

            $certificate['id'] = trim((string) ($certificate['id'] ?? (string) $certificateId));
            $candidateTimestamp = self::documentTimestamp($certificate, ['issued_at', 'issuedAt', 'createdAt']);
            $currentTimestamp = isset($latestCertificates[$caseId])
                ? self::documentTimestamp($latestCertificates[$caseId], ['issued_at', 'issuedAt', 'createdAt'])
                : 0;

            if ($candidateTimestamp >= $currentTimestamp) {
                $latestCertificates[$caseId] = $certificate;
            }
        }

        $documentsByCase = [];
        foreach (array_keys($caseMap) as $caseId) {
            $drafts = ClinicalHistorySessionRepository::findAllDraftsByCaseId($store, $caseId);
            $documentsByCase[$caseId] = [
                'prescription' => self::buildPortalDocumentPayload(
                    'prescription',
                    $latestPrescriptions[$caseId] ?? null,
                    self::hasPendingPrescriptionDraft($drafts)
                ),
                'certificate' => self::buildPortalDocumentPayload(
                    'certificate',
                    $latestCertificates[$caseId] ?? null,
                    self::hasPendingCertificateDraft($drafts)
                ),
            ];
        }

        return $documentsByCase;
    }

    private static function hasPendingPrescriptionDraft(array $drafts): bool
    {
        foreach ($drafts as $draft) {
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

        return false;
    }

    private static function hasPendingCertificateDraft(array $drafts): bool
    {
        foreach ($drafts as $draft) {
            $documents = is_array($draft['documents'] ?? null) ? $draft['documents'] : [];
            $certificate = is_array($documents['certificate'] ?? null) ? $documents['certificate'] : [];
            $status = strtolower(trim((string) ($certificate['status'] ?? '')));
            $summary = trim((string) ($certificate['summary'] ?? ''));
            $restDays = (int) ($certificate['restDays'] ?? 0);

            if ($summary !== '' || $restDays > 0) {
                return true;
            }

            if ($status !== '' && !in_array($status, ['draft', 'not_issued'], true)) {
                return true;
            }
        }

        return false;
    }

    private static function buildPortalDocumentPayload(string $type, ?array $document, bool $pending): array
    {
        $title = $type === 'prescription' ? 'Receta médica' : 'Certificado médico';

        if (is_array($document)) {
            $documentId = trim((string) ($document['id'] ?? ''));
            $issuedAt = self::firstNonEmptyString(
                (string) ($document['issued_at'] ?? ''),
                (string) ($document['issuedAt'] ?? ''),
                (string) ($document['createdAt'] ?? '')
            );

            return [
                'type' => $type,
                'title' => $title,
                'status' => 'available',
                'statusLabel' => 'Disponible',
                'description' => 'PDF listo para descargar en un toque.',
                'documentId' => $documentId,
                'downloadUrl' => '/api.php?resource=patient-portal-document&type='
                    . rawurlencode($type)
                    . '&id='
                    . rawurlencode($documentId),
                'fileName' => $type === 'prescription'
                    ? self::buildPrescriptionFileName($documentId)
                    : self::buildCertificateFileName($document, $documentId),
                'issuedAt' => $issuedAt,
                'issuedAtLabel' => self::buildDocumentIssuedLabel($issuedAt),
            ];
        }

        return [
            'type' => $type,
            'title' => $title,
            'status' => $pending ? 'pending' : 'not_issued',
            'statusLabel' => $pending ? 'Pendiente' : 'No emitido',
            'description' => $pending
                ? 'Tu documento está en preparación y aparecerá aquí cuando quede firmado.'
                : 'En esta consulta todavía no se emitió este documento.',
            'documentId' => '',
            'downloadUrl' => '',
            'fileName' => '',
            'issuedAt' => '',
            'issuedAtLabel' => '',
        ];
    }

    private static function defaultDocumentState(string $caseId): array
    {
        return [
            'prescription' => self::buildPortalDocumentPayload('prescription', null, false),
            'certificate' => self::buildPortalDocumentPayload('certificate', null, false),
        ];
    }

    private static function buildHistoryConsultationFromAppointment(
        array $store,
        array $appointment,
        array $patient,
        string $caseId,
        array $documents,
        ?int $timestamp,
        array $photoSummary
    ): array {
        $summary = self::buildAppointmentSummary($appointment, $patient);
        $status = (string) ($summary['status'] ?? 'confirmed');
        $caseRecord = self::findPatientCaseRecord($store, $caseId);
        $caseSummary = is_array($caseRecord['summary'] ?? null) ? $caseRecord['summary'] : [];
        $serviceName = self::firstNonEmptyString(
            (string) ($caseSummary['serviceName'] ?? ''),
            (string) ($caseSummary['reasonLabel'] ?? ''),
            (string) ($summary['serviceName'] ?? ''),
            'Consulta Aurora Derm'
        );

        return [
            'id' => 'appt-' . (string) ($appointment['id'] ?? $caseId),
            'caseId' => $caseId,
            'appointmentId' => (int) ($appointment['id'] ?? 0),
            'status' => $status,
            'statusLabel' => self::historyStatusLabel($status),
            'date' => (string) ($summary['date'] ?? ''),
            'dateLabel' => (string) ($summary['dateLabel'] ?? self::buildDateLabel((string) ($appointment['date'] ?? ''))),
            'time' => (string) ($summary['time'] ?? ''),
            'timeLabel' => (string) ($summary['timeLabel'] ?? self::buildTimeLabel((string) ($appointment['time'] ?? ''))),
            'doctorName' => (string) ($summary['doctorName'] ?? 'Equipo clínico Aurora Derm'),
            'serviceName' => $serviceName,
            'appointmentTypeLabel' => (string) ($summary['appointmentTypeLabel'] ?? ''),
            'locationLabel' => (string) ($summary['locationLabel'] ?? ''),
            'events' => self::buildPortalTimelineEvents([
                'dateLabel' => (string) ($summary['dateLabel'] ?? self::buildDateLabel((string) ($appointment['date'] ?? ''))),
                'timeLabel' => (string) ($summary['timeLabel'] ?? self::buildTimeLabel((string) ($appointment['time'] ?? ''))),
                'serviceName' => $serviceName,
            ], $documents, $photoSummary),
            'documents' => $documents,
            'sortTimestamp' => $timestamp ?? 0,
        ];
    }

    private static function buildHistoryConsultationFromCase(
        array $caseRecord,
        array $patient,
        string $caseId,
        array $documents,
        array $photoSummary
    ): array {
        $summary = is_array($caseRecord['summary'] ?? null) ? $caseRecord['summary'] : [];
        $rawDate = self::firstNonEmptyString(
            (string) ($caseRecord['latestActivityAt'] ?? ''),
            (string) ($caseRecord['createdAt'] ?? '')
        );
        $timestamp = self::recordTimestamp($caseRecord);
        $serviceName = self::firstNonEmptyString(
            (string) ($summary['serviceName'] ?? ''),
            (string) ($summary['reasonLabel'] ?? ''),
            'Atención Aurora Derm'
        );
        $patientName = trim((string) ($patient['name'] ?? ''));

        return [
            'id' => 'case-' . $caseId,
            'caseId' => $caseId,
            'appointmentId' => 0,
            'status' => 'completed',
            'statusLabel' => 'Atención registrada',
            'date' => $rawDate,
            'dateLabel' => self::buildCaseDateLabel($rawDate),
            'time' => '',
            'timeLabel' => '',
            'doctorName' => 'Equipo clínico Aurora Derm',
            'serviceName' => $serviceName !== '' ? $serviceName : ('Atención de ' . ($patientName !== '' ? $patientName : 'portal')),
            'appointmentTypeLabel' => '',
            'locationLabel' => 'Portal del paciente',
            'events' => self::buildPortalTimelineEvents([
                'dateLabel' => self::buildCaseDateLabel($rawDate),
                'timeLabel' => '',
                'serviceName' => $serviceName !== '' ? $serviceName : 'Atención Aurora Derm',
            ], $documents, $photoSummary),
            'documents' => $documents,
            'sortTimestamp' => $timestamp,
        ];
    }

    private static function buildCasePhotoSummaryByCaseId(array $store, array $caseIds): array
    {
        $caseMap = [];
        foreach ($caseIds as $caseId) {
            $caseId = trim((string) $caseId);
            if ($caseId !== '') {
                $caseMap[$caseId] = true;
            }
        }

        $summaryByCase = [];
        foreach (($store['clinical_uploads'] ?? []) as $upload) {
            if (!is_array($upload)) {
                continue;
            }

            $caseId = self::firstNonEmptyString(
                (string) ($upload['patientCaseId'] ?? ''),
                (string) ($upload['clinicalHistoryCaseId'] ?? '')
            );
            if ($caseId === '' || !isset($caseMap[$caseId])) {
                continue;
            }

            if (strtolower(trim((string) ($upload['kind'] ?? ''))) !== 'case_photo') {
                continue;
            }

            if (!isset($summaryByCase[$caseId])) {
                $summaryByCase[$caseId] = [
                    'count' => 0,
                    'latestCreatedAt' => '',
                    'bodyZone' => '',
                ];
            }

            $summaryByCase[$caseId]['count']++;
            $createdAt = trim((string) ($upload['createdAt'] ?? ''));
            $currentLatest = trim((string) ($summaryByCase[$caseId]['latestCreatedAt'] ?? ''));
            if ($currentLatest === '' || strtotime($createdAt) >= strtotime($currentLatest)) {
                $summaryByCase[$caseId]['latestCreatedAt'] = $createdAt;
                $summaryByCase[$caseId]['bodyZone'] = trim((string) ($upload['bodyZone'] ?? ''));
            }
        }

        return $summaryByCase;
    }

    private static function buildPortalTimelineEvents(
        array $consultation,
        array $documents,
        array $photoSummary
    ): array {
        $events = [[
            'type' => 'consultation',
            'icon' => 'visit',
            'label' => self::buildPortalConsultationEventLabel((string) ($consultation['serviceName'] ?? '')),
            'meta' => trim(
                (string) ($consultation['dateLabel'] ?? '')
                . ((string) ($consultation['timeLabel'] ?? '') !== '' ? ' · ' . (string) ($consultation['timeLabel'] ?? '') : '')
            ),
            'tone' => 'idle',
        ]];

        $prescriptionEvent = self::buildPortalDocumentTimelineEvent(
            is_array($documents['prescription'] ?? null) ? $documents['prescription'] : []
        );
        if ($prescriptionEvent !== null) {
            $events[] = $prescriptionEvent;
        }

        $certificateEvent = self::buildPortalDocumentTimelineEvent(
            is_array($documents['certificate'] ?? null) ? $documents['certificate'] : []
        );
        if ($certificateEvent !== null) {
            $events[] = $certificateEvent;
        }

        $photoEvent = self::buildPortalPhotoTimelineEvent($photoSummary);
        if ($photoEvent !== null) {
            $events[] = $photoEvent;
        }

        return $events;
    }

    private static function buildPortalConsultationEventLabel(string $serviceName): string
    {
        $serviceName = trim($serviceName);
        if ($serviceName === '') {
            return 'Consulta registrada';
        }

        $lower = function_exists('mb_strtolower')
            ? mb_strtolower($serviceName, 'UTF-8')
            : strtolower($serviceName);

        if (str_starts_with($lower, 'consulta')) {
            return $serviceName;
        }

        return 'Consulta por ' . $lower;
    }

    private static function buildPortalDocumentTimelineEvent(array $document): ?array
    {
        $status = strtolower(trim((string) ($document['status'] ?? '')));
        $type = strtolower(trim((string) ($document['type'] ?? 'document')));
        if (!in_array($status, ['available', 'pending'], true)) {
            return null;
        }

        $isPrescription = $type === 'prescription';
        $label = $status === 'available'
            ? ($isPrescription ? 'Receta lista' : 'Certificado listo')
            : ($isPrescription ? 'Receta en preparación' : 'Certificado en preparación');

        return [
            'type' => $isPrescription ? 'prescription' : 'certificate',
            'icon' => $isPrescription ? 'prescription' : 'document',
            'label' => $label,
            'meta' => trim((string) ($document['issuedAtLabel'] ?? $document['description'] ?? '')),
            'tone' => $status === 'available' ? 'good' : 'warning',
        ];
    }

    private static function buildPortalPhotoTimelineEvent(array $photoSummary): ?array
    {
        $count = (int) ($photoSummary['count'] ?? 0);
        if ($count <= 0) {
            return null;
        }

        $bodyZone = trim((string) ($photoSummary['bodyZone'] ?? ''));
        $createdAt = trim((string) ($photoSummary['latestCreatedAt'] ?? ''));
        $label = $count > 1 ? $count . ' fotos de control enviadas' : 'Foto de control enviada';
        $metaParts = [];
        if ($bodyZone !== '') {
            $metaParts[] = self::humanizeValue($bodyZone, '');
        }
        if ($createdAt !== '') {
            $metaParts[] = self::buildPortalDateTimeLabel($createdAt, '');
        }

        return [
            'type' => 'photo',
            'icon' => 'photo',
            'label' => $label,
            'meta' => trim(implode(' · ', array_filter($metaParts))),
            'tone' => 'good',
        ];
    }

    private static function buildPortalNextControlEvent(array $appointmentSummary): array
    {
        $dateLabel = trim((string) ($appointmentSummary['dateLabel'] ?? ''));
        $timeLabel = trim((string) ($appointmentSummary['timeLabel'] ?? ''));
        $serviceName = trim((string) ($appointmentSummary['serviceName'] ?? 'Próximo control'));
        $meta = trim($serviceName . ($timeLabel !== '' ? ' · ' . $timeLabel : ''));

        return [
            'type' => 'appointment',
            'icon' => 'calendar',
            'label' => $dateLabel !== '' ? 'Próximo control: ' . $dateLabel : 'Próximo control agendado',
            'meta' => $meta,
            'tone' => 'warning',
        ];
    }

    private static function historyStatusLabel(string $status): string
    {
        if ($status === 'completed') {
            return 'Atención finalizada';
        }

        if ($status === 'pending') {
            return 'Consulta en seguimiento';
        }

        return 'Consulta registrada';
    }

    private static function buildCaseDateLabel(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return 'Fecha por confirmar';
        }

        $timestamp = strtotime($value);
        if ($timestamp === false) {
            return $value;
        }

        return self::buildDateLabel(date('Y-m-d', $timestamp));
    }

    private static function findPatientCaseRecord(array $store, string $caseId): array
    {
        foreach (($store['patient_cases'] ?? []) as $caseRecord) {
            if (!is_array($caseRecord)) {
                continue;
            }

            if ($caseId === trim((string) ($caseRecord['id'] ?? ''))) {
                return $caseRecord;
            }
        }

        return [];
    }

    private static function findPrescriptionById(array $store, string $documentId): ?array
    {
        $prescription = $store['prescriptions'][$documentId] ?? null;
        if (!is_array($prescription)) {
            return null;
        }

        $prescription['id'] = trim((string) ($prescription['id'] ?? $documentId));
        return $prescription;
    }

    private static function findCertificateById(array $store, string $documentId): ?array
    {
        $certificate = $store['certificates'][$documentId] ?? null;
        if (!is_array($certificate)) {
            return null;
        }

        $certificate['id'] = trim((string) ($certificate['id'] ?? $documentId));
        return $certificate;
    }

    private static function caseBelongsToPortalPatient(string $caseId, array $caseIds, array $snapshot): bool
    {
        $caseId = trim($caseId);
        if ($caseId === '') {
            return false;
        }

        if (in_array($caseId, $caseIds, true)) {
            return true;
        }

        return $caseId === trim((string) ($snapshot['patientCaseId'] ?? ''));
    }

    private static function resolveCasePatient(array $store, string $caseId): array
    {
        if (
            $caseId !== ''
            && isset($store['patients'][$caseId])
            && is_array($store['patients'][$caseId])
        ) {
            return $store['patients'][$caseId];
        }

        $caseRecord = self::findPatientCaseRecord($store, $caseId);
        $summary = is_array($caseRecord['summary'] ?? null) ? $caseRecord['summary'] : [];

        return [
            'firstName' => trim((string) ($summary['patientLabel'] ?? 'Paciente')),
            'lastName' => '',
            'phone' => trim((string) ($summary['contactPhone'] ?? '')),
            'email' => trim((string) ($summary['contactEmail'] ?? '')),
        ];
    }

    private static function buildPrescriptionFileName(string $documentId): string
    {
        $suffix = preg_replace('/[^a-zA-Z0-9_-]/', '-', $documentId);
        return 'receta-' . ($suffix !== '' ? $suffix : 'portal') . '.pdf';
    }

    private static function buildCertificateFileName(array $certificate, string $documentId): string
    {
        $suffix = self::firstNonEmptyString(
            (string) ($certificate['folio'] ?? ''),
            (string) ($certificate['id'] ?? ''),
            $documentId
        );
        $suffix = preg_replace('/[^a-zA-Z0-9_-]/', '-', $suffix);
        return 'certificado-' . ($suffix !== '' ? $suffix : 'portal') . '.pdf';
    }

    private static function buildDocumentIssuedLabel(string $issuedAt): string
    {
        $issuedAt = trim($issuedAt);
        if ($issuedAt === '') {
            return '';
        }

        $timestamp = strtotime($issuedAt);
        if ($timestamp === false) {
            return '';
        }

        return 'Emitido el ' . self::buildDateLabel(date('Y-m-d', $timestamp));
    }

    private static function documentTimestamp(array $document, array $keys): int
    {
        foreach ($keys as $key) {
            $value = trim((string) ($document[$key] ?? ''));
            if ($value === '') {
                continue;
            }

            $timestamp = strtotime($value);
            if ($timestamp !== false) {
                return $timestamp;
            }
        }

        return 0;
    }

    private static function recordTimestamp(array $record): int
    {
        $candidates = [
            (string) ($record['latestActivityAt'] ?? ''),
            (string) ($record['updatedAt'] ?? ''),
            (string) ($record['createdAt'] ?? ''),
            trim((string) ($record['date'] ?? '') . ' ' . (string) ($record['time'] ?? '')),
            (string) ($record['dateBooked'] ?? ''),
        ];

        foreach ($candidates as $candidate) {
            $candidate = trim($candidate);
            if ($candidate === '') {
                continue;
            }

            $timestamp = strtotime($candidate);
            if ($timestamp !== false) {
                return $timestamp;
            }
        }

        return 0;
    }

    private static function firstNonEmptyString(string ...$values): string
    {
        foreach ($values as $value) {
            $value = trim($value);
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    private static function emitPdfResponse(string $pdfBytes, string $fileName): void
    {
        if (defined('TESTING_ENV')) {
            $payload = [
                'ok' => true,
                'format' => 'pdf',
                'filename' => $fileName,
                'contentType' => 'application/pdf',
                'contentLength' => strlen($pdfBytes),
                'binary' => $pdfBytes,
            ];
            $GLOBALS['__TEST_RESPONSE'] = ['payload' => $payload, 'status' => 200];
            if (!defined('TESTING_FORCE_EXIT')) {
                throw new TestingExitException($payload, 200);
            }
        }

        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . $fileName . '"');
        header('Content-Length: ' . strlen($pdfBytes));
        header('Cache-Control: private, max-age=3600');
        echo $pdfBytes;
        exit;
    }

    private static function generateCertificatePdfBytes(array $certificate, array $patient): string
    {
        $html = self::buildCertificateHtml($certificate, $patient);

        $autoloadPath = __DIR__ . '/../vendor/autoload.php';
        if (file_exists($autoloadPath)) {
            require_once $autoloadPath;
        }

        $dompdfPath = __DIR__ . '/../vendor/dompdf/dompdf/src/Dompdf.php';
        if (file_exists($dompdfPath)) {
            require_once $dompdfPath;
        }

        if (class_exists(\Dompdf\Dompdf::class)) {
            try {
                $dompdf = new \Dompdf\Dompdf([
                    'isHtml5ParserEnabled' => true,
                    'isRemoteEnabled' => true,
                ]);
                $dompdf->loadHtml($html, 'UTF-8');
                $dompdf->setPaper('A4', 'portrait');
                $dompdf->render();
                return $dompdf->output();
            } catch (\Throwable $error) {
                // Ignore dompdf errors and use the text fallback below.
            }
        }

        return self::buildFallbackPdf($html);
    }

    private static function buildCertificateHtml(array $certificate, array $patient): string
    {
        $clinicProfile = read_clinic_profile();
        $doctor = function_exists('doctor_profile_document_fields')
            ? doctor_profile_document_fields(
                isset($certificate['doctor']) && is_array($certificate['doctor'])
                    ? $certificate['doctor']
                    : ['name' => (string) ($certificate['issued_by'] ?? 'Medico tratante')]
            )
            : (is_array($certificate['doctor'] ?? null) ? $certificate['doctor'] : []);

        $certificatePatient = is_array($certificate['patient'] ?? null) ? $certificate['patient'] : [];
        $patientName = self::escapeHtml(self::firstNonEmptyString(
            trim((string) ($certificatePatient['name'] ?? '')),
            trim((string) (($certificatePatient['firstName'] ?? '') . ' ' . ($certificatePatient['lastName'] ?? ''))),
            trim((string) (($patient['firstName'] ?? '') . ' ' . ($patient['lastName'] ?? ''))),
            trim((string) ($patient['name'] ?? '')),
            'Paciente Aurora Derm'
        ));
        $patientId = self::escapeHtml(self::firstNonEmptyString(
            (string) ($certificatePatient['identification'] ?? ''),
            (string) ($certificatePatient['ci'] ?? ''),
            (string) ($patient['ci'] ?? ''),
            (string) ($patient['cedula'] ?? ''),
            (string) ($patient['identification'] ?? '')
        ));
        $doctorName = self::escapeHtml(self::firstNonEmptyString(
            (string) ($doctor['name'] ?? ''),
            (string) ($certificate['issued_by'] ?? ''),
            'Médico tratante'
        ));
        $doctorSpecialty = self::escapeHtml((string) ($doctor['specialty'] ?? ''));
        $doctorMsp = self::escapeHtml((string) ($doctor['msp'] ?? ''));
        $signatureImage = self::escapeHtml((string) ($doctor['signatureImage'] ?? ''));
        $signatureHtml = $signatureImage !== ''
            ? '<img src="' . $signatureImage . '" alt="Firma digital" style="max-width:220px; max-height:80px; display:block; margin-left:auto; margin-bottom:12px; object-fit:contain;">'
            : '';
        $clinicName = self::escapeHtml(self::firstNonEmptyString(
            (string) ($certificate['clinicName'] ?? ''),
            (string) ($clinicProfile['clinicName'] ?? ''),
            'Aurora Derm'
        ));
        $clinicAddress = self::escapeHtml(self::firstNonEmptyString(
            (string) ($certificate['clinicAddress'] ?? ''),
            (string) ($clinicProfile['address'] ?? ''),
            'Quito, Ecuador'
        ));
        $clinicPhone = self::escapeHtml(self::firstNonEmptyString(
            (string) ($certificate['clinicPhone'] ?? ''),
            (string) ($clinicProfile['phone'] ?? '')
        ));
        $typeLabel = self::escapeHtml(self::firstNonEmptyString(
            (string) ($certificate['typeLabel'] ?? ''),
            self::humanizeValue((string) ($certificate['type'] ?? ''), 'Certificado médico')
        ));
        $diagnosis = self::escapeHtml(self::firstNonEmptyString(
            (string) ($certificate['diagnosisText'] ?? ''),
            (string) ($certificate['diagnosis_text'] ?? ''),
            'Sin diagnóstico consignado'
        ));
        $cie10 = self::escapeHtml(self::firstNonEmptyString(
            (string) ($certificate['cie10Code'] ?? ''),
            (string) ($certificate['cie10_code'] ?? '')
        ));
        $restDays = max(
            0,
            (int) self::firstNonEmptyString(
                (string) ($certificate['restDays'] ?? ''),
                (string) ($certificate['rest_days'] ?? '0')
            )
        );
        $restrictions = self::escapeHtml(self::firstNonEmptyString(
            (string) ($certificate['restrictions'] ?? ''),
            'Sin restricciones adicionales'
        ));
        $observations = self::escapeHtml((string) ($certificate['observations'] ?? ''));
        $issuedAt = self::firstNonEmptyString(
            (string) ($certificate['issuedDateLocal'] ?? ''),
            (string) ($certificate['issuedAt'] ?? ''),
            (string) ($certificate['issued_at'] ?? '')
        );
        $issuedDateLabel = self::escapeHtml(self::buildCaseDateLabel($issuedAt));

        return '
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="utf-8">
            <title>Certificado médico</title>
            <style>
                body { font-family: Helvetica, Arial, sans-serif; margin: 0; padding: 42px; color: #111827; }
                .header { border-bottom: 2px solid #248a65; padding-bottom: 16px; margin-bottom: 28px; }
                .header h1 { margin: 0 0 6px; font-size: 24px; }
                .header p { margin: 0; color: #475569; font-size: 13px; }
                .hero { margin-bottom: 22px; }
                .hero span { display: inline-block; padding: 6px 12px; border-radius: 999px; background: #ecfdf5; color: #166534; font-size: 12px; font-weight: bold; letter-spacing: 0.03em; text-transform: uppercase; }
                .patient-box, .detail-box { border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; margin-bottom: 18px; background: #f8fafc; }
                .patient-box strong, .detail-box strong { display: block; margin-bottom: 10px; font-size: 13px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; }
                .detail-box p { margin: 0 0 10px; line-height: 1.6; }
                .signature { margin-top: 40px; text-align: right; }
                .signature-line { border-top: 1px solid #0f172a; width: 220px; display: inline-block; margin-bottom: 8px; }
                .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>' . $clinicName . '</h1>
                <p>' . $clinicAddress . ($clinicPhone !== '' ? ' · ' . $clinicPhone : '') . '</p>
            </div>
            <div class="hero">
                <span>' . $typeLabel . '</span>
            </div>
            <div class="patient-box">
                <strong>Paciente</strong>
                <p><b>Nombre:</b> ' . $patientName . '</p>
                ' . ($patientId !== '' ? '<p><b>Identificación:</b> ' . $patientId . '</p>' : '') . '
                <p><b>Fecha de emisión:</b> ' . $issuedDateLabel . '</p>
            </div>
            <div class="detail-box">
                <strong>Detalle clínico</strong>
                <p><b>Diagnóstico:</b> ' . $diagnosis . '</p>
                ' . ($cie10 !== '' ? '<p><b>CIE-10:</b> ' . $cie10 . '</p>' : '') . '
                ' . ($restDays > 0 ? '<p><b>Días de reposo:</b> ' . self::escapeHtml((string) $restDays) . '</p>' : '') . '
                <p><b>Restricciones:</b> ' . $restrictions . '</p>
                ' . ($observations !== '' ? '<p><b>Observaciones:</b> ' . $observations . '</p>' : '') . '
            </div>
            <div class="signature">
                ' . $signatureHtml . '
                <div class="signature-line"></div>
                <div><strong>' . $doctorName . '</strong></div>
                ' . ($doctorSpecialty !== '' ? '<div>' . $doctorSpecialty . '</div>' : '') . '
                ' . ($doctorMsp !== '' ? '<div>Registro MSP: ' . $doctorMsp . '</div>' : '') . '
            </div>
            <div class="footer">Documento generado desde el portal del paciente Aurora Derm.</div>
        </body>
        </html>';
    }

    private static function buildFallbackPdf(string $html): string
    {
        $text = strip_tags(str_replace(['<br>', '</div>', '</p>', '</h1>', '</h2>', '</strong>'], "\n", $html));
        if (function_exists('mb_convert_encoding')) {
            $text = mb_convert_encoding(trim($text), 'ISO-8859-1', 'UTF-8');
        } else {
            $text = trim($text);
        }

        $lines = [];
        $lines[] = '%PDF-1.4';
        $lines[] = '1 0 obj<< /Type /Catalog /Pages 2 0 R >> endobj';
        $lines[] = '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >> endobj';
        $lines[] = '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj';

        $content = "BT\n/F1 12 Tf\n20 800 Td\n15 TL\n";
        foreach (explode("\n", $text) as $rawLine) {
            $line = trim($rawLine);
            if ($line === '') {
                $content .= "T*\n";
                continue;
            }

            $clean = strtr($line, ['\\' => '\\\\', '(' => '\\(', ')' => '\\)']);
            $content .= '(' . $clean . ") Tj T*\n";
        }
        $content .= "ET";

        $length = strlen($content);
        $lines[] = "4 0 obj<< /Length {$length} >>\nstream\n{$content}\nendstream\nendobj";
        $lines[] = '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj';

        $pdf = implode("\n", $lines);
        $pdf .= "\nxref\n0 6\n0000000000 65535 f \n";
        $pdf .= "trailer<</Size 6/Root 1 0 R>>\nstartxref\n9\n%%EOF";
        return $pdf;
    }

    private static function escapeHtml(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }

    private static function appointmentMatchesPatient(array $appointment, array $snapshot): bool
    {
        $patientId = trim((string) ($snapshot['patientId'] ?? ''));
        if ($patientId !== '' && $patientId === trim((string) ($appointment['patientId'] ?? ''))) {
            return true;
        }

        $patientCaseId = trim((string) ($snapshot['patientCaseId'] ?? ''));
        if ($patientCaseId !== '' && $patientCaseId === trim((string) ($appointment['patientCaseId'] ?? ''))) {
            return true;
        }

        $lastAppointmentId = (int) ($snapshot['lastAppointmentId'] ?? 0);
        if ($lastAppointmentId > 0 && $lastAppointmentId === (int) ($appointment['id'] ?? 0)) {
            return true;
        }

        $phone = trim((string) ($snapshot['phone'] ?? ''));
        if ($phone !== '' && PatientPortalAuth::matchesPatientPhone((string) ($appointment['phone'] ?? ''), $phone)) {
            return true;
        }

        return false;
    }

    private static function appointmentTimestamp(array $appointment): ?int
    {
        $date = trim((string) ($appointment['date'] ?? ''));
        $time = trim((string) ($appointment['time'] ?? ''));
        if ($date === '' || $time === '') {
            return null;
        }

        $timestamp = strtotime($date . ' ' . $time);
        return $timestamp === false ? null : $timestamp;
    }

    private static function buildAppointmentSummary(array $appointment, array $patient): array
    {
        $serviceId = trim((string) ($appointment['service'] ?? ''));
        $tenantId = trim((string) ($appointment['tenantId'] ?? ''));
        // Prefer explicit serviceName if already resolved (e.g. by normalize_appointment or fixture).
        $explicitServiceName = trim((string) ($appointment['serviceName'] ?? ''));
        if ($explicitServiceName !== '') {
            $serviceName = $explicitServiceName;
        } else {
            $serviceConfig = $serviceId !== '' ? get_service_config($serviceId, $tenantId !== '' ? $tenantId : null) : null;
            $serviceName = is_array($serviceConfig)
                ? trim((string) ($serviceConfig['name'] ?? ''))
                : self::humanizeValue($serviceId, 'Consulta Aurora Derm');
        }

        return [
            'id' => (int) ($appointment['id'] ?? 0),
            'status' => function_exists('map_appointment_status')
                ? map_appointment_status((string) ($appointment['status'] ?? 'confirmed'))
                : trim((string) ($appointment['status'] ?? 'confirmed')),
            'date' => trim((string) ($appointment['date'] ?? '')),
            'dateLabel' => self::buildDateLabel((string) ($appointment['date'] ?? '')),
            'time' => trim((string) ($appointment['time'] ?? '')),
            'timeLabel' => self::buildTimeLabel((string) ($appointment['time'] ?? '')),
            'doctorName' => self::formatDoctorName(
                (string) ($appointment['doctorAssigned'] ?? ''),
                (string) ($appointment['doctorRequested'] ?? ''),
                (string) ($appointment['doctor'] ?? '')
            ),
            'appointmentType' => self::resolveAppointmentTypeKey($appointment, $serviceConfig),
            'appointmentTypeLabel' => self::resolveAppointmentTypeLabel($appointment, $serviceConfig),
            'locationLabel' => self::resolveLocationLabel($appointment, $serviceConfig),
            'serviceId' => $serviceId,
            'serviceName' => $serviceName,
            'preparation' => self::resolvePreparationRequired($appointment, $serviceConfig),
            'rescheduleUrl' => self::buildRescheduleUrl((string) ($appointment['rescheduleToken'] ?? '')),
            'whatsappUrl' => self::buildSupportWhatsappUrl($patient, $appointment),
        ];
    }

    private static function buildRescheduleUrl(string $token): string
    {
        $token = trim($token);
        return $token !== '' ? '/?reschedule=' . rawurlencode($token) : '';
    }

    private static function buildSupportWhatsappUrl(array $patient, array $appointment): string
    {
        $digits = preg_replace('/\D+/', '', AppConfig::WHATSAPP_NUMBER);
        if (!is_string($digits) || $digits === '') {
            return '';
        }

        $patientName = trim((string) ($patient['name'] ?? 'Paciente'));
        $serviceName = self::humanizeValue((string) ($appointment['service'] ?? ''), 'mi cita');
        $date = trim((string) ($appointment['date'] ?? ''));
        $time = trim((string) ($appointment['time'] ?? ''));

        $parts = ['Hola, necesito ayuda con mi cita del portal Aurora Derm.'];
        if ($patientName !== '') {
            $parts[] = 'Paciente: ' . $patientName . '.';
        }
        if ($serviceName !== 'mi cita' || $date !== '' || $time !== '') {
            $parts[] = 'Referencia: ' . trim($serviceName . ' ' . $date . ' ' . $time) . '.';
        }

        return 'https://wa.me/' . $digits . '?text=' . rawurlencode(implode(' ', $parts));
    }

    private static function resolveAppointmentTypeKey(array $appointment, ?array $serviceConfig): string
    {
        $visitMode = strtolower(trim((string) ($appointment['visitMode'] ?? '')));
        $telemedicineChannel = strtolower(trim((string) ($appointment['telemedicineChannel'] ?? '')));
        $serviceCategory = strtolower(trim((string) ($serviceConfig['category'] ?? '')));
        $serviceId = strtolower(trim((string) ($appointment['service'] ?? '')));

        if (
            str_contains($visitMode, 'tele')
            || str_contains($visitMode, 'video')
            || str_contains($telemedicineChannel, 'video')
            || str_contains($telemedicineChannel, 'tele')
            || in_array($serviceCategory, ['telemedicina'], true)
            || in_array($serviceId, ['video', 'telefono'], true)
        ) {
            return 'telemedicine';
        }

        return 'in_person';
    }

    private static function resolveAppointmentTypeLabel(array $appointment, ?array $serviceConfig): string
    {
        if (self::resolveAppointmentTypeKey($appointment, $serviceConfig) === 'telemedicine') {
            return 'Teleconsulta';
        }

        $serviceCategory = strtolower(trim((string) ($serviceConfig['category'] ?? '')));
        if (in_array($serviceCategory, ['procedimiento', 'estetico'], true)) {
            return 'Procedimiento presencial';
        }

        return 'Consulta presencial';
    }

    private static function resolveLocationLabel(array $appointment, ?array $serviceConfig): string
    {
        if (self::resolveAppointmentTypeKey($appointment, $serviceConfig) === 'telemedicine') {
            return 'Atencion virtual por enlace seguro';
        }

        return 'Consultorio Aurora Derm';
    }

    private static function resolvePreparationRequired(array $appointment, ?array $serviceConfig): string
    {
        $serviceId = strtolower(trim((string) ($appointment['service'] ?? '')));
        $serviceName = strtolower(trim((string) ($serviceConfig['name'] ?? '')));
        $serviceCategory = strtolower(trim((string) ($serviceConfig['category'] ?? '')));
        $typeKey = self::resolveAppointmentTypeKey($appointment, $serviceConfig);
        $haystack = $serviceId . ' ' . $serviceName;

        if ($typeKey === 'telemedicine') {
            return 'Ten tu celular con buena conexion, fotos de apoyo y resultados recientes a la mano 10 minutos antes.';
        }

        if (str_contains($haystack, 'laser')) {
            return 'Llega con la piel limpia, evita bronceado reciente y no apliques cremas irritantes en la zona el mismo dia.';
        }

        if (
            str_contains($haystack, 'botox')
            || str_contains($haystack, 'peeling')
            || $serviceCategory === 'estetico'
            || $serviceCategory === 'procedimiento'
        ) {
            return 'Llega sin maquillaje en la zona a tratar y avisa si usaste retinoides, exfoliantes o recibiste otro procedimiento reciente.';
        }

        return 'Llega 10 minutos antes y trae tus medicamentos, examenes o fotos previas si ayudan a explicar la evolucion.';
    }

    private static function formatDoctorName(string ...$candidates): string
    {
        foreach ($candidates as $candidate) {
            $candidate = trim($candidate);
            if ($candidate === '') {
                continue;
            }

            $candidate = str_replace(['_', '-'], ' ', $candidate);
            if (function_exists('mb_convert_case')) {
                return mb_convert_case($candidate, MB_CASE_TITLE, 'UTF-8');
            }

            return ucwords(strtolower($candidate));
        }

        return 'Especialista Aurora Derm';
    }

    private static function buildDateLabel(string $date): string
    {
        $timestamp = strtotime(trim($date) . ' 00:00:00');
        if ($timestamp === false) {
            return trim($date);
        }

        $days = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
        $months = [
            1 => 'ene',
            2 => 'feb',
            3 => 'mar',
            4 => 'abr',
            5 => 'may',
            6 => 'jun',
            7 => 'jul',
            8 => 'ago',
            9 => 'sep',
            10 => 'oct',
            11 => 'nov',
            12 => 'dic',
        ];

        $dayLabel = $days[(int) date('w', $timestamp)] ?? '';
        $monthLabel = $months[(int) date('n', $timestamp)] ?? trim((string) date('m', $timestamp));

        return trim(sprintf(
            '%s %s %s %s',
            $dayLabel,
            date('j', $timestamp),
            $monthLabel,
            date('Y', $timestamp)
        ));
    }

    private static function buildTimeLabel(string $time): string
    {
        $time = trim($time);
        if ($time === '') {
            return 'Por confirmar';
        }

        if (preg_match('/^\d{2}:\d{2}/', $time) === 1) {
            return substr($time, 0, 5);
        }

        return $time;
    }

    private static function humanizeValue(string $value, string $fallback): string
    {
        $value = trim($value);
        if ($value === '') {
            return $fallback;
        }

        $value = str_replace(['_', '-'], ' ', $value);
        if (function_exists('mb_convert_case')) {
            return mb_convert_case($value, MB_CASE_TITLE, 'UTF-8');
        }

        return ucwords(strtolower($value));
    }

    private static function portalPhotoBelongsToCaseMap(array $upload, array $caseMap): bool
    {
        $caseId = self::firstNonEmptyString(
            (string) ($upload['patientCaseId'] ?? ''),
            (string) ($upload['clinicalHistoryCaseId'] ?? ''),
            (string) ($upload['caseId'] ?? '')
        );

        if ($caseId === '' || !isset($caseMap[$caseId])) {
            return false;
        }

        return strtolower(trim((string) ($upload['kind'] ?? ''))) === 'case_photo';
    }

    private static function isPortalVisiblePhoto(array $upload): bool
    {
        $directFlags = [
            $upload['visibleToPatient'] ?? null,
            $upload['visible_to_patient'] ?? null,
            $upload['patientVisible'] ?? null,
            $upload['portalVisible'] ?? null,
            $upload['portal_visible'] ?? null,
            $upload['sharedWithPatient'] ?? null,
            $upload['showInPortal'] ?? null,
            $upload['patientPortalVisible'] ?? null,
        ];

        foreach ($directFlags as $flag) {
            $normalized = self::normalizePortalVisibilityFlag($flag);
            if ($normalized !== null) {
                return $normalized;
            }
        }

        foreach (['visibility', 'sharing', 'portal', 'patientPortal'] as $containerKey) {
            $container = is_array($upload[$containerKey] ?? null) ? $upload[$containerKey] : [];
            foreach (['patient', 'portal', 'visible', 'patientVisible', 'visibleToPatient'] as $nestedKey) {
                $normalized = self::normalizePortalVisibilityFlag($container[$nestedKey] ?? null);
                if ($normalized !== null) {
                    return $normalized;
                }
            }
        }

        return false;
    }

    private static function normalizePortalVisibilityFlag($value): ?bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_int($value) || is_float($value)) {
            return ((int) $value) === 1;
        }

        if (!is_string($value)) {
            return null;
        }

        $normalized = strtolower(trim($value));
        if ($normalized === '') {
            return null;
        }

        if (in_array($normalized, ['1', 'true', 'yes', 'si', 'visible', 'shared', 'show'], true)) {
            return true;
        }

        if (in_array($normalized, ['0', 'false', 'no', 'hidden', 'private', 'internal'], true)) {
            return false;
        }

        return null;
    }

    private static function normalizePortalPhotoItem(array $upload): ?array
    {
        $id = trim((string) ($upload['id'] ?? ''));
        if ($id === '') {
            return null;
        }

        $createdAt = trim((string) ($upload['createdAt'] ?? $upload['updatedAt'] ?? ''));
        $timestamp = self::recordTimestamp([
            'createdAt' => $createdAt,
            'updatedAt' => (string) ($upload['updatedAt'] ?? ''),
        ]);
        $bodyZone = trim((string) ($upload['bodyZone'] ?? $upload['body_zone'] ?? ''));
        $bodyZoneLabel = self::humanizeValue($bodyZone, 'Seguimiento general');
        $photoRole = trim((string) ($upload['photoRole'] ?? ''));
        $photoRoleLabel = trim((string) ($upload['photoRoleLabel'] ?? self::humanizeValue($photoRole, '')));
        $createdAtLabel = self::buildPortalDateTimeLabel(
            $createdAt,
            $timestamp > 0 ? self::buildDateLabel(date('Y-m-d', $timestamp)) : 'Sin fecha'
        );

        return [
            'id' => $id,
            'bodyZone' => $bodyZone !== '' ? $bodyZone : 'general',
            'bodyZoneLabel' => $bodyZoneLabel,
            'createdAt' => $createdAt,
            'createdAtLabel' => $createdAtLabel,
            'dateLabel' => $timestamp > 0 ? self::buildDateLabel(date('Y-m-d', $timestamp)) : '',
            'timeLabel' => $timestamp > 0 ? self::buildTimeLabel(date('H:i', $timestamp)) : '',
            'photoRole' => $photoRole,
            'photoRoleLabel' => $photoRoleLabel,
            'fileName' => trim((string) ($upload['originalName'] ?? ('foto-' . $id . '.jpg'))),
            'imageUrl' => '/api.php?resource=patient-portal-photo-file&id=' . rawurlencode($id),
            'alt' => trim($bodyZoneLabel . ($createdAtLabel !== '' ? ' · ' . $createdAtLabel : '')),
            'sortTimestamp' => $timestamp,
        ];
    }

    private static function findPortalVisiblePhotoUpload(array $store, array $caseIds, string $photoId): ?array
    {
        $caseMap = [];
        foreach ($caseIds as $caseId) {
            $caseId = trim((string) $caseId);
            if ($caseId !== '') {
                $caseMap[$caseId] = true;
            }
        }

        foreach (($store['clinical_uploads'] ?? []) as $upload) {
            if (!is_array($upload)) {
                continue;
            }

            if (trim((string) ($upload['id'] ?? '')) !== $photoId) {
                continue;
            }

            if (!self::portalPhotoBelongsToCaseMap($upload, $caseMap)) {
                return null;
            }

            if (!self::isPortalVisiblePhoto($upload)) {
                return null;
            }

            return $upload;
        }

        return null;
    }

    private static function resolvePortalPhotoAsset(array $upload): array
    {
        $path = self::resolvePortalPhotoDiskPath($upload);
        if ($path === '' || !is_file($path)) {
            return [];
        }

        $mime = self::safePortalMime((string) ($upload['mime'] ?? ''), $path);
        $extension = pathinfo($path, PATHINFO_EXTENSION);
        $fileName = trim((string) ($upload['originalName'] ?? ''));
        if ($fileName === '') {
            $fileName = 'foto-clinica' . ($extension !== '' ? '.' . strtolower($extension) : '.jpg');
        }

        return [
            'path' => $path,
            'contentType' => $mime,
            'fileName' => $fileName,
        ];
    }

    private static function resolvePortalPhotoDiskPath(array $upload): string
    {
        $privatePath = ltrim(str_replace(['\\', '//'], '/', trim((string) ($upload['privatePath'] ?? ''))), '/');
        if ($privatePath !== '') {
            if (str_starts_with($privatePath, 'clinical-media/')) {
                return data_dir_path() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $privatePath);
            }

            return clinical_media_dir_path() . DIRECTORY_SEPARATOR . basename($privatePath);
        }

        $diskPath = trim((string) ($upload['diskPath'] ?? ''));
        if ($diskPath !== '' && is_file($diskPath)) {
            return $diskPath;
        }

        $legacyPublicPath = trim((string) ($upload['legacyPublicPath'] ?? ''));
        if ($legacyPublicPath !== '' && function_exists('transfer_proof_upload_dir')) {
            return rtrim(transfer_proof_upload_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . basename($legacyPublicPath);
        }

        return '';
    }

    private static function safePortalMime(string $mime, string $path): string
    {
        $mime = trim($mime);
        if ($mime !== '') {
            return $mime;
        }

        if (function_exists('mime_content_type')) {
            $detected = @mime_content_type($path);
            if (is_string($detected) && trim($detected) !== '') {
                return trim($detected);
            }
        }

        return 'application/octet-stream';
    }

    private static function emitBinaryResponse(
        string $bytes,
        string $contentType,
        string $fileName,
        string $disposition = 'inline'
    ): void {
        if (defined('TESTING_ENV')) {
            $payload = [
                'ok' => true,
                'format' => 'binary',
                'filename' => $fileName,
                'contentType' => $contentType,
                'contentLength' => strlen($bytes),
                'binary' => $bytes,
            ];
            $GLOBALS['__TEST_RESPONSE'] = ['payload' => $payload, 'status' => 200];
            if (!defined('TESTING_FORCE_EXIT')) {
                throw new TestingExitException($payload, 200);
            }
        }

        header('Content-Type: ' . $contentType);
        header('Content-Disposition: ' . $disposition . '; filename="' . $fileName . '"');
        header('Content-Length: ' . strlen($bytes));
        header('Cache-Control: private, max-age=3600');
        echo $bytes;
        exit;
    }

    private static function emit(array $result): void
    {
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo completar la autenticacion del portal'),
                'code' => (string) ($result['code'] ?? 'patient_portal_error'),
            ], (int) ($result['status'] ?? 500));
        }

        json_response([
            'ok' => true,
            'data' => is_array($result['data'] ?? null) ? $result['data'] : [],
        ]);
    }
}
