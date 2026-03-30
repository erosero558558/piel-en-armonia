<?php

declare(strict_types=1);

final class ComplianceMSP
{
    /** @var array<string,string> */
    private const REQUIRED_FIELD_LABELS = [
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
        $intake = is_array($record['intake'] ?? null) ? $record['intake'] : [];
        $hcu005 = is_array($record['hcu005'] ?? null) ? $record['hcu005'] : [];
        $clinicianDraft = is_array($record['clinicianDraft'] ?? null) ? $record['clinicianDraft'] : [];

        if (self::firstNonEmpty([
            $record['patient_name'] ?? null,
            $patient['name'] ?? null,
            $patient['legalName'] ?? null,
            $patient['fullName'] ?? null,
        ]) === '') {
            $missing[] = 'patient_name';
        }
        if (self::firstNonEmpty([
            $record['patient_id'] ?? null,
            $patient['documentId'] ?? null,
            $patient['documentNumber'] ?? null,
            $patient['idDocument'] ?? null,
        ]) === '') {
            $missing[] = 'patient_id';
        }
        if (self::firstNonEmpty([
            $record['reason_for_visit'] ?? null,
            $intake['motivoConsulta'] ?? null,
            $intake['reasonForVisit'] ?? null,
        ]) === '') {
            $missing[] = 'reason_for_visit';
        }
        if (self::firstNonEmpty([
            $record['physical_exam'] ?? null,
            $hcu005['physicalExam'] ?? null,
        ]) === '') {
            $missing[] = 'physical_exam';
        }
        if (self::extractCie10Code($record, $hcu005, $intake, $clinicianDraft) === '') {
            $missing[] = 'cie10_code';
        }
        if (self::normalizeDiagnosisType(self::firstNonEmpty([
            $record['cie10_type'] ?? null,
            $record['diagnosis_type'] ?? null,
            $hcu005['diagnosisType'] ?? null,
            $hcu005['diagnosticType'] ?? null,
        ])) === '') {
            $missing[] = 'cie10_type';
        }
        if (self::firstNonEmpty([
            $record['treatment_plan'] ?? null,
            $hcu005['therapeuticPlan'] ?? null,
            $hcu005['plan'] ?? null,
            $hcu005['treatmentPlan'] ?? null,
        ]) === '') {
            $missing[] = 'treatment_plan';
        }
        if (self::firstNonEmpty([
            $record['evolution_note'] ?? null,
            $hcu005['evolutionNote'] ?? null,
        ]) === '') {
            $missing[] = 'evolution_note';
        }
        if (self::firstNonEmpty([
            $record['doctor_msp'] ?? null,
            $record['doctorMsp'] ?? null,
            is_array($record['doctor'] ?? null) ? (($record['doctor']['msp'] ?? null)) : null,
        ]) === '') {
            $missing[] = 'doctor_msp';
        }

        return $missing;
    }

    /**
     * @param array<int,string> $missingFields
     * @return array<int,string>
     */
    public static function describeMissing(array $missingFields): array
    {
        return array_values(array_map(
            static fn (string $field): string => self::REQUIRED_FIELD_LABELS[$field] ?? $field,
            array_values(array_unique($missingFields))
        ));
    }

    /**
     * @param array<int,mixed> $values
     */
    private static function firstNonEmpty(array $values): string
    {
        foreach ($values as $value) {
            $normalized = trim((string) $value);
            if ($normalized !== '') {
                return $normalized;
            }
        }

        return '';
    }

    private static function normalizeDiagnosisType(string $value): string
    {
        $normalized = strtoupper(trim($value));
        return match ($normalized) {
            'PRE', 'PRESUNTIVO' => 'PRE',
            'DEF', 'DEFINITIVO' => 'DEF',
            default => '',
        };
    }

    /**
     * @param array<string,mixed> $record
     * @param array<string,mixed> $hcu005
     * @param array<string,mixed> $intake
     * @param array<string,mixed> $clinicianDraft
     */
    private static function extractCie10Code(
        array $record,
        array $hcu005,
        array $intake,
        array $clinicianDraft
    ): string {
        $direct = self::firstNonEmpty([
            $record['cie10_code'] ?? null,
            $record['cie10Code'] ?? null,
        ]);
        if ($direct !== '') {
            return $direct;
        }

        $diagnostics = is_array($hcu005['diagnostics'] ?? null) ? $hcu005['diagnostics'] : [];
        foreach ($diagnostics as $diagnosis) {
            if (!is_array($diagnosis)) {
                continue;
            }
            $code = self::firstNonEmpty([
                $diagnosis['code'] ?? null,
                $diagnosis['cie10'] ?? null,
            ]);
            if ($code !== '') {
                return $code;
            }
        }

        $suggestions = is_array($clinicianDraft['cie10Sugeridos'] ?? null)
            ? $clinicianDraft['cie10Sugeridos']
            : (is_array($intake['cie10Sugeridos'] ?? null) ? $intake['cie10Sugeridos'] : []);

        return self::firstNonEmpty($suggestions);
    }
}
