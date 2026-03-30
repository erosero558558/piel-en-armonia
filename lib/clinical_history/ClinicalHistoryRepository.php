<?php

declare(strict_types=1);

require_once __DIR__ . '/../common.php';
require_once __DIR__ . '/ClinicalHistorySessionRepository.php';
require_once __DIR__ . '/ClinicalHistoryEvolutionRepository.php';
require_once __DIR__ . '/ClinicalHistoryPrescriptionRepository.php';
require_once __DIR__ . '/ClinicalHistoryDiagnosisRepository.php';

final class ClinicalHistoryRepository
{

    public static function normalizeHcu005Draft(array $draft): array
    {
        return ClinicalHistoryEvolutionRepository::normalizeHcu005Draft($draft);
    }

    public static function normalizeHcu005Section(array $section, array $fallback = []): array
    {
        return ClinicalHistoryEvolutionRepository::normalizeHcu005Section($section, $fallback);
    }

    public static function evaluateHcu005(array $hcu005): array
    {
        return ClinicalHistoryEvolutionRepository::evaluateHcu005($hcu005);
    }

    public static function renderHcu005Summary(array $section): string
    {
        return ClinicalHistoryEvolutionRepository::renderHcu005Summary($section);
    }

    public static function renderHcu005Content(array $section): string
    {
        return ClinicalHistoryEvolutionRepository::renderHcu005Content($section);
    }

    public static function normalizePrescriptionItems($items): array
    {
        return ClinicalHistoryPrescriptionRepository::normalizePrescriptionItems($items);
    }

    public static function normalizePrescriptionItem(array $item): array
    {
        return ClinicalHistoryPrescriptionRepository::normalizePrescriptionItem($item);
    }

    public static function prescriptionItemIsStarted(array $item): bool
    {
        return ClinicalHistoryPrescriptionRepository::prescriptionItemIsStarted($item);
    }

    public static function prescriptionItemIsComplete(array $item): bool
    {
        return ClinicalHistoryPrescriptionRepository::prescriptionItemIsComplete($item);
    }

    public static function renderPrescriptionMedicationMirror(array $items): string
    {
        return ClinicalHistoryPrescriptionRepository::renderPrescriptionMedicationMirror($items);
    }

    public static function renderPrescriptionDirectionsMirror(array $items): string
    {
        return ClinicalHistoryPrescriptionRepository::renderPrescriptionDirectionsMirror($items);
    }

    public static function normalizeInterconsultationDiagnoses($items): array
    {
        return ClinicalHistoryDiagnosisRepository::normalizeInterconsultationDiagnoses($items);
    }

    public static function normalizeInterconsultationDiagnosis(array $diagnosis): array
    {
        return ClinicalHistoryDiagnosisRepository::normalizeInterconsultationDiagnosis($diagnosis);
    }

    public static function nextId(array $records): int
    {
        return ClinicalHistorySessionRepository::nextId($records);
    }

    public static function newOpaqueId(string $prefix = 'chs'): string
    {
        return ClinicalHistorySessionRepository::newOpaqueId($prefix);
    }

    public static function defaultSession(array $seed = []): array
    {
        return ClinicalHistorySessionRepository::defaultSession($seed);
    }

    public static function defaultDraft(array $session, array $seed = []): array
    {
        return ClinicalHistorySessionRepository::defaultDraft($session, $seed);
    }

    public static function defaultEvent(array $seed = []): array
    {
        return ClinicalHistorySessionRepository::defaultEvent($seed);
    }

    public static function findSessionBySessionId(array $store, string $sessionId): ?array
    {
        return ClinicalHistorySessionRepository::findSessionBySessionId($store, $sessionId);
    }

    public static function findSessionByCaseId(array $store, string $caseId): ?array
    {
        return ClinicalHistorySessionRepository::findSessionByCaseId($store, $caseId);
    }

    public static function findDraftBySessionId(array $store, string $sessionId): ?array
    {
        return ClinicalHistorySessionRepository::findDraftBySessionId($store, $sessionId);
    }

    public static function findAllDraftsByCaseId(array $store, string $caseId): array
    {
        return ClinicalHistorySessionRepository::findAllDraftsByCaseId($store, $caseId);
    }

    public static function findEventsBySessionId(array $store, string $sessionId): array
    {
        return ClinicalHistorySessionRepository::findEventsBySessionId($store, $sessionId);
    }

    public static function upsertSession(array $store, array $session): array
    {
        return ClinicalHistorySessionRepository::upsertSession($store, $session);
    }

    public static function upsertDraft(array $store, array $draft): array
    {
        return ClinicalHistorySessionRepository::upsertDraft($store, $draft);
    }

    public static function upsertEvent(array $store, array $event): array
    {
        return ClinicalHistorySessionRepository::upsertEvent($store, $event);
    }

    public static function findClinicalUploadById(array $store, int $uploadId): ?array
    {
        return ClinicalHistorySessionRepository::findClinicalUploadById($store, $uploadId);
    }

    public static function upsertClinicalUpload(array $store, array $upload): array
    {
        return ClinicalHistorySessionRepository::upsertClinicalUpload($store, $upload);
    }

    public static function appendTranscriptMessage(array $session, array $message): array
    {
        return ClinicalHistorySessionRepository::appendTranscriptMessage($session, $message);
    }

    public static function patientSafeSession(array $session): array
    {
        return ClinicalHistorySessionRepository::patientSafeSession($session);
    }

    public static function adminSession(array $session): array
    {
        return ClinicalHistorySessionRepository::adminSession($session);
    }

    public static function patientSafeDraft(array $draft): array
    {
        return ClinicalHistorySessionRepository::patientSafeDraft($draft);
    }

    public static function adminDraft(array $draft): array
    {
        return ClinicalHistorySessionRepository::adminDraft($draft);
    }

    public static function normalizeRecordMeta(array $meta, array $session = [], array $draft = []): array
    {
        return ClinicalHistorySessionRepository::normalizeRecordMeta($meta, $session, $draft);
    }

    public static function normalizeClinicalDocuments(array $documents): array
    {
        return ClinicalHistorySessionRepository::normalizeClinicalDocuments($documents);
    }

    public static function normalizeLabOrderStudySelections($items): array
    {
        return ClinicalHistorySessionRepository::normalizeLabOrderStudySelections($items);
    }

    /**
         * @return array<int,string>
         */
    public static function flattenLabOrderStudySelections(array $studySelections): array
    {
        return ClinicalHistorySessionRepository::flattenLabOrderStudySelections($studySelections);
    }

    public static function normalizeImagingStudySelections($items): array
    {
        return ClinicalHistorySessionRepository::normalizeImagingStudySelections($items);
    }

    /**
         * @return array<int,string>
         */
    public static function flattenImagingStudySelections(array $studySelections): array
    {
        return ClinicalHistorySessionRepository::flattenImagingStudySelections($studySelections);
    }

    public static function normalizeLabOrders($items): array
    {
        return ClinicalHistorySessionRepository::normalizeLabOrders($items);
    }

    public static function normalizeImagingOrders($items): array
    {
        return ClinicalHistorySessionRepository::normalizeImagingOrders($items);
    }

    public static function normalizeLabOrder(array $labOrder, array $fallback = []): array
    {
        return ClinicalHistorySessionRepository::normalizeLabOrder($labOrder, $fallback);
    }

    public static function normalizeImagingOrder(array $imagingOrder, array $fallback = []): array
    {
        return ClinicalHistorySessionRepository::normalizeImagingOrder($imagingOrder, $fallback);
    }

    public static function normalizeLabOrderSnapshots($items): array
    {
        return ClinicalHistorySessionRepository::normalizeLabOrderSnapshots($items);
    }

    public static function normalizeImagingOrderSnapshots($items): array
    {
        return ClinicalHistorySessionRepository::normalizeImagingOrderSnapshots($items);
    }

    public static function normalizeImagingReport(array $report, array $fallback = []): array
    {
        return ClinicalHistorySessionRepository::normalizeImagingReport($report, $fallback);
    }

    public static function normalizeImagingReportSnapshots($items): array
    {
        return ClinicalHistorySessionRepository::normalizeImagingReportSnapshots($items);
    }

    public static function normalizeInterconsultations($items): array
    {
        return ClinicalHistorySessionRepository::normalizeInterconsultations($items);
    }

    public static function normalizeInterconsultation(array $interconsultation, array $fallback = []): array
    {
        return ClinicalHistorySessionRepository::normalizeInterconsultation($interconsultation, $fallback);
    }

    public static function normalizeInterconsultFormSnapshots($items): array
    {
        return ClinicalHistorySessionRepository::normalizeInterconsultFormSnapshots($items);
    }

    public static function normalizeInterconsultReport(array $report, array $fallback = []): array
    {
        return ClinicalHistorySessionRepository::normalizeInterconsultReport($report, $fallback);
    }

    public static function normalizeInterconsultReportSnapshots($items): array
    {
        return ClinicalHistorySessionRepository::normalizeInterconsultReportSnapshots($items);
    }

    public static function syncInterconsultationArtifacts(array $draft, array $session = []): array
    {
        return ClinicalHistorySessionRepository::syncInterconsultationArtifacts($draft, $session);
    }

    public static function syncLabOrderArtifacts(array $draft, array $session = []): array
    {
        return ClinicalHistorySessionRepository::syncLabOrderArtifacts($draft, $session);
    }

    public static function syncImagingOrderArtifacts(array $draft, array $session = []): array
    {
        return ClinicalHistorySessionRepository::syncImagingOrderArtifacts($draft, $session);
    }

    public static function evaluateInterconsultation(array $interconsultation): array
    {
        return ClinicalHistorySessionRepository::evaluateInterconsultation($interconsultation);
    }

    public static function evaluateLabOrder(array $labOrder): array
    {
        return ClinicalHistorySessionRepository::evaluateLabOrder($labOrder);
    }

    public static function evaluateImagingOrder(array $imagingOrder): array
    {
        return ClinicalHistorySessionRepository::evaluateImagingOrder($imagingOrder);
    }

    public static function evaluateImagingReport(array $report): array
    {
        return ClinicalHistorySessionRepository::evaluateImagingReport($report);
    }

    public static function evaluateInterconsultReport(array $report): array
    {
        return ClinicalHistorySessionRepository::evaluateInterconsultReport($report);
    }

    public static function consentPacketTemplate(string $templateKey): array
    {
        return ClinicalHistorySessionRepository::consentPacketTemplate($templateKey);
    }

    public static function normalizeConsentPackets($items): array
    {
        return ClinicalHistorySessionRepository::normalizeConsentPackets($items);
    }

    public static function normalizeConsentPacket(array $packet, array $fallback = []): array
    {
        return ClinicalHistorySessionRepository::normalizeConsentPacket($packet, $fallback);
    }

    public static function normalizeConsentFormSnapshots($items): array
    {
        return ClinicalHistorySessionRepository::normalizeConsentFormSnapshots($items);
    }

    public static function syncConsentArtifacts(array $draft, array $session = []): array
    {
        return ClinicalHistorySessionRepository::syncConsentArtifacts($draft, $session);
    }

    public static function applyConsentBridgePatch(array $draft, array $consentPatch, array $session = []): array
    {
        return ClinicalHistorySessionRepository::applyConsentBridgePatch($draft, $consentPatch, $session);
    }

    public static function normalizeAdmissionHistory($history): array
    {
        return ClinicalHistorySessionRepository::normalizeAdmissionHistory($history);
    }

    public static function normalizeAdmissionChangeLog($changeLog): array
    {
        return ClinicalHistorySessionRepository::normalizeAdmissionChangeLog($changeLog);
    }

    public static function evaluateHcu001(array $admission, array $context = []): array
    {
        return ClinicalHistorySessionRepository::evaluateHcu001($admission, $context);
    }

    public static function buildPatientMirrorFromAdmission(array $patient, array $admission, array $intake = []): array
    {
        return ClinicalHistorySessionRepository::buildPatientMirrorFromAdmission($patient, $admission, $intake);
    }

    public static function buildPatientFactsMirrorFromAdmission(array $facts, array $admission): array
    {
        return ClinicalHistorySessionRepository::buildPatientFactsMirrorFromAdmission($facts, $admission);
    }

    public static function buildAdmissionLegalName(array $admission, array $patient = []): string
    {
        return ClinicalHistorySessionRepository::buildAdmissionLegalName($admission, $patient);
    }

    public static function normalizeConsentRecord(array $consent): array
    {
        return ClinicalHistorySessionRepository::normalizeConsentRecord($consent);
    }

    public static function buildConsentRecordFromPacket(?array $packet, array $fallback = []): array
    {
        return ClinicalHistorySessionRepository::buildConsentRecordFromPacket($packet, $fallback);
    }

    public static function evaluateConsentPacket(array $packet): array
    {
        return ClinicalHistorySessionRepository::evaluateConsentPacket($packet);
    }

    public static function normalizeApprovalRecord(array $approval): array
    {
        return ClinicalHistorySessionRepository::normalizeApprovalRecord($approval);
    }

    public static function normalizeDisclosureLog($items): array
    {
        return ClinicalHistorySessionRepository::normalizeDisclosureLog($items);
    }

    public static function normalizeCopyRequests($items): array
    {
        return ClinicalHistorySessionRepository::normalizeCopyRequests($items);
    }

    public static function normalizeAccessAuditEntries($items): array
    {
        return ClinicalHistorySessionRepository::normalizeAccessAuditEntries($items);
    }

    public static function normalizeAccessAuditEntry(array $item): array
    {
        return ClinicalHistorySessionRepository::normalizeAccessAuditEntry($item);
    }

    public static function appendAccessAudit(array $store, array $entry): array
    {
        return ClinicalHistorySessionRepository::appendAccessAudit($store, $entry);
    }

    public static function findAccessAuditForRecord(array $store, string $recordId, string $sessionId): array
    {
        return ClinicalHistorySessionRepository::findAccessAuditForRecord($store, $recordId, $sessionId);
    }

    public static function normalizePatient(array $patient): array
    {
        return ClinicalHistorySessionRepository::normalizePatient($patient);
    }

    public static function normalizePatientFacts($facts): array
    {
        return ClinicalHistorySessionRepository::normalizePatientFacts($facts);
    }

    public static function normalizeIntake(array $intake): array
    {
        return ClinicalHistorySessionRepository::normalizeIntake($intake);
    }

    public static function deriveAgeYearsFromBirthDate(string $birthDate): ?int
    {
        return ClinicalHistorySessionRepository::deriveAgeYearsFromBirthDate($birthDate);
    }

    public static function normalizeClinicianDraft(array $draft): array
    {
        return ClinicalHistorySessionRepository::normalizeClinicianDraft($draft);
    }

    public static function normalizeAttachmentList($attachments): array
    {
        return ClinicalHistorySessionRepository::normalizeAttachmentList($attachments);
    }

    public static function normalizeTranscript(array $transcript): array
    {
        return ClinicalHistorySessionRepository::normalizeTranscript($transcript);
    }

    public static function normalizeTranscriptMessage(array $message): array
    {
        return ClinicalHistorySessionRepository::normalizeTranscriptMessage($message);
    }

    public static function normalizeStringList($items): array
    {
        return ClinicalHistorySessionRepository::normalizeStringList($items);
    }

    public static function normalizeConfidence($value): float
    {
        return ClinicalHistorySessionRepository::normalizeConfidence($value);
    }

    public static function normalizePendingAi(array $pending): array
    {
        return ClinicalHistorySessionRepository::normalizePendingAi($pending);
    }

    public static function trimString($value): string
    {
        return ClinicalHistorySessionRepository::trimString($value);
    }

    public static function nullablePositiveInt($value): ?int
    {
        return ClinicalHistorySessionRepository::nullablePositiveInt($value);
    }

    public static function nullableFloat($value): ?float
    {
        return ClinicalHistorySessionRepository::nullableFloat($value);
    }

    public static function buildLegacyConsentPacketFromRecord(array $consent, array $draft, array $session): array
    {
        return ClinicalHistorySessionRepository::buildLegacyConsentPacketFromRecord($consent, $draft, $session);
    }

    public static function hydrateConsentPacketContext(array $packet, array $draft, array $session): array
    {
        return ClinicalHistorySessionRepository::hydrateConsentPacketContext($packet, $draft, $session);
    }

    public static function hydrateInterconsultationContext(array $interconsultation, array $draft, array $session): array
    {
        return ClinicalHistorySessionRepository::hydrateInterconsultationContext($interconsultation, $draft, $session);
    }

    public static function hydrateLabOrderContext(array $labOrder, array $draft, array $session): array
    {
        return ClinicalHistorySessionRepository::hydrateLabOrderContext($labOrder, $draft, $session);
    }

    public static function hydrateImagingOrderContext(array $imagingOrder, array $draft, array $session): array
    {
        return ClinicalHistorySessionRepository::hydrateImagingOrderContext($imagingOrder, $draft, $session);
    }

    public static function ensureInterconsultFormSnapshots(array $existingSnapshots, array $interconsultations): array
    {
        return ClinicalHistorySessionRepository::ensureInterconsultFormSnapshots($existingSnapshots, $interconsultations);
    }

    public static function ensureInterconsultReportSnapshots(array $existingSnapshots, array $interconsultations): array
    {
        return ClinicalHistorySessionRepository::ensureInterconsultReportSnapshots($existingSnapshots, $interconsultations);
    }

    public static function ensureLabOrderSnapshots(array $existingSnapshots, array $labOrders): array
    {
        return ClinicalHistorySessionRepository::ensureLabOrderSnapshots($existingSnapshots, $labOrders);
    }

    public static function ensureImagingOrderSnapshots(array $existingSnapshots, array $imagingOrders): array
    {
        return ClinicalHistorySessionRepository::ensureImagingOrderSnapshots($existingSnapshots, $imagingOrders);
    }

    public static function ensureImagingReportSnapshots(array $existingSnapshots, array $imagingOrders): array
    {
        return ClinicalHistorySessionRepository::ensureImagingReportSnapshots($existingSnapshots, $imagingOrders);
    }

    public static function ensureConsentFormSnapshots(array $existingSnapshots, array $packets): array
    {
        return ClinicalHistorySessionRepository::ensureConsentFormSnapshots($existingSnapshots, $packets);
    }

    public static function consentRecordHasSubstantiveContent(array $consent): bool
    {
        return ClinicalHistorySessionRepository::consentRecordHasSubstantiveContent($consent);
    }

    /**
         * @param array<int,string> $parts
         */
    public static function stableDerivedId(string $prefix, array $parts): string
    {
        return ClinicalHistorySessionRepository::stableDerivedId($prefix, $parts);
    }
}
