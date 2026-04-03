<?php

require_once __DIR__ . '/queue/QueueAssignmentService.php';
require_once __DIR__ . '/queue/QueueLatencyService.php';

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/models.php';
require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/PatientCaseService.php';
require_once __DIR__ . '/QueueAssistantMetricsStore.php';
require_once __DIR__ . '/queue/TicketFactory.php';
require_once __DIR__ . '/queue/TicketPriorityPolicy.php';
require_once __DIR__ . '/queue/QueueSummaryBuilder.php';

final class QueueService
{
    public
    function __construct(
        ?TicketFactory $ticketFactory = null,
        ?TicketPriorityPolicy $priorityPolicy = null,
        ?QueueSummaryBuilder $summaryBuilder = null,
        ?PatientCaseService $patientCaseService = null
    ) {
        $this->ticketFactory = $ticketFactory ?? new TicketFactory();
        $this->priorityPolicy = $priorityPolicy ?? new TicketPriorityPolicy();
        $this->summaryBuilder = $summaryBuilder ?? new QueueSummaryBuilder($this->priorityPolicy);
        $this->patientCaseService = $patientCaseService ?? new PatientCaseService();
    }

    public

    public
    function getQueueState(array $store): array
    {
        $store = $this->normalizeStore($store);
        $store = $this->priorityPolicy->refreshWaitingAppointmentPriorities($store);
        $store = $this->hydratePatientFlowStore($store);
        return $this->summaryBuilder->buildQueueState(
            $store['queue_tickets'] ?? [],
            $store['queue_help_requests'] ?? [],
            local_date('c')
        );
    }

    public

    public
    function createWalkInTicket(array $store, array $payload, string $createdSource = 'kiosk'): array
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

        $visitReason = $this->priorityPolicy->resolveWalkInReason((string) (
            $payload['visitReason']
            ?? ($payload['visit_reason'] ?? '')
        ));
        $payload['visitReason'] = $visitReason;
        $payload['specialPriority'] = $this->priorityPolicy->walkInRequiresSpecialPriority($visitReason)
            || parse_bool($payload['specialPriority'] ?? ($payload['special_priority'] ?? false));

        $nowIso = local_date('c');
        $ticket = $this->ticketFactory->createWalkInTicket($store['queue_tickets'] ?? [], $payload, $createdSource, $nowIso);
        $store['queue_tickets'][] = $ticket;
        $store['updatedAt'] = $nowIso;
        $store = $this->hydratePatientFlowStore($store);
        $ticket = $this->findTicketRecord($store, (int) ($ticket['id'] ?? 0)) ?? $ticket;

        return [
            'ok' => true,
            'store' => $store,
            'ticket' => $ticket,
            'replay' => false,
        ];
    }

    public

    public
    function checkInAppointment(array $store, array $payload, string $createdSource = 'kiosk'): array
    {
        $store = $this->normalizeStore($store);
        $appointment = null;
        $checkinToken = $this->resolveCheckinTokenFromPayload($payload);
        if ($checkinToken !== '') {
            $appointment = $this->findAppointmentByCheckinToken(
                $store['appointments'] ?? [],
                $checkinToken
            );
            if ($appointment === null) {
                return [
                    'ok' => false,
                    'error' => 'No se encontro una cita valida para ese QR',
                    'status' => 404,
                    'errorCode' => 'queue_appointment_not_found',
                ];
            }
        } else {
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

            $appointment = $this->findAppointment(
                $store['appointments'] ?? [],
                $phoneLast4,
                $date,
                $time
            );
            if ($appointment === null) {
                return [
                    'ok' => false,
                    'error' => 'No se encontro una cita valida para ese telefono y hora',
                    'status' => 404,
                    'errorCode' => 'queue_appointment_not_found',
                ];
            }
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
            $store = $this->hydratePatientFlowStore($store);
            $existing = $this->findTicketRecord($store, (int) ($existing['id'] ?? 0)) ?? $existing;
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
        $store = $this->hydratePatientFlowStore($store);
        $ticket = $this->findTicketRecord($store, (int) ($ticket['id'] ?? 0)) ?? $ticket;

        return [
            'ok' => true,
            'store' => $store,
            'ticket' => $ticket,
            'replay' => false,
        ];
    }

    public

    public static function createHelpRequest(...$args)
    {
        return QueueLatencyService::createHelpRequest(...$args);
    }

    public static function patchHelpRequest(...$args)
    {
        return QueueLatencyService::patchHelpRequest(...$args);
    }

    public static function callNext(...$args)
    {
        return QueueAssignmentService::callNext(...$args);
    }

    public static function patchTicket(...$args)
    {
        return QueueAssignmentService::patchTicket(...$args);
    }

    public static function findTicketById(...$args)
    {
        return QueueAssignmentService::findTicketById(...$args);
    }

    public static function getPublicTicketStatus(...$args)
    {
        return QueueAssignmentService::getPublicTicketStatus(...$args);
    }

    public
    function buildAdminSummary(array $store): array
    {
        return $this->summaryBuilder->buildAdminSummary($this->getQueueState($store));
    }

    private

    private
    function normalizeStore(array $store): array
    {
        $store = normalize_store_payload($store);
        $store['queue_tickets'] = $this->normalizeTickets($store['queue_tickets'] ?? []);
        $store['queue_help_requests'] = $this->normalizeHelpRequests($store['queue_help_requests'] ?? []);
        $store = $this->syncTicketAssistanceFlags($store);
        return $store;
    }

    private

    private
    function normalizeTickets(array $rawTickets): array
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

    private

    private
    function normalizeHelpRequests(array $rawRequests): array
    {
        $requests = [];
        foreach ($rawRequests as $request) {
            if (!is_array($request)) {
                continue;
            }
            $requests[] = normalize_queue_help_request($request);
        }

        usort($requests, static function (array $left, array $right): int {
            $leftTs = strtotime((string) ($left['updatedAt'] ?? $left['createdAt'] ?? '')) ?: 0;
            $rightTs = strtotime((string) ($right['updatedAt'] ?? $right['createdAt'] ?? '')) ?: 0;
            if ($leftTs !== $rightTs) {
                return $rightTs <=> $leftTs;
            }
            return ((int) ($right['id'] ?? 0)) <=> ((int) ($left['id'] ?? 0));
        });

        return $requests;
    }

    private

    public static function syncTicketAssistanceFlags(...$args)
    {
        return QueueLatencyService::syncTicketAssistanceFlags(...$args);
    }

    public static function nextHelpRequestId(...$args)
    {
        return QueueLatencyService::nextHelpRequestId(...$args);
    }

    public static function findTicketForHelpRequest(...$args)
    {
        return QueueLatencyService::findTicketForHelpRequest(...$args);
    }

    private
    function findTicketByCode(array $store, string $ticketCode): ?array
    {
        $normalizedCode = strtoupper(trim($ticketCode));
        if ($normalizedCode === '') {
            return null;
        }

        foreach ($this->normalizeTickets($store['queue_tickets'] ?? []) as $ticket) {
            if ((string) ($ticket['ticketCode'] ?? '') === $normalizedCode) {
                return $ticket;
            }
        }

        return null;
    }

    private

    public static function findOpenHelpRequest(...$args)
    {
        return QueueLatencyService::findOpenHelpRequest(...$args);
    }

    private
    function normalizeHour(string $hour): string
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

    private

    private
    function hydratePatientFlowStore(array $store): array
    {
        return $this->patientCaseService->hydrateStore($store);
    }

    private

    private
    function findTicketRecord(array $store, int $ticketId): ?array
    {
        if ($ticketId <= 0) {
            return null;
        }

        $tickets = isset($store['queue_tickets']) && is_array($store['queue_tickets'])
            ? $store['queue_tickets']
            : [];
        foreach ($tickets as $ticket) {
            if (!is_array($ticket)) {
                continue;
            }
            if ((int) ($ticket['id'] ?? 0) === $ticketId) {
                return normalize_queue_ticket($ticket);
            }
        }

        return null;
    }

    private

    private
    function findHelpRequestRecord(array $store, int $requestId): ?array
    {
        if ($requestId <= 0) {
            return null;
        }

        $requests = isset($store['queue_help_requests']) && is_array($store['queue_help_requests'])
            ? $store['queue_help_requests']
            : [];
        foreach ($requests as $request) {
            if (!is_array($request)) {
                continue;
            }
            if ((int) ($request['id'] ?? 0) === $requestId) {
                return normalize_queue_help_request($request);
            }
        }

        return null;
    }

    private

    public static function mergeHelpRequestContext(...$args)
    {
        return QueueLatencyService::mergeHelpRequestContext(...$args);
    }

    public static function shouldRecordHelpRequestResolution(...$args)
    {
        return QueueLatencyService::shouldRecordHelpRequestResolution(...$args);
    }

    public static function readHelpRequestContextValue(...$args)
    {
        return QueueLatencyService::readHelpRequestContextValue(...$args);
    }

    private
    function resolveCheckinTokenFromPayload(array $payload): string
    {
        foreach (['checkinToken', 'checkin_token', 'qrToken', 'qr_token', 'qrData', 'qr_data'] as $key) {
            $candidate = trim((string) ($payload[$key] ?? ''));
            if ($candidate !== '') {
                return $candidate;
            }
        }

        return '';
    }

    private

    private
    function findAppointment(array $appointments, string $phoneLast4, string $date, string $time): ?array
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

    private

    private
    function findAppointmentByCheckinToken(array $appointments, string $checkinToken): ?array
    {
        $expectedToken = strtoupper(trim($checkinToken));
        if ($expectedToken === '') {
            return null;
        }

        foreach ($appointments as $appointment) {
            if (!is_array($appointment)) {
                continue;
            }

            $status = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
            if (!in_array($status, self::ACTIVE_APPOINTMENT_STATUSES, true)) {
                continue;
            }

            $appointmentToken = strtoupper(trim((string) ($appointment['checkinToken'] ?? '')));
            if ($appointmentToken === '' || !hash_equals($appointmentToken, $expectedToken)) {
                continue;
            }

            return $appointment;
        }

        return null;
    }

    private

    private
    function findActiveTicketByAppointment(array $tickets, int $appointmentId): ?array
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

    private

    private
    function isTerminalStatus(string $status): bool
    {
        return in_array($status, [self::STATUS_COMPLETED, self::STATUS_NO_SHOW, self::STATUS_CANCELLED], true);
    }

    private

    private
    function findActiveCalledByConsultorio(array $tickets, int $consultorio, int $excludeTicketId = 0): ?array
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

    private

    private
    function normalizeConsultorio($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $candidate = (int) $value;
        return in_array($candidate, [1, 2], true) ? $candidate : null;
    }
}
