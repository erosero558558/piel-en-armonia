<?php

declare(strict_types=1);

namespace Stripe {
    class StripeClient
    {
        public $paymentIntents;

        public function __construct($secret)
        {
            $this->paymentIntents = new \Stripe\Service\PaymentIntentService();
        }
    }

    class PaymentIntent
    {
        private array $data;

        public function __construct(array $data)
        {
            $defaults = [
                'id' => 'pi_mock_123',
                'status' => 'succeeded',
                'amount' => 4000,
                'amount_received' => 4000,
                'currency' => 'usd',
                'metadata' => [],
            ];
            $this->data = array_merge($defaults, $data);
        }

        public function toArray(): array
        {
            return $this->data;
        }
    }
}

namespace Stripe\Service {
    class PaymentIntentService
    {
        public function retrieve($id)
        {
            $mockIntents = isset($GLOBALS['mockStripeIntents']) && is_array($GLOBALS['mockStripeIntents'])
                ? $GLOBALS['mockStripeIntents']
                : [];
            $payload = isset($mockIntents[$id]) && is_array($mockIntents[$id])
                ? $mockIntents[$id]
                : ['id' => (string) $id];
            return new \Stripe\PaymentIntent($payload);
        }
    }
}

namespace {
    require_once __DIR__ . '/test_framework.php';
    require_once __DIR__ . '/../payment-lib.php';
    require_once __DIR__ . '/../lib/BookingService.php';

    putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
    putenv('PIELARMONIA_REQUIRE_GOOGLE_CALENDAR=false');
    putenv('PIELARMONIA_STRIPE_SECRET_KEY=sk_test_critical');
    putenv('PIELARMONIA_STRIPE_PUBLISHABLE_KEY=pk_test_critical');
    putenv('PIELARMONIA_PAYMENT_CURRENCY=USD');

    function next_weekday_date(int $minimumDaysAhead): string
    {
        $daysAhead = max(1, $minimumDaysAhead);
        while (true) {
            $candidate = strtotime('+' . $daysAhead . ' day');
            if ($candidate === false) {
                $daysAhead += 1;
                continue;
            }

            $dayOfWeek = (int) date('N', $candidate);
            if ($dayOfWeek < 6) {
                return date('Y-m-d', $candidate);
            }

            $daysAhead += 1;
        }
    }

    function build_payment_store(string $date, string $time = '10:00'): array
    {
        return [
            'appointments' => [],
            'availability' => [
                $date => [$time, '11:00', '15:00'],
            ],
            'idx_appointments_date' => [],
        ];
    }

    function build_payment_payload(string $date, string $paymentIntentId): array
    {
        return [
            'name' => 'Paciente Payments',
            'email' => 'payments@example.com',
            'phone' => '0991234567',
            'date' => $date,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'reason' => 'Chequeo de flujo de pagos',
            'privacyConsent' => true,
            'paymentMethod' => 'card',
            'paymentIntentId' => $paymentIntentId,
        ];
    }

    run_test('BookingService::create marca la reserva con tarjeta como pagada', function () {
        $futureDate = next_weekday_date(2);
        $amount = payment_expected_amount_cents('consulta', $futureDate, '10:00');
        $store = build_payment_store($futureDate);
        $payload = build_payment_payload($futureDate, 'pi_card_success');

        $GLOBALS['mockStripeIntents'] = [
            'pi_card_success' => [
                'id' => 'pi_card_success',
                'status' => 'succeeded',
                'amount' => $amount,
                'amount_received' => $amount,
                'currency' => 'usd',
                'metadata' => [
                    'site' => 'pielarmonia.com',
                    'service' => 'consulta',
                    'date' => $futureDate,
                    'time' => '10:00',
                    'doctor' => 'rosero',
                ],
            ],
        ];

        $service = new BookingService();
        $result = $service->create($store, $payload);

        assert_true($result['ok'], 'La reserva con tarjeta deberia completarse.');
        assert_equals(201, $result['code']);
        assert_array_has_key('data', $result);
        assert_array_has_key('store', $result);
        assert_equals(1, count($result['store']['appointments']));
        assert_equals('card', $result['data']['paymentMethod']);
        assert_equals('paid', $result['data']['paymentStatus']);
        assert_equals('stripe', $result['data']['paymentProvider']);
        assert_equals('pi_card_success', $result['data']['paymentIntentId']);
        assert_equals('store', $result['data']['calendarProvider']);
    });

    run_test('BookingService::create bloquea reusar un paymentIntentId ya consumido', function () {
        $futureDate = next_weekday_date(3);
        $amount = payment_expected_amount_cents('consulta', $futureDate, '10:00');
        $store = build_payment_store($futureDate);
        $store['appointments'][] = [
            'id' => 1,
            'date' => $futureDate,
            'time' => '09:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'status' => 'confirmed',
            'paymentIntentId' => 'pi_duplicate',
        ];
        $payload = build_payment_payload($futureDate, 'pi_duplicate');

        $GLOBALS['mockStripeIntents'] = [
            'pi_duplicate' => [
                'id' => 'pi_duplicate',
                'status' => 'succeeded',
                'amount' => $amount,
                'amount_received' => $amount,
                'currency' => 'usd',
                'metadata' => [
                    'site' => 'pielarmonia.com',
                    'service' => 'consulta',
                    'date' => $futureDate,
                    'time' => '10:00',
                    'doctor' => 'rosero',
                ],
            ],
        ];

        $service = new BookingService();
        $result = $service->create($store, $payload);

        assert_false($result['ok']);
        assert_equals(409, $result['code']);
        assert_contains('ya fue utilizado', $result['error']);
    });

    run_test('BookingService::create rechaza metadata Stripe que no coincide con la reserva', function () {
        $futureDate = next_weekday_date(4);
        $amount = payment_expected_amount_cents('consulta', $futureDate, '10:00');
        $store = build_payment_store($futureDate);
        $payload = build_payment_payload($futureDate, 'pi_mismatch_date');

        $GLOBALS['mockStripeIntents'] = [
            'pi_mismatch_date' => [
                'id' => 'pi_mismatch_date',
                'status' => 'succeeded',
                'amount' => $amount,
                'amount_received' => $amount,
                'currency' => 'usd',
                'metadata' => [
                    'site' => 'pielarmonia.com',
                    'service' => 'consulta',
                    'date' => date('Y-m-d', strtotime('+5 day')),
                    'time' => '10:00',
                    'doctor' => 'rosero',
                ],
            ],
        ];

        $service = new BookingService();
        $result = $service->create($store, $payload);

        assert_false($result['ok']);
        assert_equals(400, $result['code']);
        assert_contains('fecha seleccionada', $result['error']);
    });

    print_test_summary();
}
