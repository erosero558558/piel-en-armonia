<?php
declare(strict_types=1);

namespace App\GraphQL;

use GraphQL\Type\Definition\Type;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\ResolveInfo;

require_once __DIR__ . '/../../api-lib.php';
require_once __DIR__ . '/../../payment-lib.php';
require_once __DIR__ . '/../../lib/figo_utils.php';
require_once __DIR__ . '/../monitoring.php';
require_once __DIR__ . '/../metrics.php';
require_once __DIR__ . '/../prediction.php';
require_once __DIR__ . '/../BookingService.php';

class Query extends ObjectType
{
    public function __construct()
    {
        $config = [
            'name' => 'Query',
            'fields' => [
                'health' => [
                    'type' => new ObjectType([
                        'name' => 'HealthStatus',
                        'fields' => [
                            'status' => Type::string(),
                            'store' => Type::string(),
                        ]
                    ]),
                    'resolve' => function ($root, $args, $context) {
                        return [
                            'status' => 'ok',
                            'store' => isset($context['store']) ? 'ok' : 'error'
                        ];
                    }
                ],
                'monitoringConfig' => [
                    'type' => Types::monitoringConfig(),
                    'resolve' => function ($root, $args, $context) {
                        return get_monitoring_config();
                    }
                ],
                'features' => [
                    'type' => Type::listOf(Types::featureFlag()),
                    'resolve' => function ($root, $args, $context) {
                        $flags = \FeatureFlags::getAll();
                        $result = [];
                        foreach ($flags as $k => $v) {
                            $result[] = ['name' => $k, 'enabled' => $v];
                        }
                        return $result;
                    }
                ],
                'paymentConfig' => [
                    'type' => Types::paymentConfig(),
                    'resolve' => function ($root, $args, $context) {
                        return [
                            'stripePublicKey' => getenv('STRIPE_PUBLIC_KEY'),
                            'currency' => payment_currency(),
                            'enabled' => payment_gateway_enabled(),
                            'vatRate' => get_vat_rate()
                        ];
                    }
                ],
                'availability' => [
                    'type' => Type::listOf(Types::availabilitySlot()),
                    'resolve' => function ($root, $args, $context) {
                        $store = $context['store'];
                        $result = [];
                        if (isset($store['availability']) && is_array($store['availability'])) {
                            foreach ($store['availability'] as $date => $slots) {
                                $result[] = ['date' => $date, 'slots' => $slots];
                            }
                        }
                        return $result;
                    }
                ],
                'reviews' => [
                    'type' => Type::listOf(Types::review()),
                    'resolve' => function ($root, $args, $context) {
                         $store = $context['store'];
                         return isset($store['reviews']) && is_array($store['reviews']) ? $store['reviews'] : [];
                    }
                ],
                'bookedSlots' => [
                    'type' => Type::listOf(Type::string()),
                    'args' => [
                        'date' => Type::nonNull(Type::string()),
                        'doctor' => Type::string()
                    ],
                    'resolve' => function ($root, $args, $context) {
                        $store = $context['store'];
                        $date = $args['date'];
                        $doctor = $args['doctor'] ?? '';

                        $slots = [];
                        if (isset($store['appointments']) && is_array($store['appointments'])) {
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
                        }
                        $slots = array_values(array_unique($slots));
                        sort($slots);
                        return $slots;
                    }
                ],
                'appointments' => [
                    'type' => Type::listOf(Types::appointment()),
                    'resolve' => function ($root, $args, $context) {
                        if (!isset($context['isAdmin']) || !$context['isAdmin']) {
                            throw new \GraphQL\Error\UserError("Unauthorized");
                        }
                        $store = $context['store'];
                        return isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
                    }
                ],
                'callbacks' => [
                    'type' => Type::listOf(Types::callback()),
                    'resolve' => function ($root, $args, $context) {
                        if (!isset($context['isAdmin']) || !$context['isAdmin']) {
                            throw new \GraphQL\Error\UserError("Unauthorized");
                        }
                        $store = $context['store'];
                        return isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
                    }
                ],
                'reschedule' => [
                    'type' => Types::appointment(), // Using Appointment type for simplicity, even if just subset fields needed
                    'args' => [
                        'token' => Type::nonNull(Type::string())
                    ],
                    'resolve' => function ($root, $args, $context) {
                        $store = $context['store'];
                        $token = $args['token'];
                        if (strlen($token) < 16) {
                            throw new \GraphQL\Error\UserError("Token inválido");
                        }

                        $found = null;
                        if (isset($store['appointments']) && is_array($store['appointments'])) {
                            foreach ($store['appointments'] as $appt) {
                                if (($appt['rescheduleToken'] ?? '') === $token && ($appt['status'] ?? '') !== 'cancelled') {
                                    $found = $appt;
                                    break;
                                }
                            }
                        }

                        if (!$found) {
                            throw new \GraphQL\Error\UserError("Cita no encontrada o cancelada");
                        }

                        return $found;
                    }
                ],
                'prediction' => [
                    'type' => Types::prediction(),
                    'args' => [
                        'email' => Type::string(),
                        'phone' => Type::string(),
                        'date' => Type::string(),
                        'time' => Type::string(),
                        'service' => Type::string()
                    ],
                    'resolve' => function ($root, $args, $context) {
                        if (!isset($context['isAdmin']) || !$context['isAdmin']) {
                            throw new \GraphQL\Error\UserError("Unauthorized");
                        }
                        $store = $context['store'];
                        $email = $args['email'] ?? '';
                        $phone = $args['phone'] ?? '';

                        if ($email === '' && $phone === '') {
                             throw new \GraphQL\Error\UserError("Email o telefono requerido");
                        }

                        $history = [];
                        if (isset($store['appointments']) && is_array($store['appointments'])) {
                            foreach ($store['appointments'] as $appt) {
                                $apptEmail = isset($appt['email']) ? trim((string) $appt['email']) : '';
                                $apptPhone = isset($appt['phone']) ? trim((string) $appt['phone']) : '';

                                if (($email !== '' && strcasecmp($email, $apptEmail) === 0) ||
                                    ($phone !== '' && $phone === $apptPhone)) {
                                    $history[] = $appt;
                                }
                            }
                        }

                        $prediction = \NoShowPredictor::predict([
                            'date' => $args['date'] ?? '',
                            'time' => $args['time'] ?? '',
                            'service' => $args['service'] ?? ''
                        ], $history);

                        return [
                            'score' => $prediction['probability'] ?? 0.0,
                            'risk' => $prediction['riskLevel'] ?? 'unknown',
                            'factors' => $prediction['factors'] ?? []
                        ];
                    }
                ],
                'adminData' => [
                    'type' => Types::adminData(),
                    'resolve' => function ($root, $args, $context) {
                        if (!isset($context['isAdmin']) || !$context['isAdmin']) {
                            throw new \GraphQL\Error\UserError("Unauthorized");
                        }
                        $store = $context['store'];
                        return [
                            'appointments' => isset($store['appointments']) ? $store['appointments'] : [],
                            'reviews' => isset($store['reviews']) ? $store['reviews'] : [],
                            'callbacks' => isset($store['callbacks']) ? $store['callbacks'] : [],
                            'availability' => isset($store['availability']) ? array_map(function($k, $v) { return ['date' => $k, 'slots' => $v]; }, array_keys($store['availability']), $store['availability']) : []
                        ];
                    }
                ],
                // figoConfig needs helper functions from api.php which are not available if I don't include it.
                // I will skip figoConfig for now or return empty if logic is too coupled to api.php globals.
                // Given the instruction "Unify all endpoints", I should try.
                // I'll leave a placeholder or basic implementation if I can't easily port the logic.
                'figoConfig' => [
                     'type' => Types::figoConfig(),
                     'resolve' => function ($root, $args, $context) {
                         $configMeta = api_read_figo_config_with_meta();
                         $candidatePaths = api_figo_config_candidate_paths();
                         $writePath = $candidatePaths[0] ?? (string) ($configMeta['path'] ?? api_resolve_figo_config_path());
                         $config = is_array($configMeta['config'] ?? null) ? $configMeta['config'] : [];
                         $masked = api_mask_figo_config($config);
                         $aiNode = (isset($config['ai']) && is_array($config['ai'])) ? $config['ai'] : [];
                         $aiEndpoint = isset($aiNode['endpoint']) && is_string($aiNode['endpoint']) ? trim((string) $aiNode['endpoint']) : '';
                         $figoEndpoint = isset($config['endpoint']) && is_string($config['endpoint']) ? trim((string) $config['endpoint']) : '';

                         return [
                             'exists' => (bool) ($configMeta['exists'] ?? false),
                             'path' => basename((string) ($configMeta['path'] ?? 'figo-config.json')),
                             'activePath' => (string) ($configMeta['path'] ?? ''),
                             'writePath' => (string) $writePath,
                             'endpoint' => $masked['endpoint'] ?? null,
                             'token' => $masked['token'] ?? null,
                             'apiKey' => $masked['apiKey'] ?? null,
                             'apiKeyHeader' => $masked['apiKeyHeader'] ?? null,
                             'timeout' => $masked['timeout'] ?? null,
                             'allowLocalFallback' => $masked['allowLocalFallback'] ?? null,
                             'ai' => [
                                 'endpoint' => $aiNode['endpoint'] ?? null,
                                 'apiKey' => isset($aiNode['apiKey']) ? '******' : null,
                                 'model' => $aiNode['model'] ?? null,
                                 'timeoutSeconds' => $aiNode['timeoutSeconds'] ?? null,
                                 'allowLocalFallback' => $aiNode['allowLocalFallback'] ?? null
                             ],
                             'figoEndpointConfigured' => $figoEndpoint !== '',
                             'aiConfigured' => $aiEndpoint !== '',
                             'timestamp' => gmdate('c')
                         ];
                     }
                ]
            ]
        ];
        parent::__construct($config);
    }
}
