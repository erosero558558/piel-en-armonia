<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/models.php';
require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/queue/TicketFactory.php';
require_once __DIR__ . '/queue/TicketPriorityPolicy.php';
require_once __DIR__ . '/queue/QueueSummaryBuilder.php';

class QueueService
{
    private const STATUS_WAITING = 'waiting';
    private const STATUS_CALLED = 'called';
    private const STATUS_COMPLETED = 'completed';
    private const STATUS_NO_SHOW = 'no_show';
    private const STATUS_CANCELLED = 'cancelled';

    private const ACTIVE_APPOINTMENT_STATUSES = ['confirmed', 'pending'];

    private TicketFactory $ticketFactory;
    private TicketPriorityPolicy $priorityPolicy;
    private QueueSummaryBuilder $summaryBuilder;

    public function __construct(
        ?TicketFactory $ticketFactory = null,
        ?TicketPriorityPolicy $priorityPolicy = null,
        ?QueueSummaryBuilder $summaryBuilder = null
    ) {
        $this->ticketFactory = $ticketFactory ?? new TicketFactory();
        $this->priorityPolicy = $priorityPolicy ?? new TicketPriorityPolicy();
        $this->summaryBuilder = $summaryBuilder ?? new QueueSummaryBuilder($this->priorityPolicy);
    }

    public function getQueueState(array $store): array
    {
        $store = $this->normalizeStore($store);
        $store = $this->priorityPolicy->refreshWaitingAppointmentPriorities($store);
        return $this->summaryBuilder->buildQueueState($store['queue_tickets'] ?? [], local_date('c'));
    }

    public function createWalkInTicket(array $store, array $payload, string $createdSource = 'kiosk'): array
    {
        $store = $this->normalizeStore($store);
        if ($this->ticketFactory->resolveInitials($payload) === '') {
            return [
                'ok' => false,
                'error' => 'Iniciales del paciente requeridas',
                'status' => 400,
                'errorCode' => 'queue_bad_request',
            ];
        }

        $nowIso = local_date('c');
        $ticket = $this->ticketFactory->createWalkInTicket($store['queue_tickets'] ?? [], $payload, $createdSource, $nowIso);
        $store['queue_tickets'][] = $ticket;
        $store['updatedAt'] = $nowIso;

        return [
            'ok' => true,
            'store' => $store,
            'ticket' => $ticket,
            'replay' => false,
        ];
    }

    public function checkInAppointment(array $store, array $payload, string $createdSource = 'kiosk'): array
    {
        $store = $this->normalizeStore($store);
        $phoneRaw = (string) ($payload['phone'] ?? ($payload['telefono'] ?? ''));
        $phoneLast4 = $this->ticketFactory->extractPhoneLast4($phoneRaw);
        if (strlen($phoneLast4) !== 4) {
            return [
                'ok' => false,
                'error' => 'Telefono invalido para check-in',
                'status' => 400,
                'errorCode' => 'queue_bad_request',
            ];
        }

        $time = $this->normalizeHour((string) ($payload['time'] ?? ($payload['hora'] ?? '')));
        if ($time === '') {
            return [
                'ok' => false,
                'error' => 'Hora invalida. Usa formato HH:MM',
                'status' => 400,
                'errorCode' => 'queue_bad_request',
            ];
        }

        $date = trim((string) ($payload['date'] ?? ($payload['fecha'] ?? local_date('Y-m-d'))));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return [
                'ok' => false,
                'error' => 'Fecha invalida. Usa formato YYYY-MM-DD',
                'status' => 400,
                'errorCode' => 'queue_bad_request',
            ];
        }

        $appointment = $this->findAppointment($store['appointments'] ?? [], $phoneLast4, $date, $time);
        if ($appointment === null) {
            return [
                'ok' => false,
                'error' => 'No se encontro una cita valida para ese telefono y hora',
                'status' => 404,
                'errorCode' => 'queue_appointment_not_found',
            ];
        }

        $appointmentId = (int) ($appointment['id'] ?? 0);
        if ($appointmentId <= 0) {
            return [
                'ok' => false,
                'error' => 'La cita encontrada no es valida para check-in',
                'status' => 409,
                'errorCode' => 'queue_appointment_invalid',
            ];
        }

        $existing = $this->findActiveTicketByAppointment($store['queue_tickets'] ?? [], $appointmentId);
        if ($existing !== null) {
            return [
                'ok' => true,
                'store' => $store,
                'ticket' => $existing,
                'replay' => true,
            ];
        }

        $nowIso = local_date('c');
        $ticket = $this->ticketFactory->createAppointmentTicket(
            $store['queue_tickets'] ?? [],
            $appointment,
            $payload,
            $createdSource,
            $this->priorityPolicy->resolveAppointmentPriority(
                (string) ($appointment['date'] ?? $date),
                (string) ($appointment['time'] ?? $time)
            ),
            $nowIso
        );

        $store['queue_tickets'][] = $ticket;
        $store['updatedAt'] = $nowIso;

        return [
            'ok' => true,
            'store' => $store,
            'ticket' => $ticket,
            'replay' => false,
        ];
    }

    public function callNext(array $store, int $consultorio): array
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
        return [
            'ok' => true,
            'store' => $store,
            'ticket' => $updatedTicket,
        ];
    }

    public function patchTicket(array $store, array $payload): array
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
        return [
            'ok' => true,
            'store' => $store,
            'ticket' => $updated,
        ];
    }

    public function findTicketById(array $store, int $ticketId): ?array
    {
        foreach ($this->normalizeTickets($store['queue_tickets'] ?? []) as $ticket) {
            if ((int) ($ticket['id'] ?? 0) === $ticketId) {
                return $ticket;
            }
        }
        return null;
    }

    public function buildAdminSummary(array $store): array
    {
        return $this->summaryBuilder->buildAdminSummary($this->getQueueState($store));
    }

    private function normalizeStore(array $store): array
    {
        $store = normalize_store_payload($store);
        $store['queue_tickets'] = $this->normalizeTickets($store['queue_tickets'] ?? []);
        return $store;
    }

    private function normalizeTickets(array $rawTickets): array
    {
        $tickets = [];
        foreach ($rawTickets as $ticket) {
            if (!is_array($ticket)) {
                continue;
            }
            $tickets[] = normalize_queue_ticket($ticket);
        }
        return $tickets;
    }

    private function normalizeHour(string $hour): string
    {
        $hour = trim($hour);
        if ($hour === '') {
            return '';
        }
        if (preg_match('/^(\d{1,2}):(\d{2})$/', $hour, $matches) !== 1) {
            return '';
        }
        $hh = (int) $matches[1];
        $mm = (int) $matches[2];
        if ($hh < 0 || $hh > 23 || $mm < 0 || $mm > 59) {
            return '';
        }
        return str_pad((string) $hh, 2, '0', STR_PAD_LEFT) . ':' . str_pad((string) $mm, 2, '0', STR_PAD_LEFT);
    }

    private function findAppointment(array $appointments, string $phoneLast4, string $date, string $time): ?array
    {
        foreach ($appointments as $appointment) {
            if (!is_array($appointment)) {
                continue;
            }
            $apptDate = trim((string) ($appointment['date'] ?? ''));
            $apptTime = $this->normalizeHour((string) ($appointment['time'] ?? ''));
            if ($apptDate !== $date || $apptTime !== $time) {
                continue;
            }

            $status = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
            if (!in_array($status, self::ACTIVE_APPOINTMENT_STATUSES, true)) {
                continue;
            }

            $apptLast4 = $this->ticketFactory->extractPhoneLast4((string) ($appointment['phone'] ?? ''));
            if ($apptLast4 === '' || $apptLast4 !== $phoneLast4) {
                continue;
            }

            return $appointment;
        }

        return null;
    }

    private function findActiveTicketByAppointment(array $tickets, int $appointmentId): ?array
    {
        foreach ($tickets as $ticket) {
            if (!is_array($ticket) || (int) ($ticket['appointmentId'] ?? 0) !== $appointmentId) {
                continue;
            }
            $status = (string) ($ticket['status'] ?? '');
            if (in_array($status, [self::STATUS_WAITING, self::STATUS_CALLED, self::STATUS_COMPLETED], true)) {
                return normalize_queue_ticket($ticket);
            }
        }
        return null;
    }

    private function isTerminalStatus(string $status): bool
    {
        return in_array($status, [self::STATUS_COMPLETED, self::STATUS_NO_SHOW, self::STATUS_CANCELLED], true);
    }

    private function findActiveCalledByConsultorio(array $tickets, int $consultorio, int $excludeTicketId = 0): ?array
    {
        foreach ($tickets as $ticket) {
            if (!is_array($ticket)) {
                continue;
            }
            if ((string) ($ticket['status'] ?? '') !== self::STATUS_CALLED) {
                continue;
            }
            if ((int) ($ticket['id'] ?? 0) === $excludeTicketId) {
                continue;
            }
            $ticketConsultorio = $this->normalizeConsultorio($ticket['assignedConsultorio'] ?? null);
            if ($ticketConsultorio === $consultorio) {
                return normalize_queue_ticket($ticket);
            }
        }
        return null;
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
