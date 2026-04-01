<?php
/**
 * controllers/ActiveSessionsController.php — S28-07
 * Aurora Derm — Sesiones concurrentes de admin
 *
 * GET  active-sessions  → lista de sesiones activas por email de admin
 * DELETE active-sessions → cierra todas las sesiones excepto la actual
 */

declare(strict_types=1);

class ActiveSessionsController
{
    /**
     * Tanto GET como DELETE se enrutan aquí (el método HTTP diferencia la acción).
     */
    public static function process(array $context): void
    {
        self::requireAdminAuth($context);

        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

        if ($method === 'DELETE') {
            self::revokeOtherSessions($context);
        } else {
            self::listSessions($context);
        }
    }

    // ── GET: listar sesiones activas ─────────────────────────────────────────

    private static function listSessions(array $context): void
    {
        $store    = read_store();
        $myEmail  = $context['adminEmail'] ?? $_SESSION['admin_email'] ?? '';
        $myToken  = self::currentToken();

        $sessions = $store['admin_sessions'] ?? [];
        $active   = [];
        $now      = time();

        foreach ($sessions as $token => $sess) {
            if (trim((string) ($sess['email'] ?? '')) !== $myEmail) {
                continue;
            }

            // Considerar activa si lastActive fue hace menos de 8h
            $lastActive = (int) ($sess['lastActive'] ?? $sess['created_at'] ?? 0);
            if (($now - $lastActive) > 8 * 3600) {
                continue; // sesión expirada no la mostramos
            }

            $active[] = [
                'token_hint'  => substr((string) $token, 0, 8) . '...',
                'ip'          => $sess['ip'] ?? '?',
                'user_agent'  => $sess['userAgent'] ?? $sess['user_agent'] ?? '',
                'started_at'  => $sess['created_at'] ?? '',
                'last_active' => isset($sess['lastActive']) ? gmdate('c', (int) $sess['lastActive']) : '',
                'is_current'  => ($token === $myToken),
            ];
        }

        $hasOtherSessions = count(array_filter($active, fn($s) => !$s['is_current'])) > 0;

        json_response([
            'ok'                  => true,
            'sessions'            => $active,
            'session_count'       => count($active),
            'has_other_sessions'  => $hasOtherSessions,
            'alert'               => $hasOtherSessions
                ? 'Tu cuenta tiene sesiones activas en ' . count($active) . ' dispositivo(s). ¿Eres tú?'
                : null,
        ]);
    }

    // ── DELETE: revocar todas las sesiones menos la actual ───────────────────

    private static function revokeOtherSessions(array $context): void
    {
        $myEmail  = $context['adminEmail'] ?? $_SESSION['admin_email'] ?? '';
        $myToken  = self::currentToken();
        $revoked  = 0;

        $result = with_store_lock(static function () use ($myEmail, $myToken, &$revoked): array {
            $store    = read_store();
            $sessions = $store['admin_sessions'] ?? [];

            foreach ($sessions as $token => $sess) {
                if (trim((string) ($sess['email'] ?? '')) !== $myEmail) {
                    continue;
                }
                if ($token === $myToken) {
                    continue; // no tocar la sesión actual
                }
                unset($sessions[$token]);
                $revoked++;
            }

            $store['admin_sessions'] = $sessions;

            // Audit log
            $store['admin_audit_log'][] = [
                'event'      => 'sessions_revoked',
                'email'      => $myEmail,
                'revoked'    => $revoked,
                'from_ip'    => $_SERVER['REMOTE_ADDR'] ?? '',
                'occurred_at'=> gmdate('c'),
            ];

            return ['ok' => true, 'store' => $store, 'storeDirty' => true];
        });

        json_response([
            'ok'             => true,
            'revoked_count'  => $revoked,
            'message'        => $revoked > 0
                ? "Se cerraron {$revoked} sesión(es) en otros dispositivos."
                : 'No había otras sesiones activas.',
        ]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static function requireAdminAuth(array $context): void
    {
        if (!($context['isAdmin'] ?? false)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }
    }

    private static function currentToken(): string
    {
        // El token puede venir del header Authorization o del cookie de sesión
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (str_starts_with($header, 'Bearer ')) {
            return trim(substr($header, 7));
        }
        return $_SESSION['admin_token'] ?? '';
    }
}
