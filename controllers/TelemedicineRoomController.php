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
