<?php

declare(strict_types=1);

final class OpenclawSanitizationService
{
public static function sanitizeConversation(array $conversation): array
    {
        return [
            'id' => (string) ($conversation['id'] ?? ''),
            'phone' => (string) ($conversation['phone'] ?? ''),
            'status' => (string) ($conversation['status'] ?? 'active'),
            'lastIntent' => (string) ($conversation['lastIntent'] ?? ''),
            'updatedAt' => (string) ($conversation['updatedAt'] ?? ''),
            'outboundPending' => (int) ($conversation['outboundPending'] ?? 0),
            'messageCount' => (int) ($conversation['messageCount'] ?? 0),
        ];
    }

public static function sanitizeDraft(array $draft): array
    {
        return [
            'id' => (string) ($draft['id'] ?? ''),
            'conversationId' => (string) ($draft['conversationId'] ?? ''),
            'phone' => (string) ($draft['phone'] ?? ''),
            'service' => (string) ($draft['service'] ?? ''),
            'doctor' => (string) ($draft['doctor'] ?? ''),
            'date' => (string) ($draft['date'] ?? ''),
            'time' => (string) ($draft['time'] ?? ''),
            'name' => (string) ($draft['name'] ?? ''),
            'email' => (string) ($draft['email'] ?? ''),
            'status' => (string) ($draft['status'] ?? ''),
            'createdAt' => (string) ($draft['createdAt'] ?? ''),
            'updatedAt' => (string) ($draft['updatedAt'] ?? ''),
            'holdId' => (string) ($draft['holdId'] ?? ''),
            'holdStatus' => (string) ($draft['holdStatus'] ?? ''),
            'holdExpiresAt' => (string) ($draft['holdExpiresAt'] ?? ''),
            'appointmentId' => (int) ($draft['appointmentId'] ?? 0),
            'paymentMethod' => (string) ($draft['paymentMethod'] ?? ''),
            'paymentStatus' => (string) ($draft['paymentStatus'] ?? ''),
            'paymentSessionId' => (string) ($draft['paymentSessionId'] ?? ''),
            'paymentSessionUrl' => (string) ($draft['paymentSessionUrl'] ?? ''),
            'paymentIntentId' => (string) ($draft['paymentIntentId'] ?? ''),
        ];
    }

public static function sanitizeHold(array $hold): array
    {
        return [
            'id' => (string) ($hold['id'] ?? ''),
            'conversationId' => (string) ($hold['conversationId'] ?? ''),
            'phone' => (string) ($hold['phone'] ?? ''),
            'service' => (string) ($hold['service'] ?? ''),
            'doctor' => (string) ($hold['doctor'] ?? ''),
            'doctorRequested' => (string) ($hold['doctorRequested'] ?? ''),
            'date' => (string) ($hold['date'] ?? ''),
            'time' => (string) ($hold['time'] ?? ''),
            'paymentMethod' => (string) ($hold['paymentMethod'] ?? ''),
            'status' => (string) ($hold['status'] ?? ''),
            'appointmentId' => (int) ($hold['appointmentId'] ?? 0),
            'ttlSeconds' => (int) ($hold['ttlSeconds'] ?? 0),
            'expiresAt' => (string) ($hold['expiresAt'] ?? ''),
            'createdAt' => (string) ($hold['createdAt'] ?? ''),
            'updatedAt' => (string) ($hold['updatedAt'] ?? ''),
            'releasedAt' => (string) ($hold['releasedAt'] ?? ''),
            'releaseReason' => (string) ($hold['releaseReason'] ?? ''),
            'consumedAt' => (string) ($hold['consumedAt'] ?? ''),
            'expiredAt' => (string) ($hold['expiredAt'] ?? ''),
        ];
    }

public static function sanitizePlan(array $plan): array
    {
        return [
            'intent' => (string) ($plan['intent'] ?? ''),
            'source' => (string) ($plan['source'] ?? ''),
            'reply' => (string) ($plan['reply'] ?? ''),
        ];
    }

public static function sanitizeOutboxRecord(array $record): array
    {
        return [
            'id' => (string) ($record['id'] ?? ''),
            'conversationId' => (string) ($record['conversationId'] ?? ''),
            'phone' => (string) ($record['phone'] ?? ''),
            'type' => (string) ($record['type'] ?? 'text'),
            'text' => (string) ($record['text'] ?? ''),
            'status' => (string) ($record['status'] ?? 'pending'),
            'createdAt' => (string) ($record['createdAt'] ?? ''),
            'updatedAt' => (string) ($record['updatedAt'] ?? ''),
            'providerMessageId' => (string) ($record['providerMessageId'] ?? ''),
            'error' => (string) ($record['error'] ?? ''),
            'requeueCount' => (int) ($record['requeueCount'] ?? 0),
            'requeuedAt' => (string) ($record['requeuedAt'] ?? ''),
            'meta' => isset($record['meta']) && is_array($record['meta']) ? $record['meta'] : [],
        ];
    }

public static function normalizeInboundPayload(array $payload): array
    {
        $phoneCandidates = [
            $payload['phone'] ?? null,
            $payload['from'] ?? null,
            $payload['senderPhone'] ?? null,
            is_array($payload['sender'] ?? null) ? ($payload['sender']['phone'] ?? null) : null,
            is_array($payload['contact'] ?? null) ? ($payload['contact']['phone'] ?? null) : null,
        ];
        $phone = '';
        foreach ($phoneCandidates as $candidate) {
            $normalized = whatsapp_openclaw_normalize_phone((string) $candidate);
            if ($normalized !== '') {
                $phone = $normalized;
                break;
            }
        }

        $textCandidates = [
            $payload['text'] ?? null,
            $payload['body'] ?? null,
            $payload['messageText'] ?? null,
            is_array($payload['message'] ?? null) ? ($payload['message']['text'] ?? $payload['message']['body'] ?? null) : null,
        ];
        $text = '';
        foreach ($textCandidates as $candidate) {
            $candidateText = trim((string) $candidate);
            if ($candidateText !== '') {
                $text = $candidateText;
                break;
            }
        }

        $media = [];
        $rawMedia = $payload['media'] ?? $payload['attachments'] ?? [];
        if (is_array($rawMedia)) {
            foreach ($rawMedia as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $media[] = [
                    'id' => trim((string) ($item['id'] ?? $item['providerMediaId'] ?? '')),
                    'url' => trim((string) ($item['url'] ?? $item['href'] ?? '')),
                    'mime' => trim((string) ($item['mime'] ?? $item['contentType'] ?? '')),
                    'name' => trim((string) ($item['name'] ?? $item['filename'] ?? '')),
                ];
            }
        }

        if ($phone === '') {
            return ['ok' => false, 'error' => 'phone es obligatorio', 'status' => 400];
        }
        if ($text === '' && $media === []) {
            return ['ok' => false, 'error' => 'Debes enviar texto o adjuntos', 'status' => 400];
        }

        $conversationId = trim((string) ($payload['conversationId'] ?? $payload['chatId'] ?? $payload['threadId'] ?? ''));
        if ($conversationId === '') {
            $conversationId = 'wa:' . $phone;
        }

        return [
            'ok' => true,
            'data' => [
                'eventId' => trim((string) ($payload['eventId'] ?? $payload['id'] ?? '')),
                'providerMessageId' => trim((string) ($payload['providerMessageId'] ?? $payload['messageId'] ?? $payload['wamid'] ?? (is_array($payload['message'] ?? null) ? ($payload['message']['id'] ?? '') : ''))),
                'conversationId' => $conversationId,
                'phone' => $phone,
                'text' => $text,
                'profileName' => trim((string) ($payload['profileName'] ?? $payload['senderName'] ?? $payload['name'] ?? '')),
                'receivedAt' => trim((string) ($payload['receivedAt'] ?? $payload['timestamp'] ?? local_date('c'))),
                'media' => $media,
            ],
        ];
    }

}
