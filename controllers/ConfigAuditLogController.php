<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/storage.php';

final class ConfigAuditLogController
{
    public static function index(array $context): void
    {
        require_admin_auth();

        $auditFile = data_dir_path() . '/config-audit.jsonl';
        $changes = [];

        if (is_file($auditFile)) {
            $handle = @fopen($auditFile, 'rb');
            if ($handle !== false) {
                while (($line = fgets($handle)) !== false) {
                    $entry = json_decode(trim($line), true);
                    if (is_array($entry)) {
                        $changes[] = $entry;
                    }
                }
                fclose($handle);
            }
        }

        // Descending order sort by timestamp
        usort($changes, static function ($a, $b) {
            $tsA = strtotime($a['ts'] ?? '');
            $tsB = strtotime($b['ts'] ?? '');
            return $tsB <=> $tsA;
        });

        // Limit to 100 recent changes 
        $changes = array_slice($changes, 0, 100);

        json_response([
            'ok' => true,
            'data' => $changes,
        ]);
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:config-audit-log':
                self::index($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'index':
                            self::index($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
