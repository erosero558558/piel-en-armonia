<?php

declare(strict_types=1);

require_once __DIR__ . '/checkout/CheckoutPaymentGateway.php';
require_once __DIR__ . '/checkout/CheckoutCartService.php';

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/ClinicConfig.php';

final class CheckoutOrderService
{
    public static
    function publicConfig(): array
    {
        return [
            'currency' => strtoupper(payment_currency()),
            'stripeEnabled' => payment_gateway_enabled(),
            'publishableKey' => payment_stripe_publishable_key(),
            'bank' => self::bankData(),
            'support' => [
                'whatsappPhone' => ClinicConfig::getWhatsappNumber(),
                'whatsappHref' => 'https://wa.me/' . ClinicConfig::getWhatsappNumber(),
            ],
            'methods' => [
                'card' => [
                    'enabled' => payment_gateway_enabled(),
                    'label' => self::paymentMethodLabel('card'),
                ],
                'transfer' => [
                    'enabled' => true,
                    'label' => self::paymentMethodLabel('transfer'),
                ],
                'cash' => [
                    'enabled' => true,
                    'label' => self::paymentMethodLabel('cash'),
                ],
            ],
        ];
    }


    public static function buildCardIntentRequest(...$args)
    {
        return CheckoutPaymentGateway::buildCardIntentRequest(...$args);
    }

    public static function attachCardIntent(...$args)
    {
        return CheckoutPaymentGateway::attachCardIntent(...$args);
    }

    public static function attachTransferProof(...$args)
    {
        return CheckoutPaymentGateway::attachTransferProof(...$args);
    }

    public static function verifyTransfer(...$args)
    {
        return CheckoutPaymentGateway::verifyTransfer(...$args);
    }

    public static function applyTransfer(...$args)
    {
        return CheckoutPaymentGateway::applyTransfer(...$args);
    }

    public static function buildOfflineMethodOrder(...$args)
    {
        return CheckoutCartService::buildOfflineMethodOrder(...$args);
    }

    public static function confirmPaidCardOrder(...$args)
    {
        return CheckoutPaymentGateway::confirmPaidCardOrder(...$args);
    }

    public static function upsertOrder(...$args)
    {
        return CheckoutCartService::upsertOrder(...$args);
    }

    public static function findOrder(...$args)
    {
        return CheckoutCartService::findOrder(...$args);
    }

    public static function buildReceipt(...$args)
    {
        return CheckoutCartService::buildReceipt(...$args);
    }

    public static function buildAdminReviewMeta(...$args)
    {
        return CheckoutCartService::buildAdminReviewMeta(...$args);
    }

    public static function buildAdminAccountMeta(...$args)
    {
        return CheckoutCartService::buildAdminAccountMeta(...$args);
    }

    public static function normalizeOrderDraft(...$args)
    {
        return CheckoutCartService::normalizeOrderDraft(...$args);
    }

    public static function applyMembershipDiscount(...$args)
    {
        return CheckoutCartService::applyMembershipDiscount(...$args);
    }

    public static function normalizeAmountCents(...$args)
    {
        return CheckoutCartService::normalizeAmountCents(...$args);
    }

    public static function generateOrderId()
    {
        return CheckoutCartService::generateOrderId();
    }

    public static function buildReceiptNumber(...$args)
    {
        return CheckoutCartService::buildReceiptNumber(...$args);
    }

    public static function formatCurrency(...$args)
    {
        return CheckoutCartService::formatCurrency(...$args);
    }

    public static function bankData()
    {
        return CheckoutCartService::bankData();
    }

    public static function paymentMethodLabel(...$args)
    {
        return CheckoutCartService::paymentMethodLabel(...$args);
    }

    public static function paymentStatusLabel(...$args)
    {
        return CheckoutCartService::paymentStatusLabel(...$args);
    }

    public static function buildAccountPatientKey(...$args)
    {
        return CheckoutCartService::buildAccountPatientKey(...$args);
    }

    public static function resolveOrderActivityAt(...$args)
    {
        return CheckoutCartService::resolveOrderActivityAt(...$args);
    }

    public static function resolveOrderDueAt(...$args)
    {
        return CheckoutCartService::resolveOrderDueAt(...$args);
    }

    public static function buildDefaultDueAt(...$args)
    {
        return CheckoutCartService::buildDefaultDueAt(...$args);
    }

    public static function addMinutesToIso(...$args)
    {
        return CheckoutCartService::addMinutesToIso(...$args);
    }

    public static function addHoursToIso(...$args)
    {
        return CheckoutCartService::addHoursToIso(...$args);
    }

    public static function normalizeIsoDateTime(...$args)
    {
        return CheckoutCartService::normalizeIsoDateTime(...$args);
    }

    public static function isoTimestamp(...$args)
    {
        return CheckoutCartService::isoTimestamp(...$args);
    }

    public static function assertTransferOrder(...$args)
    {
        return CheckoutCartService::assertTransferOrder(...$args);
    }
}
