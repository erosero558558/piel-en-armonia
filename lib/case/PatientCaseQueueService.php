<?php

declare(strict_types=1);

final class PatientCaseQueueService
{
private function enrichQueueTicketsWithPatientCaseSnapshots(
        array $queueTickets,
        array $cases,
        array $timeline,
        array $approvals
    ): array {
        $timelineByCaseId = [];
        foreach ($timeline as $event) {
            if (!is_array($event)) {
                continue;
            }

            $caseId = trim((string) ($event['patientCaseId'] ?? ''));
            if ($caseId === '') {
                continue;
            }

            if (!isset($timelineByCaseId[$caseId])) {
                $timelineByCaseId[$caseId] = [];
            }
            $timelineByCaseId[$caseId][] = $event;
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

        foreach ($queueTickets as $index => $ticket) {
            if (!is_array($ticket)) {
                continue;
            }

            $caseId = trim((string) ($ticket['patientCaseId'] ?? ''));
            if ($caseId === '' || !isset($cases[$caseId]) || !is_array($cases[$caseId])) {
                continue;
            }

            $queueTickets[$index] = $this->attachPatientCaseSnapshotToTicket(
                $ticket,
                $cases[$caseId],
                $timelineByCaseId[$caseId] ?? [],
                $approvalsByCaseId[$caseId] ?? []
            );
        }

        return $queueTickets;
    }

private function attachPatientCaseSnapshotToTicket(
        array $ticket,
        array $case,
        array $timelineEvents,
        array $approvals
    ): array {
        $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
        $referenceAt = $this->firstNonEmptyString([
            (string) ($ticket['calledAt'] ?? ''),
            (string) ($ticket['createdAt'] ?? ''),
            (string) ($case['latestActivityAt'] ?? ''),
            (string) ($case['openedAt'] ?? ''),
        ]) ?? local_date('c');
        [$previousVisitsCount, $lastCompletedVisitAt] = $this->summarizePreviousVisits(
            $timelineEvents,
            $referenceAt
        );
        $journeyStage = $this->resolveCaseJourneyStage($case);

        $ticket['patientCaseSnapshot'] = [
            'patientLabel' => $this->firstNonEmptyString([
                (string) ($summary['patientLabel'] ?? ''),
                (string) ($ticket['patientLabel'] ?? ''),
                (string) ($ticket['patientInitials'] ?? ''),
                (string) ($ticket['ticketCode'] ?? ''),
            ]) ?? 'Paciente sin nombre',
            'reasonLabel' => $this->resolveQueueTicketReasonLabel($ticket, $case),
            'journeyStage' => $journeyStage,
            'journeyStageLabel' => $this->resolveJourneyStageLabel($journeyStage),
            'previousVisitsCount' => $previousVisitsCount,
            'lastCompletedVisitAt' => $lastCompletedVisitAt !== '' ? $lastCompletedVisitAt : null,
            'alerts' => $this->buildQueueTicketAlerts($ticket, $case, $approvals),
            'membership_status' => (bool)($case['membership_status'] ?? false),
            'membership_plan' => (string)($case['membership_plan'] ?? ''),
        ];

        return $ticket;
    }

private function resolveQueueTicketReasonLabel(array $ticket, array $case): string
    {
        $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
        $visitReasonLabel = trim((string) ($ticket['visitReasonLabel'] ?? ''));
        if ($visitReasonLabel !== '') {
            return $visitReasonLabel;
        }

        $visitReason = strtolower(trim((string) ($ticket['visitReason'] ?? '')));
        if ($visitReason !== '') {
            return [
                'consulta_general' => 'Consulta general',
                'control' => 'Control',
                'procedimiento' => 'Procedimiento',
                'urgencia' => 'Urgencia',
            ][$visitReason] ?? 'Consulta general';
        }

        $serviceLine = trim((string) ($summary['serviceLine'] ?? ''));
        if ($serviceLine !== '') {
            return $serviceLine;
        }

        return (string) ($ticket['queueType'] ?? 'walk_in') === 'appointment'
            ? 'Cita agendada'
            : 'Consulta general';
    }

private function buildQueueTicketAlerts(array $ticket, array $case, array $approvals): array
    {
        $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
        $alerts = [];

        if (strtolower(trim((string) ($ticket['visitReason'] ?? ''))) === 'urgencia') {
            $alerts[] = 'Urgencia declarada en check-in.';
        }
        if ((bool) ($ticket['needsAssistance'] ?? false) || (int) ($summary['activeHelpRequestId'] ?? 0) > 0) {
            $alerts[] = 'Paciente con apoyo activo en recepcion.';
        }
        if ((bool) ($ticket['specialPriority'] ?? false)) {
            $alerts[] = 'Prioridad especial activa.';
        }
        if ((bool) ($ticket['lateArrival'] ?? false)) {
            $alerts[] = 'Llegada tardia detectada.';
        }

        $pendingApprovals = 0;
        foreach ($approvals as $approval) {
            if (!is_array($approval)) {
                continue;
            }
            if (strtolower(trim((string) ($approval['status'] ?? 'pending'))) === 'pending') {
                $pendingApprovals++;
            }
        }
        if ($pendingApprovals > 0) {
            $alerts[] = $pendingApprovals === 1
                ? 'Hay 1 aprobacion pendiente.'
                : 'Hay ' . $pendingApprovals . ' aprobaciones pendientes.';
        }

        return array_values(array_unique($alerts));
    }

}
