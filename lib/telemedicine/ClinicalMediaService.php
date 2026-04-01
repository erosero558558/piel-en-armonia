<?php

declare(strict_types=1);

require_once __DIR__ . '/../storage.php';
require_once __DIR__ . '/../audit.php';
require_once __DIR__ . '/../metrics.php';
require_once __DIR__ . '/../../payment-lib.php';
require_once __DIR__ . '/TelemedicineRepository.php';
require_once __DIR__ . '/TelemedicinePhotoTriage.php';

final class ClinicalMediaService
{
    public const KIND_CASE_PHOTO = 'case_photo';
    public const KIND_SUPPORTING_DOCUMENT = 'supporting_document';
    public const KIND_LEGACY_UNCLASSIFIED = 'legacy_unclassified';
    public const KIND_PAYMENT_PROOF = 'payment_proof';

    public const STORAGE_PRIVATE_CLINICAL = 'private_clinical';
    public const STORAGE_PUBLIC_PAYMENT = 'public_payment';
    public const STORAGE_STAGING_LEGACY = 'staging_legacy';

    public static function stageLegacyUpload(array $store, array $upload, array $context = []): array
    {
        $legacyPath = trim((string) ($upload['path'] ?? ''));
        $existing = TelemedicineRepository::findClinicalUploadByLegacyPath($store, $legacyPath);
        if (is_array($existing)) {
            return ['store' => $store, 'upload' => $existing];
        }

        $diskPath = trim((string) ($upload['diskPath'] ?? self::resolveLegacyDiskPath($legacyPath)));
        $record = [
            'id' => 0,
            'intakeId' => null,
            'appointmentId' => null,
            'kind' => self::KIND_LEGACY_UNCLASSIFIED,
            'storageMode' => self::STORAGE_STAGING_LEGACY,
            'privatePath' => '',
            'legacyPublicPath' => $legacyPath,
            'legacyPublicUrl' => trim((string) ($upload['url'] ?? '')),
            'mime' => trim((string) ($upload['mime'] ?? '')),
            'size' => (int) ($upload['size'] ?? 0),
            'sha256' => trim((string) ($upload['sha256'] ?? self::hashFileSafe($diskPath))),
            'originalName' => trim((string) ($upload['originalName'] ?? $upload['name'] ?? '')),
            'diskPath' => $diskPath,
            'stagingSource' => trim((string) ($context['source'] ?? 'transfer-proof')),
            'createdAt' => local_date('c'),
            'updatedAt' => local_date('c'),
        ];

        $result = TelemedicineRepository::upsertClinicalUpload($store, $record);
        self::emitMetric('telemedicine_media_staged_total', ['source' => (string) ($record['stagingSource'] ?? 'transfer-proof')]);
        audit_log_event('telemedicine.media_staged', [
            'uploadId' => (int) ($result['upload']['id'] ?? 0),
            'legacyPath' => $legacyPath,
        ]);

        return $result;
    }

    public static function claimAppointmentUploads(array $store, array $appointment, int $intakeId): array
    {
        $claimedIds = [];
        $privateMarkers = [];
        $casePhotoNames = is_array($appointment['casePhotoNames'] ?? null) ? $appointment['casePhotoNames'] : [];
        $casePhotoPaths = is_array($appointment['casePhotoPaths'] ?? null) ? $appointment['casePhotoPaths'] : [];
        $casePhotoRoles = TelemedicinePhotoTriage::resolveRoles($appointment, count($casePhotoPaths));
        $appointmentId = (int) ($appointment['id'] ?? 0);

        foreach ($casePhotoPaths as $index => $legacyPath) {
            $claim = self::claimCasePhoto(
                $store,
                (string) $legacyPath,
                $intakeId,
                $appointmentId,
                (string) ($casePhotoNames[$index] ?? ''),
                (string) ($casePhotoRoles[$index] ?? '')
            );
            $store = $claim['store'];
            if (isset($claim['upload']['id'])) {
                $claimedIds[] = (int) $claim['upload']['id'];
                $privatePath = trim((string) ($claim['upload']['privatePath'] ?? ''));
                if ($privatePath !== '') {
                    $privateMarkers[] = 'private://' . $privatePath;
                }
            }
        }

        $transferProofPath = trim((string) ($appointment['transferProofPath'] ?? ''));
        if ($transferProofPath !== '') {
            $claim = self::claimPaymentProof($store, $appointment, $intakeId, $appointmentId);
            $store = $claim['store'];
            if (isset($claim['upload']['id'])) {
                $claimedIds[] = (int) $claim['upload']['id'];
                $appointment['transferProofUploadId'] = (int) $claim['upload']['id'];
            }
        }

        $appointment['clinicalMediaIds'] = array_values(array_unique(array_filter($claimedIds, static function ($id): bool {
            return is_int($id) && $id > 0;
        })));
        $appointment['casePhotoUrls'] = [];
        $appointment['casePhotoPaths'] = $privateMarkers;
        $appointment['casePhotoCount'] = count($privateMarkers);
        $appointment['casePhotoRoles'] = array_slice($casePhotoRoles, 0, $appointment['casePhotoCount']);

        return [
            'store' => $store,
            'appointment' => $appointment,
            'claimedIds' => $appointment['clinicalMediaIds'],
        ];
    }

    public static function claimPatientCaseUploads(array $store, string $caseId, array $legacyPaths, array $originalNames = []): array
    {
        $normalizedCaseId = trim($caseId);
        if ($normalizedCaseId === '') {
            return [
                'store' => $store,
                'uploadIds' => [],
                'privatePaths' => [],
                'uploads' => [],
            ];
        }

        $claimedIds = [];
        $privateMarkers = [];
        $uploads = [];

        foreach (array_values($legacyPaths) as $index => $legacyPath) {
            $normalizedPath = trim((string) $legacyPath);
            if ($normalizedPath === '') {
                continue;
            }

            $record = TelemedicineRepository::findClinicalUploadByLegacyPath($store, $normalizedPath);
            if (!is_array($record)) {
                $staged = self::stageLegacyUpload(
                    $store,
                    [
                        'path' => $normalizedPath,
                        'diskPath' => self::resolveLegacyDiskPath($normalizedPath),
                        'name' => (string) ($originalNames[$index] ?? ''),
                    ],
                    ['source' => 'public_preconsultation']
                );
                $store = $staged['store'];
                $record = $staged['upload'];
            }

            $record['caseId'] = $normalizedCaseId;
            $record['intakeId'] = null;
            $record['appointmentId'] = null;
            $record['kind'] = self::KIND_CASE_PHOTO;
            $record['storageMode'] = self::STORAGE_PRIVATE_CLINICAL;
            $record['originalName'] = trim((string) ($record['originalName'] ?? ($originalNames[$index] ?? '')));
            $record['claimedAt'] = local_date('c');

            $privatePath = trim((string) ($record['privatePath'] ?? ''));
            if ($privatePath === '') {
                $privatePath = self::moveToPrivateClinicalStorage($record);
                $record['privatePath'] = $privatePath;
            }

            $result = TelemedicineRepository::upsertClinicalUpload($store, $record);
            $store = $result['store'];
            $savedUpload = is_array($result['upload'] ?? null) ? $result['upload'] : [];

            $uploadId = (int) ($savedUpload['id'] ?? 0);
            if ($uploadId > 0) {
                $claimedIds[] = $uploadId;
            }

            $savedPrivatePath = trim((string) ($savedUpload['privatePath'] ?? $privatePath));
            if ($savedPrivatePath !== '') {
                $privateMarkers[] = 'private://' . $savedPrivatePath;
            }

            $uploads[] = $savedUpload;
            self::emitMetric('telemedicine_media_claimed_total', ['kind' => self::KIND_CASE_PHOTO]);
            audit_log_event('telemedicine.media_claimed', [
                'uploadId' => $uploadId,
                'kind' => self::KIND_CASE_PHOTO,
                'patientCaseId' => $normalizedCaseId,
                'source' => 'public_preconsultation',
            ]);
        }

        return [
            'store' => $store,
            'uploadIds' => array_values(array_unique(array_filter($claimedIds, static function ($id): bool {
                return is_int($id) && $id > 0;
            }))),
            'privatePaths' => array_values(array_unique(array_filter($privateMarkers, static function ($path): bool {
                return is_string($path) && trim($path) !== '';
            }))),
            'uploads' => $uploads,
        ];
    }

    private static function claimCasePhoto(
        array $store,
        string $legacyPath,
        int $intakeId,
        int $appointmentId,
        string $originalName = '',
        string $photoRole = ''
    ): array
    {
        $record = TelemedicineRepository::findClinicalUploadByLegacyPath($store, $legacyPath);
        if (!is_array($record)) {
            $staged = self::stageLegacyUpload($store, [
                'path' => $legacyPath,
                'diskPath' => self::resolveLegacyDiskPath($legacyPath),
                'name' => $originalName,
            ], ['source' => 'intake_form']);
            $store = $staged['store'];
            $record = $staged['upload'];
        }

        $record['intakeId'] = $intakeId;
        $record['appointmentId'] = $appointmentId;
        $record['kind'] = self::KIND_CASE_PHOTO;
        $record['storageMode'] = self::STORAGE_PRIVATE_CLINICAL;
        $record['originalName'] = trim((string) ($record['originalName'] ?? $originalName));
        $record['claimedAt'] = local_date('c');
        $normalizedRole = TelemedicinePhotoTriage::normalizeRole($photoRole);
        if ($normalizedRole !== '') {
            $record['photoRole'] = $normalizedRole;
            $record['photoRoleLabel'] = TelemedicinePhotoTriage::labelForRole($normalizedRole);
            $record['triageSource'] = 'telemedicine_photo_triage';
            $record['triageAssignedAt'] = local_date('c');
        }

        $privatePath = trim((string) ($record['privatePath'] ?? ''));
        if ($privatePath === '') {
            $privatePath = self::moveToPrivateClinicalStorage($record);
            $record['privatePath'] = $privatePath;
        }

        $result = TelemedicineRepository::upsertClinicalUpload($store, $record);
        self::emitMetric('telemedicine_media_claimed_total', ['kind' => self::KIND_CASE_PHOTO]);
        audit_log_event('telemedicine.media_claimed', [
            'uploadId' => (int) ($result['upload']['id'] ?? 0),
            'kind' => self::KIND_CASE_PHOTO,
            'intakeId' => $intakeId,
            'appointmentId' => $appointmentId,
            'photoRole' => $normalizedRole,
        ]);

        return $result;
    }

    private static function claimPaymentProof(array $store, array $appointment, int $intakeId, int $appointmentId): array
    {
        $legacyPath = trim((string) ($appointment['transferProofPath'] ?? ''));
        $record = TelemedicineRepository::findClinicalUploadByLegacyPath($store, $legacyPath);
        if (!is_array($record)) {
            $staged = self::stageLegacyUpload($store, [
                'path' => $legacyPath,
                'url' => (string) ($appointment['transferProofUrl'] ?? ''),
                'name' => (string) ($appointment['transferProofName'] ?? ''),
                'mime' => (string) ($appointment['transferProofMime'] ?? ''),
                'size' => (int) ($appointment['transferProofSize'] ?? 0),
                'diskPath' => self::resolveLegacyDiskPath($legacyPath),
            ], ['source' => 'booking_public']);
            $store = $staged['store'];
            $record = $staged['upload'];
        }

        $record['intakeId'] = $intakeId;
        $record['appointmentId'] = $appointmentId;
        $record['kind'] = self::KIND_PAYMENT_PROOF;
        $record['storageMode'] = self::STORAGE_PUBLIC_PAYMENT;
        $record['claimedAt'] = local_date('c');

        $result = TelemedicineRepository::upsertClinicalUpload($store, $record);
        self::emitMetric('telemedicine_media_claimed_total', ['kind' => self::KIND_PAYMENT_PROOF]);

        return $result;
    }

    private static function moveToPrivateClinicalStorage(array $record): string
    {
        if (!ensure_clinical_media_dir()) {
            throw new RuntimeException('No se pudo preparar el storage clinico privado.');
        }

        $sourcePath = trim((string) ($record['diskPath'] ?? self::resolveLegacyDiskPath((string) ($record['legacyPublicPath'] ?? ''))));
        $extension = strtolower(pathinfo((string) ($record['originalName'] ?? $sourcePath), PATHINFO_EXTENSION));
        if ($extension === '') {
            $extension = strtolower(pathinfo($sourcePath, PATHINFO_EXTENSION));
        }
        $suffix = bin2hex(random_bytes(6));
        $filename = 'clinical-' . local_date('Ymd-His') . '-' . $suffix . ($extension !== '' ? '.' . $extension : '');
        $targetDiskPath = clinical_media_dir_path() . DIRECTORY_SEPARATOR . $filename;

        if ($sourcePath !== '' && is_file($sourcePath)) {
            if (!@rename($sourcePath, $targetDiskPath)) {
                if (!@copy($sourcePath, $targetDiskPath)) {
                    throw new RuntimeException('No se pudo mover la media clinica al storage privado.');
                }
                @unlink($sourcePath);
            }
        } else {
            @touch($targetDiskPath);
        }

        @chmod($targetDiskPath, 0640);
        return 'clinical-media/' . $filename;
    }

    private static function resolveLegacyDiskPath(string $legacyPath): string
    {
        $filename = basename(trim($legacyPath));
        if ($filename === '' || $filename === '.' || $filename === '..') {
            return '';
        }

        return rtrim(transfer_proof_upload_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $filename;
    }

    private static function hashFileSafe(string $path): string
    {
        if ($path === '' || !is_file($path)) {
            return '';
        }

        $hash = @hash_file('sha256', $path);
        return is_string($hash) ? $hash : '';
    }

    private static function emitMetric(string $name, array $labels = []): void
    {
        if (class_exists('Metrics')) {
            Metrics::increment($name, $labels);
        }
    }
}
