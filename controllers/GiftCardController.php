<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/gift_cards/GiftCardService.php';
require_once __DIR__ . '/../lib/http.php';

class GiftCardController
{
    /**
     * POST /api.php?resource=gift-card-issue
     */
    private static function issue(): void
    {
        // Enforce administrative authentication for issuance
        requireAuth();
        
        // Also check if the user is truly an admin (assuming auth provides a session flag or role)
        // For Aurora Derm, rely on requireAuth() + session scope for admin routes.

        $inputData = file_get_contents('php://input');
        $data = json_decode($inputData, true);

        if (!$data || !isset($data['amount_cents'])) {
            http_response_code(400);
            echo json_encode(["error" => "Invalid payload, missing amount_cents"]);
            return;
        }

        $amountCents = (int)$data['amount_cents'];
        $issuerId = $data['issuer'] ?? $_SESSION['user_id'] ?? 'Admin';
        $recipientEmail = $data['recipient_email'] ?? null;

        try {
            $giftCard = GiftCardService::issue($amountCents, $issuerId, $recipientEmail);
            
            // Format QR payload. Often a URL pointing to the gift card verification or redemption page
            $baseUrl = $_ENV['APP_URL'] ?? 'https://pielarmonia.com';
            $qrUrl = $baseUrl . '/es/gift-cards/redimir?code=' . urlencode($giftCard->code);

            echo json_encode([
                "message" => "Gift card issued successfully",
                "code" => $giftCard->code,
                "amount_cents" => $giftCard->amount_cents,
                "recipient_email" => $giftCard->recipient_email,
                "expires_at" => $giftCard->expires_at,
                "qr_data" => $qrUrl
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
    }

    /**
     * POST /api.php?resource=gift-card-redeem
     */
    private static function redeem(): void
    {
        requireAuth();

        $inputData = file_get_contents('php://input');
        $data = json_decode($inputData, true);

        if (!$data || !isset($data['code']) || !isset($data['amount_cents'])) {
            http_response_code(400);
            echo json_encode(["error" => "Invalid payload, missing code or amount_cents"]);
            return;
        }

        $code = trim($data['code']);
        $amountCents = (int)$data['amount_cents'];

        try {
            $success = GiftCardService::redeem($code, $amountCents);
            
            if ($success) {
                echo json_encode(["message" => "Gift card redeemed successfully", "amount_redeemed_cents" => $amountCents]);
            } else {
                http_response_code(400);
                echo json_encode(["error" => "Gift card invalid, expired, or insufficient balance"]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
    }

    /**
     * GET /api.php?resource=gift-card-validate&code=XXX
     */
    private static function validate(): void
    {
        $code = $_GET['code'] ?? null;
        if (!$code) {
            http_response_code(400);
            echo json_encode(["error" => "Missing code"]);
            return;
        }

        $giftCard = GiftCardService::validate(trim($code));
        if ($giftCard && $giftCard->isActive()) {
            echo json_encode([
                "valid" => true,
                "code" => $giftCard->code,
                "balance_cents" => $giftCard->balance_cents,
                "expires_at" => $giftCard->expires_at
            ]);
        } else {
            echo json_encode([
                "valid" => false,
                "reason" => "Invalid, exhausted, or expired"
            ]);
        }
    }

    /**
     * GET /api.php?resource=gift-cards-expiring
     */
    private static function expiring(): void
    {
        requireAuth();
        
        // Let UI pass a optional days param or default to 14
        $days = isset($_GET['days']) ? (int)$_GET['days'] : 14;
        
        try {
            // Get strictly expiring
            $expiringCards = GiftCardService::getExpiringCards($days);
            
            // Or get all active for the admin dashboard (Gestión > Gift Cards says "listar con dias restantes")
            $allActive = GiftCardService::getAllActiveCards();
            
            $mapped = array_map(function($c) {
                // Calculate days remaining
                $daysRemaining = null;
                if ($c->expires_at) {
                    $diff = (new DateTime($c->expires_at))->diff(new DateTime());
                    $daysRemaining = $diff->invert ? $diff->days : -$diff->days;
                }
                
                return [
                    "code" => $c->code,
                    "balance_cents" => $c->balance_cents,
                    "recipient_email" => $c->recipient_email,
                    "expires_at" => $c->expires_at,
                    "days_remaining" => $daysRemaining,
                    "status" => $c->status
                ];
            }, $allActive);

            echo json_encode([
                "message" => "Gift cards retrieved",
                "cards" => $mapped,
                "expiring_count" => count($expiringCards)
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
    }


    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'POST:gift-card-issue':
                self::issue($context);
                return;
            case 'POST:gift-card-redeem':
                self::redeem($context);
                return;
            case 'GET:gift-card-validate':
                self::validate($context);
                return;
            case 'GET:gift-cards-expiring':
                self::expiring($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'issue':
                            self::issue($context);
                            return;
                        case 'redeem':
                            self::redeem($context);
                            return;
                        case 'validate':
                            self::validate($context);
                            return;
                        case 'expiring':
                            self::expiring($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
