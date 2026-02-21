<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/BookingService.php';

class AppointmentController
{
    public static function index(array $context): void
    {
        // GET /appointments (Admin)
        $store = $context['store'];
        json_response([
            'ok' => true,
            'data' => $store['appointments']
        ]);
    }

    public static function bookedSlots(array $context): void
    {
        // GET /booked-slots
        $store = $context['store'];
        $date = isset($_GET['date']) ? (string) $_GET['date'] : '';
        if ($date === '') {
            json_response([
                'ok' => false,
                'error' => 'Fecha requerida'
            ], 400);
        }

        $doctor = isset($_GET['doctor']) ? trim((string) $_GET['doctor']) : '';

        $slots = [];
        foreach ($store['appointments'] as $appointment) {
            $status = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
            if ($status === 'cancelled') {
                continue;
            }
            if ((string) ($appointment['date'] ?? '') !== $date) {
                continue;
            }
            if ($doctor !== '' && $doctor !== 'indiferente') {
                $apptDoctor = (string) ($appointment['doctor'] ?? '');
                if ($apptDoctor !== '' && $apptDoctor !== 'indiferente' && $apptDoctor !== $doctor) {
                    continue;
                }
            }
            $time = (string) ($appointment['time'] ?? '');
            if ($time !== '') {
                $slots[] = $time;
            }
        }

        $slots = array_values(array_unique($slots));
        sort($slots);

        json_response([
            'ok' => true,
            'data' => $slots
        ]);
    }

    public static function store(array $context): void
    {
        // POST /appointments
        $store = $context['store'];
        require_rate_limit('appointments', 5, 60);
        $payload = require_json_body();

        $bookingService = new BookingService();
        $result = $bookingService->create($store, $payload);

        if (!$result['ok']) {
            json_response([
                'ok' => false,
                'error' => $result['error']
            ], $result['code']);
        }

        $newStore = $result['store'];
        $appointment = $result['data'];

        write_store($newStore);

        $event = new BookingCreated($appointment);
        get_event_dispatcher()->dispatch($event);
        $emailSent = $event->emailSent;

        json_response([
            'ok' => true,
            'data' => $appointment,
            'emailSent' => $emailSent
        ], 201);
    }

    public static function update(array $context): void
    {
        // PATCH /appointments (Admin)
        $store = $context['store'];
        $payload = require_json_body();
        $id = isset($payload['id']) ? (int) $payload['id'] : 0;
        if ($id <= 0) {
            json_response([
                'ok' => false,
                'error' => 'Identificador inválido'
            ], 400);
        }
        $found = false;
        foreach ($store['appointments'] as &$appt) {
            if ((int) ($appt['id'] ?? 0) !== $id) {
                continue;
            }
            $found = true;
            if (isset($payload['status'])) {
                $appt['status'] = map_appointment_status((string) $payload['status']);
            }
            if (isset($payload['paymentStatus'])) {
                $appt['paymentStatus'] = (string) $payload['paymentStatus'];
            }
            if (isset($payload['paymentMethod'])) {
                $appt['paymentMethod'] = (string) $payload['paymentMethod'];
            }
            if (isset($payload['paymentProvider'])) {
                $appt['paymentProvider'] = (string) $payload['paymentProvider'];
            }
            if (isset($payload['paymentIntentId'])) {
                $appt['paymentIntentId'] = (string) $payload['paymentIntentId'];
            }
            if (isset($payload['paymentPaidAt'])) {
                $appt['paymentPaidAt'] = (string) $payload['paymentPaidAt'];
            }
            if (isset($payload['transferReference'])) {
                $appt['transferReference'] = (string) $payload['transferReference'];
            }
            if (isset($payload['transferProofPath'])) {
                $appt['transferProofPath'] = (string) $payload['transferProofPath'];
            }
            if (isset($payload['transferProofUrl'])) {
                $appt['transferProofUrl'] = (string) $payload['transferProofUrl'];
            }
            if (isset($payload['transferProofName'])) {
                $appt['transferProofName'] = (string) $payload['transferProofName'];
            }
            if (isset($payload['transferProofMime'])) {
                $appt['transferProofMime'] = (string) $payload['transferProofMime'];
            }
        }
        unset($appt);
        if (!$found) {
            json_response([
                'ok' => false,
                'error' => 'Cita no encontrada'
            ], 404);
        }
        write_store($store);

        // Enviar email de cancelación al paciente si se canceló la cita
        if (isset($payload['status']) && map_appointment_status((string) $payload['status']) === 'cancelled') {
            foreach ($store['appointments'] as $apptNotify) {
                if ((int) ($apptNotify['id'] ?? 0) === $id) {
                    get_event_dispatcher()->dispatch(new BookingCancelled($apptNotify));
                    break;
                }
            }
        }

        json_response([
            'ok' => true
        ]);
    }

    public static function checkReschedule(array $context): void
    {
        // GET /reschedule
        $store = $context['store'];
        $token = trim((string) ($_GET['token'] ?? ''));
        if ($token === '' || strlen($token) < 16) {
            json_response(['ok' => false, 'error' => 'Token inválido'], 400);
        }

        $found = null;
        foreach ($store['appointments'] as $appt) {
            if (($appt['rescheduleToken'] ?? '') === $token && ($appt['status'] ?? '') !== 'cancelled') {
                $found = $appt;
                break;
            }
        }

        if (!$found) {
            json_response(['ok' => false, 'error' => 'Cita no encontrada o cancelada'], 404);
        }

        json_response([
            'ok' => true,
            'data' => [
                'id' => $found['id'],
                'service' => $found['service'] ?? '',
                'doctor' => $found['doctor'] ?? '',
                'date' => $found['date'] ?? '',
                'time' => $found['time'] ?? '',
                'name' => $found['name'] ?? '',
                'status' => $found['status'] ?? ''
            ]
        ]);
    }

    public static function processReschedule(array $context): void
    {
        // PATCH /reschedule
        $store = $context['store'];
        require_rate_limit('reschedule', 5, 60);
        $payload = require_json_body();
        $token = trim((string) ($payload['token'] ?? ''));
        $newDate = trim((string) ($payload['date'] ?? ''));
        $newTime = trim((string) ($payload['time'] ?? ''));

        $bookingService = new BookingService();
        $result = $bookingService->reschedule($store, $token, $newDate, $newTime);

        if (!$result['ok']) {
            json_response([
                'ok' => false,
                'error' => $result['error']
            ], $result['code']);
        }

        $newStore = $result['store'];
        $appointment = $result['data'];

        write_store($newStore);
        get_event_dispatcher()->dispatch(new BookingRescheduled($appointment));

        json_response([
            'ok' => true,
            'data' => [
                'id' => $appointment['id'],
                'date' => $newDate,
                'time' => $newTime
            ]
        ]);
    }
}
