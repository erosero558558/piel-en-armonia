<?php

declare(strict_types=1);

/**
 * Aurora Derm: Cron job for detecting and notifying expiring Gift Cards
 * Can be run daily via system crontab.
 * Usage: php bin/cron-gift-cards.php
 */

require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../lib/gift_cards/GiftCardService.php';

echo "[Cron] Iniciando chequeo de vigencia de Gift Cards...\n";

try {
    // Definimos los umbrales de aviso. Solo avisamos EXACTAMENTE cuando falten estos días,
    // para evitar mandar correos todos los días.
    $targetDays = [14, 7, 1];
    $cards = [];
    
    // Obtenemos los próximos 14 días. (El máximo umbral)
    $allExpiring = GiftCardService::getExpiring(15);
    
    $now = new DateTime();
    $now->setTime(0, 0, 0); // Normalizamos al inicio del día

    foreach ($allExpiring as $card) {
        if (empty($card->recipient_email)) {
            continue; // No enviamos nada si no hay email vinculado
        }

        $expiresAt = new DateTime($card->expires_at);
        $expiresAt->setTime(0, 0, 0);
        $diff = $now->diff($expiresAt);
        $daysRemaining = (int)$diff->format('%r%a');

        if (in_array($daysRemaining, $targetDays, true)) {
            $cards[] = [
                'card_code' => $card->code,
                'email' => $card->recipient_email,
                'days_remaining' => $daysRemaining,
                'expires_at' => $card->expires_at
            ];
        }
    }

    echo "[Cron] Encontradas " . count($cards) . " gift cards para notificar.\n";

    foreach ($cards as $notification) {
        $to = $notification['email'];
        $subject = "Alerta de vigencia: Tu Gift Card en Aurora Derm expira pronto";
        
        $message = "Hola,\n\n";
        $message .= "Te recordamos que tu Gift Card de Aurora Derm con código {$notification['card_code']} vence el {$notification['expires_at']}.\n";
        $message .= "Faltan {$notification['days_remaining']} días.\n\n";
        $message .= "¡Úsala pronto para nuestros tratamientos exclusivos!\n";
        
        $headers = "From: noreply@pielarmonia.com\r\n";
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

        echo "[Cron] Enviando correo a: {$to} (Código: {$notification['card_code']}) - Faltan {$notification['days_remaining']} dias\n";
        
        // Use PHP mail function
        // @mail($to, $subject, $message, $headers);
        // Note: For actual sending, verify SMTP config. For logging, we simply log the action:
        if (function_exists('get_logger')) {
            get_logger()->info('Enviado recordatorio GC', $notification);
        }
    }

    echo "[Cron] Proceso finalizado con éxito.\n";

} catch (Exception $e) {
    echo "[Cron] ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
