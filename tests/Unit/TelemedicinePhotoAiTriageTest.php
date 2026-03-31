<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api-lib.php';
require_once __DIR__ . '/../../lib/telemedicine/TelemedicinePhotoAiTriage.php';

final class TelemedicinePhotoAiTriageTest extends TestCase
{
    public function testSuggestsGatherMoreInfoWhenPhotoSetIsIncomplete(): void
    {
        $result = \TelemedicinePhotoAiTriage::evaluate([
            'channel' => 'secure_video',
            'clinicalReason' => 'Control de rosacea sin cambios mayores.',
            'photoTriage' => [
                'count' => 1,
                'status' => 'partial',
                'missingRoles' => ['primer_plano', 'contexto'],
            ],
        ]);

        $this->assertSame('insufficient_data', $result['status']);
        $this->assertSame(2, $result['urgencyLevel']);
        $this->assertSame('gather_more_info', $result['suggestedConsultType']);
        $this->assertSame('pending', $result['doctorValidationStatus']);
    }

    public function testTracksDoctorValidationAgainstSuggestedRoute(): void
    {
        $triage = \TelemedicinePhotoAiTriage::evaluate([
            'channel' => 'secure_video',
            'clinicalReason' => 'Lesion que sangra y empeora rapido cerca del parpado.',
            'photoTriage' => [
                'count' => 3,
                'status' => 'complete',
                'missingRoles' => [],
            ],
            'suitability' => 'unsuitable',
        ]);

        $validated = \TelemedicinePhotoAiTriage::recordDoctorValidation(
            $triage,
            'escalate_presential',
            'Dra. Laura Mena',
            '2026-03-30T14:15:00-05:00'
        );

        $this->assertSame(5, $validated['urgencyLevel']);
        $this->assertSame('priority_in_person', $validated['suggestedConsultType']);
        $this->assertSame('validated', $validated['doctorValidationStatus']);
        $this->assertTrue((bool) ($validated['doctorValidation']['matchedSuggestion'] ?? false));
    }
}
