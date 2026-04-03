<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/payment/StripeWebhookService.php';
require_once __DIR__ . '/../lib/payment/WhatsappCheckoutService.php';
require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/CheckoutOrderService.php';
require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';
require_once __DIR__ . '/../lib/ClinicProfileStore.php';
require_once __DIR__ . '/../lib/SoftwareSubscriptionService.php';
require_once __DIR__ . '/../lib/telemedicine/TelemedicineChannelMapper.php';
$legacyTelemedicineBridgeFile = __DIR__ . '/../lib/telemedicine/LegacyTelemedicineBridge.php';
if (is_file($legacyTelemedicineBridgeFile) && !class_exists('LegacyTelemedicineBridge', false)) {
    try {
        @require_once $legacyTelemedicineBridgeFile;
    } catch (Throwable $legacyTelemedicineBootstrapError) {
        error_log('Aurora Derm Payment bootstrap: LegacyTelemedicineBridge skipped - ' . $legacyTelemedicineBootstrapError->getMessage());
    }
}
require_once __DIR__ . '/../lib/telemedicine/ClinicalMediaService.php';
$whatsappOpenclawBootstrap = __DIR__ . '/../lib/whatsapp_openclaw/bootstrap.php';
if (is_file($whatsappOpenclawBootstrap)) {
    require_once $whatsappOpenclawBootstrap;
}

final class PaymentController
{
    public static function config(array $context): void
    {
        json_response([
            'ok' => true,
            'provider' => 'stripe',
            'enabled' => payment_gateway_enabled(),
            'publishableKey' => payment_stripe_publishable_key(),
            'currency' => payment_currency()
        ]);
    }

    public static function checkoutConfig(array $context): void
    {
        json_response([
            'ok' => true,
            'data' => CheckoutOrderService::publicConfig(),
        ]);
    }

    public static function checkoutIntent(array $context): void
    {
        if (!payment_gateway_enabled()) {
            json_response([
                'ok' => false,
                'error' => 'Pasarela de pago no configurada'
            ], 503);
        }

        $payload = require_json_body();
        try {
            $request = CheckoutOrderService::buildCardIntentRequest($payload);
            $intent = stripe_create_custom_payment_intent(
                $request['stripePayload'],
                (string) $request['idempotencyKey']
            );
            $order = CheckoutOrderService::attachCardIntent(
                $request['order'],
                $intent
            );
        } catch (InvalidArgumentException $error) {
            json_response([
                'ok' => false,
                'error' => $error->getMessage(),
            ], 400);
        } catch (RuntimeException $error) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo iniciar el checkout con tarjeta'
            ], 502);
        }

        $persisted = with_store_lock(static function () use ($order): array {
            $store = read_store();
            $store = CheckoutOrderService::upsertOrder($store, $order);
            if (!write_store($store, false)) {
                return [
                    'ok' => false,
                    'error' => 'No se pudo guardar el checkout',
                    'code' => 503,
                ];
            }

            return [
                'ok' => true,
                'order' => $order,
            ];
        });

        if (($persisted['ok'] ?? false) !== true || !is_array($persisted['result'] ?? null) || (($persisted['result']['ok'] ?? false) !== true)) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo guardar el checkout',
            ], 503);
        }

        json_response([
            'ok' => true,
            'data' => [
                'order' => $order,
                'receipt' => CheckoutOrderService::buildReceipt($order),
                'clientSecret' => (string) ($intent['client_secret'] ?? ''),
                'paymentIntentId' => (string) ($intent['id'] ?? ''),
                'amount' => (int) ($intent['amount'] ?? 0),
                'currency' => strtoupper((string) ($intent['currency'] ?? payment_currency())),
                'publishableKey' => payment_stripe_publishable_key(),
            ],
        ], 201);
    }

    public static function checkoutConfirm(array $context): void
    {
        $payload = require_json_body();
        $orderId = trim((string) ($payload['orderId'] ?? ''));
        $paymentIntentId = trim((string) ($payload['paymentIntentId'] ?? ''));

        if ($orderId === '' || $paymentIntentId === '') {
            json_response([
                'ok' => false,
                'error' => 'orderId y paymentIntentId son obligatorios'
            ], 400);
        }

        if (!payment_gateway_enabled()) {
            json_response([
                'ok' => false,
                'error' => 'Pasarela de pago no configurada'
            ], 503);
        }

        try {
            $intent = stripe_get_payment_intent($paymentIntentId);
        } catch (RuntimeException $error) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo verificar el pago en este momento'
            ], 502);
        }

        $persisted = with_store_lock(static function () use ($orderId, $intent): array {
            $store = read_store();
            $order = CheckoutOrderService::findOrder($store, $orderId);
            if (!$order) {
                return [
                    'ok' => false,
                    'error' => 'No encontramos ese checkout digital.',
                    'code' => 404,
                ];
            }

            if ((string) ($order['paymentStatus'] ?? '') === 'paid') {
                return [
                    'ok' => true,
                    'order' => $order,
                ];
            }

            try {
                $order = CheckoutOrderService::confirmPaidCardOrder($order, $intent);
            } catch (InvalidArgumentException $error) {
                return [
                    'ok' => false,
                    'error' => $error->getMessage(),
                    'code' => 400,
                ];
            }

            $store = CheckoutOrderService::upsertOrder($store, $order);
            if (!write_store($store, false)) {
                return [
                    'ok' => false,
                    'error' => 'No se pudo guardar la confirmacion del pago',
                    'code' => 503,
                ];
            }

            return [
                'ok' => true,
                'order' => $order,
            ];
        });

        if (($persisted['ok'] ?? false) !== true || !is_array($persisted['result'] ?? null)) {
            json_response([
                'ok' => false,
                'error' => (string) ($persisted['error'] ?? 'No se pudo guardar la confirmacion del pago'),
            ], (int) ($persisted['code'] ?? 503));
        }

        $result = $persisted['result'];
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo guardar la confirmacion del pago'),
            ], (int) ($result['code'] ?? 400));
        }

        $order = $result['order'];
        json_response([
            'ok' => true,
            'data' => [
                'order' => $order,
                'receipt' => CheckoutOrderService::buildReceipt($order),
            ],
        ]);
    }

    public static function checkoutSubmit(array $context): void
    {
        $payload = require_json_body();
        $method = strtolower(trim((string) ($payload['paymentMethod'] ?? '')));

        if (!in_array($method, ['transfer', 'cash'], true)) {
            json_response([
                'ok' => false,
                'error' => 'Debe elegir transferencia o efectivo para este flujo.'
            ], 400);
        }

        try {
            $order = CheckoutOrderService::buildOfflineMethodOrder($payload, $method);
        } catch (InvalidArgumentException $error) {
            json_response([
                'ok' => false,
                'error' => $error->getMessage(),
            ], 400);
        }

        $persisted = with_store_lock(static function () use ($order): array {
            $store = read_store();
            $store = CheckoutOrderService::upsertOrder($store, $order);
            if (!write_store($store, false)) {
                return [
                    'ok' => false,
                    'error' => 'No se pudo guardar el checkout',
                    'code' => 503,
                ];
            }

            return [
                'ok' => true,
                'order' => $order,
            ];
        });

        if (($persisted['ok'] ?? false) !== true || !is_array($persisted['result'] ?? null) || (($persisted['result']['ok'] ?? false) !== true)) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo guardar el checkout',
            ], 503);
        }

        json_response([
            'ok' => true,
            'data' => [
                'order' => $order,
                'receipt' => CheckoutOrderService::buildReceipt($order),
            ],
        ], 201);
    }

    public static function checkoutTransferProof(array $context): void
    {
        $orderId = trim((string) ($_POST['orderId'] ?? ''));
        if ($orderId === '') {
            json_response([
                'ok' => false,
                'error' => 'orderId es obligatorio'
            ], 400);
        }

        if (!isset($_FILES['proof']) || !is_array($_FILES['proof'])) {
            json_response([
                'ok' => false,
                'error' => 'Debes adjuntar la foto del comprobante.'
            ], 400);
        }

        try {
            $upload = save_transfer_proof_upload($_FILES['proof']);
        } catch (RuntimeException $error) {
            json_response([
                'ok' => false,
                'error' => $error->getMessage(),
            ], 400);
        }

        $persisted = with_store_lock(static function () use ($orderId, $upload): array {
            $store = read_store();
            $order = CheckoutOrderService::findOrder($store, $orderId);
            if (!$order) {
                return [
                    'ok' => false,
                    'error' => 'No encontramos ese checkout digital.',
                    'code' => 404,
                ];
            }

            try {
                $order = CheckoutOrderService::attachTransferProof($order, $upload, [
                    'transferReference' => trim((string) ($_POST['transferReference'] ?? '')),
                ]);
            } catch (InvalidArgumentException $error) {
                return [
                    'ok' => false,
                    'error' => $error->getMessage(),
                    'code' => 400,
                ];
            }

            $store = CheckoutOrderService::upsertOrder($store, $order);
            if (!write_store($store, false)) {
                return [
                    'ok' => false,
                    'error' => 'No se pudo guardar el comprobante',
                    'code' => 503,
                ];
            }

            return [
                'ok' => true,
                'order' => $order,
            ];
        });

        if (($persisted['ok'] ?? false) !== true || !is_array($persisted['result'] ?? null)) {
            $diskPath = trim((string) ($upload['diskPath'] ?? ''));
            if ($diskPath !== '' && is_file($diskPath)) {
                @unlink($diskPath);
            }
            json_response([
                'ok' => false,
                'error' => (string) ($persisted['error'] ?? 'No se pudo guardar el comprobante'),
            ], (int) ($persisted['code'] ?? 503));
        }

        $result = $persisted['result'];
        if (($result['ok'] ?? false) !== true) {
            $diskPath = trim((string) ($upload['diskPath'] ?? ''));
            if ($diskPath !== '' && is_file($diskPath)) {
                @unlink($diskPath);
            }
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo guardar el comprobante'),
            ], (int) ($result['code'] ?? 400));
        }

        $order = $result['order'];
        json_response([
            'ok' => true,
            'data' => [
                'order' => $order,
                'receipt' => CheckoutOrderService::buildReceipt($order),
            ],
        ], 201);
    }

    public static function checkoutOrderReview(array $context): void
    {
        $payload = require_json_body();
        $orderId = trim((string) ($payload['id'] ?? $payload['orderId'] ?? ''));
        $action = strtolower(trim((string) ($payload['action'] ?? '')));

        if ($orderId === '') {
            json_response([
                'ok' => false,
                'error' => 'id es obligatorio'
            ], 400);
        }
        if (!in_array($action, ['verify', 'apply'], true)) {
            json_response([
                'ok' => false,
                'error' => 'Accion no soportada para la revision de transferencias.'
            ], 400);
        }

        $persisted = with_store_lock(static function () use ($orderId, $action): array {
            $store = read_store();
            $order = CheckoutOrderService::findOrder($store, $orderId);
            if (!$order) {
                return [
                    'ok' => false,
                    'error' => 'No encontramos ese checkout digital.',
                    'code' => 404,
                ];
            }

            try {
                $order = $action === 'verify'
                    ? CheckoutOrderService::verifyTransfer($order)
                    : CheckoutOrderService::applyTransfer($order);
            } catch (InvalidArgumentException $error) {
                return [
                    'ok' => false,
                    'error' => $error->getMessage(),
                    'code' => 400,
                ];
            }

            $store = CheckoutOrderService::upsertOrder($store, $order);
            if (!write_store($store, false)) {
                return [
                    'ok' => false,
                    'error' => 'No se pudo actualizar la transferencia',
                    'code' => 503,
                ];
            }

            return [
                'ok' => true,
                'order' => $order,
            ];
        });

        if (($persisted['ok'] ?? false) !== true || !is_array($persisted['result'] ?? null)) {
            json_response([
                'ok' => false,
                'error' => (string) ($persisted['error'] ?? 'No se pudo actualizar la transferencia'),
            ], (int) ($persisted['code'] ?? 503));
        }

        $result = $persisted['result'];
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo actualizar la transferencia'),
            ], (int) ($result['code'] ?? 400));
        }

        $order = $result['order'];
        json_response([
            'ok' => true,
            'data' => [
                'order' => $order,
                'receipt' => CheckoutOrderService::buildReceipt($order),
            ],
        ]);
    }

    public static function softwareSubscriptionCheckout(array $params): void
    {
        SoftwareSubscriptionService::softwareSubscriptionCheckout($params);
    }

    public static function createIntent(array $context): void
    {
        $store = $context['store'];
        require_rate_limit('payment-intent', 8, 60);

        if (!payment_gateway_enabled()) {
            json_response([
                'ok' => false,
                'error' => 'Pasarela de pago no configurada'
            ], 503);
        }

        $payload = require_json_body();
        $appointment = normalize_appointment($payload);
        $service = strtolower(trim((string) ($appointment['service'] ?? '')));
        if ($service === '' || get_service_config($service) === null) {
            json_response([
                'ok' => false,
                'error' => 'Servicio invalido para iniciar el pago'
            ], 400);
        }
        $appointment['service'] = $service;

        if ($appointment['service'] === '' || $appointment['name'] === '' || $appointment['email'] === '') {
            json_response([
                'ok' => false,
                'error' => 'Datos incompletos para iniciar el pago'
            ], 400);
        }

        if (!validate_email($appointment['email'])) {
            json_response([
                'ok' => false,
                'error' => 'El formato del email no es valido'
            ], 400);
        }

        if (!validate_phone($appointment['phone'])) {
            json_response([
                'ok' => false,
                'error' => 'El formato del telefono no es valido'
            ], 400);
        }

        if (!isset($appointment['privacyConsent']) || $appointment['privacyConsent'] !== true) {
            json_response([
                'ok' => false,
                'error' => 'Debes aceptar el tratamiento de datos para reservar la cita'
            ], 400);
        }

        if ($appointment['date'] === '' || $appointment['time'] === '') {
            json_response([
                'ok' => false,
                'error' => 'Fecha y hora son obligatorias'
            ], 400);
        }

        if ($appointment['date'] < local_date('Y-m-d')) {
            json_response([
                'ok' => false,
                'error' => 'No se puede agendar en una fecha pasada'
            ], 400);
        }

        $calendarBooking = CalendarBookingService::fromEnv();
        $requestedDoctor = strtolower(trim((string) ($appointment['doctor'] ?? '')));
        if ($requestedDoctor === '') {
            $requestedDoctor = 'indiferente';
            $appointment['doctor'] = 'indiferente';
        }
        if (!in_array($requestedDoctor, ['rosero', 'narvaez', 'indiferente'], true)) {
            json_response([
                'ok' => false,
                'error' => 'Doctor invalido'
            ], 400);
        }

        if (TelemedicineChannelMapper::isTelemedicineService($appointment['service'])) {
            self::requireClinicalStorageReady(
                'payment_intent',
                [
                    'clientSecret' => '',
                    'paymentIntentId' => '',
                    'amount' => payment_expected_amount_cents(
                        $appointment['service'],
                        $appointment['date'] ?? null,
                        $appointment['time'] ?? null
                    ),
                    'currency' => strtoupper(payment_currency()),
                    'publishableKey' => payment_stripe_publishable_key(),
                ],
                'La telemedicina sigue bloqueada hasta habilitar almacenamiento clinico cifrado.'
            );
        }

        $doctorForCollision = $requestedDoctor;
        if ($requestedDoctor === 'indiferente') {
            $assigned = $calendarBooking->assignDoctorForIndiferente(
                $store,
                $appointment['date'],
                $appointment['time'],
                $appointment['service']
            );
            if (($assigned['ok'] ?? false) !== true) {
                $errorCode = trim((string) ($assigned['code'] ?? ''));
                json_response([
                    'ok' => false,
                    'error' => (string) ($assigned['error'] ?? 'No hay agenda disponible para la fecha seleccionada'),
                    'code' => $errorCode !== '' ? $errorCode : 'slot_unavailable'
                ], (int) ($assigned['status'] ?? 409));
            }
            $doctorForCollision = (string) ($assigned['doctor'] ?? 'indiferente');
        } else {
            if ($calendarBooking->isGoogleActive()) {
                $slotCheck = $calendarBooking->ensureSlotAvailable(
                    $store,
                    $appointment['date'],
                    $appointment['time'],
                    $requestedDoctor,
                    $appointment['service']
                );
                if (($slotCheck['ok'] ?? false) !== true) {
                    $errorCode = trim((string) ($slotCheck['code'] ?? ''));
                    json_response([
                        'ok' => false,
                        'error' => (string) ($slotCheck['error'] ?? 'No hay agenda disponible para la fecha seleccionada'),
                        'code' => $errorCode !== '' ? $errorCode : 'slot_unavailable'
                    ], (int) ($slotCheck['status'] ?? 409));
                }
            }
        }

        if (!$calendarBooking->isGoogleActive()) {
            $availableSlots = self::getConfiguredSlotsForDate($store, $appointment['date']);
            if (count($availableSlots) === 0) {
                json_response([
                    'ok' => false,
                    'error' => 'No hay agenda disponible para la fecha seleccionada'
                ], 400);
            }
            if (!in_array($appointment['time'], $availableSlots, true)) {
                json_response([
                    'ok' => false,
                    'error' => 'Ese horario no esta disponible para la fecha seleccionada'
                ], 400);
            }
        }

        $idx = $store['idx_appointments_date'] ?? null;
        if (appointment_slot_taken($store['appointments'], $appointment['date'], $appointment['time'], null, $doctorForCollision, $idx)) {
            if ($requestedDoctor === 'indiferente') {
                $alternateDoctor = $doctorForCollision === 'rosero' ? 'narvaez' : 'rosero';
                if (appointment_slot_taken($store['appointments'], $appointment['date'], $appointment['time'], null, $alternateDoctor, $idx)) {
                    json_response([
                        'ok' => false,
                        'error' => 'Ese horario ya fue reservado'
                    ], 409);
                }
                if ($calendarBooking->isGoogleActive()) {
                    $alternateSlotCheck = $calendarBooking->ensureSlotAvailable(
                        $store,
                        $appointment['date'],
                        $appointment['time'],
                        $alternateDoctor,
                        $appointment['service']
                    );
                    if (($alternateSlotCheck['ok'] ?? false) !== true) {
                        $errorCode = trim((string) ($alternateSlotCheck['code'] ?? ''));
                        json_response([
                            'ok' => false,
                            'error' => (string) ($alternateSlotCheck['error'] ?? 'No hay agenda disponible para la fecha seleccionada'),
                            'code' => $errorCode !== '' ? $errorCode : 'slot_unavailable'
                        ], (int) ($alternateSlotCheck['status'] ?? 409));
                    }
                }
                $doctorForCollision = $alternateDoctor;
            } else {
                json_response([
                    'ok' => false,
                    'error' => 'Ese horario ya fue reservado'
                ], 409);
            }
        }

        $seed = implode('|', [
            $appointment['email'],
            $appointment['service'],
            $appointment['date'],
            $appointment['time'],
            $appointment['doctor'],
            $appointment['phone']
        ]);
        $idempotencyKey = payment_build_idempotency_key('intent', $seed);

        try {
            $intent = stripe_create_payment_intent($appointment, $idempotencyKey);
        } catch (RuntimeException $e) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo iniciar el pago en este momento'
            ], 502);
        }

        if (TelemedicineChannelMapper::isTelemedicineService($appointment['service'])) {
            if (!class_exists('LegacyTelemedicineBridge', false)) {
                json_response([
                    'ok' => false,
                    'error' => 'La telemedicina no esta disponible en este momento',
                    'code' => 'telemedicine_bridge_unavailable',
                ], 503);
            }
            with_store_lock(static function () use ($appointment, $intent): array {
                $freshStore = read_store();
                $bridge = new LegacyTelemedicineBridge();
                $draftResult = $bridge->createPaymentIntentDraft($freshStore, $appointment, $intent);
                if (!write_store($draftResult['store'], false)) {
                    error_log('Telemedicine draft persistence failed during payment-intent.');
                }

                return ['ok' => true];
            });
        }

        json_response([
            'ok' => true,
            'clientSecret' => isset($intent['client_secret']) ? (string) $intent['client_secret'] : '',
            'paymentIntentId' => isset($intent['id']) ? (string) $intent['id'] : '',
            'amount' => isset($intent['amount']) ? (int) $intent['amount'] : payment_expected_amount_cents(
                $appointment['service'],
                $appointment['date'] ?? null,
                $appointment['time'] ?? null
            ),
            'currency' => strtoupper((string) ($intent['currency'] ?? payment_currency())),
            'publishableKey' => payment_stripe_publishable_key()
        ]);
    }

    public static function verify(array $context): void
    {
        require_rate_limit('payment-verify', 12, 60);

        if (!payment_gateway_enabled()) {
            json_response([
                'ok' => false,
                'error' => 'Pasarela de pago no configurada'
            ], 503);
        }

        $payload = require_json_body();
        $paymentIntentId = isset($payload['paymentIntentId']) ? trim((string) $payload['paymentIntentId']) : '';
        if ($paymentIntentId === '') {
            json_response([
                'ok' => false,
                'error' => 'paymentIntentId es obligatorio'
            ], 400);
        }

        try {
            $intent = stripe_get_payment_intent($paymentIntentId);
        } catch (RuntimeException $e) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo validar el pago en este momento'
            ], 502);
        }

        $status = (string) ($intent['status'] ?? '');
        $paid = in_array($status, ['succeeded', 'requires_capture'], true);

        json_response([
            'ok' => true,
            'paid' => $paid,
            'status' => $status,
            'id' => isset($intent['id']) ? (string) $intent['id'] : $paymentIntentId,
            'amount' => isset($intent['amount']) ? (int) $intent['amount'] : 0,
            'amountReceived' => isset($intent['amount_received']) ? (int) $intent['amount_received'] : 0,
            'currency' => strtoupper((string) ($intent['currency'] ?? payment_currency()))
        ]);
    }

    public static function transferProof(array $context): void
    {
        require_rate_limit('transfer-proof', 6, 60);

        if (!isset($_FILES['proof']) || !is_array($_FILES['proof'])) {
            json_response([
                'ok' => false,
                'error' => 'Debes adjuntar un comprobante'
            ], 400);
        }

        self::requireClinicalStorageReady(
            'transfer_proof',
            [
                'transferProofPath' => '',
                'transferProofUrl' => '',
                'transferProofName' => '',
                'transferProofMime' => '',
                'transferProofSize' => 0,
                'transferProofUploadId' => 0,
            ],
            'El comprobante no puede registrarse hasta habilitar almacenamiento clinico cifrado.'
        );

        try {
            $upload = save_transfer_proof_upload($_FILES['proof']);
        } catch (RuntimeException $e) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo procesar el comprobante enviado'
            ], 400);
        }

        $stageResult = with_store_lock(static function () use ($upload): array {
            $freshStore = read_store();
            $staged = ClinicalMediaService::stageLegacyUpload($freshStore, $upload, ['source' => 'transfer-proof']);
            if (!write_store($staged['store'], false)) {
                return [
                    'ok' => false,
                    'error' => 'No se pudo registrar el archivo subido',
                    'code' => 503,
                ];
            }

            return [
                'ok' => true,
                'upload' => $staged['upload'],
            ];
        });
        if (($stageResult['ok'] ?? false) !== true || !is_array($stageResult['result'] ?? null) || (($stageResult['result']['ok'] ?? false) !== true)) {
            $diskPath = (string) ($upload['diskPath'] ?? '');
            if ($diskPath !== '' && is_file($diskPath)) {
                @unlink($diskPath);
            }
            json_response([
                'ok' => false,
                'error' => 'No se pudo registrar el archivo subido'
            ], 503);
        }

        $stagedUpload = $stageResult['result']['upload'] ?? [];
        json_response([
            'ok' => true,
            'data' => [
                'transferProofPath' => (string) ($upload['path'] ?? ''),
                'transferProofUrl' => (string) ($upload['url'] ?? ''),
                'transferProofName' => (string) ($upload['name'] ?? ''),
                'transferProofMime' => (string) ($upload['mime'] ?? ''),
                'transferProofSize' => (int) ($upload['size'] ?? 0),
                'transferProofUploadId' => (int) ($stagedUpload['id'] ?? 0),
            ]
        ], 201);
    }

    public static function webhook(array $params): void
    {
        StripeWebhookService::webhook($params);
    }

    public static function readWebhookRawBody(): string
    {
        return StripeWebhookService::readWebhookRawBody();
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

    public static function handleWhatsappCheckoutCompleted(array $params): void
    {
        WhatsappCheckoutService::handleWhatsappCheckoutCompleted($params);
    }

    public static function handleWhatsappCheckoutExpired(array $params): void
    {
        WhatsappCheckoutService::handleWhatsappCheckoutExpired($params);
    }

    public static function handleSoftwareSubscriptionCheckoutCompleted(array $params): void
    {
        SoftwareSubscriptionService::handleSoftwareSubscriptionCheckoutCompleted($params);
    }

    public static function handleSoftwareSubscriptionInvoicePaid(array $params): void
    {
        SoftwareSubscriptionService::handleSoftwareSubscriptionInvoicePaid($params);
    }

    public static function handleSoftwareSubscriptionInvoiceFailed(array $params): void
    {
        SoftwareSubscriptionService::handleSoftwareSubscriptionInvoiceFailed($params);
    }

    public static function handleSoftwareSubscriptionCanceled(array $params): void
    {
        SoftwareSubscriptionService::handleSoftwareSubscriptionCanceled($params);
    }

    public static function isWhatsappOpenclawSession($obj): bool
    {
        return WhatsappCheckoutService::isWhatsappOpenclawSession($obj);
    }

    public static function isSoftwareSubscriptionSession($obj): bool
    {
        return SoftwareSubscriptionService::isSoftwareSubscriptionSession($obj);
    }

    public static function isSoftwareSubscriptionInvoice($obj): bool
    {
        return SoftwareSubscriptionService::isSoftwareSubscriptionInvoice($obj);
    }

    public static function isSoftwareSubscriptionEvent($obj): bool
    {
        return SoftwareSubscriptionService::isSoftwareSubscriptionEvent($obj);
    }

    public static function getConfiguredSlotsForDate(array $store, string $date): array
    {
        $slots = [];

        if (isset($store['availability'][$date]) && is_array($store['availability'][$date])) {
            $slots = $store['availability'][$date];
        }

        if (
            count($slots) === 0 &&
            function_exists('default_availability_enabled') &&
            default_availability_enabled() &&
            function_exists('get_default_availability')
        ) {
            $fallback = get_default_availability();
            if (isset($fallback[$date]) && is_array($fallback[$date])) {
                $slots = $fallback[$date];
            }
        }

        $normalized = [];
        foreach ($slots as $slot) {
            $time = trim((string) $slot);
            if (!preg_match('/^\d{2}:\d{2}$/', $time)) {
                continue;
            }
            $normalized[$time] = true;
        }

        $result = array_keys($normalized);
        sort($result, SORT_STRING);
        return $result;
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:payment-config':
                self::config($context);
                return;
            case 'GET:checkout-config':
                self::checkoutConfig($context);
                return;
            case 'POST:checkout-transfer-proof':
                self::checkoutTransferProof($context);
                return;
            case 'PATCH:checkout-orders':
                self::checkoutOrderReview($context);
                return;
            case 'POST:software-subscription-checkout':
                self::softwareSubscriptionCheckout($context);
                return;
            case 'POST:payment-intent':
                self::createIntent($context);
                return;
            case 'POST:payment-verify':
                self::verify($context);
                return;
            case 'POST:checkout-intent':
                self::checkoutIntent($context);
                return;
            case 'POST:checkout-confirm':
                self::checkoutConfirm($context);
                return;
            case 'POST:checkout-submit':
                self::checkoutSubmit($context);
                return;
            case 'POST:transfer-proof':
                self::transferProof($context);
                return;
            case 'POST:stripe-webhook':
                self::webhook($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'config':
                            self::config($context);
                            return;
                        case 'checkoutConfig':
                            self::checkoutConfig($context);
                            return;
                        case 'checkoutTransferProof':
                            self::checkoutTransferProof($context);
                            return;
                        case 'checkoutOrderReview':
                            self::checkoutOrderReview($context);
                            return;
                        case 'softwareSubscriptionCheckout':
                            self::softwareSubscriptionCheckout($context);
                            return;
                        case 'createIntent':
                            self::createIntent($context);
                            return;
                        case 'verify':
                            self::verify($context);
                            return;
                        case 'checkoutIntent':
                            self::checkoutIntent($context);
                            return;
                        case 'checkoutConfirm':
                            self::checkoutConfirm($context);
                            return;
                        case 'checkoutSubmit':
                            self::checkoutSubmit($context);
                            return;
                        case 'transferProof':
                            self::transferProof($context);
                            return;
                        case 'webhook':
                            self::webhook($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
