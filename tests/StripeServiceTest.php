<?php
declare(strict_types=1);

namespace Stripe {
    class StripeClient {
        public $paymentIntents;
        public function __construct($secret) {
            $this->paymentIntents = new \Stripe\Service\PaymentIntentService();
        }
    }

    class Webhook {
        public static function constructEvent($payload, $sigHeader, $secret) {
            if ($sigHeader === 'invalid') throw new Exception\SignatureVerificationException('Invalid signature');
            return new Event($payload);
        }
    }

    class Event {
        private $payload;
        public function __construct($payload) {
            $this->payload = json_decode($payload, true);
        }
        public function toArray() {
            return $this->payload;
        }
    }

    class PaymentIntent {
        private $data;
        public function __construct($data) {
            $this->data = $data;
            if (!isset($this->data['id'])) $this->data['id'] = 'pi_mock_123';
            if (!isset($this->data['client_secret'])) $this->data['client_secret'] = 'pi_mock_secret_123';
        if (!isset($this->data['amount'])) $this->data['amount'] = 4000;
            if (!isset($this->data['currency'])) $this->data['currency'] = 'usd';
        }
        public function toArray() {
            return $this->data;
        }
    }
}

namespace Stripe\Service {
    class PaymentIntentService {
        public function create($params, $options = []) {
            return new \Stripe\PaymentIntent($params);
        }
        public function retrieve($id) {
            return new \Stripe\PaymentIntent(['id' => $id]);
        }
    }
}

namespace Stripe\Exception {
    class ApiErrorException extends \Exception {}
    class SignatureVerificationException extends \Exception {}
}

namespace {
    require_once __DIR__ . '/test_framework.php';

    require_once __DIR__ . '/../lib/common.php';
    require_once __DIR__ . '/../lib/business.php';
    require_once __DIR__ . '/../payment-lib.php';

    run_test('payment_currency default', function() {
        putenv('PIELARMONIA_PAYMENT_CURRENCY');
        $currency = payment_currency();
        assert_equals('USD', $currency);
    });

    run_test('payment_currency override', function() {
        putenv('PIELARMONIA_PAYMENT_CURRENCY=EUR');
        $currency = payment_currency();
        assert_equals('EUR', $currency);
        putenv('PIELARMONIA_PAYMENT_CURRENCY');
    });

    run_test('payment_expected_amount_cents calculation', function() {
        putenv('PIELARMONIA_VAT_RATE');
        $cents = payment_expected_amount_cents('consulta');
        assert_equals(4000, $cents);
    });

    run_test('payment_build_idempotency_key format', function() {
        $key = payment_build_idempotency_key('test', 'seed');
        if (strpos($key, 'test-') !== 0) throw new Exception("Key should start with test-");
        if (strlen($key) !== 53) throw new Exception("Key length should be 53");
    });

    run_test('stripe_create_payment_intent success', function() {
        putenv('PIELARMONIA_STRIPE_SECRET_KEY=sk_test_123');

        $appt = [
            'service' => 'consulta',
            'email' => 'test@example.com',
            'doctor' => 'rosero',
            'date' => '2024-01-01',
            'time' => '10:00',
            'name' => 'Test User',
            'phone' => '0991234567'
        ];

        $intent = stripe_create_payment_intent($appt);

        if (!isset($intent['id'])) throw new Exception("Intent ID missing");
        if (!isset($intent['client_secret'])) throw new Exception("Client Secret missing");
        assert_equals(4000, $intent['amount']);
        assert_equals('usd', $intent['currency']);

        putenv('PIELARMONIA_STRIPE_SECRET_KEY');
    });

    run_test('stripe_create_payment_intent fails without secret', function() {
        putenv('PIELARMONIA_STRIPE_SECRET_KEY');
        try {
            stripe_create_payment_intent(['service' => 'consulta']);
            throw new Exception("Should verify secret key");
        } catch (RuntimeException $e) {
            assert_contains('no esta configurada', $e->getMessage());
        }
    });

    print_test_summary();
}
