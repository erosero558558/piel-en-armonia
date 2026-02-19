<?php
declare(strict_types=1);

/**
 * Business Logic Helpers
 */

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

function appointment_slot_taken(array $appointments, string $date, string $time, ?int $excludeId = null, string $doctor = '', ?array $index = null): bool
{
    // Use index if available for faster lookup
    if ($index !== null) {
        if (!isset($index[$date])) {
            return false;
        }

        foreach ($index[$date] as $idx) {
            if (!isset($appointments[$idx])) {
                continue;
            }
            $appt = $appointments[$idx];
            $id = isset($appt['id']) ? (int) $appt['id'] : null;
            if ($excludeId !== null && $id === $excludeId) {
                continue;
            }
            $status = map_appointment_status((string) ($appt['status'] ?? 'confirmed'));
            if ($status === 'cancelled') {
                continue;
            }
            if ((string) ($appt['time'] ?? '') !== $time) {
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

    foreach ($appointments as $appt) {
        if ((string) ($appt['date'] ?? '') !== $date || (string) ($appt['time'] ?? '') !== $time) {
            continue;
        }

        $id = isset($appt['id']) ? (int) $appt['id'] : null;
        if ($excludeId !== null && $id === $excludeId) {
            continue;
        }

        $rawStatus = (string) ($appt['status'] ?? 'confirmed');
        if (strcasecmp($rawStatus, 'cancelled') === 0) {
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
