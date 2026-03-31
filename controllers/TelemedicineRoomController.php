<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/PatientPortalAuth.php';

final class TelemedicineRoomController
{
    public static function token(array $context): void
    {
        $appointmentId = (int) ($_GET['id'] ?? 0);
        if ($appointmentId <= 0) {
            json_response(['ok' => false, 'error' => 'ID de cita inválido'], 400);
        }

        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $appointment = self::findAppointmentById($store, $appointmentId);

        if (!is_array($appointment)) {
            json_response(['ok' => false, 'error' => 'Cita no encontrada'], 404);
        }

        $isAdmin = ($context['isAdmin'] ?? false) === true;
        
        if ($isAdmin) {
            $role = 'moderator';
            $displayName = 'Especialista Aurora Derm';
        } else {
            // Validar sesión de portal
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

        // Generar nombre de sala único basado en el ID y un secret salt si existe, o un hash robusto.
        $salt = defined('AURORA_SECRET_KEY') && is_string(AURORA_SECRET_KEY) ? AURORA_SECRET_KEY : 'AuroraTelemed2026!';
        $roomHash = hash('sha256', $appointmentId . '|' . $salt);
        // Jitsi prefiere alfanumérico sin guiones bajos para evitar problemas a veces, pero probemos estilo CamelCase.
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
