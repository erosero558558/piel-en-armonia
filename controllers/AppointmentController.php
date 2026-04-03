<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/appointment/AppointmentIdempotencyService.php';
require_once __DIR__ . '/../lib/appointment/AppointmentRescheduleService.php';


require_once __DIR__ . '/../lib/BookingService.php';
require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';

final class AppointmentController
{
    public static function index(array $context): void
    {
        // GET /appointments (Admin)
        $store = $context['store'];
        $appointments = $store['appointments'] ?? [];
        
        $historyByPhone = [];
        foreach ($appointments as $appt) {
            $phone = (string)($appt['phone'] ?? '');
            if ($phone !== '') {
                $historyByPhone[$phone][] = $appt;
            }
        }
        
        if (class_exists('NoShowPredictor', false) || file_exists(__DIR__ . '/../lib/prediction.php')) {
            if (!class_exists('NoShowPredictor', false)) {
                require_once __DIR__ . '/../lib/prediction.php';
            }
            foreach ($appointments as &$appt) {
                $status = strtolower(trim((string)($appt['status'] ?? '')));
                if ($status !== 'cancelled' && $status !== 'no_show') {
                    $phone = (string)($appt['phone'] ?? '');
                    // For the history, roughly pass all appts for this phone
                    $history = $historyByPhone[$phone] ?? [];
                    // Prediction requires arrays: [score, risk_level, factors]
                    $appt['_noShowPrediction'] = NoShowPredictor::predict($appt, $history);
                }
            }
            unset($appt);
        }

        json_response([
            'ok' => true,
            'data' => $appointments
        ]);
    }

    public static function checkin(array $context): void
    {
        $payload = require_json_body();
        $token = trim((string) ($payload['token'] ?? ''));
        if ($token === '' || strlen($token) < 16) {
            json_response([
                'ok' => false,
                'error' => 'Token invalido',
                'code' => 'invalid_token'
            ], 400);
        }

        $lockResult = mutate_store(function (array $store) use ($token) {
            $found = false;
            $updatedAppointment = null;

            foreach ($store['appointments'] as &$appt) {
                if (($appt['rescheduleToken'] ?? '') === $token) {
                    if (($appt['status'] ?? '') === 'cancelled') {
                        return ['ok' => false, 'error' => 'Cita cancelada', 'code' => 404];
                    }
                    if (($appt['status'] ?? '') === 'checked_in') {
                        return ['ok' => true, 'updated' => $appt];
                    }
                    $appt['status'] = 'checked_in';
                    $appt['checked_in_at'] = date('c');
                    $found = true;
                    $updatedAppointment = $appt;
                    break;
                }
            }
            unset($appt);

            if (!$found) {
                return ['ok' => false, 'error' => 'Cita no encontrada', 'code' => 404];
            }

            return ['ok' => true, 'updated' => $updatedAppointment, 'store' => $store, 'storeDirty' => true];
        });

        if (($lockResult['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($lockResult['error'] ?? 'Store lock failed')
            ], (int) ($lockResult['code'] ?? 503));
        }

        $result = $lockResult['result'];
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'Error desconocido')
            ], (int) ($result['code'] ?? 500));
        }

        json_response([
            'ok' => true,
            'data' => [
                'id' => $result['updated']['id'],
                'status' => $result['updated']['status'],
                'checked_in_at' => $result['updated']['checked_in_at']
            ]
        ]);
    }

    public static function bookedSlots(array $context): void
    {
        // GET /booked-slots
        $store = $context['store'];
        $date = trim((string) ($_GET['date'] ?? ''));
        if ($date === '') {
            json_response([
                'ok' => false,
                'error' => 'Fecha requerida',
                'code' => 'calendar_bad_request',
            ], 400);
        }
        if (!validate_date_format($date)) {
            json_response([
                'ok' => false,
                'error' => 'Fecha invalida. Usa formato YYYY-MM-DD',
                'code' => 'calendar_bad_request',
            ], 400);
        }

        $doctor = strtolower(trim((string) ($_GET['doctor'] ?? 'indiferente')));
        if ($doctor === '') {
            $doctor = 'indiferente';
        }
        if (!in_array($doctor, get_valid_booking_doctor_values(), true)) {
            json_response([
                'ok' => false,
                'error' => 'Doctor invalido. Valores permitidos: ' . implode(', ', get_valid_booking_doctor_values()),
                'code' => 'calendar_bad_request',
            ], 400);
        }

        $service = strtolower(trim((string) ($_GET['service'] ?? 'consulta')));
        if ($service === '') {
            $service = 'consulta';
        }
        if (!in_array($service, self::ALLOWED_SERVICES, true)) {
            json_response([
                'ok' => false,
                'error' => 'Servicio invalido para horarios ocupados',
                'code' => 'calendar_bad_request',
            ], 400);
        }

        $availabilityService = CalendarAvailabilityService::fromEnv();
        $result = $availabilityService->getBookedSlots($store, $date, $doctor, $service);
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo consultar horarios ocupados'),
                'code' => (string) ($result['code'] ?? 'booked_slots_error'),
                'meta' => isset($result['meta']) && is_array($result['meta']) ? $result['meta'] : [],
            ], (int) ($result['status'] ?? 503));
        }

        json_response([
            'ok' => true,
            'data' => array_values(array_unique(is_array($result['data'] ?? null) ? $result['data'] : [])),
            'meta' => isset($result['meta']) && is_array($result['meta']) ? $result['meta'] : [],
        ]);
    }

    public static function store(array $context): void
    {
        // POST /appointments
        // Ignoring $context['store'] to use fresh read inside lock
        require_rate_limit('appointments', 5, 60);
        $payload = require_json_body();
        $idempotencyKey = self::resolveIdempotencyKey($payload);
        if ($idempotencyKey !== '') {
            $payload['idempotencyKey'] = $idempotencyKey;
            $payload['idempotencyFingerprint'] = self::buildIdempotencyFingerprint($payload);
        }
        $bookingService = new BookingService();

        $normalized = normalize_appointment($payload);
        if (TelemedicineChannelMapper::isTelemedicineService((string) ($normalized['service'] ?? ''))) {
            self::requireClinicalStorageReady(
                'appointment_store',
                [
                    'data' => null,
                    'emailSent' => false,
                    'idempotentReplay' => false,
                ],
                'La reserva de telemedicina sigue bloqueada hasta habilitar almacenamiento clinico cifrado.'
            );
        }
        $lockDate = (string) ($normalized['date'] ?? '');
        $lockTime = (string) ($normalized['time'] ?? '');

        $runCreate = static function () use ($bookingService, $payload, $idempotencyKey): array {
            $lockResult = with_store_lock(function () use ($bookingService, $payload, $idempotencyKey) {
                $freshStore = read_store();
                if ($idempotencyKey !== '') {
                    $existing = self::findAppointmentByIdempotencyKey($freshStore, $idempotencyKey);
                    if (is_array($existing)) {
                        $incomingFingerprint = strtolower(trim((string) ($payload['idempotencyFingerprint'] ?? '')));
                        $storedFingerprint = strtolower(trim((string) ($existing['idempotencyFingerprint'] ?? '')));
                        if (
                            $incomingFingerprint !== '' &&
                            $storedFingerprint !== '' &&
                            !hash_equals($storedFingerprint, $incomingFingerprint)
                        ) {
                            self::emitIdempotencyObservability('conflict', $idempotencyKey, $incomingFingerprint, $existing);
                            return [
                                'ok' => false,
                                'error' => 'La clave de idempotencia ya fue usada con otra reserva',
                                'code' => 409,
                                'errorCode' => 'idempotency_conflict',
                            ];
                        }

                        self::emitIdempotencyObservability('replay', $idempotencyKey, $incomingFingerprint, $existing);
                        return [
                            'ok' => true,
                            'store' => $freshStore,
                            'data' => $existing,
                            'code' => 200,
                            'idempotentReplay' => true,
                        ];
                    }
                }

                $createResult = $bookingService->create($freshStore, $payload);

                if (($createResult['ok'] ?? false) === true) {
                    if (!write_store($createResult['store'], false)) {
                        // Rollback: cancel calendar event if created
                        $appointment = $createResult['data'] ?? [];
                        if (!empty($appointment['calendarId']) && !empty($appointment['calendarEventId'])) {
                            $calendarBooking = CalendarBookingService::fromEnv();
                            if ($calendarBooking->isGoogleActive()) {
                                $cancelResult = $calendarBooking->cancelCalendarEvent($appointment);
                                if (($cancelResult['ok'] ?? false) !== true) {
                                    audit_log_event('calendar.error', [
                                        'operation' => 'events_delete_compensation',
                                        'reason' => (string) ($cancelResult['error'] ?? 'compensation_failed'),
                                        'appointmentId' => (int) ($appointment['id'] ?? 0),
                                    ]);
                                }
                            }
                        }
                        return [
                            'ok' => false,
                            'error' => 'No se pudo confirmar la reserva en este momento (storage)',
                            'code' => 503,
                            'errorCode' => 'booking_store_failed'
                        ];
                    }
                }
                return $createResult;
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

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $lockDate) && preg_match('/^\d{2}:\d{2}$/', $lockTime)) {
            $lockResult = CalendarBookingService::withSlotLock($lockDate, $lockTime, $runCreate);
            if (($lockResult['ok'] ?? false) !== true) {
                json_response([
                    'ok' => false,
                    'error' => (string) ($lockResult['error'] ?? 'No se pudo reservar ese horario en este momento'),
                    'code' => (string) ($lockResult['code'] ?? 'slot_lock_failed'),
                ], (int) ($lockResult['status'] ?? 409));
            }
            $result = is_array($lockResult['result'] ?? null) ? $lockResult['result'] : [
                'ok' => false,
                'error' => 'Respuesta invalida del proceso de reserva',
                'code' => 500,
            ];
        } else {
            $result = $runCreate();
        }

        if (!$result['ok']) {
            $statusCode = (int) ($result['code'] ?? 500);
            $errorCode = isset($result['errorCode']) ? trim((string) $result['errorCode']) : '';
            if ($errorCode === '') {
                $errorCode = self::inferErrorCode($statusCode, (string) ($result['error'] ?? ''));
            }
            $errorCode = self::normalizeConflictErrorCode($statusCode, $errorCode);
            $errorPayload = [
                'ok' => false,
                'error' => $result['error'],
                'code' => $errorCode,
            ];
            json_response($errorPayload, $statusCode);
        }

        $appointment = $result['data'];
        $idempotentReplay = (bool) ($result['idempotentReplay'] ?? false);

        // Redundant checks removed as BookingService handles them now
        // But keeping slotDurationMin just in case
        if (!isset($appointment['slotDurationMin']) || (int) $appointment['slotDurationMin'] <= 0) {
            $calendarBooking = CalendarBookingService::fromEnv();
            $appointment['slotDurationMin'] = $calendarBooking->getDurationMin((string) ($appointment['service'] ?? 'consulta'));
        }
        if ($idempotencyKey !== '' && !$idempotentReplay) {
            $fingerprint = trim((string) ($appointment['idempotencyFingerprint'] ?? ''));
            self::emitIdempotencyObservability('new', $idempotencyKey, $fingerprint, $appointment);
        }

        $emailSent = false;
        $createdEvent = self::dispatchEventSafely('BookingCreated', $appointment);
        if (is_object($createdEvent) && isset($createdEvent->emailSent)) {
            $emailSent = (bool) $createdEvent->emailSent;
        } else {
            $emailSent = maybe_send_appointment_email($appointment);
            maybe_send_admin_notification($appointment);
        }

        // WhatsApp confirmation enqueueing (S13-20)
        require_once __DIR__ . '/../lib/WhatsAppService.php';
        WhatsAppService::sendConfirmation($appointment);

        json_response([
            'ok' => true,
            'data' => $appointment,
            'emailSent' => $emailSent,
            'idempotentReplay' => $idempotentReplay,
        ], $idempotentReplay ? 200 : 201);
    }

    public static function update(array $context): void
    {
        // PATCH /appointments (Admin)
        $payload = require_json_body();
        $id = isset($payload['id']) ? (int) $payload['id'] : 0;
        if ($id <= 0) {
            json_response([
                'ok' => false,
                'error' => 'Identificador inválido'
            ], 400);
        }

        $lockResult = with_store_lock(function () use ($id, $payload) {
            $store = read_store();
            $patientCaseService = new PatientCaseService();
            $shouldHydratePatientFlow = !function_exists('internal_console_clinical_data_ready')
                || internal_console_clinical_data_ready();
            $found = false;
            $cancelledAppointment = null;
            $updatedAppointment = null;

            foreach ($store['appointments'] as &$appt) {
                if ((int) ($appt['id'] ?? 0) !== $id) {
                    continue;
                }
                $found = true;
                if (isset($payload['status'])) {
                    $appt['status'] = map_appointment_status((string) $payload['status']);
                    if ($appt['status'] === 'cancelled') {
                        $cancelledAppointment = $appt;
                    }
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
                $updatedAppointment = $appt;
            }
            unset($appt);

            if (!$found) {
                return ['ok' => false, 'error' => 'Cita no encontrada', 'code' => 404];
            }

            if ($shouldHydratePatientFlow) {
                $store = $patientCaseService->hydrateStore($store);
                $updatedAppointment = self::findAppointmentById($store, $id) ?? $updatedAppointment;
                if (
                    is_array($updatedAppointment) &&
                    map_appointment_status((string) ($updatedAppointment['status'] ?? 'confirmed')) === 'cancelled'
                ) {
                    $cancelledAppointment = $updatedAppointment;
                }
            }

            if (!write_store($store)) {
                return ['ok' => false, 'error' => 'Storage write failed', 'code' => 503];
            }

            return [
                'ok' => true,
                'cancelled' => $cancelledAppointment,
                'updated' => $updatedAppointment
            ];
        });

        if (($lockResult['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($lockResult['error'] ?? 'Store lock failed')
            ], (int) ($lockResult['code'] ?? 503));
        }

        $result = $lockResult['result'];
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'Error desconocido')
            ], (int) ($result['code'] ?? 500));
        }

        $cancelledAppointment = $result['cancelled'];
        if (is_array($cancelledAppointment)) {
            $calendarBooking = CalendarBookingService::fromEnv();
            if ($calendarBooking->isGoogleActive()) {
                $cancelResult = $calendarBooking->cancelCalendarEvent($cancelledAppointment);
                if (($cancelResult['ok'] ?? false) !== true) {
                    audit_log_event('calendar.error', [
                        'operation' => 'events_delete',
                        'reason' => (string) ($cancelResult['error'] ?? 'cancel_failed'),
                        'appointmentId' => $id,
                    ]);
                }
            }
        }

        // Enviar email de cancelación al paciente si se canceló la cita
        if (isset($payload['status']) && map_appointment_status((string) $payload['status']) === 'cancelled' && isset($result['updated'])) {
            $cancelEvent = self::dispatchEventSafely('BookingCancelled', (array) $result['updated']);
            if ($cancelEvent === null) {
                maybe_send_cancellation_email((array) $result['updated']);
            }
        }

        json_response([
            'ok' => true
        ]);
    }

    public static function checkReschedule(...$args)
    {
        return AppointmentRescheduleService::checkReschedule(...$args);
    }

    public static function processReschedule(...$args)
    {
        return AppointmentRescheduleService::processReschedule(...$args);
    }

    public static function dispatchEventSafely(string $eventClass, array $appointment): ?object
    {
        if (!class_exists($eventClass) || !function_exists('get_event_dispatcher')) {
            return null;
        }

        try {
            $dispatcher = get_event_dispatcher();
            if (!is_object($dispatcher) || !method_exists($dispatcher, 'dispatch')) {
                return null;
            }

            $event = new $eventClass($appointment);
            $dispatcher->dispatch($event);
            return is_object($event) ? $event : null;
        } catch (Throwable $e) {
            error_log('Aurora Derm: event dispatch fallback - ' . $e->getMessage());
            return null;
        }
    }

    public static function resolveIdempotencyKey(...$args)
    {
        return AppointmentIdempotencyService::resolveIdempotencyKey(...$args);
    }

    public static function normalizeIdempotencyKey(...$args)
    {
        return AppointmentIdempotencyService::normalizeIdempotencyKey(...$args);
    }

    public static function buildIdempotencyFingerprint(...$args)
    {
        return AppointmentIdempotencyService::buildIdempotencyFingerprint(...$args);
    }

    public static function findAppointmentByIdempotencyKey(...$args)
    {
        return AppointmentIdempotencyService::findAppointmentByIdempotencyKey(...$args);
    }

    public static function emitIdempotencyObservability(...$args)
    {
        return AppointmentIdempotencyService::emitIdempotencyObservability(...$args);
    }

    public static function requireClinicalStorageReady(string $surface, array $data = [], string $error = ''): void
    {
        $readiness = internal_console_readiness_snapshot();
        if (internal_console_clinical_data_ready($readiness)) {
            return;
        }

        $payload = internal_console_clinical_guard_payload([
            'surface' => $surface,
            'data' => $data,
        ]);
        if ($error !== '') {
            $payload['error'] = $error;
        }

        json_response($payload, 409);
    }

    public static function inferErrorCode(int $statusCode, string $errorMessage): string
    {
        $message = strtolower(trim($errorMessage));
        if ($statusCode === 400) {
            if (strpos($message, 'token') !== false) {
                return 'invalid_token';
            }
            return 'bad_request';
        }
        if ($statusCode === 404) {
            return 'not_found';
        }
        if ($statusCode === 409) {
            return 'slot_conflict';
        }
        if ($statusCode === 429) {
            return 'rate_limited';
        }
        if ($statusCode === 503) {
            return 'service_unavailable';
        }
        return 'internal_error';
    }

    public static function normalizeConflictErrorCode(int $statusCode, string $errorCode): string
    {
        if ($statusCode !== 409) {
            return $errorCode;
        }

        $normalized = strtolower(trim($errorCode));
        if ($normalized === '' || in_array($normalized, ['slot_unavailable', 'slot_locked', 'slot_lock_failed'], true)) {
            return 'slot_conflict';
        }
        return $normalized;
    }

    public static function findAppointmentById(array $store, int $appointmentId): ?array
    {
        if ($appointmentId <= 0) {
            return null;
        }

        $appointments = isset($store['appointments']) && is_array($store['appointments'])
            ? $store['appointments']
            : [];
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

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:appointments':
                self::index($context);
                return;
            case 'POST:appointments':
                self::store($context);
                return;
            case 'PATCH:appointments':
                self::update($context);
                return;
            case 'PUT:appointments':
                self::update($context);
                return;
            case 'POST:appointment-checkin':
                self::checkin($context);
                return;
            case 'GET:booked-slots':
                self::bookedSlots($context);
                return;
            case 'GET:reschedule':
                self::checkReschedule($context);
                return;
            case 'PATCH:reschedule':
                self::processReschedule($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'index':
                            self::index($context);
                            return;
                        case 'store':
                            self::store($context);
                            return;
                        case 'update':
                            self::update($context);
                            return;
                        case 'checkin':
                            self::checkin($context);
                            return;
                        case 'bookedSlots':
                            self::bookedSlots($context);
                            return;
                        case 'checkReschedule':
                            self::checkReschedule($context);
                            return;
                        case 'processReschedule':
                            self::processReschedule($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
