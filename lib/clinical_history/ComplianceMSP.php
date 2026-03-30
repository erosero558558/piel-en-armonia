<?php

declare(strict_types=1);

final class ComplianceMSP
{
    private const FIELD_LABELS = [
        'patient_name' => 'Nombre del paciente',
        'patient_id' => 'Documento de identidad',
        'reason_for_visit' => 'Motivo de consulta',
        'physical_exam' => 'Examen físico',
        'cie10_code' => 'Diagnóstico CIE-10',
        'cie10_type' => 'Tipo de diagnóstico (PRE / DEF)',
        'treatment_plan' => 'Plan de tratamiento',
        'evolution_note' => 'Nota de evolución clínica',
        'doctor_msp' => 'Registro MSP del profesional',
    ];

    /**
     * @param array<string,mixed> $record
     * @return array<int,string>
     */
    public static function validate(array $record): array
    {
        $missing = [];

        $patient = is_array($record['patient'] ?? null) ? $record['patient'] : [];
        if (self::trim($patient['name'] ?? $patient['fullName'] ?? $patient['legalName'] ?? '') === '') {
            $missing[] = 'patient_name';
        }
        if (self::trim($patient['documentId'] ?? $patient['idDocument'] ?? $patient['documentNumber'] ?? '') === '') {
            $missing[] = 'patient_id';
        }

        $intake = is_array($record['intake'] ?? null) ? $record['intake'] : [];
        if (self::trim($intake['motivoConsulta'] ?? $intake['reasonForVisit'] ?? '') === '') {
            $missing[] = 'reason_for_visit';
        }

        $hcu005 = is_array($record['hcu005'] ?? null) ? $record['hcu005'] : [];
        $physicalExam = self::trim(
            $hcu005['physicalExam']
                ?? $hcu005['physical_exam']
                ?? $hcu005['exam']
                ?? $hcu005['evolutionNote']
                ?? ''
        );
        if ($physicalExam === '') {
            $missing[] = 'physical_exam';
        }

        [$cie10Code, $cie10Type] = self::extractDiagnosisSignals($record, $hcu005);
        if ($cie10Code === '') {
            $missing[] = 'cie10_code';
        }
        if ($cie10Type === '') {
            $missing[] = 'cie10_type';
        }

        if (self::trim($hcu005['plan'] ?? $hcu005['treatmentPlan'] ?? $hcu005['therapeuticPlan'] ?? '') === '') {
            $missing[] = 'treatment_plan';
        }

        if (self::trim($hcu005['evolutionNote'] ?? $hcu005['evolution_note'] ?? '') === '') {
            $missing[] = 'evolution_note';
        }

        $doctorProfile = is_array($record['doctor_profile'] ?? null) ? $record['doctor_profile'] : [];
        $doctor = is_array($record['doctor'] ?? null) ? $record['doctor'] : [];
        $doctorMsp = self::trim(
            $record['doctor_msp']
                ?? $record['doctorMsp']
                ?? $doctor['msp']
                ?? $doctor['mspNumber']
                ?? $doctorProfile['msp']
                ?? $doctorProfile['mspNumber']
                ?? ''
        );
        if ($doctorMsp === '') {
            $missing[] = 'doctor_msp';
        }

        return array_values(array_unique($missing));
    }

    public static function labelForField(string $field): string
    {
        $normalized = self::trim($field);
        if ($normalized === '') {
            return '';
        }

        return self::FIELD_LABELS[$normalized] ?? $normalized;
    }

    /**
     * @param array<int,string> $fields
     * @return array<int,string>
     */
    public static function labelsFor(array $fields): array
    {
        $labels = [];
        foreach ($fields as $field) {
            $label = self::labelForField((string) $field);
            if ($label !== '') {
                $labels[] = $label;
            }
        }

        return array_values(array_unique($labels));
    }

    /**
     * @param array<string,mixed> $record
     * @param array<string,mixed> $hcu005
     * @return array{0:string,1:string}
     */
    private static function extractDiagnosisSignals(array $record, array $hcu005): array
    {
        $code = '';
        $type = '';

        $diagnostics = is_array($hcu005['diagnostics'] ?? null) ? $hcu005['diagnostics'] : [];
        foreach ($diagnostics as $diagnostic) {
            if (!is_array($diagnostic)) {
                continue;
            }

            if ($code === '') {
                $code = self::trim($diagnostic['code'] ?? $diagnostic['cie10Code'] ?? '');
            }
            if ($type === '') {
                $type = self::normalizeDiagnosisType($diagnostic['type'] ?? $diagnostic['diagnosisType'] ?? '');
            }
            if ($code !== '' && $type !== '') {
                return [$code, $type];
            }
        }

        if ($code === '') {
            $code = self::trim($record['cie10_code'] ?? $record['cie10Code'] ?? '');
        }
        if ($type === '') {
            $type = self::normalizeDiagnosisType($record['cie10_type'] ?? $record['cie10Type'] ?? '');
        }

        $diagnosticText = self::trim(
            $hcu005['diagnosticImpression']
                ?? $hcu005['diagnosis']
                ?? $record['diagnostic_impression']
                ?? ''
        );
        if ($code === '' && preg_match('/\b([A-TV-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?)\b/i', $diagnosticText, $matches) === 1) {
            $code = strtoupper((string) ($matches[1] ?? ''));
        }

        if ($type === '' && ($code !== '' || $diagnosticText !== '')) {
            // El workflow actual no captura PRE/DEF como campo dedicado en todos los formularios.
            // Tomamos DEF como fallback conservador cuando ya existe impresión diagnóstica explícita.
            $type = 'DEF';
        }

        return [$code, $type];
    }

    private static function normalizeDiagnosisType($value): string
    {
        $normalized = strtoupper(self::trim($value));
        return match ($normalized) {
            'PRE', 'PRESUNTIVO' => 'PRE',
            'DEF', 'DEFINITIVO' => 'DEF',
            default => '',
        };
    }

    private static function trim($value): string
    {
        return trim((string) $value);
    }
}
