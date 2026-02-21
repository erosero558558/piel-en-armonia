<?php

declare(strict_types=1);

namespace App\GraphQL;

use GraphQL\Type\Definition\Type;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\ResolveInfo;
use GraphQL\Error\UserError;

require_once __DIR__ . '/../../api-lib.php';
require_once __DIR__ . '/../../payment-lib.php';
require_once __DIR__ . '/../../lib/figo_utils.php';
require_once __DIR__ . '/../BookingService.php';

class Mutation extends ObjectType
{
    public function __construct()
    {
        $config = [
            'name' => 'Mutation',
            'fields' => [
                'createPaymentIntent' => [
                    'type' => new ObjectType([
                         'name' => 'PaymentIntent',
                         'fields' => [
                             'clientSecret' => Type::string(),
                             'id' => Type::string(),
                             'amount' => Type::int(),
                             'currency' => Type::string(),
                             'publishableKey' => Type::string()
                         ]
                    ]),
                    'args' => [
                        'input' => Type::nonNull(Types::appointmentInput())
                    ],
                    'resolve' => function ($root, $args, $context) {
                        $store = $context['store'];
                        $input = $args['input'];
                        $appointment = normalize_appointment($input);

                        if (!payment_gateway_enabled()) {
                            throw new UserError('Pasarela de pago no configurada');
                        }

                        if ($appointment['service'] === '' || $appointment['name'] === '' || $appointment['email'] === '') {
                            throw new UserError('Datos incompletos para iniciar el pago');
                        }

                        $seed = implode('|', [
                           $appointment['email'],
                           $appointment['service'],
                           $appointment['date'] ?? '',
                           $appointment['time'] ?? '',
                           $appointment['doctor'] ?? '',
                           $appointment['phone'] ?? ''
                        ]);
                        $idempotencyKey = payment_build_idempotency_key('intent', $seed);

                        try {
                            $intent = stripe_create_payment_intent($appointment, $idempotencyKey);
                        } catch (\Exception $e) {
                            throw new UserError('No se pudo iniciar el pago: ' . $e->getMessage());
                        }

                        return [
                            'clientSecret' => $intent['client_secret'] ?? '',
                            'id' => $intent['id'] ?? '',
                            'amount' => $intent['amount'] ?? 0,
                            'currency' => strtoupper($intent['currency'] ?? payment_currency()),
                            'publishableKey' => payment_stripe_publishable_key()
                        ];
                    }
                ],
                'verifyPayment' => [
                    'type' => new ObjectType([
                        'name' => 'PaymentVerification',
                        'fields' => [
                            'paid' => Type::boolean(),
                            'status' => Type::string(),
                            'id' => Type::string(),
                            'amount' => Type::int(),
                            'amountReceived' => Type::int(),
                            'currency' => Type::string()
                        ]
                    ]),
                    'args' => [
                        'paymentIntentId' => Type::nonNull(Type::string())
                    ],
                    'resolve' => function ($root, $args, $context) {
                        $paymentIntentId = $args['paymentIntentId'];
                        if (!payment_gateway_enabled()) {
                            throw new UserError('Pasarela de pago no configurada');
                        }
                        try {
                            $intent = stripe_get_payment_intent($paymentIntentId);
                        } catch (\Exception $e) {
                            throw new UserError('No se pudo validar el pago');
                        }

                        $status = (string) ($intent['status'] ?? '');
                        $paid = in_array($status, ['succeeded', 'requires_capture'], true);

                        return [
                            'paid' => $paid,
                            'status' => $status,
                            'id' => $intent['id'] ?? $paymentIntentId,
                            'amount' => $intent['amount'] ?? 0,
                            'amountReceived' => $intent['amount_received'] ?? 0,
                            'currency' => strtoupper($intent['currency'] ?? 'USD')
                        ];
                    }
                ],
                'uploadTransferProof' => [
                    'type' => new ObjectType([
                        'name' => 'TransferProofResult',
                        'fields' => [
                            'path' => Type::string(),
                            'url' => Type::string(),
                            'name' => Type::string(),
                            'mime' => Type::string(),
                            'size' => Type::int()
                        ]
                    ]),
                    'args' => [
                        'input' => Type::nonNull(Types::transferProofInput())
                    ],
                    'resolve' => function ($root, $args, $context) {
                        $input = $args['input'];
                        $base64 = $input['base64'];
                        $filename = sanitize_filename($input['filename']);
                        $mime = $input['mimetype'];

                        $decoded = base64_decode($base64, true);
                        if ($decoded === false) {
                            throw new UserError("Invalid base64");
                        }
                        $size = strlen($decoded);
                        if ($size > 5242880) { // 5MB
                            throw new UserError('El comprobante supera 5 MB.');
                        }

                        $allowed = [
                            'image/jpeg' => 'jpg',
                            'image/png' => 'png',
                            'image/webp' => 'webp',
                            'application/pdf' => 'pdf',
                        ];
                        // Validate mime type properly if possible, but trusting client for now or use finfo on buffer
                        if (!isset($allowed[$mime])) {
                            // Try to detect
                            $finfo = new \finfo(FILEINFO_MIME_TYPE);
                            $detected = $finfo->buffer($decoded);
                            if (!isset($allowed[$detected])) {
                                throw new UserError('Formato no permitido. Usa JPG, PNG, WEBP o PDF.');
                            }
                            $mime = $detected;
                        }

                        $extension = $allowed[$mime];
                        $uniqueName = 'proof-' . local_date('Ymd-His') . '-' . bin2hex(random_bytes(6)) . '.' . $extension;

                        $dir = transfer_proof_upload_dir();
                        if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
                            throw new UserError('Error interno de almacenamiento');
                        }

                        $path = $dir . DIRECTORY_SEPARATOR . $uniqueName;
                        if (file_put_contents($path, $decoded) === false) {
                            throw new UserError('No se pudo guardar el comprobante');
                        }

                        $publicBase = transfer_proof_public_base_url();
                        $publicUrl = $publicBase . '/' . rawurlencode($uniqueName);

                        // Path relative logic similar to payment-lib
                        $publicPath = preg_replace('#^https?://[^/]+#i', '', $publicBase);
                        $trimmedPublicPath = trim($publicPath ?: '/uploads/transfer-proofs', '/');
                        $logicalPath = '/' . $trimmedPublicPath . '/' . $uniqueName;

                        return [
                            'path' => $logicalPath,
                            'url' => $publicUrl,
                            'name' => $filename,
                            'mime' => $mime,
                            'size' => $size
                        ];
                    }
                ],
                'createAppointment' => [
                    'type' => Types::appointment(),
                    'args' => [
                        'input' => Type::nonNull(Types::appointmentInput())
                    ],
                    'resolve' => function ($root, $args, $context) {
                        $store = $context['store'];
                        $input = $args['input'];
                        $bookingService = new \BookingService();
                        $result = $bookingService->create($store, $input);

                        if (!$result['ok']) {
                            throw new UserError($result['error']);
                        }

                        write_store($result['store']);
                        maybe_send_appointment_email($result['data']);
                        maybe_send_admin_notification($result['data']);

                        return $result['data'];
                    }
                ],
                'updateAppointment' => [
                    'type' => Types::appointment(),
                    'args' => [
                        'id' => Type::nonNull(Type::id()),
                        'input' => Type::nonNull(Types::appointmentInput())
                    ],
                    'resolve' => function ($root, $args, $context) {
                        if (!isset($context['isAdmin']) || !$context['isAdmin']) {
                            throw new UserError("Unauthorized");
                        }
                        $store = $context['store'];
                        $id = (int)$args['id'];
                        $input = $args['input'];

                        $found = false;
                        $updatedAppt = null;

                        foreach ($store['appointments'] as &$appt) {
                            if ((int)($appt['id'] ?? 0) !== $id) {
                                continue;
                            }
                            $found = true;
                            $appt = array_merge($appt, array_filter($input, function ($v) {
                                return !is_null($v);
                            }));
                            $updatedAppt = $appt;
                            break;
                        }
                        unset($appt);

                        if (!$found) {
                            throw new UserError('Cita no encontrada');
                        }

                        write_store($store);
                        return $updatedAppt;
                    }
                ],
                'createReview' => [
                    'type' => Types::review(),
                    'args' => [
                        'input' => Type::nonNull(Types::reviewInput())
                    ],
                    'resolve' => function ($root, $args, $context) {
                        $store = $context['store'];
                        $input = $args['input'];

                        $review = normalize_review($input);
                        if ($review['rating'] < 1 || $review['name'] === '') {
                            throw new UserError('Datos invalidos');
                        }

                        $store['reviews'][] = $review;
                        write_store($store);
                        return $review;
                    }
                ],
                'updateAvailability' => [
                    'type' => Type::listOf(Types::availabilitySlot()),
                    'args' => [
                         'availability' => Type::listOf(Types::availabilitySlotInput())
                    ],
                    'resolve' => function ($root, $args, $context) {
                        if (!isset($context['isAdmin']) || !$context['isAdmin']) {
                            throw new UserError("Unauthorized");
                        }

                        $store = $context['store'];
                        $input = $args['availability'];

                        $newAvailability = [];
                        foreach ($input as $slot) {
                            $newAvailability[$slot['date']] = $slot['slots'];
                        }

                        $store['availability'] = $newAvailability;
                        write_store($store);

                        return $input;
                    }
                ],
                'processReschedule' => [
                    'type' => Types::appointment(),
                    'args' => [
                        'token' => Type::nonNull(Type::string()),
                        'date' => Type::nonNull(Type::string()),
                        'time' => Type::nonNull(Type::string())
                    ],
                    'resolve' => function ($root, $args, $context) {
                        $store = $context['store'];
                        $token = $args['token'];
                        $date = $args['date'];
                        $time = $args['time'];

                        $bookingService = new \BookingService();
                        $result = $bookingService->reschedule($store, $token, $date, $time);

                        if (!$result['ok']) {
                            throw new UserError($result['error']);
                        }

                        write_store($result['store']);
                        maybe_send_reschedule_email($result['data']);

                        return $result['data'];
                    }
                ],
                 'updateFigoConfig' => [
                    'type' => Types::figoConfig(),
                    'args' => [
                        'input' => Type::nonNull(Types::figoConfigInput())
                    ],
                    'resolve' => function ($root, $args, $context) {
                        if (!isset($context['isAdmin']) || !$context['isAdmin']) {
                            throw new UserError("Unauthorized");
                        }

                        $input = $args['input'];
                        $configMeta = api_read_figo_config_with_meta();
                        $current = is_array($configMeta['config'] ?? null) ? $configMeta['config'] : [];

                        $payload = $input;

                        try {
                            $next = api_merge_figo_config($current, $payload);
                        } catch (\Exception $e) {
                            throw new UserError($e->getMessage());
                        }

                        $candidatePaths = api_figo_config_candidate_paths();
                        $path = (string) ($candidatePaths[0] ?? ($configMeta['path'] ?? api_resolve_figo_config_path()));
                        $dir = dirname($path);

                        if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
                            throw new UserError('No se pudo crear el directorio de configuracion');
                        }

                        $encoded = json_encode($next, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                        if (@file_put_contents($path, $encoded . PHP_EOL, LOCK_EX) === false) {
                            throw new UserError('No se pudo guardar la configuracion');
                        }

                        $aiNode = (isset($next['ai']) && is_array($next['ai'])) ? $next['ai'] : [];

                        return [
                             'exists' => true,
                             'path' => basename($path),
                             'activePath' => $path,
                             'writePath' => $path,
                             'endpoint' => $next['endpoint'] ?? null,
                             'token' => isset($next['token']) ? '******' : null,
                             'apiKey' => isset($next['apiKey']) ? '******' : null,
                             'apiKeyHeader' => $next['apiKeyHeader'] ?? null,
                             'timeout' => $next['timeout'] ?? null,
                             'allowLocalFallback' => $next['allowLocalFallback'] ?? null,
                             'ai' => [
                                 'endpoint' => $aiNode['endpoint'] ?? null,
                                 'apiKey' => isset($aiNode['apiKey']) ? '******' : null,
                                 'model' => $aiNode['model'] ?? null,
                                 'timeoutSeconds' => $aiNode['timeoutSeconds'] ?? null,
                                 'allowLocalFallback' => $aiNode['allowLocalFallback'] ?? null
                             ],
                             'figoEndpointConfigured' => !empty($next['endpoint']),
                             'aiConfigured' => !empty($aiNode['endpoint']),
                             'timestamp' => gmdate('c')
                        ];
                    }
                ]
            ]
        ];
        parent::__construct($config);
    }
}
