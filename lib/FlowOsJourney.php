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

function flow_os_detect_stage(array $store): string
{
    $cases = isset($store['patient_cases']) && is_array($store['patient_cases']) ? $store['patient_cases'] : [];
    $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
    $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
    $approvals = isset($store['patient_case_approvals']) && is_array($store['patient_case_approvals'])
        ? $store['patient_case_approvals']
        : [];

    $hasLeadCaptured = false;
    $hasIntakeCompleted = false;
    $hasScheduled = false;
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

        if ($status === 'lead_captured') {
            $hasLeadCaptured = true;
            continue;
        }

        if ($status === 'intake_completed') {
            $hasIntakeCompleted = true;
            continue;
        }

        if ($status === 'scheduled' || $status === 'booked') {
            $hasScheduled = true;
            continue;
        }

        if (in_array($status, ['resolved', 'closed', 'completed', 'archived'], true)) {
            $hasClosedCase = true;
            continue;
        }

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

function flow_os_build_store_journey_preview(array $store, array $context = []): array
{
    $stageId = trim((string) ($context['stage'] ?? ''));
    if ($stageId === '') {
        $stageId = flow_os_detect_stage($store);
    }

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

    $storeContext = array_merge(flow_os_context_from_store($store), $context);
    $actions = flow_os_resolve_next_actions($stageId, $storeContext);
    $delegation = flow_os_build_delegation_plan($stageId, $storeContext);
    $alerts = [];

    if (($storeContext['redFlagDetected'] ?? false) === true) {
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
