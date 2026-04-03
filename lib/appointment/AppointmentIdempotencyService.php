<?php

declare(strict_types=1);

final class AppointmentIdempotencyService
{
public static function resolveIdempotencyKey(array $payload): string
    {
        $candidate = '';
        if (isset($_SERVER['HTTP_IDEMPOTENCY_KEY'])) {
            $candidate = (string) $_SERVER['HTTP_IDEMPOTENCY_KEY'];
        } elseif (isset($_SERVER['HTTP_X_IDEMPOTENCY_KEY'])) {
            $candidate = (string) $_SERVER['HTTP_X_IDEMPOTENCY_KEY'];
        } elseif (isset($payload['idempotencyKey'])) {
            $candidate = (string) $payload['idempotencyKey'];
        }

        return self::normalizeIdempotencyKey($candidate);
    }

public static function normalizeIdempotencyKey(string $raw): string
    {
        $raw = trim($raw);
        if ($raw === '') {
            return '';
        }

        $safe = preg_replace('/[^A-Za-z0-9._:-]/', '', $raw);
        if (!is_string($safe)) {
            return '';
        }

        $safe = trim($safe);
        if ($safe === '' || strlen($safe) < 8) {
            return '';
        }

        if (strlen($safe) > 128) {
            $safe = substr($safe, 0, 128);
        }

        return $safe;
    }

public static function buildIdempotencyFingerprint(array $payload): string
    {
        $normalized = [
            strtolower(trim((string) ($payload['service'] ?? ''))),
            strtolower(trim((string) ($payload['doctor'] ?? ''))),
            trim((string) ($payload['date'] ?? '')),
            trim((string) ($payload['time'] ?? '')),
            trim((string) ($payload['name'] ?? '')),
            strtolower(trim((string) ($payload['email'] ?? ''))),
            preg_replace('/\D+/', '', (string) ($payload['phone'] ?? '')) ?: '',
            strtolower(trim((string) ($payload['paymentMethod'] ?? ''))),
            trim((string) ($payload['paymentIntentId'] ?? '')),
            trim((string) ($payload['transferReference'] ?? '')),
        ];

        return hash('sha256', implode('|', $normalized));
    }

public static function findAppointmentByIdempotencyKey(array $store, string $idempotencyKey): ?array
    {
        $appointments = isset($store['appointments']) && is_array($store['appointments'])
            ? $store['appointments']
            : [];
        for ($i = count($appointments) - 1; $i >= 0; $i--) {
            $appointment = $appointments[$i];
            if (!is_array($appointment)) {
                continue;
            }
            $storedKey = trim((string) ($appointment['idempotencyKey'] ?? ''));
            if ($storedKey === '' || !hash_equals($storedKey, $idempotencyKey)) {
                continue;
            }
            if (($appointment['status'] ?? '') === 'cancelled') {
                continue;
            }
            return $appointment;
        }
        return null;
    }

public static function emitIdempotencyObservability(
        string $outcome,
        string $idempotencyKey,
        string $fingerprint,
        array $appointment = []
    ): void {
        $normalizedOutcome = strtolower(trim($outcome));
        if (!in_array($normalizedOutcome, ['new', 'replay', 'conflict'], true)) {
            $normalizedOutcome = 'unknown';
        }

        if (class_exists('Metrics')) {
            Metrics::increment('booking_idempotency_events_total', [
                'outcome' => $normalizedOutcome,
            ]);
        }

        if (function_exists('audit_log_event')) {
            $keyHash = hash('sha256', $idempotencyKey);
            audit_log_event('booking.idempotency.' . $normalizedOutcome, [
                'outcome' => $normalizedOutcome,
                'idempotencyKeyHash' => $keyHash,
                'idempotencyFingerprint' => $fingerprint !== '' ? substr($fingerprint, 0, 24) : '',
                'appointmentId' => (int) ($appointment['id'] ?? 0),
                'doctor' => (string) ($appointment['doctor'] ?? ''),
                'service' => (string) ($appointment['service'] ?? ''),
                'date' => (string) ($appointment['date'] ?? ''),
                'time' => (string) ($appointment['time'] ?? ''),
            ]);
        }
    }

}
