<?php

declare(strict_types=1);

final class WhatsappCheckoutService
{
public static function handleWhatsappCheckoutCompleted(array $session): void
    {
        if (!self::isWhatsappOpenclawSession($session) || !function_exists('whatsapp_openclaw_orchestrator')) {
            return;
        }

        $result = with_store_lock(static function () use ($session): array {
            $store = read_store();
            $outcome = whatsapp_openclaw_orchestrator()->finalizeCardCheckout($store, $session);
            if (($outcome['storeDirty'] ?? false) === true && isset($outcome['store']) && is_array($outcome['store'])) {
                write_store($outcome['store'], false);
            }
            return $outcome;
        });

        if (($result['ok'] ?? false) !== true) {
            audit_log_event('whatsapp_openclaw.checkout_completed_lock_failed', [
                'error' => (string) ($result['error'] ?? 'unknown'),
            ]);
            return;
        }

        $outcome = is_array($result['result'] ?? null) ? $result['result'] : [];
        if (($outcome['ignored'] ?? false) === true) {
            return;
        }

        audit_log_event('whatsapp_openclaw.checkout_completed', [
            'sessionId' => (string) ($session['id'] ?? ''),
            'paymentIntentId' => (string) ($session['payment_intent'] ?? ''),
            'status' => (string) ($outcome['status'] ?? ''),
            'appointmentId' => (int) ($outcome['appointmentId'] ?? 0),
            'error' => (string) ($outcome['error'] ?? ''),
        ]);
    }

public static function handleWhatsappCheckoutExpired(array $session): void
    {
        if (!self::isWhatsappOpenclawSession($session) || !function_exists('whatsapp_openclaw_orchestrator')) {
            return;
        }

        $result = with_store_lock(static function () use ($session): array {
            $store = read_store();
            return whatsapp_openclaw_orchestrator()->expireCardCheckout($store, $session);
        });

        if (($result['ok'] ?? false) !== true) {
            audit_log_event('whatsapp_openclaw.checkout_expired_lock_failed', [
                'error' => (string) ($result['error'] ?? 'unknown'),
            ]);
            return;
        }

        audit_log_event('whatsapp_openclaw.checkout_expired', [
            'sessionId' => (string) ($session['id'] ?? ''),
        ]);
    }

public static function isWhatsappOpenclawSession(array $session): bool
    {
        $metadata = isset($session['metadata']) && is_array($session['metadata']) ? $session['metadata'] : [];
        return strtolower(trim((string) ($metadata['source'] ?? ''))) === 'whatsapp_openclaw';
    }

}
