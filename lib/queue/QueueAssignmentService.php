<?php

declare(strict_types=1);

final class QueueAssignmentService
{
    public
    function callNext(array $store, int $consultorio): array
    {
        if (!in_array($consultorio, [1, 2], true)) {
            return [
                'ok' => false,
                'error' => 'Consultorio invalido',
                'status' => 400,
                'errorCode' => 'queue_bad_request',
            ];
        }

        $store = $this->normalizeStore($store);
        $store = $this->priorityPolicy->refreshWaitingAppointmentPriorities($store);

        $busyTicket = $this->findActiveCalledByConsultorio($store['queue_tickets'] ?? [], $consultorio);
        if (is_array($busyTicket)) {
            $ticketCode = (string) ($busyTicket['ticketCode'] ?? '--');
            return [
                'ok' => false,
                'error' => "Consultorio {$consultorio} ocupado por {$ticketCode}. Libera o completa ese turno antes de llamar otro.",
                'status' => 409,
                'errorCode' => 'queue_consultorio_busy',
            ];
        }

        $waiting = array_values(array_filter($store['queue_tickets'], static function ($ticket): bool {
            return is_array($ticket) && (($ticket['status'] ?? '') === self::STATUS_WAITING);
        }));
        $waiting = $this->priorityPolicy->sortWaitingTickets($waiting);
        if ($waiting === []) {
            return [
                'ok' => false,
                'error' => 'No hay turnos en espera',
                'status' => 404,
                'errorCode' => 'queue_empty',
            ];
        }

        $selectedId = (int) ($waiting[0]['id'] ?? 0);
        if ($selectedId <= 0) {
            return [
                'ok' => false,
                'error' => 'Ticket invalido',
                'status' => 409,
                'errorCode' => 'queue_ticket_invalid',
            ];
        }

        $updatedTicket = null;
        $nowIso = local_date('c');
        foreach ($store['queue_tickets'] as $idx => $ticket) {
            if (!is_array($ticket) || (int) ($ticket['id'] ?? 0) !== $selectedId) {
                continue;
            }
            if (($ticket['status'] ?? '') === self::STATUS_WAITING) {
                $waitMs = max(0, (strtotime($nowIso) - strtotime($ticket['createdAt'] ?? '')) * 1000);
                QueueAssistantMetricsStore::recordClinicQueueEvent(substr($nowIso, 0, 10), '', $waitMs);
            }
            $ticket['status'] = self::STATUS_CALLED;
            $ticket['assignedConsultorio'] = $consultorio;
            $ticket['calledAt'] = $nowIso;
            $ticket['completedAt'] = '';
            $store['queue_tickets'][$idx] = normalize_queue_ticket($ticket);
            $updatedTicket = $store['queue_tickets'][$idx];
            break;
        }

        if (!is_array($updatedTicket)) {
            return [
                'ok' => false,
                'error' => 'No se pudo actualizar el turno',
                'status' => 409,
                'errorCode' => 'queue_update_failed',
            ];
        }

        $store['updatedAt'] = $nowIso;
        $store = $this->hydratePatientFlowStore($store);
        $updatedTicket = $this->findTicketRecord($store, (int) ($updatedTicket['id'] ?? 0)) ?? $updatedTicket;
        return [
            'ok' => true,
            'store' => $store,
            'ticket' => $updatedTicket,
        ];
    }

    public

    public
    function patchTicket(array $store, array $payload): array
    {
        $store = $this->normalizeStore($store);
        $ticketId = isset($payload['id']) ? (int) $payload['id'] : 0;
        if ($ticketId <= 0) {
            return [
                'ok' => false,
                'error' => 'id de ticket invalido',
                'status' => 400,
                'errorCode' => 'queue_bad_request',
            ];
        }

        $action = strtolower(trim((string) ($payload['action'] ?? '')));
        $status = strtolower(trim((string) ($payload['status'] ?? '')));
        $consultorio = $this->normalizeConsultorio($payload['consultorio'] ?? ($payload['assignedConsultorio'] ?? null));
        $nowIso = local_date('c');

        if (in_array($action, ['atender_apoyo', 'resolver_apoyo'], true)) {
            $helpStatus = $action === 'atender_apoyo' ? 'attending' : 'resolved';
            $helpResult = $this->patchHelpRequest($store, [
                'ticketId' => $ticketId,
                'status' => $helpStatus,
            ]);
            if (($helpResult['ok'] ?? false) !== true) {
                return $helpResult;
            }

            return [
                'ok' => true,
                'store' => $helpResult['store'] ?? $store,
                'ticket' => $this->findTicketRecord(
                    is_array($helpResult['store'] ?? null)
                        ? $helpResult['store']
                        : $store,
                    $ticketId
                ),
                'helpRequest' => $helpResult['helpRequest'] ?? null,
            ];
        }

        $found = false;
        $updated = null;
        foreach ($store['queue_tickets'] as $idx => $ticket) {
            if (!is_array($ticket) || (int) ($ticket['id'] ?? 0) !== $ticketId) {
                continue;
            }
            $found = true;
            $currentStatus = (string) ($ticket['status'] ?? self::STATUS_WAITING);

            if ($action !== '') {
                switch ($action) {
                    case 're-llamar':
                    case 'rellamar':
                    case 'recall':
                    case 'llamar':
                        if ($this->isTerminalStatus($currentStatus)) {
                            return [
                                'ok' => false,
                                'error' => 'No puedes re-llamar un ticket en estado terminal',
                                'status' => 409,
                                'errorCode' => 'queue_transition_invalid',
                            ];
                        }
                        if ($currentStatus === self::STATUS_WAITING) {
                            $waitMs = max(0, (strtotime($nowIso) - strtotime($ticket['createdAt'] ?? '')) * 1000);
                            QueueAssistantMetricsStore::recordClinicQueueEvent(substr($nowIso, 0, 10), '', $waitMs);
                        }
                        $targetConsultorio = $consultorio ?? $this->normalizeConsultorio($ticket['assignedConsultorio'] ?? null);
                        if ($targetConsultorio !== null) {
                            $busyTicket = $this->findActiveCalledByConsultorio($store['queue_tickets'], $targetConsultorio, $ticketId);
                            if (is_array($busyTicket)) {
                                $busyCode = (string) ($busyTicket['ticketCode'] ?? '--');
                                return [
                                    'ok' => false,
                                    'error' => "Consultorio {$targetConsultorio} ocupado por {$busyCode}",
                                    'status' => 409,
                                    'errorCode' => 'queue_consultorio_busy',
                                ];
                            }
                            $ticket['assignedConsultorio'] = $targetConsultorio;
                        }
                        $ticket['status'] = self::STATUS_CALLED;
                        $ticket['calledAt'] = $nowIso;
                        $ticket['completedAt'] = '';
                        break;
                    case 'completar':
                    case 'complete':
                    case 'completed':
                        if ($currentStatus === self::STATUS_WAITING) {
                            $waitMs = max(0, (strtotime($nowIso) - strtotime($ticket['createdAt'] ?? '')) * 1000);
                            QueueAssistantMetricsStore::recordClinicQueueEvent(substr($nowIso, 0, 10), '', $waitMs);
                        }
                        if ($currentStatus !== self::STATUS_COMPLETED) {
                            QueueAssistantMetricsStore::recordClinicQueueEvent(substr($nowIso, 0, 10), substr($nowIso, 11, 2), null);
                        }
                        $ticket['status'] = self::STATUS_COMPLETED;
                        $ticket['completedAt'] = $nowIso;
                        break;
                    case 'no_show':
                    case 'noshow':
                        $ticket['status'] = self::STATUS_NO_SHOW;
                        $ticket['completedAt'] = $nowIso;
                        break;
                    case 'cancelar':
                    case 'cancel':
                    case 'cancelled':
                        $ticket['status'] = self::STATUS_CANCELLED;
                        $ticket['completedAt'] = $nowIso;
                        break;
                    case 'liberar':
                    case 'release':
                        $ticket['status'] = self::STATUS_WAITING;
                        $ticket['assignedConsultorio'] = null;
                        $ticket['calledAt'] = '';
                        $ticket['completedAt'] = '';
                        break;
                    case 'reasignar':
                    case 'reassign':
                        if ($consultorio === null) {
                            return [
                                'ok' => false,
                                'error' => 'Consultorio invalido para reasignar',
                                'status' => 400,
                                'errorCode' => 'queue_bad_request',
                            ];
                        }
                        $busyTicket = $this->findActiveCalledByConsultorio($store['queue_tickets'], $consultorio, $ticketId);
                        if (is_array($busyTicket)) {
                            $busyCode = (string) ($busyTicket['ticketCode'] ?? '--');
                            return [
                                'ok' => false,
                                'error' => "Consultorio {$consultorio} ocupado por {$busyCode}",
                                'status' => 409,
                                'errorCode' => 'queue_consultorio_busy',
                            ];
                        }
                        $ticket['assignedConsultorio'] = $consultorio;
                        break;
                    default:
                        return [
                            'ok' => false,
                            'error' => 'Accion no soportada',
                            'status' => 400,
                            'errorCode' => 'queue_bad_request',
                        ];
                }
            } elseif ($status !== '') {
                if (!in_array($status, [
                    self::STATUS_WAITING,
                    self::STATUS_CALLED,
                    self::STATUS_COMPLETED,
                    self::STATUS_NO_SHOW,
                    self::STATUS_CANCELLED,
                ], true)) {
                    return [
                        'ok' => false,
                        'error' => 'Estado no soportado',
                        'status' => 400,
                        'errorCode' => 'queue_bad_request',
                    ];
                }

                $ticket['status'] = $status;
                if ($status === self::STATUS_CALLED) {
                    if ($currentStatus === self::STATUS_WAITING) {
                        $waitMs = max(0, (strtotime($nowIso) - strtotime($ticket['createdAt'] ?? '')) * 1000);
                        QueueAssistantMetricsStore::recordClinicQueueEvent(substr($nowIso, 0, 10), '', $waitMs);
                    }
                    $targetConsultorio = $consultorio ?? $this->normalizeConsultorio($ticket['assignedConsultorio'] ?? null);
                    if ($targetConsultorio !== null) {
                        $busyTicket = $this->findActiveCalledByConsultorio($store['queue_tickets'], $targetConsultorio, $ticketId);
                        if (is_array($busyTicket)) {
                            $busyCode = (string) ($busyTicket['ticketCode'] ?? '--');
                            return [
                                'ok' => false,
                                'error' => "Consultorio {$targetConsultorio} ocupado por {$busyCode}",
                                'status' => 409,
                                'errorCode' => 'queue_consultorio_busy',
                            ];
                        }
                        $ticket['assignedConsultorio'] = $targetConsultorio;
                    }
                    $ticket['calledAt'] = $nowIso;
                    $ticket['completedAt'] = '';
                } elseif ($status === self::STATUS_WAITING) {
                    $ticket['assignedConsultorio'] = null;
                    $ticket['calledAt'] = '';
                    $ticket['completedAt'] = '';
                }
                if (in_array($status, [self::STATUS_COMPLETED, self::STATUS_NO_SHOW, self::STATUS_CANCELLED], true)) {
                    if ($status === self::STATUS_COMPLETED && $currentStatus !== self::STATUS_COMPLETED) {
                        QueueAssistantMetricsStore::recordClinicQueueEvent(substr($nowIso, 0, 10), substr($nowIso, 11, 2), null);
                    }
                    if ($status === self::STATUS_COMPLETED && $currentStatus === self::STATUS_WAITING) {
                        $waitMs = max(0, (strtotime($nowIso) - strtotime($ticket['createdAt'] ?? '')) * 1000);
                        QueueAssistantMetricsStore::recordClinicQueueEvent(substr($nowIso, 0, 10), '', $waitMs);
                    }
                    $ticket['completedAt'] = $nowIso;
                }
            } else {
                return [
                    'ok' => false,
                    'error' => 'Debes enviar action o status',
                    'status' => 400,
                    'errorCode' => 'queue_bad_request',
                ];
            }

            $store['queue_tickets'][$idx] = normalize_queue_ticket($ticket);
            $updated = $store['queue_tickets'][$idx];
            break;
        }

        if (!$found || !is_array($updated)) {
            return [
                'ok' => false,
                'error' => 'Ticket no encontrado',
                'status' => 404,
                'errorCode' => 'queue_ticket_not_found',
            ];
        }

        $store['updatedAt'] = $nowIso;
        $store = $this->hydratePatientFlowStore($store);
        $updated = $this->findTicketRecord($store, (int) ($updated['id'] ?? 0)) ?? $updated;
        return [
            'ok' => true,
            'store' => $store,
            'ticket' => $updated,
        ];
    }

    public

    public
    function findTicketById(array $store, int $ticketId): ?array
    {
        $store = $this->hydratePatientFlowStore($this->normalizeStore($store));
        foreach ($this->normalizeTickets($store['queue_tickets'] ?? []) as $ticket) {
            if ((int) ($ticket['id'] ?? 0) === $ticketId) {
                return $ticket;
            }
        }
        return null;
    }

    public

    public
    function getPublicTicketStatus(array $store, string $ticketCode): array
    {
        $normalizedCode = strtoupper(trim($ticketCode));
        if ($normalizedCode === '' || preg_match('/^[A-Z]-\d{3,4}$/', $normalizedCode) !== 1) {
            return [
                'ok' => false,
                'error' => 'Codigo de ticket invalido',
                'status' => 400,
                'errorCode' => 'queue_bad_request',
            ];
        }

        $store = $this->normalizeStore($store);
        $store = $this->priorityPolicy->refreshWaitingAppointmentPriorities($store);
        $store = $this->hydratePatientFlowStore($store);

        $ticket = $this->findTicketByCode($store, $normalizedCode);
        if (!is_array($ticket)) {
            return [
                'ok' => false,
                'error' => 'Ticket no encontrado',
                'status' => 404,
                'errorCode' => 'queue_ticket_not_found',
            ];
        }

        $tickets = $this->normalizeTickets($store['queue_tickets'] ?? []);
        $waiting = [];
        $called = [];
        foreach ($tickets as $candidate) {
            $status = (string) ($candidate['status'] ?? '');
            if ($status === self::STATUS_WAITING) {
                $waiting[] = $candidate;
            } elseif ($status === self::STATUS_CALLED) {
                $called[] = $candidate;
            }
        }
        $waiting = $this->priorityPolicy->sortWaitingTickets($waiting);
        $called = $this->priorityPolicy->sortCalledTickets($called);
        $waitingEstimates = $this->summaryBuilder->buildWaitingEstimates($waiting, $called);

        $position = null;
        $estimatedWaitMin = null;
        foreach ($waitingEstimates as $estimate) {
            if ((string) ($estimate['ticketCode'] ?? '') !== $normalizedCode) {
                continue;
            }
            $position = (int) ($estimate['position'] ?? 0);
            $estimatedWaitMin = max(0, (int) ($estimate['estimatedWaitMin'] ?? 0));
            break;
        }
        if ($position === null) {
            foreach ($waiting as $index => $candidate) {
                if ((string) ($candidate['ticketCode'] ?? '') !== $normalizedCode) {
                    continue;
                }
                $position = $index + 1;
                break;
            }
        }

        $queueState = $this->summaryBuilder->buildQueueState(
            $tickets,
            $store['queue_help_requests'] ?? [],
            local_date('c')
        );
        $queueData = is_array($queueState['data'] ?? null) ? $queueState['data'] : [];

        return [
            'ok' => true,
            'data' => [
                'ticket' => [
                    'id' => (int) ($ticket['id'] ?? 0),
                    'ticketCode' => (string) ($ticket['ticketCode'] ?? ''),
                    'patientInitials' => (string) ($ticket['patientInitials'] ?? ''),
                    'queueType' => (string) ($ticket['queueType'] ?? 'walk_in'),
                    'priorityClass' => (string) ($ticket['priorityClass'] ?? 'walk_in'),
                    'visitReason' => (string) ($ticket['visitReason'] ?? ''),
                    'visitReasonLabel' => (string) ($ticket['visitReasonLabel'] ?? ''),
                    'status' => (string) ($ticket['status'] ?? self::STATUS_WAITING),
                    'assignedConsultorio' => isset($ticket['assignedConsultorio'])
                        ? ($ticket['assignedConsultorio'] === null ? null : (int) $ticket['assignedConsultorio'])
                        : null,
                    'createdAt' => (string) ($ticket['createdAt'] ?? ''),
                    'calledAt' => (string) ($ticket['calledAt'] ?? ''),
                    'completedAt' => (string) ($ticket['completedAt'] ?? ''),
                    'specialPriority' => (bool) ($ticket['specialPriority'] ?? false),
                    'lateArrival' => (bool) ($ticket['lateArrival'] ?? false),
                ],
                'position' => $position,
                'aheadCount' => $position === null ? null : max(0, $position - 1),
                'estimatedWaitMin' => $estimatedWaitMin,
                'updatedAt' => (string) ($queueData['updatedAt'] ?? local_date('c')),
                'waitingCount' => max(0, (int) ($queueData['waitingCount'] ?? 0)),
                'calledCount' => max(0, (int) ($queueData['calledCount'] ?? 0)),
                'activeConsultorios' => max(1, (int) ($queueData['activeConsultorios'] ?? 1)),
                'delayReason' => (string) ($queueData['delayReason'] ?? ''),
                'callingNow' => array_values(
                    array_filter(
                        is_array($queueData['callingNow'] ?? null) ? $queueData['callingNow'] : [],
                        static fn ($entry): bool => is_array($entry)
                    )
                ),
                'nextTickets' => array_slice(
                    array_values(
                        array_filter(
                            is_array($queueData['nextTickets'] ?? null) ? $queueData['nextTickets'] : [],
                            static fn ($entry): bool => is_array($entry)
                        )
                    ),
                    0,
                    5
                ),
            ],
        ];
    }

    public

}
