<?php

declare(strict_types=1);

require_once __DIR__ . '/lead/LeadMarketingService.php';
require_once __DIR__ . '/lead/LeadSanitizationService.php';
require_once __DIR__ . '/lead/LeadQueueService.php';
require_once __DIR__ . '/lead/LeadTrackingService.php';


require_once __DIR__ . '/lead/LeadScoringService.php';
require_once __DIR__ . '/ServiceCatalog.php';
require_once __DIR__ . '/email.php';

final class LeadOpsService
{
    public static function allowedObjectives(): array
    {
        return self::OBJECTIVES;
    }

    public static function allowedOutcomes(): array
    {
        return array_values(array_filter(self::OUTCOMES, static fn (string $value): bool => $value !== ''));
    }

    public static function dispatchPostConsultationSummary(...$args)
    {
        return LeadMarketingService::dispatchPostConsultationSummary(...$args);
    }

    public static function queueBirthdayGreetings(...$args)
    {
        return LeadMarketingService::queueBirthdayGreetings(...$args);
    }

    public static function queueAppointmentReminders(...$args)
    {
        return LeadMarketingService::queueAppointmentReminders(...$args);
    }

    public static function queuePostConsultationFollowUps(...$args)
    {
        return LeadMarketingService::queuePostConsultationFollowUps(...$args);
    }

    public static function queueMedicationTreatmentReminders(...$args)
    {
        return LeadMarketingService::queueMedicationTreatmentReminders(...$args);
    }

    public static function enrichCallbacks(...$args)
    {
        return LeadQueueService::enrichCallbacks(...$args);
    }

    public static function enrichCallback(...$args)
    {
        return LeadQueueService::enrichCallback(...$args);
    }

    public static function normalizeLeadOrigin(...$args)
    {
        return LeadSanitizationService::normalizeLeadOrigin(...$args);
    }

    public static function applyLeadOrigin(...$args)
    {
        return LeadQueueService::applyLeadOrigin(...$args);
    }

    public static function normalizeLeadOps(...$args)
    {
        return LeadSanitizationService::normalizeLeadOps(...$args);
    }

    public static function mergeLeadOps(...$args)
    {
        return LeadQueueService::mergeLeadOps(...$args);
    }

    public static function requestLeadAi(...$args)
    {
        return LeadSanitizationService::requestLeadAi(...$args);
    }

    public static function applyAiResult(...$args)
    {
        return LeadSanitizationService::applyAiResult(...$args);
    }

    public static function buildMeta(array $callbacks, array $store, ?array $funnelMetrics = null): array
    {
        $enriched = self::enrichCallbacks($callbacks, $store, $funnelMetrics);
        $priority = ['hot' => 0, 'warm' => 0, 'cold' => 0];
        $priorityPending = ['hot' => 0, 'warm' => 0, 'cold' => 0];
        $aiStatus = ['idle' => 0, 'requested' => 0, 'completed' => 0, 'accepted' => 0, 'failed' => 0];
        $outcomes = ['contactado' => 0, 'cita_cerrada' => 0, 'sin_respuesta' => 0, 'descartado' => 0];
        $pending = 0;
        $contacted = 0;
        $aiAccepted = 0;
        $firstContactMinutes = [];

        foreach ($enriched as $callback) {
            $status = map_callback_status((string) ($callback['status'] ?? 'pendiente'));
            $leadOps = self::normalizeLeadOps($callback['leadOps'] ?? []);
            if ($status === 'contactado') {
                $contacted++;
            } else {
                $pending++;
                $priorityPending[$leadOps['priorityBand']]++;
            }

            $priority[$leadOps['priorityBand']]++;
            $aiStatus[$leadOps['aiStatus']]++;
            if ($leadOps['aiStatus'] === 'accepted') {
                $aiAccepted++;
            }
            if ($leadOps['outcome'] !== '') {
                $outcomes[$leadOps['outcome']]++;
            }

            $firstContact = self::minutesToFirstContact($callback, $leadOps['contactedAt']);
            if ($firstContact !== null) {
                $firstContactMinutes[] = $firstContact;
            }
        }

        $worker = self::workerStatus();
        $total = count($enriched);
        $aiCompleted = (int) (($aiStatus['completed'] ?? 0) + ($aiStatus['accepted'] ?? 0));
        $closedWon = (int) ($outcomes['cita_cerrada'] ?? 0);
        $noResponse = (int) ($outcomes['sin_respuesta'] ?? 0);
        $discarded = (int) ($outcomes['descartado'] ?? 0);
        $firstContactSamples = count($firstContactMinutes);

        return [
            'source' => 'lead_ops_v1',
            'generatedAt' => local_date('c'),
            'defaultSort' => 'priority_desc',
            'objectiveOptions' => self::allowedObjectives(),
            'outcomeOptions' => self::allowedOutcomes(),
            'totalCount' => $total,
            'pendingCount' => $pending,
            'contactedCount' => $contacted,
            'priorityCounts' => $priority,
            'priorityPendingCounts' => $priorityPending,
            'aiStatusCounts' => $aiStatus,
            'aiAcceptedCount' => $aiAccepted,
            'aiCompletedCount' => $aiCompleted,
            'outcomeCounts' => $outcomes,
            'closedWonCount' => $closedWon,
            'noResponseCount' => $noResponse,
            'discardedCount' => $discarded,
            'firstContact' => [
                'samples' => $firstContactSamples,
                'avgMinutes' => self::roundMetric(self::average($firstContactMinutes)),
                'p95Minutes' => self::roundMetric(self::percentile($firstContactMinutes, 95.0)),
            ],
            'rates' => [
                'aiAcceptancePct' => self::percentage($aiAccepted, $aiCompleted),
                'closedPct' => self::percentage($closedWon, $total),
                'closedFromContactedPct' => self::percentage($closedWon, $contacted),
            ],
            'worker' => $worker,
            'degraded' => in_array((string) ($worker['mode'] ?? ''), ['offline', 'degraded', 'disabled'], true),
        ];
    }

    public static function buildQueuePayload(...$args)
    {
        return LeadQueueService::buildQueuePayload(...$args);
    }

    public static function workerStatus()
    {
        return LeadQueueService::workerStatus();
    }

    public static function touchWorkerHeartbeat(...$args)
    {
        return LeadQueueService::touchWorkerHeartbeat(...$args);
    }

    public static function buildHealthSnapshot(...$args)
    {
        return LeadQueueService::buildHealthSnapshot(...$args);
    }

    public static function renderPrometheusMetrics(...$args)
    {
        return LeadQueueService::renderPrometheusMetrics(...$args);
    }

    public static function buildHeuristic(...$args)
    {
        return LeadQueueService::buildHeuristic(...$args);
    }

    public static function resolveServiceHints(...$args)
    {
        return LeadQueueService::resolveServiceHints(...$args);
    }

    public static function serviceCatalog()
    {
        return LeadQueueService::serviceCatalog();
    }

    public static function funnelSignals(...$args)
    {
        return LeadQueueService::funnelSignals(...$args);
    }

    public static function servicePriorityBoost(...$args)
    {
        return LeadQueueService::servicePriorityBoost(...$args);
    }

    public static function serviceCategoryBaseWeight(...$args)
    {
        return LeadQueueService::serviceCategoryBaseWeight(...$args);
    }

    public static function recordFirstContactMetric(...$args)
    {
        return LeadTrackingService::recordFirstContactMetric(...$args);
    }

    public static function minutesToFirstContact(...$args)
    {
        return LeadTrackingService::minutesToFirstContact(...$args);
    }

    public static function average(...$args)
    {
        return LeadTrackingService::average(...$args);
    }

    public static function percentile(...$args)
    {
        return LeadTrackingService::percentile(...$args);
    }

    public static function percentage(...$args)
    {
        return LeadTrackingService::percentage(...$args);
    }

    public static function roundMetric(...$args)
    {
        return LeadTrackingService::roundMetric(...$args);
    }

    public static function workerStatusPath()
    {
        return LeadQueueService::workerStatusPath();
    }

    public static function workerStaleAfterSeconds()
    {
        return LeadQueueService::workerStaleAfterSeconds();
    }

    public static function buildBirthdayGreetingCandidates(...$args)
    {
        return LeadMarketingService::buildBirthdayGreetingCandidates(...$args);
    }

    public static function buildBirthdayDraftIdentity(...$args)
    {
        return LeadMarketingService::buildBirthdayDraftIdentity(...$args);
    }

    public static function buildBirthdayGreetingCandidate(...$args)
    {
        return LeadMarketingService::buildBirthdayGreetingCandidate(...$args);
    }

    public static function resolvePrescriptionReminderPatient(...$args)
    {
        return LeadMarketingService::resolvePrescriptionReminderPatient(...$args);
    }

    public static function findPrescriptionAppointmentContext(...$args)
    {
        return LeadMarketingService::findPrescriptionAppointmentContext(...$args);
    }

    public static function buildMedicationReminderSchedule(...$args)
    {
        return LeadMarketingService::buildMedicationReminderSchedule(...$args);
    }

    public static function parseMedicationDurationDays(...$args)
    {
        return LeadMarketingService::parseMedicationDurationDays(...$args);
    }

    public static function buildMedicationReminderLabel(...$args)
    {
        return LeadMarketingService::buildMedicationReminderLabel(...$args);
    }

    public static function buildMedicationTreatmentReminderText(...$args)
    {
        return LeadMarketingService::buildMedicationTreatmentReminderText(...$args);
    }

    public static function buildBirthdayGreetingText(...$args)
    {
        return LeadMarketingService::buildBirthdayGreetingText(...$args);
    }

    public static function buildAppointmentReminderText(...$args)
    {
        return LeadMarketingService::buildAppointmentReminderText(...$args);
    }

    public static function buildPostConsultationFollowUpText(...$args)
    {
        return LeadMarketingService::buildPostConsultationFollowUpText(...$args);
    }

    public static function buildAppointmentScheduledAt(...$args)
    {
        return LeadMarketingService::buildAppointmentScheduledAt(...$args);
    }

    public static function normalizeAppointmentReminderTimestamp(...$args)
    {
        return LeadSanitizationService::normalizeAppointmentReminderTimestamp(...$args);
    }

    public static function extractBirthdayFirstName(...$args)
    {
        return LeadSanitizationService::extractBirthdayFirstName(...$args);
    }

    public static function buildCallbackOriginContext(...$args)
    {
        return LeadQueueService::buildCallbackOriginContext(...$args);
    }

    public static function findLeadOriginCaseContext(...$args)
    {
        return LeadQueueService::findLeadOriginCaseContext(...$args);
    }

    public static function findLeadOriginAppointmentContext(...$args)
    {
        return LeadQueueService::findLeadOriginAppointmentContext(...$args);
    }

    public static function buildBirthdayLegalName(...$args)
    {
        return LeadSanitizationService::buildBirthdayLegalName(...$args);
    }

    public static function buildBirthdayPatientKey(...$args)
    {
        return LeadSanitizationService::buildBirthdayPatientKey(...$args);
    }

    public static function normalizeBirthdayPhone(...$args)
    {
        return LeadSanitizationService::normalizeBirthdayPhone(...$args);
    }

    public static function normalizeBirthdayDate(...$args)
    {
        return LeadSanitizationService::normalizeBirthdayDate(...$args);
    }

    private static function firstNonEmptyString(string ...$values): string
    {
        foreach ($values as $value) {
            $trimmed = trim($value);
            if ($trimmed !== '') {
                return $trimmed;
            }
        }

        return '';
    }

    private static function maskPhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone);
        if (!is_string($digits) || $digits === '') {
            return 'Sin telefono';
        }
        $tail = substr($digits, -2);
        return str_repeat('*', max(0, strlen($digits) - 2)) . $tail;
    }

    public static function normalizeObjective(...$args)
    {
        return LeadSanitizationService::normalizeObjective(...$args);
    }

    public static function normalizeAiStatus(...$args)
    {
        return LeadSanitizationService::normalizeAiStatus(...$args);
    }

    public static function normalizeOutcome(...$args)
    {
        return LeadSanitizationService::normalizeOutcome(...$args);
    }

    public static function normalizeWhatsappTemplateKey(...$args)
    {
        return LeadSanitizationService::normalizeWhatsappTemplateKey(...$args);
    }

    public static function normalizePriorityBand(...$args)
    {
        return LeadSanitizationService::normalizePriorityBand(...$args);
    }

    public static function normalizeTimestamp(...$args)
    {
        return LeadSanitizationService::normalizeTimestamp(...$args);
    }

    public static function sanitizeList(...$args)
    {
        return LeadSanitizationService::sanitizeList(...$args);
    }

    public static function resolveLeadOriginValue(...$args)
    {
        return LeadSanitizationService::resolveLeadOriginValue(...$args);
    }

    public static function inferLeadOriginSource(...$args)
    {
        return LeadSanitizationService::inferLeadOriginSource(...$args);
    }

    public static function inferLeadOriginSurface(...$args)
    {
        return LeadSanitizationService::inferLeadOriginSurface(...$args);
    }

    public static function extractTokens(...$args)
    {
        return LeadSanitizationService::extractTokens(...$args);
    }

    public static function normalizeText(...$args)
    {
        return LeadSanitizationService::normalizeText(...$args);
    }

    public static function normalizeToken(...$args)
    {
        return LeadSanitizationService::normalizeToken(...$args);
    }

    public static function normalizeLeadOriginToken(...$args)
    {
        return LeadSanitizationService::normalizeLeadOriginToken(...$args);
    }

    private static function timestampValue(string $value): int
    {
        $timestamp = strtotime($value);
        return $timestamp === false ? 0 : $timestamp;
    }

    private static function clampInt(int $value, int $min, int $max): int
    {
        return max($min, min($max, $value));
    }

    public static function normalizeComparablePhone(...$args)
    {
        return LeadSanitizationService::normalizeComparablePhone(...$args);
    }
}
