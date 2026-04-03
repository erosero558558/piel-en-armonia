<?php

declare(strict_types=1);

final class AppointmentRescheduleService
{
public static function checkReschedule(array $context): void
    {
        // GET /reschedule
        $store = $context['store'];
        $token = trim((string) ($_GET['token'] ?? ''));
        if ($token === '' || strlen($token) < 16) {
            json_response([
                'ok' => false,
                'error' => 'Token invalido',
                'code' => 'invalid_token'
            ], 400);
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

        $changes = (int) ($found['rescheduleCount'] ?? 0);
        if ($changes >= 2) {
             json_response(['ok' => false, 'error' => 'Has alcanzado el límite máximo de 2 reprogramaciones'], 403);
        }

        $now = time();
        $dateStr = (string) ($found['date'] ?? '');
        $timeStr = (string) ($found['time'] ?? '');
        $apptTime = strtotime($dateStr . ' ' . $timeStr);
        if ($dateStr !== '' && $timeStr !== '' && $apptTime !== false) {
            if (($apptTime - $now) < 86400) {
                 json_response(['ok' => false, 'error' => 'No puedes reprogramar con menos de 24 horas de anticipación'], 403);
            }
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
        require_rate_limit('reschedule', 5, 60);
        $payload = require_json_body();
        $token = trim((string) ($payload['token'] ?? ''));
        $newDate = trim((string) ($payload['date'] ?? ''));
        $newTime = trim((string) ($payload['time'] ?? ''));

        $bookingService = new BookingService();
        $runReschedule = static function () use ($bookingService, $token, $newDate, $newTime): array {
            $lockResult = with_store_lock(function () use ($bookingService, $token, $newDate, $newTime) {
                $freshStore = read_store();
                $rescheduleResult = $bookingService->reschedule($freshStore, $token, $newDate, $newTime);

                if (($rescheduleResult['ok'] ?? false) === true) {
                    if (!write_store($rescheduleResult['store'], false)) {
                        // Rollback: revert google calendar changes
                        $appointment = $rescheduleResult['data'] ?? [];
                        $previousCalendarState = null;
                        if (isset($rescheduleResult['meta']['previousCalendarState']) && is_array($rescheduleResult['meta']['previousCalendarState'])) {
                            $previousCalendarState = $rescheduleResult['meta']['previousCalendarState'];
                        }

                        $calendarBooking = CalendarBookingService::fromEnv();
                        if ($calendarBooking->isGoogleActive() && is_array($previousCalendarState)) {
                            $previousDate = trim((string) ($previousCalendarState['date'] ?? ''));
                            $previousTime = trim((string) ($previousCalendarState['time'] ?? ''));
                            $previousDoctor = trim((string) ($previousCalendarState['doctor'] ?? ($appointment['doctor'] ?? '')));
                            if (
                                preg_match('/^\d{4}-\d{2}-\d{2}$/', $previousDate) &&
                                preg_match('/^\d{2}:\d{2}$/', $previousTime)
                            ) {
                                $rollbackResult = $calendarBooking->patchCalendarEvent(
                                    $appointment,
                                    $previousDate,
                                    $previousTime,
                                    $previousDoctor !== '' ? $previousDoctor : null
                                );
                                if (($rollbackResult['ok'] ?? false) !== true) {
                                    audit_log_event('calendar.error', [
                                        'operation' => 'events_patch_rollback',
                                        'reason' => (string) ($rollbackResult['error'] ?? 'rollback_failed'),
                                        'appointmentId' => (int) ($appointment['id'] ?? 0),
                                    ]);
                                }
                            }
                        }
                        return [
                            'ok' => false,
                            'error' => 'No se pudo guardar la reprogramacion en este momento',
                            'code' => 503,
                            'errorCode' => 'reschedule_store_failed'
                        ];
                    }
                }
                return $rescheduleResult;
            });

            if (($lockResult['ok'] ?? false) !== true) {
                return [
                   'ok' => false,
                   'error' => (string) ($lockResult['error'] ?? 'Store lock failed'),
                   'code' => (int) ($lockResult['code'] ?? 503),
                ];
            }
            return is_array($lockResult['result']) ? $lockResult['result'] : ['ok' => false, 'code' => 500];
        };

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $newDate) && preg_match('/^\d{2}:\d{2}$/', $newTime)) {
            $lockResult = CalendarBookingService::withSlotLock($newDate, $newTime, $runReschedule);
            if (($lockResult['ok'] ?? false) !== true) {
                json_response([
                    'ok' => false,
                    'error' => (string) ($lockResult['error'] ?? 'No se pudo reprogramar en este momento'),
                    'code' => (string) ($lockResult['code'] ?? 'slot_lock_failed'),
                ], (int) ($lockResult['status'] ?? 409));
            }
            $result = is_array($lockResult['result'] ?? null) ? $lockResult['result'] : [
                'ok' => false,
                'error' => 'Respuesta invalida del proceso de reprogramacion',
                'code' => 500,
            ];
        } else {
            $result = $runReschedule();
        }

        if (!$result['ok']) {
            $statusCode = (int) ($result['code'] ?? 500);
            $errorCode = isset($result['errorCode']) ? trim((string) $result['errorCode']) : '';
            if ($errorCode === '') {
                $errorCode = AppointmentController::inferErrorCode($statusCode, (string) ($result['error'] ?? ''));
            }
            $errorCode = AppointmentController::normalizeConflictErrorCode($statusCode, $errorCode);
            $errorPayload = [
                'ok' => false,
                'error' => $result['error'],
                'code' => $errorCode,
            ];
            json_response($errorPayload, $statusCode);
        }

        $appointment = $result['data'];

        // Redundant checks removed
        if (!isset($appointment['slotDurationMin']) || (int) $appointment['slotDurationMin'] <= 0) {
            $calendarBooking = CalendarBookingService::fromEnv();
            $appointment['slotDurationMin'] = $calendarBooking->getDurationMin((string) ($appointment['service'] ?? 'consulta'));
        }

        $rescheduleEvent = AppointmentController::dispatchEventSafely('BookingRescheduled', $appointment);
        if ($rescheduleEvent === null) {
            maybe_send_reschedule_email($appointment);
        }

        json_response([
            'ok' => true,
            'data' => [
                'id' => $appointment['id'],
                'date' => $newDate,
                'time' => $newTime,
                'doctor' => $appointment['doctor'] ?? '',
                'doctorAssigned' => $appointment['doctorAssigned'] ?? '',
                'calendarProvider' => $appointment['calendarProvider'] ?? '',
                'calendarId' => $appointment['calendarId'] ?? '',
                'calendarEventId' => $appointment['calendarEventId'] ?? '',
                'slotDurationMin' => (int) ($appointment['slotDurationMin'] ?? 0),
            ]
        ]);
    }

}
