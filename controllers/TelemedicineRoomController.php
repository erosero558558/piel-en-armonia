<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/models.php';
require_once __DIR__ . '/../lib/PatientPortalAuth.php';
require_once __DIR__ . '/../lib/telemedicine/TelemedicineChannelMapper.php';
require_once __DIR__ . '/../lib/telemedicine/TelemedicineRepository.php';

final class TelemedicineRoomController
{
    public static function token(array $context): void
    {
        $access = self::resolveAccess($context);
        $appointment = $access['appointment'];
        $role = (string) ($access['role'] ?? 'participant');
        $displayName = (string) ($access['displayName'] ?? 'Paciente');

        $salt = defined('AURORA_SECRET_KEY') && is_string(AURORA_SECRET_KEY) ? AURORA_SECRET_KEY : 'AuroraTelemed2026!';
        $appointmentId = (int) ($appointment['id'] ?? 0);
        $roomHash = hash('sha256', $appointmentId . '|' . $salt);
        $roomName = 'AuroraDermTelemed' . $appointmentId . substr($roomHash, 0, 12);

        json_response([
            'ok' => true,
            'data' => [
                'roomName' => $roomName,
                'role' => $role,
                'displayName' => $displayName,
                'subject' => 'Consulta Telemedicina - Aurora Derm'
            ],
        ]);
    }

    public static function recordingConsent(array $context): void
    {
        $access = self::resolveAccess($context, true);
        $action = strtolower(trim((string) ($_POST['action'] ?? '')));
        $requestId = trim((string) ($_POST['requestId'] ?? ''));

        if (!in_array($action, ['request', 'grant', 'deny'], true)) {
            json_response(['ok' => false, 'error' => 'Accion de consentimiento no valida'], 400);
        }

        $lockResult = with_store_lock(function () use ($access, $action, $requestId): array {
            $store = read_store();
            $appointment = self::findAppointmentById($store, (int) ($access['appointment']['id'] ?? 0));
            if (!is_array($appointment)) {
                return [
                    'ok' => false,
                    'error' => 'Cita no encontrada',
                    'code' => 404,
                ];
            }

            if (!TelemedicineChannelMapper::isTelemedicineService((string) ($appointment['service'] ?? ''))) {
                return [
                    'ok' => false,
                    'error' => 'La cita no corresponde a telemedicina',
                    'code' => 400,
                ];
            }

            $consent = self::normalizeRecordingConsent($appointment['telemedicineRecordingConsent'] ?? [], $appointment);
            $mutation = self::mutateRecordingConsent($consent, $appointment, $access, $action, $requestId);
            if (($mutation['ok'] ?? false) !== true) {
                return $mutation;
            }

            $consent = is_array($mutation['consent'] ?? null) ? $mutation['consent'] : $consent;
            $appointment['telemedicineRecordingConsent'] = $consent;
            $appointment = normalize_appointment($appointment);
            $store = TelemedicineRepository::replaceAppointment($store, $appointment);
            $store = self::syncRecordingConsentToIntake($store, $appointment, $consent);

            $timelineEvent = is_array($mutation['timelineEvent'] ?? null) ? $mutation['timelineEvent'] : [];
            if ($timelineEvent !== []) {
                $store = self::appendCaseTimelineEvent($store, $appointment, $timelineEvent);
            }

            if (!write_store($store, false)) {
                return [
                    'ok' => false,
                    'error' => 'No se pudo guardar el consentimiento de grabacion',
                    'code' => 503,
                ];
            }

            return [
                'ok' => true,
                'store' => $store,
                'appointment' => $appointment,
                'consent' => $consent,
                'message' => (string) ($mutation['message'] ?? 'Consentimiento actualizado'),
            ];
        });

        $result = is_array($lockResult['result'] ?? null) ? $lockResult['result'] : $lockResult;
        if (($lockResult['ok'] ?? false) !== true || ($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo registrar el consentimiento'),
            ], (int) ($result['code'] ?? 503));
        }

        json_response([
            'ok' => true,
            'data' => [
                'consent' => $result['consent'] ?? [],
                'message' => (string) ($result['message'] ?? 'Consentimiento actualizado'),
            ],
        ]);
    }

    public static function uploadRecording(array $context): void
    {
        $access = self::resolveAccess($context, true);
        if (($access['role'] ?? '') !== 'moderator') {
            json_response(['ok' => false, 'error' => 'Solo el personal clinico puede archivar grabaciones'], 403);
        }
        $appointment = is_array($access['appointment'] ?? null) ? $access['appointment'] : [];

        if (!isset($_FILES['video']) || $_FILES['video']['error'] !== UPLOAD_ERR_OK) {
            json_response(['ok' => false, 'error' => 'No se recibio archivo de video valido.'], 400);
        }

        $tmpName = $_FILES['video']['tmp_name'];
        $mime = mime_content_type($tmpName);
        if (strpos($mime, 'video/') !== 0 && strpos($mime, 'application/ogg') !== 0) {
            json_response(['ok' => false, 'error' => 'El archivo no es un video valido.'], 400);
        }

        require_once __DIR__ . '/../lib/telemedicine/ClinicalMediaService.php';
        if (!function_exists('ensure_clinical_media_dir')) {
            require_once __DIR__ . '/../lib/storage.php';
        }

        ensure_clinical_media_dir();
        $ext = 'webm';
        if (strpos($mime, 'mp4') !== false) $ext = 'mp4';
        
        $filename = 'telemed-recording-' . $appointment['id'] . '-' . local_date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
        $targetDiskPath = clinical_media_dir_path() . DIRECTORY_SEPARATOR . $filename;

        if (@move_uploaded_file($tmpName, $targetDiskPath) || @rename($tmpName, $targetDiskPath)) {
            @chmod($targetDiskPath, 0640);

            $lockResult = with_store_lock(function () use ($access, $filename, $targetDiskPath, $mime): array {
                $store = read_store();
                $appointment = self::findAppointmentById($store, (int) ($access['appointment']['id'] ?? 0));
                if (!is_array($appointment)) {
                    return [
                        'ok' => false,
                        'error' => 'Cita no encontrada',
                        'code' => 404,
                    ];
                }

                $consent = self::normalizeRecordingConsent($appointment['telemedicineRecordingConsent'] ?? [], $appointment);
                if (!self::recordingConsentAllowsUpload($consent)) {
                    return [
                        'ok' => false,
                        'error' => 'La grabacion requiere consentimiento explicito de ambas partes antes de archivarse.',
                        'code' => 409,
                    ];
                }

                if ((int) ($consent['recordingUploadId'] ?? 0) > 0) {
                    return [
                        'ok' => false,
                        'error' => 'Esta teleconsulta ya tiene una grabacion archivada.',
                        'code' => 409,
                    ];
                }

                $uploadId = self::nextClinicalUploadId($store);
                $savedAt = local_date('c');
                $doctorName = (string) (($consent['doctorConsent']['displayName'] ?? '') ?: self::resolveModeratorLabel($appointment));
                $patientName = (string) (($consent['patientConsent']['displayName'] ?? '') ?: self::resolveParticipantLabel($appointment));
                $consent['status'] = 'recorded';
                $consent['recordingUploadId'] = $uploadId;
                $consent['recordingSavedAt'] = $savedAt;
                $consent['recordingMime'] = $mime;
                $consent['recordingSize'] = filesize($targetDiskPath);
                $consent['lastUpdatedAt'] = $savedAt;

                $upload = [
                    'id' => $uploadId,
                    'tenantId' => $appointment['tenantId'] ?? get_current_tenant_id(),
                    'appointmentId' => (int) $appointment['id'],
                    'patientCaseId' => $appointment['patientCaseId'] ?? '',
                    'kind' => 'telemedicine_recording',
                    'storageMode' => 'private_clinical',
                    'privatePath' => 'clinical-media/' . $filename,
                    'mime' => $mime,
                    'size' => filesize($targetDiskPath),
                    'sha256' => hash_file('sha256', $targetDiskPath),
                    'originalName' => $_FILES['video']['name'] ?? 'recording.' . pathinfo($filename, PATHINFO_EXTENSION),
                    'recordingConsentSnapshot' => $consent,
                    'recordingRequestId' => (string) ($consent['requestId'] ?? ''),
                    'recordedByRole' => 'moderator',
                    'recordedByLabel' => $doctorName,
                    'patientLabel' => $patientName,
                    'createdAt' => $savedAt,
                    'updatedAt' => $savedAt,
                ];

                $store['clinical_uploads'] = isset($store['clinical_uploads']) && is_array($store['clinical_uploads'])
                    ? array_values($store['clinical_uploads'])
                    : [];
                $store['clinical_uploads'][] = $upload;

                $appointment['telemedicineRecordingConsent'] = $consent;
                $appointment = normalize_appointment($appointment);
                $store = TelemedicineRepository::replaceAppointment($store, $appointment);
                $store = self::syncRecordingConsentToIntake($store, $appointment, $consent);
                $store = self::appendCaseTimelineEvent($store, $appointment, [
                    'type' => 'telemedicine_recording_saved',
                    'title' => 'Grabacion de teleconsulta archivada',
                    'createdAt' => $savedAt,
                    'payload' => [
                        'uploadId' => $uploadId,
                        'requestId' => (string) ($consent['requestId'] ?? ''),
                        'doctorName' => $doctorName,
                        'patientName' => $patientName,
                        'mime' => $mime,
                        'size' => (int) ($upload['size'] ?? 0),
                    ],
                ]);

                if (write_store($store, false)) {
                    return [
                        'ok' => true,
                        'consent' => $consent,
                        'upload' => $upload,
                    ];
                }

                return [
                    'ok' => false,
                    'error' => 'No se pudo registrar metadatos de grabacion',
                    'code' => 500,
                ];
            });

            $result = is_array($lockResult['result'] ?? null) ? $lockResult['result'] : $lockResult;
            if (($lockResult['ok'] ?? false) === true && ($result['ok'] ?? false) === true) {
                json_response([
                    'ok' => true,
                    'message' => 'Grabacion guardada',
                    'data' => [
                        'consent' => $result['consent'] ?? [],
                        'upload' => $result['upload'] ?? [],
                    ],
                ]);
            } else {
                @unlink($targetDiskPath);
                json_response([
                    'ok' => false,
                    'error' => (string) ($result['error'] ?? 'No se pudo registrar metadatos de grabacion'),
                ], (int) ($result['code'] ?? 500));
            }
        }

        json_response(['ok' => false, 'error' => 'No se pudo guardar la grabacion en disco'], 500);
    }

    private static function findAppointmentById(array $store, int $id): ?array
    {
        foreach (($store['appointments'] ?? []) as $appt) {
            if (is_array($appt) && (int) ($appt['id'] ?? 0) === $id) {
                return $appt;
            }
        }
        return null;
    }

    private static function findAppointmentByRescheduleToken(array $store, string $token): ?array
    {
        $needle = trim($token);
        if ($needle === '') {
            return null;
        }

        foreach (($store['appointments'] ?? []) as $appt) {
            if (is_array($appt) && trim((string) ($appt['rescheduleToken'] ?? '')) === $needle) {
                return $appt;
            }
        }

        return null;
    }

    private static function appointmentMatchesPatient(array $appointment, array $snapshot): bool
    {
        $patientPhone = trim((string) ($snapshot['phone'] ?? ''));
        $appointmentPhone = trim((string) ($appointment['whatsapp'] ?? $appointment['phone'] ?? ''));

        if ($patientPhone !== '' && $appointmentPhone !== '' && PatientPortalAuth::matchesPatientPhone($appointmentPhone, $patientPhone)) {
            return true;
        }

        return false;
    }

    private static function resolveAccess(array $context, bool $allowPostBody = false): array
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $appointmentId = (int) ($_GET['id'] ?? ($allowPostBody ? ($_POST['id'] ?? $_POST['appointmentId'] ?? 0) : 0));
        $accessToken = trim((string) ($_GET['token'] ?? ($allowPostBody ? ($_POST['token'] ?? '') : '')));
        $appointment = $accessToken !== ''
            ? self::findAppointmentByRescheduleToken($store, $accessToken)
            : self::findAppointmentById($store, $appointmentId);

        if (!is_array($appointment)) {
            json_response(['ok' => false, 'error' => 'Cita no encontrada'], 404);
        }
        if (!TelemedicineChannelMapper::isTelemedicineService((string) ($appointment['service'] ?? ''))) {
            json_response(['ok' => false, 'error' => 'La cita no corresponde a telemedicina'], 400);
        }

        $isAdmin = ($context['isAdmin'] ?? false) === true;
        if ($isAdmin) {
            return [
                'appointment' => $appointment,
                'role' => 'moderator',
                'displayName' => self::resolveModeratorLabel($appointment),
                'authMode' => 'admin',
                'token' => $accessToken,
                'snapshot' => [],
            ];
        }

        if ($accessToken !== '') {
            return [
                'appointment' => $appointment,
                'role' => 'participant',
                'displayName' => self::resolveParticipantLabel($appointment),
                'authMode' => 'token',
                'token' => $accessToken,
                'snapshot' => [],
            ];
        }

        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado para acceder a esta sala'], 401);
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];

        if (!self::appointmentMatchesPatient($appointment, $snapshot)) {
            json_response(['ok' => false, 'error' => 'No autorizado para acceder a esta cita'], 403);
        }

        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
        $displayName = trim((string) ($patient['name'] ?? ''));
        if ($displayName === '') {
            $displayName = self::resolveParticipantLabel($appointment);
        }

        return [
            'appointment' => $appointment,
            'role' => 'participant',
            'displayName' => $displayName,
            'authMode' => 'portal',
            'token' => '',
            'snapshot' => $snapshot,
        ];
    }

    private static function resolveModeratorLabel(array $appointment): string
    {
        $doctorAssigned = trim((string) ($appointment['doctorAssigned'] ?? ''));
        if ($doctorAssigned !== '') {
            return $doctorAssigned;
        }

        $doctor = trim((string) ($appointment['doctor'] ?? ''));
        if ($doctor !== '') {
            return get_doctor_label($doctor);
        }

        return 'Especialista Aurora Derm';
    }

    private static function resolveParticipantLabel(array $appointment): string
    {
        $displayName = trim((string) ($appointment['name'] ?? 'Paciente'));
        return $displayName !== '' ? $displayName : 'Paciente';
    }

    private static function normalizeRecordingConsent($value, array $appointment): array
    {
        $existing = is_array($value) ? $value : [];
        $doctor = is_array($existing['doctorConsent'] ?? null) ? $existing['doctorConsent'] : [];
        $patient = is_array($existing['patientConsent'] ?? null) ? $existing['patientConsent'] : [];

        return [
            'requestId' => trim((string) ($existing['requestId'] ?? '')),
            'status' => trim((string) ($existing['status'] ?? '')),
            'requestedAt' => trim((string) ($existing['requestedAt'] ?? '')),
            'lastUpdatedAt' => trim((string) ($existing['lastUpdatedAt'] ?? '')),
            'doctorConsent' => [
                'status' => trim((string) ($doctor['status'] ?? 'pending')),
                'displayName' => trim((string) ($doctor['displayName'] ?? self::resolveModeratorLabel($appointment))),
                'role' => 'moderator',
                'consentedAt' => trim((string) ($doctor['consentedAt'] ?? '')),
                'surface' => trim((string) ($doctor['surface'] ?? 'telemedicine_room_legacy')),
            ],
            'patientConsent' => [
                'status' => trim((string) ($patient['status'] ?? 'pending')),
                'displayName' => trim((string) ($patient['displayName'] ?? self::resolveParticipantLabel($appointment))),
                'role' => 'participant',
                'consentedAt' => trim((string) ($patient['consentedAt'] ?? '')),
                'surface' => trim((string) ($patient['surface'] ?? 'telemedicine_room_legacy')),
            ],
            'recordingUploadId' => (int) ($existing['recordingUploadId'] ?? 0),
            'recordingSavedAt' => trim((string) ($existing['recordingSavedAt'] ?? '')),
            'recordingMime' => trim((string) ($existing['recordingMime'] ?? '')),
            'recordingSize' => (int) ($existing['recordingSize'] ?? 0),
        ];
    }

    private static function mutateRecordingConsent(
        array $consent,
        array $appointment,
        array $access,
        string $action,
        string $requestId
    ): array {
        $now = local_date('c');
        $doctorLabel = self::resolveModeratorLabel($appointment);
        $patientLabel = self::resolveParticipantLabel($appointment);

        if ($action === 'request') {
            if (($access['role'] ?? '') !== 'moderator') {
                return [
                    'ok' => false,
                    'error' => 'Solo el personal clinico puede solicitar la grabacion.',
                    'code' => 403,
                ];
            }

            $newRequestId = 'trec-' . bin2hex(random_bytes(8));
            $consent['requestId'] = $newRequestId;
            $consent['status'] = 'requested';
            $consent['requestedAt'] = $now;
            $consent['lastUpdatedAt'] = $now;
            $consent['doctorConsent'] = [
                'status' => 'granted',
                'displayName' => $doctorLabel,
                'role' => 'moderator',
                'consentedAt' => $now,
                'surface' => 'telemedicine_room_legacy',
            ];
            $consent['patientConsent'] = [
                'status' => 'pending',
                'displayName' => $patientLabel,
                'role' => 'participant',
                'consentedAt' => '',
                'surface' => 'telemedicine_room_legacy',
            ];
            $consent['recordingUploadId'] = 0;
            $consent['recordingSavedAt'] = '';
            $consent['recordingMime'] = '';
            $consent['recordingSize'] = 0;

            return [
                'ok' => true,
                'consent' => $consent,
                'message' => 'Solicitud de grabacion enviada al paciente.',
                'timelineEvent' => [
                    'type' => 'telemedicine_recording_consent_requested',
                    'title' => 'Solicitud de grabacion enviada',
                    'createdAt' => $now,
                    'payload' => [
                        'requestId' => $newRequestId,
                        'doctorName' => $doctorLabel,
                        'patientName' => $patientLabel,
                    ],
                ],
            ];
        }

        if (($access['role'] ?? '') !== 'participant') {
            return [
                'ok' => false,
                'error' => 'Solo el paciente puede responder el consentimiento.',
                'code' => 403,
            ];
        }

        if (trim((string) ($consent['requestId'] ?? '')) === '' || (string) ($consent['status'] ?? '') !== 'requested') {
            return [
                'ok' => false,
                'error' => 'No hay una solicitud de grabacion pendiente para esta teleconsulta.',
                'code' => 409,
            ];
        }

        if ($requestId !== '' && $requestId !== (string) ($consent['requestId'] ?? '')) {
            return [
                'ok' => false,
                'error' => 'La solicitud de grabacion ya no coincide con la version activa.',
                'code' => 409,
            ];
        }

        $granted = $action === 'grant';
        $consent['status'] = $granted ? 'granted' : 'denied';
        $consent['lastUpdatedAt'] = $now;
        $consent['patientConsent'] = [
            'status' => $granted ? 'granted' : 'denied',
            'displayName' => $patientLabel,
            'role' => 'participant',
            'consentedAt' => $now,
            'surface' => 'telemedicine_room_legacy',
        ];

        return [
            'ok' => true,
            'consent' => $consent,
            'message' => $granted
                ? 'Consentimiento de grabacion aceptado.'
                : 'Consentimiento de grabacion rechazado.',
            'timelineEvent' => [
                'type' => $granted
                    ? 'telemedicine_recording_consent_granted'
                    : 'telemedicine_recording_consent_denied',
                'title' => $granted
                    ? 'Paciente acepto la grabacion'
                    : 'Paciente rechazo la grabacion',
                'createdAt' => $now,
                'payload' => [
                    'requestId' => (string) ($consent['requestId'] ?? ''),
                    'patientName' => $patientLabel,
                ],
            ],
        ];
    }

    private static function recordingConsentAllowsUpload(array $consent): bool
    {
        return (string) ($consent['status'] ?? '') === 'granted'
            && (string) ($consent['doctorConsent']['status'] ?? '') === 'granted'
            && (string) ($consent['patientConsent']['status'] ?? '') === 'granted';
    }

    private static function syncRecordingConsentToIntake(array $store, array $appointment, array $consent): array
    {
        $intake = TelemedicineRepository::findIntakeByAppointmentId($store, (int) ($appointment['id'] ?? 0));
        if (!is_array($intake)) {
            return $store;
        }

        $intake['telemedicineRecordingConsent'] = $consent;
        $saved = TelemedicineRepository::upsertIntake($store, $intake);
        return is_array($saved['store'] ?? null) ? $saved['store'] : $store;
    }

    private static function appendCaseTimelineEvent(array $store, array $appointment, array $event): array
    {
        $caseId = trim((string) ($appointment['patientCaseId'] ?? ''));
        if ($caseId === '') {
            return $store;
        }

        $tenantId = trim((string) ($appointment['tenantId'] ?? ''));
        if ($tenantId === '') {
            $tenantId = get_current_tenant_id();
        }

        $createdAt = trim((string) ($event['createdAt'] ?? local_date('c')));
        $type = trim((string) ($event['type'] ?? 'status_changed'));
        $payload = isset($event['payload']) && is_array($event['payload']) ? $event['payload'] : [];
        $requestKey = trim((string) ($payload['requestId'] ?? ''));
        $entityKey = trim((string) ($payload['uploadId'] ?? ''));

        $store['patient_case_timeline_events'] = isset($store['patient_case_timeline_events']) && is_array($store['patient_case_timeline_events'])
            ? array_values($store['patient_case_timeline_events'])
            : [];
        $store['patient_case_timeline_events'][] = [
            'id' => 'pct-' . substr(hash('sha256', implode('|', [
                $tenantId,
                $caseId,
                $type,
                $createdAt,
                $requestKey,
                $entityKey,
                (string) ($appointment['id'] ?? 0),
            ])), 0, 24),
            'tenantId' => $tenantId,
            'patientCaseId' => $caseId,
            'type' => $type,
            'title' => trim((string) ($event['title'] ?? 'Actualizacion de telemedicina')),
            'payload' => $payload,
            'createdAt' => $createdAt,
        ];

        return $store;
    }

    private static function nextClinicalUploadId(array $store): int
    {
        $maxUploadId = 0;
        foreach (($store['clinical_uploads'] ?? []) as $upload) {
            $maxUploadId = max($maxUploadId, (int) ($upload['id'] ?? 0));
        }

        return $maxUploadId + 1;
    }
}
