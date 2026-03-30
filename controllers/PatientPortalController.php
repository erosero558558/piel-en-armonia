<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/PatientPortalAuth.php';
require_once __DIR__ . '/../lib/business.php';
require_once __DIR__ . '/../lib/ClinicProfileStore.php';
require_once __DIR__ . '/../lib/api_helpers.php';
require_once __DIR__ . '/../lib/openclaw/PrescriptionPdfRenderer.php';
require_once __DIR__ . '/../lib/clinical_history/ClinicalHistorySessionRepository.php';

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
                'support' => [
                    'bookingUrl' => '/#citas',
                    'historyUrl' => '/es/portal/historial/',
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
                $appointment,
                $patient,
                $caseId,
                $documents,
                $timestamp
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
                $documents
            );
        }

        usort($consultations, static function (array $left, array $right): int {
            return ((int) ($right['sortTimestamp'] ?? 0)) <=> ((int) ($left['sortTimestamp'] ?? 0));
        });

        return array_values(array_map(static function (array $consultation): array {
            unset($consultation['sortTimestamp']);
            return $consultation;
        }, $consultations));
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
        array $appointment,
        array $patient,
        string $caseId,
        array $documents,
        ?int $timestamp
    ): array {
        $summary = self::buildAppointmentSummary($appointment, $patient);
        $status = (string) ($summary['status'] ?? 'confirmed');

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
            'serviceName' => (string) ($summary['serviceName'] ?? 'Consulta Aurora Derm'),
            'appointmentTypeLabel' => (string) ($summary['appointmentTypeLabel'] ?? ''),
            'locationLabel' => (string) ($summary['locationLabel'] ?? ''),
            'documents' => $documents,
            'sortTimestamp' => $timestamp ?? 0,
        ];
    }

    private static function buildHistoryConsultationFromCase(
        array $caseRecord,
        array $patient,
        string $caseId,
        array $documents
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
            'documents' => $documents,
            'sortTimestamp' => $timestamp,
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
        $serviceConfig = $serviceId !== '' ? get_service_config($serviceId, $tenantId !== '' ? $tenantId : null) : null;
        $serviceName = is_array($serviceConfig)
            ? trim((string) ($serviceConfig['name'] ?? ''))
            : self::humanizeValue($serviceId, 'Consulta Aurora Derm');

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
