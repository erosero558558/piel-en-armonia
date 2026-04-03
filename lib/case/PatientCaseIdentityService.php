<?php

declare(strict_types=1);

class PatientCaseIdentityService
{
public function registerIdentityKeys(array &$index, string $tenantId, string $caseId, array $identityKeys): void
    {
        foreach ($identityKeys as $identityKey) {
            $key = trim((string) $identityKey);
            if ($key === '') {
                continue;
            }
            $index[$tenantId . '|' . $key] = $caseId;
        }
    }

public function buildAppointmentIdentityKeys(array $appointment): array
    {
        $keys = [];
        $digits = preg_replace('/\D+/', '', (string) ($appointment['phone'] ?? ''));
        if (is_string($digits) && strlen($digits) >= 7) {
            $keys[] = 'phone:' . $digits;
        }
        $email = strtolower(trim((string) ($appointment['email'] ?? '')));
        if ($email !== '') {
            $keys[] = 'email:' . $email;
        }
        $name = strtolower(trim((string) ($appointment['name'] ?? '')));
        if ($name !== '' && is_string($digits) && strlen($digits) >= 4) {
            $keys[] = 'name_phone:' . $name . ':' . substr($digits, -4);
        }
        return array_values(array_unique($keys));
    }

public function buildCaseIdentityKeys(array $case): array
    {
        $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
        $keys = [];
        $digits = preg_replace(
            '/\D+/',
            '',
            (string) ($summary['contactPhone'] ?? $case['contactPhone'] ?? '')
        );
        if (is_string($digits) && strlen($digits) >= 7) {
            $keys[] = 'phone:' . $digits;
        }

        $email = strtolower(trim((string) ($summary['contactEmail'] ?? $case['contactEmail'] ?? '')));
        if ($email !== '') {
            $keys[] = 'email:' . $email;
        }

        $name = strtolower(trim((string) ($summary['patientLabel'] ?? $case['patientLabel'] ?? '')));
        if ($name !== '' && is_string($digits) && strlen($digits) >= 4) {
            $keys[] = 'name_phone:' . $name . ':' . substr($digits, -4);
        }

        return array_values(array_unique($keys));
    }

public function buildCallbackIdentityKeys(array $callback): array
    {
        $keys = [];
        $digits = preg_replace('/\D+/', '', (string) ($callback['telefono'] ?? ''));
        if (is_string($digits) && strlen($digits) >= 7) {
            $keys[] = 'phone:' . $digits;
        }
        return array_values(array_unique($keys));
    }

public function buildDeterministicId(string $prefix, array $parts): string
    {
        $seed = implode('|', array_map(static function ($value): string {
            return trim((string) $value);
        }, $parts));

        return $prefix . '_' . substr(hash('sha1', $seed), 0, 16);
    }

public function buildEventId(string $tenantId, string $caseId, string $type, string $createdAt, string $salt): string
    {
        return $this->buildDeterministicId('pte', [$tenantId, $caseId, $type, $createdAt, $salt]);
    }

public function resolveTenantId(array $store): string
    {
        foreach (['appointments', 'callbacks', 'queue_tickets', 'queue_help_requests', 'patient_cases'] as $key) {
            $records = $store[$key] ?? [];
            if (!is_array($records) || $records === []) {
                continue;
            }
            $first = $records[0];
            if (!is_array($first)) {
                continue;
            }
            $candidate = trim((string) ($first['tenantId'] ?? ''));
            if ($candidate !== '') {
                return $candidate;
            }
        }

        return get_current_tenant_id();
    }

public function resolveRecordTenantId(array $record, string $fallbackTenantId): string
    {
        $tenantId = trim((string) ($record['tenantId'] ?? ''));
        return $tenantId !== '' ? $tenantId : $fallbackTenantId;
    }

public function resolveCallbackCaseId(
        array $callback,
        string $tenantId,
        array $caseIdsByIdentity,
        array $cases
    ): string {
        $existing = trim((string) ($callback['patientCaseId'] ?? ''));
        if ($existing !== '' && isset($cases[$existing])) {
            return $existing;
        }

        foreach ($this->buildCallbackIdentityKeys($callback) as $identityKey) {
            $lookup = $tenantId . '|' . $identityKey;
            if (isset($caseIdsByIdentity[$lookup]) && isset($cases[$caseIdsByIdentity[$lookup]])) {
                return $caseIdsByIdentity[$lookup];
            }
        }

        return '';
    }

public function resolveAppointmentPatientId(array $appointment, string $tenantId): string
    {
        $existing = trim((string) ($appointment['patientId'] ?? ''));
        if ($existing !== '') {
            return $existing;
        }

        $keys = $this->buildAppointmentIdentityKeys($appointment);
        if ($keys !== []) {
            sort($keys, SORT_STRING);
            return $this->buildDeterministicId('pt', array_merge([$tenantId, 'appointment-patient'], $keys));
        }

        $appointmentId = (int) ($appointment['id'] ?? 0);
        return $this->buildDeterministicId('pt', [$tenantId, 'appointment-fallback', (string) $appointmentId]);
    }

public function resolveCallbackPatientId(array $callback, string $tenantId): string
    {
        $existing = trim((string) ($callback['patientId'] ?? ''));
        if ($existing !== '') {
            return $existing;
        }

        $keys = $this->buildCallbackIdentityKeys($callback);
        if ($keys !== []) {
            sort($keys, SORT_STRING);
            return $this->buildDeterministicId('pt', array_merge([$tenantId, 'callback-patient'], $keys));
        }

        $callbackId = (int) ($callback['id'] ?? 0);
        return $this->buildDeterministicId('pt', [$tenantId, 'callback-fallback', (string) $callbackId]);
    }

public function normalizeApprovals(array $approvals, string $tenantId): array
    {
        $normalized = [];
        foreach ($approvals as $approval) {
            if (!is_array($approval)) {
                continue;
            }
            $createdAt = $this->normalizeTimestampValue((string) ($approval['createdAt'] ?? local_date('c')), local_date('c'));
            $updatedAt = $this->normalizeTimestampValue((string) ($approval['updatedAt'] ?? $createdAt), $createdAt);
            $status = strtolower(trim((string) ($approval['status'] ?? 'pending')));
            if (!in_array($status, ['pending', 'approved', 'rejected'], true)) {
                $status = 'pending';
            }
            $normalized[] = [
                'id' => trim((string) ($approval['id'] ?? $this->buildDeterministicId('pca', [$tenantId, $createdAt, (string) count($normalized)]))),
                'tenantId' => $this->resolveRecordTenantId($approval, $tenantId),
                'patientCaseId' => trim((string) ($approval['patientCaseId'] ?? '')),
                'type' => trim((string) ($approval['type'] ?? 'ops_exception')) ?: 'ops_exception',
                'status' => $status,
                'reason' => trim((string) ($approval['reason'] ?? '')),
                'requestedBy' => trim((string) ($approval['requestedBy'] ?? 'system')) ?: 'system',
                'resolvedBy' => trim((string) ($approval['resolvedBy'] ?? '')) ?: null,
                'resolutionNotes' => trim((string) ($approval['resolutionNotes'] ?? '')) ?: null,
                'createdAt' => $createdAt,
                'updatedAt' => $updatedAt,
                'resolvedAt' => trim((string) ($approval['resolvedAt'] ?? '')) ?: null,
            ];
        }

        return $normalized;
    }

public function resolveOpenedAt(array $appointment): string
    {
        $dateBooked = trim((string) ($appointment['dateBooked'] ?? ''));
        if ($dateBooked !== '') {
            return $this->normalizeTimestampValue($dateBooked, local_date('c'));
        }

        $scheduledStart = $this->composeScheduledTimestamp(
            (string) ($appointment['date'] ?? ''),
            (string) ($appointment['time'] ?? '')
        );

        return $scheduledStart !== '' ? $scheduledStart : local_date('c');
    }

public function resolveTerminalAt(array $appointment, string $scheduledStart): string
    {
        foreach (['paymentPaidAt', 'reminderSentAt', 'dateBooked'] as $field) {
            $candidate = trim((string) ($appointment[$field] ?? ''));
            if ($candidate !== '') {
                return $this->normalizeTimestampValue($candidate, $scheduledStart !== '' ? $scheduledStart : local_date('c'));
            }
        }

        return $scheduledStart !== '' ? $scheduledStart : local_date('c');
    }

public function composeScheduledTimestamp(string $date, string $time): string
    {
        $date = trim($date);
        $time = trim($time);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !preg_match('/^\d{2}:\d{2}$/', $time)) {
            return '';
        }

        return $date . 'T' . $time . ':00';
    }

public function offsetTimestampMinutes(string $timestamp, int $minutes): string
    {
        $base = strtotime($timestamp);
        if ($base === false) {
            return $timestamp;
        }
        return date('c', $base + ($minutes * 60));
    }

public function deriveAppointmentCaseStatus(array $appointment): string
    {
        $status = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
        if ($status === 'cancelled') {
            return 'cancelled';
        }
        if ($status === 'completed') {
            return 'completed';
        }
        if ($status === 'no_show') {
            return 'no_show';
        }
        return 'booked';
    }

public function resolveCaseId(
        string $existingCaseId,
        string $tenantId,
        string $seed,
        array $identityKeys = [],
        array $caseIdsByIdentity = [],
        array $cases = []
    ): string
    {
        $existingCaseId = trim($existingCaseId);
        if ($existingCaseId !== '') {
            return $existingCaseId;
        }

        foreach ($identityKeys as $identityKey) {
            $lookup = $tenantId . '|' . trim((string) $identityKey);
            if ($lookup === $tenantId . '|' || !isset($caseIdsByIdentity[$lookup])) {
                continue;
            }

            $matchedCaseId = trim((string) $caseIdsByIdentity[$lookup]);
            if ($matchedCaseId !== '' && isset($cases[$matchedCaseId])) {
                return $matchedCaseId;
            }
        }

        [$type, $entityId] = array_pad(explode(':', $seed, 2), 2, '');
        return $this->buildDeterministicId('pc', [$tenantId, $type !== '' ? $type : 'record', $entityId]);
    }

public function firstNonEmptyString(array $values): ?string
    {
        foreach ($values as $value) {
            $value = trim((string) $value);
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

public function normalizeTimestampValue(string $value, string $fallback): string
    {
        $value = trim($value);
        if ($value === '') {
            return $fallback;
        }

        $timestamp = strtotime($value);
        if ($timestamp === false) {
            return $value;
        }

        return date('c', $timestamp);
    }

}
