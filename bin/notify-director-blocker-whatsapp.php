#!/usr/bin/env php
<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/api-lib.php';
require_once dirname(__DIR__) . '/lib/whatsapp_openclaw/bootstrap.php';

function director_phone(): string
{
    $candidates = [
        getenv('AURORADERM_DIRECTOR_PHONE'),
        getenv('PIELARMONIA_DIRECTOR_PHONE'),
    ];

    foreach ($candidates as $candidate) {
        if (!is_string($candidate)) {
            continue;
        }
        $normalized = whatsapp_openclaw_normalize_phone($candidate);
        if ($normalized !== '') {
            return $normalized;
        }
    }

    return '';
}

function blocker_message(string $taskId, string $agent, string $reason): string
{
    $lines = [
        'Aurora Derm — agente bloqueado',
        'Tarea: ' . $taskId,
        'Agente: ' . $agent,
        'Razon: ' . $reason,
    ];

    return implode("\n", $lines);
}

$taskId = trim((string) ($argv[1] ?? ''));
$agent = trim((string) ($argv[2] ?? 'unknown'));
$reason = trim((string) ($argv[3] ?? ''));

if ($taskId === '' || $reason === '') {
    fwrite(STDOUT, json_encode([
        'ok' => false,
        'skipped' => true,
        'reason' => 'invalid_arguments',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(0);
}

$phone = director_phone();
if ($phone === '') {
    fwrite(STDOUT, json_encode([
        'ok' => false,
        'skipped' => true,
        'reason' => 'director_phone_missing',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(0);
}

try {
    $record = whatsapp_openclaw_repository()->enqueueOutbox([
        'conversationId' => 'wa:' . $phone,
        'phone' => $phone,
        'type' => 'text',
        'status' => 'pending',
        'text' => blocker_message($taskId, $agent, $reason),
        'meta' => [
            'source' => 'bin/stuck.js',
            'audience' => 'director',
            'taskId' => $taskId,
            'agent' => $agent,
            'reason' => $reason,
        ],
    ]);

    fwrite(STDOUT, json_encode([
        'ok' => true,
        'phone' => $phone,
        'outboxId' => (string) ($record['id'] ?? ''),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(0);
} catch (Throwable $e) {
    fwrite(STDOUT, json_encode([
        'ok' => false,
        'skipped' => false,
        'reason' => 'enqueue_failed',
        'error' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(1);
}
