<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

/**
 * Validation and sanitization helpers.
 */

function sanitize_phone(string $phone): string
{
    return trim($phone);
}

function validate_email(string $email): bool
{
    return $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function validate_phone(string $phone): bool
{
    $digits = preg_replace('/\D/', '', $phone);
    return is_string($digits) && strlen($digits) >= 7 && strlen($digits) <= 15;
}

function parse_bool(mixed $value): bool
{
    if (is_bool($value)) {
        return $value;
    }
    if (is_string($value)) {
        return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
    }
    if (is_int($value)) {
        return $value === 1;
    }
    return false;
}

function truncate_field(string $value, int $maxLength): string
{
    return mb_strlen($value) > $maxLength ? mb_substr($value, 0, $maxLength) : $value;
}

function normalize_string_list(mixed $value, int $maxItems = 5, int $maxLength = 300): array
{
    if (!is_array($value)) {
        return [];
    }

    $result = [];
    foreach ($value as $item) {
        if (!is_scalar($item)) {
            continue;
        }

        $text = truncate_field(trim((string) $item), $maxLength);
        if ($text === '') {
            continue;
        }

        $result[] = $text;
        if (count($result) >= $maxItems) {
            break;
        }
    }

    return $result;
}

function map_callback_status(string $status): string
{
    $normalized = strtolower(trim($status));
    if ($normalized === 'contacted') {
        return 'contactado';
    }
    if ($normalized === 'pending') {
        return 'pendiente';
    }
    return in_array($normalized, ['pendiente', 'contactado'], true) ? $normalized : 'pendiente';
}

function map_appointment_status(string $status): string
{
    $normalized = strtolower(trim($status));
    return in_array($normalized, ['confirmed', 'pending', 'cancelled', 'completed'], true)
        ? $normalized
        : 'confirmed';
}

/**
 * Validates an appointment payload.
 *
 * @param array $payload The raw appointment data.
 * @param array $availability Optional availability data to validate against.
 * @return array ['ok' => bool, 'error' => string|null]
 */
function validate_appointment_payload(array $payload, array $availability = []): array
{
    // Basic required fields
    $name = trim((string)($payload['name'] ?? ''));
    $email = trim((string)($payload['email'] ?? ''));
    $phone = trim((string)($payload['phone'] ?? ''));

    if ($name === '' || $email === '' || $phone === '') {
        return ['ok' => false, 'error' => 'Nombre, email y teléfono son obligatorios'];
    }

    if (!validate_email($email)) {
        return ['ok' => false, 'error' => 'El formato del email no es válido'];
    }

    if (!validate_phone($phone)) {
        return ['ok' => false, 'error' => 'El formato del teléfono no es válido'];
    }

    if (!isset($payload['privacyConsent']) || parse_bool($payload['privacyConsent']) !== true) {
        return ['ok' => false, 'error' => 'Debes aceptar el tratamiento de datos para reservar la cita'];
    }

    $date = (string)($payload['date'] ?? '');
    $time = (string)($payload['time'] ?? '');

    if ($date === '' || $time === '') {
        return ['ok' => false, 'error' => 'Fecha y hora son obligatorias'];
    }

    if ($date < local_date('Y-m-d')) {
        return ['ok' => false, 'error' => 'No se puede agendar en una fecha pasada'];
    }

    // Si es hoy, la hora debe ser al menos 1 hora en el futuro
    if ($date === local_date('Y-m-d')) {
        $nowMinutes = (int) local_date('H') * 60 + (int) local_date('i');
        $parts = explode(':', $time);
        $slotMinutes = (int) ($parts[0] ?? 0) * 60 + (int) ($parts[1] ?? 0);
        if ($slotMinutes <= $nowMinutes + 60) {
            return ['ok' => false, 'error' => 'Ese horario ya pasó o es muy pronto. Selecciona una hora con al menos 1 hora de anticipación, o elige otra fecha.'];
        }
    }

    // Validar que el horario exista en la disponibilidad configurada
    $availableSlots = isset($availability[$date]) && is_array($availability[$date])
        ? $availability[$date]
        : [];
    if (count($availableSlots) > 0 && !in_array($time, $availableSlots, true)) {
        return ['ok' => false, 'error' => 'Ese horario no está disponible para la fecha seleccionada'];
    }

    return ['ok' => true, 'error' => null];
}
