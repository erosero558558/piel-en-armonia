<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/tenants.php';

/**
 * Business Logic Helpers - Sistema de Precios e IVA
 * Piel en Armonía
 */

// Tasa de IVA general (configurable via environment)
define('IVA_GENERAL_RATE', 0.15); // 15%

function default_public_reviews_enabled(): bool
{
    $raw = getenv('PIELARMONIA_DEFAULT_REVIEWS_ENABLED');
    if (!is_string($raw) || trim($raw) === '') {
        return true;
    }
    return parse_bool($raw);
}

function default_availability_enabled(): bool
{
    $raw = getenv('PIELARMONIA_DEFAULT_AVAILABILITY_ENABLED');
    if (!is_string($raw) || trim($raw) === '') {
        return false;
    }
    return parse_bool($raw);
}

function get_default_public_reviews(): array
{
    return [
        [
            'id' => 'google-jose-gancino',
            'name' => 'Jose Gancino',
            'rating' => 5,
            'text' => 'Buena atencion, solo faltan los numeros de la oficina y horarios de atencion.',
            'date' => '2025-10-01T10:00:00-05:00',
            'verified' => true
        ],
        [
            'id' => 'google-jacqueline-ruiz-torres',
            'name' => 'Jacqueline Ruiz Torres',
            'rating' => 5,
            'text' => 'Excelente atencion y economico.',
            'date' => '2025-04-15T10:00:00-05:00',
            'verified' => true
        ],
        [
            'id' => 'google-cris-lema',
            'name' => 'Cris Lema',
            'rating' => 5,
            'text' => '',
            'date' => '2025-10-10T10:00:00-05:00',
            'verified' => true
        ],
        [
            'id' => 'google-camila-escobar',
            'name' => 'Camila Escobar',
            'rating' => 5,
            'text' => '',
            'date' => '2025-02-01T10:00:00-05:00',
            'verified' => true
        ]
    ];
}

function get_default_availability(?int $days = null): array
{
    $totalDays = is_int($days) && $days > 0 ? $days : 21;
    if ($totalDays > 60) {
        $totalDays = 60;
    }

    $weekdaySlots = [
        '09:00', '09:30', '10:00', '10:30',
        '11:00', '11:30', '12:00', '12:30',
        '14:00', '14:30', '15:00', '15:30',
        '16:00', '16:30', '17:00', '17:30'
    ];

    $saturdaySlots = [
        '09:00', '09:30', '10:00', '10:30',
        '11:00', '11:30', '12:00', '12:30'
    ];

    $availability = [];
    for ($i = 0; $i < $totalDays; $i++) {
        $ts = strtotime('+' . $i . ' day');
        if ($ts === false) {
            continue;
        }

        $day = (int) date('N', $ts); // 1=Mon, 7=Sun
        if ($day === 7) {
            continue;
        }

        $date = date('Y-m-d', $ts);
        $availability[$date] = $day === 6 ? $saturdaySlots : $weekdaySlots;
    }

    return $availability;
}

function is_weekend(?string $date = null): bool
{
    if ($date === null || trim($date) === '') {
        return false;
    }
    try {
        $ts = strtotime($date);
        if ($ts === false) {
            return false;
        }
        $day = (int) date('N', $ts); // 1=Mon, 7=Sun
        return $day >= 6;
    } catch (Throwable $e) {
        return false;
    }
}

function get_dynamic_price_multiplier(?string $date = null, ?string $time = null): float
{
    if (is_weekend($date)) {
        return 1.10; // 10% recargo fines de semana
    }
    return 1.0;
}

// Configuración de servicios con tasas de IVA
function get_services_config(?string $tenantId = null): array
{
    $vat = get_vat_rate($tenantId);

    return [
        'consulta' => [
            'name' => 'Consulta Dermatológica',
            'price_base' => 40.00,
            'tax_rate' => 0.00, // IVA 0% - servicio de salud
            'category' => 'clinico',
            'is_from_price' => false
        ],
        'telefono' => [
            'name' => 'Consulta Telefónica',
            'price_base' => 25.00,
            'tax_rate' => 0.00, // IVA 0%
            'category' => 'telemedicina',
            'is_from_price' => false
        ],
        'video' => [
            'name' => 'Video Consulta',
            'price_base' => 30.00,
            'tax_rate' => 0.00, // IVA 0%
            'category' => 'telemedicina',
            'is_from_price' => false
        ],
        'laser' => [
            'name' => 'Láser Dermatológico',
            'price_base' => 150.00,
            'tax_rate' => $vat, // IVA variable - estético
            'category' => 'procedimiento',
            'is_from_price' => true
        ],
        'rejuvenecimiento' => [
            'name' => 'Rejuvenecimiento Facial',
            'price_base' => 120.00,
            'tax_rate' => $vat, // IVA variable - estético
            'category' => 'estetico',
            'is_from_price' => true
        ],
        'acne' => [
            'name' => 'Tratamiento de Acné',
            'price_base' => 80.00,
            'tax_rate' => 0.00, // IVA 0% - médico
            'category' => 'clinico',
            'is_from_price' => true
        ],
        'cancer' => [
            'name' => 'Detección de Cáncer de Piel',
            'price_base' => 70.00,
            'tax_rate' => 0.00, // IVA 0% - prevención
            'category' => 'clinico',
            'is_from_price' => true
        ]
    ];
}

/**
 * Calcula el impuesto (IVA) para un monto base
 */
function compute_tax(float $price_base, float $tax_rate): float
{
    return round($price_base * $tax_rate, 2);
}

/**
 * Calcula el total incluyendo impuestos
 */
function compute_total(float $price_base, float $tax_rate): float
{
    $tax = compute_tax($price_base, $tax_rate);
    return round($price_base + $tax, 2);
}

/**
 * Obtiene la configuración de un servicio por ID
 */
function get_service_config(string $service_id, ?string $tenantId = null): ?array
{
    $services = get_services_config($tenantId);
    return $services[$service_id] ?? null;
}

/**
 * Obtiene el precio base de un servicio (con multiplicador dinamico opcional)
 */
function get_service_price_amount(string $service, ?string $date = null, ?string $time = null, ?string $tenantId = null): float
{
    $config = get_service_config($service, $tenantId);
    $base = $config ? $config['price_base'] : 0.0;
    return $base * get_dynamic_price_multiplier($date, $time);
}

/**
 * Obtiene la tasa de IVA de un servicio
 */
function get_service_tax_rate(string $service, ?string $tenantId = null): float
{
    $config = get_service_config($service, $tenantId);
    return $config ? $config['tax_rate'] : 0.0;
}

/**
 * Obtiene el precio formateado de un servicio
 */
function get_service_price(string $service, ?string $date = null, ?string $time = null, ?string $tenantId = null): string
{
    $amount = get_service_price_amount($service, $date, $time, $tenantId);
    return '$' . number_format($amount, 2, '.', '');
}

/**
 * Obtiene el precio total incluyendo IVA
 */
function get_service_total_price(string $service, ?string $date = null, ?string $time = null, ?string $tenantId = null): string
{
    $base = get_service_price_amount($service, $date, $time, $tenantId);
    $tax_rate = get_service_tax_rate($service, $tenantId);
    $total = compute_total($base, $tax_rate);
    return '$' . number_format($total, 2, '.', '');
}

/**
 * Obtiene el desglose completo de precios de un servicio
 */
function get_service_price_breakdown(string $service, ?string $date = null, ?string $time = null, ?string $tenantId = null): array
{
    $config = get_service_config($service, $tenantId);

    if (!$config) {
        return [
            'error' => 'Servicio no encontrado',
            'service_id' => $service
        ];
    }

    $multiplier = get_dynamic_price_multiplier($date, $time);
    $base = $config['price_base'] * $multiplier;
    $tax_rate = $config['tax_rate'];
    $tax_amount = compute_tax($base, $tax_rate);
    $total = compute_total($base, $tax_rate);

    return [
        'service_id' => $service,
        'service_name' => $config['name'],
        'category' => $config['category'],
        'is_from_price' => $config['is_from_price'],
        'pricing' => [
            'base_amount' => $base,
            'multiplier' => $multiplier,
            'is_dynamic' => $multiplier !== 1.0,
            'tax_rate' => $tax_rate,
            'tax_rate_percent' => round($tax_rate * 100),
            'tax_amount' => $tax_amount,
            'total_amount' => $total
        ],
        'formatted' => [
            'base' => '$' . number_format($base, 2, '.', ''),
            'tax_amount' => '$' . number_format($tax_amount, 2, '.', ''),
            'total' => '$' . number_format($total, 2, '.', ''),
            'display' => $config['is_from_price']
                ? 'Desde $' . number_format($total, 2, '.', '')
                : '$' . number_format($total, 2, '.', '')
        ],
        'tax_label' => $tax_rate === 0.0 ? 'IVA 0%' : 'IVA ' . round($tax_rate * 100) . '% incluido'
    ];
}

/**
 * Valida que un monto de pago coincida con el servicio
 */
function validate_payment_amount(string $service, float $amount, float $tolerance = 0.01, ?string $tenantId = null): array
{
    $breakdown = get_service_price_breakdown($service, null, null, $tenantId);

    if (isset($breakdown['error'])) {
        return [
            'valid' => false,
            'error' => $breakdown['error']
        ];
    }

    $expected = $breakdown['pricing']['total_amount'];
    $difference = abs($amount - $expected);

    if ($difference <= $tolerance) {
        return [
            'valid' => true,
            'expected' => $expected,
            'received' => $amount,
            'difference' => $difference
        ];
    }

    return [
        'valid' => false,
        'error' => "Monto incorrecto. Esperado: \${$expected}, Recibido: \${$amount}",
        'expected' => $expected,
        'received' => $amount,
        'difference' => $difference
    ];
}

/**
 * Obtiene la tasa de IVA del environment (legacy support)
 */
function get_vat_rate(?string $tenantId = null): float
{
    // Future: use $tenantId to load tenant-specific settings
    $raw = getenv('PIELARMONIA_VAT_RATE');
    if (!is_string($raw) || trim($raw) === '') {
        return IVA_GENERAL_RATE;
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

// Funciones legacy mantenidas para compatibilidad
function build_appointment_index(array $appointments): array
{
    $index = [];
    foreach ($appointments as $i => $appt) {
        $date = (string) ($appt['date'] ?? '');
        if ($date === '') {
            continue;
        }
        if (!isset($index[$date])) {
            $index[$date] = [];
        }
        $index[$date][] = $i;
    }
    return $index;
}

function appointment_slot_taken(array $appointments, string $date, string $time, ?int $excludeId = null, string $doctor = '', ?array $index = null): bool
{
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
