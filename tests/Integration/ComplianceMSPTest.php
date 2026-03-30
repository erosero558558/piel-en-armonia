<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

final class ComplianceMSPTest extends TestCase
{
    protected function setUp(): void
    {
        require_once __DIR__ . '/../../lib/clinical_history/bootstrap.php';
    }

    public function testValidateReturnsCanonicalMissingKeysForMinimalContract(): void
    {
        $missing = \ComplianceMSP::validate([
            'patient' => [],
            'intake' => [],
            'hcu005' => [],
            'doctorMsp' => '',
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

    public function testValidateAcceptsMinimalNestedClinicalRecord(): void
    {
        $missing = \ComplianceMSP::validate([
            'patient' => [
                'legalName' => 'Ana Ruiz',
                'documentNumber' => '0912345678',
            ],
            'intake' => [
                'motivoConsulta' => 'Rosacea facial',
                'cie10Sugeridos' => ['L71.9'],
            ],
            'clinicianDraft' => [
                'cie10Sugeridos' => ['L71.9'],
            ],
            'hcu005' => [
                'physicalExam' => 'Eritema centrofacial sin lesiones exudativas.',
                'diagnosisType' => 'DEF',
                'therapeuticPlan' => 'Mantener metronidazol topico y fotoproteccion.',
                'evolutionNote' => 'Paciente con mejoria parcial y sin signos de alarma.',
            ],
            'doctorMsp' => 'MSP-445566',
        ]);

        self::assertSame([], $missing);
    }
}
