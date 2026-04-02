<?php

declare(strict_types=1);

require_once __DIR__ . '/../CaseMediaFlowService.php';

final class ClinicalMediaService
{
    public const KIND_CASE_PHOTO = CaseMediaFlowService::KIND_CASE_PHOTO;
    public const KIND_SUPPORTING_DOCUMENT = CaseMediaFlowService::KIND_SUPPORTING_DOCUMENT;
    public const KIND_LEGACY_UNCLASSIFIED = CaseMediaFlowService::KIND_LEGACY_UNCLASSIFIED;
    public const KIND_PAYMENT_PROOF = CaseMediaFlowService::KIND_PAYMENT_PROOF;

    public const STORAGE_PRIVATE_CLINICAL = CaseMediaFlowService::STORAGE_PRIVATE_CLINICAL;
    public const STORAGE_PUBLIC_PAYMENT = CaseMediaFlowService::STORAGE_PUBLIC_PAYMENT;
    public const STORAGE_STAGING_LEGACY = CaseMediaFlowService::STORAGE_STAGING_LEGACY;

    public static function stageLegacyUpload(array $store, array $upload, array $context = []): array
    {
        return CaseMediaFlowService::stageLegacyUpload($store, $upload, $context);
    }

    public static function claimAppointmentUploads(array $store, array $appointment, int $intakeId): array
    {
        return CaseMediaFlowService::claimAppointmentUploads($store, $appointment, $intakeId);
    }

    public static function claimPatientCaseUploads(array $store, string $caseId, array $legacyPaths, array $originalNames = []): array
    {
        return CaseMediaFlowService::claimPatientCaseUploads($store, $caseId, $legacyPaths, $originalNames);
    }
}
