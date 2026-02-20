<?php
declare(strict_types=1);

namespace Stripe {
    if (!class_exists('Stripe\StripeClient')) {
        class StripeClient {
            public $paymentIntents;
            public function __construct($secret) {
                $this->paymentIntents = new PaymentIntents();
            }
        }
    }
    if (!class_exists('Stripe\PaymentIntents')) {
        class PaymentIntents {
            public function create($params, $options = []) {
                $metadata = isset($params['metadata']) ? $params['metadata'] : [];
                $data = [
                    'id' => 'pi_mock_' . bin2hex(random_bytes(8)),
                    'client_secret' => 'seti_mock_secret',
                    'amount' => $params['amount'],
                    'currency' => $params['currency'],
                    'status' => 'requires_payment_method',
                    'metadata' => $metadata
                ];
                return new StripeObject($data);
            }
            public function retrieve($id) {
                $data = [
                    'id' => $id,
                    'status' => 'succeeded',
                    'amount' => 4600,
                    'currency' => 'usd'
                ];
                return new StripeObject($data);
            }
        }
    }
    if (!class_exists('Stripe\StripeObject')) {
        #[\AllowDynamicProperties]
        class StripeObject {
            private $data;
            public function __construct($data) {
                $this->data = $data;
                foreach ($data as $k => $v) {
                    $this->$k = $v;
                }
            }
            public function toArray() {
                return $this->data;
            }
        }
    }
    if (!class_exists('Stripe\Webhook')) {
        class Webhook {
            public static function constructEvent($payload, $sigHeader, $secret) {
                if ($sigHeader !== 'valid_signature') {
                     throw new Exception\SignatureVerificationException("Invalid signature");
                }
                return new Event();
            }
        }
    }
    if (!class_exists('Stripe\Event')) {
        class Event {
            public $type = 'payment_intent.succeeded';
            public $data;
            public function __construct() {
                $this->data = ['object' => ['id' => 'pi_mock_webhook']];
            }
            public function toArray() {
                return ['type' => $this->type, 'data' => $this->data];
            }
        }
    }
}

namespace Stripe\Exception {
    if (!class_exists('Stripe\Exception\ApiErrorException')) {
        class ApiErrorException extends \Exception {}
    }
    if (!class_exists('Stripe\Exception\SignatureVerificationException')) {
        class SignatureVerificationException extends \Exception {}
    }
}
