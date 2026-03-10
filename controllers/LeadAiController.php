<?php

declare(strict_types=1);

class LeadAiController
{
    public static function request(array $context): void
    {
        $store = $context['store'];
        $payload = require_json_body();
        $callbackId = isset($payload['callbackId']) ? (int) $payload['callbackId'] : (int) ($payload['id'] ?? 0);
        $objective = (string) ($payload['objective'] ?? '');

        if ($callbackId <= 0) {
            json_response(['ok' => false, 'error' => 'Callback inválido'], 400);
        }
        if (!in_array($objective, LeadOpsService::allowedObjectives(), true)) {
            json_response(['ok' => false, 'error' => 'Objetivo IA inválido'], 400);
        }

        $updated = null;
        foreach ($store['callbacks'] as &$callback) {
            if ((int) ($callback['id'] ?? 0) !== $callbackId) {
                continue;
            }

            $callback['leadOps'] = LeadOpsService::requestLeadAi($callback, $objective, $store);
            $updated = LeadOpsService::enrichCallback($callback, $store);
            break;
        }
        unset($callback);

        if ($updated === null) {
            json_response(['ok' => false, 'error' => 'Callback no encontrado'], 404);
        }

        write_store($store);
        json_response(['ok' => true, 'data' => $updated], 202);
    }

    public static function queue(array $context): void
    {
        self::requireMachineToken();
        $store = $context['store'];
        LeadOpsService::touchWorkerHeartbeat('queue_poll');
        json_response([
            'ok' => true,
            'data' => LeadOpsService::buildQueuePayload($store['callbacks'] ?? [], $store),
        ]);
    }

    public static function result(array $context): void
    {
        self::requireMachineToken();
        $store = $context['store'];
        $payload = require_json_body();
        $callbackId = isset($payload['callbackId']) ? (int) $payload['callbackId'] : 0;

        if ($callbackId <= 0) {
            json_response(['ok' => false, 'error' => 'callbackId inválido'], 400);
        }

        $updated = null;
        foreach ($store['callbacks'] as &$callback) {
            if ((int) ($callback['id'] ?? 0) !== $callbackId) {
                continue;
            }

            $callback['leadOps'] = LeadOpsService::applyAiResult($callback, [
                'objective' => $payload['objective'] ?? '',
                'status' => $payload['status'] ?? 'completed',
                'summary' => $payload['summary'] ?? '',
                'draft' => $payload['draft'] ?? '',
                'provider' => $payload['provider'] ?? 'openclaw',
            ], $store);
            $updated = LeadOpsService::enrichCallback($callback, $store);
            break;
        }
        unset($callback);

        if ($updated === null) {
            LeadOpsService::touchWorkerHeartbeat('result_error', ['message' => 'callback_not_found']);
            json_response(['ok' => false, 'error' => 'Callback no encontrado'], 404);
        }

        write_store($store);
        $status = (string) ($updated['leadOps']['aiStatus'] ?? 'completed');
        LeadOpsService::touchWorkerHeartbeat($status === 'failed' ? 'result_error' : 'result_ok', [
            'message' => (string) ($payload['error'] ?? ''),
        ]);

        json_response([
            'ok' => true,
            'data' => [
                'callbackId' => $callbackId,
                'aiStatus' => $status,
                'completedAt' => (string) ($updated['leadOps']['completedAt'] ?? ''),
            ],
        ]);
    }

    private static function requireMachineToken(): void
    {
        $expected = trim((string) getenv('PIELARMONIA_LEADOPS_MACHINE_TOKEN'));
        if ($expected === '') {
            json_response(['ok' => false, 'error' => 'LeadOps machine token no configurado'], 503);
        }

        $headerName = trim((string) getenv('PIELARMONIA_LEADOPS_MACHINE_TOKEN_HEADER'));
        if ($headerName === '') {
            $headerName = 'Authorization';
        }
        $prefix = trim((string) getenv('PIELARMONIA_LEADOPS_MACHINE_TOKEN_PREFIX'));
        if ($prefix === '') {
            $prefix = 'Bearer';
        }

        $received = self::resolveHeaderValue($headerName);
        if ($received === '' && strcasecmp($headerName, 'Authorization') !== 0) {
            $received = self::resolveHeaderValue('Authorization');
        }

        $normalized = trim($received);
        if ($normalized !== '' && preg_match('/^' . preg_quote($prefix, '/') . '\s+(.+)$/i', $normalized, $matches) === 1) {
            $normalized = trim((string) ($matches[1] ?? ''));
        }

        if (!hash_equals($expected, $normalized)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }
    }

    private static function resolveHeaderValue(string $headerName): string
    {
        $normalized = strtoupper(str_replace('-', '_', $headerName));
        if ($normalized === 'AUTHORIZATION') {
            return trim((string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['Authorization'] ?? ''));
        }

        $serverKey = 'HTTP_' . $normalized;
        return trim((string) ($_SERVER[$serverKey] ?? ''));
    }
}
