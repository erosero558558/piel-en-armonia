<?php
declare(strict_types=1);

/**
 * Shared helpers for lightweight JSON API persistence.
 */

const DATA_DIR = __DIR__ . DIRECTORY_SEPARATOR . 'data';
const DATA_FILE = DATA_DIR . DIRECTORY_SEPARATOR . 'store.json';
const ADMIN_PASSWORD_ENV = 'PIELARMONIA_ADMIN_PASSWORD';
const ADMIN_PASSWORD_HASH_ENV = 'PIELARMONIA_ADMIN_PASSWORD_HASH';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

function ensure_data_file(): void
{
    if (!is_dir(DATA_DIR) && !mkdir(DATA_DIR, 0775, true) && !is_dir(DATA_DIR)) {
        json_response([
            'ok' => false,
            'error' => 'No se pudo crear el directorio de datos'
        ], 500);
    }

    if (!file_exists(DATA_FILE)) {
        $seed = [
            'appointments' => [],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [],
            'createdAt' => gmdate('c'),
            'updatedAt' => gmdate('c')
        ];
        file_put_contents(DATA_FILE, json_encode($seed, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
}

function read_store(): array
{
    ensure_data_file();
    $raw = file_get_contents(DATA_FILE);
    if ($raw === false || $raw === '') {
        return [
            'appointments' => [],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [],
            'updatedAt' => gmdate('c')
        ];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return [
            'appointments' => [],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [],
            'updatedAt' => gmdate('c')
        ];
    }

    $data['appointments'] = isset($data['appointments']) && is_array($data['appointments']) ? $data['appointments'] : [];
    $data['callbacks'] = isset($data['callbacks']) && is_array($data['callbacks']) ? $data['callbacks'] : [];
    $data['reviews'] = isset($data['reviews']) && is_array($data['reviews']) ? $data['reviews'] : [];
    $data['availability'] = isset($data['availability']) && is_array($data['availability']) ? $data['availability'] : [];
    $data['updatedAt'] = isset($data['updatedAt']) ? (string) $data['updatedAt'] : gmdate('c');

    return $data;
}

function write_store(array $store): void
{
    ensure_data_file();

    $store['appointments'] = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
    $store['callbacks'] = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
    $store['reviews'] = isset($store['reviews']) && is_array($store['reviews']) ? $store['reviews'] : [];
    $store['availability'] = isset($store['availability']) && is_array($store['availability']) ? $store['availability'] : [];
    $store['updatedAt'] = gmdate('c');

    $fp = fopen(DATA_FILE, 'c+');
    if ($fp === false) {
        json_response([
            'ok' => false,
            'error' => 'No se pudo abrir el archivo de datos'
        ], 500);
    }

    try {
        if (!flock($fp, LOCK_EX)) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo bloquear el archivo de datos'
            ], 500);
        }

        ftruncate($fp, 0);
        rewind($fp);
        $encoded = json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded === false || fwrite($fp, $encoded) === false) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo guardar la información'
            ], 500);
        }
        fflush($fp);
        flock($fp, LOCK_UN);
    } finally {
        fclose($fp);
    }
}

function sanitize_phone(string $phone): string
{
    return trim($phone);
}

function require_json_body(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?? '', true);
    if (!is_array($data)) {
        json_response([
            'ok' => false,
            'error' => 'JSON inválido'
        ], 400);
    }
    return $data;
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

function is_local_environment(): bool
{
    $host = isset($_SERVER['HTTP_HOST']) ? strtolower((string) $_SERVER['HTTP_HOST']) : '';
    $serverName = isset($_SERVER['SERVER_NAME']) ? strtolower((string) $_SERVER['SERVER_NAME']) : '';
    return str_contains($host, 'localhost')
        || str_contains($host, '127.0.0.1')
        || str_contains($serverName, 'localhost')
        || str_contains($serverName, '127.0.0.1');
}

function verify_admin_password(string $password): bool
{
    $hash = getenv(ADMIN_PASSWORD_HASH_ENV);
    if (is_string($hash) && $hash !== '') {
        return password_verify($password, $hash);
    }

    $plain = getenv(ADMIN_PASSWORD_ENV);
    if (is_string($plain) && $plain !== '') {
        return hash_equals($plain, $password);
    }

    if (is_local_environment()) {
        return hash_equals(DEFAULT_ADMIN_PASSWORD, $password);
    }

    return false;
}

function normalize_review(array $review): array
{
    $rating = isset($review['rating']) ? (int) $review['rating'] : 0;
    if ($rating < 1) {
        $rating = 1;
    }
    if ($rating > 5) {
        $rating = 5;
    }
    return [
        'id' => isset($review['id']) ? (int) $review['id'] : (int) round(microtime(true) * 1000),
        'name' => isset($review['name']) ? trim((string) $review['name']) : '',
        'rating' => $rating,
        'text' => isset($review['text']) ? trim((string) $review['text']) : '',
        'date' => isset($review['date']) ? (string) $review['date'] : gmdate('c'),
        'verified' => isset($review['verified']) ? parse_bool($review['verified']) : true
    ];
}

function normalize_callback(array $callback): array
{
    return [
        'id' => isset($callback['id']) ? (int) $callback['id'] : (int) round(microtime(true) * 1000),
        'telefono' => sanitize_phone((string) ($callback['telefono'] ?? '')),
        'preferencia' => (string) ($callback['preferencia'] ?? ''),
        'fecha' => isset($callback['fecha']) ? (string) $callback['fecha'] : gmdate('c'),
        'status' => map_callback_status((string) ($callback['status'] ?? 'pendiente'))
    ];
}

function normalize_appointment(array $appointment): array
{
    return [
        'id' => isset($appointment['id']) ? (int) $appointment['id'] : (int) round(microtime(true) * 1000),
        'service' => (string) ($appointment['service'] ?? ''),
        'doctor' => (string) ($appointment['doctor'] ?? ''),
        'date' => (string) ($appointment['date'] ?? ''),
        'time' => (string) ($appointment['time'] ?? ''),
        'name' => trim((string) ($appointment['name'] ?? '')),
        'email' => trim((string) ($appointment['email'] ?? '')),
        'phone' => sanitize_phone((string) ($appointment['phone'] ?? '')),
        'price' => (string) ($appointment['price'] ?? '$0.00'),
        'status' => map_appointment_status((string) ($appointment['status'] ?? 'confirmed')),
        'paymentMethod' => isset($appointment['paymentMethod']) ? (string) $appointment['paymentMethod'] : 'unpaid',
        'paymentStatus' => isset($appointment['paymentStatus']) ? (string) $appointment['paymentStatus'] : 'pending',
        'dateBooked' => isset($appointment['dateBooked']) ? (string) $appointment['dateBooked'] : gmdate('c')
    ];
}

function appointment_slot_taken(array $appointments, string $date, string $time, ?int $excludeId = null): bool
{
    foreach ($appointments as $appt) {
        $id = isset($appt['id']) ? (int) $appt['id'] : null;
        if ($excludeId !== null && $id === $excludeId) {
            continue;
        }
        $status = map_appointment_status((string) ($appt['status'] ?? 'confirmed'));
        if ($status !== 'cancelled'
            && (string) ($appt['date'] ?? '') === $date
            && (string) ($appt['time'] ?? '') === $time) {
            return true;
        }
    }
    return false;
}

function maybe_send_appointment_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = 'Piel en Armonia';
    $subject = 'Confirmacion de cita - ' . $clinicName;
    $message = "Hola " . ($appointment['name'] ?? 'paciente') . ",\n\n";
    $message .= "Tu cita fue registrada correctamente.\n";
    $message .= "Servicio: " . ($appointment['service'] ?? '-') . "\n";
    $message .= "Doctor: " . ($appointment['doctor'] ?? '-') . "\n";
    $message .= "Fecha: " . ($appointment['date'] ?? '-') . "\n";
    $message .= "Hora: " . ($appointment['time'] ?? '-') . "\n";
    $message .= "Estado de pago: " . ($appointment['paymentStatus'] ?? 'pending') . "\n\n";
    $message .= "Gracias por confiar en nosotros.";

    $from = getenv('PIELARMONIA_EMAIL_FROM');
    if (!is_string($from) || $from === '') {
        $from = 'no-reply@pielarmonia.com';
    }
    $headers = "From: {$from}\r\nContent-Type: text/plain; charset=UTF-8";

    return @mail($to, $subject, $message, $headers);
}
