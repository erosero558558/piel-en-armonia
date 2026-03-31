<?php

declare(strict_types=1);

require_once __DIR__ . '/../audit.php';
require_once __DIR__ . '/../LeadOpsService.php';
require_once __DIR__ . '/../metrics.php';
require_once __DIR__ . '/TelemedicineChannelMapper.php';
require_once __DIR__ . '/TelemedicineRepository.php';
require_once __DIR__ . '/TelemedicineConsentSnapshot.php';
require_once __DIR__ . '/TelemedicineSuitabilityEvaluator.php';
require_once __DIR__ . '/TelemedicineEncounterPlanner.php';
require_once __DIR__ . '/ClinicalMediaService.php';
require_once __DIR__ . '/TelemedicinePhotoTriage.php';
require_once __DIR__ . '/TelemedicinePhotoAiTriage.php';

final class TelemedicineIntakeService
{
    private const REVIEW_DECISIONS = [
        'approve_remote',
        'request_more_info',
        'escalate_presential',
    ];

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
        $intake = $this->applyPhotoClinicalSignals($intake, $appointment);
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
        $intake['photoTriage'] = TelemedicinePhotoTriage::buildSummary(
            $appointment,
            is_array($intake['clinicalMediaIds'] ?? null) ? $intake['clinicalMediaIds'] : []
        );
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
        $intake = $this->applyPhotoClinicalSignals($intake, $appointment);
        $intake['encounterPlan'] = TelemedicineEncounterPlanner::build($intake);

        $secondSave = TelemedicineRepository::upsertIntake($store, $intake);
        $store = $secondSave['store'];
        $intake = $secondSave['intake'];

        $appointment = $this->applyIntakeToAppointment($appointment, $intake);

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

    public function listIntakes(array $store, array $filters = []): array
    {
        $records = isset($store['telemedicine_intakes']) && is_array($store['telemedicine_intakes'])
            ? array_values($store['telemedicine_intakes'])
            : [];

        $statusFilter = strtolower(trim((string) ($filters['status'] ?? '')));
        $channelFilter = strtolower(trim((string) ($filters['channel'] ?? '')));
        $suitabilityFilter = strtolower(trim((string) ($filters['suitability'] ?? '')));
        $decisionFilter = strtolower(trim((string) ($filters['decision'] ?? '')));
        $includeResolved = isset($filters['includeResolved']) ? parse_bool($filters['includeResolved']) : true;
        $reviewOnly = isset($filters['reviewOnly']) ? parse_bool($filters['reviewOnly']) : false;

        $result = [];
        foreach ($records as $intake) {
            $status = strtolower(trim((string) ($intake['status'] ?? '')));
            $channel = strtolower(trim((string) ($intake['channel'] ?? '')));
            $suitability = strtolower(trim((string) ($intake['suitability'] ?? '')));
            $decision = strtolower(trim((string) ($intake['reviewDecision'] ?? '')));
            $reviewStatus = strtolower(trim((string) ($intake['reviewStatus'] ?? '')));

            if ($statusFilter !== '' && $status !== $statusFilter) {
                continue;
            }
            if ($channelFilter !== '' && $channel !== $channelFilter) {
                continue;
            }
            if ($suitabilityFilter !== '' && $suitability !== $suitabilityFilter) {
                continue;
            }
            if ($decisionFilter !== '' && $decision !== $decisionFilter) {
                continue;
            }
            if (!$includeResolved && $reviewStatus === 'resolved') {
                continue;
            }
            if ($reviewOnly && !$this->intakeNeedsReviewQueue($intake)) {
                continue;
            }

            $result[] = $intake;
        }

        usort($result, static function (array $left, array $right): int {
            $leftUpdated = (string) ($left['updatedAt'] ?? $left['createdAt'] ?? '');
            $rightUpdated = (string) ($right['updatedAt'] ?? $right['createdAt'] ?? '');

            return strcmp($rightUpdated, $leftUpdated);
        });

        return array_values($result);
    }

    public function applyAdminDecision(array $store, int $intakeId, array $payload): array
    {
        if ($intakeId <= 0) {
            return [
                'ok' => false,
                'error' => 'intakeId invalido',
                'code' => 400,
            ];
        }

        $decision = strtolower(trim((string) ($payload['decision'] ?? '')));
        if (!in_array($decision, self::REVIEW_DECISIONS, true)) {
            return [
                'ok' => false,
                'error' => 'Decision invalida. Usa approve_remote, request_more_info o escalate_presential.',
                'code' => 400,
            ];
        }

        $intake = TelemedicineRepository::findIntakeById($store, $intakeId);
        if (!is_array($intake)) {
            return [
                'ok' => false,
                'error' => 'Telemedicine intake no encontrado',
                'code' => 404,
            ];
        }

        $notes = trim((string) ($payload['notes'] ?? ''));
        $reviewedBy = trim((string) ($payload['reviewedBy'] ?? $payload['actor'] ?? 'admin'));
        if ($reviewedBy === '') {
            $reviewedBy = 'admin';
        }
        $reviewedAt = local_date('c');

        $previousSuitability = (string) ($intake['suitability'] ?? 'review_required');
        $previousStatus = (string) ($intake['status'] ?? 'review_required');
        $previousEscalation = (string) ($intake['escalationRecommendation'] ?? 'manual_review');

        if ($decision === 'approve_remote') {
            $intake['suitability'] = 'fit';
            $intake['reviewRequired'] = false;
            $intake['escalationRecommendation'] = 'remote_visit';
            $intake['status'] = ((int) ($intake['linkedAppointmentId'] ?? 0) > 0) ? 'booked' : 'ready_for_booking';
            $reviewStatus = 'resolved';
        } elseif ($decision === 'request_more_info') {
            $intake['suitability'] = 'review_required';
            $intake['reviewRequired'] = true;
            $intake['escalationRecommendation'] = 'manual_review';
            $intake['status'] = 'review_required';
            $intake['suitabilityReasons'] = $this->appendReason(
                is_array($intake['suitabilityReasons'] ?? null) ? $intake['suitabilityReasons'] : [],
                'admin_requested_more_info'
            );
            $reviewStatus = 'awaiting_patient';
        } else {
            $intake['suitability'] = 'unsuitable';
            $intake['reviewRequired'] = false;
            $intake['escalationRecommendation'] = 'in_person_review';
            $intake['status'] = 'unsuitable';
            $intake['suitabilityReasons'] = $this->appendReason(
                is_array($intake['suitabilityReasons'] ?? null) ? $intake['suitabilityReasons'] : [],
                'admin_escalated_presential'
            );
            $reviewStatus = 'resolved';
        }

        $intake['reviewDecision'] = $decision;
        $intake['reviewStatus'] = $reviewStatus;
        $intake['reviewNotes'] = $notes;
        $intake['reviewedBy'] = $reviewedBy;
        $intake['reviewedAt'] = $reviewedAt;
        $photoAiTriage = isset($intake['photoAiTriage']) && is_array($intake['photoAiTriage'])
            ? $intake['photoAiTriage']
            : TelemedicinePhotoAiTriage::evaluate($intake);
        $intake['photoAiTriage'] = TelemedicinePhotoAiTriage::recordDoctorValidation(
            $photoAiTriage,
            $decision,
            $reviewedBy,
            $reviewedAt,
            $notes
        );

        $history = is_array($intake['reviewHistory'] ?? null) ? $intake['reviewHistory'] : [];
        $history[] = [
            'decision' => $decision,
            'reviewStatus' => $reviewStatus,
            'notes' => $notes,
            'reviewedBy' => $reviewedBy,
            'reviewedAt' => $reviewedAt,
            'previousSuitability' => $previousSuitability,
            'previousStatus' => $previousStatus,
            'previousEscalationRecommendation' => $previousEscalation,
        ];
        $intake['reviewHistory'] = array_values($history);

        $intake['encounterPlan'] = TelemedicineEncounterPlanner::build($intake);
        $intake['encounterPlan']['reviewDecision'] = $decision;
        $intake['encounterPlan']['reviewStatus'] = $reviewStatus;
        $intake['encounterPlan']['reviewedBy'] = $reviewedBy;
        $intake['encounterPlan']['reviewedAt'] = $reviewedAt;
        if ($notes !== '') {
            $intake['encounterPlan']['reviewNotes'] = $notes;
        }

        $saved = TelemedicineRepository::upsertIntake($store, $intake);
        $store = $saved['store'];
        $intake = $saved['intake'];

        $appointment = null;
        $linkedAppointmentId = (int) ($intake['linkedAppointmentId'] ?? 0);
        if ($linkedAppointmentId > 0) {
            foreach (($store['appointments'] ?? []) as $candidate) {
                if ((int) ($candidate['id'] ?? 0) !== $linkedAppointmentId) {
                    continue;
                }
                $appointment = $this->applyIntakeToAppointment($candidate, $intake);
                $store = TelemedicineRepository::replaceAppointment($store, $appointment);
                break;
            }
        }

        audit_log_event('telemedicine.review_decision_recorded', [
            'intakeId' => (int) ($intake['id'] ?? 0),
            'appointmentId' => $linkedAppointmentId,
            'decision' => $decision,
            'reviewStatus' => $reviewStatus,
            'reviewedBy' => $reviewedBy,
        ]);
        if (class_exists('Metrics')) {
            Metrics::increment('telemedicine_review_decisions_total', [
                'decision' => $decision,
                'review_status' => $reviewStatus,
            ]);
        }

        return [
            'ok' => true,
            'code' => 200,
            'store' => $store,
            'intake' => $intake,
            'appointment' => $appointment,
        ];
    }

    private function buildBaseIntake(array $appointment, string $channel, ?array $existing): array
    {
        $base = is_array($existing) ? $existing : [];
        $origin = LeadOpsService::normalizeLeadOrigin([
            'source' => 'legacy_booking_bridge',
            'campaign' => (string) ($appointment['campaign'] ?? ''),
            'surface' => (string) ($appointment['surface'] ?? $channel),
            'service_intent' => (string) ($appointment['service_intent'] ?? ($appointment['service'] ?? '')),
            'channel' => $channel,
        ], $appointment);
        return [
            'id' => (int) ($base['id'] ?? 0),
            'source' => 'legacy_booking_bridge',
            'campaign' => $origin['campaign'],
            'surface' => $origin['surface'],
            'service_intent' => $origin['service_intent'],
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
            'photoTriage' => isset($base['photoTriage']) && is_array($base['photoTriage'])
                ? $base['photoTriage']
                : TelemedicinePhotoTriage::buildSummary($appointment),
            'photoAiTriage' => isset($base['photoAiTriage']) && is_array($base['photoAiTriage'])
                ? $base['photoAiTriage']
                : [],
            'suitability' => (string) ($base['suitability'] ?? 'review_required'),
            'suitabilityReasons' => $base['suitabilityReasons'] ?? [],
            'reviewRequired' => (bool) ($base['reviewRequired'] ?? false),
            'escalationRecommendation' => (string) ($base['escalationRecommendation'] ?? 'manual_review'),
            'status' => (string) ($base['status'] ?? 'draft'),
            'linkedAppointmentId' => isset($appointment['id']) ? (int) $appointment['id'] : ((int) ($base['linkedAppointmentId'] ?? 0)),
            'paymentContext' => $base['paymentContext'] ?? [],
            'latestPatientConcern' => (string) ($base['latestPatientConcern'] ?? ''),
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

    private function applyIntakeToAppointment(array $appointment, array $intake): array
    {
        $channel = (string) ($intake['channel'] ?? '');
        $appointment['telemedicineIntakeId'] = (int) ($intake['id'] ?? 0);
        $appointment['telemedicineChannel'] = $channel;
        $appointment['telemedicineSuitability'] = (string) ($intake['suitability'] ?? 'review_required');
        $appointment['telemedicineSuitabilityReasons'] = is_array($intake['suitabilityReasons'] ?? null)
            ? array_values($intake['suitabilityReasons'])
            : [];
        $appointment['telemedicineReviewRequired'] = (bool) ($intake['reviewRequired'] ?? false);
        $appointment['telemedicineEscalationRecommendation'] = (string) ($intake['escalationRecommendation'] ?? 'manual_review');
        $appointment['telemedicineConsentSnapshot'] = isset($intake['consentSnapshot']) && is_array($intake['consentSnapshot'])
            ? $intake['consentSnapshot']
            : [];
        $appointment['telemedicinePhotoAiTriage'] = isset($intake['photoAiTriage']) && is_array($intake['photoAiTriage'])
            ? $intake['photoAiTriage']
            : [];

        $encounterPlan = isset($intake['encounterPlan']) && is_array($intake['encounterPlan'])
            ? $intake['encounterPlan']
            : [];
        if (isset($intake['reviewDecision'])) {
            $encounterPlan['reviewDecision'] = (string) $intake['reviewDecision'];
        }
        if (isset($intake['reviewStatus'])) {
            $encounterPlan['reviewStatus'] = (string) $intake['reviewStatus'];
        }
        if (isset($intake['reviewedBy'])) {
            $encounterPlan['reviewedBy'] = (string) $intake['reviewedBy'];
        }
        if (isset($intake['reviewedAt'])) {
            $encounterPlan['reviewedAt'] = (string) $intake['reviewedAt'];
        }
        if (!empty($intake['reviewNotes'])) {
            $encounterPlan['reviewNotes'] = (string) $intake['reviewNotes'];
        }
        $appointment['telemedicineEncounterPlan'] = $encounterPlan;

        if ($channel !== '') {
            $appointment['visitMode'] = TelemedicineChannelMapper::visitMode($channel);
        }
        $appointment['supportContactMethod'] = TelemedicineChannelMapper::supportContactMethod($appointment);

        return normalize_appointment($appointment);
    }

    private function applyPhotoClinicalSignals(array $intake, array $appointment = []): array
    {
        if (!isset($intake['photoTriage']) || !is_array($intake['photoTriage'])) {
            $intake['photoTriage'] = TelemedicinePhotoTriage::buildSummary(
                $appointment,
                is_array($intake['clinicalMediaIds'] ?? null) ? $intake['clinicalMediaIds'] : []
            );
        }

        $intake['photoAiTriage'] = TelemedicinePhotoAiTriage::evaluate($intake);

        return $intake;
    }

    private function intakeNeedsReviewQueue(array $intake): bool
    {
        $suitability = (string) ($intake['suitability'] ?? 'review_required');
        $status = (string) ($intake['status'] ?? '');
        $reviewRequired = (bool) ($intake['reviewRequired'] ?? false);
        $reviewStatus = (string) ($intake['reviewStatus'] ?? '');
        if ($reviewStatus === 'resolved') {
            return false;
        }
        if ($reviewStatus === 'awaiting_patient') {
            return true;
        }

        return $reviewRequired
            || $suitability === 'review_required'
            || $suitability === 'unsuitable'
            || $status === 'review_required'
            || $status === 'unsuitable';
    }

    private function appendReason(array $reasons, string $reason): array
    {
        $items = [];
        foreach ($reasons as $item) {
            $normalized = trim((string) $item);
            if ($normalized === '') {
                continue;
            }
            $items[$normalized] = true;
        }
        $normalizedReason = trim($reason);
        if ($normalizedReason !== '') {
            $items[$normalizedReason] = true;
        }

        return array_keys($items);
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
