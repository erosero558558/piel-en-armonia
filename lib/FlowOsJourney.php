<?php

declare(strict_types=1);

require_once __DIR__ . '/flow_os_manifest.php';
require_once __DIR__ . '/PatientCaseService.php';

function flow_os_default_manifest(): array
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

function flow_os_manifest(): array
{
    try {
        $manifest = load_flow_os_manifest();
        if (!empty($manifest['journeyStages']) && is_array($manifest['journeyStages'])) {
            return $manifest;
        }
    } catch (Throwable $_error) {
    }

    return flow_os_default_manifest();
}

function flow_os_stage_map(): array
{
    static $map = null;
    if ($map !== null) {
        return $map;
    }

    $map = [];
    foreach (flow_os_manifest()['journeyStages'] as $stage) {
        if (is_array($stage) && isset($stage['id'])) {
            $map[(string) $stage['id']] = $stage;
        }
    }

    return $map;
}

function flow_os_stage(string $stageId): ?array
{
    $normalized = trim($stageId);
    if ($normalized === '') {
        return null;
    }

    $map = flow_os_stage_map();
    return $map[$normalized] ?? null;
}

function flow_os_owner_label(string $owner): string
{
    $owners = array_merge(
        flow_os_default_manifest()['owners'] ?? [],
        flow_os_manifest()['owners'] ?? []
    );
    return isset($owners[$owner]) ? (string) $owners[$owner] : $owner;
}

function flow_os_default_stage_map(): array
{
    static $map = null;
    if ($map !== null) {
        return $map;
    }

    $map = [];
    foreach (flow_os_default_manifest()['journeyStages'] as $stage) {
        if (is_array($stage) && isset($stage['id'])) {
            $map[(string) $stage['id']] = $stage;
        }
    }

    return $map;
}

function flow_os_journey_stage_definition(string $stageId): ?array
{
    $stageId = trim($stageId);
    if ($stageId === '') {
        return null;
    }

    $defaultStageMap = flow_os_default_stage_map();
    if (isset($defaultStageMap[$stageId])) {
        return $defaultStageMap[$stageId];
    }

    return flow_os_stage($stageId);
}

function flow_os_timeline_stage_catalog(): array
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

function flow_os_display_stage_id(string $stageId): string
{
    $stageId = trim($stageId);
    foreach (flow_os_timeline_stage_catalog() as $index => $stage) {
        if ((string) ($stage['id'] ?? '') === $stageId) {
            return (string) ($stage['displayId'] ?? $stageId);
        }
    }

    return $stageId;
}

function flow_os_display_stage_label(string $stageId): string
{
    $stageId = trim($stageId);
    foreach (flow_os_timeline_stage_catalog() as $index => $stage) {
        if ((string) ($stage['id'] ?? '') === $stageId) {
            return (string) ($stage['displayLabel'] ?? $stageId);
        }
    }

    return $stageId;
}

function flow_os_stage_index(string $stageId): int
{
    $stageId = trim($stageId);
    foreach (flow_os_timeline_stage_catalog() as $index => $stage) {
        if ((string) ($stage['id'] ?? '') === $stageId) {
            return $index;
        }
    }

    return 0;
}

function flow_os_prepare_store(array $store): array
{
    $existingCases = isset($store['patient_cases']) && is_array($store['patient_cases'])
        ? array_values($store['patient_cases'])
        : [];

    try {
        $service = new PatientCaseService();
        $prepared = $service->hydrateStore($store);
        $prepared['patient_cases'] = flow_os_merge_existing_cases(
            isset($prepared['patient_cases']) && is_array($prepared['patient_cases'])
                ? array_values($prepared['patient_cases'])
                : [],
            $existingCases
        );

        return $prepared;
    } catch (Throwable $_error) {
        return $store;
    }
}

function flow_os_merge_existing_cases(array $preparedCases, array $existingCases): array
{
    $merged = [];
    $preparedById = [];

    foreach ($preparedCases as $case) {
        if (!is_array($case)) {
            continue;
        }

        $caseId = trim((string) ($case['id'] ?? ''));
        if ($caseId === '') {
            continue;
        }

        $preparedById[$caseId] = $case;
    }

    foreach ($existingCases as $existingCase) {
        if (!is_array($existingCase)) {
            continue;
        }

        $caseId = trim((string) ($existingCase['id'] ?? ''));
        if ($caseId === '') {
            continue;
        }

        if (isset($preparedById[$caseId])) {
            $preparedById[$caseId] = flow_os_overlay_existing_case($preparedById[$caseId], $existingCase);
            continue;
        }

        $normalized = flow_os_normalize_existing_case($existingCase);
        if ($normalized !== null) {
            $preparedById[$caseId] = $normalized;
        }
    }

    foreach ($preparedById as $case) {
        $merged[] = $case;
    }

    return array_values($merged);
}

function flow_os_overlay_existing_case(array $case, array $existingCase): array
{
    foreach (['journeyStage', 'journeyEnteredAt', 'journeyAdvancedAt', 'journeyAdvancedReason'] as $field) {
        $value = trim((string) ($existingCase[$field] ?? ''));
        if ($value !== '') {
            $case[$field] = $value;
        }
    }

    foreach (['openedAt', 'latestActivityAt', 'lastInboundAt', 'lastOutboundAt'] as $field) {
        $existingValue = trim((string) ($existingCase[$field] ?? ''));
        $currentValue = trim((string) ($case[$field] ?? ''));
        if ($currentValue === '' && $existingValue !== '') {
            $case[$field] = $existingValue;
        }
    }

    $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
    $existingSummary = isset($existingCase['summary']) && is_array($existingCase['summary'])
        ? $existingCase['summary']
        : [];
    foreach ([
        'patientLabel',
        'serviceLine',
        'providerName',
        'scheduledStart',
        'scheduledEnd',
        'latestCallbackId',
        'latestTicketId',
    ] as $field) {
        $existingValue = trim((string) ($existingSummary[$field] ?? ''));
        $currentValue = trim((string) ($summary[$field] ?? ''));
        if ($currentValue === '' && $existingValue !== '') {
            $summary[$field] = $existingValue;
        }
    }

    if ($existingSummary !== []) {
        $summary['milestones'] = array_merge(
            isset($existingSummary['milestones']) && is_array($existingSummary['milestones'])
                ? $existingSummary['milestones']
                : [],
            isset($summary['milestones']) && is_array($summary['milestones'])
                ? $summary['milestones']
                : []
        );
    }

    $case['summary'] = $summary;

    return $case;
}

function flow_os_normalize_existing_case(array $case): ?array
{
    $caseId = trim((string) ($case['id'] ?? ''));
    if ($caseId === '') {
        return null;
    }

    $openedAt = flow_os_first_non_empty_timestamp([
        $case['openedAt'] ?? '',
        $case['latestActivityAt'] ?? '',
        $case['journeyEnteredAt'] ?? '',
        function_exists('local_date') ? local_date('c') : gmdate('c'),
    ]);
    $latestActivityAt = flow_os_first_non_empty_timestamp([
        $case['latestActivityAt'] ?? '',
        $openedAt,
    ]);
    $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];

    return array_merge($case, [
        'id' => $caseId,
        'patientId' => trim((string) ($case['patientId'] ?? '')),
        'status' => trim((string) ($case['status'] ?? '')) !== ''
            ? trim((string) ($case['status'] ?? ''))
            : 'booked',
        'openedAt' => $openedAt,
        'latestActivityAt' => $latestActivityAt,
        'closedAt' => trim((string) ($case['closedAt'] ?? '')) ?: null,
        'lastInboundAt' => trim((string) ($case['lastInboundAt'] ?? '')) ?: null,
        'lastOutboundAt' => trim((string) ($case['lastOutboundAt'] ?? '')) ?: null,
        'summary' => $summary,
    ]);
}

function flow_os_case_approvals_by_case_id(array $store): array
{
    $approvals = isset($store['patient_case_approvals']) && is_array($store['patient_case_approvals'])
        ? $store['patient_case_approvals']
        : [];
    $index = [];

    foreach ($approvals as $approval) {
        if (!is_array($approval)) {
            continue;
        }

        $caseId = trim((string) ($approval['patientCaseId'] ?? ''));
        if ($caseId === '') {
            continue;
        }

        if (!isset($index[$caseId])) {
            $index[$caseId] = [];
        }

        $index[$caseId][] = $approval;
    }

    return $index;
}

function flow_os_first_non_empty_timestamp(array $values): string
{
    foreach ($values as $value) {
        $normalized = trim((string) $value);
        if ($normalized !== '') {
            return $normalized;
        }
    }

    return '';
}

function flow_os_latest_timestamp(array $values): string
{
    $latest = '';
    foreach ($values as $value) {
        $normalized = trim((string) $value);
        if ($normalized === '') {
            continue;
        }

        if ($latest === '' || strcmp($latest, $normalized) < 0) {
            $latest = $normalized;
        }
    }

    return $latest;
}

function flow_os_case_has_follow_up_signal(array $case, array $approvals = []): bool
{
    $status = strtolower(trim((string) ($case['status'] ?? '')));
    if (in_array($status, ['follow_up_active', 'under_followup', 'monitoring', 'treatment_started'], true)) {
        return true;
    }

    $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
    foreach (['followUpDueAt', 'followUpScheduledAt', 'followUpStartedAt', 'latestFollowUpAt'] as $field) {
        if (trim((string) ($summary[$field] ?? '')) !== '') {
            return true;
        }
    }

    foreach ($approvals as $approval) {
        if (!is_array($approval)) {
            continue;
        }
        $type = strtolower(trim((string) ($approval['type'] ?? '')));
        if (in_array($type, ['follow_up', 'followup', 'follow_up_due'], true)) {
            return true;
        }
    }

    return false;
}

function flow_os_case_appointments(array $case, array $appointments): array
{
    $caseId = trim((string) ($case['id'] ?? ''));
    $patientId = trim((string) ($case['patientId'] ?? ''));

    $caseAppointments = [];
    foreach ($appointments as $appt) {
        if (!is_array($appt)) {
            continue;
        }
        $apptCaseId = trim((string) ($appt['patientCaseId'] ?? $appt['caseId'] ?? ''));
        $apptPatientId = trim((string) ($appt['patientId'] ?? ''));

        if (($apptCaseId !== '' && $apptCaseId === $caseId) ||
            ($apptCaseId === '' && $apptPatientId !== '' && $apptPatientId === $patientId)) {
            $caseAppointments[] = $appt;
        }
    }

    return $caseAppointments;
}

function flow_os_resolve_case_stage(array $case, array $approvals = [], array $appointments = []): string
{
    $explicitStage = flow_os_explicit_case_stage($case);
    $inferredStage = flow_os_infer_case_stage($case, $approvals, $appointments);

    if ($explicitStage === '') {
        return $inferredStage;
    }

    return flow_os_stage_index($inferredStage) > flow_os_stage_index($explicitStage)
        ? $inferredStage
        : $explicitStage;
}

function flow_os_explicit_case_stage(array $case): string
{
    $explicitStage = trim((string) ($case['journeyStage'] ?? $case['stage'] ?? ''));
    return $explicitStage !== '' && flow_os_stage($explicitStage) !== null ? $explicitStage : '';
}

function flow_os_case_has_completed_visit(array $case, array $appointments = []): bool
{
    $status = strtolower(trim((string) ($case['status'] ?? '')));
    if ($status === 'completed') {
        return true;
    }

    $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
    $milestones = isset($summary['milestones']) && is_array($summary['milestones']) ? $summary['milestones'] : [];
    if (trim((string) ($milestones['completedAt'] ?? '')) !== '') {
        return true;
    }

    foreach ($appointments as $appt) {
        if (!is_array($appt)) {
            continue;
        }

        $apptStatus = function_exists('map_appointment_status')
            ? map_appointment_status((string) ($appt['status'] ?? 'confirmed'))
            : strtolower(trim((string) ($appt['status'] ?? 'confirmed')));
        if ($apptStatus === 'completed') {
            return true;
        }
    }

    return false;
}

function flow_os_infer_case_stage(array $case, array $approvals = [], array $appointments = []): string
{
    $status = strtolower(trim((string) ($case['status'] ?? '')));
    $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
    $milestones = isset($summary['milestones']) && is_array($summary['milestones']) ? $summary['milestones'] : [];
    $pendingApprovals = max(0, (int) ($summary['pendingApprovalCount'] ?? 0));
    $scheduledStart = trim((string) ($summary['scheduledStart'] ?? ''));
    $latestCallbackId = trim((string) ($summary['latestCallbackId'] ?? ''));
    $latestTicketId = trim((string) ($summary['latestTicketId'] ?? ''));
    $calledAt = trim((string) ($milestones['calledAt'] ?? ''));
    $hasCompletedVisit = flow_os_case_has_completed_visit($case, $appointments);

    $hasScheduledAppointment = false;
    foreach ($appointments as $appt) {
        if (!is_array($appt)) {
            continue;
        }
        $apptStatus = function_exists('map_appointment_status')
            ? map_appointment_status((string) ($appt['status'] ?? 'confirmed'))
            : strtolower(trim((string) ($appt['status'] ?? 'confirmed')));
        if (!in_array($apptStatus, ['cancelled', 'no_show', 'failed', 'rejected', 'completed'], true)) {
            $hasScheduledAppointment = true;
        }
    }

    if (
        in_array($status, ['resolved', 'closed', 'no_show', 'cancelled', 'archived'], true) ||
        (
            trim((string) ($case['closedAt'] ?? '')) !== '' &&
            !$hasCompletedVisit
        )
    ) {
        return 'resolved';
    }

    if (flow_os_case_has_follow_up_signal($case, $approvals)) {
        return 'follow_up_active';
    }

    if (
        in_array($status, ['care_plan_ready', 'plan_ready', 'ready_for_plan'], true) ||
        $pendingApprovals > 0 ||
        $calledAt !== '' ||
        in_array($status, ['called', 'in_consultorio'], true) ||
        $hasCompletedVisit
    ) {
        return 'care_plan_ready';
    }

    if (
        $scheduledStart !== '' ||
        $latestTicketId !== '' ||
        in_array($status, ['booked', 'arrived', 'checked_in'], true) ||
        $hasScheduledAppointment
    ) {
        return 'scheduled';
    }

    if (
        $latestCallbackId !== '' ||
        trim((string) ($case['lastInboundAt'] ?? '')) !== '' ||
        trim((string) ($case['lastOutboundAt'] ?? '')) !== ''
    ) {
        return 'intake_completed';
    }

    return 'lead_captured';
}

function flow_os_resolve_case_stage_entered_at(array $case, string $stageId, array $approvals = []): string
{
    $explicitStage = flow_os_explicit_case_stage($case);
    $explicitEnteredAt = trim((string) ($case['journeyEnteredAt'] ?? ''));
    if ($explicitStage === $stageId && $explicitEnteredAt !== '') {
        return $explicitEnteredAt;
    }

    $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
    $milestones = isset($summary['milestones']) && is_array($summary['milestones']) ? $summary['milestones'] : [];
    $latestApprovalAt = flow_os_latest_timestamp(array_map(static function ($approval): string {
        if (!is_array($approval)) {
            return '';
        }

        return (string) ($approval['updatedAt'] ?? ($approval['createdAt'] ?? ''));
    }, $approvals));

    switch ($stageId) {
        case 'resolved':
            return flow_os_first_non_empty_timestamp([
                $case['closedAt'] ?? '',
                $milestones['completedAt'] ?? '',
                $case['latestActivityAt'] ?? '',
                $case['openedAt'] ?? '',
            ]);
        case 'follow_up_active':
            return flow_os_first_non_empty_timestamp([
                $summary['followUpStartedAt'] ?? '',
                $summary['followUpScheduledAt'] ?? '',
                $summary['followUpDueAt'] ?? '',
                $case['lastOutboundAt'] ?? '',
                $case['lastInboundAt'] ?? '',
                $case['latestActivityAt'] ?? '',
                $case['openedAt'] ?? '',
            ]);
        case 'care_plan_ready':
            return flow_os_first_non_empty_timestamp([
                $milestones['completedAt'] ?? '',
                $latestApprovalAt,
                $milestones['calledAt'] ?? '',
                $case['latestActivityAt'] ?? '',
                $summary['scheduledEnd'] ?? '',
                $summary['scheduledStart'] ?? '',
                $case['openedAt'] ?? '',
            ]);
        case 'scheduled':
            return flow_os_first_non_empty_timestamp([
                $milestones['bookedAt'] ?? '',
                $summary['scheduledStart'] ?? '',
                $milestones['checkedInAt'] ?? '',
                $case['openedAt'] ?? '',
            ]);
        case 'intake_completed':
            return flow_os_first_non_empty_timestamp([
                $case['lastInboundAt'] ?? '',
                $case['lastOutboundAt'] ?? '',
                $case['openedAt'] ?? '',
            ]);
        case 'lead_captured':
        default:
            return flow_os_first_non_empty_timestamp([
                $case['openedAt'] ?? '',
                $case['latestActivityAt'] ?? '',
            ]);
    }
}

function flow_os_duration_ms(string $startedAt): int
{
    $startedAt = trim($startedAt);
    if ($startedAt === '') {
        return 0;
    }

    $started = strtotime($startedAt);
    if ($started === false) {
        return 0;
    }

    $now = function_exists('local_date') ? strtotime(local_date('c')) : time();
    if ($now === false) {
        $now = time();
    }

    return max(0, (int) (($now - $started) * 1000));
}

function flow_os_case_alerts(array $case): array
{
    $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
    $alerts = [];
    $pendingApprovals = max(0, (int) ($summary['pendingApprovalCount'] ?? 0));
    if ($pendingApprovals > 0) {
        $alerts[] = $pendingApprovals . ' aprobacion(es) pendiente(s)';
    }

    if ((int) ($summary['openActionCount'] ?? 0) > 0 || (int) ($summary['activeHelpRequestId'] ?? 0) > 0) {
        $alerts[] = 'Apoyo operativo activo';
    }

    return $alerts;
}

function flow_os_build_case_journey_snapshot(array $case, array $approvals = [], array $appointments = []): array
{
    $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
    $stageId = flow_os_resolve_case_stage($case, $approvals, $appointments);
    $stage = flow_os_journey_stage_definition($stageId) ?? [
        'id' => $stageId,
        'label' => $stageId,
        'owner' => 'frontdesk',
        'next' => [],
    ];
    $enteredAt = flow_os_resolve_case_stage_entered_at($case, $stageId, $approvals);
    $actions = flow_os_resolve_next_actions($stageId);
    $nextAction = $actions[0] ?? null;

    return [
        'caseId' => trim((string) ($case['id'] ?? '')),
        'patientId' => trim((string) ($case['patientId'] ?? '')),
        'patientLabel' => trim((string) ($summary['patientLabel'] ?? '')) !== ''
            ? trim((string) ($summary['patientLabel'] ?? ''))
            : 'Paciente sin etiqueta',
        'serviceLine' => trim((string) ($summary['serviceLine'] ?? '')),
        'providerName' => trim((string) ($summary['providerName'] ?? '')),
        'status' => trim((string) ($case['status'] ?? '')),
        'stage' => $stageId,
        'displayStage' => flow_os_display_stage_id($stageId),
        'stageLabel' => (string) ($stage['label'] ?? $stageId),
        'displayStageLabel' => flow_os_display_stage_label($stageId),
        'stageIndex' => flow_os_stage_index($stageId),
        'owner' => (string) ($stage['owner'] ?? 'frontdesk'),
        'ownerLabel' => flow_os_owner_label((string) ($stage['owner'] ?? 'frontdesk')),
        'enteredAt' => $enteredAt,
        'timeInStageMs' => flow_os_duration_ms($enteredAt),
        'openedAt' => trim((string) ($case['openedAt'] ?? '')),
        'latestActivityAt' => trim((string) ($case['latestActivityAt'] ?? '')),
        'closedAt' => trim((string) ($case['closedAt'] ?? '')),
        'scheduledStart' => trim((string) ($summary['scheduledStart'] ?? '')),
        'pendingApprovalCount' => max(0, (int) ($summary['pendingApprovalCount'] ?? 0)),
        'openActionCount' => max(0, (int) ($summary['openActionCount'] ?? 0)),
        'activeHelpRequestId' => $summary['activeHelpRequestId'] ?? null,
        'next' => isset($stage['next']) && is_array($stage['next']) ? array_values($stage['next']) : [],
        'nextActionLabel' => is_array($nextAction) ? trim((string) ($nextAction['label'] ?? '')) : '',
        'alerts' => flow_os_case_alerts($case),
    ];
}

function flow_os_build_case_journey_preview_list(array $store): array
{
    $cases = isset($store['patient_cases']) && is_array($store['patient_cases']) ? $store['patient_cases'] : [];
    $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
    $approvalsByCaseId = flow_os_case_approvals_by_case_id($store);
    $snapshots = [];

    foreach ($cases as $case) {
        if (!is_array($case)) {
            continue;
        }

        $caseId = trim((string) ($case['id'] ?? ''));
        $caseAppointments = flow_os_case_appointments($case, $appointments);
        
        $snapshots[] = flow_os_build_case_journey_snapshot(
            $case,
            $caseId !== '' ? ($approvalsByCaseId[$caseId] ?? []) : [],
            $caseAppointments
        );
    }

    usort($snapshots, static function (array $left, array $right): int {
        $leftResolved = (string) ($left['stage'] ?? '') === 'resolved';
        $rightResolved = (string) ($right['stage'] ?? '') === 'resolved';
        if ($leftResolved !== $rightResolved) {
            return $leftResolved ? 1 : -1;
        }

        $leftIndex = (int) ($left['stageIndex'] ?? 0);
        $rightIndex = (int) ($right['stageIndex'] ?? 0);
        if ($leftIndex !== $rightIndex) {
            return $leftIndex <=> $rightIndex;
        }

        $leftEnteredAt = trim((string) ($left['enteredAt'] ?? ''));
        $rightEnteredAt = trim((string) ($right['enteredAt'] ?? ''));
        if ($leftEnteredAt !== $rightEnteredAt) {
            return strcmp($leftEnteredAt, $rightEnteredAt);
        }

        return strcmp(
            (string) ($right['latestActivityAt'] ?? ''),
            (string) ($left['latestActivityAt'] ?? '')
        );
    });

    return $snapshots;
}

function flow_os_build_case_stage_counts(array $cases): array
{
    $counts = [];
    foreach (flow_os_timeline_stage_catalog() as $stage) {
        $counts[(string) ($stage['displayId'] ?? $stage['id'])] = 0;
    }

    foreach ($cases as $case) {
        if (!is_array($case)) {
            continue;
        }

        $displayStage = trim((string) ($case['displayStage'] ?? ''));
        if ($displayStage === '' || !array_key_exists($displayStage, $counts)) {
            continue;
        }

        $counts[$displayStage] = (int) ($counts[$displayStage] ?? 0) + 1;
    }

    return $counts;
}

function flow_os_detect_stage(array $store): string
{
    $store = flow_os_prepare_store($store);
    $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
    $cases = flow_os_build_case_journey_preview_list($store);
    foreach ([
        'follow_up_active',
        'care_plan_ready',
        'scheduled',
        'intake_completed',
        'lead_captured',
        'resolved',
    ] as $stageId) {
        foreach ($cases as $case) {
            if (!is_array($case)) {
                continue;
            }

            if ((string) ($case['stage'] ?? '') === $stageId) {
                return $stageId;
            }
        }
    }

    if ($callbacks !== []) {
        return 'intake_completed';
    }

    return 'lead_captured';
}

function flow_os_context_from_store(array $store): array
{
    $store = flow_os_prepare_store($store);
    $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
    $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];

    return [
        'missingIdentity' => false,
        'redFlagDetected' => false,
        'missedFollowup' => false,
        'callbackCount' => count($callbacks),
        'appointmentCount' => count($appointments),
    ];
}

function flow_os_resolve_next_actions(string $stageId, array $context = []): array
{
    $stage = flow_os_journey_stage_definition($stageId);
    if ($stage === null) {
        return [];
    }

    if (($context['redFlagDetected'] ?? false) === true) {
        return [[
            'id' => 'manual_review_required',
            'label' => 'Escalar a revisión clínica',
            'actor' => 'clinician',
            'priority' => 'critical',
        ]];
    }

    if (($context['missingIdentity'] ?? false) === true) {
        return [[
            'id' => 'request_identity_completion',
            'label' => 'Completar identidad del paciente',
            'actor' => 'frontdesk',
            'priority' => 'high',
        ]];
    }

    $defaultActionsMap = array_merge(
        flow_os_default_manifest()['defaultActions'] ?? [],
        flow_os_manifest()['defaultActions'] ?? []
    );
    $defaultActions = $defaultActionsMap[$stageId] ?? [];
    $labels = [
        'request_identity_completion' => 'Completar identidad del paciente',
        'offer_preconsultation_form' => 'Enviar formulario de preconsulta',
        'review_intake_summary' => 'Revisar resumen de preconsulta',
        'offer_best_slot' => 'Ofrecer mejor horario disponible',
        'confirm_appointment' => 'Confirmar cita',
        'prepare_chart' => 'Preparar resumen clínico',
        'deliver_care_plan' => 'Entregar plan de cuidado',
        'schedule_follow_up' => 'Agendar seguimiento',
        'request_progress_update' => 'Solicitar actualización de evolución',
        'review_follow_up_signals' => 'Revisar señales de seguimiento',
        'invite_feedback' => 'Solicitar retroalimentación',
        'archive_episode' => 'Archivar episodio',
    ];

    $actions = [];
    foreach ($defaultActions as $actionId) {
        $actions[] = [
            'id' => (string) $actionId,
            'label' => $labels[(string) $actionId] ?? (string) $actionId,
            'actor' => (string) ($stage['owner'] ?? 'frontdesk'),
            'priority' => 'normal',
        ];
    }

    return $actions;
}

function flow_os_build_delegation_plan(string $stageId, array $context = []): array
{
    switch ($stageId) {
        case 'intake_completed':
            return [[
                'worker' => 'intake-triage-worker',
                'goal' => 'summarize_intake_and_priority',
                'model' => 'gpt-5.4-mini',
            ]];
        case 'scheduled':
            return [[
                'worker' => 'appointment-worker',
                'goal' => 'confirm_appointment_and_prepare_chart',
                'model' => 'gpt-5.4-mini',
            ]];
        case 'care_plan_ready':
            return [
                [
                    'worker' => 'documentation-worker',
                    'goal' => 'package_care_plan_summary',
                    'model' => 'gpt-5.4-mini',
                ],
                [
                    'worker' => 'followup-worker',
                    'goal' => 'open_followup_loop',
                    'model' => 'gpt-5.4-mini',
                ],
            ];
        case 'follow_up_active':
            return [[
                'worker' => 'followup-worker',
                'goal' => ($context['missedFollowup'] ?? false) ? 'recover_lost_followup' : 'request_progress_update',
                'model' => 'gpt-5.4-mini',
            ]];
        default:
            return [];
    }
}

function flow_os_build_store_journey_preview(array $store, array $context = []): array
{
    $store = flow_os_prepare_store($store);
    $stageId = trim((string) ($context['stage'] ?? ''));
    if ($stageId === '') {
        $stageId = flow_os_detect_stage($store);
    }

    $stage = flow_os_journey_stage_definition($stageId);
    if ($stage === null) {
        $stageId = 'lead_captured';
        $stage = flow_os_journey_stage_definition($stageId) ?? [
            'id' => $stageId,
            'label' => 'Lead captado',
            'owner' => 'frontdesk',
            'next' => [],
        ];
    }

    $storeContext = array_merge(flow_os_context_from_store($store), $context);
    $actions = flow_os_resolve_next_actions($stageId, $storeContext);
    $delegation = flow_os_build_delegation_plan($stageId, $storeContext);
    $cases = flow_os_build_case_journey_preview_list($store);
    $alerts = [];

    if (($storeContext['redFlagDetected'] ?? false) === true) {
        $alerts[] = 'Hay señales clínicas para revisión manual.';
    }

    return [
        'stage' => $stageId,
        'displayStage' => flow_os_display_stage_id($stageId),
        'label' => (string) ($stage['label'] ?? $stageId),
        'displayStageLabel' => flow_os_display_stage_label($stageId),
        'owner' => (string) ($stage['owner'] ?? 'frontdesk'),
        'ownerLabel' => flow_os_owner_label((string) ($stage['owner'] ?? 'frontdesk')),
        'next' => isset($stage['next']) && is_array($stage['next']) ? array_values($stage['next']) : [],
        'nextActions' => $actions,
        'delegationPlan' => $delegation,
        'alerts' => $alerts,
        'timelineStages' => flow_os_timeline_stage_catalog(),
        'stageCounts' => flow_os_build_case_stage_counts($cases),
        'cases' => $cases,
        'redacted' => false,
        'generatedAt' => function_exists('local_date') ? local_date('c') : gmdate('c'),
    ];
}
