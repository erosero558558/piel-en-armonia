<?php

declare(strict_types=1);

require_once __DIR__ . '/../audit.php';
require_once __DIR__ . '/../metrics.php';
require_once __DIR__ . '/TelemedicineChannelMapper.php';
require_once __DIR__ . '/TelemedicineRepository.php';
require_once __DIR__ . '/TelemedicineConsentSnapshot.php';
require_once __DIR__ . '/TelemedicineSuitabilityEvaluator.php';
require_once __DIR__ . '/TelemedicineEncounterPlanner.php';
require_once __DIR__ . '/ClinicalMediaService.php';

final class TelemedicineIntakeService
{
    public function shadowModeEnabled(): bool
    {
        $raw = getenv('PIELARMONIA_TELEMED_V2_SHADOW');
        if (!is_string($raw) || trim($raw) === '') {
            return true;
        }

        return parse_bool($raw);
    }

    public function createOrUpdateDraft(array $store, array $appointment, array $paymentIntent = []): array
    {
        if (!$this->shadowModeEnabled()) {
            return ['store' => $store, 'appointment' => $appointment, 'intake' => null];
        }

        $service = (string) ($appointment['service'] ?? '');
        if (!TelemedicineChannelMapper::isTelemedicineService($service)) {
            return ['store' => $store, 'appointment' => $appointment, 'intake' => null];
        }

        $channel = TelemedicineChannelMapper::mapServiceToChannel($service);
        $existing = TelemedicineRepository::findDraftByFingerprint($store, $appointment);
        $intake = $this->buildBaseIntake($appointment, $channel, $existing);
        $intake['status'] = 'awaiting_payment';
        $intake['paymentContext'] = [
            'method' => (string) ($appointment['paymentMethod'] ?? 'card'),
            'status' => (string) ($paymentIntent['status'] ?? 'requires_confirmation'),
            'paymentIntentId' => (string) ($paymentIntent['id'] ?? ''),
        ];
        $intake['draftFingerprint'] = TelemedicineRepository::draftFingerprint($appointment);
        $intake['consentSnapshot'] = TelemedicineConsentSnapshot::build($appointment, $channel, [
            'sourceRoute' => '/api.php?resource=payment-intent',
        ]);
        $suitability = TelemedicineSuitabilityEvaluator::evaluate($appointment, $channel);
        $intake['suitability'] = $suitability['suitability'];
        $intake['suitabilityReasons'] = $suitability['reasons'];
        $intake['reviewRequired'] = $suitability['requiresHumanReview'];
        $intake['escalationRecommendation'] = $suitability['escalationRecommendation'];
        $intake['encounterPlan'] = TelemedicineEncounterPlanner::build($intake);

        $result = TelemedicineRepository::upsertIntake($store, $intake);
        $intake = $result['intake'];
        $store = $result['store'];

        $this->emitAuditAndMetrics('telemedicine.intake_created', $intake);
        $this->emitSuitability($intake);

        return ['store' => $store, 'appointment' => $appointment, 'intake' => $intake];
    }

    public function finalizeBooking(array $store, array $appointment): array
    {
        if (!$this->shadowModeEnabled()) {
            return ['store' => $store, 'appointment' => $appointment, 'intake' => null];
        }

        $service = (string) ($appointment['service'] ?? '');
        if (!TelemedicineChannelMapper::isTelemedicineService($service)) {
            return ['store' => $store, 'appointment' => $appointment, 'intake' => null];
        }

        $channel = TelemedicineChannelMapper::mapServiceToChannel($service);
        $existing = TelemedicineRepository::findDraftByFingerprint($store, $appointment);
        if (!is_array($existing)) {
            $existing = TelemedicineRepository::findIntakeByAppointmentId($store, (int) ($appointment['id'] ?? 0));
        }

        $intake = $this->buildBaseIntake($appointment, $channel, $existing);
        $firstSave = TelemedicineRepository::upsertIntake($store, $intake);
        $store = $firstSave['store'];
        $intake = $firstSave['intake'];

        $claim = ClinicalMediaService::claimAppointmentUploads($store, $appointment, (int) ($intake['id'] ?? 0));
        $store = $claim['store'];
        $appointment = $claim['appointment'];

        $suitability = TelemedicineSuitabilityEvaluator::evaluate($appointment, $channel);
        $intake['clinicalMediaIds'] = $appointment['clinicalMediaIds'] ?? [];
        $intake['consentSnapshot'] = TelemedicineConsentSnapshot::build($appointment, $channel, [
            'sourceRoute' => '/api.php?resource=appointments',
        ]);
        $intake['suitability'] = $suitability['suitability'];
        $intake['suitabilityReasons'] = $suitability['reasons'];
        $intake['reviewRequired'] = $suitability['requiresHumanReview'];
        $intake['escalationRecommendation'] = $suitability['escalationRecommendation'];
        $intake['linkedAppointmentId'] = (int) ($appointment['id'] ?? 0);
        $intake['paymentContext'] = [
            'method' => (string) ($appointment['paymentMethod'] ?? 'unpaid'),
            'status' => (string) ($appointment['paymentStatus'] ?? 'pending'),
            'paymentIntentId' => (string) ($appointment['paymentIntentId'] ?? ''),
            'transferReference' => (string) ($appointment['transferReference'] ?? ''),
        ];
        $intake['status'] = $this->resolveBookedStatus($suitability);
        $intake['encounterPlan'] = TelemedicineEncounterPlanner::build($intake);

        $secondSave = TelemedicineRepository::upsertIntake($store, $intake);
        $store = $secondSave['store'];
        $intake = $secondSave['intake'];

        $appointment['telemedicineIntakeId'] = (int) ($intake['id'] ?? 0);
        $appointment['telemedicineChannel'] = (string) ($intake['channel'] ?? '');
        $appointment['telemedicineSuitability'] = (string) ($intake['suitability'] ?? 'review_required');
        $appointment['telemedicineSuitabilityReasons'] = $intake['suitabilityReasons'] ?? [];
        $appointment['telemedicineReviewRequired'] = (bool) ($intake['reviewRequired'] ?? false);
        $appointment['telemedicineEscalationRecommendation'] = (string) ($intake['escalationRecommendation'] ?? 'manual_review');
        $appointment['telemedicineConsentSnapshot'] = $intake['consentSnapshot'] ?? [];
        $appointment['telemedicineEncounterPlan'] = $intake['encounterPlan'] ?? [];
        $appointment['visitMode'] = TelemedicineChannelMapper::visitMode($channel);
        $appointment['supportContactMethod'] = TelemedicineChannelMapper::supportContactMethod($appointment);

        $this->emitAuditAndMetrics('telemedicine.booking_linked', $intake);
        $this->emitSuitability($intake);
        if (!empty($intake['escalationRecommendation']) && $intake['escalationRecommendation'] !== 'remote_visit') {
            audit_log_event('telemedicine.escalation_recommended', [
                'intakeId' => (int) ($intake['id'] ?? 0),
                'recommendation' => (string) $intake['escalationRecommendation'],
            ]);
        }

        return ['store' => $store, 'appointment' => $appointment, 'intake' => $intake];
    }

    private function buildBaseIntake(array $appointment, string $channel, ?array $existing): array
    {
        $base = is_array($existing) ? $existing : [];
        return [
            'id' => (int) ($base['id'] ?? 0),
            'source' => 'legacy_booking_bridge',
            'legacyService' => (string) ($appointment['service'] ?? ''),
            'channel' => $channel,
            'requestedDoctor' => (string) ($appointment['doctor'] ?? ''),
            'requestedDate' => (string) ($appointment['date'] ?? ''),
            'requestedTime' => (string) ($appointment['time'] ?? ''),
            'patient' => [
                'name' => (string) ($appointment['name'] ?? ''),
                'email' => (string) ($appointment['email'] ?? ''),
                'phone' => (string) ($appointment['phone'] ?? ''),
            ],
            'clinicalReason' => (string) ($appointment['reason'] ?? ''),
            'affectedArea' => (string) ($appointment['affectedArea'] ?? ''),
            'evolutionTime' => (string) ($appointment['evolutionTime'] ?? ''),
            'consentSnapshot' => $base['consentSnapshot'] ?? [],
            'clinicalMediaIds' => $base['clinicalMediaIds'] ?? [],
            'suitability' => (string) ($base['suitability'] ?? 'review_required'),
            'suitabilityReasons' => $base['suitabilityReasons'] ?? [],
            'reviewRequired' => (bool) ($base['reviewRequired'] ?? false),
            'escalationRecommendation' => (string) ($base['escalationRecommendation'] ?? 'manual_review'),
            'status' => (string) ($base['status'] ?? 'draft'),
            'linkedAppointmentId' => isset($appointment['id']) ? (int) $appointment['id'] : ((int) ($base['linkedAppointmentId'] ?? 0)),
            'paymentContext' => $base['paymentContext'] ?? [],
            'draftFingerprint' => (string) ($base['draftFingerprint'] ?? TelemedicineRepository::draftFingerprint($appointment)),
            'createdAt' => (string) ($base['createdAt'] ?? local_date('c')),
            'updatedAt' => local_date('c'),
        ];
    }

    private function resolveBookedStatus(array $suitability): string
    {
        if (($suitability['suitability'] ?? '') === 'unsuitable') {
            return 'unsuitable';
        }
        if (($suitability['requiresHumanReview'] ?? false) === true) {
            return 'review_required';
        }

        return 'booked';
    }

    private function emitAuditAndMetrics(string $event, array $intake): void
    {
        audit_log_event($event, [
            'intakeId' => (int) ($intake['id'] ?? 0),
            'channel' => (string) ($intake['channel'] ?? ''),
            'status' => (string) ($intake['status'] ?? ''),
            'appointmentId' => (int) ($intake['linkedAppointmentId'] ?? 0),
        ]);

        if (class_exists('Metrics')) {
            Metrics::increment('telemedicine_intakes_total', [
                'channel' => (string) ($intake['channel'] ?? 'unknown'),
                'status' => (string) ($intake['status'] ?? 'unknown'),
            ]);
        }
    }

    private function emitSuitability(array $intake): void
    {
        audit_log_event('telemedicine.suitability_evaluated', [
            'intakeId' => (int) ($intake['id'] ?? 0),
            'suitability' => (string) ($intake['suitability'] ?? 'review_required'),
            'reasons' => $intake['suitabilityReasons'] ?? [],
        ]);

        if (class_exists('Metrics')) {
            Metrics::increment('telemedicine_suitability_total', [
                'suitability' => (string) ($intake['suitability'] ?? 'review_required'),
            ]);
        }
    }
}
