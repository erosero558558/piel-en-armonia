<?php

declare(strict_types=1);

final class FlowOsStore
{
public static function prepare_store(array $store): array
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

public static function merge_existing_cases(array $preparedCases, array $existingCases): array
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
            $preparedById[$caseId] = FlowOsStore::overlay_existing_case($preparedById[$caseId], $existingCase);
            continue;
        }

        $normalized = FlowOsStore::normalize_existing_case($existingCase);
        if ($normalized !== null) {
            $preparedById[$caseId] = $normalized;
        }
    }

    foreach ($preparedById as $case) {
        $merged[] = $case;
    }

    return array_values($merged);
}

public static function overlay_existing_case(array $case, array $existingCase): array
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

public static function normalize_existing_case(array $case): ?array
{
    $caseId = trim((string) ($case['id'] ?? ''));
    if ($caseId === '') {
        return null;
    }

    $openedAt = FlowOsTimeline::first_non_empty_timestamp([
        $case['openedAt'] ?? '',
        $case['latestActivityAt'] ?? '',
        $case['journeyEnteredAt'] ?? '',
        function_exists('local_date') ? local_date('c') : gmdate('c'),
    ]);
    $latestActivityAt = FlowOsTimeline::first_non_empty_timestamp([
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

public static function case_approvals_by_case_id(array $store): array
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

public static function case_appointments(array $case, array $appointments): array
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

public static function resolve_case_stage(array $case, array $approvals = [], array $appointments = []): string
{
    $explicitStage = FlowOsStore::explicit_case_stage($case);
    $inferredStage = FlowOsStore::infer_case_stage($case, $approvals, $appointments);

    if ($explicitStage === '') {
        return $inferredStage;
    }

    return FlowOsConfig::stage_index($inferredStage) > FlowOsConfig::stage_index($explicitStage)
        ? $inferredStage
        : $explicitStage;
}

public static function explicit_case_stage(array $case): string
{
    $explicitStage = trim((string) ($case['journeyStage'] ?? $case['stage'] ?? ''));
    return $explicitStage !== '' && FlowOsConfig::stage($explicitStage) !== null ? $explicitStage : '';
}

public static function case_has_completed_visit(array $case, array $appointments = []): bool
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

public static function infer_case_stage(array $case, array $approvals = [], array $appointments = []): string
{
    $status = strtolower(trim((string) ($case['status'] ?? '')));
    $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
    $milestones = isset($summary['milestones']) && is_array($summary['milestones']) ? $summary['milestones'] : [];
    $pendingApprovals = max(0, (int) ($summary['pendingApprovalCount'] ?? 0));
    $scheduledStart = trim((string) ($summary['scheduledStart'] ?? ''));
    $latestCallbackId = trim((string) ($summary['latestCallbackId'] ?? ''));
    $latestTicketId = trim((string) ($summary['latestTicketId'] ?? ''));
    $calledAt = trim((string) ($milestones['calledAt'] ?? ''));
    $hasCompletedVisit = FlowOsStore::case_has_completed_visit($case, $appointments);

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

    $hasCarePlanReady = $pendingApprovals > 0
        || $hasCompletedVisit
        || $calledAt !== ''
        || $latestTicketId !== '';
    $hasScheduled = $hasScheduledAppointment || $scheduledStart !== '';
    $hasIntakeCompleted = $latestCallbackId !== '';
    $hasLeadCaptured = trim((string) ($case['openedAt'] ?? '')) !== ''
        || trim((string) ($case['latestActivityAt'] ?? '')) !== ''
        || trim((string) ($summary['patientLabel'] ?? '')) !== '';

    if (FlowOsTimeline::case_has_follow_up_signal($case, $approvals)) {
        return 'follow_up_active';
    }

    if ($hasCarePlanReady) {
        return 'care_plan_ready';
    }

    if ($hasScheduled) {
        return 'scheduled';
    }

    if ($hasIntakeCompleted) {
        return 'intake_completed';
    }

    if ($hasLeadCaptured) {
        return 'lead_captured';
    }

    return 'lead_captured';
}

public static function context_from_store(array $store): array
{
    $store = FlowOsStore::prepare_store($store);
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

public static function resolve_next_actions(string $stageId, array $context = []): array
{
    $stage = FlowOsConfig::journey_stage_definition($stageId);
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
        FlowOsConfig::default_manifest()['defaultActions'] ?? [],
        FlowOsConfig::manifest()['defaultActions'] ?? []
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

public static function build_delegation_plan(string $stageId, array $context = []): array
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

public static function build_journey_snapshot(string $stageId, array $context = []): array
{
    $cases = isset($context['cases']) && is_array($context['cases'])
        ? array_values($context['cases'])
        : [];
    $stage = FlowOsConfig::stage($stageId);
    if ($stage === null) {
        $stageId = 'lead_captured';
        $stage = FlowOsConfig::journey_stage_definition($stageId) ?? [
            'id' => $stageId,
            'label' => 'Lead captado',
            'owner' => 'frontdesk',
            'next' => [],
        ];
    }

    $actions = FlowOsStore::resolve_next_actions($stageId, $context);
    $delegation = FlowOsStore::build_delegation_plan($stageId, $context);
    $alerts = [];

    if (($context['redFlagDetected'] ?? false) === true) {
        $alerts[] = 'Hay señales clínicas para revisión manual.';
    }

    return [
        'stage' => $stageId,
        'displayStage' => FlowOsConfig::display_stage_id($stageId),
        'label' => (string) ($stage['label'] ?? $stageId),
        'displayStageLabel' => FlowOsConfig::display_stage_label($stageId),
        'owner' => (string) ($stage['owner'] ?? 'frontdesk'),
        'ownerLabel' => FlowOsConfig::owner_label((string) ($stage['owner'] ?? 'frontdesk')),
        'next' => isset($stage['next']) && is_array($stage['next']) ? array_values($stage['next']) : [],
        'nextActions' => $actions,
        'delegationPlan' => $delegation,
        'alerts' => $alerts,
        'timelineStages' => FlowOsConfig::timeline_stage_catalog(),
        'stageCounts' => FlowOsStore::build_case_stage_counts($cases),
        'activityFeed' => FlowOsTimeline::build_journey_activity_feed($cases),
        'cases' => $cases,
        'redacted' => false,
        'generatedAt' => function_exists('local_date') ? local_date('c') : gmdate('c'),
    ];
}

public static function build_case_stage_counts(array $cases): array
{
    $counts = [];
    foreach ($cases as $case) {
        if (!is_array($case)) {
            continue;
        }

        $stageId = trim((string) ($case['displayStage'] ?? ($case['stage'] ?? '')));
        if ($stageId === '') {
            continue;
        }

        $counts[$stageId] = (int) ($counts[$stageId] ?? 0) + 1;
    }

    foreach (FlowOsConfig::timeline_stage_catalog() as $stage) {
        $displayId = trim((string) ($stage['displayId'] ?? ($stage['id'] ?? '')));
        if ($displayId !== '' && !array_key_exists($displayId, $counts)) {
            $counts[$displayId] = 0;
        }
    }

    return $counts;
}

public static function build_preview_cases(array $store, array $historyCases): array
{
    $rawCases = isset($store['patient_cases']) && is_array($store['patient_cases']) ? $store['patient_cases'] : [];
    $rawCaseMap = [];

    foreach ($rawCases as $rawCase) {
        if (!is_array($rawCase)) {
            continue;
        }

        $caseId = trim((string) ($rawCase['id'] ?? ''));
        if ($caseId !== '') {
            $rawCaseMap[$caseId] = $rawCase;
        }
    }

    $cases = [];
    foreach ($historyCases as $entry) {
        if (!is_array($entry)) {
            continue;
        }

        $caseId = trim((string) ($entry['caseId'] ?? ''));
        if ($caseId === '') {
            continue;
        }

        $rawCase = $rawCaseMap[$caseId] ?? [];
        $summary = isset($rawCase['summary']) && is_array($rawCase['summary']) ? $rawCase['summary'] : [];
        $stageId = trim((string) ($entry['currentStage'] ?? ''));
        if ($stageId === '') {
            $stageId = FlowOsStore::detect_case_stage($rawCase);
        }

        $journeyHistory = FlowOsTimeline::normalize_case_journey_history($entry, $stageId);
        $currentEntry = null;
        foreach (array_reverse($journeyHistory) as $historyEntry) {
            if (($historyEntry['isCurrentStage'] ?? false) === true) {
                $currentEntry = $historyEntry;
                break;
            }
        }
        if ($currentEntry === null && $journeyHistory !== []) {
            $currentEntry = $journeyHistory[count($journeyHistory) - 1];
        }

        $enteredAt = trim((string) ($currentEntry['timestamp'] ?? ''));
        if ($enteredAt === '') {
            $enteredAt = trim((string) ($entry['latestActivityAt'] ?? ($entry['openedAt'] ?? '')));
        }

        $nextActions = FlowOsStore::resolve_next_actions($stageId);
        $nextAction = $nextActions !== [] && is_array($nextActions[0] ?? null)
            ? trim((string) ($nextActions[0]['label'] ?? ''))
            : '';
        $owner = trim((string) ($entry['owner'] ?? ((FlowOsConfig::stage($stageId)['owner'] ?? 'frontdesk'))));

        $cases[] = [
            'caseId' => $caseId,
            'patientId' => trim((string) ($entry['patientId'] ?? '')),
            'patientLabel' => trim((string) ($entry['patientLabel'] ?? '')),
            'serviceLine' => trim((string) ($summary['serviceLine'] ?? ($summary['service'] ?? ''))),
            'providerName' => trim((string) ($summary['providerName'] ?? ($summary['doctorLabel'] ?? ($summary['doctor'] ?? '')))),
            'stage' => $stageId,
            'displayStage' => FlowOsConfig::display_stage_id($stageId),
            'stageLabel' => FlowOsConfig::stage_label($stageId),
            'displayStageLabel' => FlowOsConfig::display_stage_label($stageId),
            'owner' => $owner,
            'ownerLabel' => trim((string) ($entry['ownerLabel'] ?? FlowOsConfig::owner_label($owner))),
            'enteredAt' => $enteredAt,
            'timeInStageMs' => FlowOsTimeline::case_preview_time_in_stage_ms($enteredAt),
            'nextActions' => $nextActions,
            'nextActionLabel' => $nextAction,
            'alerts' => [],
            'journeyHistory' => $journeyHistory,
        ];
    }

    return $cases;
}

public static function case_has_appointment(array $case): bool
{
    $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];

    return trim((string) ($summary['latestAppointmentId'] ?? '')) !== ''
        || trim((string) ($summary['primaryAppointmentId'] ?? '')) !== ''
        || trim((string) ($summary['scheduledStart'] ?? '')) !== '';
}

public static function detect_case_stage(array $case, array $callbacks = [], array $approvals = []): string
{
    $status = strtolower(trim((string) ($case['status'] ?? '')));
    if (FlowOsConfig::is_terminal_case_status($status) || trim((string) ($case['closedAt'] ?? '')) !== '') {
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

    if (FlowOsStore::case_has_appointment($case)) {
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

}
