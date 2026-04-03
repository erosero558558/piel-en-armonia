<?php

require_once __DIR__ . '/portal/PortalViewBuilderService.php';

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

final class PortalHistoryService
{
    public static function buildPortalHistory(...$args)
    {
        return PortalViewBuilderService::buildPortalHistory(...$args);
    }

    public static
    function findNextAppointment(array $store, array $snapshot, ?string $tenantId = null): array
    {
        $matches = [];
        $now = time();

        foreach (($store['appointments'] ?? []) as $appointment) {
            $itemTenant = trim((string) ($appointment['tenantId'] ?? ''));
            if ($tenantId !== null && $tenantId !== '' && $itemTenant !== '' && $itemTenant !== $tenantId) continue;
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


    public static

    public static
    function findPendingSurvey(array $store, array $snapshot, array $patient, ?string $tenantId = null): ?array
    {
        $patientId = trim((string) ($patient['documentNumber'] ?? ''));
        if ($patientId === '') {
            return null;
        }

        $surveys = is_array($store['nps_surveys'] ?? null) ? $store['nps_surveys'] : [];
        $surveyedAppointments = [];
        foreach ($surveys as $survey) {
            $appointmentId = (int) ($survey['appointmentId'] ?? 0);
            if ($appointmentId > 0) {
                $surveyedAppointments[$appointmentId] = true;
            }
        }

        $appointments = is_array($snapshot['appointments'] ?? null) ? $snapshot['appointments'] : [];
        $now = time();
        $targetDelay = 72 * 3600;

        foreach ($appointments as $apt) {
            if (!is_array($apt) || trim((string) ($apt['patientId'] ?? '')) !== $patientId || trim((string) ($apt['status'] ?? '')) !== 'completed') {
                continue;
            }

            $aptId = (int) ($apt['id'] ?? 0);
            if ($aptId <= 0 || isset($surveyedAppointments[$aptId])) {
                continue;
            }

            // Using date and time to find if 72 hours have passed
            $date = trim((string) ($apt['date'] ?? ''));
            $time = trim((string) ($apt['time'] ?? '00:00:00'));
            if ($date === '') {
                continue;
            }

            $aptTime = strtotime("$date $time");
            if ($aptTime > 0 && ($now - $aptTime) >= $targetDelay) {
                return [
                    'appointmentId' => $aptId,
                    'doctor' => get_doctor_label(trim((string) ($apt['doctor'] ?? ''))),
                    'dateLabel' => format_date_label($date),
                ];
            }
        }

        return null;
    }


    public static

    public static function buildEvolutionSummary(...$args)
    {
        return PortalViewBuilderService::buildEvolutionSummary(...$args);
    }

    public static function buildPatientRedFlags(...$args)
    {
        return PortalViewBuilderService::buildPatientRedFlags(...$args);
    }

    public static function buildPortalPhotoGallery(...$args)
    {
        return PortalViewBuilderService::buildPortalPhotoGallery(...$args);
    }

    public static
    function collectPatientCaseIds(array $store, array $snapshot, ?string $tenantId = null): array
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
            $itemTenant = trim((string) ($appointment['tenantId'] ?? ''));
            if ($tenantId !== null && $tenantId !== '' && $itemTenant !== '' && $itemTenant !== $tenantId) continue;
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


    public static

    public static
    function patientCaseMatchesSnapshot(array $caseRecord, array $snapshot): bool
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


    public static

    public static
    function resolveAppointmentCaseId(array $appointment, array $snapshot, ?string $tenantId = null): string
    {
        $caseId = trim((string) ($appointment['patientCaseId'] ?? ''));
        if ($caseId !== '') {
            return $caseId;
        }

        return trim((string) ($snapshot['patientCaseId'] ?? ''));
    }


    public static

    public static
    function shouldIncludeConsultationInHistory(string $status, ?int $timestamp, array $documents): bool
    {
        if ($status === 'completed') {
            return true;
        }

        if ($timestamp !== null && $timestamp <= time()) {
            return true;
        }

        return self::documentsHavePortalSignal($documents);
    }


    public static

    public static
    function documentsHavePortalSignal(array $documents): bool
    {
        foreach (['prescription', 'certificate'] as $type) {
            $status = (string) ($documents[$type]['status'] ?? '');
            if ($status !== '' && $status !== 'not_issued') {
                return true;
            }
        }

        return false;
    }


    public static

    public static function buildDocumentsByCaseId(...$args)
    {
        return PortalViewBuilderService::buildDocumentsByCaseId(...$args);
    }

    public static function buildCasePhotoSummaryByCaseId(...$args)
    {
        return PortalViewBuilderService::buildCasePhotoSummaryByCaseId(...$args);
    }

    public static
    function findPatientCaseRecord(array $store, string $caseId, ?string $tenantId = null): array
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


    public static

    public static
    function resolveCasePatient(array $store, string $caseId): array
    {
        if (
            $caseId !== ''
            && isset($store['patients'][$caseId])
            && is_array($store['patients'][$caseId])
        ) {
            return $store['patients'][$caseId];
        }

        $caseRecord = self::findPatientCaseRecord($store, $caseId, $tenantId);
        $summary = is_array($caseRecord['summary'] ?? null) ? $caseRecord['summary'] : [];

        return [
            'firstName' => trim((string) ($summary['patientLabel'] ?? 'Paciente')),
            'lastName' => '',
            'phone' => trim((string) ($summary['contactPhone'] ?? '')),
            'email' => trim((string) ($summary['contactEmail'] ?? '')),
        ];
    }


    public static

    public static function buildCaseDateLabel(...$args)
    {
        return PortalViewBuilderService::buildCaseDateLabel(...$args);
    }

    public static function buildPatientDisplayName(...$args)
    {
        return PortalViewBuilderService::buildPatientDisplayName(...$args);
    }

    public static function recordTimestamp(...$args)
    {
        return PortalViewBuilderService::recordTimestamp(...$args);
    }

    public static function appointmentTimestamp(...$args)
    {
        return PortalViewBuilderService::appointmentTimestamp(...$args);
    }

    public static function documentTimestamp(...$args)
    {
        return PortalViewBuilderService::documentTimestamp(...$args);
    }

    public static function buildAppointmentSummary(...$args)
    {
        return PortalViewBuilderService::buildAppointmentSummary(...$args);
    }

    public static function buildPortalNextControlEvent(...$args)
    {
        return PortalViewBuilderService::buildPortalNextControlEvent(...$args);
    }

    public static function firstNonEmptyString(...$args)
    {
        return PortalViewBuilderService::firstNonEmptyString(...$args);
    }

    public static function buildHistoryConsultationFromAppointment(...$args)
    {
        return PortalViewBuilderService::buildHistoryConsultationFromAppointment(...$args);
    }

    public static function buildHistoryConsultationFromCase(...$args)
    {
        return PortalViewBuilderService::buildHistoryConsultationFromCase(...$args);
    }

    public static function buildDocumentIssuedLabel(...$args)
    {
        return PortalViewBuilderService::buildDocumentIssuedLabel(...$args);
    }

    public static
    function appointmentMatchesPatient(array $appointment, array $snapshot, ?string $tenantId = null): bool
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


    public static

    public static
    function hasPendingPrescriptionDraft(array $drafts): bool
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
}
