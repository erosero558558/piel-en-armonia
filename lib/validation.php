<?php
declare(strict_types=1);

/**
 * Validation and Normalization Helpers
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
