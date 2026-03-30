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

function flow_os_stage_label(string $stageId): string
{
    $stage = flow_os_stage($stageId);
    return $stage !== null ? (string) ($stage['label'] ?? $stageId) : $stageId;
}

function flow_os_stage_rank_map(): array
{
    static $map = null;
    if ($map !== null) {
        return $map;
    }

    $map = [];
    foreach (flow_os_manifest()['journeyStages'] as $index => $stage) {
        if (is_array($stage) && isset($stage['id'])) {
            $map[(string) $stage['id']] = (int) $index;
        }
    }

    return $map;
}

function flow_os_detect_stage(array $store): string
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
    if (!isset($store['patient_cases']) || !is_array($store['patient_cases'])) {
        $store['patient_cases'] = [];
        return $store;
    }

    $store['patient_cases'] = array_values(array_filter(
        $store['patient_cases'],
        static fn($case): bool => is_array($case)
    ));

    return $store;
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

function flow_os_earliest_timestamp(array $values): string
{
    $earliest = '';
    foreach ($values as $value) {
        $normalized = trim((string) $value);
        if ($normalized === '') {
            continue;
        }

        if ($earliest === '' || strcmp($earliest, $normalized) > 0) {
            $earliest = $normalized;
        }
    }

    return $earliest;
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

    if ($hasLeadCaptured || $callbacks !== []) {
        return 'lead_captured';
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
            'label' => 'Solicitar datos de identidad',
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
        'request_identity_completion' => 'Solicitar datos de identidad',
        'offer_preconsultation_form' => 'Enviar formulario de preconsulta',
        'review_intake_summary' => 'Revisar resumen de preconsulta',
        'offer_best_slot' => 'Ofrecer mejor horario disponible',
        'confirm_appointment' => 'Confirmar cita',
        'prepare_chart' => 'Preparar resumen clínico',
        'deliver_care_plan' => 'Enviar plan al paciente',
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

function flow_os_build_journey_snapshot(string $stageId, array $context = []): array
{
    $stage = flow_os_stage($stageId);
    if ($stage === null) {
        $stageId = 'lead_captured';
        $stage = flow_os_journey_stage_definition($stageId) ?? [
            'id' => $stageId,
            'label' => 'Lead captado',
            'owner' => 'frontdesk',
            'next' => [],
        ];
    }

    $actions = flow_os_resolve_next_actions($stageId, $context);
    $delegation = flow_os_build_delegation_plan($stageId, $context);
    $alerts = [];

    if (($context['redFlagDetected'] ?? false) === true) {
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
        'activityFeed' => flow_os_build_journey_activity_feed($cases),
        'cases' => $cases,
        'redacted' => false,
        'generatedAt' => function_exists('local_date') ? local_date('c') : gmdate('c'),
    ];
}

function flow_os_case_has_appointment(array $case): bool
{
    $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];

    return trim((string) ($summary['latestAppointmentId'] ?? '')) !== ''
        || trim((string) ($summary['primaryAppointmentId'] ?? '')) !== ''
        || trim((string) ($summary['scheduledStart'] ?? '')) !== '';
}

function flow_os_is_terminal_case_status(string $status): bool
{
    return in_array($status, ['resolved', 'closed', 'completed', 'archived', 'cancelled', 'no_show'], true);
}

function flow_os_detect_case_stage(array $case, array $callbacks = [], array $approvals = []): string
{
    $status = strtolower(trim((string) ($case['status'] ?? '')));
    if (flow_os_is_terminal_case_status($status) || trim((string) ($case['closedAt'] ?? '')) !== '') {
        return 'resolved';
    }

    if (in_array($status, ['follow_up_active', 'under_followup', 'monitoring', 'treatment_started'], true)) {
        return 'follow_up_active';
    }

    foreach ($approvals as $approval) {
        if (!is_array($approval)) {
            continue;
        }
        $approvalStatus = strtolower(trim((string) ($approval['status'] ?? '')));
        if (in_array($approvalStatus, ['pending', 'approved'], true)) {
            return 'care_plan_ready';
        }
    }

    if (flow_os_case_has_appointment($case)) {
        return 'scheduled';
    }

    foreach ($callbacks as $callback) {
        if (!is_array($callback)) {
            continue;
        }

        $leadOps = isset($callback['leadOps']) && is_array($callback['leadOps']) ? $callback['leadOps'] : [];
        $contactedAt = trim((string) ($leadOps['contactedAt'] ?? ''));
        $callbackStatus = strtolower(trim((string) ($callback['status'] ?? '')));
        if ($contactedAt !== '' || in_array($callbackStatus, ['contacted', 'contactado', 'completed', 'completado', 'done'], true)) {
            return 'intake_completed';
        }
    }

    if ($callbacks !== []) {
        return 'lead_captured';
    }

    return 'lead_captured';
}

function flow_os_compare_transitions_asc(array $left, array $right): int
{
    $leftAt = trim((string) ($left['occurredAt'] ?? ''));
    $rightAt = trim((string) ($right['occurredAt'] ?? ''));
    if ($leftAt !== $rightAt) {
        return strcmp($leftAt, $rightAt);
    }

    $rankMap = flow_os_stage_rank_map();
    $leftRank = $rankMap[(string) ($left['stage'] ?? '')] ?? 999;
    $rightRank = $rankMap[(string) ($right['stage'] ?? '')] ?? 999;
    if ($leftRank !== $rightRank) {
        return $leftRank <=> $rightRank;
    }

    return strcmp((string) ($left['title'] ?? ''), (string) ($right['title'] ?? ''));
}

function flow_os_compare_transitions_desc(array $left, array $right): int
{
    return flow_os_compare_transitions_asc($right, $left);
}

function flow_os_build_transition_entry(
    string $stageId,
    string $occurredAt,
    string $title,
    string $actor,
    array $extra = []
): array {
    $actorLabel = trim((string) ($extra['actorLabel'] ?? ''));
    if ($actorLabel === '') {
        $actorLabel = flow_os_owner_label($actor);
    }

    return array_merge([
        'stage' => $stageId,
        'stageLabel' => flow_os_stage_label($stageId),
        'title' => trim($title) !== '' ? trim($title) : flow_os_stage_label($stageId),
        'actor' => trim($actor),
        'actorLabel' => $actorLabel,
        'occurredAt' => trim($occurredAt),
        'sourceType' => trim((string) ($extra['sourceType'] ?? '')),
        'sourceId' => trim((string) ($extra['sourceId'] ?? '')),
        'sourceTitle' => trim((string) ($extra['sourceTitle'] ?? $title)),
        'meta' => trim((string) ($extra['meta'] ?? '')),
    ], $extra);
}

function flow_os_build_case_journey_timeline(array $case, array $callbacks, array $events, array $approvals): array
{
    $caseId = trim((string) ($case['id'] ?? ''));
    $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
    $currentStage = flow_os_detect_case_stage($case, $callbacks, $approvals);
    $hasAppointment = flow_os_case_has_appointment($case);
    $candidates = [];

    foreach ($callbacks as $callback) {
        if (!is_array($callback)) {
            continue;
        }

        $createdAt = trim((string) ($callback['fecha'] ?? ($callback['createdAt'] ?? '')));
        if ($createdAt !== '') {
            $callbackStatus = trim((string) ($callback['status'] ?? 'pendiente'));
            $candidates[] = flow_os_build_transition_entry(
                'lead_captured',
                $createdAt,
                'Lead captado',
                'frontdesk',
                [
                    'caseId' => $caseId,
                    'sourceType' => 'callback_created',
                    'sourceId' => trim((string) ($callback['id'] ?? '')),
                    'sourceTitle' => 'Callback registrado',
                    'meta' => $callbackStatus !== '' ? 'Callback: ' . $callbackStatus : 'Callback registrado',
                ]
            );
        }

        $leadOps = isset($callback['leadOps']) && is_array($callback['leadOps']) ? $callback['leadOps'] : [];
        $contactedAt = trim((string) ($leadOps['contactedAt'] ?? ''));
        if ($contactedAt !== '') {
            $actorLabel = trim((string) ($leadOps['ownerLabel'] ?? ''));
            if ($actorLabel === '') {
                $actorLabel = trim((string) ($leadOps['owner'] ?? ''));
            }
            $candidates[] = flow_os_build_transition_entry(
                'intake_completed',
                $contactedAt,
                'Preconsulta atendida',
                'intake-triage-worker',
                [
                    'caseId' => $caseId,
                    'sourceType' => 'callback_contacted',
                    'sourceId' => trim((string) ($callback['id'] ?? '')),
                    'sourceTitle' => 'Contacto inicial completado',
                    'actorLabel' => $actorLabel,
                    'meta' => 'Contacto inicial resuelto',
                ]
            );
        }
    }

    foreach ($events as $event) {
        if (!is_array($event)) {
            continue;
        }

        $type = strtolower(trim((string) ($event['type'] ?? '')));
        $createdAt = trim((string) ($event['createdAt'] ?? ''));
        $title = trim((string) ($event['title'] ?? ''));
        $payload = isset($event['payload']) && is_array($event['payload']) ? $event['payload'] : [];
        if ($createdAt === '' || $type === '') {
            continue;
        }

        if ($type === 'case_opened') {
            $candidates[] = flow_os_build_transition_entry(
                'lead_captured',
                $createdAt,
                $title !== '' ? $title : 'Lead captado',
                'frontdesk',
                [
                    'caseId' => $caseId,
                    'sourceType' => $type,
                    'sourceId' => trim((string) ($event['id'] ?? '')),
                    'sourceTitle' => $title !== '' ? $title : 'Caso abierto',
                    'meta' => $title !== '' ? $title : 'Caso abierto',
                ]
            );
            continue;
        }

        if ($type === 'appointment_created') {
            $doctor = trim((string) ($payload['doctor'] ?? ''));
            $candidates[] = flow_os_build_transition_entry(
                'scheduled',
                $createdAt,
                $title !== '' ? $title : 'Reserva confirmada',
                'appointment-worker',
                [
                    'caseId' => $caseId,
                    'sourceType' => $type,
                    'sourceId' => trim((string) ($event['id'] ?? '')),
                    'sourceTitle' => $title !== '' ? $title : 'Reserva confirmada',
                    'meta' => $doctor !== '' ? 'Agenda: ' . $doctor : 'Agenda confirmada',
                ]
            );
            continue;
        }

        if ($type === 'visit_completed' || $type === 'no_show') {
            $candidates[] = flow_os_build_transition_entry(
                'resolved',
                $createdAt,
                $title !== '' ? $title : ($type === 'visit_completed' ? 'Consulta cerrada' : 'Paciente no asistio'),
                $type === 'visit_completed' ? 'clinician' : 'frontdesk',
                [
                    'caseId' => $caseId,
                    'sourceType' => $type,
                    'sourceId' => trim((string) ($event['id'] ?? '')),
                    'sourceTitle' => $title !== '' ? $title : 'Caso resuelto',
                    'meta' => $title !== '' ? $title : 'Caso resuelto',
                ]
            );
            continue;
        }

        if ($type !== 'status_changed') {
            continue;
        }

        $status = strtolower(trim((string) ($payload['status'] ?? '')));
        if (in_array($status, ['cancelled', 'no_show'], true)) {
            $candidates[] = flow_os_build_transition_entry(
                'resolved',
                $createdAt,
                $title !== '' ? $title : 'Caso resuelto',
                'frontdesk',
                [
                    'caseId' => $caseId,
                    'sourceType' => $type,
                    'sourceId' => trim((string) ($event['id'] ?? '')),
                    'sourceTitle' => $title !== '' ? $title : 'Caso resuelto',
                    'meta' => $title !== '' ? $title : 'Caso resuelto',
                ]
            );
            continue;
        }

        if (isset($payload['helpRequestId'])) {
            continue;
        }

        if (in_array($status, ['arrived', 'checked_in'], true) && !$hasAppointment) {
            $candidates[] = flow_os_build_transition_entry(
                'lead_captured',
                $createdAt,
                $title !== '' ? $title : 'Paciente registrado',
                'frontdesk',
                [
                    'caseId' => $caseId,
                    'sourceType' => $type,
                    'sourceId' => trim((string) ($event['id'] ?? '')),
                    'sourceTitle' => $title !== '' ? $title : 'Paciente registrado',
                    'meta' => $title !== '' ? $title : 'Paciente registrado',
                ]
            );
        }
    }

    foreach ($approvals as $approval) {
        if (!is_array($approval)) {
            continue;
        }

        $status = strtolower(trim((string) ($approval['status'] ?? '')));
        if (!in_array($status, ['pending', 'approved'], true)) {
            continue;
        }

        $occurredAt = $status === 'approved'
            ? trim((string) ($approval['resolvedAt'] ?? ''))
            : trim((string) ($approval['createdAt'] ?? ''));
        if ($occurredAt === '') {
            $occurredAt = trim((string) ($approval['updatedAt'] ?? ''));
        }
        if ($occurredAt === '') {
            continue;
        }

        $reason = trim((string) ($approval['reason'] ?? ''));
        $requestedBy = trim((string) ($approval['requestedBy'] ?? ''));
        $resolvedBy = trim((string) ($approval['resolvedBy'] ?? ''));
        $actorLabel = $status === 'approved' && $resolvedBy !== ''
            ? $resolvedBy
            : ($requestedBy !== '' ? $requestedBy : flow_os_owner_label('clinician'));

        $candidates[] = flow_os_build_transition_entry(
            'care_plan_ready',
            $occurredAt,
            $status === 'approved' ? 'Plan de cuidado aprobado' : 'Plan de cuidado en revision',
            'clinician',
            [
                'caseId' => $caseId,
                'sourceType' => 'approval_' . $status,
                'sourceId' => trim((string) ($approval['id'] ?? '')),
                'sourceTitle' => $status === 'approved' ? 'Plan de cuidado aprobado' : 'Plan de cuidado en revision',
                'actorLabel' => $actorLabel,
                'meta' => $reason !== '' ? $reason : ($status === 'approved' ? 'Aprobacion clinica resuelta' : 'Esperando decision clinica'),
            ]
        );
    }

    if ($candidates === []) {
        $fallbackAt = trim((string) ($case['openedAt'] ?? ''));
        if ($fallbackAt === '') {
            $fallbackAt = trim((string) ($case['latestActivityAt'] ?? ''));
        }
        if ($fallbackAt !== '') {
            $candidates[] = flow_os_build_transition_entry(
                $currentStage,
                $fallbackAt,
                flow_os_stage_label($currentStage),
                (string) (flow_os_stage($currentStage)['owner'] ?? 'frontdesk'),
                [
                    'caseId' => $caseId,
                    'sourceType' => 'case_fallback',
                    'sourceTitle' => 'Caso trazado',
                    'meta' => 'Caso trazado desde el store clinico',
                ]
            );
        }
    }

    usort($candidates, 'flow_os_compare_transitions_asc');

    $timeline = [];
    $lastStage = null;
    foreach ($candidates as $candidate) {
        $stage = trim((string) ($candidate['stage'] ?? ''));
        $occurredAt = trim((string) ($candidate['occurredAt'] ?? ''));
        if ($stage === '' || $occurredAt === '') {
            continue;
        }
        if ($lastStage === $stage) {
            continue;
        }
        $timeline[] = $candidate;
        $lastStage = $stage;
    }

    $hasCurrentStage = false;
    foreach ($timeline as $entry) {
        if ((string) ($entry['stage'] ?? '') === $currentStage) {
            $hasCurrentStage = true;
            break;
        }
    }

    if (!$hasCurrentStage) {
        $fallbackAt = trim((string) ($case['latestActivityAt'] ?? ''));
        if ($fallbackAt === '') {
            $fallbackAt = trim((string) ($case['openedAt'] ?? ''));
        }
        if ($fallbackAt !== '') {
            $timeline[] = flow_os_build_transition_entry(
                $currentStage,
                $fallbackAt,
                flow_os_stage_label($currentStage),
                (string) (flow_os_stage($currentStage)['owner'] ?? 'frontdesk'),
                [
                    'caseId' => $caseId,
                    'sourceType' => 'current_stage',
                    'sourceTitle' => 'Etapa actual',
                    'meta' => 'Stage actual derivado del caso',
                ]
            );
            usort($timeline, 'flow_os_compare_transitions_asc');
        }
    }

    return $timeline;
}

function flow_os_build_store_journey_history(array $store): array
{
    $cases = isset($store['patient_cases']) && is_array($store['patient_cases']) ? $store['patient_cases'] : [];
    $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
    $timelineEvents = isset($store['patient_case_timeline_events']) && is_array($store['patient_case_timeline_events'])
        ? $store['patient_case_timeline_events']
        : [];
    $approvals = isset($store['patient_case_approvals']) && is_array($store['patient_case_approvals'])
        ? $store['patient_case_approvals']
        : [];

    $callbacksByCaseId = [];
    foreach ($callbacks as $callback) {
        if (!is_array($callback)) {
            continue;
        }
        $caseId = trim((string) ($callback['patientCaseId'] ?? ''));
        if ($caseId === '') {
            continue;
        }
        if (!isset($callbacksByCaseId[$caseId])) {
            $callbacksByCaseId[$caseId] = [];
        }
        $callbacksByCaseId[$caseId][] = $callback;
    }

    $eventsByCaseId = [];
    foreach ($timelineEvents as $event) {
        if (!is_array($event)) {
            continue;
        }
        $caseId = trim((string) ($event['patientCaseId'] ?? ''));
        if ($caseId === '') {
            continue;
        }
        if (!isset($eventsByCaseId[$caseId])) {
            $eventsByCaseId[$caseId] = [];
        }
        $eventsByCaseId[$caseId][] = $event;
    }

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

    $caseHistory = [];
    foreach ($cases as $case) {
        if (!is_array($case)) {
            continue;
        }

        $caseId = trim((string) ($case['id'] ?? ''));
        if ($caseId === '') {
            continue;
        }

        $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
        $caseCallbacks = $callbacksByCaseId[$caseId] ?? [];
        $caseApprovals = $approvalsByCaseId[$caseId] ?? [];
        $currentStage = flow_os_detect_case_stage($case, $caseCallbacks, $caseApprovals);
        $timeline = flow_os_build_case_journey_timeline(
            $case,
            $caseCallbacks,
            $eventsByCaseId[$caseId] ?? [],
            $caseApprovals
        );
        $latestEntry = $timeline !== [] ? $timeline[count($timeline) - 1] : null;

        $caseHistory[] = [
            'caseId' => $caseId,
            'patientId' => trim((string) ($case['patientId'] ?? '')),
            'patientLabel' => trim((string) ($summary['patientLabel'] ?? '')) !== ''
                ? trim((string) ($summary['patientLabel'] ?? ''))
                : ('Caso ' . substr($caseId, -6)),
            'caseStatus' => trim((string) ($case['status'] ?? '')),
            'currentStage' => $currentStage,
            'currentStageLabel' => flow_os_stage_label($currentStage),
            'owner' => (string) (flow_os_stage($currentStage)['owner'] ?? 'frontdesk'),
            'ownerLabel' => flow_os_owner_label((string) (flow_os_stage($currentStage)['owner'] ?? 'frontdesk')),
            'openedAt' => trim((string) ($case['openedAt'] ?? '')),
            'latestActivityAt' => trim((string) ($case['latestActivityAt'] ?? '')),
            'timelineCount' => count($timeline),
            'currentTransitionTitle' => trim((string) ($latestEntry['title'] ?? '')),
            'timeline' => $timeline,
        ];
    }

    usort($caseHistory, static function (array $left, array $right): int {
        $leftOpen = !flow_os_is_terminal_case_status(strtolower(trim((string) ($left['caseStatus'] ?? ''))));
        $rightOpen = !flow_os_is_terminal_case_status(strtolower(trim((string) ($right['caseStatus'] ?? ''))));
        if ($leftOpen !== $rightOpen) {
            return $leftOpen ? -1 : 1;
        }

        $leftAt = trim((string) ($left['latestActivityAt'] ?? ($left['openedAt'] ?? '')));
        $rightAt = trim((string) ($right['latestActivityAt'] ?? ($right['openedAt'] ?? '')));
        return strcmp($rightAt, $leftAt);
    });

    $recentTransitions = [];
    foreach ($caseHistory as $entry) {
        foreach ($entry['timeline'] as $transition) {
            $recentTransitions[] = array_merge($transition, [
                'caseId' => $entry['caseId'],
                'patientId' => $entry['patientId'],
                'patientLabel' => $entry['patientLabel'],
                'caseStatus' => $entry['caseStatus'],
            ]);
        }
    }
    usort($recentTransitions, 'flow_os_compare_transitions_desc');

    $selectedCaseId = $caseHistory !== [] ? (string) ($caseHistory[0]['caseId'] ?? '') : null;

    return [
        'selectedCaseId' => $selectedCaseId !== '' ? $selectedCaseId : null,
        'cases' => $caseHistory,
        'recentTransitions' => array_slice($recentTransitions, 0, 12),
        'generatedAt' => function_exists('local_date') ? local_date('c') : gmdate('c'),
    ];
}

function flow_os_find_case_journey_history(array $store, string $caseId): ?array
{
    $needle = trim($caseId);
    if ($needle === '') {
        return null;
    }

    $history = flow_os_build_store_journey_history($store);
    foreach ($history['cases'] as $entry) {
        if ((string) ($entry['caseId'] ?? '') === $needle) {
            return $entry;
        }
    }

    return null;
}

function flow_os_build_store_journey_preview(array $store, array $context = []): array
{
    $stageId = trim((string) ($context['stage'] ?? ''));
    if ($stageId === '') {
        $stageId = flow_os_detect_stage($store);
    }

    return flow_os_build_journey_snapshot(
        $stageId,
        array_merge(flow_os_context_from_store($store), $context)
    );
}

function flow_os_build_case_journey_preview(array $store, string $caseId, array $context = []): array
{
    $caseHistory = flow_os_find_case_journey_history($store, $caseId);
    if ($caseHistory === null) {
        return flow_os_build_store_journey_preview($store, $context);
    }

    $stageId = trim((string) ($context['stage'] ?? ''));
    if ($stageId === '') {
        $stageId = (string) ($caseHistory['currentStage'] ?? '');
    }
    if ($stageId === '') {
        $stageId = flow_os_detect_stage($store);
    }

    return array_merge(
        flow_os_build_journey_snapshot(
            $stageId,
            array_merge(flow_os_context_from_store($store), $context)
        ),
        [
            'caseId' => (string) ($caseHistory['caseId'] ?? ''),
            'patientId' => (string) ($caseHistory['patientId'] ?? ''),
            'patientLabel' => (string) ($caseHistory['patientLabel'] ?? ''),
            'caseStatus' => (string) ($caseHistory['caseStatus'] ?? ''),
            'timelineCount' => (int) ($caseHistory['timelineCount'] ?? 0),
            'latestActivityAt' => (string) ($caseHistory['latestActivityAt'] ?? ''),
            'openedAt' => (string) ($caseHistory['openedAt'] ?? ''),
            'timeline' => is_array($caseHistory['timeline'] ?? null) ? $caseHistory['timeline'] : [],
        ]
    );
}
