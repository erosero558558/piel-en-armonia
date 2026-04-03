<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/PatientPortalAuth.php';
require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';
require_once __DIR__ . '/../lib/api_helpers.php';
require_once __DIR__ . '/../lib/business.php';
require_once __DIR__ . '/../lib/models.php';
require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/telemedicine/ClinicalMediaService.php';
require_once __DIR__ . '/../lib/telemedicine/TelemedicineIntakeService.php';
require_once __DIR__ . '/../lib/telemedicine/TelemedicinePhotoTriage.php';
require_once __DIR__ . '/../lib/telemedicine/TelemedicineRepository.php';

final class TelemedicinePublicController
{
    private const PHOTO_MAX_COUNT = 3;
    private const PHOTO_MAX_BYTES = 5242880;

    public static function preConsultation(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : read_store();
        $access = self::resolveAccess($store);

        json_response([
            'ok' => true,
            'data' => self::buildResponsePayload(
                $access['appointment'],
                $store,
                $access['token'],
                null
            ),
        ]);
    }

    public static function submitPreConsultation(array $context): void
    {
        self::requireClinicalStorageReady(
            'telemedicine_preconsultation',
            [
                'appointmentId' => (int) ($_POST['appointmentId'] ?? $_POST['id'] ?? 0),
                'photoCount' => 0,
            ],
            'La pre-consulta de telemedicina requiere almacenamiento clinico cifrado antes de recibir notas o fotos.'
        );

        $store = is_array($context['store'] ?? null) ? $context['store'] : read_store();
        $access = self::resolveAccess($store, true);
        $concern = trim((string) ($_POST['concern'] ?? $_POST['latestPatientConcern'] ?? ''));
        $hasNewLesion = isset($_POST['hasNewLesion']) ? parse_bool($_POST['hasNewLesion']) : false;
        $photoFiles = self::normalizePhotoUploads($_FILES['photos'] ?? $_FILES['fotos'] ?? null);
        $photoRoles = TelemedicinePhotoTriage::normalizeRoles($_POST['photoRoles'] ?? [], count($photoFiles));

        if ($concern === '' && count($photoFiles) === 0) {
            json_response([
                'ok' => false,
                'error' => 'Describe que cambio hoy o adjunta al menos una foto nueva.',
            ], 400);
        }
        if (count($photoFiles) > self::PHOTO_MAX_COUNT) {
            json_response([
                'ok' => false,
                'error' => 'Adjunta hasta 3 fotos por pre-consulta.',
            ], 400);
        }

        $lockResult = with_store_lock(static function () use ($access, $concern, $hasNewLesion, $photoFiles, $photoRoles): array {
            $store = read_store();
            $appointment = self::findAppointmentById($store, (int) ($access['appointment']['id'] ?? 0));
            if (!is_array($appointment)) {
                return [
                    'ok' => false,
                    'error' => 'La cita ya no esta disponible para esta pre-consulta.',
                    'code' => 404,
                ];
            }
            if ($access['authMode'] === 'portal' && !self::appointmentMatchesPatient($appointment, $access['snapshot'])) {
                return [
                    'ok' => false,
                    'error' => 'No autorizado para actualizar esta cita.',
                    'code' => 403,
                ];
            }
            if (!TelemedicineChannelMapper::isTelemedicineService((string) ($appointment['service'] ?? ''))) {
                return [
                    'ok' => false,
                    'error' => 'La cita indicada no corresponde a telemedicina.',
                    'code' => 400,
                ];
            }

            $uploads = [];
            $nextUploadId = self::nextClinicalUploadId($store);
            $tenantId = trim((string) ($appointment['tenantId'] ?? ''));
            if ($tenantId === '') {
                $tenantId = get_current_tenant_id();
            }
            $existingIntake = TelemedicineRepository::findIntakeByAppointmentId($store, (int) ($appointment['id'] ?? 0));
            $existingIntakeId = (int) ($existingIntake['id'] ?? 0);

            try {
                foreach ($photoFiles as $index => $photoFile) {
                    $role = $photoRoles[$index] ?? (TelemedicinePhotoTriage::orderedRoles()[$index] ?? '');
                    $upload = self::storeClinicalPhoto(
                        $photoFile,
                        $appointment,
                        $tenantId,
                        $nextUploadId,
                        $role,
                        $existingIntakeId
                    );
                    $uploads[] = $upload;
                    $store['clinical_uploads'][] = $upload;
                    $nextUploadId += 1;
                }
            } catch (\RuntimeException $error) {
                self::cleanupStoredPhotos($uploads);
                return [
                    'ok' => false,
                    'error' => $error->getMessage(),
                    'code' => 400,
                ];
            }

            $service = new TelemedicineIntakeService();
            $result = $service->recordPatientPreConsultation($store, $appointment, [
                'concern' => $concern,
                'hasNewLesion' => $hasNewLesion,
                'uploads' => $uploads,
            ]);
            if (($result['ok'] ?? false) !== true) {
                self::cleanupStoredPhotos($uploads);
                return [
                    'ok' => false,
                    'error' => (string) ($result['error'] ?? 'No se pudo guardar la pre-consulta.'),
                    'code' => (int) ($result['code'] ?? 503),
                ];
            }

            $store = is_array($result['store'] ?? null) ? $result['store'] : $store;
            $appointment = is_array($result['appointment'] ?? null) ? $result['appointment'] : $appointment;
            $intake = is_array($result['intake'] ?? null) ? $result['intake'] : [];
            $intakeId = (int) ($intake['id'] ?? 0);

            if ($intakeId > 0 && isset($store['clinical_uploads']) && is_array($store['clinical_uploads'])) {
                foreach ($store['clinical_uploads'] as $index => $storedUpload) {
                    $storedId = (int) ($storedUpload['id'] ?? 0);
                    foreach ($uploads as $upload) {
                        if ($storedId !== (int) ($upload['id'] ?? 0)) {
                            continue;
                        }
                        $storedUpload['intakeId'] = $intakeId;
                        $store['clinical_uploads'][$index] = $storedUpload;
                        break;
                    }
                }
            }

            if (!write_store($store, false)) {
                return [
                    'ok' => false,
                    'error' => 'No se pudo guardar la pre-consulta en este momento.',
                    'code' => 503,
                ];
            }

            return [
                'ok' => true,
                'store' => $store,
                'appointment' => $appointment,
                'preConsultation' => is_array($result['preConsultation'] ?? null) ? $result['preConsultation'] : [],
            ];
        });

        $result = is_array($lockResult['result'] ?? null) ? $lockResult['result'] : $lockResult;
        if (($lockResult['ok'] ?? false) !== true || ($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo guardar la pre-consulta.'),
            ], (int) ($result['code'] ?? 503));
        }

        $savedStore = is_array($result['store'] ?? null) ? $result['store'] : read_store();
        $appointment = is_array($result['appointment'] ?? null) ? $result['appointment'] : $access['appointment'];
        $token = $access['token'] !== ''
            ? $access['token']
            : trim((string) ($appointment['rescheduleToken'] ?? ''));

        json_response([
            'ok' => true,
            'data' => array_merge(
                self::buildResponsePayload(
                    $appointment,
                    $savedStore,
                    $token,
                    is_array($result['preConsultation'] ?? null) ? $result['preConsultation'] : null
                ),
                [
                    'message' => 'Pre-consulta guardada. El medico la vera antes de entrar a la teleconsulta.',
                ]
            ),
        ]);
    }

    public static function resolveAccess(array $store, bool $allowPostBody = false): array
    {
        $token = trim((string) ($_GET['token'] ?? ($allowPostBody ? ($_POST['token'] ?? '') : '')));
        if ($token !== '') {
            $appointment = self::findAppointmentByRescheduleToken($store, $token);
            if (!is_array($appointment)) {
                json_response([
                    'ok' => false,
                    'error' => 'No encontramos una teleconsulta activa para este enlace.',
                ], 404);
            }
            if (!TelemedicineChannelMapper::isTelemedicineService((string) ($appointment['service'] ?? ''))) {
                json_response([
                    'ok' => false,
                    'error' => 'El enlace no corresponde a una teleconsulta activa.',
                ], 400);
            }

            return [
                'authMode' => 'token',
                'token' => $token,
                'appointment' => $appointment,
                'snapshot' => [],
            ];
        }

        $appointmentId = (int) ($_GET['id'] ?? ($allowPostBody ? ($_POST['appointmentId'] ?? $_POST['id'] ?? 0) : 0));
        if ($appointmentId <= 0) {
            json_response([
                'ok' => false,
                'error' => 'id o token requerido',
            ], 400);
        }

        $session = self::requirePortalSession($store);
        $snapshot = is_array($session['snapshot'] ?? null) ? $session['snapshot'] : [];
        $appointment = self::findAppointmentById($store, $appointmentId);
        if (!is_array($appointment)) {
            json_response([
                'ok' => false,
                'error' => 'Cita no encontrada',
            ], 404);
        }
        if (!self::appointmentMatchesPatient($appointment, $snapshot)) {
            json_response([
                'ok' => false,
                'error' => 'No autorizado para esta cita',
            ], 403);
        }
        if (!TelemedicineChannelMapper::isTelemedicineService((string) ($appointment['service'] ?? ''))) {
            json_response([
                'ok' => false,
                'error' => 'La cita indicada no corresponde a telemedicina.',
            ], 400);
        }

        return [
            'authMode' => 'portal',
            'token' => '',
            'appointment' => $appointment,
            'snapshot' => $snapshot,
        ];
    }

    public static function buildResponsePayload(
        array $appointment,
        array $store,
        string $token = '',
        ?array $preConsultationOverride = null
    ): array {
        $appointmentId = (int) ($appointment['id'] ?? 0);
        $intake = $appointmentId > 0 ? TelemedicineRepository::findIntakeByAppointmentId($store, $appointmentId) : null;
        $preConsultation = $preConsultationOverride;
        if (!is_array($preConsultation)) {
            $preConsultation = isset($intake['telemedicinePreConsultation']) && is_array($intake['telemedicinePreConsultation'])
                ? $intake['telemedicinePreConsultation']
                : (isset($appointment['telemedicinePreConsultation']) && is_array($appointment['telemedicinePreConsultation'])
                    ? $appointment['telemedicinePreConsultation']
                    : []);
        }

        $requestToken = $token !== '' ? $token : trim((string) ($appointment['rescheduleToken'] ?? ''));

        return [
            'appointment' => self::buildAppointmentViewModel($appointment),
            'preConsultation' => $preConsultation,
            'roomUrl' => self::buildRoomUrl($appointmentId, $requestToken),
            'preConsultationUrl' => self::buildPreConsultationUrl($appointmentId, $requestToken),
            'supportWhatsappUrl' => self::buildSupportWhatsappUrl($appointment),
            'storageReady' => internal_console_clinical_data_ready(internal_console_readiness_snapshot()),
        ];
    }

    public static function buildAppointmentViewModel(array $appointment): array
    {
        $doctorName = self::formatDoctorName(
            (string) ($appointment['doctorAssigned'] ?? ''),
            (string) ($appointment['doctorRequested'] ?? ''),
            (string) ($appointment['doctor'] ?? '')
        );
        $serviceId = trim((string) ($appointment['service'] ?? ''));
        $serviceName = trim((string) ($appointment['serviceName'] ?? ''));
        if ($serviceName === '' && $serviceId !== '') {
            $serviceName = get_service_label($serviceId);
        }

        $channel = trim((string) ($appointment['telemedicineChannel'] ?? ''));
        if ($channel === '') {
            $channel = $serviceId === 'telefono' ? 'phone' : 'secure_video';
        }

        return [
            'id' => (int) ($appointment['id'] ?? 0),
            'patientName' => trim((string) ($appointment['name'] ?? 'Paciente Aurora')),
            'serviceName' => $serviceName !== '' ? $serviceName : 'Teleconsulta Aurora Derm',
            'doctorName' => $doctorName,
            'date' => trim((string) ($appointment['date'] ?? '')),
            'time' => trim((string) ($appointment['time'] ?? '')),
            'channel' => $channel,
            'channelLabel' => $channel === 'phone' ? 'Llamada guiada' : 'Video seguro',
            'locationLabel' => $channel === 'phone'
                ? 'Llamada de telemedicina'
                : 'Sala virtual segura',
        ];
    }

    public static function buildRoomUrl(int $appointmentId, string $token): string
    {
        if ($token !== '') {
            return app_api_relative_url('telemedicine-preconsultation', ['token' => $token]);
        }
        if ($appointmentId > 0) {
            return app_api_relative_url('telemedicine-preconsultation', ['id' => (string) $appointmentId]);
        }

        return app_api_relative_url('telemedicine-preconsultation');
    }

    public static function buildPreConsultationUrl(int $appointmentId, string $token): string
    {
        if ($token !== '') {
            return app_api_relative_url('telemedicine-preconsultation', ['token' => $token]);
        }
        if ($appointmentId > 0) {
            return app_api_relative_url('telemedicine-preconsultation', ['id' => (string) $appointmentId]);
        }

        return app_api_relative_url('telemedicine-preconsultation');
    }

    public static function buildSupportWhatsappUrl(array $appointment): string
    {
        $digits = preg_replace('/\D+/', '', AppConfig::WHATSAPP_NUMBER);
        if (!is_string($digits) || $digits === '') {
            return '';
        }

        $parts = ['Hola, necesito apoyo con la pre-consulta de telemedicina de Aurora Derm.'];
        $patientName = trim((string) ($appointment['name'] ?? ''));
        if ($patientName !== '') {
            $parts[] = 'Paciente: ' . $patientName . '.';
        }
        $serviceName = trim((string) ($appointment['serviceName'] ?? get_service_label((string) ($appointment['service'] ?? 'telemedicina'))));
        $date = trim((string) ($appointment['date'] ?? ''));
        $time = trim((string) ($appointment['time'] ?? ''));
        if ($serviceName !== '' || $date !== '' || $time !== '') {
            $parts[] = 'Referencia: ' . trim($serviceName . ' ' . $date . ' ' . $time) . '.';
        }

        return 'https://wa.me/' . $digits . '?text=' . rawurlencode(implode(' ', $parts));
    }

    public static function requirePortalSession(array $store): array
    {
        $token = PatientPortalAuth::bearerTokenFromRequest();
        $auth = PatientPortalAuth::authenticateSession($store, $token);
        if (($auth['ok'] ?? false) === true) {
            return is_array($auth['data'] ?? null) ? $auth['data'] : [];
        }

        json_response([
            'ok' => false,
            'error' => (string) ($auth['error'] ?? 'No autorizado'),
            'code' => (string) ($auth['code'] ?? 'patient_portal_auth_required'),
        ], (int) ($auth['status'] ?? 401));
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

    public static function storeClinicalPhoto(
        array $file,
        array $appointment,
        string $tenantId,
        int $uploadId,
        string $photoRole,
        int $intakeId
    ): array {
        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error !== UPLOAD_ERR_OK) {
            throw new \RuntimeException('No se pudo subir una de las fotos. Codigo: ' . $error);
        }

        $tmpName = trim((string) ($file['tmp_name'] ?? ''));
        if ($tmpName === '') {
            throw new \RuntimeException('Una de las fotos no es valida.');
        }

        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0) {
            throw new \RuntimeException('Una de las fotos esta vacia.');
        }
        if ($size > self::PHOTO_MAX_BYTES) {
            throw new \RuntimeException('Cada foto debe pesar maximo 5 MB.');
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
            throw new \RuntimeException('Las fotos deben ser JPG, PNG o WEBP.');
        }
        if (!ensure_clinical_media_dir()) {
            throw new \RuntimeException('No se pudo preparar el almacenamiento clinico.');
        }

        $filename = 'telemed-pre-' . local_date('Ymd-His') . '-' . bin2hex(random_bytes(6)) . '.' . $allowed[$mime];
        $targetDiskPath = clinical_media_dir_path() . DIRECTORY_SEPARATOR . $filename;
        if (!self::moveUploadedFile($tmpName, $targetDiskPath)) {
            throw new \RuntimeException('No se pudo guardar una de las fotos.');
        }

        @chmod($targetDiskPath, 0640);
        $originalName = basename((string) ($file['name'] ?? $filename));
        $safeOriginal = preg_replace('/[^a-zA-Z0-9._ -]/', '_', $originalName);
        if (!is_string($safeOriginal) || $safeOriginal === '') {
            $safeOriginal = $filename;
        }

        $normalizedRole = TelemedicinePhotoTriage::normalizeRole($photoRole);
        if ($normalizedRole === '') {
            $normalizedRole = TelemedicinePhotoTriage::orderedRoles()[0] ?? 'zona';
        }

        return [
            'id' => max(1, $uploadId),
            'tenantId' => $tenantId,
            'intakeId' => $intakeId > 0 ? $intakeId : null,
            'appointmentId' => (int) ($appointment['id'] ?? 0),
            'patientCaseId' => trim((string) ($appointment['patientCaseId'] ?? '')),
            'kind' => ClinicalMediaService::KIND_CASE_PHOTO,
            'storageMode' => ClinicalMediaService::STORAGE_PRIVATE_CLINICAL,
            'privatePath' => 'clinical-media/' . $filename,
            'legacyPublicPath' => '',
            'legacyPublicUrl' => '',
            'mime' => $mime,
            'size' => $size,
            'sha256' => (string) (@hash_file('sha256', $targetDiskPath) ?: ''),
            'originalName' => $safeOriginal,
            'photoRole' => $normalizedRole,
            'photoRoleLabel' => TelemedicinePhotoTriage::labelForRole($normalizedRole),
            'createdAt' => local_date('c'),
            'updatedAt' => local_date('c'),
        ];
    }

    public static function cleanupStoredPhotos(array $uploads): void
    {
        foreach ($uploads as $upload) {
            $privatePath = trim((string) ($upload['privatePath'] ?? ''));
            if ($privatePath === '') {
                continue;
            }

            $targetDiskPath = clinical_media_dir_path() . DIRECTORY_SEPARATOR . basename($privatePath);
            if (is_file($targetDiskPath)) {
                @unlink($targetDiskPath);
            }
        }
    }

    public static function moveUploadedFile(string $tmpName, string $targetPath): bool
    {
        if (@move_uploaded_file($tmpName, $targetPath)) {
            return true;
        }

        if (defined('TESTING_ENV') && TESTING_ENV && is_file($tmpName)) {
            return @rename($tmpName, $targetPath) || @copy($tmpName, $targetPath);
        }

        return false;
    }

    public static function nextClinicalUploadId(array $store): int
    {
        $max = 0;
        foreach (($store['clinical_uploads'] ?? []) as $upload) {
            $max = max($max, (int) ($upload['id'] ?? 0));
        }

        return $max + 1;
    }

    public static function findAppointmentById(array $store, int $appointmentId): ?array
    {
        foreach (($store['appointments'] ?? []) as $appointment) {
            if (is_array($appointment) && (int) ($appointment['id'] ?? 0) === $appointmentId) {
                return $appointment;
            }
        }

        return null;
    }

    public static function findAppointmentByRescheduleToken(array $store, string $token): ?array
    {
        $needle = trim($token);
        if ($needle === '') {
            return null;
        }

        foreach (($store['appointments'] ?? []) as $appointment) {
            if (!is_array($appointment)) {
                continue;
            }
            if (trim((string) ($appointment['rescheduleToken'] ?? '')) === $needle) {
                return $appointment;
            }
        }

        return null;
    }

    public static function appointmentMatchesPatient(array $appointment, array $snapshot): bool
    {
        $patientPhone = trim((string) ($snapshot['phone'] ?? ''));
        $appointmentPhone = trim((string) ($appointment['whatsapp'] ?? $appointment['phone'] ?? ''));

        return $patientPhone !== ''
            && $appointmentPhone !== ''
            && PatientPortalAuth::matchesPatientPhone($appointmentPhone, $patientPhone);
    }

    public static function formatDoctorName(string ...$candidates): string
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

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:telemedicine-preconsultation':
                self::preConsultation($context);
                return;
            case 'POST:telemedicine-preconsultation':
                self::submitPreConsultation($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'preConsultation':
                            self::preConsultation($context);
                            return;
                        case 'submitPreConsultation':
                            self::submitPreConsultation($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
