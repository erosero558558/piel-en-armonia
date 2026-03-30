<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

final class ComplianceMspTest extends TestCase
{
    protected function setUp(): void
    {
        require_once __DIR__ . '/../../lib/clinical_history/ComplianceMSP.php';
    }

    public function testValidateReturnsCanonicalMissingFieldKeys(): void
    {
        $missing = \ComplianceMSP::validate([
            'patient' => [
                'name' => '',
                'documentNumber' => '',
            ],
            'intake' => [
                'motivoConsulta' => '',
            ],
            'hcu005' => [
                'evolutionNote' => '',
                'diagnosticImpression' => '',
                'therapeuticPlan' => '',
            ],
            'doctor_msp' => '',
        ]);

        self::assertSame([
            'patient_name',
            'patient_id',
            'reason_for_visit',
            'physical_exam',
            'cie10_code',
            'cie10_type',
            'treatment_plan',
            'evolution_note',
            'doctor_msp',
        ], $missing);
    }

    public function testLabelsForReturnsHumanReadableFieldNames(): void
    {
        self::assertSame([
            'Documento de identidad',
            'Registro MSP del profesional',
        ], \ComplianceMSP::labelsFor([
            'patient_id',
            'doctor_msp',
        ]));
    }
}
