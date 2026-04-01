<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/TurneroOperatorAccess.php';

class OperatorPinController
{
    private static function status(array $context = []): void
    {
        start_secure_session();
        json_response(turnero_operator_pin_status_payload());
    }

    private static function sessionStatus(array $context = []): void
    {
        start_secure_session();
        json_response(turnero_operator_session_status_payload());
    }

    private static function login(array $context = []): void
    {
        start_secure_session();
        $payload = require_json_body();
        $pin = (string) ($payload['pin'] ?? $payload['password'] ?? '');

        try {
            json_response(turnero_operator_login_payload($pin));
        } catch (\RuntimeException $th) {
            json_response([
                'ok' => false,
                'error' => $th->getMessage(),
                'status' => $th->getCode() === 503 ? 'operator_pin_not_configured' : 'invalid_pin',
                'mode' => TURNERO_OPERATOR_MODE,
                'recommendedMode' => TURNERO_OPERATOR_MODE,
                'configured' => turnero_operator_access_is_configured(),
                'turneroOperatorAccessMeta' => turnero_operator_access_meta(),
            ], $th->getCode() >= 400 ? $th->getCode() : 400);
        }
    }

    private static function logout(array $context = []): void
    {
        start_secure_session();
        json_response(turnero_operator_logout_payload());
    }

    private static function rotate(array $context = []): void
    {
        start_secure_session();
        if (($context['isAdmin'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => 'No autorizado',
            ], 401);
        }
        require_csrf();

        $payload = require_json_body();
        try {
            json_response(turnero_operator_access_rotate(is_array($payload) ? $payload : []));
        } catch (\RuntimeException $th) {
            json_response([
                'ok' => false,
                'error' => $th->getMessage(),
            ], $th->getCode() >= 400 ? $th->getCode() : 400);
        }
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:operator-pin-status':
                self::status($context);
                return;
            case 'GET:operator-session-status':
                self::sessionStatus($context);
                return;
            case 'POST:operator-pin-login':
                self::login($context);
                return;
            case 'POST:operator-pin-logout':
                self::logout($context);
                return;
            case 'POST:operator-pin-rotate':
                self::rotate($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'status':
                            self::status($context);
                            return;
                        case 'sessionStatus':
                            self::sessionStatus($context);
                            return;
                        case 'login':
                            self::login($context);
                            return;
                        case 'logout':
                            self::logout($context);
                            return;
                        case 'rotate':
                            self::rotate($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
