<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';
require_once __DIR__ . '/../lib/LeadOpsService.php';
require_once __DIR__ . '/../lib/PatientCaseService.php';
require_once __DIR__ . '/../lib/email.php';
require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/validation.php';
require_once __DIR__ . '/../lib/telemedicine/ClinicalMediaService.php';

class IntakeController
{
    private const PHOTO_MAX_COUNT = 3;
    private const PHOTO_MAX_BYTES = 5242880;

    public static function store(array $context): void
    {
        require_rate_limit('public_intakes', 5, 60);
        self::requireClinicalStorageReady(
            'flow_os_intake',
            [
                'caseId' => '',
                'photoCount' => 0,
            ],
            'La preconsulta digital requiere almacenamiento clinico cifrado antes de recibir datos del caso.'
        );

        $nombre = trim((string) ($_POST['nombre'] ?? ''));
        $whatsapp = trim((string) ($_POST['whatsapp'] ?? ''));
        $tipoPiel = trim((string) ($_POST['tipo_piel'] ?? ''));
        $condicion = trim((string) ($_POST['condicion'] ?? ''));
        $photoFiles = self::normalizePhotoUploads($_FILES['fotos'] ?? null);

        if ($nombre === '') {
            json_response(['ok' => false, 'error' => 'Nombre obligatorio'], 400);
        }
        if ($whatsapp === '') {
            json_response(['ok' => false, 'error' => 'WhatsApp obligatorio'], 400);
        }
        if (!validate_phone($whatsapp)) {
            json_response(['ok' => false, 'error' => 'El formato del telefono no es valido'], 400);
        }
        if ($condicion === '') {
            json_response(['ok' => false, 'error' => 'Describe brevemente la condicion que quiere revisar'], 400);
        }
        if (count($photoFiles) > self::PHOTO_MAX_COUNT) {
            json_response([
                'ok' => false,
                'error' => 'Adjunta hasta 3 fotos por preconsulta',
            ], 400);
        }

        $lockResult = with_store_lock(static function () use (
            $context,
            $nombre,
            $whatsapp,
            $tipoPiel,
            $condicion,
            $photoFiles
        ): array {
            $store = read_store();
            $tenantId = self::resolveTenantId($store, $context);
            $now = local_date('c');
            $caseId = self::buildPrefixedId('pc');
            $patientId = self::buildPrefixedId('pt');
            $nextUploadId = self::nextClinicalUploadId($store);

            $storedPhotos = [];
            try {
                foreach ($photoFiles as $photoFile) {
                    $storedPhotos[] = self::storeCasePhoto(
                        $photoFile,
                        $caseId,
                        $tenantId,
                        $nextUploadId
                    );
                    $nextUploadId++;
                }
            } catch (RuntimeException $error) {
                self::cleanupStoredPhotos($storedPhotos);
                return [
                    'ok' => false,
                    'error' => $error->getMessage(),
                    'code' => 400,
                ];
            }

            $caseSummary = [
                'patientLabel' => $nombre,
                'serviceLine' => 'Preconsulta digital',
                'service_intent' => 'preconsulta_digital',
                'contactPhone' => $whatsapp,
                'contactEmail' => '',
                'intakeSkinType' => $tipoPiel,
                'intakeCondition' => $condicion,
                'intakePhotoCount' => count($storedPhotos),
                'intakePhotoIds' => array_values(array_map(static function (array $photo): int {
                    return (int) ($photo['id'] ?? 0);
                }, $storedPhotos)),
                'intakeReceivedAt' => $now,
                'source' => 'public_preconsultation',
                'campaign' => 'unknown',
                'surface' => 'preconsulta_publica',
                'entrySurface' => 'preconsulta_publica',
                'lastChannel' => 'web_preconsulta',
                'milestones' => [],
            ];

            $store['patient_cases'] = isset($store['patient_cases']) && is_array($store['patient_cases'])
                ? array_values($store['patient_cases'])
                : [];
            $store['patient_case_links'] = isset($store['patient_case_links']) && is_array($store['patient_case_links'])
                ? array_values($store['patient_case_links'])
                : [];
            $store['patient_case_timeline_events'] = isset($store['patient_case_timeline_events']) && is_array($store['patient_case_timeline_events'])
                ? array_values($store['patient_case_timeline_events'])
                : [];
            $store['clinical_uploads'] = isset($store['clinical_uploads']) && is_array($store['clinical_uploads'])
                ? array_values($store['clinical_uploads'])
                : [];

            $case = [
                'id' => $caseId,
                'tenantId' => $tenantId,
                'patientId' => $patientId,
                'status' => 'lead_captured',
                'journeyStage' => 'lead_captured',
                'journeyEnteredAt' => $now,
                'journeyAdvancedAt' => $now,
                'journeyAdvancedReason' => 'public_preconsultation_created',
                'openedAt' => $now,
                'latestActivityAt' => $now,
                'closedAt' => null,
                'lastInboundAt' => null,
                'lastOutboundAt' => null,
                'summary' => $caseSummary,
            ];
            $store['patient_cases'][] = $case;

            foreach ($storedPhotos as $photo) {
                $store['clinical_uploads'][] = $photo;
            }

            $eventId = self::buildPrefixedId('pte');
            $store['patient_case_timeline_events'][] = [
                'id' => $eventId,
                'tenantId' => $tenantId,
                'patientCaseId' => $caseId,
                'type' => 'public_intake_created',
                'title' => 'Preconsulta digital recibida',
                'payload' => [
                    'sourcePath' => app_api_relative_url('telemedicine-preconsultation'),
                    'patientLabel' => $nombre,
                    'contactPhone' => $whatsapp,
                    'skinType' => $tipoPiel,
                    'condition' => $condicion,
                    'photoCount' => count($storedPhotos),
                ],
                'createdAt' => $now,
            ];
            $store['patient_case_links'][] = [
                'id' => self::buildPrefixedId('pcl'),
                'tenantId' => $tenantId,
                'patientCaseId' => $caseId,
                'entityType' => 'flow_event',
                'entityId' => $eventId,
                'relationship' => 'primary',
                'createdAt' => $now,
            ];

            $patientCaseService = new PatientCaseService();
            $store = $patientCaseService->hydrateStore($store);
            if (!write_store($store, false)) {
                return [
                    'ok' => false,
                    'error' => 'No se pudo registrar la preconsulta',
                    'code' => 503,
                ];
            }

            return [
                'ok' => true,
                'case' => $case,
                'photoCount' => count($storedPhotos),
            ];
        });

        if (
            ($lockResult['ok'] ?? false) !== true ||
            !is_array($lockResult['result'] ?? null) ||
            (($lockResult['result']['ok'] ?? false) !== true)
        ) {
            $result = is_array($lockResult['result'] ?? null) ? $lockResult['result'] : $lockResult;
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo registrar la preconsulta'),
            ], (int) ($result['code'] ?? 503));
        }

        $result = $lockResult['result'];
        $case = is_array($result['case'] ?? null) ? $result['case'] : [];
        maybe_send_preconsultation_admin_notification([
            'patientLabel' => $nombre,
            'contactPhone' => $whatsapp,
            'skinType' => $tipoPiel,
            'condition' => $condicion,
            'photoCount' => (int) ($result['photoCount'] ?? 0),
            'caseId' => (string) ($case['id'] ?? ''),
        ]);

        json_response([
            'ok' => true,
            'data' => [
                'caseId' => (string) ($case['id'] ?? ''),
                'photoCount' => (int) ($result['photoCount'] ?? 0),
                'message' => 'Preconsulta recibida. Frontdesk le escribira por WhatsApp.',
            ],
        ], 201);
    }

    public static function requireClinicalStorageReady(string $surface, array $data = [], string $error = ''): void
    {
        $readiness = internal_console_readiness_snapshot();
        if (internal_console_clinical_data_ready($readiness)) {
            return;
        }

        $payload = internal_console_clinical_guard_payload([
            'surface' => $surface,
            'data' => $data,
        ]);
        if ($error !== '') {
            $payload['error'] = $error;
        }

        json_response($payload, 409);
    }

    public static function normalizePhotoUploads($rawFiles): array
    {
        if (!is_array($rawFiles) || !isset($rawFiles['tmp_name'])) {
            return [];
        }

        if (!is_array($rawFiles['tmp_name'])) {
            return [$rawFiles];
        }

        $files = [];
        $count = count($rawFiles['tmp_name']);
        for ($index = 0; $index < $count; $index++) {
            $files[] = [
                'name' => $rawFiles['name'][$index] ?? '',
                'type' => $rawFiles['type'][$index] ?? '',
                'tmp_name' => $rawFiles['tmp_name'][$index] ?? '',
                'error' => $rawFiles['error'][$index] ?? UPLOAD_ERR_NO_FILE,
                'size' => $rawFiles['size'][$index] ?? 0,
            ];
        }

        return array_values(array_filter($files, static function (array $file): bool {
            return (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
        }));
    }

    public static function storeCasePhoto(array $file, string $caseId, string $tenantId, int $uploadId): array
    {
        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error !== UPLOAD_ERR_OK) {
            throw new RuntimeException('No se pudo subir una de las fotos. Codigo: ' . $error);
        }

        $tmpName = trim((string) ($file['tmp_name'] ?? ''));
        if ($tmpName === '') {
            throw new RuntimeException('Una de las fotos no es valida.');
        }

        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0) {
            throw new RuntimeException('Una de las fotos esta vacia.');
        }
        if ($size > self::PHOTO_MAX_BYTES) {
            throw new RuntimeException('Cada foto debe pesar maximo 5 MB.');
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = $finfo ? (string) finfo_file($finfo, $tmpName) : '';
        if ($finfo) {
            finfo_close($finfo);
        }

        $allowed = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
        ];
        if (!isset($allowed[$mime])) {
            throw new RuntimeException('Las fotos deben ser JPG, PNG o WEBP.');
        }
        if (!ensure_clinical_media_dir()) {
            throw new RuntimeException('No se pudo preparar el almacenamiento clinico.');
        }

        $suffix = bin2hex(random_bytes(6));
        $filename = 'clinical-preconsulta-' . local_date('Ymd-His') . '-' . $suffix . '.' . $allowed[$mime];
        $targetDiskPath = clinical_media_dir_path() . DIRECTORY_SEPARATOR . $filename;
        if (!self::moveUploadedFile($tmpName, $targetDiskPath)) {
            throw new RuntimeException('No se pudo guardar una de las fotos.');
        }

        @chmod($targetDiskPath, 0640);
        $sha256 = @hash_file('sha256', $targetDiskPath);
        $originalName = basename((string) ($file['name'] ?? $filename));
        $safeOriginal = preg_replace('/[^a-zA-Z0-9._ -]/', '_', $originalName);
        if (!is_string($safeOriginal) || $safeOriginal === '') {
            $safeOriginal = $filename;
        }

        return [
            'id' => max(1, $uploadId),
            'tenantId' => $tenantId,
            'intakeId' => null,
            'appointmentId' => null,
            'patientCaseId' => $caseId,
            'kind' => ClinicalMediaService::KIND_CASE_PHOTO,
            'storageMode' => ClinicalMediaService::STORAGE_PRIVATE_CLINICAL,
            'privatePath' => 'clinical-media/' . $filename,
            'legacyPublicPath' => '',
            'legacyPublicUrl' => '',
            'mime' => $mime,
            'size' => $size,
            'sha256' => is_string($sha256) ? $sha256 : '',
            'originalName' => $safeOriginal,
            'createdAt' => local_date('c'),
            'updatedAt' => local_date('c'),
        ];
    }

    public static function moveUploadedFile(string $tmpName, string $targetPath): bool
    {
        if (is_uploaded_file($tmpName)) {
            return @move_uploaded_file($tmpName, $targetPath);
        }

        if (!defined('TESTING_ENV') || !TESTING_ENV || !is_file($tmpName)) {
            return false;
        }

        if (@rename($tmpName, $targetPath)) {
            return true;
        }

        if (!@copy($tmpName, $targetPath)) {
            return false;
        }

        @unlink($tmpName);
        return true;
    }

    public static function cleanupStoredPhotos(array $photos): void
    {
        foreach ($photos as $photo) {
            if (!is_array($photo)) {
                continue;
            }

            $privatePath = trim((string) ($photo['privatePath'] ?? ''));
            if ($privatePath === '') {
                continue;
            }

            $filename = basename($privatePath);
            if ($filename === '' || $filename === '.' || $filename === '..') {
                continue;
            }

            $diskPath = clinical_media_dir_path() . DIRECTORY_SEPARATOR . $filename;
            if (is_file($diskPath)) {
                @unlink($diskPath);
            }
        }
    }

    public static function nextClinicalUploadId(array $store): int
    {
        $maxId = 0;
        foreach (($store['clinical_uploads'] ?? []) as $upload) {
            if (!is_array($upload)) {
                continue;
            }
            $maxId = max($maxId, (int) ($upload['id'] ?? 0));
        }

        return $maxId + 1;
    }

    public static function resolveTenantId(array $store, array $context): string
    {
        foreach (['patient_cases', 'appointments', 'callbacks'] as $key) {
            $records = isset($store[$key]) && is_array($store[$key]) ? $store[$key] : [];
            if ($records === []) {
                continue;
            }

            $first = $records[0];
            if (!is_array($first)) {
                continue;
            }

            $tenantId = trim((string) ($first['tenantId'] ?? ''));
            if ($tenantId !== '') {
                return $tenantId;
            }
        }

        return get_current_tenant_id();
    }

    public static function buildPrefixedId(string $prefix): string
    {
        return $prefix . '_' . substr(hash('sha1', $prefix . '|' . microtime(true) . '|' . bin2hex(random_bytes(8))), 0, 16);
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'POST:flow-os-intake':
                self::store($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'store':
                            self::store($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
