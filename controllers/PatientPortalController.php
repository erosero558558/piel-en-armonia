<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/portal/PortalViewService.php';


require_once __DIR__ . '/../lib/portal/PortalBillingService.php';
require_once __DIR__ . '/../lib/portal/PortalHistoryService.php';
require_once __DIR__ . '/../lib/portal/PortalTreatmentPlanService.php';

require_once __DIR__ . '/../lib/PatientPortalAuth.php';
require_once __DIR__ . '/../lib/business.php';
require_once __DIR__ . '/../lib/ClinicProfileStore.php';
require_once __DIR__ . '/../lib/DocumentVerificationService.php';
require_once __DIR__ . '/../lib/api_helpers.php';
require_once __DIR__ . '/../lib/openclaw/PrescriptionPdfRenderer.php';
require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
require_once __DIR__ . '/../lib/clinical_history/ClinicalHistorySessionRepository.php';
require_once __DIR__ . '/../payment-lib.php';

final class PatientPortalController
{
    public static function hasPendingCertificateDraft(array $drafts): bool
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


    public static function buildPortalTimelineEvents(...$args)
    {
        return PortalViewService::buildPortalTimelineEvents(...$args);
    }

    public static function buildPortalConsultationEventLabel(...$args)
    {
        return PortalViewService::buildPortalConsultationEventLabel(...$args);
    }

    public static function normalize_clinical_document(...$args)
    {
        return PortalViewService::normalize_clinical_document(...$args);
    }

    public static function buildPortalDocumentTimelineEvent(...$args)
    {
        return PortalViewService::buildPortalDocumentTimelineEvent(...$args);
    }

    public static function buildPortalPhotoTimelineEvent(...$args)
    {
        return PortalViewService::buildPortalPhotoTimelineEvent(...$args);
    }

    public static function historyStatusLabel(...$args)
    {
        return PortalViewService::historyStatusLabel(...$args);
    }

    public static function caseBelongsToPortalPatient(...$args)
    {
        return PortalViewService::caseBelongsToPortalPatient(...$args);
    }

    public static function emitPdfResponse(...$args)
    {
        return PortalViewService::emitPdfResponse(...$args);
    }

    public static function buildFallbackPdf(...$args)
    {
        return PortalViewService::buildFallbackPdf(...$args);
    }

    public static function escapeHtml(...$args)
    {
        return PortalViewService::escapeHtml(...$args);
    }

    public static function buildRescheduleUrl(...$args)
    {
        return PortalViewService::buildRescheduleUrl(...$args);
    }

    public static function buildSupportWhatsappUrl(...$args)
    {
        return PortalViewService::buildSupportWhatsappUrl(...$args);
    }

    public static function buildTelemedicineRoomUrl(...$args)
    {
        return PortalViewService::buildTelemedicineRoomUrl(...$args);
    }

    public static function buildTelemedicinePreConsultationUrl(...$args)
    {
        return PortalViewService::buildTelemedicinePreConsultationUrl(...$args);
    }

    public static function resolveAppointmentTypeKey(...$args)
    {
        return PortalViewService::resolveAppointmentTypeKey(...$args);
    }

    public static function resolveAppointmentTypeLabel(...$args)
    {
        return PortalViewService::resolveAppointmentTypeLabel(...$args);
    }

    public static function resolveLocationLabel(...$args)
    {
        return PortalViewService::resolveLocationLabel(...$args);
    }

    public static function resolvePreparationRequired(...$args)
    {
        return PortalViewService::resolvePreparationRequired(...$args);
    }

    public static function formatDoctorName(...$args)
    {
        return PortalViewService::formatDoctorName(...$args);
    }

    public static function buildDateLabel(...$args)
    {
        return PortalViewService::buildDateLabel(...$args);
    }

    public static function buildTimeLabel(...$args)
    {
        return PortalViewService::buildTimeLabel(...$args);
    }

    public static function humanizeValue(...$args)
    {
        return PortalViewService::humanizeValue(...$args);
    }

    public static function portalPhotoBelongsToCaseMap(...$args)
    {
        return PortalViewService::portalPhotoBelongsToCaseMap(...$args);
    }

    public static function isPortalVisiblePhoto(...$args)
    {
        return PortalViewService::isPortalVisiblePhoto(...$args);
    }

    public static function normalizePortalVisibilityFlag(...$args)
    {
        return PortalViewService::normalizePortalVisibilityFlag(...$args);
    }

    public static function normalizePortalPhotoItem(...$args)
    {
        return PortalViewService::normalizePortalPhotoItem(...$args);
    }

    public static function findPortalVisiblePhotoUpload(...$args)
    {
        return PortalViewService::findPortalVisiblePhotoUpload(...$args);
    }

    public static function resolvePortalPhotoAsset(...$args)
    {
        return PortalViewService::resolvePortalPhotoAsset(...$args);
    }

    public static function resolvePortalPhotoDiskPath(...$args)
    {
        return PortalViewService::resolvePortalPhotoDiskPath(...$args);
    }

    public static function safePortalMime(...$args)
    {
        return PortalViewService::safePortalMime(...$args);
    }

    public static function emitBinaryResponse(...$args)
    {
        return PortalViewService::emitBinaryResponse(...$args);
    }

    public static function emit(...$args)
    {
        return PortalViewService::emit(...$args);
    }
}
