<?php

declare(strict_types=1);

require_once __DIR__ . '/../models.php';
require_once __DIR__ . '/TicketPriorityPolicy.php';

final class QueueSummaryBuilder
{
    private const DEFAULT_AVERAGE_SERVICE_MIN = 12;
    private const APPOINTMENT_AVERAGE_SERVICE_MIN = 14;
    private const WALK_IN_AVERAGE_SERVICE_MIN = [
        'consulta_general' => 12,
        'control' => 10,
        'procedimiento' => 18,
        'urgencia' => 8,
    ];

    private TicketPriorityPolicy $priorityPolicy;

    public function __construct(?TicketPriorityPolicy $priorityPolicy = null)
    {
        $this->priorityPolicy = $priorityPolicy ?? new TicketPriorityPolicy();
    }

    /**
     * @param array<int,array> $tickets
     * @param array<int,array> $helpRequests
     * @return array{ok:bool,data:array}
     */
    public function buildQueueState(
        array $tickets,
        array $helpRequests = [],
        ?string $updatedAt = null
    ): array {
        $waiting = [];
        $called = [];
        $counts = [
            'waiting' => 0,
            'called' => 0,
            'completed' => 0,
            'no_show' => 0,
            'cancelled' => 0,
        ];

        foreach ($tickets as $ticket) {
            $status = (string) ($ticket['status'] ?? 'waiting');
            if (isset($counts[$status])) {
                $counts[$status]++;
            }
            if ($status === 'waiting') {
                $waiting[] = $ticket;
            } elseif ($status === 'called') {
                $called[] = $ticket;
            }
        }

        $waiting = $this->priorityPolicy->sortWaitingTickets($waiting);
        $called = $this->priorityPolicy->sortCalledTickets($called);

        $activeHelpRequests = $this->normalizeActiveHelpRequests($helpRequests);
        $recentResolvedHelpRequests = $this->normalizeRecentResolvedHelpRequests($helpRequests);
        $helpRequestsByTicketId = $this->indexActiveHelpRequestsByTicketId($activeHelpRequests);
        $assistancePendingCount = count(array_filter(
            $activeHelpRequests,
            static function (array $request): bool {
                return (string) ($request['status'] ?? '') === 'pending';
            }
        ));

        $callingNowByConsultorio = [];
        foreach ($called as $ticket) {
            $consultorio = $this->normalizeConsultorio($ticket['assignedConsultorio'] ?? null);
            if ($consultorio === null || isset($callingNowByConsultorio[$consultorio])) {
                continue;
            }
            $callingNowByConsultorio[$consultorio] = [
                'id' => (int) ($ticket['id'] ?? 0),
                'ticketCode' => (string) ($ticket['ticketCode'] ?? ''),
                'appointmentId' => (int) ($ticket['appointmentId'] ?? 0),
                'patientCaseId' => (string) ($ticket['patientCaseId'] ?? ''),
                'patientInitials' => (string) ($ticket['patientInitials'] ?? ''),
                'assignedConsultorio' => $consultorio,
                'calledAt' => (string) ($ticket['calledAt'] ?? ''),
                'status' => 'called',
            ];
        }

        ksort($callingNowByConsultorio);
        $callingNow = array_values($callingNowByConsultorio);

        $activeConsultorios = $this->resolveActiveConsultoriosCount($called, $waiting);
        $waitingEstimates = $this->buildWaitingEstimates($waiting, $called);
        $estimatedWaitMin = 0;
        if ($waitingEstimates !== []) {
            $estimatedWaitMin = max(
                0,
                (int) ($waitingEstimates[count($waitingEstimates) - 1]['estimatedWaitMin'] ?? 0)
            );
        }
        $delayReason = $this->resolveDelayReason(count($waiting), $assistancePendingCount);

        $nextTickets = [];
        foreach ($waiting as $index => $ticket) {
            if ($index >= 10) {
                break;
            }
            $ticketId = (int) ($ticket['id'] ?? 0);
            $activeHelp = $helpRequestsByTicketId[$ticketId] ?? null;
            $waitEstimate = $waitingEstimates[$index] ?? null;
            $nextTickets[] = [
                'id' => $ticketId,
                'ticketCode' => (string) ($ticket['ticketCode'] ?? ''),
                'appointmentId' => (int) ($ticket['appointmentId'] ?? 0),
                'patientCaseId' => (string) ($ticket['patientCaseId'] ?? ''),
                'patientInitials' => (string) ($ticket['patientInitials'] ?? ''),
                'queueType' => (string) ($ticket['queueType'] ?? 'walk_in'),
                'priorityClass' => (string) ($ticket['priorityClass'] ?? 'walk_in'),
                'visitReason' => (string) ($ticket['visitReason'] ?? ''),
                'visitReasonLabel' => (string) ($ticket['visitReasonLabel'] ?? ''),
                'position' => $index + 1,
                'createdAt' => (string) ($ticket['createdAt'] ?? ''),
                'needsAssistance' => (bool) ($ticket['needsAssistance'] ?? ($activeHelp !== null)),
                'assistanceRequestStatus' => (string) (
                    $ticket['assistanceRequestStatus']
                    ?? ($activeHelp['status'] ?? '')
                ),
                'activeHelpRequestId' => isset($activeHelp['id']) ? (int) $activeHelp['id'] : null,
                'specialPriority' => (bool) ($ticket['specialPriority'] ?? false),
                'lateArrival' => (bool) ($ticket['lateArrival'] ?? false),
                'reprintRequestedAt' => (string) ($ticket['reprintRequestedAt'] ?? ''),
                'estimatedWaitMin' => max(0, (int) ($waitEstimate['estimatedWaitMin'] ?? 0)),
            ];
        }

        return [
            'ok' => true,
            'data' => [
                'updatedAt' => $updatedAt ?? local_date('c'),
                'callingNow' => $callingNow,
                'nextTickets' => $nextTickets,
                'counts' => $counts,
                'waitingCount' => count($waiting),
                'calledCount' => count($called),
                'activeConsultorios' => $activeConsultorios,
                'estimatedWaitMin' => $estimatedWaitMin,
                'delayReason' => $delayReason,
                'assistancePendingCount' => $assistancePendingCount,
                'activeHelpRequests' => $activeHelpRequests,
                'recentResolvedHelpRequests' => $recentResolvedHelpRequests,
            ],
        ];
    }

    public function buildAdminSummary(array $queueState): array
    {
        $data = is_array($queueState['data'] ?? null) ? $queueState['data'] : [];
        $consultorio1 = null;
        $consultorio2 = null;
        foreach ($data['callingNow'] ?? [] as $ticket) {
            if (!is_array($ticket)) {
                continue;
            }
            $consultorio = (int) ($ticket['assignedConsultorio'] ?? 0);
            if ($consultorio === 1) {
                $consultorio1 = $ticket;
            } elseif ($consultorio === 2) {
                $consultorio2 = $ticket;
            }
        }

        return [
            'updatedAt' => (string) ($data['updatedAt'] ?? local_date('c')),
            'waitingCount' => (int) ($data['waitingCount'] ?? 0),
            'calledCount' => (int) ($data['calledCount'] ?? 0),
            'counts' => is_array($data['counts'] ?? null) ? $data['counts'] : [],
            'activeConsultorios' => max(1, (int) ($data['activeConsultorios'] ?? 1)),
            'callingNowByConsultorio' => [
                '1' => $consultorio1,
                '2' => $consultorio2,
            ],
            'nextTickets' => is_array($data['nextTickets'] ?? null) ? $data['nextTickets'] : [],
            'estimatedWaitMin' => max(0, (int) ($data['estimatedWaitMin'] ?? 0)),
            'delayReason' => (string) ($data['delayReason'] ?? ''),
            'assistancePendingCount' => max(0, (int) ($data['assistancePendingCount'] ?? 0)),
            'activeHelpRequests' => is_array($data['activeHelpRequests'] ?? null)
                ? $data['activeHelpRequests']
                : [],
            'recentResolvedHelpRequests' => is_array($data['recentResolvedHelpRequests'] ?? null)
                ? $data['recentResolvedHelpRequests']
                : [],
        ];
    }

    /**
     * @param array<int,array> $waiting
     * @param array<int,array> $called
     * @return array<int,array{ticketId:int,ticketCode:string,position:int,estimatedWaitMin:int,durationMin:int}>
     */
    public function buildWaitingEstimates(array $waiting, array $called = []): array
    {
        $activeConsultorios = $this->resolveActiveConsultoriosCount($called, $waiting);
        $cumulativeWorkMin = 0;
        $estimates = [];

        foreach ($waiting as $index => $ticket) {
            $durationMin = $this->resolveAverageServiceDurationMin($ticket);
            $cumulativeWorkMin += $durationMin;
            $estimates[] = [
                'ticketId' => (int) ($ticket['id'] ?? 0),
                'ticketCode' => (string) ($ticket['ticketCode'] ?? ''),
                'position' => $index + 1,
                'estimatedWaitMin' => (int) ceil($cumulativeWorkMin / $activeConsultorios),
                'durationMin' => $durationMin,
            ];
        }

        return $estimates;
    }

    /**
     * @param array<int,array> $helpRequests
     * @return array<int,array>
     */
    private function normalizeActiveHelpRequests(array $helpRequests): array
    {
        $active = [];
        foreach ($helpRequests as $request) {
            if (!is_array($request)) {
                continue;
            }
            $status = (string) ($request['status'] ?? '');
            if (!in_array($status, ['pending', 'attending'], true)) {
                continue;
            }
            $active[] = [
                'id' => (int) ($request['id'] ?? 0),
                'ticketId' => isset($request['ticketId']) ? (int) $request['ticketId'] : null,
                'ticketCode' => (string) ($request['ticketCode'] ?? ''),
                'patientCaseId' => (string) ($request['patientCaseId'] ?? ''),
                'patientInitials' => (string) ($request['patientInitials'] ?? ''),
                'reason' => (string) ($request['reason'] ?? 'general'),
                'reasonLabel' => (string) ($request['reasonLabel'] ?? queue_help_request_reason_label((string) ($request['reason'] ?? 'general'))),
                'status' => $status,
                'source' => (string) ($request['source'] ?? 'kiosk'),
                'createdAt' => (string) ($request['createdAt'] ?? ''),
                'updatedAt' => (string) ($request['updatedAt'] ?? ''),
                'context' => isset($request['context']) && is_array($request['context'])
                    ? $request['context']
                    : [],
            ];
        }

        usort($active, static function (array $left, array $right): int {
            $leftTs = strtotime((string) ($left['updatedAt'] ?? $left['createdAt'] ?? '')) ?: 0;
            $rightTs = strtotime((string) ($right['updatedAt'] ?? $right['createdAt'] ?? '')) ?: 0;
            if ($leftTs !== $rightTs) {
                return $rightTs <=> $leftTs;
            }
            return ((int) ($right['id'] ?? 0)) <=> ((int) ($left['id'] ?? 0));
        });

        return $active;
    }

    /**
     * @param array<int,array> $helpRequests
     * @return array<int,array>
     */
    private function normalizeRecentResolvedHelpRequests(array $helpRequests): array
    {
        $resolved = [];
        foreach ($helpRequests as $request) {
            if (!is_array($request)) {
                continue;
            }
            if ((string) ($request['status'] ?? '') !== 'resolved') {
                continue;
            }
            $context = isset($request['context']) && is_array($request['context'])
                ? $request['context']
                : [];
            if (!$this->hasStructuredResolutionContext($context)) {
                continue;
            }

            $resolved[] = [
                'id' => (int) ($request['id'] ?? 0),
                'ticketId' => isset($request['ticketId']) ? (int) $request['ticketId'] : null,
                'ticketCode' => (string) ($request['ticketCode'] ?? ''),
                'patientCaseId' => (string) ($request['patientCaseId'] ?? ''),
                'patientInitials' => (string) ($request['patientInitials'] ?? ''),
                'reason' => (string) ($request['reason'] ?? 'general'),
                'reasonLabel' => (string) ($request['reasonLabel'] ?? queue_help_request_reason_label((string) ($request['reason'] ?? 'general'))),
                'status' => 'resolved',
                'source' => (string) ($request['source'] ?? 'kiosk'),
                'createdAt' => (string) ($request['createdAt'] ?? ''),
                'updatedAt' => (string) ($request['updatedAt'] ?? ''),
                'resolvedAt' => (string) ($request['resolvedAt'] ?? $request['updatedAt'] ?? ''),
                'context' => $context,
            ];
        }

        usort($resolved, static function (array $left, array $right): int {
            $leftTs = strtotime((string) ($left['resolvedAt'] ?? $left['updatedAt'] ?? $left['createdAt'] ?? '')) ?: 0;
            $rightTs = strtotime((string) ($right['resolvedAt'] ?? $right['updatedAt'] ?? $right['createdAt'] ?? '')) ?: 0;
            if ($leftTs !== $rightTs) {
                return $rightTs <=> $leftTs;
            }
            return ((int) ($right['id'] ?? 0)) <=> ((int) ($left['id'] ?? 0));
        });

        return array_slice($resolved, 0, 5);
    }

    /**
     * @param array<int,array> $activeHelpRequests
     * @return array<int,array>
     */
    private function indexActiveHelpRequestsByTicketId(array $activeHelpRequests): array
    {
        $indexed = [];
        foreach ($activeHelpRequests as $request) {
            $ticketId = isset($request['ticketId']) ? (int) $request['ticketId'] : 0;
            if ($ticketId <= 0 || isset($indexed[$ticketId])) {
                continue;
            }
            $indexed[$ticketId] = $request;
        }

        return $indexed;
    }

    private function resolveDelayReason(int $waitingCount, int $assistancePendingCount): string
    {
        if ($assistancePendingCount > 0) {
            return 'Recepcion atendiendo solicitudes de apoyo.';
        }
        if ($waitingCount >= 5) {
            return 'Alta demanda en sala.';
        }
        return '';
    }

    /**
     * @param array<int,array> $called
     * @param array<int,array> $waiting
     */
    private function resolveActiveConsultoriosCount(array $called, array $waiting): int
    {
        $activeConsultorios = [];
        foreach ($called as $ticket) {
            $consultorio = $this->normalizeConsultorio($ticket['assignedConsultorio'] ?? null);
            if ($consultorio === null) {
                continue;
            }
            $activeConsultorios[$consultorio] = true;
        }

        if ($activeConsultorios !== []) {
            return count($activeConsultorios);
        }

        return ($called !== [] || $waiting !== []) ? 1 : 1;
    }

    private function resolveAverageServiceDurationMin(array $ticket): int
    {
        $queueType = strtolower(trim((string) ($ticket['queueType'] ?? 'walk_in')));
        if ($queueType === 'appointment') {
            return self::APPOINTMENT_AVERAGE_SERVICE_MIN;
        }

        $visitReason = strtolower(trim((string) ($ticket['visitReason'] ?? 'consulta_general')));
        return self::WALK_IN_AVERAGE_SERVICE_MIN[$visitReason] ?? self::DEFAULT_AVERAGE_SERVICE_MIN;
    }

    /**
     * @param array<string, mixed> $context
     */
    private function hasStructuredResolutionContext(array $context): bool
    {
        return $this->readContextValue(
            $context,
            [
                'resolutionOutcome',
                'resolution_outcome',
                'resolutionOutcomeLabel',
                'resolution_outcome_label',
                'reviewOutcome',
                'review_outcome',
                'reviewOutcomeLabel',
                'review_outcome_label',
            ]
        ) !== '';
    }

    /**
     * @param array<string, mixed> $context
     * @param array<int, string> $keys
     */
    private function readContextValue(array $context, array $keys): string
    {
        foreach ($keys as $key) {
            $value = $context[$key] ?? null;
            if ($value === null) {
                continue;
            }
            $normalized = trim((string) $value);
            if ($normalized !== '') {
                return $normalized;
            }
        }

        return '';
    }

    private function normalizeConsultorio($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $candidate = (int) $value;
        return in_array($candidate, [1, 2], true) ? $candidate : null;
    }
}
