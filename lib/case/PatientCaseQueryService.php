<?php

declare(strict_types=1);

final class PatientCaseQueryService
{
public static function resolveTenantId(array $store): string
    {
        foreach (['patient_cases', 'callbacks', 'appointments'] as $key) {
            $records = isset($store[$key]) && is_array($store[$key]) ? $store[$key] : [];
            foreach ($records as $record) {
                if (!is_array($record)) {
                    continue;
                }
                $tenantId = trim((string) ($record['tenantId'] ?? ''));
                if ($tenantId !== '') {
                    return $tenantId;
                }
            }
        }

        return get_current_tenant_id();
    }

public static function findReusableOpenCaseIndex(array $store, string $tenantId, string $patientId): ?int
    {
        $cases = isset($store['patient_cases']) && is_array($store['patient_cases']) ? array_values($store['patient_cases']) : [];
        foreach ($cases as $index => $case) {
            if (!is_array($case)) {
                continue;
            }
            if ((string) ($case['tenantId'] ?? '') !== $tenantId) {
                continue;
            }
            if ((string) ($case['patientId'] ?? '') !== $patientId) {
                continue;
            }

            $status = strtolower(trim((string) ($case['status'] ?? 'lead_captured')));
            if (in_array($status, ['resolved', 'closed', 'completed', 'archived', 'cancelled', 'no_show'], true)) {
                continue;
            }

            return $index;
        }

        return null;
    }

public static function findCaseIndexById(array $store, string $caseId): ?int
    {
        $cases = isset($store['patient_cases']) && is_array($store['patient_cases']) ? array_values($store['patient_cases']) : [];
        foreach ($cases as $index => $case) {
            if (is_array($case) && (string) ($case['id'] ?? '') === $caseId) {
                return $index;
            }
        }

        return null;
    }

public static function buildPatientId(string $tenantId, string $whatsapp): string
    {
        $digits = preg_replace('/\D+/', '', $whatsapp);
        $identity = is_string($digits) && $digits !== ''
            ? 'phone:' . $digits
            : 'phone:' . strtolower(trim($whatsapp));

        return self::buildEntityId('pt', [$tenantId, 'callback-patient', $identity]);
    }

public static function buildEntityId(string $prefix, array $parts): string
    {
        return strtolower($prefix) . '-' . substr(hash('sha256', implode('|', array_map(static function ($value): string {
            return trim((string) $value);
        }, $parts))), 0, 16);
    }

public static function normalizeSkinType(string $value): string
    {
        $normalized = strtolower(trim($value));
        $allowed = [
            'seca',
            'mixta',
            'grasa',
            'sensible',
            'acneica',
            'atopica',
            'normal',
        ];

        if (in_array($normalized, $allowed, true)) {
            return $normalized;
        }

        return truncate_field(sanitize_xss($normalized), 40);
    }

public static function buildCallbackPreference(string $name, string $skinType, string $condition, int $photoCount): string
    {
        $photoLabel = $photoCount > 0
            ? sprintf('%d foto%s adjunta%s', $photoCount, $photoCount === 1 ? '' : 's', $photoCount === 1 ? '' : 's')
            : 'sin fotos adjuntas';

        return truncate_field(
            sprintf(
                'Preconsulta digital de %s. Tipo de piel: %s. Motivo: %s. %s.',
                $name,
                $skinType,
                $condition,
                $photoLabel
            ),
            200
        );
    }

public static function requireClinicalStorageReady(array $data): void
    {
        $readiness = function_exists('internal_console_readiness_snapshot')
            ? internal_console_readiness_snapshot()
            : null;
        $clinicalReady = function_exists('internal_console_clinical_data_ready')
            ? internal_console_clinical_data_ready($readiness)
            : (bool) ($readiness['clinicalData']['ready'] ?? true);

        if ($clinicalReady) {
            return;
        }

        $payload = function_exists('internal_console_clinical_guard_payload')
            ? internal_console_clinical_guard_payload([
                'surface' => (string) ($data['surface'] ?? 'patient_case_intake'),
                'error' => 'La preconsulta con fotos necesita almacenamiento clínico cifrado habilitado.',
                'data' => $data,
            ])
            : [
                'ok' => false,
                'code' => 'clinical_storage_not_ready',
                'error' => 'La preconsulta con fotos necesita almacenamiento clínico cifrado habilitado.',
                'surface' => (string) ($data['surface'] ?? 'patient_case_intake'),
                'readiness' => $readiness,
                'data' => $data,
            ];

        json_response($payload, 409);
    }

}
