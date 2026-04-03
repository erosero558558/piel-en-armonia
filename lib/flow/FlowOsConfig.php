<?php

declare(strict_types=1);

final class FlowOsConfig
{
public static function default_manifest(): array
{
    return [
        'version' => 'v1',
        'journeyStages' => [
            ['id' => 'lead_captured', 'label' => 'Lead captado', 'owner' => 'frontdesk', 'next' => ['intake_completed', 'scheduled']],
            ['id' => 'intake_completed', 'label' => 'Preconsulta completa', 'owner' => 'intake-triage-worker', 'next' => ['scheduled', 'care_plan_ready']],
            ['id' => 'scheduled', 'label' => 'Cita programada', 'owner' => 'appointment-worker', 'next' => ['care_plan_ready', 'follow_up_active']],
            ['id' => 'care_plan_ready', 'label' => 'Plan de cuidado listo', 'owner' => 'clinician', 'next' => ['follow_up_active', 'resolved']],
            ['id' => 'follow_up_active', 'label' => 'Seguimiento activo', 'owner' => 'followup-worker', 'next' => ['resolved']],
            ['id' => 'resolved', 'label' => 'Caso resuelto', 'owner' => 'frontdesk', 'next' => []],
        ],
        'defaultActions' => [
            'lead_captured' => ['request_identity_completion', 'offer_preconsultation_form'],
            'intake_completed' => ['review_intake_summary', 'offer_best_slot'],
            'scheduled' => ['confirm_appointment', 'prepare_chart'],
            'care_plan_ready' => ['deliver_care_plan', 'schedule_follow_up'],
            'follow_up_active' => ['request_progress_update', 'review_follow_up_signals'],
            'resolved' => ['invite_feedback', 'archive_episode'],
        ],
        'owners' => [
            'frontdesk' => 'Recepción',
            'intake-triage-worker' => 'Triage',
            'appointment-worker' => 'Agenda',
            'clinician' => 'Clínico',
            'followup-worker' => 'Seguimiento',
        ],
    ];
}

public static function manifest(): array
{
    try {
        $manifest = load_flow_os_manifest();
        if (!empty($manifest['journeyStages']) && is_array($manifest['journeyStages'])) {
            return $manifest;
        }
    } catch (Throwable $_error) {
    }

    return FlowOsConfig::default_manifest();
}

public static function stage_map(): array
{
    static $map = null;
    if ($map !== null) {
        return $map;
    }

    $map = [];
    foreach (FlowOsConfig::manifest()['journeyStages'] as $stage) {
        if (is_array($stage) && isset($stage['id'])) {
            $map[(string) $stage['id']] = $stage;
        }
    }

    return $map;
}

public static function stage(string $stageId): ?array
{
    $normalized = trim($stageId);
    if ($normalized === '') {
        return null;
    }

    $map = FlowOsConfig::stage_map();
    return $map[$normalized] ?? null;
}

public static function owner_label(string $owner): string
{
    $owners = array_merge(
        FlowOsConfig::default_manifest()['owners'] ?? [],
        FlowOsConfig::manifest()['owners'] ?? []
    );
    return isset($owners[$owner]) ? (string) $owners[$owner] : $owner;
}

public static function stage_label(string $stageId): string
{
    $stage = FlowOsConfig::stage($stageId);
    return $stage !== null ? (string) ($stage['label'] ?? $stageId) : $stageId;
}

public static function stage_rank_map(): array
{
    static $map = null;
    if ($map !== null) {
        return $map;
    }

    $map = [];
    foreach (FlowOsConfig::manifest()['journeyStages'] as $index => $stage) {
        if (is_array($stage) && isset($stage['id'])) {
            $map[(string) $stage['id']] = (int) $index;
        }
    }

    return $map;
}

public static function detect_stage(array $store): string
{
    $cases = isset($store['patient_cases']) && is_array($store['patient_cases']) ? $store['patient_cases'] : [];
    $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
    $approvals = isset($store['patient_case_approvals']) && is_array($store['patient_case_approvals'])
        ? $store['patient_case_approvals']
        : [];

    $hasOpenCase = false;
    $hasClosedCase = false;
    $hasCarePlanReady = false;
    $hasFollowUpActive = false;
    $hasScheduled = false;
    $hasIntakeCompleted = false;

    $approvalsByCaseId = [];
    foreach ($approvals as $approval) {
        if (!is_array($approval)) {
            continue;
        }

        $caseId = trim((string) ($approval['patientCaseId'] ?? ''));
        if ($caseId === '') {
            continue;
        }

        if (!isset($approvalsByCaseId[$caseId])) {
            $approvalsByCaseId[$caseId] = [];
        }
        $approvalsByCaseId[$caseId][] = $approval;
    }

    foreach ($cases as $case) {
        if (!is_array($case)) {
            continue;
        }

        $caseId = trim((string) ($case['id'] ?? ''));
        $currentStage = FlowOsStore::resolve_case_stage(
            $case,
            $approvalsByCaseId[$caseId] ?? [],
            FlowOsStore::case_appointments($case, $appointments)
        );
        if ($currentStage === 'resolved') {
            $hasClosedCase = true;
            continue;
        }

        $hasOpenCase = true;
        if ($currentStage === 'follow_up_active') {
            $hasFollowUpActive = true;
        } elseif ($currentStage === 'care_plan_ready') {
            $hasCarePlanReady = true;
        } elseif ($currentStage === 'scheduled') {
            $hasScheduled = true;
        } elseif ($currentStage === 'intake_completed') {
            $hasIntakeCompleted = true;
        }
    }

    if ($hasFollowUpActive) {
        return 'follow_up_active';
    }

    if ($hasCarePlanReady) {
        return 'care_plan_ready';
    }

    if ($hasScheduled || $appointments !== []) {
        return 'scheduled';
    }

    if ($hasIntakeCompleted) {
        return 'intake_completed';
    }

    if ($hasClosedCase) {
        return 'resolved';
    }

    return 'lead_captured';
}

public static function default_stage_map(): array
{
    static $map = null;
    if ($map !== null) {
        return $map;
    }

    $map = [];
    foreach (FlowOsConfig::default_manifest()['journeyStages'] as $stage) {
        if (is_array($stage) && isset($stage['id'])) {
            $map[(string) $stage['id']] = $stage;
        }
    }

    return $map;
}

public static function journey_stage_definition(string $stageId): ?array
{
    $stageId = trim($stageId);
    if ($stageId === '') {
        return null;
    }

    $defaultStageMap = FlowOsConfig::default_stage_map();
    if (isset($defaultStageMap[$stageId])) {
        return $defaultStageMap[$stageId];
    }

    return FlowOsConfig::stage($stageId);
}

public static function timeline_stage_catalog(): array
{
    static $catalog = null;
    if ($catalog !== null) {
        return $catalog;
    }

    $catalog = [
        [
            'id' => 'lead_captured',
            'displayId' => 'lead_captured',
            'displayLabel' => 'Lead',
        ],
        [
            'id' => 'intake_completed',
            'displayId' => 'intake',
            'displayLabel' => 'Intake',
        ],
        [
            'id' => 'scheduled',
            'displayId' => 'scheduled',
            'displayLabel' => 'Agendada',
        ],
        [
            'id' => 'care_plan_ready',
            'displayId' => 'care_plan',
            'displayLabel' => 'Plan',
        ],
        [
            'id' => 'follow_up_active',
            'displayId' => 'follow_up',
            'displayLabel' => 'Seguimiento',
        ],
        [
            'id' => 'resolved',
            'displayId' => 'resolved',
            'displayLabel' => 'Resuelto',
        ],
    ];

    return $catalog;
}

public static function display_stage_id(string $stageId): string
{
    $stageId = trim($stageId);
    foreach (FlowOsConfig::timeline_stage_catalog() as $index => $stage) {
        if ((string) ($stage['id'] ?? '') === $stageId) {
            return (string) ($stage['displayId'] ?? $stageId);
        }
    }

    return $stageId;
}

public static function display_stage_label(string $stageId): string
{
    $stageId = trim($stageId);
    foreach (FlowOsConfig::timeline_stage_catalog() as $index => $stage) {
        if ((string) ($stage['id'] ?? '') === $stageId) {
            return (string) ($stage['displayLabel'] ?? $stageId);
        }
    }

    return $stageId;
}

public static function stage_index(string $stageId): int
{
    $stageId = trim($stageId);
    foreach (FlowOsConfig::timeline_stage_catalog() as $index => $stage) {
        if ((string) ($stage['id'] ?? '') === $stageId) {
            return $index;
        }
    }

    return 0;
}

public static function is_terminal_case_status(string $status): bool
{
    return in_array($status, ['resolved', 'closed', 'completed', 'archived', 'cancelled', 'no_show'], true);
}

}
