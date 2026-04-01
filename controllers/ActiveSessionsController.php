<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/ApiKernel.php';
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/SessionTracker.php';

class ActiveSessionsController
{
    public static function process(array $context): void
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        if (!in_array($method, ['GET', 'DELETE'])) {
            json_response(['ok' => false, 'error' => 'Metodo no soportado'], 405);
        }

        if (!legacy_admin_is_authenticated() && !operator_auth_is_authenticated()) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        // Obtener email del usuario activo
        $email = '';
        if (function_exists('operator_auth_current_identity')) {
            $identity = operator_auth_current_identity(false);
            if (is_array($identity) && isset($identity['email'])) {
                $email = (string)$identity['email'];
            }
        }
        if ($email === '' && isset($_SESSION['admin_email'])) {
            $email = (string)$_SESSION['admin_email'];
        }

        if ($email === '') {
            json_response(['ok' => false, 'error' => 'No se pudo identificar la cuenta'], 400);
        }

        if ($method === 'DELETE') {
            SessionTracker::revokeOtherSessions($email, session_id());
            json_response(['ok' => true]);
        }

        $sessions = SessionTracker::getActiveSessions($email);

        json_response([
            'ok' => true,
            'sessions' => $sessions
        ]);
    }
}
