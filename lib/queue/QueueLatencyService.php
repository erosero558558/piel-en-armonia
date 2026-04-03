<?php

declare(strict_types=1);

final class QueueLatencyService
{
    public
    function createHelpRequest(array $store, array $payload): array
    {
        $store = $this->normalizeStore($store);
        $reason = strtolower(trim((string) ($payload['reason'] ?? 'general')));
        if ($reason === '') {
            $reason = 'general';
        }

        $ticketId = isset($payload['ticketId']) ? (int) $payload['ticketId'] : (isset($payload['ticket_id']) ? (int) $payload['ticket_id'] : 0);
        $ticket = $this->findTicketForHelpRequest($store, $payload, $ticketId);
        $ticketId = is_array($ticket) ? (int) ($ticket['id'] ?? 0) : $ticketId;
        $openRequest = $this->findOpenHelpRequest(
            $store['queue_help_requests'] ?? [],
            $ticketId,
            $reason,
            (string) ($payload['sessionId'] ?? ($payload['session_id'] ?? ''))
        );
        if (is_array($openRequest)) {
            $store = $this->hydratePatientFlowStore($store);
            $openRequest = $this->findHelpRequestRecord($store, (int) ($openRequest['id'] ?? 0)) ?? $openRequest;
            return [
                'ok' => true,
                'store' => $store,
                'helpRequest' => $openRequest,
                'replay' => true,
            ];
        }

        $nowIso = local_date('c');
        $request = normalize_queue_help_request([
            'id' => $this->nextHelpRequestId($store['queue_help_requests'] ?? []),
            'source' => $payload['source'] ?? 'kiosk',
            'reason' => $reason,
            'status' => 'pending',
            'message' => $payload['message'] ?? '',
            'intent' => $payload['intent'] ?? '',
            'sessionId' => $payload['sessionId'] ?? ($payload['session_id'] ?? ''),
            'ticketId' => $ticketId > 0 ? $ticketId : null,
            'ticketCode' => $payload['ticketCode'] ?? ($ticket['ticketCode'] ?? ''),
            'patientInitials' => $payload['patientInitials'] ?? ($ticket['patientInitials'] ?? ''),
            'createdAt' => $nowIso,
            'updatedAt' => $nowIso,
            'context' => isset($payload['context']) && is_array($payload['context']) ? $payload['context'] : [],
        ]);

        $store['queue_help_requests'][] = $request;
        $store['updatedAt'] = $nowIso;
        $store = $this->syncTicketAssistanceFlags($store);
        $store = $this->hydratePatientFlowStore($store);
        $request = $this->findHelpRequestRecord($store, (int) ($request['id'] ?? 0)) ?? $request;

        Metrics::increment('queue_help_requests_total', [
            'reason' => $reason,
            'source' => (string) ($request['source'] ?? 'kiosk'),
            'status' => 'pending',
        ]);

        return [
            'ok' => true,
            'store' => $store,
            'helpRequest' => $request,
            'replay' => false,
        ];
    }

    public

    public
    function patchHelpRequest(array $store, array $payload): array
    {
        $store = $this->normalizeStore($store);
        $requestId = isset($payload['id']) ? (int) $payload['id'] : 0;
        $ticketId = isset($payload['ticketId']) ? (int) $payload['ticketId'] : (isset($payload['ticket_id']) ? (int) $payload['ticket_id'] : 0);
        $status = strtolower(trim((string) ($payload['status'] ?? '')));
        if (!in_array($status, ['pending', 'attending', 'resolved'], true)) {
            return [
                'ok' => false,
                'error' => 'Estado de apoyo no soportado',
                'status' => 400,
                'errorCode' => 'queue_bad_request',
            ];
        }

        $found = false;
        $updatedRequest = null;
        $previousRequest = null;
        $nowIso = local_date('c');
        $contextPatch = isset($payload['context']) && is_array($payload['context'])
            ? $payload['context']
            : [];
        foreach ($store['queue_help_requests'] as $idx => $request) {
            if (!is_array($request)) {
                continue;
            }
            $matchesById = $requestId > 0 && (int) ($request['id'] ?? 0) === $requestId;
            $matchesByTicket = $requestId <= 0 && $ticketId > 0 && (int) ($request['ticketId'] ?? 0) === $ticketId && in_array((string) ($request['status'] ?? ''), ['pending', 'attending'], true);
            if (!$matchesById && !$matchesByTicket) {
                continue;
            }

            $previousRequest = normalize_queue_help_request($request);
            $request['status'] = $status;
            $request['updatedAt'] = $nowIso;
            if ($status === 'attending') {
                $request['attendedAt'] = $nowIso;
            }
            if ($status === 'resolved') {
                $request['resolvedAt'] = $nowIso;
            }
            if ($contextPatch !== []) {
                $request['context'] = $this->mergeHelpRequestContext(
                    isset($request['context']) && is_array($request['context'])
                        ? $request['context']
                        : [],
                    $contextPatch
                );
            }

            $store['queue_help_requests'][$idx] = normalize_queue_help_request($request);
            $updatedRequest = $store['queue_help_requests'][$idx];
            $found = true;
            if ($requestId > 0) {
                break;
            }
        }

        if (!$found || !is_array($updatedRequest)) {
            return [
                'ok' => false,
                'error' => 'Solicitud de apoyo no encontrada',
                'status' => 404,
                'errorCode' => 'queue_help_request_not_found',
            ];
        }

        $store['updatedAt'] = $nowIso;
        $store = $this->syncTicketAssistanceFlags($store);
        $store = $this->hydratePatientFlowStore($store);
        $updatedRequest = $this->findHelpRequestRecord($store, (int) ($updatedRequest['id'] ?? 0)) ?? $updatedRequest;
        if (
            is_array($previousRequest) &&
            $this->shouldRecordHelpRequestResolution($previousRequest, $updatedRequest)
        ) {
            QueueAssistantMetricsStore::recordHelpRequestResolution($updatedRequest);
        }

        Metrics::increment('queue_help_requests_total', [
            'reason' => (string) ($updatedRequest['reason'] ?? 'general'),
            'source' => (string) ($updatedRequest['source'] ?? 'kiosk'),
            'status' => $status,
        ]);

        return [
            'ok' => true,
            'store' => $store,
            'helpRequest' => $updatedRequest,
        ];
    }

    public

    private
    function nextHelpRequestId(array $requests): int
    {
        $maxId = 0;
        foreach ($requests as $request) {
            if (!is_array($request)) {
                continue;
            }
            $maxId = max($maxId, (int) ($request['id'] ?? 0));
        }

        return $maxId + 1;
    }

    private

    private
    function findTicketForHelpRequest(array $store, array $payload, int $ticketId): ?array
    {
        if ($ticketId > 0) {
            $ticket = $this->findTicketById($store, $ticketId);
            if (is_array($ticket)) {
                return $ticket;
            }
        }

        $ticketCode = trim((string) ($payload['ticketCode'] ?? ($payload['ticket_code'] ?? '')));
        if ($ticketCode !== '') {
            foreach ($store['queue_tickets'] ?? [] as $ticket) {
                if (!is_array($ticket)) {
                    continue;
                }
                if ((string) ($ticket['ticketCode'] ?? '') === $ticketCode) {
                    return normalize_queue_ticket($ticket);
                }
            }
        }

        $patientInitials = strtoupper(trim((string) ($payload['patientInitials'] ?? ($payload['patient_initials'] ?? ''))));
        if ($patientInitials !== '') {
            $tickets = array_reverse($store['queue_tickets'] ?? []);
            foreach ($tickets as $ticket) {
                if (!is_array($ticket)) {
                    continue;
                }
                if (strtoupper((string) ($ticket['patientInitials'] ?? '')) === $patientInitials) {
                    return normalize_queue_ticket($ticket);
                }
            }
        }

        return null;
    }

    private

    private
    function findOpenHelpRequest(
        array $requests,
        int $ticketId,
        string $reason,
        string $sessionId = ''
    ): ?array {
        foreach ($requests as $request) {
            if (!is_array($request)) {
                continue;
            }
            $status = (string) ($request['status'] ?? '');
            if (!in_array($status, ['pending', 'attending'], true)) {
                continue;
            }
            $sameTicket = $ticketId > 0 && (int) ($request['ticketId'] ?? 0) === $ticketId;
            $sameSession = $sessionId !== '' && (string) ($request['sessionId'] ?? '') === $sessionId;
            if (!$sameTicket && !$sameSession) {
                continue;
            }
            if ((string) ($request['reason'] ?? '') !== $reason) {
                continue;
            }
            return normalize_queue_help_request($request);
        }

        return null;
    }

    private

    private
    function syncTicketAssistanceFlags(array $store): array
    {
        $activeByTicketId = [];
        foreach ($store['queue_help_requests'] ?? [] as $request) {
            if (!is_array($request)) {
                continue;
            }
            $ticketId = (int) ($request['ticketId'] ?? 0);
            if ($ticketId <= 0) {
                continue;
            }
            $status = (string) ($request['status'] ?? '');
            if (!in_array($status, ['pending', 'attending'], true)) {
                continue;
            }
            if (!isset($activeByTicketId[$ticketId])) {
                $activeByTicketId[$ticketId] = $request;
            }
        }

        foreach ($store['queue_tickets'] as $idx => $ticket) {
            if (!is_array($ticket)) {
                continue;
            }
            $ticketId = (int) ($ticket['id'] ?? 0);
            $activeRequest = $activeByTicketId[$ticketId] ?? null;
            if (is_array($activeRequest)) {
                $ticket['needsAssistance'] = true;
                $ticket['assistanceRequestStatus'] = (string) ($activeRequest['status'] ?? 'pending');
                $ticket['activeHelpRequestId'] = (int) ($activeRequest['id'] ?? 0);
                $ticket['assistanceReason'] = (string) ($activeRequest['reason'] ?? '');
                if ((string) ($activeRequest['reason'] ?? '') === 'special_priority') {
                    $ticket['specialPriority'] = true;
                }
                if ((string) ($activeRequest['reason'] ?? '') === 'late_arrival') {
                    $ticket['lateArrival'] = true;
                }
                if (in_array((string) ($activeRequest['reason'] ?? ''), ['printer_issue', 'reprint_requested'], true)) {
                    $ticket['reprintRequestedAt'] = (string) ($activeRequest['createdAt'] ?? local_date('c'));
                }
            } else {
                $ticket['needsAssistance'] = false;
                $ticket['assistanceRequestStatus'] = '';
                $ticket['activeHelpRequestId'] = null;
                $ticket['assistanceReason'] = (string) ($ticket['assistanceReason'] ?? '');
            }

            $store['queue_tickets'][$idx] = normalize_queue_ticket($ticket);
        }

        return $store;
    }

    private

    private
    function mergeHelpRequestContext(array $current, array $patch): array
    {
        return array_replace_recursive($current, $patch);
    }

    private

    private
    function shouldRecordHelpRequestResolution(array $previousRequest, array $updatedRequest): bool
    {
        $updatedStatus = strtolower(trim((string) ($updatedRequest['status'] ?? '')));
        if ($updatedStatus !== 'resolved') {
            return false;
        }

        $updatedOutcome = $this->readHelpRequestContextValue(
            isset($updatedRequest['context']) && is_array($updatedRequest['context'])
                ? $updatedRequest['context']
                : [],
            ['resolutionOutcome', 'resolution_outcome', 'reviewOutcome', 'review_outcome']
        );
        if ($updatedOutcome === '') {
            return false;
        }

        $previousStatus = strtolower(trim((string) ($previousRequest['status'] ?? '')));
        if ($previousStatus !== 'resolved') {
            return true;
        }

        $previousOutcome = $this->readHelpRequestContextValue(
            isset($previousRequest['context']) && is_array($previousRequest['context'])
                ? $previousRequest['context']
                : [],
            ['resolutionOutcome', 'resolution_outcome', 'reviewOutcome', 'review_outcome']
        );

        return $previousOutcome === '' && $updatedOutcome !== '';
    }

    private
    function readHelpRequestContextValue(array $context, array $keys): string
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

    private

}
