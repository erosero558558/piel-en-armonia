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
    public function issue(): void
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
    public function redeem(): void
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
    public function validate(): void
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
}
