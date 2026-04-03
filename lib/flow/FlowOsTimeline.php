<?php

declare(strict_types=1);

final class FlowOsTimeline
{
public static function first_non_empty_timestamp(array $values): string
{
    foreach ($values as $value) {
        $normalized = trim((string) $value);
        if ($normalized !== '') {
            return $normalized;
        }
    }

    return '';
}

public static function latest_timestamp(array $values): string
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

public static function earliest_timestamp(array $values): string
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

public static function case_has_follow_up_signal(array $case, array $approvals = []): bool
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

public static function build_journey_activity_feed(array $cases): array
{
    $feed = [];

    foreach ($cases as $case) {
        if (!is_array($case)) {
            continue;
        }

        $history = isset($case['journeyHistory']) && is_array($case['journeyHistory'])
            ? array_values($case['journeyHistory'])
            : [];
        if ($history === []) {
            continue;
        }

        $currentEntries = array_values(array_filter($history, static function ($entry): bool {
            return is_array($entry) && (($entry['isCurrentStage'] ?? false) === true);
        }));

        $entry = $currentEntries !== []
            ? $currentEntries[count($currentEntries) - 1]
            : $history[count($history) - 1];
        if (!is_array($entry)) {
            continue;
        }

        $feed[] = $entry;
    }

    usort($feed, static function (array $left, array $right): int {
        return strcmp(
            trim((string) ($right['timestamp'] ?? '')),
            trim((string) ($left['timestamp'] ?? ''))
        );
    });

    return array_slice($feed, 0, 12);
}

public static function case_preview_time_in_stage_ms(string $enteredAt): int
{
    $timestamp = strtotime($enteredAt);
    if ($timestamp === false) {
        return 0;
    }

    return max(0, (time() - $timestamp) * 1000);
}

public static function normalize_case_journey_history(array $entry, string $currentStage): array
{
    $caseId = trim((string) ($entry['caseId'] ?? ''));
    $patientLabel = trim((string) ($entry['patientLabel'] ?? ''));
    $timeline = isset($entry['timeline']) && is_array($entry['timeline'])
        ? array_values($entry['timeline'])
        : [];
    $rankMap = FlowOsConfig::stage_rank_map();
    $history = [];

    foreach ($timeline as $index => $transition) {
        if (!is_array($transition)) {
            continue;
        }

        $stageId = trim((string) ($transition['stage'] ?? ''));
        $timestamp = trim((string) ($transition['occurredAt'] ?? ($transition['timestamp'] ?? '')));
        if ($stageId === '' || $timestamp === '') {
            continue;
        }

        $history[] = [
            'id' => trim((string) ($transition['id'] ?? '')) !== ''
                ? trim((string) ($transition['id'] ?? ''))
                : $caseId . '-history-' . $index,
            'caseId' => $caseId,
            'patientLabel' => $patientLabel,
            'stage' => $stageId,
            'displayStage' => FlowOsConfig::display_stage_id($stageId),
            'displayStageLabel' => FlowOsConfig::display_stage_label($stageId),
            'stageIndex' => (int) ($rankMap[$stageId] ?? $index),
            'timestamp' => $timestamp,
            'sourceLabel' => trim((string) ($transition['sourceTitle'] ?? ($transition['title'] ?? ''))),
            'actorLabel' => trim((string) ($transition['actorLabel'] ?? '')),
            'isCurrentStage' => $stageId === $currentStage,
        ];
    }

    return $history;
}

public static function compare_transitions_asc(array $left, array $right): int
{
    $leftAt = trim((string) ($left['occurredAt'] ?? ''));
    $rightAt = trim((string) ($right['occurredAt'] ?? ''));
    if ($leftAt !== $rightAt) {
        return strcmp($leftAt, $rightAt);
    }

    $rankMap = FlowOsConfig::stage_rank_map();
    $leftRank = $rankMap[(string) ($left['stage'] ?? '')] ?? 999;
    $rightRank = $rankMap[(string) ($right['stage'] ?? '')] ?? 999;
    if ($leftRank !== $rightRank) {
        return $leftRank <=> $rightRank;
    }

    return strcmp((string) ($left['title'] ?? ''), (string) ($right['title'] ?? ''));
}

public static function compare_transitions_desc(array $left, array $right): int
{
    return FlowOsTimeline::compare_transitions_asc($right, $left);
}

public static function build_transition_entry(
    string $stageId,
    string $occurredAt,
    string $title,
    string $actor,
    array $extra = []
): array {
    $actorLabel = trim((string) ($extra['actorLabel'] ?? ''));
    if ($actorLabel === '') {
        $actorLabel = FlowOsConfig::owner_label($actor);
    }

    return array_merge([
        'stage' => $stageId,
        'stageLabel' => FlowOsConfig::stage_label($stageId),
        'title' => trim($title) !== '' ? trim($title) : FlowOsConfig::stage_label($stageId),
        'actor' => trim($actor),
        'actorLabel' => $actorLabel,
        'occurredAt' => trim($occurredAt),
        'sourceType' => trim((string) ($extra['sourceType'] ?? '')),
        'sourceId' => trim((string) ($extra['sourceId'] ?? '')),
        'sourceTitle' => trim((string) ($extra['sourceTitle'] ?? $title)),
        'meta' => trim((string) ($extra['meta'] ?? '')),
    ], $extra);
}

public static function build_case_journey_timeline(array $case, array $callbacks, array $events, array $approvals): array
{
    $caseId = trim((string) ($case['id'] ?? ''));
    $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
    $currentStage = FlowOsStore::detect_case_stage($case, $callbacks, $approvals);
    $hasAppointment = FlowOsStore::case_has_appointment($case);
    $candidates = [];

    foreach ($callbacks as $callback) {
        if (!is_array($callback)) {
            continue;
        }

        $createdAt = trim((string) ($callback['fecha'] ?? ($callback['createdAt'] ?? '')));
        if ($createdAt !== '') {
            $callbackStatus = trim((string) ($callback['status'] ?? 'pendiente'));
            $candidates[] = FlowOsTimeline::build_transition_entry(
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
            $candidates[] = FlowOsTimeline::build_transition_entry(
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
            $candidates[] = FlowOsTimeline::build_transition_entry(
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
            $candidates[] = FlowOsTimeline::build_transition_entry(
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

        if ($type === 'queue_called' || $type === 'visit_completed') {
            $candidates[] = FlowOsTimeline::build_transition_entry(
                'care_plan_ready',
                $createdAt,
                $title !== '' ? $title : ($type === 'queue_called' ? 'Paciente llamado a consultorio' : 'Turno completado'),
                'clinician',
                [
                    'caseId' => $caseId,
                    'sourceType' => $type,
                    'sourceId' => trim((string) ($event['id'] ?? '')),
                    'sourceTitle' => $title !== '' ? $title : ($type === 'queue_called' ? 'Paciente llamado a consultorio' : 'Turno completado'),
                    'actorLabel' => $type === 'queue_called' ? 'Consultorio' : 'Clínico',
                    'meta' => $title !== '' ? $title : ($type === 'queue_called' ? 'Paciente llamado a consultorio' : 'Turno completado'),
                ]
            );
            continue;
        }

        if ($type === 'no_show') {
            $candidates[] = FlowOsTimeline::build_transition_entry(
                'resolved',
                $createdAt,
                $title !== '' ? $title : 'Paciente no asistio',
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

        if ($type !== 'status_changed') {
            continue;
        }

        $status = strtolower(trim((string) ($payload['status'] ?? '')));
        if (in_array($status, ['cancelled', 'no_show'], true)) {
            $candidates[] = FlowOsTimeline::build_transition_entry(
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
            $candidates[] = FlowOsTimeline::build_transition_entry(
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
            : ($requestedBy !== '' ? $requestedBy : FlowOsConfig::owner_label('clinician'));

        $candidates[] = FlowOsTimeline::build_transition_entry(
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
            $candidates[] = FlowOsTimeline::build_transition_entry(
                $currentStage,
                $fallbackAt,
                FlowOsConfig::stage_label($currentStage),
                (string) (FlowOsConfig::stage($currentStage)['owner'] ?? 'frontdesk'),
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
            $timeline[] = FlowOsTimeline::build_transition_entry(
                $currentStage,
                $fallbackAt,
                FlowOsConfig::stage_label($currentStage),
                (string) (FlowOsConfig::stage($currentStage)['owner'] ?? 'frontdesk'),
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

public static function build_store_journey_history(array $store): array
{
    $cases = isset($store['patient_cases']) && is_array($store['patient_cases']) ? $store['patient_cases'] : [];
    $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
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
        $currentStage = FlowOsStore::resolve_case_stage(
            $case,
            $caseApprovals,
            FlowOsStore::case_appointments($case, $appointments)
        );
        $timeline = FlowOsTimeline::build_case_journey_timeline(
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
            'currentStageLabel' => FlowOsConfig::stage_label($currentStage),
            'owner' => (string) (FlowOsConfig::stage($currentStage)['owner'] ?? 'frontdesk'),
            'ownerLabel' => FlowOsConfig::owner_label((string) (FlowOsConfig::stage($currentStage)['owner'] ?? 'frontdesk')),
            'openedAt' => trim((string) ($case['openedAt'] ?? '')),
            'latestActivityAt' => trim((string) ($case['latestActivityAt'] ?? '')),
            'timelineCount' => count($timeline),
            'currentTransitionTitle' => trim((string) ($latestEntry['title'] ?? '')),
            'timeline' => $timeline,
        ];
    }

    usort($caseHistory, static function (array $left, array $right): int {
        $leftOpen = !FlowOsConfig::is_terminal_case_status(strtolower(trim((string) ($left['caseStatus'] ?? ''))));
        $rightOpen = !FlowOsConfig::is_terminal_case_status(strtolower(trim((string) ($right['caseStatus'] ?? ''))));
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

public static function find_case_journey_history(array $store, string $caseId): ?array
{
    $needle = trim($caseId);
    if ($needle === '') {
        return null;
    }

    $history = FlowOsTimeline::build_store_journey_history($store);
    foreach ($history['cases'] as $entry) {
        if ((string) ($entry['caseId'] ?? '') === $needle) {
            return $entry;
        }
    }

    return null;
}

public static function build_store_journey_preview(array $store, array $context = []): array
{
    $journeyHistory = FlowOsTimeline::build_store_journey_history($store);
    $cases = FlowOsStore::build_preview_cases(
        $store,
        isset($journeyHistory['cases']) && is_array($journeyHistory['cases'])
            ? $journeyHistory['cases']
            : []
    );
    $stageId = trim((string) ($context['stage'] ?? ''));
    if ($stageId === '') {
        $stageId = FlowOsConfig::detect_stage($store);
    }

    return FlowOsStore::build_journey_snapshot(
        $stageId,
        array_merge(FlowOsStore::context_from_store($store), $context, [
            'cases' => $cases,
            'selectedCaseId' => $journeyHistory['selectedCaseId'] ?? null,
        ])
    );
}

public static function build_case_journey_preview(array $store, string $caseId, array $context = []): array
{
    $journeyHistory = FlowOsTimeline::build_store_journey_history($store);
    $historyCases = isset($journeyHistory['cases']) && is_array($journeyHistory['cases'])
        ? $journeyHistory['cases']
        : [];
    $previewCases = FlowOsStore::build_preview_cases($store, $historyCases);
    $caseHistory = null;
    foreach ($historyCases as $entry) {
        if (is_array($entry) && trim((string) ($entry['caseId'] ?? '')) === trim($caseId)) {
            $caseHistory = $entry;
            break;
        }
    }
    if ($caseHistory === null) {
        return FlowOsTimeline::build_store_journey_preview($store, $context);
    }

    $stageId = trim((string) ($context['stage'] ?? ''));
    if ($stageId === '') {
        $stageId = (string) ($caseHistory['currentStage'] ?? '');
    }
    if ($stageId === '') {
        $stageId = FlowOsConfig::detect_stage($store);
    }

    return array_merge(
        FlowOsStore::build_journey_snapshot(
            $stageId,
            array_merge(FlowOsStore::context_from_store($store), $context, [
                'cases' => $previewCases,
                'selectedCaseId' => $journeyHistory['selectedCaseId'] ?? null,
            ])
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

}
