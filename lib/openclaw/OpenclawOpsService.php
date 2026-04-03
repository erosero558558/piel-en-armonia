<?php

declare(strict_types=1);

final class OpenclawOpsService
{
public static function ops(array $context): void
    {
        self::ensureEnabled();
        if (($context['isAdmin'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => 'No autorizado',
            ], 401);
        }

        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? ($context['method'] ?? 'GET')));
        if ($method === 'GET') {
            json_response([
                'ok' => true,
                'data' => self::buildOpsPayload(
                    isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store()
                ),
            ]);
        }

        if ($method !== 'POST') {
            json_response([
                'ok' => false,
                'error' => 'Metodo no permitido',
            ], 405);
        }

        require_csrf();
        $payload = require_json_body();
        $action = strtolower(trim((string) ($payload['action'] ?? '')));
        if ($action === '') {
            json_response([
                'ok' => false,
                'error' => 'action es obligatorio',
            ], 400);
        }

        $lock = with_store_lock(static function () use ($payload): array {
            $store = read_store();
            return self::handleOpsAction($store, $payload);
        });

        if (($lock['ok'] ?? false) !== true || !is_array($lock['result'] ?? null)) {
            json_response([
                'ok' => false,
                'error' => (string) ($lock['error'] ?? 'No se pudo bloquear el store'),
            ], (int) ($lock['code'] ?? 503));
        }

        $result = $lock['result'];
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo ejecutar la accion operativa'),
            ], (int) ($result['code'] ?? 500));
        }

        if (($result['storeDirty'] ?? false) === true) {
            $store = is_array($result['store'] ?? null) ? $result['store'] : read_store();
            if (!write_store($store, false)) {
                json_response([
                    'ok' => false,
                    'error' => 'No se pudo persistir el store despues de la operacion',
                ], 503);
            }
        }

        if (function_exists('audit_log_event')) {
            audit_log_event('whatsapp_openclaw.ops_action', [
                'action' => $action,
                'status' => (string) ($result['status'] ?? ''),
                'conversationId' => trim((string) ($payload['conversationId'] ?? '')),
                'holdId' => trim((string) ($payload['holdId'] ?? '')),
                'outboxId' => trim((string) ($payload['id'] ?? '')),
            ]);
        }

        whatsapp_openclaw_repository()->touchBridgeStatus('ops');
        json_response([
            'ok' => true,
            'action' => $action,
            'data' => self::sanitizeOpsActionResult($result),
        ]);
    }

public static function buildOpsPayload(array $store): array
    {
        $snapshot = whatsapp_openclaw_repository()->buildOpsSnapshot($store);
        $snapshot['conversations'] = array_map(
            [self::class, 'sanitizeConversation'],
            is_array($snapshot['conversations'] ?? null) ? $snapshot['conversations'] : []
        );
        $snapshot['pendingOutboxItems'] = array_map(
            [self::class, 'sanitizeOutboxRecord'],
            is_array($snapshot['pendingOutboxItems'] ?? null) ? $snapshot['pendingOutboxItems'] : []
        );
        $snapshot['failedOutboxItems'] = array_map(
            [self::class, 'sanitizeOutboxRecord'],
            is_array($snapshot['failedOutboxItems'] ?? null) ? $snapshot['failedOutboxItems'] : []
        );
        $snapshot['activeHolds'] = array_map(
            [self::class, 'sanitizeHold'],
            is_array($snapshot['activeHolds'] ?? null) ? $snapshot['activeHolds'] : []
        );
        $snapshot['recentHolds'] = array_map(
            [self::class, 'sanitizeHold'],
            is_array($snapshot['recentHolds'] ?? null) ? $snapshot['recentHolds'] : []
        );
        $snapshot['pendingCheckouts'] = array_map(
            [self::class, 'sanitizeDraft'],
            is_array($snapshot['pendingCheckouts'] ?? null) ? $snapshot['pendingCheckouts'] : []
        );
        return $snapshot;
    }

public static function handleOpsAction(array $store, array $payload): array
    {
        $action = strtolower(trim((string) ($payload['action'] ?? '')));
        if ($action === 'requeue_outbox') {
            return self::handleRequeueOutboxAction($store, $payload);
        }
        if ($action === 'expire_checkout') {
            return self::handleExpireCheckoutAction($store, $payload);
        }
        if ($action === 'release_hold') {
            return self::handleReleaseHoldAction($store, $payload);
        }
        if ($action === 'sweep_stale') {
            return self::handleSweepStaleAction($store, $payload);
        }
        if ($action === 'resolve_handoff') {
            return self::handleResolveHandoffAction($store, $payload);
        }

        return [
            'ok' => false,
            'error' => 'Accion ops no soportada',
            'code' => 400,
        ];
    }

public static function handleRequeueOutboxAction(array $store, array $payload): array
    {
        $id = trim((string) ($payload['id'] ?? ''));
        if ($id === '') {
            return ['ok' => false, 'error' => 'id es obligatorio', 'code' => 400];
        }

        $result = whatsapp_openclaw_repository()->requeueOutbox($id);
        if (($result['ok'] ?? false) !== true) {
            return $result;
        }

        return [
            'ok' => true,
            'store' => $store,
            'storeDirty' => false,
            'status' => (string) ($result['status'] ?? 'requeued'),
            'outbox' => is_array($result['data'] ?? null) ? $result['data'] : [],
        ];
    }

public static function handleExpireCheckoutAction(array $store, array $payload): array
    {
        $draft = self::resolveOpsDraft($payload);
        if ($draft === []) {
            return ['ok' => false, 'error' => 'Draft no encontrado', 'code' => 404];
        }

        return whatsapp_openclaw_orchestrator()->expireCheckoutForOps($store, $draft);
    }

public static function handleResolveHandoffAction(array $store, array $payload): array
    {
        $conversationId = trim((string) ($payload['conversationId'] ?? ''));
        if ($conversationId === '') {
            return ['ok' => false, 'error' => 'conversationId es obligatorio', 'code' => 400];
        }

        $conversation = whatsapp_openclaw_repository()->getConversation($conversationId, '');
        if (($conversation['status'] ?? '') !== 'human_followup') {
             return ['ok' => false, 'error' => 'El handoff ya no esta pendiente', 'code' => 409];
        }

        $conversation['status'] = 'active';
        $meta = is_array($conversation['meta'] ?? null) ? $conversation['meta'] : [];
        $meta['humanFollowUpResolvedAt'] = local_date('c');
        $conversation['meta'] = $meta;
        whatsapp_openclaw_repository()->saveConversation($conversation);

        return [
            'ok' => true,
            'store' => $store,
            'storeDirty' => false,
            'status' => 'resolved',
            'conversation' => $conversation,
        ];
    }

public static function handleReleaseHoldAction(array $store, array $payload): array
    {
        $holdId = trim((string) ($payload['holdId'] ?? ''));
        if ($holdId === '') {
            return ['ok' => false, 'error' => 'holdId es obligatorio', 'code' => 400];
        }

        $reason = trim((string) ($payload['reason'] ?? ''));
        if ($reason === '') {
            $reason = 'admin_release';
        }

        return whatsapp_openclaw_orchestrator()->releaseHoldForOps(
            $store,
            $holdId,
            $reason,
            self::parseBoolish($payload['notify'] ?? false)
        );
    }

public static function handleSweepStaleAction(array $store, array $payload): array
    {
        $limit = isset($payload['limit']) ? (int) $payload['limit'] : 25;
        $limit = max(1, min(100, $limit));

        $expiredHolds = whatsapp_openclaw_repository()->expireSlotHolds();
        $result = whatsapp_openclaw_orchestrator()->expireStaleCheckouts($store, $limit);
        if (($result['ok'] ?? false) !== true) {
            return $result;
        }

        $result['expiredHolds'] = $expiredHolds;
        return $result;
    }

public static function resolveOpsDraft(array $payload): array
    {
        $repository = whatsapp_openclaw_repository();

        $paymentSessionId = trim((string) ($payload['paymentSessionId'] ?? ''));
        if ($paymentSessionId !== '') {
            $draft = $repository->findBookingDraftByPaymentSessionId($paymentSessionId);
            if ($draft !== []) {
                return $draft;
            }
        }

        $holdId = trim((string) ($payload['holdId'] ?? ''));
        if ($holdId !== '') {
            $hold = $repository->getSlotHold($holdId);
            if ($hold !== []) {
                $matches = $repository->listBookingDrafts([
                    'conversationId' => (string) ($hold['conversationId'] ?? ''),
                ], 1);
                if ($matches !== []) {
                    return $matches[0];
                }
            }
        }

        $conversationId = trim((string) ($payload['conversationId'] ?? ''));
        if ($conversationId !== '') {
            $matches = $repository->listBookingDrafts(['conversationId' => $conversationId], 1);
            if ($matches !== []) {
                return $matches[0];
            }
        }

        $phone = whatsapp_openclaw_normalize_phone((string) ($payload['phone'] ?? ''));
        if ($phone !== '') {
            $matches = $repository->listBookingDrafts(['phone' => $phone], 1);
            if ($matches !== []) {
                return $matches[0];
            }
        }

        return [];
    }

public static function sanitizeOpsActionResult(array $result): array
    {
        return [
            'status' => (string) ($result['status'] ?? ''),
            'expiredCount' => (int) ($result['expiredCount'] ?? 0),
            'expiredHolds' => (int) ($result['expiredHolds'] ?? 0),
            'conversation' => is_array($result['conversation'] ?? null) ? WhatsappOpenclawController::sanitizeConversation($result['conversation']) : [],
            'draft' => is_array($result['draft'] ?? null) ? WhatsappOpenclawController::sanitizeDraft($result['draft']) : [],
            'hold' => is_array($result['hold'] ?? null) ? WhatsappOpenclawController::sanitizeHold($result['hold']) : [],
            'outbox' => is_array($result['outbox'] ?? null) ? WhatsappOpenclawController::sanitizeOutboxRecord($result['outbox']) : [],
            'queuedOutbox' => array_map(
                [self::class, 'sanitizeOutboxRecord'],
                is_array($result['queuedOutbox'] ?? null) ? $result['queuedOutbox'] : []
            ),
            'items' => array_map(
                [self::class, 'sanitizeOpsSweepItem'],
                is_array($result['items'] ?? null) ? $result['items'] : []
            ),
        ];
    }

public static function sanitizeOpsSweepItem(array $item): array
    {
        return [
            'status' => (string) ($item['status'] ?? ''),
            'holdStatus' => (string) ($item['holdStatus'] ?? ''),
            'conversation' => WhatsappOpenclawController::sanitizeConversation(is_array($item['conversation'] ?? null) ? $item['conversation'] : []),
            'draft' => WhatsappOpenclawController::sanitizeDraft(is_array($item['draft'] ?? null) ? $item['draft'] : []),
            'queuedOutbox' => array_map(
                [self::class, 'sanitizeOutboxRecord'],
                is_array($item['queuedOutbox'] ?? null) ? $item['queuedOutbox'] : []
            ),
        ];
    }

public static function parseBoolish($value): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        if (is_int($value) || is_float($value)) {
            return (int) $value !== 0;
        }
        if (is_string($value)) {
            return in_array(strtolower(trim($value)), ['1', 'true', 'yes', 'on'], true);
        }
        return false;
    }

public static function ensureEnabled(): void
    {
        if (!WhatsappOpenclawConfig::isEnabled()) {
            json_response([
                'ok' => false,
                'error' => 'WhatsApp OpenClaw no esta habilitado',
            ], 503);
        }
    }

    /**
     * @param array<string,mixed> $payload
     * @return array{ok:bool,data?:array<string,mixed>,error?:string,status?:int}
     */

}
