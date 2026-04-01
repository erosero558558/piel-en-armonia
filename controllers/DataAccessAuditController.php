<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/ApiKernel.php';
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/DataAccessAudit.php';

class DataAccessAuditController
{
    public static function process(array $request): array
    {
        if ($request['method'] !== 'GET') {
            return [
                'statusCode' => 405,
                'json' => ['ok' => false, 'error' => 'Metodo no soportado']
            ];
        }

        if (!legacy_admin_is_authenticated() && !operator_auth_is_authenticated()) {
            return [
                'statusCode' => 401,
                'json' => ['ok' => false, 'error' => 'No autorizado']
            ];
        }

        $patientId = trim((string)($request['query']['patient_id'] ?? ''));
        if ($patientId === '') {
            return [
                'statusCode' => 400,
                'json' => ['ok' => false, 'error' => 'El parametro patient_id es obligatorio']
            ];
        }

        $logFile = data_dir_path() . DIRECTORY_SEPARATOR . 'access-log.jsonl';
        $events = [];

        if (file_exists($logFile) && is_readable($logFile)) {
            $handle = @fopen($logFile, 'r');
            if ($handle) {
                while (($line = fgets($handle)) !== false) {
                    $entry = json_decode($line, true);
                    if (is_array($entry) && isset($entry['patient_id']) && (string)$entry['patient_id'] === $patientId) {
                        $events[] = [
                            'accessor' => $entry['accessor'] ?? '',
                            'resource' => $entry['resource'] ?? '',
                            'ts' => $entry['ts'] ?? 0,
                            'ip' => $entry['ip'] ?? ''
                        ];
                    }
                }
                fclose($handle);
            }
        }

        // Orden cronológico inverso (más recientes primero)
        usort($events, function($a, $b) {
            return $b['ts'] <=> $a['ts'];
        });

        return [
            'statusCode' => 200,
            'json' => [
                'access_events' => $events
            ]
        ];
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:data-access-audit':
                self::process($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'process':
                            self::process($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
