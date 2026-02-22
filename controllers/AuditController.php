<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/common.php';
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/http.php';

class AuditController
{
    public static function index(array $context): void
    {
        // Check Admin Auth (Redundant if not in public endpoints, but good practice)
        if (!isset($context['isAdmin']) || $context['isAdmin'] !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 100;
        if ($limit < 1) {
            $limit = 100;
        }
        if ($limit > 1000) {
            $limit = 1000;
        }

        $offset = isset($_GET['offset']) ? (int) $_GET['offset'] : 0;
        if ($offset < 0) {
            $offset = 0;
        }

        // Use interpolation for LIMIT/OFFSET as simple PDO wrapper might bind as string
        $logs = db_query("SELECT * FROM audit_logs ORDER BY ts DESC LIMIT $limit OFFSET $offset");

        if ($logs === false) {
             json_response(['ok' => false, 'error' => 'Error fetching logs'], 500);
        }

        // Decode details JSON
        foreach ($logs as &$log) {
            if (isset($log['details'])) {
                $decoded = json_decode($log['details'], true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $log['details'] = $decoded;
                }
            }
        }
        unset($log);

        json_response([
            'ok' => true,
            'data' => $logs
        ]);
    }
}
