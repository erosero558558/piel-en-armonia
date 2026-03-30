<?php

declare(strict_types=1);

final class ComplianceMSP
{
    /**
     * @param array<string,mixed> $record
     * @return array<int,string>
     */
    public static function validate(array $record): array
    {
        $missing = [];
        
        $patient = is_array($record['patient'] ?? null) ? $record['patient'] : [];
        if (trim((string) ($patient['name'] ?? '')) === '') {
            $missing[] = 'Nombre del paciente';
        }
        if (trim((string) ($patient['documentId'] ?? $patient['idDocument'] ?? '')) === '') {
            $missing[] = 'Documento de identidad';
        }
        
        $intake = is_array($record['intake'] ?? null) ? $record['intake'] : [];
        if (trim((string) ($intake['motivoConsulta'] ?? $intake['reasonForVisit'] ?? '')) === '') {
            $missing[] = 'Motivo de consulta';
        }
        if (trim((string) ($intake['antecedentesPersonales'] ?? '')) === '' && trim((string) ($intake['antecedentesFamiliares'] ?? '')) === '') {
            $missing[] = 'Antecedentes (personales o familiares)';
        }
        if (trim((string) ($intake['medicacionActual'] ?? $intake['medications'] ?? '')) === '') {
            $missing[] = 'Medicación actual';
        }
        if (trim((string) ($intake['alergias'] ?? $intake['allergies'] ?? '')) === '') {
            $missing[] = 'Alergias conocidas';
        }

        $hcu005 = is_array($record['hcu005'] ?? null) ? $record['hcu005'] : [];
        if (trim((string) ($hcu005['physicalExam'] ?? '')) === '') {
            $missing[] = 'Examen físico';
        }

        $diagnostics = is_array($hcu005['diagnostics'] ?? null) ? $hcu005['diagnostics'] : [];
        $hasDiag = false;
        $hasDiagType = false;
        foreach ($diagnostics as $d) {
            if (is_array($d)) {
                if (trim((string) ($d['code'] ?? '')) !== '') {
                    $hasDiag = true;
                }
                if (in_array(trim(strtoupper((string) ($d['type'] ?? ''))), ['PRE', 'DEF', 'PRESUNTIVO', 'DEFINITIVO'])) {
                    $hasDiagType = true;
                }
            }
        }
        if (!$hasDiag) {
            $missing[] = 'Diagnóstico CIE-10';
        }
        if (!$hasDiagType) {
            $missing[] = 'Tipo de diagnóstico (PRE / DEF)';
        }

        if (trim((string) ($hcu005['plan'] ?? $hcu005['treatmentPlan'] ?? '')) === '') {
            $missing[] = 'Plan de tratamiento';
        }

        if (trim((string) ($hcu005['evolutionNote'] ?? '')) === '') {
            $missing[] = 'Nota de evolución clínica';
        }

        if (trim((string) ($record['doctor'] ?? $record['doctorMsp'] ?? '')) === '') {
            $missing[] = 'Firma / Registro del profesional';
        }

        return $missing;
    }
}
