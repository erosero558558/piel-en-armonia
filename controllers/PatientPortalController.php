<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/PatientPortalAuth.php';
require_once __DIR__ . '/../lib/business.php';

final class PatientPortalController
{
    public static function start(array $context): void
    {
        $payload = require_json_body();
        $phone = trim((string) ($payload['phone'] ?? ($payload['whatsapp'] ?? '')));

        $result = PatientPortalAuth::startLogin(
            is_array($context['store'] ?? null) ? $context['store'] : [],
            $phone
        );

        self::emit($result);
    }

    public static function complete(array $context): void
    {
        $payload = require_json_body();
        $phone = trim((string) ($payload['phone'] ?? ($payload['whatsapp'] ?? '')));
        $code = trim((string) ($payload['code'] ?? ($payload['otp'] ?? '')));
        $challengeId = trim((string) ($payload['challengeId'] ?? ''));

        $result = PatientPortalAuth::completeLogin(
            is_array($context['store'] ?? null) ? $context['store'] : [],
            $phone,
            $code,
            $challengeId
        );

        self::emit($result);
    }

    public static function status(array $context): void
    {
        $result = PatientPortalAuth::readStatus(
            is_array($context['store'] ?? null) ? $context['store'] : [],
            PatientPortalAuth::bearerTokenFromRequest()
        );

        self::emit($result);
    }

    public static function dashboard(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
        $nextAppointment = self::findNextAppointment($store, $snapshot);

        self::emit([
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'patient' => $patient,
                'nextAppointment' => $nextAppointment === []
                    ? null
                    : self::buildAppointmentSummary($nextAppointment, $patient),
                'support' => [
                    'bookingUrl' => '/#citas',
                    'historyUrl' => '/es/portal/historial/',
                    'whatsappUrl' => self::buildSupportWhatsappUrl($patient, $nextAppointment),
                ],
                'generatedAt' => local_date('c'),
            ],
        ]);
    }

    private static function findNextAppointment(array $store, array $snapshot): array
    {
        $matches = [];
        $now = time();

        foreach (($store['appointments'] ?? []) as $appointment) {
            if (!is_array($appointment) || !self::appointmentMatchesPatient($appointment, $snapshot)) {
                continue;
            }

            $status = function_exists('map_appointment_status')
                ? map_appointment_status((string) ($appointment['status'] ?? 'confirmed'))
                : strtolower(trim((string) ($appointment['status'] ?? 'confirmed')));
            if (in_array($status, ['cancelled', 'completed', 'no_show'], true)) {
                continue;
            }

            $timestamp = self::appointmentTimestamp($appointment);
            if ($timestamp === null || $timestamp < $now) {
                continue;
            }

            $matches[] = [
                'timestamp' => $timestamp,
                'appointment' => $appointment,
            ];
        }

        usort($matches, static function (array $left, array $right): int {
            return ((int) ($left['timestamp'] ?? 0)) <=> ((int) ($right['timestamp'] ?? 0));
        });

        return is_array($matches[0]['appointment'] ?? null) ? $matches[0]['appointment'] : [];
    }

    private static function appointmentMatchesPatient(array $appointment, array $snapshot): bool
    {
        $patientId = trim((string) ($snapshot['patientId'] ?? ''));
        if ($patientId !== '' && $patientId === trim((string) ($appointment['patientId'] ?? ''))) {
            return true;
        }

        $patientCaseId = trim((string) ($snapshot['patientCaseId'] ?? ''));
        if ($patientCaseId !== '' && $patientCaseId === trim((string) ($appointment['patientCaseId'] ?? ''))) {
            return true;
        }

        $lastAppointmentId = (int) ($snapshot['lastAppointmentId'] ?? 0);
        if ($lastAppointmentId > 0 && $lastAppointmentId === (int) ($appointment['id'] ?? 0)) {
            return true;
        }

        $phone = trim((string) ($snapshot['phone'] ?? ''));
        if ($phone !== '' && PatientPortalAuth::matchesPatientPhone((string) ($appointment['phone'] ?? ''), $phone)) {
            return true;
        }

        return false;
    }

    private static function appointmentTimestamp(array $appointment): ?int
    {
        $date = trim((string) ($appointment['date'] ?? ''));
        $time = trim((string) ($appointment['time'] ?? ''));
        if ($date === '' || $time === '') {
            return null;
        }

        $timestamp = strtotime($date . ' ' . $time);
        return $timestamp === false ? null : $timestamp;
    }

    private static function buildAppointmentSummary(array $appointment, array $patient): array
    {
        $serviceId = trim((string) ($appointment['service'] ?? ''));
        $tenantId = trim((string) ($appointment['tenantId'] ?? ''));
        $serviceConfig = $serviceId !== '' ? get_service_config($serviceId, $tenantId !== '' ? $tenantId : null) : null;
        $serviceName = is_array($serviceConfig)
            ? trim((string) ($serviceConfig['name'] ?? ''))
            : self::humanizeValue($serviceId, 'Consulta Aurora Derm');

        return [
            'id' => (int) ($appointment['id'] ?? 0),
            'status' => function_exists('map_appointment_status')
                ? map_appointment_status((string) ($appointment['status'] ?? 'confirmed'))
                : trim((string) ($appointment['status'] ?? 'confirmed')),
            'date' => trim((string) ($appointment['date'] ?? '')),
            'dateLabel' => self::buildDateLabel((string) ($appointment['date'] ?? '')),
            'time' => trim((string) ($appointment['time'] ?? '')),
            'timeLabel' => self::buildTimeLabel((string) ($appointment['time'] ?? '')),
            'doctorName' => self::formatDoctorName(
                (string) ($appointment['doctorAssigned'] ?? ''),
                (string) ($appointment['doctorRequested'] ?? ''),
                (string) ($appointment['doctor'] ?? '')
            ),
            'appointmentType' => self::resolveAppointmentTypeKey($appointment, $serviceConfig),
            'appointmentTypeLabel' => self::resolveAppointmentTypeLabel($appointment, $serviceConfig),
            'locationLabel' => self::resolveLocationLabel($appointment, $serviceConfig),
            'serviceId' => $serviceId,
            'serviceName' => $serviceName,
            'preparation' => self::resolvePreparationRequired($appointment, $serviceConfig),
            'rescheduleUrl' => self::buildRescheduleUrl((string) ($appointment['rescheduleToken'] ?? '')),
            'whatsappUrl' => self::buildSupportWhatsappUrl($patient, $appointment),
        ];
    }

    private static function buildRescheduleUrl(string $token): string
    {
        $token = trim($token);
        return $token !== '' ? '/?reschedule=' . rawurlencode($token) : '';
    }

    private static function buildSupportWhatsappUrl(array $patient, array $appointment): string
    {
        $digits = preg_replace('/\D+/', '', AppConfig::WHATSAPP_NUMBER);
        if (!is_string($digits) || $digits === '') {
            return '';
        }

        $patientName = trim((string) ($patient['name'] ?? 'Paciente'));
        $serviceName = self::humanizeValue((string) ($appointment['service'] ?? ''), 'mi cita');
        $date = trim((string) ($appointment['date'] ?? ''));
        $time = trim((string) ($appointment['time'] ?? ''));

        $parts = ['Hola, necesito ayuda con mi cita del portal Aurora Derm.'];
        if ($patientName !== '') {
            $parts[] = 'Paciente: ' . $patientName . '.';
        }
        if ($serviceName !== 'mi cita' || $date !== '' || $time !== '') {
            $parts[] = 'Referencia: ' . trim($serviceName . ' ' . $date . ' ' . $time) . '.';
        }

        return 'https://wa.me/' . $digits . '?text=' . rawurlencode(implode(' ', $parts));
    }

    private static function resolveAppointmentTypeKey(array $appointment, ?array $serviceConfig): string
    {
        $visitMode = strtolower(trim((string) ($appointment['visitMode'] ?? '')));
        $telemedicineChannel = strtolower(trim((string) ($appointment['telemedicineChannel'] ?? '')));
        $serviceCategory = strtolower(trim((string) ($serviceConfig['category'] ?? '')));
        $serviceId = strtolower(trim((string) ($appointment['service'] ?? '')));

        if (
            str_contains($visitMode, 'tele')
            || str_contains($visitMode, 'video')
            || str_contains($telemedicineChannel, 'video')
            || str_contains($telemedicineChannel, 'tele')
            || in_array($serviceCategory, ['telemedicina'], true)
            || in_array($serviceId, ['video', 'telefono'], true)
        ) {
            return 'telemedicine';
        }

        return 'in_person';
    }

    private static function resolveAppointmentTypeLabel(array $appointment, ?array $serviceConfig): string
    {
        if (self::resolveAppointmentTypeKey($appointment, $serviceConfig) === 'telemedicine') {
            return 'Teleconsulta';
        }

        $serviceCategory = strtolower(trim((string) ($serviceConfig['category'] ?? '')));
        if (in_array($serviceCategory, ['procedimiento', 'estetico'], true)) {
            return 'Procedimiento presencial';
        }

        return 'Consulta presencial';
    }

    private static function resolveLocationLabel(array $appointment, ?array $serviceConfig): string
    {
        if (self::resolveAppointmentTypeKey($appointment, $serviceConfig) === 'telemedicine') {
            return 'Atencion virtual por enlace seguro';
        }

        return 'Consultorio Aurora Derm';
    }

    private static function resolvePreparationRequired(array $appointment, ?array $serviceConfig): string
    {
        $serviceId = strtolower(trim((string) ($appointment['service'] ?? '')));
        $serviceName = strtolower(trim((string) ($serviceConfig['name'] ?? '')));
        $serviceCategory = strtolower(trim((string) ($serviceConfig['category'] ?? '')));
        $typeKey = self::resolveAppointmentTypeKey($appointment, $serviceConfig);
        $haystack = $serviceId . ' ' . $serviceName;

        if ($typeKey === 'telemedicine') {
            return 'Ten tu celular con buena conexion, fotos de apoyo y resultados recientes a la mano 10 minutos antes.';
        }

        if (str_contains($haystack, 'laser')) {
            return 'Llega con la piel limpia, evita bronceado reciente y no apliques cremas irritantes en la zona el mismo dia.';
        }

        if (
            str_contains($haystack, 'botox')
            || str_contains($haystack, 'peeling')
            || $serviceCategory === 'estetico'
            || $serviceCategory === 'procedimiento'
        ) {
            return 'Llega sin maquillaje en la zona a tratar y avisa si usaste retinoides, exfoliantes o recibiste otro procedimiento reciente.';
        }

        return 'Llega 10 minutos antes y trae tus medicamentos, examenes o fotos previas si ayudan a explicar la evolucion.';
    }

    private static function formatDoctorName(string ...$candidates): string
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

    private static function buildDateLabel(string $date): string
    {
        $timestamp = strtotime(trim($date) . ' 00:00:00');
        if ($timestamp === false) {
            return trim($date);
        }

        $days = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
        $months = [
            1 => 'ene',
            2 => 'feb',
            3 => 'mar',
            4 => 'abr',
            5 => 'may',
            6 => 'jun',
            7 => 'jul',
            8 => 'ago',
            9 => 'sep',
            10 => 'oct',
            11 => 'nov',
            12 => 'dic',
        ];

        $dayLabel = $days[(int) date('w', $timestamp)] ?? '';
        $monthLabel = $months[(int) date('n', $timestamp)] ?? trim((string) date('m', $timestamp));

        return trim(sprintf(
            '%s %s %s %s',
            $dayLabel,
            date('j', $timestamp),
            $monthLabel,
            date('Y', $timestamp)
        ));
    }

    private static function buildTimeLabel(string $time): string
    {
        $time = trim($time);
        if ($time === '') {
            return 'Por confirmar';
        }

        if (preg_match('/^\d{2}:\d{2}/', $time) === 1) {
            return substr($time, 0, 5);
        }

        return $time;
    }

    private static function humanizeValue(string $value, string $fallback): string
    {
        $value = trim($value);
        if ($value === '') {
            return $fallback;
        }

        $value = str_replace(['_', '-'], ' ', $value);
        if (function_exists('mb_convert_case')) {
            return mb_convert_case($value, MB_CASE_TITLE, 'UTF-8');
        }

        return ucwords(strtolower($value));
    }

    private static function emit(array $result): void
    {
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo completar la autenticacion del portal'),
                'code' => (string) ($result['code'] ?? 'patient_portal_error'),
            ], (int) ($result['status'] ?? 500));
        }

        json_response([
            'ok' => true,
            'data' => is_array($result['data'] ?? null) ? $result['data'] : [],
        ]);
    }
}
