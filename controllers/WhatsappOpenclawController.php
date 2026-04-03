<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/openclaw/OpenclawOpsService.php';
require_once __DIR__ . '/../lib/openclaw/OpenclawSanitizationService.php';


require_once __DIR__ . '/../lib/whatsapp_openclaw/bootstrap.php';

final class WhatsappOpenclawController
{
    public static function inbound(array $context): void
    {
        OpenclawOpsService::ensureEnabled();
        WhatsappOpenclawConfig::assertMachineToken();

        $payload = require_json_body();
        $event = OpenclawSanitizationService::normalizeInboundPayload($payload);
        if (($event['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($event['error'] ?? 'Payload inbound invalido'),
                'code' => 'whatsapp_openclaw_bad_request',
            ], (int) ($event['status'] ?? 400));
        }

        $lock = with_store_lock(static function () use ($event): array {
            $store = read_store();
            $result = whatsapp_openclaw_orchestrator()->handleInbound($store, $event['data']);
            if (($result['ok'] ?? false) !== true) {
                return $result;
            }

            if (($result['storeDirty'] ?? false) === true) {
                if (!write_store(is_array($result['store'] ?? null) ? $result['store'] : $store, false)) {
                    return [
                        'ok' => false,
                        'error' => 'No se pudo persistir el estado de WhatsApp OpenClaw',
                        'code' => 503,
                    ];
                }
            }

            return $result;
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
                'error' => (string) ($result['error'] ?? 'No se pudo procesar el inbound'),
            ], (int) ($result['code'] ?? 500));
        }

        $status = (string) ($result['status'] ?? 'processed');
        json_response([
            'ok' => true,
            'status' => $status,
            'data' => [
                'conversation' => OpenclawSanitizationService::sanitizeConversation(is_array($result['conversation'] ?? null) ? $result['conversation'] : []),
                'draft' => OpenclawSanitizationService::sanitizeDraft(is_array($result['draft'] ?? null) ? $result['draft'] : []),
                'plan' => OpenclawSanitizationService::sanitizePlan(is_array($result['plan'] ?? null) ? $result['plan'] : []),
                'actions' => array_values(array_filter(is_array($result['actions'] ?? null) ? $result['actions'] : [])),
                'queuedOutbox' => array_map([self::class, 'sanitizeOutboxRecord'], is_array($result['queuedOutbox'] ?? null) ? $result['queuedOutbox'] : []),
            ],
        ], $status === 'duplicate' ? 200 : 202);
    }

    public static function outbox(array $context): void
    {
        OpenclawOpsService::ensureEnabled();
        WhatsappOpenclawConfig::assertMachineToken();

        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 20;
        if ($limit < 1) {
            $limit = 1;
        }
        if ($limit > 100) {
            $limit = 100;
        }

        $repository = whatsapp_openclaw_repository();
        $repository->touchBridgeStatus('outbox_poll');
        $items = $repository->listPendingOutbox($limit);

        json_response([
            'ok' => true,
            'data' => [
                'items' => array_map([self::class, 'sanitizeOutboxRecord'], $items),
                'count' => count($items),
            ],
        ]);
    }

    public static function ack(array $context): void
    {
        OpenclawOpsService::ensureEnabled();
        WhatsappOpenclawConfig::assertMachineToken();

        $payload = require_json_body();
        $result = whatsapp_openclaw_repository()->acknowledgeOutbox($payload);
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo registrar el ack'),
            ], (int) ($result['code'] ?? 400));
        }

        $record = is_array($result['data'] ?? null) ? $result['data'] : [];
        self::syncConversationAfterAck($record);
        if (($record['status'] ?? '') === 'failed') {
            whatsapp_openclaw_repository()->touchBridgeStatus('error', [
                'message' => (string) ($record['error'] ?? 'delivery_failed'),
            ]);
        } else {
            whatsapp_openclaw_repository()->touchBridgeStatus('ack');
        }

        json_response([
            'ok' => true,
            'data' => OpenclawSanitizationService::sanitizeOutboxRecord($record),
        ]);
    }

    public static function ops(...$args)
    {
        return OpenclawOpsService::ops(...$args);
    }

    public static function buildOpsPayload(...$args)
    {
        return OpenclawOpsService::buildOpsPayload(...$args);
    }

    public static function handleOpsAction(...$args)
    {
        return OpenclawOpsService::handleOpsAction(...$args);
    }

    public static function handleRequeueOutboxAction(...$args)
    {
        return OpenclawOpsService::handleRequeueOutboxAction(...$args);
    }

    public static function handleExpireCheckoutAction(...$args)
    {
        return OpenclawOpsService::handleExpireCheckoutAction(...$args);
    }

    public static function handleResolveHandoffAction(...$args)
    {
        return OpenclawOpsService::handleResolveHandoffAction(...$args);
    }

    public static function handleReleaseHoldAction(...$args)
    {
        return OpenclawOpsService::handleReleaseHoldAction(...$args);
    }

    public static function handleSweepStaleAction(...$args)
    {
        return OpenclawOpsService::handleSweepStaleAction(...$args);
    }

    public static function resolveOpsDraft(...$args)
    {
        return OpenclawOpsService::resolveOpsDraft(...$args);
    }

    public static function sanitizeOpsActionResult(...$args)
    {
        return OpenclawOpsService::sanitizeOpsActionResult(...$args);
    }

    public static function sanitizeOpsSweepItem(...$args)
    {
        return OpenclawOpsService::sanitizeOpsSweepItem(...$args);
    }

    public static function parseBoolish(...$args)
    {
        return OpenclawOpsService::parseBoolish(...$args);
    }

    public static function ensureEnabled()
    {
        return OpenclawOpsService::ensureEnabled();
    }

    public static function normalizeInboundPayload(...$args)
    {
        return OpenclawSanitizationService::normalizeInboundPayload(...$args);
    }

    public static function syncConversationAfterAck(array $record): void
    {
        $conversationId = trim((string) ($record['conversationId'] ?? ''));
        $phone = whatsapp_openclaw_normalize_phone((string) ($record['phone'] ?? ''));
        if ($conversationId === '' && $phone === '') {
            return;
        }

        $repository = whatsapp_openclaw_repository();
        $conversation = $repository->getConversation($conversationId, $phone);
        $conversation['outboundPending'] = max(0, (int) ($conversation['outboundPending'] ?? 0) - 1);
        if (($record['status'] ?? '') === 'acked') {
            $conversation['lastOutboundAt'] = local_date('c');
            $conversation['lastMessageAt'] = $conversation['lastOutboundAt'];
        }
        $repository->saveConversation($conversation);
    }

    public static function sanitizeConversation(...$args)
    {
        return OpenclawSanitizationService::sanitizeConversation(...$args);
    }

    public static function sanitizeDraft(...$args)
    {
        return OpenclawSanitizationService::sanitizeDraft(...$args);
    }

    public static function sanitizeHold(...$args)
    {
        return OpenclawSanitizationService::sanitizeHold(...$args);
    }

    public static function sanitizePlan(...$args)
    {
        return OpenclawSanitizationService::sanitizePlan(...$args);
    }

    public static function sanitizeOutboxRecord(...$args)
    {
        return OpenclawSanitizationService::sanitizeOutboxRecord(...$args);
    }

    public static function metrics(array $context): void
    {
        OpenclawOpsService::ensureEnabled();
        if (($context['isAdmin'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => 'No autorizado',
            ], 401);
        }

        $store = is_array($context['store'] ?? null) ? $context['store'] : read_store();
        $snapshot = whatsapp_openclaw_repository()->buildOpsSnapshot($store);
        
        $conversationsTotal = is_array($snapshot['conversations'] ?? null) ? count($snapshot['conversations']) : 0;
        $holdsActive = is_array($snapshot['activeHolds'] ?? null) ? count($snapshot['activeHolds']) : 0;
        
        // Handoff is a state that requires human assistance.
        $handoffPending = 0;
        if (is_array($snapshot['conversations'] ?? null)) {
            foreach ($snapshot['conversations'] as $conv) {
                if (($conv['requiresHuman'] ?? false) === true) {
                    $handoffPending++;
                }
            }
        }
        
        $outboxFailed = is_array($snapshot['failedOutboxItems'] ?? null) ? count($snapshot['failedOutboxItems']) : 0;
        
        // Dummy conversion rate for now (could be derived from funnel data)
        $conversionRate = 0.0;
        $funnelFile = getenv('AURORADERM_DATA_DIR') . '/funnel/whatsapp-openclaw-latest.json';
        if (file_exists($funnelFile)) {
            $funnelData = json_decode(file_get_contents($funnelFile), true);
            if (is_array($funnelData) && isset($funnelData['appointment_created'], $funnelData['inbound']) && $funnelData['inbound'] > 0) {
                $conversionRate = round(($funnelData['appointment_created'] / $funnelData['inbound']) * 100, 2);
            }
        }

        json_response([
            'conversations_total' => $conversationsTotal,
            'holds_active' => $holdsActive,
            'handoff_pending' => $handoffPending,
            'outbox_failed' => $outboxFailed,
            'conversion_rate' => $conversionRate,
        ]);
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'POST:whatsapp-openclaw-inbound':
                self::inbound($context);
                return;
            case 'GET:whatsapp-openclaw-outbox':
                self::outbox($context);
                return;
            case 'POST:whatsapp-openclaw-ack':
                self::ack($context);
                return;
            case 'GET:whatsapp-openclaw-ops':
                OpenclawOpsService::ops($context);
                return;
            case 'POST:whatsapp-openclaw-ops':
                OpenclawOpsService::ops($context);
                return;
            case 'GET:whatsapp-openclaw-metrics':
                self::metrics($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'inbound':
                            self::inbound($context);
                            return;
                        case 'outbox':
                            self::outbox($context);
                            return;
                        case 'ack':
                            self::ack($context);
                            return;
                        case 'ops':
                            OpenclawOpsService::ops($context);
                            return;
                        case 'ops':
                            OpenclawOpsService::ops($context);
                            return;
                        case 'metrics':
                            self::metrics($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
