<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/PatientPortalAuth.php';
require_once __DIR__ . '/../lib/telemedicine/TelemedicineChannelMapper.php';

final class TelemedicineRoomController
{
    public static function token(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $accessToken = trim((string) ($_GET['token'] ?? ''));
        $appointment = $accessToken !== ''
            ? self::findAppointmentByRescheduleToken($store, $accessToken)
            : self::findAppointmentById($store, (int) ($_GET['id'] ?? 0));

        if (!is_array($appointment)) {
            json_response(['ok' => false, 'error' => 'Cita no encontrada'], 404);
        }
        if (!TelemedicineChannelMapper::isTelemedicineService((string) ($appointment['service'] ?? ''))) {
            json_response(['ok' => false, 'error' => 'La cita no corresponde a telemedicina'], 400);
        }

        $isAdmin = ($context['isAdmin'] ?? false) === true;

        if ($isAdmin) {
            $role = 'moderator';
            $displayName = 'Especialista Aurora Derm';
        } elseif ($accessToken !== '') {
            $role = 'participant';
            $displayName = trim((string) ($appointment['name'] ?? 'Paciente'));
            if ($displayName === '') {
                $displayName = 'Paciente';
            }
        } else {
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

            $role = 'participant';
            $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
            $displayName = trim((string) ($patient['name'] ?? 'Paciente'));
        }

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

    
    public static function uploadRecording(array $context): void
    {
        error_reporting(E_ALL);
        ini_set('display_errors', '1');

        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $appointmentId = (int) ($_GET['id'] ?? $_POST['id'] ?? 0);
        $token = trim((string) ($_GET['token'] ?? $_POST['token'] ?? ''));

        $appointment = $appointmentId > 0 
            ? self::findAppointmentById($store, $appointmentId)
            : ($token !== '' ? self::findAppointmentByRescheduleToken($store, $token) : null);

        if (!is_array($appointment)) {
            json_response(['ok' => false, 'error' => 'Cita no encontrada'], 404);
        }

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
            
            $lockResult = with_store_lock(function() use ($appointment, $filename, $targetDiskPath, $mime) {
                $store = read_store();
                $maxUploadId = 0;
                foreach (($store['clinical_uploads'] ?? []) as $u) {
                    $maxUploadId = max($maxUploadId, (int) ($u['id'] ?? 0));
                }

                $upload = [
                    'id' => $maxUploadId + 1,
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
                    'createdAt' => local_date('c'),
                    'updatedAt' => local_date('c'),
                ];

                if (!isset($store['clinical_uploads'])) {
                    $store['clinical_uploads'] = [];
                }
                $store['clinical_uploads'][] = $upload;
                
                if (write_store($store, false)) {
                    return ['ok' => true];
                }
                return ['ok' => false];
            });

            if (($lockResult['ok'] ?? false) === true) {
                json_response(['ok' => true, 'message' => 'Grabacion guardada']);
            } else {
                json_response(['ok' => false, 'error' => 'No se pudo registrar metadatos de grabacion'], 500);
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
}
