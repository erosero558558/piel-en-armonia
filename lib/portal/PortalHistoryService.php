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

final class PortalHistoryService
{

    public static function buildPortalHistory(array $store, array $snapshot, array $patient, ?string $tenantId = null): array
    {
        $caseIds = self::collectPatientCaseIds($store, $snapshot, $tenantId);
        $documentsByCase = self::buildDocumentsByCaseId($store, $caseIds, $tenantId);
        $photoSummaryByCase = self::buildCasePhotoSummaryByCaseId($store, $caseIds, $tenantId);
        $consultations = [];
        $representedCaseIds = [];

        foreach (($store['appointments'] ?? []) as $appointment) {
            $itemTenant = trim((string) ($appointment['tenantId'] ?? ''));
            if ($tenantId !== null && $tenantId !== '' && $itemTenant !== '' && $itemTenant !== $tenantId) continue;
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
            $documents = $documentsByCase[$caseId] ?? PatientPortalDocumentController::defaultDocumentState($caseId);
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

            $documents = $documentsByCase[$caseId] ?? PatientPortalDocumentController::defaultDocumentState($caseId);
            if (!self::documentsHavePortalSignal($documents)) {
                continue;
            }

            $caseRecord = self::findPatientCaseRecord($store, $caseId, $tenantId);
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

        $upcomingAppointment = self::findNextAppointment($store, $snapshot, $tenantId);
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


    public static function findNextAppointment(array $store, array $snapshot, ?string $tenantId = null): array
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


    public static function findPendingSurvey(array $store, array $snapshot, array $patient, ?string $tenantId = null): ?array
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


    public static function buildEvolutionSummary(array $store, array $snapshot, ?string $tenantId = null): ?array
    {
        $caseIds = self::collectPatientCaseIds($store, $snapshot, $tenantId);
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


    public static function buildPatientRedFlags(array $store, array $snapshot, ?string $tenantId = null): array
    {
        $caseIds = self::collectPatientCaseIds($store, $snapshot, $tenantId);
        $caseMap = [];
        foreach ($caseIds as $caseId) {
            $caseId = trim((string) $caseId);
            if ($caseId !== '') {
                $caseMap[$caseId] = true;
            }
        }

        $flags = [];
        $cutoff = time() - (30 * 86400); // 30 days

        foreach (($store['clinical_history_drafts'] ?? []) as $draft) {
            $itemTenant = trim((string) ($draft['tenantId'] ?? ''));
            if ($tenantId !== null && $tenantId !== '' && $itemTenant !== '' && $itemTenant !== $tenantId) continue;
            if (!is_array($draft)) {
                continue;
            }

            $caseId = trim((string) ($draft['caseId'] ?? ''));
            if ($caseId === '' || !isset($caseMap[$caseId])) {
                continue;
            }

            // Check if draft is within the last 30 days
            $candidateDate = self::firstNonEmptyString(
                (string) ($draft['updatedAt'] ?? ''),
                (string) ($draft['createdAt'] ?? '')
            );
            $ts = strtotime($candidateDate);
            if ($ts === false || $ts < $cutoff) {
                continue;
            }

            // Extract note texts
            $documents = is_array($draft['documents'] ?? null) ? $draft['documents'] : [];
            $finalNote = is_array($documents['finalNote'] ?? null) ? $documents['finalNote'] : [];
            $sections = is_array($finalNote['sections'] ?? null) ? $finalNote['sections'] : [];
            $hcu005 = is_array($sections['hcu005'] ?? null) ? $sections['hcu005'] : [];

            $summary = trim((string) ($finalNote['summary'] ?? ''));
            $evo = trim((string) ($hcu005['evolutionNote'] ?? ''));
            $diag = trim((string) ($hcu005['diagnosticImpression'] ?? ''));

            $fullText = mb_strtolower($summary . ' ' . $evo . ' ' . $diag, 'UTF-8');
            
            // Checking exact 'cambio sospechoso' flag
            if (mb_strpos($fullText, 'cambio sospechoso', 0, 'UTF-8') !== false) {
                $flags[] = [
                    'id' => 'redflag_suspicious_change',
                    'rule' => 'cambio_sospechoso_30d',
                    'message' => 'Su seguimiento recomienda una consulta pronto.',
                ];
                break; // One flag of this type is enough per patient
            }
        }

        return $flags;
    }


    public static function buildPortalPhotoGallery(array $store, array $snapshot, ?string $tenantId = null): array
    {
        $caseIds = self::collectPatientCaseIds($store, $snapshot, $tenantId);
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


    public static function collectPatientCaseIds(array $store, array $snapshot, ?string $tenantId = null): array
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


    public static function patientCaseMatchesSnapshot(array $caseRecord, array $snapshot): bool
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


    public static function resolveAppointmentCaseId(array $appointment, array $snapshot, ?string $tenantId = null): string
    {
        $caseId = trim((string) ($appointment['patientCaseId'] ?? ''));
        if ($caseId !== '') {
            return $caseId;
        }

        return trim((string) ($snapshot['patientCaseId'] ?? ''));
    }


    public static function shouldIncludeConsultationInHistory(string $status, ?int $timestamp, array $documents): bool
    {
        if ($status === 'completed') {
            return true;
        }

        if ($timestamp !== null && $timestamp <= time()) {
            return true;
        }

        return self::documentsHavePortalSignal($documents);
    }


    public static function documentsHavePortalSignal(array $documents): bool
    {
        foreach (['prescription', 'certificate'] as $type) {
            $status = (string) ($documents[$type]['status'] ?? '');
            if ($status !== '' && $status !== 'not_issued') {
                return true;
            }
        }

        return false;
    }


    public static function buildDocumentsByCaseId(array $store, array $caseIds, ?string $tenantId = null): array
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
                'prescription' => PatientPortalDocumentController::buildPortalDocumentPayload(
                    'prescription',
                    $latestPrescriptions[$caseId] ?? null,
                    self::hasPendingPrescriptionDraft($drafts)
                ),
                'certificate' => PatientPortalDocumentController::buildPortalDocumentPayload(
                    'certificate',
                    $latestCertificates[$caseId] ?? null,
                    self::hasPendingCertificateDraft($drafts)
                ),
            ];
        }

        return $documentsByCase;
    }


    public static function buildCasePhotoSummaryByCaseId(array $store, array $caseIds, ?string $tenantId = null): array
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


    public static function findPatientCaseRecord(array $store, string $caseId, ?string $tenantId = null): array
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


    public static function resolveCasePatient(array $store, string $caseId): array
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


    public static function buildCaseDateLabel(string $value): string
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


    public static function buildPatientDisplayName(array $patient): string
    {
        return self::firstNonEmptyString(
            trim((string) (($patient['firstName'] ?? '') . ' ' . ($patient['lastName'] ?? ''))),
            trim((string) ($patient['name'] ?? '')),
            'Paciente Aurora Derm'
        );
    }


    public static function recordTimestamp(array $record): int
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


    public static function appointmentTimestamp(array $appointment): ?int
    {
        $date = trim((string) ($appointment['date'] ?? ''));
        $time = trim((string) ($appointment['time'] ?? ''));
        if ($date === '' || $time === '') {
            return null;
        }

        $timestamp = strtotime($date . ' ' . $time);
        return $timestamp === false ? null : $timestamp;
    }


    public static function documentTimestamp(array $document, array $keys): int
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


    public static function buildAppointmentSummary(array $appointment, array $patient, ?string $tenantId = null): array
    {
        $serviceId = trim((string) ($appointment['service'] ?? ''));
        $tenantId = trim((string) ($appointment['tenantId'] ?? ''));
        $serviceConfig = $serviceId !== '' ? get_service_config($serviceId, $tenantId !== '' ? $tenantId : null) : null;
        $typeKey = self::resolveAppointmentTypeKey($appointment, $serviceConfig);
        $rescheduleToken = trim((string) ($appointment['rescheduleToken'] ?? ''));
        // Prefer explicit serviceName if already resolved (e.g. by normalize_appointment or fixture).
        $explicitServiceName = trim((string) ($appointment['serviceName'] ?? ''));
        if ($explicitServiceName !== '') {
            $serviceName = $explicitServiceName;
        } else {
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
            'appointmentType' => $typeKey,
            'appointmentTypeLabel' => self::resolveAppointmentTypeLabel($appointment, $serviceConfig),
            'locationLabel' => self::resolveLocationLabel($appointment, $serviceConfig),
            'serviceId' => $serviceId,
            'serviceName' => $serviceName,
            'preparation' => self::resolvePreparationRequired($appointment, $serviceConfig),
            'rescheduleUrl' => self::buildRescheduleUrl($rescheduleToken),
            'roomUrl' => $typeKey === 'telemedicine'
                ? self::buildTelemedicineRoomUrl((int) ($appointment['id'] ?? 0), $rescheduleToken)
                : '',
            'preConsultationUrl' => $typeKey === 'telemedicine'
                ? self::buildTelemedicinePreConsultationUrl((int) ($appointment['id'] ?? 0), $rescheduleToken)
                : '',
            'telemedicinePreConsultation' => isset($appointment['telemedicinePreConsultation']) && is_array($appointment['telemedicinePreConsultation'])
                ? $appointment['telemedicinePreConsultation']
                : [],
            'queue_position' => isset($appointment['queue_position']) ? (int) $appointment['queue_position'] : null,
            'whatsappUrl' => self::buildSupportWhatsappUrl($patient, $appointment),
        ];
    }


    public static function buildPortalNextControlEvent(array $appointmentSummary): array
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


    public static function firstNonEmptyString(string ...$values): string
    {
        foreach ($values as $value) {
            $value = trim($value);
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }


    public static function buildHistoryConsultationFromAppointment(
        array $store,
        array $appointment,
        array $patient,
        string $caseId,
        array $documents,
        ?int $timestamp,
        array $photoSummary
    , ?string $tenantId = null): array {
        $summary = self::buildAppointmentSummary($appointment, $patient);
        $status = (string) ($summary['status'] ?? 'confirmed');
        $caseRecord = self::findPatientCaseRecord($store, $caseId, $tenantId);
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


    public static function buildHistoryConsultationFromCase(
        array $caseRecord,
        array $patient,
        string $caseId,
        array $documents,
        array $photoSummary
    , ?string $tenantId = null): array {
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


    public static function buildDocumentIssuedLabel(string $issuedAt): string
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


    public static function appointmentMatchesPatient(array $appointment, array $snapshot, ?string $tenantId = null): bool
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


    public static function hasPendingPrescriptionDraft(array $drafts): bool
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
