<?php
declare(strict_types=1);

/**
 * Business logic and data models.
 */

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
        'name' => truncate_field(isset($review['name']) ? trim((string) $review['name']) : '', 100),
        'rating' => $rating,
        'text' => truncate_field(isset($review['text']) ? trim((string) $review['text']) : '', 2000),
        'date' => isset($review['date']) ? (string) $review['date'] : local_date('c'),
        'verified' => isset($review['verified']) ? parse_bool($review['verified']) : true
    ];
}

function normalize_callback(array $callback): array
{
    return [
        'id' => isset($callback['id']) ? (int) $callback['id'] : (int) round(microtime(true) * 1000),
        'telefono' => truncate_field(sanitize_phone((string) ($callback['telefono'] ?? '')), 20),
        'preferencia' => truncate_field((string) ($callback['preferencia'] ?? ''), 200),
        'fecha' => isset($callback['fecha']) ? (string) $callback['fecha'] : local_date('c'),
        'status' => map_callback_status((string) ($callback['status'] ?? 'pendiente'))
    ];
}

function get_vat_rate(): float
{
    $raw = getenv('PIELARMONIA_VAT_RATE');
    if (!is_string($raw) || trim($raw) === '') {
        return 0.12;
    }

    $rate = (float) trim($raw);
    if ($rate > 1.0 && $rate <= 100.0) {
        $rate = $rate / 100.0;
    }

    if ($rate < 0.0) {
        return 0.0;
    }
    if ($rate > 1.0) {
        return 1.0;
    }
    return $rate;
}

function get_service_price_amount(string $service): float
{
    $prices = [
        'consulta' => 40.00,
        'telefono' => 25.00,
        'video' => 30.00,
        'laser' => 150.00,
        'rejuvenecimiento' => 120.00
    ];
    return isset($prices[$service]) ? (float) $prices[$service] : 0.0;
}

function get_service_price(string $service): string
{
    return '$' . number_format(get_service_price_amount($service), 2, '.', '');
}

function get_service_total_price(string $service): string
{
    $subtotal = get_service_price_amount($service);
    $total = $subtotal + ($subtotal * get_vat_rate());
    return '$' . number_format($total, 2, '.', '');
}

function get_service_label(string $service): string
{
    $labels = [
        'consulta' => 'Consulta Presencial',
        'telefono' => 'Consulta Telefonica',
        'video' => 'Video Consulta',
        'laser' => 'Tratamiento Laser',
        'rejuvenecimiento' => 'Rejuvenecimiento'
    ];
    return $labels[$service] ?? $service;
}

function get_doctor_label(string $doctor): string
{
    $labels = [
        'rosero' => 'Dr. Javier Rosero',
        'narvaez' => 'Dra. Carolina Narvaez',
        'indiferente' => 'Cualquiera disponible'
    ];
    return $labels[$doctor] ?? $doctor;
}

function get_payment_method_label(string $method): string
{
    $labels = [
        'cash' => 'Efectivo (en consultorio)',
        'card' => 'Tarjeta de credito/debito',
        'transfer' => 'Transferencia bancaria',
        'unpaid' => 'Pendiente'
    ];
    return $labels[$method] ?? $method;
}

function get_payment_status_label(string $status): string
{
    $labels = [
        'paid' => 'Pagado',
        'pending_cash' => 'Pendiente - pago en consultorio',
        'pending_transfer_review' => 'Pendiente - verificando transferencia',
        'pending' => 'Pendiente'
    ];
    return $labels[$status] ?? $status;
}

function format_date_label(string $date): string
{
    $ts = strtotime($date);
    if ($ts === false) {
        return $date;
    }
    $dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    $meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    $dow = (int) date('w', $ts);
    $day = (int) date('j', $ts);
    $month = (int) date('n', $ts) - 1;
    $year = date('Y', $ts);
    return ucfirst($dias[$dow]) . ' ' . $day . ' de ' . $meses[$month] . ' de ' . $year;
}

function normalize_appointment(array $appointment): array
{
    $service = (string) ($appointment['service'] ?? '');
    $paymentMethod = strtolower(trim((string) ($appointment['paymentMethod'] ?? 'unpaid')));
    if (!in_array($paymentMethod, ['card', 'transfer', 'cash', 'unpaid'], true)) {
        $paymentMethod = 'unpaid';
    }

    $paymentStatus = trim((string) ($appointment['paymentStatus'] ?? 'pending'));
    if ($paymentStatus === '') {
        $paymentStatus = 'pending';
    }

    $privacyConsent = isset($appointment['privacyConsent']) ? parse_bool($appointment['privacyConsent']) : false;
    $privacyConsentAtDefault = $privacyConsent ? local_date('c') : '';
    $casePhotoNames = normalize_string_list($appointment['casePhotoNames'] ?? [], 3, 200);
    $casePhotoUrls = normalize_string_list($appointment['casePhotoUrls'] ?? [], 3, 500);
    $casePhotoPaths = normalize_string_list($appointment['casePhotoPaths'] ?? [], 3, 500);
    $casePhotoCount = isset($appointment['casePhotoCount']) ? (int) $appointment['casePhotoCount'] : count($casePhotoUrls);
    if ($casePhotoCount < 0) {
        $casePhotoCount = 0;
    }
    if ($casePhotoCount > 3) {
        $casePhotoCount = 3;
    }

    return [
        'id' => isset($appointment['id']) ? (int) $appointment['id'] : (int) round(microtime(true) * 1000),
        'service' => truncate_field($service, 50),
        'doctor' => truncate_field((string) ($appointment['doctor'] ?? ''), 100),
        'date' => truncate_field((string) ($appointment['date'] ?? ''), 20),
        'time' => truncate_field((string) ($appointment['time'] ?? ''), 10),
        'name' => truncate_field(trim((string) ($appointment['name'] ?? '')), 150),
        'email' => truncate_field(trim((string) ($appointment['email'] ?? '')), 254),
        'phone' => truncate_field(sanitize_phone((string) ($appointment['phone'] ?? '')), 20),
        'reason' => truncate_field(trim((string) ($appointment['reason'] ?? '')), 1000),
        'affectedArea' => truncate_field(trim((string) ($appointment['affectedArea'] ?? '')), 100),
        'evolutionTime' => truncate_field(trim((string) ($appointment['evolutionTime'] ?? '')), 100),
        'privacyConsent' => $privacyConsent,
        'privacyConsentAt' => truncate_field(trim((string) ($appointment['privacyConsentAt'] ?? $privacyConsentAtDefault)), 30),
        'casePhotoCount' => $casePhotoCount,
        'casePhotoNames' => $casePhotoNames,
        'casePhotoUrls' => $casePhotoUrls,
        'casePhotoPaths' => $casePhotoPaths,
        'price' => get_service_total_price($service),
        'status' => map_appointment_status((string) ($appointment['status'] ?? 'confirmed')),
        'paymentMethod' => $paymentMethod,
        'paymentStatus' => $paymentStatus,
        'paymentProvider' => truncate_field(trim((string) ($appointment['paymentProvider'] ?? '')), 50),
        'paymentIntentId' => truncate_field(trim((string) ($appointment['paymentIntentId'] ?? '')), 100),
        'paymentPaidAt' => truncate_field(trim((string) ($appointment['paymentPaidAt'] ?? '')), 30),
        'transferReference' => truncate_field(trim((string) ($appointment['transferReference'] ?? '')), 100),
        'transferProofPath' => truncate_field(trim((string) ($appointment['transferProofPath'] ?? '')), 300),
        'transferProofUrl' => truncate_field(trim((string) ($appointment['transferProofUrl'] ?? '')), 300),
        'transferProofName' => truncate_field(trim((string) ($appointment['transferProofName'] ?? '')), 200),
        'transferProofMime' => truncate_field(trim((string) ($appointment['transferProofMime'] ?? '')), 50),
        'dateBooked' => isset($appointment['dateBooked']) ? (string) $appointment['dateBooked'] : local_date('c'),
        'rescheduleToken' => isset($appointment['rescheduleToken']) && $appointment['rescheduleToken'] !== ''
            ? (string) $appointment['rescheduleToken']
            : bin2hex(random_bytes(16)),
        'reminderSentAt' => truncate_field(trim((string) ($appointment['reminderSentAt'] ?? '')), 30)
    ];
}

function appointment_slot_taken(array $appointments, string $date, string $time, ?int $excludeId = null, string $doctor = ''): bool
{
    foreach ($appointments as $appt) {
        $id = isset($appt['id']) ? (int) $appt['id'] : null;
        if ($excludeId !== null && $id === $excludeId) {
            continue;
        }
        $status = map_appointment_status((string) ($appt['status'] ?? 'confirmed'));
        if ($status === 'cancelled') {
            continue;
        }
        if ((string) ($appt['date'] ?? '') !== $date || (string) ($appt['time'] ?? '') !== $time) {
            continue;
        }
        if ($doctor !== '' && $doctor !== 'indiferente') {
            $apptDoctor = (string) ($appt['doctor'] ?? '');
            if ($apptDoctor !== '' && $apptDoctor !== 'indiferente' && $apptDoctor !== $doctor) {
                continue;
            }
        }
        return true;
    }
    return false;
}
