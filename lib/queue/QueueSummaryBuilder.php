<?php

declare(strict_types=1);

require_once __DIR__ . '/TicketPriorityPolicy.php';

final class QueueSummaryBuilder
{
    private TicketPriorityPolicy $priorityPolicy;

    public function __construct(?TicketPriorityPolicy $priorityPolicy = null)
    {
        $this->priorityPolicy = $priorityPolicy ?? new TicketPriorityPolicy();
    }

    /**
     * @param array<int,array> $tickets
     * @return array{ok:bool,data:array}
     */
    public function buildQueueState(array $tickets, ?string $updatedAt = null): array
    {
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

        $callingNowByConsultorio = [];
        foreach ($called as $ticket) {
            $consultorio = $this->normalizeConsultorio($ticket['assignedConsultorio'] ?? null);
            if ($consultorio === null || isset($callingNowByConsultorio[$consultorio])) {
                continue;
            }
            $callingNowByConsultorio[$consultorio] = [
                'id' => (int) ($ticket['id'] ?? 0),
                'ticketCode' => (string) ($ticket['ticketCode'] ?? ''),
                'patientInitials' => (string) ($ticket['patientInitials'] ?? ''),
                'assignedConsultorio' => $consultorio,
                'calledAt' => (string) ($ticket['calledAt'] ?? ''),
                'status' => 'called',
            ];
        }

        ksort($callingNowByConsultorio);
        $callingNow = array_values($callingNowByConsultorio);

        $nextTickets = [];
        foreach ($waiting as $index => $ticket) {
            if ($index >= 10) {
                break;
            }
            $nextTickets[] = [
                'id' => (int) ($ticket['id'] ?? 0),
                'ticketCode' => (string) ($ticket['ticketCode'] ?? ''),
                'patientInitials' => (string) ($ticket['patientInitials'] ?? ''),
                'queueType' => (string) ($ticket['queueType'] ?? 'walk_in'),
                'priorityClass' => (string) ($ticket['priorityClass'] ?? 'walk_in'),
                'position' => $index + 1,
                'createdAt' => (string) ($ticket['createdAt'] ?? ''),
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
            'callingNowByConsultorio' => [
                '1' => $consultorio1,
                '2' => $consultorio2,
            ],
            'nextTickets' => is_array($data['nextTickets'] ?? null) ? $data['nextTickets'] : [],
        ];
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
