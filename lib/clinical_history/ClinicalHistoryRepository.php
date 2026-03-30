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
        return ClinicalHistoryEvolutionRepository::normalizeHcu005Draft();
    }

    public static function normalizeHcu005Section(array $section, array $fallback = []): array
    {
        return ClinicalHistoryEvolutionRepository::normalizeHcu005Section();
    }

    public static function evaluateHcu005(array $hcu005): array
    {
        return ClinicalHistoryEvolutionRepository::evaluateHcu005();
    }

    public static function renderHcu005Summary(array $section): string
    {
        return ClinicalHistoryEvolutionRepository::renderHcu005Summary();
    }

    public static function renderHcu005Content(array $section): string
    {
        return ClinicalHistoryEvolutionRepository::renderHcu005Content();
    }

    public static function normalizePrescriptionItems($items): array
    {
        return ClinicalHistoryPrescriptionRepository::normalizePrescriptionItems();
    }

    public static function normalizePrescriptionItem(array $item): array
    {
        return ClinicalHistoryPrescriptionRepository::normalizePrescriptionItem();
    }

    public static function prescriptionItemIsStarted(array $item): bool
    {
        return ClinicalHistoryPrescriptionRepository::prescriptionItemIsStarted();
    }

    public static function prescriptionItemIsComplete(array $item): bool
    {
        return ClinicalHistoryPrescriptionRepository::prescriptionItemIsComplete();
    }

    public static function renderPrescriptionMedicationMirror(array $items): string
    {
        return ClinicalHistoryPrescriptionRepository::renderPrescriptionMedicationMirror();
    }

    public static function renderPrescriptionDirectionsMirror(array $items): string
    {
        return ClinicalHistoryPrescriptionRepository::renderPrescriptionDirectionsMirror();
    }

    public static function normalizeInterconsultationDiagnoses($items): array
    {
        return ClinicalHistoryDiagnosisRepository::normalizeInterconsultationDiagnoses();
    }

    public static function normalizeInterconsultationDiagnosis(array $diagnosis): array
    {
        return ClinicalHistoryDiagnosisRepository::normalizeInterconsultationDiagnosis();
    }

    public static function nextId(array $records): int
    {
        return ClinicalHistorySessionRepository::nextId();
    }

    public static function newOpaqueId(string $prefix = 'chs'): string
    {
        return ClinicalHistorySessionRepository::newOpaqueId();
    }

    public static function defaultSession(array $seed = []): array
    {
        return ClinicalHistorySessionRepository::defaultSession();
    }

    public static function defaultDraft(array $session, array $seed = []): array
    {
        return ClinicalHistorySessionRepository::defaultDraft();
    }

    public static function defaultEvent(array $seed = []): array
    {
        return ClinicalHistorySessionRepository::defaultEvent();
    }

    public static function findSessionBySessionId(array $store, string $sessionId): ?array
    {
        return ClinicalHistorySessionRepository::findSessionBySessionId();
    }

    public static function findSessionByCaseId(array $store, string $caseId): ?array
    {
        return ClinicalHistorySessionRepository::findSessionByCaseId();
    }

    public static function findDraftBySessionId(array $store, string $sessionId): ?array
    {
        return ClinicalHistorySessionRepository::findDraftBySessionId();
    }

    public static function findAllDraftsByCaseId(array $store, string $caseId): array
    {
        return ClinicalHistorySessionRepository::findAllDraftsByCaseId();
    }

    public static function findEventsBySessionId(array $store, string $sessionId): array
    {
        return ClinicalHistorySessionRepository::findEventsBySessionId();
    }

    public static function upsertSession(array $store, array $session): array
    {
        return ClinicalHistorySessionRepository::upsertSession();
    }

    public static function upsertDraft(array $store, array $draft): array
    {
        return ClinicalHistorySessionRepository::upsertDraft();
    }

    public static function upsertEvent(array $store, array $event): array
    {
        return ClinicalHistorySessionRepository::upsertEvent();
    }

    public static function findClinicalUploadById(array $store, int $uploadId): ?array
    {
        return ClinicalHistorySessionRepository::findClinicalUploadById();
    }

    public static function upsertClinicalUpload(array $store, array $upload): array
    {
        return ClinicalHistorySessionRepository::upsertClinicalUpload();
    }

    public static function appendTranscriptMessage(array $session, array $message): array
    {
        return ClinicalHistorySessionRepository::appendTranscriptMessage();
    }

    public static function patientSafeSession(array $session): array
    {
        return ClinicalHistorySessionRepository::patientSafeSession();
    }

    public static function adminSession(array $session): array
    {
        return ClinicalHistorySessionRepository::adminSession();
    }

    public static function patientSafeDraft(array $draft): array
    {
        return ClinicalHistorySessionRepository::patientSafeDraft();
    }

    public static function adminDraft(array $draft): array
    {
        return ClinicalHistorySessionRepository::adminDraft();
    }

    public static function normalizeRecordMeta(array $meta, array $session = [], array $draft = []): array
    {
        return ClinicalHistorySessionRepository::normalizeRecordMeta();
    }

    public static function normalizeClinicalDocuments(array $documents): array
    {
        return ClinicalHistorySessionRepository::normalizeClinicalDocuments();
    }

    public static function normalizeLabOrderStudySelections($items): array
    {
        return ClinicalHistorySessionRepository::normalizeLabOrderStudySelections();
    }

    /**
     * @return array<int,string>
     */
    public static function flattenLabOrderStudySelections(array $studySelections): array
    {
        return ClinicalHistorySessionRepository::flattenLabOrderStudySelections();
    }

    public static function normalizeImagingStudySelections($items): array
    {
        return ClinicalHistorySessionRepository::normalizeImagingStudySelections();
    }

    /**
     * @return array<int,string>
     */
    public static function flattenImagingStudySelections(array $studySelections): array
    {
        return ClinicalHistorySessionRepository::flattenImagingStudySelections();
    }

    public static function normalizeLabOrders($items): array
    {
        return ClinicalHistorySessionRepository::normalizeLabOrders();
    }

    public static function normalizeImagingOrders($items): array
    {
        return ClinicalHistorySessionRepository::normalizeImagingOrders();
    }

    public static function normalizeLabOrder(array $labOrder, array $fallback = []): array
    {
        return ClinicalHistorySessionRepository::normalizeLabOrder();
    }

    public static function normalizeImagingOrder(array $imagingOrder, array $fallback = []): array
    {
        return ClinicalHistorySessionRepository::normalizeImagingOrder();
    }

    public static function normalizeLabOrderSnapshots($items): array
    {
        return ClinicalHistorySessionRepository::normalizeLabOrderSnapshots();
    }

    public static function normalizeImagingOrderSnapshots($items): array
    {
        return ClinicalHistorySessionRepository::normalizeImagingOrderSnapshots();
    }

    public static function normalizeImagingReport(array $report, array $fallback = []): array
    {
        return ClinicalHistorySessionRepository::normalizeImagingReport();
    }

    public static function normalizeImagingReportSnapshots($items): array
    {
        return ClinicalHistorySessionRepository::normalizeImagingReportSnapshots();
    }

    public static function normalizeInterconsultations($items): array
    {
        return ClinicalHistorySessionRepository::normalizeInterconsultations();
    }

    public static function normalizeInterconsultation(array $interconsultation, array $fallback = []): array
    {
        return ClinicalHistorySessionRepository::normalizeInterconsultation();
    }

    public static function normalizeInterconsultFormSnapshots($items): array
    {
        return ClinicalHistorySessionRepository::normalizeInterconsultFormSnapshots();
    }

    public static function normalizeInterconsultReport(array $report, array $fallback = []): array
    {
        return ClinicalHistorySessionRepository::normalizeInterconsultReport();
    }

    public static function normalizeInterconsultReportSnapshots($items): array
    {
        return ClinicalHistorySessionRepository::normalizeInterconsultReportSnapshots();
    }

    public static function syncInterconsultationArtifacts(array $draft, array $session = []): array
    {
        return ClinicalHistorySessionRepository::syncInterconsultationArtifacts();
    }

    public static function syncLabOrderArtifacts(array $draft, array $session = []): array
    {
        return ClinicalHistorySessionRepository::syncLabOrderArtifacts();
    }

    public static function syncImagingOrderArtifacts(array $draft, array $session = []): array
    {
        return ClinicalHistorySessionRepository::syncImagingOrderArtifacts();
    }

    public static function evaluateInterconsultation(array $interconsultation): array
    {
        return ClinicalHistorySessionRepository::evaluateInterconsultation();
    }

    public static function evaluateLabOrder(array $labOrder): array
    {
        return ClinicalHistorySessionRepository::evaluateLabOrder();
    }

    public static function evaluateImagingOrder(array $imagingOrder): array
    {
        return ClinicalHistorySessionRepository::evaluateImagingOrder();
    }

    public static function evaluateImagingReport(array $report): array
    {
        return ClinicalHistorySessionRepository::evaluateImagingReport();
    }

    public static function evaluateInterconsultReport(array $report): array
    {
        return ClinicalHistorySessionRepository::evaluateInterconsultReport();
    }

    public static function consentPacketTemplate(string $templateKey): array
    {
        return ClinicalHistorySessionRepository::consentPacketTemplate();
    }

    public static function normalizeConsentPackets($items): array
    {
        return ClinicalHistorySessionRepository::normalizeConsentPackets();
    }

    public static function normalizeConsentPacket(array $packet, array $fallback = []): array
    {
        return ClinicalHistorySessionRepository::normalizeConsentPacket();
    }

    public static function normalizeConsentFormSnapshots($items): array
    {
        return ClinicalHistorySessionRepository::normalizeConsentFormSnapshots();
    }

    public static function syncConsentArtifacts(array $draft, array $session = []): array
    {
        return ClinicalHistorySessionRepository::syncConsentArtifacts();
    }

    public static function applyConsentBridgePatch(array $draft, array $consentPatch, array $session = []): array
    {
        return ClinicalHistorySessionRepository::applyConsentBridgePatch();
    }

    public static function normalizeAdmissionHistory($history): array
    {
        return ClinicalHistorySessionRepository::normalizeAdmissionHistory();
    }

    public static function normalizeAdmissionChangeLog($changeLog): array
    {
        return ClinicalHistorySessionRepository::normalizeAdmissionChangeLog();
    }

    public static function evaluateHcu001(array $admission, array $context = []): array
    {
        return ClinicalHistorySessionRepository::evaluateHcu001();
    }

    public static function buildPatientMirrorFromAdmission(array $patient, array $admission, array $intake = []): array
    {
        return ClinicalHistorySessionRepository::buildPatientMirrorFromAdmission();
    }

    public static function buildPatientFactsMirrorFromAdmission(array $facts, array $admission): array
    {
        return ClinicalHistorySessionRepository::buildPatientFactsMirrorFromAdmission();
    }

    public static function buildAdmissionLegalName(array $admission, array $patient = []): string
    {
        return ClinicalHistorySessionRepository::buildAdmissionLegalName();
    }

    public static function normalizeConsentRecord(array $consent): array
    {
        return ClinicalHistorySessionRepository::normalizeConsentRecord();
    }

    public static function buildConsentRecordFromPacket(?array $packet, array $fallback = []): array
    {
        return ClinicalHistorySessionRepository::buildConsentRecordFromPacket();
    }

    public static function evaluateConsentPacket(array $packet): array
    {
        return ClinicalHistorySessionRepository::evaluateConsentPacket();
    }

    public static function normalizeApprovalRecord(array $approval): array
    {
        return ClinicalHistorySessionRepository::normalizeApprovalRecord();
    }

    public static function normalizeDisclosureLog($items): array
    {
        return ClinicalHistorySessionRepository::normalizeDisclosureLog();
    }

    public static function normalizeCopyRequests($items): array
    {
        return ClinicalHistorySessionRepository::normalizeCopyRequests();
    }

    public static function normalizeAccessAuditEntries($items): array
    {
        return ClinicalHistorySessionRepository::normalizeAccessAuditEntries();
    }

    public static function normalizeAccessAuditEntry(array $item): array
    {
        return ClinicalHistorySessionRepository::normalizeAccessAuditEntry();
    }

    public static function appendAccessAudit(array $store, array $entry): array
    {
        return ClinicalHistorySessionRepository::appendAccessAudit();
    }

    public static function findAccessAuditForRecord(array $store, string $recordId, string $sessionId): array
    {
        return ClinicalHistorySessionRepository::findAccessAuditForRecord();
    }

    public static function normalizePatient(array $patient): array
    {
        return ClinicalHistorySessionRepository::normalizePatient();
    }

    public static function normalizePatientFacts($facts): array
    {
        return ClinicalHistorySessionRepository::normalizePatientFacts();
    }

    public static function normalizeIntake(array $intake): array
    {
        return ClinicalHistorySessionRepository::normalizeIntake();
    }

    public static function deriveAgeYearsFromBirthDate(string $birthDate): ?int
    {
        return ClinicalHistorySessionRepository::deriveAgeYearsFromBirthDate();
    }

    public static function normalizeClinicianDraft(array $draft): array
    {
        return ClinicalHistorySessionRepository::normalizeClinicianDraft();
    }

    public static function normalizeAttachmentList($attachments): array
    {
        return ClinicalHistorySessionRepository::normalizeAttachmentList();
    }

    public static function normalizeTranscript(array $transcript): array
    {
        return ClinicalHistorySessionRepository::normalizeTranscript();
    }

    public static function normalizeTranscriptMessage(array $message): array
    {
        return ClinicalHistorySessionRepository::normalizeTranscriptMessage();
    }

    public static function normalizeStringList($items): array
    {
        return ClinicalHistorySessionRepository::normalizeStringList();
    }

    public static function normalizeConfidence($value): float
    {
        return ClinicalHistorySessionRepository::normalizeConfidence();
    }

    public static function normalizePendingAi(array $pending): array
    {
        return ClinicalHistorySessionRepository::normalizePendingAi();
    }

    public static function trimString($value): string
    {
        return ClinicalHistorySessionRepository::trimString();
    }

    public static function nullablePositiveInt($value): ?int
    {
        return ClinicalHistorySessionRepository::nullablePositiveInt();
    }

    public static function nullableFloat($value): ?float
    {
        return ClinicalHistorySessionRepository::nullableFloat();
    }

    public static function buildLegacyConsentPacketFromRecord(array $consent, array $draft, array $session): array
    {
        return ClinicalHistorySessionRepository::buildLegacyConsentPacketFromRecord();
    }

    public static function hydrateConsentPacketContext(array $packet, array $draft, array $session): array
    {
        return ClinicalHistorySessionRepository::hydrateConsentPacketContext();
    }

    public static function hydrateInterconsultationContext(array $interconsultation, array $draft, array $session): array
    {
        return ClinicalHistorySessionRepository::hydrateInterconsultationContext();
    }

    public static function hydrateLabOrderContext(array $labOrder, array $draft, array $session): array
    {
        return ClinicalHistorySessionRepository::hydrateLabOrderContext();
    }

    public static function hydrateImagingOrderContext(array $imagingOrder, array $draft, array $session): array
    {
        return ClinicalHistorySessionRepository::hydrateImagingOrderContext();
    }

    public static function ensureInterconsultFormSnapshots(array $existingSnapshots, array $interconsultations): array
    {
        return ClinicalHistorySessionRepository::ensureInterconsultFormSnapshots();
    }

    public static function ensureInterconsultReportSnapshots(array $existingSnapshots, array $interconsultations): array
    {
        return ClinicalHistorySessionRepository::ensureInterconsultReportSnapshots();
    }

    public static function ensureLabOrderSnapshots(array $existingSnapshots, array $labOrders): array
    {
        return ClinicalHistorySessionRepository::ensureLabOrderSnapshots();
    }

    public static function ensureImagingOrderSnapshots(array $existingSnapshots, array $imagingOrders): array
    {
        return ClinicalHistorySessionRepository::ensureImagingOrderSnapshots();
    }

    public static function ensureImagingReportSnapshots(array $existingSnapshots, array $imagingOrders): array
    {
        return ClinicalHistorySessionRepository::ensureImagingReportSnapshots();
    }

    public static function ensureConsentFormSnapshots(array $existingSnapshots, array $packets): array
    {
        return ClinicalHistorySessionRepository::ensureConsentFormSnapshots();
    }

    public static function consentRecordHasSubstantiveContent(array $consent): bool
    {
        return ClinicalHistorySessionRepository::consentRecordHasSubstantiveContent();
    }

    /**
     * @param array<int,string> $parts
     */
    public static function stableDerivedId(string $prefix, array $parts): string
    {
        return ClinicalHistorySessionRepository::stableDerivedId();
    }
}
