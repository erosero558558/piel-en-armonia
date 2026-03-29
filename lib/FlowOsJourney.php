<?php

declare(strict_types=1);

require_once __DIR__ . '/flow_os_manifest.php';

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
    $owners = flow_os_manifest()['owners'] ?? [];
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
    $cases = isset($store['patient_cases']) && is_array($store['patient_cases']) ? $store['patient_cases'] : [];
    $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
    $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
    $approvals = isset($store['patient_case_approvals']) && is_array($store['patient_case_approvals'])
        ? $store['patient_case_approvals']
        : [];

    $hasOpenCase = false;
    $hasClosedCase = false;
    $hasCarePlanReady = false;
    $hasFollowUpActive = false;

    foreach ($cases as $case) {
        if (!is_array($case)) {
            continue;
        }

        $status = strtolower(trim((string) ($case['status'] ?? '')));
        if ($status === '') {
            continue;
        }

        if (in_array($status, ['resolved', 'closed', 'completed', 'archived'], true)) {
            $hasClosedCase = true;
            continue;
        }

        $hasOpenCase = true;
        if (in_array($status, ['care_plan_ready', 'plan_ready', 'ready_for_plan'], true)) {
            $hasCarePlanReady = true;
        }
        if (in_array($status, ['follow_up_active', 'under_followup', 'monitoring', 'treatment_started'], true)) {
            $hasFollowUpActive = true;
        }
    }

    foreach ($approvals as $approval) {
        if (!is_array($approval)) {
            continue;
        }
        $status = strtolower(trim((string) ($approval['status'] ?? '')));
        if ($status === 'pending' || $status === 'approved') {
            $hasCarePlanReady = true;
            break;
        }
    }

    if ($hasFollowUpActive) {
        return 'follow_up_active';
    }

    if ($hasCarePlanReady || $hasOpenCase) {
        return 'care_plan_ready';
    }

    if ($appointments !== []) {
        return 'scheduled';
    }

    if ($callbacks !== []) {
        return 'intake_completed';
    }

    if ($hasClosedCase) {
        return 'resolved';
    }

    return 'lead_captured';
}

function flow_os_context_from_store(array $store): array
{
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
    $stage = flow_os_stage($stageId);
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

    $defaultActions = flow_os_manifest()['defaultActions'][$stageId] ?? [];
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

function flow_os_build_journey_snapshot(string $stageId, array $context = []): array
{
    $stage = flow_os_stage($stageId);
    if ($stage === null) {
        $stageId = 'lead_captured';
        $stage = flow_os_stage($stageId) ?? [
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
        'label' => (string) ($stage['label'] ?? $stageId),
        'owner' => (string) ($stage['owner'] ?? 'frontdesk'),
        'ownerLabel' => flow_os_owner_label((string) ($stage['owner'] ?? 'frontdesk')),
        'next' => isset($stage['next']) && is_array($stage['next']) ? array_values($stage['next']) : [],
        'nextActions' => $actions,
        'delegationPlan' => $delegation,
        'alerts' => $alerts,
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
