<?php

declare(strict_types=1);

require_once __DIR__ . '/../models.php';

final class TicketPriorityPolicy
{
    public function refreshWaitingAppointmentPriorities(array $store): array
    {
        $updated = false;

        foreach ($store['queue_tickets'] as $idx => $ticket) {
            if (!is_array($ticket)) {
                continue;
            }

            $normalized = normalize_queue_ticket($ticket);
            $status = (string) ($normalized['status'] ?? 'waiting');
            $queueType = (string) ($normalized['queueType'] ?? 'walk_in');
            if ($status !== 'waiting' || $queueType !== 'appointment') {
                $store['queue_tickets'][$idx] = $normalized;
                continue;
            }

            $appointmentId = (int) ($normalized['appointmentId'] ?? 0);
            $appointment = $this->findAppointmentById($store['appointments'] ?? [], $appointmentId);
            if (!is_array($appointment)) {
                $store['queue_tickets'][$idx] = $normalized;
                continue;
            }

            $nextPriority = $this->resolveAppointmentPriority(
                (string) ($appointment['date'] ?? ''),
                (string) ($appointment['time'] ?? '')
            );
            if ((string) ($normalized['priorityClass'] ?? '') !== $nextPriority) {
                $normalized['priorityClass'] = $nextPriority;
                $updated = true;
            }
            $store['queue_tickets'][$idx] = normalize_queue_ticket($normalized);
        }

        if ($updated) {
            $store['updatedAt'] = local_date('c');
        }

        return $store;
    }

    public function resolveAppointmentPriority(string $appointmentDate, string $appointmentTime): string
    {
        $normalizedTime = $this->normalizeHour($appointmentTime);
        if ($normalizedTime === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $appointmentDate)) {
            return 'appt_current';
        }

        $appointmentTs = strtotime($appointmentDate . ' ' . $normalizedTime);
        if ($appointmentTs === false) {
            return 'appt_current';
        }

        return $appointmentTs <= (time() - 300) ? 'appt_overdue' : 'appt_current';
    }

    public function sortWaitingTickets(array $tickets): array
    {
        usort($tickets, fn (array $a, array $b): int => $this->compareWaitingTickets($a, $b));
        return array_values($tickets);
    }

    public function sortCalledTickets(array $tickets): array
    {
        usort($tickets, fn (array $a, array $b): int => $this->compareCalledTickets($a, $b));
        return array_values($tickets);
    }

    public function compareWaitingTickets(array $a, array $b): int
    {
        $priorityDiff = $this->priorityWeight((string) ($a['priorityClass'] ?? 'walk_in'))
            <=> $this->priorityWeight((string) ($b['priorityClass'] ?? 'walk_in'));
        if ($priorityDiff !== 0) {
            return $priorityDiff;
        }

        $timeDiff = $this->ticketTimestamp($a, 'createdAt') <=> $this->ticketTimestamp($b, 'createdAt');
        if ($timeDiff !== 0) {
            return $timeDiff;
        }

        return ((int) ($a['id'] ?? 0)) <=> ((int) ($b['id'] ?? 0));
    }

    public function compareCalledTickets(array $a, array $b): int
    {
        $timeDiff = $this->ticketTimestamp($b, 'calledAt') <=> $this->ticketTimestamp($a, 'calledAt');
        if ($timeDiff !== 0) {
            return $timeDiff;
        }

        return ((int) ($b['id'] ?? 0)) <=> ((int) ($a['id'] ?? 0));
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

    private function priorityWeight(string $priorityClass): int
    {
        switch ($priorityClass) {
            case 'appt_overdue':
                return 0;
            case 'appt_current':
                return 1;
            default:
                return 2;
        }
    }

    private function ticketTimestamp(array $ticket, string $field): int
    {
        $value = (string) ($ticket[$field] ?? '');
        $ts = strtotime($value);
        return $ts === false ? 0 : $ts;
    }

    private function findAppointmentById(array $appointments, int $appointmentId): ?array
    {
        if ($appointmentId <= 0) {
            return null;
        }

        foreach ($appointments as $appointment) {
            if (!is_array($appointment)) {
                continue;
            }
            if ((int) ($appointment['id'] ?? 0) === $appointmentId) {
                return $appointment;
            }
        }

        return null;
    }
}
