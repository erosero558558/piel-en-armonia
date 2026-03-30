<?php

declare(strict_types=1);

require_once __DIR__ . '/../common.php';
require_once __DIR__ . '/../validation.php';
require_once __DIR__ . '/../models.php';

final class TicketFactory
{
    public function createWalkInTicket(array $tickets, array $payload, string $createdSource, ?string $nowIso = null): array
    {
        $timestamp = $nowIso ?? local_date('c');
        $dailySeq = $this->nextDailySequence($tickets, $timestamp);
        $visitReason = normalize_queue_visit_reason(
            (string) ($payload['visitReason'] ?? ($payload['visit_reason'] ?? '')),
            'consulta_general'
        );

        return normalize_queue_ticket([
            'id' => $this->nextTicketId($tickets),
            'ticketCode' => $this->buildTicketCode($dailySeq),
            'dailySeq' => $dailySeq,
            'queueType' => 'walk_in',
            'appointmentId' => null,
            'patientInitials' => $this->resolveInitials($payload),
            'phoneLast4' => $this->extractPhoneLast4((string) ($payload['phone'] ?? ($payload['telefono'] ?? ''))),
            'priorityClass' => 'walk_in',
            'visitReason' => $visitReason,
            'visitReasonLabel' => queue_visit_reason_label($visitReason),
            'status' => 'waiting',
            'assignedConsultorio' => null,
            'createdAt' => $timestamp,
            'calledAt' => '',
            'completedAt' => '',
            'createdSource' => $this->normalizeCreatedSource($createdSource),
            'specialPriority' => $visitReason === 'urgencia',
        ]);
    }

    public function createAppointmentTicket(
        array $tickets,
        array $appointment,
        array $payload,
        string $createdSource,
        string $priorityClass,
        ?string $nowIso = null
    ): array {
        $timestamp = $nowIso ?? local_date('c');
        $dailySeq = $this->nextDailySequence($tickets, $timestamp);
        $initials = $this->resolveInitials([
            'patientInitials' => $payload['patientInitials'] ?? '',
            'name' => $appointment['name'] ?? '',
        ]);
        if ($initials === '') {
            $initials = 'PA';
        }

        return normalize_queue_ticket([
            'id' => $this->nextTicketId($tickets),
            'ticketCode' => $this->buildTicketCode($dailySeq),
            'dailySeq' => $dailySeq,
            'queueType' => 'appointment',
            'appointmentId' => (int) ($appointment['id'] ?? 0),
            'patientInitials' => $initials,
            'phoneLast4' => $this->extractPhoneLast4(
                (string) (
                    $payload['phone']
                    ?? ($payload['telefono'] ?? ($appointment['phone'] ?? ''))
                )
            ),
            'priorityClass' => $priorityClass,
            'visitReason' => '',
            'visitReasonLabel' => '',
            'status' => 'waiting',
            'assignedConsultorio' => null,
            'createdAt' => $timestamp,
            'calledAt' => '',
            'completedAt' => '',
            'createdSource' => $this->normalizeCreatedSource($createdSource),
        ]);
    }

    public function resolveInitials(array $payload): string
    {
        $rawInitials = trim((string) ($payload['patientInitials'] ?? ''));
        if ($rawInitials !== '') {
            $clean = strtoupper((string) preg_replace('/[^A-Za-z]/', '', $rawInitials));
            if ($clean !== '') {
                return substr($clean, 0, 4);
            }
        }

        $name = trim((string) ($payload['name'] ?? ($payload['patientName'] ?? '')));
        if ($name === '') {
            return '';
        }

        $parts = preg_split('/\s+/', strtoupper($name));
        if (!is_array($parts)) {
            return '';
        }

        $letters = '';
        foreach ($parts as $part) {
            $part = preg_replace('/[^A-Z]/', '', $part ?? '');
            if (!is_string($part) || $part === '') {
                continue;
            }
            $letters .= substr($part, 0, 1);
            if (strlen($letters) >= 3) {
                break;
            }
        }

        return substr($letters, 0, 4);
    }

    public function extractPhoneLast4(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', sanitize_phone($phone));
        if (!is_string($digits) || strlen($digits) < 4) {
            return '';
        }

        return substr($digits, -4);
    }

    public function normalizeCreatedSource(string $source): string
    {
        $source = strtolower(trim($source));
        return in_array($source, ['kiosk', 'admin'], true) ? $source : 'kiosk';
    }

    public function nextTicketId(array $tickets): int
    {
        $maxId = 0;
        foreach ($tickets as $ticket) {
            if (!is_array($ticket)) {
                continue;
            }
            $candidate = (int) ($ticket['id'] ?? 0);
            if ($candidate > $maxId) {
                $maxId = $candidate;
            }
        }

        $seed = (int) round(microtime(true) * 1000);
        return max($seed, $maxId + 1);
    }

    public function nextDailySequence(array $tickets, string $createdAt): int
    {
        $targetDate = $this->dateKeyFromIso($createdAt);
        $maxSeq = 0;
        foreach ($tickets as $ticket) {
            if (!is_array($ticket)) {
                continue;
            }
            $ticketDate = $this->dateKeyFromIso((string) ($ticket['createdAt'] ?? ''));
            if ($ticketDate !== $targetDate) {
                continue;
            }
            $seq = (int) ($ticket['dailySeq'] ?? 0);
            if ($seq > $maxSeq) {
                $maxSeq = $seq;
            }
        }

        return $maxSeq + 1;
    }

    public function buildTicketCode(int $dailySeq): string
    {
        $width = $dailySeq > 999 ? 4 : 3;
        return 'A-' . str_pad((string) $dailySeq, $width, '0', STR_PAD_LEFT);
    }

    private function dateKeyFromIso(string $iso): string
    {
        $ts = strtotime($iso);
        if ($ts === false) {
            return local_date('Y-m-d');
        }

        return date('Y-m-d', $ts);
    }
}
