<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../lib/telemedicine/TelemedicineConsentSnapshot.php';
require_once __DIR__ . '/../../lib/telemedicine/TelemedicineSuitabilityEvaluator.php';

final class TelemedicineSuitabilityEvaluatorTest extends TestCase
{
    public function testReturnsFitForCompleteRemoteVideoCase(): void
    {
        $result = \TelemedicineSuitabilityEvaluator::evaluate([
            'reason' => 'Brote de acne inflamatorio con empeoramiento progresivo.',
            'affectedArea' => 'rostro',
            'evolutionTime' => '3 semanas',
            'privacyConsent' => true,
            'casePhotoCount' => 2,
        ], 'secure_video');

        $this->assertSame('fit', $result['suitability']);
        $this->assertFalse($result['requiresHumanReview']);
        $this->assertSame('remote_visit', $result['escalationRecommendation']);
    }

    public function testReturnsReviewRequiredWhenTelemedicineDataIsIncomplete(): void
    {
        $result = \TelemedicineSuitabilityEvaluator::evaluate([
            'reason' => 'Acne',
            'affectedArea' => '',
            'evolutionTime' => '',
            'privacyConsent' => true,
            'casePhotoCount' => 0,
        ], 'secure_video');

        $this->assertSame('review_required', $result['suitability']);
        $this->assertTrue($result['requiresHumanReview']);
        $this->assertContains('missing_case_photos', $result['reasons']);
    }

    public function testBuildsConsentSnapshotWithVersionsAndChannel(): void
    {
        putenv('PIELARMONIA_POLICY_VERSION=2026.03');
        putenv('PIELARMONIA_MEDICAL_DISCLAIMER_VERSION=2026.03');

        $snapshot = \TelemedicineConsentSnapshot::build([
            'privacyConsent' => true,
            'privacyConsentAt' => '2026-03-03T10:00:00-05:00',
        ], 'phone', ['sourceRoute' => '/api.php?resource=payment-intent']);

        $this->assertTrue($snapshot['consentAccepted']);
        $this->assertSame('2026.03', $snapshot['policyVersion']);
        $this->assertSame('2026.03', $snapshot['medicalDisclaimerVersion']);
        $this->assertSame('phone', $snapshot['channel']);
        $this->assertSame('/api.php?resource=payment-intent', $snapshot['sourceRoute']);

        putenv('PIELARMONIA_POLICY_VERSION');
        putenv('PIELARMONIA_MEDICAL_DISCLAIMER_VERSION');
    }
}
