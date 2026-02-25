<?php

declare(strict_types=1);

namespace Governance;

class Parsers
{
    public static function parseInlineArray(string $value): array
    {
        $trimmed = trim($value);
        if ($trimmed === '[]' || $trimmed === '') {
            return [];
        }
        if ($trimmed[0] !== '[' || substr($trimmed, -1) !== ']') {
            return [trim($trimmed, "\"' ")];
        }

        $inner = trim(substr($trimmed, 1, -1));
        if ($inner === '') {
            return [];
        }

        $parts = str_getcsv($inner, ',', '"', '\\');
        $out = [];
        foreach ($parts as $part) {
            $clean = trim($part, " \t\n\r\0\x0B\"'");
            if ($clean !== '') {
                $out[] = $clean;
            }
        }

        return $out;
    }

    public static function parseScalar(string $raw)
    {
        $value = trim($raw);
        if ($value === '') {
            return '';
        }
        if ($value === 'true') {
            return true;
        }
        if ($value === 'false') {
            return false;
        }
        if ($value === '[]') {
            return [];
        }
        if ($value[0] === '[' && substr($value, -1) === ']') {
            return self::parseInlineArray($value);
        }
        if ($value[0] === '"' && substr($value, -1) === '"') {
            return str_replace('\"', '"', substr($value, 1, -1));
        }

        return $value;
    }

    public static function parseBooleanLike($value, bool $fallback = false): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        $raw = strtolower(trim((string) $value));
        if ($raw === '') {
            return $fallback;
        }
        if (in_array($raw, ['true', '1', 'yes', 'y', 'si', 's', 'on'], true)) {
            return true;
        }
        if (in_array($raw, ['false', '0', 'no', 'n', 'off'], true)) {
            return false;
        }
        return $fallback;
    }

    /**
     * @return array{version:mixed, policy:array<string,mixed>, tasks:array<int,array<string,mixed>>}
     */
    public static function parseBoardYaml(string $content): array
    {
        $lines = explode("\n", $content);
        $board = [
            'version' => 1,
            'policy' => [],
            'tasks' => [],
        ];

        $inPolicy = false;
        $inTasks = false;
        $task = null;

        foreach ($lines as $lineRaw) {
            $line = str_replace("\t", '    ', $lineRaw);
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }

            if ($trimmed === 'policy:') {
                $inPolicy = true;
                $inTasks = false;
                continue;
            }

            if ($trimmed === 'tasks:') {
                $inPolicy = false;
                $inTasks = true;
                if (is_array($task)) {
                    $board['tasks'][] = $task;
                    $task = null;
                }
                continue;
            }

            if (!$inPolicy && !$inTasks && preg_match('/^version:\s*(.+)$/', $line, $m) === 1) {
                $board['version'] = self::parseScalar((string) $m[1]);
                continue;
            }

            if ($inPolicy && preg_match('/^\s{2}([a-zA-Z_][\w-]*):\s*(.*)$/', $line, $m) === 1) {
                $board['policy'][(string) $m[1]] = self::parseScalar((string) $m[2]);
                continue;
            }

            if ($inTasks && preg_match('/^\s{2}-\s+id:\s*(.+)$/', $line, $m) === 1) {
                if (is_array($task)) {
                    $board['tasks'][] = $task;
                }
                $task = ['id' => self::parseScalar((string) $m[1])];
                continue;
            }

            if (
                $inTasks &&
                is_array($task) &&
                preg_match('/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/', $line, $m) === 1
            ) {
                $task[(string) $m[1]] = self::parseScalar((string) $m[2]);
            }
        }

        if (is_array($task)) {
            $board['tasks'][] = $task;
        }

        return $board;
    }

    /**
     * @return array<int,array<string,string>>
     */
    public static function parseTaskBlocks(string $content): array
    {
        $tasks = [];
        if (
            preg_match_all('/<!-- TASK\n([\s\S]*?)-->([\s\S]*?)<!-- \/TASK -->/m', $content, $matches, PREG_SET_ORDER) !== 1 &&
            empty($matches)
        ) {
            return $tasks;
        }

        foreach ($matches as $match) {
            $meta = [];
            $metaBlock = $match[1] ?? '';
            foreach (explode("\n", (string) $metaBlock) as $line) {
                if (preg_match('/^([\w-]+):\s*(.*)$/', trim($line), $m) === 1) {
                    $meta[(string) $m[1]] = (string) $m[2];
                }
            }
            if (!empty($meta)) {
                $taskId = trim((string) ($meta['task_id'] ?? ''));
                if ($taskId === '' || preg_match('/^AG-\d+$/', $taskId) !== 1) {
                    continue;
                }
                $tasks[] = $meta;
            }
        }

        return $tasks;
    }

    /**
     * @return array{version:mixed, handoffs:array<int,array<string,mixed>>}
     */
    public static function parseHandoffsYaml(string $content): array
    {
        $lines = explode("\n", $content);
        $data = [
            'version' => 1,
            'handoffs' => [],
        ];
        $inHandoffs = false;
        $handoff = null;

        foreach ($lines as $lineRaw) {
            $line = str_replace("\t", '    ', $lineRaw);
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }

            if (!$inHandoffs && preg_match('/^version:\s*(.+)$/', $line, $m) === 1) {
                $data['version'] = self::parseScalar((string) $m[1]);
                continue;
            }

            if ($trimmed === 'handoffs:') {
                $inHandoffs = true;
                if (is_array($handoff)) {
                    $data['handoffs'][] = $handoff;
                    $handoff = null;
                }
                continue;
            }

            if (!$inHandoffs) {
                continue;
            }

            if (preg_match('/^\s{2}-\s+id:\s*(.+)$/', $line, $m) === 1) {
                if (is_array($handoff)) {
                    $data['handoffs'][] = $handoff;
                }
                $handoff = ['id' => self::parseScalar((string) $m[1])];
                continue;
            }

            if (
                is_array($handoff) &&
                preg_match('/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/', $line, $m) === 1
            ) {
                $handoff[(string) $m[1]] = self::parseScalar((string) $m[2]);
            }
        }

        if (is_array($handoff)) {
            $data['handoffs'][] = $handoff;
        }

        foreach ($data['handoffs'] as &$item) {
            if (!is_array($item['files'] ?? null)) {
                $item['files'] = isset($item['files']) ? [(string) $item['files']] : [];
            }
            $item['status'] = strtolower(trim((string) ($item['status'] ?? '')));
        }
        unset($item);

        return $data;
    }

    /**
     * @return array{version:mixed, updated_at:mixed, signals:array<int,array<string,mixed>>}
     */
    public static function parseSignalsYaml(string $content): array
    {
        $lines = explode("\n", $content);
        $data = [
            'version' => 1,
            'updated_at' => '',
            'signals' => [],
        ];
        $inSignals = false;
        $signal = null;

        foreach ($lines as $lineRaw) {
            $line = str_replace("\t", '    ', $lineRaw);
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }

            if (!$inSignals && preg_match('/^version:\s*(.+)$/', $line, $m) === 1) {
                $data['version'] = self::parseScalar((string) $m[1]);
                continue;
            }

            if (!$inSignals && preg_match('/^updated_at:\s*(.+)$/', $line, $m) === 1) {
                $data['updated_at'] = self::parseScalar((string) $m[1]);
                continue;
            }

            if ($trimmed === 'signals:') {
                $inSignals = true;
                if (is_array($signal)) {
                    $data['signals'][] = $signal;
                    $signal = null;
                }
                continue;
            }

            if (!$inSignals) {
                continue;
            }

            if (preg_match('/^\s{2}-\s+id:\s*(.+)$/', $line, $m) === 1) {
                if (is_array($signal)) {
                    $data['signals'][] = $signal;
                }
                $signal = ['id' => self::parseScalar((string) $m[1])];
                continue;
            }

            if (
                is_array($signal) &&
                preg_match('/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/', $line, $m) === 1
            ) {
                $signal[(string) $m[1]] = self::parseScalar((string) $m[2]);
            }
        }

        if (is_array($signal)) {
            $data['signals'][] = $signal;
        }

        foreach ($data['signals'] as &$item) {
            if (!is_array($item['labels'] ?? null)) {
                $item['labels'] = isset($item['labels']) ? [(string) $item['labels']] : [];
            }
            $item['status'] = strtolower(trim((string) ($item['status'] ?? '')));
            $item['critical'] = (bool) ($item['critical'] ?? false);
        }
        unset($item);

        return $data;
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public static function parseCodexActiveBlocks(string $content): array
    {
        $blocks = [];
        if (
            preg_match_all('/<!--\s*CODEX_ACTIVE\s*\n([\s\S]*?)-->/', $content, $matches, PREG_SET_ORDER) !== 1 &&
            empty($matches)
        ) {
            return $blocks;
        }

        foreach ($matches as $match) {
            $block = [];
            $body = (string) ($match[1] ?? '');
            foreach (explode("\n", $body) as $line) {
                if (preg_match('/^\s*([a-zA-Z_][\w-]*):\s*(.*)\s*$/', $line, $m) === 1) {
                    $block[(string) $m[1]] = self::parseScalar((string) $m[2]);
                }
            }
            if (!is_array($block['files'] ?? null)) {
                $block['files'] = isset($block['files']) ? [(string) $block['files']] : [];
            }
            $blocks[] = $block;
        }

        return $blocks;
    }
}
