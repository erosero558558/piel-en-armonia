<?php

declare(strict_types=1);

final class PatientCaseSyncService
{
public function hydrateStore(array $store): array
    {
        $tenantId = $this->resolveTenantId($store);
        $appointments = isset($store['appointments']) && is_array($store['appointments']) ? array_values($store['appointments']) : [];
        $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? array_values($store['callbacks']) : [];
        $queueTickets = isset($store['queue_tickets']) && is_array($store['queue_tickets']) ? array_values($store['queue_tickets']) : [];
        $queueHelpRequests = isset($store['queue_help_requests']) && is_array($store['queue_help_requests'])
            ? array_values($store['queue_help_requests'])
            : [];
        $approvals = $this->normalizeApprovals($store['patient_case_approvals'] ?? [], $tenantId);
        $existingCases = isset($store['patient_cases']) && is_array($store['patient_cases'])
            ? array_values($store['patient_cases'])
            : [];
        $existingLinks = isset($store['patient_case_links']) && is_array($store['patient_case_links'])
            ? array_values($store['patient_case_links'])
            : [];
        $existingTimeline = isset($store['patient_case_timeline_events']) && is_array($store['patient_case_timeline_events'])
            ? array_values($store['patient_case_timeline_events'])
            : [];

        $cases = $this->seedExistingCases($existingCases, $tenantId);
        $links = $this->indexExistingLinks($existingLinks, $tenantId);
        $timeline = $this->indexExistingTimeline($existingTimeline, $tenantId);
        $caseIdsByAppointmentId = [];
        $caseIdsByTicketId = [];
        $caseIdsByIdentity = [];

        foreach ((array) ($store['patient_cases'] ?? []) as $persistedCase) {
            $this->seedPersistedCase($cases, $persistedCase, $tenantId);
        }

        foreach ((array) ($store['patient_case_links'] ?? []) as $persistedLink) {
            if (!is_array($persistedLink)) {
                continue;
            }

            $linkId = trim((string) ($persistedLink['id'] ?? ''));
            $caseId = trim((string) ($persistedLink['patientCaseId'] ?? ''));
            if ($linkId === '' || $caseId === '') {
                continue;
            }

            $createdAt = $this->normalizeTimestampValue(
                (string) ($persistedLink['createdAt'] ?? local_date('c')),
                local_date('c')
            );
            $links[$linkId] = [
                'id' => $linkId,
                'tenantId' => $this->resolveRecordTenantId($persistedLink, $tenantId),
                'patientCaseId' => $caseId,
                'entityType' => trim((string) ($persistedLink['entityType'] ?? 'callback')) ?: 'callback',
                'entityId' => trim((string) ($persistedLink['entityId'] ?? '')),
                'relationship' => trim((string) ($persistedLink['relationship'] ?? 'secondary')) ?: 'secondary',
                'createdAt' => $createdAt,
            ];
        }

        foreach ((array) ($store['patient_case_timeline_events'] ?? []) as $persistedEvent) {
            if (!is_array($persistedEvent)) {
                continue;
            }

            $eventId = trim((string) ($persistedEvent['id'] ?? ''));
            $caseId = trim((string) ($persistedEvent['patientCaseId'] ?? ''));
            if ($eventId === '' || $caseId === '') {
                continue;
            }

            $createdAt = $this->normalizeTimestampValue(
                (string) ($persistedEvent['createdAt'] ?? local_date('c')),
                local_date('c')
            );
            $timeline[$eventId] = [
                'id' => $eventId,
                'tenantId' => $this->resolveRecordTenantId($persistedEvent, $tenantId),
                'patientCaseId' => $caseId,
                'type' => trim((string) ($persistedEvent['type'] ?? 'status_changed')) ?: 'status_changed',
                'title' => trim((string) ($persistedEvent['title'] ?? 'Actualizacion de caso')) ?: 'Actualizacion de caso',
                'payload' => isset($persistedEvent['payload']) && is_array($persistedEvent['payload'])
                    ? $persistedEvent['payload']
                    : [],
                'createdAt' => $createdAt,
            ];
        }

        foreach ($appointments as $index => $appointment) {
            if (!is_array($appointment)) {
                continue;
            }

            $appointmentTenantId = $this->resolveRecordTenantId($appointment, $tenantId);
            $appointment['tenantId'] = $appointmentTenantId;
            $appointmentId = (int) ($appointment['id'] ?? 0);
            $appointmentIdentityKeys = $this->buildAppointmentIdentityKeys($appointment);
            $caseId = $this->resolveCaseId(
                (string) ($appointment['patientCaseId'] ?? ''),
                $appointmentTenantId,
                'appointment:' . $appointmentId,
                $appointmentIdentityKeys,
                $caseIdsByIdentity,
                $cases
            );
            $patientId = trim((string) ($appointment['patientId'] ?? ''));
            if ($patientId === '' && $caseId !== '' && isset($cases[$caseId])) {
                $patientId = trim((string) ($cases[$caseId]['patientId'] ?? ''));
            }
            if ($patientId === '') {
                $patientId = $this->resolveAppointmentPatientId($appointment, $appointmentTenantId);
            }
            $appointment['patientId'] = $patientId;
            $appointment['patientCaseId'] = $caseId;
            $appointments[$index] = $appointment;

            if ($appointmentId > 0) {
                $caseIdsByAppointmentId[$appointmentId] = $caseId;
            }

            $this->registerIdentityKeys(
                $caseIdsByIdentity,
                $appointmentTenantId,
                $caseId,
                $appointmentIdentityKeys
            );

            $openedAt = $this->resolveOpenedAt($appointment);
            $this->ensureCase($cases, $caseId, $appointmentTenantId, $patientId, $openedAt);

            $scheduledStart = $this->composeScheduledTimestamp(
                (string) ($appointment['date'] ?? ''),
                (string) ($appointment['time'] ?? '')
            );
            $this->updateCaseFromAppointment($cases[$caseId], $appointment, $scheduledStart);

            if ($appointmentId > 0) {
                $linkId = $this->buildDeterministicId(
                    'pcl',
                    [$appointmentTenantId, $caseId, 'appointment', (string) $appointmentId]
                );
                $links[$linkId] = [
                    'id' => $linkId,
                    'tenantId' => $appointmentTenantId,
                    'patientCaseId' => $caseId,
                    'entityType' => 'appointment',
                    'entityId' => (string) $appointmentId,
                    'relationship' => 'primary',
                    'createdAt' => $openedAt,
                ];
            }

            $caseOpenedEventId = $this->buildEventId(
                $appointmentTenantId,
                $caseId,
                'case_opened',
                $openedAt,
                'appointment:' . $appointmentId
            );
            $timeline[$caseOpenedEventId] = [
                'id' => $caseOpenedEventId,
                'tenantId' => $appointmentTenantId,
                'patientCaseId' => $caseId,
                'type' => 'case_opened',
                'title' => 'Caso abierto desde agenda',
                'payload' => [
                    'appointmentId' => $appointmentId > 0 ? (string) $appointmentId : '',
                    'service' => (string) ($appointment['service'] ?? ''),
                ],
                'createdAt' => $openedAt,
            ];

            $appointmentCreatedEventId = $this->buildEventId(
                $appointmentTenantId,
                $caseId,
                'appointment_created',
                $openedAt,
                'appointment:' . $appointmentId
            );
            $timeline[$appointmentCreatedEventId] = [
                'id' => $appointmentCreatedEventId,
                'tenantId' => $appointmentTenantId,
                'patientCaseId' => $caseId,
                'type' => 'appointment_created',
                'title' => 'Reserva confirmada',
                'payload' => [
                    'appointmentId' => $appointmentId > 0 ? (string) $appointmentId : '',
                    'scheduledStart' => $scheduledStart,
                    'doctor' => (string) ($appointment['doctor'] ?? ''),
                ],
                'createdAt' => $openedAt,
            ];

            $appointmentStatus = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
            if (in_array($appointmentStatus, ['cancelled', 'completed', 'no_show'], true)) {
                $terminalAt = $this->resolveTerminalAt($appointment, $scheduledStart);
                $eventType = $appointmentStatus === 'completed'
                    ? 'visit_completed'
                    : ($appointmentStatus === 'no_show' ? 'no_show' : 'status_changed');
                $title = $appointmentStatus === 'completed'
                    ? 'Consulta cerrada'
                    : ($appointmentStatus === 'no_show' ? 'Paciente no asistio' : 'Caso cancelado');
                $eventId = $this->buildEventId(
                    $appointmentTenantId,
                    $caseId,
                    $eventType,
                    $terminalAt,
                    'appointment-status:' . $appointmentStatus
                );
                $timeline[$eventId] = [
                    'id' => $eventId,
                    'tenantId' => $appointmentTenantId,
                    'patientCaseId' => $caseId,
                    'type' => $eventType,
                    'title' => $title,
                    'payload' => [
                        'appointmentId' => $appointmentId > 0 ? (string) $appointmentId : '',
                        'status' => $appointmentStatus,
                    ],
                    'createdAt' => $terminalAt,
                ];
            }
        }

        foreach ($queueTickets as $index => $ticket) {
            if (!is_array($ticket)) {
                continue;
            }

            $ticketTenantId = $this->resolveRecordTenantId($ticket, $tenantId);
            $ticket['tenantId'] = $ticketTenantId;
            $ticketId = (int) ($ticket['id'] ?? 0);
            $appointmentId = (int) ($ticket['appointmentId'] ?? 0);
            $existingCaseId = trim((string) ($ticket['patientCaseId'] ?? ''));
            $caseId = $existingCaseId !== ''
                ? $existingCaseId
                : ($caseIdsByAppointmentId[$appointmentId] ?? $this->buildDeterministicId(
                    'pc',
                    [$ticketTenantId, 'ticket', (string) $ticketId]
                ));
            $ticket['patientCaseId'] = $caseId;

            $patientId = trim((string) ($ticket['patientId'] ?? ''));
            if ($patientId === '') {
                $patientId = isset($cases[$caseId]) ? (string) ($cases[$caseId]['patientId'] ?? '') : '';
            }
            if ($patientId === '') {
                $patientId = $this->buildDeterministicId(
                    'pt',
                    [$ticketTenantId, 'ticket', (string) $ticketId, (string) ($ticket['patientInitials'] ?? '')]
                );
            }
            $ticket['patientId'] = $patientId;
            $queueTickets[$index] = $ticket;

            if ($ticketId > 0) {
                $caseIdsByTicketId[$ticketId] = $caseId;
            }

            $createdAt = $this->normalizeTimestampValue((string) ($ticket['createdAt'] ?? local_date('c')), local_date('c'));
            $this->ensureCase($cases, $caseId, $ticketTenantId, $patientId, $createdAt);
            $this->updateCaseFromTicket($cases[$caseId], $ticket, $createdAt);

            if ($ticketId > 0) {
                $linkId = $this->buildDeterministicId(
                    'pcl',
                    [$ticketTenantId, $caseId, 'queue_ticket', (string) $ticketId]
                );
                $links[$linkId] = [
                    'id' => $linkId,
                    'tenantId' => $ticketTenantId,
                    'patientCaseId' => $caseId,
                    'entityType' => 'queue_ticket',
                    'entityId' => (string) $ticketId,
                    'relationship' => $appointmentId > 0 ? 'primary' : 'derived',
                    'createdAt' => $createdAt,
                ];
            }

            $arrivedEventId = $this->buildEventId(
                $ticketTenantId,
                $caseId,
                'status_changed',
                $createdAt,
                'arrived:' . $ticketId
            );
            $timeline[$arrivedEventId] = [
                'id' => $arrivedEventId,
                'tenantId' => $ticketTenantId,
                'patientCaseId' => $caseId,
                'type' => 'status_changed',
                'title' => 'Paciente llego a recepcion',
                'payload' => [
                    'ticketId' => $ticketId > 0 ? (string) $ticketId : '',
                    'status' => 'arrived',
                ],
                'createdAt' => $createdAt,
            ];

            $checkInEventId = $this->buildEventId(
                $ticketTenantId,
                $caseId,
                'check_in_completed',
                $createdAt,
                'ticket:' . $ticketId
            );
            $timeline[$checkInEventId] = [
                'id' => $checkInEventId,
                'tenantId' => $ticketTenantId,
                'patientCaseId' => $caseId,
                'type' => 'check_in_completed',
                'title' => 'Check-in completado',
                'payload' => [
                    'ticketId' => $ticketId > 0 ? (string) $ticketId : '',
                    'queueType' => (string) ($ticket['queueType'] ?? 'walk_in'),
                ],
                'createdAt' => $createdAt,
            ];

            $calledAt = trim((string) ($ticket['calledAt'] ?? ''));
            if ($calledAt !== '') {
                $normalizedCalledAt = $this->normalizeTimestampValue($calledAt, $createdAt);
                $calledEventId = $this->buildEventId(
                    $ticketTenantId,
                    $caseId,
                    'queue_called',
                    $normalizedCalledAt,
                    'ticket:' . $ticketId
                );
                $timeline[$calledEventId] = [
                    'id' => $calledEventId,
                    'tenantId' => $ticketTenantId,
                    'patientCaseId' => $caseId,
                    'type' => 'queue_called',
                    'title' => 'Paciente llamado a consultorio',
                    'payload' => [
                        'ticketId' => $ticketId > 0 ? (string) $ticketId : '',
                        'consultorio' => $ticket['assignedConsultorio'] ?? null,
                    ],
                    'createdAt' => $normalizedCalledAt,
                ];
            }

            $ticketStatus = strtolower(trim((string) ($ticket['status'] ?? 'waiting')));
            if (in_array($ticketStatus, ['completed', 'no_show', 'cancelled'], true)) {
                $terminalAt = $this->normalizeTimestampValue(
                    (string) ($ticket['completedAt'] ?? ''),
                    $calledAt !== '' ? $calledAt : $createdAt
                );
                $eventType = $ticketStatus === 'completed'
                    ? 'visit_completed'
                    : ($ticketStatus === 'no_show' ? 'no_show' : 'status_changed');
                $title = $ticketStatus === 'completed'
                    ? 'Turno completado'
                    : ($ticketStatus === 'no_show' ? 'Paciente no respondio al llamado' : 'Turno cancelado');
                $terminalEventId = $this->buildEventId(
                    $ticketTenantId,
                    $caseId,
                    $eventType,
                    $terminalAt,
                    'ticket-status:' . $ticketStatus . ':' . $ticketId
                );
                $timeline[$terminalEventId] = [
                    'id' => $terminalEventId,
                    'tenantId' => $ticketTenantId,
                    'patientCaseId' => $caseId,
                    'type' => $eventType,
                    'title' => $title,
                    'payload' => [
                        'ticketId' => $ticketId > 0 ? (string) $ticketId : '',
                        'status' => $ticketStatus,
                    ],
                    'createdAt' => $terminalAt,
                ];
            }
        }
        foreach ($queueHelpRequests as $index => $request) {
            if (!is_array($request)) {
                continue;
            }

            $requestTenantId = $this->resolveRecordTenantId($request, $tenantId);
            $request['tenantId'] = $requestTenantId;
            $requestId = (int) ($request['id'] ?? 0);
            $ticketId = (int) ($request['ticketId'] ?? 0);
            $caseId = $caseIdsByTicketId[$ticketId] ?? trim((string) ($request['patientCaseId'] ?? ''));
            if ($caseId !== '') {
                $request['patientCaseId'] = $caseId;
                if (isset($cases[$caseId])) {
                    $status = strtolower(trim((string) ($request['status'] ?? 'pending')));
                    $updatedAt = $this->normalizeTimestampValue(
                        (string) ($request['updatedAt'] ?? ($request['createdAt'] ?? '')),
                        local_date('c')
                    );
                    if (in_array($status, ['pending', 'attending'], true)) {
                        $cases[$caseId]['summary']['activeHelpRequestId'] = $requestId > 0 ? $requestId : null;
                        $cases[$caseId]['summary']['openActionCount'] = max(
                            (int) ($cases[$caseId]['summary']['openActionCount'] ?? 0),
                            1
                        );
                    }
                    $this->touchCase($cases[$caseId], $updatedAt);

                    $eventId = $this->buildEventId(
                        $requestTenantId,
                        $caseId,
                        'status_changed',
                        $updatedAt,
                        'help-request:' . $requestId . ':' . $status
                    );
                    $timeline[$eventId] = [
                        'id' => $eventId,
                        'tenantId' => $requestTenantId,
                        'patientCaseId' => $caseId,
                        'type' => 'status_changed',
                        'title' => 'Solicitud de apoyo: ' . $status,
                        'payload' => [
                            'helpRequestId' => $requestId > 0 ? (string) $requestId : '',
                            'ticketId' => $ticketId > 0 ? (string) $ticketId : '',
                            'reason' => (string) ($request['reason'] ?? 'general'),
                            'status' => $status,
                        ],
                        'createdAt' => $updatedAt,
                    ];
                }
            }
            $queueHelpRequests[$index] = $request;
        }

        foreach ($callbacks as $index => $callback) {
            if (!is_array($callback)) {
                continue;
            }

            $callbackTenantId = $this->resolveRecordTenantId($callback, $tenantId);
            $callback['tenantId'] = $callbackTenantId;
            $callbackId = (int) ($callback['id'] ?? 0);
            $patientId = $this->resolveCallbackPatientId($callback, $callbackTenantId);
            $callback['patientId'] = $patientId;
            $caseId = $this->resolveCallbackCaseId(
                $callback,
                $callbackTenantId,
                $caseIdsByIdentity,
                $cases
            );
            if ($caseId !== '') {
                $callback['patientCaseId'] = $caseId;
                if (isset($cases[$caseId])) {
                    $createdAt = $this->normalizeTimestampValue((string) ($callback['fecha'] ?? local_date('c')), local_date('c'));
                    $cases[$caseId]['summary']['latestCallbackId'] = $callbackId > 0 ? (string) $callbackId : null;
                    $cases[$caseId]['summary']['lastChannel'] = 'web';
                    $this->touchCase($cases[$caseId], $createdAt);
                    if ($cases[$caseId]['lastInboundAt'] === null || strcmp((string) $cases[$caseId]['lastInboundAt'], $createdAt) < 0) {
                        $cases[$caseId]['lastInboundAt'] = $createdAt;
                    }

                    $leadOps = isset($callback['leadOps']) && is_array($callback['leadOps']) ? $callback['leadOps'] : [];
                    $contactedAt = trim((string) ($leadOps['contactedAt'] ?? ''));
                    if ($contactedAt !== '') {
                        $cases[$caseId]['lastOutboundAt'] = $this->normalizeTimestampValue($contactedAt, $createdAt);
                    }

                    $linkId = $this->buildDeterministicId(
                        'pcl',
                        [$callbackTenantId, $caseId, 'callback', (string) $callbackId]
                    );
                    $links[$linkId] = [
                        'id' => $linkId,
                        'tenantId' => $callbackTenantId,
                        'patientCaseId' => $caseId,
                        'entityType' => 'callback',
                        'entityId' => (string) $callbackId,
                        'relationship' => 'secondary',
                        'createdAt' => $createdAt,
                    ];

                    $eventId = $this->buildEventId(
                        $callbackTenantId,
                        $caseId,
                        'callback_created',
                        $createdAt,
                        'callback:' . $callbackId
                    );
                    $timeline[$eventId] = [
                        'id' => $eventId,
                        'tenantId' => $callbackTenantId,
                        'patientCaseId' => $caseId,
                        'type' => 'callback_created',
                        'title' => 'Callback registrado',
                        'payload' => [
                            'callbackId' => $callbackId > 0 ? (string) $callbackId : '',
                            'status' => (string) ($callback['status'] ?? 'pendiente'),
                        ],
                        'createdAt' => $createdAt,
                    ];
                }
            }

            $callbacks[$index] = $callback;
        }

        foreach ($approvals as $approval) {
            if (!is_array($approval)) {
                continue;
            }
            $caseId = trim((string) ($approval['patientCaseId'] ?? ''));
            if ($caseId === '' || !isset($cases[$caseId])) {
                continue;
            }
            if ((string) ($approval['status'] ?? 'pending') === 'pending') {
                $cases[$caseId]['summary']['pendingApprovalCount'] = (int) ($cases[$caseId]['summary']['pendingApprovalCount'] ?? 0) + 1;
            }
        }

        $queueTickets = $this->enrichQueueTicketsWithPatientCaseSnapshots(
            $queueTickets,
            $cases,
            $timeline,
            $approvals
        );

        $store['appointments'] = $appointments;
        $store['callbacks'] = $callbacks;
        $store['queue_tickets'] = $queueTickets;
        $store['queue_help_requests'] = $queueHelpRequests;
        $store['patient_cases'] = $this->sortCases(array_values($cases));
        $store['patient_case_links'] = $this->sortByCreatedAtDesc(array_values($links));
        $store['patient_case_timeline_events'] = $this->sortByCreatedAtDesc(array_values($timeline));
        $store['patient_case_approvals'] = $this->sortByCreatedAtDesc($approvals);

        return $store;
    }

public function buildSummary(array $store): array
    {
        $store = $this->hydrateStore($store);
        $cases = isset($store['patient_cases']) && is_array($store['patient_cases']) ? $store['patient_cases'] : [];
        $approvals = isset($store['patient_case_approvals']) && is_array($store['patient_case_approvals'])
            ? $store['patient_case_approvals']
            : [];
        $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
        $queueHelpRequests = isset($store['queue_help_requests']) && is_array($store['queue_help_requests'])
            ? $store['queue_help_requests']
            : [];

        $statusCounts = [];
        $openCases = 0;
        $closedCases = 0;
        foreach ($cases as $case) {
            if (!is_array($case)) {
                continue;
            }
            $status = (string) ($case['status'] ?? 'booked');
            $statusCounts[$status] = (int) ($statusCounts[$status] ?? 0) + 1;
            if (in_array($status, self::TERMINAL_STATUSES, true)) {
                $closedCases++;
            } else {
                $openCases++;
            }
        }

        $callbacksLinked = 0;
        foreach ($callbacks as $callback) {
            if (is_array($callback) && trim((string) ($callback['patientCaseId'] ?? '')) !== '') {
                $callbacksLinked++;
            }
        }

        $pendingApprovals = 0;
        foreach ($approvals as $approval) {
            if (is_array($approval) && (string) ($approval['status'] ?? 'pending') === 'pending') {
                $pendingApprovals++;
            }
        }

        $activeHelpRequests = 0;
        foreach ($queueHelpRequests as $request) {
            if (!is_array($request)) {
                continue;
            }
            if (in_array((string) ($request['status'] ?? ''), ['pending', 'attending'], true)) {
                $activeHelpRequests++;
            }
        }

        return [
            'generatedAt' => local_date('c'),
            'casesTotal' => count($cases),
            'casesOpen' => $openCases,
            'casesClosed' => $closedCases,
            'statusCounts' => $statusCounts,
            'callbacksLinked' => $callbacksLinked,
            'pendingApprovals' => $pendingApprovals,
            'activeHelpRequests' => $activeHelpRequests,
        ];
    }

public function buildReadModel(array $store, ?string $caseId = null): array
    {
        $store = $this->hydrateStore($store);
        $cases = isset($store['patient_cases']) && is_array($store['patient_cases']) ? $store['patient_cases'] : [];
        
        require_once __DIR__ . '/memberships/MembershipService.php';
        $membershipSvc = new MembershipService();
        foreach ($cases as &$case) {
            $pid = trim((string)($case['patientId'] ?? ''));
            if ($pid !== '') {
                $status = $membershipSvc->getStatus($pid);
                $case['membership_status'] = $status !== null;
                $case['membership_plan'] = $status !== null ? $status['plan'] : null;
                if ($status !== null) {
                    $case['priority_booking'] = true;
                }
            } else {
                $case['membership_status'] = false;
                $case['membership_plan'] = null;
            }
        }
        unset($case);

        $links = isset($store['patient_case_links']) && is_array($store['patient_case_links'])
            ? $store['patient_case_links']
            : [];
        $timeline = isset($store['patient_case_timeline_events']) && is_array($store['patient_case_timeline_events'])
            ? $store['patient_case_timeline_events']
            : [];
        $approvals = isset($store['patient_case_approvals']) && is_array($store['patient_case_approvals'])
            ? $store['patient_case_approvals']
            : [];

        if ($caseId !== null && $caseId !== '') {
            $cases = array_values(array_filter($cases, static function (array $case) use ($caseId): bool {
                return (string) ($case['id'] ?? '') === $caseId;
            }));
            $links = array_values(array_filter($links, static function (array $link) use ($caseId): bool {
                return (string) ($link['patientCaseId'] ?? '') === $caseId;
            }));
            $timeline = array_values(array_filter($timeline, static function (array $event) use ($caseId): bool {
                return (string) ($event['patientCaseId'] ?? '') === $caseId;
            }));
            $approvals = array_values(array_filter($approvals, static function (array $approval) use ($caseId): bool {
                return (string) ($approval['patientCaseId'] ?? '') === $caseId;
            }));
        }

        return [
            'summary' => array_merge($this->buildSummary($store), [
                'selectedCaseId' => $caseId !== null && $caseId !== '' ? $caseId : null,
            ]),
            'cases' => $cases,
            'links' => $links,
            'timeline' => $timeline,
            'approvals' => $approvals,
        ];
    }

private function indexExistingLinks(array $links, string $fallbackTenantId): array
    {
        $indexed = [];

        foreach ($links as $link) {
            if (!is_array($link)) {
                continue;
            }

            $linkId = trim((string) ($link['id'] ?? ''));
            if ($linkId === '') {
                continue;
            }

            $link['tenantId'] = $this->resolveRecordTenantId($link, $fallbackTenantId);
            $indexed[$linkId] = $link;
        }

        return $indexed;
    }

private function indexExistingTimeline(array $timeline, string $fallbackTenantId): array
    {
        $indexed = [];

        foreach ($timeline as $event) {
            if (!is_array($event)) {
                continue;
            }

            $eventId = trim((string) ($event['id'] ?? ''));
            if ($eventId === '') {
                continue;
            }

            $event['tenantId'] = $this->resolveRecordTenantId($event, $fallbackTenantId);
            $indexed[$eventId] = $event;
        }

        return $indexed;
    }

private function seedExistingCases(array $cases, string $fallbackTenantId): array
    {
        $seeded = [];

        foreach ($cases as $case) {
            if (!is_array($case)) {
                continue;
            }

            $normalized = $this->normalizeExistingCase($case, $fallbackTenantId);
            if ($normalized === null) {
                continue;
            }

            $seeded[(string) $normalized['id']] = $normalized;
        }

        return $seeded;
    }

private function normalizeExistingCase(array $case, string $fallbackTenantId): ?array
    {
        $caseId = trim((string) ($case['id'] ?? ''));
        if ($caseId === '') {
            return null;
        }

        $tenantId = $this->resolveRecordTenantId($case, $fallbackTenantId);
        $openedAt = $this->firstNonEmptyString([
            $case['openedAt'] ?? '',
            $case['latestActivityAt'] ?? '',
            $case['journeyEnteredAt'] ?? '',
            local_date('c'),
        ]) ?? local_date('c');
        $latestActivityAt = $this->firstNonEmptyString([
            $case['latestActivityAt'] ?? '',
            $openedAt,
        ]) ?? $openedAt;
        $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];

        return array_merge($case, [
            'id' => $caseId,
            'tenantId' => $tenantId,
            'patientId' => trim((string) ($case['patientId'] ?? '')),
            'status' => trim((string) ($case['status'] ?? '')) !== ''
                ? trim((string) ($case['status'] ?? ''))
                : 'lead_captured',
            'openedAt' => $openedAt,
            'latestActivityAt' => $latestActivityAt,
            'closedAt' => trim((string) ($case['closedAt'] ?? '')) ?: null,
            'lastInboundAt' => trim((string) ($case['lastInboundAt'] ?? '')) ?: null,
            'lastOutboundAt' => trim((string) ($case['lastOutboundAt'] ?? '')) ?: null,
            'summary' => $summary,
        ]);
    }

private function mergeMilestone($milestones, string $key, string $value): array
    {
        $normalized = is_array($milestones) ? $milestones : [];
        if ($value === '') {
            return $normalized;
        }

        if (!isset($normalized[$key]) || trim((string) $normalized[$key]) === '') {
            $normalized[$key] = $value;
            return $normalized;
        }

        if (strcmp((string) $normalized[$key], $value) > 0) {
            $normalized[$key] = $value;
        }

        return $normalized;
    }

private function summarizePreviousVisits(array $timelineEvents, string $referenceAt): array
    {
        $normalizedReferenceAt = $this->normalizeTimestampValue($referenceAt, local_date('c'));
        $previousVisitsCount = 0;
        $lastCompletedVisitAt = '';

        foreach ($timelineEvents as $event) {
            if (!is_array($event)) {
                continue;
            }

            if ((string) ($event['type'] ?? '') !== 'visit_completed') {
                continue;
            }

            $eventAt = $this->normalizeTimestampValue(
                (string) ($event['createdAt'] ?? ''),
                $normalizedReferenceAt
            );
            if ($eventAt === '' || strcmp($eventAt, $normalizedReferenceAt) >= 0) {
                continue;
            }

            $previousVisitsCount++;
            if ($lastCompletedVisitAt === '' || strcmp($lastCompletedVisitAt, $eventAt) < 0) {
                $lastCompletedVisitAt = $eventAt;
            }
        }

        return [$previousVisitsCount, $lastCompletedVisitAt];
    }

private function sortCases(array $cases): array
    {
        usort($cases, static function (array $left, array $right): int {
            $leftAt = (string) ($left['latestActivityAt'] ?? '');
            $rightAt = (string) ($right['latestActivityAt'] ?? '');
            if ($leftAt !== $rightAt) {
                return strcmp($rightAt, $leftAt);
            }
            return strcmp((string) ($right['id'] ?? ''), (string) ($left['id'] ?? ''));
        });

        return $cases;
    }

private function sortByCreatedAtDesc(array $records): array
    {
        usort($records, static function (array $left, array $right): int {
            $leftAt = (string) ($left['createdAt'] ?? '');
            $rightAt = (string) ($right['createdAt'] ?? '');
            if ($leftAt !== $rightAt) {
                return strcmp($rightAt, $leftAt);
            }
            return strcmp((string) ($right['id'] ?? ''), (string) ($left['id'] ?? ''));
        });

        return $records;
    }

private function ensureCase(array &$cases, string $caseId, string $tenantId, string $patientId, string $openedAt): void
    {
        if (!isset($cases[$caseId])) {
            $cases[$caseId] = [
                'id' => $caseId,
                'tenantId' => $tenantId,
                'patientId' => $patientId,
                'status' => 'booked',
                'statusSource' => 'derived',
                'openedAt' => $openedAt,
                'latestActivityAt' => $openedAt,
                'closedAt' => null,
                'lastInboundAt' => null,
                'lastOutboundAt' => null,
                'summary' => [
                    'primaryAppointmentId' => null,
                    'latestAppointmentId' => null,
                    'latestCallbackId' => null,
                    'serviceLine' => null,
                    'providerName' => null,
                    'scheduledStart' => null,
                    'scheduledEnd' => null,
                    'queueStatus' => null,
                    'lastChannel' => null,
                    'openActionCount' => 0,
                    'pendingApprovalCount' => 0,
                    'latestTicketId' => null,
                    'latestTicketCode' => null,
                    'assignedConsultorio' => null,
                    'activeHelpRequestId' => null,
                    'patientLabel' => null,
                    'milestones' => [],
                ],
            ];
            return;
        }

        if ((string) ($cases[$caseId]['patientId'] ?? '') === '' && $patientId !== '') {
            $cases[$caseId]['patientId'] = $patientId;
        }
        if (strcmp((string) ($cases[$caseId]['openedAt'] ?? $openedAt), $openedAt) > 0) {
            $cases[$caseId]['openedAt'] = $openedAt;
        }
    }

private function seedPersistedCase(array &$cases, $persistedCase, string $tenantId): void
    {
        if (!is_array($persistedCase)) {
            return;
        }

        $caseId = trim((string) ($persistedCase['id'] ?? ''));
        if ($caseId === '') {
            return;
        }

        $caseTenantId = $this->resolveRecordTenantId($persistedCase, $tenantId);
        $patientId = trim((string) ($persistedCase['patientId'] ?? ''));
        $openedAt = $this->normalizeTimestampValue(
            (string) ($persistedCase['openedAt'] ?? local_date('c')),
            local_date('c')
        );

        $this->ensureCase($cases, $caseId, $caseTenantId, $patientId, $openedAt);

        $status = trim((string) ($persistedCase['status'] ?? ''));
        if ($status !== '') {
            $cases[$caseId]['status'] = $status;
        }

        $statusSource = trim((string) ($persistedCase['statusSource'] ?? ''));
        if ($statusSource !== '') {
            $cases[$caseId]['statusSource'] = $statusSource;
        }

        foreach (['latestActivityAt', 'lastInboundAt', 'lastOutboundAt'] as $field) {
            $candidate = trim((string) ($persistedCase[$field] ?? ''));
            if ($candidate === '') {
                continue;
            }
            $cases[$caseId][$field] = $this->normalizeTimestampValue($candidate, $openedAt);
        }

        $closedAt = trim((string) ($persistedCase['closedAt'] ?? ''));
        $cases[$caseId]['closedAt'] = $closedAt !== ''
            ? $this->normalizeTimestampValue($closedAt, $openedAt)
            : ($cases[$caseId]['closedAt'] ?? null);

        if (isset($persistedCase['summary']) && is_array($persistedCase['summary'])) {
            $cases[$caseId]['summary'] = array_merge(
                is_array($cases[$caseId]['summary'] ?? null) ? $cases[$caseId]['summary'] : [],
                $persistedCase['summary']
            );
        }
    }

private function updateCaseFromAppointment(array &$case, array $appointment, string $scheduledStart): void
    {
        $appointmentId = (int) ($appointment['id'] ?? 0);
        $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
        if (($summary['primaryAppointmentId'] ?? null) === null && $appointmentId > 0) {
            $summary['primaryAppointmentId'] = (string) $appointmentId;
        }
        if ($appointmentId > 0) {
            $summary['latestAppointmentId'] = (string) $appointmentId;
        }
        $summary['serviceLine'] = $this->firstNonEmptyString([
            (string) ($appointment['service'] ?? ''),
            isset($summary['serviceLine']) ? (string) $summary['serviceLine'] : '',
        ]);
        $summary['providerName'] = $this->firstNonEmptyString([
            (string) ($appointment['doctor'] ?? ''),
            (string) ($appointment['doctorAssigned'] ?? ''),
            isset($summary['providerName']) ? (string) $summary['providerName'] : '',
        ]);
        if ($scheduledStart !== '') {
            $summary['scheduledStart'] = $scheduledStart;
            $durationMin = max(0, (int) ($appointment['slotDurationMin'] ?? 0));
            $summary['scheduledEnd'] = $durationMin > 0
                ? $this->offsetTimestampMinutes($scheduledStart, $durationMin)
                : $scheduledStart;
        }
        $summary['patientLabel'] = $this->firstNonEmptyString([
            (string) ($appointment['name'] ?? ''),
            isset($summary['patientLabel']) ? (string) $summary['patientLabel'] : '',
        ]);
        $summary['milestones'] = $this->mergeMilestone($summary['milestones'] ?? [], 'bookedAt', $this->resolveOpenedAt($appointment));
        $case['summary'] = $summary;

        $status = $this->deriveAppointmentCaseStatus($appointment);
        $terminalAt = $this->resolveTerminalAt($appointment, $scheduledStart);
        $this->applyCaseStatus($case, $status, $terminalAt);
        $this->touchCase($case, $this->resolveOpenedAt($appointment));
    }

private function updateCaseFromTicket(array &$case, array $ticket, string $createdAt): void
    {
        $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
        $ticketId = (int) ($ticket['id'] ?? 0);
        if ($ticketId > 0) {
            $summary['latestTicketId'] = (string) $ticketId;
        }
        $summary['latestTicketCode'] = $this->firstNonEmptyString([
            (string) ($ticket['ticketCode'] ?? ''),
            isset($summary['latestTicketCode']) ? (string) $summary['latestTicketCode'] : '',
        ]);
        $summary['queueStatus'] = (string) ($ticket['status'] ?? 'waiting');
        $summary['assignedConsultorio'] = $ticket['assignedConsultorio'] ?? null;
        $summary['patientLabel'] = $this->firstNonEmptyString([
            isset($summary['patientLabel']) ? (string) $summary['patientLabel'] : '',
            (string) ($ticket['patientInitials'] ?? ''),
            (string) ($ticket['ticketCode'] ?? ''),
        ]);
        $summary['lastChannel'] = (string) ($ticket['createdSource'] ?? 'kiosk');
        $summary['milestones'] = $this->mergeMilestone($summary['milestones'] ?? [], 'arrivedAt', $createdAt);
        $summary['milestones'] = $this->mergeMilestone($summary['milestones'] ?? [], 'checkedInAt', $createdAt);
        $calledAt = trim((string) ($ticket['calledAt'] ?? ''));
        if ($calledAt !== '') {
            $summary['milestones'] = $this->mergeMilestone(
                $summary['milestones'] ?? [],
                'calledAt',
                $this->normalizeTimestampValue($calledAt, $createdAt)
            );
        }
        $completedAt = trim((string) ($ticket['completedAt'] ?? ''));
        if ($completedAt !== '') {
            $summary['milestones'] = $this->mergeMilestone(
                $summary['milestones'] ?? [],
                'completedAt',
                $this->normalizeTimestampValue($completedAt, $calledAt !== '' ? $calledAt : $createdAt)
            );
        }
        $case['summary'] = $summary;

        $this->applyCaseStatus($case, 'arrived', $createdAt);
        $ticketStatus = strtolower(trim((string) ($ticket['status'] ?? 'waiting')));
        $mappedStatus = 'checked_in';
        if ($ticketStatus === 'called') {
            $mappedStatus = 'called';
        } elseif ($ticketStatus === 'completed') {
            $mappedStatus = 'completed';
        } elseif ($ticketStatus === 'no_show') {
            $mappedStatus = 'no_show';
        } elseif ($ticketStatus === 'cancelled') {
            $mappedStatus = 'cancelled';
        }
        $terminalAt = $this->normalizeTimestampValue(
            (string) ($ticket['completedAt'] ?? ''),
            trim((string) ($ticket['calledAt'] ?? '')) !== ''
                ? (string) $ticket['calledAt']
                : $createdAt
        );
        $this->applyCaseStatus($case, $mappedStatus, $terminalAt);
        $this->touchCase($case, $terminalAt !== '' ? $terminalAt : $createdAt);
    }

private function touchCase(array &$case, string $timestamp): void
    {
        if ($timestamp === '') {
            return;
        }
        $current = (string) ($case['latestActivityAt'] ?? '');
        if ($current === '' || strcmp($current, $timestamp) < 0) {
            $case['latestActivityAt'] = $timestamp;
        }
    }

private function applyCaseStatus(array &$case, string $status, string $eventAt): void
    {
        $status = trim($status);
        if (!isset(self::STATUS_RANK[$status])) {
            return;
        }

        $currentStatus = (string) ($case['status'] ?? 'booked');
        $currentRank = self::STATUS_RANK[$currentStatus] ?? 0;
        $candidateRank = self::STATUS_RANK[$status];
        if ($candidateRank >= $currentRank) {
            $case['status'] = $status;
        }

        if (in_array($status, ['completed', 'no_show', 'cancelled'], true)) {
            $case['closedAt'] = $eventAt !== '' ? $eventAt : (string) ($case['closedAt'] ?? '');
        }
    }

private function resolveCaseJourneyStage(array $case): string
    {
        $explicitStage = trim((string) ($case['journeyStage'] ?? ''));
        if ($explicitStage !== '') {
            return $explicitStage;
        }

        $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
        $status = strtolower(trim((string) ($case['status'] ?? '')));
        if (in_array($status, ['lead_captured', 'intake_completed', 'scheduled', 'care_plan_ready', 'follow_up_active', 'resolved'], true)) {
            return $status;
        }
        if (in_array($status, ['completed', 'no_show', 'cancelled'], true)) {
            return 'resolved';
        }
        if (
            trim((string) ($summary['scheduledStart'] ?? '')) !== ''
            || trim((string) ($summary['latestAppointmentId'] ?? '')) !== ''
            || trim((string) ($summary['primaryAppointmentId'] ?? '')) !== ''
        ) {
            return 'scheduled';
        }

        return 'lead_captured';
    }

private function resolveJourneyStageLabel(string $stage): string
    {
        $normalized = strtolower(trim($stage));

        return [
            'lead_captured' => 'Lead captado',
            'intake_completed' => 'Preconsulta lista',
            'scheduled' => 'Consulta agendada',
            'care_plan_ready' => 'Plan de cuidado listo',
            'follow_up_active' => 'Seguimiento activo',
            'resolved' => 'Caso resuelto',
        ][$normalized] ?? 'Lead captado';
    }

}
